import { createHash, randomUUID } from "node:crypto";

import {
  type AuditExecutorSafetyEvidence,
  DecisionType,
  type ExecutionDecision,
  type JsonValue,
  RiskLevel,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";
import {
  EvidenceCoverageStatus,
  ExecutorSafetyEvidenceStateName,
  ForbiddenEffectEvidenceType,
  type EvidenceCoverageEntry,
  type EvidenceCoverageMap,
  type ExecutorSafetyEvidenceState,
  type ForbiddenEffectObligation,
  type ForbiddenEffectEvidenceType as ForbiddenEffectEvidenceTypeValue,
  type PermitBinding,
  type PermitDeniedEvidence,
} from "@agent-safety-gateway/shared/forbidden-side-effect";
import {
  ContextSufficiencyStateName,
  type ContextSufficiencyState,
} from "@agent-safety-gateway/shared/context-retention";
import type { PatentProofHash } from "@agent-safety-gateway/shared/patent-state-machine";

import {
  AdapterHealthStatus,
  ApprovalRequestStatus,
  createNotConfiguredExternalAuditSinkResult,
  type ApprovalRequest,
  type ExternalApprovalAdapter,
  type ExternalAuditSinkAdapter,
  type ExternalAuditSinkInput,
  type ExternalAuditSinkResult,
  type RealComponentEvidence,
} from "./real-component-adapters.js";
import {
  redactSensitiveAuditFields,
  type AuditRedactionOptions,
} from "./audit-redaction.js";
import {
  createToolCallRequestHash,
  createToolExecutorBroker,
} from "./tool-executor-broker.js";
import type {
  ToolCallAnalysisResult,
  ToolCallAnalysisService,
} from "./tool-call-analysis-service.js";
import type { AuditRepository } from "./audit-repository.js";
import {
  ContextGatewayActionType,
  createContextExecutionDecisionEngine,
  type ContextExecutionDecision,
  type ContextExecutionDecisionEngine,
  type ContextGatewayAction,
} from "./context-execution-decision-engine.js";

export type ToolExecutor<ExecutorResult> = (
  request: ToolCallRequest,
  analysisResult: ToolCallAnalysisResult,
) => ExecutorResult | Promise<ExecutorResult>;

export type GuardedExecutionStatus =
  | "executed"
  | "blocked"
  | "held"
  | "not_configured";

export type GuardedExecutionResult<ExecutorResult> = {
  status: GuardedExecutionStatus;
  requestId: string;
  executorInvoked: boolean;
  riskLevel: ToolCallAnalysisResult["riskLevel"];
  decision: ToolCallAnalysisResult["executionDecision"];
  contextSufficiencyState: ContextSufficiencyState | null;
  contextAction: ContextGatewayAction | null;
  auditId: string;
  analysisResult: ToolCallAnalysisResult;
  executorResult: ExecutorResult | null;
  approvalRequest: ApprovalRequest | null;
  permitBinding: PermitBinding | null;
  permitDeniedEvidence: PermitDeniedEvidence | null;
  auditSinkResult: ExternalAuditSinkResult;
};

export type ToolExecutionGuard<ExecutorResult> = {
  execute: (
    request: ToolCallRequest,
  ) => Promise<GuardedExecutionResult<ExecutorResult>>;
};

export type ToolExecutionPermitEvidenceInput = {
  request: ToolCallRequest;
  analysisResult: ToolCallAnalysisResult;
};

export type ToolExecutionPermitEvidenceSnapshot = {
  safetyState: ExecutorSafetyEvidenceState | null;
  coverageMap?: EvidenceCoverageMap;
  forbiddenEffectObligations?: readonly ForbiddenEffectObligation[];
  deniedEvidenceHash?: PatentProofHash;
  sideEffectEvidenceHash?: PatentProofHash;
};

export type ToolExecutionPermitRecordInput = ToolExecutionPermitEvidenceInput & {
  permitBinding: PermitBinding;
};

export type ToolExecutionPermitDeniedRecordInput = ToolExecutionPermitEvidenceInput & {
  permitDeniedEvidence: PermitDeniedEvidence;
};

export type ToolExecutionPermitEvidenceProvider = {
  getEvidenceSnapshot: (
    input: ToolExecutionPermitEvidenceInput,
  ) =>
    | ToolExecutionPermitEvidenceSnapshot
    | null
    | Promise<ToolExecutionPermitEvidenceSnapshot | null>;
  appendPermitBinding?: (
    input: ToolExecutionPermitRecordInput,
  ) => Promise<void> | void;
  appendPermitDeniedEvidence?: (
    input: ToolExecutionPermitDeniedRecordInput,
  ) => Promise<void> | void;
};

export type ToolExecutionContextEvidenceInput = ToolExecutionPermitEvidenceInput;

export type ToolExecutionContextEvidenceSnapshot = {
  contextSufficiencyState: ContextSufficiencyState;
  contextAdequacyEvidenceHash?: PatentProofHash;
};

export type ToolExecutionContextEvidenceResult =
  | ContextSufficiencyState
  | ToolExecutionContextEvidenceSnapshot;

export type ToolExecutionContextEvidenceProvider = {
  getContextSufficiencyState: (
    input: ToolExecutionContextEvidenceInput,
  ) =>
    | ToolExecutionContextEvidenceResult
    | null
    | Promise<ToolExecutionContextEvidenceResult | null>;
};

export type ToolExecutionGuardDependencies<ExecutorResult> = {
  analysisService: ToolCallAnalysisService;
  executor?: ToolExecutor<ExecutorResult>;
  executorId?: string;
  approvalAdapter?: Pick<
    ExternalApprovalAdapter,
    "createApprovalRequest" | "getApprovalRequest"
  >;
  auditSinkAdapter?: Pick<
    ExternalAuditSinkAdapter,
    "appendControlEvidence" | "health"
  >;
  auditSinkStrict?: boolean;
  auditRedaction?: AuditRedactionOptions;
  auditRepository?: Pick<AuditRepository, "updateAuditExecutorSafetyEvidence">;
  contextEvidenceProvider?: ToolExecutionContextEvidenceProvider;
  contextDecisionEngine?: ContextExecutionDecisionEngine;
  permitEvidenceProvider?: ToolExecutionPermitEvidenceProvider;
  permitNonceFactory?: () => string;
  permitTtlMs?: number;
  defaultApproverGroup?: string;
  now?: () => Date;
};

const DEFAULT_APPROVER_GROUP = "risk-owners";

const getPreventedStatus = (analysisResult: ToolCallAnalysisResult) =>
  analysisResult.executionDecision.type === DecisionType.Block ||
  analysisResult.riskLevel === RiskLevel.Prohibited
    ? "blocked"
    : "held";

const canInvokeExecutor = (analysisResult: ToolCallAnalysisResult) =>
  analysisResult.executionDecision.type === DecisionType.Allow &&
  analysisResult.riskLevel !== RiskLevel.Prohibited;

const requiresApproval = (analysisResult: ToolCallAnalysisResult) =>
  analysisResult.executionDecision.type === DecisionType.RequireApproval &&
  analysisResult.riskLevel !== RiskLevel.Prohibited;

const isApproved = (approvalRequest: ApprovalRequest | null) =>
  approvalRequest?.status === ApprovalRequestStatus.Approved;

const DEFAULT_AUDIT_SINK_REQUIREMENTS = [
  "external audit sink adapter",
  "durable external audit write target",
];

const DEFAULT_PERMIT_TTL_MS = 5 * 60 * 1000;

const FORBIDDEN_SIDE_EFFECT_PERMIT_SCHEMA =
  "agent-safety-gateway.forbidden-side-effect.ToolExecutionGuardPermit.v1";

const SIDE_EFFECT_COVERAGE_TYPES: ReadonlySet<ForbiddenEffectEvidenceTypeValue> =
  new Set([
    ForbiddenEffectEvidenceType.NoRowMutation,
    ForbiddenEffectEvidenceType.NoTriggerSideEffect,
    ForbiddenEffectEvidenceType.NoExternalSideEffect,
  ]);

const CONTEXT_REQUIRED_PERMIT_RISK_LEVELS: ReadonlySet<
  ToolCallAnalysisResult["riskLevel"]
> = new Set([RiskLevel.High]);

const isTimestampAtOrBefore = (
  timestamp: string | undefined,
  evaluatedAt: string,
) => timestamp !== undefined && timestamp <= evaluatedAt;

const createProofHash = (payload: unknown): PatentProofHash =>
  `sha256:${createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")}`;

const createCoverageMapHash = ({
  safetyState,
  coverageMap,
}: {
  safetyState: ExecutorSafetyEvidenceState;
  coverageMap: EvidenceCoverageMap | undefined;
}): PatentProofHash =>
  safetyState.coverageMapHash ??
  createProofHash({
    schema: `${FORBIDDEN_SIDE_EFFECT_PERMIT_SCHEMA}.CoverageMap`,
    coverageMapId: safetyState.coverageMapId,
    coverageMap: coverageMap ?? null,
  });

const getSnapshotCoverageMapHash = (
  snapshot: ToolExecutionPermitEvidenceSnapshot | null,
) => {
  if (!snapshot?.safetyState) {
    return null;
  }

  return createCoverageMapHash({
    safetyState: snapshot.safetyState,
    coverageMap: snapshot.coverageMap,
  });
};

const getCoverageEntries = (
  coverageMap: EvidenceCoverageMap | undefined,
): readonly EvidenceCoverageEntry[] => coverageMap?.coverage ?? [];

const createAggregateEvidenceHash = ({
  coverageMap,
  safetyState,
  evidenceKind,
  filter,
}: {
  coverageMap: EvidenceCoverageMap | undefined;
  safetyState: ExecutorSafetyEvidenceState;
  evidenceKind: "denied-capability" | "side-effect";
  filter: (entry: EvidenceCoverageEntry) => boolean;
}): PatentProofHash => {
  const evidenceHashes = getCoverageEntries(coverageMap)
    .filter(filter)
    .flatMap((entry) => entry.evidenceHashes)
    .sort();

  return createProofHash({
    schema: `${FORBIDDEN_SIDE_EFFECT_PERMIT_SCHEMA}.AggregateEvidence`,
    evidenceKind,
    safetyStateId: safetyState.stateId,
    coverageMapId: safetyState.coverageMapId,
    evidenceHashes,
  });
};

const getMissingOrFailedEvidenceTypes = ({
  coverageMap,
  evaluatedAt,
}: {
  coverageMap: EvidenceCoverageMap | undefined;
  evaluatedAt: string;
}): readonly ForbiddenEffectEvidenceTypeValue[] =>
  Array.from(
    new Set(
      getCoverageEntries(coverageMap)
        .filter(
          (entry) =>
            entry.status !== EvidenceCoverageStatus.Covered ||
            isTimestampAtOrBefore(entry.expiresAt, evaluatedAt),
        )
        .map((entry) => entry.requiredEvidenceType),
    ),
  ).sort();

const getInvalidatedEvidenceHashes = ({
  coverageMap,
  evaluatedAt,
}: {
  coverageMap: EvidenceCoverageMap | undefined;
  evaluatedAt: string;
}): readonly PatentProofHash[] =>
  Array.from(
    new Set(
      getCoverageEntries(coverageMap)
        .filter(
          (entry) =>
            entry.status === EvidenceCoverageStatus.Invalidated ||
            isTimestampAtOrBefore(entry.invalidatedAt, evaluatedAt),
        )
        .flatMap((entry) => entry.evidenceHashes),
    ),
  ).sort();

const getPermitDenialReason = ({
  safetyState,
  evaluatedAt,
}: {
  safetyState: ExecutorSafetyEvidenceState | null;
  evaluatedAt: string;
}) => {
  if (!safetyState) {
    return "executor safety evidence state is missing";
  }

  if (safetyState.state === ExecutorSafetyEvidenceStateName.EvidenceExpired) {
    return safetyState.transitionReason;
  }

  if (isTimestampAtOrBefore(safetyState.validUntil, evaluatedAt)) {
    return `executor safety evidence expired at ${safetyState.validUntil}`;
  }

  if (safetyState.state === ExecutorSafetyEvidenceStateName.EvidenceInvalidated) {
    return safetyState.transitionReason;
  }

  if (safetyState.invalidatedBy !== undefined) {
    return `executor safety evidence was invalidated by ${safetyState.invalidatedBy}`;
  }

  if (safetyState.state !== ExecutorSafetyEvidenceStateName.EvidenceComplete) {
    return safetyState.transitionReason;
  }

  if (!safetyState.allObligationsCovered) {
    return "executor safety evidence is incomplete for one or more obligations";
  }

  return "executor safety evidence is not permit bindable";
};

const canBindPermit = (
  safetyState: ExecutorSafetyEvidenceState | null,
  evaluatedAt: string,
): safetyState is ExecutorSafetyEvidenceState =>
  safetyState !== null &&
  safetyState.state === ExecutorSafetyEvidenceStateName.EvidenceComplete &&
  safetyState.allObligationsCovered &&
  safetyState.invalidatedBy === undefined &&
  !isTimestampAtOrBefore(safetyState.validUntil, evaluatedAt);

const getPermitBindingTtl = ({
  safetyState,
  evaluatedAt,
  defaultTtlMs,
}: {
  safetyState: ExecutorSafetyEvidenceState;
  evaluatedAt: string;
  defaultTtlMs: number;
}) => {
  if (safetyState.validUntil === undefined) {
    return Math.max(1, defaultTtlMs);
  }

  const validUntilMs = Date.parse(safetyState.validUntil);
  const evaluatedAtMs = Date.parse(evaluatedAt);

  if (Number.isNaN(validUntilMs) || Number.isNaN(evaluatedAtMs)) {
    return Math.max(1, defaultTtlMs);
  }

  return Math.max(1, validUntilMs - evaluatedAtMs);
};

const createPermitBinding = ({
  request,
  snapshot,
  safetyState,
  evaluatedAt,
  contextAdequacyEvidenceHash,
  nonce,
  defaultTtlMs,
}: {
  request: ToolCallRequest;
  snapshot: ToolExecutionPermitEvidenceSnapshot;
  safetyState: ExecutorSafetyEvidenceState;
  evaluatedAt: string;
  contextAdequacyEvidenceHash: PatentProofHash | null;
  nonce: string;
  defaultTtlMs: number;
}): PermitBinding => {
  const permitBinding: PermitBinding = {
    requestHash: createToolCallRequestHash(request),
    executorId: safetyState.executorId,
    safetyEvidenceVersion: safetyState.safetyEvidenceVersion ?? safetyState.stateId,
    coverageMapHash: createCoverageMapHash({
      safetyState,
      coverageMap: snapshot.coverageMap,
    }),
    deniedEvidenceHash:
      snapshot.deniedEvidenceHash ??
      createAggregateEvidenceHash({
        coverageMap: snapshot.coverageMap,
        safetyState,
        evidenceKind: "denied-capability",
        filter: (entry) =>
          !SIDE_EFFECT_COVERAGE_TYPES.has(entry.requiredEvidenceType),
      }),
    sideEffectEvidenceHash:
      snapshot.sideEffectEvidenceHash ??
      createAggregateEvidenceHash({
        coverageMap: snapshot.coverageMap,
        safetyState,
        evidenceKind: "side-effect",
        filter: (entry) => SIDE_EFFECT_COVERAGE_TYPES.has(entry.requiredEvidenceType),
      }),
    ttl: getPermitBindingTtl({ safetyState, evaluatedAt, defaultTtlMs }),
    nonce,
  };

  if (contextAdequacyEvidenceHash !== null) {
    permitBinding.contextAdequacyEvidenceHash = contextAdequacyEvidenceHash;
  }

  return permitBinding;
};

const createPermitDeniedEvidence = ({
  request,
  snapshot,
  evaluatedAt,
  reason,
}: {
  request: ToolCallRequest;
  snapshot: ToolExecutionPermitEvidenceSnapshot | null;
  evaluatedAt: string;
  reason: string;
}): PermitDeniedEvidence => ({
  requestHash: createToolCallRequestHash(request),
  executorId: snapshot?.safetyState?.executorId ?? "unbound-executor",
  permitIssued: false,
  executorInvoked: false,
  missingEvidence: getMissingOrFailedEvidenceTypes({
    coverageMap: snapshot?.coverageMap,
    evaluatedAt,
  }),
  invalidatedEvidence: getInvalidatedEvidenceHashes({
    coverageMap: snapshot?.coverageMap,
    evaluatedAt,
  }),
  reason,
});

const createExternalAuditSinkFailure = (message: string): ExternalAuditSinkResult => ({
  ok: false,
  status: "failed",
  externalAuditId: null,
  evidenceUri: null,
  message,
});

const createAuditEvidence = ({
  request,
  analysisResult,
  executorInvoked,
  completedAt,
}: {
  request: ToolCallRequest;
  analysisResult: ToolCallAnalysisResult;
  executorInvoked: boolean;
  completedAt: string;
}): RealComponentEvidence => ({
  environmentName: request.environment,
  runId: analysisResult.auditRecordId,
  sourceSystem: "agent-safety-gateway",
  startedAt: analysisResult.auditRecord.createdAt,
  completedAt,
  artifactUris: [],
  notes: `decision=${analysisResult.executionDecision.type}; executorInvoked=${executorInvoked}`,
});

const toJsonValue = (value: unknown): JsonValue | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as JsonValue;
};

