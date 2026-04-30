import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import {
  DecisionType,
  OperationType,
  RiskLevel,
  ToolType,
} from "@agent-safety-gateway/shared";

import { createDeterministicAgentAdapter } from "../src/agent-adapter.js";
import { createAuditRepository } from "../src/audit-repository.js";
import { createExecutionLogRepository } from "../src/execution-log-repository.js";
import { seedLocalData } from "../src/seed.js";
import { initializeLocalStorage, type LocalStorageLayout } from "../src/storage.js";
import { createDefaultToolCallAnalysisService } from "../src/tool-call-analysis-service.js";
import { createToolExecutionGuard } from "../src/tool-execution-guard.js";

const dataDirs: string[] = [];
const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const taskPath = join(
  repoRoot,
  "sample-workspace/agent-tasks/sql-readonly-pending-orders.md",
);
const reportPath = join(
  repoRoot,
  "docs/evidence/real-validation/RV-002-sql-readonly-allow.md",
);

const createSeededLayout = async (): Promise<LocalStorageLayout> => {
  const dataDir = await mkdtemp(join(tmpdir(), "asg-rv-002-"));
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

describe("RV-002 Agent SQL readonly allow validation", () => {
  it("turns the Agent task into a SQL SELECT request, allows execution, and preserves evidence", async () => {
    const layout = await createSeededLayout();
    const adapter = createDeterministicAgentAdapter({
      defaultCreatedAt: "2026-04-29T03:10:00.000Z",
    });
    const adapterOutput = await adapter.adaptTask({
      taskId: "sql-readonly-pending-orders",
      taskPath,
      actor: "agent:rv-002-deterministic-adapter",
      requestId: "req-rv-002-sql-readonly-pending-orders",
    });

    assert.match(adapterOutput.agentOutput, /SQL 只读查询工具/);
    assert.match(
      String(adapterOutput.request.rawPayload.sql),
      /^SELECT COUNT\(\*\)/,
    );
    assert.equal(adapterOutput.request.environment, "production");

    const analysisService = createDefaultToolCallAnalysisService(layout, {
      idFactory: () => "audit-rv-002-sql-readonly-allow",
      now: () => new Date("2026-04-29T03:10:01.000Z"),
    });
    const analysisResult = await analysisService.analyzeToolCall(
      adapterOutput.request,
    );

    assert.equal(analysisResult.riskLevel, RiskLevel.Low);
    assert.equal(analysisResult.executionDecision.type, DecisionType.Allow);
    assert.equal(analysisResult.actionTuple.operation, OperationType.Read);
    assert.equal(analysisResult.actionTuple.target, "orders");
    assert.equal(analysisResult.directResources[0]?.name, "orders");
    assert.equal(
      analysisResult.auditRecordId,
      "audit-rv-002-sql-readonly-allow",
    );
    assert.equal(analysisResult.policyVersion, "local-risk-policy-v1");

    const executionLogRepository = createExecutionLogRepository(layout);
    await executionLogRepository.clearExecutionLogs();
    const guard = createToolExecutionGuard({
      analysisService,
      executor: async (request, guardedAnalysisResult) => {
        assert.equal(request.toolType, ToolType.Sql);
        assert.equal(
          guardedAnalysisResult.actionTuple.operation,
          OperationType.Read,
        );

        const queryResult = {
          ok: true,
          requestId: request.id,
          rows: [
            {
              pending_count: 2,
              pending_amount_cents: 7998,
            },
          ],
          rowCount: 1,
        };

        await executionLogRepository.appendExecutionLog({
          scenarioId: "RV-002",
          toolType: request.toolType,
          requestId: request.id,
          called: true,
          timestamp: "2026-04-29T03:10:02.000Z",
          result: queryResult,
        });

        return queryResult;
      },
    });

    const guardedResult = await guard.execute(adapterOutput.request);
    const executionLogs = await executionLogRepository.listExecutionLogs();

    assert.equal(guardedResult.status, "executed");
    assert.equal(guardedResult.executorInvoked, true);
    assert.equal(guardedResult.auditId, "audit-rv-002-sql-readonly-allow");
    assert.deepEqual(guardedResult.executorResult, {
      ok: true,
      requestId: "req-rv-002-sql-readonly-pending-orders",
      rows: [
        {
          pending_count: 2,
          pending_amount_cents: 7998,
        },
      ],
      rowCount: 1,
    });
    assert.equal(executionLogs.length, 1);
    assert.equal(executionLogs[0]?.scenarioId, "RV-002");
    assert.equal(executionLogs[0]?.called, true);

    const audit = await createAuditRepository(layout).getAuditRecordById(
      "audit-rv-002-sql-readonly-allow",
    );

    assert.ok(audit);
    assert.equal(audit.request.id, "req-rv-002-sql-readonly-pending-orders");
    assert.equal(audit.decision.type, DecisionType.Allow);
    assert.equal(audit.riskLevel, RiskLevel.Low);
    assert.equal(audit.actionTuple.operation, OperationType.Read);
    assert.equal(audit.directResources[0]?.name, "orders");
    assert.equal(audit.policyVersion, "local-risk-policy-v1");
    assert.equal(audit.policyTrace.thresholds.high, 90);
    assert.ok(audit.policyTrace.weightedFactors.length > 0);

    const report = await readFile(reportPath, "utf8");

    assert.match(report, /RV-002/);
    assert.match(report, /sql-readonly-pending-orders\.md/);
    assert.match(report, /req-rv-002-sql-readonly-pending-orders/);
    assert.match(report, /audit-rv-002-sql-readonly-allow/);
    assert.match(report, /实际调用次数：`1`/);
    assert.match(report, /pending_count/);
    assert.match(report, /结论：部分通过/);
  });
});
