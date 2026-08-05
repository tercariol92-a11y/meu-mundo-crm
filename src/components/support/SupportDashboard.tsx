import { 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar,
  Bell,
  ArrowRight,
  MessageSquare,
  Mail,
  Zap,
  Activity,
  User,
  Timer,
  BarChart3,
  Flame,
  ChevronRight,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chamado, Reminder, User as UserType } from '../../types';
import { format, differenceInMinutes, differenceInHours, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SupportDashboardProps {
  chamados: Chamado[];
  reminders: Reminder[];
  onFilterChange: (filter: any) => void;
  currentFilter: string;
  onNewTicket: () => void;
  user: UserType;
}

export default function SupportDashboard({ 
  chamados, 
  reminders, 
  onFilterChange,
  currentFilter,
  onNewTicket,
  user
}: SupportDashboardProps) {
  // Stats calculation
  const activeChamados = chamados.filter(c => c.status !== 'concluido' && c.status !== 'cancelado');
  const delayedChamados = activeChamados.filter(c => c.slaDeadline && new Date(c.slaDeadline) < new Date());
  
  const stats = {
    abertos: chamados.filter(c => c.status === 'aberto').length,
    emAtendimento: chamados.filter(c => c.status === 'em_atendimento').length,
    aguardandoCliente: chamados.filter(c => c.status === 'aguardando_cliente').length,
    aguardandoPeca: chamados.filter(c => c.status === 'aguardando_peca').length,
    atrasados: delayedChamados.length,
    finalizadosHoje: chamados.filter(c => c.status === 'concluido' && c.dataFechamento && isToday(new Date(c.dataFechamento))).length,
    totalHoje: chamados.filter(c => c.createdAt && isToday(new Date(c.createdAt))).length
  };

  // Health Score Calculation
  const healthScore = activeChamados.length === 0 ? 100 : 
    Math.round(((activeChamados.length - delayedChamados.length) / activeChamados.length) * 100);

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-error';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 90) return 'Saudável';
    if (score >= 70) return 'Alerta';
    return 'Crítico';
  };

  // Performance Metrics
  const resolvedToday = chamados.filter(c => c.status === 'concluido' && c.dataFechamento && isToday(new Date(c.dataFechamento)));
  const avgSla = "94%"; // Mock for now or calculate if possible
  const avgServiceTime = "2.4h"; // Mock

  // Critical Alerts
  const criticalAlerts = [
    ...delayedChamados.map(c => ({
      id: `late-${c.id}`,
      type: 'critical',
      title: 'SLA Estourado',
      message: `${c.cliente?.nomeFantasia || 'Cliente'} - ${c.titulo}`,
      icon: AlertTriangle,
      time: c.slaDeadline ? format(new Date(c.slaDeadline), 'HH:mm') : ''
    })),
    ...activeChamados.filter(c => c.prioridade === 'critica').map(c => ({
      id: `crit-${c.id}`,
      type: 'warning',
      title: 'Prioridade Crítica',
      message: `${c.cliente?.nomeFantasia || 'Cliente'} - ${c.titulo}`,
      icon: Flame,
      time: ''
    }))
  ].slice(0, 4);

  // Priorities of the Day
  const priorities = chamados
    .filter(c => c.status !== 'concluido' && (c.prioridade === 'critica' || c.prioridade === 'alta' || (c.slaDeadline && new Date(c.slaDeadline) < new Date())))
    .sort((a, b) => {
      const aScore = (a.prioridade === 'critica' ? 100 : a.prioridade === 'alta' ? 50 : 0) + (a.slaDeadline && new Date(a.slaDeadline) < new Date() ? 30 : 0);
      const bScore = (b.prioridade === 'critica' ? 100 : b.prioridade === 'alta' ? 50 : 0) + (b.slaDeadline && new Date(b.slaDeadline) < new Date() ? 30 : 0);
      return bScore - aScore;
    })
    .slice(0, 5);

  // Reminders Timeline
  const todayReminders = reminders
    .filter(r => isToday(new Date(r.dateTime)))
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  return (
    <div className="space-y-8">
      {/* 1. TOPO COM IMPACTO (HEADER INTELIGENTE) */}
      <div className="bg-surface-container rounded-[40px] p-8 border border-surface-container-high shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Activity size={24} />
              </div>
              <h1 className="text-4xl font-black text-on-surface uppercase tracking-tighter">Suporte Técnico</h1>
            </div>
            <p className="text-on-surface-variant font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Você tem <span className="text-primary">{activeChamados.length} chamados ativos</span> e <span className="text-error">{delayedChamados.length} em atraso</span> hoje.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            {/* Health Indicator */}
            <div className="flex items-center gap-4 bg-surface-container-low px-6 py-4 rounded-3xl border border-surface-container-high">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-surface-container-highest" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={126} strokeDashoffset={126 - (126 * healthScore) / 100} className={`${getHealthColor(healthScore)} transition-all duration-1000`} />
                </svg>
                <span className={`absolute text-[10px] font-black ${getHealthColor(healthScore)}`}>{healthScore}%</span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Saúde do Suporte</p>
                <p className={`text-sm font-black uppercase ${getHealthColor(healthScore)}`}>{getHealthLabel(healthScore)}</p>
              </div>
            </div>

            <button 
              onClick={onNewTicket}
              className="bg-primary text-on-primary px-8 py-5 rounded-[28px] font-black uppercase tracking-widest text-xs flex items-center gap-3 hover:scale-105 transition-all shadow-2xl shadow-primary/30 active:scale-95"
            >
              <Plus size={20} /> Novo Chamado
            </button>
          </div>
        </div>
      </div>

      {/* 2. CARDS PRINCIPAIS (ESTILO MODERNO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {[
          { id: 'aberto', label: 'Abertos', value: stats.abertos, icon: Clock, color: 'text-success', bg: 'bg-success/10', barColor: 'bg-success' },
          { id: 'em_atendimento', label: 'Em Atendimento', value: stats.emAtendimento, icon: TrendingUp, color: 'text-secondary', bg: 'bg-secondary/10', barColor: 'bg-secondary' },
          { id: 'aguardando_cliente', label: 'Aguardando Cliente', value: stats.aguardandoCliente, icon: MessageSquare, color: 'text-warning', bg: 'bg-warning/10', barColor: 'bg-warning' },
          { id: 'aguardando_peca', label: 'Aguardando Peça', value: stats.aguardandoPeca, icon: Zap, color: 'text-orange-500', bg: 'bg-orange-500/10', barColor: 'bg-orange-500' },
          { id: 'atrasados', label: 'Atrasados', value: stats.atrasados, icon: AlertTriangle, color: 'text-white', bg: 'bg-error', barColor: 'bg-white/30', isCritical: true },
          { id: 'concluido', label: 'Finalizados Hoje', value: stats.finalizadosHoje, icon: CheckCircle2, color: 'text-on-surface', bg: 'bg-surface-container-highest', barColor: 'bg-on-surface' },
          { id: 'todos', label: 'Chamados do Dia', value: stats.totalHoje, icon: Calendar, color: 'text-on-surface', bg: 'bg-surface-container-low', barColor: 'bg-primary' }
        ].map((stat, i) => (
          <motion.button 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onFilterChange(stat.id)}
            className={`relative overflow-hidden rounded-[32px] p-5 border transition-all flex flex-col gap-4 text-left group h-full ${
              stat.isCritical ? 'bg-error border-error shadow-lg shadow-error/20' : 
              currentFilter === stat.id ? 'bg-surface-container-high border-primary ring-2 ring-primary/10' : 
              'bg-surface-container border-surface-container-high hover:border-primary/50'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.bg} ${stat.color} ${stat.isCritical ? 'bg-white/20' : ''}`}>
              <stat.icon size={24} />
            </div>
            
            <div className="space-y-1">
              <p className={`text-[10px] font-black uppercase tracking-widest ${stat.isCritical ? 'text-white/80' : 'text-on-surface-variant'}`}>
                {stat.label}
              </p>
              <h3 className={`text-3xl font-black ${stat.isCritical ? 'text-white' : 'text-on-surface'}`}>
                {stat.value}
              </h3>
            </div>

            <div className="mt-auto pt-2">
              <div className={`h-1.5 w-full rounded-full ${stat.isCritical ? 'bg-white/20' : 'bg-surface-container-highest'}`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '60%' }} // Mock percentage
                  className={`h-full rounded-full ${stat.barColor}`}
                />
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Alerts & Priorities */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* 3. BLOCO DE ALERTAS (ESTILO PRIORIDADE MÁXIMA) */}
          <div className="bg-error/5 rounded-[40px] p-8 border border-error/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <AlertTriangle size={120} className="text-error" />
            </div>
            
            <div className="relative">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black uppercase tracking-tighter text-error flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-error text-white flex items-center justify-center animate-pulse">
                    <Bell size={18} />
                  </div>
                  Alertas Críticos
                </h3>
                <span className="bg-error text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {criticalAlerts.length} Ativos
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {criticalAlerts.length === 0 ? (
                  <div className="col-span-2 py-8 text-center bg-white/50 rounded-3xl border border-dashed border-error/20">
                    <p className="text-xs font-bold text-error/60 uppercase tracking-widest">Nenhum alerta crítico no momento</p>
                  </div>
                ) : (
                  criticalAlerts.map((alert) => (
                    <motion.div 
                      key={alert.id}
                      whileHover={{ scale: 1.02 }}
                      className="bg-white rounded-3xl p-5 border border-error/10 shadow-sm flex items-center gap-4 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-error/10 text-error flex items-center justify-center shrink-0">
                        <alert.icon size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-tight text-error">{alert.title}</p>
                          {alert.time && <span className="text-[10px] font-bold text-on-surface-variant">{alert.time}</span>}
                        </div>
                        <p className="text-sm font-bold text-on-surface truncate">{alert.message}</p>
                      </div>
                      <ChevronRight size={18} className="text-on-surface-variant group-hover:translate-x-1 transition-transform" />
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 4. CHAMADOS IMPORTANTES DO DIA (DE VERDADE) */}
          <div className="bg-surface-container rounded-[40px] p-8 border border-surface-container-high">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black uppercase tracking-tighter text-on-surface flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center">
                  <Flame size={18} />
                </div>
                Prioridades do Dia
              </h3>
              <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Ver todos</button>
            </div>
            
            <div className="space-y-3">
              {priorities.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic py-4">Nenhuma prioridade urgente listada.</p>
              ) : (
                priorities.map((ticket, i) => (
                  <motion.div 
                    key={ticket.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-surface-container-low rounded-3xl p-5 flex items-center justify-between group hover:bg-surface-container-high transition-all cursor-pointer border border-surface-container-high"
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-1.5 h-12 rounded-full ${
                        ticket.prioridade === 'critica' ? 'bg-error' : 
                        ticket.prioridade === 'alta' ? 'bg-warning' : 'bg-primary'
                      }`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-on-surface uppercase tracking-tight">{ticket.titulo}</p>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                            ticket.prioridade === 'critica' ? 'bg-error text-white' : 
                            ticket.prioridade === 'alta' ? 'bg-warning/20 text-warning' : 'bg-primary/10 text-primary'
                          }`}>
                            {ticket.prioridade}
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant font-medium">
                          {ticket.cliente?.nomeFantasia} • {ticket.equipamentoCliente?.tipo} • SLA: {ticket.slaDeadline ? format(new Date(ticket.slaDeadline), 'HH:mm', { locale: ptBR }) : '---'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">Técnico</p>
                        <p className="text-xs font-bold text-on-surface">{ticket.tecnico?.nome || '---'}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                        <ChevronRight size={20} />
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Reminders & Performance */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* 5. LEMBRETES (ESTILO AGENDA) */}
          <div className="bg-surface-container rounded-[40px] p-8 border border-surface-container-high flex flex-col h-full">
            <h3 className="text-lg font-black uppercase tracking-tighter text-on-surface flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-secondary text-white flex items-center justify-center">
                <Calendar size={18} />
              </div>
              Timeline do Dia
            </h3>
            
            <div className="flex-1 relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-surface-container-highest" />
              
              <div className="space-y-8 relative">
                {todayReminders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                    <Clock size={48} className="mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Agenda Livre</p>
                  </div>
                ) : (
                  todayReminders.map((reminder, i) => (
                    <div key={i} className="flex gap-6 group">
                      <div className="relative z-10">
                        <div className={`w-6 h-6 rounded-full border-4 border-surface-container flex items-center justify-center ${
                          reminder.completed ? 'bg-success' : 'bg-primary'
                        }`}>
                          {reminder.completed && <CheckCircle2 size={10} className="text-white" />}
                        </div>
                      </div>
                      <div className="flex-1 -mt-1">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">
                          {format(new Date(reminder.dateTime), 'HH:mm')}
                        </p>
                        <div className={`p-4 rounded-3xl border transition-all ${
                          reminder.completed ? 'bg-surface-container-low border-surface-container-high opacity-60' : 'bg-surface-container-high border-primary/10 hover:border-primary/30'
                        }`}>
                          <p className="text-xs font-black uppercase tracking-tight text-on-surface">{reminder.type}</p>
                          <p className="text-xs text-on-surface-variant font-medium mt-1">{reminder.description}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 6. VISÃO DE PERFORMANCE (DIFERENCIAL) */}
          <div className="bg-surface-container rounded-[40px] p-8 border border-surface-container-high">
            <h3 className="text-lg font-black uppercase tracking-tighter text-on-surface flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center">
                <BarChart3 size={18} />
              </div>
              Performance
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Tempo Médio</p>
                  <p className="text-2xl font-black text-primary">{avgServiceTime}</p>
                </div>
                <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">SLA Médio</p>
                  <p className="text-2xl font-black text-success">{avgSla}</p>
                </div>
              </div>

              <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Resolvidos Hoje</p>
                  <span className="text-sm font-black text-on-surface">{resolvedToday.length}</span>
                </div>
                <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${Math.min((resolvedToday.length / 10) * 100, 100)}%` }} />
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-3xl border border-primary/10">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <User size={24} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-primary">Técnico Destaque</p>
                  <p className="text-sm font-black text-on-surface">Jefferson Silva</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
