import assert from "node:assert/strict";
import test from "node:test";

import {
  DeniedCapabilityProbeOutcome,
  EvidenceCoverageStatus,
  ExecutorSafetyEvidenceStateName,
  ExecutorSafetyEvidenceStateNameValues,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  ForbiddenEffectFailClosedAction,
  ForbiddenEffectSeverity,
  ForbiddenEffectType,
  evaluateEvidenceCoverageMap,
  evaluateExecutorSafetyEvidenceState,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

const evaluatedAt = "2026-05-01T06:00:00.000Z";
const executorId = "sql-readonly-prod-001";
const oneHourMs = 60 * 60 * 1000;
const fiveMinutesMs = 5 * 60 * 1000;

const readonlyObligation = {
  obligationId: "feo-state-sql-readonly-orders",
  effectType: ForbiddenEffectType.Sql,
  resourceScope: ["orders"],
  environment: ForbiddenEffectEnvironment.Production,
  severity: ForbiddenEffectSeverity.Critical,
  requiredEvidenceTypes: [
    ForbiddenEffectEvidenceType.WriteDenial,
    ForbiddenEffectEvidenceType.DeleteDenial,
  ],
  failClosedAction: ForbiddenEffectFailClosedAction.DenyPermit,
};

const noMutationObligation = {
  obligationId: "feo-state-sql-no-mutation-orders",
  effectType: ForbiddenEffectType.Sql,
  resourceScope: ["orders", "orders_audit_trigger_log"],
  environment: ForbiddenEffectEnvironment.Production,
  severity: ForbiddenEffectSeverity.High,
  requiredEvidenceTypes: [ForbiddenEffectEvidenceType.NoRowMutation],
  failClosedAction: ForbiddenEffectFailClosedAction.RequireEvidence,
};

const writeDeniedEvidence = {
  probeId: "negative-probe-state-write-denial",
  obligationId: readonlyObligation.obligationId,
  attemptedOperation: "INSERT INTO orders VALUES (...) ",
  observedRejection: DeniedCapabilityProbeOutcome.Rejected,
  rejectionReason: "permission denied for readonly executor",
  executorFingerprint: "sha256:executor-fingerprint-v1",
  completedAt: "2026-05-01T05:50:00.000Z",
};

const deleteDeniedEvidence = {
  probeId: "negative-probe-state-delete-denial",
  obligationId: readonlyObligation.obligationId,
  attemptedOperation: "DELETE FROM orders WHERE id = 1",
  observedRejection: DeniedCapabilityProbeOutcome.Rejected,
  rejectionReason: "permission denied for readonly executor",
  executorFingerprint: "sha256:executor-fingerprint-v1",
  completedAt: "2026-05-01T05:51:00.000Z",
};

const noRowMutationEvidence = {
  probeId: "side-effect-probe-state-no-row-mutation",
  obligationId: noMutationObligation.obligationId,
  executorId,
  beforeSnapshotHash: "sha256:orders-before",
  afterSnapshotHash: "sha256:orders-before",
  observedEvents: [],
  forbiddenEffectsObserved: [],
  effectDelta: [],
  completedAt: "2026-05-01T05:52:00.000Z",
  executorFingerprint: "sha256:executor-fingerprint-v1",
};

const evidenceRecord = (overrides = {}) => ({
  obligationId: readonlyObligation.obligationId,
  requiredEvidenceType: ForbiddenEffectEvidenceType.WriteDenial,
  evidenceHash: "sha256:state-evidence-default",
  completedAt: "2026-05-01T05:50:00.000Z",
  ...overrides,
});

const buildCompleteCoverageMap = () =>
  evaluateEvidenceCoverageMap(
    [readonlyObligation, noMutationObligation],
    [
      evidenceRecord({
        evidenceHash: "sha256:state-write-denial",
        evidence: writeDeniedEvidence,
      }),
      evidenceRecord({
        requiredEvidenceType: ForbiddenEffectEvidenceType.DeleteDenial,
        evidenceHash: "sha256:state-delete-denial",
        completedAt: "2026-05-01T05:51:00.000Z",
        evidence: deleteDeniedEvidence,
      }),
      evidenceRecord({
        obligationId: noMutationObligation.obligationId,
        requiredEvidenceType: ForbiddenEffectEvidenceType.NoRowMutation,
        evidenceHash: "sha256:state-no-row-mutation",
        completedAt: "2026-05-01T05:52:00.000Z",
        evidence: noRowMutationEvidence,
      }),
    ],
    { executorId, evaluatedAt },
  );

test("supports every ExecutorSafetyEvidenceStateName value", () => {
  assert.deepEqual(ExecutorSafetyEvidenceStateNameValues, [
    ExecutorSafetyEvidenceStateName.EvidenceMissing,
    ExecutorSafetyEvidenceStateName.EvidencePartial,
    ExecutorSafetyEvidenceStateName.EvidenceComplete,
    ExecutorSafetyEvidenceStateName.EvidenceExpired,
    ExecutorSafetyEvidenceStateName.EvidenceInvalidated,
    ExecutorSafetyEvidenceStateName.EvidenceFailed,
  ]);
});

test("enters EvidenceComplete only when every required obligation is valid", () => {
  const safetyState = evaluateExecutorSafetyEvidenceState(
    buildCompleteCoverageMap(),
    {
      evidenceTtlMs: oneHourMs,
      coverageMapHash: "sha256:coverage-map-state-complete",
      safetyEvidenceVersion: "sev-state-complete-v1",
    },
  );

  assert.equal(
    safetyState.state,
    ExecutorSafetyEvidenceStateName.EvidenceComplete,
  );
  assert.equal(safetyState.allObligationsCovered, true);
  assert.equal(safetyState.validUntil, "2026-05-01T06:50:00.000Z");
  assert.deepEqual(safetyState.blockingStatuses, []);
  assert.deepEqual(safetyState.blockedObligationIds, []);
  assert.deepEqual(safetyState.coveredObligationIds, [
    noMutationObligation.obligationId,
    readonlyObligation.obligationId,
  ]);
  assert.equal(safetyState.coverageMapHash, "sha256:coverage-map-state-complete");
  assert.equal(safetyState.safetyEvidenceVersion, "sev-state-complete-v1");
});

test("enters EvidenceMissing when no required evidence is covered", () => {
  const coverageMap = evaluateEvidenceCoverageMap(
    [readonlyObligation],
    [],
    { executorId, evaluatedAt },
  );
  const safetyState = evaluateExecutorSafetyEvidenceState(coverageMap);

  assert.equal(
    safetyState.state,
    ExecutorSafetyEvidenceStateName.EvidenceMissing,
  );
  assert.equal(safetyState.allObligationsCovered, false);
  assert.deepEqual(safetyState.blockingStatuses, [
    EvidenceCoverageStatus.Missing,
  ]);
  assert.deepEqual(safetyState.blockedObligationIds, [
    readonlyObligation.obligationId,
  ]);
});

test("enters EvidencePartial when coverage is valid but incomplete", () => {
  const coverageMap = evaluateEvidenceCoverageMap(
    [readonlyObligation, noMutationObligation],
    [
      evidenceRecord({
        evidenceHash: "sha256:state-write-denial",
        evidence: writeDeniedEvidence,
      }),
      evidenceRecord({
        requiredEvidenceType: ForbiddenEffectEvidenceType.DeleteDenial,
        evidenceHash: "sha256:state-delete-denial",
        completedAt: "2026-05-01T05:51:00.000Z",
        evidence: deleteDeniedEvidence,
      }),
    ],
    { executorId, evaluatedAt },
  );
  const safetyState = evaluateExecutorSafetyEvidenceState(coverageMap);

  assert.equal(
    safetyState.state,
    ExecutorSafetyEvidenceStateName.EvidencePartial,
  );
  assert.equal(safetyState.allObligationsCovered, false);
  assert.deepEqual(safetyState.coveredObligationIds, [
    readonlyObligation.obligationId,
  ]);
  assert.deepEqual(safetyState.blockedObligationIds, [
    noMutationObligation.obligationId,
  ]);
  assert.deepEqual(safetyState.blockingStatuses, [
    EvidenceCoverageStatus.Missing,
  ]);
});

test("enters EvidenceExpired when coverage is stale", () => {
  const coverageMap = evaluateEvidenceCoverageMap(
    [readonlyObligation],
    [
      evidenceRecord({
        evidenceHash: "sha256:state-expired-write-denial",
        expiresAt: "2026-05-01T05:59:59.000Z",
        evidence: writeDeniedEvidence,
      }),
      evidenceRecord({
        requiredEvidenceType: ForbiddenEffectEvidenceType.DeleteDenial,
        evidenceHash: "sha256:state-delete-denial",
        completedAt: "2026-05-01T05:51:00.000Z",
        evidence: deleteDeniedEvidence,
      }),
    ],
    { executorId, evaluatedAt },
  );
  const safetyState = evaluateExecutorSafetyEvidenceState(coverageMap);

  assert.equal(
    safetyState.state,
    ExecutorSafetyEvidenceStateName.EvidenceExpired,
  );
  assert.equal(safetyState.validUntil, "2026-05-01T05:59:59.000Z");
  assert.deepEqual(safetyState.blockingStatuses, [EvidenceCoverageStatus.Stale]);
  assert.deepEqual(safetyState.blockedObligationIds, [
    readonlyObligation.obligationId,
  ]);
});

test("enters EvidenceExpired when evidence exceeds TTL", () => {
  const safetyState = evaluateExecutorSafetyEvidenceState(
    buildCompleteCoverageMap(),
    { evidenceTtlMs: fiveMinutesMs },
  );

  assert.equal(
    safetyState.state,
    ExecutorSafetyEvidenceStateName.EvidenceExpired,
  );
  assert.equal(safetyState.validUntil, "2026-05-01T05:55:00.000Z");
  assert.deepEqual(safetyState.blockingStatuses, [EvidenceCoverageStatus.Stale]);
  assert.deepEqual(safetyState.blockedObligationIds, [
    noMutationObligation.obligationId,
    readonlyObligation.obligationId,
  ]);
});

test("enters EvidenceInvalidated when coverage was invalidated", () => {
  const coverageMap = evaluateEvidenceCoverageMap(
    [readonlyObligation],
    [
      evidenceRecord({
        evidenceHash: "sha256:state-invalidated-write-denial",
        invalidatedAt: "2026-05-01T05:55:00.000Z",
        evidence: writeDeniedEvidence,
      }),
      evidenceRecord({
        requiredEvidenceType: ForbiddenEffectEvidenceType.DeleteDenial,
        evidenceHash: "sha256:state-delete-denial",
        completedAt: "2026-05-01T05:51:00.000Z",
        evidence: deleteDeniedEvidence,
      }),
    ],
    { executorId, evaluatedAt },
  );
  const safetyState = evaluateExecutorSafetyEvidenceState(coverageMap);

  assert.equal(
    safetyState.state,
    ExecutorSafetyEvidenceStateName.EvidenceInvalidated,
  );
  assert.deepEqual(safetyState.blockingStatuses, [
    EvidenceCoverageStatus.Invalidated,
  ]);
  assert.deepEqual(safetyState.blockedObligationIds, [
    readonlyObligation.obligationId,
  ]);
});

test("enters EvidenceFailed when any safety proof fails", () => {
  const coverageMap = evaluateEvidenceCoverageMap(
    [readonlyObligation],
    [
      evidenceRecord({
        evidenceHash: "sha256:state-failed-write-denial",
        evidence: {
          ...writeDeniedEvidence,
          observedRejection: DeniedCapabilityProbeOutcome.UnexpectedlyAllowed,
        },
      }),
      evidenceRecord({
        requiredEvidenceType: ForbiddenEffectEvidenceType.DeleteDenial,
        evidenceHash: "sha256:state-delete-denial",
        completedAt: "2026-05-01T05:51:00.000Z",
        evidence: deleteDeniedEvidence,
      }),
    ],
    { executorId, evaluatedAt },
  );
  const safetyState = evaluateExecutorSafetyEvidenceState(coverageMap);

  assert.equal(
    safetyState.state,
    ExecutorSafetyEvidenceStateName.EvidenceFailed,
  );
  assert.deepEqual(safetyState.blockingStatuses, [EvidenceCoverageStatus.Failed]);
  assert.deepEqual(safetyState.blockedObligationIds, [
    readonlyObligation.obligationId,
  ]);
});
