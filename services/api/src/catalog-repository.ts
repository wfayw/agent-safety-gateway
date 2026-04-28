import { readFile } from "node:fs/promises";

import type {
  AffectedResource,
  ResourceDependency,
} from "@agent-safety-gateway/shared";

import type { LocalStorageLayout } from "./storage.js";

export type ResourceRepository = {
  listResources: () => Promise<AffectedResource[]>;
  getResourceById: (resourceId: string) => Promise<AffectedResource | null>;
};

export type DependencyRepository = {
  listDependencies: () => Promise<ResourceDependency[]>;
  getDependenciesFromResource: (
    resourceId: string,
  ) => Promise<ResourceDependency[]>;
};

export type CatalogRepositories = ResourceRepository & DependencyRepository;

const readJsonArrayStore = async <Item>(
  filePath: string,
  storeName: string,
): Promise<Item[]> => {
  const rawContent = await readFile(filePath, "utf8");
  const parsedContent: unknown = JSON.parse(rawContent);

  if (!Array.isArray(parsedContent)) {
    throw new Error(`Invalid ${storeName} store: expected a JSON array.`);
  }

  return parsedContent as Item[];
};

export const createCatalogRepositories = (
  layout: LocalStorageLayout,
): CatalogRepositories => {
  const listResources = () =>
    readJsonArrayStore<AffectedResource>(layout.stores.resources, "resources");

  const listDependencies = () =>
    readJsonArrayStore<ResourceDependency>(
      layout.stores.dependencies,
      "dependencies",
    );

  return {
    listResources,
    async getResourceById(resourceId) {
      const resources = await listResources();
      return resources.find((resource) => resource.id === resourceId) ?? null;
    },
    listDependencies,
    async getDependenciesFromResource(resourceId) {
      const dependencies = await listDependencies();
      return dependencies.filter(
        (dependency) => dependency.sourceResourceId === resourceId,
      );
    },
  };
};
