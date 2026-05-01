import {
  EvidenceHashAlgorithm,
  PatentStateMachineDomain,
} from "./patent-state-machine.js";
import type {
  PatentProofHash,
  PatentProofTimestamp,
  StateMachineEntityId,
  StateMachineRunId,
} from "./patent-state-machine.js";

export const ContextRetentionDomainName =
  PatentStateMachineDomain.ContextRetention;

export type ContextRetentionDomainName = typeof ContextRetentionDomainName;

export type ToolCallCandidateId = StateMachineEntityId;

export type ActionImpactClassId = StateMachineEntityId;

export type RequiredContextObligationId = StateMachineEntityId;

export type ContextAnchorId = StateMachineEntityId;

export type PromptAssemblyManifestId = StateMachineEntityId;

export type PromptAssemblyManifestHash = PatentProofHash;

export type ContextRetentionEvidenceId = StateMachineEntityId;

export type ContextSufficiencyStateId = StateMachineEntityId;

export type RegroundingPlanId = StateMachineEntityId;

export type PermitDecisionId = StateMachineEntityId;

export type ContextAdequacyEvidenceId = StateMachineEntityId;

export type ContextRetentionRunId = StateMachineRunId;

export type ContextRetentionTimestamp = PatentProofTimestamp;

export const ContextAnchorType = {
  UserInstruction: "user_instruction",
  SystemPolicy: "system_policy",
  ApprovalNote: "approval_note",
  ToolResult: "tool_result",
  ResourceState: "resource_state",
  RetrievedDocument: "retrieved_document",
  NegativeEvidence: "negative_evidence",
  DelegationConstraint: "delegation_constraint",
} as const;

export type ContextAnchorType =
  (typeof ContextAnchorType)[keyof typeof ContextAnchorType];

export const ContextAnchorTypeValues = Object.values(
  ContextAnchorType,
) as ContextAnchorType[];

export const ContextAnchorTrustTier = {
  High: "high",
  Medium: "medium",
  Low: "low",
  Untrusted: "untrusted",
} as const;

export type ContextAnchorTrustTier =
  (typeof ContextAnchorTrustTier)[keyof typeof ContextAnchorTrustTier];

export const ContextAnchorTrustTierValues = Object.values(
  ContextAnchorTrustTier,
) as ContextAnchorTrustTier[];

export type ContextAnchor = {
  anchorId: ContextAnchorId;
  anchorType: ContextAnchorType;
  sourceIdentity: string;
  authorityLevel: string;
  resourceScope: string;
  createdAt: ContextRetentionTimestamp;
  expiresAt: ContextRetentionTimestamp;
  contentDigest: PatentProofHash;
  semanticClaimsDigest: PatentProofHash;
  mustBeVerbatim: boolean;
  allowCertifiedSummary: boolean;
  allowRetrievableReference: boolean;
  trustTier: ContextAnchorTrustTier;
};

export const ContextRetentionMode = {
  Verbatim: "verbatim",
  CertifiedSummary: "certified_summary",
  RetrievableReference: "retrievable_reference",
  Missing: "missing",
  Stale: "stale",
  Conflicting: "conflicting",
  Tainted: "tainted",
} as const;

export type ContextRetentionMode =
  (typeof ContextRetentionMode)[keyof typeof ContextRetentionMode];

export const ContextRetentionModeValues = Object.values(
  ContextRetentionMode,
) as ContextRetentionMode[];

export const RequiredContextMinimumRetentionModeValues = [
  ContextRetentionMode.Verbatim,
  ContextRetentionMode.CertifiedSummary,
  ContextRetentionMode.RetrievableReference,
] as const;

export type RequiredContextMinimumRetentionMode =
  (typeof RequiredContextMinimumRetentionModeValues)[number];

export const RequiredContextConflictPolicy = {
  DenyOnOmittedConflict: "deny_on_omitted_conflict",
} as const;

export type RequiredContextConflictPolicy =
  (typeof RequiredContextConflictPolicy)[keyof typeof RequiredContextConflictPolicy];

export const RequiredContextConflictPolicyValues = Object.values(
  RequiredContextConflictPolicy,
) as RequiredContextConflictPolicy[];

export const RequiredContextTaintPolicy = {
  DenyOnUntrustedInstruction: "deny_on_untrusted_instruction",
} as const;

export type RequiredContextTaintPolicy =
  (typeof RequiredContextTaintPolicy)[keyof typeof RequiredContextTaintPolicy];

export const RequiredContextTaintPolicyValues = Object.values(
  RequiredContextTaintPolicy,
) as RequiredContextTaintPolicy[];

export const RequiredContextMissingAnchorAction = {
  Reground: "reground",
  Reapproval: "reapproval",
  Deny: "deny",
  RegroundOrDeny: "reground_or_deny",
} as const;

export type RequiredContextMissingAnchorAction =
  (typeof RequiredContextMissingAnchorAction)[keyof typeof RequiredContextMissingAnchorAction];

export const RequiredContextMissingAnchorActionValues = Object.values(
  RequiredContextMissingAnchorAction,
) as RequiredContextMissingAnchorAction[];

export type RequiredContextFreshnessWindow = string;

export type RequiredContextObligation = {
  obligationId: RequiredContextObligationId;
  toolCallDigest: PatentProofHash;
  actionImpactClass: ActionImpactClassId;
  requiredAnchors: readonly ContextAnchorId[];
  freshnessWindow: RequiredContextFreshnessWindow;
  minimumRetentionMode: RequiredContextMinimumRetentionMode;
  conflictPolicy: RequiredContextConflictPolicy;
  taintPolicy: RequiredContextTaintPolicy;
  missingAnchorAction: RequiredContextMissingAnchorAction;
};

export type RequiredContextObligationCompilerInput<
  TToolCallCandidate = unknown,
> = {
  toolCallCandidate: TToolCallCandidate;
  toolCallDigest: PatentProofHash;
  actionImpactClass: ActionImpactClassId;
  availableAnchors: readonly ContextAnchor[];
  candidateId?: ToolCallCandidateId;
};

export type RequiredContextObligationCompilation = {
  toolCallDigest: PatentProofHash;
  actionImpactClass: ActionImpactClassId;
  obligations: readonly RequiredContextObligation[];
};

export type ToolSpecificRequiredContextObligationCompiler<
  TToolCallCandidate = unknown,
> = {
  toolType: string;
  compileRequiredContextObligations(
    input: RequiredContextObligationCompilerInput<TToolCallCandidate>,
  ):
    | RequiredContextObligationCompilation
    | Promise<RequiredContextObligationCompilation>;
};

export const SqlRequiredContextOperation = {
  Select: "select",
  Insert: "insert",
  Update: "update",
  Delete: "delete",
  Drop: "drop",
  Truncate: "truncate",
  Alter: "alter",
  Unknown: "unknown",
} as const;

export type SqlRequiredContextOperation =
  (typeof SqlRequiredContextOperation)[keyof typeof SqlRequiredContextOperation];

export const SqlRequiredContextObligationKind = {
  ReadonlyContext: "readonly_context",
  WriteContext: "write_context",
  UncertaintyContext: "uncertainty_context",
} as const;

export type SqlRequiredContextObligationKind =
  (typeof SqlRequiredContextObligationKind)[keyof typeof SqlRequiredContextObligationKind];

export const SqlRequiredContextAnchorRole = {
  LatestUserInstruction: "latest_user_instruction",
  SqlPolicy: "sql_policy",
  TargetResourceState: "target_resource_state",
  RollbackContext: "rollback_context",
  Uncertainty: "uncertainty",
} as const;

export type SqlRequiredContextAnchorRole =
  (typeof SqlRequiredContextAnchorRole)[keyof typeof SqlRequiredContextAnchorRole];

export type SqlRequiredContextToolCallCandidate = {
  sql: string;
  requestId?: string;
  resourceScope?: readonly string[];
};

export type SqlRequiredContextObligationCompilerInput = {
  sql: string;
  toolCallDigest: PatentProofHash;
  availableAnchors: readonly ContextAnchor[];
  requestId?: string;
  actionImpactClass?: ActionImpactClassId;
  resourceScope?: readonly string[];
};

export type SqlRequiredContextAnchorRequirement = {
  role: SqlRequiredContextAnchorRole;
  anchorId: ContextAnchorId;
  resourceScope: string;
};

export type SqlRequiredContextObligationCompilation =
  RequiredContextObligationCompilation & {
    normalizedSql: string;
    operation: SqlRequiredContextOperation;
    resourceScope: readonly string[];
    unresolvedTables: readonly string[];
    obligationKind: SqlRequiredContextObligationKind;
    requiresUncertaintyAnchors: boolean;
    requiredAnchorRoles: readonly SqlRequiredContextAnchorRequirement[];
  };

export const CiCdRequiredContextOperation = {
  Deploy: "deploy",
  Release: "release",
  Promote: "promote",
  Rollback: "rollback",
  Unknown: "unknown",
} as const;

export type CiCdRequiredContextOperation =
  (typeof CiCdRequiredContextOperation)[keyof typeof CiCdRequiredContextOperation];

export const CiCdRequiredContextTestStatus = {
  Passed: "passed",
  Failed: "failed",
  Unknown: "unknown",
  Missing: "missing",
} as const;

export type CiCdRequiredContextTestStatus =
  (typeof CiCdRequiredContextTestStatus)[keyof typeof CiCdRequiredContextTestStatus];

export const CiCdRequiredContextObligationKind = {
  ProductionDeployContext: "production_deploy_context",
  DryRunDeployContext: "dry_run_deploy_context",
  UncertainDeployContext: "uncertain_deploy_context",
} as const;

export type CiCdRequiredContextObligationKind =
  (typeof CiCdRequiredContextObligationKind)[keyof typeof CiCdRequiredContextObligationKind];

export const CiCdRequiredContextAnchorRole = {
  LatestUserInstruction: "latest_user_instruction",
  ApprovalNote: "approval_note",
  TestResult: "test_result",
  ReleasePolicy: "release_policy",
  PipelineState: "pipeline_state",
  NegativeTestEvidence: "negative_test_evidence",
} as const;

export type CiCdRequiredContextAnchorRole =
  (typeof CiCdRequiredContextAnchorRole)[keyof typeof CiCdRequiredContextAnchorRole];

export type CiCdRequiredContextToolCallCandidate = {
  operation?: string;
  service?: string;
  pipeline?: string;
  version?: string;
  requestId?: string;
  environment?: string;
  targetEnvironment?: string;
  requiredExecutionMode?: string;
  dryRun?: boolean;
  testStatus?: string;
  resourceScope?: readonly string[];
};

export type CiCdRequiredContextObligationCompilerInput =
  CiCdRequiredContextToolCallCandidate & {
    toolCallDigest: PatentProofHash;
    availableAnchors: readonly ContextAnchor[];
    actionImpactClass?: ActionImpactClassId;
  };

export type CiCdRequiredContextAnchorRequirement = {
  role: CiCdRequiredContextAnchorRole;
  anchorId: ContextAnchorId;
  anchorType: ContextAnchorType;
  resourceScope: string;
  minimumRetentionMode: RequiredContextMinimumRetentionMode;
};

export type CiCdRequiredContextObligationCompilation =
  RequiredContextObligationCompilation & {
    operation: CiCdRequiredContextOperation;
    resourceScope: readonly string[];
    targetEnvironment: string;
    dryRun: boolean;
    testStatus: CiCdRequiredContextTestStatus;
    obligationKind: CiCdRequiredContextObligationKind;
    requiresNegativeEvidenceAnchors: boolean;
    dryRunOnlyApproval: boolean;
    requiredAnchorRoles: readonly CiCdRequiredContextAnchorRequirement[];
  };

export const ConfigRequiredContextOperation = {
  Read: "read",
  Create: "create",
  Update: "update",
  Delete: "delete",
  Rollback: "rollback",
  Unknown: "unknown",
} as const;

export type ConfigRequiredContextOperation =
  (typeof ConfigRequiredContextOperation)[keyof typeof ConfigRequiredContextOperation];

export const ConfigRequiredContextNamespaceClassification = {
  Production: "production",
  Sandbox: "sandbox",
  Canary: "canary",
  NonProduction: "non_production",
  Unknown: "unknown",
} as const;

export type ConfigRequiredContextNamespaceClassification =
  (typeof ConfigRequiredContextNamespaceClassification)[keyof typeof ConfigRequiredContextNamespaceClassification];

export const ConfigRequiredContextObligationKind = {
  ProductionConfigChangeContext: "production_config_change_context",
  SandboxNamespaceConstrainedContext: "sandbox_namespace_constrained_context",
  CanaryNamespaceConstrainedContext: "canary_namespace_constrained_context",
  UncertainConfigChangeContext: "uncertain_config_change_context",
} as const;

export type ConfigRequiredContextObligationKind =
  (typeof ConfigRequiredContextObligationKind)[keyof typeof ConfigRequiredContextObligationKind];

export const ConfigRequiredContextAnchorRole = {
  LatestUserInstruction: "latest_user_instruction",
  ApprovalNote: "approval_note",
  CurrentConfigState: "current_config_state",
  ConfigPolicy: "config_policy",
  RollbackPlan: "rollback_plan",
  NamespaceConstraint: "namespace_constraint",
  NegativeEvidence: "negative_evidence",
} as const;

