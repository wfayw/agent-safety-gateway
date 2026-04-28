import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ApiClientError,
  DEFAULT_API_BASE_URL,
  createApiClient,
  getHealth,
  normalizeApiError,
  resolveApiBaseUrl,
} from '../src/api';

const jsonResponse = (body: unknown, init?: ResponseInit) => {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
};

describe('web API client configuration', () => {
  it('uses the default API base URL when no Vite environment value is set', () => {
    assert.equal(resolveApiBaseUrl({}), DEFAULT_API_BASE_URL);
  });

  it('uses VITE_API_BASE_URL and trims trailing slashes', () => {
    assert.equal(
      resolveApiBaseUrl({ VITE_API_BASE_URL: ' http://127.0.0.1:4311/// ' }),
      'http://127.0.0.1:4311',
    );
  });
});

describe('web API client requests', () => {
  it('calls the health endpoint and parses JSON responses', async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const client = createApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return jsonResponse({ status: 'ok' });
      },
    });

    assert.deepEqual(await getHealth(client), { status: 'ok' });
    assert.equal(requests[0]?.url, 'http://api.local/health');
    assert.equal(requests[0]?.init?.method, 'GET');
  });

  it('serializes JSON request bodies and keeps Accept headers consistent', async () => {
    let receivedInit: RequestInit | undefined;
    const client = createApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: async (_url, init) => {
        receivedInit = init;
        return jsonResponse({ ok: true });
      },
    });

    await client.post('/api/tool-calls/analyze', { id: 'req-1' });

    const headers = receivedInit?.headers as Headers;
    assert.equal(headers.get('Accept'), 'application/json');
    assert.equal(headers.get('Content-Type'), 'application/json');
    assert.equal(receivedInit?.body, JSON.stringify({ id: 'req-1' }));
  });

  it('normalizes API error responses to message, code, and details', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: async () => {
        return jsonResponse(
          {
            message: 'Invalid request',
            code: 'INVALID_REQUEST',
            details: { field: 'toolType' },
          },
          { status: 400, statusText: 'Bad Request' },
        );
      },
    });

    await assert.rejects(
      () => client.get('/api/scenarios'),
      (error: unknown) => {
        assert.ok(error instanceof ApiClientError);
        assert.equal(error.message, 'Invalid request');
        assert.equal(error.code, 'INVALID_REQUEST');
        assert.deepEqual(error.details, { field: 'toolType' });
        assert.equal(error.status, 400);
        assert.deepEqual(error.toPayload(), {
          message: 'Invalid request',
          code: 'INVALID_REQUEST',
          details: { field: 'toolType' },
        });
        return true;
      },
    );
  });

  it('normalizes thrown network failures', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    });

    await assert.rejects(
      () => client.get('/health'),
      (error: unknown) => {
        assert.ok(error instanceof ApiClientError);
        assert.equal(error.message, 'fetch failed');
        assert.equal(error.code, 'NETWORK_ERROR');
        assert.equal(error.details, null);
        assert.equal(error.status, null);
        return true;
      },
    );
  });
});

describe('normalizeApiError', () => {
  it('keeps unknown details while providing a fallback code and message', () => {
    assert.deepEqual(normalizeApiError({ reason: 'plain object' }, 'Request failed', 503), {
      message: 'Request failed',
      code: 'INTERNAL_SERVER_ERROR',
      details: { reason: 'plain object' },
    });
  });
});
