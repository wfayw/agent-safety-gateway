import {
  CriticalityLevel,
  Environment,
  OperationType,
  ToolType,
  RiskFactorCategory,
  RiskFactorSeverity,
  RollbackCapability,
  SensitivityLevel,
  type ActionTuple,
  type AffectedResource,
  type OperationType as OperationTypeValue,
  type RiskFactor,
  type RiskFactorSeverity as RiskFactorSeverityValue,
  type RollbackCapability as RollbackCapabilityValue,
} from "@agent-safety-gateway/shared";

export type RiskResourceImpact = AffectedResource & {
  resolutionStatus?: string;
  rollback?: {
    capability: RollbackCapabilityValue;
    reversible: boolean;
  };
};

export type RiskFactorGeneratorInput = {
  actionTuple: ActionTuple;
  directResources: readonly RiskResourceImpact[];
  indirectResources?: readonly RiskResourceImpact[];
};

export type RiskFactorGenerator = {
  generateRiskFactors: (input: RiskFactorGeneratorInput) => RiskFactor[];
};

type ScoredResource = {
  resource: RiskResourceImpact;
  score: number;
};

const mutableOperations = new Set<OperationTypeValue>([
  OperationType.Create,
  OperationType.Update,
  OperationType.Delete,
  OperationType.Deploy,
  OperationType.Rollback,
  OperationType.ConfigUpdate,
]);

const highRiskOperations = new Set<OperationTypeValue>([
  OperationType.Delete,
  OperationType.Deploy,
]);

const isMutableOperation = (operation: OperationTypeValue) =>
  mutableOperations.has(operation);

const toSeverity = (score: number): RiskFactorSeverityValue => {
  if (score >= 25) {
    return RiskFactorSeverity.Critical;
  }

  if (score > 0) {
    return RiskFactorSeverity.Warning;
  }

  return RiskFactorSeverity.Informational;
};

const createOperationFactor = (actionTuple: ActionTuple): RiskFactor => {
  switch (actionTuple.operation) {
    case OperationType.Delete:
      return {
        category: RiskFactorCategory.Operation,
        label: "Destructive DELETE operation",
        severity: RiskFactorSeverity.Critical,
        score: 45,
        reason: `DELETE can remove data from ${actionTuple.target}.`,
      };
    case OperationType.Deploy:
      return {
        category: RiskFactorCategory.Operation,
        label: "Production-impacting DEPLOY operation",
        severity: RiskFactorSeverity.Critical,
        score: 40,
        reason: `DEPLOY can change the running behavior of ${actionTuple.target}.`,
      };
    case OperationType.Update:
    case OperationType.ConfigUpdate:
      return {
        category: RiskFactorCategory.Operation,
        label: "Mutable UPDATE operation",
        severity: RiskFactorSeverity.Warning,
        score: 25,
        reason: `UPDATE can modify the current state of ${actionTuple.target}.`,
      };
    case OperationType.Create:
      return {
        category: RiskFactorCategory.Operation,
        label: "CREATE operation",
        severity: RiskFactorSeverity.Warning,
        score: 15,
        reason: `CREATE can introduce new state for ${actionTuple.target}.`,
      };
    case OperationType.Rollback:
      return {
        category: RiskFactorCategory.Operation,
        label: "ROLLBACK operation",
        severity: RiskFactorSeverity.Warning,
        score: 10,
        reason: `ROLLBACK changes the active version or configuration of ${actionTuple.target}.`,
      };
    case OperationType.Read:
      return {
        category: RiskFactorCategory.Operation,
        label: "Read-only operation",
        severity: RiskFactorSeverity.Informational,
        score: 0,
        reason: `READ does not mutate ${actionTuple.target}.`,
      };
  }
};

