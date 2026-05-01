import { Card, Descriptions, Flex, Space, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import type { AuditRecord } from '@agent-safety-gateway/shared';
import type {
  EvidenceCoverageEntry,
  EvidenceCoverageMap,
  EvidenceCoverageStatus,
  ExecutorSafetyEvidenceState,
  ExecutorSafetyEvidenceStateName,
  ForbiddenEffectEvidenceType,
  ForbiddenEffectObligation,
  PermitBinding,
  PermitDeniedEvidence,
} from '@agent-safety-gateway/shared/forbidden-side-effect';
import {
  ExecutorSafetyEvidenceRecordKind,
  type ExecutorSafetyEvidenceRecord,
} from './api';

const { Text } = Typography;

const coverageStatusConfig: Record<EvidenceCoverageStatus, { color: string; label: string }> = {
  covered: { color: 'success', label: 'covered' },
  failed: { color: 'error', label: 'failed' },
  invalidated: { color: 'error', label: 'invalidated' },
  missing: { color: 'error', label: 'missing' },
  notApplicable: { color: 'default', label: 'notApplicable' },
  stale: { color: 'warning', label: 'stale' },
};

const safetyStateConfig: Record<ExecutorSafetyEvidenceStateName, { color: string; label: string }> = {
  EvidenceComplete: { color: 'success', label: 'EvidenceComplete' },
  EvidenceExpired: { color: 'warning', label: 'EvidenceExpired' },
  EvidenceFailed: { color: 'error', label: 'EvidenceFailed' },
  EvidenceInvalidated: { color: 'error', label: 'EvidenceInvalidated' },
  EvidenceMissing: { color: 'error', label: 'EvidenceMissing' },
  EvidencePartial: { color: 'warning', label: 'EvidencePartial' },
};

type ExecutorSafetyCoverageRow = {
  key: string;
  obligationId: string;
  effectType: string;
  resourceScope: string;
  requiredEvidenceType: ForbiddenEffectEvidenceType | 'unrecorded';
  status: EvidenceCoverageStatus;
  covered: boolean;
  evidenceHashes: readonly string[];
  reason: string;
  evaluatedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  invalidatedAt: string | null;
};

export type ExecutorSafetyEvidenceViewModel = {
  obligations: ForbiddenEffectObligation[];
  coverageMap: EvidenceCoverageMap | null;
  safetyState: ExecutorSafetyEvidenceState | null;
  coverageRows: ExecutorSafetyCoverageRow[];
  permitBinding: PermitBinding | null;
  permitDeniedEvidence: PermitDeniedEvidence | null;
  recordCount: number;
};

const toTimestamp = (value: string) => {
  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return '未记录';
  }

  const timestamp = toTimestamp(value);

  if (timestamp === 0) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(timestamp);
};

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const recordTimestamp = (record: ExecutorSafetyEvidenceRecord) => {
  switch (record.kind) {
    case ExecutorSafetyEvidenceRecordKind.CoverageMap:
      return record.coverageMap.evaluatedAt;
    case ExecutorSafetyEvidenceRecordKind.SafetyState:
      return record.safetyState.evaluatedAt;
    default:
      return record.createdAt;
  }
};

export const mergeExecutorSafetyEvidenceRecords = (
  ...recordGroups: ExecutorSafetyEvidenceRecord[][]
) => {
  const recordsById = new Map<string, ExecutorSafetyEvidenceRecord>();

  for (const record of recordGroups.flat()) {
    recordsById.set(record.id, record);
  }

  return [...recordsById.values()].sort(
    (left, right) => toTimestamp(recordTimestamp(right)) - toTimestamp(recordTimestamp(left)),
  );
};

const latestByTime = <TValue,>(items: readonly TValue[], getTime: (item: TValue) => string) => {
  return [...items].sort((left, right) => toTimestamp(getTime(right)) - toTimestamp(getTime(left)))[0] ?? null;
};

