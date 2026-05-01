import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EvidenceCoverageStatus,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  SideEffectEvidenceType,
  compileSqlForbiddenEffectObligations,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import {
  createSqlSideEffectProbePlan,
  createSqlSideEffectSnapshot,
  runSqlSideEffectSnapshotFixture,
  type SqlSideEffectSnapshotFixtureState,
} from "../src/sql-side-effect-snapshot-fixture-runner.js";

const completedAt = "2026-05-01T07:10:00.000Z";
const executorFingerprint = "sha256:sql-dry-run-fixture-executor-v1";

const beforeSnapshot: SqlSideEffectSnapshotFixtureState = {
  rows: [
    { id: 1, status: "PENDING", amountCents: 1250 },
    { id: 2, status: "PAID", amountCents: 9900 },
  ],
  triggerLogs: [{ id: "trigger-log-001", event: "baseline" }],
  asyncJobLogs: [{ id: "job-001", queue: "invoice", status: "baseline" }],
};

const createReadonlyObligations = () =>
  compileSqlForbiddenEffectObligations({
    requestId: "req-sql-side-effect-fixture-runner",
    sql: "SELECT id, status FROM orders WHERE status = 'PENDING'",
    environment: ForbiddenEffectEnvironment.Production,
    resourceScope: ["orders"],
  }).obligations;

