import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../../../api/fiscal/nfse-cancellation-execute';

test('physical cancellation endpoint forwards the manual click to the fiscal execute route without contacting SEFIN', async () => {
  const accessKey = '41069022256096046000100000000000000426083228135542';
  const originalFetch = globalThis.fetch;
  const previousUrl = process.env.FISCAL_SERVICE_URL;
  const previousSecret = process.env.FISCAL_SERVICE_INTERNAL_SECRET;
  process.env.FISCAL_SERVICE_URL = 'http://127.0.0.1:3002';
  process.env.FISCAL_SERVICE_INTERNAL_SECRET = 'local-test-secret';
  let captured: { url?: string; init?: RequestInit } = {};
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    captured = { url: String(input), init };
    return new Response(JSON.stringify({ success: true, data: { status: 'CANCELADA' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  let statusCode = 200; let payload: any = null;
  const response = { setHeader() {}, status(code: number) { statusCode = code; return this; }, json(value: any) { payload = value; return value; } };
  try {
    await handler({ method: 'POST', headers: { authorization: 'Bearer local-test-token' }, body: { accessKey, reasonCode: '2', reason: 'Serviço não prestado conforme solicitado.' } }, response);
    assert.equal(captured.url, `http://127.0.0.1:3002/api/fiscal/nfse/authorized/${accessKey}/cancellation/execute`);
    assert.equal(captured.init?.method, 'POST');
    assert.equal(JSON.parse(String(captured.init?.body)).accessKey, undefined);
    assert.equal(statusCode, 200);
    assert.equal(payload.success, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.FISCAL_SERVICE_URL; else process.env.FISCAL_SERVICE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.FISCAL_SERVICE_INTERNAL_SECRET; else process.env.FISCAL_SERVICE_INTERNAL_SECRET = previousSecret;
  }
});
