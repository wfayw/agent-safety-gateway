import type { PatentProofHash } from "./patent-state-machine.js";
import {
  EvidenceCoverageStatusValues,
  ExecutorSafetyEvidenceStateName,
  isForbiddenEffectObligation,
  isPermitBinding,
  isPermitDeniedEvidence,
  type EvidenceCoverageStatus,
  type ExecutorSafetyEvidenceState,
  type ForbiddenEffectObligation,
  type PermitBinding,
  type PermitDeniedEvidence,
} from "./forbidden-side-effect.js";

export * from "./patent-state-machine.js";
export * from "./forbidden-side-effect.js";
export * from "./context-retention.js";

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

export const ManagementRole = {
  Viewer: "viewer",
  Operator: "operator",
  Approver: "approver",
  PolicyAdmin: "policy_admin",
  Auditor: "auditor",
} as const;

export type ManagementRole =
  (typeof ManagementRole)[keyof typeof ManagementRole];

export const ManagementPermission = {
  ViewAuditEvidence: "audit:evidence:view",
  AnalyzeToolCalls: "tool_calls:analyze",
  ExecuteToolCalls: "tool_calls:execute",
  ManageApprovals: "approvals:manage",
  ManagePolicies: "policies:manage",
} as const;

export type ManagementPermission =
  (typeof ManagementPermission)[keyof typeof ManagementPermission];

export const ManagementRolePermissions = {
  [ManagementRole.Viewer]: [ManagementPermission.ViewAuditEvidence],
  [ManagementRole.Operator]: [
    ManagementPermission.ViewAuditEvidence,
    ManagementPermission.AnalyzeToolCalls,
    ManagementPermission.ExecuteToolCalls,
  ],
  [ManagementRole.Approver]: [
    ManagementPermission.ViewAuditEvidence,
    ManagementPermission.ManageApprovals,
  ],
  [ManagementRole.PolicyAdmin]: [
    ManagementPermission.ViewAuditEvidence,
    ManagementPermission.AnalyzeToolCalls,
    ManagementPermission.ManagePolicies,
  ],
  [ManagementRole.Auditor]: [ManagementPermission.ViewAuditEvidence],
} as const satisfies Record<ManagementRole, readonly ManagementPermission[]>;

export const ManagementRoleValues = Object.values(
  ManagementRole,
) as ManagementRole[];

export const ManagementPermissionValues = Object.values(
  ManagementPermission,
) as ManagementPermission[];

const managementRoleValueSet = new Set<string>(ManagementRoleValues);

export const isManagementRole = (value: unknown): value is ManagementRole =>
  typeof value === "string" && managementRoleValueSet.has(value);

export const getManagementRolePermissions = (
  role: ManagementRole,
): readonly ManagementPermission[] => ManagementRolePermissions[role];

export const hasManagementPermission = (
  roles: readonly ManagementRole[],
  permission: ManagementPermission,
): boolean =>
  roles.some((role) => getManagementRolePermissions(role).includes(permission));

export const hasAnyManagementPermission = (
  roles: readonly ManagementRole[],
  permissions: readonly ManagementPermission[],
): boolean =>
  permissions.some((permission) => hasManagementPermission(roles, permission));

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

export type PolicyThresholds = {
  medium: number;
  high: number;
  prohibited: number;
};

export type PolicyTraceHardRule = {
  id: string;
  description: string;
  matched: boolean;
};

export type PolicyTraceWeightedFactor = {
  id: string;
  category: RiskFactorCategory;
  label: string;
  score: number;
  weight: number;
  weightedScore: number;
};

export type PolicyTrace = {
  thresholds: PolicyThresholds;
  weights: Record<RiskFactorCategory, number>;
  hardRules: PolicyTraceHardRule[];
  matchedRuleIds: string[];
  weightedFactors: PolicyTraceWeightedFactor[];
};

export type ExecutionDecision = {
  type: DecisionType;
  code: string;
  reason: string;
  recommendedAction: string;
  rewrittenRequest: ToolCallRequest | null;
};

