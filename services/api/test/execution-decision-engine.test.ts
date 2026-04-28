import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DecisionType,
  Environment,
  OperationType,
  RiskLevel,
  ToolType,
  type ActionTuple,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

import { createExecutionDecisionEngine } from "../src/execution-decision-engine.js";
import type { RiskLevelScore } from "../src/risk-level-scorer.js";

const createRequest = (
  overrides: Partial<ToolCallRequest> = {},
): ToolCallRequest => ({
  id: "req-decision-test",
  actor: "agent:ralph",
  taskPurpose: "Decide whether the executor may run",
  toolType: ToolType.Sql,
  rawPayload: {
    sql: "SELECT COUNT(*) FROM orders",
  },
  environment: Environment.Production,
  createdAt: "2026-04-28T06:00:00.000Z",
  ...overrides,
});

const createActionTuple = (
  overrides: Partial<ActionTuple> = {},
): ActionTuple => ({
  actor: "agent:ralph",
  taskPurpose: "Decide whether the executor may run",
  toolType: ToolType.Sql,
  operation: OperationType.Read,
  target: "orders",
  parameters: {},
  environment: Environment.Production,
  timestamp: "2026-04-28T06:00:00.000Z",
  ...overrides,
});

const createRiskScore = (
  overrides: Partial<RiskLevelScore> = {},
): RiskLevelScore => ({
  riskLevel: RiskLevel.Low,
  score: 10,
  explanation: "Risk level is low from weighted score 10.",
  reasons: ["Read-only operation: READ does not mutate orders. (0)"],
  appliedHardRules: [],
  ...overrides,
});

describe("execution decision engine", () => {
  it("maps low risk to allow", () => {
    const engine = createExecutionDecisionEngine();
    const decision = engine.decideExecution({
      request: createRequest(),
      actionTuple: createActionTuple(),
      riskScore: createRiskScore(),
    });

    assert.equal(decision.type, DecisionType.Allow);
    assert.equal(decision.code, "risk.low.allow");
    assert.match(decision.reason, /Risk level is low/);
    assert.match(decision.recommendedAction, /Allow/);
    assert.equal(decision.rewrittenRequest, null);
  });

  it("maps medium production config risk to sandbox", () => {
    const engine = createExecutionDecisionEngine();
    const decision = engine.decideExecution({
      request: createRequest({
        toolType: ToolType.Config,
        rawPayload: {
          service: "payment-service",
          key: "payment.timeout",
          value: "100ms",
        },
      }),
      actionTuple: createActionTuple({
        toolType: ToolType.Config,
        operation: OperationType.Update,
        target: "payment-service.payment.timeout",
      }),
      riskScore: createRiskScore({
        riskLevel: RiskLevel.Medium,
        score: 54,
        explanation: "Risk level is medium from weighted score 54.",
      }),
    });

    assert.equal(decision.type, DecisionType.Sandbox);
    assert.equal(decision.code, "risk.medium.sandbox_production_config");
    assert.match(decision.recommendedAction, /sandbox/i);
    assert.equal(decision.rewrittenRequest?.environment, Environment.Staging);
    assert.equal(decision.rewrittenRequest?.rawPayload.rolloutStrategy, "canary");
    assert.equal(decision.rewrittenRequest?.rawPayload.requireApproval, true);
  });

  it("maps other medium risk to approval", () => {
    const engine = createExecutionDecisionEngine();
    const decision = engine.decideExecution({
      request: createRequest({
        toolType: ToolType.CiCd,
        rawPayload: {
          service: "payment-service",
          fromVersion: "1.8.0",
          toVersion: "1.7.9",
        },
      }),
      actionTuple: createActionTuple({
        toolType: ToolType.CiCd,
        operation: OperationType.Rollback,
        target: "payment-service",
      }),
      riskScore: createRiskScore({
        riskLevel: RiskLevel.Medium,
        score: 48,
        explanation: "Risk level is medium from weighted score 48.",
      }),
    });

    assert.equal(decision.type, DecisionType.RequireApproval);
    assert.equal(decision.code, "risk.medium.require_approval");
    assert.match(decision.reason, /payment-service/);
  });

  it("maps high-risk destructive SQL to rewrite", () => {
    const engine = createExecutionDecisionEngine();
    const decision = engine.decideExecution({
      request: createRequest({
        rawPayload: {
          sql: "DELETE FROM orders WHERE status = 'PENDING'",
        },
      }),
      actionTuple: createActionTuple({
        operation: OperationType.Delete,
        target: "orders",
        parameters: {
          filter: "status = 'PENDING'",
        },
      }),
      riskScore: createRiskScore({
        riskLevel: RiskLevel.High,
        score: 95,
        explanation: "Risk level is high from weighted score 95.",
      }),
    });

    assert.equal(decision.type, DecisionType.Rewrite);
    assert.equal(decision.code, "risk.high.rewrite_destructive_sql");
    assert.match(decision.recommendedAction, /safer read-only/);
    assert.equal(
      decision.rewrittenRequest?.rawPayload.sql,
      "SELECT COUNT(*) FROM orders WHERE status = 'PENDING'",
    );
    assert.equal(decision.rewrittenRequest?.rawPayload.operation, "select");
    assert.equal(
      decision.rewrittenRequest?.rawPayload.rewriteReason,
      "destructive_sql_delete_to_select_count",
    );
    assert.equal(decision.rewrittenRequest?.rawPayload.sourceRequestId, "req-decision-test");
  });

  it("maps other high risk to approval", () => {
    const engine = createExecutionDecisionEngine();
    const decision = engine.decideExecution({
      request: createRequest({
        toolType: ToolType.CiCd,
        rawPayload: {
          service: "payment-service",
          version: "1.8.0",
        },
      }),
      actionTuple: createActionTuple({
        toolType: ToolType.CiCd,
        operation: OperationType.Deploy,
        target: "payment-service",
      }),
      riskScore: createRiskScore({
        riskLevel: RiskLevel.High,
        score: 95,
        explanation: "Risk level is high from weighted score 95.",
      }),
    });

    assert.equal(decision.type, DecisionType.RequireApproval);
    assert.equal(decision.code, "risk.high.require_approval");
    assert.match(decision.recommendedAction, /human approval/);
    assert.equal(decision.rewrittenRequest?.environment, Environment.Staging);
    assert.equal(decision.rewrittenRequest?.rawPayload.deploymentStrategy, "canary");
    assert.equal(decision.rewrittenRequest?.rawPayload.canaryPercentage, 10);
  });

  it("maps prohibited risk to block", () => {
    const engine = createExecutionDecisionEngine();
    const decision = engine.decideExecution({
      request: createRequest(),
      actionTuple: createActionTuple({ operation: OperationType.Delete }),
      riskScore: createRiskScore({
        riskLevel: RiskLevel.Prohibited,
        score: 125,
        explanation: "Risk level is prohibited because hard blocking rules matched.",
        reasons: [
          "Hard rule matched: production_delete_on_critical_resource",
        ],
        appliedHardRules: ["production_delete_on_critical_resource"],
      }),
    });

    assert.equal(decision.type, DecisionType.Block);
    assert.equal(decision.code, "risk.prohibited.block");
    assert.match(decision.reason, /hard blocking rules/);
    assert.match(decision.recommendedAction, /do not invoke/i);
    assert.equal(decision.rewrittenRequest?.rawPayload.sql, "SELECT COUNT(*) FROM orders");
  });
});
