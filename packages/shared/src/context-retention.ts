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
