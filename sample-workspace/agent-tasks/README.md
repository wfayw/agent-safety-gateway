# Agent 任务输入样例

本目录提供用于真实验证的 Agent 自然语言任务输入。每个样例都模拟验证人员交给 Agent 的研发工作请求，要求 Agent 先理解业务上下文，再生成可能的工具调用意图，由安全网关在执行前做风险判断。

## 样例清单

- `sql-delete-pending-orders.md`：高风险 SQL 删除任务，用于验证生产订单表删除阻断。
- `sql-readonly-pending-orders.md`：低风险 SQL 查询任务，用于验证只读查询放行。
- `production-release-with-failed-tests.md`：生产发布任务，用于验证测试失败时阻断发布。
- `production-config-timeout-change.md`：生产配置变更任务，用于验证关键配置变更进入沙箱或审批。

## 使用约束

- 任务文本均为中文，且只引用 `sample-workspace` 内的虚构服务、数据、流水线和配置。
- 任务输入不包含真实客户、真实系统、真实密钥或真实生产凭据。
- 这些文件不是工具调用 JSON；它们用于驱动 Agent Adapter 生成接近真实研发流程的工具调用候选。
