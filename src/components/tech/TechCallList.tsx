import { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { Chamado, Tecnico } from '../../types';
import { 
  Search, 
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  ArrowLeft,
  MapPin,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TechCallListProps {
  tecnico: Tecnico;
  onViewCall: (callId: string) => void;
  onBack: () => void;
}

type FilterType = 'hoje' | 'atrasados' | 'finalizados' | 'todos';

export default function TechCallList({ tecnico, onViewCall, onBack }: TechCallListProps) {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await databaseService.getChamadosByTecnico(tecnico.id);
        setChamados(data || []);
      } catch (error) {
        console.error('Error loading technical call list:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [tecnico.id]);

  const filteredCalls = chamados.filter(c => {
    const matchesSearch = 
      c.cliente?.nomeFantasia?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.titulo.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'hoje') {
      const today = new Date().toISOString().split('T')[0];
      return c.createdAt?.split('T')[0] === today && c.status !== 'finalizado';
    }
    if (activeFilter === 'atrasados') {
      return c.isLate && c.status !== 'finalizado';
    }
    if (activeFilter === 'finalizados') {
      return c.status === 'finalizado';
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'bg-blue-100 text-blue-700';
      case 'em_atendimento': return 'bg-orange-100 text-orange-700';
      case 'finalizado': return 'bg-green-100 text-green-700';
      case 'cancelado': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="bg-surface-container-low px-4 py-4 flex items-center gap-4 border-b border-surface-container-high sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-black text-on-surface uppercase tracking-tight flex-1">Chamados</h1>
        <div className="flex items-center gap-2">
          <button className="p-2 text-on-surface-variant bg-surface-container-high rounded-xl">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 space-y-4 bg-surface-container-low border-b border-surface-container-high">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-40 group-focus-within:opacity-100 transition-opacity" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por cliente ou título..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border-2 border-surface-container-highest rounded-2xl py-3.5 pl-11 pr-4 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-sm font-medium"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {[
            { id: 'todos', label: 'Todos', icon: Tag },
            { id: 'hoje', label: 'Hoje', icon: Calendar },
            { id: 'atrasados', label: 'Atrasados', icon: AlertCircle },
            { id: 'finalizados', label: 'Finalizados', icon: CheckCircle2 },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id as FilterType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                activeFilter === filter.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              <filter.icon size={14} />
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 w-full bg-surface-container-high animate-pulse rounded-3xl" />
          ))
        ) : filteredCalls.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {filteredCalls.map((call) => (
              <motion.div
                key={call.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onViewCall(call.id)}
                className="bg-surface-container-lowest p-5 rounded-3xl border border-surface-container-high shadow-sm group active:bg-surface-container-high transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0 pr-4">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 block">#{call.protocolo || call.id.slice(0, 8)}</span>
                    <h4 className="font-bold text-on-surface truncate pr-2 text-lg leading-tight uppercase tracking-tight">{call.cliente?.nomeFantasia || 'Cliente'}</h4>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(call.status)}`}>
                    {call.status.replace('_', ' ')}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-on-surface-variant">
                    <MapPin size={14} className="shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed line-clamp-1">{call.unidade?.endereco || 'Endereço não informado'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-on-surface-variant bg-surface-container-low px-2 py-1 rounded-lg">
                      <Calendar size={12} />
                      <span className="text-[10px] font-bold">
                        {call.createdAt ? new Date(call.createdAt).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </div>
                    {call.tempoEstimado && (
                      <div className="flex items-center gap-1.5 text-on-surface-variant bg-surface-container-low px-2 py-1 rounded-lg">
                        <Clock size={12} />
                        <span className="text-[10px] font-bold">{call.tempoEstimado}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-surface-container-high flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    call.prioridade === 'critica' ? 'text-error' : 'text-on-surface-variant opacity-60'
                  }`}>
                    Prioridade: {call.prioridade}
                  </span>
                  <div className="flex items-center gap-1 text-primary">
                    <span className="text-[10px] font-black uppercase tracking-widest">Atender</span>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="text-center py-20 px-10">
            <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-4 text-on-surface-variant opacity-20">
              <Search size={40} />
            </div>
            <h3 className="text-lg font-bold text-on-surface uppercase tracking-tight mb-1">Nenhum chamado</h3>
            <p className="text-sm text-on-surface-variant">Tente ajustar seus filtros ou busca.</p>
          </div>
        )}
      </div>
    </div>
  );
}
