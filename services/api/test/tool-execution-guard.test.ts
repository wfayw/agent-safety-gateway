import assert from "node:assert/strict";
import { appendFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  DecisionType,
  Environment,
  OperationType,
  RiskLevel,
  ToolType,
  type ActionTuple,
  type ExecutionDecision,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";
import {
  EvidenceCoverageStatus,
  ExecutorSafetyEvidenceStateName,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  ForbiddenEffectFailClosedAction,
  ForbiddenEffectSeverity,
  ForbiddenEffectType,
  type EvidenceCoverageEntry,
  type EvidenceCoverageMap,
  type ExecutorSafetyEvidenceState,
  type ForbiddenEffectObligation,
  type PermitBinding,
  type PermitDeniedEvidence,
} from "@agent-safety-gateway/shared/forbidden-side-effect";
import {
  ContextSufficiencyStateName,
  type ContextSufficiencyState,
} from "@agent-safety-gateway/shared/context-retention";

import { runToolGuardDemo } from "../../../scripts/tool-guard-demo.js";
import { createFileApprovalAdapter } from "../src/approval-adapter.js";
import { createAuditRepository } from "../src/audit-repository.js";
import {
  createFileExternalAuditSinkAdapter,
  readExternalAuditSinkRecords,
} from "../src/audit-sink-adapter.js";
import {
  ApprovalRequestStatus,
  createNotConfiguredExternalAuditSinkAdapter,
} from "../src/real-component-adapters.js";
import type {
  ToolCallAnalysisResult,
  ToolCallAnalysisService,
} from "../src/tool-call-analysis-service.js";
import {
  createToolExecutionGuard,
  type ToolExecutionPermitEvidenceSnapshot,
  type ToolExecutionContextEvidenceProvider,
  type ToolExecutionPermitEvidenceProvider,
} from "../src/tool-execution-guard.js";
import { ContextGatewayActionType } from "../src/context-execution-decision-engine.js";
import { initializeLocalStorage } from "../src/storage.js";

const tempDirs: string[] = [];

const createTempDataDir = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "asg-tool-guard-approval-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const permitEvaluatedAt = "2026-04-29T08:09:00.000Z";
const permitValidUntil = "2026-04-29T08:15:00.000Z";
const permitExecutorId = "executor-sql-readonly-prod";

const createCoverageEntry = (
  overrides: Partial<EvidenceCoverageEntry> = {},
): EvidenceCoverageEntry => ({
  obligationId: "obligation-tool-guard-write-denial",
  requiredEvidenceType: ForbiddenEffectEvidenceType.WriteDenial,
  status: EvidenceCoverageStatus.Covered,
  covered: true,
  evidenceHashes: ["sha256:tool-guard-write-denial"],
  reason: "readonly executor rejected write capability probe",
  evaluatedAt: permitEvaluatedAt,
  completedAt: "2026-04-29T08:08:00.000Z",
  expiresAt: permitValidUntil,
  ...overrides,
});

const createCoverageMap = (
  entries: readonly EvidenceCoverageEntry[],
): EvidenceCoverageMap => ({
  coverageMapId: "coverage-map-tool-guard-sql-readonly",
  executorId: permitExecutorId,
  evaluatedAt: permitEvaluatedAt,
  coverage: entries,
  obligations: entries.map((entry) => ({
    obligationId: entry.obligationId,
    status: entry.status,
    covered: entry.covered,
    requiredEvidence: [entry],
  })),
  allObligationsCovered: entries.every(
    (entry) => entry.status === EvidenceCoverageStatus.Covered && entry.covered,
  ),
});

const createSafetyState = (
  overrides: Partial<ExecutorSafetyEvidenceState> = {},
): ExecutorSafetyEvidenceState => ({
  stateId: "safety-state-tool-guard-sql-readonly",
  executorId: permitExecutorId,
  coverageMapId: "coverage-map-tool-guard-sql-readonly",
  state: ExecutorSafetyEvidenceStateName.EvidenceComplete,
  allObligationsCovered: true,
  evaluatedAt: "2026-04-29T08:09:01.000Z",
  coveredObligationIds: ["obligation-tool-guard-write-denial"],
  blockedObligationIds: [],
  blockingStatuses: [],
  transitionReason: "all required obligations are covered by valid evidence",
  validUntil: permitValidUntil,
  coverageMapHash: "sha256:tool-guard-coverage-map",
  safetyEvidenceVersion: "sev-tool-guard-001",
  ...overrides,
});

const createForbiddenEffectObligation = (): ForbiddenEffectObligation => ({
  obligationId: "obligation-tool-guard-write-denial",
  effectType: ForbiddenEffectType.Sql,
  resourceScope: ["orders"],
  environment: ForbiddenEffectEnvironment.Production,
  severity: ForbiddenEffectSeverity.Critical,
  requiredEvidenceTypes: [
    ForbiddenEffectEvidenceType.WriteDenial,
    ForbiddenEffectEvidenceType.NoRowMutation,
  ],
  failClosedAction: ForbiddenEffectFailClosedAction.DenyPermit,
});

const createCompletePermitSnapshot = (): ToolExecutionPermitEvidenceSnapshot => ({
  safetyState: createSafetyState(),
  coverageMap: createCoverageMap([
    createCoverageEntry(),
    createCoverageEntry({
      obligationId: "obligation-tool-guard-no-row-mutation",
      requiredEvidenceType: ForbiddenEffectEvidenceType.NoRowMutation,
      evidenceHashes: ["sha256:tool-guard-no-row-mutation"],
      reason: "sandbox snapshot observed no row mutation",
    }),
  ]),
  forbiddenEffectObligations: [createForbiddenEffectObligation()],
  deniedEvidenceHash: "sha256:tool-guard-denied-evidence-aggregate",
  sideEffectEvidenceHash: "sha256:tool-guard-side-effect-aggregate",
});

const createPermitEvidenceProvider = (
  snapshot: ToolExecutionPermitEvidenceSnapshot | null = createCompletePermitSnapshot(),
) => {
  const permits: PermitBinding[] = [];
  const denials: PermitDeniedEvidence[] = [];
  const provider: ToolExecutionPermitEvidenceProvider = {
    getEvidenceSnapshot() {
      return snapshot;
    },
    appendPermitBinding({ permitBinding }) {
      permits.push(permitBinding);
    },
    appendPermitDeniedEvidence({ permitDeniedEvidence }) {
      denials.push(permitDeniedEvidence);
    },
  };

  return { provider, permits, denials };
};

const createCountingPermitEvidenceProvider = () => {
  let snapshotCallCount = 0;
  const provider: ToolExecutionPermitEvidenceProvider = {
    getEvidenceSnapshot() {
      snapshotCallCount += 1;
      return createCompletePermitSnapshot();
    },
  };

  return {
    provider,
    get snapshotCallCount() {
      return snapshotCallCount;
    },
  };
};

const createContextSufficiencyState = (
  overrides: Partial<ContextSufficiencyState> = {},
): ContextSufficiencyState => ({
  stateId: "context-state-tool-guard",
  obligationId: "required-context-tool-guard",
  toolCallDigest: "sha256:tool-guard-context-tool-call",
  promptAssemblyManifestId: "manifest-tool-guard-context",
  inferenceId: "inference-tool-guard-context",
  state: ContextSufficiencyStateName.Sufficient,
  sufficient: true,
  evaluatedAt: "2026-04-29T08:09:59.000Z",
  requiredAnchorIds: ["ctx-latest-user-instruction"],
  coveredAnchorIds: ["ctx-latest-user-instruction"],
  blockedAnchorIds: [],
  missingAnchorIds: [],
  staleAnchorIds: [],
  conflictingAnchorIds: [],
  contaminatedAnchorIds: [],
  verbatimAnchorIds: ["ctx-latest-user-instruction"],
  certifiedSummaryAnchorIds: [],
  retrievableReferenceAnchorIds: [],
  transitionReason: "all required context anchors are retained verbatim",
  ...overrides,
});

const createContextEvidenceProvider = (
  state: ContextSufficiencyState,
): ToolExecutionContextEvidenceProvider => ({
  getContextSufficiencyState() {
    return state;
  },
});

const policyVersion = "local-risk-policy-v1";

const policyTrace = {
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
      description: "Block production DELETE operations that touch critical resources.",
      matched: false,
    },
    {
      id: "production_deploy_with_failed_tests",
      description: "Block production deployments with failed validation tests.",
      matched: false,
    },
  ],
  matchedRuleIds: [],
  weightedFactors: [],
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) =>
      rm(tempDir, { recursive: true, force: true }),
    ),
  );
});

