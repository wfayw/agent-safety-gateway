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

const configNegativeCapabilityFixtureId =
  "local_config_negative_capability_fixture";
const defaultTimeoutMs = 5_000;

export type ConfigNegativeCapabilityFixtureProbeOutcome =
  (typeof DeniedCapabilityProbeOutcome)[keyof typeof DeniedCapabilityProbeOutcome];

export type ConfigSandboxNegativeProbePlanOptions = {
  probePlanId: string;
  obligationIds: readonly string[];
  service: string;
  configKey: string;
  executorId?: string;
  targetEnvironment?: ForbiddenEffectEnvironment;
  requiredFixtures?: readonly string[];
  timeoutMs?: number;
  productionNamespace?: string;
  productionCredentialRef?: string;
  productionWriteEndpoint?: string;
};

export type ConfigStoreNegativeCapabilityEntry = {
  key: string;
  value: string;
  rollbackCapability?: string;
};

export type ConfigStoreNegativeCapabilityFixture = {
  service: string;
  environment: string;
  namespace: string;
  entries?: readonly ConfigStoreNegativeCapabilityEntry[];
  productionNamespaceWriteAttempted?: boolean;
  productionCredentialUsed?: boolean;
  productionWriteEndpointAccessed?: boolean;
};

export type ConfigNegativeCapabilityFixtureProbeOverride = {
  attemptedOperation: string;
  observedRejection: ConfigNegativeCapabilityFixtureProbeOutcome;
  rejectionReason?: string;
};

export type ConfigNegativeCapabilityFixtureRunnerInput = {
  plan: NegativeProbePlan;
  obligations: readonly ForbiddenEffectObligation[];
  configStoreFixture: ConfigStoreNegativeCapabilityFixture;
  executorFingerprint: string;
  completedAt?: ForbiddenSideEffectTimestamp;
  probeOverrides?: readonly ConfigNegativeCapabilityFixtureProbeOverride[];
};

export type ConfigNegativeCapabilityFixtureProbeResult = {
  task: NegativeProbeTask;
  evidence: DeniedCapabilityEvidence;
  evidenceHash: string;
  coverageRecord: EvidenceCoverageRecord;
};

export type ConfigNegativeCapabilityFixtureRunResult = {
  probePlanId: string;
  executorId?: string;
  fixtureId: typeof configNegativeCapabilityFixtureId;
  configStoreConnected: false;
  dryRunMode: "fixture";
  service: string;
  namespace: string;
  productionNamespaceWriteAttempted: boolean;
  productionCredentialUsed: boolean;
  productionWriteEndpointAccessed: boolean;
  probeResults: readonly ConfigNegativeCapabilityFixtureProbeResult[];
  deniedCapabilityEvidence: readonly DeniedCapabilityEvidence[];
  failedEvidence: readonly DeniedCapabilityEvidence[];
  coverageRecords: readonly EvidenceCoverageRecord[];
};

type ConfigForbiddenProbeActivity = {
  label: string;
  rejectedReason: string;
  allowedReason: string;
  activityObserved: boolean;
};

const createConfigSandboxNegativeProbeTasks = ({
  service,
  configKey,
  productionNamespace,
  productionCredentialRef,
  productionWriteEndpoint,
}: {
  service: string;
  configKey: string;
  productionNamespace: string;
  productionCredentialRef?: string;
  productionWriteEndpoint?: string;
}): NegativeProbeTask[] => {
  const configTarget = `namespace/${productionNamespace}/${service}/${configKey}`;
  const credentialTarget =
    productionCredentialRef ??
    `credential/${productionNamespace}/${service}/config-write`;
  const writeEndpoint =
    productionWriteEndpoint ??
    `/config-store/${productionNamespace}/${service}/${configKey}`;

  return [
    {
      probeType: ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
      operation: `WRITE ${service}.${configKey} TO ${configTarget}`,
      target: configTarget,
      expectedOutcome: "write_rejected",
    },
    {
      probeType: ForbiddenEffectEvidenceType.ProductionCredentialUseDenial,
      operation: `USE ${credentialTarget}`,
      target: credentialTarget,
      expectedOutcome: "credential_rejected",
    },
    {
      probeType: ForbiddenEffectEvidenceType.ProductionWriteEndpointAccessDenial,
      operation: `POST ${writeEndpoint}`,
      target: writeEndpoint,
      expectedOutcome: "endpoint_not_called",
    },
  ];
};

