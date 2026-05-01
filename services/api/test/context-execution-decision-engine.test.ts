import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DecisionType,
  Environment,
  ToolType,
  type ExecutionDecision,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";
import {
  ContextSufficiencyStateName,
  type ContextSufficiencyState,
} from "@agent-safety-gateway/shared/context-retention";

import {
  ContextGatewayActionType,
  createContextExecutionDecisionEngine,
} from "../src/context-execution-decision-engine.js";

const request: ToolCallRequest = {
  id: "req-context-decision",
  actor: "agent:ralph",
  taskPurpose: "Deploy payment-service safely",
  toolType: ToolType.CiCd,
  rawPayload: {
    service: "payment-service",
    version: "2.0.0",
  },
  environment: Environment.Production,
  createdAt: "2026-05-01T08:00:00.000Z",
};

const currentDecision: ExecutionDecision = {
  type: DecisionType.Allow,
  code: "risk.low.allow",
  reason: "Original risk decision allowed execution.",
  recommendedAction: "Allow the executor to run.",
  rewrittenRequest: null,
};

const createContextState = (
  overrides: Partial<ContextSufficiencyState> = {},
): ContextSufficiencyState => ({
  stateId: "context-state-decision-test",
  obligationId: "required-context-payment-deploy",
  toolCallDigest: "sha256:context-decision-tool-call",
  promptAssemblyManifestId: "manifest-context-decision",
  inferenceId: "inference-context-decision",
  state: ContextSufficiencyStateName.Sufficient,
  sufficient: true,
  evaluatedAt: "2026-05-01T08:00:01.000Z",
  requiredAnchorIds: ["ctx-user-instruction"],
  coveredAnchorIds: ["ctx-user-instruction"],
  blockedAnchorIds: [],
  missingAnchorIds: [],
  staleAnchorIds: [],
  conflictingAnchorIds: [],
  contaminatedAnchorIds: [],
  verbatimAnchorIds: ["ctx-user-instruction"],
  certifiedSummaryAnchorIds: [],
  retrievableReferenceAnchorIds: [],
  transitionReason: "all required context anchors are retained verbatim",
  ...overrides,
});

describe("context execution decision engine", () => {
  it("continues to permit checks when context is sufficient", () => {
    const state = createContextState();
    const decision = createContextExecutionDecisionEngine().decideContextExecution({
      request,
      currentDecision,
      contextSufficiencyState: state,
    });

    assert.equal(decision.shouldContinueToPermit, true);
    assert.equal(decision.executionDecision, currentDecision);
    assert.equal(decision.contextAction, null);
    assert.equal(decision.contextSufficiencyState, state);
  });

  it("turns RegroundRequired into a structured reground action", () => {
    const state = createContextState({
      state: ContextSufficiencyStateName.RegroundRequired,
      sufficient: false,
      coveredAnchorIds: [],
      blockedAnchorIds: ["ctx-user-instruction"],
      missingAnchorIds: ["ctx-user-instruction"],
      verbatimAnchorIds: [],
      transitionReason:
        "one or more required context anchors are missing and policy allows regrounding",
    });
    const decision = createContextExecutionDecisionEngine().decideContextExecution({
      request,
      currentDecision,
      contextSufficiencyState: state,
    });

    assert.equal(decision.shouldContinueToPermit, false);
    assert.equal(decision.executionDecision.type, DecisionType.Rewrite);
    assert.equal(decision.executionDecision.code, "context.reground_required");
    assert.equal(decision.contextAction?.type, ContextGatewayActionType.Reground);
    assert.deepEqual(decision.contextAction?.missingAnchorIds, [
      "ctx-user-instruction",
    ]);
    assert.match(
      decision.contextAction?.instruction ?? "",
      /regenerate the tool call/i,
    );
  });

  it("turns ReapprovalRequired into an approval-flow action", () => {
    const state = createContextState({
      state: ContextSufficiencyStateName.ReapprovalRequired,
      sufficient: false,
      coveredAnchorIds: [],
      blockedAnchorIds: ["ctx-approval-note"],
      missingAnchorIds: ["ctx-approval-note"],
      verbatimAnchorIds: [],
      transitionReason:
        "required approval note is missing verbatim retention and policy requires reapproval",
    });
    const decision = createContextExecutionDecisionEngine().decideContextExecution({
      request,
      currentDecision,
      contextSufficiencyState: state,
    });

    assert.equal(decision.shouldContinueToPermit, false);
    assert.equal(decision.executionDecision.type, DecisionType.RequireApproval);
    assert.equal(decision.executionDecision.code, "context.reapproval_required");
    assert.equal(decision.contextAction?.type, ContextGatewayActionType.Reapproval);
    assert.equal(decision.contextAction?.nextStep, "request_reapproval_before_regeneration");
  });

  for (const deniedCase of [
    {
      state: ContextSufficiencyStateName.Conflicting,
      code: "context.conflicting.deny",
      anchors: { conflictingAnchorIds: ["ctx-conflict"] },
    },
    {
      state: ContextSufficiencyStateName.Contaminated,
      code: "context.contaminated.deny",
      anchors: { contaminatedAnchorIds: ["ctx-tainted"] },
    },
    {
      state: ContextSufficiencyStateName.Insufficient,
      code: "context.insufficient.deny",
      anchors: { missingAnchorIds: ["ctx-missing"] },
    },
  ] as const) {
    it(`turns ${deniedCase.state} into a deny decision`, () => {
      const state = createContextState({
        state: deniedCase.state,
        sufficient: false,
        coveredAnchorIds: [],
        blockedAnchorIds: ["ctx-blocked"],
        verbatimAnchorIds: [],
        transitionReason: `${deniedCase.state} prevents safe execution`,
        ...deniedCase.anchors,
      });
      const decision = createContextExecutionDecisionEngine().decideContextExecution({
        request,
        currentDecision,
        contextSufficiencyState: state,
      });

      assert.equal(decision.shouldContinueToPermit, false);
      assert.equal(decision.executionDecision.type, DecisionType.Block);
      assert.equal(decision.executionDecision.code, deniedCase.code);
      assert.equal(decision.contextAction?.type, ContextGatewayActionType.Deny);
      assert.equal(
        decision.contextAction?.nextStep,
        "deny_before_executor_safety_check",
      );
    });
  }
});
