import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  onSnapshot 
} from './resilientFirestoreClient';
import { db } from '../firebase';
import { 
  CargoEPerfil, 
  AvaliacaoDesempenho, 
  TreinamentoColaborador, 
  AuditLogCargo,
  UserPermissions,
  Usuario
} from '../types';
import { databaseService } from './databaseService';
import { tasksService } from './tasksService';

export const DEFAULT_PERMISSIONS_BY_CARGO: Record<string, UserPermissions> = {
  'Sócio Diretor': {
    viewDashboard: true,
    viewAtendimento: true,
    viewAssistenciaTecnica: true,
    viewCadastro: true,
    viewComercial: true,
    viewClientes: true,
    viewProdutos: true,
    viewOrcamentos: true,
    viewOthersOrcamentos: true,
    viewPipeline: true,
    viewBling: true,
    createOrcamento: true,
    editOrcamento: true,
    deleteOrcamento: true,
    alterarVendedor: true,
    alterarStatusVenda: true,
    viewFinanceiro: true,
    viewLucro: true,
    viewComissao: true,
    editComissao: true,
    viewRelatorios: true,
    exportRelatorios: true,
    viewGestaoTarefas: true
  },
  'Gerente': {
    viewDashboard: true,
    viewAtendimento: true,
    viewAssistenciaTecnica: true,
    viewCadastro: true,
    viewComercial: true,
    viewClientes: true,
    viewProdutos: true,
    viewOrcamentos: true,
    viewOthersOrcamentos: true,
    viewPipeline: true,
    viewBling: true,
    createOrcamento: true,
    editOrcamento: true,
    deleteOrcamento: true,
    alterarVendedor: true,
    alterarStatusVenda: true,
    viewFinanceiro: true,
    viewLucro: true,
    viewComissao: true,
    editComissao: true,
    viewRelatorios: true,
    exportRelatorios: true,
    viewGestaoTarefas: true
  },
  'Vendedor': {
    viewDashboard: true,
    viewAtendimento: false,
    viewAssistenciaTecnica: false,
    viewCadastro: false,
    viewComercial: true,
    viewClientes: true,
    viewProdutos: true,
    viewOrcamentos: true,
    viewOthersOrcamentos: false,
    viewPipeline: true,
    viewBling: false,
    createOrcamento: true,
    editOrcamento: true,
    deleteOrcamento: false,
    alterarVendedor: false,
    alterarStatusVenda: true,
    viewFinanceiro: false,
    viewLucro: false,
    viewComissao: true,
    editComissao: false,
    viewRelatorios: false,
    exportRelatorios: false,
    viewGestaoTarefas: true
  },
  'Suporte Técnico Interno': {
    viewDashboard: true,
    viewAtendimento: true,
    viewAssistenciaTecnica: true,
    viewCadastro: false,
    viewComercial: false,
    viewClientes: true,
    viewProdutos: true,
    viewOrcamentos: false,
    viewOthersOrcamentos: false,
    viewPipeline: false,
    viewBling: false,
    createOrcamento: false,
    editOrcamento: false,
    deleteOrcamento: false,
    alterarVendedor: false,
    alterarStatusVenda: false,
    viewFinanceiro: false,
    viewLucro: false,
    viewComissao: false,
    editComissao: false,
    viewRelatorios: true,
    exportRelatorios: false,
    viewGestaoTarefas: true
  },
  'Suporte Técnico Externo': {
    viewDashboard: true,
    viewAtendimento: true,
    viewAssistenciaTecnica: true,
    viewCadastro: false,
    viewComercial: false,
    viewClientes: true,
    viewProdutos: true,
    viewOrcamentos: false,
    viewOthersOrcamentos: false,
    viewPipeline: false,
    viewBling: false,
    createOrcamento: false,
    editOrcamento: false,
    deleteOrcamento: false,
    alterarVendedor: false,
    alterarStatusVenda: false,
    viewFinanceiro: false,
    viewLucro: false,
    viewComissao: false,
    editComissao: false,
    viewRelatorios: false,
    exportRelatorios: false,
    viewGestaoTarefas: true
  },
  'Assistente Técnico': {
    viewDashboard: true,
    viewAtendimento: true,
    viewAssistenciaTecnica: true,
    viewCadastro: false,
    viewComercial: false,
    viewClientes: true,
    viewProdutos: true,
    viewOrcamentos: false,
    viewOthersOrcamentos: false,
    viewPipeline: false,
    viewBling: false,
    createOrcamento: false,
    editOrcamento: false,
    deleteOrcamento: false,
    alterarVendedor: false,
    alterarStatusVenda: false,
    viewFinanceiro: false,
    viewLucro: false,
    viewComissao: false,
    editComissao: false,
    viewRelatorios: false,
    exportRelatorios: false,
    viewGestaoTarefas: true
  },
  'Auxiliar Administrativo': {
    viewDashboard: true,
    viewAtendimento: true,
    viewAssistenciaTecnica: false,
    viewCadastro: true,
    viewComercial: false,
    viewClientes: true,
    viewProdutos: true,
    viewOrcamentos: false,
    viewOthersOrcamentos: false,
    viewPipeline: false,
    viewBling: true,
    createOrcamento: false,
    editOrcamento: false,
    deleteOrcamento: false,
    alterarVendedor: false,
    alterarStatusVenda: false,
    viewFinanceiro: true,
    viewLucro: false,
    viewComissao: false,
    editComissao: false,
    viewRelatorios: true,
    exportRelatorios: false,
    viewGestaoTarefas: true
  }
};

