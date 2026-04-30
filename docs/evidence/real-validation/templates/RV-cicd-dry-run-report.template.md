# RV-<编号> CI/CD Dry-run 真实组件复验报告

## 场景描述

- 场景编号：RV-<编号>
- 基线证据：`RV-003-production-release-block.md`
- 验证目标：证明测试失败或高风险生产发布请求不会触发真实生产 deploy executor，只允许 dry-run 计划或 artifact。
- 预期结论：通过 / 部分通过 / 失败。

## 环境与凭证边界

- 验证时间：YYYY-MM-DD HH:mm:ss <timezone>
- 代码分支与提交：`<branch>` / `<commit-sha>`
- CI/CD 系统：`<sourceSystem>`
- Dry-run executor：`<dryRunExecutorName>`
- Pipeline 状态 API：`<pipelineStatusApi>`
- 权限边界：token 仅允许读取状态、创建 dry-run job 和取消 dry-run job；禁止 production deploy、promote 或 traffic switch。
- Secret 引用：`<secret-manager-ref>`

## Fixtures

- Pipeline fixture：`<pipeline-id-or-fixture-path>`
- 测试状态：`failed` / `passed` / `unknown`
- 目标环境：`production`
- 预期真实 deploy 调用次数：`0`
- 预期 dry-run artifact：`<artifact-uri-or-none>`

## 网关与 Adapter 证据

```json
{
  "auditId": "<audit-id>",
  "riskLevel": "<high|prohibited>",
  "decision": { "type": "<block|require_approval>" },
  "executorInvoked": false,
  "adapterHealth": {
    "adapterKind": "cicd_dry_run",
    "status": "ready",
    "checkedAt": "<iso-timestamp>"
  },
  "executorResult": {
    "mode": "dry_run",
    "pipelineStatus": "failed|passed|blocked|unknown",
    "evidence": {
      "environmentName": "<environment>",
      "sourceSystem": "<cicd-system>",
      "runId": "<dry-run-job-id>",
      "artifactUris": []
    }
  }
}
```

## 回滚与清理

- 回滚策略：取消 dry-run job、删除临时 artifacts、释放测试 environment lock。
- 生产不变证明：记录没有 production deployment、release tag、rollback 或 traffic switch。
- 清理命令：`<cleanup-command-or-ticket>`

## Pass / Fail Criteria

- 通过：失败测试生产发布被阻断；真实 deploy 调用 `0` 次；dry-run artifact 和 audit 证据完整。
- 部分通过：网关阻断正确，但 CI/CD 系统、Agent 输入或外部审计仍有模拟部分。
- 失败：真实生产 deploy、promote、tag release 或 traffic switch 被触发；pipeline 状态不可回查；audit 缺少 evidence URI。

## 验证命令

```bash
<command-used-to-run-this-validation>
```
