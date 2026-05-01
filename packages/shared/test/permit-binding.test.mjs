import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildPermitBindingHashPayload,
  buildPermitDeniedEvidenceHashPayload,
  createPermitBindingHash,
  createPermitDeniedEvidenceHash,
  ForbiddenEffectEvidenceType,
  isPermitBinding,
  isPermitDeniedEvidence,
  PermitBindingSchema,
  PermitDeniedEvidenceSchema,
  validatePermitBinding,
  validatePermitDeniedEvidence,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

const validPermitBinding = {
  requestHash: "sha256:request-readonly-orders-001",
  executorId: "sql-readonly-prod-001",
  safetyEvidenceVersion: "sev-20260501-abc123",
  coverageMapHash: "sha256:coverage-map-complete-001",
  deniedEvidenceHash: "sha256:denied-capability-bundle-001",
  sideEffectEvidenceHash: "sha256:side-effect-delta-bundle-001",
  ttl: 300000,
  nonce: "permit-nonce-20260501-001",
};

const expectedPermitBindingHashPayload = JSON.stringify({
  schema: "agent-safety-gateway.forbidden-side-effect.PermitBinding.v1",
  requestHash: validPermitBinding.requestHash,
  executorId: validPermitBinding.executorId,
  safetyEvidenceVersion: validPermitBinding.safetyEvidenceVersion,
  coverageMapHash: validPermitBinding.coverageMapHash,
  deniedEvidenceHash: validPermitBinding.deniedEvidenceHash,
  sideEffectEvidenceHash: validPermitBinding.sideEffectEvidenceHash,
  ttl: validPermitBinding.ttl,
  nonce: validPermitBinding.nonce,
});

const validContextBoundPermitBinding = {
  ...validPermitBinding,
  contextAdequacyEvidenceHash: "sha256:context-adequacy-evidence-001",
};

const expectedContextBoundPermitBindingHashPayload = JSON.stringify({
  schema: "agent-safety-gateway.forbidden-side-effect.PermitBinding.v1",
  requestHash: validContextBoundPermitBinding.requestHash,
  executorId: validContextBoundPermitBinding.executorId,
  safetyEvidenceVersion: validContextBoundPermitBinding.safetyEvidenceVersion,
  coverageMapHash: validContextBoundPermitBinding.coverageMapHash,
  deniedEvidenceHash: validContextBoundPermitBinding.deniedEvidenceHash,
  sideEffectEvidenceHash: validContextBoundPermitBinding.sideEffectEvidenceHash,
  ttl: validContextBoundPermitBinding.ttl,
  nonce: validContextBoundPermitBinding.nonce,
  contextAdequacyEvidenceHash:
    validContextBoundPermitBinding.contextAdequacyEvidenceHash,
});

const validPermitDeniedEvidence = {
  requestHash: "sha256:request-readonly-orders-002",
  executorId: "sql-readonly-prod-001",
  permitIssued: false,
  executorInvoked: false,
  missingEvidence: [
    ForbiddenEffectEvidenceType.DeleteDenial,
    ForbiddenEffectEvidenceType.DdlDenial,
  ],
  invalidatedEvidence: ["sha256:stale-coverage-entry-001"],
  reason: "missing_denied_capability_evidence",
};

const expectedPermitDeniedEvidenceHashPayload = JSON.stringify({
  schema:
    "agent-safety-gateway.forbidden-side-effect.PermitDeniedEvidence.v1",
  requestHash: validPermitDeniedEvidence.requestHash,
  executorId: validPermitDeniedEvidence.executorId,
  permitIssued: false,
  executorInvoked: false,
  missingEvidence: validPermitDeniedEvidence.missingEvidence,
  invalidatedEvidence: validPermitDeniedEvidence.invalidatedEvidence,
  reason: validPermitDeniedEvidence.reason,
});

test("validates PermitBinding records bound to safety evidence", () => {
  const result = PermitBindingSchema.safeParse(validPermitBinding);

  assert.equal(result.success, true);
  assert.equal(result.data.requestHash, validPermitBinding.requestHash);
  assert.equal(result.data.executorId, validPermitBinding.executorId);
  assert.equal(
    result.data.safetyEvidenceVersion,
    validPermitBinding.safetyEvidenceVersion,
  );
  assert.equal(result.data.coverageMapHash, validPermitBinding.coverageMapHash);
  assert.equal(
    result.data.deniedEvidenceHash,
    validPermitBinding.deniedEvidenceHash,
  );
  assert.equal(
    result.data.sideEffectEvidenceHash,
    validPermitBinding.sideEffectEvidenceHash,
  );
  assert.equal(result.data.ttl, validPermitBinding.ttl);
  assert.equal(result.data.nonce, validPermitBinding.nonce);
  assert.equal(isPermitBinding(validPermitBinding), true);
});

test("validates PermitBinding records bound to context adequacy evidence", () => {
  const result = PermitBindingSchema.safeParse(validContextBoundPermitBinding);

  assert.equal(result.success, true);
  assert.equal(
    result.data.contextAdequacyEvidenceHash,
    validContextBoundPermitBinding.contextAdequacyEvidenceHash,
  );
  assert.equal(isPermitBinding(validContextBoundPermitBinding), true);
});