export type AuditExecutorSafetyEvidence = {
  forbiddenEffectObligations: ForbiddenEffectObligation[];
  coverageMapHash: PatentProofHash | null;
  safetyEvidenceState: ExecutorSafetyEvidenceState | null;
  permitIssued: boolean;
  executorInvoked: boolean;
  permitBinding: PermitBinding | null;
  permitDeniedEvidence: PermitDeniedEvidence | null;
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
  policyVersion: string;
  policyTrace: PolicyTrace;
  decision: ExecutionDecision;
  createdAt: IsoTimestamp;
} & Partial<AuditExecutorSafetyEvidence>;

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

export const SqlScenarioFixtureId = {
  HighRiskDeleteOrders: "sql-delete-orders-production",
  LowRiskReadOrders: "sql-read-orders-production",
} as const;

export type SqlScenarioFixtureId =
  (typeof SqlScenarioFixtureId)[keyof typeof SqlScenarioFixtureId];

export const sqlScenarioFixtures = [
  {
    id: SqlScenarioFixtureId.HighRiskDeleteOrders,
    title: "Block production DELETE on pending orders",
    description:
      "A production SQL DELETE against the critical orders table must be prohibited before executor invocation.",
    request: {
      id: "req-sql-delete-orders-production",
      actor: "agent:ralph",
      taskPurpose: "Clean pending orders after a failed validation run",
      toolType: ToolType.Sql,
      rawPayload: {
        sql: "DELETE FROM orders WHERE status='PENDING'",
        database: "orders-prod",
      },
      environment: Environment.Production,
      createdAt: "2026-04-28T06:10:00.000Z",
    },
    expectedActionTuple: {
      actor: "agent:ralph",
      taskPurpose: "Clean pending orders after a failed validation run",
      toolType: ToolType.Sql,
      operation: OperationType.Delete,
      target: "orders",
      parameters: {
        sql: "DELETE FROM orders WHERE status='PENDING'",
        database: "orders-prod",
      },
      environment: Environment.Production,
      timestamp: "2026-04-28T06:10:00.000Z",
    },
    expectedRiskLevel: RiskLevel.Prohibited,
    expectedDecisionType: DecisionType.Block,
    evidenceRequirements: [
      "Gateway response explains destructive production SQL risk.",
      "Executor log proves the SQL executor was not invoked.",
      "Audit record preserves the original DELETE statement and blocked decision.",
    ],
    fixtures: {
      resources: [
        {
          id: "resource-db-table-orders-prod",
          name: "orders",
          type: ResourceType.DatabaseTable,
          system: "commerce",
          environment: Environment.Production,
          sensitivityLevel: SensitivityLevel.Restricted,
          criticalityLevel: CriticalityLevel.Critical,
          owner: "payments-platform",
          rollbackCapability: RollbackCapability.Manual,
        },
      ],
      expectedRiskFactors: [
        "production_environment",
        "destructive_sql",
        "critical_orders_table",
      ],
    },
  },
  {
    id: SqlScenarioFixtureId.LowRiskReadOrders,
    title: "Allow bounded production SELECT on orders",
    description:
      "A read-only SQL SELECT with a bounded result set may continue as the low-risk SQL control case.",
    request: {
      id: "req-sql-read-orders-production",
      actor: "agent:ralph",
      taskPurpose: "Inspect pending order volume before planning cleanup",
      toolType: ToolType.Sql,
      rawPayload: {
        sql: "SELECT COUNT(*) FROM orders WHERE status='PENDING'",
        database: "orders-prod-readonly",
      },
      environment: Environment.Production,
      createdAt: "2026-04-28T06:15:00.000Z",
    },
    expectedActionTuple: {
      actor: "agent:ralph",
      taskPurpose: "Inspect pending order volume before planning cleanup",
      toolType: ToolType.Sql,
      operation: OperationType.Read,
      target: "orders",
      parameters: {
        sql: "SELECT COUNT(*) FROM orders WHERE status='PENDING'",
        database: "orders-prod-readonly",
      },
      environment: Environment.Production,
      timestamp: "2026-04-28T06:15:00.000Z",
    },
    expectedRiskLevel: RiskLevel.Low,
    expectedDecisionType: DecisionType.Allow,
    evidenceRequirements: [
      "Gateway response identifies the SQL statement as read-only.",
      "Executor log proves the SQL executor was invoked once for the read query.",
      "Audit record preserves the original SELECT statement and allow decision.",
    ],
    fixtures: {
      resources: [
        {
          id: "resource-db-table-orders-prod",
          name: "orders",
          type: ResourceType.DatabaseTable,
          system: "commerce",
          environment: Environment.Production,
          sensitivityLevel: SensitivityLevel.Restricted,
          criticalityLevel: CriticalityLevel.Critical,
          owner: "payments-platform",
          rollbackCapability: RollbackCapability.Manual,
        },
      ],
      expectedRiskFactors: ["read_only_sql", "bounded_aggregate_query"],
    },
  },
] as const satisfies readonly Scenario[];

