import { Alert, Button, Card, ConfigProvider, Flex, Layout, Menu, Space, Table, Typography } from 'antd';
import type { MenuProps, TableProps } from 'antd';
import type { AuditRecord, DecisionType, Environment, RiskLevel, ToolType } from '@agent-safety-gateway/shared';
import { useEffect, useMemo, useState } from 'react';
import { listAudits, normalizeApiError, type ApiErrorPayload } from './api';
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
  return (
    <Card title="工具执行前检查">
      <Space orientation="vertical" size="middle">
        <Paragraph type="secondary">
          模拟器页面将用于加载种子场景、提交工具调用请求，并在 executor 调用前展示允许、阻断、审批、沙箱或改写决策。
        </Paragraph>
        <Alert
          showIcon
          type="warning"
          title="执行控制默认保持关闭"
          description="在后续交互故事接入网关响应前，生产工具执行入口不会在此页面启用。"
        />
        <Space wrap>
          <DecisionStatusTag status="block" />
          <RiskStatusTag status="high" />
        </Space>
      </Space>
    </Card>
  );
}

function AuditPage() {
  return (
    <Card title="审计证据回放">
      <Space orientation="vertical" size="middle">
        <Paragraph type="secondary">
          审计回放页面将集中呈现 Agent 原始输出、ToolCallRequest、网关决策、executor 日志和结论，支持复盘每一次执行控制。
        </Paragraph>
        <Alert
          showIcon
          type="info"
          title="等待审计 API 数据接入"
          description="当前路由已可访问，后续故事会接入审计列表、筛选和详情回放。"
        />
        <Space wrap>
          <DecisionStatusTag status="allow" />
          <DecisionStatusTag status="sandbox" />
          <RiskStatusTag status="medium" />
        </Space>
      </Space>
    </Card>
  );
}

function renderRouteContent(routeKey: RouteKey, navigateToAudit: (auditId: string) => void) {
  switch (routeKey) {
    case 'dashboard':
      return <DashboardPage navigateToAudit={navigateToAudit} />;
    case 'simulator':
      return <SimulatorPage />;
    case 'audit':
      return <AuditPage />;
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
            {renderRouteContent(currentRoute.key, navigateToAudit)}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
