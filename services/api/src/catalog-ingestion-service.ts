import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  CriticalityLevel,
  Environment,
  ResourceDependencyDirection,
  ResourceDependencyRelationType,
  ResourceType,
  RollbackCapability,
  SensitivityLevel,
  type AffectedResource,
  type ResourceDependency,
} from "@agent-safety-gateway/shared";

import type { LocalStorageLayout } from "./storage.js";

export type CatalogManifestValidationIssue = {
  path: string;
  code: string;
  message: string;
  details?: Record<string, string | number | boolean | null>;
};

export type CatalogIngestionSummary = {
  resources: {
    received: number;
    created: number;
    updated: number;
    unchanged: number;
    total: number;
  };
  dependencies: {
    received: number;
    created: number;
    updated: number;
    unchanged: number;
    total: number;
  };
  idempotent: boolean;
};

export type CatalogIngestionService = {
  ingestManifest: (manifest: unknown) => Promise<CatalogIngestionSummary>;
  ingestManifestFile: (
    manifestPath: string,
  ) => Promise<CatalogIngestionSummary>;
};

type ParsedCatalogManifest = {
  resources: AffectedResource[];
  dependencies: ResourceDependency[];
};

type MergeResult<Item> = {
  items: Item[];
  created: number;
  updated: number;
  unchanged: number;
  changed: boolean;
};

type EnumLike = Record<string, string>;

type ServiceDefaults = {
  serviceId: string;
  serviceResourceId: string;
  system: string;
  owner: string;
  environment: Environment;
  criticalityLevel: CriticalityLevel;
  sensitivityLevel: SensitivityLevel;
  rollbackCapability: RollbackCapability;
};

type MaybeServiceDefaults = ServiceDefaults | null;

const resourceIdPattern = /^resource-[a-z0-9]+(?:-[a-z0-9]+)*$/;

const addIssue = (
  issues: CatalogManifestValidationIssue[],
  path: string,
  code: string,
  message: string,
  details?: CatalogManifestValidationIssue["details"],
) => {
  issues.push(
    details === undefined ? { path, code, message } : { path, code, message, details },
  );
};

const childPath = (path: string, key: string) => `${path}.${key}`;

const itemPath = (path: string, index: number) => `${path}[${index}]`;

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const readObject = (
  input: unknown,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  if (!isRecord(input)) {
    addIssue(issues, path, "invalid_object", "Expected an object.");
    return null;
  }

  return input;
};

const readRequiredString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const value = input[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    addIssue(
      issues,
      childPath(path, key),
      "invalid_string",
      "Expected a non-empty string.",
    );
    return null;
  }

  return value.trim();
};

const readOptionalString = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const value = input[key];

  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    addIssue(
      issues,
      childPath(path, key),
      "invalid_string",
      "Expected a non-empty string.",
    );
    return null;
  }

  return value.trim();
};

const readRequiredBoolean = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const value = input[key];

  if (typeof value !== "boolean") {
    addIssue(
      issues,
      childPath(path, key),
      "invalid_boolean",
      "Expected a boolean.",
    );
    return null;
  }

  return value;
};

const readOptionalBoolean = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const value = input[key];

  if (value === undefined) {
    return null;
  }

  if (typeof value !== "boolean") {
    addIssue(
      issues,
      childPath(path, key),
      "invalid_boolean",
      "Expected a boolean.",
    );
    return null;
  }

  return value;
};

const readEnumValue = <TEnum extends EnumLike>(
  input: Record<string, unknown>,
  key: string,
  enumValues: TEnum,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const value = input[key];
  const allowedValues = Object.values(enumValues);

  if (typeof value !== "string" || !allowedValues.includes(value)) {
    addIssue(
      issues,
      childPath(path, key),
      "invalid_enum",
      `Expected one of: ${allowedValues.join(", ")}.`,
    );
    return null;
  }

  return value as TEnum[keyof TEnum];
};

const readOptionalEnumValue = <TEnum extends EnumLike>(
  input: Record<string, unknown>,
  key: string,
  enumValues: TEnum,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  if (input[key] === undefined) {
    return null;
  }

  return readEnumValue(input, key, enumValues, path, issues);
};

