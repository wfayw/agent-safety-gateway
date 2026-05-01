import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  SqlScenarioFixtureId,
  sqlScenarioFixtures,
  type JsonValue,
} from "@agent-safety-gateway/shared";
import type {
  ForbiddenEffectObligation,
  PermitBinding,
  PermitDeniedEvidence,
} from "@agent-safety-gateway/shared/forbidden-side-effect";
import {
  ContextAnchorTrustTier,
  ContextAnchorType,
  type ContextAnchor,
} from "@agent-safety-gateway/shared/context-retention";

import { createContextAdequacyEvidenceRepository } from "../src/context-adequacy-evidence-repository.js";
import { createExecutorSafetyEvidenceRepository } from "../src/executor-safety-evidence-repository.js";
import {
  exportPatentEvidencePackage,
  parsePatentEvidenceExportArgs,
} from "../src/patent-evidence-export.js";
import { seedLocalData } from "../src/seed.js";
import { initializeLocalStorage } from "../src/storage.js";
import { createDefaultToolCallAnalysisService } from "../src/tool-call-analysis-service.js";

const tempDirs: string[] = [];

const createTempDir = async (prefix: string) => {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(directory);
  return directory;
};

const getSqlDeleteFixture = () => {
  const fixture = sqlScenarioFixtures.find(
    (scenario) => scenario.id === SqlScenarioFixtureId.HighRiskDeleteOrders,
  );

  assert.ok(fixture);
  return fixture;
};

