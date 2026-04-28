import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  ActionTuple,
  OperationType,
  ToolCallRequest,
  ToolType,
} from "@agent-safety-gateway/shared";

import {
  type ActionParseResult,
  type ActionParser,
  createActionParserRegistry,
} from "../src/action-parser.js";

const createRequest = (toolType: ToolType): ToolCallRequest => ({
  id: `request-${toolType}`,
  actor: "agent-codex",
  taskPurpose: "Normalize an agent tool call before execution",
  toolType,
  rawPayload: {
    target: "orders",
  },
  environment: "production",
  createdAt: "2026-04-28T07:00:00.000Z",
});

const createActionTuple = (
  request: ToolCallRequest,
  operation: OperationType,
): ActionTuple => ({
  actor: request.actor,
  taskPurpose: request.taskPurpose,
  toolType: request.toolType,
  operation,
  target: "orders",
  parameters: request.rawPayload,
  environment: request.environment,
  timestamp: "2026-04-28T07:00:01.000Z",
});

const createParser = (
  toolType: ToolType,
  parseResult: (request: ToolCallRequest) => ActionParseResult,
): ActionParser => ({
  supports: (request) => request.toolType === toolType,
  parse: parseResult,
});

describe("action parser registry", () => {
  it("selects the parser whose supports method matches the request tool type", () => {
    const sqlRequest = createRequest("sql");
    const sqlActionTuple = createActionTuple(sqlRequest, "read");
    const sqlParser = createParser("sql", () => ({
      success: true,
      actionTuple: sqlActionTuple,
    }));
    const cicdParser = createParser("ci_cd", (request) => ({
      success: true,
      actionTuple: createActionTuple(request, "deploy"),
    }));

    const registry = createActionParserRegistry([cicdParser, sqlParser]);
    const selection = registry.getParser(sqlRequest);

    assert.equal(selection.success, true);
    assert.equal(selection.parser, sqlParser);
    assert.deepEqual(registry.parse(sqlRequest), {
      success: true,
      actionTuple: sqlActionTuple,
    });
  });

  it("returns a structured parser-not-found error when no parser supports the request", () => {
    const sqlRequest = createRequest("sql");
    const registry = createActionParserRegistry([
      createParser("config", (request) => ({
        success: true,
        actionTuple: createActionTuple(request, "update"),
      })),
    ]);

    assert.deepEqual(registry.parse(sqlRequest), {
      success: false,
      errors: [
        {
          code: "parser_not_found",
          message: "No action parser is registered for tool type 'sql'.",
          field: "toolType",
          details: {
            requestId: "request-sql",
            toolType: "sql",
            registeredParserCount: 1,
          },
        },
      ],
    });
  });

  it("preserves structured parse errors returned by the selected parser", () => {
    const sqlRequest = createRequest("sql");
    const registry = createActionParserRegistry([
      createParser("sql", () => ({
        success: false,
        errors: [
          {
            code: "missing_sql",
            message: "SQL text is required.",
            field: "rawPayload.sql",
            details: {
              requestId: sqlRequest.id,
              toolType: sqlRequest.toolType,
            },
          },
        ],
      })),
    ]);

    assert.deepEqual(registry.parse(sqlRequest), {
      success: false,
      errors: [
        {
          code: "missing_sql",
          message: "SQL text is required.",
          field: "rawPayload.sql",
          details: {
            requestId: "request-sql",
            toolType: "sql",
          },
        },
      ],
    });
  });
});
