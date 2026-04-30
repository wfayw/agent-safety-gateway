# RV-<编号> External Audit Sink 真实组件复验报告

## 场景描述

- 场景编号：RV-<编号>
- 基线证据：RV-001 至 RV-005 的请求、决策、executor 和 hook 证据。
- 验证目标：证明外部审计 sink 能追加完整控制链路证据，并可通过外部审计 ID 回查。
- 预期结论：通过 / 部分通过 / 失败。

## 环境与凭证边界

- 验证时间：YYYY-MM-DD HH:mm:ss <timezone>
- 代码分支与提交：`<branch>` / `<commit-sha>`
- 审计平台：`<sinkName>`
- 保留周期：`<retentionDays>` days
- 权限边界：写入凭证为 append-only；查询凭证限定测试租户或测试索引；报告不包含明文 token。
- Secret 引用：`<secret-manager-ref>`

## Fixtures

- 输入证据来源：`<RV-report-or-test-command>`
- 脱敏样例字段：`token`、`password`、`authorization`、`connectionString`
- 预期 sink 状态：`appended`
- 预期 external audit 查询结果：一条完整控制链路记录。

## 网关与 Adapter 证据

```json
{
  "auditId": "<local-audit-id>",
  "adapterHealth": {
    "adapterKind": "audit_sink",
    "status": "ready",
    "checkedAt": "<iso-timestamp>"
  },
  "auditSinkResult": {
    "ok": true,
    "status": "appended",
    "externalAuditId": "<external-audit-id>",
    "evidenceUri": "<evidence-uri>"
  },
  "controlEvidence": {
    "executorInvoked": false,
    "executorResult": null,
    "redactionChecked": true
  }
}
```

## 回滚与清理

- 回滚策略：按测试租户策略删除、过期或标记测试记录；如平台不可删除，记录自动过期时间。
- 保留证明：记录 retention policy、索引名、查询窗口和 artifact lifecycle。
- 清理命令：`<cleanup-command-or-ticket>`

## Pass / Fail Criteria

- 通过：外部审计 ID 可查询；证据包含请求、分析、executor 状态和 adapter evidence；敏感字段已脱敏；retention policy 可证明。
- 部分通过：sink append 成功，但查询、retention、Agent 输入或某个 adapter 仍有模拟部分。
- 失败：外部审计不可查询；敏感字段泄漏；sink 失败但执行路径未 fail-closed；evidence URI 指向错误记录。

## 验证命令

```bash
<command-used-to-run-this-validation>
```