export const CiCdScenarioFixtureId = {
  ProductionDeployPaymentService: "cicd-deploy-payment-service-production",
  ProductionRollbackPaymentService:
    "cicd-rollback-payment-service-production",
} as const;

export type CiCdScenarioFixtureId =
  (typeof CiCdScenarioFixtureId)[keyof typeof CiCdScenarioFixtureId];

export const cicdScenarioFixtures = [
  {
    id: CiCdScenarioFixtureId.ProductionDeployPaymentService,
    title: "Block production deploy when payment-service tests failed",
    description:
      "A production payment-service deployment with failed tests must be blocked before the deploy executor runs.",
    request: {
      id: "req-cicd-deploy-payment-service-production",
      actor: "agent:ralph",
      taskPurpose:
        "Deploy payment-service v1.8.0 to production to restore timeout behavior",
      toolType: ToolType.CiCd,
      rawPayload: {
        service: "payment-service",
        version: "1.8.0",
        pipeline: "payment-service-release",
        stage: "deploy",
        testStatus: "failed",
      },
      environment: Environment.Production,
      createdAt: "2026-04-28T06:20:00.000Z",
    },
    expectedActionTuple: {
      actor: "agent:ralph",
      taskPurpose:
        "Deploy payment-service v1.8.0 to production to restore timeout behavior",
      toolType: ToolType.CiCd,
      operation: OperationType.Deploy,
      target: "payment-service",
      parameters: {
        service: "payment-service",
        version: "1.8.0",
        pipeline: "payment-service-release",
        stage: "deploy",
        testStatus: "failed",
      },
      environment: Environment.Production,
      timestamp: "2026-04-28T06:20:00.000Z",
    },
    expectedRiskLevel: RiskLevel.Prohibited,
    expectedDecisionType: DecisionType.Block,
    evidenceRequirements: [
      "Gateway response explains failed tests and production deployment risk.",
      "Executor log proves the deploy executor was not invoked.",
      "Audit record preserves service, version, test status, and blocked decision.",
    ],
    fixtures: {
      resources: [
        {
          id: "resource-service-payment-service-prod",
          name: "payment-service",
          type: ResourceType.Service,
          system: "payments",
          environment: Environment.Production,
          sensitivityLevel: SensitivityLevel.Restricted,
          criticalityLevel: CriticalityLevel.Critical,
          owner: "payments-platform",
          rollbackCapability: RollbackCapability.Manual,
        },
        {
          id: "resource-pipeline-payment-service-release-prod",
          name: "payment-service-release",
          type: ResourceType.Pipeline,
          system: "payments",
          environment: Environment.Production,
          sensitivityLevel: SensitivityLevel.Internal,
          criticalityLevel: CriticalityLevel.High,
          owner: "payments-platform",
          rollbackCapability: RollbackCapability.Automatic,
        },
      ],
      expectedRiskFactors: [
        "production_deploy",
        "test_status_failed",
        "critical_payment_service",
      ],
    },
  },
  {
    id: CiCdScenarioFixtureId.ProductionRollbackPaymentService,
    title: "Require approval for production payment-service rollback",
    description:
      "A production payment-service rollback is reversible but still affects a critical service, so it should require approval.",
    request: {
      id: "req-cicd-rollback-payment-service-production",
      actor: "agent:ralph",
      taskPurpose:
        "Rollback payment-service from v1.8.0 to v1.7.4 after deployment validation failed",
      toolType: ToolType.CiCd,
      rawPayload: {
        service: "payment-service",
        fromVersion: "1.8.0",
        toVersion: "1.7.4",
        pipeline: "payment-service-release",
        stage: "rollback",
        testStatus: "passed",
      },
      environment: Environment.Production,
      createdAt: "2026-04-28T06:25:00.000Z",
    },
    expectedActionTuple: {
      actor: "agent:ralph",
      taskPurpose:
        "Rollback payment-service from v1.8.0 to v1.7.4 after deployment validation failed",
      toolType: ToolType.CiCd,
      operation: OperationType.Rollback,
      target: "payment-service",
      parameters: {
        service: "payment-service",
        fromVersion: "1.8.0",
        toVersion: "1.7.4",
        pipeline: "payment-service-release",
        stage: "rollback",
        testStatus: "passed",
      },
      environment: Environment.Production,
      timestamp: "2026-04-28T06:25:00.000Z",
    },
    expectedRiskLevel: RiskLevel.Medium,
    expectedDecisionType: DecisionType.RequireApproval,
    evidenceRequirements: [
      "Gateway response identifies rollback as a production service change.",
      "Approval evidence records the target service and rollback versions.",
      "Audit record preserves rollback intent and recommended reviewer action.",
    ],
    fixtures: {
      resources: [
        {
          id: "resource-service-payment-service-prod",
          name: "payment-service",
          type: ResourceType.Service,
          system: "payments",
          environment: Environment.Production,
          sensitivityLevel: SensitivityLevel.Restricted,
          criticalityLevel: CriticalityLevel.Critical,
          owner: "payments-platform",
          rollbackCapability: RollbackCapability.Manual,
        },
      ],
      expectedRiskFactors: [
        "production_rollback",
        "critical_payment_service",
        "manual_rollback_review",
      ],
    },
  },
] as const satisfies readonly Scenario[];

