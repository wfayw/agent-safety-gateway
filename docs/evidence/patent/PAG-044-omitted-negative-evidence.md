# PAG-044 遗漏 Negative Evidence 的 conflict denial 验证场景

## 场景目标

- 证明对象：同推理上下文锚点保留证明状态机。
- Agent 输入：生产配置变更请求，候选工具调用为 `Set payment-service production allowManualCapture=true`。
- 失效条件：冻结窗口 negative evidence 存在于可用上下文目录，但没有进入本次 `PromptAssemblyManifest`。
- 专利状态机链路：`ContextAnchor -> PromptAssemblyManifest -> RequiredContextObligation -> ContextRetentionEvidence -> ContextSufficiencyState -> ContextExecutionDecision`。
- Fixture 输出：`docs/evidence/patent/fixtures/PAG-044-context-retention-scenarios.json` 中的 `PAG-044-C`。

## 本地复验命令

```bash
python3 -m json.tool docs/evidence/patent/fixtures/PAG-044-context-retention-scenarios.json >/tmp/pag044-context-retention-scenarios.json
python3 - <<'PY'
import json
from pathlib import Path
scenario = next(
    item for item in json.loads(Path('docs/evidence/patent/fixtures/PAG-044-context-retention-scenarios.json').read_text())['scenarios']
    if item['id'] == 'PAG-044-C'
)
assert scenario['state']['state'] == 'Conflicting'
assert scenario['decision']['executionDecision']['code'] == 'context.conflicting.deny'
assert scenario['decision']['executionDecision']['type'] == 'block'
assert 'ctx-pag044-negative-freeze-window' in scenario['state']['conflictingAnchorIds']
PY
```

## Manifest 记录

| 字段 | 记录 |
| --- | --- |
| `manifestId` | `manifest-pag044-omitted-negative-evidence` |
| `inferenceId` | `inference-pag044-omitted-negative-evidence` |
| `promptDigest` | `sha256:pag044-omitted-negative-evidence-prompt` |
| 已装配上下文 | 用户配置指令、生产配置 policy、生产配置状态、rollback plan |
| 遗漏反证信息 | `ctx-pag044-negative-freeze-window` |
| token 范围 | instruction `9-22`、policy `23-49`、state `50-76`、rollback `77-105` |

## Obligations 记录

| 字段 | 记录 |
| --- | --- |
| `obligationId` | `rco-pag044-omitted-negative-evidence` |
| `toolCallDigest` | `sha256:pag044-config-production-tool-call` |
| `actionImpactClass` | `production_config_change` |
| `requiredAnchors` | 用户指令、生产配置 policy、生产配置状态、rollback plan、冻结窗口 negative evidence |
| `minimumRetentionMode` | `verbatim` |
| `conflictPolicy` | `deny_on_omitted_conflict` |
| `missingAnchorAction` | `reapproval` |

## Retention Evidence 记录

| Anchor | retentionMode | conflictEvidence | 说明 |
| --- | --- | --- | --- |
| `ctx-pag044-config-user-instruction` | `conflicting` | `ctx-pag044-negative-freeze-window` | 已保留用户写入意图，但遗漏相关冻结窗口反证，导致该写入意图冲突。 |
| `ctx-pag044-config-policy-production` | `conflicting` | `ctx-pag044-negative-freeze-window` | 生产配置 policy 与遗漏反证属于同一资源范围。 |
| `ctx-pag044-config-state-production` | `conflicting` | `ctx-pag044-negative-freeze-window` | 当前生产配置状态不能单独证明可写。 |
| `ctx-pag044-config-rollback-plan` | `conflicting` | `ctx-pag044-negative-freeze-window` | rollback plan 不能覆盖冻结窗口反证。 |
| `ctx-pag044-negative-freeze-window` | `conflicting` | `ctx-pag044-negative-freeze-window` | 反证自身未保留，coverageScore 为 `0`。 |

## State 记录

| 字段 | 结果 |
| --- | --- |
| `state` | `Conflicting` |
| `sufficient` | `false` |
| `coveredAnchorIds` | 空 |
| `missingAnchorIds` | `ctx-pag044-negative-freeze-window` |
| `conflictingAnchorIds` | 用户指令、policy、state、rollback、negative evidence |
| `blockedAnchorIds` | 所有 required anchors |
| `transitionReason` | `one or more required context anchors have conflicting evidence` |

## Decision 记录

| 字段 | 结果 |
| --- | --- |
| `shouldContinueToPermit` | `false` |
| `executionDecision.type` | `block` |
| `executionDecision.code` | `context.conflicting.deny` |
| `contextAction.type` | `deny` |
| `contextAction.nextStep` | `deny_before_executor_safety_check` |
| `contextAction.denialReason` | `one or more required context anchors have conflicting evidence` |
| executor/permit 结果 | 不进入 config executor safety evidence，也不创建 reapproval 绕过冲突。 |

## 专利材料引用

- 支撑“negative evidence 是 required context 的一等公民，遗漏反证会触发冲突而不是简单缺失”。
- 支撑“冲突状态必须 deny before executor safety check，不能通过重新审批覆盖反证遗漏”。
- 支撑“manifest、retention evidence 和 sufficiency state 可解释每个 anchor 为什么被阻断”。
