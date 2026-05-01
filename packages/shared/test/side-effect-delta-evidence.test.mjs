import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildSideEffectDeltaEvidenceHashPayload,
  createSideEffectDeltaEvidenceHash,
  isSideEffectDeltaEvidence,
  SideEffectDeltaEvidenceSchema,
  SideEffectEvidenceType,
  SideEffectEvidenceTypeValues,
  validateSideEffectDeltaEvidence,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

const validNoDeltaEvidence = {
  probeId: "side-effect-probe-sql-dryrun-v1",
  obligationId: "feo-20260501-sql-no-row-mutation",
  executorId: "sql-dryrun-prod-001",
  beforeSnapshotHash: "sha256:before-sql-orders-snapshot-v1",
  afterSnapshotHash: "sha256:before-sql-orders-snapshot-v1",
  observedEvents: [],
  forbiddenEffectsObserved: [],
  effectDelta: [],
  completedAt: "2026-05-01T05:20:00.000Z",
  executorFingerprint: "sha256:sql-dryrun-executor-fingerprint-v1",
};

const forbiddenDeltaEvidence = {
  ...validNoDeltaEvidence,
  beforeSnapshotHash: "sha256:before-cicd-deploy-state-v1",
  afterSnapshotHash: "sha256:after-cicd-deploy-state-mutated-v1",
  observedEvents: [
    {
      evidenceType: SideEffectEvidenceType.Webhook,
      target: "deployment-webhook-log",
      eventHash: "sha256:webhook-event-001",
      observedAt: "2026-05-01T05:21:00.000Z",
    },
    {
      evidenceType: SideEffectEvidenceType.Artifact,
      target: "artifact-registry/releases/api-service",
      eventHash: "sha256:artifact-promotion-001",
    },
  ],
  forbiddenEffectsObserved: [
    {
      evidenceType: SideEffectEvidenceType.Webhook,
      target: "deployment-webhook-log",
      eventHash: "sha256:webhook-event-001",
      observedAt: "2026-05-01T05:21:00.000Z",
    },
  ],
  effectDelta: [
    {
      evidenceType: SideEffectEvidenceType.Webhook,
      target: "deployment-webhook-log",
      beforeHash: "sha256:webhook-log-before-empty",
      afterHash: "sha256:webhook-log-after-event",
      changeType: "external_webhook_invoked",
    },
    {
      evidenceType: SideEffectEvidenceType.Artifact,
      target: "artifact-registry/releases/api-service",
      beforeHash: "sha256:artifact-state-before",
      afterHash: "sha256:artifact-state-after-promoted",
      changeType: "artifact_promoted",
    },
  ],
};

const expectedNoDeltaHashPayload = JSON.stringify({
  schema:
    "agent-safety-gateway.forbidden-side-effect.SideEffectDeltaEvidence.v1",
  probeId: validNoDeltaEvidence.probeId,
  obligationId: validNoDeltaEvidence.obligationId,
  executorId: validNoDeltaEvidence.executorId,
  beforeSnapshotHash: validNoDeltaEvidence.beforeSnapshotHash,
  afterSnapshotHash: validNoDeltaEvidence.afterSnapshotHash,
  observedEvents: [],
  forbiddenEffectsObserved: [],
  effectDelta: [],
  completedAt: validNoDeltaEvidence.completedAt,
  executorFingerprint: validNoDeltaEvidence.executorFingerprint,
});

test("validates SideEffectDeltaEvidence with no observed deltas", () => {
  const result = SideEffectDeltaEvidenceSchema.safeParse(validNoDeltaEvidence);

  assert.equal(result.success, true);
  assert.equal(result.data.probeId, validNoDeltaEvidence.probeId);
  assert.equal(result.data.beforeSnapshotHash, result.data.afterSnapshotHash);
  assert.deepEqual(result.data.observedEvents, []);
  assert.deepEqual(result.data.forbiddenEffectsObserved, []);
  assert.deepEqual(result.data.effectDelta, []);
  assert.equal(isSideEffectDeltaEvidence(validNoDeltaEvidence), true);
});

