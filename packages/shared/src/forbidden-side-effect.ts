import { PatentStateMachineDomain } from "./patent-state-machine.js";
import type {
  PatentProofHash,
  PatentProofTimestamp,
  StateMachineEntityId,
  StateMachineRunId,
} from "./patent-state-machine.js";

export const ForbiddenSideEffectDomainName =
  PatentStateMachineDomain.ForbiddenSideEffect;

export type ForbiddenSideEffectDomainName =
  typeof ForbiddenSideEffectDomainName;

export type ForbiddenEffectObligationId = StateMachineEntityId;

export type EvidencePlanId = StateMachineEntityId;

export type NegativeProbePlanId = StateMachineEntityId;

export type SideEffectProbePlanId = StateMachineEntityId;

export type DeniedCapabilityEvidenceId = StateMachineEntityId;

export type SideEffectDeltaEvidenceId = StateMachineEntityId;

export type EvidenceCoverageMapId = StateMachineEntityId;

export type ExecutorSafetyEvidenceStateId = StateMachineEntityId;

export type ExecutorDriftFingerprintHash = PatentProofHash;

export type PermitBindingId = StateMachineEntityId;

export type PermitDeniedEvidenceId = StateMachineEntityId;

export type ForbiddenSideEffectRunId = StateMachineRunId;

export type ForbiddenSideEffectTimestamp = PatentProofTimestamp;

export const ForbiddenEffectType = {
  Sql: "sql",
  CiCd: "ci_cd",
  Config: "config",
  Script: "script",
  CloudApi: "cloud_api",
} as const;

export type ForbiddenEffectType =
  (typeof ForbiddenEffectType)[keyof typeof ForbiddenEffectType];

export const ForbiddenEffectEnvironment = {
  Development: "development",
  Test: "test",
  Staging: "staging",
  Production: "production",
} as const;

export type ForbiddenEffectEnvironment =
  (typeof ForbiddenEffectEnvironment)[keyof typeof ForbiddenEffectEnvironment];

export const ForbiddenEffectSeverity = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Critical: "critical",
} as const;

export type ForbiddenEffectSeverity =
  (typeof ForbiddenEffectSeverity)[keyof typeof ForbiddenEffectSeverity];

export const ForbiddenEffectEvidenceType = {
  WriteDenial: "write_denial",
  DeleteDenial: "delete_denial",
  DdlDenial: "ddl_denial",
  NoRowMutation: "no_row_mutation",
  NoTriggerSideEffect: "no_trigger_side_effect",
  ProductionDeployDenial: "production_deploy_denial",
  ExternalWebhookDenial: "external_webhook_denial",
  ArtifactPromotionDenial: "artifact_promotion_denial",
  ProductionNamespaceWriteDenial: "production_namespace_write_denial",
  ProductionCredentialUseDenial: "production_credential_use_denial",
  ProductionWriteEndpointAccessDenial:
    "production_write_endpoint_access_denial",
  ScriptFilesystemWriteDenial: "script_filesystem_write_denial",
  ScriptNetworkEgressDenial: "script_network_egress_denial",
  CloudApiMutationDenial: "cloud_api_mutation_denial",
  CloudPrivilegeEscalationDenial: "cloud_privilege_escalation_denial",
} as const;

export type ForbiddenEffectEvidenceType =
  (typeof ForbiddenEffectEvidenceType)[keyof typeof ForbiddenEffectEvidenceType];

export const ForbiddenEffectFailClosedAction = {
  DenyPermit: "deny_permit",
  RequireEvidence: "require_evidence",
  RequireReprobe: "require_reprobe",
  UseSandbox: "use_sandbox",
} as const;

export type ForbiddenEffectFailClosedAction =
  (typeof ForbiddenEffectFailClosedAction)[keyof typeof ForbiddenEffectFailClosedAction];

export const ForbiddenEffectTypeValues = Object.values(
  ForbiddenEffectType,
) as ForbiddenEffectType[];

export const ForbiddenEffectEnvironmentValues = Object.values(
  ForbiddenEffectEnvironment,
) as ForbiddenEffectEnvironment[];

export const ForbiddenEffectSeverityValues = Object.values(
  ForbiddenEffectSeverity,
) as ForbiddenEffectSeverity[];

export const ForbiddenEffectEvidenceTypeValues = Object.values(
  ForbiddenEffectEvidenceType,
) as ForbiddenEffectEvidenceType[];

export const ForbiddenEffectFailClosedActionValues = Object.values(
  ForbiddenEffectFailClosedAction,
) as ForbiddenEffectFailClosedAction[];

