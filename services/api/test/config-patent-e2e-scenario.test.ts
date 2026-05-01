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
  ConfigRequiredContextAnchorRole,
  ConfigRequiredContextObligationKind,
  compileConfigRequiredContextObligations,
  ContextAnchorTrustTier,
  ContextAnchorType,
  ContextSufficiencyStateName,
  evaluateContextSufficiencyState,
  matchContextRetentionEvidence,
  type ContextAnchor,
  type ContextSufficiencyState,
  type PromptAssemblyManifest,
  type RequiredContextObligation,
} from "@agent-safety-gateway/shared/context-retention";
import {
  ConfigForbiddenEffectObligationKind,
  ConfigNamespaceClassification,
  ConfigRollbackCapability,
  compileConfigForbiddenEffectObligations,
  evaluateEvidenceCoverageMap,
  evaluateExecutorSafetyEvidenceState,
  EvidenceCoverageStatus,
  ExecutorSafetyEvidenceStateName,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  type EvidenceCoverageRecord,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import { createDeterministicAgentAdapter } from "../src/agent-adapter.js";
import {
  createConfigSandboxNegativeProbePlan,
  runConfigNegativeCapabilityFixture,
  type ConfigStoreNegativeCapabilityFixture,
} from "../src/config-negative-capability-fixture-runner.js";
import {
  createConfigSideEffectProbePlan,
  createConfigSideEffectSnapshotStateFromStoreFixture,
  runConfigSideEffectSnapshotFixture,
  type ConfigNamespaceVersionState,
  type ConfigSideEffectSnapshotFixtureState,
  type ConfigStoreSideEffectSnapshotFixture,
} from "../src/config-side-effect-snapshot-fixture-runner.js";
import { ApprovalRequestStatus } from "../src/real-component-adapters.js";
import type {
  ToolCallAnalysisResult,
  ToolCallAnalysisService,
} from "../src/tool-call-analysis-service.js";
import { createToolCallRequestHash } from "../src/tool-executor-broker.js";
import { createToolExecutionGuard } from "../src/tool-execution-guard.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "../../..");
const taskId = "production-config-timeout-change";
const taskPath = join(repoRoot, "sample-workspace/agent-tasks", `${taskId}.md`);
const configStorePath = join(
  repoRoot,
  "sample-workspace/config-store/payment-service.production.json",
);
const evidenceDocPath = join(
  repoRoot,
  "docs/evidence/patent/PAG-048-config-end-to-end-patent.md",
);
const fixturePath = join(
  repoRoot,
  "docs/evidence/patent/fixtures/PAG-048-config-end-to-end-patent-scenario.json",
);
const evaluatedAt = "2026-05-01T11:15:00.000Z";
const completedAt = "2026-05-01T11:13:00.000Z";
const executorId = "config-sandbox-fixture-executor";
const executorFingerprint = "sha256:config-sandbox-fixture-executor-v1";
const sandboxNamespace = "payment-service-sandbox";
const sourceTaskAnchorId = "ctx-source-task-production-config-timeout-change";
const namespaceConstraintAnchorId =
  "ctx-namespace-constraint-payment-service-sandbox-only";
const configPolicyAnchorId = "ctx-config-policy-sandbox-then-approval";
const currentConfigAnchorId =
  "ctx-current-config-state-payment-timeout-production";
const approvalAnchorId = "ctx-approval-config-sandbox-only-payment-timeout";
const rollbackAnchorId = "ctx-rollback-plan-payment-timeout-production";

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
      id: "production_config_change_requires_patent_evidence",
      description:
        "Production config changes may reach only a sandbox executor after namespace context and forbidden-effect patent evidence are complete.",
      matched: true,
    },
  ],
  matchedRuleIds: ["production_config_change_requires_patent_evidence"],
  weightedFactors: [],
};

type ConfigStoreEntry = {
  key: string;
  value: string;
  sensitivityLevel?: string;
  criticalityLevel?: string;
  rollbackCapability?: string;
  changePolicy?: string;
};

