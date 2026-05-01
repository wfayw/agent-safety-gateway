import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  SqlScenarioFixtureId,
  sqlScenarioFixtures,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

import { createExecutionLogRepository } from "../services/api/src/execution-log-repository.js";
import {
  createMockSqlExecutor,
  type MockToolExecutorResult,
} from "../services/api/src/mock-tool-executors.js";
import { seedLocalData } from "../services/api/src/seed.js";
import { initializeLocalStorage } from "../services/api/src/storage.js";
import {
  createToolExecutionGuard,
  type GuardedExecutionResult,
  type ToolExecutionPermitEvidenceProvider,
} from "../services/api/src/tool-execution-guard.js";
import { createDefaultToolCallAnalysisService } from "../services/api/src/tool-call-analysis-service.js";

type DemoPathSummary = {
  requestId: string;
  status: "executed" | "blocked" | "held" | "not_configured";
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
  result: GuardedExecutionResult<MockToolExecutorResult>,
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

const createDemoPermitEvidenceProvider = (): ToolExecutionPermitEvidenceProvider => ({
  getEvidenceSnapshot() {
    return {
      safetyState: {
        stateId: "safety-state-tool-guard-demo-sql-readonly",
        executorId: "executor-tool-guard-demo-sql-readonly",
        coverageMapId: "coverage-map-tool-guard-demo-sql-readonly",
        state: "EvidenceComplete",
        allObligationsCovered: true,
        evaluatedAt: "2026-04-28T08:00:00.000Z",
        coveredObligationIds: ["obligation-tool-guard-demo-readonly"],
        blockedObligationIds: [],
        blockingStatuses: [],
        transitionReason: "all required obligations are covered by valid evidence",
        validUntil: "2026-04-28T08:05:00.000Z",
        coverageMapHash: "sha256:tool-guard-demo-coverage-map",
        safetyEvidenceVersion: "sev-tool-guard-demo-001",
      },
      deniedEvidenceHash: "sha256:tool-guard-demo-denied-evidence",
      sideEffectEvidenceHash: "sha256:tool-guard-demo-side-effect-evidence",
    };
  },
});

export const runToolGuardDemo = async (
  dataDir = process.env.TOOL_GUARD_DEMO_DATA_DIR,
): Promise<ToolGuardDemoResult> => {
  const ownsDataDir = dataDir === undefined;
  const demoDataDir = dataDir ?? (await mkdtemp(join(tmpdir(), "asg-tool-guard-")));

  try {
    const layout = await initializeLocalStorage(demoDataDir);
    await seedLocalData(layout);
    const executionLogRepository = createExecutionLogRepository(layout);
    await executionLogRepository.clearExecutionLogs();

    const analysisService = createDefaultToolCallAnalysisService(layout, {
      idFactory: createAuditIdFactory(),
      now: () => new Date("2026-04-28T08:00:00.000Z"),
    });
    const guard = createToolExecutionGuard<MockToolExecutorResult>({
      analysisService,
      permitEvidenceProvider: createDemoPermitEvidenceProvider(),
      permitNonceFactory: () => "nonce-tool-guard-demo",
      now: () => new Date("2026-04-28T08:00:01.000Z"),
      executor: createMockSqlExecutor({
        executionLogRepository,
        resolveScenarioId: (request) =>
          request.id === "req-sql-delete-orders-production"
            ? SqlScenarioFixtureId.HighRiskDeleteOrders
            : SqlScenarioFixtureId.LowRiskReadOrders,
        now: () => new Date("2026-04-28T08:00:01.000Z"),
      }),
    });

    const blockedDelete = await guard.execute(
      getScenarioRequest(SqlScenarioFixtureId.HighRiskDeleteOrders),
    );
    const allowedSelect = await guard.execute(
      getScenarioRequest(SqlScenarioFixtureId.LowRiskReadOrders),
    );

    const executionLogs = await executionLogRepository.listExecutionLogs();

    return {
      blockedDelete: summarizeResult(blockedDelete),
      allowedSelect: summarizeResult(allowedSelect),
      executorCallCount: executionLogs.length,
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
