import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  DeniedCapabilityProbeOutcome,
  EvidenceCoverageStatus,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  compileConfigForbiddenEffectObligations,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import {
  createConfigSandboxNegativeProbePlan,
  runConfigNegativeCapabilityFixture,
  type ConfigStoreNegativeCapabilityFixture,
} from "../src/config-negative-capability-fixture-runner.js";

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

const toNegativeCapabilityFixture = (
  configStoreFixture: LocalConfigStoreFixture,
  overrides: Partial<ConfigStoreNegativeCapabilityFixture> = {},
): ConfigStoreNegativeCapabilityFixture => ({
  service: configStoreFixture.service,
  environment: configStoreFixture.environment,
  namespace: configStoreFixture.namespace,
  entries: configStoreFixture.entries,
  ...overrides,
});

const createProductionConfigObligations = async () => {
  const configStoreFixture = await loadConfigStoreFixture();
  const changeExample = configStoreFixture.unsafeChangeExample;
  const configEntry = configStoreFixture.entries.find(
    (entry) => entry.key === changeExample.key,
  );

  return compileConfigForbiddenEffectObligations({
    requestId: "req-config-negative-fixture-runner",
    operation: "update",
    sourceSystem: "sample-config-store",
    service: configStoreFixture.service,
    key: changeExample.key,
    namespace: configStoreFixture.namespace,
    environment: ForbiddenEffectEnvironment.Production,
    ...(configEntry?.rollbackCapability === undefined
      ? {}
      : { rollbackCapability: configEntry.rollbackCapability }),
  }).obligations;
};

describe("config negative capability fixture runner", () => {
  it("creates production namespace, credential, and endpoint probes", async () => {
    const configStoreFixture = await loadConfigStoreFixture();
    const obligations = await createProductionConfigObligations();
    const configKey = configStoreFixture.unsafeChangeExample.key;
    const plan = createConfigSandboxNegativeProbePlan({
      probePlanId: "nprobe-config-sandbox-payment-timeout-v1",
      executorId: "config-sandbox-fixture-executor",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      service: configStoreFixture.service,
      configKey,
      productionNamespace: configStoreFixture.namespace,
    });

    assert.equal(plan.executorType, "config");
    assert.equal(plan.targetEnvironment, "production");
    assert.deepEqual(plan.dangerousCapabilitiesToDeny, [
      "production_namespace_write",
      "production_credential_use",
      "production_write_endpoint_access",
    ]);
    assert.deepEqual(
      plan.probeTasks.map((task) => task.probeType),
      [
        ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
        ForbiddenEffectEvidenceType.ProductionCredentialUseDenial,
        ForbiddenEffectEvidenceType.ProductionWriteEndpointAccessDenial,
      ],
    );
    assert.deepEqual(
      plan.probeTasks.map((task) => task.operation),
      [
        `WRITE ${configStoreFixture.service}.${configKey} TO namespace/production/${configStoreFixture.service}/${configKey}`,
        `USE credential/production/${configStoreFixture.service}/config-write`,
        `POST /config-store/production/${configStoreFixture.service}/${configKey}`,
      ],
    );
  });

  it("emits covered DeniedCapabilityEvidence for rejected config probes", async () => {
    const configStoreFixture = await loadConfigStoreFixture();
    const obligations = await createProductionConfigObligations();
    const plan = createConfigSandboxNegativeProbePlan({
      probePlanId: "nprobe-config-sandbox-payment-timeout-v1",
      executorId: "config-sandbox-fixture-executor",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      service: configStoreFixture.service,
      configKey: configStoreFixture.unsafeChangeExample.key,
      productionNamespace: configStoreFixture.namespace,
    });

    const result = await runConfigNegativeCapabilityFixture({
      plan,
      obligations,
      configStoreFixture: toNegativeCapabilityFixture(configStoreFixture),
      executorFingerprint,
      completedAt,
    });

    assert.equal(result.configStoreConnected, false);
    assert.equal(result.dryRunMode, "fixture");
    assert.equal(result.executorId, "config-sandbox-fixture-executor");
    assert.equal(result.service, configStoreFixture.service);
    assert.equal(result.namespace, configStoreFixture.namespace);
    assert.equal(result.failedEvidence.length, 0);
    assert.equal(result.deniedCapabilityEvidence.length, 3);
    assert.equal(result.coverageRecords.length, 3);

    for (const evidence of result.deniedCapabilityEvidence) {
      assert.equal(evidence.probeId, plan.probePlanId);
      assert.equal(evidence.observedRejection, DeniedCapabilityProbeOutcome.Rejected);
      assert.equal(evidence.executorFingerprint, executorFingerprint);
      assert.equal(evidence.completedAt, completedAt);
      assert.equal(
        obligations.some(
          (obligation) => obligation.obligationId === evidence.obligationId,
        ),
        true,
      );
    }

    for (const coverageRecord of result.coverageRecords) {
      assert.equal(coverageRecord.status, EvidenceCoverageStatus.Covered);
      assert.equal(coverageRecord.completedAt, completedAt);
      assert.ok(coverageRecord.evidenceHash.startsWith("sha256:"));
      assert.equal(coverageRecord.evidence?.observedRejection, "rejected");
    }
  });

  it("fails evidence when any production config access occurs", async () => {
    const configStoreFixture = await loadConfigStoreFixture();
    const obligations = await createProductionConfigObligations();
    const plan = createConfigSandboxNegativeProbePlan({
      probePlanId: "nprobe-config-sandbox-payment-timeout-v1",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      service: configStoreFixture.service,
      configKey: configStoreFixture.unsafeChangeExample.key,
      productionNamespace: configStoreFixture.namespace,
    });
    const cases = [
      {
        overrides: { productionNamespaceWriteAttempted: true },
        evidenceType: ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
        reason: /production namespace write/,
      },
      {
        overrides: { productionCredentialUsed: true },
        evidenceType: ForbiddenEffectEvidenceType.ProductionCredentialUseDenial,
        reason: /production credential use/,
      },
      {
        overrides: { productionWriteEndpointAccessed: true },
        evidenceType:
          ForbiddenEffectEvidenceType.ProductionWriteEndpointAccessDenial,
        reason: /production write endpoint access/,
      },
    ] satisfies readonly {
      overrides: Partial<ConfigStoreNegativeCapabilityFixture>;
      evidenceType: ForbiddenEffectEvidenceType;
      reason: RegExp;
    }[];

    for (const item of cases) {
      const result = await runConfigNegativeCapabilityFixture({
        plan,
        obligations,
        configStoreFixture: toNegativeCapabilityFixture(
          configStoreFixture,
          item.overrides,
        ),
        executorFingerprint,
        completedAt,
      });

      assert.equal(result.failedEvidence.length, 1);
      assert.equal(
        result.failedEvidence[0]?.observedRejection,
        DeniedCapabilityProbeOutcome.UnexpectedlyAllowed,
      );

      const failedRecord = result.coverageRecords.find(
        (record) => record.requiredEvidenceType === item.evidenceType,
      );
      const coveredRecords = result.coverageRecords.filter(
        (record) => record.requiredEvidenceType !== item.evidenceType,
      );

      assert.equal(failedRecord?.status, EvidenceCoverageStatus.Failed);
      assert.match(failedRecord?.failureReason ?? "", item.reason);
      assert.equal(coveredRecords.length, 2);
      assert.equal(
        coveredRecords.every(
          (record) => record.status === EvidenceCoverageStatus.Covered,
        ),
        true,
      );
    }
  });
});
