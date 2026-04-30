import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { JsonObject } from "@agent-safety-gateway/shared";

import {
  AdapterHealthStatus,
  ApprovalRequestStatus,
  RealComponentAdapterKind,
  type ApprovalRequest,
  type ApprovalRequestStatus as ApprovalRequestStatusValue,
  type CreateApprovalRequestInput,
  type ExternalApprovalAdapter,
} from "./real-component-adapters.js";

export type FileApprovalAdapterOptions = {
  filePath: string;
  now?: () => Date;
};

const approvalStatuses = new Set<string>(Object.values(ApprovalRequestStatus));

type NodeError = Error & { code?: string };

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isApprovalRequestStatus = (
  status: unknown,
): status is ApprovalRequestStatusValue =>
  typeof status === "string" && approvalStatuses.has(status);

const parseApprovalRequestLine = (
  line: string,
  index: number,
): ApprovalRequest => {
  const parsedRecord = JSON.parse(line) as Partial<ApprovalRequest>;

  if (
    typeof parsedRecord.requestId !== "string" ||
    typeof parsedRecord.auditId !== "string" ||
    typeof parsedRecord.actor !== "string" ||
    typeof parsedRecord.target !== "string" ||
    typeof parsedRecord.riskLevel !== "string" ||
    typeof parsedRecord.decisionReason !== "string" ||
    typeof parsedRecord.approverGroup !== "string" ||
    !isApprovalRequestStatus(parsedRecord.status) ||
    typeof parsedRecord.createdAt !== "string"
  ) {
    throw new Error(`Invalid approval request record at line ${index + 1}.`);
  }

  return parsedRecord as ApprovalRequest;
};

const readApprovalRequests = async (
  filePath: string,
): Promise<ApprovalRequest[]> => {
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

  return lines.map(parseApprovalRequestLine);
};

const createHeldApprovalRequest = ({
  input,
  createdAt,
}: {
  input: CreateApprovalRequestInput;
  createdAt: string;
}): ApprovalRequest => ({
  requestId: input.request.id,
  auditId: input.analysisResult.auditRecordId,
  actor: input.request.actor,
  target: input.analysisResult.actionTuple.target,
  riskLevel: input.analysisResult.riskLevel,
  decisionReason: input.analysisResult.executionDecision.reason,
  approverGroup: input.approverGroup,
  status: ApprovalRequestStatus.Held,
  createdAt,
});

export const createFileApprovalAdapter = ({
  filePath,
  now = () => new Date(),
}: FileApprovalAdapterOptions): ExternalApprovalAdapter => {
  const getApprovalRequest = async (requestId: string) => {
    const approvalRequests = await readApprovalRequests(filePath);

    return (
      approvalRequests
        .filter((approvalRequest) => approvalRequest.requestId === requestId)
        .at(-1) ?? null
    );
  };

  return {
    kind: RealComponentAdapterKind.Approval,
    async createApprovalRequest(input) {
      const existingRequest = await getApprovalRequest(input.request.id);

      if (existingRequest) {
        return existingRequest;
      }

      const approvalRequest = createHeldApprovalRequest({
        input,
        createdAt: now().toISOString(),
      });

      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, `${JSON.stringify(approvalRequest)}\n`, "utf8");

      return approvalRequest;
    },
    getApprovalRequest,
    async health() {
      return {
        adapterKind: RealComponentAdapterKind.Approval,
        status: AdapterHealthStatus.Ready,
        checkedAt: now().toISOString(),
        details: {
          filePath,
          storage: "jsonl",
          durable: true,
        },
      };
    },
  };
};

export const isApprovalRequest = (value: unknown): value is ApprovalRequest => {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    typeof value.requestId === "string" &&
    typeof value.auditId === "string" &&
    typeof value.actor === "string" &&
    typeof value.target === "string" &&
    typeof value.riskLevel === "string" &&
    typeof value.decisionReason === "string" &&
    typeof value.approverGroup === "string" &&
    isApprovalRequestStatus(value.status) &&
    typeof value.createdAt === "string"
  );
};
