import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createAuditRepository } from "./audit-repository.js";
import { createContextAdequacyEvidenceRepository } from "./context-adequacy-evidence-repository.js";
import {
  createExecutorSafetyEvidenceRepository,
  ExecutorSafetyEvidenceRecordKind,
  type ExecutorSafetyEvidenceRecord,
} from "./executor-safety-evidence-repository.js";
import { initializeLocalStorage } from "./storage.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export type PatentEvidenceExportOptions = {
  dataDir: string;
  outputRoot: string;
  bundleId?: string;
  auditIds?: readonly string[];
  requestIds?: readonly string[];
  includeAll?: boolean;
  generatedAt?: Date;
};

export type PatentEvidenceExportCounts = {
  audits: number;
  contextEvidence: number;
  sideEffectEvidence: number;
  permits: number;
  denials: number;
};

export type PatentEvidenceExportManifest = {
  bundleId: string;
  generatedAt: string;
  sourceDataDir: string;
  selectors: {
    auditIds: string[];
    requestIds: string[];
    includeAll: boolean;
  };
  resolvedSelection: {
    auditIds: string[];
    requestIds: string[];
  };
  counts: PatentEvidenceExportCounts;
  files: {
    audits: string;
    contextEvidence: string;
    sideEffectEvidence: string;
    permits: string;
    denials: string;
  };
  claimMapping: Array<{
    patentDirection: "forbidden-side-effect" | "context-retention";
    claimElements: string[];
    evidenceFiles: string[];
    codeReferences: string[];
  }>;
};

export type PatentEvidenceExportResult = {
  outputDir: string;
  manifest: PatentEvidenceExportManifest;
};

const normalizeIds = (ids: readonly string[] | undefined): string[] => [
  ...new Set((ids ?? []).map((id) => id.trim()).filter((id) => id.length > 0)),
];

const createDefaultBundleId = (generatedAt: Date): string =>
  `patent-evidence-${generatedAt.toISOString().replace(/[:.]/g, "-")}`;

const validateBundleId = (bundleId: string) => {
  if (
    bundleId.length === 0 ||
    bundleId.includes("/") ||
    bundleId.includes("\\") ||
    bundleId === "." ||
    bundleId === ".."
  ) {
    throw new Error(
      "bundleId must be a non-empty directory name without path separators.",
    );
  }
};

const writeJson = async (filePath: string, value: unknown) => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const isSelectedByAuditOrRequest = (
  record: { auditId: string; requestId: string },
  auditIds: readonly string[],
  requestIds: readonly string[],
) => auditIds.includes(record.auditId) || requestIds.includes(record.requestId);

const createBundleReadme = (manifest: PatentEvidenceExportManifest): string => `# Patent Evidence Export ${manifest.bundleId}

Generated at: ${manifest.generatedAt}

## Selection

- Audit ids: ${manifest.resolvedSelection.auditIds.length > 0 ? manifest.resolvedSelection.auditIds.map((id) => `\`${id}\``).join(", ") : "none"}
- Request ids: ${manifest.resolvedSelection.requestIds.length > 0 ? manifest.resolvedSelection.requestIds.map((id) => `\`${id}\``).join(", ") : "none"}
- Include all stores: ${manifest.selectors.includeAll ? "yes" : "no"}

## Files

- \`${manifest.files.audits}\`: selected audit records and decision traces.
- \`${manifest.files.contextEvidence}\`: selected context anchors, prompt manifests, obligations, retention evidence, sufficiency states, and context adequacy evidence.
- \`${manifest.files.sideEffectEvidence}\`: selected forbidden-effect obligations, evidence coverage records, coverage maps, and executor safety states.
- \`${manifest.files.permits}\`: selected permit bindings.
- \`${manifest.files.denials}\`: selected permit denials proving fail-closed executor behavior.

## Counts

| Record class | Count |
| --- | ---: |
| Audits | ${manifest.counts.audits} |
| Context evidence | ${manifest.counts.contextEvidence} |
| Side-effect evidence | ${manifest.counts.sideEffectEvidence} |
| Permits | ${manifest.counts.permits} |
| Denials | ${manifest.counts.denials} |
`;

