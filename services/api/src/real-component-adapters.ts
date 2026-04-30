import type {
  Environment,
  JsonObject,
  JsonValue,
  RiskLevel,
  ToolCallRequest,
  ToolType,
} from "@agent-safety-gateway/shared";

import type {
  AgentAdapterInput,
  AgentAdapterOutput,
} from "./agent-adapter.js";
import type { ToolCallAnalysisResult } from "./tool-call-analysis-service.js";
import type { ToolExecutor } from "./tool-execution-guard.js";

export const RealComponentAdapterKind = {
  AgentRuntime: "agent_runtime",
  SqlDryRun: "sql_dry_run",
  CiCdDryRun: "cicd_dry_run",
  ConfigSandbox: "config_sandbox",
  Approval: "approval",
  AuditSink: "audit_sink",
} as const;

export type RealComponentAdapterKind =
  (typeof RealComponentAdapterKind)[keyof typeof RealComponentAdapterKind];

export const AdapterHealthStatus = {
  Ready: "ready",
  NotConfigured: "not_configured",
  Unreachable: "unreachable",
} as const;

export type AdapterHealthStatus =
  (typeof AdapterHealthStatus)[keyof typeof AdapterHealthStatus];

export type AdapterHealth = {
  adapterKind: RealComponentAdapterKind;
  status: AdapterHealthStatus;
  checkedAt: string;
  details: JsonObject;
};

export type RealComponentEvidence = {
  environmentName: string;
  runId: string;
  sourceSystem: string;
  startedAt: string;
  completedAt?: string;
  artifactUris: string[];
  notes?: string;
};

export type SqlDryRunExecutorResult = {
  ok: true;
  mode: "readonly" | "dry_run";
  rowCount: number | null;
  explainPlan: JsonObject | null;
  rawResult: JsonObject;
  evidence: RealComponentEvidence;
};

export type CiCdDryRunExecutorResult = {
  ok: true;
  mode: "dry_run";
  pipelineStatus: "passed" | "failed" | "blocked" | "unknown";
  rawResult: JsonObject;
  evidence: RealComponentEvidence;
};

export type ConfigSandboxExecutorResult = {
  ok: true;
  mode: "sandbox" | "canary";
  targetNamespace: string;
  rollbackPlan: JsonObject;
  rawResult: JsonObject;
  evidence: RealComponentEvidence;
};

export const ApprovalRequestStatus = {
  Held: "held",
  Approved: "approved",
  Rejected: "rejected",
  Expired: "expired",
} as const;

export type ApprovalRequestStatus =
  (typeof ApprovalRequestStatus)[keyof typeof ApprovalRequestStatus];

export type ApprovalRequest = {
  requestId: string;
  auditId: string;
  actor: string;
  target: string;
  riskLevel: RiskLevel;
  decisionReason: string;
  approverGroup: string;
  status: ApprovalRequestStatus;
  createdAt: string;
};

export type CreateApprovalRequestInput = {
  request: ToolCallRequest;
  analysisResult: ToolCallAnalysisResult;
  approverGroup: string;
};

export type ExternalAuditSinkResult = {
  ok: true;
  status: "appended";
  externalAuditId: string;
  evidenceUri: string | null;
} | {
  ok: false;
  status: "not_configured";
  externalAuditId: null;
  evidenceUri: null;
  missingRequirements: string[];
  message: string;
} | {
  ok: false;
  status: "failed";
  externalAuditId: null;
  evidenceUri: null;
  message: string;
};

export type RealAgentRuntimeAdapter = {
  kind: typeof RealComponentAdapterKind.AgentRuntime;
  generateToolCall: (input: AgentAdapterInput) => Promise<AgentAdapterOutput>;
  health: () => Promise<AdapterHealth>;
};

export type SqlDryRunAdapter = {
  kind: typeof RealComponentAdapterKind.SqlDryRun;
  execute: ToolExecutor<SqlDryRunExecutorResult>;
  health: () => Promise<AdapterHealth>;
};

export type CiCdDryRunAdapter = {
  kind: typeof RealComponentAdapterKind.CiCdDryRun;
  execute: ToolExecutor<CiCdDryRunExecutorResult>;
  health: () => Promise<AdapterHealth>;
};

export type ConfigSandboxAdapter = {
  kind: typeof RealComponentAdapterKind.ConfigSandbox;
  execute: ToolExecutor<ConfigSandboxExecutorResult>;
  health: () => Promise<AdapterHealth>;
};

