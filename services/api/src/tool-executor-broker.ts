import { createHash } from "node:crypto";

import type { ToolCallRequest } from "@agent-safety-gateway/shared";
import {
  PermitBindingSchema,
  type PermitBinding,
  type PermitDeniedEvidence,
} from "@agent-safety-gateway/shared/forbidden-side-effect";
import type { PatentProofHash } from "@agent-safety-gateway/shared/patent-state-machine";

import type { ToolCallAnalysisResult } from "./tool-call-analysis-service.js";

export type BrokeredToolExecutor<ExecutorResult> = (
  request: ToolCallRequest,
  analysisResult: ToolCallAnalysisResult,
) => ExecutorResult | Promise<ExecutorResult>;

export type ToolExecutorBrokerDenialCode =
  | "missing_permit_binding"
  | "invalid_permit_binding"
  | "mismatched_permit_binding"
  | "stale_permit_binding";

export type ToolExecutorBrokerDependencies<ExecutorResult> = {
  executor: BrokeredToolExecutor<ExecutorResult>;
  expectedExecutorId: string;
  now?: () => Date;
};

export type ToolExecutorBrokerInput = {
  request: ToolCallRequest;
  analysisResult: ToolCallAnalysisResult;
  permitBinding: unknown;
  permitIssuedAt: string | null;
};

export type ToolExecutorBrokerExecutedResult<ExecutorResult> = {
  status: "executed";
  executorInvoked: true;
  executorResult: ExecutorResult;
  permitBinding: PermitBinding;
  permitDeniedEvidence: null;
};

export type ToolExecutorBrokerDeniedResult = {
  status: "denied";
  executorInvoked: false;
  executorResult: null;
  permitBinding: PermitBinding | null;
  permitDeniedEvidence: PermitDeniedEvidence;
  denialCode: ToolExecutorBrokerDenialCode;
};

export type ToolExecutorBrokerResult<ExecutorResult> =
  | ToolExecutorBrokerExecutedResult<ExecutorResult>
  | ToolExecutorBrokerDeniedResult;

export type ToolExecutorBroker<ExecutorResult> = {
  invoke: (
    input: ToolExecutorBrokerInput,
  ) => Promise<ToolExecutorBrokerResult<ExecutorResult>>;
};

const FORBIDDEN_SIDE_EFFECT_PERMIT_SCHEMA =
  "agent-safety-gateway.forbidden-side-effect.ToolExecutionGuardPermit.v1";

const createProofHash = (payload: unknown): PatentProofHash =>
  `sha256:${createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")}`;

export const createToolCallRequestHash = (
  request: ToolCallRequest,
): PatentProofHash =>
  createProofHash({
    schema: `${FORBIDDEN_SIDE_EFFECT_PERMIT_SCHEMA}.ToolCallRequest`,
    id: request.id,
    actor: request.actor,
    taskPurpose: request.taskPurpose,
    toolType: request.toolType,
    rawPayload: request.rawPayload,
    environment: request.environment,
    createdAt: request.createdAt,
  });

const createBrokerDeniedEvidence = ({
  request,
  executorId,
  reason,
}: {
  request: ToolCallRequest;
  executorId: string;
  reason: string;
}): PermitDeniedEvidence => ({
  requestHash: createToolCallRequestHash(request),
  executorId,
  permitIssued: false,
  executorInvoked: false,
  missingEvidence: [],
  invalidatedEvidence: [],
  reason,
});

const parseTimestamp = (timestamp: string | null) => {
  if (timestamp === null) {
    return null;
  }

  const timestampMs = Date.parse(timestamp);

  return Number.isNaN(timestampMs) ? null : timestampMs;
};

const isPermitFresh = ({
  permitBinding,
  permitIssuedAt,
  now,
}: {
  permitBinding: PermitBinding;
  permitIssuedAt: string | null;
  now: () => Date;
}) => {
  const issuedAtMs = parseTimestamp(permitIssuedAt);

  if (issuedAtMs === null) {
    return false;
  }

  return issuedAtMs + permitBinding.ttl > now().getTime();
};

const createDeniedResult = ({
  request,
  executorId,
  permitBinding,
  denialCode,
  reason,
}: {
  request: ToolCallRequest;
  executorId: string;
  permitBinding: PermitBinding | null;
  denialCode: ToolExecutorBrokerDenialCode;
  reason: string;
}): ToolExecutorBrokerDeniedResult => ({
  status: "denied",
  executorInvoked: false,
  executorResult: null,
  permitBinding,
  permitDeniedEvidence: createBrokerDeniedEvidence({ request, executorId, reason }),
  denialCode,
});

export const createToolExecutorBroker = <ExecutorResult>({
  executor,
  expectedExecutorId,
  now = () => new Date(),
}: ToolExecutorBrokerDependencies<ExecutorResult>): ToolExecutorBroker<ExecutorResult> => ({
  async invoke({ request, analysisResult, permitBinding, permitIssuedAt }) {
    if (permitBinding === null || permitBinding === undefined) {
      return createDeniedResult({
        request,
        executorId: expectedExecutorId,
        permitBinding: null,
        denialCode: "missing_permit_binding",
        reason: "executor broker rejected missing permit binding",
      });
    }

    const parseResult = PermitBindingSchema.safeParse(permitBinding);

    if (!parseResult.success) {
      return createDeniedResult({
        request,
        executorId: expectedExecutorId,
        permitBinding: null,
        denialCode: "invalid_permit_binding",
        reason: "executor broker rejected invalid permit binding",
      });
    }

    const parsedPermitBinding = parseResult.data;
    const requestHash = createToolCallRequestHash(request);

    if (parsedPermitBinding.requestHash !== requestHash) {
      return createDeniedResult({
        request,
        executorId: parsedPermitBinding.executorId,
        permitBinding: parsedPermitBinding,
        denialCode: "mismatched_permit_binding",
        reason: "executor broker rejected mismatched permit binding for request",
      });
    }

    if (parsedPermitBinding.executorId !== expectedExecutorId) {
      return createDeniedResult({
        request,
        executorId: expectedExecutorId,
        permitBinding: parsedPermitBinding,
        denialCode: "mismatched_permit_binding",
        reason: `executor broker rejected mismatched permit binding for executor ${parsedPermitBinding.executorId}; expected ${expectedExecutorId}`,
      });
    }

    if (!isPermitFresh({ permitBinding: parsedPermitBinding, permitIssuedAt, now })) {
      return createDeniedResult({
        request,
        executorId: parsedPermitBinding.executorId,
        permitBinding: parsedPermitBinding,
        denialCode: "stale_permit_binding",
        reason: "executor broker rejected stale permit binding",
      });
    }

    const executorResult = await executor(request, analysisResult);

    return {
      status: "executed",
      executorInvoked: true,
      executorResult,
      permitBinding: parsedPermitBinding,
      permitDeniedEvidence: null,
    };
  },
});
