import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  CiCdScenarioFixtureId,
  ConfigScenarioFixtureId,
  DecisionType,
  Environment,
  ManagementPermission,
  ManagementRole,
  RiskLevel,
  SqlScenarioFixtureId,
  cicdScenarioFixtures,
  configScenarioFixtures,
  sqlScenarioFixtures,
} from "@agent-safety-gateway/shared";
import type { FastifyInstance } from "fastify";

import { createApiConfig } from "../src/config.js";
import { createExecutionLogRepository } from "../src/execution-log-repository.js";
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

const createProtectedTestServer = () => {
  const server = buildServer({
    config: createApiConfig({
      API_LOG_LEVEL: "silent",
      ASG_API_TOKEN: "gateway-token",
      ASG_CORS_ORIGIN: "https://console.example",
    }),
    logger: false,
  });

  servers.push(server);
  return server;
};

const createProtectedSeededServer = async () => {
  const layout = await createSeededLayout();
  const server = buildServer({
    config: createApiConfig({
      API_DATA_DIR: layout.dataDir,
      API_LOG_LEVEL: "silent",
      ASG_API_TOKEN: "gateway-token",
      ASG_CORS_ORIGIN: "https://console.example",
    }),
    logger: false,
    localStorageLayout: layout,
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

const createAnalysisServerContext = async () => {
  const layout = await createSeededLayout();
  let auditRecordCount = 0;
  const service = createDefaultToolCallAnalysisService(layout, {
    idFactory: () => `audit-route-${++auditRecordCount}`,
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
  return { server, layout };
};

const createAnalysisServer = async () =>
  (await createAnalysisServerContext()).server;

const getSqlDeleteFixture = () => {
  const fixture = sqlScenarioFixtures.find(
    (scenario) => scenario.id === SqlScenarioFixtureId.HighRiskDeleteOrders,
  );

  assert.ok(fixture);
  return fixture;
};

const getSqlReadFixture = () => {
  const fixture = sqlScenarioFixtures.find(
    (scenario) => scenario.id === SqlScenarioFixtureId.LowRiskReadOrders,
  );

  assert.ok(fixture);
  return fixture;
};

const getCiCdDeployFixture = () => {
  const fixture = cicdScenarioFixtures.find(
    (scenario) =>
      scenario.id === CiCdScenarioFixtureId.ProductionDeployPaymentService,
  );

  assert.ok(fixture);
  return fixture;
};

const getConfigUpdateFixture = () => {
  const fixture = configScenarioFixtures.find(
    (scenario) =>
      scenario.id === ConfigScenarioFixtureId.ProductionPaymentTimeoutUpdate,
  );

  assert.ok(fixture);
  return fixture;
};

const analyzeFixture = async (
  server: FastifyInstance,
  fixture: ReturnType<
    | typeof getSqlDeleteFixture
    | typeof getSqlReadFixture
    | typeof getCiCdDeployFixture
    | typeof getConfigUpdateFixture
  >,
) =>
  server.inject({
    method: "POST",
    url: "/api/tool-calls/analyze",
    payload: fixture.request,
  });

const appendHookDecisionRecord = async (
  layout: LocalStorageLayout,
  record: Record<string, unknown>,
) => {
  await appendFile(
    layout.stores.hookDecisions,
    `${JSON.stringify(record)}\n`,
    "utf8",
  );
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

  it("keeps local open mode unauthenticated with wildcard CORS", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/scenarios",
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["access-control-allow-origin"], "*");
    assert.equal(
      response.headers["access-control-allow-headers"],
      "Authorization,Content-Type,Accept,X-ASG-Roles",
    );
  });

  it("keeps health accessible without leaking protected config", async () => {
    const server = createProtectedTestServer();

    const response = await server.inject({ method: "GET", url: "/health" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
    assert.equal(response.body.includes("gateway-token"), false);
  });

  it("requires bearer auth for protected API routes", async () => {
    const server = createProtectedTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/scenarios",
      headers: {
        authorization: "Bearer gateway-token",
        origin: "https://console.example",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["access-control-allow-origin"],
      "https://console.example",
    );
  });

  it("rejects missing bearer auth for protected API routes", async () => {
    const server = createProtectedTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/scenarios",
      headers: {
        origin: "https://console.example",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {
      code: "UNAUTHORIZED",
      message: "Valid bearer token required",
      details: null,
    });
    assert.equal(
      response.headers["www-authenticate"],
      'Bearer realm="agent-safety-gateway"',
    );
    assert.equal(
      response.headers["access-control-allow-origin"],
      "https://console.example",
    );
  });

  it("rejects invalid bearer auth for protected API routes", async () => {
    const server = createProtectedTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/scenarios",
      headers: {
        authorization: "Bearer wrong-token",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, "UNAUTHORIZED");
  });

  it("does not default protected CORS preflight to wildcard", async () => {
    const server = buildServer({
      config: createApiConfig({
        API_LOG_LEVEL: "silent",
        ASG_API_TOKEN: "gateway-token",
      }),
      logger: false,
    });
    servers.push(server);

    const response = await server.inject({
      method: "OPTIONS",
      url: "/api/scenarios",
      headers: {
        origin: "https://console.example",
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
    assert.equal(
      response.headers["access-control-allow-headers"],
      "Authorization,Content-Type,Accept,X-ASG-Roles",
    );
  });

  it("allows viewer role to read audit evidence in protected mode", async () => {
    const server = await createProtectedSeededServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/audits",
      headers: {
        authorization: "Bearer gateway-token",
        "x-asg-roles": ManagementRole.Viewer,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { audits: [] });
  });

  it("denies viewer role from policy-management routes in protected mode", async () => {
    const server = await createProtectedSeededServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/catalog/ingest",
      headers: {
        authorization: "Bearer gateway-token",
        "x-asg-roles": ManagementRole.Viewer,
      },
      payload: { resources: [], dependencies: [] },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), {
      code: "FORBIDDEN",
      message: "Required management permission missing",
      details: {
        requiredPermission: ManagementPermission.ManagePolicies,
        roles: [ManagementRole.Viewer],
      },
    });
  });

  it("allows policy_admin role to manage catalog policy inputs", async () => {
    const server = await createProtectedSeededServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/catalog/ingest",
      headers: {
        authorization: "Bearer gateway-token",
        "x-asg-roles": ManagementRole.PolicyAdmin,
      },
      payload: {
        resources: [
          {
            id: "resource-service-rbac-policy-prod",
            name: "rbac-policy-service",
            type: "service",
            system: "security",
            environment: "production",
            sensitivityLevel: "internal",
            criticalityLevel: "medium",
            owner: "security-platform",
            rollbackCapability: "manual",
          },
        ],
        dependencies: [],
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().status, "ingested");
  });

  it("separates operator and approver management permissions", async () => {
    const server = await createProtectedSeededServer();
    const fixture = getSqlReadFixture();

    const operatorResponse = await server.inject({
      method: "POST",
      url: "/api/tool-calls/analyze",
      headers: {
        authorization: "Bearer gateway-token",
        "x-asg-roles": ManagementRole.Operator,
      },
      payload: fixture.request,
    });
    assert.equal(operatorResponse.statusCode, 200);

    const approverResponse = await server.inject({
      method: "POST",
      url: "/api/tool-calls/analyze",
      headers: {
        authorization: "Bearer gateway-token",
        "x-asg-roles": ManagementRole.Approver,
      },
      payload: fixture.request,
    });
    assert.equal(approverResponse.statusCode, 403);
    assert.deepEqual(approverResponse.json().details, {
      requiredPermission: ManagementPermission.AnalyzeToolCalls,
      roles: [ManagementRole.Approver],
    });
  });

  it("rejects unknown management roles before protected actions", async () => {
    const server = await createProtectedSeededServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/audits",
      headers: {
        authorization: "Bearer gateway-token",
        "x-asg-roles": "admin",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), {
      code: "FORBIDDEN",
      message: "Invalid management role",
      details: {
        invalidRoles: ["admin"],
        allowedRoles: [
          ManagementRole.Viewer,
          ManagementRole.Operator,
          ManagementRole.Approver,
          ManagementRole.PolicyAdmin,
          ManagementRole.Auditor,
        ],
      },
    });
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
    assert.equal(body.policyVersion, "local-risk-policy-v1");
    assert.equal(body.policyTrace.thresholds.medium, 30);
    assert.ok(
      body.policyTrace.matchedRuleIds.includes(
        "production_delete_on_critical_resource",
      ),
    );
    assert.ok(body.riskFactors.length > 0);
    assert.ok(body.reasons.length > 0);
    assert.equal(body.auditId, "audit-route-1");
  });

  it("guards SQL execution and blocks production DELETE before executor invocation", async () => {
    const server = await createAnalysisServer();
    const fixture = getSqlDeleteFixture();

    const response = await server.inject({
      method: "POST",
      url: "/api/tool-calls/sql/execute",
      payload: fixture.request,
    });
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(body.status, "blocked");
    assert.equal(body.requestId, fixture.request.id);
    assert.equal(body.auditId, "audit-route-1");
    assert.equal(body.riskLevel, RiskLevel.Prohibited);
    assert.equal(body.decision.type, DecisionType.Block);
    assert.equal(body.executorInvoked, false);
    assert.equal(body.executorResult, null);
    assert.equal(body.analysisResult.auditRecordId, "audit-route-1");
    assert.equal(body.analysisResult.riskLevel, RiskLevel.Prohibited);
    assert.equal(body.analysisResult.executionDecision.type, DecisionType.Block);
    assert.equal(body.analysisResult.policyVersion, "local-risk-policy-v1");
    assert.ok(
      body.analysisResult.policyTrace.matchedRuleIds.includes(
        "production_delete_on_critical_resource",
      ),
    );
  });

  it("returns not_configured for read-only SQL when no safe executor is configured", async () => {
    const server = await createAnalysisServer();
    const fixture = getSqlReadFixture();

    const response = await server.inject({
      method: "POST",
      url: "/api/tool-calls/sql/execute",
      payload: fixture.request,
    });
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(body.status, "not_configured");
    assert.equal(body.requestId, fixture.request.id);
    assert.equal(body.auditId, "audit-route-1");
    assert.equal(body.riskLevel, RiskLevel.Low);
    assert.equal(body.decision.type, DecisionType.Allow);
    assert.equal(body.executorInvoked, false);
    assert.equal(body.executorResult, null);
    assert.equal(body.analysisResult.auditRecordId, "audit-route-1");
    assert.equal(body.analysisResult.riskLevel, RiskLevel.Low);
    assert.equal(body.analysisResult.executionDecision.type, DecisionType.Allow);
    assert.equal(body.analysisResult.policyVersion, "local-risk-policy-v1");
    assert.equal(body.analysisResult.policyTrace.thresholds.high, 90);
  });

  it("lists audit records and filters by decision, risk, tool, and environment", async () => {
    const server = await createAnalysisServer();
    const sqlDeleteFixture = getSqlDeleteFixture();
    const sqlReadFixture = getSqlReadFixture();
    const ciCdDeployFixture = getCiCdDeployFixture();

    await analyzeFixture(server, sqlDeleteFixture);
    await analyzeFixture(server, sqlReadFixture);
    await analyzeFixture(server, ciCdDeployFixture);

    const listResponse = await server.inject({ method: "GET", url: "/api/audits" });
    const listBody = listResponse.json();

    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(
      listBody.audits.map((audit: { id: string }) => audit.id),
      ["audit-route-1", "audit-route-2", "audit-route-3"],
    );

    const allowResponse = await server.inject({
      method: "GET",
      url: "/api/audits?decision=allow",
    });
    assert.deepEqual(
      allowResponse.json().audits.map((audit: { id: string }) => audit.id),
      ["audit-route-2"],
    );

    const lowRiskResponse = await server.inject({
      method: "GET",
      url: "/api/audits?riskLevel=low",
    });
    assert.deepEqual(
      lowRiskResponse.json().audits.map((audit: { id: string }) => audit.id),
      ["audit-route-2"],
    );

    const ciCdResponse = await server.inject({
      method: "GET",
      url: "/api/audits?toolType=ci_cd",
    });
    assert.deepEqual(
      ciCdResponse.json().audits.map((audit: { id: string }) => audit.id),
      ["audit-route-3"],
    );

    const productionSqlBlockResponse = await server.inject({
      method: "GET",
      url: "/api/audits?environment=production&decision=block&toolType=sql",
    });
    assert.deepEqual(
      productionSqlBlockResponse
        .json()
        .audits.map((audit: { id: string }) => audit.id),
      ["audit-route-1"],
    );
  });

  it("lists execution logs and filters without triggering analysis", async () => {
    const { server, layout } = await createAnalysisServerContext();
    const executionLogRepository = createExecutionLogRepository(layout);
    const sqlReadFixture = getSqlReadFixture();
    const ciCdDeployFixture = getCiCdDeployFixture();

    const emptyResponse = await server.inject({
      method: "GET",
      url: "/api/execution-logs",
    });
    assert.equal(emptyResponse.statusCode, 200);
    assert.deepEqual(emptyResponse.json(), { executionLogs: [] });

    await executionLogRepository.appendExecutionLog({
      scenarioId: "evidence-sql-read",
      toolType: sqlReadFixture.request.toolType,
      requestId: sqlReadFixture.request.id,
      called: true,
      auditId: "audit-evidence-sql-read",
      decision: DecisionType.Allow,
      environment: Environment.Production,
      timestamp: "2026-04-28T08:05:00.000Z",
      result: {
        ok: true,
        auditId: "audit-evidence-sql-read",
        decision: DecisionType.Allow,
        environment: Environment.Production,
      },
    });
    await executionLogRepository.appendExecutionLog({
      scenarioId: "evidence-cicd-deploy",
      toolType: ciCdDeployFixture.request.toolType,
      requestId: ciCdDeployFixture.request.id,
      called: true,
      auditId: "audit-evidence-cicd-block",
      decision: DecisionType.Block,
      environment: Environment.Staging,
      timestamp: "2026-04-28T08:06:00.000Z",
      result: {
        ok: true,
        auditId: "audit-evidence-cicd-block",
        decision: DecisionType.Block,
        environment: Environment.Staging,
      },
    });

    const listResponse = await server.inject({
      method: "GET",
      url: "/api/execution-logs",
    });
    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(
      listResponse
        .json()
        .executionLogs.map((entry: { scenarioId: string }) => entry.scenarioId),
      ["evidence-sql-read", "evidence-cicd-deploy"],
    );

    const requestFilterResponse = await server.inject({
      method: "GET",
      url: `/api/execution-logs?requestId=${sqlReadFixture.request.id}`,
    });
    assert.deepEqual(
      requestFilterResponse
        .json()
        .executionLogs.map((entry: { scenarioId: string }) => entry.scenarioId),
      ["evidence-sql-read"],
    );

    const combinedFilterResponse = await server.inject({
      method: "GET",
      url:
        "/api/execution-logs?auditId=audit-evidence-cicd-block&toolType=ci_cd&decision=block&environment=staging",
    });
    assert.deepEqual(
      combinedFilterResponse
        .json()
        .executionLogs.map((entry: { scenarioId: string }) => entry.scenarioId),
      ["evidence-cicd-deploy"],
    );

    const emptyFilterResponse = await server.inject({
      method: "GET",
      url: "/api/execution-logs?requestId=req-missing",
    });
    assert.deepEqual(emptyFilterResponse.json(), { executionLogs: [] });

    const invalidFilterResponse = await server.inject({
      method: "GET",
      url: "/api/execution-logs?decision=unknown",
    });
    assert.equal(invalidFilterResponse.statusCode, 400);
    assert.equal(invalidFilterResponse.json().code, "INVALID_REQUEST");

    const auditResponse = await server.inject({ method: "GET", url: "/api/audits" });
    assert.deepEqual(auditResponse.json(), { audits: [] });
  });

  it("lists hook decisions and filters without triggering analysis", async () => {
    const { server, layout } = await createAnalysisServerContext();
    const sqlDeleteFixture = getSqlDeleteFixture();
    const sqlReadFixture = getSqlReadFixture();

    const emptyResponse = await server.inject({
      method: "GET",
      url: "/api/hook-decisions",
    });
    assert.equal(emptyResponse.statusCode, 200);
    assert.deepEqual(emptyResponse.json(), { hookDecisions: [] });

    await appendHookDecisionRecord(layout, {
      id: "hook-evidence-sql-delete",
      toolName: "Bash",
      commandSummary: "psql -c DELETE FROM orders",
      cwd: "/workspace",
      adaptedRequest: sqlDeleteFixture.request,
      blockReason: "Production DELETE was blocked by gateway analysis.",
      shouldBlock: true,
      createdAt: "2026-04-28T08:07:00.000Z",
      auditId: "audit-hook-sql-delete",
    });
    await appendHookDecisionRecord(layout, {
      id: "hook-evidence-local-block",
      toolName: "Bash",
      commandSummary: "rm -rf /",
      cwd: "/workspace",
      adaptedRequest: null,
      blockReason: "Local destructive command was blocked before adaptation.",
      shouldBlock: true,
      createdAt: "2026-04-28T08:08:00.000Z",
      auditId: null,
    });
    await appendHookDecisionRecord(layout, {
      id: "hook-evidence-sql-read",
      toolName: "functions.exec_command",
      commandSummary: "psql -c SELECT COUNT(*) FROM orders",
      cwd: null,
      adaptedRequest: sqlReadFixture.request,
      blockReason: "Allowed hook decision evidence sample.",
      shouldBlock: false,
      createdAt: "2026-04-28T08:09:00.000Z",
      auditId: "audit-hook-sql-read",
    });

    const listResponse = await server.inject({
      method: "GET",
      url: "/api/hook-decisions",
    });
    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(
      listResponse
        .json()
        .hookDecisions.map((record: { id: string }) => record.id),
      [
        "hook-evidence-sql-delete",
        "hook-evidence-local-block",
        "hook-evidence-sql-read",
      ],
    );

    const requestFilterResponse = await server.inject({
      method: "GET",
      url: `/api/hook-decisions?requestId=${sqlDeleteFixture.request.id}`,
    });
    assert.deepEqual(
      requestFilterResponse
        .json()
        .hookDecisions.map((record: { id: string }) => record.id),
      ["hook-evidence-sql-delete"],
    );

    const falseFilterResponse = await server.inject({
      method: "GET",
      url:
        "/api/hook-decisions?shouldBlock=false&toolName=functions.exec_command&environment=production",
    });
    assert.deepEqual(
      falseFilterResponse
        .json()
        .hookDecisions.map((record: { id: string }) => record.id),
      ["hook-evidence-sql-read"],
    );

    const auditFilterResponse = await server.inject({
      method: "GET",
      url: "/api/hook-decisions?auditId=audit-hook-sql-delete&shouldBlock=true",
    });
    assert.deepEqual(
      auditFilterResponse
        .json()
        .hookDecisions.map((record: { id: string }) => record.id),
      ["hook-evidence-sql-delete"],
    );

    const emptyFilterResponse = await server.inject({
      method: "GET",
      url: "/api/hook-decisions?requestId=req-missing",
    });
    assert.deepEqual(emptyFilterResponse.json(), { hookDecisions: [] });

    const invalidFilterResponse = await server.inject({
      method: "GET",
      url: "/api/hook-decisions?shouldBlock=maybe",
    });
    assert.equal(invalidFilterResponse.statusCode, 400);
    assert.equal(invalidFilterResponse.json().code, "INVALID_REQUEST");

    const auditResponse = await server.inject({ method: "GET", url: "/api/audits" });
    assert.deepEqual(auditResponse.json(), { audits: [] });
  });

  it("returns diagnostics metrics without triggering analysis or executors", async () => {
    const { server, layout } = await createAnalysisServerContext();
    const executionLogRepository = createExecutionLogRepository(layout);
    const sqlDeleteFixture = getSqlDeleteFixture();
    const sqlReadFixture = getSqlReadFixture();

    await analyzeFixture(server, sqlDeleteFixture);
    await analyzeFixture(server, sqlReadFixture);
    await executionLogRepository.appendExecutionLog({
      scenarioId: "diagnostics-sql-read",
      toolType: sqlReadFixture.request.toolType,
      requestId: sqlReadFixture.request.id,
      called: true,
      auditId: "audit-route-2",
      decision: DecisionType.Allow,
      environment: Environment.Production,
      timestamp: "2026-04-28T08:10:00.000Z",
      result: {
        ok: true,
        executorStatus: "configured",
      },
    });
    await executionLogRepository.appendExecutionLog({
      scenarioId: "diagnostics-sql-not-configured",
      toolType: sqlReadFixture.request.toolType,
      requestId: "req-diagnostics-sql-not-configured",
      called: false,
      auditId: "audit-diagnostics-sql-not-configured",
      decision: DecisionType.Allow,
      environment: Environment.Production,
      timestamp: "2026-04-28T08:11:00.000Z",
      result: {
        executorStatus: "not_configured",
        message: "Readonly SQL executor is not configured.",
      },
    });
    await appendHookDecisionRecord(layout, {
      id: "hook-diagnostics-sql-delete",
      toolName: "Bash",
      commandSummary: "psql -c DELETE FROM orders",
      cwd: "/workspace",
      adaptedRequest: sqlDeleteFixture.request,
      blockReason:
        "agent-safety-gateway decision=block risk=prohibited code=risk.prohibited.block.",
      shouldBlock: true,
      createdAt: "2026-04-28T08:12:00.000Z",
      auditId: "audit-route-1",
    });
    await appendHookDecisionRecord(layout, {
      id: "hook-diagnostics-fail-closed",
      toolName: "Bash",
      commandSummary: "psql -c DROP TABLE orders",
      cwd: "/workspace",
      adaptedRequest: sqlDeleteFixture.request,
      blockReason:
        "agent-safety-gateway could not analyze a high-risk Codex Bash command, so the hook failed closed. timeout",
      shouldBlock: true,
      createdAt: "2026-04-28T08:13:00.000Z",
      auditId: null,
    });
    await appendHookDecisionRecord(layout, {
      id: "hook-diagnostics-sql-read",
      toolName: "functions.exec_command",
      commandSummary: "psql -c SELECT COUNT(*) FROM orders",
      cwd: null,
      adaptedRequest: sqlReadFixture.request,
      blockReason: "Allowed hook decision evidence sample.",
      shouldBlock: false,
      createdAt: "2026-04-28T08:14:00.000Z",
      auditId: "audit-route-2",
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/diagnostics",
    });
    const diagnostics = response.json().diagnostics;

    assert.equal(response.statusCode, 200);
    assert.match(diagnostics.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(diagnostics.decisions.total, 2);
    assert.equal(diagnostics.decisions.byType[DecisionType.Block], 1);
    assert.equal(diagnostics.decisions.byType[DecisionType.Allow], 1);
    assert.equal(diagnostics.decisions.normalBlocks, 1);
    assert.equal(diagnostics.decisions.failClosedBlocks, 0);
    assert.equal(diagnostics.risks.byLevel[RiskLevel.Prohibited], 1);
    assert.equal(diagnostics.risks.byLevel[RiskLevel.Low], 1);
    assert.deepEqual(diagnostics.hooks, {
      total: 3,
      blocked: 2,
      allowed: 1,
      normalBlocks: 1,
      failClosedBlocks: 1,
      gatewayAnalyzedBlocks: 1,
      localBlocks: 0,
    });
    assert.equal(diagnostics.executors.totalLogs, 2);
    assert.equal(diagnostics.executors.invoked, 1);
    assert.equal(diagnostics.executors.notInvoked, 1);
    assert.equal(diagnostics.executors.failClosed, 1);
    assert.deepEqual(diagnostics.executors.byToolType[sqlReadFixture.request.toolType], {
      total: 2,
      invoked: 1,
      notInvoked: 1,
    });
    assert.deepEqual(diagnostics.failClosedEvents, {
      total: 2,
      audits: 0,
      hooks: 1,
      executors: 1,
      byReason: {
        hook_fail_closed: 1,
        not_configured: 1,
      },
    });
    assert.deepEqual(diagnostics.adapters.summary, {
      total: 6,
      ready: 0,
      notConfigured: 6,
      unreachable: 0,
    });
    assert.deepEqual(
      diagnostics.adapters.health.map(
        (entry: { adapterKind: string; status: string }) => [
          entry.adapterKind,
          entry.status,
        ],
      ),
      [
        ["agent_runtime", "not_configured"],
        ["sql_dry_run", "not_configured"],
        ["cicd_dry_run", "not_configured"],
        ["config_sandbox", "not_configured"],
        ["approval", "not_configured"],
        ["audit_sink", "not_configured"],
      ],
    );

    const auditResponse = await server.inject({ method: "GET", url: "/api/audits" });
    const executionLogResponse = await server.inject({
      method: "GET",
      url: "/api/execution-logs",
    });
    assert.equal(auditResponse.json().audits.length, 2);
    assert.equal(executionLogResponse.json().executionLogs.length, 2);
  });

  it("returns complete audit details by id", async () => {
    const server = await createAnalysisServer();
    const fixture = getSqlDeleteFixture();
    const analyzeResponse = await analyzeFixture(server, fixture);
    const auditId = analyzeResponse.json().auditId;

    const detailResponse = await server.inject({
      method: "GET",
      url: `/api/audits/${auditId}`,
    });
    const body = detailResponse.json();

    assert.equal(detailResponse.statusCode, 200);
    assert.equal(body.audit.id, auditId);
    assert.deepEqual(body.audit.request, fixture.request);
    assert.equal(body.audit.actionTuple.operation, fixture.expectedActionTuple.operation);
    assert.equal(body.audit.riskLevel, RiskLevel.Prohibited);
    assert.equal(body.audit.decision.type, DecisionType.Block);
    assert.equal(body.audit.policyVersion, "local-risk-policy-v1");
    assert.ok(
      body.audit.policyTrace.matchedRuleIds.includes(
        "production_delete_on_critical_resource",
      ),
    );
    assert.ok(body.audit.directResources.length > 0);
    assert.ok(body.audit.indirectResources.length > 0);
    assert.ok(body.audit.impactPaths.length > 0);
    assert.ok(body.audit.riskFactors.length > 0);
    assert.equal(body.audit.createdAt, "2026-04-28T08:00:00.000Z");
  });

  it("applies API redaction config before audit records are persisted", async () => {
    const layout = await createSeededLayout();
    const server = buildServer({
      config: createApiConfig({
        API_DATA_DIR: layout.dataDir,
        API_LOG_LEVEL: "silent",
        ASG_AUDIT_REDACTION_FIELDS: "connection",
        ASG_AUDIT_REDACTION_REPLACEMENT: "[MASKED]",
      }),
      logger: false,
      localStorageLayout: layout,
    });
    servers.push(server);
    const fixture = getSqlReadFixture();
    const request = {
      ...fixture.request,
      rawPayload: {
        ...fixture.request.rawPayload,
        apiToken: "token-live-123",
        authorization: "Bearer live-token",
        connection: "prod-primary",
        connectionString: "postgres://user:pass@db.example/orders",
      },
    };

    const analyzeResponse = await server.inject({
      method: "POST",
      url: "/api/tool-calls/analyze",
      payload: request,
    });
    const auditId = analyzeResponse.json().auditId;
    const auditResponse = await server.inject({
      method: "GET",
      url: `/api/audits/${auditId}`,
    });
    const rawStoreContent = await readFile(layout.stores.audits, "utf8");

    assert.equal(analyzeResponse.statusCode, 200);
    assert.equal(auditResponse.statusCode, 200);
    assert.equal(auditResponse.json().audit.request.rawPayload.apiToken, "[MASKED]");
    assert.equal(auditResponse.json().audit.request.rawPayload.authorization, "[MASKED]");
    assert.equal(auditResponse.json().audit.request.rawPayload.connection, "[MASKED]");
    assert.equal(auditResponse.json().audit.request.rawPayload.connectionString, "[MASKED]");
    assert.equal(rawStoreContent.includes("token-live-123"), false);
    assert.equal(rawStoreContent.includes("postgres://user:pass@db.example/orders"), false);
  });

  it("returns 404 for missing audit records", async () => {
    const server = await createAnalysisServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/audits/audit-missing",
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      code: "AUDIT_NOT_FOUND",
      message: "Audit record not found",
      details: {
        auditId: "audit-missing",
      },
    });
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

  it("ingests catalog manifests through the API", async () => {
    const { server, layout } = await createAnalysisServerContext();

    const response = await server.inject({
      method: "POST",
      url: "/api/catalog/ingest",
      payload: {
        serviceId: "ledger-service",
        system: "finance",
        owner: "finance-platform",
        environment: "production",
        criticalityLevel: "high",
        sensitivityLevel: "confidential",
        rollbackCapability: "manual",
        resources: [
          {
            id: "resource-db-table-ledger-prod",
            name: "ledger",
            type: "database_table",
            system: "finance",
            environment: "production",
            sensitivityLevel: "restricted",
            criticalityLevel: "critical",
            owner: "finance-platform",
            rollbackCapability: "manual",
          },
        ],
        dataDependencies: [
          {
            resourceId: "resource-db-table-ledger-prod",
            relationType: "reads_from",
          },
        ],
      },
    });
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(body.status, "ingested");
    assert.equal(body.summary.resources.created, 2);
    assert.equal(body.summary.dependencies.created, 1);

    const resources = JSON.parse(
      await readFile(layout.stores.resources, "utf8"),
    ) as { id: string; owner: string }[];
    const service = resources.find(
      (resource) => resource.id === "resource-service-ledger-service-prod",
    );
    assert.equal(service?.owner, "finance-platform");
  });

  it("returns structured catalog ingest errors", async () => {
    const server = await createAnalysisServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/catalog/ingest",
      payload: {
        resources: [
          {
            id: "resource-service-orphan-prod",
            name: "orphan-service",
            type: "service",
            system: "platform",
            environment: "production",
            sensitivityLevel: "internal",
            criticalityLevel: "medium",
            owner: "platform",
            rollbackCapability: "manual",
          },
        ],
        dependencies: [
          {
            sourceResourceId: "resource-service-orphan-prod",
            targetResourceId: "resource-service-missing-prod",
            relationType: "depends_on",
            direction: "downstream",
            environment: "production",
            enabled: true,
          },
        ],
      },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), {
      code: "INVALID_CATALOG_MANIFEST",
      message: "Catalog manifest validation failed",
      details: {
        issues: [
          {
            path: "$.dependencies[0].targetResourceId",
            code: "unknown_dependency_resource",
            message:
              "Dependency targetResourceId does not reference a known catalog resource.",
            details: {
              resourceId: "resource-service-missing-prod",
            },
          },
        ],
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
