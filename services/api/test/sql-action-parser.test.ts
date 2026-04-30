import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  Environment,
  OperationType,
  SqlScenarioFixtureId,
  ToolType,
  type ToolCallRequest,
  sqlScenarioFixtures,
} from "@agent-safety-gateway/shared";

import { createSqlActionParser } from "../src/sql-action-parser.js";

const createSqlRequest = (
  sql: string,
  rawPayload: ToolCallRequest["rawPayload"] = {},
): ToolCallRequest => ({
  id: "req-sql-parser-test",
  actor: "agent:codex",
  taskPurpose: "Parse SQL before executor invocation",
  toolType: ToolType.Sql,
  rawPayload: {
    sql,
    database: "orders-prod-readonly",
    ...rawPayload,
  },
  environment: Environment.Production,
  createdAt: "2026-04-28T07:30:00.000Z",
});

describe("SQL action parser", () => {
  it("parses SELECT statements with target table, fields, filter, and connection environment", () => {
    const parser = createSqlActionParser();
    const result = parser.parse(
      createSqlRequest(
        "SELECT id, status FROM orders WHERE status = 'PENDING' LIMIT 10",
        { connectionEnvironment: "prod-readonly" },
      ),
    );

    assert.equal(result.success, true);
    assert.equal(result.actionTuple.operation, OperationType.Read);
    assert.equal(result.actionTuple.target, "orders");
    assert.deepEqual(result.actionTuple.parameters.fields, ["id", "status"]);
    assert.equal(
      result.actionTuple.parameters.filter,
      "status = 'PENDING'",
    );
    assert.equal(
      result.actionTuple.parameters.connectionEnvironment,
      "prod-readonly",
    );
  });

  it("parses INSERT statements with target table and inserted fields", () => {
    const parser = createSqlActionParser();
    const result = parser.parse(
      createSqlRequest(
        "INSERT INTO audit_events (id, order_id, status) VALUES (1, 10, 'queued')",
      ),
    );

    assert.equal(result.success, true);
    assert.equal(result.actionTuple.operation, OperationType.Create);
    assert.equal(result.actionTuple.target, "audit_events");
    assert.deepEqual(result.actionTuple.parameters.fields, [
      "id",
      "order_id",
      "status",
    ]);
  });

  it("parses UPDATE statements with target table, changed fields, and filter", () => {
    const parser = createSqlActionParser();
    const result = parser.parse(
      createSqlRequest(
        "UPDATE orders SET status = 'CANCELLED', updated_at = now() WHERE id = 42",
      ),
    );

    assert.equal(result.success, true);
    assert.equal(result.actionTuple.operation, OperationType.Update);
    assert.equal(result.actionTuple.target, "orders");
    assert.deepEqual(result.actionTuple.parameters.fields, [
      "status",
      "updated_at",
    ]);
    assert.equal(result.actionTuple.parameters.filter, "id = 42");
  });

  it("parses the high-risk DELETE fixture as DELETE on orders", () => {
    const fixture = sqlScenarioFixtures.find(
      (candidateFixture) =>
        candidateFixture.id === SqlScenarioFixtureId.HighRiskDeleteOrders,
    );
    assert.ok(fixture);

    const parser = createSqlActionParser();
    const result = parser.parse(fixture.request);

    assert.equal(result.success, true);
    assert.equal(result.actionTuple.operation, OperationType.Delete);
    assert.equal(result.actionTuple.target, "orders");
    assert.equal(result.actionTuple.parameters.filter, "status='PENDING'");
  });

  it("classifies destructive SQL table operations with target table evidence", () => {
    const parser = createSqlActionParser();
    const cases = [
      {
        sql: "DROP TABLE orders",
        operation: OperationType.Delete,
        operationKeyword: "drop",
        sqlOperationClass: "destructive_ddl",
      },
      {
        sql: "TRUNCATE orders",
        operation: OperationType.Delete,
        operationKeyword: "truncate",
        sqlOperationClass: "destructive_ddl",
      },
      {
        sql: "ALTER TABLE orders ADD COLUMN archived_at timestamp",
        operation: OperationType.Update,
        operationKeyword: "alter",
        sqlOperationClass: "destructive_ddl",
      },
      {
        sql: "DELETE FROM orders",
        operation: OperationType.Delete,
        operationKeyword: "delete",
        sqlOperationClass: "broad_table_delete",
        broadTableDelete: true,
      },
    ];

    for (const testCase of cases) {
      const result = parser.parse(createSqlRequest(testCase.sql));

      assert.equal(result.success, true);
      assert.equal(result.actionTuple.operation, testCase.operation);
      assert.equal(result.actionTuple.target, "orders");
      assert.equal(
        result.actionTuple.parameters.operationKeyword,
        testCase.operationKeyword,
      );
      assert.equal(
        result.actionTuple.parameters.sqlOperationClass,
        testCase.sqlOperationClass,
      );

      if (testCase.broadTableDelete) {
        assert.equal(result.actionTuple.parameters.broadTableDelete, true);
      }
    }
  });

  it("returns a structured error for unknown SQL operations", () => {
    const parser = createSqlActionParser();
    const result = parser.parse(createSqlRequest("VACUUM orders"));

    assert.deepEqual(result, {
      success: false,
      errors: [
        {
          code: "unknown_sql_operation",
          message:
            "SQL operation must be SELECT, INSERT, UPDATE, DELETE, DROP TABLE, TRUNCATE TABLE, or ALTER TABLE.",
          field: "rawPayload.sql",
          details: {
            requestId: "req-sql-parser-test",
            operationKeyword: "vacuum",
            sqlOperationClass: "unknown",
            failClosed: true,
          },
        },
      ],
    });
  });

  it("returns a structured error for malformed SQL without a target table", () => {
    const parser = createSqlActionParser();
    const result = parser.parse(createSqlRequest("DELETE WHERE id = 42"));

    assert.deepEqual(result, {
      success: false,
      errors: [
        {
          code: "missing_sql_target",
          message: "SQL target table could not be extracted.",
          field: "rawPayload.sql",
          details: {
            requestId: "req-sql-parser-test",
            operationKeyword: "delete",
            sqlOperationClass: "destructive_dml",
            failClosed: true,
          },
        },
      ],
    });
  });

  it("fails closed with structured evidence for unknown destructive SQL", () => {
    const parser = createSqlActionParser();
    const result = parser.parse(createSqlRequest("MERGE INTO orders USING updates"));

    assert.deepEqual(result, {
      success: false,
      errors: [
        {
          code: "unknown_sql_operation",
          message:
            "SQL operation must be SELECT, INSERT, UPDATE, DELETE, DROP TABLE, TRUNCATE TABLE, or ALTER TABLE.",
          field: "rawPayload.sql",
          details: {
            requestId: "req-sql-parser-test",
            operationKeyword: "merge",
            sqlOperationClass: "unknown_destructive",
            failClosed: true,
          },
        },
      ],
    });
  });
});
