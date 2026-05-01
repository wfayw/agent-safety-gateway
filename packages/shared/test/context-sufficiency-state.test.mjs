import assert from "node:assert/strict";
import test from "node:test";

import {
  ContextAnchorTrustTier,
  ContextAnchorType,
  ContextRetentionDomain,
  ContextRetentionMode,
  ContextSufficiencyStateName,
  ContextSufficiencyStateNameValues,
  RequiredContextConflictPolicy,
  RequiredContextMissingAnchorAction,
  RequiredContextTaintPolicy,
  createContextAnchorCertifiedSummaryDerivationDigest,
  evaluateContextSufficiencyState,
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
  actionImpactClass: "production_write",
  requiredAnchors: anchorIds,
  freshnessWindow: "PT30M",
  minimumRetentionMode: ContextRetentionMode.Verbatim,
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

const createVerbatimManifest = (anchor, overrides = {}) =>
  createManifest({
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
    ...overrides,
  });

const createCertifiedSummaryManifest = (anchor, overrides = {}) =>
  createManifest({
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
        startToken: 12,
        endToken: 26,
      },
    ],
    summaryDerivationDigests: [
      createContextAnchorCertifiedSummaryDerivationDigest(anchor),
    ],
    ...overrides,
  });

const evaluateFromManifest = ({
  anchor = createAnchor(),
  obligation = createObligation([anchor.anchorId]),
  manifest = createVerbatimManifest(anchor),
  anchors = [anchor],
  matcherOverrides = {},
}) => {
  const evidence = matchContextRetentionEvidence({
    obligation,
    manifest,
    anchors,
    evaluatedAt,
    ...matcherOverrides,
  });

  return evaluateContextSufficiencyState({
    obligation,
    evidence,
    anchors,
    evaluatedAt,
  });
};

test("defines all ContextSufficiencyState state names", () => {
  assert.equal(ContextRetentionDomain.sufficiencyState, "ContextSufficiencyState");
  assert.deepEqual(ContextSufficiencyStateNameValues, [
    ContextSufficiencyStateName.Sufficient,
    ContextSufficiencyStateName.SufficientByCertifiedSummary,
    ContextSufficiencyStateName.RegroundRequired,
    ContextSufficiencyStateName.ReapprovalRequired,
    ContextSufficiencyStateName.Stale,
    ContextSufficiencyStateName.Conflicting,
    ContextSufficiencyStateName.Contaminated,
    ContextSufficiencyStateName.Insufficient,
  ]);
});

test("enters Sufficient when all anchors are retained verbatim", () => {
  const anchor = createAnchor();
  const state = evaluateFromManifest({ anchor });

  assert.equal(state.state, ContextSufficiencyStateName.Sufficient);
  assert.equal(state.sufficient, true);
  assert.deepEqual(state.coveredAnchorIds, [anchor.anchorId]);
  assert.deepEqual(state.blockedAnchorIds, []);
  assert.deepEqual(state.verbatimAnchorIds, [anchor.anchorId]);
  assert.equal(state.promptAssemblyManifestId, "manifest-payment-001");
  assert.equal(state.inferenceId, "inference-payment-001");
});

test("enters SufficientByCertifiedSummary for verified summary retention", () => {
  const anchor = createAnchor();
  const obligation = createObligation([anchor.anchorId], {
    minimumRetentionMode: ContextRetentionMode.CertifiedSummary,
  });
  const state = evaluateFromManifest({
    anchor,
    obligation,
    manifest: createCertifiedSummaryManifest(anchor),
  });

  assert.equal(
    state.state,
    ContextSufficiencyStateName.SufficientByCertifiedSummary,
  );
  assert.equal(state.sufficient, true);
  assert.deepEqual(state.coveredAnchorIds, [anchor.anchorId]);
  assert.deepEqual(state.certifiedSummaryAnchorIds, [anchor.anchorId]);
});

test("enters RegroundRequired when required context evidence is missing", () => {
  const anchor = createAnchor();
  const obligation = createObligation([anchor.anchorId], {
    missingAnchorAction: RequiredContextMissingAnchorAction.Reground,
  });
  const state = evaluateFromManifest({
    anchor,
    obligation,
    manifest: createManifest(),
  });

  assert.equal(state.state, ContextSufficiencyStateName.RegroundRequired);
  assert.equal(state.sufficient, false);
  assert.deepEqual(state.missingAnchorIds, [anchor.anchorId]);
  assert.deepEqual(state.blockedAnchorIds, [anchor.anchorId]);
});

