# 执行器能力画像主动验证、版本签名和许可绑定发明专利交底书草案

> 重要说明：本文件是技术交底书草案，不构成法律意见，也不能保证授权率。正式提交前应由专利代理师基于正式专利库检索结果重写权利要求。
> 本版基于 `docs/patent/prior-art-search-execution-permit-control.md` 和 `docs/patent/agent-safety-gateway-patent-strategy-review.md` 重写。检索后判断：宽泛的 agent guardrail、tool call approval、capability token、broker 和 audit 方向已被 AEGIS、ACP、AIP、agentic browser capability broker、WebMCP 等公开资料显著压缩。因此本交底书将主发明点从宽泛 Agent Safety Gateway 收窄为：执行器能力画像的主动验证、签名版本化和许可绑定。

## 一、建议申请名称

一种面向智能体工具执行器的能力画像主动验证、版本签名和许可绑定方法、系统、电子设备及存储介质。

备选名称：

- 一种智能体工具执行器安全能力主动证明与调用许可绑定方法。
- 一种基于执行器能力画像证明的智能体工具调用控制方法。
- 一种面向 SQL、CI/CD 和配置执行器的能力画像验证、漂移检测和许可绑定方法。

## 二、最新检索后的申请策略

### 2.1 为什么不再把宽泛 Gateway 作为主发明点

公开资料检索显示，下列方向已存在强近似公开：

1. agent 工具调用前拦截、审批、阻断和人工确认。
2. pre-execution firewall、policy validation、risk scanning 和 audit trail。
3. agent capability token、execution token、invocation-bound token。
4. capability broker 校验 proposed tool call 后执行。
5. WebMCP / browser agent 结构化工具能力声明。

因此，本申请不应主张“工具调用前做安全网关”或“使用 broker/token 控制 agent tool call”本身。该类主张容易被认为缺乏新颖性或创造性。

### 2.2 本版重写后的核心发明点

本发明的核心不是 agent 是否需要审批，也不是 tool call 是否需要 broker，而是：

> 真实执行器进对可被智能体调用的行主动能力验证，生成带证据摘要和签名版本的执行器能力画像；在智能体工具调用产生执行许可前，将所需执行模式与该已验证画像进行机器匹配；画像过期、漂移、验证失败或无法证明安全边界时，不签发可调用真实执行器的许可。

核心链路为：

```text
ExecutorRegistration
-> ProbePlan
-> ProbeExecution
-> CapabilityEvidence
-> ExecutorProfileAttestation
-> SignedProfileVersion
-> RequiredExecutionModeMatch
-> PermitBinding / PermitDenied
-> EvidenceRecord
```

### 2.3 主发明点与 Gateway 主案的关系

本申请可作为 Agent Safety Gateway 专利组合中的更具体子案，也可以在预算有限时优先申请。原 gateway 中的资源影响子图、一次性许可、Executor Broker 和 NoPermitEvidence 在本案中作为实施例和从属特征出现，而不是主创新点。

本案保护的重点是：

- executor 声称只读、dry-run、sandbox 或 canary，不可信；
- 系统通过主动探测验证该声明；
- 验证结果形成带版本和证据摘要的画像证明；
- permit 签发绑定该画像证明；
- 画像失效或漂移时 fail-closed。

## 三、技术领域

本发明涉及计算机系统安全、智能体工具调用控制、执行器访问控制、数据库操作安全、软件发布安全、配置管理安全、运行时能力证明和审计追踪技术领域，尤其涉及一种在大语言模型智能体、自动化 agent、开发工具 agent 或运维 agent 调用 SQL、CI/CD、配置中心、脚本或云资源执行器之前，对执行器安全能力进行主动验证、版本签名、漂移检测并绑定调用许可的方法及系统。

## 四、背景技术

随着大语言模型智能体被接入研发、运维、数据分析和企业内部工具链，agent 可以调用数据库、命令行、CI/CD、配置中心、云资源 API 或 MCP 工具。此类调用具有真实副作用，例如删除生产数据、发布未通过测试的服务、修改关键配置或触发不可逆基础设施变更。

现有方案通常集中在 agent 工具调用本身，例如：

1. 在 tool call 前进行人工审批。
2. 根据工具名、命令文本或参数做规则阻断。
3. 通过 capability token 或 broker 对 tool call 做授权。
4. 使用 sandbox、dry-run 或只读凭据降低风险。
5. 将执行前判断和执行结果写入审计日志。

