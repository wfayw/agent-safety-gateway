# 专利申请实际案例：智能体工具调用的预执行影响范围分析与风险控制

> 本案例可作为《一种智能体工具调用的预执行影响范围分析与风险控制方法》的说明书“具体实施方式”素材。SQL 删除只是一个容易理解的代表性场景，不是本专利的保护边界。本专利真正保护的是：智能体工具调用请求在目标 executor 被调用前，被解析为动作元组，映射到直接和间接受影响资源，生成风险等级和执行控制决策，并由工具执行守卫控制 executor 是否被实际调用。

## 专利核心保护点：跨业务通用的执行前技术控制闭环

本专利不建议把“SQL 风险规则”“研发流程审批”“前端看板”作为核心保护点。真正应当保护的是一套可迁移到不同业务工具的技术闭环：

```text
智能体工具调用请求
-> 目标 executor 调用前拦截
-> 生成业务无关的动作元组 ActionTuple
-> 识别直接影响资源 AffectedResource
-> 基于资源依赖关系生成间接影响资源和 ImpactPath
-> 结合操作、环境、资源等级、验证状态、可回滚性生成 RiskLevel
-> 输出可执行控制决策 ExecutionDecision
-> ToolExecutionGuard 控制 executor 是否被调用
-> 记录 executor 调用控制结果和审计证据
```

该闭环的创新重点在于：风险判断不是停留在提示、打分或审批建议，而是进入工具调用执行链路，直接改变 executor 调用结果。例如高风险请求的 executor 调用次数为 `0`，低风险请求的 executor 调用次数为 `1`。

## 业务无关抽象模型

不同业务会有不同的资源影响图，但底层数据结构可以保持一致。

| 抽象对象 | 含义 | SQL 案例 | 其他业务示例 |
|---|---|---|---|
| `ToolCallRequest` | 智能体准备调用工具的原始请求 | 执行 SQL | 调用发布工具、配置工具、CRM API、云资源 API |
| `ActionTuple` | 统一后的可计算动作 | `delete + orders + production` | `deploy + payment-service + production`、`update + creditLimit + production` |
| `AffectedResource` | 本次动作直接影响的资源 | `orders` 表 | 服务、配置项、客户额度、库存记录、对象存储桶 |
| `ImpactPath` | 从直接资源传播到间接资源的路径 | `orders -> 对账任务` | `配置项 -> 服务链路`、`客户额度 -> 风控模型` |
| `RiskLevel` | 基于技术要素生成的风险等级 | `prohibited` | `medium`、`high`、`prohibited` |
| `ExecutionDecision` | 可被系统执行的控制决策 | `block` | `allow`、`sandbox`、`require_approval`、`rewrite` |
| `ToolExecutionGuard` | executor 前的门控执行器 | 不调用 SQL executor | 不调用 deploy executor、路由到 sandbox executor |
| `AuditRecord` | 可回放证据 | 记录 SQL、影响资源、调用次数 | 记录 API 参数、配置 key、发布版本、外部审计 ID |

因此，每个业务场景可以有不同的节点和边，但都服从同一个保护模型：

```text
动作参数决定直接资源；
直接资源通过依赖关系决定间接影响；
影响范围参与风险决策；
风险决策控制 executor 调用。
```

## 跨业务泛化示例

| 业务领域 | Agent 工具调用 | 直接影响资源 | 间接影响资源 | 风险控制效果 |
|---|---|---|---|---|
| 研发运维 | 发布生产服务 | `payment-service`、发布流水线 | 订单服务、账户服务、告警系统 | 测试失败时 deploy executor 调用次数为 `0` |
| 配置管理 | 修改生产配置 | `payment.timeout` 配置项 | 支付服务、订单支付链路、重试策略 | 生产 executor 不直接调用，进入 sandbox/canary |
| 客户管理 | 修改客户授信额度 | 客户授信记录 | 风控模型、审批流、财务系统 | 缺少审批单时 API executor 不调用 |
| 财务系统 | 批量付款 | 付款批次、收款账户 | 余额系统、对账系统、通知系统 | 高金额批量付款进入人工确认 |
| 供应链 | 调整库存安全水位 | 库存策略记录 | 补货任务、采购计划、门店可售库存 | 先进入仿真或灰度策略 |
| 云平台 | 删除对象存储桶 | 存储桶 | 备份任务、数据同步、报表任务 | 生产删除请求被阻断 |
| 消息触达 | 批量发送短信 | 客户触达任务 | 客服系统、投诉工单、营销统计 | 大规模外发需要审批或限流 |

