import { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { Chamado, Tecnico } from '../../types';
import { 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  ChevronRight,
  MapPin,
  Smartphone
} from 'lucide-react';
import { motion } from 'framer-motion';

interface TechDashboardProps {
  tecnico: Tecnico;
  onViewCall: (callId: string) => void;
  onViewAll: () => void;
}

export default function TechDashboard({ tecnico, onViewCall, onViewAll }: TechDashboardProps) {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await databaseService.getChamadosByTecnico(tecnico.id);
        setChamados(data || []);
      } catch (error) {
        console.error('Error loading technical dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [tecnico.id]);

  const stats = {
    today: chamados.filter(c => {
      if (!c.createdAt) return false;
      const today = new Date().toISOString().split('T')[0];
      return c.createdAt.split('T')[0] === today && c.status !== 'finalizado';
    }).length,
    delayed: chamados.filter(c => c.isLate && c.status !== 'finalizado').length,
    completed: chamados.filter(c => c.status === 'finalizado').length,
    pending: chamados.filter(c => c.status !== 'finalizado' && c.status !== 'cancelado').length
  };

  const nextCalls = chamados
    .filter(c => c.status !== 'finalizado' && c.status !== 'cancelado')
    .slice(0, 3);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-20">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-on-surface tracking-tight uppercase">Olá, {tecnico.nome.split(' ')[0]}!</h1>
          <p className="text-sm text-on-surface-variant font-bold uppercase tracking-widest">Painel Técnico</p>
        </div>
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm">
          <Smartphone size={24} />
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          whileTap={{ scale: 0.95 }}
          className="bg-primary/5 p-4 rounded-3xl border border-primary/10 flex flex-col justify-between aspect-square"
        >
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-2">
            <Calendar size={20} />
          </div>
          <div>
            <span className="text-2xl font-black text-primary block">{stats.today}</span>
            <span className="text-[10px] text-primary/60 font-black uppercase tracking-widest">Chamados Hoje</span>
          </div>
        </motion.div>

        <motion.div 
          whileTap={{ scale: 0.95 }}
          className="bg-error/5 p-4 rounded-3xl border border-error/10 flex flex-col justify-between aspect-square"
        >
          <div className="w-10 h-10 bg-error/10 rounded-xl flex items-center justify-center text-error mb-2">
            <AlertCircle size={20} />
          </div>
          <div>
            <span className="text-2xl font-black text-error block">{stats.delayed}</span>
            <span className="text-[10px] text-error/60 font-black uppercase tracking-widest">Atrasados</span>
          </div>
        </motion.div>

        <motion.div 
          whileTap={{ scale: 0.95 }}
          className="bg-success/5 p-4 rounded-3xl border border-success/10 flex flex-col justify-between aspect-square"
        >
          <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center text-success mb-2">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-2xl font-black text-success block">{stats.completed}</span>
            <span className="text-[10px] text-success/60 font-black uppercase tracking-widest">Finalizados</span>
          </div>
        </motion.div>

        <motion.div 
          whileTap={{ scale: 0.95 }}
          className="bg-surface-container-high p-4 rounded-3xl border border-outline flex flex-col justify-between aspect-square"
          onClick={onViewAll}
        >
          <div className="w-10 h-10 bg-surface-container-highest rounded-xl flex items-center justify-center text-on-surface-variant mb-2">
            <ClipboardList size={20} />
          </div>
          <div>
            <span className="text-2xl font-black text-on-surface block">{stats.pending}</span>
            <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Em Aberto</span>
          </div>
        </motion.div>
      </div>

      {/* Next Appointments */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em]">Próximos Atendimentos</h2>
          <button onClick={onViewAll} className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline">Ver Todos</button>
        </div>

        <div className="space-y-3">
          {nextCalls.length > 0 ? (
            nextCalls.map((call) => (
              <motion.div
                key={call.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => onViewCall(call.id)}
                className="bg-surface-container-lowest p-4 rounded-3xl border border-surface-container-high shadow-sm flex items-center gap-4 group active:bg-surface-container-high transition-colors"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  call.prioridade === 'critica' || call.prioridade === 'alta' 
                    ? 'bg-error/10 text-error' 
                    : 'bg-primary/10 text-primary'
                }`}>
                  <Clock size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-on-surface truncate pr-2">{call.cliente?.nomeFantasia || 'Cliente'}</h4>
                  <div className="flex items-center gap-1.5 text-on-surface-variant">
                    <MapPin size={12} className="shrink-0" />
                    <p className="text-xs truncate">{call.unidade?.cidade || 'Local não informado'} - {call.unidade?.estado || ''}</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-on-surface-variant opacity-30 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))
          ) : (
            <div className="bg-surface-container-low p-8 rounded-3xl border border-dashed border-outline flex flex-col items-center justify-center text-center">
              <ClipboardList size={32} className="text-on-surface-variant/20 mb-3" />
              <p className="text-sm text-on-surface-variant font-medium">Nenhum chamado pendente para hoje.</p>
            </div>
          )}
        </div>
      </section>

      {/* Quick Action Button - Floating alternative if needed, but we used grid */}
    </div>
  );
}
