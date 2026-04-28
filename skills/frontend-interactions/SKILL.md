---
name: frontend-interactions
description: Frontend interaction-state standards for the agent-safety-gateway web app. Use before implementing or changing any UI loading, error, empty, confirmation, disabled, success, warning, danger, or safety decision interaction for allow, block, approval, sandbox, or rewrite flows.
---

# Frontend Interaction Standards

Use this skill with `skills/frontend-ant-design/SKILL.md` before implementing or changing any interactive web app flow in `agent-safety-gateway`.

## Core Rule

- Make every interaction support the safety gateway goal: help users understand whether an agent action is allowed, blocked, needs approval, should run in a sandbox, or was rewritten before execution.
- Keep UI states factual, actionable, and tied to concrete gateway inputs, decisions, executor results, or audit evidence.
- Avoid decorative UI, animation, charts, icons, or copy that does not clarify the business flow, risk, decision, recovery path, or validation result.

## Required States

- Loading: show the pending operation, preserve user context, and avoid implying a decision before the gateway responds.
- Error: describe what failed, whether execution was prevented, and the next recovery action; never silently fall back to an allow decision.
- Empty: explain what data is missing and provide the safest next action, such as loading seed scenarios or running a validation case.
- Confirmation: require explicit confirmation for destructive, production, or high-risk actions; include impacted resources and executor consequences.
- Disabled: keep controls disabled while required inputs, approvals, validation evidence, or gateway responses are missing; pair disabled states with visible helper text.
- Success: state what completed, the decision applied, and where the user can inspect audit evidence.
- Warning: highlight incomplete evidence, medium risk, sandbox recommendations, or pending approval without blocking unrelated read-only review.
- Danger: reserve danger styling for blocked execution, destructive production changes, high-risk SQL, failed production gates, or irreversible executor actions.

## Decision Display

- Allow: use green success treatment and state that execution may proceed; still show risk level, affected resources, and audit id when available.
- Block: use red danger treatment and state that executor invocation must not run; show the violated rule and impacted resource.
- Approval: use orange warning treatment and show approver, missing approval, timeout, and the action that remains blocked until approval exists.
- Sandbox: use orange or blue informational treatment and clearly distinguish sandbox execution from production execution.
- Rewrite: use blue informational treatment and show both the original requested action and the safe rewritten action before execution.
- Unknown or not evaluated: use neutral treatment and keep execution controls disabled until a gateway decision exists.

## Feedback Patterns

- Use persistent page-level summaries for gateway decisions, validation outcomes, and executor results that users must review before acting.
- Use short transient feedback only for local UI actions such as copying an audit id or loading a sample.
- Keep button labels action-specific, such as `Run gateway check`, `Block execution`, `Request approval`, or `Open audit evidence`.
- Put recovery guidance next to the failed control or decision summary instead of hiding it in generic notifications.

## Browser Verification

- Browser-verify every new page or interaction changed by a UI story before marking the story complete.
- Use the PRD `validationContext.browserVerification` block as the source of truth for local startup commands, URLs, viewport, and credentials when it exists.
- Capture or record the state exercised, including loading, error, empty, confirmation, disabled, success, warning, danger, and any decision states touched by the change.
- If browser verification is unavailable after following the PRD runbook, record the exact blocker in the story progress notes.

## Implementation Checklist

- Read this file and `skills/frontend-ant-design/SKILL.md` before starting UI work.
- Map each interactive flow to the required states it can enter.
- Keep safety decisions visible next to resource impact and executor consequence details.
- Disable execution controls until gateway decisions and required approvals or validation evidence are present.
- Run the smallest relevant typecheck plus required browser validation for changed UI interactions.
