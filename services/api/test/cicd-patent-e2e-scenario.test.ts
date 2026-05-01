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
  CiCdRequiredContextObligationKind,
  compileCiCdRequiredContextObligations,
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
  CiCdForbiddenEffectObligationKind,
  compileCiCdForbiddenEffectObligations,
  evaluateEvidenceCoverageMap,
  evaluateExecutorSafetyEvidenceState,
  EvidenceCoverageStatus,
  ExecutorSafetyEvidenceStateName,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  type EvidenceCoverageRecord,
  type ForbiddenEffectObligation,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import { createDeterministicAgentAdapter } from "../src/agent-adapter.js";
import {
  createCiCdDryRunNegativeProbePlan,
  runCiCdNegativeCapabilityFixture,
  type CiCdPipelineNegativeCapabilityFixture,
} from "../src/cicd-negative-capability-fixture-runner.js";
import {
  createCiCdSideEffectProbePlan,
  createCiCdSideEffectSnapshotStateFromPipelineFixture,
  runCiCdSideEffectSnapshotFixture,
  type CiCdPipelineSideEffectSnapshotFixture,
} from "../src/cicd-side-effect-snapshot-fixture-runner.js";
import { ApprovalRequestStatus } from "../src/real-component-adapters.js";
import type {
  ToolCallAnalysisResult,
  ToolCallAnalysisService,
} from "../src/tool-call-analysis-service.js";
import { createToolCallRequestHash } from "../src/tool-executor-broker.js";
import { createToolExecutionGuard } from "../src/tool-execution-guard.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const taskId = "production-release-with-failed-tests";
const taskPath = join(repoRoot, "sample-workspace/agent-tasks", `${taskId}.md`);
const pipelinePath = join(
  repoRoot,
  "sample-workspace/pipelines/payment-service-release.json",
);
const evidenceDocPath = join(
  repoRoot,
  "docs/evidence/patent/PAG-047-cicd-end-to-end-patent.md",
);
const fixturePath = join(
  repoRoot,
  "docs/evidence/patent/fixtures/PAG-047-cicd-end-to-end-patent-scenario.json",
);
const evaluatedAt = "2026-05-01T10:15:00.000Z";
const completedAt = "2026-05-01T10:13:00.000Z";
const executorId = "cicd-dry-run-fixture-executor";
const executorFingerprint = "sha256:cicd-dry-run-fixture-executor-v1";
const sourceTaskAnchorId = "ctx-source-task-production-release-with-failed-tests";
const dryRunApprovalAnchorId =
  "ctx-approval-dry-run-only-no-production-payment-release";
const testResultAnchorId = "ctx-test-result-failed-integration-payment-release";
const releasePolicyAnchorId = "ctx-release-policy-cicd-production";
const pipelineStateAnchorId = "ctx-pipeline-state-payment-service-release";
const negativeTestEvidenceAnchorId =
  "ctx-negative-evidence-failed-integration-test-payment-release";

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
      id: "production_deploy_failed_tests_requires_patent_evidence",
      description:
        "Production CI/CD deploy with failed tests may reach only a dry-run executor after context and forbidden-effect patent evidence are complete.",
      matched: true,
    },
  ],
  matchedRuleIds: ["production_deploy_failed_tests_requires_patent_evidence"],
  weightedFactors: [],
};

type LocalPipelineFixture = {
  pipelineId: string;
  service: string;
  environment: string;
  candidateVersion?: string;
  currentVersion?: string;
};

const sha256 = (value: unknown) =>
  `sha256:${createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex")}`;

const loadPipelineFixture = async (): Promise<LocalPipelineFixture> =>
  JSON.parse(await readFile(pipelinePath, "utf8")) as LocalPipelineFixture;

