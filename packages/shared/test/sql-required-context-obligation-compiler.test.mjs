import assert from "node:assert/strict";
import test from "node:test";

import {
  compileSqlRequiredContextObligations,
  ContextRetentionMode,
  RequiredContextMissingAnchorAction,
  RequiredContextObligationSchema,
  SqlRequiredContextAnchorRole,
  SqlRequiredContextObligationCompiler,
  SqlRequiredContextObligationKind,
  SqlRequiredContextOperation,
} from "@agent-safety-gateway/shared/context-retention";

const anchor = ({
  anchorId,
  anchorType,
  resourceScope,
  createdAt = "2026-05-01T09:00:00.000Z",
  sourceIdentity = "fixture:context",
  authorityLevel = "system",
}) => ({
  anchorId,
  anchorType,
  sourceIdentity,
  authorityLevel,
  resourceScope,
  createdAt,
  expiresAt: "2026-05-01T10:00:00.000Z",
  contentDigest: `sha256:${anchorId}-content`,
  semanticClaimsDigest: `sha256:${anchorId}-claims`,
  mustBeVerbatim: anchorType === "user_instruction",
  allowCertifiedSummary: anchorType !== "user_instruction",
  allowRetrievableReference: true,
  trustTier: "high",
});

const baseSqlAnchors = [
  anchor({
    anchorId: "ctx-user-instruction-old-orders",
    anchorType: "user_instruction",
    sourceIdentity: "user:ops",
    authorityLevel: "requester",
    resourceScope: "database:orders",
    createdAt: "2026-05-01T08:00:00.000Z",
  }),
  anchor({
    anchorId: "ctx-user-instruction-latest-orders",
    anchorType: "user_instruction",
    sourceIdentity: "user:ops",
    authorityLevel: "requester",
    resourceScope: "database:orders",
    createdAt: "2026-05-01T09:05:00.000Z",
  }),
  anchor({
    anchorId: "ctx-system-policy-sql-production",
    anchorType: "system_policy",
    sourceIdentity: "policy:sql-production",
    authorityLevel: "policy_admin",
    resourceScope: "database:*",
  }),
  anchor({
    anchorId: "ctx-resource-state-orders-prod",
    anchorType: "resource_state",
    sourceIdentity: "catalog:postgres",
    authorityLevel: "catalog",
    resourceScope: "database:orders",
  }),
  anchor({
    anchorId: "ctx-rollback-orders-prod",
    anchorType: "retrieved_document",
    sourceIdentity: "runbook:rollback-orders",
    authorityLevel: "operator_runbook",
    resourceScope: "database:orders:rollback",
  }),
  anchor({
    anchorId: "ctx-resource-state-customers-prod",
    anchorType: "resource_state",
    sourceIdentity: "catalog:postgres",
    authorityLevel: "catalog",
    resourceScope: "database:customers",
  }),
  anchor({
    anchorId: "ctx-rollback-customers-prod",
    anchorType: "retrieved_document",
    sourceIdentity: "runbook:rollback-customers",
    authorityLevel: "operator_runbook",
    resourceScope: "database:customers:rollback",
  }),
];

const assertValidObligation = (obligation) => {
  const result = RequiredContextObligationSchema.safeParse(obligation);

  assert.equal(result.success, true);
};

const anchorIdsForRole = (result, role) =>
  result.requiredAnchorRoles
    .filter((requirement) => requirement.role === role)
    .map((requirement) => requirement.anchorId);

test("compiles destructive SQL writes into strict context obligations", () => {
  const result = compileSqlRequiredContextObligations({
    requestId: "req-sql-delete-orders",
    sql: "DELETE FROM orders WHERE status = 'PENDING'",
    toolCallDigest: "sha256:delete-orders-tool-call",
    availableAnchors: baseSqlAnchors,
  });

  assert.equal(result.operation, SqlRequiredContextOperation.Delete);
  assert.equal(result.obligationKind, SqlRequiredContextObligationKind.WriteContext);
  assert.equal(result.requiresUncertaintyAnchors, false);
  assert.deepEqual(result.resourceScope, ["orders"]);
  assert.deepEqual(result.unresolvedTables, []);
  assert.equal(result.actionImpactClass, "database_write");
  assert.equal(result.obligations.length, 1);

  const [obligation] = result.obligations;
  assertValidObligation(obligation);
  assert.equal(obligation.minimumRetentionMode, ContextRetentionMode.Verbatim);
  assert.equal(obligation.freshnessWindow, "PT30M");
  assert.equal(
    obligation.missingAnchorAction,
    RequiredContextMissingAnchorAction.RegroundOrDeny,
  );
  assert.deepEqual(obligation.requiredAnchors, [
    "ctx-user-instruction-latest-orders",
    "ctx-system-policy-sql-production",
    "ctx-resource-state-orders-prod",
    "ctx-rollback-orders-prod",
  ]);
  assert.deepEqual(anchorIdsForRole(result, SqlRequiredContextAnchorRole.LatestUserInstruction), [
    "ctx-user-instruction-latest-orders",
  ]);
  assert.deepEqual(anchorIdsForRole(result, SqlRequiredContextAnchorRole.RollbackContext), [
    "ctx-rollback-orders-prod",
  ]);
});

