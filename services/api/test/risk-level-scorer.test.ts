import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CriticalityLevel,
  Environment,
  OperationType,
  ResourceType,
  RiskFactorCategory,
  RiskFactorSeverity,
  RiskLevel,
  RollbackCapability,
  SensitivityLevel,
  ToolType,
  type ActionTuple,
  type AffectedResource,
  type RiskFactor,
} from "@agent-safety-gateway/shared";

import {
  createRiskLevelScorer,
  DEFAULT_LOCAL_POLICY_VERSION,
} from "../src/risk-level-scorer.js";

const createActionTuple = (
  overrides: Partial<ActionTuple> = {},
): ActionTuple => ({
  actor: "agent:ralph",
  taskPurpose: "Score risk level",
  toolType: ToolType.Sql,
  operation: OperationType.Read,
  target: "orders",
  parameters: {},
  environment: Environment.Production,
  timestamp: "2026-04-28T06:00:00.000Z",
  ...overrides,
});

const createResource = (
  overrides: Partial<AffectedResource> = {},
): AffectedResource => ({
  id: "resource-db-table-orders-prod",
  name: "orders",
  type: ResourceType.DatabaseTable,
  system: "commerce",
  environment: Environment.Production,
  sensitivityLevel: SensitivityLevel.Restricted,
  criticalityLevel: CriticalityLevel.Critical,
  owner: "payments-platform",
  rollbackCapability: RollbackCapability.Manual,
  ...overrides,
});

const createFactor = (overrides: Partial<RiskFactor> = {}): RiskFactor => ({
  category: RiskFactorCategory.Operation,
  label: "Read-only operation",
  severity: RiskFactorSeverity.Informational,
  score: 5,
  reason: "Read-only SQL does not mutate data.",
  ...overrides,
});

