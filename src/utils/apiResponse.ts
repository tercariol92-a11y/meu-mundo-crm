type ApiDebugContext = {
  method?: string;
  uid?: string;
};

export async function parseApiResponse<T = any>(response: Response, context: ApiDebugContext = {}): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const rawResponse = await response.text();

  if (!contentType.toLowerCase().includes('application/json')) {
    console.error('[WhatsApp API] resposta não JSON', {
      url: response.url,
      method: context.method || 'GET',
      status: response.status,
      contentType,
      responsePreview: rawResponse.slice(0, 300),
      environment: import.meta.env.MODE,
      uid: context.uid || ''
    });
    throw new Error(`API retornou resposta inválida. HTTP ${response.status}. Conteúdo: ${rawResponse.slice(0, 200)}`);
  }

  try {
    return JSON.parse(rawResponse) as T;
  } catch {
    throw new Error(`API retornou JSON inválido. HTTP ${response.status}. Conteúdo: ${rawResponse.slice(0, 200)}`);
  }
}