上述泛化说明用于突出：本专利不是保护某个业务规则，而是保护智能体工具调用在实际执行前的影响范围计算和 executor 调用控制方法。

## 一、案例背景

某软件公司在研发流程中使用 AI Agent 辅助开发、测试和运维。Agent 可以根据研发人员的自然语言任务自动调用 SQL 工具、CI/CD 发布工具和配置中心工具。

在一次测试验证后，研发人员向 Agent 输入任务：

```text
请清理 production 风险建模环境中所有状态为 PENDING 的订单，避免影响后续验证。
```

Agent 根据该任务准备调用 SQL 工具：

```sql
DELETE FROM orders WHERE status='PENDING'
```

如果该 SQL 直接进入生产数据库 executor，可能删除真实订单数据，并影响订单服务、支付对账、报表统计和客户通知流程。传统工具白名单或用户权限校验只能判断 Agent 是否有权调用 SQL 工具，难以判断本次 SQL 参数会造成什么影响。

本发明在 SQL executor 被调用前进行拦截、分析和控制。

## 二、预设资源信息

系统中预先维护企业资源目录和资源依赖关系。该目录可以来自 CMDB、服务注册中心、数据血缘、人工配置或研发平台元数据。

### 1. 直接资源目录

| 资源 ID | 资源名称 | 资源类型 | 环境 | 敏感等级 | 重要等级 | 回滚能力 |
|---|---|---|---|---|---|---|
| `resource-db-table-orders-prod` | `orders` | 数据库表 | production | restricted | critical | manual |

含义：

- `orders` 表为生产环境订单表。
- 该表包含订单金额、订单状态、用户关联信息等敏感业务数据。
- 删除操作不能自动回滚，只能依赖备份或人工恢复。

### 2. 间接资源依赖关系

| 起点资源 | 终点资源 | 关系类型 | 影响说明 |
|---|---|---|---|
| `orders` 表 | `order-service` | reads_from / writes_to | 订单服务读写订单表 |
| `orders` 表 | `payment-reconcile-job` | reads_from | 支付对账任务读取订单数据 |
| `orders` 表 | `order-report` | reads_from | 经营报表统计订单数据 |
| `orders` 表 | `customer-notification-flow` | depends_on | 订单状态变更可能触发客户通知 |

该资源依赖关系不是普通知识图谱展示，而是用于在 executor 调用前计算本次工具调用的影响范围。

## 三、Agent 生成的工具调用请求

Agent 输出被转换为统一的 `ToolCallRequest`：

```json
{
  "id": "req-rv-001-sql-delete-pending-orders",
  "actor": "agent:ralph",
  "taskPurpose": "清理 production 风险建模环境中的待支付订单",
  "toolType": "sql",
  "environment": "production",
  "createdAt": "2026-04-29T03:00:00.000Z",
  "rawPayload": {
    "sql": "DELETE FROM orders WHERE status='PENDING'",
    "database": "orders-prod"
  }
}
```

注意：此时 SQL executor 尚未被调用。工具调用请求先进入安全网关。

## 四、步骤一：executor 调用前拦截

系统在目标 SQL executor 的调用入口前设置工具执行守卫 `ToolExecutionGuard`。

执行链路由：

```text
Agent -> SQL executor
```

变为：

```text
Agent -> 安全网关 -> ToolExecutionGuard -> SQL executor
```

