import { useState, useEffect } from 'react';
import { MotivoPerda } from '../../types';
import { databaseService } from '../../services/databaseService';
import { 
  XCircle, 
  Plus, 
  Search, 
  BarChart3, 
  AlertCircle,
  TrendingDown,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import { motion } from 'framer-motion';

interface LossReasonsViewProps {
  userId: string;
}

export default function LossReasonsView({ userId }: LossReasonsViewProps) {
  const [reasons, setReasons] = useState<MotivoPerda[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchReasons();
  }, []);

  const fetchReasons = async () => {
    try {
      const data = await databaseService.getMotivosPerda();
      setReasons(data || []);
    } catch (error) {
      console.error('Error fetching loss reasons:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReasons = reasons.filter(reason => 
    (reason.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (reason.descricao?.toLowerCase() || '').includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-black uppercase tracking-tight text-on-surface">Motivos de Perda</h1>
          <p className="text-sm text-on-surface-variant">Analise por que as oportunidades não são convertidas</p>
        </div>
        <button className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
          <Plus size={18} />
          Novo Motivo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-error text-white p-8 rounded-[40px] shadow-xl shadow-error/20 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative">
              <TrendingDown size={32} className="mb-4 opacity-80" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Total de Perdas</p>
              <h2 className="text-4xl font-black tracking-tighter">R$ 45.800,00</h2>
              <p className="text-[10px] font-bold mt-4 uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full inline-block">
                Março 2026
              </p>
            </div>
          </div>

          <div className="bg-surface-container-low border border-surface-container-high rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-on-surface mb-4">Top 3 Motivos</h3>
            <div className="space-y-4">
              {[
                { name: 'Preço Elevado', percent: 45, color: 'bg-error' },
                { name: 'Concorrência', percent: 30, color: 'bg-warning' },
                { name: 'Prazo de Entrega', percent: 15, color: 'bg-info' },
              ].map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="text-on-surface-variant">{item.name}</span>
                    <span className="text-on-surface">{item.percent}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${item.percent}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reasons List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input 
              type="text"
              placeholder="Buscar motivos..."
              className="w-full bg-surface-container-low border border-surface-container-high rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredReasons.length > 0 ? (
              filteredReasons.map((reason) => (
                <motion.div 
                  key={reason.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-surface-container-low border border-surface-container-high p-5 rounded-3xl shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-error/10 text-error rounded-2xl group-hover:bg-error group-hover:text-white transition-all duration-300">
                      <XCircle size={20} />
                    </div>
                    <button className="p-1 hover:bg-surface-container-high rounded-lg text-on-surface-variant">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                  <h3 className="text-sm font-black text-on-surface uppercase tracking-tight mb-2">{reason.nome}</h3>
                  {reason.descricao && (
                    <p className="text-xs text-on-surface-variant line-clamp-2 mb-4 leading-relaxed">{reason.descricao}</p>
                  )}
                  <div className="flex items-center justify-between pt-4 border-t border-surface-container-high">
                    <div className="flex items-center gap-1 text-[10px] font-black text-on-surface-variant uppercase">
                      <BarChart3 size={12} />
                      12 Ocorrências
                    </div>
                    <ChevronRight size={14} className="text-on-surface-variant group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="md:col-span-2 flex flex-col items-center justify-center py-20 bg-surface-container-low border border-dashed border-surface-container-high rounded-3xl text-on-surface-variant">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">Nenhum motivo encontrado</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
