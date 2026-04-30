import {
  OperationType,
  ToolType,
  type ActionTuple,
  type JsonObject,
  type JsonValue,
  type ParseError,
  type ToolCallRequest,
} from "@agent-safety-gateway/shared";

import type { ActionParseResult, ActionParser } from "./action-parser.js";

type SqlOperation = {
  keyword: string;
  operation: ActionTuple["operation"] | null;
};

const sqlOperationByKeyword: Record<string, ActionTuple["operation"]> = {
  select: OperationType.Read,
  insert: OperationType.Create,
  update: OperationType.Update,
  delete: OperationType.Delete,
  drop: OperationType.Delete,
  truncate: OperationType.Delete,
  alter: OperationType.Update,
};

const destructiveDdlKeywords = new Set(["alter", "drop", "truncate"]);

const unknownDestructiveKeywords = new Set([
  "create",
  "grant",
  "merge",
  "rename",
  "replace",
  "revoke",
]);

const toParseError = (
  code: string,
  message: string,
  field: string,
  details: JsonObject,
): ParseError => ({
  code,
  message,
  field,
  details,
});

const isStringValue = (value: JsonValue | undefined): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeSql = (sql: string) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();

const getSqlOperation = (sql: string): SqlOperation => {
  const keyword = sql.match(/^([a-zA-Z]+)/)?.[1]?.toLowerCase() ?? "unknown";

  return {
    keyword,
    operation: sqlOperationByKeyword[keyword] ?? null,
  };
};

