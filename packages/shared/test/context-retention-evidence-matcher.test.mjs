import assert from "node:assert/strict";
import test from "node:test";

import {
  ContextAnchorTrustTier,
  ContextAnchorType,
  ContextRetentionMode,
  ContextRetentionVerifierResult,
  RequiredContextConflictPolicy,
  RequiredContextMissingAnchorAction,
  RequiredContextTaintPolicy,
  createContextAnchorCertifiedSummaryDerivationDigest,
  matchContextRetentionEvidence,
} from "@agent-safety-gateway/shared/context-retention";

const evaluatedAt = "2026-05-01T10:00:00.000Z";

const createAnchor = (overrides = {}) => ({
  anchorId: "ctx-user-instruction",
  anchorType: ContextAnchorType.UserInstruction,
  sourceIdentity: "user:alice",
  authorityLevel: "requester",
  resourceScope: "service:payments",
  createdAt: "2026-05-01T09:50:00.000Z",
  expiresAt: "2026-05-01T10:50:00.000Z",
  contentDigest: "sha256:ctx-user-instruction-verbatim",
  semanticClaimsDigest: "sha256:ctx-user-instruction-summary",
  mustBeVerbatim: false,
  allowCertifiedSummary: true,
  allowRetrievableReference: true,
  trustTier: ContextAnchorTrustTier.High,
  ...overrides,
});

const createObligation = (anchorIds, overrides = {}) => ({
  obligationId: "rco-payment-context",
  toolCallDigest: "sha256:payment-tool-call",
  actionImpactClass: "payment_execution",
  requiredAnchors: anchorIds,
  freshnessWindow: "PT30M",
  minimumRetentionMode: ContextRetentionMode.RetrievableReference,
  conflictPolicy: RequiredContextConflictPolicy.DenyOnOmittedConflict,
  taintPolicy: RequiredContextTaintPolicy.DenyOnUntrustedInstruction,
  missingAnchorAction: RequiredContextMissingAnchorAction.RegroundOrDeny,
  ...overrides,
});

const createManifest = (overrides = {}) => ({
  manifestId: "manifest-payment-001",
  inferenceId: "inference-payment-001",
  modelId: "deterministic-agent-adapter",
  promptDigest: "sha256:prompt-payment-001",
  contextUnitDigests: [],
  contextUnitOrder: [],
  tokenPositionRanges: [],
  summaryDerivationDigests: [],
  retrievalQueryDigest: "sha256:retrieval-query-payment-001",
  retrievedDocumentDigests: [],
  memorySnapshotDigest: "sha256:memory-payment-001",
  systemPolicyDigest: "sha256:system-policy-payment-001",
  ...overrides,
});

const matchSingleEvidence = ({
  anchor = createAnchor(),
  obligation = createObligation([anchor.anchorId]),
  manifest,
  ...overrides
}) =>
  matchContextRetentionEvidence({
    obligation,
    manifest,
    anchors: [anchor],
    evaluatedAt,
    ...overrides,
  })[0];

test("matches verbatim context units with exact content digests", () => {
  const anchor = createAnchor();
  const evidence = matchSingleEvidence({
    anchor,
    manifest: createManifest({
      contextUnitDigests: [
        {
          contextUnitId: anchor.anchorId,
          digest: anchor.contentDigest,
        },
      ],
      contextUnitOrder: [anchor.anchorId],
      tokenPositionRanges: [
        {
          contextUnitId: anchor.anchorId,
          startToken: 10,
          endToken: 22,
        },
      ],
    }),
  });

  assert.equal(evidence.retentionMode, ContextRetentionMode.Verbatim);
  assert.equal(evidence.coverageScore, 1);
  assert.equal(evidence.freshnessScore, 1);
  assert.equal(evidence.trustScore, 1);
  assert.equal(evidence.matchedContextUnitId, anchor.anchorId);
  assert.equal(evidence.matchedDigest, anchor.contentDigest);
  assert.equal(
    evidence.summaryVerifierResult,
    ContextRetentionVerifierResult.NotApplicable,
  );
  assert.equal(
    evidence.referenceVerifierResult,
    ContextRetentionVerifierResult.NotApplicable,
  );
});

test("matches certified summaries with derivation digests", () => {
  const anchor = createAnchor();
  const evidence = matchSingleEvidence({
    anchor,
    obligation: createObligation([anchor.anchorId], {
      minimumRetentionMode: ContextRetentionMode.CertifiedSummary,
    }),
    manifest: createManifest({
      contextUnitDigests: [
        {
          contextUnitId: anchor.anchorId,
          digest: anchor.semanticClaimsDigest,
        },
      ],
      contextUnitOrder: [anchor.anchorId],
      tokenPositionRanges: [
        {
          contextUnitId: anchor.anchorId,
          startToken: 24,
          endToken: 31,
        },
      ],
      summaryDerivationDigests: [
        createContextAnchorCertifiedSummaryDerivationDigest(anchor),
      ],
    }),
  });

  assert.equal(evidence.retentionMode, ContextRetentionMode.CertifiedSummary);
  assert.equal(evidence.coverageScore, 1);
  assert.equal(
    evidence.summaryVerifierResult,
    ContextRetentionVerifierResult.Verified,
  );
  assert.equal(evidence.matchedDigest, anchor.semanticClaimsDigest);
});

