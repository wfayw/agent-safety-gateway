import assert from "node:assert/strict";
import test from "node:test";

import {
  DeniedCapabilityProbeOutcome,
  EvidenceCoverageStatus,
  EvidenceCoverageStatusValues,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  ForbiddenEffectFailClosedAction,
  ForbiddenEffectSeverity,
  ForbiddenEffectType,
  SideEffectEvidenceType,
  evaluateEvidenceCoverageMap,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

const evaluatedAt = "2026-05-01T06:00:00.000Z";
const executorId = "sql-readonly-prod-001";

const readonlyObligation = {
  obligationId: "feo-coverage-sql-readonly-orders",
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
  obligationId: "feo-coverage-sql-no-mutation-orders",
  effectType: ForbiddenEffectType.Sql,
  resourceScope: ["orders", "orders_audit_trigger_log"],
  environment: ForbiddenEffectEnvironment.Production,
  severity: ForbiddenEffectSeverity.High,
  requiredEvidenceTypes: [
    ForbiddenEffectEvidenceType.NoRowMutation,
    ForbiddenEffectEvidenceType.NoTriggerSideEffect,
  ],
  failClosedAction: ForbiddenEffectFailClosedAction.RequireEvidence,
};

const writeDeniedEvidence = {
  probeId: "negative-probe-write-denial",
  obligationId: readonlyObligation.obligationId,
  attemptedOperation: "INSERT INTO orders VALUES (...) ",
  observedRejection: DeniedCapabilityProbeOutcome.Rejected,
  rejectionReason: "permission denied for readonly executor",
  executorFingerprint: "sha256:executor-fingerprint-v1",
  completedAt: "2026-05-01T05:50:00.000Z",
};

const deleteDeniedEvidence = {
  probeId: "negative-probe-delete-denial",
  obligationId: readonlyObligation.obligationId,
  attemptedOperation: "DELETE FROM orders WHERE id = 1",
  observedRejection: DeniedCapabilityProbeOutcome.Rejected,
  rejectionReason: "permission denied for readonly executor",
  executorFingerprint: "sha256:executor-fingerprint-v1",
  completedAt: "2026-05-01T05:51:00.000Z",
};

const noRowMutationEvidence = {
  probeId: "side-effect-probe-no-row-mutation",
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

const triggerSideEffectEvidence = {
  probeId: "side-effect-probe-trigger-side-effect",
  obligationId: noMutationObligation.obligationId,
  executorId,
  beforeSnapshotHash: "sha256:trigger-log-before",
  afterSnapshotHash: "sha256:trigger-log-after",
  observedEvents: [
    {
      evidenceType: SideEffectEvidenceType.Trigger,
      target: "orders_audit_trigger_log",
      eventHash: "sha256:trigger-event-001",
      observedAt: "2026-05-01T05:53:00.000Z",
    },
  ],
  forbiddenEffectsObserved: [
    {
      evidenceType: SideEffectEvidenceType.Trigger,
      target: "orders_audit_trigger_log",
      eventHash: "sha256:trigger-event-001",
      observedAt: "2026-05-01T05:53:00.000Z",
    },
  ],
  effectDelta: [
    {
      evidenceType: SideEffectEvidenceType.Trigger,
      target: "orders_audit_trigger_log",
      beforeHash: "sha256:trigger-log-before",
      afterHash: "sha256:trigger-log-after",
      changeType: "trigger_inserted_audit_row",
    },
  ],
  completedAt: "2026-05-01T05:53:00.000Z",
  executorFingerprint: "sha256:executor-fingerprint-v1",
};

const evidenceRecord = (overrides) => ({
  obligationId: readonlyObligation.obligationId,
  requiredEvidenceType: ForbiddenEffectEvidenceType.WriteDenial,
  evidenceHash: "sha256:evidence-default",
  completedAt: "2026-05-01T05:50:00.000Z",
  ...overrides,
});

test("supports every EvidenceCoverageStatus value", () => {
  assert.deepEqual(EvidenceCoverageStatusValues, [
    EvidenceCoverageStatus.Covered,
    EvidenceCoverageStatus.Missing,
    EvidenceCoverageStatus.Stale,
    EvidenceCoverageStatus.Invalidated,
    EvidenceCoverageStatus.Failed,
    EvidenceCoverageStatus.NotApplicable,
  ]);
});

test("evaluates a deterministic fully covered EvidenceCoverageMap", () => {
  const first = evaluateEvidenceCoverageMap(
    [noMutationObligation, readonlyObligation],
    [
      evidenceRecord({
        obligationId: noMutationObligation.obligationId,
        requiredEvidenceType: ForbiddenEffectEvidenceType.NoTriggerSideEffect,
        evidenceHash: "sha256:no-trigger-side-effect",
        evidence: {
          ...noRowMutationEvidence,
          probeId: "side-effect-probe-no-trigger-side-effect",
        },
      }),
      evidenceRecord({
        requiredEvidenceType: ForbiddenEffectEvidenceType.DeleteDenial,
        evidenceHash: "sha256:delete-denial",
        evidence: deleteDeniedEvidence,
      }),
      evidenceRecord({
        obligationId: noMutationObligation.obligationId,
        requiredEvidenceType: ForbiddenEffectEvidenceType.NoRowMutation,
        evidenceHash: "sha256:no-row-mutation",
        evidence: noRowMutationEvidence,
      }),
      evidenceRecord({
        evidenceHash: "sha256:write-denial",
        evidence: writeDeniedEvidence,
      }),
    ],
    { executorId, evaluatedAt },
  );
  const second = evaluateEvidenceCoverageMap(
    [readonlyObligation, noMutationObligation],
    [
      evidenceRecord({
        evidenceHash: "sha256:write-denial",
        evidence: writeDeniedEvidence,
      }),
      evidenceRecord({
        requiredEvidenceType: ForbiddenEffectEvidenceType.DeleteDenial,
        evidenceHash: "sha256:delete-denial",
        evidence: deleteDeniedEvidence,
      }),
      evidenceRecord({
        obligationId: noMutationObligation.obligationId,
        requiredEvidenceType: ForbiddenEffectEvidenceType.NoRowMutation,
        evidenceHash: "sha256:no-row-mutation",
        evidence: noRowMutationEvidence,
      }),
      evidenceRecord({
        obligationId: noMutationObligation.obligationId,
        requiredEvidenceType: ForbiddenEffectEvidenceType.NoTriggerSideEffect,
        evidenceHash: "sha256:no-trigger-side-effect",
        evidence: {
          ...noRowMutationEvidence,
          probeId: "side-effect-probe-no-trigger-side-effect",
        },
      }),
    ],
    { executorId, evaluatedAt },
  );

  assert.deepEqual(first, second);
  assert.equal(first.allObligationsCovered, true);
  assert.deepEqual(
    first.obligations.map((obligation) => ({
      obligationId: obligation.obligationId,
      status: obligation.status,
      covered: obligation.covered,
    })),
    [
      {
        obligationId: noMutationObligation.obligationId,
        status: EvidenceCoverageStatus.Covered,
        covered: true,
      },
      {
        obligationId: readonlyObligation.obligationId,
        status: EvidenceCoverageStatus.Covered,
        covered: true,
      },
    ],
  );
  assert.deepEqual(
    first.coverage.map((entry) => `${entry.obligationId}:${entry.requiredEvidenceType}:${entry.status}`),
    [
      `${noMutationObligation.obligationId}:${ForbiddenEffectEvidenceType.NoRowMutation}:covered`,
      `${noMutationObligation.obligationId}:${ForbiddenEffectEvidenceType.NoTriggerSideEffect}:covered`,
      `${readonlyObligation.obligationId}:${ForbiddenEffectEvidenceType.DeleteDenial}:covered`,
      `${readonlyObligation.obligationId}:${ForbiddenEffectEvidenceType.WriteDenial}:covered`,
    ],
  );
});

test("marks partial coverage as missing or stale per required evidence type", () => {
  const coverageMap = evaluateEvidenceCoverageMap(
    [readonlyObligation, noMutationObligation],
    [
      evidenceRecord({
        requiredEvidenceType: ForbiddenEffectEvidenceType.WriteDenial,
        evidenceHash: "sha256:expired-write-denial",
        expiresAt: "2026-05-01T05:59:59.000Z",
        evidence: writeDeniedEvidence,
      }),
      evidenceRecord({
        obligationId: noMutationObligation.obligationId,
        requiredEvidenceType: ForbiddenEffectEvidenceType.NoRowMutation,
        evidenceHash: "sha256:no-row-mutation",
        evidence: noRowMutationEvidence,
      }),
    ],
    { executorId, evaluatedAt },
  );

  assert.equal(coverageMap.allObligationsCovered, false);
  assert.deepEqual(
    coverageMap.coverage.map((entry) => ({
      requiredEvidenceType: entry.requiredEvidenceType,
      status: entry.status,
      covered: entry.covered,
      evidenceHashes: entry.evidenceHashes,
    })),
    [
      {
        requiredEvidenceType: ForbiddenEffectEvidenceType.NoRowMutation,
        status: EvidenceCoverageStatus.Covered,
        covered: true,
        evidenceHashes: ["sha256:no-row-mutation"],
      },
      {
        requiredEvidenceType: ForbiddenEffectEvidenceType.NoTriggerSideEffect,
        status: EvidenceCoverageStatus.Missing,
        covered: false,
        evidenceHashes: [],
      },
      {
        requiredEvidenceType: ForbiddenEffectEvidenceType.DeleteDenial,
        status: EvidenceCoverageStatus.Missing,
        covered: false,
        evidenceHashes: [],
      },
      {
        requiredEvidenceType: ForbiddenEffectEvidenceType.WriteDenial,
        status: EvidenceCoverageStatus.Stale,
        covered: false,
        evidenceHashes: ["sha256:expired-write-denial"],
      },
    ],
  );
});

test("fails closed when evidence reports forbidden effects or explicit invalidation", () => {
  const coverageMap = evaluateEvidenceCoverageMap(
    [readonlyObligation, noMutationObligation],
    [
      evidenceRecord({
        requiredEvidenceType: ForbiddenEffectEvidenceType.WriteDenial,
        evidenceHash: "sha256:invalidated-write-denial",
        invalidatedAt: "2026-05-01T05:55:00.000Z",
        evidence: writeDeniedEvidence,
      }),
      evidenceRecord({
        requiredEvidenceType: ForbiddenEffectEvidenceType.DeleteDenial,
        evidenceHash: "sha256:delete-denial-unexpectedly-allowed",
        evidence: {
          ...deleteDeniedEvidence,
          observedRejection: DeniedCapabilityProbeOutcome.UnexpectedlyAllowed,
        },
      }),
      evidenceRecord({
        obligationId: noMutationObligation.obligationId,
        requiredEvidenceType: ForbiddenEffectEvidenceType.NoRowMutation,
        evidenceHash: "sha256:no-row-mutation",
        evidence: noRowMutationEvidence,
      }),
      evidenceRecord({
        obligationId: noMutationObligation.obligationId,
        requiredEvidenceType: ForbiddenEffectEvidenceType.NoTriggerSideEffect,
        evidenceHash: "sha256:trigger-side-effect-failed",
        evidence: triggerSideEffectEvidence,
      }),
    ],
    { executorId, evaluatedAt },
  );

  assert.equal(coverageMap.allObligationsCovered, false);
  assert.deepEqual(
    coverageMap.obligations.map((obligation) => ({
      obligationId: obligation.obligationId,
      status: obligation.status,
      covered: obligation.covered,
    })),
    [
      {
        obligationId: noMutationObligation.obligationId,
        status: EvidenceCoverageStatus.Failed,
        covered: false,
      },
      {
        obligationId: readonlyObligation.obligationId,
        status: EvidenceCoverageStatus.Failed,
        covered: false,
      },
    ],
  );
  assert.deepEqual(
    coverageMap.coverage.map((entry) => `${entry.requiredEvidenceType}:${entry.status}`),
    [
      `${ForbiddenEffectEvidenceType.NoRowMutation}:covered`,
      `${ForbiddenEffectEvidenceType.NoTriggerSideEffect}:failed`,
      `${ForbiddenEffectEvidenceType.DeleteDenial}:failed`,
      `${ForbiddenEffectEvidenceType.WriteDenial}:invalidated`,
    ],
  );
});
