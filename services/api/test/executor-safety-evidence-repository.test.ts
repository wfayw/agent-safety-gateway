import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import type {
  EvidenceCoverageEntry,
  EvidenceCoverageMap,
  EvidenceCoverageRecord,
  EvidenceCoverageObligation,
  ExecutorSafetyEvidenceState,
  ForbiddenEffectObligation,
  PermitBinding,
  PermitDeniedEvidence,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import {
  createExecutorSafetyEvidenceRepository,
  ExecutorSafetyEvidenceRecordKind,
  type ExecutorSafetyEvidenceRecordMetadata,
} from "../src/executor-safety-evidence-repository.js";
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

const metadataFixture = (
  id: string,
  overrides: Partial<ExecutorSafetyEvidenceRecordMetadata> = {},
): ExecutorSafetyEvidenceRecordMetadata => ({
  id,
  requestId: "request-sql-delete-001",
  executorId: "executor-sql-prod",
  evidenceVersion: "evidence-version-001",
  auditId: "audit-sql-delete-001",
  createdAt: "2026-05-01T06:00:00.000Z",
  ...overrides,
});

const obligationFixture: ForbiddenEffectObligation = {
  obligationId: "obligation-sql-delete-denial",
  effectType: "sql",
  resourceScope: ["database.orders"],
  environment: "production",
  severity: "critical",
  requiredEvidenceTypes: ["delete_denial", "no_row_mutation"],
  failClosedAction: "deny_permit",
};

const evidenceRecordFixture: EvidenceCoverageRecord = {
  obligationId: "obligation-sql-delete-denial",
  requiredEvidenceType: "delete_denial",
  evidenceType: "delete_denial",
  evidenceHash: "sha256:denied-capability-001",
  status: "covered",
  completedAt: "2026-05-01T06:00:01.000Z",
};

const coverageEntryFixture: EvidenceCoverageEntry = {
  obligationId: "obligation-sql-delete-denial",
  requiredEvidenceType: "delete_denial",
  status: "covered",
  covered: true,
  evidenceHashes: ["sha256:denied-capability-001"],
  reason: "Executor rejected the destructive SQL mutation probe.",
  evaluatedAt: "2026-05-01T06:00:02.000Z",
  completedAt: "2026-05-01T06:00:01.000Z",
};

const coverageObligationFixture: EvidenceCoverageObligation = {
  obligationId: "obligation-sql-delete-denial",
  status: "covered",
  covered: true,
  requiredEvidence: [coverageEntryFixture],
};

const coverageMapFixture: EvidenceCoverageMap = {
  coverageMapId: "coverage-map-sql-delete-001",
  executorId: "executor-sql-prod",
  evaluatedAt: "2026-05-01T06:00:02.000Z",
  coverage: [coverageEntryFixture],
  obligations: [coverageObligationFixture],
  allObligationsCovered: true,
};

const safetyStateFixture: ExecutorSafetyEvidenceState = {
  stateId: "safety-state-sql-delete-001",
  executorId: "executor-sql-prod",
  coverageMapId: "coverage-map-sql-delete-001",
  state: "EvidenceComplete",
  allObligationsCovered: true,
  evaluatedAt: "2026-05-01T06:00:03.000Z",
  coveredObligationIds: ["obligation-sql-delete-denial"],
  blockedObligationIds: [],
  blockingStatuses: [],
  transitionReason: "All required forbidden side-effect evidence is covered.",
  coverageMapHash: "sha256:coverage-map-001",
  safetyEvidenceVersion: "evidence-version-001",
};

const permitFixture: PermitBinding = {
  requestHash: "sha256:request-sql-delete-001",
  executorId: "executor-sql-prod",
  safetyEvidenceVersion: "evidence-version-001",
  coverageMapHash: "sha256:coverage-map-001",
  deniedEvidenceHash: "sha256:denied-capability-001",
  sideEffectEvidenceHash: "sha256:side-effect-delta-001",
  ttl: 300000,
  nonce: "nonce-sql-delete-001",
};

const denialFixture: PermitDeniedEvidence = {
  requestHash: "sha256:request-sql-delete-001",
  executorId: "executor-sql-prod",
  permitIssued: false,
  executorInvoked: false,
  missingEvidence: ["no_row_mutation"],
  invalidatedEvidence: ["sha256:stale-side-effect-delta-001"],
  reason: "Side-effect delta evidence is missing for the executor.",
};

describe("executor safety evidence repository", () => {
  it("appends all executor safety evidence record kinds to JSONL", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createExecutorSafetyEvidenceRepository(layout);

    await repository.appendObligation(
      metadataFixture("store-obligation-001"),
      obligationFixture,
    );
    await repository.appendEvidenceRecord(
      metadataFixture("store-evidence-record-001"),
      evidenceRecordFixture,
    );
    await repository.appendCoverageMap(
      metadataFixture("store-coverage-map-001"),
      coverageMapFixture,
    );
    await repository.appendSafetyState(
      metadataFixture("store-safety-state-001"),
      safetyStateFixture,
    );
    await repository.appendPermit(metadataFixture("store-permit-001"), permitFixture);
    await repository.appendDenial(metadataFixture("store-denial-001"), denialFixture);

    const records = await repository.listRecords();
    const rawLines = (await readFile(layout.stores.executorSafetyEvidence, "utf8"))
      .trim()
      .split("\n");

    assert.deepEqual(
      records.map((record) => record.kind),
      [
        ExecutorSafetyEvidenceRecordKind.Obligation,
        ExecutorSafetyEvidenceRecordKind.EvidenceRecord,
        ExecutorSafetyEvidenceRecordKind.CoverageMap,
        ExecutorSafetyEvidenceRecordKind.SafetyState,
        ExecutorSafetyEvidenceRecordKind.Permit,
        ExecutorSafetyEvidenceRecordKind.Denial,
      ],
    );
    assert.equal(rawLines.length, 6);
    assert.deepEqual(records[0], {
      ...metadataFixture("store-obligation-001"),
      kind: ExecutorSafetyEvidenceRecordKind.Obligation,
      obligation: obligationFixture,
    });
  });

  it("queries records by request, executor, evidence version, audit, and kind", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createExecutorSafetyEvidenceRepository(layout);

    await repository.appendObligation(
      metadataFixture("store-obligation-001"),
      obligationFixture,
    );
    await repository.appendEvidenceRecord(
      metadataFixture("store-evidence-record-001"),
      evidenceRecordFixture,
    );
    await repository.appendCoverageMap(
      metadataFixture("store-coverage-map-001"),
      coverageMapFixture,
    );
    await repository.appendSafetyState(
      metadataFixture("store-safety-state-001"),
      safetyStateFixture,
    );
    await repository.appendPermit(metadataFixture("store-permit-001"), permitFixture);
    await repository.appendDenial(metadataFixture("store-denial-001"), denialFixture);
    await repository.appendPermit(
      metadataFixture("store-permit-002", {
        requestId: "request-ci-release-001",
        executorId: "executor-ci-prod",
        evidenceVersion: "evidence-version-002",
        auditId: "audit-ci-release-001",
      }),
      { ...permitFixture, executorId: "executor-ci-prod" },
    );

    assert.equal(
      (await repository.listRecords({ requestId: "request-sql-delete-001" }))
        .length,
      6,
    );
    assert.equal(
      (await repository.listRecords({ executorId: "executor-sql-prod" })).length,
      6,
    );
    assert.equal(
      (await repository.listRecords({ evidenceVersion: "evidence-version-001" }))
        .length,
      6,
    );
    assert.equal(
      (await repository.listRecords({ auditId: "audit-sql-delete-001" })).length,
      6,
    );
    assert.deepEqual(
      await repository.listRecords({
        kind: ExecutorSafetyEvidenceRecordKind.Permit,
        requestId: "request-ci-release-001",
      }),
      [
        {
          ...metadataFixture("store-permit-002", {
            requestId: "request-ci-release-001",
            executorId: "executor-ci-prod",
            evidenceVersion: "evidence-version-002",
            auditId: "audit-ci-release-001",
          }),
          kind: ExecutorSafetyEvidenceRecordKind.Permit,
          permit: { ...permitFixture, executorId: "executor-ci-prod" },
        },
      ],
    );
  });

  it("rejects invalid payloads before appending", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createExecutorSafetyEvidenceRepository(layout);

    await assert.rejects(
      () =>
        repository.appendPermit(metadataFixture("store-invalid-permit-001"), {
          ...permitFixture,
          ttl: 0,
        }),
      /Invalid executor safety permit record\./,
    );

    assert.equal(await readFile(layout.stores.executorSafetyEvidence, "utf8"), "");
  });
});
