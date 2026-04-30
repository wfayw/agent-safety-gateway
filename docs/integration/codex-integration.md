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

- `safe_sql`：分析 SQL 请求，只有 `allow` 且配置了 `ASG_SQL_DRY_RUN_COMMAND` 时才调用 SQL dry-run。
- `safe_deploy`：分析部署或回滚请求，只有 `allow` 且配置了 `ASG_CICD_DRY_RUN_COMMAND` 时才调用 CI/CD dry-run。
- `safe_config_update`：分析配置变更，只有 `allow` 或 `sandbox` 且配置了 `ASG_CONFIG_SANDBOX_COMMAND` 时才调用 sandbox/canary executor。
- `analyze_tool_call`：只分析完整 `ToolCallRequest`，不执行。
- `gateway_health`：检查网关 API 是否可达。

dry-run 命令使用 JSON 字符串数组配置，避免 shell 拼接：

```bash
export ASG_SQL_DRY_RUN_COMMAND='["psql","postgres://readonly-user@host/db","-X","-v","ON_ERROR_STOP=1"]'
export ASG_CICD_DRY_RUN_COMMAND='["/opt/company/bin/deploy-dry-run"]'
export ASG_CONFIG_SANDBOX_COMMAND='["/opt/company/bin/config-sandbox-write"]'
```

未配置这些环境变量时，MCP 工具仍会返回网关分析结果，但不会伪造真实 executor 已执行。

### MCP 协议边界

当前 MCP server 是无额外依赖的 stdio JSON-RPC 薄封装，刻意保持较小协议面：

- 支持 `initialize`、`ping`、`tools/list`、`tools/call`、`resources/list` 和 `prompts/list`。
- `tools/call` 响应总是包含 MCP `content` 文本块和 `structuredContent`，便于 Codex 同时展示可读结果和保留结构化证据。
- `resources/list` 与 `prompts/list` 目前返回空列表；本集成暂不提供资源订阅、提示模板、流式进度或工具列表变更通知。
- server 按行读取 JSON-RPC 消息；单行 malformed JSON 会返回 `-32700` parse error，后续有效消息仍可继续处理。
- notification 或缺少 `id` 的请求不会返回响应，避免把 Codex 的单向生命周期事件误报为失败。
- `safe_sql`、`safe_deploy` 和 `safe_config_update` 只在网关允许且对应 dry-run/sandbox 环境变量配置后才会调用本地 executor；未配置时返回 `not_configured` 证据，不伪造执行成功。

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