上述方式存在一个共同缺口：系统往往假设某个 executor 具有安全能力，例如“这是只读 SQL executor”、“这是 dry-run 部署 executor”、“这是 sandbox 配置 executor”。但这些能力通常来自配置声明、人工约定或静态标签，缺少机器可复验的主动证明。

在企业生产环境中，执行器能力声明可能与真实状态不一致：

- SQL executor 标记为 readonly，但实际凭据可执行写操作。
- CI/CD executor 标记为 dry-run，但真实触发了部署、副作用或外部 webhook。
- 配置 executor 标记为 sandbox，但实际 namespace 或凭据可写生产配置。
- 执行器上次验证通过，但后续凭据、网络、镜像或配置发生漂移。
- agent 请求被策略判断为只能使用 sandbox executor，但实际调用路径绑定了生产写 executor。

如果系统只判断 agent 请求风险，而不验证 executor 的真实能力，则即使存在 guardrail、approval、token 或 broker，也可能因执行器画像失真而误放行高风险操作。

## 五、现有技术不足

现有技术至少存在以下不足：

1. 执行器安全能力以静态配置为主，缺少主动探测证明。
2. 无法证明只读 executor 真实拒绝写操作。
3. 无法证明 dry-run executor 不产生外部副作用。
4. 无法证明 sandbox executor 的 namespace、凭据和网络边界未指向生产环境。
5. 执行器能力验证结果没有版本化，难以绑定到某一次 agent 调用。
6. 执行器配置发生漂移后，调用许可仍可能继续使用旧画像。
7. 审计记录通常只能证明“策略允许/拒绝”，不能证明“当时匹配的 executor profile 已主动验证”。
8. 对 SQL、CI/CD、配置中心等不同执行器缺少统一的能力证明结构。

## 六、要解决的技术问题

本发明要解决的技术问题是：

1. 如何将执行器的安全能力从人工声明转换为可机器验证的能力画像。
2. 如何通过主动探测任务验证 executor 是否真正满足 readonly、dry-run、sandbox、canary 等安全能力。
3. 如何将探测结果形成带证据摘要、有效期和签名的 `ExecutorProfileAttestation`。
4. 如何在 agent 工具调用许可签发前，将 `RequiredExecutionMode` 与已验证画像进行匹配。
5. 如何在画像过期、验证失败、配置漂移或证据缺失时 fail-closed。
6. 如何在审计中证明某次调用使用了哪个 profileVersion 以及该版本对应的验证证据。

## 七、技术方案概述

本发明提供一种面向智能体工具执行器的能力画像主动验证、版本签名和许可绑定方法，包括：

1. 接收执行器注册信息，所述注册信息包括 executorId、executorType、endpoint、credentialClass、claimedCapabilities、environmentScope 和 owner。
2. 根据执行器类型和声称能力生成 `ProbePlan`。
3. 在隔离验证环境或受控目标资源上执行探测任务，得到 `ProbeResult`。
4. 基于探测结果生成 `CapabilityEvidence`，至少包括探测输入、预期结果、实际结果、证据摘要、时间戳和验证结论。
5. 将一个或多个 `CapabilityEvidence` 汇总为 `ExecutorProfileAttestation`。
6. 对所述画像证明生成 `profileVersion`，并使用签名密钥对画像摘要进行签名。
7. 在 agent 工具调用被解析为所需执行模式后，读取候选 executor 的最新已验证画像。
8. 将 `RequiredExecutionMode` 与 `ExecutorProfileAttestation` 进行匹配。
9. 匹配成功且画像未过期、未漂移、签名有效时，允许签发绑定 `profileVersion` 的调用许可。
10. 匹配失败、画像过期、验证失败、漂移或证据缺失时，不签发许可并生成拒绝证据。
11. 将请求哈希、所需执行模式、profileVersion、证据摘要、许可状态和执行器调用状态写入审计记录。

## 八、关键数据结构

### 8.1 ExecutorRegistration

`ExecutorRegistration` 是执行器注册信息，至少包括：

```json
{
  "executorId": "sql-readonly-prod-001",
  "executorType": "sql",
  "endpointRef": "vault://sql/readonly/orders",
  "credentialClass": "claimed_readonly",
  "environmentScope": ["production"],
  "claimedCapabilities": ["readonly", "explain"],
  "owner": "data-platform",
  "registrationVersion": "reg-2026-05-01-001"
}
```

