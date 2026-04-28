import assert from "node:assert/strict";
import test from "node:test";

import {
  Environment,
  ToolCallRequestSchema,
  ToolType,
} from "../dist/index.js";

test("validates a SQL tool call request", () => {
  const request = {
    id: "req-sql-delete-orders",
    actor: "agent:ralph",
    taskPurpose: "Clean pending test orders after validation",
    toolType: ToolType.Sql,
    rawPayload: {
      sql: "DELETE FROM orders WHERE status = 'PENDING'",
      database: "orders-prod",
    },
    environment: Environment.Production,
    createdAt: "2026-04-28T05:54:00.000Z",
  };

  const result = ToolCallRequestSchema.safeParse(request);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, request);
});

test("rejects invalid SQL tool call request fields", () => {
  const result = ToolCallRequestSchema.safeParse({
    id: "req-invalid-sql",
    actor: "agent:ralph",
    taskPurpose: "Inspect orders",
    toolType: "SQL",
    rawPayload: {
      sql: undefined,
    },
    environment: "prod",
    createdAt: "2026-04-28T05:54:00.000Z",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    ["$.toolType", "$.rawPayload", "$.environment"],
  );
});