test("compiles readonly SELECT into a lighter context obligation", () => {
  const result = compileSqlRequiredContextObligations({
    requestId: "req-sql-read-orders-customers",
    sql: `
      SELECT o.id, c.email
      FROM public.orders o
      JOIN customers c ON c.id = o.customer_id
    `,
    toolCallDigest: "sha256:select-orders-customers-tool-call",
    availableAnchors: baseSqlAnchors,
  });

  assert.equal(result.operation, SqlRequiredContextOperation.Select);
  assert.equal(result.obligationKind, SqlRequiredContextObligationKind.ReadonlyContext);
  assert.deepEqual(result.resourceScope, ["orders", "customers"]);
  assert.equal(result.actionImpactClass, "database_read");
  assert.equal(result.obligations.length, 1);

  const [obligation] = result.obligations;
  assertValidObligation(obligation);
  assert.equal(obligation.minimumRetentionMode, ContextRetentionMode.CertifiedSummary);
  assert.equal(obligation.freshnessWindow, "PT2H");
  assert.equal(obligation.missingAnchorAction, RequiredContextMissingAnchorAction.Reground);
  assert.deepEqual(obligation.requiredAnchors, [
    "ctx-user-instruction-latest-orders",
    "ctx-system-policy-sql-production",
    "ctx-resource-state-orders-prod",
    "ctx-resource-state-customers-prod",
  ]);
  assert.deepEqual(anchorIdsForRole(result, SqlRequiredContextAnchorRole.RollbackContext), []);
});

test("compiles unresolved SQL targets into explicit uncertainty anchors", () => {
  const result = compileSqlRequiredContextObligations({
    requestId: "req-sql-unresolved-target",
    sql: "SELECT 1",
    toolCallDigest: "sha256:select-one-tool-call",
    availableAnchors: [
      ...baseSqlAnchors,
      anchor({
        anchorId: "ctx-user-instruction-latest-sql-request",
        anchorType: "user_instruction",
        sourceIdentity: "user:ops",
        authorityLevel: "requester",
        resourceScope: "tool_call:sql",
        createdAt: "2026-05-01T09:10:00.000Z",
      }),
      anchor({
        anchorId: "ctx-sql-unresolved-target-uncertainty",
        anchorType: "negative_evidence",
        sourceIdentity: "parser:sql-resource-resolver",
        authorityLevel: "gateway",
        resourceScope: "database:unresolved_sql_resource",
      }),
    ],
  });

  assert.equal(result.operation, SqlRequiredContextOperation.Select);
  assert.equal(result.obligationKind, SqlRequiredContextObligationKind.UncertaintyContext);
  assert.equal(result.requiresUncertaintyAnchors, true);
  assert.deepEqual(result.resourceScope, ["unresolved_sql_resource"]);
  assert.deepEqual(result.unresolvedTables, ["unresolved_sql_resource"]);
  assert.equal(result.actionImpactClass, "database_uncertain");

  const [obligation] = result.obligations;
  assertValidObligation(obligation);
  assert.equal(obligation.minimumRetentionMode, ContextRetentionMode.Verbatim);
  assert.equal(obligation.freshnessWindow, "PT15M");
  assert.equal(obligation.missingAnchorAction, RequiredContextMissingAnchorAction.Deny);
  assert.deepEqual(anchorIdsForRole(result, SqlRequiredContextAnchorRole.Uncertainty), [
    "ctx-sql-unresolved-target-uncertainty",
  ]);
  assert.deepEqual(obligation.requiredAnchors, [
    "ctx-user-instruction-latest-sql-request",
    "ctx-system-policy-sql-production",
    "ctx-sql-unresolved-target-uncertainty",
  ]);
});

test("exposes SQL context compilation through the tool-specific compiler", async () => {
  const result = await SqlRequiredContextObligationCompiler.compileRequiredContextObligations({
    candidateId: "tool-call-sql-update-orders",
    toolCallCandidate: {
      sql: "UPDATE orders SET status = 'CANCELLED' WHERE id = 42",
    },
    toolCallDigest: "sha256:update-orders-tool-call",
    actionImpactClass: "database_write",
    availableAnchors: baseSqlAnchors,
  });

  assert.equal(result.toolCallDigest, "sha256:update-orders-tool-call");
  assert.equal(result.actionImpactClass, "database_write");
  assert.equal(result.obligations.length, 1);
  assert.deepEqual(result.obligations[0].requiredAnchors, [
    "ctx-user-instruction-latest-orders",
    "ctx-system-policy-sql-production",
    "ctx-resource-state-orders-prod",
    "ctx-rollback-orders-prod",
  ]);
});
