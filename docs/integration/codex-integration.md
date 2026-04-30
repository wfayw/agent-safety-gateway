# Codex 接入说明

本文档说明如何把本仓库的 `agent-safety-gateway` 接入本机 Codex CLI。

## 接入内容

接入由四部分组成：

1. `Codex -> ToolCallRequest` adapter：位于 `services/codex/src/codex-adapter.mjs`，负责把 Codex Bash 命令或 MCP 工具参数转换为网关可分析的 `ToolCallRequest`。
2. MCP server：位于 `services/codex/src/mcp-server.mjs`，向 Codex 暴露 `safe_sql`、`safe_deploy`、`safe_config_update`、`analyze_tool_call` 和 `gateway_health`。
3. `PreToolUse` hook：位于 `services/codex/src/pretool-hook.mjs`，在 Codex 执行 Bash 前识别 SQL、CI/CD、配置变更等高危命令，并调用网关分析；分析失败时对命中的高危命令 fail-closed。
4. dry-run executor 包装：位于 `services/codex/src/dry-run-executors.mjs`，只在网关允许后调用用户显式配置的 dry-run 命令。

## 安装

在仓库根目录执行：

```bash
node services/codex/src/install.mjs
```

安装脚本会做三件事：

- 通过 `codex mcp add agent-safety-gateway -- node .../mcp-server.mjs` 注册 MCP server。
- 在 `~/.codex/config.toml` 中启用 `features.codex_hooks = true`。
- 在 `~/.codex/hooks.json` 中追加一个 `PreToolUse` hook，命令为 `node .../pretool-hook.mjs`。

安装状态会写入：

```text
~/.codex/agent-safety-gateway-install.json
```

原始 `config.toml` 和 `hooks.json` 会备份到：

```text
~/.codex/backups/
```

## 启动网关 API

MCP 工具和 hook 默认调用：

```text
http://127.0.0.1:4310
```

启动方式：

```bash
pnpm install
pnpm seed
API_PORT=4310 pnpm dev
```

如果没有安装 `pnpm`：

```bash
npm install -g pnpm@10.33.0
```

也可以通过环境变量指向其他网关地址：

```bash
ASG_GATEWAY_URL=http://127.0.0.1:4311 node services/codex/src/install.mjs
```

## MCP 工具

Codex 重启后可以使用 MCP 工具：

- `safe_sql`：分析 SQL 请求；`SELECT` 只调用 `ASG_SQL_READONLY_COMMAND`，非只读 SQL 只调用 `ASG_SQL_DRY_RUN_COMMAND` 生成 dry-run / explain-plan 证据。
- `safe_deploy`：分析部署或回滚请求，只有 `allow`、测试状态满足安全门槛且配置了 `ASG_CICD_DRY_RUN_COMMAND` 时才调用 CI/CD dry-run。
- `safe_config_update`：分析配置变更，只有 `allow` 或 `sandbox` 且配置了 `ASG_CONFIG_SANDBOX_COMMAND` 时才调用 sandbox/canary executor。
- `analyze_tool_call`：只分析完整 `ToolCallRequest`，不执行。
- `gateway_health`：检查网关 API 是否可达。

dry-run 命令使用 JSON 字符串数组配置，避免 shell 拼接：

```bash
export ASG_SQL_READONLY_COMMAND='["psql","postgres://readonly-user@host/db","-X","-v","ON_ERROR_STOP=1"]'
export ASG_SQL_DRY_RUN_COMMAND='["psql","postgres://dry-run-user@host/db","-X","-v","ON_ERROR_STOP=1"]'
export ASG_SQL_PRODUCTION_WRITE_NETWORK_BLOCKED=true
export ASG_CICD_DRY_RUN_COMMAND='["/opt/company/bin/deploy-dry-run"]'
export ASG_CONFIG_SANDBOX_COMMAND='["/opt/company/bin/config-sandbox-write"]'
export ASG_CONFIG_SANDBOX_NAMESPACE=payment-sandbox
export ASG_CONFIG_CANARY_NAMESPACE=payment-canary
```

