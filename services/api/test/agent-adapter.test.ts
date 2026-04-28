import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Environment, ToolType } from "@agent-safety-gateway/shared";

import { createDeterministicAgentAdapter } from "../src/agent-adapter.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const sampleTaskRoot = join(testDirectory, "../../..", "sample-workspace", "agent-tasks");

const adaptSampleTask = (taskId: string) =>
  createDeterministicAgentAdapter().adaptTask({
    taskId,
    taskPath: join(sampleTaskRoot, `${taskId}.md`),
  });

describe("deterministic agent adapter", () => {
  it("converts the SQL delete task into a production SQL ToolCallRequest", async () => {
    const output = await adaptSampleTask("sql-delete-pending-orders");

    assert.equal(output.request.id, "req-agent-task-sql-delete-pending-orders");
    assert.equal(output.request.toolType, ToolType.Sql);
    assert.equal(output.request.environment, Environment.Production);
    assert.equal(
      output.request.rawPayload.sql,
      "DELETE FROM orders WHERE status='PENDING'",
    );
    assert.equal(output.request.rawPayload.database, "orders-prod");
    assert.equal(output.request.rawPayload.agentOutput, output.agentOutput);
    assert.match(String(output.request.rawPayload.sourceTaskExcerpt), /清理待支付订单/);
  });

  it("converts the SQL read-only task into a bounded SELECT ToolCallRequest", async () => {
    const output = await adaptSampleTask("sql-readonly-pending-orders");

    assert.equal(output.request.toolType, ToolType.Sql);
    assert.equal(output.request.environment, Environment.Production);
    assert.equal(output.request.rawPayload.database, "orders-prod-readonly");
    assert.match(String(output.request.rawPayload.sql), /^SELECT COUNT\(\*\)/);
    assert.match(String(output.request.rawPayload.sql), /SUM\(amount_cents\)/);
    assert.equal(output.request.rawPayload.agentOutput, output.agentOutput);
  });

  it("converts the failed-test release task into a CI/CD deploy ToolCallRequest", async () => {
    const output = await adaptSampleTask("production-release-with-failed-tests");

    assert.equal(output.request.toolType, ToolType.CiCd);
    assert.equal(output.request.environment, Environment.Production);
    assert.deepEqual(
      {
        operation: output.request.rawPayload.operation,
        service: output.request.rawPayload.service,
        version: output.request.rawPayload.version,
        pipeline: output.request.rawPayload.pipeline,
        stage: output.request.rawPayload.stage,
        testStatus: output.request.rawPayload.testStatus,
      },
      {
        operation: "deploy",
        service: "payment-service",
        version: "1.8.0",
        pipeline: "payment-service-release",
        stage: "deploy",
        testStatus: "failed",
      },
    );
    assert.equal(output.request.rawPayload.agentOutput, output.agentOutput);
  });

  it("converts the config timeout task into a production config ToolCallRequest", async () => {
    const output = await adaptSampleTask("production-config-timeout-change");

    assert.equal(output.request.toolType, ToolType.Config);
    assert.equal(output.request.environment, Environment.Production);
    assert.deepEqual(
      {
        operation: output.request.rawPayload.operation,
        service: output.request.rawPayload.service,
        key: output.request.rawPayload.key,
        currentValue: output.request.rawPayload.currentValue,
        value: output.request.rawPayload.value,
        policy: output.request.rawPayload.policy,
      },
      {
        operation: "update",
        service: "payment-service",
        key: "payment.timeout",
        currentValue: "2s",
        value: "100ms",
        policy: "sandbox_then_approval",
      },
    );
    assert.equal(output.request.rawPayload.agentOutput, output.agentOutput);
  });

  it("keeps the adapter protocol deterministic and overridable", async () => {
    const adapter = createDeterministicAgentAdapter({
      defaultActor: "agent:test-adapter",
      defaultCreatedAt: "2026-04-28T09:00:00.000Z",
    });

    const output = await adapter.adaptTask({
      taskId: "sql-delete-pending-orders.md",
      requestId: "req-custom",
      taskContent: "# Agent 任务：清理待支付订单",
    });

    assert.equal(output.request.id, "req-custom");
    assert.equal(output.request.actor, "agent:test-adapter");
    assert.equal(output.request.createdAt, "2026-04-28T09:00:00.000Z");
    assert.equal(output.source.taskId, "sql-delete-pending-orders");
  });

  it("returns a clear error for unknown local task samples", async () => {
    await assert.rejects(
      () => createDeterministicAgentAdapter().adaptTask({ taskId: "unknown-task" }),
      /No deterministic agent adapter template for task 'unknown-task'/,
    );
  });
});
