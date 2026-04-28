import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import type { AuditRecord } from "@agent-safety-gateway/shared";

import { createAuditRepository } from "../src/audit-repository.js";
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

const createAuditRecordFixture = (id: string): AuditRecord => ({
  id,
  request: {
    id: `request-${id}`,
    actor: "agent-codex",
    taskPurpose: "Remove stale pending orders",
    toolType: "sql",
    rawPayload: {
      sql: "DELETE FROM orders WHERE status = 'PENDING'",
      connection: "prod-primary",
    },
    environment: "production",
    createdAt: "2026-04-28T06:00:00.000Z",
  },
  actionTuple: {
    actor: "agent-codex",
    taskPurpose: "Remove stale pending orders",
    toolType: "sql",
    operation: "delete",
    target: "orders",
    parameters: {
      sql: "DELETE FROM orders WHERE status = 'PENDING'",
      connection: "prod-primary",
    },
    environment: "production",
    timestamp: "2026-04-28T06:00:01.000Z",
  },
  directResources: [
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
  ],
  indirectResources: [
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
  ],
  impactPaths: [
    {
      originResourceId: "resource-database-orders-prod",
      impactedResourceId: "resource-service-order-service-prod",
      resourceIds: [
        "resource-database-orders-prod",
        "resource-service-order-service-prod",
      ],
      dependencyIds: ["resource-database-orders-prod->resource-service-order-service-prod"],
      depth: 1,
      environment: "production",
    },
  ],
  riskFactors: [
    {
      category: "operation",
      label: "Destructive SQL DELETE",
      severity: "critical",
      score: 50,
      reason: "DELETE can remove production order data.",
    },
    {
      category: "environment",
      label: "Production environment",
      severity: "critical",
      score: 30,
      reason: "The request targets production.",
    },
  ],
  riskLevel: "prohibited",
  decision: {
    type: "block",
    code: "BLOCK_PRODUCTION_DELETE",
    reason: "Production DELETE on critical orders must not execute.",
    recommendedAction: "Review the affected rows with a SELECT query first.",
    rewrittenRequest: null,
  },
  createdAt: "2026-04-28T06:00:02.000Z",
});

describe("audit repository", () => {
  it("creates and lists audit records from the JSONL store", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createAuditRepository(layout);
    const auditRecord = createAuditRecordFixture("audit-001");

    assert.deepEqual(await repository.createAuditRecord(auditRecord), auditRecord);

    const records = await repository.listAuditRecords();
    assert.deepEqual(records, [auditRecord]);
    assert.deepEqual(records[0]?.request.rawPayload, auditRecord.request.rawPayload);
    assert.deepEqual(records[0]?.actionTuple, auditRecord.actionTuple);
    assert.deepEqual(records[0]?.directResources, auditRecord.directResources);
    assert.deepEqual(records[0]?.indirectResources, auditRecord.indirectResources);
    assert.deepEqual(records[0]?.riskFactors, auditRecord.riskFactors);
    assert.equal(records[0]?.riskLevel, "prohibited");
    assert.deepEqual(records[0]?.decision, auditRecord.decision);
  });

  it("returns audit records by id and null for missing ids", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createAuditRepository(layout);
    const firstRecord = createAuditRecordFixture("audit-001");
    const secondRecord = createAuditRecordFixture("audit-002");

    await repository.createAuditRecord(firstRecord);
    await repository.createAuditRecord(secondRecord);

    assert.deepEqual(await repository.getAuditRecordById("audit-002"), secondRecord);
    assert.equal(await repository.getAuditRecordById("audit-missing"), null);
  });
});