describe("SQL side-effect snapshot fixture runner", () => {
  it("hashes rows, trigger logs, and async job logs deterministically", () => {
    const firstSnapshot = createSqlSideEffectSnapshot({
      rows: [{ status: "PENDING", id: 1 }],
      triggerLogs: [{ triggerName: "orders_audit", id: 1 }],
      asyncJobLogs: [{ queue: "billing", id: 1 }],
    });
    const reorderedFieldsSnapshot = createSqlSideEffectSnapshot({
      rows: [{ id: 1, status: "PENDING" }],
      triggerLogs: [{ id: 1, triggerName: "orders_audit" }],
      asyncJobLogs: [{ id: 1, queue: "billing" }],
    });

    assert.equal(firstSnapshot.rowsHash, reorderedFieldsSnapshot.rowsHash);
    assert.equal(
      firstSnapshot.triggerLogsHash,
      reorderedFieldsSnapshot.triggerLogsHash,
    );
    assert.equal(
      firstSnapshot.asyncJobLogsHash,
      reorderedFieldsSnapshot.asyncJobLogsHash,
    );
    assert.equal(firstSnapshot.snapshotHash, reorderedFieldsSnapshot.snapshotHash);
    assert.ok(firstSnapshot.rowsHash.startsWith("sha256:"));
    assert.ok(firstSnapshot.triggerLogsHash.startsWith("sha256:"));
    assert.ok(firstSnapshot.asyncJobLogsHash.startsWith("sha256:"));
  });

  it("emits covered dry-run evidence for unchanged SQL fixture snapshots", async () => {
    const obligations = createReadonlyObligations();
    const plan = createSqlSideEffectProbePlan({
      probePlanId: "sprobe-sql-readonly-orders-v1",
      executorId: "sql-dry-run-fixture-executor",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      snapshotTarget: "orders",
    });

    const result = await runSqlSideEffectSnapshotFixture({
      plan,
      obligations,
      beforeSnapshot,
      afterSnapshot: beforeSnapshot,
      executorFingerprint,
      completedAt,
    });

    assert.equal(result.databaseConnected, false);
    assert.equal(result.dryRunMode, "fixture");
    assert.equal(result.executorId, "sql-dry-run-fixture-executor");
    assert.equal(
      result.beforeSnapshot.snapshotHash,
      result.afterSnapshot.snapshotHash,
    );
    assert.equal(result.sideEffectDeltaEvidence.length, 3);
    assert.equal(result.failedEvidence.length, 0);
    assert.equal(result.forbiddenEffectsObserved.length, 0);
    assert.deepEqual(
      result.coverageRecords.map((record) => record.requiredEvidenceType).sort(),
      [
        ForbiddenEffectEvidenceType.NoExternalSideEffect,
        ForbiddenEffectEvidenceType.NoRowMutation,
        ForbiddenEffectEvidenceType.NoTriggerSideEffect,
      ].sort(),
    );

    for (const coverageRecord of result.coverageRecords) {
      assert.equal(coverageRecord.status, EvidenceCoverageStatus.Covered);
      assert.equal(coverageRecord.completedAt, completedAt);
      assert.ok(coverageRecord.evidenceHash.startsWith("sha256:"));
      assert.equal(
        coverageRecord.evidence?.beforeSnapshotHash,
        result.beforeSnapshot.snapshotHash,
      );
      assert.equal(
        coverageRecord.evidence?.afterSnapshotHash,
        result.afterSnapshot.snapshotHash,
      );
      assert.equal(coverageRecord.evidence?.forbiddenEffectsObserved.length, 0);
      assert.equal(coverageRecord.evidence?.effectDelta.length, 0);
    }
  });

  it("fails closed and records forbidden effects when SQL snapshots change", async () => {
    const obligations = createReadonlyObligations();
    const plan = createSqlSideEffectProbePlan({
      probePlanId: "sprobe-sql-readonly-orders-v1",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      snapshotTarget: "orders",
    });
    const afterSnapshot: SqlSideEffectSnapshotFixtureState = {
      rows: [
        { id: 1, status: "CANCELLED", amountCents: 1250 },
        { id: 2, status: "PAID", amountCents: 9900 },
      ],
      triggerLogs: [
        { id: "trigger-log-001", event: "baseline" },
        { id: "trigger-log-002", event: "orders_updated" },
      ],
      asyncJobLogs: [
        { id: "job-001", queue: "invoice", status: "baseline" },
        { id: "job-002", queue: "invoice", status: "enqueued" },
      ],
    };

    const result = await runSqlSideEffectSnapshotFixture({
      plan,
      obligations,
      executorId: "sql-dry-run-fixture-executor",
      beforeSnapshot,
      afterSnapshot,
      executorFingerprint,
      completedAt,
    });

    assert.notEqual(
      result.beforeSnapshot.snapshotHash,
      result.afterSnapshot.snapshotHash,
    );
    assert.equal(result.coverageRecords.length, 3);
    assert.equal(result.failedEvidence.length, 3);
    assert.equal(result.forbiddenEffectsObserved.length, 3);
    assert.deepEqual(
      result.forbiddenEffectsObserved.map((event) => event.evidenceType).sort(),
      [
        SideEffectEvidenceType.AsyncJob,
        SideEffectEvidenceType.Database,
        SideEffectEvidenceType.Trigger,
      ].sort(),
    );

    const rowMutationRecord = result.coverageRecords.find(
      (record) =>
        record.requiredEvidenceType === ForbiddenEffectEvidenceType.NoRowMutation,
    );
    const triggerRecord = result.coverageRecords.find(
      (record) =>
        record.requiredEvidenceType ===
        ForbiddenEffectEvidenceType.NoTriggerSideEffect,
    );
    const asyncJobRecord = result.coverageRecords.find(
      (record) =>
        record.requiredEvidenceType ===
        ForbiddenEffectEvidenceType.NoExternalSideEffect,
    );

    assert.equal(rowMutationRecord?.status, EvidenceCoverageStatus.Failed);
    assert.equal(triggerRecord?.status, EvidenceCoverageStatus.Failed);
    assert.equal(asyncJobRecord?.status, EvidenceCoverageStatus.Failed);
    assert.match(rowMutationRecord?.failureReason ?? "", /row_mutation/);
    assert.match(triggerRecord?.failureReason ?? "", /trigger_side_effect/);
    assert.match(asyncJobRecord?.failureReason ?? "", /async_job_side_effect/);
    assert.equal(
      rowMutationRecord?.evidence?.effectDelta[0]?.evidenceType,
      SideEffectEvidenceType.Database,
    );
    assert.equal(
      triggerRecord?.evidence?.effectDelta[0]?.evidenceType,
      SideEffectEvidenceType.Trigger,
    );
    assert.equal(
      asyncJobRecord?.evidence?.effectDelta[0]?.evidenceType,
      SideEffectEvidenceType.AsyncJob,
    );
  });
});
