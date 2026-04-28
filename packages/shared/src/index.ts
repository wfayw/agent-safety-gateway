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

export const ResourceType = {
  DatabaseTable: "database_table",
  Service: "service",
  Pipeline: "pipeline",
  ConfigKey: "config_key",
  Queue: "queue",
  ExternalDependency: "external_dependency",
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

export const SensitivityLevel = {
  Public: "public",
  Internal: "internal",
  Confidential: "confidential",
  Restricted: "restricted",
} as const;

export type SensitivityLevel =
  (typeof SensitivityLevel)[keyof typeof SensitivityLevel];

export const CriticalityLevel = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Critical: "critical",
} as const;

export type CriticalityLevel =
  (typeof CriticalityLevel)[keyof typeof CriticalityLevel];

export const RollbackCapability = {
  Automatic: "automatic",
  Manual: "manual",
  None: "none",
  Unknown: "unknown",
} as const;

export type RollbackCapability =
  (typeof RollbackCapability)[keyof typeof RollbackCapability];

export const ResourceDependencyRelationType = {
  ReadsFrom: "reads_from",
  WritesTo: "writes_to",
  DependsOn: "depends_on",
  DeploysTo: "deploys_to",
  Configures: "configures",
  PublishesTo: "publishes_to",
  ConsumesFrom: "consumes_from",
} as const;

export type ResourceDependencyRelationType =
  (typeof ResourceDependencyRelationType)[keyof typeof ResourceDependencyRelationType];

export const ResourceDependencyDirection = {
  Upstream: "upstream",
  Downstream: "downstream",
  Bidirectional: "bidirectional",
} as const;

export type ResourceDependencyDirection =
  (typeof ResourceDependencyDirection)[keyof typeof ResourceDependencyDirection];

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

export type AffectedResource = {
  id: string;
  name: string;
  type: ResourceType;
  system: string;
  environment: Environment;
  sensitivityLevel: SensitivityLevel;
  criticalityLevel: CriticalityLevel;
  owner: string;
  rollbackCapability: RollbackCapability;
};

export type ResourceDependency = {
  sourceResourceId: string;
  targetResourceId: string;
  relationType: ResourceDependencyRelationType;
  direction: ResourceDependencyDirection;
  environment: Environment;
  enabled: boolean;
};

export type ImpactPath = {
  originResourceId: string;
  impactedResourceId: string;
  resourceIds: string[];
  dependencyIds: string[];
  depth: number;
  environment: Environment;
};