export const EvidencePlanTimeoutAction = {
  DenyPermit: "deny_permit",
  MarkEvidenceIncomplete: "mark_evidence_incomplete",
  RequireReprobe: "require_reprobe",
} as const;

export type EvidencePlanTimeoutAction =
  (typeof EvidencePlanTimeoutAction)[keyof typeof EvidencePlanTimeoutAction];

export const EvidencePlanTimeoutActionValues = Object.values(
  EvidencePlanTimeoutAction,
) as EvidencePlanTimeoutAction[];

export type EvidencePlanTimeoutStrategy = {
  timeoutMs: number;
  onTimeout: EvidencePlanTimeoutAction;
};

export type NegativeProbeTask = {
  probeType: ForbiddenEffectEvidenceType;
  operation: string;
  target: string;
  expectedOutcome: string;
};

export type NegativeProbePlan = {
  probePlanId: NegativeProbePlanId;
  obligationIds: readonly ForbiddenEffectObligationId[];
  executorType: ForbiddenEffectType;
  targetEnvironment: ForbiddenEffectEnvironment;
  requiredFixtures: readonly string[];
  timeoutStrategy: EvidencePlanTimeoutStrategy;
  dangerousCapabilitiesToDeny: readonly string[];
  probeTasks: readonly NegativeProbeTask[];
  executorId?: string;
};

export type SideEffectProbePlan = {
  probePlanId: SideEffectProbePlanId;
  obligationIds: readonly ForbiddenEffectObligationId[];
  executorType: ForbiddenEffectType;
  targetEnvironment: ForbiddenEffectEnvironment;
  requiredFixtures: readonly string[];
  timeoutStrategy: EvidencePlanTimeoutStrategy;
  predictedEffectTypes: readonly string[];
  forbiddenEffectTypes: readonly string[];
  snapshotTargets: readonly string[];
  executorId?: string;
};

export type EvidencePlan = {
  planId: EvidencePlanId;
  obligationIds: readonly ForbiddenEffectObligationId[];
  executorType: ForbiddenEffectType;
  targetEnvironment: ForbiddenEffectEnvironment;
  requiredFixtures: readonly string[];
  timeoutStrategy: EvidencePlanTimeoutStrategy;
  negativeProbePlans: readonly NegativeProbePlan[];
  sideEffectProbePlans: readonly SideEffectProbePlan[];
  createdAt?: ForbiddenSideEffectTimestamp;
};

export type ForbiddenEffectObligation = {
  obligationId: ForbiddenEffectObligationId;
  effectType: ForbiddenEffectType;
  resourceScope: readonly string[];
  environment: ForbiddenEffectEnvironment;
  severity: ForbiddenEffectSeverity;
  requiredEvidenceTypes: readonly ForbiddenEffectEvidenceType[];
  failClosedAction: ForbiddenEffectFailClosedAction;
  requestHash?: PatentProofHash;
  requiredExecutionMode?: string;
  executorType?: ForbiddenEffectType;
  forbiddenCapabilities?: readonly string[];
  forbiddenEffects?: readonly string[];
  createdAt?: ForbiddenSideEffectTimestamp;
};

export type ForbiddenEffectObligationValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ForbiddenEffectObligationValidationSuccess = {
  success: true;
  data: ForbiddenEffectObligation;
};

export type ForbiddenEffectObligationValidationFailure = {
  success: false;
  issues: ForbiddenEffectObligationValidationIssue[];
};

export type ForbiddenEffectObligationValidationResult =
  | ForbiddenEffectObligationValidationSuccess
  | ForbiddenEffectObligationValidationFailure;

export type EvidencePlanValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type EvidencePlanValidationSuccess = {
  success: true;
  data: EvidencePlan;
};

export type EvidencePlanValidationFailure = {
  success: false;
  issues: EvidencePlanValidationIssue[];
};

export type EvidencePlanValidationResult =
  | EvidencePlanValidationSuccess
  | EvidencePlanValidationFailure;

export type NegativeProbePlanValidationSuccess = {
  success: true;
  data: NegativeProbePlan;
};

export type NegativeProbePlanValidationFailure = {
  success: false;
  issues: EvidencePlanValidationIssue[];
};

export type NegativeProbePlanValidationResult =
  | NegativeProbePlanValidationSuccess
  | NegativeProbePlanValidationFailure;

export type SideEffectProbePlanValidationSuccess = {
  success: true;
  data: SideEffectProbePlan;
};

export type SideEffectProbePlanValidationFailure = {
  success: false;
  issues: EvidencePlanValidationIssue[];
};