export const ConfigScenarioFixtureId = {
  ProductionPaymentTimeoutUpdate: "config-payment-timeout-production",
} as const;

export type ConfigScenarioFixtureId =
  (typeof ConfigScenarioFixtureId)[keyof typeof ConfigScenarioFixtureId];

export const configScenarioFixtures = [
  {
    id: ConfigScenarioFixtureId.ProductionPaymentTimeoutUpdate,
    title: "Sandbox production payment.timeout config update",
    description:
      "A production payment.timeout change for payment-service should be redirected to a sandbox path before any production config write.",
    request: {
      id: "req-config-payment-timeout-production",
      actor: "agent:ralph",
      taskPurpose:
        "Reduce payment-service timeout to 100ms to shorten user waiting time",
      toolType: ToolType.Config,
      rawPayload: {
        service: "payment-service",
        key: "payment.timeout",
        value: "100ms",
        previousValue: "2s",
        namespace: "production",
      },
      environment: Environment.Production,
      createdAt: "2026-04-28T06:30:00.000Z",
    },
    expectedActionTuple: {
      actor: "agent:ralph",
      taskPurpose:
        "Reduce payment-service timeout to 100ms to shorten user waiting time",
      toolType: ToolType.Config,
      operation: OperationType.Update,
      target: "payment-service.payment.timeout",
      parameters: {
        service: "payment-service",
        key: "payment.timeout",
        value: "100ms",
        previousValue: "2s",
        namespace: "production",
      },
      environment: Environment.Production,
      timestamp: "2026-04-28T06:30:00.000Z",
    },
    expectedRiskLevel: RiskLevel.Medium,
    expectedDecisionType: DecisionType.Sandbox,
    evidenceRequirements: [
      "Gateway response explains production config impact on payment-service.",
      "Executor log proves production config writer was not invoked directly.",
      "Audit record preserves the requested key, value, and sandbox decision.",
    ],
    fixtures: {
      resources: [
        {
          id: "resource-config-payment-timeout-prod",
          name: "payment.timeout",
          type: ResourceType.ConfigKey,
          system: "payments",
          environment: Environment.Production,
          sensitivityLevel: SensitivityLevel.Confidential,
          criticalityLevel: CriticalityLevel.High,
          owner: "payments-platform",
          rollbackCapability: RollbackCapability.Automatic,
        },
        {
          id: "resource-service-payment-service-prod",
          name: "payment-service",
          type: ResourceType.Service,
          system: "payments",
          environment: Environment.Production,
          sensitivityLevel: SensitivityLevel.Restricted,
          criticalityLevel: CriticalityLevel.Critical,
          owner: "payments-platform",
          rollbackCapability: RollbackCapability.Manual,
        },
      ],
      dependencies: [
        {
          sourceResourceId: "resource-service-payment-service-prod",
          targetResourceId: "resource-config-payment-timeout-prod",
          relationType: ResourceDependencyRelationType.Configures,
          direction: ResourceDependencyDirection.Upstream,
          environment: Environment.Production,
          enabled: true,
        },
      ],
      expectedRiskFactors: [
        "production_config_update",
        "critical_payment_service",
        "sandbox_before_production_write",
      ],
    },
  },
] as const satisfies readonly Scenario[];

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