export type ConfigRequiredContextAnchorRole =
  (typeof ConfigRequiredContextAnchorRole)[keyof typeof ConfigRequiredContextAnchorRole];

export type ConfigRequiredContextToolCallCandidate = {
  operation?: string;
  service?: string;
  key?: string;
  namespace?: string;
  targetNamespace?: string;
  sourceSystem?: string;
  requestId?: string;
  environment?: string;
  requiredExecutionMode?: string;
  resourceScope?: readonly string[];
  value?: string;
  newValue?: string;
  proposedValue?: string;
  dangerousValue?: boolean;
};

export type ConfigRequiredContextObligationCompilerInput =
  ConfigRequiredContextToolCallCandidate & {
    toolCallDigest: PatentProofHash;
    availableAnchors: readonly ContextAnchor[];
    actionImpactClass?: ActionImpactClassId;
  };

export type ConfigRequiredContextAnchorRequirement = {
  role: ConfigRequiredContextAnchorRole;
  anchorId: ContextAnchorId;
  anchorType: ContextAnchorType;
  resourceScope: string;
  minimumRetentionMode: RequiredContextMinimumRetentionMode;
};

export type ConfigRequiredContextObligationCompilation =
  RequiredContextObligationCompilation & {
    operation: ConfigRequiredContextOperation;
    namespace: string;
    namespaceClassification: ConfigRequiredContextNamespaceClassification;
    resourceScope: readonly string[];
    dangerousValue: boolean;
    obligationKind: ConfigRequiredContextObligationKind;
    requiresNamespaceConstraintAnchors: boolean;
    requiresNegativeEvidenceAnchors: boolean;
    requiredAnchorRoles: readonly ConfigRequiredContextAnchorRequirement[];
  };

export type PromptContextUnitDigest = {
  contextUnitId: ContextAnchorId;
  digest: PatentProofHash;
};

export type PromptTokenPositionRange = {
  contextUnitId: ContextAnchorId;
  startToken: number;
  endToken: number;
};

export type PromptAssemblyManifest = {
  manifestId: PromptAssemblyManifestId;
  inferenceId: ContextRetentionRunId;
  modelId: string;
  promptDigest: PatentProofHash;
  contextUnitDigests: readonly PromptContextUnitDigest[];
  contextUnitOrder: readonly ContextAnchorId[];
  tokenPositionRanges: readonly PromptTokenPositionRange[];
  summaryDerivationDigests: readonly PatentProofHash[];
  retrievalQueryDigest: PatentProofHash;
  retrievedDocumentDigests: readonly PatentProofHash[];
  memorySnapshotDigest: PatentProofHash;
  systemPolicyDigest: PatentProofHash;
};

export type ContextAnchorValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ContextAnchorValidationSuccess = {
  success: true;
  data: ContextAnchor;
};

export type ContextAnchorValidationFailure = {
  success: false;
  issues: ContextAnchorValidationIssue[];
};

export type ContextAnchorValidationResult =
  | ContextAnchorValidationSuccess
  | ContextAnchorValidationFailure;

export type RequiredContextObligationValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type RequiredContextObligationValidationSuccess = {
  success: true;
  data: RequiredContextObligation;
};

export type RequiredContextObligationValidationFailure = {
  success: false;
  issues: RequiredContextObligationValidationIssue[];
};

export type RequiredContextObligationValidationResult =
  | RequiredContextObligationValidationSuccess
  | RequiredContextObligationValidationFailure;

export type PromptAssemblyManifestValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type PromptAssemblyManifestValidationSuccess = {
  success: true;
  data: PromptAssemblyManifest;
};

export type PromptAssemblyManifestValidationFailure = {
  success: false;
  issues: PromptAssemblyManifestValidationIssue[];
};

export type PromptAssemblyManifestValidationResult =
  | PromptAssemblyManifestValidationSuccess
  | PromptAssemblyManifestValidationFailure;

type ContextAnchorIssueCollector = {
  issues: ContextAnchorValidationIssue[];
};

type RequiredContextObligationIssueCollector = {
  issues: RequiredContextObligationValidationIssue[];
};

type PromptAssemblyManifestIssueCollector = {
  issues: PromptAssemblyManifestValidationIssue[];
};

type StringEnumValues<TValue extends string> = readonly TValue[];

export class ContextAnchorValidationError extends Error {
  readonly issues: ContextAnchorValidationIssue[];

  constructor(issues: ContextAnchorValidationIssue[]) {
    super("ContextAnchor validation failed");
    this.name = "ContextAnchorValidationError";
    this.issues = issues;
  }
}

export class RequiredContextObligationValidationError extends Error {
  readonly issues: RequiredContextObligationValidationIssue[];

  constructor(issues: RequiredContextObligationValidationIssue[]) {
    super("RequiredContextObligation validation failed");
    this.name = "RequiredContextObligationValidationError";
    this.issues = issues;
  }
}

export class PromptAssemblyManifestValidationError extends Error {
  readonly issues: PromptAssemblyManifestValidationIssue[];

  constructor(issues: PromptAssemblyManifestValidationIssue[]) {
    super("PromptAssemblyManifest validation failed");
    this.name = "PromptAssemblyManifestValidationError";
    this.issues = issues;
  }
}

const addContextAnchorIssue = (
  collector: ContextAnchorIssueCollector,
  path: string,
  code: string,
  message: string,
) => {
  collector.issues.push({ path, code, message });
};

const contextAnchorChildPath = (path: string, key: string) => `${path}.${key}`;

const isContextAnchorRecord = (
  input: unknown,
): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const readContextAnchorString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: ContextAnchorIssueCollector,
): string => {
  const value = input[key];

  if (typeof value !== "string" || value.length === 0) {
    addContextAnchorIssue(
      collector,
      contextAnchorChildPath(path, key),
      "invalid_string",
      "Expected a non-empty string.",
    );
    return "";
  }

  return value;
};

const readContextAnchorTimestamp = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: ContextAnchorIssueCollector,
): ContextRetentionTimestamp => {
  const value = readContextAnchorString(input, key, path, collector);

  if (value.length > 0 && Number.isNaN(Date.parse(value))) {
    addContextAnchorIssue(
      collector,
      contextAnchorChildPath(path, key),
      "invalid_timestamp",
      "Expected a parseable timestamp string.",
    );
  }

  return value;
};

const readContextAnchorBoolean = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: ContextAnchorIssueCollector,
): boolean => {
  const value = input[key];

  if (typeof value !== "boolean") {
    addContextAnchorIssue(
      collector,
      contextAnchorChildPath(path, key),
      "invalid_boolean",
      "Expected a boolean.",
    );
    return false;
  }

  return value;
};

const readContextAnchorEnum = <TValue extends string>(
  input: Record<string, unknown>,
  key: string,
  values: StringEnumValues<TValue>,
  path: string,
  collector: ContextAnchorIssueCollector,
): TValue => {
  const value = input[key];

  if (typeof value !== "string" || !values.includes(value as TValue)) {
    addContextAnchorIssue(
      collector,
      contextAnchorChildPath(path, key),
      "invalid_enum",
      `Expected one of: ${values.join(", ")}.`,
    );
    return values[0] as TValue;
  }

  return value as TValue;
};

const validateContextAnchorShape = (
  input: unknown,
  collector: ContextAnchorIssueCollector,
): ContextAnchor => {
  if (!isContextAnchorRecord(input)) {
    addContextAnchorIssue(
      collector,
      "$",
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;
  const path = "$";

  return {
    anchorId: readContextAnchorString(record, "anchorId", path, collector),
    anchorType: readContextAnchorEnum(
      record,
      "anchorType",
      ContextAnchorTypeValues,
      path,
      collector,
    ),
    sourceIdentity: readContextAnchorString(
      record,
      "sourceIdentity",
      path,
      collector,
    ),
    authorityLevel: readContextAnchorString(
      record,
      "authorityLevel",
      path,
      collector,
    ),
    resourceScope: readContextAnchorString(
      record,
      "resourceScope",
      path,
      collector,
    ),
    createdAt: readContextAnchorTimestamp(
      record,
      "createdAt",
      path,
      collector,
    ),
    expiresAt: readContextAnchorTimestamp(
      record,
      "expiresAt",
      path,
      collector,
    ),
    contentDigest: readContextAnchorString(
      record,
      "contentDigest",
      path,
      collector,
    ),
    semanticClaimsDigest: readContextAnchorString(
      record,
      "semanticClaimsDigest",
      path,
      collector,
    ),
    mustBeVerbatim: readContextAnchorBoolean(
      record,
      "mustBeVerbatim",
      path,
      collector,
    ),
    allowCertifiedSummary: readContextAnchorBoolean(
      record,
      "allowCertifiedSummary",
      path,
      collector,
    ),
    allowRetrievableReference: readContextAnchorBoolean(
      record,
      "allowRetrievableReference",
      path,
      collector,
    ),
    trustTier: readContextAnchorEnum(
      record,
      "trustTier",
      ContextAnchorTrustTierValues,
      path,
      collector,
    ),
  };
};

export const validateContextAnchor = (
  input: unknown,
): ContextAnchorValidationResult => {
  const collector: ContextAnchorIssueCollector = { issues: [] };
  const data = validateContextAnchorShape(input, collector);

  if (collector.issues.length > 0) {
    return { success: false, issues: collector.issues };
  }

  return { success: true, data };
};

export const ContextAnchorSchema = {
  parse(input: unknown): ContextAnchor {
    const result = validateContextAnchor(input);

    if (!result.success) {
      throw new ContextAnchorValidationError(result.issues);
    }

    return result.data;
  },
  safeParse(input: unknown): ContextAnchorValidationResult {
    return validateContextAnchor(input);
  },
};

export const isContextAnchor = (input: unknown): input is ContextAnchor =>
  validateContextAnchor(input).success;

const addRequiredContextObligationIssue = (
  collector: RequiredContextObligationIssueCollector,
  path: string,
  code: string,
  message: string,
) => {
  collector.issues.push({ path, code, message });
};

const requiredContextObligationChildPath = (path: string, key: string) =>
  `${path}.${key}`;

const isRequiredContextObligationRecord = (
  input: unknown,
): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const readRequiredContextObligationString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: RequiredContextObligationIssueCollector,
): string => {
  const value = input[key];

  if (typeof value !== "string" || value.length === 0) {
    addRequiredContextObligationIssue(
      collector,
      requiredContextObligationChildPath(path, key),
      "invalid_string",
      "Expected a non-empty string.",
    );
    return "";
  }

  return value;
};

const readRequiredContextObligationEnum = <TValue extends string>(
  input: Record<string, unknown>,
  key: string,
  values: StringEnumValues<TValue>,
  path: string,
  collector: RequiredContextObligationIssueCollector,
): TValue => {
  const value = input[key];

  if (typeof value !== "string" || !values.includes(value as TValue)) {
    addRequiredContextObligationIssue(
      collector,
      requiredContextObligationChildPath(path, key),
      "invalid_enum",
      `Expected one of: ${values.join(", ")}.`,
    );
    return values[0] as TValue;
  }

  return value as TValue;
};

const readRequiredContextObligationStringArray = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: RequiredContextObligationIssueCollector,
): string[] => {
  const value = input[key];
  const issuePath = requiredContextObligationChildPath(path, key);

  if (!Array.isArray(value)) {
    addRequiredContextObligationIssue(
      collector,
      issuePath,
      "invalid_array",
      "Expected an array of strings.",
    );
    return [];
  }

  if (value.length === 0) {
    addRequiredContextObligationIssue(
      collector,
      issuePath,
      "invalid_array",
      "Expected at least one context anchor id.",
    );
  }

  return value.flatMap((item, index) => {
    if (typeof item !== "string" || item.length === 0) {
      addRequiredContextObligationIssue(
        collector,
        `${issuePath}[${index}]`,
        "invalid_string",
        "Expected a non-empty string.",
      );
      return [];
    }

    return [item];
  });
};

const requiredContextFreshnessWindowPattern =
  /^P(?=\d|T\d)(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/;

const readRequiredContextObligationFreshnessWindow = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: RequiredContextObligationIssueCollector,
): RequiredContextFreshnessWindow => {
  const value = readRequiredContextObligationString(
    input,
    key,
    path,
    collector,
  );

  if (
    value.length > 0 &&
    !requiredContextFreshnessWindowPattern.test(value)
  ) {
    addRequiredContextObligationIssue(
      collector,
      requiredContextObligationChildPath(path, key),
      "invalid_duration",
      "Expected an ISO-8601 duration string.",
    );
  }

  return value;
};

