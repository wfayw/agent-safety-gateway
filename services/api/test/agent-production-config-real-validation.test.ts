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
import { createMockConfigExecutor } from "../src/mock-tool-executors.js";
import { seedLocalData } from "../src/seed.js";
import { initializeLocalStorage, type LocalStorageLayout } from "../src/storage.js";
import { createDefaultToolCallAnalysisService } from "../src/tool-call-analysis-service.js";
import { createToolExecutionGuard } from "../src/tool-execution-guard.js";

type ConfigStoreFixture = {
  service: string;
  environment: string;
  namespace: string;
  entries: readonly {
    key: string;
    value: string;
    criticalityLevel: string;
    changePolicy: string;
  }[];
  unsafeChangeExample: {
    key: string;
    previousValue: string;
    requestedValue: string;
    expectedGatewayDecision: string;
  };
};

const dataDirs: string[] = [];
const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const taskPath = join(
  repoRoot,
  "sample-workspace/agent-tasks/production-config-timeout-change.md",
);
const configFixturePath = join(
  repoRoot,
  "sample-workspace/config-store/payment-service.production.json",
);
const reportPath = join(
  repoRoot,
  "docs/evidence/real-validation/RV-004-production-config-sandbox.md",
);

const createSeededLayout = async (): Promise<LocalStorageLayout> => {
  const dataDir = await mkdtemp(join(tmpdir(), "asg-rv-004-"));
  dataDirs.push(dataDir);
  const layout = await initializeLocalStorage(dataDir);
  await seedLocalData(layout);
  return layout;
};

const readConfigStoreFixture = async (): Promise<ConfigStoreFixture> =>
  JSON.parse(await readFile(configFixturePath, "utf8")) as ConfigStoreFixture;

afterEach(async () => {
  await Promise.all(
    dataDirs.splice(0).map((dataDir) =>
      rm(dataDir, { recursive: true, force: true }),
    ),
  );
});

describe("RV-004 Agent production config change validation", () => {
  it("turns the Agent task into a production config update, holds direct execution, and preserves evidence", async () => {
    const configFixture = await readConfigStoreFixture();
    const timeoutEntry = configFixture.entries.find(
      (entry) => entry.key === "payment.timeout",
    );

    assert.equal(configFixture.service, "payment-service");
    assert.equal(configFixture.environment, "production");
    assert.equal(configFixture.namespace, "production");
    assert.equal(timeoutEntry?.value, "2s");
    assert.equal(timeoutEntry?.criticalityLevel, "high");
    assert.equal(timeoutEntry?.changePolicy, "sandbox_then_approval");
    assert.equal(configFixture.unsafeChangeExample.requestedValue, "100ms");
    assert.equal(configFixture.unsafeChangeExample.expectedGatewayDecision, "sandbox");

    const layout = await createSeededLayout();
    const adapter = createDeterministicAgentAdapter({
      defaultCreatedAt: "2026-04-29T03:30:00.000Z",
    });
    const adapterOutput = await adapter.adaptTask({
      taskId: "production-config-timeout-change",
      taskPath,
      actor: "agent:rv-004-deterministic-adapter",
      requestId: "req-rv-004-production-config-timeout-change",
    });

    assert.match(adapterOutput.agentOutput, /payment\.timeout/);
    assert.match(adapterOutput.agentOutput, /100ms/);
    assert.equal(adapterOutput.request.toolType, ToolType.Config);
    assert.equal(adapterOutput.request.environment, "production");
    assert.equal(adapterOutput.request.rawPayload.service, "payment-service");
    assert.equal(adapterOutput.request.rawPayload.key, "payment.timeout");
    assert.equal(adapterOutput.request.rawPayload.currentValue, "2s");
    assert.equal(adapterOutput.request.rawPayload.value, "100ms");
    assert.equal(adapterOutput.request.rawPayload.policy, "sandbox_then_approval");

    const analysisService = createDefaultToolCallAnalysisService(layout, {
      idFactory: () => "audit-rv-004-production-config-sandbox",
      now: () => new Date("2026-04-29T03:30:01.000Z"),
    });
    const analysisResult = await analysisService.analyzeToolCall(
      adapterOutput.request,
    );

    assert.equal(analysisResult.riskLevel, RiskLevel.Medium);
    assert.equal(analysisResult.executionDecision.type, DecisionType.Sandbox);
    assert.equal(
      analysisResult.executionDecision.code,
      "risk.medium.sandbox_production_config",
    );
    assert.equal(analysisResult.actionTuple.operation, OperationType.Update);
    assert.equal(
      analysisResult.actionTuple.target,
      "payment-service.payment.timeout",
    );
    assert.equal(analysisResult.actionTuple.parameters.value, "100ms");
    assert.equal(analysisResult.directResources[0]?.name, "payment.timeout");
    assert.equal(analysisResult.indirectResources[0]?.name, "payment-service");
    assert.equal(
      analysisResult.auditRecordId,
      "audit-rv-004-production-config-sandbox",
    );
    assert.equal(
      analysisResult.executionDecision.rewrittenRequest?.environment,
      "staging",
    );
    assert.equal(
      analysisResult.executionDecision.rewrittenRequest?.rawPayload.rewriteReason,
      "production_config_update_to_approved_canary",
    );

    const executionLogRepository = createExecutionLogRepository(layout);
    await executionLogRepository.clearExecutionLogs();
    const guard = createToolExecutionGuard({
      analysisService,
      executor: createMockConfigExecutor({
        executionLogRepository,
        scenarioId: "RV-004",
        now: () => new Date("2026-04-29T03:30:02.000Z"),
      }),
    });

    const guardedResult = await guard.execute(adapterOutput.request);
    const executionLogs = await executionLogRepository.listExecutionLogs();

    assert.equal(guardedResult.status, "held");
    assert.equal(guardedResult.executorInvoked, false);
    assert.equal(guardedResult.auditId, "audit-rv-004-production-config-sandbox");
    assert.equal(guardedResult.decision.type, DecisionType.Sandbox);
    assert.equal(guardedResult.riskLevel, RiskLevel.Medium);
    assert.deepEqual(executionLogs, []);

    const audit = await createAuditRepository(layout).getAuditRecordById(
      "audit-rv-004-production-config-sandbox",
    );

    assert.ok(audit);
    assert.equal(audit.request.id, "req-rv-004-production-config-timeout-change");
    assert.equal(audit.decision.type, DecisionType.Sandbox);
    assert.equal(audit.riskLevel, RiskLevel.Medium);
    assert.equal(audit.actionTuple.operation, OperationType.Update);
    assert.equal(audit.directResources[0]?.name, "payment.timeout");

    const report = await readFile(reportPath, "utf8");

    assert.match(report, /RV-004/);
    assert.match(report, /production-config-timeout-change\.md/);
    assert.match(report, /payment-service\.production\.json/);
    assert.match(report, /req-rv-004-production-config-timeout-change/);
    assert.match(report, /audit-rv-004-production-config-sandbox/);
    assert.match(report, /payment\.timeout/);
    assert.match(report, /risk\.medium\.sandbox_production_config/);
    assert.match(report, /实际调用次数：`0`/);
    assert.match(report, /结论：部分通过/);
  });
});