const isContextEvidenceSnapshot = (
  input: ToolExecutionContextEvidenceResult,
): input is ToolExecutionContextEvidenceSnapshot =>
  "contextSufficiencyState" in input;

const normalizeContextEvidenceSnapshot = (
  input: ToolExecutionContextEvidenceResult | null,
): ToolExecutionContextEvidenceSnapshot | null => {
  if (input === null) {
    return null;
  }

  if (isContextEvidenceSnapshot(input)) {
    return input;
  }

  return { contextSufficiencyState: input };
};

const hasContextSufficientForPermit = (
  contextSufficiencyState: ContextSufficiencyState | null,
) =>
  contextSufficiencyState !== null &&
  contextSufficiencyState.sufficient &&
  (contextSufficiencyState.state === ContextSufficiencyStateName.Sufficient ||
    contextSufficiencyState.state ===
      ContextSufficiencyStateName.SufficientByCertifiedSummary);

const requiresContextBeforePermit = (analysisResult: ToolCallAnalysisResult) =>
  CONTEXT_REQUIRED_PERMIT_RISK_LEVELS.has(analysisResult.riskLevel);

const createContextPermitPreconditionDecision = (
  contextSufficiencyState: ContextSufficiencyState | null,
): ExecutionDecision => ({
  type: DecisionType.Block,
  code: "context.evidence_required.deny",
  reason:
    contextSufficiencyState === null
      ? "High-risk tool call requires sufficient context adequacy evidence before executor permit evaluation."
      : `Context sufficiency state ${contextSufficiencyState.state}: ${contextSufficiencyState.transitionReason}.`,
  recommendedAction:
    "Persist a sufficient ContextSufficiencyState and ContextAdequacyEvidence record, then retry the tool call before executor safety permit evaluation.",
  rewrittenRequest: null,
});