const createEnvironmentFactor = (actionTuple: ActionTuple): RiskFactor => {
  const productionScore = highRiskOperations.has(actionTuple.operation) ? 30 : 8;
  const scoreByEnvironment: Record<Environment, number> = {
    [Environment.Production]: productionScore,
    [Environment.Staging]: 6,
    [Environment.Test]: 2,
    [Environment.Development]: 0,
  };
  const score = scoreByEnvironment[actionTuple.environment];

  return {
    category: RiskFactorCategory.Environment,
    label: `${actionTuple.environment} environment`,
    severity: toSeverity(score),
    score,
    reason:
      actionTuple.environment === Environment.Production
        ? "The request targets production, where mistakes affect live users."
        : `The request targets ${actionTuple.environment}, which has lower blast radius than production.`,
  };
};

const getStringParameter = (actionTuple: ActionTuple, key: string) => {
  const value = actionTuple.parameters[key];

  return typeof value === "string" ? value : null;
};

const createValidationFactor = (actionTuple: ActionTuple): RiskFactor | null => {
  if (
    actionTuple.toolType !== ToolType.CiCd ||
    actionTuple.operation !== OperationType.Deploy
  ) {
    return null;
  }

  const testStatus = getStringParameter(actionTuple, "testStatus");

  if (testStatus === "failed") {
    return {
      category: RiskFactorCategory.ValidationState,
      label: "Failed pre-deployment tests",
      severity: RiskFactorSeverity.Critical,
      score: 35,
      reason: `${actionTuple.target} has failed tests, so production deploy must not reach the executor.`,
    };
  }

  if (testStatus === "passed") {
    return {
      category: RiskFactorCategory.ValidationState,
      label: "Passed pre-deployment tests",
      severity: RiskFactorSeverity.Informational,
      score: 0,
      reason: `${actionTuple.target} has passed tests before deployment.`,
    };
  }

  return {
    category: RiskFactorCategory.ValidationState,
    label: "Unknown pre-deployment test status",
    severity: RiskFactorSeverity.Warning,
    score: 15,
    reason: `${actionTuple.target} deployment did not include a passed test status.`,
  };
};

const getResourceScore = (
  resource: RiskResourceImpact,
  actionTuple: ActionTuple,
) => {
  const criticalityScoreByLevel: Record<AffectedResource["criticalityLevel"], number> = {
    [CriticalityLevel.Critical]: 25,
    [CriticalityLevel.High]: 18,
    [CriticalityLevel.Medium]: 8,
    [CriticalityLevel.Low]: 0,
  };
  const sensitivityScoreByLevel: Record<AffectedResource["sensitivityLevel"], number> = {
    [SensitivityLevel.Restricted]: 10,
    [SensitivityLevel.Confidential]: 5,
    [SensitivityLevel.Internal]: 2,
    [SensitivityLevel.Public]: 0,
  };
  const rawScore =
    criticalityScoreByLevel[resource.criticalityLevel] +
    sensitivityScoreByLevel[resource.sensitivityLevel];

  if (actionTuple.operation === OperationType.Read) {
    return Math.min(rawScore, 8);
  }

  return rawScore;
};

const getHighestRiskResource = (
  resources: readonly RiskResourceImpact[],
  actionTuple: ActionTuple,
): ScoredResource | null => {
  let highestResource: ScoredResource | null = null;

  for (const resource of resources) {
    const score = getResourceScore(resource, actionTuple);

    if (!highestResource || score > highestResource.score) {
      highestResource = { resource, score };
    }
  }

  return highestResource;
};

const createResourceFactor = (
  resources: readonly RiskResourceImpact[],
  actionTuple: ActionTuple,
): RiskFactor => {
  const highestRiskResource = getHighestRiskResource(resources, actionTuple);

  if (!highestRiskResource) {
    return {
      category: RiskFactorCategory.ResourceCriticality,
      label: "No matched resource",
      severity: RiskFactorSeverity.Warning,
      score: 12,
      reason: "No catalog resource matched the action target, so criticality is uncertain.",
    };
  }

  const { resource, score } = highestRiskResource;

  return {
    category: RiskFactorCategory.ResourceCriticality,
    label: `${resource.criticalityLevel} resource: ${resource.name}`,
    severity: toSeverity(score),
    score,
    reason: `${resource.name} is a ${resource.criticalityLevel} ${resource.type} with ${resource.sensitivityLevel} sensitivity.`,
  };
};

