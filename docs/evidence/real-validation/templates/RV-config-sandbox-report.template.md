# RV-<编号> Config Sandbox 真实组件复验报告

## 场景描述

- 场景编号：RV-<编号>
- 基线证据：`RV-004-production-config-sandbox.md`
- 验证目标：证明生产配置变更请求只写入 sandbox/canary namespace，并生成可执行 rollback plan。
- 预期结论：通过 / 部分通过 / 失败。

## 环境与凭证边界

- 验证时间：YYYY-MM-DD HH:mm:ss <timezone>
- 代码分支与提交：`<branch>` / `<commit-sha>`
- 配置中心：`<sourceSystem>`
- Sandbox namespace：`<sandboxNamespace>`
- Canary namespace：`<canaryNamespace>`
- 权限边界：凭证只允许 sandbox/canary 写入；禁止 `production`、`prod` 或真实生产租户写入。
- Secret 引用：`<secret-manager-ref>`

## Fixtures

- 服务与配置 key：`<service>/<config-key>`
- 当前值：`<previousValue-or-hash>`
- 目标值：`<newValue-or-hash>`
- 目标环境：`production`
- 预期 production config executor 调用次数：`0`

## 网关与 Adapter 证据

```json
{
  "auditId": "<audit-id>",
  "riskLevel": "<medium|high|prohibited>",
  "decision": { "type": "sandbox" },
  "executorInvoked": true,
  "adapterHealth": {
    "adapterKind": "config_sandbox",
    "status": "ready",
    "checkedAt": "<iso-timestamp>"
  },
  "executorResult": {
    "mode": "sandbox|canary",
    "targetNamespace": "<non-production-namespace>",
    "rollbackPlan": {},
    "evidence": {
      "environmentName": "<environment>",
      "sourceSystem": "<config-platform>",
      "runId": "<sandbox-run-id>",
      "artifactUris": []
    }
  }
}
```

## 回滚与清理

- 回滚策略：执行 `rollbackPlan` 或删除 sandbox/canary key。
- 生产不变证明：读取 production namespace，确认配置值未变化。
- 清理命令：`<cleanup-command-or-ticket>`

## Pass / Fail Criteria

- 通过：production namespace 调用 `0` 次；sandbox/canary 写入有证据；rollback plan 可执行；production 值不变。
- 部分通过：网关和 sandbox 行为正确，但配置中心、Agent 输入或外部审计仍有模拟部分。
- 失败：写入 production namespace、缺少 rollback plan、namespace 隔离无法证明或 audit 无法关联配置 key。

## 验证命令

```bash
<command-used-to-run-this-validation>
```
