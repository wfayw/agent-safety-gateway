import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  cicdScenarioFixtures,
  CiCdScenarioFixtureId,
  ConfigScenarioFixtureId,
  configScenarioFixtures,
  CriticalityLevel,
  Environment,
  ResourceDependencyDirection,
  ResourceDependencyRelationType,
  ResourceType,
  RollbackCapability,
  SensitivityLevel,
  SqlScenarioFixtureId,
  sqlScenarioFixtures,
  type AffectedResource,
  type DecisionType,
  type ResourceDependency,
  type RiskLevel,
  type Scenario,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

import { createApiConfig } from "./config.js";
import type { ScenarioRecord } from "./scenario-repository.js";
import { initializeLocalStorage, type LocalStorageLayout } from "./storage.js";

export type SeedSummary = {
  resources: number;
  dependencies: number;
  scenarios: number;
};

const seedResources = [
  {
    id: "resource-db-table-orders-prod",
    name: "orders",
    type: ResourceType.DatabaseTable,
    system: "commerce",
    environment: Environment.Production,
    sensitivityLevel: SensitivityLevel.Restricted,
    criticalityLevel: CriticalityLevel.Critical,
    owner: "payments-platform",
    rollbackCapability: RollbackCapability.Manual,
  },
  {
    id: "resource-service-order-service-prod",
    name: "order-service",
    type: ResourceType.Service,
    system: "commerce",
    environment: Environment.Production,
    sensitivityLevel: SensitivityLevel.Confidential,
    criticalityLevel: CriticalityLevel.High,
    owner: "commerce-platform",
    rollbackCapability: RollbackCapability.Automatic,
  },
  {
    id: "resource-service-payment-service-prod",
    name: "payment-service",
    type: ResourceType.Service,
    system: "payments",
    environment: Environment.Production,
    sensitivityLevel: SensitivityLevel.Restricted,
    criticalityLevel: CriticalityLevel.Critical,
    owner: "payments-platform",
    rollbackCapability: RollbackCapability.Manual,
  },
  {
    id: "resource-service-reconciliation-prod",
    name: "reconciliation",
    type: ResourceType.Service,
    system: "payments",
    environment: Environment.Production,
    sensitivityLevel: SensitivityLevel.Confidential,
    criticalityLevel: CriticalityLevel.High,
    owner: "payments-platform",
    rollbackCapability: RollbackCapability.Manual,
  },
  {
    id: "resource-pipeline-payment-service-release-prod",
    name: "payment-service-release",
    type: ResourceType.Pipeline,
    system: "payments",
    environment: Environment.Production,
    sensitivityLevel: SensitivityLevel.Internal,
    criticalityLevel: CriticalityLevel.High,
    owner: "payments-platform",
    rollbackCapability: RollbackCapability.Automatic,
  },
  {
    id: "resource-config-payment-timeout-prod",
    name: "payment.timeout",
    type: ResourceType.ConfigKey,
    system: "payments",
    environment: Environment.Production,
    sensitivityLevel: SensitivityLevel.Confidential,
    criticalityLevel: CriticalityLevel.High,
    owner: "payments-platform",
    rollbackCapability: RollbackCapability.Automatic,
  },
] as const satisfies readonly AffectedResource[];

const seedDependencies = [
  {
    sourceResourceId: "resource-db-table-orders-prod",
    targetResourceId: "resource-service-order-service-prod",
    relationType: ResourceDependencyRelationType.ReadsFrom,
    direction: ResourceDependencyDirection.Downstream,
    environment: Environment.Production,
    enabled: true,
  },
  {
    sourceResourceId: "resource-service-payment-service-prod",
    targetResourceId: "resource-service-reconciliation-prod",
    relationType: ResourceDependencyRelationType.PublishesTo,
    direction: ResourceDependencyDirection.Downstream,
    environment: Environment.Production,
    enabled: true,
  },
  {
    sourceResourceId: "resource-config-payment-timeout-prod",
    targetResourceId: "resource-service-payment-service-prod",
    relationType: ResourceDependencyRelationType.Configures,
    direction: ResourceDependencyDirection.Downstream,
    environment: Environment.Production,
    enabled: true,
  },
] as const satisfies readonly ResourceDependency[];

