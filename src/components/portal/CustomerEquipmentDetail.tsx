import React, { useState, useEffect } from 'react';
import { 
  X, 
  Wrench, 
  History as HistoryIcon, 
  FileText, 
  Activity, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Plus,
  Paperclip,
  Check,
  ShieldCheck,
  Info,
  ShieldAlert,
  FileSpreadsheet,
  Briefcase
} from 'lucide-react';
import { User, EquipamentoCliente, Chamado } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';

const getTicketStatusLabel = (status: string) => {
  switch (status) {
    case 'aberto':
    case 'novo':
      return 'Aberto';
    case 'em_atendimento':
    case 'em_andamento':
      return 'Em Atendimento';
    case 'aguardando_peca':
      return 'Aguardando Peça';
    case 'suspenso':
      return 'Suspenso';
    case 'cancelado':
      return 'Cancelado';
    case 'concluido':
    case 'finalizado':
      return 'Finalizado';
    default:
      return status || 'Em andamento';
  }
};

const getTicketStatusBadgeStyle = (status: string) => {
  switch (status) {
    case 'concluido':
    case 'finalizado':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'cancelado':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'aguardando_peca':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'em_atendimento':
    case 'em_andamento':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-primary/5 text-primary border-primary/20';
  }
};

const getTicketGarantiaLabel = (ticket: any) => {
  const g = ticket.atendimentoGarantia !== undefined ? ticket.atendimentoGarantia :
            ticket.emGarantia !== undefined ? ticket.emGarantia :
            ticket.isGarantia !== undefined ? ticket.isGarantia : undefined;
            
  if (g === true || g === 'Sim') return 'Sim (Sob Garantia)';
  if (g === false || g === 'Não') return 'Não';
  return 'Não informado';
};

const getTicketGarantiaBadgeStyle = (ticket: any) => {
  const label = getTicketGarantiaLabel(ticket);
  if (label.includes('Sob Garantia')) {
    return 'bg-green-50 text-green-700 border-green-100';
  }
  return 'bg-gray-50 text-gray-700 border-gray-100';
};

interface CustomerEquipmentDetailProps {
  user: User;
  equipmentId: string;
  onBack: () => void;
  onOpenTicket: (data: any) => void;
}

