import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  EvidenceCoverageStatus,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  SideEffectEvidenceType,
  compileCiCdForbiddenEffectObligations,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import {
  createCiCdSideEffectProbePlan,
  createCiCdSideEffectSnapshot,
  createCiCdSideEffectSnapshotStateFromPipelineFixture,
  runCiCdSideEffectSnapshotFixture,
  type CiCdPipelineSideEffectSnapshotFixture,
  type CiCdSideEffectSnapshotFixtureState,
} from "../src/cicd-side-effect-snapshot-fixture-runner.js";

const completedAt = "2026-05-01T07:45:00.000Z";
const executorFingerprint = "sha256:cicd-dry-run-fixture-executor-v1";

type LocalPipelineFixture = {
  pipelineId: string;
  service: string;
  environment: string;
  candidateVersion?: string;
  currentVersion?: string;
};

const loadPipelineFixture = async (): Promise<LocalPipelineFixture> =>
  JSON.parse(
    await readFile(
      new URL(
        "../../../sample-workspace/pipelines/payment-service-release.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as LocalPipelineFixture;

const toPipelineSideEffectFixture = (
  pipelineFixture: LocalPipelineFixture,
  overrides: Partial<CiCdPipelineSideEffectSnapshotFixture> = {},
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
  ...overrides,
});

const createDryRunObligations = async () => {
  const pipelineFixture = await loadPipelineFixture();

  return compileCiCdForbiddenEffectObligations({
    requestId: "req-cicd-side-effect-fixture-runner",
    operation: "release",
    service: pipelineFixture.service,
    pipeline: pipelineFixture.pipelineId,
    version: pipelineFixture.candidateVersion,
    environment: ForbiddenEffectEnvironment.Production,
    requiredExecutionMode: "dry_run",
    testStatus: "passed",
  }).obligations;
};

describe("CI/CD side-effect snapshot fixture runner", () => {
  it("hashes deploy logs, webhook logs, artifact state, and environment version deterministically", () => {
    const firstSnapshot = createCiCdSideEffectSnapshot({
      deployLogs: [{ status: "blocked", id: 1 }],
      webhookLogs: [{ destination: "release-audit", id: 1 }],
      artifactPromotionState: { promoted: false, version: "1.8.0" },
      environmentVersionState: { currentVersion: "1.7.4", service: "payment" },
    });
    const reorderedFieldsSnapshot = createCiCdSideEffectSnapshot({
      deployLogs: [{ id: 1, status: "blocked" }],
      webhookLogs: [{ id: 1, destination: "release-audit" }],
      artifactPromotionState: { version: "1.8.0", promoted: false },
      environmentVersionState: { service: "payment", currentVersion: "1.7.4" },
    });

    assert.equal(firstSnapshot.deployLogsHash, reorderedFieldsSnapshot.deployLogsHash);
    assert.equal(
      firstSnapshot.webhookLogsHash,
      reorderedFieldsSnapshot.webhookLogsHash,
    );
    assert.equal(
      firstSnapshot.artifactPromotionStateHash,
      reorderedFieldsSnapshot.artifactPromotionStateHash,
    );
    assert.equal(
      firstSnapshot.environmentVersionStateHash,
      reorderedFieldsSnapshot.environmentVersionStateHash,
    );
    assert.equal(firstSnapshot.snapshotHash, reorderedFieldsSnapshot.snapshotHash);
    assert.ok(firstSnapshot.deployLogsHash.startsWith("sha256:"));
    assert.ok(firstSnapshot.webhookLogsHash.startsWith("sha256:"));
    assert.ok(firstSnapshot.artifactPromotionStateHash.startsWith("sha256:"));
    assert.ok(firstSnapshot.environmentVersionStateHash.startsWith("sha256:"));
  });

  it("emits covered dry-run evidence for unchanged CI/CD fixture snapshots", async () => {
    const pipelineFixture = await loadPipelineFixture();
    const obligations = await createDryRunObligations();
    const plan = createCiCdSideEffectProbePlan({
      probePlanId: "sprobe-cicd-dry-run-release-v1",
      executorId: "cicd-dry-run-fixture-executor",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      service: pipelineFixture.service,
      pipelineId: pipelineFixture.pipelineId,
      candidateVersion: pipelineFixture.candidateVersion,
    });
    const beforeSnapshot = createCiCdSideEffectSnapshotStateFromPipelineFixture(
      toPipelineSideEffectFixture(pipelineFixture),
    );

    const result = await runCiCdSideEffectSnapshotFixture({
      plan,
      obligations,
      beforeSnapshot,
      afterSnapshot: beforeSnapshot,
      executorFingerprint,
      completedAt,
    });

    assert.equal(result.pipelineConnected, false);
    assert.equal(result.dryRunMode, "fixture");
    assert.equal(result.executorId, "cicd-dry-run-fixture-executor");
    assert.equal(
      result.beforeSnapshot.snapshotHash,
      result.afterSnapshot.snapshotHash,
    );
    assert.deepEqual(plan.snapshotTargets, [
      `${pipelineFixture.pipelineId}:deploy_logs`,
      `${pipelineFixture.pipelineId}:webhook_logs`,
      `artifact-registry/${pipelineFixture.service}:${pipelineFixture.candidateVersion}:production:artifact_promotion_state`,
      `environment/${pipelineFixture.service}:production:environment_version_state`,
    ]);
    assert.equal(result.sideEffectDeltaEvidence.length, 2);
    assert.equal(result.failedEvidence.length, 0);
    assert.equal(result.forbiddenEffectsObserved.length, 0);
    assert.deepEqual(
      result.coverageRecords.map((record) => record.requiredEvidenceType).sort(),
      [
        ForbiddenEffectEvidenceType.NoExternalSideEffect,
        ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
      ].sort(),
    );

    for (const coverageRecord of result.coverageRecords) {
      assert.equal(coverageRecord.status, EvidenceCoverageStatus.Covered);
      assert.equal(coverageRecord.completedAt, completedAt);
      assert.ok(coverageRecord.evidenceHash.startsWith("sha256:"));
      assert.equal(
        coverageRecord.evidence?.beforeSnapshotHash,
        result.beforeSnapshot.snapshotHash,
      );
      assert.equal(
        coverageRecord.evidence?.afterSnapshotHash,
        result.afterSnapshot.snapshotHash,
      );
      assert.equal(coverageRecord.evidence?.forbiddenEffectsObserved.length, 0);
      assert.equal(coverageRecord.evidence?.effectDelta.length, 0);
    }
  });

  it("fails closed and records forbidden CI/CD deployment deltas", async () => {
    const pipelineFixture = await loadPipelineFixture();
    const obligations = await createDryRunObligations();
    const plan = createCiCdSideEffectProbePlan({
      probePlanId: "sprobe-cicd-dry-run-release-v1",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      service: pipelineFixture.service,
      pipelineId: pipelineFixture.pipelineId,
      candidateVersion: pipelineFixture.candidateVersion,
    });
    const beforeSnapshot = createCiCdSideEffectSnapshotStateFromPipelineFixture(
      toPipelineSideEffectFixture(pipelineFixture),
    );
    const afterSnapshot: CiCdSideEffectSnapshotFixtureState = {
      deployLogs: [
        {
          pipelineId: pipelineFixture.pipelineId,
          endpoint: "/deployments/production",
          version: pipelineFixture.candidateVersion,
          status: "deployed",
        },
      ],
      webhookLogs: [
        {
          target: "https://webhooks.invalid/payment-service-release/production/deploy",
          status: "delivered",
          version: pipelineFixture.candidateVersion,
        },
      ],
      artifactPromotionState: {
        pipelineId: pipelineFixture.pipelineId,
        service: pipelineFixture.service,
        environment: pipelineFixture.environment,
        candidateVersion: pipelineFixture.candidateVersion,
        promoted: true,
        promotedVersion: pipelineFixture.candidateVersion,
      },
      environmentVersionState: {
        service: pipelineFixture.service,
        environment: pipelineFixture.environment,
        previousVersion: pipelineFixture.currentVersion,
        currentVersion: pipelineFixture.candidateVersion,
      },
    };

    const result = await runCiCdSideEffectSnapshotFixture({
      plan,
      obligations,
      executorId: "cicd-dry-run-fixture-executor",
      beforeSnapshot,
      afterSnapshot,
      executorFingerprint,
      completedAt,
    });

    assert.notEqual(
      result.beforeSnapshot.snapshotHash,
      result.afterSnapshot.snapshotHash,
    );
    assert.equal(result.coverageRecords.length, 2);
    assert.equal(result.failedEvidence.length, 2);
    assert.equal(result.forbiddenEffectsObserved.length, 4);
    assert.deepEqual(
      result.forbiddenEffectsObserved.map((event) => event.evidenceType).sort(),
      [
        SideEffectEvidenceType.Artifact,
        SideEffectEvidenceType.ConfigVersion,
        SideEffectEvidenceType.DeployLog,
        SideEffectEvidenceType.Webhook,
      ].sort(),
    );

    const externalRecord = result.coverageRecords.find(
      (record) =>
        record.requiredEvidenceType ===
        ForbiddenEffectEvidenceType.NoExternalSideEffect,
    );
    const environmentRecord = result.coverageRecords.find(
      (record) =>
        record.requiredEvidenceType ===
        ForbiddenEffectEvidenceType.ProductionNamespaceWriteDenial,
    );

    assert.equal(externalRecord?.status, EvidenceCoverageStatus.Failed);
    assert.equal(environmentRecord?.status, EvidenceCoverageStatus.Failed);
    assert.match(externalRecord?.failureReason ?? "", /production_deploy/);
    assert.match(externalRecord?.failureReason ?? "", /external_webhook/);
    assert.match(externalRecord?.failureReason ?? "", /artifact_promotion/);
    assert.match(environmentRecord?.failureReason ?? "", /environment_mutation/);
    assert.deepEqual(
      externalRecord?.evidence?.effectDelta
        .map((change) => change.evidenceType)
        .sort(),
      [
        SideEffectEvidenceType.Artifact,
        SideEffectEvidenceType.DeployLog,
        SideEffectEvidenceType.Webhook,
      ].sort(),
    );
    assert.equal(
      environmentRecord?.evidence?.effectDelta[0]?.evidenceType,
      SideEffectEvidenceType.ConfigVersion,
    );
  });
});
