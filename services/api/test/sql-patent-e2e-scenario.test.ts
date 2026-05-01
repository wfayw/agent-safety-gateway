import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

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
  compileSqlRequiredContextObligations,
  ContextAnchorTrustTier,
  ContextAnchorType,
  ContextSufficiencyStateName,
  evaluateContextSufficiencyState,
  matchContextRetentionEvidence,
  type ContextAnchor,
  type ContextSufficiencyState,
  type PromptAssemblyManifest,
} from "@agent-safety-gateway/shared/context-retention";
import {
  compileSqlForbiddenEffectObligations,
  evaluateEvidenceCoverageMap,
  evaluateExecutorSafetyEvidenceState,
  EvidenceCoverageStatus,
  ExecutorSafetyEvidenceStateName,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  type EvidenceCoverageRecord,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import { createDeterministicAgentAdapter } from "../src/agent-adapter.js";
import { ApprovalRequestStatus } from "../src/real-component-adapters.js";
import type {
  ToolCallAnalysisResult,
  ToolCallAnalysisService,
} from "../src/tool-call-analysis-service.js";
import { createToolCallRequestHash } from "../src/tool-executor-broker.js";
import { createToolExecutionGuard } from "../src/tool-execution-guard.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const taskId = "sql-delete-pending-orders";
const taskPath = join(repoRoot, "sample-workspace/agent-tasks", `${taskId}.md`);
const evidenceDocPath = join(
  repoRoot,
  "docs/evidence/patent/PAG-046-sql-end-to-end-patent.md",
);
const fixturePath = join(
  repoRoot,
  "docs/evidence/patent/fixtures/PAG-046-sql-end-to-end-patent-scenario.json",
);
const evaluatedAt = "2026-05-01T09:15:00.000Z";
const executorId = "sql-deny-destructive-fixture-executor";
const sourceTaskAnchorId = "ctx-source-task-sql-delete-pending-orders";
const sqlPolicyAnchorId = "ctx-system-policy-sql-production";
const ordersStateAnchorId = "ctx-resource-state-orders-prod";
const rollbackAnchorId = "ctx-rollback-orders-prod";

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
      id: "production_delete_requires_patent_evidence",
      description:
        "Production SQL DELETE may reach an executor only after context and forbidden-effect patent evidence are complete.",
      matched: true,
    },
  ],
  matchedRuleIds: ["production_delete_requires_patent_evidence"],
  weightedFactors: [],
};

const sha256 = (value: unknown) =>
  `sha256:${createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex")}`;

const createAnchor = ({
  anchorId,
  anchorType,
  sourceIdentity,
  authorityLevel,
  resourceScope,
  content,
  createdAt = "2026-05-01T09:05:00.000Z",
}: {
  anchorId: string;
  anchorType: ContextAnchor["anchorType"];
  sourceIdentity: string;
  authorityLevel: string;
  resourceScope: string;
  content: string;
  createdAt?: string;
}): ContextAnchor => ({
  anchorId,
  anchorType,
  sourceIdentity,
  authorityLevel,
  resourceScope,
  createdAt,
  expiresAt: "2026-05-01T10:00:00.000Z",
  contentDigest: sha256(content),
  semanticClaimsDigest: sha256({ content, semantic: true }),
  mustBeVerbatim: true,
  allowCertifiedSummary: anchorType !== ContextAnchorType.UserInstruction,
  allowRetrievableReference: true,
  trustTier: ContextAnchorTrustTier.High,
});

