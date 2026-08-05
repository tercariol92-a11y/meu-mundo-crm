import { useState, useEffect } from 'react';
import { Lead, Proposta } from '../../types';
import { formatDateBR } from '../../utils/date';
import { databaseService } from '../../services/databaseService';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  DollarSign, 
  Clock,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SalesPipelineProps {
  userId: string;
}

const STAGES = [
  'Novo',
  'Em contato',
  'Qualificado',
  'Proposta enviada',
  'Negociação',
  'Fechado'
];

export default function SalesPipeline({ userId }: SalesPipelineProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const leadsData = await databaseService.getLeads();
      setLeads(leadsData || []);
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (leadId: string, newStatus: string) => {
    try {
      setUpdatingId(leadId);
      await databaseService.updateLead(leadId, { status: newStatus as Lead['status'] });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus as Lead['status'] } : l));
    } catch (error) {
      console.error('Error updating lead status via drag:', error);
      fetchData(); // Revert on error
    } finally {
      setUpdatingId(null);
    }
  };

  const getItemsByStage = (stage: string) => {
    return leads.filter(lead => lead.status === stage);
  };

  const getStageTotalValue = (stage: string) => {
    const items = getItemsByStage(stage);
    return items.reduce((acc, item) => acc + (item.valorEstimado || 0), 0);
  };

  const totalInNegotiation = leads
    .filter(l => !['Fechado', 'Perdido'].includes(l.status))
    .reduce((acc, l) => acc + (l.valorEstimado || 0), 0);

  return (
    <div className="p-6 h-[calc(100vh-64px)] flex flex-col gap-6 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-on-surface">Pipeline de Vendas</h1>
          <p className="text-sm text-on-surface-variant">Visualize e gerencie seu funil de vendas</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Total em Negociação:</span>
            <span className="text-sm font-bold text-primary">R$ {totalInNegotiation.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex gap-4 h-full min-w-max">
          {STAGES.map((stage) => {
            const items = getItemsByStage(stage);
            const totalValue = getStageTotalValue(stage);

            return (
              <div key={stage} className="w-80 flex flex-col gap-3 h-full">
                <div className="bg-surface-container-low border border-surface-container-high p-4 rounded-2xl shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">{stage}</h3>
                    <span className="bg-surface-container-highest text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-tighter">
                    R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="flex-1 bg-surface-container-lowest/50 border border-dashed border-surface-container-high rounded-2xl p-2 overflow-y-auto space-y-3 custom-scrollbar relative">
                  {loading ? (
                    <div className="flex items-center justify-center h-20">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    </div>
                  ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-on-surface-variant/30">
                      <ArrowRight size={24} className="mb-2 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Vazio</p>
                    </div>
                  ) : (
                    items.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        drag
                        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                        dragElastic={0.1}
                        onDragEnd={(_, info) => {
                          // Simple logic to detect column change based on horizontal movement
                          // This is a bit hacky but works for simple cases without a full dnd library
                          const moveThreshold = 100;
                          const currentIndex = STAGES.indexOf(stage);
                          if (info.offset.x > moveThreshold && currentIndex < STAGES.length - 1) {
                            handleDragEnd(item.id, STAGES[currentIndex + 1]);
                          } else if (info.offset.x < -moveThreshold && currentIndex > 0) {
                            handleDragEnd(item.id, STAGES[currentIndex - 1]);
                          }
                        }}
                        className={`bg-surface-container-low border border-surface-container-high p-4 rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing group ${updatingId === item.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">{item.nome}</p>
                          <div className="flex items-center gap-1">
                            {updatingId === item.id && <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                            <button className="text-on-surface-variant hover:text-on-surface">
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-3 truncate">{item.empresa || 'Sem empresa'}</p>
                        
                        <div className="flex items-center justify-between pt-3 border-t border-surface-container-high/50">
                          <div className="flex items-center gap-1.5 text-primary">
                            <DollarSign size={12} />
                            <span className="text-[10px] font-bold">R$ {item.valorEstimado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-on-surface-variant">
                            <Clock size={12} />
                            <span className="text-[10px]">{formatDateBR(item.createdAt)}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
