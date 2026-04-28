import { resolveApiBaseUrl } from './config';

export type ApiErrorPayload = {
  message: string;
  code: string;
  details: unknown;
};

export type ApiClientErrorOptions = ApiErrorPayload & {
  status: number | null;
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly details: unknown;
  readonly status: number | null;

  constructor(options: ApiClientErrorOptions) {
    super(options.message);
    this.name = 'ApiClientError';
    this.code = options.code;
    this.details = options.details;
    this.status = options.status;
  }

  toPayload(): ApiErrorPayload {
    return {
      message: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

export type ApiClientOptions = {
  baseUrl?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
};

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

export type ApiClient = {
  request: <TResponse>(path: string, options?: ApiRequestOptions) => Promise<TResponse>;
  get: <TResponse>(path: string, options?: ApiRequestOptions) => Promise<TResponse>;
  post: <TResponse>(path: string, body: unknown, options?: ApiRequestOptions) => Promise<TResponse>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isApiErrorPayload = (value: unknown): value is ApiErrorPayload => {
  return (
    isRecord(value) &&
    typeof value.message === 'string' &&
    typeof value.code === 'string' &&
    Object.hasOwn(value, 'details')
  );
};

const createFallbackErrorCode = (status: number | null) => {
  if (status === null) {
    return 'NETWORK_ERROR';
  }

  if (status >= 500) {
    return 'INTERNAL_SERVER_ERROR';
  }

  return 'REQUEST_FAILED';
};

export const normalizeApiError = (
  value: unknown,
  fallbackMessage = 'API request failed',
  status: number | null = null,
): ApiErrorPayload => {
  if (isApiErrorPayload(value)) {
    return {
      message: value.message,
      code: value.code,
      details: value.details,
    };
  }

  if (value instanceof ApiClientError) {
    return value.toPayload();
  }

  if (value instanceof Error) {
    return {
      message: value.message,
      code: createFallbackErrorCode(status),
      details: null,
    };
  }

  return {
    message: fallbackMessage,
    code: createFallbackErrorCode(status),
    details: value ?? null,
  };
};

const joinUrl = (baseUrl: string, path: string) => {
  if (/^https?:\/\//u.test(path)) {
    return path;
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
};

const parseJsonResponse = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const createRequestInit = (options: ApiRequestOptions = {}): RequestInit => {
  const { body, headers, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);

  requestHeaders.set('Accept', 'application/json');

  if (body === undefined) {
    return {
      ...requestOptions,
      headers: requestHeaders,
    };
  }

  requestHeaders.set('Content-Type', 'application/json');

  return {
    ...requestOptions,
    body: JSON.stringify(body),
    headers: requestHeaders,
  };
};

export const createApiClient = (options: ApiClientOptions = {}): ApiClient => {
  const baseUrl = options.baseUrl ?? resolveApiBaseUrl();
  const fetchImpl = options.fetchImpl ?? fetch;

  const request = async <TResponse>(
    path: string,
    requestOptions: ApiRequestOptions = {},
  ): Promise<TResponse> => {
    try {
      const response = await fetchImpl(joinUrl(baseUrl, path), createRequestInit(requestOptions));
      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        const normalizedError = normalizeApiError(payload, response.statusText, response.status);

        throw new ApiClientError({
          ...normalizedError,
          status: response.status,
        });
      }

      return payload as TResponse;
    } catch (error: unknown) {
      if (error instanceof ApiClientError) {
        throw error;
      }

      const normalizedError = normalizeApiError(error, 'Network request failed');

      throw new ApiClientError({
        ...normalizedError,
        status: null,
      });
    }
  };

  return {
    request,
    get: <TResponse>(path: string, requestOptions?: ApiRequestOptions) => {
      return request<TResponse>(path, {
        ...requestOptions,
        method: 'GET',
      });
    },
    post: <TResponse>(path: string, body: unknown, requestOptions?: ApiRequestOptions) => {
      return request<TResponse>(path, {
        ...requestOptions,
        body,
        method: 'POST',
      });
    },
  };
};

export const apiClient = createApiClient();