export const createConfigSandboxNegativeProbePlan = (
  options: ConfigSandboxNegativeProbePlanOptions,
): NegativeProbePlan => {
  const targetEnvironment =
    options.targetEnvironment ?? ForbiddenEffectEnvironment.Production;
  const productionNamespace =
    options.productionNamespace ?? ForbiddenEffectEnvironment.Production;
  const plan = {
    probePlanId: options.probePlanId,
    obligationIds: options.obligationIds,
    executorType: ForbiddenEffectType.Config,
    targetEnvironment,
    requiredFixtures: options.requiredFixtures ?? [configNegativeCapabilityFixtureId],
    timeoutStrategy: {
      timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
      onTimeout: EvidencePlanTimeoutAction.DenyPermit,
    },
    dangerousCapabilitiesToDeny: [
      "production_namespace_write",
      "production_credential_use",
      "production_write_endpoint_access",
    ],
    probeTasks: createConfigSandboxNegativeProbeTasks({
      service: options.service,
      configKey: options.configKey,
      productionNamespace,
      ...(options.productionCredentialRef === undefined
        ? {}
        : { productionCredentialRef: options.productionCredentialRef }),
      ...(options.productionWriteEndpoint === undefined
        ? {}
        : { productionWriteEndpoint: options.productionWriteEndpoint }),
    }),
  } satisfies NegativeProbePlan;

  if (options.executorId === undefined) {
    return plan;
  }

  return { ...plan, executorId: options.executorId };
};

const normalizeAttemptedOperation = (operation: string): string =>
  operation.trim().replace(/\s+/g, " ").toLowerCase();

const getProbeOverride = (
  task: NegativeProbeTask,
  overrides: readonly ConfigNegativeCapabilityFixtureProbeOverride[],
): ConfigNegativeCapabilityFixtureProbeOverride | undefined => {
  const normalizedOperation = normalizeAttemptedOperation(task.operation);

  return overrides.find(
    (override) =>
      normalizeAttemptedOperation(override.attemptedOperation) ===
      normalizedOperation,
  );
};

const getProbeActivity = (
  task: NegativeProbeTask,
  configStoreFixture: ConfigStoreNegativeCapabilityFixture,
): ConfigForbiddenProbeActivity => {
  if (
    task.probeType ===
    ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial
  ) {
    const label = "production namespace write";

    return {
      label,
      rejectedReason: `config sandbox fixture rejected ${label} for ${task.target}`,
      allowedReason: `config sandbox fixture unexpectedly performed ${label} for ${task.target}`,
      activityObserved:
        configStoreFixture.productionNamespaceWriteAttempted ?? false,
    };
  }

  if (
    task.probeType ===
    ForbiddenEffectEvidenceType.ProductionCredentialUseDenial
  ) {
    const label = "production credential use";

    return {
      label,
      rejectedReason: `config sandbox fixture rejected ${label} for ${task.target}`,
      allowedReason: `config sandbox fixture unexpectedly performed ${label} for ${task.target}`,
      activityObserved: configStoreFixture.productionCredentialUsed ?? false,
    };
  }

  if (
    task.probeType ===
    ForbiddenEffectEvidenceType.ProductionWriteEndpointAccessDenial
  ) {
    const label = "production write endpoint access";

    return {
      label,
      rejectedReason: `config sandbox fixture rejected ${label} for ${task.target}`,
      allowedReason: `config sandbox fixture unexpectedly performed ${label} for ${task.target}`,
      activityObserved:
        configStoreFixture.productionWriteEndpointAccessed ?? false,
    };
  }

  return {
    label: task.target,
    rejectedReason: `config sandbox fixture rejected ${task.target}`,
    allowedReason: `config sandbox fixture unexpectedly allowed ${task.target}`,
    activityObserved: false,
  };
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
        obligation.effectType === ForbiddenEffectType.Config &&
        obligation.requiredEvidenceTypes.includes(task.probeType),
    )
    .sort((left, right) => left.obligationId.localeCompare(right.obligationId))
    .at(0);

  return matchingObligation?.obligationId ?? plan.obligationIds[0] ?? task.target;
};