export const INITIAL_CARGOS: CargoEPerfil[] = [
  {
    id: 'cargo-socio-diretor',
    nome: 'Sócio Diretor',
    area: 'Diretoria',
    cbo: '1210-10',
    superiorImediatoNome: 'N/A (Conselho)',
    subordinadosNomes: ['Gerente'],
    formacaoExigida: 'Pós-graduação / MBA em Gestão Empresarial ou equivalente',
    experienciaMinima: '10 anos de experiência executiva e estratégica',
    conhecimentosObrigatorios: [
      'Gestão Financeira & DRE',
      'Planejamento Estratégico',
      'Governança Corporativa',
      'Fusões e Expansão de Mercado'
    ],
    competencias: [
      { id: 'c1', nome: 'Liderança Estratégica', descricao: 'Capacidade de alinhar a visão da empresa e engajar líderes', peso: 5 },
      { id: 'c2', nome: 'Visão de Negócios & Mercado', descricao: 'Identificação de novas oportunidades e tendências', peso: 5 },
      { id: 'c3', nome: 'Tomada de Decisão', descricao: 'Decisões ágeis fundamentadas em indicadores', peso: 5 },
      { id: 'c4', nome: 'Gestão Financeira', descricao: 'Controle de fluxo de caixa, investimentos e margem de lucro', peso: 5 }
    ],
    responsabilidades: [
      'Definir metas globais de faturamento, Ebitda e expansão da empresa',
      'Supervisionar os gerentes de área e garantir a execução do planejamento',
      'Aprovar orçamentos anuais e investimentos em tecnologia/equipamentos',
      'Manter a cultura de autogestão e excelência na entrega de serviços'
    ],
    metasCargo: [
      'Alcançar o faturamento anual planejado',
      'Manter margem líquida da empresa acima de 25%',
      'Garantir índice de satisfação de clientes (NPS) acima de 90'
    ],
    sla: 'Decisões estratégicas em até 24h',
    kpis: [
      { id: 'k1', nome: 'Faturamento Anual', meta: 'Definido no DRE', unidade: 'R$', frequencia: 'Mensal' },
      { id: 'k2', nome: 'Margem Líquida', meta: '>= 25%', unidade: '%', frequencia: 'Mensal' },
      { id: 'k3', nome: 'NPS Global', meta: '>= 90', unidade: 'pts', frequencia: 'Mensal' }
    ],
    checklistDiario: [
      'Analisar DRE simplificado e saldo de caixa do dia',
      'Verificar indicadores consolidados das áreas',
      'Acompanhar propostas estratégicas de grande porte'
    ],
    checklistSemanal: [
      'Reunião de alinhamento com a Gerência',
      'Revisão do pipeline comercial e taxa de conversão'
    ],
    checklistMensal: [
      'Análise de DRE mensal e aprovação de comissões',
      'Avaliação de desempenho da gerência'
    ],
    permissoes: DEFAULT_PERMISSIONS_BY_CARGO['Sócio Diretor'],
    treinamentos: [
      { id: 't1', nome: 'Governança e Liderança de Alto Impacto', cargaHoraria: '20h', obrigatorio: true },
      { id: 't2', nome: 'Análise Avançada de DRE e Valuation', cargaHoraria: '16h', obrigatorio: true }
    ]
  },
  {
    id: 'cargo-gerente',
    nome: 'Gerente',
    area: 'Gestão Geral',
    cbo: '1421-05',
    superiorImediatoNome: 'Sócio Diretor',
    subordinadosNomes: ['Vendedor', 'Suporte Técnico Interno', 'Suporte Técnico Externo', 'Assistente Técnico', 'Auxiliar Administrativo'],
    formacaoExigida: 'Ensino Superior Completo em Administração, Engenharia ou Gestão Comercial',
    experienciaMinima: '5 anos em gestão de equipes e operações',
    conhecimentosObrigatorios: [
      'Gestão de Pessoas & Processos',
      'CRM Meu Mundo & Ferramentas ERP',
      'Indicadores de Desempenho (KPIs)',
      'Gestão Financeira Básica & DRE'
    ],
    competencias: [
      { id: 'c1', nome: 'Liderança', descricao: 'Orientar e motivar a equipe para alcance das metas', peso: 5 },
      { id: 'c2', nome: 'Negociação', descricao: 'Capacidade de fechar vendas complexas e resolver conflitos', peso: 5 },
      { id: 'c3', nome: 'Planejamento', descricao: 'Organizar rotinas e prever recursos necessários', peso: 4 },
      { id: 'c4', nome: 'Gestão de Pessoas', descricao: 'Feedback, treinamento e avaliação de desempenho', peso: 5 },
      { id: 'c5', nome: 'Visão Estratégica', descricao: 'Compreensão global do impacto de cada área no resultado', peso: 4 }
    ],
    responsabilidades: [
      'Acompanhar diariamente as metas de vendas e chamados de suporte',
      'Aprovar descontos em orçamentos e despesas operacionais',
      'Realizar avaliações mensais de desempenho de todos os colaboradores',
      'Garantir o cumprimento rigoroso dos SLAs com os clientes',
      'Criar usuários, definir e ajustar permissões por cargo'
    ],
    metasCargo: [
      'Atingir 100% da meta de vendas da equipe comercial',
      'Garantir SLA de atendimento técnico acima de 95%',
      'Reduzir turnover da equipe para menos de 5% ao ano'
    ],
    sla: 'Atendimento a demandas internas da equipe em até 2 horas',
    kpis: [
      { id: 'k1', nome: 'Faturamento Total da Equipe', meta: 'Meta Mensal', unidade: 'R$', frequencia: 'Mensal' },
      { id: 'k2', nome: 'SLA Global Suporte', meta: '>= 95%', unidade: '%', frequencia: 'Diário' },
      { id: 'k3', nome: 'Média de Desempenho da Equipe', meta: '>= 8.5', unidade: 'nota', frequencia: 'Mensal' }
    ],
    checklistDiario: [
      'Reunião matinal rápido (Daily) de 15 minutos com Comercial e Suporte',
      'Verificar chamados em atraso ou urgentes no painel',
      'Acompanhar fechamentos de propostas e aprovação de descontos',
      'Conferir relatórios de produtividade individual'
    ],
    checklistSemanal: [
      'Análise de reuniões e visitas dos vendedores',
      'Acompanhamento das ordens de serviço pendentes de peças'
    ],
    checklistMensal: [
      'Executar avaliação mensal de desempenho de cada colaborador',
      'Apresentar DRE operacional ao Sócio Diretor'
    ],
    permissoes: DEFAULT_PERMISSIONS_BY_CARGO['Gerente'],
    treinamentos: [
      { id: 't1', nome: 'Gestão de Pessoas e Feedback Contínuo', cargaHoraria: '12h', obrigatorio: true },
      { id: 't2', nome: 'Metodologias Ágeis de Gestão', cargaHoraria: '8h', obrigatorio: true },
      { id: 't3', nome: 'Excelência no Atendimento B2B', cargaHoraria: '10h', obrigatorio: true }
    ]
  },
  {
    id: 'cargo-vendedor',
    nome: 'Vendedor',
    area: 'Comercial',
    cbo: '3541-20',
    superiorImediatoNome: 'Gerente',
    subordinadosNomes: [],
    formacaoExigida: 'Ensino Médio Completo / Superior Cursando',
    experienciaMinima: '2 anos em vendas B2B de equipamentos ou tecnologia',
    conhecimentosObrigatorios: [
      'Técnicas de Prospecção & Cold Calling',
      'Operação Completa do CRM Meu Mundo',
      'Apresentação de Equipamentos de Ponto/Acesso',
      'Elaboração e Negociação de Propostas Comerciais'
    ],
    competencias: [
      { id: 'c1', nome: 'Comunicação', descricao: 'Clareza e empatia ao falar com potenciais clientes', peso: 5 },
      { id: 'c2', nome: 'Negociação', descricao: 'Superar objeções e valorizar diferenciais competitivos', peso: 5 },
      { id: 'c3', nome: 'Organização', descricao: 'Manter pipeline e retornos atualizados no CRM', peso: 4 },
      { id: 'c4', nome: 'Proatividade', descricao: 'Buscar ativamente novos leads e oportunidades', peso: 5 }
    ],
    responsabilidades: [
      'Realizar prospecção ativa de novas empresas (30 ligações diárias)',
      'Elaborar e enviar propostas comerciais dentro do padrão do CRM',
      'Fazer acompanhamento (follow-up) constante das propostas em negociação',
      'Atualizar status e historico de interações de cada lead no CRM',
      'Realizar visitas e reuniões presenciais ou online com clientes'
    ],
    metasCargo: [
      'Atingir a meta individual de faturamento mensal',
      'Converter no mínimo 25% das propostas enviadas',
      'Realizar pelo menos 10 visitas/demonstrações presenciais por mês'
    ],
    sla: 'Enviar proposta comercial em até 2 horas após a solicitação do lead',
    kpis: [
      { id: 'k1', nome: 'Volume de Vendas', meta: 'Meta Individual', unidade: 'R$', frequencia: 'Mensal' },
      { id: 'k2', nome: 'Ligações Realizadas', meta: '30/dia', unidade: 'ligações', frequencia: 'Diário' },
      { id: 'k3', nome: 'Propostas Enviadas', meta: '10/dia', unidade: 'propostas', frequencia: 'Diário' },
      { id: 'k4', nome: 'Taxa de Conversão', meta: '>= 25%', unidade: '%', frequencia: 'Mensal' },
      { id: 'k5', nome: 'Ticket Médio', meta: 'R$ 3.500', unidade: 'R$', frequencia: 'Mensal' }
    ],
    checklistDiario: [
      'Fazer 30 ligações de prospecção e acompanhamento',
      'Enviar 10 propostas comerciais no padrão CRM',
      'Fazer pós-venda dos clientes fechados nos últimos 7 dias',
      'Atualizar agenda e historico de todas as conversas no CRM'
    ],
    checklistSemanal: [
      'Revisão do funil de vendas e qualificação dos leads quentes',
      'Conferência das comissões registradas no sistema'
    ],
    checklistMensal: [
      'Fechamento de metas e envio de relatório mensal ao Gerente'
    ],
    permissoes: DEFAULT_PERMISSIONS_BY_CARGO['Vendedor'],
    treinamentos: [
      { id: 't1', nome: 'Técnicas Avançadas de Fechamento B2B', cargaHoraria: '16h', obrigatorio: true },
      { id: 't2', nome: 'Treinamento de Produtos: Catracas & Relógios de Ponto', cargaHoraria: '12h', obrigatorio: true },
      { id: 't3', nome: 'Uso de IA e CRM para Vendas Rápidas', cargaHoraria: '6h', obrigatorio: true }
    ]
  },
  {
    id: 'cargo-suporte-interno',
    nome: 'Suporte Técnico Interno',
    area: 'Suporte',
    cbo: '3132-20',
    superiorImediatoNome: 'Gerente',
    subordinadosNomes: [],
    formacaoExigida: 'Técnico em Informática, Redes ou Ciência da Computação (cursando ou concluído)',
    experienciaMinima: '1 ano em atendimento e suporte a software/hardware',
    conhecimentosObrigatorios: [
      'Sistemas de Ponto Eletrônico & Acesso',
      'Redes de Computadores, IPs e Portas',
      'Atendimento Remoto (AnyDesk / TeamViewer)',
      'Módulo de Chamados do Meu Mundo CRM'
    ],
    competencias: [
      { id: 'c1', nome: 'Resolução de Problemas', descricao: 'Diagnóstico rápido e eficiente de falhas em software/hardware', peso: 5 },
      { id: 'c2', nome: 'Agilidade', descricao: 'Atendimento dentro do prazo do SLA sem perder a qualidade', peso: 5 },
      { id: 'c3', nome: 'Atendimento ao Cliente', descricao: 'Paciência, cordialidade e clareza na comunicação', peso: 5 },
      { id: 'c4', nome: 'Organização', descricao: 'Registro minucioso de cada chamado e solução no histórico', peso: 4 }
    ],
    responsabilidades: [
      'Atender e responder chamados técnicos abertos pelos clientes',
      'Realizar suporte remoto em softwares de ponto e equipamentos biométricos/faciais',
      'Agendar visitas presenciais para os técnicos de campo quando necessário',
      'Atualizar o histórico do cliente e fechar OS com solução detalhada',
      'Registrar horas trabalhadas e peças utilizadas'
    ],
    metasCargo: [
      'Manter SLA de Primeira Resposta em menos de 30 minutos',
      'Resolver 80% dos chamados de forma remota',
      'Obter nota de satisfação (NPS) >= 9.0 dos clientes atendidos'
    ],
    sla: 'Primeira resposta em 30min; Resolução em até 4 horas úteis',
    kpis: [
      { id: 'k1', nome: 'SLA de Atendimento', meta: '>= 95%', unidade: '%', frequencia: 'Diário' },
      { id: 'k2', nome: 'Tempo Médio de Resolução', meta: '<= 4h', unidade: 'horas', frequencia: 'Mensal' },
      { id: 'k3', nome: 'Satisfação do Cliente', meta: '>= 9.0', unidade: 'nota', frequencia: 'Mensal' },
      { id: 'k4', nome: 'Chamados Fechados/Dia', meta: '>= 12', unidade: 'chamados', frequencia: 'Diário' }
    ],
    checklistDiario: [
      'Responder chamados abertos e dar primeira resposta no SLA',
      'Fechar Ordens de Serviço (OS) concluídas no dia',
      'Atualizar histórico de solução técnica no perfil do cliente',
      'Registrar horas e apontamentos no sistema'
    ],
    checklistSemanal: [
      'Verificar lista de chamados aguardando peça ou terceiros',
      'Revisão dos equipamentos trazidos para assistência em laboratório'
    ],
    checklistMensal: [
      'Revisão da base de conhecimento e perguntas frequentes'
    ],
    permissoes: DEFAULT_PERMISSIONS_BY_CARGO['Suporte Técnico Interno'],
    treinamentos: [
      { id: 't1', nome: 'Certificação em Softwares de Ponto e Acesso', cargaHoraria: '20h', obrigatorio: true },
      { id: 't2', nome: 'Diagnóstico Avançado de Redes e Comunicação IP', cargaHoraria: '12h', obrigatorio: true },
      { id: 't3', nome: 'Comunicação Empática em Suporte Técnico', cargaHoraria: '8h', obrigatorio: true }
    ]
  },
  {
    id: 'cargo-suporte-externo',
    nome: 'Suporte Técnico Externo',
    area: 'Suporte',
    cbo: '3132-15',
    superiorImediatoNome: 'Gerente',
    subordinadosNomes: [],
    formacaoExigida: 'Técnico em Eletroeletrônica, Informática ou Mecatrônica',
    experienciaMinima: '2 anos em manutenção em campo e instalação de catracas/rebanhos/faciais',
    conhecimentosObrigatorios: [
      'Instalação de Catracas, Relógios de Ponto e Reconhecimento Facial',
      'Cabeamento Estruturado e Redes',
      'Manutenção Preventiva e Corretiva de Hardware',
      'Leitura de Esquemas Elétricos e Placas'
    ],
    competencias: [
      { id: 'c1', nome: 'Resolução de Problemas em Campo', descricao: 'Identificação e conserto prático de falhas físicas', peso: 5 },
      { id: 'c2', nome: 'Pontualidade nas Visitas', descricao: 'Cumprimento rigoroso do horário agendado com o cliente', peso: 5 },
      { id: 'c3', nome: 'Atendimento e Apresentação', descricao: 'Uniformização, postura respeitosa e colheita de assinatura', peso: 4 },
      { id: 'c4', nome: 'Agilidade Operacional', descricao: 'Execução limpa e rápida do serviço no cliente', peso: 4 }
    ],
    responsabilidades: [
      'Realizar visitas técnicas presenciais para instalação e manutenção',
      'Coletar assinatura do cliente e registrar fotos da instalação realizada',
      'Diagnosticar peças com defeito e trazer equipamentos para bancada se necessário',
      'Preencher relatório de visita técnica no aplicativo móvel/portal técnico'
    ],
    metasCargo: [
      'Realizar 4 visitas com sucesso por dia útil',
      'Manter taxa de retrabalho por falha de instalação abaixo de 2%',
      'Coletar assinatura do cliente em 100% das ordens de serviço'
    ],
    sla: 'Chegada no local do cliente dentro da janela de agendamento de 2h',
    kpis: [
      { id: 'k1', nome: 'Visitas Concluídas/Dia', meta: '4/dia', unidade: 'visitas', frequencia: 'Diário' },
      { id: 'k2', nome: 'Taxa de Retrabalho', meta: '<= 2%', unidade: '%', frequencia: 'Mensal' },
      { id: 'k3', nome: 'Avaliação da Visita', meta: '>= 9.5', unidade: 'nota', frequencia: 'Mensal' }
    ],
    checklistDiario: [
      'Conferir ferramentas, cabos e peças do veículo de serviço',
      'Realizar visitas agendadas no dia coletando fotos e assinatura',
      'Sincronizar chamados no Portal Técnico com solução executada',
      'Registrar KM e relatório ao final do expediente'
    ],
    checklistSemanal: [
      'Revisão de estoque de peças de reposição no veículo',
      'Devolução de componentes defeituosos ao almoxarifado'
    ],
    checklistMensal: [
      'Manutenção preventiva das ferramentas de trabalho'
    ],
    permissoes: DEFAULT_PERMISSIONS_BY_CARGO['Suporte Técnico Externo'],
    treinamentos: [
      { id: 't1', nome: 'Instalação e Manutenção de Catracas de Acesso', cargaHoraria: '16h', obrigatorio: true },
      { id: 't2', nome: 'NR-10 (Segurança em Instalações Elétricas)', cargaHoraria: '20h', obrigatorio: true },
      { id: 't3', nome: 'Instalação de Leitores Faciais e Biometria Avançada', cargaHoraria: '10h', obrigatorio: true }
    ]
  },
  {
    id: 'cargo-assistente-tecnico',
    nome: 'Assistente Técnico',
    area: 'Suporte',
    cbo: '3132-05',
    superiorImediatoNome: 'Suporte Técnico Interno',
    subordinadosNomes: [],
    formacaoExigida: 'Ensino Técnico em Eletrônica/Informática em andamento',
    experienciaMinima: '6 meses na área técnica',
    conhecimentosObrigatorios: [
      'Solda eletrônica e troca de componentes',
      'Testes em placas mãe de relógios de ponto e catracas',
      'Organização de laboratório técnico',
      'Sistema de controle de peças e ordens de bancada'
    ],
    competencias: [
      { id: 'c1', nome: 'Atenção aos Detalhes', descricao: 'Diagnóstico preciso em nível de componente', peso: 5 },
      { id: 'c2', nome: 'Organização da Bancada', descricao: 'Manter peças identificadas e ambiente limpo', peso: 4 },
      { id: 'c3', nome: 'Comprometimento', descricao: 'Cumprimento dos prazos de reparo em laboratório', peso: 4 }
    ],
    responsabilidades: [
      'Efetuar testes e manutenção de bancada em equipamentos recolhidos',
      'Trocar peças, placas e fontes com defeito',
      'Cadastrar e etiquetar equipamentos que entram na assistência técnica',
      'Apoiar os técnicos internos e externos no envio de peças'
    ],
    metasCargo: [
      'Reparar equipamentos trazidos em bancada em no máximo 48h',
      'Reduzir peças descartadas incorretamente'
    ],
    sla: 'Triagem e diagnóstico inicial de equipamento trazido em até 24h',
    kpis: [
      { id: 'k1', nome: 'Equipamentos Consertados/Mês', meta: '>= 40', unidade: 'unidades', frequencia: 'Mensal' },
      { id: 'k2', nome: 'Tempo Médio de Bancada', meta: '<= 48h', unidade: 'horas', frequencia: 'Mensal' },
      { id: 'k3', nome: 'Índice de Retrabalho', meta: '<= 1%', unidade: '%', frequencia: 'Mensal' }
    ],
    checklistDiario: [
      'Triagem e teste dos equipamentos recebidos na assistência',
      'Executar consertos das ordens de bancada do dia',
      'Atualizar status de reparo do equipamento no sistema'
    ],
    checklistSemanal: [
      'Inventário do estoque de peças do laboratório'
    ],
    checklistMensal: [
      'Limpeza geral e calibração de equipamentos de medição'
    ],
    permissoes: DEFAULT_PERMISSIONS_BY_CARGO['Assistente Técnico'],
    treinamentos: [
      { id: 't1', nome: 'Manutenção em Placas de Relógios e Catracas', cargaHoraria: '16h', obrigatorio: true },
      { id: 't2', nome: 'Solda e Eletrônica Aplicada', cargaHoraria: '12h', obrigatorio: true }
    ]
  },
  {
    id: 'cargo-auxiliar-adm',
    nome: 'Auxiliar Administrativo',
    area: 'Administrativo',
    cbo: '4110-10',
    superiorImediatoNome: 'Gerente',
    subordinadosNomes: [],
    formacaoExigida: 'Ensino Médio Completo / Superior Cursando em Administração ou Contabilidade',
    experienciaMinima: '1 ano em rotinas administrativas e faturamento',
    conhecimentosObrigatorios: [
      'Emissão de NFe e NFSe',
      'Conferência de Boletos e Contas a Pagar/Receber',
      'Integração Bling e Conciliação Bancária',
      'Controle de Ponto e Arquivo Digital'
    ],
    competencias: [
      { id: 'c1', nome: 'Organização Financeira', descricao: 'Lançamentos sem erros e conferência rigorosa de dados', peso: 5 },
      { id: 'c2', nome: 'Pontualidade com Boletos e DNT', descricao: 'Garantir que faturamentos saiam no prazo exato', peso: 5 },
      { id: 'c3', nome: 'Atendimento Telefônico/Interno', descricao: 'Direcionar chamadas e tratar dúvidas de clientes sobre boletos', peso: 4 }
    ],
    responsabilidades: [
      'Emitir Notas Fiscais de Vendas, Locações e Serviços',
      'Conferir boletos bancários gerados e baixas automáticas',
      'Conferir entradas do caixa e fechamento financeiro do dia',
      'Auxiliar na conferência do ponto dos colaboradores',
      'Organizar documentos fiscais e enviar ao escritório de contabilidade'
    ],
    metasCargo: [
      'Zerar inconsistências em emissões fiscais e notas de faturamento',
      'Manter 100% dos boletos de contratos gerados antes do dia 25 do mês'
    ],
    sla: 'Emissão de NFSe em até 24 horas após aprovação da OS/Venda',
    kpis: [
      { id: 'k1', nome: 'Notas Fiscais Emitidas', meta: '100% no prazo', unidade: '%', frequencia: 'Mensal' },
      { id: 'k2', nome: 'Contas a Pagar Lançadas', meta: '100% em dia', unidade: '%', frequencia: 'Diário' },
      { id: 'k3', nome: 'Erros Fiscais / Reemissões', meta: '0', unidade: 'ocorrências', frequencia: 'Mensal' }
    ],
    checklistDiario: [
      'Emitir Notas Fiscais dos orçamentos aprovados',
      'Conferir baixas de boletos e saldo das contas bancárias',
      'Lançar contas a pagar com vencimento no dia',
      'Conferir fechamento do caixa operacional'
    ],
    checklistSemanal: [
      'Enviar relatórios fiscais para o setor contábil',
      'Conferir cobranças pendentes de clientes inadimplentes'
    ],
    checklistMensal: [
      'Fechar espelho do ponto dos colaboradores para folha de pagamento'
    ],
    permissoes: DEFAULT_PERMISSIONS_BY_CARGO['Auxiliar Administrativo'],
    treinamentos: [
      { id: 't1', nome: 'Emissão Prática de NFe/NFSe e Legislação Fiscal Básica', cargaHoraria: '12h', obrigatorio: true },
      { id: 't2', nome: 'Operação de Contas a Pagar e Receber no ERP', cargaHoraria: '8h', obrigatorio: true }
    ]
  }
];

