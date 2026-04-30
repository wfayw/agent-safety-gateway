import assert from "node:assert/strict";
import test from "node:test";

import {
  ActionTupleSchema,
  CiCdScenarioFixtureId,
  ConfigScenarioFixtureId,
  AuditRecordSchema,
  DecisionType,
  Environment,
  ManagementPermission,
  ManagementRole,
  OperationType,
  RiskLevel,
  SqlScenarioFixtureId,
  ToolCallRequestSchema,
  ToolType,
  cicdScenarioFixtures,
  configScenarioFixtures,
  getManagementRolePermissions,
  hasAnyManagementPermission,
  hasManagementPermission,
  isManagementRole,
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

test("exports management roles with deterministic permissions", () => {
  assert.equal(isManagementRole(ManagementRole.Viewer), true);
  assert.equal(isManagementRole("admin"), false);
  assert.deepEqual(getManagementRolePermissions(ManagementRole.Viewer), [
    ManagementPermission.ViewAuditEvidence,
  ]);
  assert.equal(
    hasManagementPermission(
      [ManagementRole.Operator],
      ManagementPermission.ExecuteToolCalls,
    ),
    true,
  );
  assert.equal(
    hasManagementPermission(
      [ManagementRole.Viewer],
      ManagementPermission.ExecuteToolCalls,
    ),
    false,
  );
  assert.equal(
    hasAnyManagementPermission(
      [ManagementRole.Approver],
      [
        ManagementPermission.ManagePolicies,
        ManagementPermission.ManageApprovals,
      ],
    ),
    true,
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

test("exports CI/CD scenario fixtures for blocked deploy and reviewed rollback", () => {
  assert.equal(cicdScenarioFixtures.length, 2);

  const deployFixture = cicdScenarioFixtures.find(
    (fixture) =>
      fixture.id === CiCdScenarioFixtureId.ProductionDeployPaymentService,
  );
  const rollbackFixture = cicdScenarioFixtures.find(
    (fixture) =>
      fixture.id === CiCdScenarioFixtureId.ProductionRollbackPaymentService,
  );

  assert.ok(deployFixture);
  assert.ok(rollbackFixture);

  assert.equal(deployFixture.request.rawPayload.service, "payment-service");
  assert.equal(deployFixture.request.rawPayload.testStatus, "failed");
  assert.equal(
    deployFixture.expectedActionTuple.operation,
    OperationType.Deploy,
  );
  assert.equal(
    deployFixture.expectedActionTuple.environment,
    Environment.Production,
  );
  assert.equal(deployFixture.expectedRiskLevel, RiskLevel.Prohibited);
  assert.equal(deployFixture.expectedDecisionType, DecisionType.Block);

  assert.equal(rollbackFixture.request.rawPayload.toVersion, "1.7.4");
  assert.equal(
    rollbackFixture.expectedActionTuple.operation,
    OperationType.Rollback,
  );
  assert.equal(
    rollbackFixture.expectedActionTuple.environment,
    Environment.Production,
  );
  assert.equal(rollbackFixture.expectedRiskLevel, RiskLevel.Medium);
  assert.equal(
    rollbackFixture.expectedDecisionType,
    DecisionType.RequireApproval,
  );
});

test("exports config scenario fixture for sandboxed payment.timeout update", () => {
  assert.equal(configScenarioFixtures.length, 1);

  const paymentTimeoutFixture = configScenarioFixtures.find(
    (fixture) =>
      fixture.id === ConfigScenarioFixtureId.ProductionPaymentTimeoutUpdate,
  );

  assert.ok(paymentTimeoutFixture);
  assert.equal(
    paymentTimeoutFixture.request.rawPayload.service,
    "payment-service",
  );
  assert.equal(paymentTimeoutFixture.request.rawPayload.key, "payment.timeout");
  assert.equal(paymentTimeoutFixture.request.rawPayload.value, "100ms");
  assert.equal(
    paymentTimeoutFixture.expectedActionTuple.operation,
    OperationType.Update,
  );
  assert.equal(
    paymentTimeoutFixture.expectedActionTuple.target,
    "payment-service.payment.timeout",
  );
  assert.equal(
    paymentTimeoutFixture.expectedActionTuple.environment,
    Environment.Production,
  );
  assert.equal(paymentTimeoutFixture.expectedRiskLevel, RiskLevel.Medium);
  assert.equal(paymentTimeoutFixture.expectedDecisionType, DecisionType.Sandbox);
});

test("scenario fixture requests and action tuples match runtime schemas", () => {
  const fixtures = [
    ...sqlScenarioFixtures,
    ...cicdScenarioFixtures,
    ...configScenarioFixtures,
  ];

  for (const fixture of fixtures) {
    assert.equal(ToolCallRequestSchema.safeParse(fixture.request).success, true);
    assert.equal(
      ActionTupleSchema.safeParse(fixture.expectedActionTuple).success,
      true,
    );
  }
});

test("validates audit records with policy version and trace evidence", () => {
  const auditRecord = {
    id: "audit-policy-trace-001",
    request: sqlScenarioFixtures[0].request,
    actionTuple: sqlScenarioFixtures[0].expectedActionTuple,
    directResources: sqlScenarioFixtures[0].fixtures.resources,
    indirectResources: [],
    impactPaths: [],
    riskFactors: [
      {
        category: "operation",
        label: "Destructive SQL DELETE",
        severity: "critical",
        score: 50,
        reason: "DELETE can remove production order data.",
      },
    ],
    riskLevel: RiskLevel.Prohibited,
    policyVersion: "local-risk-policy-v1",
    policyTrace: {
      thresholds: {
        medium: 30,
        high: 90,
        prohibited: 120,
      },
      weights: {
        operation: 1,
        environment: 1,
        resource_criticality: 1,
        dependency_impact: 1,
        validation_state: 1,
        reversibility: 1,
      },
      hardRules: [
        {
          id: "production_delete_on_critical_resource",
          description:
            "Block production DELETE operations that touch critical resources.",
          matched: true,
        },
      ],
      matchedRuleIds: [
        "operation.destructive_sql_delete.1",
        "production_delete_on_critical_resource",
      ],
      weightedFactors: [
        {
          id: "operation.destructive_sql_delete.1",
          category: "operation",
          label: "Destructive SQL DELETE",
          score: 50,
          weight: 1,
          weightedScore: 50,
        },
      ],
    },
    decision: {
      type: DecisionType.Block,
      code: "risk.prohibited.block",
      reason: "Production DELETE on critical orders must not execute.",
      recommendedAction: "Review the affected rows with a SELECT query first.",
      rewrittenRequest: null,
    },
    createdAt: "2026-04-28T06:00:02.000Z",
  };

  const result = AuditRecordSchema.safeParse(auditRecord);

  assert.equal(result.success, true);
  assert.equal(result.data.policyVersion, "local-risk-policy-v1");
  assert.deepEqual(result.data.policyTrace.matchedRuleIds, [
    "operation.destructive_sql_delete.1",
    "production_delete_on_critical_resource",
  ]);
});
