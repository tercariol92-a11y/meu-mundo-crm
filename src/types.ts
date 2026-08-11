export type UserType = 'internal' | 'customer';
export type UserRole = 'admin' | 'tecnico' | 'vendedor' | 'financeiro' | 'suporte' | 'gerente_comercial' | 'cliente';

export interface UserPermissions {
  // Visualização de Módulos
  viewDashboard: boolean;
  viewAtendimento: boolean;
  viewAssistenciaTecnica: boolean;
  viewCadastro: boolean;
  viewComercial: boolean;
  viewClientes: boolean;
  viewProdutos: boolean;
  viewOrcamentos: boolean;
  viewOthersOrcamentos: boolean;
  viewPipeline: boolean;
  viewBling: boolean;
  
  // Ações de Orçamento
  createOrcamento: boolean;
  editOrcamento: boolean;
  deleteOrcamento: boolean;
  
  // Ações de Venda
  alterarVendedor: boolean;
  alterarStatusVenda: boolean;
  
  // Financeiro e Relatórios
  viewFinanceiro: boolean;
  viewLucro: boolean; // NOVO: Permissão exclusiva para visualizar lucro/margens
  viewComissao: boolean;
  editComissao: boolean;
  viewRelatorios: boolean;
  exportRelatorios: boolean;
  viewGestaoTarefas?: boolean;
}

export interface VinculoCargoUsuario {
  cargoId: string;
  cargoNome: string;
  isPrimary: boolean;
  assignedAt?: string;
  assignedBy?: string;
}

export interface Usuario {
  id: string;
  companyId?: string;
  tenantId?: string;
  empresaId?: string;
  nome: string;
  email: string;
  telefone?: string;
  whatsapp?: string;
  celularWhatsapp?: string;
  photoURL?: string;
  userType: 'internal';
  role: UserRole; // Role principal (estratégico)
  roles?: UserRole[]; // Múltiplas funções
  clienteId?: string; // Link to the Cliente document for portal users
  ativo: boolean;
  permissions?: UserPermissions;
  
  // Campos de Vendedor / Comissionamento
  receivesCommission?: boolean;
  commissionType?: 'none' | 'percent' | 'fixed';
  commissionRate?: number;
  commissionFixedValue?: number;
  commissionProductRate?: number;
  commissionServiceRate?: number;
  commissionMonthlyRate?: number;
  commissionAnnualRate?: number;
  monthlyGoal?: number;
  canViewCommission?: boolean;
  metaPropostas?: number;
  metaNovosClientes?: number;
  metaComissao?: number;
  
  // Antigos (mantendo para compatibilidade se necessário, mas o foco agora são os novos)
  tipoComissao?: 'nenhuma' | 'percentual' | 'fixo';
  comissaoPadrao?: number;
  valorFixoComissao?: number;
  metaMensal?: number;
  podeVerComissao?: boolean;
  
  // Vinculação com Cargo e Perfil (RH)
  cargoId?: string; // Cargo Principal (para retrocompatibilidade)
  cargoNome?: string; // Nome do Cargo Principal (para retrocompatibilidade)
  cargosVinculados?: VinculoCargoUsuario[]; // Suporte a múltiplos cargos exercidos simultaneamente
  
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerPortalUser {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  ramal?: string;
  cargo?: string;
  photoURL?: string;
  clienteId: string; // ID da empresa vinculada
  clienteNome?: string; // Nome fantasia da empresa vinculada
  equipamentosIds?: string[]; // IDs dos equipamentos vinculados
  ativo: boolean;
  userType: 'customer';
  contatoTipo?: 'RH' | 'TI' | 'Portaria' | 'Compras' | 'Administrativo' | 'Geral';
  permissoes?: {
    abrirChamado: boolean;
    visualizarChamados: boolean;
    receberNotificacoes: boolean;
    visualizarDocumentos: boolean;
  };
  
  // Novos campos para Perfil Moderno
  lastLogin?: string;
  twoFactorEnabled?: boolean;
  preferences?: {
    emailNotifications?: boolean;
    whatsappNotifications?: boolean;
    pushNotifications?: boolean;
    language?: 'pt-BR' | 'en' | 'es';
    theme?: 'light' | 'dark' | 'system';
  };
  
  createdAt?: string;
  updatedAt?: string;
}

export interface SLAConfig {
  planName: string;
  firstResponseHours: number;
  resolutionHours: number;
  workingDays: number[]; // 0=Sunday, 1=Monday...
  workingHoursStart: string; // "08:00"
  workingHoursEnd: string; // "18:00"
  supportType: 'Remoto' | 'Presencial' | 'Híbrido' | '24/7';
}

export interface Cliente {
  id: string;
  codigo?: string;
  slaConfig?: SLAConfig;
  // 1. Dados da Empresa
  razaoSocial?: string;
  nomeFantasia: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  tipoPessoa?: 'Jurídica' | 'Física';
  status: 'Ativo' | 'Inativo' | 'Bloqueado';
  logoUrl?: string;
  
  // 2. Contato Principal
  responsavelNome?: string;
  responsavelCargo?: string;
  telefoneFixo?: string;
  celularWhatsapp?: string;
  emailPrincipal?: string;
  emailFinanceiro?: string;
  emailTecnico?: string;
  searchParams?: string;
  website?: string;
  
  // 3. Endereço
  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  codigoIbge?: string;
  pais?: string;
  
  // 4. Dados Comerciais
  origemLead?: string;
  vendedorResponsavel?: string;
  segmento?: string;
  observacoesComerciais?: string;
  possuiContrato?: boolean;
  contratoNumero?: string;
  contratoInicio?: string;
  contratoVencimento?: string;
  contratoValorMensal?: number;
  slaAtendimento?: string;
  suporteAtivo?: boolean;
  
