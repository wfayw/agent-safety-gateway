import { createHash } from "node:crypto";

import {
  createSideEffectDeltaEvidenceHash,
  EvidenceCoverageStatus,
  EvidencePlanTimeoutAction,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  ForbiddenEffectType,
  SideEffectEvidenceType,
  type EvidenceCoverageRecord,
  type ForbiddenEffectObligation,
  type ForbiddenSideEffectTimestamp,
  type SideEffectDeltaChange,
  type SideEffectDeltaEvidence,
  type SideEffectObservedEvent,
  type SideEffectProbePlan,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

const sqlSideEffectSnapshotFixtureId =
  "local_sql_side_effect_snapshot_fixture";
const defaultSnapshotTarget = "__asg_sql_side_effect_probe";
const defaultTimeoutMs = 5_000;

const sqlSideEffectEvidenceTypes = new Set<ForbiddenEffectEvidenceType>([
  ForbiddenEffectEvidenceType.NoRowMutation,
  ForbiddenEffectEvidenceType.NoTriggerSideEffect,
  ForbiddenEffectEvidenceType.NoExternalSideEffect,
]);

type JsonObject = Record<string, unknown>;

export type SqlSideEffectSnapshotFixtureState = {
  rows: readonly JsonObject[];
  triggerLogs: readonly JsonObject[];
  asyncJobLogs: readonly JsonObject[];
};

export type SqlSideEffectSnapshot = {
  rowsHash: string;
  triggerLogsHash: string;
  asyncJobLogsHash: string;
  snapshotHash: string;
};

export type SqlSideEffectProbePlanOptions = {
  probePlanId: string;
  obligationIds: readonly string[];
  executorId?: string;
  targetEnvironment?: ForbiddenEffectEnvironment;
  requiredFixtures?: readonly string[];
  timeoutMs?: number;
  snapshotTarget?: string;
  predictedEffectTypes?: readonly string[];
  forbiddenEffectTypes?: readonly string[];
};

export type SqlSideEffectSnapshotFixtureRunnerInput = {
  plan: SideEffectProbePlan;
  obligations: readonly ForbiddenEffectObligation[];
  executorId?: string;
  executorFingerprint?: string;
  beforeSnapshot: SqlSideEffectSnapshotFixtureState;
  afterSnapshot: SqlSideEffectSnapshotFixtureState;
  completedAt?: ForbiddenSideEffectTimestamp;
};

export type SqlSideEffectSnapshotFixtureEvidenceResult = {
  obligation: ForbiddenEffectObligation;
  requiredEvidenceType: ForbiddenEffectEvidenceType;
  evidence: SideEffectDeltaEvidence;
  evidenceHash: string;
  coverageRecord: EvidenceCoverageRecord;
};

export type SqlSideEffectSnapshotFixtureRunResult = {
  probePlanId: string;
  executorId: string;
  fixtureId: typeof sqlSideEffectSnapshotFixtureId;
  databaseConnected: false;
  dryRunMode: "fixture";
  beforeSnapshot: SqlSideEffectSnapshot;
  afterSnapshot: SqlSideEffectSnapshot;
  evidenceResults: readonly SqlSideEffectSnapshotFixtureEvidenceResult[];
  sideEffectDeltaEvidence: readonly SideEffectDeltaEvidence[];
  failedEvidence: readonly SideEffectDeltaEvidence[];
  forbiddenEffectsObserved: readonly SideEffectObservedEvent[];
  coverageRecords: readonly EvidenceCoverageRecord[];
};

type SqlSnapshotSegment = {
  requiredEvidenceType: ForbiddenEffectEvidenceType;
  evidenceType: SideEffectEvidenceType;
  targetSuffix: string;
  beforeHash: string;
  afterHash: string;
  changeType: string;
  forbiddenEffectType: string;
};

const stableSortJson = (input: unknown): unknown => {
  if (Array.isArray(input)) {
    return input.map(stableSortJson);
  }

  if (input !== null && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .filter(([, value]) => value !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, stableSortJson(value)]),
    );
  }

  return input;
};

const createSha256Hash = (payload: unknown): string => {
  const serializedPayload = JSON.stringify(stableSortJson(payload)) ?? "null";

  return `sha256:${createHash("sha256")
    .update(serializedPayload)
    .digest("hex")}`;
};

