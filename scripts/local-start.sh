#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-4310}"
WEB_PORT="${WEB_PORT:-5173}"
API_URL="${API_URL:-http://127.0.0.1:${API_PORT}}"
WEB_URL="${WEB_URL:-http://127.0.0.1:${WEB_PORT}}"
STATE_DIR="$ROOT_DIR/.local"
LOG_DIR="$STATE_DIR/logs"
PID_DIR="$STATE_DIR/pids"
EVIDENCE_DIR="$ROOT_DIR/docs/evidence/local-start"

INSTALL=1
VERIFY_ONLY=0
STOP_ONLY=0
STATUS_ONLY=0
RUN_FUNCTIONAL_CHECKS=1

usage() {
  cat <<'EOF'
用法：
  bash scripts/local-start.sh [选项]

选项：
  --no-install         跳过 pnpm install
  --verify-only        只执行当前可用验证，不启动服务
  --no-functional      跳过 API 场景验证
  --status             查看本地服务状态
  --stop               停止由本脚本启动的本地服务
  -h, --help           显示帮助

环境变量：
  API_PORT             API 首选端口，默认 4310
  WEB_PORT             Web 首选端口，默认 5173
  API_URL              API 地址，默认 http://127.0.0.1:${API_PORT}
  WEB_URL              Web 地址，默认 http://127.0.0.1:${WEB_PORT}

说明：
  当前仓库如果还没有 services/api 或 apps/web，本脚本会进入骨架验证模式。
  后续 API/Web 包落地后，同一个脚本会执行 seed、启动服务、探活并输出验证证据路径。
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-install)
      INSTALL=0
      shift
      ;;
    --verify-only)
      VERIFY_ONLY=1
      shift
      ;;
    --no-functional)
      RUN_FUNCTIONAL_CHECKS=0
      shift
      ;;
    --status)
      STATUS_ONLY=1
      shift
      ;;
    --stop)
      STOP_ONLY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数：$1" >&2
      usage
      exit 2
      ;;
  esac
done

log() {
  printf '[local-start] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令：$1" >&2
    exit 1
  fi
}

package_has_script() {
  local package_json="$1"
  local script_name="$2"
  node - "$package_json" "$script_name" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const script = process.argv[3];
if (!fs.existsSync(file)) process.exit(1);
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
process.exit(pkg.scripts && pkg.scripts[script] ? 0 : 1);
NODE
}

package_name_is() {
  local package_json="$1"
  local package_name="$2"
  node - "$package_json" "$package_name" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const expected = process.argv[3];
if (!fs.existsSync(file)) process.exit(1);
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
process.exit(pkg.name === expected ? 0 : 1);
NODE
}

pid_alive() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] || return 1
  local pid
  pid="$(cat "$pid_file")"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" >/dev/null 2>&1
}

stop_process() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"
  if ! pid_alive "$pid_file"; then
    rm -f "$pid_file"
    log "$name 未运行"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  log "停止 $name pid=$pid"
  kill "$pid" >/dev/null 2>&1 || true
  for _ in {1..20}; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      rm -f "$pid_file"
      return
    fi
    sleep 0.2
  done
  kill -9 "$pid" >/dev/null 2>&1 || true
  rm -f "$pid_file"
}

show_status() {
  mkdir -p "$PID_DIR"
  for name in api web; do
    local pid_file="$PID_DIR/$name.pid"
    if pid_alive "$pid_file"; then
      log "$name 运行中 pid=$(cat "$pid_file")"
    else
      log "$name 未运行"
    fi
  done
  log "API_URL=$API_URL"
  log "WEB_URL=$WEB_URL"
}

wait_for_http() {
  local name="$1"
  local url="$2"
  local attempts="${3:-40}"

  if ! command -v curl >/dev/null 2>&1; then
    log "未安装 curl，跳过 $name 探活：$url"
    return 0
  fi

  for i in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$name 已就绪：$url"
      return 0
    fi
    sleep 0.5
  done

  log "$name 探活超时：$url"
  return 1
}

run_available_checks() {
  log "执行当前可用验证"
  pnpm typecheck
  pnpm build
  pnpm test
}

