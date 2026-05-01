import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ContextEvidencePanel,
  createContextEvidenceViewModel,
  mergeContextEvidenceRecords,
} from '../src/context-evidence';
import type { ContextAdequacyEvidenceRecord } from '../src/api';

const contextEvidenceRecords: ContextAdequacyEvidenceRecord[] = [
  {
    id: 'context-manifest-001',
    requestId: 'request-sql-delete-001',
    auditId: 'audit-sql-delete-001',
    inferenceId: 'inference-sql-delete-001',
    toolCallDigest: 'sha256:tool-call-sql-delete-001',
    createdAt: '2026-05-01T07:00:00.000Z',
    kind: 'promptAssemblyManifest',
    promptAssemblyManifest: {
      manifestId: 'manifest-sql-delete-001',
      inferenceId: 'inference-sql-delete-001',
      modelId: 'gpt-5.4',
      promptDigest: 'sha256:prompt-sql-delete-001',
      contextUnitDigests: [
        {
          contextUnitId: 'anchor-user-instruction',
          digest: 'sha256:anchor-user-instruction-content',
        },
      ],
      contextUnitOrder: ['anchor-user-instruction'],
      tokenPositionRanges: [
        {
          contextUnitId: 'anchor-user-instruction',
          startToken: 32,
          endToken: 80,
        },
      ],
      summaryDerivationDigests: [],
      retrievalQueryDigest: 'sha256:retrieval-query-none',
      retrievedDocumentDigests: [],
      memorySnapshotDigest: 'sha256:memory-snapshot-001',
      systemPolicyDigest: 'sha256:system-policy-001',
    },
  },
  {
    id: 'context-anchor-user-instruction',
    requestId: 'request-sql-delete-001',
    auditId: 'audit-sql-delete-001',
    inferenceId: 'inference-sql-delete-001',
    toolCallDigest: 'sha256:tool-call-sql-delete-001',
    createdAt: '2026-05-01T07:00:00.000Z',
    kind: 'contextAnchor',
    contextAnchor: {
      anchorId: 'anchor-user-instruction',
      anchorType: 'user_instruction',
      sourceIdentity: 'user:ops',
      authorityLevel: 'requester',
      resourceScope: 'database.orders',
      createdAt: '2026-05-01T06:55:00.000Z',
      expiresAt: '2026-05-01T08:00:00.000Z',
      contentDigest: 'sha256:anchor-user-instruction-content',
      semanticClaimsDigest: 'sha256:anchor-user-instruction-claims',
      mustBeVerbatim: true,
      allowCertifiedSummary: false,
      allowRetrievableReference: false,
      trustTier: 'high',
    },
  },
  {
    id: 'context-anchor-negative-evidence',
    requestId: 'request-sql-delete-001',
    auditId: 'audit-sql-delete-001',
    inferenceId: 'inference-sql-delete-001',
    toolCallDigest: 'sha256:tool-call-sql-delete-001',
    createdAt: '2026-05-01T07:00:00.000Z',
    kind: 'contextAnchor',
    contextAnchor: {
      anchorId: 'anchor-negative-evidence',
      anchorType: 'negative_evidence',
      sourceIdentity: 'gateway:policy',
      authorityLevel: 'policy',
      resourceScope: 'database.orders',
      createdAt: '2026-05-01T06:50:00.000Z',
      expiresAt: '2026-05-01T07:30:00.000Z',
      contentDigest: 'sha256:negative-evidence-content',
      semanticClaimsDigest: 'sha256:negative-evidence-claims',
      mustBeVerbatim: false,
      allowCertifiedSummary: true,
      allowRetrievableReference: true,
      trustTier: 'high',
    },
  },
  {
    id: 'context-obligation-001',
    requestId: 'request-sql-delete-001',
    auditId: 'audit-sql-delete-001',
    inferenceId: 'inference-sql-delete-001',
    toolCallDigest: 'sha256:tool-call-sql-delete-001',
    createdAt: '2026-05-01T07:00:00.000Z',
    kind: 'requiredContextObligation',
    requiredContextObligation: {
      obligationId: 'required-context-sql-delete-001',
      toolCallDigest: 'sha256:tool-call-sql-delete-001',
      actionImpactClass: 'sql.production.delete',
      requiredAnchors: ['anchor-user-instruction', 'anchor-negative-evidence'],
      freshnessWindow: 'PT1H',
      minimumRetentionMode: 'verbatim',
      conflictPolicy: 'deny_on_omitted_conflict',
      taintPolicy: 'deny_on_untrusted_instruction',
      missingAnchorAction: 'reground',
    },
  },
  {
    id: 'context-retention-user-instruction',
    requestId: 'request-sql-delete-001',
    auditId: 'audit-sql-delete-001',
    inferenceId: 'inference-sql-delete-001',
    toolCallDigest: 'sha256:tool-call-sql-delete-001',
    createdAt: '2026-05-01T07:00:01.000Z',
    kind: 'contextRetentionEvidence',
    contextRetentionEvidence: {
      evidenceId: 'retention-user-instruction',
      obligationId: 'required-context-sql-delete-001',
      toolCallDigest: 'sha256:tool-call-sql-delete-001',
      promptAssemblyManifestId: 'manifest-sql-delete-001',
      inferenceId: 'inference-sql-delete-001',
      anchorId: 'anchor-user-instruction',
      retentionMode: 'verbatim',
      minimumRetentionMode: 'verbatim',
      coverageScore: 1,
      freshnessScore: 1,
      trustScore: 1,
      conflictEvidence: [],
      summaryVerifierResult: 'not_applicable',
      referenceVerifierResult: 'not_applicable',
      matchedContextUnitId: 'anchor-user-instruction',
      matchedDigest: 'sha256:anchor-user-instruction-content',
    },
  },
  {
    id: 'context-retention-negative-evidence',
    requestId: 'request-sql-delete-001',
    auditId: 'audit-sql-delete-001',
    inferenceId: 'inference-sql-delete-001',
    toolCallDigest: 'sha256:tool-call-sql-delete-001',
    createdAt: '2026-05-01T07:00:02.000Z',
    kind: 'contextRetentionEvidence',
    contextRetentionEvidence: {
      evidenceId: 'retention-negative-evidence',
      obligationId: 'required-context-sql-delete-001',
      toolCallDigest: 'sha256:tool-call-sql-delete-001',
      promptAssemblyManifestId: 'manifest-sql-delete-001',
      inferenceId: 'inference-sql-delete-001',
      anchorId: 'anchor-negative-evidence',
      retentionMode: 'missing',
      minimumRetentionMode: 'verbatim',
      coverageScore: 0,
      freshnessScore: 1,
      trustScore: 1,
      conflictEvidence: ['anchor-negative-evidence'],
      summaryVerifierResult: 'not_verified',
      referenceVerifierResult: 'not_verified',
      matchedContextUnitId: null,
      matchedDigest: null,
    },
  },
  {
    id: 'context-state-001',
    requestId: 'request-sql-delete-001',
    auditId: 'audit-sql-delete-001',
    inferenceId: 'inference-sql-delete-001',
    toolCallDigest: 'sha256:tool-call-sql-delete-001',
    createdAt: '2026-05-01T07:00:03.000Z',
    kind: 'contextSufficiencyState',
    contextSufficiencyState: {
      stateId: 'context-state-sql-delete-001',
      obligationId: 'required-context-sql-delete-001',
      toolCallDigest: 'sha256:tool-call-sql-delete-001',
      promptAssemblyManifestId: 'manifest-sql-delete-001',
      inferenceId: 'inference-sql-delete-001',
      state: 'Conflicting',
      sufficient: false,
      evaluatedAt: '2026-05-01T07:00:03.000Z',
      requiredAnchorIds: ['anchor-user-instruction', 'anchor-negative-evidence'],
      coveredAnchorIds: ['anchor-user-instruction'],
      blockedAnchorIds: ['anchor-negative-evidence'],
      missingAnchorIds: ['anchor-negative-evidence'],
      staleAnchorIds: [],
      conflictingAnchorIds: ['anchor-negative-evidence'],
      contaminatedAnchorIds: [],
      verbatimAnchorIds: ['anchor-user-instruction'],
      certifiedSummaryAnchorIds: [],
      retrievableReferenceAnchorIds: [],
      transitionReason: 'Required negative evidence was omitted, causing conflict denial.',
    },
  },
  {
    id: 'context-adequacy-001',
    requestId: 'request-sql-delete-001',
    auditId: 'audit-sql-delete-001',
    inferenceId: 'inference-sql-delete-001',
    toolCallDigest: 'sha256:tool-call-sql-delete-001',
    createdAt: '2026-05-01T07:00:04.000Z',
    kind: 'contextAdequacyEvidence',
    contextAdequacyEvidence: {
      evidenceId: 'context-adequacy-sql-delete-001',
      toolCallDigest: 'sha256:tool-call-sql-delete-001',
      requiredContextObligationDigest: 'sha256:required-context-obligation-001',
      promptAssemblyManifestDigest: 'sha256:prompt-assembly-manifest-001',
      contextRetentionEvidenceDigest: 'sha256:context-retention-evidence-001',
      contextSufficiencyState: 'Conflicting',
      regroundingApplied: false,
      permitIssued: false,
      permitOutcome: 'context.conflicting.deny',
      denialReason: 'Required negative evidence was omitted.',
      createdAt: '2026-05-01T07:00:04.000Z',
    },
    evidenceHash: 'sha256:context-adequacy-evidence-001',
  },
];