export type SideEffectProbePlanValidationResult =
  | SideEffectProbePlanValidationSuccess
  | SideEffectProbePlanValidationFailure;

export type EvidencePlanObligationReferenceValidationSuccess = {
  success: true;
  data: EvidencePlan;
};

export type EvidencePlanObligationReferenceValidationFailure = {
  success: false;
  issues: EvidencePlanValidationIssue[];
};

export type EvidencePlanObligationReferenceValidationResult =
  | EvidencePlanObligationReferenceValidationSuccess
  | EvidencePlanObligationReferenceValidationFailure;

type ForbiddenEffectObligationIssueCollector = {
  issues: ForbiddenEffectObligationValidationIssue[];
};

type EvidencePlanIssueCollector = {
  issues: EvidencePlanValidationIssue[];
};

type StringEnumValues<TValue extends string> = readonly TValue[];

export class ForbiddenEffectObligationValidationError extends Error {
  readonly issues: ForbiddenEffectObligationValidationIssue[];

  constructor(issues: ForbiddenEffectObligationValidationIssue[]) {
    super("ForbiddenEffectObligation validation failed");
    this.name = "ForbiddenEffectObligationValidationError";
    this.issues = issues;
  }
}

export class EvidencePlanValidationError extends Error {
  readonly issues: EvidencePlanValidationIssue[];

  constructor(issues: EvidencePlanValidationIssue[]) {
    super("EvidencePlan validation failed");
    this.name = "EvidencePlanValidationError";
    this.issues = issues;
  }
}

export class NegativeProbePlanValidationError extends Error {
  readonly issues: EvidencePlanValidationIssue[];

  constructor(issues: EvidencePlanValidationIssue[]) {
    super("NegativeProbePlan validation failed");
    this.name = "NegativeProbePlanValidationError";
    this.issues = issues;
  }
}

export class SideEffectProbePlanValidationError extends Error {
  readonly issues: EvidencePlanValidationIssue[];

  constructor(issues: EvidencePlanValidationIssue[]) {
    super("SideEffectProbePlan validation failed");
    this.name = "SideEffectProbePlanValidationError";
    this.issues = issues;
  }
}

const addForbiddenEffectObligationIssue = (
  collector: ForbiddenEffectObligationIssueCollector,
  path: string,
  code: string,
  message: string,
) => {
  collector.issues.push({ path, code, message });
};

const forbiddenEffectObligationChildPath = (path: string, key: string) =>
  `${path}.${key}`;

const isForbiddenEffectObligationRecord = (
  input: unknown,
): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const readForbiddenEffectObligationString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: ForbiddenEffectObligationIssueCollector,
): string => {
  const value = input[key];

  if (typeof value !== "string" || value.length === 0) {
    addForbiddenEffectObligationIssue(
      collector,
      forbiddenEffectObligationChildPath(path, key),
      "invalid_string",
      "Expected a non-empty string.",
    );
    return "";
  }

  return value;
};

const readOptionalForbiddenEffectObligationString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: ForbiddenEffectObligationIssueCollector,
): string | undefined => {
  const value = input[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.length === 0) {
    addForbiddenEffectObligationIssue(
      collector,
      forbiddenEffectObligationChildPath(path, key),
      "invalid_string",
      "Expected a non-empty string when provided.",
    );
    return undefined;
  }

  return value;
};

const readForbiddenEffectObligationEnum = <TValue extends string>(
  input: Record<string, unknown>,
  key: string,
  values: StringEnumValues<TValue>,
  path: string,
  collector: ForbiddenEffectObligationIssueCollector,
): TValue => {
  const value = input[key];

  if (typeof value !== "string" || !values.includes(value as TValue)) {
    addForbiddenEffectObligationIssue(
      collector,
      forbiddenEffectObligationChildPath(path, key),
      "invalid_enum",
      `Expected one of: ${values.join(", ")}.`,
    );
    return values[0] ?? ("" as TValue);
  }

  return value as TValue;
};

const readOptionalForbiddenEffectObligationEnum = <TValue extends string>(
  input: Record<string, unknown>,
  key: string,
  values: StringEnumValues<TValue>,
  path: string,
  collector: ForbiddenEffectObligationIssueCollector,
): TValue | undefined => {
  const value = input[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !values.includes(value as TValue)) {
    addForbiddenEffectObligationIssue(
      collector,
      forbiddenEffectObligationChildPath(path, key),
      "invalid_enum",
      `Expected one of: ${values.join(", ")}.`,
    );
    return undefined;
  }

  return value as TValue;
};

