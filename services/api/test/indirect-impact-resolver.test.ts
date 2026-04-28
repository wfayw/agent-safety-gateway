import assert from "node:assert/strict";
import { describe, it } from "node:test";

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

import type { CatalogRepositories } from "../src/catalog-repository.js";
import { createIndirectImpactResolver } from "../src/indirect-impact-resolver.js";

const createResource = (
  id: string,
  overrides: Partial<AffectedResource> = {},
): AffectedResource => ({
  id,
  name: id.replace("resource-", ""),
  type: ResourceType.Service,
  system: "payments",
  environment: Environment.Production,
  sensitivityLevel: SensitivityLevel.Confidential,
  criticalityLevel: CriticalityLevel.High,
  owner: "payments-platform",
  rollbackCapability: RollbackCapability.Manual,
  ...overrides,
});

const createDependency = (
  sourceResourceId: string,
  targetResourceId: string,
  overrides: Partial<ResourceDependency> = {},
): ResourceDependency => ({
  sourceResourceId,
  targetResourceId,
  relationType: ResourceDependencyRelationType.DependsOn,
  direction: ResourceDependencyDirection.Downstream,
  environment: Environment.Production,
  enabled: true,
  ...overrides,
});

const createCatalogRepository = (
  resources: readonly AffectedResource[],
  dependencies: readonly ResourceDependency[],
): CatalogRepositories => ({
  async listResources() {
    return [...resources];
  },
  async getResourceById(resourceId) {
    return resources.find((resource) => resource.id === resourceId) ?? null;
  },
  async listDependencies() {
    return [...dependencies];
  },
  async getDependenciesFromResource(resourceId) {
    return dependencies.filter(
      (dependency) => dependency.sourceResourceId === resourceId,
    );
  },
});

describe("indirect impact resolver", () => {
  it("traverses enabled dependency targets without duplicates", async () => {
    const orderTable = createResource("resource-db-table-orders-prod", {
      name: "orders",
      type: ResourceType.DatabaseTable,
      criticalityLevel: CriticalityLevel.Critical,
    });
    const orderService = createResource("resource-service-order-prod", {
      name: "order-service",
    });
    const paymentService = createResource("resource-service-payment-prod", {
      name: "payment-service",
    });
    const disabledWorker = createResource("resource-service-worker-prod", {
      name: "worker",
    });
    const dependencies = [
      createDependency(orderTable.id, orderService.id, {
        relationType: ResourceDependencyRelationType.ReadsFrom,
      }),
      createDependency(orderService.id, paymentService.id, {
        relationType: ResourceDependencyRelationType.DependsOn,
      }),
      createDependency(orderTable.id, paymentService.id, {
        relationType: ResourceDependencyRelationType.PublishesTo,
      }),
      createDependency(orderTable.id, disabledWorker.id, {
        enabled: false,
      }),
    ];

    const resolver = createIndirectImpactResolver(
      createCatalogRepository(
        [orderTable, orderService, paymentService, disabledWorker],
        dependencies,
      ),
    );

    const indirectResources = await resolver.resolveIndirectResources(
      [orderTable],
      2,
    );

    assert.deepEqual(
      indirectResources.map((resource) => resource.id),
      [orderService.id, paymentService.id],
    );
    assert.equal(
      indirectResources[0]?.relationType,
      ResourceDependencyRelationType.ReadsFrom,
    );
    assert.deepEqual(indirectResources[0]?.path, {
      originResourceId: orderTable.id,
      impactedResourceId: orderService.id,
      resourceIds: [orderTable.id, orderService.id],
      dependencyIds: [
        `${orderTable.id}|${orderService.id}|${ResourceDependencyRelationType.ReadsFrom}|${Environment.Production}`,
      ],
      relationTypes: [ResourceDependencyRelationType.ReadsFrom],
      depth: 1,
      environment: Environment.Production,
    });
    assert.equal(
      indirectResources[1]?.relationType,
      ResourceDependencyRelationType.PublishesTo,
    );
  });

  it("stops at maxDepth and handles dependency cycles safely", async () => {
    const serviceA = createResource("resource-service-a-prod");
    const serviceB = createResource("resource-service-b-prod");
    const serviceC = createResource("resource-service-c-prod");
    const dependencies = [
      createDependency(serviceA.id, serviceB.id),
      createDependency(serviceB.id, serviceC.id),
      createDependency(serviceC.id, serviceA.id),
    ];
    const resolver = createIndirectImpactResolver(
      createCatalogRepository([serviceA, serviceB, serviceC], dependencies),
    );

    const depthOneResources = await resolver.resolveIndirectResources(
      [serviceA],
      1,
    );
    const depthThreeResources = await resolver.resolveIndirectResources(
      [serviceA],
      3,
    );

    assert.deepEqual(
      depthOneResources.map((resource) => resource.id),
      [serviceB.id],
    );
    assert.deepEqual(
      depthThreeResources.map((resource) => resource.id),
      [serviceB.id, serviceC.id],
    );
    assert.equal(depthThreeResources[1]?.path.depth, 2);
    assert.deepEqual(depthThreeResources[1]?.path.resourceIds, [
      serviceA.id,
      serviceB.id,
      serviceC.id,
    ]);
  });
});