export const createSqlSideEffectSnapshot = (
  snapshot: SqlSideEffectSnapshotFixtureState,
): SqlSideEffectSnapshot => {
  const rowsHash = createSha256Hash({
    schema: "agent-safety-gateway.sql-side-effect-snapshot.rows.v1",
    rows: snapshot.rows,
  });
  const triggerLogsHash = createSha256Hash({
    schema: "agent-safety-gateway.sql-side-effect-snapshot.trigger-logs.v1",
    triggerLogs: snapshot.triggerLogs,
  });
  const asyncJobLogsHash = createSha256Hash({
    schema: "agent-safety-gateway.sql-side-effect-snapshot.async-job-logs.v1",
    asyncJobLogs: snapshot.asyncJobLogs,
  });
  const snapshotHash = createSha256Hash({
    schema: "agent-safety-gateway.sql-side-effect-snapshot.combined.v1",
    rowsHash,
    triggerLogsHash,
    asyncJobLogsHash,
  });

  return {
    rowsHash,
    triggerLogsHash,
    asyncJobLogsHash,
    snapshotHash,
  };
};

export const createSqlSideEffectProbePlan = (
  options: SqlSideEffectProbePlanOptions,
): SideEffectProbePlan => {
  const snapshotTarget = options.snapshotTarget ?? defaultSnapshotTarget;
  const plan = {
    probePlanId: options.probePlanId,
    obligationIds: options.obligationIds,
    executorType: ForbiddenEffectType.Sql,
    targetEnvironment:
      options.targetEnvironment ?? ForbiddenEffectEnvironment.Production,
    requiredFixtures: options.requiredFixtures ?? [
      sqlSideEffectSnapshotFixtureId,
    ],
    timeoutStrategy: {
      timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
      onTimeout: EvidencePlanTimeoutAction.DenyPermit,
    },
    predictedEffectTypes: options.predictedEffectTypes ?? ["dry_run_plan"],
    forbiddenEffectTypes: options.forbiddenEffectTypes ?? [
      "row_mutation",
      "trigger_side_effect",
      "async_job_side_effect",
    ],
    snapshotTargets: [
      `${snapshotTarget}:rows`,
      `${snapshotTarget}:trigger_logs`,
      `${snapshotTarget}:async_job_logs`,
    ],
  } satisfies SideEffectProbePlan;

  if (options.executorId === undefined) {
    return plan;
  }

  return { ...plan, executorId: options.executorId };
};

const getExecutorId = (
  plan: SideEffectProbePlan,
  executorId: string | undefined,
): string =>
  plan.executorId ?? executorId ?? "sql-side-effect-snapshot-fixture-executor";

const getPlannedSqlObligations = (
  plan: SideEffectProbePlan,
  obligations: readonly ForbiddenEffectObligation[],
): ForbiddenEffectObligation[] => {
  const planObligationIds = new Set(plan.obligationIds);

  return obligations
    .filter(
      (obligation) =>
        planObligationIds.has(obligation.obligationId) &&
        obligation.effectType === ForbiddenEffectType.Sql,
    )
    .sort((left, right) => left.obligationId.localeCompare(right.obligationId));
};

const getSnapshotTarget = (
  plan: SideEffectProbePlan,
  targetSuffix: string,
): string =>
  plan.snapshotTargets.find((target) => target.endsWith(`:${targetSuffix}`)) ??
  targetSuffix;

const buildSnapshotSegments = (
  plan: SideEffectProbePlan,
  beforeSnapshot: SqlSideEffectSnapshot,
  afterSnapshot: SqlSideEffectSnapshot,
): SqlSnapshotSegment[] => [
  {
    requiredEvidenceType: ForbiddenEffectEvidenceType.NoRowMutation,
    evidenceType: SideEffectEvidenceType.Database,
    targetSuffix: "rows",
    beforeHash: beforeSnapshot.rowsHash,
    afterHash: afterSnapshot.rowsHash,
    changeType: "row_mutation_detected",
    forbiddenEffectType: "row_mutation",
  },
  {
    requiredEvidenceType: ForbiddenEffectEvidenceType.NoTriggerSideEffect,
    evidenceType: SideEffectEvidenceType.Trigger,
    targetSuffix: "trigger_logs",
    beforeHash: beforeSnapshot.triggerLogsHash,
    afterHash: afterSnapshot.triggerLogsHash,
    changeType: "trigger_log_delta_detected",
    forbiddenEffectType: "trigger_side_effect",
  },
  {
    requiredEvidenceType: ForbiddenEffectEvidenceType.NoExternalSideEffect,
    evidenceType: SideEffectEvidenceType.AsyncJob,
    targetSuffix: "async_job_logs",
    beforeHash: beforeSnapshot.asyncJobLogsHash,
    afterHash: afterSnapshot.asyncJobLogsHash,
    changeType: "async_job_delta_detected",
    forbiddenEffectType: "async_job_side_effect",
  },
].map((segment) => ({
  ...segment,
  targetSuffix: getSnapshotTarget(plan, segment.targetSuffix),
}));

const buildDeltaChange = (segment: SqlSnapshotSegment): SideEffectDeltaChange =>
  ({
    evidenceType: segment.evidenceType,
    target: segment.targetSuffix,
    beforeHash: segment.beforeHash,
    afterHash: segment.afterHash,
    changeType: segment.changeType,
  });

