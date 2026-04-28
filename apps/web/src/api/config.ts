export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:4310';
export const API_BASE_URL_ENV_KEY = 'VITE_API_BASE_URL';

export type ApiBaseUrlEnv = {
  VITE_API_BASE_URL?: string | undefined;
};

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

const getViteEnv = (): ApiBaseUrlEnv => {
  return (import.meta.env ?? {}) as ApiBaseUrlEnv;
};

export const resolveApiBaseUrl = (env: ApiBaseUrlEnv = getViteEnv()) => {
  const configuredBaseUrl = env.VITE_API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    return DEFAULT_API_BASE_URL;
  }

  return trimTrailingSlashes(configuredBaseUrl);
};