const readBoolean = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: IssueCollector,
): boolean => {
  const value = input[key];

  if (typeof value !== "boolean") {
    addIssue(
      collector,
      childPath(path, key),
      "invalid_boolean",
      "Expected a boolean.",
    );
    return false;
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

const readStringEnumArray = <TValue extends string>(
  input: Record<string, unknown>,
  key: string,
  allowedValues: readonly TValue[],
  path: string,
  collector: IssueCollector,
): TValue[] => {
  const values = readStringArray(input, key, path, collector);
  const invalidValues = values.filter(
    (value): value is string => !allowedValues.includes(value as TValue),
  );

  if (invalidValues.length > 0) {
    addIssue(
      collector,
      childPath(path, key),
      "invalid_enum_array",
      `Expected array values from: ${allowedValues.join(", ")}.`,
    );
  }

  return values.filter((value): value is TValue =>
    allowedValues.includes(value as TValue),
  );
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

const readOptionalArray = <T>(
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: IssueCollector,
  validateItem: (item: unknown, itemPath: string, collector: IssueCollector) => T,
): T[] | undefined => {
  if (input[key] === undefined) {
    return undefined;
  }

  return readArray(input, key, path, collector, validateItem);
};

const readOptionalNullableString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: IssueCollector,
): string | null | undefined => {
  const value = input[key];

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || value.length === 0) {
    addIssue(
      collector,
      childPath(path, key),
      "invalid_nullable_string",
      "Expected a non-empty string or null.",
    );
    return null;
  }

  return value;
};

const readOptionalBoolean = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: IssueCollector,
): boolean | undefined => {
  const value = input[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    addIssue(
      collector,
      childPath(path, key),
      "invalid_boolean",
      "Expected a boolean.",
    );
    return false;
  }

  return value;
};

const readOptionalStringProperty = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: IssueCollector,
): string | undefined => {
  const value = input[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.length === 0) {
    addIssue(
      collector,
      childPath(path, key),
      "invalid_string",
      "Expected a non-empty string.",
    );
    return undefined;
  }

  return value;
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

const validatePolicyTraceHardRule = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): PolicyTraceHardRule => {
  const record = readObject(input, path, collector);
  const matched = record.matched;

  if (typeof matched !== "boolean") {
    addIssue(
      collector,
      childPath(path, "matched"),
      "invalid_boolean",
      "Expected a boolean.",
    );
  }

  return {
    id: readString(record, "id", path, collector),
    description: readString(record, "description", path, collector),
    matched: typeof matched === "boolean" ? matched : false,
  };
};

const validatePolicyTraceWeightedFactor = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): PolicyTraceWeightedFactor => {
  const record = readObject(input, path, collector);

  return {
    id: readString(record, "id", path, collector),
    category: readEnum(record, "category", RiskFactorCategory, path, collector),
    label: readString(record, "label", path, collector),
    score: readNumber(record, "score", path, collector),
    weight: readNumber(record, "weight", path, collector),
    weightedScore: readNumber(record, "weightedScore", path, collector),
  };
};