const collectObligations = (
  audit: AuditRecord,
  records: readonly ExecutorSafetyEvidenceRecord[],
) => {
  const obligationsById = new Map<string, ForbiddenEffectObligation>();

  for (const obligation of audit.forbiddenEffectObligations ?? []) {
    obligationsById.set(obligation.obligationId, obligation);
  }

  for (const record of records) {
    if (record.kind === ExecutorSafetyEvidenceRecordKind.Obligation) {
      obligationsById.set(record.obligation.obligationId, record.obligation);
    }
  }

  return [...obligationsById.values()];
};

const findCoverageMap = (
  audit: AuditRecord,
  records: readonly ExecutorSafetyEvidenceRecord[],
) => {
  const coverageMaps = records
    .filter((record) => record.kind === ExecutorSafetyEvidenceRecordKind.CoverageMap)
    .map((record) => record.coverageMap);

  const stateCoverageMapId = audit.safetyEvidenceState?.coverageMapId;

  if (stateCoverageMapId) {
    const matchingMap = coverageMaps.find((coverageMap) => coverageMap.coverageMapId === stateCoverageMapId);

    if (matchingMap) {
      return matchingMap;
    }
  }

  return latestByTime(coverageMaps, (coverageMap) => coverageMap.evaluatedAt);
};

const findSafetyState = (
  audit: AuditRecord,
  records: readonly ExecutorSafetyEvidenceRecord[],
) => {
  if (audit.safetyEvidenceState) {
    return audit.safetyEvidenceState;
  }

  const safetyStates = records
    .filter((record) => record.kind === ExecutorSafetyEvidenceRecordKind.SafetyState)
    .map((record) => record.safetyState);

  return latestByTime(safetyStates, (safetyState) => safetyState.evaluatedAt);
};

const findPermitBinding = (
  audit: AuditRecord,
  records: readonly ExecutorSafetyEvidenceRecord[],
) => {
  if (audit.permitBinding) {
    return audit.permitBinding;
  }

  const permits = records
    .filter((record) => record.kind === ExecutorSafetyEvidenceRecordKind.Permit)
    .map((record) => ({ permit: record.permit, createdAt: record.createdAt }));

  return latestByTime(permits, (record) => record.createdAt)?.permit ?? null;
};

const findPermitDeniedEvidence = (
  audit: AuditRecord,
  records: readonly ExecutorSafetyEvidenceRecord[],
) => {
  if (audit.permitDeniedEvidence) {
    return audit.permitDeniedEvidence;
  }

  const denials = records
    .filter((record) => record.kind === ExecutorSafetyEvidenceRecordKind.Denial)
    .map((record) => ({ denial: record.denial, createdAt: record.createdAt }));

  return latestByTime(denials, (record) => record.createdAt)?.denial ?? null;
};

const getObligationDisplay = (
  obligationsById: ReadonlyMap<string, ForbiddenEffectObligation>,
  obligationId: string,
) => {
  const obligation = obligationsById.get(obligationId);

  return {
    effectType: obligation?.effectType ?? 'unknown',
    resourceScope: obligation?.resourceScope.join(', ') ?? '未记录资源范围',
  };
};

const toCoverageRow = (
  entry: EvidenceCoverageEntry,
  index: number,
  obligationsById: ReadonlyMap<string, ForbiddenEffectObligation>,
): ExecutorSafetyCoverageRow => {
  const obligationDisplay = getObligationDisplay(obligationsById, entry.obligationId);

  return {
    key: `${entry.obligationId}:${entry.requiredEvidenceType}:${index}`,
    obligationId: entry.obligationId,
    effectType: obligationDisplay.effectType,
    resourceScope: obligationDisplay.resourceScope,
    requiredEvidenceType: entry.requiredEvidenceType,
    status: entry.status,
    covered: entry.covered,
    evidenceHashes: entry.evidenceHashes,
    reason: entry.reason,
    evaluatedAt: entry.evaluatedAt,
    completedAt: entry.completedAt ?? null,
    expiresAt: entry.expiresAt ?? null,
    invalidatedAt: entry.invalidatedAt ?? null,
  };
};

