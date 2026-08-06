import React, { useState, useMemo } from 'react';
import { Lead, Proposta, MotivoPerda, Usuario } from '../../types';
import { useGlobalData } from '../../contexts/GlobalDataContext';
import { 
  Users, 
  FileText, 
  CheckCircle2, 
  TrendingUp, 
  DollarSign, 
  XCircle,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  AlertCircle,
  ChevronRight,
  Target,
  Clock,
  PieChart as PieIcon,
  Filter,
  Eye,
  EyeOff,
  Loader2,
  CalendarDays
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { onSnapshot, collection } from '../../services/resilientFirestoreClient';
import { db } from '../../firebase';
import { proposalTotals } from '../../utils/proposalTotals';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  isWithinInterval, 
  parseISO 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CommercialDashboardProps {
  user: Usuario;
}

type PeriodType = 'today' | 'week' | 'month' | 'lastMonth' | 'custom';

export default function CommercialDashboard({ user }: CommercialDashboardProps) {
  const { 
    leads, 
    propostas: quotes, 
    motivosPerda: lossReasons, 
    usuarios: users, 
    loading 
  } = useGlobalData();

  const [selectedSellerId, setSelectedSellerId] = useState<string>(user.id);
  const [viewType, setViewType] = useState<'individual' | 'geral'>(
    user.role === 'admin' || user.roles?.includes('gerente_comercial') ? 'geral' : 'individual'
  );
  
  // Period filter states
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isAdmin = user.role === 'admin' || user.roles?.includes('gerente_comercial');
  const canViewLucro = user.permissions?.viewLucro || user.role === 'admin';
  const canViewComissao = user.permissions?.viewComissao || user.role === 'admin';

  // Helper to get start and end dates for the period
  const dateRange = useMemo(() => {
    const now = new Date();
    let start = startOfMonth(now);
    let end = endOfMonth(now);

    switch (periodType) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'week':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case 'custom':
        start = startOfDay(parseISO(customStartDate));
        end = endOfDay(parseISO(customEndDate));
        break;
    }

    return { start, end };
  }, [periodType, customStartDate, customEndDate]);

  const summaryLabel = useMemo(() => {
    const sellerName = viewType === 'geral' ? 'Geral' : (users.find(u => u.id === selectedSellerId)?.nome || 'Colaborador');
    let periodText = '';

    switch (periodType) {
      case 'today': periodText = 'Hoje'; break;
      case 'week': periodText = 'esta Semana'; break;
      case 'month': periodText = format(new Date(), 'MMMM/yyyy', { locale: ptBR }); break;
      case 'lastMonth': periodText = format(subMonths(new Date(), 1), 'MMMM/yyyy', { locale: ptBR }); break;
      case 'custom': periodText = `de ${format(dateRange.start, 'dd/MM/yy')} até ${format(dateRange.end, 'dd/MM/yy')}`; break;
    }

    return `Resultado de ${sellerName} em ${periodText}`;
  }, [viewType, users, selectedSellerId, periodType, dateRange]);

  // Filtered data based on selection and period
  const filteredData = useMemo(() => {
    let filteredLeads = leads;
    let filteredQuotes = quotes;

    // 1. Seller Filtering
    if (viewType === 'individual') {
      filteredLeads = leads.filter(l => l.responsavelId === selectedSellerId);
      filteredQuotes = quotes.filter(q => q.vendedorId === selectedSellerId);
    } else if (!isAdmin) {
      filteredLeads = leads.filter(l => l.responsavelId === user.id);
      filteredQuotes = quotes.filter(q => q.vendedorId === user.id);
    }

    // 2. Period Filtering
    const filterByDate = (dateStr: string | undefined) => {
      if (!dateStr) return false;
      try {
        const date = parseISO(dateStr);
        return isWithinInterval(date, { start: dateRange.start, end: dateRange.end });
      } catch (e) {
        return false;
      }
    };

    filteredLeads = filteredLeads.filter(l => {
      // Use dataFechamento for closed leads, otherwise createdAt or updatedAt
      const dateToUse = l.status === 'Fechado' ? l.dataFechamento : (l.createdAt || l.updatedAt);
      return filterByDate(dateToUse);
    });

    filteredQuotes = filteredQuotes.filter(q => {
      // Use dataAprovacao for approved quotes, otherwise createdAt or updatedAt
      const dateToUse = q.status === 'Aprovado' ? q.dataAprovacao : (q.createdAt || q.updatedAt);
      return filterByDate(dateToUse);
    });

    return { leads: filteredLeads, quotes: filteredQuotes };
  }, [leads, quotes, selectedSellerId, viewType, isAdmin, user.id, dateRange]);

  const stats = useMemo(() => {
    const closedQuotes = filteredData.quotes.filter(q => q.status === 'Aprovado');
    const inNegotiationQuotes = filteredData.quotes.filter(q => q.status === 'Em negociação');
    
    const closedTotals = closedQuotes.map(proposalTotals);
    const negotiationTotals = inNegotiationQuotes.map(proposalTotals);
    const valorVendido = closedTotals.reduce((acc, total) => acc + total.investimentoInicial, 0);
    const valorEmNegociacao = negotiationTotals.reduce((acc, total) => acc + total.investimentoInicial, 0);
    const produtosVendidos = closedTotals.reduce((acc, total) => acc + total.totalProdutos, 0);
    const servicosVendidos = closedTotals.reduce((acc, total) => acc + total.totalServicos, 0);
    const mrr = closedTotals.reduce((acc, total) => acc + total.totalMensal, 0);
    const arr = closedTotals.reduce((acc, total) => acc + total.totalAnual, 0);
    
    // Profit Calculation (Only if allowed)
    let lucroTotal = 0;
    if (canViewLucro) {
       lucroTotal = closedQuotes.reduce((acc, q) => {
         const custo = q.itens?.reduce((cAcc, item) => cAcc + ((item.custoUnitario || 0) * item.quantidade), 0) || 0;
         return acc + (proposalTotals(q).investimentoInicial - custo);
       }, 0);
    }

    // Commission logic for individual view
    let comissaoGanha = 0;
    let comissaoPrevista = 0;
    let metaMensal = 0;
    let comissaoRateText = 'N/A';
    let displayCommission = true;

    if (viewType === 'individual') {
      const seller = users.find(u => u.id === selectedSellerId);
      if (seller) {
        metaMensal = seller.monthlyGoal || seller.metaMensal || 0;
        
        // Visibility logic
        const isSelf = seller.id === user.id;
        const canView = seller.canViewCommission !== undefined ? seller.canViewCommission : (seller.podeVerComissao !== undefined ? seller.podeVerComissao : false);
        
        if (isSelf && !isAdmin && !canView) {
           displayCommission = false;
        }

        const type = seller.commissionType || (seller.tipoComissao === 'percentual' ? 'percent' : seller.tipoComissao === 'fixo' ? 'fixed' : 'none');
        
        // Final visibility rule: must have module permission AND if individual, respects the "canViewCommission" flag for sellers
        if (!canViewComissao) {
          displayCommission = false;
        } else if (isSelf && !isAdmin && !canView) {
          displayCommission = false;
        }

        if (type === 'percent') {
          const rate = seller.commissionRate || seller.comissaoPadrao || 0;
          const commissionFor = (totals: ReturnType<typeof proposalTotals>[]) => totals.reduce((sum, total) => sum
            + total.totalProdutos * ((seller.commissionProductRate ?? rate) / 100)
            + total.totalServicos * ((seller.commissionServiceRate ?? rate) / 100)
            + total.totalMensal * ((seller.commissionMonthlyRate ?? rate) / 100)
            + total.totalAnual * ((seller.commissionAnnualRate ?? rate) / 100), 0);
          comissaoGanha = commissionFor(closedTotals);
          comissaoPrevista = commissionFor(negotiationTotals);
          comissaoRateText = `${rate}% base`;
        } else if (type === 'fixed') {
          const val = seller.commissionFixedValue || seller.valorFixoComissao || 0;
          comissaoGanha = closedQuotes.length * val;
          comissaoPrevista = inNegotiationQuotes.length * val;
          comissaoRateText = `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }
      }
    }

    return {
      vendasFechadas: closedQuotes.length,
      valorVendido,
      emNegociacaoCount: inNegotiationQuotes.length,
      valorEmNegociacao,
      lucroTotal,
      produtosVendidos,
      servicosVendidos,
      mrr,
      arr,
      propostasMensais: closedTotals.filter(total => total.hasMonthly).length,
      propostasAnuais: closedTotals.filter(total => total.hasAnnual).length,
      comissaoGanha,
      comissaoPrevista,
      comissaoRateText,
      metaMensal,
      atingimentoMeta: metaMensal > 0 ? (valorVendido / metaMensal) * 100 : 0,
      displayCommission
    };
  }, [filteredData, viewType, selectedSellerId, users, canViewLucro]);

  const topSellers = useMemo(() => {
    if (viewType === 'individual') return [];
    
    const sellerStats: Record<string, { id: string, name: string, value: number, count: number }> = {};
    filteredData.quotes.filter(q => q.status === 'Aprovado').forEach(q => {
      if (!q.vendedorId) return;
      const seller = users.find(u => u.id === q.vendedorId);
      if (!sellerStats[q.vendedorId]) {
        sellerStats[q.vendedorId] = { id: q.vendedorId, name: seller?.nome || 'Desconhecido', value: 0, count: 0 };
      }
      sellerStats[q.vendedorId].value += proposalTotals(q).investimentoInicial;
      sellerStats[q.vendedorId].count += 1;
    });

    return Object.values(sellerStats).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [filteredData.quotes, users, viewType]);

  const funnelData = useMemo(() => {
    const l = filteredData.leads;
    return [
      { name: 'Total Leads', value: l.length },
      { name: 'Qualificados', value: l.filter(le => ['Qualificado', 'Proposta enviada', 'Negociação', 'Fechado'].includes(le.status)).length },
      { name: 'Propostas', value: l.filter(le => ['Proposta enviada', 'Negociação', 'Fechado'].includes(le.status)).length },
      { name: 'Fechado', value: l.filter(le => le.status === 'Fechado').length },
    ];
  }, [filteredData]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );

  return (
    <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar h-[calc(100vh-64px)] bg-surface">
      {/* Period Filter Toggle */}
      <div className="flex flex-col space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <CalendarDays className="text-primary" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60 leading-none mb-1">Período de Análise</p>
              <h2 className="text-sm font-black text-on-surface uppercase tracking-tight">{summaryLabel}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-2xl border border-surface-container-high">
            {(['today', 'week', 'month', 'lastMonth'] as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriodType(p);
                  setShowDatePicker(false);
                }}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  periodType === p && !showDatePicker ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Ant.'}
              </button>
            ))}
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                showDatePicker || periodType === 'custom' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Personalizado
            </button>
          </div>
        </div>

        <AnimatePresence>
          {(showDatePicker || periodType === 'custom') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high flex flex-wrap items-center gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant ml-2">Data Inicial</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setPeriodType('custom');
                    }}
                    className="bg-white/50 border border-surface-container-high px-4 py-2 rounded-xl text-xs font-bold outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant ml-2">Data Final</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setPeriodType('custom');
                    }}
                    className="bg-white/50 border border-surface-container-high px-4 py-2 rounded-xl text-xs font-bold outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="flex-1" />
                <button 
                  onClick={() => {
                    setPeriodType('custom');
                    setShowDatePicker(false);
                  }}
                  className="px-6 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Aplicar Filtro
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-px bg-surface-container-highest opacity-50" />

      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-on-surface">Métricas Comerciais</h1>
          <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Resultados e performance em tempo real</p>
        </div>

        <div className="flex items-center gap-3 bg-surface-container-low p-1.5 rounded-2xl border border-surface-container-high shadow-inner">
          {isAdmin && (
            <button
              onClick={() => setViewType('geral')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                viewType === 'geral' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Visão Geral
            </button>
          )}
          <button
            onClick={() => setViewType('individual')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              viewType === 'individual' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Individual
          </button>
        </div>
      </div>

      {/* Seller Selector for Admin/Gerente */}
      {isAdmin && viewType === 'individual' && (
        <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-[2rem] border border-surface-container-high">
          <Filter size={18} className="text-primary" />
          <div className="flex-1">
            <select
              className="w-full bg-transparent text-sm font-black uppercase tracking-widest outline-none"
              value={selectedSellerId}
              onChange={(e) => setSelectedSellerId(e.target.value)}
            >
              {users.filter(u => u.roles?.includes('vendedor') || u.role === 'vendedor' || u.role === 'admin').map(u => (
                <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Vendas Fechadas" 
          value={stats.vendasFechadas} 
          icon={<CheckCircle2 size={20} />} 
          color="bg-green-500"
        />
        <StatCard 
          title="Valor Vendido" 
          value={formatCurrency(stats.valorVendido)} 
          icon={<DollarSign size={20} />} 
          color="bg-primary"
        />
        <StatCard 
          title="Em Negociação" 
          value={formatCurrency(stats.valorEmNegociacao)} 
          icon={<Clock size={20} />} 
          color="bg-blue-500"
        />
        {canViewLucro ? (
          <StatCard 
            title="Lucro Acumulado" 
            value={formatCurrency(stats.lucroTotal)} 
            icon={<TrendingUp size={20} />} 
            color="bg-purple-500"
          />
        ) : (
          <div className="bg-surface-container-low border border-dashed border-surface-container-highest p-6 rounded-[2rem] flex flex-col items-center justify-center text-on-surface-variant opacity-40">
            <EyeOff size={24} className="mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">Lucro Restrito</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Produtos vendidos" value={formatCurrency(stats.produtosVendidos)} icon={<DollarSign size={20} />} color="bg-emerald-500" />
        <StatCard title="Serviços vendidos" value={formatCurrency(stats.servicosVendidos)} icon={<FileText size={20} />} color="bg-cyan-500" />
        <StatCard title={`MRR (${stats.propostasMensais} propostas)`} value={`${formatCurrency(stats.mrr)}/mês`} icon={<TrendingUp size={20} />} color="bg-blue-500" />
        <StatCard title={`ARR (${stats.propostasAnuais} propostas)`} value={`${formatCurrency(stats.arr)}/ano`} icon={<CalendarDays size={20} />} color="bg-purple-500" />
      </div>

      {/* Commission and Goals Section (Individual View) */}
      {viewType === 'individual' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface-container-low border border-surface-container-high rounded-[2.5rem] p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Target size={24} className="text-primary" />
                  <h3 className="text-lg font-black uppercase tracking-tight">Status da Meta Mensal</h3>
                </div>
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                  Objetivo: {formatCurrency(stats.metaMensal)}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-4xl font-black tracking-tighter text-on-surface">
                    {stats.atingimentoMeta.toFixed(1)}% <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Ate o momento</span>
                  </p>
                  <p className="text-xs font-bold text-on-surface-variant">
                    Faltam {formatCurrency(Math.max(0, stats.metaMensal - stats.valorVendido))}
                  </p>
                </div>
                <div className="h-4 w-full bg-surface-container-highest rounded-full overflow-hidden p-1 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(stats.atingimentoMeta, 100)}%` }}
                    className={`h-full rounded-full ${stats.atingimentoMeta >= 100 ? 'bg-green-500' : 'bg-primary'} relative`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                  </motion.div>
                </div>
              </div>
            </div>

            {stats.displayCommission ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-100/50 border border-green-200/50 p-6 rounded-[2rem] flex items-center justify-between group hover:bg-green-100 transition-all">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-1">Comissão Ganha</p>
                    <p className="text-2xl font-black text-green-700">{formatCurrency(stats.comissaoGanha)}</p>
                  </div>
                  <CheckCircle2 size={32} className="text-green-500 opacity-20 group-hover:opacity-40 transition-all" />
                </div>
                <div className="bg-blue-100/50 border border-blue-200/50 p-6 rounded-[2rem] flex items-center justify-between group hover:bg-blue-100 transition-all">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Comissão Prevista</p>
                    <p className="text-2xl font-black text-blue-700">{formatCurrency(stats.comissaoPrevista)}</p>
                  </div>
                  <Clock size={32} className="text-blue-500 opacity-20 group-hover:opacity-40 transition-all" />
                </div>
              </div>
            ) : (
              <div className="bg-surface-container-high/30 border border-dashed border-surface-container-high p-12 rounded-[2rem] flex flex-col items-center justify-center text-center">
                <EyeOff size={32} className="text-on-surface-variant opacity-20 mb-4" />
                <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant opacity-60">Visualização de Comissão Restrita</p>
                <p className="text-[10px] font-medium text-on-surface-variant opacity-40 mt-1 max-w-[200px]">Contate seu administrador para liberar o acesso aos seus ganhos.</p>
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest border border-surface-container-high rounded-[2.5rem] p-8 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4">Configuração Atual</p>
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
                  <span className="text-xs font-bold text-on-surface-variant uppercase">Taxa de Comissão</span>
                  <span className="text-sm font-black text-primary">{stats.displayCommission ? stats.comissaoRateText : '---'}</span>
                </div>
                <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
                  <span className="text-xs font-bold text-on-surface-variant uppercase">Tipo de Acesso</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {users.find(u => u.id === selectedSellerId)?.roles?.map(r => (
                      <span key={r} className="px-2 py-0.5 rounded-full bg-surface-container-high text-[8px] font-black uppercase tracking-widest">{r}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp size={16} className="text-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Performance</p>
              </div>
              <p className="text-xs font-bold text-on-surface-variant leading-relaxed">
                {stats.atingimentoMeta >= 100 
                  ? "Excelente! Meta batida. Continue mantendo esse rítmo para maximizar seus ganhos."
                  : `Continue assim! Você já atingiu ${stats.atingimentoMeta.toFixed(1)}% do seu objetivo para este período.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container-low border border-surface-container-high rounded-[2.5rem] p-8">
           <div className="flex items-center justify-between mb-8">
             <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Funil de Conversão</h3>
             <BarChart3 size={20} className="text-on-surface-variant opacity-40" />
           </div>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={funnelData} layout="vertical">
                 <XAxis type="number" hide />
                 <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 10, fontWeight: 900, fill: 'var(--on-surface-variant)' }} />
                 <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                 <Bar dataKey="value" fill="var(--primary)" radius={[0, 8, 8, 0]} barSize={24} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {viewType === 'geral' && (
          <div className="bg-surface-container-low border border-surface-container-high rounded-[2.5rem] p-8">
             <div className="flex items-center justify-between mb-8">
               <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Top Vendedores</h3>
               <Users size={20} className="text-on-surface-variant opacity-40" />
             </div>
             <div className="space-y-4">
               {topSellers.map((seller, i) => (
                 <div key={seller.id} className="flex items-center justify-between p-4 bg-surface-container-highest/20 rounded-2xl border border-surface-container-high">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-xs shadow-lg shadow-primary/20">
                       {i + 1}
                     </div>
                     <div>
                       <p className="text-xs font-black uppercase tracking-tight text-on-surface">{seller.name}</p>
                       <p className="text-[10px] font-bold text-on-surface-variant">{seller.count} vendas aprovadas</p>
                     </div>
                   </div>
                   <p className="text-sm font-black text-primary">{formatCurrency(seller.value)}</p>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-surface-container-low border border-surface-container-high p-6 rounded-[2rem] hover:shadow-xl hover:shadow-black/5 transition-all group">
      <div className={`w-12 h-12 ${color} text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-black/5 group-hover:scale-110 transition-all`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60 mb-1">{title}</p>
        <h3 className="text-2xl font-black tracking-tighter text-on-surface">{value}</h3>
      </div>
    </div>
  );
}
