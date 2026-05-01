import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  DecisionType,
  Environment,
  ManagementPermission,
  ManagementRole,
  ManagementRoleValues,
  RiskLevel,
  ToolCallRequestSchema,
  ToolType,
  hasManagementPermission,
  isManagementRole,
} from "@agent-safety-gateway/shared";

import { ApiLogLevel, createApiConfig, type ApiConfig } from "./config.js";
import {
  CatalogManifestValidationError,
  createCatalogIngestionService,
  type CatalogIngestionService,
} from "./catalog-ingestion-service.js";
import { registerErrorHandlers, sendErrorResponse } from "./errors.js";
import {
  createLocalStorageLayout,
  initializeLocalStorage,
  type LocalStorageLayout,
} from "./storage.js";
import {
  createScenarioRepository,
  type ScenarioRepository,
} from "./scenario-repository.js";
import {
  createAuditRepository,
  type AuditRecordFilters,
  type AuditRepository,
} from "./audit-repository.js";
import {
  createExecutionLogRepository,
  type ExecutionLogFilters,
  type ExecutionLogRepository,
} from "./execution-log-repository.js";
import {
  createHookDecisionRepository,
  type HookDecisionFilters,
  type HookDecisionRepository,
} from "./hook-decision-repository.js";
import {
  createDefaultToolCallAnalysisService,
  ToolCallAnalysisError,
  type ToolCallAnalysisService,
} from "./tool-call-analysis-service.js";
import { createGatewayDiagnostics } from "./diagnostics-service.js";
import type {
  ExternalApprovalAdapter,
  ExternalAuditSinkAdapter,
  SqlDryRunExecutorResult,
} from "./real-component-adapters.js";
import {
  createToolExecutionGuard,
  type GuardedExecutionResult,
  type ToolExecutor,
  type ToolExecutionPermitEvidenceProvider,
} from "./tool-execution-guard.js";

export type ApiLoggerOption = boolean | { level: ApiLogLevel };

export type ApiServerOptions = {
  config?: ApiConfig;
  logger?: ApiLoggerOption;
  localStorageLayout?: LocalStorageLayout;
  auditRepository?: AuditRepository;
  executionLogRepository?: ExecutionLogRepository;
  hookDecisionRepository?: HookDecisionRepository;
  scenarioRepository?: ScenarioRepository;
  catalogIngestionService?: CatalogIngestionService;
  toolCallAnalysisService?: ToolCallAnalysisService;
  sqlExecutor?: ToolExecutor<SqlDryRunExecutorResult>;
  approvalAdapter?: Pick<
    ExternalApprovalAdapter,
    "createApprovalRequest" | "getApprovalRequest"
  > &
    Partial<Pick<ExternalApprovalAdapter, "health">>;
  auditSinkAdapter?: Pick<
    ExternalAuditSinkAdapter,
    "appendControlEvidence" | "health"
  >;
  permitEvidenceProvider?: ToolExecutionPermitEvidenceProvider;
  auditSinkStrict?: boolean;
  defaultApproverGroup?: string;
};

type HookDecisionQuery = Omit<HookDecisionFilters, "shouldBlock"> & {
  shouldBlock?: "true" | "false";
};

type AuthenticatedRolesResult =
  | { ok: true; roles: ManagementRole[] }
  | { ok: false; invalidRoles: string[] };

const allManagementRoles = [...ManagementRoleValues];

const getHeaderValues = (value: string | string[] | undefined): string[] => {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const isHealthRoute = (url: string): boolean => {
  const [pathname] = url.split("?", 1);
  return pathname === "/health";
};

const getBearerToken = (authorizationHeader: string | undefined) => {
  const [scheme, token, ...extraParts] = authorizationHeader?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token || extraParts.length > 0) {
    return null;
  }

  return token;
};

const applyCorsHeaders = (
  reply: FastifyReply,
  config: ApiConfig,
  requestOrigin: string | undefined,
) => {
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  reply.header(
    "Access-Control-Allow-Headers",
    "Authorization,Content-Type,Accept,X-ASG-Roles",
  );

  if (!config.corsOrigin) {
    return;
  }

  if (config.corsOrigin === "*") {
    reply.header("Access-Control-Allow-Origin", "*");
    return;
  }

  if (!requestOrigin || requestOrigin === config.corsOrigin) {
    reply.header("Access-Control-Allow-Origin", config.corsOrigin);
  }
};

