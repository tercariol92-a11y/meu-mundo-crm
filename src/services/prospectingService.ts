import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc,
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from './resilientFirestoreClient';
import { db } from '../firebase';
import { Lead } from '../types';

export interface ProspectResult {
  id: string;
  nome: string;
  telefone: string;
  whatsapp: string;
  site: string;
  endereco: string;
  categoria: string;
  avaliacoes: {
    rating: number;
    reviewsCount: number;
  };
  linkMaps: string;
  cnpj?: string;
}

export interface ProspectCampaign {
  id?: string;
  nome: string;
  segmento: string;
  cidade: string;
  palavraChave: string;
  limiteLeads: number;
  canalEnvio: 'WhatsApp' | 'E-mail' | 'Ambos';
  leadsContatados: number;
  mensagensEnviadas: number;
  respostasRecebidas: number;
  oportunidadesCriadas: number;
  status: 'Ativa' | 'Pausada' | 'Finalizada';
  createdAt?: any;
}

export interface ProspectAutomation {
  id?: string;
  gatilho: string;
  enviarMensagemImediata: boolean;
  mensagemTemplate: string;
  delayMinutos: number;
  criarOportunidade: boolean;
  criarTarefaComercial: boolean;
  ativa: boolean;
}

export interface ProspectLog {
  id?: string;
  titulo: string;
  descricao: string;
  tipo: 'info' | 'success' | 'warning' | 'error';
  createdAt?: any;
}

export interface MessageLog {
  id?: string;
  leadId: string;
  leadNome: string;
  telefone: string;
  mensagem: string;
  status: 'enviado' | 'entregue' | 'lido' | 'respondeu';
  tipo: 'whatsapp' | 'email';
  createdAt?: any;
}

async function handleResponseJson(response: Response, defaultErrorMessage = 'Ocorreu um erro no servidor') {
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || defaultErrorMessage);
      }
      return data;
    } catch (e: any) {
      if (!response.ok) {
        throw new Error(defaultErrorMessage);
      }
      throw e;
    }
  } else {
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      throw new Error(text || `${defaultErrorMessage} (Status ${response.status})`);
    }
    throw new Error('Resposta do servidor não está em formato JSON válido.');
  }
}

function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "********";
  return `${key.substring(0, 4)}****************${key.substring(key.length - 4)}`;
}