### 8.2 ProbePlan

`ProbePlan` 是由系统生成的探测计划，至少包括：

```json
{
  "probePlanId": "probe-sql-readonly-v3",
  "executorType": "sql",
  "targetCapabilities": ["readonly"],
  "probeTasks": [
    {
      "probeType": "write_denial",
      "input": "INSERT INTO __asg_probe_table(id) VALUES (1)",
      "expectedOutcome": "permission_denied"
    },
    {
      "probeType": "read_allowed",
      "input": "SELECT 1",
      "expectedOutcome": "success"
    }
  ],
  "failurePolicy": "fail_closed"
}
```

### 8.3 ProbeResult

`ProbeResult` 是探测执行结果，至少包括：

```json
{
  "probeRunId": "run-20260501-0001",
  "probeType": "write_denial",
  "actualOutcome": "permission_denied",
  "sideEffectObserved": false,
  "resourceTouched": ["__asg_probe_table"],
  "startedAt": "2026-05-01T10:00:00Z",
  "finishedAt": "2026-05-01T10:00:02Z",
  "rawEvidenceHash": "sha256:..."
}
```

### 8.4 CapabilityEvidence

`CapabilityEvidence` 是能力验证证据，至少包括：

```json
{
  "capability": "readonly",
  "verified": true,
  "probeRunIds": ["run-20260501-0001", "run-20260501-0002"],
  "evidenceHash": "sha256:...",
  "verifiedAt": "2026-05-01T10:00:03Z",
  "validUntil": "2026-05-08T10:00:03Z",
  "verifierVersion": "asg-verifier-1.0.0"
}
```

### 8.5 ExecutorProfileAttestation

`ExecutorProfileAttestation` 是执行器能力画像证明，至少包括：

```json
{
  "executorId": "sql-readonly-prod-001",
  "profileVersion": "profile-20260501-abc123",
  "executorType": "sql",
  "verifiedCapabilities": ["readonly", "explain"],
  "deniedCapabilities": ["write", "delete", "ddl"],
  "credentialClassVerified": "readonly",
  "environmentScopeVerified": ["production"],
  "networkBoundaryVerified": true,
  "sandboxBoundaryVerified": null,
  "evidenceHashes": ["sha256:..."],
  "profileHash": "sha256:...",
  "signature": "sig:...",
  "signedAt": "2026-05-01T10:00:05Z",
  "validUntil": "2026-05-08T10:00:05Z",
  "status": "active"
}
```

### 8.6 ProfileDriftSignal

`ProfileDriftSignal` 是画像漂移信号，至少包括：

```json
{
  "executorId": "sql-readonly-prod-001",
  "profileVersion": "profile-20260501-abc123",
  "signalType": "credential_changed",
  "detectedAt": "2026-05-03T09:12:00Z",
  "source": "vault-watch",
  "action": "invalidate_profile"
}
```

### 8.7 RequiredExecutionMode

`RequiredExecutionMode` 是某次 agent 工具调用所要求的执行模式，可由资源影响子图、安全策略或人工审批结果生成，至少包括：

```json
{
  "mode": "readonly",
  "requiredCapabilities": ["readonly", "explain"],
  "forbiddenCapabilities": ["write", "delete", "ddl"],
  "environment": "production",
  "resourceType": "sql_table",
  "resourceIds": ["orders"],
  "impactGraphVersion": "impact-20260501-001"
}
```

### 8.8 PermitProfileBinding

`PermitProfileBinding` 是调用许可与画像证明的绑定信息，至少包括：

```json
{
  "requestHash": "sha256:request...",
  "permitId": "permit-20260501-0001",
  "executorId": "sql-readonly-prod-001",
  "profileVersion": "profile-20260501-abc123",
  "profileHash": "sha256:profile...",
  "requiredMode": "readonly",
  "issued": true,
  "issuedAt": "2026-05-01T10:01:00Z",
  "ttlSeconds": 60
}
```

## 九、核心流程

### 9.1 执行器注册

执行器所有者将 SQL、CI/CD、配置中心或脚本执行器注册到系统。注册时只允许声明 `claimedCapabilities`，该声明不直接作为许可签发依据。

系统为每个执行器分配 `executorId`，并记录注册版本、凭据引用、目标环境、网络边界和所有者。

