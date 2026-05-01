import { appendFile, readFile, writeFile } from "node:fs/promises";

import {
  AuditRecordSchema,
  type AuditExecutorSafetyEvidence,
  type AuditRecord,
  type DecisionType,
  type Environment,
  type RiskLevel,
  type ToolType,
} from "@agent-safety-gateway/shared";

import type { LocalStorageLayout } from "./storage.js";
import {
  redactSensitiveAuditFields,
  type AuditRedactionOptions,
} from "./audit-redaction.js";

export type AuditRecordFilters = {
  decision?: DecisionType;
  riskLevel?: RiskLevel;
  toolType?: ToolType;
  environment?: Environment;
};

export type AuditRepository = {
  createAuditRecord: (record: AuditRecord) => Promise<AuditRecord>;
  updateAuditExecutorSafetyEvidence: (
    auditId: string,
    evidence: AuditExecutorSafetyEvidence,
  ) => Promise<AuditRecord | null>;
  listAuditRecords: (filters?: AuditRecordFilters) => Promise<AuditRecord[]>;
  getAuditRecordById: (auditId: string) => Promise<AuditRecord | null>;
};

export type AuditRepositoryOptions = {
  redaction?: AuditRedactionOptions;
};

const redactAuditRecord = (
  record: AuditRecord,
  redaction: AuditRedactionOptions | undefined,
): AuditRecord => AuditRecordSchema.parse(redactSensitiveAuditFields(record, redaction));

const parseAuditRecordLine = (line: string, index: number): AuditRecord => {
  try {
    return AuditRecordSchema.parse(JSON.parse(line));
  } catch (error: unknown) {
    throw new Error(`Invalid audit record at line ${index + 1}.`, {
      cause: error,
    });
  }
};

const readAuditRecordStore = async (
  filePath: string,
): Promise<AuditRecord[]> => {
  const rawContent = await readFile(filePath, "utf8");
  const lines = rawContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map(parseAuditRecordLine);
};

const writeAuditRecordStore = async (
  filePath: string,
  records: readonly AuditRecord[],
) => {
  const content = records.map((record) => JSON.stringify(record)).join("\n");

  await writeFile(filePath, content.length > 0 ? `${content}\n` : "", "utf8");
};

export const createAuditRepository = (
  layout: LocalStorageLayout,
  options: AuditRepositoryOptions = {},
): AuditRepository => {
  const listAuditRecords = async (filters: AuditRecordFilters = {}) => {
    const auditRecords = await readAuditRecordStore(layout.stores.audits);

    return auditRecords.filter((record) => {
      if (filters.decision && record.decision.type !== filters.decision) {
        return false;
      }

      if (filters.riskLevel && record.riskLevel !== filters.riskLevel) {
        return false;
      }

      if (filters.toolType && record.request.toolType !== filters.toolType) {
        return false;
      }

      if (filters.environment && record.request.environment !== filters.environment) {
        return false;
      }

      return true;
    });
  };

  return {
    async createAuditRecord(record) {
      const validatedRecord = AuditRecordSchema.parse(record);
      const redactedRecord = redactAuditRecord(
        validatedRecord,
        options.redaction,
      );
      await appendFile(
        layout.stores.audits,
        `${JSON.stringify(redactedRecord)}\n`,
        "utf8",
      );
      return redactedRecord;
    },
    async updateAuditExecutorSafetyEvidence(auditId, evidence) {
      const auditRecords = await readAuditRecordStore(layout.stores.audits);
      const recordIndex = auditRecords.findIndex((record) => record.id === auditId);

      if (recordIndex === -1) {
        return null;
      }

      const existingRecord = auditRecords[recordIndex];

      if (!existingRecord) {
        return null;
      }

      const updatedRecord = redactAuditRecord(
        AuditRecordSchema.parse({
          ...existingRecord,
          forbiddenEffectObligations: evidence.forbiddenEffectObligations,
          coverageMapHash: evidence.coverageMapHash,
          safetyEvidenceState: evidence.safetyEvidenceState,
          permitIssued: evidence.permitIssued,
          executorInvoked: evidence.executorInvoked,
          permitBinding: evidence.permitBinding,
          permitDeniedEvidence: evidence.permitDeniedEvidence,
        }),
        options.redaction,
      );

      auditRecords.splice(recordIndex, 1, updatedRecord);
      await writeAuditRecordStore(layout.stores.audits, auditRecords);

      return updatedRecord;
    },
    listAuditRecords,
    async getAuditRecordById(auditId) {
      const auditRecords = await listAuditRecords();
      return auditRecords.find((record) => record.id === auditId) ?? null;
    },
  };
};
