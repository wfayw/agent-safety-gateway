import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  ContextAnchorTrustTier,
  ContextAnchorType,
  ContextRetentionMode,
  ContextRetentionVerifierResult,
  ContextSufficiencyStateName,
  RequiredContextConflictPolicy,
  RequiredContextMissingAnchorAction,
  RequiredContextTaintPolicy,
  type ContextAdequacyEvidence,
  type ContextAnchor,
  type ContextRetentionEvidence,
  type ContextSufficiencyState,
  type PromptAssemblyManifest,
  type RequiredContextObligation,
} from "@agent-safety-gateway/shared/context-retention";

import {
  createContextAdequacyEvidenceRepository,
  ContextAdequacyEvidenceRecordKind,
  type ContextAdequacyEvidenceRecordMetadata,
  type ContextAdequacyEvidenceStoreRecord,
} from "../src/context-adequacy-evidence-repository.js";
import { initializeLocalStorage } from "../src/storage.js";

const tempDirs: string[] = [];

const createTempDataDir = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "agent-safety-gateway-data-"));
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

const metadataFixture = (
  id: string,
  overrides: Partial<ContextAdequacyEvidenceRecordMetadata> = {},
): ContextAdequacyEvidenceRecordMetadata => ({
  id,
  requestId: "request-context-sql-001",
  auditId: "audit-context-sql-001",
  inferenceId: "inference-context-sql-001",
  toolCallDigest: "sha256:context-tool-call-001",
  createdAt: "2026-05-01T07:00:00.000Z",
  ...overrides,
});

const contextAnchorFixture: ContextAnchor = {
  anchorId: "ctx-user-instruction-sql-001",
  anchorType: ContextAnchorType.UserInstruction,
  sourceIdentity: "user:alice",
  authorityLevel: "task_owner",
  resourceScope: "database.orders",
  createdAt: "2026-05-01T06:55:00.000Z",
  expiresAt: "2026-05-01T07:25:00.000Z",
  contentDigest: "sha256:ctx-user-instruction-content",
  semanticClaimsDigest: "sha256:ctx-user-instruction-claims",
  mustBeVerbatim: true,
  allowCertifiedSummary: false,
  allowRetrievableReference: false,
  trustTier: ContextAnchorTrustTier.High,
};

const promptAssemblyManifestFixture: PromptAssemblyManifest = {
  manifestId: "manifest-context-sql-001",
  inferenceId: "inference-context-sql-001",
  modelId: "deterministic-agent-v1",
  promptDigest: "sha256:prompt-context-sql-001",
  contextUnitDigests: [
    {
      contextUnitId: "ctx-user-instruction-sql-001",
      digest: "sha256:ctx-user-instruction-content",
    },
  ],
  contextUnitOrder: ["ctx-user-instruction-sql-001"],
  tokenPositionRanges: [
    {
      contextUnitId: "ctx-user-instruction-sql-001",
      startToken: 10,
      endToken: 18,
    },
  ],
  summaryDerivationDigests: [],
  retrievalQueryDigest: "sha256:no-retrieval-query",
  retrievedDocumentDigests: [],
  memorySnapshotDigest: "sha256:memory-snapshot-context-sql-001",
  systemPolicyDigest: "sha256:system-policy-context-sql-001",
};

const requiredContextObligationFixture: RequiredContextObligation = {
  obligationId: "required-context-sql-001",
  toolCallDigest: "sha256:context-tool-call-001",
  actionImpactClass: "sql.production.delete",
  requiredAnchors: ["ctx-user-instruction-sql-001"],
  freshnessWindow: "PT30M",
  minimumRetentionMode: ContextRetentionMode.Verbatim,
  conflictPolicy: RequiredContextConflictPolicy.DenyOnOmittedConflict,
  taintPolicy: RequiredContextTaintPolicy.DenyOnUntrustedInstruction,
  missingAnchorAction: RequiredContextMissingAnchorAction.Deny,
};

