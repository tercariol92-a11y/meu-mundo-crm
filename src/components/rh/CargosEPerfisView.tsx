import React, { useState, useEffect, useMemo } from 'react';
import { 
  CargoEPerfil, 
  AvaliacaoDesempenho, 
  TreinamentoColaborador, 
  AuditLogCargo, 
  Usuario, 
  UserPermissions,
  UserType
} from '../../types';
import { cargosService, DEFAULT_PERMISSIONS_BY_CARGO } from '../../services/cargosService';
import { useGlobalData } from '../../contexts/GlobalDataContext';
import { 
  Briefcase, 
  Users, 
  ShieldCheck, 
  Award, 
  GraduationCap, 
  BarChart3, 
  GitFork, 
  History, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Star, 
  Save, 
  X, 
  UserCheck, 
  BookOpen, 
  CheckSquare, 
  Sparkles,
  ArrowDown,
  Layers,
  Building2,
  RefreshCw,
  Check,
  TrendingUp,
  Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CargosEPerfisViewProps {
  user: Usuario;
}

type SubTab = 'cargos' | 'permissoes' | 'avaliacoes' | 'treinamentos' | 'kpis' | 'organograma' | 'historico';

export default function CargosEPerfisView({ user }: CargosEPerfisViewProps) {
  const { usuarios } = useGlobalData();
  const [activeTab, setActiveTab] = useState<SubTab>('cargos');

  // Firestore Data State
  const [cargos, setCargos] = useState<CargoEPerfil[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoDesempenho[]>([]);
  const [treinamentos, setTreinamentos] = useState<TreinamentoColaborador[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogCargo[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters and UI Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('Todas');
  
  // Modals state
  const [isCargoModalOpen, setIsCargoModalOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<CargoEPerfil | null>(null);
  const [selectedCargoForDetail, setSelectedCargoForDetail] = useState<CargoEPerfil | null>(null);

  const [isAvaliacaoModalOpen, setIsAvaliacaoModalOpen] = useState(false);
  const [isVincularModalOpen, setIsVincularModalOpen] = useState(false);
  const [selectedCargoToBind, setSelectedCargoToBind] = useState<CargoEPerfil | null>(null);
  const [selectedUserToBind, setSelectedUserToBind] = useState<string>('');

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State for Cargo
  const [cargoForm, setCargoForm] = useState<Partial<CargoEPerfil>>({
    nome: '',
    area: 'Comercial',
    cbo: '',
    superiorImediatoNome: 'Gerente',
    subordinadosNomes: [],
    formacaoExigida: 'Ensino Superior Completo',
    experienciaMinima: '2 anos de experiência',
    conhecimentosObrigatorios: [],
    competencias: [],
    responsabilidades: [],
    metasCargo: [],
    sla: 'Atendimento em até 2 horas',
    kpis: [],
    checklistDiario: [],
    checklistSemanal: [],
    checklistMensal: [],
    permissoes: DEFAULT_PERMISSIONS_BY_CARGO['Vendedor'],
    treinamentos: []
  });

  // Dynamic inputs helpers for Form
  const [tempConhecimento, setTempConhecimento] = useState('');
  const [tempResponsabilidade, setTempResponsabilidade] = useState('');
  const [tempMeta, setTempMeta] = useState('');
  const [tempChecklistDiario, setTempChecklistDiario] = useState('');
  const [tempCompetencia, setTempCompetencia] = useState({ nome: '', descricao: '', peso: 5 });
  const [tempKpi, setTempKpi] = useState({ nome: '', meta: '', unidade: '', frequencia: 'Mensal' as const });
  const [tempTreinamento, setTempTreinamento] = useState({ nome: '', cargaHoraria: '10h' });

  // Form State for Avaliação de Desempenho
  const [avaliacaoForm, setAvaliacaoForm] = useState({
    funcionarioId: '',
    mesAno: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    comprometimento: 8,
    comunicacao: 8,
    pontualidade: 9,
    organizacao: 8,
    conhecimentoTecnico: 8,
    relacionamento: 9,
    produtividade: 8,
    observacoesAvaliador: '',
    pontosFortes: '',
    pontosMelhoria: '',
    planoAcao: ''
  });

  // Subscribe to real-time Firestore data
  useEffect(() => {
    setLoading(true);
    const unsubC = cargosService.subscribeCargos((data) => {
      setCargos(data);
      setLoading(false);
    });
    const unsubA = cargosService.subscribeAvaliacoes(setAvaliacoes);
    const unsubT = cargosService.subscribeTreinamentosColaborador(setTreinamentos);
    const unsubL = cargosService.subscribeAuditLogs(setAuditLogs);

    return () => {
      unsubC();
      unsubA();
      unsubT();
      unsubL();
    };
  }, []);

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Filtered Cargos
  const filteredCargos = useMemo(() => {
    return cargos.filter(c => {
      const matchSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.area.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.cbo && c.cbo.includes(searchTerm));
      const matchArea = selectedArea === 'Todas' || c.area === selectedArea;
      return matchSearch && matchArea;
    });
  }, [cargos, searchTerm, selectedArea]);

  const areasList = useMemo(() => {
    const set = new Set(cargos.map(c => c.area));
    return ['Todas', ...Array.from(set)];
  }, [cargos]);

  // Handle Cargo Modal Open
  const handleOpenCargoModal = (cargo?: CargoEPerfil) => {
    if (cargo) {
      setEditingCargo(cargo);
      setCargoForm({ ...cargo });
    } else {
      setEditingCargo(null);
      setCargoForm({
        nome: '',
        area: 'Comercial',
        cbo: '',
        superiorImediatoNome: 'Gerente',
        subordinadosNomes: [],
        formacaoExigida: 'Ensino Superior Completo',
        experienciaMinima: '2 anos na função',
        conhecimentosObrigatorios: ['Sistemas de CRM', 'Atendimento ao cliente'],
        competencias: [
          { id: '1', nome: 'Comunicação', descricao: 'Comunicação clara e empática', peso: 5 },
          { id: '2', nome: 'Organização', descricao: 'Gestão do tempo e prioridades', peso: 4 }
        ],
        responsabilidades: ['Executar as rotinas padrão do cargo'],
        metasCargo: ['Atingir 100% das metas do setor'],
        sla: 'Atendimento no mesmo dia',
        kpis: [
          { id: 'k1', nome: 'Produtividade Diária', meta: '100%', unidade: '%', frequencia: 'Diário' }
        ],
        checklistDiario: ['Verificar e-mails e chamados pendentes'],
        checklistSemanal: ['Reunião de alinhamento'],
        checklistMensal: ['Relatório mensal de entregas'],
        permissoes: DEFAULT_PERMISSIONS_BY_CARGO['Vendedor'],
        treinamentos: [
          { id: 't1', nome: 'Treinamento Institucional e Integração', cargaHoraria: '8h', obrigatorio: true }
        ]
      });
    }
    setIsCargoModalOpen(true);
  };

  // Save Cargo
  const handleSaveCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargoForm.nome) {
      showNotify('error', 'Preencha o nome do cargo.');
      return;
    }

    try {
      await cargosService.saveCargo(cargoForm, user.nome);
      showNotify('success', editingCargo ? 'Cargo atualizado com sucesso!' : 'Cargo cadastrado com sucesso!');
      setIsCargoModalOpen(false);
    } catch (err) {
      console.error(err);
      showNotify('error', 'Erro ao salvar o cargo.');
    }
  };

  // Delete Cargo
  const handleDeleteCargo = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o cargo "${nome}"?`)) return;
    try {
      await cargosService.deleteCargo(id, nome, user.nome);
      showNotify('success', 'Cargo excluído com sucesso.');
    } catch (e) {
      showNotify('error', 'Erro ao excluir o cargo.');
    }
  };

  // Handle Vinculação de Cargo ao Usuário
  const handleVincularCargoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCargoToBind || !selectedUserToBind) {
      showNotify('error', 'Selecione o cargo e o colaborador.');
      return;
    }

    const targetUser = usuarios?.find(u => u.id === selectedUserToBind);
    if (!targetUser) return;

    try {
      await cargosService.vincularCargoAUsuario(
        selectedUserToBind, 
        selectedCargoToBind, 
        targetUser.nome, 
        user.nome
      );
      showNotify('success', `Cargo "${selectedCargoToBind.nome}" vinculado a ${targetUser.nome} com sucesso!`);
      setIsVincularModalOpen(false);
    } catch (e) {
      console.error(e);
      showNotify('error', 'Erro ao vincular cargo.');
    }
  };

  // Handle Save Avaliação de Desempenho
  const handleSaveAvaliacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!avaliacaoForm.funcionarioId) {
      showNotify('error', 'Selecione o colaborador.');
      return;
    }

    const targetUser = usuarios?.find(u => u.id === avaliacaoForm.funcionarioId);
    if (!targetUser) return;

    const cargoDoUser = cargos.find(c => c.id === targetUser.cargoId) || cargos[0];

    // Calculate Average Grade (1-10)
    const grades = [
      avaliacaoForm.comprometimento,
      avaliacaoForm.comunicacao,
      avaliacaoForm.pontualidade,
      avaliacaoForm.organizacao,
      avaliacaoForm.conhecimentoTecnico,
      avaliacaoForm.relacionamento,
      avaliacaoForm.produtividade
    ];
    const avg = grades.reduce((a, b) => a + b, 0) / grades.length;

    try {
      await cargosService.saveAvaliacao({
        funcionarioId: targetUser.id,
        funcionarioNome: targetUser.nome,
        cargoId: cargoDoUser.id,
        cargoNome: cargoDoUser.nome,
        avaliadorId: user.id,
        avaliadorNome: user.nome,
        mesAno: avaliacaoForm.mesAno,
        dataAvaliacao: new Date().toISOString(),
        comprometimento: avaliacaoForm.comprometimento,
        comunicacao: avaliacaoForm.comunicacao,
        pontualidade: avaliacaoForm.pontualidade,
        organizacao: avaliacaoForm.organizacao,
        conhecimentoTecnico: avaliacaoForm.conhecimentoTecnico,
        relacionamento: avaliacaoForm.relacionamento,
        produtividade: avaliacaoForm.produtividade,
        notaFinalMedia: avg,
        observacoesAvaliador: avaliacaoForm.observacoesAvaliador,
        pontosFortes: avaliacaoForm.pontosFortes,
        pontosMelhoria: avaliacaoForm.pontosMelhoria,
        planoAcao: avaliacaoForm.planoAcao
      });

      showNotify('success', `Avaliação cadastrada para ${targetUser.nome} com média ${avg.toFixed(1)}/10!`);
      setIsAvaliacaoModalOpen(false);
    } catch (e) {
      console.error(e);
      showNotify('error', 'Erro ao salvar avaliação.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-white font-bold text-xs ${
              notification.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-surface-container-low p-6 rounded-[2.5rem] border border-surface-container-high shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-primary text-white rounded-2xl shadow-sm">
              <Briefcase size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  Gestão de Pessoas & RH
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-on-surface uppercase mt-1">
                Cargos, Perfis & Competências
              </h1>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Estruturação de cargos, controle automático de permissões, checklists, metas e avaliações de desempenho
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsVincularModalOpen(true)}
              className="px-4 py-2.5 bg-surface border border-surface-container-high hover:border-primary/50 text-on-surface rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-2xs"
            >
              <UserCheck size={16} className="text-primary" />
              <span>Vincular Cargo a Colaborador</span>
            </button>
            <button
              onClick={() => handleOpenCargoModal()}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              <Plus size={18} />
              <span>Novo Cargo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex items-center gap-1 bg-surface-container-low p-1.5 rounded-2xl border border-surface-container-high overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('cargos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'cargos' 
              ? 'bg-primary text-white shadow-xs' 
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <Briefcase size={16} />
          <span>Cadastro de Cargos ({cargos.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('permissoes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'permissoes' 
              ? 'bg-primary text-white shadow-xs' 
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <ShieldCheck size={16} />
          <span>Matriz de Permissões</span>
        </button>

        <button
          onClick={() => setActiveTab('avaliacoes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'avaliacoes' 
              ? 'bg-primary text-white shadow-xs' 
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <Award size={16} />
          <span>Avaliação de Desempenho ({avaliacoes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('treinamentos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'treinamentos' 
              ? 'bg-primary text-white shadow-xs' 
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <GraduationCap size={16} />
          <span>Treinamentos</span>
        </button>

        <button
          onClick={() => setActiveTab('kpis')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'kpis' 
              ? 'bg-primary text-white shadow-xs' 
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <BarChart3 size={16} />
          <span>Indicadores & KPIs</span>
        </button>

        <button
          onClick={() => setActiveTab('organograma')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'organograma' 
              ? 'bg-primary text-white shadow-xs' 
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <GitFork size={16} />
          <span>Organograma</span>
        </button>

        <button
          onClick={() => setActiveTab('historico')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
            activeTab === 'historico' 
              ? 'bg-primary text-white shadow-xs' 
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <History size={16} />
          <span>Histórico & Logs</span>
        </button>
      </div>

      {/* TAB 1: CADASTRO DE CARGOS */}
      {activeTab === 'cargos' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-low p-4 rounded-2xl border border-surface-container-high">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar cargo por nome, área ou CBO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface rounded-xl border border-surface-container-high text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold uppercase text-slate-500 whitespace-nowrap">Área:</span>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="px-3 py-2 bg-surface rounded-xl border border-surface-container-high text-xs font-bold text-on-surface focus:outline-none"
              >
                {areasList.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCargos.map((cargo) => {
              const countColaboradores = usuarios?.filter(u => u.cargoId === cargo.id || u.cargoNome === cargo.nome).length || 0;

              return (
                <div 
                  key={cargo.id}
                  className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high hover:border-primary/40 transition-all shadow-xs flex flex-col justify-between group space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                          {cargo.area}
                        </span>
                        <h3 className="text-base font-black uppercase text-on-surface tracking-tight mt-1">
                          {cargo.nome}
                        </h3>
                        {cargo.cbo && (
                          <p className="text-[11px] font-medium text-slate-400">CBO: {cargo.cbo}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenCargoModal(cargo)}
                          className="p-1.5 hover:bg-primary/10 text-slate-500 hover:text-primary rounded-lg transition-colors"
                          title="Editar Cargo"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCargo(cargo.id, cargo.nome)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Excluir Cargo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Hierarchy Info */}
                    <div className="p-3 bg-surface rounded-2xl border border-surface-container-high text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Superior Imediato:</span>
                        <span className="font-bold text-on-surface">{cargo.superiorImediatoNome || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Colaboradores no Cargo:</span>
                        <span className="font-extrabold text-primary bg-primary/10 px-2 py-0.2 rounded-full text-[10px]">
                          {countColaboradores} ativos
                        </span>
                      </div>
                    </div>

                    {/* Qualifications & SLA */}
                    <div className="space-y-1.5 text-xs">
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        <strong className="text-slate-700">Formação:</strong> {cargo.formacaoExigida}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        <strong className="text-slate-700">Experiência:</strong> {cargo.experienciaMinima}
                      </p>
                    </div>

                    {/* Badges / Competencies Preview */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {cargo.competencias?.slice(0, 3).map((comp, idx) => (
                        <span key={idx} className="text-[10px] font-bold bg-surface border border-slate-200 text-slate-600 px-2 py-0.5 rounded-lg">
                          {comp.nome}
                        </span>
                      ))}
                      {cargo.competencias?.length > 3 && (
                        <span className="text-[10px] font-bold text-slate-400 px-1 py-0.5">
                          +{cargo.competencias.length - 3} mais
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-surface-container-high flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedCargoForDetail(cargo)}
                      className="w-full py-2 bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <FileText size={14} />
                      <span>Descrição Completa (JD)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MATRIZ DE PERMISSÕES POR CARGO */}
      {activeTab === 'permissoes' && (
        <div className="bg-surface-container-low p-6 rounded-[2.5rem] border border-surface-container-high space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-surface-container-high">
            <div>
              <h2 className="text-lg font-black uppercase text-on-surface">Matriz de Permissões por Cargo</h2>
              <p className="text-xs text-on-surface-variant font-medium">
                Configuração centralizada. Ao associar um colaborador ao cargo, ele herdará este perfil de acesso.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-surface-container-high bg-surface text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="p-3">Módulo / Permissão</th>
                  {cargos.map(cargo => (
                    <th key={cargo.id} className="p-3 text-center min-w-[120px]">
                      <div className="font-extrabold text-on-surface">{cargo.nome}</div>
                      <div className="text-[9px] text-slate-400 font-medium">{cargo.area}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high font-medium text-slate-700">
                {/* Visualização de Módulos */}
                <tr className="bg-primary/5 font-bold text-primary uppercase text-[10px] tracking-wider">
                  <td colSpan={cargos.length + 1} className="p-2.5">Acesso a Módulos e Visões</td>
                </tr>
                {[
                  { key: 'viewDashboard', label: 'Dashboard Geral' },
                  { key: 'viewComercial', label: 'Módulo Comercial & CRM' },
                  { key: 'viewAtendimento', label: 'Módulo de Atendimento' },
                  { key: 'viewAssistenciaTecnica', label: 'Assistência Técnica' },
                  { key: 'viewFinanceiro', label: 'Financeiro (Contas / Faturamento)' },
                  { key: 'viewLucro', label: 'Visualizar Margens de Lucro' },
                  { key: 'viewComissao', label: 'Visualizar Comissões' },
                  { key: 'viewGestaoTarefas', label: 'Gestão de Tarefas' },
                  { key: 'viewCadastro', label: 'Cadastros Gerais' },
                  { key: 'viewBling', label: 'Integração Bling' },
                ].map(item => (
                  <tr key={item.key} className="hover:bg-surface/50 transition-colors">
                    <td className="p-3 font-semibold text-on-surface">{item.label}</td>
                    {cargos.map(cargo => {
                      const hasPerm = !!cargo.permissoes?.[item.key as keyof UserPermissions];
                      return (
                        <td key={cargo.id} className="p-3 text-center">
                          <button
                            onClick={async () => {
                              const updatedPerms = {
                                ...cargo.permissoes,
                                [item.key]: !hasPerm
                              };
                              await cargosService.saveCargo({ ...cargo, permissoes: updatedPerms }, user.nome);
                              showNotify('success', `Permissão ${item.label} atualizada para ${cargo.nome}`);
                            }}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                              hasPerm 
                                ? 'bg-emerald-100 text-emerald-700 font-black' 
                                : 'bg-slate-100 text-slate-300'
                            }`}
                          >
                            {hasPerm ? <Check size={16} /> : <X size={14} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Ações Avançadas */}
                <tr className="bg-primary/5 font-bold text-primary uppercase text-[10px] tracking-wider">
                  <td colSpan={cargos.length + 1} className="p-2.5">Ações & Edição</td>
                </tr>
                {[
                  { key: 'createOrcamento', label: 'Criar Propostas / Orçamentos' },
                  { key: 'editOrcamento', label: 'Editar Propostas' },
                  { key: 'deleteOrcamento', label: 'Excluir Propostas' },
                  { key: 'alterarVendedor', label: 'Alterar Vendedor da Proposta' },
                  { key: 'editComissao', label: 'Editar Regras de Comissão' },
                  { key: 'exportRelatorios', label: 'Exportar Relatórios Executivos' },
                ].map(item => (
                  <tr key={item.key} className="hover:bg-surface/50 transition-colors">
                    <td className="p-3 font-semibold text-on-surface">{item.label}</td>
                    {cargos.map(cargo => {
                      const hasPerm = !!cargo.permissoes?.[item.key as keyof UserPermissions];
                      return (
                        <td key={cargo.id} className="p-3 text-center">
                          <button
                            onClick={async () => {
                              const updatedPerms = {
                                ...cargo.permissoes,
                                [item.key]: !hasPerm
                              };
                              await cargosService.saveCargo({ ...cargo, permissoes: updatedPerms }, user.nome);
                              showNotify('success', `Permissão ${item.label} atualizada para ${cargo.nome}`);
                            }}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                              hasPerm 
                                ? 'bg-emerald-100 text-emerald-700 font-black' 
                                : 'bg-slate-100 text-slate-300'
                            }`}
                          >
                            {hasPerm ? <Check size={16} /> : <X size={14} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AVALIAÇÃO DE DESEMPENHO */}
      {activeTab === 'avaliacoes' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-container-low p-6 rounded-[2.5rem] border border-surface-container-high">
            <div>
              <h2 className="text-lg font-black uppercase text-on-surface">Avaliações Mensais de Desempenho</h2>
              <p className="text-xs text-on-surface-variant font-medium">
                Avalie os colaboradores mensalmente com base nas 7 competências centrais e critérios do cargo
              </p>
            </div>

            <button
              onClick={() => setIsAvaliacaoModalOpen(true)}
              className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
            >
              <Plus size={16} />
              <span>Nova Avaliação de Desempenho</span>
            </button>
          </div>

          {/* List of Avaliações */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {avaliacoes.map((aval) => (
              <div key={aval.id} className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high space-y-4 shadow-xs">
                <div className="flex items-start justify-between gap-2 border-b border-surface-container-high pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Mês: {aval.mesAno}
                    </span>
                    <h3 className="text-sm font-black uppercase text-on-surface mt-1">{aval.funcionarioNome}</h3>
                    <p className="text-[11px] text-slate-400 font-medium">{aval.cargoNome}</p>
                  </div>

                  <div className="text-right">
                    <div className={`text-xl font-black ${
                      aval.notaFinalMedia >= 8 ? 'text-emerald-600' : aval.notaFinalMedia >= 6 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {aval.notaFinalMedia.toFixed(1)}
                      <span className="text-xs font-normal text-slate-400">/10</span>
                    </div>
                    <span className="text-[9px] uppercase font-bold text-slate-400">Média Geral</span>
                  </div>
                </div>

                {/* Criterion Grades Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between p-2 bg-surface rounded-xl">
                    <span className="text-slate-500">Comprometimento:</span>
                    <strong className="text-primary">{aval.comprometimento}/10</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-surface rounded-xl">
                    <span className="text-slate-500">Comunicação:</span>
                    <strong className="text-primary">{aval.comunicacao}/10</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-surface rounded-xl">
                    <span className="text-slate-500">Pontualidade:</span>
                    <strong className="text-primary">{aval.pontualidade}/10</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-surface rounded-xl">
                    <span className="text-slate-500">Organização:</span>
                    <strong className="text-primary">{aval.organizacao}/10</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-surface rounded-xl">
                    <span className="text-slate-500">Conh. Técnico:</span>
                    <strong className="text-primary">{aval.conhecimentoTecnico}/10</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-surface rounded-xl">
                    <span className="text-slate-500">Produtividade:</span>
                    <strong className="text-primary">{aval.produtividade}/10</strong>
                  </div>
                </div>

                {aval.observacoesAvaliador && (
                  <div className="p-3 bg-surface rounded-xl border border-surface-container-high text-xs text-slate-600 italic">
                    "{aval.observacoesAvaliador}"
                  </div>
                )}

                <div className="text-[10px] text-slate-400 flex justify-between pt-1">
                  <span>Avaliador: {aval.avaliadorNome}</span>
                  <span>{new Date(aval.dataAvaliacao).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            ))}

            {avaliacoes.length === 0 && (
              <div className="col-span-full text-center py-12 bg-surface-container-low rounded-3xl border border-surface-container-high text-slate-400">
                <Award size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold uppercase tracking-wider">Nenhuma avaliação realizada ainda</p>
                <p className="text-[11px] mt-1">Clique em "Nova Avaliação de Desempenho" para lançar a primeira avaliação mensal do colaborador.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TREINAMENTOS POR CARGO */}
      {activeTab === 'treinamentos' && (
        <div className="bg-surface-container-low p-6 rounded-[2.5rem] border border-surface-container-high space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-surface-container-high">
            <div>
              <h2 className="text-lg font-black uppercase text-on-surface">Treinamentos Obrigatórios por Colaborador</h2>
              <p className="text-xs text-on-surface-variant font-medium">
                Controle do status de conclusão das capacitações exigidas pelo cargo
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {usuarios?.filter(u => u.ativo !== false).map((emp) => {
              const empTreinamentos = treinamentos.filter(t => t.funcionarioId === emp.id);
              const empCargo = cargos.find(c => c.id === emp.cargoId || c.nome === emp.cargoNome);

              return (
                <div key={emp.id} className="bg-surface p-5 rounded-2xl border border-surface-container-high space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      {emp.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-on-surface">{emp.nome}</h4>
                      <p className="text-[10px] uppercase text-slate-400 font-semibold">{emp.cargoNome || 'Sem Cargo Vinculado'}</p>
                    </div>
                  </div>

                  {/* List of Required Trainings for this Cargo */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {empCargo?.treinamentos && empCargo.treinamentos.length > 0 ? (
                      empCargo.treinamentos.map((t) => {
                        const record = empTreinamentos.find(item => item.treinamentoId === t.id);
                        const status = record?.status || 'Pendente';

                        return (
                          <div key={t.id} className="p-2.5 bg-surface-container-low rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-[11px] text-on-surface">{t.nome}</p>
                              <p className="text-[9px] text-slate-400">Carga: {t.cargaHoraria || '10h'}</p>
                            </div>

                            <select
                              value={status}
                              onChange={async (e) => {
                                const newStatus = e.target.value as 'Pendente' | 'Em andamento' | 'Concluído';
                                const recordId = record?.id || `tr-${emp.id}-${t.id}`;
                                await cargosService.updateTreinamentoColaborador(recordId, {
                                  funcionarioId: emp.id,
                                  funcionarioNome: emp.nome,
                                  cargoId: empCargo.id,
                                  treinamentoId: t.id,
                                  treinamentoNome: t.nome,
                                  status: newStatus
                                });
                                showNotify('success', `Status do treinamento "${t.nome}" atualizado para ${newStatus}`);
                              }}
                              className={`text-[10px] font-bold rounded-lg px-2 py-1 border focus:outline-none ${
                                status === 'Concluído' 
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                  : status === 'Em andamento' 
                                  ? 'bg-amber-100 text-amber-800 border-amber-300' 
                                  : 'bg-slate-100 text-slate-600 border-slate-300'
                              }`}
                            >
                              <option value="Pendente">Pendente</option>
                              <option value="Em andamento">Em andamento</option>
                              <option value="Concluído">Concluído</option>
                            </select>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Nenhum treinamento cadastrado no cargo.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: INDICADORES E KPIS POR CARGO */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cargos.map((cargo) => (
              <div key={cargo.id} className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high space-y-4">
                <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">{cargo.area}</span>
                    <h3 className="text-base font-black uppercase text-on-surface mt-1">{cargo.nome}</h3>
                  </div>
                  <BarChart3 className="text-primary opacity-60" size={24} />
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase text-slate-500">Indicadores de Desempenho (KPIs):</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cargo.kpis?.map((kpi, idx) => (
                      <div key={idx} className="p-3 bg-surface rounded-2xl border border-surface-container-high space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">{kpi.frequencia || 'Mensal'}</span>
                        <h5 className="font-bold text-xs text-on-surface">{kpi.nome}</h5>
                        <p className="text-sm font-black text-primary">Meta: {kpi.meta} <span className="text-[10px] text-slate-400 font-normal">{kpi.unidade}</span></p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metas do cargo */}
                <div className="pt-2 border-t border-surface-container-high">
                  <h4 className="text-xs font-extrabold uppercase text-slate-500 mb-1">Metas Globais do Cargo:</h4>
                  <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                    {cargo.metasCargo?.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: ORGANOGRAMA DA EMPRESA */}
      {activeTab === 'organograma' && (
        <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-surface-container-high space-y-8 overflow-x-auto">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-xl font-black uppercase tracking-tight text-on-surface">Organograma e Hierarquia Empresarial</h2>
            <p className="text-xs text-on-surface-variant font-medium">
              Estrutura organizacional das posições da empresa, da alta direção aos níveis operacionais.
            </p>
          </div>

          <div className="flex flex-col items-center gap-6 min-w-[700px]">
            {/* Level 1: Sócio Diretor */}
            {cargos.filter(c => c.area === 'Diretoria' || c.nome.includes('Diretor')).map(c => (
              <div key={c.id} className="p-5 bg-primary text-white rounded-2xl shadow-md text-center w-64 space-y-1 border-2 border-primary">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-80 bg-white/20 px-2 py-0.5 rounded-full">Diretoria Executiva</span>
                <h4 className="font-black text-sm uppercase">{c.nome}</h4>
                <p className="text-[10px] text-white/80">{usuarios?.filter(u => u.cargoId === c.id || u.cargoNome === c.nome).length || 0} Colaboradores</p>
              </div>
            ))}

            <ArrowDown size={24} className="text-primary animate-bounce" />

            {/* Level 2: Gerência */}
            {cargos.filter(c => c.nome.includes('Gerente')).map(c => (
              <div key={c.id} className="p-5 bg-surface border-2 border-primary text-on-surface rounded-2xl shadow-sm text-center w-64 space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">Gestão Geral</span>
                <h4 className="font-black text-sm uppercase text-primary">{c.nome}</h4>
                <p className="text-[10px] text-slate-500 font-bold">{usuarios?.filter(u => u.cargoId === c.id || u.cargoNome === c.nome).length || 0} Colaboradores</p>
              </div>
            ))}

            <ArrowDown size={24} className="text-primary" />

            {/* Level 3: Operacional (Comercial, Suporte, Administrativo) */}
            <div className="grid grid-cols-4 gap-4 w-full">
              {cargos.filter(c => !c.nome.includes('Gerente') && !c.nome.includes('Diretor')).map(c => (
                <div key={c.id} className="p-4 bg-surface rounded-2xl border border-surface-container-high text-center space-y-1 shadow-2xs">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{c.area}</span>
                  <h5 className="font-bold text-xs text-on-surface">{c.nome}</h5>
                  <p className="text-[10px] text-primary font-extrabold">{usuarios?.filter(u => u.cargoId === c.id || u.cargoNome === c.nome).length || 0} Ativos</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: HISTÓRICO & AUDITORIA */}
      {activeTab === 'historico' && (
        <div className="bg-surface-container-low p-6 rounded-[2.5rem] border border-surface-container-high space-y-4">
          <div className="pb-3 border-b border-surface-container-high">
            <h2 className="text-lg font-black uppercase text-on-surface">Histórico de Alterações & Auditoria</h2>
            <p className="text-xs text-on-surface-variant font-medium">
              Registro completo de quem alterou, quando alterou, em qual cargo e qual alteração foi feita.
            </p>
          </div>

          <div className="space-y-3">
            {auditLogs.map(log => (
              <div key={log.id} className="p-4 bg-surface rounded-2xl border border-surface-container-high flex items-start gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0 mt-0.5">
                  <History size={18} />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-on-surface uppercase">{log.usuarioNome}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{new Date(log.dataHora).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">{log.detalhes}</p>
                </div>
              </div>
            ))}

            {auditLogs.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">Nenhum log de alteração registrado.</p>
            )}
          </div>
        </div>
      )}

      {/* MODAL: VISUALIZAR DESCRIÇÃO COMPLETA DO CARGO (JD) */}
      <AnimatePresence>
        {selectedCargoForDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-surface-container-high rounded-[2.5rem] p-6 md:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl"
            >
              <div className="flex items-start justify-between pb-4 border-b border-surface-container-high">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
                    {selectedCargoForDetail.area}
                  </span>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-on-surface mt-1">
                    {selectedCargoForDetail.nome}
                  </h2>
                  {selectedCargoForDetail.cbo && (
                    <p className="text-xs text-slate-400 font-medium">CBO: {selectedCargoForDetail.cbo}</p>
                  )}
                </div>

                <button
                  onClick={() => setSelectedCargoForDetail(null)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Hierarchy & Prerequisites */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-surface-container-low rounded-2xl space-y-2 border border-surface-container-high">
                  <h4 className="text-xs font-black uppercase text-primary">Estrutura Hierárquica</h4>
                  <p className="text-xs text-slate-600"><strong>Superior Imediato:</strong> {selectedCargoForDetail.superiorImediatoNome || 'N/A'}</p>
                  <p className="text-xs text-slate-600"><strong>Subordinados:</strong> {selectedCargoForDetail.subordinadosNomes?.join(', ') || 'Nenhum'}</p>
                </div>

                <div className="p-4 bg-surface-container-low rounded-2xl space-y-2 border border-surface-container-high">
                  <h4 className="text-xs font-black uppercase text-primary">Requisitos Mínimos</h4>
                  <p className="text-xs text-slate-600"><strong>Formação:</strong> {selectedCargoForDetail.formacaoExigida}</p>
                  <p className="text-xs text-slate-600"><strong>Experiência:</strong> {selectedCargoForDetail.experienciaMinima}</p>
                </div>
              </div>

              {/* Responsibilities */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-700">Matriz de Responsabilidades:</h4>
                <ul className="list-disc list-inside text-xs text-slate-600 space-y-1 bg-surface-container-low p-4 rounded-2xl border border-surface-container-high">
                  {selectedCargoForDetail.responsabilidades?.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              {/* Competencies */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-700">Competências Obrigatórias:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selectedCargoForDetail.competencias?.map((comp, i) => (
                    <div key={i} className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high flex items-center justify-between">
                      <div>
                        <p className="font-bold text-xs text-on-surface">{comp.nome}</p>
                        {comp.descricao && <p className="text-[10px] text-slate-400">{comp.descricao}</p>}
                      </div>
                      <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Peso {comp.peso || 5}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily / Weekly Checklists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high space-y-2">
                  <h4 className="text-xs font-black uppercase text-slate-700">Checklist Diário Padrão:</h4>
                  <ul className="space-y-1">
                    {selectedCargoForDetail.checklistDiario?.map((item, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high space-y-2">
                  <h4 className="text-xs font-black uppercase text-slate-700">KPIs e Metas:</h4>
                  <ul className="space-y-1">
                    {selectedCargoForDetail.kpis?.map((kpi, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-center justify-between">
                        <span>{kpi.nome}:</span>
                        <strong className="text-primary">{kpi.meta} ({kpi.unidade})</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-surface-container-high flex justify-end">
                <button
                  onClick={() => setSelectedCargoForDetail(null)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CRIAR / EDITAR CARGO */}
      <AnimatePresence>
        {isCargoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-surface-container-high rounded-[2.5rem] p-6 md:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-on-surface">
                    {editingCargo ? 'Editar Descrição do Cargo' : 'Cadastrar Novo Cargo'}
                  </h2>
                  <p className="text-xs text-slate-400">Preencha todos os campos da ficha descritiva do cargo</p>
                </div>
                <button onClick={() => setIsCargoModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveCargo} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Nome do Cargo *</label>
                    <input
                      type="text"
                      required
                      value={cargoForm.nome}
                      onChange={(e) => setCargoForm({ ...cargoForm, nome: e.target.value })}
                      placeholder="Ex: Gerente Comercial"
                      className="w-full px-3 py-2 bg-surface rounded-xl border border-surface-container-high text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Área / Setor *</label>
                    <select
                      value={cargoForm.area}
                      onChange={(e) => setCargoForm({ ...cargoForm, area: e.target.value })}
                      className="w-full px-3 py-2 bg-surface rounded-xl border border-surface-container-high text-xs font-bold focus:outline-none"
                    >
                      <option value="Comercial">Comercial</option>
                      <option value="Suporte">Suporte</option>
                      <option value="Administrativo">Administrativo</option>
                      <option value="Diretoria">Diretoria</option>
                      <option value="Financeiro">Financeiro</option>
                      <option value="Técnico">Técnico</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">CBO (Código)</label>
                    <input
                      type="text"
                      value={cargoForm.cbo}
                      onChange={(e) => setCargoForm({ ...cargoForm, cbo: e.target.value })}
                      placeholder="Ex: 3541-20"
                      className="w-full px-3 py-2 bg-surface rounded-xl border border-surface-container-high text-xs font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                {/* Hierarchy & Requisitos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-surface-container-low rounded-2xl border border-surface-container-high">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Superior Imediato</label>
                    <input
                      type="text"
                      value={cargoForm.superiorImediatoNome}
                      onChange={(e) => setCargoForm({ ...cargoForm, superiorImediatoNome: e.target.value })}
                      placeholder="Ex: Gerente Comercial"
                      className="w-full px-3 py-2 bg-surface rounded-xl border border-surface-container-high text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Formação Exigida</label>
                    <input
                      type="text"
                      value={cargoForm.formacaoExigida}
                      onChange={(e) => setCargoForm({ ...cargoForm, formacaoExigida: e.target.value })}
                      placeholder="Ex: Superior em Administração"
                      className="w-full px-3 py-2 bg-surface rounded-xl border border-surface-container-high text-xs font-semibold"
                    />
                  </div>

                  <div className="col-span-full">
                    <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Experiência Mínima Exigida</label>
                    <input
                      type="text"
                      value={cargoForm.experienciaMinima}
                      onChange={(e) => setCargoForm({ ...cargoForm, experienciaMinima: e.target.value })}
                      placeholder="Ex: 2 anos em vendas B2B de tecnologia"
                      className="w-full px-3 py-2 bg-surface rounded-xl border border-surface-container-high text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Responsabilidades List Editor */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-700 block">Matriz de Responsabilidades do Cargo</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tempResponsabilidade}
                      onChange={(e) => setTempResponsabilidade(e.target.value)}
                      placeholder="Digite uma nova responsabilidade..."
                      className="flex-1 px-3 py-2 bg-surface rounded-xl border border-surface-container-high text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!tempResponsabilidade) return;
                        setCargoForm({
                          ...cargoForm,
                          responsabilidades: [...(cargoForm.responsabilidades || []), tempResponsabilidade]
                        });
                        setTempResponsabilidade('');
                      }}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold"
                    >
                      Adicionar
                    </button>
                  </div>

                  <ul className="space-y-1 pt-1">
                    {cargoForm.responsabilidades?.map((resp, i) => (
                      <li key={i} className="flex items-center justify-between p-2 bg-surface rounded-xl text-xs text-slate-700">
                        <span>• {resp}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCargoForm({
                              ...cargoForm,
                              responsabilidades: cargoForm.responsabilidades?.filter((_, idx) => idx !== i)
                            });
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Checklist Diário Editor */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-700 block">Checklist Diário Automático (Tarefas do Dia)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tempChecklistDiario}
                      onChange={(e) => setTempChecklistDiario(e.target.value)}
                      placeholder="Ex: Fazer 30 ligações de prospecção..."
                      className="flex-1 px-3 py-2 bg-surface rounded-xl border border-surface-container-high text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!tempChecklistDiario) return;
                        setCargoForm({
                          ...cargoForm,
                          checklistDiario: [...(cargoForm.checklistDiario || []), tempChecklistDiario]
                        });
                        setTempChecklistDiario('');
                      }}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold"
                    >
                      Adicionar
                    </button>
                  </div>

                  <ul className="space-y-1 pt-1">
                    {cargoForm.checklistDiario?.map((item, i) => (
                      <li key={i} className="flex items-center justify-between p-2 bg-surface rounded-xl text-xs text-slate-700">
                        <span>✓ {item}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCargoForm({
                              ...cargoForm,
                              checklistDiario: cargoForm.checklistDiario?.filter((_, idx) => idx !== i)
                            });
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Footer buttons */}
                <div className="pt-4 border-t border-surface-container-high flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCargoModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    Salvar Cargo
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: VINCULAR CARGO A COLABORADOR */}
      <AnimatePresence>
        {isVincularModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-surface-container-high rounded-[2.5rem] p-6 md:p-8 max-w-md w-full space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                <h3 className="text-lg font-black uppercase text-on-surface">Vincular Cargo a Colaborador</h3>
                <button onClick={() => setIsVincularModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleVincularCargoSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Selecione o Colaborador *</label>
                  <select
                    required
                    value={selectedUserToBind}
                    onChange={(e) => setSelectedUserToBind(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface rounded-xl border border-surface-container-high text-xs font-bold"
                  >
                    <option value="">Selecione...</option>
                    {usuarios?.filter(u => u.ativo !== false).map(u => (
                      <option key={u.id} value={u.id}>{u.nome} ({u.cargoNome || 'Sem Cargo'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Selecione o Cargo Desejado *</label>
                  <select
                    required
                    value={selectedCargoToBind?.id || ''}
                    onChange={(e) => {
                      const c = cargos.find(item => item.id === e.target.value);
                      setSelectedCargoToBind(c || null);
                    }}
                    className="w-full px-3 py-2.5 bg-surface rounded-xl border border-surface-container-high text-xs font-bold"
                  >
                    <option value="">Selecione...</option>
                    {cargos.map(c => (
                      <option key={c.id} value={c.id}>{c.nome} ({c.area})</option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-primary/5 rounded-2xl border border-primary/20 text-[11px] text-slate-600 space-y-1">
                  <p className="font-bold text-primary">Ao vincular, o colaborador herdará automaticamente:</p>
                  <p>✓ Permissões de acesso aos módulos</p>
                  <p>✓ Tarefas e checklists diários padrão do cargo</p>
                  <p>✓ Cadastro de treinamentos obrigatórios</p>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsVincularModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Confirmar Vinculação
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: NOVA AVALIAÇÃO DE DESEMPENHO */}
      <AnimatePresence>
        {isAvaliacaoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-surface-container-high rounded-[2.5rem] p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                <div>
                  <h3 className="text-xl font-black uppercase text-on-surface">Lançar Avaliação Mensal de Desempenho</h3>
                  <p className="text-xs text-slate-400">Atribua notas de 1 a 10 nos critérios de avaliação</p>
                </div>
                <button onClick={() => setIsAvaliacaoModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveAvaliacao} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Colaborador Avaliado *</label>
                    <select
                      required
                      value={avaliacaoForm.funcionarioId}
                      onChange={(e) => setAvaliacaoForm({ ...avaliacaoForm, funcionarioId: e.target.value })}
                      className="w-full px-3 py-2 bg-surface rounded-xl border border-surface-container-high text-xs font-bold"
                    >
                      <option value="">Selecione o colaborador...</option>
                      {usuarios?.filter(u => u.ativo !== false).map(u => (
                        <option key={u.id} value={u.id}>{u.nome} ({u.cargoNome || 'Sem Cargo'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Mês de Referência *</label>
                    <input
                      type="month"
                      required
                      value={avaliacaoForm.mesAno}
                      onChange={(e) => setAvaliacaoForm({ ...avaliacaoForm, mesAno: e.target.value })}
                      className="w-full px-3 py-2 bg-surface rounded-xl border border-surface-container-high text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Criteria Range Controls */}
                <div className="space-y-4 p-4 bg-surface-container-low rounded-2xl border border-surface-container-high">
                  <h4 className="text-xs font-black uppercase text-primary">Atribuição de Notas (1 a 10):</h4>

                  {[
                    { key: 'comprometimento', label: 'Comprometimento' },
                    { key: 'comunicacao', label: 'Comunicação' },
                    { key: 'pontualidade', label: 'Pontualidade' },
                    { key: 'organizacao', label: 'Organização' },
                    { key: 'conhecimentoTecnico', label: 'Conhecimento Técnico' },
                    { key: 'relacionamento', label: 'Relacionamento Interpessoal' },
                    { key: 'produtividade', label: 'Produtividade' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between gap-4">
                      <span className="text-xs font-bold text-slate-700 min-w-[160px]">{item.label}</span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={avaliacaoForm[item.key as keyof typeof avaliacaoForm] as number}
                        onChange={(e) => setAvaliacaoForm({
                          ...avaliacaoForm,
                          [item.key]: parseInt(e.target.value)
                        })}
                        className="flex-1 accent-primary"
                      />
                      <span className="w-8 text-center text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">
                        {avaliacaoForm[item.key as keyof typeof avaliacaoForm] as number}
                      </span>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Observações e Comentários do Avaliador</label>
                  <textarea
                    rows={3}
                    value={avaliacaoForm.observacoesAvaliador}
                    onChange={(e) => setAvaliacaoForm({ ...avaliacaoForm, observacoesAvaliador: e.target.value })}
                    placeholder="Destaque pontos fortes e recomendações de desenvolvimento..."
                    className="w-full px-3 py-2 bg-surface rounded-xl border border-surface-container-high text-xs font-medium focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAvaliacaoModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    Salvar Avaliação
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
