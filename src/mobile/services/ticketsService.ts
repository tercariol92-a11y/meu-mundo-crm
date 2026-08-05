import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp } from '../../services/resilientFirestoreClient';
import { db } from '../api/firebase';
import { Ticket, TicketMessage } from '../types';

export const ticketsService = {
  async getTicketsByTecnico(tecnicoId: string) {
    const q = query(
      collection(db, 'chamados'),
      where('tecnicoId', '==', tecnicoId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket));
  },

  async getTicketById(id: string) {
    const d = await getDoc(doc(db, 'chamados', id));
    if (d.exists()) {
      return { id: d.id, ...d.data() } as Ticket;
    }
    return null;
  },

  async updateTicketStatus(id: string, status: string) {
    await updateDoc(doc(db, 'chamados', id), {
      status,
      updatedAt: serverTimestamp()
    });
  },

  async updateStatus(id: string, status: string, userName?: string) {
    await updateDoc(doc(db, 'chamados', id), {
      status,
      tecnicoNome: userName,
      updatedAt: serverTimestamp()
    });
    // Adicionar mensagem de sistema
    if (userName) {
      await this.addTicketMessage({
        ticketId: id,
        message: `Status alterado para ${status} por ${userName}`,
        userName: 'Sistema',
        internal: false,
        type: 'status_change'
      });
    }
  },

  async addComment(ticketId: string, userId: string, userName: string, message: string, internal: boolean = false) {
    await addDoc(collection(db, 'chamados', ticketId, 'messages'), {
      ticketId,
      message,
      userId,
      userName,
      internal,
      createdAt: serverTimestamp()
    });
  },

  async addTicketMessage(message: Omit<TicketMessage, 'id' | 'createdAt'>) {
    await addDoc(collection(db, 'chamados', message.ticketId, 'messages'), {
      ...message,
      createdAt: serverTimestamp()
    });
  },

  async uploadPhoto(ticketId: string, uri: string, userName?: string) {
    // In a real app, upload to storage. Here we simulate.
    await addDoc(collection(db, 'documentos'), {
      ticketId,
      url: uri,
      tipo: 'image/jpeg',
      nome: 'Foto de Atendimento',
      tecnicoNome: userName,
      createdAt: serverTimestamp()
    });
  }
};
