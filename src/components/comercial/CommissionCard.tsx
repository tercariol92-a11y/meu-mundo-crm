import React, { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { 
  DollarSign, 
  Target, 
  TrendingUp, 
  ChevronRight, 
  AlertCircle,
  Clock,
  CheckCircle2,
  PieChart as PieChartIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CommissionStats {
  totalVendasMes: number;
  valorTotalMes: number;
  comissaoGanha: number;
  comissaoPrevista: number;
  metaMensal: number;
  atingimentoMeta: number;
  podeVerComissao: boolean;
}

export default function CommissionCard({ userId }: { userId: string }) {
  const [stats, setStats] = useState<CommissionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    // Refresh every 5 minutes or on demand
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId]);

  const fetchStats = async () => {
    const data = await databaseService.getVendedorStats(userId);
    if (data) {
      setStats(data as CommissionStats);
    }
    setLoading(false);
  };

  if (loading) return null;
  if (!stats || !stats.podeVerComissao) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-surface-container-low rounded-[2rem] border border-surface-container-high p-6 shadow-xl shadow-black/5 w-full max-w-[320px] shrink-0"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp size={18} />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Desempenho Comercial</h3>
          </div>
          <button onClick={fetchStats} className="p-1 hover:bg-surface-container-high rounded-full transition-colors">
            <Clock size={12} className="text-on-surface-variant" />
          </button>
        </div>

        {/* Total Vendido */}
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Vendido no Mês</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-on-surface tracking-tighter">
              {formatCurrency(stats.valorTotalMes)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-black text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full border border-surface-container-highest">
              {stats.totalVendasMes} Vendas
            </span>
          </div>
        </div>

        {/* Comissões */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="p-3 bg-green-100/50 rounded-2xl border border-green-200/50 group hover:bg-green-100 transition-all">
            <div className="flex items-center gap-1 text-green-600 mb-1">
              <CheckCircle2 size={12} />
              <span className="text-[8px] font-black uppercase tracking-widest">Ganha</span>
            </div>
            <p className="text-sm font-black text-green-700">{formatCurrency(stats.comissaoGanha)}</p>
          </div>
          <div className="p-3 bg-blue-100/50 rounded-2xl border border-blue-200/50 group hover:bg-blue-100 transition-all">
            <div className="flex items-center gap-1 text-blue-600 mb-1">
              <Clock size={12} />
              <span className="text-[8px] font-black uppercase tracking-widest">Prevista</span>
            </div>
            <p className="text-sm font-black text-blue-700">{formatCurrency(stats.comissaoPrevista)}</p>
          </div>
        </div>

        {/* Meta */}
        <div className="space-y-3 pt-4 border-t border-surface-container-high">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-primary" />
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">Meta Mensal</p>
            </div>
            <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
              {stats.atingimentoMeta.toFixed(1)}%
            </span>
          </div>
          
          <div className="relative h-2.5 w-full bg-surface-container-high rounded-full overflow-hidden border border-surface-container-highest">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(stats.atingimentoMeta, 100)}%` }}
              className={`h-full relative ${stats.atingimentoMeta >= 100 ? 'bg-green-500' : 'bg-primary'}`}
            >
               <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
            </motion.div>
          </div>

          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-on-surface-variant mt-1.5">
            <span>Objetivo: {formatCurrency(stats.metaMensal)}</span>
            <span className={stats.atingimentoMeta >= 100 ? 'text-green-600' : 'text-primary'}>
              {stats.atingimentoMeta >= 100 ? 'META ATINGIDA!' : `Faltam ${formatCurrency(Math.max(0, stats.metaMensal - stats.valorTotalMes))}`}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button className="w-full py-4 bg-surface-container-high rounded-2xl flex items-center justify-center gap-2 group hover:bg-primary hover:text-white transition-all shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] group-hover:translate-x-1 transition-all">Ver Detalhes do Período</span>
          <ChevronRight size={14} className="group-hover:translate-x-1 transition-all" />
        </button>
      </div>
    </motion.div>
  );
}
