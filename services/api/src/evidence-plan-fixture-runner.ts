import {
  EvidenceCoverageStatus,
  EvidencePlanSchema,
  ForbiddenEffectType,
  type DeniedCapabilityEvidence,
  type EvidenceCoverageRecord,
  type EvidencePlan,
  type ForbiddenEffectObligation,
  type ForbiddenSideEffectTimestamp,
  type NegativeProbePlan,
  type SideEffectDeltaEvidence,
  type SideEffectProbePlan,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import {
  runCiCdNegativeCapabilityFixture,
  type CiCdNegativeCapabilityFixtureProbeOverride,
  type CiCdNegativeCapabilityFixtureRunResult,
  type CiCdPipelineNegativeCapabilityFixture,
} from "./cicd-negative-capability-fixture-runner.js";
import {
  runCiCdSideEffectSnapshotFixture,
  type CiCdSideEffectSnapshotFixtureRunResult,
  type CiCdSideEffectSnapshotFixtureState,
} from "./cicd-side-effect-snapshot-fixture-runner.js";
import {
  runConfigNegativeCapabilityFixture,
  type ConfigNegativeCapabilityFixtureProbeOverride,
  type ConfigNegativeCapabilityFixtureRunResult,
  type ConfigStoreNegativeCapabilityFixture,
} from "./config-negative-capability-fixture-runner.js";
import {
  runConfigSideEffectSnapshotFixture,
  type ConfigSideEffectSnapshotFixtureRunResult,
  type ConfigSideEffectSnapshotFixtureState,
} from "./config-side-effect-snapshot-fixture-runner.js";
import {
  runSqlNegativeCapabilityFixture,
  type SqlNegativeCapabilityFixtureProbeOverride,
  type SqlNegativeCapabilityFixtureRunResult,
} from "./sql-negative-capability-fixture-runner.js";
import {
  runSqlSideEffectSnapshotFixture,
  type SqlSideEffectSnapshotFixtureRunResult,
  type SqlSideEffectSnapshotFixtureState,
} from "./sql-side-effect-snapshot-fixture-runner.js";

const localFixtureIds = {
  sqlNegative: "local_sql_negative_capability_fixture",
  sqlSideEffect: "local_sql_side_effect_snapshot_fixture",
  cicdNegative: "local_cicd_negative_capability_fixture",
  cicdSideEffect: "local_cicd_side_effect_snapshot_fixture",
  configNegative: "local_config_negative_capability_fixture",
  configSideEffect: "local_config_side_effect_snapshot_fixture",
} as const;

const knownLocalFixtureIds = new Set<string>(Object.values(localFixtureIds));

export const EvidencePlanFixtureRunnerStatus = {
  Completed: "completed",
  Failed: "failed",
  NotConfigured: "not_configured",
} as const;

export type EvidencePlanFixtureRunnerStatus =
  (typeof EvidencePlanFixtureRunnerStatus)[keyof typeof EvidencePlanFixtureRunnerStatus];

export const EvidencePlanProbeKind = {
  Negative: "negative",
  SideEffect: "side_effect",
} as const;

export type EvidencePlanProbeKind =
  (typeof EvidencePlanProbeKind)[keyof typeof EvidencePlanProbeKind];

export type SqlEvidencePlanFixtureContext = {
  beforeSnapshot?: SqlSideEffectSnapshotFixtureState;
  afterSnapshot?: SqlSideEffectSnapshotFixtureState;
  negativeProbeOverrides?: readonly SqlNegativeCapabilityFixtureProbeOverride[];
};

export type CiCdEvidencePlanFixtureContext = {
  pipelineFixture?: CiCdPipelineNegativeCapabilityFixture;
  beforeSnapshot?: CiCdSideEffectSnapshotFixtureState;
  afterSnapshot?: CiCdSideEffectSnapshotFixtureState;
  negativeProbeOverrides?: readonly CiCdNegativeCapabilityFixtureProbeOverride[];
};

export type ConfigEvidencePlanFixtureContext = {
  configStoreFixture?: ConfigStoreNegativeCapabilityFixture;
  beforeSnapshot?: ConfigSideEffectSnapshotFixtureState;
  afterSnapshot?: ConfigSideEffectSnapshotFixtureState;
  negativeProbeOverrides?: readonly ConfigNegativeCapabilityFixtureProbeOverride[];
};

export type EvidencePlanFixtureRunnerInput = {
  plan: EvidencePlan;
  obligations: readonly ForbiddenEffectObligation[];
  executorFingerprint?: string;
  completedAt?: ForbiddenSideEffectTimestamp;
  sql?: SqlEvidencePlanFixtureContext;
  cicd?: CiCdEvidencePlanFixtureContext;
  config?: ConfigEvidencePlanFixtureContext;
};

type FixtureRunResult =
  | SqlNegativeCapabilityFixtureRunResult
  | SqlSideEffectSnapshotFixtureRunResult
  | CiCdNegativeCapabilityFixtureRunResult
  | CiCdSideEffectSnapshotFixtureRunResult
  | ConfigNegativeCapabilityFixtureRunResult
  | ConfigSideEffectSnapshotFixtureRunResult;

export type EvidencePlanProbeDispatchResult = {
  probePlanId: string;
  probeKind: EvidencePlanProbeKind;
  executorType: string;
  status: EvidencePlanFixtureRunnerStatus;
  fixtureId?: string;
  skippedReason?: string;
  coverageRecords: readonly EvidenceCoverageRecord[];
  deniedCapabilityEvidence: readonly DeniedCapabilityEvidence[];
  sideEffectDeltaEvidence: readonly SideEffectDeltaEvidence[];
  failedEvidence: readonly (DeniedCapabilityEvidence | SideEffectDeltaEvidence)[];
  fixtureResult?: FixtureRunResult;
};

export type EvidencePlanFixtureRunnerResult = {
  planId: string;
  status: EvidencePlanFixtureRunnerStatus;
  executorInvoked: false;
  completedAt?: ForbiddenSideEffectTimestamp;
  skippedReasons: readonly string[];
  probeResults: readonly EvidencePlanProbeDispatchResult[];
  coverageRecords: readonly EvidenceCoverageRecord[];
  deniedCapabilityEvidence: readonly DeniedCapabilityEvidence[];
  sideEffectDeltaEvidence: readonly SideEffectDeltaEvidence[];
  failedEvidence: readonly (DeniedCapabilityEvidence | SideEffectDeltaEvidence)[];
};

const createSkippedProbeResult = ({
  plan,
  probeKind,
  reason,
}: {
  plan: NegativeProbePlan | SideEffectProbePlan;
  probeKind: EvidencePlanProbeKind;
  reason: string;
}): EvidencePlanProbeDispatchResult => ({
  probePlanId: plan.probePlanId,
  probeKind,
  executorType: plan.executorType,
  status: EvidencePlanFixtureRunnerStatus.NotConfigured,
  skippedReason: reason,
  coverageRecords: [],
  deniedCapabilityEvidence: [],
  sideEffectDeltaEvidence: [],
  failedEvidence: [],
});

const hasFailedCoverage = (
  coverageRecords: readonly EvidenceCoverageRecord[],
): boolean =>
  coverageRecords.some(
    (coverageRecord) => coverageRecord.status === EvidenceCoverageStatus.Failed,
  );

const inferCompletedProbeStatus = (
  coverageRecords: readonly EvidenceCoverageRecord[],
): EvidencePlanFixtureRunnerStatus =>
  hasFailedCoverage(coverageRecords)
    ? EvidencePlanFixtureRunnerStatus.Failed
    : EvidencePlanFixtureRunnerStatus.Completed;

const assertLocalFixtureOnly = ({
  plan,
  expectedFixtureId,
}: {
  plan: NegativeProbePlan | SideEffectProbePlan;
  expectedFixtureId: string;
}): string | undefined => {
  if (!plan.requiredFixtures.includes(expectedFixtureId)) {
    return `${plan.probePlanId} is missing required local fixture ${expectedFixtureId}`;
  }

  const unsafeFixtureId = plan.requiredFixtures.find(
    (fixtureId) => fixtureId !== expectedFixtureId,
  );

  if (unsafeFixtureId !== undefined) {
    return `${plan.probePlanId} declares unsupported fixture ${unsafeFixtureId}; evidence runner refuses real executor access`;
  }

  return undefined;
};

const validateRootFixtures = (plan: EvidencePlan): string | undefined => {
  const unsafeFixtureId = plan.requiredFixtures.find(
    (fixtureId) => !knownLocalFixtureIds.has(fixtureId),
  );

  if (unsafeFixtureId === undefined) {
    return undefined;
  }

  return `${plan.planId} declares unsupported root fixture ${unsafeFixtureId}; evidence runner is fixture-only`;
};

const buildNegativeProbeResult = ({
  plan,
  fixtureResult,
}: {
  plan: NegativeProbePlan;
  fixtureResult:
    | SqlNegativeCapabilityFixtureRunResult
    | CiCdNegativeCapabilityFixtureRunResult
    | ConfigNegativeCapabilityFixtureRunResult;
}): EvidencePlanProbeDispatchResult => ({
  probePlanId: plan.probePlanId,
  probeKind: EvidencePlanProbeKind.Negative,
  executorType: plan.executorType,
  status: inferCompletedProbeStatus(fixtureResult.coverageRecords),
  fixtureId: fixtureResult.fixtureId,
  coverageRecords: fixtureResult.coverageRecords,
  deniedCapabilityEvidence: fixtureResult.deniedCapabilityEvidence,
  sideEffectDeltaEvidence: [],
  failedEvidence: fixtureResult.failedEvidence,
  fixtureResult,
});

const buildSideEffectProbeResult = ({
  plan,
  fixtureResult,
}: {
  plan: SideEffectProbePlan;
  fixtureResult:
    | SqlSideEffectSnapshotFixtureRunResult
    | CiCdSideEffectSnapshotFixtureRunResult
    | ConfigSideEffectSnapshotFixtureRunResult;
}): EvidencePlanProbeDispatchResult => ({
  probePlanId: plan.probePlanId,
  probeKind: EvidencePlanProbeKind.SideEffect,
  executorType: plan.executorType,
  status: inferCompletedProbeStatus(fixtureResult.coverageRecords),
  fixtureId: fixtureResult.fixtureId,
  coverageRecords: fixtureResult.coverageRecords,
  deniedCapabilityEvidence: [],
  sideEffectDeltaEvidence: fixtureResult.sideEffectDeltaEvidence,
  failedEvidence: fixtureResult.failedEvidence,
  fixtureResult,
});

const runNegativeProbePlan = async ({
  probePlan,
  input,
}: {
  probePlan: NegativeProbePlan;
  input: EvidencePlanFixtureRunnerInput;
}): Promise<EvidencePlanProbeDispatchResult> => {
  const skippedReason = (() => {
    if (input.executorFingerprint === undefined) {
      return `${probePlan.probePlanId} requires executorFingerprint for negative capability evidence`;
    }

    switch (probePlan.executorType) {
      case ForbiddenEffectType.Sql:
        return assertLocalFixtureOnly({
          plan: probePlan,
          expectedFixtureId: localFixtureIds.sqlNegative,
        });
      case ForbiddenEffectType.CiCd:
        return (
          assertLocalFixtureOnly({
            plan: probePlan,
            expectedFixtureId: localFixtureIds.cicdNegative,
          }) ??
          (input.cicd?.pipelineFixture === undefined
            ? `${probePlan.probePlanId} requires a CI/CD pipeline fixture`
            : undefined)
        );
      case ForbiddenEffectType.Config:
        return (
          assertLocalFixtureOnly({
            plan: probePlan,
            expectedFixtureId: localFixtureIds.configNegative,
          }) ??
          (input.config?.configStoreFixture === undefined
            ? `${probePlan.probePlanId} requires a config store fixture`
            : undefined)
        );
      default:
        return `${probePlan.probePlanId} executor type ${probePlan.executorType} has no local negative fixture runner`;
    }
  })();

  if (skippedReason !== undefined || input.executorFingerprint === undefined) {
    return createSkippedProbeResult({
      plan: probePlan,
      probeKind: EvidencePlanProbeKind.Negative,
      reason: skippedReason ?? "negative capability evidence is not configured",
    });
  }

  switch (probePlan.executorType) {
    case ForbiddenEffectType.Sql: {
      return buildNegativeProbeResult({
        plan: probePlan,
        fixtureResult: await runSqlNegativeCapabilityFixture({
          plan: probePlan,
          obligations: input.obligations,
          executorFingerprint: input.executorFingerprint,
          ...(input.completedAt === undefined
            ? {}
            : { completedAt: input.completedAt }),
          ...(input.sql?.negativeProbeOverrides === undefined
            ? {}
            : { probeOverrides: input.sql.negativeProbeOverrides }),
        }),
      });
    }
    case ForbiddenEffectType.CiCd: {
      const pipelineFixture = input.cicd?.pipelineFixture;

      if (pipelineFixture === undefined) {
        return createSkippedProbeResult({
          plan: probePlan,
          probeKind: EvidencePlanProbeKind.Negative,
          reason: `${probePlan.probePlanId} requires a CI/CD pipeline fixture`,
        });
      }

      return buildNegativeProbeResult({
        plan: probePlan,
        fixtureResult: await runCiCdNegativeCapabilityFixture({
          plan: probePlan,
          obligations: input.obligations,
          pipelineFixture,
          executorFingerprint: input.executorFingerprint,
          ...(input.completedAt === undefined
            ? {}
            : { completedAt: input.completedAt }),
          ...(input.cicd?.negativeProbeOverrides === undefined
            ? {}
            : { probeOverrides: input.cicd.negativeProbeOverrides }),
        }),
      });
    }
    case ForbiddenEffectType.Config: {
      const configStoreFixture = input.config?.configStoreFixture;

      if (configStoreFixture === undefined) {
        return createSkippedProbeResult({
          plan: probePlan,
          probeKind: EvidencePlanProbeKind.Negative,
          reason: `${probePlan.probePlanId} requires a config store fixture`,
        });
      }

      return buildNegativeProbeResult({
        plan: probePlan,
        fixtureResult: await runConfigNegativeCapabilityFixture({
          plan: probePlan,
          obligations: input.obligations,
          configStoreFixture,
          executorFingerprint: input.executorFingerprint,
          ...(input.completedAt === undefined
            ? {}
            : { completedAt: input.completedAt }),
          ...(input.config?.negativeProbeOverrides === undefined
            ? {}
            : { probeOverrides: input.config.negativeProbeOverrides }),
        }),
      });
    }
    default:
      return createSkippedProbeResult({
        plan: probePlan,
        probeKind: EvidencePlanProbeKind.Negative,
        reason: `${probePlan.probePlanId} executor type ${probePlan.executorType} has no local negative fixture runner`,
      });
  }
};

const runSideEffectProbePlan = async ({
  probePlan,
  input,
}: {
  probePlan: SideEffectProbePlan;
  input: EvidencePlanFixtureRunnerInput;
}): Promise<EvidencePlanProbeDispatchResult> => {
  const skippedReason = (() => {
    switch (probePlan.executorType) {
      case ForbiddenEffectType.Sql:
        return (
          assertLocalFixtureOnly({
            plan: probePlan,
            expectedFixtureId: localFixtureIds.sqlSideEffect,
          }) ??
          (input.sql?.beforeSnapshot === undefined ||
          input.sql.afterSnapshot === undefined
            ? `${probePlan.probePlanId} requires SQL before and after snapshots`
            : undefined)
        );
      case ForbiddenEffectType.CiCd:
        return (
          assertLocalFixtureOnly({
            plan: probePlan,
            expectedFixtureId: localFixtureIds.cicdSideEffect,
          }) ??
          (input.cicd?.beforeSnapshot === undefined ||
          input.cicd.afterSnapshot === undefined
            ? `${probePlan.probePlanId} requires CI/CD before and after snapshots`
            : undefined)
        );
      case ForbiddenEffectType.Config:
        return (
          assertLocalFixtureOnly({
            plan: probePlan,
            expectedFixtureId: localFixtureIds.configSideEffect,
          }) ??
          (input.config?.beforeSnapshot === undefined ||
          input.config.afterSnapshot === undefined
            ? `${probePlan.probePlanId} requires config before and after snapshots`
            : undefined)
        );
      default:
        return `${probePlan.probePlanId} executor type ${probePlan.executorType} has no local side-effect fixture runner`;
    }
  })();

  if (skippedReason !== undefined) {
    return createSkippedProbeResult({
      plan: probePlan,
      probeKind: EvidencePlanProbeKind.SideEffect,
      reason: skippedReason,
    });
  }

  switch (probePlan.executorType) {
    case ForbiddenEffectType.Sql: {
      const beforeSnapshot = input.sql?.beforeSnapshot;
      const afterSnapshot = input.sql?.afterSnapshot;

      if (beforeSnapshot === undefined || afterSnapshot === undefined) {
        return createSkippedProbeResult({
          plan: probePlan,
          probeKind: EvidencePlanProbeKind.SideEffect,
          reason: `${probePlan.probePlanId} requires SQL before and after snapshots`,
        });
      }

      return buildSideEffectProbeResult({
        plan: probePlan,
        fixtureResult: await runSqlSideEffectSnapshotFixture({
          plan: probePlan,
          obligations: input.obligations,
          beforeSnapshot,
          afterSnapshot,
          ...(input.completedAt === undefined
            ? {}
            : { completedAt: input.completedAt }),
          ...(input.executorFingerprint === undefined
            ? {}
            : { executorFingerprint: input.executorFingerprint }),
        }),
      });
    }
    case ForbiddenEffectType.CiCd: {
      const beforeSnapshot = input.cicd?.beforeSnapshot;
      const afterSnapshot = input.cicd?.afterSnapshot;

      if (beforeSnapshot === undefined || afterSnapshot === undefined) {
        return createSkippedProbeResult({
          plan: probePlan,
          probeKind: EvidencePlanProbeKind.SideEffect,
          reason: `${probePlan.probePlanId} requires CI/CD before and after snapshots`,
        });
      }

      return buildSideEffectProbeResult({
        plan: probePlan,
        fixtureResult: await runCiCdSideEffectSnapshotFixture({
          plan: probePlan,
          obligations: input.obligations,
          beforeSnapshot,
          afterSnapshot,
          ...(input.completedAt === undefined
            ? {}
            : { completedAt: input.completedAt }),
          ...(input.executorFingerprint === undefined
            ? {}
            : { executorFingerprint: input.executorFingerprint }),
        }),
      });
    }
    case ForbiddenEffectType.Config: {
      const beforeSnapshot = input.config?.beforeSnapshot;
      const afterSnapshot = input.config?.afterSnapshot;

      if (beforeSnapshot === undefined || afterSnapshot === undefined) {
        return createSkippedProbeResult({
          plan: probePlan,
          probeKind: EvidencePlanProbeKind.SideEffect,
          reason: `${probePlan.probePlanId} requires config before and after snapshots`,
        });
      }

      return buildSideEffectProbeResult({
        plan: probePlan,
        fixtureResult: await runConfigSideEffectSnapshotFixture({
          plan: probePlan,
          obligations: input.obligations,
          beforeSnapshot,
          afterSnapshot,
          ...(input.completedAt === undefined
            ? {}
            : { completedAt: input.completedAt }),
          ...(input.executorFingerprint === undefined
            ? {}
            : { executorFingerprint: input.executorFingerprint }),
        }),
      });
    }
    default:
      return createSkippedProbeResult({
        plan: probePlan,
        probeKind: EvidencePlanProbeKind.SideEffect,
        reason: `${probePlan.probePlanId} executor type ${probePlan.executorType} has no local side-effect fixture runner`,
      });
  }
};

const inferRunnerStatus = (
  probeResults: readonly EvidencePlanProbeDispatchResult[],
): EvidencePlanFixtureRunnerStatus => {
  if (
    probeResults.length === 0 ||
    probeResults.some(
      (probeResult) =>
        probeResult.status === EvidencePlanFixtureRunnerStatus.NotConfigured,
    )
  ) {
    return EvidencePlanFixtureRunnerStatus.NotConfigured;
  }

  if (
    probeResults.some(
      (probeResult) => probeResult.status === EvidencePlanFixtureRunnerStatus.Failed,
    )
  ) {
    return EvidencePlanFixtureRunnerStatus.Failed;
  }

  return EvidencePlanFixtureRunnerStatus.Completed;
};

const createResult = ({
  plan,
  probeResults,
  completedAt,
}: {
  plan: EvidencePlan;
  probeResults: readonly EvidencePlanProbeDispatchResult[];
  completedAt: ForbiddenSideEffectTimestamp | undefined;
}): EvidencePlanFixtureRunnerResult => ({
  planId: plan.planId,
  status: inferRunnerStatus(probeResults),
  executorInvoked: false,
  ...(completedAt === undefined ? {} : { completedAt }),
  skippedReasons: probeResults.flatMap((probeResult) =>
    probeResult.skippedReason === undefined ? [] : [probeResult.skippedReason],
  ),
  probeResults,
  coverageRecords: probeResults.flatMap(
    (probeResult) => probeResult.coverageRecords,
  ),
  deniedCapabilityEvidence: probeResults.flatMap(
    (probeResult) => probeResult.deniedCapabilityEvidence,
  ),
  sideEffectDeltaEvidence: probeResults.flatMap(
    (probeResult) => probeResult.sideEffectDeltaEvidence,
  ),
  failedEvidence: probeResults.flatMap((probeResult) =>
    probeResult.failedEvidence,
  ),
});

export const runEvidencePlanFixture = async (
  input: EvidencePlanFixtureRunnerInput,
): Promise<EvidencePlanFixtureRunnerResult> => {
  const planResult = EvidencePlanSchema.safeParse(input.plan);

  if (!planResult.success) {
    const invalidPlanResult: EvidencePlanProbeDispatchResult = {
      probePlanId: input.plan.planId,
      probeKind: EvidencePlanProbeKind.Negative,
      executorType: input.plan.executorType,
      status: EvidencePlanFixtureRunnerStatus.NotConfigured,
      skippedReason: `evidence plan validation failed: ${planResult.issues
        .map((issue) => `${issue.path} ${issue.message}`)
        .join("; ")}`,
      coverageRecords: [],
      deniedCapabilityEvidence: [],
      sideEffectDeltaEvidence: [],
      failedEvidence: [],
    };

    return createResult({
      plan: input.plan,
      probeResults: [invalidPlanResult],
      completedAt: input.completedAt,
    });
  }

  const rootFixtureError = validateRootFixtures(input.plan);

  if (rootFixtureError !== undefined) {
    const rootFixtureResult: EvidencePlanProbeDispatchResult = {
      probePlanId: input.plan.planId,
      probeKind: EvidencePlanProbeKind.Negative,
      executorType: input.plan.executorType,
      status: EvidencePlanFixtureRunnerStatus.NotConfigured,
      skippedReason: rootFixtureError,
      coverageRecords: [],
      deniedCapabilityEvidence: [],
      sideEffectDeltaEvidence: [],
      failedEvidence: [],
    };

    return createResult({
      plan: input.plan,
      probeResults: [rootFixtureResult],
      completedAt: input.completedAt,
    });
  }

  const probeResults: EvidencePlanProbeDispatchResult[] = [];

  for (const probePlan of input.plan.negativeProbePlans) {
    probeResults.push(await runNegativeProbePlan({ probePlan, input }));
  }

  for (const probePlan of input.plan.sideEffectProbePlans) {
    probeResults.push(await runSideEffectProbePlan({ probePlan, input }));
  }

  return createResult({
    plan: input.plan,
    probeResults,
    completedAt: input.completedAt,
  });
};
