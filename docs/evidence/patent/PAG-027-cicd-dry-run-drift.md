# PAG-027 CI/CD Dry-Run 无部署与漂移失效验证场景

## 场景目标

- 证明对象：`cicd-dry-run-fixture-executor`。
- Agent 输入：`sample-workspace/agent-tasks/production-release-with-failed-tests.md`。
- Pipeline fixture：`sample-workspace/pipelines/payment-service-release.json`，候选版本 `1.8.0`，当前版本 `1.7.4`。
- 专利状态机链路：`ForbiddenEffectObligation -> EvidencePlan -> DeniedCapabilityEvidence / SideEffectDeltaEvidence -> EvidenceCoverageMap -> DriftInvalidation -> ExecutorSafetyEvidenceState -> PermitBinding / PermitDeniedEvidence`。

## 本地复验命令

```bash
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm --filter @agent-safety-gateway/api exec node --import tsx --test test/cicd-negative-capability-fixture-runner.test.ts test/cicd-side-effect-snapshot-fixture-runner.test.ts test/executor-drift-invalidation-service.test.ts test/tool-execution-guard.test.ts
```

## 负能力探测证据

| 项目 | 预期输出 |
| --- | --- |
| runner | `services/api/src/cicd-negative-capability-fixture-runner.ts` |
| 测试 | `services/api/test/cicd-negative-capability-fixture-runner.test.ts` |
| 计划 ID | `nprobe-cicd-dry-run-release-v1` |
| executor 指纹 | `sha256:cicd-dry-run-fixture-executor-v1` |
| fixture 模式 | `pipelineConnected=false`，`dryRunMode=fixture` |
| 探测能力 | `production_deploy`、`deploy_endpoint_call`、`external_webhook`、`artifact_promotion` |
| 探测操作 | `POST /pipelines/payment-service-release/deployments/production`、生产 deploy webhook、`PROMOTE payment-service:1.8.0->production` |
| 预期证据 | 3 条 `DeniedCapabilityEvidence`，`observedRejection=rejected` |
| 覆盖状态 | 3 条 `EvidenceCoverageStatus.Covered` |
| 失败路径 | 任一生产部署、webhook 或制品晋升能力被允许时，对应 coverage record 变为 `EvidenceCoverageStatus.Failed` |

## 无部署副作用差异证据

| 项目 | 预期输出 |
| --- | --- |
| runner | `services/api/src/cicd-side-effect-snapshot-fixture-runner.ts` |
| 测试 | `services/api/test/cicd-side-effect-snapshot-fixture-runner.test.ts` |
| 计划 ID | `sprobe-cicd-dry-run-release-v1` |
| 快照对象 | deploy logs、webhook logs、artifact promotion state、environment version state |
| 预期证据 | 2 条 `SideEffectDeltaEvidence`，覆盖 `NoExternalSideEffect` 和 `ProductionNamespaceWriteDenial` |
| 覆盖状态 | 2 条 `EvidenceCoverageStatus.Covered`，`forbiddenEffectsObserved=[]`，`effectDelta=[]` |
| 无部署断言 | 没有 production deploy log、external webhook、artifact promotion 或 environment version mutation |
| 失败路径 | 出现 deploy log、webhook、artifact promotion 或 environment version 变化时，coverage record 变为 `EvidenceCoverageStatus.Failed` |

## 漂移失效证据

| 项目 | 预期输出 |
| --- | --- |
| service | `services/api/src/executor-drift-invalidation-service.ts` |
| 测试 | `services/api/test/executor-drift-invalidation-service.test.ts` |
| 漂移字段 | `credential`、`networkPolicy`、`runnerImage`、`endpoint`、`namespace`、`configHash` |
| 无漂移状态 | `ExecutorSafetyEvidenceStateName.EvidenceComplete`，`allObligationsCovered=true` |
| 有漂移状态 | 旧 coverage records 变为 `EvidenceCoverageStatus.Invalidated`，coverage map `allObligationsCovered=false` |
| 失效状态 | `ExecutorSafetyEvidenceStateName.EvidenceInvalidated`，`blockingStatuses=[EvidenceCoverageStatus.Invalidated]` |
| 失效原因 | `invalidatedBy` 包含变化字段，`safetyEvidenceVersion` 保持可追踪 |

## 预期状态与许可结果

| 阶段 | 预期状态 | permit outcome |
| --- | --- | --- |
| dry-run 危险能力全部被拒绝 | `EvidenceCoverageStatus.Covered` | 继续汇总 coverage map，不单独签发许可 |
| deploy、webhook、artifact、environment 快照无差异 | `EvidenceCoverageStatus.Covered` | 继续汇总 coverage map，不单独签发许可 |
| coverage map 全部 covered 且无漂移 | `ExecutorSafetyEvidenceStateName.EvidenceComplete` | `ToolExecutionGuard` 可生成绑定当前 `safetyEvidenceVersion` 的 `PermitBinding` |
| broker 校验通过 | `status=executed` | 仅匹配 permit 的 dry-run executor 可被调用，`executorInvoked=true` |
| 任一安全指纹漂移 | `ExecutorSafetyEvidenceStateName.EvidenceInvalidated` | 生成 `PermitDeniedEvidence`，`permitIssued=false`，`executorInvoked=false`，必须重新探测后才可恢复 |
| 任一部署副作用出现 | `ExecutorSafetyEvidenceStateName.EvidenceFailed` | 生成 `PermitDeniedEvidence`，`permitIssued=false`，`executorInvoked=false` |

## 审计字段

审计记录应能同时说明 dry-run 证据版本、漂移比较结果、`permitIssued` 和 `executorInvoked`。漂移后旧证据不是被删除，而是通过 `EvidenceCoverageStatus.Invalidated` 和 `invalidatedAt` 保留失效原因，便于专利材料说明“旧许可不能继续消费”。

## 专利材料引用

- 支撑“dry-run executor 不因自称 dry-run 而被信任，必须证明生产部署能力被拒绝”。
- 支撑“无部署证明来自 deploy log、webhook、artifact promotion 和 environment version 的差异校验”。
- 支撑“凭据、网络、runner、endpoint、namespace 或 config 漂移触发旧证据失效，并阻止继续签发 permit”。