const createAnchor = ({
  anchorId,
  anchorType,
  sourceIdentity,
  authorityLevel,
  resourceScope,
  content,
  createdAt = "2026-05-01T10:05:00.000Z",
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
  expiresAt: "2026-05-01T10:45:00.000Z",
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

const createCiCdDeployAnalysisResult = (
  request: ToolCallRequest,
): ToolCallAnalysisResult => {
  const actionTuple: ActionTuple = {
    actor: request.actor,
    taskPurpose: request.taskPurpose,
    toolType: request.toolType,
    operation: OperationType.Deploy,
    target: "payment-service",
    parameters: request.rawPayload,
    environment: request.environment,
    timestamp: request.createdAt,
  };
  const executionDecision: ExecutionDecision = {
    type: DecisionType.RequireApproval,
    code: "risk.high.require_approval",
    reason:
      "Production CI/CD deploy with failed tests requires dry-run-only context and forbidden-side-effect patent evidence before executor invocation.",
    recommendedAction:
      "Require approval, then evaluate context-retention and CI/CD side-effect evidence before permit binding.",
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
      score: 112,
      explanation:
        "Production CI/CD deploy with failed tests is high risk and needs dry-run patent evidence.",
      reasons: [
        "Deploy targets production payment-service release pipeline.",
        "Integration tests are failed, so only dry-run evidence may reach the permit gate.",
      ],
      appliedHardRules: [],
      policyVersion,
      policyTrace,
    },
    riskLevel: RiskLevel.High,
    policyVersion,
    policyTrace,
    executionDecision,
    auditRecordId: "audit-pag047-cicd-dry-run-patent-e2e",
    auditRecord: {
      id: "audit-pag047-cicd-dry-run-patent-e2e",
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
      createdAt: evaluatedAt,
    },
  };
};

const createCiCdDeployAnalysisService = (): ToolCallAnalysisService => ({
  async analyzeToolCall(request) {
    return createCiCdDeployAnalysisResult(request);
  },
});

const createApprovedAdapter = () => ({
  async getApprovalRequest(requestId: string) {
    return {
      requestId,
      auditId: "audit-pag047-cicd-dry-run-patent-e2e",
      actor: "agent:pag047-deterministic-adapter",
      target: "payment-service-release",
      riskLevel: RiskLevel.High,
      decisionReason:
        "PAG-047 fixture approval is explicitly dry-run-only and forbids production deployment side effects.",
      approverGroup: "release-risk-owners",
      status: ApprovalRequestStatus.Approved,
      createdAt: "2026-05-01T10:10:00.000Z",
    };
  },
  async createApprovalRequest() {
    return null;
  },
});

const toNegativeCapabilityFixture = (
  pipelineFixture: LocalPipelineFixture,
): CiCdPipelineNegativeCapabilityFixture => ({
  pipelineId: pipelineFixture.pipelineId,
  service: pipelineFixture.service,
  environment: pipelineFixture.environment,
  ...(pipelineFixture.candidateVersion === undefined
    ? {}
    : { candidateVersion: pipelineFixture.candidateVersion }),
  productionEndpointCalled: false,
  externalWebhookDispatched: false,
  artifactPromoted: false,
});

const toSideEffectFixture = (
  pipelineFixture: LocalPipelineFixture,
): CiCdPipelineSideEffectSnapshotFixture => ({
  pipelineId: pipelineFixture.pipelineId,
  service: pipelineFixture.service,
  environment: pipelineFixture.environment,
  ...(pipelineFixture.candidateVersion === undefined
    ? {}
    : { candidateVersion: pipelineFixture.candidateVersion }),
  ...(pipelineFixture.currentVersion === undefined
    ? {}
    : { currentVersion: pipelineFixture.currentVersion }),
});

const createContextAnchors = ({
  request,
  pipelineFixture,
}: {
  request: ToolCallRequest;
  pipelineFixture: LocalPipelineFixture;
}) => {
  const sourceTaskDigest = String(request.rawPayload.sourceTaskDigest);

  return [
    {
      ...createAnchor({
        anchorId: sourceTaskAnchorId,
        anchorType: ContextAnchorType.UserInstruction,
        sourceIdentity:
          "sample-workspace/agent-tasks/production-release-with-failed-tests.md",
        authorityLevel: "requester",
        resourceScope: "tool_call ci/cd payment-service-release",
        content: "placeholder",
        createdAt: "2026-05-01T10:00:00.000Z",
      }),
      contentDigest: sourceTaskDigest,
      semanticClaimsDigest: sha256({ sourceTaskDigest, semantic: true }),
    },
    createAnchor({
      anchorId: dryRunApprovalAnchorId,
      anchorType: ContextAnchorType.ApprovalNote,
      sourceIdentity:
        "approval:dry-run-only-no-production:payment-service-release",
      authorityLevel: "release-risk-owner",
      resourceScope:
        "approval_note dry-run-only no production payment-service-release",
      content:
        "Approval is dry-run-only: do not call production deploy endpoint, webhook, or artifact promotion.",
      createdAt: "2026-05-01T10:07:00.000Z",
    }),
    createAnchor({
      anchorId: testResultAnchorId,
      anchorType: ContextAnchorType.ToolResult,
      sourceIdentity: "ci:test-result:failed:payment-service-release",
      authorityLevel: "ci-system",
      resourceScope: "payment-service-release failed test",
      content: "integration-test failed for payment-service candidate 1.8.0.",
      createdAt: "2026-05-01T10:03:00.000Z",
    }),
    createAnchor({
      anchorId: releasePolicyAnchorId,
      anchorType: ContextAnchorType.SystemPolicy,
      sourceIdentity: "policy:cicd-release-production",
      authorityLevel: "policy_admin",
      resourceScope: "all-cicd production release deploy",
      content:
        "Production deploys with failed tests must be limited to dry-run evidence and cannot mutate production release state.",
    }),
    createAnchor({
      anchorId: pipelineStateAnchorId,
      anchorType: ContextAnchorType.ResourceState,
      sourceIdentity: "pipeline-state:payment-service-release",
      authorityLevel: "pipeline-fixture",
      resourceScope: "payment-service-release pipeline deploy production",
      content: `${pipelineFixture.pipelineId} has candidate ${
        pipelineFixture.candidateVersion ?? "unknown"
      } and deploy stage not_started after failed integration-test.`,
      createdAt: "2026-05-01T10:04:00.000Z",
    }),
    createAnchor({
      anchorId: negativeTestEvidenceAnchorId,
      anchorType: ContextAnchorType.NegativeEvidence,
      sourceIdentity: "negative-evidence:failed-test:payment-service-release",
      authorityLevel: "pipeline-fixture",
      resourceScope: "payment-service-release failed test negative evidence",
      content:
        "The integration-test stage is failed; no fixture evidence records a passing replacement result.",
      createdAt: "2026-05-01T10:06:00.000Z",
    }),
  ] satisfies readonly ContextAnchor[];
};

const runNegativeCapabilityEvidenceForObligations = async ({
  obligations,
  pipelineFixture,
}: {
  obligations: readonly ForbiddenEffectObligation[];
  pipelineFixture: LocalPipelineFixture;
}) => {
  const runs = [];

  for (const obligation of obligations) {
    const plan = createCiCdDryRunNegativeProbePlan({
      probePlanId: `nprobe-pag047-${obligation.obligationId.replace(/[^a-z0-9]+/gi, "-")}`,
      executorId,
      obligationIds: [obligation.obligationId],
      service: pipelineFixture.service,
      pipelineId: pipelineFixture.pipelineId,
      candidateVersion: pipelineFixture.candidateVersion,
    });
    const run = await runCiCdNegativeCapabilityFixture({
      plan,
      obligations,
      pipelineFixture: toNegativeCapabilityFixture(pipelineFixture),
      executorFingerprint,
      completedAt,
    });

    runs.push(run);
  }

  return runs;
};

const buildScenario = async () => {
  const pipelineFixture = await loadPipelineFixture();
  const adapter = createDeterministicAgentAdapter({
    defaultCreatedAt: "2026-05-01T10:00:00.000Z",
  });
  const adapterOutput = await adapter.adaptTask({
    taskId,
    taskPath,
    actor: "agent:pag047-deterministic-adapter",
  });
  const requestHash = createToolCallRequestHash(adapterOutput.request);
  const anchors = createContextAnchors({
    request: adapterOutput.request,
    pipelineFixture,
  });
  const resourceScope = [
    pipelineFixture.service,
    pipelineFixture.pipelineId,
    pipelineFixture.environment,
  ];
  const requiredContextCompilation = compileCiCdRequiredContextObligations({
    requestId: adapterOutput.request.id,
    operation: "deploy",
    service: pipelineFixture.service,
    pipeline: pipelineFixture.pipelineId,
    version: pipelineFixture.candidateVersion,
    environment: pipelineFixture.environment,
    targetEnvironment: pipelineFixture.environment,
    requiredExecutionMode: "dry_run",
    dryRun: true,
    testStatus: "failed",
    resourceScope,
    toolCallDigest: requestHash,
    availableAnchors: anchors,
  });
  const [requiredContextObligation] = requiredContextCompilation.obligations;
  assert.ok(requiredContextObligation);
  const missingFailedTestManifest = extendManifestWithAnchors({
    baseManifest: adapterOutput.promptAssemblyManifest,
    anchors: anchors.filter(
      (anchor) => anchor.anchorId !== negativeTestEvidenceAnchorId,
    ),
    manifestId: "prompt-manifest-pag047-cicd-missing-failed-test-context",
  });
  const validContextManifest = extendManifestWithAnchors({
    baseManifest: adapterOutput.promptAssemblyManifest,
    anchors,
    manifestId: "prompt-manifest-pag047-cicd-valid-dry-run-context",
  });
  const missingFailedTestContextEvidence = matchContextRetentionEvidence({
    obligation: requiredContextObligation,
    manifest: missingFailedTestManifest,
    anchors,
    evaluatedAt,
  });
  const missingFailedTestContextState = evaluateContextSufficiencyState({
    obligation: requiredContextObligation,
    evidence: missingFailedTestContextEvidence,
    anchors,
    evaluatedAt,
    stateId: "context-state-pag047-cicd-missing-failed-test-context",
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
    stateId: "context-state-pag047-cicd-valid-dry-run-context",
  });
  const forbiddenCompilation = compileCiCdForbiddenEffectObligations({
    requestId: adapterOutput.request.id,
    requestHash,
    operation: "deploy",
    service: pipelineFixture.service,
    pipeline: pipelineFixture.pipelineId,
    version: pipelineFixture.candidateVersion,
    environment: ForbiddenEffectEnvironment.Production,
    targetEnvironment: ForbiddenEffectEnvironment.Production,
    requiredExecutionMode: "dry_run",
    dryRun: true,
    testStatus: "failed",
    resourceScope,
  });
  const negativeCapabilityRuns = await runNegativeCapabilityEvidenceForObligations({
    obligations: forbiddenCompilation.obligations,
    pipelineFixture,
  });
  const beforeSnapshot = createCiCdSideEffectSnapshotStateFromPipelineFixture(
    toSideEffectFixture(pipelineFixture),
  );
  const afterSnapshot = createCiCdSideEffectSnapshotStateFromPipelineFixture(
    toSideEffectFixture(pipelineFixture),
  );
  const sideEffectRun = await runCiCdSideEffectSnapshotFixture({
    plan: createCiCdSideEffectProbePlan({
      probePlanId: "sprobe-pag047-cicd-dry-run-no-side-effects",
      executorId,
      obligationIds: forbiddenCompilation.obligations.map(
        (obligation) => obligation.obligationId,
      ),
      service: pipelineFixture.service,
      pipelineId: pipelineFixture.pipelineId,
      candidateVersion: pipelineFixture.candidateVersion,
    }),
    obligations: forbiddenCompilation.obligations,
    executorFingerprint,
    beforeSnapshot,
    afterSnapshot,
    completedAt,
  });
  const coverageRecords: EvidenceCoverageRecord[] = [
    ...negativeCapabilityRuns.flatMap((run) => run.coverageRecords),
    ...sideEffectRun.coverageRecords,
  ];
  const coverageMap = evaluateEvidenceCoverageMap(
    forbiddenCompilation.obligations,
    coverageRecords,
    {
      coverageMapId: "coverage-map-pag047-cicd-dry-run-no-deploy",
      executorId,
      evaluatedAt,
    },
  );
  const safetyState = evaluateExecutorSafetyEvidenceState(coverageMap, {
    stateId: "safety-state-pag047-cicd-dry-run-no-deploy-complete",
    coverageMapHash: "sha256:pag047-cicd-dry-run-no-deploy-coverage-map",
    safetyEvidenceVersion: "sev-pag047-cicd-dry-run-no-deploy-v1",
    evaluatedAt,
  });

  return {
    adapterOutput,
    pipelineFixture,
    requestHash,
    requiredContextCompilation,
    missingFailedTestContextState,
    validContextState,
    forbiddenCompilation,
    negativeCapabilityRuns,
    sideEffectRun,
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
    analysisService: createCiCdDeployAnalysisService(),
    contextEvidenceProvider: {
      getContextSufficiencyState() {
        return {
          contextSufficiencyState: contextState,
          contextAdequacyEvidenceHash: "sha256:pag047-context-missing-failed-test",
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

describe("PAG-047 CI/CD patent end-to-end scenario", () => {
  it("starts from the production deploy Agent task and permits only dry-run evidence with no deploy side effects", async () => {
    const scenario = await buildScenario();

    assert.equal(
      scenario.adapterOutput.request.id,
      "req-agent-task-production-release-with-failed-tests",
    );
    assert.equal(scenario.adapterOutput.request.toolType, ToolType.CiCd);
    assert.equal(
      scenario.adapterOutput.request.environment,
      Environment.Production,
    );
    assert.deepEqual(
      {
        operation: scenario.adapterOutput.request.rawPayload.operation,
        service: scenario.adapterOutput.request.rawPayload.service,
        version: scenario.adapterOutput.request.rawPayload.version,
        pipeline: scenario.adapterOutput.request.rawPayload.pipeline,
        stage: scenario.adapterOutput.request.rawPayload.stage,
        testStatus: scenario.adapterOutput.request.rawPayload.testStatus,
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
    assert.equal(
      scenario.adapterOutput.promptAssemblyManifest.manifestId,
      "prompt-manifest-agent-task-production-release-with-failed-tests",
    );
    assert.equal(scenario.requiredContextCompilation.operation, "deploy");
    assert.equal(scenario.requiredContextCompilation.dryRun, true);
    assert.equal(scenario.requiredContextCompilation.testStatus, "failed");
    assert.equal(
      scenario.requiredContextCompilation.obligationKind,
      CiCdRequiredContextObligationKind.DryRunDeployContext,
    );
    assert.equal(scenario.requiredContextCompilation.dryRunOnlyApproval, true);
    assert.equal(
      scenario.requiredContextCompilation.requiresNegativeEvidenceAnchors,
      true,
    );
    assert.deepEqual(
      scenario.requiredContextCompilation.obligations[0]?.requiredAnchors,
      [
        sourceTaskAnchorId,
        dryRunApprovalAnchorId,
        testResultAnchorId,
        releasePolicyAnchorId,
        pipelineStateAnchorId,
        negativeTestEvidenceAnchorId,
      ],
    );
    assert.equal(scenario.forbiddenCompilation.operation, "deploy");
    assert.equal(scenario.forbiddenCompilation.dryRun, true);
    assert.equal(scenario.forbiddenCompilation.testStatus, "failed");
    assert.equal(scenario.forbiddenCompilation.failClosed, true);
    assert.deepEqual(
      scenario.forbiddenCompilation.obligations.map((obligation) => {
        const kind = obligation.obligationId.includes("no_real_deploy")
          ? CiCdForbiddenEffectObligationKind.NoRealDeploy
          : CiCdForbiddenEffectObligationKind.TestsNotPassed;

        return {
          kind,
          requiredEvidenceTypes: obligation.requiredEvidenceTypes,
        };
      }),
      [
        {
          kind: CiCdForbiddenEffectObligationKind.NoRealDeploy,
          requiredEvidenceTypes: [
            ForbiddenEffectEvidenceType.ProductionDeployDenial,
            ForbiddenEffectEvidenceType.ExternalWebhookDenial,
            ForbiddenEffectEvidenceType.ArtifactPromotionDenial,
            ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
            ForbiddenEffectEvidenceType.NoExternalSideEffect,
          ],
        },
        {
          kind: CiCdForbiddenEffectObligationKind.TestsNotPassed,
          requiredEvidenceTypes: [
            ForbiddenEffectEvidenceType.ProductionDeployDenial,
            ForbiddenEffectEvidenceType.ExternalWebhookDenial,
            ForbiddenEffectEvidenceType.ArtifactPromotionDenial,
            ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
          ],
        },
      ],
    );

    const missingContextRun = await executeWithContextState({
      request: scenario.adapterOutput.request,
      contextState: scenario.missingFailedTestContextState,
    });

    assert.equal(
      scenario.missingFailedTestContextState.state,
      ContextSufficiencyStateName.Conflicting,
    );
    assert.equal(missingContextRun.result.status, "blocked");
    assert.equal(missingContextRun.result.decision.type, DecisionType.Block);
    assert.equal(missingContextRun.result.decision.code, "context.conflicting.deny");
    assert.equal(missingContextRun.result.permitBinding, null);
    assert.equal(missingContextRun.result.permitDeniedEvidence, null);
    assert.equal(missingContextRun.result.executorInvoked, false);
    assert.equal(missingContextRun.executorCallCount, 0);

    assert.equal(
      scenario.validContextState.state,
      ContextSufficiencyStateName.Sufficient,
    );
    assert.equal(
      scenario.safetyState.state,
      ExecutorSafetyEvidenceStateName.EvidenceComplete,
    );
    assert.equal(scenario.coverageMap.allObligationsCovered, true);
    assert.equal(
      scenario.coverageMap.coverage.every(
        (entry) => entry.status === EvidenceCoverageStatus.Covered,
      ),
      true,
    );
    assert.equal(
      scenario.negativeCapabilityRuns.every(
        (run) =>
          run.productionEndpointCalled === false &&
          run.externalWebhookDispatched === false &&
          run.artifactPromoted === false &&
          run.failedEvidence.length === 0,
      ),
      true,
    );
    assert.equal(scenario.sideEffectRun.forbiddenEffectsObserved.length, 0);
    assert.equal(scenario.sideEffectRun.failedEvidence.length, 0);

    let executorCallCount = 0;
    const permitBindings: unknown[] = [];
    const guard = createToolExecutionGuard({
      analysisService: createCiCdDeployAnalysisService(),
      executorId,
      approvalAdapter: createApprovedAdapter(),
      contextEvidenceProvider: {
        getContextSufficiencyState() {
          return {
            contextSufficiencyState: scenario.validContextState,
            contextAdequacyEvidenceHash: "sha256:pag047-context-valid-dry-run",
          };
        },
      },
      permitEvidenceProvider: {
        getEvidenceSnapshot() {
          return {
            safetyState: scenario.safetyState,
            coverageMap: scenario.coverageMap,
            forbiddenEffectObligations: scenario.forbiddenCompilation.obligations,
          };
        },
        appendPermitBinding({ permitBinding }) {
          permitBindings.push(permitBinding);
        },
      },
      permitNonceFactory: () => "nonce-pag047-cicd-dry-run",
      now: () => new Date(evaluatedAt),
      async executor() {
        executorCallCount += 1;

        return {
          ok: true,
          mode: "dry_run" as const,
          pipelineConnected: false,
          productionEndpointCalled: false,
          externalWebhookDispatched: false,
          artifactPromoted: false,
        };
      },
    });

    const dryRunPermitResult = await guard.execute(scenario.adapterOutput.request);

    assert.equal(dryRunPermitResult.status, "executed");
    assert.equal(dryRunPermitResult.decision.type, DecisionType.RequireApproval);
    assert.equal(dryRunPermitResult.permitDeniedEvidence, null);
    assert.equal(dryRunPermitResult.permitBinding?.executorId, executorId);
    assert.equal(
      dryRunPermitResult.permitBinding?.contextAdequacyEvidenceHash,
      "sha256:pag047-context-valid-dry-run",
    );
    assert.equal(dryRunPermitResult.executorInvoked, true);
    assert.equal(executorCallCount, 1);
    assert.equal(dryRunPermitResult.executorResult?.mode, "dry_run");
    assert.equal(
      dryRunPermitResult.executorResult?.productionEndpointCalled,
      false,
    );
    assert.equal(
      dryRunPermitResult.executorResult?.externalWebhookDispatched,
      false,
    );
    assert.equal(dryRunPermitResult.executorResult?.artifactPromoted, false);
    assert.deepEqual(permitBindings, [dryRunPermitResult.permitBinding]);

    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

    assert.equal(fixture.storyId, "PAG-047");
    assert.equal(
      fixture.source.agentTaskPath,
      "sample-workspace/agent-tasks/production-release-with-failed-tests.md",
    );
    assert.equal(fixture.source.requestId, scenario.adapterOutput.request.id);
    assert.equal(
      fixture.source.promptAssemblyManifestId,
      scenario.adapterOutput.promptAssemblyManifest.manifestId,
    );
    assert.deepEqual(
      fixture.requiredContext.requiredAnchorIds,
      scenario.requiredContextCompilation.obligations[0]?.requiredAnchors,
    );
    assert.deepEqual(
      fixture.forbiddenEffect.obligations.map(
        (obligation: { requiredEvidenceTypes: readonly string[] }) =>
          obligation.requiredEvidenceTypes,
      ),
      scenario.forbiddenCompilation.obligations.map(
        (obligation) => obligation.requiredEvidenceTypes,
      ),
    );
    assert.equal(fixture.outcomes.missingFailedTestContext.permitIssued, false);
    assert.equal(fixture.outcomes.missingFailedTestContext.executorInvoked, false);
    assert.equal(fixture.outcomes.dryRunPermit.permitIssued, true);
    assert.equal(fixture.outcomes.dryRunPermit.executorInvoked, true);
    assert.equal(fixture.outcomes.dryRunPermit.productionEndpointCalled, false);
    assert.equal(fixture.outcomes.dryRunPermit.externalWebhookDispatched, false);
    assert.equal(fixture.outcomes.dryRunPermit.artifactPromoted, false);

    const evidenceDoc = await readFile(evidenceDocPath, "utf8");

    assert.match(evidenceDoc, /PAG-047 CI\/CD 端到端专利验证场景/);
    assert.match(evidenceDoc, /production-release-with-failed-tests\.md/);
    assert.match(evidenceDoc, /dry-run-only/);
    assert.match(evidenceDoc, /production_deploy_denial/);
    assert.match(evidenceDoc, /\| permitIssued \| `true` \|/);
    assert.match(evidenceDoc, /\| executorInvoked \| `true` \|/);
  });
});
