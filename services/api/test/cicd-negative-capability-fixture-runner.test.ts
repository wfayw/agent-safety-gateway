import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  DeniedCapabilityProbeOutcome,
  EvidenceCoverageStatus,
  ForbiddenEffectEnvironment,
  ForbiddenEffectEvidenceType,
  compileCiCdForbiddenEffectObligations,
} from "@agent-safety-gateway/shared/forbidden-side-effect";

import {
  createCiCdDryRunNegativeProbePlan,
  runCiCdNegativeCapabilityFixture,
  type CiCdPipelineNegativeCapabilityFixture,
} from "../src/cicd-negative-capability-fixture-runner.js";

const completedAt = "2026-05-01T07:30:00.000Z";
const executorFingerprint = "sha256:cicd-dry-run-fixture-executor-v1";

type LocalPipelineFixture = {
  pipelineId: string;
  service: string;
  environment: string;
  candidateVersion?: string;
};

const loadPipelineFixture = async (): Promise<LocalPipelineFixture> =>
  JSON.parse(
    await readFile(
      new URL("../../../sample-workspace/pipelines/payment-service-release.json", import.meta.url),
      "utf8",
    ),
  ) as LocalPipelineFixture;

const toNegativeCapabilityFixture = (
  pipelineFixture: LocalPipelineFixture,
  overrides: Partial<CiCdPipelineNegativeCapabilityFixture> = {},
): CiCdPipelineNegativeCapabilityFixture => ({
  pipelineId: pipelineFixture.pipelineId,
  service: pipelineFixture.service,
  environment: pipelineFixture.environment,
  ...(pipelineFixture.candidateVersion === undefined
    ? {}
    : { candidateVersion: pipelineFixture.candidateVersion }),
  ...overrides,
});

const createDryRunObligations = async () => {
  const pipelineFixture = await loadPipelineFixture();

  return compileCiCdForbiddenEffectObligations({
    requestId: "req-cicd-negative-fixture-runner",
    operation: "release",
    service: pipelineFixture.service,
    pipeline: pipelineFixture.pipelineId,
    version: pipelineFixture.candidateVersion,
    environment: ForbiddenEffectEnvironment.Production,
    requiredExecutionMode: "dry_run",
    testStatus: "passed",
  }).obligations;
};

