import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const LocalStoreName = {
  Resources: "resources",
  Dependencies: "dependencies",
  Audits: "audits",
  Scenarios: "scenarios",
  ExecutionLogs: "executionLogs",
  HookDecisions: "hookDecisions",
  ExecutorSafetyEvidence: "executorSafetyEvidence",
  ContextAdequacyEvidence: "contextAdequacyEvidence",
} as const;

export type LocalStoreName = (typeof LocalStoreName)[keyof typeof LocalStoreName];

export type LocalStorageLayout = {
  dataDir: string;
  stores: Record<LocalStoreName, string>;
};

const LOCAL_STORE_FILES = {
  [LocalStoreName.Resources]: "resources.json",
  [LocalStoreName.Dependencies]: "dependencies.json",
  [LocalStoreName.Audits]: "audits.jsonl",
  [LocalStoreName.Scenarios]: "scenarios.json",
  [LocalStoreName.ExecutionLogs]: "execution-log.jsonl",
  [LocalStoreName.HookDecisions]: "hook-decisions.jsonl",
  [LocalStoreName.ExecutorSafetyEvidence]: "executor-safety-evidence.jsonl",
  [LocalStoreName.ContextAdequacyEvidence]: "context-adequacy-evidence.jsonl",
} as const satisfies Record<LocalStoreName, string>;

const INITIAL_STORE_CONTENT = {
  [LocalStoreName.Resources]: "[]\n",
  [LocalStoreName.Dependencies]: "[]\n",
  [LocalStoreName.Audits]: "",
  [LocalStoreName.Scenarios]: "[]\n",
  [LocalStoreName.ExecutionLogs]: "",
  [LocalStoreName.HookDecisions]: "",
  [LocalStoreName.ExecutorSafetyEvidence]: "",
  [LocalStoreName.ContextAdequacyEvidence]: "",
} as const satisfies Record<LocalStoreName, string>;

type NodeError = Error & { code?: string };

export const createLocalStorageLayout = (dataDir: string): LocalStorageLayout => {
  const absoluteDataDir = resolve(dataDir);

  return {
    dataDir: absoluteDataDir,
    stores: {
      [LocalStoreName.Resources]: join(
        absoluteDataDir,
        LOCAL_STORE_FILES[LocalStoreName.Resources],
      ),
      [LocalStoreName.Dependencies]: join(
        absoluteDataDir,
        LOCAL_STORE_FILES[LocalStoreName.Dependencies],
      ),
      [LocalStoreName.Audits]: join(
        absoluteDataDir,
        LOCAL_STORE_FILES[LocalStoreName.Audits],
      ),
      [LocalStoreName.Scenarios]: join(
        absoluteDataDir,
        LOCAL_STORE_FILES[LocalStoreName.Scenarios],
      ),
      [LocalStoreName.ExecutionLogs]: join(
        absoluteDataDir,
        LOCAL_STORE_FILES[LocalStoreName.ExecutionLogs],
      ),
      [LocalStoreName.HookDecisions]: join(
        absoluteDataDir,
        LOCAL_STORE_FILES[LocalStoreName.HookDecisions],
      ),
      [LocalStoreName.ExecutorSafetyEvidence]: join(
        absoluteDataDir,
        LOCAL_STORE_FILES[LocalStoreName.ExecutorSafetyEvidence],
      ),
      [LocalStoreName.ContextAdequacyEvidence]: join(
        absoluteDataDir,
        LOCAL_STORE_FILES[LocalStoreName.ContextAdequacyEvidence],
      ),
    },
  };
};

const createStoreFileIfMissing = async (
  filePath: string,
  initialContent: string,
) => {
  try {
    await writeFile(filePath, initialContent, { flag: "wx" });
  } catch (error: unknown) {
    if ((error as NodeError).code === "EEXIST") {
      return;
    }

    throw error;
  }
};

export const initializeLocalStorage = async (
  dataDir: string,
): Promise<LocalStorageLayout> => {
  // Local MVP data lives under API_DATA_DIR, which defaults to the repo `.data` directory.
  const layout = createLocalStorageLayout(dataDir);

  await mkdir(layout.dataDir, { recursive: true });
  await Promise.all([
    createStoreFileIfMissing(
      layout.stores.resources,
      INITIAL_STORE_CONTENT[LocalStoreName.Resources],
    ),
    createStoreFileIfMissing(
      layout.stores.dependencies,
      INITIAL_STORE_CONTENT[LocalStoreName.Dependencies],
    ),
    createStoreFileIfMissing(
      layout.stores.audits,
      INITIAL_STORE_CONTENT[LocalStoreName.Audits],
    ),
    createStoreFileIfMissing(
      layout.stores.scenarios,
      INITIAL_STORE_CONTENT[LocalStoreName.Scenarios],
    ),
    createStoreFileIfMissing(
      layout.stores.executionLogs,
      INITIAL_STORE_CONTENT[LocalStoreName.ExecutionLogs],
    ),
    createStoreFileIfMissing(
      layout.stores.hookDecisions,
      INITIAL_STORE_CONTENT[LocalStoreName.HookDecisions],
    ),
    createStoreFileIfMissing(
      layout.stores.executorSafetyEvidence,
      INITIAL_STORE_CONTENT[LocalStoreName.ExecutorSafetyEvidence],
    ),
    createStoreFileIfMissing(
      layout.stores.contextAdequacyEvidence,
      INITIAL_STORE_CONTENT[LocalStoreName.ContextAdequacyEvidence],
    ),
  ]);

  return layout;
};