test("rejects uncertified summaries for certified summary obligations", () => {
  const anchor = createAnchor();
  const evidence = matchSingleEvidence({
    anchor,
    obligation: createObligation([anchor.anchorId], {
      minimumRetentionMode: ContextRetentionMode.CertifiedSummary,
    }),
    manifest: createManifest({
      contextUnitDigests: [
        {
          contextUnitId: anchor.anchorId,
          digest: anchor.semanticClaimsDigest,
        },
      ],
      contextUnitOrder: [anchor.anchorId],
      tokenPositionRanges: [
        {
          contextUnitId: anchor.anchorId,
          startToken: 24,
          endToken: 31,
        },
      ],
      summaryDerivationDigests: [anchor.semanticClaimsDigest],
    }),
  });

  assert.equal(evidence.retentionMode, ContextRetentionMode.Missing);
  assert.equal(evidence.coverageScore, 0);
  assert.equal(evidence.matchedDigest, null);

  const verbatimEvidence = matchSingleEvidence({
    anchor,
    obligation: createObligation([anchor.anchorId], {
      minimumRetentionMode: ContextRetentionMode.Verbatim,
    }),
    manifest: createManifest({
      contextUnitDigests: [
        {
          contextUnitId: anchor.anchorId,
          digest: anchor.semanticClaimsDigest,
        },
      ],
      contextUnitOrder: [anchor.anchorId],
      tokenPositionRanges: [
        {
          contextUnitId: anchor.anchorId,
          startToken: 24,
          endToken: 31,
        },
      ],
      summaryDerivationDigests: [anchor.semanticClaimsDigest],
    }),
  });

  assert.equal(verbatimEvidence.retentionMode, ContextRetentionMode.Missing);
  assert.equal(verbatimEvidence.coverageScore, 0);
});

test("does not treat certified summaries as verbatim evidence", () => {
  const anchor = createAnchor({ mustBeVerbatim: true });
  const evidence = matchSingleEvidence({
    anchor,
    obligation: createObligation([anchor.anchorId], {
      minimumRetentionMode: ContextRetentionMode.Verbatim,
    }),
    manifest: createManifest({
      contextUnitDigests: [
        {
          contextUnitId: anchor.anchorId,
          digest: anchor.semanticClaimsDigest,
        },
      ],
      contextUnitOrder: [anchor.anchorId],
      tokenPositionRanges: [
        {
          contextUnitId: anchor.anchorId,
          startToken: 24,
          endToken: 31,
        },
      ],
      summaryDerivationDigests: [
        createContextAnchorCertifiedSummaryDerivationDigest(anchor),
      ],
    }),
  });

  assert.equal(evidence.retentionMode, ContextRetentionMode.CertifiedSummary);
  assert.equal(evidence.coverageScore, 0);
  assert.equal(
    evidence.summaryVerifierResult,
    ContextRetentionVerifierResult.Verified,
  );
});

test("matches retrievable references from retrieved document digests", () => {
  const anchor = createAnchor();
  const evidence = matchSingleEvidence({
    anchor,
    manifest: createManifest({
      retrievedDocumentDigests: [anchor.contentDigest],
    }),
  });

  assert.equal(
    evidence.retentionMode,
    ContextRetentionMode.RetrievableReference,
  );
  assert.equal(evidence.coverageScore, 1);
  assert.equal(
    evidence.referenceVerifierResult,
    ContextRetentionVerifierResult.Verified,
  );
  assert.equal(evidence.matchedDigest, anchor.contentDigest);
});

test("rejects retrievable references with mismatched content digests", () => {
  const anchor = createAnchor();
  const evidence = matchSingleEvidence({
    anchor,
    manifest: createManifest({
      retrievedDocumentDigests: [
        `context-ref:${anchor.anchorId}#sha256:other-context`,
        anchor.semanticClaimsDigest,
      ],
    }),
  });

  assert.equal(evidence.retentionMode, ContextRetentionMode.Missing);
  assert.equal(evidence.coverageScore, 0);
  assert.equal(evidence.matchedDigest, null);
});

test("emits missing evidence for absent required anchors", () => {
  const evidence = matchContextRetentionEvidence({
    obligation: createObligation(["ctx-missing-approval"]),
    manifest: createManifest(),
    anchors: [],
    evaluatedAt,
  })[0];

  assert.equal(evidence.anchorId, "ctx-missing-approval");
  assert.equal(evidence.retentionMode, ContextRetentionMode.Missing);
  assert.equal(evidence.coverageScore, 0);
  assert.equal(evidence.matchedContextUnitId, null);
  assert.equal(evidence.matchedDigest, null);
});

