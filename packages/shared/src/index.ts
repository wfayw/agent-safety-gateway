export const ToolType = {
  Sql: "sql",
  CiCd: "ci_cd",
  Config: "config",
} as const;

export type ToolType = (typeof ToolType)[keyof typeof ToolType];

export const OperationType = {
  Read: "read",
  Create: "create",
  Update: "update",
  Delete: "delete",
  Deploy: "deploy",
  Rollback: "rollback",
  ConfigUpdate: "config_update",
} as const;

export type OperationType =
  (typeof OperationType)[keyof typeof OperationType];

export const Environment = {
  Development: "development",
  Test: "test",
  Staging: "staging",
  Production: "production",
} as const;

export type Environment = (typeof Environment)[keyof typeof Environment];

export const RiskLevel = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Prohibited: "prohibited",
} as const;

export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const DecisionType = {
  Allow: "allow",
  Block: "block",
  RequireApproval: "require_approval",
  Sandbox: "sandbox",
  Rewrite: "rewrite",
  Readonly: "readonly",
} as const;

export type DecisionType = (typeof DecisionType)[keyof typeof DecisionType];

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type IsoTimestamp = string;

export type ToolCallRequest = {
  id: string;
  actor: string;
  taskPurpose: string;
  toolType: ToolType;
  rawPayload: JsonObject;
  environment: Environment;
  createdAt: IsoTimestamp;
};

export type ActionTuple = {
  actor: string;
  taskPurpose: string;
  toolType: ToolType;
  operation: OperationType;
  target: string;
  parameters: JsonObject;
  environment: Environment;
  timestamp: IsoTimestamp;
};

export type ParseError = {
  code: string;
  message: string;
  field?: string;
  details?: JsonObject;
};
