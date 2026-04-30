import {
  DecisionType,
  RiskLevel,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

import {
  ApprovalRequestStatus,
  type ApprovalRequest,
  type ExternalApprovalAdapter,
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
  defaultApproverGroup?: string;
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

const createResult = <ExecutorResult>({
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
});

export const createToolExecutionGuard = <ExecutorResult>({
  analysisService,
  executor,
  approvalAdapter,
  defaultApproverGroup = DEFAULT_APPROVER_GROUP,
}: ToolExecutionGuardDependencies<ExecutorResult>): ToolExecutionGuard<ExecutorResult> => ({
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
        return createResult<ExecutorResult>({
          status: "held",
          request,
          analysisResult,
          executorInvoked: false,
          executorResult: null,
          approvalRequest,
        });
      }

      if (!executor) {
        return createResult<ExecutorResult>({
          status: "not_configured",
          request,
          analysisResult,
          executorInvoked: false,
          executorResult: null,
          approvalRequest,
        });
      }

      const executorResult = await executor(request, analysisResult);

      return createResult<ExecutorResult>({
        status: "executed",
        request,
        analysisResult,
        executorInvoked: true,
        executorResult,
        approvalRequest,
      });
    }

    if (!canInvokeExecutor(analysisResult)) {
      return createResult<ExecutorResult>({
        status: getPreventedStatus(analysisResult),
        request,
        analysisResult,
        executorInvoked: false,
        executorResult: null,
        approvalRequest: null,
      });
    }

    if (!executor) {
      return createResult<ExecutorResult>({
        status: "not_configured",
        request,
        analysisResult,
        executorInvoked: false,
        executorResult: null,
        approvalRequest: null,
      });
    }

    const executorResult = await executor(request, analysisResult);

    return createResult<ExecutorResult>({
      status: "executed",
      request,
      analysisResult,
      executorInvoked: true,
      executorResult,
      approvalRequest: null,
    });
  },
});
