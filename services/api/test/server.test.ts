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
import { seedLocalData } from "../src/seed.js";
import { buildServer } from "../src/server.js";
import { initializeLocalStorage, type LocalStorageLayout } from "../src/storage.js";
import { createDefaultToolCallAnalysisService } from "../src/tool-call-analysis-service.js";

const servers: FastifyInstance[] = [];
const dataDirs: string[] = [];

const createTestServer = () => {
  const server = buildServer({
    config: createApiConfig({ API_LOG_LEVEL: "silent" }),
    logger: false,
  });

  servers.push(server);
  return server;
};

const createSeededLayout = async (): Promise<LocalStorageLayout> => {
  const dataDir = await mkdtemp(join(tmpdir(), "asg-server-"));
  dataDirs.push(dataDir);
  const layout = await initializeLocalStorage(dataDir);
  await seedLocalData(layout);
  return layout;
};

const createAnalysisServer = async () => {
  const layout = await createSeededLayout();
  const service = createDefaultToolCallAnalysisService(layout, {
    idFactory: () => "audit-route-1",
    now: () => new Date("2026-04-28T08:00:00.000Z"),
  });
  const server = buildServer({
    config: createApiConfig({
      API_DATA_DIR: layout.dataDir,
      API_LOG_LEVEL: "silent",
    }),
    logger: false,
    localStorageLayout: layout,
    toolCallAnalysisService: service,
  });

  servers.push(server);
  return server;
};

const getSqlDeleteFixture = () => {
  const fixture = sqlScenarioFixtures.find(
    (scenario) => scenario.id === SqlScenarioFixtureId.HighRiskDeleteOrders,
  );

  assert.ok(fixture);
  return fixture;
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(
    dataDirs.splice(0).map((dataDir) =>
      rm(dataDir, { recursive: true, force: true }),
    ),
  );
});

describe("API server", () => {
  it("returns the health status", async () => {
    const server = createTestServer();

    const response = await server.inject({ method: "GET", url: "/health" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
  });

  it("returns the unified error format for invalid requests", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/health?format=xml",
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.headers["content-type"]?.includes("application/json"), true);
    assert.equal(response.json().code, "INVALID_REQUEST");
    assert.equal(response.json().message, "Invalid request");
    assert.ok(response.json().details.validation.length > 0);
  });

  it("returns the unified error format for missing routes", async () => {
    const server = createTestServer();

    const response = await server.inject({ method: "GET", url: "/missing" });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      code: "NOT_FOUND",
      message: "Route not found",
      details: {
        method: "GET",
        url: "/missing",
      },
    });
  });

  it("analyzes a tool call before executor invocation", async () => {
    const server = await createAnalysisServer();
    const fixture = getSqlDeleteFixture();

    const response = await server.inject({
      method: "POST",
      url: "/api/tool-calls/analyze",
      payload: fixture.request,
    });
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.deepEqual(body.request, fixture.request);
    assert.equal(body.actionTuple.operation, fixture.expectedActionTuple.operation);
    assert.equal(body.actionTuple.target, fixture.expectedActionTuple.target);
    assert.equal(body.directResources[0]?.name, "orders");
    assert.ok(
      body.indirectResources.some(
        (resource: { name?: string }) => resource.name === "order-service",
      ),
    );
    assert.equal(body.riskLevel, RiskLevel.Prohibited);
    assert.equal(body.riskScore.riskLevel, RiskLevel.Prohibited);
    assert.equal(body.executionDecision.type, DecisionType.Block);
    assert.ok(body.riskFactors.length > 0);
    assert.ok(body.reasons.length > 0);
    assert.equal(body.auditId, "audit-route-1");
  });

  it("lists seeded scenarios with simulator-ready tool call requests", async () => {
    const server = await createAnalysisServer();
    const fixture = getSqlDeleteFixture();

    const response = await server.inject({ method: "GET", url: "/api/scenarios" });
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.ok(Array.isArray(body.scenarios));
    assert.equal(body.scenarios.length, 4);
    assert.deepEqual(
      body.scenarios.find(
        (scenario: { id: string }) => scenario.id === fixture.id,
      )?.toolCallRequest,
      fixture.request,
    );
  });

  it("returns seeded scenario details by id", async () => {
    const server = await createAnalysisServer();
    const fixture = getSqlDeleteFixture();

    const response = await server.inject({
      method: "GET",
      url: `/api/scenarios/${fixture.id}`,
    });
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(body.scenario.id, fixture.id);
    assert.equal(body.scenario.expectedRiskLevel, RiskLevel.Prohibited);
    assert.equal(body.scenario.expectedDecision, DecisionType.Block);
    assert.deepEqual(body.scenario.toolCallRequest, fixture.request);
  });

  it("returns 404 for missing scenarios", async () => {
    const server = await createAnalysisServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/scenarios/scenario-missing",
    });
    const body = response.json();

    assert.equal(response.statusCode, 404);
    assert.deepEqual(body, {
      code: "SCENARIO_NOT_FOUND",
      message: "Scenario not found",
      details: {
        scenarioId: "scenario-missing",
      },
    });
  });

  it("returns 400 for invalid tool call request bodies", async () => {
    const server = await createAnalysisServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/tool-calls/analyze",
      payload: {
        id: "request-invalid",
        toolType: "sql",
        environment: "production",
        rawPayload: {},
      },
    });
    const body = response.json();

    assert.equal(response.statusCode, 400);
    assert.equal(body.code, "INVALID_TOOL_CALL_REQUEST");
    assert.equal(body.message, "Invalid tool call request");
    assert.ok(body.details.issues.length > 0);
  });

  it("returns 400 for unparseable tool call payloads", async () => {
    const server = await createAnalysisServer();
    const fixture = getSqlDeleteFixture();

    const response = await server.inject({
      method: "POST",
      url: "/api/tool-calls/analyze",
      payload: {
        ...fixture.request,
        rawPayload: {},
      },
    });
    const body = response.json();

    assert.equal(response.statusCode, 400);
    assert.equal(body.code, "TOOL_CALL_ANALYSIS_FAILED");
    assert.equal(body.message, "Tool call analysis failed");
    assert.equal(body.details.errors[0]?.code, "missing_sql");
  });
});
