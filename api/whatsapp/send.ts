type RequestLike = {
  method?: string;
  body?: Record<string, unknown>;
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
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return json(405, { success: false, code: 'METHOD_NOT_ALLOWED', error: `Método ${req.method} não permitido.` });
    }

    const serviceUrl = process.env.WHATSAPP_SERVICE_URL?.trim();
    const internalSecret = process.env.WHATSAPP_INTERNAL_SECRET?.trim();
    if (!serviceUrl) return json(503, { success: false, code: 'WHATSAPP_SERVICE_NOT_CONFIGURED', error: 'O serviço persistente do WhatsApp ainda não está configurado.' });
    if (!internalSecret) return json(503, { success: false, code: 'WHATSAPP_INTERNAL_SECRET_NOT_CONFIGURED', error: 'O segredo interno do serviço WhatsApp ainda não está configurado.' });

    let target: URL;
    try {
      const baseUrl = new URL(serviceUrl);
      if (!['http:', 'https:'].includes(baseUrl.protocol)) throw new Error('Protocolo inválido.');
      target = new URL('/api/whatsapp/send', baseUrl.toString());
    } catch {
      return json(503, { success: false, code: 'INVALID_WHATSAPP_SERVICE_URL', error: 'A variável WHATSAPP_SERVICE_URL não contém uma URL válida.' });
    }

    const authorizationHeader = req.headers?.authorization;
    const authorization = Array.isArray(authorizationHeader) ? authorizationHeader[0] : String(authorizationHeader || '');
    if (!authorization.startsWith('Bearer ')) return json(401, { success: false, code: 'FIREBASE_TOKEN_REQUIRED', error: 'Token Firebase obrigatório.' });

    const input = req.body || {};
    const to = String(input.to || input.telefone || '').trim();
    const message = String(input.message || input.mensagem || '').trim();
    if (!to || !message) return json(400, { success: false, code: 'INVALID_MESSAGE', error: 'Destino e mensagem são obrigatórios.' });

    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'X-Internal-Secret': internalSecret,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ ...input, to, message })
    });

    const rawResponse = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      console.error('[WhatsApp Send Proxy] resposta não JSON', { status: upstream.status, contentType });
      return json(502, { success: false, code: 'INVALID_WHATSAPP_SERVICE_RESPONSE', error: `Serviço WhatsApp retornou conteúdo inválido. HTTP ${upstream.status}.` });
    }

    try {
      return json(upstream.status, JSON.parse(rawResponse));
    } catch {
      return json(502, { success: false, code: 'INVALID_WHATSAPP_SERVICE_RESPONSE', error: `Serviço WhatsApp retornou JSON inválido. HTTP ${upstream.status}.` });
    }
  } catch (error) {
    console.error('[WhatsApp Send Proxy Error]', error);
    return json(500, { success: false, code: 'WHATSAPP_SEND_PROXY_ERROR', error: error instanceof Error ? error.message : 'Falha interna ao enviar mensagem.' });
  }
}