const validateRequiredContextObligationShape = (
  input: unknown,
  collector: RequiredContextObligationIssueCollector,
): RequiredContextObligation => {
  if (!isRequiredContextObligationRecord(input)) {
    addRequiredContextObligationIssue(
      collector,
      "$",
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;
  const path = "$";

  return {
    obligationId: readRequiredContextObligationString(
      record,
      "obligationId",
      path,
      collector,
    ),
    toolCallDigest: readRequiredContextObligationString(
      record,
      "toolCallDigest",
      path,
      collector,
    ),
    actionImpactClass: readRequiredContextObligationString(
      record,
      "actionImpactClass",
      path,
      collector,
    ),
    requiredAnchors: readRequiredContextObligationStringArray(
      record,
      "requiredAnchors",
      path,
      collector,
    ),
    freshnessWindow: readRequiredContextObligationFreshnessWindow(
      record,
      "freshnessWindow",
      path,
      collector,
    ),
    minimumRetentionMode: readRequiredContextObligationEnum(
      record,
      "minimumRetentionMode",
      RequiredContextMinimumRetentionModeValues,
      path,
      collector,
    ),
    conflictPolicy: readRequiredContextObligationEnum(
      record,
      "conflictPolicy",
      RequiredContextConflictPolicyValues,
      path,
      collector,
    ),
    taintPolicy: readRequiredContextObligationEnum(
      record,
      "taintPolicy",
      RequiredContextTaintPolicyValues,
      path,
      collector,
    ),
    missingAnchorAction: readRequiredContextObligationEnum(
      record,
      "missingAnchorAction",
      RequiredContextMissingAnchorActionValues,
      path,
      collector,
    ),
  };
};

export const validateRequiredContextObligation = (
  input: unknown,
): RequiredContextObligationValidationResult => {
  const collector: RequiredContextObligationIssueCollector = { issues: [] };
  const data = validateRequiredContextObligationShape(input, collector);

  if (collector.issues.length > 0) {
    return { success: false, issues: collector.issues };
  }

  return { success: true, data };
};

export const RequiredContextObligationSchema = {
  parse(input: unknown): RequiredContextObligation {
    const result = validateRequiredContextObligation(input);

    if (!result.success) {
      throw new RequiredContextObligationValidationError(result.issues);
    }

    return result.data;
  },
  safeParse(input: unknown): RequiredContextObligationValidationResult {
    return validateRequiredContextObligation(input);
  },
};

export const isRequiredContextObligation = (
  input: unknown,
): input is RequiredContextObligation =>
  validateRequiredContextObligation(input).success;

const SqlRequiredContextUnresolvedResourceScope = "unresolved_sql_resource";

const sqlRequiredContextOperationByKeyword: Record<
  string,
  SqlRequiredContextOperation
> = {
  select: SqlRequiredContextOperation.Select,
  insert: SqlRequiredContextOperation.Insert,
  update: SqlRequiredContextOperation.Update,
  delete: SqlRequiredContextOperation.Delete,
  drop: SqlRequiredContextOperation.Drop,
  truncate: SqlRequiredContextOperation.Truncate,
  alter: SqlRequiredContextOperation.Alter,
};

const sqlRequiredContextWriteOperations = new Set<SqlRequiredContextOperation>([
  SqlRequiredContextOperation.Insert,
  SqlRequiredContextOperation.Update,
  SqlRequiredContextOperation.Delete,
  SqlRequiredContextOperation.Drop,
  SqlRequiredContextOperation.Truncate,
  SqlRequiredContextOperation.Alter,
]);

const normalizeSqlRequiredContextSql = (sql: string): string =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();

const getSqlRequiredContextOperation = (
  normalizedSql: string,
): SqlRequiredContextOperation => {
  const keyword = normalizedSql.match(/^([a-zA-Z]+)/)?.[1]?.toLowerCase();

  if (keyword === undefined) {
    return SqlRequiredContextOperation.Unknown;
  }

  return (
    sqlRequiredContextOperationByKeyword[keyword] ??
    SqlRequiredContextOperation.Unknown
  );
};

const normalizeSqlRequiredContextIdentifier = (identifier: string): string => {
  const cleanedIdentifier = identifier
    .trim()
    .replace(/\s+as\s+.+$/i, "")
    .replace(/\s+.+$/, "")
    .replace(/^[`"\[]/, "")
    .replace(/[`"\]]$/, "");
  const segments = cleanedIdentifier.split(".").filter(Boolean);

  return segments.at(-1) ?? cleanedIdentifier;
};

const uniqueSqlRequiredContextStrings = (
  values: readonly string[],
): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  });

  return result;
};

const collectSqlRequiredContextMatches = (
  sql: string,
  pattern: RegExp,
): string[] =>
  uniqueSqlRequiredContextStrings(
    [...sql.matchAll(pattern)]
      .map((match) => match[1])
      .filter((value): value is string => value !== undefined)
      .map(normalizeSqlRequiredContextIdentifier)
      .filter((value) => value.length > 0),
  );

const matchSqlRequiredContextResourceScope = (
  normalizedSql: string,
  operation: SqlRequiredContextOperation,
): string[] => {
  if (operation === SqlRequiredContextOperation.Select) {
    return collectSqlRequiredContextMatches(
      normalizedSql,
      /\b(?:from|join)\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/gi,
    );
  }

  if (operation === SqlRequiredContextOperation.Insert) {
    return collectSqlRequiredContextMatches(
      normalizedSql,
      /\binsert\s+into\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/gi,
    );
  }

  if (operation === SqlRequiredContextOperation.Update) {
    return collectSqlRequiredContextMatches(
      normalizedSql,
      /\bupdate\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/gi,
    );
  }

  if (operation === SqlRequiredContextOperation.Delete) {
    return collectSqlRequiredContextMatches(
      normalizedSql,
      /\bdelete\s+from\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/gi,
    );
  }

  if (operation === SqlRequiredContextOperation.Drop) {
    return collectSqlRequiredContextMatches(
      normalizedSql,
      /\bdrop\s+table(?:\s+if\s+exists)?\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/gi,
    );
  }

  if (operation === SqlRequiredContextOperation.Truncate) {
    return collectSqlRequiredContextMatches(
      normalizedSql,
      /\btruncate(?:\s+table)?\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/gi,
    );
  }

  if (operation === SqlRequiredContextOperation.Alter) {
    return collectSqlRequiredContextMatches(
      normalizedSql,
      /\balter\s+table(?:\s+if\s+exists)?\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/gi,
    );
  }

  return [];
};

const getSqlRequiredContextResourceScope = (
  input: SqlRequiredContextObligationCompilerInput,
  normalizedSql: string,
  operation: SqlRequiredContextOperation,
): string[] => {
  const explicitResourceScope = uniqueSqlRequiredContextStrings(
    (input.resourceScope ?? [])
      .map(normalizeSqlRequiredContextIdentifier)
      .filter((value) => value.length > 0),
  );

  if (explicitResourceScope.length > 0) {
    return explicitResourceScope;
  }

  return matchSqlRequiredContextResourceScope(normalizedSql, operation);
};

const toSqlRequiredContextSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "unknown";

const normalizeSqlRequiredContextScopeValue = (value: string): string =>
  value
    .toLowerCase()
    .replace(/^[`"\[]/, "")
    .replace(/[`"\]]$/, "")
    .trim();

const isSqlRequiredContextWildcardScope = (scope: string): boolean =>
  scope === "*" ||
  scope.endsWith(":*") ||
  scope.endsWith("/*") ||
  scope.includes("all_tables") ||
  scope.includes("all-database") ||
  scope.includes("all_database");

const doesSqlRequiredContextAnchorMatchResource = (
  anchor: ContextAnchor,
  resourceScope: string,
): boolean => {
  const anchorScope = normalizeSqlRequiredContextScopeValue(
    anchor.resourceScope,
  );
  const resource = normalizeSqlRequiredContextScopeValue(resourceScope);

  if (resource.length === 0) {
    return false;
  }

  if (anchorScope === resource || isSqlRequiredContextWildcardScope(anchorScope)) {
    return true;
  }

  const scopeParts = anchorScope.split(/[^a-z0-9_$]+/).filter(Boolean);

  return scopeParts.includes(resource) || anchorScope.endsWith(resource);
};

const doesSqlRequiredContextAnchorMatchAnyResource = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean =>
  resourceScope.some((resource) =>
    doesSqlRequiredContextAnchorMatchResource(anchor, resource),
  );

const isSqlRequiredContextGlobalAnchor = (anchor: ContextAnchor): boolean => {
  const scope = normalizeSqlRequiredContextScopeValue(anchor.resourceScope);

  return (
    isSqlRequiredContextWildcardScope(scope) ||
    scope.includes("tool_call") ||
    scope.includes("request") ||
    scope.includes("sql")
  );
};

const getSqlRequiredContextAnchorSearchText = (anchor: ContextAnchor): string =>
  [
    anchor.anchorId,
    anchor.anchorType,
    anchor.sourceIdentity,
    anchor.authorityLevel,
    anchor.resourceScope,
  ]
    .join(" ")
    .toLowerCase();

const chooseLatestSqlRequiredContextAnchor = (
  availableAnchors: readonly ContextAnchor[],
  predicate: (anchor: ContextAnchor) => boolean,
): ContextAnchor | undefined => {
  const matchingAnchors = availableAnchors
    .filter(predicate)
    .sort((left, right) => {
      const rightTime = Date.parse(right.createdAt);
      const leftTime = Date.parse(left.createdAt);
      const timeDelta =
        (Number.isNaN(rightTime) ? 0 : rightTime) -
        (Number.isNaN(leftTime) ? 0 : leftTime);

      if (timeDelta !== 0) {
        return timeDelta;
      }

      return left.anchorId.localeCompare(right.anchorId);
    });

  return matchingAnchors[0];
};

const createSqlRequiredContextFallbackAnchorId = (
  input: SqlRequiredContextObligationCompilerInput,
  role: SqlRequiredContextAnchorRole,
  resourceScope: string,
): ContextAnchorId => {
  const requestKey = input.requestId ?? input.toolCallDigest;

  return `ctx-required-sql-${toSqlRequiredContextSlug(
    requestKey,
  )}-${role}-${toSqlRequiredContextSlug(resourceScope)}`;
};

const createSqlRequiredContextAnchorRequirement = (
  input: SqlRequiredContextObligationCompilerInput,
  role: SqlRequiredContextAnchorRole,
  resourceScope: string,
  predicate: (anchor: ContextAnchor) => boolean,
): SqlRequiredContextAnchorRequirement => {
  const anchor = chooseLatestSqlRequiredContextAnchor(
    input.availableAnchors,
    predicate,
  );

  return {
    role,
    anchorId:
      anchor?.anchorId ??
      createSqlRequiredContextFallbackAnchorId(input, role, resourceScope),
    resourceScope,
  };
};

const isSqlRequiredContextUserInstructionAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean =>
  anchor.anchorType === ContextAnchorType.UserInstruction &&
  (doesSqlRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
    isSqlRequiredContextGlobalAnchor(anchor));

const isSqlRequiredContextPolicyAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean => {
  const searchText = getSqlRequiredContextAnchorSearchText(anchor);

  return (
    anchor.anchorType === ContextAnchorType.SystemPolicy &&
    (searchText.includes("sql") || searchText.includes("database")) &&
    (doesSqlRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
      isSqlRequiredContextGlobalAnchor(anchor))
  );
};

const isSqlRequiredContextResourceStateAnchor = (
  anchor: ContextAnchor,
  resourceScope: string,
): boolean =>
  anchor.anchorType === ContextAnchorType.ResourceState &&
  doesSqlRequiredContextAnchorMatchResource(anchor, resourceScope);

const isSqlRequiredContextRollbackAnchor = (
  anchor: ContextAnchor,
  resourceScope: string,
): boolean => {
  const searchText = getSqlRequiredContextAnchorSearchText(anchor);

  return (
    searchText.includes("rollback") ||
    searchText.includes("backout") ||
    searchText.includes("restore") ||
    searchText.includes("revert")
  ) && doesSqlRequiredContextAnchorMatchResource(anchor, resourceScope);
};

const isSqlRequiredContextUncertaintyAnchor = (
  anchor: ContextAnchor,
  resourceScope: string,
): boolean => {
  const searchText = getSqlRequiredContextAnchorSearchText(anchor);

  return (
    searchText.includes("uncertainty") ||
    searchText.includes("uncertain") ||
    searchText.includes("unresolved") ||
    searchText.includes("unknown") ||
    searchText.includes("ambiguous")
  ) && doesSqlRequiredContextAnchorMatchResource(anchor, resourceScope);
};

const buildSqlRequiredContextAnchorRequirements = (
  input: SqlRequiredContextObligationCompilerInput,
  obligationKind: SqlRequiredContextObligationKind,
  resourceScope: readonly string[],
): SqlRequiredContextAnchorRequirement[] => {
  const requirements: SqlRequiredContextAnchorRequirement[] = [
    createSqlRequiredContextAnchorRequirement(
      input,
      SqlRequiredContextAnchorRole.LatestUserInstruction,
      "tool_call",
      (anchor) => isSqlRequiredContextUserInstructionAnchor(anchor, resourceScope),
    ),
    createSqlRequiredContextAnchorRequirement(
      input,
      SqlRequiredContextAnchorRole.SqlPolicy,
      "sql_policy",
      (anchor) => isSqlRequiredContextPolicyAnchor(anchor, resourceScope),
    ),
  ];

  if (obligationKind === SqlRequiredContextObligationKind.UncertaintyContext) {
    requirements.push(
      createSqlRequiredContextAnchorRequirement(
        input,
        SqlRequiredContextAnchorRole.Uncertainty,
        SqlRequiredContextUnresolvedResourceScope,
        (anchor) =>
          isSqlRequiredContextUncertaintyAnchor(
            anchor,
            SqlRequiredContextUnresolvedResourceScope,
          ),
      ),
    );

    return requirements;
  }

  resourceScope.forEach((resource) => {
    requirements.push(
      createSqlRequiredContextAnchorRequirement(
        input,
        SqlRequiredContextAnchorRole.TargetResourceState,
        resource,
        (anchor) => isSqlRequiredContextResourceStateAnchor(anchor, resource),
      ),
    );
  });

  if (obligationKind === SqlRequiredContextObligationKind.WriteContext) {
    resourceScope.forEach((resource) => {
      requirements.push(
        createSqlRequiredContextAnchorRequirement(
          input,
          SqlRequiredContextAnchorRole.RollbackContext,
          resource,
          (anchor) => isSqlRequiredContextRollbackAnchor(anchor, resource),
        ),
      );
    });
  }

  return requirements;
};

const uniqueSqlRequiredContextAnchorIds = (
  requirements: readonly SqlRequiredContextAnchorRequirement[],
): ContextAnchorId[] => uniqueSqlRequiredContextStrings(requirements.map((r) => r.anchorId));

const getSqlRequiredContextActionImpactClass = (
  input: SqlRequiredContextObligationCompilerInput,
  obligationKind: SqlRequiredContextObligationKind,
): ActionImpactClassId => {
  if (input.actionImpactClass !== undefined) {
    return input.actionImpactClass;
  }

  if (obligationKind === SqlRequiredContextObligationKind.ReadonlyContext) {
    return "database_read";
  }

  if (obligationKind === SqlRequiredContextObligationKind.UncertaintyContext) {
    return "database_uncertain";
  }

  return "database_write";
};

const getSqlRequiredContextObligationKind = (
  operation: SqlRequiredContextOperation,
  unresolvedTables: readonly string[],
): SqlRequiredContextObligationKind => {
  if (
    operation === SqlRequiredContextOperation.Unknown ||
    unresolvedTables.length > 0
  ) {
    return SqlRequiredContextObligationKind.UncertaintyContext;
  }

  if (operation === SqlRequiredContextOperation.Select) {
    return SqlRequiredContextObligationKind.ReadonlyContext;
  }

  if (sqlRequiredContextWriteOperations.has(operation)) {
    return SqlRequiredContextObligationKind.WriteContext;
  }

  return SqlRequiredContextObligationKind.UncertaintyContext;
};

const getSqlRequiredContextFreshnessWindow = (
  obligationKind: SqlRequiredContextObligationKind,
): RequiredContextFreshnessWindow => {
  if (obligationKind === SqlRequiredContextObligationKind.ReadonlyContext) {
    return "PT2H";
  }

  if (obligationKind === SqlRequiredContextObligationKind.UncertaintyContext) {
    return "PT15M";
  }

  return "PT30M";
};

const getSqlRequiredContextMinimumRetentionMode = (
  obligationKind: SqlRequiredContextObligationKind,
): RequiredContextMinimumRetentionMode =>
  obligationKind === SqlRequiredContextObligationKind.ReadonlyContext
    ? ContextRetentionMode.CertifiedSummary
    : ContextRetentionMode.Verbatim;

const getSqlRequiredContextMissingAnchorAction = (
  obligationKind: SqlRequiredContextObligationKind,
): RequiredContextMissingAnchorAction => {
  if (obligationKind === SqlRequiredContextObligationKind.ReadonlyContext) {
    return RequiredContextMissingAnchorAction.Reground;
  }

  if (obligationKind === SqlRequiredContextObligationKind.UncertaintyContext) {
    return RequiredContextMissingAnchorAction.Deny;
  }

  return RequiredContextMissingAnchorAction.RegroundOrDeny;
};

export const compileSqlRequiredContextObligations = (
  input: SqlRequiredContextObligationCompilerInput,
): SqlRequiredContextObligationCompilation => {
  const normalizedSql = normalizeSqlRequiredContextSql(input.sql);
  const operation = getSqlRequiredContextOperation(normalizedSql);
  const parsedResourceScope = getSqlRequiredContextResourceScope(
    input,
    normalizedSql,
    operation,
  );
  const unresolvedTables =
    parsedResourceScope.length === 0 ? [SqlRequiredContextUnresolvedResourceScope] : [];
  const resourceScope =
    parsedResourceScope.length > 0
      ? parsedResourceScope
      : [SqlRequiredContextUnresolvedResourceScope];
  const obligationKind = getSqlRequiredContextObligationKind(
    operation,
    unresolvedTables,
  );
  const requiredAnchorRoles = buildSqlRequiredContextAnchorRequirements(
    input,
    obligationKind,
    resourceScope,
  );
  const requiredAnchors = uniqueSqlRequiredContextAnchorIds(requiredAnchorRoles);
  const requestKey = input.requestId ?? input.toolCallDigest;
  const actionImpactClass = getSqlRequiredContextActionImpactClass(
    input,
    obligationKind,
  );
  const obligation = RequiredContextObligationSchema.parse({
    obligationId: `rco-sql-${toSqlRequiredContextSlug(
      requestKey,
    )}-${obligationKind}-${toSqlRequiredContextSlug(resourceScope.join("-"))}`,
    toolCallDigest: input.toolCallDigest,
    actionImpactClass,
    requiredAnchors,
    freshnessWindow: getSqlRequiredContextFreshnessWindow(obligationKind),
    minimumRetentionMode: getSqlRequiredContextMinimumRetentionMode(
      obligationKind,
    ),
    conflictPolicy: RequiredContextConflictPolicy.DenyOnOmittedConflict,
    taintPolicy: RequiredContextTaintPolicy.DenyOnUntrustedInstruction,
    missingAnchorAction: getSqlRequiredContextMissingAnchorAction(
      obligationKind,
    ),
  });

  return {
    normalizedSql,
    operation,
    resourceScope,
    unresolvedTables,
    obligationKind,
    requiresUncertaintyAnchors:
      obligationKind === SqlRequiredContextObligationKind.UncertaintyContext,
    requiredAnchorRoles,
    toolCallDigest: input.toolCallDigest,
    actionImpactClass,
    obligations: [obligation],
  };
};

export const SqlRequiredContextObligationCompiler: ToolSpecificRequiredContextObligationCompiler<SqlRequiredContextToolCallCandidate> =
  {
    toolType: "sql",
    compileRequiredContextObligations(input) {
      const compilerInput: SqlRequiredContextObligationCompilerInput = {
        sql: input.toolCallCandidate.sql,
        toolCallDigest: input.toolCallDigest,
        actionImpactClass: input.actionImpactClass,
        availableAnchors: input.availableAnchors,
      };
      const requestId = input.candidateId ?? input.toolCallCandidate.requestId;

      if (requestId !== undefined) {
        compilerInput.requestId = requestId;
      }

      if (input.toolCallCandidate.resourceScope !== undefined) {
        compilerInput.resourceScope = input.toolCallCandidate.resourceScope;
      }

      return compileSqlRequiredContextObligations(compilerInput);
    },
  };

const CiCdRequiredContextUnresolvedResourceScope = "unresolved_cicd_release";

const cicdRequiredContextOperationByKeyword: Record<
  string,
  CiCdRequiredContextOperation
> = {
  deploy: CiCdRequiredContextOperation.Deploy,
  deployment: CiCdRequiredContextOperation.Deploy,
  release: CiCdRequiredContextOperation.Release,
  promote: CiCdRequiredContextOperation.Promote,
  promotion: CiCdRequiredContextOperation.Promote,
  rollback: CiCdRequiredContextOperation.Rollback,
};

const cicdRequiredContextProductionOperations =
  new Set<CiCdRequiredContextOperation>([
    CiCdRequiredContextOperation.Deploy,
    CiCdRequiredContextOperation.Release,
    CiCdRequiredContextOperation.Promote,
    CiCdRequiredContextOperation.Rollback,
  ]);

const normalizeCiCdRequiredContextKeyword = (
  value: string | undefined,
): string =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeCiCdRequiredContextScopeValue = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

const uniqueCiCdRequiredContextStrings = (
  values: readonly string[],
): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  });

  return result;
};

