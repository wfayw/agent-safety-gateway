import {
  OperationType,
  ToolType,
  type ActionTuple,
  type JsonObject,
  type JsonValue,
  type ParseError,
} from "@agent-safety-gateway/shared";

import type { ActionParseResult, ActionParser } from "./action-parser.js";

type CiCdOperation = {
  keyword: string;
  operation: ActionTuple["operation"] | null;
};

const cicdOperationByKeyword: Record<string, ActionTuple["operation"]> = {
  deploy: OperationType.Deploy,
  deployment: OperationType.Deploy,
  release: OperationType.Deploy,
  rollback: OperationType.Rollback,
  roll_back: OperationType.Rollback,
  revert: OperationType.Rollback,
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

const getCiCdOperation = (rawPayload: JsonObject): CiCdOperation => {
  const keyword =
    readString(rawPayload, "operation") ??
    readString(rawPayload, "stage") ??
    readString(rawPayload, "action") ??
    "unknown";
  const normalizedKeyword = keyword.toLowerCase().replace(/[\s-]+/g, "_");

  return {
    keyword: normalizedKeyword,
    operation: cicdOperationByKeyword[normalizedKeyword] ?? null,
  };
};

const getDeployVersion = (rawPayload: JsonObject) =>
  readString(rawPayload, "version") ??
  readString(rawPayload, "targetVersion") ??
  readString(rawPayload, "toVersion");

const buildParameters = (
  rawPayload: JsonObject,
  operationKeyword: string,
  service: string,
  pipeline: string | null,
  stage: string | null,
  testStatus: string | null,
  version: string | null,
): JsonObject => {
  const parameters: JsonObject = {
    ...rawPayload,
    operationKeyword,
    service,
  };

  if (pipeline) {
    parameters.pipeline = pipeline;
  }

  if (stage) {
    parameters.stage = stage;
  }

  if (testStatus) {
    parameters.testStatus = testStatus;
  }

  if (version) {
    parameters.version = version;
  }

  return parameters;
};

export const createCiCdActionParser = (): ActionParser => ({
  supports: (request) => request.toolType === ToolType.CiCd,
  parse(request): ActionParseResult {
    if (request.toolType !== ToolType.CiCd) {
      return {
        success: false,
        errors: [
          toParseError(
            "unsupported_tool_type",
            "CI/CD action parser only supports CI/CD tool calls.",
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
            "missing_cicd_service",
            "CI/CD service is required in rawPayload.service.",
            "rawPayload.service",
            {
              requestId: request.id,
              toolType: request.toolType,
            },
          ),
        ],
      };
    }

    const cicdOperation = getCiCdOperation(request.rawPayload);

    if (!cicdOperation.operation) {
      return {
        success: false,
        errors: [
          toParseError(
            "unknown_cicd_operation",
            "CI/CD operation must be deploy or rollback.",
            "rawPayload.stage",
            {
              requestId: request.id,
              operationKeyword: cicdOperation.keyword,
            },
          ),
        ],
      };
    }

    const pipeline = readString(request.rawPayload, "pipeline");
    const stage = readString(request.rawPayload, "stage");
    const testStatus = readString(request.rawPayload, "testStatus");
    const version = getDeployVersion(request.rawPayload);

    return {
      success: true,
      actionTuple: {
        actor: request.actor,
        taskPurpose: request.taskPurpose,
        toolType: request.toolType,
        operation: cicdOperation.operation,
        target: service,
        parameters: buildParameters(
          request.rawPayload,
          cicdOperation.keyword,
          service,
          pipeline,
          stage,
          testStatus,
          version,
        ),
        environment: request.environment,
        timestamp: request.createdAt,
      },
    };
  },
});
