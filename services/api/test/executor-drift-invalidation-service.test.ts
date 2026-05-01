import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DeniedCapabilityProbeOutcome,
  EvidenceCoverageStatus,
  ExecutorDriftFingerprintField,
  ExecutorDriftFingerprintFieldValues,
  ExecutorSafetyEvidenceStateName,
  ForbiddenEffectEvidenceType,
  type EvidenceCoverageRecord,
  type ExecutorDriftFingerprint,
  type ForbiddenEffectObligation,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import {
  createExecutorDriftInvalidationService,
  invalidateExecutorSafetyEvidenceForDrift,
} from "../src/executor-drift-invalidation-service.js";

const executorId = "executor-sql-prod";
const detectedAt = "2026-05-01T08:30:00.000Z";

const previousFingerprint: ExecutorDriftFingerprint = {
  fingerprintHash: "sha256:executor-drift-fingerprint-v1",
  credential: "sha256:vault-readonly-credential-v1",
  networkPolicy: "sha256:egress-deny-production-v1",
  runnerImage: "sha256:runner-image-readonly-v1",
  endpoint: "sha256:orders-readonly-endpoint-v1",
  namespace: "sha256:orders-sandbox-namespace-v1",
  configHash: "sha256:executor-config-v1",
  capturedAt: "2026-05-01T08:00:00.000Z",
};

const writeDenialObligation: ForbiddenEffectObligation = {
  obligationId: "obligation-write-denial",
  effectType: "sql",
  resourceScope: ["database.orders"],
  environment: "production",
  severity: "critical",
  requiredEvidenceTypes: [ForbiddenEffectEvidenceType.WriteDenial],
  failClosedAction: "deny_permit",
};

const noMutationObligation: ForbiddenEffectObligation = {
  obligationId: "obligation-no-row-mutation",
  effectType: "sql",
  resourceScope: ["database.orders"],
  environment: "production",
  severity: "critical",
  requiredEvidenceTypes: [ForbiddenEffectEvidenceType.NoRowMutation],
  failClosedAction: "deny_permit",
};

const obligations = [noMutationObligation, writeDenialObligation];

const writeDeniedEvidence = {
  probeId: "negative-probe-write-denial",
  obligationId: writeDenialObligation.obligationId,
  attemptedOperation: "DELETE FROM orders WHERE status = 'pending'",
  observedRejection: DeniedCapabilityProbeOutcome.Rejected,
  rejectionReason: "readonly executor rejected SQL DELETE",
  executorFingerprint: previousFingerprint.fingerprintHash,
  completedAt: "2026-05-01T08:10:00.000Z",
};

const noMutationEvidence = {
  probeId: "side-effect-probe-no-row-mutation",
  obligationId: noMutationObligation.obligationId,
  executorId,
  beforeSnapshotHash: "sha256:orders-before",
  afterSnapshotHash: "sha256:orders-before",
  observedEvents: [],
  forbiddenEffectsObserved: [],
  effectDelta: [],
  completedAt: "2026-05-01T08:11:00.000Z",
  executorFingerprint: previousFingerprint.fingerprintHash,
};

const currentBoundEvidenceRecord: EvidenceCoverageRecord = {
  obligationId: "obligation-current-fingerprint",
  requiredEvidenceType: ForbiddenEffectEvidenceType.DeleteDenial,
  evidenceHash: "sha256:current-bound-delete-denial",
  status: EvidenceCoverageStatus.Covered,
  completedAt: "2026-05-01T08:12:00.000Z",
  evidence: {
    ...writeDeniedEvidence,
    obligationId: "obligation-current-fingerprint",
    executorFingerprint: "sha256:executor-drift-fingerprint-v2",
  },
};

const evidenceRecords: readonly EvidenceCoverageRecord[] = [
  {
    obligationId: noMutationObligation.obligationId,
    requiredEvidenceType: ForbiddenEffectEvidenceType.NoRowMutation,
    evidenceHash: "sha256:no-row-mutation-evidence",
    status: EvidenceCoverageStatus.Covered,
    completedAt: noMutationEvidence.completedAt,
    evidence: noMutationEvidence,
  },
  {
    obligationId: writeDenialObligation.obligationId,
    requiredEvidenceType: ForbiddenEffectEvidenceType.WriteDenial,
    evidenceHash: "sha256:write-denial-evidence",
    status: EvidenceCoverageStatus.Covered,
    completedAt: writeDeniedEvidence.completedAt,
    evidence: writeDeniedEvidence,
  },
  currentBoundEvidenceRecord,
];

type DriftFingerprintKey = Exclude<
  keyof ExecutorDriftFingerprint,
  "fingerprintHash" | "capturedAt"
>;