const createCoverageRows = (
  obligations: readonly ForbiddenEffectObligation[],
  coverageMap: EvidenceCoverageMap | null,
) => {
  const obligationsById = new Map(
    obligations.map((obligation) => [obligation.obligationId, obligation]),
  );
  const rows: ExecutorSafetyCoverageRow[] = [];
  const seenRowKeys = new Set<string>();

  if (coverageMap) {
    for (const obligationCoverage of coverageMap.obligations) {
      if (obligationCoverage.requiredEvidence.length === 0) {
        const obligationDisplay = getObligationDisplay(obligationsById, obligationCoverage.obligationId);
        const row = {
          key: `${obligationCoverage.obligationId}:unrecorded`,
          obligationId: obligationCoverage.obligationId,
          effectType: obligationDisplay.effectType,
          resourceScope: obligationDisplay.resourceScope,
          requiredEvidenceType: 'unrecorded' as const,
          status: obligationCoverage.status,
          covered: obligationCoverage.covered,
          evidenceHashes: [],
          reason: 'CoverageMap 未记录 requiredEvidence 明细。',
          evaluatedAt: coverageMap.evaluatedAt,
          completedAt: null,
          expiresAt: null,
          invalidatedAt: null,
        };
        rows.push(row);
        seenRowKeys.add(row.key);
        continue;
      }

      obligationCoverage.requiredEvidence.forEach((entry, index) => {
        const row = toCoverageRow(entry, index, obligationsById);
        rows.push(row);
        seenRowKeys.add(row.key);
      });
    }

    coverageMap.coverage.forEach((entry, index) => {
      const row = toCoverageRow(entry, index, obligationsById);

      if (!seenRowKeys.has(row.key)) {
        rows.push(row);
        seenRowKeys.add(row.key);
      }
    });
  }

  const coveredObligationIds = new Set(rows.map((row) => row.obligationId));

  for (const obligation of obligations) {
    if (coveredObligationIds.has(obligation.obligationId)) {
      continue;
    }

    for (const [index, requiredEvidenceType] of obligation.requiredEvidenceTypes.entries()) {
      rows.push({
        key: `${obligation.obligationId}:${requiredEvidenceType}:missing:${index}`,
        obligationId: obligation.obligationId,
        effectType: obligation.effectType,
        resourceScope: obligation.resourceScope.join(', '),
        requiredEvidenceType,
        status: 'missing',
        covered: false,
        evidenceHashes: [],
        reason: '尚未找到该 obligation 的 EvidenceCoverageMap 记录。',
        evaluatedAt: null,
        completedAt: null,
        expiresAt: null,
        invalidatedAt: null,
      });
    }
  }

  return rows;
};

export const createExecutorSafetyEvidenceViewModel = (
  audit: AuditRecord,
  records: readonly ExecutorSafetyEvidenceRecord[],
): ExecutorSafetyEvidenceViewModel => {
  const obligations = collectObligations(audit, records);
  const coverageMap = findCoverageMap(audit, records);
  const safetyState = findSafetyState(audit, records);

  return {
    obligations,
    coverageMap,
    safetyState,
    coverageRows: createCoverageRows(obligations, coverageMap),
    permitBinding: findPermitBinding(audit, records),
    permitDeniedEvidence: findPermitDeniedEvidence(audit, records),
    recordCount: records.length,
  };
};

export function ExecutorSafetyCoverageStatusTag({ status }: { status: EvidenceCoverageStatus }) {
  const config = coverageStatusConfig[status];

  return <Tag color={config.color}>{config.label}</Tag>;
}

function ExecutorSafetyStateTag({ state }: { state: ExecutorSafetyEvidenceStateName }) {
  const config = safetyStateConfig[state];

  return <Tag color={config.color}>{config.label}</Tag>;
}

const renderCoverageStatusLegend = () => (
  <Space aria-label="coverage status legend" wrap>
    {Object.keys(coverageStatusConfig).map((status) => (
      <ExecutorSafetyCoverageStatusTag key={status} status={status as EvidenceCoverageStatus} />
    ))}
  </Space>
);

const renderOptionalCode = (value: string | null | undefined) => (
  value ? <Text code>{value}</Text> : <Text type="secondary">未记录</Text>
);