### 9.2 探测计划生成

系统根据 executorType 和 claimedCapabilities 生成 `ProbePlan`。

示例：

- SQL readonly executor：生成 read_allowed、write_denial、ddl_denial、transaction_rollback_probe。
- SQL dry-run executor：生成 explain_plan_probe、no_mutation_probe。
- CI/CD dry-run executor：生成 deployment_plan_only_probe、external_trigger_denial_probe。
- config sandbox executor：生成 namespace_isolation_probe、production_key_write_denial_probe。

### 9.3 主动探测执行

系统在受控环境中执行探测任务。探测任务可以针对测试表、测试服务、影子配置项或专用验证资源执行，避免破坏真实生产资源。

探测执行必须记录：

1. 探测输入。
2. 预期结果。
3. 实际结果。
4. 是否观察到副作用。
5. 原始输出摘要。
6. 执行时的凭据版本、网络边界和环境标签。

### 9.4 能力画像证明生成

当所有必要探测通过后，系统生成 `ExecutorProfileAttestation`。画像证明不是普通配置文件，而是由探测证据汇总得到，并包含有效期、签名和 profileVersion。

画像证明至少满足：

1. 可验证签名。
2. 可追溯到探测证据摘要。
3. 可判断有效期。
4. 可被漂移信号撤销。
5. 可与调用许可绑定。

### 9.5 漂移检测和画像失效

系统监听可能导致画像失真的事件，包括：

- 凭据轮换。
- executor 镜像或版本变更。
- 网络策略变更。
- sandbox namespace 配置变更。
- CI/CD runner 权限变更。
- 配置中心 endpoint 变更。

一旦检测到漂移，系统将对应 `profileVersion` 标记为 invalidated。后续调用许可不得继续绑定该画像版本，除非重新探测并生成新画像。

### 9.6 与智能体调用许可绑定

当 agent 发起工具调用后，系统可先通过 adapter、hook、MCP server 或 API wrapper 将请求归一化，再由策略或资源影响分析得到 `RequiredExecutionMode`。

许可签发模块读取候选 executor 的最新 `ExecutorProfileAttestation`，并执行以下校验：

1. profile 签名有效。
2. profile 未过期。
3. profile 未被漂移信号撤销。
4. profile 的 verifiedCapabilities 覆盖 requiredCapabilities。
5. profile 的 deniedCapabilities 覆盖 forbiddenCapabilities。
6. profile 的 environmentScope 与请求环境匹配。
7. profile 的证据摘要可回放查询。

全部通过时，系统可签发绑定 `profileVersion` 的调用许可。任一失败时，系统不签发许可。

### 9.7 许可拒绝证据

当许可被拒绝时，系统生成拒绝证据，至少包括：

```json
{
  "requestHash": "sha256:request...",
  "executorId": "sql-readonly-prod-001",
  "requiredMode": "readonly",
  "permitIssued": false,
  "reason": "profile_expired",
  "profileVersion": "profile-20260501-abc123",
  "profileStatus": "expired",
  "executorInvoked": false
}
```

该证据用于证明系统不是只做了普通策略阻断，而是在许可签发层发现执行器能力画像不可用，因而没有发放可调用真实 executor 的能力。

## 十、典型实施例

### 10.1 SQL 只读执行器验证

执行器声明其能力为 `readonly` 和 `explain`。系统生成探测计划：

1. 执行 `SELECT 1`，预期成功。
2. 执行 `EXPLAIN SELECT * FROM orders`，预期成功。
3. 执行对探测表的 `INSERT`，预期权限拒绝。
4. 执行对探测表的 `DELETE`，预期权限拒绝。
5. 执行 `CREATE TABLE` 或等价 DDL，预期权限拒绝。

若读操作成功且写操作、删除操作、DDL 操作均被拒绝，系统生成 verifiedCapabilities=`["readonly","explain"]`，deniedCapabilities=`["write","delete","ddl"]` 的画像证明。

当 agent 请求 `SELECT * FROM orders` 时，所需执行模式为 readonly。许可模块发现画像证明有效，可签发绑定该 profileVersion 的许可。

当 agent 请求 `DELETE FROM orders` 时，所需执行模式包含 forbidden write/delete。即使 agent 请求被改写为 dry-run，也不得绑定 readonly executor 执行真实写操作。

### 10.2 SQL dry-run 执行器验证