describe("risk level scorer", () => {
  it("scores low risk below weighted thresholds", () => {
    const scorer = createRiskLevelScorer();
    const result = scorer.scoreRiskLevel({
      actionTuple: createActionTuple(),
      directResources: [createResource()],
      riskFactors: [createFactor({ score: 10 })],
    });

    assert.equal(result.riskLevel, RiskLevel.Low);
    assert.equal(result.score, 10);
    assert.match(result.explanation, /weighted score 10/);
    assert.deepEqual(result.appliedHardRules, []);
    assert.equal(result.policyVersion, DEFAULT_LOCAL_POLICY_VERSION);
    assert.deepEqual(result.policyTrace.thresholds, {
      medium: 30,
      high: 90,
      prohibited: 120,
    });
    assert.equal(result.policyTrace.weights[RiskFactorCategory.Operation], 1);
    assert.equal(result.policyTrace.weightedFactors[0]?.score, 10);
    assert.equal(result.policyTrace.weightedFactors[0]?.weight, 1);
    assert.equal(result.policyTrace.weightedFactors[0]?.weightedScore, 10);
    assert.equal(result.policyTrace.hardRules.every((rule) => !rule.matched), true);
    assert.ok(
      result.policyTrace.matchedRuleIds.includes(
        result.policyTrace.weightedFactors[0]?.id ?? "",
      ),
    );
  });

  it("scores medium risk from configurable weighted thresholds", () => {
    const scorer = createRiskLevelScorer({
      factorWeights: {
        [RiskFactorCategory.Operation]: 2,
      },
    });
    const result = scorer.scoreRiskLevel({
      actionTuple: createActionTuple({ operation: OperationType.Update }),
      directResources: [createResource()],
      riskFactors: [
        createFactor({
          category: RiskFactorCategory.Operation,
          label: "Mutable update",
          severity: RiskFactorSeverity.Warning,
          score: 20,
        }),
      ],
    });

    assert.equal(result.riskLevel, RiskLevel.Medium);
    assert.equal(result.score, 40);
    assert.match(result.explanation, /medium/);
    assert.equal(result.policyTrace.weights[RiskFactorCategory.Operation], 2);
    assert.equal(result.policyTrace.weightedFactors[0]?.weightedScore, 40);
  });

  it("scores high risk when weighted score reaches the high threshold", () => {
    const scorer = createRiskLevelScorer();
    const result = scorer.scoreRiskLevel({
      actionTuple: createActionTuple({ operation: OperationType.Deploy }),
      directResources: [createResource()],
      riskFactors: [
        createFactor({
          category: RiskFactorCategory.Operation,
          label: "Production deploy",
          severity: RiskFactorSeverity.Critical,
          score: 40,
        }),
        createFactor({
          category: RiskFactorCategory.Environment,
          label: "Production environment",
          severity: RiskFactorSeverity.Critical,
          score: 30,
        }),
        createFactor({
          category: RiskFactorCategory.ResourceCriticality,
          label: "Critical service",
          severity: RiskFactorSeverity.Critical,
          score: 25,
        }),
      ],
    });

    assert.equal(result.riskLevel, RiskLevel.High);
    assert.equal(result.score, 95);
    assert.ok(result.reasons.some((reason) => reason.includes("Critical service")));
  });

  it("scores prohibited risk at the prohibited threshold", () => {
    const scorer = createRiskLevelScorer();
    const result = scorer.scoreRiskLevel({
      actionTuple: createActionTuple({ operation: OperationType.Deploy }),
      directResources: [createResource()],
      riskFactors: [createFactor({ score: 125 })],
    });

    assert.equal(result.riskLevel, RiskLevel.Prohibited);
    assert.equal(result.score, 125);
  });

  it("applies hard block for production DELETE on critical resources", () => {
    const scorer = createRiskLevelScorer();
    const result = scorer.scoreRiskLevel({
      actionTuple: createActionTuple({ operation: OperationType.Delete }),
      directResources: [createResource()],
      riskFactors: [createFactor({ score: 10 })],
    });

    assert.equal(result.riskLevel, RiskLevel.Prohibited);
    assert.equal(result.score, 10);
    assert.deepEqual(result.appliedHardRules, [
      "production_delete_on_critical_resource",
    ]);
    assert.match(result.explanation, /hard blocking rules/);
    assert.ok(
      result.policyTrace.hardRules.some(
        (rule) =>
          rule.id === "production_delete_on_critical_resource" && rule.matched,
      ),
    );
    assert.ok(
      result.policyTrace.matchedRuleIds.includes(
        "production_delete_on_critical_resource",
      ),
    );
  });

  it("applies hard block for production destructive SQL DDL on unresolved resources", () => {
    const scorer = createRiskLevelScorer();
    const result = scorer.scoreRiskLevel({
      actionTuple: createActionTuple({
        operation: OperationType.Delete,
        parameters: {
          operationKeyword: "truncate",
          sqlOperationClass: "destructive_ddl",
        },
      }),
      directResources: [
        createResource({
          id: "unresolved-production-sql-orders_archive",
          name: "orders_archive",
          criticalityLevel: CriticalityLevel.Medium,
        }),
      ],
      riskFactors: [createFactor({ score: 10 })],
    });

    assert.equal(result.riskLevel, RiskLevel.Prohibited);
    assert.ok(
      result.appliedHardRules.includes("production_destructive_sql_ddl"),
    );
    assert.ok(
      result.policyTrace.matchedRuleIds.includes(
        "production_destructive_sql_ddl",
      ),
    );
  });

  it("applies hard block for failed production deploys on critical resources", () => {
    const scorer = createRiskLevelScorer();
    const result = scorer.scoreRiskLevel({
      actionTuple: createActionTuple({
        toolType: ToolType.CiCd,
        operation: OperationType.Deploy,
        target: "payment-service",
        parameters: { testStatus: "failed" },
      }),
      directResources: [
        createResource({
          name: "payment-service",
          type: ResourceType.Service,
        }),
      ],
      riskFactors: [createFactor({ score: 10 })],
    });

    assert.equal(result.riskLevel, RiskLevel.Prohibited);
    assert.equal(result.score, 10);
    assert.deepEqual(result.appliedHardRules, [
      "production_deploy_with_failed_tests",
    ]);
    assert.match(result.explanation, /hard blocking rules/);
  });
});