SQL adapter 会先验证 `productionWriteNetworkBlocked` 边界：可以在 MCP `safe_sql` 参数或 `ToolCallRequest.rawPayload.productionWriteNetworkBlocked` 中传入 `true`，也可以设置 `ASG_SQL_PRODUCTION_WRITE_NETWORK_BLOCKED=true`。该值为 `false` 或未知时，SQL adapter 会在调用任何 SQL client 前 fail closed。

SQL executor 约定：

- `SELECT`：通过 `ASG_SQL_READONLY_COMMAND` 调用只读连接，传入参数为 `-c <原始 SELECT>`。
- 非只读 SQL：通过 `ASG_SQL_DRY_RUN_COMMAND` 调用 dry-run/explain 连接，传入参数为 `-c "EXPLAIN <原始 SQL>"`，不得提交写入。
- executor stdout 如果是 JSON，可返回 `rowCount`、`rows` 或 `explainPlan`；否则 dry-run 文本 stdout 会作为 `explainPlan.text` 保存。

CI/CD dry-run executor 约定：

- executor profile 通过 `ASG_CICD_DRY_RUN_COMMAND` 配置，MCP adapter 会传入 `--service`、`--operation`、`--pipeline`、`--version`、`--environment` 和 `--test-status`。
- 生产 `deploy` 请求只有在 `testStatus=passed` 时才会调用 dry-run executor；`failed`、`unknown` 或缺失状态会在调用前 fail closed，并返回 `production_deploy_tests_not_passed`。
- executor stdout 如果是 JSON，可返回 `runId`、`artifactUris` 和 `dryRunPlan` / `plan`；这些字段会写入 MCP `executor` 结果与 `evidence`，便于关联真实 CI/CD dry-run 产物。
- 该 adapter 只调用 dry-run / planning interface，测试覆盖会验证失败测试状态不会触发任何真实发布 executor。

配置 sandbox/canary executor 约定：

- executor profile 通过 `ASG_CONFIG_SANDBOX_COMMAND` 配置，MCP adapter 会传入 `--service`、`--key`、`--value`、`--operation`、`--source-namespace`、`--namespace` 和 `--mode`。
- `--source-namespace` 表示原始请求所在 namespace，生产配置请求通常为 `production`；`--namespace` 必须是隔离后的 sandbox 或 canary target namespace。
- `sandbox` 决策默认使用 `ASG_CONFIG_SANDBOX_NAMESPACE`，canary 改写或 `rolloutStrategy=canary` 默认使用 `ASG_CONFIG_CANARY_NAMESPACE`；未设置时会生成 `production-codex-sandbox` 或 `production-codex-canary` 这类本地目标名。
- 如果 MCP 参数显式传入 `targetNamespace=production` 或 `targetNamespace=prod`，adapter 会在调用任何 executor 前返回 `production_namespace_refused`，证明不会直接写生产配置 namespace。
- executor stdout 如果是 JSON，可返回 `runId`、`artifactUris` 和 `rollbackPlan`；这些字段会写入 MCP `executor` 结果与 `evidence`。未返回 `rollbackPlan` 时，adapter 会根据 `previousValue` 生成恢复原值的回滚计划。

未配置这些环境变量时，MCP 工具仍会返回网关分析结果，但不会伪造真实 executor 已执行。

MCP executor 会在调用前验证 dry-run profile，并返回以下 `executorStatus` / `mode` 诊断：

