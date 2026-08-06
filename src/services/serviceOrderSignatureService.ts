import { auth } from '../firebase';

export interface StoredServiceOrderSignature {
  url: string;
  storagePath: string;
  mimeType: 'image/png';
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',');
  if (!header?.startsWith('data:image/png') || !encoded) throw new Error('A assinatura capturada não é uma imagem PNG válida.');
  const bytes = atob(encoded);
  const output = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) output[index] = bytes.charCodeAt(index);
  return new Blob([output], { type: 'image/png' });
}

export const serviceOrderSignatureService = {
  async uploadCustomerSignature(orderId: string, signature: Blob | string): Promise<StoredServiceOrderSignature> {
    if (!orderId) throw new Error('Ordem de Serviço inválida para salvar a assinatura.');
    const blob = typeof signature === 'string' ? dataUrlToBlob(signature) : signature;
    if (!blob.size) throw new Error('A assinatura capturada está vazia.');
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Sua sessão expirou. Entre novamente para finalizar a Ordem de Serviço.');
    const signatureDataUrl = typeof signature === 'string'
      ? signature
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Não foi possível preparar a assinatura.'));
          reader.readAsDataURL(blob);
        });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    let response: Response;
    try {
      response = await fetch('/api/service-orders/signature', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await currentUser.getIdToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId, signatureDataUrl }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('O salvamento da assinatura excedeu 30 segundos. Tente novamente.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    const payload = await response.json().catch(() => null) as (StoredServiceOrderSignature & { success?: boolean; error?: string }) | null;
    if (!response.ok || !payload?.url || !payload.storagePath) {
      throw new Error(payload?.error || `Não foi possível salvar a assinatura (HTTP ${response.status}).`);
    }
    return {
      url: payload.url,
      storagePath: payload.storagePath,
      mimeType: 'image/png',
    };
  },
};