export default function CustomerEquipmentDetail({ user, equipmentId, onBack, onOpenTicket }: CustomerEquipmentDetailProps) {
  const [equipment, setEquipment] = useState<EquipamentoCliente | null>(null);
  const [history, setHistory] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'docs'>('history');

  useEffect(() => {
    const loadData = async () => {
      try {
        const eqData = await databaseService.getEquipamentoClienteById(equipmentId);

        if (eqData && eqData.clienteId === user.clienteId) {
          setEquipment(eqData);
          
          let histData: Chamado[] = [];
          if (eqData.numeroSerie) {
            histData = await databaseService.getChamadosBySerialNumber(eqData.numeroSerie) || [];
          } else {
            histData = await databaseService.getChamadosByEquipamentoCliente(equipmentId) || [];
          }

          // Strict Isolation: Ensure the customer only sees tickets belonging to their own company
          const secureHistory = histData.filter(h => h.clienteId === user.clienteId);
          setHistory(secureHistory);
        }
      } catch (err) {
        console.error('Error loading equipment detail and history:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [equipmentId, user.clienteId]);

  if (loading) {
    return (
      <div className="p-20 flex justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="text-primary"
          >
            <Activity size={40} />
          </motion.div>
          <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Carregando detalhes...</p>
        </div>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="p-20 text-center">
        <h3 className="text-xl font-black uppercase tracking-tight text-on-surface">Equipamento não encontrado</h3>
        <button onClick={onBack} className="mt-4 text-primary font-bold hover:underline">Voltar</button>
      </div>
    );
  }

  const openTicket = () => {
    onOpenTicket({
      equipamentoClienteId: equipment.id,
      unidadeId: equipment.unidadeId,
      titulo: `Suporte para ${equipment.modelo}`,
      descricao: `Solicitação de suporte para o equipamento ${equipment.tipo} - ${equipment.modelo} (S/N: ${equipment.numeroSerie})`,
      tipoAtendimento: 'Corretiva'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Em operação': return 'bg-green-500';
      case 'Em manutenção': return 'bg-orange-500';
      case 'Com falha': return 'bg-red-500';
      case 'Desativado': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const finishedTickets = history.filter(h => h.status === 'concluido' || h.status === 'finalizado');
  const openTickets = history.filter(h => h.status !== 'concluido' && h.status !== 'finalizado' && h.status !== 'cancelado');

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-on-surface">{equipment.modelo}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-black uppercase tracking-widest text-primary">{equipment.tipo}</span>
              <span className="text-xs font-bold text-on-surface-variant opacity-50">•</span>
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">S/N: {equipment.numeroSerie}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openTicket}
            className="px-6 py-3 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2"
          >
            <Plus size={16} />
            Abrir Chamado
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lado Esquerdo: Cards de Status e Resumo */}
        <div className="space-y-6">
          <section className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
              <ShieldCheck size={16} />
              Resumo Técnico
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-surface-container-highest/20 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Activity size={18} className="text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status Atual</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white ${getStatusColor(equipment.status)}`}>
                  {equipment.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface-container-highest/20 rounded-2xl space-y-1">
                  <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant">Instalação</p>
                  <p className="text-xs font-bold text-on-surface">
                    {equipment.dataInstalacao ? new Date(equipment.dataInstalacao).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
                <div className="p-4 bg-surface-container-highest/20 rounded-2xl space-y-1">
                  <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant">Última Manut.</p>
                  <p className="text-xs font-bold text-on-surface">
                    {equipment.dataUltimaManutencao ? new Date(equipment.dataUltimaManutencao).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-primary mb-1">Próxima Preventiva</p>
                  <p className="text-sm font-black text-primary">
                    {equipment.dataProximaPreventiva ? new Date(equipment.dataProximaPreventiva).toLocaleDateString('pt-BR') : 'Não agendada'}
                  </p>
                </div>
                <Calendar size={24} className="text-primary/30" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-surface-container-low border border-surface-container-high rounded-xl text-center">
                  <p className="text-[18px] font-black text-on-surface leading-none">{history.length}</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant mt-1 text-center">Total</p>
                </div>
                <div className="p-3 bg-surface-container-low border border-surface-container-high rounded-xl text-center">
                  <p className="text-[18px] font-black text-primary leading-none">{openTickets.length}</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant mt-1">Abertos</p>
                </div>
                <div className="p-3 bg-surface-container-low border border-surface-container-high rounded-xl text-center">
                  <p className="text-[18px] font-black text-green-600 leading-none">{finishedTickets.length}</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant mt-1">Finais</p>
                </div>
              </div>
            </div>
          </section>

          {equipment.observacoesTecnicas && (
            <section className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                <Info size={16} />
                Observações Técnicas
              </h3>
              <p className="text-xs font-medium text-on-surface-variant leading-relaxed italic">
                "{equipment.observacoesTecnicas}"
              </p>
            </section>
          )}
        </div>

        {/* Lado Direito: Timeline e Abas */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-container-low p-2 rounded-[32px] border border-surface-container-high flex gap-1">
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-4 px-6 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                activeTab === 'history' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <HistoryIcon size={16} />
              Histórico do Equipamento
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`flex-1 py-4 px-6 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                activeTab === 'docs' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <FileText size={16} />
              Documentos Técnicos
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'history' ? (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {history.length === 0 ? (
                  <div className="bg-surface-container-low p-20 rounded-[40px] border border-surface-container-high text-center">
                    <HistoryIcon size={48} className="mx-auto text-on-surface-variant/20 mb-4" />
                    <h3 className="text-lg font-black uppercase text-on-surface">Sem histórico registrado</h3>
                    <p className="text-sm font-medium text-on-surface-variant">Nenhum atendimento foi realizado para este equipamento até o momento.</p>
                  </div>
                ) : (
                  <div className="relative space-y-8 before:absolute before:left-8 before:top-2 before:bottom-2 before:w-px before:bg-surface-container-high">
                    {history.map((ticket, idx) => (
                      <div key={ticket.id} className="relative pl-16">
                        <div className={`absolute left-[30px] top-0 w-1 h-1 rounded-full bg-primary ring-8 ring-primary/5`} />
                        <div className="bg-surface-container-low p-8 rounded-[32px] border border-surface-container-high shadow-sm hover:shadow-md transition-all">
                          {/* Cabeçalho do Chamado: Protocolo, Abertura, Status, Garantia */}
                          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-container-high">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-surface-container-highest/30 flex items-center justify-center text-primary">
                                <Clock size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-black text-on-surface">
                                  {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
                                </p>
                                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Protocolo: {ticket.protocolo || ticket.id.slice(0, 8)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Atendimento em Garantia */}
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getTicketGarantiaBadgeStyle(ticket)}`}>
                                Garantia: {getTicketGarantiaLabel(ticket)}
                              </span>
                              {/* Status do Atendimento */}
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getTicketStatusBadgeStyle(ticket.status)}`}>
                                {getTicketStatusLabel(ticket.status)}
                              </span>
                            </div>
                          </div>

                          {/* Grid Principal de Conteúdo (14 Campos solicitados) */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                            
                            {/* Coluna Esquerda: Diagnóstico & Atendimento */}
                            <div className="space-y-6">
                              {/* Técnico Responsável */}
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Técnico Responsável</p>
                                <p className="text-sm font-bold text-on-surface">{ticket.tecnico?.nome || (ticket as any).tecnicoNome || 'Equipe Mundo Tech'}</p>
                              </div>

                              {/* Problema Relatado */}
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Problema Relatado</p>
                                <p className="text-xs font-medium text-on-surface-variant leading-relaxed bg-surface-container-highest/10 p-3 rounded-xl border border-surface-container-high/30">
                                  {ticket.descricao || 'Não informado'}
                                </p>
                              </div>

                              {/* Diagnóstico Técnico Liberado */}
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Diagnóstico Técnico Liberado</p>
                                <p className="text-xs font-medium text-on-surface-variant leading-relaxed bg-surface-container-highest/10 p-3 rounded-xl border border-surface-container-high/30 italic">
                                  "{(ticket as any).diagnosticoTecnico || ticket.observacoesTecnicas || 'Não informado'}"
                                </p>
                              </div>

                              {/* Serviço Realizado */}
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-green-600 mb-1">Serviço Realizado</p>
                                <p className="text-xs font-medium text-on-surface-variant leading-relaxed bg-green-50/10 p-3 rounded-xl border border-green-100/20">
                                  {ticket.servicoExecutado || ticket.solucaoAplicada || 'Não informado'}
                                </p>
                              </div>
                            </div>

                            {/* Coluna Direita: Peças, Datas & Documentos */}
                            <div className="space-y-6">
                              
                              {/* Datas do Conserto e Devolução */}
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-surface-container-highest/10 rounded-xl border border-surface-container-high/50">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Data do Conserto</p>
                                  <p className="text-[11px] font-bold text-on-surface">
                                    {(ticket as any).dataConserto || ticket.dataTerminoAtendimento 
                                      ? new Date((ticket as any).dataConserto || ticket.dataTerminoAtendimento).toLocaleDateString('pt-BR') 
                                      : 'Não informada'}
                                  </p>
                                </div>
                                <div className="p-3 bg-surface-container-highest/10 rounded-xl border border-surface-container-high/50">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Data de Devolução</p>
                                  <p className="text-[11px] font-bold text-on-surface">
                                    {(ticket as any).dataDevolucao || ticket.dataFechamento 
                                      ? new Date((ticket as any).dataDevolucao || ticket.dataFechamento).toLocaleDateString('pt-BR') 
                                      : 'Não informada'}
                                  </p>
                                </div>
                              </div>

                              {/* Documentação Técnica: OS e Laudo */}
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-surface-container-highest/10 rounded-xl border border-surface-container-high/50 flex flex-col justify-between">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant mb-1 flex items-center gap-1">
                                    <FileSpreadsheet size={10} /> Ordem de Serviço
                                  </p>
                                  <p className="text-[11px] font-bold text-primary truncate">
                                    {(ticket as any).ordemServico || (ticket as any).numeroOS || (ticket as any).os || 'Não vinculada'}
                                  </p>
                                </div>
                                <div className="p-3 bg-surface-container-highest/10 rounded-xl border border-surface-container-high/50 flex flex-col justify-between">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant mb-1 flex items-center gap-1">
                                    <ShieldCheck size={10} /> Laudo Técnico
                                  </p>
                                  <p className="text-[11px] font-bold text-primary truncate">
                                    {(ticket as any).laudoTecnico || (ticket as any).laudo || 'Não emitido'}
                                  </p>
                                </div>
                              </div>

                              {/* Peças Substituídas (Sem preços!) */}
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-orange-600 mb-1">Peças Substituídas</p>
                                {ticket.pecasUtilizadas && ticket.pecasUtilizadas.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {ticket.pecasUtilizadas.map((peca, pidx) => (
                                      <span key={pidx} className="px-2 py-1 bg-orange-50 text-orange-600 rounded-lg text-[10px] font-bold border border-orange-100 flex items-center gap-1">
                                        <Wrench size={10} />
                                        {peca.quantidade}x {peca.nome}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-on-surface-variant italic">Nenhuma peça substituída</p>
                                )}
                              </div>

                              {/* Fotos Liberadas ao Cliente */}
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-2">Fotos Liberadas ao Cliente</p>
                                {ticket.fotos && ticket.fotos.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {ticket.fotos.map((foto, fidx) => (
                                      <div key={fidx} className="w-12 h-12 rounded-xl bg-surface-container-highest/20 border border-surface-container-high overflow-hidden group relative cursor-pointer">
                                        <img src={foto} alt={`Evidência ${fidx}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <ImageIcon size={14} className="text-white" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-on-surface-variant italic">Sem fotos registradas</p>
                                )}
                              </div>

                              {/* Assinatura / Aceite do Cliente */}
                              {ticket.assinaturaCliente && (
                                <div className="pt-4 border-t border-surface-container-high flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-2 text-green-600">
                                      <CheckCircle2 size={16} />
                                      <span className="text-[9px] font-black uppercase tracking-widest">Serviço Aceite pelo Cliente</span>
                                    </div>
                                    <p className="text-[8px] text-on-surface-variant mt-0.5">Registrado em {ticket.assinaturaData ? new Date(ticket.assinaturaData).toLocaleDateString('pt-BR') : '-'}</p>
                                  </div>
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="docs"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {[
                  { title: 'Manual do Usuário', type: 'Manual', date: 'v1.0.4', icon: FileText, color: 'text-blue-500' },
                  { title: 'Termo de Instalação e Garantia', type: 'Certificado', date: equipment.dataInstalacao || '-', icon: ShieldCheck, color: 'text-green-500' },
                  { title: 'Nota Fiscal de Compra', type: 'Financeiro', date: '-', icon: Download, color: 'text-orange-500' },
                  { title: 'Laudo de Última Preventiva', type: 'Técnico', date: equipment.dataUltimaManutencao || '-', icon: Check, color: 'text-purple-500' }
                ].map((doc, idx) => (
                  <div key={idx} className="bg-surface-container-low p-6 rounded-[32px] border border-surface-container-high flex flex-col justify-between group hover:border-primary transition-all shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-2xl bg-surface-container-highest/20 flex items-center justify-center ${doc.color}`}>
                        <doc.icon size={24} />
                      </div>
                      <button className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-full transition-all">
                        <Download size={20} />
                      </button>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-50 mb-1">{doc.type}</p>
                      <h4 className="text-sm font-black text-on-surface group-hover:text-primary transition-colors">{doc.title}</h4>
                      <p className="text-[10px] font-bold text-on-surface-variant mt-2">Ref: {doc.date}</p>
                    </div>
                  </div>
                ))}

                <button className="col-span-full border-2 border-dashed border-surface-container-high p-8 rounded-[32px] flex flex-col items-center justify-center gap-3 text-on-surface-variant hover:border-primary hover:text-primary transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-surface-container-highest/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Paperclip size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest">Anexar Novo Documento</p>
                    <p className="text-[10px] font-medium text-center">Formatos aceitos: PDF, JPG, PNG (Max 5MB)</p>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