const approvalRequest: ToolCallRequest = {
  id: "req-approval-production-deploy",
  actor: "agent:release-bot",
  taskPurpose: "Deploy payment-service to production",
  toolType: ToolType.CiCd,
  rawPayload: {
    service: "payment-service",
    version: "2.0.0",
  },
  environment: Environment.Production,
  createdAt: "2026-04-29T08:00:00.000Z",
};

const createApprovalAnalysisResult = (
  request: ToolCallRequest,
): ToolCallAnalysisResult => {
  const actionTuple: ActionTuple = {
    actor: request.actor,
    taskPurpose: request.taskPurpose,
    toolType: request.toolType,
    operation: OperationType.Deploy,
    target: "payment-service",
    parameters: {
      service: "payment-service",
      version: "2.0.0",
    },
    environment: request.environment,
    timestamp: request.createdAt,
  };
  const executionDecision: ExecutionDecision = {
    type: DecisionType.RequireApproval,
    code: "risk.high.require_approval",
    reason: "Risk level is high for payment-service production deployment.",
    recommendedAction: "Require explicit human approval before executor invocation.",
    rewrittenRequest: null,
  };

  return {
    request,
    actionTuple,
    directResources: [],
    indirectResources: [],
    impactPaths: [],
    riskFactors: [],
    riskScore: {
      riskLevel: RiskLevel.High,
      score: 95,
      explanation: "Risk level is high from weighted score 95.",
      reasons: ["Production deploy requires risk owner review."],
      appliedHardRules: [],
      policyVersion,
      policyTrace,
    },
    riskLevel: RiskLevel.High,
    policyVersion,
    policyTrace,
    executionDecision,
    auditRecordId: "audit-approval-production-deploy",
    auditRecord: {
      id: "audit-approval-production-deploy",
      request,
      actionTuple,
      directResources: [],
      indirectResources: [],
      impactPaths: [],
      riskFactors: [],
      riskLevel: RiskLevel.High,
      policyVersion,
      policyTrace,
      decision: executionDecision,
      createdAt: "2026-04-29T08:00:01.000Z",
    },
  };
};

