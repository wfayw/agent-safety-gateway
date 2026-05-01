import assert from "node:assert/strict";
import test from "node:test";

import {
  EvidencePlanSchema,
  EvidencePlanTimeoutAction,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  ForbiddenEffectFailClosedAction,
  ForbiddenEffectSeverity,
  ForbiddenEffectType,
  NegativeProbePlanSchema,
  SideEffectProbePlanSchema,
  isEvidencePlan,
  isNegativeProbePlan,
  isSideEffectProbePlan,
  validateEvidencePlan,
  validateEvidencePlanObligationReferences,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

const sqlReadonlyObligation = {
  obligationId: "feo-20260501-sql-readonly-orders",
  effectType: ForbiddenEffectType.Sql,
  resourceScope: ["orders"],
  environment: ForbiddenEffectEnvironment.Production,
  severity: ForbiddenEffectSeverity.Critical,
  requiredEvidenceTypes: [
    ForbiddenEffectEvidenceType.WriteDenial,
    ForbiddenEffectEvidenceType.DeleteDenial,
    ForbiddenEffectEvidenceType.DdlDenial,
  ],
  failClosedAction: ForbiddenEffectFailClosedAction.DenyPermit,
};

const sqlNoMutationObligation = {
  obligationId: "feo-20260501-sql-no-mutation-orders",
  effectType: ForbiddenEffectType.Sql,
  resourceScope: ["orders"],
  environment: ForbiddenEffectEnvironment.Production,
  severity: ForbiddenEffectSeverity.High,
  requiredEvidenceTypes: [
    ForbiddenEffectEvidenceType.NoRowMutation,
    ForbiddenEffectEvidenceType.NoTriggerSideEffect,
  ],
  failClosedAction: ForbiddenEffectFailClosedAction.RequireEvidence,
};

const negativeProbePlan = {
  probePlanId: "negative-probe-sql-readonly-v1",
  obligationIds: [sqlReadonlyObligation.obligationId],
  executorType: ForbiddenEffectType.Sql,
  targetEnvironment: ForbiddenEffectEnvironment.Production,
  requiredFixtures: ["fixtures/sql/readonly-denials.sql"],
  timeoutStrategy: {
    timeoutMs: 5000,
    onTimeout: EvidencePlanTimeoutAction.DenyPermit,
  },
  dangerousCapabilitiesToDeny: ["write", "delete", "ddl"],
  probeTasks: [
    {
      probeType: ForbiddenEffectEvidenceType.WriteDenial,
      operation: "INSERT",
      target: "__asg_probe_table",
      expectedOutcome: "permission_denied",
    },
    {
      probeType: ForbiddenEffectEvidenceType.DeleteDenial,
      operation: "DELETE",
      target: "__asg_probe_table",
      expectedOutcome: "permission_denied",
    },
  ],
  executorId: "sql-readonly-prod-001",
};

const sideEffectProbePlan = {
  probePlanId: "side-effect-probe-sql-dryrun-v1",
  obligationIds: [sqlNoMutationObligation.obligationId],
  executorType: ForbiddenEffectType.Sql,
  targetEnvironment: ForbiddenEffectEnvironment.Production,
  requiredFixtures: ["fixtures/sql/no-row-mutation.sql"],
  timeoutStrategy: {
    timeoutMs: 7000,
    onTimeout: EvidencePlanTimeoutAction.MarkEvidenceIncomplete,
  },
  predictedEffectTypes: ["query_plan"],
  forbiddenEffectTypes: ["row_mutation", "trigger_side_effect"],
  snapshotTargets: ["orders", "orders_audit_trigger_log"],
  executorId: "sql-dryrun-prod-001",
};

const evidencePlan = {
  planId: "evidence-plan-sql-orders-v1",
  obligationIds: [
    sqlReadonlyObligation.obligationId,
    sqlNoMutationObligation.obligationId,
  ],
  executorType: ForbiddenEffectType.Sql,
  targetEnvironment: ForbiddenEffectEnvironment.Production,
  requiredFixtures: [
    "fixtures/sql/readonly-denials.sql",
    "fixtures/sql/no-row-mutation.sql",
  ],
  timeoutStrategy: {
    timeoutMs: 10000,
    onTimeout: EvidencePlanTimeoutAction.DenyPermit,
  },
  negativeProbePlans: [negativeProbePlan],
  sideEffectProbePlans: [sideEffectProbePlan],
  createdAt: "2026-05-01T04:50:00.000Z",
};

test("validates EvidencePlan with negative and side-effect probe plans", () => {
  const result = EvidencePlanSchema.safeParse(evidencePlan);

  assert.equal(result.success, true);
  assert.equal(result.data.planId, evidencePlan.planId);
  assert.equal(result.data.executorType, ForbiddenEffectType.Sql);
  assert.equal(
    result.data.timeoutStrategy.onTimeout,
    EvidencePlanTimeoutAction.DenyPermit,
  );
  assert.equal(result.data.negativeProbePlans.length, 1);
  assert.equal(result.data.sideEffectProbePlans.length, 1);
  assert.equal(isEvidencePlan(evidencePlan), true);
});

test("validates standalone NegativeProbePlan and SideEffectProbePlan models", () => {
  const negativeResult = NegativeProbePlanSchema.safeParse(negativeProbePlan);
  const sideEffectResult = SideEffectProbePlanSchema.safeParse(
    sideEffectProbePlan,
  );

  assert.equal(negativeResult.success, true);
  assert.equal(sideEffectResult.success, true);
  assert.equal(
    negativeResult.data.dangerousCapabilitiesToDeny.includes("delete"),
    true,
  );
  assert.deepEqual(sideEffectResult.data.snapshotTargets, [
    "orders",
    "orders_audit_trigger_log",
  ]);
  assert.equal(isNegativeProbePlan(negativeProbePlan), true);
  assert.equal(isSideEffectProbePlan(sideEffectProbePlan), true);
});

test("rejects malformed EvidencePlan fields and timeout strategy", () => {
  const result = validateEvidencePlan({
    planId: "",
    obligationIds: [],
    executorType: "database",
    targetEnvironment: "prod",
    requiredFixtures: ["fixtures/sql/readonly-denials.sql", ""],
    timeoutStrategy: {
      timeoutMs: 0,
      onTimeout: "continue",
    },
    negativeProbePlans: [
      {
        ...negativeProbePlan,
        probePlanId: "",
        obligationIds: ["feo-missing"],
        executorType: ForbiddenEffectType.Config,
        targetEnvironment: ForbiddenEffectEnvironment.Staging,
        requiredFixtures: [],
        timeoutStrategy: {
          timeoutMs: -1,
          onTimeout: "ignore",
        },
        dangerousCapabilitiesToDeny: [],
        probeTasks: [
          {
            probeType: "screenshot",
            operation: "",
            target: "",
            expectedOutcome: "",
          },
        ],
      },
    ],
    sideEffectProbePlans: [],
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    [
      "$.planId",
      "$.obligationIds",
      "$.executorType",
      "$.targetEnvironment",
      "$.requiredFixtures[1]",
      "$.timeoutStrategy.timeoutMs",
      "$.timeoutStrategy.onTimeout",
      "$.negativeProbePlans[0].probePlanId",
      "$.negativeProbePlans[0].requiredFixtures",
      "$.negativeProbePlans[0].timeoutStrategy.timeoutMs",
      "$.negativeProbePlans[0].timeoutStrategy.onTimeout",
      "$.negativeProbePlans[0].dangerousCapabilitiesToDeny",
      "$.negativeProbePlans[0].probeTasks[0].probeType",
      "$.negativeProbePlans[0].probeTasks[0].operation",
      "$.negativeProbePlans[0].probeTasks[0].target",
      "$.negativeProbePlans[0].probeTasks[0].expectedOutcome",
      "$.negativeProbePlans[0].executorType",
      "$.negativeProbePlans[0].targetEnvironment",
      "$.negativeProbePlans[0].obligationIds[0]",
    ],
  );
  assert.equal(isEvidencePlan(result), false);
});

test("requires every evidence plan obligation to be covered by child plans", () => {
  const result = validateEvidencePlan({
    ...evidencePlan,
    obligationIds: [
      sqlReadonlyObligation.obligationId,
      sqlNoMutationObligation.obligationId,
      "feo-20260501-config-namespace-write",
    ],
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    ["$.obligationIds[2]"],
  );
  assert.equal(result.issues[0].code, "uncovered_obligation");
});

test("validates EvidencePlan references against supplied obligations", () => {
  const success = validateEvidencePlanObligationReferences(evidencePlan, [
    sqlReadonlyObligation,
    sqlNoMutationObligation,
  ]);
  const failure = validateEvidencePlanObligationReferences(evidencePlan, [
    sqlReadonlyObligation,
  ]);

  assert.equal(success.success, true);
  assert.equal(failure.success, false);
  assert.deepEqual(
    failure.issues.map((issue) => `${issue.path}:${issue.code}`),
    ["$.obligationIds[1]:unknown_obligation"],
  );
});

test("throws typed validation errors for invalid probe plans", () => {
  assert.throws(
    () => NegativeProbePlanSchema.parse({}),
    (error) =>
      error.name === "NegativeProbePlanValidationError" &&
      Array.isArray(error.issues) &&
      error.issues.some((issue) => issue.path === "$.probePlanId"),
  );
  assert.throws(
    () => SideEffectProbePlanSchema.parse({}),
    (error) =>
      error.name === "SideEffectProbePlanValidationError" &&
      Array.isArray(error.issues) &&
      error.issues.some((issue) => issue.path === "$.probePlanId"),
  );
  assert.throws(
    () => EvidencePlanSchema.parse({}),
    (error) =>
      error.name === "EvidencePlanValidationError" &&
      Array.isArray(error.issues) &&
      error.issues.some((issue) => issue.path === "$.planId"),
  );
});
