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

export const DeniedCapabilityProbeOutcome = {
  Rejected: "rejected",
  UnexpectedlyAllowed: "unexpectedlyAllowed",
  Skipped: "skipped",
  Errored: "errored",
} as const;

export type DeniedCapabilityProbeOutcome =
  (typeof DeniedCapabilityProbeOutcome)[keyof typeof DeniedCapabilityProbeOutcome];

export const DeniedCapabilityProbeOutcomeValues = Object.values(
  DeniedCapabilityProbeOutcome,
) as DeniedCapabilityProbeOutcome[];

export const SideEffectEvidenceType = {
  Database: "database",
  Webhook: "webhook",
  Artifact: "artifact",
  Trigger: "trigger",
  AsyncJob: "async_job",
  ConfigVersion: "config_version",
} as const;

export type SideEffectEvidenceType =
  (typeof SideEffectEvidenceType)[keyof typeof SideEffectEvidenceType];

export const SideEffectEvidenceTypeValues = Object.values(
  SideEffectEvidenceType,
) as SideEffectEvidenceType[];

export const EvidenceCoverageStatus = {
  Covered: "covered",
  Missing: "missing",
  Stale: "stale",
  Invalidated: "invalidated",
  Failed: "failed",
  NotApplicable: "notApplicable",
} as const;

export type EvidenceCoverageStatus =
  (typeof EvidenceCoverageStatus)[keyof typeof EvidenceCoverageStatus];

export const EvidenceCoverageStatusValues = Object.values(
  EvidenceCoverageStatus,
) as EvidenceCoverageStatus[];

export const ExecutorDriftFingerprintField = {
  Credential: "credential",
  NetworkPolicy: "networkPolicy",
  RunnerImage: "runnerImage",
  Endpoint: "endpoint",
  Namespace: "namespace",
  ConfigHash: "configHash",
} as const;

export type ExecutorDriftFingerprintField =
  (typeof ExecutorDriftFingerprintField)[keyof typeof ExecutorDriftFingerprintField];

export const ExecutorDriftFingerprintFieldValues = Object.values(
  ExecutorDriftFingerprintField,
) as ExecutorDriftFingerprintField[];

export const ExecutorSafetyEvidenceStateName = {
  EvidenceMissing: "EvidenceMissing",
  EvidencePartial: "EvidencePartial",
  EvidenceComplete: "EvidenceComplete",
  EvidenceExpired: "EvidenceExpired",
  EvidenceInvalidated: "EvidenceInvalidated",
  EvidenceFailed: "EvidenceFailed",
} as const;

export type ExecutorSafetyEvidenceStateName =
  (typeof ExecutorSafetyEvidenceStateName)[keyof typeof ExecutorSafetyEvidenceStateName];

export const ExecutorSafetyEvidenceStateNameValues = Object.values(
  ExecutorSafetyEvidenceStateName,
) as ExecutorSafetyEvidenceStateName[];

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

export type DeniedCapabilityEvidence = {
  probeId: NegativeProbePlanId;
  obligationId: ForbiddenEffectObligationId;
  attemptedOperation: string;
  observedRejection: DeniedCapabilityProbeOutcome;
  rejectionReason: string;
  executorFingerprint: ExecutorDriftFingerprintHash;
  completedAt: ForbiddenSideEffectTimestamp;
};

export type SideEffectObservedEvent = {
  evidenceType: SideEffectEvidenceType;
  target: string;
  eventHash: PatentProofHash;
  observedAt?: ForbiddenSideEffectTimestamp;
};

export type SideEffectDeltaChange = {
  evidenceType: SideEffectEvidenceType;
  target: string;
  beforeHash: PatentProofHash;
  afterHash: PatentProofHash;
  changeType: string;
};

export type SideEffectDeltaEvidence = {
  probeId: SideEffectProbePlanId;
  obligationId: ForbiddenEffectObligationId;
  executorId: string;
  beforeSnapshotHash: PatentProofHash;
  afterSnapshotHash: PatentProofHash;
  observedEvents: readonly SideEffectObservedEvent[];
  forbiddenEffectsObserved: readonly SideEffectObservedEvent[];
  effectDelta: readonly SideEffectDeltaChange[];
  completedAt: ForbiddenSideEffectTimestamp;
  executorFingerprint?: ExecutorDriftFingerprintHash;
};

export type ExecutorDriftFingerprint = {
  fingerprintHash: ExecutorDriftFingerprintHash;
  credential: PatentProofHash;
  networkPolicy: PatentProofHash;
  runnerImage: PatentProofHash;
  endpoint: PatentProofHash;
  namespace: PatentProofHash;
  configHash: PatentProofHash;
  capturedAt?: ForbiddenSideEffectTimestamp;
};

export type DriftEvent = {
  previous: ExecutorDriftFingerprint;
  current: ExecutorDriftFingerprint;
  eventId?: StateMachineEntityId;
  detectedAt?: ForbiddenSideEffectTimestamp;
};

export type EvidenceCoverageRecord = {
  obligationId: ForbiddenEffectObligationId;
  requiredEvidenceType?: ForbiddenEffectEvidenceType;
  evidenceType?: ForbiddenEffectEvidenceType;
  evidenceHash: PatentProofHash;
  status?: EvidenceCoverageStatus;
  completedAt?: ForbiddenSideEffectTimestamp;
  expiresAt?: ForbiddenSideEffectTimestamp;
  invalidatedAt?: ForbiddenSideEffectTimestamp;
  failureReason?: string;
  evidence?: DeniedCapabilityEvidence | SideEffectDeltaEvidence;
};

export type EvidenceCoverageEntry = {
  obligationId: ForbiddenEffectObligationId;
  requiredEvidenceType: ForbiddenEffectEvidenceType;
  status: EvidenceCoverageStatus;
  covered: boolean;
  evidenceHashes: readonly PatentProofHash[];
  reason: string;
  evaluatedAt: ForbiddenSideEffectTimestamp;
  completedAt?: ForbiddenSideEffectTimestamp;
  expiresAt?: ForbiddenSideEffectTimestamp;
  invalidatedAt?: ForbiddenSideEffectTimestamp;
};

export type EvidenceCoverageObligation = {
  obligationId: ForbiddenEffectObligationId;
  status: EvidenceCoverageStatus;
  covered: boolean;
  requiredEvidence: readonly EvidenceCoverageEntry[];
};