const getObservedRejection = (
  task: NegativeProbeTask,
  configStoreFixture: ConfigStoreNegativeCapabilityFixture,
  override: ConfigNegativeCapabilityFixtureProbeOverride | undefined,
): ConfigNegativeCapabilityFixtureProbeOutcome => {
  if (override !== undefined) {
    return override.observedRejection;
  }

  return getProbeActivity(task, configStoreFixture).activityObserved
    ? DeniedCapabilityProbeOutcome.UnexpectedlyAllowed
    : DeniedCapabilityProbeOutcome.Rejected;
};

const buildRejectionReason = (
  task: NegativeProbeTask,
  configStoreFixture: ConfigStoreNegativeCapabilityFixture,
  observedRejection: ConfigNegativeCapabilityFixtureProbeOutcome,
  overrideReason: string | undefined,
): string => {
  if (overrideReason !== undefined && overrideReason.trim().length > 0) {
    return overrideReason;
  }

  const activity = getProbeActivity(task, configStoreFixture);

  if (observedRejection === DeniedCapabilityProbeOutcome.Rejected) {
    return activity.rejectedReason;
  }

  if (observedRejection === DeniedCapabilityProbeOutcome.UnexpectedlyAllowed) {
    return activity.allowedReason;
  }

  if (observedRejection === DeniedCapabilityProbeOutcome.Skipped) {
    return `config sandbox fixture skipped ${activity.label} for ${task.target}`;
  }

  return `config sandbox fixture errored while probing ${activity.label} for ${task.target}`;
};

const getCoverageStatus = (
  observedRejection: ConfigNegativeCapabilityFixtureProbeOutcome,
): EvidenceCoverageStatus => {
  if (observedRejection === DeniedCapabilityProbeOutcome.Rejected) {
    return EvidenceCoverageStatus.Covered;
  }

  if (observedRejection === DeniedCapabilityProbeOutcome.Skipped) {
    return EvidenceCoverageStatus.NotApplicable;
  }

  return EvidenceCoverageStatus.Failed;
};

export const runConfigNegativeCapabilityFixture = async ({
  plan,
  obligations,
  configStoreFixture,
  executorFingerprint,
  completedAt = new Date().toISOString(),
  probeOverrides = [],
}: ConfigNegativeCapabilityFixtureRunnerInput): Promise<ConfigNegativeCapabilityFixtureRunResult> => {
  const probeResults: ConfigNegativeCapabilityFixtureProbeResult[] = [];

  for (const task of plan.probeTasks) {
    const override = getProbeOverride(task, probeOverrides);
    const observedRejection = getObservedRejection(
      task,
      configStoreFixture,
      override,
    );
    const obligationId = selectObligationIdForTask(task, plan, obligations);
    const evidence: DeniedCapabilityEvidence = {
      probeId: plan.probePlanId,
      obligationId,
      attemptedOperation: task.operation,
      observedRejection,
      rejectionReason: buildRejectionReason(
        task,
        configStoreFixture,
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
    fixtureId: configNegativeCapabilityFixtureId,
    configStoreConnected: false,
    dryRunMode: "fixture",
    service: configStoreFixture.service,
    namespace: configStoreFixture.namespace,
    productionNamespaceWriteAttempted:
      configStoreFixture.productionNamespaceWriteAttempted ?? false,
    productionCredentialUsed:
      configStoreFixture.productionCredentialUsed ?? false,
    productionWriteEndpointAccessed:
      configStoreFixture.productionWriteEndpointAccessed ?? false,
    probeResults,
    deniedCapabilityEvidence: probeResults.map(
      (probeResult) => probeResult.evidence,
    ),
    failedEvidence,
    coverageRecords: probeResults.map((probeResult) =>
      probeResult.coverageRecord,
    ),
  } satisfies ConfigNegativeCapabilityFixtureRunResult;

  if (plan.executorId === undefined) {
    return result;
  }

  return { ...result, executorId: plan.executorId };
};
