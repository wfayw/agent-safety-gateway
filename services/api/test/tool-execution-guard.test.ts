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
import {
  createFileExternalAuditSinkAdapter,
  readExternalAuditSinkRecords,
} from "../src/audit-sink-adapter.js";
import {
  ApprovalRequestStatus,
  createNotConfiguredExternalAuditSinkAdapter,
} from "../src/real-component-adapters.js";
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

const policyVersion = "local-risk-policy-v1";

const policyTrace = {
  thresholds: {
    medium: 30,
    high: 90,
    prohibited: 120,
  },
  weights: {
    operation: 1,
    environment: 1,
    resource_criticality: 1,
    dependency_impact: 1,
    validation_state: 1,
    reversibility: 1,
  },
  hardRules: [
    {
      id: "production_delete_on_critical_resource",
      description: "Block production DELETE operations that touch critical resources.",
      matched: false,
    },
    {
      id: "production_deploy_with_failed_tests",
      description: "Block production deployments with failed validation tests.",
      matched: false,
    },
  ],
  matchedRuleIds: [],
  weightedFactors: [],
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
      policyVersion,
      policyTrace,
    },
    riskLevel: RiskLevel.High,
    policyVersion,
    policyTrace,
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
      policyVersion,
      policyTrace,
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

const allowedRequest: ToolCallRequest = {
  id: "req-sql-readonly-orders",
  actor: "agent:analyst",
  taskPurpose: "Read recent orders",
  toolType: ToolType.Sql,
  rawPayload: {
    sql: "SELECT * FROM orders LIMIT 10",
  },
  environment: Environment.Production,
  createdAt: "2026-04-29T08:10:00.000Z",
};

const createAllowedAnalysisResult = (
  request: ToolCallRequest,
): ToolCallAnalysisResult => {
  const actionTuple: ActionTuple = {
    actor: request.actor,
    taskPurpose: request.taskPurpose,
    toolType: request.toolType,
    operation: OperationType.Read,
    target: "orders",
    parameters: request.rawPayload,
    environment: request.environment,
    timestamp: request.createdAt,
  };
  const executionDecision: ExecutionDecision = {
    type: DecisionType.Allow,
    code: "risk.low.allow",
    reason: "Read-only SQL is allowed.",
    recommendedAction: "Execute with a readonly adapter.",
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
      riskLevel: RiskLevel.Low,
      score: 10,
      explanation: "Risk level is low from weighted score 10.",
      reasons: ["Read-only operation."],
      appliedHardRules: [],
      policyVersion,
      policyTrace,
    },
    riskLevel: RiskLevel.Low,
    policyVersion,
    policyTrace,
    executionDecision,
    auditRecordId: "audit-sql-readonly-orders",
    auditRecord: {
      id: "audit-sql-readonly-orders",
      request,
      actionTuple,
      directResources: [],
      indirectResources: [],
      impactPaths: [],
      riskFactors: [],
      riskLevel: RiskLevel.Low,
      policyVersion,
      policyTrace,
      decision: executionDecision,
      createdAt: "2026-04-29T08:10:01.000Z",
    },
  };
};

const createAllowedAnalysisService = (): ToolCallAnalysisService => ({
  async analyzeToolCall(request) {
    return createAllowedAnalysisResult(request);
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

describe("tool execution guard external audit sink", () => {
  it("continues local execution when the audit sink is not configured outside strict mode", async () => {
    let executorCallCount = 0;
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      async executor(request) {
        executorCallCount += 1;
        return { ok: true, requestId: request.id };
      },
      now: () => new Date("2026-04-29T08:10:02.000Z"),
    });

    const result = await guard.execute(allowedRequest);

    assert.equal(result.status, "executed");
    assert.equal(result.executorInvoked, true);
    assert.equal(executorCallCount, 1);
    assert.deepEqual(result.executorResult, {
      ok: true,
      requestId: "req-sql-readonly-orders",
    });
    assert.equal(result.auditSinkResult.status, "not_configured");
    assert.equal(result.auditSinkResult.ok, false);
  });

  it("appends request, analysis, executor outcome, and evidence after execution", async () => {
    const filePath = join(await createTempDataDir(), "external-audit.jsonl");
    const auditSinkAdapter = createFileExternalAuditSinkAdapter({
      filePath,
      sinkName: "company-audit-log-sandbox",
      now: () => new Date("2026-04-29T08:10:03.000Z"),
    });
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      auditSinkAdapter,
      async executor(request) {
        return { ok: true, requestId: request.id, rowCount: 10 };
      },
      now: () => new Date("2026-04-29T08:10:02.000Z"),
    });

    const result = await guard.execute(allowedRequest);
    const records = await readExternalAuditSinkRecords(filePath);

    assert.equal(result.status, "executed");
    assert.deepEqual(result.auditSinkResult, {
      ok: true,
      status: "appended",
      externalAuditId: "external-audit-sql-readonly-orders",
      evidenceUri: null,
    });
    assert.equal(records.length, 1);
    assert.deepEqual(records[0]?.request, allowedRequest);
    assert.equal(records[0]?.analysisResult.auditRecordId, result.auditId);
    assert.equal(records[0]?.executorInvoked, true);
    assert.deepEqual(records[0]?.executorResult, result.executorResult);
    assert.deepEqual(records[0]?.evidence, {
      environmentName: Environment.Production,
      runId: "audit-sql-readonly-orders",
      sourceSystem: "agent-safety-gateway",
      startedAt: "2026-04-29T08:10:01.000Z",
      completedAt: "2026-04-29T08:10:02.000Z",
      artifactUris: [],
      notes: "decision=allow; executorInvoked=true",
    });
  });

  it("fails closed before executor invocation when strict audit sink is unavailable", async () => {
    let executorCallCount = 0;
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      auditSinkAdapter: createNotConfiguredExternalAuditSinkAdapter([
        "ASG_AUDIT_SINK_URL",
      ]),
      auditSinkStrict: true,
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const result = await guard.execute(allowedRequest);

    assert.equal(result.status, "not_configured");
    assert.equal(result.executorInvoked, false);
    assert.equal(result.executorResult, null);
    assert.equal(executorCallCount, 0);
    assert.deepEqual(result.auditSinkResult, {
      ok: false,
      status: "not_configured",
      externalAuditId: null,
      evidenceUri: null,
      missingRequirements: ["ASG_AUDIT_SINK_URL"],
      message: "External audit sink is not configured: ASG_AUDIT_SINK_URL",
    });
  });
});
