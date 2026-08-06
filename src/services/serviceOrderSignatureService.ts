import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

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
    const storagePath = `service-orders/${orderId}/signatures/customer-signature.png`;
    const signatureRef = ref(storage, storagePath);
    await uploadBytes(signatureRef, blob, {
      contentType: 'image/png',
      cacheControl: 'private,max-age=3600',
      customMetadata: { orderId, documentType: 'customer-signature' },
    });
    return { url: await getDownloadURL(signatureRef), storagePath, mimeType: 'image/png' };
  },
};
