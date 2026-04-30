import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { listHookDecisions } from "../src/hook-decision-store.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const hookPath = resolve(repoRoot, "services/codex/src/pretool-hook.mjs");
const tempDirs = [];
const servers = [];

const createTempDataDir = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "asg-hook-decisions-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const runHook = ({ payload, env = {} }) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hookPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
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
        reject(new Error(`Hook exited with ${code}: ${stderr}`));
        return;
      }

      resolve({ stdout, stderr });
    });
    child.stdin.end(`${JSON.stringify(payload)}\n`);
  });

const createGatewayStub = async ({ response }) => {
  const requests = [];
  const server = createServer((request, reply) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      requests.push({
        method: request.method,
        url: request.url,
        body: body ? JSON.parse(body) : null,
      });
      reply.writeHead(200, { "content-type": "application/json" });
      reply.end(JSON.stringify(response));
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

const parseHookBlock = (stdout) => JSON.parse(stdout.trim());

const sqlDeleteHookPayload = {
  tool_name: "Bash",
  tool_input: {
    command: "psql orders-prod -c \"DELETE FROM orders WHERE status='PENDING'\"",
    cwd: "/workspace/orders-service",
  },
};

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise((resolveClose) => server.close(resolveClose)),
    ),
  );
  await Promise.all(
    tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })),
  );
});

describe("Codex PreToolUse hook persistence", () => {
  it("persists gateway-backed SQL DELETE blocks with audit evidence", async () => {
    const dataDir = await createTempDataDir();
    const gateway = await createGatewayStub({
      response: {
        riskLevel: "prohibited",
        executionDecision: {
          type: "block",
          code: "PRODUCTION_SQL_DELETE_BLOCKED",
          reason: "Production DELETE from orders is prohibited.",
        },
        auditId: "audit-codex-hook-1",
      },
    });

    const result = await runHook({
      payload: sqlDeleteHookPayload,
      env: {
        ASG_GATEWAY_URL: gateway.gatewayUrl,
        ASG_HOOK_DECISION_DATA_DIR: dataDir,
      },
    });
    const block = parseHookBlock(result.stdout);
    const decisions = await listHookDecisions(resolve(dataDir, "hook-decisions.jsonl"));

    assert.equal(block.should_block, true);
    assert.match(block.block_reason, /decision=block risk=prohibited/);
    assert.equal(gateway.requests.length, 1);
    assert.equal(gateway.requests[0].url, "/api/tool-calls/analyze");
    assert.equal(gateway.requests[0].body.toolType, "sql");
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].toolName, "Bash");
    assert.match(decisions[0].commandSummary, /DELETE FROM orders/);
    assert.equal(decisions[0].cwd, "/workspace/orders-service");
    assert.equal(decisions[0].shouldBlock, true);
    assert.equal(decisions[0].auditId, "audit-codex-hook-1");
    assert.equal(decisions[0].adaptedRequest.toolType, "sql");
    assert.equal(decisions[0].adaptedRequest.environment, "production");
    assert.equal(
      decisions[0].adaptedRequest.rawPayload.sql,
      "DELETE FROM orders WHERE status='PENDING'",
    );
    assert.match(decisions[0].blockReason, /PRODUCTION_SQL_DELETE_BLOCKED/);
    assert.match(decisions[0].createdAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("persists local-only destructive host blocks without a ToolCallRequest", async () => {
    const dataDir = await createTempDataDir();

    const result = await runHook({
      payload: {
        tool_name: "Bash",
        tool_input: {
          command: "rm -rf /",
          cwd: "/workspace/unsafe",
        },
      },
      env: {
        ASG_HOOK_DECISION_DATA_DIR: dataDir,
      },
    });
    const block = parseHookBlock(result.stdout);
    const decisions = await listHookDecisions(resolve(dataDir, "hook-decisions.jsonl"));

    assert.equal(block.should_block, true);
    assert.match(block.block_reason, /destructive host command/);
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].toolName, "Bash");
    assert.equal(decisions[0].commandSummary, "rm -rf /");
    assert.equal(decisions[0].cwd, "/workspace/unsafe");
    assert.equal(decisions[0].shouldBlock, true);
    assert.equal(decisions[0].auditId, null);
    assert.equal(decisions[0].adaptedRequest, null);
    assert.match(decisions[0].blockReason, /destructive host command/);
  });
});
