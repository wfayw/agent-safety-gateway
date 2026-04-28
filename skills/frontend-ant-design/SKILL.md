---
name: frontend-ant-design
description: Ant Design frontend implementation standards for the agent-safety-gateway web app. Use before implementing or changing any UI story, page, route, form, table, modal, status tag, notification, layout, or theme token in this repository.
---

# Ant Design Frontend Standards

Use this skill before implementing any new UI story in `agent-safety-gateway`.

## Core Rule

- Use Ant Design as the only application page UI component library.
- Prefer Ant Design components and patterns over custom widgets, third-party UI kits, or ad-hoc CSS.
- Reference the official component overview when choosing components: https://ant.design/components/overview-cn/

## Layout

- Build page structure with Ant Design `Layout`, `Flex`, `Grid`, `Card`, `Space`, and `Divider` before introducing custom containers.
- Keep primary content in readable panels: dashboard cards, simulator forms, audit tables, and detail descriptions should use `Card` or `Descriptions`.
- Use consistent page hierarchy: page title, short purpose text, primary actions, main content, then secondary details.
- Keep destructive or high-risk actions visually separated from low-risk actions.

## Spacing

- Use Ant Design spacing primitives (`Space`, `Flex` gap, `Card` padding) instead of hard-coded margins where possible.
- Use theme token spacing values when custom spacing is unavoidable.
- Keep dense data views compact but readable; avoid crowding risk labels, action buttons, and evidence links.

## Typography

- Use Ant Design `Typography` for page titles, section headings, body copy, code-like values, and help text.
- Keep headings descriptive and action-oriented, especially for safety decisions and audit review screens.
- Use `Typography.Text type="secondary"` for supporting context and `Typography.Text code` for command, resource id, SQL, or config-key snippets.

## Tables

- Use Ant Design `Table` for audit logs, scenarios, resources, dependencies, and validation evidence lists.
- Provide stable row keys from domain ids such as audit id, scenario id, resource id, or evidence id.
- Prefer explicit columns for risk level, decision, target environment, executor outcome, timestamp, and evidence links.
- Render status-like values with shared tag components instead of plain text.

## Forms

- Use Ant Design `Form`, `Input`, `Select`, `Radio`, `Checkbox`, `Switch`, and `Input.TextArea` for tool-call simulators and filters.
- Add labels, validation rules, placeholders, and helper text for fields that affect safety decisions.
- Use `Form.Item` validation before submitting to gateway APIs.
- Keep JSON or SQL input areas large enough for review and pair them with examples or seed scenario loaders when available.

## Modals And Drawers

- Use `Modal` for confirmation, focused review, and explicit approval-style flows.
- Use `Drawer` for side-by-side audit detail, impact paths, and resource dependency exploration.
- Confirm high-risk actions with clear decision language, impacted resources, and executor consequences.
- Avoid hiding critical risk context behind nested modals.

## Tags And Status

- Use `Tag`, `Badge`, `Alert`, and `Result` for risk levels, decisions, executor status, validation outcome, and environment labels.
- Keep color semantics stable:
  - red: blocked, high risk, production danger, failed validation
  - orange: approval required, sandbox recommended, medium risk
  - green: allowed, low risk, passed validation
  - blue: informational, replay, dry-run, pending review
  - default/gray: unknown, not evaluated, unavailable
- Prefer one shared status-rendering helper per status family once shared UI utilities exist.

## Prompts And Notifications

- Use `Alert` for persistent page-level warnings and validation summaries.
- Use `message` for short success/failure feedback after user actions.
- Use `notification` only for cross-page or longer-running operation results.
- Include actionable recovery text for failed API calls or unavailable local services.

## Theme Tokens

- Configure visual style through Ant Design `ConfigProvider` theme tokens instead of scattered CSS variables.
- Centralize tokens for primary color, border radius, font family, color semantics, and layout backgrounds.
- Keep safety colors consistent with the tag/status rules in this skill.
- Do not override Ant Design internals unless a component cannot meet an acceptance criterion otherwise.

## Implementation Checklist

- Read this file before starting any UI story.
- Confirm every visible page component comes from Ant Design unless there is a documented exception.
- Reuse shared status tags, theme tokens, API loading states, and error presentation when they exist.
- Run the smallest relevant typecheck or UI validation command after changes.