const contextRetentionEvidenceFixture: ContextRetentionEvidence = {
  evidenceId: "retention-evidence-sql-001",
  obligationId: "required-context-sql-001",
  toolCallDigest: "sha256:context-tool-call-001",
  promptAssemblyManifestId: "manifest-context-sql-001",
  inferenceId: "inference-context-sql-001",
  anchorId: "ctx-user-instruction-sql-001",
  retentionMode: ContextRetentionMode.Verbatim,
  minimumRetentionMode: ContextRetentionMode.Verbatim,
  coverageScore: 1,
  freshnessScore: 1,
  trustScore: 1,
  conflictEvidence: [],
  summaryVerifierResult: ContextRetentionVerifierResult.NotApplicable,
  referenceVerifierResult: ContextRetentionVerifierResult.NotApplicable,
  matchedContextUnitId: "ctx-user-instruction-sql-001",
  matchedDigest: "sha256:ctx-user-instruction-content",
};

const contextSufficiencyStateFixture: ContextSufficiencyState = {
  stateId: "context-state-sql-001",
  obligationId: "required-context-sql-001",
  toolCallDigest: "sha256:context-tool-call-001",
  promptAssemblyManifestId: "manifest-context-sql-001",
  inferenceId: "inference-context-sql-001",
  state: ContextSufficiencyStateName.Sufficient,
  sufficient: true,
  evaluatedAt: "2026-05-01T07:00:01.000Z",
  requiredAnchorIds: ["ctx-user-instruction-sql-001"],
  coveredAnchorIds: ["ctx-user-instruction-sql-001"],
  blockedAnchorIds: [],
  missingAnchorIds: [],
  staleAnchorIds: [],
  conflictingAnchorIds: [],
  contaminatedAnchorIds: [],
  verbatimAnchorIds: ["ctx-user-instruction-sql-001"],
  certifiedSummaryAnchorIds: [],
  retrievableReferenceAnchorIds: [],
  transitionReason: "all required context anchors are retained verbatim",
};

const contextAdequacyEvidenceFixture: ContextAdequacyEvidence = {
  evidenceId: "context-adequacy-evidence-sql-001",
  toolCallDigest: "sha256:context-tool-call-001",
  requiredContextObligationDigest: "sha256:required-context-obligation-001",
  promptAssemblyManifestDigest: "sha256:prompt-manifest-001",
  contextRetentionEvidenceDigest: "sha256:retention-evidence-001",
  contextSufficiencyState: ContextSufficiencyStateName.Sufficient,
  regroundingApplied: false,
  permitIssued: true,
  permitOutcome: "permit_issued_after_context_sufficiency",
  denialReason: null,
  createdAt: "2026-05-01T07:00:02.000Z",
};

const appendAllRecordKinds = async (
  repository: ReturnType<typeof createContextAdequacyEvidenceRepository>,
) => {
  await repository.appendContextAnchor(
    metadataFixture("store-context-anchor-001"),
    contextAnchorFixture,
  );
  await repository.appendPromptAssemblyManifest(
    metadataFixture("store-prompt-manifest-001"),
    promptAssemblyManifestFixture,
  );
  await repository.appendRequiredContextObligation(
    metadataFixture("store-required-context-obligation-001"),
    requiredContextObligationFixture,
  );
  await repository.appendContextRetentionEvidence(
    metadataFixture("store-context-retention-evidence-001"),
    contextRetentionEvidenceFixture,
  );
  await repository.appendContextSufficiencyState(
    metadataFixture("store-context-sufficiency-state-001"),
    contextSufficiencyStateFixture,
  );
  return repository.appendContextAdequacyEvidence(
    metadataFixture("store-context-adequacy-evidence-001"),
    contextAdequacyEvidenceFixture,
  );
};