const createApprovalAnalysisService = (): ToolCallAnalysisService => ({
  async analyzeToolCall(request) {
    return createApprovalAnalysisResult(request);
  },
});

const allowedRequest: ToolCallRequest = {
  id: "req-sql-readonly-orders",
  actor: "agent:analyst",
  taskPurpose: "Read recent orders",
  toolType: ToolType.Sql,
  rawPayload: {
    sql: "SELECT * FROM orders LIMIT 10",
  },
  environment: Environment.Production,
  createdAt: "2026-04-29T08:10:00.000Z",
};

const createAllowedAnalysisResult = (
  request: ToolCallRequest,
): ToolCallAnalysisResult => {
  const actionTuple: ActionTuple = {
    actor: request.actor,
    taskPurpose: request.taskPurpose,
    toolType: request.toolType,
    operation: OperationType.Read,
    target: "orders",
    parameters: request.rawPayload,
    environment: request.environment,
    timestamp: request.createdAt,
  };
  const executionDecision: ExecutionDecision = {
    type: DecisionType.Allow,
    code: "risk.low.allow",
    reason: "Read-only SQL is allowed.",
    recommendedAction: "Execute with a readonly adapter.",
    rewrittenRequest: null,
  };

  return {
    request,
    actionTuple,
    directResources: [],
    indirectResources: [],
    impactPaths: [],
    riskFactors: [],
    riskScore: {
      riskLevel: RiskLevel.Low,
      score: 10,
      explanation: "Risk level is low from weighted score 10.",
      reasons: ["Read-only operation."],
      appliedHardRules: [],
      policyVersion,
      policyTrace,
    },
    riskLevel: RiskLevel.Low,
    policyVersion,
    policyTrace,
    executionDecision,
    auditRecordId: "audit-sql-readonly-orders",
    auditRecord: {
      id: "audit-sql-readonly-orders",
      request,
      actionTuple,
      directResources: [],
      indirectResources: [],
      impactPaths: [],
      riskFactors: [],
      riskLevel: RiskLevel.Low,
      policyVersion,
      policyTrace,
      decision: executionDecision,
      createdAt: "2026-04-29T08:10:01.000Z",
    },
  };
};

const createAllowedAnalysisService = (): ToolCallAnalysisService => ({
  async analyzeToolCall(request) {
    return createAllowedAnalysisResult(request);
  },
});

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

