# PAG-027 SQL Readonly 负能力与副作用差异验证场景

## 场景目标

- 证明对象：`sql-readonly-fixture-executor` 和 `sql-dry-run-fixture-executor`。
- Agent 输入：`sample-workspace/agent-tasks/sql-readonly-pending-orders.md`。
- 资源范围：`orders` 表，只读查询 `SELECT id, status FROM orders WHERE status = 'PENDING'`。
- 专利状态机链路：`ForbiddenEffectObligation -> EvidencePlan -> DeniedCapabilityEvidence / SideEffectDeltaEvidence -> EvidenceCoverageMap -> ExecutorSafetyEvidenceState -> PermitBinding`。

## 本地复验命令

```bash
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm --filter @agent-safety-gateway/api exec node --import tsx --test test/sql-negative-capability-fixture-runner.test.ts test/sql-side-effect-snapshot-fixture-runner.test.ts test/tool-execution-guard.test.ts
```

## 负能力探测证据

| 项目 | 预期输出 |
| --- | --- |
| runner | `services/api/src/sql-negative-capability-fixture-runner.ts` |
| 测试 | `services/api/test/sql-negative-capability-fixture-runner.test.ts` |
| 计划 ID | `nprobe-sql-readonly-orders-v1` |
| executor 指纹 | `sha256:sql-readonly-fixture-executor-v1` |
| 探测能力 | `write`、`insert`、`update`、`delete`、`ddl` |
| 探测操作 | `INSERT`、`UPDATE`、`DELETE`、`CREATE TABLE`、`DROP TABLE`、`TRUNCATE TABLE`、`ALTER TABLE` |
| 预期证据 | 7 条 `DeniedCapabilityEvidence`，`observedRejection=rejected` |
| 覆盖状态 | 7 条 `EvidenceCoverageStatus.Covered` |
| 失败路径 | 如果任一危险 SQL 操作被允许，对应 coverage record 变为 `EvidenceCoverageStatus.Failed` |

## 副作用差异证据

| 项目 | 预期输出 |
| --- | --- |
| runner | `services/api/src/sql-side-effect-snapshot-fixture-runner.ts` |
| 测试 | `services/api/test/sql-side-effect-snapshot-fixture-runner.test.ts` |
| 计划 ID | `sprobe-sql-readonly-orders-v1` |
| executor 指纹 | `sha256:sql-dry-run-fixture-executor-v1` |
| fixture 模式 | `databaseConnected=false`，`dryRunMode=fixture` |
| 快照对象 | rows、trigger logs、async job logs |
| 预期证据 | 3 条 `SideEffectDeltaEvidence`，覆盖 `NoRowMutation`、`NoTriggerSideEffect`、`NoExternalSideEffect` |
| 覆盖状态 | 3 条 `EvidenceCoverageStatus.Covered`，`forbiddenEffectsObserved=[]`，`effectDelta=[]` |
| 失败路径 | rows、trigger logs 或 async job logs 变化时，3 条 coverage record 变为 `EvidenceCoverageStatus.Failed` |

## 预期状态与许可结果

| 阶段 | 预期状态 | permit outcome |
| --- | --- | --- |
| 负能力探测全部被拒绝 | `EvidenceCoverageStatus.Covered` | 继续汇总 coverage map，不单独签发许可 |
| 副作用快照无差异 | `EvidenceCoverageStatus.Covered` | 继续汇总 coverage map，不单独签发许可 |
| coverage map 全部 covered 且未过期 | `ExecutorSafetyEvidenceStateName.EvidenceComplete` | `ToolExecutionGuard` 生成 `PermitBinding`，包含 `requestHash`、`executorId`、`safetyEvidenceVersion`、`coverageMapHash`、`deniedEvidenceHash`、`sideEffectEvidenceHash`、`ttl` 和 `nonce` |
| broker 校验通过 | `status=executed` | 仅匹配 `PermitBinding.executorId` 的 executor 可被调用，`executorInvoked=true` |
| 任一探测失败或快照产生禁止副作用 | `ExecutorSafetyEvidenceStateName.EvidenceFailed` | 生成 `PermitDeniedEvidence`，`permitIssued=false`，`executorInvoked=false` |

## 审计字段

审计记录应持久化 `forbiddenEffectObligations`、`coverageMapHash`、`executorSafetyEvidenceState`、`permitBinding` 或 `permitDeniedEvidence`、`permitIssued` 和 `executorInvoked`。这些字段由 `services/api/src/tool-execution-guard.ts` 写入，并可通过 `GET /api/executor-safety-evidence` 读取持久化证据。

## 专利材料引用

- 支撑“readonly 标签不被直接信任，而是通过危险能力被拒绝来证明”。
- 支撑“dry-run 不是普通计划输出，而是对 rows、trigger、async job 进行执行前后差异校验”。
- 支撑“证据未覆盖或失败时 fail closed，不签发真实 executor 调用许可”。
