import { appendFile, readFile, writeFile } from "node:fs/promises";

import type {
  IsoTimestamp,
  JsonValue,
  ToolType,
} from "@agent-safety-gateway/shared";

import type { LocalStorageLayout } from "./storage.js";

export type ExecutionLogEntry = {
  scenarioId: string;
  toolType: ToolType;
  requestId: string;
  called: boolean;
  timestamp: IsoTimestamp;
  result: JsonValue;
};

export type ExecutionLogRepository = {
  appendExecutionLog: (entry: ExecutionLogEntry) => Promise<ExecutionLogEntry>;
  listExecutionLogs: () => Promise<ExecutionLogEntry[]>;
  clearExecutionLogs: () => Promise<void>;
};

const parseExecutionLogLine = (line: string, index: number): ExecutionLogEntry => {
  const parsedEntry = JSON.parse(line) as Partial<ExecutionLogEntry>;

  if (
    typeof parsedEntry.scenarioId !== "string" ||
    typeof parsedEntry.toolType !== "string" ||
    typeof parsedEntry.requestId !== "string" ||
    typeof parsedEntry.called !== "boolean" ||
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
  listExecutionLogs() {
    return readExecutionLogStore(layout.stores.executionLogs);
  },
  async clearExecutionLogs() {
    await writeFile(layout.stores.executionLogs, "", "utf8");
  },
});
