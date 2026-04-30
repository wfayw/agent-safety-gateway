import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const mcpPath = resolve(repoRoot, "services/codex/src/mcp-server.mjs");
const servers = [];

const runMcp = ({ messages, env = {} }) =>
  new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [mcpPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ASG_GATEWAY_TIMEOUT_MS: "1000",
        ASG_SQL_DRY_RUN_COMMAND: "",
        ASG_CICD_DRY_RUN_COMMAND: "",
        ASG_CONFIG_SANDBOX_COMMAND: "",
        ...env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`MCP server exited with ${code}: ${stderr}`));
        return;
      }

      const responses = stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));

      resolveRun({ responses, stdout, stderr });
    });

    const input = messages
      .map((message) => (typeof message === "string" ? message : JSON.stringify(message)))
      .join("\n");

    child.stdin.end(`${input}\n`);
  });

const byId = (responses, id) => responses.find((response) => response.id === id);

const assertJsonRpcResult = (response, id) => {
  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, id);
  assert.ok(response.result);
  assert.equal(response.error, undefined);
};

const assertToolResult = (response, id) => {
  assertJsonRpcResult(response, id);
  assert.equal(response.result.content[0].type, "text");
  assert.equal(typeof response.result.content[0].text, "string");
  assert.ok(response.result.structuredContent);
};

const createGatewayStub = async ({ analyzeResponse, healthResponse = { status: "ok" } }) => {
  const requests = [];
  const server = createServer((request, reply) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      const parsedBody = body ? JSON.parse(body) : null;

      requests.push({
        method: request.method,
        url: request.url,
        body: parsedBody,
      });

      if (request.method === "GET" && request.url === "/health") {
        reply.writeHead(200, { "content-type": "application/json" });
        reply.end(JSON.stringify(healthResponse));
        return;
      }

      if (request.method === "POST" && request.url === "/api/tool-calls/analyze") {
        const response =
          typeof analyzeResponse === "function" ? analyzeResponse(parsedBody) : analyzeResponse;

        reply.writeHead(200, { "content-type": "application/json" });
        reply.end(JSON.stringify(response));
        return;
      }

      reply.writeHead(404, { "content-type": "application/json" });
      reply.end(JSON.stringify({ error: { message: `Unexpected ${request.method} ${request.url}` } }));
    });
  });

  await new Promise((resolveListen) => {
    server.listen(0, "127.0.0.1", resolveListen);
  });
  servers.push(server);

  const address = server.address();
  assert.equal(typeof address, "object");

  return {
    gatewayUrl: `http://127.0.0.1:${address.port}`,
    requests,
  };
};

const allowAnalysis = {
  riskLevel: "low",
  executionDecision: {
    type: "allow",
    code: "SAFE_TOOL_CALL_ALLOWED",
    reason: "Read-only operation is allowed.",
  },
  auditId: "audit-mcp-allow",
};

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise((resolveClose) => server.close(resolveClose)),
    ),
  );
});

