import { Alert, Button, Card, ConfigProvider, Descriptions, Flex, Form, Input, Layout, Menu, Select, Space, Table, Tag, Typography } from 'antd';
import type { FormProps, MenuProps, TableProps } from 'antd';
import type { AffectedResource, AuditRecord, DecisionType, Environment, ImpactPath, JsonObject, JsonValue, RiskFactor, RiskFactorSeverity, RiskLevel, ToolCallRequest, ToolType } from '@agent-safety-gateway/shared';
import { useEffect, useMemo, useState } from 'react';
import { analyzeToolCall, getAudit, listAudits, listScenarios, normalizeApiError, type AnalyzeToolCallResponse, type ApiErrorPayload, type AuditFilters, type ScenarioSummary } from './api';
import { safetyGatewayTheme } from './theme';
import { EmptyState, ErrorState, LoadingState, SectionHeader } from './ui/states';
import { DecisionStatusTag, RiskStatusTag } from './ui/status-tags';

const { Content, Header, Sider } = Layout;
const { Paragraph, Text, Title } = Typography;

type RouteKey = 'dashboard' | 'simulator' | 'audit';

type AppRoute = {
  key: RouteKey;
  label: string;
  path: string;
  title: string;
  description: string;
};

const dashboardRoute: AppRoute = {
  key: 'dashboard',
  label: '仪表盘',
  path: '/',
  title: '仪表盘',
  description: '汇总风险拦截、网关决策和最近审计证据。',
};

const appRoutes: AppRoute[] = [
  dashboardRoute,
  {
    key: 'simulator',
    label: '工具调用模拟器',
    path: '/simulator',
    title: '工具调用模拟器',
    description: '提交 SQL、CI/CD 与配置变更请求，在工具执行前查看网关决策。',
  },
  {
    key: 'audit',
    label: '审计回放',
    path: '/audits',
    title: '审计回放',
    description: '复盘 Agent 输出、网关响应、executor 日志和最终执行结论。',
  },
];

const defaultRoute = dashboardRoute;

const toolTypeLabels: Record<ToolType, string> = {
  sql: 'SQL',
  ci_cd: 'CI/CD',
  config: 'Config',
};

const environmentLabels: Record<Environment, string> = {
  development: '开发',
  test: '测试',
  staging: '预发',
  production: '生产',
};

const riskLevelLabels: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  prohibited: '禁止风险',
};

const decisionLabels: Record<DecisionType, string> = {
  allow: '允许',
  block: '阻断',
  require_approval: '审批',
  sandbox: '沙箱',
  rewrite: '改写',
  readonly: '只读',
};

const riskFactorSeverityConfig: Record<RiskFactorSeverity, { color: string; label: string }> = {
  informational: {
    color: 'blue',
    label: '提示',
  },
  warning: {
    color: 'warning',
    label: '警告',
  },
  critical: {
    color: 'error',
    label: '严重',
  },
};

const riskFactorCategoryLabels: Record<RiskFactor['category'], string> = {
  operation: '操作风险',
  environment: '环境风险',
  resource_criticality: '资源关键性',
  dependency_impact: '依赖影响',
  validation_state: '验证状态',
  reversibility: '可回滚性',
};

const riskFactorCategoryOrder: Record<RiskFactor['category'], number> = {
  operation: 10,
  environment: 20,
  resource_criticality: 30,
  dependency_impact: 40,
  validation_state: 50,
  reversibility: 60,
};

const riskFactorSeverityOrder: Record<RiskFactorSeverity, number> = {
  critical: 10,
  warning: 20,
  informational: 30,
};

type SimulatorFormValues = {
  toolType: ToolType;
  actor: string;
  taskPurpose: string;
  environment: Environment;
  sqlText?: string;
  cicdService?: string;
  cicdVersion?: string;
  cicdTestStatus?: string;
  configService?: string;
  configKey?: string;
  configValue?: string;
};

type AuditFilterFormValues = AuditFilters;

const toolParameterFieldNames: (keyof SimulatorFormValues)[] = [
  'sqlText',
  'cicdService',
  'cicdVersion',
  'cicdTestStatus',
  'configService',
  'configKey',
  'configValue',
];

const toolTypeOptions = (Object.keys(toolTypeLabels) as ToolType[]).map((toolType) => ({
  label: toolTypeLabels[toolType],
  value: toolType,
}));

const environmentOptions = (Object.keys(environmentLabels) as Environment[]).map((environment) => ({
  label: environmentLabels[environment],
  value: environment,
}));

const riskLevelOptions = (Object.keys(riskLevelLabels) as RiskLevel[]).map((riskLevel) => ({
  label: riskLevelLabels[riskLevel],
  value: riskLevel,
}));

const decisionOptions = (Object.keys(decisionLabels) as DecisionType[]).map((decision) => ({
  label: decisionLabels[decision],
  value: decision,
}));

const scenarioButtonLabels: Record<string, string> = {
  'sql-delete-orders-production': '高风险 SQL 删除',
  'sql-read-orders-production': '低风险 SQL 查询',
  'cicd-deploy-payment-service-production': '生产发布',
  'config-payment-timeout-production': '关键配置更新',
};

const isBlockingDecision = (audit: AuditRecord) => audit.decision.type === 'block';

const needsHumanOrSandboxControl = (audit: AuditRecord) => {
  return audit.decision.type === 'require_approval' || audit.decision.type === 'sandbox';
};

const isProhibitedRisk = (audit: AuditRecord) => audit.riskLevel === 'prohibited';

const isHighRiskAudit = (audit: AuditRecord) => {
  return audit.riskLevel === 'high' || audit.riskLevel === 'prohibited';
};

const toTimestamp = (value: string) => {
  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatTimestamp = (value: string) => {
  const timestamp = toTimestamp(value);

  if (timestamp === 0) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(timestamp);
};

const toStringValue = (value: JsonValue | undefined) => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
};

const formatJsonObject = (value: JsonObject) => JSON.stringify(value, null, 2);

const renderSeverityTag = (severity: RiskFactorSeverity) => {
  const severityConfig = riskFactorSeverityConfig[severity];

  return <Tag color={severityConfig.color}>{severityConfig.label}</Tag>;
};

const sortRiskFactorsForReplay = (riskFactors: RiskFactor[]) => {
  return [...riskFactors].sort((left, right) => {
    const categoryDiff = riskFactorCategoryOrder[left.category] - riskFactorCategoryOrder[right.category];

    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    const severityDiff = riskFactorSeverityOrder[left.severity] - riskFactorSeverityOrder[right.severity];

    if (severityDiff !== 0) {
      return severityDiff;
    }

    return right.score - left.score;
  });
};