export type EvidenceCoverageMap = {
  coverageMapId: EvidenceCoverageMapId;
  executorId: string;
  evaluatedAt: ForbiddenSideEffectTimestamp;
  coverage: readonly EvidenceCoverageEntry[];
  obligations: readonly EvidenceCoverageObligation[];
  allObligationsCovered: boolean;
};

export type EvidenceCoverageEvaluationOptions = {
  coverageMapId?: EvidenceCoverageMapId;
  executorId?: string;
  evaluatedAt?: ForbiddenSideEffectTimestamp;
};

export type ExecutorSafetyEvidenceState = {
  stateId: ExecutorSafetyEvidenceStateId;
  executorId: string;
  coverageMapId: EvidenceCoverageMapId;
  state: ExecutorSafetyEvidenceStateName;
  allObligationsCovered: boolean;
  evaluatedAt: ForbiddenSideEffectTimestamp;
  coveredObligationIds: readonly ForbiddenEffectObligationId[];
  blockedObligationIds: readonly ForbiddenEffectObligationId[];
  blockingStatuses: readonly EvidenceCoverageStatus[];
  transitionReason: string;
  validUntil?: ForbiddenSideEffectTimestamp;
  invalidatedBy?: string;
  coverageMapHash?: PatentProofHash;
  safetyEvidenceVersion?: string;
};

export type ExecutorSafetyEvidenceStateEvaluationOptions = {
  stateId?: ExecutorSafetyEvidenceStateId;
  coverageMapHash?: PatentProofHash;
  safetyEvidenceVersion?: string;
  evaluatedAt?: ForbiddenSideEffectTimestamp;
  evidenceTtlMs?: number;
  invalidatedBy?: string;
};

