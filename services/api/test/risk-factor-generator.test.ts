import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CriticalityLevel,
  Environment,
  OperationType,
  ResourceType,
  RiskFactorCategory,
  RiskFactorSeverity,
  RollbackCapability,
  SensitivityLevel,
  ToolType,
  type ActionTuple,
  type AffectedResource,
} from "@agent-safety-gateway/shared";

import { createRiskFactorGenerator } from "../src/risk-factor-generator.js";

const createActionTuple = (
  overrides: Partial<ActionTuple> = {},
): ActionTuple => ({
  actor: "agent:ralph",
  taskPurpose: "Validate risk factors",
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

const findFactor = (
  factors: ReturnType<
    ReturnType<typeof createRiskFactorGenerator>["generateRiskFactors"]
  >,
  category: RiskFactorCategory,
) => factors.find((factor) => factor.category === category);

const totalScore = (
  factors: ReturnType<
    ReturnType<typeof createRiskFactorGenerator>["generateRiskFactors"]
  >,
) => factors.reduce((sum, factor) => sum + factor.score, 0);

describe("risk factor generator", () => {
  it("generates the five MVP factor categories for a low-risk read", () => {
    const generator = createRiskFactorGenerator();
    const factors = generator.generateRiskFactors({
      actionTuple: createActionTuple(),
      directResources: [createResource()],
    });

    assert.deepEqual(
      factors.map((factor) => factor.category),
      [
        RiskFactorCategory.Operation,
        RiskFactorCategory.Environment,
        RiskFactorCategory.ResourceCriticality,
        RiskFactorCategory.DependencyImpact,
        RiskFactorCategory.Reversibility,
      ],
    );
    assert.equal(
      findFactor(factors, RiskFactorCategory.Operation)?.severity,
      RiskFactorSeverity.Informational,
    );
    assert.equal(
      findFactor(factors, RiskFactorCategory.Reversibility)?.score,
      0,
    );
    assert.ok(totalScore(factors) < 25);
  });

  it("generates critical factors for a high-risk production delete", () => {
    const generator = createRiskFactorGenerator();
    const readFactors = generator.generateRiskFactors({
      actionTuple: createActionTuple(),
      directResources: [createResource()],
    });
    const deleteFactors = generator.generateRiskFactors({
      actionTuple: createActionTuple({ operation: OperationType.Delete }),
      directResources: [createResource()],
    });

    assert.ok(totalScore(deleteFactors) > totalScore(readFactors));
    assert.equal(
      findFactor(deleteFactors, RiskFactorCategory.Operation)?.severity,
      RiskFactorSeverity.Critical,
    );
    assert.equal(
      findFactor(deleteFactors, RiskFactorCategory.Environment)?.severity,
      RiskFactorSeverity.Critical,
    );
    assert.equal(
      findFactor(deleteFactors, RiskFactorCategory.ResourceCriticality)
        ?.severity,
      RiskFactorSeverity.Critical,
    );
    assert.equal(
      findFactor(deleteFactors, RiskFactorCategory.Reversibility)?.severity,
      RiskFactorSeverity.Warning,
    );
  });

  it("ranks risky operations and production environment above safe controls", () => {
    const generator = createRiskFactorGenerator();
    const resource = createResource();
    const operationScore = (operation: OperationType) =>
      findFactor(
        generator.generateRiskFactors({
          actionTuple: createActionTuple({ operation }),
          directResources: [resource],
        }),
        RiskFactorCategory.Operation,
      )?.score ?? 0;
    const environmentScore = (environment: Environment) =>
      findFactor(
        generator.generateRiskFactors({
          actionTuple: createActionTuple({ environment }),
          directResources: [createResource({ environment })],
        }),
        RiskFactorCategory.Environment,
      )?.score ?? 0;

    assert.ok(operationScore(OperationType.Delete) > operationScore(OperationType.Read));
    assert.ok(operationScore(OperationType.Deploy) > operationScore(OperationType.Read));
    assert.ok(operationScore(OperationType.Update) > operationScore(OperationType.Read));
    assert.ok(environmentScore(Environment.Production) > environmentScore(Environment.Test));
    assert.ok(
      environmentScore(Environment.Production) >
        environmentScore(Environment.Development),
    );
  });

  it("marks non-reversible and broad-scope changes as high severity", () => {
    const generator = createRiskFactorGenerator();
    const factors = generator.generateRiskFactors({
      actionTuple: createActionTuple({ operation: OperationType.Update }),
      directResources: [
        createResource({
          rollbackCapability: RollbackCapability.None,
        }),
      ],
      indirectResources: [
        createResource({ id: "resource-service-a", name: "service-a" }),
        createResource({ id: "resource-service-b", name: "service-b" }),
        createResource({ id: "resource-service-c", name: "service-c" }),
      ],
    });

    assert.equal(
      findFactor(factors, RiskFactorCategory.DependencyImpact)?.severity,
      RiskFactorSeverity.Critical,
    );
    assert.equal(
      findFactor(factors, RiskFactorCategory.Reversibility)?.severity,
      RiskFactorSeverity.Critical,
    );
  });

  it("adds failed test validation evidence for CI/CD deploys", () => {
    const generator = createRiskFactorGenerator();
    const factors = generator.generateRiskFactors({
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
    });

    const validationFactor = findFactor(
      factors,
      RiskFactorCategory.ValidationState,
    );

    assert.equal(validationFactor?.label, "Failed pre-deployment tests");
    assert.equal(validationFactor?.severity, RiskFactorSeverity.Critical);
    assert.match(validationFactor?.reason ?? "", /failed tests/);
  });
});
