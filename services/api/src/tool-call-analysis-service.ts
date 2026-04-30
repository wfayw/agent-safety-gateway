import { randomUUID } from "node:crypto";

import {
  type ActionTuple,
  type AuditRecord,
  type ExecutionDecision,
  type ImpactPath,
  type ParseError,
  type RiskFactor,
  type RiskLevel as RiskLevelValue,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

import {
  createActionParserRegistry,
  type ActionParserRegistry,
} from "./action-parser.js";
import {
  createAuditRepository,
  type AuditRepository,
} from "./audit-repository.js";
import { createCatalogRepositories } from "./catalog-repository.js";
import { createCiCdActionParser } from "./cicd-action-parser.js";
import { createConfigActionParser } from "./config-action-parser.js";
import {
  createDirectImpactResolver,
  type DirectImpactResolver,
  type DirectResourceImpact,
} from "./direct-impact-resolver.js";
import {
  createExecutionDecisionEngine,
  type ExecutionDecisionEngine,
} from "./execution-decision-engine.js";
import {
  createIndirectImpactResolver,
  type IndirectImpactResolver,
  type IndirectResourceImpact,
} from "./indirect-impact-resolver.js";
import {
  createRiskFactorGenerator,
  type RiskFactorGenerator,
} from "./risk-factor-generator.js";
import {
  createRiskLevelScorer,
  type RiskLevelScore,
  type RiskLevelScorer,
} from "./risk-level-scorer.js";
import { createSqlActionParser } from "./sql-action-parser.js";
import type { LocalStorageLayout } from "./storage.js";

export type ToolCallAnalysisResult = {
  request: ToolCallRequest;
  actionTuple: ActionTuple;
  directResources: DirectResourceImpact[];
  indirectResources: IndirectResourceImpact[];
  impactPaths: ImpactPath[];
  riskFactors: RiskFactor[];
  riskScore: RiskLevelScore;
  riskLevel: RiskLevelValue;
  policyVersion: string;
  policyTrace: RiskLevelScore["policyTrace"];
  executionDecision: ExecutionDecision;
  auditRecordId: string;
  auditRecord: AuditRecord;
};

export type ToolCallAnalysisService = {
  analyzeToolCall: (request: ToolCallRequest) => Promise<ToolCallAnalysisResult>;
};

export type ToolCallAnalysisServiceOptions = {
  maxIndirectImpactDepth?: number;
  idFactory?: () => string;
  now?: () => Date;
};

export type ToolCallAnalysisServiceDependencies = {
  actionParserRegistry: ActionParserRegistry;
  directImpactResolver: DirectImpactResolver;
  indirectImpactResolver: IndirectImpactResolver;
  riskFactorGenerator: RiskFactorGenerator;
  riskLevelScorer: RiskLevelScorer;
  executionDecisionEngine: ExecutionDecisionEngine;
  auditRepository: Pick<AuditRepository, "createAuditRecord">;
} & ToolCallAnalysisServiceOptions;

export class ToolCallAnalysisError extends Error {
  readonly errors: ParseError[];

  constructor(errors: ParseError[]) {
    super("Tool call analysis failed before risk scoring.");
    this.name = "ToolCallAnalysisError";
    this.errors = errors;
  }
}

const defaultMaxIndirectImpactDepth = 3;

const createAuditRecord = ({
  request,
  actionTuple,
  directResources,
  indirectResources,
  riskFactors,
  riskLevel,
  policyVersion,
  policyTrace,
  executionDecision,
  idFactory,
  now,
}: {
  request: ToolCallRequest;
  actionTuple: ActionTuple;
  directResources: readonly DirectResourceImpact[];
  indirectResources: readonly IndirectResourceImpact[];
  riskFactors: readonly RiskFactor[];
  riskLevel: RiskLevelValue;
  policyVersion: string;
  policyTrace: RiskLevelScore["policyTrace"];
  executionDecision: ExecutionDecision;
  idFactory: () => string;
  now: () => Date;
}): AuditRecord => ({
  id: idFactory(),
  request,
  actionTuple,
  directResources: [...directResources],
  indirectResources: [...indirectResources],
  impactPaths: indirectResources.map((resource) => resource.path),
  riskFactors: [...riskFactors],
  riskLevel,
  policyVersion,
  policyTrace,
  decision: executionDecision,
  createdAt: now().toISOString(),
});

export const createToolCallAnalysisService = ({
  actionParserRegistry,
  directImpactResolver,
  indirectImpactResolver,
  riskFactorGenerator,
  riskLevelScorer,
  executionDecisionEngine,
  auditRepository,
  maxIndirectImpactDepth = defaultMaxIndirectImpactDepth,
  idFactory = randomUUID,
  now = () => new Date(),
}: ToolCallAnalysisServiceDependencies): ToolCallAnalysisService => ({
  async analyzeToolCall(request) {
    const parseResult = actionParserRegistry.parse(request);

    if (!parseResult.success) {
      throw new ToolCallAnalysisError(parseResult.errors);
    }

    const { actionTuple } = parseResult;
    const directResources =
      await directImpactResolver.resolveDirectResources(actionTuple);
    const indirectResources =
      await indirectImpactResolver.resolveIndirectResources(
        directResources,
        maxIndirectImpactDepth,
      );
    const riskFactors = riskFactorGenerator.generateRiskFactors({
      actionTuple,
      directResources,
      indirectResources,
    });
    const riskScore = riskLevelScorer.scoreRiskLevel({
      actionTuple,
      directResources,
      indirectResources,
      riskFactors,
    });
    const executionDecision = executionDecisionEngine.decideExecution({
      request,
      actionTuple,
      riskScore,
    });
    const auditRecord = await auditRepository.createAuditRecord(
      createAuditRecord({
        request,
        actionTuple,
        directResources,
        indirectResources,
        riskFactors,
        riskLevel: riskScore.riskLevel,
        policyVersion: riskScore.policyVersion,
        policyTrace: riskScore.policyTrace,
        executionDecision,
        idFactory,
        now,
      }),
    );

    return {
      request,
      actionTuple,
      directResources,
      indirectResources,
      impactPaths: indirectResources.map((resource) => resource.path),
      riskFactors,
      riskScore,
      riskLevel: riskScore.riskLevel,
      policyVersion: riskScore.policyVersion,
      policyTrace: riskScore.policyTrace,
      executionDecision,
      auditRecordId: auditRecord.id,
      auditRecord,
    };
  },
});

export const createDefaultActionParserRegistry = () =>
  createActionParserRegistry([
    createSqlActionParser(),
    createCiCdActionParser(),
    createConfigActionParser(),
  ]);

export const createDefaultToolCallAnalysisService = (
  layout: LocalStorageLayout,
  options: ToolCallAnalysisServiceOptions = {},
) => {
  const catalogRepositories = createCatalogRepositories(layout);

  return createToolCallAnalysisService({
    actionParserRegistry: createDefaultActionParserRegistry(),
    directImpactResolver: createDirectImpactResolver(catalogRepositories),
    indirectImpactResolver: createIndirectImpactResolver(catalogRepositories),
    riskFactorGenerator: createRiskFactorGenerator(),
    riskLevelScorer: createRiskLevelScorer(),
    executionDecisionEngine: createExecutionDecisionEngine(),
    auditRepository: createAuditRepository(layout),
    ...options,
  });
};
