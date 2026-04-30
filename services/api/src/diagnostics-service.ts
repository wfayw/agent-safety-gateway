import {
  DecisionType,
  RiskLevel,
  ToolType,
  type AuditRecord,
  type DecisionType as DecisionTypeValue,
  type JsonObject,
  type JsonValue,
  type RiskLevel as RiskLevelValue,
  type ToolType as ToolTypeValue,
} from "@agent-safety-gateway/shared";

import type { AuditRepository } from "./audit-repository.js";
import type {
  ExecutionLogEntry,
  ExecutionLogRepository,
} from "./execution-log-repository.js";
import type {
  HookDecisionRecord,
  HookDecisionRepository,
} from "./hook-decision-repository.js";
import {
  AdapterHealthStatus,
  RealComponentAdapterKind,
  createNotConfiguredHealth,
  type AdapterHealth,
  type ExternalApprovalAdapter,
  type ExternalAuditSinkAdapter,
  type RealComponentAdapterKind as RealComponentAdapterKindValue,
} from "./real-component-adapters.js";

type CountBy<T extends string> = Record<T, number>;

type ExecutorInvocationCounts = {
  total: number;
  invoked: number;
  notInvoked: number;
};

export type DiagnosticsAdapterOptions = {
  agentRuntimeConfigured?: boolean;
  sqlExecutorConfigured?: boolean;
  ciCdDryRunConfigured?: boolean;
  configSandboxConfigured?: boolean;
  approvalAdapter?: Partial<Pick<ExternalApprovalAdapter, "health">> | null;
  auditSinkAdapter?: Partial<Pick<ExternalAuditSinkAdapter, "health">> | null;
};

export type GatewayDiagnostics = {
  generatedAt: string;
  decisions: {
    total: number;
    byType: CountBy<DecisionTypeValue>;
    normalBlocks: number;
    failClosedBlocks: number;
  };
  risks: {
    byLevel: CountBy<RiskLevelValue>;
  };
  hooks: {
    total: number;
    blocked: number;
    allowed: number;
    normalBlocks: number;
    failClosedBlocks: number;
    gatewayAnalyzedBlocks: number;
    localBlocks: number;
  };
  executors: {
    totalLogs: number;
    invoked: number;
    notInvoked: number;
    failClosed: number;
    byToolType: Record<ToolTypeValue, ExecutorInvocationCounts>;
  };
  failClosedEvents: {
    total: number;
    audits: number;
    hooks: number;
    executors: number;
    byReason: Record<string, number>;
  };
  adapters: {
    summary: {
      total: number;
      ready: number;
      notConfigured: number;
      unreachable: number;
    };
    health: AdapterHealth[];
  };
};

export type GatewayDiagnosticsDependencies = {
  auditRepository: Pick<AuditRepository, "listAuditRecords">;
  executionLogRepository: Pick<ExecutionLogRepository, "listExecutionLogs">;
  hookDecisionRepository: Pick<HookDecisionRepository, "listHookDecisions">;
  adapters?: DiagnosticsAdapterOptions;
  now?: () => Date;
};

const decisionTypes = Object.values(DecisionType) as DecisionTypeValue[];
const riskLevels = Object.values(RiskLevel) as RiskLevelValue[];
const toolTypes = Object.values(ToolType) as ToolTypeValue[];

const failClosedStatusValues = new Set([
  "not_configured",
  "invalid",
  "unreachable",
  "production_write_network_unknown",
  "production_write_network_open",
  "production_deploy_tests_not_passed",
  "production_namespace_refused",
]);

const createCountBy = <T extends string>(values: readonly T[]): CountBy<T> =>
  Object.fromEntries(values.map((value) => [value, 0])) as CountBy<T>;

const createExecutorCountsByToolType = () =>
  Object.fromEntries(
    toolTypes.map((toolType) => [
      toolType,
      {
        total: 0,
        invoked: 0,
        notInvoked: 0,
      },
    ]),
  ) as Record<ToolTypeValue, ExecutorInvocationCounts>;

const isJsonObject = (value: JsonValue): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const incrementReasonCount = (
  counts: Record<string, number>,
  reason: string,
) => {
  counts[reason] = (counts[reason] ?? 0) + 1;
};

const containsFailClosedSignal = (value: string) =>
  /fail(?:ed)?[- ]closed|could not analyze|unavailable|not_configured|unreachable|invalid/i.test(
    value,
  );

