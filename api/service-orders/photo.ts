import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';

const APP_NAME = 'service-orders-photos-api';
const DEFAULT_STORAGE_BUCKET = 'backup-mundo-crm';

function adminApp() {
  const existing = getApps().find(app => app.name === APP_NAME);
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin não está configurado para salvar fotos da Ordem de Serviço.');
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET?.trim() || DEFAULT_STORAGE_BUCKET,
  }, APP_NAME);
}

function decodeImage(dataUrl: string, expectedMimeType: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw Object.assign(new Error('A foto enviada não é uma imagem JPEG, PNG ou WebP válida.'), { status: 400 });
  if (expectedMimeType && match[1] !== expectedMimeType) throw Object.assign(new Error('O tipo informado não corresponde ao conteúdo da foto.'), { status: 400 });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw Object.assign(new Error('A foto enviada está vazia.'), { status: 400 });
  if (buffer.length > 3 * 1024 * 1024) throw Object.assign(new Error('A foto excede o limite de 3 MB. Reduza o tamanho e tente novamente.'), { status: 413 });
  return { buffer, mimeType: match[1] };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método não permitido.' });
    const authorization = String(req.headers?.authorization || '');
    if (!authorization.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Autenticação obrigatória.' });
    const app = adminApp();
    const decoded = await getAuth(app).verifyIdToken(authorization.slice(7));
    const orderId = String(req.body?.orderId || '').trim();
    if (!/^[A-Za-z0-9_-]{4,160}$/.test(orderId)) return res.status(400).json({ success: false, error: 'Ordem de Serviço inválida.' });
    const fileName = String(req.body?.fileName || 'foto.jpg').replace(/[^A-Za-z0-9._-]/g, '_').slice(-120);
    const expectedMimeType = String(req.body?.mimeType || '').toLowerCase();
    const image = decodeImage(String(req.body?.photoDataUrl || ''), expectedMimeType);
    const photoId = `${Date.now()}_${randomUUID()}`;
    const storagePath = `service-orders/${orderId}/photos/${photoId}_${fileName || 'foto.jpg'}`;
    const downloadToken = randomUUID();
    const bucket = getStorage(app).bucket(process.env.FIREBASE_STORAGE_BUCKET?.trim() || DEFAULT_STORAGE_BUCKET);
    const [exists] = await bucket.exists();
    if (!exists) throw new Error(`O armazenamento da Ordem de Serviço não está disponível (${bucket.name}).`);
    await bucket.file(storagePath).save(image.buffer, {
      resumable: false,
      contentType: image.mimeType,
      metadata: { cacheControl: 'private,max-age=3600', metadata: { firebaseStorageDownloadTokens: downloadToken, orderId, uploadedBy: decoded.uid, documentType: 'service-order-photo' } },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(downloadToken)}`;
    return res.status(200).json({ success: true, url, storagePath, photoId });
  } catch (error) {
    console.error('[SERVICE ORDER PHOTO API ERROR]', error instanceof Error ? { name: error.name, message: error.message } : { message: 'Erro desconhecido' });
    const status = Number((error as any)?.status) || 500;
    return res.status(status).json({ success: false, error: error instanceof Error ? error.message : 'Não foi possível salvar a foto.' });
  }
}