export const exportPatentEvidencePackage = async (
  options: PatentEvidenceExportOptions,
): Promise<PatentEvidenceExportResult> => {
  const generatedAt = options.generatedAt ?? new Date();
  const bundleId = options.bundleId ?? createDefaultBundleId(generatedAt);
  validateBundleId(bundleId);

  const auditIds = normalizeIds(options.auditIds);
  const requestIds = normalizeIds(options.requestIds);
  const includeAll = options.includeAll === true;

  if (!includeAll && auditIds.length === 0 && requestIds.length === 0) {
    throw new Error("Select at least one audit id, request id, or --all.");
  }

  const dataDir = resolve(options.dataDir);
  const outputRoot = resolve(options.outputRoot);
  const outputDir = join(outputRoot, bundleId);
  const layout = await initializeLocalStorage(dataDir);
  const auditRepository = createAuditRepository(layout);
  const contextEvidenceRepository =
    createContextAdequacyEvidenceRepository(layout);
  const executorSafetyEvidenceRepository =
    createExecutorSafetyEvidenceRepository(layout);

  const audits = await auditRepository.listAuditRecords();
  const selectedAudits = includeAll
    ? audits
    : audits.filter(
        (audit) =>
          auditIds.includes(audit.id) || requestIds.includes(audit.request.id),
      );
  const resolvedAuditIds = normalizeIds([
    ...auditIds,
    ...selectedAudits.map((audit) => audit.id),
  ]);
  const resolvedRequestIds = normalizeIds([
    ...requestIds,
    ...selectedAudits.map((audit) => audit.request.id),
  ]);

  const contextEvidence = (
    await contextEvidenceRepository.listRecords()
  ).filter(
    (record) =>
      includeAll ||
      isSelectedByAuditOrRequest(record, resolvedAuditIds, resolvedRequestIds),
  );
  const executorSafetyEvidence = (
    await executorSafetyEvidenceRepository.listRecords()
  ).filter(
    (record) =>
      includeAll ||
      isSelectedByAuditOrRequest(record, resolvedAuditIds, resolvedRequestIds),
  );
  const sideEffectEvidence = executorSafetyEvidence.filter(
    (record) =>
      record.kind !== ExecutorSafetyEvidenceRecordKind.Permit &&
      record.kind !== ExecutorSafetyEvidenceRecordKind.Denial,
  );
  const permits = executorSafetyEvidence.filter(
    (
      record,
    ): record is Extract<
      ExecutorSafetyEvidenceRecord,
      { kind: typeof ExecutorSafetyEvidenceRecordKind.Permit }
    > => record.kind === ExecutorSafetyEvidenceRecordKind.Permit,
  );
  const denials = executorSafetyEvidence.filter(
    (
      record,
    ): record is Extract<
      ExecutorSafetyEvidenceRecord,
      { kind: typeof ExecutorSafetyEvidenceRecordKind.Denial }
    > => record.kind === ExecutorSafetyEvidenceRecordKind.Denial,
  );

  const counts: PatentEvidenceExportCounts = {
    audits: selectedAudits.length,
    contextEvidence: contextEvidence.length,
    sideEffectEvidence: sideEffectEvidence.length,
    permits: permits.length,
    denials: denials.length,
  };
  const selectedRecordCount = Object.values(counts).reduce(
    (total, count) => total + count,
    0,
  );

  if (selectedRecordCount === 0) {
    throw new Error("No patent evidence records matched the selection.");
  }

  const files = {
    audits: "audits.json",
    contextEvidence: "context-evidence.json",
    sideEffectEvidence: "side-effect-evidence.json",
    permits: "permits.json",
    denials: "denials.json",
  };
  const manifest: PatentEvidenceExportManifest = {
    bundleId,
    generatedAt: generatedAt.toISOString(),
    sourceDataDir: dataDir,
    selectors: { auditIds, requestIds, includeAll },
    resolvedSelection: {
      auditIds: resolvedAuditIds,
      requestIds: resolvedRequestIds,
    },
    counts,
    files,
    claimMapping: [
      {
        patentDirection: "forbidden-side-effect",
        claimElements: ["FSE-1", "FSE-2", "FSE-3", "FSE-4", "FSE-5", "FSE-6"],
        evidenceFiles: [
          files.audits,
          files.sideEffectEvidence,
          files.permits,
          files.denials,
        ],
        codeReferences: [
          "packages/shared/src/forbidden-side-effect.ts",
          "services/api/src/executor-safety-evidence-repository.ts",
          "services/api/src/tool-execution-guard.ts",
          "services/api/src/tool-executor-broker.ts",
        ],
      },
      {
        patentDirection: "context-retention",
        claimElements: ["CTR-1", "CTR-2", "CTR-3", "CTR-4", "CTR-5", "CTR-6"],
        evidenceFiles: [files.audits, files.contextEvidence],
        codeReferences: [
          "packages/shared/src/context-retention.ts",
          "services/api/src/context-adequacy-evidence-repository.ts",
          "services/api/src/context-execution-decision-engine.ts",
          "services/api/src/tool-execution-guard.ts",
        ],
      },
    ],
  };

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeJson(join(outputDir, "manifest.json"), manifest),
    writeJson(join(outputDir, files.audits), selectedAudits),
    writeJson(join(outputDir, files.contextEvidence), contextEvidence),
    writeJson(join(outputDir, files.sideEffectEvidence), sideEffectEvidence),
    writeJson(join(outputDir, files.permits), permits),
    writeJson(join(outputDir, files.denials), denials),
    writeFile(join(outputDir, "README.md"), createBundleReadme(manifest), "utf8"),
  ]);

  return { outputDir, manifest };
};

