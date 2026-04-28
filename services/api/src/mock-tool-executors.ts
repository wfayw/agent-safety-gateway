import {
  ToolType,
  type Environment,
  type JsonObject,
  type OperationType,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

import type { ExecutionLogRepository } from "./execution-log-repository.js";
import type { ToolCallAnalysisResult } from "./tool-call-analysis-service.js";
import type { ToolExecutor } from "./tool-execution-guard.js";

export type MockToolExecutorResult = {
  ok: true;
  requestId: string;
  toolType: ToolType;
  operation: OperationType;
  target: string;
  environment: Environment;
  payload: JsonObject;
};

export type MockToolExecutorOptions = {
  executionLogRepository: Pick<ExecutionLogRepository, "appendExecutionLog">;
  scenarioId?: string;
  resolveScenarioId?: (
    request: ToolCallRequest,
    analysisResult: ToolCallAnalysisResult,
  ) => string;
  now?: () => Date;
};

const getScenarioId = (
  request: ToolCallRequest,
  analysisResult: ToolCallAnalysisResult,
  options: MockToolExecutorOptions,
) =>
  options.resolveScenarioId?.(request, analysisResult) ??
  options.scenarioId ??
  request.id;

const createMockExecutor = (
  expectedToolType: ToolType,
  options: MockToolExecutorOptions,
): ToolExecutor<MockToolExecutorResult> => {
  const now = options.now ?? (() => new Date());

  return async (request, analysisResult) => {
    if (request.toolType !== expectedToolType) {
      throw new Error(
        `Mock ${expectedToolType} executor received ${request.toolType} request ${request.id}.`,
      );
    }

    const result: MockToolExecutorResult = {
      ok: true,
      requestId: request.id,
      toolType: request.toolType,
      operation: analysisResult.actionTuple.operation,
      target: analysisResult.actionTuple.target,
      environment: request.environment,
      payload: request.rawPayload,
    };

    await options.executionLogRepository.appendExecutionLog({
      scenarioId: getScenarioId(request, analysisResult, options),
      toolType: request.toolType,
      requestId: request.id,
      called: true,
      timestamp: now().toISOString(),
      result,
    });

    return result;
  };
};

export const createMockSqlExecutor = (options: MockToolExecutorOptions) =>
  createMockExecutor(ToolType.Sql, options);

export const createMockDeployExecutor = (options: MockToolExecutorOptions) =>
  createMockExecutor(ToolType.CiCd, options);

export const createMockConfigExecutor = (options: MockToolExecutorOptions) =>
  createMockExecutor(ToolType.Config, options);