执行器声明支持 SQL dry-run。系统执行：

1. 对写 SQL 生成 explain plan。
2. 在事务中执行后强制 rollback。
3. 对探测表检查行数和 checksum 未变化。
4. 检查无外部 trigger、副作用日志或异步任务产生。

若实际副作用与预期不一致，系统拒绝生成 dry-run capability。

### 10.3 CI/CD dry-run 执行器验证

CI/CD executor 声明支持 deployment dry-run。系统执行：

1. 使用测试服务生成部署计划。
2. 验证未调用生产 deploy endpoint。
3. 验证未触发外部发布 webhook。
4. 验证产物只写入 dry-run namespace。

只有当上述探测均通过时，系统才生成 `dry_run_deploy` 能力证明。

### 10.4 配置中心 sandbox 执行器验证

config executor 声明支持 sandbox。系统执行：

1. 对 sandbox namespace 写入探测 key。
2. 验证生产 namespace 不可写。
3. 验证凭据 scope 不包含 production write。
4. 验证网络路径无法访问生产写 endpoint。

若发现生产配置可写，则 profileStatus=`failed`，任何需要 sandbox 的 agent 请求均不得使用该 executor。

### 10.5 画像漂移导致许可拒绝

某 SQL readonly executor 已通过验证并生成 profileVersion。随后 Vault 凭据发生轮换。系统收到 `credential_changed` 漂移信号，将旧 profileVersion 标记为 invalidated。

agent 随后请求读取生产订单表。虽然该 executor 曾经通过只读验证，但当前画像已失效，系统不签发许可，并返回 reason=`profile_invalidated`。只有重新探测并生成新 profileVersion 后，才可恢复许可签发。

### 10.6 与资源影响子图和 Broker 联合实施

在 Agent Safety Gateway 实施例中，agent 工具调用先被解析为 `ActionTuple`，再生成 `ImpactSubgraph` 和 `RequiredExecutionMode`。本发明的画像证明模块为许可签发提供 executor 安全能力依据。

例如：

```text
ToolCallRequest
-> ActionTuple
-> ImpactSubgraph
-> RequiredExecutionMode
-> ExecutorProfileAttestation Match
-> PermitProfileBinding
-> ExecutorBroker
```

该实施例中，Broker 不是本案唯一创新点；本案的关键是 Broker 消费的 permit 必须绑定已主动验证的 profileVersion。

## 十一、技术效果

本发明至少具有以下技术效果：

1. 将执行器能力从静态配置声明转化为机器可验证的能力证明。
2. 防止 executor 声称 readonly、dry-run 或 sandbox 但实际具有生产写能力。
3. 将执行器能力证明版本绑定到 agent 调用许可，避免使用过期画像。
4. 在凭据、网络、镜像或 namespace 发生漂移时自动失效画像并 fail-closed。
5. 提供可审计证据，证明某次 agent 调用使用的 executor profile 已通过探测。
6. 在许可拒绝时证明系统没有因画像无效而发放 executor callable capability。
7. 统一 SQL、CI/CD、配置中心等不同执行器的能力验证结构。

## 十二、与现有技术的区别

### 12.1 与 agent tool approval 的区别

现有 approval 方案关注某个工具调用是否需要人工确认。本发明关注 executor 是否真的具备被许可调用的安全能力。即使人工批准，如果 executor profile 未主动验证或已漂移，本发明仍拒绝签发许可。

### 12.2 与 capability token / broker 的区别

现有 capability token 或 broker 方案关注调用者是否具有调用某工具的权限。本发明关注 token 或 permit 签发前，目标 executor 的能力画像是否经过主动验证、是否签名、是否有效、是否未漂移。

换言之，本发明不是“用 token 控制 agent tool call”，而是“把已验证的 executor profileVersion 作为 permit 签发和消费的必要条件”。

### 12.3 与普通 executor 配置的区别

普通配置只说明 executor 应该是什么能力。本发明通过探测任务证明 executor 实际具备或不具备某能力，并将验证证据摘要写入画像证明。

### 12.4 与普通审计日志的区别

普通审计日志记录决策结果。本发明记录 profileVersion、证据摘要、签名状态、漂移状态和许可绑定关系，可证明当时许可依据的是哪个已验证画像。

## 十三、拟保护的权利要求草案

### 13.1 独立方法权利要求草案

