import { useState, useEffect, useMemo } from 'react';
import { Usuario, Proposta, Cliente, Lead, AgendaComercial, Tarefa, PontuacaoUsuario } from '../../types';
import { 
  DollarSign, 
  Users, 
  Target, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  Calendar,
  CheckCircle2,
  Trophy,
  ArrowRight,
  User,
  Activity,
  FileText,
  BadgeDollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalData } from '../../contexts/GlobalDataContext';
import { databaseService } from '../../services/databaseService';
import { tasksService } from '../../services/tasksService';
import MinhasMetasCard from '../gestao/MinhasMetasCard';
import { appointmentStart, commercialAgendaService } from '../../services/commercialAgendaService';

interface VendedorDashboardProps {
  user: Usuario;
}

export default function VendedorDashboard({ user }: VendedorDashboardProps) {
  const { 
    usuarios: allUsers, 
    propostas, 
    leads, 
    clientes, 
    agendaComercial,
    loading 
  } = useGlobalData();

  // Determine permissions
  const isAdminOrManager = useMemo(() => {
    const role = user.role as any;
    const roles = (user.roles || []) as any[];
    return role === 'admin' || roles.includes('admin') || 
           role === 'gerente' || roles.includes('gerente') || 
           role === 'gerente_comercial' || roles.includes('gerente_comercial');
  }, [user]);

  // Selected employee ID (always locked to logger user's ID for regular sellers)
  const [selectedUserId, setSelectedUserId] = useState(user.id);

  // Sync selectedUserId with logged user if permissions change
  useEffect(() => {
    if (!isAdminOrManager) {
      setSelectedUserId(user.id);
    }
  }, [isAdminOrManager, user.id]);

  // Fetch or filter available salespeople for admin/manager selection
  const salesStaff = useMemo(() => {
    return allUsers?.filter(u => 
      u.role === 'admin' || 
      u.role === 'vendedor' || 
      u.role === 'gerente_comercial' || 
      (u.role as any) === 'gerente' ||
      u.receivesCommission === true
    ) || [];
  }, [allUsers]);

  // State for loaded database metrics and loading state
  const [dbStats, setDbStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [tasks, setTasks] = useState<Tarefa[]>([]);
  const [scores, setScores] = useState<PontuacaoUsuario[]>([]);

  useEffect(() => {
    const unsubT = tasksService.subscribeTasks(setTasks);
    const unsubS = tasksService.subscribeScores(setScores);
    return () => {
      unsubT();
      unsubS();
    };
  }, []);

  // Load stats dynamically when selected user changes
  useEffect(() => {
    let isMounted = true;
    setLoadingStats(true);
    
    databaseService.getVendedorStats(selectedUserId)
      .then(statsData => {
        if (isMounted) {
          setDbStats(statsData);
          setLoadingStats(false);
        }
      })
      .catch(err => {
        console.error("Error loading metrics for user ID:", selectedUserId, err);
        if (isMounted) {
          setLoadingStats(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedUserId]);

  // Personal elements (leads, proposals, appointments) filtered for selected user
  const personalLeads = useMemo(() => {
    return leads.filter(l => l.responsavelId === selectedUserId);
  }, [leads, selectedUserId]);

  const personalProposals = useMemo(() => {
    return propostas.filter(p => p.vendedorId === selectedUserId);
  }, [propostas, selectedUserId]);

  const personalAppointments = useMemo(() => {
    return (agendaComercial?.filter(a => (a.responsibleUserId || a.responsavelId) === selectedUserId) || [])
      .sort((a, b) => (appointmentStart(a)?.getTime() || 0) - (appointmentStart(b)?.getTime() || 0));
  }, [agendaComercial, selectedUserId]);

  const agendaStats = useMemo(() => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const tomorrowKey = `${tomorrow.getFullYear()}-${tomorrow.getMonth()}-${tomorrow.getDate()}`;
    const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
    const key = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const pending = personalAppointments.filter(item => !['Concluído', 'Cancelado', 'Não realizado'].includes(item.status));
    return {
      today: pending.filter(item => { const start = appointmentStart(item); return start && key(start) === todayKey; }),
      tomorrow: pending.filter(item => { const start = appointmentStart(item); return start && key(start) === tomorrowKey; }),
      late: pending.filter(item => { const start = appointmentStart(item); return start && start < now; }),
      week: pending.filter(item => { const start = appointmentStart(item); return start && start >= now && start < weekEnd; }),
      next: pending.find(item => { const start = appointmentStart(item); return start && start >= now; }),
    };
  }, [personalAppointments]);

  const openAgenda = () => window.dispatchEvent(new CustomEvent('navigateApp', { detail: { view: 'comercial-agenda' } }));

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const selectedUserObject = useMemo(() => {
    return allUsers.find(u => u.id === selectedUserId) || user;
  }, [allUsers, selectedUserId, user]);

  if (loading || loadingStats) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest animate-pulse">
          Carregando dados individuais...
        </p>
      </div>
    );
  }

  // Fallback defaults if databaseService fetch fails or is slow
  const activeStats = dbStats || {
    totalVendasMes: personalProposals.filter(p => p.status === 'Aprovado').length,
    valorTotalMes: personalProposals.filter(p => p.status === 'Aprovado').reduce((sum, p) => sum + (p.valor || 0), 0),
    comissaoGanha: 0,
    comissaoPrevista: 0,
    metaMensal: selectedUserObject.monthlyGoal || selectedUserObject.metaMensal || 0,
    atingimentoMeta: 0,
    clientesAtendidos: clientes.filter(c => (c as any).vendedorResponsavel === selectedUserId).length,
    leadsAberto: personalLeads.filter(l => l.status !== 'Fechado' && l.status !== 'Perdido').length,
    taxaConversao: personalLeads.length > 0 ? (personalProposals.filter(p => p.status === 'Aprovado').length / personalLeads.length) * 100 : 0,
    podeVerComissao: selectedUserObject.canViewCommission !== false
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto" id="user-dashboard-stage">
      
      {/* Target User & Meta Configuration Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface-container-low p-6 rounded-[2.5rem] border border-surface-container-high shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
            <User size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-on-surface">
              {isAdminOrManager && selectedUserId !== user.id ? `Dashboard de ${selectedUserObject.nome}` : "Meu Dashboard"}
            </h1>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
              {selectedUserObject.role === 'admin' ? 'Administrador' : selectedUserObject.role === 'vendedor' ? 'Vendedor' : 'Colaborador'} &bull; {selectedUserObject.email}
            </p>
          </div>
        </div>

        {/* Dropdown for Admin/Manager Dashboard Selection */}
        {isAdminOrManager && (
          <div className="flex items-center gap-3 self-start md:self-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Visualizar Usuário:</span>
            <select
              className="bg-surface-container-high border border-surface-container-highest rounded-2.5xl px-4 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[200px]"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value={user.id}>Minhas Estatísticas</option>
              {salesStaff.map(s => s.id !== user.id && (
                <option key={s.id} value={s.id}>{s.nome} ({s.role})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Minhas Metas do Dia Card */}
      <MinhasMetasCard 
        user={selectedUserObject as Usuario}
        tasks={tasks}
        userScore={scores.find(s => s.funcionarioId === selectedUserId)}
        rankingPosition={scores.findIndex(s => s.funcionarioId === selectedUserId) + 1 || 1}
        totalTeamCount={allUsers.length}
        proposalsPendingCount={personalProposals.filter(p => p.status === 'Rascunho' || p.status === 'Enviado').length}
        returnsPendingCount={0}
        ticketsPendingCount={0}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-primary text-white rounded-3xl p-5"><p className="text-[10px] font-black uppercase tracking-widest opacity-75">Agenda de hoje</p><p className="text-3xl font-black mt-2">{agendaStats.today.length}</p><p className="text-xs">compromissos</p></div>
        <div className="bg-surface-container-low border rounded-3xl p-5"><p className="text-[10px] font-black uppercase text-on-surface-variant">Próximo</p><p className="text-sm font-black mt-2 line-clamp-1">{agendaStats.next?.titulo || 'Agenda livre'}</p><p className="text-xs text-primary mt-1">{agendaStats.next && appointmentStart(agendaStats.next)?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div>
        <div className="bg-red-50 border border-red-100 rounded-3xl p-5"><p className="text-[10px] font-black uppercase text-red-600">Atrasados</p><p className="text-3xl font-black text-red-600 mt-2">{agendaStats.late.length}</p></div>
        <div className="bg-surface-container-low border rounded-3xl p-5"><p className="text-[10px] font-black uppercase text-on-surface-variant">Amanhã</p><p className="text-3xl font-black mt-2">{agendaStats.tomorrow.length}</p></div>
        <div className="bg-surface-container-low border rounded-3xl p-5"><p className="text-[10px] font-black uppercase text-on-surface-variant">Próximos 7 dias</p><p className="text-3xl font-black mt-2">{agendaStats.week.length}</p></div>
      </div>

      {/* Main Metrics Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric 1: Monthly Total Approved Sales */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary text-white p-6 rounded-[2rem] shadow-lg shadow-primary/10 flex flex-col justify-between h-48 relative overflow-hidden"
        >
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-white/5 rounded-full translate-x-12 translate-y-12 pointer-events-none"></div>
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-white/15 rounded-xl text-white">
              <DollarSign size={20} />
            </div>
            <Trophy size={20} className={activeStats.atingimentoMeta >= 100 ? "text-yellow-300 animate-bounce" : "text-white/40"} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Vendido no Mês</p>
            <h3 className="text-2xl font-black tracking-tight mt-1">{formatCurrency(activeStats.valorTotalMes)}</h3>
          </div>
          <div className="pt-3 border-t border-white/10 flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
            <span>{activeStats.totalVendasMes} vendas concluídas</span>
            <TrendingUp size={12} />
          </div>
        </motion.div>

        {/* Metric 2: Seller Commissions (Only if permitted) */}
        {activeStats.podeVerComissao ? (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-surface-container-low p-6 rounded-[2rem] border border-surface-container-high shadow-sm flex flex-col justify-between h-48"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-green-100 text-green-700 rounded-xl">
                <BadgeDollarSign size={20} />
              </div>
              <span className="text-[9px] font-black text-green-700 bg-green-100/50 px-2 py-0.5 rounded-full border border-green-200">Comissões</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Minha Comissão</p>
              <h3 className="text-2xl font-black text-on-surface mt-1">{formatCurrency(activeStats.comissaoGanha)}</h3>
            </div>
            <div className="pt-3 border-t border-surface-container-high flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
              <span>Previsto: {formatCurrency(activeStats.comissaoPrevista)}</span>
              <span className="text-green-600 font-bold">Ganha</span>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-surface-container-low p-6 rounded-[2rem] border border-surface-container-high shadow-sm flex flex-col justify-between h-48"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <span className="text-[9px] font-black text-indigo-700 bg-indigo-100/50 px-2 py-0.5 rounded-full border border-indigo-200">Conversão de Leads</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Taxa de Conversão</p>
              <h3 className="text-2xl font-black text-on-surface mt-1">{activeStats.taxaConversao.toFixed(1)}%</h3>
            </div>
            <div className="pt-3 border-t border-surface-container-high flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
              <span>Leads qualificados</span>
              <CheckCircle2 size={12} className="text-indigo-600" />
            </div>
          </motion.div>
        )}

        {/* Metric 3: Active Leads in CRM */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-container-low p-6 rounded-[2rem] border border-surface-container-high shadow-sm flex flex-col justify-between h-48"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
              <Target size={20} />
            </div>
            <span className="text-[9px] font-black text-amber-700 bg-amber-100/50 px-2 py-0.5 rounded-full border border-amber-200">Atendimento</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Leads em Aberto</p>
            <h3 className="text-2xl font-black text-on-surface mt-1">{activeStats.leadsAberto}</h3>
          </div>
          <div className="pt-3 border-t border-surface-container-high flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
            <span>Potencial ativo no CRM</span>
            <Clock size={12} className="text-amber-600" />
          </div>
        </motion.div>

        {/* Metric 4: Assigned Clients */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-surface-container-low p-6 rounded-[2rem] border border-surface-container-high shadow-sm flex flex-col justify-between h-48"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <Users size={20} />
            </div>
            <span className="text-[9px] font-black text-blue-700 bg-blue-100/50 px-2 py-0.5 rounded-full border border-blue-200">Carteira</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Clientes Atendidos</p>
            <h3 className="text-2xl font-black text-on-surface mt-1">{activeStats.clientesAtendidos}</h3>
          </div>
          <div className="pt-3 border-t border-surface-container-high flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
            <span>Vínculo direto ativo</span>
            <ArrowRight size={12} className="text-blue-600" />
          </div>
        </motion.div>

      </div>

      {/* Goal Accomplishment Banner */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-container-low p-6 md:p-8 rounded-[2.5rem] border border-surface-container-high shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Activity size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-on-surface">Atingimento da Meta</h3>
              <p className="text-[10px] text-on-surface-variant">Progresso referente ao objetivo de vendas estabelecido para o mês</p>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xl font-black tracking-tight ${activeStats.atingimentoMeta >= 100 ? "text-green-600" : "text-primary"}`}>
              {activeStats.atingimentoMeta.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Custom Progress Bar */}
        <div className="relative h-4 w-full bg-surface-container-high rounded-full overflow-hidden border border-surface-container-highest">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(activeStats.atingimentoMeta, 100)}%` }}
            className={`h-full relative ${activeStats.atingimentoMeta >= 100 ? 'bg-green-500' : 'bg-primary'}`}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-pulse"></div>
          </motion.div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between text-[10px] text-on-surface-variant font-bold uppercase tracking-widest gap-2">
          <span>Meta Mensal: {formatCurrency(activeStats.metaMensal)}</span>
          {activeStats.atingimentoMeta >= 100 ? (
            <span className="text-green-600 font-extrabold flex items-center gap-1">
              <CheckCircle2 size={12} /> Parabéns! Meta mensal atingida com sucesso!
            </span>
          ) : (
            <span>Faltam {formatCurrency(Math.max(0, activeStats.metaMensal - activeStats.valorTotalMes))} para atingir o objetivo</span>
          )}
        </div>
      </motion.div>

      {/* Grid: Appointments & Tasks vs Proposals List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Commercial Agenda Appointments */}
        <div className="bg-surface-container-low p-6 md:p-8 rounded-[2.5rem] border border-surface-container-high shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-surface-container-high justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="text-primary" size={20} />
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface">Minha Agenda</h3>
            </div>
            <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
              {agendaStats.today.length} Hoje
            </span>
          </div>

          {agendaStats.today.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-on-surface-variant h-48">
              <Clock size={28} className="opacity-40 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Nenhum compromisso agendado para hoje.</p>
              <button onClick={openAgenda} className="text-[9px] mt-3 font-black uppercase text-primary">Ver agenda</button>
            </div>
          ) : (
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
              {agendaStats.today.map((item: any) => (
                <div 
                  key={item.id} 
                  className="p-4 bg-surface-container-high hover:bg-surface-container-highest rounded-2xl border border-surface-container-highest transition-colors flex justify-between gap-4 items-start"
                >
                  <div className="space-y-1">
                    <p className="text-[10px] font-extrabold text-primary uppercase tracking-tight">{item.titulo}</p>
                    {item.descricao && <p className="text-[11px] text-on-surface-variant line-clamp-2">{item.descricao}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#54656f] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                        {item.tipo}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-black text-on-surface">{appointmentStart(item)?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    <button onClick={() => commercialAgendaService.updateStatus(item.id, 'Concluído')} className="text-[9px] text-green-700 font-black uppercase mt-2">Concluir</button>
                  </div>
                </div>
              ))}
              <button onClick={openAgenda} className="w-full text-[10px] font-black uppercase text-primary py-2">Ver agenda completa</button>
            </div>
          )}
        </div>

        {/* Right Column: Key Recent Proposals */}
        <div className="bg-surface-container-low p-6 md:p-8 rounded-[2.5rem] border border-surface-container-high shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-surface-container-high justify-between">
            <div className="flex items-center gap-3">
              <FileText className="text-primary" size={20} />
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface">Minhas Propostas Recentes</h3>
            </div>
            <span className="text-[10px] font-black text-primary bg-primary/10 px-2  py-1 rounded-full border border-primary/20">
              {personalProposals.length} Totais
            </span>
          </div>

          {personalProposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-on-surface-variant h-48">
              <FileText size={28} className="opacity-40 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Nenhuma proposta cadastrada</p>
              <p className="text-[9px] mt-1 opacity-50">Inicie um orçamento a partir do CRM</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
              {personalProposals.slice(0, 5).map((prop: Proposta) => (
                <div 
                  key={prop.id} 
                  className="p-4 bg-surface-container-high hover:bg-surface-container-highest rounded-2xl border border-surface-container-highest transition-colors flex justify-between gap-4 items-center"
                >
                  <div className="space-y-0.5 overflow-hidden">
                    <p className="text-[11px] font-extrabold text-on-surface truncate">{prop.titulo}</p>
                    <p className="text-[10px] text-on-surface-variant truncate">
                      {prop.clienteNome || prop.leadNome || 'Cliente não definido'}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1.5">
                    <p className="text-xs font-black text-primary">{formatCurrency(prop.valor)}</p>
                    <span className={`inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                      prop.status === 'Aprovado' ? 'bg-green-100 text-green-700 border-green-200' :
                      prop.status === 'Rascunho' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                      prop.status === 'Enviado' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                      prop.status === 'Em negociação' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                      'bg-red-100 text-red-700 border-red-200'
                    }`}>
                      {prop.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* CRM Assigned Active Leads list */}
      <div className="bg-surface-container-low p-6 md:p-8 rounded-[2.5rem] border border-surface-container-high shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-surface-container-high">
          <Activity className="text-primary" size={20} />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface">Minha Carteira de Leads Ativos</h3>
        </div>

        {personalLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-on-surface-variant h-32">
            <Users size={28} className="opacity-40 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Nenhum Lead ativo associado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-surface-container-high">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high text-[9px] font-black uppercase tracking-widest text-on-surface-variant border-b border-surface-container-highest">
                  <th className="p-4">Nome do Lead / Empresa</th>
                  <th className="p-4">WhatsApp / Contato</th>
                  <th className="p-4 text-right">Potencial</th>
                  <th className="p-4">Status no Funil</th>
                  <th className="p-4">Cidade / UF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high text-xs">
                {personalLeads.slice(0, 10).map((lead: Lead) => (
                  <tr key={lead.id} className="hover:bg-surface-container-high/40 transition-colors">
                    <td className="p-4 font-bold text-on-surface">
                      <div>
                        <p>{lead.nome}</p>
                        {lead.empresa && <p className="text-[10px] font-medium text-on-surface-variant mt-0.5">{lead.empresa}</p>}
                      </div>
                    </td>
                    <td className="p-4 text-on-surface-variant">
                      <p>{lead.whatsapp || lead.telefone || 'Sem contato'}</p>
                      {lead.email && <p className="text-[10px] mt-0.5">{lead.email}</p>}
                    </td>
                    <td className="p-4 text-right font-bold text-primary">
                      {lead.valorEstimado ? formatCurrency(lead.valorEstimado) : 'R$ 0,00'}
                    </td>
                    <td className="p-4">
                      <span className={`inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                        lead.status === 'Novo' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        lead.status === 'Em contato' || lead.status === 'Em atendimento' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                        lead.status === 'Proposta enviada' || lead.status === 'Negociação' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        lead.status === 'Fechado' ? 'bg-green-100 text-green-700 border-green-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="p-4 text-on-surface-variant">
                      {lead.cidade ? `${lead.cidade} - ${lead.estado || ''}` : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