const readJson = async <TValue extends JsonValue>(filePath: string) =>
  JSON.parse(await readFile(filePath, "utf8")) as TValue;

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("patent evidence export", () => {
  it("defaults CLI paths to the repository root", () => {
    const previousDataDir = process.env.API_DATA_DIR;
    delete process.env.API_DATA_DIR;

    try {
      const options = parsePatentEvidenceExportArgs(["--", "--all"]);

      assert.equal(options.dataDir.endsWith("agent-safety-gateway/.data"), true);
      assert.equal(
        options.outputRoot.endsWith(
          "agent-safety-gateway/docs/evidence/patent-validation",
        ),
        true,
      );
    } finally {
      if (previousDataDir === undefined) {
        delete process.env.API_DATA_DIR;
      } else {
        process.env.API_DATA_DIR = previousDataDir;
      }
    }
  });

  it("exports selected audits and patent state-machine evidence", async () => {
    const dataDir = await createTempDir("asg-patent-export-data-");
    const outputRoot = await createTempDir("asg-patent-export-out-");
    const layout = await initializeLocalStorage(dataDir);
    await seedLocalData(layout);

    const service = createDefaultToolCallAnalysisService(layout, {
      idFactory: () => "audit-export-sql-delete-001",
      now: () => new Date("2026-05-01T08:00:00.000Z"),
    });
    const fixture = getSqlDeleteFixture();
    const analysis = await service.analyzeToolCall(fixture.request);

    const contextRepository = createContextAdequacyEvidenceRepository(layout);
    const contextAnchor: ContextAnchor = {
      anchorId: "ctx-export-latest-user-instruction",
      anchorType: ContextAnchorType.UserInstruction,
      sourceIdentity: "user:patent-reviewer",
      authorityLevel: "task_owner",
      resourceScope: "database.orders",
      createdAt: "2026-05-01T07:55:00.000Z",
      expiresAt: "2026-05-01T08:25:00.000Z",
      contentDigest: "sha256:export-context-content",
      semanticClaimsDigest: "sha256:export-context-claims",
      mustBeVerbatim: true,
      allowCertifiedSummary: false,
      allowRetrievableReference: false,
      trustTier: ContextAnchorTrustTier.High,
    };
    await contextRepository.appendContextAnchor(
      {
        id: "context-export-anchor-001",
        requestId: fixture.request.id,
        auditId: analysis.auditRecordId,
        inferenceId: "inference-export-001",
        toolCallDigest: "sha256:export-tool-call-001",
        createdAt: "2026-05-01T08:00:01.000Z",
      },
      contextAnchor,
    );

    const executorRepository = createExecutorSafetyEvidenceRepository(layout);
    const executorMetadata = {
      requestId: fixture.request.id,
      executorId: "executor-export-sql-readonly",
      evidenceVersion: "export-evidence-version-001",
      auditId: analysis.auditRecordId,
      createdAt: "2026-05-01T08:00:02.000Z",
    };
    const obligation: ForbiddenEffectObligation = {
      obligationId: "obligation-export-sql-delete-denial",
      effectType: "sql",
      resourceScope: ["database.orders"],
      environment: "production",
      severity: "critical",
      requiredEvidenceTypes: ["delete_denial", "no_row_mutation"],
      failClosedAction: "deny_permit",
      requestHash: "sha256:export-request-hash",
    };
    await executorRepository.appendObligation(
      { ...executorMetadata, id: "side-effect-export-obligation-001" },
      obligation,
    );

    const permit: PermitBinding = {
      requestHash: "sha256:export-request-hash",
      executorId: "executor-export-sql-readonly",
      safetyEvidenceVersion: "export-evidence-version-001",
      coverageMapHash: "sha256:export-coverage-map",
      deniedEvidenceHash: "sha256:export-denied-capability",
      sideEffectEvidenceHash: "sha256:export-side-effect-delta",
      contextAdequacyEvidenceHash: "sha256:export-context-adequacy",
      ttl: 300000,
      nonce: "nonce-export-001",
    };
    await executorRepository.appendPermit(
      { ...executorMetadata, id: "permit-export-001" },
      permit,
    );

    const denial: PermitDeniedEvidence = {
      requestHash: "sha256:export-request-hash",
      executorId: "executor-export-sql-readonly",
      permitIssued: false,
      executorInvoked: false,
      missingEvidence: ["no_row_mutation"],
      invalidatedEvidence: [],
      reason: "Side-effect delta evidence is missing for export smoke coverage.",
    };
    await executorRepository.appendDenial(
      { ...executorMetadata, id: "denial-export-001" },
      denial,
    );

    const result = await exportPatentEvidencePackage({
      dataDir,
      outputRoot,
      bundleId: "PAG-049-smoke",
      auditIds: [analysis.auditRecordId],
      generatedAt: new Date("2026-05-01T08:05:00.000Z"),
    });

    assert.equal(result.outputDir, join(outputRoot, "PAG-049-smoke"));
    assert.deepEqual(result.manifest.counts, {
      audits: 1,
      contextEvidence: 1,
      sideEffectEvidence: 1,
      permits: 1,
      denials: 1,
    });

    const manifest = await readJson<Record<string, JsonValue>>(
      join(result.outputDir, "manifest.json"),
    );
    assert.deepEqual(manifest.counts, result.manifest.counts);
    assert.deepEqual(manifest.resolvedSelection, {
      auditIds: [analysis.auditRecordId],
      requestIds: [fixture.request.id],
    });

    const audits = await readJson<Array<Record<string, JsonValue>>>(
      join(result.outputDir, "audits.json"),
    );
    assert.equal(audits[0]?.id, analysis.auditRecordId);

    const contextEvidence = await readJson<Array<Record<string, JsonValue>>>(
      join(result.outputDir, "context-evidence.json"),
    );
    assert.equal(contextEvidence[0]?.id, "context-export-anchor-001");

    const sideEffectEvidence = await readJson<Array<Record<string, JsonValue>>>(
      join(result.outputDir, "side-effect-evidence.json"),
    );
    assert.equal(sideEffectEvidence[0]?.id, "side-effect-export-obligation-001");

    const permits = await readJson<Array<Record<string, JsonValue>>>(
      join(result.outputDir, "permits.json"),
    );
    assert.equal(permits[0]?.id, "permit-export-001");

    const denials = await readJson<Array<Record<string, JsonValue>>>(
      join(result.outputDir, "denials.json"),
    );
    assert.equal(denials[0]?.id, "denial-export-001");

    const readme = await readFile(join(result.outputDir, "README.md"), "utf8");
    assert.match(readme, /Patent Evidence Export PAG-049-smoke/);
  });
});
