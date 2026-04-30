import { readFile } from "node:fs/promises";

import type {
  Environment,
  IsoTimestamp,
  ToolCallRequest,
} from "@agent-safety-gateway/shared";

import type { LocalStorageLayout } from "./storage.js";

export type HookDecisionRecord = {
  id: string;
  toolName: string;
  commandSummary: string;
  cwd: string | null;
  adaptedRequest: ToolCallRequest | null;
  blockReason: string;
  shouldBlock: boolean;
  createdAt: IsoTimestamp;
  auditId: string | null;
};

export type HookDecisionFilters = {
  requestId?: string;
  auditId?: string;
  shouldBlock?: boolean;
  toolName?: string;
  environment?: Environment;
};

export type HookDecisionRepository = {
  listHookDecisions: (filters?: HookDecisionFilters) => Promise<HookDecisionRecord[]>;
};

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const parseHookDecisionLine = (line: string, index: number): HookDecisionRecord => {
  const parsedRecord = JSON.parse(line) as Partial<HookDecisionRecord>;

  if (
    typeof parsedRecord.id !== "string" ||
    typeof parsedRecord.toolName !== "string" ||
    typeof parsedRecord.commandSummary !== "string" ||
    (parsedRecord.cwd !== null && typeof parsedRecord.cwd !== "string") ||
    (parsedRecord.adaptedRequest !== null && !isRecord(parsedRecord.adaptedRequest)) ||
    typeof parsedRecord.blockReason !== "string" ||
    typeof parsedRecord.shouldBlock !== "boolean" ||
    typeof parsedRecord.createdAt !== "string" ||
    (parsedRecord.auditId !== null && typeof parsedRecord.auditId !== "string")
  ) {
    throw new Error(`Invalid hook decision record at line ${index + 1}.`);
  }

  return parsedRecord as HookDecisionRecord;
};

const readHookDecisionStore = async (
  filePath: string,
): Promise<HookDecisionRecord[]> => {
  const rawContent = await readFile(filePath, "utf8");
  const lines = rawContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map(parseHookDecisionLine);
};

const matchesHookDecisionFilters = (
  record: HookDecisionRecord,
  filters: HookDecisionFilters,
) => {
  if (filters.requestId && record.adaptedRequest?.id !== filters.requestId) {
    return false;
  }

  if (filters.auditId && record.auditId !== filters.auditId) {
    return false;
  }

  if (
    filters.shouldBlock !== undefined &&
    record.shouldBlock !== filters.shouldBlock
  ) {
    return false;
  }

  if (filters.toolName && record.toolName !== filters.toolName) {
    return false;
  }

  if (
    filters.environment &&
    record.adaptedRequest?.environment !== filters.environment
  ) {
    return false;
  }

  return true;
};

export const createHookDecisionRepository = (
  layout: LocalStorageLayout,
): HookDecisionRepository => ({
  async listHookDecisions(filters = {}) {
    const records = await readHookDecisionStore(layout.stores.hookDecisions);
    return records.filter((record) => matchesHookDecisionFilters(record, filters));
  },
});
