import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigRequiredContextAnchorRole,
  ConfigRequiredContextNamespaceClassification,
  ConfigRequiredContextObligationCompiler,
  ConfigRequiredContextObligationKind,
  ConfigRequiredContextOperation,
  ContextRetentionMode,
  RequiredContextMissingAnchorAction,
  RequiredContextObligationSchema,
  compileConfigRequiredContextObligations,
} from "@agent-safety-gateway/shared/context-retention";

const anchor = ({
  anchorId,
  anchorType,
  resourceScope,
  createdAt = "2026-05-01T09:00:00.000Z",
  sourceIdentity = "fixture:context",
  authorityLevel = "system",
  mustBeVerbatim = anchorType === "user_instruction" ||
    anchorType === "approval_note" ||
    anchorType === "delegation_constraint",
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
  mustBeVerbatim,
  allowCertifiedSummary: !mustBeVerbatim,
  allowRetrievableReference: true,
  trustTier: "high",
});

const baseConfigAnchors = [
  anchor({
    anchorId: "ctx-user-instruction-old-config-timeout",
    anchorType: "user_instruction",
    sourceIdentity: "user:sre",
    authorityLevel: "requester",
    resourceScope: "service:payment-service",
    createdAt: "2026-05-01T08:00:00.000Z",
  }),
  anchor({
    anchorId: "ctx-user-instruction-latest-config-timeout",
    anchorType: "user_instruction",
    sourceIdentity: "user:sre",
    authorityLevel: "requester",
    resourceScope: "config:payment-service.payment.timeout",
    createdAt: "2026-05-01T09:05:00.000Z",
  }),
  anchor({
    anchorId: "ctx-approval-prod-config-timeout",
    anchorType: "approval_note",
    sourceIdentity: "approval:change-9012",
    authorityLevel: "approver",
    resourceScope: "production payment-service.payment.timeout",
  }),
  anchor({
    anchorId: "ctx-config-policy-production",
    anchorType: "system_policy",
    sourceIdentity: "policy:config-production",
    authorityLevel: "policy_admin",
    resourceScope: "config:*",
    mustBeVerbatim: false,
  }),
  anchor({
    anchorId: "ctx-current-config-state-timeout",
    anchorType: "resource_state",
    sourceIdentity: "config-store:payments-config",
    authorityLevel: "config_system",
    resourceScope: "payments-config payment-service.payment.timeout production current version",
    mustBeVerbatim: false,
  }),
  anchor({
    anchorId: "ctx-rollback-plan-config-timeout",
    anchorType: "retrieved_document",
    sourceIdentity: "runbook:config-rollback",
    authorityLevel: "sre_runbook",
    resourceScope: "production payment-service.payment.timeout rollback plan",
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

const retentionForRole = (result, role) =>
  result.requiredAnchorRoles.find((requirement) => requirement.role === role)
    ?.minimumRetentionMode;

test("compiles production config changes into required context obligations", () => {
  const result = compileConfigRequiredContextObligations({
    requestId: "req-config-prod-timeout",
    operation: "update",
    service: "payment-service",
    key: "payment.timeout",
    sourceSystem: "payments-config",
    targetNamespace: "production",
    toolCallDigest: "sha256:config-prod-timeout-tool-call",
    availableAnchors: baseConfigAnchors,
  });

  assert.equal(result.operation, ConfigRequiredContextOperation.Update);
  assert.equal(result.namespace, "production");
  assert.equal(
    result.namespaceClassification,
    ConfigRequiredContextNamespaceClassification.Production,
  );
  assert.equal(
    result.obligationKind,
    ConfigRequiredContextObligationKind.ProductionConfigChangeContext,
  );
  assert.equal(result.requiresNamespaceConstraintAnchors, false);
  assert.equal(result.requiresNegativeEvidenceAnchors, false);
  assert.equal(result.actionImpactClass, "production_config_change");
  assert.deepEqual(result.resourceScope, [
    "payments-config",
    "payment-service.payment.timeout",
    "production",
  ]);
  assert.equal(result.obligations.length, 1);

  const [obligation] = result.obligations;
  assertValidObligation(obligation);
  assert.equal(obligation.minimumRetentionMode, ContextRetentionMode.Verbatim);
  assert.equal(obligation.freshnessWindow, "PT30M");
  assert.equal(
    obligation.missingAnchorAction,
    RequiredContextMissingAnchorAction.Reapproval,
  );
  assert.deepEqual(obligation.requiredAnchors, [
    "ctx-user-instruction-latest-config-timeout",
    "ctx-config-policy-production",
    "ctx-current-config-state-timeout",
    "ctx-approval-prod-config-timeout",
    "ctx-rollback-plan-config-timeout",
  ]);
  assert.deepEqual(anchorIdsForRole(result, ConfigRequiredContextAnchorRole.ApprovalNote), [
    "ctx-approval-prod-config-timeout",
  ]);
  assert.deepEqual(
    anchorIdsForRole(result, ConfigRequiredContextAnchorRole.CurrentConfigState),
    ["ctx-current-config-state-timeout"],
  );
  assert.equal(
    retentionForRole(result, ConfigRequiredContextAnchorRole.RollbackPlan),
    ContextRetentionMode.Verbatim,
  );
  assert.equal(
    retentionForRole(result, ConfigRequiredContextAnchorRole.ConfigPolicy),
    ContextRetentionMode.CertifiedSummary,
  );
});

test("requires namespace constraint anchors for sandbox and canary changes", () => {
  const cases = [
    {
      namespace: "payment-service-sandbox",
      expectedClassification: ConfigRequiredContextNamespaceClassification.Sandbox,
      expectedKind:
        ConfigRequiredContextObligationKind.SandboxNamespaceConstrainedContext,
      expectedImpact: "sandbox_config_change",
      constraintAnchorId: "ctx-namespace-constraint-sandbox",
    },
    {
      namespace: "payment-service-canary",
      expectedClassification: ConfigRequiredContextNamespaceClassification.Canary,
      expectedKind:
        ConfigRequiredContextObligationKind.CanaryNamespaceConstrainedContext,
      expectedImpact: "canary_config_change",
      constraintAnchorId: "ctx-namespace-constraint-canary",
    },
  ];

  for (const item of cases) {
    const result = compileConfigRequiredContextObligations({
      requestId: `req-config-${item.namespace}`,
      operation: "write",
      service: "payment-service",
      key: "payment.timeout",
      sourceSystem: "payments-config",
      targetNamespace: item.namespace,
      toolCallDigest: `sha256:config-${item.namespace}-tool-call`,
      availableAnchors: [
        ...baseConfigAnchors,
        anchor({
          anchorId: item.constraintAnchorId,
          anchorType: "delegation_constraint",
          sourceIdentity: "policy:namespace-isolation",
          authorityLevel: "policy_admin",
          resourceScope: `${item.namespace} namespace constraint isolation`,
        }),
      ],
    });

    assert.equal(result.namespace, item.namespace);
    assert.equal(result.namespaceClassification, item.expectedClassification);
    assert.equal(result.obligationKind, item.expectedKind);
    assert.equal(result.requiresNamespaceConstraintAnchors, true);
    assert.equal(result.actionImpactClass, item.expectedImpact);
    assert.deepEqual(
      anchorIdsForRole(result, ConfigRequiredContextAnchorRole.NamespaceConstraint),
      [item.constraintAnchorId],
    );
    assert.equal(
      retentionForRole(result, ConfigRequiredContextAnchorRole.NamespaceConstraint),
      ContextRetentionMode.Verbatim,
    );
    assert.equal(
      result.obligations[0].requiredAnchors.includes(item.constraintAnchorId),
      true,
    );
  }
});

test("requires negative evidence anchors for dangerous config values", () => {
  const result = compileConfigRequiredContextObligations({
    requestId: "req-config-dangerous-value",
    operation: "update",
    service: "payment-service",
    key: "auth.allowedNetworks",
    sourceSystem: "payments-config",
    targetNamespace: "production",
    proposedValue: "allow_all 0.0.0.0/0 bypass",
    toolCallDigest: "sha256:config-dangerous-value-tool-call",
    availableAnchors: [
      ...baseConfigAnchors,
      anchor({
        anchorId: "ctx-negative-dangerous-config-value",
        anchorType: "negative_evidence",
        sourceIdentity: "policy:config-risk-scanner",
        authorityLevel: "policy_admin",
        resourceScope: "payment-service auth.allowedNetworks dangerous value denied",
        mustBeVerbatim: false,
      }),
    ],
  });

  assert.equal(result.dangerousValue, true);
  assert.equal(result.requiresNegativeEvidenceAnchors, true);
  assert.deepEqual(
    anchorIdsForRole(result, ConfigRequiredContextAnchorRole.NegativeEvidence),
    ["ctx-negative-dangerous-config-value"],
  );
  assert.equal(
    result.obligations[0].requiredAnchors.includes(
      "ctx-negative-dangerous-config-value",
    ),
    true,
  );
});

test("falls back to deterministic missing anchor ids", () => {
  const result = compileConfigRequiredContextObligations({
    requestId: "req-config-missing-anchors",
    operation: "update",
    service: "payment-service",
    key: "payment.timeout",
    targetNamespace: "production",
    dangerousValue: true,
    toolCallDigest: "sha256:config-missing-anchors-tool-call",
    availableAnchors: [],
  });

  assert.deepEqual(result.obligations[0].requiredAnchors, [
    "ctx-required-config-req-config-missing-anchors-latest_user_instruction-tool-call",
    "ctx-required-config-req-config-missing-anchors-config_policy-config-policy",
    "ctx-required-config-req-config-missing-anchors-current_config_state-current-config-state",
    "ctx-required-config-req-config-missing-anchors-approval_note-approval-note",
    "ctx-required-config-req-config-missing-anchors-rollback_plan-rollback-plan",
    "ctx-required-config-req-config-missing-anchors-negative_evidence-dangerous-value",
  ]);
});

test("exposes config context compilation through the tool-specific compiler", async () => {
  const result = await ConfigRequiredContextObligationCompiler.compileRequiredContextObligations({
    candidateId: "tool-call-config-production-change",
    toolCallCandidate: {
      operation: "update",
      service: "payment-service",
      key: "payment.timeout",
      sourceSystem: "payments-config",
      targetNamespace: "production",
    },
    toolCallDigest: "sha256:config-tool-specific-tool-call",
    actionImpactClass: "production_config_change",
    availableAnchors: baseConfigAnchors,
  });

  assert.equal(result.toolCallDigest, "sha256:config-tool-specific-tool-call");
  assert.equal(result.actionImpactClass, "production_config_change");
  assert.equal(result.obligations.length, 1);
  assert.deepEqual(result.obligations[0].requiredAnchors, [
    "ctx-user-instruction-latest-config-timeout",
    "ctx-config-policy-production",
    "ctx-current-config-state-timeout",
    "ctx-approval-prod-config-timeout",
    "ctx-rollback-plan-config-timeout",
  ]);
});
