import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
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
  createFileExternalAuditSinkAdapter,
  readExternalAuditSinkRecords,
} from "../src/audit-sink-adapter.js";
import {
  AdapterHealthStatus,
  createNotConfiguredExternalAuditSinkAdapter,
  RealComponentAdapterKind,
  type ExternalAuditSinkInput,
  type RealComponentEvidence,
} from "../src/real-component-adapters.js";
import type { ToolCallAnalysisResult } from "../src/tool-call-analysis-service.js";

const tempDirs: string[] = [];

const createTempDataDir = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "asg-audit-sink-adapter-"));
  tempDirs.push(tempDir);
  return tempDir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) =>
      rm(tempDir, { recursive: true, force: true }),
    ),
  );
});

const request: ToolCallRequest = {
  id: "req-sql-readonly-orders",
  actor: "agent:analyst",
  taskPurpose: "Read recent orders",
  toolType: ToolType.Sql,
  rawPayload: {
    sql: "SELECT * FROM orders LIMIT 10",
  },
  environment: Environment.Production,
  createdAt: "2026-04-29T08:00:00.000Z",
};

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

const decision: ExecutionDecision = {
  type: DecisionType.Allow,
  code: "risk.low.allow",
  reason: "Read-only SQL is allowed.",
  recommendedAction: "Execute with a readonly adapter.",
  rewrittenRequest: null,
};

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
  hardRules: [],
  matchedRuleIds: [],
  weightedFactors: [],
};

const analysisResult: ToolCallAnalysisResult = {
  request,
  actionTuple,
  directResources: [],
  indirectResources: [],
  impactPaths: [],
  riskFactors: [],
  riskScore: {
    riskLevel: RiskLevel.Low,
    score: 10,
    explanation: "Risk level is low.",
    reasons: ["Read-only operation."],
    appliedHardRules: [],
    policyVersion,
    policyTrace,
  },
  riskLevel: RiskLevel.Low,
  policyVersion,
  policyTrace,
  executionDecision: decision,
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
    decision,
    createdAt: "2026-04-29T08:00:01.000Z",
  },
};

const evidence: RealComponentEvidence = {
  environmentName: Environment.Production,
  runId: "audit-sql-readonly-orders",
  sourceSystem: "agent-safety-gateway",
  startedAt: "2026-04-29T08:00:01.000Z",
  completedAt: "2026-04-29T08:00:02.000Z",
  artifactUris: [],
  notes: "decision=allow; executorInvoked=true",
};

const auditSinkInput: ExternalAuditSinkInput = {
  request,
  analysisResult,
  executorInvoked: true,
  executorResult: {
    ok: true,
    mode: "readonly",
    rowCount: 10,
  },
  evidence,
};

describe("external audit sink adapter", () => {
  it("reports not_configured without appending evidence", async () => {
    const adapter = createNotConfiguredExternalAuditSinkAdapter([
      "ASG_AUDIT_SINK_URL",
    ]);

    const result = await adapter.appendControlEvidence(auditSinkInput);
    const health = await adapter.health();

    assert.deepEqual(result, {
      ok: false,
      status: "not_configured",
      externalAuditId: null,
      evidenceUri: null,
      missingRequirements: ["ASG_AUDIT_SINK_URL"],
      message: "External audit sink is not configured: ASG_AUDIT_SINK_URL",
    });
    assert.equal(health.adapterKind, RealComponentAdapterKind.AuditSink);
    assert.equal(health.status, AdapterHealthStatus.NotConfigured);
    assert.deepEqual(health.details.missingRequirements, ["ASG_AUDIT_SINK_URL"]);
  });

  it("appends complete durable control evidence", async () => {
    const filePath = join(await createTempDataDir(), "external-audit.jsonl");
    const adapter = createFileExternalAuditSinkAdapter({
      filePath,
      sinkName: "company-audit-log-sandbox",
      evidenceBaseUri: "https://audit.example.local/evidence",
      now: () => new Date("2026-04-29T08:00:03.000Z"),
    });

    const result = await adapter.appendControlEvidence(auditSinkInput);
    const records = await readExternalAuditSinkRecords(filePath);

    assert.deepEqual(result, {
      ok: true,
      status: "appended",
      externalAuditId: "external-audit-sql-readonly-orders",
      evidenceUri:
        "https://audit.example.local/evidence/external-audit-sql-readonly-orders",
    });
    assert.equal(records.length, 1);
    assert.equal(records[0]?.externalAuditId, result.externalAuditId);
    assert.equal(records[0]?.sinkName, "company-audit-log-sandbox");
    assert.equal(records[0]?.writtenAt, "2026-04-29T08:00:03.000Z");
    assert.deepEqual(records[0]?.request, request);
    assert.deepEqual(records[0]?.analysisResult, analysisResult);
    assert.equal(records[0]?.executorInvoked, true);
    assert.deepEqual(records[0]?.executorResult, auditSinkInput.executorResult);
    assert.deepEqual(records[0]?.evidence, evidence);

    const health = await adapter.health();
    assert.equal(health.status, AdapterHealthStatus.Ready);
    assert.deepEqual(health.details.durable, true);
  });
});
