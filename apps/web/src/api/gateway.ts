import type {
  ActionTuple,
  AffectedResource,
  AuditRecord,
  DecisionType,
  Environment,
  ExecutionDecision,
  ImpactPath,
  RiskFactor,
  RiskLevel,
  ToolCallRequest,
  ToolType,
} from '@agent-safety-gateway/shared';

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

export type ListAuditsResponse = {
  audits: AuditRecord[];
};

export type GetAuditResponse = {
  audit: AuditRecord;
};

const createQueryString = (filters: AuditFilters = {}) => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      query.set(key, value);
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
