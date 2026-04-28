import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import type {
  AffectedResource,
  ResourceDependency,
} from "@agent-safety-gateway/shared";

import { createCatalogRepositories } from "../src/catalog-repository.js";
import { initializeLocalStorage } from "../src/storage.js";

const tempDirs: string[] = [];

const createTempDataDir = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "agent-safety-gateway-data-"));
  tempDirs.push(tempDir);
  return tempDir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) =>
      rm(tempDir, { recursive: true, force: true }),
    ),
  );
});

const resources = [
  {
    id: "resource-database-orders-prod",
    name: "orders",
    type: "database_table",
    system: "commerce",
    environment: "production",
    sensitivityLevel: "restricted",
    criticalityLevel: "critical",
    owner: "commerce-platform",
    rollbackCapability: "manual",
  },
  {
    id: "resource-service-order-service-prod",
    name: "order-service",
    type: "service",
    system: "commerce",
    environment: "production",
    sensitivityLevel: "confidential",
    criticalityLevel: "high",
    owner: "commerce-platform",
    rollbackCapability: "automatic",
  },
] satisfies AffectedResource[];

const dependencies = [
  {
    sourceResourceId: "resource-database-orders-prod",
    targetResourceId: "resource-service-order-service-prod",
    relationType: "depends_on",
    direction: "downstream",
    environment: "production",
    enabled: true,
  },
  {
    sourceResourceId: "resource-service-order-service-prod",
    targetResourceId: "resource-database-orders-prod",
    relationType: "writes_to",
    direction: "upstream",
    environment: "production",
    enabled: true,
  },
] satisfies ResourceDependency[];

describe("catalog repositories", () => {
  it("lists resources and returns resources by id from local seed data", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    await writeFile(layout.stores.resources, `${JSON.stringify(resources)}\n`);
    const repository = createCatalogRepositories(layout);

    assert.deepEqual(await repository.listResources(), resources);
    assert.deepEqual(
      await repository.getResourceById("resource-database-orders-prod"),
      resources[0],
    );
    assert.equal(await repository.getResourceById("resource-missing"), null);
  });

  it("lists dependencies and filters dependencies from a source resource", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    await writeFile(
      layout.stores.dependencies,
      `${JSON.stringify(dependencies)}\n`,
    );
    const repository = createCatalogRepositories(layout);

    assert.deepEqual(await repository.listDependencies(), dependencies);
    assert.deepEqual(
      await repository.getDependenciesFromResource(
        "resource-database-orders-prod",
      ),
      [dependencies[0]],
    );
    assert.deepEqual(
      await repository.getDependenciesFromResource("resource-missing"),
      [],
    );
  });
});