其中，`ToolExecutionGuard` 只有在收到允许执行的控制决策后，才会调用 SQL executor。否则，SQL executor 不会被调用。

## 五、步骤二：解析动作元组

系统解析 SQL 工具调用请求，生成动作元组：

```json
{
  "actor": "agent:ralph",
  "taskPurpose": "清理 production 风险建模环境中的待支付订单",
  "toolType": "sql",
  "operation": "delete",
  "target": "orders",
  "parameters": {
    "sql": "DELETE FROM orders WHERE status='PENDING'",
    "database": "orders-prod",
    "where": "status='PENDING'"
  },
  "environment": "production",
  "timestamp": "2026-04-29T03:00:00.000Z"
}
```

该动作元组将 SQL 文本转换为可计算对象，使系统能够识别：

- 操作为 `delete`；
- 目标资源为 `orders`；
- 执行环境为 `production`；
- 过滤条件为 `status='PENDING'`；
- 任务目的为“清理待支付订单”。

## 六、步骤三：识别直接影响资源

系统根据动作元组中的 `target = orders` 和 `environment = production` 查询资源目录，得到直接影响资源：

```json
{
  "id": "resource-db-table-orders-prod",
  "name": "orders",
  "type": "database_table",
  "environment": "production",
  "sensitivityLevel": "restricted",
  "criticalityLevel": "critical",
  "rollbackCapability": "manual"
}
```

含义是：本次 SQL 不是普通测试表操作，而是对生产环境核心订单表执行删除。

## 七、步骤四：识别间接影响资源和影响路径

系统继续根据资源依赖关系，从 `orders` 表扩展间接影响资源：

| 影响路径 | 间接影响资源 | 影响说明 |
|---|---|---|
| `orders -> order-service` | 订单服务 | 删除订单数据可能导致订单查询、状态流转异常 |
| `orders -> payment-reconcile-job` | 支付对账任务 | 删除待支付订单可能造成对账结果不一致 |
| `orders -> order-report` | 订单报表 | 报表统计结果可能失真 |
| `orders -> customer-notification-flow` | 客户通知流程 | 订单状态异常可能触发错误通知或漏通知 |

系统生成影响路径记录：

```json
[
  {
    "originResourceId": "resource-db-table-orders-prod",
    "impactedResourceId": "resource-service-order-service-prod",
    "resourceIds": [
      "resource-db-table-orders-prod",
      "resource-service-order-service-prod"
    ],
    "depth": 1,
    "environment": "production"
  }
]
```

上述处理使系统不仅知道“要删除 orders 表”，还知道“删除 orders 表会影响哪些下游系统”。

## 八、步骤五：生成风险要素和风险等级

系统根据动作元组、直接影响资源、间接影响资源和验证状态生成风险要素。

| 风险要素 | 判断结果 | 风险说明 |
|---|---|---|
| 操作类型 | delete | 删除操作属于破坏性操作 |
| 执行环境 | production | 生产环境风险高于测试环境 |
| 资源级别 | critical | `orders` 为核心订单表 |
| 敏感等级 | restricted | 涉及受限业务数据 |
| 影响范围 | 多个下游资源 | 影响订单服务、对账、报表、通知 |
| 可回滚性 | manual | 不能自动回滚 |
| 任务目的匹配 | 不匹配 | “清理测试数据”与生产订单删除不匹配 |

一种可实现的风险规则如下：

```text
如果 operation = delete
且 environment = production
且 resource.criticalityLevel = critical
则 riskLevel = prohibited
```

系统生成风险等级：

```json
{
  "riskLevel": "prohibited",
  "riskScore": 130,
  "matchedHardRule": "production_delete_on_critical_resource"
}
```

## 九、步骤六：输出执行控制决策

由于风险等级为 `prohibited`，系统输出阻断执行决策：

