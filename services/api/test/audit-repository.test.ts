import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import type {
  AuditExecutorSafetyEvidence,
  AuditRecord,
} from "@agent-safety-gateway/shared";
import {
  EvidenceCoverageStatus,
  ExecutorSafetyEvidenceStateName,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  ForbiddenEffectFailClosedAction,
  ForbiddenEffectSeverity,
  ForbiddenEffectType,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

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
  policyVersion: "local-risk-policy-v1",
  policyTrace: {
    thresholds: {
      medium: 30,
      high: 90,
      prohibited: 120,
    },
    weights: {
      operation: 1,
      environment: 1,
      resource_criticality: 1,
      dependency_impact: 1,
      validation_state: 1,
      reversibility: 1,
    },
    hardRules: [
      {
        id: "production_delete_on_critical_resource",
        description:
          "Block production DELETE operations that touch critical resources.",
        matched: true,
      },
      {
        id: "production_deploy_with_failed_tests",
        description: "Block production deployments with failed validation tests.",
        matched: false,
      },
    ],
    matchedRuleIds: [
      "operation.destructive_sql_delete.1",
      "environment.production_environment.2",
      "production_delete_on_critical_resource",
    ],
    weightedFactors: [
      {
        id: "operation.destructive_sql_delete.1",
        category: "operation",
        label: "Destructive SQL DELETE",
        score: 50,
        weight: 1,
        weightedScore: 50,
      },
      {
        id: "environment.production_environment.2",
        category: "environment",
        label: "Production environment",
        score: 30,
        weight: 1,
        weightedScore: 30,
      },
    ],
  },
  decision: {
    type: "block",
    code: "BLOCK_PRODUCTION_DELETE",
    reason: "Production DELETE on critical orders must not execute.",
    recommendedAction: "Review the affected rows with a SELECT query first.",
    rewrittenRequest: null,
  },
  createdAt: "2026-04-28T06:00:02.000Z",
});

const createExecutorSafetyEvidenceFixture = (): AuditExecutorSafetyEvidence => ({
  forbiddenEffectObligations: [
    {
      obligationId: "feo-audit-sql-readonly-write-denial",
      effectType: ForbiddenEffectType.Sql,
      resourceScope: ["orders"],
      environment: ForbiddenEffectEnvironment.Production,
      severity: ForbiddenEffectSeverity.Critical,
      requiredEvidenceTypes: [
        ForbiddenEffectEvidenceType.WriteDenial,
        ForbiddenEffectEvidenceType.NoRowMutation,
      ],
      failClosedAction: ForbiddenEffectFailClosedAction.DenyPermit,
    },
  ],
  coverageMapHash: "sha256:audit-coverage-map",
  safetyEvidenceState: {
    stateId: "safety-state-audit-sql-readonly",
    executorId: "executor-audit-sql-readonly",
    coverageMapId: "coverage-map-audit-sql-readonly",
    state: ExecutorSafetyEvidenceStateName.EvidenceComplete,
    allObligationsCovered: true,
    evaluatedAt: "2026-04-28T06:02:00.000Z",
    coveredObligationIds: ["feo-audit-sql-readonly-write-denial"],
    blockedObligationIds: [],
    blockingStatuses: [],
    transitionReason: "all required obligations are covered by valid evidence",
    validUntil: "2026-04-28T06:07:00.000Z",
    coverageMapHash: "sha256:audit-coverage-map",
    safetyEvidenceVersion: "sev-audit-sql-readonly-001",
  },
  permitIssued: true,
  executorInvoked: true,
  permitBinding: {
    requestHash: "sha256:audit-request-hash",
    executorId: "executor-audit-sql-readonly",
    safetyEvidenceVersion: "sev-audit-sql-readonly-001",
    coverageMapHash: "sha256:audit-coverage-map",
    deniedEvidenceHash: "sha256:audit-denied-evidence",
    sideEffectEvidenceHash: "sha256:audit-side-effect-evidence",
    ttl: 300000,
    nonce: "nonce-audit-permit",
  },
  permitDeniedEvidence: null,
});

