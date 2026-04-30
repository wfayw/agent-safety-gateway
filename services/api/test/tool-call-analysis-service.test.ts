import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  cicdScenarioFixtures,
  configScenarioFixtures,
  DecisionType,
  Environment,
  OperationType,
  RiskLevel,
  RiskFactorCategory,
  sqlScenarioFixtures,
  ToolType,
  type Scenario,
} from "@agent-safety-gateway/shared";

import { createAuditRepository } from "../src/audit-repository.js";
import { seedLocalData } from "../src/seed.js";
import { initializeLocalStorage, type LocalStorageLayout } from "../src/storage.js";
import {
  createDefaultToolCallAnalysisService,
  ToolCallAnalysisError,
  type ToolCallAnalysisResult,
} from "../src/tool-call-analysis-service.js";
import { DEFAULT_LOCAL_POLICY_VERSION } from "../src/risk-level-scorer.js";

const dataDirs: string[] = [];

const createSeededLayout = async (): Promise<LocalStorageLayout> => {
  const dataDir = await mkdtemp(join(tmpdir(), "asg-analysis-"));
  dataDirs.push(dataDir);
  const layout = await initializeLocalStorage(dataDir);
  await seedLocalData(layout);
  return layout;
};

const createAuditIdFactory = () => {
  let counter = 0;

  return () => {
    counter += 1;
    return `audit-test-${counter}`;
  };
};

const findScenario = (
  scenarios: readonly Scenario[],
  toolType: ToolType,
  riskLevel: RiskLevel,
) => {
  const scenario = scenarios.find(
    (candidate) =>
      candidate.request.toolType === toolType &&
      candidate.expectedRiskLevel === riskLevel,
  );

  assert.ok(scenario);
  return scenario;
};

const assertActionMatchesFixture = (
  actual: Scenario["expectedActionTuple"],
  expected: Scenario["expectedActionTuple"],
) => {
  assert.equal(actual.actor, expected.actor);
  assert.equal(actual.taskPurpose, expected.taskPurpose);
  assert.equal(actual.toolType, expected.toolType);
  assert.equal(actual.operation, expected.operation);
  assert.equal(actual.target, expected.target);
  assert.equal(actual.environment, expected.environment);
  assert.equal(actual.timestamp, expected.timestamp);

  for (const [key, value] of Object.entries(expected.parameters)) {
    assert.deepEqual(actual.parameters[key], value);
  }
};

const assertPolicyEvidence = (result: ToolCallAnalysisResult) => {
  assert.equal(result.policyVersion, DEFAULT_LOCAL_POLICY_VERSION);
  assert.equal(result.auditRecord.policyVersion, DEFAULT_LOCAL_POLICY_VERSION);
  assert.deepEqual(result.auditRecord.policyTrace, result.policyTrace);
  assert.equal(result.riskScore.policyVersion, DEFAULT_LOCAL_POLICY_VERSION);
  assert.deepEqual(result.riskScore.policyTrace, result.policyTrace);
  assert.equal(result.policyTrace.thresholds.medium, 30);
  assert.equal(result.policyTrace.thresholds.high, 90);
  assert.equal(result.policyTrace.thresholds.prohibited, 120);
  assert.equal(result.policyTrace.weights[RiskFactorCategory.Operation], 1);
  assert.equal(
    result.policyTrace.weightedFactors.length,
    result.riskFactors.length,
  );
  assert.ok(result.policyTrace.hardRules.length > 0);
  assert.ok(result.policyTrace.matchedRuleIds.length > 0);
};

afterEach(async () => {
  await Promise.all(
    dataDirs.splice(0).map((dataDir) =>
      rm(dataDir, { recursive: true, force: true }),
    ),
  );
});

