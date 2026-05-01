import type {
  ActionTuple,
  AffectedResource,
  AuditRecord,
  DecisionType,
  Environment,
  ExecutionDecision,
  ImpactPath,
  JsonValue,
  RiskFactor,
  RiskLevel,
  ToolCallRequest,
  ToolType,
} from '@agent-safety-gateway/shared';
import type {
  EvidenceCoverageMap,
  EvidenceCoverageRecord,
  ExecutorSafetyEvidenceState,
  ForbiddenEffectObligation,
  PermitBinding,
  PermitDeniedEvidence,
} from '@agent-safety-gateway/shared/forbidden-side-effect';
import type {
  ContextAdequacyEvidence,
  ContextAnchor,
  ContextRetentionEvidence,
  ContextSufficiencyState,
  PromptAssemblyManifest,
  RequiredContextObligation,
} from '@agent-safety-gateway/shared/context-retention';

import { apiClient, type ApiClient } from './client';

export type RiskScore = {
  riskLevel: RiskLevel;
  score: number;
  explanation: string;
  reasons: string[];
  appliedHardRules: string[];
};

export type AnalyzeToolCallResponse = {
  request: ToolCallRequest;
  actionTuple: ActionTuple;
  directResources: AffectedResource[];
  indirectResources: AffectedResource[];
  impactPaths: ImpactPath[];
  riskFactors: RiskFactor[];
  riskScore: RiskScore;
  riskLevel: RiskLevel;
  executionDecision: ExecutionDecision;
  reasons: string[];
  auditId: string;
};

export type ListScenariosResponse = {
  scenarios: ScenarioSummary[];
};

export type ScenarioSummary = {
  id: string;
  name: string;
  description: string;
  toolCallRequest: ToolCallRequest;
  expectedRiskLevel: RiskLevel;
  expectedDecision: DecisionType;
};

export type AuditFilters = {
  decision?: DecisionType;
  riskLevel?: RiskLevel;
  toolType?: ToolType;
  environment?: Environment;
};

export type ExecutionLogFilters = {
  requestId?: string;
  auditId?: string;
  toolType?: ToolType;
  decision?: DecisionType;
  environment?: Environment;
};

export type ExecutionLogEntry = {
  scenarioId: string;
  toolType: ToolType;
  requestId: string;
  called: boolean;
  auditId?: string;
  decision?: DecisionType;
  environment?: Environment;
  timestamp: string;
  result: JsonValue;
};

export type HookDecisionFilters = {
  requestId?: string;
  auditId?: string;
  shouldBlock?: boolean;
  toolName?: string;
  environment?: Environment;
};

export type HookDecisionRecord = {
  id: string;
  toolName: string;
  commandSummary: string;
  cwd: string | null;
  adaptedRequest: ToolCallRequest | null;
  blockReason: string;
  shouldBlock: boolean;
  createdAt: string;
  auditId: string | null;
};

export const ExecutorSafetyEvidenceRecordKind = {
  Obligation: 'obligation',
  EvidenceRecord: 'evidenceRecord',
  CoverageMap: 'coverageMap',
  SafetyState: 'safetyState',
  Permit: 'permit',
  Denial: 'denial',
} as const;

export type ExecutorSafetyEvidenceRecordKind =
  (typeof ExecutorSafetyEvidenceRecordKind)[keyof typeof ExecutorSafetyEvidenceRecordKind];

export type ExecutorSafetyEvidenceRecordMetadata = {
  id: string;
  requestId: string;
  executorId: string;
  evidenceVersion: string;
  auditId: string;
  createdAt: string;
};

type ExecutorSafetyEvidenceRecordBase = ExecutorSafetyEvidenceRecordMetadata & {
  kind: ExecutorSafetyEvidenceRecordKind;
};

export type ObligationEvidenceRecord = ExecutorSafetyEvidenceRecordBase & {
  kind: typeof ExecutorSafetyEvidenceRecordKind.Obligation;
  obligation: ForbiddenEffectObligation;
};

