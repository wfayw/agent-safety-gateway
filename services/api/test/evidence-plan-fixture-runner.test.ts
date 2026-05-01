import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  DeniedCapabilityProbeOutcome,
  EvidenceCoverageStatus,
  EvidencePlanTimeoutAction,
  ForbiddenEffectEnvironment,
  ForbiddenEffectType,
  compileCiCdForbiddenEffectObligations,
  compileConfigForbiddenEffectObligations,
  compileSqlForbiddenEffectObligations,
  type EvidencePlan,
  type ForbiddenEffectObligation,
  type NegativeProbePlan,
  type SideEffectProbePlan,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import {
  createCiCdDryRunNegativeProbePlan,
  type CiCdPipelineNegativeCapabilityFixture,
} from "../src/cicd-negative-capability-fixture-runner.js";
import {
  createCiCdSideEffectProbePlan,
  createCiCdSideEffectSnapshotStateFromPipelineFixture,
  type CiCdPipelineSideEffectSnapshotFixture,
} from "../src/cicd-side-effect-snapshot-fixture-runner.js";
import {
  createConfigSandboxNegativeProbePlan,
  type ConfigStoreNegativeCapabilityFixture,
} from "../src/config-negative-capability-fixture-runner.js";
import {
  createConfigSideEffectProbePlan,
  createConfigSideEffectSnapshotStateFromStoreFixture,
  type ConfigNamespaceVersionState,
  type ConfigSideEffectSnapshotFixtureState,
  type ConfigStoreSideEffectSnapshotFixture,
} from "../src/config-side-effect-snapshot-fixture-runner.js";
import {
  EvidencePlanFixtureRunnerStatus,
  EvidencePlanProbeKind,
  runEvidencePlanFixture,
} from "../src/evidence-plan-fixture-runner.js";
import { createSqlReadonlyNegativeProbePlan } from "../src/sql-negative-capability-fixture-runner.js";
import { createSqlSideEffectProbePlan } from "../src/sql-side-effect-snapshot-fixture-runner.js";

const completedAt = "2026-05-01T08:20:00.000Z";
const executorFingerprint = "sha256:unified-evidence-fixture-executor-v1";

type LocalPipelineFixture = {
  pipelineId: string;
  service: string;
  environment: string;
  candidateVersion?: string;
  currentVersion?: string;
};

type LocalConfigStoreFixture = {
  service: string;
  environment: string;
  namespace: string;
  owner?: string;
  lastUpdatedAt?: string;
  entries: readonly Record<string, unknown>[];
  unsafeChangeExample: {
    key: string;
    requestedValue: string;
  };
};