const validatePolicyThresholds = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): PolicyThresholds => {
  const record = readObject(input, path, collector);

  return {
    medium: readNumber(record, "medium", path, collector),
    high: readNumber(record, "high", path, collector),
    prohibited: readNumber(record, "prohibited", path, collector),
  };
};

const validatePolicyWeights = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): Record<RiskFactorCategory, number> => {
  const record = readObject(input, path, collector);

  return {
    [RiskFactorCategory.Operation]: readNumber(
      record,
      RiskFactorCategory.Operation,
      path,
      collector,
    ),
    [RiskFactorCategory.Environment]: readNumber(
      record,
      RiskFactorCategory.Environment,
      path,
      collector,
    ),
    [RiskFactorCategory.ResourceCriticality]: readNumber(
      record,
      RiskFactorCategory.ResourceCriticality,
      path,
      collector,
    ),
    [RiskFactorCategory.DependencyImpact]: readNumber(
      record,
      RiskFactorCategory.DependencyImpact,
      path,
      collector,
    ),
    [RiskFactorCategory.ValidationState]: readNumber(
      record,
      RiskFactorCategory.ValidationState,
      path,
      collector,
    ),
    [RiskFactorCategory.Reversibility]: readNumber(
      record,
      RiskFactorCategory.Reversibility,
      path,
      collector,
    ),
  };
};

const validatePolicyTrace = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): PolicyTrace => {
  const record = readObject(input, path, collector);

  return {
    thresholds: validatePolicyThresholds(
      record.thresholds,
      childPath(path, "thresholds"),
      collector,
    ),
    weights: validatePolicyWeights(
      record.weights,
      childPath(path, "weights"),
      collector,
    ),
    hardRules: readArray(
      record,
      "hardRules",
      path,
      collector,
      validatePolicyTraceHardRule,
    ),
    matchedRuleIds: readStringArray(record, "matchedRuleIds", path, collector),
    weightedFactors: readArray(
      record,
      "weightedFactors",
      path,
      collector,
      validatePolicyTraceWeightedFactor,
    ),
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

const validateForbiddenEffectObligationForAudit = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): ForbiddenEffectObligation => {
  if (!isForbiddenEffectObligation(input)) {
    addIssue(
      collector,
      path,
      "invalid_forbidden_effect_obligation",
      "Expected a forbidden side-effect obligation.",
    );
  }

  return input as ForbiddenEffectObligation;
};

const validateAuditExecutorSafetyState = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): ExecutorSafetyEvidenceState => {
  const record = readObject(input, path, collector);
  const safetyState: ExecutorSafetyEvidenceState = {
    stateId: readString(record, "stateId", path, collector),
    executorId: readString(record, "executorId", path, collector),
    coverageMapId: readString(record, "coverageMapId", path, collector),
    state: readEnum(
      record,
      "state",
      ExecutorSafetyEvidenceStateName,
      path,
      collector,
    ),
    allObligationsCovered: readBoolean(
      record,
      "allObligationsCovered",
      path,
      collector,
    ),
    evaluatedAt: readString(record, "evaluatedAt", path, collector),
    coveredObligationIds: readStringArray(
      record,
      "coveredObligationIds",
      path,
      collector,
    ),
    blockedObligationIds: readStringArray(
      record,
      "blockedObligationIds",
      path,
      collector,
    ),
    blockingStatuses: readStringEnumArray<EvidenceCoverageStatus>(
      record,
      "blockingStatuses",
      EvidenceCoverageStatusValues,
      path,
      collector,
    ),
    transitionReason: readString(record, "transitionReason", path, collector),
  };
  const validUntil = readOptionalStringProperty(
    record,
    "validUntil",
    path,
    collector,
  );
  const invalidatedBy = readOptionalStringProperty(
    record,
    "invalidatedBy",
    path,
    collector,
  );
  const coverageMapHash = readOptionalStringProperty(
    record,
    "coverageMapHash",
    path,
    collector,
  );
  const safetyEvidenceVersion = readOptionalStringProperty(
    record,
    "safetyEvidenceVersion",
    path,
    collector,
  );

  if (validUntil !== undefined) {
    safetyState.validUntil = validUntil;
  }

  if (invalidatedBy !== undefined) {
    safetyState.invalidatedBy = invalidatedBy;
  }

  if (coverageMapHash !== undefined) {
    safetyState.coverageMapHash = coverageMapHash;
  }

  if (safetyEvidenceVersion !== undefined) {
    safetyState.safetyEvidenceVersion = safetyEvidenceVersion;
  }

  return safetyState;
};

