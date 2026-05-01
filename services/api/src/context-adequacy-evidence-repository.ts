import { appendFile, readFile } from "node:fs/promises";

import type { IsoTimestamp } from "@agent-safety-gateway/shared";
import type { PatentProofHash } from "@agent-safety-gateway/shared/patent-state-machine";
import {
  createContextAdequacyEvidenceHash,
  isContextAdequacyEvidence,
  isContextAnchor,
  isContextRetentionEvidence,
  isContextSufficiencyState,
  isPromptAssemblyManifest,
  isRequiredContextObligation,
  type ContextAdequacyEvidence,
  type ContextAnchor,
  type ContextRetentionEvidence,
  type ContextSufficiencyState,
  type PromptAssemblyManifest,
  type RequiredContextObligation,
} from "@agent-safety-gateway/shared/context-retention";

import type { LocalStorageLayout } from "./storage.js";

export const ContextAdequacyEvidenceRecordKind = {
  ContextAnchor: "contextAnchor",
  PromptAssemblyManifest: "promptAssemblyManifest",
  RequiredContextObligation: "requiredContextObligation",
  ContextRetentionEvidence: "contextRetentionEvidence",
  ContextSufficiencyState: "contextSufficiencyState",
  ContextAdequacyEvidence: "contextAdequacyEvidence",
} as const;

export type ContextAdequacyEvidenceRecordKind =
  (typeof ContextAdequacyEvidenceRecordKind)[keyof typeof ContextAdequacyEvidenceRecordKind];

export type ContextAdequacyEvidenceRecordMetadata = {
  id: string;
  requestId: string;
  auditId: string;
  inferenceId: string;
  toolCallDigest: PatentProofHash;
  createdAt: IsoTimestamp;
};

type ContextAdequacyEvidenceRecordBase =
  ContextAdequacyEvidenceRecordMetadata & {
    kind: ContextAdequacyEvidenceRecordKind;
  };

export type ContextAnchorStoreRecord = ContextAdequacyEvidenceRecordBase & {
  kind: typeof ContextAdequacyEvidenceRecordKind.ContextAnchor;
  contextAnchor: ContextAnchor;
};

export type PromptAssemblyManifestStoreRecord =
  ContextAdequacyEvidenceRecordBase & {
    kind: typeof ContextAdequacyEvidenceRecordKind.PromptAssemblyManifest;
    promptAssemblyManifest: PromptAssemblyManifest;
  };

export type RequiredContextObligationStoreRecord =
  ContextAdequacyEvidenceRecordBase & {
    kind: typeof ContextAdequacyEvidenceRecordKind.RequiredContextObligation;
    requiredContextObligation: RequiredContextObligation;
  };

export type ContextRetentionEvidenceStoreRecord =
  ContextAdequacyEvidenceRecordBase & {
    kind: typeof ContextAdequacyEvidenceRecordKind.ContextRetentionEvidence;
    contextRetentionEvidence: ContextRetentionEvidence;
  };

export type ContextSufficiencyStateStoreRecord =
  ContextAdequacyEvidenceRecordBase & {
    kind: typeof ContextAdequacyEvidenceRecordKind.ContextSufficiencyState;
    contextSufficiencyState: ContextSufficiencyState;
  };

export type ContextAdequacyEvidenceStoreRecord =
  ContextAdequacyEvidenceRecordBase & {
    kind: typeof ContextAdequacyEvidenceRecordKind.ContextAdequacyEvidence;
    contextAdequacyEvidence: ContextAdequacyEvidence;
    evidenceHash: PatentProofHash;
  };

export type ContextAdequacyEvidenceRecord =
  | ContextAnchorStoreRecord
  | PromptAssemblyManifestStoreRecord
  | RequiredContextObligationStoreRecord
  | ContextRetentionEvidenceStoreRecord
  | ContextSufficiencyStateStoreRecord
  | ContextAdequacyEvidenceStoreRecord;

export type ContextAdequacyEvidenceRecordFilters = {
  kind?: ContextAdequacyEvidenceRecordKind;
  requestId?: string;
  auditId?: string;
  inferenceId?: string;
  toolCallDigest?: PatentProofHash;
};

