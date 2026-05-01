import assert from "node:assert/strict";
import test from "node:test";

import {
  Environment,
  EvidenceHashAlgorithm,
  PatentStateMachineDomain,
  ToolCallRequestSchema,
  ToolType,
} from "@agent-safety-gateway/shared";
import {
  ForbiddenSideEffectDomain,
  ForbiddenSideEffectDomainName,
} from "@agent-safety-gateway/shared/forbidden-side-effect";
import {
  ContextRetentionDomain,
  ContextRetentionDomainName,
} from "@agent-safety-gateway/shared/context-retention";

test("exports patent state-machine domains without breaking root schemas", () => {
  assert.equal(
    ForbiddenSideEffectDomainName,
    PatentStateMachineDomain.ForbiddenSideEffect,
  );
  assert.equal(
    ContextRetentionDomainName,
    PatentStateMachineDomain.ContextRetention,
  );
  assert.equal(
    ForbiddenSideEffectDomain.obligation,
    "ForbiddenEffectObligation",
  );
  assert.equal(
    ContextRetentionDomain.manifest,
    "PromptAssemblyManifest",
  );
  assert.equal(EvidenceHashAlgorithm.Sha256, "sha256");

  const request = {
    id: "req-shared-export-compatibility",
    actor: "agent:ralph",
    taskPurpose: "Validate shared package export compatibility",
    toolType: ToolType.Sql,
    rawPayload: {
      sql: "SELECT 1",
    },
    environment: Environment.Test,
    createdAt: "2026-05-01T04:30:00.000Z",
  };

  assert.equal(ToolCallRequestSchema.safeParse(request).success, true);
});