const extendManifestWithAnchors = ({
  baseManifest,
  anchors,
  manifestId,
}: {
  baseManifest: PromptAssemblyManifest;
  anchors: readonly ContextAnchor[];
  manifestId: string;
}): PromptAssemblyManifest => {
  const existingUnitIds = new Set(baseManifest.contextUnitOrder);
  let nextToken = Math.max(
    ...baseManifest.tokenPositionRanges.map((range) => range.endToken),
  );
  const contextUnitDigests = [...baseManifest.contextUnitDigests];
  const contextUnitOrder = [...baseManifest.contextUnitOrder];
  const tokenPositionRanges = [...baseManifest.tokenPositionRanges];

  for (const anchor of anchors) {
    if (existingUnitIds.has(anchor.anchorId)) {
      continue;
    }

    nextToken += 1;
    existingUnitIds.add(anchor.anchorId);
    contextUnitDigests.push({
      contextUnitId: anchor.anchorId,
      digest: anchor.contentDigest,
    });
    contextUnitOrder.push(anchor.anchorId);
    tokenPositionRanges.push({
      contextUnitId: anchor.anchorId,
      startToken: nextToken,
      endToken: nextToken + 8,
    });
    nextToken += 8;
  }

  return {
    ...baseManifest,
    manifestId,
    promptDigest: sha256({
      basePromptDigest: baseManifest.promptDigest,
      includedAnchorIds: contextUnitOrder,
    }),
    contextUnitDigests,
    contextUnitOrder,
    tokenPositionRanges,
  };
};

const createSqlDeleteAnalysisResult = (
  request: ToolCallRequest,
): ToolCallAnalysisResult => {
  const actionTuple: ActionTuple = {
    actor: request.actor,
    taskPurpose: request.taskPurpose,
    toolType: request.toolType,
    operation: OperationType.Delete,
    target: "orders",
    parameters: request.rawPayload,
    environment: request.environment,
    timestamp: request.createdAt,
  };
  const executionDecision: ExecutionDecision = {
    type: DecisionType.RequireApproval,
    code: "risk.high.require_approval",
    reason:
      "Production SQL DELETE requires context-retention and forbidden-side-effect patent evidence before executor invocation.",
    recommendedAction:
      "Require approval, then evaluate patent evidence before permit binding.",
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
      score: 110,
      explanation: "Production SQL DELETE is high risk and needs patent evidence.",
      reasons: [
        "DELETE touches the production-mode orders data set.",
        "Patent pre-execution gates must complete before executor invocation.",
      ],
      appliedHardRules: [],
      policyVersion,
      policyTrace,
    },
    riskLevel: RiskLevel.High,
    policyVersion,
    policyTrace,
    executionDecision,
    auditRecordId: "audit-pag046-sql-delete-patent-e2e",
    auditRecord: {
      id: "audit-pag046-sql-delete-patent-e2e",
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
      createdAt: "2026-05-01T09:15:00.000Z",
    },
  };
};

const createSqlDeleteAnalysisService = (): ToolCallAnalysisService => ({
  async analyzeToolCall(request) {
    return createSqlDeleteAnalysisResult(request);
  },
});

const createApprovedAdapter = () => ({
  async getApprovalRequest(requestId: string) {
    return {
      requestId,
      auditId: "audit-pag046-sql-delete-patent-e2e",
      actor: "agent:pag046-deterministic-adapter",
      target: "orders",
      riskLevel: RiskLevel.High,
      decisionReason: "PAG-046 fixture approval allows patent gates to run.",
      approverGroup: "database-risk-owners",
      status: ApprovalRequestStatus.Approved,
      createdAt: "2026-05-01T09:12:00.000Z",
    };
  },
  async createApprovalRequest() {
    return null;
  },
});