class CargosService {
  private cargosCol = 'cargos_perfis';
  private avaliacoesCol = 'avaliacoes_desempenho';
  private treinamentosCol = 'treinamentos_colaborador';
  private auditLogsCol = 'audit_logs_cargos';

  // Helper date formatted YYYY-MM-DD
  private getTodayStr(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Real-time subscribe to Cargos
  subscribeCargos(callback: (cargos: CargoEPerfil[]) => void) {
    const q = query(collection(db, this.cargosCol));
    return onSnapshot(q, async (snapshot) => {
      let list: CargoEPerfil[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CargoEPerfil);
      });

      // If empty, seed initial cargos automatically
      if (list.length === 0) {
        console.log("Seeding initial cargos & perfis...");
        for (const initial of INITIAL_CARGOS) {
          try {
            await setDoc(doc(db, this.cargosCol, initial.id), initial);
          } catch (e) {
            console.error("Error seeding initial cargo:", e);
          }
        }
        list = INITIAL_CARGOS;
      }

      callback(list);
    }, (error) => {
      console.error("Error listening to cargos:", error);
      callback(INITIAL_CARGOS);
    });
  }

  // Get all cargos
  async getCargos(): Promise<CargoEPerfil[]> {
    try {
      const snapshot = await getDocs(collection(db, this.cargosCol));
      const list = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as CargoEPerfil));
      if (list.length === 0) {
        return INITIAL_CARGOS;
      }
      return list;
    } catch (e) {
      console.error("Error fetching cargos:", e);
      return INITIAL_CARGOS;
    }
  }

  // Save / Edit Cargo
  async saveCargo(cargoData: Partial<CargoEPerfil>, updatedByUserName: string = 'Sistema'): Promise<string> {
    const isEdit = !!cargoData.id;
    const now = new Date().toISOString();
    
    if (isEdit) {
      const cargoId = cargoData.id!;
      const ref = doc(db, this.cargosCol, cargoId);
      await updateDoc(ref, {
        ...cargoData,
        updatedAt: now,
        updatedBy: updatedByUserName
      });

      await this.addAuditLog({
        cargoId,
        cargoNome: cargoData.nome || 'Cargo',
        usuarioId: 'admin',
        usuarioNome: updatedByUserName,
        dataHora: now,
        acao: 'edicao_cargo',
        detalhes: `Cargo "${cargoData.nome}" atualizado por ${updatedByUserName}.`
      });

      return cargoId;
    } else {
      const id = 'cargo-' + Date.now();
      const newCargo: CargoEPerfil = {
        id,
        nome: cargoData.nome || 'Novo Cargo',
        area: cargoData.area || 'Geral',
        cbo: cargoData.cbo || '',
        superiorImediatoNome: cargoData.superiorImediatoNome || '',
        subordinadosNomes: cargoData.subordinadosNomes || [],
        formacaoExigida: cargoData.formacaoExigida || 'Ensino Médio completo',
        experienciaMinima: cargoData.experienciaMinima || 'Sem experiência exigida',
        conhecimentosObrigatorios: cargoData.conhecimentosObrigatorios || [],
        competencias: cargoData.competencias || [],
        responsabilidades: cargoData.responsabilidades || [],
        metasCargo: cargoData.metasCargo || [],
        sla: cargoData.sla || '',
        kpis: cargoData.kpis || [],
        checklistDiario: cargoData.checklistDiario || [],
        checklistSemanal: cargoData.checklistSemanal || [],
        checklistMensal: cargoData.checklistMensal || [],
        permissoes: cargoData.permissoes || DEFAULT_PERMISSIONS_BY_CARGO['Vendedor'],
        treinamentos: cargoData.treinamentos || [],
        createdAt: now,
        updatedAt: now,
        updatedBy: updatedByUserName
      };

      await setDoc(doc(db, this.cargosCol, id), newCargo);

      await this.addAuditLog({
        cargoId: id,
        cargoNome: newCargo.nome,
        usuarioId: 'admin',
        usuarioNome: updatedByUserName,
        dataHora: now,
        acao: 'criacao',
        detalhes: `Novo cargo "${newCargo.nome}" criado no setor de ${newCargo.area}.`
      });

      return id;
    }
  }

  // Delete cargo
  async deleteCargo(id: string, cargoNome: string, usuarioNome: string = 'Admin'): Promise<void> {
    await deleteDoc(doc(db, this.cargosCol, id));
    await this.addAuditLog({
      cargoId: id,
      cargoNome,
      usuarioId: 'admin',
      usuarioNome,
      dataHora: new Date().toISOString(),
      acao: 'edicao_cargo',
      detalhes: `Cargo "${cargoNome}" foi excluído do sistema por ${usuarioNome}.`
    });
  }

  // Helper: Normalize user's linked cargos
  normalizeUserCargos(user: Partial<Usuario>): VinculoCargoUsuario[] {
    if (user.cargosVinculados && user.cargosVinculados.length > 0) {
      const hasPrimary = user.cargosVinculados.some(v => v.isPrimary);
      if (!hasPrimary) {
        return user.cargosVinculados.map((v, i) => ({ ...v, isPrimary: i === 0 }));
      }
      return user.cargosVinculados;
    }
    if (user.cargoId) {
      return [{
        cargoId: user.cargoId,
        cargoNome: user.cargoNome || 'Cargo',
        isPrimary: true,
        assignedAt: new Date().toISOString()
      }];
    }
    return [];
  }

  // Helper: Calculate cumulative permissions inherited from multiple cargos
  calculateCumulativePermissions(
    vinculos: VinculoCargoUsuario[],
    allCargos: CargoEPerfil[],
    currentPermissions?: UserPermissions
  ): { mergedPermissions: UserPermissions; inheritanceMap: Record<keyof UserPermissions, string[]> } {
    const baseKeys: (keyof UserPermissions)[] = [
      'viewDashboard', 'viewAtendimento', 'viewAssistenciaTecnica', 'viewCadastro',
      'viewComercial', 'viewClientes', 'viewProdutos', 'viewOrcamentos',
      'viewOthersOrcamentos', 'viewPipeline', 'viewBling', 'createOrcamento',
      'editOrcamento', 'deleteOrcamento', 'alterarVendedor', 'alterarStatusVenda',
      'viewFinanceiro', 'viewLucro', 'viewComissao', 'editComissao',
      'viewRelatorios', 'exportRelatorios', 'viewGestaoTarefas'
    ];

    const mergedPermissions: UserPermissions = {
      viewDashboard: false,
      viewAtendimento: false,
      viewAssistenciaTecnica: false,
      viewCadastro: false,
      viewComercial: false,
      viewClientes: false,
      viewProdutos: false,
      viewOrcamentos: false,
      viewOthersOrcamentos: false,
      viewPipeline: false,
      viewBling: false,
      createOrcamento: false,
      editOrcamento: false,
      deleteOrcamento: false,
      alterarVendedor: false,
      alterarStatusVenda: false,
      viewFinanceiro: false,
      viewLucro: false,
      viewComissao: false,
      editComissao: false,
      viewRelatorios: false,
      exportRelatorios: false,
      viewGestaoTarefas: false,
      ...(currentPermissions || {})
    };

    const inheritanceMap: Record<string, string[]> = {};
    baseKeys.forEach(k => { inheritanceMap[k] = []; });

    vinculos.forEach(vinculo => {
      const cargo = allCargos.find(c => c.id === vinculo.cargoId);
      if (cargo && cargo.permissoes) {
        baseKeys.forEach(key => {
          if (cargo.permissoes[key] === true) {
            mergedPermissions[key] = true;
            if (!inheritanceMap[key].includes(cargo.nome)) {
              inheritanceMap[key].push(cargo.nome);
            }
          }
        });
      }
    });

    return { mergedPermissions, inheritanceMap: inheritanceMap as Record<keyof UserPermissions, string[]> };
  }

  // Vincular múltiplos cargos ao usuário com herança cumulativa de permissões, checklists e treinamentos
  async vincularMultiplosCargosAUsuario(
    usuarioId: string,
    vinculos: VinculoCargoUsuario[],
    usuarioNome: string,
    allCargos: CargoEPerfil[],
    executorNome: string = 'Admin',
    currentPermissions?: UserPermissions
  ): Promise<void> {
    const now = new Date().toISOString();

    if (!vinculos || vinculos.length === 0) {
      throw new Error("Pelo menos um cargo deve ser vinculado ao colaborador.");
    }

    // Identify Primary Cargo
    let primary = vinculos.find(v => v.isPrimary);
    if (!primary) {
      vinculos[0].isPrimary = true;
      primary = vinculos[0];
    }

    // Cumulative permissions calculation
    const { mergedPermissions } = this.calculateCumulativePermissions(vinculos, allCargos, currentPermissions);

    // 1. Atualizar ficha do usuário no Firestore
    await databaseService.updateUsuario(usuarioId, {
      cargoId: primary.cargoId,
      cargoNome: primary.cargoNome,
      cargosVinculados: vinculos,
      permissions: mergedPermissions
    });

    // 2. Coletar e deduplicar checklists diários dos cargos vinculados
    const uniqueChecklistItems = new Set<string>();
    vinculos.forEach(v => {
      const cargo = allCargos.find(c => c.id === v.cargoId);
      if (cargo?.checklistDiario) {
        cargo.checklistDiario.forEach(item => uniqueChecklistItems.add(item));
      }
    });

    for (const itemText of Array.from(uniqueChecklistItems)) {
      try {
        await tasksService.createTask({
          titulo: itemText,
          descricao: `Tarefa diária herdada do(s) cargo(s) RH`,
          funcionarioId: usuarioId,
          funcionarioNome: usuarioNome,
          tipo: 'checklist',
          prioridade: 'Média',
          status: 'Pendente',
          dataInicial: this.getTodayStr(),
          dataFinal: this.getTodayStr(),
          repeticao: 'Diariamente',
          checklist: [{ id: `ck-${Date.now()}`, texto: itemText, concluido: false }]
        });
      } catch (e) {
        console.error("Error creating default task for multi-cargo:", e);
      }
    }

    // 3. Cadastrar treinamentos obrigatórios acumulados
    for (const v of vinculos) {
      const cargo = allCargos.find(c => c.id === v.cargoId);
      if (cargo?.treinamentos) {
        for (const t of cargo.treinamentos) {
          try {
            const docId = `tr-${usuarioId}-${t.id}`;
            await setDoc(doc(db, this.treinamentosCol, docId), {
              id: docId,
              funcionarioId: usuarioId,
              funcionarioNome: usuarioNome,
              cargoId: cargo.id,
              treinamentoId: t.id,
              treinamentoNome: t.nome,
              cargaHoraria: t.cargaHoraria || 'N/A',
              status: 'Pendente',
              updatedAt: now
            } as TreinamentoColaborador);
          } catch (e) {
            console.error("Error creating training record for multi-cargo:", e);
          }
        }
      }
    }

    // 4. Auditoria
    const cargosNomesStr = vinculos.map(v => `${v.cargoNome}${v.isPrimary ? ' (Principal)' : ''}`).join(', ');
    await this.addAuditLog({
      cargoId: primary.cargoId,
      cargoNome: primary.cargoNome,
      usuarioId,
      usuarioNome,
      dataHora: now,
      acao: 'vinculacao_usuario',
      detalhes: `Colaborador ${usuarioNome} vinculado aos cargos: [${cargosNomesStr}]. Permissões e checklists acumulados com sucesso.`
    });
  }

  // Vincular cargo único ao usuário (mantido para compatibilidade, repassando para vincularMultiplosCargosAUsuario)
  async vincularCargoAUsuario(
    usuarioId: string, 
    cargo: CargoEPerfil, 
    usuarioNome: string, 
    executorNome: string = 'Admin'
  ): Promise<void> {
    const vinculo: VinculoCargoUsuario = {
      cargoId: cargo.id,
      cargoNome: cargo.nome,
      isPrimary: true,
      assignedAt: new Date().toISOString()
    };
    await this.vincularMultiplosCargosAUsuario(usuarioId, [vinculo], usuarioNome, [cargo], executorNome);
  }

  // --- AVALIAÇÕES DE DESEMPENHO ---
  subscribeAvaliacoes(callback: (avaliacoes: AvaliacaoDesempenho[]) => void) {
    const q = query(collection(db, this.avaliacoesCol));
    return onSnapshot(q, (snapshot) => {
      const list: AvaliacaoDesempenho[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as AvaliacaoDesempenho);
      });
      callback(list);
    }, (error) => {
      console.error("Error listening to avaliacoes:", error);
      callback([]);
    });
  }

  async saveAvaliacao(avaliacao: Omit<AvaliacaoDesempenho, 'id' | 'createdAt'>): Promise<string> {
    const now = new Date().toISOString();
    const id = 'aval-' + Date.now();
    const newAval: AvaliacaoDesempenho = {
      ...avaliacao,
      id,
      createdAt: now
    };

    await setDoc(doc(db, this.avaliacoesCol, id), newAval);

    await this.addAuditLog({
      cargoId: avaliacao.cargoId,
      cargoNome: avaliacao.cargoNome,
      usuarioId: avaliacao.funcionarioId,
      usuarioNome: avaliacao.funcionarioNome,
      dataHora: now,
      acao: 'avaliacao_criada',
      detalhes: `Avaliação de Desempenho (${avaliacao.mesAno}) realizada para ${avaliacao.funcionarioNome} por ${avaliacao.avaliadorNome}. Nota Média: ${avaliacao.notaFinalMedia.toFixed(1)}/10.`
    });

    return id;
  }

  // --- TREINAMENTOS COLABORADOR ---
  subscribeTreinamentosColaborador(callback: (treinamentos: TreinamentoColaborador[]) => void) {
    const q = query(collection(db, this.treinamentosCol));
    return onSnapshot(q, (snapshot) => {
      const list: TreinamentoColaborador[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TreinamentoColaborador);
      });
      callback(list);
    }, (error) => {
      console.error("Error listening to treinamentos:", error);
      callback([]);
    });
  }

  async updateTreinamentoColaborador(id: string, updates: Partial<TreinamentoColaborador>): Promise<void> {
    const ref = doc(db, this.treinamentosCol, id);
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  // --- AUDIT LOGS ---
  subscribeAuditLogs(callback: (logs: AuditLogCargo[]) => void) {
    const q = query(collection(db, this.auditLogsCol));
    return onSnapshot(q, (snapshot) => {
      const list: AuditLogCargo[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as AuditLogCargo);
      });
      list.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
      callback(list);
    }, (error) => {
      console.error("Error listening to audit logs:", error);
      callback([]);
    });
  }

  async addAuditLog(log: Omit<AuditLogCargo, 'id'>): Promise<void> {
    try {
      const id = 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      await setDoc(doc(db, this.auditLogsCol, id), { id, ...log });
    } catch (e) {
      console.error("Error writing audit log:", e);
    }
  }
}

export const cargosService = new CargosService();
