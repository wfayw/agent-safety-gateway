import Fastify from "fastify";
import {
  DecisionType,
  Environment,
  RiskLevel,
  ToolCallRequestSchema,
  ToolType,
} from "@agent-safety-gateway/shared";

import { ApiLogLevel, createApiConfig, type ApiConfig } from "./config.js";
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
  createDefaultToolCallAnalysisService,
  ToolCallAnalysisError,
  type ToolCallAnalysisService,
} from "./tool-call-analysis-service.js";

export type ApiLoggerOption = boolean | { level: ApiLogLevel };

export type ApiServerOptions = {
  config?: ApiConfig;
  logger?: ApiLoggerOption;
  localStorageLayout?: LocalStorageLayout;
  auditRepository?: AuditRepository;
  scenarioRepository?: ScenarioRepository;
  toolCallAnalysisService?: ToolCallAnalysisService;
};

const enumValues = <T extends Record<string, string>>(values: T) =>
  Object.values(values);

const createLoggerOption = (config: ApiConfig): ApiLoggerOption => {
  if (config.logLevel === ApiLogLevel.Silent) {
    return false;
  }

  return { level: config.logLevel };
};

export const buildServer = (options: ApiServerOptions = {}) => {
  const config = options.config ?? createApiConfig();
  const localStorageLayout =
    options.localStorageLayout ?? createLocalStorageLayout(config.dataDir);
  const toolCallAnalysisService =
    options.toolCallAnalysisService ??
    createDefaultToolCallAnalysisService(localStorageLayout);
  const scenarioRepository =
    options.scenarioRepository ?? createScenarioRepository(localStorageLayout);
  const auditRepository =
    options.auditRepository ?? createAuditRepository(localStorageLayout);
  const server = Fastify({
    logger: options.logger ?? createLoggerOption(config),
  });

  server.decorate("apiConfig", config);
  registerErrorHandlers(server);

  server.addHook("onRequest", (request, reply, done) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type,Accept");

    if (request.method === "OPTIONS") {
      void reply.code(204).send();
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
    async (request) => ({
      audits: await auditRepository.listAuditRecords(
        request.query as AuditRecordFilters,
      ),
    }),
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

  server.post("/api/tool-calls/analyze", async (request, reply) => {
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
