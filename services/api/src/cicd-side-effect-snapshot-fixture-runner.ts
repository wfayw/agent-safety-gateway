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

const cicdSideEffectSnapshotFixtureId =
  "local_cicd_side_effect_snapshot_fixture";
const defaultTimeoutMs = 5_000;

const cicdSideEffectEvidenceTypes = new Set<ForbiddenEffectEvidenceType>([
  ForbiddenEffectEvidenceType.NoExternalSideEffect,
  ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
]);

type JsonObject = Record<string, unknown>;

export type CiCdSideEffectSnapshotFixtureState = {
  deployLogs: readonly JsonObject[];
  webhookLogs: readonly JsonObject[];
  artifactPromotionState: JsonObject;
  environmentVersionState: JsonObject;
};

export type CiCdPipelineSideEffectSnapshotFixture = {
  pipelineId: string;
  service: string;
  environment: string;
  candidateVersion?: string;
  currentVersion?: string;
  deployLogs?: readonly JsonObject[];
  webhookLogs?: readonly JsonObject[];
  artifactPromotionState?: JsonObject;
  environmentVersionState?: JsonObject;
};

export type CiCdSideEffectSnapshot = {
  deployLogsHash: string;
  webhookLogsHash: string;
  artifactPromotionStateHash: string;
  environmentVersionStateHash: string;
  snapshotHash: string;
};

export type CiCdSideEffectProbePlanOptions = {
  probePlanId: string;
  obligationIds: readonly string[];
  service: string;
  pipelineId: string;
  executorId?: string;
  targetEnvironment?: ForbiddenEffectEnvironment;
  requiredFixtures?: readonly string[];
  timeoutMs?: number;
  candidateVersion?: string;
  deployLogsTarget?: string;
  webhookLogsTarget?: string;
  artifactPromotionTarget?: string;
  environmentVersionTarget?: string;
  predictedEffectTypes?: readonly string[];
  forbiddenEffectTypes?: readonly string[];
};

export type CiCdSideEffectSnapshotFixtureRunnerInput = {
  plan: SideEffectProbePlan;
  obligations: readonly ForbiddenEffectObligation[];
  executorId?: string;
  executorFingerprint?: string;
  beforeSnapshot: CiCdSideEffectSnapshotFixtureState;
  afterSnapshot: CiCdSideEffectSnapshotFixtureState;
  completedAt?: ForbiddenSideEffectTimestamp;
};

export type CiCdSideEffectSnapshotFixtureEvidenceResult = {
  obligation: ForbiddenEffectObligation;
  requiredEvidenceType: ForbiddenEffectEvidenceType;
  evidence: SideEffectDeltaEvidence;
  evidenceHash: string;
  coverageRecord: EvidenceCoverageRecord;
};

export type CiCdSideEffectSnapshotFixtureRunResult = {
  probePlanId: string;
  executorId: string;
  fixtureId: typeof cicdSideEffectSnapshotFixtureId;
  pipelineConnected: false;
  dryRunMode: "fixture";
  beforeSnapshot: CiCdSideEffectSnapshot;
  afterSnapshot: CiCdSideEffectSnapshot;
  evidenceResults: readonly CiCdSideEffectSnapshotFixtureEvidenceResult[];
  sideEffectDeltaEvidence: readonly SideEffectDeltaEvidence[];
  failedEvidence: readonly SideEffectDeltaEvidence[];
  forbiddenEffectsObserved: readonly SideEffectObservedEvent[];
  coverageRecords: readonly EvidenceCoverageRecord[];
};

