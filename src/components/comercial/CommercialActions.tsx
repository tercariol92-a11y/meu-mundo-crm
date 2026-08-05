import { useState, useEffect } from 'react';
import { AcaoComercial } from '../../types';
import { databaseService } from '../../services/databaseService';
import { 
  Zap, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  ChevronRight,
  MoreVertical,
  Calendar,
  User
} from 'lucide-react';
import { motion } from 'framer-motion';

interface CommercialActionsViewProps {
  userId: string;
}

export default function CommercialActionsView({ userId }: CommercialActionsViewProps) {
  const [actions, setActions] = useState<AcaoComercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchActions();
  }, []);

  const fetchActions = async () => {
    try {
      const data = await databaseService.getAcoesComerciais();
      setActions(data || []);
    } catch (error) {
      console.error('Error fetching commercial actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredActions = actions.filter(action => 
    (action.titulo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (action.descricao?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-on-surface">Ações Comerciais</h1>
          <p className="text-sm text-on-surface-variant">Gerencie suas campanhas e atividades de venda</p>
        </div>
        <button className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
          <Plus size={18} />
          Nova Ação
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-info text-white p-8 rounded-[40px] shadow-xl shadow-info/20 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative">
              <TrendingUp size={32} className="mb-4 opacity-80" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Ações Ativas</p>
              <h2 className="text-4xl font-black tracking-tighter">12 Campanhas</h2>
              <p className="text-[10px] font-bold mt-4 uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full inline-block">
                Março 2026
              </p>
            </div>
          </div>

          <div className="bg-surface-container-low border border-surface-container-high rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-on-surface mb-4">Status das Ações</h3>
            <div className="space-y-4">
              {[
                { name: 'Em Andamento', count: 8, color: 'bg-info' },
                { name: 'Planejadas', count: 3, color: 'bg-warning' },
                { name: 'Concluídas', count: 15, color: 'bg-success' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-highest/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-on-surface">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input 
              type="text"
              placeholder="Buscar ações..."
              className="w-full bg-surface-container-low border border-surface-container-high rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredActions.length > 0 ? (
              filteredActions.map((action) => (
                <motion.div 
                  key={action.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-surface-container-low border border-surface-container-high p-5 rounded-3xl shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-info/10 text-info rounded-2xl group-hover:bg-info group-hover:text-white transition-all duration-300">
                      <Zap size={20} />
                    </div>
                    <button className="p-1 hover:bg-surface-container-high rounded-lg text-on-surface-variant">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                  <h3 className="text-sm font-black text-on-surface uppercase tracking-tight mb-2">{action.titulo}</h3>
                  {action.descricao && (
                    <p className="text-xs text-on-surface-variant line-clamp-2 mb-4 leading-relaxed">{action.descricao}</p>
                  )}
                  <div className="flex flex-col gap-2 pt-4 border-t border-surface-container-high">
                    <div className="flex items-center gap-2 text-[10px] font-black text-on-surface-variant uppercase">
                      <Calendar size={12} />
                      Início: {new Date(action.dataInicio).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-on-surface-variant uppercase">
                      <User size={12} />
                      Responsável: Ricardo Silva
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="md:col-span-2 flex flex-col items-center justify-center py-20 bg-surface-container-low border border-dashed border-surface-container-high rounded-3xl text-on-surface-variant">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">Nenhuma ação encontrada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