const loadPipelineFixture = async (): Promise<LocalPipelineFixture> =>
  JSON.parse(
    await readFile(
      new URL(
        "../../../sample-workspace/pipelines/payment-service-release.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as LocalPipelineFixture;

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

const createEvidencePlan = ({
  planId,
  executorType,
  obligations,
  negativeProbePlan,
  sideEffectProbePlan,
}: {
  planId: string;
  executorType: ForbiddenEffectType;
  obligations: readonly ForbiddenEffectObligation[];
  negativeProbePlan: NegativeProbePlan;
  sideEffectProbePlan: SideEffectProbePlan;
}): EvidencePlan => ({
  planId,
  obligationIds: obligations.map((obligation) => obligation.obligationId),
  executorType,
  targetEnvironment: ForbiddenEffectEnvironment.Production,
  requiredFixtures: [
    ...negativeProbePlan.requiredFixtures,
    ...sideEffectProbePlan.requiredFixtures,
  ],
  timeoutStrategy: {
    timeoutMs: 5_000,
    onTimeout: EvidencePlanTimeoutAction.DenyPermit,
  },
  negativeProbePlans: [negativeProbePlan],
  sideEffectProbePlans: [sideEffectProbePlan],
  createdAt: completedAt,
});

const toPipelineNegativeCapabilityFixture = (
  fixture: LocalPipelineFixture,
): CiCdPipelineNegativeCapabilityFixture => ({
  pipelineId: fixture.pipelineId,
  service: fixture.service,
  environment: fixture.environment,
  ...(fixture.candidateVersion === undefined
    ? {}
    : { candidateVersion: fixture.candidateVersion }),
});

const toPipelineSideEffectFixture = (
  fixture: LocalPipelineFixture,
): CiCdPipelineSideEffectSnapshotFixture => ({
  pipelineId: fixture.pipelineId,
  service: fixture.service,
  environment: fixture.environment,
  ...(fixture.candidateVersion === undefined
    ? {}
    : { candidateVersion: fixture.candidateVersion }),
  ...(fixture.currentVersion === undefined
    ? {}
    : { currentVersion: fixture.currentVersion }),
});

const toConfigNegativeCapabilityFixture = (
  fixture: LocalConfigStoreFixture,
): ConfigStoreNegativeCapabilityFixture => ({
  service: fixture.service,
  environment: fixture.environment,
  namespace: fixture.namespace,
  entries: fixture.entries.map((entry) => ({
    key: String(entry.key),
    value: String(entry.value),
    ...(typeof entry.rollbackCapability === "string"
      ? { rollbackCapability: entry.rollbackCapability }
      : {}),
  })),
});

const toConfigSideEffectFixture = (
  fixture: LocalConfigStoreFixture,
): ConfigStoreSideEffectSnapshotFixture => ({
  service: fixture.service,
  environment: fixture.environment,
  namespace: fixture.namespace,
  entries: fixture.entries,
  ...(fixture.owner === undefined ? {} : { owner: fixture.owner }),
  ...(fixture.lastUpdatedAt === undefined
    ? {}
    : { lastUpdatedAt: fixture.lastUpdatedAt }),
});

const updateConfigEntry = (
  versionState: ConfigNamespaceVersionState,
  key: string,
  value: string,
): ConfigNamespaceVersionState => ({
  ...versionState,
  entries: versionState.entries.map((entry) =>
    entry.key === key ? { ...entry, value } : entry,
  ),
  version: "fixture-sandbox-after",
});

describe("unified evidence plan fixture runner", () => {
  it("dispatches SQL, CI/CD, and config negative and side-effect probes", async () => {
    const sqlObligations = compileSqlForbiddenEffectObligations({
      requestId: "req-unified-sql-readonly",
      sql: "SELECT id, status FROM orders WHERE status = 'PENDING'",
      environment: ForbiddenEffectEnvironment.Production,
      resourceScope: ["orders"],
    }).obligations;
    const sqlNegativeProbePlan = createSqlReadonlyNegativeProbePlan({
      probePlanId: "nprobe-unified-sql-readonly",
      executorId: "sql-readonly-fixture-executor",
      obligationIds: sqlObligations.map((obligation) => obligation.obligationId),
      probeTarget: "orders",
    });
    const sqlSideEffectProbePlan = createSqlSideEffectProbePlan({
      probePlanId: "sprobe-unified-sql-readonly",
      executorId: "sql-readonly-fixture-executor",
      obligationIds: sqlObligations.map((obligation) => obligation.obligationId),
      snapshotTarget: "orders",
    });
    const sqlSnapshot = {
      rows: [{ id: "ord-1", status: "PENDING" }],
      triggerLogs: [],
      asyncJobLogs: [],
    };

    const pipelineFixture = await loadPipelineFixture();
    const cicdObligations = compileCiCdForbiddenEffectObligations({
      requestId: "req-unified-cicd-dry-run",
      operation: "release",
      service: pipelineFixture.service,
      pipeline: pipelineFixture.pipelineId,
      version: pipelineFixture.candidateVersion,
      environment: ForbiddenEffectEnvironment.Production,
      requiredExecutionMode: "dry_run",
      testStatus: "passed",
    }).obligations;
    const cicdNegativeProbePlan = createCiCdDryRunNegativeProbePlan({
      probePlanId: "nprobe-unified-cicd-dry-run",
      executorId: "cicd-dry-run-fixture-executor",
      obligationIds: cicdObligations.map((obligation) => obligation.obligationId),
      service: pipelineFixture.service,
      pipelineId: pipelineFixture.pipelineId,
      candidateVersion: pipelineFixture.candidateVersion,
    });
    const cicdSideEffectProbePlan = createCiCdSideEffectProbePlan({
      probePlanId: "sprobe-unified-cicd-dry-run",
      executorId: "cicd-dry-run-fixture-executor",
      obligationIds: cicdObligations.map((obligation) => obligation.obligationId),
      service: pipelineFixture.service,
      pipelineId: pipelineFixture.pipelineId,
      candidateVersion: pipelineFixture.candidateVersion,
    });
    const cicdSnapshot = createCiCdSideEffectSnapshotStateFromPipelineFixture(
      toPipelineSideEffectFixture(pipelineFixture),
    );

    const configStoreFixture = await loadConfigStoreFixture();
    const configObligations = compileConfigForbiddenEffectObligations({
      requestId: "req-unified-config-sandbox",
      operation: "update",
      service: configStoreFixture.service,
      key: configStoreFixture.unsafeChangeExample.key,
      targetNamespace: `${configStoreFixture.service}-sandbox`,
      environment: ForbiddenEffectEnvironment.Production,
      rollbackCapability: "automatic",
    }).obligations;
    const configNegativeProbePlan = createConfigSandboxNegativeProbePlan({
      probePlanId: "nprobe-unified-config-sandbox",
      executorId: "config-sandbox-fixture-executor",
      obligationIds: configObligations.map((obligation) => obligation.obligationId),
      service: configStoreFixture.service,
      configKey: configStoreFixture.unsafeChangeExample.key,
    });
    const configSideEffectProbePlan = createConfigSideEffectProbePlan({
      probePlanId: "sprobe-unified-config-sandbox",
      executorId: "config-sandbox-fixture-executor",
      obligationIds: configObligations.map((obligation) => obligation.obligationId),
      service: configStoreFixture.service,
      configKey: configStoreFixture.unsafeChangeExample.key,
      productionNamespace: configStoreFixture.namespace,
      sandboxNamespace: `${configStoreFixture.service}-sandbox`,
    });
    const configBeforeSnapshot = createConfigSideEffectSnapshotStateFromStoreFixture(
      toConfigSideEffectFixture(configStoreFixture),
    );
    const configAfterSnapshot: ConfigSideEffectSnapshotFixtureState = {
      productionConfigVersion: configBeforeSnapshot.productionConfigVersion,
      sandboxConfigVersion: updateConfigEntry(
        {
          ...configBeforeSnapshot.sandboxConfigVersion,
          entries: configStoreFixture.entries,
        },
        configStoreFixture.unsafeChangeExample.key,
        configStoreFixture.unsafeChangeExample.requestedValue,
      ),
    };

    const cases = [
      {
        plan: createEvidencePlan({
          planId: "eplan-unified-sql-readonly",
          executorType: ForbiddenEffectType.Sql,
          obligations: sqlObligations,
          negativeProbePlan: sqlNegativeProbePlan,
          sideEffectProbePlan: sqlSideEffectProbePlan,
        }),
        obligations: sqlObligations,
        sql: {
          beforeSnapshot: sqlSnapshot,
          afterSnapshot: sqlSnapshot,
        },
      },
      {
        plan: createEvidencePlan({
          planId: "eplan-unified-cicd-dry-run",
          executorType: ForbiddenEffectType.CiCd,
          obligations: cicdObligations,
          negativeProbePlan: cicdNegativeProbePlan,
          sideEffectProbePlan: cicdSideEffectProbePlan,
        }),
        obligations: cicdObligations,
        cicd: {
          pipelineFixture: toPipelineNegativeCapabilityFixture(pipelineFixture),
          beforeSnapshot: cicdSnapshot,
          afterSnapshot: cicdSnapshot,
        },
      },
      {
        plan: createEvidencePlan({
          planId: "eplan-unified-config-sandbox",
          executorType: ForbiddenEffectType.Config,
          obligations: configObligations,
          negativeProbePlan: configNegativeProbePlan,
          sideEffectProbePlan: configSideEffectProbePlan,
        }),
        obligations: configObligations,
        config: {
          configStoreFixture: toConfigNegativeCapabilityFixture(configStoreFixture),
          beforeSnapshot: configBeforeSnapshot,
          afterSnapshot: configAfterSnapshot,
        },
      },
    ];

    for (const item of cases) {
      const result = await runEvidencePlanFixture({
        plan: item.plan,
        obligations: item.obligations,
        executorFingerprint,
        completedAt,
        sql: item.sql,
        cicd: item.cicd,
        config: item.config,
      });

      assert.equal(result.status, EvidencePlanFixtureRunnerStatus.Completed);
      assert.equal(result.executorInvoked, false);
      assert.deepEqual(result.skippedReasons, []);
      assert.deepEqual(
        result.probeResults.map((probeResult) => probeResult.probeKind),
        [EvidencePlanProbeKind.Negative, EvidencePlanProbeKind.SideEffect],
      );
      assert.equal(
        result.probeResults.every(
          (probeResult) =>
            probeResult.status === EvidencePlanFixtureRunnerStatus.Completed,
        ),
        true,
      );
      assert.ok(result.deniedCapabilityEvidence.length > 0);
      assert.ok(result.sideEffectDeltaEvidence.length > 0);
      assert.equal(
        result.coverageRecords.every(
          (coverageRecord) =>
            coverageRecord.status === EvidenceCoverageStatus.Covered,
        ),
        true,
      );
    }
  });

  it("reports failure status when a fixture observes forbidden evidence", async () => {
    const obligations = compileSqlForbiddenEffectObligations({
      requestId: "req-unified-sql-failure",
      sql: "SELECT id FROM orders",
      environment: ForbiddenEffectEnvironment.Production,
      resourceScope: ["orders"],
    }).obligations;
    const negativeProbePlan = createSqlReadonlyNegativeProbePlan({
      probePlanId: "nprobe-unified-sql-failure",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      probeTarget: "orders",
    });
    const sideEffectProbePlan = createSqlSideEffectProbePlan({
      probePlanId: "sprobe-unified-sql-failure",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      snapshotTarget: "orders",
    });
    const snapshot = { rows: [], triggerLogs: [], asyncJobLogs: [] };
    const result = await runEvidencePlanFixture({
      plan: createEvidencePlan({
        planId: "eplan-unified-sql-failure",
        executorType: ForbiddenEffectType.Sql,
        obligations,
        negativeProbePlan,
        sideEffectProbePlan,
      }),
      obligations,
      executorFingerprint,
      completedAt,
      sql: {
        beforeSnapshot: snapshot,
        afterSnapshot: snapshot,
        negativeProbeOverrides: [
          {
            attemptedOperation: "DELETE FROM orders WHERE id = 1",
            observedRejection: DeniedCapabilityProbeOutcome.UnexpectedlyAllowed,
            rejectionReason: "fixture detected DELETE was allowed",
          },
        ],
      },
    });

    assert.equal(result.status, EvidencePlanFixtureRunnerStatus.Failed);
    assert.equal(result.executorInvoked, false);
    assert.equal(result.failedEvidence.length, 1);
    assert.equal(
      result.coverageRecords.some(
        (coverageRecord) => coverageRecord.status === EvidenceCoverageStatus.Failed,
      ),
      true,
    );
  });

  it("returns not_configured and no evidence for unsafe fixture configuration", async () => {
    const obligations = compileSqlForbiddenEffectObligations({
      requestId: "req-unified-unsafe-fixture",
      sql: "SELECT id FROM orders",
      environment: ForbiddenEffectEnvironment.Production,
      resourceScope: ["orders"],
    }).obligations;
    const negativeProbePlan = createSqlReadonlyNegativeProbePlan({
      probePlanId: "nprobe-unified-unsafe-fixture",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      probeTarget: "orders",
    });
    const sideEffectProbePlan = createSqlSideEffectProbePlan({
      probePlanId: "sprobe-unified-unsafe-fixture",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      snapshotTarget: "orders",
    });
    const unsafePlan = {
      ...createEvidencePlan({
        planId: "eplan-unified-unsafe-fixture",
        executorType: ForbiddenEffectType.Sql,
        obligations,
        negativeProbePlan,
        sideEffectProbePlan,
      }),
      requiredFixtures: ["postgres://production/orders"],
    } satisfies EvidencePlan;

    const result = await runEvidencePlanFixture({
      plan: unsafePlan,
      obligations,
      executorFingerprint,
      completedAt,
      sql: {
        beforeSnapshot: { rows: [], triggerLogs: [], asyncJobLogs: [] },
        afterSnapshot: { rows: [], triggerLogs: [], asyncJobLogs: [] },
      },
    });

    assert.equal(result.status, EvidencePlanFixtureRunnerStatus.NotConfigured);
    assert.equal(result.executorInvoked, false);
    assert.equal(result.probeResults.length, 1);
    assert.match(result.skippedReasons[0] ?? "", /unsupported root fixture/);
    assert.equal(result.coverageRecords.length, 0);
    assert.equal(result.deniedCapabilityEvidence.length, 0);
    assert.equal(result.sideEffectDeltaEvidence.length, 0);
  });
});