const renderBooleanPermitTag = (value: boolean | undefined) => {
  if (value === undefined) {
    return <Tag>未记录</Tag>;
  }

  return <Tag color={value ? 'success' : 'error'}>{String(value)}</Tag>;
};

const renderPermitBinding = (permitBinding: PermitBinding | null) => {
  if (!permitBinding) {
    return <Text type="secondary">未记录 PermitBinding；若 permitIssued=false，请查看 PermitDeniedEvidence。</Text>;
  }

  return (
    <Space className="executor-safety-json-card" orientation="vertical" size="small">
      <Descriptions
        bordered
        column={1}
        items={[
          {
            key: 'executorId',
            label: 'executorId',
            children: <Text code>{permitBinding.executorId}</Text>,
          },
          {
            key: 'safetyEvidenceVersion',
            label: 'safetyEvidenceVersion',
            children: <Text code>{permitBinding.safetyEvidenceVersion}</Text>,
          },
          {
            key: 'ttl',
            label: 'ttl',
            children: `${permitBinding.ttl} ms`,
          },
          {
            key: 'coverageMapHash',
            label: 'coverageMapHash',
            children: <Text code>{permitBinding.coverageMapHash}</Text>,
          },
        ]}
        size="small"
      />
      <pre className="simulator-json-preview">{formatJson(permitBinding)}</pre>
    </Space>
  );
};

const renderPermitDeniedEvidence = (permitDeniedEvidence: PermitDeniedEvidence | null) => {
  if (!permitDeniedEvidence) {
    return <Text type="secondary">未记录 PermitDeniedEvidence；若 permitIssued=true，请查看 PermitBinding。</Text>;
  }

  return (
    <Space className="executor-safety-json-card" orientation="vertical" size="small">
      <Descriptions
        bordered
        column={1}
        items={[
          {
            key: 'executorId',
            label: 'executorId',
            children: <Text code>{permitDeniedEvidence.executorId}</Text>,
          },
          {
            key: 'permitIssued',
            label: 'permitIssued',
            children: <Tag color="error">{String(permitDeniedEvidence.permitIssued)}</Tag>,
          },
          {
            key: 'executorInvoked',
            label: 'executorInvoked',
            children: <Tag color="error">{String(permitDeniedEvidence.executorInvoked)}</Tag>,
          },
          {
            key: 'reason',
            label: 'reason',
            children: permitDeniedEvidence.reason,
          },
        ]}
        size="small"
      />
      <pre className="simulator-json-preview">{formatJson(permitDeniedEvidence)}</pre>
    </Space>
  );
};