describe("tool execution guard approval control", () => {
  it("creates a held approval request and does not invoke the executor", async () => {
    const filePath = join(await createTempDataDir(), "approval-requests.jsonl");
    const approvalAdapter = createFileApprovalAdapter({
      filePath,
      now: () => new Date("2026-04-29T08:00:02.000Z"),
    });
    let executorCallCount = 0;
    const guard = createToolExecutionGuard({
      analysisService: createApprovalAnalysisService(),
      approvalAdapter,
      defaultApproverGroup: "release-risk-owners",
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const result = await guard.execute(approvalRequest);

    assert.equal(result.status, "held");
    assert.equal(result.executorInvoked, false);
    assert.equal(result.executorResult, null);
    assert.equal(executorCallCount, 0);
    assert.deepEqual(result.approvalRequest, {
      requestId: "req-approval-production-deploy",
      auditId: "audit-approval-production-deploy",
      actor: "agent:release-bot",
      target: "payment-service",
      riskLevel: RiskLevel.High,
      decisionReason:
        "Risk level is high for payment-service production deployment.",
      approverGroup: "release-risk-owners",
      status: ApprovalRequestStatus.Held,
      createdAt: "2026-04-29T08:00:02.000Z",
    });
    assert.deepEqual(
      await approvalAdapter.getApprovalRequest("req-approval-production-deploy"),
      result.approvalRequest,
    );
  });

  it("invokes the executor only after the approval adapter reports approved", async () => {
    const filePath = join(await createTempDataDir(), "approval-requests.jsonl");
    const approvalAdapter = createFileApprovalAdapter({ filePath });
    const approvedRequest = {
      requestId: "req-approval-production-deploy",
      auditId: "audit-approval-production-deploy",
      actor: "agent:release-bot",
      target: "payment-service",
      riskLevel: RiskLevel.High,
      decisionReason:
        "Risk level is high for payment-service production deployment.",
      approverGroup: "release-risk-owners",
      status: ApprovalRequestStatus.Approved,
      createdAt: "2026-04-29T08:05:00.000Z",
    };

    await appendFile(filePath, `${JSON.stringify(approvedRequest)}\n`, "utf8");

    let executorCallCount = 0;
    const permitEvidence = createPermitEvidenceProvider();
    const guard = createToolExecutionGuard({
      analysisService: createApprovalAnalysisService(),
      approvalAdapter,
      permitEvidenceProvider: permitEvidence.provider,
      permitNonceFactory: () => "nonce-approved-approval-path",
      now: () => new Date("2026-04-29T08:10:00.000Z"),
      async executor(request) {
        executorCallCount += 1;
        return { ok: true, requestId: request.id };
      },
    });

    const result = await guard.execute(approvalRequest);

    assert.equal(result.status, "executed");
    assert.equal(result.executorInvoked, true);
    assert.equal(executorCallCount, 1);
    assert.deepEqual(result.approvalRequest, approvedRequest);
    assert.equal(result.permitBinding?.nonce, "nonce-approved-approval-path");
    assert.equal(permitEvidence.permits.length, 1);
    assert.deepEqual(result.executorResult, {
      ok: true,
      requestId: "req-approval-production-deploy",
    });
  });
});

describe("tool execution guard context preflight", () => {
  it("returns a structured reground action before permit checks", async () => {
    let executorCallCount = 0;
    const permitEvidence = createCountingPermitEvidenceProvider();
    const contextState = createContextSufficiencyState({
      state: ContextSufficiencyStateName.RegroundRequired,
      sufficient: false,
      coveredAnchorIds: [],
      blockedAnchorIds: ["ctx-latest-user-instruction"],
      missingAnchorIds: ["ctx-latest-user-instruction"],
      verbatimAnchorIds: [],
      transitionReason:
        "one or more required context anchors are missing and policy allows regrounding",
    });
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      contextEvidenceProvider: createContextEvidenceProvider(contextState),
      permitEvidenceProvider: permitEvidence.provider,
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const result = await guard.execute(allowedRequest);

    assert.equal(result.status, "held");
    assert.equal(result.executorInvoked, false);
    assert.equal(executorCallCount, 0);
    assert.equal(permitEvidence.snapshotCallCount, 0);
    assert.equal(result.decision.type, DecisionType.Rewrite);
    assert.equal(result.decision.code, "context.reground_required");
    assert.equal(result.contextAction?.type, ContextGatewayActionType.Reground);
    assert.equal(
      result.contextAction?.nextStep,
      "regenerate_tool_call_after_regrounding",
    );
    assert.deepEqual(result.contextAction?.missingAnchorIds, [
      "ctx-latest-user-instruction",
    ]);
    assert.deepEqual(result.contextSufficiencyState, contextState);
    assert.equal(result.permitBinding, null);
    assert.equal(result.permitDeniedEvidence, null);
  });

  it("creates an approval flow for ReapprovalRequired and skips executor checks", async () => {
    const filePath = join(await createTempDataDir(), "context-approvals.jsonl");
    const approvalAdapter = createFileApprovalAdapter({
      filePath,
      now: () => new Date("2026-04-29T08:10:05.000Z"),
    });
    let executorCallCount = 0;
    const permitEvidence = createCountingPermitEvidenceProvider();
    const contextState = createContextSufficiencyState({
      state: ContextSufficiencyStateName.ReapprovalRequired,
      sufficient: false,
      coveredAnchorIds: [],
      blockedAnchorIds: ["ctx-approval-note"],
      missingAnchorIds: ["ctx-approval-note"],
      verbatimAnchorIds: [],
      transitionReason:
        "required approval note is missing verbatim retention and policy requires reapproval",
    });
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      approvalAdapter,
      defaultApproverGroup: "context-risk-owners",
      contextEvidenceProvider: createContextEvidenceProvider(contextState),
      permitEvidenceProvider: permitEvidence.provider,
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const result = await guard.execute(allowedRequest);

    assert.equal(result.status, "held");
    assert.equal(result.executorInvoked, false);
    assert.equal(executorCallCount, 0);
    assert.equal(permitEvidence.snapshotCallCount, 0);
    assert.equal(result.decision.type, DecisionType.RequireApproval);
    assert.equal(result.decision.code, "context.reapproval_required");
    assert.equal(result.contextAction?.type, ContextGatewayActionType.Reapproval);
    assert.equal(result.approvalRequest?.requestId, allowedRequest.id);
    assert.equal(result.approvalRequest?.approverGroup, "context-risk-owners");
    assert.equal(result.approvalRequest?.status, ApprovalRequestStatus.Held);
    assert.match(
      result.approvalRequest?.decisionReason ?? "",
      /ReapprovalRequired/,
    );
    assert.equal(
      result.analysisResult.auditRecord.decision.code,
      "context.reapproval_required",
    );
  });

  for (const deniedCase of [
    {
      state: ContextSufficiencyStateName.Conflicting,
      code: "context.conflicting.deny",
      overrides: {
        conflictingAnchorIds: ["ctx-conflicting-policy"],
      },
    },
    {
      state: ContextSufficiencyStateName.Contaminated,
      code: "context.contaminated.deny",
      overrides: {
        contaminatedAnchorIds: ["ctx-untrusted-instruction"],
      },
    },
    {
      state: ContextSufficiencyStateName.Insufficient,
      code: "context.insufficient.deny",
      overrides: {
        missingAnchorIds: ["ctx-required-policy"],
      },
    },
  ] as const) {
    it("blocks before permit checks for " + deniedCase.state, async () => {
      let executorCallCount = 0;
      const permitEvidence = createCountingPermitEvidenceProvider();
      const contextState = createContextSufficiencyState({
        state: deniedCase.state,
        sufficient: false,
        coveredAnchorIds: [],
        blockedAnchorIds: ["ctx-blocked-context"],
        verbatimAnchorIds: [],
        transitionReason: deniedCase.state + " prevents safe execution",
        ...deniedCase.overrides,
      });
      const guard = createToolExecutionGuard({
        analysisService: createAllowedAnalysisService(),
        contextEvidenceProvider: createContextEvidenceProvider(contextState),
        permitEvidenceProvider: permitEvidence.provider,
        async executor() {
          executorCallCount += 1;
          return { ok: true };
        },
      });

      const result = await guard.execute(allowedRequest);

      assert.equal(result.status, "blocked");
      assert.equal(result.executorInvoked, false);
      assert.equal(executorCallCount, 0);
      assert.equal(permitEvidence.snapshotCallCount, 0);
      assert.equal(result.decision.type, DecisionType.Block);
      assert.equal(result.decision.code, deniedCase.code);
      assert.equal(result.contextAction?.type, ContextGatewayActionType.Deny);
      assert.equal(result.approvalRequest, null);
      assert.equal(result.permitBinding, null);
      assert.equal(result.permitDeniedEvidence, null);
    });
  }
});

describe("tool execution guard permit gate", () => {
  it("issues a PermitBinding before executor invocation when safety evidence is complete", async () => {
    let executorCallCount = 0;
    const permitEvidence = createPermitEvidenceProvider();
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      permitEvidenceProvider: permitEvidence.provider,
      permitNonceFactory: () => "nonce-complete-permit",
      now: () => new Date("2026-04-29T08:10:00.000Z"),
      async executor(request) {
        executorCallCount += 1;
        return { ok: true, requestId: request.id };
      },
    });

    const result = await guard.execute(allowedRequest);

    assert.equal(result.status, "executed");
    assert.equal(result.executorInvoked, true);
    assert.equal(executorCallCount, 1);
    assert.equal(result.permitDeniedEvidence, null);
    assert.deepEqual(result.permitBinding, {
      requestHash: result.permitBinding?.requestHash,
      executorId: permitExecutorId,
      safetyEvidenceVersion: "sev-tool-guard-001",
      coverageMapHash: "sha256:tool-guard-coverage-map",
      deniedEvidenceHash: "sha256:tool-guard-denied-evidence-aggregate",
      sideEffectEvidenceHash: "sha256:tool-guard-side-effect-aggregate",
      ttl: 300000,
      nonce: "nonce-complete-permit",
    });
    assert.match(result.permitBinding?.requestHash ?? "", /^sha256:/);
    assert.deepEqual(permitEvidence.permits, [result.permitBinding]);
  });

  it("routes executor invocation through the broker and rejects mismatched executor permits", async () => {
    let executorCallCount = 0;
    const permitEvidence = createPermitEvidenceProvider();
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      executorId: "executor-sql-readonly-current",
      permitEvidenceProvider: permitEvidence.provider,
      permitNonceFactory: () => "nonce-mismatched-executor-permit",
      now: () => new Date("2026-04-29T08:10:00.000Z"),
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const result = await guard.execute(allowedRequest);

    assert.equal(result.status, "blocked");
    assert.equal(result.executorInvoked, false);
    assert.equal(result.executorResult, null);
    assert.equal(executorCallCount, 0);
    assert.equal(result.permitBinding, null);
    assert.equal(
      result.permitDeniedEvidence?.reason,
      "executor broker rejected mismatched permit binding for executor executor-sql-readonly-prod; expected executor-sql-readonly-current",
    );
    assert.equal(result.permitDeniedEvidence?.executorInvoked, false);
    assert.equal(result.permitDeniedEvidence?.executorId, "executor-sql-readonly-current");
    assert.equal(permitEvidence.permits.length, 1);
    assert.deepEqual(permitEvidence.denials, [result.permitDeniedEvidence]);
  });

  it("fails closed with PermitDeniedEvidence when no evidence provider is configured", async () => {
    let executorCallCount = 0;
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const result = await guard.execute(allowedRequest);

    assert.equal(result.status, "blocked");
    assert.equal(result.executorInvoked, false);
    assert.equal(result.executorResult, null);
    assert.equal(executorCallCount, 0);
    assert.equal(result.permitBinding, null);
    assert.equal(
      result.permitDeniedEvidence?.reason,
      "executor safety evidence provider is not configured",
    );
    assert.equal(result.permitDeniedEvidence?.executorId, "unbound-executor");
    assert.equal(result.permitDeniedEvidence?.permitIssued, false);
    assert.equal(result.permitDeniedEvidence?.executorInvoked, false);
  });

  const deniedStateCases = [
    {
      name: "missing",
      state: ExecutorSafetyEvidenceStateName.EvidenceMissing,
      coverageStatus: EvidenceCoverageStatus.Missing,
      reason: "no required evidence has been covered",
    },
    {
      name: "partial",
      state: ExecutorSafetyEvidenceStateName.EvidencePartial,
      coverageStatus: EvidenceCoverageStatus.Missing,
      reason:
        "some required obligations are covered, but at least one required evidence type is incomplete",
    },
    {
      name: "expired",
      state: ExecutorSafetyEvidenceStateName.EvidenceExpired,
      coverageStatus: EvidenceCoverageStatus.Stale,
      reason: "one or more required evidence records are stale or past TTL",
    },
    {
      name: "invalidated",
      state: ExecutorSafetyEvidenceStateName.EvidenceInvalidated,
      coverageStatus: EvidenceCoverageStatus.Invalidated,
      reason: "one or more required evidence records were invalidated",
    },
    {
      name: "failed",
      state: ExecutorSafetyEvidenceStateName.EvidenceFailed,
      coverageStatus: EvidenceCoverageStatus.Failed,
      reason: "one or more required evidence records failed safety proof",
    },
  ];

  for (const deniedCase of deniedStateCases) {
    it(`creates PermitDeniedEvidence and skips executor for ${deniedCase.name} evidence`, async () => {
      let executorCallCount = 0;
      const coverageEntry = createCoverageEntry({
        status: deniedCase.coverageStatus,
        covered: false,
        evidenceHashes: ["sha256:tool-guard-denied-state-evidence"],
        ...(deniedCase.coverageStatus === EvidenceCoverageStatus.Invalidated
          ? { invalidatedAt: "2026-04-29T08:09:30.000Z" }
          : {}),
      });
      const snapshot = {
        safetyState: createSafetyState({
          state: deniedCase.state,
          allObligationsCovered: false,
          blockedObligationIds: [coverageEntry.obligationId],
          blockingStatuses: [deniedCase.coverageStatus],
          transitionReason: deniedCase.reason,
          ...(deniedCase.state === ExecutorSafetyEvidenceStateName.EvidenceInvalidated
            ? { invalidatedBy: "executor drift changed credential" }
            : {}),
        }),
        coverageMap: createCoverageMap([coverageEntry]),
      } satisfies ToolExecutionPermitEvidenceSnapshot;
      const permitEvidence = createPermitEvidenceProvider(snapshot);
      const guard = createToolExecutionGuard({
        analysisService: createAllowedAnalysisService(),
        permitEvidenceProvider: permitEvidence.provider,
        now: () => new Date("2026-04-29T08:10:00.000Z"),
        async executor() {
          executorCallCount += 1;
          return { ok: true };
        },
      });

      const result = await guard.execute(allowedRequest);

      assert.equal(result.status, "blocked");
      assert.equal(result.executorInvoked, false);
      assert.equal(executorCallCount, 0);
      assert.equal(result.permitBinding, null);
      assert.equal(result.permitDeniedEvidence?.executorId, permitExecutorId);
      assert.deepEqual(result.permitDeniedEvidence?.missingEvidence, [
        ForbiddenEffectEvidenceType.WriteDenial,
      ]);
      assert.deepEqual(permitEvidence.denials, [result.permitDeniedEvidence]);
    });
  }

  it("persists obligations, coverage hash, state, permit, and invocation status on audit records", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const auditRepository = createAuditRepository(layout);
    let executorCallCount = 0;
    const permitEvidence = createPermitEvidenceProvider();
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      auditRepository,
      permitEvidenceProvider: permitEvidence.provider,
      permitNonceFactory: () => "nonce-persisted-audit-permit",
      now: () => new Date("2026-04-29T08:10:00.000Z"),
      async executor(request) {
        executorCallCount += 1;
        return { ok: true, requestId: request.id };
      },
    });

    await auditRepository.createAuditRecord(
      createAllowedAnalysisResult(allowedRequest).auditRecord,
    );

    const result = await guard.execute(allowedRequest);
    const auditRecord = await auditRepository.getAuditRecordById(result.auditId);

    assert.equal(result.status, "executed");
    assert.equal(executorCallCount, 1);
    assert.deepEqual(
      auditRecord?.forbiddenEffectObligations,
      createCompletePermitSnapshot().forbiddenEffectObligations,
    );
    assert.equal(auditRecord?.coverageMapHash, "sha256:tool-guard-coverage-map");
    assert.deepEqual(auditRecord?.safetyEvidenceState, createSafetyState());
    assert.equal(auditRecord?.permitIssued, true);
    assert.equal(auditRecord?.executorInvoked, true);
    assert.deepEqual(auditRecord?.permitBinding, result.permitBinding);
    assert.equal(auditRecord?.permitDeniedEvidence, null);
  });

  it("persists PermitDeniedEvidence and executorInvoked=false on audit records", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const auditRepository = createAuditRepository(layout);
    let executorCallCount = 0;
    const coverageEntry = createCoverageEntry({
      status: EvidenceCoverageStatus.Missing,
      covered: false,
      evidenceHashes: [],
      reason: "write denial evidence is missing",
    });
    const snapshot = {
      safetyState: createSafetyState({
        state: ExecutorSafetyEvidenceStateName.EvidencePartial,
        allObligationsCovered: false,
        coveredObligationIds: [],
        blockedObligationIds: [coverageEntry.obligationId],
        blockingStatuses: [EvidenceCoverageStatus.Missing],
        transitionReason: "write denial evidence is missing",
      }),
      coverageMap: createCoverageMap([coverageEntry]),
      forbiddenEffectObligations: [createForbiddenEffectObligation()],
    } satisfies ToolExecutionPermitEvidenceSnapshot;
    const permitEvidence = createPermitEvidenceProvider(snapshot);
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      auditRepository,
      permitEvidenceProvider: permitEvidence.provider,
      now: () => new Date("2026-04-29T08:10:00.000Z"),
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    await auditRepository.createAuditRecord(
      createAllowedAnalysisResult(allowedRequest).auditRecord,
    );

    const result = await guard.execute(allowedRequest);
    const auditRecord = await auditRepository.getAuditRecordById(result.auditId);

    assert.equal(result.status, "blocked");
    assert.equal(executorCallCount, 0);
    assert.equal(auditRecord?.permitIssued, false);
    assert.equal(auditRecord?.executorInvoked, false);
    assert.equal(auditRecord?.permitBinding, null);
    assert.deepEqual(auditRecord?.permitDeniedEvidence, result.permitDeniedEvidence);
    assert.deepEqual(auditRecord?.safetyEvidenceState, snapshot.safetyState);
    assert.deepEqual(
      auditRecord?.forbiddenEffectObligations,
      snapshot.forbiddenEffectObligations,
    );
  });
});

