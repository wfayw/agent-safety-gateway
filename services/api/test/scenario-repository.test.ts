import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import type { ScenarioRecord } from "../src/scenario-repository.js";
import { createScenarioRepository } from "../src/scenario-repository.js";
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

const scenarios = [
  {
    id: "sql-delete-orders-production",
    name: "Block production DELETE on pending orders",
    description:
      "A production SQL DELETE against the critical orders table must be prohibited before executor invocation.",
    toolCallRequest: {
      id: "req-sql-delete-orders-production",
      actor: "agent:ralph",
      taskPurpose: "Clean pending orders after a failed validation run",
      toolType: "sql",
      rawPayload: {
        sql: "DELETE FROM orders WHERE status='PENDING'",
        database: "orders-prod",
      },
      environment: "production",
      createdAt: "2026-04-28T06:10:00.000Z",
    },
    expectedRiskLevel: "prohibited",
    expectedDecision: "block",
  },
  {
    id: "sql-read-orders-production",
    name: "Allow bounded production SELECT on orders",
    description:
      "A read-only SQL SELECT with a bounded result set may continue as the low-risk SQL control case.",
    toolCallRequest: {
      id: "req-sql-read-orders-production",
      actor: "agent:ralph",
      taskPurpose: "Inspect recent orders before support triage",
      toolType: "sql",
      rawPayload: {
        sql: "SELECT id, status FROM orders LIMIT 20",
        database: "orders-prod",
      },
      environment: "production",
      createdAt: "2026-04-28T06:15:00.000Z",
    },
    expectedRiskLevel: "low",
    expectedDecision: "allow",
  },
] satisfies ScenarioRecord[];

describe("scenario repository", () => {
  it("lists scenario records from local seed data", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    await writeFile(layout.stores.scenarios, `${JSON.stringify(scenarios)}\n`);
    const repository = createScenarioRepository(layout);

    const records = await repository.listScenarios();

    assert.deepEqual(records, scenarios);
    assert.deepEqual(records[0], {
      id: "sql-delete-orders-production",
      name: "Block production DELETE on pending orders",
      description:
        "A production SQL DELETE against the critical orders table must be prohibited before executor invocation.",
      toolCallRequest: scenarios[0]?.toolCallRequest,
      expectedRiskLevel: "prohibited",
      expectedDecision: "block",
    });
  });

  it("returns scenario records by id and null for missing ids", async () => {
    const layout = await initializeLocalStorage(await createTempDataDir());
    await writeFile(layout.stores.scenarios, `${JSON.stringify(scenarios)}\n`);
    const repository = createScenarioRepository(layout);

    assert.deepEqual(
      await repository.getScenarioById("sql-read-orders-production"),
      scenarios[1],
    );
    assert.equal(await repository.getScenarioById("scenario-missing"), null);
  });
});