const isFailClosedAuditBlock = (record: AuditRecord) =>
  record.decision.type === DecisionType.Block &&
  containsFailClosedSignal(`${record.decision.code} ${record.decision.reason}`);

const isFailClosedHookBlock = (record: HookDecisionRecord) =>
  record.shouldBlock && containsFailClosedSignal(record.blockReason);

const readResultString = (entry: ExecutionLogEntry, key: string) => {
  if (!isJsonObject(entry.result)) {
    return null;
  }

  const value = entry.result[key];
  return typeof value === "string" ? value : null;
};

const getExecutionFailClosedReason = (entry: ExecutionLogEntry) => {
  const status =
    readResultString(entry, "executorStatus") ??
    readResultString(entry, "status") ??
    readResultString(entry, "mode");

  return status && failClosedStatusValues.has(status) ? status : null;
};

const summarizeDecisions = (auditRecords: readonly AuditRecord[]) => {
  const byType = createCountBy(decisionTypes);
  let failClosedBlocks = 0;

  for (const record of auditRecords) {
    byType[record.decision.type] += 1;

    if (isFailClosedAuditBlock(record)) {
      failClosedBlocks += 1;
    }
  }

  return {
    total: auditRecords.length,
    byType,
    normalBlocks: byType[DecisionType.Block] - failClosedBlocks,
    failClosedBlocks,
  };
};

const summarizeRisks = (auditRecords: readonly AuditRecord[]) => {
  const byLevel = createCountBy(riskLevels);

  for (const record of auditRecords) {
    byLevel[record.riskLevel] += 1;
  }

  return { byLevel };
};

const summarizeHooks = (hookDecisions: readonly HookDecisionRecord[]) => {
  let blocked = 0;
  let failClosedBlocks = 0;
  let gatewayAnalyzedBlocks = 0;
  let localBlocks = 0;

  for (const record of hookDecisions) {
    if (!record.shouldBlock) {
      continue;
    }

    blocked += 1;

    if (record.auditId) {
      gatewayAnalyzedBlocks += 1;
    }

    if (!record.adaptedRequest) {
      localBlocks += 1;
    }

    if (isFailClosedHookBlock(record)) {
      failClosedBlocks += 1;
    }
  }

  return {
    total: hookDecisions.length,
    blocked,
    allowed: hookDecisions.length - blocked,
    normalBlocks: blocked - failClosedBlocks,
    failClosedBlocks,
    gatewayAnalyzedBlocks,
    localBlocks,
  };
};

const summarizeExecutors = (executionLogs: readonly ExecutionLogEntry[]) => {
  const byToolType = createExecutorCountsByToolType();
  let invoked = 0;
  let notInvoked = 0;
  let failClosed = 0;

  for (const entry of executionLogs) {
    const toolCounts = byToolType[entry.toolType];
    toolCounts.total += 1;

    if (entry.called) {
      invoked += 1;
      toolCounts.invoked += 1;
    } else {
      notInvoked += 1;
      toolCounts.notInvoked += 1;
    }

    if (getExecutionFailClosedReason(entry)) {
      failClosed += 1;
    }
  }

  return {
    totalLogs: executionLogs.length,
    invoked,
    notInvoked,
    failClosed,
    byToolType,
  };
};

const summarizeFailClosedEvents = ({
  auditRecords,
  hookDecisions,
  executionLogs,
}: {
  auditRecords: readonly AuditRecord[];
  hookDecisions: readonly HookDecisionRecord[];
  executionLogs: readonly ExecutionLogEntry[];
}) => {
  const byReason: Record<string, number> = {};
  let audits = 0;
  let hooks = 0;
  let executors = 0;

  for (const record of auditRecords) {
    if (isFailClosedAuditBlock(record)) {
      audits += 1;
      incrementReasonCount(byReason, record.decision.code);
    }
  }

  for (const record of hookDecisions) {
    if (isFailClosedHookBlock(record)) {
      hooks += 1;
      incrementReasonCount(byReason, "hook_fail_closed");
    }
  }

  for (const entry of executionLogs) {
    const reason = getExecutionFailClosedReason(entry);

    if (reason) {
      executors += 1;
      incrementReasonCount(byReason, reason);
    }
  }

  return {
    total: audits + hooks + executors,
    audits,
    hooks,
    executors,
    byReason,
  };
};

const createInjectedHealth = (
  adapterKind: RealComponentAdapterKindValue,
  now: () => Date,
): AdapterHealth => ({
  adapterKind,
  status: AdapterHealthStatus.Ready,
  checkedAt: now().toISOString(),
  details: {
    source: "injected",
    healthProbe: "not_provided",
  },
});