const createPermitDeniedSafetyEvidenceFixture = (): AuditExecutorSafetyEvidence => ({
  ...createExecutorSafetyEvidenceFixture(),
  safetyEvidenceState: {
    stateId: "safety-state-audit-sql-denied",
    executorId: "executor-audit-sql-readonly",
    coverageMapId: "coverage-map-audit-sql-readonly",
    state: ExecutorSafetyEvidenceStateName.EvidencePartial,
    allObligationsCovered: false,
    evaluatedAt: "2026-04-28T06:02:00.000Z",
    coveredObligationIds: [],
    blockedObligationIds: ["feo-audit-sql-readonly-write-denial"],
    blockingStatuses: [EvidenceCoverageStatus.Missing],
    transitionReason: "required write denial evidence is missing",
    coverageMapHash: "sha256:audit-coverage-map",
    safetyEvidenceVersion: "sev-audit-sql-readonly-001",
  },
  permitIssued: false,
  executorInvoked: false,
  permitBinding: null,
  permitDeniedEvidence: {
    requestHash: "sha256:audit-request-hash",
    executorId: "executor-audit-sql-readonly",
    permitIssued: false,
    executorInvoked: false,
    missingEvidence: [ForbiddenEffectEvidenceType.WriteDenial],
    invalidatedEvidence: [],
    reason: "required write denial evidence is missing",
  },
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
    assert.equal(records[0]?.policyVersion, "local-risk-policy-v1");
    assert.deepEqual(records[0]?.policyTrace, auditRecord.policyTrace);
    assert.deepEqual(records[0]?.decision, auditRecord.decision);
  });

  it("redacts sensitive rawPayload fields before persisting audit records", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createAuditRepository(layout, {
      redaction: {
        additionalRawPayloadFieldNames: ["connection"],
        replacement: "[MASKED]",
      },
    });
    const auditRecord = createAuditRecordFixture("audit-sensitive");
    auditRecord.request.rawPayload = {
      ...auditRecord.request.rawPayload,
      apiToken: "token-live-123",
      password: "p@ssw0rd",
      authorization: "Bearer live-token",
      connection: "prod-primary",
      connectionString: "postgres://user:pass@db.example/orders",
      nested: {
        clientSecret: "client-secret-value",
      },
    };
    auditRecord.actionTuple.parameters = auditRecord.request.rawPayload;

    const persistedRecord = await repository.createAuditRecord(auditRecord);
    const rawStoreContent = await readFile(layout.stores.audits, "utf8");
    const records = await repository.listAuditRecords();

    assert.equal(persistedRecord.request.rawPayload.sql, auditRecord.request.rawPayload.sql);
    assert.equal(persistedRecord.request.rawPayload.apiToken, "[MASKED]");
    assert.equal(persistedRecord.request.rawPayload.password, "[MASKED]");
    assert.equal(persistedRecord.request.rawPayload.authorization, "[MASKED]");
    assert.equal(persistedRecord.request.rawPayload.connection, "[MASKED]");
    assert.equal(persistedRecord.request.rawPayload.connectionString, "[MASKED]");
    assert.deepEqual(persistedRecord.request.rawPayload.nested, {
      clientSecret: "[MASKED]",
    });
    assert.deepEqual(records, [persistedRecord]);
    assert.equal(records[0]?.actionTuple.parameters.apiToken, "[MASKED]");
    assert.equal(rawStoreContent.includes("token-live-123"), false);
    assert.equal(rawStoreContent.includes("p@ssw0rd"), false);
    assert.equal(rawStoreContent.includes("postgres://user:pass@db.example/orders"), false);
    assert.equal(rawStoreContent.includes("client-secret-value"), false);
    assert.equal(rawStoreContent.includes("prod-primary"), false);
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

  it("updates audit records with executor safety evidence and permit state", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createAuditRepository(layout);
    const auditRecord = createAuditRecordFixture("audit-safety-evidence");
    const safetyEvidence = createExecutorSafetyEvidenceFixture();

    await repository.createAuditRecord(auditRecord);

    const updatedRecord = await repository.updateAuditExecutorSafetyEvidence(
      "audit-safety-evidence",
      safetyEvidence,
    );
    const records = await repository.listAuditRecords();

    assert.deepEqual(updatedRecord?.forbiddenEffectObligations, safetyEvidence.forbiddenEffectObligations);
    assert.equal(updatedRecord?.coverageMapHash, "sha256:audit-coverage-map");
    assert.deepEqual(updatedRecord?.safetyEvidenceState, safetyEvidence.safetyEvidenceState);
    assert.equal(updatedRecord?.permitIssued, true);
    assert.equal(updatedRecord?.executorInvoked, true);
    assert.deepEqual(updatedRecord?.permitBinding, safetyEvidence.permitBinding);
    assert.equal(updatedRecord?.permitDeniedEvidence, null);
    assert.deepEqual(records, [updatedRecord]);
    assert.equal(records[0]?.decision.type, auditRecord.decision.type);
  });

  it("persists PermitDeniedEvidence without breaking existing audit reads", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createAuditRepository(layout);
    const legacyRecord = createAuditRecordFixture("audit-legacy");
    const deniedRecord = createAuditRecordFixture("audit-denied");
    const deniedSafetyEvidence = createPermitDeniedSafetyEvidenceFixture();

    await repository.createAuditRecord(legacyRecord);
    await repository.createAuditRecord(deniedRecord);
    await repository.updateAuditExecutorSafetyEvidence(
      "audit-denied",
      deniedSafetyEvidence,
    );

    const records = await repository.listAuditRecords();
    const persistedDeniedRecord = await repository.getAuditRecordById("audit-denied");

    assert.deepEqual(records[0], legacyRecord);
    assert.equal(records[0]?.forbiddenEffectObligations, undefined);
    assert.equal(persistedDeniedRecord?.permitIssued, false);
    assert.equal(persistedDeniedRecord?.executorInvoked, false);
    assert.equal(persistedDeniedRecord?.permitBinding, null);
    assert.deepEqual(
      persistedDeniedRecord?.permitDeniedEvidence,
      deniedSafetyEvidence.permitDeniedEvidence,
    );
  });

  it("returns null when updating safety evidence for a missing audit record", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createAuditRepository(layout);

    assert.equal(
      await repository.updateAuditExecutorSafetyEvidence(
        "audit-missing",
        createExecutorSafetyEvidenceFixture(),
      ),
      null,
    );
  });
});
