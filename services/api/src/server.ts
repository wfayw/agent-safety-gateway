import Fastify from "fastify";

import { ApiLogLevel, createApiConfig, type ApiConfig } from "./config.js";
import { registerErrorHandlers } from "./errors.js";
import { initializeLocalStorage } from "./storage.js";

export type ApiLoggerOption = boolean | { level: ApiLogLevel };

export type ApiServerOptions = {
  config?: ApiConfig;
  logger?: ApiLoggerOption;
};

const createLoggerOption = (config: ApiConfig): ApiLoggerOption => {
  if (config.logLevel === ApiLogLevel.Silent) {
    return false;
  }

  return { level: config.logLevel };
};

export const buildServer = (options: ApiServerOptions = {}) => {
  const config = options.config ?? createApiConfig();
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

  return server;
};

export const startServer = async () => {
  const config = createApiConfig();
  await initializeLocalStorage(config.dataDir);

  const server = buildServer({ config });

  await server.listen({ host: config.host, port: config.port });
  return server;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
