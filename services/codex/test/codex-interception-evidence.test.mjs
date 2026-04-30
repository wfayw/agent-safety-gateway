import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { listHookDecisions } from "../src/hook-decision-store.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const hookPath = resolve(repoRoot, "services/codex/src/pretool-hook.mjs");
const reportPath = resolve(
  repoRoot,
  "docs/evidence/real-validation/RV-005-codex-sql-delete-interception.md",
);
const summaryPath = resolve(repoRoot, "docs/evidence/real-validation/summary.md");
const tempDirs = [];
const servers = [];

const codexPreToolUsePayload = {
  tool_name: "Bash",
  tool_input: {
    command: "psql orders-prod -c \"DELETE FROM orders WHERE status='PENDING'\"",
    cwd: "/workspace/orders-service",
  },
};

const gatewayAnalysis = {
  auditId: "audit-rv-005-codex-sql-delete-interception",
  riskLevel: "prohibited",
  executionDecision: {
    type: "block",
    code: "risk.prohibited.block",
    reason: "Production SQL DELETE against orders is prohibited before executor invocation.",
    recommendedAction: "Block the Codex shell tool and do not invoke an executor.",
  },
};

const createTempDataDir = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "asg-rv-005-codex-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const createGatewayStub = async () => {
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
      reply.end(JSON.stringify(gatewayAnalysis));
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

const runHook = ({ payload, env = {} }) =>
  new Promise((resolveRun, reject) => {
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

      resolveRun({ stdout, stderr });
    });
    child.stdin.end(`${JSON.stringify(payload)}\n`);
  });

const parseHookBlock = (stdout) => JSON.parse(stdout.trim());

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

describe("RV-005 Codex SQL DELETE PreToolUse interception evidence", () => {
  it("records hook output, gateway decision fields, and executor non-invocation evidence", async () => {
    const dataDir = await createTempDataDir();
    const gateway = await createGatewayStub();

    const result = await runHook({
      payload: codexPreToolUsePayload,
      env: {
        ASG_GATEWAY_URL: gateway.gatewayUrl,
        ASG_HOOK_DECISION_DATA_DIR: dataDir,
      },
    });

    const hookOutput = parseHookBlock(result.stdout);
    const decisions = await listHookDecisions(resolve(dataDir, "hook-decisions.jsonl"));
    const persistedDecision = decisions[0];
    const gatewayRequest = gateway.requests[0];
    const evidenceRecord = {
      scenarioId: "RV-005",
      inputKind: "simulated Codex PreToolUse JSON payload",
      hookOutput,
      auditId: persistedDecision.auditId,
      decision: gatewayAnalysis.executionDecision,
      riskLevel: gatewayAnalysis.riskLevel,
      executorInvoked: false,
      adaptedRequest: persistedDecision.adaptedRequest,
    };

    assert.equal(hookOutput.should_block, true);
    assert.match(hookOutput.block_reason, /decision=block risk=prohibited/);
    assert.match(hookOutput.block_reason, /risk\.prohibited\.block/);

    assert.equal(gateway.requests.length, 1);
    assert.equal(gatewayRequest.method, "POST");
    assert.equal(gatewayRequest.url, "/api/tool-calls/analyze");
    assert.match(gatewayRequest.body.id, /^req-codex-sql-\d+-[a-f0-9]{10}$/);
    assert.equal(gatewayRequest.body.toolType, "sql");
    assert.equal(gatewayRequest.body.environment, "production");
    assert.equal(gatewayRequest.body.rawPayload.database, "orders-prod");
    assert.equal(
      gatewayRequest.body.rawPayload.sql,
      "DELETE FROM orders WHERE status='PENDING'",
    );

    assert.equal(decisions.length, 1);
    assert.equal(persistedDecision.toolName, "Bash");
    assert.match(persistedDecision.commandSummary, /DELETE FROM orders/);
    assert.equal(persistedDecision.cwd, "/workspace/orders-service");
    assert.equal(persistedDecision.shouldBlock, true);
    assert.equal(persistedDecision.auditId, "audit-rv-005-codex-sql-delete-interception");
    assert.equal(persistedDecision.adaptedRequest.toolType, "sql");
    assert.equal(persistedDecision.adaptedRequest.environment, "production");
    assert.match(persistedDecision.blockReason, /risk\.prohibited\.block/);

    assert.equal(evidenceRecord.auditId, "audit-rv-005-codex-sql-delete-interception");
    assert.equal(evidenceRecord.decision.type, "block");
    assert.equal(evidenceRecord.riskLevel, "prohibited");
    assert.equal(evidenceRecord.executorInvoked, false);

    const report = await readFile(reportPath, "utf8");
    const summary = await readFile(summaryPath, "utf8");

    assert.match(report, /RV-005/);
    assert.match(report, /simulated Codex PreToolUse JSON payload/);
    assert.match(report, /interactive Codex UI/);
    assert.match(report, /audit-rv-005-codex-sql-delete-interception/);
    assert.match(report, /should_block/);
    assert.match(report, /executorInvoked=false/);
    assert.match(report, /pnpm --filter @agent-safety-gateway\/codex exec node --test test\/codex-interception-evidence\.test\.mjs/);
    assert.match(summary, /RV-005/);
    assert.match(summary, /Codex PreToolUse SQL DELETE/);
  });
});