type ConfigStoreFixture = {
  service: string;
  environment: string;
  namespace: string;
  owner?: string;
  lastUpdatedAt?: string;
  entries: readonly ConfigStoreEntry[];
  unsafeChangeExample: {
    key: string;
    previousValue: string;
    requestedValue: string;
    expectedGatewayDecision: string;
  };
};

const sha256 = (value: unknown) =>
  `sha256:${createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex")}`;

const loadConfigStoreFixture = async (): Promise<ConfigStoreFixture> =>
  JSON.parse(await readFile(configStorePath, "utf8")) as ConfigStoreFixture;

const createAnchor = ({
  anchorId,
  anchorType,
  sourceIdentity,
  authorityLevel,
  resourceScope,
  content,
  createdAt = "2026-05-01T11:05:00.000Z",
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
  expiresAt: "2026-05-01T11:45:00.000Z",
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

const createConfigChangeAnalysisResult = (
  request: ToolCallRequest,
): ToolCallAnalysisResult => {
  const actionTuple: ActionTuple = {
    actor: request.actor,
    taskPurpose: request.taskPurpose,
    toolType: request.toolType,
    operation: OperationType.Update,
    target: "payment-service.payment.timeout",
    parameters: request.rawPayload,
    environment: request.environment,
    timestamp: request.createdAt,
  };
  const executionDecision: ExecutionDecision = {
    type: DecisionType.RequireApproval,
    code: "risk.high.require_approval",
    reason:
      "Production config change requires sandbox-only namespace context and forbidden-side-effect patent evidence before executor invocation.",
    recommendedAction:
      "Require approval, then evaluate context-retention and config sandbox side-effect evidence before permit binding.",
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
      score: 96,
      explanation:
        "Production config mutation intent is high risk and needs sandbox namespace patent evidence.",
      reasons: [
        "Agent task requests payment.timeout change for the production namespace.",
        "Only a sandbox config executor may be invoked after production write denial evidence is complete.",
      ],
      appliedHardRules: [],
      policyVersion,
      policyTrace,
    },
    riskLevel: RiskLevel.High,
    policyVersion,
    policyTrace,
    executionDecision,
    auditRecordId: "audit-pag048-config-sandbox-patent-e2e",
    auditRecord: {
      id: "audit-pag048-config-sandbox-patent-e2e",
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

const createConfigChangeAnalysisService = (): ToolCallAnalysisService => ({
  async analyzeToolCall(request) {
    return createConfigChangeAnalysisResult(request);
  },
});

const createApprovedAdapter = () => ({
  async getApprovalRequest(requestId: string) {
    return {
      requestId,
      auditId: "audit-pag048-config-sandbox-patent-e2e",
      actor: "agent:pag048-deterministic-adapter",
      target: "payment-service.payment.timeout",
      riskLevel: RiskLevel.High,
      decisionReason:
        "PAG-048 fixture approval is sandbox-only and forbids production config namespace writes.",
      approverGroup: "config-risk-owners",
      status: ApprovalRequestStatus.Approved,
      createdAt: "2026-05-01T11:10:00.000Z",
    };
  },
  async createApprovalRequest() {
    return null;
  },
});

const toConfigNegativeCapabilityFixture = (
  fixture: ConfigStoreFixture,
): ConfigStoreNegativeCapabilityFixture => ({
  service: fixture.service,
  environment: fixture.environment,
  namespace: fixture.namespace,
  entries: fixture.entries.map((entry) => ({
    key: entry.key,
    value: entry.value,
    ...(entry.rollbackCapability === undefined
      ? {}
      : { rollbackCapability: entry.rollbackCapability }),
  })),
  productionNamespaceWriteAttempted: false,
  productionCredentialUsed: false,
  productionWriteEndpointAccessed: false,
});

const toConfigSideEffectFixture = (
  fixture: ConfigStoreFixture,
): ConfigStoreSideEffectSnapshotFixture => ({
  service: fixture.service,
  environment: fixture.environment,
  namespace: fixture.namespace,
  entries: fixture.entries,
  ...(fixture.owner === undefined ? {} : { owner: fixture.owner }),
  ...(fixture.lastUpdatedAt === undefined
    ? {}
    : { lastUpdatedAt: fixture.lastUpdatedAt }),
});

const updateConfigEntry = (
  state: ConfigNamespaceVersionState,
  key: string,
  value: string,
): ConfigNamespaceVersionState => ({
  ...state,
  entries: state.entries.map((entry) =>
    entry.key === key ? { ...entry, value } : entry,
  ),
  version: "pag048-sandbox-after",
});

const createContextAnchors = ({
  request,
  configFixture,
}: {
  request: ToolCallRequest;
  configFixture: ConfigStoreFixture;
}) => {
  const sourceTaskDigest = String(request.rawPayload.sourceTaskDigest);
  const changeExample = configFixture.unsafeChangeExample;

  return [
    {
      ...createAnchor({
        anchorId: sourceTaskAnchorId,
        anchorType: ContextAnchorType.UserInstruction,
        sourceIdentity:
          "sample-workspace/agent-tasks/production-config-timeout-change.md",
        authorityLevel: "requester",
        resourceScope: "tool_call config payment-service.payment.timeout",
        content: "placeholder",
        createdAt: "2026-05-01T11:00:00.000Z",
      }),
      contentDigest: sourceTaskDigest,
      semanticClaimsDigest: sha256({ sourceTaskDigest, semantic: true }),
    },
    createAnchor({
      anchorId: namespaceConstraintAnchorId,
      anchorType: ContextAnchorType.DelegationConstraint,
      sourceIdentity: "policy:config-namespace-isolation",
      authorityLevel: "policy_admin",
      resourceScope:
        "config namespace constraint payment-service payment.timeout production sandbox isolation",
      content:
        "The production config request may only be evaluated by payment-service-sandbox; production namespace writes, credentials, and write endpoints remain forbidden.",
      createdAt: "2026-05-01T11:06:00.000Z",
    }),
    createAnchor({
      anchorId: configPolicyAnchorId,
      anchorType: ContextAnchorType.SystemPolicy,
      sourceIdentity: "policy:config-sandbox-then-approval",
      authorityLevel: "policy_admin",
      resourceScope: "config policy payment-service payment.timeout production",
      content:
        "payment.timeout uses sandbox_then_approval, so production changes require sandbox evidence before any production config write.",
    }),
    createAnchor({
      anchorId: currentConfigAnchorId,
      anchorType: ContextAnchorType.ResourceState,
      sourceIdentity: "config-store:payment-service.production.json",
      authorityLevel: "config-fixture",
      resourceScope:
        "config current state payment-service.payment.timeout production version",
      content: `${configFixture.service}.${changeExample.key} is ${changeExample.previousValue} in ${configFixture.namespace} as of ${configFixture.lastUpdatedAt}.`,
      createdAt: "2026-05-01T11:04:00.000Z",
    }),
    createAnchor({
      anchorId: approvalAnchorId,
      anchorType: ContextAnchorType.ApprovalNote,
      sourceIdentity: "approval:config-sandbox-only:payment-timeout",
      authorityLevel: "config-risk-owner",
      resourceScope:
        "approval_note production payment-service.payment.timeout sandbox-only",
      content:
        "Approval is sandbox-only: validate payment.timeout=100ms in the sandbox namespace and do not write production config.",
      createdAt: "2026-05-01T11:07:00.000Z",
    }),
    createAnchor({
      anchorId: rollbackAnchorId,
      anchorType: ContextAnchorType.RetrievedDocument,
      sourceIdentity: "runbook:payment-timeout-rollback",
      authorityLevel: "sre_runbook",
      resourceScope: "production payment-service.payment.timeout rollback plan",
      content:
        "Rollback plan restores payment.timeout to 2s from the captured production config fixture if sandbox validation fails.",
      createdAt: "2026-05-01T11:08:00.000Z",
    }),
  ] satisfies readonly ContextAnchor[];
};

const createScenarioRequiredContextObligation = (
  obligation: RequiredContextObligation,
): RequiredContextObligation => {
  const requiredAnchors = [
    sourceTaskAnchorId,
    namespaceConstraintAnchorId,
    configPolicyAnchorId,
    currentConfigAnchorId,
    approvalAnchorId,
    rollbackAnchorId,
  ];

  for (const compiledAnchorId of obligation.requiredAnchors) {
    assert.equal(requiredAnchors.includes(compiledAnchorId), true);
  }

  return {
    ...obligation,
    requiredAnchors,
  };
};

const buildScenario = async () => {
  const configFixture = await loadConfigStoreFixture();
  const changeExample = configFixture.unsafeChangeExample;
  const configEntry = configFixture.entries.find(
    (entry) => entry.key === changeExample.key,
  );
  assert.ok(configEntry);
  const adapter = createDeterministicAgentAdapter({
    defaultCreatedAt: "2026-05-01T11:00:00.000Z",
  });
  const adapterOutput = await adapter.adaptTask({
    taskId,
    taskPath,
    actor: "agent:pag048-deterministic-adapter",
  });
  const requestHash = createToolCallRequestHash(adapterOutput.request);
  const anchors = createContextAnchors({
    request: adapterOutput.request,
    configFixture,
  });
  const requiredContextCompilation = compileConfigRequiredContextObligations({
    requestId: adapterOutput.request.id,
    operation: "update",
    service: configFixture.service,
    key: changeExample.key,
    sourceSystem: "config-store",
    targetNamespace: configFixture.namespace,
    environment: configFixture.environment,
    value: changeExample.requestedValue,
    toolCallDigest: requestHash,
    availableAnchors: anchors,
  });
  const [compiledContextObligation] = requiredContextCompilation.obligations;
  assert.ok(compiledContextObligation);
  const requiredContextObligation = createScenarioRequiredContextObligation(
    compiledContextObligation,
  );
  const missingNamespaceManifest = extendManifestWithAnchors({
    baseManifest: adapterOutput.promptAssemblyManifest,
    anchors: anchors.filter(
      (anchor) => anchor.anchorId !== namespaceConstraintAnchorId,
    ),
    manifestId: "prompt-manifest-pag048-config-missing-namespace-context",
  });
  const validContextManifest = extendManifestWithAnchors({
    baseManifest: adapterOutput.promptAssemblyManifest,
    anchors,
    manifestId: "prompt-manifest-pag048-config-valid-sandbox-context",
  });
  const missingNamespaceContextEvidence = matchContextRetentionEvidence({
    obligation: requiredContextObligation,
    manifest: missingNamespaceManifest,
    anchors,
    evaluatedAt,
  });
  const missingNamespaceContextState = evaluateContextSufficiencyState({
    obligation: requiredContextObligation,
    evidence: missingNamespaceContextEvidence,
    anchors,
    evaluatedAt,
    stateId: "context-state-pag048-config-missing-namespace-context",
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
    stateId: "context-state-pag048-config-valid-sandbox-context",
  });
  const forbiddenCompilation = compileConfigForbiddenEffectObligations({
    requestId: adapterOutput.request.id,
    requestHash,
    operation: "update",
    service: configFixture.service,
    key: changeExample.key,
    sourceSystem: "config-store",
    targetNamespace: sandboxNamespace,
    environment: ForbiddenEffectEnvironment.Production,
    requiredExecutionMode: "sandbox_config_write",
    rollbackCapability: configEntry.rollbackCapability,
  });
  const negativeCapabilityRun = await runConfigNegativeCapabilityFixture({
    plan: createConfigSandboxNegativeProbePlan({
      probePlanId: "nprobe-pag048-config-sandbox-no-production-access",
      executorId,
      obligationIds: forbiddenCompilation.obligations.map(
        (obligation) => obligation.obligationId,
      ),
      service: configFixture.service,
      configKey: changeExample.key,
      productionNamespace: configFixture.namespace,
    }),
    obligations: forbiddenCompilation.obligations,
    configStoreFixture: toConfigNegativeCapabilityFixture(configFixture),
    executorFingerprint,
    completedAt,
  });
  const beforeSnapshot = createConfigSideEffectSnapshotStateFromStoreFixture(
    toConfigSideEffectFixture(configFixture),
    { sandboxNamespace },
  );
  const afterSnapshot: ConfigSideEffectSnapshotFixtureState = {
    productionConfigVersion: beforeSnapshot.productionConfigVersion,
    sandboxConfigVersion: updateConfigEntry(
      {
        ...beforeSnapshot.sandboxConfigVersion,
        entries: configFixture.entries,
      },
      changeExample.key,
      changeExample.requestedValue,
    ),
  };
  const sideEffectRun = await runConfigSideEffectSnapshotFixture({
    plan: createConfigSideEffectProbePlan({
      probePlanId: "sprobe-pag048-config-sandbox-no-production-delta",
      executorId,
      obligationIds: forbiddenCompilation.obligations.map(
        (obligation) => obligation.obligationId,
      ),
      service: configFixture.service,
      configKey: changeExample.key,
      productionNamespace: configFixture.namespace,
      sandboxNamespace,
    }),
    obligations: forbiddenCompilation.obligations,
    executorFingerprint,
    beforeSnapshot,
    afterSnapshot,
    completedAt,
  });
  const coverageRecords: EvidenceCoverageRecord[] = [
    ...negativeCapabilityRun.coverageRecords,
    ...sideEffectRun.coverageRecords,
  ];
  const coverageMap = evaluateEvidenceCoverageMap(
    forbiddenCompilation.obligations,
    coverageRecords,
    {
      coverageMapId: "coverage-map-pag048-config-sandbox-no-production-write",
      executorId,
      evaluatedAt,
    },
  );
  const safetyState = evaluateExecutorSafetyEvidenceState(coverageMap, {
    stateId: "safety-state-pag048-config-sandbox-no-production-write-complete",
    coverageMapHash: "sha256:pag048-config-sandbox-no-production-write-coverage-map",
    safetyEvidenceVersion: "sev-pag048-config-sandbox-no-production-write-v1",
    evaluatedAt,
  });

  return {
    adapterOutput,
    configFixture,
    requestHash,
    requiredContextCompilation,
    requiredContextObligation,
    missingNamespaceContextState,
    validContextState,
    forbiddenCompilation,
    negativeCapabilityRun,
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
    analysisService: createConfigChangeAnalysisService(),
    contextEvidenceProvider: {
      getContextSufficiencyState() {
        return {
          contextSufficiencyState: contextState,
          contextAdequacyEvidenceHash: "sha256:pag048-context-missing-namespace",
        };
      },
    },
    permitEvidenceProvider: {
      getEvidenceSnapshot() {
        throw new Error("forbidden-effect evidence should not run after context hold");
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

describe("PAG-048 config patent end-to-end scenario", () => {
  it("starts from the production config Agent task and permits only sandbox evidence with no production namespace write", async () => {
    const scenario = await buildScenario();
    const changeExample = scenario.configFixture.unsafeChangeExample;

    assert.equal(
      scenario.adapterOutput.request.id,
      "req-agent-task-production-config-timeout-change",
    );
    assert.equal(scenario.adapterOutput.request.toolType, ToolType.Config);
    assert.equal(
      scenario.adapterOutput.request.environment,
      Environment.Production,
    );
    assert.deepEqual(
      {
        operation: scenario.adapterOutput.request.rawPayload.operation,
        service: scenario.adapterOutput.request.rawPayload.service,
        key: scenario.adapterOutput.request.rawPayload.key,
        currentValue: scenario.adapterOutput.request.rawPayload.currentValue,
        value: scenario.adapterOutput.request.rawPayload.value,
        policy: scenario.adapterOutput.request.rawPayload.policy,
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
    assert.equal(
      scenario.adapterOutput.promptAssemblyManifest.manifestId,
      "prompt-manifest-agent-task-production-config-timeout-change",
    );
    assert.equal(scenario.requiredContextCompilation.operation, "update");
    assert.equal(scenario.requiredContextCompilation.namespace, "production");
    assert.equal(
      scenario.requiredContextCompilation.obligationKind,
      ConfigRequiredContextObligationKind.ProductionConfigChangeContext,
    );
    assert.equal(scenario.requiredContextCompilation.dangerousValue, false);
    assert.deepEqual(
      scenario.requiredContextCompilation.requiredAnchorRoles
        .filter((requirement) =>
          [
            ConfigRequiredContextAnchorRole.ApprovalNote,
            ConfigRequiredContextAnchorRole.CurrentConfigState,
            ConfigRequiredContextAnchorRole.RollbackPlan,
          ].includes(requirement.role),
        )
        .map((requirement) => requirement.anchorId),
      [currentConfigAnchorId, approvalAnchorId, rollbackAnchorId],
    );
    assert.deepEqual(scenario.requiredContextObligation.requiredAnchors, [
      sourceTaskAnchorId,
      namespaceConstraintAnchorId,
      configPolicyAnchorId,
      currentConfigAnchorId,
      approvalAnchorId,
      rollbackAnchorId,
    ]);
    assert.equal(scenario.forbiddenCompilation.operation, "update");
    assert.equal(scenario.forbiddenCompilation.namespace, sandboxNamespace);
    assert.equal(
      scenario.forbiddenCompilation.namespaceClassification,
      ConfigNamespaceClassification.Sandbox,
    );
    assert.equal(
      scenario.forbiddenCompilation.rollbackCapability,
      ConfigRollbackCapability.Automatic,
    );
    assert.equal(scenario.forbiddenCompilation.failClosed, false);
    assert.deepEqual(
      scenario.forbiddenCompilation.obligations.map((obligation) => ({
        kind: ConfigForbiddenEffectObligationKind.SandboxIsolation,
        requiredEvidenceTypes: obligation.requiredEvidenceTypes,
      })),
      [
        {
          kind: ConfigForbiddenEffectObligationKind.SandboxIsolation,
          requiredEvidenceTypes: [
            ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
            ForbiddenEffectEvidenceType.ProductionCredentialUseDenial,
            ForbiddenEffectEvidenceType.ProductionWriteEndpointAccessDenial,
            ForbiddenEffectEvidenceType.NoExternalSideEffect,
          ],
        },
      ],
    );

    const missingContextRun = await executeWithContextState({
      request: scenario.adapterOutput.request,
      contextState: scenario.missingNamespaceContextState,
    });

    assert.equal(
      scenario.missingNamespaceContextState.state,
      ContextSufficiencyStateName.ReapprovalRequired,
    );
    assert.equal(missingContextRun.result.status, "held");
    assert.equal(
      missingContextRun.result.decision.type,
      DecisionType.RequireApproval,
    );
    assert.equal(
      missingContextRun.result.decision.code,
      "context.reapproval_required",
    );
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
      scenario.negativeCapabilityRun.productionNamespaceWriteAttempted,
      false,
    );
    assert.equal(scenario.negativeCapabilityRun.productionCredentialUsed, false);
    assert.equal(
      scenario.negativeCapabilityRun.productionWriteEndpointAccessed,
      false,
    );
    assert.equal(scenario.negativeCapabilityRun.failedEvidence.length, 0);
    assert.equal(scenario.sideEffectRun.forbiddenEffectsObserved.length, 0);
    assert.equal(scenario.sideEffectRun.failedEvidence.length, 0);
    assert.equal(
      scenario.sideEffectRun.beforeSnapshot.productionConfigVersionHash,
      scenario.sideEffectRun.afterSnapshot.productionConfigVersionHash,
    );
    assert.notEqual(
      scenario.sideEffectRun.beforeSnapshot.sandboxConfigVersionHash,
      scenario.sideEffectRun.afterSnapshot.sandboxConfigVersionHash,
    );

    let executorCallCount = 0;
    const permitBindings: unknown[] = [];
    const guard = createToolExecutionGuard({
      analysisService: createConfigChangeAnalysisService(),
      executorId,
      approvalAdapter: createApprovedAdapter(),
      contextEvidenceProvider: {
        getContextSufficiencyState() {
          return {
            contextSufficiencyState: scenario.validContextState,
            contextAdequacyEvidenceHash: "sha256:pag048-context-valid-sandbox",
          };
        },
      },
      permitEvidenceProvider: {
        getEvidenceSnapshot() {
          return {
            safetyState: scenario.safetyState,
            coverageMap: scenario.coverageMap,
            forbiddenEffectObligations:
              scenario.forbiddenCompilation.obligations,
          };
        },
        appendPermitBinding({ permitBinding }) {
          permitBindings.push(permitBinding);
        },
      },
      permitNonceFactory: () => "nonce-pag048-config-sandbox",
      now: () => new Date(evaluatedAt),
      async executor() {
        executorCallCount += 1;

        return {
          ok: true,
          mode: "sandbox_config_write" as const,
          configStoreConnected: false,
          sandboxNamespace,
          changedKey: changeExample.key,
          requestedValue: changeExample.requestedValue,
          productionNamespaceWriteAttempted: false,
          productionCredentialUsed: false,
          productionWriteEndpointAccessed: false,
        };
      },
    });

    const sandboxPermitResult = await guard.execute(scenario.adapterOutput.request);

    assert.equal(sandboxPermitResult.status, "executed");
    assert.equal(
      sandboxPermitResult.decision.type,
      DecisionType.RequireApproval,
    );
    assert.equal(sandboxPermitResult.permitDeniedEvidence, null);
    assert.equal(sandboxPermitResult.permitBinding?.executorId, executorId);
    assert.equal(
      sandboxPermitResult.permitBinding?.contextAdequacyEvidenceHash,
      "sha256:pag048-context-valid-sandbox",
    );
    assert.equal(sandboxPermitResult.executorInvoked, true);
    assert.equal(executorCallCount, 1);
    assert.equal(sandboxPermitResult.executorResult?.mode, "sandbox_config_write");
    assert.equal(
      sandboxPermitResult.executorResult?.productionNamespaceWriteAttempted,
      false,
    );
    assert.equal(
      sandboxPermitResult.executorResult?.productionCredentialUsed,
      false,
    );
    assert.equal(
      sandboxPermitResult.executorResult?.productionWriteEndpointAccessed,
      false,
    );
    assert.deepEqual(permitBindings, [sandboxPermitResult.permitBinding]);

    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

    assert.equal(fixture.storyId, "PAG-048");
    assert.equal(
      fixture.source.agentTaskPath,
      "sample-workspace/agent-tasks/production-config-timeout-change.md",
    );
    assert.equal(
      fixture.source.configStoreFixturePath,
      "sample-workspace/config-store/payment-service.production.json",
    );
    assert.equal(fixture.source.requestId, scenario.adapterOutput.request.id);
    assert.equal(
      fixture.source.promptAssemblyManifestId,
      scenario.adapterOutput.promptAssemblyManifest.manifestId,
    );
    assert.deepEqual(
      fixture.requiredContext.requiredAnchorIds,
      scenario.requiredContextObligation.requiredAnchors,
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
    assert.equal(fixture.outcomes.missingNamespaceContext.permitIssued, false);
    assert.equal(fixture.outcomes.missingNamespaceContext.executorInvoked, false);
    assert.equal(fixture.outcomes.sandboxPermit.permitIssued, true);
    assert.equal(fixture.outcomes.sandboxPermit.executorInvoked, true);
    assert.equal(
      fixture.outcomes.sandboxPermit.productionNamespaceWriteAttempted,
      false,
    );
    assert.equal(fixture.outcomes.sandboxPermit.productionCredentialUsed, false);
    assert.equal(
      fixture.outcomes.sandboxPermit.productionWriteEndpointAccessed,
      false,
    );

    const evidenceDoc = await readFile(evidenceDocPath, "utf8");

    assert.match(evidenceDoc, /PAG-048 Config 端到端专利验证场景/);
    assert.match(evidenceDoc, /production-config-timeout-change\.md/);
    assert.match(evidenceDoc, /namespace constraint/);
    assert.match(evidenceDoc, /production_namespace_write_denial/);
    assert.match(evidenceDoc, /sandbox_config_write/);
    assert.match(evidenceDoc, /\| permitIssued \| `true` \|/);
    assert.match(evidenceDoc, /\| executorInvoked \| `true` \|/);
  });
});
