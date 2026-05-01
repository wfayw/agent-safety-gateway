import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  EvidenceCoverageStatus,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  SideEffectEvidenceType,
  compileConfigForbiddenEffectObligations,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import {
  createConfigSideEffectProbePlan,
  createConfigSideEffectSnapshot,
  createConfigSideEffectSnapshotStateFromStoreFixture,
  runConfigSideEffectSnapshotFixture,
  type ConfigNamespaceVersionState,
  type ConfigSideEffectSnapshotFixtureState,
  type ConfigStoreSideEffectSnapshotFixture,
} from "../src/config-side-effect-snapshot-fixture-runner.js";

const completedAt = "2026-05-01T07:45:00.000Z";
const executorFingerprint = "sha256:config-sandbox-fixture-executor-v1";

type LocalConfigStoreEntry = {
  key: string;
  value: string;
  rollbackCapability?: string;
};

type LocalConfigStoreFixture = {
  service: string;
  environment: string;
  namespace: string;
  owner?: string;
  lastUpdatedAt?: string;
  entries: readonly LocalConfigStoreEntry[];
  unsafeChangeExample: {
    key: string;
    previousValue: string;
    requestedValue: string;
  };
};

const loadConfigStoreFixture = async (): Promise<LocalConfigStoreFixture> =>
  JSON.parse(
    await readFile(
      new URL(
        "../../../sample-workspace/config-store/payment-service.production.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as LocalConfigStoreFixture;

const toConfigStoreSideEffectFixture = (
  configStoreFixture: LocalConfigStoreFixture,
): ConfigStoreSideEffectSnapshotFixture => ({
  service: configStoreFixture.service,
  environment: configStoreFixture.environment,
  namespace: configStoreFixture.namespace,
  entries: configStoreFixture.entries,
  ...(configStoreFixture.owner === undefined
    ? {}
    : { owner: configStoreFixture.owner }),
  ...(configStoreFixture.lastUpdatedAt === undefined
    ? {}
    : { lastUpdatedAt: configStoreFixture.lastUpdatedAt }),
});

const createSandboxConfigObligations = async () => {
  const configStoreFixture = await loadConfigStoreFixture();
  const changeExample = configStoreFixture.unsafeChangeExample;
  const configEntry = configStoreFixture.entries.find(
    (entry) => entry.key === changeExample.key,
  );

  return compileConfigForbiddenEffectObligations({
    requestId: "req-config-side-effect-fixture-runner",
    operation: "update",
    sourceSystem: "sample-config-store",
    service: configStoreFixture.service,
    key: changeExample.key,
    targetNamespace: `${configStoreFixture.service}-sandbox`,
    environment: ForbiddenEffectEnvironment.Production,
    requiredExecutionMode: "sandbox_config_write",
    ...(configEntry?.rollbackCapability === undefined
      ? {}
      : { rollbackCapability: configEntry.rollbackCapability }),
  }).obligations;
};

const updateConfigEntry = (
  state: ConfigNamespaceVersionState,
  key: string,
  value: string,
): ConfigNamespaceVersionState => ({
  ...state,
  entries: state.entries.map((entry) =>
    entry.key === key ? { ...entry, value } : entry,
  ),
});

describe("config side-effect snapshot fixture runner", () => {
  it("hashes production and sandbox config versions deterministically", () => {
    const firstSnapshot = createConfigSideEffectSnapshot({
      productionConfigVersion: {
        service: "payment-service",
        environment: "production",
        namespace: "production",
        entries: [{ key: "payment.timeout", value: "2s" }],
      },
      sandboxConfigVersion: {
        service: "payment-service",
        environment: "development",
        namespace: "payment-service-sandbox",
        entries: [{ key: "payment.timeout", value: "100ms" }],
      },
    });
    const reorderedFieldsSnapshot = createConfigSideEffectSnapshot({
      productionConfigVersion: {
        entries: [{ value: "2s", key: "payment.timeout" }],
        namespace: "production",
        environment: "production",
        service: "payment-service",
      },
      sandboxConfigVersion: {
        namespace: "payment-service-sandbox",
        entries: [{ value: "100ms", key: "payment.timeout" }],
        service: "payment-service",
        environment: "development",
      },
    });

    assert.equal(
      firstSnapshot.productionConfigVersionHash,
      reorderedFieldsSnapshot.productionConfigVersionHash,
    );
    assert.equal(
      firstSnapshot.sandboxConfigVersionHash,
      reorderedFieldsSnapshot.sandboxConfigVersionHash,
    );
    assert.equal(firstSnapshot.snapshotHash, reorderedFieldsSnapshot.snapshotHash);
    assert.ok(firstSnapshot.productionConfigVersionHash.startsWith("sha256:"));
    assert.ok(firstSnapshot.sandboxConfigVersionHash.startsWith("sha256:"));
  });

  it("emits covered evidence when only sandbox config changes", async () => {
    const configStoreFixture = await loadConfigStoreFixture();
    const obligations = await createSandboxConfigObligations();
    const changeExample = configStoreFixture.unsafeChangeExample;
    const plan = createConfigSideEffectProbePlan({
      probePlanId: "sprobe-config-sandbox-payment-timeout-v1",
      executorId: "config-sandbox-fixture-executor",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      service: configStoreFixture.service,
      configKey: changeExample.key,
      productionNamespace: configStoreFixture.namespace,
      sandboxNamespace: `${configStoreFixture.service}-sandbox`,
    });
    const beforeSnapshot = createConfigSideEffectSnapshotStateFromStoreFixture(
      toConfigStoreSideEffectFixture(configStoreFixture),
    );
    const afterSnapshot: ConfigSideEffectSnapshotFixtureState = {
      productionConfigVersion: beforeSnapshot.productionConfigVersion,
      sandboxConfigVersion: updateConfigEntry(
        {
          ...beforeSnapshot.sandboxConfigVersion,
          entries: configStoreFixture.entries,
        },
        changeExample.key,
        changeExample.requestedValue,
      ),
    };

    const result = await runConfigSideEffectSnapshotFixture({
      plan,
      obligations,
      beforeSnapshot,
      afterSnapshot,
      executorFingerprint,
      completedAt,
    });

    assert.equal(result.configStoreConnected, false);
    assert.equal(result.dryRunMode, "fixture");
    assert.equal(result.executorId, "config-sandbox-fixture-executor");
    assert.notEqual(
      result.beforeSnapshot.snapshotHash,
      result.afterSnapshot.snapshotHash,
    );
    assert.equal(
      result.beforeSnapshot.productionConfigVersionHash,
      result.afterSnapshot.productionConfigVersionHash,
    );
    assert.notEqual(
      result.beforeSnapshot.sandboxConfigVersionHash,
      result.afterSnapshot.sandboxConfigVersionHash,
    );
    assert.deepEqual(plan.snapshotTargets, [
      `config-store/production/${configStoreFixture.service}/${changeExample.key}:production_config_version`,
      `config-store/${configStoreFixture.service}-sandbox/${configStoreFixture.service}/${changeExample.key}:sandbox_config_version`,
    ]);
    assert.equal(result.sideEffectDeltaEvidence.length, 2);
    assert.equal(result.failedEvidence.length, 0);
    assert.equal(result.forbiddenEffectsObserved.length, 0);
    assert.deepEqual(
      result.coverageRecords.map((record) => record.requiredEvidenceType).sort(),
      [
        ForbiddenEffectEvidenceType.NoExternalSideEffect,
        ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
      ].sort(),
    );

    const externalRecord = result.coverageRecords.find(
      (record) =>
        record.requiredEvidenceType ===
        ForbiddenEffectEvidenceType.NoExternalSideEffect,
    );
    const productionRecord = result.coverageRecords.find(
      (record) =>
        record.requiredEvidenceType ===
        ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
    );

    assert.equal(externalRecord?.status, EvidenceCoverageStatus.Covered);
    assert.equal(productionRecord?.status, EvidenceCoverageStatus.Covered);
    assert.deepEqual(externalRecord?.evidence?.observedEvents, [
      {
        evidenceType: SideEffectEvidenceType.ConfigVersion,
        target: `config-store/${configStoreFixture.service}-sandbox/${configStoreFixture.service}/${changeExample.key}:sandbox_config_version`,
        eventHash: externalRecord.evidence.observedEvents[0]?.eventHash,
        observedAt: completedAt,
      },
    ]);
    assert.equal(externalRecord?.evidence?.forbiddenEffectsObserved.length, 0);
    assert.equal(externalRecord?.evidence?.effectDelta.length, 1);
    assert.equal(
      externalRecord?.evidence?.effectDelta[0]?.changeType,
      "sandbox_config_version_delta_detected",
    );
    assert.equal(productionRecord?.evidence?.effectDelta.length, 0);
  });

  it("fails closed and records forbidden production config deltas", async () => {
    const configStoreFixture = await loadConfigStoreFixture();
    const obligations = await createSandboxConfigObligations();
    const changeExample = configStoreFixture.unsafeChangeExample;
    const plan = createConfigSideEffectProbePlan({
      probePlanId: "sprobe-config-sandbox-payment-timeout-v1",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      service: configStoreFixture.service,
      configKey: changeExample.key,
      productionNamespace: configStoreFixture.namespace,
    });
    const beforeSnapshot = createConfigSideEffectSnapshotStateFromStoreFixture(
      toConfigStoreSideEffectFixture(configStoreFixture),
    );
    const afterSnapshot: ConfigSideEffectSnapshotFixtureState = {
      productionConfigVersion: updateConfigEntry(
        beforeSnapshot.productionConfigVersion,
        changeExample.key,
        changeExample.requestedValue,
      ),
      sandboxConfigVersion: beforeSnapshot.sandboxConfigVersion,
    };

    const result = await runConfigSideEffectSnapshotFixture({
      plan,
      obligations,
      executorId: "config-sandbox-fixture-executor",
      beforeSnapshot,
      afterSnapshot,
      executorFingerprint,
      completedAt,
    });

    assert.notEqual(
      result.beforeSnapshot.productionConfigVersionHash,
      result.afterSnapshot.productionConfigVersionHash,
    );
    assert.equal(
      result.beforeSnapshot.sandboxConfigVersionHash,
      result.afterSnapshot.sandboxConfigVersionHash,
    );
    assert.equal(result.coverageRecords.length, 2);
    assert.equal(result.failedEvidence.length, 2);
    assert.equal(result.forbiddenEffectsObserved.length, 1);
    assert.equal(
      result.forbiddenEffectsObserved[0]?.evidenceType,
      SideEffectEvidenceType.ConfigVersion,
    );
    assert.match(
      result.forbiddenEffectsObserved[0]?.target ?? "",
      /production_config_version$/,
    );

    for (const coverageRecord of result.coverageRecords) {
      assert.equal(coverageRecord.status, EvidenceCoverageStatus.Failed);
      assert.match(coverageRecord.failureReason ?? "", /production_config_write/);
      assert.equal(coverageRecord.evidence?.forbiddenEffectsObserved.length, 1);
      assert.equal(coverageRecord.evidence?.effectDelta.length, 1);
      assert.equal(
        coverageRecord.evidence?.effectDelta[0]?.changeType,
        "production_config_version_delta_detected",
      );
    }
  });
});
