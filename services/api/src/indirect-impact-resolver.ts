import {
  type AffectedResource,
  type ImpactPath,
  type ResourceDependency,
  type ResourceDependencyRelationType,
} from "@agent-safety-gateway/shared";

import type {
  DependencyRepository,
  ResourceRepository,
} from "./catalog-repository.js";

export type IndirectImpactPath = ImpactPath & {
  relationTypes: ResourceDependencyRelationType[];
};

export type IndirectResourceImpact = AffectedResource & {
  relationType: ResourceDependencyRelationType;
  path: IndirectImpactPath;
};

export type IndirectImpactResolver = {
  resolveIndirectResources: (
    directResources: readonly AffectedResource[],
    maxDepth: number,
  ) => Promise<IndirectResourceImpact[]>;
};

type CatalogRepository = ResourceRepository & DependencyRepository;

type TraversalFrame = {
  originResourceId: string;
  currentResourceId: string;
  resourceIds: string[];
  dependencyIds: string[];
  relationTypes: ResourceDependencyRelationType[];
  depth: number;
  environment: AffectedResource["environment"];
};

const toSafeMaxDepth = (maxDepth: number) => {
  if (!Number.isFinite(maxDepth)) {
    return 0;
  }

  return Math.max(0, Math.floor(maxDepth));
};

const toDependencyId = (dependency: ResourceDependency) =>
  [
    dependency.sourceResourceId,
    dependency.targetResourceId,
    dependency.relationType,
    dependency.environment,
  ].join("|");

const isTraversableDependency = (
  dependency: ResourceDependency,
  frame: TraversalFrame,
) =>
  dependency.enabled &&
  dependency.environment === frame.environment &&
  !frame.resourceIds.includes(dependency.targetResourceId);

const createImpactPath = (
  frame: TraversalFrame,
  dependency: ResourceDependency,
): IndirectImpactPath => ({
  originResourceId: frame.originResourceId,
  impactedResourceId: dependency.targetResourceId,
  resourceIds: [...frame.resourceIds, dependency.targetResourceId],
  dependencyIds: [...frame.dependencyIds, toDependencyId(dependency)],
  relationTypes: [...frame.relationTypes, dependency.relationType],
  depth: frame.depth + 1,
  environment: frame.environment,
});

const createNextFrame = (
  path: IndirectImpactPath,
  frame: TraversalFrame,
): TraversalFrame => ({
  originResourceId: frame.originResourceId,
  currentResourceId: path.impactedResourceId,
  resourceIds: path.resourceIds,
  dependencyIds: path.dependencyIds,
  relationTypes: path.relationTypes,
  depth: path.depth,
  environment: path.environment,
});

export const createIndirectImpactResolver = (
  catalogRepository: CatalogRepository,
): IndirectImpactResolver => ({
  async resolveIndirectResources(directResources, maxDepth) {
    const depthLimit = toSafeMaxDepth(maxDepth);

    if (directResources.length === 0 || depthLimit === 0) {
      return [];
    }

    const resources = await catalogRepository.listResources();
    const resourcesById = new Map(
      resources.map((resource) => [resource.id, resource]),
    );
    const directResourceIds = new Set(
      directResources.map((resource) => resource.id),
    );
    const emittedResourceIds = new Set<string>();
    const indirectResources: IndirectResourceImpact[] = [];
    const frames: TraversalFrame[] = directResources.map((resource) => ({
      originResourceId: resource.id,
      currentResourceId: resource.id,
      resourceIds: [resource.id],
      dependencyIds: [],
      relationTypes: [],
      depth: 0,
      environment: resource.environment,
    }));

    while (frames.length > 0) {
      const frame = frames.shift();

      if (!frame || frame.depth >= depthLimit) {
        continue;
      }

      const dependencies = await catalogRepository.getDependenciesFromResource(
        frame.currentResourceId,
      );

      for (const dependency of dependencies) {
        if (!isTraversableDependency(dependency, frame)) {
          continue;
        }

        const targetResource = resourcesById.get(dependency.targetResourceId);

        if (!targetResource || targetResource.environment !== frame.environment) {
          continue;
        }

        const path = createImpactPath(frame, dependency);

        if (
          !directResourceIds.has(targetResource.id) &&
          !emittedResourceIds.has(targetResource.id)
        ) {
          indirectResources.push({
            ...targetResource,
            relationType: dependency.relationType,
            path,
          });
          emittedResourceIds.add(targetResource.id);
        }

        frames.push(createNextFrame(path, frame));
      }
    }

    return indirectResources;
  },
});