const scenarioFixtures = [
  ...sqlScenarioFixtures.filter(
    (scenario) =>
      scenario.id === SqlScenarioFixtureId.HighRiskDeleteOrders ||
      scenario.id === SqlScenarioFixtureId.LowRiskReadOrders,
  ),
  ...cicdScenarioFixtures.filter(
    (scenario) =>
      scenario.id === CiCdScenarioFixtureId.ProductionDeployPaymentService,
  ),
  ...configScenarioFixtures.filter(
    (scenario) =>
      scenario.id === ConfigScenarioFixtureId.ProductionPaymentTimeoutUpdate,
  ),
] as const satisfies readonly Scenario[];

const toScenarioRecord = (scenario: Scenario): ScenarioRecord => ({
  id: scenario.id,
  name: scenario.title,
  description: scenario.description,
  toolCallRequest: scenario.request as ToolCallRequest,
  expectedRiskLevel: scenario.expectedRiskLevel as RiskLevel,
  expectedDecision: scenario.expectedDecisionType as DecisionType,
});

const readJsonArray = async <Item>(filePath: string): Promise<Item[]> => {
  const rawContent = await readFile(filePath, "utf8");
  const trimmedContent = rawContent.trim();

  if (trimmedContent.length === 0) {
    return [];
  }

  const parsedContent: unknown = JSON.parse(trimmedContent);

  if (!Array.isArray(parsedContent)) {
    throw new Error(`Invalid seed store ${filePath}: expected a JSON array.`);
  }

  return parsedContent as Item[];
};

const writeJsonArray = async <Item>(filePath: string, items: readonly Item[]) => {
  await writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
};

const mergeByKey = <Item>(
  currentItems: readonly Item[],
  nextItems: readonly Item[],
  getKey: (item: Item) => string,
) => {
  const itemsByKey = new Map<string, Item>();

  for (const item of currentItems) {
    itemsByKey.set(getKey(item), item);
  }

  for (const item of nextItems) {
    if (!itemsByKey.has(getKey(item))) {
      itemsByKey.set(getKey(item), item);
    }
  }

  return [...itemsByKey.values()];
};

const getDependencyKey = (dependency: ResourceDependency) =>
  [
    dependency.sourceResourceId,
    dependency.targetResourceId,
    dependency.relationType,
    dependency.environment,
  ].join("|");

export const seedLocalData = async (
  layout: LocalStorageLayout,
): Promise<SeedSummary> => {
  const resources = mergeByKey(
    await readJsonArray<AffectedResource>(layout.stores.resources),
    seedResources,
    (resource) => resource.id,
  );
  const dependencies = mergeByKey(
    await readJsonArray<ResourceDependency>(layout.stores.dependencies),
    seedDependencies,
    getDependencyKey,
  );
  const scenarios = mergeByKey(
    await readJsonArray<ScenarioRecord>(layout.stores.scenarios),
    scenarioFixtures.map(toScenarioRecord),
    (scenario) => scenario.id,
  );

  await Promise.all([
    writeJsonArray(layout.stores.resources, resources),
    writeJsonArray(layout.stores.dependencies, dependencies),
    writeJsonArray(layout.stores.scenarios, scenarios),
  ]);

  return {
    resources: resources.length,
    dependencies: dependencies.length,
    scenarios: scenarios.length,
  };
};

export const seedDataDir = async (dataDir: string): Promise<SeedSummary> => {
  const layout = await initializeLocalStorage(dataDir);
  return seedLocalData(layout);
};

const runSeedCli = async () => {
  const config = createApiConfig();
  const summary = await seedDataDir(config.dataDir);
  console.log(
    `Seeded ${summary.resources} resources, ${summary.dependencies} dependencies, and ${summary.scenarios} scenarios in ${config.dataDir}.`,
  );
};

const entrypoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;

if (entrypoint === import.meta.url) {
  runSeedCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
