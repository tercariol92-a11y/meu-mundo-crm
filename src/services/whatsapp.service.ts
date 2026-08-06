/**
 * WhatsApp Service (Frontend Proxy)
 * 
 * This service provides a clean interface for the frontend to trigger
 * WhatsApp messages via the backend API, keeping API keys secure.
 */
import { whatsappApi } from './whatsappApi';


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
      
      return await whatsappApi.sendTemplate({ destination: cleanDestination, templateName, params });
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
      attendantId?: string; attendantEmail?: string; source?: 'atendimento' | 'prospeccao'; isGroup?: boolean; groupId?: string;
      satisfactionSurvey?: boolean; conversationId?: string; atendimentoId?: string; clientId?: string; ticketId?: string;
    }
  ) {
    try {
      // Clean phone number (keep only digits)
      const cleanPhone = phone.replace(/\D/g, '');
      const telefoneWhatsApp = manualContext?.isGroup ? phone.trim() : (cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`);

      return await whatsappApi.sendMessage({
          telefone: telefoneWhatsApp, 
          mensagem: mensagem.trim(),
          attendantName: attendant,
          attendantId: manualContext?.attendantId,
          attendantEmail: manualContext?.attendantEmail,
          manualFromAtendimento: manualContext?.source === 'atendimento' || manualContext?.source === 'prospeccao',
          isGroup: Boolean(manualContext?.isGroup),
          groupId: manualContext?.groupId
          ,satisfactionSurvey: Boolean(manualContext?.satisfactionSurvey)
          ,conversationId: manualContext?.conversationId
          ,atendimentoId: manualContext?.atendimentoId
          ,clientId: manualContext?.clientId
          ,ticketId: manualContext?.ticketId
      });
    } catch (error) {
      console.error('Error in whatsappService.sendMessage:', error);
      throw error;
    }
  }
};
