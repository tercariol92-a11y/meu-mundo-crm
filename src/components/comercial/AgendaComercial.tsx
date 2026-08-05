import { useState, useMemo } from 'react';
import { AgendaComercial } from '../../types';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Plus, 
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useGlobalData } from '../../contexts/GlobalDataContext';

interface AgendaComercialViewProps {
  userId: string;
}

export default function AgendaComercialView({ userId }: AgendaComercialViewProps) {
  const { agendaComercial: tasks, loading } = useGlobalData();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTasks = useMemo(() => tasks.filter(task => 
    (task.titulo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (task.descricao?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  ), [tasks, searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Concluído': return 'bg-green-100 text-green-700 border-green-200';
      case 'Cancelado': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

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
          <h1 className="text-2xl font-black uppercase tracking-tight text-on-surface">Agenda Comercial</h1>
          <p className="text-sm text-on-surface-variant">Gerencie suas visitas e reuniões</p>
        </div>
        <button className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
          <Plus size={18} />
          Novo Compromisso
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Mini Calendar Placeholder */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface-container-low border border-surface-container-high rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Março 2026</h3>
              <div className="flex gap-2">
                <button className="p-1 hover:bg-surface-container-high rounded-lg"><ChevronLeft size={16} /></button>
                <button className="p-1 hover:bg-surface-container-high rounded-lg"><ChevronRight size={16} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <span key={`${d}-${i}`} className="text-[10px] font-black text-on-surface-variant">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {Array.from({ length: 31 }).map((_, i) => (
                <button 
                  key={i} 
                  className={`aspect-square flex items-center justify-center text-[10px] font-bold rounded-lg transition-colors ${
                    i + 1 === 31 ? 'bg-primary text-white' : 'hover:bg-surface-container-high text-on-surface'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container-low border border-surface-container-high rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-on-surface mb-4">Próximos Passos</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
                <div>
                  <p className="text-xs font-bold text-on-surface">Reunião com Lead ABC</p>
                  <p className="text-[10px] text-on-surface-variant">Amanhã às 10:00</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-warning mt-1.5"></div>
                <div>
                  <p className="text-xs font-bold text-on-surface">Follow-up Proposta #123</p>
                  <p className="text-[10px] text-on-surface-variant">02/04 às 14:30</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input 
              type="text"
              placeholder="Buscar compromissos..."
              className="w-full bg-surface-container-low border border-surface-container-high rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <motion.div 
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface-container-low border border-surface-container-high p-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-xl">
                      <CalendarIcon size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-on-surface uppercase tracking-tight">{task.titulo}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-on-surface-variant uppercase">
                          <Clock size={12} />
                          {new Date(task.dataHora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {task.local && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-on-surface-variant uppercase">
                            <MapPin size={12} />
                            {task.local}
                          </div>
                        )}
                      </div>
                      {task.descricao && (
                        <p className="text-xs text-on-surface-variant mt-2 line-clamp-1">{task.descricao}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-3 md:pt-0">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                    <button className="p-2 hover:bg-surface-container-high rounded-xl text-on-surface-variant transition-colors">
                      <CheckCircle2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-surface-container-low border border-dashed border-surface-container-high rounded-3xl text-on-surface-variant">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">Nenhum compromisso encontrado</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