const buildScenario = async () => {
  const adapter = createDeterministicAgentAdapter({
    defaultCreatedAt: "2026-05-01T09:00:00.000Z",
  });
  const adapterOutput = await adapter.adaptTask({
    taskId,
    taskPath,
    actor: "agent:pag046-deterministic-adapter",
  });
  const requestHash = createToolCallRequestHash(adapterOutput.request);
  const sourceTaskDigest = String(adapterOutput.request.rawPayload.sourceTaskDigest);
  const anchors = [
    {
      ...createAnchor({
        anchorId: sourceTaskAnchorId,
        anchorType: ContextAnchorType.UserInstruction,
        sourceIdentity: "sample-workspace/agent-tasks/sql-delete-pending-orders.md",
        authorityLevel: "requester",
        resourceScope: "database:orders",
        content: "placeholder",
      }),
      contentDigest: sourceTaskDigest,
      semanticClaimsDigest: sha256({ sourceTaskDigest, semantic: true }),
    },
    createAnchor({
      anchorId: sqlPolicyAnchorId,
      anchorType: ContextAnchorType.SystemPolicy,
      sourceIdentity: "policy:sql-production",
      authorityLevel: "policy_admin",
      resourceScope: "database:*",
      content: "Production SQL DELETE requires context proof and executor evidence before permit.",
    }),
    createAnchor({
      anchorId: ordersStateAnchorId,
      anchorType: ContextAnchorType.ResourceState,
      sourceIdentity: "catalog:orders-prod",
      authorityLevel: "catalog",
      resourceScope: "database:orders",
      content: "orders production fixture has PENDING and PAID sample rows.",
    }),
    createAnchor({
      anchorId: rollbackAnchorId,
      anchorType: ContextAnchorType.RetrievedDocument,
      sourceIdentity: "runbook:rollback-orders",
      authorityLevel: "operator_runbook",
      resourceScope: "database:orders:rollback",
      content: "Rollback requires restoring sample-workspace/data/orders.json from the captured pre-run snapshot.",
    }),
  ] satisfies readonly ContextAnchor[];
  const sql = String(adapterOutput.request.rawPayload.sql);
  const requiredContextCompilation = compileSqlRequiredContextObligations({
    requestId: adapterOutput.request.id,
    sql,
    toolCallDigest: requestHash,
    availableAnchors: anchors,
  });
  const [requiredContextObligation] = requiredContextCompilation.obligations;
  assert.ok(requiredContextObligation);
  const invalidContextManifest = extendManifestWithAnchors({
    baseManifest: adapterOutput.promptAssemblyManifest,
    anchors,
    manifestId: "prompt-manifest-pag046-sql-delete-invalid-context",
  });
  const validContextManifest = extendManifestWithAnchors({
    baseManifest: adapterOutput.promptAssemblyManifest,
    anchors,
    manifestId: "prompt-manifest-pag046-sql-delete-valid-context",
  });
  const invalidContextEvidence = matchContextRetentionEvidence({
    obligation: requiredContextObligation,
    manifest: invalidContextManifest,
    anchors,
    evaluatedAt,
    conflictingAnchorIds: [rollbackAnchorId],
  });
  const invalidContextState = evaluateContextSufficiencyState({
    obligation: requiredContextObligation,
    evidence: invalidContextEvidence,
    anchors,
    evaluatedAt,
    stateId: "context-state-pag046-sql-delete-invalid-context",
  });
  const validContextEvidence = matchContextRetentionEvidence({
    obligation: requiredContextObligation,
    manifest: validContextManifest,
    anchors,
    evaluatedAt,
  });
  const validContextState = evaluateContextSufficiencyState({
    obligation: requiredContextObligation,
    evidence: validContextEvidence,
    anchors,
    evaluatedAt,
    stateId: "context-state-pag046-sql-delete-valid-context",
  });
  const forbiddenCompilation = compileSqlForbiddenEffectObligations({
    requestId: adapterOutput.request.id,
    requestHash,
    sql,
    environment: ForbiddenEffectEnvironment.Production,
  });
  const [forbiddenObligation] = forbiddenCompilation.obligations;
  assert.ok(forbiddenObligation);
  const deleteDenialEvidence: EvidenceCoverageRecord = {
    obligationId: forbiddenObligation.obligationId,
    requiredEvidenceType: ForbiddenEffectEvidenceType.DeleteDenial,
    evidenceHash: "sha256:pag046-delete-denial-fixture",
    status: EvidenceCoverageStatus.Covered,
    completedAt: "2026-05-01T09:13:00.000Z",
    expiresAt: "2026-05-01T09:30:00.000Z",
  };
  const coverageMap = evaluateEvidenceCoverageMap(
    forbiddenCompilation.obligations,
    [deleteDenialEvidence],
    {
      coverageMapId: "coverage-map-pag046-sql-delete-missing-side-effect",
      executorId,
      evaluatedAt,
    },
  );
  const safetyState = evaluateExecutorSafetyEvidenceState(coverageMap, {
    stateId: "safety-state-pag046-sql-delete-missing-side-effect",
    coverageMapHash: "sha256:pag046-coverage-map-missing-side-effect",
    safetyEvidenceVersion: "sev-pag046-sql-delete-missing-side-effect-v1",
    evaluatedAt,
  });

  return {
    adapterOutput,
    requestHash,
    requiredContextCompilation,
    invalidContextState,
    validContextState,
    forbiddenCompilation,
    coverageMap,
    safetyState,
  };
};