const getCiCdRequiredContextOperation = (
  input: CiCdRequiredContextToolCallCandidate,
): CiCdRequiredContextOperation => {
  const normalizedOperation = normalizeCiCdRequiredContextKeyword(input.operation);

  if (normalizedOperation.length > 0) {
    return (
      cicdRequiredContextOperationByKeyword[normalizedOperation] ??
      CiCdRequiredContextOperation.Unknown
    );
  }

  const normalizedExecutionMode = normalizeCiCdRequiredContextKeyword(
    input.requiredExecutionMode,
  );

  if (
    normalizedExecutionMode.includes("deploy") ||
    normalizedExecutionMode.includes("deployment")
  ) {
    return CiCdRequiredContextOperation.Deploy;
  }

  if (normalizedExecutionMode.includes("release")) {
    return CiCdRequiredContextOperation.Release;
  }

  if (normalizedExecutionMode.includes("promote")) {
    return CiCdRequiredContextOperation.Promote;
  }

  if (normalizedExecutionMode.includes("rollback")) {
    return CiCdRequiredContextOperation.Rollback;
  }

  return CiCdRequiredContextOperation.Unknown;
};

const getCiCdRequiredContextTestStatus = (
  testStatus: string | undefined,
): CiCdRequiredContextTestStatus => {
  const normalizedStatus = normalizeCiCdRequiredContextKeyword(testStatus);

  if (normalizedStatus.length === 0) {
    return CiCdRequiredContextTestStatus.Missing;
  }

  if (["pass", "passed", "success", "succeeded"].includes(normalizedStatus)) {
    return CiCdRequiredContextTestStatus.Passed;
  }

  if (
    ["fail", "failed", "failure", "errored", "error"].includes(
      normalizedStatus,
    )
  ) {
    return CiCdRequiredContextTestStatus.Failed;
  }

  return CiCdRequiredContextTestStatus.Unknown;
};

const isCiCdRequiredContextDryRun = (
  input: CiCdRequiredContextToolCallCandidate,
): boolean => {
  if (input.dryRun !== undefined) {
    return input.dryRun;
  }

  const normalizedExecutionMode = normalizeCiCdRequiredContextKeyword(
    input.requiredExecutionMode,
  );

  return (
    normalizedExecutionMode.includes("dry_run") ||
    normalizedExecutionMode.includes("dryrun")
  );
};

const getCiCdRequiredContextTargetEnvironment = (
  input: CiCdRequiredContextToolCallCandidate,
): string => {
  const targetEnvironment =
    normalizeCiCdRequiredContextKeyword(input.targetEnvironment) ||
    normalizeCiCdRequiredContextKeyword(input.environment);

  return targetEnvironment || "production";
};

const getCiCdRequiredContextResourceScope = (
  input: CiCdRequiredContextToolCallCandidate,
  targetEnvironment: string,
): string[] => {
  const explicitResourceScope = uniqueCiCdRequiredContextStrings(
    (input.resourceScope ?? [])
      .map(normalizeCiCdRequiredContextScopeValue)
      .filter((value) => value.length > 0),
  );

  if (explicitResourceScope.length > 0) {
    return explicitResourceScope;
  }

  const inferredResourceScope = uniqueCiCdRequiredContextStrings(
    [input.service, input.pipeline, targetEnvironment]
      .filter((value): value is string => value !== undefined)
      .map(normalizeCiCdRequiredContextScopeValue)
      .filter((value) => value.length > 0),
  );

  return inferredResourceScope.length > 0
    ? inferredResourceScope
    : [CiCdRequiredContextUnresolvedResourceScope];
};

const toCiCdRequiredContextSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "unknown";

const normalizeCiCdRequiredContextMatchValue = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const isCiCdRequiredContextWildcardScope = (scope: string): boolean =>
  scope === "*" ||
  scope.endsWith(":*") ||
  scope.endsWith("/*") ||
  scope.includes("all_cicd") ||
  scope.includes("all-cicd") ||
  scope.includes("all_pipelines") ||
  scope.includes("all-pipelines");

const doesCiCdRequiredContextAnchorMatchResource = (
  anchor: ContextAnchor,
  resourceScope: string,
): boolean => {
  const anchorScope = normalizeCiCdRequiredContextMatchValue(anchor.resourceScope);
  const resource = normalizeCiCdRequiredContextMatchValue(resourceScope);

  if (resource.length === 0) {
    return false;
  }

  if (anchorScope === resource || isCiCdRequiredContextWildcardScope(anchorScope)) {
    return true;
  }

  const resourceTokens = resource.split(/\s+/).filter(Boolean);
  const anchorTokens = anchorScope.split(/\s+/).filter(Boolean);

  return resourceTokens.some((token) => anchorTokens.includes(token));
};

const doesCiCdRequiredContextAnchorMatchAnyResource = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean =>
  resourceScope.some((resource) =>
    doesCiCdRequiredContextAnchorMatchResource(anchor, resource),
  );

const isCiCdRequiredContextGlobalAnchor = (anchor: ContextAnchor): boolean => {
  const scope = normalizeCiCdRequiredContextMatchValue(anchor.resourceScope);

  return (
    isCiCdRequiredContextWildcardScope(scope) ||
    scope.includes("tool call") ||
    scope.includes("request") ||
    scope.includes("cicd") ||
    scope.includes("ci cd") ||
    scope.includes("deployment") ||
    scope.includes("release")
  );
};

const getCiCdRequiredContextAnchorSearchText = (
  anchor: ContextAnchor,
): string =>
  [
    anchor.anchorId,
    anchor.anchorType,
    anchor.sourceIdentity,
    anchor.authorityLevel,
    anchor.resourceScope,
  ]
    .join(" ")
    .toLowerCase();

