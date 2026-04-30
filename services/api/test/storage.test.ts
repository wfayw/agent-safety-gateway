import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  createLocalStorageLayout,
  initializeLocalStorage,
} from "../src/storage.js";

const tempDirs: string[] = [];

const createTempDataDir = async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "agent-safety-gateway-data-"));
  tempDirs.push(tempDir);
  return tempDir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })),
  );
});

describe("local storage", () => {
  it("creates the MVP storage files under the configured data directory", async () => {
    const dataDir = await createTempDataDir();

    const layout = await initializeLocalStorage(dataDir);

    assert.deepEqual(Object.keys(layout.stores).sort(), [
      "audits",
      "dependencies",
      "executionLogs",
      "hookDecisions",
      "resources",
      "scenarios",
    ]);
    assert.equal(await readFile(layout.stores.resources, "utf8"), "[]\n");
    assert.equal(await readFile(layout.stores.dependencies, "utf8"), "[]\n");
    assert.equal(await readFile(layout.stores.audits, "utf8"), "");
    assert.equal(await readFile(layout.stores.scenarios, "utf8"), "[]\n");
    assert.equal(await readFile(layout.stores.executionLogs, "utf8"), "");
    assert.equal(await readFile(layout.stores.hookDecisions, "utf8"), "");
  });

  it("keeps existing local data when initialization is repeated", async () => {
    const dataDir = await createTempDataDir();
    const layout = createLocalStorageLayout(dataDir);

    await initializeLocalStorage(dataDir);
    await writeFile(layout.stores.resources, '[{"resourceId":"database.orders"}]\n');
    await writeFile(layout.stores.audits, '{"auditId":"audit-1"}\n');
    await writeFile(layout.stores.executionLogs, '{"requestId":"req-1"}\n');
    await writeFile(layout.stores.hookDecisions, '{"id":"hook-1"}\n');

    await initializeLocalStorage(dataDir);

    assert.equal(
      await readFile(layout.stores.resources, "utf8"),
      '[{"resourceId":"database.orders"}]\n',
    );
    assert.equal(await readFile(layout.stores.audits, "utf8"), '{"auditId":"audit-1"}\n');
    assert.equal(
      await readFile(layout.stores.executionLogs, "utf8"),
      '{"requestId":"req-1"}\n',
    );
    assert.equal(
      await readFile(layout.stores.hookDecisions, "utf8"),
      '{"id":"hook-1"}\n',
    );
  });
});