  // 5. Equipamentos e Estrutura
  usaEquipamento?: boolean;
  equipamentoTipo?: string;
  equipamentoMarca?: string;
  equipamentoModelo?: string;
  equipamentoSerie?: string;
  equipamentoQuantidade?: number;
  localInstalacao?: string;
  possuiCatraca?: boolean;
  possuiFacial?: boolean;
  possuiPonto?: boolean;
  
  // 6. Software e Integrações
  usaSoftware?: boolean;
  softwareNome?: string;
  softwareTipo?: string;
  softwareOrigem?: 'Próprio' | 'Terceiro';
  integraSenior?: boolean;
  integraTotvs?: boolean;
  integraSecullum?: boolean;
  integraOutro?: string;
  observacoesTecnicas?: string;
  
  // 7. Dados Financeiros
  formaPagamento?: string;
  diaVencimento?: number;
  financeiroResponsavel?: string;
  pagadorCpfCnpj?: string;
  banco?: string;
  chavePix?: string;
  inadimplente?: boolean;
  
  // 8. Observações Gerais
  observacoesInternas?: string;
  historicoResumido?: string;
  preferenciasAtendimento?: string;
  restricoesTecnicas?: string;
  emailsAutorizados?: string[];
  usuariosVinculados?: string[];

  proximoRetorno?: {
    data: string;
    hora?: string;
    observacao?: string;
    concluido?: boolean;
    concluidoAt?: string;
  };
  usuarioId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ClienteContatoDepartamento =
  | 'TI' | 'Compras' | 'Financeiro' | 'RH' | 'Departamento Pessoal'
  | 'Comercial' | 'Diretoria' | 'Administrativo' | 'Manutenção'
  | 'Segurança' | 'Portaria' | 'Outro';

export interface ClienteContato {
  id: string;
  clienteId: string;
  nome: string;
  cargo?: string;
  departamento?: ClienteContatoDepartamento;
  departamentoOutro?: string;
  telefone?: string;
  celularWhatsapp?: string;
  email?: string;
  ramal?: string;
  observacoes?: string;
  isPrimary: boolean;
  recebeWhatsapp?: boolean;
  recebeCobranca?: boolean;
  recebeBoleto?: boolean;
  recebeNotaFiscal?: boolean;
  recebeOrcamento?: boolean;
  recebeChamados?: boolean;
  contatoTecnico?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface Unidade {
  id: string;
  clienteId: string;
  nome: string;
  codigoUnidade?: string;
  codigoFilial?: string;
  apelidoFilial?: string;
  fusoHorario?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Tecnico {
  id: string;
  usuarioId: string;
  nome: string;
  fotoUrl?: string;
  telefone?: string;
  whatsapp?: string;
  especialidade?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Equipamento {
  id: string;
  unidadeId: string;
  nome: string;
  modelo?: string;
  numeroSerie?: string;
  dataInstalacao?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EquipamentoCliente {
  id: string;
  clienteId: string;
  unidadeId?: string;
  tipo: 'Placa' | 'Catraca' | 'Relógio de ponto' | 'Facial' | 'Outros';
  nome?: string;
  categoria?: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  patrimonio?: string;
  quantidade: number;
  firmware?: string;
  lastOnline?: string;
  localInstalacao?: string;
  observacoesTecnicas?: string;
  dataInstalacao?: string;
  dataProximaPreventiva?: string;
  dataUltimaManutencao?: string;
  tecnicoResponsavelId?: string;
  status: 'Em operação' | 'Em manutenção' | 'Com falha' | 'Parado' | 'Em análise' | 'Aguardando peça' | 'Desativado' | 'Equipamento pronto' | 'Entregue ao cliente' | 'Aguardando validação';
  createdAt?: string;
  updatedAt?: string;
  // Joins
  cliente?: Cliente;
  unidade?: Unidade;
  tecnico?: Tecnico;
}

export interface SolicitacaoEquipamento {
  id: string;
  clienteId: string;
  unidadeId: string;
  tipo: 'Placa' | 'Catraca' | 'Relógio de ponto' | 'Facial' | 'Outros';
  marca: string;
  modelo: string;
  numeroSerie: string;
  patrimonio?: string;
  dataAproximadaInstalacao: string;
  localInstalacao: string;
  adquiridoMundoTech: 'Sim' | 'Não' | 'Não sei';
  funcionando: 'Sim' | 'Não' | 'Parcialmente';
  observacoes?: string;
  fotoEquipamento?: string;
  fotoEtiqueta?: string;
  notaFiscalDoc?: string;
  status: 'Aguardando validação' | 'Aprovado' | 'Recusado' | 'Cancelado';
  justificativaRecusa?: string;
  analiseDuplicidade?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  cliente?: Cliente;
  unidade?: Unidade;
}

export interface Produto {
  id: string;
  nome: string;
  descricao?: string;
  categoria: 'Catraca' | 'Facial' | 'Ponto' | 'Software' | 'Outros';
  marca?: string;
  modelo?: string;
  custo?: number;
  margem?: number;
  valorVenda: number;
  codigo?: string;
  codigoBarras?: string;
  ativo: boolean;
  permiteVenda: boolean;
  permiteLocacao?: boolean;
  observacoes?: string;
  imageUrl?: string;
  beneficios?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ChamadoStatus = 
  | 'aberto' 
  | 'em_analise'
  | 'em_deslocamento' 
  | 'em_atendimento' 
  | 'aguardando_cliente'
  | 'aguardando_peca' 
  | 'retorno_agendado' 
  | 'finalizado' 
  | 'não_concluido'
  | 'cancelado'
  | 'concluido';
export type ChamadoOrigem = 'tecnico' | 'atendimento_interno' | 'portal_do_cliente' | 'whatsapp' | 'telefone';

export interface Chamado {
  id: string;
  protocolo?: string;
  clienteId: string;
  contatoId?: string;
  contatoNome?: string;
  contatoTelefone?: string;
  contatoEmail?: string;
  unidadeId: string;
  equipamentoId?: string;
  equipamentoClienteId?: string;
  tecnicoId?: string;
  titulo: string;
  descricao?: string;
  status: ChamadoStatus;
  statusTecnico?: 'a_caminho' | 'no_local' | 'finalizado';
  origem?: ChamadoOrigem;
  abertoPor?: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  tipoAtendimento?: 'Remoto' | 'Presencial' | 'Telefone' | 'Corretiva' | 'Preventiva' | 'Instalação' | 'Treinamento' | 'Outro';
  solucaoAplicada?: string;
  observacoesTecnicas?: string;
  checklist?: { item: string; concluido: boolean }[];
  dataInicioAtendimento?: string;
  dataTerminoAtendimento?: string;
  dataFechamento?: string;
  slaPrazo?: string;
  slaDeadline?: string; // ISO string (resolution deadline)
  slaFirstResponseDeadline?: string; // ISO string
  slaFirstResponseCompletedAt?: string; // ISO string
  slaResolutionCompletedAt?: string; // ISO string
  slaStatus?: 'within_sla' | 'warning' | 'late';
  isLate?: boolean;
  reminders?: Reminder[];
  notifications?: Notification[];
  sentToClient?: boolean;
  sentVia?: 'email' | 'whatsapp' | 'both';
  fotos?: string[];
  assinaturaCliente?: string;
  assinaturaData?: string;
  customerSignatureUrl?: string;
  customerSignaturePath?: string;
  customerSignedAt?: string;
  customerSignedBy?: string;
  customerSignatureMimeType?: 'image/png';
  pecasUtilizadas?: { nome: string; quantidade: number; valor?: number }[];
  servicoExecutado?: string;
  tempoEstimado?: string;
  valorAtendimento?: number;
  localizacao?: {
    lat: number;
    lng: number;
    timestamp?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  clienteNome?: string;
  unidadeNome?: string;
  equipamentoNome?: string;
  criadoPor?: string;
  criadoPorNome?: string;
  criadoPorEmail?: string;
  communicationHistory?: Array<{
    type: 'whatsapp_tecnico' | 'satisfaction_survey';
    status: 'sent' | 'error';
    createdAt: string;
    destinationMasked?: string;
    messageId?: string;
    error?: string;
  }>;
  sendSatisfactionSurvey?: boolean;
  satisfactionSurveyStatus?: 'pending' | 'answered' | 'send_failed';
  satisfactionTokenHash?: string;
  satisfactionRequestedAt?: string;
  satisfactionRating?: number;
  satisfactionComment?: string;
  satisfactionAnsweredAt?: string;
  satisfactionTechnicianId?: string;
  satisfactionTechnicianName?: string;
  satisfactionClientName?: string;
  satisfactionOrigin?: 'whatsapp';
  // Joins
  cliente?: Cliente;
  unidade?: Unidade;
  tecnico?: Tecnico;
  equipamentoCliente?: EquipamentoCliente;
}

export interface Reminder {
  id: string;
  type: 'abertura' | 'retorno' | 'visita' | 'fechamento';
  dateTime: string;
  responsibleId: string;
  ticketId: string;
  description?: string;
  completed: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  ticketId?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: string;
}

export interface Lead {
  id: string;
  nome: string;
  empresa?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  clienteId?: string;
  whatsappId?: string;
  cpfCnpj?: string;
  cidade?: string;
  estado?: string;
  origem?: string;
  interesse?: string;
  responsavelId?: string;
  status: 'Novo' | 'Em contato' | 'Em atendimento' | 'Aguardando cliente' | 'Resolvido' | 'Finalizado' | 'Qualificado' | 'Proposta enviada' | 'Negociação' | 'Fechado' | 'Perdido' | 'Arquivado' | 'Bloqueado';
  valorEstimado?: number;
  dataFechamento?: string;
  motivoPerdaId?: string;
  observacoes?: string;
  pesquisaPendente?: boolean;
  awaitingSatisfactionRating?: boolean;
  satisfactionSurveyStatus?: 'pending' | 'answered' | 'survey_send_failed';
  satisfactionSurveyError?: string;
  satisfactionRequestId?: string;
  satisfactionRequestMessageId?: string;
  atendimentoFinalizadoEm?: string;
  atendenteFinalizacao?: string;
  notaSatisfacao?: number;
  ultimaAvaliacaoEm?: string;
  photoURL?: string;
  photoUrl?: string;
  profilePictureUrl?: string;
  whatsappPhotoUrl?: string;
  avatarUrl?: string;
  fotoPerfil?: string;
  profilePictureUpdatedAt?: any;
  profilePictureJid?: string;
  pushName?: string;
  whatsappJid?: string;
  proximoRetorno?: {
    data: string;
    hora?: string;
    observacao?: string;
    concluido?: boolean;
    concluidoAt?: string;
  };
  ultimaMensagem?: string;
  unreadCount?: number;
  dataInteracao?: string;
  createdAt?: string;
  updatedAt?: string;
  criadoEm?: any;
}

export interface AcaoComercial {
  id: string;
  leadId?: string;
  clienteId?: string;
  tipo: 'Ligação' | 'Visita' | 'Reunião' | 'Mensagem' | 'Follow-up' | 'Outro';
  titulo?: string;
  descricao: string;
  responsavelId: string;
  data: string;
  dataInicio?: string;
  createdAt?: string;
}

export interface MotivoPerda {
  id: string;
  nome?: string;
  descricao: string;
  ativo: boolean;
  createdAt?: string;
}

export interface AgendaComercial {
  id: string;
  companyId?: string;
  leadId?: string;
  clienteId?: string;
  customerId?: string;
  customerName?: string;
  clienteNome?: string;
  titulo: string;
  title?: string;
  descricao?: string;
  description?: string;
  tipo: 'Ligação' | 'Reunião' | 'Visita' | 'Retorno' | 'Demonstração' | 'Instalação' | 'Treinamento' | 'Proposta' | 'Cobrança' | 'Outro' | 'Follow-up' | 'Retorno Proposta';
  type?: 'Ligação' | 'Reunião' | 'Visita' | 'Retorno' | 'Demonstração' | 'Instalação' | 'Treinamento' | 'Proposta' | 'Cobrança' | 'Outro' | 'Follow-up' | 'Retorno Proposta';
  data: string;
  dataHora?: string;
  dataInicio?: string;
  startAt?: any;
  endAt?: any;
  local?: string;
  address?: string;
  endereco?: string;
  phone?: string;
  telefone?: string;
  status: 'Agendado' | 'Confirmado' | 'Em andamento' | 'Concluído' | 'Cancelado' | 'Não realizado' | 'Pendente';
  priority?: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  prioridade?: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  responsavelId: string;
  responsavelNome?: string;
  responsibleUserId?: string;
  responsibleUserName?: string;
  createdByUserId?: string;
  createdByUserName?: string;
  reminderMinutes?: number;
  linkedTaskId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ItemProposta {
  produtoId: string;
  productId?: string; // Added to support specified item structure
  nome: string;
  quantidade: number;
  valorUnitario: number;
  valorOriginal?: number; // Added to store original catalog price
  valorEditado?: number; // Add for custom item price editing
  subtotal?: number; // Add subtotal field matching expected structure
  custoUnitario?: number; // Adicionado para cálculo de lucro
  total: number;
  imageUrl?: string;
  descricao?: string;
  beneficios?: string;
  tipoItem?: 'produto' | 'servico' | 'recorrencia';
  periodicidade?: 'unica' | 'mensal' | 'anual';
  desconto?: number;
  valorFinal?: number;
  migrationNeedsReview?: boolean;
}

export interface Proposta {
  id: string;
  leadId?: string;
  clienteId?: string;
  contatoId?: string;
  contatoNome?: string;
  contatoTelefone?: string;
  contatoEmail?: string;
  clienteNome?: string;
  leadNome?: string;
  titulo: string;
  valor: number;
  totalProdutos?: number;
  totalServicos?: number;
  totalMensal?: number;
  totalAnual?: number;
  investimentoInicial?: number;
  status: 'Rascunho' | 'Enviado' | 'Em negociação' | 'Aprovado' | 'Reprovado' | 'Cancelado';
  itens: ItemProposta[];
  formaPagamento?: string;
  prazoEntrega?: string;
  validadeProposta?: string;
  observacoes?: string;
  solucaoProposta?: string;
  sobreEmpresa?: string;
  diferenciais?: string;
  dataEnvio?: string;
  dataAprovacao?: string;
  vendedorId?: string;
  origin?: 'whatsapp_atendimento' | string;
  conversationId?: string;
  atendimentoId?: string;
  contactPhone?: string;
  createdFromModule?: string;
  createdByUserId?: string;
  createdByUserName?: string;
  ownerUserId?: string;
  assignedUserId?: string;
  motivoPerdaId?: string;
  proximoRetorno?: {
    data: string;
    hora?: string;
    observacao?: string;
    concluido?: boolean;
    concluidoAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  cliente?: Cliente;
  lead?: Lead;
}

export interface Meta {
  id: string;
  mes: number;
  ano: number;
  valorObjetivo: number;
  tipo: 'faturamento' | 'vendas' | 'chamados' | 'lucro' | 'margem' | 'caixa' | 'mrr';
  createdAt?: string;
  updatedAt?: string;
}

export interface Documento {
  id: string;
  clienteId: string;
  nome: string;
  url: string;
  tipo: string;
  categoria: 'Contrato' | 'Nota fiscal' | 'Garantia' | 'Foto do equipamento' | 'Evidência técnica' | 'Documento administrativo' | 'Outros';
  tamanho: number;
  enviadoPor: string;
  enviadoPorTipo: 'cliente' | 'suporte';
  atendenteId?: string;
  userId?: string;
  status: 'ativo' | 'excluido' | 'atualizado';
  ticketId?: string;
  comentarios?: {
    id: string;
    userId: string;
    userName: string;
    texto: string;
    data: string;
  }[];
  historico?: {
    acao: 'upload' | 'update' | 'delete' | 'comment';
    usuario: string;
    data: string;
    detalhes?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  nome?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: UserRole;
  clienteId?: string;
}

export interface ConfiguracaoEmpresa {
  id: string;
  nome: string;
  razaoSocial?: string;
  cnpj?: string;
  logoUrl?: string;
  website?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  sobreEmpresa?: string;
  diferenciais?: string;
  capaUrl?: string;
  updatedAt?: string;
}

export interface BlingConfig {
  id?: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  active: boolean;
  updatedAt?: string;
}

export type ViewType = 
  | 'dashboard' 
  | 'comercial-leads' 
  | 'prospeccao-buscar'
  | 'prospeccao-leads'
  | 'prospeccao-campanhas'
  | 'prospeccao-whatsapp'
  | 'prospeccao-emails'
  | 'prospeccao-automacao'
  | 'prospeccao-historico' 
  | 'comercial-clientes' 
  | 'crm-clientes'
  | 'clientes'
  | 'comercial-orcamentos' 
  | 'crm-orcamentos'
  | 'comercial-pipeline'
  | 'comercial-motivos-perda'
  | 'comercial-acoes'
  | 'comercial-agenda'
  | 'crm-agenda'
  | 'comercial-dashboard'
  | 'comercial-produtos'
  | 'comercial-configuracao-empresa'
  | 'comercial-funcionarios'
  | 'chamados' 
  | 'tecnicos' 
  | 'equipamentos'
  | 'unidades'
  | 'suporte-dashboard'
  | 'assistencia-tecnica'
  | 'equipamentos-pendentes'
  | 'atendimento'
  | 'configuracoes'
  | 'gemini-assistant'
  | 'tech-portal'
  | 'tech-chamado-detalhe'
  | 'vendedor-dashboard'
  | 'retornos'
  | 'integracao-bling'
  | 'satisfacao'
  | 'user-management'
  | 'financeiro-contas-pagar'
  | 'financeiro-faturamento'
  | 'financeiro-contratos'
  | 'gestao-tarefas'
  | 'rh-cargos-perfis';

// Interfaces de Gestão de Cargos, Perfis, Avaliações e Treinamentos (RH)
export interface CompetenciaCargo {
  id: string;
  nome: string;
  descricao?: string;
  peso?: number; // 1 a 5
}

export interface KPIConfig {
  id: string;
  nome: string;
  meta: string;
  unidade: string; // ex: "ligações/dia", "R$", "%", "chamados/dia"
  frequencia?: 'Diário' | 'Semanal' | 'Mensal';
}

export interface TreinamentoCargo {
  id: string;
  nome: string;
  descricao?: string;
  cargaHoraria?: string;
  obrigatorio: boolean;
}

export interface CargoEPerfil {
  id: string;
  nome: string; // Ex: 'Gerente', 'Vendedor', 'Suporte Técnico Interno', etc.
  area: string; // Ex: 'Comercial', 'Suporte', 'Administrativo', 'Diretoria', 'Financeiro'
  cbo?: string; // Código Brasileiro de Ocupações
  superiorImediatoId?: string;
  superiorImediatoNome?: string;
  subordinadosNomes?: string[];
  formacaoExigida: string;
  experienciaMinima: string;
  conhecimentosObrigatorios: string[];
  competencias: CompetenciaCargo[];
  responsabilidades: string[]; // Matriz de responsabilidades
  metasCargo: string[];
  sla?: string;
  kpis: KPIConfig[];
  checklistDiario: string[];
  checklistSemanal: string[];
  checklistMensal: string[];
  permissoes: UserPermissions;
  treinamentos: TreinamentoCargo[];
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ItemAvaliacaoCompetencia {
  competenciaNome: string;
  nota: number; // 1 a 10
  observacao?: string;
}

export interface AvaliacaoDesempenho {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  cargoId: string;
  cargoNome: string;
  avaliadorId: string;
  avaliadorNome: string;
  mesAno: string; // Ex: "2026-08"
  dataAvaliacao: string;
  
  // Notas padrão de 1 a 10
  comprometimento: number;
  comunicacao: number;
  pontualidade: number;
  organizacao: number;
  conhecimentoTecnico: number;
  relacionamento: number;
  produtividade: number;
  
  competenciasAvaliadas?: ItemAvaliacaoCompetencia[];
  
  notaFinalMedia: number;
  observacoesAvaliador?: string;
  pontosFortes?: string;
  pontosMelhoria?: string;
  planoAcao?: string;
  
  createdAt?: string;
  updatedAt?: string;
}

export interface TreinamentoColaborador {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  cargoId: string;
  treinamentoId: string;
  treinamentoNome: string;
  cargaHoraria?: string;
  status: 'Pendente' | 'Em andamento' | 'Concluído';
  dataInicio?: string;
  dataConclusao?: string;
  notaObtida?: number;
  certificadoUrl?: string;
  observacoes?: string;
  updatedAt?: string;
}

export interface AuditLogCargo {
  id: string;
  cargoId?: string;
  cargoNome?: string;
  usuarioId: string;
  usuarioNome: string;
  dataHora: string;
  acao: 'criacao' | 'edicao_cargo' | 'alteracao_permissao' | 'vinculacao_usuario' | 'avaliacao_criada';
  detalhes: string;
}

export type TaskType = 'checklist' | 'quantidade' | 'financeiro' | 'automatica';
export type AutoTaskTrigger = 'criar_proposta' | 'fechar_venda' | 'abrir_chamado' | 'emitir_nf';
export type TaskPriority = 'Baixa' | 'Média' | 'Alta';
export type TaskStatus = 'Pendente' | 'Em andamento' | 'Concluída' | 'Cancelada';
export type TaskRecurrence = 'Não repetir' | 'Diariamente' | 'Semanalmente' | 'Mensalmente' | 'Dias específicos';

export interface ChecklistItem {
  id: string;
  texto: string;
  concluido: boolean;
  concluidoEm?: string;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string;
  funcionarioId: string;
  funcionarioNome?: string;
  funcionarioFoto?: string;
  equipe?: string;
  tipo: TaskType;
  tipoAutomatico?: AutoTaskTrigger;
  prioridade: TaskPriority;
  dataInicial: string;
  dataFinal: string;
  horario?: string;
  repeticao: TaskRecurrence;
  diasEspecificos?: number[];
  
  // Checklist
  checklist?: ChecklistItem[];
  
  // Meta por Quantidade
  metaQuantidade?: number;
  realizadoQuantidade?: number;
  
  // Meta Financeira
  metaFinanceira?: number;
  realizadoFinanceiro?: number;
  
  // Status & Progresso
  status: TaskStatus;
  percentualConcluido: number;
  
  // Metadados
  criadoPorId?: string;
  criadoPorNome?: string;
  concluidoEm?: string;
  pontosGanhos?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModeloTarefa {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: TaskType;
  tipoAutomatico?: AutoTaskTrigger;
  prioridade: TaskPriority;
  equipe?: string;
  repeticao: TaskRecurrence;
  diasEspecificos?: number[];
  checklistPadrao?: string[];
  metaQuantidadePadrao?: number;
  metaFinanceiraPadrao?: number;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TarefaHistoricoDiario {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  data: string;
  totalTarefas: number;
  concluidas: number;
  pendentes: number;
  atrasadas: number;
  percentualConcluido: number;
  pontosDoDia: number;
  scoreProdutividade?: number;
  horasProdutivas?: number;
  tempoMedioConclusaoMinutos?: number;
  sequenciaMetas?: number;
  updatedAt?: string;
}

export interface ProductivityMetrics {
  funcionarioId: string;
  score: number;
  nivel: 'Excelente' | 'Atenção' | 'Baixa produtividade';
  total: number;
  concluidas: number;
  pendentes: number;
  atrasadas: number;
  checklistPercentual: number;
  pontos: number;
  horasProdutivas: number;
  tempoMedioConclusaoMinutos: number;
  faltamParaVerde: number;
  mensagem: string;
}

export interface PontuacaoUsuario {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  funcionarioFoto?: string;
  equipe?: string;
  pontosTotais: number;
  pontosHoje: number;
  pontosSemana: number;
  pontosMes: number;
  tarefasConcluidasHoje: number;
  propostasCriadasHoje: number;
  vendasFechadasHoje: number;
  chamadosRespondidosHoje: number;
  crmAtualizacoesHoje: number;
  posicaoRanking?: number;
  updatedAt?: string;
}

export interface TarefaLog {
  id: string;
  tarefaId: string;
  tarefaTitulo: string;
  usuarioId: string;
  usuarioNome: string;
  acao: 'criacao' | 'edicao' | 'exclusao' | 'conclusao' | 'item_checklist' | 'progresso_meta' | 'automatica_trigger';
  detalhes: string;
  createdAt: string;
}

export type ConversationStatus = 
  | 'novo' 
  | 'em_atendimento' 
  | 'aguardando_cliente' 
  | 'aguardando_interno' 
  | 'finalizado' 
  | 'arquivado'
  | 'bloqueado'
  | 'convertido_chamado' 
  | 'convertido_lead';

export interface Conversation {
  id: string;
  phone: string;
  telefone?: string;
  contactName: string;
  leadId?: string;
  clientId?: string;
  unitId?: string;
  equipmentId?: string;
  ticketId?: string;
  channel: 'whatsapp';
  status: ConversationStatus;
  assignedTo?: string;
  lastMessageAt: string;
  lastMessageBody?: string;
  lastMessageDirection?: 'inbound' | 'outbound';
  lastMessageStatus?: 'sent' | 'delivered' | 'read' | 'failed';
  lastMessageId?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  // Joins
  client?: Cliente;
  lead?: Lead;
  ticket?: Chamado;
  isGroup?: boolean;
  groupId?: string;
  remoteJid?: string;
  participantsCount?: number;
  groupPhotoUrl?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  phone?: string;
  direction: 'inbound' | 'outbound' | 'in' | 'out' | string;
  fromMe?: boolean;
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'template' | 'media_pending' | string;
  tipo?: string;
  body?: string;
  mensagem?: string;
  text?: string;
  texto?: string;
  message?: string;
  from?: string;
  atendente?: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  fileSize?: number;
  fileName?: string;
  mimetype?: string;
  duration?: number;
  thumbnailUrl?: string;
  mediaStatus?: 'processing' | 'ready' | 'error' | string;
  mediaError?: string;
  mediaType?: string;
  caption?: string;
  metaMessageId?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | string;
  timestamp: string;
  createdAt?: any;
  sender?: string;
  atendenteId?: string;
  atendenteNome?: string;
  attendantName?: string;
  attendantId?: string;
  attendantEmail?: string;
  senderType?: 'user' | 'system' | string;
  whatsappBody?: string;
  isGroup?: boolean;
  groupId?: string;
  remoteJid?: string;
  participantJid?: string;
  participantPhone?: string;
  participantName?: string;
}

export interface ImportHistory {
  id: string;
  userId: string;
  userName: string;
  type: 'clientes' | 'produtos' | 'leads' | 'equipamentos';
  fileName: string;
  totalRecords: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: { line: number; message: string }[];
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export interface ModeloMapeamento {
  id: string;
  clienteId: string;
  nome: string;
  mapeamento: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppConfig {
  id: string;
  apiKey?: string;
  token?: string;
  appName?: string;
  businessAccountId?: string;
  source?: string;
  phoneNumberId?: string;
  verifyToken?: string;
  integrationType?: 'official' | 'qrcode' | 'meta';
  whatsappProvider?: 'meta' | 'gupshup' | 'baileys';
  sessionStatus?: 'connected' | 'disconnected' | 'connecting' | 'qrcode';
  qrCodeData?: string;
  qrCodeDataUrl?: string;
  sessionPhone?: string;
  sessionName?: string;
  lastConnectedAt?: string;
  updatedAt: string;
}

export interface WhatsAppTemplate {
  id: string; // O ID real do template no Gupshup/Meta (UUID ou nome)
  name: string; // Nome legível
  alias: string; // Alias usado no código (ex: 'chamado_aberto')
  language: string;
  category: string;
  status: string;
  templateName?: string;
  templateId?: string;
  provider?: 'meta' | 'gupshup' | 'baileys';
  createdAt?: string;
  updatedAt?: string;
  lastSyncAt?: string;
  body?: string;
  variableCount?: number;
}

export interface AccessLog {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  ip: string;
  device: string;
  location?: string;
  action: 'login' | 'logout' | 'password_change' | 'preferences_update' | 'admin_password_change';
  details?: string;
}

export interface NotificationToken {
  id: string;
  userId: string;
  token: string;
  platform: 'web' | 'mobile';
  createdAt: string;
}

export interface ExpenseAttachment {
  name: string;
  size: number;
  type: string;
  url: string;
}

export type CategoryType = 'fixa' | 'variavel';

export interface AuditLog {
  action: 'create' | 'update' | 'delete';
  userId: string;
  userName: string;
  timestamp: string;
  details?: string;
}

export interface ContaPagar {
  id: string;
  descricao: string;
  categoria: string;
  categoryType: CategoryType;
  fornecedor: string;
  valor: number;
  dataVencimento: string;
  recorrenteSemVencimento?: boolean;
  dataPagamento?: string | null;
  status: 'Pendente' | 'Pago' | 'Vencido';
  observacoes?: string;
  comprovante?: ExpenseAttachment | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
  history?: AuditLog[];
}

export interface ContratoItem {
  id: string;
  tipoItem: 'Equipamento' | 'Software' | 'Serviço';
  modelo: string;
  marca?: string;
  numeroSerie?: string;
  quantidade: number;
  localId?: string;
  localNome?: string;
  valorIndividual: number;
  observacoes?: string;
}

export interface ContratoRecorrente {
  id: string;
  clienteId: string;
  clienteNome: string;
  contatoFinanceiroId?: string;
  contatoFinanceiroNome?: string;
  contatoFinanceiroEmail?: string;
  contatoFinanceiroTelefone?: string;
  unidadeId?: string;
  unidadeNome?: string;
  numeroContrato: string;
  descricaoServico: string;
  valorMensal: number;
  dataInicio: string; // ISO date YYYY-MM-DD
  dataTermino?: string; // ISO date YYYY-MM-DD
  diaFaturamento: number; // 1 to 31
  diaVencimento: number; // 1 to 31
  tipoCobranca: 'Mensal' | 'Bimestral' | 'Trimestral' | 'Semestral' | 'Anual';
  status: 'Ativo' | 'Vencendo' | 'Vencido' | 'Suspenso' | 'Encerrado';
  observacoes?: string;
  faturamentosGerados?: string[]; // e.g., ['2026-06', '2026-07'] list of billed periods (YYYY-MM)
  tipoContrato?: 'Suporte técnico' | 'Manutenção preventiva' | 'Locação de equipamentos' | 'Software' | 'Sistema de ponto' | 'Controle de acesso' | 'Outros';
  reajusteAnual?: boolean;
  indiceReajuste?: string;
  itens?: ContratoItem[];
  emitirNfseRecorrente?: boolean;
  fiscal?: {
    descricaoServico: string;
    codigoServicoMunicipal: string;
    itemLc116: string;
    cnae?: string;
    nbs?: string;
    aliquotaIss: number;
    issRetido: boolean;
    municipioPrestacao: string;
    naturezaOperacao?: string;
    declaracaoAdicional?: string;
    valorNfse: number;
    gerarBoleto: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

export type RecurringBillingStatus = 'PENDENTE' | 'PENDENCIA_CADASTRAL' | 'PRONTO_PARA_EMITIR' | 'EM_PROCESSAMENTO' | 'AUTORIZADA' | 'REJEITADA' | 'CANCELADA';

export interface FaturamentoRecorrente {
  id: string;
  logicalKey: string;
  companyId: string;
  contractId: string;
  contractNumber: string;
  clientId: string;
  clientName: string;
  competence: string;
  installment: number;
  description: string;
  expectedAmount: number;
  billingDate: string;
  dueDate: string;
  status: RecurringBillingStatus;
  missingFields: string[];
  validationIssues?: Array<{ key: string; origin: 'cliente' | 'contrato' | 'configuracao_fiscal'; label: string }>;
  environment: 'producao' | 'producao_restrita';
  takerSnapshot: Record<string, unknown>;
  fiscalSnapshot: Record<string, unknown>;
  generateBoleto: boolean;
  dpsNumber?: string;
  nfseNumber?: string;
  officialAccessKey?: string;
  authorizedAt?: string;
  sefinError?: { code?: string; message: string };
  authorizedXml?: string;
  danfseReference?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotaFiscalProduto {
  id: string;
  clienteId: string;
  clienteNome: string;
  cnpjCpf: string;
  inscricaoEstadual?: string;
  endereco: string;
  bairro?: string;
  cidade: string;
  estado: string;
  cep?: string;
  produtoId: string;
  produtoNome: string;
  ncm: string;
  cfop: string;
  cstCsosn: string;
  valorProduto: number;
  frete: number;
  impostos: {
    icmsId?: number;
    icmsValor?: number;
    ipiValor?: number;
    pisValor?: number;
    cofinsValor?: number;
    totalImpostos: number;
  };
  formaPagamento: 'Boleto' | 'Pix' | 'Cartao' | 'Dinheiro' | 'Outros';
  condicaoPagamento: 'A Vista' | '30 Dias' | '30/60 Dias' | 'Parcelado' | 'Outros';
  observacoes?: string;
  status: 'Rascunho' | 'Emitida' | 'Cancelada' | 'Rejeitada' | 'Autorizada';
  chaveAcesso?: string;
  xmlOriginal?: string;
  numeroNota: string;
  serie: string;
  dataEmissao: string;
  boletoCriadoId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotaFiscalServico {
  id: string;
  clienteId: string;
  clienteNome: string;
  municipioPrestacao: string;
  codigoServico: string;
  descricaoServico: string;
  valorServico: number;
  iss: number;
  issRetido: boolean;
  retencoes: {
    pis?: number;
    cofins?: number;
    csll?: number;
    irrf?: number;
    inss?: number;
    totalRetido: number;
  };
  dataCompetencia: string;
  observacoes?: string;
  status: 'RASCUNHO' | 'VALIDANDO' | 'PROCESSANDO' | 'AUTORIZADA' | 'REJEITADA' | 'CANCELAMENTO SOLICITADO' | 'CANCELADA' | 'ERRO' | 'Rascunho' | 'Emitida' | 'Cancelada' | 'Rejeitada' | 'Autorizada';
  numeroNota?: string;
  numeroDps?: string;
  serieDps?: string;
  codigoVerificacao?: string;
  chaveAcessoOficial?: string;
  xmlAutorizado?: string;
  xmlOriginal?: string;
  pdfUrl?: string;
  contratoId?: string;
  dataEmissao: string;
  boletoCriadoId?: string;
  reference?: string;
  provider?: 'sefin_nacional';
  providerStatus?: string;
  protocol?: string;
  xmlPath?: string;
  pdfPath?: string;
  chaveAcesso?: string;
  nfseId?: string;
  dfseNumber?: string;
  authorizationHttpStatus?: number;
  xmlAvailable?: boolean;
  danfseAvailable?: boolean;
  responsePath?: string;
  environment?: 'producao_restrita' | 'producao';
  companyId?: string;
  contractId?: string;
  competence?: string;
  serviceKind?: string;
  cancellationStatus?: 'not_requested' | 'validated_not_transmitted' | 'transmitting' | 'unknown' | 'registered' | 'rejected';
  cancellationEventId?: string;
  cancellationProtocol?: string;
  cancellationReasonCode?: '1' | '2' | '9';
  cancellationReason?: string;
  cancellationRequestedAt?: string;
  cancelledAt?: string;
  cancellationResponsePath?: string;
  discount?: number;
  totalAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BoletoBancario {
  id: string;
  clienteId: string;
  clienteNome: string;
  bancoId: string;
  bancoNome: string;
  nossoNumero: string;
  valorOriginal: number;
  valorCobrado: number;
  vencimento: string;
  dataDocumento: string;
  documentoOrigemId: string;
  documentoOrigemTipo: 'Produto' | 'Servico' | 'Avulso';
  juros: number;
  multa: number;
  desconto: number;
  status: 'Pendente' | 'Pago' | 'Vencido' | 'Cancelado';
  dataPagamento?: string;
  baixaTipo?: 'Manual' | 'Automatica';
  pdfSimuladoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContaBancaria {
  id: string;
  nomeIdentificador: string;
  banco: 'Itaú' | 'Bradesco' | 'Banco do Brasil' | 'Sicoob' | 'Sicredi' | 'Asaas' | 'Outro';
  agencia: string;
  conta: string;
  carteira: string;
  convenio: string;
  codigoBeneficiario: string;
  ativo: boolean;
  jurosPadrao: number;
  multaPadrao: number;
  descontoPadrao: number;
  instrucoesPadrao?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConfiguracaoFiscal {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  inscricaoEstadual: string;
  inscricaoMunicipal?: string;
  municipio?: string;
  codigoIbge?: string;
  optanteSimplesNacional?: boolean;
  situacaoSimplesNacional?: '1' | '2' | '3';
  situacaoSimplesNacionalCompetencia?: string;
  situacaoSimplesNacionalFonte?: string;
  codigoServicoMunicipal?: string;
  itemListaServico?: string;
  cnae?: string;
  nbs?: string;
  aliquotaIssPadrao?: number;
  provedorFiscal?: 'sefin_nacional';
  regimeTributario: 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';
  aliquotaSimplesPadrao?: number;
  certificadoDigitalNome?: string;
  certificadoVencimento?: string;
  ambiente: 'Homologação' | 'Produção';
  updatedAt?: string;
}

export interface FiscalAuditLog {
  id: string;
  userId: string;
  userName: string;
  action: 'emissao_nfe' | 'emissao_nfse' | 'consulta_nfse' | 'download_xml_nfse' | 'download_danfse_nfse' | 'impressao_nfse' | 'cancelamento_nfe' | 'cancelamento_nfse' | 'geracao_boleto' | 'baixa_boleto' | 'configuracao_alterada' | 'integracao_alterada';
  details: string;
  tipoDocumento?: 'nfe' | 'nfse' | 'boleto' | 'conta' | 'config';
  documentNumero?: string;
  createdAt?: string;
  timestamp?: any;
}
