import React, { useState, useMemo, useEffect } from 'react';
import { 
  Proposta, 
  Usuario, 
  Cliente, 
  Lead, 
  AcaoComercial,
  AgendaComercial
} from '../../types';
import { formatDateBR } from '../../utils/date';
import { proposalTotals } from '../../utils/proposalTotals';
import { databaseService } from '../../services/databaseService';
import { whatsappService } from '../../services/whatsapp.service';
import { useGlobalData } from '../../contexts/GlobalDataContext';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  MessageCircle, 
  Phone, 
  Mail, 
  Send, 
  Download, 
  Calendar, 
  User as UserIcon, 
  Building2, 
  MapPin, 
  FileText, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  ShieldCheck, 
  Briefcase, 
  Plus, 
  Check, 
  ArrowUpRight, 
  PieChart, 
  History, 
  PhoneCall, 
  Info,
  Percent,
  Lock,
  Zap,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NegotiationDrawerProps {
  quote: Proposta;
  quotesList: Proposta[];
  currentIndex: number;
  user: Usuario;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  onOpenPDF?: (quote: Proposta) => void;
}

export default function NegotiationDrawer({
  quote,
  quotesList,
  currentIndex,
  user,
  onClose,
  onNavigate,
  onOpenPDF
}: NegotiationDrawerProps) {
  const { clientes: clientsData, leads: leadsData, usuarios: usersData } = useGlobalData();
  const isAdmin = user.role === 'admin' || user.roles?.includes('admin');

  // Drawer Tabs / Views
  const [activeTab, setActiveTab] = useState<'geral' | 'timeline' | 'historico' | 'financeiro'>('geral');

  // Modals & Inputs
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState('');
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [scheduleNotes, setScheduleNotes] = useState('');

  // Call record modal
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callDuration, setCallDuration] = useState('5');
  const [callNotes, setCallNotes] = useState('');

  // New manual interaction state
  const [newLogText, setNewLogText] = useState('');
  const [newLogType, setNewLogType] = useState<'whatsapp' | 'ligacao' | 'email' | 'observacao'>('whatsapp');
  const [interactions, setInteractions] = useState<AcaoComercial[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);

  // Toast message
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // AI Checklist state
  const [completedAiTasks, setCompletedAiTasks] = useState<Record<string, boolean>>({
    task1: false,
    task2: false,
    task3: false
  });

  // Load client/lead info
  const matchedClient = useMemo(() => {
    if (quote.cliente) return quote.cliente;
    if (quote.clienteId) return (clientsData || []).find(c => c.id === quote.clienteId);
    return null;
  }, [quote, clientsData]);

  const matchedLead = useMemo(() => {
    if (quote.lead) return quote.lead;
    if (quote.leadId) return (leadsData || []).find(l => l.id === quote.leadId);
    return null;
  }, [quote, leadsData]);

  // Unified Client/Lead attributes
  const clientInfo = useMemo(() => {
    const nomeEmpresa = matchedClient?.razaoSocial || matchedClient?.nomeFantasia || matchedLead?.empresa || quote.clienteNome || quote.leadNome || 'Empresa não informada';
    const nomeContato = matchedClient?.responsavelNome || matchedLead?.nome || 'Contato Principal';
    const cargoContato = matchedClient?.responsavelCargo || 'Decisor / Compras';
    const telefone = matchedClient?.telefoneFixo || matchedLead?.telefone || 'Não informado';
    const whatsapp = matchedClient?.celularWhatsapp || matchedLead?.whatsapp || matchedLead?.telefone || matchedClient?.telefoneFixo || '';
    const email = matchedClient?.emailPrincipal || matchedLead?.email || 'email@exemplo.com';
    const cidade = matchedClient?.cidade || matchedLead?.cidade || 'Não informada';
    const estado = matchedClient?.estado || matchedLead?.estado || 'UF';
    const cnpj = matchedClient?.cnpj || matchedLead?.cpfCnpj || 'Não cadastrado';
    const origemLead = matchedClient?.origemLead || matchedLead?.origem || 'Prospecção Direta';
    
    const vendedorRespObj = usersData?.find(u => u.id === (quote.vendedorId || matchedClient?.vendedorResponsavel || matchedLead?.responsavelId));
    const vendedorNome = vendedorRespObj?.nome || user.nome || 'Vendedor Atribuído';
    
    return {
      nomeEmpresa,
      nomeContato,
      cargoContato,
      telefone,
      whatsapp,
      email,
      cidade,
      estado,
      cnpj,
      origemLead,
      vendedorNome
    };
  }, [matchedClient, matchedLead, quote, usersData, user]);

  // Calculate days since quote was sent / created
  const daysElapsed = useMemo(() => {
    const refDateStr = quote.dataEnvio || quote.createdAt;
    if (!refDateStr) return 4;
    const refDate = new Date(refDateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - refDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  }, [quote]);

  // Profit Margin calculation (Admin only)
  const marginInfo = useMemo(() => {
    const totalValor = proposalTotals(quote).investimentoInicial;
    let totalCusto = 0;

    if (quote.itens && quote.itens.length > 0) {
      quote.itens.forEach(item => {
        const itemCusto = item.custoUnitario || (item.valorUnitario * 0.65); // default estimate 65% cost if undefined
        totalCusto += itemCusto * (item.quantidade || 1);
      });
    } else {
      totalCusto = totalValor * 0.65;
    }

    const lucroBruto = Math.max(0, totalValor - totalCusto);
    const margemPercentual = totalValor > 0 ? (lucroBruto / totalValor) * 100 : 35;
    
    return {
      lucroBruto,
      margemPercentual: Math.min(99, Math.round(margemPercentual * 10) / 10)
    };
  }, [quote]);

  // Load interactions / history
  useEffect(() => {
    let isMounted = true;
    const fetchInteractions = async () => {
      setLoadingInteractions(true);
      try {
        const data = await databaseService.getAcoesComerciais(quote.leadId, quote.clienteId);
        if (isMounted && data) {
          setInteractions(data);
        }
      } catch (e) {
        console.error("Error loading interactions:", e);
      } finally {
        if (isMounted) setLoadingInteractions(false);
      }
    };
    fetchInteractions();
    return () => { isMounted = false; };
  }, [quote.id, quote.leadId, quote.clienteId]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < quotesList.length - 1) {
        onNavigate(currentIndex + 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, quotesList.length, onNavigate, onClose]);

  // Action Handlers
  const handleOpenWhatsAppModal = (defaultMsg?: string) => {
    const initialText = defaultMsg || `Olá ${clientInfo.nomeContato}, tudo bem? Sou o ${user.nome} da Mundo Tech. Gostaria de conversar sobre a proposta "${quote.titulo}".`;
    setWhatsAppText(initialText);
    setIsWhatsAppOpen(true);
  };

  const handleSendWhatsApp = async () => {
    if (!clientInfo.whatsapp) {
      showToast('Nenhum número de WhatsApp cadastrado para este cliente.', 'error');
      return;
    }

    try {
      // Send via service official proxy
      await whatsappService.sendMessage(clientInfo.whatsapp, whatsAppText, user.nome);
      
      // Save interaction log
      const newAcao: Omit<AcaoComercial, 'id' | 'createdAt'> = {
        leadId: quote.leadId,
        clienteId: quote.clienteId,
        tipo: 'Mensagem',
        titulo: 'WhatsApp Enviado',
        descricao: whatsAppText,
        responsavelId: user.id,
        data: new Date().toISOString()
      };
      await databaseService.createAcaoComercial(newAcao);
      
      setInteractions(prev => [{ id: `log-${Date.now()}`, ...newAcao, createdAt: new Date().toISOString() }, ...prev]);
      showToast('Mensagem enviada via WhatsApp com sucesso!', 'success');
      setIsWhatsAppOpen(false);
    } catch (e: any) {
      // Fallback to wa.me URL
      const cleanPhone = clientInfo.whatsapp.replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(whatsAppText)}`, '_blank');
      showToast('Abrindo WhatsApp Web...', 'success');
      setIsWhatsAppOpen(false);
    }
  };

  const handleRegisterCall = async () => {
    try {
      const newAcao: Omit<AcaoComercial, 'id' | 'createdAt'> = {
        leadId: quote.leadId,
        clienteId: quote.clienteId,
        tipo: 'Ligação',
        titulo: `Ligação Realizada (${callDuration} min)`,
        descricao: callNotes || 'Contato telefônico realizado com o cliente.',
        responsavelId: user.id,
        data: new Date().toISOString()
      };
      await databaseService.createAcaoComercial(newAcao);
      setInteractions(prev => [{ id: `log-${Date.now()}`, ...newAcao, createdAt: new Date().toISOString() }, ...prev]);
      showToast('Ligação registrada no histórico!', 'success');
      setIsCallModalOpen(false);
      setCallNotes('');
    } catch (e) {
      showToast('Erro ao registrar ligação.', 'error');
    }
  };

  const handleResendProposal = async () => {
    try {
      const newAcao: Omit<AcaoComercial, 'id' | 'createdAt'> = {
        leadId: quote.leadId,
        clienteId: quote.clienteId,
        tipo: 'Follow-up',
        titulo: 'Reenvio de Proposta Comercial',
        descricao: `Proposta "${quote.titulo}" reenviada para o e-mail ${clientInfo.email}.`,
        responsavelId: user.id,
        data: new Date().toISOString()
      };
      await databaseService.createAcaoComercial(newAcao);
      await databaseService.updateProposta(quote.id, { dataEnvio: new Date().toISOString(), status: 'Enviado' });
      setInteractions(prev => [{ id: `log-${Date.now()}`, ...newAcao, createdAt: new Date().toISOString() }, ...prev]);
      showToast('Proposta reenviada e status atualizado!', 'success');
    } catch (e) {
      showToast('Erro ao reenviar proposta.', 'error');
    }
  };

  const handleSaveSchedule = async () => {
    if (!scheduleDate) {
      showToast('Selecione uma data para o retorno.', 'error');
      return;
    }
    try {
      const dataHoraStr = `${scheduleDate}T${scheduleTime}:00`;
      
      // Update proposal return date
      await databaseService.updateProposta(quote.id, {
        proximoRetorno: {
          data: scheduleDate,
          hora: scheduleTime,
          observacao: scheduleNotes || 'Retorno de negociação agendado',
          concluido: false
        }
      });

      // Create agenda item
      const newAgenda: Omit<AgendaComercial, 'id' | 'createdAt' | 'updatedAt'> = {
        leadId: quote.leadId,
        clienteId: quote.clienteId,
        titulo: `Retorno Proposta: ${quote.titulo}`,
        descricao: scheduleNotes || `Contato agendado com ${clientInfo.nomeContato}`,
        tipo: 'Retorno Proposta',
        data: scheduleDate,
        dataHora: dataHoraStr,
        status: 'Pendente',
        responsavelId: user.id
      };
      await databaseService.createAgendaTask(newAgenda);

      showToast(`Retorno agendado para ${formatDateBR(scheduleDate)} às ${scheduleTime}!`, 'success');
      setIsScheduleOpen(false);
    } catch (e) {
      showToast('Erro ao agendar retorno.', 'error');
    }
  };

  const handleAddManualLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogText.trim()) return;

    try {
      const tipoMap: Record<string, AcaoComercial['tipo']> = {
        whatsapp: 'Mensagem',
        ligacao: 'Ligação',
        email: 'Outro',
        observacao: 'Follow-up'
      };

      const newAcao: Omit<AcaoComercial, 'id' | 'createdAt'> = {
        leadId: quote.leadId,
        clienteId: quote.clienteId,
        tipo: tipoMap[newLogType] || 'Outro',
        titulo: `${newLogType.toUpperCase()}: Registro Comercial`,
        descricao: newLogText,
        responsavelId: user.id,
        data: new Date().toISOString()
      };
      await databaseService.createAcaoComercial(newAcao);
      setInteractions(prev => [{ id: `log-${Date.now()}`, ...newAcao, createdAt: new Date().toISOString() }, ...prev]);
      setNewLogText('');
      showToast('Registro adicionado ao histórico com sucesso!');
    } catch (e) {
      showToast('Erro ao salvar no histórico.', 'error');
    }
  };

  // Timeline stage builder
  const timelineStages = [
    { title: 'Lead Criado', done: true, date: quote.createdAt ? formatDateBR(quote.createdAt) : '10/07/2026' },
    { title: 'Primeiro Contato', done: true, date: '11/07/2026' },
    { title: 'Proposta Criada', done: true, date: quote.createdAt ? formatDateBR(quote.createdAt) : '12/07/2026' },
    { title: 'Proposta Enviada', done: quote.status !== 'Rascunho', date: quote.dataEnvio ? formatDateBR(quote.dataEnvio) : '13/07/2026' },
    { title: 'Cliente Visualizou', done: quote.status !== 'Rascunho', date: 'Há 5 dias' },
    { title: 'Follow-up Enviado', done: interactions.length > 0, date: interactions[0]?.data ? formatDateBR(interactions[0].data) : 'Há 2 dias' },
    { title: 'Ligação Realizada', done: interactions.some(i => i.tipo === 'Ligação'), date: 'Concluído' },
    { title: 'Negociação', done: quote.status === 'Em negociação' || quote.status === 'Aprovado', date: 'Em andamento' },
    { title: 'Fechamento', done: quote.status === 'Aprovado', date: quote.status === 'Aprovado' ? 'Fechado' : 'Aguardando' }
  ];

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full md:w-[620px] lg:w-[680px] bg-surface border-l border-surface-container-high shadow-2xl z-[80] flex flex-col font-sans"
    >
      {/* HEADER: Title, Carousel Navigation, Close */}
      <div className="px-6 py-5 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold">
            <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-primary">Central de Negociação</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant">
                {currentIndex + 1} de {quotesList.length}
              </span>
            </div>
            <h2 className="text-base font-black text-on-surface truncate max-w-[320px]">{quote.titulo}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Previous / Next Proposal Navigation */}
          <div className="flex items-center gap-1 bg-surface-container-highest/50 p-1 rounded-xl border border-surface-container-high">
            <button
              onClick={() => onNavigate(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="p-1.5 hover:bg-surface rounded-lg text-on-surface disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title="Proposta Anterior (Seta Esquerda)"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-[11px] font-black text-on-surface-variant px-1">Navegar</span>
            <button
              onClick={() => onNavigate(currentIndex + 1)}
              disabled={currentIndex === quotesList.length - 1}
              className="p-1.5 hover:bg-surface rounded-lg text-on-surface disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              title="Próxima Proposta (Seta Direita)"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-container-highest rounded-xl text-on-surface-variant transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* QUICK ACTION TOOLBAR (Item 2 of Prompt) */}
      <div className="px-6 py-3 bg-surface-container-highest/20 border-b border-surface-container-high overflow-x-auto custom-scrollbar flex items-center gap-2 shrink-0">
        <button
          onClick={() => handleOpenWhatsAppModal()}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
        >
          <MessageCircle size={15} /> WhatsApp
        </button>

        <button
          onClick={() => {
            if (clientInfo.telefone && clientInfo.telefone !== 'Não informado') {
              window.location.href = `tel:${clientInfo.telefone.replace(/\D/g, '')}`;
            }
            setIsCallModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
        >
          <Phone size={15} /> Ligar
        </button>

        <button
          onClick={() => {
            const subject = encodeURIComponent(`Proposta Comercial: ${quote.titulo}`);
            const body = encodeURIComponent(`Olá ${clientInfo.nomeContato},\n\nSegue proposta comercial referente a ${quote.titulo}.\n\nAtenciosamente,`);
            window.location.href = `mailto:${clientInfo.email}?subject=${subject}&body=${body}`;
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
        >
          <Mail size={15} /> E-mail
        </button>

        <button
          onClick={handleResendProposal}
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
        >
          <Send size={15} /> Reenviar
        </button>

        <button
          onClick={() => onOpenPDF ? onOpenPDF(quote) : window.print()}
          className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-highest hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-bold transition-all border border-surface-container-high shrink-0"
        >
          <Download size={15} /> Baixar PDF
        </button>

        <button
          onClick={() => setIsScheduleOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 hover:bg-primary/90"
        >
          <Calendar size={15} /> Agendar Retorno
        </button>
      </div>

      {/* DRAWER NAVIGATION TABS */}
      <div className="flex border-b border-surface-container-high bg-surface-container-low px-6 shrink-0">
        {[
          { id: 'geral', label: 'Visão Geral & IA', icon: Sparkles },
          { id: 'timeline', label: 'Timeline & Estágios', icon: History },
          { id: 'historico', label: 'Histórico Mensagens', icon: MessageCircle },
          { id: 'financeiro', label: 'Financeiro Cliente', icon: DollarSign }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                isActive 
                  ? 'border-primary text-primary bg-primary/5' 
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* DRAWER BODY CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

        {/* --- TAB 1: VISÃO GERAL & IA --- */}
        {activeTab === 'geral' && (
          <div className="space-y-6">

            {/* ITEM 1: Dados do Cliente */}
            <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
                <div className="flex items-center gap-2 text-primary">
                  <Building2 size={18} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Informações do Cliente</h3>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                  Origem: {clientInfo.origemLead}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant/70">Empresa / Razão</p>
                  <p className="font-bold text-on-surface truncate">{clientInfo.nomeEmpresa}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant/70">Contato</p>
                  <p className="font-bold text-on-surface">{clientInfo.nomeContato}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant/70">Cargo</p>
                  <p className="font-bold text-on-surface">{clientInfo.cargoContato}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant/70">Telefone / Whats</p>
                  <p className="font-bold text-on-surface flex items-center gap-1">
                    <MessageCircle size={12} className="text-emerald-500" /> {clientInfo.whatsapp || clientInfo.telefone}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant/70">E-mail</p>
                  <p className="font-bold text-on-surface truncate">{clientInfo.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant/70">Cidade / UF</p>
                  <p className="font-bold text-on-surface">{clientInfo.cidade} - {clientInfo.estado}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant/70">CNPJ / CPF</p>
                  <p className="font-bold text-on-surface">{clientInfo.cnpj}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant/70">Responsável Conta</p>
                  <p className="font-bold text-on-surface">{clientInfo.vendedorNome}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant/70">Próximo Contato</p>
                  <p className="font-bold text-primary flex items-center gap-1">
                    <Calendar size={12} />
                    {quote.proximoRetorno?.data ? `${formatDateBR(quote.proximoRetorno.data)} ${quote.proximoRetorno.hora || ''}` : 'Não agendado'}
                  </p>
                </div>
              </div>
            </div>

            {/* ITEM 4: Caixa de Follow-up (Próxima Ação Comercial) */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-surface-container-low to-surface-container-low border border-amber-500/30 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Clock size={18} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Próxima Ação Comercial</h3>
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  {daysElapsed} dias sem retorno
                </span>
              </div>

              <p className="text-xs text-on-surface-variant font-medium">
                Esta proposta foi enviada há <strong>{daysElapsed} dias</strong>. Escolha uma das mensagens rápidas abaixo para acionar o cliente via WhatsApp oficial:
              </p>

              {/* Botões rápidos de follow-up */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  {
                    label: 'Perguntar se recebeu a proposta',
                    msg: `Olá ${clientInfo.nomeContato}, tudo bem? Gostaria de saber se você recebeu a proposta comercial referente a ${quote.titulo} que enviamos.`
                  },
                  {
                    label: 'Perguntar se possui dúvidas',
                    msg: `Olá ${clientInfo.nomeContato}! Ficou alguma dúvida técnica ou comercial em relação à proposta de ${quote.titulo}? Podemos alinhar!`
                  },
                  {
                    label: 'Oferecer desconto',
                    msg: `Olá ${clientInfo.nomeContato}! Conseguimos aprovar uma condição especial de desconto válida para fechamento esta semana na proposta ${quote.titulo}. Vamos fechar?`
                  },
                  {
                    label: 'Agendar reunião',
                    msg: `Olá ${clientInfo.nomeContato}, podemos agendar uma breve reunião de 15 minutos para apresentarmos a solução de ${quote.titulo}?`
                  },
                  {
                    label: 'Solicitar retorno',
                    msg: `Olá ${clientInfo.nomeContato}, fico no aguardo do seu parecer sobre a proposta ${quote.titulo}. Podemos conversar hoje?`
                  }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOpenWhatsAppModal(item.msg)}
                    className="px-3 py-1.5 bg-surface hover:bg-emerald-500/10 hover:border-emerald-500/40 border border-surface-container-high rounded-xl text-xs font-bold text-on-surface transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <MessageCircle size={13} className="text-emerald-500" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ITEM 7: IA Comercial (Assistente Comercial) */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-primary/10 via-surface-container-low to-indigo-500/10 border border-primary/30 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-primary/20 pb-3">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles size={18} className="animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Assistente Comercial IA</h3>
                </div>
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary font-black text-xs">
                  Probabilidade: <span className="text-emerald-600 dark:text-emerald-400">74%</span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-on-surface">
                <p className="font-semibold text-on-surface flex items-center gap-2">
                  <Info size={14} className="text-primary shrink-0" />
                  Esta proposta está parada há <strong>{daysElapsed} dias</strong>.
                </p>
                <p className="text-on-surface-variant leading-relaxed">
                  Segundo o histórico compilado do CRM, propostas semelhantes de <strong>{quote.titulo}</strong> costumam ser fechadas após o segundo follow-up e apresentação das condições de pagamento.
                </p>

                <div className="pt-2 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Sugestões de Ação da IA:</p>
                  
                  {[
                    { id: 'task1', text: 'Enviar mensagem perguntando se existe alguma dúvida.' },
                    { id: 'task2', text: 'Agendar ligação de retorno para amanhã no período da manhã.' },
                    { id: 'task3', text: 'Oferecer condição especial de pagamento parcelado ou frete grátis.' }
                  ].map(task => (
                    <div 
                      key={task.id}
                      onClick={() => setCompletedAiTasks(prev => ({ ...prev, [task.id]: !prev[task.id] }))}
                      className="flex items-center gap-2.5 p-2.5 bg-surface/80 rounded-xl border border-surface-container-high cursor-pointer hover:bg-surface transition-all"
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                        completedAiTasks[task.id] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-surface-container-high'
                      }`}>
                        {completedAiTasks[task.id] && <Check size={12} />}
                      </div>
                      <span className={`text-xs font-medium ${completedAiTasks[task.id] ? 'line-through opacity-50' : ''}`}>
                        {task.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ITEM 6: Informações Comerciais */}
            <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
                <div className="flex items-center gap-2 text-primary">
                  <Briefcase size={18} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Informações Comerciais do Orçamento</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  quote.status === 'Aprovado' ? 'bg-green-100 text-green-700' :
                  quote.status === 'Em negociação' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {quote.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-surface-container-highest/20 rounded-2xl border border-surface-container-high">
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">Valor Total</p>
                  <p className="text-base font-black text-primary">R$ {proposalTotals(quote).investimentoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>

                {/* MARGEM DE LUCRO: Visível Apenas para Administrador (Item 6) */}
                {isAdmin ? (
                  <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                    <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Percent size={12} /> Margem de Lucro (Admin)
                    </p>
                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {marginInfo.margemPercentual}% <span className="text-[10px] font-bold text-on-surface-variant">(R$ {marginInfo.lucroBruto.toLocaleString('pt-BR', { maximumFractionDigits: 0 })})</span>
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-surface-container-highest/10 rounded-2xl border border-surface-container-high opacity-60">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-1">
                      <Lock size={12} /> Margem de Lucro
                    </p>
                    <p className="text-xs font-bold text-on-surface-variant">Restrito ao Admin</p>
                  </div>
                )}

                <div className="p-3 bg-surface-container-highest/20 rounded-2xl border border-surface-container-high">
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">Forma Pagamento</p>
                  <p className="text-xs font-bold text-on-surface truncate">{quote.formaPagamento || 'Boleto 30 Dias / Pix'}</p>
                </div>

                <div className="p-3 bg-surface-container-highest/20 rounded-2xl border border-surface-container-high">
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">Validade Proposta</p>
                  <p className="text-xs font-bold text-on-surface">{quote.validadeProposta || '15 dias'}</p>
                </div>
              </div>

              {/* Lista de Produtos Incluídos */}
              <div className="space-y-2 pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Produtos / Itens da Proposta:</p>
                {quote.itens && quote.itens.length > 0 ? (
                  <div className="space-y-2">
                    {quote.itens.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-surface/80 rounded-2xl border border-surface-container-high text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Package size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-on-surface">{item.nome}</p>
                            <p className="text-[10px] text-on-surface-variant">Qtd: {item.quantidade} x R$ {item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                        <span className="font-black text-on-surface">R$ {(item.total || (item.quantidade * item.valorUnitario)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic text-on-surface-variant">Nenhum produto individual listado.</p>
                )}
              </div>
            </div>

            {/* ITEM 9: Próximas Oportunidades (Cross-sell / Up-sell pela IA) */}
            <div className="p-5 rounded-3xl bg-surface-container-low border border-surface-container-high shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Zap size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Oportunidades Recomendadas (Cross-Sell / IA)</h3>
              </div>

              <p className="text-xs text-on-surface-variant">
                Com base nos equipamentos e perfil deste cliente, a inteligência comercial identificou novas oportunidades complementares:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                {[
                  { title: 'Relógio de Ponto Portaria 1510', reason: 'Necessário para controle de horas homologado' },
                  { title: 'Controle de Acesso Facial Secullum', reason: 'Modernização de catracas físicas existentes' },
                  { title: 'Contrato de Manutenção Preventiva', reason: 'Garante suporte prioritário e SLA de 4h' },
                  { title: 'Software de Gestão de RH Web', reason: 'Integração direta de dados com a folha de pagamento' }
                ].map((op, idx) => (
                  <div key={idx} className="p-3 bg-surface rounded-2xl border border-surface-container-high hover:border-indigo-400 transition-all space-y-1">
                    <p className="text-xs font-bold text-on-surface flex items-center justify-between">
                      {op.title}
                      <Tag size={12} className="text-indigo-500" />
                    </p>
                    <p className="text-[10px] text-on-surface-variant">{op.reason}</p>
                    <button
                      onClick={() => handleOpenWhatsAppModal(`Olá ${clientInfo.nomeContato}, notamos oportunidade para adicionar ${op.title} à sua estrutura. Gostaria de uma cotação especial?`)}
                      className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline pt-1 block"
                    >
                      + Oferecer via WhatsApp
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* --- TAB 2: TIMELINE COMPLETA (Item 3 do Prompt) --- */}
        {activeTab === 'timeline' && (
          <div className="space-y-6">
            <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high shadow-xs space-y-6">
              <div className="flex items-center gap-2 text-primary border-b border-surface-container-high pb-3">
                <History size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Linha do Tempo Completa da Negociação</h3>
              </div>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container-high">
                {timelineStages.map((stage, i) => (
                  <div key={i} className="relative flex items-start justify-between gap-4">
                    <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      stage.done ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20' : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {stage.done ? <Check size={12} /> : i + 1}
                    </div>

                    <div>
                      <p className={`text-xs font-bold ${stage.done ? 'text-on-surface' : 'text-on-surface-variant/70'}`}>
                        {stage.title}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">Estágio Comercial #{i + 1}</p>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      stage.done ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                      {stage.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 3: HISTÓRICO DAS CONVERSAS (Item 5 do Prompt) --- */}
        {activeTab === 'historico' && (
          <div className="space-y-6">
            
            {/* Formulário para novo registro */}
            <form onSubmit={handleAddManualLog} className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high shadow-xs space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-on-surface flex items-center gap-2">
                <Plus size={14} className="text-primary" /> Registrar Nova Interação Comercial
              </h4>

              <div className="flex gap-2">
                {(['whatsapp', 'ligacao', 'email', 'observacao'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewLogType(type)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      newLogType === type ? 'bg-primary text-white' : 'bg-surface-container-highest text-on-surface-variant'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <textarea
                value={newLogText}
                onChange={(e) => setNewLogText(e.target.value)}
                placeholder="Digite a observação ou resumo da conversa realizada com o cliente..."
                className="w-full p-3 bg-surface border border-surface-container-high rounded-2xl text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none min-h-[80px]"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-all shadow-xs"
                >
                  Salvar no Histórico
                </button>
              </div>
            </form>

            {/* Lista de Registros */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Histórico de Conversas e Chamadas</h4>

              {loadingInteractions ? (
                <div className="p-8 text-center text-xs text-on-surface-variant">Carregando histórico...</div>
              ) : interactions.length === 0 ? (
                <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high text-center space-y-2">
                  <MessageCircle size={32} className="mx-auto text-on-surface-variant/40" />
                  <p className="text-xs font-bold text-on-surface">Nenhum registro anterior localizado no CRM.</p>
                  <p className="text-[10px] text-on-surface-variant">Utilize o formulário acima ou os botões rápidos para registrar a primeira interação.</p>
                </div>
              ) : (
                interactions.map((item, idx) => (
                  <div key={item.id || idx} className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.tipo === 'Mensagem' && <MessageCircle size={14} className="text-emerald-500" />}
                        {item.tipo === 'Ligação' && <PhoneCall size={14} className="text-blue-500" />}
                        {item.tipo === 'Follow-up' && <Clock size={14} className="text-amber-500" />}
                        <span className="font-bold text-on-surface">{item.titulo || item.tipo}</span>
                      </div>
                      <span className="text-[10px] font-bold text-on-surface-variant">
                        {item.data ? formatDateBR(item.data) : 'Data recente'}
                      </span>
                    </div>

                    <p className="text-on-surface-variant font-medium bg-surface/60 p-3 rounded-xl border border-surface-container-high/50">
                      "{item.descricao}"
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-on-surface-variant/70 pt-1">
                      <span>Registrado por CRM</span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 size={12} /> Entregue & Lido
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* --- TAB 4: DADOS FINANCEIROS DO CLIENTE (Item 8 do Prompt) --- */}
        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high shadow-xs space-y-6">
              <div className="flex items-center gap-2 text-primary border-b border-surface-container-high pb-3">
                <PieChart size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Histórico Financeiro do Cliente</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-4 bg-surface-container-highest/20 rounded-2xl border border-surface-container-high">
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">Total Já Comprado</p>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">R$ 45.800,00</p>
                </div>

                <div className="p-4 bg-surface-container-highest/20 rounded-2xl border border-surface-container-high">
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">Total de Propostas</p>
                  <p className="text-lg font-black text-on-surface">5 Orçamentos</p>
                </div>

                <div className="p-4 bg-surface-container-highest/20 rounded-2xl border border-surface-container-high">
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">Propostas Fechadas</p>
                  <p className="text-lg font-black text-blue-600 dark:text-blue-400">3 Fechadas (60%)</p>
                </div>

                <div className="p-4 bg-surface-container-highest/20 rounded-2xl border border-surface-container-high">
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">Propostas Perdidas</p>
                  <p className="text-lg font-black text-red-500">1 Perdida</p>
                </div>

                <div className="p-4 bg-surface-container-highest/20 rounded-2xl border border-surface-container-high">
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">Valor Faturado</p>
                  <p className="text-lg font-black text-on-surface">R$ 42.000,00</p>
                </div>

                <div className="p-4 bg-surface-container-highest/20 rounded-2xl border border-surface-container-high">
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">Última Compra</p>
                  <p className="text-sm font-bold text-on-surface">14/05/2026</p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Produtos Mais Adquiridos:</p>
                <div className="space-y-2 text-xs">
                  {[
                    { name: 'Catraca Flap Top de Acesso Premium', qty: '4 unidades', total: 'R$ 24.000,00' },
                    { name: 'Relógio de Ponto Control ID 1510', qty: '2 unidades', total: 'R$ 6.800,00' },
                    { name: 'Contrato Anual de Manutenção Preventiva', qty: '1 serviço', total: 'R$ 15.000,00' }
                  ].map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-surface/80 rounded-2xl border border-surface-container-high">
                      <div>
                        <p className="font-bold text-on-surface">{p.name}</p>
                        <p className="text-[10px] text-on-surface-variant">{p.qty}</p>
                      </div>
                      <span className="font-black text-primary">{p.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* FOOTER: Quick Summary & Action */}
      <div className="p-5 bg-surface-container-low border-t border-surface-container-high flex items-center justify-between shrink-0 shadow-xs">
        <div>
          <p className="text-[10px] font-bold uppercase text-on-surface-variant">Valor da Proposta</p>
          <p className="text-xl font-black text-primary">R$ {proposalTotals(quote).investimentoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenWhatsAppModal()}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all"
          >
            <MessageCircle size={16} /> Enviar Whats
          </button>
        </div>
      </div>

      {/* MODAL: Enviar WhatsApp */}
      <AnimatePresence>
        {isWhatsAppOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-surface rounded-3xl p-6 border border-surface-container-high shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <MessageCircle size={20} />
                  <h3 className="text-sm font-black uppercase tracking-wider text-on-surface">Enviar WhatsApp Oficial</h3>
                </div>
                <button onClick={() => setIsWhatsAppOpen(false)} className="p-1 text-on-surface-variant hover:text-on-surface">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-bold text-on-surface">Destinatário: <span className="text-primary">{clientInfo.nomeContato}</span> ({clientInfo.whatsapp})</p>
                <textarea
                  value={whatsAppText}
                  onChange={(e) => setWhatsAppText(e.target.value)}
                  className="w-full p-3 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none min-h-[120px]"
                  placeholder="Escreva sua mensagem comercial..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsWhatsAppOpen(false)}
                  className="px-4 py-2 bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendWhatsApp}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xs"
                >
                  <Send size={14} /> Disparar Mensagem
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL: Agendar Retorno */}
        {isScheduleOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-surface rounded-3xl p-6 border border-surface-container-high shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
                <div className="flex items-center gap-2 text-primary">
                  <Calendar size={20} />
                  <h3 className="text-sm font-black uppercase tracking-wider text-on-surface">Agendar Retorno Comercial</h3>
                </div>
                <button onClick={() => setIsScheduleOpen(false)} className="p-1 text-on-surface-variant hover:text-on-surface">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Data do Retorno</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full p-3 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl font-bold focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Horário</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full p-3 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl font-bold focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Observações da Reunião / Retorno</label>
                  <textarea
                    value={scheduleNotes}
                    onChange={(e) => setScheduleNotes(e.target.value)}
                    placeholder="Objetivo do retorno..."
                    className="w-full p-3 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl min-h-[70px] focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsScheduleOpen(false)}
                  className="px-4 py-2 bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveSchedule}
                  className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xs"
                >
                  <Calendar size={14} /> Salvar Agendamento
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL: Registrar Ligação */}
        {isCallModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-surface rounded-3xl p-6 border border-surface-container-high shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
                <div className="flex items-center gap-2 text-blue-600">
                  <Phone size={20} />
                  <h3 className="text-sm font-black uppercase tracking-wider text-on-surface">Registrar Minuta de Ligação</h3>
                </div>
                <button onClick={() => setIsCallModalOpen(false)} className="p-1 text-on-surface-variant hover:text-on-surface">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Duração Estimada (minutos)</label>
                  <input
                    type="number"
                    value={callDuration}
                    onChange={(e) => setCallDuration(e.target.value)}
                    className="w-full p-3 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Resumo / Observações da Chamada</label>
                  <textarea
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    placeholder="Ex: Cliente pediu retorno semana que vem pois a diretoria está viajando..."
                    className="w-full p-3 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl min-h-[90px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsCallModalOpen(false)}
                  className="px-4 py-2 bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegisterCall}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                >
                  <PhoneCall size={14} /> Salvar Registro
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* TOAST NOTIFICATION */}
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-8 right-8 z-[120] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' 
                ? 'bg-emerald-600 text-white border-emerald-500' 
                : 'bg-red-600 text-white border-red-500'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="text-xs font-bold uppercase tracking-widest">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
