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

const cicdNegativeCapabilityFixtureId =
  "local_cicd_negative_capability_fixture";
const defaultTimeoutMs = 5_000;

export type CiCdNegativeCapabilityFixtureProbeOutcome =
  (typeof DeniedCapabilityProbeOutcome)[keyof typeof DeniedCapabilityProbeOutcome];

export type CiCdDryRunNegativeProbePlanOptions = {
  probePlanId: string;
  obligationIds: readonly string[];
  service: string;
  pipelineId: string;
  executorId?: string;
  targetEnvironment?: ForbiddenEffectEnvironment;
  requiredFixtures?: readonly string[];
  timeoutMs?: number;
  candidateVersion?: string;
  productionDeployEndpoint?: string;
  externalWebhookTarget?: string;
  artifactPromotionTarget?: string;
};

export type CiCdPipelineNegativeCapabilityFixture = {
  pipelineId: string;
  service: string;
  environment: string;
  candidateVersion?: string;
  productionEndpointCalled?: boolean;
  externalWebhookDispatched?: boolean;
  artifactPromoted?: boolean;
};

export type CiCdNegativeCapabilityFixtureProbeOverride = {
  attemptedOperation: string;
  observedRejection: CiCdNegativeCapabilityFixtureProbeOutcome;
  rejectionReason?: string;
};

export type CiCdNegativeCapabilityFixtureRunnerInput = {
  plan: NegativeProbePlan;
  obligations: readonly ForbiddenEffectObligation[];
  pipelineFixture: CiCdPipelineNegativeCapabilityFixture;
  executorFingerprint: string;
  completedAt?: ForbiddenSideEffectTimestamp;
  probeOverrides?: readonly CiCdNegativeCapabilityFixtureProbeOverride[];
};

export type CiCdNegativeCapabilityFixtureProbeResult = {
  task: NegativeProbeTask;
  evidence: DeniedCapabilityEvidence;
  evidenceHash: string;
  coverageRecord: EvidenceCoverageRecord;
};

export type CiCdNegativeCapabilityFixtureRunResult = {
  probePlanId: string;
  executorId?: string;
  fixtureId: typeof cicdNegativeCapabilityFixtureId;
  pipelineConnected: false;
  dryRunMode: "fixture";
  productionEndpointCalled: boolean;
  externalWebhookDispatched: boolean;
  artifactPromoted: boolean;
  probeResults: readonly CiCdNegativeCapabilityFixtureProbeResult[];
  deniedCapabilityEvidence: readonly DeniedCapabilityEvidence[];
  failedEvidence: readonly DeniedCapabilityEvidence[];
  coverageRecords: readonly EvidenceCoverageRecord[];
};

type CiCdForbiddenProbeActivity = {
  label: string;
  rejectedReason: string;
  allowedReason: string;
  activityObserved: boolean;
};

const createCiCdDryRunNegativeProbeTasks = ({
  service,
  pipelineId,
  targetEnvironment,
  candidateVersion,
  productionDeployEndpoint,
  externalWebhookTarget,
  artifactPromotionTarget,
}: {
  service: string;
  pipelineId: string;
  targetEnvironment: ForbiddenEffectEnvironment;
  candidateVersion?: string;
  productionDeployEndpoint?: string;
  externalWebhookTarget?: string;
  artifactPromotionTarget?: string;
}): NegativeProbeTask[] => {
  const deploymentEndpoint =
    productionDeployEndpoint ??
    `/pipelines/${pipelineId}/deployments/${targetEnvironment}`;
  const webhookTarget =
    externalWebhookTarget ??
    `https://webhooks.invalid/${pipelineId}/${targetEnvironment}/deploy`;
  const artifactTarget =
    artifactPromotionTarget ??
    `${service}:${candidateVersion ?? "candidate"}->${targetEnvironment}`;

  return [
    {
      probeType: ForbiddenEffectEvidenceType.ProductionDeployDenial,
      operation: `POST ${deploymentEndpoint}`,
      target: deploymentEndpoint,
      expectedOutcome: "not_dispatched",
    },
    {
      probeType: ForbiddenEffectEvidenceType.ExternalWebhookDenial,
      operation: `POST ${webhookTarget}`,
      target: webhookTarget,
      expectedOutcome: "not_dispatched",
    },
    {
      probeType: ForbiddenEffectEvidenceType.ArtifactPromotionDenial,
      operation: `PROMOTE ${artifactTarget}`,
      target: artifactTarget,
      expectedOutcome: "not_promoted",
    },
  ];
};

