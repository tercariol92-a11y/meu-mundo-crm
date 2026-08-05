import { useState, useEffect, useMemo } from 'react';
import { 
  Tarefa, 
  ModeloTarefa, 
  Usuario, 
  TaskType, 
  AutoTaskTrigger, 
  TaskPriority, 
  TaskStatus, 
  TaskRecurrence,
  ChecklistItem,
  PontuacaoUsuario,
  TarefaHistoricoDiario,
  TarefaLog
} from '../../types';
import { tasksService, POINT_VALUES } from '../../services/tasksService';
import { useGlobalData } from '../../contexts/GlobalDataContext';
import { 
  CheckSquare, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Users, 
  Copy, 
  Edit, 
  Trash2, 
  TrendingUp, 
  BarChart3, 
  Trophy, 
  History, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Zap, 
  DollarSign, 
  ListCheck, 
  X, 
  Save, 
  RotateCcw, 
  Sparkles,
  Layers,
  Award,
  ChevronRight,
  ChevronDown,
  Info,
  CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line 
} from 'recharts';
import toast from 'react-hot-toast';

interface GestaoTarefasViewProps {
  user: Usuario;
}

export default function GestaoTarefasView({ user }: GestaoTarefasViewProps) {
  const { usuarios } = useGlobalData();

  // Active Tab: 'tarefas' | 'produtividade' | 'ranking' | 'historico' | 'modelos'
  const [activeTab, setActiveTab] = useState<'tarefas' | 'produtividade' | 'ranking' | 'historico' | 'modelos'>('tarefas');

  // Real-time Tasks list state
  const [tasks, setTasks] = useState<Tarefa[]>([]);
  const [templates, setTemplates] = useState<ModeloTarefa[]>([]);
  const [scores, setScores] = useState<PontuacaoUsuario[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Filters State
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFuncionario, setFilterFuncionario] = useState<string>('todos');
  const [filterEquipe, setFilterEquipe] = useState<string>('todas');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterDate, setFilterDate] = useState<string>('');

  // Selected Employee for History Detail
  const [selectedHistoryUserId, setSelectedHistoryUserId] = useState<string>('');
  const [employeeHistory, setEmployeeHistory] = useState<TarefaHistoricoDiario[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Tarefa | null>(null);

  // Task Form State
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formFuncionarioId, setFormFuncionarioId] = useState('');
  const [formEquipe, setFormEquipe] = useState('Comercial');
  const [formTipo, setFormTipo] = useState<TaskType>('checklist');
  const [formTipoAutomatico, setFormTipoAutomatico] = useState<AutoTaskTrigger>('criar_proposta');
  const [formPrioridade, setFormPrioridade] = useState<TaskPriority>('Média');
  const [formDataInicial, setFormDataInicial] = useState(new Date().toISOString().split('T')[0]);
  const [formDataFinal, setFormDataFinal] = useState(new Date().toISOString().split('T')[0]);
  const [formHorario, setFormHorario] = useState('09:00');
  const [formRepeticao, setFormRepeticao] = useState<TaskRecurrence>('Não repetir');
  const [formMetaQuantidade, setFormMetaQuantidade] = useState<number>(10);
  const [formMetaFinanceira, setFormMetaFinanceira] = useState<number>(10000);
  const [formChecklistItems, setFormChecklistItems] = useState<string[]>(['Ligar para cliente', 'Enviar proposta']);
  const [formNewChecklistText, setFormNewChecklistText] = useState('');

  // Template Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Subscribe to tasks and scores
  useEffect(() => {
    setLoadingTasks(true);
    const unsubTasks = tasksService.subscribeTasks((newTasks) => {
      setTasks(newTasks);
      setLoadingTasks(false);
    });

    const unsubScores = tasksService.subscribeScores((newScores) => {
      setScores(newScores);
    });

    // Load templates
    tasksService.getTaskTemplates().then(setTemplates);

    return () => {
      unsubTasks();
      unsubScores();
    };
  }, []);

  // Update employee history when selecting a user in History Tab
  useEffect(() => {
    if (selectedHistoryUserId) {
      tasksService.getEmployeeHistory(selectedHistoryUserId).then(setEmployeeHistory);
    } else if (usuarios && usuarios.length > 0) {
      setSelectedHistoryUserId(usuarios[0].id);
    }
  }, [selectedHistoryUserId, usuarios]);

  // Available staff list
  const staffList = useMemo(() => {
    return usuarios?.filter(u => u.ativo !== false) || [];
  }, [usuarios]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterSearch && !t.titulo.toLowerCase().includes(filterSearch.toLowerCase()) && !t.descricao?.toLowerCase().includes(filterSearch.toLowerCase())) {
        return false;
      }
      if (filterFuncionario !== 'todos' && t.funcionarioId !== filterFuncionario) {
        return false;
      }
      if (filterEquipe !== 'todas' && t.equipe !== filterEquipe) {
        return false;
      }
      if (filterStatus !== 'todos' && t.status !== filterStatus) {
        return false;
      }
      if (filterTipo !== 'todos' && t.tipo !== filterTipo) {
        return false;
      }
      if (filterDate && (t.dataInicial > filterDate || t.dataFinal < filterDate)) {
        return false;
      }
      return true;
    });
  }, [tasks, filterSearch, filterFuncionario, filterEquipe, filterStatus, filterTipo, filterDate]);

  // Productivity Metrics by Employee
  const employeeProductivity = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    return staffList.map(u => {
      const userTasks = tasks.filter(t => t.funcionarioId === u.id);
      const total = userTasks.length;
      const concluidas = userTasks.filter(t => t.status === 'Concluída').length;
      const pendentes = userTasks.filter(t => t.status === 'Pendente' || t.status === 'Em andamento').length;
      const atrasadas = userTasks.filter(t => (t.status === 'Pendente' || t.status === 'Em andamento') && t.dataFinal < todayStr).length;
      const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

      return {
        id: u.id,
        nome: u.nome,
        role: u.role,
        photoURL: u.photoURL,
        total,
        concluidas,
        pendentes,
        atrasadas,
        percentual
      };
    }).sort((a, b) => b.percentual - a.percentual);
  }, [staffList, tasks]);

  // Overall Task Statistics
  const statsOverview = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const total = tasks.length;
    const concluidas = tasks.filter(t => t.status === 'Concluída').length;
    const pendentes = tasks.filter(t => t.status === 'Pendente' || t.status === 'Em andamento').length;
    const atrasadas = tasks.filter(t => (t.status === 'Pendente' || t.status === 'Em andamento') && t.dataFinal < todayStr).length;

    return { total, concluidas, pendentes, atrasadas };
  }, [tasks]);

  // Open Create Task Modal
  const handleOpenCreateModal = (template?: ModeloTarefa) => {
    setEditingTask(null);
    if (template) {
      setFormTitulo(template.titulo);
      setFormDescricao(template.descricao || '');
      setFormTipo(template.tipo);
      setFormTipoAutomatico(template.tipoAutomatico || 'criar_proposta');
      setFormPrioridade(template.prioridade);
      setFormEquipe(template.equipe || 'Comercial');
      setFormRepeticao(template.repeticao);
      setFormChecklistItems(template.checklistPadrao || []);
      setFormMetaQuantidade(template.metaQuantidadePadrao || 10);
      setFormMetaFinanceira(template.metaFinanceiraPadrao || 10000);
    } else {
      setFormTitulo('');
      setFormDescricao('');
      setFormTipo('checklist');
      setFormTipoAutomatico('criar_proposta');
      setFormPrioridade('Média');
      setFormEquipe('Comercial');
      setFormRepeticao('Não repetir');
      setFormChecklistItems(['Ligar para cliente', 'Enviar proposta']);
      setFormMetaQuantidade(10);
      setFormMetaFinanceira(10000);
    }
    setFormFuncionarioId(user.id);
    setFormDataInicial(new Date().toISOString().split('T')[0]);
    setFormDataFinal(new Date().toISOString().split('T')[0]);
    setFormHorario('09:00');
    setIsModalOpen(true);
  };

  // Open Edit Task Modal
  const handleOpenEditModal = (task: Tarefa) => {
    setEditingTask(task);
    setFormTitulo(task.titulo);
    setFormDescricao(task.descricao || '');
    setFormFuncionarioId(task.funcionarioId);
    setFormEquipe(task.equipe || 'Comercial');
    setFormTipo(task.tipo);
    setFormTipoAutomatico(task.tipoAutomatico || 'criar_proposta');
    setFormPrioridade(task.prioridade);
    setFormDataInicial(task.dataInicial);
    setFormDataFinal(task.dataFinal);
    setFormHorario(task.horario || '09:00');
    setFormRepeticao(task.repeticao);
    setFormMetaQuantidade(task.metaQuantidade || 10);
    setFormMetaFinanceira(task.metaFinanceira || 10000);
    setFormChecklistItems((task.checklist || []).map(i => i.texto));
    setIsModalOpen(true);
  };

  // Save Task
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim()) {
      toast.error('O título da tarefa é obrigatório.');
      return;
    }
    if (!formFuncionarioId) {
      toast.error('Selecione o funcionário responsável.');
      return;
    }

    try {
      const assignedUser = staffList.find(u => u.id === formFuncionarioId);
      const funcionarioNome = assignedUser ? assignedUser.nome : 'Colaborador';
      const funcionarioFoto = assignedUser?.photoURL || '';

      const checklist: ChecklistItem[] = formChecklistItems.map((texto, idx) => ({
        id: `item_${idx}_${Date.now()}`,
        texto,
        concluido: false
      }));

      if (editingTask) {
        // Update existing task
        await tasksService.updateTask(
          editingTask.id,
          {
            titulo: formTitulo,
            descricao: formDescricao,
            funcionarioId: formFuncionarioId,
            funcionarioNome,
            funcionarioFoto,
            equipe: formEquipe,
            tipo: formTipo,
            tipoAutomatico: formTipo === 'automatica' ? formTipoAutomatico : undefined,
            prioridade: formPrioridade,
            dataInicial: formDataInicial,
            dataFinal: formDataFinal,
            horario: formHorario,
            repeticao: formRepeticao,
            metaQuantidade: formTipo === 'quantidade' || formTipo === 'automatica' ? formMetaQuantidade : undefined,
            metaFinanceira: formTipo === 'financeiro' ? formMetaFinanceira : undefined,
            checklist: formTipo === 'checklist' ? checklist : undefined
          },
          user.id,
          user.nome
        );
        toast.success('Tarefa atualizada com sucesso!');
      } else {
        // Create new task
        await tasksService.createTask({
          titulo: formTitulo,
          descricao: formDescricao,
          funcionarioId: formFuncionarioId,
          funcionarioNome,
          funcionarioFoto,
          equipe: formEquipe,
          tipo: formTipo,
          tipoAutomatico: formTipo === 'automatica' ? formTipoAutomatico : undefined,
          prioridade: formPrioridade,
          dataInicial: formDataInicial,
          dataFinal: formDataFinal,
          horario: formHorario,
          repeticao: formRepeticao,
          status: 'Pendente',
          metaQuantidade: formTipo === 'quantidade' || formTipo === 'automatica' ? formMetaQuantidade : undefined,
          realizadoQuantidade: 0,
          metaFinanceira: formTipo === 'financeiro' ? formMetaFinanceira : undefined,
          realizadoFinanceiro: 0,
          checklist: formTipo === 'checklist' ? checklist : undefined,
          criadoPorId: user.id,
          criadoPorNome: user.nome
        });
        toast.success('Tarefa criada com sucesso!');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Error saving task:", err);
      toast.error('Erro ao salvar tarefa: ' + (err.message || 'Erro desconhecido'));
    }
  };

  // Delete Task
  const handleDeleteTask = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
      try {
        await tasksService.deleteTask(id, user.id, user.nome);
        toast.success('Tarefa excluída.');
      } catch (err) {
        toast.error('Erro ao excluir tarefa.');
      }
    }
  };

  // Duplicate Task
  const handleDuplicateTask = async (id: string) => {
    try {
      await tasksService.duplicateTask(id, user.id, user.nome);
      toast.success('Tarefa duplicada com sucesso!');
    } catch (err) {
      toast.error('Erro ao duplicar tarefa.');
    }
  };

  // Add Checklist Item to Form
  const handleAddChecklistItem = () => {
    if (formNewChecklistText.trim()) {
      setFormChecklistItems(prev => [...prev, formNewChecklistText.trim()]);
      setFormNewChecklistText('');
    }
  };

  const handleRemoveChecklistItem = (index: number) => {
    setFormChecklistItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <CheckSquare size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-on-surface">Gestão de Tarefas</h1>
              <p className="text-xs text-on-surface-variant">
                Defina metas, checklists e acompanhe a produtividade da equipe em tempo real
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="px-4 py-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest rounded-xl text-xs font-bold transition-colors flex items-center gap-2 border border-surface-container-high"
          >
            <Layers size={16} />
            <span>Modelos</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal()}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-md shadow-primary/20"
          >
            <Plus size={16} />
            <span>Nova Tarefa</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 font-bold">
            <CheckSquare size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total Tarefas</p>
            <p className="text-xl font-black text-on-surface">{statsOverview.total}</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 font-bold">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Concluídas</p>
            <p className="text-xl font-black text-emerald-600">{statsOverview.concluidas}</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 font-bold">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Pendentes</p>
            <p className="text-xl font-black text-amber-600">{statsOverview.pendentes}</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-50 text-red-600 font-bold">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Em Atraso</p>
            <p className="text-xl font-black text-red-600">{statsOverview.atrasadas}</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-surface-container-high overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('tarefas')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'tarefas'
              ? 'bg-primary text-white shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          <CheckSquare size={16} />
          <span>Tarefas ({filteredTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('produtividade')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'produtividade'
              ? 'bg-primary text-white shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          <BarChart3 size={16} />
          <span>Produtividade da Equipe</span>
        </button>

        <button
          onClick={() => setActiveTab('ranking')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'ranking'
              ? 'bg-primary text-white shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          <Trophy size={16} />
          <span>Ranking Diário</span>
        </button>

        <button
          onClick={() => setActiveTab('historico')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 ${
            activeTab === 'historico'
              ? 'bg-primary text-white shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
        >
          <History size={16} />
          <span>Histórico & Desempenho</span>
        </button>
      </div>

      {/* TAB 1: TAREFAS */}
      {activeTab === 'tarefas' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 w-full md:w-auto min-w-[200px]">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Buscar tarefas pelo título ou descrição..."
                className="w-full pl-9 pr-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={filterFuncionario}
                onChange={(e) => setFilterFuncionario(e.target.value)}
                className="px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="todos">Todos os Funcionários</option>
                {staffList.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>

              <select
                value={filterEquipe}
                onChange={(e) => setFilterEquipe(e.target.value)}
                className="px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="todas">Todas as Equipes</option>
                <option value="Comercial">Comercial</option>
                <option value="Suporte">Suporte</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Técnico">Técnico</option>
                <option value="Geral">Geral</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="todos">Todos os Status</option>
                <option value="Pendente">Pendente</option>
                <option value="Em andamento">Em andamento</option>
                <option value="Concluída">Concluída</option>
                <option value="Cancelada">Cancelada</option>
              </select>

              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="checklist">Checklist</option>
                <option value="quantidade">Meta Quantidade</option>
                <option value="financeiro">Meta Financeira</option>
                <option value="automatica">Meta Automática</option>
              </select>

              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-3 py-1.5 bg-surface border border-surface-container-high rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                title="Filtrar por data"
              />

              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="p-2 text-slate-400 hover:text-red-500 rounded-lg text-xs"
                  title="Limpar filtro de data"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Tasks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.length === 0 ? (
              <div className="col-span-full text-center py-12 border-2 border-dashed border-surface-container-high rounded-2xl bg-surface-container-lowest">
                <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-on-surface">Nenhuma tarefa encontrada com estes filtros.</p>
                <p className="text-xs text-on-surface-variant mt-1">Crie uma nova tarefa ou ajuste os critérios de busca.</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const todayStr = new Date().toISOString().split('T')[0];
                const isDone = task.status === 'Concluída';
                const isOverdue = !isDone && task.dataFinal < todayStr;

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`bg-surface-container-lowest border rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-4 transition-all hover:shadow-md ${
                      isDone 
                        ? 'border-emerald-200 bg-emerald-50/20' 
                        : isOverdue 
                        ? 'border-red-200 bg-red-50/20' 
                        : 'border-surface-container-high'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            task.status === 'Concluída' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : task.status === 'Em andamento'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {task.status}
                          </span>

                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            task.prioridade === 'Alta' 
                              ? 'bg-red-100 text-red-700' 
                              : task.prioridade === 'Média'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {task.prioridade}
                          </span>

                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 uppercase">
                            {task.tipo}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDuplicateTask(task.id)}
                            className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-surface-container-high transition-colors"
                            title="Duplicar Tarefa"
                          >
                            <Copy size={14} />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(task)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-surface-container-high transition-colors"
                            title="Editar Tarefa"
                          >
                            <Edit size={14} />
                          </button>

                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-surface-container-high transition-colors"
                            title="Excluir Tarefa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h3 className={`text-sm font-bold ${isDone ? 'line-through text-slate-400' : 'text-on-surface'}`}>
                        {task.titulo}
                      </h3>

                      {task.descricao && (
                        <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                          {task.descricao}
                        </p>
                      )}

                      {/* Specific Type Display */}
                      <div className="mt-3 pt-3 border-t border-surface-container-high space-y-2">
                        {task.tipo === 'checklist' && (
                          <div className="text-xs text-on-surface-variant font-medium flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <ListCheck size={14} className="text-primary" />
                              Checklist
                            </span>
                            <span className="font-bold text-primary">
                              {task.checklist?.filter(i => i.concluido).length || 0} / {task.checklist?.length || 0} Itens
                            </span>
                          </div>
                        )}

                        {task.tipo === 'quantidade' && (
                          <div className="text-xs font-medium space-y-1">
                            <div className="flex justify-between">
                              <span className="text-on-surface-variant">Meta por Quantidade</span>
                              <span className="font-bold text-primary">{task.realizadoQuantidade || 0} / {task.metaQuantidade || 0}</span>
                            </div>
                            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${task.percentualConcluido}%` }}></div>
                            </div>
                          </div>
                        )}

                        {task.tipo === 'financeiro' && (
                          <div className="text-xs font-medium space-y-1">
                            <div className="flex justify-between">
                              <span className="text-on-surface-variant">Meta Financeira</span>
                              <span className="font-bold text-emerald-600">R$ {(task.realizadoFinanceiro || 0).toLocaleString('pt-BR')} / R$ {(task.metaFinanceira || 0).toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${task.percentualConcluido}%` }}></div>
                            </div>
                          </div>
                        )}

                        {task.tipo === 'automatica' && (
                          <div className="text-xs text-indigo-600 font-semibold flex items-center gap-1.5">
                            <Zap size={14} className="text-indigo-500 animate-pulse" />
                            <span>Gatilho CRM: {task.tipoAutomatico?.replace('_', ' ')} ({task.realizadoQuantidade || 0}/{task.metaQuantidade || 1})</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="pt-3 border-t border-surface-container-high flex items-center justify-between text-[11px] text-on-surface-variant">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                          {task.funcionarioNome ? task.funcionarioNome.substring(0, 2).toUpperCase() : 'US'}
                        </div>
                        <span className="font-semibold text-on-surface">{task.funcionarioNome}</span>
                      </div>

                      <div className="flex items-center gap-1 font-medium text-slate-500">
                        <CalendarDays size={13} />
                        <span>{task.dataInicial === task.dataFinal ? task.dataInicial : `${task.dataInicial} até ${task.dataFinal}`}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PRODUTIVIDADE DA EQUIPE */}
      {activeTab === 'produtividade' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Produtividade da Equipe</h2>
              <p className="text-xs text-on-surface-variant">
                Acompanhamento percentual de metas e tarefas distribuídas para cada colaborador
              </p>
            </div>

            <div className="space-y-4">
              {employeeProductivity.map((emp) => (
                <div key={emp.id} className="p-4 bg-surface border border-surface-container-high rounded-xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                        {emp.nome.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-on-surface">{emp.nome}</h3>
                        <p className="text-[11px] text-on-surface-variant uppercase tracking-wider">{emp.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <span className="text-emerald-600">{emp.concluidas} Concluídas</span>
                      <span className="text-amber-600">{emp.pendentes} Pendentes</span>
                      <span className="text-red-600">{emp.atrasadas} Em atraso</span>
                      <span className="text-sm font-black text-primary ml-2">{emp.percentual}%</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${emp.percentual}%` }}
                      transition={{ duration: 0.8 }}
                      className={`h-full rounded-full ${
                        emp.percentual === 100 
                          ? 'bg-emerald-500' 
                          : emp.percentual >= 50 
                          ? 'bg-primary' 
                          : 'bg-amber-500'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RANKING DIÁRIO */}
      {activeTab === 'ranking' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <Trophy className="text-yellow-500" size={20} />
                  Ranking e Gamificação de Colaboradores
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Pontuações acumuladas por tarefas concluídas, propostas criadas, vendas fechadas e chamados atendidos
                </p>
              </div>

              {/* Points Rules Legend */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">+10 Tarefa</span>
                <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-lg">+20 Proposta</span>
                <span className="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-lg">+50 Venda Fechada</span>
                <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg">+15 Chamado</span>
              </div>
            </div>

            {/* Leaderboard Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-container-high text-on-surface-variant uppercase text-[10px] font-bold">
                    <th className="py-3 px-4">Posição</th>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4 text-center">Pontos Hoje</th>
                    <th className="py-3 px-4 text-center">Tarefas Concluídas</th>
                    <th className="py-3 px-4 text-center">Propostas Criadas</th>
                    <th className="py-3 px-4 text-center">Vendas Fechadas</th>
                    <th className="py-3 px-4 text-center">Pontos Mês</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {scores.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Nenhuma pontuação registrada hoje. Conclua tarefas para aparecer no ranking!
                      </td>
                    </tr>
                  ) : (
                    scores.map((score, index) => {
                      const rank = index + 1;
                      return (
                        <tr key={score.id} className="hover:bg-surface transition-colors font-medium">
                          <td className="py-3.5 px-4 font-black">
                            {rank === 1 ? (
                              <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full flex items-center gap-1 w-fit font-bold">
                                🥇 #1
                              </span>
                            ) : rank === 2 ? (
                              <span className="px-2.5 py-1 bg-slate-200 text-slate-800 rounded-full flex items-center gap-1 w-fit font-bold">
                                🥈 #2
                              </span>
                            ) : rank === 3 ? (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full flex items-center gap-1 w-fit font-bold">
                                🥉 #3
                              </span>
                            ) : (
                              <span className="text-slate-500 font-bold ml-2">#{rank}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-on-surface flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                              {score.funcionarioNome.substring(0, 2).toUpperCase()}
                            </div>
                            {score.funcionarioNome}
                          </td>
                          <td className="py-3.5 px-4 text-center font-black text-primary text-sm">
                            {score.pontosHoje || 0} pts
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-emerald-600">
                            {score.tarefasConcluidasHoje || 0}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-blue-600">
                            {score.propostasCriadasHoje || 0}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-purple-600">
                            {score.vendasFechadasHoje || 0}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                            {score.pontosMes || 0} pts
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HISTÓRICO & DESEMPENHO */}
      {activeTab === 'historico' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-on-surface">Histórico Diário do Colaborador</h2>
                <p className="text-xs text-on-surface-variant">
                  Selecione um funcionário para visualizar o registro histórico de percentual de metas concluídas
                </p>
              </div>

              <select
                value={selectedHistoryUserId}
                onChange={(e) => setSelectedHistoryUserId(e.target.value)}
                className="px-4 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary"
              >
                {staffList.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>

            {/* Performance Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={employeeHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="data" textAnchor="end" height={40} style={{ fontSize: '11px' }} />
                  <YAxis domain={[0, 100]} unit="%" style={{ fontSize: '11px' }} />
                  <Tooltip />
                  <Bar dataKey="percentualConcluido" name="Conclusão %" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Daily History List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Registros Diários</h3>
              {employeeHistory.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Nenhum histórico diário registrado ainda para este funcionário.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {employeeHistory.map((hist) => (
                    <div key={hist.id} className="p-3 bg-surface border border-surface-container-high rounded-xl text-center space-y-1">
                      <p className="text-[11px] font-bold text-slate-500">{hist.data}</p>
                      <p className={`text-lg font-black ${
                        hist.percentualConcluido === 100 ? 'text-emerald-600' : 'text-primary'
                      }`}>
                        {hist.percentualConcluido}%
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {hist.concluidas}/{hist.totalTarefas} metas
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA / EDITAR TAREFA */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest border border-surface-container-high rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
                <h2 className="text-lg font-bold text-on-surface">
                  {editingTask ? 'Editar Tarefa' : 'Nova Tarefa / Meta'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveTask} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Título da Tarefa *</label>
                  <input
                    type="text"
                    required
                    value={formTitulo}
                    onChange={(e) => setFormTitulo(e.target.value)}
                    placeholder="Ex: Ligar para Fertipar e enviar proposta"
                    className="w-full px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Descrição</label>
                  <textarea
                    rows={2}
                    value={formDescricao}
                    onChange={(e) => setFormDescricao(e.target.value)}
                    placeholder="Orientações detalhadas para o colaborador..."
                    className="w-full px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Funcionário & Equipe */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Funcionário Responsável *</label>
                    <select
                      required
                      value={formFuncionarioId}
                      onChange={(e) => setFormFuncionarioId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Selecione o Funcionário...</option>
                      {staffList.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Equipe (opcional)</label>
                    <select
                      value={formEquipe}
                      onChange={(e) => setFormEquipe(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary"
                    >
                      <option value="Comercial">Comercial</option>
                      <option value="Suporte">Suporte</option>
                      <option value="Financeiro">Financeiro</option>
                      <option value="Técnico">Técnico</option>
                      <option value="Geral">Geral</option>
                    </select>
                  </div>
                </div>

                {/* Task Type & Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Tipo de Tarefa *</label>
                    <select
                      value={formTipo}
                      onChange={(e) => setFormTipo(e.target.value as TaskType)}
                      className="w-full px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary"
                    >
                      <option value="checklist">1 - Checklist</option>
                      <option value="quantidade">2 - Meta por Quantidade</option>
                      <option value="financeiro">3 - Meta Financeira</option>
                      <option value="automatica">4 - Meta Automática (CRM)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Prioridade *</label>
                    <select
                      value={formPrioridade}
                      onChange={(e) => setFormPrioridade(e.target.value as TaskPriority)}
                      className="w-full px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary"
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                    </select>
                  </div>
                </div>

                {/* Auto Trigger sub-select */}
                {formTipo === 'automatica' && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                    <label className="block text-xs font-bold text-indigo-900">Gatilho Automático do CRM *</label>
                    <select
                      value={formTipoAutomatico}
                      onChange={(e) => setFormTipoAutomatico(e.target.value as AutoTaskTrigger)}
                      className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-indigo-900"
                    >
                      <option value="criar_proposta">Enviar Propostas (Ao criar proposta)</option>
                      <option value="fechar_venda">Fechar Vendas (Ao aprovar proposta)</option>
                      <option value="abrir_chamado">Abrir Chamados (Ao abrir chamado)</option>
                      <option value="emitir_nf">Emitir Nota Fiscal (Ao gerar NF)</option>
                    </select>
                  </div>
                )}

                {/* Specific Type Inputs */}
                {formTipo === 'checklist' && (
                  <div className="space-y-2 border border-surface-container-high p-3 rounded-xl bg-surface">
                    <label className="block text-xs font-bold text-on-surface">Itens do Checklist</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formNewChecklistText}
                        onChange={(e) => setFormNewChecklistText(e.target.value)}
                        placeholder="Novo item..."
                        className="flex-1 px-3 py-1.5 bg-surface border border-surface-container-high rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddChecklistItem}
                        className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg"
                      >
                        Adicionar
                      </button>
                    </div>

                    <div className="space-y-1 mt-2">
                      {formChecklistItems.map((itemText, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-surface-container-lowest rounded-lg">
                          <span>{itemText}</span>
                          <button type="button" onClick={() => handleRemoveChecklistItem(idx)} className="text-red-500">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(formTipo === 'quantidade' || formTipo === 'automatica') && (
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Meta por Quantidade (Alvo)</label>
                    <input
                      type="number"
                      min={1}
                      value={formMetaQuantidade}
                      onChange={(e) => setFormMetaQuantidade(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}

                {formTipo === 'financeiro' && (
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Meta Financeira (R$ Alvo)</label>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={formMetaFinanceira}
                      onChange={(e) => setFormMetaFinanceira(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}

                {/* Dates & Recurrence */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Data Inicial *</label>
                    <input
                      type="date"
                      required
                      value={formDataInicial}
                      onChange={(e) => setFormDataInicial(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Data Final *</label>
                    <input
                      type="date"
                      required
                      value={formDataFinal}
                      onChange={(e) => setFormDataFinal(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Repetição</label>
                    <select
                      value={formRepeticao}
                      onChange={(e) => setFormRepeticao(e.target.value as TaskRecurrence)}
                      className="w-full px-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium"
                    >
                      <option value="Não repetir">Não repetir</option>
                      <option value="Diariamente">Diariamente</option>
                      <option value="Semanalmente">Semanalmente</option>
                      <option value="Mensalmente">Mensalmente</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-surface-container-high flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-surface-container-high text-on-surface rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20"
                  >
                    Salvar Tarefa
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: MODELOS DE TAREFA */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest border border-surface-container-high rounded-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
                <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <Layers size={18} className="text-primary" />
                  Modelos de Tarefa Pré-definidos
                </h2>
                <button onClick={() => setIsTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="p-3 bg-surface border border-surface-container-high rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-on-surface">{tpl.titulo}</h4>
                      <p className="text-[11px] text-on-surface-variant">{tpl.descricao}</p>
                      <span className="text-[10px] uppercase font-bold text-primary">{tpl.tipo}</span>
                    </div>

                    <button
                      onClick={() => {
                        setIsTemplateModalOpen(false);
                        handleOpenCreateModal(tpl);
                      }}
                      className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Usar Modelo
                    </button>
                  </div>
                ))}

                {templates.length === 0 && (
                  <p className="text-xs text-center text-slate-400 py-6">
                    Nenhum modelo cadastrado. Você pode utilizar as tarefas padrão ou criar novas.
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
