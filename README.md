# 智能体执行安全网关

`agent-safety-gateway` 是一个最小可用的智能体执行安全网关：在 AI 智能体真正调用工具前，拦截工具请求，分析受影响资源和风险，并返回允许、阻断、沙箱或审批建议等执行控制决策。

本项目不是通用 Agent 平台，也不是 RAG、知识图谱后台或后台策略管理系统。MVP 聚焦“Agent 动手前，先判断会不会出事；判断会出事，就不要让工具真正执行”的闭环验证。

## 当前阶段

当前仓库已提供 pnpm monorepo、共享领域模型、分析 API、确定性规则引擎、本地 JSON 存储、mock executor、ToolExecutionGuard、Vite React Ant Design Web 应用、审计回放页、样例研发工作区，以及 `RV-001` 到 `RV-004` 的真实验证证据。

MVP 仍然默认使用本地 fixture、deterministic Agent Adapter 和 mock executor。接入真实 Agent、数据库、CI/CD、配置中心或审计平台时，需要通过 adapter 复验并重新标注证据来源。

## 目录结构

```text
agent-safety-gateway/
├── apps/web/             # Vite React Ant Design 前端应用
├── services/             # 后端服务入口，承载分析 API、规则引擎、seed 和执行守卫示例
├── packages/             # 共享包，承载领域类型、schema 和样例场景 fixture
├── sample-workspace/     # 本地研发流程样例：任务输入、订单数据、流水线和配置 fixture
├── skills/               # 项目相关技能、运行规范或可复用执行说明
├── docs/                 # 产品、验证和运行文档
├── docs/evidence/        # 真实验证证据与报告输出位置
├── scripts/              # 工作区脚本和临时占位命令
├── package.json          # 根工作区脚本
├── pnpm-workspace.yaml   # pnpm workspace 包范围
└── tsconfig.base.json    # 共享 TypeScript 编译默认配置
```

## 本地开发命令

### 安装与初始化

首次拉取后在仓库根目录安装依赖：

```bash
pnpm install
```

生成或补齐本地种子数据：

```bash
pnpm seed
```

`pnpm seed` 会写入 `.data/` 下的本地 JSON/JSONL 存储，包括资源目录、依赖关系、四个模拟场景，以及后续分析产生的审计、执行日志和 Codex hook 阻断决策。默认路径可通过 `API_DATA_DIR=/path/to/data pnpm seed` 覆盖。

样例输入位于：

- `sample-workspace/agent-tasks/sql-delete-pending-orders.md`
- `sample-workspace/agent-tasks/sql-readonly-pending-orders.md`
- `sample-workspace/agent-tasks/production-release-with-failed-tests.md`
- `sample-workspace/agent-tasks/production-config-timeout-change.md`

### 常用脚本

根目录提供以下常用命令：

```bash
pnpm dev
pnpm local:start
pnpm local:verify
pnpm local:status
pnpm local:stop
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

其中：

- `pnpm dev` 启动 API，默认监听 `http://127.0.0.1:4310`。
- `pnpm dev:web` 启动 Web，默认监听 `http://127.0.0.1:5173`。
- `pnpm typecheck` 是当前工作区最小整体验证命令。
- `pnpm build` 构建 shared、API 和 Web。
- `pnpm test` 当前保留为根工作区占位测试；API/Web 的测试请使用包级命令。

包级验证命令：

```bash
pnpm --filter @agent-safety-gateway/api typecheck
pnpm --filter @agent-safety-gateway/api test
pnpm --filter @agent-safety-gateway/web typecheck
pnpm --filter @agent-safety-gateway/web test
pnpm typecheck:web
pnpm build:web
```

### 运行 API 和 Web

一个终端启动 API：

```bash
pnpm seed
API_PORT=4310 API_LOG_LEVEL=info pnpm dev
```

另一个终端启动 Web：

```bash
VITE_API_BASE_URL=http://127.0.0.1:4310 pnpm dev:web
```

启动后可访问：

- API 健康检查：`http://127.0.0.1:4310/health`
- 场景列表：`http://127.0.0.1:4310/api/scenarios`
- 审计列表：`http://127.0.0.1:4310/api/audits`
- Web 控制台：`http://127.0.0.1:5173`

## 本地启动与手工验证

本地启动脚本位于 `scripts/local-start.sh`。

当前仓库如果还没有 `services/api` 或 `apps/web`，脚本会进入骨架验证模式，执行安装、类型检查、构建和占位测试，不会启动不存在的服务：

```bash
pnpm local:verify
```

后续 API 和 Web 包落地后，使用同一命令启动本地系统：

```bash
pnpm local:start
```

脚本默认行为：

- 安装依赖。
- 执行 `pnpm typecheck`、`pnpm build`、`pnpm test`。
- 如果存在 `@agent-safety-gateway/api`，执行 seed 并启动 API。
- 如果存在 `@agent-safety-gateway/web`，启动 Web。
- API 默认地址：`http://127.0.0.1:4310`。
- Web 默认地址：`http://127.0.0.1:5173`。
- 日志输出到 `.local/logs/`。
- 进程 pid 输出到 `.local/pids/`。
- 本地功能验证证据输出到 `docs/evidence/local-start/`。

常用命令：

```bash
pnpm local:status
pnpm local:stop
API_PORT=4311 WEB_PORT=5174 pnpm local:start
bash scripts/local-start.sh --no-install
bash scripts/local-start.sh --no-functional
```