const readArray = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const value = input[key];

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    addIssue(
      issues,
      childPath(path, key),
      "invalid_array",
      "Expected an array.",
    );
    return [];
  }

  return value;
};

const readResourceId = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const value = readRequiredString(input, key, path, issues);

  if (value && !resourceIdPattern.test(value)) {
    addIssue(
      issues,
      childPath(path, key),
      "invalid_resource_id",
      "Expected a resource id beginning with resource- and containing lowercase letters, numbers, or dashes.",
      { resourceId: value },
    );
    return null;
  }

  return value;
};

const readOptionalResourceId = (
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  if (input[key] === undefined) {
    return null;
  }

  return readResourceId(input, key, path, issues);
};

const toEnvironmentSuffix = (environment: Environment) => {
  if (environment === Environment.Production) {
    return "prod";
  }

  if (environment === Environment.Development) {
    return "dev";
  }

  return environment;
};

const slugify = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > 0 ? slug : "unknown";
};

const buildResourceId = (
  type: ResourceType,
  name: string,
  environment: Environment,
) => {
  const typeSegmentByType: Record<ResourceType, string> = {
    [ResourceType.DatabaseTable]: "db-table",
    [ResourceType.Service]: "service",
    [ResourceType.Pipeline]: "pipeline",
    [ResourceType.ConfigKey]: "config",
    [ResourceType.Queue]: "queue",
    [ResourceType.ExternalDependency]: "external",
  };

  return `resource-${typeSegmentByType[type]}-${slugify(name)}-${toEnvironmentSuffix(environment)}`;
};

const validateResource = (
  input: unknown,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const record = readObject(input, path, issues);

  if (!record) {
    return null;
  }

  const id = readResourceId(record, "id", path, issues);
  const name = readRequiredString(record, "name", path, issues);
  const type = readEnumValue(record, "type", ResourceType, path, issues);
  const system = readRequiredString(record, "system", path, issues);
  const environment = readEnumValue(record, "environment", Environment, path, issues);
  const sensitivityLevel = readEnumValue(
    record,
    "sensitivityLevel",
    SensitivityLevel,
    path,
    issues,
  );
  const criticalityLevel = readEnumValue(
    record,
    "criticalityLevel",
    CriticalityLevel,
    path,
    issues,
  );
  const owner = readRequiredString(record, "owner", path, issues);
  const rollbackCapability = readEnumValue(
    record,
    "rollbackCapability",
    RollbackCapability,
    path,
    issues,
  );

  if (
    !id ||
    !name ||
    !type ||
    !system ||
    !environment ||
    !sensitivityLevel ||
    !criticalityLevel ||
    !owner ||
    !rollbackCapability
  ) {
    return null;
  }

  return {
    id,
    name,
    type,
    system,
    environment,
    sensitivityLevel,
    criticalityLevel,
    owner,
    rollbackCapability,
  } satisfies AffectedResource;
};

const validateDependency = (
  input: unknown,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const record = readObject(input, path, issues);

  if (!record) {
    return null;
  }

  const sourceResourceId = readResourceId(record, "sourceResourceId", path, issues);
  const targetResourceId = readResourceId(record, "targetResourceId", path, issues);
  const relationType = readEnumValue(
    record,
    "relationType",
    ResourceDependencyRelationType,
    path,
    issues,
  );
  const direction = readEnumValue(
    record,
    "direction",
    ResourceDependencyDirection,
    path,
    issues,
  );
  const environment = readEnumValue(record, "environment", Environment, path, issues);
  const enabled = readRequiredBoolean(record, "enabled", path, issues);

  if (
    !sourceResourceId ||
    !targetResourceId ||
    !relationType ||
    !direction ||
    !environment ||
    enabled === null
  ) {
    return null;
  }

  return {
    sourceResourceId,
    targetResourceId,
    relationType,
    direction,
    environment,
    enabled,
  } satisfies ResourceDependency;
};