test("rejects malformed PermitBinding context evidence hashes", () => {
  const result = validatePermitBinding({
    ...validPermitBinding,
    contextAdequacyEvidenceHash: "",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    ["$.contextAdequacyEvidenceHash"],
  );
});

test("rejects malformed PermitBinding fields", () => {
  const result = validatePermitBinding({
    requestHash: "",
    executorId: 123,
    safetyEvidenceVersion: "",
    coverageMapHash: null,
    deniedEvidenceHash: "",
    sideEffectEvidenceHash: undefined,
    ttl: 0,
    nonce: "",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    [
      "$.requestHash",
      "$.executorId",
      "$.safetyEvidenceVersion",
      "$.coverageMapHash",
      "$.deniedEvidenceHash",
      "$.sideEffectEvidenceHash",
      "$.ttl",
      "$.nonce",
    ],
  );
  assert.equal(isPermitBinding(result), false);
});

test("builds a stable PermitBinding hash payload", () => {
  assert.equal(
    buildPermitBindingHashPayload(validPermitBinding),
    expectedPermitBindingHashPayload,
  );
  assert.equal(
    buildPermitBindingHashPayload(validContextBoundPermitBinding),
    expectedContextBoundPermitBindingHashPayload,
  );
});

test("generates stable PermitBinding hashes", async () => {
  const reorderedBinding = {
    nonce: validPermitBinding.nonce,
    ttl: validPermitBinding.ttl,
    sideEffectEvidenceHash: validPermitBinding.sideEffectEvidenceHash,
    deniedEvidenceHash: validPermitBinding.deniedEvidenceHash,
    coverageMapHash: validPermitBinding.coverageMapHash,
    safetyEvidenceVersion: validPermitBinding.safetyEvidenceVersion,
    executorId: validPermitBinding.executorId,
    requestHash: validPermitBinding.requestHash,
  };
  const expectedHash = `sha256:${createHash("sha256")
    .update(expectedPermitBindingHashPayload)
    .digest("hex")}`;

  assert.equal(await createPermitBindingHash(validPermitBinding), expectedHash);
  assert.equal(await createPermitBindingHash(reorderedBinding), expectedHash);
  assert.notEqual(
    await createPermitBindingHash({
      ...validPermitBinding,
      nonce: "permit-nonce-20260501-002",
    }),
    expectedHash,
  );
});

test("throws a typed validation error on PermitBinding parse failure", () => {
  assert.throws(
    () => PermitBindingSchema.parse({}),
    (error) =>
      error.name === "PermitBindingValidationError" &&
      Array.isArray(error.issues) &&
      error.issues.some((issue) => issue.path === "$.requestHash"),
  );
});

test("validates PermitDeniedEvidence fail-closed audit records", () => {
  const result = PermitDeniedEvidenceSchema.safeParse(validPermitDeniedEvidence);

  assert.equal(result.success, true);
  assert.equal(result.data.permitIssued, false);
  assert.equal(result.data.executorInvoked, false);
  assert.deepEqual(result.data.missingEvidence, [
    ForbiddenEffectEvidenceType.DeleteDenial,
    ForbiddenEffectEvidenceType.DdlDenial,
  ]);
  assert.deepEqual(result.data.invalidatedEvidence, [
    "sha256:stale-coverage-entry-001",
  ]);
  assert.equal(result.data.reason, "missing_denied_capability_evidence");
  assert.equal(isPermitDeniedEvidence(validPermitDeniedEvidence), true);
});

test("allows empty PermitDeniedEvidence evidence arrays", () => {
  const result = validatePermitDeniedEvidence({
    ...validPermitDeniedEvidence,
    missingEvidence: [],
    invalidatedEvidence: [],
    reason: "evidence_failed",
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data.missingEvidence, []);
  assert.deepEqual(result.data.invalidatedEvidence, []);
});

test("rejects malformed PermitDeniedEvidence fields", () => {
  const result = validatePermitDeniedEvidence({
    requestHash: "",
    executorId: null,
    permitIssued: true,
    executorInvoked: true,
    missingEvidence: ["stdout"],
    invalidatedEvidence: [""],
    reason: "",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    [
      "$.requestHash",
      "$.executorId",
      "$.permitIssued",
      "$.executorInvoked",
      "$.missingEvidence[0]",
      "$.invalidatedEvidence[0]",
      "$.reason",
    ],
  );
  assert.equal(isPermitDeniedEvidence(result), false);
});

test("builds a stable PermitDeniedEvidence hash payload", () => {
  assert.equal(
    buildPermitDeniedEvidenceHashPayload(validPermitDeniedEvidence),
    expectedPermitDeniedEvidenceHashPayload,
  );
});

test("generates stable PermitDeniedEvidence hashes", async () => {
  const reorderedEvidence = {
    reason: validPermitDeniedEvidence.reason,
    invalidatedEvidence: validPermitDeniedEvidence.invalidatedEvidence,
    missingEvidence: validPermitDeniedEvidence.missingEvidence,
    executorInvoked: validPermitDeniedEvidence.executorInvoked,
    permitIssued: validPermitDeniedEvidence.permitIssued,
    executorId: validPermitDeniedEvidence.executorId,
    requestHash: validPermitDeniedEvidence.requestHash,
  };
  const expectedHash = `sha256:${createHash("sha256")
    .update(expectedPermitDeniedEvidenceHashPayload)
    .digest("hex")}`;

  assert.equal(
    await createPermitDeniedEvidenceHash(validPermitDeniedEvidence),
    expectedHash,
  );
  assert.equal(await createPermitDeniedEvidenceHash(reorderedEvidence), expectedHash);
  assert.notEqual(
    await createPermitDeniedEvidenceHash({
      ...validPermitDeniedEvidence,
      reason: "evidence_invalidated_by_drift",
    }),
    expectedHash,
  );
});

test("throws a typed validation error on PermitDeniedEvidence parse failure", () => {
  assert.throws(
    () => PermitDeniedEvidenceSchema.parse({}),
    (error) =>
      error.name === "PermitDeniedEvidenceValidationError" &&
      Array.isArray(error.issues) &&
      error.issues.some((issue) => issue.path === "$.requestHash"),
  );
});
