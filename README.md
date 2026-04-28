# 智能体执行安全网关

`agent-safety-gateway` 是一个最小可用的智能体执行安全网关：在 AI 智能体真正调用工具前，拦截工具请求，分析受影响资源和风险，并返回允许、阻断、沙箱或审批建议等执行控制决策。

本项目不是通用 Agent 平台，也不是 RAG、知识图谱后台或后台策略管理系统。MVP 聚焦“Agent 动手前，先判断会不会出事；判断会出事，就不要让工具真正执行”的闭环验证。

## 当前阶段

当前仓库已提供 pnpm monorepo、基础 TypeScript 配置、分析 API 骨架和 Vite React Ant Design Web 应用。策略引擎、审计回放、真实验证场景和 executor guard 会在后续迭代中逐步补齐。

## 目录结构

```text
agent-safety-gateway/
├── apps/web/             # Vite React Ant Design 前端应用
├── services/             # 后端服务入口，后续承载分析 API 和执行守卫示例
├── packages/             # 共享包，后续承载领域类型、规则引擎和适配器
├── skills/               # 项目相关技能、运行规范或可复用执行说明
├── docs/                 # 产品、验证和运行文档
├── docs/evidence/        # 真实验证证据与报告输出位置
├── scripts/              # 工作区脚本和临时占位命令
├── package.json          # 根工作区脚本
├── pnpm-workspace.yaml   # pnpm workspace 包范围
└── tsconfig.base.json    # 共享 TypeScript 编译默认配置
```

## 可用命令

当前命令会调用 `scripts/workspace-placeholder.mjs`，用于在具体包落地前保持工作区脚本可执行：

```bash
pnpm dev
pnpm dev:web
pnpm build:web
pnpm typecheck:web
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format
pnpm seed
```

其中 `pnpm typecheck:web`、`pnpm build:web` 可单独验证前端应用，`pnpm typecheck` 是当前工作区最小整体验证命令。

## 未完成能力

- 安全网关核心分析服务和 HTTP API
- ToolCallRequest/Decision/AuditRecord 等领域模型
- SQL 删除阻断、SQL 查询放行、测试失败发布阻断和生产配置变更沙箱/审批建议规则
- 工具执行守卫、mock executor 与真实组件 adapter
- 审计回放页和场景验证入口
- RV-001 到 RV-004 真实验证报告和证据归档
- 后台资源/策略管理系统与正式专利文档生成

## 设计边界

- 优先使用确定性规则和清晰数据结构证明执行控制闭环。
- 首版默认使用本地样例环境和 mock executor，真实研发组件通过 adapter 后续接入。
- 所有高风险验收都需要保留输入、网关响应、executor 日志、审计记录和验证结论。
