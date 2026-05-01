import assert from "node:assert/strict";
import test from "node:test";

import {
  compareExecutorDriftFingerprints,
  DeniedCapabilityProbeOutcome,
  ExecutorDriftFingerprintField,
  ExecutorDriftFingerprintFieldValues,
  ForbiddenEffectEvidenceType,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

const previousFingerprint = {
  fingerprintHash: "sha256:executor-drift-fingerprint-v1",
  credential: "sha256:vault-readonly-credential-v1",
  networkPolicy: "sha256:egress-deny-production-v1",
  runnerImage: "sha256:runner-image-readonly-v1",
  endpoint: "sha256:orders-readonly-endpoint-v1",
  namespace: "sha256:orders-sandbox-namespace-v1",
  configHash: "sha256:executor-config-v1",
  capturedAt: "2026-05-01T05:00:00.000Z",
};

const currentFingerprint = {
  ...previousFingerprint,
  fingerprintHash: "sha256:executor-drift-fingerprint-v2",
  capturedAt: "2026-05-01T06:00:00.000Z",
};

const deniedWriteEvidence = {
  probeId: "negative-probe-drift-write-denial",
  obligationId: "feo-drift-sql-readonly-orders",
  attemptedOperation: "INSERT INTO orders VALUES (...) ",
  observedRejection: DeniedCapabilityProbeOutcome.Rejected,
  rejectionReason: "readonly executor rejected SQL INSERT",
  executorFingerprint: previousFingerprint.fingerprintHash,
  completedAt: "2026-05-01T05:10:00.000Z",
};

const noMutationEvidence = {
  probeId: "side-effect-probe-drift-no-row-mutation",
  obligationId: "feo-drift-sql-no-mutation-orders",
  executorId: "sql-readonly-prod-001",
  beforeSnapshotHash: "sha256:orders-before",
  afterSnapshotHash: "sha256:orders-before",
  observedEvents: [],
  forbiddenEffectsObserved: [],
  effectDelta: [],
  completedAt: "2026-05-01T05:11:00.000Z",
  executorFingerprint: previousFingerprint.fingerprintHash,
};

const evidenceRecords = [
  {
    obligationId: noMutationEvidence.obligationId,
    requiredEvidenceType: ForbiddenEffectEvidenceType.NoRowMutation,
    evidenceHash: "sha256:drift-no-row-mutation-evidence",
    evidence: noMutationEvidence,
  },
  {
    obligationId: deniedWriteEvidence.obligationId,
    requiredEvidenceType: ForbiddenEffectEvidenceType.WriteDenial,
    evidenceHash: "sha256:drift-write-denial-evidence",
    evidence: deniedWriteEvidence,
  },
  {
    obligationId: "feo-drift-current-fingerprint",
    requiredEvidenceType: ForbiddenEffectEvidenceType.DeleteDenial,
    evidenceHash: "sha256:drift-current-fingerprint-evidence",
    evidence: {
      ...deniedWriteEvidence,
      obligationId: "feo-drift-current-fingerprint",
      executorFingerprint: currentFingerprint.fingerprintHash,
    },
  },
  {
    obligationId: "feo-drift-unbound-evidence",
    requiredEvidenceType: ForbiddenEffectEvidenceType.DdlDenial,
    evidenceHash: "sha256:drift-unbound-evidence",
  },
];

test("supports every ExecutorDriftFingerprintField value", () => {
  assert.deepEqual(ExecutorDriftFingerprintFieldValues, [
    ExecutorDriftFingerprintField.Credential,
    ExecutorDriftFingerprintField.NetworkPolicy,
    ExecutorDriftFingerprintField.RunnerImage,
    ExecutorDriftFingerprintField.Endpoint,
    ExecutorDriftFingerprintField.Namespace,
    ExecutorDriftFingerprintField.ConfigHash,
  ]);
});

test("reports no drift when security-relevant fingerprint fields match", () => {
  const comparison = compareExecutorDriftFingerprints(
    {
      previous: previousFingerprint,
      current: { ...previousFingerprint },
    },
    evidenceRecords,
  );

  assert.equal(comparison.hasDrift, false);
  assert.deepEqual(comparison.changedFields, []);
  assert.equal(
    comparison.previousFingerprintHash,
    previousFingerprint.fingerprintHash,
  );
  assert.equal(comparison.currentFingerprintHash, previousFingerprint.fingerprintHash);
  assert.deepEqual(comparison.affectedEvidenceHashes, []);
  assert.deepEqual(comparison.affectedEvidenceTypes, []);
  assert.deepEqual(comparison.affectedObligationIds, []);
  assert.deepEqual(comparison.affectedEvidenceRecords, []);
});

test("detects a single credential drift and scopes previously bound evidence", () => {
  const comparison = compareExecutorDriftFingerprints(
    {
      previous: previousFingerprint,
      current: {
        ...currentFingerprint,
        credential: "sha256:vault-readonly-credential-v2",
      },
    },
    evidenceRecords,
  );

  assert.equal(comparison.hasDrift, true);
  assert.deepEqual(comparison.changedFields, [
    ExecutorDriftFingerprintField.Credential,
  ]);
  assert.equal(
    comparison.previousFingerprintHash,
    previousFingerprint.fingerprintHash,
  );
  assert.equal(comparison.currentFingerprintHash, currentFingerprint.fingerprintHash);
  assert.deepEqual(comparison.affectedEvidenceHashes, [
    "sha256:drift-no-row-mutation-evidence",
    "sha256:drift-write-denial-evidence",
  ]);
  assert.deepEqual(comparison.affectedEvidenceTypes, [
    ForbiddenEffectEvidenceType.NoRowMutation,
    ForbiddenEffectEvidenceType.WriteDenial,
  ]);
  assert.deepEqual(comparison.affectedObligationIds, [
    noMutationEvidence.obligationId,
    deniedWriteEvidence.obligationId,
  ]);
  assert.deepEqual(
    comparison.affectedEvidenceRecords.map((record) => record.evidenceHash),
    [
      "sha256:drift-no-row-mutation-evidence",
      "sha256:drift-write-denial-evidence",
    ],
  );
});

test("detects multi-field drift in deterministic fingerprint field order", () => {
  const comparison = compareExecutorDriftFingerprints(
    {
      previous: previousFingerprint,
      current: {
        ...currentFingerprint,
        networkPolicy: "sha256:egress-deny-production-v2",
        runnerImage: "sha256:runner-image-readonly-v2",
        endpoint: "sha256:orders-readonly-endpoint-v2",
        namespace: "sha256:orders-sandbox-namespace-v2",
        configHash: "sha256:executor-config-v2",
      },
    },
    evidenceRecords,
  );

  assert.equal(comparison.hasDrift, true);
  assert.deepEqual(comparison.changedFields, [
    ExecutorDriftFingerprintField.NetworkPolicy,
    ExecutorDriftFingerprintField.RunnerImage,
    ExecutorDriftFingerprintField.Endpoint,
    ExecutorDriftFingerprintField.Namespace,
    ExecutorDriftFingerprintField.ConfigHash,
  ]);
  assert.deepEqual(comparison.affectedEvidenceHashes, [
    "sha256:drift-no-row-mutation-evidence",
    "sha256:drift-write-denial-evidence",
  ]);
});