test("enters ReapprovalRequired for missing verbatim approval notes by policy", () => {
  const anchor = createAnchor({
    anchorId: "ctx-approval-note",
    anchorType: ContextAnchorType.ApprovalNote,
    contentDigest: "sha256:approval-note-verbatim",
    semanticClaimsDigest: "sha256:approval-note-summary",
    mustBeVerbatim: true,
  });
  const obligation = createObligation([anchor.anchorId], {
    missingAnchorAction: RequiredContextMissingAnchorAction.Reapproval,
  });
  const state = evaluateFromManifest({
    anchor,
    obligation,
    manifest: createCertifiedSummaryManifest(anchor),
  });

  assert.equal(state.state, ContextSufficiencyStateName.ReapprovalRequired);
  assert.equal(state.sufficient, false);
  assert.deepEqual(state.missingAnchorIds, [anchor.anchorId]);
  assert.deepEqual(state.certifiedSummaryAnchorIds, [anchor.anchorId]);
});

test("enters Insufficient for missing verbatim approval notes by deny policy", () => {
  const anchor = createAnchor({
    anchorId: "ctx-approval-note",
    anchorType: ContextAnchorType.ApprovalNote,
    contentDigest: "sha256:approval-note-verbatim",
    semanticClaimsDigest: "sha256:approval-note-summary",
    mustBeVerbatim: true,
  });
  const obligation = createObligation([anchor.anchorId], {
    missingAnchorAction: RequiredContextMissingAnchorAction.Deny,
  });
  const state = evaluateFromManifest({
    anchor,
    obligation,
    manifest: createCertifiedSummaryManifest(anchor),
  });

  assert.equal(state.state, ContextSufficiencyStateName.Insufficient);
  assert.equal(state.sufficient, false);
  assert.deepEqual(state.missingAnchorIds, [anchor.anchorId]);
});

test("enters Stale when retained context is past its freshness window", () => {
  const anchor = createAnchor({
    createdAt: "2026-05-01T09:00:00.000Z",
    expiresAt: "2026-05-01T11:00:00.000Z",
  });
  const state = evaluateFromManifest({ anchor });

  assert.equal(state.state, ContextSufficiencyStateName.Stale);
  assert.equal(state.sufficient, false);
  assert.deepEqual(state.staleAnchorIds, [anchor.anchorId]);
  assert.deepEqual(state.blockedAnchorIds, [anchor.anchorId]);
});

test("enters Conflicting when per-anchor evidence has conflict evidence", () => {
  const anchor = createAnchor();
  const conflictingAnchorId = "ctx-negative-evidence";
  const state = evaluateFromManifest({
    anchor,
    matcherOverrides: {
      conflictingAnchorIds: [anchor.anchorId],
    },
  });
  const evidence = matchContextRetentionEvidence({
    obligation: createObligation([anchor.anchorId]),
    manifest: createVerbatimManifest(anchor),
    anchors: [anchor],
    evaluatedAt,
    conflictingAnchorIds: [conflictingAnchorId],
  });
  const explicitConflictState = evaluateContextSufficiencyState({
    obligation: createObligation([anchor.anchorId]),
    evidence: [
      {
        ...evidence[0],
        retentionMode: ContextRetentionMode.Conflicting,
        conflictEvidence: [conflictingAnchorId],
      },
    ],
    anchors: [anchor],
    evaluatedAt,
  });

  assert.equal(state.state, ContextSufficiencyStateName.Conflicting);
  assert.equal(explicitConflictState.state, ContextSufficiencyStateName.Conflicting);
  assert.equal(explicitConflictState.sufficient, false);
  assert.deepEqual(explicitConflictState.conflictingAnchorIds, [anchor.anchorId]);
});

test("enters Contaminated when per-anchor evidence is tainted", () => {
  const anchor = createAnchor({ trustTier: ContextAnchorTrustTier.Untrusted });
  const state = evaluateFromManifest({
    anchor,
    matcherOverrides: {
      taintedAnchorIds: [anchor.anchorId],
    },
  });

  assert.equal(state.state, ContextSufficiencyStateName.Contaminated);
  assert.equal(state.sufficient, false);
  assert.deepEqual(state.contaminatedAnchorIds, [anchor.anchorId]);
  assert.deepEqual(state.blockedAnchorIds, [anchor.anchorId]);
});