const createServiceDefaults = (
  manifest: Record<string, unknown>,
  path: string,
  issues: CatalogManifestValidationIssue[],
): MaybeServiceDefaults => {
  if (manifest.serviceId === undefined) {
    return null;
  }

  const serviceId = readRequiredString(manifest, "serviceId", path, issues);
  const explicitServiceResourceId = readOptionalResourceId(
    manifest,
    "resourceId",
    path,
    issues,
  );
  const system = readRequiredString(manifest, "system", path, issues);
  const owner = readRequiredString(manifest, "owner", path, issues);
  const environment = readEnumValue(
    manifest,
    "environment",
    Environment,
    path,
    issues,
  );
  const criticalityLevel = readEnumValue(
    manifest,
    "criticalityLevel",
    CriticalityLevel,
    path,
    issues,
  );
  const sensitivityLevel = readEnumValue(
    manifest,
    "sensitivityLevel",
    SensitivityLevel,
    path,
    issues,
  );
  const rollbackCapability = readEnumValue(
    manifest,
    "rollbackCapability",
    RollbackCapability,
    path,
    issues,
  );

  if (
    !serviceId ||
    !system ||
    !owner ||
    !environment ||
    !criticalityLevel ||
    !sensitivityLevel ||
    !rollbackCapability
  ) {
    return null;
  }

  return {
    serviceId,
    serviceResourceId:
      explicitServiceResourceId ??
      buildResourceId(ResourceType.Service, serviceId, environment),
    system,
    owner,
    environment,
    criticalityLevel,
    sensitivityLevel,
    rollbackCapability,
  };
};

const createServiceResource = (defaults: ServiceDefaults): AffectedResource => ({
  id: defaults.serviceResourceId,
  name: defaults.serviceId,
  type: ResourceType.Service,
  system: defaults.system,
  environment: defaults.environment,
  sensitivityLevel: defaults.sensitivityLevel,
  criticalityLevel: defaults.criticalityLevel,
  owner: defaults.owner,
  rollbackCapability: defaults.rollbackCapability,
});

const createDependencyKey = (dependency: ResourceDependency) =>
  [
    dependency.sourceResourceId,
    dependency.targetResourceId,
    dependency.relationType,
    dependency.environment,
  ].join("|");

const appendResource = (
  resources: AffectedResource[],
  resource: AffectedResource,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const existingResource = resources.find((item) => item.id === resource.id);

  if (!existingResource) {
    resources.push(resource);
    return;
  }

  if (stableStringify(existingResource) !== stableStringify(resource)) {
    addIssue(
      issues,
      path,
      "duplicate_resource_id",
      "Manifest contains conflicting resources with the same id.",
      { resourceId: resource.id },
    );
  }
};

const appendDependency = (
  dependencies: ResourceDependency[],
  dependency: ResourceDependency,
) => {
  const dependencyKey = createDependencyKey(dependency);
  const existingDependency = dependencies.find(
    (item) => createDependencyKey(item) === dependencyKey,
  );

  if (!existingDependency) {
    dependencies.push(dependency);
  }
};

const parseExplicitResources = (
  manifest: Record<string, unknown>,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const resources: AffectedResource[] = [];
  const rawResources = readArray(manifest, "resources", path, issues);

  rawResources.forEach((rawResource, index) => {
    const resource = validateResource(
      rawResource,
      itemPath(childPath(path, "resources"), index),
      issues,
    );

    if (resource) {
      appendResource(
        resources,
        resource,
        itemPath(childPath(path, "resources"), index),
        issues,
      );
    }
  });

  return resources;
};

const parseExplicitDependencies = (
  manifest: Record<string, unknown>,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const dependencies: ResourceDependency[] = [];
  const rawDependencies = readArray(manifest, "dependencies", path, issues);

  rawDependencies.forEach((rawDependency, index) => {
    const dependency = validateDependency(
      rawDependency,
      itemPath(childPath(path, "dependencies"), index),
      issues,
    );

    if (dependency) {
      appendDependency(dependencies, dependency);
    }
  });

  return dependencies;
};