const getAuthenticatedRoles = (
  request: FastifyRequest,
  config: ApiConfig,
): AuthenticatedRolesResult => {
  if (!config.apiToken) {
    return { ok: true, roles: allManagementRoles };
  }

  const requestedRoles = getHeaderValues(request.headers["x-asg-roles"])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const uniqueRoles = [...new Set(requestedRoles)];

  if (uniqueRoles.length === 0) {
    return { ok: true, roles: [ManagementRole.Viewer] };
  }

  const invalidRoles = uniqueRoles.filter((role) => !isManagementRole(role));

  if (invalidRoles.length > 0) {
    return { ok: false, invalidRoles };
  }

  return { ok: true, roles: uniqueRoles as ManagementRole[] };
};

const requireManagementPermission = (
  request: FastifyRequest,
  reply: FastifyReply,
  config: ApiConfig,
  permission: ManagementPermission,
) => {
  const authenticatedRoles = getAuthenticatedRoles(request, config);

  if (!authenticatedRoles.ok) {
    return sendErrorResponse(reply, 403, {
      code: "FORBIDDEN",
      message: "Invalid management role",
      details: {
        invalidRoles: authenticatedRoles.invalidRoles,
        allowedRoles: ManagementRoleValues,
      },
    });
  }

  if (hasManagementPermission(authenticatedRoles.roles, permission)) {
    return true;
  }

  return sendErrorResponse(reply, 403, {
    code: "FORBIDDEN",
    message: "Required management permission missing",
    details: {
      requiredPermission: permission,
      roles: authenticatedRoles.roles,
    },
  });
};

const requireApiAuth = (
  request: FastifyRequest,
  reply: FastifyReply,
  config: ApiConfig,
) => {
  if (!config.apiToken || isHealthRoute(request.url)) {
    return true;
  }

  const bearerToken = getBearerToken(request.headers.authorization);

  if (bearerToken === config.apiToken) {
    return true;
  }

  reply.header("WWW-Authenticate", 'Bearer realm="agent-safety-gateway"');
  void sendErrorResponse(reply, 401, {
    code: "UNAUTHORIZED",
    message: "Valid bearer token required",
    details: null,
  });
  return false;
};

const enumValues = <T extends Record<string, string>>(values: T) =>
  Object.values(values);

const createLoggerOption = (config: ApiConfig): ApiLoggerOption => {
  if (config.logLevel === ApiLogLevel.Silent) {
    return false;
  }

  return { level: config.logLevel };
};

const createGuardedExecutionResponse = <ExecutorResult>(
  result: GuardedExecutionResult<ExecutorResult>,
) => ({
  status: result.status,
  requestId: result.requestId,
  auditId: result.auditId,
  riskLevel: result.riskLevel,
  decision: result.decision,
  executorInvoked: result.executorInvoked,
  executorResult: result.executorResult,
  approvalRequest: result.approvalRequest,
  permitBinding: result.permitBinding,
  permitDeniedEvidence: result.permitDeniedEvidence,
  auditSinkResult: result.auditSinkResult,
  analysisResult: result.analysisResult,
});

