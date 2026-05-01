import { PatentStateMachineDomain } from "./patent-state-machine.js";
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

type ContextAnchorIssueCollector = {
  issues: ContextAnchorValidationIssue[];
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

export const ContextRetentionDomain = {
  name: ContextRetentionDomainName,
  stateMachine: "context-sufficiency",
  anchor: "ContextAnchor",
  obligation: "RequiredContextObligation",
  manifest: "PromptAssemblyManifest",
  evidence: "ContextRetentionEvidence",
  permitExit: "PermitDecision",
} as const;