const buildObservedEvent = (
  segment: SqlSnapshotSegment,
  completedAt: ForbiddenSideEffectTimestamp,
): SideEffectObservedEvent => ({
  evidenceType: segment.evidenceType,
  target: segment.targetSuffix,
  eventHash: createSha256Hash({
    schema: "agent-safety-gateway.sql-side-effect-snapshot.delta-event.v1",
    evidenceType: segment.evidenceType,
    target: segment.targetSuffix,
    beforeHash: segment.beforeHash,
    afterHash: segment.afterHash,
    changeType: segment.changeType,
    forbiddenEffectType: segment.forbiddenEffectType,
  }),
  observedAt: completedAt,
});

const buildFailureReason = (segment: SqlSnapshotSegment): string =>
  `SQL dry-run fixture observed ${segment.forbiddenEffectType} on ${segment.targetSuffix}`;

export const runSqlSideEffectSnapshotFixture = async ({
  plan,
  obligations,
  executorId,
  executorFingerprint,
  beforeSnapshot: beforeSnapshotState,
  afterSnapshot: afterSnapshotState,
  completedAt = new Date().toISOString(),
}: SqlSideEffectSnapshotFixtureRunnerInput): Promise<SqlSideEffectSnapshotFixtureRunResult> => {
  const resolvedExecutorId = getExecutorId(plan, executorId);
  const beforeSnapshot = createSqlSideEffectSnapshot(beforeSnapshotState);
  const afterSnapshot = createSqlSideEffectSnapshot(afterSnapshotState);
  const segmentsByRequiredEvidenceType = new Map(
    buildSnapshotSegments(plan, beforeSnapshot, afterSnapshot).map((segment) => [
      segment.requiredEvidenceType,
      segment,
    ]),
  );
  const evidenceResults: SqlSideEffectSnapshotFixtureEvidenceResult[] = [];

  for (const obligation of getPlannedSqlObligations(plan, obligations)) {
    const requiredSideEffectEvidence = obligation.requiredEvidenceTypes.filter(
      (requiredEvidenceType) =>
        sqlSideEffectEvidenceTypes.has(requiredEvidenceType),
    );

    for (const requiredEvidenceType of requiredSideEffectEvidence) {
      const segment = segmentsByRequiredEvidenceType.get(requiredEvidenceType);

      if (segment === undefined) {
        continue;
      }

      const changed = segment.beforeHash !== segment.afterHash;
      const event = changed
        ? buildObservedEvent(segment, completedAt)
        : undefined;
      const effectDelta = changed ? [buildDeltaChange(segment)] : [];
      const forbiddenEffectsObserved = event === undefined ? [] : [event];
      const evidence: SideEffectDeltaEvidence = {
        probeId: plan.probePlanId,
        obligationId: obligation.obligationId,
        executorId: resolvedExecutorId,
        beforeSnapshotHash: beforeSnapshot.snapshotHash,
        afterSnapshotHash: afterSnapshot.snapshotHash,
        observedEvents: forbiddenEffectsObserved,
        forbiddenEffectsObserved,
        effectDelta,
        completedAt,
        ...(executorFingerprint === undefined ? {} : { executorFingerprint }),
      };
      const evidenceHash = await createSideEffectDeltaEvidenceHash(evidence);
      const status = changed
        ? EvidenceCoverageStatus.Failed
        : EvidenceCoverageStatus.Covered;
      const coverageRecord: EvidenceCoverageRecord = {
        obligationId: obligation.obligationId,
        requiredEvidenceType,
        evidenceType: requiredEvidenceType,
        evidenceHash,
        status,
        completedAt,
        evidence,
        ...(changed ? { failureReason: buildFailureReason(segment) } : {}),
      };

      evidenceResults.push({
        obligation,
        requiredEvidenceType,
        evidence,
        evidenceHash,
        coverageRecord,
      });
    }
  }

  const failedEvidence = evidenceResults
    .filter(
      (result) => result.coverageRecord.status === EvidenceCoverageStatus.Failed,
    )
    .map((result) => result.evidence);
  const forbiddenEffectsObserved = evidenceResults.flatMap(
    (result) => result.evidence.forbiddenEffectsObserved,
  );

  return {
    probePlanId: plan.probePlanId,
    executorId: resolvedExecutorId,
    fixtureId: sqlSideEffectSnapshotFixtureId,
    databaseConnected: false,
    dryRunMode: "fixture",
    beforeSnapshot,
    afterSnapshot,
    evidenceResults,
    sideEffectDeltaEvidence: evidenceResults.map((result) => result.evidence),
    failedEvidence,
    forbiddenEffectsObserved,
    coverageRecords: evidenceResults.map((result) => result.coverageRecord),
  };
};