const createUnreachableHealth = (
  adapterKind: RealComponentAdapterKindValue,
  error: unknown,
  now: () => Date,
): AdapterHealth => ({
  adapterKind,
  status: AdapterHealthStatus.Unreachable,
  checkedAt: now().toISOString(),
  details: {
    message: error instanceof Error ? error.message : "Adapter health check failed.",
  },
});

const collectHealth = async (
  adapterKind: RealComponentAdapterKindValue,
  adapter: Partial<Pick<ExternalApprovalAdapter, "health">> | null | undefined,
  missingRequirements: string[],
  now: () => Date,
) => {
  if (!adapter) {
    return createNotConfiguredHealth(adapterKind, missingRequirements, now);
  }

  if (!adapter.health) {
    return createInjectedHealth(adapterKind, now);
  }

  try {
    return await adapter.health();
  } catch (error: unknown) {
    return createUnreachableHealth(adapterKind, error, now);
  }
};

const collectAdapterHealth = async (
  adapters: DiagnosticsAdapterOptions,
  now: () => Date,
) => {
  const agentRuntimeHealth = adapters.agentRuntimeConfigured
    ? createInjectedHealth(RealComponentAdapterKind.AgentRuntime, now)
    : createNotConfiguredHealth(
        RealComponentAdapterKind.AgentRuntime,
        ["real agent runtime adapter"],
        now,
      );
  const sqlHealth = adapters.sqlExecutorConfigured
    ? createInjectedHealth(RealComponentAdapterKind.SqlDryRun, now)
    : createNotConfiguredHealth(
        RealComponentAdapterKind.SqlDryRun,
        ["guarded SQL executor"],
        now,
      );
  const ciCdHealth = adapters.ciCdDryRunConfigured
    ? createInjectedHealth(RealComponentAdapterKind.CiCdDryRun, now)
    : createNotConfiguredHealth(
        RealComponentAdapterKind.CiCdDryRun,
        ["CI/CD dry-run adapter"],
        now,
      );
  const configSandboxHealth = adapters.configSandboxConfigured
    ? createInjectedHealth(RealComponentAdapterKind.ConfigSandbox, now)
    : createNotConfiguredHealth(
        RealComponentAdapterKind.ConfigSandbox,
        ["config sandbox adapter"],
        now,
      );
  const approvalHealth = await collectHealth(
    RealComponentAdapterKind.Approval,
    adapters.approvalAdapter,
    ["external approval adapter"],
    now,
  );
  const auditSinkHealth = await collectHealth(
    RealComponentAdapterKind.AuditSink,
    adapters.auditSinkAdapter,
    ["external audit sink adapter", "durable external audit write target"],
    now,
  );

  return [
    agentRuntimeHealth,
    sqlHealth,
    ciCdHealth,
    configSandboxHealth,
    approvalHealth,
    auditSinkHealth,
  ];
};

const summarizeAdapterHealth = (health: readonly AdapterHealth[]) => ({
  total: health.length,
  ready: health.filter((entry) => entry.status === AdapterHealthStatus.Ready)
    .length,
  notConfigured: health.filter(
    (entry) => entry.status === AdapterHealthStatus.NotConfigured,
  ).length,
  unreachable: health.filter(
    (entry) => entry.status === AdapterHealthStatus.Unreachable,
  ).length,
});

export const createGatewayDiagnostics = async ({
  auditRepository,
  executionLogRepository,
  hookDecisionRepository,
  adapters = {},
  now = () => new Date(),
}: GatewayDiagnosticsDependencies): Promise<GatewayDiagnostics> => {
  const [auditRecords, executionLogs, hookDecisions, adapterHealth] =
    await Promise.all([
      auditRepository.listAuditRecords(),
      executionLogRepository.listExecutionLogs(),
      hookDecisionRepository.listHookDecisions(),
      collectAdapterHealth(adapters, now),
    ]);

  return {
    generatedAt: now().toISOString(),
    decisions: summarizeDecisions(auditRecords),
    risks: summarizeRisks(auditRecords),
    hooks: summarizeHooks(hookDecisions),
    executors: summarizeExecutors(executionLogs),
    failClosedEvents: summarizeFailClosedEvents({
      auditRecords,
      hookDecisions,
      executionLogs,
    }),
    adapters: {
      summary: summarizeAdapterHealth(adapterHealth),
      health: adapterHealth,
    },
  };
};
