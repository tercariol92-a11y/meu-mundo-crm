import { useState, useEffect } from 'react';
import { Tarefa, PontuacaoUsuario, Usuario } from '../../types';
import { tasksService } from '../../services/tasksService';
import { useGlobalData } from '../../contexts/GlobalDataContext';
import { BarChart3, Users, CheckCircle2, Clock, AlertTriangle, ChevronRight, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface TeamProductivityWidgetProps {
  onNavigateToGestao?: () => void;
}

export default function TeamProductivityWidget({ onNavigateToGestao }: TeamProductivityWidgetProps) {
  const { usuarios } = useGlobalData();
  const [tasks, setTasks] = useState<Tarefa[]>([]);
  const [scores, setScores] = useState<PontuacaoUsuario[]>([]);

  useEffect(() => {
    const unsubTasks = tasksService.subscribeTasks(setTasks);
    const unsubScores = tasksService.subscribeScores(setScores);
    return () => {
      unsubTasks();
      unsubScores();
    };
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const activeStaff = usuarios?.filter(u => u.ativo !== false) || [];

  const teamData = activeStaff.map(emp => {
    const userTasks = tasks.filter(t => t.funcionarioId === emp.id);
    const total = userTasks.length;
    const concluidas = userTasks.filter(t => t.status === 'Concluída').length;
    const pendentes = userTasks.filter(t => t.status === 'Pendente' || t.status === 'Em andamento').length;
    const atrasadas = userTasks.filter(t => (t.status === 'Pendente' || t.status === 'Em andamento') && t.dataFinal < todayStr).length;
    const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;
    const userScore = scores.find(s => s.funcionarioId === emp.id);

    return {
      id: emp.id,
      nome: emp.nome,
      role: emp.role,
      total,
      concluidas,
      pendentes,
      atrasadas,
      percentual,
      pontosHoje: userScore?.pontosHoje || 0
    };
  }).sort((a, b) => b.percentual - a.percentual);

  return (
    <div className="bg-surface-container-low p-6 rounded-[2.5rem] border border-surface-container-high shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl">
            <BarChart3 size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-on-surface">Produtividade da Equipe</h3>
            <p className="text-xs text-on-surface-variant font-medium">
              Metas e tarefas diárias por colaborador em tempo real
            </p>
          </div>
        </div>

        {onNavigateToGestao && (
          <button
            onClick={onNavigateToGestao}
            className="px-4 py-2 bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 w-fit"
          >
            <span>Ver Gestão Completa</span>
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
        {teamData.slice(0, 6).map((member) => (
          <div key={member.id} className="p-4 bg-surface border border-surface-container-high rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  {member.nome.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-on-surface">{member.nome}</h4>
                  <p className="text-[10px] uppercase font-semibold text-slate-400">{member.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full text-[11px] font-extrabold">
                <Trophy size={12} />
                <span>{member.pontosHoje} pts</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-500">Conclusão Metas</span>
                <span className="text-primary">{member.percentual}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${member.percentual}%` }}
                  transition={{ duration: 0.8 }}
                  className={`h-full rounded-full ${
                    member.percentual === 100 
                      ? 'bg-emerald-500' 
                      : member.percentual >= 50 
                      ? 'bg-primary' 
                      : 'bg-amber-500'
                  }`}
                />
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 pt-1 border-t border-slate-100">
              <span className="text-emerald-600">{member.concluidas} concluídas</span>
              <span className="text-amber-600">{member.pendentes} pendentes</span>
              {member.atrasadas > 0 && (
                <span className="text-red-600 font-extrabold">{member.atrasadas} em atraso</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
