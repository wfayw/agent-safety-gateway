import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API_SOURCE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(API_SOURCE_DIR, "../../..");

export const DEFAULT_API_HOST = "127.0.0.1";
export const DEFAULT_API_PORT = 4310;
export const DEFAULT_DATA_DIR = resolve(DEFAULT_REPO_ROOT, ".data");
export const DEFAULT_OPEN_CORS_ORIGIN = "*";

export const ApiLogLevel = {
  Fatal: "fatal",
  Error: "error",
  Warn: "warn",
  Info: "info",
  Debug: "debug",
  Trace: "trace",
  Silent: "silent",
} as const;

export type ApiLogLevel = (typeof ApiLogLevel)[keyof typeof ApiLogLevel];

export type ApiConfig = {
  host: string;
  port: number;
  dataDir: string;
  logLevel: ApiLogLevel;
  apiToken: string | null;
  corsOrigin: string | null;
};

export type ApiConfigEnv = {
  API_HOST?: string | undefined;
  API_PORT?: string | undefined;
  API_DATA_DIR?: string | undefined;
  API_LOG_LEVEL?: string | undefined;
  ASG_API_TOKEN?: string | undefined;
  ASG_CORS_ORIGIN?: string | undefined;
};

const apiLogLevels = new Set<string>(Object.values(ApiLogLevel));

const parseApiPort = (value: string | undefined): number => {
  if (!value) {
    return DEFAULT_API_PORT;
  }

  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid API_PORT: ${value}`);
  }

  return port;
};

const parseApiLogLevel = (value: string | undefined): ApiLogLevel => {
  if (!value) {
    return ApiLogLevel.Info;
  }

  if (!apiLogLevels.has(value)) {
    throw new Error(`Invalid API_LOG_LEVEL: ${value}`);
  }

  return value as ApiLogLevel;
};

const parseOptionalSecret = (value: string | undefined): string | null => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
};

const parseCorsOrigin = (
  value: string | undefined,
  apiToken: string | null,
): string | null => {
  const trimmedValue = value?.trim();

  if (trimmedValue) {
    return trimmedValue;
  }

  return apiToken ? null : DEFAULT_OPEN_CORS_ORIGIN;
};

export const createApiConfig = (
  env: ApiConfigEnv = process.env,
): ApiConfig => {
  const apiToken = parseOptionalSecret(env.ASG_API_TOKEN);

  return {
    host: env.API_HOST || DEFAULT_API_HOST,
    port: parseApiPort(env.API_PORT),
    dataDir: env.API_DATA_DIR ? resolve(env.API_DATA_DIR) : DEFAULT_DATA_DIR,
    logLevel: parseApiLogLevel(env.API_LOG_LEVEL),
    apiToken,
    corsOrigin: parseCorsOrigin(env.ASG_CORS_ORIGIN, apiToken),
  };
};
