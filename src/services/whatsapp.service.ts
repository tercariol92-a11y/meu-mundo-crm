/**
 * WhatsApp Service (Frontend Proxy)
 * 
 * This service provides a clean interface for the frontend to trigger
 * WhatsApp messages via the backend API, keeping API keys secure.
 */
import { auth } from '../firebase';


export type WhatsAppTemplate = 
  | 'chamado_aberto'
  | 'chamado_aberto_protocolo'
  | 'atendimento_agendado'
  | 'tecnico_a_caminho'
  | 'aguardando_retorno_cliente'
  | 'atendimento_finalizado';

interface SendTemplateParams {
  destination: string;
  templateName: WhatsAppTemplate;
  params: string[];
}

export const whatsappService = {
  /**
   * Sends a WhatsApp template message via the backend API.
   */
  async sendTemplate({ destination, templateName, params }: SendTemplateParams) {
    try {
      // Clean phone number (remove non-digits)
      const cleanDestination = destination.replace(/\D/g, '');
      
      console.log(`Triggering WhatsApp template ${templateName} for ${cleanDestination}...`);
      
      const response = await fetch('/api/whatsapp/send-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destination: cleanDestination,
          templateName,
          params,
        }),
      });

      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const textError = await response.text();
        console.error('Non-JSON response from WhatsApp Send Template API:', textError);
        return { success: false, error: `Erro no servidor (não JSON): ${textError.substring(0, 100)}...` };
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send WhatsApp message');
      }

      return data;
    } catch (error) {
      console.error('Error in whatsappService.sendTemplate:', error);
      // We don't throw here to avoid breaking the main flow if WhatsApp fails
      return { success: false, error };
    }
  },

  /**
   * Helper to send 'chamado_aberto' template
   */
  async sendChamadoAberto(phone: string, clientName: string) {
    return this.sendTemplate({
      destination: phone,
      templateName: 'chamado_aberto',
      params: [clientName]
    });
  },

  /**
   * Helper to send 'chamado_aberto_protocolo' template
   */
  async sendChamadoAbertoComProtocolo(phone: string, clientName: string, protocol: string, technicianName: string) {
    return this.sendTemplate({
      destination: phone,
      templateName: 'chamado_aberto_protocolo',
      params: [clientName, protocol, technicianName]
    });
  },

  /**
   * Helper to send 'atendimento_agendado' template
   */
  async sendAtendimentoAgendado(phone: string, clientName: string, date: string, time: string) {
    return this.sendTemplate({
      destination: phone,
      templateName: 'atendimento_agendado',
      params: [clientName, date, time]
    });
  },

  /**
   * Helper to send 'tecnico_a_caminho' template
   */
  async sendTecnicoACaminho(phone: string, clientName: string, eta: string) {
    return this.sendTemplate({
      destination: phone,
      templateName: 'tecnico_a_caminho',
      params: [clientName, eta]
    });
  },

  /**
   * Helper to send 'aguardando_retorno_cliente' template
   */
  async sendAguardandoRetorno(phone: string, clientName: string) {
    return this.sendTemplate({
      destination: phone,
      templateName: 'aguardando_retorno_cliente',
      params: [clientName]
    });
  },

  /**
   * Helper to send 'atendimento_finalizado' template
   */
  async sendAtendimentoFinalizado(phone: string, clientName: string) {
    return this.sendTemplate({
      destination: phone,
      templateName: 'atendimento_finalizado',
      params: [clientName]
    });
  },

  /**
   * Sends a free-text message via the official Meta API
   */
  async sendMessage(
    phone: string,
    mensagem: string,
    attendant?: string,
    manualContext?: {
      attendantId?: string; attendantEmail?: string; source?: 'atendimento'; isGroup?: boolean; groupId?: string;
      satisfactionSurvey?: boolean; conversationId?: string; atendimentoId?: string; clientId?: string; ticketId?: string;
    }
  ) {
    try {
      // Clean phone number (keep only digits)
      const cleanPhone = phone.replace(/\D/g, '');
      const telefoneWhatsApp = manualContext?.isGroup ? phone.trim() : (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`);

      const idToken = await auth.currentUser?.getIdToken().catch(() => undefined);
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ 
          telefone: telefoneWhatsApp, 
          mensagem: mensagem.trim(),
          attendantName: attendant,
          attendantId: manualContext?.attendantId,
          attendantEmail: manualContext?.attendantEmail,
          manualFromAtendimento: manualContext?.source === 'atendimento',
          isGroup: Boolean(manualContext?.isGroup),
          groupId: manualContext?.groupId
          ,satisfactionSurvey: Boolean(manualContext?.satisfactionSurvey)
          ,conversationId: manualContext?.conversationId
          ,atendimentoId: manualContext?.atendimentoId
          ,clientId: manualContext?.clientId
          ,ticketId: manualContext?.ticketId
        }),
      });

      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const textError = await response.text();
        console.error('Non-JSON response from WhatsApp API:', textError);
        throw new Error(`A API retornou uma resposta inválida. O administrador foi notificado.`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao enviar WhatsApp');
      }
      
      return data;
    } catch (error) {
      console.error('Error in whatsappService.sendMessage:', error);
      throw error;
    }
  }
};
