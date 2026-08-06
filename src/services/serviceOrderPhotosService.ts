import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-120) || 'foto.jpg';

export const serviceOrderPhotosService = {
  async upload(orderId: string, file: Blob, fileName = 'foto.jpg') {
    const photoId = `${Date.now()}_${crypto.randomUUID()}`;
    const storagePath = `service-orders/${orderId}/photos/${photoId}_${safeName(fileName)}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type || 'image/jpeg', cacheControl: 'public,max-age=86400' });
    return { url: await getDownloadURL(storageRef), storagePath, photoId };
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
