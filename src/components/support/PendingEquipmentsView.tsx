import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Search, 
  Check, 
  X, 
  Building2, 
  User, 
  Calendar, 
  Hash, 
  ClipboardList, 
  Loader2, 
  Eye, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  FileText,
  AlertTriangle,
  History,
  Link,
  ChevronRight,
  Info,
  Image as ImageIcon
} from 'lucide-react';
import { SolicitacaoEquipamento, Cliente, Unidade, Tecnico, EquipamentoCliente, User as AppUser } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface PendingEquipmentsViewProps {
  user: AppUser;
}

export default function PendingEquipmentsView({ user }: PendingEquipmentsViewProps) {
  const [requests, setRequests] = useState<SolicitacaoEquipamento[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [units, setUnits] = useState<Unidade[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [existingEquipments, setExistingEquipments] = useState<EquipamentoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal / Analysis states
  const [selectedRequest, setSelectedRequest] = useState<SolicitacaoEquipamento | null>(null);
  const [correctingBrand, setCorrectingBrand] = useState('');
  const [correctingModel, setCorrectingModel] = useState('');
  const [correctingSerial, setCorrectingSerial] = useState('');
  const [correctingPatrimonio, setCorrectingPatrimonio] = useState('');
  
  const [targetClienteId, setTargetClienteId] = useState('');
  const [targetUnidadeId, setTargetUnidadeId] = useState('');
  const [targetTecnicoId, setTargetTecnicoId] = useState('');
  const [installationDate, setInstallationDate] = useState('');
  const [warrantyDate, setWarrantyDate] = useState('');
  
  // Rejection state
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [rejectionJustification, setRejectionJustification] = useState('');
  
  // Unification/Merge state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [selectedMergeEquipmentId, setSelectedMergeEquipmentId] = useState('');

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [reqs, clis, unis, tecs, eqs] = await Promise.all([
        databaseService.getSolicitacoesEquipamento(),
        databaseService.getClientes(),
        databaseService.getUnidades(),
        databaseService.getTecnicos(),
        databaseService.getEquipamentosCliente()
      ]);

      setRequests(reqs || []);
      setClients(clis || []);
      setUnits(unis || []);
      setTecnicos(tecs || []);
      setExistingEquipments(eqs || []);
    } catch (err) {
      console.error("Error loading pending equipments data:", err);
      toast.error("Erro ao carregar dados do painel.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleStartAnalysis = (req: SolicitacaoEquipamento) => {
    setSelectedRequest(req);
    setCorrectingBrand(req.marca || '');
    setCorrectingModel(req.modelo || '');
    setCorrectingSerial(req.numeroSerie || '');
    setCorrectingPatrimonio(req.patrimonio || '');
    setTargetClienteId(req.clienteId || '');
    setTargetUnidadeId(req.unidadeId || '');
    setInstallationDate(req.dataAproximadaInstalacao || '');
    
    // Default warranty: 1 year from installation date
    if (req.dataAproximadaInstalacao) {
      const inst = new Date(req.dataAproximadaInstalacao);
      inst.setFullYear(inst.getFullYear() + 1);
      setWarrantyDate(inst.toISOString().split('T')[0]);
    } else {
      setWarrantyDate('');
    }
    
    setTargetTecnicoId('');
    setShowRejectionDialog(false);
    setShowMergeDialog(false);
    setRejectionJustification('');
    setSelectedMergeEquipmentId('');
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    if (!targetClienteId || !targetUnidadeId) {
      toast.error("O cliente e a unidade devem estar vinculados.");
      return;
    }
    if (!correctingSerial.trim()) {
      toast.error("O número de série não pode ficar vazio.");
      return;
    }

    try {
      // 1. Create equipment in `equipamentos_cliente`
      const equipmentPayload: Omit<EquipamentoCliente, 'id' | 'createdAt' | 'updatedAt'> = {
        clienteId: targetClienteId,
        unidadeId: targetUnidadeId,
        tipo: selectedRequest.tipo,
        marca: correctingBrand.trim(),
        modelo: correctingModel.trim(),
        numeroSerie: correctingSerial.trim(),
        patrimonio: correctingPatrimonio.trim() || undefined,
        quantidade: 1,
        localInstalacao: selectedRequest.localInstalacao,
        dataInstalacao: installationDate || undefined,
        dataProximaPreventiva: installationDate ? (() => {
          const prev = new Date(installationDate);
          prev.setMonth(prev.getMonth() + 6); // standard 6 months preventive cycle
          return prev.toISOString().split('T')[0];
        })() : undefined,
        tecnicoResponsavelId: targetTecnicoId || undefined,
        status: 'Em operação',
        observacoesTecnicas: `Equipamento cadastrado via solicitação de cliente. Aprovado por ${user.email}. Observações do cliente: ${selectedRequest.observacoes || 'Nenhuma'}`
      };

      // Add warranty attribute to matched schema
      (equipmentPayload as any).emGarantia = warrantyDate ? new Date(warrantyDate) >= new Date() : false;
      (equipmentPayload as any).garantiaAte = warrantyDate || undefined;

      await databaseService.createEquipamentoCliente(equipmentPayload);

      // 2. Update status of solicitation to Approved
      await databaseService.updateSolicitacaoEquipamento(selectedRequest.id, {
        status: 'Aprovado',
        approvedBy: user.email || 'Mundo Tech Admin',
        approvedAt: new Date().toISOString()
      });

      toast.success("Equipamento aprovado e cadastrado com sucesso!");
      setSelectedRequest(null);
      loadAllData();
    } catch (err) {
      console.error("Error approving equipment:", err);
      toast.error("Erro ao aprovar equipamento.");
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    if (!rejectionJustification.trim()) {
      toast.error("Insira a justificativa para a recusa.");
      return;
    }

    try {
      await databaseService.updateSolicitacaoEquipamento(selectedRequest.id, {
        status: 'Recusado',
        justificativaRecusa: rejectionJustification.trim(),
        approvedBy: user.email || 'Mundo Tech Admin',
        approvedAt: new Date().toISOString()
      });

      toast.success("Solicitação recusada com sucesso.");
      setSelectedRequest(null);
      setShowRejectionDialog(false);
      loadAllData();
    } catch (err) {
      console.error("Error rejecting request:", err);
      toast.error("Erro ao recusar solicitação.");
    }
  };

  const handleMerge = async () => {
    if (!selectedRequest || !selectedMergeEquipmentId) {
      toast.error("Selecione um equipamento cadastrado para unificar.");
      return;
    }

    try {
      // Find the existing equipment to update
      const existing = existingEquipments.find(e => e.id === selectedMergeEquipmentId);
      if (!existing) return;

      // Update the existing equipment with information from the request
      const updatePayload: Partial<EquipamentoCliente> = {
        marca: correctingBrand.trim() || existing.marca,
        modelo: correctingModel.trim() || existing.modelo,
        numeroSerie: correctingSerial.trim() || existing.numeroSerie,
        patrimonio: correctingPatrimonio.trim() || existing.patrimonio,
        localInstalacao: selectedRequest.localInstalacao || existing.localInstalacao,
        observacoesTecnicas: `${existing.observacoesTecnicas || ''}\n[Unificado com solicitação de cadastro do cliente por ${user.email}].`
      };

      await databaseService.updateEquipamentoCliente(existing.id, updatePayload);

      // Update the request in `solicitacoes_equipamento`
      await databaseService.updateSolicitacaoEquipamento(selectedRequest.id, {
        status: 'Aprovado',
        approvedBy: user.email || 'Mundo Tech Admin',
        approvedAt: new Date().toISOString()
      });

      toast.success("Equipamentos unificados com sucesso!");
      setSelectedRequest(null);
      setShowMergeDialog(false);
      loadAllData();
    } catch (err) {
      console.error("Error merging equipments:", err);
      toast.error("Erro ao unificar equipamento.");
    }
  };

  // Filter requests based on search term
  const pendingRequests = requests.filter(r => r.status === 'Aguardando validação');
  
  const filteredPending = pendingRequests.filter(r => {
    const term = searchTerm.toLowerCase();
    const cli = clients.find(c => c.id === r.clienteId);
    return (
      r.modelo?.toLowerCase().includes(term) ||
      r.numeroSerie?.toLowerCase().includes(term) ||
      r.marca?.toLowerCase().includes(term) ||
      cli?.nomeFantasia?.toLowerCase().includes(term) ||
      cli?.razaoSocial?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-on-surface">Equipamentos Pendentes</h1>
        <p className="text-sm text-on-surface-variant font-medium">
          Valide as solicitações de cadastro enviadas pelos clientes, verifique duplicidades e vincule aos contratos ativos.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
        <input
          type="text"
          placeholder="Buscar solicitações pendentes por modelo, marca, número de série, nome do cliente..."
          className="w-full pl-12 pr-6 py-4 bg-surface-container-low border border-surface-container-high rounded-[24px] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="p-20 flex justify-center">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      ) : filteredPending.length === 0 ? (
        <div className="p-20 text-center space-y-4">
          <div className="w-20 h-20 bg-surface-container-highest rounded-[32px] flex items-center justify-center mx-auto text-success/20">
            <CheckCircle2 size={40} className="text-success" />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight text-on-surface">Nenhuma solicitação pendente</h3>
          <p className="text-sm text-on-surface-variant font-medium">Tudo em ordem por aqui! Não há novos cadastros de equipamentos aguardando validação.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPending.map((req, index) => {
            const client = clients.find(c => c.id === req.clienteId);
            const unit = units.find(u => u.id === req.unidadeId);
            
            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[9px] font-black uppercase tracking-widest">
                      Aguardando validação
                    </span>
                    
                    {req.analiseDuplicidade && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse">
                        <ShieldAlert size={10} /> S/N Duplicado
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">{req.tipo}</p>
                    <h3 className="text-xl font-black text-on-surface uppercase tracking-tight mt-1 truncate">{req.modelo}</h3>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">S/N: {req.numeroSerie}</p>
                  </div>

                  {/* Info Box */}
                  <div className="mt-6 space-y-3 p-4 bg-surface-container-highest/10 rounded-2xl border border-surface-container-high/50 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1"><User size={12} /> Cliente</span>
                      <span className="text-on-surface font-black truncate max-w-[150px]">
                        {client?.nomeFantasia || client?.razaoSocial || 'Não identificado'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1"><Building2 size={12} /> Unidade</span>
                      <span className="text-on-surface font-black truncate max-w-[150px]">
                        {unit?.nome || 'Não identificada'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1"><Calendar size={12} /> Solicitado em</span>
                      <span className="text-on-surface font-black">
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-surface-container-high">
                  <button
                    onClick={() => handleStartAnalysis(req)}
                    className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    <Eye size={14} />
                    Analisar Solicitação
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Detailed Analysis Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-[40px] border border-surface-container-high w-full max-w-6xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="sticky top-0 bg-surface px-8 py-6 border-b border-surface-container-high flex items-center justify-between z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black uppercase tracking-tight text-on-surface">Análise de Cadastro de Equipamento</h2>
                    {selectedRequest.analiseDuplicidade && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 border border-red-200 rounded-full text-[10px] font-black uppercase tracking-widest">
                        <AlertTriangle size={12} /> Alerta de Duplicidade
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">
                    Solicitante: {selectedRequest.createdBy} | Empresa ID: {selectedRequest.clienteId}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-3 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Grid content */}
              <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-y-auto">
                
                {/* Left: Photos & Customer inputs (6 cols) */}
                <div className="lg:col-span-5 space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <ImageIcon size={14} /> Fotos e Documentos Enviados
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedRequest.fotoEquipamento && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Foto do Equipamento</p>
                        <a href={selectedRequest.fotoEquipamento} target="_blank" rel="noreferrer" className="block border border-surface-container-high rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform">
                          <img src={selectedRequest.fotoEquipamento} alt="Foto Equipamento" className="w-full h-44 object-cover" referrerPolicy="no-referrer" />
                        </a>
                      </div>
                    )}
                    {selectedRequest.fotoEtiqueta && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Etiqueta com S/N</p>
                        <a href={selectedRequest.fotoEtiqueta} target="_blank" rel="noreferrer" className="block border border-surface-container-high rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform">
                          <img src={selectedRequest.fotoEtiqueta} alt="Foto Etiqueta" className="w-full h-44 object-cover" referrerPolicy="no-referrer" />
                        </a>
                      </div>
                    )}
                  </div>

                  {selectedRequest.notaFiscalDoc && (
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="text-primary" size={24} />
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-primary">Documento / Nota Fiscal</p>
                          <p className="text-[9px] text-on-surface-variant font-medium">Anexado pelo cliente</p>
                        </div>
                      </div>
                      <a
                        href={selectedRequest.notaFiscalDoc}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-white text-primary text-[10px] font-black uppercase tracking-widest rounded-lg border border-primary/20 hover:bg-primary/5 shadow-sm"
                      >
                        Visualizar
                      </a>
                    </div>
                  )}

                  {/* Customer Sent Data Summary */}
                  <div className="p-6 bg-surface-container-low rounded-3xl border border-surface-container-high space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Dados Declarados pelo Cliente</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest">Tipo</p>
                        <p className="font-bold text-on-surface uppercase mt-0.5">{selectedRequest.tipo}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest">Adquirido na MT?</p>
                        <p className="font-bold text-on-surface uppercase mt-0.5">{selectedRequest.adquiridoMundoTech}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest">Local Instalado</p>
                        <p className="font-bold text-on-surface uppercase mt-0.5">{selectedRequest.localInstalacao || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest">Está Funcionando?</p>
                        <p className="font-bold text-on-surface uppercase mt-0.5">{selectedRequest.funcionando}</p>
                      </div>
                    </div>
                    {selectedRequest.observacoes && (
                      <div className="pt-3 border-t border-surface-container-high text-xs">
                        <p className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Observações</p>
                        <p className="text-on-surface italic font-medium">"{selectedRequest.observacoes}"</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Admin Corrections & Mapping Form (7 cols) */}
                <div className="lg:col-span-7 space-y-8 lg:pl-4 border-l border-surface-container-high">
                  
                  {/* Alert Duplicity detail */}
                  {selectedRequest.analiseDuplicidade && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3 text-red-800 text-xs">
                      <ShieldAlert size={20} className="shrink-0 text-red-600" />
                      <div>
                        <p className="font-bold uppercase text-[9px] tracking-widest mb-1 text-red-900">Alerta de Duplicidade Técnico-Administrativa</p>
                        <p className="font-medium leading-relaxed">
                          O número de série <span className="font-black">{correctingSerial}</span> já existe cadastrado em outro cliente ou unidade no sistema. 
                          Se você aprovar esta solicitação como um novo equipamento, o número de série será duplicado na base. 
                          Considere unificar ou corrigir antes de prosseguir.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <ClipboardList size={14} /> Correção Técnica & Vínculos
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Corrigir Marca */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">
                          Corrigir Marca
                        </label>
                        <input
                          type="text"
                          value={correctingBrand}
                          onChange={(e) => setCorrectingBrand(e.target.value)}
                          className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      {/* Corrigir Modelo */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">
                          Corrigir Modelo
                        </label>
                        <input
                          type="text"
                          value={correctingModel}
                          onChange={(e) => setCorrectingModel(e.target.value)}
                          className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      {/* Conferir Número de Série */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">
                          Conferir / Corrigir Número de Série *
                        </label>
                        <input
                          type="text"
                          required
                          value={correctingSerial}
                          onChange={(e) => setCorrectingSerial(e.target.value)}
                          className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-2xl text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      {/* Corrigir Patrimônio */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">
                          Número de Patrimônio
                        </label>
                        <input
                          type="text"
                          value={correctingPatrimonio}
                          onChange={(e) => setCorrectingPatrimonio(e.target.value)}
                          className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      {/* Vincular a Cliente */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">
                          Vincular ao Cliente *
                        </label>
                        <select
                          required
                          value={targetClienteId}
                          onChange={(e) => {
                            setTargetClienteId(e.target.value);
                            setTargetUnidadeId('');
                          }}
                          className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">Selecione o Cliente...</option>
                          {clients.map(cli => (
                            <option key={cli.id} value={cli.id}>{cli.nomeFantasia || cli.razaoSocial}</option>
                          ))}
                        </select>
                      </div>

                      {/* Vincular a Unidade */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">
                          Vincular à Unidade *
                        </label>
                        <select
                          required
                          value={targetUnidadeId}
                          onChange={(e) => setTargetUnidadeId(e.target.value)}
                          className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">Selecione a Unidade...</option>
                          {units
                            .filter(u => !targetClienteId || u.clienteId === targetClienteId)
                            .map(uni => (
                              <option key={uni.id} value={uni.id}>{uni.nome}</option>
                            ))}
                        </select>
                      </div>

                      {/* Data de Instalação Oficial */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">
                          Definir Data de Instalação
                        </label>
                        <input
                          type="date"
                          value={installationDate}
                          onChange={(e) => setInstallationDate(e.target.value)}
                          className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      {/* Data de Fim de Garantia */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">
                          Data de Fim de Garantia
                        </label>
                        <input
                          type="date"
                          value={warrantyDate}
                          onChange={(e) => setWarrantyDate(e.target.value)}
                          className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      {/* Técnico Responsável */}
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">
                          Técnico Responsável Técnico
                        </label>
                        <select
                          value={targetTecnicoId}
                          onChange={(e) => setTargetTecnicoId(e.target.value)}
                          className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">Selecione o Técnico...</option>
                          {tecnicos.map(tec => (
                            <option key={tec.id} value={tec.id}>{tec.nome}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="pt-6 border-t border-surface-container-high space-y-4">
                    
                    {/* Normal approval and rejection buttons */}
                    {!showRejectionDialog && !showMergeDialog && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          onClick={handleApprove}
                          className="py-3.5 bg-success hover:bg-success/90 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-success/20 transition-all flex items-center justify-center gap-2"
                        >
                          <Check size={16} />
                          Aprovar Cadastro
                        </button>

                        <button
                          onClick={() => setShowRejectionDialog(true)}
                          className="py-3.5 bg-error hover:bg-error/90 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-error/20 transition-all flex items-center justify-center gap-2"
                        >
                          <X size={16} />
                          Recusar Cadastro
                        </button>

                        <button
                          onClick={() => setShowMergeDialog(true)}
                          className="py-3.5 bg-primary hover:bg-primary/90 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                        >
                          <Link size={16} />
                          Unificar Equipamento
                        </button>
                      </div>
                    )}

                    {/* Rejection Dialog Inline */}
                    {showRejectionDialog && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-red-50 border border-red-100 rounded-3xl space-y-4"
                      >
                        <h4 className="text-xs font-black uppercase tracking-widest text-red-900 flex items-center gap-2">
                          <AlertTriangle size={16} /> Justificar Recusa
                        </h4>
                        <textarea
                          placeholder="Informe ao cliente por que o cadastro foi recusado..."
                          required
                          value={rejectionJustification}
                          onChange={(e) => setRejectionJustification(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 bg-surface border border-red-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-error/20 resize-none"
                        />
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setShowRejectionDialog(false)}
                            className="px-4 py-2 bg-surface text-on-surface-variant text-[10px] font-black uppercase tracking-widest rounded-xl border border-surface-container-high"
                          >
                            Voltar
                          </button>
                          <button
                            type="button"
                            onClick={handleReject}
                            className="px-6 py-2 bg-error text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md"
                          >
                            Confirmar Recusa
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Unification / Merge Dialog Inline */}
                    {showMergeDialog && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-primary/5 border border-primary/10 rounded-3xl space-y-4"
                      >
                        <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <Link size={16} /> Unificar com Equipamento Existente
                        </h4>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          Selecione um equipamento já cadastrado na base de dados para mesclar as informações enviadas pelo cliente. 
                          O equipamento existente será atualizado e a solicitação marcada como concluída.
                        </p>
                        
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">
                            Equipamentos Existentes {targetClienteId ? `do Cliente Selecionado` : `(Selecione um cliente acima)`}
                          </label>
                          <select
                            required
                            value={selectedMergeEquipmentId}
                            onChange={(e) => setSelectedMergeEquipmentId(e.target.value)}
                            className="w-full px-4 py-3 bg-surface border border-surface-container-high rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">Selecione o equipamento existente...</option>
                            {existingEquipments
                              .filter(eq => !targetClienteId || eq.clienteId === targetClienteId)
                              .map(eq => (
                                <option key={eq.id} value={eq.id}>
                                  {eq.modelo} - S/N: {eq.numeroSerie} ({eq.tipo})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setShowMergeDialog(false)}
                            className="px-4 py-2 bg-surface text-on-surface-variant text-[10px] font-black uppercase tracking-widest rounded-xl border border-surface-container-high"
                          >
                            Voltar
                          </button>
                          <button
                            type="button"
                            onClick={handleMerge}
                            className="px-6 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md"
                          >
                            Unificar e Concluir
                          </button>
                        </div>
                      </motion.div>
                    )}

                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-surface px-8 py-5 border-t border-surface-container-high flex justify-end">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-6 py-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                >
                  Voltar ao Painel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