test("supports all side-effect evidence source types", () => {
  assert.deepEqual(SideEffectEvidenceTypeValues, [
    SideEffectEvidenceType.Database,
    SideEffectEvidenceType.DeployLog,
    SideEffectEvidenceType.Webhook,
    SideEffectEvidenceType.Artifact,
    SideEffectEvidenceType.Trigger,
    SideEffectEvidenceType.AsyncJob,
    SideEffectEvidenceType.ConfigVersion,
  ]);

  for (const evidenceType of SideEffectEvidenceTypeValues) {
    const result = validateSideEffectDeltaEvidence({
      ...validNoDeltaEvidence,
      observedEvents: [
        {
          evidenceType,
          target: `target:${evidenceType}`,
          eventHash: `sha256:event:${evidenceType}`,
        },
      ],
    });

    assert.equal(result.success, true);
    assert.equal(result.data.observedEvents[0].evidenceType, evidenceType);
  }
});

test("validates forbidden side-effect deltas as failure evidence", () => {
  const result = validateSideEffectDeltaEvidence(forbiddenDeltaEvidence);

  assert.equal(result.success, true);
  assert.equal(result.data.forbiddenEffectsObserved.length, 1);
  assert.equal(
    result.data.forbiddenEffectsObserved[0].evidenceType,
    SideEffectEvidenceType.Webhook,
  );
  assert.equal(result.data.effectDelta.length, 2);
  assert.equal(result.data.effectDelta[1].changeType, "artifact_promoted");
});

test("rejects malformed SideEffectDeltaEvidence fields", () => {
  const result = validateSideEffectDeltaEvidence({
    probeId: "",
    obligationId: 123,
    executorId: "",
    beforeSnapshotHash: null,
    afterSnapshotHash: "",
    observedEvents: [
      {
        evidenceType: "stdout",
        target: "",
        eventHash: "",
        observedAt: 123,
      },
    ],
    forbiddenEffectsObserved: "none",
    effectDelta: [
      {
        evidenceType: "queue",
        target: "",
        beforeHash: "",
        afterHash: null,
        changeType: "",
      },
    ],
    completedAt: "",
    executorFingerprint: "",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    [
      "$.probeId",
      "$.obligationId",
      "$.executorId",
      "$.beforeSnapshotHash",
      "$.afterSnapshotHash",
      "$.observedEvents[0].evidenceType",
      "$.observedEvents[0].target",
      "$.observedEvents[0].eventHash",
      "$.observedEvents[0].observedAt",
      "$.forbiddenEffectsObserved",
      "$.effectDelta[0].evidenceType",
      "$.effectDelta[0].target",
      "$.effectDelta[0].beforeHash",
      "$.effectDelta[0].afterHash",
      "$.effectDelta[0].changeType",
      "$.completedAt",
      "$.executorFingerprint",
    ],
  );
  assert.equal(isSideEffectDeltaEvidence(result), false);
});

test("builds a stable SideEffectDeltaEvidence hash payload", () => {
  assert.equal(
    buildSideEffectDeltaEvidenceHashPayload(validNoDeltaEvidence),
    expectedNoDeltaHashPayload,
  );
});

test("generates stable SideEffectDeltaEvidence hashes for permit binding", async () => {
  const reorderedEvidence = {
    executorFingerprint: validNoDeltaEvidence.executorFingerprint,
    completedAt: validNoDeltaEvidence.completedAt,
    effectDelta: validNoDeltaEvidence.effectDelta,
    forbiddenEffectsObserved: validNoDeltaEvidence.forbiddenEffectsObserved,
    observedEvents: validNoDeltaEvidence.observedEvents,
    afterSnapshotHash: validNoDeltaEvidence.afterSnapshotHash,
    beforeSnapshotHash: validNoDeltaEvidence.beforeSnapshotHash,
    executorId: validNoDeltaEvidence.executorId,
    obligationId: validNoDeltaEvidence.obligationId,
    probeId: validNoDeltaEvidence.probeId,
  };
  const expectedHash = `sha256:${createHash("sha256")
    .update(expectedNoDeltaHashPayload)
    .digest("hex")}`;

  assert.equal(
    await createSideEffectDeltaEvidenceHash(validNoDeltaEvidence),
    expectedHash,
  );
  assert.equal(
    await createSideEffectDeltaEvidenceHash(reorderedEvidence),
    expectedHash,
  );
  assert.notEqual(
    await createSideEffectDeltaEvidenceHash(forbiddenDeltaEvidence),
    expectedHash,
  );
});

test("throws a typed validation error on SideEffectDeltaEvidence parse failure", () => {
  assert.throws(
    () => SideEffectDeltaEvidenceSchema.parse({}),
    (error) =>
      error.name === "SideEffectDeltaEvidenceValidationError" &&
      Array.isArray(error.issues) &&
      error.issues.some((issue) => issue.path === "$.probeId"),
  );
});
