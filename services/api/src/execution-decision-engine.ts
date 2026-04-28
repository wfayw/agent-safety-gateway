import {
  DecisionType,
  Environment,
  OperationType,
  RiskLevel,
  ToolType,
  type ActionTuple,
  type ExecutionDecision,
  type RiskLevel as RiskLevelValue,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

import type { RiskLevelScore } from "./risk-level-scorer.js";

export type ExecutionDecisionInput = {
  request: ToolCallRequest;
  actionTuple: ActionTuple;
  riskScore: Pick<
    RiskLevelScore,
    "riskLevel" | "score" | "explanation" | "reasons" | "appliedHardRules"
  >;
};

export type ExecutionDecisionEngine = {
  decideExecution: (input: ExecutionDecisionInput) => ExecutionDecision;
};

const toReason = ({ actionTuple, riskScore }: ExecutionDecisionInput) => {
  const reasonDetails = riskScore.reasons.slice(0, 3).join("; ");
  const detailsSuffix = reasonDetails.length > 0 ? ` Key evidence: ${reasonDetails}.` : "";

  return `${riskScore.explanation} Requested ${actionTuple.operation} on ${actionTuple.target} in ${actionTuple.environment}.${detailsSuffix}`;
};

const createDecision = (
  input: ExecutionDecisionInput,
  type: ExecutionDecision["type"],
  code: string,
  recommendedAction: string,
): ExecutionDecision => ({
  type,
  code,
  reason: toReason(input),
  recommendedAction,
  rewrittenRequest: null,
});

const isConfigProductionUpdate = ({ actionTuple }: ExecutionDecisionInput) =>
  actionTuple.toolType === ToolType.Config &&
  actionTuple.environment === Environment.Production &&
  (actionTuple.operation === OperationType.Update ||
    actionTuple.operation === OperationType.ConfigUpdate);

const shouldRewriteHighRiskRequest = ({ actionTuple }: ExecutionDecisionInput) =>
  actionTuple.toolType === ToolType.Sql &&
  actionTuple.operation === OperationType.Delete;

const decisionByRiskLevel: Record<
  RiskLevelValue,
  (input: ExecutionDecisionInput) => ExecutionDecision
> = {
  [RiskLevel.Low]: (input) =>
    createDecision(
      input,
      DecisionType.Allow,
      "risk.low.allow",
      "Allow the executor to run the requested tool call.",
    ),
  [RiskLevel.Medium]: (input) => {
    if (isConfigProductionUpdate(input)) {
      return createDecision(
        input,
        DecisionType.Sandbox,
        "risk.medium.sandbox_production_config",
        "Route the change to a sandbox or canary path before touching production config.",
      );
    }

    return createDecision(
      input,
      DecisionType.RequireApproval,
      "risk.medium.require_approval",
      "Require human approval before invoking the executor.",
    );
  },
  [RiskLevel.High]: (input) => {
    if (shouldRewriteHighRiskRequest(input)) {
      return createDecision(
        input,
        DecisionType.Rewrite,
        "risk.high.rewrite_destructive_sql",
        "Rewrite the destructive SQL into a safer read-only request before execution.",
      );
    }

    return createDecision(
      input,
      DecisionType.RequireApproval,
      "risk.high.require_approval",
      "Require explicit human approval with risk evidence before invoking the executor.",
    );
  },
  [RiskLevel.Prohibited]: (input) =>
    createDecision(
      input,
      DecisionType.Block,
      "risk.prohibited.block",
      "Block execution and do not invoke the executor.",
    ),
};

export const createExecutionDecisionEngine = (): ExecutionDecisionEngine => ({
  decideExecution(input) {
    return decisionByRiskLevel[input.riskScore.riskLevel](input);
  },
});