describe('context evidence UI view model', () => {
  const [manifestRecord, anchorRecord, _negativeAnchorRecord, _obligationRecord, _retentionRecord, _negativeRetentionRecord, stateRecord] = contextEvidenceRecords;

  it('merges records by id and sorts the latest proof state first', () => {
    assert.ok(manifestRecord);
    assert.ok(anchorRecord);
    assert.ok(stateRecord);

    const mergedRecords = mergeContextEvidenceRecords(
      [manifestRecord, stateRecord],
      [stateRecord, anchorRecord],
    );

    assert.deepEqual(
      mergedRecords.map((record) => record.id),
      ['context-state-001', 'context-manifest-001', 'context-anchor-user-instruction'],
    );
  });

  it('summarizes obligations, prompt manifest, anchor visibility, and retention status', () => {
    const viewModel = createContextEvidenceViewModel(contextEvidenceRecords);

    assert.equal(viewModel.promptAssemblyManifest?.manifestId, 'manifest-sql-delete-001');
    assert.equal(viewModel.contextSufficiencyState?.state, 'Conflicting');
    assert.equal(viewModel.contextAdequacyEvidenceHash, 'sha256:context-adequacy-evidence-001');
    assert.equal(viewModel.obligations.length, 1);
    assert.deepEqual(
      viewModel.anchorRows.map((row) => [row.anchorId, row.retentionMode, row.visibleInPrompt]),
      [
        ['anchor-negative-evidence', 'missing', false],
        ['anchor-user-instruction', 'verbatim', true],
      ],
    );
    assert.deepEqual(
      viewModel.obligationRows.map((row) => [row.obligation.obligationId, row.coveredAnchorCount, row.requiredAnchorCount]),
      [['required-context-sql-delete-001', 1, 2]],
    );
  });

  it('renders required context, prompt manifest, anchor retention, and state explanations', () => {
    const markup = renderToStaticMarkup(
      createElement(ContextEvidencePanel, {
        records: contextEvidenceRecords,
      }),
    );

    assert.match(markup, /ContextSufficiencyState/);
    assert.match(markup, /PromptAssemblyManifest/);
    assert.match(markup, /RequiredContextObligation/);
    assert.match(markup, /Context anchor retention status/);
    assert.match(markup, /conflicting deny/);
    assert.match(markup, /reground required/);
    assert.match(markup, /reapproval required/);
    assert.match(markup, /sufficient/);
    assert.match(markup, /anchor-user-instruction/);
    assert.match(markup, /anchor-negative-evidence/);
    assert.match(markup, /visible/);
    assert.match(markup, /not visible/);
    assert.match(markup, /context\.conflicting\.deny/);
  });
});