const validateOptionalNullableAuditObject = <T>(
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: IssueCollector,
  validate: (value: unknown, valuePath: string, collector: IssueCollector) => T,
): T | null | undefined => {
  const value = input[key];

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return validate(value, childPath(path, key), collector);
};

const validateAuditPermitBinding = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): PermitBinding => {
  if (!isPermitBinding(input)) {
    addIssue(
      collector,
      path,
      "invalid_permit_binding",
      "Expected a permit binding.",
    );
  }

  return input as PermitBinding;
};

const validateAuditPermitDeniedEvidence = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): PermitDeniedEvidence => {
  if (!isPermitDeniedEvidence(input)) {
    addIssue(
      collector,
      path,
      "invalid_permit_denied_evidence",
      "Expected permit denied evidence.",
    );
  }

  return input as PermitDeniedEvidence;
};

const validateAuditRecord = (
  input: unknown,
  path: string,
  collector: IssueCollector,
): AuditRecord => {
  const record = readObject(input, path, collector);
  const auditRecord: AuditRecord = {
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
    policyVersion: readString(record, "policyVersion", path, collector),
    policyTrace: validatePolicyTrace(
      record.policyTrace,
      childPath(path, "policyTrace"),
      collector,
    ),
    decision: validateExecutionDecision(
      record.decision,
      childPath(path, "decision"),
      collector,
    ),
    createdAt: readString(record, "createdAt", path, collector),
  };
  const forbiddenEffectObligations = readOptionalArray(
    record,
    "forbiddenEffectObligations",
    path,
    collector,
    validateForbiddenEffectObligationForAudit,
  );
  const coverageMapHash = readOptionalNullableString(
    record,
    "coverageMapHash",
    path,
    collector,
  );
  const safetyEvidenceState = validateOptionalNullableAuditObject(
    record,
    "safetyEvidenceState",
    path,
    collector,
    validateAuditExecutorSafetyState,
  );
  const permitIssued = readOptionalBoolean(
    record,
    "permitIssued",
    path,
    collector,
  );
  const executorInvoked = readOptionalBoolean(
    record,
    "executorInvoked",
    path,
    collector,
  );
  const permitBinding = validateOptionalNullableAuditObject(
    record,
    "permitBinding",
    path,
    collector,
    validateAuditPermitBinding,
  );
  const permitDeniedEvidence = validateOptionalNullableAuditObject(
    record,
    "permitDeniedEvidence",
    path,
    collector,
    validateAuditPermitDeniedEvidence,
  );

  if (forbiddenEffectObligations !== undefined) {
    auditRecord.forbiddenEffectObligations = forbiddenEffectObligations;
  }

  if (coverageMapHash !== undefined) {
    auditRecord.coverageMapHash = coverageMapHash;
  }

  if (safetyEvidenceState !== undefined) {
    auditRecord.safetyEvidenceState = safetyEvidenceState;
  }

  if (permitIssued !== undefined) {
    auditRecord.permitIssued = permitIssued;
  }

  if (executorInvoked !== undefined) {
    auditRecord.executorInvoked = executorInvoked;
  }

  if (permitBinding !== undefined) {
    auditRecord.permitBinding = permitBinding;
  }

  if (permitDeniedEvidence !== undefined) {
    auditRecord.permitDeniedEvidence = permitDeniedEvidence;
  }

  return auditRecord;
};

export const ToolCallRequestSchema = createSchema<ToolCallRequest>(
  validateToolCallRequest,
);

export const ActionTupleSchema = createSchema<ActionTuple>(validateActionTuple);

export const ExecutionDecisionSchema = createSchema<ExecutionDecision>(
  validateExecutionDecision,
);

export const AuditRecordSchema = createSchema<AuditRecord>(validateAuditRecord);