核心手工验证重点是：

- 高风险 SQL 删除应阻断，SQL executor 调用次数为 `0`。
- 低风险 SQL 查询应允许或只读执行，SQL executor 调用次数为 `1`。
- 测试失败生产发布应阻断，deploy executor 调用次数为 `0`。
- 生产关键配置变更应返回 `sandbox` 或 `require_approval`。

## 高风险 SQL 删除验证路径

高风险 SQL 删除场景用于证明“生产订单表删除请求必须在 executor 前被阻断”：

1. 阅读 Agent 任务输入：`sample-workspace/agent-tasks/sql-delete-pending-orders.md`。
2. 准备本地资源和场景数据：`pnpm seed`。
3. 运行真实验证测试：

   ```bash
   cd services/api
   node --import tsx --test test/agent-sql-delete-real-validation.test.ts
   ```

4. 核对报告：`docs/evidence/real-validation/RV-001-sql-delete-block.md`。
5. 预期结论：网关返回 `riskLevel=prohibited` 和 `decision.type=block`，`ToolExecutionGuard` 不调用 SQL executor，审计记录包含请求、影响资源、风险因子和阻断决策。

也可以在 API 启动后通过 Web 选择高风险 SQL 删除场景，提交分析并进入审计回放页核对同一决策链路。首版验证仍使用本地 fixture 和 mock executor，不连接真实生产数据库。

## 真实验证场景

`RV-001` 到 `RV-004` 的证据报告位于 `docs/evidence/real-validation/`，汇总结论见 `docs/evidence/real-validation/summary.md`。

逐项复验命令：

```bash
pnpm --filter @agent-safety-gateway/api typecheck
cd services/api && node --import tsx --test test/agent-sql-delete-real-validation.test.ts
cd services/api && node --import tsx --test test/agent-sql-readonly-real-validation.test.ts
cd services/api && node --import tsx --test test/agent-production-release-real-validation.test.ts
cd services/api && node --import tsx --test test/agent-production-config-real-validation.test.ts
```

场景说明：

- `RV-001`：高风险生产 SQL 删除阻断，报告为 `RV-001-sql-delete-block.md`。
- `RV-002`：低风险生产 SQL 只读查询放行，报告为 `RV-002-sql-readonly-allow.md`。
- `RV-003`：测试失败后的生产发布阻断，报告为 `RV-003-production-release-block.md`。
- `RV-004`：生产关键配置变更进入 sandbox/canary 建议路径，报告为 `RV-004-production-config-sandbox.md`。

这些场景当前结论均按“部分通过”记录：执行控制闭环已由本地确定性测试证明，但 Agent、executor、数据库、CI/CD、配置中心和审计存储仍包含 mock 或 fixture，需要真实组件复验。

## 真实组件接入

如需把 MVP 从本地验证推进到真实研发链路，请先提供以下信息，再新增 adapter 或复验报告：

- 真实 Agent/Ralph 输出协议、工具调用 JSON 结构、actor 标识和可复现任务输入。
- SQL 沙箱或 dry-run 数据库、只读账号、可回滚测试数据和禁止写入生产的网络边界。
- CI/CD dry-run 环境、pipeline 状态 API、失败测试 fixture 和不会触发真实发布的 deploy executor。
- 配置中心沙箱、staging/canary 命名规则、审批 API、回滚策略和审计字段要求。
- 人工审批系统的请求创建/查询接口、审批组、状态枚举和审计回查路径。
- 审计/日志平台的写入接口、查询方式、保留周期、脱敏规则和证据归档位置。

当前已补充真实组件接入契约、配置模板和复验报告模板：

- 接入说明：`docs/integration/real-component-onboarding.md`
- Codex 接入说明：`docs/integration/codex-integration.md`
- 配置模板：`docs/integration/real-component-profile.example.json`
- 复验报告模板：`docs/evidence/real-validation/templates/RV-real-component-report.template.md`
- 代码契约：`services/api/src/real-component-adapters.ts`

Codex MCP 已提供 SQL readonly/dry-run、CI/CD dry-run 和配置 sandbox/canary 命令 adapter；配置中心 adapter 通过 `ASG_CONFIG_SANDBOX_COMMAND`、`ASG_CONFIG_SANDBOX_NAMESPACE` 和 `ASG_CONFIG_CANARY_NAMESPACE` 路由到隔离 namespace，显式生产 target namespace 会 fail-closed。真实 adapter 未配置时必须 fail-closed，不调用真实 executor；`require_approval` 决策会先创建 held 审批请求，只有审批 adapter 返回 `approved` 才能进入 executor。后续拿到真实环境信息后，优先按 Agent/Ralph 输出协议、审批系统、审计平台、SQL dry-run、CI/CD dry-run、配置中心 sandbox 的顺序接入。

## 未完成能力

- 真实 Agent、真实数据库、真实 CI/CD、企业配置中心专用接入和真实审计平台的具体 adapter 实现。
- 针对用户提供研发环境的 RV-001 到 RV-004 真实组件复验报告。
- 后台资源/策略管理系统；当前 MVP 仍使用本地 JSON/JSONL 和 seed 数据。

## 设计边界

- 优先使用确定性规则和清晰数据结构证明执行控制闭环。
- 首版默认使用本地样例环境和 mock executor，真实研发组件通过 adapter 后续接入。
- 所有高风险验收都需要保留输入、网关响应、executor 日志、审计记录和验证结论。
