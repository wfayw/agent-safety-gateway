import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, join } from "node:path";

import { makeEvidence } from "./codex-adapter.mjs";

const shellBinaries = new Set([
  "bash",
  "cmd",
  "cmd.exe",
  "fish",
  "powershell",
  "powershell.exe",
  "pwsh",
  "pwsh.exe",
  "sh",
  "zsh",
]);

const makeDiagnostic = ({ adapterKind, envName, status, message, reason, command }) => ({
  ok: status === "configured",
  mode: status,
  executorStatus: status,
  adapterKind,
  envName,
  executorInvoked: false,
  message,
  reason,
  command,
});

const parseCommandArray = (envName, adapterKind) => {
  const raw = process.env[envName];

  if (!raw?.trim()) {
    return makeDiagnostic({
      adapterKind,
      envName,
      status: "not_configured",
      message: `${envName} is not configured. The gateway decision was produced, but no real dry-run executor was invoked.`,
    });
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return makeDiagnostic({
      adapterKind,
      envName,
      status: "invalid",
      message: `${envName} must be a JSON string array, for example ["psql","postgres://..."].`,
      reason: `JSON parse failed: ${error.message}`,
    });
  }

  if (typeof parsed === "string") {
    return makeDiagnostic({
      adapterKind,
      envName,
      status: "invalid",
      message: `${envName} must be a JSON string array, not a shell command string.`,
      reason: "Shell-string dry-run commands are rejected to avoid shell interpolation and bypass risk.",
    });
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return makeDiagnostic({
      adapterKind,
      envName,
      status: "invalid",
      message: `${envName} must be a non-empty JSON string array.`,
    });
  }

  if (!parsed.every((entry) => typeof entry === "string" && entry.trim())) {
    return makeDiagnostic({
      adapterKind,
      envName,
      status: "invalid",
      message: `${envName} entries must all be non-empty strings.`,
    });
  }

  const binary = parsed[0].split(/[\\/]/).pop().toLowerCase();

  if (shellBinaries.has(binary)) {
    return makeDiagnostic({
      adapterKind,
      envName,
      status: "invalid",
      message: `${envName} must point directly at a dry-run executor, not a shell interpreter.`,
      reason: `Unsafe shell executor '${parsed[0]}' is rejected before invocation.`,
    });
  }

  return makeDiagnostic({
    adapterKind,
    envName,
    status: "configured",
    message: `${envName} is configured and passed local safety validation.`,
    command: parsed,
  });
};

const canAccessExecutable = async (candidate) => {
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const findExecutable = async (binary) => {
  if (binary.includes("/") || binary.includes("\\")) {
    return (await canAccessExecutable(binary)) ? binary : null;
  }

  const pathEntries = process.env.PATH?.split(delimiter).filter(Boolean) ?? [];

  for (const pathEntry of pathEntries) {
    const candidate = join(pathEntry, binary);

    if (await canAccessExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const validateExecutorCommand = async (envName, adapterKind) => {
  const diagnostic = parseCommandArray(envName, adapterKind);

  if (diagnostic.executorStatus !== "configured") {
    return diagnostic;
  }

  const executablePath = await findExecutable(diagnostic.command[0]);

  if (!executablePath) {
    return makeDiagnostic({
      adapterKind,
      envName,
      status: "unreachable",
      message: `${envName} executable '${diagnostic.command[0]}' is not reachable or executable from PATH.`,
      reason: "The dry-run executor command failed local reachability validation and was not invoked.",
      command: diagnostic.command,
    });
  }

  return {
    ...diagnostic,
    executablePath,
  };
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

const failClosedEvidence = (diagnostic, evidenceName) => ({
  ...diagnostic,
  evidence: makeEvidence(evidenceName),
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
  const diagnostic = await validateExecutorCommand("ASG_SQL_DRY_RUN_COMMAND", "sql_dry_run");

  if (diagnostic.executorStatus !== "configured") {
    return failClosedEvidence(diagnostic, `sql-dry-run-${diagnostic.executorStatus}`);
  }

  const [binary, ...baseArgs] = diagnostic.command;
  const statement = /^select\b/i.test(sql) ? `EXPLAIN ${sql}` : sql;
  const result = await runCommand(binary, [...baseArgs, "-c", statement], "");

  return {
    ok: result.code === 0,
    mode: /^select\b/i.test(sql) ? "readonly" : "dry_run",
    executorStatus: "configured",
    adapterKind: "sql_dry_run",
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

  const diagnostic = await validateExecutorCommand("ASG_CICD_DRY_RUN_COMMAND", "cicd_dry_run");

  if (diagnostic.executorStatus !== "configured") {
    return failClosedEvidence(diagnostic, `cicd-dry-run-${diagnostic.executorStatus}`);
  }

  const [binary, ...baseArgs] = diagnostic.command;
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
    executorStatus: "configured",
    adapterKind: "cicd_dry_run",
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

  const diagnostic = await validateExecutorCommand("ASG_CONFIG_SANDBOX_COMMAND", "config_sandbox");

  if (diagnostic.executorStatus !== "configured") {
    return failClosedEvidence(diagnostic, `config-sandbox-${diagnostic.executorStatus}`);
  }

  const [binary, ...baseArgs] = diagnostic.command;
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
    executorStatus: "configured",
    adapterKind: "config_sandbox",
    executorInvoked: true,
    targetNamespace,
    rollbackPlan: {
      previousValue: request.rawPayload.previousValue ?? null,
    },
    rawResult: result,
    evidence: makeEvidence("config-sandbox-command"),
  };
};
