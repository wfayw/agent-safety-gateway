import { spawn } from "node:child_process";

import { makeEvidence } from "./codex-adapter.mjs";

const parseCommandArray = (envName) => {
  const raw = process.env[envName];

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) {
      return parsed;
    }
  } catch {
    // Fall through to the safer not-configured result below.
  }

  throw new Error(`${envName} must be a JSON string array, for example ["psql","postgres://..."].`);
};

const runCommand = (command, args, stdin, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Dry-run command timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });

    if (stdin) {
      child.stdin.write(stdin);
    }

    child.stdin.end();
  });

const notConfigured = (adapterKind, envName) => ({
  ok: false,
  mode: "not_configured",
  adapterKind,
  executorInvoked: false,
  message: `${envName} is not configured. The gateway decision was produced, but no real dry-run executor was invoked.`,
});

export const canExecuteDecision = (analysis, acceptedDecisionTypes = ["allow"]) =>
  acceptedDecisionTypes.includes(analysis.executionDecision?.type) &&
  analysis.riskLevel !== "prohibited";

export const executeSqlDryRun = async (request, analysis) => {
  if (!canExecuteDecision(analysis)) {
    return {
      ok: true,
      mode: "skipped_by_gateway",
      executorInvoked: false,
      reason: analysis.executionDecision?.reason ?? "Gateway did not allow SQL execution.",
      evidence: makeEvidence("sql-dry-run-skipped"),
    };
  }

  const sql = String(request.rawPayload.sql ?? "").trim();
  const command = parseCommandArray("ASG_SQL_DRY_RUN_COMMAND");

  if (!command) {
    return notConfigured("sql_dry_run", "ASG_SQL_DRY_RUN_COMMAND");
  }

  const [binary, ...baseArgs] = command;
  const statement = /^select\b/i.test(sql) ? `EXPLAIN ${sql}` : sql;
  const result = await runCommand(binary, [...baseArgs, "-c", statement], "");

  return {
    ok: result.code === 0,
    mode: /^select\b/i.test(sql) ? "readonly" : "dry_run",
    executorInvoked: true,
    rowCount: null,
    explainPlan: result.stdout ? { text: result.stdout } : null,
    rawResult: result,
    evidence: makeEvidence("sql-dry-run-command"),
  };
};

export const executeCiCdDryRun = async (request, analysis) => {
  if (!canExecuteDecision(analysis)) {
    return {
      ok: true,
      mode: "skipped_by_gateway",
      executorInvoked: false,
      reason: analysis.executionDecision?.reason ?? "Gateway did not allow CI/CD execution.",
      evidence: makeEvidence("cicd-dry-run-skipped"),
    };
  }

  const command = parseCommandArray("ASG_CICD_DRY_RUN_COMMAND");

  if (!command) {
    return notConfigured("cicd_dry_run", "ASG_CICD_DRY_RUN_COMMAND");
  }

  const [binary, ...baseArgs] = command;
  const args = [
    ...baseArgs,
    "--service",
    String(request.rawPayload.service ?? "unknown-service"),
    "--operation",
    String(request.rawPayload.operation ?? "deploy"),
    "--environment",
    request.environment,
  ];
  const result = await runCommand(binary, args, "");

  return {
    ok: result.code === 0,
    mode: "dry_run",
    executorInvoked: true,
    pipelineStatus: request.rawPayload.testStatus ?? "unknown",
    rawResult: result,
    evidence: makeEvidence("cicd-dry-run-command"),
  };
};

export const executeConfigSandbox = async (request, analysis) => {
  const canExecuteSandbox = canExecuteDecision(analysis, ["allow", "sandbox"]);

  if (!canExecuteSandbox) {
    return {
      ok: true,
      mode: "skipped_by_gateway",
      executorInvoked: false,
      reason: analysis.executionDecision?.reason ?? "Gateway did not allow config execution.",
      evidence: makeEvidence("config-sandbox-skipped"),
    };
  }

  const command = parseCommandArray("ASG_CONFIG_SANDBOX_COMMAND");

  if (!command) {
    return notConfigured("config_sandbox", "ASG_CONFIG_SANDBOX_COMMAND");
  }

  const [binary, ...baseArgs] = command;
  const targetNamespace =
    process.env.ASG_CONFIG_SANDBOX_NAMESPACE ??
    `${request.environment}-codex-sandbox`;
  const args = [
    ...baseArgs,
    "--service",
    String(request.rawPayload.service ?? "unknown-service"),
    "--key",
    String(request.rawPayload.key ?? "unknown.key"),
    "--value",
    String(request.rawPayload.value ?? ""),
    "--namespace",
    targetNamespace,
  ];
  const result = await runCommand(binary, args, "");

  return {
    ok: result.code === 0,
    mode: "sandbox",
    executorInvoked: true,
    targetNamespace,
    rollbackPlan: {
      previousValue: request.rawPayload.previousValue ?? null,
    },
    rawResult: result,
    evidence: makeEvidence("config-sandbox-command"),
  };
};
