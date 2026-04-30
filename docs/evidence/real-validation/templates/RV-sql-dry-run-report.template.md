# RV-<编号> SQL Dry-run 真实组件复验报告

## 场景描述

- 场景编号：RV-<编号>
- 基线证据：`RV-001-sql-delete-block.md` / `RV-002-sql-readonly-allow.md`
- 验证目标：证明真实 SQL dry-run 或只读 executor 在网关决策后才被调用，且第一阶段不具备生产写权限。
- 预期结论：通过 / 部分通过 / 失败。

## 环境与凭证边界

- 验证时间：YYYY-MM-DD HH:mm:ss <timezone>
- 代码分支与提交：`<branch>` / `<commit-sha>`
- SQL 环境名称：`<environmentName>`
- 连接名：只读 `<readOnlyConnectionName>`；dry-run `<dryRunConnectionName>`
- 权限边界：说明账号仅具备 `SELECT` 或 dry-run 权限，且 `productionWriteNetworkBlocked=true`。
- Secret 引用：`<secret-manager-ref>`，禁止粘贴明文密码、token 或连接串。

## Fixtures

- 输入任务：`<agent-task-path-or-command>`
- SQL 文本或 hash：`<redacted-sql-or-hash>`
- 数据 fixture：`<schema-or-snapshot-id>`
- 预期 executor 调用次数：`0` / `1`

## 网关与 Adapter 证据

```json
{
  "auditId": "<audit-id>",
  "riskLevel": "<low|medium|high|prohibited>",
  "decision": { "type": "<allow|block|require_approval|sandbox|rewrite>" },
  "executorInvoked": false,
  "adapterHealth": {
    "adapterKind": "sql_dry_run",
    "status": "ready",
    "checkedAt": "<iso-timestamp>"
  },
  "executorResult": {
    "mode": "readonly|dry_run",
    "rowCount": null,
    "explainPlan": {},
    "evidence": {
      "environmentName": "<environment>",
      "sourceSystem": "<sql-platform>",
      "runId": "<run-id>",
      "artifactUris": []
    }
  }
}
```

## 回滚与清理

- 回滚策略：销毁临时 schema、恢复快照或清理 dry-run artifacts。
- 生产不变证明：记录生产写权限缺失、网络阻断或只读账号权限查询结果。
- 清理命令：`<cleanup-command-or-ticket>`

## Pass / Fail Criteria

- 通过：阻断场景 executor 调用 `0` 次；只读场景 executor 调用 `1` 次；无生产写权限；audit 和 external audit sink 均可回查。
- 部分通过：核心决策正确，但 SQL 环境、Agent 输入、外部审计或 UI 仍有 mock/stub/simulated 部分。
- 失败：高风险写入到达可写生产端点、调用次数错误、缺少 `executorInvoked` 证据或凭证边界无法证明。

## 验证命令

```bash
<command-used-to-run-this-validation>
```
