# Agent Safety Gateway Claim Mapping

## Purpose and Boundaries

This document is an engineering claim-mapping aid for patent counsel. It maps candidate technical claim elements to implementation files and validation evidence in this repository.

This document does not provide a legal opinion, does not assert patentability, and does not replace a patentability or freedom-to-operate search. It intentionally avoids credentials, production connection strings, customer data, and confidential deployment details.

## Technical Thesis

The gateway focuses on a pre-execution control boundary for agent-initiated tool calls. A request is normalized into a typed `ToolCallRequest`, analyzed for action, resource impact, risk, policy trace, and safe alternatives, then mediated by a server-side guard before any executor can be invoked. Evidence is retained for the request, decision, executor invocation state, hook decision, approval hold, adapter health, and audit sink write.

The candidate inventive emphasis is the combination of:

- Semantic tool-call normalization from agent or Codex hook inputs.
- Pre-executor impact analysis across direct and indirect resources.
- Deterministic decision trace with hard blocking rules and weighted factors.
- A guard that makes executor invocation conditional on the decision and adapter health.
- Real-component adapter contracts that fail closed when safe dry-run, sandbox, approval, or audit integrations are absent.
- Audit evidence that records whether an executor was invoked, not just what policy was recommended.

## Candidate Independent Claim Elements

| Element | Proposed technical element | Implementation references | Validation evidence |
| --- | --- | --- | --- |
| C1 | Receive an agent-originated or hook-originated tool invocation and normalize it into a typed request containing actor, purpose, tool type, environment, timestamp, and raw payload. | `packages/shared/src/index.ts`; `services/api/src/agent-adapter.ts`; `services/codex/src/codex-adapter.mjs`; `services/codex/src/pretool-hook.mjs` | `docs/evidence/real-validation/RV-001-sql-delete-block.md`; `docs/evidence/real-validation/RV-005-codex-sql-delete-interception.md`; `services/api/test/agent-sql-delete-real-validation.test.ts`; `services/codex/test/codex-interception-evidence.test.mjs` |
| C2 | Parse the requested operation into a structured action, including SQL destructive operation class, CI/CD deployment state, or configuration update semantics. | `services/api/src/action-parser.ts`; `services/api/src/sql-action-parser.ts`; `services/api/src/cicd-action-parser.ts`; `services/api/src/config-action-parser.ts` | `services/api/test/action-parser.test.ts`; `services/api/test/sql-action-parser.test.ts`; `services/api/test/cicd-action-parser.test.ts`; `services/api/test/config-action-parser.test.ts`; `docs/evidence/real-validation/summary.md` |
| C3 | Resolve direct and indirect resource impact before execution using a resource catalog and dependency graph. | `services/api/src/direct-impact-resolver.ts`; `services/api/src/indirect-impact-resolver.ts`; `services/api/src/catalog-repository.ts`; `services/api/src/catalog-ingestion-service.ts`; `sample-workspace/payment-service/service-manifest.json` | `services/api/test/direct-impact-resolver.test.ts`; `services/api/test/indirect-impact-resolver.test.ts`; `services/api/test/catalog-ingestion-service.test.ts`; `docs/evidence/real-validation/RV-001-sql-delete-block.md` |
| C4 | Score risk with deterministic policy evidence, including weighted factors, thresholds, policy version, matched hard rules, and human-readable rationale. | `services/api/src/risk-factor-generator.ts`; `services/api/src/risk-level-scorer.ts`; `services/api/src/execution-decision-engine.ts`; `services/api/src/tool-call-analysis-service.ts` | `services/api/test/risk-factor-generator.test.ts`; `services/api/test/risk-level-scorer.test.ts`; `services/api/test/execution-decision-engine.test.ts`; `docs/evidence/real-validation/RV-003-production-release-block.md` |
| C5 | Generate a control decision before executor invocation, including allow, block, require approval, sandbox, rewrite, or readonly outcomes. | `packages/shared/src/index.ts`; `services/api/src/execution-decision-engine.ts`; `services/api/src/parameter-rewrite-suggester.ts`; `services/api/src/tool-call-analysis-service.ts` | `services/api/test/tool-call-analysis-service.test.ts`; `services/api/test/sql-delete-blocking-e2e.test.ts`; `services/api/test/release-config-risk-control-e2e.test.ts`; `docs/evidence/real-validation/RV-004-production-config-sandbox.md` |
| C6 | Enforce the decision in a server-side execution guard that conditionally invokes the executor and records `executorInvoked` evidence. | `services/api/src/tool-execution-guard.ts`; `services/api/src/server.ts`; `services/api/src/execution-log-repository.ts`; `services/api/src/audit-repository.ts` | `services/api/test/tool-execution-guard.test.ts`; `services/api/test/server.test.ts`; `docs/evidence/real-validation/RV-001-sql-delete-block.md`; `docs/evidence/real-validation/RV-002-sql-readonly-allow.md` |
| C7 | Fail closed for missing, invalid, or unreachable real-component adapters rather than silently falling back to unsafe production execution. | `services/api/src/real-component-adapters.ts`; `services/codex/src/dry-run-executors.mjs`; `services/api/src/tool-execution-guard.ts`; `services/api/src/diagnostics-service.ts` | `services/api/test/real-component-adapters.test.ts`; `services/codex/test/dry-run-executors.test.mjs`; `services/api/test/server.test.ts`; `docs/integration/real-component-onboarding.md` |
| C8 | Route SQL, CI/CD, and configuration execution through safe adapter classes such as readonly SQL, SQL dry-run, CI/CD dry-run, config sandbox, or canary paths. | `services/api/src/real-component-adapters.ts`; `services/api/src/mock-tool-executors.ts`; `services/codex/src/dry-run-executors.mjs`; `docs/integration/real-component-profile.example.json` | `services/api/test/agent-sql-readonly-real-validation.test.ts`; `services/api/test/agent-production-release-real-validation.test.ts`; `services/api/test/agent-production-config-real-validation.test.ts`; `docs/evidence/real-validation/RV-002-sql-readonly-allow.md`; `docs/evidence/real-validation/RV-003-production-release-block.md`; `docs/evidence/real-validation/RV-004-production-config-sandbox.md` |
| C9 | Hold executions requiring approval in durable approval state and prevent executor invocation until an approval adapter returns approved. | `services/api/src/approval-adapter.ts`; `services/api/src/tool-execution-guard.ts`; `services/api/src/real-component-adapters.ts` | `services/api/test/approval-adapter.test.ts`; `services/api/test/tool-execution-guard.test.ts`; `docs/integration/real-component-onboarding.md` |
| C10 | Intercept Codex shell tool attempts with a `PreToolUse` hook, convert supported commands to gateway requests, and return a block response before the shell tool runs. | `services/codex/src/pretool-hook.mjs`; `services/codex/src/codex-adapter.mjs`; `services/codex/src/gateway-client.mjs`; `services/codex/src/hook-decision-store.mjs` | `services/codex/test/pretool-hook.test.mjs`; `services/codex/test/codex-interception-evidence.test.mjs`; `docs/evidence/real-validation/RV-005-codex-sql-delete-interception.md` |
| C11 | Persist replayable audit evidence, execution logs, hook decisions, external audit sink results, redacted sensitive fields, and read-only diagnostics. | `services/api/src/audit-repository.ts`; `services/api/src/audit-sink-adapter.ts`; `services/api/src/audit-redaction.ts`; `services/api/src/execution-log-repository.ts`; `services/api/src/hook-decision-repository.ts`; `services/api/src/diagnostics-service.ts`; `services/api/src/server.ts` | `services/api/test/audit-repository.test.ts`; `services/api/test/audit-sink-adapter.test.ts`; `services/api/test/server.test.ts`; `docs/evidence/real-validation/summary.md` |
| C12 | Apply management-plane governance so protected routes require authentication, RBAC permissions, and scoped CORS behavior. | `packages/shared/src/index.ts`; `services/api/src/config.ts`; `services/api/src/server.ts`; `apps/web/src/api/client.ts` | `packages/shared/test/schema.test.mjs`; `services/api/test/config.test.ts`; `services/api/test/server.test.ts`; `README.md` |

