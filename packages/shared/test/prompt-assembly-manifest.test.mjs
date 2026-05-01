import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildPromptAssemblyManifestHashPayload,
  ContextRetentionDomain,
  createPromptAssemblyManifestHash,
  isPromptAssemblyManifest,
  PromptAssemblyManifestSchema,
  validatePromptAssemblyManifest,
} from "@agent-safety-gateway/shared/context-retention";

const validManifest = {
  manifestId: "prompt-manifest-payment-sql-001",
  inferenceId: "inference-payment-sql-001",
  modelId: "deterministic-agent-adapter-v1",
  promptDigest: "sha256:assembled-prompt-digest-v1",
  contextUnitDigests: [
    {
      contextUnitId: "ctx-user-instruction-clean-pending-orders",
      digest: "sha256:user-instruction-context-v1",
    },
    {
      contextUnitId: "ctx-system-policy-sql-production",
      digest: "sha256:sql-policy-context-v1",
    },
    {
      contextUnitId: "ctx-resource-state-orders-prod",
      digest: "sha256:orders-prod-state-context-v1",
    },
  ],
  contextUnitOrder: [
    "ctx-user-instruction-clean-pending-orders",
    "ctx-system-policy-sql-production",
    "ctx-resource-state-orders-prod",
  ],
  tokenPositionRanges: [
    {
      contextUnitId: "ctx-user-instruction-clean-pending-orders",
      startToken: 0,
      endToken: 38,
    },
    {
      contextUnitId: "ctx-system-policy-sql-production",
      startToken: 39,
      endToken: 84,
    },
    {
      contextUnitId: "ctx-resource-state-orders-prod",
      startToken: 85,
      endToken: 128,
    },
  ],
  summaryDerivationDigests: ["sha256:task-summary-derivation-v1"],
  retrievalQueryDigest: "sha256:retrieval-query-payment-sql-v1",
  retrievedDocumentDigests: ["sha256:runbook-sql-production-v1"],
  memorySnapshotDigest: "sha256:agent-memory-snapshot-v1",
  systemPolicyDigest: "sha256:system-policy-digest-v1",
};

const expectedHashPayload = JSON.stringify({
  schema: "agent-safety-gateway.context-retention.PromptAssemblyManifest.v1",
  manifestId: validManifest.manifestId,
  inferenceId: validManifest.inferenceId,
  modelId: validManifest.modelId,
  promptDigest: validManifest.promptDigest,
  contextUnitDigests: validManifest.contextUnitDigests,
  contextUnitOrder: validManifest.contextUnitOrder,
  tokenPositionRanges: validManifest.tokenPositionRanges,
  summaryDerivationDigests: validManifest.summaryDerivationDigests,
  retrievalQueryDigest: validManifest.retrievalQueryDigest,
  retrievedDocumentDigests: validManifest.retrievedDocumentDigests,
  memorySnapshotDigest: validManifest.memorySnapshotDigest,
  systemPolicyDigest: validManifest.systemPolicyDigest,
});

test("validates a PromptAssemblyManifest for a single model inference", () => {
  const result = PromptAssemblyManifestSchema.safeParse(validManifest);

  assert.equal(result.success, true);
  assert.equal(result.data.manifestId, validManifest.manifestId);
  assert.equal(result.data.inferenceId, validManifest.inferenceId);
  assert.equal(result.data.modelId, validManifest.modelId);
  assert.equal(result.data.promptDigest, validManifest.promptDigest);
  assert.deepEqual(result.data.contextUnitOrder, validManifest.contextUnitOrder);
  assert.equal(result.data.tokenPositionRanges[0].startToken, 0);
  assert.equal(result.data.tokenPositionRanges[2].endToken, 128);
  assert.equal(result.data.retrievalQueryDigest, validManifest.retrievalQueryDigest);
  assert.equal(result.data.memorySnapshotDigest, validManifest.memorySnapshotDigest);
  assert.equal(result.data.systemPolicyDigest, validManifest.systemPolicyDigest);
  assert.equal(isPromptAssemblyManifest(validManifest), true);
});

