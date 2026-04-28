---
name: safety-gateway-domain
description: Domain model and terminology standards for agent-safety-gateway. Use before implementing or changing ToolCallRequest, ActionTuple, AffectedResource, ResourceDependency, RiskFactor, RiskLevel, ExecutionDecision, AuditRecord, Scenario, parsers, risk scoring, execution guards, fixtures, audit replay, or validation scenarios.
---

# Safety Gateway Domain Model

Use this skill before implementing backend, shared types, fixtures, API contracts, executor guards, audit replay, or validation evidence for `agent-safety-gateway`.

## Core Principle

- The gateway intercepts an agent tool call before executor invocation, analyzes what resources would be affected, decides whether execution may continue, and records audit evidence.
- The MVP proves real execution control, not policy administration: resources, dependencies, fixtures, and strategy rules are supplied through seed data or configuration.
- Do not add resource-management pages, dependency editors, policy-rule editors, approval queue APIs, or a general Agent platform unless a later story explicitly asks for them.

## Required Terms

- `ToolCallRequest`: the raw pre-execution request from an agent or adapter, including tool type, environment, parameters, source task, request id, and optional actor/session metadata.
- `ActionTuple`: the normalized action extracted from a tool call, typically `toolType + operation + environment + target + modifiers`; use it as the stable input to impact and risk analysis.
- `AffectedResource`: a directly or indirectly impacted resource such as a database table, service, pipeline, config key, queue, or external dependency, including environment and criticality.
- `ResourceDependency`: a directed relationship used to expand blast radius from one resource to another, such as service-to-database, service-to-config, or deployment-to-runtime dependency.
- `RiskFactor`: one concrete reason risk increased or decreased, with a code, severity, human-readable evidence, and references to the action or resource that triggered it.
- `RiskLevel`: the summarized severity used by APIs and UI. Use stable levels: `low`, `medium`, `high`, and `prohibited`.
- `ExecutionDecision`: the executable control result. Use stable decision types: `allow`, `block`, `require_approval`, `sandbox`, and `rewrite`.
- `AuditRecord`: immutable evidence for one gateway evaluation, including request, action tuple, affected resources, risk factors, risk level, decision, executor outcome if attempted, timestamps, and validation context.
- `Scenario`: a seeded validation case that bundles a realistic agent task, expected tool call, expected risk/decision, fixtures, and evidence requirements.

## Core Flow

1. Receive a `ToolCallRequest` from the simulator, agent adapter, or guard example before any executor runs.
2. Parse it into an `ActionTuple` using the registered parser for SQL, CI/CD, Config, or future tools.
3. Resolve direct `AffectedResource` entries from the action target and seed/config resource catalog.
4. Expand indirect impact through `ResourceDependency` entries to describe blast radius.
5. Generate `RiskFactor` entries from operation, environment, resource criticality, dependency impact, validation state, and reversibility.
6. Score the aggregate `RiskLevel` and produce an `ExecutionDecision` with reasons and optional rewrite or sandbox instructions.
7. Apply the decision in the execution guard: only `allow` and approved safe variants may invoke executors; `block` must prevent execution.
8. Persist an `AuditRecord` so the UI and validation report can replay inputs, analysis, decision, executor result, and conclusion.

## Modeling Rules

- Keep domain fields serializable as plain JSON across shared types, API responses, fixtures, audit records, and UI clients.
- Prefer explicit ids such as `requestId`, `resourceId`, `dependencyId`, `scenarioId`, and `auditId` over implicit names.
- Always carry `environment`; production actions must never be inferred from free text only.
- Preserve original agent parameters alongside normalized action data so audit replay can show both what the agent requested and what the gateway decided.
- Represent deny/sandbox/approval decisions as first-class data, not thrown exceptions, so executor guards and UI can render the same result.
- Attach enough evidence to each `RiskFactor` for a reviewer to understand the trigger without re-running analysis.

## Example: SQL Delete

```json
{
  "toolCallRequest": {
    "toolType": "SQL",
    "environment": "production",
    "parameters": { "sql": "DELETE FROM orders WHERE status='PENDING'" }
  },
  "actionTuple": {
    "toolType": "SQL",
    "operation": "DELETE",
    "environment": "production",
    "target": "orders"
  },
  "riskFactors": ["production_environment", "destructive_sql", "critical_orders_table"],
  "riskLevel": "prohibited",
  "executionDecision": {
    "type": "block",
    "reason": "Production DELETE on critical orders table must not reach the executor.",
    "rewriteSuggestion": "SELECT COUNT(*) FROM orders WHERE status='PENDING'"
  }
}
```

## Example: CI/CD Release

```json
{
  "toolCallRequest": {
    "toolType": "CI_CD",
    "environment": "production",
    "parameters": {
      "service": "payment-service",
      "version": "1.8.0",
      "testStatus": "failed"
    }
  },
  "actionTuple": {
    "toolType": "CI_CD",
    "operation": "DEPLOY",
    "environment": "production",
    "target": "payment-service"
  },
  "riskFactors": ["production_deploy", "tests_failed", "critical_payment_service"],
  "riskLevel": "prohibited",
  "executionDecision": {
    "type": "block",
    "reason": "Production deploy is blocked because validation failed for payment-service."
  }
}
```

## Implementation Checklist

- Read this file before creating shared domain types, schemas, fixtures, parsers, scoring, decisions, audit storage, or executor guards.
- Keep SQL, CI/CD, and Config scenarios aligned with seeded resources and dependencies instead of hard-coded UI-only examples.
- Verify blocked decisions prevent executor invocation and leave an audit record explaining why.
- Run the smallest relevant typecheck or skill validation after changing domain contracts or this skill.
