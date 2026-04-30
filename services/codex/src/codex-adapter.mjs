import { createHash, randomUUID } from "node:crypto";

export const ToolType = {
  Sql: "sql",
  CiCd: "ci_cd",
  Config: "config",
};

export const Environment = {
  Development: "development",
  Test: "test",
  Staging: "staging",
  Production: "production",
};

const sqlMutatingKeywords = new Set([
  "insert",
  "update",
  "delete",
  "drop",
  "truncate",
  "alter",
  "create",
  "replace",
  "merge",
]);

const knownSqlKeywords = new Set([
  "select",
  "insert",
  "update",
  "delete",
  "drop",
  "truncate",
  "alter",
  "create",
  "replace",
  "merge",
]);

const jsonValue = (value, fallback) =>
  value === undefined || value === null || value === "" ? fallback : value;

const hashText = (text) =>
  createHash("sha256").update(text).digest("hex").slice(0, 10);

export const createRequestId = (source, payload) =>
  `req-codex-${source}-${Date.now()}-${hashText(JSON.stringify(payload))}`;

export const normalizeEnvironment = (value, evidence = "") => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (["prod", "production"].includes(normalized)) {
    return Environment.Production;
  }

  if (["stage", "staging", "preprod", "pre-production"].includes(normalized)) {
    return Environment.Staging;
  }

  if (["test", "testing", "qa"].includes(normalized)) {
    return Environment.Test;
  }

  if (["dev", "development", "local"].includes(normalized)) {
    return Environment.Development;
  }

  const haystack = evidence.toLowerCase();

  if (/\b(prod|production|prd)\b|[-_.]prod\b|\bprod[-_.]/.test(haystack)) {
    return Environment.Production;
  }

  if (/\b(staging|stage|preprod|uat)\b/.test(haystack)) {
    return Environment.Staging;
  }

  if (/\b(test|testing|qa)\b/.test(haystack)) {
    return Environment.Test;
  }

  return Environment.Development;
};

export const buildToolCallRequest = ({
  actor = "agent:codex",
  taskPurpose,
  toolType,
  rawPayload,
  environment,
  requestId,
}) => ({
  id: requestId ?? createRequestId(toolType, rawPayload),
  actor,
  taskPurpose,
  toolType,
  rawPayload,
  environment,
  createdAt: new Date().toISOString(),
});

