import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CiCdScenarioFixtureId,
  Environment,
  OperationType,
  ToolType,
  type ToolCallRequest,
  cicdScenarioFixtures,
} from "@agent-safety-gateway/shared";

import { createCiCdActionParser } from "../src/cicd-action-parser.js";

const createCiCdRequest = (
  rawPayload: ToolCallRequest["rawPayload"],
): ToolCallRequest => ({
  id: "req-cicd-parser-test",
  actor: "agent:codex",
  taskPurpose: "Parse CI/CD before executor invocation",
  toolType: ToolType.CiCd,
  rawPayload,
  environment: Environment.Production,
  createdAt: "2026-04-28T07:40:00.000Z",
});

describe("CI/CD action parser", () => {
  it("parses deploy requests with service, version, pipeline, stage, environment, and test status", () => {
    const parser = createCiCdActionParser();
    const result = parser.parse(
      createCiCdRequest({
        service: "payment-service",
        version: "1.8.0",
        pipeline: "payment-service-release",
        stage: "deploy",
        testStatus: "failed",
      }),
    );

    assert.equal(result.success, true);
    assert.equal(result.actionTuple.operation, OperationType.Deploy);
    assert.equal(result.actionTuple.target, "payment-service");
    assert.equal(result.actionTuple.environment, Environment.Production);
    assert.equal(result.actionTuple.parameters.service, "payment-service");
    assert.equal(result.actionTuple.parameters.version, "1.8.0");
    assert.equal(
      result.actionTuple.parameters.pipeline,
      "payment-service-release",
    );
    assert.equal(result.actionTuple.parameters.stage, "deploy");
    assert.equal(result.actionTuple.parameters.testStatus, "failed");
  });

  it("parses rollback requests with rollback versions and pipeline metadata", () => {
    const parser = createCiCdActionParser();
    const result = parser.parse(
      createCiCdRequest({
        service: "payment-service",
        fromVersion: "1.8.0",
        toVersion: "1.7.4",
        pipeline: "payment-service-release",
        stage: "rollback",
        testStatus: "passed",
      }),
    );

    assert.equal(result.success, true);
    assert.equal(result.actionTuple.operation, OperationType.Rollback);
    assert.equal(result.actionTuple.target, "payment-service");
    assert.equal(result.actionTuple.parameters.fromVersion, "1.8.0");
    assert.equal(result.actionTuple.parameters.toVersion, "1.7.4");
    assert.equal(result.actionTuple.parameters.version, "1.7.4");
    assert.equal(
      result.actionTuple.parameters.pipeline,
      "payment-service-release",
    );
    assert.equal(result.actionTuple.parameters.stage, "rollback");
    assert.equal(result.actionTuple.parameters.testStatus, "passed");
  });

  it("parses the production payment-service deploy fixture as DEPLOY", () => {
    const fixture = cicdScenarioFixtures.find(
      (candidateFixture) =>
        candidateFixture.id ===
        CiCdScenarioFixtureId.ProductionDeployPaymentService,
    );
    assert.ok(fixture);

    const parser = createCiCdActionParser();
    const result = parser.parse(fixture.request);

    assert.equal(result.success, true);
    assert.equal(result.actionTuple.operation, OperationType.Deploy);
    assert.equal(result.actionTuple.target, "payment-service");
    assert.equal(result.actionTuple.parameters.version, "1.8.0");
    assert.equal(
      result.actionTuple.parameters.pipeline,
      "payment-service-release",
    );
    assert.equal(result.actionTuple.parameters.stage, "deploy");
    assert.equal(result.actionTuple.parameters.testStatus, "failed");
    assert.equal(result.actionTuple.environment, Environment.Production);
  });

  it("returns a structured error when the service is missing", () => {
    const parser = createCiCdActionParser();
    const result = parser.parse(
      createCiCdRequest({
        version: "1.8.0",
        pipeline: "payment-service-release",
        stage: "deploy",
        testStatus: "failed",
      }),
    );

    assert.deepEqual(result, {
      success: false,
      errors: [
        {
          code: "missing_cicd_service",
          message: "CI/CD service is required in rawPayload.service.",
          field: "rawPayload.service",
          details: {
            requestId: "req-cicd-parser-test",
            toolType: "ci_cd",
          },
        },
      ],
    });
  });

  it("returns a structured error for unsupported CI/CD operations", () => {
    const parser = createCiCdActionParser();
    const result = parser.parse(
      createCiCdRequest({
        service: "payment-service",
        pipeline: "payment-service-release",
        stage: "promote",
        testStatus: "passed",
      }),
    );

    assert.deepEqual(result, {
      success: false,
      errors: [
        {
          code: "unknown_cicd_operation",
          message: "CI/CD operation must be deploy or rollback.",
          field: "rawPayload.stage",
          details: {
            requestId: "req-cicd-parser-test",
            operationKeyword: "promote",
          },
        },
      ],
    });
  });
});
