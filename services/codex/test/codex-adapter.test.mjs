import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adaptBashCommand, adaptCiCd, adaptConfig, adaptSql } from "../src/codex-adapter.mjs";

describe("Codex command adapter", () => {
  it("maps Codex psql DELETE commands to production SQL ToolCallRequest", () => {
    const adapted = adaptBashCommand({
      command: "psql orders-prod -c \"DELETE FROM orders WHERE status='PENDING'\"",
      cwd: "/repo",
    });

    assert.equal(adapted.kind, "tool_call");
    assert.equal(adapted.request.toolType, "sql");
    assert.equal(adapted.request.environment, "production");
    assert.equal(adapted.request.rawPayload.sql, "DELETE FROM orders WHERE status='PENDING'");
    assert.equal(adapted.request.rawPayload.database, "orders-prod");
  });

  it("keeps unsupported destructive SQL fail-closed before gateway parsing", () => {
    const adapted = adaptBashCommand({
      command: "psql orders-prod -c \"DROP TABLE orders\"",
      cwd: "/repo",
    });

    assert.equal(adapted.kind, "tool_call");
    assert.equal(adapted.unsupportedDestructiveSql, true);
  });

  it("maps deployment commands to CI/CD ToolCallRequest", () => {
    const request = adaptCiCd({
      command: "kubectl -n production rollout restart deployment/payment-service",
      testStatus: "failed",
    });

    assert.equal(request.toolType, "ci_cd");
    assert.equal(request.environment, "production");
    assert.equal(request.rawPayload.service, "payment-service");
    assert.equal(request.rawPayload.operation, "deploy");
    assert.equal(request.rawPayload.testStatus, "failed");
  });

  it("maps config update inputs to Config ToolCallRequest", () => {
    const request = adaptConfig({
      service: "payment-service",
      key: "payment.timeout",
      value: "100ms",
      environment: "prod",
    });

    assert.equal(request.toolType, "config");
    assert.equal(request.environment, "production");
    assert.equal(request.rawPayload.service, "payment-service");
    assert.equal(request.rawPayload.key, "payment.timeout");
    assert.equal(request.rawPayload.value, "100ms");
  });

  it("maps safe_sql input directly to SQL ToolCallRequest", () => {
    const request = adaptSql({
      sql: "SELECT COUNT(*) FROM orders",
      database: "orders-prod-readonly",
      environment: "production",
    });

    assert.equal(request.toolType, "sql");
    assert.equal(request.rawPayload.sql, "SELECT COUNT(*) FROM orders");
    assert.equal(request.rawPayload.database, "orders-prod-readonly");
  });

  it("blocks destructive host commands locally", () => {
    const adapted = adaptBashCommand({
      command: "rm -rf /",
      cwd: "/repo",
    });

    assert.equal(adapted.kind, "local_block");
  });
});