const chooseLatestCiCdRequiredContextAnchor = (
  availableAnchors: readonly ContextAnchor[],
  predicate: (anchor: ContextAnchor) => boolean,
): ContextAnchor | undefined => {
  const matchingAnchors = availableAnchors.filter(predicate).sort((left, right) => {
    const rightTime = Date.parse(right.createdAt);
    const leftTime = Date.parse(left.createdAt);
    const timeDelta =
      (Number.isNaN(rightTime) ? 0 : rightTime) -
      (Number.isNaN(leftTime) ? 0 : leftTime);

    if (timeDelta !== 0) {
      return timeDelta;
    }

    return left.anchorId.localeCompare(right.anchorId);
  });

  return matchingAnchors[0];
};

const createCiCdRequiredContextFallbackAnchorId = (
  input: CiCdRequiredContextObligationCompilerInput,
  role: CiCdRequiredContextAnchorRole,
  resourceScope: string,
): ContextAnchorId => {
  const requestKey = input.requestId ?? input.toolCallDigest;

  return `ctx-required-cicd-${toCiCdRequiredContextSlug(
    requestKey,
  )}-${role}-${toCiCdRequiredContextSlug(resourceScope)}`;
};

type CiCdRequiredContextAnchorRequirementOptions = {
  input: CiCdRequiredContextObligationCompilerInput;
  role: CiCdRequiredContextAnchorRole;
  anchorType: ContextAnchorType;
  resourceScope: string;
  minimumRetentionMode: RequiredContextMinimumRetentionMode;
  predicate: (anchor: ContextAnchor) => boolean;
};

const createCiCdRequiredContextAnchorRequirement = ({
  input,
  role,
  anchorType,
  resourceScope,
  minimumRetentionMode,
  predicate,
}: CiCdRequiredContextAnchorRequirementOptions): CiCdRequiredContextAnchorRequirement => {
  const anchor = chooseLatestCiCdRequiredContextAnchor(
    input.availableAnchors,
    predicate,
  );

  return {
    role,
    anchorId:
      anchor?.anchorId ??
      createCiCdRequiredContextFallbackAnchorId(input, role, resourceScope),
    anchorType,
    resourceScope,
    minimumRetentionMode,
  };
};

const isCiCdRequiredContextUserInstructionAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean =>
  anchor.anchorType === ContextAnchorType.UserInstruction &&
  (doesCiCdRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
    isCiCdRequiredContextGlobalAnchor(anchor));

const isCiCdRequiredContextApprovalAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean =>
  anchor.anchorType === ContextAnchorType.ApprovalNote &&
  (doesCiCdRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
    isCiCdRequiredContextGlobalAnchor(anchor));

const isCiCdRequiredContextTestResultAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean => {
  const searchText = getCiCdRequiredContextAnchorSearchText(anchor);

  return (
    anchor.anchorType === ContextAnchorType.ToolResult &&
    (searchText.includes("test") || searchText.includes("ci")) &&
    (doesCiCdRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
      isCiCdRequiredContextGlobalAnchor(anchor))
  );
};

const isCiCdRequiredContextReleasePolicyAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean => {
  const searchText = getCiCdRequiredContextAnchorSearchText(anchor);

  return (
    anchor.anchorType === ContextAnchorType.SystemPolicy &&
    (searchText.includes("release") ||
      searchText.includes("deploy") ||
      searchText.includes("pipeline") ||
      searchText.includes("cicd") ||
      searchText.includes("ci/cd")) &&
    (doesCiCdRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
      isCiCdRequiredContextGlobalAnchor(anchor))
  );
};

const isCiCdRequiredContextPipelineStateAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean => {
  const searchText = getCiCdRequiredContextAnchorSearchText(anchor);

  return (
    anchor.anchorType === ContextAnchorType.ResourceState &&
    (searchText.includes("pipeline") ||
      searchText.includes("release") ||
      searchText.includes("deploy")) &&
    (doesCiCdRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
      isCiCdRequiredContextGlobalAnchor(anchor))
  );
};

const isCiCdRequiredContextNegativeTestEvidenceAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean => {
  const searchText = getCiCdRequiredContextAnchorSearchText(anchor);

  return (
    anchor.anchorType === ContextAnchorType.NegativeEvidence &&
    (searchText.includes("test") ||
      searchText.includes("failed") ||
      searchText.includes("missing") ||
      searchText.includes("unverified")) &&
    (doesCiCdRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
      isCiCdRequiredContextGlobalAnchor(anchor))
  );
};

const isCiCdRequiredContextDryRunOnlyApprovalAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean => {
  if (!isCiCdRequiredContextApprovalAnchor(anchor, resourceScope)) {
    return false;
  }

  const searchText = getCiCdRequiredContextAnchorSearchText(anchor);
  const mentionsDryRun =
    searchText.includes("dry-run") ||
    searchText.includes("dry_run") ||
    searchText.includes("dry run") ||
    searchText.includes("dryrun");
  const constrainsProduction =
    searchText.includes("only") ||
    searchText.includes("no production") ||
    searchText.includes("not production") ||
    searchText.includes("without production") ||
    searchText.includes("deny production") ||
    searchText.includes("禁止 production");

  return mentionsDryRun && constrainsProduction;
};

const shouldCiCdRequiredContextRequireNegativeEvidence = (
  testStatus: CiCdRequiredContextTestStatus,
): boolean =>
  testStatus === CiCdRequiredContextTestStatus.Failed ||
  testStatus === CiCdRequiredContextTestStatus.Missing;

const getCiCdRequiredContextObligationKind = (
  operation: CiCdRequiredContextOperation,
  targetEnvironment: string,
  dryRun: boolean,
): CiCdRequiredContextObligationKind => {
  const isProductionRelease =
    targetEnvironment === "production" &&
    cicdRequiredContextProductionOperations.has(operation);

  if (!isProductionRelease) {
    return CiCdRequiredContextObligationKind.UncertainDeployContext;
  }

  return dryRun
    ? CiCdRequiredContextObligationKind.DryRunDeployContext
    : CiCdRequiredContextObligationKind.ProductionDeployContext;
};

const buildCiCdRequiredContextAnchorRequirements = (
  input: CiCdRequiredContextObligationCompilerInput,
  resourceScope: readonly string[],
  testStatus: CiCdRequiredContextTestStatus,
): CiCdRequiredContextAnchorRequirement[] => {
  const requirements: CiCdRequiredContextAnchorRequirement[] = [
    createCiCdRequiredContextAnchorRequirement({
      input,
      role: CiCdRequiredContextAnchorRole.LatestUserInstruction,
      anchorType: ContextAnchorType.UserInstruction,
      resourceScope: "tool_call",
      minimumRetentionMode: ContextRetentionMode.Verbatim,
      predicate: (anchor) =>
        isCiCdRequiredContextUserInstructionAnchor(anchor, resourceScope),
    }),
    createCiCdRequiredContextAnchorRequirement({
      input,
      role: CiCdRequiredContextAnchorRole.ApprovalNote,
      anchorType: ContextAnchorType.ApprovalNote,
      resourceScope: "approval_note",
      minimumRetentionMode: ContextRetentionMode.Verbatim,
      predicate: (anchor) =>
        isCiCdRequiredContextApprovalAnchor(anchor, resourceScope),
    }),
    createCiCdRequiredContextAnchorRequirement({
      input,
      role: CiCdRequiredContextAnchorRole.TestResult,
      anchorType: ContextAnchorType.ToolResult,
      resourceScope: "test_result",
      minimumRetentionMode: ContextRetentionMode.CertifiedSummary,
      predicate: (anchor) =>
        isCiCdRequiredContextTestResultAnchor(anchor, resourceScope),
    }),
    createCiCdRequiredContextAnchorRequirement({
      input,
      role: CiCdRequiredContextAnchorRole.ReleasePolicy,
      anchorType: ContextAnchorType.SystemPolicy,
      resourceScope: "release_policy",
      minimumRetentionMode: ContextRetentionMode.CertifiedSummary,
      predicate: (anchor) =>
        isCiCdRequiredContextReleasePolicyAnchor(anchor, resourceScope),
    }),
    createCiCdRequiredContextAnchorRequirement({
      input,
      role: CiCdRequiredContextAnchorRole.PipelineState,
      anchorType: ContextAnchorType.ResourceState,
      resourceScope: "pipeline_state",
      minimumRetentionMode: ContextRetentionMode.CertifiedSummary,
      predicate: (anchor) =>
        isCiCdRequiredContextPipelineStateAnchor(anchor, resourceScope),
    }),
  ];

  if (shouldCiCdRequiredContextRequireNegativeEvidence(testStatus)) {
    requirements.push(
      createCiCdRequiredContextAnchorRequirement({
        input,
        role: CiCdRequiredContextAnchorRole.NegativeTestEvidence,
        anchorType: ContextAnchorType.NegativeEvidence,
        resourceScope: "test_result",
        minimumRetentionMode: ContextRetentionMode.CertifiedSummary,
        predicate: (anchor) =>
          isCiCdRequiredContextNegativeTestEvidenceAnchor(anchor, resourceScope),
      }),
    );
  }

  return requirements;
};

const uniqueCiCdRequiredContextAnchorIds = (
  requirements: readonly CiCdRequiredContextAnchorRequirement[],
): ContextAnchorId[] =>
  uniqueCiCdRequiredContextStrings(requirements.map((r) => r.anchorId));

const getCiCdRequiredContextActionImpactClass = (
  input: CiCdRequiredContextObligationCompilerInput,
  obligationKind: CiCdRequiredContextObligationKind,
): ActionImpactClassId => {
  if (input.actionImpactClass !== undefined) {
    return input.actionImpactClass;
  }

  if (
    obligationKind === CiCdRequiredContextObligationKind.ProductionDeployContext
  ) {
    return "production_deploy";
  }

  if (obligationKind === CiCdRequiredContextObligationKind.DryRunDeployContext) {
    return "production_deploy_dry_run";
  }

  return "cicd_uncertain";
};

const getCiCdRequiredContextFreshnessWindow = (
  obligationKind: CiCdRequiredContextObligationKind,
): RequiredContextFreshnessWindow =>
  obligationKind === CiCdRequiredContextObligationKind.UncertainDeployContext
    ? "PT15M"
    : "PT30M";

const getCiCdRequiredContextMissingAnchorAction = (
  obligationKind: CiCdRequiredContextObligationKind,
): RequiredContextMissingAnchorAction =>
  obligationKind === CiCdRequiredContextObligationKind.UncertainDeployContext
    ? RequiredContextMissingAnchorAction.Deny
    : RequiredContextMissingAnchorAction.RegroundOrDeny;

export const compileCiCdRequiredContextObligations = (
  input: CiCdRequiredContextObligationCompilerInput,
): CiCdRequiredContextObligationCompilation => {
  const operation = getCiCdRequiredContextOperation(input);
  const targetEnvironment = getCiCdRequiredContextTargetEnvironment(input);
  const dryRun = isCiCdRequiredContextDryRun(input);
  const testStatus = getCiCdRequiredContextTestStatus(input.testStatus);
  const resourceScope = getCiCdRequiredContextResourceScope(
    input,
    targetEnvironment,
  );
  const obligationKind = getCiCdRequiredContextObligationKind(
    operation,
    targetEnvironment,
    dryRun,
  );
  const requiredAnchorRoles = buildCiCdRequiredContextAnchorRequirements(
    input,
    resourceScope,
    testStatus,
  );
  const requiredAnchors = uniqueCiCdRequiredContextAnchorIds(requiredAnchorRoles);
  const requestKey = input.requestId ?? input.toolCallDigest;
  const actionImpactClass = getCiCdRequiredContextActionImpactClass(
    input,
    obligationKind,
  );
  const dryRunOnlyApproval = input.availableAnchors.some((anchor) =>
    isCiCdRequiredContextDryRunOnlyApprovalAnchor(anchor, resourceScope),
  );
  const obligation = RequiredContextObligationSchema.parse({
    obligationId: `rco-cicd-${toCiCdRequiredContextSlug(
      requestKey,
    )}-${obligationKind}-${toCiCdRequiredContextSlug(resourceScope.join("-"))}`,
    toolCallDigest: input.toolCallDigest,
    actionImpactClass,
    requiredAnchors,
    freshnessWindow: getCiCdRequiredContextFreshnessWindow(obligationKind),
    minimumRetentionMode: ContextRetentionMode.Verbatim,
    conflictPolicy: RequiredContextConflictPolicy.DenyOnOmittedConflict,
    taintPolicy: RequiredContextTaintPolicy.DenyOnUntrustedInstruction,
    missingAnchorAction: getCiCdRequiredContextMissingAnchorAction(
      obligationKind,
    ),
  });

  return {
    operation,
    resourceScope,
    targetEnvironment,
    dryRun,
    testStatus,
    obligationKind,
    requiresNegativeEvidenceAnchors:
      shouldCiCdRequiredContextRequireNegativeEvidence(testStatus),
    dryRunOnlyApproval,
    requiredAnchorRoles,
    toolCallDigest: input.toolCallDigest,
    actionImpactClass,
    obligations: [obligation],
  };
};

