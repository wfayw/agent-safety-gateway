# 真实组件接入说明

本文档用于把 `agent-safety-gateway` 从本地 MVP 推进到真实研发链路。当前目标不是直接连接生产写权限，而是先接入可复验的真实 Agent 输出、SQL 沙箱或 dry-run、CI/CD dry-run、配置中心沙箱和审计平台，证明“executor 调用前控制闭环”在真实组件下仍然成立。

## 接入原则

1. 默认 fail-closed：真实 adapter 未配置、健康检查失败或证据字段缺失时，不调用真实 executor。
2. 禁止直接写生产：SQL、CI/CD、配置中心首轮只允许只读、dry-run、sandbox 或 canary。
3. 证据优先：每次复验必须保存输入、网关响应、executor 调用控制结果、真实组件返回值和审计记录。
4. 不伪造已接入状态：未提供真实组件信息时，只能标注为“本地 MVP 已通过，真实组件待复验”。
5. 保护点聚焦：复验结论围绕 executor 是否被调用，不把页面展示或审批流程作为核心技术效果。

## 需要用户提供的信息

| 组件 | 必要信息 | 验收要求 |
|---|---|---|
| 真实 Agent/Ralph | 输出协议、工具调用 JSON 结构、actor 标识、任务输入、请求 ID 生成规则 | 能将真实 Agent 输出稳定转换为 `ToolCallRequest` |
| SQL 沙箱或 dry-run | 连接名、只读账号、dry-run 能力、测试数据、网络边界 | 高风险写入不接触生产；只读查询可执行并保存行数或执行计划 |
| CI/CD dry-run | pipeline 状态 API、dry-run executor、失败测试 fixture、禁止真实发布的边界 | 测试失败的生产发布请求不会触发真实发布 executor |
| 配置中心沙箱 | sandbox/canary 命名规则、审批 API、回滚策略、配置读取接口 | 生产配置变更不直接写生产命名空间 |
| 审批系统 | 请求创建接口、请求查询接口、审批组、状态枚举、审计回查路径 | `require_approval` 决策先形成 held 审批请求，`approved` 前不调用 executor |
| 审计/日志平台 | 写入接口、查询方式、保留周期、脱敏规则、证据归档位置 | 可用外部审计 ID 回查一次完整控制链路 |

## Adapter 契约

代码层面的真实接入契约位于：

```text
services/api/src/real-component-adapters.ts
```

该文件定义以下 adapter 类型：

- `RealAgentRuntimeAdapter`：将真实 Agent/Ralph 输出转换为 `ToolCallRequest`。
- `SqlDryRunAdapter`：只允许只读或 dry-run SQL executor。
- `CiCdDryRunAdapter`：只允许 CI/CD dry-run executor。
- `ConfigSandboxAdapter`：只允许 sandbox 或 canary 配置 executor。
- `ExternalApprovalAdapter`：为 `require_approval` 决策创建并读取 durable 审批请求。
- `ExternalAuditSinkAdapter`：把请求、分析结果、executor 调用状态、executor 结果和证据包写入外部审计平台。

未配置 adapter 时使用 `createNotConfiguredHealth`、`createNotConfiguredToolExecutor` 或 `createNotConfiguredAgentRuntimeAdapter`，保持 fail-closed，不允许误以为已经接入真实系统。

外部审计 sink 的本地 adapter 位于 `services/api/src/audit-sink-adapter.ts`，用于以 JSONL 形式证明写入契约。`ToolExecutionGuard` 默认会把未配置 sink 记录为 `not_configured`，但不阻断本地分析或已允许的 executor；当调用方启用 `auditSinkStrict` 时，允许执行的路径会在审计 sink 未配置或健康检查不可用时 fail-closed，并保持 `executorInvoked=false`。

## 审计脱敏与保留

审计记录必须在写入本地 JSONL 或外部审计 sink 前完成脱敏。API 默认会替换字段名中包含 `token`、`password`、`passwd`、`secret` 的字段，以及 `authorization`、`connectionString`、`databaseUrl`、`dbUrl`、`dsn` 等认证或连接串字段；如目标组件还使用 `connection`、`privateKey`、`credentialRef` 等组织内字段名，应通过 `ASG_AUDIT_REDACTION_FIELDS` 追加配置。默认替换值为 `[REDACTED]`，可通过 `ASG_AUDIT_REDACTION_REPLACEMENT` 改为组织审计规范要求的占位值。

本地 JSONL 模式用于开发和复验，保留位置由 `API_DATA_DIR` 控制，默认写入 `.data/audits.jsonl`。当前本地模式不自动删除或压缩旧记录；验证环境应使用独立数据目录，并由运行脚本、日志轮转、CI artifact 过期策略或人工清理来满足保留周期。外部审计 sink 模式的保留周期应由审计平台或对象存储生命周期策略执行，并与 `docs/integration/real-component-profile.example.json` 中的 `auditSink.retentionDays` 保持一致。无论采用哪种模式，禁止把未脱敏 token、密码、授权头或连接串作为证据附件上传。

## 推荐接入顺序

1. 接入真实 Agent/Ralph 输出协议，只做 `ToolCallRequest` 转换，不调用任何真实 executor。
2. 接入审批系统请求创建/查询接口，确认 held/approved 状态会进入控制链路。
3. 接入审计平台写入接口，确认审计 ID、脱敏字段和证据归档路径。
4. 接入 SQL 只读或 dry-run，用 RV-001 和 RV-002 复验 executor 调用次数。
5. 接入 CI/CD dry-run，用 RV-003 复验失败测试下的生产发布阻断。
6. 接入配置中心 sandbox/canary，用 RV-004 复验生产配置不被直接写入。
7. 形成真实组件复验报告，并同步更新专利预审研发证明材料。

## RV 复验标准

| 场景 | 输入来源 | 必须证明的 executor 结果 | 结论口径 |
|---|---|---|---|
| RV-001 SQL 删除阻断 | 真实 Agent 输出 + SQL dry-run 环境 | SQL executor 未调用，调用次数 `0` | 通过时可标注“真实 Agent + SQL dry-run 复验通过” |
| RV-002 SQL 只读放行 | 真实 Agent 输出 + 只读 SQL 账号 | SQL executor 调用一次，调用次数 `1` | 通过时可标注“真实只读查询复验通过” |
| RV-003 发布阻断 | 真实 Agent 输出 + CI/CD dry-run | deploy executor 未调用，调用次数 `0` | 通过时可标注“CI/CD dry-run 复验通过” |
| RV-004 配置沙箱 | 真实 Agent 输出 + 配置中心 sandbox | production config executor 未调用；sandbox/canary 路径有证据 | 通过时可标注“配置中心沙箱复验通过” |

## 配置模板

真实组件接入配置模板见：

```text
docs/integration/real-component-profile.example.json
```

该模板不应直接填入密码、token 或生产连接串。敏感信息应通过环境变量、密钥管理系统或运行平台注入。

## 复验报告模板

真实组件复验报告模板见：

```text
docs/evidence/real-validation/templates/RV-real-component-report.template.md
```

每次复验完成后，应复制为具体报告文件，例如：

```text
docs/evidence/real-validation/RV-001-sql-delete-block-real-adapter.md
```

报告中必须明确写出：

- 使用的真实组件名称和环境。
- 是否触达生产写权限。
- `executorInvoked` 的真实值。
- executor 调用次数。
- 外部审计 ID 或日志查询路径。
- 当前结论是“通过”“部分通过”还是“不通过”。
