type RequestLike = { method?: string; body?: Record<string, unknown>; headers?: Record<string, string | string[] | undefined> };
type ResponseLike = { setHeader(name: string, value: string): void; status(code: number): ResponseLike; json(payload: Record<string, unknown>): unknown };

export async function proxyFiscal(req: RequestLike, res: ResponseLike, targetPath: string, options: { method?: 'GET' | 'POST' } = {}) {
  const json = (status: number, payload: Record<string, unknown>) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); return res.status(status).json(payload); };
  const startedAt = Date.now();
  const certificateBase64 = typeof req.body?.certificateBase64 === 'string' ? req.body.certificateBase64 : '';
  const requestDiagnostic = {
    targetPath,
    method: options.method || 'POST',
    mimeType: typeof req.body?.mimeType === 'string' ? req.body.mimeType : undefined,
    certificatePayloadPresent: Boolean(certificateBase64),
    estimatedCertificateBytes: certificateBase64 ? Math.max(0, Math.floor((certificateBase64.split(',', 2).pop()?.length || 0) * 3 / 4)) : 0,
    passwordPresent: typeof req.body?.password === 'string' && req.body.password.length > 0,
  };
  try {
    const method = options.method || 'POST';
    if (req.method !== method) { res.setHeader('Allow', method); return json(405, { success: false, code: 'METHOD_NOT_ALLOWED', error: 'Método não permitido.' }); }
    const serviceUrl = process.env.FISCAL_SERVICE_URL?.trim();
    const secret = process.env.FISCAL_SERVICE_INTERNAL_SECRET?.trim();
    if (!serviceUrl || !secret) return json(503, { success: false, code: 'FISCAL_SERVICE_NOT_CONFIGURED', error: 'Serviço fiscal isolado ainda não configurado.' });
    const authorizationHeader = req.headers?.authorization;
    const authorization = Array.isArray(authorizationHeader) ? authorizationHeader[0] : String(authorizationHeader || '');
    if (!authorization.startsWith('Bearer ')) return json(401, { success: false, code: 'FIREBASE_TOKEN_REQUIRED', error: 'Autenticação Firebase obrigatória.' });
    const base = new URL(serviceUrl); if (base.protocol !== 'https:' && base.hostname !== '127.0.0.1' && base.hostname !== 'localhost') throw new Error('URL fiscal insegura.');
    const upstream = await fetch(new URL(targetPath, base), { method, headers: { Authorization: authorization, 'X-Internal-Secret': secret, 'Content-Type': 'application/json', Accept: 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify(req.body || {}) } : {}) });
    const text = await upstream.text();
    console.info('[Fiscal Proxy Request]', { ...requestDiagnostic, status: upstream.status, elapsedMs: Date.now() - startedAt });
    try { return json(upstream.status, JSON.parse(text)); } catch { return json(502, { success: false, code: 'INVALID_FISCAL_RESPONSE', error: 'Serviço fiscal retornou resposta inválida.' }); }
  } catch (error) {
    console.error('[Fiscal Proxy]', { ...requestDiagnostic, elapsedMs: Date.now() - startedAt, message: error instanceof Error ? error.message : 'unknown' });
    return json(500, { success: false, code: 'FISCAL_PROXY_ERROR', error: 'Falha interna ao acessar o serviço fiscal.' });
  }
}
