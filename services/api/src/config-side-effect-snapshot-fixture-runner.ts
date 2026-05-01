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

const configSideEffectSnapshotFixtureId =
  "local_config_side_effect_snapshot_fixture";
const defaultTimeoutMs = 5_000;

const configSideEffectEvidenceTypes = new Set<ForbiddenEffectEvidenceType>([
  ForbiddenEffectEvidenceType.NoExternalSideEffect,
  ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
]);

type JsonObject = Record<string, unknown>;

export type ConfigNamespaceVersionState = {
  service: string;
  environment: string;
  namespace: string;
  entries: readonly JsonObject[];
  owner?: string;
  lastUpdatedAt?: string;
  version?: string;
};

export type ConfigSideEffectSnapshotFixtureState = {
  productionConfigVersion: ConfigNamespaceVersionState;
  sandboxConfigVersion: ConfigNamespaceVersionState;
};

export type ConfigStoreSideEffectSnapshotFixture = {
  service: string;
  environment: string;
  namespace: string;
  owner?: string;
  lastUpdatedAt?: string;
  entries: readonly JsonObject[];
};

export type ConfigSideEffectSnapshot = {
  productionConfigVersionHash: string;
  sandboxConfigVersionHash: string;
  snapshotHash: string;
};

export type ConfigSideEffectProbePlanOptions = {
  probePlanId: string;
  obligationIds: readonly string[];
  service: string;
  configKey: string;
  executorId?: string;
  targetEnvironment?: ForbiddenEffectEnvironment;
  requiredFixtures?: readonly string[];
  timeoutMs?: number;
  productionNamespace?: string;
  sandboxNamespace?: string;
  productionConfigTarget?: string;
  sandboxConfigTarget?: string;
  predictedEffectTypes?: readonly string[];
  forbiddenEffectTypes?: readonly string[];
};

export type ConfigSideEffectSnapshotFixtureRunnerInput = {
  plan: SideEffectProbePlan;
  obligations: readonly ForbiddenEffectObligation[];
  executorId?: string;
  executorFingerprint?: string;
  beforeSnapshot: ConfigSideEffectSnapshotFixtureState;
  afterSnapshot: ConfigSideEffectSnapshotFixtureState;
  completedAt?: ForbiddenSideEffectTimestamp;
};

export type ConfigSideEffectSnapshotFixtureEvidenceResult = {
  obligation: ForbiddenEffectObligation;
  requiredEvidenceType: ForbiddenEffectEvidenceType;
  evidence: SideEffectDeltaEvidence;
  evidenceHash: string;
  coverageRecord: EvidenceCoverageRecord;
};

export type ConfigSideEffectSnapshotFixtureRunResult = {
  probePlanId: string;
  executorId: string;
  fixtureId: typeof configSideEffectSnapshotFixtureId;
  configStoreConnected: false;
  dryRunMode: "fixture";
  beforeSnapshot: ConfigSideEffectSnapshot;
  afterSnapshot: ConfigSideEffectSnapshot;
  evidenceResults: readonly ConfigSideEffectSnapshotFixtureEvidenceResult[];
  sideEffectDeltaEvidence: readonly SideEffectDeltaEvidence[];
  failedEvidence: readonly SideEffectDeltaEvidence[];
  forbiddenEffectsObserved: readonly SideEffectObservedEvent[];
  coverageRecords: readonly EvidenceCoverageRecord[];
};

