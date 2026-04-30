import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(sourceDir, "../../..");
const defaultDataDir = resolve(defaultRepoRoot, ".data");
const hookDecisionFileName = "hook-decisions.jsonl";

const dataDir = () =>
  resolve(
    process.env.ASG_HOOK_DECISION_DATA_DIR ??
      process.env.API_DATA_DIR ??
      defaultDataDir,
  );

export const getHookDecisionStorePath = () =>
  resolve(dataDir(), hookDecisionFileName);

const summarizeCommand = (command) => {
  const normalized = String(command ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= 240) {
    return normalized;
  }

  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 10);
  return `${normalized.slice(0, 220)}… sha256:${digest}`;
};

export const buildHookDecisionRecord = ({
  toolName,
  command,
  cwd,
  adaptedRequest,
  blockReason,
  shouldBlock,
  auditId,
  createdAt = new Date().toISOString(),
}) => ({
  id: randomUUID(),
  toolName: toolName ?? "unknown",
  commandSummary: summarizeCommand(command),
  cwd: cwd ?? null,
  adaptedRequest: adaptedRequest ?? null,
  blockReason,
  shouldBlock: Boolean(shouldBlock),
  createdAt,
  auditId: auditId ?? null,
});

export const appendHookDecision = async (record) => {
  const storePath = getHookDecisionStorePath();

  await mkdir(dirname(storePath), { recursive: true });
  await appendFile(storePath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
};

export const persistHookDecision = async (input) =>
  appendHookDecision(buildHookDecisionRecord(input));

export const listHookDecisions = async (storePath = getHookDecisionStorePath()) => {
  const raw = await readFile(storePath, "utf8").catch((error) => {
    if (error.code === "ENOENT") {
      return "";
    }

    throw error;
  });

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid hook decision record at line ${index + 1}.`, {
          cause: error,
        });
      }
    });
};