describe("tool execution guard external audit sink", () => {
  it("continues local execution when the audit sink is not configured outside strict mode", async () => {
    let executorCallCount = 0;
    const permitEvidence = createPermitEvidenceProvider();
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      permitEvidenceProvider: permitEvidence.provider,
      permitNonceFactory: () => "nonce-audit-not-configured-path",
      async executor(request) {
        executorCallCount += 1;
        return { ok: true, requestId: request.id };
      },
      now: () => new Date("2026-04-29T08:10:02.000Z"),
    });

    const result = await guard.execute(allowedRequest);

    assert.equal(result.status, "executed");
    assert.equal(result.executorInvoked, true);
    assert.equal(executorCallCount, 1);
    assert.equal(result.permitBinding?.executorId, permitExecutorId);
    assert.equal(permitEvidence.permits.length, 1);
    assert.deepEqual(result.executorResult, {
      ok: true,
      requestId: "req-sql-readonly-orders",
    });
    assert.equal(result.auditSinkResult.status, "not_configured");
    assert.equal(result.auditSinkResult.ok, false);
  });

  it("appends request, analysis, executor outcome, and evidence after execution", async () => {
    const filePath = join(await createTempDataDir(), "external-audit.jsonl");
    const auditSinkAdapter = createFileExternalAuditSinkAdapter({
      filePath,
      sinkName: "company-audit-log-sandbox",
      now: () => new Date("2026-04-29T08:10:03.000Z"),
    });
    const permitEvidence = createPermitEvidenceProvider();
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      auditSinkAdapter,
      permitEvidenceProvider: permitEvidence.provider,
      permitNonceFactory: () => "nonce-external-audit-path",
      async executor(request) {
        return { ok: true, requestId: request.id, rowCount: 10 };
      },
      now: () => new Date("2026-04-29T08:10:02.000Z"),
    });

    const result = await guard.execute(allowedRequest);
    const records = await readExternalAuditSinkRecords(filePath);

    assert.equal(result.status, "executed");
    assert.equal(result.permitBinding?.nonce, "nonce-external-audit-path");
    assert.equal(permitEvidence.permits.length, 1);
    assert.deepEqual(result.auditSinkResult, {
      ok: true,
      status: "appended",
      externalAuditId: "external-audit-sql-readonly-orders",
      evidenceUri: null,
    });
    assert.equal(records.length, 1);
    assert.deepEqual(records[0]?.request, allowedRequest);
    assert.equal(records[0]?.analysisResult.auditRecordId, result.auditId);
    assert.equal(records[0]?.executorInvoked, true);
    assert.deepEqual(records[0]?.executorResult, result.executorResult);
    assert.deepEqual(records[0]?.evidence, {
      environmentName: Environment.Production,
      runId: "audit-sql-readonly-orders",
      sourceSystem: "agent-safety-gateway",
      startedAt: "2026-04-29T08:10:01.000Z",
      completedAt: "2026-04-29T08:10:02.000Z",
      artifactUris: [],
      notes: "decision=allow; executorInvoked=true",
    });
  });

  it("fails closed before executor invocation when strict audit sink is unavailable", async () => {
    let executorCallCount = 0;
    const guard = createToolExecutionGuard({
      analysisService: createAllowedAnalysisService(),
      auditSinkAdapter: createNotConfiguredExternalAuditSinkAdapter([
        "ASG_AUDIT_SINK_URL",
      ]),
      auditSinkStrict: true,
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const result = await guard.execute(allowedRequest);

    assert.equal(result.status, "not_configured");
    assert.equal(result.executorInvoked, false);
    assert.equal(result.executorResult, null);
    assert.equal(executorCallCount, 0);
    assert.deepEqual(result.auditSinkResult, {
      ok: false,
      status: "not_configured",
      externalAuditId: null,
      evidenceUri: null,
      missingRequirements: ["ASG_AUDIT_SINK_URL"],
      message: "External audit sink is not configured: ASG_AUDIT_SINK_URL",
    });
  });
});