const splitIds = (value: string): string[] =>
  value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

const readFlagValue = (
  args: readonly string[],
  index: number,
  flag: string,
): { value: string; consumed: number } => {
  const current = args[index];
  const prefix = `${flag}=`;

  if (current?.startsWith(prefix)) {
    return { value: current.slice(prefix.length), consumed: 1 };
  }

  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return { value, consumed: 2 };
};

export const parsePatentEvidenceExportArgs = (
  args: readonly string[],
): PatentEvidenceExportOptions => {
  const auditIds: string[] = [];
  const requestIds: string[] = [];
  let dataDir = process.env.API_DATA_DIR ?? join(repositoryRoot, ".data");
  let outputRoot = join(repositoryRoot, "docs/evidence/patent-validation");
  let bundleId: string | undefined;
  let includeAll = false;

  for (let index = 0; index < args.length; ) {
    const arg = args[index];

    if (arg === "--") {
      index += 1;
      continue;
    }

    if (arg === "--all") {
      includeAll = true;
      index += 1;
      continue;
    }

    if (arg === "--audit-id" || arg?.startsWith("--audit-id=")) {
      const result = readFlagValue(args, index, "--audit-id");
      auditIds.push(...splitIds(result.value));
      index += result.consumed;
      continue;
    }

    if (arg === "--request-id" || arg?.startsWith("--request-id=")) {
      const result = readFlagValue(args, index, "--request-id");
      requestIds.push(...splitIds(result.value));
      index += result.consumed;
      continue;
    }

    if (arg === "--data-dir" || arg?.startsWith("--data-dir=")) {
      const result = readFlagValue(args, index, "--data-dir");
      dataDir = result.value;
      index += result.consumed;
      continue;
    }

    if (arg === "--out-dir" || arg?.startsWith("--out-dir=")) {
      const result = readFlagValue(args, index, "--out-dir");
      outputRoot = result.value;
      index += result.consumed;
      continue;
    }

    if (arg === "--bundle-id" || arg?.startsWith("--bundle-id=")) {
      const result = readFlagValue(args, index, "--bundle-id");
      bundleId = result.value;
      index += result.consumed;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    dataDir,
    outputRoot,
    ...(bundleId ? { bundleId } : {}),
    auditIds,
    requestIds,
    includeAll,
  };
};

const usage = `Usage: pnpm --filter @agent-safety-gateway/api patent:evidence:export -- [options]

Options:
  --audit-id <id[,id]>     Export evidence linked to one or more audit ids.
  --request-id <id[,id]>   Export evidence linked to one or more request ids.
  --all                    Export all audit, context, and executor evidence stores.
  --bundle-id <name>       Output bundle directory name.
  --data-dir <path>        Source local store directory. Defaults to API_DATA_DIR or repo .data.
  --out-dir <path>         Output root. Defaults to repo docs/evidence/patent-validation.
`;

export const runPatentEvidenceExportCli = async (
  args: readonly string[] = process.argv.slice(2),
) => {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    return;
  }

  const result = await exportPatentEvidencePackage(
    parsePatentEvidenceExportArgs(args),
  );
  console.log(
    `Exported patent evidence bundle ${result.manifest.bundleId} to ${result.outputDir}`,
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPatentEvidenceExportCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
