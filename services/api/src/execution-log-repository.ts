import { appendFile, readFile, writeFile } from "node:fs/promises";

import type {
  DecisionType,
  Environment,
  IsoTimestamp,
  JsonObject,
  JsonValue,
  ToolType,
} from "@agent-safety-gateway/shared";

import type { LocalStorageLayout } from "./storage.js";

export type ExecutionLogEntry = {
  scenarioId: string;
  toolType: ToolType;
  requestId: string;
  called: boolean;
  auditId?: string;
  decision?: DecisionType;
  environment?: Environment;
  timestamp: IsoTimestamp;
  result: JsonValue;
};

export type ExecutionLogFilters = {
  requestId?: string;
  auditId?: string;
  toolType?: ToolType;
  decision?: DecisionType;
  environment?: Environment;
};

export type ExecutionLogRepository = {
  appendExecutionLog: (entry: ExecutionLogEntry) => Promise<ExecutionLogEntry>;
  listExecutionLogs: (filters?: ExecutionLogFilters) => Promise<ExecutionLogEntry[]>;
  clearExecutionLogs: () => Promise<void>;
};

const isJsonObject = (value: JsonValue): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readResultString = (entry: ExecutionLogEntry, key: string) => {
  if (!isJsonObject(entry.result)) {
    return undefined;
  }

  const value = entry.result[key];
  return typeof value === "string" ? value : undefined;
};

const getExecutionLogEnvironment = (entry: ExecutionLogEntry) =>
  entry.environment ?? readResultString(entry, "environment");

const getExecutionLogAuditId = (entry: ExecutionLogEntry) =>
  entry.auditId ?? readResultString(entry, "auditId");

const getExecutionLogDecision = (entry: ExecutionLogEntry) =>
  entry.decision ?? readResultString(entry, "decision");

const matchesExecutionLogFilters = (
  entry: ExecutionLogEntry,
  filters: ExecutionLogFilters,
) => {
  if (filters.requestId && entry.requestId !== filters.requestId) {
    return false;
  }

  if (filters.auditId && getExecutionLogAuditId(entry) !== filters.auditId) {
    return false;
  }

  if (filters.toolType && entry.toolType !== filters.toolType) {
    return false;
  }

  if (filters.decision && getExecutionLogDecision(entry) !== filters.decision) {
    return false;
  }

  if (
    filters.environment &&
    getExecutionLogEnvironment(entry) !== filters.environment
  ) {
    return false;
  }

  return true;
};

const parseExecutionLogLine = (line: string, index: number): ExecutionLogEntry => {
  const parsedEntry = JSON.parse(line) as Partial<ExecutionLogEntry>;

  if (
    typeof parsedEntry.scenarioId !== "string" ||
    typeof parsedEntry.toolType !== "string" ||
    typeof parsedEntry.requestId !== "string" ||
    typeof parsedEntry.called !== "boolean" ||
    (parsedEntry.auditId !== undefined && typeof parsedEntry.auditId !== "string") ||
    (parsedEntry.decision !== undefined && typeof parsedEntry.decision !== "string") ||
    (parsedEntry.environment !== undefined &&
      typeof parsedEntry.environment !== "string") ||
    typeof parsedEntry.timestamp !== "string"
  ) {
    throw new Error(`Invalid execution log entry at line ${index + 1}.`);
  }

  return parsedEntry as ExecutionLogEntry;
};

const readExecutionLogStore = async (
  filePath: string,
): Promise<ExecutionLogEntry[]> => {
  const rawContent = await readFile(filePath, "utf8");
  const lines = rawContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map(parseExecutionLogLine);
};

export const createExecutionLogRepository = (
  layout: LocalStorageLayout,
): ExecutionLogRepository => ({
  async appendExecutionLog(entry) {
    await appendFile(
      layout.stores.executionLogs,
      `${JSON.stringify(entry)}\n`,
      "utf8",
    );
    return entry;
  },
  async listExecutionLogs(filters = {}) {
    const executionLogs = await readExecutionLogStore(layout.stores.executionLogs);
    return executionLogs.filter((entry) => matchesExecutionLogFilters(entry, filters));
  },
  async clearExecutionLogs() {
    await writeFile(layout.stores.executionLogs, "", "utf8");
  },
});