```json
{
  "type": "block",
  "code": "risk.prohibited.block",
  "reason": "生产环境核心订单表存在删除操作，且存在下游服务和对账任务影响，禁止在 executor 前自动执行。",
  "recommendedAction": "阻断执行，不调用 SQL executor。",
  "rewrittenRequest": {
    "id": "req-rv-001-sql-delete-pending-orders:rewrite:select-count",
    "toolType": "sql",
    "environment": "production",
    "rawPayload": {
      "sql": "SELECT COUNT(*) FROM orders WHERE status='PENDING'",
      "database": "orders-prod-readonly",
      "rewriteReason": "先估算影响范围，不直接删除数据"
    }
  }
}
```

这里的改写建议不是自动执行删除，而是将破坏性 SQL 改写为只读统计 SQL，用于先确认影响范围。

## 十、步骤七：工具执行守卫控制 executor 是否被调用

`ToolExecutionGuard` 接收上述执行控制决策后，执行如下逻辑：

```text
如果 decision.type = block
则 executorInvoked = false
且不调用 SQL executor
```

本案例中的 executor 调用结果为：

| 项目 | 结果 |
|---|---|
| 决策类型 | `block` |
| 风险等级 | `prohibited` |
| SQL executor 是否被调用 | 否 |
| executorInvoked | `false` |
| executor 调用次数 | `0` |
| 数据库是否发生删除 | 否 |

这一步是本发明区别于普通提示词 guardrail、普通审计日志和普通权限校验的关键技术效果：风险判断结果直接控制 executor 调用行为。

## 十一、步骤八：记录审计证据

系统生成审计记录：

```json
{
  "auditId": "audit-rv-001-sql-delete-block",
  "requestId": "req-rv-001-sql-delete-pending-orders",
  "actionTuple": {
    "operation": "delete",
    "target": "orders",
    "environment": "production"
  },
  "directResources": [
    "resource-db-table-orders-prod"
  ],
  "indirectResources": [
    "resource-service-order-service-prod",
    "resource-job-payment-reconcile-prod",
    "resource-report-order-report-prod",
    "resource-flow-customer-notification-prod"
  ],
  "riskLevel": "prohibited",
  "decisionType": "block",
  "executorInvoked": false,
  "executorCallCount": 0,
  "createdAt": "2026-04-29T03:00:01.000Z"
}
```

该审计记录可以用于后续回放：

1. Agent 当时想做什么。
2. 系统解析出的动作是什么。
3. 哪些资源会被直接影响。
4. 哪些资源会被间接影响。
5. 为什么判断为禁止风险。
6. 为什么 executor 没有被调用。

## 十二、低风险对照案例：只读统计查询允许执行

为了说明本发明不是简单地拦截所有 SQL 工具调用，系统还支持低风险只读操作放行。

研发人员输入：

```text
请统计 production 风险建模环境中 PENDING 订单的数量和总金额。
```

Agent 生成 SQL：

```sql
SELECT COUNT(*) AS pending_count, SUM(amount_cents) AS pending_amount_cents
FROM orders
WHERE status='PENDING'
```

系统解析得到：

```json
{
  "operation": "read",
  "target": "orders",
  "environment": "production"
}
```

虽然 `orders` 是生产核心表，但本次操作为只读聚合查询，不修改数据，不删除数据，不触发下游写入。系统生成：

```json
{
  "riskLevel": "low",
  "decision": {
    "type": "allow",
    "recommendedAction": "允许只读 executor 执行"
  }
}
```

工具执行守卫调用只读 SQL executor：

| 项目 | 结果 |
|---|---|
| 决策类型 | `allow` |
| 风险等级 | `low` |
| SQL executor 是否被调用 | 是 |
| executorInvoked | `true` |
| executor 调用次数 | `1` |
| 返回结果 | `pending_count = 2`，`pending_amount_cents = 7998` |

该对照案例说明：本发明不是基于工具名称的一刀切拦截，而是基于本次工具调用的操作类型、调用参数、目标资源和环境进行差异化控制。

## 十三、产生的技术效果

本案例能够证明以下技术效果：

