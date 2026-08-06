import { auth } from '../firebase';

const ROUTES = Object.freeze({
  send: '/api/whatsapp/send',
  sendMedia: '/api/whatsapp/send-media',
  sendTemplate: '/api/whatsapp/send-template',
  qrStatus: '/api/whatsapp/qr/status',
  qrConnect: '/api/whatsapp/qr/connect',
  qrGenerate: '/api/whatsapp/qr/generate',
  qrReconnect: '/api/whatsapp/qr/reconnect',
  qrDisconnect: '/api/whatsapp/qr/disconnect'
});

async function firebaseAuthorization() {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado. Entre novamente no sistema.');
  return `Bearer ${await user.getIdToken()}`;
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { success: false, error: await response.text() || `Resposta inválida. HTTP ${response.status}.` };
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || `Falha na API WhatsApp. HTTP ${response.status}.`);
  return payload;
}

async function authenticatedRequest(route: string, init: RequestInit = {}) {
  const authorization = await firebaseAuthorization();
  return fetch(route, { ...init, headers: { ...(init.headers || {}), Authorization: authorization } });
}

export const whatsappApi = {
  async sendMessage(payload: Record<string, unknown>) {
    return parseResponse(await authenticatedRequest(ROUTES.send, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }));
  },

  async sendImage(formData: FormData) {
    return parseResponse(await authenticatedRequest(ROUTES.sendMedia, { method: 'POST', body: formData }));
  },

  async sendTemplate(payload: Record<string, unknown>) {
    return parseResponse(await fetch(ROUTES.sendTemplate, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }));
  },

  async getStatus() {
    return parseResponse(await authenticatedRequest(ROUTES.qrStatus));
  },

  async getDiagnostics() {
    const data = await this.getStatus();
    const status = data?.status || {};
    return {
      success: true,
      whatsappProvider: 'baileys',
      apiConnected: status.status === 'connected',
      numberConnected: status.sessionPhone || '',
      sessionStatus: status.status || 'disconnected',
      uid: status.uid || ''
    };
  },

  async verifyEnvironment() {
    const data = await this.getStatus();
    const status = data?.status || {};
    return {
      success: true,
      results: {
        authentication: { status: 'success', label: 'Autenticação Firebase', details: 'Token Firebase aceito pelo serviço.' },
        whatsappService: {
          status: status.status === 'connected' ? 'success' : 'pending',
          label: 'Serviço WhatsApp',
          details: status.status === 'connected' ? `Conectado em ${status.sessionPhone || 'número não informado'}` : `Estado: ${status.status || 'desconectado'}`
        }
      }
    };
  },

  async runConnectionTest() {
    const data = await this.getStatus();
    const status = data?.status || {};
    return {
      success: true,
      results: [
        { name: 'API protegida', success: true, details: 'Token Firebase validado.' },
        { name: 'Sessão Baileys', success: status.status === 'connected', details: status.status || 'disconnected' }
      ],
      status
    };
  },

  async getQr(action: 'connect' | 'generate' | 'reconnect' = 'connect') {
    const route = action === 'generate' ? ROUTES.qrGenerate : action === 'reconnect' ? ROUTES.qrReconnect : ROUTES.qrConnect;
    return parseResponse(await authenticatedRequest(route, { method: 'POST' }));
  },

  async disconnect(clearCredentials = true, clearHistory = true) {
    return parseResponse(await authenticatedRequest(ROUTES.qrDisconnect, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clearCredentials, clearHistory })
    }));
  },

  async getProfilePicture(jid: string, options: { refresh?: boolean; sessionId?: string; contactId?: string } = {}) {
    const normalizedJid = String(jid || '').trim();
    if (!normalizedJid) return { success: true, profilePictureUrl: null };
    const search = new URLSearchParams();
    if (options.refresh) search.set('refresh', 'true');
    if (options.sessionId) search.set('sessionId', options.sessionId);
    if (options.contactId) search.set('contactId', options.contactId);
    const suffix = search.size ? `?${search.toString()}` : '';
    return parseResponse(await authenticatedRequest(`/api/whatsapp/profile-picture/${encodeURIComponent(normalizedJid)}${suffix}`));
  },

  resolveMediaUrl(message: any): string | null {
    const value = String(message?.mediaUrl || message?.imageUrl || message?.fileUrl || message?.downloadUrl || message?.url || '').trim();
    if (!value) return null;
    if (/^\/api\/whatsapp\/(?:session-)?media\//i.test(value)) return null;
    if (!/^https:\/\//i.test(value) && !value.startsWith('data:')) return null;
    return value;
  },

  async downloadMedia(mediaUrl: string) {
    if (!/^https:\/\//i.test(mediaUrl)) throw new Error('URL permanente de mídia inválida.');
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error(`Não foi possível baixar a mídia. HTTP ${response.status}.`);
    return response.blob();
  },

  async loadStoredMedia(messageId: string, storagePath: string, sessionId: string) {
    const search = new URLSearchParams({ storagePath, sessionId });
    const response = await authenticatedRequest(`/api/whatsapp/media/${encodeURIComponent(messageId)}?${search.toString()}`);
    if (!response.ok) throw new Error(`Não foi possível carregar a mídia. HTTP ${response.status}.`);
    return response.blob();
  }
};

export type WhatsAppApi = typeof whatsappApi;
