import {
  DecisionType,
  type JsonValue,
  RiskLevel,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

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
import type {
  ToolCallAnalysisResult,
  ToolCallAnalysisService,
} from "./tool-call-analysis-service.js";

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
  auditId: string;
  analysisResult: ToolCallAnalysisResult;
  executorResult: ExecutorResult | null;
  approvalRequest: ApprovalRequest | null;
  auditSinkResult: ExternalAuditSinkResult;
};

export type ToolExecutionGuard<ExecutorResult> = {
  execute: (
    request: ToolCallRequest,
  ) => Promise<GuardedExecutionResult<ExecutorResult>>;
};

export type ToolExecutionGuardDependencies<ExecutorResult> = {
  analysisService: ToolCallAnalysisService;
  executor?: ToolExecutor<ExecutorResult>;
  approvalAdapter?: Pick<
    ExternalApprovalAdapter,
    "createApprovalRequest" | "getApprovalRequest"
  >;
  auditSinkAdapter?: Pick<
    ExternalAuditSinkAdapter,
    "appendControlEvidence" | "health"
  >;
  auditSinkStrict?: boolean;
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

const createAuditSinkInput = <ExecutorResult>({
  request,
  analysisResult,
  executorInvoked,
  executorResult,
  completedAt,
}: {
  request: ToolCallRequest;
  analysisResult: ToolCallAnalysisResult;
  executorInvoked: boolean;
  executorResult: ExecutorResult | null;
  completedAt: string;
}): ExternalAuditSinkInput => ({
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
});

const createResult = <ExecutorResult>({
  status,
  request,
  analysisResult,
  executorInvoked,
  executorResult,
  approvalRequest,
  auditSinkResult,
}: {
  status: GuardedExecutionStatus;
  request: ToolCallRequest;
  analysisResult: ToolCallAnalysisResult;
  executorInvoked: boolean;
  executorResult: ExecutorResult | null;
  approvalRequest: ApprovalRequest | null;
  auditSinkResult: ExternalAuditSinkResult;
}): GuardedExecutionResult<ExecutorResult> => ({
  status,
  requestId: request.id,
  executorInvoked,
  riskLevel: analysisResult.riskLevel,
  decision: analysisResult.executionDecision,
  auditId: analysisResult.auditRecordId,
  analysisResult,
  executorResult,
  approvalRequest,
  auditSinkResult,
});

export const createToolExecutionGuard = <ExecutorResult>({
  analysisService,
  executor,
  approvalAdapter,
  auditSinkAdapter,
  auditSinkStrict = false,
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
        }),
      );
    } catch (error: unknown) {
      return createExternalAuditSinkFailure(
        error instanceof Error ? error.message : "External audit sink write failed.",
      );
    }
  };

  const createFinalResult = async ({
    status,
    request,
    analysisResult,
    executorInvoked,
    executorResult,
    approvalRequest,
  }: {
    status: GuardedExecutionStatus;
    request: ToolCallRequest;
    analysisResult: ToolCallAnalysisResult;
    executorInvoked: boolean;
    executorResult: ExecutorResult | null;
    approvalRequest: ApprovalRequest | null;
  }) =>
    createResult({
      status,
      request,
      analysisResult,
      executorInvoked,
      executorResult,
      approvalRequest,
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

  return {
    async execute(request) {
      const analysisResult = await analysisService.analyzeToolCall(request);

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
            executorResult: null,
            approvalRequest,
            auditSinkResult: strictAuditSinkResult,
          });
        }

        const executorResult = await executor(request, analysisResult);

        return createFinalResult({
          status: "executed",
          request,
          analysisResult,
          executorInvoked: true,
          executorResult,
          approvalRequest,
        });
      }

      if (!canInvokeExecutor(analysisResult)) {
        return createFinalResult({
          status: getPreventedStatus(analysisResult),
          request,
          analysisResult,
          executorInvoked: false,
          executorResult: null,
          approvalRequest: null,
        });
      }

      if (!executor) {
        return createFinalResult({
          status: "not_configured",
          request,
          analysisResult,
          executorInvoked: false,
          executorResult: null,
          approvalRequest: null,
        });
      }

      const strictAuditSinkResult = await ensureStrictAuditSinkReady();

      if (strictAuditSinkResult) {
        return createResult<ExecutorResult>({
          status: "not_configured",
          request,
          analysisResult,
          executorInvoked: false,
          executorResult: null,
          approvalRequest: null,
          auditSinkResult: strictAuditSinkResult,
        });
      }

      const executorResult = await executor(request, analysisResult);

      return createFinalResult({
        status: "executed",
        request,
        analysisResult,
        executorInvoked: true,
        executorResult,
        approvalRequest: null,
      });
    },
  };
};