## Claim Element Notes

### C1-C2: Normalized Request and Semantic Parsing

The code does not treat agent output as only free text. It normalizes tool attempts into a common request shape and parses operation-specific semantics before any executor call. For SQL, parser evidence includes operation keyword, operation class, destructive DDL classification, and broad table delete detection. For CI/CD and config, parsers capture deployment/test status and configuration namespace intent.

### C3-C4: Impact-Aware Risk Trace

Risk is not a generic prompt safety label. The analysis path combines parsed action, resource catalog, direct impact, indirect dependency impact, criticality, sensitivity, rollback capability, hard rules, weighted factors, thresholds, and policy version into an auditable trace. This supports claim language around deterministic technical control evidence rather than opaque model judgment.

### C5-C6: Decision-to-Executor Enforcement

The core enforcement point is `ToolExecutionGuard`: it consumes the analysis result, decides whether the executor can run, and records `executorInvoked`. Validation evidence distinguishes blocked executions with `executorInvoked=false` from allowed readonly execution with one executor invocation. This distinction is important because a recommendation-only guardrail would not prove that execution was actually mediated.

### C7-C9: Real-Component Safety Contracts

Adapter contracts define safe integration requirements for real Agent runtimes, SQL dry-run, CI/CD dry-run, config sandbox, external approval, and external audit sink. Missing or invalid adapters expose health and fail-closed behavior so a local fixture cannot be mistaken for production readiness. Approval decisions are durable holds, not merely UI prompts.

### C10-C12: Hook, Evidence, and Governance Layer

The Codex hook path demonstrates an editor/agent runtime interception point before shell execution. Evidence APIs and diagnostics are read-only and retain control-chain facts without re-running analysis or executors. RBAC, auth, CORS, and redaction support enterprise deployment controls around the technical boundary.

## Prior-Art Comparison Matrix

