import assert from "node:assert/strict";
import test from "node:test";

import {
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  ForbiddenEffectFailClosedAction,
  ForbiddenEffectObligationSchema,
  ForbiddenEffectSeverity,
  ForbiddenEffectType,
  ForbiddenEffectTypeValues,
  isForbiddenEffectObligation,
  validateForbiddenEffectObligation,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

const validSqlObligation = {
  obligationId: "feo-20260501-sql-readonly-orders",
  effectType: ForbiddenEffectType.Sql,
  resourceScope: ["orders"],
  environment: ForbiddenEffectEnvironment.Production,
  severity: ForbiddenEffectSeverity.Critical,
  requiredEvidenceTypes: [
    ForbiddenEffectEvidenceType.WriteDenial,
    ForbiddenEffectEvidenceType.DeleteDenial,
    ForbiddenEffectEvidenceType.DdlDenial,
    ForbiddenEffectEvidenceType.NoRowMutation,
    ForbiddenEffectEvidenceType.NoTriggerSideEffect,
  ],
  failClosedAction: ForbiddenEffectFailClosedAction.DenyPermit,
  requestHash: "sha256:request-sql-delete-orders",
  requiredExecutionMode: "readonly",
  executorType: ForbiddenEffectType.Sql,
  forbiddenCapabilities: ["write", "delete", "ddl"],
  forbiddenEffects: ["row_mutation", "trigger_side_effect"],
  createdAt: "2026-05-01T04:40:00.000Z",
};

test("validates a SQL ForbiddenEffectObligation", () => {
  const result = ForbiddenEffectObligationSchema.safeParse(validSqlObligation);

  assert.equal(result.success, true);
  assert.equal(result.data.obligationId, validSqlObligation.obligationId);
  assert.equal(result.data.effectType, ForbiddenEffectType.Sql);
  assert.deepEqual(result.data.resourceScope, ["orders"]);
  assert.equal(
    result.data.requiredEvidenceTypes.includes(
      ForbiddenEffectEvidenceType.DeleteDenial,
    ),
    true,
  );
  assert.equal(isForbiddenEffectObligation(validSqlObligation), true);
});

test("supports SQL, CI/CD, config, script, and cloud API effect types", () => {
  assert.deepEqual(ForbiddenEffectTypeValues, [
    ForbiddenEffectType.Sql,
    ForbiddenEffectType.CiCd,
    ForbiddenEffectType.Config,
    ForbiddenEffectType.Script,
    ForbiddenEffectType.CloudApi,
  ]);
});

test("rejects invalid ForbiddenEffectObligation fields", () => {
  const result = validateForbiddenEffectObligation({
    obligationId: "",
    effectType: "email",
    resourceScope: [],
    environment: "prod",
    severity: "urgent",
    requiredEvidenceTypes: ["delete_denial", "screenshot"],
    failClosedAction: "continue",
    executorType: "cloud",
    forbiddenCapabilities: ["write", ""],
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    [
      "$.obligationId",
      "$.effectType",
      "$.resourceScope",
      "$.environment",
      "$.severity",
      "$.requiredEvidenceTypes[1]",
      "$.failClosedAction",
      "$.executorType",
      "$.forbiddenCapabilities[1]",
    ],
  );
  assert.equal(isForbiddenEffectObligation(result), false);
});

test("throws a typed validation error on parse failure", () => {
  assert.throws(
    () => ForbiddenEffectObligationSchema.parse({}),
    (error) =>
      error.name === "ForbiddenEffectObligationValidationError" &&
      Array.isArray(error.issues) &&
      error.issues.some((issue) => issue.path === "$.obligationId"),
  );
});
