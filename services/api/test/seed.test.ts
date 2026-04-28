import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import type {
  AffectedResource,
  ResourceDependency,
} from "@agent-safety-gateway/shared";

import type { ScenarioRecord } from "../src/scenario-repository.js";
import { seedLocalData } from "../src/seed.js";
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

const readJsonArray = async <Item>(filePath: string): Promise<Item[]> =>
  JSON.parse(await readFile(filePath, "utf8")) as Item[];

describe("seed command data", () => {
  it("writes MVP resources, dependencies, and scenarios", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());

    const summary = await seedLocalData(layout);

    const resources = await readJsonArray<AffectedResource>(
      layout.stores.resources,
    );
    const dependencies = await readJsonArray<ResourceDependency>(
      layout.stores.dependencies,
    );
    const scenarios = await readJsonArray<ScenarioRecord>(
      layout.stores.scenarios,
    );

    assert.deepEqual(summary, {
      resources: 6,
      dependencies: 3,
      scenarios: 4,
    });
    assert.deepEqual(
      resources.map((resource) => resource.name).sort(),
      [
        "order-service",
        "orders",
        "payment-service",
        "payment-service-release",
        "payment.timeout",
        "reconciliation",
      ],
    );
    assert.ok(
      dependencies.some(
        (dependency) =>
          dependency.sourceResourceId === "resource-db-table-orders-prod" &&
          dependency.targetResourceId === "resource-service-order-service-prod",
      ),
    );
    assert.ok(
      dependencies.some(
        (dependency) =>
          dependency.sourceResourceId ===
            "resource-service-payment-service-prod" &&
          dependency.targetResourceId === "resource-service-reconciliation-prod",
      ),
    );
    assert.ok(
      dependencies.some(
        (dependency) =>
          dependency.sourceResourceId === "resource-config-payment-timeout-prod" &&
          dependency.targetResourceId === "resource-service-payment-service-prod",
      ),
    );
    assert.deepEqual(
      scenarios.map((scenario) => scenario.id).sort(),
      [
        "cicd-deploy-payment-service-production",
        "config-payment-timeout-production",
        "sql-delete-orders-production",
        "sql-read-orders-production",
      ],
    );
  });

  it("can run repeatedly without duplicating existing seed data", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    await seedLocalData(layout);
    await seedLocalData(layout);

    const resources = await readJsonArray<AffectedResource>(
      layout.stores.resources,
    );
    const dependencies = await readJsonArray<ResourceDependency>(
      layout.stores.dependencies,
    );
    const scenarios = await readJsonArray<ScenarioRecord>(
      layout.stores.scenarios,
    );

    assert.equal(new Set(resources.map((resource) => resource.id)).size, 6);
    assert.equal(
      new Set(
        dependencies.map(
          (dependency) =>
            `${dependency.sourceResourceId}:${dependency.targetResourceId}`,
        ),
      ).size,
      3,
    );
    assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 4);
  });

  it("preserves existing local records while appending missing seeds", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    await writeFile(
      layout.stores.resources,
      `${JSON.stringify([
        {
          id: "resource-custom-prod",
          name: "custom-resource",
          type: "service",
          system: "custom",
          environment: "production",
          sensitivityLevel: "internal",
          criticalityLevel: "low",
          owner: "custom-team",
          rollbackCapability: "automatic",
        },
      ])}\n`,
    );

    const summary = await seedLocalData(layout);
    const resources = await readJsonArray<AffectedResource>(
      layout.stores.resources,
    );

    assert.equal(summary.resources, 7);
    assert.ok(
      resources.some((resource) => resource.id === "resource-custom-prod"),
    );
  });
});
