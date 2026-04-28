# 样例研发工作区

本目录是智能体执行安全网关的本地样例研发工作区，对应 PRD 中的 `validationContext.realValidationProtocol.sampleWorkspaceRoot`：

`/home/wangfei/workspace/llmwiki/agent-safety-gateway/sample-workspace`

它用于承载 Agent 真实验证所需的服务、数据、流水线和配置样例，默认只连接 mock executor，不连接任何真实生产系统。

## 模拟研发流程

1. Agent 阅读 `payment-service`、订单数据、发布流水线和配置仓库上下文。
2. Agent 根据任务意图生成 SQL、CI/CD 或配置写入工具调用。
3. 安全网关在 executor 调用前分析工具调用影响面和风险。
4. 执行守卫只在网关允许时调用 mock executor，并记录执行日志。
5. 验证人员收集 Agent 输入、网关响应、executor 日志和审计记录形成证据。

## 目录说明

- `payment-service/`：虚构支付服务样例，描述部署目标、运行约束和关键配置。
- `agent-tasks/`：中文 Agent 任务输入样例，用于驱动 SQL、发布和配置变更验证。
- `data/orders.json`：虚构订单表样例数据，用于 SQL 删除和只读查询场景。
- `pipelines/payment-service-release.json`：虚构发布流水线 fixture，用于测试失败的生产发布阻断场景。
- `config-store/payment-service.production.json`：虚构生产配置仓库 fixture，用于关键配置变更沙箱或审批场景。

## 安全边界

- 所有样例名称、订单号、用户号、流水线和配置值均为本地虚构数据。
- 本目录不包含真实客户信息、真实密钥、真实数据库连接串或真实生产凭据。
- `production` 只表示风险建模环境标签，不代表连接真实生产资源。
- mock executor 后续可替换为真实组件 adapter，但真实复验必须重新标记证据来源。

## 首版限制

- 样例数据只覆盖 MVP 四条验证链路，不模拟完整电商系统。
- `payment-service` 只提供最小业务上下文，不提供可部署服务二进制。
- 流水线和配置仓库是静态 fixture，用于复现实验输入而非替代真实平台。