describe("context adequacy evidence repository", () => {
  it("appends all context adequacy evidence record kinds to JSONL", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createContextAdequacyEvidenceRepository(layout);

    const adequacyRecord = await appendAllRecordKinds(repository);

    const records = await repository.listRecords();
    const rawLines = (await readFile(layout.stores.contextAdequacyEvidence, "utf8"))
      .trim()
      .split("\n");

    assert.deepEqual(
      records.map((record) => record.kind),
      [
        ContextAdequacyEvidenceRecordKind.ContextAnchor,
        ContextAdequacyEvidenceRecordKind.PromptAssemblyManifest,
        ContextAdequacyEvidenceRecordKind.RequiredContextObligation,
        ContextAdequacyEvidenceRecordKind.ContextRetentionEvidence,
        ContextAdequacyEvidenceRecordKind.ContextSufficiencyState,
        ContextAdequacyEvidenceRecordKind.ContextAdequacyEvidence,
      ],
    );
    assert.equal(rawLines.length, 6);
    assert.match(adequacyRecord.evidenceHash, /^sha256:/);
    assert.deepEqual(records[0], {
      ...metadataFixture("store-context-anchor-001"),
      kind: ContextAdequacyEvidenceRecordKind.ContextAnchor,
      contextAnchor: contextAnchorFixture,
    });
  });

  it("queries records by request, audit, inference, tool digest, and kind", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createContextAdequacyEvidenceRepository(layout);

    await appendAllRecordKinds(repository);
    const ciAdequacyRecord = await repository.appendContextAdequacyEvidence(
      metadataFixture("store-context-adequacy-evidence-002", {
        requestId: "request-context-ci-002",
        auditId: "audit-context-ci-002",
        inferenceId: "inference-context-ci-002",
        toolCallDigest: "sha256:context-tool-call-002",
      }),
      {
        ...contextAdequacyEvidenceFixture,
        evidenceId: "context-adequacy-evidence-ci-002",
        toolCallDigest: "sha256:context-tool-call-002",
      },
    );

    assert.equal(
      (await repository.listRecords({ requestId: "request-context-sql-001" }))
        .length,
      6,
    );
    assert.equal(
      (await repository.listRecords({ auditId: "audit-context-sql-001" })).length,
      6,
    );
    assert.equal(
      (await repository.listRecords({ inferenceId: "inference-context-sql-001" }))
        .length,
      6,
    );
    assert.equal(
      (
        await repository.listRecords({
          toolCallDigest: "sha256:context-tool-call-001",
        })
      ).length,
      6,
    );
    assert.deepEqual(
      await repository.listRecords({
        kind: ContextAdequacyEvidenceRecordKind.ContextAdequacyEvidence,
        requestId: "request-context-ci-002",
      }),
      [ciAdequacyRecord],
    );
  });

  it("computes a stable ContextAdequacyEvidence hash independent of record metadata", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createContextAdequacyEvidenceRepository(layout);

    const firstRecord = await repository.appendContextAdequacyEvidence(
      metadataFixture("store-context-adequacy-evidence-001"),
      contextAdequacyEvidenceFixture,
    );
    const secondRecord = await repository.appendContextAdequacyEvidence(
      metadataFixture("store-context-adequacy-evidence-002", {
        requestId: "request-context-sql-002",
        auditId: "audit-context-sql-002",
        inferenceId: "inference-context-sql-002",
      }),
      contextAdequacyEvidenceFixture,
    );

    assert.equal(firstRecord.evidenceHash, secondRecord.evidenceHash);
  });

  it("rejects invalid payloads before appending", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    const repository = createContextAdequacyEvidenceRepository(layout);

    await assert.rejects(
      () =>
        repository.appendRecord({
          ...metadataFixture("store-invalid-context-adequacy-evidence-001"),
          kind: ContextAdequacyEvidenceRecordKind.ContextAdequacyEvidence,
          contextAdequacyEvidence: {
            ...contextAdequacyEvidenceFixture,
            permitOutcome: "",
          },
          evidenceHash: "sha256:invalid",
        } as ContextAdequacyEvidenceStoreRecord),
      /Invalid context adequacy evidence record\./,
    );

    assert.equal(await readFile(layout.stores.contextAdequacyEvidence, "utf8"), "");
  });
});
