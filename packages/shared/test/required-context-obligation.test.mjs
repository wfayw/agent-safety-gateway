import assert from "node:assert/strict";
import test from "node:test";

import {
  ContextRetentionDomain,
  ContextRetentionMode,
  ContextRetentionModeValues,
  RequiredContextConflictPolicy,
  RequiredContextMissingAnchorAction,
  RequiredContextObligationSchema,
  RequiredContextTaintPolicy,
  isRequiredContextObligation,
  validateRequiredContextObligation,
} from "@agent-safety-gateway/shared/context-retention";

const validSqlContextObligation = {
  obligationId: "rco-sql-delete-latest-user-instruction",
  toolCallDigest: "sha256:delete-orders-tool-call",
  actionImpactClass: "database_write",
  requiredAnchors: [
    "ctx-user-instruction-clean-pending-orders",
    "ctx-system-policy-sql-production",
    "ctx-resource-state-orders-prod",
  ],
  freshnessWindow: "PT30M",
  minimumRetentionMode: ContextRetentionMode.Verbatim,
  conflictPolicy: RequiredContextConflictPolicy.DenyOnOmittedConflict,
  taintPolicy: RequiredContextTaintPolicy.DenyOnUntrustedInstruction,
  missingAnchorAction: RequiredContextMissingAnchorAction.Reground,
};

test("validates a RequiredContextObligation for context anchors", () => {
  const result = RequiredContextObligationSchema.safeParse(
    validSqlContextObligation,
  );

  assert.equal(result.success, true);
  assert.equal(result.data.toolCallDigest, "sha256:delete-orders-tool-call");
  assert.equal(result.data.actionImpactClass, "database_write");
  assert.deepEqual(result.data.requiredAnchors, [
    "ctx-user-instruction-clean-pending-orders",
    "ctx-system-policy-sql-production",
    "ctx-resource-state-orders-prod",
  ]);
  assert.equal(result.data.freshnessWindow, "PT30M");
  assert.equal(result.data.minimumRetentionMode, ContextRetentionMode.Verbatim);
  assert.equal(
    result.data.conflictPolicy,
    RequiredContextConflictPolicy.DenyOnOmittedConflict,
  );
  assert.equal(
    result.data.taintPolicy,
    RequiredContextTaintPolicy.DenyOnUntrustedInstruction,
  );
  assert.equal(
    result.data.missingAnchorAction,
    RequiredContextMissingAnchorAction.Reground,
  );
  assert.equal(isRequiredContextObligation(validSqlContextObligation), true);
});

test("supports a tool-specific compiler contract that returns ContextAnchor ids", async () => {
  const availableAnchors = [
    {
      anchorId: "ctx-user-instruction-clean-pending-orders",
      anchorType: "user_instruction",
      sourceIdentity: "user:ops",
      authorityLevel: "requester",
      resourceScope: "database:orders",
      createdAt: "2026-05-01T09:00:00.000Z",
      expiresAt: "2026-05-01T10:00:00.000Z",
      contentDigest: "sha256:user-instruction-context-v1",
      semanticClaimsDigest: "sha256:user-instruction-claims-v1",
      mustBeVerbatim: true,
      allowCertifiedSummary: false,
      allowRetrievableReference: false,
      trustTier: "high",
    },
    {
      anchorId: "ctx-system-policy-sql-production",
      anchorType: "system_policy",
      sourceIdentity: "policy:sql-production",
      authorityLevel: "policy_admin",
      resourceScope: "database:orders",
      createdAt: "2026-05-01T08:55:00.000Z",
      expiresAt: "2026-05-01T09:05:00.000Z",
      contentDigest: "sha256:sql-policy-context-v1",
      semanticClaimsDigest: "sha256:sql-policy-claims-v1",
      mustBeVerbatim: false,
      allowCertifiedSummary: true,
      allowRetrievableReference: true,
      trustTier: "high",
    },
  ];
  const sqlCompiler = {
    toolType: "sql",
    compileRequiredContextObligations(input) {
      return {
        toolCallDigest: input.toolCallDigest,
        actionImpactClass: input.actionImpactClass,
        obligations: [
          {
            ...validSqlContextObligation,
            obligationId: `${input.candidateId}:required-context`,
            toolCallDigest: input.toolCallDigest,
            actionImpactClass: input.actionImpactClass,
            requiredAnchors: input.availableAnchors.map(
              (anchor) => anchor.anchorId,
            ),
          },
        ],
      };
    },
  };

  const compilation = await sqlCompiler.compileRequiredContextObligations({
    candidateId: "tool-call-sql-delete-001",
    toolCallCandidate: { sql: "delete from orders where status = 'pending'" },
    toolCallDigest: "sha256:sql-delete-tool-call-v2",
    actionImpactClass: "database_write",
    availableAnchors,
  });

  assert.equal(compilation.toolCallDigest, "sha256:sql-delete-tool-call-v2");
  assert.equal(compilation.actionImpactClass, "database_write");
  assert.equal(compilation.obligations.length, 1);
  assert.deepEqual(compilation.obligations[0].requiredAnchors, [
    "ctx-user-instruction-clean-pending-orders",
    "ctx-system-policy-sql-production",
  ]);
  assert.equal(
    RequiredContextObligationSchema.safeParse(compilation.obligations[0])
      .success,
    true,
  );
});

test("keeps RequiredContextObligation in the context-retention namespace", () => {
  assert.equal(ContextRetentionDomain.obligation, "RequiredContextObligation");
  assert.deepEqual(ContextRetentionModeValues, [
    ContextRetentionMode.Verbatim,
    ContextRetentionMode.CertifiedSummary,
    ContextRetentionMode.RetrievableReference,
    ContextRetentionMode.Missing,
    ContextRetentionMode.Stale,
    ContextRetentionMode.Conflicting,
    ContextRetentionMode.Tainted,
  ]);
});

test("rejects malformed RequiredContextObligation fields", () => {
  const result = validateRequiredContextObligation({
    obligationId: "",
    toolCallDigest: null,
    actionImpactClass: "",
    requiredAnchors: ["ctx-valid", ""],
    freshnessWindow: "30m",
    minimumRetentionMode: ContextRetentionMode.Missing,
    conflictPolicy: "ignore_conflict",
    taintPolicy: "allow_untrusted_instruction",
    missingAnchorAction: "continue",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    [
      "$.obligationId",
      "$.toolCallDigest",
      "$.actionImpactClass",
      "$.requiredAnchors[1]",
      "$.freshnessWindow",
      "$.minimumRetentionMode",
      "$.conflictPolicy",
      "$.taintPolicy",
      "$.missingAnchorAction",
    ],
  );
  assert.equal(isRequiredContextObligation(result), false);
});

test("requires at least one referenced ContextAnchor id", () => {
  const result = validateRequiredContextObligation({
    ...validSqlContextObligation,
    requiredAnchors: [],
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    ["$.requiredAnchors"],
  );
});

test("throws a typed validation error on parse failure", () => {
  assert.throws(
    () => RequiredContextObligationSchema.parse({}),
    (error) =>
      error.name === "RequiredContextObligationValidationError" &&
      Array.isArray(error.issues) &&
      error.issues.some((issue) => issue.path === "$.toolCallDigest"),
  );
});
