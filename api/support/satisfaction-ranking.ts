import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { calculateSatisfactionRanking, MIN_AVALIACOES_RANKING, META_VOLUME_RANKING } from '../lib/satisfaction-ranking.js';

const APP_NAME = 'support-satisfaction-ranking-api';
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

const isoDate = (value: any) => {
  if (!value) return '';
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return '';
};

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método não permitido.' });
  try {
    const authorization = String(req.headers?.authorization || '');
    if (!authorization.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Sessão não autenticada.' });
    const app = adminApp();
    await getAuth(app).verifyIdToken(authorization.slice(7));
    const db = getFirestore(app, FIRESTORE_DATABASE_ID);
    const days = Math.max(1, Math.min(3650, Number(req.query?.days) || 30));
    const noteFilter = String(req.query?.note || 'todos');
    const search = String(req.query?.search || '').trim().toLocaleLowerCase('pt-BR');
    const cutoff = Date.now() - days * 86400000;
    const snapshot = await db.collection('satisfactionReviews').orderBy('createdAt', 'desc').get();
    const reviews = snapshot.docs.map(doc => {
      const item = doc.data() || {};
      return {
        id: doc.id,
        telefone: item.telefone || item.phone || '',
        clienteNome: item.clienteNome || item.clientName || 'Cliente',
        nota: Number(item.nota ?? item.rating ?? item.ratings?.technicalSupport ?? 0),
        nps: Number.isFinite(Number(item.nps)) ? Number(item.nps) : null,
        atendenteId: item.atendenteId || item.attendantId || '',
        atendente: item.atendente || item.attendantName || 'Equipe Mundo Tech',
        tecnicoId: item.tecnicoId || item.technicianId || '',
        tecnico: item.tecnico || item.technicianName || '',
        comentario: item.comentario || item.comment || '',
        origem: item.origem || item.origin || 'link público',
        createdAt: isoDate(item.createdAt || item.answeredAt),
      };
    }).filter(item => {
      const created = Date.parse(item.createdAt);
      if (!Number.isFinite(created) || created < cutoff) return false;
      const matchesSearch = !search || [item.clienteNome, item.telefone, item.atendente, item.tecnico]
        .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(search));
      const matchesNote = noteFilter === 'todos' ||
        (noteFilter === 'promotores' && item.nps !== null && Number(item.nps) >= 9) ||
        (noteFilter === 'neutros' && item.nps !== null && Number(item.nps) >= 7 && Number(item.nps) <= 8) ||
        (noteFilter === 'detratores' && item.nps !== null && Number(item.nps) <= 6) ||
        String(item.nota) === noteFilter;
      return matchesSearch && matchesNote;
    });

    const atendentes = calculateSatisfactionRanking(reviews, 'atendente');
    const tecnicos = calculateSatisfactionRanking(reviews, 'tecnico');
    const total = reviews.length;
    const positivas = reviews.filter(item => item.nota >= 4).length;
    const neutras = reviews.filter(item => item.nota === 3).length;
    const negativas = reviews.filter(item => item.nota <= 2).length;
    const media = total ? reviews.reduce((sum, item) => sum + item.nota, 0) / total : 0;
    const personKey = (item: { id: string; nome: string }) => String(item.id || item.nome).trim().toLocaleLowerCase('pt-BR');
    const allPeople = new Set([...atendentes, ...tecnicos].map(personKey));
    const qualifiedPeople = new Set([...atendentes, ...tecnicos].filter(item => item.elegivelRanking).map(personKey)).size;
    return res.status(200).json({
      success: true,
      reviews,
      stats: {
        total,
        media: Number(media.toFixed(2)),
        positivas,
        neutras,
        negativas,
        taxaSatisfacao: total ? Number((positivas / total * 100).toFixed(1)) : 0,
        funcionariosQualificados: qualifiedPeople,
        totalFuncionarios: allPeople.size,
      },
      ranking: { atendentes, tecnicos },
      config: { minAvaliacoes: MIN_AVALIACOES_RANKING, metaVolume: META_VOLUME_RANKING },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível calcular o ranking.';
    console.error('[SATISFACTION RANKING]', { message });
    return res.status(500).json({ success: false, error: 'Não foi possível calcular o ranking de satisfação.' });
  }
}
