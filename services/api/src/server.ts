import Fastify from "fastify";

import { ApiLogLevel, createApiConfig, type ApiConfig } from "./config.js";

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

  server.get("/health", async () => ({
    status: "ok",
    service: "agent-safety-gateway-api",
  }));

  return server;
};

export const startServer = async () => {
  const config = createApiConfig();
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
