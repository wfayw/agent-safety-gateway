import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CriticalityLevel,
  Environment,
  OperationType,
  ResourceType,
  RollbackCapability,
  SensitivityLevel,
  ToolType,
  type ActionTuple,
  type AffectedResource,
} from "@agent-safety-gateway/shared";

import type { ResourceRepository } from "../src/catalog-repository.js";
import {
  DirectResourceResolutionStatus,
  createDirectImpactResolver,
} from "../src/direct-impact-resolver.js";

const resources = [
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
] satisfies AffectedResource[];

const createResourceRepository = (
  resourceRecords: readonly AffectedResource[],
): ResourceRepository => ({
  async listResources() {
    return [...resourceRecords];
  },
  async getResourceById(resourceId) {
    return resourceRecords.find((resource) => resource.id === resourceId) ?? null;
  },
});

const createActionTuple = (
  overrides: Partial<ActionTuple> = {},
): ActionTuple => ({
  actor: "agent:codex",
  taskPurpose: "Resolve direct resources before execution",
  toolType: ToolType.Sql,
  operation: OperationType.Delete,
  target: "orders",
  parameters: {},
  environment: Environment.Production,
  timestamp: "2026-04-28T07:30:00.000Z",
  ...overrides,
});

describe("direct impact resolver", () => {
  it("maps an action tuple target to matching resource catalog records", async () => {
    const resolver = createDirectImpactResolver(
      createResourceRepository(resources),
    );

    const directResources = await resolver.resolveDirectResources(
      createActionTuple(),
    );

    assert.equal(directResources.length, 1);
    assert.equal(directResources[0]?.id, "resource-db-table-orders-prod");
    assert.equal(directResources[0]?.type, ResourceType.DatabaseTable);
    assert.equal(directResources[0]?.system, "commerce");
    assert.equal(directResources[0]?.environment, Environment.Production);
    assert.equal(
      directResources[0]?.sensitivityLevel,
      SensitivityLevel.Restricted,
    );
    assert.equal(
      directResources[0]?.criticalityLevel,
      CriticalityLevel.Critical,
    );
    assert.equal(directResources[0]?.operation, OperationType.Delete);
    assert.deepEqual(directResources[0]?.rollback, {
      capability: RollbackCapability.Manual,
      reversible: true,
    });
    assert.equal(
      directResources[0]?.resolutionStatus,
      DirectResourceResolutionStatus.Matched,
    );
  });

  it("creates an unresolved placeholder when the target is missing", async () => {
    const resolver = createDirectImpactResolver(
      createResourceRepository(resources),
    );

    const directResources = await resolver.resolveDirectResources(
      createActionTuple({ target: "archived_orders" }),
    );

    assert.deepEqual(directResources, [
      {
        id: "unresolved-production-sql-archived-orders",
        name: "archived_orders",
        type: ResourceType.DatabaseTable,
        system: "unresolved",
        environment: Environment.Production,
        sensitivityLevel: SensitivityLevel.Internal,
        criticalityLevel: CriticalityLevel.Medium,
        owner: "unknown",
        rollbackCapability: RollbackCapability.Unknown,
        operation: OperationType.Delete,
        resolutionStatus: DirectResourceResolutionStatus.Unresolved,
        rollback: {
          capability: RollbackCapability.Unknown,
          reversible: false,
        },
      },
    ]);
  });

  it("matches config parser targets to config key resources", async () => {
    const resolver = createDirectImpactResolver(
      createResourceRepository(resources),
    );

    const directResources = await resolver.resolveDirectResources(
      createActionTuple({
        toolType: ToolType.Config,
        operation: OperationType.Update,
        target: "payment-service.payment.timeout",
      }),
    );

    assert.equal(directResources[0]?.id, "resource-config-payment-timeout-prod");
    assert.equal(directResources[0]?.type, ResourceType.ConfigKey);
    assert.equal(directResources[0]?.operation, OperationType.Update);
    assert.deepEqual(directResources[0]?.rollback, {
      capability: RollbackCapability.Automatic,
      reversible: true,
    });
  });
});