type CiCdSnapshotSegment = {
  evidenceType: SideEffectEvidenceType;
  target: string;
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

const createDefaultArtifactPromotionState = (
  fixture: CiCdPipelineSideEffectSnapshotFixture,
): JsonObject => ({
  pipelineId: fixture.pipelineId,
  service: fixture.service,
  environment: fixture.environment,
  candidateVersion: fixture.candidateVersion ?? null,
  promoted: false,
  promotedVersion: null,
});

const createDefaultEnvironmentVersionState = (
  fixture: CiCdPipelineSideEffectSnapshotFixture,
): JsonObject => ({
  service: fixture.service,
  environment: fixture.environment,
  currentVersion: fixture.currentVersion ?? null,
  candidateVersion: fixture.candidateVersion ?? null,
});

export const createCiCdSideEffectSnapshotStateFromPipelineFixture = (
  fixture: CiCdPipelineSideEffectSnapshotFixture,
): CiCdSideEffectSnapshotFixtureState => ({
  deployLogs: fixture.deployLogs ?? [],
  webhookLogs: fixture.webhookLogs ?? [],
  artifactPromotionState:
    fixture.artifactPromotionState ?? createDefaultArtifactPromotionState(fixture),
  environmentVersionState:
    fixture.environmentVersionState ??
    createDefaultEnvironmentVersionState(fixture),
});

export const createCiCdSideEffectSnapshot = (
  snapshot: CiCdSideEffectSnapshotFixtureState,
): CiCdSideEffectSnapshot => {
  const deployLogsHash = createSha256Hash({
    schema: "agent-safety-gateway.cicd-side-effect-snapshot.deploy-logs.v1",
    deployLogs: snapshot.deployLogs,
  });
  const webhookLogsHash = createSha256Hash({
    schema: "agent-safety-gateway.cicd-side-effect-snapshot.webhook-logs.v1",
    webhookLogs: snapshot.webhookLogs,
  });
  const artifactPromotionStateHash = createSha256Hash({
    schema:
      "agent-safety-gateway.cicd-side-effect-snapshot.artifact-promotion-state.v1",
    artifactPromotionState: snapshot.artifactPromotionState,
  });
  const environmentVersionStateHash = createSha256Hash({
    schema:
      "agent-safety-gateway.cicd-side-effect-snapshot.environment-version-state.v1",
    environmentVersionState: snapshot.environmentVersionState,
  });
  const snapshotHash = createSha256Hash({
    schema: "agent-safety-gateway.cicd-side-effect-snapshot.combined.v1",
    deployLogsHash,
    webhookLogsHash,
    artifactPromotionStateHash,
    environmentVersionStateHash,
  });

  return {
    deployLogsHash,
    webhookLogsHash,
    artifactPromotionStateHash,
    environmentVersionStateHash,
    snapshotHash,
  };
};

export const createCiCdSideEffectProbePlan = (
  options: CiCdSideEffectProbePlanOptions,
): SideEffectProbePlan => {
  const targetEnvironment =
    options.targetEnvironment ?? ForbiddenEffectEnvironment.Production;
  const candidateVersion = options.candidateVersion ?? "candidate";
  const plan = {
    probePlanId: options.probePlanId,
    obligationIds: options.obligationIds,
    executorType: ForbiddenEffectType.CiCd,
    targetEnvironment,
    requiredFixtures: options.requiredFixtures ?? [
      cicdSideEffectSnapshotFixtureId,
    ],
    timeoutStrategy: {
      timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
      onTimeout: EvidencePlanTimeoutAction.DenyPermit,
    },
    predictedEffectTypes: options.predictedEffectTypes ?? [
      "dry_run_release_plan",
    ],
    forbiddenEffectTypes: options.forbiddenEffectTypes ?? [
      "production_deploy",
      "external_webhook",
      "artifact_promotion",
      "environment_mutation",
    ],
    snapshotTargets: [
      options.deployLogsTarget ?? `${options.pipelineId}:deploy_logs`,
      options.webhookLogsTarget ?? `${options.pipelineId}:webhook_logs`,
      options.artifactPromotionTarget ??
        `artifact-registry/${options.service}:${candidateVersion}:${targetEnvironment}:artifact_promotion_state`,
      options.environmentVersionTarget ??
        `environment/${options.service}:${targetEnvironment}:environment_version_state`,
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
  plan.executorId ?? executorId ?? "cicd-side-effect-snapshot-fixture-executor";

const getPlannedCiCdObligations = (
  plan: SideEffectProbePlan,
  obligations: readonly ForbiddenEffectObligation[],
): ForbiddenEffectObligation[] => {
  const planObligationIds = new Set(plan.obligationIds);

  return obligations
    .filter(
      (obligation) =>
        planObligationIds.has(obligation.obligationId) &&
        obligation.effectType === ForbiddenEffectType.CiCd,
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
  beforeSnapshot: CiCdSideEffectSnapshot,
  afterSnapshot: CiCdSideEffectSnapshot,
): CiCdSnapshotSegment[] => [
  {
    evidenceType: SideEffectEvidenceType.DeployLog,
    target: getSnapshotTarget(plan, "deploy_logs"),
    beforeHash: beforeSnapshot.deployLogsHash,
    afterHash: afterSnapshot.deployLogsHash,
    changeType: "production_deploy_log_delta_detected",
    forbiddenEffectType: "production_deploy",
  },
  {
    evidenceType: SideEffectEvidenceType.Webhook,
    target: getSnapshotTarget(plan, "webhook_logs"),
    beforeHash: beforeSnapshot.webhookLogsHash,
    afterHash: afterSnapshot.webhookLogsHash,
    changeType: "external_webhook_log_delta_detected",
    forbiddenEffectType: "external_webhook",
  },
  {
    evidenceType: SideEffectEvidenceType.Artifact,
    target: getSnapshotTarget(plan, "artifact_promotion_state"),
    beforeHash: beforeSnapshot.artifactPromotionStateHash,
    afterHash: afterSnapshot.artifactPromotionStateHash,
    changeType: "artifact_promotion_state_delta_detected",
    forbiddenEffectType: "artifact_promotion",
  },
  {
    evidenceType: SideEffectEvidenceType.ConfigVersion,
    target: getSnapshotTarget(plan, "environment_version_state"),
    beforeHash: beforeSnapshot.environmentVersionStateHash,
    afterHash: afterSnapshot.environmentVersionStateHash,
    changeType: "environment_version_state_delta_detected",
    forbiddenEffectType: "environment_mutation",
  },
];

const getSegmentsForRequiredEvidenceType = (
  requiredEvidenceType: ForbiddenEffectEvidenceType,
  segments: readonly CiCdSnapshotSegment[],
): CiCdSnapshotSegment[] | undefined => {
  if (requiredEvidenceType === ForbiddenEffectEvidenceType.NoExternalSideEffect) {
    return segments.filter(
      (segment) => segment.evidenceType !== SideEffectEvidenceType.ConfigVersion,
    );
  }

  if (
    requiredEvidenceType ===
    ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial
  ) {
    return segments.filter(
      (segment) => segment.evidenceType === SideEffectEvidenceType.ConfigVersion,
    );
  }

  return undefined;
};

const buildDeltaChange = (
  segment: CiCdSnapshotSegment,
): SideEffectDeltaChange => ({
  evidenceType: segment.evidenceType,
  target: segment.target,
  beforeHash: segment.beforeHash,
  afterHash: segment.afterHash,
  changeType: segment.changeType,
});

const buildObservedEvent = (
  segment: CiCdSnapshotSegment,
  completedAt: ForbiddenSideEffectTimestamp,
): SideEffectObservedEvent => ({
  evidenceType: segment.evidenceType,
  target: segment.target,
  eventHash: createSha256Hash({
    schema: "agent-safety-gateway.cicd-side-effect-snapshot.delta-event.v1",
    evidenceType: segment.evidenceType,
    target: segment.target,
    beforeHash: segment.beforeHash,
    afterHash: segment.afterHash,
    changeType: segment.changeType,
    forbiddenEffectType: segment.forbiddenEffectType,
  }),
  observedAt: completedAt,
});

const buildFailureReason = (segments: readonly CiCdSnapshotSegment[]): string => {
  const forbiddenEffects = segments
    .map((segment) => segment.forbiddenEffectType)
    .join(", ");
  const targets = segments.map((segment) => segment.target).join(", ");

  return `CI/CD dry-run fixture observed ${forbiddenEffects} on ${targets}`;
};

export const runCiCdSideEffectSnapshotFixture = async ({
  plan,
  obligations,
  executorId,
  executorFingerprint,
  beforeSnapshot: beforeSnapshotState,
  afterSnapshot: afterSnapshotState,
  completedAt = new Date().toISOString(),
}: CiCdSideEffectSnapshotFixtureRunnerInput): Promise<CiCdSideEffectSnapshotFixtureRunResult> => {
  const resolvedExecutorId = getExecutorId(plan, executorId);
  const beforeSnapshot = createCiCdSideEffectSnapshot(beforeSnapshotState);
  const afterSnapshot = createCiCdSideEffectSnapshot(afterSnapshotState);
  const allSegments = buildSnapshotSegments(plan, beforeSnapshot, afterSnapshot);
  const evidenceResults: CiCdSideEffectSnapshotFixtureEvidenceResult[] = [];

  for (const obligation of getPlannedCiCdObligations(plan, obligations)) {
    const requiredSideEffectEvidence = obligation.requiredEvidenceTypes.filter(
      (requiredEvidenceType) =>
        cicdSideEffectEvidenceTypes.has(requiredEvidenceType),
    );

    for (const requiredEvidenceType of requiredSideEffectEvidence) {
      const segments = getSegmentsForRequiredEvidenceType(
        requiredEvidenceType,
        allSegments,
      );

      if (segments === undefined || segments.length === 0) {
        continue;
      }

      const changedSegments = segments.filter(
        (segment) => segment.beforeHash !== segment.afterHash,
      );
      const effectDelta = changedSegments.map(buildDeltaChange);
      const forbiddenEffectsObserved = changedSegments.map((segment) =>
        buildObservedEvent(segment, completedAt),
      );
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
      const changed = changedSegments.length > 0;
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
        ...(changed ? { failureReason: buildFailureReason(changedSegments) } : {}),
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
    fixtureId: cicdSideEffectSnapshotFixtureId,
    pipelineConnected: false,
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
