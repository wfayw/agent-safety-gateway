# 专利状态机验证场景索引

本目录保存面向专利评审的工程验证场景。当前场景只使用本仓库 fixture、确定性 runner 和本地测试命令，不连接真实生产数据库、CI/CD、配置中心或客户环境。

## PAG-027 禁止副作用义务证明状态机

| 场景 | 证明目标 | 文档 |
| --- | --- | --- |
| SQL readonly | 只读 SQL executor 的写入、删除、DDL 负能力探测，以及 rows、trigger、async job 副作用差异证据。 | `docs/evidence/patent/PAG-027-sql-readonly-side-effect.md` |
| CI/CD dry-run | dry-run executor 未触发生产部署、webhook、artifact promotion，并在执行器漂移后使旧证据失效。 | `docs/evidence/patent/PAG-027-cicd-dry-run-drift.md` |
| Config sandbox | sandbox 配置 executor 拒绝生产命名空间、生产凭据和生产写端点，且只允许 sandbox 版本变化。 | `docs/evidence/patent/PAG-027-config-sandbox.md` |

## 复验命令

```bash
PATH=/home/wangfei/.local/node_modules/.bin:$PATH pnpm --filter @agent-safety-gateway/api exec node --import tsx --test test/sql-negative-capability-fixture-runner.test.ts test/sql-side-effect-snapshot-fixture-runner.test.ts test/cicd-negative-capability-fixture-runner.test.ts test/cicd-side-effect-snapshot-fixture-runner.test.ts test/config-negative-capability-fixture-runner.test.ts test/config-side-effect-snapshot-fixture-runner.test.ts test/executor-drift-invalidation-service.test.ts test/tool-execution-guard.test.ts
```

## 结论口径

- 当前结论：fixture 级别可复现，足以支撑工程实施例说明。
- 不得表述为：已完成真实生产 executor、真实数据库、真实 CI/CD 或真实配置中心验证。
- 真实接入复验仍应按 `docs/integration/real-component-onboarding.md` 和 `docs/evidence/real-validation/` 模板执行。
