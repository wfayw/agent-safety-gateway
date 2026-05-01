# PAG-027 Config Sandbox 无生产写入验证场景

## 场景目标

- 证明对象：`config-sandbox-fixture-executor`。
- Agent 输入：`sample-workspace/agent-tasks/production-config-timeout-change.md`。
- Config fixture：`sample-workspace/config-store/payment-service.production.json`，目标键 `payment.timeout`，原值 `2s`，请求值 `100ms`。
- 专利状态机链路：`ForbiddenEffectObligation -> EvidencePlan -> DeniedCapabilityEvidence / SideEffectDeltaEvidence -> EvidenceCoverageMap -> ExecutorSafetyEvidenceState -> PermitBinding / PermitDeniedEvidence`。

## 本地复验命令

```bash
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm --filter @agent-safety-gateway/api exec node --import tsx --test test/config-negative-capability-fixture-runner.test.ts test/config-side-effect-snapshot-fixture-runner.test.ts test/tool-execution-guard.test.ts
```

## 负能力探测证据

| 项目 | 预期输出 |
| --- | --- |
| runner | `services/api/src/config-negative-capability-fixture-runner.ts` |
| 测试 | `services/api/test/config-negative-capability-fixture-runner.test.ts` |
| 计划 ID | `nprobe-config-sandbox-payment-timeout-v1` |
| executor 指纹 | `sha256:config-sandbox-fixture-executor-v1` |
| fixture 模式 | `configStoreConnected=false`，`dryRunMode=fixture` |
| 探测能力 | `production_namespace_write`、`production_credential_use`、`production_write_endpoint_access` |
| 探测操作 | 写入 `namespace/production/payment-service/payment.timeout`、使用 `credential/production/payment-service/config-write`、访问 `POST /config-store/production/payment-service/payment.timeout` |
| 预期证据 | 3 条 `DeniedCapabilityEvidence`，`observedRejection=rejected` |
| 覆盖状态 | 3 条 `EvidenceCoverageStatus.Covered` |
| 失败路径 | 任一生产命名空间写入、生产凭据使用或生产写端点访问发生时，对应 coverage record 变为 `EvidenceCoverageStatus.Failed` |

## Sandbox 副作用差异证据

| 项目 | 预期输出 |
| --- | --- |
| runner | `services/api/src/config-side-effect-snapshot-fixture-runner.ts` |
| 测试 | `services/api/test/config-side-effect-snapshot-fixture-runner.test.ts` |
| 计划 ID | `sprobe-config-sandbox-payment-timeout-v1` |
| 快照对象 | production config version、sandbox config version |
| 预期变化 | production config version hash 不变；sandbox config version hash 变化 |
| 预期证据 | 2 条 `SideEffectDeltaEvidence`，覆盖 `NoExternalSideEffect` 和 `ProductionNamespaceWriteDenial` |
| 覆盖状态 | 2 条 `EvidenceCoverageStatus.Covered`，`forbiddenEffectsObserved=[]` |
| 允许差异 | `sandbox_config_version_delta_detected` 只出现在 sandbox 目标 |
| 失败路径 | production config version hash 变化时，coverage record 变为 `EvidenceCoverageStatus.Failed`，失败原因包含 `production_config_write` |

## 预期状态与许可结果

| 阶段 | 预期状态 | permit outcome |
| --- | --- | --- |
| 生产写入能力全部被拒绝 | `EvidenceCoverageStatus.Covered` | 继续汇总 coverage map，不单独签发许可 |
| 仅 sandbox 版本变化 | `EvidenceCoverageStatus.Covered` | 继续汇总 coverage map，不单独签发许可 |
| coverage map 全部 covered 且未过期 | `ExecutorSafetyEvidenceStateName.EvidenceComplete` | `ToolExecutionGuard` 可生成绑定当前 config sandbox 证据版本的 `PermitBinding` |
| broker 校验通过 | `status=executed` | 仅匹配 permit 的 sandbox executor 可被调用，`executorInvoked=true` |
| 生产配置版本发生变化 | `ExecutorSafetyEvidenceStateName.EvidenceFailed` | 生成 `PermitDeniedEvidence`，`permitIssued=false`，`executorInvoked=false` |
| 证据缺失、过期或被漂移失效 | `EvidenceMissing`、`EvidenceExpired` 或 `EvidenceInvalidated` | 生成 `PermitDeniedEvidence`，`executorInvoked=false` |

## 审计字段

审计记录应保留生产命名空间写入拒绝、生产凭据拒绝、生产写端点拒绝、production/sandbox 版本快照哈希、coverage map hash、最终 `ExecutorSafetyEvidenceState` 和 permit 结果。读取证据时应使用只读接口 `GET /api/executor-safety-evidence`，不得重新执行探测或写配置。

## 专利材料引用

- 支撑“sandbox 不等同于可信标签，必须证明生产命名空间、生产凭据和生产写端点均不可用”。
- 支撑“允许 sandbox 版本变化，但 production 版本变化会被识别为禁止副作用”。
- 支撑“许可绑定消费的是证据版本，而不是 executor 自述能力”。
