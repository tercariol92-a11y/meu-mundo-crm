import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Star, 
  MessageSquare, 
  Calendar, 
  Filter, 
  TrendingUp, 
  User, 
  Wrench,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ChevronDown
} from 'lucide-react';
import { format, subDays, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { databaseService } from '../../services/databaseService';

interface Survey {
  id: string;
  telefone: string;
  clienteNome: string;
  nota: number;
  atendente: string;
  tecnico?: string;
  leadId: string;
  comentario?: string;
  origem: string;
  createdAt: string;
  nps?: number;
  ratings?: Record<string, number>;
}

const SatisfacaoView: React.FC = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState('30'); // days
  const [filterNote, setFilterNote] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribe = databaseService.onSurveysChange((data) => {
      setSurveys(data.map((item: any) => ({
        ...item,
        clienteNome: item.clienteNome || item.clientName || 'Cliente',
        atendente: item.atendente || item.technicianName || 'Equipe Mundo Tech',
        tecnico: item.tecnico || item.technicianName || '',
        nota: Number(item.nota ?? item.rating ?? item.ratings?.technicalSupport ?? 0),
        comentario: item.comentario || item.comment || '',
        origem: item.origem || item.origin || 'link público',
        createdAt: item.createdAt || item.answeredAt || '',
      })) as Survey[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredSurveys = useMemo(() => {
    const now = new Date();
    const startDate = subDays(now, parseInt(filterPeriod));

    return surveys.filter(s => {
      let matchesPeriod = true;
      if (s.createdAt) {
        try {
          const date = parseISO(s.createdAt);
          matchesPeriod = isWithinInterval(date, { start: startOfDay(startDate), end: endOfDay(now) });
        } catch (e) {
          console.warn("Invalid date in survey:", s.createdAt);
          matchesPeriod = false;
        }
      } else {
        // If no date, only show if we are looking for 'all' or it was very recent (optimistic)
        matchesPeriod = filterPeriod === '365'; 
      }
      const matchesNote = filterNote === 'todos' || (filterNote === 'promotores' ? Number(s.nps) >= 9 : filterNote === 'neutros' ? Number(s.nps) >= 7 && Number(s.nps) <= 8 : filterNote === 'detratores' ? Number(s.nps) <= 6 : s.nota.toString() === filterNote);
      const matchesSearch = 
        (s.clienteNome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.telefone || '').includes(searchTerm) ||
        (s.atendente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.tecnico && s.tecnico.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesPeriod && matchesNote && matchesSearch;
    });
  }, [surveys, filterPeriod, filterNote, searchTerm]);

  const stats = useMemo(() => {
    if (filteredSurveys.length === 0) return {
      avg: 0,
      total: 0,
      bestAttendant: '-',
      bestTecnico: '-',
      satisfied: 0,
      neutral: 0,
      unsatisfied: 0
    };

    const total = filteredSurveys.length;
    const sum = filteredSurveys.reduce((acc, curr) => acc + curr.nota, 0);
    const avg = sum / total;

    const satisfied = filteredSurveys.filter(s => s.nota >= 4).length;
    const neutral = filteredSurveys.filter(s => s.nota === 3).length;
    const unsatisfied = filteredSurveys.filter(s => s.nota <= 2).length;

    // Rankings
    const attendantScores: Record<string, { sum: number, count: number }> = {};
    const tecnicoScores: Record<string, { sum: number, count: number }> = {};

    filteredSurveys.forEach(s => {
      if (!attendantScores[s.atendente]) attendantScores[s.atendente] = { sum: 0, count: 0 };
      attendantScores[s.atendente].sum += s.nota;
      attendantScores[s.atendente].count += 1;

      if (s.tecnico) {
        if (!tecnicoScores[s.tecnico]) tecnicoScores[s.tecnico] = { sum: 0, count: 0 };
        tecnicoScores[s.tecnico].sum += s.nota;
        tecnicoScores[s.tecnico].count += 1;
      }
    });

    const bestAttendant = Object.entries(attendantScores)
      .map(([name, data]) => ({ name, avg: data.sum / data.count }))
      .sort((a, b) => b.avg - a.avg)[0]?.name || '-';

    const bestTecnico = Object.entries(tecnicoScores)
      .map(([name, data]) => ({ name, avg: data.sum / data.count }))
      .sort((a, b) => b.avg - a.avg)[0]?.name || '-';

    return { avg, total, bestAttendant, bestTecnico, satisfied, neutral, unsatisfied };
  }, [filteredSurveys]);

  const renderStars = (note: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star} 
            size={14} 
            className={`${star <= note ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f8fafc]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-[#f8fafc] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Satisfação do Cliente</h1>
          <p className="text-gray-500">Monitore a qualidade do seu atendimento e assistência</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar cliente, atendente..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white min-w-[240px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
          </select>

          <select 
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
            value={filterNote}
            onChange={(e) => setFilterNote(e.target.value)}
          >
            <option value="todos">Todas as notas</option>
            <option value="promotores">NPS Promotores (9–10)</option>
            <option value="neutros">NPS Neutros (7–8)</option>
            <option value="detratores">NPS Detratores (0–6)</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="text-primary" size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Média Geral</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-gray-900">{stats.avg.toFixed(1)}</h3>
              <div className="flex text-yellow-400 fill-yellow-400">
                <Star size={16} className="fill-current" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <MessageSquare className="text-blue-600" size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Total Avaliações</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats.total}</h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <User className="text-green-600" size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Melhor Atendente</p>
            <h3 className="text-xl font-bold text-gray-900 truncate">{stats.bestAttendant}</h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Wrench className="text-purple-600" size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">Melhor Técnico</p>
            <h3 className="text-xl font-bold text-gray-900 truncate">{stats.bestTecnico}</h3>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table/List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Avaliações Recentes</h2>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full uppercase font-medium">
                {filteredSurveys.length} resultados
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Cliente</th>
                    <th className="px-6 py-3 font-semibold">NPS / Suporte</th>
                    <th className="px-6 py-3 font-semibold">Atendente</th>
                    <th className="px-6 py-3 font-semibold">Técnico</th>
                    <th className="px-6 py-3 font-semibold">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredSurveys.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                        Nenhuma avaliação encontrada para os filtros selecionados
                      </td>
                    </tr>
                  ) : (
                    filteredSurveys.map((survey) => (
                      <motion.tr 
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={survey.id} 
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{survey.clienteNome}</span>
                            <span className="text-xs text-gray-500">{survey.telefone}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {Number.isFinite(survey.nps) && <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-black ${Number(survey.nps) >= 9 ? 'bg-green-100 text-green-700' : Number(survey.nps) >= 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>NPS {survey.nps}</span>}
                            {renderStars(survey.nota)}
                            <span className={`text-[10px] font-bold uppercase ${
                              survey.nota >= 4 ? 'text-green-600' : survey.nota === 3 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {survey.nota >= 4 ? 'Satisfeito' : survey.nota === 3 ? 'Neutro' : 'Insatisfeito'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{survey.atendente}</td>
                        <td className="px-6 py-4 text-gray-600">{survey.tecnico || '-'}</td>
                        <td className="px-6 py-4 text-gray-500 text-xs">
                          {survey.createdAt ? format(parseISO(survey.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Breakdown side panel */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-6">Distribuição de Notas</h2>
            <div className="space-y-4">
              {[5, 4, 3, 2, 1].map(note => {
                const count = filteredSurveys.filter(s => s.nota === note).length;
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                
                return (
                  <div key={note} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <div className="flex items-center gap-1.5 grayscale opacity-70">
                        <span>{note}</span>
                        <Star size={12} className="fill-yellow-400 text-yellow-400" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">{count} av.</span>
                        <span className="text-gray-700">{percentage.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        className={`h-full rounded-full ${
                          note >= 4 ? 'bg-green-500' : note === 3 ? 'bg-yellow-400' : 'bg-red-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{stats.satisfied}</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Felizes</div>
              </div>
              <div className="text-center border-x border-gray-100 px-2">
                <div className="text-lg font-bold text-yellow-600">{stats.neutral}</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Neutros</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-600">{stats.unsatisfied}</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Tristes</div>
              </div>
            </div>
          </div>

          <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 relative overflow-hidden">
            <TrendingUp size={80} className="absolute -right-4 -bottom-4 text-primary/10 -rotate-12" />
            <div className="relative z-10">
              <h3 className="font-bold text-primary mb-1">Dica Mundo Tech</h3>
              <p className="text-sm text-primary/80 leading-relaxed">
                Manter a média acima de 4.5 aumenta a fidelização em até 60%. 
                Revise os atendimentos com nota 1 ou 2 semanalmente com a equipe.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SatisfacaoView;
