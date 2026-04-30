# RV-<编号> External Approval 真实组件复验报告

## 场景描述

- 场景编号：RV-<编号>
- 基线证据：`require_approval` 决策与 `ToolExecutionGuard` durable hold 行为。
- 验证目标：证明审批系统能持久化 held 请求，并且在批准前不会调用 executor。
- 预期结论：通过 / 部分通过 / 失败。

## 环境与凭证边界

- 验证时间：YYYY-MM-DD HH:mm:ss <timezone>
- 代码分支与提交：`<branch>` / `<commit-sha>`
- 审批系统：`<approvalSystemName>`
- 审批组：`<defaultApproverGroup>`
- 权限边界：网关身份只能创建和查询审批；批准、拒绝由独立测试审批身份执行；禁止真实生产审批身份。
- Secret 引用：`<secret-manager-ref>`

## Fixtures

- 请求输入：`<tool-call-request-or-task-path>`
- 预期风险等级：`medium` / `high`
- 预期决策：`require_approval`
- 覆盖状态：`held`、`approved`、`rejected`、`expired`
- 预期 held/rejected/expired executor 调用次数：`0`

## 网关与 Adapter 证据

```json
{
  "auditId": "<audit-id>",
  "riskLevel": "<medium|high>",
  "decision": { "type": "require_approval" },
  "executorInvoked": false,
  "adapterHealth": {
    "adapterKind": "approval",
    "status": "ready",
    "checkedAt": "<iso-timestamp>"
  },
  "approvalRequest": {
    "requestId": "<approval-request-id>",
    "auditId": "<audit-id>",
    "approverGroup": "<group>",
    "status": "held|approved|rejected|expired",
    "createdAt": "<iso-timestamp>"
  }
}
```

## 回滚与清理

- 回滚策略：关闭、拒绝或过期测试审批单；删除测试附件。
- Executor 不变证明：held、rejected 和 expired 状态下 execution log 调用次数保持 `0`。
- 清理命令：`<cleanup-command-or-ticket>`

## Pass / Fail Criteria

- 通过：审批请求可创建和查询；held 阶段不调用 executor；approved 后才允许继续；rejected/expired 保持阻断且可审计。
- 部分通过：durable hold 正确，但审批系统、Agent 输入或外部审计仍有模拟部分。
- 失败：审批创建前调用 executor；网关身份可自我批准；审批状态不可回查；approval request ID 无法关联 audit ID。

## 验证命令

```bash
<command-used-to-run-this-validation>
```