const unquote = (value) =>
  value ? value.replace(/^['"]|['"]$/g, "").trim() : value;

export const extractSqlFromCommand = (command) => {
  const shellSql = /(?:^|\s)(?:-c|-e)\s+(["'])([\s\S]*?)\1/.exec(command);

  if (shellSql?.[2]) {
    return shellSql[2].trim();
  }

  const heredocSql = /<<['"]?SQL['"]?\s*([\s\S]*?)\s*SQL\b/i.exec(command);

  if (heredocSql?.[1]) {
    return heredocSql[1].trim();
  }

  const inlineSql = /\b(select|insert|update|delete|drop|truncate|alter|create|replace|merge)\b[\s\S]*$/i.exec(
    command,
  );

  return inlineSql?.[0]?.trim() ?? null;
};

const getSqlKeyword = (sql) =>
  sql.match(/^\s*([a-zA-Z]+)/)?.[1]?.toLowerCase() ?? "unknown";

export const isUnsupportedDestructiveSql = (sql) => {
  const keyword = getSqlKeyword(sql);

  return sqlMutatingKeywords.has(keyword) && !["insert", "update", "delete"].includes(keyword);
};

const inferDatabase = (command, explicitDatabase) => {
  if (explicitDatabase) {
    return explicitDatabase;
  }

  const dbFlag =
    /(?:^|\s)(?:--dbname=|-d\s+)([^\s]+)/.exec(command)?.[1] ??
    /(?:^|\s)(?:--database=|--database\s+)([^\s]+)/.exec(command)?.[1];

  if (dbFlag) {
    return unquote(dbFlag);
  }

  const uri = /(postgres(?:ql)?:\/\/[^\s'"]+|mysql:\/\/[^\s'"]+)/i.exec(command)?.[1];

  if (uri) {
    return uri;
  }

  return command.includes("orders-prod") ? "orders-prod" : "unknown";
};

export const adaptSql = ({
  sql,
  database,
  environment,
  actor,
  taskPurpose,
  command,
  productionWriteNetworkBlocked,
}) => {
  const payload = {
    sql,
    database: database ?? "unknown",
    source: "codex",
  };

  if (command) {
    payload.command = command;
  }

  if (typeof productionWriteNetworkBlocked === "boolean") {
    payload.productionWriteNetworkBlocked = productionWriteNetworkBlocked;
  }

  return buildToolCallRequest({
    actor,
    taskPurpose:
      taskPurpose ??
      `Codex requested SQL ${getSqlKeyword(sql).toUpperCase()} via safety gateway`,
    toolType: ToolType.Sql,
    rawPayload: payload,
    environment: normalizeEnvironment(environment, `${database ?? ""} ${command ?? ""}`),
  });
};

const inferCiCdOperation = (command, explicitOperation) => {
  const value = String(explicitOperation ?? "").toLowerCase();

  if (["deploy", "deployment", "release"].includes(value)) {
    return "deploy";
  }

  if (["rollback", "roll_back", "revert"].includes(value)) {
    return "rollback";
  }

  if (/\b(rollback|rollout undo|revert)\b/i.test(command)) {
    return "rollback";
  }

  return "deploy";
};

const inferService = (command, explicitService) => {
  if (explicitService) {
    return explicitService;
  }

  return (
    /(?:deployment|deploy|service|svc)\/([a-zA-Z0-9_.-]+)/.exec(command)?.[1] ??
    /helm\s+upgrade\s+(?:--install\s+)?([a-zA-Z0-9_.-]+)/.exec(command)?.[1] ??
    /gh\s+workflow\s+run\s+([a-zA-Z0-9_.-]+)/.exec(command)?.[1] ??
    /--service[=\s]+([a-zA-Z0-9_.-]+)/.exec(command)?.[1] ??
    "unknown-service"
  );
};

export const adaptCiCd = ({
  command = "",
  service,
  operation,
  version,
  pipeline,
  stage,
  testStatus,
  environment,
  actor,
  taskPurpose,
}) => {
  const inferredOperation = inferCiCdOperation(command, operation);
  const inferredService = inferService(command, service);
  const payload = {
    operation: inferredOperation,
    service: inferredService,
    pipeline: jsonValue(pipeline, "codex-command"),
    stage: jsonValue(stage, inferredOperation),
    testStatus: jsonValue(testStatus, "unknown"),
    source: "codex",
  };

  if (version) {
    payload.version = version;
  }

  if (command) {
    payload.command = command;
  }

  return buildToolCallRequest({
    actor,
    taskPurpose:
      taskPurpose ??
      `Codex requested ${inferredOperation} for ${inferredService} via safety gateway`,
    toolType: ToolType.CiCd,
    rawPayload: payload,
    environment: normalizeEnvironment(environment, `${command} ${pipeline ?? ""}`),
  });
};

const inferConfigPayload = (command, explicit = {}) => {
  const service =
    explicit.service ??
    /(?:service|app|application)[=\s:]+([a-zA-Z0-9_.-]+)/i.exec(command)?.[1] ??
    /\/services\/([a-zA-Z0-9_.-]+)\//i.exec(command)?.[1] ??
    "unknown-service";
  const key =
    explicit.key ??
    /(?:key|name|configKey)[=\s:]+([a-zA-Z0-9_.-]+)/i.exec(command)?.[1] ??
    "unknown.key";
  const value =
    explicit.value ??
    /(?:value|configValue|newValue)[=\s:]+([^\s]+)/i.exec(command)?.[1] ??
    "unknown";

  return { service, key, value };
};

export const adaptConfig = ({
  command = "",
  service,
  key,
  value,
  previousValue,
  operation = "update",
  environment,
  actor,
  taskPurpose,
}) => {
  const inferred = inferConfigPayload(command, { service, key, value });
  const payload = {
    operation,
    service: inferred.service,
    key: inferred.key,
    value: inferred.value,
    source: "codex",
  };

  if (previousValue !== undefined) {
    payload.previousValue = previousValue;
  }

  if (command) {
    payload.command = command;
  }

  return buildToolCallRequest({
    actor,
    taskPurpose:
      taskPurpose ??
      `Codex requested config update for ${inferred.service}.${inferred.key} via safety gateway`,
    toolType: ToolType.Config,
    rawPayload: payload,
    environment: normalizeEnvironment(environment, command),
  });
};

const commandLooksLikeSql = (command) =>
  /\b(psql|mysql|mariadb|sqlcmd|sqlite3)\b/i.test(command) ||
  [...knownSqlKeywords].some((keyword) => new RegExp(`^\\s*${keyword}\\b`, "i").test(command));

const commandLooksLikeCiCd = (command) =>
  /\b(kubectl|helm|terraform|gh\s+workflow|argo|flux|spinnaker)\b/i.test(command) &&
  /\b(apply|delete|scale|rollout|upgrade|install|workflow\s+run|deploy|release|rollback|destroy)\b/i.test(
    command,
  );

const commandLooksLikeConfig = (command) =>
  /\b(config|settings|feature-flag|feature_flag|consul|etcd|vault)\b/i.test(command) &&
  /\b(set|put|write|update|patch|curl)\b/i.test(command);

export const adaptBashCommand = ({ command, cwd, actor = "agent:codex" }) => {
  if (!command || typeof command !== "string") {
    return null;
  }

  if (commandLooksLikeSql(command)) {
    const sql = extractSqlFromCommand(command);

    if (!sql) {
      return {
        kind: "unparsed_sql",
        localBlockReason:
          "Codex attempted to run a SQL client command, but the SQL text could not be extracted safely.",
      };
    }

    return {
      kind: "tool_call",
      request: adaptSql({
        sql,
        database: inferDatabase(command),
        command,
        actor,
        taskPurpose: `Codex Bash SQL command from ${cwd ?? "unknown cwd"}`,
      }),
      unsupportedDestructiveSql: isUnsupportedDestructiveSql(sql),
    };
  }

  if (commandLooksLikeCiCd(command)) {
    return {
      kind: "tool_call",
      request: adaptCiCd({
        command,
        actor,
        taskPurpose: `Codex Bash deployment command from ${cwd ?? "unknown cwd"}`,
      }),
    };
  }

  if (commandLooksLikeConfig(command)) {
    return {
      kind: "tool_call",
      request: adaptConfig({
        command,
        actor,
        taskPurpose: `Codex Bash config command from ${cwd ?? "unknown cwd"}`,
      }),
    };
  }

  if (/\brm\s+-rf\s+\/(?:\s|$)|\bmkfs\b|\bdd\s+.*\bof=\/dev\//i.test(command)) {
    return {
      kind: "local_block",
      localBlockReason: "Codex attempted a destructive host command outside the gateway tool domain.",
    };
  }

  return null;
};

export const makeEvidence = (sourceSystem, artifactUris = []) => ({
  environmentName: "codex-local",
  runId: randomUUID(),
  sourceSystem,
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  artifactUris,
});