const parseDeployTarget = (
  manifest: Record<string, unknown>,
  defaults: ServiceDefaults,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const deployTarget = manifest.deployTarget;

  if (deployTarget === undefined) {
    return null;
  }

  const targetPath = childPath(path, "deployTarget");
  const record = readObject(deployTarget, targetPath, issues);

  if (!record) {
    return null;
  }

  const pipeline = readRequiredString(record, "pipeline", targetPath, issues);

  if (!pipeline) {
    return null;
  }

  return {
    resource: {
      id: buildResourceId(ResourceType.Pipeline, pipeline, defaults.environment),
      name: pipeline,
      type: ResourceType.Pipeline,
      system: defaults.system,
      environment: defaults.environment,
      sensitivityLevel: SensitivityLevel.Internal,
      criticalityLevel: defaults.criticalityLevel,
      owner: defaults.owner,
      rollbackCapability: RollbackCapability.Automatic,
    } satisfies AffectedResource,
    dependency: {
      sourceResourceId: buildResourceId(
        ResourceType.Pipeline,
        pipeline,
        defaults.environment,
      ),
      targetResourceId: defaults.serviceResourceId,
      relationType: ResourceDependencyRelationType.DeploysTo,
      direction: ResourceDependencyDirection.Downstream,
      environment: defaults.environment,
      enabled: true,
    } satisfies ResourceDependency,
  };
};

const parseConfigKeys = (
  manifest: Record<string, unknown>,
  defaults: ServiceDefaults,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const resources: AffectedResource[] = [];
  const dependencies: ResourceDependency[] = [];
  const rawConfigKeys = readArray(manifest, "configKeys", path, issues);

  rawConfigKeys.forEach((rawConfigKey, index) => {
    const configPath = itemPath(childPath(path, "configKeys"), index);
    const record = readObject(rawConfigKey, configPath, issues);

    if (!record) {
      return;
    }

    const key = readRequiredString(record, "key", configPath, issues);
    const sensitivityLevel =
      readOptionalEnumValue(
        record,
        "sensitivityLevel",
        SensitivityLevel,
        configPath,
        issues,
      ) ?? defaults.sensitivityLevel;
    const criticalityLevel =
      readOptionalEnumValue(
        record,
        "criticalityLevel",
        CriticalityLevel,
        configPath,
        issues,
      ) ?? defaults.criticalityLevel;
    const owner =
      readOptionalString(record, "owner", configPath, issues) ?? defaults.owner;
    const rollbackCapability =
      readOptionalEnumValue(
        record,
        "rollbackCapability",
        RollbackCapability,
        configPath,
        issues,
      ) ?? defaults.rollbackCapability;

    if (!key) {
      return;
    }

    const resourceId = buildResourceId(
      ResourceType.ConfigKey,
      key,
      defaults.environment,
    );

    resources.push({
      id: resourceId,
      name: key,
      type: ResourceType.ConfigKey,
      system: defaults.system,
      environment: defaults.environment,
      sensitivityLevel,
      criticalityLevel,
      owner,
      rollbackCapability,
    });
    dependencies.push({
      sourceResourceId: resourceId,
      targetResourceId: defaults.serviceResourceId,
      relationType: ResourceDependencyRelationType.Configures,
      direction: ResourceDependencyDirection.Downstream,
      environment: defaults.environment,
      enabled: true,
    });
  });

  return { resources, dependencies };
};

const parseDataDependencies = (
  manifest: Record<string, unknown>,
  defaults: ServiceDefaults,
  path: string,
  issues: CatalogManifestValidationIssue[],
) => {
  const dependencies: ResourceDependency[] = [];
  const rawDataDependencies = readArray(manifest, "dataDependencies", path, issues);

  rawDataDependencies.forEach((rawDataDependency, index) => {
    const dependencyPath = itemPath(childPath(path, "dataDependencies"), index);
    const record = readObject(rawDataDependency, dependencyPath, issues);

    if (!record) {
      return;
    }

    const resourceId = readResourceId(record, "resourceId", dependencyPath, issues);
    const relationType = readEnumValue(
      record,
      "relationType",
      ResourceDependencyRelationType,
      dependencyPath,
      issues,
    );
    const direction =
      readOptionalEnumValue(
        record,
        "direction",
        ResourceDependencyDirection,
        dependencyPath,
        issues,
      ) ?? ResourceDependencyDirection.Downstream;
    const environment =
      readOptionalEnumValue(
        record,
        "environment",
        Environment,
        dependencyPath,
        issues,
      ) ?? defaults.environment;
    const enabled =
      readOptionalBoolean(record, "enabled", dependencyPath, issues) ?? true;

    if (!resourceId || !relationType) {
      return;
    }

    dependencies.push({
      sourceResourceId: resourceId,
      targetResourceId: defaults.serviceResourceId,
      relationType,
      direction,
      environment,
      enabled,
    });
  });

  return dependencies;
};

