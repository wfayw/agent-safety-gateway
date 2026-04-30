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

const getSqlKeyword = (sql) =>
  String(sql ?? "").match(/^\s*([a-zA-Z]+)/)?.[1]?.toLowerCase() ?? "unknown";

const isReadonlySql = (sql) => getSqlKeyword(sql) === "select";

const parseBooleanEnv = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  if (/^(true|1|yes)$/i.test(String(value).trim())) {
    return true;
  }

  if (/^(false|0|no)$/i.test(String(value).trim())) {
    return false;
  }

  return null;
};

const getProductionWriteNetworkBoundary = (request) => {
  if (typeof request.rawPayload.productionWriteNetworkBlocked === "boolean") {
    return {
      value: request.rawPayload.productionWriteNetworkBlocked,
      source: "rawPayload.productionWriteNetworkBlocked",
    };
  }

  const envValue = parseBooleanEnv(process.env.ASG_SQL_PRODUCTION_WRITE_NETWORK_BLOCKED);

  if (envValue !== null) {
    return {
      value: envValue,
      source: "ASG_SQL_PRODUCTION_WRITE_NETWORK_BLOCKED",
    };
  }

  return { value: null, source: null };
};

const validateSqlProductionBoundary = (request, adapterKind) => {
  const boundary = getProductionWriteNetworkBoundary(request);

  if (boundary.value === true) {
    return null;
  }

  const knownOpenNetwork = boundary.value === false;
  const status = knownOpenNetwork
    ? "production_write_network_open"
    : "production_write_network_unknown";

  return makeDiagnostic({
    adapterKind,
    envName: boundary.source ?? "rawPayload.productionWriteNetworkBlocked",
    status,
    message: knownOpenNetwork
      ? "SQL adapter refused to run because production write network access is not blocked."
      : "SQL adapter refused to run because the production write network boundary is unknown.",
    reason:
      "Set rawPayload.productionWriteNetworkBlocked=true, or ASG_SQL_PRODUCTION_WRITE_NETWORK_BLOCKED=true, only after verifying the executor cannot write to production.",
  });
};

const parseStdoutJson = (stdout) => {
  const trimmed = String(stdout ?? "").trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const getRowCount = (payload) => {
  if (Number.isInteger(payload?.rowCount)) {
    return payload.rowCount;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows.length;
  }

  return null;
};

const getExplainPlan = (payload, stdout, includeRawText) => {
  if (payload?.explainPlan !== undefined) {
    return payload.explainPlan;
  }

  const text = String(stdout ?? "").trim();

  if (includeRawText && text) {
    return { text };
  }

  return null;
};

const normalizeCiCdTestStatus = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) {
    return "missing";
  }

  if (["pass", "passed", "success", "succeeded"].includes(normalized)) {
    return "passed";
  }

  if (["fail", "failed", "failure", "errored"].includes(normalized)) {
    return "failed";
  }

  return "unknown";
};

const getCiCdValue = (request, key, fallback) =>
  String(request.rawPayload[key] ?? fallback);

const validateCiCdProductionDeployTests = (request) => {
  const environment = String(request.environment ?? "unknown-environment").toLowerCase();
  const operation = String(request.rawPayload.operation ?? "deploy").toLowerCase();
  const testStatus = normalizeCiCdTestStatus(request.rawPayload.testStatus);

  if (!["production", "prod"].includes(environment) || operation !== "deploy") {
    return { ok: true, testStatus };
  }

  if (testStatus === "passed") {
    return { ok: true, testStatus };
  }

  return {
    ok: false,
    diagnostic: makeDiagnostic({
      adapterKind: "cicd_dry_run",
      envName: "rawPayload.testStatus",
      status: "production_deploy_tests_not_passed",
      message:
        "CI/CD dry-run adapter refused a production deploy because tests are not confirmed passed.",
      reason: `Production deploys require testStatus='passed' before any CI/CD dry-run command can be invoked; received '${testStatus}'.`,
    }),
    testStatus,
  };
};

const getArtifactUris = (payload) => {
  if (Array.isArray(payload?.artifactUris)) {
    return payload.artifactUris.filter((uri) => typeof uri === "string" && uri.trim());
  }

  if (typeof payload?.artifactUri === "string" && payload.artifactUri.trim()) {
    return [payload.artifactUri];
  }

  return [];
};

