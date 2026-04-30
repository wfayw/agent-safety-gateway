import {
  CriticalityLevel,
  Environment,
  OperationType,
  RiskFactorCategory,
  RiskLevel,
  ToolType,
  type ActionTuple,
  type AffectedResource,
  type PolicyTrace,
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
  policyVersion?: string;
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
  policyVersion: string;
  policyTrace: PolicyTrace;
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

export const DEFAULT_LOCAL_POLICY_VERSION = "local-risk-policy-v1";

type HardBlockingRule = {
  id: string;
  description: string;
  matches: (input: RiskLevelScorerInput) => boolean;
};

const destructiveSqlDdlOperations = new Set(["alter", "drop", "truncate"]);

const getStringParameter = (actionTuple: ActionTuple, key: string) => {
  const value = actionTuple.parameters[key];

  return typeof value === "string" ? value : null;
};

const isProductionDestructiveSqlDdl = ({ actionTuple }: RiskLevelScorerInput) => {
  const operationKeyword = getStringParameter(
    actionTuple,
    "operationKeyword",
  )?.toLowerCase();

  return (
    actionTuple.toolType === ToolType.Sql &&
    actionTuple.environment === Environment.Production &&
    operationKeyword !== undefined &&
    destructiveSqlDdlOperations.has(operationKeyword)
  );
};

const hardBlockingRules: readonly HardBlockingRule[] = [
  {
    id: "production_delete_on_critical_resource",
    description: "Block production DELETE operations that touch critical resources.",
    matches: ({ actionTuple, directResources, indirectResources = [] }) => {
      const affectedResources = [...directResources, ...indirectResources];

      return (
        actionTuple.environment === Environment.Production &&
        actionTuple.operation === OperationType.Delete &&
        affectedResources.some(
          (resource) => resource.criticalityLevel === CriticalityLevel.Critical,
        )
      );
    },
  },
  {
    id: "production_destructive_sql_ddl",
    description:
      "Block production DROP/TRUNCATE/ALTER SQL operations on matched or unresolved resources.",
    matches: (input) => {
      const affectedResources = [
        ...input.directResources,
        ...(input.indirectResources ?? []),
      ];

      return isProductionDestructiveSqlDdl(input) && affectedResources.length > 0;
    },
  },
  {
    id: "production_deploy_with_failed_tests",
    description: "Block production deployments with failed validation tests.",
    matches: ({ actionTuple, directResources, indirectResources = [] }) => {
      const affectedResources = [...directResources, ...indirectResources];

      return (
        actionTuple.toolType === ToolType.CiCd &&
        actionTuple.environment === Environment.Production &&
        actionTuple.operation === OperationType.Deploy &&
        actionTuple.parameters.testStatus === "failed" &&
        affectedResources.some(
          (resource) => resource.criticalityLevel === CriticalityLevel.Critical,
        )
      );
    },
  },
];

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

const evaluateHardRules = (input: RiskLevelScorerInput) =>
  hardBlockingRules.map((rule) => ({
    id: rule.id,
    description: rule.description,
    matched: rule.matches(input),
  }));

const createRiskFactorTraceId = (factor: RiskFactor, index: number) => {
  const normalizedLabel = factor.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${factor.category}.${normalizedLabel || "factor"}.${index + 1}`;
};

const createPolicyTrace = ({
  input,
  thresholds,
  factorWeights,
  hardRules,
}: {
  input: RiskLevelScorerInput;
  thresholds: RiskLevelThresholds;
  factorWeights: Required<RiskFactorWeights>;
  hardRules: PolicyTrace["hardRules"];
}): PolicyTrace => {
  const weightedFactors = input.riskFactors.map((factor, index) => {
    const weight = factorWeights[factor.category];

    return {
      id: createRiskFactorTraceId(factor, index),
      category: factor.category,
      label: factor.label,
      score: factor.score,
      weight,
      weightedScore: factor.score * weight,
    };
  });

  return {
    thresholds,
    weights: factorWeights,
    hardRules,
    matchedRuleIds: [
      ...weightedFactors.map((factor) => factor.id),
      ...hardRules.filter((rule) => rule.matched).map((rule) => rule.id),
    ],
    weightedFactors,
  };
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
  const policyVersion = options.policyVersion ?? DEFAULT_LOCAL_POLICY_VERSION;

  return {
    scoreRiskLevel(input) {
      const score = getWeightedScore(input.riskFactors, factorWeights);
      const hardRules = evaluateHardRules(input);
      const appliedHardRules = hardRules
        .filter((rule) => rule.matched)
        .map((rule) => rule.id);
      const riskLevel =
        appliedHardRules.length > 0
          ? RiskLevel.Prohibited
          : riskLevelByScore(score, thresholds);
      const policyTrace = createPolicyTrace({
        input,
        thresholds,
        factorWeights,
        hardRules,
      });

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
        policyVersion,
        policyTrace,
      };
    },
  };
};
