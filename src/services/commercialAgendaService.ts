import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AgendaComercial, Usuario } from '../types';

export const AGENDA_COLLECTION = 'agenda_comercial';
export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

export function resolveCompanyId(user?: Partial<Usuario> | null) {
  return String((user as any)?.companyId || (user as any)?.tenantId || (user as any)?.empresaId || 'default');
}

export function isAgendaAdmin(user?: Partial<Usuario> | null) {
  const roles = [user?.role, ...(user?.roles || [])];
  return roles.some(role => ['admin', 'gerente', 'gerente_comercial'].includes(String(role)));
}

export function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function appointmentStart(item: Partial<AgendaComercial>): Date | null {
  return toDate(item.startAt || item.dataHora || item.dataInicio || item.data);
}

export function appointmentEnd(item: Partial<AgendaComercial>): Date | null {
  return toDate(item.endAt) || appointmentStart(item);
}

export function localDateTime(date: string, time: string) {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Data ou horário inválido.');
  return parsed;
}

export interface SaveAppointmentInput {
  id?: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  responsibleUserId: string;
  responsibleUserName: string;
  customerId?: string;
  customerName?: string;
  leadId?: string;
  phone?: string;
  address?: string;
  type: AgendaComercial['type'];
  priority: AgendaComercial['priority'];
  status: AgendaComercial['status'];
  reminderMinutes?: number;
  companyId: string;
  linkedTaskId?: string;
}

async function hasConflict(input: SaveAppointmentInput) {
  const start = localDateTime(input.date, input.startTime);
  const end = localDateTime(input.date, input.endTime);
  const snapshot = await getDocs(query(
    collection(db, AGENDA_COLLECTION),
    where('responsibleUserId', '==', input.responsibleUserId),
    where('companyId', '==', input.companyId),
  ));
  return snapshot.docs.some(entry => {
    if (entry.id === input.id) return false;
    const data = entry.data() as AgendaComercial;
    if (['Cancelado', 'Concluído'].includes(data.status)) return false;
    const existingStart = appointmentStart(data);
    const existingEnd = appointmentEnd(data);
    return Boolean(existingStart && existingEnd && start < existingEnd && end > existingStart);
  });
}

export const commercialAgendaService = {
  async save(input: SaveAppointmentInput, allowConflict = false) {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) throw new Error('Usuário não autenticado.');
    const start = localDateTime(input.date, input.startTime);
    const end = localDateTime(input.date, input.endTime);
    if (end <= start) throw new Error('O horário final deve ser posterior ao horário inicial.');
    const conflict = await hasConflict(input);
    if (conflict && !allowConflict) {
      const error = new Error('Este funcionário já possui um compromisso neste horário.');
      (error as any).code = 'AGENDA_CONFLICT';
      throw error;
    }

    const creatorName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário';
    const payload = {
      companyId: input.companyId,
      title: input.title.trim(),
      titulo: input.title.trim(),
      description: input.description?.trim() || '',
      descricao: input.description?.trim() || '',
      startAt: Timestamp.fromDate(start),
      endAt: Timestamp.fromDate(end),
      data: input.date,
      dataHora: start.toISOString(),
      responsibleUserId: input.responsibleUserId,
      responsibleUserName: input.responsibleUserName,
      responsavelId: input.responsibleUserId,
      responsavelNome: input.responsibleUserName,
      createdByUserId: firebaseUser.uid,
      createdByUserName: creatorName,
      criadoPorId: firebaseUser.uid,
      criadoPorNome: creatorName,
      customerId: input.customerId || null,
      clienteId: input.customerId || null,
      customerName: input.customerName || null,
      clienteNome: input.customerName || null,
      leadId: input.leadId || null,
      phone: input.phone || null,
      telefone: input.phone || null,
      address: input.address || null,
      endereco: input.address || null,
      type: input.type,
      tipo: input.type,
      priority: input.priority,
      prioridade: input.priority,
      status: input.status,
      reminderMinutes: input.reminderMinutes ?? 30,
      lembrete: input.reminderMinutes ?? 30,
      linkedTaskId: input.linkedTaskId || null,
      updatedAt: serverTimestamp(),
    };

    let appointmentId = input.id;
    if (appointmentId) {
      await updateDoc(doc(db, AGENDA_COLLECTION, input.id), payload);
    } else {
      const created = await addDoc(collection(db, AGENDA_COLLECTION), { ...payload, createdAt: serverTimestamp() });
      appointmentId = created.id;
    }

    const historyEntry = {
      appointmentId,
      type: input.type,
      title: input.title.trim(),
      responsibleUserId: input.responsibleUserId,
      responsibleUserName: input.responsibleUserName,
      startAt: Timestamp.fromDate(start),
      action: input.id ? 'updated' : 'scheduled',
      recordedAt: Timestamp.now(),
    };
    const related = input.leadId
      ? doc(db, 'leads', input.leadId)
      : input.customerId ? doc(db, 'clientes', input.customerId) : null;
    if (related) {
      try { await updateDoc(related, { agendaHistory: arrayUnion(historyEntry), updatedAt: serverTimestamp() }); }
      catch (historyError) { console.warn('[Agenda] compromisso salvo, mas o histórico relacionado não foi atualizado.', historyError); }
    }
    return appointmentId;
  },

  async updateStatus(id: string, status: AgendaComercial['status']) {
    await updateDoc(doc(db, AGENDA_COLLECTION, id), {
      status,
      completedAt: status === 'Concluído' ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  },
};