const getDryRunRunId = (payload) =>
  typeof payload?.runId === "string" && payload.runId.trim() ? payload.runId : null;

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
  const readonly = isReadonlySql(sql);
  const adapterKind = readonly ? "sql_readonly" : "sql_dry_run";
  const envName = readonly ? "ASG_SQL_READONLY_COMMAND" : "ASG_SQL_DRY_RUN_COMMAND";
  const diagnostic = await validateExecutorCommand(envName, adapterKind);

  if (diagnostic.executorStatus !== "configured") {
    return failClosedEvidence(
      diagnostic,
      `sql-${readonly ? "readonly" : "dry-run"}-${diagnostic.executorStatus}`,
    );
  }

  const boundaryDiagnostic = validateSqlProductionBoundary(request, adapterKind);

  if (boundaryDiagnostic) {
    return failClosedEvidence(
      boundaryDiagnostic,
      `sql-${readonly ? "readonly" : "dry-run"}-${boundaryDiagnostic.executorStatus}`,
    );
  }

  const [binary, ...baseArgs] = diagnostic.command;
  const statement = readonly ? sql : `EXPLAIN ${sql}`;
  const result = await runCommand(binary, [...baseArgs, "-c", statement], "");
  const parsedOutput = parseStdoutJson(result.stdout);

  return {
    ok: result.code === 0,
    mode: readonly ? "readonly" : "dry_run",
    executorStatus: "configured",
    adapterKind,
    executorInvoked: true,
    rowCount: getRowCount(parsedOutput),
    explainPlan: getExplainPlan(parsedOutput, result.stdout, !readonly),
    productionWriteNetworkBlocked: true,
    executedStatement: statement,
    rawResult: result,
    evidence: makeEvidence(readonly ? "sql-readonly-command" : "sql-dry-run-command"),
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

  const productionDeployTestCheck = validateCiCdProductionDeployTests(request);

  if (!productionDeployTestCheck.ok) {
    return {
      ...failClosedEvidence(
        productionDeployTestCheck.diagnostic,
        "cicd-production-deploy-tests-not-passed",
      ),
      testStatus: productionDeployTestCheck.testStatus,
      environment: request.environment,
      operation: request.rawPayload.operation ?? "deploy",
    };
  }

  const diagnostic = await validateExecutorCommand("ASG_CICD_DRY_RUN_COMMAND", "cicd_dry_run");

  if (diagnostic.executorStatus !== "configured") {
    return failClosedEvidence(diagnostic, `cicd-dry-run-${diagnostic.executorStatus}`);
  }

  const [binary, ...baseArgs] = diagnostic.command;
  const service = getCiCdValue(request, "service", "unknown-service");
  const operation = getCiCdValue(request, "operation", "deploy");
  const pipeline = getCiCdValue(request, "pipeline", "unknown-pipeline");
  const version = getCiCdValue(request, "version", "unknown-version");
  const environment = String(request.environment ?? "unknown-environment");
  const testStatus = productionDeployTestCheck.testStatus;
  const args = [
    ...baseArgs,
    "--service",
    service,
    "--operation",
    operation,
    "--pipeline",
    pipeline,
    "--version",
    version,
    "--environment",
    environment,
    "--test-status",
    testStatus,
  ];
  const result = await runCommand(binary, args, "");
  const parsedOutput = parseStdoutJson(result.stdout);
  const artifactUris = getArtifactUris(parsedOutput);
  const evidence = makeEvidence("cicd-dry-run-command", artifactUris);
  const runId = getDryRunRunId(parsedOutput) ?? evidence.runId;
  evidence.runId = runId;

  return {
    ok: result.code === 0,
    mode: "dry_run",
    executorStatus: "configured",
    adapterKind: "cicd_dry_run",
    executorInvoked: true,
    service,
    operation,
    pipeline,
    version,
    environment,
    testStatus,
    pipelineStatus: testStatus,
    runId,
    artifactUris,
    dryRunPlan: parsedOutput?.dryRunPlan ?? parsedOutput?.plan ?? null,
    rawResult: result,
    evidence,
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