export type EvidenceCoverageStoreRecord = ExecutorSafetyEvidenceRecordBase & {
  kind: typeof ExecutorSafetyEvidenceRecordKind.EvidenceRecord;
  evidenceRecord: EvidenceCoverageRecord;
};

export type CoverageMapStoreRecord = ExecutorSafetyEvidenceRecordBase & {
  kind: typeof ExecutorSafetyEvidenceRecordKind.CoverageMap;
  coverageMap: EvidenceCoverageMap;
};

export type SafetyStateStoreRecord = ExecutorSafetyEvidenceRecordBase & {
  kind: typeof ExecutorSafetyEvidenceRecordKind.SafetyState;
  safetyState: ExecutorSafetyEvidenceState;
};

export type PermitStoreRecord = ExecutorSafetyEvidenceRecordBase & {
  kind: typeof ExecutorSafetyEvidenceRecordKind.Permit;
  permit: PermitBinding;
};

export type DenialStoreRecord = ExecutorSafetyEvidenceRecordBase & {
  kind: typeof ExecutorSafetyEvidenceRecordKind.Denial;
  denial: PermitDeniedEvidence;
};

export type ExecutorSafetyEvidenceRecord =
  | ObligationEvidenceRecord
  | EvidenceCoverageStoreRecord
  | CoverageMapStoreRecord
  | SafetyStateStoreRecord
  | PermitStoreRecord
  | DenialStoreRecord;

export type ExecutorSafetyEvidenceFilters = {
  kind?: ExecutorSafetyEvidenceRecordKind;
  requestId?: string;
  executorId?: string;
  evidenceVersion?: string;
  auditId?: string;
};

export const ContextAdequacyEvidenceRecordKind = {
  ContextAnchor: 'contextAnchor',
  PromptAssemblyManifest: 'promptAssemblyManifest',
  RequiredContextObligation: 'requiredContextObligation',
  ContextRetentionEvidence: 'contextRetentionEvidence',
  ContextSufficiencyState: 'contextSufficiencyState',
  ContextAdequacyEvidence: 'contextAdequacyEvidence',
} as const;

export type ContextAdequacyEvidenceRecordKind =
  (typeof ContextAdequacyEvidenceRecordKind)[keyof typeof ContextAdequacyEvidenceRecordKind];

export type ContextAdequacyEvidenceRecordMetadata = {
  id: string;
  requestId: string;
  auditId: string;
  inferenceId: string;
  toolCallDigest: string;
  createdAt: string;
};

type ContextAdequacyEvidenceRecordBase = ContextAdequacyEvidenceRecordMetadata & {
  kind: ContextAdequacyEvidenceRecordKind;
};

export type ContextAnchorStoreRecord = ContextAdequacyEvidenceRecordBase & {
  kind: typeof ContextAdequacyEvidenceRecordKind.ContextAnchor;
  contextAnchor: ContextAnchor;
};

export type PromptAssemblyManifestStoreRecord = ContextAdequacyEvidenceRecordBase & {
  kind: typeof ContextAdequacyEvidenceRecordKind.PromptAssemblyManifest;
  promptAssemblyManifest: PromptAssemblyManifest;
};

export type RequiredContextObligationStoreRecord = ContextAdequacyEvidenceRecordBase & {
  kind: typeof ContextAdequacyEvidenceRecordKind.RequiredContextObligation;
  requiredContextObligation: RequiredContextObligation;
};

export type ContextRetentionEvidenceStoreRecord = ContextAdequacyEvidenceRecordBase & {
  kind: typeof ContextAdequacyEvidenceRecordKind.ContextRetentionEvidence;
  contextRetentionEvidence: ContextRetentionEvidence;
};

