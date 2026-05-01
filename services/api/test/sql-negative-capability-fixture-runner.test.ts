import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DeniedCapabilityProbeOutcome,
  EvidenceCoverageStatus,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  compileSqlForbiddenEffectObligations,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import {
  createSqlReadonlyNegativeProbePlan,
  runSqlNegativeCapabilityFixture,
} from "../src/sql-negative-capability-fixture-runner.js";

const completedAt = "2026-05-01T06:30:00.000Z";
const executorFingerprint = "sha256:sql-readonly-fixture-executor-v1";

const createReadonlyObligations = () =>
  compileSqlForbiddenEffectObligations({
    requestId: "req-sql-readonly-fixture-runner",
    sql: "SELECT id, status FROM orders WHERE status = 'PENDING'",
    environment: ForbiddenEffectEnvironment.Production,
    resourceScope: ["orders"],
  }).obligations;

describe("SQL negative capability fixture runner", () => {
  it("creates write, delete, update, insert, and DDL probe tasks for readonly SQL", () => {
    const obligations = createReadonlyObligations();
    const plan = createSqlReadonlyNegativeProbePlan({
      probePlanId: "nprobe-sql-readonly-orders-v1",
      executorId: "sql-readonly-fixture-executor",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      probeTarget: "orders",
    });

    assert.equal(plan.executorType, "sql");
    assert.equal(plan.targetEnvironment, "production");
    assert.deepEqual(plan.dangerousCapabilitiesToDeny, [
      "write",
      "insert",
      "update",
      "delete",
      "ddl",
    ]);
    assert.deepEqual(
      plan.probeTasks.map((task) => task.operation),
      [
        "INSERT INTO orders (id, probe_value) VALUES (1, 'blocked')",
        "UPDATE orders SET probe_value = 'blocked' WHERE id = 1",
        "DELETE FROM orders WHERE id = 1",
        "CREATE TABLE orders_ddl (id integer)",
        "DROP TABLE orders",
        "TRUNCATE TABLE orders",
        "ALTER TABLE orders ADD COLUMN __asg_probe_text text",
      ],
    );
    assert.deepEqual(
      plan.probeTasks.map((task) => task.probeType),
      [
        ForbiddenEffectEvidenceType.WriteDenial,
        ForbiddenEffectEvidenceType.WriteDenial,
        ForbiddenEffectEvidenceType.DeleteDenial,
        ForbiddenEffectEvidenceType.DdlDenial,
        ForbiddenEffectEvidenceType.DdlDenial,
        ForbiddenEffectEvidenceType.DdlDenial,
        ForbiddenEffectEvidenceType.DdlDenial,
      ],
    );
  });

  it("emits DeniedCapabilityEvidence and covered records for rejected SQL probes", async () => {
    const obligations = createReadonlyObligations();
    const plan = createSqlReadonlyNegativeProbePlan({
      probePlanId: "nprobe-sql-readonly-orders-v1",
      executorId: "sql-readonly-fixture-executor",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      probeTarget: "orders",
    });

    const result = await runSqlNegativeCapabilityFixture({
      plan,
      obligations,
      executorFingerprint,
      completedAt,
    });

    assert.equal(result.databaseConnected, false);
    assert.equal(result.executorId, "sql-readonly-fixture-executor");
    assert.equal(result.failedEvidence.length, 0);
    assert.equal(result.deniedCapabilityEvidence.length, 7);
    assert.equal(result.coverageRecords.length, 7);

    for (const evidence of result.deniedCapabilityEvidence) {
      assert.equal(evidence.probeId, plan.probePlanId);
      assert.equal(evidence.observedRejection, DeniedCapabilityProbeOutcome.Rejected);
      assert.equal(evidence.executorFingerprint, executorFingerprint);
      assert.equal(evidence.completedAt, completedAt);
      assert.equal(
        obligations.some(
          (obligation) => obligation.obligationId === evidence.obligationId,
        ),
        true,
      );
    }

    for (const coverageRecord of result.coverageRecords) {
      assert.equal(coverageRecord.status, EvidenceCoverageStatus.Covered);
      assert.equal(coverageRecord.completedAt, completedAt);
      assert.ok(coverageRecord.evidenceHash.startsWith("sha256:"));
      assert.equal(coverageRecord.evidence?.observedRejection, "rejected");
    }
  });

  it("outputs failed evidence when a dangerous SQL operation is unexpectedly allowed", async () => {
    const obligations = createReadonlyObligations();
    const plan = createSqlReadonlyNegativeProbePlan({
      probePlanId: "nprobe-sql-readonly-orders-v1",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      probeTarget: "orders",
    });

    const result = await runSqlNegativeCapabilityFixture({
      plan,
      obligations,
      executorFingerprint,
      completedAt,
      probeOverrides: [
        {
          attemptedOperation: "DELETE FROM orders WHERE id = 1",
          observedRejection: DeniedCapabilityProbeOutcome.UnexpectedlyAllowed,
          rejectionReason: "fixture detected DELETE was allowed",
        },
      ],
    });

    assert.equal(result.failedEvidence.length, 1);
    assert.equal(
      result.failedEvidence[0]?.observedRejection,
      DeniedCapabilityProbeOutcome.UnexpectedlyAllowed,
    );
    assert.equal(
      result.failedEvidence[0]?.rejectionReason,
      "fixture detected DELETE was allowed",
    );

    const failedRecord = result.coverageRecords.find(
      (record) => record.evidence?.attemptedOperation === "DELETE FROM orders WHERE id = 1",
    );

    assert.equal(failedRecord?.status, EvidenceCoverageStatus.Failed);
    assert.equal(failedRecord?.requiredEvidenceType, ForbiddenEffectEvidenceType.DeleteDenial);
    assert.equal(failedRecord?.failureReason, "fixture detected DELETE was allowed");
  });
});