const createAuditSinkInput = <ExecutorResult>({
  request,
  analysisResult,
  executorInvoked,
  executorResult,
  completedAt,
  redaction,
}: {
  request: ToolCallRequest;
  analysisResult: ToolCallAnalysisResult;
  executorInvoked: boolean;
  executorResult: ExecutorResult | null;
  completedAt: string;
  redaction?: AuditRedactionOptions;
}): ExternalAuditSinkInput =>
  redactSensitiveAuditFields(
    {
      request,
      analysisResult,
      executorInvoked,
      executorResult: toJsonValue(executorResult),
      evidence: createAuditEvidence({
        request,
        analysisResult,
        executorInvoked,
        completedAt,
      }),
    },
    redaction,
  );

const createAuditExecutorSafetyEvidence = ({
  snapshot,
  permitBinding,
  permitDeniedEvidence,
  executorInvoked,
}: {
  snapshot: ToolExecutionPermitEvidenceSnapshot | null;
  permitBinding: PermitBinding | null;
  permitDeniedEvidence: PermitDeniedEvidence | null;
  executorInvoked: boolean;
}): AuditExecutorSafetyEvidence => ({
  forbiddenEffectObligations: [...(snapshot?.forbiddenEffectObligations ?? [])],
  coverageMapHash:
    permitBinding?.coverageMapHash ?? getSnapshotCoverageMapHash(snapshot),
  safetyEvidenceState: snapshot?.safetyState ?? null,
  permitIssued: permitBinding !== null,
  executorInvoked,
  permitBinding,
  permitDeniedEvidence,
});