test("keeps PromptAssemblyManifest in the context-retention namespace", () => {
  assert.equal(ContextRetentionDomain.manifest, "PromptAssemblyManifest");
});

test("rejects malformed PromptAssemblyManifest fields", () => {
  const result = validatePromptAssemblyManifest({
    manifestId: "",
    inferenceId: null,
    modelId: "",
    promptDigest: 42,
    contextUnitDigests: [
      {
        contextUnitId: "",
        digest: "",
      },
      "not-an-object",
    ],
    contextUnitOrder: ["ctx-valid", ""],
    tokenPositionRanges: [
      {
        contextUnitId: "ctx-valid",
        startToken: 3,
        endToken: 1,
      },
      {
        contextUnitId: "",
        startToken: -1,
        endToken: 2.5,
      },
    ],
    summaryDerivationDigests: [""],
    retrievalQueryDigest: undefined,
    retrievedDocumentDigests: "sha256:doc",
    memorySnapshotDigest: [],
    systemPolicyDigest: "",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    [
      "$.manifestId",
      "$.inferenceId",
      "$.modelId",
      "$.promptDigest",
      "$.contextUnitDigests[0].contextUnitId",
      "$.contextUnitDigests[0].digest",
      "$.contextUnitDigests[1]",
      "$.contextUnitDigests[1].contextUnitId",
      "$.contextUnitDigests[1].digest",
      "$.contextUnitOrder[1]",
      "$.tokenPositionRanges[0]",
      "$.tokenPositionRanges[1].startToken",
      "$.tokenPositionRanges[1].endToken",
      "$.tokenPositionRanges[1].contextUnitId",
      "$.summaryDerivationDigests[0]",
      "$.retrievalQueryDigest",
      "$.retrievedDocumentDigests",
      "$.memorySnapshotDigest",
      "$.systemPolicyDigest",
    ],
  );
  assert.equal(isPromptAssemblyManifest(result), false);
});

test("builds a stable PromptAssemblyManifest hash payload", () => {
  assert.equal(
    buildPromptAssemblyManifestHashPayload(validManifest),
    expectedHashPayload,
  );
});

test("generates stable PromptAssemblyManifest hashes for inference binding", async () => {
  const reorderedManifest = {
    systemPolicyDigest: validManifest.systemPolicyDigest,
    memorySnapshotDigest: validManifest.memorySnapshotDigest,
    retrievedDocumentDigests: validManifest.retrievedDocumentDigests,
    retrievalQueryDigest: validManifest.retrievalQueryDigest,
    summaryDerivationDigests: validManifest.summaryDerivationDigests,
    tokenPositionRanges: validManifest.tokenPositionRanges,
    contextUnitOrder: validManifest.contextUnitOrder,
    contextUnitDigests: validManifest.contextUnitDigests,
    promptDigest: validManifest.promptDigest,
    modelId: validManifest.modelId,
    inferenceId: validManifest.inferenceId,
    manifestId: validManifest.manifestId,
  };
  const expectedHash = `sha256:${createHash("sha256")
    .update(expectedHashPayload)
    .digest("hex")}`;

  assert.equal(await createPromptAssemblyManifestHash(validManifest), expectedHash);
  assert.equal(
    await createPromptAssemblyManifestHash(reorderedManifest),
    expectedHash,
  );
  assert.notEqual(
    await createPromptAssemblyManifestHash({
      ...validManifest,
      inferenceId: "inference-payment-sql-002",
    }),
    expectedHash,
  );
});

test("throws a typed validation error on PromptAssemblyManifest parse failure", () => {
  assert.throws(
    () => PromptAssemblyManifestSchema.parse({}),
    (error) =>
      error.name === "PromptAssemblyManifestValidationError" &&
      Array.isArray(error.issues) &&
      error.issues.some((issue) => issue.path === "$.inferenceId"),
  );
});