test("marks visible context as stale when freshness expires", () => {
  const anchor = createAnchor({
    createdAt: "2026-05-01T08:00:00.000Z",
    expiresAt: "2026-05-01T08:30:00.000Z",
  });
  const evidence = matchSingleEvidence({
    anchor,
    manifest: createManifest({
      contextUnitDigests: [
        {
          contextUnitId: anchor.anchorId,
          digest: anchor.contentDigest,
        },
      ],
      contextUnitOrder: [anchor.anchorId],
      tokenPositionRanges: [
        {
          contextUnitId: anchor.anchorId,
          startToken: 1,
          endToken: 3,
        },
      ],
    }),
  });

  assert.equal(evidence.retentionMode, ContextRetentionMode.Stale);
  assert.equal(evidence.coverageScore, 1);
  assert.equal(evidence.freshnessScore, 0);
});

test("marks matching anchors as conflicting from deterministic matcher input", () => {
  const anchor = createAnchor({ anchorId: "ctx-negative-evidence" });
  const evidence = matchSingleEvidence({
    anchor,
    manifest: createManifest({
      contextUnitDigests: [
        {
          contextUnitId: anchor.anchorId,
          digest: anchor.contentDigest,
        },
      ],
      contextUnitOrder: [anchor.anchorId],
      tokenPositionRanges: [
        {
          contextUnitId: anchor.anchorId,
          startToken: 4,
          endToken: 8,
        },
      ],
    }),
    conflictingAnchorIds: [anchor.anchorId],
  });

  assert.equal(evidence.retentionMode, ContextRetentionMode.Conflicting);
  assert.deepEqual(evidence.conflictEvidence, [anchor.anchorId]);
  assert.equal(evidence.coverageScore, 1);
});

test("marks matching anchors as tainted from deterministic matcher input", () => {
  const anchor = createAnchor({
    anchorId: "ctx-untrusted-instruction",
    trustTier: ContextAnchorTrustTier.Untrusted,
  });
  const evidence = matchSingleEvidence({
    anchor,
    manifest: createManifest({
      contextUnitDigests: [
        {
          contextUnitId: anchor.anchorId,
          digest: anchor.contentDigest,
        },
      ],
      contextUnitOrder: [anchor.anchorId],
      tokenPositionRanges: [
        {
          contextUnitId: anchor.anchorId,
          startToken: 9,
          endToken: 12,
        },
      ],
    }),
    taintedAnchorIds: [anchor.anchorId],
  });

  assert.equal(evidence.retentionMode, ContextRetentionMode.Tainted);
  assert.equal(evidence.trustScore, 0);
  assert.equal(evidence.coverageScore, 1);
});

test("emits one deterministic evidence record for each required anchor", () => {
  const userAnchor = createAnchor({ anchorId: "ctx-user-instruction" });
  const policyAnchor = createAnchor({
    anchorId: "ctx-policy-summary",
    anchorType: ContextAnchorType.SystemPolicy,
    contentDigest: "sha256:policy-verbatim",
    semanticClaimsDigest: "sha256:policy-summary",
  });
  const obligation = createObligation(
    [userAnchor.anchorId, policyAnchor.anchorId, "ctx-missing-negative"],
    {
      minimumRetentionMode: ContextRetentionMode.RetrievableReference,
    },
  );
  const manifest = createManifest({
    contextUnitDigests: [
      {
        contextUnitId: userAnchor.anchorId,
        digest: userAnchor.contentDigest,
      },
      {
        contextUnitId: policyAnchor.anchorId,
        digest: policyAnchor.semanticClaimsDigest,
      },
    ],
    contextUnitOrder: [userAnchor.anchorId, policyAnchor.anchorId],
    tokenPositionRanges: [
      {
        contextUnitId: userAnchor.anchorId,
        startToken: 0,
        endToken: 4,
      },
      {
        contextUnitId: policyAnchor.anchorId,
        startToken: 5,
        endToken: 11,
      },
    ],
    summaryDerivationDigests: [
      createContextAnchorCertifiedSummaryDerivationDigest(policyAnchor),
    ],
  });

  const evidence = matchContextRetentionEvidence({
    obligation,
    manifest,
    anchors: [userAnchor, policyAnchor],
    evaluatedAt,
  });

  assert.deepEqual(
    evidence.map((record) => record.anchorId),
    [userAnchor.anchorId, policyAnchor.anchorId, "ctx-missing-negative"],
  );
  assert.deepEqual(
    evidence.map((record) => record.retentionMode),
    [
      ContextRetentionMode.Verbatim,
      ContextRetentionMode.CertifiedSummary,
      ContextRetentionMode.Missing,
    ],
  );
  assert.deepEqual(
    evidence.map((record) => record.evidenceId),
    [
      "cre-rco-payment-context-ctx-user-instruction",
      "cre-rco-payment-context-ctx-policy-summary",
      "cre-rco-payment-context-ctx-missing-negative",
    ],
  );
});
