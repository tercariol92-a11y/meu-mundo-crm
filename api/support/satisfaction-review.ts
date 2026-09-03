import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const APP_NAME = 'support-satisfaction-review-api';
const FIRESTORE_DATABASE_ID = 'ai-studio-deb852ec-3d57-481f-a30e-1461a2294d90';

function adminApp() {
  const existing = getApps().find(app => app.name === APP_NAME);
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin não configurado.');
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, APP_NAME);
}

const companyIdOf = (value: any) => String(value?.companyId || value?.tenantId || value?.empresaId || '').trim();

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  try {
    const authorization = String(req.headers?.authorization || '');
    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Sessão não autenticada.' });
    }

    const app = adminApp();
    const db = getFirestore(app, FIRESTORE_DATABASE_ID);
    const decoded = await getAuth(app).verifyIdToken(authorization.slice(7));

    const userSnapshot = await db.collection('usuarios').doc(decoded.uid).get();
    const user = userSnapshot.exists ? userSnapshot.data() || {} : {};
    const roles = [user.role, ...(Array.isArray(user.roles) ? user.roles : []), decoded.role]
      .map(role => String(role || '').toLowerCase());
    if (!roles.includes('admin')) {
      return res.status(403).json({ success: false, error: 'Apenas administradores podem excluir avaliações.' });
    }

    const reviewId = String(req.body?.reviewId || '').trim();
    if (!reviewId || reviewId.includes('/') || reviewId.length > 180) {
      return res.status(400).json({ success: false, error: 'Identificador da avaliação inválido.' });
    }

    const reviewRef = db.collection('satisfactionReviews').doc(reviewId);
    const reviewSnapshot = await reviewRef.get();
    if (!reviewSnapshot.exists) {
      return res.status(404).json({ success: false, error: 'Avaliação não encontrada.' });
    }
    const review = reviewSnapshot.data() || {};
    const adminCompanyId = companyIdOf(user);
    const reviewCompanyId = companyIdOf(review);

    let ticketRef: any = null;
    let requestRef: any = null;
    let relatedCompanyId = reviewCompanyId;
    if (review.ticketId) {
      ticketRef = db.collection('chamados').doc(String(review.ticketId));
      const ticketSnapshot = await ticketRef.get();
      if (ticketSnapshot.exists) relatedCompanyId ||= companyIdOf(ticketSnapshot.data());
    }
    if (review.requestId) {
      requestRef = db.collection('satisfaction_requests').doc(String(review.requestId));
      const requestSnapshot = await requestRef.get();
      if (requestSnapshot.exists) relatedCompanyId ||= companyIdOf(requestSnapshot.data());
    }
    if (adminCompanyId && relatedCompanyId && adminCompanyId !== relatedCompanyId) {
      return res.status(403).json({ success: false, error: 'A avaliação pertence a outra empresa.' });
    }

    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.delete(reviewRef);
    if (ticketRef) {
      batch.set(ticketRef, {
        satisfactionSurveyStatus: 'deleted_by_admin',
        satisfactionNps: FieldValue.delete(),
        satisfactionRatings: FieldValue.delete(),
        satisfactionRating: FieldValue.delete(),
        satisfactionComment: FieldValue.delete(),
        satisfactionAnsweredAt: FieldValue.delete(),
        satisfactionTokenHash: FieldValue.delete(),
        updatedAt: now,
      }, { merge: true });
    }
    if (requestRef) {
      batch.set(requestRef, {
        status: 'deleted_by_admin',
        score: null,
        rating: null,
        updatedAt: now,
      }, { merge: true });
    }
    const auditRef = db.collection('audit_logs').doc();
    batch.set(auditRef, {
      action: 'satisfaction_review_deleted',
      entityType: 'satisfactionReview',
      entityId: reviewId,
      companyId: adminCompanyId || relatedCompanyId || '',
      performedByUid: decoded.uid,
      performedByEmail: decoded.email || user.email || '',
      ticketId: review.ticketId || '',
      requestId: review.requestId || '',
      createdAt: now,
    });
    await batch.commit();

    return res.status(200).json({ success: true, message: 'Avaliação excluída com sucesso.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível excluir a avaliação.';
    console.error('[SATISFACTION REVIEW DELETE]', { message });
    return res.status(500).json({ success: false, error: 'Não foi possível excluir a avaliação.' });
  }
}