一种面向智能体工具执行器的能力画像主动验证、版本签名和许可绑定方法，其特征在于，包括：

1. 接收可由智能体调用的工具执行器的注册信息，所述注册信息包括执行器标识、执行器类型、执行端点引用、凭据类别、声明能力和目标环境范围；
2. 根据所述执行器类型和声明能力生成探测计划，所述探测计划包括至少一个用于验证声明能力是否成立的探测任务；
3. 执行所述探测任务，获得探测结果，所述探测结果包括探测输入、预期结果、实际结果、副作用观察结果和原始证据摘要；
4. 根据所述探测结果生成能力验证证据；
5. 根据所述能力验证证据生成执行器能力画像证明，所述执行器能力画像证明包括已验证能力、已拒绝能力、证据摘要、有效期、画像版本和签名；
6. 接收智能体工具调用对应的所需执行模式；
7. 获取候选执行器的执行器能力画像证明；
8. 校验所述执行器能力画像证明的签名、有效期、漂移状态和已验证能力；
9. 当所述执行器能力画像证明满足所述所需执行模式时，生成绑定所述画像版本的调用许可；
10. 当所述执行器能力画像证明不满足所述所需执行模式、签名无效、已过期、已漂移或证据缺失时，拒绝生成调用许可并生成拒绝证据；
11. 将所述所需执行模式、画像版本、证据摘要、调用许可状态和执行器调用状态写入审计记录。

### 13.2 独立系统权利要求草案

一种面向智能体工具执行器的能力画像主动验证、版本签名和许可绑定系统，包括：

- 执行器注册模块，用于接收执行器注册信息；
- 探测计划生成模块，用于根据执行器类型和声明能力生成探测计划；
- 探测执行模块，用于执行探测任务并生成探测结果；
- 能力证据生成模块，用于根据探测结果生成能力验证证据；
- 画像证明模块，用于生成带画像版本和签名的执行器能力画像证明；
- 漂移检测模块，用于检测凭据、网络、镜像、namespace 或 endpoint 变化并失效画像版本；
- 许可绑定模块，用于将智能体工具调用的所需执行模式与执行器能力画像证明匹配，并生成或拒绝调用许可；
- 审计模块，用于记录画像版本、证据摘要、许可状态和执行器调用状态。

### 13.3 从属权利要求方向

1. 如权利要求一所述的方法，其中执行器类型包括 SQL 执行器、CI/CD 执行器、配置中心执行器、脚本执行器或云资源 API 执行器。
2. 如权利要求一所述的方法，其中 SQL readonly 探测任务包括读操作允许探测、写操作拒绝探测、删除操作拒绝探测和 DDL 拒绝探测。
3. 如权利要求一所述的方法，其中 dry-run 探测任务包括副作用预测、受控执行和副作用差异比较。
4. 如权利要求一所述的方法，其中 sandbox 探测任务包括 namespace 隔离探测、生产写拒绝探测和网络边界探测。
5. 如权利要求一所述的方法，其中画像版本在凭据轮换、执行器镜像变更、网络策略变更或 endpoint 变更时被标记为失效。
6. 如权利要求一所述的方法，其中调用许可绑定 requestHash、profileVersion、profileHash、policyVersion、ttl 和 nonce。
7. 如权利要求一所述的方法，其中拒绝证据包括 permitIssued=false、profileStatus、拒绝原因和 executorInvoked=false。
8. 如权利要求一所述的方法，其中所需执行模式由资源影响子图编译得到。
9. 如权利要求一所述的方法，其中真实执行器只能由 ExecutorBroker 在校验绑定 profileVersion 的调用许可后调用。
10. 如权利要求一所述的方法，其中能力验证证据可由管理端或审计 API 回放查询。

## 十四、实施系统架构

系统可包括以下模块：

1. `ExecutorRegistry`：执行器注册和元数据维护。
2. `ProbePlanCompiler`：根据 executorType 和 claimedCapabilities 生成探测计划。
3. `ProbeRunner`：执行探测任务。
4. `CapabilityEvidenceStore`：存储探测结果和证据摘要。
5. `ProfileAttestationService`：生成和签名 `ExecutorProfileAttestation`。
6. `ProfileDriftDetector`：监听凭据、网络、镜像、配置和 endpoint 变化。
7. `ExecutionModeMatcher`：匹配 `RequiredExecutionMode` 和 `ExecutorProfileAttestation`。
8. `PermitIssuer`：签发绑定 profileVersion 的调用许可。
9. `ExecutorBroker`：可选实施例，用于在真实 executor 调用前校验许可。
10. `AuditEvidenceAPI`：提供画像证明、许可绑定和拒绝证据查询。

