import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ConfigScenarioFixtureId,
  Environment,
  OperationType,
  ToolType,
  type ToolCallRequest,
  configScenarioFixtures,
} from "@agent-safety-gateway/shared";

import { createConfigActionParser } from "../src/config-action-parser.js";

const createConfigRequest = (
  rawPayload: ToolCallRequest["rawPayload"],
): ToolCallRequest => ({
  id: "req-config-parser-test",
  actor: "agent:codex",
  taskPurpose: "Parse config changes before executor invocation",
  toolType: ToolType.Config,
  rawPayload,
  environment: Environment.Production,
  createdAt: "2026-04-28T07:50:00.000Z",
});

describe("Config action parser", () => {
  it("parses config update requests with service, key, value, and environment", () => {
    const parser = createConfigActionParser();
    const result = parser.parse(
      createConfigRequest({
        service: "payment-service",
        key: "payment.timeout",
        value: "100ms",
        previousValue: "2s",
        namespace: "production",
        operation: "update",
      }),
    );

    assert.equal(result.success, true);
    assert.equal(result.actionTuple.operation, OperationType.Update);
    assert.equal(result.actionTuple.target, "payment-service.payment.timeout");
    assert.equal(result.actionTuple.environment, Environment.Production);
    assert.equal(result.actionTuple.parameters.service, "payment-service");
    assert.equal(result.actionTuple.parameters.key, "payment.timeout");
    assert.equal(result.actionTuple.parameters.value, "100ms");
    assert.equal(result.actionTuple.parameters.environment, Environment.Production);
    assert.equal(result.actionTuple.parameters.previousValue, "2s");
  });

  it("parses the payment.timeout fixture as an UPDATE target", () => {
    const fixture = configScenarioFixtures.find(
      (candidateFixture) =>
        candidateFixture.id ===
        ConfigScenarioFixtureId.ProductionPaymentTimeoutUpdate,
    );
    assert.ok(fixture);

    const parser = createConfigActionParser();
    const result = parser.parse(fixture.request);

    assert.equal(result.success, true);
    assert.equal(result.actionTuple.operation, OperationType.Update);
    assert.equal(result.actionTuple.target, "payment-service.payment.timeout");
    assert.equal(result.actionTuple.parameters.service, "payment-service");
    assert.equal(result.actionTuple.parameters.key, "payment.timeout");
    assert.equal(result.actionTuple.parameters.value, "100ms");
    assert.equal(result.actionTuple.environment, Environment.Production);
  });

  it("returns a structured error when the config key is missing", () => {
    const parser = createConfigActionParser();
    const result = parser.parse(
      createConfigRequest({
        service: "payment-service",
        value: "100ms",
        operation: "update",
      }),
    );

    assert.deepEqual(result, {
      success: false,
      errors: [
        {
          code: "missing_config_key",
          message: "Config key is required in rawPayload.key.",
          field: "rawPayload.key",
          details: {
            requestId: "req-config-parser-test",
            toolType: "config",
          },
        },
      ],
    });
  });
});