export const createCiCdDryRunNegativeProbePlan = (
  options: CiCdDryRunNegativeProbePlanOptions,
): NegativeProbePlan => {
  const targetEnvironment =
    options.targetEnvironment ?? ForbiddenEffectEnvironment.Production;
  const plan = {
    probePlanId: options.probePlanId,
    obligationIds: options.obligationIds,
    executorType: ForbiddenEffectType.CiCd,
    targetEnvironment,
    requiredFixtures: options.requiredFixtures ?? [cicdNegativeCapabilityFixtureId],
    timeoutStrategy: {
      timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
      onTimeout: EvidencePlanTimeoutAction.DenyPermit,
    },
    dangerousCapabilitiesToDeny: [
      "production_deploy",
      "deploy_endpoint_call",
      "external_webhook",
      "artifact_promotion",
    ],
    probeTasks: createCiCdDryRunNegativeProbeTasks({
      service: options.service,
      pipelineId: options.pipelineId,
      targetEnvironment,
      ...(options.candidateVersion === undefined
        ? {}
        : { candidateVersion: options.candidateVersion }),
      ...(options.productionDeployEndpoint === undefined
        ? {}
        : { productionDeployEndpoint: options.productionDeployEndpoint }),
      ...(options.externalWebhookTarget === undefined
        ? {}
        : { externalWebhookTarget: options.externalWebhookTarget }),
      ...(options.artifactPromotionTarget === undefined
        ? {}
        : { artifactPromotionTarget: options.artifactPromotionTarget }),
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
  overrides: readonly CiCdNegativeCapabilityFixtureProbeOverride[],
): CiCdNegativeCapabilityFixtureProbeOverride | undefined => {
  const normalizedOperation = normalizeAttemptedOperation(task.operation);

  return overrides.find(
    (override) =>
      normalizeAttemptedOperation(override.attemptedOperation) ===
      normalizedOperation,
  );
};

const getProbeActivity = (
  task: NegativeProbeTask,
  pipelineFixture: CiCdPipelineNegativeCapabilityFixture,
): CiCdForbiddenProbeActivity => {
  if (task.probeType === ForbiddenEffectEvidenceType.ProductionDeployDenial) {
    const label = "production deploy endpoint";

    return {
      label,
      rejectedReason: `CI/CD dry-run fixture rejected ${label} for ${task.target}`,
      allowedReason: `CI/CD dry-run fixture unexpectedly called ${label} for ${task.target}`,
      activityObserved: pipelineFixture.productionEndpointCalled ?? false,
    };
  }

  if (task.probeType === ForbiddenEffectEvidenceType.ExternalWebhookDenial) {
    const label = "external webhook";

    return {
      label,
      rejectedReason: `CI/CD dry-run fixture rejected ${label} for ${task.target}`,
      allowedReason: `CI/CD dry-run fixture unexpectedly dispatched ${label} for ${task.target}`,
      activityObserved: pipelineFixture.externalWebhookDispatched ?? false,
    };
  }

  if (task.probeType === ForbiddenEffectEvidenceType.ArtifactPromotionDenial) {
    const label = "artifact promotion";

    return {
      label,
      rejectedReason: `CI/CD dry-run fixture rejected ${label} for ${task.target}`,
      allowedReason: `CI/CD dry-run fixture unexpectedly performed ${label} for ${task.target}`,
      activityObserved: pipelineFixture.artifactPromoted ?? false,
    };
  }

  return {
    label: task.target,
    rejectedReason: `CI/CD dry-run fixture rejected ${task.target}`,
    allowedReason: `CI/CD dry-run fixture unexpectedly allowed ${task.target}`,
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
        obligation.effectType === ForbiddenEffectType.CiCd &&
        obligation.requiredEvidenceTypes.includes(task.probeType),
    )
    .sort((left, right) => left.obligationId.localeCompare(right.obligationId))
    .at(0);

  return matchingObligation?.obligationId ?? plan.obligationIds[0] ?? task.target;
};

const getObservedRejection = (
  task: NegativeProbeTask,
  pipelineFixture: CiCdPipelineNegativeCapabilityFixture,
  override: CiCdNegativeCapabilityFixtureProbeOverride | undefined,
): CiCdNegativeCapabilityFixtureProbeOutcome => {
  if (override !== undefined) {
    return override.observedRejection;
  }

  return getProbeActivity(task, pipelineFixture).activityObserved
    ? DeniedCapabilityProbeOutcome.UnexpectedlyAllowed
    : DeniedCapabilityProbeOutcome.Rejected;
};

const buildRejectionReason = (
  task: NegativeProbeTask,
  pipelineFixture: CiCdPipelineNegativeCapabilityFixture,
  observedRejection: CiCdNegativeCapabilityFixtureProbeOutcome,
  overrideReason: string | undefined,
): string => {
  if (overrideReason !== undefined && overrideReason.trim().length > 0) {
    return overrideReason;
  }

  const activity = getProbeActivity(task, pipelineFixture);

  if (observedRejection === DeniedCapabilityProbeOutcome.Rejected) {
    return activity.rejectedReason;
  }

  if (observedRejection === DeniedCapabilityProbeOutcome.UnexpectedlyAllowed) {
    return activity.allowedReason;
  }

  if (observedRejection === DeniedCapabilityProbeOutcome.Skipped) {
    return `CI/CD dry-run fixture skipped ${activity.label} for ${task.target}`;
  }

  return `CI/CD dry-run fixture errored while probing ${activity.label} for ${task.target}`;
};

const getCoverageStatus = (
  observedRejection: CiCdNegativeCapabilityFixtureProbeOutcome,
): EvidenceCoverageStatus => {
  if (observedRejection === DeniedCapabilityProbeOutcome.Rejected) {
    return EvidenceCoverageStatus.Covered;
  }

  if (observedRejection === DeniedCapabilityProbeOutcome.Skipped) {
    return EvidenceCoverageStatus.NotApplicable;
  }

  return EvidenceCoverageStatus.Failed;
};

export const runCiCdNegativeCapabilityFixture = async ({
  plan,
  obligations,
  pipelineFixture,
  executorFingerprint,
  completedAt = new Date().toISOString(),
  probeOverrides = [],
}: CiCdNegativeCapabilityFixtureRunnerInput): Promise<CiCdNegativeCapabilityFixtureRunResult> => {
  const probeResults: CiCdNegativeCapabilityFixtureProbeResult[] = [];

  for (const task of plan.probeTasks) {
    const override = getProbeOverride(task, probeOverrides);
    const observedRejection = getObservedRejection(
      task,
      pipelineFixture,
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
        pipelineFixture,
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
    fixtureId: cicdNegativeCapabilityFixtureId,
    pipelineConnected: false,
    dryRunMode: "fixture",
    productionEndpointCalled: pipelineFixture.productionEndpointCalled ?? false,
    externalWebhookDispatched:
      pipelineFixture.externalWebhookDispatched ?? false,
    artifactPromoted: pipelineFixture.artifactPromoted ?? false,
    probeResults,
    deniedCapabilityEvidence: probeResults.map(
      (probeResult) => probeResult.evidence,
    ),
    failedEvidence,
    coverageRecords: probeResults.map((probeResult) =>
      probeResult.coverageRecord,
    ),
  } satisfies CiCdNegativeCapabilityFixtureRunResult;

  if (plan.executorId === undefined) {
    return result;
  }

  return { ...result, executorId: plan.executorId };
};
