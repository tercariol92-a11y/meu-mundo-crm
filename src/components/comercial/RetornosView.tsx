import { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User as UserIcon,
  Phone,
  MessageSquare,
  ChevronRight,
  Filter,
  History,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RetornosView() {
  const [retornos, setRetornos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'hoje' | 'atrasados' | 'futuro'>('todos');

  useEffect(() => {
    fetchRetornos();
  }, []);

  const fetchRetornos = async () => {
    try {
      const data = await databaseService.getPendingReturns();
      setRetornos(data || []);
    } catch (error) {
      console.error('Error fetching returns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (item: any) => {
    try {
      const proximoRetorno = {
        ...item.proximoRetorno,
        concluido: true,
        concluidoAt: new Date().toISOString()
      };

      if (item.source === 'lead') {
        await databaseService.updateLead(item.id, { proximoRetorno });
      } else if (item.source === 'cliente') {
        await databaseService.updateCliente(item.id, { proximoRetorno });
      } else if (item.source === 'proposta') {
        await databaseService.updateProposta(item.id, { proximoRetorno });
      }
      
      fetchRetornos();
    } catch (error) {
      console.error('Error completing return:', error);
    }
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const isOverdue = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  const filteredRetornos = retornos.filter(r => {
    const date = r.proximoRetorno.data;
    if (filter === 'hoje') return isToday(date);
    if (filter === 'atrasados') return isOverdue(date);
    if (filter === 'futuro') return !isToday(date) && !isOverdue(date);
    return true;
  }).sort((a, b) => a.proximoRetorno.data.localeCompare(b.proximoRetorno.data));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-on-surface">Gestão de Retornos</h1>
          <p className="text-sm text-on-surface-variant font-bold uppercase tracking-widest">Acompanhe e finalize seus contatos pendentes</p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {[
            { id: 'todos', label: 'Todos', icon: Tag },
            { id: 'hoje', label: 'Hoje', icon: Calendar },
            { id: 'atrasados', label: 'Atrasados', icon: AlertCircle },
            { id: 'futuro', label: 'Futuro', icon: Clock },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                filter === f.id 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' 
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              <f.icon size={14} />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-surface-container-low rounded-[2rem] border border-surface-container-high animate-pulse" />
          ))
        ) : filteredRetornos.length === 0 ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mx-auto text-on-surface-variant opacity-20">
              <CheckCircle2 size={40} />
            </div>
            <p className="text-sm text-on-surface-variant font-bold uppercase tracking-widest">Nenhum retorno pendente nesta categoria</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredRetornos.map((item) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-surface-container-low rounded-[2rem] border border-surface-container-high p-6 space-y-4 group hover:shadow-xl transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      item.source === 'lead' ? 'bg-orange-100 text-orange-600' : 
                      item.source === 'cliente' ? 'bg-blue-100 text-blue-600' : 'bg-primary/10 text-primary'
                    }`}>
                      <UserIcon size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant opacity-60">{item.source}</p>
                      <h4 className="font-bold text-on-surface line-clamp-1">{item.nome || item.nomeFantasia || item.titulo}</h4>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    isToday(item.proximoRetorno.data) ? 'bg-primary text-white shadow-lg shadow-primary/20' :
                    isOverdue(item.proximoRetorno.data) ? 'bg-error/10 text-error' : 'bg-surface-container-highest text-on-surface-variant'
                  }`}>
                    {isToday(item.proximoRetorno.data) ? 'Hoje' : item.proximoRetorno.data.split('-').reverse().join('/')}
                  </div>
                </div>

                <div className="p-4 bg-surface-container-highest/20 rounded-2xl border border-surface-container-high">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={14} className="text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{item.proximoRetorno.hora || 'Horário não definido'}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant italic leading-relaxed">
                    "{item.proximoRetorno.observacao || 'Nenhuma observação técnica registrada.'}"
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-container-high rounded-xl text-primary hover:bg-primary/10 transition-all">
                    <Phone size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Ligar</span>
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-container-high rounded-xl text-green-600 hover:bg-green-50 transition-all">
                    <MessageSquare size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">WhatsApp</span>
                  </button>
                </div>

                <button 
                  onClick={() => handleComplete(item)}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-primary/20 active:scale-95 transition-all"
                >
                  <CheckCircle2 size={16} />
                  Concluir Retorno
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
