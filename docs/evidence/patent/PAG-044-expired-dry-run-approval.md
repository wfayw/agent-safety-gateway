# PAG-044 Dry-Run-Only 审批过期的 reapproval 验证场景

## 场景目标

- 证明对象：同推理上下文锚点保留证明状态机。
- Agent 输入：生产发布请求，候选工具调用为 `Deploy payment-service 2.0.0 with requiredExecutionMode=dry_run`。
- 失效条件：dry-run-only 审批锚点已过期或未被 verbatim 装配进本次 manifest。
- 专利状态机链路：`ContextAnchor -> PromptAssemblyManifest -> RequiredContextObligation -> ContextRetentionEvidence -> ContextSufficiencyState -> ContextExecutionDecision`。
- Fixture 输出：`docs/evidence/patent/fixtures/PAG-044-context-retention-scenarios.json` 中的 `PAG-044-B`。

## 本地复验命令

```bash
python3 -m json.tool docs/evidence/patent/fixtures/PAG-044-context-retention-scenarios.json >/tmp/pag044-context-retention-scenarios.json
python3 - <<'PY'
import json
from pathlib import Path
scenario = next(
    item for item in json.loads(Path('docs/evidence/patent/fixtures/PAG-044-context-retention-scenarios.json').read_text())['scenarios']
    if item['id'] == 'PAG-044-B'
)
assert scenario['state']['state'] == 'ReapprovalRequired'
assert scenario['decision']['executionDecision']['code'] == 'context.reapproval_required'
assert scenario['decision']['executionDecision']['type'] == 'require_approval'
assert scenario['decision']['contextAction']['approvalFlowRequired'] is True
PY
```

## Manifest 记录

| 字段 | 记录 |
| --- | --- |
| `manifestId` | `manifest-pag044-expired-dry-run-approval` |
| `inferenceId` | `inference-pag044-expired-dry-run-approval` |
| `promptDigest` | `sha256:pag044-expired-dry-run-approval-prompt` |
| 已装配上下文 | 用户发布指令、测试结果、release policy、pipeline state |
| 缺失上下文 | `ctx-pag044-approval-dry-run-only-payment-release` |
| token 范围 | instruction `11-25`、test `26-43`、policy `44-68`、pipeline `69-92` |

## Obligations 记录

| 字段 | 记录 |
| --- | --- |
| `obligationId` | `rco-pag044-expired-dry-run-approval` |
| `toolCallDigest` | `sha256:pag044-cicd-dry-run-tool-call` |
| `actionImpactClass` | `production_deploy_dry_run` |
| `requiredAnchors` | 最新用户指令、dry-run-only 审批、测试结果、release policy、pipeline state |
| `minimumRetentionMode` | `verbatim` |
| `missingAnchorAction` | `reapproval` |
| `freshnessWindow` | `PT30M` |

## Retention Evidence 记录

| Anchor | retentionMode | coverageScore | freshnessScore | 说明 |
| --- | --- | --- | --- | --- |
| `ctx-pag044-release-user-instruction` | `verbatim` | `1` | `1` | 最新发布指令保留。 |
| `ctx-pag044-approval-dry-run-only-payment-release` | `missing` | `0` | `0` | 审批未进入 manifest，等价于不能证明 dry-run-only 审批仍新鲜有效。 |
| `ctx-pag044-test-result-payment-release` | `verbatim` | `1` | `1` | 测试结果保留。 |
| `ctx-pag044-release-policy-production` | `verbatim` | `1` | `1` | 发布策略保留。 |
| `ctx-pag044-pipeline-state-payment-release` | `verbatim` | `1` | `1` | pipeline 当前状态保留。 |

## State 记录

| 字段 | 结果 |
| --- | --- |
| `state` | `ReapprovalRequired` |
| `sufficient` | `false` |
| `coveredAnchorIds` | 用户指令、测试结果、release policy、pipeline state |
| `missingAnchorIds` | `ctx-pag044-approval-dry-run-only-payment-release` |
| `blockedAnchorIds` | `ctx-pag044-approval-dry-run-only-payment-release` |
| `transitionReason` | `required approval note is missing verbatim retention and policy requires reapproval` |

## Decision 记录

| 字段 | 结果 |
| --- | --- |
| `shouldContinueToPermit` | `false` |
| `executionDecision.type` | `require_approval` |
| `executionDecision.code` | `context.reapproval_required` |
| `contextAction.type` | `reapproval` |
| `contextAction.nextStep` | `request_reapproval_before_regeneration` |
| `contextAction.approvalFlowRequired` | `true` |
| executor/permit 结果 | 不进入 CI/CD dry-run executor，也不使用旧审批签发许可。 |

## 专利材料引用

- 支撑“dry-run-only 审批必须被 verbatim 保留，不能用普通摘要或历史审批替代”。
- 支撑“审批锚点过期或缺失时转入 reapproval，而不是直接 deny 或直接执行”。
- 支撑“重新审批后的审批 note 必须回到同一推理上下文并重新生成工具调用”。
