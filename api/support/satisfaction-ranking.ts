import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { calculateSatisfactionRanking, META_COBERTURA_RANKING, MIN_AVALIACOES_RANKING, META_VOLUME_RANKING } from '../lib/satisfaction-ranking.js';

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

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

const firstValidDate = (...values: any[]) => {
  for (const value of values) {
    const parsed = Date.parse(isoDate(value));
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.NaN;
};

const periodBounds = (query: any) => {
  const month = String(query?.month || '').trim();
  if (/^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNumber] = month.split('-').map(Number);
    return {
      start: new Date(year, monthNumber - 1, 1, 0, 0, 0, 0).getTime(),
      end: new Date(year, monthNumber, 0, 23, 59, 59, 999).getTime(),
      label: month,
    };
  }
  const days = Math.max(1, Math.min(3650, Number(query?.days) || 30));
  return { start: Date.now() - days * 86400000, end: Date.now(), label: `${days}d` };
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
    const period = periodBounds(req.query);
    const noteFilter = String(req.query?.note || 'todos');
    const search = String(req.query?.search || '').trim().toLocaleLowerCase('pt-BR');
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
        requestId: item.requestId || '',
        attendanceId: item.atendimentoId || item.attendanceId || item.conversationId || item.leadId || '',
        ticketId: item.ticketId || '',
        createdAt: isoDate(item.createdAt || item.answeredAt),
      };
    }).filter(item => {
      const created = Date.parse(item.createdAt);
      if (!Number.isFinite(created) || created < period.start || created > period.end) return false;
      const matchesSearch = !search || [item.clienteNome, item.telefone, item.atendente, item.tecnico]
        .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(search));
      const matchesNote = noteFilter === 'todos' ||
        (noteFilter === 'promotores' && item.nps !== null && Number(item.nps) >= 9) ||
        (noteFilter === 'neutros' && item.nps !== null && Number(item.nps) >= 7 && Number(item.nps) <= 8) ||
        (noteFilter === 'detratores' && item.nps !== null && Number(item.nps) <= 6) ||
        String(item.nota) === noteFilter;
      return matchesSearch && matchesNote;
    });

    const leadsSnapshot = await db.collection('leads').get();
    const [ticketsSnapshot, techniciansSnapshot, usersSnapshot, satisfactionRequestsSnapshot] = await Promise.all([
      db.collection('chamados').get(),
      db.collection('tecnicos').get(),
      db.collection('usuarios').get(),
      db.collection('satisfaction_requests').get(),
    ]);
    const professionalNames = new Map<string, string>();
    const professionalIdsByName = new Map<string, string>();
    const registerProfessional = (idValue: unknown, ...nameValues: unknown[]) => {
      const id = String(idValue || '').trim();
      const name = nameValues.map(value => String(value || '').trim()).find(Boolean) || '';
      if (!id || !name) return;
      professionalNames.set(id, name);
      professionalIdsByName.set(normalizeText(name), id);
    };
    for (const document of techniciansSnapshot.docs) {
      const item = document.data() || {};
      registerProfessional(document.id, item.nome, item.name, item.displayName);
      registerProfessional(item.uid, item.nome, item.name, item.displayName);
    }
    for (const document of usersSnapshot.docs) {
      const item = document.data() || {};
      registerProfessional(document.id, item.nome, item.name, item.displayName);
      registerProfessional(item.uid, item.nome, item.name, item.displayName);
    }
    const canonicalProfessional = (idValue: unknown, nameValue: unknown) => {
      const rawId = String(idValue || '').trim();
      const rawName = String(nameValue || '').trim();
      const idFromName = professionalIdsByName.get(normalizeText(rawName)) || '';
      const id = (rawId && professionalNames.has(rawId) ? rawId : idFromName || rawId);
      const nome = professionalNames.get(id) || rawName;
      // WhatsApp, usuários e técnicos podem usar identificadores diferentes
      // para a mesma pessoa. O nome canônico é a referência comum entre as
      // origens; o identificador continua preservado para auditoria.
      return { id, nome, key: normalizeText(nome || id) };
    };

    const requestsById = new Map(satisfactionRequestsSnapshot.docs.map(document => [document.id, document.data() || {}]));
    const requestsByAttendance = new Map<string, any>();
    for (const document of satisfactionRequestsSnapshot.docs) {
      const item = document.data() || {};
      for (const value of [item.attendanceId, item.atendimentoId, item.conversationId, item.leadId, item.ticketId]) {
        const key = String(value || '').trim();
        if (key && !requestsByAttendance.has(key)) requestsByAttendance.set(key, item);
      }
    }

    for (const review of reviews) {
      const sourceRequest = requestsById.get(String(review.requestId || '').trim())
        || requestsByAttendance.get(String(review.attendanceId || review.ticketId || '').trim())
        || {};
      const attendant = canonicalProfessional(
        sourceRequest.assignedUserId || sourceRequest.attendantId || review.atendenteId,
        sourceRequest.assignedUserName || sourceRequest.attendantName || review.atendente,
      );
      if (attendant.id && attendant.nome) {
        review.atendenteId = attendant.id;
        review.atendente = attendant.nome;
      }
      const technician = canonicalProfessional(
        sourceRequest.technicianId || sourceRequest.tecnicoId || review.tecnicoId,
        sourceRequest.technicianName || sourceRequest.tecnicoNome || review.tecnico,
      );
      if (technician.id && technician.nome) {
        review.tecnicoId = technician.id;
        review.tecnico = technician.nome;
      }
    }
    const attendanceGroups = (role: 'atendente' | 'tecnico') => {
      const totals = new Map<string, { id: string; nome: string; total: number; atendimentosWhatsapp: number; chamadosExternos: number }>();
      const countedAttendances = new Set<string>();
      // O pedido de satisfação é o registro histórico mais confiável de que um
      // atendimento foi encerrado, inclusive para conversas antigas cujos leads
      // ainda não possuíam finalizedAt/attendanceStatus.
      for (const document of satisfactionRequestsSnapshot.docs) {
        const item = document.data() || {};
        if (normalizeText(item.channel || item.origem || item.origin).includes('ticket')) continue;
        const finalizedAt = firstValidDate(item.finalizedAt, item.requestedAt, item.sentAt, item.createdAt);
        if (!Number.isFinite(finalizedAt) || finalizedAt < period.start || finalizedAt > period.end) continue;
        const attendanceId = String(item.attendanceId || item.atendimentoId || item.conversationId || item.leadId || document.id).trim();
        const rawId = String(role === 'atendente'
          ? item.assignedUserId || item.attendantId || item.sessionOwnerUid || item.whatsappSessionOwnerUid || ''
          : item.technicianId || item.tecnicoId || '').trim();
        const rawName = String(role === 'atendente'
          ? item.assignedUserName || item.attendantName || ''
          : item.technicianName || item.tecnicoNome || item.tecnico || '').trim();
        const { id, nome, key } = canonicalProfessional(rawId, rawName);
        if (!key || !nome) continue;
        const uniqueKey = `${key}:${attendanceId}`;
        if (countedAttendances.has(uniqueKey)) continue;
        countedAttendances.add(uniqueKey);
        const current = totals.get(key) || { id: id || key, nome, total: 0, atendimentosWhatsapp: 0, chamadosExternos: 0 };
        current.total += 1;
        current.atendimentosWhatsapp += 1;
        totals.set(key, current);
      }
      for (const document of leadsSnapshot.docs) {
        const item = document.data() || {};
        const finalizedAt = firstValidDate(item.finalizedAt, item.atendimentoFinalizadoEm, item.completedAt, item.closedAt, item.dataFechamento);
        const status = normalizeText(item.attendanceStatus || item.status);
        const finalized = ['finalizado', 'concluido', 'fechado', 'closed'].includes(status);
        if (!finalized || !Number.isFinite(finalizedAt) || finalizedAt < period.start || finalizedAt > period.end) continue;
        const rawId = String(role === 'atendente'
          ? item.finalizedByUid || item.assignedUserId || item.responsavelId || ''
          : item.technicianId || item.tecnicoId || '').trim();
        const rawName = String(role === 'atendente'
          ? item.finalizedByName || item.assignedUserName || item.atendenteFinalizacao || ''
          : item.technicianName || item.tecnicoNome || item.tecnico || '').trim();
        const { id, nome, key } = canonicalProfessional(rawId, rawName);
        if (!key || !nome) continue;
        const attendanceId = String(item.attendanceId || item.atendimentoId || item.conversationId || document.id).trim();
        const uniqueKey = `${key}:${attendanceId}`;
        if (countedAttendances.has(uniqueKey)) continue;
        countedAttendances.add(uniqueKey);
        const current = totals.get(key) || { id: id || key, nome, total: 0, atendimentosWhatsapp: 0, chamadosExternos: 0 };
        current.total += 1;
        current.atendimentosWhatsapp += 1;
        totals.set(key, current);
      }
      return [...totals.values()];
    };

    const externalTicketGroups = () => {
      const totals = new Map<string, { id: string; nome: string; total: number; atendimentosWhatsapp: number; chamadosExternos: number }>();
      for (const document of ticketsSnapshot.docs) {
        const item = document.data() || {};
        const status = normalizeText(item.status);
        const completed = status === 'concluido' || status === 'finalizado';
        const completedAt = firstValidDate(item.dataFechamento, item.dataTerminoAtendimento, item.completedAt, item.updatedAt);
        if (!completed || !Number.isFinite(completedAt) || completedAt < period.start || completedAt > period.end) continue;
        const rawId = String(item.tecnicoId || item.tecnicoUid || item.satisfactionTechnicianId || '').trim();
        const rawName = String(item.tecnicoNome || item.technicianName || item.satisfactionTechnicianName || '').trim();
        const { id, nome, key } = canonicalProfessional(rawId, rawName);
        if (!key || !nome) continue;
        const current = totals.get(key) || { id: id || key, nome, total: 0, atendimentosWhatsapp: 0, chamadosExternos: 0 };
        current.total += 1;
        current.chamadosExternos += 1;
        totals.set(key, current);
      }
      return [...totals.values()];
    };

    const atendimentosAtendentes = attendanceGroups('atendente');
    const whatsappTecnicos = attendanceGroups('tecnico');
    const chamadosTecnicos = externalTicketGroups();
    const atendimentosTecnicos = [...whatsappTecnicos, ...chamadosTecnicos];
    const atendentes = calculateSatisfactionRanking(reviews, 'atendente', atendimentosAtendentes);
    const tecnicos = calculateSatisfactionRanking(reviews, 'tecnico', atendimentosTecnicos);
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
        totalAtendimentos: atendimentosAtendentes.reduce((sum, item) => sum + item.total, 0),
        totalAtendimentosWhatsapp: atendimentosAtendentes.reduce((sum, item) => sum + item.atendimentosWhatsapp, 0),
        totalChamadosExternos: chamadosTecnicos.reduce((sum, item) => sum + item.chamadosExternos, 0),
        taxaAvaliacao: atendimentosAtendentes.reduce((sum, item) => sum + item.total, 0)
          ? Number((total / atendimentosAtendentes.reduce((sum, item) => sum + item.total, 0) * 100).toFixed(1))
          : 0,
      },
      ranking: { atendentes, tecnicos },
      period: { start: new Date(period.start).toISOString(), end: new Date(period.end).toISOString(), label: period.label },
      config: { minAvaliacoes: MIN_AVALIACOES_RANKING, metaVolume: META_VOLUME_RANKING, metaCobertura: META_COBERTURA_RANKING },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível calcular o ranking.';
    console.error('[SATISFACTION RANKING]', { message });
    return res.status(500).json({ success: false, error: 'Não foi possível calcular o ranking de satisfação.' });
  }
}
