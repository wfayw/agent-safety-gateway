import {
  CriticalityLevel,
  Environment,
  OperationType,
  RiskFactorCategory,
  RiskLevel,
  type ActionTuple,
  type AffectedResource,
  type RiskFactor,
  type RiskFactorCategory as RiskFactorCategoryValue,
  type RiskLevel as RiskLevelValue,
} from "@agent-safety-gateway/shared";

export type RiskLevelThresholds = {
  medium: number;
  high: number;
  prohibited: number;
};

export type RiskFactorWeights = Partial<
  Record<RiskFactorCategoryValue, number>
>;

export type RiskLevelScorerOptions = {
  thresholds?: Partial<RiskLevelThresholds>;
  factorWeights?: RiskFactorWeights;
};

export type RiskLevelScorerInput = {
  actionTuple: ActionTuple;
  directResources: readonly AffectedResource[];
  indirectResources?: readonly AffectedResource[];
  riskFactors: readonly RiskFactor[];
};

export type RiskLevelScore = {
  riskLevel: RiskLevelValue;
  score: number;
  explanation: string;
  reasons: string[];
  appliedHardRules: string[];
};

export type RiskLevelScorer = {
  scoreRiskLevel: (input: RiskLevelScorerInput) => RiskLevelScore;
};

const defaultThresholds: RiskLevelThresholds = {
  medium: 30,
  high: 90,
  prohibited: 120,
};

const defaultFactorWeights: Required<RiskFactorWeights> = {
  [RiskFactorCategory.Operation]: 1,
  [RiskFactorCategory.Environment]: 1,
  [RiskFactorCategory.ResourceCriticality]: 1,
  [RiskFactorCategory.DependencyImpact]: 1,
  [RiskFactorCategory.ValidationState]: 1,
  [RiskFactorCategory.Reversibility]: 1,
};

const riskLevelByScore = (
  score: number,
  thresholds: RiskLevelThresholds,
): RiskLevelValue => {
  if (score >= thresholds.prohibited) {
    return RiskLevel.Prohibited;
  }

  if (score >= thresholds.high) {
    return RiskLevel.High;
  }

  if (score >= thresholds.medium) {
    return RiskLevel.Medium;
  }

  return RiskLevel.Low;
};

const getWeightedScore = (
  riskFactors: readonly RiskFactor[],
  factorWeights: Required<RiskFactorWeights>,
) =>
  riskFactors.reduce(
    (score, factor) => score + factor.score * factorWeights[factor.category],
    0,
  );

const getHardBlockingRules = ({
  actionTuple,
  directResources,
  indirectResources = [],
}: RiskLevelScorerInput) => {
  const affectedResources = [...directResources, ...indirectResources];
  const isProductionDelete =
    actionTuple.environment === Environment.Production &&
    actionTuple.operation === OperationType.Delete;
  const touchesCriticalResource = affectedResources.some(
    (resource) => resource.criticalityLevel === CriticalityLevel.Critical,
  );

  if (!isProductionDelete || !touchesCriticalResource) {
    return [];
  }

  return [
    "production_delete_on_critical_resource",
  ];
};

const createReasons = (
  riskFactors: readonly RiskFactor[],
  appliedHardRules: readonly string[],
) => [
  ...riskFactors.map(
    (factor) => `${factor.label}: ${factor.reason} (${factor.score})`,
  ),
  ...appliedHardRules.map((rule) => `Hard rule matched: ${rule}`),
];

const createExplanation = ({
  riskLevel,
  score,
  thresholds,
  appliedHardRules,
}: {
  riskLevel: RiskLevelValue;
  score: number;
  thresholds: RiskLevelThresholds;
  appliedHardRules: readonly string[];
}) => {
  const thresholdSummary = `thresholds medium=${thresholds.medium}, high=${thresholds.high}, prohibited=${thresholds.prohibited}`;

  if (appliedHardRules.length > 0) {
    return `Risk level is ${riskLevel} because hard blocking rules matched before executor invocation; weighted score ${score} used ${thresholdSummary}.`;
  }

  return `Risk level is ${riskLevel} from weighted score ${score} using ${thresholdSummary}.`;
};

export const createRiskLevelScorer = (
  options: RiskLevelScorerOptions = {},
): RiskLevelScorer => {
  const thresholds = {
    ...defaultThresholds,
    ...options.thresholds,
  };
  const factorWeights = {
    ...defaultFactorWeights,
    ...options.factorWeights,
  };

  return {
    scoreRiskLevel(input) {
      const score = getWeightedScore(input.riskFactors, factorWeights);
      const appliedHardRules = getHardBlockingRules(input);
      const riskLevel =
        appliedHardRules.length > 0
          ? RiskLevel.Prohibited
          : riskLevelByScore(score, thresholds);

      return {
        riskLevel,
        score,
        explanation: createExplanation({
          riskLevel,
          score,
          thresholds,
          appliedHardRules,
        }),
        reasons: createReasons(input.riskFactors, appliedHardRules),
        appliedHardRules,
      };
    },
  };
};
