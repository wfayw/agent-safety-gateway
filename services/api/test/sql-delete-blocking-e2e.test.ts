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
} from "@agent-safety-gateway/shared";
import type { FastifyInstance } from "fastify";

import { createApiConfig } from "../src/config.js";
import { createExecutionLogRepository } from "../src/execution-log-repository.js";
import { createMockSqlExecutor } from "../src/mock-tool-executors.js";
import { seedLocalData } from "../src/seed.js";
import { buildServer } from "../src/server.js";
import { initializeLocalStorage, type LocalStorageLayout } from "../src/storage.js";
import { createDefaultToolCallAnalysisService } from "../src/tool-call-analysis-service.js";
import { createToolExecutionGuard } from "../src/tool-execution-guard.js";

const dataDirs: string[] = [];
const servers: FastifyInstance[] = [];

const createSeededLayout = async (): Promise<LocalStorageLayout> => {
  const dataDir = await mkdtemp(join(tmpdir(), "asg-sql-blocking-e2e-"));
  dataDirs.push(dataDir);
  const layout = await initializeLocalStorage(dataDir);
  await seedLocalData(layout);
  return layout;
};

const createAuditIdFactory = () => {
  let counter = 0;

  return () => {
    counter += 1;
    return `audit-sql-blocking-e2e-${counter}`;
  };
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(
    dataDirs.splice(0).map((dataDir) =>
      rm(dataDir, { recursive: true, force: true }),
    ),
  );
});

describe("SQL delete blocking E2E", () => {
  it("loads the seeded high-risk scenario, blocks analysis, writes audit evidence, and keeps the SQL executor closed", async () => {
    const layout = await createSeededLayout();
    const analysisService = createDefaultToolCallAnalysisService(layout, {
      idFactory: createAuditIdFactory(),
      now: () => new Date("2026-04-28T08:00:00.000Z"),
    });
    const server = buildServer({
      config: createApiConfig({
        API_DATA_DIR: layout.dataDir,
        API_LOG_LEVEL: "silent",
      }),
      logger: false,
      localStorageLayout: layout,
      toolCallAnalysisService: analysisService,
    });
    servers.push(server);

    const scenariosResponse = await server.inject({
      method: "GET",
      url: "/api/scenarios",
    });
    const scenario = scenariosResponse
      .json()
      .scenarios.find(
        (candidate: { id: string }) =>
          candidate.id === SqlScenarioFixtureId.HighRiskDeleteOrders,
      );
    const fixture = sqlScenarioFixtures.find(
      (candidate) => candidate.id === SqlScenarioFixtureId.HighRiskDeleteOrders,
    );

    assert.equal(scenariosResponse.statusCode, 200);
    assert.ok(scenario);
    assert.ok(fixture);
    assert.deepEqual(scenario.toolCallRequest, fixture.request);

    const analyzeResponse = await server.inject({
      method: "POST",
      url: "/api/tool-calls/analyze",
      payload: scenario.toolCallRequest,
    });
    const analysisBody = analyzeResponse.json();

    assert.equal(analyzeResponse.statusCode, 200);
    assert.equal(analysisBody.riskLevel, RiskLevel.Prohibited);
    assert.equal(analysisBody.executionDecision.type, DecisionType.Block);
    assert.equal(analysisBody.directResources[0]?.name, "orders");
    assert.equal(analysisBody.actionTuple.target, "orders");
    assert.equal(analysisBody.auditId, "audit-sql-blocking-e2e-1");

    const auditResponse = await server.inject({
      method: "GET",
      url: `/api/audits/${analysisBody.auditId}`,
    });
    const auditBody = auditResponse.json();

    assert.equal(auditResponse.statusCode, 200);
    assert.equal(auditBody.audit.id, analysisBody.auditId);
    assert.equal(auditBody.audit.decision.type, DecisionType.Block);
    assert.equal(auditBody.audit.riskLevel, RiskLevel.Prohibited);
    assert.equal(auditBody.audit.directResources[0]?.name, "orders");

    const executionLogRepository = createExecutionLogRepository(layout);
    await executionLogRepository.clearExecutionLogs();
    const guard = createToolExecutionGuard({
      analysisService,
      executor: createMockSqlExecutor({
        executionLogRepository,
        scenarioId: SqlScenarioFixtureId.HighRiskDeleteOrders,
        now: () => new Date("2026-04-28T08:00:01.000Z"),
      }),
    });

    const guardedResult = await guard.execute(scenario.toolCallRequest);
    const executionLogs = await executionLogRepository.listExecutionLogs();

    assert.equal(guardedResult.status, "blocked");
    assert.equal(guardedResult.executorInvoked, false);
    assert.equal(guardedResult.decision.type, DecisionType.Block);
    assert.equal(guardedResult.riskLevel, RiskLevel.Prohibited);
    assert.deepEqual(executionLogs, []);
  });
});
