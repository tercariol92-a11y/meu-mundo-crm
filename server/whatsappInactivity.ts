export const DEFAULT_WHATSAPP_INACTIVITY_MINUTES = 30;

export function timestampMillis(value: any): number {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function shouldAutoCloseInactiveAttendance(
  lead: Record<string, any>,
  now = Date.now(),
  inactivityMinutes = DEFAULT_WHATSAPP_INACTIVITY_MINUTES,
) {
  const status = String(lead.status || lead.attendanceStatus || '').trim().toLocaleLowerCase('pt-BR');
  if (status !== 'em atendimento') return false;
  if (lead.awaitingSatisfactionRating === true || lead.pesquisaPendente === true) return false;
  if (lead.inactivityClosingAt || lead.inactivityAutoClosedAt) return false;
  const lastMessageAt = timestampMillis(lead.lastMessageAt || lead.ultimaMensagemEm || lead.updatedAt);
  return lastMessageAt > 0 && now - lastMessageAt >= inactivityMinutes * 60_000;
}
