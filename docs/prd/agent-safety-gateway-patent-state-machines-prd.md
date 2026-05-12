# Agent Safety Gateway 双专利状态机生产化 PRD

> 日期：2026-05-01
> 目标仓库：`/home/wangfei/workspace/ralph-loop/agent-safety-gateway`
> 对应 Ralph 任务归档：`docs/prd/ralph-runs/2026-05-01-agent-safety-gateway-patent-state-machines/prd.json`
> 依据专利文档：
> - `docs/patent/交底书-禁止副作用义务证明状态机.md`
> - `docs/patent/交底书-同推理上下文锚点保留证明.md`

## 1. 背景

`agent-safety-gateway` 已具备 agent 工具调用前风险分析、资源影响解析、执行决策、审计记录、Codex 接入、管理端展示和若干真实验证场景。

下一阶段不再只做“工具调用前 guardrail”，而是把两个专利方向落到真实工程闭环：

1. **禁止副作用义务证明状态机**：证明 executor 不会产生本次调用中被禁止的副作用，证据完整后才签发执行许可。
2. **同推理上下文锚点保留证明**：证明 agent 生成高风险 tool call 的同一次模型推理中实际保留了必要上下文，充分后才允许进入执行器安全证明。

## 2. 产品目标

### 2.1 禁止副作用义务证明状态机

把执行器安全从“声明可信”改为“证据覆盖后才可信”：

```text
RequiredExecutionMode
-> ForbiddenEffectObligation
-> EvidencePlan
-> NegativeProbeEvidence / SideEffectDeltaEvidence
-> EvidenceCoverageMap
-> ExecutorSafetyEvidenceState
-> DriftInvalidation
-> PermitBinding / PermitDeniedEvidence
```

核心要求：

- 不相信 executor 自称 readonly / dry-run / sandbox。
- 每个禁止副作用义务都必须被证据覆盖。
- 证据缺失、过期或漂移时 fail closed。
- 真实 executor 只能在 permit 绑定有效证据版本后被调用。
- 审计必须证明 `permitIssued` 和 `executorInvoked` 的真实状态。

### 2.2 同推理上下文锚点保留证明

把 agent 决策安全从“历史上出现过上下文”改为“生成本次 tool call 时实际可见”：

```text
ToolCallCandidate
-> RequiredContextObligation
-> PromptAssemblyManifest
-> ContextRetentionEvidence
-> ContextSufficiencyState
-> PermitDecision
```

核心要求：

- 对每个高风险 tool call 生成动作相关上下文锚点义务。
- `PromptAssemblyManifest` 必须绑定到生成该 tool call 的同一次推理。
- 逐锚点判断原文保留、认证摘要、缺失、过期、冲突和污染。
- 上下文不足时触发重新 grounding、重新审批、降级或拒绝。
- 审计必须证明 agent 生成该 tool call 时看到了什么，没看到什么。

## 3. 非目标

- 不重新做通用 agent 平台。
- 不把专利点写成普通 approval、broker、capability token、MCP server 或 attestation。
- 不接入真实生产数据库、真实生产 CI/CD 或真实生产配置中心。
- 不在一个 story 内完成多个状态机模块。
- 不伪造 executor 成功；未配置真实 executor 时必须 held / not_configured / denied。

## 4. 用户角色

- **平台安全工程师**：配置 executor 证据、查看漂移和许可状态。
- **企业审计人员**：导出证明材料，确认 `executorInvoked=false` 或 permit 绑定证据。
- **Agent 平台集成者**：把 tool call、prompt manifest 和上下文锚点送入 gateway。
- **专利/合规负责人**：需要可复现实验和 claim mapping。

## 5. 总体验收标准

1. 两个状态机都具备共享领域模型、服务层、持久化、API、UI 和测试。
2. SQL、CI/CD、config 三类高风险场景都有证据样例。
3. 任一义务证据缺失、过期或漂移时，不签发许可且不调用 executor。
4. 同推理上下文不足时，不进入真实执行器调用。
5. 组合链路顺序固定为：上下文证明通过后，才进入禁止副作用证明。
6. 管理端能看到 context evidence、forbidden-effect evidence、permit 状态和拒绝原因。
7. 文档能直接支撑两篇交底书的工程实施例。

## 6. Ralph 任务拆分

任务已拆入 Ralph 任务归档 `docs/prd/ralph-runs/2026-05-01-agent-safety-gateway-patent-state-machines/prd.json`，粒度按“一个模型 / 一个编译器 / 一个 runner / 一个状态机 / 一个 API / 一个 UI / 一个证据场景”拆分。

### 6.1 禁止副作用义务证明状态机

`PAG-001` 到 `PAG-027`：

- 共享类型和 schema。
- 禁止副作用义务、证据计划、负能力证据、副作用差异证据。
- 证据覆盖图、执行器安全证据状态机、漂移失效。
- SQL / CI/CD / config 三类 obligation compiler、probe、snapshot。
- permit gate、broker fail-closed、审计、API、UI、证据场景。

### 6.2 同推理上下文锚点保留证明

`PAG-028` 到 `PAG-044`：

- ContextAnchor、PromptAssemblyManifest、RequiredContextObligation。
- 同推理 manifest capture。
- SQL / CI/CD / config 三类上下文义务编译器。
- ContextRetentionEvidence matcher、认证摘要/引用校验、freshness/conflict/taint。
- ContextSufficiencyState、reground/reapproval/deny、审计、API、UI、证据场景。

### 6.3 组合链路和专利证据

`PAG-045` 到 `PAG-050`：

- 上下文证明和禁止副作用证明的统一前置执行链路。
- SQL、CI/CD、config 端到端证据。
- 专利证据包、claim mapping、runbook。

## 7. 建议执行命令

每次跑一个最小任务：

```bash
cd /home/wangfei/workspace/ralph-loop
RALPH_REPO_ROOT=/home/wangfei/workspace/ralph-loop/agent-safety-gateway make ralph-run MAX_ITERATIONS=1
```

验证 Ralph 接线：

```bash
cd /home/wangfei/workspace/ralph-loop
RALPH_REPO_ROOT=/home/wangfei/workspace/ralph-loop/agent-safety-gateway make ralph-validate
```

目标仓库常用验证：

```bash
cd /home/wangfei/workspace/ralph-loop/agent-safety-gateway
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm --filter @agent-safety-gateway/api typecheck
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm --filter @agent-safety-gateway/api test
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm --filter @agent-safety-gateway/web typecheck
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm --filter @agent-safety-gateway/web test
```
