import {
  DecisionType,
  type ExecutionDecision,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";
import {
  ContextSufficiencyStateName,
  type ContextSufficiencyState,
} from "@agent-safety-gateway/shared/context-retention";

export const ContextGatewayActionType = {
  Reground: "reground",
  Reapproval: "reapproval",
  Deny: "deny",
} as const;

export type ContextGatewayActionType =
  (typeof ContextGatewayActionType)[keyof typeof ContextGatewayActionType];

type ContextGatewayActionBase = {
  requestId: string;
  obligationId: string;
  toolCallDigest: string;
  contextSufficiencyState: ContextSufficiencyState["state"];
  promptAssemblyManifestId: string | null;
  inferenceId: string | null;
  requiredAnchorIds: readonly string[];
  blockedAnchorIds: readonly string[];
  missingAnchorIds: readonly string[];
  staleAnchorIds: readonly string[];
  conflictingAnchorIds: readonly string[];
  contaminatedAnchorIds: readonly string[];
  transitionReason: string;
};

export type ContextRegroundAction = ContextGatewayActionBase & {
  type: typeof ContextGatewayActionType.Reground;
  nextStep: "regenerate_tool_call_after_regrounding";
  instruction: string;
};

export type ContextReapprovalAction = ContextGatewayActionBase & {
  type: typeof ContextGatewayActionType.Reapproval;
  nextStep: "request_reapproval_before_regeneration";
  approvalFlowRequired: true;
};

export type ContextDenyAction = ContextGatewayActionBase & {
  type: typeof ContextGatewayActionType.Deny;
  nextStep: "deny_before_executor_safety_check";
  denialReason: string;
};

export type ContextGatewayAction =
  | ContextRegroundAction
  | ContextReapprovalAction
  | ContextDenyAction;

export type ContextExecutionDecisionInput = {
  request: ToolCallRequest;
  currentDecision: ExecutionDecision;
  contextSufficiencyState: ContextSufficiencyState;
};

export type ContextExecutionDecision = {
  shouldContinueToPermit: boolean;
  executionDecision: ExecutionDecision;
  contextAction: ContextGatewayAction | null;
  contextSufficiencyState: ContextSufficiencyState;
};

export type ContextExecutionDecisionEngine = {
  decideContextExecution: (
    input: ContextExecutionDecisionInput,
  ) => ContextExecutionDecision;
};

const createReason = (contextSufficiencyState: ContextSufficiencyState) =>
  `Context sufficiency state ${contextSufficiencyState.state}: ${contextSufficiencyState.transitionReason}.`;

const createDecision = ({
  contextSufficiencyState,
  type,
  code,
  recommendedAction,
}: {
  contextSufficiencyState: ContextSufficiencyState;
  type: ExecutionDecision["type"];
  code: string;
  recommendedAction: string;
}): ExecutionDecision => ({
  type,
  code,
  reason: createReason(contextSufficiencyState),
  recommendedAction,
  rewrittenRequest: null,
});

const createActionBase = ({
  request,
  contextSufficiencyState,
}: Pick<ContextExecutionDecisionInput, "request" | "contextSufficiencyState">): ContextGatewayActionBase => ({
  requestId: request.id,
  obligationId: contextSufficiencyState.obligationId,
  toolCallDigest: contextSufficiencyState.toolCallDigest,
  contextSufficiencyState: contextSufficiencyState.state,
  promptAssemblyManifestId: contextSufficiencyState.promptAssemblyManifestId,
  inferenceId: contextSufficiencyState.inferenceId,
  requiredAnchorIds: [...contextSufficiencyState.requiredAnchorIds],
  blockedAnchorIds: [...contextSufficiencyState.blockedAnchorIds],
  missingAnchorIds: [...contextSufficiencyState.missingAnchorIds],
  staleAnchorIds: [...contextSufficiencyState.staleAnchorIds],
  conflictingAnchorIds: [...contextSufficiencyState.conflictingAnchorIds],
  contaminatedAnchorIds: [...contextSufficiencyState.contaminatedAnchorIds],
  transitionReason: contextSufficiencyState.transitionReason,
});

const createRegroundDecision = (
  input: ContextExecutionDecisionInput,
  code: string,
): ContextExecutionDecision => ({
  shouldContinueToPermit: false,
  executionDecision: createDecision({
    contextSufficiencyState: input.contextSufficiencyState,
    type: DecisionType.Rewrite,
    code,
    recommendedAction:
      "Reground the agent prompt with the listed required context anchors, regenerate the tool call, and rerun gateway checks before executor safety evidence is evaluated.",
  }),
  contextAction: {
    ...createActionBase(input),
    type: ContextGatewayActionType.Reground,
    nextStep: "regenerate_tool_call_after_regrounding",
    instruction:
      "Inject the missing or stale required anchors into the same task context, then ask the agent to regenerate the tool call before any executor or permit check runs.",
  },
  contextSufficiencyState: input.contextSufficiencyState,
});

const createReapprovalDecision = (
  input: ContextExecutionDecisionInput,
): ContextExecutionDecision => ({
  shouldContinueToPermit: false,
  executionDecision: createDecision({
    contextSufficiencyState: input.contextSufficiencyState,
    type: DecisionType.RequireApproval,
    code: "context.reapproval_required",
    recommendedAction:
      "Create or reference a human approval flow, then regenerate the tool call with the approval note retained verbatim before executor safety checks.",
  }),
  contextAction: {
    ...createActionBase(input),
    type: ContextGatewayActionType.Reapproval,
    nextStep: "request_reapproval_before_regeneration",
    approvalFlowRequired: true,
  },
  contextSufficiencyState: input.contextSufficiencyState,
});

const createDenyDecision = (
  input: ContextExecutionDecisionInput,
  code: string,
): ContextExecutionDecision => ({
  shouldContinueToPermit: false,
  executionDecision: createDecision({
    contextSufficiencyState: input.contextSufficiencyState,
    type: DecisionType.Block,
    code,
    recommendedAction:
      "Deny the tool call before executor safety checks and resolve the context sufficiency failure before retrying.",
  }),
  contextAction: {
    ...createActionBase(input),
    type: ContextGatewayActionType.Deny,
    nextStep: "deny_before_executor_safety_check",
    denialReason: input.contextSufficiencyState.transitionReason,
  },
  contextSufficiencyState: input.contextSufficiencyState,
});

const assertNever = (value: never): never => {
  throw new Error(`Unhandled context sufficiency state: ${value}`);
};

export const createContextExecutionDecisionEngine = (): ContextExecutionDecisionEngine => ({
  decideContextExecution(input) {
    switch (input.contextSufficiencyState.state) {
      case ContextSufficiencyStateName.Sufficient:
      case ContextSufficiencyStateName.SufficientByCertifiedSummary:
        return {
          shouldContinueToPermit: true,
          executionDecision: input.currentDecision,
          contextAction: null,
          contextSufficiencyState: input.contextSufficiencyState,
        };
      case ContextSufficiencyStateName.RegroundRequired:
        return createRegroundDecision(input, "context.reground_required");
      case ContextSufficiencyStateName.Stale:
        return createRegroundDecision(input, "context.stale.reground_required");
      case ContextSufficiencyStateName.ReapprovalRequired:
        return createReapprovalDecision(input);
      case ContextSufficiencyStateName.Conflicting:
        return createDenyDecision(input, "context.conflicting.deny");
      case ContextSufficiencyStateName.Contaminated:
        return createDenyDecision(input, "context.contaminated.deny");
      case ContextSufficiencyStateName.Insufficient:
        return createDenyDecision(input, "context.insufficient.deny");
      default:
        return assertNever(input.contextSufficiencyState.state);
    }
  },
});
