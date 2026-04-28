import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DecisionType, RiskLevel } from "@agent-safety-gateway/shared";

import { runToolGuardDemo } from "../../../scripts/tool-guard-demo.js";

describe("tool execution guard demo", () => {
  it("blocks prohibited SQL DELETE before invoking the mock executor", async () => {
    const result = await runToolGuardDemo();

    assert.equal(result.blockedDelete.status, "blocked");
    assert.equal(result.blockedDelete.executorInvoked, false);
    assert.equal(result.blockedDelete.riskLevel, RiskLevel.Prohibited);
    assert.equal(result.blockedDelete.decisionType, DecisionType.Block);
  });

  it("invokes the mock executor once for the low-risk SQL SELECT path", async () => {
    const result = await runToolGuardDemo();

    assert.equal(result.allowedSelect.status, "executed");
    assert.equal(result.allowedSelect.executorInvoked, true);
    assert.equal(result.allowedSelect.riskLevel, RiskLevel.Low);
    assert.equal(result.allowedSelect.decisionType, DecisionType.Allow);
    assert.equal(result.executorCallCount, 1);
  });
});
