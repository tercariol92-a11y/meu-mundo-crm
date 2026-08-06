import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, collection } from '../services/resilientFirestoreClient';
import { db } from '../firebase';
import { 
  Users as UsersIcon, 
  Ticket, 
  Calendar as CalendarIcon, 
  FileText, 
  Wrench, 
  CircleDollarSign, 
  Filter, 
  Plus,
  MoreVertical,
  Lightbulb as LightbulbIcon,
  BarChart3,
  Construction,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Briefcase,
  Monitor,
  UserCheck,
  Activity,
  Award,
  ChevronRight,
  Search,
  ShieldAlert,
  MessageSquare,
  Headset
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area, ComposedChart, ReferenceLine
} from 'recharts';
import { User, Cliente, Chamado, Tecnico, EquipamentoCliente, Proposta, Meta, Lead, Conversation } from '../types';
import { databaseService } from '../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalData } from '../contexts/GlobalDataContext';
import ExecutiveDashboardView from './ExecutiveDashboardView';
import AnnualGoalView from './AnnualGoalView';
import TeamProductivityWidget from './gestao/TeamProductivityWidget';
import { proposalTotals } from '../utils/proposalTotals';

export const parseDateSafely = (dateInput: any): Date | null => {
  if (!dateInput) return null;
  try {
    if (typeof dateInput.toDate === 'function') {
      const d = dateInput.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    if (dateInput instanceof Date) {
      return isNaN(dateInput.getTime()) ? null : dateInput;
    }
    if (typeof dateInput === 'string') {
      const d = new Date(dateInput);
      return isNaN(d.getTime()) ? null : d;
    }
    if (dateInput.seconds) {
      const d = new Date(dateInput.seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
};

interface DashboardProps {
  user: any;
}

export default function Dashboard({ user }: DashboardProps) {
  const isLocalAdmin = user.role === 'admin' || user.roles?.includes('admin');
  const hasFinancePermission = isLocalAdmin || user.permissions?.viewFinanceiro;
  const hasLucroPermission = isLocalAdmin || user.permissions?.viewLucro;

  const { 
    clientes, 
    chamados, 
    leads, 
    propostas, 
    metas, 
    tecnicos, 
    equipamentos, 
    conversations, 
    contasPagar,
    loading 
  } = useGlobalData();

  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'month' | 'year' | 'custom'>('month');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [execViewTab, setExecViewTab] = useState<'financeiro' | 'operacional'>('financeiro');
  const [showFixedDetails, setShowFixedDetails] = useState(false);

  // Derived data map for existing logic
  const data = useMemo(() => ({
    clientes,
    chamados,
    equipamentos,
    propostas,
    metas,
    tecnicos,
    leads,
    conversations,
    contasPagar
  }), [clientes, chamados, equipamentos, propostas, metas, tecnicos, leads, conversations, contasPagar]);

  // --- Real Overhauled Executive & Financial Calculations ---
  const execMetrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const clList = clientes || [];
    const propList = propostas || [];
    const leadList = leads || [];
    const cpList = contasPagar || [];
    const mtList = metas || [];

    // 1. FATURAMENTO REAL ATUAL
    // Suporte / MRR
    const monthlyRecurringRevenue = clList
      .filter(c => c.status === 'Ativo' && c.contratoValorMensal)
      .reduce((acc, c) => acc + (Number(c.contratoValorMensal) || 0), 0);

    // Filter proposals and leads closed in current month
    const acceptedPropostasThisMonth = propList.filter(p => {
      if (p.status !== 'Aprovado') return false;
      const dateStr = p.dataAprovacao || p.updatedAt || p.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const closedLeadsThisMonth = leadList.filter(l => {
      if (l.status !== 'Fechado') return false;
      const dateStr = l.dataFechamento || l.updatedAt || l.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const oneTimeRevenueThisMonth = acceptedPropostasThisMonth.reduce((acc, p) => acc + proposalTotals(p).investimentoInicial, 0) +
                                    closedLeadsThisMonth.reduce((acc, l) => acc + (Number(l.valorEstimado) || 0), 0);

    const faturamentoThisMonth = oneTimeRevenueThisMonth + monthlyRecurringRevenue;

    // 2. FATURAMENTO ANTERIOR (Mês Anterior)
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const acceptedPropostasPrevMonth = propList.filter(p => {
      if (p.status !== 'Aprovado') return false;
      const dateStr = p.dataAprovacao || p.updatedAt || p.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    });

    const closedLeadsPrevMonth = leadList.filter(l => {
      if (l.status !== 'Fechado') return false;
      const dateStr = l.dataFechamento || l.updatedAt || l.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    });

    const oneTimeRevenuePrevMonth = acceptedPropostasPrevMonth.reduce((acc, p) => acc + proposalTotals(p).investimentoInicial, 0) +
                                   closedLeadsPrevMonth.reduce((acc, l) => acc + (Number(l.valorEstimado) || 0), 0);

    const faturamentoPrevMonth = oneTimeRevenuePrevMonth + monthlyRecurringRevenue;

    const faturamentoGrowth = faturamentoPrevMonth > 0 ? ((faturamentoThisMonth - faturamentoPrevMonth) / faturamentoPrevMonth) * 100 : 0;

    // 3. DESPESAS TOTAIS (Este Mês)
    let totalFixas = 0;
    let totalVariaveis = 0;
    let totalDespesasPagas = 0;

    cpList.forEach(c => {
      const isRecurringNoDue = c.categoryType === 'fixa' && c.recorrenteSemVencimento === true;
      let isInCategoryInMonth = false;
      if (c.dataVencimento) {
        const d = new Date(c.dataVencimento);
        isInCategoryInMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }

      if (c.categoryType === 'fixa') {
        if (isInCategoryInMonth || isRecurringNoDue) {
          totalFixas += Number(c.valor) || 0;
          if (c.status === 'Pago') {
            totalDespesasPagas += Number(c.valor) || 0;
          }
        }
      } else {
        if (isInCategoryInMonth) {
          totalVariaveis += Number(c.valor) || 0;
          if (c.status === 'Pago') {
            totalDespesasPagas += Number(c.valor) || 0;
          }
        }
      }
    });

    const totalDespesasGeral = totalFixas + totalVariaveis;

    // Mês Anterior Despesas
    let prevFixas = 0;
    let prevVariaveis = 0;
    cpList.forEach(c => {
      const isRecurringNoDue = c.categoryType === 'fixa' && c.recorrenteSemVencimento === true;
      let isInCategoryInMonth = false;
      if (c.dataVencimento) {
        const d = new Date(c.dataVencimento);
        isInCategoryInMonth = d.getMonth() === prevMonth && d.getFullYear() === prevYear;
      }
      if (c.categoryType === 'fixa') {
        if (isInCategoryInMonth || isRecurringNoDue) {
          prevFixas += Number(c.valor) || 0;
        }
      } else {
        if (isInCategoryInMonth) {
          prevVariaveis += Number(c.valor) || 0;
        }
      }
    });
    const totalDespesasPrevMonth = prevFixas + prevVariaveis;

    // 4. LUCRO LÍQUIDO (Faturamento - Despesas)
    const lucroLiquidoThisMonth = faturamentoThisMonth - totalDespesasGeral;
    const lucroLiquidoPrevMonth = faturamentoPrevMonth - totalDespesasPrevMonth;
    const margemThisMonth = faturamentoThisMonth > 0 ? (lucroLiquidoThisMonth / faturamentoThisMonth) * 100 : 0;

    // 5. SAÚDE FINANCEIRA STATUS
    let saudeStatus: 'saudavel' | 'atencao' | 'deficit' = 'saudavel';
    if (lucroLiquidoThisMonth < 0) {
      saudeStatus = 'deficit';
    } else if (lucroLiquidoThisMonth >= 0 && totalDespesasGeral > 0 && faturamentoThisMonth / totalDespesasGeral <= 1.1) {
      saudeStatus = 'atencao';
    }

    // 6. METAS
    const currentMeta = mtList.find(m => m.mes === currentMonth + 1 && m.ano === currentYear && m.tipo === 'faturamento');
    const metaValor = currentMeta?.valorObjetivo || 50000;
    const metaPercent = metaValor > 0 ? (faturamentoThisMonth / metaValor) * 100 : 0;

    // Projection
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = now.getDate() || 1;
    const faturamentoProjetado = (faturamentoThisMonth / currentDay) * daysInMonth;

    return {
      faturamentoThisMonth,
      faturamentoPrevMonth,
      faturamentoGrowth,
      totalFixas,
      totalVariaveis,
      totalDespesasGeral,
      totalDespesasPagas,
      lucroLiquidoThisMonth,
      lucroLiquidoPrevMonth,
      margemThisMonth,
      saudeStatus,
      metaValor,
      metaPercent,
      faturamentoProjetado,
      saldoDisponivel: faturamentoThisMonth - totalDespesasPagas // Dinheiro que sobrou após pagar as despesas pagas
    };
  }, [clientes, propostas, leads, contasPagar, metas]);

  const isDateInPeriod = (dateStr: string | undefined | null) => {
    if (!dateStr) return false;
    const date = parseDateSafely(dateStr);
    if (!date) return false;
    const now = new Date();
    
    // Comparação usando strings de data local para evitar problemas de fuso horário em 'today'
    const dateLocal = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const nowLocal = now.toLocaleDateString('en-CA');
    
    if (selectedPeriod === 'today') {
      return dateLocal === nowLocal;
    }
    
    if (selectedPeriod === 'month') {
      return date.getMonth() === now.getMonth() && 
             date.getFullYear() === now.getFullYear();
    }
    
    if (selectedPeriod === 'year') {
      return date.getFullYear() === now.getFullYear();
    }
 
    if (selectedPeriod === 'custom') {
      // Garantir que a comparação de data customizada considere o dia inteiro
      const start = new Date(customDateRange.start + 'T00:00:00');
      const end = new Date(customDateRange.end + 'T23:59:59');
      return date >= start && date <= end;
    }
    
    return false;
  };
 
  // --- Cálculos Financeiros ---
  const financialMetrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
 
    const monthlyRecurringRevenue = data.clientes
      .filter(c => c.suporteAtivo && c.contratoValorMensal)
      .reduce((acc, c) => acc + (c.contratoValorMensal || 0), 0);
    
    const acceptedPropostasInPeriod = data.propostas
      .filter(p => {
        if (p.status !== 'Aprovado') return false;
        const dateStr = p.dataAprovacao || p.updatedAt || p.createdAt;
        return isDateInPeriod(dateStr);
      });
 
    const closedLeadsInPeriod = data.leads
      .filter(l => {
        if (l.status !== 'Fechado') return false;
        const dateStr = l.dataFechamento || l.updatedAt || l.createdAt;
        return isDateInPeriod(dateStr);
      });
 
    const oneTimeRevenuePropostas = acceptedPropostasInPeriod.reduce((acc, p) => acc + proposalTotals(p).investimentoInicial, 0);
    const oneTimeRevenueLeads = closedLeadsInPeriod.reduce((acc, l) => {
      const hasApprovedProposal = acceptedPropostasInPeriod.some(p => p.leadId === l.id);
      if (hasApprovedProposal) return acc;
      return acc + (Number(l.valorEstimado) || 0);
    }, 0);
    const oneTimeRevenue = oneTimeRevenuePropostas + oneTimeRevenueLeads;
    
    // Calcular receita do período de forma mais inteligente
    let periodRevenue = oneTimeRevenue;
    if (selectedPeriod === 'month') {
      periodRevenue += monthlyRecurringRevenue;
    } else if (selectedPeriod === 'year') {
      periodRevenue += monthlyRecurringRevenue * (now.getMonth() + 1);
    } else if (selectedPeriod === 'today') {
      // Para hoje, poderíamos mostrar a proporção diária ou apenas o one-time
      periodRevenue += monthlyRecurringRevenue / 30;
    } else if (selectedPeriod === 'custom') {
      // Proporção baseada no número de dias
      const start = new Date(customDateRange.start);
      const end = new Date(customDateRange.end);
      const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      periodRevenue += (monthlyRecurringRevenue / 30) * diffDays;
    }
    
    const activeClientsCount = data.clientes.filter(c => c.status === 'Ativo').length;
    const ticketMedio = activeClientsCount > 0 ? periodRevenue / activeClientsCount : 0;
    
    const accumulatedPropostasRevenue = data.propostas
      .filter(p => p.status === 'Aprovado' && parseDateSafely(p.dataAprovacao || p.updatedAt || p.createdAt || '')?.getFullYear() === currentYear)
      .reduce((acc, p) => acc + proposalTotals(p).investimentoInicial, 0);
 
    const accumulatedLeadsRevenue = data.leads
      .filter(l => l.status === 'Fechado' && parseDateSafely(l.dataFechamento || l.updatedAt || l.createdAt || '')?.getFullYear() === currentYear)
      .reduce((acc, l) => {
        const hasApprovedProposal = data.propostas.some(p => p.leadId === l.id && p.status === 'Aprovado' && parseDateSafely(p.dataAprovacao || p.updatedAt || p.createdAt || '')?.getFullYear() === currentYear);
        if (hasApprovedProposal) return acc;
        return acc + (Number(l.valorEstimado) || 0);
      }, 0);
 
    const accumulatedRevenue = accumulatedPropostasRevenue + accumulatedLeadsRevenue + (monthlyRecurringRevenue * (currentMonth + 1));
 
    const currentMeta = data.metas.find(m => m.mes === currentMonth + 1 && m.ano === currentYear && m.tipo === 'faturamento');
    const metaValor = currentMeta?.valorObjetivo || 50000;
    const metaPercent = metaValor > 0 ? (periodRevenue / metaValor) * 100 : 0;
 
    // Real-Time Despesas and Lucro Calculation
    const contasPagarList = data.contasPagar || [];
    const despesasInPeriod = contasPagarList.filter(c => {
      if (!c.dataVencimento) return false;
      const date = parseDateSafely(c.dataVencimento);
      if (!date) return false;
      const now = new Date();
      const dateLocal = date.toLocaleDateString('en-CA');
      const nowLocal = now.toLocaleDateString('en-CA');
 
      if (selectedPeriod === 'today') {
        return dateLocal === nowLocal;
      }
      if (selectedPeriod === 'month') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      if (selectedPeriod === 'year') {
        return date.getFullYear() === now.getFullYear();
      }
      if (selectedPeriod === 'custom') {
        return c.dataVencimento >= customDateRange.start && c.dataVencimento <= customDateRange.end;
      }
      return false;
    });
 
    const totalDespesas = despesasInPeriod.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    const totalDespesasPagas = despesasInPeriod.filter(c => c.status === 'Pago').reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    const lucroEstimado = periodRevenue - totalDespesas;
 
    // Comparação com mês anterior (Simulado baseado no gráfico)
    const prevMonthRevenue = 48000; 
    const revenueGrowth = prevMonthRevenue > 0 ? ((periodRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;
    
    // Média últimos meses (Simulado)
    const avgRevenueLastMonths = (42000 + 38000 + 45000 + 48000) / 4;
 
    return {
      monthlyRevenue: periodRevenue,
      accumulatedRevenue,
      ticketMedio,
      metaPercent,
      metaValor,
      mrr: monthlyRecurringRevenue,
      revenueGrowth,
      avgRevenueLastMonths,
      totalDespesas,
      totalDespesasPagas,
      lucroEstimado
    };
  }, [data.clientes, data.metas, data.propostas, data.leads, data.contasPagar, selectedPeriod, customDateRange]);

  // --- Cálculos Operacionais ---
  const operationalMetrics = useMemo(() => {
    const filteredChamados = data.chamados.filter(c => isDateInPeriod(c.createdAt));
    const total = filteredChamados.length;
    const open = filteredChamados.filter(c => c.status === 'aberto' || c.status === 'em_atendimento' || c.status === 'aguardando_peca').length;
    const closed = filteredChamados.filter(c => c.status === 'concluido').length;
    const critical = filteredChamados.filter(c => c.prioridade === 'critica' && c.status !== 'concluido').length;
    
    // SLA (24h)
    const closedInSla = filteredChamados.filter(c => {
      if (c.status !== 'concluido' || !c.dataFechamento || !c.createdAt) return false;
      const start = new Date(c.createdAt).getTime();
      const end = new Date(c.dataFechamento).getTime();
      return (end - start) < (24 * 60 * 60 * 1000);
    });

    const slaPercent = closed > 0 ? (closedInSla.length / closed) * 100 : 100;
    
    // Tempo Médio de Resolução (horas)
    const resolutionTimes = filteredChamados
      .filter(c => c.status === 'concluido' && c.dataFechamento && c.createdAt)
      .map(c => (new Date(c.dataFechamento!).getTime() - new Date(c.createdAt!).getTime()) / (1000 * 60 * 60));
    
    const avgResolutionTime = resolutionTimes.length > 0 
      ? resolutionTimes.reduce((acc, t) => acc + t, 0) / resolutionTimes.length 
      : 0;

    const overdue = filteredChamados.filter(c => {
      if (c.status === 'concluido' || c.status === 'cancelado') return false;
      const start = new Date(c.createdAt || '').getTime();
      const now = new Date().getTime();
      return (now - start) > (48 * 60 * 60 * 1000);
    }).length;

    return {
      total, open, closed, critical, slaPercent, overdue, avgResolutionTime
    };
  }, [data.chamados, selectedPeriod, customDateRange]);

  // --- Cálculos de Técnicos ---
  const technicalMetrics = useMemo(() => {
    const total = data.tecnicos.length;
    const available = data.tecnicos.filter(t => t.status === 'disponivel').length;
    const busy = data.tecnicos.filter(t => t.status === 'em_atendimento' || t.status === 'ocupado').length;
    
    const ranking = data.tecnicos.map(t => ({
      name: t.nome,
      closed: data.chamados.filter(c => c.tecnicoId === t.id && c.status === 'concluido' && isDateInPeriod(c.dataFechamento || c.updatedAt)).length,
      avgTime: 0 // Placeholder
    })).sort((a, b) => b.closed - a.closed).slice(0, 5);

    return { total, available, busy, ranking };
  }, [data.tecnicos, data.chamados, selectedPeriod, customDateRange]);

  // --- Cálculos Comerciais ---
  const atendimentoMetrics = useMemo(() => {
    const periodConversations = data.conversations.filter(c => isDateInPeriod(c.createdAt));
    return {
      total: periodConversations.length,
      new: periodConversations.filter(c => c.status === 'novo').length,
      waiting: periodConversations.filter(c => c.status === 'aguardando_cliente').length,
      convertedLead: periodConversations.filter(c => c.status === 'convertido_lead').length,
      convertedTicket: periodConversations.filter(c => c.status === 'convertido_chamado').length,
      unread: data.conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)
    };
  }, [data.conversations, selectedPeriod, customDateRange]);

  const commercialMetrics = useMemo(() => {
    const leadsInPeriod = data.leads.filter(l => isDateInPeriod(l.createdAt)).length;

    const propostasEnviadas = data.propostas.filter(p => p.status === 'Enviado' && isDateInPeriod(p.dataEnvio || p.createdAt)).length;
    const vendasFechadas = data.propostas.filter(p => p.status === 'Aprovado' && isDateInPeriod(p.dataAprovacao || p.updatedAt || p.createdAt)).length;
    const totalPropostas = data.propostas.filter(p => isDateInPeriod(p.createdAt)).length;
    const conversionRate = totalPropostas > 0 ? (vendasFechadas / totalPropostas) * 100 : 0;
    const pipelineValue = data.propostas.filter(p => ['Rascunho', 'Enviado'].includes(p.status)).reduce((acc, p) => acc + proposalTotals(p).investimentoInicial, 0);

    return { leadsThisMonth: leadsInPeriod, propostasEnviadas, vendasFechadas, conversionRate, pipelineValue };
  }, [data.propostas, data.leads, selectedPeriod, customDateRange]);

  // --- Cálculos de Equipamentos ---
  const equipmentMetrics = useMemo(() => {
    const total = data.equipamentos.length;
    const inOperation = data.equipamentos.filter(e => e.status === 'Em operação').length;
    const maintenance = data.equipamentos.filter(e => e.status === 'Em manutenção').length;
    const withFailure = data.equipamentos.filter(e => e.status === 'Com falha').length;
    const waitingPart = data.equipamentos.filter(e => e.status === 'Aguardando peça').length;
    const stopped = data.equipamentos.filter(e => e.status === 'Parado').length;
    const deactivated = data.equipamentos.filter(e => e.status === 'Desativado').length;

    // Falha recorrente: Equipamentos com mais de 2 chamados abertos no último mês
    const recurringFailures = data.equipamentos.filter(e => {
      const ticketCount = data.chamados.filter(c => c.equipamentoClienteId === e.id).length;
      return ticketCount > 2;
    }).length;

    const overduePreventives = data.equipamentos.filter(e => e.dataProximaPreventiva && new Date(e.dataProximaPreventiva) < new Date()).length;

    return { 
      total, 
      inOperation, 
      maintenance, 
      withFailure, 
      waitingPart, 
      stopped, 
      deactivated,
      recurringFailures, 
      overduePreventives 
    };
  }, [data.equipamentos, data.chamados]);

  // --- Sistema de Insights Inteligentes Categorizados ---
  const executiveInsights = useMemo(() => {
    const categories: Record<string, { message: string; type: 'error' | 'warning' | 'success'; action: string; cause?: string }[]> = {
      financeiro: [],
      operacional: [],
      comercial: []
    };

    // --- FINANCEIRO ---
    if (financialMetrics.metaPercent < 70) {
      categories.financeiro.push({
        message: `Faturamento ${financialMetrics.metaPercent.toFixed(0)}% da meta.`,
        type: 'error',
        cause: 'Baixo volume de novos contratos e rascunhos parados.',
        action: 'Revisar propostas em rascunho e cobrar retornos.'
      });
    } else if (financialMetrics.revenueGrowth < 0) {
      categories.financeiro.push({
        message: `Queda de ${Math.abs(financialMetrics.revenueGrowth).toFixed(1)}% vs mês anterior.`,
        type: 'warning',
        cause: 'Perda de contratos recorrentes ou redução de serviços extras.',
        action: 'Análise de Churn e retenção de clientes críticos.'
      });
    } else {
      categories.financeiro.push({
        message: 'Saúde financeira estável.',
        type: 'success',
        action: 'Manter controle de custos.'
      });
    }

    // --- OPERACIONAL ---
    if (operationalMetrics.overdue > 0) {
      categories.operacional.push({
        message: `${operationalMetrics.overdue} chamados em atraso crítico.`,
        type: 'error',
        cause: 'Sobrecarga da equipe técnica ou falhas em equipamentos recorrentes.',
        action: 'Escalar técnicos disponíveis para zerar fila de atrasos.'
      });
    } else if (operationalMetrics.slaPercent < 95) {
      categories.operacional.push({
        message: `SLA em ${operationalMetrics.slaPercent.toFixed(0)}% (Abaixo da meta).`,
        type: 'warning',
        cause: 'Tempo de resposta inicial elevado.',
        action: 'Otimizar triagem de chamados.'
      });
    } else {
      categories.operacional.push({
        message: 'Operação em alta performance.',
        type: 'success',
        action: 'Documentar processos de sucesso.'
      });
    }

    // --- COMERCIAL ---
    if (commercialMetrics.conversionRate < 15) {
      categories.comercial.push({
        message: `Conversão baixa: ${commercialMetrics.conversionRate.toFixed(1)}%.`,
        type: 'error',
        cause: 'Preço acima do mercado ou demora no envio de propostas.',
        action: 'Revisar tabela de preços e tempo de resposta comercial.'
      });
    } else if (commercialMetrics.leadsThisMonth < 5) {
      categories.comercial.push({
        message: 'Baixo volume de novos leads.',
        type: 'warning',
        cause: 'Falta de ações de marketing ou prospecção ativa.',
        action: 'Iniciar campanha de indicação com clientes ativos.'
      });
    } else {
      categories.comercial.push({
        message: 'Fluxo comercial saudável.',
        type: 'success',
        action: 'Focar em upsell na base atual.'
      });
    }

    return categories;
  }, [financialMetrics, operationalMetrics, commercialMetrics]);

  // --- Plano de Ação Automático ---
  const actionPlan = useMemo(() => {
    const actions: { id: string; task: string; priority: 'high' | 'medium' | 'low'; category: string }[] = [];
    
    if (operationalMetrics.overdue > 0) {
      actions.push({ id: '1', task: `Resolver ${operationalMetrics.overdue} chamados atrasados`, priority: 'high', category: 'Operacional' });
    }
    if (financialMetrics.metaPercent < 80) {
      actions.push({ id: '2', task: `Converter R$ ${(financialMetrics.metaValor - financialMetrics.monthlyRevenue).toLocaleString('pt-BR')} para bater meta`, priority: 'high', category: 'Financeiro' });
    }
    if (commercialMetrics.conversionRate < 20) {
      actions.push({ id: '3', task: 'Revisar propostas enviadas sem resposta há +3 dias', priority: 'medium', category: 'Comercial' });
    }
    if (equipmentMetrics.maintenance > 0) {
      actions.push({ id: '4', task: `Finalizar manutenção de ${equipmentMetrics.maintenance} equipamentos`, priority: 'medium', category: 'Equipamentos' });
    }
    
    return actions;
  }, [operationalMetrics, financialMetrics, commercialMetrics, equipmentMetrics]);

  // --- Dados para Gráficos ---
  const revenueChartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    return months.map((month, index) => {
      const monthRevenue = data.propostas
        .filter(p => {
          if (p.status !== 'Aprovado') return false;
          const date = new Date(p.dataAprovacao || p.updatedAt || p.createdAt || '');
          return date.getMonth() === index && date.getFullYear() === currentYear;
        })
        .reduce((acc, p) => acc + proposalTotals(p).investimentoInicial, 0) +
        data.leads
        .filter(l => {
          if (l.status !== 'Fechado') return false;
          const date = new Date(l.dataFechamento || l.updatedAt || l.createdAt || '');
          return date.getMonth() === index && date.getFullYear() === currentYear;
        })
        .reduce((acc, l) => acc + (l.valorEstimado || 0), 0);
        
      // Adicionar MRR se o mês já passou ou é o atual
      const recurring = (index <= now.getMonth()) ? financialMetrics.mrr : 0;
      
      const target = data.metas.find(m => m.mes === index + 1 && m.ano === currentYear && m.tipo === 'faturamento')?.valorObjetivo || 50000;
      
      return {
        name: month,
        revenue: monthRevenue + recurring,
        target
      };
    }).slice(0, now.getMonth() + 1);
  }, [data.propostas, data.leads, data.metas, financialMetrics.mrr]);

  const ticketStatusData = useMemo(() => [
    { name: 'No Prazo', value: Math.max(0, operationalMetrics.closed - operationalMetrics.overdue), color: '#10B981' },
    { name: 'Em Atraso', value: operationalMetrics.overdue, color: '#EF4444' },
    { name: 'Abertos', value: operationalMetrics.open, color: '#F59E0B' },
  ], [operationalMetrics]);

  const techPerformanceData = useMemo(() => technicalMetrics.ranking.map(t => ({
    name: t.name.split(' ')[0],
    tickets: t.closed
  })), [technicalMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-container-lowest">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-primary font-black uppercase tracking-widest text-xs">Carregando Painel Estratégico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-10 bg-surface-container-lowest min-h-screen animate-in fade-in duration-700">
      {/* Alerta Crítico (Banner Superior) */}
      <AnimatePresence>
        {(operationalMetrics.overdue > 0 || operationalMetrics.critical > 0) && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-error text-white p-4 rounded-3xl flex items-center justify-between shadow-xl shadow-error/20 overflow-hidden"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest">Ação Imediata Necessária</p>
                <p className="text-xs text-white/80 font-bold uppercase tracking-tight">
                  {operationalMetrics.overdue} chamados em atraso crítico e {operationalMetrics.critical} problemas de alta prioridade detectados.
                </p>
              </div>
            </div>
            <button className="px-6 py-2 bg-white text-error rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/90 transition-colors">
              Resolver Agora
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Profissional */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-8 bg-primary rounded-full"></div>
            <img 
              src="https://www.mundotechequipamentos.com.br/wp-content/uploads/2022/08/pic-logomarca-mundo-tech-neutra-preta-v1.png" 
              alt="Logo" 
              className="h-12 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-on-surface-variant text-sm font-medium">
            Painel de Controle Estratégico • {
              selectedPeriod === 'custom' 
                ? `${new Date(customDateRange.start + 'T00:00:00').toLocaleDateString('pt-BR')} - ${new Date(customDateRange.end + 'T00:00:00').toLocaleDateString('pt-BR')}`
                : selectedPeriod === 'today'
                ? `Hoje, ${new Date().toLocaleDateString('pt-BR')}`
                : selectedPeriod === 'year'
                ? `Ano de ${new Date().getFullYear()}`
                : new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            }
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-3 bg-surface-container-low px-6 py-3 rounded-2xl border border-surface-container-high">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest">Saúde do Negócio</p>
              <p className={`text-lg font-black ${operationalMetrics.slaPercent >= 90 && financialMetrics.metaPercent >= 80 ? 'text-success' : 'text-warning'}`}>
                {((operationalMetrics.slaPercent + Math.min(financialMetrics.metaPercent, 100)) / 2).toFixed(0)}%
              </p>
            </div>
            <div className="w-10 h-10 bg-surface-container-highest rounded-xl flex items-center justify-center">
              <Activity size={20} className={operationalMetrics.slaPercent >= 90 ? 'text-success' : 'text-warning'} />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-2xl border border-surface-container-high">
            <button 
              onClick={() => setSelectedPeriod('today')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${selectedPeriod === 'today' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-primary'}`}
            >
              Hoje
            </button>
            <button 
              onClick={() => setSelectedPeriod('month')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${selectedPeriod === 'month' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-primary'}`}
            >
              Este Mês
            </button>
            <button 
              onClick={() => setSelectedPeriod('year')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${selectedPeriod === 'year' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-primary'}`}
            >
              Ano
            </button>
            {selectedPeriod === 'custom' && (
              <button 
                onClick={() => setShowFilterModal(true)}
                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 animate-in zoom-in duration-300"
              >
                Personalizado
              </button>
            )}
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowFilterModal(!showFilterModal)}
              className={`p-3 border rounded-2xl transition-all ${showFilterModal || selectedPeriod === 'custom' ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container-low border-surface-container-high text-on-surface hover:bg-surface-container-high'}`}
            >
              <Filter size={20} />
            </button>

            <AnimatePresence>
              {showFilterModal && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-4 w-80 bg-surface-container-lowest border border-surface-container-high rounded-[32px] shadow-2xl p-6 z-50"
                >
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Filtrar por Data</p>
                      <button 
                        onClick={() => setShowFilterModal(false)}
                        className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                      >
                        <ChevronRight size={16} className="rotate-90" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2">Data Inicial</label>
                        <input 
                          type="date" 
                          value={customDateRange.start}
                          onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                          className="w-full bg-surface-container-low border border-surface-container-high rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2">Data Final</label>
                        <input 
                          type="date" 
                          value={customDateRange.end}
                          onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                          className="w-full bg-surface-container-low border border-surface-container-high rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={() => {
                          setSelectedPeriod('custom');
                          setShowFilterModal(false);
                        }}
                        className="flex-1 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
                      >
                        Aplicar Filtro
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedPeriod('month');
                          setShowFilterModal(false);
                        }}
                        className="px-4 py-3 bg-surface-container-high text-on-surface rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-surface-container-highest transition-colors"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* SELETOR DE ATALHOS / VISÕES (SOMENTE ADM/FINANCEIRO) */}
      {hasFinancePermission && (
        <div className="flex border-b border-surface-container-high pb-px gap-6 mb-2">
          <button 
            type="button"
            onClick={() => setExecViewTab('financeiro')}
            className={`pb-4 text-sm font-black uppercase tracking-wider relative transition-all ${
              execViewTab === 'financeiro' 
                ? 'text-primary' 
                : 'text-on-surface-variant hover:text-primary/80'
            }`}
          >
            📊 Painel Executivo & Saúde Financeira
            {execViewTab === 'financeiro' && (
              <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
          <button 
            type="button"
            onClick={() => setExecViewTab('operacional')}
            className={`pb-4 text-sm font-black uppercase tracking-wider relative transition-all ${
              execViewTab === 'operacional' 
                ? 'text-primary' 
                : 'text-on-surface-variant hover:text-primary/80'
            }`}
          >
            ⚙️ Painel Operações & Atendimento
            {execViewTab === 'operacional' && (
              <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>
      )}

      {selectedPeriod === 'year' ? (
        <AnnualGoalView user={user} />
      ) : hasFinancePermission && execViewTab === 'financeiro' ? (
        <ExecutiveDashboardView user={user} />
      ) : (
        <>
          {/* 1. INDICADORES FINANCEIROS (TOPO) / OPERACIONAIS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
            {hasFinancePermission ? (
              <>
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <HeroMetricCard 
                label={selectedPeriod === 'today' ? "Faturamento Hoje" : "Faturamento do Período"} 
                value={`R$ ${financialMetrics.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                trend={`${financialMetrics.revenueGrowth >= 0 ? '+' : ''}${financialMetrics.revenueGrowth.toFixed(1)}%`} 
                icon={CircleDollarSign} 
                description={`Média últimos meses: R$ ${financialMetrics.avgRevenueLastMonths.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
              />
              <div className="grid grid-rows-2 gap-6">
                <MetricCard 
                  label="Receita Recorrente (MRR)" 
                  value={`R$ ${financialMetrics.mrr.toLocaleString('pt-BR')}`} 
                  trend="Estável" 
                  icon={Zap} 
                  color="success"
                />
                <MetricCard 
                  label="Ticket Médio" 
                  value={`R$ ${financialMetrics.ticketMedio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} 
                  trend="-2.1%" 
                  icon={Target} 
                  color="info"
                />
              </div>
            </div>
            
            <GoalCard 
              percent={financialMetrics.metaPercent} 
              target={financialMetrics.metaValor} 
              current={financialMetrics.monthlyRevenue}
            />
          </>
        ) : (
          <div className="lg:col-span-3 bg-gradient-to-br from-primary/10 via-surface-container-low to-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-inner flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 bottom-0 w-48 h-48 bg-primary/5 rounded-full translate-x-12 translate-y-12 shrink-0"></div>
            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1.5 rounded-full">Painel de Operações</span>
              <h2 className="text-3xl font-black text-on-surface tracking-tighter leading-none pt-2">
                Bem-vindo de volta,<br />
                <span className="text-primary">{user.nome || 'Colaborador'}!</span>
              </h2>
              <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest opacity-75 pt-1">
                Acompanhe o andamento dos chamados e status de ativos em tempo real
              </p>
            </div>
          </div>
        )}

        <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Eficiência SLA</p>
            <div className={`p-2 rounded-xl ${operationalMetrics.slaPercent >= 95 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center flex-1 py-2">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-surface-container-highest"
                />
                <motion.circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={251.2}
                  initial={{ strokeDashoffset: 251.2 }}
                  animate={{ strokeDashoffset: 251.2 - (251.2 * operationalMetrics.slaPercent) / 100 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className={operationalMetrics.slaPercent >= 95 ? 'text-success' : 'text-error'}
                />
              </svg>
              <span className="absolute text-xl font-black">{operationalMetrics.slaPercent.toFixed(0)}%</span>
            </div>
            <p className="mt-4 text-[10px] font-black uppercase text-on-surface-variant tracking-widest">Meta: 95%</p>
          </div>
        </div>
      </div>

      {/* 1.1 INDICADORES FINANCEIROS ADICIONAIS (CONTAS E LUCRO EST.) */}
      {hasFinancePermission && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface-container-low p-6 rounded-[32px] border border-surface-container-high flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase text-on-surface-variant tracking-wider">Despesas Registradas</p>
              <h4 className="text-xl font-black mt-1">R$ {financialMetrics.totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
              <p className="text-[9px] text-[#54656f] mt-1 font-semibold uppercase">Pagas: R$ {financialMetrics.totalDespesasPagas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="w-10 h-10 bg-error/10 text-error rounded-xl flex items-center justify-center">
              <ArrowDownRight size={22} />
            </div>
          </div>

          <div className="bg-surface-container-low p-6 rounded-[32px] border border-surface-container-high flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase text-on-surface-variant tracking-wider">Lucro Líquido Estimado</p>
              <h4 className={`text-xl font-black mt-1 ${financialMetrics.lucroEstimado >= 0 ? 'text-success' : 'text-error'}`}>
                R$ {financialMetrics.lucroEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h4>
              <p className="text-[9px] text-[#54656f] mt-1 font-semibold uppercase">Faturamento líquido no período</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${financialMetrics.lucroEstimado >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
              <ArrowUpRight size={22} />
            </div>
          </div>

          <div className="bg-surface-container-low p-6 rounded-[32px] border border-surface-container-high flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase text-on-surface-variant tracking-wider">Saúde Financeira</p>
              <h4 className={`text-xl font-black mt-1 uppercase tracking-wider ${financialMetrics.lucroEstimado > 0 ? 'text-success' : financialMetrics.lucroEstimado === 0 ? 'text-[#06b6d4]' : 'text-error'}`}>
                {financialMetrics.lucroEstimado > 0 ? 'Saudável' : financialMetrics.lucroEstimado === 0 ? 'Equilibrado' : 'Atenção (Déficit)'}
              </h4>
              <div className="w-32 bg-surface-container-highest h-1 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full ${financialMetrics.lucroEstimado > 0 ? 'bg-success' : 'bg-error'}`} style={{ 
                  width: `${Math.min(Math.max((financialMetrics.lucroEstimado / (financialMetrics.monthlyRevenue || 1)) * 100, 0), 100)}%` 
                }}></div>
              </div>
            </div>
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Activity size={20} />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* COLUNA ESQUERDA (OPERACIONAL & GRÁFICOS) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Indicadores Operacionais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatusCard 
              label="Chamados Abertos" 
              value={operationalMetrics.open} 
              subValue={`${operationalMetrics.critical} críticos`}
              icon={Ticket} 
              status="warning" 
            />
            <StatusCard 
              label="Em Atraso" 
              value={operationalMetrics.overdue} 
              subValue="Ação necessária"
              icon={AlertTriangle} 
              status="error" 
            />
            <StatusCard 
              label="Resolução Média" 
              value={`${operationalMetrics.avgResolutionTime.toFixed(1)}h`} 
              subValue="Últimos 30 dias"
              icon={Clock} 
              status="info" 
            />
          </div>

          {/* Atendimento WhatsApp */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <MessageSquare size={24} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Atendimento WhatsApp</p>
                  <p className="text-xs font-bold text-primary">{atendimentoMetrics.total} Conversas</p>
                </div>
              </div>
              <div className="space-y-4 relative z-10">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-black text-on-surface tracking-tighter">{atendimentoMetrics.new}</p>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tight">Novos Atendimentos</p>
                  </div>
                  {atendimentoMetrics.unread > 0 && (
                    <div className="px-3 py-1 bg-error text-white rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                      {atendimentoMetrics.unread} não lidas
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-surface-container-highest rounded-2xl border border-surface-container-high">
                    <p className="text-sm font-black text-warning">{atendimentoMetrics.waiting}</p>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Aguardando</p>
                  </div>
                  <div className="p-3 bg-surface-container-highest rounded-2xl border border-surface-container-high">
                    <p className="text-sm font-black text-success">{atendimentoMetrics.total - atendimentoMetrics.new - atendimentoMetrics.waiting}</p>
                    <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Em Curso</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary">
                  <Target size={24} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Conversão Comercial</p>
                  <p className="text-xs font-bold text-secondary">Estratégia de Vendas</p>
                </div>
              </div>
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between p-4 bg-secondary/5 rounded-3xl border border-secondary/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary/10 rounded-xl text-secondary">
                      <TrendingUp size={16} />
                    </div>
                    <div>
                      <p className="text-lg font-black text-secondary">{atendimentoMetrics.convertedLead}</p>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tight">Convertidos em Lead</p>
                    </div>
                  </div>
                  <ArrowUpRight size={20} className="text-secondary" />
                </div>
                <div className="flex items-center justify-between p-4 bg-error/5 rounded-3xl border border-error/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-error/10 rounded-xl text-error">
                      <Headset size={16} />
                    </div>
                    <div>
                      <p className="text-lg font-black text-error">{atendimentoMetrics.convertedTicket}</p>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tight">Convertidos em Chamado</p>
                    </div>
                  </div>
                  <ArrowUpRight size={20} className="text-error" />
                </div>
              </div>
            </div>
          </div>

          {/* Assistência Técnica */}
          <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                <Wrench className="text-primary" />
                Assistência Técnica
              </h3>
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Parque Instalado: {equipmentMetrics.total}</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="p-4 bg-success/10 rounded-3xl border border-success/20">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 size={18} className="text-success" />
                  <span className="text-[10px] font-black text-success uppercase">Operação</span>
                </div>
                <p className="text-2xl font-black text-on-surface">{equipmentMetrics.inOperation}</p>
              </div>
              <div className="p-4 bg-error/10 rounded-3xl border border-error/20">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle size={18} className="text-error" />
                  <span className="text-[10px] font-black text-error uppercase">Com Falha</span>
                </div>
                <p className="text-2xl font-black text-on-surface">{equipmentMetrics.withFailure}</p>
              </div>
              <div className="p-4 bg-warning/10 rounded-3xl border border-warning/20">
                <div className="flex items-center justify-between mb-2">
                  <Clock size={18} className="text-warning" />
                  <span className="text-[10px] font-black text-warning uppercase">Aguardando Peça</span>
                </div>
                <p className="text-2xl font-black text-on-surface">{equipmentMetrics.waitingPart}</p>
              </div>
              <div className="p-4 bg-error/20 rounded-3xl border border-error/30">
                <div className="flex items-center justify-between mb-2">
                  <ShieldAlert size={18} className="text-error" />
                  <span className="text-[10px] font-black text-error uppercase">Prev. Vencidas</span>
                </div>
                <p className="text-2xl font-black text-on-surface">{equipmentMetrics.overduePreventives}</p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4 p-4 bg-surface-container-high rounded-3xl">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <Zap size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Falhas Recorrentes</p>
                  <p className="text-lg font-black text-on-surface">{equipmentMetrics.recurringFailures} Equipamentos</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-surface-container-high rounded-3xl">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  <Wrench size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Em Manutenção</p>
                  <p className="text-lg font-black text-on-surface">{equipmentMetrics.maintenance} Equipamentos</p>
                </div>
              </div>
            </div>
          </div>

          {/* Painel: Produtividade da Equipe */}
          <TeamProductivityWidget />

          {/* Gráfico Principal: Evolução de Faturamento */}
          {hasFinancePermission && (
            <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                  <BarChart3 className="text-primary" />
                  Evolução Financeira vs Meta
                </h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    <span className="text-[10px] font-bold uppercase text-on-surface-variant">Realizado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-surface-container-highest rounded-full"></div>
                    <span className="text-[10px] font-bold uppercase text-on-surface-variant">Meta</span>
                  </div>
                </div>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="revenue" fill="var(--color-primary)" fillOpacity={0.1} stroke="var(--color-primary)" strokeWidth={4} />
                    <Line type="monotone" dataKey="target" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Grid de Gráficos Secundários */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Status de Chamados */}
            <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high">
              <h3 className="text-lg font-black uppercase tracking-tight mb-6">Eficiência de Atendimento</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ticketStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {ticketStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 pt-4 border-t border-surface-container-high flex justify-between items-center">
                <div className="text-center">
                  <p className="text-[10px] font-black text-on-surface-variant uppercase">Tempo Médio</p>
                  <p className="text-lg font-black text-on-surface">{operationalMetrics.avgResolutionTime.toFixed(1)}h</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-on-surface-variant uppercase">Resolvidos</p>
                  <p className="text-lg font-black text-success">{operationalMetrics.closed}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-on-surface-variant uppercase">Pendentes</p>
                  <p className="text-lg font-black text-warning">{operationalMetrics.open}</p>
                </div>
              </div>
            </div>

            {/* Performance de Técnicos */}
            <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black uppercase tracking-tight">Ranking Técnicos</h3>
                <Award size={20} className="text-secondary" />
              </div>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={techPerformanceData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} width={60} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="tickets" fill="var(--color-secondary)" radius={[0, 10, 10, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                  <span className="text-on-surface-variant">Técnicos Ativos</span>
                  <span className="text-on-surface">{technicalMetrics.busy} / {technicalMetrics.total}</span>
                </div>
                <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-secondary" style={{ width: `${(technicalMetrics.busy / technicalMetrics.total) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Comercial & Pipeline */}
          <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                <Briefcase className="text-info" />
                Performance Comercial
              </h3>
              <div className="px-4 py-1.5 bg-info/10 text-info rounded-full text-[10px] font-black uppercase tracking-widest">
                Pipeline: R$ {commercialMetrics.pipelineValue.toLocaleString('pt-BR')}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <CommercialStat label="Leads no Mês" value={commercialMetrics.leadsThisMonth} icon={UsersIcon} />
              <CommercialStat label="Propostas" value={commercialMetrics.propostasEnviadas} icon={FileText} />
              <CommercialStat label="Vendas" value={commercialMetrics.vendasFechadas} icon={TrendingUp} />
              <CommercialStat label="Conversão" value={`${commercialMetrics.conversionRate.toFixed(1)}%`} icon={Activity} />
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA (INSIGHTS & ALERTAS) */}
        <div className="space-y-8">
          {/* Insight Estratégico Dinâmico Categorizado */}
          <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <Zap size={28} />
                </div>
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[9px] font-black uppercase tracking-widest">Painel Inteligente</span>
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-6 text-on-surface">Visão Executiva</h3>
              
              <div className="space-y-8">
                {Object.entries(executiveInsights).map(([category, items]: [string, any]) => (
                  <div key={category} className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant border-b border-surface-container-high pb-2">{category}</p>
                    {items.map((insight: any, idx: number) => (
                      <div key={idx} className="animate-in slide-in-from-right duration-500">
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                            insight.type === 'error' ? 'bg-error animate-pulse' : 
                            insight.type === 'warning' ? 'bg-warning' : 
                            'bg-success'
                          }`}></div>
                          <div>
                            <p className={`text-sm font-black uppercase tracking-tight ${
                              insight.type === 'error' ? 'text-error' : 
                              insight.type === 'warning' ? 'text-warning' : 
                              'text-on-surface'
                            }`}>
                              {insight.message}
                            </p>
                            {insight.cause && <p className="text-[10px] text-on-surface-variant font-medium mt-1 uppercase leading-tight">Causa: {insight.cause}</p>}
                            <div className="mt-2 px-3 py-1 bg-surface-container-high rounded-lg inline-block">
                              <p className="text-[9px] font-black uppercase tracking-widest text-primary">Ação: {insight.action}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Plano de Ação Automático */}
          <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm">
            <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2">
              <Target size={20} className="text-primary" />
              Plano de Ação Sugerido
            </h3>
            <div className="space-y-3">
              {actionPlan.map((action) => (
                <div key={action.id} className="p-4 bg-surface-container-high/50 rounded-2xl border border-surface-container-highest flex items-center justify-between group hover:border-primary/50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      action.priority === 'high' ? 'bg-error' : 
                      action.priority === 'medium' ? 'bg-warning' : 
                      'bg-info'
                    }`}></div>
                    <div>
                      <p className="text-xs font-black text-on-surface uppercase tracking-tight">{action.task}</p>
                      <p className="text-[9px] font-bold text-on-surface-variant uppercase">{action.category}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-on-surface-variant group-hover:translate-x-1 transition-transform" />
                </div>
              ))}
            </div>
          </div>

          {/* Pontos de Atenção (Automático) */}
          <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm">
            <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2 text-error">
              <AlertTriangle size={20} />
              Pontos de Atenção
            </h3>
            <div className="space-y-4">
              {operationalMetrics.overdue > 0 && (
                <AttentionItem 
                  title="Chamados Atrasados" 
                  desc={`${operationalMetrics.overdue} chamados fora do prazo`} 
                  type="error"
                />
              )}
              {equipmentMetrics.recurringFailures > 0 && (
                <AttentionItem 
                  title="Falha Recorrente" 
                  desc={`${equipmentMetrics.recurringFailures} equipamentos com problemas`} 
                  type="warning"
                />
              )}
              {data.clientes.filter(c => c.inadimplente).length > 0 && (
                <AttentionItem 
                  title="Inadimplência" 
                  desc={`${data.clientes.filter(c => c.inadimplente).length} clientes pendentes`} 
                  type="error"
                />
              )}
              {technicalMetrics.busy === technicalMetrics.total && (
                <AttentionItem 
                  title="Equipe Sobrecarregada" 
                  desc="Todos os técnicos em atendimento" 
                  type="warning"
                />
              )}
            </div>
          </div>

          {/* Oportunidades de Crescimento */}
          <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm">
            <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2 text-success">
              <TrendingUp size={20} />
              Oportunidades
            </h3>
            <div className="space-y-4">
              <OpportunityItem 
                title="Upsell de Contrato" 
                desc={`${data.clientes.filter(c => !c.suporteAtivo).length} clientes sem suporte ativo`} 
                icon={ArrowUpRight}
              />
              <OpportunityItem 
                title="Propostas Pendentes" 
                desc={`${data.propostas.filter(p => p.status === 'Enviado').length} orçamentos aguardando`} 
                icon={Briefcase}
              />
              <OpportunityItem 
                title="Upgrade de Frota" 
                desc={`${equipmentMetrics.deactivated} equipamentos parados`} 
                icon={Monitor}
              />
              <OpportunityItem 
                title="Novos Leads" 
                desc={`${commercialMetrics.leadsThisMonth} novos contatos este mês`} 
                icon={UserCheck}
              />
            </div>
          </div>

          {/* Gestão de Equipamentos */}
          <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm">
            <h3 className="text-lg font-black uppercase tracking-tight mb-6">Status da Frota</h3>
            <div className="space-y-6">
              <EquipmentBar label="Ativos" value={equipmentMetrics.inOperation} total={equipmentMetrics.total} color="bg-success" />
              <EquipmentBar label="Em Manutenção" value={equipmentMetrics.maintenance} total={equipmentMetrics.total} color="bg-warning" />
              <EquipmentBar label="Com Falha Recorrente" value={equipmentMetrics.recurringFailures} total={equipmentMetrics.total} color="bg-error" />
              <EquipmentBar label="Parados / Inativos" value={equipmentMetrics.deactivated} total={equipmentMetrics.total} color="bg-surface-container-highest" />
            </div>
            <div className="mt-6 pt-6 border-t border-surface-container-high">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase text-on-surface-variant">Total de Equipamentos</p>
                <p className="text-lg font-black text-on-surface">{equipmentMetrics.total}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

function HeroMetricCard({ label, value, trend, icon: Icon, description }: any) {
  return (
    <div className="bg-primary p-8 rounded-[40px] text-white shadow-2xl shadow-primary/20 relative overflow-hidden group">
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-8">
          <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md group-hover:scale-110 transition-transform">
            <Icon size={24} />
          </div>
          <div className="flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full backdrop-blur-md">
            <ArrowUpRight size={14} />
            <span className="text-[10px] font-black uppercase tracking-tighter">{trend}</span>
          </div>
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">{label}</p>
        <p className="text-4xl font-black tracking-tighter mb-2">{value}</p>
        <p className="text-[10px] font-medium text-white/50 uppercase tracking-widest">{description}</p>
      </div>
      <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
    </div>
  );
}

function GoalCard({ percent, target, current }: any) {
  const isAchieved = percent >= 100;
  const isWarning = percent >= 80 && percent < 100;

  return (
    <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Meta de Faturamento</p>
          <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isAchieved ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
            {isAchieved ? 'Atingida' : 'Em Progresso'}
          </div>
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-4xl font-black tracking-tighter ${isAchieved ? 'text-success' : isWarning ? 'text-warning' : 'text-on-surface'}`}>
            {percent.toFixed(1)}%
          </span>
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Concluído</span>
        </div>
        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
          Faltam R$ {Math.max(0, target - current).toLocaleString('pt-BR')}
        </p>
      </div>
      
      <div className="mt-8 space-y-4">
        <div className="h-4 bg-surface-container-highest rounded-full overflow-hidden relative">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percent, 100)}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={`h-full relative z-10 ${isAchieved ? 'bg-success' : isWarning ? 'bg-warning' : 'bg-primary'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20"></div>
          </motion.div>
          {/* Marcador de 80% */}
          <div className="absolute left-[80%] top-0 bottom-0 w-px bg-white/30 z-20"></div>
        </div>
        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
          <span>R$ 0</span>
          <span>R$ {(target / 1000).toFixed(0)}k</span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, trend, icon: Icon, color }: any) {
  const colorClasses: any = {
    primary: 'text-primary bg-primary/10',
    secondary: 'text-secondary bg-secondary/10',
    success: 'text-success bg-success/10',
    info: 'text-info bg-info/10',
  };

  return (
    <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high group hover:border-primary/30 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${colorClasses[color]} group-hover:scale-110 transition-transform`}>
          <Icon size={20} />
        </div>
        <span className={`text-[10px] font-black uppercase tracking-tighter ${trend.startsWith('+') ? 'text-success' : 'text-error'}`}>
          {trend}
        </span>
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{label}</p>
      <p className="text-2xl font-black text-on-surface">{value}</p>
    </div>
  );
}

function StatusCard({ label, value, subValue, icon: Icon, status }: any) {
  const statusClasses: any = {
    warning: 'border-warning/30 bg-warning/5 text-warning',
    error: 'border-error/30 bg-error/5 text-error',
    success: 'border-success/30 bg-success/5 text-success',
    info: 'border-info/30 bg-info/5 text-info',
  };

  return (
    <div className={`p-6 rounded-3xl border ${statusClasses[status]} flex items-center gap-4 group hover:scale-105 transition-all`}>
      <div className="p-3 bg-white rounded-2xl shadow-sm">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
        <p className="text-2xl font-black">{value}</p>
        <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">{subValue}</p>
      </div>
    </div>
  );
}

function CommercialStat({ label, value, icon: Icon }: any) {
  return (
    <div className="text-center space-y-3 p-4 rounded-2xl hover:bg-surface-container-high transition-colors">
      <div className="w-10 h-10 bg-surface-container-highest rounded-xl flex items-center justify-center mx-auto text-on-surface-variant">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{label}</p>
        <p className="text-xl font-black text-on-surface">{value}</p>
      </div>
    </div>
  );
}

function EquipmentBar({ label, value, total, color }: any) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
        <span className="text-on-surface-variant">{label}</span>
        <span className="text-on-surface">{value}</span>
      </div>
      <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${color} transition-all`}
        ></motion.div>
      </div>
    </div>
  );
}

function AttentionItem({ title, desc, type }: any) {
  const icons: any = {
    error: <AlertTriangle size={14} className="text-error" />,
    warning: <Clock size={14} className="text-warning" />,
    info: <Construction size={14} className="text-info" />,
  };

  const isCritical = type === 'error';

  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl bg-surface-container-high/30 border transition-all group ${isCritical ? 'border-error/30 hover:border-error' : 'border-surface-container-high/50 hover:border-primary/30'}`}>
      <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm ${isCritical ? 'animate-pulse' : ''}`}>
        {icons[type]}
      </div>
      <div>
        <p className={`text-xs font-black uppercase tracking-tight ${isCritical ? 'text-error' : 'text-on-surface'}`}>{title}</p>
        <p className="text-[10px] font-bold text-on-surface-variant uppercase">{desc}</p>
      </div>
    </div>
  );
}

function OpportunityItem({ title, desc, icon: Icon }: any) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-success/5 transition-colors cursor-pointer group">
      <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center group-hover:scale-110 transition-transform">
        <Icon size={14} />
      </div>
      <div>
        <p className="text-xs font-black text-on-surface uppercase tracking-tight">{title}</p>
        <p className="text-[10px] font-bold text-on-surface-variant uppercase">{desc}</p>
      </div>
    </div>
  );
}
