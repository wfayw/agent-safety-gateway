# Agent Safety Gateway 企业生产级与专利强化 PRD

## 1. 结论

`agent-safety-gateway` 目前不是“全部功能都完善”的状态。它已经具备一个可演示、可测试的 MVP 闭环：能把 Agent/Codex 的部分工具调用转换为 `ToolCallRequest`，进行风险分析，输出 `allow/block/sandbox/require_approval/rewrite` 等执行决策，并通过 Codex MCP 与 PreToolUse hook 做本地拦截演示。

但它距离“真实企业生产级”仍有明显差距，主要缺口在：

- 强制执行边界不完整：Codex hook/MCP 已接入，但真实凭据隔离、所有执行路径强制走网关、不可绕过控制还没有系统化落地。
- 真实组件接入不足：数据库、CI/CD、配置中心、审批、审计平台仍主要是 mock、fixture 或配置契约。
- 管理端证据不完整：能看到 gateway audit，但还不能完整看到 hook 本地阻断、executor 调用次数、dry-run 结果、审批流状态和外部审计 ID。
- 企业治理能力不足：缺少策略版本、策略发布审批、租户/项目隔离、RBAC、密钥管理、告警、SLO、审计留存与合规脱敏。
- 专利证据链不足：已有技术方案雏形，但还需要对比现有 guardrail/approval/sandbox 方案，补充真实组件复验、技术效果指标和权利要求映射材料。

## 2. 专利申请应特别加强的方向

专利材料不应只强调“拦截 Agent 操作”这个泛概念。更有价值的保护点应聚焦以下技术组合：

1. 将异构 Agent 工具调用统一归一化为 `ToolCallRequest` / `ActionTuple`。
2. 基于资源目录、依赖图和环境元数据计算直接影响与间接影响路径。
3. 结合操作类型、环境、资源关键性、依赖影响、验证状态、可回滚性、凭据边界、审批状态生成风险因子。
4. 在 executor 之前以 fail-closed 方式控制执行，并把决策直接绑定到 executor 是否可被调用。
5. 对高风险请求生成安全改写、dry-run、sandbox/canary 或审批建议，并保留可回放证据。
6. 将 Agent 输出、网关决策、executor 未调用证明、真实组件返回、审计 ID 形成不可篡改证据链。

专利强化的核心不是 UI，也不是普通审批流程，而是“执行前技术控制闭环 + 资源依赖影响分析 + 可证明 executor 控制结果”。

## 3. 企业生产级目标

目标是把当前 MVP 推进为企业内可接入真实研发链路的安全网关：

- 真实 Agent/Codex/Ralph 输出必须稳定转成 `ToolCallRequest`。
- SQL、CI/CD、配置中心、脚本执行、云资源操作等高危工具必须通过网关控制。
- 默认 fail-closed，真实 adapter 未配置、健康检查失败、证据缺失时不允许调用真实 executor。
- 首轮真实接入只允许 readonly、dry-run、sandbox、canary 或审批，不直接写生产。
- 所有控制动作保留审计、执行日志、外部证据 URI、策略版本、风险因子和回放视图。
- 管理端能查看拦截、放行、审批、沙箱、改写、executor 调用次数和真实组件复验状态。

## 4. 非目标

- 不在首轮实现完整通用 Agent 平台。
- 不在首轮直接授予生产写权限。
- 不把 mock executor 结果包装成真实生产验证结果。
- 不以 UI 美化替代核心执行控制、证据链和真实组件复验。

## 5. 里程碑

### M1：强制执行边界

- 服务端 guarded execution API。
- Codex hook 决策持久化。
- 执行日志和 hook 决策只读 API。
- MCP 协议测试和 fail-closed 行为验证。

### M2：真实 dry-run 与沙箱接入

- SQL readonly/dry-run adapter。
- CI/CD dry-run adapter。
- 配置中心 sandbox/canary adapter。
- 审批 adapter。
- 外部审计 sink adapter。

### M3：策略治理和风险模型增强

- 策略 DSL / JSON 版本化。
- 策略模拟、发布审批与回滚。
- SQL destructive parser 扩展。
- 资源目录同步和依赖图增量更新。

### M4：企业安全、合规和可观测

- RBAC、token/API auth、CORS 加固。
- 密钥管理与凭据隔离。
- 审计留存、脱敏、导出。
- 指标、告警、SLO、健康检查。

### M5：专利和真实验证材料

- Codex 接入证据报告。
- 真实组件 RV 报告。
- 现有技术对比矩阵。
- 权利要求映射表。
- 可量化技术效果报告。

## 6. Ralph 任务拆解原则

- 每个 story 必须一轮 Ralph 可完成。
- 优先级从强制边界、真实组件、安全治理到专利证据。
- 每个 story 都有可验证验收标准。
- UI story 必须包含浏览器验证。
- 所有真实组件 story 必须保持 fail-closed，不可直接写生产。

完整 Ralph 拆解归档见 `docs/prd/ralph-runs/2026-04-30-agent-safety-gateway-hardening/prd.json`。
