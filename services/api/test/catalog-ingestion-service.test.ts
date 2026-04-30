import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import { createCatalogIngestionService } from "../src/catalog-ingestion-service.js";
import { createCatalogRepositories } from "../src/catalog-repository.js";
import { initializeLocalStorage } from "../src/storage.js";
import { CatalogManifestValidationError } from "../src/catalog-ingestion-service.js";

const tempDirs: string[] = [];

const createTempDataDir = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "asg-catalog-ingest-"));
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

const validManifest = {
  serviceId: "payment-service",
  system: "payments",
  owner: "payments-platform",
  environment: "production",
  criticalityLevel: "critical",
  sensitivityLevel: "restricted",
  rollbackCapability: "manual",
  resources: [
    {
      id: "resource-db-table-orders-prod",
      name: "orders",
      type: "database_table",
      system: "commerce",
      environment: "production",
      sensitivityLevel: "restricted",
      criticalityLevel: "critical",
      owner: "commerce-platform",
      rollbackCapability: "manual",
    },
  ],
  deployTarget: {
    pipeline: "payment-service-release",
  },
  configKeys: [
    {
      key: "payment.timeout",
      rollbackCapability: "automatic",
    },
  ],
  dataDependencies: [
    {
      resourceId: "resource-db-table-orders-prod",
      relationType: "writes_to",
    },
  ],
};

const createIngestionContext = async () => {
  const layout = await initializeLocalStorage(await createTempDataDir());
  const ingestionService = createCatalogIngestionService(layout);
  const catalogRepository = createCatalogRepositories(layout);

  return { layout, ingestionService, catalogRepository };
};

describe("catalog ingestion service", () => {
  it("ingests resources and dependencies from a valid service manifest", async () => {
    const { ingestionService, catalogRepository } = await createIngestionContext();

    const summary = await ingestionService.ingestManifest(validManifest);

    assert.equal(summary.idempotent, false);
    assert.deepEqual(summary.resources, {
      received: 4,
      created: 4,
      updated: 0,
      unchanged: 0,
      total: 4,
    });
    assert.deepEqual(summary.dependencies, {
      received: 3,
      created: 3,
      updated: 0,
      unchanged: 0,
      total: 3,
    });

    const resources = await catalogRepository.listResources();
    assert.deepEqual(
      resources.map((resource) => resource.id),
      [
        "resource-db-table-orders-prod",
        "resource-service-payment-service-prod",
        "resource-pipeline-payment-service-release-prod",
        "resource-config-payment-timeout-prod",
      ],
    );
    assert.equal(resources[1]?.owner, "payments-platform");
    assert.equal(resources[1]?.rollbackCapability, "manual");
    assert.equal(resources[2]?.type, "pipeline");
    assert.equal(resources[3]?.type, "config_key");

    const dependencies = await catalogRepository.listDependencies();
    assert.deepEqual(
      dependencies.map((dependency) => [
        dependency.sourceResourceId,
        dependency.targetResourceId,
        dependency.relationType,
      ]),
      [
        [
          "resource-pipeline-payment-service-release-prod",
          "resource-service-payment-service-prod",
          "deploys_to",
        ],
        [
          "resource-config-payment-timeout-prod",
          "resource-service-payment-service-prod",
          "configures",
        ],
        [
          "resource-db-table-orders-prod",
          "resource-service-payment-service-prod",
          "writes_to",
        ],
      ],
    );
  });

  it("rejects invalid resource fields with structured issues", async () => {
    const { ingestionService } = await createIngestionContext();

    await assert.rejects(
      () =>
        ingestionService.ingestManifest({
          resources: [
            {
              id: "orders-prod",
              name: "orders",
              type: "table",
              system: "commerce",
              environment: "prod",
              sensitivityLevel: "restricted",
              criticalityLevel: "critical",
              owner: "commerce-platform",
              rollbackCapability: "scripted",
            },
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof CatalogManifestValidationError);
        assert.deepEqual(
          error.issues.map((issue) => [issue.path, issue.code]),
          [
            ["$.resources[0].id", "invalid_resource_id"],
            ["$.resources[0].type", "invalid_enum"],
            ["$.resources[0].environment", "invalid_enum"],
            ["$.resources[0].rollbackCapability", "invalid_enum"],
            ["$", "empty_manifest_catalog"],
          ],
        );
        return true;
      },
    );
  });

  it("rejects invalid dependency references with structured errors", async () => {
    const { ingestionService } = await createIngestionContext();

    await assert.rejects(
      () =>
        ingestionService.ingestManifest({
          resources: [
            {
              id: "resource-service-payment-service-prod",
              name: "payment-service",
              type: "service",
              system: "payments",
              environment: "production",
              sensitivityLevel: "restricted",
              criticalityLevel: "critical",
              owner: "payments-platform",
              rollbackCapability: "manual",
            },
          ],
          dependencies: [
            {
              sourceResourceId: "resource-service-payment-service-prod",
              targetResourceId: "resource-db-table-missing-prod",
              relationType: "writes_to",
              direction: "upstream",
              environment: "production",
              enabled: true,
            },
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof CatalogManifestValidationError);
        assert.deepEqual(error.issues, [
          {
            path: "$.dependencies[0].targetResourceId",
            code: "unknown_dependency_resource",
            message:
              "Dependency targetResourceId does not reference a known catalog resource.",
            details: {
              resourceId: "resource-db-table-missing-prod",
            },
          },
        ]);
        return true;
      },
    );
  });

  it("is idempotent for unchanged manifests", async () => {
    const { ingestionService, catalogRepository } = await createIngestionContext();

    await ingestionService.ingestManifest(validManifest);
    const firstResources = await catalogRepository.listResources();
    const firstDependencies = await catalogRepository.listDependencies();
    const secondSummary = await ingestionService.ingestManifest(validManifest);

    assert.equal(secondSummary.idempotent, true);
    assert.deepEqual(secondSummary.resources, {
      received: 4,
      created: 0,
      updated: 0,
      unchanged: 4,
      total: 4,
    });
    assert.deepEqual(secondSummary.dependencies, {
      received: 3,
      created: 0,
      updated: 0,
      unchanged: 3,
      total: 3,
    });
    assert.deepEqual(await catalogRepository.listResources(), firstResources);
    assert.deepEqual(await catalogRepository.listDependencies(), firstDependencies);
  });
});
