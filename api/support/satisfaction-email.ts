import nodemailer from 'nodemailer';
import { getAuth } from 'firebase-admin/auth';
import { createHash } from 'node:crypto';
import { getDb, getSmtpConfig } from '../lib/db.js';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const escapeHtml = (value: unknown) => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método não permitido.' });
  try {
    const db = getDb();
    if (!db) throw new Error('Banco de dados indisponível.');
    const authorization = String(req.headers?.authorization || '');
    if (!authorization.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Sessão não autenticada.' });
    await getAuth().verifyIdToken(authorization.slice(7));
    const ticketId = String(req.body?.ticketId || '').trim();
    const token = String(req.body?.token || '').trim();
    if (!ticketId || !/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ success: false, error: 'Solicitação de pesquisa inválida.' });

    const ticketSnap = await db.collection('chamados').doc(ticketId).get();
    if (!ticketSnap.exists) return res.status(404).json({ success: false, error: 'Chamado não encontrado.' });
    const ticket = ticketSnap.data() || {};
    if (ticket.satisfactionTokenHash !== hashToken(token)) return res.status(403).json({ success: false, error: 'Token da pesquisa não corresponde ao chamado.' });
    const clientSnap = ticket.clienteId ? await db.collection('clientes').doc(ticket.clienteId).get() : null;
    const client = clientSnap?.exists ? clientSnap.data() || {} : ticket.cliente || {};
    const email = String(client.emailPrincipal || client.emailTecnico || client.emailFinanceiro || '').trim();
    if (!email) return res.status(422).json({ success: false, error: 'Cliente sem e-mail cadastrado.' });

    const config = await getSmtpConfig();
    if (!config?.configured || !config.senha) return res.status(503).json({ success: false, error: 'Servidor SMTP não configurado.' });
    const secure = String(config.secureType).toUpperCase() === 'SSL';
    const transporter = nodemailer.createTransport({ host: config.host, port: config.port, secure, auth: { user: config.usuario, pass: config.senha }, requireTLS: String(config.secureType).toUpperCase() === 'TLS' });
    const protocol = ticket.protocolo || ticketId;
    const clientName = client.nomeFantasia || client.razaoSocial || ticket.clienteNome || 'Cliente';
    const link = `${String(req.headers?.origin || process.env.PUBLIC_APP_URL || 'https://meumundocrm.com.br').replace(/\/$/, '')}/avaliar-chamado?token=${encodeURIComponent(token)}`;
    await transporter.sendMail({
      from: `"${config.nomeRemetente || 'Mundo Tech'}" <${config.emailRemetente}>`, to: email,
      subject: `Como foi o atendimento do chamado #${protocol}?`,
      text: `Olá, ${clientName}. O chamado #${protocol} foi concluído. Sua opinião é importante para nós. Responda à pesquisa: ${link}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#334155"><h2 style="color:#2563eb">Mundo Tech</h2><p>Olá, <strong>${escapeHtml(clientName)}</strong>.</p><p>O chamado <strong>#${escapeHtml(protocol)}</strong> foi concluído. Sua opinião nos ajuda a melhorar continuamente.</p><p style="margin:28px 0"><a href="${escapeHtml(link)}" style="background:#16a34a;color:#fff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:bold">Responder pesquisa de satisfação</a></p><p style="font-size:12px;color:#64748b">Leva menos de 1 minuto. Link individual e de uso único.</p></div>`,
    });
    return res.status(200).json({ success: true, destination: email.replace(/^(.{2}).*(@.*)$/, '$1***$2') });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível enviar o e-mail da pesquisa.';
    console.error('[SUPPORT SATISFACTION EMAIL]', { message });
    return res.status(500).json({ success: false, error: message });
  }
}
