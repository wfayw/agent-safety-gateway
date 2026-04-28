import {
  OperationType,
  ToolType,
  type ActionTuple,
  type JsonObject,
  type JsonValue,
  type ParseError,
} from "@agent-safety-gateway/shared";

import type { ActionParseResult, ActionParser } from "./action-parser.js";

type ConfigOperation = {
  keyword: string;
  operation: ActionTuple["operation"] | null;
};

const configOperationByKeyword: Record<string, ActionTuple["operation"]> = {
  update: OperationType.Update,
  set: OperationType.Update,
  change: OperationType.Update,
  write: OperationType.Update,
  put: OperationType.Update,
  config_update: OperationType.Update,
};

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

const readString = (payload: JsonObject, field: string) => {
  const value = payload[field];

  return isStringValue(value) ? value.trim() : null;
};

const readConfigValue = (payload: JsonObject): JsonValue | undefined =>
  payload.value ?? payload.configValue ?? payload.newValue;

const getConfigOperation = (rawPayload: JsonObject): ConfigOperation => {
  const keyword =
    readString(rawPayload, "operation") ??
    readString(rawPayload, "action") ??
    readString(rawPayload, "type") ??
    "update";
  const normalizedKeyword = keyword.toLowerCase().replace(/[\s-]+/g, "_");

  return {
    keyword: normalizedKeyword,
    operation: configOperationByKeyword[normalizedKeyword] ?? null,
  };
};

const buildTarget = (service: string, configKey: string) =>
  `${service}.${configKey}`;

const buildParameters = (
  rawPayload: JsonObject,
  operationKeyword: string,
  service: string,
  configKey: string,
  configValue: JsonValue,
  environment: string,
): JsonObject => ({
  ...rawPayload,
  operationKeyword,
  service,
  key: configKey,
  value: configValue,
  environment,
});

export const createConfigActionParser = (): ActionParser => ({
  supports: (request) => request.toolType === ToolType.Config,
  parse(request): ActionParseResult {
    if (request.toolType !== ToolType.Config) {
      return {
        success: false,
        errors: [
          toParseError(
            "unsupported_tool_type",
            "Config action parser only supports config tool calls.",
            "toolType",
            {
              requestId: request.id,
              toolType: request.toolType,
            },
          ),
        ],
      };
    }

    const service = readString(request.rawPayload, "service");

    if (!service) {
      return {
        success: false,
        errors: [
          toParseError(
            "missing_config_service",
            "Config service is required in rawPayload.service.",
            "rawPayload.service",
            {
              requestId: request.id,
              toolType: request.toolType,
            },
          ),
        ],
      };
    }

    const configKey =
      readString(request.rawPayload, "key") ??
      readString(request.rawPayload, "configKey") ??
      readString(request.rawPayload, "name");

    if (!configKey) {
      return {
        success: false,
        errors: [
          toParseError(
            "missing_config_key",
            "Config key is required in rawPayload.key.",
            "rawPayload.key",
            {
              requestId: request.id,
              toolType: request.toolType,
            },
          ),
        ],
      };
    }

    const configValue = readConfigValue(request.rawPayload);

    if (configValue === undefined) {
      return {
        success: false,
        errors: [
          toParseError(
            "missing_config_value",
            "Config value is required in rawPayload.value.",
            "rawPayload.value",
            {
              requestId: request.id,
              toolType: request.toolType,
              key: configKey,
            },
          ),
        ],
      };
    }

    const configOperation = getConfigOperation(request.rawPayload);

    if (!configOperation.operation) {
      return {
        success: false,
        errors: [
          toParseError(
            "unknown_config_operation",
            "Config operation must be update, set, change, write, or put.",
            "rawPayload.operation",
            {
              requestId: request.id,
              operationKeyword: configOperation.keyword,
            },
          ),
        ],
      };
    }

    return {
      success: true,
      actionTuple: {
        actor: request.actor,
        taskPurpose: request.taskPurpose,
        toolType: request.toolType,
        operation: configOperation.operation,
        target: buildTarget(service, configKey),
        parameters: buildParameters(
          request.rawPayload,
          configOperation.keyword,
          service,
          configKey,
          configValue,
          request.environment,
        ),
        environment: request.environment,
        timestamp: request.createdAt,
      },
    };
  },
});
