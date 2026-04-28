import Fastify from "fastify";
import { ToolCallRequestSchema } from "@agent-safety-gateway/shared";

import { ApiLogLevel, createApiConfig, type ApiConfig } from "./config.js";
import { registerErrorHandlers, sendErrorResponse } from "./errors.js";
import {
  createLocalStorageLayout,
  initializeLocalStorage,
  type LocalStorageLayout,
} from "./storage.js";
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
  toolCallAnalysisService?: ToolCallAnalysisService;
};

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
  const server = Fastify({
    logger: options.logger ?? createLoggerOption(config),
  });

  server.decorate("apiConfig", config);
  registerErrorHandlers(server);

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