const parseCatalogManifest = (
  input: unknown,
  issues: CatalogManifestValidationIssue[],
): ParsedCatalogManifest => {
  const path = "$";
  const manifest = readObject(input, path, issues);

  if (!manifest) {
    return { resources: [], dependencies: [] };
  }

  const resources = parseExplicitResources(manifest, path, issues);
  const dependencies = parseExplicitDependencies(manifest, path, issues);
  const serviceDefaults = createServiceDefaults(manifest, path, issues);

  if (serviceDefaults) {
    appendResource(resources, createServiceResource(serviceDefaults), path, issues);

    const deployTarget = parseDeployTarget(manifest, serviceDefaults, path, issues);

    if (deployTarget) {
      appendResource(resources, deployTarget.resource, childPath(path, "deployTarget"), issues);
      appendDependency(dependencies, deployTarget.dependency);
    }

    const configKeyCatalog = parseConfigKeys(manifest, serviceDefaults, path, issues);

    for (const resource of configKeyCatalog.resources) {
      appendResource(resources, resource, childPath(path, "configKeys"), issues);
    }

    for (const dependency of configKeyCatalog.dependencies) {
      appendDependency(dependencies, dependency);
    }

    for (const dependency of parseDataDependencies(
      manifest,
      serviceDefaults,
      path,
      issues,
    )) {
      appendDependency(dependencies, dependency);
    }
  }

  if (resources.length === 0) {
    addIssue(
      issues,
      path,
      "empty_manifest_catalog",
      "Expected at least one explicit resource or serviceId-derived resource.",
    );
  }

  return { resources, dependencies };
};

const stableSortJson = (input: unknown): unknown => {
  if (Array.isArray(input)) {
    return input.map(stableSortJson);
  }

  if (!isRecord(input)) {
    return input;
  }

  return Object.fromEntries(
    Object.entries(input)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, value]) => [key, stableSortJson(value)]),
  );
};

const stableStringify = (input: unknown) => JSON.stringify(stableSortJson(input));

const readJsonArrayStore = async <Item>(
  filePath: string,
  storeName: string,
): Promise<Item[]> => {
  const rawContent = await readFile(filePath, "utf8");
  const trimmedContent = rawContent.trim();

  if (trimmedContent.length === 0) {
    return [];
  }

  const parsedContent: unknown = JSON.parse(trimmedContent);

  if (!Array.isArray(parsedContent)) {
    throw new Error(`Invalid ${storeName} store: expected a JSON array.`);
  }

  return parsedContent as Item[];
};

const writeJsonArrayStore = async <Item>(
  filePath: string,
  items: readonly Item[],
) => {
  await writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
};

const mergeItems = <Item>(
  currentItems: readonly Item[],
  nextItems: readonly Item[],
  getKey: (item: Item) => string,
): MergeResult<Item> => {
  const itemsByKey = new Map<string, Item>();
  const keyOrder: string[] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const item of currentItems) {
    const key = getKey(item);
    itemsByKey.set(key, item);
    keyOrder.push(key);
  }

  for (const item of nextItems) {
    const key = getKey(item);
    const existingItem = itemsByKey.get(key);

    if (existingItem === undefined) {
      itemsByKey.set(key, item);
      keyOrder.push(key);
      created += 1;
      continue;
    }

    if (stableStringify(existingItem) === stableStringify(item)) {
      unchanged += 1;
      continue;
    }

    itemsByKey.set(key, item);
    updated += 1;
  }

  const items: Item[] = [];

  for (const key of keyOrder) {
    const item = itemsByKey.get(key);

    if (item !== undefined) {
      items.push(item);
    }
  }

  return {
    items,
    created,
    updated,
    unchanged,
    changed: created > 0 || updated > 0,
  };
};