run_seed_if_available() {
  if package_name_is "$ROOT_DIR/services/api/package.json" '@agent-safety-gateway/api'; then
    if package_has_script "$ROOT_DIR/services/api/package.json" seed; then
      log "执行 API seed"
      pnpm --filter @agent-safety-gateway/api seed
    else
      log "API 包没有 seed 脚本，跳过 seed"
    fi
  elif package_has_script "$ROOT_DIR/package.json" seed; then
    log "API 包尚未实现，执行根 seed 占位命令"
    pnpm seed
  fi
}

start_package() {
  local name="$1"
  local filter="$2"
  local package_json="$3"
  local log_file="$LOG_DIR/$name.log"
  local pid_file="$PID_DIR/$name.pid"

  if ! package_has_script "$package_json" dev; then
    log "$name 包没有 dev 脚本，跳过启动"
    return 1
  fi

  if pid_alive "$pid_file"; then
    log "$name 已在运行 pid=$(cat "$pid_file")"
    return 0
  fi

  log "启动 $name，日志：$log_file"
  (
    cd "$ROOT_DIR"
    if [[ "$name" == "api" ]]; then
      API_PORT="$API_PORT" pnpm --filter "$filter" dev
    else
      WEB_PORT="$WEB_PORT" pnpm --filter "$filter" dev -- --host 0.0.0.0
    fi
  ) >"$log_file" 2>&1 &
  echo "$!" > "$pid_file"
}

write_json() {
  local file="$1"
  local content="$2"
  printf '%s\n' "$content" > "$file"
}

post_json() {
  local name="$1"
  local payload_file="$2"
  local output_file="$3"

  if ! command -v curl >/dev/null 2>&1; then
    log "未安装 curl，跳过 $name 场景"
    return 0
  fi

  local status
  status="$(
    curl -sS -o "$output_file" -w '%{http_code}' \
      -H 'content-type: application/json' \
      --data-binary "@$payload_file" \
      "$API_URL/api/tool-calls/analyze" || true
  )"
  log "$name HTTP $status -> $output_file"

  if [[ "$status" == "000" || "$status" == "404" ]]; then
    log "$name 场景接口尚不可用，保留 payload 作为后续验证输入"
    return 0
  fi

  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    return 1
  fi
}

run_functional_checks() {
  mkdir -p "$EVIDENCE_DIR"
  local timestamp
  timestamp="$(date +%Y%m%d-%H%M%S)"
  local run_dir="$EVIDENCE_DIR/$timestamp"
  mkdir -p "$run_dir"

  log "生成本地功能验证证据：$run_dir"

  write_json "$run_dir/rv-001-sql-delete.payload.json" '{
  "id": "rv-001-manual",
  "actor": "agent-dev",
  "taskPurpose": "清理生产环境中状态为 PENDING 的订单",
  "toolType": "sql",
  "environment": "production",
  "rawPayload": {
    "sql": "DELETE FROM orders WHERE status='"'"'PENDING'"'"'"
  },
  "createdAt": "2026-04-28T00:00:00.000Z"
}'

  write_json "$run_dir/rv-002-sql-readonly.payload.json" '{
  "id": "rv-002-manual",
  "actor": "agent-dev",
  "taskPurpose": "统计生产环境中 PENDING 订单数量",
  "toolType": "sql",
  "environment": "production",
  "rawPayload": {
    "sql": "SELECT COUNT(*) FROM orders WHERE status='"'"'PENDING'"'"'"
  },
  "createdAt": "2026-04-28T00:00:00.000Z"
}'

  write_json "$run_dir/rv-003-deploy.payload.json" '{
  "id": "rv-003-manual",
  "actor": "agent-dev",
  "taskPurpose": "将 payment-service v1.8.0 发布到 production",
  "toolType": "ci_cd",
  "environment": "production",
  "rawPayload": {
    "service": "payment-service",
    "version": "1.8.0",
    "stage": "deploy",
    "testStatus": "failed"
  },
  "createdAt": "2026-04-28T00:00:00.000Z"
}'

  write_json "$run_dir/rv-004-config.payload.json" '{
  "id": "rv-004-manual",
  "actor": "agent-dev",
  "taskPurpose": "将 payment-service 的 payment.timeout 调整为 100ms",
  "toolType": "config",
  "environment": "production",
  "rawPayload": {
    "service": "payment-service",
    "key": "payment.timeout",
    "value": "100ms"
  },
  "createdAt": "2026-04-28T00:00:00.000Z"
}'

  post_json "RV-001 高风险 SQL 删除" "$run_dir/rv-001-sql-delete.payload.json" "$run_dir/rv-001-sql-delete.response.json"
  post_json "RV-002 低风险 SQL 查询" "$run_dir/rv-002-sql-readonly.payload.json" "$run_dir/rv-002-sql-readonly.response.json"
  post_json "RV-003 测试失败生产发布" "$run_dir/rv-003-deploy.payload.json" "$run_dir/rv-003-deploy.response.json"
  post_json "RV-004 生产关键配置变更" "$run_dir/rv-004-config.payload.json" "$run_dir/rv-004-config.response.json"

  cat > "$run_dir/README.md" <<EOF