- `configured`：环境变量是非空 JSON 字符串数组，首个元素是当前进程可执行的 dry-run/sandbox 命令。
- `not_configured`：环境变量为空或未设置；网关分析结果保留，但 executor 不会被调用。
- `invalid`：配置不是 JSON 字符串数组、数组为空、元素不是非空字符串，或指向 `sh`/`bash`/`zsh`/`powershell` 等 shell interpreter。
- `unreachable`：命令格式有效，但首个元素在绝对路径或 `PATH` 中不可执行。
- `production_write_network_unknown` / `production_write_network_open`：SQL executor profile 虽然可用，但生产写网络边界未知或明确未阻断，因此不会调用 SQL executor。
- `production_deploy_tests_not_passed`：生产 deploy 的测试状态不是 `passed`，因此 CI/CD dry-run executor 不会被调用。
- `production_namespace_refused`：配置 sandbox/canary target namespace 指向 `production` 或 `prod`，因此不会调用配置 executor。

`invalid` 和 `unreachable` 都会 fail closed，并在调用任何 dry-run 命令前返回 `executorInvoked=false`。

### MCP 协议边界

当前 MCP server 是无额外依赖的 stdio JSON-RPC 薄封装，刻意保持较小协议面：

- 支持 `initialize`、`ping`、`tools/list`、`tools/call`、`resources/list` 和 `prompts/list`。
- `tools/call` 响应总是包含 MCP `content` 文本块和 `structuredContent`，便于 Codex 同时展示可读结果和保留结构化证据。
- `resources/list` 与 `prompts/list` 目前返回空列表；本集成暂不提供资源订阅、提示模板、流式进度或工具列表变更通知。
- server 按行读取 JSON-RPC 消息；单行 malformed JSON 会返回 `-32700` parse error，后续有效消息仍可继续处理。
- notification 或缺少 `id` 的请求不会返回响应，避免把 Codex 的单向生命周期事件误报为失败。
- `safe_sql`、`safe_deploy` 和 `safe_config_update` 只在网关允许且对应 readonly/dry-run/sandbox 环境变量配置后才会调用本地 executor；未配置时返回 `not_configured` 证据，不伪造执行成功。

## Hook 行为

`PreToolUse` hook 只处理 Bash 类工具。它会识别以下命令类型：

- SQL client：`psql`、`mysql`、`mariadb`、`sqlcmd`、`sqlite3`。
- CI/CD：`kubectl`、`helm`、`terraform`、`gh workflow`、`argo`、`flux`。
- 配置变更：包含 `config`、`settings`、`feature-flag`、`consul`、`etcd`、`vault` 且执行 `set`、`put`、`write`、`update`、`patch`、`curl`。

命中高危命令后：

- 网关返回 `allow`：hook 不输出阻断，Codex 继续执行。
- 网关返回 `block`、`sandbox`、`require_approval`、`rewrite` 或 `riskLevel=prohibited`：hook 返回 `should_block=true`。
- 网关不可达：对命中的高危命令 fail-closed，返回 `should_block=true`。

阻断决策会追加写入本地 JSONL：

```text
.data/hook-decisions.jsonl
```

每条记录包含工具名、命令摘要、`cwd`、可转换时的 `ToolCallRequest`、阻断原因、`shouldBlock`、`createdAt`，以及网关分析生成的 `auditId`。如需把 hook 决策写入其他目录，可设置 `ASG_HOOK_DECISION_DATA_DIR=/path/to/data`。

## 卸载

在仓库根目录执行：

```bash
node services/codex/src/uninstall.mjs
```

卸载脚本会：

- 执行 `codex mcp remove agent-safety-gateway`。
- 从 `~/.codex/hooks.json` 删除本项目添加的 hook。
- 按安装前状态恢复 `features.codex_hooks`。
- 删除 `~/.codex/agent-safety-gateway-install.json`。

如果本地网关 API 是按本文档手工启动的，卸载 Codex 接入后可另行停止：

```bash
kill "$(cat .local/pids/codex-asg-api.pid)"
```

手工卸载等价步骤：

```bash
codex mcp remove agent-safety-gateway
```

然后删除 `~/.codex/hooks.json` 中命令等于以下路径的 hook：

```text
node <repo>/services/codex/src/pretool-hook.mjs
```

最后按需从 `~/.codex/config.toml` 中删除或关闭：

```toml
[features]
codex_hooks = true
```
