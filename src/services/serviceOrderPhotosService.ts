import { deleteObject, ref } from 'firebase/storage';
import { storage } from '../firebase';
import { auth } from '../firebase';

const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-120) || 'foto.jpg';

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível preparar a foto.'));
    reader.readAsDataURL(blob);
  });
}

async function prepareImageForUpload(file: Blob): Promise<Blob> {
  if (file.size <= 2.5 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const compressed = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!compressed) throw new Error('Não foi possível reduzir a foto para envio.');
  return compressed;
}

export const serviceOrderPhotosService = {
  async upload(orderId: string, file: Blob, fileName = 'foto.jpg') {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Sua sessão expirou. Entre novamente para salvar a foto.');
    const preparedFile = await prepareImageForUpload(file);
    const preparedFileName = preparedFile === file ? fileName : fileName.replace(/\.[^.]+$/, '') + '.jpg';
    const response = await fetch('/api/service-orders/photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${await currentUser.getIdToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, fileName: safeName(preparedFileName), mimeType: preparedFile.type || 'image/jpeg', photoDataUrl: await blobToDataUrl(preparedFile) }),
    });
    const payload = await response.json().catch(() => null) as { success?: boolean; url?: string; storagePath?: string; photoId?: string; error?: string } | null;
    if (!response.ok || !payload?.url || !payload.storagePath || !payload.photoId) throw new Error(payload?.error || `Não foi possível salvar a foto (HTTP ${response.status}).`);
    return { url: payload.url, storagePath: payload.storagePath, photoId: payload.photoId };
  },

  async uploadDataUrl(orderId: string, dataUrl: string) {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error('Não foi possível preparar a foto capturada.');
    return this.upload(orderId, await response.blob(), 'camera.jpg');
  },

  async remove(url: string) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return;
    await deleteObject(ref(storage, url));
  }
};
