import React, { useState, useEffect } from 'react';
import { Lead, Usuario, MotivoPerda } from '../../types';
import { databaseService } from '../../services/databaseService';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Mail, 
  Phone, 
  Building2, 
  User as UserIcon,
  ChevronRight,
  ArrowRightLeft,
  X,
  Save,
  Trash2,
  Edit2,
  Eye,
  FileText,
  MapPin,
  MessageSquare,
  MessageCircle,
  DollarSign,
  Calendar,
  UserPlus,
  Repeat
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import QuoteWizard from './QuoteWizard';
import WhatsAppModal from './WhatsAppModal';

import { useGlobalData } from '../../contexts/GlobalDataContext';

interface LeadsListProps {
  user: Usuario;
  onViewChange?: (view: any) => void;
}

export default function LeadsList({ user, onViewChange }: LeadsListProps) {
  const isLocalAdmin = user.role === 'admin' || user.roles?.includes('admin');
  const { leads, usuarios: users, loading } = useGlobalData();
  const userId = user.id;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [originFilter, setOriginFilter] = useState<string>('Todos');
  const [interestFilter, setInterestFilter] = useState<string>('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedLeadForWhatsApp, setSelectedLeadForWhatsApp] = useState<{name: string, phone: string} | null>(null);
  const [selectedLeadForQuote, setSelectedLeadForQuote] = useState<Lead | null>(null);
  const [lossReasons, setLossReasons] = useState<MotivoPerda[]>([]);
  const [selectedLossReason, setSelectedLossReason] = useState('');
  const [leadToMarkAsLost, setLeadToMarkAsLost] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Lead>>({
    nome: '',
    empresa: '',
    email: '',
    telefone: '',
    whatsapp: '',
    cidade: '',
    estado: '',
    origem: 'Google',
    interesse: 'Controle de acesso',
    status: 'Novo',
    responsavelId: userId,
    valorEstimado: 0,
    observacoes: '',
    proximoRetorno: {
      data: '',
      hora: '',
      observacao: '',
      concluido: false
    }
  });

  useEffect(() => {
    fetchLossReasons();
  }, []);

  const fetchLossReasons = async () => {
    try {
      const data = await databaseService.getMotivosPerda();
      setLossReasons(data || []);
    } catch (error) {
      console.error('Error fetching loss reasons:', error);
    }
  };

  const showFeedback = (message: string) => {
    setFeedbackMessage(message);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleStatusUpdate = async (lead: Lead, newStatus: Lead['status']) => {
    if (newStatus === 'Perdido') {
      setLeadToMarkAsLost(lead);
      setIsLossModalOpen(true);
      return;
    }

    try {
      setUpdatingStatusId(lead.id);
      await databaseService.updateLead(lead.id, { status: newStatus });
      showFeedback(`Status atualizado para ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleConfirmLoss = async () => {
    if (!leadToMarkAsLost || !selectedLossReason) return;

    try {
      setIsSaving(true);
      await databaseService.updateLead(leadToMarkAsLost.id, { 
        status: 'Perdido',
        // Assuming we might want to store the reason ID or description
        observacoes: `${leadToMarkAsLost.observacoes || ''}\nMotivo da perda: ${lossReasons.find(r => r.id === selectedLossReason)?.descricao || 'Não informado'}`
      });
      setIsLossModalOpen(false);
      setLeadToMarkAsLost(null);
      setSelectedLossReason('');
      showFeedback('Lead marcado como perdido');
    } catch (error) {
      console.error('Error marking lead as lost:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdvanceStage = async (lead: Lead) => {
    const currentIndex = statuses.indexOf(lead.status);
    if (currentIndex < statuses.length - 2) { // Don't advance to "Perdido" automatically
      const nextStatus = statuses[currentIndex + 1] as Lead['status'];
      await handleStatusUpdate(lead, nextStatus);
    }
  };

  const handleOpenModal = (lead?: Lead) => {
    if (lead) {
      setEditingLead(lead);
      setFormData(lead);
    } else {
      setEditingLead(null);
      setFormData({
        nome: '',
        empresa: '',
        email: '',
        telefone: '',
        whatsapp: '',
        cidade: '',
        estado: '',
        origem: 'Google',
        interesse: 'Controle de acesso',
        status: 'Novo',
        responsavelId: userId,
        valorEstimado: 0,
        observacoes: '',
        proximoRetorno: {
          data: '',
          hora: '',
          observacao: '',
          concluido: false
        }
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLead(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) return;

    try {
      setIsSaving(true);
      if (editingLead) {
        await databaseService.updateLead(editingLead.id, formData);
      } else {
        await databaseService.createLead(formData as Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>);
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error saving lead:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este lead?')) return;
    try {
      await databaseService.deleteLead(id);
    } catch (error) {
      console.error('Error deleting lead:', error);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      (lead.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (lead.empresa?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (lead.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (lead.telefone?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'Todos' || lead.status === statusFilter;
    const matchesOrigin = originFilter === 'Todos' || lead.origem === originFilter;
    const matchesInterest = interestFilter === 'Todos' || lead.interesse === interestFilter;
    
    return matchesSearch && matchesStatus && matchesOrigin && matchesInterest;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Novo': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Em contato': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Qualificado': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Proposta enviada': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Negociação': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Fechado': return 'bg-green-100 text-green-700 border-green-200';
      case 'Perdido': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const origins = ['Instagram', 'Facebook', 'Google', 'Indicação', 'Site', 'WhatsApp', 'Ligação', 'Visita', 'Outro'];
  const interests = [
    'Catraca facial', 'Controle de acesso', 'Relógio de ponto', 
    'Software de ponto', 'Software de acesso', 'Suporte técnico', 
    'Manutenção', 'Contrato mensal', 'Integração com RH', 
    'Totem / cancelas / outros', 'Outro'
  ];
  const statuses = ['Novo', 'Em contato', 'Qualificado', 'Proposta enviada', 'Negociação', 'Fechado', 'Perdido'];

  return (
    <div className="p-6 space-y-6">
      {/* Feedback Toast */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-on-surface text-surface px-6 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-3"
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-bold uppercase tracking-widest">{feedbackMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {onViewChange && (
            <button 
              onClick={() => onViewChange('comercial-dashboard')}
              className="p-2 hover:bg-surface-container-highest rounded-xl transition-colors text-on-surface-variant border border-surface-container-high"
              title="Voltar ao Dashboard"
            >
              <ChevronRight className="rotate-180" size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-on-surface">Leads</h1>
            <p className="text-sm text-on-surface-variant">Gerencie a prospecção de novos clientes</p>
          </div>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          Cadastrar Lead
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input
            type="text"
            placeholder="Buscar leads..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-on-surface-variant shrink-0" />
          <select
            className="flex-1 bg-surface-container-low border border-surface-container-high rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="Todos">Status: Todos</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={18} className="text-on-surface-variant shrink-0" />
          <select
            className="flex-1 bg-surface-container-low border border-surface-container-high rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
          >
            <option value="Todos">Origem: Todas</option>
            {origins.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={18} className="text-on-surface-variant shrink-0" />
          <select
            className="flex-1 bg-surface-container-low border border-surface-container-high rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={interestFilter}
            onChange={(e) => setInterestFilter(e.target.value)}
          >
            <option value="Todos">Interesse: Todos</option>
            {interests.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-2xl border border-surface-container-high overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/30 border-b border-surface-container-high">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Lead / Empresa</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Origem / Interesse</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Contato</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Responsável</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Valor Est.</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                      <UserIcon size={48} className="opacity-20" />
                      <p className="font-bold">Nenhum lead cadastrado ainda</p>
                      <p className="text-xs">Clique em Novo Lead para começar</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-surface-container-highest/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {lead.nome?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface">{lead.nome}</p>
                          <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-medium">{lead.empresa || 'Empresa não informada'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-on-surface">{lead.interesse || '-'}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">{lead.origem || '-'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {lead.email && (
                          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                            <Mail size={12} />
                            <span>{lead.email}</span>
                          </div>
                        )}
                        {lead.telefone && (
                          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                            <Phone size={12} />
                            <span>{lead.telefone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center text-[10px] font-bold">
                          {users.find(u => u.id === lead.responsavelId)?.nome?.charAt(0) || '?'}
                        </div>
                        <span className="text-xs text-on-surface-variant">
                          {users.find(u => u.id === lead.responsavelId)?.nome || 'Não atribuído'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative group/status">
                        <select
                          disabled={updatingStatusId === lead.id}
                          value={lead.status}
                          onChange={(e) => handleStatusUpdate(lead, e.target.value as Lead['status'])}
                          className={`appearance-none px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 pr-8 ${getStatusColor(lead.status)}`}
                        >
                          {statuses.map(s => (
                            <option key={s} value={s} className="bg-surface text-on-surface uppercase font-bold">
                              {s}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-50">
                          {updatingStatusId === lead.id ? (
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <ChevronRight size={12} className="rotate-90" />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-black text-on-surface">
                        R$ {lead.valorEstimado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {lead.status !== 'Fechado' && lead.status !== 'Perdido' && (
                          <button 
                            onClick={() => handleAdvanceStage(lead)}
                            className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors flex items-center gap-1" 
                            title="Avançar Etapa"
                          >
                            <ArrowRightLeft size={16} />
                            <span className="text-[10px] font-black uppercase tracking-tighter hidden xl:inline">Avançar</span>
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            if (onViewChange) {
                              onViewChange('atendimento');
                              localStorage.setItem('whatsapp_target_phone', lead.whatsapp || lead.telefone || '');
                            }
                          }}
                          className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors" 
                          title="Ir para WhatsApp"
                        >
                          <MessageCircle size={16} fill="currentColor" fillOpacity={0.2} />
                        </button>
                        <button 
                          onClick={() => handleOpenModal(lead)}
                          className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors" 
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(lead, 'Fechado')}
                          className="p-2 hover:bg-green-100 text-green-600 rounded-lg transition-colors" 
                          title="Converter em Cliente"
                        >
                          <UserPlus size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedLeadForQuote(lead);
                            setIsWizardOpen(true);
                          }}
                          className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors" 
                          title="Criar Orçamento"
                        >
                          <FileText size={16} />
                        </button>
                        {isLocalAdmin && (
                          <button 
                            onClick={() => handleDelete(lead.id)}
                            className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors" 
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-screen w-full max-w-xl bg-surface-container-low shadow-2xl z-[70] flex flex-col"
            >
              <div className="p-6 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-on-surface">
                    {editingLead ? 'Editar Lead' : 'Novo Lead'}
                  </h2>
                  <p className="text-xs text-on-surface-variant">Preencha os dados da oportunidade comercial</p>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Dados Básicos */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <UserIcon size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Dados Básicos</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome do Lead / Responsável *</label>
                      <input
                        required
                        type="text"
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.nome || ''}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        placeholder="Ex: João Silva"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Empresa</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                        <input
                          type="text"
                          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={formData.empresa || ''}
                          onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                          placeholder="Nome da empresa"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Telefone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                        <input
                          type="text"
                          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={formData.telefone || ''}
                          onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                          placeholder="(00) 0000-0000"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">WhatsApp</label>
                      <div className="relative">
                        <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                        <input
                          type="text"
                          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={formData.whatsapp || ''}
                          onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                          placeholder="(00) 90000-0000"
                        />
                      </div>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">E-mail</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                        <input
                          type="email"
                          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={formData.email || ''}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="email@empresa.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Cidade</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.cidade || ''}
                        onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                        placeholder="Ex: São Paulo"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Estado</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.estado || ''}
                        onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                        placeholder="Ex: SP"
                      />
                    </div>
                  </div>
                </section>

                {/* Origem e Interesse */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <ArrowRightLeft size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Origem e Interesse</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Origem do Lead</label>
                      <select
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.origem || ''}
                        onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
                      >
                        {origins.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Interesse Principal</label>
                      <select
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.interesse || ''}
                        onChange={(e) => setFormData({ ...formData, interesse: e.target.value })}
                      >
                        {interests.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                  </div>
                </section>

                {/* Dados Comerciais */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <DollarSign size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Dados Comerciais</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Status do Lead</label>
                      <select
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.status || ''}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as Lead['status'] })}
                      >
                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Responsável Comercial</label>
                      <select
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.responsavelId || ''}
                        onChange={(e) => setFormData({ ...formData, responsavelId: e.target.value })}
                      >
                        <option value="">Selecione um responsável</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Valor Estimado (R$)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                        <input
                          type="number"
                          step="0.01"
                          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={formData.valorEstimado || 0}
                          onChange={(e) => setFormData({ ...formData, valorEstimado: parseFloat(e.target.value) })}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Observações</label>
                      <textarea
                        rows={4}
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        value={formData.observacoes || ''}
                        onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        placeholder="Detalhes sobre a negociação, histórico de contato, etc."
                      />
                    </div>
                  </div>
                </section>

                {/* Retorno */}
                <section className="space-y-4 pb-20">
                  <div className="flex items-center gap-2 text-primary">
                    <Repeat size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Próximo Retorno</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Data do Retorno</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                        <input
                          type="date"
                          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={formData.proximoRetorno?.data || ''}
                          onChange={(e) => setFormData({ ...formData, proximoRetorno: { ...formData.proximoRetorno!, data: e.target.value } })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Horário</label>
                      <input
                        type="time"
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.proximoRetorno?.hora || ''}
                        onChange={(e) => setFormData({ ...formData, proximoRetorno: { ...formData.proximoRetorno!, hora: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Observação do Retorno</label>
                      <textarea
                        rows={3}
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        value={formData.proximoRetorno?.observacao || ''}
                        onChange={(e) => setFormData({ ...formData, proximoRetorno: { ...formData.proximoRetorno!, observacao: e.target.value } })}
                        placeholder="O que deve ser feito no retorno?"
                      />
                    </div>
                  </div>
                </section>
              </form>

              <div className="p-6 border-t border-surface-container-high bg-surface-container-highest/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-primary text-white px-8 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  {editingLead ? 'Salvar Alterações' : 'Cadastrar Lead'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Loss Reason Modal */}
      <AnimatePresence>
        {isLossModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLossModalOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-container-low shadow-2xl z-[90] rounded-3xl overflow-hidden"
            >
              <div className="p-6 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-on-surface">
                    Motivo da Perda
                  </h2>
                  <p className="text-xs text-on-surface-variant">Por que este lead foi perdido?</p>
                </div>
                <button 
                  onClick={() => setIsLossModalOpen(false)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Selecione o motivo *</label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={selectedLossReason}
                    onChange={(e) => setSelectedLossReason(e.target.value)}
                  >
                    <option value="">Selecione um motivo...</option>
                    {lossReasons.map(reason => (
                      <option key={reason.id} value={reason.id}>{reason.descricao}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-6 border-t border-surface-container-high bg-surface-container-highest/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsLossModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmLoss}
                  disabled={isSaving || !selectedLossReason}
                  className="flex items-center gap-2 bg-red-600 text-white px-8 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                  Confirmar Perda
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isWizardOpen && (
          <QuoteWizard 
            user={user}
            onClose={() => {
              setIsWizardOpen(false);
              setSelectedLeadForQuote(null);
            }}
            onSave={() => {
              if (onViewChange) onViewChange('comercial-orcamentos');
            }}
            initialData={selectedLeadForQuote ? {
              titulo: `Orçamento - ${selectedLeadForQuote.nome}`,
              leadId: selectedLeadForQuote.id,
              lead: selectedLeadForQuote,
              valor: selectedLeadForQuote.valorEstimado || 0,
              itens: [],
              status: 'Rascunho',
              vendedorId: user.id
            } as any : undefined}
          />
        )}
      </AnimatePresence>

      <WhatsAppModal 
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        name={selectedLeadForWhatsApp?.name || ''}
        phone={selectedLeadForWhatsApp?.phone || ''}
      />
    </div>
  );
}

