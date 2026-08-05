import { getDb, applyCors } from "../lib/db.js";
import { FieldValue } from "firebase-admin/firestore";
import axios from "axios";

// Helper for Phone Normalization (Meta Standard: 55 + DDD + Number)
const normalizeWhatsAppPhone = (phone) => {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  // Brazil: ensure 55 prefix for 10-11 digit numbers
  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  return digits;
};

// Helper to find or create lead by phone
const getOrCreateLead = async (db, rawPhone, contactName) => {
  const normalized = normalizeWhatsAppPhone(rawPhone);
  const leadsRef = db.collection("leads");
  
  const possibleNumbers = [rawPhone, normalized];
  const short = normalized.replace(/^55/, "");
  possibleNumbers.push(short);
  
  let leadSearch = await leadsRef.where("whatsapp", "in", possibleNumbers).limit(1).get();
  if (leadSearch.empty) {
    leadSearch = await leadsRef.where("telefone", "in", possibleNumbers).limit(1).get();
  }

  if (!leadSearch.empty) {
    return leadSearch.docs[0].id;
  }

  // Create new using normalized phone as doc ID to ensure stability
  const id = normalized;
  await leadsRef.doc(id).set({
    nome: contactName,
    whatsapp: normalized,
    status: "Novo",
    origem: "WhatsApp",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return id;
};

// Helper to send WhatsApp Template via Meta API
const sendWhatsAppTemplateMeta = async (cleanTo, templateName, params, language = "pt_BR") => {
  const TOKEN = process.env.WHATSAPP_TOKEN;
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!TOKEN || !PHONE_NUMBER_ID) {
    throw new Error("Configuração do WhatsApp Meta ausente no servidor (WHATSAPP_TOKEN ou PHONE_NUMBER_ID).");
  }

  const cleanToken = TOKEN.trim();
  const cleanPhoneId = PHONE_NUMBER_ID.trim();

  const url = `https://graph.facebook.com/v19.0/${cleanPhoneId}/messages`;
  
  const components = [];
  if (params && params.length > 0) {
    components.push({
      type: "body",
      parameters: params.map(val => ({ type: "text", text: val }))
    });
  }

  const response = await axios.post(url, {
    messaging_product: "whatsapp",
    to: cleanTo,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: language || "pt_BR"
      },
      components: components.length > 0 ? components : undefined
    },
  }, {
    headers: {
      "Authorization": `Bearer ${cleanToken}`,
      "Content-Type": "application/json",
    }
  });

  return response.data;
};

