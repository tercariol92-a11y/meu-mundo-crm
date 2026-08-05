export interface UserData {
  id: string;
  nome: string;
  email: string;
  role: string;
  companyId?: string;
  pushToken?: string;
  tecnicoId?: string;
}

export interface Ticket {
  id: string;
  clienteId?: string;
  clienteNome?: string;
  titulo: string;
  descricao: string;
  status: 'aberto' | 'em_atendimento' | 'aguardando_peca' | 'finalizado' | 'concluido';
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  tecnicoId?: string;
  tecnicoNome?: string;
  fotos?: string[];
  createdAt: any;
  updatedAt: any;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  userId?: string;
  userName: string;
  message: string;
  internal: boolean;
  createdAt: any;
  type?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  ticketId?: string;
  createdAt: any;
}
