import { createHash } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

type RequestLike = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
  status(code: number): ResponseLike;
  json(payload: Record<string, unknown>): unknown;
};

const APP_NAME = 'support-satisfaction-api';

function adminApp() {
  const existing = getApps().find(app => app.name === APP_NAME);
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin não configurado.');
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, APP_NAME);
}

function tokenFrom(req: RequestLike) {
  const queryToken = Array.isArray(req.query?.token) ? req.query?.token[0] : req.query?.token;
  const token = String(queryToken || req.body?.token || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) throw new Error('Link de avaliação inválido.');
  return token;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export default async function handler(req: RequestLike, res: ResponseLike) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ success: false, error: 'Método não permitido.' });
    }
    const db = getFirestore(adminApp());
    const tokenHash = hashToken(tokenFrom(req));
    const match = await db.collection('chamados').where('satisfactionTokenHash', '==', tokenHash).limit(1).get();
    if (match.empty) return res.status(404).json({ success: false, error: 'Avaliação não encontrada ou link inválido.' });
    const ticketRef = match.docs[0].ref;
    const ticket = match.docs[0].data();
    const answered = ticket.satisfactionSurveyStatus === 'answered' || Number.isFinite(ticket.satisfactionNps) || Number.isFinite(ticket.satisfactionRating);

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        ticket: {
          protocol: ticket.protocolo || match.docs[0].id,
          clientName: ticket.satisfactionClientName || ticket.clienteNome || 'Cliente',
          technicianName: ticket.satisfactionTechnicianName || ticket.tecnico?.nome || 'Equipe Mundo Tech',
          answered,
          nps: answered ? ticket.satisfactionNps ?? null : null,
          ratings: answered ? ticket.satisfactionRatings ?? null : null,
        },
      });
    }

    const nps = Number(req.body?.nps);
    const comment = String(req.body?.comment || '').trim().slice(0, 1000);
    const rawRatings = (req.body?.ratings || {}) as Record<string, unknown>;
    const ratingKeys = ['technicalSupport', 'services', 'commercialSupport', 'product', 'administrative'] as const;
    const ratings = Object.fromEntries(ratingKeys.map(key => [key, Number(rawRatings[key])])) as Record<(typeof ratingKeys)[number], number>;
    if (!Number.isInteger(nps) || nps < 0 || nps > 10) {
      return res.status(400).json({ success: false, error: 'Selecione uma nota NPS de 0 a 10.' });
    }
    if (ratingKeys.some(key => !Number.isInteger(ratings[key]) || ratings[key] < 1 || ratings[key] > 5)) {
      return res.status(400).json({ success: false, error: 'Avalie todos os tópicos de 1 a 5 estrelas.' });
    }

    await db.runTransaction(async transaction => {
      const fresh = await transaction.get(ticketRef);
      const data = fresh.data() || {};
      if (data.satisfactionSurveyStatus === 'answered' || Number.isFinite(data.satisfactionNps) || Number.isFinite(data.satisfactionRating)) {
        const duplicate = new Error('Este chamado já foi avaliado.');
        (duplicate as Error & { status?: number }).status = 409;
        throw duplicate;
      }
      const answeredAt = FieldValue.serverTimestamp();
      transaction.update(ticketRef, {
        satisfactionSurveyStatus: 'answered',
        satisfactionNps: nps,
        satisfactionRatings: ratings,
        satisfactionRating: ratings.technicalSupport,
        satisfactionComment: comment,
        satisfactionAnsweredAt: answeredAt,
        satisfactionOrigin: data.satisfactionOrigin || 'public_link',
        updatedAt: answeredAt,
      });
      transaction.set(db.collection('satisfactionReviews').doc(`ticket-${fresh.id}`), {
        ticketId: fresh.id,
        protocol: data.protocolo || fresh.id,
        nps,
        nota: ratings.technicalSupport,
        rating: ratings.technicalSupport,
        ratings,
        comment,
        technicianId: data.satisfactionTechnicianId || data.tecnicoId || null,
        technicianName: data.satisfactionTechnicianName || data.tecnico?.nome || 'Equipe Mundo Tech',
        clientName: data.satisfactionClientName || data.clienteNome || 'Cliente',
        origin: data.satisfactionOrigin || 'public_link',
        answeredAt,
        createdAt: answeredAt,
      }, { merge: false });
    });
    return res.status(200).json({ success: true, message: 'Avaliação enviada com sucesso.' });
  } catch (error) {
    const status = Number((error as Error & { status?: number })?.status) || (/inválido/i.test(String((error as Error)?.message)) ? 400 : 500);
    const message = error instanceof Error ? error.message : 'Não foi possível registrar a avaliação.';
    console.error('[SUPPORT SATISFACTION API]', { status, message });
    return res.status(status).json({ success: false, error: message });
  }
}