1. 在 SQL executor 被调用前完成风险分析，而不是执行后审计。
2. 将自然语言任务和 Agent 工具调用转换为动作元组，形成可计算对象。
3. 根据 SQL 参数识别直接影响资源 `orders` 表。
4. 根据资源依赖关系识别间接影响资源，例如订单服务、对账任务、报表和通知流程。
5. 根据操作类型、执行环境、资源级别、影响范围和可回滚性生成风险等级。
6. 通过工具执行守卫使风险决策直接控制 executor 是否被调用。
7. 高风险删除请求的 executor 调用次数为 `0`，低风险只读请求的 executor 调用次数为 `1`。
8. 审计记录能够回放“为什么阻断”和“是否真实调用 executor”。

## 十四、再次强调：可泛化的是执行控制方法，不是业务规则

虽然本案例使用软件公司的 SQL 研发场景，但同一方法可以泛化到其他工具和业务。不同业务的资源影响图会不同，例如 SQL 场景的核心节点是数据库表，CI/CD 场景的核心节点是服务和流水线，CRM 场景的核心节点是客户和授信记录，财务场景的核心节点是付款批次和账户。但这些图都用于同一个技术目的：在 executor 调用前计算影响范围，并把计算结果转化为可执行控制决策。

| 场景 | 工具调用 | 动作元组 | 直接影响资源 | 间接影响资源 | 控制决策 |
|---|---|---|---|---|---|
| CI/CD 发布 | 发布生产服务 | deploy + service + production | 支付服务、发布流水线 | 订单服务、账户服务、告警系统 | 测试失败则 deploy executor 不调用 |
| 配置中心 | 修改生产配置 | update + configKey + production | 配置项 | 依赖该配置的服务链路 | 生产 executor 不直接调用，进入 sandbox/canary |
| 云资源 | 删除存储桶 | delete + bucket + production | 对象存储桶 | 备份任务、数据同步任务 | delete executor 阻断或审批 |
| 业务 API | 修改客户授信额度 | update + creditLimit + production | 授信记录 | 风控模型、审批流、财务系统 | 缺少审批单则 API executor 不调用 |
| 财务付款 | 批量付款 | transfer + batch + production | 付款批次、账户余额 | 对账系统、通知系统、风控系统 | 高金额批次进入人工确认 |
| 供应链库存 | 调整安全库存 | update + inventoryPolicy + production | 库存策略 | 补货任务、采购计划、门店可售库存 | 先进入仿真或灰度策略 |
| 消息通知 | 批量发送短信 | notify + recipients + production | 客户通知任务 | 用户触达、客服系统、投诉工单 | 大规模外发需要审批或限流 |

因此，本发明保护的不是“订单 SQL 删除”“生产发布审批”“客户授信规则”等具体业务规则，而是：

```text
工具调用请求
-> executor 调用前拦截
-> 动作元组
-> 直接影响资源
-> 间接影响资源和影响路径
-> 风险等级
-> 执行控制决策
-> 工具执行守卫控制 executor 是否被调用
-> 审计记录
```

这一套可复用的执行前技术控制闭环。业务规则可以替换，资源图可以替换，executor 可以替换，但上述输入输出关系和控制链路不变。

## 十五、写入专利说明书时的建议表述

在专利说明书中，可以将本案例作为“实施例一：数据库工具调用控制”。

建议强调：

- 本实施例不是简单判断用户是否有 SQL 工具权限。
- 本实施例不是执行后记录日志。
- 本实施例不是仅基于关键词 `DELETE` 做文本拦截。
- 本实施例通过动作元组、资源目录、依赖关系和工具执行守卫共同完成 executor 调用前控制。
- 技术效果可用 executor 调用次数证明：高风险请求为 `0`，低风险请求为 `1`。

不建议强调：

- 前端看板。
- 普通人工审批流程。
- 泛泛的“智能体治理平台”。
- 把资源依赖关系包装成宽泛知识图谱。
