import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  ContextAnchorTrustTier,
  ContextAnchorType,
  ContextRetentionVerifierResult,
  createCertifiedSummaryDerivationDigest,
  createContextAnchorCertifiedSummaryDerivationDigest,
  createRetrievableContextReference,
  findMatchingRetrievableContextReference,
  parseRetrievableContextReference,
  validateCertifiedSummaryDerivation,
  validateRetrievableContextReference,
} from "@agent-safety-gateway/shared/context-retention";

const createAnchor = (overrides = {}) => ({
  anchorId: "ctx-release-policy",
  anchorType: ContextAnchorType.SystemPolicy,
  sourceIdentity: "policy:release-gate",
  authorityLevel: "policy_admin",
  resourceScope: "service:checkout",
  createdAt: "2026-05-01T09:50:00.000Z",
  expiresAt: "2026-05-01T10:50:00.000Z",
  contentDigest: "sha256:release-policy-verbatim-v1",
  semanticClaimsDigest: "sha256:release-policy-summary-v1",
  mustBeVerbatim: false,
  allowCertifiedSummary: true,
  allowRetrievableReference: true,
  trustTier: ContextAnchorTrustTier.High,
  ...overrides,
});

const expectedSummaryDigestPayload = (anchor) =>
  JSON.stringify({
    schema:
      "agent-safety-gateway.context-retention.CertifiedSummaryDerivation.v1",
    anchorId: anchor.anchorId,
    sourceContentDigest: anchor.contentDigest,
    sourceSemanticClaimsDigest: anchor.semanticClaimsDigest,
    summaryDigest: anchor.semanticClaimsDigest,
  });

test("creates deterministic certified summary derivation digests", () => {
  const anchor = createAnchor();
  const expectedDigest = `sha256:${createHash("sha256")
    .update(expectedSummaryDigestPayload(anchor))
    .digest("hex")}`;

  assert.equal(
    createContextAnchorCertifiedSummaryDerivationDigest(anchor),
    expectedDigest,
  );
  assert.equal(
    createCertifiedSummaryDerivationDigest({
      anchorId: anchor.anchorId,
      sourceContentDigest: anchor.contentDigest,
      sourceSemanticClaimsDigest: anchor.semanticClaimsDigest,
      summaryDigest: anchor.semanticClaimsDigest,
    }),
    expectedDigest,
  );
});

test("validates certified summaries against source anchor digests", () => {
  const anchor = createAnchor();
  const derivationDigest = createContextAnchorCertifiedSummaryDerivationDigest(
    anchor,
  );

  assert.equal(
    validateCertifiedSummaryDerivation({
      anchor,
      summaryDigest: anchor.semanticClaimsDigest,
      summaryDerivationDigests: [derivationDigest],
    }),
    ContextRetentionVerifierResult.Verified,
  );
  assert.equal(
    validateCertifiedSummaryDerivation({
      anchor,
      summaryDigest: anchor.semanticClaimsDigest,
      summaryDerivationDigests: [anchor.semanticClaimsDigest],
    }),
    ContextRetentionVerifierResult.NotVerified,
  );
  assert.equal(
    validateCertifiedSummaryDerivation({
      anchor,
      summaryDigest: "sha256:altered-summary",
      summaryDerivationDigests: [derivationDigest],
    }),
    ContextRetentionVerifierResult.NotVerified,
  );
});

test("parses and validates retrievable context references", () => {
  const anchor = createAnchor();
  const reference = createRetrievableContextReference(anchor);

  assert.deepEqual(parseRetrievableContextReference(reference), {
    rawReference: reference,
    anchorId: anchor.anchorId,
    contentDigest: anchor.contentDigest,
  });
  assert.equal(
    validateRetrievableContextReference({
      anchor,
      references: [reference],
    }),
    ContextRetentionVerifierResult.Verified,
  );
  assert.deepEqual(
    findMatchingRetrievableContextReference({
      anchor,
      references: ["sha256:other-doc", reference],
    }),
    {
      rawReference: reference,
      anchorId: anchor.anchorId,
      contentDigest: anchor.contentDigest,
    },
  );
});

test("rejects malformed and mismatched retrievable context references", () => {
  const anchor = createAnchor();
  const wrongAnchor = createAnchor({ anchorId: "ctx-other-policy" });

  assert.equal(parseRetrievableContextReference("not-a-reference"), null);
  assert.equal(
    parseRetrievableContextReference("context-ref:ctx-release-policy"),
    null,
  );
  assert.equal(
    parseRetrievableContextReference("context-ref:ctx-release-policy#md5:bad"),
    null,
  );
  assert.equal(
    validateRetrievableContextReference({
      anchor,
      references: [createRetrievableContextReference(wrongAnchor)],
    }),
    ContextRetentionVerifierResult.NotVerified,
  );
  assert.equal(
    validateRetrievableContextReference({
      anchor,
      references: ["sha256:wrong-content"],
    }),
    ContextRetentionVerifierResult.NotVerified,
  );
});
