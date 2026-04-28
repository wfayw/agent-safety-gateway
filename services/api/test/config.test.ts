import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ApiLogLevel,
  createApiConfig,
  DEFAULT_API_HOST,
  DEFAULT_API_PORT,
  DEFAULT_DATA_DIR,
} from "../src/config.js";

describe("API config", () => {
  it("uses safe defaults when environment variables are missing", () => {
    const config = createApiConfig({});

    assert.equal(config.host, DEFAULT_API_HOST);
    assert.equal(config.port, DEFAULT_API_PORT);
    assert.equal(config.port, 4310);
    assert.equal(config.dataDir, DEFAULT_DATA_DIR);
    assert.equal(config.logLevel, ApiLogLevel.Info);
  });

  it("reads port, data directory, and log level from environment", () => {
    const config = createApiConfig({
      API_PORT: "4311",
      API_DATA_DIR: "./tmp/api-data",
      API_LOG_LEVEL: "debug",
    });

    assert.equal(config.port, 4311);
    assert.match(config.dataDir, /tmp\/api-data$/);
    assert.equal(config.logLevel, ApiLogLevel.Debug);
  });

  it("rejects unsafe port and log level values", () => {
    assert.throws(() => createApiConfig({ API_PORT: "70000" }), /Invalid API_PORT/);
    assert.throws(
      () => createApiConfig({ API_LOG_LEVEL: "verbose" }),
      /Invalid API_LOG_LEVEL/,
    );
  });
});