const validateDependencyReferences = (
  manifest: ParsedCatalogManifest,
  currentResources: readonly AffectedResource[],
  issues: CatalogManifestValidationIssue[],
) => {
  const resourcesById = new Map<string, AffectedResource>();

  for (const resource of currentResources) {
    resourcesById.set(resource.id, resource);
  }

  for (const resource of manifest.resources) {
    resourcesById.set(resource.id, resource);
  }

  manifest.dependencies.forEach((dependency, index) => {
    const dependencyPath = itemPath("$.dependencies", index);
    const sourceResource = resourcesById.get(dependency.sourceResourceId);
    const targetResource = resourcesById.get(dependency.targetResourceId);

    if (!sourceResource) {
      addIssue(
        issues,
        childPath(dependencyPath, "sourceResourceId"),
        "unknown_dependency_resource",
        "Dependency sourceResourceId does not reference a known catalog resource.",
        { resourceId: dependency.sourceResourceId },
      );
    } else if (sourceResource.environment !== dependency.environment) {
      addIssue(
        issues,
        childPath(dependencyPath, "environment"),
        "dependency_environment_mismatch",
        "Dependency environment must match source resource environment.",
        {
          resourceId: sourceResource.id,
          resourceEnvironment: sourceResource.environment,
          dependencyEnvironment: dependency.environment,
        },
      );
    }

    if (!targetResource) {
      addIssue(
        issues,
        childPath(dependencyPath, "targetResourceId"),
        "unknown_dependency_resource",
        "Dependency targetResourceId does not reference a known catalog resource.",
        { resourceId: dependency.targetResourceId },
      );
    } else if (targetResource.environment !== dependency.environment) {
      addIssue(
        issues,
        childPath(dependencyPath, "environment"),
        "dependency_environment_mismatch",
        "Dependency environment must match target resource environment.",
        {
          resourceId: targetResource.id,
          resourceEnvironment: targetResource.environment,
          dependencyEnvironment: dependency.environment,
        },
      );
    }
  });
};

export class CatalogManifestValidationError extends Error {
  readonly issues: CatalogManifestValidationIssue[];

  constructor(issues: CatalogManifestValidationIssue[]) {
    super("Catalog manifest validation failed.");
    this.name = "CatalogManifestValidationError";
    this.issues = issues;
  }
}

const readManifestFile = async (manifestPath: string) => {
  const rawContent = await readFile(resolve(manifestPath), "utf8");

  try {
    return JSON.parse(rawContent) as unknown;
  } catch {
    throw new CatalogManifestValidationError([
      {
        path: "$",
        code: "invalid_json",
        message: "Manifest file must contain valid JSON.",
      },
    ]);
  }
};

export const createCatalogIngestionService = (
  layout: LocalStorageLayout,
): CatalogIngestionService => ({
  async ingestManifest(manifestInput) {
    const currentResources = await readJsonArrayStore<AffectedResource>(
      layout.stores.resources,
      "resources",
    );
    const currentDependencies = await readJsonArrayStore<ResourceDependency>(
      layout.stores.dependencies,
      "dependencies",
    );
    const issues: CatalogManifestValidationIssue[] = [];
    const manifest = parseCatalogManifest(manifestInput, issues);

    validateDependencyReferences(manifest, currentResources, issues);

    if (issues.length > 0) {
      throw new CatalogManifestValidationError(issues);
    }

    const resourceMerge = mergeItems(
      currentResources,
      manifest.resources,
      (resource) => resource.id,
    );
    const dependencyMerge = mergeItems(
      currentDependencies,
      manifest.dependencies,
      createDependencyKey,
    );

    if (resourceMerge.changed) {
      await writeJsonArrayStore(layout.stores.resources, resourceMerge.items);
    }

    if (dependencyMerge.changed) {
      await writeJsonArrayStore(
        layout.stores.dependencies,
        dependencyMerge.items,
      );
    }

    return {
      resources: {
        received: manifest.resources.length,
        created: resourceMerge.created,
        updated: resourceMerge.updated,
        unchanged: resourceMerge.unchanged,
        total: resourceMerge.items.length,
      },
      dependencies: {
        received: manifest.dependencies.length,
        created: dependencyMerge.created,
        updated: dependencyMerge.updated,
        unchanged: dependencyMerge.unchanged,
        total: dependencyMerge.items.length,
      },
      idempotent:
        resourceMerge.created === 0 &&
        resourceMerge.updated === 0 &&
        dependencyMerge.created === 0 &&
        dependencyMerge.updated === 0,
    };
  },
  async ingestManifestFile(manifestPath) {
    return this.ingestManifest(await readManifestFile(manifestPath));
  },
});
