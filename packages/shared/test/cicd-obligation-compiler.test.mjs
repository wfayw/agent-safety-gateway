import assert from "node:assert/strict";
import test from "node:test";

import {
  CiCdForbiddenEffectObligationKind,
  CiCdForbiddenEffectOperation,
  CiCdPipelineTestStatus,
  compileCiCdForbiddenEffectObligations,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  ForbiddenEffectFailClosedAction,
  ForbiddenEffectObligationSchema,
  ForbiddenEffectType,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

const assertValidObligations = (obligations) => {
  for (const obligation of obligations) {
    const result = ForbiddenEffectObligationSchema.safeParse(obligation);
    assert.equal(
      result.success,
      true,
      JSON.stringify(result.success ? [] : result.issues, null, 2),
    );
  }
};

const findObligationByKind = (obligations, kind) => {
  const obligation = obligations.find((item) =>
    item.obligationId.includes(`-${kind}-`),
  );
  assert.ok(obligation, `Expected obligation kind ${kind}`);
  return obligation;
};

test("compiles production deploy requests into CI/CD forbidden side-effect obligations", () => {
  const result = compileCiCdForbiddenEffectObligations({
    requestId: "req-cicd-prod-deploy",
    operation: "deploy",
    service: "payment-service",
    pipeline: "payment-service-release",
    version: "2026.05.01",
    environment: ForbiddenEffectEnvironment.Production,
    testStatus: "passed",
    requestHash: "sha256:cicd-prod-deploy-request",
    createdAt: "2026-05-01T06:30:00.000Z",
  });

  assert.equal(result.operation, CiCdForbiddenEffectOperation.Deploy);
  assert.equal(result.targetEnvironment, ForbiddenEffectEnvironment.Production);
  assert.equal(result.dryRun, false);
  assert.equal(result.testStatus, CiCdPipelineTestStatus.Passed);
  assert.equal(result.failClosed, false);
  assert.deepEqual(result.resourceScope, [
    "payment-service",
    "payment-service-release",
    ForbiddenEffectEnvironment.Production,
  ]);
  assert.equal(result.obligations.length, 4);
  assertValidObligations(result.obligations);

  const productionDeploy = findObligationByKind(
    result.obligations,
    CiCdForbiddenEffectObligationKind.ProductionDeploy,
  );
  assert.equal(productionDeploy.effectType, ForbiddenEffectType.CiCd);
  assert.equal(productionDeploy.executorType, ForbiddenEffectType.CiCd);
  assert.equal(
    productionDeploy.failClosedAction,
    ForbiddenEffectFailClosedAction.DenyPermit,
  );
  assert.deepEqual(productionDeploy.requiredEvidenceTypes, [
    ForbiddenEffectEvidenceType.ProductionDeployDenial,
  ]);
  assert.deepEqual(productionDeploy.forbiddenCapabilities, [
    "production_deploy",
    "deploy_endpoint_call",
  ]);
  assert.deepEqual(productionDeploy.forbiddenEffects, [
    "production_deploy",
    "deployment_state_change",
  ]);
  assert.equal(productionDeploy.requestHash, "sha256:cicd-prod-deploy-request");
  assert.equal(productionDeploy.createdAt, "2026-05-01T06:30:00.000Z");

  const webhook = findObligationByKind(
    result.obligations,
    CiCdForbiddenEffectObligationKind.ExternalWebhook,
  );
  assert.deepEqual(webhook.requiredEvidenceTypes, [
    ForbiddenEffectEvidenceType.ExternalWebhookDenial,
    ForbiddenEffectEvidenceType.NoExternalSideEffect,
  ]);
  assert.deepEqual(webhook.forbiddenEffects, [
    "external_webhook",
    "external_side_effect",
  ]);

  const artifactPromotion = findObligationByKind(
    result.obligations,
    CiCdForbiddenEffectObligationKind.ArtifactPromotion,
  );
  assert.deepEqual(artifactPromotion.requiredEvidenceTypes, [
    ForbiddenEffectEvidenceType.ArtifactPromotionDenial,
  ]);
  assert.deepEqual(artifactPromotion.forbiddenCapabilities, [
    "artifact_promotion",
    "artifact_registry_write",
  ]);

  const environmentMutation = findObligationByKind(
    result.obligations,
    CiCdForbiddenEffectObligationKind.EnvironmentMutation,
  );
  assert.deepEqual(environmentMutation.requiredEvidenceTypes, [
    ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
    ForbiddenEffectEvidenceType.ProductionCredentialUseDenial,
    ForbiddenEffectEvidenceType.ProductionWriteEndpointAccessDenial,
  ]);
  assert.deepEqual(environmentMutation.forbiddenEffects, [
    "environment_mutation",
    "production_state_change",
  ]);

  for (const obligation of result.obligations) {
    assert.equal(obligation.requiredExecutionMode, "production_deploy_guarded");
    assert.deepEqual(obligation.resourceScope, result.resourceScope);
    assert.equal(obligation.environment, ForbiddenEffectEnvironment.Production);
  }
});

test("compiles dry-run release requests into no-real-deploy obligations", () => {
  const result = compileCiCdForbiddenEffectObligations({
    requestId: "req-cicd-dry-run-release",
    operation: "release",
    service: "payment-service",
    pipeline: "payment-service-release",
    environment: ForbiddenEffectEnvironment.Production,
    requiredExecutionMode: "dry_run",
    testStatus: "passed",
  });

  assert.equal(result.operation, CiCdForbiddenEffectOperation.Release);
  assert.equal(result.dryRun, true);
  assert.equal(result.failClosed, false);
  assert.equal(result.obligations.length, 1);
  assertValidObligations(result.obligations);

  const obligation = findObligationByKind(
    result.obligations,
    CiCdForbiddenEffectObligationKind.NoRealDeploy,
  );
  assert.equal(obligation.requiredExecutionMode, "dry_run");
  assert.deepEqual(obligation.requiredEvidenceTypes, [
    ForbiddenEffectEvidenceType.ProductionDeployDenial,
    ForbiddenEffectEvidenceType.ExternalWebhookDenial,
    ForbiddenEffectEvidenceType.ArtifactPromotionDenial,
    ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
    ForbiddenEffectEvidenceType.NoExternalSideEffect,
  ]);
  assert.deepEqual(obligation.forbiddenCapabilities, [
    "real_deploy",
    "production_deploy",
    "deploy_endpoint_call",
    "external_webhook",
    "artifact_promotion",
    "environment_mutation",
  ]);
  assert.deepEqual(obligation.forbiddenEffects, [
    "production_deploy",
    "external_webhook",
    "artifact_promotion",
    "environment_mutation",
  ]);
});

test("compiles failed, unknown, and missing production tests into fail-closed obligations", () => {
  const cases = [
    {
      testStatus: "failed",
      expectedStatus: CiCdPipelineTestStatus.Failed,
      expectedCapability: "deploy_with_failed_tests",
    },
    {
      testStatus: "unknown",
      expectedStatus: CiCdPipelineTestStatus.Unknown,
      expectedCapability: "deploy_with_unverified_tests",
    },
    {
      testStatus: undefined,
      expectedStatus: CiCdPipelineTestStatus.Missing,
      expectedCapability: "deploy_with_unverified_tests",
    },
  ];

  for (const item of cases) {
    const result = compileCiCdForbiddenEffectObligations({
      requestId: `req-cicd-tests-${item.expectedStatus}`,
      operation: "deploy",
      service: "payment-service",
      pipeline: "payment-service-release",
      environment: ForbiddenEffectEnvironment.Production,
      ...(item.testStatus === undefined ? {} : { testStatus: item.testStatus }),
    });

    assert.equal(result.operation, CiCdForbiddenEffectOperation.Deploy);
    assert.equal(result.testStatus, item.expectedStatus);
    assert.equal(result.failClosed, true);
    assert.equal(result.obligations.length, 5);
    assertValidObligations(result.obligations);

    const obligation = findObligationByKind(
      result.obligations,
      CiCdForbiddenEffectObligationKind.TestsNotPassed,
    );
    assert.equal(obligation.requiredExecutionMode, "fail_closed");
    assert.equal(
      obligation.forbiddenCapabilities.includes(item.expectedCapability),
      true,
    );
    assert.deepEqual(obligation.requiredEvidenceTypes, [
      ForbiddenEffectEvidenceType.ProductionDeployDenial,
      ForbiddenEffectEvidenceType.ExternalWebhookDenial,
      ForbiddenEffectEvidenceType.ArtifactPromotionDenial,
      ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
    ]);
    assert.deepEqual(obligation.forbiddenEffects, [
      "production_deploy_without_passing_tests",
      "external_webhook",
      "artifact_promotion",
      "environment_mutation",
    ]);
  }
});
