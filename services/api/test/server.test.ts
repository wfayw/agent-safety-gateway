import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { createApiConfig } from "../src/config.js";
import { buildServer } from "../src/server.js";

const servers: FastifyInstance[] = [];

const createTestServer = () => {
  const server = buildServer({
    config: createApiConfig({ API_LOG_LEVEL: "silent" }),
    logger: false,
  });

  servers.push(server);
  return server;
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("API server", () => {
  it("returns the health status", async () => {
    const server = createTestServer();

    const response = await server.inject({ method: "GET", url: "/health" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
  });

  it("returns the unified error format for invalid requests", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/health?format=xml",
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.headers["content-type"]?.includes("application/json"), true);
    assert.equal(response.json().code, "INVALID_REQUEST");
    assert.equal(response.json().message, "Invalid request");
    assert.ok(response.json().details.validation.length > 0);
  });

  it("returns the unified error format for missing routes", async () => {
    const server = createTestServer();

    const response = await server.inject({ method: "GET", url: "/missing" });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      code: "NOT_FOUND",
      message: "Route not found",
      details: {
        method: "GET",
        url: "/missing",
      },
    });
  });
});
