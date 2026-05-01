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

type ForbiddenEffectObligationIssueCollector = {
  issues: ForbiddenEffectObligationValidationIssue[];
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

export const ForbiddenSideEffectDomain = {
  name: ForbiddenSideEffectDomainName,
  stateMachine: "executor-safety-evidence",
  obligation: "ForbiddenEffectObligation",
  evidence: ["DeniedCapabilityEvidence", "SideEffectDeltaEvidence"],
  permitExit: "PermitBinding",
} as const;