describe("CI/CD negative capability fixture runner", () => {
  it("creates production deploy, webhook, and artifact promotion probes", async () => {
    const pipelineFixture = await loadPipelineFixture();
    const obligations = await createDryRunObligations();
    const plan = createCiCdDryRunNegativeProbePlan({
      probePlanId: "nprobe-cicd-dry-run-release-v1",
      executorId: "cicd-dry-run-fixture-executor",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      service: pipelineFixture.service,
      pipelineId: pipelineFixture.pipelineId,
      candidateVersion: pipelineFixture.candidateVersion,
    });

    assert.equal(plan.executorType, "ci_cd");
    assert.equal(plan.targetEnvironment, "production");
    assert.deepEqual(plan.dangerousCapabilitiesToDeny, [
      "production_deploy",
      "deploy_endpoint_call",
      "external_webhook",
      "artifact_promotion",
    ]);
    assert.deepEqual(
      plan.probeTasks.map((task) => task.probeType),
      [
        ForbiddenEffectEvidenceType.ProductionDeployDenial,
        ForbiddenEffectEvidenceType.ExternalWebhookDenial,
        ForbiddenEffectEvidenceType.ArtifactPromotionDenial,
      ],
    );
    assert.deepEqual(
      plan.probeTasks.map((task) => task.operation),
      [
        `POST /pipelines/${pipelineFixture.pipelineId}/deployments/production`,
        `POST https://webhooks.invalid/${pipelineFixture.pipelineId}/production/deploy`,
        `PROMOTE ${pipelineFixture.service}:${pipelineFixture.candidateVersion}->production`,
      ],
    );
  });

  it("emits covered DeniedCapabilityEvidence for rejected CI/CD probes", async () => {
    const pipelineFixture = await loadPipelineFixture();
    const obligations = await createDryRunObligations();
    const plan = createCiCdDryRunNegativeProbePlan({
      probePlanId: "nprobe-cicd-dry-run-release-v1",
      executorId: "cicd-dry-run-fixture-executor",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      service: pipelineFixture.service,
      pipelineId: pipelineFixture.pipelineId,
      candidateVersion: pipelineFixture.candidateVersion,
    });

    const result = await runCiCdNegativeCapabilityFixture({
      plan,
      obligations,
      pipelineFixture: toNegativeCapabilityFixture(pipelineFixture),
      executorFingerprint,
      completedAt,
    });

    assert.equal(result.pipelineConnected, false);
    assert.equal(result.dryRunMode, "fixture");
    assert.equal(result.executorId, "cicd-dry-run-fixture-executor");
    assert.equal(result.failedEvidence.length, 0);
    assert.equal(result.deniedCapabilityEvidence.length, 3);
    assert.equal(result.coverageRecords.length, 3);

    for (const evidence of result.deniedCapabilityEvidence) {
      assert.equal(evidence.probeId, plan.probePlanId);
      assert.equal(evidence.observedRejection, DeniedCapabilityProbeOutcome.Rejected);
      assert.equal(evidence.executorFingerprint, executorFingerprint);
      assert.equal(evidence.completedAt, completedAt);
      assert.equal(
        obligations.some(
          (obligation) => obligation.obligationId === evidence.obligationId,
        ),
        true,
      );
    }

    for (const coverageRecord of result.coverageRecords) {
      assert.equal(coverageRecord.status, EvidenceCoverageStatus.Covered);
      assert.equal(coverageRecord.completedAt, completedAt);
      assert.ok(coverageRecord.evidenceHash.startsWith("sha256:"));
      assert.equal(coverageRecord.evidence?.observedRejection, "rejected");
    }
  });

  it("fails evidence when the production deploy endpoint is called", async () => {
    const pipelineFixture = await loadPipelineFixture();
    const obligations = await createDryRunObligations();
    const plan = createCiCdDryRunNegativeProbePlan({
      probePlanId: "nprobe-cicd-dry-run-release-v1",
      obligationIds: obligations.map((obligation) => obligation.obligationId),
      service: pipelineFixture.service,
      pipelineId: pipelineFixture.pipelineId,
      candidateVersion: pipelineFixture.candidateVersion,
    });

    const result = await runCiCdNegativeCapabilityFixture({
      plan,
      obligations,
      pipelineFixture: toNegativeCapabilityFixture(pipelineFixture, {
        productionEndpointCalled: true,
      }),
      executorFingerprint,
      completedAt,
    });

    assert.equal(result.productionEndpointCalled, true);
    assert.equal(result.failedEvidence.length, 1);
    assert.equal(
      result.failedEvidence[0]?.observedRejection,
      DeniedCapabilityProbeOutcome.UnexpectedlyAllowed,
    );

    const failedRecord = result.coverageRecords.find(
      (record) =>
        record.requiredEvidenceType ===
        ForbiddenEffectEvidenceType.ProductionDeployDenial,
    );
    const webhookRecord = result.coverageRecords.find(
      (record) =>
        record.requiredEvidenceType ===
        ForbiddenEffectEvidenceType.ExternalWebhookDenial,
    );
    const artifactRecord = result.coverageRecords.find(
      (record) =>
        record.requiredEvidenceType ===
        ForbiddenEffectEvidenceType.ArtifactPromotionDenial,
    );

    assert.equal(failedRecord?.status, EvidenceCoverageStatus.Failed);
    assert.match(failedRecord?.failureReason ?? "", /production deploy endpoint/);
    assert.equal(webhookRecord?.status, EvidenceCoverageStatus.Covered);
    assert.equal(artifactRecord?.status, EvidenceCoverageStatus.Covered);
  });
});
