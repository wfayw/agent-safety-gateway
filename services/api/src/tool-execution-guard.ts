import {
  DecisionType,
  RiskLevel,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

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
};

export type ToolExecutionGuard<ExecutorResult> = {
  execute: (
    request: ToolCallRequest,
  ) => Promise<GuardedExecutionResult<ExecutorResult>>;
};

export type ToolExecutionGuardDependencies<ExecutorResult> = {
  analysisService: ToolCallAnalysisService;
  executor?: ToolExecutor<ExecutorResult>;
};

const getPreventedStatus = (analysisResult: ToolCallAnalysisResult) =>
  analysisResult.executionDecision.type === DecisionType.Block ||
  analysisResult.riskLevel === RiskLevel.Prohibited
    ? "blocked"
    : "held";

const canInvokeExecutor = (analysisResult: ToolCallAnalysisResult) =>
  analysisResult.executionDecision.type === DecisionType.Allow &&
  analysisResult.riskLevel !== RiskLevel.Prohibited;

export const createToolExecutionGuard = <ExecutorResult>({
  analysisService,
  executor,
}: ToolExecutionGuardDependencies<ExecutorResult>): ToolExecutionGuard<ExecutorResult> => ({
  async execute(request) {
    const analysisResult = await analysisService.analyzeToolCall(request);

    if (!canInvokeExecutor(analysisResult)) {
      return {
        status: getPreventedStatus(analysisResult),
        requestId: request.id,
        executorInvoked: false,
        riskLevel: analysisResult.riskLevel,
        decision: analysisResult.executionDecision,
        auditId: analysisResult.auditRecordId,
        analysisResult,
        executorResult: null,
      };
    }

    if (!executor) {
      return {
        status: "not_configured",
        requestId: request.id,
        executorInvoked: false,
        riskLevel: analysisResult.riskLevel,
        decision: analysisResult.executionDecision,
        auditId: analysisResult.auditRecordId,
        analysisResult,
        executorResult: null,
      };
    }

    const executorResult = await executor(request, analysisResult);

    return {
      status: "executed",
      requestId: request.id,
      executorInvoked: true,
      riskLevel: analysisResult.riskLevel,
      decision: analysisResult.executionDecision,
      auditId: analysisResult.auditRecordId,
      analysisResult,
      executorResult,
    };
  },
});