const driftFingerprintKeys = {
  [ExecutorDriftFingerprintField.Credential]: "credential",
  [ExecutorDriftFingerprintField.NetworkPolicy]: "networkPolicy",
  [ExecutorDriftFingerprintField.RunnerImage]: "runnerImage",
  [ExecutorDriftFingerprintField.Endpoint]: "endpoint",
  [ExecutorDriftFingerprintField.Namespace]: "namespace",
  [ExecutorDriftFingerprintField.ConfigHash]: "configHash",
} as const satisfies Record<ExecutorDriftFingerprintField, DriftFingerprintKey>;

const createCurrentFingerprintWithDrift = (
  field: ExecutorDriftFingerprintField,
): ExecutorDriftFingerprint => {
  const driftKey = driftFingerprintKeys[field];

  return {
    ...previousFingerprint,
    fingerprintHash: `sha256:executor-drift-${field}-v2`,
    [driftKey]: `sha256:${field}-v2`,
    capturedAt: detectedAt,
  };
};

describe("executor drift invalidation service", () => {
  it("leaves evidence complete when no security fingerprint field drifts", () => {
    const service = createExecutorDriftInvalidationService();
    const result = service.invalidate({
      previousFingerprint,
      currentFingerprint: { ...previousFingerprint },
      obligations,
      evidenceRecords,
      executorId,
      detectedAt,
      coverageMapHash: "sha256:coverage-no-drift",
      safetyEvidenceVersion: "evidence-version-001",
    });

    assert.equal(result.comparison.hasDrift, false);
    assert.deepEqual(result.comparison.changedFields, []);
    assert.deepEqual(result.invalidatedEvidenceRecords, []);
    assert.equal(result.updatedEvidenceRecords, evidenceRecords);
    assert.equal(result.coverageMap.allObligationsCovered, true);
    assert.equal(
      result.safetyState.state,
      ExecutorSafetyEvidenceStateName.EvidenceComplete,
    );
    assert.equal(result.safetyState.invalidatedBy, undefined);
  });

  for (const field of ExecutorDriftFingerprintFieldValues) {
    it(`invalidates bound evidence when ${field} drifts`, () => {
      const result = invalidateExecutorSafetyEvidenceForDrift({
        previousFingerprint,
        currentFingerprint: createCurrentFingerprintWithDrift(field),
        obligations,
        evidenceRecords,
        executorId,
        detectedAt,
        coverageMapId: `coverage-map-${field}-drift`,
        coverageMapHash: `sha256:coverage-${field}-drift`,
        safetyEvidenceVersion: "evidence-version-001",
      });

      assert.equal(result.comparison.hasDrift, true);
      assert.deepEqual(result.comparison.changedFields, [field]);
      assert.deepEqual(result.comparison.affectedEvidenceHashes, [
        "sha256:no-row-mutation-evidence",
        "sha256:write-denial-evidence",
      ]);
      assert.deepEqual(
        result.invalidatedEvidenceRecords.map((record) => record.evidenceHash),
        ["sha256:no-row-mutation-evidence", "sha256:write-denial-evidence"],
      );

      for (const record of result.invalidatedEvidenceRecords) {
        assert.equal(record.status, EvidenceCoverageStatus.Invalidated);
        assert.equal(record.invalidatedAt, detectedAt);
        assert.match(record.failureReason ?? "", new RegExp(field));
        assert.match(record.failureReason ?? "", /executor drift changed/);
      }

      assert.deepEqual(
        result.updatedEvidenceRecords.find(
          (record) => record.evidenceHash === currentBoundEvidenceRecord.evidenceHash,
        ),
        currentBoundEvidenceRecord,
      );
      assert.equal(result.coverageMap.allObligationsCovered, false);
      assert.deepEqual(
        Array.from(new Set(result.coverageMap.coverage.map((entry) => entry.status))),
        [EvidenceCoverageStatus.Invalidated],
      );
      assert.equal(
        result.safetyState.state,
        ExecutorSafetyEvidenceStateName.EvidenceInvalidated,
      );
      assert.equal(result.safetyState.allObligationsCovered, false);
      assert.deepEqual(result.safetyState.blockingStatuses, [
        EvidenceCoverageStatus.Invalidated,
      ]);
      assert.deepEqual(result.safetyState.blockedObligationIds, [
        noMutationObligation.obligationId,
        writeDenialObligation.obligationId,
      ]);
      assert.match(result.safetyState.invalidatedBy ?? "", new RegExp(field));
      assert.equal(result.safetyState.coverageMapHash, `sha256:coverage-${field}-drift`);
      assert.equal(result.safetyState.safetyEvidenceVersion, "evidence-version-001");
    });
  }
});
