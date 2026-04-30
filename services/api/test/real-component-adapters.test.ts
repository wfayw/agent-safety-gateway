import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AdapterHealthStatus,
  RealComponentAdapterKind,
  RealComponentAdapterNotConfiguredError,
  createNotConfiguredAgentRuntimeAdapter,
  createNotConfiguredHealth,
  createNotConfiguredToolExecutor,
} from "../src/real-component-adapters.js";

describe("real component adapter contracts", () => {
  it("reports not_configured health before real environment details are provided", () => {
    const health = createNotConfiguredHealth(
      RealComponentAdapterKind.SqlDryRun,
      ["SQL 沙箱连接名", "只读账号"],
      () => new Date("2026-04-29T08:00:00.000Z"),
    );

    assert.equal(health.adapterKind, RealComponentAdapterKind.SqlDryRun);
    assert.equal(health.status, AdapterHealthStatus.NotConfigured);
    assert.equal(health.checkedAt, "2026-04-29T08:00:00.000Z");
    assert.deepEqual(health.details.missingRequirements, [
      "SQL 沙箱连接名",
      "只读账号",
    ]);
  });

  it("fails closed when a real executor adapter is not configured", async () => {
    const executor = createNotConfiguredToolExecutor(
      RealComponentAdapterKind.CiCdDryRun,
      ["CI/CD dry-run executor"],
    );

    await assert.rejects(
      () => executor({} as never, {} as never),
      (error) => {
        assert.ok(error instanceof RealComponentAdapterNotConfiguredError);
        assert.equal(error.adapterKind, RealComponentAdapterKind.CiCdDryRun);
        assert.deepEqual(error.missingRequirements, ["CI/CD dry-run executor"]);
        return true;
      },
    );
  });

  it("fails closed when the real Agent runtime adapter is not configured", async () => {
    const adapter = createNotConfiguredAgentRuntimeAdapter([
      "真实 Agent/Ralph 输出协议",
    ]);

    await assert.rejects(
      () => adapter.generateToolCall({ taskId: "rv-001" }),
      RealComponentAdapterNotConfiguredError,
    );
  });
});
