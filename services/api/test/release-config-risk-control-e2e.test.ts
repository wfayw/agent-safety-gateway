import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  CiCdScenarioFixtureId,
  ConfigScenarioFixtureId,
  DecisionType,
  RiskLevel,
  cicdScenarioFixtures,
  configScenarioFixtures,
  type Scenario,
} from "@agent-safety-gateway/shared";
import type { FastifyInstance } from "fastify";

import { createApiConfig } from "../src/config.js";
import { createExecutionLogRepository } from "../src/execution-log-repository.js";
import {
  createMockConfigExecutor,
  createMockDeployExecutor,
} from "../src/mock-tool-executors.js";
import { seedLocalData } from "../src/seed.js";
import { buildServer } from "../src/server.js";
import { initializeLocalStorage, type LocalStorageLayout } from "../src/storage.js";
import { createDefaultToolCallAnalysisService } from "../src/tool-call-analysis-service.js";
import { createToolExecutionGuard } from "../src/tool-execution-guard.js";

const dataDirs: string[] = [];
const servers: FastifyInstance[] = [];

const createSeededLayout = async (): Promise<LocalStorageLayout> => {
  const dataDir = await mkdtemp(join(tmpdir(), "asg-release-config-e2e-"));
  dataDirs.push(dataDir);
  const layout = await initializeLocalStorage(dataDir);
  await seedLocalData(layout);
  return layout;
};

const createAuditIdFactory = () => {
  let counter = 0;

  return () => {
    counter += 1;
    return `audit-release-config-e2e-${counter}`;
  };
};

const findFixture = (
  fixtures: readonly Scenario[],
  id: string,
): Scenario => {
  const fixture = fixtures.find((candidate) => candidate.id === id);

  assert.ok(fixture);
  return fixture;
};

const findSeededScenario = async (server: FastifyInstance, id: string) => {
  const response = await server.inject({ method: "GET", url: "/api/scenarios" });
  const body = response.json();
  const scenario = body.scenarios.find(
    (candidate: { id: string }) => candidate.id === id,
  );

  assert.equal(response.statusCode, 200);
  assert.ok(scenario);
  return scenario;
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(
    dataDirs.splice(0).map((dataDir) =>
      rm(dataDir, { recursive: true, force: true }),
    ),
  );
});

describe("release and config risk-control E2E", () => {
  it("blocks failed production deploys, sandboxes production config updates, writes audits, and keeps executors closed", async () => {
    const layout = await createSeededLayout();
    const analysisService = createDefaultToolCallAnalysisService(layout, {
      idFactory: createAuditIdFactory(),
      now: () => new Date("2026-04-28T08:10:00.000Z"),
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

    const deployFixture = findFixture(
      cicdScenarioFixtures,
      CiCdScenarioFixtureId.ProductionDeployPaymentService,
    );
    const configFixture = findFixture(
      configScenarioFixtures,
      ConfigScenarioFixtureId.ProductionPaymentTimeoutUpdate,
    );

    const deployScenario = await findSeededScenario(server, deployFixture.id);
    const configScenario = await findSeededScenario(server, configFixture.id);

    assert.deepEqual(deployScenario.toolCallRequest, deployFixture.request);
    assert.deepEqual(configScenario.toolCallRequest, configFixture.request);

    const deployResponse = await server.inject({
      method: "POST",
      url: "/api/tool-calls/analyze",
      payload: deployScenario.toolCallRequest,
    });
    const deployBody = deployResponse.json();

    assert.equal(deployResponse.statusCode, 200);
    assert.equal(deployBody.riskLevel, RiskLevel.Prohibited);
    assert.equal(deployBody.executionDecision.type, DecisionType.Block);
    assert.equal(deployBody.directResources[0]?.name, "payment-service");
    assert.equal(deployBody.actionTuple.target, "payment-service");
    assert.match(deployBody.executionDecision.reason, /failed/i);
    assert.equal(deployBody.auditId, "audit-release-config-e2e-1");

    const configResponse = await server.inject({
      method: "POST",
      url: "/api/tool-calls/analyze",
      payload: configScenario.toolCallRequest,
    });
    const configBody = configResponse.json();

    assert.equal(configResponse.statusCode, 200);
    assert.equal(configBody.riskLevel, RiskLevel.Medium);
    assert.equal(configBody.executionDecision.type, DecisionType.Sandbox);
    assert.equal(configBody.directResources[0]?.name, "payment.timeout");
    assert.equal(configBody.actionTuple.target, "payment-service.payment.timeout");
    assert.ok(configBody.executionDecision.rewrittenRequest);
    assert.equal(configBody.auditId, "audit-release-config-e2e-2");

    const auditListResponse = await server.inject({
      method: "GET",
      url: "/api/audits?environment=production",
    });
    const auditListBody = auditListResponse.json();

    assert.equal(auditListResponse.statusCode, 200);
    assert.deepEqual(
      auditListBody.audits.map((audit: { id: string }) => audit.id),
      ["audit-release-config-e2e-1", "audit-release-config-e2e-2"],
    );

    const deployAuditResponse = await server.inject({
      method: "GET",
      url: `/api/audits/${deployBody.auditId}`,
    });
    const configAuditResponse = await server.inject({
      method: "GET",
      url: `/api/audits/${configBody.auditId}`,
    });

    assert.equal(deployAuditResponse.statusCode, 200);
    assert.equal(configAuditResponse.statusCode, 200);
    assert.equal(deployAuditResponse.json().audit.decision.type, DecisionType.Block);
    assert.equal(configAuditResponse.json().audit.decision.type, DecisionType.Sandbox);

    const executionLogRepository = createExecutionLogRepository(layout);
    await executionLogRepository.clearExecutionLogs();

    const deployGuard = createToolExecutionGuard({
      analysisService,
      executor: createMockDeployExecutor({
        executionLogRepository,
        scenarioId: deployFixture.id,
        now: () => new Date("2026-04-28T08:10:01.000Z"),
      }),
    });
    const configGuard = createToolExecutionGuard({
      analysisService,
      executor: createMockConfigExecutor({
        executionLogRepository,
        scenarioId: configFixture.id,
        now: () => new Date("2026-04-28T08:10:02.000Z"),
      }),
    });

    const guardedDeployResult = await deployGuard.execute(deployScenario.toolCallRequest);
    const guardedConfigResult = await configGuard.execute(configScenario.toolCallRequest);
    const executionLogs = await executionLogRepository.listExecutionLogs();

    assert.equal(guardedDeployResult.status, "blocked");
    assert.equal(guardedDeployResult.executorInvoked, false);
    assert.equal(guardedDeployResult.decision.type, DecisionType.Block);
    assert.equal(guardedDeployResult.riskLevel, RiskLevel.Prohibited);
    assert.equal(guardedConfigResult.status, "held");
    assert.equal(guardedConfigResult.executorInvoked, false);
    assert.equal(guardedConfigResult.decision.type, DecisionType.Sandbox);
    assert.equal(guardedConfigResult.riskLevel, RiskLevel.Medium);
    assert.deepEqual(executionLogs, []);
  });
});
