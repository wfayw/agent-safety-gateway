export const defaultGatewayUrl =
  process.env.ASG_GATEWAY_URL ?? "http://127.0.0.1:4310";

const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

export class GatewayUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "GatewayUnavailableError";
    this.cause = cause;
  }
}

export const callGateway = async (path, body, options = {}) => {
  const gatewayUrl = trimTrailingSlash(options.gatewayUrl ?? defaultGatewayUrl);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? Number(process.env.ASG_GATEWAY_TIMEOUT_MS ?? 5000),
  );

  try {
    const response = await fetch(`${gatewayUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const message =
        payload?.error?.message ??
        payload?.message ??
        `Gateway request failed with HTTP ${response.status}`;
      const error = new Error(message);

      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new GatewayUnavailableError("agent-safety-gateway API timed out.", error);
    }

    if (error.status) {
      throw error;
    }

    throw new GatewayUnavailableError(
      `agent-safety-gateway API is unavailable at ${gatewayUrl}.`,
      error,
    );
  } finally {
    clearTimeout(timeout);
  }
};

export const analyzeToolCall = (request, options) =>
  callGateway("/api/tool-calls/analyze", request, options);

export const checkGatewayHealth = (options) => callGateway("/health", undefined, options);
