import { appendFile, readFile } from "node:fs/promises";

import {
  AuditRecordSchema,
  type AuditRecord,
} from "@agent-safety-gateway/shared";

import type { LocalStorageLayout } from "./storage.js";

export type AuditRepository = {
  createAuditRecord: (record: AuditRecord) => Promise<AuditRecord>;
  listAuditRecords: () => Promise<AuditRecord[]>;
  getAuditRecordById: (auditId: string) => Promise<AuditRecord | null>;
};

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

export const createAuditRepository = (
  layout: LocalStorageLayout,
): AuditRepository => {
  const listAuditRecords = () => readAuditRecordStore(layout.stores.audits);

  return {
    async createAuditRecord(record) {
      const validatedRecord = AuditRecordSchema.parse(record);
      await appendFile(
        layout.stores.audits,
        `${JSON.stringify(validatedRecord)}\n`,
        "utf8",
      );
      return validatedRecord;
    },
    listAuditRecords,
    async getAuditRecordById(auditId) {
      const auditRecords = await listAuditRecords();
      return auditRecords.find((record) => record.id === auditId) ?? null;
    },
  };
};
