import { Card, Descriptions, Flex, Space, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import {
  ContextRetentionMode,
  ContextSufficiencyStateName,
  type ContextAdequacyEvidence,
  type ContextAnchor,
  type ContextRetentionEvidence,
  type ContextRetentionMode as ContextRetentionModeValue,
  type ContextSufficiencyState,
  type ContextSufficiencyStateName as ContextSufficiencyStateNameValue,
  type PromptAssemblyManifest,
  type RequiredContextObligation,
} from '@agent-safety-gateway/shared/context-retention';
import {
  ContextAdequacyEvidenceRecordKind,
  type ContextAdequacyEvidenceRecord,
} from './api';

const { Text } = Typography;

const retentionModeConfig: Record<ContextRetentionModeValue, { color: string; label: string; description: string }> = {
  [ContextRetentionMode.Verbatim]: {
    color: 'success',
    label: 'verbatim',
    description: '原文锚点保留在同一推理上下文中。',
  },
  [ContextRetentionMode.CertifiedSummary]: {
    color: 'success',
    label: 'certified_summary',
    description: '可验证摘要满足最低保留要求。',
  },
  [ContextRetentionMode.RetrievableReference]: {
    color: 'processing',
    label: 'retrievable_reference',
    description: '可检索引用满足最低保留要求。',
  },
  [ContextRetentionMode.Missing]: {
    color: 'error',
    label: 'missing',
    description: '必需锚点未出现在 prompt manifest 或 retention evidence 中。',
  },
  [ContextRetentionMode.Stale]: {
    color: 'warning',
    label: 'stale',
    description: '锚点超过 freshness window，需要重新 grounding。',
  },
  [ContextRetentionMode.Conflicting]: {
    color: 'error',
    label: 'conflicting',
    description: '存在冲突或遗漏反证信息，执行应被 deny。',
  },
  [ContextRetentionMode.Tainted]: {
    color: 'error',
    label: 'tainted',
    description: '锚点来自低信任或污染上下文，执行应被 deny。',
  },
};

const sufficiencyStateConfig: Record<ContextSufficiencyStateNameValue, { color: string; label: string; description: string }> = {
  [ContextSufficiencyStateName.Sufficient]: {
    color: 'success',
    label: 'sufficient',
    description: '上下文充分，可以进入禁止副作用证据检查和 permit decision。',
  },
  [ContextSufficiencyStateName.SufficientByCertifiedSummary]: {
    color: 'success',
    label: 'sufficient by certified summary',
    description: '必需锚点由可验证摘要满足，可以继续执行许可链路。',
  },
  [ContextSufficiencyStateName.RegroundRequired]: {
    color: 'warning',
    label: 'reground required',
    description: '缺失或过期锚点需要重新注入同一任务上下文并重新生成 tool call。',
  },
  [ContextSufficiencyStateName.ReapprovalRequired]: {
    color: 'warning',
    label: 'reapproval required',
    description: '审批上下文缺失或过期，需要重新审批并保留审批 note 后再继续。',
  },
  [ContextSufficiencyStateName.Stale]: {
    color: 'warning',
    label: 'stale',
    description: '必需上下文已过期，应 reground 后重新评估。',
  },
  [ContextSufficiencyStateName.Conflicting]: {
    color: 'error',
    label: 'conflicting deny',
    description: '上下文冲突或遗漏反证信息，必须在 executor safety evidence 前 deny。',
  },
  [ContextSufficiencyStateName.Contaminated]: {
    color: 'error',
    label: 'contaminated deny',
    description: '上下文被低信任指令污染，必须 fail closed。',
  },
  [ContextSufficiencyStateName.Insufficient]: {
    color: 'error',
    label: 'insufficient deny',
    description: '必要上下文不足，不能进入 permit 或 executor invocation。',
  },
};

const coveredRetentionModes: ReadonlySet<ContextRetentionModeValue> = new Set([
  ContextRetentionMode.Verbatim,
  ContextRetentionMode.CertifiedSummary,
  ContextRetentionMode.RetrievableReference,
]);

type ContextRetentionEvidenceEntry = {
  recordId: string;
  createdAt: string;
  evidence: ContextRetentionEvidence;
};

type ContextAnchorRetentionRow = {
  key: string;
  obligationId: string;
  anchorId: string;
  anchor: ContextAnchor | null;
  retentionEvidence: ContextRetentionEvidence | null;
  retentionMode: ContextRetentionModeValue;
  minimumRetentionMode: string;
  visibleInPrompt: boolean;
  coverageScore: number | null;
  freshnessScore: number | null;
  trustScore: number | null;
  conflictEvidence: readonly string[];
  matchedDigest: string | null;
  matchedContextUnitId: string | null;
  reason: string;
};

type ContextObligationRow = {
  key: string;
  obligation: RequiredContextObligation;
  coveredAnchorCount: number;
  requiredAnchorCount: number;
};

export type ContextEvidenceViewModel = {
  obligations: RequiredContextObligation[];
  promptAssemblyManifest: PromptAssemblyManifest | null;
  contextSufficiencyState: ContextSufficiencyState | null;
  contextAdequacyEvidence: ContextAdequacyEvidence | null;
  contextAdequacyEvidenceHash: string | null;
  anchorRows: ContextAnchorRetentionRow[];
  obligationRows: ContextObligationRow[];
  recordCount: number;
};

const toTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatTimestamp = (value: string | null | undefined) => {
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

const recordTimestamp = (record: ContextAdequacyEvidenceRecord) => {
  switch (record.kind) {
    case ContextAdequacyEvidenceRecordKind.ContextSufficiencyState:
      return record.contextSufficiencyState.evaluatedAt;
    case ContextAdequacyEvidenceRecordKind.ContextAdequacyEvidence:
      return record.contextAdequacyEvidence.createdAt;
    default:
      return record.createdAt;
  }
};

export const mergeContextEvidenceRecords = (
  ...recordGroups: ContextAdequacyEvidenceRecord[][]
) => {
  const recordsById = new Map<string, ContextAdequacyEvidenceRecord>();

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

const collectAnchorsById = (records: readonly ContextAdequacyEvidenceRecord[]) => {
  const anchorsById = new Map<string, ContextAnchor>();

  for (const record of records) {
    if (record.kind === ContextAdequacyEvidenceRecordKind.ContextAnchor) {
      anchorsById.set(record.contextAnchor.anchorId, record.contextAnchor);
    }
  }

  return anchorsById;
};

const collectObligations = (records: readonly ContextAdequacyEvidenceRecord[]) => {
  const obligationsById = new Map<string, RequiredContextObligation>();

  for (const record of records) {
    if (record.kind === ContextAdequacyEvidenceRecordKind.RequiredContextObligation) {
      obligationsById.set(record.requiredContextObligation.obligationId, record.requiredContextObligation);
    }
  }

  return [...obligationsById.values()];
};

const collectRetentionEvidenceEntries = (records: readonly ContextAdequacyEvidenceRecord[]) => {
  return records
    .filter((record) => record.kind === ContextAdequacyEvidenceRecordKind.ContextRetentionEvidence)
    .map((record) => ({
      recordId: record.id,
      createdAt: record.createdAt,
      evidence: record.contextRetentionEvidence,
    }));
};

const findContextSufficiencyState = (records: readonly ContextAdequacyEvidenceRecord[]) => {
  const states = records
    .filter((record) => record.kind === ContextAdequacyEvidenceRecordKind.ContextSufficiencyState)
    .map((record) => record.contextSufficiencyState);

  return latestByTime(states, (state) => state.evaluatedAt);
};

const findContextAdequacyEvidenceRecord = (records: readonly ContextAdequacyEvidenceRecord[]) => {
  return latestByTime(
    records.filter((record) => record.kind === ContextAdequacyEvidenceRecordKind.ContextAdequacyEvidence),
    (record) => record.contextAdequacyEvidence.createdAt,
  );
};

const findPromptAssemblyManifest = (
  records: readonly ContextAdequacyEvidenceRecord[],
  contextSufficiencyState: ContextSufficiencyState | null,
) => {
  const manifestRecords = records.filter(
    (record) => record.kind === ContextAdequacyEvidenceRecordKind.PromptAssemblyManifest,
  );

  if (contextSufficiencyState?.promptAssemblyManifestId) {
    const matchingManifestRecord = manifestRecords.find(
      (record) => record.promptAssemblyManifest.manifestId === contextSufficiencyState.promptAssemblyManifestId,
    );

    if (matchingManifestRecord) {
      return matchingManifestRecord.promptAssemblyManifest;
    }
  }

  return latestByTime(manifestRecords, (record) => record.createdAt)?.promptAssemblyManifest ?? null;
};

const isAnchorVisibleInManifest = (manifest: PromptAssemblyManifest | null, anchorId: string) => {
  if (!manifest) {
    return false;
  }

  return manifest.contextUnitOrder.includes(anchorId)
    || manifest.contextUnitDigests.some((contextUnitDigest) => contextUnitDigest.contextUnitId === anchorId)
    || manifest.tokenPositionRanges.some((range) => range.contextUnitId === anchorId);
};

const findLatestRetentionEvidence = (
  entries: readonly ContextRetentionEvidenceEntry[],
  obligationId: string,
  anchorId: string,
) => latestByTime(
  entries.filter((entry) => entry.evidence.obligationId === obligationId && entry.evidence.anchorId === anchorId),
  (entry) => entry.createdAt,
);

const createAnchorRow = ({
  obligationId,
  anchorId,
  anchor,
  retentionEvidence,
  manifest,
  minimumRetentionMode,
}: {
  obligationId: string;
  anchorId: string;
  anchor: ContextAnchor | null;
  retentionEvidence: ContextRetentionEvidence | null;
  manifest: PromptAssemblyManifest | null;
  minimumRetentionMode: string;
}): ContextAnchorRetentionRow => {
  const retentionMode = retentionEvidence?.retentionMode ?? ContextRetentionMode.Missing;
  const visibleInPrompt = isAnchorVisibleInManifest(manifest, anchorId);

  return {
    key: `${obligationId}:${anchorId}`,
    obligationId,
    anchorId,
    anchor,
    retentionEvidence,
    retentionMode,
    minimumRetentionMode,
    visibleInPrompt,
    coverageScore: retentionEvidence?.coverageScore ?? null,
    freshnessScore: retentionEvidence?.freshnessScore ?? null,
    trustScore: retentionEvidence?.trustScore ?? null,
    conflictEvidence: retentionEvidence?.conflictEvidence ?? [],
    matchedDigest: retentionEvidence?.matchedDigest ?? null,
    matchedContextUnitId: retentionEvidence?.matchedContextUnitId ?? null,
    reason: retentionEvidence
      ? retentionModeConfig[retentionMode].description
      : '未找到该 required anchor 的 ContextRetentionEvidence。',
  };
};

const createAnchorRows = ({
  obligations,
  anchorsById,
  retentionEvidenceEntries,
  manifest,
}: {
  obligations: readonly RequiredContextObligation[];
  anchorsById: ReadonlyMap<string, ContextAnchor>;
  retentionEvidenceEntries: readonly ContextRetentionEvidenceEntry[];
  manifest: PromptAssemblyManifest | null;
}) => {
  const anchorRows: ContextAnchorRetentionRow[] = [];
  const rowKeys = new Set<string>();

  for (const obligation of obligations) {
    for (const anchorId of obligation.requiredAnchors) {
      const retentionEvidenceEntry = findLatestRetentionEvidence(
        retentionEvidenceEntries,
        obligation.obligationId,
        anchorId,
      );
      const row = createAnchorRow({
        obligationId: obligation.obligationId,
        anchorId,
        anchor: anchorsById.get(anchorId) ?? null,
        retentionEvidence: retentionEvidenceEntry?.evidence ?? null,
        manifest,
        minimumRetentionMode: obligation.minimumRetentionMode,
      });

      anchorRows.push(row);
      rowKeys.add(row.key);
    }
  }

  for (const retentionEvidenceEntry of retentionEvidenceEntries) {
    const rowKey = `${retentionEvidenceEntry.evidence.obligationId}:${retentionEvidenceEntry.evidence.anchorId}`;

    if (!rowKeys.has(rowKey)) {
      anchorRows.push(createAnchorRow({
        obligationId: retentionEvidenceEntry.evidence.obligationId,
        anchorId: retentionEvidenceEntry.evidence.anchorId,
        anchor: anchorsById.get(retentionEvidenceEntry.evidence.anchorId) ?? null,
        retentionEvidence: retentionEvidenceEntry.evidence,
        manifest,
        minimumRetentionMode: retentionEvidenceEntry.evidence.minimumRetentionMode,
      }));
      rowKeys.add(rowKey);
    }
  }

  return anchorRows.sort((left, right) => left.obligationId.localeCompare(right.obligationId) || left.anchorId.localeCompare(right.anchorId));
};

const createObligationRows = (
  obligations: readonly RequiredContextObligation[],
  anchorRows: readonly ContextAnchorRetentionRow[],
) => obligations.map((obligation) => ({
  key: obligation.obligationId,
  obligation,
  coveredAnchorCount: anchorRows.filter(
    (row) => row.obligationId === obligation.obligationId && coveredRetentionModes.has(row.retentionMode),
  ).length,
  requiredAnchorCount: obligation.requiredAnchors.length,
}));

export const createContextEvidenceViewModel = (
  records: readonly ContextAdequacyEvidenceRecord[],
): ContextEvidenceViewModel => {
  const mergedRecords = mergeContextEvidenceRecords([...records]);
  const contextSufficiencyState = findContextSufficiencyState(mergedRecords);
  const contextAdequacyEvidenceRecord = findContextAdequacyEvidenceRecord(mergedRecords);
  const promptAssemblyManifest = findPromptAssemblyManifest(mergedRecords, contextSufficiencyState);
  const obligations = collectObligations(mergedRecords);
  const anchorsById = collectAnchorsById(mergedRecords);
  const retentionEvidenceEntries = collectRetentionEvidenceEntries(mergedRecords);
  const anchorRows = createAnchorRows({
    obligations,
    anchorsById,
    retentionEvidenceEntries,
    manifest: promptAssemblyManifest,
  });

  return {
    obligations,
    promptAssemblyManifest,
    contextSufficiencyState,
    contextAdequacyEvidence: contextAdequacyEvidenceRecord?.contextAdequacyEvidence ?? null,
    contextAdequacyEvidenceHash: contextAdequacyEvidenceRecord?.evidenceHash ?? null,
    anchorRows,
    obligationRows: createObligationRows(obligations, anchorRows),
    recordCount: mergedRecords.length,
  };
};

function ContextRetentionModeTag({ mode }: { mode: ContextRetentionModeValue }) {
  const config = retentionModeConfig[mode];

  return <Tag color={config.color}>{config.label}</Tag>;
}

function ContextSufficiencyStateTag({ state }: { state: ContextSufficiencyStateNameValue }) {
  const config = sufficiencyStateConfig[state];

  return <Tag color={config.color}>{config.label}</Tag>;
}

const renderOptionalCode = (value: string | null | undefined) => (
  value ? <Text code>{value}</Text> : <Text type="secondary">未记录</Text>
);

const renderScore = (score: number | null) => (
  score === null ? <Text type="secondary">未记录</Text> : <Tag color={score >= 1 ? 'success' : score > 0 ? 'warning' : 'error'}>{score.toFixed(2)}</Tag>
);

const renderBooleanTag = (value: boolean) => (
  <Tag color={value ? 'success' : 'error'}>{value ? 'visible' : 'not visible'}</Tag>
);

const renderSufficiencyStateLegend = () => (
  <Space orientation="vertical" size={4}>
    {Object.values(ContextSufficiencyStateName).map((state) => (
      <Space key={state} align="start" size={6}>
        <ContextSufficiencyStateTag state={state} />
        <Text type="secondary">{sufficiencyStateConfig[state].description}</Text>
      </Space>
    ))}
  </Space>
);

const renderAnchorIds = (anchorIds: readonly string[]) => (
  anchorIds.length > 0 ? (
    <Space wrap size={4}>
      {anchorIds.map((anchorId) => <Text code key={anchorId}>{anchorId}</Text>)}
    </Space>
  ) : <Text type="secondary">未记录</Text>
);

const renderPromptAssemblyManifest = (manifest: PromptAssemblyManifest | null) => {
  if (!manifest) {
    return <Text type="secondary">未找到 PromptAssemblyManifest 记录</Text>;
  }

  return (
    <Descriptions
      bordered
      column={{ xs: 1, md: 2, xl: 3 }}
      items={[
        {
          key: 'manifestId',
          label: 'manifestId',
          children: <Text code>{manifest.manifestId}</Text>,
        },
        {
          key: 'inferenceId',
          label: 'inferenceId',
          children: <Text code>{manifest.inferenceId}</Text>,
        },
        {
          key: 'modelId',
          label: 'modelId',
          children: <Text code>{manifest.modelId}</Text>,
        },
        {
          key: 'promptDigest',
          label: 'promptDigest',
          children: <Text code>{manifest.promptDigest}</Text>,
        },
        {
          key: 'contextUnits',
          label: 'context units',
          children: `${manifest.contextUnitOrder.length} ordered anchors / ${manifest.contextUnitDigests.length} digests`,
        },
        {
          key: 'retrievedDocuments',
          label: 'retrieved docs',
          children: `${manifest.retrievedDocumentDigests.length} documents`,
        },
      ]}
      size="small"
    />
  );
};

export function ContextEvidencePanel({
  records,
}: {
  records: ContextAdequacyEvidenceRecord[];
}) {
  const viewModel = createContextEvidenceViewModel(records);
  const state = viewModel.contextSufficiencyState?.state ?? null;

  const obligationColumns: TableProps<ContextObligationRow>['columns'] = [
    {
      title: 'RequiredContextObligation',
      key: 'obligation',
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text code>{row.obligation.obligationId}</Text>
          <Text type="secondary">{row.obligation.actionImpactClass}</Text>
        </Space>
      ),
      width: 280,
    },
    {
      title: 'Retention policy',
      key: 'policy',
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text>minimum：<Text code>{row.obligation.minimumRetentionMode}</Text></Text>
          <Text type="secondary">missing：{row.obligation.missingAnchorAction}</Text>
          <Text type="secondary">freshness：{row.obligation.freshnessWindow}</Text>
        </Space>
      ),
      width: 260,
    },
    {
      title: 'Anchor coverage',
      key: 'anchorCoverage',
      render: (_, row) => <Tag color={row.coveredAnchorCount === row.requiredAnchorCount ? 'success' : 'error'}>{row.coveredAnchorCount}/{row.requiredAnchorCount}</Tag>,
      width: 150,
    },
    {
      title: 'Required anchors',
      key: 'anchors',
      render: (_, row) => renderAnchorIds(row.obligation.requiredAnchors),
    },
  ];

  const anchorColumns: TableProps<ContextAnchorRetentionRow>['columns'] = [
    {
      title: 'Anchor / obligation',
      key: 'anchor',
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text code>{row.anchorId}</Text>
          <Text type="secondary">{row.obligationId}</Text>
        </Space>
      ),
      width: 280,
    },
    {
      title: 'Prompt visibility',
      dataIndex: 'visibleInPrompt',
      key: 'visibleInPrompt',
      render: (visibleInPrompt: boolean) => renderBooleanTag(visibleInPrompt),
      width: 160,
    },
    {
      title: 'Retention status',
      key: 'retentionStatus',
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <ContextRetentionModeTag mode={row.retentionMode} />
          <Text type="secondary">minimum：{row.minimumRetentionMode}</Text>
          <Text type="secondary">{row.reason}</Text>
        </Space>
      ),
      width: 250,
    },
    {
      title: 'Scores',
      key: 'scores',
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text>coverage：{renderScore(row.coverageScore)}</Text>
          <Text>freshness：{renderScore(row.freshnessScore)}</Text>
          <Text>trust：{renderScore(row.trustScore)}</Text>
        </Space>
      ),
      width: 170,
    },
    {
      title: 'Anchor metadata',
      key: 'metadata',
      render: (_, row) => row.anchor ? (
        <Space orientation="vertical" size={0}>
          <Text>{row.anchor.anchorType} · {row.anchor.trustTier}</Text>
          <Text type="secondary">scope：{row.anchor.resourceScope}</Text>
          <Text type="secondary">expires：{formatTimestamp(row.anchor.expiresAt)}</Text>
        </Space>
      ) : <Text type="secondary">未找到 ContextAnchor 记录</Text>,
      width: 280,
    },
    {
      title: 'Evidence links',
      key: 'evidenceLinks',
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text>matched unit：{renderOptionalCode(row.matchedContextUnitId)}</Text>
          <Text>matched digest：{renderOptionalCode(row.matchedDigest)}</Text>
          <Text type="secondary">conflicts：{row.conflictEvidence.length > 0 ? row.conflictEvidence.join(', ') : 'none'}</Text>
        </Space>
      ),
      width: 320,
    },
  ];

  return (
    <Flex className="context-evidence-panel" vertical gap="middle">
      <Card size="small" title="上下文证据摘要">
        <Descriptions
          bordered
          column={{ xs: 1, md: 2, xl: 3 }}
          items={[
            {
              key: 'state',
              label: 'ContextSufficiencyState',
              children: state ? (
                <Space orientation="vertical" size={0}>
                  <ContextSufficiencyStateTag state={state} />
                  <Text type="secondary">{viewModel.contextSufficiencyState?.transitionReason}</Text>
                  <Text type="secondary">{sufficiencyStateConfig[state].description}</Text>
                </Space>
              ) : <Text type="secondary">未记录</Text>,
            },
            {
              key: 'manifest',
              label: 'PromptAssemblyManifest',
              children: viewModel.promptAssemblyManifest ? <Text code>{viewModel.promptAssemblyManifest.manifestId}</Text> : <Text type="secondary">未记录</Text>,
            },
            {
              key: 'inference',
              label: 'inferenceId',
              children: renderOptionalCode(viewModel.promptAssemblyManifest?.inferenceId ?? viewModel.contextSufficiencyState?.inferenceId ?? null),
            },
            {
              key: 'adequacyHash',
              label: 'ContextAdequacyEvidence hash',
              children: renderOptionalCode(viewModel.contextAdequacyEvidenceHash),
            },
            {
              key: 'permitOutcome',
              label: 'permit outcome',
              children: viewModel.contextAdequacyEvidence ? (
                <Space orientation="vertical" size={0}>
                  <Tag color={viewModel.contextAdequacyEvidence.permitIssued ? 'success' : 'error'}>{viewModel.contextAdequacyEvidence.permitOutcome}</Tag>
                  <Text type="secondary">denial：{viewModel.contextAdequacyEvidence.denialReason ?? 'none'}</Text>
                </Space>
              ) : <Text type="secondary">未记录</Text>,
            },
            {
              key: 'records',
              label: '证据记录',
              children: `${viewModel.recordCount} 条 context evidence records，${viewModel.obligations.length} 条 obligations，${viewModel.anchorRows.length} 条 anchor status`,
            },
          ]}
          size="small"
        />
      </Card>
      <Card size="small" title="PromptAssemblyManifest 摘要">
        {renderPromptAssemblyManifest(viewModel.promptAssemblyManifest)}
      </Card>
      <Card size="small" title="RequiredContextObligation 摘要">
        <Table
          columns={obligationColumns}
          dataSource={viewModel.obligationRows}
          locale={{ emptyText: '未找到 RequiredContextObligation 记录' }}
          pagination={false}
          rowKey="key"
          scroll={{ x: 980 }}
          size="small"
        />
      </Card>
      <Card size="small" title="Context anchor retention status">
        <Table
          columns={anchorColumns}
          dataSource={viewModel.anchorRows}
          locale={{ emptyText: '未找到 context anchor retention evidence' }}
          pagination={false}
          rowKey="key"
          scroll={{ x: 1460 }}
          size="small"
        />
      </Card>
      <Card size="small" title="ContextSufficiencyState 状态图例">
        {renderSufficiencyStateLegend()}
      </Card>
    </Flex>
  );
}