const findImpactPath = (impactPaths: ImpactPath[], resource: AffectedResource) => {
  return impactPaths.find((impactPath) => {
    return impactPath.impactedResourceId === resource.id || impactPath.resourceIds.includes(resource.id);
  });
};

const toSimulatorFormValues = (request: ToolCallRequest): SimulatorFormValues => {
  const baseValues: SimulatorFormValues = {
    actor: request.actor,
    environment: request.environment,
    taskPurpose: request.taskPurpose,
    toolType: request.toolType,
  };

  switch (request.toolType) {
    case 'sql':
      return {
        ...baseValues,
        sqlText: toStringValue(request.rawPayload.sql),
      };
    case 'ci_cd':
      return {
        ...baseValues,
        cicdService: toStringValue(request.rawPayload.service),
        cicdTestStatus: toStringValue(request.rawPayload.testStatus),
        cicdVersion: toStringValue(request.rawPayload.version),
      };
    case 'config':
      return {
        ...baseValues,
        configKey: toStringValue(request.rawPayload.key),
        configService: toStringValue(request.rawPayload.service),
        configValue: toStringValue(request.rawPayload.value),
      };
  }
};

const createRequestId = () => {
  if (globalThis.crypto?.randomUUID) {
    return `sim-${globalThis.crypto.randomUUID()}`;
  }

  return `sim-${Date.now().toString(36)}`;
};

const toToolCallRequest = (
  values: SimulatorFormValues,
  sourceRequest?: ToolCallRequest,
): ToolCallRequest => {
  const baseRequest = {
    actor: values.actor,
    createdAt: new Date().toISOString(),
    environment: values.environment,
    id: createRequestId(),
    taskPurpose: values.taskPurpose,
    toolType: values.toolType,
  } satisfies Omit<ToolCallRequest, 'rawPayload'>;

  switch (values.toolType) {
    case 'sql':
      return {
        ...baseRequest,
        rawPayload: {
          ...(sourceRequest?.toolType === 'sql' ? sourceRequest.rawPayload : {}),
          sql: values.sqlText ?? '',
        },
      };
    case 'ci_cd':
      return {
        ...baseRequest,
        rawPayload: {
          ...(sourceRequest?.toolType === 'ci_cd' ? sourceRequest.rawPayload : {}),
          service: values.cicdService ?? '',
          stage: sourceRequest?.toolType === 'ci_cd' ? sourceRequest.rawPayload.stage ?? 'deploy' : 'deploy',
          testStatus: values.cicdTestStatus ?? '',
          version: values.cicdVersion ?? '',
        },
      };
    case 'config':
      return {
        ...baseRequest,
        rawPayload: {
          ...(sourceRequest?.toolType === 'config' ? sourceRequest.rawPayload : {}),
          key: values.configKey ?? '',
          operation: sourceRequest?.toolType === 'config' ? sourceRequest.rawPayload.operation ?? 'update' : 'update',
          service: values.configService ?? '',
          value: values.configValue ?? '',
        },
      };
  }
};

const getAnalysisAlertType = (result: AnalyzeToolCallResponse) => {
  if (result.executionDecision.type === 'block' || result.riskLevel === 'prohibited') {
    return 'error' as const;
  }

  if (result.executionDecision.type === 'sandbox' || result.executionDecision.type === 'require_approval') {
    return 'warning' as const;
  }

  return 'success' as const;
};

const getAnalysisAlertTitle = (result: AnalyzeToolCallResponse) => {
  if (result.executionDecision.type === 'block') {
    return '已阻断：executor 不会被调用';
  }

  if (result.riskLevel === 'prohibited') {
    return '禁止风险：executor 不会被调用';
  }

  if (result.executionDecision.type === 'sandbox') {
    return '建议沙箱执行：不要直接写入生产资源';
  }

  if (result.executionDecision.type === 'require_approval') {
    return '需要审批：审批通过前不要执行工具';
  }

  return '网关已返回允许执行结果';
};

const actionTupleDescriptionItems = (result: Pick<AnalyzeToolCallResponse, 'actionTuple'>) => [
  {
    key: 'toolType',
    label: '工具类型',
    children: toolTypeLabels[result.actionTuple.toolType],
  },
  {
    key: 'operation',
    label: '操作',
    children: <Text code>{result.actionTuple.operation}</Text>,
  },
  {
    key: 'target',
    label: '目标',
    children: <Text code>{result.actionTuple.target}</Text>,
  },
  {
    key: 'environment',
    label: '环境',
    children: environmentLabels[result.actionTuple.environment],
  },
  {
    key: 'actor',
    label: 'Actor',
    children: <Text code>{result.actionTuple.actor}</Text>,
  },
  {
    key: 'timestamp',
    label: '分析时间',
    children: formatTimestamp(result.actionTuple.timestamp),
  },
  {
    key: 'taskPurpose',
    label: '任务目的',
    children: result.actionTuple.taskPurpose,
    span: 3,
  },
  {
    key: 'parameters',
    label: '规范化参数',
    children: <pre className="simulator-json-preview">{formatJsonObject(result.actionTuple.parameters)}</pre>,
    span: 3,
  },
];

type TableColumns<T> = NonNullable<TableProps<T>['columns']>;

const createResourceColumns = <T extends AffectedResource>(): TableColumns<T> => [
  {
    title: '资源',
    key: 'resource',
    render: (_, resource) => (
      <Space orientation="vertical" size={0}>
        <Text strong>{resource.name}</Text>
        <Text code>{resource.id}</Text>
      </Space>
    ),
    width: 220,
  },
  {
    title: '类型/系统',
    key: 'type',
    render: (_, resource) => (
      <Space orientation="vertical" size={0}>
        <Text>{resource.type}</Text>
        <Text type="secondary">{resource.system}</Text>
      </Space>
    ),
    width: 160,
  },
  {
    title: '环境',
    dataIndex: 'environment',
    key: 'environment',
    render: (environment: Environment) => environmentLabels[environment],
    width: 100,
  },
  {
    title: '敏感度/关键性',
    key: 'criticality',
    render: (_, resource) => (
      <Space orientation="vertical" size={0}>
        <Text>{resource.sensitivityLevel}</Text>
        <Text type="secondary">{resource.criticalityLevel}</Text>
      </Space>
    ),
    width: 150,
  },
  {
    title: 'Owner',
    dataIndex: 'owner',
    key: 'owner',
    width: 140,
  },
  {
    title: '回滚能力',
    dataIndex: 'rollbackCapability',
    key: 'rollbackCapability',
    width: 120,
  },
];