const createResult = <ExecutorResult>({
  status,
  request,
  analysisResult,
  executorInvoked,
  contextSufficiencyState,
  contextAction,
  executorResult,
  approvalRequest,
  permitBinding,
  permitDeniedEvidence,
  auditSinkResult,
}: {
  status: GuardedExecutionStatus;
  request: ToolCallRequest;
  analysisResult: ToolCallAnalysisResult;
  executorInvoked: boolean;
  contextSufficiencyState?: ContextSufficiencyState | null;
  contextAction?: ContextGatewayAction | null;
  executorResult: ExecutorResult | null;
  approvalRequest: ApprovalRequest | null;
  permitBinding: PermitBinding | null;
  permitDeniedEvidence: PermitDeniedEvidence | null;
  auditSinkResult: ExternalAuditSinkResult;
}): GuardedExecutionResult<ExecutorResult> => ({
  status,
  requestId: request.id,
  executorInvoked,
  riskLevel: analysisResult.riskLevel,
  decision: analysisResult.executionDecision,
  contextSufficiencyState: contextSufficiencyState ?? null,
  contextAction: contextAction ?? null,
  auditId: analysisResult.auditRecordId,
  analysisResult,
  executorResult,
  approvalRequest,
  permitBinding,
  permitDeniedEvidence,
  auditSinkResult,
});