export const buildServer = (options: ApiServerOptions = {}) => {
  const config = options.config ?? createApiConfig();
  const localStorageLayout =
    options.localStorageLayout ?? createLocalStorageLayout(config.dataDir);
  const toolCallAnalysisService =
    options.toolCallAnalysisService ??
    createDefaultToolCallAnalysisService(localStorageLayout, {
      auditRedaction: config.auditRedaction,
    });
  const scenarioRepository =
    options.scenarioRepository ?? createScenarioRepository(localStorageLayout);
  const auditRepository =
    options.auditRepository ??
    createAuditRepository(localStorageLayout, { redaction: config.auditRedaction });
  const executionLogRepository =
    options.executionLogRepository ?? createExecutionLogRepository(localStorageLayout);
  const hookDecisionRepository =
    options.hookDecisionRepository ?? createHookDecisionRepository(localStorageLayout);
  const catalogIngestionService =
    options.catalogIngestionService ??
    createCatalogIngestionService(localStorageLayout);
  const server = Fastify({
    logger: options.logger ?? createLoggerOption(config),
  });

  server.decorate("apiConfig", config);
  registerErrorHandlers(server);

  server.addHook("onRequest", (request, reply, done) => {
    applyCorsHeaders(reply, config, request.headers.origin);

    if (request.method === "OPTIONS") {
      void reply.code(204).send();
      return;
    }

    if (!requireApiAuth(request, reply, config)) {
      return;
    }

    done();
  });

  server.get(
    "/health",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            format: {
              type: "string",
              enum: ["json"],
            },
          },
        },
      },
    },
    async () => ({
      status: "ok",
    }),
  );

  server.get("/api/scenarios", async () => ({
    scenarios: await scenarioRepository.listScenarios(),
  }));

  server.get(
    "/api/audits",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            decision: {
              type: "string",
              enum: enumValues(DecisionType),
            },
            riskLevel: {
              type: "string",
              enum: enumValues(RiskLevel),
            },
            toolType: {
              type: "string",
              enum: enumValues(ToolType),
            },
            environment: {
              type: "string",
              enum: enumValues(Environment),
            },
          },
        },
      },
    },
    async (request, reply) => {
      const permissionResult = requireManagementPermission(
        request,
        reply,
        config,
        ManagementPermission.ViewAuditEvidence,
      );

      if (permissionResult !== true) {
        return permissionResult;
      }

      return {
        audits: await auditRepository.listAuditRecords(
          request.query as AuditRecordFilters,
        ),
      };
    },
  );

  server.get(
    "/api/audits/:id",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: {
              type: "string",
              minLength: 1,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const permissionResult = requireManagementPermission(
        request,
        reply,
        config,
        ManagementPermission.ViewAuditEvidence,
      );

      if (permissionResult !== true) {
        return permissionResult;
      }

      const { id } = request.params as { id: string };
      const audit = await auditRepository.getAuditRecordById(id);

      if (!audit) {
        return sendErrorResponse(reply, 404, {
          code: "AUDIT_NOT_FOUND",
          message: "Audit record not found",
          details: {
            auditId: id,
          },
        });
      }

      return { audit };
    },
  );

  server.get(
    "/api/execution-logs",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            requestId: {
              type: "string",
              minLength: 1,
            },
            auditId: {
              type: "string",
              minLength: 1,
            },
            toolType: {
              type: "string",
              enum: enumValues(ToolType),
            },
            decision: {
              type: "string",
              enum: enumValues(DecisionType),
            },
            environment: {
              type: "string",
              enum: enumValues(Environment),
            },
          },
        },
      },
    },
    async (request, reply) => {
      const permissionResult = requireManagementPermission(
        request,
        reply,
        config,
        ManagementPermission.ViewAuditEvidence,
      );

      if (permissionResult !== true) {
        return permissionResult;
      }

      return {
        executionLogs: await executionLogRepository.listExecutionLogs(
          request.query as ExecutionLogFilters,
        ),
      };
    },
  );

  server.get(
    "/api/hook-decisions",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            requestId: {
              type: "string",
              minLength: 1,
            },
            auditId: {
              type: "string",
              minLength: 1,
            },
            shouldBlock: {
              type: "string",
              enum: ["true", "false"],
            },
            toolName: {
              type: "string",
              minLength: 1,
            },
            environment: {
              type: "string",
              enum: enumValues(Environment),
            },
          },
        },
      },
    },
    async (request, reply) => {
      const permissionResult = requireManagementPermission(
        request,
        reply,
        config,
        ManagementPermission.ViewAuditEvidence,
      );

      if (permissionResult !== true) {
        return permissionResult;
      }

      const query = request.query as HookDecisionQuery;
      const { shouldBlock, ...rest } = query;
      const filters: HookDecisionFilters = {
        ...rest,
        ...(shouldBlock === undefined
          ? {}
          : { shouldBlock: shouldBlock === "true" }),
      };

      return {
        hookDecisions: await hookDecisionRepository.listHookDecisions(filters),
      };
    },
  );

  server.get("/api/diagnostics", async (request, reply) => {
    const permissionResult = requireManagementPermission(
      request,
      reply,
      config,
      ManagementPermission.ViewAuditEvidence,
    );

    if (permissionResult !== true) {
      return permissionResult;
    }

    return {
      diagnostics: await createGatewayDiagnostics({
        auditRepository,
        executionLogRepository,
        hookDecisionRepository,
        adapters: {
          sqlExecutorConfigured: options.sqlExecutor !== undefined,
          approvalAdapter: options.approvalAdapter ?? null,
          auditSinkAdapter: options.auditSinkAdapter ?? null,
        },
      }),
    };
  });

  server.get(
    "/api/scenarios/:id",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: {
              type: "string",
              minLength: 1,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const scenario = await scenarioRepository.getScenarioById(id);

      if (!scenario) {
        return sendErrorResponse(reply, 404, {
          code: "SCENARIO_NOT_FOUND",
          message: "Scenario not found",
          details: {
            scenarioId: id,
          },
        });
      }

      return { scenario };
    },
  );

  server.post("/api/catalog/ingest", async (request, reply) => {
    const permissionResult = requireManagementPermission(
      request,
      reply,
      config,
      ManagementPermission.ManagePolicies,
    );

    if (permissionResult !== true) {
      return permissionResult;
    }

    try {
      const summary = await catalogIngestionService.ingestManifest(request.body);

      return {
        status: summary.idempotent ? "unchanged" : "ingested",
        summary,
      };
    } catch (error: unknown) {
      if (error instanceof CatalogManifestValidationError) {
        return sendErrorResponse(reply, 400, {
          code: "INVALID_CATALOG_MANIFEST",
          message: "Catalog manifest validation failed",
          details: {
            issues: error.issues,
          },
        });
      }

      throw error;
    }
  });

  server.post("/api/tool-calls/sql/execute", async (request, reply) => {
    const permissionResult = requireManagementPermission(
      request,
      reply,
      config,
      ManagementPermission.ExecuteToolCalls,
    );

    if (permissionResult !== true) {
      return permissionResult;
    }

    const parseResult = ToolCallRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      return sendErrorResponse(reply, 400, {
        code: "INVALID_TOOL_CALL_REQUEST",
        message: "Invalid tool call request",
        details: {
          issues: parseResult.issues,
        },
      });
    }

    if (parseResult.data.toolType !== ToolType.Sql) {
      return sendErrorResponse(reply, 400, {
        code: "UNSUPPORTED_GUARDED_EXECUTION_TOOL",
        message: "Guarded SQL execution only accepts SQL tool calls",
        details: {
          requestId: parseResult.data.id,
          toolType: parseResult.data.toolType,
        },
      });
    }

    try {
      const guard = createToolExecutionGuard<SqlDryRunExecutorResult>({
        analysisService: toolCallAnalysisService,
        ...(options.sqlExecutor ? { executor: options.sqlExecutor } : {}),
        ...(options.approvalAdapter
          ? { approvalAdapter: options.approvalAdapter }
          : {}),
        ...(options.auditSinkAdapter
          ? { auditSinkAdapter: options.auditSinkAdapter }
          : {}),
        ...(options.permitEvidenceProvider
          ? { permitEvidenceProvider: options.permitEvidenceProvider }
          : {}),
        ...(options.auditSinkStrict === undefined
          ? {}
          : { auditSinkStrict: options.auditSinkStrict }),
        auditRedaction: config.auditRedaction,
        ...(options.defaultApproverGroup
          ? { defaultApproverGroup: options.defaultApproverGroup }
          : {}),
      });
      const result = await guard.execute(parseResult.data);

      return createGuardedExecutionResponse(result);
    } catch (error: unknown) {
      if (error instanceof ToolCallAnalysisError) {
        return sendErrorResponse(reply, 400, {
          code: "TOOL_CALL_ANALYSIS_FAILED",
          message: "Tool call analysis failed",
          details: {
            errors: error.errors,
          },
        });
      }

      throw error;
    }
  });

  server.post("/api/tool-calls/analyze", async (request, reply) => {
    const permissionResult = requireManagementPermission(
      request,
      reply,
      config,
      ManagementPermission.AnalyzeToolCalls,
    );

    if (permissionResult !== true) {
      return permissionResult;
    }

    const parseResult = ToolCallRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      return sendErrorResponse(reply, 400, {
        code: "INVALID_TOOL_CALL_REQUEST",
        message: "Invalid tool call request",
        details: {
          issues: parseResult.issues,
        },
      });
    }

    try {
      const result = await toolCallAnalysisService.analyzeToolCall(
        parseResult.data,
      );

      return {
        request: result.request,
        actionTuple: result.actionTuple,
        directResources: result.directResources,
        indirectResources: result.indirectResources,
        impactPaths: result.impactPaths,
        riskFactors: result.riskFactors,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        policyVersion: result.policyVersion,
        policyTrace: result.policyTrace,
        executionDecision: result.executionDecision,
        reasons: result.riskScore.reasons,
        auditId: result.auditRecordId,
      };
    } catch (error: unknown) {
      if (error instanceof ToolCallAnalysisError) {
        return sendErrorResponse(reply, 400, {
          code: "TOOL_CALL_ANALYSIS_FAILED",
          message: "Tool call analysis failed",
          details: {
            errors: error.errors,
          },
        });
      }

      throw error;
    }
  });

  return server;
};

export const startServer = async () => {
  const config = createApiConfig();
  const localStorageLayout = await initializeLocalStorage(config.dataDir);

  const server = buildServer({ config, localStorageLayout });

  await server.listen({ host: config.host, port: config.port });
  return server;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
