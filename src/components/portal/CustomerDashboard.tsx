import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  ClipboardList, 
  Wrench, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ChevronRight,
  ArrowRight,
  Calendar,
  Activity
} from 'lucide-react';
import { User, Chamado, EquipamentoCliente, Cliente } from '../../types';
import { databaseService } from '../../services/databaseService';
import { PortalView } from './CustomerPortal';
import { motion } from 'framer-motion';

interface CustomerDashboardProps {
  user: User;
  onNavigate: (view: PortalView) => void;
  onViewTicket: (id: string) => void;
}

export default function CustomerDashboard({ user, onNavigate, onViewTicket }: CustomerDashboardProps) {
  const [stats, setStats] = useState({
    open: 0,
    inProgress: 0,
    completed: 0,
    totalMonth: 0,
    activeEquipment: 0,
    withinSLA: 0,
    late: 0,
    avgResolutionTime: '0'
  });
  const [client, setClient] = useState<Cliente | null>(null);
  const [recentTickets, setRecentTickets] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user.clienteId) return;

      try {
        const [tickets, equipment, slaStats, clientData] = await Promise.all([
          databaseService.getChamadosByCliente(user.clienteId),
          databaseService.getEquipamentosByCliente(user.clienteId),
          databaseService.getSLAStats(user.clienteId),
          databaseService.getClienteById(user.clienteId)
        ]);

        setClient(clientData);

        if (tickets) {
          const now = new Date();
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

          setStats({
            open: tickets.filter(t => t.status === 'aberto').length,
            inProgress: tickets.filter(t => t.status === 'em_atendimento' || t.status === 'aguardando_cliente').length,
            completed: tickets.filter(t => t.status === 'concluido').length,
            totalMonth: tickets.filter(t => t.createdAt && new Date(t.createdAt) >= firstDayOfMonth).length,
            activeEquipment: equipment?.filter(e => e.status === 'Em operação').length || 0,
            withinSLA: slaStats?.withinSLA || 0,
            late: slaStats?.late || 0,
            avgResolutionTime: slaStats?.avgResolutionTime || '0'
          });

          setRecentTickets(tickets.slice(0, 5));
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user.clienteId]);

  const statCards = [
    { label: 'Chamados Abertos', value: stats.open, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-100' },
    { label: 'Em Atendimento', value: stats.inProgress, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Finalizados (Mês)', value: stats.completed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Total no Mês', value: stats.totalMonth, icon: ClipboardList, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Tempo Médio (Hrs)', value: stats.avgResolutionTime, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-100' },
  ];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-on-surface">Olá, {(user as any).nome?.split(' ')[0] || user.displayName?.split(' ')[0]}!</h1>
          <p className="text-sm text-on-surface-variant font-medium uppercase tracking-widest font-black">Portal do Cliente • Suporte Especializado</p>
        </div>
        <button
          onClick={() => onNavigate('novo-chamado')}
          className="flex items-center gap-3 bg-primary text-white px-8 py-4 rounded-[32px] font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 group"
        >
          <PlusCircle size={20} className="group-hover:rotate-90 transition-transform" />
          Abrir Novo Chamado
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-surface-container-low p-6 rounded-[32px] border border-surface-container-high shadow-sm hover:shadow-md transition-all group"
          >
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <stat.icon size={24} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{stat.label}</p>
            <p className="text-3xl font-black text-on-surface">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black uppercase tracking-tight text-on-surface">Últimos Chamados</h2>
            <button 
              onClick={() => onNavigate('meus-chamados')}
              className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1 hover:gap-2 transition-all"
            >
              Ver todos <ArrowRight size={14} />
            </button>
          </div>

          <div className="bg-surface-container-low rounded-[40px] border border-surface-container-high overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Clock className="animate-spin text-primary/20" size={48} />
              </div>
            ) : recentTickets.length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-surface-container-highest rounded-3xl flex items-center justify-center mx-auto text-primary/20">
                  <ClipboardList size={32} />
                </div>
                <p className="text-sm text-on-surface-variant font-medium">Nenhum chamado registrado recentemente.</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-container-high">
                {recentTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => onViewTicket(ticket.id)}
                    className="w-full p-6 flex items-center justify-between hover:bg-surface-container-highest/20 transition-all group text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        ticket.status === 'aberto' ? 'bg-orange-100 text-orange-600' :
                        ticket.status === 'concluido' ? 'bg-green-100 text-green-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <Activity size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-on-surface group-hover:text-primary transition-colors uppercase tracking-tight">{ticket.titulo}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">#{ticket.id.slice(-6).toUpperCase()}</span>
                          <span className="w-1 h-1 rounded-full bg-surface-container-highest" />
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                            {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('pt-BR') : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        ticket.status === 'aberto' ? 'bg-orange-100 text-orange-600 border-orange-200' :
                        ticket.status === 'concluido' ? 'bg-green-100 text-green-600 border-green-200' :
                        'bg-blue-100 text-blue-600 border-blue-200'
                      }`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                      <ChevronRight size={18} className="text-on-surface-variant group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-black uppercase tracking-tight text-on-surface px-2">Seu Plano de Suporte</h2>
          <div className="space-y-4">
            {client?.slaConfig ? (
              <div className="bg-primary/5 border border-primary/20 p-6 rounded-[32px] space-y-4 shadow-sm">
                <div className="flex items-center gap-3 text-primary">
                  <Activity size={20} />
                  <h3 className="text-xs font-black uppercase tracking-widest">{client.slaConfig.planName}</h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-primary/10 pb-2">
                    <span>Primeira Resposta</span>
                    <span className="text-primary">{client.slaConfig.firstResponseHours}h úteis</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-primary/10 pb-2">
                    <span>Resolução Total</span>
                    <span className="text-primary">{client.slaConfig.resolutionHours}h úteis</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-primary/10 pb-2">
                    <span>Atendimento</span>
                    <span className="text-primary">Seg a Sex, {client.slaConfig.workingHoursStart} - {client.slaConfig.workingHoursEnd}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    <span>Tipo Suporte</span>
                    <span className="text-primary">{client.slaConfig.supportType}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface-container-low border border-surface-container-high p-6 rounded-[32px] space-y-3">
                <div className="flex items-center gap-3 text-on-surface">
                  <Clock size={20} />
                  <h3 className="text-xs font-black uppercase tracking-widest">Aguardando SLA</h3>
                </div>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  Não identificamos um plano de SLA vinculado à sua empresa. Entre em contato com seu consultor comercial.
                </p>
              </div>
            )}

            <div className="bg-surface-container-low border border-surface-container-high p-6 rounded-[32px] space-y-3">
              <div className="flex items-center gap-3 text-on-surface">
                <Clock size={20} />
                <h3 className="text-xs font-black uppercase tracking-widest">Horário Comercial</h3>
              </div>
              <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                Nosso suporte padrão remoto funciona de Segunda a Sexta, das 08h às 18h.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
