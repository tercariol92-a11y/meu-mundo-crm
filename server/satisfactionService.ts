import { FieldValue } from "firebase-admin/firestore";

const normalizePhone = (value: unknown) => String(value || "").replace(/\D/g, "");

function timestampMillis(value: any): number {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return new Date(value).getTime() || 0;
}

export function detectSatisfactionScore(value: unknown): number | null {
  const text = String(value || "").trim().toLowerCase().replace(/[.!?]+$/g, "").replace(/\s+/g, " ");
  const patterns = [
    /^([1-5])$/,
    /^([1-5])\s+(?:excelente|ótimo|otimo|muito bom|bom|regular|ruim)$/,
    /^nota\s*[:=-]?\s*([1-5])(?:\s+(?:excelente|ótimo|otimo|muito bom|bom|regular|ruim))?$/,
    /^(?:eu\s+)?dou\s+(?:nota\s+)?([1-5])(?:\s+(?:excelente|ótimo|otimo|muito bom|bom|regular|ruim))?$/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

export async function hasPendingSatisfactionRequest(db: any, phone: string, sessionOwnerUid: string) {
  const normalizedPhone = normalizePhone(phone);
  const snapshot = await db.collection("satisfaction_requests").where("normalizedPhone", "==", normalizedPhone).get();
  return snapshot.docs.some((doc: any) => {
    const data = doc.data();
    return data.status === "pending" &&
      (!data.whatsappSessionOwnerUid || data.whatsappSessionOwnerUid === sessionOwnerUid) &&
      (!timestampMillis(data.expiresAt) || timestampMillis(data.expiresAt) > Date.now());
  });
}

function acknowledgementFor(score: number) {
  if (score === 5) return "Obrigado pela sua avaliação! Ficamos muito felizes em saber que você teve uma excelente experiência com a Mundo Tech.";
  if (score === 4) return "Obrigado pela sua avaliação! Ficamos felizes com seu retorno e continuaremos buscando melhorar.";
  if (score === 3) return "Obrigado pela sua avaliação. Seu retorno é muito importante para melhorarmos nosso atendimento.";
  return "Obrigado pelo seu retorno. Sentimos que sua experiência não tenha sido a esperada. Nossa equipe irá analisar o atendimento.";
}

export async function createSatisfactionRequest(db: any, input: any) {
  const normalizedPhone = normalizePhone(input.contactPhone);
  const messageId = String(input.whatsappMessageId || "").trim();
  if (!normalizedPhone || !messageId) throw new Error("Pesquisa sem telefone ou messageId confirmado.");
  const attendanceId = input.atendimentoId || input.conversationId || input.leadId || "";
  const existingSnapshot = await db.collection("satisfaction_requests").where("normalizedPhone", "==", normalizedPhone).get();
  const existing = existingSnapshot.docs.find((document: any) => {
    const data = document.data();
    return data.attendanceId === attendanceId && (data.status === "pending" || data.status === "answered");
  });
  if (existing) return existing.id;
  const ref = db.collection("satisfaction_requests").doc(messageId);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await ref.set({
    conversationId: input.conversationId || input.leadId || "",
    leadId: input.leadId || "",
    clientId: input.clientId || "",
    clientName: input.clientName || "Contato WhatsApp",
    contactPhone: input.contactPhone,
    clientPhone: normalizedPhone,
    normalizedPhone,
    atendimentoId: attendanceId,
    attendanceId,
    ticketId: input.ticketId || "",
    assignedUserId: input.assignedUserId || "",
    assignedUserName: input.assignedUserName || "Atendente",
    technicianId: input.technicianId || "",
    technicianName: input.technicianName || "",
    profilePictureUrl: input.profilePictureUrl || "",
    whatsappSessionOwnerUid: input.whatsappSessionOwnerUid || "",
    sessionOwnerUid: input.whatsappSessionOwnerUid || "",
    whatsappMessageId: messageId,
    requestMessageId: messageId,
    companyId: input.companyId || "",
    tenantId: input.tenantId || "",
    finalizedAt: input.finalizedAt || null,
    status: "pending",
    channel: "whatsapp_qr",
    sentAt: FieldValue.serverTimestamp(),
    requestedAt: FieldValue.serverTimestamp(),
    expiresAt,
    respondedAt: null,
    score: null,
    responseMessageId: "",
    responseText: "",
    acknowledgementSent: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return ref.id;
}

export async function processSatisfactionResponse(db: any, input: {
  phone: string; sessionOwnerUid: string; messageId: string; text: string; leadId: string;
  sendAcknowledgement: (text: string) => Promise<any>;
}) {
  const score = detectSatisfactionScore(input.text);
  const normalizedPhone = normalizePhone(input.phone);
  const responseRef = db.collection("satisfactionReviews").doc(input.messageId);
  if ((await responseRef.get()).exists) {
    console.log("[SATISFACTION] Duplicate response ignored");
    return { handled: true, duplicate: true };
  }
  const snapshot = await db.collection("satisfaction_requests").where("normalizedPhone", "==", normalizedPhone).get();
  const pending = snapshot.docs
    .filter((doc: any) => {
      const data = doc.data();
      return data.status === "pending" &&
        (!data.whatsappSessionOwnerUid || data.whatsappSessionOwnerUid === input.sessionOwnerUid) &&
        (!timestampMillis(data.expiresAt) || timestampMillis(data.expiresAt) > Date.now());
    })
    .sort((a: any, b: any) => timestampMillis(b.data().sentAt) - timestampMillis(a.data().sentAt))[0];

  if (!pending) {
    console.log("[SATISFACTION] No pending survey found");
    return { handled: false };
  }
  console.log("[SATISFACTION] Pending survey found");
  if (score === null) return { handled: false };
  console.log(`[SATISFACTION] Score detected: ${score}`);

  const pendingRef = pending.ref || db.collection("satisfaction_requests").doc(pending.id);
  const requestSnapshot = await pendingRef.get();
  const responseSnapshot = await responseRef.get();
  const request = requestSnapshot.data();
  if (responseSnapshot.exists || request?.status === "answered") {
    console.log("[SATISFACTION] Duplicate response ignored");
    return { handled: true, duplicate: true };
  }
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(responseRef, {
      requestId: pending.id,
      leadId: request.leadId || input.leadId,
      clientId: request.clientId || "",
      clienteNome: request.clientName || "Contato WhatsApp",
      clientName: request.clientName || "Contato WhatsApp",
      telefone: normalizedPhone,
      clientPhone: normalizedPhone,
      profilePictureUrl: request.profilePictureUrl || "",
      nota: score,
      rating: score,
      atendenteId: request.assignedUserId || "",
      atendente: request.assignedUserName || "Atendente",
      attendantId: request.assignedUserId || "",
      attendantName: request.assignedUserName || "Atendente",
      tecnicoId: request.technicianId || "",
      tecnico: request.technicianName || "",
      technicianId: request.technicianId || "",
      technicianName: request.technicianName || "",
      atendimentoId: request.atendimentoId || "",
      conversationId: request.conversationId || "",
      ticketId: request.ticketId || "",
      comentario: String(input.text).trim(),
      channel: "whatsapp",
      source: "satisfaction_survey",
      sessionOwnerUid: request.whatsappSessionOwnerUid || input.sessionOwnerUid,
      finalizedAt: request.finalizedAt || null,
      answeredAt: now,
      responseMessageId: input.messageId,
      messageId: input.messageId,
      origem: "whatsapp_qr",
      createdAt: now,
      updatedAt: now,
    });
  batch.update(pendingRef, {
      status: "answered", score, rating: score, respondedAt: now, answeredAt: now, responseMessageId: input.messageId,
      responseText: String(input.text).trim(), acknowledgementSent: false, updatedAt: now,
    });
    if (request.leadId || input.leadId) {
      batch.set(db.collection("leads").doc(request.leadId || input.leadId), {
        pesquisaPendente: false,
        awaitingSatisfactionRating: false,
        satisfactionRating: score,
        satisfactionAnsweredAt: now,
        status: "Finalizado",
        attendanceStatus: "Finalizado",
        unreadCount: 0,
        notaSatisfacao: score,
        ultimaNotaSatisfacao: score,
        ultimaAvaliacaoEm: now,
        avaliadoEm: now,
        updatedAt: now,
      }, { merge: true });
    }
  await batch.commit();
  console.log("[SATISFACTION] Evaluation saved");
  try {
    const sent = await input.sendAcknowledgement(acknowledgementFor(score));
    await pendingRef.update({ acknowledgementSent: true, acknowledgementMessageId: sent?.messageId || sent?.key?.id || "", updatedAt: FieldValue.serverTimestamp() });
  } catch (error: any) {
    console.error(`[SATISFACTION] Falha ao enviar agradecimento: ${error?.message || "erro desconhecido"}`);
  }
  return { handled: true, score, evaluationId: input.messageId };
}

export async function recoverPendingSatisfactionResponses(
  db: any,
  sendAcknowledgement: (sessionOwnerUid: string, phone: string, text: string) => Promise<any>,
  targetPhone?: string
) {
  const requests = await db.collection("satisfaction_requests").get();
  const pendingRequests = requests.docs.filter((document: any) => document.data().status === "pending");
  for (const requestDocument of pendingRequests) {
    const request = requestDocument.data();
    if (targetPhone && normalizePhone(request.normalizedPhone || request.clientPhone) !== normalizePhone(targetPhone)) continue;
    if (!request.leadId || !request.normalizedPhone) continue;
    const messages = await db.collection("leads").doc(request.leadId).collection("messages").get();
    const requestedAt = timestampMillis(request.requestedAt || request.sentAt);
    const candidates = messages.docs
      .map((document: any) => ({ id: document.id, ...document.data() }))
      .filter((message: any) => {
        const text = message.body || message.mensagem || "";
        const receivedAt = timestampMillis(message.timestamp || message.createdAt);
        return message.fromMe === false && detectSatisfactionScore(text) !== null && (!requestedAt || !receivedAt || receivedAt >= requestedAt);
      })
      .sort((a: any, b: any) => timestampMillis(a.timestamp || a.createdAt) - timestampMillis(b.timestamp || b.createdAt));
    const response = candidates[0];
    if (!response) continue;
    const messageId = response.messageId || response.metaMessageId || response.id;
    console.log(`[SATISFACTION] Recovering persisted response; requestId=${requestDocument.id}; messageId=${messageId}`);
    await processSatisfactionResponse(db, {
      phone: request.normalizedPhone,
      sessionOwnerUid: request.whatsappSessionOwnerUid || request.sessionOwnerUid || "",
      messageId,
      text: response.body || response.mensagem || "",
      leadId: request.leadId,
      sendAcknowledgement: text => sendAcknowledgement(
        request.whatsappSessionOwnerUid || request.sessionOwnerUid || "",
        request.normalizedPhone,
        text
      )
    });
  }
}