export type ExecutorDriftFingerprintComparison = {
  hasDrift: boolean;
  changedFields: readonly ExecutorDriftFingerprintField[];
  previousFingerprintHash: ExecutorDriftFingerprintHash;
  currentFingerprintHash: ExecutorDriftFingerprintHash;
  affectedEvidenceHashes: readonly PatentProofHash[];
  affectedEvidenceTypes: readonly ForbiddenEffectEvidenceType[];
  affectedObligationIds: readonly ForbiddenEffectObligationId[];
  affectedEvidenceRecords: readonly EvidenceCoverageRecord[];
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

export type DeniedCapabilityEvidenceValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type DeniedCapabilityEvidenceValidationSuccess = {
  success: true;
  data: DeniedCapabilityEvidence;
};

export type DeniedCapabilityEvidenceValidationFailure = {
  success: false;
  issues: DeniedCapabilityEvidenceValidationIssue[];
};

export type DeniedCapabilityEvidenceValidationResult =
  | DeniedCapabilityEvidenceValidationSuccess
  | DeniedCapabilityEvidenceValidationFailure;

export type SideEffectDeltaEvidenceValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type SideEffectDeltaEvidenceValidationSuccess = {
  success: true;
  data: SideEffectDeltaEvidence;
};

export type SideEffectDeltaEvidenceValidationFailure = {
  success: false;
  issues: SideEffectDeltaEvidenceValidationIssue[];
};

export type SideEffectDeltaEvidenceValidationResult =
  | SideEffectDeltaEvidenceValidationSuccess
  | SideEffectDeltaEvidenceValidationFailure;

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

type DeniedCapabilityEvidenceIssueCollector = {
  issues: DeniedCapabilityEvidenceValidationIssue[];
};

type SideEffectDeltaEvidenceIssueCollector = {
  issues: SideEffectDeltaEvidenceValidationIssue[];
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

export class DeniedCapabilityEvidenceValidationError extends Error {
  readonly issues: DeniedCapabilityEvidenceValidationIssue[];

  constructor(issues: DeniedCapabilityEvidenceValidationIssue[]) {
    super("DeniedCapabilityEvidence validation failed");
    this.name = "DeniedCapabilityEvidenceValidationError";
    this.issues = issues;
  }
}

export class SideEffectDeltaEvidenceValidationError extends Error {
  readonly issues: SideEffectDeltaEvidenceValidationIssue[];

  constructor(issues: SideEffectDeltaEvidenceValidationIssue[]) {
    super("SideEffectDeltaEvidence validation failed");
    this.name = "SideEffectDeltaEvidenceValidationError";
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

const addDeniedCapabilityEvidenceIssue = (
  collector: DeniedCapabilityEvidenceIssueCollector,
  path: string,
  code: string,
  message: string,
) => {
  collector.issues.push({ path, code, message });
};

const deniedCapabilityEvidenceChildPath = (path: string, key: string) =>
  `${path}.${key}`;

const isDeniedCapabilityEvidenceRecord = (
  input: unknown,
): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const readDeniedCapabilityEvidenceString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: DeniedCapabilityEvidenceIssueCollector,
): string => {
  const value = input[key];

  if (typeof value !== "string" || value.length === 0) {
    addDeniedCapabilityEvidenceIssue(
      collector,
      deniedCapabilityEvidenceChildPath(path, key),
      "invalid_string",
      "Expected a non-empty string.",
    );
    return "";
  }

  return value;
};

const readDeniedCapabilityEvidenceEnum = <TValue extends string>(
  input: Record<string, unknown>,
  key: string,
  values: StringEnumValues<TValue>,
  path: string,
  collector: DeniedCapabilityEvidenceIssueCollector,
): TValue => {
  const value = input[key];

  if (typeof value !== "string" || !values.includes(value as TValue)) {
    addDeniedCapabilityEvidenceIssue(
      collector,
      deniedCapabilityEvidenceChildPath(path, key),
      "invalid_enum",
      `Expected one of: ${values.join(", ")}.`,
    );
    return values[0] ?? ("" as TValue);
  }

  return value as TValue;
};

const addSideEffectDeltaEvidenceIssue = (
  collector: SideEffectDeltaEvidenceIssueCollector,
  path: string,
  code: string,
  message: string,
) => {
  collector.issues.push({ path, code, message });
};

const sideEffectDeltaEvidenceChildPath = (path: string, key: string) =>
  `${path}.${key}`;

const isSideEffectDeltaEvidenceRecord = (
  input: unknown,
): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const readSideEffectDeltaEvidenceString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: SideEffectDeltaEvidenceIssueCollector,
): string => {
  const value = input[key];

  if (typeof value !== "string" || value.length === 0) {
    addSideEffectDeltaEvidenceIssue(
      collector,
      sideEffectDeltaEvidenceChildPath(path, key),
      "invalid_string",
      "Expected a non-empty string.",
    );
    return "";
  }

  return value;
};

const readOptionalSideEffectDeltaEvidenceString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: SideEffectDeltaEvidenceIssueCollector,
): string | undefined => {
  const value = input[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.length === 0) {
    addSideEffectDeltaEvidenceIssue(
      collector,
      sideEffectDeltaEvidenceChildPath(path, key),
      "invalid_string",
      "Expected a non-empty string when provided.",
    );
    return undefined;
  }

  return value;
};

const readSideEffectDeltaEvidenceEnum = <TValue extends string>(
  input: Record<string, unknown>,
  key: string,
  values: StringEnumValues<TValue>,
  path: string,
  collector: SideEffectDeltaEvidenceIssueCollector,
): TValue => {
  const value = input[key];

  if (typeof value !== "string" || !values.includes(value as TValue)) {
    addSideEffectDeltaEvidenceIssue(
      collector,
      sideEffectDeltaEvidenceChildPath(path, key),
      "invalid_enum",
      `Expected one of: ${values.join(", ")}.`,
    );
    return values[0] ?? ("" as TValue);
  }

  return value as TValue;
};

const readSideEffectDeltaEvidenceObjectArray = <TValue>(
  input: Record<string, unknown>,
  key: string,
  path: string,
  collector: SideEffectDeltaEvidenceIssueCollector,
  readItem: (
    item: unknown,
    itemPath: string,
    itemCollector: SideEffectDeltaEvidenceIssueCollector,
  ) => TValue,
): TValue[] => {
  const value = input[key];
  const issuePath = sideEffectDeltaEvidenceChildPath(path, key);

  if (!Array.isArray(value)) {
    addSideEffectDeltaEvidenceIssue(
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

const validateSideEffectObservedEventShape = (
  input: unknown,
  path: string,
  collector: SideEffectDeltaEvidenceIssueCollector,
): SideEffectObservedEvent => {
  if (!isSideEffectDeltaEvidenceRecord(input)) {
    addSideEffectDeltaEvidenceIssue(
      collector,
      path,
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;
  const event: SideEffectObservedEvent = {
    evidenceType: readSideEffectDeltaEvidenceEnum(
      record,
      "evidenceType",
      SideEffectEvidenceTypeValues,
      path,
      collector,
    ),
    target: readSideEffectDeltaEvidenceString(
      record,
      "target",
      path,
      collector,
    ),
    eventHash: readSideEffectDeltaEvidenceString(
      record,
      "eventHash",
      path,
      collector,
    ),
  };

  const observedAt = readOptionalSideEffectDeltaEvidenceString(
    record,
    "observedAt",
    path,
    collector,
  );

  if (observedAt !== undefined) {
    event.observedAt = observedAt;
  }

  return event;
};

const validateSideEffectDeltaChangeShape = (
  input: unknown,
  path: string,
  collector: SideEffectDeltaEvidenceIssueCollector,
): SideEffectDeltaChange => {
  if (!isSideEffectDeltaEvidenceRecord(input)) {
    addSideEffectDeltaEvidenceIssue(
      collector,
      path,
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;

  return {
    evidenceType: readSideEffectDeltaEvidenceEnum(
      record,
      "evidenceType",
      SideEffectEvidenceTypeValues,
      path,
      collector,
    ),
    target: readSideEffectDeltaEvidenceString(
      record,
      "target",
      path,
      collector,
    ),
    beforeHash: readSideEffectDeltaEvidenceString(
      record,
      "beforeHash",
      path,
      collector,
    ),
    afterHash: readSideEffectDeltaEvidenceString(
      record,
      "afterHash",
      path,
      collector,
    ),
    changeType: readSideEffectDeltaEvidenceString(
      record,
      "changeType",
      path,
      collector,
    ),
  };
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

const validateDeniedCapabilityEvidenceShape = (
  input: unknown,
  collector: DeniedCapabilityEvidenceIssueCollector,
): DeniedCapabilityEvidence => {
  if (!isDeniedCapabilityEvidenceRecord(input)) {
    addDeniedCapabilityEvidenceIssue(
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
    probeId: readDeniedCapabilityEvidenceString(
      record,
      "probeId",
      path,
      collector,
    ),
    obligationId: readDeniedCapabilityEvidenceString(
      record,
      "obligationId",
      path,
      collector,
    ),
    attemptedOperation: readDeniedCapabilityEvidenceString(
      record,
      "attemptedOperation",
      path,
      collector,
    ),
    observedRejection: readDeniedCapabilityEvidenceEnum(
      record,
      "observedRejection",
      DeniedCapabilityProbeOutcomeValues,
      path,
      collector,
    ),
    rejectionReason: readDeniedCapabilityEvidenceString(
      record,
      "rejectionReason",
      path,
      collector,
    ),
    executorFingerprint: readDeniedCapabilityEvidenceString(
      record,
      "executorFingerprint",
      path,
      collector,
    ),
    completedAt: readDeniedCapabilityEvidenceString(
      record,
      "completedAt",
      path,
      collector,
    ),
  };
};

const validateSideEffectDeltaEvidenceShape = (
  input: unknown,
  collector: SideEffectDeltaEvidenceIssueCollector,
): SideEffectDeltaEvidence => {
  if (!isSideEffectDeltaEvidenceRecord(input)) {
    addSideEffectDeltaEvidenceIssue(
      collector,
      "$",
      "invalid_object",
      "Expected an object.",
    );
    input = {};
  }

  const record = input as Record<string, unknown>;
  const path = "$";
  const evidence: SideEffectDeltaEvidence = {
    probeId: readSideEffectDeltaEvidenceString(
      record,
      "probeId",
      path,
      collector,
    ),
    obligationId: readSideEffectDeltaEvidenceString(
      record,
      "obligationId",
      path,
      collector,
    ),
    executorId: readSideEffectDeltaEvidenceString(
      record,
      "executorId",
      path,
      collector,
    ),
    beforeSnapshotHash: readSideEffectDeltaEvidenceString(
      record,
      "beforeSnapshotHash",
      path,
      collector,
    ),
    afterSnapshotHash: readSideEffectDeltaEvidenceString(
      record,
      "afterSnapshotHash",
      path,
      collector,
    ),
    observedEvents: readSideEffectDeltaEvidenceObjectArray(
      record,
      "observedEvents",
      path,
      collector,
      validateSideEffectObservedEventShape,
    ),
    forbiddenEffectsObserved: readSideEffectDeltaEvidenceObjectArray(
      record,
      "forbiddenEffectsObserved",
      path,
      collector,
      validateSideEffectObservedEventShape,
    ),
    effectDelta: readSideEffectDeltaEvidenceObjectArray(
      record,
      "effectDelta",
      path,
      collector,
      validateSideEffectDeltaChangeShape,
    ),
    completedAt: readSideEffectDeltaEvidenceString(
      record,
      "completedAt",
      path,
      collector,
    ),
  };

  const executorFingerprint = readOptionalSideEffectDeltaEvidenceString(
    record,
    "executorFingerprint",
    path,
    collector,
  );

  if (executorFingerprint !== undefined) {
    evidence.executorFingerprint = executorFingerprint;
  }

  return evidence;
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

export const validateDeniedCapabilityEvidence = (
  input: unknown,
): DeniedCapabilityEvidenceValidationResult => {
  const collector: DeniedCapabilityEvidenceIssueCollector = { issues: [] };
  const data = validateDeniedCapabilityEvidenceShape(input, collector);

  if (collector.issues.length > 0) {
    return { success: false, issues: collector.issues };
  }

  return { success: true, data };
};

export const DeniedCapabilityEvidenceSchema = {
  parse(input: unknown): DeniedCapabilityEvidence {
    const result = validateDeniedCapabilityEvidence(input);

    if (!result.success) {
      throw new DeniedCapabilityEvidenceValidationError(result.issues);
    }

    return result.data;
  },
  safeParse(input: unknown): DeniedCapabilityEvidenceValidationResult {
    return validateDeniedCapabilityEvidence(input);
  },
};

export const isDeniedCapabilityEvidence = (
  input: unknown,
): input is DeniedCapabilityEvidence =>
  validateDeniedCapabilityEvidence(input).success;

export const validateSideEffectDeltaEvidence = (
  input: unknown,
): SideEffectDeltaEvidenceValidationResult => {
  const collector: SideEffectDeltaEvidenceIssueCollector = { issues: [] };
  const data = validateSideEffectDeltaEvidenceShape(input, collector);

  if (collector.issues.length > 0) {
    return { success: false, issues: collector.issues };
  }

  return { success: true, data };
};

export const SideEffectDeltaEvidenceSchema = {
  parse(input: unknown): SideEffectDeltaEvidence {
    const result = validateSideEffectDeltaEvidence(input);

    if (!result.success) {
      throw new SideEffectDeltaEvidenceValidationError(result.issues);
    }

    return result.data;
  },
  safeParse(input: unknown): SideEffectDeltaEvidenceValidationResult {
    return validateSideEffectDeltaEvidence(input);
  },
};

export const isSideEffectDeltaEvidence = (
  input: unknown,
): input is SideEffectDeltaEvidence =>
  validateSideEffectDeltaEvidence(input).success;

const evidenceCoverageMapDefaultEvaluatedAt = "1970-01-01T00:00:00.000Z";

const isCoverageStatusFailClosed = (status: EvidenceCoverageStatus): boolean =>
  status !== EvidenceCoverageStatus.Covered;

const isTimestampAtOrBefore = (
  timestamp: string | undefined,
  evaluatedAt: string,
): boolean => timestamp !== undefined && timestamp <= evaluatedAt;

const getEvidenceCoverageRecordType = (
  record: EvidenceCoverageRecord,
): ForbiddenEffectEvidenceType | undefined =>
  record.requiredEvidenceType ?? record.evidenceType;

type ExecutorDriftFingerprintFieldDescriptor = {
  field: ExecutorDriftFingerprintField;
  key: keyof Pick<
    ExecutorDriftFingerprint,
    | "credential"
    | "networkPolicy"
    | "runnerImage"
    | "endpoint"
    | "namespace"
    | "configHash"
  >;
};

const executorDriftFingerprintFieldDescriptors: readonly ExecutorDriftFingerprintFieldDescriptor[] =
  [
    {
      field: ExecutorDriftFingerprintField.Credential,
      key: "credential",
    },
    {
      field: ExecutorDriftFingerprintField.NetworkPolicy,
      key: "networkPolicy",
    },
    {
      field: ExecutorDriftFingerprintField.RunnerImage,
      key: "runnerImage",
    },
    {
      field: ExecutorDriftFingerprintField.Endpoint,
      key: "endpoint",
    },
    {
      field: ExecutorDriftFingerprintField.Namespace,
      key: "namespace",
    },
    {
      field: ExecutorDriftFingerprintField.ConfigHash,
      key: "configHash",
    },
  ];

const compareEvidenceCoverageRecords = (
  left: EvidenceCoverageRecord,
  right: EvidenceCoverageRecord,
): number => {
  const leftKey = `${left.obligationId}:${getEvidenceCoverageRecordType(left) ?? ""}:${left.evidenceHash}`;
  const rightKey = `${right.obligationId}:${getEvidenceCoverageRecordType(right) ?? ""}:${right.evidenceHash}`;

  return leftKey.localeCompare(rightKey);
};

const getEvidenceRecordExecutorFingerprint = (
  record: EvidenceCoverageRecord,
): ExecutorDriftFingerprintHash | undefined => record.evidence?.executorFingerprint;

const getChangedExecutorDriftFingerprintFields = (
  previous: ExecutorDriftFingerprint,
  current: ExecutorDriftFingerprint,
): readonly ExecutorDriftFingerprintField[] =>
  executorDriftFingerprintFieldDescriptors
    .filter(({ key }) => previous[key] !== current[key])
    .map(({ field }) => field);

export const compareExecutorDriftFingerprints = (
  driftEvent: Pick<DriftEvent, "previous" | "current">,
  evidenceRecordsInput: readonly EvidenceCoverageRecord[] = [],
): ExecutorDriftFingerprintComparison => {
  const changedFields = getChangedExecutorDriftFingerprintFields(
    driftEvent.previous,
    driftEvent.current,
  );
  const hasDrift = changedFields.length > 0;
  const affectedEvidenceRecords = hasDrift
    ? evidenceRecordsInput
        .filter(
          (record) =>
            getEvidenceRecordExecutorFingerprint(record) ===
            driftEvent.previous.fingerprintHash,
        )
        .sort(compareEvidenceCoverageRecords)
    : [];
  const affectedEvidenceTypes = Array.from(
    new Set(
      affectedEvidenceRecords.flatMap((record) => {
        const evidenceType = getEvidenceCoverageRecordType(record);

        return evidenceType === undefined ? [] : [evidenceType];
      }),
    ),
  ).sort();

  return {
    hasDrift,
    changedFields,
    previousFingerprintHash: driftEvent.previous.fingerprintHash,
    currentFingerprintHash: driftEvent.current.fingerprintHash,
    affectedEvidenceHashes: Array.from(
      new Set(affectedEvidenceRecords.map((record) => record.evidenceHash)),
    ).sort(),
    affectedEvidenceTypes,
    affectedObligationIds: Array.from(
      new Set(affectedEvidenceRecords.map((record) => record.obligationId)),
    ).sort(),
    affectedEvidenceRecords,
  };
};

const getEvidenceCoverageRecordCompletedAt = (
  record: EvidenceCoverageRecord,
): ForbiddenSideEffectTimestamp | undefined => {
  if (record.completedAt !== undefined) {
    return record.completedAt;
  }

  return record.evidence?.completedAt;
};

const inferEvidenceCoverageRecordStatus = (
  record: EvidenceCoverageRecord,
  evaluatedAt: ForbiddenSideEffectTimestamp,
): EvidenceCoverageStatus => {
  if (isTimestampAtOrBefore(record.invalidatedAt, evaluatedAt)) {
    return EvidenceCoverageStatus.Invalidated;
  }

  if (record.status !== undefined) {
    if (
      record.status === EvidenceCoverageStatus.Covered &&
      isTimestampAtOrBefore(record.expiresAt, evaluatedAt)
    ) {
      return EvidenceCoverageStatus.Stale;
    }

    return record.status;
  }

  if (isTimestampAtOrBefore(record.expiresAt, evaluatedAt)) {
    return EvidenceCoverageStatus.Stale;
  }

  const evidence = record.evidence;

  if (evidence !== undefined && "observedRejection" in evidence) {
    if (evidence.observedRejection === DeniedCapabilityProbeOutcome.Rejected) {
      return EvidenceCoverageStatus.Covered;
    }

    if (evidence.observedRejection === DeniedCapabilityProbeOutcome.Skipped) {
      return EvidenceCoverageStatus.NotApplicable;
    }

    return EvidenceCoverageStatus.Failed;
  }

  if (evidence !== undefined && "forbiddenEffectsObserved" in evidence) {
    return evidence.forbiddenEffectsObserved.length === 0
      ? EvidenceCoverageStatus.Covered
      : EvidenceCoverageStatus.Failed;
  }

  return EvidenceCoverageStatus.Covered;
};

const selectEvidenceCoverageStatus = (
  records: readonly EvidenceCoverageRecord[],
  evaluatedAt: ForbiddenSideEffectTimestamp,
): EvidenceCoverageStatus => {
  if (records.length === 0) {
    return EvidenceCoverageStatus.Missing;
  }

  const statuses = new Set(
    records.map((record) =>
      inferEvidenceCoverageRecordStatus(record, evaluatedAt),
    ),
  );

  if (statuses.has(EvidenceCoverageStatus.Failed)) {
    return EvidenceCoverageStatus.Failed;
  }

  if (statuses.has(EvidenceCoverageStatus.Covered)) {
    return EvidenceCoverageStatus.Covered;
  }

  if (statuses.has(EvidenceCoverageStatus.Invalidated)) {
    return EvidenceCoverageStatus.Invalidated;
  }

  if (statuses.has(EvidenceCoverageStatus.Stale)) {
    return EvidenceCoverageStatus.Stale;
  }

  if (statuses.has(EvidenceCoverageStatus.NotApplicable)) {
    return EvidenceCoverageStatus.NotApplicable;
  }

  return EvidenceCoverageStatus.Missing;
};

const getEvidenceCoverageReason = (
  status: EvidenceCoverageStatus,
): string => {
  switch (status) {
    case EvidenceCoverageStatus.Covered:
      return "required evidence is covered by valid evidence records";
    case EvidenceCoverageStatus.Missing:
      return "required evidence is missing";
    case EvidenceCoverageStatus.Stale:
      return "required evidence is stale";
    case EvidenceCoverageStatus.Invalidated:
      return "required evidence was invalidated";
    case EvidenceCoverageStatus.Failed:
      return "required evidence reported a failed safety proof";
    case EvidenceCoverageStatus.NotApplicable:
      return "required evidence was marked not applicable";
  }
};

const selectEvidenceCoverageObligationStatus = (
  entries: readonly EvidenceCoverageEntry[],
): EvidenceCoverageStatus => {
  if (entries.length === 0) {
    return EvidenceCoverageStatus.NotApplicable;
  }

  if (
    entries.every((entry) => entry.status === EvidenceCoverageStatus.Covered)
  ) {
    return EvidenceCoverageStatus.Covered;
  }

  if (entries.some((entry) => entry.status === EvidenceCoverageStatus.Failed)) {
    return EvidenceCoverageStatus.Failed;
  }

  if (
    entries.some((entry) => entry.status === EvidenceCoverageStatus.Invalidated)
  ) {
    return EvidenceCoverageStatus.Invalidated;
  }

  if (entries.some((entry) => entry.status === EvidenceCoverageStatus.Stale)) {
    return EvidenceCoverageStatus.Stale;
  }

  if (entries.some((entry) => entry.status === EvidenceCoverageStatus.Missing)) {
    return EvidenceCoverageStatus.Missing;
  }

  return EvidenceCoverageStatus.NotApplicable;
};

const getLatestDefinedTimestamp = (
  timestamps: readonly (ForbiddenSideEffectTimestamp | undefined)[],
): ForbiddenSideEffectTimestamp | undefined => {
  const definedTimestamps = timestamps.filter(
    (timestamp): timestamp is ForbiddenSideEffectTimestamp =>
      timestamp !== undefined,
  );

  if (definedTimestamps.length === 0) {
    return undefined;
  }

  return definedTimestamps.sort().at(-1);
};

const getEvidenceCoverageMapId = (
  obligations: readonly ForbiddenEffectObligation[],
  executorId: string,
  evaluatedAt: ForbiddenSideEffectTimestamp,
): EvidenceCoverageMapId => {
  const obligationKey = obligations
    .map((obligation) => obligation.obligationId)
    .sort()
    .join("+");

  return `coverage-map:${executorId}:${evaluatedAt}:${obligationKey}`;
};

export const evaluateEvidenceCoverageMap = (
  obligationsInput: readonly ForbiddenEffectObligation[],
  evidenceRecordsInput: readonly EvidenceCoverageRecord[],
  options: EvidenceCoverageEvaluationOptions = {},
): EvidenceCoverageMap => {
  const evaluatedAt =
    options.evaluatedAt ?? evidenceCoverageMapDefaultEvaluatedAt;
  const executorId = options.executorId ?? "unbound-executor";
  const obligations = [...obligationsInput].sort((left, right) =>
    left.obligationId.localeCompare(right.obligationId),
  );
  const evidenceRecords = [...evidenceRecordsInput].sort((left, right) => {
    const leftKey = `${left.obligationId}:${getEvidenceCoverageRecordType(left) ?? ""}:${left.evidenceHash}`;
    const rightKey = `${right.obligationId}:${getEvidenceCoverageRecordType(right) ?? ""}:${right.evidenceHash}`;

    return leftKey.localeCompare(rightKey);
  });

  const coverage: EvidenceCoverageEntry[] = [];
  const coverageObligations = obligations.map((obligation) => {
    const requiredEvidence = [...obligation.requiredEvidenceTypes]
      .sort()
      .map((requiredEvidenceType) => {
        const matchingRecords = evidenceRecords.filter(
          (record) =>
            record.obligationId === obligation.obligationId &&
            getEvidenceCoverageRecordType(record) === requiredEvidenceType,
        );
        const status = selectEvidenceCoverageStatus(
          matchingRecords,
          evaluatedAt,
        );
        const entry: EvidenceCoverageEntry = {
          obligationId: obligation.obligationId,
          requiredEvidenceType,
          status,
          covered: !isCoverageStatusFailClosed(status),
          evidenceHashes: Array.from(
            new Set(matchingRecords.map((record) => record.evidenceHash)),
          ).sort(),
          reason: getEvidenceCoverageReason(status),
          evaluatedAt,
        };
        const completedAt = getLatestDefinedTimestamp(
          matchingRecords.map(getEvidenceCoverageRecordCompletedAt),
        );
        const expiresAt = getLatestDefinedTimestamp(
          matchingRecords.map((record) => record.expiresAt),
        );
        const invalidatedAt = getLatestDefinedTimestamp(
          matchingRecords.map((record) => record.invalidatedAt),
        );

        if (completedAt !== undefined) {
          entry.completedAt = completedAt;
        }

        if (expiresAt !== undefined) {
          entry.expiresAt = expiresAt;
        }

        if (invalidatedAt !== undefined) {
          entry.invalidatedAt = invalidatedAt;
        }

        coverage.push(entry);

        return entry;
      });
    const status = selectEvidenceCoverageObligationStatus(requiredEvidence);

    return {
      obligationId: obligation.obligationId,
      status,
      covered: !isCoverageStatusFailClosed(status),
      requiredEvidence,
    };
  });

  return {
    coverageMapId:
      options.coverageMapId ??
      getEvidenceCoverageMapId(obligations, executorId, evaluatedAt),
    executorId,
    evaluatedAt,
    coverage,
    obligations: coverageObligations,
    allObligationsCovered: coverageObligations.every(
      (obligation) => obligation.covered,
    ),
  };
};

const isPositiveEvidenceTtl = (
  evidenceTtlMs: number | undefined,
): evidenceTtlMs is number =>
  evidenceTtlMs !== undefined &&
  Number.isFinite(evidenceTtlMs) &&
  evidenceTtlMs > 0;

const addMillisecondsToTimestamp = (
  timestamp: ForbiddenSideEffectTimestamp | undefined,
  ttlMs: number | undefined,
): ForbiddenSideEffectTimestamp | undefined => {
  if (timestamp === undefined || !isPositiveEvidenceTtl(ttlMs)) {
    return undefined;
  }

  const timestampMilliseconds = Date.parse(timestamp);

  if (!Number.isFinite(timestampMilliseconds)) {
    return undefined;
  }

  return new Date(timestampMilliseconds + ttlMs).toISOString();
};

const getEarliestDefinedTimestamp = (
  timestamps: readonly (ForbiddenSideEffectTimestamp | undefined)[],
): ForbiddenSideEffectTimestamp | undefined => {
  const definedTimestamps = timestamps.filter(
    (timestamp): timestamp is ForbiddenSideEffectTimestamp =>
      timestamp !== undefined,
  );

  if (definedTimestamps.length === 0) {
    return undefined;
  }

  return definedTimestamps.sort()[0];
};

const getExecutorSafetyEvidenceValidUntil = (
  coverageMap: EvidenceCoverageMap,
  evidenceTtlMs: number | undefined,
): ForbiddenSideEffectTimestamp | undefined =>
  getEarliestDefinedTimestamp(
    coverageMap.coverage.flatMap((entry) => [
      entry.expiresAt,
      addMillisecondsToTimestamp(entry.completedAt, evidenceTtlMs),
    ]),
  );

const isCoveredEntryPastTtl = (
  entry: EvidenceCoverageEntry,
  evaluatedAt: ForbiddenSideEffectTimestamp,
  evidenceTtlMs: number | undefined,
): boolean => {
  if (entry.status !== EvidenceCoverageStatus.Covered) {
    return false;
  }

  if (!isPositiveEvidenceTtl(evidenceTtlMs)) {
    return false;
  }

  const ttlExpiresAt = addMillisecondsToTimestamp(
    entry.completedAt,
    evidenceTtlMs,
  );

  return (
    ttlExpiresAt === undefined || isTimestampAtOrBefore(ttlExpiresAt, evaluatedAt)
  );
};

const getExecutorSafetyEvidenceStateId = (
  coverageMap: EvidenceCoverageMap,
  state: ExecutorSafetyEvidenceStateName,
  evaluatedAt: ForbiddenSideEffectTimestamp,
): ExecutorSafetyEvidenceStateId =>
  `eses:${coverageMap.coverageMapId}:${state}:${evaluatedAt}`;

const getExecutorSafetyBlockingStatuses = (
  coverageMap: EvidenceCoverageMap,
  hasTtlExpired: boolean,
  invalidatedBy: string | undefined,
): readonly EvidenceCoverageStatus[] => {
  const statuses = new Set<EvidenceCoverageStatus>();

  for (const entry of coverageMap.coverage) {
    if (entry.status !== EvidenceCoverageStatus.Covered) {
      statuses.add(entry.status);
    }
  }

  for (const obligation of coverageMap.obligations) {
    if (obligation.status !== EvidenceCoverageStatus.Covered) {
      statuses.add(obligation.status);
    }
  }

  if (hasTtlExpired) {
    statuses.add(EvidenceCoverageStatus.Stale);
  }

  if (invalidatedBy !== undefined) {
    statuses.add(EvidenceCoverageStatus.Invalidated);
  }

  return EvidenceCoverageStatusValues.filter((status) => statuses.has(status));
};

const getBlockedExecutorSafetyObligationIds = (
  coverageMap: EvidenceCoverageMap,
  state: ExecutorSafetyEvidenceStateName,
): readonly ForbiddenEffectObligationId[] => {
  const blockedObligationIds = coverageMap.obligations
    .filter(
      (obligation) =>
        obligation.status !== EvidenceCoverageStatus.Covered ||
        !obligation.covered,
    )
    .map((obligation) => obligation.obligationId)
    .sort();

  if (
    blockedObligationIds.length === 0 &&
    state !== ExecutorSafetyEvidenceStateName.EvidenceComplete
  ) {
    return coverageMap.obligations
      .map((obligation) => obligation.obligationId)
      .sort();
  }

  return blockedObligationIds;
};

const hasCompleteExecutorSafetyCoverage = (
  coverageMap: EvidenceCoverageMap,
): boolean =>
  coverageMap.obligations.length > 0 &&
  coverageMap.coverage.length > 0 &&
  coverageMap.allObligationsCovered &&
  coverageMap.obligations.every(
    (obligation) =>
      obligation.covered && obligation.status === EvidenceCoverageStatus.Covered,
  ) &&
  coverageMap.coverage.every(
    (entry) => entry.covered && entry.status === EvidenceCoverageStatus.Covered,
  );

export const evaluateExecutorSafetyEvidenceState = (
  coverageMap: EvidenceCoverageMap,
  options: ExecutorSafetyEvidenceStateEvaluationOptions = {},
): ExecutorSafetyEvidenceState => {
  const evaluatedAt = options.evaluatedAt ?? coverageMap.evaluatedAt;
  const validUntil = getExecutorSafetyEvidenceValidUntil(
    coverageMap,
    options.evidenceTtlMs,
  );
  const hasFailedEvidence =
    coverageMap.coverage.some(
      (entry) => entry.status === EvidenceCoverageStatus.Failed,
    ) ||
    coverageMap.obligations.some(
      (obligation) => obligation.status === EvidenceCoverageStatus.Failed,
    );
  const hasInvalidatedEvidence =
    options.invalidatedBy !== undefined ||
    coverageMap.coverage.some(
      (entry) =>
        entry.status === EvidenceCoverageStatus.Invalidated ||
        isTimestampAtOrBefore(entry.invalidatedAt, evaluatedAt),
    ) ||
    coverageMap.obligations.some(
      (obligation) => obligation.status === EvidenceCoverageStatus.Invalidated,
    );
  const hasStaleEvidence =
    coverageMap.coverage.some(
      (entry) =>
        entry.status === EvidenceCoverageStatus.Stale ||
        isTimestampAtOrBefore(entry.expiresAt, evaluatedAt),
    ) ||
    coverageMap.obligations.some(
      (obligation) => obligation.status === EvidenceCoverageStatus.Stale,
    );
  const hasTtlExpired = coverageMap.coverage.some((entry) =>
    isCoveredEntryPastTtl(entry, evaluatedAt, options.evidenceTtlMs),
  );
  const hasCompleteCoverage = hasCompleteExecutorSafetyCoverage(coverageMap);
  const hasCoveredEvidence =
    coverageMap.coverage.some(
      (entry) => entry.covered && entry.status === EvidenceCoverageStatus.Covered,
    ) ||
    coverageMap.obligations.some(
      (obligation) =>
        obligation.covered && obligation.status === EvidenceCoverageStatus.Covered,
    );

  let state: ExecutorSafetyEvidenceStateName;
  let transitionReason: string;

  if (coverageMap.obligations.length === 0 || coverageMap.coverage.length === 0) {
    state = ExecutorSafetyEvidenceStateName.EvidenceMissing;
    transitionReason = "no forbidden-effect obligations or required evidence entries were supplied";
  } else if (hasFailedEvidence) {
    state = ExecutorSafetyEvidenceStateName.EvidenceFailed;
    transitionReason = "one or more required evidence records failed safety proof";
  } else if (hasInvalidatedEvidence) {
    state = ExecutorSafetyEvidenceStateName.EvidenceInvalidated;
    transitionReason =
      options.invalidatedBy !== undefined
        ? `executor safety evidence was invalidated by ${options.invalidatedBy}`
        : "one or more required evidence records were invalidated";
  } else if (hasStaleEvidence || hasTtlExpired) {
    state = ExecutorSafetyEvidenceStateName.EvidenceExpired;
    transitionReason = "one or more required evidence records are stale or past TTL";
  } else if (hasCompleteCoverage) {
    state = ExecutorSafetyEvidenceStateName.EvidenceComplete;
    transitionReason = "all required obligations are covered by valid evidence";
  } else if (hasCoveredEvidence) {
    state = ExecutorSafetyEvidenceStateName.EvidencePartial;
    transitionReason =
      "some required obligations are covered, but at least one required evidence type is incomplete";
  } else {
    state = ExecutorSafetyEvidenceStateName.EvidenceMissing;
    transitionReason = "no required evidence has been covered";
  }

  const safetyState: ExecutorSafetyEvidenceState = {
    stateId:
      options.stateId ??
      getExecutorSafetyEvidenceStateId(coverageMap, state, evaluatedAt),
    executorId: coverageMap.executorId,
    coverageMapId: coverageMap.coverageMapId,
    state,
    allObligationsCovered:
      state === ExecutorSafetyEvidenceStateName.EvidenceComplete,
    evaluatedAt,
    coveredObligationIds: coverageMap.obligations
      .filter(
        (obligation) =>
          obligation.covered && obligation.status === EvidenceCoverageStatus.Covered,
      )
      .map((obligation) => obligation.obligationId)
      .sort(),
    blockedObligationIds: getBlockedExecutorSafetyObligationIds(
      coverageMap,
      state,
    ),
    blockingStatuses: getExecutorSafetyBlockingStatuses(
      coverageMap,
      hasTtlExpired,
      options.invalidatedBy,
    ),
    transitionReason,
  };

  if (validUntil !== undefined) {
    safetyState.validUntil = validUntil;
  }

  if (options.invalidatedBy !== undefined) {
    safetyState.invalidatedBy = options.invalidatedBy;
  }

  if (options.coverageMapHash !== undefined) {
    safetyState.coverageMapHash = options.coverageMapHash;
  }

  if (options.safetyEvidenceVersion !== undefined) {
    safetyState.safetyEvidenceVersion = options.safetyEvidenceVersion;
  }

  return safetyState;
};

type SideEffectObservedEventHashPayload = {
  evidenceType: SideEffectEvidenceType;
  target: string;
  eventHash: PatentProofHash;
  observedAt?: ForbiddenSideEffectTimestamp;
};

const buildSideEffectObservedEventHashPayload = (
  event: SideEffectObservedEvent,
): SideEffectObservedEventHashPayload => {
  const payload: SideEffectObservedEventHashPayload = {
    evidenceType: event.evidenceType,
    target: event.target,
    eventHash: event.eventHash,
  };

  if (event.observedAt !== undefined) {
    payload.observedAt = event.observedAt;
  }

  return payload;
};

const buildSideEffectDeltaChangeHashPayload = (
  change: SideEffectDeltaChange,
): SideEffectDeltaChange => ({
  evidenceType: change.evidenceType,
  target: change.target,
  beforeHash: change.beforeHash,
  afterHash: change.afterHash,
  changeType: change.changeType,
});

type SideEffectDeltaEvidenceHashPayload = {
  schema: string;
  probeId: SideEffectProbePlanId;
  obligationId: ForbiddenEffectObligationId;
  executorId: string;
  beforeSnapshotHash: PatentProofHash;
  afterSnapshotHash: PatentProofHash;
  observedEvents: SideEffectObservedEventHashPayload[];
  forbiddenEffectsObserved: SideEffectObservedEventHashPayload[];
  effectDelta: SideEffectDeltaChange[];
  completedAt: ForbiddenSideEffectTimestamp;
  executorFingerprint?: ExecutorDriftFingerprintHash;
};

export const buildSideEffectDeltaEvidenceHashPayload = (
  input: unknown,
): string => {
  const evidence = SideEffectDeltaEvidenceSchema.parse(input);
  const payload: SideEffectDeltaEvidenceHashPayload = {
    schema:
      "agent-safety-gateway.forbidden-side-effect.SideEffectDeltaEvidence.v1",
    probeId: evidence.probeId,
    obligationId: evidence.obligationId,
    executorId: evidence.executorId,
    beforeSnapshotHash: evidence.beforeSnapshotHash,
    afterSnapshotHash: evidence.afterSnapshotHash,
    observedEvents: evidence.observedEvents.map(
      buildSideEffectObservedEventHashPayload,
    ),
    forbiddenEffectsObserved: evidence.forbiddenEffectsObserved.map(
      buildSideEffectObservedEventHashPayload,
    ),
    effectDelta: evidence.effectDelta.map(buildSideEffectDeltaChangeHashPayload),
    completedAt: evidence.completedAt,
  };

  if (evidence.executorFingerprint !== undefined) {
    payload.executorFingerprint = evidence.executorFingerprint;
  }

  return JSON.stringify(payload);
};

export const buildDeniedCapabilityEvidenceHashPayload = (
  input: unknown,
): string => {
  const evidence = DeniedCapabilityEvidenceSchema.parse(input);

  return JSON.stringify({
    schema:
      "agent-safety-gateway.forbidden-side-effect.DeniedCapabilityEvidence.v1",
    probeId: evidence.probeId,
    obligationId: evidence.obligationId,
    attemptedOperation: evidence.attemptedOperation,
    observedRejection: evidence.observedRejection,
    rejectionReason: evidence.rejectionReason,
    executorFingerprint: evidence.executorFingerprint,
    completedAt: evidence.completedAt,
  });
};

const toHexDigest = (digest: ArrayBuffer): string =>
  Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const sha256InitialHash = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f,
  0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
] as const;

const sha256RoundConstants = [
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

const rotateRight = (value: number, bits: number): number =>
  (value >>> bits) | (value << (32 - bits));

const createPureSha256DigestHex = (payload: string): string => {
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

  const hash: number[] = [...sha256InitialHash];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = dataView.getUint32(offset + index * 4);
    }

    for (let index = 16; index < 64; index += 1) {
      const word15 = words[index - 15] ?? 0;
      const word2 = words[index - 2] ?? 0;
      const sigma0 =
        rotateRight(word15, 7) ^ rotateRight(word15, 18) ^ (word15 >>> 3);
      const sigma1 =
        rotateRight(word2, 17) ^ rotateRight(word2, 19) ^ (word2 >>> 10);
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
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 =
        (h + sigma1 + choice + (sha256RoundConstants[index] ?? 0) +
          (words[index] ?? 0)) >>>
        0;
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
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

const createSha256DigestHex = async (payload: string): Promise<string> => {
  const encodedPayload = new TextEncoder().encode(payload);
  const cryptoSubtle = globalThis.crypto?.subtle;

  if (cryptoSubtle !== undefined) {
    return toHexDigest(await cryptoSubtle.digest("SHA-256", encodedPayload));
  }

  return createPureSha256DigestHex(payload);
};

export const createDeniedCapabilityEvidenceHash = async (
  input: unknown,
): Promise<PatentProofHash> => {
  const hashPayload = buildDeniedCapabilityEvidenceHashPayload(input);

  return `${EvidenceHashAlgorithm.Sha256}:${await createSha256DigestHex(
    hashPayload,
  )}`;
};

export const createSideEffectDeltaEvidenceHash = async (
  input: unknown,
): Promise<PatentProofHash> => {
  const hashPayload = buildSideEffectDeltaEvidenceHashPayload(input);

  return `${EvidenceHashAlgorithm.Sha256}:${await createSha256DigestHex(
    hashPayload,
  )}`;
};

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
  coverageMap: "EvidenceCoverageMap",
  safetyState: "ExecutorSafetyEvidenceState",
  evidence: ["DeniedCapabilityEvidence", "SideEffectDeltaEvidence"],
  permitExit: "PermitBinding",
} as const;