export type ContextSufficiencyStateStoreRecord = ContextAdequacyEvidenceRecordBase & {
  kind: typeof ContextAdequacyEvidenceRecordKind.ContextSufficiencyState;
  contextSufficiencyState: ContextSufficiencyState;
};

export type ContextAdequacyEvidenceStoreRecord = ContextAdequacyEvidenceRecordBase & {
  kind: typeof ContextAdequacyEvidenceRecordKind.ContextAdequacyEvidence;
  contextAdequacyEvidence: ContextAdequacyEvidence;
  evidenceHash: string;
};

export type ContextAdequacyEvidenceRecord =
  | ContextAnchorStoreRecord
  | PromptAssemblyManifestStoreRecord
  | RequiredContextObligationStoreRecord
  | ContextRetentionEvidenceStoreRecord
  | ContextSufficiencyStateStoreRecord
  | ContextAdequacyEvidenceStoreRecord;

export type ContextAdequacyEvidenceFilters = {
  kind?: ContextAdequacyEvidenceRecordKind;
  requestId?: string;
  auditId?: string;
  inferenceId?: string;
  toolCallDigest?: string;
};

export type ListAuditsResponse = {
  audits: AuditRecord[];
};

export type GetAuditResponse = {
  audit: AuditRecord;
};

export type ListExecutionLogsResponse = {
  executionLogs: ExecutionLogEntry[];
};

export type ListHookDecisionsResponse = {
  hookDecisions: HookDecisionRecord[];
};

export type ListExecutorSafetyEvidenceResponse = {
  executorSafetyEvidence: ExecutorSafetyEvidenceRecord[];
};

export type ListContextEvidenceResponse = {
  contextEvidence: ContextAdequacyEvidenceRecord[];
};

const createQueryString = (filters: object = {}) => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  }

  const queryString = query.toString();

  return queryString ? `?${queryString}` : '';
};

export const analyzeToolCall = (
  request: ToolCallRequest,
  client: ApiClient = apiClient,
) => {
  return client.post<AnalyzeToolCallResponse>('/api/tool-calls/analyze', request);
};

export const listScenarios = async (client: ApiClient = apiClient) => {
  const response = await client.get<ListScenariosResponse>('/api/scenarios');

  return response.scenarios;
};

export const listAudits = async (filters: AuditFilters = {}, client: ApiClient = apiClient) => {
  const response = await client.get<ListAuditsResponse>(
    `/api/audits${createQueryString(filters)}`,
  );

  return response.audits;
};

export const getAudit = async (auditId: string, client: ApiClient = apiClient) => {
  const response = await client.get<GetAuditResponse>(
    `/api/audits/${encodeURIComponent(auditId)}`,
  );

  return response.audit;
};

export const listExecutionLogs = async (
  filters: ExecutionLogFilters = {},
  client: ApiClient = apiClient,
) => {
  const response = await client.get<ListExecutionLogsResponse>(
    `/api/execution-logs${createQueryString(filters)}`,
  );

  return response.executionLogs;
};

export const listHookDecisions = async (
  filters: HookDecisionFilters = {},
  client: ApiClient = apiClient,
) => {
  const response = await client.get<ListHookDecisionsResponse>(
    `/api/hook-decisions${createQueryString(filters)}`,
  );

  return response.hookDecisions;
};

export const listExecutorSafetyEvidence = async (
  filters: ExecutorSafetyEvidenceFilters = {},
  client: ApiClient = apiClient,
) => {
  const response = await client.get<ListExecutorSafetyEvidenceResponse>(
    `/api/executor-safety-evidence${createQueryString(filters)}`,
  );

  return response.executorSafetyEvidence;
};

export const listContextEvidence = async (
  filters: ContextAdequacyEvidenceFilters = {},
  client: ApiClient = apiClient,
) => {
  const response = await client.get<ListContextEvidenceResponse>(
    `/api/context-evidence${createQueryString(filters)}`,
  );

  return response.contextEvidence;
};
