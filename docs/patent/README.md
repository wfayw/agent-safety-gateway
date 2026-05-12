# 智能体执行安全网关专利材料

本目录收纳 `agent-safety-gateway` 对应的专利申请材料。当前主案为：

**一种智能体工具调用的预执行影响范围分析与风险控制方法**

## 文件说明

| 文件 | 用途 |
|---|---|
| `专利设计概要-企业级可信Agent系统.md` | 专利方向收敛、技术边界和保护策略概要 |
| `专利申请技术交底书-智能体工具调用预执行影响范围分析与风险控制方法.md` | 面向代理师的技术交底书 |
| `专利申请草案-智能体工具调用预执行影响范围分析与风险控制方法.md` | 权利要求书和说明书草案 |
| `专利申请实际案例-智能体SQL工具调用预执行风险控制.md` | 可写入说明书的实际实施例 |
| `专利申请实际案例-智能体SQL工具调用预执行风险控制.html` | 实施例可视化演示页 |
| `pre-review/` | 专利预审补充材料 |
| `templates/` | 专利预审推荐函、研发证明、加快审查理由等官方模板，以及技术交底书范例 |
| `assets/` | 专利实施例和演示页面截图 |

## 预审模板

| 文件 | 用途 |
|---|---|
| `templates/模版1.专利申请预审请求推荐函.docx` | 专利申请预审请求推荐函模板 |
| `templates/模版2.研发证明材料.docx` | 研发证明材料模板 |
| `templates/模版3.专利申请加快审查理由.docx` | 专利申请加快审查理由模板 |
| `templates/专利申请技术交底书-xxx方法-范例.doc` | 技术交底书范例 |

## 演示截图

| 文件 | 用途 |
|---|---|
| `assets/patent-generalized-demo-desktop.png` | 通用化方案桌面端演示截图 |
| `assets/patent-sql-risk-demo-desktop.png` | SQL 风险控制桌面端演示截图 |
| `assets/patent-sql-risk-demo-mobile.png` | SQL 风险控制移动端演示截图 |
| `assets/patent-sql-risk-demo-select.png` | SQL 风险控制选择态演示截图 |

## 当前保护点

本案不以通用 Agent 平台、知识图谱后台或普通策略引擎作为核心保护对象，而是收敛到以下执行前技术控制闭环：

```text
智能体工具调用请求
-> 目标 executor 调用前拦截
-> 动作元组 ActionTuple
-> 直接影响资源 AffectedResource
-> 间接影响资源和 ImpactPath
-> 风险等级 RiskLevel
-> 执行控制决策 ExecutionDecision
-> ToolExecutionGuard 控制 executor 是否被调用
-> 记录 executor 调用控制结果和审计证据
```

正式提交前，需要由专利代理师根据检索结果进一步收窄权利要求，并补充真实 Agent、SQL dry-run、CI/CD dry-run、配置中心 sandbox 的复验材料。
