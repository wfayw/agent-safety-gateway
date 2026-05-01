import assert from "node:assert/strict";
import test from "node:test";

import {
  ContextAnchorSchema,
  ContextAnchorTrustTier,
  ContextAnchorType,
  ContextAnchorTypeValues,
  ContextRetentionDomain,
  isContextAnchor,
  validateContextAnchor,
} from "@agent-safety-gateway/shared/context-retention";

const validApprovalAnchor = {
  anchorId: "ctx-approval-payment-api-001",
  anchorType: ContextAnchorType.ApprovalNote,
  sourceIdentity: "approver:alice",
  authorityLevel: "production_approver",
  resourceScope: "service:payment-api",
  createdAt: "2026-05-01T09:10:00.000Z",
  expiresAt: "2026-05-01T09:40:00.000Z",
  contentDigest: "sha256:approval-note-content",
  semanticClaimsDigest: "sha256:approval-note-claims",
  mustBeVerbatim: true,
  allowCertifiedSummary: false,
  allowRetrievableReference: false,
  trustTier: ContextAnchorTrustTier.High,
};

test("validates a ContextAnchor with retention flags", () => {
  const result = ContextAnchorSchema.safeParse(validApprovalAnchor);

  assert.equal(result.success, true);
  assert.equal(result.data.anchorId, validApprovalAnchor.anchorId);
  assert.equal(result.data.anchorType, ContextAnchorType.ApprovalNote);
  assert.equal(result.data.sourceIdentity, "approver:alice");
  assert.equal(result.data.authorityLevel, "production_approver");
  assert.equal(result.data.resourceScope, "service:payment-api");
  assert.equal(result.data.contentDigest, "sha256:approval-note-content");
  assert.equal(
    result.data.semanticClaimsDigest,
    "sha256:approval-note-claims",
  );
  assert.equal(result.data.mustBeVerbatim, true);
  assert.equal(result.data.allowCertifiedSummary, false);
  assert.equal(result.data.allowRetrievableReference, false);
  assert.equal(result.data.trustTier, ContextAnchorTrustTier.High);
  assert.equal(isContextAnchor(validApprovalAnchor), true);
});

test("supports every patent context anchor type", () => {
  assert.deepEqual(ContextAnchorTypeValues, [
    ContextAnchorType.UserInstruction,
    ContextAnchorType.SystemPolicy,
    ContextAnchorType.ApprovalNote,
    ContextAnchorType.ToolResult,
    ContextAnchorType.ResourceState,
    ContextAnchorType.RetrievedDocument,
    ContextAnchorType.NegativeEvidence,
    ContextAnchorType.DelegationConstraint,
  ]);
  assert.equal(ContextRetentionDomain.anchor, "ContextAnchor");
});

test("rejects malformed ContextAnchor fields", () => {
  const result = validateContextAnchor({
    anchorId: "",
    anchorType: "approval",
    sourceIdentity: null,
    authorityLevel: "",
    resourceScope: [],
    createdAt: "not-a-date",
    expiresAt: "",
    contentDigest: undefined,
    semanticClaimsDigest: "",
    mustBeVerbatim: "yes",
    allowCertifiedSummary: "no",
    allowRetrievableReference: null,
    trustTier: "root",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    [
      "$.anchorId",
      "$.anchorType",
      "$.sourceIdentity",
      "$.authorityLevel",
      "$.resourceScope",
      "$.createdAt",
      "$.expiresAt",
      "$.contentDigest",
      "$.semanticClaimsDigest",
      "$.mustBeVerbatim",
      "$.allowCertifiedSummary",
      "$.allowRetrievableReference",
      "$.trustTier",
    ],
  );
  assert.equal(isContextAnchor(result), false);
});

test("throws a typed validation error on parse failure", () => {
  assert.throws(
    () => ContextAnchorSchema.parse({}),
    (error) =>
      error.name === "ContextAnchorValidationError" &&
      Array.isArray(error.issues) &&
      error.issues.some((issue) => issue.path === "$.anchorId"),
  );
});
