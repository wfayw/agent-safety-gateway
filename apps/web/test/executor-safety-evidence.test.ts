import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuditRecord } from '@agent-safety-gateway/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  createExecutorSafetyEvidenceViewModel,
  ExecutorSafetyEvidencePanel,
  mergeExecutorSafetyEvidenceRecords,
} from '../src/executor-safety-evidence';
import type { ExecutorSafetyEvidenceRecord } from '../src/api';

const auditFixture: AuditRecord = {
  id: 'audit-sql-delete-001',
  request: {
    id: 'request-sql-delete-001',
    actor: 'agent:ralph',
    taskPurpose: 'delete stale production orders',
    toolType: 'sql',
    rawPayload: {
      sql: 'DELETE FROM orders WHERE status = \'STALE\'',
    },
    environment: 'production',
    createdAt: '2026-05-01T06:00:00.000Z',
  },
  actionTuple: {
    toolType: 'sql',
    operation: 'delete',
    target: 'database.orders',
    environment: 'production',
    actor: 'agent:ralph',
    taskPurpose: 'delete stale production orders',
    parameters: {},
    timestamp: '2026-05-01T06:00:00.000Z',
  },
  directResources: [],
  indirectResources: [],
  impactPaths: [],
  riskFactors: [],
  riskLevel: 'prohibited',
  policyVersion: 'policy-v1',
  policyTrace: {
    thresholds: {
      medium: 40,
      high: 70,
      prohibited: 90,
    },
    weights: {
      dependency_impact: 1,
      environment: 1,
      operation: 1,
      resource_criticality: 1,
      reversibility: 1,
      validation_state: 1,
    },
    hardRules: [],
    matchedRuleIds: [],
    weightedFactors: [],
  },
  decision: {
    type: 'block',
    code: 'risk.prohibited.block',
    reason: 'Production delete is blocked.',
    recommendedAction: 'Do not invoke executor.',
    rewrittenRequest: null,
  },
  createdAt: '2026-05-01T06:00:00.000Z',
  forbiddenEffectObligations: [
    {
      obligationId: 'obligation-missing-context',
      effectType: 'sql',
      resourceScope: ['database.invoices'],
      environment: 'production',
      severity: 'critical',
      requiredEvidenceTypes: ['write_denial'],
      failClosedAction: 'deny_permit',
    },
  ],
  coverageMapHash: 'sha256:audit-coverage-map',
  permitIssued: false,
  executorInvoked: false,
};

