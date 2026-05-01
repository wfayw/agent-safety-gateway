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
  evaluateContextRetentionRules,
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

test("marks visible context as stale when freshness window expires", () => {
  const anchor = createAnchor({
    createdAt: "2026-05-01T09:20:00.000Z",
    expiresAt: "2026-05-01T12:00:00.000Z",
  });
  const evidence = matchSingleEvidence({
    anchor,
    obligation: createObligation([anchor.anchorId], {
      freshnessWindow: "PT15M",
    }),
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

test("marks omitted required negative evidence as conflicting", () => {
  const negativeEvidenceAnchor = createAnchor({
    anchorId: "ctx-negative-renewal-policy",
    anchorType: ContextAnchorType.NegativeEvidence,
    resourceScope: "customer:emea-renewal",
  });
  const evidence = matchSingleEvidence({
    anchor: negativeEvidenceAnchor,
    obligation: createObligation([negativeEvidenceAnchor.anchorId], {
      minimumRetentionMode: ContextRetentionMode.Verbatim,
    }),
    manifest: createManifest(),
  });

  assert.equal(evidence.retentionMode, ContextRetentionMode.Conflicting);
  assert.equal(evidence.coverageScore, 0);
  assert.deepEqual(evidence.conflictEvidence, [negativeEvidenceAnchor.anchorId]);
});

test("marks required anchors conflicting when related negative evidence is omitted", () => {
  const approvalAnchor = createAnchor({
    anchorId: "ctx-renewal-approval",
    anchorType: ContextAnchorType.ApprovalNote,
    resourceScope: "customer:emea-renewal",
  });
  const negativeEvidenceAnchor = createAnchor({
    anchorId: "ctx-negative-renewal-policy",
    anchorType: ContextAnchorType.NegativeEvidence,
    resourceScope: "customer:emea-renewal",
  });
  const [evidence] = matchContextRetentionEvidence({
    obligation: createObligation([approvalAnchor.anchorId]),
    manifest: createManifest({
      contextUnitDigests: [
        {
          contextUnitId: approvalAnchor.anchorId,
          digest: approvalAnchor.contentDigest,
        },
      ],
      contextUnitOrder: [approvalAnchor.anchorId],
      tokenPositionRanges: [
        {
          contextUnitId: approvalAnchor.anchorId,
          startToken: 6,
          endToken: 10,
        },
      ],
    }),
    anchors: [approvalAnchor, negativeEvidenceAnchor],
    evaluatedAt,
  });

  assert.equal(evidence.retentionMode, ContextRetentionMode.Conflicting);
  assert.deepEqual(evidence.conflictEvidence, [negativeEvidenceAnchor.anchorId]);
  assert.equal(evidence.coverageScore, 1);
});

test("marks required anchors conflicting when contradictory anchors are present", () => {
  const retainedStateAnchor = createAnchor({
    anchorId: "ctx-order-state-pending",
    anchorType: ContextAnchorType.ResourceState,
    resourceScope: "database:orders:123",
    contentDigest: "sha256:order-123-pending-content",
    semanticClaimsDigest: "sha256:order-123-pending-claims",
  });
  const conflictingStateAnchor = createAnchor({
    anchorId: "ctx-order-state-cancelled",
    anchorType: ContextAnchorType.ResourceState,
    resourceScope: "database:orders:123",
    contentDigest: "sha256:order-123-cancelled-content",
    semanticClaimsDigest: "sha256:order-123-cancelled-claims",
  });
  const [evidence] = matchContextRetentionEvidence({
    obligation: createObligation([retainedStateAnchor.anchorId]),
    manifest: createManifest({
      contextUnitDigests: [
        {
          contextUnitId: retainedStateAnchor.anchorId,
          digest: retainedStateAnchor.contentDigest,
        },
      ],
      contextUnitOrder: [retainedStateAnchor.anchorId],
      tokenPositionRanges: [
        {
          contextUnitId: retainedStateAnchor.anchorId,
          startToken: 11,
          endToken: 18,
        },
      ],
    }),
    anchors: [retainedStateAnchor, conflictingStateAnchor],
    evaluatedAt,
  });

  assert.equal(evidence.retentionMode, ContextRetentionMode.Conflicting);
  assert.deepEqual(evidence.conflictEvidence, [conflictingStateAnchor.anchorId]);
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

test("marks low trust instructions as tainted for write operations", () => {
  const anchor = createAnchor({
    anchorId: "ctx-low-trust-delete-instruction",
    trustTier: ContextAnchorTrustTier.Low,
  });
  const evidence = matchSingleEvidence({
    anchor,
    obligation: createObligation([anchor.anchorId], {
      actionImpactClass: "database_write",
    }),
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
  });

  assert.equal(evidence.retentionMode, ContextRetentionMode.Tainted);
  assert.equal(evidence.trustScore, 0);
  assert.equal(evidence.coverageScore, 1);
});

test("evaluates stale, conflict, and taint rule outputs for state input", () => {
  const staleAnchor = createAnchor({
    anchorId: "ctx-stale-approval",
    anchorType: ContextAnchorType.ApprovalNote,
    createdAt: "2026-05-01T09:00:00.000Z",
    expiresAt: "2026-05-01T12:00:00.000Z",
    resourceScope: "deployment:payments-prod",
  });
  const lowTrustInstructionAnchor = createAnchor({
    anchorId: "ctx-low-trust-deploy-instruction",
    trustTier: ContextAnchorTrustTier.Untrusted,
    resourceScope: "deployment:payments-prod",
  });
  const negativeEvidenceAnchor = createAnchor({
    anchorId: "ctx-negative-deploy-policy",
    anchorType: ContextAnchorType.NegativeEvidence,
    resourceScope: "deployment:payments-prod",
  });
  const manifest = createManifest({
    contextUnitDigests: [
      {
        contextUnitId: staleAnchor.anchorId,
        digest: staleAnchor.contentDigest,
      },
      {
        contextUnitId: lowTrustInstructionAnchor.anchorId,
        digest: lowTrustInstructionAnchor.contentDigest,
      },
    ],
    contextUnitOrder: [staleAnchor.anchorId, lowTrustInstructionAnchor.anchorId],
    tokenPositionRanges: [
      {
        contextUnitId: staleAnchor.anchorId,
        startToken: 1,
        endToken: 4,
      },
      {
        contextUnitId: lowTrustInstructionAnchor.anchorId,
        startToken: 5,
        endToken: 8,
      },
    ],
  });
  const ruleEvaluation = evaluateContextRetentionRules({
    obligation: createObligation(
      [staleAnchor.anchorId, lowTrustInstructionAnchor.anchorId],
      {
        actionImpactClass: "production_deploy",
        freshnessWindow: "PT30M",
      },
    ),
    manifest,
    anchors: [staleAnchor, lowTrustInstructionAnchor, negativeEvidenceAnchor],
    evaluatedAt,
  });

  assert.deepEqual(ruleEvaluation.staleAnchorIds, [staleAnchor.anchorId]);
  assert.deepEqual(ruleEvaluation.conflictingAnchorIds, [
    lowTrustInstructionAnchor.anchorId,
    staleAnchor.anchorId,
  ]);
  assert.deepEqual(ruleEvaluation.taintedAnchorIds, [
    lowTrustInstructionAnchor.anchorId,
  ]);
  assert.deepEqual(
    ruleEvaluation.conflictEvidenceByAnchorId[staleAnchor.anchorId],
    [negativeEvidenceAnchor.anchorId],
  );
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
