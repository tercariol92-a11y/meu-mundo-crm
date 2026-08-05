type VercelRequestLike = {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponseLike = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponseLike;
  json(payload: Record<string, unknown>): unknown;
};

type ProxyOptions = {
  method: 'GET' | 'POST';
  upstreamAction: 'status' | 'connect' | 'disconnect' | 'reconnect';
};

export async function proxyWhatsAppRequest(
  req: VercelRequestLike,
  res: VercelResponseLike,
  options: ProxyOptions
) {
  const json = (status: number, payload: Record<string, unknown>) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(status).json(payload);
  };

  try {
    const serviceUrl = process.env.WHATSAPP_SERVICE_URL?.trim();
    if (!serviceUrl) {
      return json(503, {
        success: false,
        code: 'WHATSAPP_SERVICE_NOT_CONFIGURED',
        error: 'O serviço persistente do WhatsApp ainda não está configurado.'
      });
    }

    let baseUrl: URL;
    try {
      baseUrl = new URL(serviceUrl);
      if (!['http:', 'https:'].includes(baseUrl.protocol)) throw new Error('Protocolo inválido.');
    } catch {
      return json(503, {
        success: false,
        code: 'INVALID_WHATSAPP_SERVICE_URL',
        error: 'A variável WHATSAPP_SERVICE_URL não contém uma URL válida.'
      });
    }

    if (req.method !== options.method) {
      res.setHeader('Allow', options.method);
      return json(405, {
        success: false,
        code: 'METHOD_NOT_ALLOWED',
        error: `Método ${req.method} não permitido.`
      });
    }

    const authorizationHeader = req.headers?.authorization;
    const authorization = Array.isArray(authorizationHeader) ? authorizationHeader[0] : String(authorizationHeader || '');
    if (!authorization.startsWith('Bearer ')) {
      return json(401, {
        success: false,
        code: 'FIREBASE_TOKEN_REQUIRED',
        error: 'Token Firebase obrigatório.'
      });
    }

    const forwardedProtocol = req.headers?.['x-forwarded-proto'];
    const hostHeader = req.headers?.host;
    const requestOrigin = `${Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol || 'https'}://${Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || ''}`;
    if (baseUrl.origin === requestOrigin) {
      return json(503, {
        success: false,
        code: 'INVALID_WHATSAPP_SERVICE_URL',
        error: 'WHATSAPP_SERVICE_URL não pode apontar para a própria função Vercel.'
      });
    }

    const target = new URL(`/api/whatsapp/qr/${options.upstreamAction}`, baseUrl.toString());
    const internalSecret = process.env.WHATSAPP_INTERNAL_SECRET?.trim();
    if (!internalSecret) {
      return json(503, {
        success: false,
        code: 'WHATSAPP_INTERNAL_SECRET_NOT_CONFIGURED',
        error: 'O segredo interno do serviço WhatsApp ainda não está configurado.'
      });
    }
    const upstream = await fetch(target, {
      method: options.method,
      headers: {
        Authorization: authorization,
        'X-Internal-Secret': internalSecret,
        Accept: 'application/json',
        ...(options.method === 'POST' ? { 'Content-Type': 'application/json' } : {})
      },
      body: options.method === 'POST' ? JSON.stringify(req.body || {}) : undefined
    });

    const rawResponse = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      console.error('[WhatsApp Proxy] resposta não JSON', {
        action: options.upstreamAction,
        status: upstream.status,
        contentType,
        preview: rawResponse.slice(0, 300)
      });
      return json(502, {
        success: false,
        code: 'INVALID_WHATSAPP_SERVICE_RESPONSE',
        error: `Serviço WhatsApp retornou conteúdo inválido. HTTP ${upstream.status}.`
      });
    }

    try {
      return json(upstream.status, JSON.parse(rawResponse));
    } catch {
      return json(502, {
        success: false,
        code: 'INVALID_WHATSAPP_SERVICE_RESPONSE',
        error: `Serviço WhatsApp retornou JSON inválido. HTTP ${upstream.status}.`
      });
    }
  } catch (error: unknown) {
    console.error('[WhatsApp Proxy Error]', error);
    return json(500, {
      success: false,
      code: 'WHATSAPP_PROXY_ERROR',
      error: error instanceof Error ? error.message : 'Falha interna ao acessar o serviço WhatsApp.'
    });
  }
}

export type { VercelRequestLike, VercelResponseLike };
