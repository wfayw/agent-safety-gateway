import {
  createDeniedCapabilityEvidenceHash,
  DeniedCapabilityProbeOutcome,
  EvidenceCoverageStatus,
  EvidencePlanTimeoutAction,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  ForbiddenEffectType,
  type DeniedCapabilityEvidence,
  type EvidenceCoverageRecord,
  type ForbiddenEffectObligation,
  type ForbiddenSideEffectTimestamp,
  type NegativeProbePlan,
  type NegativeProbeTask,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

const sqlNegativeCapabilityFixtureId = "local_sql_negative_capability_fixture";
const defaultProbeTarget = "__asg_sql_negative_probe";
const defaultTimeoutMs = 5_000;

export type SqlNegativeCapabilityFixtureProbeOutcome =
  (typeof DeniedCapabilityProbeOutcome)[keyof typeof DeniedCapabilityProbeOutcome];

export type SqlReadonlyNegativeProbePlanOptions = {
  probePlanId: string;
  obligationIds: readonly string[];
  executorId?: string;
  targetEnvironment?: ForbiddenEffectEnvironment;
  requiredFixtures?: readonly string[];
  timeoutMs?: number;
  probeTarget?: string;
};

export type SqlNegativeCapabilityFixtureProbeOverride = {
  attemptedOperation: string;
  observedRejection: SqlNegativeCapabilityFixtureProbeOutcome;
  rejectionReason?: string;
};

export type SqlNegativeCapabilityFixtureRunnerInput = {
  plan: NegativeProbePlan;
  obligations: readonly ForbiddenEffectObligation[];
  executorFingerprint: string;
  completedAt?: ForbiddenSideEffectTimestamp;
  probeOverrides?: readonly SqlNegativeCapabilityFixtureProbeOverride[];
};

export type SqlNegativeCapabilityFixtureProbeResult = {
  task: NegativeProbeTask;
  evidence: DeniedCapabilityEvidence;
  evidenceHash: string;
  coverageRecord: EvidenceCoverageRecord;
};

export type SqlNegativeCapabilityFixtureRunResult = {
  probePlanId: string;
  executorId?: string;
  fixtureId: typeof sqlNegativeCapabilityFixtureId;
  databaseConnected: false;
  probeResults: readonly SqlNegativeCapabilityFixtureProbeResult[];
  deniedCapabilityEvidence: readonly DeniedCapabilityEvidence[];
  failedEvidence: readonly DeniedCapabilityEvidence[];
  coverageRecords: readonly EvidenceCoverageRecord[];
};

const createSqlReadonlyNegativeProbeTasks = (
  probeTarget: string,
): NegativeProbeTask[] => [
  {
    probeType: ForbiddenEffectEvidenceType.WriteDenial,
    operation: `INSERT INTO ${probeTarget} (id, probe_value) VALUES (1, 'blocked')`,
    target: probeTarget,
    expectedOutcome: "permission_denied",
  },
  {
    probeType: ForbiddenEffectEvidenceType.WriteDenial,
    operation: `UPDATE ${probeTarget} SET probe_value = 'blocked' WHERE id = 1`,
    target: probeTarget,
    expectedOutcome: "permission_denied",
  },
  {
    probeType: ForbiddenEffectEvidenceType.DeleteDenial,
    operation: `DELETE FROM ${probeTarget} WHERE id = 1`,
    target: probeTarget,
    expectedOutcome: "permission_denied",
  },
  {
    probeType: ForbiddenEffectEvidenceType.DdlDenial,
    operation: `CREATE TABLE ${probeTarget}_ddl (id integer)`,
    target: `${probeTarget}_ddl`,
    expectedOutcome: "permission_denied",
  },
  {
    probeType: ForbiddenEffectEvidenceType.DdlDenial,
    operation: `DROP TABLE ${probeTarget}`,
    target: probeTarget,
    expectedOutcome: "permission_denied",
  },
  {
    probeType: ForbiddenEffectEvidenceType.DdlDenial,
    operation: `TRUNCATE TABLE ${probeTarget}`,
    target: probeTarget,
    expectedOutcome: "permission_denied",
  },
  {
    probeType: ForbiddenEffectEvidenceType.DdlDenial,
    operation: `ALTER TABLE ${probeTarget} ADD COLUMN __asg_probe_text text`,
    target: probeTarget,
    expectedOutcome: "permission_denied",
  },
];

export const createSqlReadonlyNegativeProbePlan = (
  options: SqlReadonlyNegativeProbePlanOptions,
): NegativeProbePlan => {
  const probeTarget = options.probeTarget ?? defaultProbeTarget;
  const plan = {
    probePlanId: options.probePlanId,
    obligationIds: options.obligationIds,
    executorType: ForbiddenEffectType.Sql,
    targetEnvironment:
      options.targetEnvironment ?? ForbiddenEffectEnvironment.Production,
    requiredFixtures: options.requiredFixtures ?? [sqlNegativeCapabilityFixtureId],
    timeoutStrategy: {
      timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
      onTimeout: EvidencePlanTimeoutAction.DenyPermit,
    },
    dangerousCapabilitiesToDeny: [
      "write",
      "insert",
      "update",
      "delete",
      "ddl",
    ],
    probeTasks: createSqlReadonlyNegativeProbeTasks(probeTarget),
  } satisfies NegativeProbePlan;

  if (options.executorId === undefined) {
    return plan;
  }

  return { ...plan, executorId: options.executorId };
};

const normalizeAttemptedOperation = (operation: string): string =>
  operation.trim().replace(/\s+/g, " ").toLowerCase();

const getSqlOperationKeyword = (operation: string): string =>
  operation.trim().split(/\s+/, 1)[0]?.toUpperCase() ?? "SQL";

const getProbeOverride = (
  task: NegativeProbeTask,
  overrides: readonly SqlNegativeCapabilityFixtureProbeOverride[],
): SqlNegativeCapabilityFixtureProbeOverride | undefined => {
  const normalizedOperation = normalizeAttemptedOperation(task.operation);

  return overrides.find(
    (override) =>
      normalizeAttemptedOperation(override.attemptedOperation) ===
      normalizedOperation,
  );
};

const selectObligationIdForTask = (
  task: NegativeProbeTask,
  plan: NegativeProbePlan,
  obligations: readonly ForbiddenEffectObligation[],
): string => {
  const planObligationIds = new Set(plan.obligationIds);
  const matchingObligation = obligations
    .filter(
      (obligation) =>
        planObligationIds.has(obligation.obligationId) &&
        obligation.effectType === ForbiddenEffectType.Sql &&
        obligation.requiredEvidenceTypes.includes(task.probeType),
    )
    .sort((left, right) => left.obligationId.localeCompare(right.obligationId))
    .at(0);

  return matchingObligation?.obligationId ?? plan.obligationIds[0] ?? task.target;
};

const buildRejectionReason = (
  task: NegativeProbeTask,
  observedRejection: SqlNegativeCapabilityFixtureProbeOutcome,
  overrideReason: string | undefined,
): string => {
  if (overrideReason !== undefined && overrideReason.trim().length > 0) {
    return overrideReason;
  }

  const operationKeyword = getSqlOperationKeyword(task.operation);

  if (observedRejection === DeniedCapabilityProbeOutcome.Rejected) {
    return `readonly SQL fixture rejected ${operationKeyword} against ${task.target}`;
  }

  if (observedRejection === DeniedCapabilityProbeOutcome.UnexpectedlyAllowed) {
    return `readonly SQL fixture unexpectedly allowed ${operationKeyword} against ${task.target}`;
  }

  if (observedRejection === DeniedCapabilityProbeOutcome.Skipped) {
    return `readonly SQL fixture skipped ${operationKeyword} against ${task.target}`;
  }

  return `readonly SQL fixture errored while probing ${operationKeyword} against ${task.target}`;
};

const getCoverageStatus = (
  observedRejection: SqlNegativeCapabilityFixtureProbeOutcome,
): EvidenceCoverageStatus => {
  if (observedRejection === DeniedCapabilityProbeOutcome.Rejected) {
    return EvidenceCoverageStatus.Covered;
  }

  if (observedRejection === DeniedCapabilityProbeOutcome.Skipped) {
    return EvidenceCoverageStatus.NotApplicable;
  }

  return EvidenceCoverageStatus.Failed;
};

export const runSqlNegativeCapabilityFixture = async ({
  plan,
  obligations,
  executorFingerprint,
  completedAt = new Date().toISOString(),
  probeOverrides = [],
}: SqlNegativeCapabilityFixtureRunnerInput): Promise<SqlNegativeCapabilityFixtureRunResult> => {
  const probeResults: SqlNegativeCapabilityFixtureProbeResult[] = [];

  for (const task of plan.probeTasks) {
    const override = getProbeOverride(task, probeOverrides);
    const observedRejection =
      override?.observedRejection ?? DeniedCapabilityProbeOutcome.Rejected;
    const obligationId = selectObligationIdForTask(task, plan, obligations);
    const evidence: DeniedCapabilityEvidence = {
      probeId: plan.probePlanId,
      obligationId,
      attemptedOperation: task.operation,
      observedRejection,
      rejectionReason: buildRejectionReason(
        task,
        observedRejection,
        override?.rejectionReason,
      ),
      executorFingerprint,
      completedAt,
    };
    const evidenceHash = await createDeniedCapabilityEvidenceHash(evidence);
    const status = getCoverageStatus(observedRejection);
    const coverageRecord: EvidenceCoverageRecord = {
      obligationId,
      requiredEvidenceType: task.probeType,
      evidenceType: task.probeType,
      evidenceHash,
      status,
      completedAt,
      evidence,
      ...(status === EvidenceCoverageStatus.Failed
        ? { failureReason: evidence.rejectionReason }
        : {}),
    };

    probeResults.push({ task, evidence, evidenceHash, coverageRecord });
  }

  const failedEvidence = probeResults
    .filter(
      (probeResult) =>
        probeResult.coverageRecord.status === EvidenceCoverageStatus.Failed,
    )
    .map((probeResult) => probeResult.evidence);
  const result = {
    probePlanId: plan.probePlanId,
    fixtureId: sqlNegativeCapabilityFixtureId,
    databaseConnected: false,
    probeResults,
    deniedCapabilityEvidence: probeResults.map(
      (probeResult) => probeResult.evidence,
    ),
    failedEvidence,
    coverageRecords: probeResults.map((probeResult) =>
      probeResult.coverageRecord,
    ),
  } satisfies SqlNegativeCapabilityFixtureRunResult;

  if (plan.executorId === undefined) {
    return result;
  }

  return { ...result, executorId: plan.executorId };
};