export const createToolExecutionGuard = <ExecutorResult>({
  analysisService,
  executor,
  executorId,
  approvalAdapter,
  auditSinkAdapter,
  auditSinkStrict = false,
  auditRedaction,
  auditRepository,
  contextEvidenceProvider,
  contextDecisionEngine = createContextExecutionDecisionEngine(),
  permitEvidenceProvider,
  permitNonceFactory = randomUUID,
  permitTtlMs = DEFAULT_PERMIT_TTL_MS,
  defaultApproverGroup = DEFAULT_APPROVER_GROUP,
  now = () => new Date(),
}: ToolExecutionGuardDependencies<ExecutorResult>): ToolExecutionGuard<ExecutorResult> => {
  const appendAuditSinkEvidence = async ({
    request,
    analysisResult,
    executorInvoked,
    executorResult,
  }: {
    request: ToolCallRequest;
    analysisResult: ToolCallAnalysisResult;
    executorInvoked: boolean;
    executorResult: ExecutorResult | null;
  }) => {
    if (!auditSinkAdapter) {
      return createNotConfiguredExternalAuditSinkResult(
        DEFAULT_AUDIT_SINK_REQUIREMENTS,
      );
    }

    try {
      return await auditSinkAdapter.appendControlEvidence(
        createAuditSinkInput({
          request,
          analysisResult,
          executorInvoked,
          executorResult,
          completedAt: now().toISOString(),
          ...(auditRedaction ? { redaction: auditRedaction } : {}),
        }),
      );
    } catch (error: unknown) {
      return createExternalAuditSinkFailure(
        error instanceof Error ? error.message : "External audit sink write failed.",
      );
    }
  };

  const updateAuditExecutorSafetyEvidence = async ({
    analysisResult,
    snapshot,
    permitBinding,
    permitDeniedEvidence,
    executorInvoked,
  }: {
    analysisResult: ToolCallAnalysisResult;
    snapshot: ToolExecutionPermitEvidenceSnapshot | null;
    permitBinding: PermitBinding | null;
    permitDeniedEvidence: PermitDeniedEvidence | null;
    executorInvoked: boolean;
  }) => {
    const executorSafetyEvidence = createAuditExecutorSafetyEvidence({
      snapshot,
      permitBinding,
      permitDeniedEvidence,
      executorInvoked,
    });

    Object.assign(analysisResult.auditRecord, executorSafetyEvidence);

    await auditRepository?.updateAuditExecutorSafetyEvidence(
      analysisResult.auditRecordId,
      executorSafetyEvidence,
    );
  };

  const createFinalResult = async ({
    status,
    request,
    analysisResult,
    executorInvoked,
    contextSufficiencyState,
    contextAction,
    executorResult,
    approvalRequest,
    permitBinding,
    permitDeniedEvidence,
  }: {
    status: GuardedExecutionStatus;
    request: ToolCallRequest;
    analysisResult: ToolCallAnalysisResult;
    executorInvoked: boolean;
    contextSufficiencyState: ContextSufficiencyState | null;
    contextAction: ContextGatewayAction | null;
    executorResult: ExecutorResult | null;
    approvalRequest: ApprovalRequest | null;
    permitBinding?: PermitBinding | null;
    permitDeniedEvidence?: PermitDeniedEvidence | null;
  }) =>
    createResult({
      status,
      request,
      analysisResult,
      executorInvoked,
      contextSufficiencyState,
      contextAction,
      executorResult,
      approvalRequest,
      permitBinding: permitBinding ?? null,
      permitDeniedEvidence: permitDeniedEvidence ?? null,
      auditSinkResult: await appendAuditSinkEvidence({
        request,
        analysisResult,
        executorInvoked,
        executorResult,
      }),
    });

  const ensureStrictAuditSinkReady = async () => {
    if (!auditSinkStrict) {
      return null;
    }

    if (!auditSinkAdapter) {
      return createNotConfiguredExternalAuditSinkResult(
        DEFAULT_AUDIT_SINK_REQUIREMENTS,
      );
    }

    const health = await auditSinkAdapter.health();

    if (health.status === AdapterHealthStatus.Ready) {
      return null;
    }

    if (health.status === AdapterHealthStatus.NotConfigured) {
      const missingRequirements = Array.isArray(
        health.details.missingRequirements,
      )
        ? health.details.missingRequirements.filter(
            (requirement): requirement is string => typeof requirement === "string",
          )
        : DEFAULT_AUDIT_SINK_REQUIREMENTS;

      return createNotConfiguredExternalAuditSinkResult(missingRequirements);
    }

    return createExternalAuditSinkFailure(
      "External audit sink is unavailable in strict mode.",
    );
  };

  const denyPermit = async ({
    request,
    analysisResult,
    snapshot,
    reason,
  }: ToolExecutionPermitEvidenceInput & {
    snapshot: ToolExecutionPermitEvidenceSnapshot | null;
    reason: string;
  }) => {
    const permitDeniedEvidence = createPermitDeniedEvidence({
      request,
      snapshot,
      evaluatedAt: now().toISOString(),
      reason,
    });

    await permitEvidenceProvider?.appendPermitDeniedEvidence?.({
      request,
      analysisResult,
      permitDeniedEvidence,
    });

    return permitDeniedEvidence;
  };

  const checkPermitGate = async ({
    request,
    analysisResult,
    contextAdequacyEvidenceHash,
  }: ToolExecutionPermitEvidenceInput & {
    contextAdequacyEvidenceHash: PatentProofHash | null;
  }) => {
    if (!permitEvidenceProvider) {
      return {
        permitBinding: null,
        permitIssuedAt: null,
        snapshot: null,
        permitDeniedEvidence: await denyPermit({
          request,
          analysisResult,
          snapshot: null,
          reason: "executor safety evidence provider is not configured",
        }),
      };
    }

    const evaluatedAt = now().toISOString();
    const snapshot = await permitEvidenceProvider.getEvidenceSnapshot({
      request,
      analysisResult,
    });
    const normalizedSnapshot = snapshot ?? null;
    const safetyState = normalizedSnapshot?.safetyState ?? null;

    if (!normalizedSnapshot || !canBindPermit(safetyState, evaluatedAt)) {
      return {
        permitBinding: null,
        permitIssuedAt: null,
        snapshot: normalizedSnapshot,
        permitDeniedEvidence: await denyPermit({
          request,
          analysisResult,
          snapshot: normalizedSnapshot,
          reason: getPermitDenialReason({ safetyState, evaluatedAt }),
        }),
      };
    }

    const permitBinding = createPermitBinding({
      request,
      snapshot: normalizedSnapshot,
      safetyState,
      evaluatedAt,
      contextAdequacyEvidenceHash,
      nonce: permitNonceFactory(),
      defaultTtlMs: permitTtlMs,
    });

    await permitEvidenceProvider.appendPermitBinding?.({
      request,
      analysisResult,
      permitBinding,
    });

    return {
      permitBinding,
      permitIssuedAt: evaluatedAt,
      snapshot: normalizedSnapshot,
      permitDeniedEvidence: null,
    };
  };

  const applyContextExecutionDecision = ({
    analysisResult,
    contextDecision,
  }: {
    analysisResult: ToolCallAnalysisResult;
    contextDecision: ContextExecutionDecision;
  }) => {
    analysisResult.executionDecision = contextDecision.executionDecision;
    analysisResult.auditRecord.decision = contextDecision.executionDecision;
  };

  const checkContextGate = async ({
    request,
    analysisResult,
  }: ToolExecutionContextEvidenceInput) => {
    if (!contextEvidenceProvider) {
      return null;
    }

    const contextEvidenceSnapshot = normalizeContextEvidenceSnapshot(
      await contextEvidenceProvider.getContextSufficiencyState({
        request,
        analysisResult,
      }),
    );

    if (!contextEvidenceSnapshot) {
      return null;
    }

    const { contextSufficiencyState } = contextEvidenceSnapshot;

    const contextDecision = contextDecisionEngine.decideContextExecution({
      request,
      currentDecision: analysisResult.executionDecision,
      contextSufficiencyState,
    });

    applyContextExecutionDecision({ analysisResult, contextDecision });

    return {
      ...contextDecision,
      contextAdequacyEvidenceHash:
        contextEvidenceSnapshot.contextAdequacyEvidenceHash ?? null,
    };
  };

  const createContextApprovalRequest = async ({
    request,
    analysisResult,
  }: ToolExecutionContextEvidenceInput) => {
    const existingApprovalRequest =
      (await approvalAdapter?.getApprovalRequest(request.id)) ?? null;

    return (
      existingApprovalRequest ??
      (await approvalAdapter?.createApprovalRequest({
        request,
        analysisResult,
        approverGroup: defaultApproverGroup,
      })) ??
      null
    );
  };

  const createContextPreflightResult = async ({
    request,
    analysisResult,
    contextSufficiencyState,
    contextAction,
  }: ToolExecutionContextEvidenceInput & {
    contextSufficiencyState: ContextSufficiencyState;
    contextAction: ContextGatewayAction;
  }) => {
    const approvalRequest =
      contextAction.type === ContextGatewayActionType.Reapproval
        ? await createContextApprovalRequest({ request, analysisResult })
        : null;

    return createFinalResult({
      status:
        contextAction.type === ContextGatewayActionType.Deny ? "blocked" : "held",
      request,
      analysisResult,
      executorInvoked: false,
      contextSufficiencyState,
      contextAction,
      executorResult: null,
      approvalRequest,
    });
  };

  const executeWithPermitGate = async ({
    request,
    analysisResult,
    approvalRequest,
    contextSufficiencyState,
    contextAdequacyEvidenceHash,
    contextAction,
  }: {
    request: ToolCallRequest;
    analysisResult: ToolCallAnalysisResult;
    approvalRequest: ApprovalRequest | null;
    contextSufficiencyState: ContextSufficiencyState | null;
    contextAdequacyEvidenceHash: PatentProofHash | null;
    contextAction: ContextGatewayAction | null;
  }) => {
    if (
      requiresContextBeforePermit(analysisResult) &&
      !hasContextSufficientForPermit(contextSufficiencyState)
    ) {
      const executionDecision = createContextPermitPreconditionDecision(
        contextSufficiencyState,
      );

      analysisResult.executionDecision = executionDecision;
      analysisResult.auditRecord.decision = executionDecision;

      await updateAuditExecutorSafetyEvidence({
        analysisResult,
        snapshot: null,
        permitBinding: null,
        permitDeniedEvidence: null,
        executorInvoked: false,
      });

      return createFinalResult({
        status: "blocked",
        request,
        analysisResult,
        executorInvoked: false,
        contextSufficiencyState,
        contextAction,
        executorResult: null,
        approvalRequest,
      });
    }

    if (!executor) {
      return createFinalResult({
        status: "not_configured",
        request,
        analysisResult,
        executorInvoked: false,
        contextSufficiencyState,
        contextAction,
        executorResult: null,
        approvalRequest,
      });
    }

    const strictAuditSinkResult = await ensureStrictAuditSinkReady();

    if (strictAuditSinkResult) {
      return createResult<ExecutorResult>({
        status: "not_configured",
        request,
        analysisResult,
        executorInvoked: false,
        contextSufficiencyState,
        contextAction,
        executorResult: null,
        approvalRequest,
        permitBinding: null,
        permitDeniedEvidence: null,
        auditSinkResult: strictAuditSinkResult,
      });
    }

    const permitDecision = await checkPermitGate({
      request,
      analysisResult,
      contextAdequacyEvidenceHash,
    });

    if (permitDecision.permitDeniedEvidence) {
      await updateAuditExecutorSafetyEvidence({
        analysisResult,
        snapshot: permitDecision.snapshot,
        permitBinding: null,
        permitDeniedEvidence: permitDecision.permitDeniedEvidence,
        executorInvoked: false,
      });

      return createFinalResult({
        status: "blocked",
        request,
        analysisResult,
        executorInvoked: false,
        contextSufficiencyState,
        contextAction,
        executorResult: null,
        approvalRequest,
        permitDeniedEvidence: permitDecision.permitDeniedEvidence,
      });
    }

    const broker = createToolExecutorBroker({
      executor,
      expectedExecutorId: executorId ?? permitDecision.permitBinding.executorId,
      now,
    });
    const brokerResult = await broker.invoke({
      request,
      analysisResult,
      permitBinding: permitDecision.permitBinding,
      permitIssuedAt: permitDecision.permitIssuedAt,
    });

    if (brokerResult.status === "denied") {
      await permitEvidenceProvider?.appendPermitDeniedEvidence?.({
        request,
        analysisResult,
        permitDeniedEvidence: brokerResult.permitDeniedEvidence,
      });
      await updateAuditExecutorSafetyEvidence({
        analysisResult,
        snapshot: permitDecision.snapshot,
        permitBinding: null,
        permitDeniedEvidence: brokerResult.permitDeniedEvidence,
        executorInvoked: false,
      });

      return createFinalResult({
        status: "blocked",
        request,
        analysisResult,
        executorInvoked: false,
        contextSufficiencyState,
        contextAction,
        executorResult: null,
        approvalRequest,
        permitBinding: null,
        permitDeniedEvidence: brokerResult.permitDeniedEvidence,
      });
    }

    await updateAuditExecutorSafetyEvidence({
      analysisResult,
      snapshot: permitDecision.snapshot,
      permitBinding: brokerResult.permitBinding,
      permitDeniedEvidence: null,
      executorInvoked: true,
    });

    return createFinalResult({
      status: "executed",
      request,
      analysisResult,
      executorInvoked: true,
      contextSufficiencyState,
      contextAction,
      executorResult: brokerResult.executorResult,
      approvalRequest,
      permitBinding: brokerResult.permitBinding,
    });
  };

  return {
    async execute(request) {
      const analysisResult = await analysisService.analyzeToolCall(request);
      const contextDecision = await checkContextGate({ request, analysisResult });

      if (contextDecision?.contextAction && !contextDecision.shouldContinueToPermit) {
        return createContextPreflightResult({
          request,
          analysisResult,
          contextSufficiencyState: contextDecision.contextSufficiencyState,
          contextAction: contextDecision.contextAction,
        });
      }

      const contextSufficiencyState =
        contextDecision?.contextSufficiencyState ?? null;
      const contextAdequacyEvidenceHash =
        contextDecision?.contextAdequacyEvidenceHash ?? null;
      const contextAction = contextDecision?.contextAction ?? null;

      if (requiresApproval(analysisResult)) {
        const existingApprovalRequest =
          (await approvalAdapter?.getApprovalRequest(request.id)) ?? null;
        const approvalRequest =
          existingApprovalRequest ??
          (await approvalAdapter?.createApprovalRequest({
            request,
            analysisResult,
            approverGroup: defaultApproverGroup,
          })) ??
          null;

        if (!isApproved(approvalRequest)) {
          return createFinalResult({
            status: "held",
            request,
            analysisResult,
            executorInvoked: false,
            contextSufficiencyState,
            contextAction,
            executorResult: null,
            approvalRequest,
          });
        }

        return executeWithPermitGate({
          request,
          analysisResult,
          approvalRequest,
          contextSufficiencyState,
          contextAdequacyEvidenceHash,
          contextAction,
        });
      }

      if (!canInvokeExecutor(analysisResult)) {
        return createFinalResult({
          status: getPreventedStatus(analysisResult),
          request,
          analysisResult,
          executorInvoked: false,
          contextSufficiencyState,
          contextAction,
          executorResult: null,
          approvalRequest: null,
        });
      }

      return executeWithPermitGate({
        request,
        analysisResult,
        approvalRequest: null,
        contextSufficiencyState,
        contextAdequacyEvidenceHash,
        contextAction,
      });
    },
  };
};
