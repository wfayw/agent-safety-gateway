import { Alert, Card, ConfigProvider, Flex, Layout, Menu, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { safetyGatewayTheme } from './theme';
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

function resolveRoute(pathname: string): AppRoute {
  if (pathname === '/' || pathname === '') {
    return defaultRoute;
  }

  if (pathname.startsWith('/audits/')) {
    return appRoutes.find((route) => route.key === 'audit') ?? defaultRoute;
  }

  return appRoutes.find((route) => route.path === pathname) ?? defaultRoute;
}

function DashboardPage() {
  return (
    <Flex vertical gap="large">
      <Card>
        <Space orientation="vertical" size="middle">
          <Title level={2}>Agent 动手前，先判断会不会出事</Title>
          <Paragraph type="secondary">
            首版 Web 应用已接入 Vite、React、TypeScript 与 Ant Design，当前应用外壳可稳定导航到仪表盘、工具调用模拟器和审计回放。
          </Paragraph>
          <Alert
            showIcon
            type="info"
            title="应用外壳已就绪"
            description="使用左侧导航切换核心页面；当前路由会在导航中高亮，后续故事会逐步接入真实数据和交互。"
          />
        </Space>
      </Card>
      <Card title="MVP 页面占位">
        <Space orientation="vertical">
          <Text>仪表盘：展示风险拦截概览。</Text>
          <Text>工具调用模拟器：提交 SQL、CI/CD 与配置变更请求。</Text>
          <Text>审计回放：复盘网关决策和 executor 结果。</Text>
        </Space>
      </Card>
      <Card title="安全状态标签">
        <Flex vertical gap="middle">
          <Space wrap>
            <DecisionStatusTag status="allow" />
            <DecisionStatusTag status="block" />
            <DecisionStatusTag status="require_approval" />
            <DecisionStatusTag status="sandbox" />
            <DecisionStatusTag status="rewrite" />
          </Space>
          <Space wrap>
            <RiskStatusTag status="low" />
            <RiskStatusTag status="medium" />
            <RiskStatusTag status="high" />
            <RiskStatusTag status="prohibited" />
          </Space>
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

function renderRouteContent(routeKey: RouteKey) {
  switch (routeKey) {
    case 'dashboard':
      return <DashboardPage />;
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
          <Content className="app-content">{renderRouteContent(currentRoute.key)}</Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