// Helper to send Gupshup Template
const sendGupshupTemplate = async (db, destination, templateNameOrAlias, params) => {
  let apiKey = process.env.GUPSHUP_API_KEY;
  let appName = process.env.GUPSHUP_APP_NAME;
  let source = process.env.GUPSHUP_SOURCE;
  let finalTemplateId = templateNameOrAlias;

  // Try to fetch from Firestore if available
  if (db) {
    try {
      const configSnap = await db.collection("whatsapp_config").limit(1).get();
      if (!configSnap.empty) {
        const config = configSnap.docs[0].data();
        if (config.apiKey) apiKey = config.apiKey;
        else if (config.token) apiKey = config.token;
        
        if (config.appName) appName = config.appName;
        else if (config.businessAccountId) appName = config.businessAccountId;
        
        if (config.source) source = config.source;
        else if (config.phoneNumberId) source = config.phoneNumberId;
      }

      // Resolve template alias to ID
      const templateSnap = await db.collection("whatsapp_templates").where("alias", "==", templateNameOrAlias).limit(1).get();
      if (!templateSnap.empty) {
        finalTemplateId = templateSnap.docs[0].data().id;
      } else {
        const templateNameSnap = await db.collection("whatsapp_templates").where("name", "==", templateNameOrAlias).limit(1).get();
        if (!templateNameSnap.empty) {
          finalTemplateId = templateNameSnap.docs[0].data().id;
        }
      }
    } catch (e) {
      console.error("Error fetching WhatsApp config from Firestore:", e);
    }
  }

  if (!apiKey || !appName || !source) {
    throw new Error("Configuração do Gupshup incompleta. Configure via Painel de Configurações ou variáveis de ambiente.");
  }

  const url = "https://api.gupshup.io/wa/api/v1/template/msg";
  
  const cleanDestination = destination.replace(/\D/g, "");
  const formattedDestination = cleanDestination.startsWith("55") ? cleanDestination : `55${cleanDestination}`;
  const cleanSource = source.replace(/\D/g, "");

  const data = new URLSearchParams();
  data.append("source", cleanSource);
  data.append("destination", formattedDestination);
  data.append("template", JSON.stringify({
    id: finalTemplateId,
    params: params
  }));
  data.append("appname", appName.trim());

  const response = await axios.post(url, data, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/x-www-form-urlencoded",
      "apikey": apiKey.trim()
    }
  });

  if (response.data.status === "error") {
    throw new Error(response.data.message || "Gupshup API returned an error status");
  }

  return response.data;
};

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido. Utilize POST." });
  }

  const { destination, templateName, params } = req.body || {};

  console.log(`[Serverless Send-Template] Initiating send request for ${destination}, template: ${templateName}`);

  // Initial validations
  let cleanTo = "";
  try {
    if (!destination) {
      throw new Error("número inválido");
    }
    cleanTo = normalizeWhatsAppPhone(destination);
    if (!cleanTo || cleanTo.length < 10) {
      throw new Error("número inválido");
    }
  } catch (err) {
    const db = getDb();
    if (db) {
      await db.collection("whatsapp_logs").add({
        timestamp: FieldValue.serverTimestamp(),
        type: "template",
        request: { destination, templateName, params },
        response: { error: "número inválido" },
        httpCode: 400,
        error: "número inválido",
        messageId: null,
        status: "failed"
      });
    }
    return res.status(400).json({ success: false, error: "número inválido" });
  }

  const mapWhatsAppError = (errorMessage, apiResponse) => {
    const msg = (errorMessage || "").toLowerCase();
    const resStr = JSON.stringify(apiResponse || "").toLowerCase();
    
    if (msg.includes("template nonexistent") || msg.includes("template not found") || resStr.includes("template_not_found") || resStr.includes("non-existent") || msg.includes("non-existing") || msg.includes("inexistente")) {
      return "template inexistente";
    }
    if (msg.includes("pending") || resStr.includes("pending") || msg.includes("pendente")) {
      return "template pendente";
    }
    if (msg.includes("not approved") || msg.includes("disabled") || msg.includes("rejected") || resStr.includes("disabled") || resStr.includes("not_approved") || msg.includes("não aprovado")) {
      return "template não aprovado";
    }
    if (msg.includes("alias") || msg.includes("alias not found") || msg.includes("alias não encontrado")) {
      return "alias não encontrado";
    }
    if (msg.includes("invalid number") || msg.includes("phone number") || resStr.includes("invalid parameter") || resStr.includes("invalid mobile number") || msg.includes("número inválido")) {
      return "número inválido";
    }
    if (resStr.includes("meta") || resStr.includes("facebook") || resStr.includes("graph") || msg.includes("meta")) {
      return "erro da Meta";
    }
    
    return `erro da Meta: ${errorMessage || "Erro desconhecido"}`;
  };

  try {
    const db = getDb();
    let finalTemplateName = templateName;
    let language = "pt_BR";
    let templateIdReal = "";
    let templateStatus = "APPROVED"; // Default
    let aliasFound = false;

    // Check active integration
    let integrationType = "official";
    if (db) {
      try {
        const configSnap = await db.collection("whatsapp_config").limit(1).get();
        if (!configSnap.empty) {
          integrationType = configSnap.docs[0].data().integrationType || "official";
        }
      } catch (e) {
        console.error("Error reading config for templates:", e);
      }
    }

    // Locate template in synced database
    if (db) {
      try {
        const templateSnap = await db.collection("whatsapp_templates").where("alias", "==", templateName).limit(1).get();
        if (!templateSnap.empty) {
          aliasFound = true;
          const tData = templateSnap.docs[0].data();
          templateIdReal = tData.id;
          finalTemplateName = tData.name || tData.id || templateName;
          language = tData.language || "pt_BR";
          templateStatus = tData.status || "APPROVED";
        } else {
          // Fallback search by name
          const nameSnap = await db.collection("whatsapp_templates").where("name", "==", templateName).limit(1).get();
          if (!nameSnap.empty) {
            aliasFound = true;
            const tData = nameSnap.docs[0].data();
            templateIdReal = tData.id;
            finalTemplateName = tData.name;
            language = tData.language || "pt_BR";
            templateStatus = tData.status || "APPROVED";
          }
        }
      } catch (e) {
        console.error("Error fetching template from collection:", e);
      }
    }

    // Filter templates status and map to exact requested errors
    if (!aliasFound && integrationType !== "qrcode") {
      const errorText = "alias não encontrado";
      if (db) {
        await db.collection("whatsapp_logs").add({
          timestamp: FieldValue.serverTimestamp(),
          type: "template",
          request: { destination, templateName, params },
          response: { error: errorText },
          httpCode: 400,
          error: errorText,
          messageId: null,
          status: "failed"
        });
      }
      return res.status(400).json({ success: false, error: errorText });
    }

    const normalizedStatus = (templateStatus || "").toUpperCase();
    if (normalizedStatus === "PENDING") {
      const errorText = "template pendente";
      if (db) {
        await db.collection("whatsapp_logs").add({
          timestamp: FieldValue.serverTimestamp(),
          type: "template",
          request: { destination, templateName, params },
          response: { error: errorText },
          httpCode: 400,
          error: errorText,
          messageId: null,
          status: "failed"
        });
      }
      return res.status(400).json({ success: false, error: errorText });
    } else if (normalizedStatus === "REJECTED" || normalizedStatus === "DISABLED") {
      const errorText = "template não aprovado";
      if (db) {
        await db.collection("whatsapp_logs").add({
          timestamp: FieldValue.serverTimestamp(),
          type: "template",
          request: { destination, templateName, params },
          response: { error: errorText },
          httpCode: 400,
          error: errorText,
          messageId: null,
          status: "failed"
        });
      }
      return res.status(400).json({ success: false, error: errorText });
    }

    // Uma função serverless não mantém o socket Baileys do localhost.
    // Simulação permanece estritamente opt-in para desenvolvimento.
    if (integrationType === "qrcode") {
      if (process.env.ENABLE_WHATSAPP_SIMULATOR !== "true") {
        return res.status(503).json({
          success: false,
          error: "Envio QR/Baileys indisponível nesta função serverless. Use o servidor local com a sessão QR conectada."
        });
      }
      const p = params || [];
      let mappedText = `[Notificação] Mensagem automática de template (${templateName})`;
      
      if (templateName === 'chamado_aberto') {
        mappedText = `Olá, ${p[0] || 'Cliente'}! Seu chamado foi aberto com sucesso e já está sendo analisado por nossa equipe.`;
      } else if (templateName === 'chamado_aberto_protocolo') {
        mappedText = `Olá, ${p[0] || 'Cliente'}! Seu chamado de suporte foi aberto. Protocolo: ${p[1] || ''}. Técnico responsável: ${p[2] || 'Técnico Especialista'}.`;
      } else if (templateName === 'atendimento_agendado') {
        mappedText = `Olá, ${p[0] || 'Cliente'}! Seu atendimento técnico foi agendado para o dia ${p[1] || ''} às ${p[2] || ''}.`;
      } else if (templateName === 'tecnico_a_caminho') {
        mappedText = `Olá, ${p[0] || 'Cliente'}! Nosso técnico já está a caminho do seu local. Previsão de chegada: ${p[1] || ''}.`;
      } else if (templateName === 'aguardando_retorno_cliente') {
        mappedText = `Olá, ${p[0] || 'Cliente'}! Estamos aguardando seu retorno para prosseguirmos with o atendimento.`;
      } else if (templateName === 'atendimento_finalizado') {
        mappedText = `Olá, ${p[0] || 'Cliente'}! Seu chamado/atendimento foi finalizado com sucesso.`;
      }

      if (db) {
        const timestamp = FieldValue.serverTimestamp();
        const leadId = await getOrCreateLead(db, cleanTo, p[0] || "Contato WhatsApp");
        const leadRef = db.collection("leads").doc(leadId);

        await leadRef.collection("messages").add({
          telefone: cleanTo,
          phone: cleanTo,
          mensagem: mappedText,
          body: mappedText,
          direction: "out",
          fromMe: true,
          type: "text",
          metaMessageId: "mock-qrcode-template-" + Date.now(),
          status: "sent",
          timestamp: timestamp,
          createdAt: timestamp,
          origem: "QR Code",
          sender: "Sistema CRM",
          atendente: "Sistema CRM"
        });

        await leadRef.update({
          ultimaMensagem: mappedText,
          updatedAt: timestamp,
          unreadCount: 0,
          status: "Em atendimento"
        });

        await db.collection("whatsapp_logs").add({
          timestamp: FieldValue.serverTimestamp(),
          type: "template",
          request: { destination, templateName, params },
          response: { success: true, method: "qrcode_simulated", message: mappedText },
          httpCode: 200,
          error: null,
          messageId: "mock-qrcode-template-" + Date.now(),
          status: "sent"
        });
      }

      return res.status(200).json({ success: true, method: "qrcode_simulated", message: mappedText });
    }
    
    let usedSimulation = false;
    let result = null;
    let messageId = null;
    let apiErrorMsg = "";
    let statusCode = 200;
    
    const isMetaConfigured = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

    if (isMetaConfigured) {
      try {
        result = await sendWhatsAppTemplateMeta(cleanTo, finalTemplateName, params || [], language);
        messageId = result?.messages?.[0]?.id || null;
      } catch (metaErr) {
        apiErrorMsg = metaErr.response?.data?.error?.message || metaErr.message;
        statusCode = metaErr.response?.status || 500;
        console.warn("[WhatsApp Template Meta Serverless] Actual send failed, mapping error...", apiErrorMsg);
        usedSimulation = true;
      }
    } else {
      try {
        result = await sendGupshupTemplate(db, destination, templateIdReal || templateName, params || []);
        messageId = result?.messageId || null;
      } catch (gupErr) {
        apiErrorMsg = gupErr.message;
        statusCode = gupErr.response?.status || 500;
        console.warn("[WhatsApp Template Gupshup Serverless] Actual send failed, mapping error...", apiErrorMsg);
        usedSimulation = true;
      }
    }

    if (usedSimulation) {
      const mappedError = mapWhatsAppError(apiErrorMsg, result);

      if (db) {
        await db.collection("whatsapp_logs").add({
          timestamp: FieldValue.serverTimestamp(),
          type: "template",
          request: { destination, templateName, params, resolvedTemplate: { name: finalTemplateName, id: templateIdReal } },
          response: { error: apiErrorMsg, raw: result },
          httpCode: statusCode,
          error: mappedError,
          messageId: null,
          status: "failed"
        });
      }

      return res.status(400).json({ success: false, error: mappedError });
    }

    // Core history logging on success only
    const p = params || [];
    let mappedText = `[Notificação] Template "${finalTemplateName}" enviado com sucesso.`;
    
    if (templateName === 'chamado_aberto') {
      mappedText = `Olá, ${p[0] || 'Cliente'}! Seu chamado foi aberto com sucesso e já está sendo analisado por nossa equipe.`;
    } else if (templateName === 'chamado_aberto_protocolo') {
      mappedText = `Olá, ${p[0] || 'Cliente'}! Seu chamado de suporte foi aberto. Protocolo: ${p[1] || ''}. Técnico responsável: ${p[2] || 'Técnico Especialista'}.`;
    } else if (templateName === 'atendimento_agendado') {
      mappedText = `Olá, ${p[0] || 'Cliente'}! Seu atendimento técnico foi agendado para o dia ${p[1] || ''} às ${p[2] || ''}.`;
    } else if (templateName === 'tecnico_a_caminho') {
      mappedText = `Olá, ${p[0] || 'Cliente'}! Nosso técnico já está a caminho do seu local. Previsão de chegada: ${p[1] || ''}.`;
    } else if (templateName === 'aguardando_retorno_cliente') {
      mappedText = `Olá, ${p[0] || 'Cliente'}! Estamos aguardando seu retorno para prosseguirmos com o atendimento.`;
    } else if (templateName === 'atendimento_finalizado') {
      mappedText = `Olá, ${p[0] || 'Cliente'}! Seu chamado/atendimento foi finalizado com sucesso.`;
    }

    if (db) {
      const timestamp = FieldValue.serverTimestamp();
      const leadId = await getOrCreateLead(db, cleanTo, p[0] || "Contato WhatsApp");
      const leadRef = db.collection("leads").doc(leadId);

      await leadRef.collection("messages").add({
        telefone: cleanTo,
        phone: cleanTo,
        mensagem: mappedText,
        body: mappedText,
        direction: "out",
        fromMe: true,
        type: "text",
        metaMessageId: messageId || "meta-template-" + Date.now(),
        status: "sent",
        timestamp: timestamp,
        createdAt: timestamp,
        origem: isMetaConfigured ? "API Oficial Meta" : "Gupshup",
        sender: "Sistema CRM",
        atendente: "Sistema CRM"
      });

      await leadRef.update({
        ultimaMensagem: mappedText,
        updatedAt: timestamp,
        unreadCount: 0,
        status: "Em atendimento"
      });

      await db.collection("whatsapp_logs").add({
        timestamp: FieldValue.serverTimestamp(),
        type: "template",
        request: { destination, templateName, params, resolvedTemplate: { name: finalTemplateName, id: templateIdReal } },
        response: result,
        httpCode: 200,
        error: null,
        messageId: messageId,
        status: "sent"
      });
    }

    return res.status(200).json({ success: true, result, message: mappedText });
  } catch (error) {
    console.error("Error sending WhatsApp template in serverless:", error.response?.data || error.message);
    return res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
}
