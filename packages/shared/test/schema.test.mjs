import assert from "node:assert/strict";
import test from "node:test";

import {
  ActionTupleSchema,
  DecisionType,
  Environment,
  OperationType,
  RiskLevel,
  SqlScenarioFixtureId,
  ToolCallRequestSchema,
  ToolType,
  sqlScenarioFixtures,
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

test("exports SQL scenario fixtures for blocked delete and allowed query", () => {
  assert.equal(sqlScenarioFixtures.length, 2);

  const deleteFixture = sqlScenarioFixtures.find(
    (fixture) => fixture.id === SqlScenarioFixtureId.HighRiskDeleteOrders,
  );
  const readFixture = sqlScenarioFixtures.find(
    (fixture) => fixture.id === SqlScenarioFixtureId.LowRiskReadOrders,
  );

  assert.ok(deleteFixture);
  assert.ok(readFixture);

  assert.equal(
    deleteFixture.request.rawPayload.sql,
    "DELETE FROM orders WHERE status='PENDING'",
  );
  assert.equal(
    deleteFixture.expectedActionTuple.operation,
    OperationType.Delete,
  );
  assert.equal(
    deleteFixture.expectedActionTuple.environment,
    Environment.Production,
  );
  assert.equal(deleteFixture.expectedRiskLevel, RiskLevel.Prohibited);
  assert.equal(deleteFixture.expectedDecisionType, DecisionType.Block);

  assert.match(readFixture.request.rawPayload.sql, /^SELECT /);
  assert.equal(readFixture.expectedActionTuple.operation, OperationType.Read);
  assert.equal(
    readFixture.expectedActionTuple.environment,
    Environment.Production,
  );
  assert.equal(readFixture.expectedRiskLevel, RiskLevel.Low);
  assert.equal(readFixture.expectedDecisionType, DecisionType.Allow);
});

test("SQL scenario fixture requests and action tuples match runtime schemas", () => {
  for (const fixture of sqlScenarioFixtures) {
    assert.equal(ToolCallRequestSchema.safeParse(fixture.request).success, true);
    assert.equal(
      ActionTupleSchema.safeParse(fixture.expectedActionTuple).success,
      true,
    );
  }
});