## 十五、工程落地任务

建议在 Ralph PRD 中新增或细化以下任务：

1. `ASGP-028`：Add ExecutorProfileAttestation data model。
2. `ASGP-029`：Add ProbePlanCompiler for SQL / CI-CD / config executors。
3. `ASGP-030`：Add ProbeRunner and CapabilityEvidenceStore。
4. `ASGP-031`：Add signed profileVersion and profile validation API。
5. `ASGP-032`：Add profile drift detector for credential / endpoint / namespace changes。
6. `ASGP-033`：Bind InvocationPermit to profileVersion and profileHash。
7. `ASGP-034`：Add profile attestation evidence report for patent and compliance review。

## 十六、申请前需要补强的证据

正式申请前建议准备以下材料：

1. SQL readonly executor 探测通过和失败样例。
2. SQL dry-run 无副作用验证样例。
3. CI/CD dry-run 不触发真实部署的验证样例。
4. 配置中心 sandbox namespace 隔离样例。
5. 画像签名和 profileVersion 绑定 permit 的接口样例。
6. 凭据轮换导致 profile invalidated 的测试证据。
7. profile 过期导致 permitIssued=false 的审计记录。
8. 管理端 evidence replay 截图或 API 输出。
9. 与普通 guardrail、普通 broker、普通配置标签的对照实验。

## 十七、授权风险和应对

### 17.1 主要风险

本案仍存在以下风险：

1. 执行器健康检查、配置验证和凭据权限测试并非全新概念。
2. capability token、broker 和 admission control 已有强近似公开。
3. 审计证据和签名日志已有公开。
4. 如果权利要求写得过宽，可能被认为是常规安全检查的组合。

### 17.2 应对策略

申请时应将创造性集中在以下组合：

```text
声明能力不可信
-> 主动探测验证
-> CapabilityEvidence
-> ExecutorProfileAttestation
-> 签名 profileVersion
-> 漂移失效
-> RequiredExecutionMode 匹配
-> permit 绑定 profileVersion
```

不要把重点写成：

- agent guardrail。
- tool call approval。
- capability token。
- broker。
- 普通 executor health check。
- 普通审计日志。

### 17.3 授权可能性判断

不能承诺具体授权率。基于当前公开资料检索和技术收窄程度，初步判断：

| 申请方式 | 风险判断 |
| --- | --- |
| 宽泛 Agent Safety Gateway | 授权稳定性低 |
| 资源图 + permit/broker 架构主案 | 中等偏低到中等 |
| 本版 ExecutorProfileAttestation 子案 | 中等到中上 |
| 本版子案 + 工程 MVP + 正式检索 + 代理师撰写 | 相对更稳 |

不建议对外宣称超过 80%。更稳妥的表达是：本案比宽泛 gateway 主案更容易形成可审查的技术区别，但仍需正式检索确认。

## 十八、与产品路线的关系

本发明直接支撑 Agent Safety Gateway 的生产级能力：

1. 企业客户可以知道某个 executor 是否真的只读、dry-run 或 sandbox。
2. 管理端可以展示 executor profile 的验证状态和证据。
3. permit 签发不再只依赖策略判断，还依赖 executor 能力证明。
4. Codex、MCP、API wrapper 或 PreToolUse hook 的请求都可以复用同一 profile attestation。
5. 当 executor 漂移时，系统自动阻断相关 agent 调用，降低生产事故风险。

## 十九、最终建议

本交底书建议作为下一轮优先专利申请草案使用。若预算只能申请一个专利，优先申请本案，而不是宽泛 Agent Safety Gateway 主案。

原因是：

1. 本案避开了 agent guardrail、approval、capability token、broker 的拥挤公开区域。
2. 本案技术对象更具体：真实 executor 的能力证明。
3. 本案技术效果更清楚：防止画像失真导致高风险 agent 调用误放行。
4. 本案更容易用工程证据支撑：探测任务、画像签名、漂移失效、permit 绑定。

最终建议的申请标题为：

> 一种面向智能体工具执行器的能力画像主动验证、版本签名和许可绑定方法、系统、电子设备及存储介质。