export type ExternalApprovalAdapter = {
  kind: typeof RealComponentAdapterKind.Approval;
  createApprovalRequest: (
    input: CreateApprovalRequestInput,
  ) => Promise<ApprovalRequest>;
  getApprovalRequest: (requestId: string) => Promise<ApprovalRequest | null>;
  health: () => Promise<AdapterHealth>;
};

export type ExternalAuditSinkAdapter = {
  kind: typeof RealComponentAdapterKind.AuditSink;
  appendControlEvidence: (
    input: ExternalAuditSinkInput,
  ) => Promise<ExternalAuditSinkResult>;
  health: () => Promise<AdapterHealth>;
};

export type ExternalAuditSinkInput = {
  request: ToolCallRequest;
  analysisResult: ToolCallAnalysisResult;
  executorInvoked: boolean;
  executorResult: JsonValue | null;
  evidence: RealComponentEvidence;
};

export type RealComponentProfile = {
  profileId: string;
  environmentName: string;
  allowedToolTypes: ToolType[];
  protectedEnvironments: Environment[];
  agentRuntime: {
    protocol: string;
    toolCallJsonPath: string;
    actorJsonPath: string;
    taskInputExampleUri: string;
  };
  sqlDryRun: {
    enabled: boolean;
    readOnlyConnectionName: string;
    dryRunConnectionName: string;
    productionWriteNetworkBlocked: boolean;
  };
  ciCdDryRun: {
    enabled: boolean;
    pipelineStatusApi: string;
    dryRunExecutorName: string;
    productionDeployBlocked: boolean;
  };
  configSandbox: {
    enabled: boolean;
    sandboxNamespacePattern: string;
    canaryNamespacePattern: string;
    productionWriteBlocked: boolean;
  };
  approval: {
    enabled: boolean;
    approvalSystemName: string;
    defaultApproverGroup: string;
  };
  auditSink: {
    enabled: boolean;
    sinkName: string;
    retentionDays: number;
    desensitizationRequired: boolean;
  };
};

export class RealComponentAdapterNotConfiguredError extends Error {
  readonly adapterKind: RealComponentAdapterKind;
  readonly missingRequirements: string[];

  constructor(
    adapterKind: RealComponentAdapterKind,
    missingRequirements: string[],
  ) {
    super(
      `Real component adapter '${adapterKind}' is not configured: ${missingRequirements.join(", ")}`,
    );
    this.name = "RealComponentAdapterNotConfiguredError";
    this.adapterKind = adapterKind;
    this.missingRequirements = missingRequirements;
  }
}

export const createNotConfiguredHealth = (
  adapterKind: RealComponentAdapterKind,
  missingRequirements: string[],
  now: () => Date = () => new Date(),
): AdapterHealth => ({
  adapterKind,
  status: AdapterHealthStatus.NotConfigured,
  checkedAt: now().toISOString(),
  details: {
    missingRequirements,
  },
});

export const createNotConfiguredToolExecutor =
  <ExecutorResult>(
    adapterKind: RealComponentAdapterKind,
    missingRequirements: string[],
  ): ToolExecutor<ExecutorResult> =>
  async () => {
    throw new RealComponentAdapterNotConfiguredError(
      adapterKind,
      missingRequirements,
    );
  };

export const createNotConfiguredAgentRuntimeAdapter = (
  missingRequirements: string[],
): RealAgentRuntimeAdapter => ({
  kind: RealComponentAdapterKind.AgentRuntime,
  async generateToolCall() {
    throw new RealComponentAdapterNotConfiguredError(
      RealComponentAdapterKind.AgentRuntime,
      missingRequirements,
    );
  },
  async health() {
    return createNotConfiguredHealth(
      RealComponentAdapterKind.AgentRuntime,
      missingRequirements,
    );
  },
});

export const createNotConfiguredExternalAuditSinkResult = (
  missingRequirements: string[],
): ExternalAuditSinkResult => ({
  ok: false,
  status: "not_configured",
  externalAuditId: null,
  evidenceUri: null,
  missingRequirements,
  message: `External audit sink is not configured: ${missingRequirements.join(", ")}`,
});

export const createNotConfiguredExternalAuditSinkAdapter = (
  missingRequirements: string[],
): ExternalAuditSinkAdapter => ({
  kind: RealComponentAdapterKind.AuditSink,
  async appendControlEvidence() {
    return createNotConfiguredExternalAuditSinkResult(missingRequirements);
  },
  async health() {
    return createNotConfiguredHealth(
      RealComponentAdapterKind.AuditSink,
      missingRequirements,
    );
  },
});