export const CiCdRequiredContextObligationCompiler: ToolSpecificRequiredContextObligationCompiler<CiCdRequiredContextToolCallCandidate> =
  {
    toolType: "ci_cd",
    compileRequiredContextObligations(input) {
      const compilerInput: CiCdRequiredContextObligationCompilerInput = {
        toolCallDigest: input.toolCallDigest,
        availableAnchors: input.availableAnchors,
      };
      const requestId = input.candidateId ?? input.toolCallCandidate.requestId;

      if (requestId !== undefined) {
        compilerInput.requestId = requestId;
      }

      if (input.actionImpactClass !== undefined) {
        compilerInput.actionImpactClass = input.actionImpactClass;
      }

      if (input.toolCallCandidate.operation !== undefined) {
        compilerInput.operation = input.toolCallCandidate.operation;
      }

      if (input.toolCallCandidate.service !== undefined) {
        compilerInput.service = input.toolCallCandidate.service;
      }

      if (input.toolCallCandidate.pipeline !== undefined) {
        compilerInput.pipeline = input.toolCallCandidate.pipeline;
      }

      if (input.toolCallCandidate.version !== undefined) {
        compilerInput.version = input.toolCallCandidate.version;
      }

      if (input.toolCallCandidate.environment !== undefined) {
        compilerInput.environment = input.toolCallCandidate.environment;
      }

      if (input.toolCallCandidate.targetEnvironment !== undefined) {
        compilerInput.targetEnvironment = input.toolCallCandidate.targetEnvironment;
      }

      if (input.toolCallCandidate.requiredExecutionMode !== undefined) {
        compilerInput.requiredExecutionMode =
          input.toolCallCandidate.requiredExecutionMode;
      }

      if (input.toolCallCandidate.dryRun !== undefined) {
        compilerInput.dryRun = input.toolCallCandidate.dryRun;
      }

      if (input.toolCallCandidate.testStatus !== undefined) {
        compilerInput.testStatus = input.toolCallCandidate.testStatus;
      }

      if (input.toolCallCandidate.resourceScope !== undefined) {
        compilerInput.resourceScope = input.toolCallCandidate.resourceScope;
      }

      return compileCiCdRequiredContextObligations(compilerInput);
    },
  };

const ConfigRequiredContextUnresolvedNamespace = "unresolved_config_namespace";

const configRequiredContextOperationByKeyword: Record<
  string,
  ConfigRequiredContextOperation
> = {
  read: ConfigRequiredContextOperation.Read,
  get: ConfigRequiredContextOperation.Read,
  fetch: ConfigRequiredContextOperation.Read,
  create: ConfigRequiredContextOperation.Create,
  add: ConfigRequiredContextOperation.Create,
  set: ConfigRequiredContextOperation.Update,
  update: ConfigRequiredContextOperation.Update,
  write: ConfigRequiredContextOperation.Update,
  patch: ConfigRequiredContextOperation.Update,
  config_update: ConfigRequiredContextOperation.Update,
  delete: ConfigRequiredContextOperation.Delete,
  remove: ConfigRequiredContextOperation.Delete,
  rollback: ConfigRequiredContextOperation.Rollback,
  revert: ConfigRequiredContextOperation.Rollback,
};

const configRequiredContextMutationOperations =
  new Set<ConfigRequiredContextOperation>([
    ConfigRequiredContextOperation.Create,
    ConfigRequiredContextOperation.Update,
    ConfigRequiredContextOperation.Delete,
    ConfigRequiredContextOperation.Rollback,
  ]);

const normalizeConfigRequiredContextKeyword = (
  value: string | undefined,
): string =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const getConfigRequiredContextOperation = (
  input: ConfigRequiredContextToolCallCandidate,
): ConfigRequiredContextOperation => {
  const normalizedOperation = normalizeConfigRequiredContextKeyword(
    input.operation,
  );

  if (normalizedOperation.length > 0) {
    return (
      configRequiredContextOperationByKeyword[normalizedOperation] ??
      ConfigRequiredContextOperation.Unknown
    );
  }

  const normalizedExecutionMode = normalizeConfigRequiredContextKeyword(
    input.requiredExecutionMode,
  );

  if (normalizedExecutionMode.includes("rollback")) {
    return ConfigRequiredContextOperation.Rollback;
  }

  if (
    normalizedExecutionMode.includes("write") ||
    normalizedExecutionMode.includes("update") ||
    normalizedExecutionMode.includes("sandbox") ||
    normalizedExecutionMode.includes("canary")
  ) {
    return ConfigRequiredContextOperation.Update;
  }

  if (normalizedExecutionMode.includes("read")) {
    return ConfigRequiredContextOperation.Read;
  }

  return ConfigRequiredContextOperation.Unknown;
};

const normalizeConfigRequiredContextScopeValue = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

const uniqueConfigRequiredContextStrings = (
  values: readonly string[],
): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  });

  return result;
};

const getConfigRequiredContextNamespace = (
  input: ConfigRequiredContextToolCallCandidate,
): string => {
  const namespace = input.targetNamespace ?? input.namespace;

  if (namespace === undefined || namespace.trim().length === 0) {
    return ConfigRequiredContextUnresolvedNamespace;
  }

  return normalizeConfigRequiredContextScopeValue(namespace);
};

const classifyConfigRequiredContextNamespace = (
  namespace: string,
  environment: string | undefined,
): ConfigRequiredContextNamespaceClassification => {
  if (namespace === ConfigRequiredContextUnresolvedNamespace) {
    return ConfigRequiredContextNamespaceClassification.Unknown;
  }

  const normalizedNamespace = normalizeConfigRequiredContextKeyword(namespace);
  const normalizedEnvironment = normalizeConfigRequiredContextKeyword(environment);

  if (["production", "prod", "live", "primary"].includes(normalizedNamespace)) {
    return ConfigRequiredContextNamespaceClassification.Production;
  }

  if (normalizedNamespace.includes("sandbox")) {
    return ConfigRequiredContextNamespaceClassification.Sandbox;
  }

  if (normalizedNamespace.includes("canary")) {
    return ConfigRequiredContextNamespaceClassification.Canary;
  }

  if (
    [
      "development",
      "dev",
      "test",
      "staging",
      "stage",
      "nonprod",
      "non_production",
    ].includes(normalizedNamespace) ||
    (normalizedEnvironment.length > 0 &&
      normalizedEnvironment !== "production" &&
      normalizedEnvironment !== "prod")
  ) {
    return ConfigRequiredContextNamespaceClassification.NonProduction;
  }

  return ConfigRequiredContextNamespaceClassification.Unknown;
};

const getConfigRequiredContextResourceScope = (
  input: ConfigRequiredContextToolCallCandidate,
  namespace: string,
): string[] => {
  const explicitResourceScope = uniqueConfigRequiredContextStrings(
    (input.resourceScope ?? [])
      .map(normalizeConfigRequiredContextScopeValue)
      .filter((value) => value.length > 0),
  );

  if (explicitResourceScope.length > 0) {
    return explicitResourceScope;
  }

  const configKey = [input.service, input.key]
    .filter((value): value is string => value !== undefined)
    .map(normalizeConfigRequiredContextScopeValue)
    .filter((value) => value.length > 0)
    .join(".");
  const inferredResourceScope = uniqueConfigRequiredContextStrings(
    [input.sourceSystem, configKey, namespace]
      .filter((value): value is string => value !== undefined)
      .filter((value) => value.length > 0),
  );

  return inferredResourceScope.length > 0
    ? inferredResourceScope
    : [ConfigRequiredContextUnresolvedNamespace];
};

const toConfigRequiredContextSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "unknown";

const normalizeConfigRequiredContextMatchValue = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const isConfigRequiredContextWildcardScope = (scope: string): boolean =>
  scope === "*" ||
  scope.endsWith(":*") ||
  scope.endsWith("/*") ||
  scope.includes("all_config") ||
  scope.includes("all-config") ||
  scope.includes("all_namespaces") ||
  scope.includes("all-namespaces");

const doesConfigRequiredContextAnchorMatchResource = (
  anchor: ContextAnchor,
  resourceScope: string,
): boolean => {
  const anchorScope = normalizeConfigRequiredContextMatchValue(
    anchor.resourceScope,
  );
  const resource = normalizeConfigRequiredContextMatchValue(resourceScope);

  if (resource.length === 0) {
    return false;
  }

  if (
    anchorScope === resource ||
    isConfigRequiredContextWildcardScope(anchorScope)
  ) {
    return true;
  }

  const resourceTokens = resource.split(/\s+/).filter(Boolean);
  const anchorTokens = anchorScope.split(/\s+/).filter(Boolean);

  return resourceTokens.some((token) => anchorTokens.includes(token));
};

const doesConfigRequiredContextAnchorMatchAnyResource = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean =>
  resourceScope.some((resource) =>
    doesConfigRequiredContextAnchorMatchResource(anchor, resource),
  );

const isConfigRequiredContextGlobalAnchor = (anchor: ContextAnchor): boolean => {
  const scope = normalizeConfigRequiredContextMatchValue(anchor.resourceScope);

  return (
    isConfigRequiredContextWildcardScope(scope) ||
    scope.includes("tool call") ||
    scope.includes("request") ||
    scope.includes("config")
  );
};

const getConfigRequiredContextAnchorSearchText = (
  anchor: ContextAnchor,
): string =>
  [
    anchor.anchorId,
    anchor.anchorType,
    anchor.sourceIdentity,
    anchor.authorityLevel,
    anchor.resourceScope,
  ]
    .join(" ")
    .toLowerCase();

const chooseLatestConfigRequiredContextAnchor = (
  availableAnchors: readonly ContextAnchor[],
  predicate: (anchor: ContextAnchor) => boolean,
): ContextAnchor | undefined => {
  const matchingAnchors = availableAnchors.filter(predicate).sort((left, right) => {
    const rightTime = Date.parse(right.createdAt);
    const leftTime = Date.parse(left.createdAt);
    const timeDelta =
      (Number.isNaN(rightTime) ? 0 : rightTime) -
      (Number.isNaN(leftTime) ? 0 : leftTime);

    if (timeDelta !== 0) {
      return timeDelta;
    }

    return left.anchorId.localeCompare(right.anchorId);
  });

  return matchingAnchors[0];
};

const createConfigRequiredContextFallbackAnchorId = (
  input: ConfigRequiredContextObligationCompilerInput,
  role: ConfigRequiredContextAnchorRole,
  resourceScope: string,
): ContextAnchorId => {
  const requestKey = input.requestId ?? input.toolCallDigest;

  return `ctx-required-config-${toConfigRequiredContextSlug(
    requestKey,
  )}-${role}-${toConfigRequiredContextSlug(resourceScope)}`;
};

type ConfigRequiredContextAnchorRequirementOptions = {
  input: ConfigRequiredContextObligationCompilerInput;
  role: ConfigRequiredContextAnchorRole;
  anchorType: ContextAnchorType;
  resourceScope: string;
  minimumRetentionMode: RequiredContextMinimumRetentionMode;
  predicate: (anchor: ContextAnchor) => boolean;
};

const createConfigRequiredContextAnchorRequirement = ({
  input,
  role,
  anchorType,
  resourceScope,
  minimumRetentionMode,
  predicate,
}: ConfigRequiredContextAnchorRequirementOptions): ConfigRequiredContextAnchorRequirement => {
  const anchor = chooseLatestConfigRequiredContextAnchor(
    input.availableAnchors,
    predicate,
  );

  return {
    role,
    anchorId:
      anchor?.anchorId ??
      createConfigRequiredContextFallbackAnchorId(input, role, resourceScope),
    anchorType,
    resourceScope,
    minimumRetentionMode,
  };
};

const isConfigRequiredContextUserInstructionAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean =>
  anchor.anchorType === ContextAnchorType.UserInstruction &&
  (doesConfigRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
    isConfigRequiredContextGlobalAnchor(anchor));

const isConfigRequiredContextApprovalAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean =>
  anchor.anchorType === ContextAnchorType.ApprovalNote &&
  (doesConfigRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
    isConfigRequiredContextGlobalAnchor(anchor));

const isConfigRequiredContextCurrentConfigAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean => {
  const searchText = getConfigRequiredContextAnchorSearchText(anchor);

  return (
    anchor.anchorType === ContextAnchorType.ResourceState &&
    (searchText.includes("config") ||
      searchText.includes("current") ||
      searchText.includes("state") ||
      searchText.includes("version")) &&
    (doesConfigRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
      isConfigRequiredContextGlobalAnchor(anchor))
  );
};

const isConfigRequiredContextPolicyAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean => {
  const searchText = getConfigRequiredContextAnchorSearchText(anchor);

  return (
    anchor.anchorType === ContextAnchorType.SystemPolicy &&
    (searchText.includes("config") ||
      searchText.includes("namespace") ||
      searchText.includes("policy")) &&
    (doesConfigRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
      isConfigRequiredContextGlobalAnchor(anchor))
  );
};

const isConfigRequiredContextRollbackAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean => {
  const searchText = getConfigRequiredContextAnchorSearchText(anchor);

  return (
    (anchor.anchorType === ContextAnchorType.RetrievedDocument ||
      anchor.anchorType === ContextAnchorType.ToolResult ||
      anchor.anchorType === ContextAnchorType.ResourceState ||
      anchor.anchorType === ContextAnchorType.ApprovalNote) &&
    (searchText.includes("rollback") ||
      searchText.includes("backout") ||
      searchText.includes("restore") ||
      searchText.includes("revert")) &&
    (doesConfigRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
      isConfigRequiredContextGlobalAnchor(anchor))
  );
};

const isConfigRequiredContextNamespaceConstraintAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean => {
  const searchText = getConfigRequiredContextAnchorSearchText(anchor);

  return (
    (anchor.anchorType === ContextAnchorType.DelegationConstraint ||
      anchor.anchorType === ContextAnchorType.SystemPolicy ||
      anchor.anchorType === ContextAnchorType.ApprovalNote) &&
    (searchText.includes("namespace") ||
      searchText.includes("sandbox") ||
      searchText.includes("canary") ||
      searchText.includes("constraint") ||
      searchText.includes("isolation")) &&
    (doesConfigRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
      isConfigRequiredContextGlobalAnchor(anchor))
  );
};

const isConfigRequiredContextNegativeEvidenceAnchor = (
  anchor: ContextAnchor,
  resourceScope: readonly string[],
): boolean => {
  const searchText = getConfigRequiredContextAnchorSearchText(anchor);

  return (
    anchor.anchorType === ContextAnchorType.NegativeEvidence &&
    (searchText.includes("danger") ||
      searchText.includes("unsafe") ||
      searchText.includes("risky") ||
      searchText.includes("prohibited") ||
      searchText.includes("denied") ||
      searchText.includes("rejected")) &&
    (doesConfigRequiredContextAnchorMatchAnyResource(anchor, resourceScope) ||
      isConfigRequiredContextGlobalAnchor(anchor))
  );
};

const isConfigRequiredContextDangerousValue = (
  input: ConfigRequiredContextToolCallCandidate,
): boolean => {
  if (input.dangerousValue === true) {
    return true;
  }

  const valueText = [input.value, input.newValue, input.proposedValue]
    .filter((value): value is string => value !== undefined)
    .join(" ")
    .toLowerCase();

  if (valueText.length === 0) {
    return false;
  }

  return [
    "allow_all",
    "allow all",
    "disable_auth",
    "disable auth",
    "skip_tls",
    "no_tls",
    "plaintext",
    "0.0.0.0/0",
    "*",
    "root",
    "admin",
    "bypass",
    "unsafe",
    "danger",
  ].some((keyword) => valueText.includes(keyword));
};

const getConfigRequiredContextObligationKind = (
  operation: ConfigRequiredContextOperation,
  namespaceClassification: ConfigRequiredContextNamespaceClassification,
): ConfigRequiredContextObligationKind => {
  if (
    !configRequiredContextMutationOperations.has(operation) ||
    namespaceClassification === ConfigRequiredContextNamespaceClassification.Unknown ||
    namespaceClassification === ConfigRequiredContextNamespaceClassification.NonProduction
  ) {
    return ConfigRequiredContextObligationKind.UncertainConfigChangeContext;
  }

  if (
    namespaceClassification ===
    ConfigRequiredContextNamespaceClassification.Production
  ) {
    return ConfigRequiredContextObligationKind.ProductionConfigChangeContext;
  }

  if (
    namespaceClassification === ConfigRequiredContextNamespaceClassification.Sandbox
  ) {
    return ConfigRequiredContextObligationKind.SandboxNamespaceConstrainedContext;
  }

  return ConfigRequiredContextObligationKind.CanaryNamespaceConstrainedContext;
};

const shouldConfigRequiredContextRequireNamespaceConstraint = (
  obligationKind: ConfigRequiredContextObligationKind,
): boolean =>
  obligationKind ===
    ConfigRequiredContextObligationKind.SandboxNamespaceConstrainedContext ||
  obligationKind ===
    ConfigRequiredContextObligationKind.CanaryNamespaceConstrainedContext;

const buildConfigRequiredContextAnchorRequirements = (
  input: ConfigRequiredContextObligationCompilerInput,
  obligationKind: ConfigRequiredContextObligationKind,
  resourceScope: readonly string[],
  dangerousValue: boolean,
): ConfigRequiredContextAnchorRequirement[] => {
  const requirements: ConfigRequiredContextAnchorRequirement[] = [
    createConfigRequiredContextAnchorRequirement({
      input,
      role: ConfigRequiredContextAnchorRole.LatestUserInstruction,
      anchorType: ContextAnchorType.UserInstruction,
      resourceScope: "tool_call",
      minimumRetentionMode: ContextRetentionMode.Verbatim,
      predicate: (anchor) =>
        isConfigRequiredContextUserInstructionAnchor(anchor, resourceScope),
    }),
    createConfigRequiredContextAnchorRequirement({
      input,
      role: ConfigRequiredContextAnchorRole.ConfigPolicy,
      anchorType: ContextAnchorType.SystemPolicy,
      resourceScope: "config_policy",
      minimumRetentionMode: ContextRetentionMode.CertifiedSummary,
      predicate: (anchor) =>
        isConfigRequiredContextPolicyAnchor(anchor, resourceScope),
    }),
    createConfigRequiredContextAnchorRequirement({
      input,
      role: ConfigRequiredContextAnchorRole.CurrentConfigState,
      anchorType: ContextAnchorType.ResourceState,
      resourceScope: "current_config_state",
      minimumRetentionMode: ContextRetentionMode.CertifiedSummary,
      predicate: (anchor) =>
        isConfigRequiredContextCurrentConfigAnchor(anchor, resourceScope),
    }),
  ];

  if (
    obligationKind ===
    ConfigRequiredContextObligationKind.ProductionConfigChangeContext
  ) {
    requirements.push(
      createConfigRequiredContextAnchorRequirement({
        input,
        role: ConfigRequiredContextAnchorRole.ApprovalNote,
        anchorType: ContextAnchorType.ApprovalNote,
        resourceScope: "approval_note",
        minimumRetentionMode: ContextRetentionMode.Verbatim,
        predicate: (anchor) =>
          isConfigRequiredContextApprovalAnchor(anchor, resourceScope),
      }),
      createConfigRequiredContextAnchorRequirement({
        input,
        role: ConfigRequiredContextAnchorRole.RollbackPlan,
        anchorType: ContextAnchorType.RetrievedDocument,
        resourceScope: "rollback_plan",
        minimumRetentionMode: ContextRetentionMode.Verbatim,
        predicate: (anchor) =>
          isConfigRequiredContextRollbackAnchor(anchor, resourceScope),
      }),
    );
  }

  if (shouldConfigRequiredContextRequireNamespaceConstraint(obligationKind)) {
    requirements.push(
      createConfigRequiredContextAnchorRequirement({
        input,
        role: ConfigRequiredContextAnchorRole.NamespaceConstraint,
        anchorType: ContextAnchorType.DelegationConstraint,
        resourceScope: "namespace_constraint",
        minimumRetentionMode: ContextRetentionMode.Verbatim,
        predicate: (anchor) =>
          isConfigRequiredContextNamespaceConstraintAnchor(anchor, resourceScope),
      }),
    );
  }

  if (dangerousValue) {
    requirements.push(
      createConfigRequiredContextAnchorRequirement({
        input,
        role: ConfigRequiredContextAnchorRole.NegativeEvidence,
        anchorType: ContextAnchorType.NegativeEvidence,
        resourceScope: "dangerous_value",
        minimumRetentionMode: ContextRetentionMode.CertifiedSummary,
        predicate: (anchor) =>
          isConfigRequiredContextNegativeEvidenceAnchor(anchor, resourceScope),
      }),
    );
  }

  return requirements;
};

const uniqueConfigRequiredContextAnchorIds = (
  requirements: readonly ConfigRequiredContextAnchorRequirement[],
): ContextAnchorId[] =>
  uniqueConfigRequiredContextStrings(requirements.map((r) => r.anchorId));

const getConfigRequiredContextActionImpactClass = (
  input: ConfigRequiredContextObligationCompilerInput,
  obligationKind: ConfigRequiredContextObligationKind,
): ActionImpactClassId => {
  if (input.actionImpactClass !== undefined) {
    return input.actionImpactClass;
  }

  if (
    obligationKind ===
    ConfigRequiredContextObligationKind.ProductionConfigChangeContext
  ) {
    return "production_config_change";
  }

  if (
    obligationKind ===
    ConfigRequiredContextObligationKind.SandboxNamespaceConstrainedContext
  ) {
    return "sandbox_config_change";
  }

  if (
    obligationKind ===
    ConfigRequiredContextObligationKind.CanaryNamespaceConstrainedContext
  ) {
    return "canary_config_change";
  }

  return "config_uncertain";
};

const getConfigRequiredContextFreshnessWindow = (
  obligationKind: ConfigRequiredContextObligationKind,
): RequiredContextFreshnessWindow => {
  if (
    obligationKind ===
    ConfigRequiredContextObligationKind.UncertainConfigChangeContext
  ) {
    return "PT15M";
  }

  if (
    shouldConfigRequiredContextRequireNamespaceConstraint(obligationKind)
  ) {
    return "PT1H";
  }

  return "PT30M";
};

const getConfigRequiredContextMissingAnchorAction = (
  obligationKind: ConfigRequiredContextObligationKind,
): RequiredContextMissingAnchorAction => {
  if (
    obligationKind ===
    ConfigRequiredContextObligationKind.ProductionConfigChangeContext
  ) {
    return RequiredContextMissingAnchorAction.Reapproval;
  }

  if (
    obligationKind ===
    ConfigRequiredContextObligationKind.UncertainConfigChangeContext
  ) {
    return RequiredContextMissingAnchorAction.Deny;
  }

  return RequiredContextMissingAnchorAction.RegroundOrDeny;
};

export const compileConfigRequiredContextObligations = (
  input: ConfigRequiredContextObligationCompilerInput,
): ConfigRequiredContextObligationCompilation => {
  const operation = getConfigRequiredContextOperation(input);
  const namespace = getConfigRequiredContextNamespace(input);
  const namespaceClassification = classifyConfigRequiredContextNamespace(
    namespace,
    input.environment,
  );
  const resourceScope = getConfigRequiredContextResourceScope(input, namespace);
  const dangerousValue = isConfigRequiredContextDangerousValue(input);
  const obligationKind = getConfigRequiredContextObligationKind(
    operation,
    namespaceClassification,
  );
  const requiredAnchorRoles = buildConfigRequiredContextAnchorRequirements(
    input,
    obligationKind,
    resourceScope,
    dangerousValue,
  );
  const requiredAnchors = uniqueConfigRequiredContextAnchorIds(
    requiredAnchorRoles,
  );
  const requestKey = input.requestId ?? input.toolCallDigest;
  const actionImpactClass = getConfigRequiredContextActionImpactClass(
    input,
    obligationKind,
  );
  const obligation = RequiredContextObligationSchema.parse({
    obligationId: `rco-config-${toConfigRequiredContextSlug(
      requestKey,
    )}-${obligationKind}-${toConfigRequiredContextSlug(resourceScope.join("-"))}`,
    toolCallDigest: input.toolCallDigest,
    actionImpactClass,
    requiredAnchors,
    freshnessWindow: getConfigRequiredContextFreshnessWindow(obligationKind),
    minimumRetentionMode: ContextRetentionMode.Verbatim,
    conflictPolicy: RequiredContextConflictPolicy.DenyOnOmittedConflict,
    taintPolicy: RequiredContextTaintPolicy.DenyOnUntrustedInstruction,
    missingAnchorAction: getConfigRequiredContextMissingAnchorAction(
      obligationKind,
    ),
  });

  return {
    operation,
    namespace,
    namespaceClassification,
    resourceScope,
    dangerousValue,
    obligationKind,
    requiresNamespaceConstraintAnchors:
      shouldConfigRequiredContextRequireNamespaceConstraint(obligationKind),
    requiresNegativeEvidenceAnchors: dangerousValue,
    requiredAnchorRoles,
    toolCallDigest: input.toolCallDigest,
    actionImpactClass,
    obligations: [obligation],
  };
};

export const ConfigRequiredContextObligationCompiler: ToolSpecificRequiredContextObligationCompiler<ConfigRequiredContextToolCallCandidate> =
  {
    toolType: "config",
    compileRequiredContextObligations(input) {
      const compilerInput: ConfigRequiredContextObligationCompilerInput = {
        toolCallDigest: input.toolCallDigest,
        availableAnchors: input.availableAnchors,
      };
      const requestId = input.candidateId ?? input.toolCallCandidate.requestId;

      if (requestId !== undefined) {
        compilerInput.requestId = requestId;
      }

      if (input.actionImpactClass !== undefined) {
        compilerInput.actionImpactClass = input.actionImpactClass;
      }

      if (input.toolCallCandidate.operation !== undefined) {
        compilerInput.operation = input.toolCallCandidate.operation;
      }

      if (input.toolCallCandidate.service !== undefined) {
        compilerInput.service = input.toolCallCandidate.service;
      }

      if (input.toolCallCandidate.key !== undefined) {
        compilerInput.key = input.toolCallCandidate.key;
      }

      if (input.toolCallCandidate.namespace !== undefined) {
        compilerInput.namespace = input.toolCallCandidate.namespace;
      }

      if (input.toolCallCandidate.targetNamespace !== undefined) {
        compilerInput.targetNamespace = input.toolCallCandidate.targetNamespace;
      }

      if (input.toolCallCandidate.sourceSystem !== undefined) {
        compilerInput.sourceSystem = input.toolCallCandidate.sourceSystem;
      }

      if (input.toolCallCandidate.environment !== undefined) {
        compilerInput.environment = input.toolCallCandidate.environment;
      }

      if (input.toolCallCandidate.requiredExecutionMode !== undefined) {
        compilerInput.requiredExecutionMode =
          input.toolCallCandidate.requiredExecutionMode;
      }

      if (input.toolCallCandidate.resourceScope !== undefined) {
        compilerInput.resourceScope = input.toolCallCandidate.resourceScope;
      }

      if (input.toolCallCandidate.value !== undefined) {
        compilerInput.value = input.toolCallCandidate.value;
      }

      if (input.toolCallCandidate.newValue !== undefined) {
        compilerInput.newValue = input.toolCallCandidate.newValue;
      }

      if (input.toolCallCandidate.proposedValue !== undefined) {
        compilerInput.proposedValue = input.toolCallCandidate.proposedValue;
      }

      if (input.toolCallCandidate.dangerousValue !== undefined) {
        compilerInput.dangerousValue = input.toolCallCandidate.dangerousValue;
      }

      return compileConfigRequiredContextObligations(compilerInput);
    },
  };

