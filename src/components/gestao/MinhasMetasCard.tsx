import { useState, useMemo } from 'react';
import { Tarefa, PontuacaoUsuario, Usuario } from '../../types';
import { tasksService } from '../../services/tasksService';
import { 
  Target, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Trophy, 
  AlertTriangle, 
  TrendingUp, 
  ChevronRight, 
  Sparkles, 
  ListCheck, 
  DollarSign, 
  Hash, 
  Zap,
  Award,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface MinhasMetasCardProps {
  user: Usuario;
  tasks: Tarefa[];
  userScore?: PontuacaoUsuario;
  rankingPosition?: number;
  totalTeamCount?: number;
  proposalsPendingCount?: number;
  returnsPendingCount?: number;
  ticketsPendingCount?: number;
  onNavigateToTasks?: () => void;
}

export default function MinhasMetasCard({
  user,
  tasks,
  userScore,
  rankingPosition = 1,
  totalTeamCount = 1,
  proposalsPendingCount = 0,
  returnsPendingCount = 0,
  ticketsPendingCount = 0,
  onNavigateToTasks
}: MinhasMetasCardProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter tasks assigned to this user that are active today or overdue
  const todayTasks = useMemo(() => {
    return tasks.filter(t => {
      const isAssigned = t.funcionarioId === user.id;
      if (!isAssigned) return false;
      const isActiveToday = t.dataInicial <= todayStr && t.dataFinal >= todayStr;
      const isOverdue = (t.status === 'Pendente' || t.status === 'Em andamento') && t.dataFinal < todayStr;
      return isActiveToday || isOverdue;
    });
  }, [tasks, user.id, todayStr]);

  const overdueTasks = useMemo(() => {
    return todayTasks.filter(t => (t.status === 'Pendente' || t.status === 'Em andamento') && t.dataFinal < todayStr);
  }, [todayTasks, todayStr]);

  const totalTasks = todayTasks.length;
  const completedTasks = todayTasks.filter(t => t.status === 'Concluída').length;
  const pendingTasks = totalTasks - completedTasks;
  const overallPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Toggle checklist item
  const handleToggleChecklist = async (task: Tarefa, itemId: string, currentVal: boolean) => {
    try {
      await tasksService.toggleChecklistItem(task.id, itemId, !currentVal, user.id, user.nome);
      toast.success(!currentVal ? 'Item concluído!' : 'Item desmarcado');
    } catch (e) {
      toast.error('Erro ao atualizar tarefa');
    }
  };

  // Increment Quantity
  const handleIncrementQuantity = async (task: Tarefa, delta: number) => {
    try {
      const current = task.realizadoQuantidade || 0;
      const target = task.metaQuantidade || 1;
      const newAmount = Math.max(0, Math.min(target, current + delta));
      await tasksService.updateTaskQuantityProgress(task.id, newAmount, user.id, user.nome);
      if (newAmount >= target) {
        toast.success(`Meta "${task.titulo}" atingida! 🎉`);
      } else {
        toast.success(`Progresso: ${newAmount}/${target}`);
      }
    } catch (e) {
      toast.error('Erro ao atualizar quantidade');
    }
  };

  // Quick mark complete
  const handleMarkComplete = async (task: Tarefa) => {
    try {
      await tasksService.updateTask(
        task.id, 
        { status: 'Concluída', percentualConcluido: 100, concluidoEm: new Date().toISOString() },
        user.id,
        user.nome
      );
      toast.success('Tarefa concluída com sucesso! +10 pontos 🎉');
    } catch (e) {
      toast.error('Erro ao concluir tarefa');
    }
  };

  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case 'Alta':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700 border border-red-200">Alta</span>;
      case 'Média':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200">Média</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200">Baixa</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Morning Summary Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary to-indigo-700 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 backdrop-blur-3xl rounded-l-full pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
              <h2 className="text-lg font-bold">Bom dia, {user.nome.split(' ')[0]}!</h2>
            </div>
            <p className="text-xs text-blue-100 max-w-xl">
              Hoje você possui <span className="font-bold text-white underline">{totalTasks} tarefas</span> no seu plano do dia. Vamos bater todas as metas!
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-medium text-white/90">
              <span className="bg-white/15 px-2.5 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1.5">
                <Target size={13} className="text-yellow-300" />
                {totalTasks} Tarefas diárias
              </span>
              <span className="bg-white/15 px-2.5 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1.5">
                <Sparkles size={13} className="text-blue-300" />
                {proposalsPendingCount} Propostas p/ enviar
              </span>
              <span className="bg-white/15 px-2.5 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1.5">
                <Clock size={13} className="text-emerald-300" />
                {returnsPendingCount} Retornos pendentes
              </span>
              <span className="bg-white/15 px-2.5 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1.5">
                <Zap size={13} className="text-purple-300" />
                {ticketsPendingCount} Chamados pendentes
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-white/20 pt-3 md:pt-0 md:pl-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-yellow-300">
                <Trophy size={18} />
                <span className="text-xl font-black">{userScore?.pontosHoje || 0}</span>
              </div>
              <span className="text-[10px] text-blue-200 uppercase tracking-widest font-bold">Pontos Hoje</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-white">
                <Award size={18} className="text-yellow-400" />
                <span className="text-xl font-black">#{rankingPosition}</span>
              </div>
              <span className="text-[10px] text-blue-200 uppercase tracking-widest font-bold">Ranking Equipe</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Overdue Warning Alert */}
      {overdueTasks.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-xs font-bold">Atenção: Tarefas em atraso!</p>
              <p className="text-[11px] text-amber-700">Você possui {overdueTasks.length} tarefa(s) com prazo vencido que exigem sua atenção.</p>
            </div>
          </div>
          {onNavigateToTasks && (
            <button 
              onClick={onNavigateToTasks}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
            >
              Ver Todas <ChevronRight size={14} />
            </button>
          )}
        </motion.div>
      )}

      {/* Primary Card: Minhas Metas do Dia */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-container-high">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              🎯
            </div>
            <div>
              <h3 className="font-bold text-on-surface text-base">Minhas Metas do Dia</h3>
              <p className="text-xs text-on-surface-variant">
                Acompanhe e conclua suas atividades programadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold text-primary">{completedTasks} de {totalTasks} Concluídas</p>
              <p className="text-[10px] text-on-surface-variant font-medium">{pendingTasks} Pendentes</p>
            </div>
            {onNavigateToTasks && (
              <button 
                onClick={onNavigateToTasks}
                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                title="Abrir Gestão de Tarefas"
              >
                Gerenciar <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-on-surface">
            <span>Progresso Diário</span>
            <span className="text-primary font-bold">{overallPercentage}%</span>
          </div>
          <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden p-0.5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${overallPercentage}%` }}
              transition={{ duration: 0.6 }}
              className={`h-full rounded-full ${
                overallPercentage === 100 
                  ? 'bg-emerald-500' 
                  : overallPercentage >= 50 
                  ? 'bg-primary' 
                  : 'bg-amber-500'
              }`}
            />
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-2.5">
          {todayTasks.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-surface-container-high rounded-xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-on-surface">Nenhuma meta pendente para hoje!</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Tudo limpo ou aguardando atribuição pelo gestor.</p>
            </div>
          ) : (
            todayTasks.map((task) => {
              const isDone = task.status === 'Concluída';
              const isOverdue = !isDone && task.dataFinal < todayStr;
              const isExpanded = expandedTaskId === task.id;

              return (
                <div 
                  key={task.id} 
                  className={`border rounded-xl p-3.5 transition-all duration-200 ${
                    isDone 
                      ? 'bg-emerald-50/50 border-emerald-200 opacity-80' 
                      : isOverdue 
                      ? 'bg-red-50/40 border-red-200' 
                      : 'bg-surface border-surface-container-high hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Checkbox or Type Icon */}
                      <button 
                        onClick={() => {
                          if (task.tipo === 'checklist') {
                            setExpandedTaskId(isExpanded ? null : task.id);
                          } else if (!isDone) {
                            handleMarkComplete(task);
                          }
                        }}
                        className={`mt-0.5 transition-colors ${
                          isDone ? 'text-emerald-600' : 'text-slate-400 hover:text-primary'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-xs font-bold ${isDone ? 'line-through text-slate-500' : 'text-on-surface'}`}>
                            {task.titulo}
                          </h4>
                          {getPriorityBadge(task.prioridade)}
                          {isOverdue && (
                            <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-red-100 text-red-700">Atrasada</span>
                          )}
                          <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {task.tipo}
                          </span>
                        </div>

                        {task.descricao && (
                          <p className="text-[11px] text-on-surface-variant mt-1 line-clamp-1">
                            {task.descricao}
                          </p>
                        )}

                        {/* Interactive Controls based on Type */}
                        {task.tipo === 'quantidade' && (
                          <div className="mt-2.5 flex items-center gap-3">
                            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                              <button 
                                onClick={() => handleIncrementQuantity(task, -1)}
                                disabled={isDone || (task.realizadoQuantidade || 0) <= 0}
                                className="p-1 text-slate-600 hover:bg-slate-200 rounded disabled:opacity-30"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-xs font-bold text-primary px-1">
                                {task.realizadoQuantidade || 0} / {task.metaQuantidade}
                              </span>
                              <button 
                                onClick={() => handleIncrementQuantity(task, 1)}
                                disabled={isDone || (task.realizadoQuantidade || 0) >= (task.metaQuantidade || 1)}
                                className="p-1 text-slate-600 hover:bg-slate-200 rounded disabled:opacity-30"
                              >
                                <Plus size={12} />
                              </button>
                            </div>

                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all" 
                                style={{ width: `${task.percentualConcluido}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {task.tipo === 'financeiro' && (
                          <div className="mt-2 text-xs font-medium text-slate-600">
                            Meta: <span className="font-bold text-emerald-600">R$ {(task.metaFinanceira || 0).toLocaleString('pt-BR')}</span> | 
                            Realizado: <span className="font-bold text-primary">R$ {(task.realizadoFinanceiro || 0).toLocaleString('pt-BR')}</span> ({task.percentualConcluido}%)
                          </div>
                        )}

                        {task.tipo === 'automatica' && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-indigo-600 font-semibold">
                            <Zap size={13} className="text-indigo-500 animate-pulse" />
                            <span>Sincronizado automaticamente com CRM ({task.realizadoQuantidade || 0}/{task.metaQuantidade || 1})</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions / Toggle Details */}
                    <div className="flex items-center gap-1">
                      {task.tipo === 'checklist' && (
                        <button 
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-surface-container-high transition-colors text-xs font-bold flex items-center gap-1"
                        >
                          <ListCheck size={14} />
                          <span>({task.checklist?.filter(i => i.concluido).length}/{task.checklist?.length})</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}

                      {!isDone && task.tipo !== 'checklist' && (
                        <button
                          onClick={() => handleMarkComplete(task)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors"
                        >
                          Concluir
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Checklist Sub-items Expansion */}
                  {task.tipo === 'checklist' && isExpanded && task.checklist && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 pt-3 border-t border-surface-container-high space-y-2 pl-8"
                    >
                      {task.checklist.map((item) => (
                        <label 
                          key={item.id} 
                          className="flex items-center gap-2.5 text-xs font-medium cursor-pointer text-on-surface hover:text-primary"
                        >
                          <input 
                            type="checkbox" 
                            checked={item.concluido}
                            onChange={() => handleToggleChecklist(task, item.id, item.concluido)}
                            className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                          />
                          <span className={item.concluido ? 'line-through text-slate-400' : ''}>
                            {item.texto}
                          </span>
                        </label>
                      ))}
                    </motion.div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
