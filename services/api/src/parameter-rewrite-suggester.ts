import {
  Environment,
  OperationType,
  ToolType,
  type ActionTuple,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

export type ParameterRewriteInput = {
  request: ToolCallRequest;
  actionTuple: ActionTuple;
};

export type ParameterRewriteSuggester = {
  suggestRewrite: (input: ParameterRewriteInput) => ToolCallRequest | null;
};

const rewriteRequestId = (request: ToolCallRequest, suffix: string) =>
  `${request.id}:rewrite:${suffix}`;

const appendRewritePurpose = (request: ToolCallRequest, purpose: string) =>
  `${purpose}: ${request.taskPurpose}`;

const readFilter = ({ parameters }: ActionTuple) => {
  const filter = parameters.filter;

  return typeof filter === "string" && filter.trim().length > 0
    ? filter.trim()
    : null;
};

const quoteSqlIdentifier = (identifier: string) =>
  /^[a-zA-Z_][\w$]*$/.test(identifier)
    ? identifier
    : `"${identifier.replaceAll('"', '""')}"`;

const suggestSqlDeleteCount = ({
  request,
  actionTuple,
}: ParameterRewriteInput): ToolCallRequest | null => {
  if (
    actionTuple.toolType !== ToolType.Sql ||
    actionTuple.operation !== OperationType.Delete
  ) {
    return null;
  }

  const filter = readFilter(actionTuple);
  const sql = `SELECT COUNT(*) FROM ${quoteSqlIdentifier(actionTuple.target)}${
    filter ? ` WHERE ${filter}` : ""
  }`;

  return {
    ...request,
    id: rewriteRequestId(request, "select-count"),
    taskPurpose: appendRewritePurpose(
      request,
      "Estimate affected rows with a read-only query",
    ),
    rawPayload: {
      ...request.rawPayload,
      sql,
      operation: "select",
      rewriteReason: "destructive_sql_delete_to_select_count",
      sourceRequestId: request.id,
    },
  };
};

const suggestProductionDeployCanary = ({
  request,
  actionTuple,
}: ParameterRewriteInput): ToolCallRequest | null => {
  if (
    actionTuple.toolType !== ToolType.CiCd ||
    actionTuple.operation !== OperationType.Deploy ||
    actionTuple.environment !== Environment.Production
  ) {
    return null;
  }

  return {
    ...request,
    id: rewriteRequestId(request, "canary-deploy"),
    taskPurpose: appendRewritePurpose(
      request,
      "Route production release through a staged canary",
    ),
    environment: Environment.Staging,
    rawPayload: {
      ...request.rawPayload,
      targetEnvironment: Environment.Staging,
      originalEnvironment: Environment.Production,
      deploymentStrategy: "canary",
      canaryPercentage: 10,
      requireApproval: true,
      rewriteReason: "production_deploy_to_staged_canary",
      sourceRequestId: request.id,
    },
  };
};

const suggestProductionConfigCanary = ({
  request,
  actionTuple,
}: ParameterRewriteInput): ToolCallRequest | null => {
  if (
    actionTuple.toolType !== ToolType.Config ||
    actionTuple.environment !== Environment.Production ||
    (actionTuple.operation !== OperationType.Update &&
      actionTuple.operation !== OperationType.ConfigUpdate)
  ) {
    return null;
  }

  return {
    ...request,
    id: rewriteRequestId(request, "config-canary"),
    taskPurpose: appendRewritePurpose(
      request,
      "Apply production config change through approval and canary rollout",
    ),
    environment: Environment.Staging,
    rawPayload: {
      ...request.rawPayload,
      targetEnvironment: Environment.Staging,
      originalEnvironment: Environment.Production,
      rolloutStrategy: "canary",
      canaryPercentage: 10,
      requireApproval: true,
      rewriteReason: "production_config_update_to_approved_canary",
      sourceRequestId: request.id,
    },
  };
};

export const createParameterRewriteSuggester = (): ParameterRewriteSuggester => ({
  suggestRewrite(input) {
    return (
      suggestSqlDeleteCount(input) ??
      suggestProductionDeployCanary(input) ??
      suggestProductionConfigCanary(input)
    );
  },
});
