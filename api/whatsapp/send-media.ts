type RequestLike = NodeJS.ReadableStream & {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
  status(code: number): ResponseLike;
  json(payload: Record<string, unknown>): unknown;
};

// O envio ao WhatsApp é confirmado antes da persistência da mídia. Em produção,
// upload + Firestore podem ultrapassar o limite padrão curto da função proxy.
export const config = { api: { bodyParser: false }, maxDuration: 60 };

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

    const authorizationHeader = req.headers?.authorization;
    const authorization = Array.isArray(authorizationHeader) ? authorizationHeader[0] : String(authorizationHeader || '');
    if (!authorization.startsWith('Bearer ')) return json(401, { success: false, code: 'FIREBASE_TOKEN_REQUIRED', error: 'Token Firebase obrigatório.' });
    const contentTypeHeader = req.headers?.['content-type'];
    const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : String(contentTypeHeader || '');
    if (!contentType.includes('multipart/form-data')) return json(415, { success: false, error: 'Use multipart/form-data.' });

    let target: URL;
    try {
      target = new URL('/api/whatsapp/send-media', new URL(serviceUrl).toString());
    } catch {
      return json(503, { success: false, code: 'INVALID_WHATSAPP_SERVICE_URL', error: 'A variável WHATSAPP_SERVICE_URL não contém uma URL válida.' });
    }

    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'X-Internal-Secret': internalSecret,
        'Content-Type': contentType,
        Accept: 'application/json'
      },
      body: req as any,
      duplex: 'half'
    } as RequestInit & { duplex: 'half' });
    const raw = await upstream.text();
    try {
      return json(upstream.status, JSON.parse(raw));
    } catch {
      return json(502, { success: false, code: 'INVALID_WHATSAPP_SERVICE_RESPONSE', error: `Serviço WhatsApp retornou resposta inválida. HTTP ${upstream.status}.` });
    }
  } catch (error) {
    console.error('[WhatsApp Media Proxy Error]', error);
    return json(500, { success: false, code: 'WHATSAPP_MEDIA_PROXY_ERROR', error: error instanceof Error ? error.message : 'Falha interna ao enviar mídia.' });
  }
}
