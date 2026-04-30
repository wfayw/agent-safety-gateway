import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import { DecisionType, RiskLevel } from "@agent-safety-gateway/shared";

import { createDeterministicAgentAdapter } from "../src/agent-adapter.js";
import { createAuditRepository } from "../src/audit-repository.js";
import { createExecutionLogRepository } from "../src/execution-log-repository.js";
import { createMockSqlExecutor } from "../src/mock-tool-executors.js";
import { seedLocalData } from "../src/seed.js";
import { initializeLocalStorage, type LocalStorageLayout } from "../src/storage.js";
import { createDefaultToolCallAnalysisService } from "../src/tool-call-analysis-service.js";
import { createToolExecutionGuard } from "../src/tool-execution-guard.js";

const dataDirs: string[] = [];
const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const taskPath = join(
  repoRoot,
  "sample-workspace/agent-tasks/sql-delete-pending-orders.md",
);
const reportPath = join(
  repoRoot,
  "docs/evidence/real-validation/RV-001-sql-delete-block.md",
);

const createSeededLayout = async (): Promise<LocalStorageLayout> => {
  const dataDir = await mkdtemp(join(tmpdir(), "asg-rv-001-"));
  dataDirs.push(dataDir);
  const layout = await initializeLocalStorage(dataDir);
  await seedLocalData(layout);
  return layout;
};

afterEach(async () => {
  await Promise.all(
    dataDirs.splice(0).map((dataDir) =>
      rm(dataDir, { recursive: true, force: true }),
    ),
  );
});

describe("RV-001 Agent SQL delete blocking validation", () => {
  it("turns the Agent task into a SQL DELETE request, blocks it before execution, and preserves evidence", async () => {
    const layout = await createSeededLayout();
    const adapter = createDeterministicAgentAdapter({
      defaultCreatedAt: "2026-04-29T03:00:00.000Z",
    });
    const adapterOutput = await adapter.adaptTask({
      taskId: "sql-delete-pending-orders",
      taskPath,
      actor: "agent:rv-001-deterministic-adapter",
      requestId: "req-rv-001-sql-delete-pending-orders",
    });

    assert.match(adapterOutput.agentOutput, /DELETE FROM orders/);
    assert.equal(adapterOutput.request.rawPayload.sql, "DELETE FROM orders WHERE status='PENDING'");
    assert.equal(adapterOutput.request.environment, "production");

    const analysisService = createDefaultToolCallAnalysisService(layout, {
      idFactory: () => "audit-rv-001-sql-delete-block",
      now: () => new Date("2026-04-29T03:00:01.000Z"),
    });
    const analysisResult = await analysisService.analyzeToolCall(
      adapterOutput.request,
    );

    assert.equal(analysisResult.riskLevel, RiskLevel.Prohibited);
    assert.equal(analysisResult.executionDecision.type, DecisionType.Block);
    assert.equal(analysisResult.actionTuple.operation, "delete");
    assert.equal(analysisResult.actionTuple.target, "orders");
    assert.equal(analysisResult.directResources[0]?.name, "orders");
    assert.equal(analysisResult.auditRecordId, "audit-rv-001-sql-delete-block");
    assert.equal(analysisResult.policyVersion, "local-risk-policy-v1");

    const executionLogRepository = createExecutionLogRepository(layout);
    await executionLogRepository.clearExecutionLogs();
    const guard = createToolExecutionGuard({
      analysisService,
      executor: createMockSqlExecutor({
        executionLogRepository,
        scenarioId: "RV-001",
        now: () => new Date("2026-04-29T03:00:02.000Z"),
      }),
    });

    const guardedResult = await guard.execute(adapterOutput.request);
    const executionLogs = await executionLogRepository.listExecutionLogs();

    assert.equal(guardedResult.status, "blocked");
    assert.equal(guardedResult.executorInvoked, false);
    assert.equal(guardedResult.auditId, "audit-rv-001-sql-delete-block");
    assert.deepEqual(executionLogs, []);

    const audit = await createAuditRepository(layout).getAuditRecordById(
      "audit-rv-001-sql-delete-block",
    );

    assert.ok(audit);
    assert.equal(audit.request.id, "req-rv-001-sql-delete-pending-orders");
    assert.equal(audit.decision.type, DecisionType.Block);
    assert.equal(audit.riskLevel, RiskLevel.Prohibited);
    assert.equal(audit.directResources[0]?.name, "orders");
    assert.equal(audit.policyVersion, "local-risk-policy-v1");
    assert.ok(
      audit.policyTrace.matchedRuleIds.includes(
        "production_delete_on_critical_resource",
      ),
    );

    const report = await readFile(reportPath, "utf8");

    assert.match(report, /RV-001/);
    assert.match(report, /sql-delete-pending-orders\.md/);
    assert.match(report, /req-rv-001-sql-delete-pending-orders/);
    assert.match(report, /audit-rv-001-sql-delete-block/);
    assert.match(report, /实际调用次数：`0`/);
    assert.match(report, /结论：部分通过/);
  });
});
