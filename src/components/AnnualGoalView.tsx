import { useState, useMemo, useRef } from 'react';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  CircleDollarSign, 
  Award, 
  Activity, 
  Plus, 
  Edit2, 
  Check, 
  X, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Zap, 
  Briefcase,
  Sliders,
  DollarSign,
  HelpCircle,
  Save,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { 
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, LineChart, Line, Legend, ComposedChart
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalData } from '../contexts/GlobalDataContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, addDoc, doc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Usuario } from '../types';
import { proposalTotals } from '../utils/proposalTotals';

interface AnnualGoalViewProps {
  user: any;
}

export default function AnnualGoalView({ user }: AnnualGoalViewProps) {
  const isLocalAdmin = user.role === 'admin' || user.roles?.includes('admin') || user.email === 'tercariol92@gmail.com';
  
  const { 
    clientes = [], 
    propostas = [], 
    metas = [], 
    contasPagar = [],
    loading 
  } = useGlobalData();

  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth(); // 0-indexed (0 = Jan, 11 = Dec)

  // Edit Goal state
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  // Quick Distribute State
  const [annualPresetTotal, setAnnualPresetTotal] = useState<string>('');
  const [isDistributing, setIsDistributing] = useState(false);

  // Month names list
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Derive MRR
  const mrr = useMemo(() => {
    return clientes
      .filter(c => c.suporteAtivo && c.contratoValorMensal)
      .reduce((acc, c) => acc + (c.contratoValorMensal || 0), 0);
  }, [clientes]);

  // Calculations per Month
  const yearlyRoadmap = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1; // 1-indexed

      // MRR is earned for months already arrived or elapsed
      const monthlyMRREarned = monthNum <= (currentMonthIdx + 1) ? mrr : 0;

      // 1. Proposals closed in that month
      const proposalsInMonth = propostas.filter(p => {
        if (p.status !== 'Aprovado') return false;
        const dateStr = p.dataAprovacao || p.updatedAt || p.createdAt;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getFullYear() === currentYear && (d.getMonth() + 1) === monthNum;
      });
      const proposalsValue = proposalsInMonth.reduce((sum, p) => sum + proposalTotals(p).investimentoInicial, 0);

      // 2. Expenses registered in that month
      const expensesInMonth = contasPagar.filter(c => {
        if (!c.dataVencimento && c.categoryType === 'fixa' && c.recorrenteSemVencimento) {
          // If recurring without due date, it generates cost every elapsed/active month
          return monthNum <= (currentMonthIdx + 1);
        }
        if (!c.dataVencimento) return false;
        const d = new Date(c.dataVencimento);
        return d.getFullYear() === currentYear && (d.getMonth() + 1) === monthNum;
      });
      const totalExpenses = expensesInMonth.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
      const paidExpenses = expensesInMonth.filter(c => c.status === 'Pago').reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

      // Meta for that month
      const metaObj = metas.find(m => m.ano === currentYear && m.mes === monthNum && m.tipo === 'faturamento');
      const targetValue = metaObj?.valorObjetivo || 50000; // default 50k if not configured

      const realizedFaturamento = proposalsValue + monthlyMRREarned;
      const margin = realizedFaturamento - totalExpenses;
      const percentAtingido = targetValue > 0 ? (realizedFaturamento / targetValue) * 100 : 0;

      let status: 'Superado' | 'Atingido' | 'Em Aberto' | 'Não Atingido' | 'Pendente' = 'Pendente';
      
      if (monthNum < (currentMonthIdx + 1)) {
        status = percentAtingido >= 100 ? 'Superado' : percentAtingido >= 80 ? 'Atingido' : 'Não Atingido';
      } else if (monthNum === (currentMonthIdx + 1)) {
        status = percentAtingido >= 100 ? 'Superado' : 'Em Aberto';
      } else {
        status = 'Pendente';
      }

      return {
        monthNum,
        monthName: monthNames[i],
        target: targetValue,
        realized: realizedFaturamento,
        expenses: totalExpenses,
        paidExpenses,
        netProfit: margin,
        percent: percentAtingido,
        status,
        mrrShare: monthlyMRREarned,
        dealsShare: proposalsValue
      };
    });
  }, [propostas, contasPagar, metas, mrr, currentYear, currentMonthIdx]);

  // Aggregate Metrics
  const summaryMetrics = useMemo(() => {
    const totalTarget = yearlyRoadmap.reduce((sum, m) => sum + m.target, 0);
    const totalRealized = yearlyRoadmap.reduce((sum, m) => sum + m.realized, 0);
    const totalExpenses = yearlyRoadmap.reduce((sum, m) => sum + m.expenses, 0);
    const totalProfit = totalRealized - totalExpenses;
    
    // Percentages
    const annualMetaPercent = totalTarget > 0 ? (totalRealized / totalTarget) * 100 : 0;
    const profitMargin = totalRealized > 0 ? (totalProfit / totalRealized) * 100 : 0;

    // Projected Year End based on average of elapsed months
    const elapsedMonthsList = yearlyRoadmap.filter(m => m.monthNum <= (currentMonthIdx + 1));
    const avgRealizedElapsed = elapsedMonthsList.length > 0 
      ? elapsedMonthsList.reduce((sum, m) => sum + m.realized, 0) / elapsedMonthsList.length 
      : 0;
    const annualProjection = avgRealizedElapsed * 12;

    return {
      totalTarget,
      totalRealized,
      totalExpenses,
      totalProfit,
      annualMetaPercent,
      profitMargin,
      annualProjection,
      avgMonthlyRevenue: avgRealizedElapsed
    };
  }, [yearlyRoadmap, currentMonthIdx]);

  // Cumulative Chart Data
  const chartDataCumulative = useMemo(() => {
    let cumTarget = 0;
    let cumRealized = 0;
    
    return yearlyRoadmap.map(m => {
      cumTarget += m.target;
      // Realized revenue accumulates, but future months are shown as pending flat or predicted line
      if (m.monthNum <= (currentMonthIdx + 1)) {
        cumRealized += m.realized;
      }

      return {
        name: m.monthName.slice(0, 3),
        'Meta Acumulada': Math.round(cumTarget),
        'Faturamento Realizado': m.monthNum <= (currentMonthIdx + 1) ? Math.round(cumRealized) : null,
        'Planejado Mensal': Math.round(m.target),
        'Realizado Mensal': Math.round(m.realized)
      };
    });
  }, [yearlyRoadmap, currentMonthIdx]);

  // Save Meta In Firestore
  const handleSaveMeta = async (monthNum: number) => {
    const parsedVal = parseFloat(editValue.replace(/\D/g, '')) / 100 || parseFloat(editValue);
    if (isNaN(parsedVal) || parsedVal < 0) {
      toast.error('Por favor, informe um valor de meta válido.');
      return;
    }

    if (!isLocalAdmin) {
      toast.error('Permissão negada. Apenas administradores podem atualizar metas.');
      return;
    }

    setIsSavingMeta(true);
    try {
      const q = query(
        collection(db, 'metas'),
        where('mes', '==', monthNum),
        where('ano', '==', currentYear),
        where('tipo', '==', 'faturamento')
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const docId = snap.docs[0].id;
        await updateDoc(doc(db, 'metas', docId), {
          valorObjetivo: parsedVal,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'metas'), {
          mes: monthNum,
          ano: currentYear,
          tipo: 'faturamento',
          valorObjetivo: parsedVal,
          createdAt: new Date().toISOString()
        });
      }

      toast.success(`Meta de ${monthNames[monthNum - 1]} atualizada para R$ ${parsedVal.toLocaleString('pt-BR')}!`);
      setEditingMonth(null);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar meta no banco de dados.');
    } finally {
      setIsSavingMeta(false);
    }
  };

  // Instantly Distribute Yearly Preset
  const handleQuickDistribute = async () => {
    const rawValue = parseFloat(annualPresetTotal);
    if (isNaN(rawValue) || rawValue <= 0) {
      toast.error('Informe um valor de meta anual total válido.');
      return;
    }

    if (!isLocalAdmin) {
      toast.error('Permissão negada. Apenas administradores podem configurar metas da corporação.');
      return;
    }

    setIsDistributing(true);
    try {
      const distributedMonthly = parseFloat((rawValue / 12).toFixed(2));
      
      // Perform sequential updates for all 12 months
      const promises = Array.from({ length: 12 }, async (_, i) => {
        const monthNum = i + 1;
        const q = query(
          collection(db, 'metas'),
          where('mes', '==', monthNum),
          where('ano', '==', currentYear),
          where('tipo', '==', 'faturamento')
        );
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const docId = snap.docs[0].id;
          return updateDoc(doc(db, 'metas', docId), {
            valorObjetivo: distributedMonthly,
            updatedAt: new Date().toISOString()
          });
        } else {
          return addDoc(collection(db, 'metas'), {
            mes: monthNum,
            ano: currentYear,
            tipo: 'faturamento',
            valorObjetivo: distributedMonthly,
            createdAt: new Date().toISOString()
          });
        }
      });

      await Promise.all(promises);
      toast.success(`Meta anual de R$ ${rawValue.toLocaleString('pt-BR')} distribuída igualmente entre os 12 meses!`);
      setAnnualPresetTotal('');
    } catch (e) {
      console.error(e);
      toast.error('Ocorreu um erro durante a distribuição automática.');
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. SEÇÃO DE HERO CARDS (PRODUÇÃO & ANUAL) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* CARD 1: FATURAMENTO ANUAL ACUMULADO */}
        <div className="bg-primary p-7 rounded-[32px] text-white shadow-xl shadow-primary/10 relative overflow-hidden group">
          <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                <Target size={20} />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-md">
                Meta do Ano
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-white/60 tracking-wider">Faturamento Anual Acumulado</p>
              <h3 className="text-2xl font-black font-mono tracking-tight mt-1">
                R$ {summaryMetrics.totalRealized.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-white/50 mt-1 uppercase tracking-wider font-semibold">
                Meta de R$ {summaryMetrics.totalTarget.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </p>
            </div>
            
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <div className="flex justify-between text-[10px] font-bold text-white/70">
                <span>Progresso Anual</span>
                <span>{summaryMetrics.annualMetaPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min(summaryMetrics.annualMetaPercent, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-white/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
        </div>

        {/* CARD 2: PROJEÇÃO PARA FINAL DO ANO */}
        <div className="bg-surface-container-low p-7 rounded-[32px] border border-surface-container-high shadow-xs relative overflow-hidden group">
          <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <Activity size={20} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
                Previsão YTD
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Projeção Final de {currentYear}</p>
              <h3 className="text-2xl font-black font-mono text-slate-900 tracking-tight mt-1">
                R$ {summaryMetrics.annualProjection.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                Média mensal até agora: R$ {summaryMetrics.avgMonthlyRevenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </p>
            </div>
            
            <p className="text-[9px] text-slate-400 leading-normal border-t border-slate-100 pt-3">
              Cálculo linear de fechamento estimado baseado nos primeiros {currentMonthIdx + 1} meses do ano fiscal.
            </p>
          </div>
        </div>

        {/* CARD 3: LUCRO LÍQUIDO E MARGEM */}
        <div className="bg-surface-container-low p-7 rounded-[32px] border border-surface-container-high shadow-xs relative overflow-hidden group">
          <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <CircleDollarSign size={20} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                summaryMetrics.profitMargin >= 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
              }`}>
                Margem {summaryMetrics.profitMargin.toFixed(0)}%
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Lucro Líquido Anual</p>
              <h3 className="text-2xl font-black font-mono text-emerald-600 tracking-tight mt-1">
                R$ {summaryMetrics.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                Despesas totais: R$ {summaryMetrics.totalExpenses.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </p>
            </div>
            
            <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold uppercase border-t border-slate-100 pt-3">
              <TrendingUp size={12} />
              <span>Operação com fluxo de caixa saudável</span>
            </div>
          </div>
        </div>

        {/* CARD 4: BASE RECORRENTE ESTÁVEL (MRR) */}
        <div className="bg-surface-container-low p-7 rounded-[32px] border border-surface-container-high shadow-xs relative overflow-hidden group">
          <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                <Zap size={20} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-100">
                Garantia MRR
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Receita Recorrente Mensal</p>
              <h3 className="text-2xl font-black font-mono text-slate-900 tracking-tight mt-1">
                R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                Forte âncora de entrada estável
              </p>
            </div>
            
            <p className="text-[9px] text-slate-400 leading-normal border-t border-slate-100 pt-3">
              Contribui com R$ {(mrr * 12).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ao final de 12 meses do ano fiscal.
            </p>
          </div>
        </div>

      </div>

      {/* 2. GRÁFICOS DE DESEMPENHO ANUAL TRILINGUAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* GRÁFICO 1: SENDA DE METAS CUMULATIVA */}
        <div className="bg-surface-container-low p-6 rounded-[32px] border border-surface-container-high shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Senda de Meta: Curva Acumulativa de Faturamento</h4>
              <p className="text-[10px] text-slate-500">Acompanhamento e tendência entre a meta ideal mensal e o consolidado acumulado</p>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDataCumulative} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRealized" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v >= 1000 ? `${v/1000}k` : v}`} />
                <Tooltip 
                  formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, '']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '15px' }} />
                <Area type="monotone" dataKey="Meta Acumulada" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTarget)" />
                <Area type="monotone" dataKey="Faturamento Realizado" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorRealized)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO 2: METAS INDIVIDUAIS POR MÊS */}
        <div className="bg-surface-container-low p-6 rounded-[32px] border border-surface-container-high shadow-sm">
          <div className="mb-6">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Metas Mensais Individuais</h4>
            <p className="text-[10px] text-slate-500">Comparação direta do mês a mês planejado vs. realizado</p>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataCumulative.slice(0, currentMonthIdx + 2)} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v/1000}k`} />
                <Tooltip 
                  formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, '']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '10px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
                <Bar dataKey="Planejado Mensal" name="Planejado" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="Realizado Mensal" name="Realizado" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. ROADMAP / TABELA DE ACOMPANHAMENTO DOS 12 MESES */}
      <div className="bg-surface-container-low rounded-[32px] border border-surface-container-high shadow-sm overflow-hidden">
        <div className="p-6 border-b border-surface-container-high flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Acompanhamento de Metas de {currentYear}</h4>
            <p className="text-[10px] text-slate-500">Detalhamento dos 12 meses das metas empresariais e desvios financeiros</p>
          </div>
          
          {/* PAINEL DE DISTRIBUIÇÃO RÁPIDA (ADMIN) */}
          {isLocalAdmin && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 w-full sm:w-auto">
              <input 
                type="number" 
                placeholder="Meta do Ano (Ex: 1000000)" 
                value={annualPresetTotal}
                onChange={(e) => setAnnualPresetTotal(e.target.value)}
                className="bg-transparent text-xs px-3 py-1.5 focus:outline-hidden text-slate-800 font-mono w-44"
              />
              <button
                onClick={handleQuickDistribute}
                disabled={isDistributing || !annualPresetTotal}
                className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                {isDistributing ? 'Processando...' : 'Distribuir nos 12 meses'}
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-4 px-6">Mês</th>
                <th className="py-4 px-4 text-right">Meta de Faturamento</th>
                <th className="py-4 px-4 text-right">Realizado Real</th>
                <th className="py-4 px-4 text-right">Desvios (Meta vs Real)</th>
                <th className="py-4 px-4 text-right">Atingimento</th>
                <th className="py-4 px-4">Status</th>
                {isLocalAdmin && <th className="py-4 px-6 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {yearlyRoadmap.map((month) => {
                const diff = month.realized - month.target;
                const isOver = diff >= 0;
                
                return (
                  <tr key={month.monthNum} className={`hover:bg-slate-50/50 transition-colors ${month.monthNum === currentMonthIdx + 1 ? 'bg-primary/5 font-medium' : ''}`}>
                    <td className="py-4 px-6 font-bold text-slate-800 flex items-center gap-2">
                      <span>{month.monthName}</span>
                      {month.monthNum === currentMonthIdx + 1 && (
                        <span className="text-[8px] bg-primary text-white font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">Atual</span>
                      )}
                    </td>
                    
                    {/* META (EDITAVEL) */}
                    <td className="py-4 px-4 text-right">
                      {editingMonth === month.monthNum ? (
                        <div className="flex justify-end items-center gap-1.5">
                          <input 
                            type="text" 
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="bg-white border rounded-lg px-2 py-1 text-right font-mono"
                            style={{ width: '100px' }}
                            autoFocus
                          />
                          <button 
                            disabled={isSavingMeta}
                            onClick={() => handleSaveMeta(month.monthNum)}
                            className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 cursor-pointer"
                          >
                            <Check size={12} />
                          </button>
                          <button 
                            onClick={() => setEditingMonth(null)}
                            className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono text-slate-600 font-semibold">
                          R$ {month.target.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>

                    {/* REALIZADO */}
                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-900">
                      R$ {month.realized.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>

                    {/* DESVIOS */}
                    <td className={`py-4 px-4 text-right font-mono font-bold ${isOver ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {month.realized > 0 || month.target > 0 ? (
                        <span className="flex items-center justify-end gap-1">
                          {isOver ? '+' : '-'} R$ {Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          {isOver ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* % ATINGIMENTO */}
                    <td className="py-4 px-4 text-right font-mono">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`font-bold ${month.percent >= 100 ? 'text-indigo-600' : month.percent >= 80 ? 'text-indigo-500' : 'text-slate-500'}`}>
                          {month.percent.toFixed(1)}%
                        </span>
                        <div className="w-12 bg-slate-100 h-1 rounded-full overflow-hidden hidden md:block">
                          <div 
                            className={`h-full rounded-full ${month.percent >= 100 ? 'bg-indigo-600' : 'bg-slate-400'}`}
                            style={{ width: `${Math.min(month.percent, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* STATUS BADGE */}
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        month.status === 'Superado' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                        month.status === 'Atingido' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        month.status === 'Em Aberto' ? 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse' :
                        month.status === 'Não Atingido' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                        'bg-slate-50 text-slate-400 border border-slate-100'
                      }`}>
                        {month.status}
                      </span>
                    </td>

                    {/* ACOES EDIT (ADMIN) */}
                    {isLocalAdmin && (
                      <td className="py-4 px-6 text-center">
                        {editingMonth !== month.monthNum && (
                          <button
                            onClick={() => {
                              setEditingMonth(month.monthNum);
                              setEditValue(month.target.toString());
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary transition-all cursor-pointer"
                            title="Editar meta deste mês"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