export const prospectingService = {
  /**
   * Searches businesses in a segment and city using the backend API route.
   */
  async searchGoogleMaps(segment: string, city: string, pageToken?: string): Promise<{ results: ProspectResult[]; nextPageToken: string }> {
    try {
      const response = await fetch('/api/prospect/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ segment, city, pageToken }),
      });

      const data = await handleResponseJson(response, 'Erro na API de busca');
      return {
        results: data.results || [],
        nextPageToken: data.nextPageToken || ''
      };
    } catch (error) {
      console.error('Erro ao buscar empresas do Google Maps:', error);
      throw error;
    }
  },

  /**
   * Imports high-fidelity search Results to CRM prospectionLeads collection
   * and triggers active automations if configured.
   */
  async importToLeads(
    places: ProspectResult[], 
    responsibleId: string
  ): Promise<{ importedIdList: string[], skippedCount: number }> {
    try {
      // 1. Fetch existing leads to check for duplicates under prospectionLeads
      const leadsSnap = await getDocs(collection(db, 'prospectionLeads'));
      const existingLeads = leadsSnap.docs.map(d => {
        const data = d.data();
        return {
          nome: (data.nome || '').toLowerCase().trim(),
          cidade: (data.cidade || '').toLowerCase().trim(),
          telefone: (data.telefone || '').replace(/\D/g, ''),
          whatsapp: (data.whatsapp || '').replace(/\D/g, ''),
          cnpj: (data.cnpj || '').replace(/\D/g, '').trim(),
          site: (data.site || '').toLowerCase().trim(),
        };
      });

      const importedIdList: string[] = [];
      let skippedCount = 0;

      // 2. Load current automation config to see if we trigger automatically
      const automations = await this.getAutomations();
      const activeAutomation = automations.find(a => a.ativa);

      for (const p of places) {
        const cleanPhone = (p.telefone || '').replace(/\D/g, '');
        const cleanWhatsapp = (p.whatsapp || '').replace(/\D/g, '');
        const nameLower = (p.nome || '').toLowerCase().trim();
        const cityLower = (p.endereco?.split(' - ')[1]?.split(',')[0] || '').toLowerCase().trim();
        const siteLower = (p.site || '').toLowerCase().trim();
        const cnpjClean = (p.cnpj || '').replace(/\D/g, '').trim();

        // Avoid duplication by phone, CNPJ, website or name + city
        const isDuplicate = existingLeads.some(l => {
          if (cleanPhone && (l.telefone === cleanPhone || l.whatsapp === cleanPhone)) return true;
          if (cleanWhatsapp && (l.telefone === cleanWhatsapp || l.whatsapp === cleanWhatsapp)) return true;
          if (siteLower && l.site && l.site === siteLower) return true;
          if (cnpjClean && l.cnpj && l.cnpj === cnpjClean) return true;
          if (l.nome === nameLower && l.cidade === cityLower) return true;
          return false;
        });

        if (isDuplicate) {
          skippedCount++;
          continue;
        }

        // Add lead to prospectionLeads
        const leadObj: Omit<Lead, 'id'> = {
          nome: p.nome || 'Empresa sem nome',
          empresa: p.nome || 'Empresa sem nome',
          telefone: p.telefone || 'Telefone não encontrado',
          whatsapp: p.whatsapp || '',
          cidade: p.endereco?.split(' - ')[1]?.split(',')[0]?.trim() || cityLower || '',
          estado: 'SP', // Default
          origem: 'Prospecção - Google Maps',
          interesse: `Automação Comercial: ${p.categoria || 'Geral'}`,
          responsavelId: responsibleId,
          status: 'Novo',
          observacoes: `Captado do Google Maps.\nCategoria: ${p.categoria || 'Não informada'}\nAvaliação: ⭐ ${p.avaliacoes?.rating ?? 'Sem avaliação'} (${p.avaliacoes?.reviewsCount ?? 0} avaliações)\nWebsite: ${p.site || 'Site não encontrado'}\nLink Maps: ${p.linkMaps || ''}`,
        };

        const docRef = await addDoc(collection(db, 'prospectionLeads'), {
          ...leadObj,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        const newLeadId = docRef.id;
        importedIdList.push(newLeadId);

        // Save trace in prospecção log
        await this.createLog(
          'Lead Importado', 
          `O lead "${p.nome}" (${p.categoria}) foi importado para o CRM.`, 
          'success'
        );

        // 3. Trigger Active Automation
        if (activeAutomation && activeAutomation.enviarMensagemImediata) {
          await this.triggerAutomationForLead(newLeadId, p.nome, p.telefone, activeAutomation);
        }
      }

      return { importedIdList, skippedCount };
    } catch (error) {
      console.error('Erro ao importar leads:', error);
      throw error;
    }
  },

  /**
   * Helper function to send WhatsApp messages and synchronize with CRM 'leads', 
   * 'conversations', 'whatsapp_chats' and 'whatsapp_messages' collections for real-time central Atendimento.
   */
  async sendWhatsAppMessage(
    leadId: string,
    leadNome: string,
    phone: string,
    text: string,
    attendant: string = 'Jefferson'
  ) {
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const normalizedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

      // 1. Send the actual WhatsApp message by invoking the API endpoint
      try {
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            telefone: normalizedPhone,
            mensagem: text.trim(),
            atendente: attendant
          })
        });
      } catch (apiErr) {
        console.warn('WhatsApp API deliver simulation:', apiErr);
      }

      // 2. Establish sync/fallback by directly populating CRM 'leads' so it appears in Atendimento Central
      const qLeads = query(collection(db, 'leads'), where('whatsapp', '==', normalizedPhone));
      const snapLeads = await getDocs(qLeads);

      let leadDocId = '';
      const timestamp = serverTimestamp();

      if (!snapLeads.empty) {
        leadDocId = snapLeads.docs[0].id;
        await updateDoc(doc(db, 'leads', leadDocId), {
          ultimaMensagem: text,
          updatedAt: timestamp,
          status: 'Em atendimento'
        });
      } else {
        // Create matching lead document under CRM leads collection with normalized phone as ID
        leadDocId = normalizedPhone;
        await setDoc(doc(db, 'leads', leadDocId), {
          nome: leadNome,
          whatsapp: normalizedPhone,
          telefone: phone,
          status: 'Em atendimento',
          origem: 'WhatsApp - Prospecção',
          ultimaMensagem: text,
          updatedAt: timestamp,
          createdAt: timestamp,
          unreadCount: 0,
          responsavelId: attendant
        });
      }

      // 3. Save message under the subcollection (leads/{leadDocId}/messages)
      const messagesRef = collection(db, 'leads', leadDocId, 'messages');
      await addDoc(messagesRef, {
        telefone: normalizedPhone,
        phone: normalizedPhone,
        direction: 'out',
        fromMe: true,
        body: text,
        mensagem: text,
        type: 'text',
        status: 'sent',
        timestamp: timestamp,
        createdAt: timestamp,
        atendente: attendant,
        sender: attendant
      });

      // 4. Save to root 'conversations' collection for GlobalDataContext UI synchronization
      const convRef = doc(db, 'conversations', leadDocId);
      await setDoc(convRef, {
        id: leadDocId,
        phone: normalizedPhone,
        telefone: phone,
        contactName: leadNome,
        leadId: leadDocId,
        channel: 'whatsapp',
        status: 'em_atendimento',
        lastMessageAt: new Date().toISOString(),
        lastMessageBody: text,
        lastMessageDirection: 'outbound',
        lastMessageStatus: 'sent',
        unreadCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignedTo: attendant
      }, { merge: true });

      // 5. Save to root 'whatsapp_chats' collection for absolute backup
      const chatRef = doc(db, 'whatsapp_chats', leadDocId);
      await setDoc(chatRef, {
        chatId: leadDocId,
        phone: normalizedPhone,
        name: leadNome,
        lastMessage: text,
        lastMessageAt: timestamp,
        status: 'Em atendimento',
        updatedAt: timestamp
      }, { merge: true });

      // 6. Save to root 'whatsapp_messages' for extra robustness
      await addDoc(collection(db, 'whatsapp_messages'), {
        conversationId: leadDocId,
        telefone: normalizedPhone,
        direction: 'out',
        fromMe: true,
        body: text,
        mensagem: text,
        status: 'sent',
        timestamp: timestamp,
        createdAt: timestamp,
        atendente: attendant
      });

      return { success: true };
    } catch (e) {
      console.error('Error in sendWhatsAppMessage helper:', e);
      return { success: false, error: e };
    }
  },

  /**
   * Core logic to run automation on a newly imported lead
   */
  async triggerAutomationForLead(
    leadId: string, 
    leadName: string, 
    phone: string, 
    automation: ProspectAutomation,
    attendant: string = 'Jefferson'
  ) {
    try {
      const personalizedMsg = automation.mensagemTemplate
        .replace(/\{\{NOME_EMPRESA\}\}/g, leadName)
        .replace(/\{\{SEGMENTO\}\}/g, 'Parceiro')
        .replace(/\{\{CIDADE\}\}/g, 'sua cidade');

      // Create log for outgoing WhatsApp trigger inside prospectionMessages
      await addDoc(collection(db, 'prospectionMessages'), {
        leadId,
        leadNome: leadName,
        telefone: phone,
        mensagem: personalizedMsg,
        status: 'enviado',
        tipo: 'whatsapp',
        createdAt: new Date().toISOString()
      });

      // Synchronize and send real-time Central Atendimento message
      await this.sendWhatsAppMessage(leadId, leadName, phone, personalizedMsg, attendant);

      await this.createLog(
        'Automação Disparada', 
        `WhatsApp enviado para "${leadName}".`, 
        'info'
      );
    } catch (error) {
      console.error('Erro na automação do lead:', error);
    }
  },

  async updateLeadStatus(leadId: string, status: any) {
    try {
      await updateDoc(doc(db, 'prospectionLeads', leadId), { status, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error(e);
    }
  },

  async incrementCampaignStat(leadName: string, stat: 'mensagens' | 'respostas' | 'oportunidades') {
    try {
      const q = query(collection(db, 'prospectionCampaigns'), where('status', '==', 'Ativa'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const activeCampaign = snap.docs[0];
        const data = activeCampaign.data();
        const updateData: any = {};
        if (stat === 'mensagens') updateData.mensagensEnviadas = (data.mensagensEnviadas || 0) + 1;
        if (stat === 'respostas') updateData.respostasRecebidas = (data.respostasRecebidas || 0) + 1;
        if (stat === 'oportunidades') updateData.oportunidadesCriadas = (data.oportunidadesCriadas || 0) + 1;
        
        await updateDoc(activeCampaign.ref, updateData);
      }
    } catch (e) {
      console.error(e);
    }
  },

  /**
   * Campaign management services
   */
  async getCampaigns(): Promise<ProspectCampaign[]> {
    try {
      const snap = await getDocs(collection(db, 'prospectionCampaigns'));
      return snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          nome: data.nome,
          segmento: data.segmento,
          cidade: data.cidade,
          palavraChave: data.palavraChave || '',
          limiteLeads: data.limiteLeads || 0,
          canalEnvio: data.canalEnvio || 'WhatsApp',
          leadsContatados: data.leadsContatados || 0,
          mensagensEnviadas: data.mensagensEnviadas || 0,
          respostasRecebidas: data.respostasRecebidas || 0,
          oportunidadesCriadas: data.oportunidadesCriadas || 0,
          status: data.status,
          createdAt: data.createdAt
        };
      });
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async createCampaign(campaign: Omit<ProspectCampaign, 'id'>): Promise<ProspectCampaign> {
    const docRef = await addDoc(collection(db, 'prospectionCampaigns'), {
      ...campaign,
      createdAt: serverTimestamp()
    });
    return { id: docRef.id, ...campaign };
  },

  async updateCampaign(id: string, campaign: Partial<ProspectCampaign>) {
    await updateDoc(doc(db, 'prospectionCampaigns', id), campaign);
  },

  /**
   * Automations Configuration services
   */
  async getAutomations(): Promise<ProspectAutomation[]> {
    try {
      const snap = await getDocs(collection(db, 'prospectionAutomations'));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProspectAutomation));
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async saveAutomation(id: string, automation: Partial<ProspectAutomation>) {
    await updateDoc(doc(db, 'prospectionAutomations', id), automation);
    await this.createLog(
      'Configuração Salva', 
      `Automação de prospecção foi atualizada: "${automation.ativa ? 'Ativada' : 'Desativada'}".`, 
      'info'
    );
  },

  /**
   * Message Log services
   */
  async getMessageLogs(): Promise<MessageLog[]> {
    try {
      const snap = await getDocs(collection(db, 'prospectionMessages'));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageLog))
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async sendManualWhatsApp(leadId: string, leadNome: string, phone: string, text: string, attendant: string = 'Jefferson') {
    try {
      await addDoc(collection(db, 'prospectionMessages'), {
        leadId,
        leadNome,
        telefone: phone,
        mensagem: text,
        status: 'enviado',
        tipo: 'whatsapp',
        createdAt: new Date().toISOString()
      });

      // Synchronize and send real-time Central Atendimento message
      await this.sendWhatsAppMessage(leadId, leadNome, phone, text, attendant);

      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: e };
    }
  },

  /**
   * Message templates (WhatsApp and Email)
   */
  async getTemplates(): Promise<Array<{ id: string, name: string, type: 'whatsapp' | 'email', body: string }>> {
    try {
      const snap = await getDocs(collection(db, 'prospectionTemplates'));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async createTemplate(name: string, type: 'whatsapp' | 'email', body: string) {
    const docRef = await addDoc(collection(db, 'prospectionTemplates'), { name, type, body });
    return { id: docRef.id, name, type, body };
  },

  /**
   * Audit logs and operation history
   */
  async getLogs(): Promise<ProspectLog[]> {
    try {
      const snap = await getDocs(collection(db, 'prospectionLogs'));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProspectLog))
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async createLog(titulo: string, descricao: string, tipo: 'info' | 'success' | 'warning' | 'error' = 'info') {
    try {
      await addDoc(collection(db, 'prospectionLogs'), {
        titulo,
        descricao,
        tipo,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error('Erro ao salvar log de prospecção:', e);
    }
  },

  async getLeads(): Promise<Lead[]> {
    try {
      const snap = await getDocs(collection(db, 'prospectionLeads'));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
    } catch (e) {
      console.error('Erro ao buscar leads de prospecção:', e);
      return [];
    }
  },

  async getGoogleMapsKeyStatus(): Promise<{ configured: boolean; maskedKey: string; status: string; error?: string }> {
    try {
      // 1. Direct Firestore read check (system_settings/integrations)
      const docRef = doc(db, 'system_settings', 'integrations');
      const docSnap = await getDoc(docRef).catch(() => null);
      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        const key = data?.googleMapsPlatformKey || "";
        if (key) {
          return {
            configured: true,
            maskedKey: maskApiKey(key),
            status: data?.status || 'API configurada',
            error: data?.error || ''
          };
        }
      }

      // 2. Legacy fallback check (configs/google_maps)
      const legacyRef = doc(db, 'configs', 'google_maps');
      const legacySnap = await getDoc(legacyRef).catch(() => null);
      if (legacySnap && legacySnap.exists()) {
        const data = legacySnap.data();
        const key = data?.key || "";
        if (key) {
          return {
            configured: true,
            maskedKey: maskApiKey(key),
            status: data?.status || 'API configurada',
            error: data?.error || ''
          };
        }
      }

      // 3. Fallback server API request
      try {
        const response = await fetch('/api/config/google-maps-key-status');
        return await handleResponseJson(response, 'Falha ao buscar status da API de mapas');
      } catch (e: any) {
        // Safe silence info
      }

      return { configured: false, maskedKey: '', status: 'Sem configuração', error: '' };
    } catch (e: any) {
      console.error(e);
      return { configured: false, maskedKey: '', status: 'Sem configuração', error: e.message };
    }
  },

  async saveGoogleMapsKey(key: string, updatedBy?: string, userRole?: string): Promise<{ success: boolean; maskedKey: string; status: string; error?: string }> {
    try {
      // 1. Validate permissions
      if (userRole !== 'admin') {
        return { success: false, maskedKey: '', status: 'Erro ao salvar', error: 'Apenas administradores podem salvar ou alterar esta chave.' };
      }

      const trimmedKey = key.trim();

      // 2. Save directly to Firestore (system_settings/integrations)
      const docRef = doc(db, 'system_settings', 'integrations');
      await setDoc(docRef, {
        googleMapsPlatformKey: trimmedKey,
        status: trimmedKey ? 'API configurada' : 'Sem configuração',
        error: '',
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy || "admin"
      }, { merge: true });

      // 3. Save into legacy configs/google_maps doc for compatibility
      try {
        const legacyRef = doc(db, 'configs', 'google_maps');
        await setDoc(legacyRef, {
          key: trimmedKey,
          maskedKey: maskApiKey(trimmedKey),
          status: trimmedKey ? 'API configurada' : 'Sem configuração',
          error: '',
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (legacyErr) {
        console.warn("Could not save to legacy config doc:", legacyErr);
      }

      // 4. Try legacy API endpoint fallback silently in case server is alive
      try {
        await fetch('/api/config/save-google-maps-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, updatedBy, userRole })
        }).catch(() => null);
      } catch (e) {}

      return {
        success: true,
        maskedKey: maskApiKey(trimmedKey),
        status: trimmedKey ? 'API configurada' : 'Sem configuração',
        error: ''
      };
    } catch (e: any) {
      console.error(e);
      return { success: false, maskedKey: '', status: 'Erro ao salvar', error: e.message || 'Erro ao conectar ou gravar no Firestore.' };
    }
  },

  async testGoogleMapsKey(): Promise<{ success: boolean; status: string; error?: string }> {
    try {
      // 1. Try server verification first
      try {
        const response = await fetch('/api/config/test-google-maps-key', { method: 'POST' });
        if (response.ok) {
          const res = await handleResponseJson(response, 'Falha ao testar chave de API');
          return res;
        }
      } catch (backendErr) {
        console.warn("Backend test failed, attempting client-side validation:", backendErr);
      }

      // 2. Read current key from Firestore directly
      const docRef = doc(db, 'system_settings', 'integrations');
      const docSnap = await getDoc(docRef);
      let key = "";
      if (docSnap.exists()) {
        key = docSnap.data()?.googleMapsPlatformKey || "";
      }

      if (!key) {
        const legacyRef = doc(db, 'configs', 'google_maps');
        const legacySnap = await getDoc(legacyRef);
        if (legacySnap.exists()) {
          key = legacySnap.data()?.key || "";
        }
      }

      if (!key) {
        return { success: false, status: 'Sem configuração', error: 'Nenhuma chave configurada para testar.' };
      }

      // 3. Make direct call to Places API to test
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.id"
        },
        body: JSON.stringify({
          textQuery: "Google em São Paulo",
          languageCode: "pt-BR"
        })
      });

      if (response.ok) {
        const statusVal = 'API configurada';
        try {
          await setDoc(doc(db, 'system_settings', 'integrations'), {
            status: statusVal,
            error: '',
            updatedAt: serverTimestamp()
          }, { merge: true });

          await setDoc(doc(db, 'configs', 'google_maps'), {
            status: statusVal,
            error: '',
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (dbErr) {
          console.warn("Could not save success status to Firestore:", dbErr);
        }

        return { success: true, status: statusVal };
      }

      const errData = await response.json().catch(() => ({}));
      const errMessage = errData?.error?.message || `Google Places API returned status ${response.status}`;
      const statusVal = 'API inválida';

      try {
        await setDoc(doc(db, 'system_settings', 'integrations'), {
          status: statusVal,
          error: errMessage,
          updatedAt: serverTimestamp()
        }, { merge: true });

        await setDoc(doc(db, 'configs', 'google_maps'), {
          status: statusVal,
          error: errMessage,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (dbErr) {
        console.warn("Could not save failed status to Firestore:", dbErr);
      }

      return { success: false, status: statusVal, error: errMessage };
    } catch (e: any) {
      console.error(e);
      return { success: false, status: 'Erro ao testar', error: e.message };
    }
  },

  async getSmtpStatus(): Promise<{
    configured: boolean;
    host?: string;
    port?: number;
    secureType?: 'SSL' | 'TLS' | 'Nenhuma';
    emailRemetente?: string;
    nomeRemetente?: string;
    usuario?: string;
    maskedPassword?: string;
  }> {
    try {
      const response = await fetch('/api/config/smtp-status');
      return await handleResponseJson(response, 'Falha ao buscar status do SMTP');
    } catch (e: any) {
      console.error(e);
      return { configured: false };
    }
  },

  async saveSmtp(data: {
    host: string;
    port: number;
    secureType: 'SSL' | 'TLS' | 'Nenhuma';
    emailRemetente: string;
    nomeRemetente: string;
    usuario: string;
    senha?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/config/save-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await handleResponseJson(response, 'Falha ao salvar SMTP');
    } catch (e: any) {
      console.error(e);
      return { success: false, error: e.message };
    }
  },

  async testSmtp(data: {
    host: string;
    port: number;
    secureType: 'SSL' | 'TLS' | 'Nenhuma';
    emailRemetente: string;
    nomeRemetente: string;
    usuario: string;
    senha?: string;
    testEmail?: string;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch('/api/config/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await handleResponseJson(response, 'Falha ao testar SMTP');
    } catch (e: any) {
      console.error(e);
      return { success: false, error: e.message };
    }
  },

  async sendProspectEmail(data: {
    leadId: string;
    leadName: string;
    leadEmail: string;
    subject: string;
    body: string;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch('/api/prospect/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await handleResponseJson(response, 'Falha ao enviar e-mail via SMTP');
    } catch (e: any) {
      console.error(e);
      return { success: false, error: e.message };
    }
  }
};
