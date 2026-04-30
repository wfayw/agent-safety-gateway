import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { JsonObject } from "@agent-safety-gateway/shared";

import {
  redactSensitiveAuditFields,
  type AuditRedactionOptions,
} from "./audit-redaction.js";
import {
  AdapterHealthStatus,
  RealComponentAdapterKind,
  type ExternalAuditSinkAdapter,
  type ExternalAuditSinkInput,
} from "./real-component-adapters.js";

export type ExternalAuditSinkRecord = ExternalAuditSinkInput & {
  externalAuditId: string;
  sinkName: string;
  writtenAt: string;
  evidenceUri: string | null;
};

export type FileExternalAuditSinkAdapterOptions = {
  filePath: string;
  sinkName?: string;
  evidenceBaseUri?: string;
  redaction?: AuditRedactionOptions;
  idFactory?: (input: ExternalAuditSinkInput) => string;
  now?: () => Date;
};

type NodeError = Error & { code?: string };

const DEFAULT_SINK_NAME = "file-external-audit-sink";

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const defaultExternalAuditIdFactory = (input: ExternalAuditSinkInput) =>
  `external-${input.analysisResult.auditRecordId}`;

const createEvidenceUri = ({
  evidenceBaseUri,
  externalAuditId,
}: {
  evidenceBaseUri: string | undefined;
  externalAuditId: string;
}) =>
  evidenceBaseUri
    ? `${evidenceBaseUri.replace(/\/$/, "")}/${encodeURIComponent(externalAuditId)}`
    : null;

const parseExternalAuditSinkRecordLine = (
  line: string,
  index: number,
): ExternalAuditSinkRecord => {
  const parsedRecord = JSON.parse(line) as Partial<ExternalAuditSinkRecord>;

  if (
    typeof parsedRecord.externalAuditId !== "string" ||
    typeof parsedRecord.sinkName !== "string" ||
    typeof parsedRecord.writtenAt !== "string" ||
    (parsedRecord.evidenceUri !== null &&
      typeof parsedRecord.evidenceUri !== "string") ||
    !isJsonObject(parsedRecord.request) ||
    !isJsonObject(parsedRecord.analysisResult) ||
    typeof parsedRecord.executorInvoked !== "boolean" ||
    !isJsonObject(parsedRecord.evidence)
  ) {
    throw new Error(`Invalid external audit sink record at line ${index + 1}.`);
  }

  return parsedRecord as ExternalAuditSinkRecord;
};

export const readExternalAuditSinkRecords = async (
  filePath: string,
): Promise<ExternalAuditSinkRecord[]> => {
  let rawContent = "";

  try {
    rawContent = await readFile(filePath, "utf8");
  } catch (error: unknown) {
    if ((error as NodeError).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const lines = rawContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map(parseExternalAuditSinkRecordLine);
};

export const createFileExternalAuditSinkAdapter = ({
  filePath,
  sinkName = DEFAULT_SINK_NAME,
  evidenceBaseUri,
  redaction,
  idFactory = defaultExternalAuditIdFactory,
  now = () => new Date(),
}: FileExternalAuditSinkAdapterOptions): ExternalAuditSinkAdapter => ({
  kind: RealComponentAdapterKind.AuditSink,
  async appendControlEvidence(input) {
    const externalAuditId = idFactory(input);
    const evidenceUri = createEvidenceUri({ evidenceBaseUri, externalAuditId });
    const record: ExternalAuditSinkRecord = {
      ...input,
      externalAuditId,
      sinkName,
      writtenAt: now().toISOString(),
      evidenceUri,
    };
    const redactedRecord = redactSensitiveAuditFields(record, redaction);

    await mkdir(dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(redactedRecord)}\n`, "utf8");

    return {
      ok: true,
      status: "appended",
      externalAuditId,
      evidenceUri,
    };
  },
  async health() {
    return {
      adapterKind: RealComponentAdapterKind.AuditSink,
      status: AdapterHealthStatus.Ready,
      checkedAt: now().toISOString(),
      details: {
        filePath,
        sinkName,
        storage: "jsonl",
        durable: true,
      },
    };
  },
});