const executeWithContextState = async ({
  request,
  contextState,
}: {
  request: ToolCallRequest;
  contextState: ContextSufficiencyState;
}) => {
  let executorCallCount = 0;
  const guard = createToolExecutionGuard({
    analysisService: createSqlDeleteAnalysisService(),
    contextEvidenceProvider: {
      getContextSufficiencyState() {
        return {
          contextSufficiencyState: contextState,
          contextAdequacyEvidenceHash: "sha256:pag046-context-adequacy-invalid",
        };
      },
    },
    permitEvidenceProvider: {
      getEvidenceSnapshot() {
        throw new Error("forbidden-effect evidence should not run after context denial");
      },
    },
    approvalAdapter: createApprovedAdapter(),
    now: () => new Date(evaluatedAt),
    async executor() {
      executorCallCount += 1;
      return { ok: true };
    },
  });

  return {
    result: await guard.execute(request),
    executorCallCount,
  };
};

describe("PAG-046 SQL patent end-to-end scenario", () => {
  it("starts from the sample Agent SQL task and proves context plus forbidden-effect DELETE gates", async () => {
    const scenario = await buildScenario();

    assert.equal(
      scenario.adapterOutput.request.id,
      "req-agent-task-sql-delete-pending-orders",
    );
    assert.equal(scenario.adapterOutput.request.toolType, ToolType.Sql);
    assert.equal(scenario.adapterOutput.request.environment, Environment.Production);
    assert.equal(
      scenario.adapterOutput.request.rawPayload.sql,
      "DELETE FROM orders WHERE status='PENDING'",
    );
    assert.equal(
      scenario.adapterOutput.promptAssemblyManifest.manifestId,
      "prompt-manifest-agent-task-sql-delete-pending-orders",
    );
    assert.equal(scenario.requiredContextCompilation.operation, "delete");
    assert.equal(scenario.requiredContextCompilation.obligationKind, "write_context");
    assert.deepEqual(
      scenario.requiredContextCompilation.obligations[0]?.requiredAnchors,
      [
        sourceTaskAnchorId,
        sqlPolicyAnchorId,
        ordersStateAnchorId,
        rollbackAnchorId,
      ],
    );
    assert.equal(scenario.forbiddenCompilation.operation, "delete");
    assert.deepEqual(
      scenario.forbiddenCompilation.obligations[0]?.requiredEvidenceTypes,
      [
        ForbiddenEffectEvidenceType.DeleteDenial,
        ForbiddenEffectEvidenceType.NoRowMutation,
        ForbiddenEffectEvidenceType.NoTriggerSideEffect,
        ForbiddenEffectEvidenceType.NoExternalSideEffect,
      ],
    );

    const invalidContextRun = await executeWithContextState({
      request: scenario.adapterOutput.request,
      contextState: scenario.invalidContextState,
    });

    assert.equal(
      scenario.invalidContextState.state,
      ContextSufficiencyStateName.Conflicting,
    );
    assert.equal(invalidContextRun.result.status, "blocked");
    assert.equal(invalidContextRun.result.decision.type, DecisionType.Block);
    assert.equal(invalidContextRun.result.decision.code, "context.conflicting.deny");
    assert.equal(invalidContextRun.result.permitBinding, null);
    assert.equal(invalidContextRun.result.permitDeniedEvidence, null);
    assert.equal(invalidContextRun.result.executorInvoked, false);
    assert.equal(invalidContextRun.executorCallCount, 0);

    let executorCallCount = 0;
    const permitDenials: unknown[] = [];
    const guard = createToolExecutionGuard({
      analysisService: createSqlDeleteAnalysisService(),
      approvalAdapter: createApprovedAdapter(),
      contextEvidenceProvider: {
        getContextSufficiencyState() {
          return {
            contextSufficiencyState: scenario.validContextState,
            contextAdequacyEvidenceHash: "sha256:pag046-context-adequacy-valid",
          };
        },
      },
      permitEvidenceProvider: {
        getEvidenceSnapshot() {
          return {
            safetyState: scenario.safetyState,
            coverageMap: scenario.coverageMap,
            forbiddenEffectObligations: scenario.forbiddenCompilation.obligations,
            deniedEvidenceHash: "sha256:pag046-delete-denial-fixture",
          };
        },
        appendPermitDeniedEvidence({ permitDeniedEvidence }) {
          permitDenials.push(permitDeniedEvidence);
        },
      },
      now: () => new Date(evaluatedAt),
      async executor() {
        executorCallCount += 1;
        return { ok: true };
      },
    });

    const sideEffectMissingRun = await guard.execute(scenario.adapterOutput.request);

    assert.equal(
      scenario.validContextState.state,
      ContextSufficiencyStateName.Sufficient,
    );
    assert.equal(
      scenario.safetyState.state,
      ExecutorSafetyEvidenceStateName.EvidencePartial,
    );
    assert.equal(sideEffectMissingRun.status, "blocked");
    assert.equal(sideEffectMissingRun.executorInvoked, false);
    assert.equal(executorCallCount, 0);
    assert.equal(sideEffectMissingRun.permitBinding, null);
    assert.equal(sideEffectMissingRun.permitDeniedEvidence?.permitIssued, false);
    assert.equal(sideEffectMissingRun.permitDeniedEvidence?.executorInvoked, false);
    assert.deepEqual(sideEffectMissingRun.permitDeniedEvidence?.missingEvidence, [
      ForbiddenEffectEvidenceType.NoExternalSideEffect,
      ForbiddenEffectEvidenceType.NoRowMutation,
      ForbiddenEffectEvidenceType.NoTriggerSideEffect,
    ]);
    assert.deepEqual(permitDenials, [sideEffectMissingRun.permitDeniedEvidence]);

    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

    assert.equal(fixture.storyId, "PAG-046");
    assert.equal(fixture.source.agentTaskPath, "sample-workspace/agent-tasks/sql-delete-pending-orders.md");
    assert.equal(fixture.source.requestId, scenario.adapterOutput.request.id);
    assert.equal(fixture.source.promptAssemblyManifestId, scenario.adapterOutput.promptAssemblyManifest.manifestId);
    assert.deepEqual(
      fixture.requiredContext.requiredAnchorIds,
      scenario.requiredContextCompilation.obligations[0]?.requiredAnchors,
    );
    assert.deepEqual(
      fixture.forbiddenEffect.requiredEvidenceTypes,
      scenario.forbiddenCompilation.obligations[0]?.requiredEvidenceTypes,
    );
    assert.equal(fixture.outcomes.invalidContext.permitIssued, false);
    assert.equal(fixture.outcomes.invalidContext.executorInvoked, false);
    assert.equal(fixture.outcomes.missingSideEffectEvidence.permitIssued, false);
    assert.equal(fixture.outcomes.missingSideEffectEvidence.executorInvoked, false);

    const evidenceDoc = await readFile(evidenceDocPath, "utf8");

    assert.match(evidenceDoc, /PAG-046 SQL 端到端专利验证场景/);
    assert.match(evidenceDoc, /\| permitIssued \| `false` \|/);
    assert.match(evidenceDoc, /\| executorInvoked \| `false` \|/);
    assert.match(evidenceDoc, /sql-delete-pending-orders\.md/);
  });
});
