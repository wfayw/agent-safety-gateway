# 真实验证报告模板

本目录用于保存智能体执行安全网关的真实验证报告。每个 RV 场景应复制下方模板并保存为独立 Markdown 文件，例如 `RV-001-sql-delete-block.md`。

## 报告命名

- 文件名格式：`RV-<编号>-<场景短名>.md`
- 报告中的场景编号必须与样例任务、审计记录和验证脚本输出保持一致。
- 使用 mock executor、mock Agent、mock CI/CD、mock 配置中心或本地样例数据时，必须在报告中明确标记“需要真实组件复验”。

## 真实组件验证计划

- 第一阶段真实组件验证计划：`docs/evidence/real-validation/real-component-validation-plan.md`
- 通用报告模板：`docs/evidence/real-validation/templates/RV-real-component-report.template.md`
- SQL dry-run 模板：`docs/evidence/real-validation/templates/RV-sql-dry-run-report.template.md`
- CI/CD dry-run 模板：`docs/evidence/real-validation/templates/RV-cicd-dry-run-report.template.md`
- 配置沙箱模板：`docs/evidence/real-validation/templates/RV-config-sandbox-report.template.md`
- 审批系统模板：`docs/evidence/real-validation/templates/RV-approval-report.template.md`
- 外部审计 sink 模板：`docs/evidence/real-validation/templates/RV-external-audit-sink-report.template.md`

## 结论定义

- 通过：场景按验证步骤完成，网关响应、executor 日志、审计记录和预期控制结果完全一致。
- 部分通过：核心控制结果符合预期，但仍存在 mock 组件、证据不完整、人工复核或真实组件复验缺口。
- 失败：网关决策、executor 调用结果、审计记录或验证步骤任一关键项与预期不一致。

## 模板

````markdown
# RV-<编号> <场景名称> 真实验证报告

## 场景描述

- 场景编号：RV-<编号>
- 验证目标：说明本场景要证明的安全网关控制效果。
- 风险链路：说明 Agent 意图、工具调用、受影响资源和潜在事故。
- 预期结论：通过 / 部分通过 / 失败。

## 验证环境

- 验证时间：YYYY-MM-DD HH:mm:ss <timezone>
- 代码分支：`<branch>`
- 提交版本：`<commit-sha>`
- 本地服务：记录 API、Web、脚本或测试命令。
- 组件真实性：标记 Agent、executor、数据源、CI/CD、配置中心是真实组件还是 mock 组件。
- 真实组件复验：如使用 mock 组件，列出需要用户提供的真实研发环境或沙箱。

## Agent 任务输入

记录 Agent 接收的自然语言任务、样例文件路径或完整输入内容。

## Agent 输出

记录 Agent 生成的工具调用意图、关键推理摘要或 adapter 输出。避免补写未实际产生的内容。

## ToolCallRequest

```json
{
  "id": "<request-id>",
  "toolType": "<tool-type>",
  "environment": "<environment>",
  "rawPayload": {}
}
````

## 安全网关响应

```json
{
  "auditId": "<audit-id>",
  "riskLevel": "<risk-level>",
  "policyVersion": "<policy-version>",
  "policyTrace": {
    "thresholds": {},
    "weights": {},
    "hardRules": [],
    "matchedRuleIds": [],
    "weightedFactors": []
  },
  "decision": {
    "type": "<allow|sandbox|require_approval|rewrite|block>",
    "reason": "<decision-reason>"
  },
  "action": {},
  "directImpact": [],
  "indirectImpact": [],
  "riskFactors": []
}
```

## Executor 日志

- 日志路径：`<execution-log-path>`
- 预期调用次数：`<number>`
- 实际调用次数：`<number>`
- 关键日志摘要：说明工具是否被真正调用、是否被阻断、是否进入沙箱或审批路径。

## 审计记录

- 审计 ID：`<audit-id>`
- 审计存储路径：`<audit-log-path>`
- 审计记录摘要：记录原始请求、动作元组、影响资源、风险因子、风险等级、`policyVersion`、`policyTrace`、执行决策和时间戳是否完整。

## 验证步骤

1. 准备样例任务输入和本地 fixture。
2. 通过 Agent adapter 或真实 Agent 生成 `ToolCallRequest`。
3. 调用分析 API 或分析服务获取安全网关响应。
4. 通过工具执行守卫尝试执行工具调用。
5. 核对 executor 日志、审计记录和网关响应。

## 验证结论

- 结论：通过 / 部分通过 / 失败。
- 依据：列出支撑结论的响应字段、日志字段、审计 ID 和检查命令。
- 缺口：列出 mock 组件、环境限制、待真实组件复验事项或失败原因。
- 下一步：说明是否可进入后续验证、产品决策或专利材料阶段。
```