const resourceColumns = createResourceColumns<AffectedResource>();

const riskFactorColumns: TableColumns<RiskFactor> = [
  {
    title: '风险因子',
    key: 'factor',
    render: (_, riskFactor) => (
      <Space orientation="vertical" size={0}>
        <Text strong>{riskFactor.label}</Text>
        <Text type="secondary">{riskFactorCategoryLabels[riskFactor.category]}</Text>
      </Space>
    ),
    width: 240,
  },
  {
    title: '严重度',
    dataIndex: 'severity',
    key: 'severity',
    render: (severity: RiskFactorSeverity) => renderSeverityTag(severity),
    width: 110,
  },
  {
    title: '分值',
    dataIndex: 'score',
    key: 'score',
    width: 90,
  },
  {
    title: '证据说明',
    dataIndex: 'reason',
    key: 'reason',
    render: (reason: string) => <Text type="secondary">{reason}</Text>,
  },
];

type IndirectResourceRow = AffectedResource & {
  impactPath: ImpactPath | undefined;
};

const indirectResourceColumns: TableColumns<IndirectResourceRow> = [
  ...createResourceColumns<IndirectResourceRow>(),
  {
    title: '影响路径',
    key: 'impactPath',
    render: (_, resource) => resource.impactPath ? (
      <Space orientation="vertical" size={0}>
        <Text>深度 {resource.impactPath.depth}</Text>
        <Text type="secondary">{resource.impactPath.resourceIds.join(' → ')}</Text>
      </Space>
    ) : <Text type="secondary">未记录路径</Text>,
    width: 260,
  },
];

function AnalysisResultDetails({ result }: { result: AnalyzeToolCallResponse }) {
  const indirectResourceRows = result.indirectResources.map((resource) => ({
    ...resource,
    impactPath: findImpactPath(result.impactPaths, resource),
  }));

  return (
    <Flex vertical gap="middle">
      <Card size="small" title="动作元组">
        <Descriptions bordered column={{ xs: 1, md: 2, xl: 3 }} items={actionTupleDescriptionItems(result)} size="small" />
      </Card>
      <Card size="small" title="直接受影响资源">
        <Table
          columns={resourceColumns}
          dataSource={result.directResources}
          locale={{ emptyText: '未解析到直接受影响资源' }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 900 }}
          size="small"
        />
      </Card>
      <Card size="small" title="间接受影响资源">
        <Table
          columns={indirectResourceColumns}
          dataSource={indirectResourceRows}
          locale={{ emptyText: '未发现间接受影响资源' }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1120 }}
          size="small"
        />
      </Card>
      <Card size="small" title="风险因子">
        <Table
          columns={riskFactorColumns}
          dataSource={result.riskFactors}
          locale={{ emptyText: '未生成风险因子' }}
          pagination={false}
          rowKey={(riskFactor) => `${riskFactor.category}-${riskFactor.label}`}
          scroll={{ x: 760 }}
          size="small"
        />
      </Card>
      <Card size="small" title="执行决策与建议">
        <Space orientation="vertical" size="middle">
          <Space wrap>
            <Text strong>风险等级</Text>
            <RiskStatusTag status={result.riskLevel} />
            <Text strong>执行决策</Text>
            <DecisionStatusTag status={result.executionDecision.type as DecisionType} />
            <Text type="secondary">Audit ID：<Text code>{result.auditId}</Text></Text>
          </Space>
          <Descriptions
            bordered
            column={1}
            items={[
              {
                key: 'reason',
                label: '决策原因',
                children: result.executionDecision.reason,
              },
              {
                key: 'recommendedAction',
                label: '建议动作',
                children: result.executionDecision.recommendedAction,
              },
              {
                key: 'riskScore',
                label: '评分解释',
                children: `${result.riskScore.score} 分：${result.riskScore.explanation}`,
              },
              {
                key: 'reasons',
                label: '原因列表',
                children: result.reasons.length > 0 ? result.reasons.join('；') : '未返回额外原因',
              },
              {
                key: 'rewrite',
                label: '改写建议',
                children: result.executionDecision.rewrittenRequest ? (
                  <pre className="simulator-json-preview">{formatJsonObject(result.executionDecision.rewrittenRequest.rawPayload)}</pre>
                ) : '无需改写或未提供安全改写请求',
              },
            ]}
            size="small"
          />
        </Space>
      </Card>
    </Flex>
  );
}

type AuditDetailPageProps = {
  auditId: string;
  navigateToAuditList: () => void;
};

const auditActionTupleDescriptionItems = (audit: AuditRecord) => actionTupleDescriptionItems({
  actionTuple: audit.actionTuple,
}).map(({ span: _span, ...item }) => item);

const auditRequestDescriptionItems = (audit: AuditRecord) => [
  {
    key: 'requestId',
    label: 'Request ID',
    children: <Text code>{audit.request.id}</Text>,
  },
  {
    key: 'toolType',
    label: '工具类型',
    children: toolTypeLabels[audit.request.toolType],
  },
  {
    key: 'environment',
    label: '目标环境',
    children: environmentLabels[audit.request.environment],
  },
  {
    key: 'actor',
    label: 'Actor',
    children: <Text code>{audit.request.actor}</Text>,
  },
  {
    key: 'createdAt',
    label: '请求时间',
    children: formatTimestamp(audit.request.createdAt),
  },
  {
    key: 'taskPurpose',
    label: '任务目的',
    children: audit.request.taskPurpose,
  },
  {
    key: 'rawPayload',
    label: '原始参数',
    children: <pre className="simulator-json-preview">{formatJsonObject(audit.request.rawPayload)}</pre>,
  },
];