export type ContextAdequacyEvidenceRepository = {
  appendContextAnchor: (
    metadata: ContextAdequacyEvidenceRecordMetadata,
    contextAnchor: ContextAnchor,
  ) => Promise<ContextAnchorStoreRecord>;
  appendPromptAssemblyManifest: (
    metadata: ContextAdequacyEvidenceRecordMetadata,
    promptAssemblyManifest: PromptAssemblyManifest,
  ) => Promise<PromptAssemblyManifestStoreRecord>;
  appendRequiredContextObligation: (
    metadata: ContextAdequacyEvidenceRecordMetadata,
    requiredContextObligation: RequiredContextObligation,
  ) => Promise<RequiredContextObligationStoreRecord>;
  appendContextRetentionEvidence: (
    metadata: ContextAdequacyEvidenceRecordMetadata,
    contextRetentionEvidence: ContextRetentionEvidence,
  ) => Promise<ContextRetentionEvidenceStoreRecord>;
  appendContextSufficiencyState: (
    metadata: ContextAdequacyEvidenceRecordMetadata,
    contextSufficiencyState: ContextSufficiencyState,
  ) => Promise<ContextSufficiencyStateStoreRecord>;
  appendContextAdequacyEvidence: (
    metadata: ContextAdequacyEvidenceRecordMetadata,
    contextAdequacyEvidence: ContextAdequacyEvidence,
  ) => Promise<ContextAdequacyEvidenceStoreRecord>;
  appendRecord: <TRecord extends ContextAdequacyEvidenceRecord>(
    record: TRecord,
  ) => Promise<TRecord>;
  listRecords: (
    filters?: ContextAdequacyEvidenceRecordFilters,
  ) => Promise<ContextAdequacyEvidenceRecord[]>;
};

const ContextAdequacyEvidenceRecordKindValues = Object.values(
  ContextAdequacyEvidenceRecordKind,
);

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const validateMetadata = (record: ContextAdequacyEvidenceRecord) => {
  if (
    !isNonEmptyString(record.id) ||
    !isNonEmptyString(record.requestId) ||
    !isNonEmptyString(record.auditId) ||
    !isNonEmptyString(record.inferenceId) ||
    !isNonEmptyString(record.toolCallDigest) ||
    !isNonEmptyString(record.createdAt)
  ) {
    throw new Error("Invalid context adequacy evidence metadata.");
  }
};

const validateRecordPayload = async (record: ContextAdequacyEvidenceRecord) => {
  switch (record.kind) {
    case ContextAdequacyEvidenceRecordKind.ContextAnchor:
      if (!isContextAnchor(record.contextAnchor)) {
        throw new Error("Invalid context anchor record.");
      }
      return;
    case ContextAdequacyEvidenceRecordKind.PromptAssemblyManifest:
      if (!isPromptAssemblyManifest(record.promptAssemblyManifest)) {
        throw new Error("Invalid prompt assembly manifest record.");
      }
      return;
    case ContextAdequacyEvidenceRecordKind.RequiredContextObligation:
      if (!isRequiredContextObligation(record.requiredContextObligation)) {
        throw new Error("Invalid required context obligation record.");
      }
      return;
    case ContextAdequacyEvidenceRecordKind.ContextRetentionEvidence:
      if (!isContextRetentionEvidence(record.contextRetentionEvidence)) {
        throw new Error("Invalid context retention evidence record.");
      }
      return;
    case ContextAdequacyEvidenceRecordKind.ContextSufficiencyState:
      if (!isContextSufficiencyState(record.contextSufficiencyState)) {
        throw new Error("Invalid context sufficiency state record.");
      }
      return;
    case ContextAdequacyEvidenceRecordKind.ContextAdequacyEvidence: {
      if (!isContextAdequacyEvidence(record.contextAdequacyEvidence)) {
        throw new Error("Invalid context adequacy evidence record.");
      }

      const expectedEvidenceHash = await createContextAdequacyEvidenceHash(
        record.contextAdequacyEvidence,
      );

      if (record.evidenceHash !== expectedEvidenceHash) {
        throw new Error("Invalid context adequacy evidence hash.");
      }
      return;
    }
    default: {
      const exhaustiveRecord: never = record;
      throw new Error(
        `Unsupported context adequacy evidence record kind: ${String(exhaustiveRecord)}`,
      );
    }
  }
};

const validateRecord = async <TRecord extends ContextAdequacyEvidenceRecord>(
  record: TRecord,
): Promise<TRecord> => {
  validateMetadata(record);
  await validateRecordPayload(record);
  return record;
};

