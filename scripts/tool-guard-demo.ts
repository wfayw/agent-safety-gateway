import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  SqlScenarioFixtureId,
  sqlScenarioFixtures,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

import { seedLocalData } from "../services/api/src/seed.js";
import { initializeLocalStorage } from "../services/api/src/storage.js";
import {
  createToolExecutionGuard,
  type GuardedExecutionResult,
} from "../services/api/src/tool-execution-guard.js";
import { createDefaultToolCallAnalysisService } from "../services/api/src/tool-call-analysis-service.js";

type MockSqlExecutorResult = {
  ok: true;
  requestId: string;
  sql: unknown;
};

type DemoPathSummary = {
  requestId: string;
  status: "executed" | "blocked" | "held";
  executorInvoked: boolean;
  riskLevel: string;
  decisionType: string;
  decisionCode: string;
  auditId: string;
};

export type ToolGuardDemoResult = {
  blockedDelete: DemoPathSummary;
  allowedSelect: DemoPathSummary;
  executorCallCount: number;
};

const getScenarioRequest = (scenarioId: SqlScenarioFixtureId): ToolCallRequest => {
  const scenario = sqlScenarioFixtures.find(
    (candidate) => candidate.id === scenarioId,
  );

  if (!scenario) {
    throw new Error(`Missing SQL scenario fixture: ${scenarioId}`);
  }

  return scenario.request;
};

const summarizeResult = (
  result: GuardedExecutionResult<MockSqlExecutorResult>,
): DemoPathSummary => ({
  requestId: result.requestId,
  status: result.status,
  executorInvoked: result.executorInvoked,
  riskLevel: result.riskLevel,
  decisionType: result.decision.type,
  decisionCode: result.decision.code,
  auditId: result.auditId,
});

const createAuditIdFactory = () => {
  let counter = 0;

  return () => {
    counter += 1;
    return `audit-tool-guard-demo-${counter}`;
  };
};

export const runToolGuardDemo = async (
  dataDir = process.env.TOOL_GUARD_DEMO_DATA_DIR,
): Promise<ToolGuardDemoResult> => {
  const ownsDataDir = dataDir === undefined;
  const demoDataDir = dataDir ?? (await mkdtemp(join(tmpdir(), "asg-tool-guard-")));

  try {
    const layout = await initializeLocalStorage(demoDataDir);
    await seedLocalData(layout);

    const analysisService = createDefaultToolCallAnalysisService(layout, {
      idFactory: createAuditIdFactory(),
      now: () => new Date("2026-04-28T08:00:00.000Z"),
    });
    let executorCallCount = 0;
    const guard = createToolExecutionGuard<MockSqlExecutorResult>({
      analysisService,
      executor: (request) => {
        executorCallCount += 1;

        return {
          ok: true,
          requestId: request.id,
          sql: request.rawPayload.sql,
        };
      },
    });

    const blockedDelete = await guard.execute(
      getScenarioRequest(SqlScenarioFixtureId.HighRiskDeleteOrders),
    );
    const allowedSelect = await guard.execute(
      getScenarioRequest(SqlScenarioFixtureId.LowRiskReadOrders),
    );

    return {
      blockedDelete: summarizeResult(blockedDelete),
      allowedSelect: summarizeResult(allowedSelect),
      executorCallCount,
    };
  } finally {
    if (ownsDataDir) {
      await rm(demoDataDir, { recursive: true, force: true });
    }
  }
};

const entrypoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (entrypoint === import.meta.url) {
  runToolGuardDemo()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
