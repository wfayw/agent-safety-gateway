import { appendFile, readFile } from "node:fs/promises";

import type { IsoTimestamp } from "@agent-safety-gateway/shared";
import {
  isForbiddenEffectObligation,
  isPermitBinding,
  isPermitDeniedEvidence,
  type EvidenceCoverageMap,
  type EvidenceCoverageRecord,
  type ExecutorSafetyEvidenceState,
  type ForbiddenEffectObligation,
  type PermitBinding,
  type PermitDeniedEvidence,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import type { LocalStorageLayout } from "./storage.js";

export const ExecutorSafetyEvidenceRecordKind = {
  Obligation: "obligation",
  EvidenceRecord: "evidenceRecord",
  CoverageMap: "coverageMap",
  SafetyState: "safetyState",
  Permit: "permit",
  Denial: "denial",
} as const;

export type ExecutorSafetyEvidenceRecordKind =
  (typeof ExecutorSafetyEvidenceRecordKind)[keyof typeof ExecutorSafetyEvidenceRecordKind];

export type ExecutorSafetyEvidenceRecordMetadata = {
  id: string;
  requestId: string;
  executorId: string;
  evidenceVersion: string;
  auditId: string;
  createdAt: IsoTimestamp;
};

type ExecutorSafetyEvidenceRecordBase = ExecutorSafetyEvidenceRecordMetadata & {
  kind: ExecutorSafetyEvidenceRecordKind;
};

export type ObligationEvidenceStoreRecord = ExecutorSafetyEvidenceRecordBase & {
  kind: typeof ExecutorSafetyEvidenceRecordKind.Obligation;
  obligation: ForbiddenEffectObligation;
};

export type EvidenceCoverageStoreRecord = ExecutorSafetyEvidenceRecordBase & {
  kind: typeof ExecutorSafetyEvidenceRecordKind.EvidenceRecord;
  evidenceRecord: EvidenceCoverageRecord;
};

export type CoverageMapStoreRecord = ExecutorSafetyEvidenceRecordBase & {
  kind: typeof ExecutorSafetyEvidenceRecordKind.CoverageMap;
  coverageMap: EvidenceCoverageMap;
};

export type SafetyStateStoreRecord = ExecutorSafetyEvidenceRecordBase & {
  kind: typeof ExecutorSafetyEvidenceRecordKind.SafetyState;
  safetyState: ExecutorSafetyEvidenceState;
};

export type PermitStoreRecord = ExecutorSafetyEvidenceRecordBase & {
  kind: typeof ExecutorSafetyEvidenceRecordKind.Permit;
  permit: PermitBinding;
};

export type DenialStoreRecord = ExecutorSafetyEvidenceRecordBase & {
  kind: typeof ExecutorSafetyEvidenceRecordKind.Denial;
  denial: PermitDeniedEvidence;
};

export type ExecutorSafetyEvidenceRecord =
  | ObligationEvidenceStoreRecord
  | EvidenceCoverageStoreRecord
  | CoverageMapStoreRecord
  | SafetyStateStoreRecord
  | PermitStoreRecord
  | DenialStoreRecord;

export type ExecutorSafetyEvidenceRecordFilters = {
  kind?: ExecutorSafetyEvidenceRecordKind;
  requestId?: string;
  executorId?: string;
  evidenceVersion?: string;
  auditId?: string;
};

export type ExecutorSafetyEvidenceRepository = {
  appendObligation: (
    metadata: ExecutorSafetyEvidenceRecordMetadata,
    obligation: ForbiddenEffectObligation,
  ) => Promise<ObligationEvidenceStoreRecord>;
  appendEvidenceRecord: (
    metadata: ExecutorSafetyEvidenceRecordMetadata,
    evidenceRecord: EvidenceCoverageRecord,
  ) => Promise<EvidenceCoverageStoreRecord>;
  appendCoverageMap: (
    metadata: ExecutorSafetyEvidenceRecordMetadata,
    coverageMap: EvidenceCoverageMap,
  ) => Promise<CoverageMapStoreRecord>;
  appendSafetyState: (
    metadata: ExecutorSafetyEvidenceRecordMetadata,
    safetyState: ExecutorSafetyEvidenceState,
  ) => Promise<SafetyStateStoreRecord>;
  appendPermit: (
    metadata: ExecutorSafetyEvidenceRecordMetadata,
    permit: PermitBinding,
  ) => Promise<PermitStoreRecord>;
  appendDenial: (
    metadata: ExecutorSafetyEvidenceRecordMetadata,
    denial: PermitDeniedEvidence,
  ) => Promise<DenialStoreRecord>;
  appendRecord: <TRecord extends ExecutorSafetyEvidenceRecord>(
    record: TRecord,
  ) => Promise<TRecord>;
  listRecords: (
    filters?: ExecutorSafetyEvidenceRecordFilters,
  ) => Promise<ExecutorSafetyEvidenceRecord[]>;
};

const ExecutorSafetyEvidenceRecordKindValues = Object.values(
  ExecutorSafetyEvidenceRecordKind,
);

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isCoverageMap = (input: unknown): input is EvidenceCoverageMap => {
  if (!isRecord(input)) {
    return false;
  }

  return (
    isNonEmptyString(input.coverageMapId) &&
    isNonEmptyString(input.executorId) &&
    isNonEmptyString(input.evaluatedAt) &&
    Array.isArray(input.coverage) &&
    Array.isArray(input.obligations) &&
    typeof input.allObligationsCovered === "boolean"
  );
};

const isEvidenceCoverageRecord = (
  input: unknown,
): input is EvidenceCoverageRecord => {
  if (!isRecord(input)) {
    return false;
  }

  return (
    isNonEmptyString(input.obligationId) &&
    isNonEmptyString(input.evidenceHash) &&
    (input.requiredEvidenceType === undefined ||
      isNonEmptyString(input.requiredEvidenceType)) &&
    (input.evidenceType === undefined || isNonEmptyString(input.evidenceType))
  );
};

const isSafetyState = (input: unknown): input is ExecutorSafetyEvidenceState => {
  if (!isRecord(input)) {
    return false;
  }

  return (
    isNonEmptyString(input.stateId) &&
    isNonEmptyString(input.executorId) &&
    isNonEmptyString(input.coverageMapId) &&
    isNonEmptyString(input.state) &&
    typeof input.allObligationsCovered === "boolean" &&
    isNonEmptyString(input.evaluatedAt) &&
    isStringArray(input.coveredObligationIds) &&
    isStringArray(input.blockedObligationIds) &&
    isStringArray(input.blockingStatuses) &&
    isNonEmptyString(input.transitionReason)
  );
};

const validateMetadata = (record: ExecutorSafetyEvidenceRecord) => {
  if (
    !isNonEmptyString(record.id) ||
    !isNonEmptyString(record.requestId) ||
    !isNonEmptyString(record.executorId) ||
    !isNonEmptyString(record.evidenceVersion) ||
    !isNonEmptyString(record.auditId) ||
    !isNonEmptyString(record.createdAt)
  ) {
    throw new Error("Invalid executor safety evidence metadata.");
  }
};

const validateRecordPayload = (record: ExecutorSafetyEvidenceRecord) => {
  switch (record.kind) {
    case ExecutorSafetyEvidenceRecordKind.Obligation:
      if (!isForbiddenEffectObligation(record.obligation)) {
        throw new Error("Invalid executor safety obligation record.");
      }
      return;
    case ExecutorSafetyEvidenceRecordKind.EvidenceRecord:
      if (!isEvidenceCoverageRecord(record.evidenceRecord)) {
        throw new Error("Invalid executor safety evidence record payload.");
      }
      return;
    case ExecutorSafetyEvidenceRecordKind.CoverageMap:
      if (!isCoverageMap(record.coverageMap)) {
        throw new Error("Invalid executor safety coverage map record.");
      }
      return;
    case ExecutorSafetyEvidenceRecordKind.SafetyState:
      if (!isSafetyState(record.safetyState)) {
        throw new Error("Invalid executor safety state record.");
      }
      return;
    case ExecutorSafetyEvidenceRecordKind.Permit:
      if (!isPermitBinding(record.permit)) {
        throw new Error("Invalid executor safety permit record.");
      }
      return;
    case ExecutorSafetyEvidenceRecordKind.Denial:
      if (!isPermitDeniedEvidence(record.denial)) {
        throw new Error("Invalid executor safety denial record.");
      }
      return;
    default: {
      const exhaustiveRecord: never = record;
      throw new Error(
        `Unsupported executor safety evidence record kind: ${String(exhaustiveRecord)}`,
      );
    }
  }
};

const validateRecord = <TRecord extends ExecutorSafetyEvidenceRecord>(
  record: TRecord,
): TRecord => {
  validateMetadata(record);
  validateRecordPayload(record);
  return record;
};

const parseExecutorSafetyEvidenceLine = (
  line: string,
  index: number,
): ExecutorSafetyEvidenceRecord => {
  const parsedRecord = JSON.parse(line) as Partial<ExecutorSafetyEvidenceRecord>;

  if (
    !isRecord(parsedRecord) ||
    typeof parsedRecord.kind !== "string" ||
    !ExecutorSafetyEvidenceRecordKindValues.includes(
      parsedRecord.kind as ExecutorSafetyEvidenceRecordKind,
    )
  ) {
    throw new Error(
      `Invalid executor safety evidence record at line ${index + 1}.`,
    );
  }

  try {
    return validateRecord(parsedRecord as ExecutorSafetyEvidenceRecord);
  } catch (error: unknown) {
    throw new Error(
      `Invalid executor safety evidence record at line ${index + 1}.`,
      { cause: error },
    );
  }
};

const readExecutorSafetyEvidenceStore = async (
  filePath: string,
): Promise<ExecutorSafetyEvidenceRecord[]> => {
  const rawContent = await readFile(filePath, "utf8");
  const lines = rawContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map(parseExecutorSafetyEvidenceLine);
};

const matchesFilters = (
  record: ExecutorSafetyEvidenceRecord,
  filters: ExecutorSafetyEvidenceRecordFilters,
) => {
  if (filters.kind && record.kind !== filters.kind) {
    return false;
  }

  if (filters.requestId && record.requestId !== filters.requestId) {
    return false;
  }

  if (filters.executorId && record.executorId !== filters.executorId) {
    return false;
  }

  if (
    filters.evidenceVersion &&
    record.evidenceVersion !== filters.evidenceVersion
  ) {
    return false;
  }

  if (filters.auditId && record.auditId !== filters.auditId) {
    return false;
  }

  return true;
};

export const createExecutorSafetyEvidenceRepository = (
  layout: LocalStorageLayout,
): ExecutorSafetyEvidenceRepository => {
  const appendRecord = async <TRecord extends ExecutorSafetyEvidenceRecord>(
    record: TRecord,
  ) => {
    const validatedRecord = validateRecord(record);
    await appendFile(
      layout.stores.executorSafetyEvidence,
      `${JSON.stringify(validatedRecord)}\n`,
      "utf8",
    );
    return validatedRecord;
  };

  return {
    appendObligation(metadata, obligation) {
      return appendRecord({
        ...metadata,
        kind: ExecutorSafetyEvidenceRecordKind.Obligation,
        obligation,
      });
    },
    appendEvidenceRecord(metadata, evidenceRecord) {
      return appendRecord({
        ...metadata,
        kind: ExecutorSafetyEvidenceRecordKind.EvidenceRecord,
        evidenceRecord,
      });
    },
    appendCoverageMap(metadata, coverageMap) {
      return appendRecord({
        ...metadata,
        kind: ExecutorSafetyEvidenceRecordKind.CoverageMap,
        coverageMap,
      });
    },
    appendSafetyState(metadata, safetyState) {
      return appendRecord({
        ...metadata,
        kind: ExecutorSafetyEvidenceRecordKind.SafetyState,
        safetyState,
      });
    },
    appendPermit(metadata, permit) {
      return appendRecord({
        ...metadata,
        kind: ExecutorSafetyEvidenceRecordKind.Permit,
        permit,
      });
    },
    appendDenial(metadata, denial) {
      return appendRecord({
        ...metadata,
        kind: ExecutorSafetyEvidenceRecordKind.Denial,
        denial,
      });
    },
    appendRecord,
    async listRecords(filters = {}) {
      const records = await readExecutorSafetyEvidenceStore(
        layout.stores.executorSafetyEvidence,
      );
      return records.filter((record) => matchesFilters(record, filters));
    },
  };
};