export function ExecutorSafetyEvidencePanel({
  audit,
  records,
}: {
  audit: AuditRecord;
  records: ExecutorSafetyEvidenceRecord[];
}) {
  const viewModel = createExecutorSafetyEvidenceViewModel(audit, records);
  const coverageHash = audit.coverageMapHash ?? viewModel.safetyState?.coverageMapHash ?? viewModel.permitBinding?.coverageMapHash ?? null;
  const permitOutcome = viewModel.permitBinding
    ? 'PermitBinding'
    : viewModel.permitDeniedEvidence
      ? 'PermitDeniedEvidence'
      : audit.permitIssued === undefined
        ? '未记录'
        : `permitIssued=${String(audit.permitIssued)}`;

  const coverageColumns: TableProps<ExecutorSafetyCoverageRow>['columns'] = [
    {
      title: 'ForbiddenEffectObligation',
      key: 'obligation',
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text code>{row.obligationId}</Text>
          <Text type="secondary">{row.effectType} · {row.resourceScope}</Text>
        </Space>
      ),
      width: 300,
    },
    {
      title: 'Required evidence',
      dataIndex: 'requiredEvidenceType',
      key: 'requiredEvidenceType',
      render: (requiredEvidenceType: string) => <Text code>{requiredEvidenceType}</Text>,
      width: 190,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: EvidenceCoverageStatus) => <ExecutorSafetyCoverageStatusTag status={status} />,
      width: 130,
    },
    {
      title: '覆盖',
      dataIndex: 'covered',
      key: 'covered',
      render: (covered: boolean) => <Tag color={covered ? 'success' : 'error'}>{covered ? 'covered=true' : 'covered=false'}</Tag>,
      width: 140,
    },
    {
      title: 'Evidence hashes / reason',
      key: 'evidence',
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text type="secondary">{row.reason}</Text>
          {row.evidenceHashes.length > 0 ? (
            <Text code>{row.evidenceHashes.join(', ')}</Text>
          ) : <Text type="secondary">未绑定 evidence hash</Text>}
        </Space>
      ),
    },
    {
      title: '时效/漂移',
      key: 'timeWindow',
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text>evaluated：{formatTimestamp(row.evaluatedAt)}</Text>
          <Text type="secondary">completed：{formatTimestamp(row.completedAt)}</Text>
          <Text type="secondary">expires：{formatTimestamp(row.expiresAt)}</Text>
          <Text type="secondary">invalidated：{formatTimestamp(row.invalidatedAt)}</Text>
        </Space>
      ),
      width: 260,
    },
  ];

  return (
    <Flex className="executor-safety-evidence-panel" vertical gap="middle">
      <Card size="small" title="禁止副作用证据摘要">
        <Descriptions
          bordered
          column={{ xs: 1, md: 2, xl: 3 }}
          items={[
            {
              key: 'state',
              label: 'ExecutorSafetyEvidenceState',
              children: viewModel.safetyState ? (
                <Space orientation="vertical" size={0}>
                  <ExecutorSafetyStateTag state={viewModel.safetyState.state} />
                  <Text type="secondary">{viewModel.safetyState.transitionReason}</Text>
                </Space>
              ) : <Text type="secondary">未记录</Text>,
            },
            {
              key: 'coverageMap',
              label: 'EvidenceCoverageMap',
              children: viewModel.coverageMap ? (
                <Space orientation="vertical" size={0}>
                  <Text code>{viewModel.coverageMap.coverageMapId}</Text>
                  <Text type="secondary">allObligationsCovered={String(viewModel.coverageMap.allObligationsCovered)}</Text>
                </Space>
              ) : <Text type="secondary">未记录</Text>,
            },
            {
              key: 'coverageMapHash',
              label: 'coverageMapHash',
              children: renderOptionalCode(coverageHash),
            },
            {
              key: 'permitIssued',
              label: 'permitIssued',
              children: renderBooleanPermitTag(audit.permitIssued),
            },
            {
              key: 'executorInvoked',
              label: 'executorInvoked',
              children: renderBooleanPermitTag(audit.executorInvoked),
            },
            {
              key: 'permitOutcome',
              label: '许可状态',
              children: <Tag color={viewModel.permitBinding ? 'success' : viewModel.permitDeniedEvidence ? 'error' : 'default'}>{permitOutcome}</Tag>,
            },
            {
              key: 'records',
              label: '证据记录',
              children: `${viewModel.recordCount} 条 API evidence records，${viewModel.obligations.length} 条 obligations`,
            },
            {
              key: 'legend',
              label: '状态图例',
              children: renderCoverageStatusLegend(),
            },
          ]}
          size="small"
        />
      </Card>
      <Card size="small" title="ForbiddenEffectObligation 覆盖状态">
        <Table
          columns={coverageColumns}
          dataSource={viewModel.coverageRows}
          locale={{ emptyText: '未找到禁止副作用 obligation 或 coverage map 记录' }}
          pagination={false}
          rowKey="key"
          scroll={{ x: 1260 }}
          size="small"
        />
      </Card>
      <Card size="small" title="PermitBinding / PermitDeniedEvidence">
        <Flex gap="middle" wrap>
          <Card className="executor-safety-permit-card" size="small" title="PermitBinding" type="inner">
            {renderPermitBinding(viewModel.permitBinding)}
          </Card>
          <Card className="executor-safety-permit-card" size="small" title="PermitDeniedEvidence" type="inner">
            {renderPermitDeniedEvidence(viewModel.permitDeniedEvidence)}
          </Card>
        </Flex>
      </Card>
    </Flex>
  );
}
