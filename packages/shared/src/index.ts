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

export const RiskFactorCategory = {
  Operation: "operation",
  Environment: "environment",
  ResourceCriticality: "resource_criticality",
  DependencyImpact: "dependency_impact",
  ValidationState: "validation_state",
  Reversibility: "reversibility",
} as const;

export type RiskFactorCategory =
  (typeof RiskFactorCategory)[keyof typeof RiskFactorCategory];

export const RiskFactorSeverity = {
  Informational: "informational",
  Warning: "warning",
  Critical: "critical",
} as const;

export type RiskFactorSeverity =
  (typeof RiskFactorSeverity)[keyof typeof RiskFactorSeverity];

export type RiskFactor = {
  category: RiskFactorCategory;
  label: string;
  severity: RiskFactorSeverity;
  score: number;
  reason: string;
};

export type ExecutionDecision = {
  type: DecisionType;
  code: string;
  reason: string;
  recommendedAction: string;
  rewrittenRequest: ToolCallRequest | null;
};

export type AuditRecord = {
  id: string;
  request: ToolCallRequest;
  actionTuple: ActionTuple;
  directResources: AffectedResource[];
  indirectResources: AffectedResource[];
  impactPaths: ImpactPath[];
  riskFactors: RiskFactor[];
  riskLevel: RiskLevel;
  decision: ExecutionDecision;
  createdAt: IsoTimestamp;
};

export type Scenario = {
  id: string;
  title: string;
  description: string;
  request: ToolCallRequest;
  expectedActionTuple: ActionTuple;
  expectedRiskLevel: RiskLevel;
  expectedDecisionType: DecisionType;
  evidenceRequirements: string[];
  fixtures: JsonObject;
};

export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ValidationSuccess<T> = {
  success: true;
  data: T;
};

export type ValidationFailure = {
  success: false;
  issues: ValidationIssue[];
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export type RuntimeSchema<T> = {
  parse(input: unknown): T;
  safeParse(input: unknown): ValidationResult<T>;
};

export class SchemaValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("Schema validation failed");
    this.name = "SchemaValidationError";
    this.issues = issues;
  }
}

type IssueCollector = {
  issues: ValidationIssue[];
};

type EnumLike = Record<string, string>;

const createSchema = <T>(
  validate: (input: unknown, path: string, collector: IssueCollector) => T,
): RuntimeSchema<T> => ({
  parse(input) {
    const collector: IssueCollector = { issues: [] };
    const data = validate(input, "$", collector);

    if (collector.issues.length > 0) {
      throw new SchemaValidationError(collector.issues);
    }

    return data;
  },
  safeParse(input) {
    const collector: IssueCollector = { issues: [] };
    const data = validate(input, "$", collector);

    if (collector.issues.length > 0) {
      return { success: false, issues: collector.issues };
    }

    return { success: true, data };
  },
});

const addIssue = (
  collector: IssueCollector,
  path: string,
  code: string,
  message: string,
) => {
  collector.issues.push({ path, code, message });
};

const childPath = (path: string, key: string) => `${path}.${key}`;

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const isJsonValue = (input: unknown): input is JsonValue => {
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return typeof input !== "number" || Number.isFinite(input);
  }

  if (Array.isArray(input)) {
    return input.every(isJsonValue);
  }

  if (!isRecord(input)) {
    return false;
  }

  return Object.values(input).every(isJsonValue);
};

const readString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: IssueCollector,
): string => {
  const value = input[key];

  if (typeof value !== "string" || value.length === 0) {
    addIssue(
      collector,
      childPath(path, key),
      "invalid_string",
      "Expected a non-empty string.",
    );
    return "";
  }

  return value;
};

const readNumber = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: IssueCollector,
): number => {
  const value = input[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    addIssue(
      collector,
      childPath(path, key),
      "invalid_number",
      "Expected a finite number.",
    );
    return 0;
  }

  return value;
};

const readStringArray = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: IssueCollector,
): string[] => {
  const value = input[key];
  const issuePath = childPath(path, key);

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    addIssue(
      collector,
      issuePath,
      "invalid_string_array",
      "Expected an array of strings.",
    );
    return [];
  }

  return value;
};

const readEnum = <TEnum extends EnumLike>(
  input: Record<string, unknown>,
  key: string,
  enumValues: TEnum,
  path: string,
  collector: IssueCollector,
): TEnum[keyof TEnum] => {
  const value = input[key];
  const allowedValues = Object.values(enumValues);

  if (typeof value !== "string" || !allowedValues.includes(value)) {
    addIssue(
      collector,
      childPath(path, key),
      "invalid_enum",
      `Expected one of: ${allowedValues.join(", ")}.`,
    );
    return allowedValues[0] as TEnum[keyof TEnum];
  }

  return value as TEnum[keyof TEnum];
};

const readJsonObject = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: IssueCollector,
): JsonObject => {
  const value = input[key];

  if (!isRecord(value) || !isJsonValue(value)) {
    addIssue(
      collector,
      childPath(path, key),
      "invalid_json_object",
      "Expected a JSON object.",
    );
    return {};
  }

  return value;
};

const readObject = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): Record<string, unknown> => {
  if (!isRecord(input)) {
    addIssue(collector, path, "invalid_object", "Expected an object.");
    return {};
  }

  return input;
};

const readArray = <T>(
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: IssueCollector,
  validateItem: (item: unknown, itemPath: string, collector: IssueCollector) => T,
): T[] => {
  const value = input[key];
  const issuePath = childPath(path, key);

  if (!Array.isArray(value)) {
    addIssue(collector, issuePath, "invalid_array", "Expected an array.");
    return [];
  }

  return value.map((item, index) =>
    validateItem(item, `${issuePath}[${index}]`, collector),
  );
};

