import assert from "node:assert/strict";
import test from "node:test";

import {
  compileConfigForbiddenEffectObligations,
  ConfigForbiddenEffectObligationKind,
  ConfigForbiddenEffectOperation,
  ConfigNamespaceClassification,
  ConfigRollbackCapability,
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

test("compiles production config writes into namespace, credential, and endpoint obligations", () => {
  const result = compileConfigForbiddenEffectObligations({
    requestId: "req-config-prod-timeout",
    operation: "update",
    sourceSystem: "payments-config",
    service: "payment-service",
    key: "payment.timeout",
    namespace: "production",
    environment: ForbiddenEffectEnvironment.Production,
    rollbackCapability: "automatic",
    requestHash: "sha256:config-prod-timeout-request",
    createdAt: "2026-05-01T07:10:00.000Z",
  });

  assert.equal(result.operation, ConfigForbiddenEffectOperation.Update);
  assert.equal(result.namespace, "production");
  assert.equal(
    result.namespaceClassification,
    ConfigNamespaceClassification.Production,
  );
  assert.equal(result.rollbackCapability, ConfigRollbackCapability.Automatic);
  assert.equal(result.failClosed, false);
  assert.deepEqual(result.resourceScope, [
    "payments-config",
    "payment-service.payment.timeout",
    "production",
  ]);
  assert.equal(result.obligations.length, 3);
  assertValidObligations(result.obligations);

  const namespaceWrite = findObligationByKind(
    result.obligations,
    ConfigForbiddenEffectObligationKind.ProductionNamespaceWrite,
  );
  assert.equal(namespaceWrite.effectType, ForbiddenEffectType.Config);
  assert.equal(namespaceWrite.executorType, ForbiddenEffectType.Config);
  assert.equal(
    namespaceWrite.failClosedAction,
    ForbiddenEffectFailClosedAction.DenyPermit,
  );
  assert.deepEqual(namespaceWrite.requiredEvidenceTypes, [
    ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
  ]);
  assert.deepEqual(namespaceWrite.forbiddenCapabilities, [
    "production_namespace_write",
    "config_write",
  ]);
  assert.deepEqual(namespaceWrite.forbiddenEffects, [
    "production_config_write",
    "namespace_mutation",
  ]);
  assert.equal(namespaceWrite.requestHash, "sha256:config-prod-timeout-request");
  assert.equal(namespaceWrite.createdAt, "2026-05-01T07:10:00.000Z");

  const credentialUse = findObligationByKind(
    result.obligations,
    ConfigForbiddenEffectObligationKind.ProductionCredentialUse,
  );
  assert.deepEqual(credentialUse.requiredEvidenceTypes, [
    ForbiddenEffectEvidenceType.ProductionCredentialUseDenial,
  ]);
  assert.deepEqual(credentialUse.forbiddenCapabilities, [
    "production_credential_use",
    "config_admin_credential",
  ]);

  const writeEndpoint = findObligationByKind(
    result.obligations,
    ConfigForbiddenEffectObligationKind.ProductionWriteEndpointAccess,
  );
  assert.deepEqual(writeEndpoint.requiredEvidenceTypes, [
    ForbiddenEffectEvidenceType.ProductionWriteEndpointAccessDenial,
  ]);
  assert.deepEqual(writeEndpoint.forbiddenEffects, [
    "production_endpoint_call",
    "config_state_change",
  ]);

  for (const obligation of result.obligations) {
    assert.equal(obligation.requiredExecutionMode, "production_config_guarded");
    assert.deepEqual(obligation.resourceScope, result.resourceScope);
    assert.equal(obligation.environment, ForbiddenEffectEnvironment.Production);
  }
});

test("compiles sandbox and canary config writes into isolation obligations", () => {
  const cases = [
    {
      namespace: "payment-service-sandbox",
      expectedClassification: ConfigNamespaceClassification.Sandbox,
      expectedKind: ConfigForbiddenEffectObligationKind.SandboxIsolation,
      expectedExecutionMode: "sandbox_config_write",
    },
    {
      namespace: "payment-service-canary",
      expectedClassification: ConfigNamespaceClassification.Canary,
      expectedKind: ConfigForbiddenEffectObligationKind.CanaryIsolation,
      expectedExecutionMode: "canary_config_write",
    },
  ];

  for (const item of cases) {
    const result = compileConfigForbiddenEffectObligations({
      requestId: `req-config-${item.namespace}`,
      operation: "write",
      service: "payment-service",
      key: "payment.timeout",
      targetNamespace: item.namespace,
      environment: ForbiddenEffectEnvironment.Production,
      rollbackCapability: "manual",
    });

    assert.equal(result.operation, ConfigForbiddenEffectOperation.Update);
    assert.equal(result.namespace, item.namespace);
    assert.equal(result.namespaceClassification, item.expectedClassification);
    assert.equal(result.rollbackCapability, ConfigRollbackCapability.Manual);
    assert.equal(result.failClosed, false);
    assert.equal(result.obligations.length, 1);
    assertValidObligations(result.obligations);

    const obligation = findObligationByKind(
      result.obligations,
      item.expectedKind,
    );
    assert.equal(obligation.requiredExecutionMode, item.expectedExecutionMode);
    assert.deepEqual(obligation.requiredEvidenceTypes, [
      ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
      ForbiddenEffectEvidenceType.ProductionCredentialUseDenial,
      ForbiddenEffectEvidenceType.ProductionWriteEndpointAccessDenial,
      ForbiddenEffectEvidenceType.NoExternalSideEffect,
    ]);
    assert.deepEqual(obligation.forbiddenCapabilities, [
      "production_namespace_write",
      "production_credential_use",
      "production_write_endpoint_access",
      "cross_namespace_config_write",
    ]);
    assert.deepEqual(obligation.forbiddenEffects, [
      "production_config_write",
      "production_secret_access",
      "production_endpoint_call",
      "cross_namespace_config_mutation",
    ]);
  }
});

test("compiles unknown namespace and rollback uncertainty into fail-closed obligations", () => {
  const unresolvedNamespace = compileConfigForbiddenEffectObligations({
    requestId: "req-config-unresolved-namespace",
    operation: "update",
    service: "payment-service",
    key: "payment.timeout",
    environment: ForbiddenEffectEnvironment.Production,
    rollbackCapability: "automatic",
  });

  assert.equal(unresolvedNamespace.failClosed, true);
  assert.equal(
    unresolvedNamespace.namespaceClassification,
    ConfigNamespaceClassification.Unknown,
  );
  assert.equal(unresolvedNamespace.namespace, "unresolved_config_namespace");
  assert.equal(unresolvedNamespace.obligations.length, 1);
  assertValidObligations(unresolvedNamespace.obligations);

  const unresolvedObligation = findObligationByKind(
    unresolvedNamespace.obligations,
    ConfigForbiddenEffectObligationKind.UnresolvedNamespace,
  );
  assert.equal(unresolvedObligation.requiredExecutionMode, "fail_closed");
  assert.deepEqual(unresolvedObligation.requiredEvidenceTypes, [
    ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
    ForbiddenEffectEvidenceType.ProductionCredentialUseDenial,
    ForbiddenEffectEvidenceType.ProductionWriteEndpointAccessDenial,
    ForbiddenEffectEvidenceType.NoExternalSideEffect,
  ]);
  assert.deepEqual(unresolvedObligation.forbiddenCapabilities, [
    "unknown_config_namespace",
    "production_namespace_write",
    "production_credential_use",
    "production_write_endpoint_access",
  ]);

  const unverifiedRollback = compileConfigForbiddenEffectObligations({
    requestId: "req-config-unverified-rollback",
    operation: "update",
    service: "payment-service",
    key: "payment.timeout",
    namespace: "production",
    environment: ForbiddenEffectEnvironment.Production,
    rollbackCapability: "unknown",
  });

  assert.equal(unverifiedRollback.failClosed, true);
  assert.equal(
    unverifiedRollback.rollbackCapability,
    ConfigRollbackCapability.Unknown,
  );
  assert.equal(unverifiedRollback.obligations.length, 4);
  assertValidObligations(unverifiedRollback.obligations);

  const rollbackObligation = findObligationByKind(
    unverifiedRollback.obligations,
    ConfigForbiddenEffectObligationKind.UnverifiedRollback,
  );
  assert.equal(rollbackObligation.requiredExecutionMode, "fail_closed");
  assert.deepEqual(rollbackObligation.requiredEvidenceTypes, [
    ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
    ForbiddenEffectEvidenceType.ProductionCredentialUseDenial,
    ForbiddenEffectEvidenceType.ProductionWriteEndpointAccessDenial,
  ]);
  assert.deepEqual(rollbackObligation.forbiddenCapabilities, [
    "config_write_with_unverified_rollback",
    "production_namespace_write",
    "production_credential_use",
    "production_write_endpoint_access",
  ]);
});
