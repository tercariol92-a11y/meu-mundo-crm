import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Loader2,
  Calendar,
  User,
  Wrench,
  Building2
} from 'lucide-react';
import { User as UserType, Chamado } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion } from 'framer-motion';

interface CustomerTicketListProps {
  user: UserType;
  onViewTicket: (id: string) => void;
}

export default function CustomerTicketList({ user, onViewTicket }: CustomerTicketListProps) {
  const [tickets, setTickets] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  useEffect(() => {
    const loadTickets = async () => {
      if (!user.clienteId) return;
      try {
        const data = await databaseService.getChamadosByCliente(user.clienteId);
        setTickets(data || []);
      } catch (err) {
        console.error('Error loading tickets:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTickets();
  }, [user.clienteId]);

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = [
    { value: 'todos', label: 'Todos' },
    { value: 'aberto', label: 'Abertos' },
    { value: 'em_atendimento', label: 'Em Atendimento' },
    { value: 'aguardando_cliente', label: 'Aguardando Cliente' },
    { value: 'concluido', label: 'Finalizados' },
  ];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-on-surface">Meus Chamados</h1>
          <p className="text-sm text-on-surface-variant font-medium">Acompanhe o andamento de suas solicitações.</p>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
          <input
            type="text"
            placeholder="Buscar por título ou número do chamado..."
            className="w-full pl-12 pr-6 py-4 bg-surface-container-low border border-surface-container-high rounded-[24px] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className={`px-6 py-4 rounded-[24px] text-xs font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                statusFilter === option.value 
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                  : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:border-primary/50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface-container-low rounded-[40px] border border-surface-container-high overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="animate-spin text-primary" size={48} />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-20 text-center space-y-4">
            <div className="w-20 h-20 bg-surface-container-highest rounded-[32px] flex items-center justify-center mx-auto text-primary/20">
              <ClipboardList size={40} />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-on-surface">Nenhum chamado encontrado</h3>
            <p className="text-sm text-on-surface-variant font-medium">Não encontramos chamados com os filtros aplicados.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-container-high">
            {filteredTickets.map((ticket, index) => (
              <motion.button
                key={ticket.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onViewTicket(ticket.id)}
                className="w-full p-8 flex flex-col md:flex-row md:items-center justify-between hover:bg-surface-container-highest/20 transition-all group text-left gap-6"
              >
                <div className="flex items-start gap-6">
                  <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center shrink-0 shadow-lg ${
                    ticket.status === 'aberto' ? 'bg-orange-100 text-orange-600 shadow-orange-600/10' :
                    ticket.status === 'concluido' ? 'bg-green-100 text-green-600 shadow-green-600/10' :
                    'bg-blue-100 text-blue-600 shadow-blue-600/10'
                  }`}>
                    {ticket.status === 'aberto' ? <AlertCircle size={28} /> :
                     ticket.status === 'concluido' ? <CheckCircle2 size={28} /> :
                     <Clock size={28} />}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-lg">
                        #{ticket.id.slice(-6).toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        ticket.prioridade === 'baixa' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                        ticket.prioridade === 'media' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                        'bg-red-100 text-red-600 border-red-200'
                      }`}>
                        {ticket.prioridade}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-on-surface group-hover:text-primary transition-colors uppercase tracking-tight leading-tight">
                      {ticket.titulo}
                    </h3>
                    <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
                      {ticket.slaDeadline && ticket.status !== 'concluido' && ticket.status !== 'finalizado' && (
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                          new Date(ticket.slaDeadline) < new Date() 
                            ? 'bg-red-50 text-red-600 border-red-100' 
                            : 'bg-green-50 text-green-600 border-green-100'
                        }`}>
                          <Clock size={12} />
                          {new Date(ticket.slaDeadline) < new Date() ? 'SLA Vencido' : 'No Prazo'}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                        <Building2 size={14} className="text-primary" />
                        {ticket.unidade?.nome || 'Unidade não informada'}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                        <Wrench size={14} className="text-primary" />
                        {ticket.equipamentoCliente?.modelo || 'Equipamento não informado'}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                        <Calendar size={14} className="text-primary" />
                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('pt-BR') : '-'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-8 border-t md:border-t-0 pt-4 md:pt-0 border-surface-container-high">
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status Atual</p>
                    <span className={`inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      ticket.status === 'aberto' ? 'bg-orange-100 text-orange-600 border-orange-200' :
                      ticket.status === 'concluido' ? 'bg-green-100 text-green-600 border-green-200' :
                      'bg-blue-100 text-blue-600 border-blue-200'
                    }`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-right space-y-1 hidden sm:block">
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Técnico</p>
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center text-[10px] font-black text-primary border border-surface-container-high">
                        {ticket.tecnico?.nome?.charAt(0) || <User size={12} />}
                      </div>
                      <p className="text-xs font-bold text-on-surface">{ticket.tecnico?.nome || 'Aguardando'}</p>
                    </div>
                  </div>
                  <ChevronRight size={24} className="text-on-surface-variant group-hover:translate-x-2 transition-transform" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