const validateToolCallRequest = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): ToolCallRequest => {
  const record = readObject(input, path, collector);

  return {
    id: readString(record, "id", path, collector),
    actor: readString(record, "actor", path, collector),
    taskPurpose: readString(record, "taskPurpose", path, collector),
    toolType: readEnum(record, "toolType", ToolType, path, collector),
    rawPayload: readJsonObject(record, "rawPayload", path, collector),
    environment: readEnum(record, "environment", Environment, path, collector),
    createdAt: readString(record, "createdAt", path, collector),
  };
};

const validateActionTuple = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): ActionTuple => {
  const record = readObject(input, path, collector);

  return {
    actor: readString(record, "actor", path, collector),
    taskPurpose: readString(record, "taskPurpose", path, collector),
    toolType: readEnum(record, "toolType", ToolType, path, collector),
    operation: readEnum(record, "operation", OperationType, path, collector),
    target: readString(record, "target", path, collector),
    parameters: readJsonObject(record, "parameters", path, collector),
    environment: readEnum(record, "environment", Environment, path, collector),
    timestamp: readString(record, "timestamp", path, collector),
  };
};

const validateAffectedResource = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): AffectedResource => {
  const record = readObject(input, path, collector);

  return {
    id: readString(record, "id", path, collector),
    name: readString(record, "name", path, collector),
    type: readEnum(record, "type", ResourceType, path, collector),
    system: readString(record, "system", path, collector),
    environment: readEnum(record, "environment", Environment, path, collector),
    sensitivityLevel: readEnum(
      record,
      "sensitivityLevel",
      SensitivityLevel,
      path,
      collector,
    ),
    criticalityLevel: readEnum(
      record,
      "criticalityLevel",
      CriticalityLevel,
      path,
      collector,
    ),
    owner: readString(record, "owner", path, collector),
    rollbackCapability: readEnum(
      record,
      "rollbackCapability",
      RollbackCapability,
      path,
      collector,
    ),
  };
};

const validateImpactPath = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): ImpactPath => {
  const record = readObject(input, path, collector);

  return {
    originResourceId: readString(record, "originResourceId", path, collector),
    impactedResourceId: readString(record, "impactedResourceId", path, collector),
    resourceIds: readStringArray(record, "resourceIds", path, collector),
    dependencyIds: readStringArray(record, "dependencyIds", path, collector),
    depth: readNumber(record, "depth", path, collector),
    environment: readEnum(record, "environment", Environment, path, collector),
  };
};

const validateRiskFactor = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): RiskFactor => {
  const record = readObject(input, path, collector);

  return {
    category: readEnum(record, "category", RiskFactorCategory, path, collector),
    label: readString(record, "label", path, collector),
    severity: readEnum(record, "severity", RiskFactorSeverity, path, collector),
    score: readNumber(record, "score", path, collector),
    reason: readString(record, "reason", path, collector),
  };
};

const validateExecutionDecision = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): ExecutionDecision => {
  const record = readObject(input, path, collector);
  const rewrittenRequest = record.rewrittenRequest;
  let validatedRewrittenRequest: ToolCallRequest | null = null;

  if (rewrittenRequest === undefined) {
    addIssue(
      collector,
      childPath(path, "rewrittenRequest"),
      "invalid_nullable_object",
      "Expected a tool call request or null.",
    );
  } else if (rewrittenRequest !== null) {
    validatedRewrittenRequest = validateToolCallRequest(
      rewrittenRequest,
      childPath(path, "rewrittenRequest"),
      collector,
    );
  }

  return {
    type: readEnum(record, "type", DecisionType, path, collector),
    code: readString(record, "code", path, collector),
    reason: readString(record, "reason", path, collector),
    recommendedAction: readString(record, "recommendedAction", path, collector),
    rewrittenRequest: validatedRewrittenRequest,
  };
};

const validateAuditRecord = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): AuditRecord => {
  const record = readObject(input, path, collector);

  return {
    id: readString(record, "id", path, collector),
    request: validateToolCallRequest(
      record.request,
      childPath(path, "request"),
      collector,
    ),
    actionTuple: validateActionTuple(
      record.actionTuple,
      childPath(path, "actionTuple"),
      collector,
    ),
    directResources: readArray(
      record,
      "directResources",
      path,
      collector,
      validateAffectedResource,
    ),
    indirectResources: readArray(
      record,
      "indirectResources",
      path,
      collector,
      validateAffectedResource,
    ),
    impactPaths: readArray(
      record,
      "impactPaths",
      path,
      collector,
      validateImpactPath,
    ),
    riskFactors: readArray(
      record,
      "riskFactors",
      path,
      collector,
      validateRiskFactor,
    ),
    riskLevel: readEnum(record, "riskLevel", RiskLevel, path, collector),
    decision: validateExecutionDecision(
      record.decision,
      childPath(path, "decision"),
      collector,
    ),
    createdAt: readString(record, "createdAt", path, collector),
  };
};

export const ToolCallRequestSchema = createSchema<ToolCallRequest>(
  validateToolCallRequest,
);

export const ActionTupleSchema = createSchema<ActionTuple>(validateActionTuple);

export const ExecutionDecisionSchema = createSchema<ExecutionDecision>(
  validateExecutionDecision,
);

export const AuditRecordSchema = createSchema<AuditRecord>(validateAuditRecord);