type ConfigSnapshotSegment = {
  evidenceType: SideEffectEvidenceType;
  target: string;
  beforeHash: string;
  afterHash: string;
  changeType: string;
  forbiddenEffectType: string;
  forbiddenEffect: boolean;
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

const createProductionConfigVersionState = (
  fixture: ConfigStoreSideEffectSnapshotFixture,
): ConfigNamespaceVersionState => ({
  service: fixture.service,
  environment: fixture.environment,
  namespace: fixture.namespace,
  entries: fixture.entries,
  ...(fixture.owner === undefined ? {} : { owner: fixture.owner }),
  ...(fixture.lastUpdatedAt === undefined
    ? {}
    : { lastUpdatedAt: fixture.lastUpdatedAt }),
});

const createSandboxConfigVersionState = (
  fixture: ConfigStoreSideEffectSnapshotFixture,
  sandboxNamespace: string,
): ConfigNamespaceVersionState => ({
  service: fixture.service,
  environment: ForbiddenEffectEnvironment.Development,
  namespace: sandboxNamespace,
  entries: [],
});

export const createConfigSideEffectSnapshotStateFromStoreFixture = (
  fixture: ConfigStoreSideEffectSnapshotFixture,
  options: { sandboxNamespace?: string } = {},
): ConfigSideEffectSnapshotFixtureState => {
  const sandboxNamespace =
    options.sandboxNamespace ?? `${fixture.service}-sandbox`;

  return {
    productionConfigVersion: createProductionConfigVersionState(fixture),
    sandboxConfigVersion: createSandboxConfigVersionState(
      fixture,
      sandboxNamespace,
    ),
  };
};

export const createConfigSideEffectSnapshot = (
  snapshot: ConfigSideEffectSnapshotFixtureState,
): ConfigSideEffectSnapshot => {
  const productionConfigVersionHash = createSha256Hash({
    schema:
      "agent-safety-gateway.config-side-effect-snapshot.production-config-version.v1",
    productionConfigVersion: snapshot.productionConfigVersion,
  });
  const sandboxConfigVersionHash = createSha256Hash({
    schema:
      "agent-safety-gateway.config-side-effect-snapshot.sandbox-config-version.v1",
    sandboxConfigVersion: snapshot.sandboxConfigVersion,
  });
  const snapshotHash = createSha256Hash({
    schema: "agent-safety-gateway.config-side-effect-snapshot.combined.v1",
    productionConfigVersionHash,
    sandboxConfigVersionHash,
  });

  return {
    productionConfigVersionHash,
    sandboxConfigVersionHash,
    snapshotHash,
  };
};

export const createConfigSideEffectProbePlan = (
  options: ConfigSideEffectProbePlanOptions,
): SideEffectProbePlan => {
  const targetEnvironment =
    options.targetEnvironment ?? ForbiddenEffectEnvironment.Production;
  const productionNamespace =
    options.productionNamespace ?? ForbiddenEffectEnvironment.Production;
  const sandboxNamespace =
    options.sandboxNamespace ?? `${options.service}-sandbox`;
  const plan = {
    probePlanId: options.probePlanId,
    obligationIds: options.obligationIds,
    executorType: ForbiddenEffectType.Config,
    targetEnvironment,
    requiredFixtures: options.requiredFixtures ?? [
      configSideEffectSnapshotFixtureId,
    ],
    timeoutStrategy: {
      timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
      onTimeout: EvidencePlanTimeoutAction.DenyPermit,
    },
    predictedEffectTypes: options.predictedEffectTypes ?? [
      "sandbox_config_write",
    ],
    forbiddenEffectTypes: options.forbiddenEffectTypes ?? [
      "production_config_write",
      "cross_namespace_config_mutation",
    ],
    snapshotTargets: [
      options.productionConfigTarget ??
        `config-store/${productionNamespace}/${options.service}/${options.configKey}:production_config_version`,
      options.sandboxConfigTarget ??
        `config-store/${sandboxNamespace}/${options.service}/${options.configKey}:sandbox_config_version`,
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
  plan.executorId ?? executorId ?? "config-side-effect-snapshot-fixture-executor";

const getPlannedConfigObligations = (
  plan: SideEffectProbePlan,
  obligations: readonly ForbiddenEffectObligation[],
): ForbiddenEffectObligation[] => {
  const planObligationIds = new Set(plan.obligationIds);

  return obligations
    .filter(
      (obligation) =>
        planObligationIds.has(obligation.obligationId) &&
        obligation.effectType === ForbiddenEffectType.Config,
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
  beforeSnapshot: ConfigSideEffectSnapshot,
  afterSnapshot: ConfigSideEffectSnapshot,
): ConfigSnapshotSegment[] => [
  {
    evidenceType: SideEffectEvidenceType.ConfigVersion,
    target: getSnapshotTarget(plan, "production_config_version"),
    beforeHash: beforeSnapshot.productionConfigVersionHash,
    afterHash: afterSnapshot.productionConfigVersionHash,
    changeType: "production_config_version_delta_detected",
    forbiddenEffectType: "production_config_write",
    forbiddenEffect: true,
  },
  {
    evidenceType: SideEffectEvidenceType.ConfigVersion,
    target: getSnapshotTarget(plan, "sandbox_config_version"),
    beforeHash: beforeSnapshot.sandboxConfigVersionHash,
    afterHash: afterSnapshot.sandboxConfigVersionHash,
    changeType: "sandbox_config_version_delta_detected",
    forbiddenEffectType: "sandbox_config_write",
    forbiddenEffect: false,
  },
];

const getSegmentsForRequiredEvidenceType = (
  requiredEvidenceType: ForbiddenEffectEvidenceType,
  segments: readonly ConfigSnapshotSegment[],
): ConfigSnapshotSegment[] | undefined => {
  if (requiredEvidenceType === ForbiddenEffectEvidenceType.NoExternalSideEffect) {
    return [...segments];
  }

  if (
    requiredEvidenceType ===
    ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial
  ) {
    return segments.filter((segment) => segment.forbiddenEffect);
  }

  return undefined;
};

const buildDeltaChange = (
  segment: ConfigSnapshotSegment,
): SideEffectDeltaChange => ({
  evidenceType: segment.evidenceType,
  target: segment.target,
  beforeHash: segment.beforeHash,
  afterHash: segment.afterHash,
  changeType: segment.changeType,
});

const buildObservedEvent = (
  segment: ConfigSnapshotSegment,
  completedAt: ForbiddenSideEffectTimestamp,
): SideEffectObservedEvent => ({
  evidenceType: segment.evidenceType,
  target: segment.target,
  eventHash: createSha256Hash({
    schema: "agent-safety-gateway.config-side-effect-snapshot.delta-event.v1",
    evidenceType: segment.evidenceType,
    target: segment.target,
    beforeHash: segment.beforeHash,
    afterHash: segment.afterHash,
    changeType: segment.changeType,
    forbiddenEffectType: segment.forbiddenEffectType,
  }),
  observedAt: completedAt,
});

const buildFailureReason = (
  segments: readonly ConfigSnapshotSegment[],
): string => {
  const forbiddenEffects = segments
    .map((segment) => segment.forbiddenEffectType)
    .join(", ");
  const targets = segments.map((segment) => segment.target).join(", ");

  return `config sandbox fixture observed ${forbiddenEffects} on ${targets}`;
};

const uniqueObservedEvents = (
  events: readonly SideEffectObservedEvent[],
): SideEffectObservedEvent[] => {
  const seenEventHashes = new Set<string>();
  const uniqueEvents: SideEffectObservedEvent[] = [];

  for (const event of events) {
    if (seenEventHashes.has(event.eventHash)) {
      continue;
    }

    seenEventHashes.add(event.eventHash);
    uniqueEvents.push(event);
  }

  return uniqueEvents;
};

export const runConfigSideEffectSnapshotFixture = async ({
  plan,
  obligations,
  executorId,
  executorFingerprint,
  beforeSnapshot: beforeSnapshotState,
  afterSnapshot: afterSnapshotState,
  completedAt = new Date().toISOString(),
}: ConfigSideEffectSnapshotFixtureRunnerInput): Promise<ConfigSideEffectSnapshotFixtureRunResult> => {
  const resolvedExecutorId = getExecutorId(plan, executorId);
  const beforeSnapshot = createConfigSideEffectSnapshot(beforeSnapshotState);
  const afterSnapshot = createConfigSideEffectSnapshot(afterSnapshotState);
  const allSegments = buildSnapshotSegments(plan, beforeSnapshot, afterSnapshot);
  const evidenceResults: ConfigSideEffectSnapshotFixtureEvidenceResult[] = [];

  for (const obligation of getPlannedConfigObligations(plan, obligations)) {
    const requiredSideEffectEvidence = obligation.requiredEvidenceTypes.filter(
      (requiredEvidenceType) =>
        configSideEffectEvidenceTypes.has(requiredEvidenceType),
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
      const forbiddenChangedSegments = changedSegments.filter(
        (segment) => segment.forbiddenEffect,
      );
      const effectDelta = changedSegments.map(buildDeltaChange);
      const observedEvents = changedSegments.map((segment) =>
        buildObservedEvent(segment, completedAt),
      );
      const forbiddenEffectsObserved = observedEvents.filter((event) =>
        forbiddenChangedSegments.some((segment) => segment.target === event.target),
      );
      const evidence: SideEffectDeltaEvidence = {
        probeId: plan.probePlanId,
        obligationId: obligation.obligationId,
        executorId: resolvedExecutorId,
        beforeSnapshotHash: beforeSnapshot.snapshotHash,
        afterSnapshotHash: afterSnapshot.snapshotHash,
        observedEvents,
        forbiddenEffectsObserved,
        effectDelta,
        completedAt,
        ...(executorFingerprint === undefined ? {} : { executorFingerprint }),
      };
      const evidenceHash = await createSideEffectDeltaEvidenceHash(evidence);
      const failed = forbiddenChangedSegments.length > 0;
      const status = failed
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
        ...(failed
          ? { failureReason: buildFailureReason(forbiddenChangedSegments) }
          : {}),
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
  const forbiddenEffectsObserved = uniqueObservedEvents(
    evidenceResults.flatMap((result) => result.evidence.forbiddenEffectsObserved),
  );

  return {
    probePlanId: plan.probePlanId,
    executorId: resolvedExecutorId,
    fixtureId: configSideEffectSnapshotFixtureId,
    configStoreConnected: false,
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
