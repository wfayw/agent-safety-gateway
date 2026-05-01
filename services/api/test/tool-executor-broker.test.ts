import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
import type { PermitBinding } from "@agent-safety-gateway/shared/forbidden-side-effect";

import {
  createToolCallRequestHash,
  createToolExecutorBroker,
} from "../src/tool-executor-broker.js";
import type { ToolCallAnalysisResult } from "../src/tool-call-analysis-service.js";

const executorId = "executor-sql-readonly-prod";
const permitIssuedAt = "2026-04-29T08:10:00.000Z";

const request: ToolCallRequest = {
  id: "req-broker-sql-readonly-orders",
  actor: "agent:analyst",
  taskPurpose: "Read recent orders through broker",
  toolType: ToolType.Sql,
  rawPayload: {
    sql: "SELECT * FROM orders LIMIT 10",
  },
  environment: Environment.Production,
  createdAt: "2026-04-29T08:09:59.000Z",
};

const createAnalysisResult = (
  analyzedRequest: ToolCallRequest = request,
): ToolCallAnalysisResult => {
  const actionTuple: ActionTuple = {
    actor: analyzedRequest.actor,
    taskPurpose: analyzedRequest.taskPurpose,
    toolType: analyzedRequest.toolType,
    operation: OperationType.Read,
    target: "orders",
    parameters: analyzedRequest.rawPayload,
    environment: analyzedRequest.environment,
    timestamp: analyzedRequest.createdAt,
  };
  const executionDecision: ExecutionDecision = {
    type: DecisionType.Allow,
    code: "risk.low.allow",
    reason: "Read-only SQL is allowed.",
    recommendedAction: "Execute with a readonly adapter.",
    rewrittenRequest: null,
  };

  return {
    request: analyzedRequest,
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
      policyVersion: "local-risk-policy-v1",
      policyTrace: {
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
        hardRules: [],
        matchedRuleIds: [],
        weightedFactors: [],
      },
    },
    riskLevel: RiskLevel.Low,
    policyVersion: "local-risk-policy-v1",
    policyTrace: {
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
      hardRules: [],
      matchedRuleIds: [],
      weightedFactors: [],
    },
    executionDecision,
    auditRecordId: "audit-broker-sql-readonly-orders",
    auditRecord: {
      id: "audit-broker-sql-readonly-orders",
      request: analyzedRequest,
      actionTuple,
      directResources: [],
      indirectResources: [],
      impactPaths: [],
      riskFactors: [],
      riskLevel: RiskLevel.Low,
      policyVersion: "local-risk-policy-v1",
      policyTrace: {
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
        hardRules: [],
        matchedRuleIds: [],
        weightedFactors: [],
      },
      decision: executionDecision,
      createdAt: "2026-04-29T08:10:00.000Z",
    },
  };
};

const createPermitBinding = (
  overrides: Partial<PermitBinding> = {},
): PermitBinding => ({
  requestHash: createToolCallRequestHash(request),
  executorId,
  safetyEvidenceVersion: "sev-broker-001",
  coverageMapHash: "sha256:broker-coverage-map",
  deniedEvidenceHash: "sha256:broker-denied-evidence",
  sideEffectEvidenceHash: "sha256:broker-side-effect-evidence",
  ttl: 300000,
  nonce: "nonce-broker-permit",
  ...overrides,
});

describe("tool executor broker", () => {
  it("invokes the executor only when the permit binding matches and is fresh", async () => {
    let executorCallCount = 0;
    const permitBinding = createPermitBinding();
    const broker = createToolExecutorBroker({
      expectedExecutorId: executorId,
      now: () => new Date("2026-04-29T08:10:30.000Z"),
      async executor(executedRequest) {
        executorCallCount += 1;
        return { ok: true, requestId: executedRequest.id };
      },
    });

    const result = await broker.invoke({
      request,
      analysisResult: createAnalysisResult(),
      permitBinding,
      permitIssuedAt,
    });

    assert.equal(result.status, "executed");
    assert.equal(result.executorInvoked, true);
    assert.equal(executorCallCount, 1);
    assert.deepEqual(result.permitBinding, permitBinding);
    assert.deepEqual(result.executorResult, {
      ok: true,
      requestId: "req-broker-sql-readonly-orders",
    });
  });

  it("fails closed without invoking the executor when the permit binding is missing", async () => {
    let executorCallCount = 0;
    const broker = createToolExecutorBroker({
      expectedExecutorId: executorId,
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const result = await broker.invoke({
      request,
      analysisResult: createAnalysisResult(),
      permitBinding: null,
      permitIssuedAt,
    });

    assert.equal(result.status, "denied");
    assert.equal(result.denialCode, "missing_permit_binding");
    assert.equal(result.executorInvoked, false);
    assert.equal(executorCallCount, 0);
    assert.equal(result.permitDeniedEvidence.executorInvoked, false);
    assert.equal(result.permitDeniedEvidence.executorId, executorId);
  });

  it("fails closed without invoking the executor when the request binding mismatches", async () => {
    let executorCallCount = 0;
    const broker = createToolExecutorBroker({
      expectedExecutorId: executorId,
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const result = await broker.invoke({
      request,
      analysisResult: createAnalysisResult(),
      permitBinding: createPermitBinding({ requestHash: "sha256:other-request" }),
      permitIssuedAt,
    });

    assert.equal(result.status, "denied");
    assert.equal(result.denialCode, "mismatched_permit_binding");
    assert.equal(result.executorInvoked, false);
    assert.equal(executorCallCount, 0);
    assert.equal(result.permitDeniedEvidence.executorInvoked, false);
  });

  it("fails closed without invoking the executor when the executor binding mismatches", async () => {
    let executorCallCount = 0;
    const broker = createToolExecutorBroker({
      expectedExecutorId: executorId,
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const result = await broker.invoke({
      request,
      analysisResult: createAnalysisResult(),
      permitBinding: createPermitBinding({ executorId: "executor-other" }),
      permitIssuedAt,
    });

    assert.equal(result.status, "denied");
    assert.equal(result.denialCode, "mismatched_permit_binding");
    assert.equal(result.executorInvoked, false);
    assert.equal(executorCallCount, 0);
    assert.equal(result.permitDeniedEvidence.executorInvoked, false);
    assert.equal(result.permitDeniedEvidence.executorId, executorId);
  });

  it("fails closed without invoking the executor when the permit binding is stale", async () => {
    let executorCallCount = 0;
    const broker = createToolExecutorBroker({
      expectedExecutorId: executorId,
      now: () => new Date("2026-04-29T08:11:01.000Z"),
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const result = await broker.invoke({
      request,
      analysisResult: createAnalysisResult(),
      permitBinding: createPermitBinding({ ttl: 60000 }),
      permitIssuedAt,
    });

    assert.equal(result.status, "denied");
    assert.equal(result.denialCode, "stale_permit_binding");
    assert.equal(result.executorInvoked, false);
    assert.equal(executorCallCount, 0);
    assert.equal(result.permitDeniedEvidence.executorInvoked, false);
  });
});
