# 本地启动与验证 Runbook

本 runbook 固化本地 API、Web、Codex MCP 和 `PreToolUse` hook 的重复验证步骤。默认端口与 Ralph PRD 验证上下文保持一致：API `http://127.0.0.1:4310`，Web `http://127.0.0.1:5173`。

## 前置条件

- Node：API 与 Codex 脚本使用当前 Node 即可；Web dev server 基于 Vite 7，需要 Node `20.19+` 或 `22.12+`。如果本机仍是 Node `18.19.1`，请升级 Node 后运行 `pnpm dev:web`，或使用下方静态 `apps/web/dist` fallback。
- pnpm：仓库声明 `pnpm@10.33.0`。如果 `pnpm` 不在系统 `PATH` 中，可使用本地 Ralph 环境的用户级 fallback：`PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm <script>`。
- 工作目录：所有命令默认从仓库根目录执行。

## API 启动

前台启动方式：

```bash
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm install
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm seed
PATH=/home/wangfei/.local/node_modules/.bin:$PATH API_PORT=4310 API_LOG_LEVEL=info pnpm dev
```

API 健康检查：

```bash
curl -fsS http://127.0.0.1:4310/health
```

如果需要由脚本托管后台进程和 pid 文件：

```bash
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm local:start
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm local:status
```

脚本日志写入 `.local/logs/`，pid 写入 `.local/pids/`。

## Web 启动

Node 满足 Vite 7 要求时，使用 dev server：

```bash
PATH=/home/wangfei/.local/node_modules/.bin:$PATH VITE_API_BASE_URL=http://127.0.0.1:4310 WEB_PORT=5173 pnpm dev:web -- --host 127.0.0.1
```

管理 UI 验证地址：

```text
http://127.0.0.1:5173
```

命令行探测：

```bash
curl -fsS http://127.0.0.1:5173/
```

## 静态服务 fallback

当 Vite dev server 因 Node 版本无法启动时，优先使用 Node `20.19+` 或 `22.12+` 构建静态产物：

```bash
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm build
```

如果当前机器无法完成构建，记录 Node 版本 blocker，不要把未验证的 UI 视为通过。已有 `apps/web/dist` 后，可用 Python 静态服务器绑定管理 UI 端口：

```bash
mkdir -p .local/logs .local/pids
( cd apps/web/dist && python3 -m http.server 5173 --bind 127.0.0.1 ) > .local/logs/codex-asg-web.log 2>&1 &
echo $! > .local/pids/codex-asg-web.pid
curl -fsS http://127.0.0.1:5173/
```

该 fallback 只证明已构建的管理 UI 静态资源可访问；如果需要验证 Vite HMR 或开发中间件行为，仍需升级 Node 后运行 `pnpm dev:web`。

## Codex MCP 与 hook 验证

确认 MCP 注册：

```bash
codex mcp list | grep agent-safety-gateway
```

直接探测 MCP server 工具列表：

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n' \
  | ASG_GATEWAY_URL=http://127.0.0.1:4310 node services/codex/src/mcp-server.mjs \
  | grep 'safe_sql'
```

确认 Codex hooks 已启用且安装了本项目 hook：

```bash
grep -n 'codex_hooks' ~/.codex/config.toml
grep -n 'pretool-hook.mjs' ~/.codex/hooks.json
```

如果需要重新安装集成：

```bash
ASG_GATEWAY_URL=http://127.0.0.1:4310 node services/codex/src/install.mjs
```

## 停止命令

停止由 `scripts/local-start.sh` 托管的后台 API/Web：

```bash
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm local:stop
```

停止手工后台进程：

```bash
kill "$(cat .local/pids/codex-asg-api.pid)" 2>/dev/null || true
kill "$(cat .local/pids/codex-asg-web.pid)" 2>/dev/null || true
rm -f .local/pids/codex-asg-api.pid .local/pids/codex-asg-web.pid
```

前台运行的 `pnpm dev`、`pnpm dev:web` 或 `python3 -m http.server` 可直接按 `Ctrl-C` 停止。

## 文档验证命令

本 story 为文档变更，最小验证命令为：

```bash
grep -R "Node .*20.19" README.md docs/integration/codex-integration.md docs/runbooks/local-startup.md
grep -R "pnpm local:stop" README.md docs/integration/codex-integration.md docs/runbooks/local-startup.md
git diff --check -- README.md docs/integration/codex-integration.md docs/runbooks/local-startup.md
```
