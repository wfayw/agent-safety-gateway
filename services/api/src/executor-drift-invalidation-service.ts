import {
  compareExecutorDriftFingerprints,
  evaluateEvidenceCoverageMap,
  evaluateExecutorSafetyEvidenceState,
  EvidenceCoverageStatus,
  type DriftEvent,
  type EvidenceCoverageEvaluationOptions,
  type EvidenceCoverageMap,
  type EvidenceCoverageRecord,
  type ExecutorDriftFingerprint,
  type ExecutorDriftFingerprintComparison,
  type ExecutorSafetyEvidenceState,
  type ExecutorSafetyEvidenceStateEvaluationOptions,
  type ForbiddenEffectObligation,
  type ForbiddenSideEffectTimestamp,
} from "@agent-safety-gateway/shared/forbidden-side-effect";
import type { PatentProofHash } from "@agent-safety-gateway/shared/patent-state-machine";

const defaultDriftDetectedAt = "1970-01-01T00:00:00.000Z";

export type ExecutorDriftInvalidationInput = {
  previousFingerprint: ExecutorDriftFingerprint;
  currentFingerprint: ExecutorDriftFingerprint;
  obligations: readonly ForbiddenEffectObligation[];
  evidenceRecords: readonly EvidenceCoverageRecord[];
  executorId?: string;
  coverageMapId?: string;
  coverageMapHash?: PatentProofHash;
  safetyEvidenceVersion?: string;
  detectedAt?: ForbiddenSideEffectTimestamp;
  evidenceTtlMs?: number;
};

export type ExecutorDriftInvalidationResult = {
  comparison: ExecutorDriftFingerprintComparison;
  updatedEvidenceRecords: readonly EvidenceCoverageRecord[];
  invalidatedEvidenceRecords: readonly EvidenceCoverageRecord[];
  coverageMap: EvidenceCoverageMap;
  safetyState: ExecutorSafetyEvidenceState;
};

export type ExecutorDriftInvalidationService = {
  invalidate: (
    input: ExecutorDriftInvalidationInput,
  ) => ExecutorDriftInvalidationResult;
};

const getDriftDetectedAt = (
  input: ExecutorDriftInvalidationInput,
): ForbiddenSideEffectTimestamp =>
  input.detectedAt ??
  input.currentFingerprint.capturedAt ??
  input.previousFingerprint.capturedAt ??
  defaultDriftDetectedAt;

const getDriftInvalidationReason = (
  comparison: ExecutorDriftFingerprintComparison,
): string =>
  `executor drift changed ${comparison.changedFields.join(", ")} from ${comparison.previousFingerprintHash} to ${comparison.currentFingerprintHash}`;

const getSideEffectEvidenceExecutorId = (
  record: EvidenceCoverageRecord,
): string | undefined => {
  const evidence = record.evidence;

  if (evidence !== undefined && "executorId" in evidence) {
    return evidence.executorId;
  }

  return undefined;
};

const getCoverageExecutorId = (
  input: ExecutorDriftInvalidationInput,
): string =>
  input.executorId ??
  input.evidenceRecords.map(getSideEffectEvidenceExecutorId).find(Boolean) ??
  "unbound-executor";

const buildCoverageOptions = (
  input: ExecutorDriftInvalidationInput,
  evaluatedAt: ForbiddenSideEffectTimestamp,
): EvidenceCoverageEvaluationOptions => {
  const options: EvidenceCoverageEvaluationOptions = {
    executorId: getCoverageExecutorId(input),
    evaluatedAt,
  };

  if (input.coverageMapId !== undefined) {
    options.coverageMapId = input.coverageMapId;
  }

  return options;
};

const buildSafetyStateOptions = (
  input: ExecutorDriftInvalidationInput,
  evaluatedAt: ForbiddenSideEffectTimestamp,
  invalidatedBy: string | undefined,
): ExecutorSafetyEvidenceStateEvaluationOptions => {
  const options: ExecutorSafetyEvidenceStateEvaluationOptions = {
    evaluatedAt,
  };

  if (input.coverageMapHash !== undefined) {
    options.coverageMapHash = input.coverageMapHash;
  }

  if (input.safetyEvidenceVersion !== undefined) {
    options.safetyEvidenceVersion = input.safetyEvidenceVersion;
  }

  if (input.evidenceTtlMs !== undefined) {
    options.evidenceTtlMs = input.evidenceTtlMs;
  }

  if (invalidatedBy !== undefined) {
    options.invalidatedBy = invalidatedBy;
  }

  return options;
};

const invalidateEvidenceRecords = ({
  evidenceRecords,
  comparison,
  invalidatedAt,
}: {
  evidenceRecords: readonly EvidenceCoverageRecord[];
  comparison: ExecutorDriftFingerprintComparison;
  invalidatedAt: ForbiddenSideEffectTimestamp;
}): readonly EvidenceCoverageRecord[] => {
  if (!comparison.hasDrift || comparison.affectedEvidenceHashes.length === 0) {
    return evidenceRecords;
  }

  const affectedEvidenceHashes = new Set(comparison.affectedEvidenceHashes);
  const failureReason = getDriftInvalidationReason(comparison);

  return evidenceRecords.map((record) => {
    if (!affectedEvidenceHashes.has(record.evidenceHash)) {
      return record;
    }

    return {
      ...record,
      status: EvidenceCoverageStatus.Invalidated,
      invalidatedAt,
      failureReason,
    };
  });
};

export const invalidateExecutorSafetyEvidenceForDrift = (
  input: ExecutorDriftInvalidationInput,
): ExecutorDriftInvalidationResult => {
  const detectedAt = getDriftDetectedAt(input);
  const driftEvent: Pick<DriftEvent, "previous" | "current"> = {
    previous: input.previousFingerprint,
    current: input.currentFingerprint,
  };
  const comparison = compareExecutorDriftFingerprints(
    driftEvent,
    input.evidenceRecords,
  );
  const updatedEvidenceRecords = invalidateEvidenceRecords({
    evidenceRecords: input.evidenceRecords,
    comparison,
    invalidatedAt: detectedAt,
  });
  const invalidatedEvidenceRecords = updatedEvidenceRecords.filter(
    (record) =>
      comparison.affectedEvidenceHashes.includes(record.evidenceHash) &&
      record.status === EvidenceCoverageStatus.Invalidated,
  );
  const invalidatedBy =
    invalidatedEvidenceRecords.length > 0
      ? getDriftInvalidationReason(comparison)
      : undefined;
  const coverageMap = evaluateEvidenceCoverageMap(
    input.obligations,
    updatedEvidenceRecords,
    buildCoverageOptions(input, detectedAt),
  );
  const safetyState = evaluateExecutorSafetyEvidenceState(
    coverageMap,
    buildSafetyStateOptions(input, detectedAt, invalidatedBy),
  );

  return {
    comparison,
    updatedEvidenceRecords,
    invalidatedEvidenceRecords,
    coverageMap,
    safetyState,
  };
};

export const createExecutorDriftInvalidationService =
  (): ExecutorDriftInvalidationService => ({
    invalidate: invalidateExecutorSafetyEvidenceForDrift,
  });