const hasUnresolvedResource = (resources: readonly RiskResourceImpact[]) =>
  resources.some((resource) => resource.resolutionStatus === "unresolved");

const createScopeFactor = (
  directResources: readonly RiskResourceImpact[],
  indirectResources: readonly RiskResourceImpact[],
): RiskFactor => {
  const totalResources = directResources.length + indirectResources.length;

  if (hasUnresolvedResource(directResources)) {
    return {
      category: RiskFactorCategory.DependencyImpact,
      label: "Unknown impact scope",
      severity: RiskFactorSeverity.Warning,
      score: 15,
      reason: "At least one target resource was unresolved, so blast radius is uncertain.",
    };
  }

  if (totalResources > 3) {
    return {
      category: RiskFactorCategory.DependencyImpact,
      label: "Broad impact scope",
      severity: RiskFactorSeverity.Critical,
      score: 25,
      reason: `The action affects ${totalResources} resources including dependencies.`,
    };
  }

  if (totalResources > 1) {
    return {
      category: RiskFactorCategory.DependencyImpact,
      label: "Multi-resource impact scope",
      severity: RiskFactorSeverity.Warning,
      score: 10,
      reason: `The action affects ${totalResources} resources including dependencies.`,
    };
  }

  return {
    category: RiskFactorCategory.DependencyImpact,
    label: "Single-resource impact scope",
    severity: RiskFactorSeverity.Informational,
    score: 0,
    reason: "No indirect resource impact was identified.",
  };
};

const rollbackScoreByCapability: Record<RollbackCapabilityValue, number> = {
  [RollbackCapability.Automatic]: 0,
  [RollbackCapability.Manual]: 10,
  [RollbackCapability.None]: 30,
  [RollbackCapability.Unknown]: 25,
};

const getRollbackCapability = (resource: RiskResourceImpact) =>
  resource.rollback?.capability ?? resource.rollbackCapability;

const createRollbackFactor = (
  resources: readonly RiskResourceImpact[],
  actionTuple: ActionTuple,
): RiskFactor => {
  if (!isMutableOperation(actionTuple.operation)) {
    return {
      category: RiskFactorCategory.Reversibility,
      label: "Rollback not required",
      severity: RiskFactorSeverity.Informational,
      score: 0,
      reason: "Read-only operations do not require rollback handling.",
    };
  }

  const rollbackCapabilities = resources.map(getRollbackCapability);
  const highestRiskCapability = rollbackCapabilities.reduce<RollbackCapabilityValue>(
    (highest, capability) =>
      rollbackScoreByCapability[capability] > rollbackScoreByCapability[highest]
        ? capability
        : highest,
    RollbackCapability.Automatic,
  );
  const score = rollbackScoreByCapability[highestRiskCapability];

  return {
    category: RiskFactorCategory.Reversibility,
    label: `${highestRiskCapability} rollback capability`,
    severity: toSeverity(score),
    score,
    reason:
      highestRiskCapability === RollbackCapability.Automatic
        ? "All affected resources have automatic rollback capability."
        : `The riskiest affected resource has ${highestRiskCapability} rollback capability.`,
  };
};

export const createRiskFactorGenerator = (): RiskFactorGenerator => ({
  generateRiskFactors({ actionTuple, directResources, indirectResources = [] }) {
    const allResources = [...directResources, ...indirectResources];
    const validationFactor = createValidationFactor(actionTuple);

    return [
      createOperationFactor(actionTuple),
      createEnvironmentFactor(actionTuple),
      ...(validationFactor ? [validationFactor] : []),
      createResourceFactor(allResources, actionTuple),
      createScopeFactor(directResources, indirectResources),
      createRollbackFactor(allResources, actionTuple),
    ];
  },
});