const readForbiddenEffectObligationStringArray = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: ForbiddenEffectObligationIssueCollector,
): string[] => {
  const value = input[key];
  const issuePath = forbiddenEffectObligationChildPath(path, key);

  if (!Array.isArray(value)) {
    addForbiddenEffectObligationIssue(
      collector,
      issuePath,
      "invalid_array",
      "Expected an array of strings.",
    );
    return [];
  }

  if (value.length === 0) {
    addForbiddenEffectObligationIssue(
      collector,
      issuePath,
      "empty_array",
      "Expected at least one string.",
    );
  }

  return value.flatMap((item, index) => {
    if (typeof item !== "string" || item.length === 0) {
      addForbiddenEffectObligationIssue(
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

const readOptionalForbiddenEffectObligationStringArray = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: ForbiddenEffectObligationIssueCollector,
): string[] | undefined => {
  if (input[key] === undefined) {
    return undefined;
  }

  return readForbiddenEffectObligationStringArray(input, key, path, collector);
};

const readForbiddenEffectObligationEnumArray = <TValue extends string>(
  input: Record<string, unknown>,
  key: string,
  values: StringEnumValues<TValue>,
  path: string,
  collector: ForbiddenEffectObligationIssueCollector,
): TValue[] => {
  const value = input[key];
  const issuePath = forbiddenEffectObligationChildPath(path, key);

  if (!Array.isArray(value)) {
    addForbiddenEffectObligationIssue(
      collector,
      issuePath,
      "invalid_array",
      "Expected an array of enum values.",
    );
    return [];
  }

  if (value.length === 0) {
    addForbiddenEffectObligationIssue(
      collector,
      issuePath,
      "empty_array",
      "Expected at least one enum value.",
    );
  }

  return value.flatMap((item, index) => {
    if (typeof item !== "string" || !values.includes(item as TValue)) {
      addForbiddenEffectObligationIssue(
        collector,
        `${issuePath}[${index}]`,
        "invalid_enum",
        `Expected one of: ${values.join(", ")}.`,
      );
      return [];
    }

    return [item as TValue];
  });
};

const addEvidencePlanIssue = (
  collector: EvidencePlanIssueCollector,
  path: string,
  code: string,
  message: string,
) => {
  collector.issues.push({ path, code, message });
};

const evidencePlanChildPath = (path: string, key: string) => `${path}.${key}`;

const isEvidencePlanRecord = (
  input: unknown,
): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const readEvidencePlanRecord = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: EvidencePlanIssueCollector,
): Record<string, unknown> => {
  const value = input[key];

  if (!isEvidencePlanRecord(value)) {
    addEvidencePlanIssue(
      collector,
      evidencePlanChildPath(path, key),
      "invalid_object",
      "Expected an object.",
    );
    return {};
  }

  return value;
};

const readEvidencePlanString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: EvidencePlanIssueCollector,
): string => {
  const value = input[key];

  if (typeof value !== "string" || value.length === 0) {
    addEvidencePlanIssue(
      collector,
      evidencePlanChildPath(path, key),
      "invalid_string",
      "Expected a non-empty string.",
    );
    return "";
  }

  return value;
};

const readOptionalEvidencePlanString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: EvidencePlanIssueCollector,
): string | undefined => {
  const value = input[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.length === 0) {
    addEvidencePlanIssue(
      collector,
      evidencePlanChildPath(path, key),
      "invalid_string",
      "Expected a non-empty string when provided.",
    );
    return undefined;
  }

  return value;
};

const readEvidencePlanNumber = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: EvidencePlanIssueCollector,
): number => {
  const value = input[key];

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    addEvidencePlanIssue(
      collector,
      evidencePlanChildPath(path, key),
      "invalid_positive_integer",
      "Expected a positive integer.",
    );
    return 0;
  }

  return value;
};

const readEvidencePlanEnum = <TValue extends string>(
  input: Record<string, unknown>,
  key: string,
  values: StringEnumValues<TValue>,
  path: string,
  collector: EvidencePlanIssueCollector,
): TValue => {
  const value = input[key];

  if (typeof value !== "string" || !values.includes(value as TValue)) {
    addEvidencePlanIssue(
      collector,
      evidencePlanChildPath(path, key),
      "invalid_enum",
      `Expected one of: ${values.join(", ")}.`,
    );
    return values[0] ?? ("" as TValue);
  }

  return value as TValue;
};

