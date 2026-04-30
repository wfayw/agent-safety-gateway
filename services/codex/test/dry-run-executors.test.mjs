import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  executeCiCdDryRun,
  executeConfigSandbox,
  executeSqlDryRun,
  validateExecutorCommand,
} from "../src/dry-run-executors.mjs";

const envNames = [
  "ASG_SQL_READONLY_COMMAND",
  "ASG_SQL_DRY_RUN_COMMAND",
  "ASG_SQL_PRODUCTION_WRITE_NETWORK_BLOCKED",
  "ASG_CICD_DRY_RUN_COMMAND",
  "ASG_CONFIG_CANARY_NAMESPACE",
  "ASG_CONFIG_SANDBOX_COMMAND",
  "ASG_CONFIG_SANDBOX_NAMESPACE",
  "ASG_TEST_EXECUTOR_OUTPUT_PATH",
];
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
const tempDirs = [];

const allowAnalysis = {
  riskLevel: "low",
  executionDecision: {
    type: "allow",
    code: "SAFE_TOOL_CALL_ALLOWED",
    reason: "Allowed by test fixture.",
  },
};

const sandboxAnalysis = {
  riskLevel: "medium",
  executionDecision: {
    type: "sandbox",
    code: "CONFIG_SANDBOX_REQUIRED",
    reason: "Sandbox config changes before production.",
  },
};

const canaryAnalysis = {
  riskLevel: "medium",
  executionDecision: {
    type: "sandbox",
    code: "CONFIG_SANDBOX_REQUIRED",
    reason: "Route production config changes through canary namespace first.",
    rewrittenRequest: {
      rawPayload: {
        rolloutStrategy: "canary",
      },
    },
  },
};

const sqlRequest = {
  rawPayload: {
    sql: "SELECT COUNT(*) FROM orders",
    productionWriteNetworkBlocked: true,
  },
};

const sqlWriteRequest = {
  rawPayload: {
    sql: "UPDATE orders SET status='ARCHIVED' WHERE status='PENDING'",
    productionWriteNetworkBlocked: true,
  },
};

const deployRequest = {
  environment: "staging",
  rawPayload: {
    service: "payment-service",
    operation: "deploy",
    pipeline: "payment-service-release",
    version: "2026.05.01",
    testStatus: "passed",
  },
};

const configRequest = {
  environment: "production",
  rawPayload: {
    service: "payment-service",
    key: "payment.timeout_ms",
    value: 250,
    previousValue: 500,
  },
};

