import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  cicdScenarioFixtures,
  configScenarioFixtures,
  DecisionType,
  RiskLevel,
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
} from "../src/tool-call-analysis-service.js";

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

    const auditRepository = createAuditRepository(layout);
    const auditRecords = await auditRepository.listAuditRecords();
    assert.equal(auditRecords.length, 1);
    assert.equal(auditRecords[0]?.id, result.auditRecordId);
    assert.equal(auditRecords[0]?.decision.type, DecisionType.Block);
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
