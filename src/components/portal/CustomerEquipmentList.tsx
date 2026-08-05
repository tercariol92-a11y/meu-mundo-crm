import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Search, 
  Activity, 
  Calendar, 
  History, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  ShieldCheck,
  Building2,
  Info,
  Plus,
  Edit2,
  Trash2,
  Eye,
  FileText,
  XCircle,
  HelpCircle,
  Image as ImageIcon,
  MessageSquare,
  FileSpreadsheet
} from 'lucide-react';
import { User, EquipamentoCliente, Unidade, SolicitacaoEquipamento } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';
import EquipmentRegistrationModal from './EquipmentRegistrationModal';
import EquipmentImportWizard from './EquipmentImportWizard';
import { toast } from 'react-hot-toast';

interface CustomerEquipmentListProps {
  user: User;
  onViewDetail: (id: string) => void;
}

export default function CustomerEquipmentList({ user, onViewDetail }: CustomerEquipmentListProps) {
  const [equipment, setEquipment] = useState<EquipamentoCliente[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoEquipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [activeTab, setActiveTab] = useState<'equipamentos' | 'solicitacoes'>('equipamentos');

  // Modals
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<SolicitacaoEquipamento | null>(null);
  const [viewingRequest, setViewingRequest] = useState<SolicitacaoEquipamento | null>(null);

  const loadData = async () => {
    if (!user.clienteId) return;
    setLoading(true);
    try {
      const [eqData, uniData, reqData] = await Promise.all([
        databaseService.getEquipamentosByCliente(user.clienteId),
        databaseService.getUnidadesByCliente(user.clienteId),
        databaseService.getSolicitacoesEquipamento(user.clienteId)
      ]);

      const mappedUni = uniData || [];
      setUnidades(mappedUni);

      const mappedEq = (eqData || []).map(eq => {
        const u = mappedUni.find(un => un.id === eq.unidadeId);
        return {
          ...eq,
          unidade: u,
          unidadeNome: u?.nome || (eq as any).unidadeNome || 'Não informada'
        } as any;
      });

      setEquipment(mappedEq);
      setSolicitacoes(reqData || []);
    } catch (err) {
      console.error('Error loading equipment, units and requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.clienteId]);

  const handleCancelRequest = async (id: string) => {
    if (window.confirm("Deseja realmente cancelar esta solicitação de cadastro?")) {
      try {
        await databaseService.deleteSolicitacaoEquipamento(id);
        toast.success("Solicitação cancelada com sucesso!");
        loadData();
      } catch (err) {
        console.error("Error cancelling request:", err);
        toast.error("Erro ao cancelar solicitação.");
      }
    }
  };

  const getGarantiaStatus = (item: EquipamentoCliente) => {
    if ((item as any).emGarantia !== undefined) {
      return (item as any).emGarantia ? 'Em Garantia' : 'Fora de Garantia';
    }
    if ((item as any).garantiaAte) {
      const limitDate = new Date((item as any).garantiaAte);
      return limitDate >= new Date() ? 'Em Garantia' : 'Fora de Garantia';
    }
    
    // Default logic: 12 months warranty from dataInstalacao
    if (item.dataInstalacao) {
      const installDate = new Date(item.dataInstalacao);
      const warrantyExpiryDate = new Date(installDate);
      warrantyExpiryDate.setMonth(warrantyExpiryDate.getMonth() + 12);
      
      return warrantyExpiryDate >= new Date() ? 'Em Garantia' : 'Fora de Garantia';
    }
    
    return 'Fora de Garantia'; // Fallback if no installation date
  };

  const allowedUnidadesIds: string[] = [];
  if ((user as any).unidadeId) {
    allowedUnidadesIds.push((user as any).unidadeId);
  }
  if ((user as any).unidadesIds && Array.isArray((user as any).unidadesIds)) {
    allowedUnidadesIds.push(...(user as any).unidadesIds);
  }

  const filteredEquipment = equipment.filter(e => {
    // 1. Strict Isolation: Must match user's client company ID
    if (e.clienteId !== user.clienteId) return false;

    // 2. Unit Isolation: If user has restricted unit access
    if (allowedUnidadesIds.length > 0 && e.unidadeId && !allowedUnidadesIds.includes(e.unidadeId)) {
      return false;
    }

    // 3. Specific Equipment Restriction: If user is restricted to a precise list of equipment IDs
    if ((user as any).equipamentosIds && (user as any).equipamentosIds.length > 0 && !(user as any).equipamentosIds.includes(e.id)) {
      return false;
    }

    // 4. Status Tabs Filter
    if (statusFilter !== 'Todos') {
      const garantia = getGarantiaStatus(e);
      if (statusFilter === 'Em garantia') {
        if (garantia !== 'Em Garantia') return false;
      } else if (statusFilter === 'Fora de garantia') {
        if (garantia !== 'Fora de Garantia') return false;
      } else if (statusFilter === 'Em funcionamento') {
        const isFuncionando = ['Em operação', 'Entregue ao cliente', 'Ativo'].includes(e.status);
        if (!isFuncionando) return false;
      } else if (statusFilter === 'Em manutenção') {
        const isManutencao = ['Em manutenção', 'Em análise', 'Com falha', 'Parado'].includes(e.status);
        if (!isManutencao) return false;
      } else if (statusFilter === 'Aguardando peça') {
        if (e.status !== 'Aguardando peça') return false;
      } else if (statusFilter === 'Pronto') {
        const isPronto = ['Equipamento pronto', 'Pronto'].includes(e.status);
        if (!isPronto) return false;
      }
    }

    // 5. Search Bar Filter (numeroSerie, modelo, marca, tipo, unidadeNome, status)
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      !searchTerm ||
      e.modelo?.toLowerCase().includes(term) || 
      e.numeroSerie?.toLowerCase().includes(term) ||
      e.tipo?.toLowerCase().includes(term) ||
      e.marca?.toLowerCase().includes(term) ||
      ((e as any).unidadeNome || '').toLowerCase().includes(term) ||
      e.status?.toLowerCase().includes(term);

    return matchesSearch;
  });

  const filteredSolicitacoes = solicitacoes.filter(req => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      !searchTerm ||
      req.modelo?.toLowerCase().includes(term) ||
      req.numeroSerie?.toLowerCase().includes(term) ||
      req.tipo?.toLowerCase().includes(term) ||
      req.marca?.toLowerCase().includes(term) ||
      req.status?.toLowerCase().includes(term);

    return matchesSearch;
  });

  const getStatusBadgeStyle = (status: string) => {
    const funcionandos = ['Em operação', 'Entregue ao cliente', 'Ativo'];
    const manutencoes = ['Em manutenção', 'Em análise', 'Com falha', 'Parado'];
    const prontos = ['Equipamento pronto', 'Pronto'];
    const aguardando = ['Aguardando peça'];

    if (funcionandos.includes(status)) {
      return 'bg-green-100 text-green-700 border-green-200';
    }
    if (manutencoes.includes(status)) {
      return 'bg-orange-100 text-orange-700 border-orange-200';
    }
    if (prontos.includes(status)) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    if (aguardando.includes(status)) {
      return 'bg-amber-100 text-amber-700 border-amber-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getStatusIconStyle = (status: string) => {
    const funcionandos = ['Em operação', 'Entregue ao cliente', 'Ativo'];
    const manutencoes = ['Em manutenção', 'Em análise', 'Com falha', 'Parado'];
    const prontos = ['Equipamento pronto', 'Pronto'];
    const aguardando = ['Aguardando peça'];

    if (funcionandos.includes(status)) {
      return 'bg-green-50 text-green-600 shadow-green-600/10';
    }
    if (manutencoes.includes(status)) {
      return 'bg-orange-50 text-orange-600 shadow-orange-600/10';
    }
    if (prontos.includes(status)) {
      return 'bg-blue-50 text-blue-600 shadow-blue-600/10';
    }
    if (aguardando.includes(status)) {
      return 'bg-amber-50 text-amber-600 shadow-amber-600/10';
    }
    return 'bg-gray-50 text-gray-600 shadow-gray-600/10';
  };

  const filterTabs = [
    { id: 'Todos', label: 'Todos' },
    { id: 'Em funcionamento', label: 'Em funcionamento' },
    { id: 'Em manutenção', label: 'Em manutenção' },
    { id: 'Aguardando peça', label: 'Aguardando Peça' },
    { id: 'Pronto', label: 'Pronto' },
    { id: 'Em garantia', label: 'Em Garantia' },
    { id: 'Fora de garantia', label: 'Fora de Garantia' }
  ];

  return (
    <div className="space-y-8">
      {/* Header com botões de cadastro e acompanhamento */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-on-surface">
            {activeTab === 'equipamentos' ? 'Meus Equipamentos' : 'Acompanhar Cadastros'}
          </h1>
          <p className="text-sm text-on-surface-variant font-medium">
            {activeTab === 'equipamentos' 
              ? 'Consulte a estrutura técnica vinculada à sua conta.' 
              : 'Visualize, edite ou cancele suas solicitações de cadastro enviadas.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Botão Cadastrar Equipamento (destacado) */}
          <button
            onClick={() => {
              setEditingRequest(null);
              setIsRegistrationModalOpen(true);
            }}
            id="btn-cadastrar-equipamento"
            className="w-full sm:w-auto px-6 py-4 bg-primary hover:bg-primary/90 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Cadastrar Equipamento
          </button>

          {/* Botão Importar Equipamentos */}
          <button
            onClick={() => setIsImportWizardOpen(true)}
            id="btn-importar-equipamentos"
            className="w-full sm:w-auto px-6 py-4 border border-primary hover:bg-primary/5 text-primary text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={16} />
            Importar Equipamentos
          </button>

          {/* Botão Secundário para Alternar Abas */}
          <button
            onClick={() => setActiveTab(activeTab === 'equipamentos' ? 'solicitacoes' : 'equipamentos')}
            id="btn-alternar-aba"
            className="w-full sm:w-auto px-6 py-4 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 border border-surface-container-high shadow-sm"
          >
            {activeTab === 'equipamentos' ? (
              <>
                <History size={16} />
                Acompanhar cadastros enviados
              </>
            ) : (
              <>
                <Wrench size={16} />
                Visualizar Meus Equipamentos
              </>
            )}
          </button>
        </div>
      </header>

      {/* Barra de Pesquisa */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
        <input
          type="text"
          placeholder={activeTab === 'equipamentos' 
            ? "Buscar por modelo, marca, número de série, tipo, unidade ou status..." 
            : "Buscar solicitações por modelo, marca, número de série..."}
          className="w-full pl-12 pr-6 py-4 bg-surface-container-low border border-surface-container-high rounded-[24px] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {activeTab === 'equipamentos' ? (
        <>
          {/* Abas de Filtros de Equipamentos */}
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 scrollbar-none">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-all ${
                  statusFilter === tab.id
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant border-surface-container-high hover:bg-surface-container-high/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Grid de Equipamentos Ativos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full p-20 flex justify-center">
                <Loader2 className="animate-spin text-primary" size={48} />
              </div>
            ) : filteredEquipment.length === 0 ? (
              <div className="col-span-full p-20 text-center space-y-4">
                <div className="w-20 h-20 bg-surface-container-highest rounded-[32px] flex items-center justify-center mx-auto text-primary/20">
                  <Wrench size={40} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-on-surface">Nenhum equipamento encontrado</h3>
                <p className="text-sm text-on-surface-variant font-medium">Não encontramos equipamentos que correspondam aos filtros selecionados.</p>
              </div>
            ) : (
              filteredEquipment.map((item, index) => {
                const garantia = getGarantiaStatus(item);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onViewDetail(item.id)}
                        className="w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-110 transition-transform"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>

                    <div>
                      <div className="flex items-start justify-between mb-6">
                        <div className={`w-14 h-14 rounded-[24px] flex items-center justify-center shadow-lg transition-all ${getStatusIconStyle(item.status)}`}>
                          <Activity size={24} />
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusBadgeStyle(item.status)}`}>
                          {item.status}
                        </span>
                      </div>

                      <div className="space-y-6">
                        <div onClick={() => onViewDetail(item.id)} className="cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{item.tipo}</p>
                            <div className="flex items-center gap-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${item.lastOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                              <span className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant">
                                {item.lastOnline ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                          <h3 className="text-xl font-black text-on-surface uppercase tracking-tight leading-tight group-hover:text-primary transition-colors">{item.modelo}</h3>
                          <div className="flex items-center gap-4 mt-2">
                            <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">S/N: {item.numeroSerie || 'N/A'}</p>
                            {item.firmware && (
                              <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">FW: {item.firmware}</p>
                            )}
                          </div>
                        </div>

                        {/* Especificidades do Equipamento: Unidade, Marca, Garantia */}
                        <div className="flex flex-col gap-2 p-4 bg-surface-container-highest/10 rounded-2xl border border-surface-container-high/50">
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                            <span className="flex items-center gap-1">
                              <Building2 size={12} className="text-primary/70" /> Unidade
                            </span>
                            <span className="text-on-surface font-black truncate max-w-[150px]" title={(item as any).unidadeNome}>
                              {(item as any).unidadeNome}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                            <span className="flex items-center gap-1">
                              <ClipboardList size={12} className="text-primary/70" /> Marca
                            </span>
                            <span className="text-on-surface font-black">
                              {item.marca || 'Não informada'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                            <span className="flex items-center gap-1">
                              <ShieldCheck size={12} className="text-primary/70" /> Garantia
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                              garantia === 'Em Garantia' 
                                ? 'bg-green-50 text-green-700 border-green-100' 
                                : 'bg-red-50 text-red-700 border-red-100'
                            }`}>
                              {garantia}
                            </span>
                          </div>
                        </div>

                        {/* Datas de Manutenção e Instalação */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-surface-container-highest/10 p-3 rounded-2xl border border-surface-container-high/50">
                            <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Última Manut.</p>
                            <p className="text-[10px] font-bold text-on-surface">
                              {item.dataUltimaManutencao ? new Date(item.dataUltimaManutencao).toLocaleDateString('pt-BR') : '-'}
                            </p>
                          </div>
                          <div className="bg-surface-container-highest/10 p-3 rounded-2xl border border-surface-container-high/50">
                            <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Instalação</p>
                            <p className="text-[10px] font-bold text-on-surface">
                              {item.dataInstalacao ? new Date(item.dataInstalacao).toLocaleDateString('pt-BR') : '-'}
                            </p>
                          </div>
                        </div>

                        {/* Próxima Preventiva */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-primary" />
                              <span>Próxima Preventiva</span>
                            </div>
                            <span className="text-on-surface font-bold">
                              {item.dataProximaPreventiva ? new Date(item.dataProximaPreventiva).toLocaleDateString('pt-BR') : '-'}
                            </span>
                          </div>

                          {/* Botão Ver Histórico Completo */}
                          <button
                            onClick={() => onViewDetail(item.id)}
                            className="w-full py-3 bg-surface-container-highest/30 text-on-surface-variant rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center gap-2 border border-transparent hover:border-primary/20"
                          >
                            <History size={14} />
                            Ver Histórico Completo
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      ) : (
        /* Grid de Solicitações de Cadastro de Equipamento */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full p-20 flex justify-center">
              <Loader2 className="animate-spin text-primary" size={48} />
            </div>
          ) : filteredSolicitacoes.length === 0 ? (
            <div className="col-span-full p-20 text-center space-y-4">
              <div className="w-20 h-20 bg-surface-container-highest rounded-[32px] flex items-center justify-center mx-auto text-primary/20">
                <FileText size={40} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-on-surface">Nenhuma solicitação encontrada</h3>
              <p className="text-sm text-on-surface-variant font-medium">Você ainda não enviou solicitações ou elas não correspondem ao filtro.</p>
            </div>
          ) : (
            filteredSolicitacoes.map((item, index) => {
              const isPending = item.status === 'Aguardando validação';
              const isApproved = item.status === 'Aprovado';
              const isRefused = item.status === 'Recusado';

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Tipo e Status */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-14 h-14 rounded-[24px] bg-primary/5 text-primary flex items-center justify-center shadow-lg">
                        <Wrench size={24} />
                      </div>
                      
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        isPending ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        isApproved ? 'bg-green-100 text-green-700 border-green-200' :
                        'bg-red-100 text-red-700 border-red-200'
                      }`}>
                        {isPending ? 'Cadastro em análise' : item.status}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">{item.tipo}</p>
                        <h3 className="text-xl font-black text-on-surface uppercase tracking-tight leading-tight mt-1">{item.modelo}</h3>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">S/N: {item.numeroSerie}</p>
                      </div>

                      {/* Details Box */}
                      <div className="flex flex-col gap-2 p-4 bg-surface-container-highest/10 rounded-2xl border border-surface-container-high/50 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1"><Building2 size={12} /> Unidade</span>
                          <span className="text-on-surface font-black truncate max-w-[155px]">
                            {item.unidade?.nome || 'Unidade'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1"><ClipboardList size={12} /> Marca</span>
                          <span className="text-on-surface font-black">{item.marca}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1"><Calendar size={12} /> Instalação</span>
                          <span className="text-on-surface font-black">
                            {item.dataAproximadaInstalacao ? new Date(item.dataAproximadaInstalacao).toLocaleDateString('pt-BR') : 'Não informada'}
                          </span>
                        </div>
                      </div>

                      {/* Rejection Note */}
                      {isRefused && item.justificativaRecusa && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-700 font-medium">
                          <p className="font-bold uppercase text-[9px] tracking-widest mb-1 text-red-800">Motivo da Recusa:</p>
                          <p className="italic">"{item.justificativaRecusa}"</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div className="pt-6 mt-6 border-t border-surface-container-high flex flex-col gap-2">
                    {isPending ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setEditingRequest(item);
                            setIsRegistrationModalOpen(true);
                          }}
                          className="py-3 bg-surface border border-surface-container-high text-on-surface-variant rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center gap-1"
                        >
                          <Edit2 size={12} />
                          Editar
                        </button>
                        <button
                          onClick={() => handleCancelRequest(item.id)}
                          className="py-3 bg-red-50 text-red-600 rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-red-100 transition-all flex items-center justify-center gap-1"
                        >
                          <Trash2 size={12} />
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setViewingRequest(item)}
                        className="w-full py-3 bg-surface-container-highest/40 text-on-surface-variant rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-center gap-2 border border-transparent hover:border-primary/20"
                      >
                        <Eye size={14} />
                        Visualizar dados enviados
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Modal de Cadastro de Equipamento */}
      <EquipmentRegistrationModal
        isOpen={isRegistrationModalOpen}
        onClose={() => {
          setIsRegistrationModalOpen(false);
          setEditingRequest(null);
        }}
        user={user}
        unidades={unidades}
        onSuccess={loadData}
        editingRequest={editingRequest}
      />

      {/* Modal para Visualização Estática de Solicitação */}
      <AnimatePresence>
        {viewingRequest && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-[40px] border border-surface-container-high w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-8 space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
                <div>
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                    viewingRequest.status === 'Aprovado' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
                  }`}>
                    {viewingRequest.status}
                  </span>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-on-surface mt-2">{viewingRequest.modelo}</h2>
                  <p className="text-xs text-on-surface-variant font-bold mt-1">S/N: {viewingRequest.numeroSerie}</p>
                </div>
                <button 
                  onClick={() => setViewingRequest(null)}
                  className="p-3 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-all"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* Grid de dados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Tipo de Equipamento</p>
                  <p className="text-on-surface uppercase font-bold">{viewingRequest.tipo}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Marca</p>
                  <p className="text-on-surface uppercase font-bold">{viewingRequest.marca}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Unidade</p>
                  <p className="text-on-surface uppercase font-bold">{viewingRequest.unidade?.nome || 'Não identificada'}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Local da Instalação</p>
                  <p className="text-on-surface font-bold">{viewingRequest.localInstalacao || '-'}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Data de Instalação</p>
                  <p className="text-on-surface font-bold">
                    {viewingRequest.dataAproximadaInstalacao ? new Date(viewingRequest.dataAproximadaInstalacao).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Adquirido na Mundo Tech?</p>
                  <p className="text-on-surface font-bold">{viewingRequest.adquiridoMundoTech}</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Está Funcionando?</p>
                  <p className="text-on-surface font-bold">{viewingRequest.funcionando}</p>
                </div>
                {viewingRequest.patrimonio && (
                  <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high">
                    <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Patrimônio</p>
                    <p className="text-on-surface font-bold">{viewingRequest.patrimonio}</p>
                  </div>
                )}
              </div>

              {/* Observações */}
              {viewingRequest.observacoes && (
                <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high text-xs">
                  <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Observações do Cliente</p>
                  <p className="text-on-surface font-medium whitespace-pre-wrap">{viewingRequest.observacoes}</p>
                </div>
              )}

              {/* Justificativa de recusa se houver */}
              {viewingRequest.status === 'Recusado' && viewingRequest.justificativaRecusa && (
                <div className="bg-red-50 p-4 border border-red-100 rounded-2xl text-xs text-red-700">
                  <p className="font-bold uppercase text-[9px] tracking-widest mb-1">Motivo da Recusa administrativo:</p>
                  <p className="italic">"{viewingRequest.justificativaRecusa}"</p>
                </div>
              )}

              {/* Fotos */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Arquivos e Fotos Enviadas</p>
                <div className="grid grid-cols-2 gap-4">
                  {viewingRequest.fotoEquipamento && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Foto do Equipamento</p>
                      <img src={viewingRequest.fotoEquipamento} alt="Equipamento" className="rounded-2xl w-full h-32 object-cover border border-surface-container-high" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  {viewingRequest.fotoEtiqueta && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Foto da Etiqueta S/N</p>
                      <img src={viewingRequest.fotoEtiqueta} alt="Etiqueta" className="rounded-2xl w-full h-32 object-cover border border-surface-container-high" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-surface-container-high flex justify-end">
                <button
                  onClick={() => setViewingRequest(null)}
                  className="px-6 py-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Importador de Equipamentos Wizard */}
      <EquipmentImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        user={user}
        unidades={unidades}
        existingEquipments={equipment}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