const resetEnv = () => {
  for (const name of envNames) {
    if (originalEnv[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = originalEnv[name];
    }
  }
};

const makeRecorder = async (name) => {
  const dir = await mkdtemp(join(tmpdir(), "asg-dry-run-test-"));
  tempDirs.push(dir);
  const outputPath = join(dir, `${name}.json`);
  const scriptPath = join(dir, `${name}.mjs`);

  await writeFile(
    scriptPath,
    [
      "#!/usr/bin/env node",
      "import { writeFileSync } from 'node:fs';",
      "const outputPath = process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH;",
      "writeFileSync(outputPath, JSON.stringify({ args: process.argv.slice(2) }));",
      "console.log(JSON.stringify({ ok: true, args: process.argv.slice(2) }));",
    ].join("\n"),
    { mode: 0o700 },
  );

  return { outputPath, scriptPath };
};

const readRecorderArgs = async (outputPath) => {
  const raw = await readFile(outputPath, "utf8");

  return JSON.parse(raw).args;
};

afterEach(async () => {
  resetEnv();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("dry-run executor profile validation", () => {
  it("reports not_configured without invoking SQL executors", async () => {
    delete process.env.ASG_SQL_READONLY_COMMAND;
    const result = await executeSqlDryRun(sqlRequest, allowAnalysis);

    assert.equal(result.mode, "not_configured");
    assert.equal(result.executorStatus, "not_configured");
    assert.equal(result.adapterKind, "sql_readonly");
    assert.equal(result.executorInvoked, false);
  });

  it("rejects malformed JSON command configuration without invocation", async () => {
    process.env.ASG_CICD_DRY_RUN_COMMAND = "not-json";
    const result = await executeCiCdDryRun(deployRequest, allowAnalysis);

    assert.equal(result.mode, "invalid");
    assert.equal(result.executorStatus, "invalid");
    assert.equal(result.adapterKind, "cicd_dry_run");
    assert.equal(result.executorInvoked, false);
    assert.match(result.message, /JSON string array/);
  });

  it("rejects shell-string commands without invocation", async () => {
    process.env.ASG_SQL_READONLY_COMMAND = JSON.stringify("psql -c 'SELECT 1'");
    const result = await executeSqlDryRun(sqlRequest, allowAnalysis);

    assert.equal(result.mode, "invalid");
    assert.equal(result.executorStatus, "invalid");
    assert.equal(result.executorInvoked, false);
    assert.match(result.reason, /Shell-string/);
  });

  it("rejects shell interpreter arrays as unsafe", async () => {
    process.env.ASG_CONFIG_SANDBOX_COMMAND = JSON.stringify(["sh", "-c", "echo unsafe"]);
    const result = await executeConfigSandbox(configRequest, sandboxAnalysis);

    assert.equal(result.mode, "invalid");
    assert.equal(result.executorStatus, "invalid");
    assert.equal(result.adapterKind, "config_sandbox");
    assert.equal(result.executorInvoked, false);
    assert.match(result.reason, /shell executor/);
  });

  it("reports unreachable command configuration without invocation", async () => {
    process.env.ASG_SQL_READONLY_COMMAND = JSON.stringify(["/definitely/missing/asg-sql-readonly"]);
    const result = await executeSqlDryRun(sqlRequest, allowAnalysis);

    assert.equal(result.mode, "unreachable");
    assert.equal(result.executorStatus, "unreachable");
    assert.equal(result.executorInvoked, false);
    assert.match(result.message, /not reachable/);
  });

  it("reports configured for executable JSON array profiles", async () => {
    delete process.env.ASG_CICD_DRY_RUN_COMMAND;
    const diagnostic = await validateExecutorCommand("ASG_CICD_DRY_RUN_COMMAND", "cicd_dry_run");

    assert.equal(diagnostic.executorStatus, "not_configured");

    process.env.ASG_CICD_DRY_RUN_COMMAND = JSON.stringify([process.execPath, "--version"]);
    const configured = await validateExecutorCommand("ASG_CICD_DRY_RUN_COMMAND", "cicd_dry_run");

    assert.equal(configured.mode, "configured");
    assert.equal(configured.executorStatus, "configured");
    assert.equal(configured.executorInvoked, false);
    assert.ok(configured.executablePath);
  });

  it("invokes valid SQL, CI/CD, and config executor profiles", async () => {
    const sqlRecorder = await makeRecorder("sql");
    const deployRecorder = await makeRecorder("deploy");
    const configRecorder = await makeRecorder("config");

    process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH = sqlRecorder.outputPath;
    process.env.ASG_SQL_READONLY_COMMAND = JSON.stringify([process.execPath, sqlRecorder.scriptPath]);
    const sqlResult = await executeSqlDryRun(sqlRequest, allowAnalysis);

    assert.equal(sqlResult.mode, "readonly");
    assert.equal(sqlResult.executorStatus, "configured");
    assert.equal(sqlResult.adapterKind, "sql_readonly");
    assert.equal(sqlResult.executorInvoked, true);
    assert.equal(sqlResult.productionWriteNetworkBlocked, true);
    assert.equal(sqlResult.executedStatement, "SELECT COUNT(*) FROM orders");
    assert.deepEqual(await readRecorderArgs(sqlRecorder.outputPath), [
      "-c",
      "SELECT COUNT(*) FROM orders",
    ]);

    process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH = deployRecorder.outputPath;
    process.env.ASG_CICD_DRY_RUN_COMMAND = JSON.stringify([process.execPath, deployRecorder.scriptPath]);
    const deployResult = await executeCiCdDryRun(deployRequest, allowAnalysis);

    assert.equal(deployResult.mode, "dry_run");
    assert.equal(deployResult.executorStatus, "configured");
    assert.equal(deployResult.executorInvoked, true);
    assert.deepEqual(await readRecorderArgs(deployRecorder.outputPath), [
      "--service",
      "payment-service",
      "--operation",
      "deploy",
      "--pipeline",
      "payment-service-release",
      "--version",
      "2026.05.01",
      "--environment",
      "staging",
      "--test-status",
      "passed",
    ]);

    process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH = configRecorder.outputPath;
    process.env.ASG_CONFIG_SANDBOX_COMMAND = JSON.stringify([process.execPath, configRecorder.scriptPath]);
    process.env.ASG_CONFIG_SANDBOX_NAMESPACE = "payment-sandbox";
    const configResult = await executeConfigSandbox(configRequest, sandboxAnalysis);

    assert.equal(configResult.mode, "sandbox");
    assert.equal(configResult.executorStatus, "configured");
    assert.equal(configResult.executorInvoked, true);
    assert.equal(configResult.targetNamespace, "payment-sandbox");
    assert.deepEqual(await readRecorderArgs(configRecorder.outputPath), [
      "--service",
      "payment-service",
      "--key",
      "payment.timeout_ms",
      "--value",
      "250",
      "--operation",
      "update",
      "--source-namespace",
      "production",
      "--namespace",
      "payment-sandbox",
      "--mode",
      "sandbox",
    ]);
  });

  it("routes production payment timeout updates to sandbox or canary namespaces", async () => {
    const sandboxRecorder = await makeRecorder("config-sandbox-route");
    const canaryRecorder = await makeRecorder("config-canary-route");

    process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH = sandboxRecorder.outputPath;
    process.env.ASG_CONFIG_SANDBOX_COMMAND = JSON.stringify([
      process.execPath,
      sandboxRecorder.scriptPath,
    ]);
    process.env.ASG_CONFIG_SANDBOX_NAMESPACE = "payment-sandbox";
    const sandboxResult = await executeConfigSandbox(
      {
        environment: "production",
        rawPayload: {
          service: "payment-service",
          key: "payment.timeout",
          value: "100ms",
          previousValue: "2s",
          namespace: "production",
        },
      },
      sandboxAnalysis,
    );

    assert.equal(sandboxResult.mode, "sandbox");
    assert.equal(sandboxResult.executorInvoked, true);
    assert.equal(sandboxResult.targetNamespace, "payment-sandbox");
    assert.equal(sandboxResult.sourceNamespace, "production");
    assert.equal(sandboxResult.rollbackPlan.previousValue, "2s");
    assert.deepEqual(await readRecorderArgs(sandboxRecorder.outputPath), [
      "--service",
      "payment-service",
      "--key",
      "payment.timeout",
      "--value",
      "100ms",
      "--operation",
      "update",
      "--source-namespace",
      "production",
      "--namespace",
      "payment-sandbox",
      "--mode",
      "sandbox",
    ]);

    process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH = canaryRecorder.outputPath;
    process.env.ASG_CONFIG_CANARY_NAMESPACE = "payment-canary";
    const canaryResult = await executeConfigSandbox(
      {
        environment: "production",
        rawPayload: {
          service: "payment-service",
          key: "payment.timeout",
          value: "100ms",
          previousValue: "2s",
          namespace: "production",
        },
      },
      canaryAnalysis,
    );

    assert.equal(canaryResult.mode, "canary");
    assert.equal(canaryResult.executorInvoked, true);
    assert.equal(canaryResult.targetNamespace, "payment-canary");
    assert.deepEqual(await readRecorderArgs(canaryRecorder.outputPath), [
      "--service",
      "payment-service",
      "--key",
      "payment.timeout",
      "--value",
      "100ms",
      "--operation",
      "update",
      "--source-namespace",
      "production",
      "--namespace",
      "payment-canary",
      "--mode",
      "canary",
    ]);
  });

  it("refuses direct production config namespace writes before invocation", async () => {
    const configRecorder = await makeRecorder("config-production-refused");

    process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH = configRecorder.outputPath;
    process.env.ASG_CONFIG_SANDBOX_COMMAND = JSON.stringify([
      process.execPath,
      configRecorder.scriptPath,
    ]);
    const result = await executeConfigSandbox(
      {
        environment: "production",
        rawPayload: {
          service: "payment-service",
          key: "payment.timeout",
          value: "100ms",
          previousValue: "2s",
          targetNamespace: "production",
        },
      },
      sandboxAnalysis,
    );

    assert.equal(result.mode, "production_namespace_refused");
    assert.equal(result.executorStatus, "production_namespace_refused");
    assert.equal(result.executorInvoked, false);
    assert.match(result.reason, /never production/);
    assert.equal(existsSync(configRecorder.outputPath), false);
  });

  it("parses readonly row counts and invokes dry-run writes through EXPLAIN", async () => {
    const readonlyRecorder = await makeRecorder("sql-readonly");
    const dryRunRecorder = await makeRecorder("sql-dry-run");

    await writeFile(
      readonlyRecorder.scriptPath,
      [
        "#!/usr/bin/env node",
        "import { writeFileSync } from 'node:fs';",
        "const outputPath = process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH;",
        "writeFileSync(outputPath, JSON.stringify({ args: process.argv.slice(2) }));",
        "console.log(JSON.stringify({ rowCount: 2, rows: [{ id: 1 }, { id: 2 }] }));",
      ].join("\n"),
      { mode: 0o700 },
    );

    process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH = readonlyRecorder.outputPath;
    process.env.ASG_SQL_READONLY_COMMAND = JSON.stringify([
      process.execPath,
      readonlyRecorder.scriptPath,
    ]);
    const readonlyResult = await executeSqlDryRun(sqlRequest, allowAnalysis);

    assert.equal(readonlyResult.mode, "readonly");
    assert.equal(readonlyResult.rowCount, 2);
    assert.equal(readonlyResult.explainPlan, null);
    assert.deepEqual(await readRecorderArgs(readonlyRecorder.outputPath), [
      "-c",
      "SELECT COUNT(*) FROM orders",
    ]);

    process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH = dryRunRecorder.outputPath;
    process.env.ASG_SQL_DRY_RUN_COMMAND = JSON.stringify([
      process.execPath,
      dryRunRecorder.scriptPath,
    ]);
    const dryRunResult = await executeSqlDryRun(sqlWriteRequest, allowAnalysis);

    assert.equal(dryRunResult.mode, "dry_run");
    assert.equal(dryRunResult.adapterKind, "sql_dry_run");
    assert.equal(dryRunResult.executorInvoked, true);
    assert.equal(
      dryRunResult.executedStatement,
      "EXPLAIN UPDATE orders SET status='ARCHIVED' WHERE status='PENDING'",
    );
    assert.match(dryRunResult.explainPlan.text, /EXPLAIN UPDATE orders/);
    assert.deepEqual(await readRecorderArgs(dryRunRecorder.outputPath), [
      "-c",
      "EXPLAIN UPDATE orders SET status='ARCHIVED' WHERE status='PENDING'",
    ]);
  });

  it("refuses production deploy dry-runs when tests are failed, unknown, or missing", async () => {
    for (const testStatus of ["failed", "unknown", undefined]) {
      const deployRecorder = await makeRecorder(`deploy-${testStatus ?? "missing"}`);
      process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH = deployRecorder.outputPath;
      process.env.ASG_CICD_DRY_RUN_COMMAND = JSON.stringify([
        process.execPath,
        deployRecorder.scriptPath,
      ]);

      const result = await executeCiCdDryRun(
        {
          environment: "production",
          rawPayload: {
            service: "payment-service",
            operation: "deploy",
            pipeline: "payment-service-release",
            version: "2026.05.01",
            ...(testStatus === undefined ? {} : { testStatus }),
          },
        },
        allowAnalysis,
      );

      assert.equal(result.mode, "production_deploy_tests_not_passed");
      assert.equal(result.executorStatus, "production_deploy_tests_not_passed");
      assert.equal(result.adapterKind, "cicd_dry_run");
      assert.equal(result.executorInvoked, false);
      assert.equal(result.testStatus, testStatus ?? "missing");
      assert.equal(existsSync(deployRecorder.outputPath), false);
    }
  });

  it("invokes passed production deploy dry-runs and records plan evidence", async () => {
    const deployRecorder = await makeRecorder("deploy-plan");

    await writeFile(
      deployRecorder.scriptPath,
      [
        "#!/usr/bin/env node",
        "import { writeFileSync } from 'node:fs';",
        "const outputPath = process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH;",
        "writeFileSync(outputPath, JSON.stringify({ args: process.argv.slice(2) }));",
        "console.log(JSON.stringify({ runId: 'dry-run-123', artifactUris: ['file:///tmp/deploy-plan.json'], dryRunPlan: { changes: ['would deploy payment-service'] } }));",
      ].join("\n"),
      { mode: 0o700 },
    );

    process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH = deployRecorder.outputPath;
    process.env.ASG_CICD_DRY_RUN_COMMAND = JSON.stringify([
      process.execPath,
      deployRecorder.scriptPath,
    ]);
    const result = await executeCiCdDryRun(
      {
        environment: "production",
        rawPayload: {
          service: "payment-service",
          operation: "deploy",
          pipeline: "payment-service-release",
          version: "2026.05.01",
          testStatus: "passed",
        },
      },
      allowAnalysis,
    );

    assert.equal(result.mode, "dry_run");
    assert.equal(result.executorStatus, "configured");
    assert.equal(result.executorInvoked, true);
    assert.equal(result.runId, "dry-run-123");
    assert.deepEqual(result.artifactUris, ["file:///tmp/deploy-plan.json"]);
    assert.equal(result.evidence.runId, "dry-run-123");
    assert.deepEqual(result.evidence.artifactUris, ["file:///tmp/deploy-plan.json"]);
    assert.deepEqual(result.dryRunPlan, { changes: ["would deploy payment-service"] });
    assert.deepEqual(await readRecorderArgs(deployRecorder.outputPath), [
      "--service",
      "payment-service",
      "--operation",
      "deploy",
      "--pipeline",
      "payment-service-release",
      "--version",
      "2026.05.01",
      "--environment",
      "production",
      "--test-status",
      "passed",
    ]);
  });

  it("refuses SQL execution when the production write network boundary is false or unknown", async () => {
    const unknownBoundaryRecorder = await makeRecorder("sql-unknown-boundary");
    const openBoundaryRecorder = await makeRecorder("sql-open-boundary");

    delete process.env.ASG_SQL_PRODUCTION_WRITE_NETWORK_BLOCKED;
    process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH = unknownBoundaryRecorder.outputPath;
    process.env.ASG_SQL_READONLY_COMMAND = JSON.stringify([
      process.execPath,
      unknownBoundaryRecorder.scriptPath,
    ]);
    const unknownBoundaryResult = await executeSqlDryRun(
      { rawPayload: { sql: "SELECT COUNT(*) FROM orders" } },
      allowAnalysis,
    );

    assert.equal(unknownBoundaryResult.mode, "production_write_network_unknown");
    assert.equal(unknownBoundaryResult.executorInvoked, false);
    assert.equal(existsSync(unknownBoundaryRecorder.outputPath), false);

    process.env.ASG_TEST_EXECUTOR_OUTPUT_PATH = openBoundaryRecorder.outputPath;
    process.env.ASG_SQL_READONLY_COMMAND = JSON.stringify([
      process.execPath,
      openBoundaryRecorder.scriptPath,
    ]);
    const openBoundaryResult = await executeSqlDryRun(
      {
        rawPayload: {
          sql: "SELECT COUNT(*) FROM orders",
          productionWriteNetworkBlocked: false,
        },
      },
      allowAnalysis,
    );

    assert.equal(openBoundaryResult.mode, "production_write_network_open");
    assert.equal(openBoundaryResult.executorInvoked, false);
    assert.equal(existsSync(openBoundaryRecorder.outputPath), false);
  });

  it("never invokes dry-run commands when validation fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "asg-dry-run-test-"));
    tempDirs.push(dir);
    const markerPath = join(dir, "unsafe-marker.txt");

    process.env.ASG_SQL_READONLY_COMMAND = JSON.stringify([
      "sh",
      "-c",
      `printf invoked > ${markerPath}`,
    ]);
    const invalidResult = await executeSqlDryRun(sqlRequest, allowAnalysis);

    assert.equal(invalidResult.executorInvoked, false);
    assert.equal(invalidResult.mode, "invalid");
    assert.equal(existsSync(markerPath), false);
  });
});
