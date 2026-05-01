import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildDeniedCapabilityEvidenceHashPayload,
  createDeniedCapabilityEvidenceHash,
  DeniedCapabilityEvidenceSchema,
  DeniedCapabilityProbeOutcome,
  DeniedCapabilityProbeOutcomeValues,
  isDeniedCapabilityEvidence,
  validateDeniedCapabilityEvidence,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

const validDeniedEvidence = {
  probeId: "nprobe-20260501-sql-delete-orders",
  obligationId: "feo-20260501-sql-readonly-orders",
  attemptedOperation: "DELETE FROM orders WHERE status = 'pending'",
  observedRejection: DeniedCapabilityProbeOutcome.Rejected,
  rejectionReason: "readonly executor rejected SQL DELETE operation",
  executorFingerprint: "sha256:sql-readonly-executor-fingerprint-v1",
  completedAt: "2026-05-01T05:05:00.000Z",
};

const expectedHashPayload = JSON.stringify({
  schema:
    "agent-safety-gateway.forbidden-side-effect.DeniedCapabilityEvidence.v1",
  probeId: validDeniedEvidence.probeId,
  obligationId: validDeniedEvidence.obligationId,
  attemptedOperation: validDeniedEvidence.attemptedOperation,
  observedRejection: validDeniedEvidence.observedRejection,
  rejectionReason: validDeniedEvidence.rejectionReason,
  executorFingerprint: validDeniedEvidence.executorFingerprint,
  completedAt: validDeniedEvidence.completedAt,
});

test("validates DeniedCapabilityEvidence records", () => {
  const result = DeniedCapabilityEvidenceSchema.safeParse(validDeniedEvidence);

  assert.equal(result.success, true);
  assert.equal(result.data.probeId, validDeniedEvidence.probeId);
  assert.equal(result.data.obligationId, validDeniedEvidence.obligationId);
  assert.equal(
    result.data.observedRejection,
    DeniedCapabilityProbeOutcome.Rejected,
  );
  assert.equal(isDeniedCapabilityEvidence(validDeniedEvidence), true);
});

test("distinguishes denied capability probe outcomes", () => {
  assert.deepEqual(DeniedCapabilityProbeOutcomeValues, [
    DeniedCapabilityProbeOutcome.Rejected,
    DeniedCapabilityProbeOutcome.UnexpectedlyAllowed,
    DeniedCapabilityProbeOutcome.Skipped,
    DeniedCapabilityProbeOutcome.Errored,
  ]);

  for (const observedRejection of DeniedCapabilityProbeOutcomeValues) {
    const result = validateDeniedCapabilityEvidence({
      ...validDeniedEvidence,
      observedRejection,
    });

    assert.equal(result.success, true);
    assert.equal(result.data.observedRejection, observedRejection);
  }
});

test("rejects malformed DeniedCapabilityEvidence fields", () => {
  const result = validateDeniedCapabilityEvidence({
    probeId: "",
    obligationId: 123,
    attemptedOperation: "",
    observedRejection: "allowed",
    rejectionReason: "",
    executorFingerprint: null,
    completedAt: "",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    [
      "$.probeId",
      "$.obligationId",
      "$.attemptedOperation",
      "$.observedRejection",
      "$.rejectionReason",
      "$.executorFingerprint",
      "$.completedAt",
    ],
  );
  assert.equal(isDeniedCapabilityEvidence(result), false);
});

test("builds a stable DeniedCapabilityEvidence hash payload", () => {
  assert.equal(
    buildDeniedCapabilityEvidenceHashPayload(validDeniedEvidence),
    expectedHashPayload,
  );
});

test("generates stable DeniedCapabilityEvidence hashes for permit binding", async () => {
  const reorderedEvidence = {
    completedAt: validDeniedEvidence.completedAt,
    executorFingerprint: validDeniedEvidence.executorFingerprint,
    rejectionReason: validDeniedEvidence.rejectionReason,
    observedRejection: validDeniedEvidence.observedRejection,
    attemptedOperation: validDeniedEvidence.attemptedOperation,
    obligationId: validDeniedEvidence.obligationId,
    probeId: validDeniedEvidence.probeId,
  };
  const expectedHash = `sha256:${createHash("sha256")
    .update(expectedHashPayload)
    .digest("hex")}`;

  assert.equal(
    await createDeniedCapabilityEvidenceHash(validDeniedEvidence),
    expectedHash,
  );
  assert.equal(
    await createDeniedCapabilityEvidenceHash(reorderedEvidence),
    expectedHash,
  );
  assert.notEqual(
    await createDeniedCapabilityEvidenceHash({
      ...validDeniedEvidence,
      observedRejection: DeniedCapabilityProbeOutcome.UnexpectedlyAllowed,
    }),
    expectedHash,
  );
});

test("throws a typed validation error on DeniedCapabilityEvidence parse failure", () => {
  assert.throws(
    () => DeniedCapabilityEvidenceSchema.parse({}),
    (error) =>
      error.name === "DeniedCapabilityEvidenceValidationError" &&
      Array.isArray(error.issues) &&
      error.issues.some((issue) => issue.path === "$.probeId"),
  );
});
