import Fastify from "fastify";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4310;

export type ApiServerOptions = {
  logger?: boolean;
};

export const buildServer = (options: ApiServerOptions = {}) => {
  const server = Fastify({
    logger: options.logger ?? true,
  });

  server.get("/health", async () => ({
    status: "ok",
    service: "agent-safety-gateway-api",
  }));

  return server;
};

const parsePort = (value: string | undefined): number => {
  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid API_PORT: ${value}`);
  }

  return port;
};

export const startServer = async () => {
  const server = buildServer();
  const host = process.env.API_HOST ?? DEFAULT_HOST;
  const port = parsePort(process.env.API_PORT);

  await server.listen({ host, port });
  return server;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