# 本地功能验证记录

- 时间：$(date)
- API：$API_URL
- Web：$WEB_URL

## 当前结论

本目录保存本次手工验证 payload 和 API response。

如果 response 文件显示 404 或接口不可用，说明当前系统仍处于骨架阶段，待 services/api 实现后重新运行：

\`\`\`bash
bash scripts/local-start.sh --no-install
\`\`\`

## 期望

- RV-001：高风险 SQL 删除应阻断，executor 调用次数为 0。
- RV-002：低风险 SQL 查询应允许或 readonly，executor 调用次数为 1。
- RV-003：测试失败生产发布应阻断，deploy executor 调用次数为 0。
- RV-004：生产关键配置变更应 sandbox 或 require_approval。
EOF
}

main() {
  require_cmd node
  require_cmd pnpm

  mkdir -p "$LOG_DIR" "$PID_DIR" "$EVIDENCE_DIR"

  cd "$ROOT_DIR"

  if [[ "$STOP_ONLY" == "1" ]]; then
    stop_process api
    stop_process web
    exit 0
  fi

  if [[ "$STATUS_ONLY" == "1" ]]; then
    show_status
    exit 0
  fi

  log "项目目录：$ROOT_DIR"

  if [[ "$INSTALL" == "1" ]]; then
    log "安装依赖"
    pnpm install
  fi

  run_available_checks

  if [[ "$VERIFY_ONLY" == "1" ]]; then
    log "verify-only 完成"
    exit 0
  fi

  local has_api=0
  local has_web=0
  package_name_is "$ROOT_DIR/services/api/package.json" '@agent-safety-gateway/api' && has_api=1 || true
  package_name_is "$ROOT_DIR/apps/web/package.json" '@agent-safety-gateway/web' && has_web=1 || true

  if [[ "$has_api" != "1" && "$has_web" != "1" ]]; then
    log "API/Web 包尚未实现，当前只能完成骨架验证。"
    log "后续 Ralph 完成 services/api 和 apps/web 后，重新运行本脚本即可启动实际系统。"
    exit 0
  fi

  run_seed_if_available

  if [[ "$has_api" == "1" ]]; then
    start_package api '@agent-safety-gateway/api' "$ROOT_DIR/services/api/package.json" || true
    wait_for_http API "$API_URL/health" || true
  else
    log "未发现 @agent-safety-gateway/api，跳过 API 启动"
  fi

  if [[ "$has_web" == "1" ]]; then
    start_package web '@agent-safety-gateway/web' "$ROOT_DIR/apps/web/package.json" || true
    wait_for_http Web "$WEB_URL" || true
  else
    log "未发现 @agent-safety-gateway/web，跳过 Web 启动"
  fi

  if [[ "$RUN_FUNCTIONAL_CHECKS" == "1" && "$has_api" == "1" ]]; then
    run_functional_checks || true
  fi

  show_status
  log "手工访问 Web：$WEB_URL"
  log "API 健康检查：$API_URL/health"
  log "停止服务：bash scripts/local-start.sh --stop"
}

main "$@"
