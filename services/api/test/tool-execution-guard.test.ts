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

import { runToolGuardDemo } from "../../../scripts/tool-guard-demo.js";
import { createFileApprovalAdapter } from "../src/approval-adapter.js";
import { ApprovalRequestStatus } from "../src/real-component-adapters.js";
import type {
  ToolCallAnalysisResult,
  ToolCallAnalysisService,
} from "../src/tool-call-analysis-service.js";
import { createToolExecutionGuard } from "../src/tool-execution-guard.js";

const tempDirs: string[] = [];

const createTempDataDir = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "asg-tool-guard-approval-"));
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

const approvalRequest: ToolCallRequest = {
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

const createApprovalAnalysisResult = (
  request: ToolCallRequest,
): ToolCallAnalysisResult => {
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
  const executionDecision: ExecutionDecision = {
    type: DecisionType.RequireApproval,
    code: "risk.high.require_approval",
    reason: "Risk level is high for payment-service production deployment.",
    recommendedAction: "Require explicit human approval before executor invocation.",
    rewrittenRequest: null,
  };

  return {
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
    executionDecision,
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
      decision: executionDecision,
      createdAt: "2026-04-29T08:00:01.000Z",
    },
  };
};

const createApprovalAnalysisService = (): ToolCallAnalysisService => ({
  async analyzeToolCall(request) {
    return createApprovalAnalysisResult(request);
  },
});

describe("tool execution guard demo", () => {
  it("blocks prohibited SQL DELETE before invoking the mock executor", async () => {
    const result = await runToolGuardDemo();

    assert.equal(result.blockedDelete.status, "blocked");
    assert.equal(result.blockedDelete.executorInvoked, false);
    assert.equal(result.blockedDelete.riskLevel, RiskLevel.Prohibited);
    assert.equal(result.blockedDelete.decisionType, DecisionType.Block);
  });

  it("invokes the mock executor once for the low-risk SQL SELECT path", async () => {
    const result = await runToolGuardDemo();

    assert.equal(result.allowedSelect.status, "executed");
    assert.equal(result.allowedSelect.executorInvoked, true);
    assert.equal(result.allowedSelect.riskLevel, RiskLevel.Low);
    assert.equal(result.allowedSelect.decisionType, DecisionType.Allow);
    assert.equal(result.executorCallCount, 1);
  });
});

describe("tool execution guard approval control", () => {
  it("creates a held approval request and does not invoke the executor", async () => {
    const filePath = join(await createTempDataDir(), "approval-requests.jsonl");
    const approvalAdapter = createFileApprovalAdapter({
      filePath,
      now: () => new Date("2026-04-29T08:00:02.000Z"),
    });
    let executorCallCount = 0;
    const guard = createToolExecutionGuard({
      analysisService: createApprovalAnalysisService(),
      approvalAdapter,
      defaultApproverGroup: "release-risk-owners",
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const result = await guard.execute(approvalRequest);

    assert.equal(result.status, "held");
    assert.equal(result.executorInvoked, false);
    assert.equal(result.executorResult, null);
    assert.equal(executorCallCount, 0);
    assert.deepEqual(result.approvalRequest, {
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
    assert.deepEqual(
      await approvalAdapter.getApprovalRequest("req-approval-production-deploy"),
      result.approvalRequest,
    );
  });

  it("invokes the executor only after the approval adapter reports approved", async () => {
    const filePath = join(await createTempDataDir(), "approval-requests.jsonl");
    const approvalAdapter = createFileApprovalAdapter({ filePath });
    const approvedRequest = {
      requestId: "req-approval-production-deploy",
      auditId: "audit-approval-production-deploy",
      actor: "agent:release-bot",
      target: "payment-service",
      riskLevel: RiskLevel.High,
      decisionReason:
        "Risk level is high for payment-service production deployment.",
      approverGroup: "release-risk-owners",
      status: ApprovalRequestStatus.Approved,
      createdAt: "2026-04-29T08:05:00.000Z",
    };

    await appendFile(filePath, `${JSON.stringify(approvedRequest)}\n`, "utf8");

    let executorCallCount = 0;
    const guard = createToolExecutionGuard({
      analysisService: createApprovalAnalysisService(),
      approvalAdapter,
      async executor(request) {
        executorCallCount += 1;
        return { ok: true, requestId: request.id };
      },
    });

    const result = await guard.execute(approvalRequest);

    assert.equal(result.status, "executed");
    assert.equal(result.executorInvoked, true);
    assert.equal(executorCallCount, 1);
    assert.deepEqual(result.approvalRequest, approvedRequest);
    assert.deepEqual(result.executorResult, {
      ok: true,
      requestId: "req-approval-production-deploy",
    });
  });
});
