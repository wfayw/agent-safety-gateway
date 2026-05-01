# 专利状态机验证场景索引

本目录保存面向专利评审的工程验证场景。当前场景只使用本仓库 fixture、确定性 runner 和本地测试命令，不连接真实生产数据库、CI/CD、配置中心或客户环境。

## PAG-027 禁止副作用义务证明状态机

| 场景 | 证明目标 | 文档 |
| --- | --- | --- |
| SQL readonly | 只读 SQL executor 的写入、删除、DDL 负能力探测，以及 rows、trigger、async job 副作用差异证据。 | `docs/evidence/patent/PAG-027-sql-readonly-side-effect.md` |
| CI/CD dry-run | dry-run executor 未触发生产部署、webhook、artifact promotion，并在执行器漂移后使旧证据失效。 | `docs/evidence/patent/PAG-027-cicd-dry-run-drift.md` |
| Config sandbox | sandbox 配置 executor 拒绝生产命名空间、生产凭据和生产写端点，且只允许 sandbox 版本变化。 | `docs/evidence/patent/PAG-027-config-sandbox.md` |

## PAG-044 同推理上下文锚点保留证明状态机

| 场景 | 证明目标 | 文档 |
| --- | --- | --- |
| 缺失最新用户指令 | 生产 SQL 写请求缺少最新用户指令 required anchor 时，在 permit 前进入 `RegroundRequired` 并生成 `context.reground_required`。 | `docs/evidence/patent/PAG-044-missing-user-instruction.md` |
| Dry-run-only 审批过期 | 生产 CI/CD dry-run 请求缺少新鲜且 verbatim 保留的审批 note 时，进入 `ReapprovalRequired` 并生成 `context.reapproval_required`。 | `docs/evidence/patent/PAG-044-expired-dry-run-approval.md` |
| 遗漏 negative evidence | 生产配置写请求遗漏冻结窗口反证时，进入 `Conflicting` 并生成 `context.conflicting.deny`。 | `docs/evidence/patent/PAG-044-omitted-negative-evidence.md` |

Fixture JSON：`docs/evidence/patent/fixtures/PAG-044-context-retention-scenarios.json`。

## PAG-046 SQL 端到端组合链路

| 场景 | 证明目标 | 文档 |
| --- | --- | --- |
| SQL DELETE patent E2E | 从 Agent SQL task 和 `PromptAssemblyManifest` 开始，同时生成 SQL required context 与 forbidden-effect obligations；无有效上下文或缺失副作用证据时均阻断 DELETE。 | `docs/evidence/patent/PAG-046-sql-end-to-end-patent.md` |

Fixture JSON：`docs/evidence/patent/fixtures/PAG-046-sql-end-to-end-patent-scenario.json`。

## PAG-047 CI/CD 端到端组合链路

| 场景 | 证明目标 | 文档 |
| --- | --- | --- |
| CI/CD dry-run patent E2E | 从 production deploy Agent task 和 `PromptAssemblyManifest` 开始，证明 dry-run-only 审批、failed-test 上下文、CI/CD 负能力探测和无生产部署副作用证据共同约束 dry-run executor 许可。 | `docs/evidence/patent/PAG-047-cicd-end-to-end-patent.md` |

Fixture JSON：`docs/evidence/patent/fixtures/PAG-047-cicd-end-to-end-patent-scenario.json`。

## PAG-048 Config 端到端组合链路

| 场景 | 证明目标 | 文档 |
| --- | --- | --- |
| Config sandbox patent E2E | 从 production config change Agent task 和 `PromptAssemblyManifest` 开始，证明 namespace constraint、sandbox-only 审批、当前配置、rollback plan 和无生产配置写入证据共同约束 sandbox executor 许可。 | `docs/evidence/patent/PAG-048-config-end-to-end-patent.md` |

Fixture JSON：`docs/evidence/patent/fixtures/PAG-048-config-end-to-end-patent-scenario.json`。

## 复验命令

```bash
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm --filter @agent-safety-gateway/api exec node --import tsx --test test/sql-negative-capability-fixture-runner.test.ts test/sql-side-effect-snapshot-fixture-runner.test.ts test/cicd-negative-capability-fixture-runner.test.ts test/cicd-side-effect-snapshot-fixture-runner.test.ts test/config-negative-capability-fixture-runner.test.ts test/config-side-effect-snapshot-fixture-runner.test.ts test/executor-drift-invalidation-service.test.ts test/tool-execution-guard.test.ts
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm --filter @agent-safety-gateway/api exec node --import tsx --test test/sql-patent-e2e-scenario.test.ts
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm --filter @agent-safety-gateway/api exec node --import tsx --test test/cicd-patent-e2e-scenario.test.ts
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm --filter @agent-safety-gateway/api exec node --import tsx --test test/config-patent-e2e-scenario.test.ts
python3 -m json.tool docs/evidence/patent/fixtures/PAG-044-context-retention-scenarios.json >/tmp/pag044-context-retention-scenarios.json
python3 -m json.tool docs/evidence/patent/fixtures/PAG-046-sql-end-to-end-patent-scenario.json >/tmp/pag046-sql-end-to-end-patent-scenario.json
python3 -m json.tool docs/evidence/patent/fixtures/PAG-047-cicd-end-to-end-patent-scenario.json >/tmp/pag047-cicd-end-to-end-patent-scenario.json
python3 -m json.tool docs/evidence/patent/fixtures/PAG-048-config-end-to-end-patent-scenario.json >/tmp/pag048-config-end-to-end-patent-scenario.json
```

## 结论口径

- 当前结论：fixture 级别可复现，足以支撑工程实施例说明。
- 不得表述为：已完成真实生产 executor、真实数据库、真实 CI/CD 或真实配置中心验证。
- 真实接入复验仍应按 `docs/integration/real-component-onboarding.md` 和 `docs/evidence/real-validation/` 模板执行。
