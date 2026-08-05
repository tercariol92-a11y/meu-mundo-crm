import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  CheckCircle2, 
  Calendar, 
  Wrench, 
  User, 
  Loader2, 
  ChevronRight,
  ClipboardList,
  Activity
} from 'lucide-react';
import { User as UserType, Chamado } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion } from 'framer-motion';

interface CustomerHistoryProps {
  user: UserType;
  onViewTicket: (id: string) => void;
}

export default function CustomerHistory({ user, onViewTicket }: CustomerHistoryProps) {
  const [tickets, setTickets] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadHistory = async () => {
      if (!user.clienteId) return;
      try {
        const data = await databaseService.getChamadosByCliente(user.clienteId);
        // Only show completed or cancelled tickets in history
        setTickets(data?.filter(t => t.status === 'concluido' || t.status === 'cancelado') || []);
      } catch (err) {
        console.error('Error loading history:', err);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [user.clienteId]);

  const filteredHistory = tickets.filter(t => 
    t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-on-surface">Histórico de Atendimentos</h1>
          <p className="text-sm text-on-surface-variant font-medium">Consulte todos os seus atendimentos finalizados.</p>
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
        <input
          type="text"
          placeholder="Buscar no histórico por título ou número do chamado..."
          className="w-full pl-12 pr-6 py-4 bg-surface-container-low border border-surface-container-high rounded-[24px] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-surface-container-low rounded-[40px] border border-surface-container-high overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="animate-spin text-primary" size={48} />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-20 text-center space-y-4">
            <div className="w-20 h-20 bg-surface-container-highest rounded-[32px] flex items-center justify-center mx-auto text-primary/20">
              <History size={40} />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight text-on-surface">Histórico vazio</h3>
            <p className="text-sm text-on-surface-variant font-medium">Você ainda não possui atendimentos finalizados.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-container-high">
            {filteredHistory.map((ticket, index) => (
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
                    ticket.status === 'concluido' ? 'bg-green-100 text-green-600 shadow-green-600/10' :
                    'bg-gray-100 text-gray-600 shadow-gray-600/10'
                  }`}>
                    {ticket.status === 'concluido' ? <CheckCircle2 size={28} /> : <Activity size={28} />}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-lg">
                        #{ticket.id.slice(-6).toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        ticket.status === 'concluido' ? 'bg-green-100 text-green-600 border-green-200' :
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-on-surface group-hover:text-primary transition-colors uppercase tracking-tight leading-tight">
                      {ticket.titulo}
                    </h3>
                    <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                        <Wrench size={14} className="text-primary" />
                        {ticket.equipamentoCliente?.modelo || 'Equipamento não informado'}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                        <Calendar size={14} className="text-primary" />
                        Finalizado em {ticket.dataFechamento ? new Date(ticket.dataFechamento).toLocaleDateString('pt-BR') : '-'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-8 border-t md:border-t-0 pt-4 md:pt-0 border-surface-container-high">
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Técnico Responsável</p>
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