This matrix is a technical differentiation aid only. It is not a legal prior-art conclusion and should be reviewed by patent counsel against actual references.

| Existing class | Common technical pattern | Differentiating gateway characteristics | Evidence to review |
| --- | --- | --- | --- |
| Generic LLM guardrails or content filters | Classify prompts, completions, or text policy violations; often return an advisory safe/unsafe label. | The gateway normalizes concrete tool calls, resolves resource impact, computes a policy trace, and gates executor invocation with `executorInvoked` evidence. It handles SQL, CI/CD, config, and Codex shell attempts as execution objects rather than only language content. | `services/api/src/tool-execution-guard.ts`; `services/api/src/risk-level-scorer.ts`; `docs/evidence/real-validation/RV-001-sql-delete-block.md`; `docs/evidence/real-validation/RV-005-codex-sql-delete-interception.md` |
| Human approval tools or ticketing workflows | Create review tickets or approval prompts for risky work; execution may depend on external human process discipline. | The guard creates or reads durable approval state and keeps executors off while approval is held. Approval is one decision outcome in the same pre-execution chain as block, sandbox, rewrite, readonly, and allow. | `services/api/src/approval-adapter.ts`; `services/api/src/tool-execution-guard.ts`; `services/api/test/approval-adapter.test.ts`; `docs/integration/real-component-onboarding.md` |
| Sandbox wrappers or dry-run shells | Run a command in an isolated environment or dry-run mode, often without upstream semantic impact analysis. | The gateway decides whether sandbox/dry-run is appropriate based on action, resource impact, risk, policy trace, and adapter health. It can block production writes before sandbox selection and records audit evidence for the chosen path. | `services/api/src/real-component-adapters.ts`; `services/codex/src/dry-run-executors.mjs`; `docs/evidence/real-validation/RV-003-production-release-block.md`; `docs/evidence/real-validation/RV-004-production-config-sandbox.md` |
| Policy engines or IAM/OPA-style authorization | Evaluate static attributes or identity-based policy at request time; may not understand agent tool semantics or executor invocation results. | The gateway derives request attributes from agent/Codex tool payloads, computes resource dependency impact, emits a policy trace, generates rewrites, and links the decision to executor invocation logs and audit sink results. | `services/api/src/tool-call-analysis-service.ts`; `services/api/src/catalog-ingestion-service.ts`; `services/api/src/execution-log-repository.ts`; `docs/evidence/real-validation/summary.md` |

## Evidence Coverage Summary

| Evidence item | Current support | Patent drafting use |
| --- | --- | --- |
| `RV-001` SQL delete block | Deterministic agent adapter, local fixtures, mock SQL executor, local audit JSONL. | Supports pre-executor block and `executorInvoked=false` for prohibited production SQL delete. |
| `RV-002` SQL readonly allow | Deterministic agent adapter, local fixtures, mock SQL readonly executor. | Supports contrast case showing the system can allow low-risk readonly execution and record one executor invocation. |
| `RV-003` production release block | Deterministic agent adapter, pipeline fixture, mock deploy executor. | Supports production CI/CD hard-rule blocking when tests failed. |
| `RV-004` config sandbox path | Deterministic agent adapter, config fixture, mock config executor. | Supports sandbox/canary recommendation and no direct production config write. |
| `RV-005` Codex hook block | Real hook script, simulated `PreToolUse` payload, gateway stub, local hook decision JSONL. | Supports Codex-side interception behavior, while clearly limiting claims about interactive UI validation. |
| API and adapter tests | Package-level Node tests for parsing, scoring, guard, adapters, audit, RBAC, diagnostics, and server routes. | Supports implementation traceability and regression coverage for each mapped claim element. |

## Gaps Before Stronger Filing Claims

The following items should be completed or clearly caveated before stronger filing materials claim real-world deployment behavior:

1. Replace deterministic Agent adapters with a real Ralph or production agent runtime and capture stable `ToolCallRequest` conversion evidence.
2. Run `RV-001` and `RV-002` against a non-production SQL sandbox or database dry-run environment with real readonly credentials and provable no-write boundaries.
3. Run `RV-003` against a CI/CD dry-run executor or non-production release system that proves no production deploy executor was invoked.
4. Run `RV-004` against a real configuration sandbox or canary namespace and record rollback evidence from the external system.
5. Re-run `RV-005` in an interactive Codex CLI environment with hook installation enabled, visible block feedback, real API analysis, and queryable hook decision evidence.
6. Connect an external audit sink with redaction and retention controls, then record external audit IDs or immutable log lookup paths.
7. Exercise durable approval integration with a real approval system, including held, approved, denied, expired, and audit replay states.
8. Add tamper-resistance, artifact signing, or append-only audit storage if counsel wants claims around evidence immutability rather than evidence generation.

## Documentation-Only Validation

This document can be validated without starting API, Web, or browser services:

```bash
git diff --check -- docs/patent/claim-mapping.md
```

The PRD browser verification context is not required for this story because ASGP-020 changes only documentation and does not modify UI behavior or local service startup.