const parseContextAdequacyEvidenceLine = async (
  line: string,
  index: number,
): Promise<ContextAdequacyEvidenceRecord> => {
  const parsedRecord = JSON.parse(line) as Partial<ContextAdequacyEvidenceRecord>;

  if (
    !isRecord(parsedRecord) ||
    typeof parsedRecord.kind !== "string" ||
    !ContextAdequacyEvidenceRecordKindValues.includes(
      parsedRecord.kind as ContextAdequacyEvidenceRecordKind,
    )
  ) {
    throw new Error(
      `Invalid context adequacy evidence record at line ${index + 1}.`,
    );
  }

  try {
    return await validateRecord(parsedRecord as ContextAdequacyEvidenceRecord);
  } catch (error: unknown) {
    throw new Error(
      `Invalid context adequacy evidence record at line ${index + 1}.`,
      { cause: error },
    );
  }
};

const readContextAdequacyEvidenceStore = async (
  filePath: string,
): Promise<ContextAdequacyEvidenceRecord[]> => {
  const rawContent = await readFile(filePath, "utf8");
  const lines = rawContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return Promise.all(lines.map(parseContextAdequacyEvidenceLine));
};

const matchesFilters = (
  record: ContextAdequacyEvidenceRecord,
  filters: ContextAdequacyEvidenceRecordFilters,
) => {
  if (filters.kind && record.kind !== filters.kind) {
    return false;
  }

  if (filters.requestId && record.requestId !== filters.requestId) {
    return false;
  }

  if (filters.auditId && record.auditId !== filters.auditId) {
    return false;
  }

  if (filters.inferenceId && record.inferenceId !== filters.inferenceId) {
    return false;
  }

  if (filters.toolCallDigest && record.toolCallDigest !== filters.toolCallDigest) {
    return false;
  }

  return true;
};

export const createContextAdequacyEvidenceRepository = (
  layout: LocalStorageLayout,
): ContextAdequacyEvidenceRepository => {
  const appendRecord = async <TRecord extends ContextAdequacyEvidenceRecord>(
    record: TRecord,
  ) => {
    const validatedRecord = await validateRecord(record);
    await appendFile(
      layout.stores.contextAdequacyEvidence,
      `${JSON.stringify(validatedRecord)}\n`,
      "utf8",
    );
    return validatedRecord;
  };

  return {
    appendContextAnchor(metadata, contextAnchor) {
      return appendRecord({
        ...metadata,
        kind: ContextAdequacyEvidenceRecordKind.ContextAnchor,
        contextAnchor,
      });
    },
    appendPromptAssemblyManifest(metadata, promptAssemblyManifest) {
      return appendRecord({
        ...metadata,
        kind: ContextAdequacyEvidenceRecordKind.PromptAssemblyManifest,
        promptAssemblyManifest,
      });
    },
    appendRequiredContextObligation(metadata, requiredContextObligation) {
      return appendRecord({
        ...metadata,
        kind: ContextAdequacyEvidenceRecordKind.RequiredContextObligation,
        requiredContextObligation,
      });
    },
    appendContextRetentionEvidence(metadata, contextRetentionEvidence) {
      return appendRecord({
        ...metadata,
        kind: ContextAdequacyEvidenceRecordKind.ContextRetentionEvidence,
        contextRetentionEvidence,
      });
    },
    appendContextSufficiencyState(metadata, contextSufficiencyState) {
      return appendRecord({
        ...metadata,
        kind: ContextAdequacyEvidenceRecordKind.ContextSufficiencyState,
        contextSufficiencyState,
      });
    },
    async appendContextAdequacyEvidence(metadata, contextAdequacyEvidence) {
      return appendRecord({
        ...metadata,
        kind: ContextAdequacyEvidenceRecordKind.ContextAdequacyEvidence,
        contextAdequacyEvidence,
        evidenceHash: await createContextAdequacyEvidenceHash(
          contextAdequacyEvidence,
        ),
      });
    },
    appendRecord,
    async listRecords(filters = {}) {
      const records = await readContextAdequacyEvidenceStore(
        layout.stores.contextAdequacyEvidence,
      );
      return records.filter((record) => matchesFilters(record, filters));
    },
  };
};
