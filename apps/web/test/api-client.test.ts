import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ToolCallRequest } from '@agent-safety-gateway/shared';

import {
  ApiClientError,
  DEFAULT_API_BASE_URL,
  analyzeToolCall,
  createApiClient,
  getAudit,
  getHealth,
  listAudits,
  listExecutionLogs,
  listHookDecisions,
  listScenarios,
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

  it('posts tool-call analysis requests to the safety gateway endpoint', async () => {
    const request: ToolCallRequest = {
      id: 'req-1',
      actor: 'agent:ralph',
      taskPurpose: 'Verify production delete safety',
      toolType: 'sql',
      rawPayload: {
        sql: 'DELETE FROM orders WHERE status = \'PENDING\'',
      },
      environment: 'production',
      createdAt: '2026-04-28T12:00:00.000Z',
    };
    let receivedUrl = '';
    let receivedInit: RequestInit | undefined;
    const client = createApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: async (url, init) => {
        receivedUrl = String(url);
        receivedInit = init;
        return jsonResponse({ auditId: 'audit-1' });
      },
    });

    const response = await analyzeToolCall(request, client);

    assert.equal(receivedUrl, 'http://api.local/api/tool-calls/analyze');
    assert.equal(receivedInit?.method, 'POST');
    assert.equal(receivedInit?.body, JSON.stringify(request));
    assert.equal(response.auditId, 'audit-1');
  });

  it('lists scenarios and unwraps the API response envelope', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: async (url, init) => {
        assert.equal(String(url), 'http://api.local/api/scenarios');
        assert.equal(init?.method, 'GET');
        return jsonResponse({ scenarios: [{ id: 'sql-delete-orders-production' }] });
      },
    });

    assert.deepEqual(await listScenarios(client), [{ id: 'sql-delete-orders-production' }]);
  });

  it('lists audits with shared-domain filters as query parameters', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: async (url) => {
        assert.equal(
          String(url),
          'http://api.local/api/audits?decision=block&riskLevel=prohibited&toolType=sql&environment=production',
        );
        return jsonResponse({ audits: [{ id: 'audit-1' }] });
      },
    });

    assert.deepEqual(
      await listAudits(
        {
          decision: 'block',
          riskLevel: 'prohibited',
          toolType: 'sql',
          environment: 'production',
        },
        client,
      ),
      [{ id: 'audit-1' }],
    );
  });

  it('gets one audit record with a URL-encoded id', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: async (url) => {
        assert.equal(String(url), 'http://api.local/api/audits/audit%2F1');
        return jsonResponse({ audit: { id: 'audit/1' } });
      },
    });

    assert.deepEqual(await getAudit('audit/1', client), { id: 'audit/1' });
  });

  it('lists execution logs with evidence filters as query parameters', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: async (url, init) => {
        assert.equal(
          String(url),
          'http://api.local/api/execution-logs?requestId=req-1&auditId=audit-1&toolType=sql&decision=allow&environment=production',
        );
        assert.equal(init?.method, 'GET');
        return jsonResponse({ executionLogs: [{ requestId: 'req-1', called: true }] });
      },
    });

    assert.deepEqual(
      await listExecutionLogs(
        {
          requestId: 'req-1',
          auditId: 'audit-1',
          toolType: 'sql',
          decision: 'allow',
          environment: 'production',
        },
        client,
      ),
      [{ requestId: 'req-1', called: true }],
    );
  });

  it('lists hook decisions and serializes boolean filters', async () => {
    const client = createApiClient({
      baseUrl: 'http://api.local',
      fetchImpl: async (url, init) => {
        assert.equal(
          String(url),
          'http://api.local/api/hook-decisions?requestId=req-1&auditId=audit-1&shouldBlock=true&toolName=Bash&environment=production',
        );
        assert.equal(init?.method, 'GET');
        return jsonResponse({ hookDecisions: [{ id: 'hook-1', shouldBlock: true }] });
      },
    });

    assert.deepEqual(
      await listHookDecisions(
        {
          requestId: 'req-1',
          auditId: 'audit-1',
          shouldBlock: true,
          toolName: 'Bash',
          environment: 'production',
        },
        client,
      ),
      [{ id: 'hook-1', shouldBlock: true }],
    );
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
