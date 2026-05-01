import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  DecisionType,
  RiskLevel,
  SqlScenarioFixtureId,
  sqlScenarioFixtures,
  ToolType,
} from "@agent-safety-gateway/shared";

import { createExecutionLogRepository } from "../src/execution-log-repository.js";
import { createMockSqlExecutor } from "../src/mock-tool-executors.js";
import { seedLocalData } from "../src/seed.js";
import { initializeLocalStorage } from "../src/storage.js";
import { createDefaultToolCallAnalysisService } from "../src/tool-call-analysis-service.js";
import {
  createToolExecutionGuard,
  type ToolExecutionPermitEvidenceProvider,
} from "../src/tool-execution-guard.js";

const tempDirs: string[] = [];

const createTempDataDir = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "agent-safety-gateway-data-"));
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

const getSqlScenario = (scenarioId: SqlScenarioFixtureId) => {
  const scenario = sqlScenarioFixtures.find(
    (candidate) => candidate.id === scenarioId,
  );

  if (!scenario) {
    throw new Error(`Missing SQL scenario fixture: ${scenarioId}`);
  }

  return scenario;
};

const createAuditIdFactory = () => {
  let counter = 0;

  return () => {
    counter += 1;
    return `audit-mock-executor-${counter}`;
  };
};

const createCompletePermitEvidenceProvider = (): ToolExecutionPermitEvidenceProvider => ({
  getEvidenceSnapshot() {
    return {
      safetyState: {
        stateId: "safety-state-mock-executor-sql-readonly",
        executorId: "executor-mock-sql-readonly",
        coverageMapId: "coverage-map-mock-sql-readonly",
        state: "EvidenceComplete",
        allObligationsCovered: true,
        evaluatedAt: "2026-04-28T08:10:00.000Z",
        coveredObligationIds: ["obligation-mock-sql-readonly"],
        blockedObligationIds: [],
        blockingStatuses: [],
        transitionReason: "all required obligations are covered by valid evidence",
        validUntil: "2026-04-28T08:15:00.000Z",
        coverageMapHash: "sha256:mock-executor-coverage-map",
        safetyEvidenceVersion: "sev-mock-executor-001",
      },
      deniedEvidenceHash: "sha256:mock-executor-denied-evidence",
      sideEffectEvidenceHash: "sha256:mock-executor-side-effect-evidence",
    };
  },
});

describe("mock tool executors", () => {
  it("proves blocked calls skip the executor and allowed calls write execution logs", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    await seedLocalData(layout);

    const executionLogRepository = createExecutionLogRepository(layout);
    const analysisService = createDefaultToolCallAnalysisService(layout, {
      idFactory: createAuditIdFactory(),
      now: () => new Date("2026-04-28T08:10:00.000Z"),
    });
    const guard = createToolExecutionGuard({
      analysisService,
      permitEvidenceProvider: createCompletePermitEvidenceProvider(),
      permitNonceFactory: () => "nonce-mock-executor",
      now: () => new Date("2026-04-28T08:10:01.000Z"),
      executor: createMockSqlExecutor({
        executionLogRepository,
        scenarioId: SqlScenarioFixtureId.LowRiskReadOrders,
        now: () => new Date("2026-04-28T08:10:01.000Z"),
      }),
    });

    const blockedResult = await guard.execute(
      getSqlScenario(SqlScenarioFixtureId.HighRiskDeleteOrders).request,
    );

    assert.equal(blockedResult.status, "blocked");
    assert.equal(blockedResult.executorInvoked, false);
    assert.equal(blockedResult.riskLevel, RiskLevel.Prohibited);
    assert.equal(blockedResult.decision.type, DecisionType.Block);
    assert.deepEqual(await executionLogRepository.listExecutionLogs(), []);

    const allowedResult = await guard.execute(
      getSqlScenario(SqlScenarioFixtureId.LowRiskReadOrders).request,
    );
    const executionLogs = await executionLogRepository.listExecutionLogs();

    assert.equal(allowedResult.status, "executed");
    assert.equal(allowedResult.executorInvoked, true);
    assert.equal(allowedResult.riskLevel, RiskLevel.Low);
    assert.equal(allowedResult.decision.type, DecisionType.Allow);
    assert.equal(executionLogs.length, 1);
    assert.deepEqual(executionLogs[0], {
      scenarioId: SqlScenarioFixtureId.LowRiskReadOrders,
      toolType: ToolType.Sql,
      requestId: "req-sql-read-orders-production",
      called: true,
      auditId: "audit-mock-executor-2",
      decision: DecisionType.Allow,
      environment: "production",
      timestamp: "2026-04-28T08:10:01.000Z",
      result: allowedResult.executorResult,
    });

    await executionLogRepository.clearExecutionLogs();
    assert.deepEqual(await executionLogRepository.listExecutionLogs(), []);
  });
});
