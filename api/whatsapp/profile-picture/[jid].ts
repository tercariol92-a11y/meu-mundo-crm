type RequestLike = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
  status(code: number): ResponseLike;
  json(payload: Record<string, unknown>): unknown;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  const json = (status: number, payload: Record<string, unknown>) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(status).json(payload);
  };
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return json(405, { success: false, code: 'METHOD_NOT_ALLOWED', error: 'Método não permitido.' });
    }
    const serviceUrl = process.env.WHATSAPP_SERVICE_URL?.trim();
    const internalSecret = process.env.WHATSAPP_INTERNAL_SECRET?.trim();
    if (!serviceUrl) return json(503, { success: false, code: 'WHATSAPP_SERVICE_NOT_CONFIGURED', error: 'O serviço persistente do WhatsApp ainda não está configurado.' });
    if (!internalSecret) return json(503, { success: false, code: 'WHATSAPP_INTERNAL_SECRET_NOT_CONFIGURED', error: 'O segredo interno do serviço WhatsApp ainda não está configurado.' });
    const authorizationHeader = req.headers?.authorization;
    const authorization = Array.isArray(authorizationHeader) ? authorizationHeader[0] : String(authorizationHeader || '');
    if (!authorization.startsWith('Bearer ')) return json(401, { success: false, code: 'FIREBASE_TOKEN_REQUIRED', error: 'Token Firebase obrigatório.' });
    const rawJid = Array.isArray(req.query?.jid) ? req.query?.jid[0] : req.query?.jid;
    if (!rawJid) return json(400, { success: false, code: 'INVALID_PROFILE_JID', error: 'JID obrigatório.' });
    const baseUrl = new URL(serviceUrl);
    const target = new URL(`/api/whatsapp/profile-picture/${encodeURIComponent(rawJid)}`, baseUrl.toString());
    const refresh = Array.isArray(req.query?.refresh) ? req.query?.refresh[0] : req.query?.refresh;
    if (refresh === 'true') target.searchParams.set('refresh', 'true');
    const sessionId = Array.isArray(req.query?.sessionId) ? req.query?.sessionId[0] : req.query?.sessionId;
    const contactId = Array.isArray(req.query?.contactId) ? req.query?.contactId[0] : req.query?.contactId;
    if (sessionId) target.searchParams.set('sessionId', sessionId);
    if (contactId) target.searchParams.set('contactId', contactId);
    const upstream = await fetch(target, { headers: { Authorization: authorization, 'X-Internal-Secret': internalSecret, Accept: 'application/json' } });
    const raw = await upstream.text();
    try { return json(upstream.status, JSON.parse(raw)); }
    catch { return json(502, { success: false, code: 'INVALID_WHATSAPP_SERVICE_RESPONSE', error: `Serviço WhatsApp retornou resposta inválida. HTTP ${upstream.status}.` }); }
  } catch (error) {
    console.error('[WhatsApp Profile Proxy Error]', error instanceof Error ? error.message : 'erro desconhecido');
    return json(500, { success: false, code: 'WHATSAPP_PROFILE_PROXY_ERROR', error: 'Falha interna ao buscar foto do WhatsApp.' });
  }
}
