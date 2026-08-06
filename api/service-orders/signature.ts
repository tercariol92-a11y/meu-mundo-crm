import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
  status(code: number): ResponseLike;
  json(payload: Record<string, unknown>): unknown;
};

const APP_NAME = 'service-orders-api';

function getAdminApp() {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET?.trim() || 'gen-lang-client-0560295869.firebasestorage.app';
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin não está configurado para salvar a assinatura.');
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
    storageBucket,
  }, APP_NAME);
}

function decodePng(dataUrl: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error('A assinatura capturada não é uma imagem PNG válida.');
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length) throw new Error('A assinatura capturada está vazia.');
  if (buffer.length > 2 * 1024 * 1024) throw new Error('A assinatura excede o limite de 2 MB.');
  return buffer;
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ success: false, error: 'Método não permitido.' });
    }

    const authorizationHeader = req.headers?.authorization;
    const authorization = Array.isArray(authorizationHeader) ? authorizationHeader[0] : String(authorizationHeader || '');
    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Autenticação obrigatória.' });
    }

    const app = getAdminApp();
    await getAuth(app).verifyIdToken(authorization.slice(7));

    const orderId = String(req.body?.orderId || '').trim();
    const signatureDataUrl = String(req.body?.signatureDataUrl || '');
    if (!/^[A-Za-z0-9_-]{4,160}$/.test(orderId)) {
      return res.status(400).json({ success: false, error: 'Ordem de Serviço inválida.' });
    }

    const buffer = decodePng(signatureDataUrl);
    const storagePath = `service-orders/${orderId}/signatures/customer-signature.png`;
    const downloadToken = randomUUID();
    const bucket = getStorage(app).bucket();
    await bucket.file(storagePath).save(buffer, {
      resumable: false,
      contentType: 'image/png',
      metadata: {
        cacheControl: 'private,max-age=3600',
        metadata: { firebaseStorageDownloadTokens: downloadToken, orderId, documentType: 'customer-signature' },
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(downloadToken)}`;
    return res.status(200).json({ success: true, url, storagePath, mimeType: 'image/png' });
  } catch (error) {
    console.error('[SERVICE ORDER SIGNATURE API ERROR]', error);
    const message = error instanceof Error ? error.message : 'Não foi possível salvar a assinatura.';
    const unauthorized = /token|credential|auth/i.test(message);
    return res.status(unauthorized ? 401 : 500).json({ success: false, error: message });
  }
}
