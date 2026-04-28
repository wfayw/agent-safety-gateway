import { Alert, Card, ConfigProvider, Flex, Layout, Space, Typography } from 'antd';

const { Content, Header } = Layout;
const { Paragraph, Text, Title } = Typography;

export function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1d4ed8',
          borderRadius: 8,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        },
      }}
    >
      <Layout className="app-shell">
        <Header className="app-header">
          <Space size="middle">            <Text className="app-header-title">智能体执行安全网关</Text>
          </Space>
        </Header>
        <Content className="app-content">
          <Flex vertical gap="large">
            <Card>
              <Space orientation="vertical" size="middle">
                <Title level={2}>Agent 动手前，先判断会不会出事</Title>
                <Paragraph type="secondary">
                  首版 Web 应用已接入 Vite、React、TypeScript 与 Ant Design，后续页面会在这里承载仪表盘、工具调用模拟器和审计回放。
                </Paragraph>
                <Alert
                  showIcon
                  type="info"
                  title="前端基础设施已就绪"
                  description="运行 pnpm dev:web 可启动本地 Web 应用，运行 pnpm build:web 或 pnpm typecheck:web 可验证构建与类型。"
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
          </Flex>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