describe("tool call analysis service", () => {
  it("analyzes and audits the high-risk SQL DELETE fixture", async () => {
    const layout = await createSeededLayout();
    const service = createDefaultToolCallAnalysisService(layout, {
      idFactory: createAuditIdFactory(),
      now: () => new Date("2026-04-28T08:00:00.000Z"),
    });
    const scenario = findScenario(
      sqlScenarioFixtures,
      ToolType.Sql,
      RiskLevel.Prohibited,
    );

    const result = await service.analyzeToolCall(scenario.request);

    assertActionMatchesFixture(result.actionTuple, scenario.expectedActionTuple);
    assert.equal(result.directResources[0]?.name, "orders");
    assert.ok(
      result.indirectResources.some((resource) => resource.name === "order-service"),
    );
    assert.equal(result.riskLevel, scenario.expectedRiskLevel);
    assert.equal(result.riskScore.riskLevel, scenario.expectedRiskLevel);
    assert.equal(result.executionDecision.type, scenario.expectedDecisionType);
    assert.equal(result.executionDecision.type, DecisionType.Block);
    assert.equal(result.auditRecordId, "audit-test-1");
    assert.equal(result.auditRecord.id, result.auditRecordId);
    assert.equal(result.auditRecord.riskLevel, RiskLevel.Prohibited);
    assertPolicyEvidence(result);
    assert.ok(
      result.policyTrace.matchedRuleIds.includes(
        "production_delete_on_critical_resource",
      ),
    );

    const auditRepository = createAuditRepository(layout);
    const auditRecords = await auditRepository.listAuditRecords();
    assert.equal(auditRecords.length, 1);
    assert.equal(auditRecords[0]?.id, result.auditRecordId);
    assert.equal(auditRecords[0]?.decision.type, DecisionType.Block);
    assert.equal(auditRecords[0]?.policyVersion, DEFAULT_LOCAL_POLICY_VERSION);
    assert.deepEqual(auditRecords[0]?.policyTrace, result.policyTrace);
  });

  it("blocks expanded destructive SQL cases with explicit risk evidence", async () => {
    const layout = await createSeededLayout();
    const service = createDefaultToolCallAnalysisService(layout, {
      idFactory: createAuditIdFactory(),
    });
    const cases = [
      {
        sql: "DROP TABLE orders",
        operationKeyword: "drop",
        operation: OperationType.Delete,
        expectedFactorLabel: "Destructive SQL DROP operation",
      },
      {
        sql: "TRUNCATE orders",
        operationKeyword: "truncate",
        operation: OperationType.Delete,
        expectedFactorLabel: "Destructive SQL TRUNCATE operation",
      },
      {
        sql: "ALTER TABLE orders ADD COLUMN archived_at timestamp",
        operationKeyword: "alter",
        operation: OperationType.Update,
        expectedFactorLabel: "Destructive SQL ALTER operation",
      },
      {
        sql: "DELETE FROM orders",
        operationKeyword: "delete",
        operation: OperationType.Delete,
        expectedFactorLabel: "broad-table-delete without WHERE",
      },
    ];

    for (const testCase of cases) {
      const result = await service.analyzeToolCall({
        id: `req-${testCase.operationKeyword}-orders`,
        actor: "agent:codex",
        taskPurpose: "Validate expanded destructive SQL blocking",
        toolType: ToolType.Sql,
        rawPayload: {
          sql: testCase.sql,
          database: "orders-prod",
        },
        environment: Environment.Production,
        createdAt: "2026-04-30T12:00:00.000Z",
      });

      assert.equal(result.actionTuple.operation, testCase.operation);
      assert.equal(result.actionTuple.target, "orders");
      assert.equal(
        result.actionTuple.parameters.operationKeyword,
        testCase.operationKeyword,
      );
      assert.equal(result.riskLevel, RiskLevel.Prohibited);
      assert.equal(result.executionDecision.type, DecisionType.Block);
      assert.ok(
        result.riskFactors.some(
          (factor) => factor.label === testCase.expectedFactorLabel,
        ),
      );
    }
  });

  it("allows the low-risk SQL SELECT control fixture", async () => {
    const layout = await createSeededLayout();
    const service = createDefaultToolCallAnalysisService(layout, {
      idFactory: createAuditIdFactory(),
    });
    const scenario = findScenario(
      sqlScenarioFixtures,
      ToolType.Sql,
      RiskLevel.Low,
    );

    const result = await service.analyzeToolCall(scenario.request);

    assertActionMatchesFixture(result.actionTuple, scenario.expectedActionTuple);
    assert.equal(result.riskLevel, scenario.expectedRiskLevel);
    assert.equal(result.executionDecision.type, DecisionType.Allow);
    assert.equal(result.riskScore.appliedHardRules.length, 0);
    assertPolicyEvidence(result);
  });

  it("blocks the failed production CI/CD deploy fixture", async () => {
    const layout = await createSeededLayout();
    const service = createDefaultToolCallAnalysisService(layout, {
      idFactory: createAuditIdFactory(),
    });
    const scenario = findScenario(
      cicdScenarioFixtures,
      ToolType.CiCd,
      RiskLevel.Prohibited,
    );

    const result = await service.analyzeToolCall(scenario.request);

    assertActionMatchesFixture(result.actionTuple, scenario.expectedActionTuple);
    assert.equal(result.directResources[0]?.name, "payment-service");
    assert.equal(result.riskLevel, scenario.expectedRiskLevel);
    assert.equal(result.executionDecision.type, scenario.expectedDecisionType);
    assert.match(result.executionDecision.reason, /payment-service/);
    assertPolicyEvidence(result);
  });

  it("adds policy version and trace to approval decisions", async () => {
    const layout = await createSeededLayout();
    const service = createDefaultToolCallAnalysisService(layout, {
      idFactory: createAuditIdFactory(),
    });
    const scenario = findScenario(
      cicdScenarioFixtures,
      ToolType.CiCd,
      RiskLevel.Medium,
    );

    const result = await service.analyzeToolCall(scenario.request);

    assertActionMatchesFixture(result.actionTuple, scenario.expectedActionTuple);
    assert.equal(result.riskLevel, scenario.expectedRiskLevel);
    assert.equal(result.executionDecision.type, DecisionType.RequireApproval);
    assertPolicyEvidence(result);
  });

  it("sandboxes the production config update fixture", async () => {
    const layout = await createSeededLayout();
    const service = createDefaultToolCallAnalysisService(layout, {
      idFactory: createAuditIdFactory(),
    });
    const scenario = findScenario(
      configScenarioFixtures,
      ToolType.Config,
      RiskLevel.Medium,
    );

    const result = await service.analyzeToolCall(scenario.request);

    assertActionMatchesFixture(result.actionTuple, scenario.expectedActionTuple);
    assert.equal(result.directResources[0]?.name, "payment.timeout");
    assert.equal(result.riskLevel, scenario.expectedRiskLevel);
    assert.equal(result.executionDecision.type, DecisionType.Sandbox);
    assert.ok(result.executionDecision.rewrittenRequest);
    assertPolicyEvidence(result);
  });

  it("raises structured parse errors before impact analysis", async () => {
    const layout = await createSeededLayout();
    const service = createDefaultToolCallAnalysisService(layout);
    const scenario = findScenario(
      sqlScenarioFixtures,
      ToolType.Sql,
      RiskLevel.Low,
    );

    await assert.rejects(
      service.analyzeToolCall({
        ...scenario.request,
        rawPayload: {},
      }),
      (error: unknown) => {
        assert.ok(error instanceof ToolCallAnalysisError);
        assert.equal(error.errors[0]?.code, "missing_sql");
        return true;
      },
    );
  });
});