const normalizeIdentifier = (identifier: string) => {
  const cleanedIdentifier = identifier
    .trim()
    .replace(/^[`"\[]/, "")
    .replace(/[`"\]]$/, "");
  const segments = cleanedIdentifier.split(".").filter(Boolean);

  return segments.at(-1) ?? cleanedIdentifier;
};

const matchTargetTable = (sql: string, keyword: string): string | null => {
  const patterns: Record<string, RegExp> = {
    select: /\bfrom\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/i,
    insert: /\binsert\s+into\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/i,
    update: /\bupdate\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/i,
    delete: /\bdelete\s+from\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/i,
    drop: /\bdrop\s+table(?:\s+if\s+exists)?\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/i,
    truncate: /\btruncate(?:\s+table)?\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/i,
    alter: /\balter\s+table(?:\s+if\s+exists)?\s+([`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?)/i,
  };
  const targetTable = patterns[keyword]?.exec(sql)?.[1];

  return targetTable ? normalizeIdentifier(targetTable) : null;
};

const splitSqlList = (value: string) =>
  value
    .split(",")
    .map((entry) => normalizeIdentifier(entry.trim().replace(/\s+as\s+.+$/i, "")))
    .filter((entry) => entry.length > 0);

const matchSelectedFields = (sql: string) => {
  const fieldsMatch = /^select\s+(.+?)\s+from\s+/i.exec(sql);

  if (!fieldsMatch?.[1]) {
    return [];
  }

  return splitSqlList(fieldsMatch[1]);
};

const matchInsertedFields = (sql: string) => {
  const fieldsMatch = /\binsert\s+into\s+[`"\[]?[a-zA-Z_][\w$.-]*[`"\]]?\s*\(([^)]+)\)/i.exec(
    sql,
  );

  if (!fieldsMatch?.[1]) {
    return [];
  }

  return splitSqlList(fieldsMatch[1]);
};

const matchUpdatedFields = (sql: string) => {
  const setMatch = /\bset\s+(.+?)(?:\s+where\s+|\s+returning\s+|$)/i.exec(sql);

  if (!setMatch?.[1]) {
    return [];
  }

  return setMatch[1]
    .split(",")
    .map((assignment) => normalizeIdentifier(assignment.split("=")[0]?.trim() ?? ""))
    .filter((entry) => entry.length > 0);
};

const matchFields = (sql: string, keyword: string) => {
  if (keyword === "select") {
    return matchSelectedFields(sql);
  }

  if (keyword === "insert") {
    return matchInsertedFields(sql);
  }

  if (keyword === "update") {
    return matchUpdatedFields(sql);
  }

  return [];
};

const matchFilter = (sql: string) => {
  const filterMatch = /\bwhere\s+(.+?)(?:\s+group\s+by\s+|\s+order\s+by\s+|\s+limit\s+|\s+returning\s+|$)/i.exec(
    sql,
  );

  return filterMatch?.[1]?.trim() ?? null;
};

const getConnectionEnvironment = (rawPayload: JsonObject) => {
  const value =
    rawPayload.connectionEnvironment ?? rawPayload.database ?? rawPayload.connection;

  return isStringValue(value) ? value.trim() : null;
};

const getSqlOperationClass = (operationKeyword: string, filter: string | null) => {
  if (operationKeyword === "select") {
    return "read";
  }

  if (operationKeyword === "insert" || operationKeyword === "update") {
    return "mutable_dml";
  }

  if (operationKeyword === "delete") {
    return filter ? "destructive_dml" : "broad_table_delete";
  }

  if (destructiveDdlKeywords.has(operationKeyword)) {
    return "destructive_ddl";
  }

  if (unknownDestructiveKeywords.has(operationKeyword)) {
    return "unknown_destructive";
  }

  return "unknown";
};

const buildParameters = (
  rawPayload: JsonObject,
  operationKeyword: string,
  target: string,
  fields: readonly string[],
  filter: string | null,
  connectionEnvironment: string | null,
): JsonObject => {
  const parameters: JsonObject = {
    ...rawPayload,
    operationKeyword,
    sqlOperationClass: getSqlOperationClass(operationKeyword, filter),
    table: target,
  };

  if (operationKeyword === "delete" && !filter) {
    parameters.broadTableDelete = true;
  }

  if (fields.length > 0) {
    parameters.fields = [...fields];
  }

  if (filter) {
    parameters.filter = filter;
  }

  if (connectionEnvironment) {
    parameters.connectionEnvironment = connectionEnvironment;
  }

  return parameters;
};

export const createSqlActionParser = (): ActionParser => ({
  supports: (request) => request.toolType === ToolType.Sql,
  parse(request): ActionParseResult {
    if (request.toolType !== ToolType.Sql) {
      return {
        success: false,
        errors: [
          toParseError(
            "unsupported_tool_type",
            "SQL action parser only supports SQL tool calls.",
            "toolType",
            {
              requestId: request.id,
              toolType: request.toolType,
            },
          ),
        ],
      };
    }

    const rawSql = request.rawPayload.sql;

    if (!isStringValue(rawSql)) {
      return {
        success: false,
        errors: [
          toParseError(
            "missing_sql",
            "SQL text is required in rawPayload.sql.",
            "rawPayload.sql",
            {
              requestId: request.id,
              toolType: request.toolType,
            },
          ),
        ],
      };
    }

    const sql = normalizeSql(rawSql);
    const sqlOperation = getSqlOperation(sql);

    if (!sqlOperation.operation) {
      return {
        success: false,
        errors: [
          toParseError(
            "unknown_sql_operation",
            "SQL operation must be SELECT, INSERT, UPDATE, DELETE, DROP TABLE, TRUNCATE TABLE, or ALTER TABLE.",
            "rawPayload.sql",
            {
              requestId: request.id,
              operationKeyword: sqlOperation.keyword,
              sqlOperationClass: getSqlOperationClass(sqlOperation.keyword, null),
              failClosed: true,
            },
          ),
        ],
      };
    }

    const filter = matchFilter(sql);
    const target = matchTargetTable(sql, sqlOperation.keyword);

    if (!target) {
      return {
        success: false,
        errors: [
          toParseError(
            "missing_sql_target",
            "SQL target table could not be extracted.",
            "rawPayload.sql",
            {
              requestId: request.id,
              operationKeyword: sqlOperation.keyword,
              sqlOperationClass: getSqlOperationClass(sqlOperation.keyword, filter),
              failClosed: true,
            },
          ),
        ],
      };
    }

    const fields = matchFields(sql, sqlOperation.keyword);
    const connectionEnvironment = getConnectionEnvironment(request.rawPayload);

    return {
      success: true,
      actionTuple: {
        actor: request.actor,
        taskPurpose: request.taskPurpose,
        toolType: request.toolType,
        operation: sqlOperation.operation,
        target,
        parameters: buildParameters(
          request.rawPayload,
          sqlOperation.keyword,
          target,
          fields,
          filter,
          connectionEnvironment,
        ),
        environment: request.environment,
        timestamp: request.createdAt,
      },
    };
  },
});