describe("Codex MCP server contract", () => {
  it("responds to initialize and tools/list with JSON-RPC envelopes", async () => {
    const { responses } = await runMcp({
      messages: [
        {
          jsonrpc: "2.0",
          id: "init-1",
          method: "initialize",
          params: { protocolVersion: "2025-06-18" },
        },
        { jsonrpc: "2.0", id: "tools-1", method: "tools/list" },
      ],
    });
    const initialize = byId(responses, "init-1");
    const toolsList = byId(responses, "tools-1");

    assertJsonRpcResult(initialize, "init-1");
    assert.equal(initialize.result.protocolVersion, "2025-06-18");
    assert.equal(initialize.result.serverInfo.name, "agent-safety-gateway-codex");
    assert.equal(initialize.result.capabilities.tools.listChanged, false);

    assertJsonRpcResult(toolsList, "tools-1");
    assert.deepEqual(
      toolsList.result.tools.map((tool) => tool.name).sort(),
      [
        "analyze_tool_call",
        "gateway_health",
        "safe_config_update",
        "safe_deploy",
        "safe_sql",
      ],
    );
    assert.equal(
      toolsList.result.tools.find((tool) => tool.name === "safe_sql").inputSchema.required[0],
      "sql",
    );
  });

  it("returns gateway_health content and structuredContent", async () => {
    const gateway = await createGatewayStub({
      healthResponse: { status: "ok", service: "agent-safety-gateway" },
    });
    const { responses } = await runMcp({
      messages: [
        {
          jsonrpc: "2.0",
          id: "health-1",
          method: "tools/call",
          params: { name: "gateway_health", arguments: {} },
        },
      ],
      env: { ASG_GATEWAY_URL: gateway.gatewayUrl },
    });
    const response = byId(responses, "health-1");

    assertToolResult(response, "health-1");
    assert.equal(response.result.structuredContent.status, "ok");
    assert.equal(gateway.requests.length, 1);
    assert.equal(gateway.requests[0].method, "GET");
    assert.equal(gateway.requests[0].url, "/health");
  });

  it("returns blocked safe_sql DELETE decisions without executor invocation", async () => {
    const gateway = await createGatewayStub({
      analyzeResponse: {
        riskLevel: "prohibited",
        executionDecision: {
          type: "block",
          code: "PRODUCTION_SQL_DELETE_BLOCKED",
          reason: "Production DELETE from orders is prohibited.",
        },
        auditId: "audit-mcp-blocked-delete",
      },
    });
    const { responses } = await runMcp({
      messages: [
        {
          jsonrpc: "2.0",
          id: "sql-delete-1",
          method: "tools/call",
          params: {
            name: "safe_sql",
            arguments: {
              sql: "DELETE FROM orders WHERE status='PENDING'",
              database: "orders-prod",
              environment: "production",
            },
          },
        },
      ],
      env: { ASG_GATEWAY_URL: gateway.gatewayUrl },
    });
    const response = byId(responses, "sql-delete-1");

    assertToolResult(response, "sql-delete-1");
    assert.equal(gateway.requests[0].body.toolType, "sql");
    assert.equal(gateway.requests[0].body.rawPayload.sql, "DELETE FROM orders WHERE status='PENDING'");
    assert.equal(response.result.structuredContent.analysis.riskLevel, "prohibited");
    assert.equal(response.result.structuredContent.analysis.executionDecision.type, "block");
    assert.equal(response.result.structuredContent.executor.mode, "skipped_by_gateway");
    assert.equal(response.result.structuredContent.executor.executorInvoked, false);
  });

  it("returns allowed safe_sql SELECT with not_configured executor evidence", async () => {
    const gateway = await createGatewayStub({ analyzeResponse: allowAnalysis });
    const { responses } = await runMcp({
      messages: [
        {
          jsonrpc: "2.0",
          id: "sql-select-1",
          method: "tools/call",
          params: {
            name: "safe_sql",
            arguments: {
              sql: "SELECT COUNT(*) FROM orders",
              database: "orders-prod-readonly",
              environment: "production",
            },
          },
        },
      ],
      env: { ASG_GATEWAY_URL: gateway.gatewayUrl },
    });
    const response = byId(responses, "sql-select-1");

    assertToolResult(response, "sql-select-1");
    assert.equal(response.result.structuredContent.request.toolType, "sql");
    assert.equal(response.result.structuredContent.analysis.executionDecision.type, "allow");
    assert.equal(response.result.structuredContent.executor.mode, "not_configured");
    assert.equal(response.result.structuredContent.executor.adapterKind, "sql_dry_run");
    assert.equal(response.result.structuredContent.executor.executorInvoked, false);
  });

  it("keeps malformed JSON parse errors isolated from later requests", async () => {
    const { responses } = await runMcp({
      messages: [
        "{not-json",
        { jsonrpc: "2.0", id: "init-after-parse-error", method: "initialize" },
      ],
    });
    const parseError = responses.find((response) => response.error?.code === -32700);
    const initialize = byId(responses, "init-after-parse-error");

    assert.equal(parseError.jsonrpc, "2.0");
    assert.equal(parseError.id, null);
    assert.match(parseError.error.message, /Invalid JSON-RPC message/);
    assertJsonRpcResult(initialize, "init-after-parse-error");
  });

  it("smoke tests safe_deploy tool calls", async () => {
    const gateway = await createGatewayStub({ analyzeResponse: allowAnalysis });
    const { responses } = await runMcp({
      messages: [
        {
          jsonrpc: "2.0",
          id: "deploy-1",
          method: "tools/call",
          params: {
            name: "safe_deploy",
            arguments: {
              service: "payment-service",
              operation: "deploy",
              version: "2026.05.01",
              environment: "staging",
              testStatus: "passed",
            },
          },
        },
      ],
      env: { ASG_GATEWAY_URL: gateway.gatewayUrl },
    });
    const response = byId(responses, "deploy-1");

    assertToolResult(response, "deploy-1");
    assert.equal(gateway.requests[0].body.toolType, "ci_cd");
    assert.equal(gateway.requests[0].body.rawPayload.service, "payment-service");
    assert.equal(response.result.structuredContent.executor.mode, "not_configured");
    assert.equal(response.result.structuredContent.executor.adapterKind, "cicd_dry_run");
  });

  it("smoke tests safe_config_update tool calls", async () => {
    const gateway = await createGatewayStub({
      analyzeResponse: {
        riskLevel: "medium",
        executionDecision: {
          type: "sandbox",
          code: "CONFIG_SANDBOX_REQUIRED",
          reason: "Config updates must be staged through the sandbox adapter.",
        },
        auditId: "audit-mcp-config-sandbox",
      },
    });
    const { responses } = await runMcp({
      messages: [
        {
          jsonrpc: "2.0",
          id: "config-1",
          method: "tools/call",
          params: {
            name: "safe_config_update",
            arguments: {
              service: "payment-service",
              key: "payment.timeout_ms",
              value: 250,
              previousValue: 500,
              environment: "staging",
            },
          },
        },
      ],
      env: { ASG_GATEWAY_URL: gateway.gatewayUrl },
    });
    const response = byId(responses, "config-1");

    assertToolResult(response, "config-1");
    assert.equal(gateway.requests[0].body.toolType, "config");
    assert.equal(gateway.requests[0].body.rawPayload.key, "payment.timeout_ms");
    assert.equal(response.result.structuredContent.analysis.executionDecision.type, "sandbox");
    assert.equal(response.result.structuredContent.executor.mode, "not_configured");
    assert.equal(response.result.structuredContent.executor.adapterKind, "config_sandbox");
  });
});
