import assert from "node:assert/strict";
import { appendFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  DecisionType,
  Environment,
  OperationType,
  RiskLevel,
  ToolType,
  type ActionTuple,
  type ExecutionDecision,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

import {
  createFileApprovalAdapter,
  isApprovalRequest,
} from "../src/approval-adapter.js";
import {
  AdapterHealthStatus,
  ApprovalRequestStatus,
  RealComponentAdapterKind,
} from "../src/real-component-adapters.js";
import type { ToolCallAnalysisResult } from "../src/tool-call-analysis-service.js";

const tempDirs: string[] = [];

const createTempDataDir = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "asg-approval-adapter-"));
  tempDirs.push(tempDir);
  return tempDir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) =>
      rm(tempDir, { recursive: true, force: true }),
    ),
  );
});

const request: ToolCallRequest = {
  id: "req-approval-production-deploy",
  actor: "agent:release-bot",
  taskPurpose: "Deploy payment-service to production",
  toolType: ToolType.CiCd,
  rawPayload: {
    service: "payment-service",
    version: "2.0.0",
  },
  environment: Environment.Production,
  createdAt: "2026-04-29T08:00:00.000Z",
};

const actionTuple: ActionTuple = {
  actor: request.actor,
  taskPurpose: request.taskPurpose,
  toolType: request.toolType,
  operation: OperationType.Deploy,
  target: "payment-service",
  parameters: {
    service: "payment-service",
    version: "2.0.0",
  },
  environment: request.environment,
  timestamp: request.createdAt,
};

const decision: ExecutionDecision = {
  type: DecisionType.RequireApproval,
  code: "risk.high.require_approval",
  reason: "Risk level is high for payment-service production deployment.",
  recommendedAction: "Require explicit human approval before executor invocation.",
  rewrittenRequest: null,
};

const analysisResult: ToolCallAnalysisResult = {
  request,
  actionTuple,
  directResources: [],
  indirectResources: [],
  impactPaths: [],
  riskFactors: [],
  riskScore: {
    riskLevel: RiskLevel.High,
    score: 95,
    explanation: "Risk level is high from weighted score 95.",
    reasons: ["Production deploy requires risk owner review."],
    appliedHardRules: [],
  },
  riskLevel: RiskLevel.High,
  executionDecision: decision,
  auditRecordId: "audit-approval-production-deploy",
  auditRecord: {
    id: "audit-approval-production-deploy",
    request,
    actionTuple,
    directResources: [],
    indirectResources: [],
    impactPaths: [],
    riskFactors: [],
    riskLevel: RiskLevel.High,
    decision,
    createdAt: "2026-04-29T08:00:01.000Z",
  },
};

describe("file approval adapter", () => {
  it("creates and reads durable held approval requests", async () => {
    const filePath = join(await createTempDataDir(), "approval-requests.jsonl");
    const adapter = createFileApprovalAdapter({
      filePath,
      now: () => new Date("2026-04-29T08:00:02.000Z"),
    });

    const approvalRequest = await adapter.createApprovalRequest({
      request,
      analysisResult,
      approverGroup: "release-risk-owners",
    });

    assert.deepEqual(approvalRequest, {
      requestId: "req-approval-production-deploy",
      auditId: "audit-approval-production-deploy",
      actor: "agent:release-bot",
      target: "payment-service",
      riskLevel: RiskLevel.High,
      decisionReason:
        "Risk level is high for payment-service production deployment.",
      approverGroup: "release-risk-owners",
      status: ApprovalRequestStatus.Held,
      createdAt: "2026-04-29T08:00:02.000Z",
    });
    assert.equal(isApprovalRequest(approvalRequest), true);
    assert.deepEqual(
      await adapter.getApprovalRequest("req-approval-production-deploy"),
      approvalRequest,
    );

    const health = await adapter.health();
    assert.equal(health.adapterKind, RealComponentAdapterKind.Approval);
    assert.equal(health.status, AdapterHealthStatus.Ready);
    assert.deepEqual(health.details.durable, true);
  });

  it("reads the latest approval status for an existing request", async () => {
    const filePath = join(await createTempDataDir(), "approval-requests.jsonl");
    const adapter = createFileApprovalAdapter({ filePath });
    const heldRequest = await adapter.createApprovalRequest({
      request,
      analysisResult,
      approverGroup: "release-risk-owners",
    });
    const approvedRequest = {
      ...heldRequest,
      status: ApprovalRequestStatus.Approved,
      createdAt: "2026-04-29T08:05:00.000Z",
    };

    await appendFile(filePath, `${JSON.stringify(approvedRequest)}\n`, "utf8");

    assert.deepEqual(
      await adapter.getApprovalRequest("req-approval-production-deploy"),
      approvedRequest,
    );
  });
});