function AuditDetailPage({ auditId, navigateToAuditList }: AuditDetailPageProps) {
  const [audit, setAudit] = useState<AuditRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiErrorPayload | null>(null);

  useEffect(() => {
    let isCurrent = true;

    const loadAudit = async () => {
      if (!auditId) {
        setAudit(null);
        setError({
          code: 'MISSING_AUDIT_ID',
          details: null,
          message: '缺少 audit id，无法加载审计详情。',
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const nextAudit = await getAudit(auditId);

        if (isCurrent) {
          setAudit(nextAudit);
        }
      } catch (loadError: unknown) {
        if (isCurrent) {
          setError(normalizeApiError(loadError, '无法加载审计详情'));
          setAudit(null);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    void loadAudit();

    return () => {
      isCurrent = false;
    };
  }, [auditId]);

  const indirectResourceRows = useMemo(
    () => audit?.indirectResources.map((resource) => ({
      ...resource,
      impactPath: findImpactPath(audit.impactPaths, resource),
    })) ?? [],
    [audit],
  );
  const sortedRiskFactors = useMemo(
    () => audit ? sortRiskFactorsForReplay(audit.riskFactors) : [],
    [audit],
  );

  return (
    <Flex vertical gap="large">
      <Card>
        <Space orientation="vertical" size="middle">
          <Title level={2}>审计详情回放</Title>
          <Paragraph type="secondary">
            读取单条 audit id 的原始请求、动作元组、资源影响、风险因子和最终执行决策；此页面只读，不会重新触发 executor。
          </Paragraph>
          <Space wrap>
            <Text type="secondary">Audit ID：{auditId ? <Text code>{auditId}</Text> : '未提供'}</Text>
            <Button onClick={navigateToAuditList}>返回审计列表</Button>
          </Space>
        </Space>
      </Card>
      {isLoading ? (
        <LoadingState title="正在加载审计详情" description="等待审计 API 返回完整回放证据，期间不会默认放行任何执行。" />
      ) : null}
      {error ? (
        <ErrorState
          title="无法加载审计详情"
          description={`${error.message} 请从审计列表选择一条有效记录；缺少审计证据时不要复用旧决策执行工具。`}
        />
      ) : null}
      {!isLoading && !error && audit ? (
        <Flex vertical gap="large">
          <Card>
            <Space orientation="vertical" size="middle">
              <SectionHeader
                title="执行决策摘要"
                description="决策原因保持首屏可见，用于判断 executor 是否必须阻断、审批、沙箱或允许。"
                extra={<Text type="secondary">记录时间：{formatTimestamp(audit.createdAt)}</Text>}
              />
              <Alert
                showIcon
                type={audit.decision.type === 'block' || audit.riskLevel === 'prohibited' ? 'error' : audit.decision.type === 'sandbox' || audit.decision.type === 'require_approval' ? 'warning' : 'success'}
                title={audit.decision.reason}
                description={audit.decision.recommendedAction}
              />
              <Descriptions
                bordered
                column={{ xs: 1, md: 2, xl: 3 }}
                items={[
                  {
                    key: 'riskLevel',
                    label: '风险等级',
                    children: <RiskStatusTag status={audit.riskLevel} />,
                  },
                  {
                    key: 'decision',
                    label: '执行决策',
                    children: <DecisionStatusTag status={audit.decision.type as DecisionType} />,
                  },
                  {
                    key: 'decisionCode',
                    label: '决策代码',
                    children: <Text code>{audit.decision.code}</Text>,
                  },
                  {
                    key: 'decisionReason',
                    label: 'Decision reason',
                    children: audit.decision.reason,
                  },
                ]}
                size="small"
              />
            </Space>
          </Card>
          <Card size="small" title="原始请求">
            <Descriptions bordered column={{ xs: 1, md: 2, xl: 3 }} items={auditRequestDescriptionItems(audit)} size="small" />
          </Card>
          <Card size="small" title="动作元组">
            <Descriptions bordered column={{ xs: 1, md: 2, xl: 3 }} items={auditActionTupleDescriptionItems(audit)} size="small" />
          </Card>
          <Card size="small" title="直接受影响资源">
            <Table
              columns={resourceColumns}
              dataSource={audit.directResources}
              locale={{ emptyText: '未记录直接受影响资源' }}
              pagination={false}
              rowKey="id"
              scroll={{ x: 900 }}
              size="small"
            />
          </Card>
          <Card size="small" title="间接受影响资源">
            <Table
              columns={indirectResourceColumns}
              dataSource={indirectResourceRows}
              locale={{ emptyText: '未记录间接受影响资源' }}
              pagination={false}
              rowKey="id"
              scroll={{ x: 1120 }}
              size="small"
            />
          </Card>
          <Card size="small" title="风险因子（按类别与严重度排序）">
            <Table
              columns={riskFactorColumns}
              dataSource={sortedRiskFactors}
              locale={{ emptyText: '未记录风险因子' }}
              pagination={false}
              rowKey={(riskFactor) => `${riskFactor.category}-${riskFactor.label}`}
              scroll={{ x: 760 }}
              size="small"
            />
          </Card>
          {audit.decision.rewrittenRequest ? (
            <Card size="small" title="安全改写请求">
              <pre className="simulator-json-preview">{formatJsonObject(audit.decision.rewrittenRequest.rawPayload)}</pre>
            </Card>
          ) : null}
        </Flex>
      ) : null}
    </Flex>
  );
}

const createDashboardMetrics = (audits: AuditRecord[]) => [
  {
    key: 'total',
    label: '分析总数',
    value: audits.length,
    description: '已进入网关分析的工具调用',
  },
  {
    key: 'blocked',
    label: '阻断数量',
    value: audits.filter(isBlockingDecision).length,
    description: 'executor 不应被调用',
  },
  {
    key: 'controlled',
    label: '审批或沙箱数量',
    value: audits.filter(needsHumanOrSandboxControl).length,
    description: '需要人工或隔离执行',
  },
  {
    key: 'prohibited',
    label: '禁止风险数量',
    value: audits.filter(isProhibitedRisk).length,
    description: '命中最高风险等级',
  },
];

const normalizeAuditFilters = (values: AuditFilterFormValues): AuditFilters => {
  const filters: AuditFilters = {};

  if (values.decision) {
    filters.decision = values.decision;
  }

  if (values.riskLevel) {
    filters.riskLevel = values.riskLevel;
  }

  if (values.toolType) {
    filters.toolType = values.toolType;
  }

  if (values.environment) {
    filters.environment = values.environment;
  }

  return filters;
};

const countActiveAuditFilters = (filters: AuditFilters) => {
  return Object.values(filters).filter((value) => value !== undefined).length;
};

function resolveRoute(pathname: string): AppRoute {
  if (pathname === '/' || pathname === '') {
    return defaultRoute;
  }

  if (pathname.startsWith('/audits/')) {
    return appRoutes.find((route) => route.key === 'audit') ?? defaultRoute;
  }

  return appRoutes.find((route) => route.path === pathname) ?? defaultRoute;
}

type DashboardPageProps = {
  navigateToAudit: (auditId: string) => void;
};

function DashboardPage({ navigateToAudit }: DashboardPageProps) {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiErrorPayload | null>(null);

  useEffect(() => {
    let isCurrent = true;

    const loadAudits = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextAudits = await listAudits();

        if (isCurrent) {
          setAudits(nextAudits);
        }
      } catch (loadError: unknown) {
        if (isCurrent) {
          setError(normalizeApiError(loadError, '无法加载审计数据'));
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    void loadAudits();

    return () => {
      isCurrent = false;
    };
  }, []);

  const metrics = useMemo(() => createDashboardMetrics(audits), [audits]);
  const latestHighRiskAudits = useMemo(
    () => audits.filter(isHighRiskAudit).sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt)).slice(0, 8),
    [audits],
  );

  const columns: TableProps<AuditRecord>['columns'] = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => formatTimestamp(createdAt),
      width: 160,
    },
    {
      title: '工具与环境',
      key: 'tool',
      render: (_, audit) => (
        <Space orientation="vertical" size={0}>
          <Text>{toolTypeLabels[audit.request.toolType]}</Text>
          <Text type="secondary">{environmentLabels[audit.request.environment]}</Text>
        </Space>
      ),
      width: 140,
    },
    {
      title: '动作目标',
      key: 'target',
      render: (_, audit) => (
        <Space orientation="vertical" size={0}>
          <Text code>{audit.actionTuple.target}</Text>
          <Text type="secondary">{audit.actionTuple.operation}</Text>
        </Space>
      ),
    },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (riskLevel: RiskLevel) => <RiskStatusTag status={riskLevel} />,
      width: 120,
    },
    {
      title: '决策',
      key: 'decision',
      render: (_, audit) => <DecisionStatusTag status={audit.decision.type as DecisionType} />,
      width: 120,
    },
    {
      title: '原因摘要',
      key: 'reason',
      render: (_, audit) => <Text type="secondary">{audit.decision.reason}</Text>,
    },
  ];

  return (
    <Flex vertical gap="large">
      <Card>
        <Space orientation="vertical" size="middle">
          <Title level={2}>Agent 动手前，先判断会不会出事</Title>
          <Paragraph type="secondary">
            仪表盘从审计 API 汇总网关分析、阻断、审批/沙箱和禁止风险数据，帮助研发负责人快速判断安全网关是否正在拦截高风险操作。
          </Paragraph>
          <Alert
            showIcon
            type="info"
            title="执行默认受网关保护"
            description="当审计数据不可用或尚未产生时，页面会显示安全空状态，不会暗示工具可直接执行。"
          />
        </Space>
      </Card>
      {isLoading ? (
        <LoadingState title="正在加载审计汇总" description="保持执行判断谨慎，等待审计 API 返回最新网关证据。" />
      ) : null}
      {error ? (
        <ErrorState
          title="无法加载仪表盘审计数据"
          description={`${error.message}。请确认 API 服务可访问后再复盘风险拦截情况。`}
        />
      ) : null}
      {!isLoading && !error ? (
        <Flex gap="middle" wrap>
          {metrics.map((metric) => (
            <Card className="dashboard-metric-card" key={metric.key}>
              <Space orientation="vertical" size={4}>
                <Text type="secondary">{metric.label}</Text>
                <Text className="dashboard-metric-value">{metric.value}</Text>
                <Text type="secondary">{metric.description}</Text>
              </Space>
            </Card>
          ))}
        </Flex>
      ) : null}
      <Card>
        <Flex vertical gap="middle">
          <SectionHeader
            title="最新高风险审计记录"
            description="展示最近的高风险或禁止风险分析记录，点击行可跳转到审计详情回放。"
            extra={<Button onClick={() => window.location.assign('/audits')}>查看全部审计</Button>}
          />
          {!isLoading && !error && audits.length === 0 ? (
            <EmptyState
              title="暂无审计数据"
              description="运行工具调用模拟器或种子场景后，仪表盘会展示拦截、审批、沙箱和禁止风险证据。"
            />
          ) : null}
          {!isLoading && !error && audits.length > 0 ? (
            <Table
              columns={columns}
              dataSource={latestHighRiskAudits}
              locale={{ emptyText: '暂无高风险审计记录' }}
              onRow={(audit) => ({
                className: 'dashboard-audit-row',
                onClick: () => navigateToAudit(audit.id),
              })}
              pagination={false}
              rowKey="id"
              scroll={{ x: 860 }}
            />
          ) : null}
        </Flex>
      </Card>
    </Flex>
  );
}

function SimulatorPage() {
  const [form] = Form.useForm<SimulatorFormValues>();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(true);
  const [scenarioError, setScenarioError] = useState<ApiErrorPayload | null>(null);
  const [activeScenario, setActiveScenario] = useState<ScenarioSummary | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<ToolCallRequest | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeToolCallResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<ApiErrorPayload | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const selectedToolType = Form.useWatch('toolType', form);

  useEffect(() => {
    let isCurrent = true;

    const loadScenarios = async () => {
      setIsLoadingScenarios(true);
      setScenarioError(null);

      try {
        const nextScenarios = await listScenarios();

        if (isCurrent) {
          setScenarios(nextScenarios);
        }
      } catch (loadError: unknown) {
        if (isCurrent) {
          setScenarioError(normalizeApiError(loadError, '无法加载种子场景'));
        }
      } finally {
        if (isCurrent) {
          setIsLoadingScenarios(false);
        }
      }
    };

    void loadScenarios();

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleValuesChange: FormProps<SimulatorFormValues>['onValuesChange'] = (changedValues) => {
    setActiveScenario(null);
    setSubmittedRequest(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setValidationError(null);

    if (Object.hasOwn(changedValues, 'toolType')) {
      form.resetFields(toolParameterFieldNames);
    }
  };

  const handleApplyScenario = (scenario: ScenarioSummary) => {
    form.resetFields();
    form.setFieldsValue(toSimulatorFormValues(scenario.toolCallRequest));
    setActiveScenario(scenario);
    setSubmittedRequest(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setValidationError(null);
  };

  const handleSubmit: FormProps<SimulatorFormValues>['onFinish'] = async (values) => {
    const request = toToolCallRequest(values, activeScenario?.toolCallRequest);

    setSubmittedRequest(request);
    setAnalysisResult(null);
    setAnalysisError(null);
    setValidationError(null);
    setIsAnalyzing(true);

    try {
      const result = await analyzeToolCall(request);

      setAnalysisResult(result);
    } catch (submitError: unknown) {
      setAnalysisError(normalizeApiError(submitError, '工具调用分析失败'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitFailed: FormProps<SimulatorFormValues>['onFinishFailed'] = ({ errorFields }) => {
    setSubmittedRequest(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setValidationError(`请先修正 ${errorFields.length} 个必填或格式校验问题，再提交安全网关分析。`);
  };

  const renderToolParameterFields = () => {
    switch (selectedToolType) {
      case 'sql':
        return (
          <Form.Item
            label="SQL 文本"
            name="sqlText"
            rules={[{ required: true, message: '请填写SQL文本' }, { whitespace: true, message: '请填写SQL文本' }]}
          >
            <Input.TextArea
              autoSize={{ minRows: 5, maxRows: 10 }}
              placeholder="例如：DELETE FROM orders WHERE status='PENDING'"
            />
          </Form.Item>
        );
      case 'ci_cd':
        return (
          <Flex gap="middle" wrap>
            <Form.Item
              label="Service"
              name="cicdService"
              rules={[{ required: true, message: '请填写Service' }, { whitespace: true, message: '请填写Service' }]}
              style={{ flex: '1 1 220px' }}
            >
              <Input placeholder="例如：payment-service" />
            </Form.Item>
            <Form.Item
              label="Version"
              name="cicdVersion"
              rules={[{ required: true, message: '请填写Version' }, { whitespace: true, message: '请填写Version' }]}
              style={{ flex: '1 1 220px' }}
            >
              <Input placeholder="例如：1.8.0" />
            </Form.Item>
            <Form.Item
              label="TestStatus"
              name="cicdTestStatus"
              rules={[{ required: true, message: '请填写TestStatus' }, { whitespace: true, message: '请填写TestStatus' }]}
              style={{ flex: '1 1 220px' }}
            >
              <Input placeholder="例如：failed 或 passed" />
            </Form.Item>
          </Flex>
        );
      case 'config':
        return (
          <Flex gap="middle" wrap>
            <Form.Item
              label="Service"
              name="configService"
              rules={[{ required: true, message: '请填写Service' }, { whitespace: true, message: '请填写Service' }]}
              style={{ flex: '1 1 220px' }}
            >
              <Input placeholder="例如：payment-service" />
            </Form.Item>
            <Form.Item
              label="Key"
              name="configKey"
              rules={[{ required: true, message: '请填写Key' }, { whitespace: true, message: '请填写Key' }]}
              style={{ flex: '1 1 220px' }}
            >
              <Input placeholder="例如：payment.timeout" />
            </Form.Item>
            <Form.Item
              label="Value"
              name="configValue"
              rules={[{ required: true, message: '请填写Value' }, { whitespace: true, message: '请填写Value' }]}
              style={{ flex: '1 1 220px' }}
            >
              <Input placeholder="例如：100ms" />
            </Form.Item>
          </Flex>
        );
      default:
        return (
          <Alert
            showIcon
            type="info"
            title="等待选择工具类型"
            description="选择 SQL、CI/CD 或 Config 后，只会显示对应工具参数；通用字段会在切换类型时保留。"
          />
        );
    }
  };

  const renderSubmittedParameters = (values: SimulatorFormValues) => {
    switch (values.toolType) {
      case 'sql':
        return <Text code>{values.sqlText}</Text>;
      case 'ci_cd':
        return (
          <Flex gap="middle" wrap>
            <Text>Service：<Text code>{values.cicdService}</Text></Text>
            <Text>Version：<Text code>{values.cicdVersion}</Text></Text>
            <Text>TestStatus：<Text code>{values.cicdTestStatus}</Text></Text>
          </Flex>
        );
      case 'config':
        return (
          <Flex gap="middle" wrap>
            <Text>Service：<Text code>{values.configService}</Text></Text>
            <Text>Key：<Text code>{values.configKey}</Text></Text>
            <Text>Value：<Text code>{values.configValue}</Text></Text>
          </Flex>
        );
    }
  };

  return (
    <Flex vertical gap="large">
      <Card>
        <Space orientation="vertical" size="middle">
          <Title level={2}>提交工具调用草稿</Title>
          <Paragraph type="secondary">
            先收集工具类型、执行人、任务目的和目标环境。可从种子场景一键填充典型风险链路，后续再提交网关分析。
          </Paragraph>
          <Alert
            showIcon
            type="warning"
            title="尚未触发 executor"
            description="此表单只生成待分析请求草稿；在网关返回允许、沙箱、审批、改写或阻断决策前，不会启用真实工具执行。"
          />
        </Space>
      </Card>
      <Card>
        <Flex vertical gap="middle">
          <SectionHeader
            title="种子场景启动器"
            description="从 GET /api/scenarios 读取四个演示场景，一键填充模拟器表单用于后续安全网关分析。"
          />
          {isLoadingScenarios ? (
            <LoadingState title="正在加载种子场景" description="等待 API 返回 SQL、发布和配置变更示例。" />
          ) : null}
          {scenarioError ? (
            <ErrorState
              title="无法加载种子场景"
              description={`${scenarioError.message}。请确认 API 服务已启动并执行过 pnpm seed。`}
            />
          ) : null}
          {!isLoadingScenarios && !scenarioError && scenarios.length === 0 ? (
            <EmptyState title="暂无种子场景" description="运行 pnpm seed 后会写入四个默认演示场景。" />
          ) : null}
          {!isLoadingScenarios && !scenarioError && scenarios.length > 0 ? (
            <Flex gap="middle" wrap>
              {scenarios.map((scenario) => (
                <Card className="simulator-scenario-card" key={scenario.id} size="small">
                  <Space orientation="vertical" size="small">
                    <Space wrap>
                      <RiskStatusTag status={scenario.expectedRiskLevel} />
                      <DecisionStatusTag status={scenario.expectedDecision} />
                    </Space>
                    <Text strong>{scenarioButtonLabels[scenario.id] ?? scenario.name}</Text>
                    <Text type="secondary">{scenario.description}</Text>
                    <Button onClick={() => handleApplyScenario(scenario)} type={activeScenario?.id === scenario.id ? 'primary' : 'default'}>
                      填充{scenarioButtonLabels[scenario.id] ?? scenario.name}
                    </Button>
                  </Space>
                </Card>
              ))}
            </Flex>
          ) : null}
          {activeScenario ? (
            <Alert
              showIcon
              type="success"
              title={`已填充：${scenarioButtonLabels[activeScenario.id] ?? activeScenario.name}`}
              description="请复核字段后提交待分析请求；填充动作不会触发 executor。"
            />
          ) : null}
        </Flex>
      </Card>
      <Card title="基础工具调用信息">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onFinishFailed={handleSubmitFailed}
          onValuesChange={handleValuesChange}
          requiredMark="optional"
          validateMessages={{ required: '请填写${label}' }}
        >
          {validationError ? (
            <Alert
              showIcon
              type="error"
              title="表单校验未通过"
              description={`${validationError} 校验失败时不会调用分析 API，也不会触发 executor。`}
            />
          ) : null}
          <Flex gap="middle" wrap>
            <Form.Item
              label="工具类型"
              name="toolType"
              rules={[{ required: true, message: '请选择工具类型' }]}
              style={{ flex: '1 1 240px' }}
            >
              <Select options={toolTypeOptions} placeholder="选择 SQL、CI/CD 或 Config" />
            </Form.Item>
            <Form.Item
              label="目标环境"
              name="environment"
              rules={[{ required: true, message: '请选择目标环境' }]}
              style={{ flex: '1 1 240px' }}
            >
              <Select options={environmentOptions} placeholder="选择开发、测试、预发或生产" />
            </Form.Item>
          </Flex>
          <Form.Item
            label="Actor"
            name="actor"
            rules={[{ required: true }, { whitespace: true, message: '请填写Actor' }]}
          >
            <Input placeholder="例如：agent.release-bot" />
          </Form.Item>
          <Form.Item
            label="Task purpose"
            name="taskPurpose"
            rules={[{ required: true }, { whitespace: true, message: '请填写Task purpose' }]}
          >
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 6 }}
              placeholder="描述 Agent 为什么要调用该工具，以及它希望达成的业务目标。"
            />
          </Form.Item>
          <Card size="small" title="工具参数">
            {renderToolParameterFields()}
          </Card>
          <Space wrap>
            <Button htmlType="submit" loading={isAnalyzing} type="primary">
              提交安全网关分析
            </Button>
            <Button onClick={() => {
              form.resetFields();
              setActiveScenario(null);
              setSubmittedRequest(null);
              setAnalysisResult(null);
              setAnalysisError(null);
              setValidationError(null);
            }}>
              清空表单
            </Button>
          </Space>
        </Form>
      </Card>
      <Card title="网关分析结果">
        <Space orientation="vertical" size="middle">
          {!submittedRequest && !isAnalyzing && !analysisError && !analysisResult ? (
            <EmptyState
              title="暂无分析结果"
              description="请选择种子场景或手动填写工具调用，再提交安全网关分析；没有网关决策前 executor 始终保持关闭。"
            />
          ) : null}
          {isAnalyzing ? (
            <LoadingState title="正在提交安全网关分析" description="等待 POST /api/tool-calls/analyze 返回风险和执行决策，executor 仍保持关闭。" />
          ) : null}
          {analysisError ? (
            <Alert
              showIcon
              type="error"
              title="安全网关分析失败"
              description={`${analysisError.message}（${analysisError.code}）。请修正表单或确认 API 服务可访问；失败时不会触发 executor。`}
            />
          ) : null}
          {analysisResult ? (
            <Alert
              showIcon
              type={getAnalysisAlertType(analysisResult)}
              title={getAnalysisAlertTitle(analysisResult)}
              description={analysisResult.executionDecision.reason}
            />
          ) : null}
          {submittedRequest ? (
            <Card size="small" title="提交请求摘要">
              <Space orientation="vertical" size="small">
                <Flex gap="middle" wrap>
                  <Text>
                    工具类型：<Text strong>{toolTypeLabels[submittedRequest.toolType]}</Text>
                  </Text>
                  <Text>
                    目标环境：<Text strong>{environmentLabels[submittedRequest.environment]}</Text>
                  </Text>
                  <Text>
                    Actor：<Text code>{submittedRequest.actor}</Text>
                  </Text>
                </Flex>
                <Text type="secondary">Task purpose：{submittedRequest.taskPurpose}</Text>
                <Space orientation="vertical" size={4}>
                  <Text strong>工具专用参数</Text>
                  {renderSubmittedParameters(toSimulatorFormValues(submittedRequest))}
                </Space>
              </Space>
            </Card>
          ) : null}
          {analysisResult ? <AnalysisResultDetails result={analysisResult} /> : null}
        </Space>
      </Card>
    </Flex>
  );
}

type AuditPageProps = {
  navigateToAudit: (auditId: string) => void;
};

function AuditPage({ navigateToAudit }: AuditPageProps) {
  const [form] = Form.useForm<AuditFilterFormValues>();
  const [filters, setFilters] = useState<AuditFilters>({});
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const activeFilterCount = countActiveAuditFilters(filters);

  useEffect(() => {
    let isCurrent = true;

    const loadAudits = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextAudits = await listAudits(filters);

        if (isCurrent) {
          setAudits(nextAudits);
        }
      } catch (loadError: unknown) {
        if (isCurrent) {
          setError(normalizeApiError(loadError, '无法加载审计记录'));
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    void loadAudits();

    return () => {
      isCurrent = false;
    };
  }, [filters]);

  const columns: TableProps<AuditRecord>['columns'] = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => formatTimestamp(createdAt),
      width: 160,
    },
    {
      title: 'Audit ID',
      dataIndex: 'id',
      key: 'id',
      render: (auditId: string) => <Text code>{auditId}</Text>,
      width: 220,
    },
    {
      title: '工具与环境',
      key: 'tool',
      render: (_, audit) => (
        <Space orientation="vertical" size={0}>
          <Text>{toolTypeLabels[audit.request.toolType]}</Text>
          <Text type="secondary">{environmentLabels[audit.request.environment]}</Text>
        </Space>
      ),
      width: 140,
    },
    {
      title: '动作目标',
      key: 'target',
      render: (_, audit) => (
        <Space orientation="vertical" size={0}>
          <Text code>{audit.actionTuple.target}</Text>
          <Text type="secondary">{audit.actionTuple.operation}</Text>
        </Space>
      ),
      width: 180,
    },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (riskLevel: RiskLevel) => <RiskStatusTag status={riskLevel} />,
      width: 120,
    },
    {
      title: '决策',
      key: 'decision',
      render: (_, audit) => <DecisionStatusTag status={audit.decision.type as DecisionType} />,
      width: 120,
    },
    {
      title: '原因摘要',
      key: 'reason',
      render: (_, audit) => <Text type="secondary">{audit.decision.reason}</Text>,
    },
    {
      title: '详情',
      key: 'detail',
      render: (_, audit) => (
        <Button onClick={() => navigateToAudit(audit.id)} type="link">
          打开详情
        </Button>
      ),
      width: 110,
    },
  ];

  const handleFilterChange: FormProps<AuditFilterFormValues>['onValuesChange'] = (_, allValues) => {
    setFilters(normalizeAuditFilters(allValues));
  };

  const handleResetFilters = () => {
    form.resetFields();
    setFilters({});
  };

  return (
    <Flex vertical gap="large">
      <Card>
        <Space orientation="vertical" size="middle">
          <Title level={2}>审计证据回放</Title>
          <Paragraph type="secondary">
            列出每一次安全网关分析记录，可按决策、风险等级、工具类型和目标环境筛选，点击行进入后续审计详情回放。
          </Paragraph>
          <Alert
            showIcon
            type="info"
            title="只读审计检索，不触发 executor"
            description="筛选仅调用审计查询 API 更新表格，不会重新分析请求或执行任何工具。"
          />
        </Space>
      </Card>
      <Card>
        <Flex vertical gap="middle">
          <SectionHeader
            title="审计记录筛选"
            description="选择过滤条件后表格会局部刷新，便于快速定位阻断、沙箱、审批和低风险对照记录。"
            extra={<Tag color="blue">当前过滤 {activeFilterCount} 项</Tag>}
          />
          <Form form={form} layout="vertical" onValuesChange={handleFilterChange}>
            <Flex gap="middle" wrap>
              <Form.Item label="Decision" name="decision" style={{ flex: '1 1 180px' }}>
                <Select allowClear options={decisionOptions} placeholder="全部决策" />
              </Form.Item>
              <Form.Item label="Risk level" name="riskLevel" style={{ flex: '1 1 180px' }}>
                <Select allowClear options={riskLevelOptions} placeholder="全部风险等级" />
              </Form.Item>
              <Form.Item label="Tool type" name="toolType" style={{ flex: '1 1 180px' }}>
                <Select allowClear options={toolTypeOptions} placeholder="全部工具" />
              </Form.Item>
              <Form.Item label="Environment" name="environment" style={{ flex: '1 1 180px' }}>
                <Select allowClear options={environmentOptions} placeholder="全部环境" />
              </Form.Item>
              <Form.Item label="操作" style={{ flex: '0 0 120px' }}>
                <Button block onClick={handleResetFilters}>
                  清空筛选
                </Button>
              </Form.Item>
            </Flex>
          </Form>
        </Flex>
      </Card>
      <Card>
        <Flex vertical gap="middle">
          <SectionHeader
            title="审计记录列表"
            description="行内展示请求、动作目标、风险和执行决策；点击行或“打开详情”可进入该 audit id 的回放页。"
            extra={<Text type="secondary">共 {audits.length} 条</Text>}
          />
          {isLoading ? (
            <LoadingState title="正在加载审计记录" description="等待审计 API 返回查询结果，期间不会默认放行任何执行。" />
          ) : null}
          {error ? (
            <ErrorState
              title="无法加载审计记录"
              description={`${error.message}。请确认 API 服务可访问；审计不可用时不要根据空表判断执行安全。`}
            />
          ) : null}
          {!isLoading && !error && audits.length === 0 ? (
            <EmptyState
              title="没有匹配的审计记录"
              description="请清空筛选或先在工具调用模拟器运行种子场景，生成可复盘的网关审计证据。"
            />
          ) : null}
          {!isLoading && !error && audits.length > 0 ? (
            <Table
              columns={columns}
              dataSource={audits}
              onRow={(audit) => ({
                className: 'audit-table-row',
                onClick: () => navigateToAudit(audit.id),
              })}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              rowKey="id"
              scroll={{ x: 1160 }}
            />
          ) : null}
        </Flex>
      </Card>
    </Flex>
  );
}

const getAuditIdFromPath = (pathname: string) => {
  if (!pathname.startsWith('/audits/')) {
    return null;
  }

  return decodeURIComponent(pathname.slice('/audits/'.length));
};

function renderRouteContent(
  routeKey: RouteKey,
  currentPath: string,
  navigateToAudit: (auditId: string) => void,
  navigateToAuditList: () => void,
) {
  const detailAuditId = getAuditIdFromPath(currentPath);

  if (detailAuditId !== null) {
    return <AuditDetailPage auditId={detailAuditId} navigateToAuditList={navigateToAuditList} />;
  }

  switch (routeKey) {
    case 'dashboard':
      return <DashboardPage navigateToAudit={navigateToAudit} />;
    case 'simulator':
      return <SimulatorPage />;
    case 'audit':
      return <AuditPage navigateToAudit={navigateToAudit} />;
  }
}

export function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const currentRoute = resolveRoute(currentPath);
  const menuItems = useMemo(
    () => appRoutes.map((route) => ({ key: route.key, label: route.label })),
    [],
  );

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    const nextRoute = appRoutes.find((route) => route.key === key);

    if (!nextRoute || nextRoute.path === currentPath) {
      return;
    }

    window.history.pushState(null, '', nextRoute.path);
    setCurrentPath(nextRoute.path);
  };

  const navigateToAudit = (auditId: string) => {
    const nextPath = `/audits/${encodeURIComponent(auditId)}`;

    window.history.pushState(null, '', nextPath);
    setCurrentPath(nextPath);
  };

  const navigateToAuditList = () => {
    window.history.pushState(null, '', '/audits');
    setCurrentPath('/audits');
  };

  return (
    <ConfigProvider theme={safetyGatewayTheme}>
      <Layout className="app-shell">
        <Sider className="app-sider" breakpoint="lg" collapsedWidth={80} width={248}>
          <Space className="app-brand" orientation="vertical" size={2}>
            <Text className="app-brand-title">智能体执行安全网关</Text>
            <Text className="app-brand-subtitle">Agent Safety Gateway</Text>
          </Space>
          <Menu
            className="app-menu"
            items={menuItems}
            mode="inline"
            onClick={handleMenuClick}
            selectedKeys={[currentRoute.key]}
            theme="dark"
          />
        </Sider>
        <Layout>
          <Header className="app-header">
            <Space orientation="vertical" size={0}>
              <Text className="app-header-title">{currentRoute.title}</Text>
              <Text type="secondary">{currentRoute.description}</Text>
            </Space>
          </Header>
          <Content className="app-content">
            {renderRouteContent(currentRoute.key, currentPath, navigateToAudit, navigateToAuditList)}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
