import { collection, doc, getDoc, getDocs, query, updateDoc, where } from './resilientFirestoreClient';
import { auth, db } from '../firebase';
import { Chamado, Cliente, Tecnico, Unidade, Usuario } from '../types';
import { whatsappService } from './whatsapp.service';

const digits = (value?: unknown) => String(value || '').replace(/\D/g, '');
const maskPhone = (value: string) => value.length > 4 ? `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : '****';

async function appendHistory(ticketId: string, entry: NonNullable<Chamado['communicationHistory']>[number]) {
  const ref = doc(db, 'chamados', ticketId);
  const snapshot = await getDoc(ref);
  const history = (snapshot.data()?.communicationHistory || []) as NonNullable<Chamado['communicationHistory']>;
  await updateDoc(ref, { communicationHistory: [...history, entry], updatedAt: new Date().toISOString() });
}

async function technicianContact(technicianId: string) {
  const technicianSnapshot = await getDoc(doc(db, 'tecnicos', technicianId));
  if (!technicianSnapshot.exists()) return null;
  const technician = { id: technicianSnapshot.id, ...technicianSnapshot.data() } as Tecnico;
  let user: Usuario | null = null;
  if (technician.usuarioId) {
    const direct = await getDoc(doc(db, 'usuarios', technician.usuarioId));
    if (direct.exists()) user = { id: direct.id, ...direct.data() } as Usuario;
    else {
      const matches = await getDocs(query(collection(db, 'usuarios'), where('id', '==', technician.usuarioId)));
      if (!matches.empty) user = { id: matches.docs[0].id, ...matches.docs[0].data() } as Usuario;
    }
  }
  const phone = digits(technician.whatsapp || technician.telefone || (user as any)?.whatsapp || (user as any)?.telefone || (user as any)?.celularWhatsapp);
  return { technician, user, phone };
}

async function ticketContext(ticket: Chamado) {
  const [clientSnapshot, unitSnapshot] = await Promise.all([
    ticket.clienteId ? getDoc(doc(db, 'clientes', ticket.clienteId)) : null,
    ticket.unidadeId ? getDoc(doc(db, 'unidades', ticket.unidadeId)) : null
  ]);
  return {
    client: clientSnapshot?.exists() ? ({ id: clientSnapshot.id, ...clientSnapshot.data() } as Cliente) : ticket.cliente,
    unit: unitSnapshot?.exists() ? ({ id: unitSnapshot.id, ...unitSnapshot.data() } as Unidade) : ticket.unidade
  };
}

export async function notifyAssignedTechnician(ticket: Chamado) {
  if (!ticket.id || !ticket.tecnicoId) return { success: false, skipped: true, reason: 'Técnico não vinculado.' };
  const contact = await technicianContact(ticket.tecnicoId);
  if (!contact?.phone) {
    await appendHistory(ticket.id, { type: 'whatsapp_tecnico', status: 'error', createdAt: new Date().toISOString(), error: 'Técnico sem WhatsApp cadastrado.' });
    return { success: false, skipped: true, reason: 'Técnico sem WhatsApp cadastrado.' };
  }
  const { client, unit } = await ticketContext(ticket);
  const deadline = ticket.slaDeadline ? new Date(ticket.slaDeadline).toLocaleString('pt-BR') : 'Não informado';
  const number = ticket.protocolo || `CH-${ticket.id.slice(-6).toUpperCase()}`;
  const message = [
    '🔧 Novo chamado vinculado a você', '', `Chamado: #${number}`,
    `Cliente: ${client?.nomeFantasia || client?.razaoSocial || ticket.clienteNome || 'Não informado'}`,
    `Título: ${ticket.titulo}`, `Prioridade: ${ticket.prioridade}`, `Data/SLA: ${deadline}`,
    unit?.nome ? `Unidade: ${unit.nome}` : '', `Responsável: ${contact.technician.nome}`, '',
    'Acesse o Meu Mundo CRM para visualizar os detalhes.'
  ].filter(Boolean).join('\n');
  try {
    const result: any = await whatsappService.sendMessage(contact.phone, message, 'Meu Mundo CRM', { ticketId: ticket.id });
    await appendHistory(ticket.id, { type: 'whatsapp_tecnico', status: 'sent', createdAt: new Date().toISOString(), destinationMasked: maskPhone(contact.phone), messageId: result?.messageId || '' });
    return { success: true, messageId: result?.messageId || '' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Falha no envio.';
    await appendHistory(ticket.id, { type: 'whatsapp_tecnico', status: 'error', createdAt: new Date().toISOString(), destinationMasked: maskPhone(contact.phone), error: reason });
    return { success: false, error: reason };
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function requestTicketSatisfaction(ticket: Chamado) {
  if (!ticket.id || ticket.satisfactionSurveyStatus === 'answered' || ticket.satisfactionRequestedAt) return { success: false, skipped: true, reason: 'Pesquisa já solicitada ou respondida.' };
  const { client } = await ticketContext(ticket);
  const phone = digits(client?.celularWhatsapp || client?.telefoneFixo);
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
  const tokenHash = await sha256(token);
  const link = `${window.location.origin}/avaliar-chamado?token=${encodeURIComponent(token)}`;
  const number = ticket.protocolo || `CH-${ticket.id.slice(-6).toUpperCase()}`;
  const clientName = client?.nomeFantasia || client?.razaoSocial || ticket.clienteNome || 'Cliente';
  const technicianName = ticket.tecnico?.nome || 'Equipe Mundo Tech';
  const message = `Olá, ${clientName}.\n\nO chamado #${number} foi concluído pela Mundo Tech.\n\nSua opinião é importante para nós. Avalie o atendimento pelo link seguro (leva menos de 1 minuto):\n${link}`;
  const email = String(client?.emailPrincipal || client?.emailTecnico || client?.emailFinanceiro || '').trim();
  await updateDoc(doc(db, 'chamados', ticket.id), { satisfactionTokenHash: tokenHash, satisfactionSurveyStatus: 'pending', satisfactionRequestedAt: new Date().toISOString(), satisfactionTechnicianId: ticket.tecnicoId || '', satisfactionTechnicianName: technicianName, satisfactionClientName: clientName, satisfactionOrigin: email && phone ? 'email_and_whatsapp' : email ? 'email' : 'whatsapp' });

  let emailSent = false;
  let whatsappSent = false;
  const errors: string[] = [];
  if (email) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Sessão autenticada indisponível para envio do e-mail.');
      const response = await fetch('/api/support/satisfaction-email', { method: 'POST', headers: { Authorization: `Bearer ${await currentUser.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ticketId: ticket.id, token }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) throw new Error(body.error || `Falha HTTP ${response.status} no envio do e-mail.`);
      emailSent = true;
      await appendHistory(ticket.id, { type: 'satisfaction_email', status: 'sent', createdAt: new Date().toISOString(), destinationMasked: body.destination || 'e-mail protegido' });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha no envio do e-mail.';
      errors.push(reason);
      await appendHistory(ticket.id, { type: 'satisfaction_email', status: 'error', createdAt: new Date().toISOString(), error: reason });
    }
  } else {
    errors.push('Cliente sem e-mail cadastrado.');
    await appendHistory(ticket.id, { type: 'satisfaction_email', status: 'error', createdAt: new Date().toISOString(), error: 'Cliente sem e-mail cadastrado.' });
  }

  if (phone) {
    try {
      const result: any = await whatsappService.sendMessage(phone, message, 'Meu Mundo CRM', { satisfactionSurvey: true, ticketId: ticket.id, clientId: ticket.clienteId });
      whatsappSent = true;
      await appendHistory(ticket.id, { type: 'satisfaction_survey', status: 'sent', createdAt: new Date().toISOString(), destinationMasked: maskPhone(phone), messageId: result?.messageId || '' });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha no envio via WhatsApp.';
      errors.push(reason);
      await appendHistory(ticket.id, { type: 'satisfaction_survey', status: 'error', createdAt: new Date().toISOString(), destinationMasked: maskPhone(phone), error: reason });
    }
  } else {
    errors.push('Cliente sem WhatsApp cadastrado.');
    await appendHistory(ticket.id, { type: 'satisfaction_survey', status: 'error', createdAt: new Date().toISOString(), error: 'Cliente sem WhatsApp cadastrado.' });
  }
  if (!emailSent && !whatsappSent) await updateDoc(doc(db, 'chamados', ticket.id), { satisfactionSurveyStatus: 'send_failed' });
  return { success: emailSent || whatsappSent, emailSent, whatsappSent, error: errors.join(' ') || undefined };
}
