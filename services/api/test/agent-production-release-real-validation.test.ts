import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import {
  DecisionType,
  OperationType,
  RiskFactorCategory,
  RiskLevel,
  ToolType,
} from "@agent-safety-gateway/shared";

import { createDeterministicAgentAdapter } from "../src/agent-adapter.js";
import { createAuditRepository } from "../src/audit-repository.js";
import { createExecutionLogRepository } from "../src/execution-log-repository.js";
import { createMockDeployExecutor } from "../src/mock-tool-executors.js";
import { seedLocalData } from "../src/seed.js";
import { initializeLocalStorage, type LocalStorageLayout } from "../src/storage.js";
import { createDefaultToolCallAnalysisService } from "../src/tool-call-analysis-service.js";
import { createToolExecutionGuard } from "../src/tool-execution-guard.js";

type PipelineFixture = {
  pipelineId: string;
  service: string;
  environment: string;
  candidateVersion: string;
  stages: readonly {
    name: string;
    status: string;
  }[];
};

const dataDirs: string[] = [];
const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const taskPath = join(
  repoRoot,
  "sample-workspace/agent-tasks/production-release-with-failed-tests.md",
);
const pipelineFixturePath = join(
  repoRoot,
  "sample-workspace/pipelines/payment-service-release.json",
);
const reportPath = join(
  repoRoot,
  "docs/evidence/real-validation/RV-003-production-release-block.md",
);

const createSeededLayout = async (): Promise<LocalStorageLayout> => {
  const dataDir = await mkdtemp(join(tmpdir(), "asg-rv-003-"));
  dataDirs.push(dataDir);
  const layout = await initializeLocalStorage(dataDir);
  await seedLocalData(layout);
  return layout;
};

const readPipelineFixture = async (): Promise<PipelineFixture> =>
  JSON.parse(await readFile(pipelineFixturePath, "utf8")) as PipelineFixture;

afterEach(async () => {
  await Promise.all(
    dataDirs.splice(0).map((dataDir) =>
      rm(dataDir, { recursive: true, force: true }),
    ),
  );
});

describe("RV-003 Agent production release blocking validation", () => {
  it("turns the Agent task into a failed production deploy request, blocks it before execution, and preserves evidence", async () => {
    const pipelineFixture = await readPipelineFixture();
    const integrationTestStage = pipelineFixture.stages.find(
      (stage) => stage.name === "integration-test",
    );
    const deployStage = pipelineFixture.stages.find(
      (stage) => stage.name === "deploy",
    );

    assert.equal(pipelineFixture.pipelineId, "payment-service-release");
    assert.equal(pipelineFixture.service, "payment-service");
    assert.equal(pipelineFixture.environment, "production");
    assert.equal(pipelineFixture.candidateVersion, "1.8.0");
    assert.equal(integrationTestStage?.status, "failed");
    assert.equal(deployStage?.status, "not_started");

    const layout = await createSeededLayout();
    const adapter = createDeterministicAgentAdapter({
      defaultCreatedAt: "2026-04-29T03:20:00.000Z",
    });
    const adapterOutput = await adapter.adaptTask({
      taskId: "production-release-with-failed-tests",
      taskPath,
      actor: "agent:rv-003-deterministic-adapter",
      requestId: "req-rv-003-production-release-with-failed-tests",
    });

    assert.match(adapterOutput.agentOutput, /payment-service-release/);
    assert.match(adapterOutput.agentOutput, /integration-test failed/);
    assert.equal(adapterOutput.request.toolType, ToolType.CiCd);
    assert.equal(adapterOutput.request.environment, "production");
    assert.equal(adapterOutput.request.rawPayload.service, "payment-service");
    assert.equal(adapterOutput.request.rawPayload.version, "1.8.0");
    assert.equal(adapterOutput.request.rawPayload.testStatus, "failed");

    const analysisService = createDefaultToolCallAnalysisService(layout, {
      idFactory: () => "audit-rv-003-production-release-block",
      now: () => new Date("2026-04-29T03:20:01.000Z"),
    });
    const analysisResult = await analysisService.analyzeToolCall(
      adapterOutput.request,
    );

    assert.equal(analysisResult.riskLevel, RiskLevel.Prohibited);
    assert.equal(analysisResult.executionDecision.type, DecisionType.Block);
    assert.equal(analysisResult.actionTuple.operation, OperationType.Deploy);
    assert.equal(analysisResult.actionTuple.target, "payment-service");
    assert.equal(analysisResult.actionTuple.parameters.pipeline, "payment-service-release");
    assert.equal(analysisResult.actionTuple.parameters.testStatus, "failed");
    assert.equal(analysisResult.directResources[0]?.name, "payment-service");
    assert.equal(
      analysisResult.auditRecordId,
      "audit-rv-003-production-release-block",
    );
    assert.equal(analysisResult.policyVersion, "local-risk-policy-v1");
    assert.ok(
      analysisResult.riskFactors.some(
        (factor) =>
          factor.category === RiskFactorCategory.ValidationState &&
          factor.label === "Failed pre-deployment tests",
      ),
    );
    assert.ok(
      analysisResult.riskScore.appliedHardRules.includes(
        "production_deploy_with_failed_tests",
      ),
    );

    const executionLogRepository = createExecutionLogRepository(layout);
    await executionLogRepository.clearExecutionLogs();
    const guard = createToolExecutionGuard({
      analysisService,
      executor: createMockDeployExecutor({
        executionLogRepository,
        scenarioId: "RV-003",
        now: () => new Date("2026-04-29T03:20:02.000Z"),
      }),
    });

    const guardedResult = await guard.execute(adapterOutput.request);
    const executionLogs = await executionLogRepository.listExecutionLogs();

    assert.equal(guardedResult.status, "blocked");
    assert.equal(guardedResult.executorInvoked, false);
    assert.equal(guardedResult.auditId, "audit-rv-003-production-release-block");
    assert.equal(guardedResult.decision.type, DecisionType.Block);
    assert.equal(guardedResult.riskLevel, RiskLevel.Prohibited);
    assert.deepEqual(executionLogs, []);

    const audit = await createAuditRepository(layout).getAuditRecordById(
      "audit-rv-003-production-release-block",
    );

    assert.ok(audit);
    assert.equal(audit.request.id, "req-rv-003-production-release-with-failed-tests");
    assert.equal(audit.decision.type, DecisionType.Block);
    assert.equal(audit.riskLevel, RiskLevel.Prohibited);
    assert.equal(audit.actionTuple.operation, OperationType.Deploy);
    assert.equal(audit.directResources[0]?.name, "payment-service");
    assert.equal(audit.policyVersion, "local-risk-policy-v1");
    assert.ok(
      audit.policyTrace.matchedRuleIds.includes(
        "production_deploy_with_failed_tests",
      ),
    );

    const report = await readFile(reportPath, "utf8");

    assert.match(report, /RV-003/);
    assert.match(report, /production-release-with-failed-tests\.md/);
    assert.match(report, /payment-service-release\.json/);
    assert.match(report, /req-rv-003-production-release-with-failed-tests/);
    assert.match(report, /audit-rv-003-production-release-block/);
    assert.match(report, /production_deploy_with_failed_tests/);
    assert.match(report, /实际调用次数：`0`/);
    assert.match(report, /结论：部分通过/);
  });
});