const readEvidencePlanStringArray = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: EvidencePlanIssueCollector,
): string[] => {
  const value = input[key];
  const issuePath = evidencePlanChildPath(path, key);

  if (!Array.isArray(value)) {
    addEvidencePlanIssue(
      collector,
      issuePath,
      "invalid_array",
      "Expected an array of strings.",
    );
    return [];
  }

  if (value.length === 0) {
    addEvidencePlanIssue(
      collector,
      issuePath,
      "empty_array",
      "Expected at least one string.",
    );
  }

  return value.flatMap((item, index) => {
    if (typeof item !== "string" || item.length === 0) {
      addEvidencePlanIssue(
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

const readEvidencePlanObjectArray = <TValue>(
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: EvidencePlanIssueCollector,
  readItem: (
    item: unknown,
    itemPath: string,
    itemCollector: EvidencePlanIssueCollector,
  ) => TValue,
): TValue[] => {
  const value = input[key];
  const issuePath = evidencePlanChildPath(path, key);

  if (!Array.isArray(value)) {
    addEvidencePlanIssue(
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

const validateEvidencePlanTimeoutStrategyShape = (
  input: unknown,
  path: string,
  collector: EvidencePlanIssueCollector,
): EvidencePlanTimeoutStrategy => {
  if (!isEvidencePlanRecord(input)) {
    addEvidencePlanIssue(
      collector,
      path,
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;

  return {
    timeoutMs: readEvidencePlanNumber(record, "timeoutMs", path, collector),
    onTimeout: readEvidencePlanEnum(
      record,
      "onTimeout",
      EvidencePlanTimeoutActionValues,
      path,
      collector,
    ),
  };
};

const validateNegativeProbeTaskShape = (
  input: unknown,
  path: string,
  collector: EvidencePlanIssueCollector,
): NegativeProbeTask => {
  if (!isEvidencePlanRecord(input)) {
    addEvidencePlanIssue(
      collector,
      path,
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;

  return {
    probeType: readEvidencePlanEnum(
      record,
      "probeType",
      ForbiddenEffectEvidenceTypeValues,
      path,
      collector,
    ),
    operation: readEvidencePlanString(record, "operation", path, collector),
    target: readEvidencePlanString(record, "target", path, collector),
    expectedOutcome: readEvidencePlanString(
      record,
      "expectedOutcome",
      path,
      collector,
    ),
  };
};

const validateNegativeProbePlanShape = (
  input: unknown,
  path: string,
  collector: EvidencePlanIssueCollector,
): NegativeProbePlan => {
  if (!isEvidencePlanRecord(input)) {
    addEvidencePlanIssue(
      collector,
      path,
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;
  const plan: NegativeProbePlan = {
    probePlanId: readEvidencePlanString(
      record,
      "probePlanId",
      path,
      collector,
    ),
    obligationIds: readEvidencePlanStringArray(
      record,
      "obligationIds",
      path,
      collector,
    ),
    executorType: readEvidencePlanEnum(
      record,
      "executorType",
      ForbiddenEffectTypeValues,
      path,
      collector,
    ),
    targetEnvironment: readEvidencePlanEnum(
      record,
      "targetEnvironment",
      ForbiddenEffectEnvironmentValues,
      path,
      collector,
    ),
    requiredFixtures: readEvidencePlanStringArray(
      record,
      "requiredFixtures",
      path,
      collector,
    ),
    timeoutStrategy: validateEvidencePlanTimeoutStrategyShape(
      readEvidencePlanRecord(record, "timeoutStrategy", path, collector),
      evidencePlanChildPath(path, "timeoutStrategy"),
      collector,
    ),
    dangerousCapabilitiesToDeny: readEvidencePlanStringArray(
      record,
      "dangerousCapabilitiesToDeny",
      path,
      collector,
    ),
    probeTasks: readEvidencePlanObjectArray(
      record,
      "probeTasks",
      path,
      collector,
      validateNegativeProbeTaskShape,
    ),
  };

  if (plan.probeTasks.length === 0) {
    addEvidencePlanIssue(
      collector,
      evidencePlanChildPath(path, "probeTasks"),
      "empty_array",
      "Expected at least one probe task.",
    );
  }

  const executorId = readOptionalEvidencePlanString(
    record,
    "executorId",
    path,
    collector,
  );

  if (executorId !== undefined) {
    plan.executorId = executorId;
  }

  return plan;
};

const validateSideEffectProbePlanShape = (
  input: unknown,
  path: string,
  collector: EvidencePlanIssueCollector,
): SideEffectProbePlan => {
  if (!isEvidencePlanRecord(input)) {
    addEvidencePlanIssue(
      collector,
      path,
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;
  const plan: SideEffectProbePlan = {
    probePlanId: readEvidencePlanString(
      record,
      "probePlanId",
      path,
      collector,
    ),
    obligationIds: readEvidencePlanStringArray(
      record,
      "obligationIds",
      path,
      collector,
    ),
    executorType: readEvidencePlanEnum(
      record,
      "executorType",
      ForbiddenEffectTypeValues,
      path,
      collector,
    ),
    targetEnvironment: readEvidencePlanEnum(
      record,
      "targetEnvironment",
      ForbiddenEffectEnvironmentValues,
      path,
      collector,
    ),
    requiredFixtures: readEvidencePlanStringArray(
      record,
      "requiredFixtures",
      path,
      collector,
    ),
    timeoutStrategy: validateEvidencePlanTimeoutStrategyShape(
      readEvidencePlanRecord(record, "timeoutStrategy", path, collector),
      evidencePlanChildPath(path, "timeoutStrategy"),
      collector,
    ),
    predictedEffectTypes: readEvidencePlanStringArray(
      record,
      "predictedEffectTypes",
      path,
      collector,
    ),
    forbiddenEffectTypes: readEvidencePlanStringArray(
      record,
      "forbiddenEffectTypes",
      path,
      collector,
    ),
    snapshotTargets: readEvidencePlanStringArray(
      record,
      "snapshotTargets",
      path,
      collector,
    ),
  };

  const executorId = readOptionalEvidencePlanString(
    record,
    "executorId",
    path,
    collector,
  );

  if (executorId !== undefined) {
    plan.executorId = executorId;
  }

  return plan;
};

const validateEvidencePlanInternalReferences = (
  plan: EvidencePlan,
  collector: EvidencePlanIssueCollector,
) => {
  if (
    plan.negativeProbePlans.length === 0 &&
    plan.sideEffectProbePlans.length === 0
  ) {
    addEvidencePlanIssue(
      collector,
      "$",
      "missing_probe_plan",
      "Expected at least one negative or side-effect probe plan.",
    );
  }

  const planObligationIds = new Set(plan.obligationIds);
  const coveredObligationIds = new Set<ForbiddenEffectObligationId>();
  const checkProbePlan = (
    probePlan:
      | Pick<NegativeProbePlan, "obligationIds" | "executorType" | "targetEnvironment">
      | Pick<SideEffectProbePlan, "obligationIds" | "executorType" | "targetEnvironment">,
    path: string,
  ) => {
    if (probePlan.executorType !== plan.executorType) {
      addEvidencePlanIssue(
        collector,
        evidencePlanChildPath(path, "executorType"),
        "executor_type_mismatch",
        "Expected child probe plan executorType to match the evidence plan.",
      );
    }

    if (probePlan.targetEnvironment !== plan.targetEnvironment) {
      addEvidencePlanIssue(
        collector,
        evidencePlanChildPath(path, "targetEnvironment"),
        "target_environment_mismatch",
        "Expected child probe plan targetEnvironment to match the evidence plan.",
      );
    }

    probePlan.obligationIds.forEach((obligationId, index) => {
      if (!planObligationIds.has(obligationId)) {
        addEvidencePlanIssue(
          collector,
          `${path}.obligationIds[${index}]`,
          "unlinked_obligation",
          "Expected child probe plan obligationIds to be declared by the evidence plan.",
        );
        return;
      }

      coveredObligationIds.add(obligationId);
    });
  };

  plan.negativeProbePlans.forEach((probePlan, index) => {
    checkProbePlan(probePlan, `$.negativeProbePlans[${index}]`);
  });

  plan.sideEffectProbePlans.forEach((probePlan, index) => {
    checkProbePlan(probePlan, `$.sideEffectProbePlans[${index}]`);
  });

  plan.obligationIds.forEach((obligationId, index) => {
    if (!coveredObligationIds.has(obligationId)) {
      addEvidencePlanIssue(
        collector,
        `$.obligationIds[${index}]`,
        "uncovered_obligation",
        "Expected every evidence plan obligationId to be covered by a child probe plan.",
      );
    }
  });
};

const validateEvidencePlanShape = (
  input: unknown,
  collector: EvidencePlanIssueCollector,
): EvidencePlan => {
  if (!isEvidencePlanRecord(input)) {
    addEvidencePlanIssue(
      collector,
      "$",
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;
  const path = "$";
  const plan: EvidencePlan = {
    planId: readEvidencePlanString(record, "planId", path, collector),
    obligationIds: readEvidencePlanStringArray(
      record,
      "obligationIds",
      path,
      collector,
    ),
    executorType: readEvidencePlanEnum(
      record,
      "executorType",
      ForbiddenEffectTypeValues,
      path,
      collector,
    ),
    targetEnvironment: readEvidencePlanEnum(
      record,
      "targetEnvironment",
      ForbiddenEffectEnvironmentValues,
      path,
      collector,
    ),
    requiredFixtures: readEvidencePlanStringArray(
      record,
      "requiredFixtures",
      path,
      collector,
    ),
    timeoutStrategy: validateEvidencePlanTimeoutStrategyShape(
      readEvidencePlanRecord(record, "timeoutStrategy", path, collector),
      evidencePlanChildPath(path, "timeoutStrategy"),
      collector,
    ),
    negativeProbePlans: readEvidencePlanObjectArray(
      record,
      "negativeProbePlans",
      path,
      collector,
      validateNegativeProbePlanShape,
    ),
    sideEffectProbePlans: readEvidencePlanObjectArray(
      record,
      "sideEffectProbePlans",
      path,
      collector,
      validateSideEffectProbePlanShape,
    ),
  };

  const createdAt = readOptionalEvidencePlanString(
    record,
    "createdAt",
    path,
    collector,
  );

  if (createdAt !== undefined) {
    plan.createdAt = createdAt;
  }

  validateEvidencePlanInternalReferences(plan, collector);

  return plan;
};

const validateForbiddenEffectObligationShape = (
  input: unknown,
  collector: ForbiddenEffectObligationIssueCollector,
): ForbiddenEffectObligation => {
  if (!isForbiddenEffectObligationRecord(input)) {
    addForbiddenEffectObligationIssue(
      collector,
      "$",
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;
  const path = "$";
  const obligation: ForbiddenEffectObligation = {
    obligationId: readForbiddenEffectObligationString(
      record,
      "obligationId",
      path,
      collector,
    ),
    effectType: readForbiddenEffectObligationEnum(
      record,
      "effectType",
      ForbiddenEffectTypeValues,
      path,
      collector,
    ),
    resourceScope: readForbiddenEffectObligationStringArray(
      record,
      "resourceScope",
      path,
      collector,
    ),
    environment: readForbiddenEffectObligationEnum(
      record,
      "environment",
      ForbiddenEffectEnvironmentValues,
      path,
      collector,
    ),
    severity: readForbiddenEffectObligationEnum(
      record,
      "severity",
      ForbiddenEffectSeverityValues,
      path,
      collector,
    ),
    requiredEvidenceTypes: readForbiddenEffectObligationEnumArray(
      record,
      "requiredEvidenceTypes",
      ForbiddenEffectEvidenceTypeValues,
      path,
      collector,
    ),
    failClosedAction: readForbiddenEffectObligationEnum(
      record,
      "failClosedAction",
      ForbiddenEffectFailClosedActionValues,
      path,
      collector,
    ),
  };

  const requestHash = readOptionalForbiddenEffectObligationString(
    record,
    "requestHash",
    path,
    collector,
  );
  const requiredExecutionMode = readOptionalForbiddenEffectObligationString(
    record,
    "requiredExecutionMode",
    path,
    collector,
  );
  const executorType = readOptionalForbiddenEffectObligationEnum(
    record,
    "executorType",
    ForbiddenEffectTypeValues,
    path,
    collector,
  );
  const forbiddenCapabilities = readOptionalForbiddenEffectObligationStringArray(
    record,
    "forbiddenCapabilities",
    path,
    collector,
  );
  const forbiddenEffects = readOptionalForbiddenEffectObligationStringArray(
    record,
    "forbiddenEffects",
    path,
    collector,
  );
  const createdAt = readOptionalForbiddenEffectObligationString(
    record,
    "createdAt",
    path,
    collector,
  );

  if (requestHash !== undefined) {
    obligation.requestHash = requestHash;
  }

  if (requiredExecutionMode !== undefined) {
    obligation.requiredExecutionMode = requiredExecutionMode;
  }

  if (executorType !== undefined) {
    obligation.executorType = executorType;
  }

  if (forbiddenCapabilities !== undefined) {
    obligation.forbiddenCapabilities = forbiddenCapabilities;
  }

  if (forbiddenEffects !== undefined) {
    obligation.forbiddenEffects = forbiddenEffects;
  }

  if (createdAt !== undefined) {
    obligation.createdAt = createdAt;
  }

  return obligation;
};

export const validateForbiddenEffectObligation = (
  input: unknown,
): ForbiddenEffectObligationValidationResult => {
  const collector: ForbiddenEffectObligationIssueCollector = { issues: [] };
  const data = validateForbiddenEffectObligationShape(input, collector);

  if (collector.issues.length > 0) {
    return { success: false, issues: collector.issues };
  }

  return { success: true, data };
};

export const ForbiddenEffectObligationSchema = {
  parse(input: unknown): ForbiddenEffectObligation {
    const result = validateForbiddenEffectObligation(input);

    if (!result.success) {
      throw new ForbiddenEffectObligationValidationError(result.issues);
    }

    return result.data;
  },
  safeParse(input: unknown): ForbiddenEffectObligationValidationResult {
    return validateForbiddenEffectObligation(input);
  },
};

export const isForbiddenEffectObligation = (
  input: unknown,
): input is ForbiddenEffectObligation =>
  validateForbiddenEffectObligation(input).success;

export const validateNegativeProbePlan = (
  input: unknown,
): NegativeProbePlanValidationResult => {
  const collector: EvidencePlanIssueCollector = { issues: [] };
  const data = validateNegativeProbePlanShape(input, "$", collector);

  if (collector.issues.length > 0) {
    return { success: false, issues: collector.issues };
  }

  return { success: true, data };
};

export const NegativeProbePlanSchema = {
  parse(input: unknown): NegativeProbePlan {
    const result = validateNegativeProbePlan(input);

    if (!result.success) {
      throw new NegativeProbePlanValidationError(result.issues);
    }

    return result.data;
  },
  safeParse(input: unknown): NegativeProbePlanValidationResult {
    return validateNegativeProbePlan(input);
  },
};

export const isNegativeProbePlan = (
  input: unknown,
): input is NegativeProbePlan => validateNegativeProbePlan(input).success;

export const validateSideEffectProbePlan = (
  input: unknown,
): SideEffectProbePlanValidationResult => {
  const collector: EvidencePlanIssueCollector = { issues: [] };
  const data = validateSideEffectProbePlanShape(input, "$", collector);

  if (collector.issues.length > 0) {
    return { success: false, issues: collector.issues };
  }

  return { success: true, data };
};

export const SideEffectProbePlanSchema = {
  parse(input: unknown): SideEffectProbePlan {
    const result = validateSideEffectProbePlan(input);

    if (!result.success) {
      throw new SideEffectProbePlanValidationError(result.issues);
    }

    return result.data;
  },
  safeParse(input: unknown): SideEffectProbePlanValidationResult {
    return validateSideEffectProbePlan(input);
  },
};

export const isSideEffectProbePlan = (
  input: unknown,
): input is SideEffectProbePlan =>
  validateSideEffectProbePlan(input).success;

export const validateEvidencePlan = (
  input: unknown,
): EvidencePlanValidationResult => {
  const collector: EvidencePlanIssueCollector = { issues: [] };
  const data = validateEvidencePlanShape(input, collector);

  if (collector.issues.length > 0) {
    return { success: false, issues: collector.issues };
  }

  return { success: true, data };
};

export const EvidencePlanSchema = {
  parse(input: unknown): EvidencePlan {
    const result = validateEvidencePlan(input);

    if (!result.success) {
      throw new EvidencePlanValidationError(result.issues);
    }

    return result.data;
  },
  safeParse(input: unknown): EvidencePlanValidationResult {
    return validateEvidencePlan(input);
  },
};

export const isEvidencePlan = (input: unknown): input is EvidencePlan =>
  validateEvidencePlan(input).success;

export const validateEvidencePlanObligationReferences = (
  planInput: unknown,
  obligationsInput: readonly ForbiddenEffectObligation[],
): EvidencePlanObligationReferenceValidationResult => {
  const result = validateEvidencePlan(planInput);

  if (!result.success) {
    return result;
  }

  const collector: EvidencePlanIssueCollector = { issues: [] };
  const obligationIds = new Set(
    obligationsInput.map((obligation) => obligation.obligationId),
  );

  result.data.obligationIds.forEach((obligationId, index) => {
    if (!obligationIds.has(obligationId)) {
      addEvidencePlanIssue(
        collector,
        `$.obligationIds[${index}]`,
        "unknown_obligation",
        "Expected every evidence plan obligationId to reference a supplied obligation.",
      );
    }
  });

  if (collector.issues.length > 0) {
    return { success: false, issues: collector.issues };
  }

  return { success: true, data: result.data };
};

export const ForbiddenSideEffectDomain = {
  name: ForbiddenSideEffectDomainName,
  stateMachine: "executor-safety-evidence",
  obligation: "ForbiddenEffectObligation",
  evidencePlan: "EvidencePlan",
  evidence: ["DeniedCapabilityEvidence", "SideEffectDeltaEvidence"],
  permitExit: "PermitBinding",
} as const;
