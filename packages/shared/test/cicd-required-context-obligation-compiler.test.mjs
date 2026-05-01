import assert from "node:assert/strict";
import test from "node:test";
import {
  CiCdRequiredContextAnchorRole,
  CiCdRequiredContextObligationCompiler,
  CiCdRequiredContextObligationKind,
  CiCdRequiredContextOperation,
  CiCdRequiredContextTestStatus,
  ContextRetentionMode,
  RequiredContextMissingAnchorAction,
  RequiredContextObligationSchema,
  compileCiCdRequiredContextObligations,
} from "@agent-safety-gateway/shared/context-retention";

const anchor = ({
  anchorId,
  anchorType,
  resourceScope,
  createdAt = "2026-05-01T09:00:00.000Z",
  sourceIdentity = "fixture:context",
  authorityLevel = "system",
  mustBeVerbatim = anchorType === "user_instruction" ||
    anchorType === "approval_note",
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

const baseCiCdAnchors = [
  anchor({
    anchorId: "ctx-user-instruction-old-payment-release",
    anchorType: "user_instruction",
    sourceIdentity: "user:release-manager",
    authorityLevel: "requester",
    resourceScope: "service:payment-service",
    createdAt: "2026-05-01T08:00:00.000Z",
  }),
  anchor({
    anchorId: "ctx-user-instruction-latest-payment-release",
    anchorType: "user_instruction",
    sourceIdentity: "user:release-manager",
    authorityLevel: "requester",
    resourceScope: "pipeline:payment-service-release",
    createdAt: "2026-05-01T09:05:00.000Z",
  }),
  anchor({
    anchorId: "ctx-approval-payment-prod-deploy",
    anchorType: "approval_note",
    sourceIdentity: "approval:change-1234",
    authorityLevel: "approver",
    resourceScope: "pipeline:payment-service-release",
  }),
  anchor({
    anchorId: "ctx-release-policy-production",
    anchorType: "system_policy",
    sourceIdentity: "policy:release-production",
    authorityLevel: "policy_admin",
    resourceScope: "cicd:*",
    mustBeVerbatim: false,
  }),
  anchor({
    anchorId: "ctx-test-result-payment-release",
    anchorType: "tool_result",
    sourceIdentity: "ci:payment-service-release-tests",
    authorityLevel: "ci_system",
    resourceScope: "pipeline:payment-service-release:test_result",
    mustBeVerbatim: false,
  }),
  anchor({
    anchorId: "ctx-pipeline-state-payment-release",
    anchorType: "resource_state",
    sourceIdentity: "ci:payment-service-release-state",
    authorityLevel: "ci_system",
    resourceScope: "pipeline:payment-service-release:production",
    mustBeVerbatim: false,
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

test("compiles production deploys into CI/CD context obligations", () => {
  const result = compileCiCdRequiredContextObligations({
    requestId: "req-cicd-prod-deploy",
    operation: "deploy",
    service: "payment-service",
    pipeline: "payment-service-release",
    targetEnvironment: "production",
    testStatus: "passed",
    toolCallDigest: "sha256:cicd-prod-deploy-tool-call",
    availableAnchors: baseCiCdAnchors,
  });

  assert.equal(result.operation, CiCdRequiredContextOperation.Deploy);
  assert.equal(
    result.obligationKind,
    CiCdRequiredContextObligationKind.ProductionDeployContext,
  );
  assert.equal(result.testStatus, CiCdRequiredContextTestStatus.Passed);
  assert.equal(result.requiresNegativeEvidenceAnchors, false);
  assert.deepEqual(result.resourceScope, [
    "payment-service",
    "payment-service-release",
    "production",
  ]);
  assert.equal(result.actionImpactClass, "production_deploy");
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
    "ctx-user-instruction-latest-payment-release",
    "ctx-approval-payment-prod-deploy",
    "ctx-test-result-payment-release",
    "ctx-release-policy-production",
    "ctx-pipeline-state-payment-release",
  ]);
  assert.deepEqual(anchorIdsForRole(result, CiCdRequiredContextAnchorRole.ApprovalNote), [
    "ctx-approval-payment-prod-deploy",
  ]);
  assert.deepEqual(anchorIdsForRole(result, CiCdRequiredContextAnchorRole.TestResult), [
    "ctx-test-result-payment-release",
  ]);
  assert.equal(
    retentionForRole(result, CiCdRequiredContextAnchorRole.ApprovalNote),
    ContextRetentionMode.Verbatim,
  );
  assert.equal(
    retentionForRole(result, CiCdRequiredContextAnchorRole.ReleasePolicy),
    ContextRetentionMode.CertifiedSummary,
  );
});

test("requires negative evidence when CI tests fail", () => {
  const result = compileCiCdRequiredContextObligations({
    requestId: "req-cicd-failed-tests",
    operation: "deploy",
    service: "payment-service",
    pipeline: "payment-service-release",
    targetEnvironment: "production",
    testStatus: "failed",
    toolCallDigest: "sha256:cicd-failed-tests-tool-call",
    availableAnchors: [
      ...baseCiCdAnchors,
      anchor({
        anchorId: "ctx-negative-test-evidence-payment-release",
        anchorType: "negative_evidence",
        sourceIdentity: "ci:payment-service-release-tests",
        authorityLevel: "ci_system",
        resourceScope: "pipeline:payment-service-release:failed_tests",
        mustBeVerbatim: false,
      }),
    ],
  });

  assert.equal(result.testStatus, CiCdRequiredContextTestStatus.Failed);
  assert.equal(result.requiresNegativeEvidenceAnchors, true);
  assert.deepEqual(
    anchorIdsForRole(result, CiCdRequiredContextAnchorRole.NegativeTestEvidence),
    ["ctx-negative-test-evidence-payment-release"],
  );
  assert.equal(result.obligations[0].requiredAnchors.includes(
    "ctx-negative-test-evidence-payment-release",
  ), true);
});

test("requires fallback negative evidence when CI test status is missing", () => {
  const result = compileCiCdRequiredContextObligations({
    requestId: "req-cicd-missing-tests",
    operation: "deploy",
    service: "payment-service",
    pipeline: "payment-service-release",
    targetEnvironment: "production",
    toolCallDigest: "sha256:cicd-missing-tests-tool-call",
    availableAnchors: baseCiCdAnchors,
  });

  assert.equal(result.testStatus, CiCdRequiredContextTestStatus.Missing);
  assert.equal(result.requiresNegativeEvidenceAnchors, true);
  assert.deepEqual(
    anchorIdsForRole(result, CiCdRequiredContextAnchorRole.NegativeTestEvidence),
    [
      "ctx-required-cicd-req-cicd-missing-tests-negative_test_evidence-test-result",
    ],
  );
});

test("marks dry-run-only approval notes for verbatim retention", () => {
  const result = compileCiCdRequiredContextObligations({
    requestId: "req-cicd-dry-run-only-approval",
    operation: "deploy",
    service: "payment-service",
    pipeline: "payment-service-release",
    targetEnvironment: "production",
    requiredExecutionMode: "dry_run",
    testStatus: "passed",
    toolCallDigest: "sha256:cicd-dry-run-only-tool-call",
    availableAnchors: [
      ...baseCiCdAnchors.filter(
        (contextAnchor) => contextAnchor.anchorType !== "approval_note",
      ),
      anchor({
        anchorId: "ctx-approval-dry-run-only-payment-release",
        anchorType: "approval_note",
        sourceIdentity: "approval:change-5678",
        authorityLevel: "approver",
        resourceScope:
          "pipeline:payment-service-release approval:only dry-run no production deploy",
      }),
    ],
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.dryRunOnlyApproval, true);
  assert.equal(
    result.obligationKind,
    CiCdRequiredContextObligationKind.DryRunDeployContext,
  );
  assert.deepEqual(anchorIdsForRole(result, CiCdRequiredContextAnchorRole.ApprovalNote), [
    "ctx-approval-dry-run-only-payment-release",
  ]);
  assert.equal(
    retentionForRole(result, CiCdRequiredContextAnchorRole.ApprovalNote),
    ContextRetentionMode.Verbatim,
  );
  assert.deepEqual(result.obligations[0].requiredAnchors, [
    "ctx-user-instruction-latest-payment-release",
    "ctx-approval-dry-run-only-payment-release",
    "ctx-test-result-payment-release",
    "ctx-release-policy-production",
    "ctx-pipeline-state-payment-release",
  ]);
});

test("exposes CI/CD context compilation through the tool-specific compiler", async () => {
  const result = await CiCdRequiredContextObligationCompiler.compileRequiredContextObligations({
    candidateId: "tool-call-cicd-production-deploy",
    toolCallCandidate: {
      operation: "deploy",
      service: "payment-service",
      pipeline: "payment-service-release",
      targetEnvironment: "production",
      testStatus: "passed",
    },
    toolCallDigest: "sha256:cicd-tool-specific-tool-call",
    actionImpactClass: "production_deploy",
    availableAnchors: baseCiCdAnchors,
  });

  assert.equal(result.toolCallDigest, "sha256:cicd-tool-specific-tool-call");
  assert.equal(result.actionImpactClass, "production_deploy");
  assert.equal(result.obligations.length, 1);
  assert.deepEqual(result.obligations[0].requiredAnchors, [
    "ctx-user-instruction-latest-payment-release",
    "ctx-approval-payment-prod-deploy",
    "ctx-test-result-payment-release",
    "ctx-release-policy-production",
    "ctx-pipeline-state-payment-release",
  ]);
});