const addPromptAssemblyManifestIssue = (
  collector: PromptAssemblyManifestIssueCollector,
  path: string,
  code: string,
  message: string,
) => {
  collector.issues.push({ path, code, message });
};

const promptAssemblyManifestChildPath = (path: string, key: string) =>
  `${path}.${key}`;

const isPromptAssemblyManifestRecord = (
  input: unknown,
): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const readPromptAssemblyManifestString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: PromptAssemblyManifestIssueCollector,
): string => {
  const value = input[key];

  if (typeof value !== "string" || value.length === 0) {
    addPromptAssemblyManifestIssue(
      collector,
      promptAssemblyManifestChildPath(path, key),
      "invalid_string",
      "Expected a non-empty string.",
    );
    return "";
  }

  return value;
};

const readPromptAssemblyManifestNonNegativeInteger = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: PromptAssemblyManifestIssueCollector,
): number => {
  const value = input[key];

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    addPromptAssemblyManifestIssue(
      collector,
      promptAssemblyManifestChildPath(path, key),
      "invalid_non_negative_integer",
      "Expected a non-negative integer.",
    );
    return 0;
  }

  return value;
};

const readPromptAssemblyManifestStringArray = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: PromptAssemblyManifestIssueCollector,
): string[] => {
  const value = input[key];
  const issuePath = promptAssemblyManifestChildPath(path, key);

  if (!Array.isArray(value)) {
    addPromptAssemblyManifestIssue(
      collector,
      issuePath,
      "invalid_array",
      "Expected an array of strings.",
    );
    return [];
  }

  return value.flatMap((item, index) => {
    if (typeof item !== "string" || item.length === 0) {
      addPromptAssemblyManifestIssue(
        collector,
        `${issuePath}[${index}]`,
        "invalid_string",
        "Expected a non-empty string.",
      );
      return [];
    }

    return [item];
  });
};

const readPromptAssemblyManifestObjectArray = <TValue>(
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: PromptAssemblyManifestIssueCollector,
  readItem: (
    item: unknown,
    itemPath: string,
    itemCollector: PromptAssemblyManifestIssueCollector,
  ) => TValue,
): TValue[] => {
  const value = input[key];
  const issuePath = promptAssemblyManifestChildPath(path, key);

  if (!Array.isArray(value)) {
    addPromptAssemblyManifestIssue(
      collector,
      issuePath,
      "invalid_array",
      "Expected an array of objects.",
    );
    return [];
  }

  return value.map((item, index) =>
    readItem(item, `${issuePath}[${index}]`, collector),
  );
};

const validatePromptContextUnitDigestShape = (
  input: unknown,
  path: string,
  collector: PromptAssemblyManifestIssueCollector,
): PromptContextUnitDigest => {
  if (!isPromptAssemblyManifestRecord(input)) {
    addPromptAssemblyManifestIssue(
      collector,
      path,
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;

  return {
    contextUnitId: readPromptAssemblyManifestString(
      record,
      "contextUnitId",
      path,
      collector,
    ),
    digest: readPromptAssemblyManifestString(record, "digest", path, collector),
  };
};

const validatePromptTokenPositionRangeShape = (
  input: unknown,
  path: string,
  collector: PromptAssemblyManifestIssueCollector,
): PromptTokenPositionRange => {
  if (!isPromptAssemblyManifestRecord(input)) {
    addPromptAssemblyManifestIssue(
      collector,
      path,
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;
  const startToken = readPromptAssemblyManifestNonNegativeInteger(
    record,
    "startToken",
    path,
    collector,
  );
  const endToken = readPromptAssemblyManifestNonNegativeInteger(
    record,
    "endToken",
    path,
    collector,
  );

  if (endToken < startToken) {
    addPromptAssemblyManifestIssue(
      collector,
      path,
      "invalid_token_range",
      "Expected endToken to be greater than or equal to startToken.",
    );
  }

  return {
    contextUnitId: readPromptAssemblyManifestString(
      record,
      "contextUnitId",
      path,
      collector,
    ),
    startToken,
    endToken,
  };
};

const validatePromptAssemblyManifestShape = (
  input: unknown,
  collector: PromptAssemblyManifestIssueCollector,
): PromptAssemblyManifest => {
  if (!isPromptAssemblyManifestRecord(input)) {
    addPromptAssemblyManifestIssue(
      collector,
      "$",
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;
  const path = "$";

  return {
    manifestId: readPromptAssemblyManifestString(
      record,
      "manifestId",
      path,
      collector,
    ),
    inferenceId: readPromptAssemblyManifestString(
      record,
      "inferenceId",
      path,
      collector,
    ),
    modelId: readPromptAssemblyManifestString(
      record,
      "modelId",
      path,
      collector,
    ),
    promptDigest: readPromptAssemblyManifestString(
      record,
      "promptDigest",
      path,
      collector,
    ),
    contextUnitDigests: readPromptAssemblyManifestObjectArray(
      record,
      "contextUnitDigests",
      path,
      collector,
      validatePromptContextUnitDigestShape,
    ),
    contextUnitOrder: readPromptAssemblyManifestStringArray(
      record,
      "contextUnitOrder",
      path,
      collector,
    ),
    tokenPositionRanges: readPromptAssemblyManifestObjectArray(
      record,
      "tokenPositionRanges",
      path,
      collector,
      validatePromptTokenPositionRangeShape,
    ),
    summaryDerivationDigests: readPromptAssemblyManifestStringArray(
      record,
      "summaryDerivationDigests",
      path,
      collector,
    ),
    retrievalQueryDigest: readPromptAssemblyManifestString(
      record,
      "retrievalQueryDigest",
      path,
      collector,
    ),
    retrievedDocumentDigests: readPromptAssemblyManifestStringArray(
      record,
      "retrievedDocumentDigests",
      path,
      collector,
    ),
    memorySnapshotDigest: readPromptAssemblyManifestString(
      record,
      "memorySnapshotDigest",
      path,
      collector,
    ),
    systemPolicyDigest: readPromptAssemblyManifestString(
      record,
      "systemPolicyDigest",
      path,
      collector,
    ),
  };
};

export const validatePromptAssemblyManifest = (
  input: unknown,
): PromptAssemblyManifestValidationResult => {
  const collector: PromptAssemblyManifestIssueCollector = { issues: [] };
  const data = validatePromptAssemblyManifestShape(input, collector);

  if (collector.issues.length > 0) {
    return { success: false, issues: collector.issues };
  }

  return { success: true, data };
};

export const PromptAssemblyManifestSchema = {
  parse(input: unknown): PromptAssemblyManifest {
    const result = validatePromptAssemblyManifest(input);

    if (!result.success) {
      throw new PromptAssemblyManifestValidationError(result.issues);
    }

    return result.data;
  },
  safeParse(input: unknown): PromptAssemblyManifestValidationResult {
    return validatePromptAssemblyManifest(input);
  },
};

export const isPromptAssemblyManifest = (
  input: unknown,
): input is PromptAssemblyManifest =>
  validatePromptAssemblyManifest(input).success;

export const buildPromptAssemblyManifestHashPayload = (
  input: unknown,
): string => {
  const manifest = PromptAssemblyManifestSchema.parse(input);

  return JSON.stringify({
    schema:
      "agent-safety-gateway.context-retention.PromptAssemblyManifest.v1",
    manifestId: manifest.manifestId,
    inferenceId: manifest.inferenceId,
    modelId: manifest.modelId,
    promptDigest: manifest.promptDigest,
    contextUnitDigests: manifest.contextUnitDigests.map((contextUnit) => ({
      contextUnitId: contextUnit.contextUnitId,
      digest: contextUnit.digest,
    })),
    contextUnitOrder: [...manifest.contextUnitOrder],
    tokenPositionRanges: manifest.tokenPositionRanges.map((range) => ({
      contextUnitId: range.contextUnitId,
      startToken: range.startToken,
      endToken: range.endToken,
    })),
    summaryDerivationDigests: [...manifest.summaryDerivationDigests],
    retrievalQueryDigest: manifest.retrievalQueryDigest,
    retrievedDocumentDigests: [...manifest.retrievedDocumentDigests],
    memorySnapshotDigest: manifest.memorySnapshotDigest,
    systemPolicyDigest: manifest.systemPolicyDigest,
  });
};

const promptManifestToHexDigest = (digest: ArrayBuffer): string =>
  Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const promptManifestSha256InitialHash = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f,
  0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
] as const;

const promptManifestSha256RoundConstants = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
  0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
  0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
  0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

const promptManifestRotateRight = (value: number, bits: number): number =>
  (value >>> bits) | (value << (32 - bits));

const createPurePromptManifestSha256DigestHex = (payload: string): string => {
  const message = new TextEncoder().encode(payload);
  const bitLength = BigInt(message.length) * 8n;
  const paddedLength = Math.ceil((message.length + 9) / 64) * 64;
  const paddedMessage = new Uint8Array(paddedLength);
  paddedMessage.set(message);
  paddedMessage[message.length] = 0x80;

  const dataView = new DataView(paddedMessage.buffer);
  dataView.setUint32(
    paddedLength - 8,
    Number((bitLength >> 32n) & 0xffffffffn),
  );
  dataView.setUint32(paddedLength - 4, Number(bitLength & 0xffffffffn));

  const hash: number[] = [...promptManifestSha256InitialHash];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = dataView.getUint32(offset + index * 4);
    }

    for (let index = 16; index < 64; index += 1) {
      const word15 = words[index - 15] ?? 0;
      const word2 = words[index - 2] ?? 0;
      const sigma0 =
        promptManifestRotateRight(word15, 7) ^
        promptManifestRotateRight(word15, 18) ^
        (word15 >>> 3);
      const sigma1 =
        promptManifestRotateRight(word2, 17) ^
        promptManifestRotateRight(word2, 19) ^
        (word2 >>> 10);
      words[index] =
        ((words[index - 16] ?? 0) +
          sigma0 +
          (words[index - 7] ?? 0) +
          sigma1) >>>
        0;
    }

    let a = hash[0] ?? 0;
    let b = hash[1] ?? 0;
    let c = hash[2] ?? 0;
    let d = hash[3] ?? 0;
    let e = hash[4] ?? 0;
    let f = hash[5] ?? 0;
    let g = hash[6] ?? 0;
    let h = hash[7] ?? 0;

    for (let index = 0; index < 64; index += 1) {
      const sigma1 =
        promptManifestRotateRight(e, 6) ^
        promptManifestRotateRight(e, 11) ^
        promptManifestRotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 =
        (h +
          sigma1 +
          choice +
          (promptManifestSha256RoundConstants[index] ?? 0) +
          (words[index] ?? 0)) >>>
        0;
      const sigma0 =
        promptManifestRotateRight(a, 2) ^
        promptManifestRotateRight(a, 13) ^
        promptManifestRotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sigma0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    hash[0] = ((hash[0] ?? 0) + a) >>> 0;
    hash[1] = ((hash[1] ?? 0) + b) >>> 0;
    hash[2] = ((hash[2] ?? 0) + c) >>> 0;
    hash[3] = ((hash[3] ?? 0) + d) >>> 0;
    hash[4] = ((hash[4] ?? 0) + e) >>> 0;
    hash[5] = ((hash[5] ?? 0) + f) >>> 0;
    hash[6] = ((hash[6] ?? 0) + g) >>> 0;
    hash[7] = ((hash[7] ?? 0) + h) >>> 0;
  }

  return hash.map((word) => word.toString(16).padStart(8, "0")).join("");
};

const createPromptManifestSha256DigestHex = async (
  payload: string,
): Promise<string> => {
  const encodedPayload = new TextEncoder().encode(payload);
  const cryptoSubtle = globalThis.crypto?.subtle;

  if (cryptoSubtle !== undefined) {
    return promptManifestToHexDigest(
      await cryptoSubtle.digest("SHA-256", encodedPayload),
    );
  }

  return createPurePromptManifestSha256DigestHex(payload);
};

export const createPromptAssemblyManifestHash = async (
  input: unknown,
): Promise<PromptAssemblyManifestHash> => {
  const hashPayload = buildPromptAssemblyManifestHashPayload(input);

  return `${EvidenceHashAlgorithm.Sha256}:${await createPromptManifestSha256DigestHex(
    hashPayload,
  )}`;
};

export const ContextRetentionDomain = {
  name: ContextRetentionDomainName,
  stateMachine: "context-sufficiency",
  anchor: "ContextAnchor",
  obligation: "RequiredContextObligation",
  manifest: "PromptAssemblyManifest",
  evidence: "ContextRetentionEvidence",
  permitExit: "PermitDecision",
} as const;