const evidenceRecords: ExecutorSafetyEvidenceRecord[] = [
  {
    id: 'safety-obligation-001',
    requestId: 'request-sql-delete-001',
    auditId: 'audit-sql-delete-001',
    executorId: 'executor-sql-prod',
    evidenceVersion: 'evidence-version-001',
    createdAt: '2026-05-01T06:00:01.000Z',
    kind: 'obligation',
    obligation: {
      obligationId: 'obligation-sql-delete-denial',
      effectType: 'sql',
      resourceScope: ['database.orders'],
      environment: 'production',
      severity: 'critical',
      requiredEvidenceTypes: ['delete_denial', 'no_row_mutation'],
      failClosedAction: 'deny_permit',
    },
  },
  {
    id: 'safety-coverage-map-001',
    requestId: 'request-sql-delete-001',
    auditId: 'audit-sql-delete-001',
    executorId: 'executor-sql-prod',
    evidenceVersion: 'evidence-version-001',
    createdAt: '2026-05-01T06:00:02.000Z',
    kind: 'coverageMap',
    coverageMap: {
      coverageMapId: 'coverage-map-sql-delete-001',
      executorId: 'executor-sql-prod',
      evaluatedAt: '2026-05-01T06:00:03.000Z',
      allObligationsCovered: false,
      coverage: [
        {
          obligationId: 'obligation-sql-delete-denial',
          requiredEvidenceType: 'delete_denial',
          status: 'covered',
          covered: true,
          evidenceHashes: ['sha256:delete-denial-001'],
          reason: 'Executor rejected the destructive SQL mutation probe.',
          evaluatedAt: '2026-05-01T06:00:03.000Z',
          completedAt: '2026-05-01T06:00:02.000Z',
        },
        {
          obligationId: 'obligation-sql-delete-denial',
          requiredEvidenceType: 'no_row_mutation',
          status: 'stale',
          covered: false,
          evidenceHashes: ['sha256:stale-row-snapshot-001'],
          reason: 'Snapshot evidence expired before permit evaluation.',
          evaluatedAt: '2026-05-01T06:00:03.000Z',
          expiresAt: '2026-05-01T06:00:02.000Z',
        },
        {
          obligationId: 'obligation-sql-delete-denial',
          requiredEvidenceType: 'no_trigger_side_effect',
          status: 'invalidated',
          covered: false,
          evidenceHashes: ['sha256:invalidated-trigger-snapshot-001'],
          reason: 'Executor fingerprint drift invalidated trigger snapshot.',
          evaluatedAt: '2026-05-01T06:00:03.000Z',
          invalidatedAt: '2026-05-01T06:00:03.000Z',
        },
        {
          obligationId: 'obligation-sql-delete-denial',
          requiredEvidenceType: 'no_external_side_effect',
          status: 'failed',
          covered: false,
          evidenceHashes: [],
          reason: 'Side-effect probe failed closed.',
          evaluatedAt: '2026-05-01T06:00:03.000Z',
        },
      ],
      obligations: [
        {
          obligationId: 'obligation-sql-delete-denial',
          status: 'failed',
          covered: false,
          requiredEvidence: [
            {
              obligationId: 'obligation-sql-delete-denial',
              requiredEvidenceType: 'delete_denial',
              status: 'covered',
              covered: true,
              evidenceHashes: ['sha256:delete-denial-001'],
              reason: 'Executor rejected the destructive SQL mutation probe.',
              evaluatedAt: '2026-05-01T06:00:03.000Z',
              completedAt: '2026-05-01T06:00:02.000Z',
            },
            {
              obligationId: 'obligation-sql-delete-denial',
              requiredEvidenceType: 'no_row_mutation',
              status: 'stale',
              covered: false,
              evidenceHashes: ['sha256:stale-row-snapshot-001'],
              reason: 'Snapshot evidence expired before permit evaluation.',
              evaluatedAt: '2026-05-01T06:00:03.000Z',
              expiresAt: '2026-05-01T06:00:02.000Z',
            },
            {
              obligationId: 'obligation-sql-delete-denial',
              requiredEvidenceType: 'no_trigger_side_effect',
              status: 'invalidated',
              covered: false,
              evidenceHashes: ['sha256:invalidated-trigger-snapshot-001'],
              reason: 'Executor fingerprint drift invalidated trigger snapshot.',
              evaluatedAt: '2026-05-01T06:00:03.000Z',
              invalidatedAt: '2026-05-01T06:00:03.000Z',
            },
            {
              obligationId: 'obligation-sql-delete-denial',
              requiredEvidenceType: 'no_external_side_effect',
              status: 'failed',
              covered: false,
              evidenceHashes: [],
              reason: 'Side-effect probe failed closed.',
              evaluatedAt: '2026-05-01T06:00:03.000Z',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'safety-state-001',
    requestId: 'request-sql-delete-001',
    auditId: 'audit-sql-delete-001',
    executorId: 'executor-sql-prod',
    evidenceVersion: 'evidence-version-001',
    createdAt: '2026-05-01T06:00:04.000Z',
    kind: 'safetyState',
    safetyState: {
      stateId: 'safety-state-sql-delete-001',
      executorId: 'executor-sql-prod',
      coverageMapId: 'coverage-map-sql-delete-001',
      state: 'EvidenceInvalidated',
      allObligationsCovered: false,
      evaluatedAt: '2026-05-01T06:00:04.000Z',
      coveredObligationIds: ['obligation-sql-delete-denial'],
      blockedObligationIds: ['obligation-sql-delete-denial'],
      blockingStatuses: ['stale', 'invalidated', 'failed'],
      transitionReason: 'Evidence drift and stale snapshots deny permit.',
      invalidatedBy: 'executor-fingerprint-drift',
      coverageMapHash: 'sha256:coverage-map-001',
      safetyEvidenceVersion: 'evidence-version-001',
    },
  },
  {
    id: 'safety-denial-001',
    requestId: 'request-sql-delete-001',
    auditId: 'audit-sql-delete-001',
    executorId: 'executor-sql-prod',
    evidenceVersion: 'evidence-version-001',
    createdAt: '2026-05-01T06:00:05.000Z',
    kind: 'denial',
    denial: {
      requestHash: 'sha256:request-sql-delete-001',
      executorId: 'executor-sql-prod',
      permitIssued: false,
      executorInvoked: false,
      missingEvidence: ['no_row_mutation'],
      invalidatedEvidence: ['sha256:invalidated-trigger-snapshot-001'],
      reason: 'Side-effect evidence is stale or invalidated.',
    },
  },
];

describe('executor safety evidence UI view model', () => {
  const [obligationRecord, coverageMapRecord, safetyStateRecord] = evidenceRecords;

  it('merges audit fields with evidence API records into coverage rows', () => {
    const viewModel = createExecutorSafetyEvidenceViewModel(auditFixture, evidenceRecords);

    assert.equal(viewModel.obligations.length, 2);
    assert.equal(viewModel.coverageMap?.coverageMapId, 'coverage-map-sql-delete-001');
    assert.equal(viewModel.safetyState?.state, 'EvidenceInvalidated');
    assert.equal(viewModel.permitDeniedEvidence?.reason, 'Side-effect evidence is stale or invalidated.');
    assert.equal(viewModel.permitBinding, null);
    assert.deepEqual(
      viewModel.coverageRows.map((row) => row.status),
      ['covered', 'stale', 'invalidated', 'failed', 'missing'],
    );
  });

  it('deduplicates evidence records by id and sorts the latest state first', () => {
    assert.ok(obligationRecord);
    assert.ok(coverageMapRecord);
    assert.ok(safetyStateRecord);

    const mergedRecords = mergeExecutorSafetyEvidenceRecords(
      [obligationRecord, safetyStateRecord],
      [safetyStateRecord, coverageMapRecord],
    );

    assert.deepEqual(
      mergedRecords.map((record) => record.id),
      ['safety-state-001', 'safety-coverage-map-001', 'safety-obligation-001'],
    );
  });

  it('renders coverage, drift, state, and permit denial evidence labels', () => {
    const markup = renderToStaticMarkup(
      createElement(ExecutorSafetyEvidencePanel, {
        audit: auditFixture,
        records: evidenceRecords,
      }),
    );

    assert.match(markup, /ExecutorSafetyEvidenceState/);
    assert.match(markup, /EvidenceCoverageMap/);
    assert.match(markup, /EvidenceInvalidated/);
    assert.match(markup, /covered/);
    assert.match(markup, /missing/);
    assert.match(markup, /stale/);
    assert.match(markup, /invalidated/);
    assert.match(markup, /failed/);
    assert.match(markup, /PermitBinding/);
    assert.match(markup, /PermitDeniedEvidence/);
    assert.match(markup, /Side-effect evidence is stale or invalidated\./);
  });
});
