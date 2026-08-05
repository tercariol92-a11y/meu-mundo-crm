import { useState, useEffect } from 'react';
import { 
  X, Building2, User, MapPin, Briefcase, 
  Construction, Laptop, CreditCard, FileText,
  History, Plus, Search, Filter, Calendar,
  CheckCircle2, AlertCircle, Trash2, Edit2,
  ChevronRight, ArrowLeft, Settings, Loader2, Clock
} from 'lucide-react';
import { Cliente, EquipamentoCliente, Chamado, CustomerPortalUser } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';

interface ClientDetailProps {
  cliente: Cliente;
  onClose: () => void;
  onEdit: () => void;
}

type TabType = 'geral' | 'equipamentos' | 'chamados' | 'financeiro' | 'obs' | 'acesso';

export default function ClientDetail({ cliente, onClose, onEdit }: ClientDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  const [equipamentos, setEquipamentos] = useState<EquipamentoCliente[]>([]);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEquip, setShowAddEquip] = useState(false);

  useEffect(() => {
    fetchData();
  }, [cliente.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [equipsData, chamadosData] = await Promise.all([
        databaseService.getEquipamentosCliente(cliente.id),
        databaseService.getChamados(cliente.id)
      ]);
      setEquipamentos(equipsData || []);
      setChamados(chamadosData || []);
    } catch (error) {
      console.error('Error fetching client details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEquip = async (id: string) => {
    if (confirm('Remover este equipamento?')) {
      try {
        await databaseService.deleteEquipamentoCliente(id);
        fetchData();
      } catch (error) {
        console.error('Error deleting equipment:', error);
      }
    }
  };

  const tabs = [
    { id: 'geral', label: 'Dados Gerais', icon: Building2 },
    { id: 'equipamentos', label: 'Equipamentos', icon: Construction },
    { id: 'chamados', label: 'Atendimentos', icon: History },
    { id: 'financeiro', label: 'Financeiro', icon: CreditCard },
    { id: 'obs', label: 'Observações', icon: FileText },
    { id: 'acesso', label: 'Acesso Portal', icon: Settings },
  ];

  const infoItem = (label: string, value: string | number | boolean | undefined, icon?: any) => (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{label}</p>
      <div className="flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <p className="text-sm font-bold text-on-surface">
          {typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : (value || '---')}
        </p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[150] bg-surface flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <div className="px-8 py-6 border-b border-surface-container-high flex justify-between items-center bg-surface-container-low/30">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-xl transition-all text-on-surface-variant">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm overflow-hidden border border-surface-container-high">
              {cliente.logoUrl ? (
                <img src={cliente.logoUrl} alt={cliente.nomeFantasia} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Building2 size={28} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-on-surface uppercase tracking-tight">
                  {cliente.nomeFantasia}
                </h2>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  cliente.status === 'Ativo' ? 'bg-green-100 text-green-600' : 'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {cliente.status}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">{cliente.razaoSocial || 'Cliente Mundo Tech'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={onEdit}
            className="flex items-center gap-2 bg-surface-container-high text-on-surface px-5 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-surface-container-highest transition-all"
          >
            <Edit2 size={18} />
            Editar Cadastro
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 flex items-center gap-2 bg-surface border-b border-surface-container-high overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-3 px-6 py-5 border-b-4 transition-all whitespace-nowrap ${
                isActive 
                  ? 'border-primary text-primary bg-primary/5' 
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <Icon size={18} className={isActive ? 'animate-bounce' : ''} />
              <span className="text-xs font-black uppercase tracking-widest">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 bg-surface-container-lowest custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'geral' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <section className="bg-surface-container-low p-8 rounded-[2.5rem] border border-surface-container-high/50 space-y-6 shadow-sm">
                    <div className="flex items-center gap-3 text-primary">
                      <Building2 size={20} />
                      <h3 className="text-sm font-black uppercase tracking-[0.2em]">Informações Cadastrais</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {infoItem('CNPJ / CPF', cliente.cnpj)}
                      {infoItem('Inscrição Estadual', cliente.inscricaoEstadual)}
                      {infoItem('Email Principal', cliente.emailPrincipal)}
                      {infoItem('Telefone', cliente.celularWhatsapp)}
                      {infoItem('Setor de Atuação', cliente.segmento)}
                    </div>
                  </section>

                  <section className="bg-surface-container-low p-8 rounded-[2.5rem] border border-surface-container-high/50 space-y-6 shadow-sm">
                    <div className="flex items-center gap-3 text-primary">
                      <MapPin size={20} />
                      <h3 className="text-sm font-black uppercase tracking-[0.2em]">Localização</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        {infoItem('Endereço', `${cliente.rua}, ${cliente.numero}${cliente.complemento ? ` - ${cliente.complemento}` : ''}`)}
                      </div>
                      {infoItem('Bairro', cliente.bairro)}
                      {infoItem('Cidade/UF', `${cliente.cidade}/${cliente.estado}`)}
                      {infoItem('CEP', cliente.cep)}
                    </div>
                  </section>
                </div>

                <div className="space-y-8">
                  <section className="bg-surface-container-low p-8 rounded-[2.5rem] border border-surface-container-high/50 space-y-6 shadow-sm">
                    <div className="flex items-center gap-3 text-primary">
                      <Settings size={20} />
                      <h3 className="text-sm font-black uppercase tracking-[0.2em]">Configurações Mundo Tech</h3>
                    </div>
                    <div className="space-y-4">
                      {infoItem('Possui Contrato', cliente.possuiContrato, <FileText size={14} />)}
                      {infoItem('Usa Software', cliente.usaSoftware, <Laptop size={14} />)}
                      {infoItem('Usa Equipamento', cliente.usaEquipamento, <Construction size={14} />)}
                    </div>
                  </section>

                  {cliente.slaConfig && (
                    <section className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/20 space-y-6 shadow-sm">
                      <div className="flex items-center gap-3 text-primary">
                        <Clock size={20} />
                        <h3 className="text-sm font-black uppercase tracking-[0.2em]">SLA Contratado</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-primary/10 pb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Plano</span>
                          <span className="text-[10px] font-black uppercase tracking-tight text-primary">{cliente.slaConfig.planName}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-primary/10 pb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Resposta / Resolução</span>
                          <span className="text-[10px] font-bold text-on-surface">{cliente.slaConfig.firstResponseHours}h / {cliente.slaConfig.resolutionHours}h</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-primary/10 pb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Horário Atendimento</span>
                          <span className="text-[10px] font-bold text-on-surface">{cliente.slaConfig.workingHoursStart} às {cliente.slaConfig.workingHoursEnd}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tipo Suporte</span>
                          <span className="text-[10px] font-bold text-on-surface">{cliente.slaConfig.supportType}</span>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'equipamentos' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black text-on-surface uppercase tracking-tight">Frota de Equipamentos</h3>
                  <button 
                    onClick={() => setShowAddEquip(true)}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    <Plus size={16} />
                    Adicionar Equipamento
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {equipamentos.map(equip => (
                    <div key={equip.id} className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high hover:border-primary/30 transition-all group scale-100 hover:scale-[1.02] active:scale-95 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all">
                          <Construction size={24} />
                        </div>
                        <button 
                          onClick={() => handleDeleteEquip(equip.id)}
                          className="p-2 opacity-0 group-hover:opacity-100 hover:bg-error/10 text-error rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <h4 className="font-black text-lg text-on-surface mb-1 uppercase tracking-tight">{equip.modelo}</h4>
                      <p className="text-xs text-on-surface-variant font-bold mb-4 uppercase tracking-widest">S/N: {equip.numeroSerie}</p>
                      <div className="space-y-2 border-t border-surface-container-high pt-4">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-on-surface-variant font-black uppercase tracking-widest">Status</span>
                          <span className={`font-black uppercase tracking-widest ${equip.status === 'Em operação' ? 'text-green-600' : 'text-amber-600'}`}>
                            {equip.status || 'Em operação'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'chamados' && (
              <div className="space-y-6">
                <h3 className="text-lg font-black text-on-surface uppercase tracking-tight">Histórico de Atendimentos</h3>
                <div className="space-y-4">
                  {chamados.map(chamado => (
                    <div key={chamado.id} className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high hover:border-primary/20 transition-all flex items-center justify-between group">
                      <div className="flex items-center gap-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                          chamado.status === 'finalizado' || chamado.status === 'concluido' ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'
                        }`}>
                          <History size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-on-surface uppercase tracking-tight">{chamado.titulo}</h4>
                          <div className="flex items-center gap-4 text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">
                            <span>{chamado.createdAt ? new Date(chamado.createdAt).toLocaleDateString() : 'Sem data'}</span>
                            <span className="w-1 h-1 bg-on-surface-variant/30 rounded-full" />
                            <span>{chamado.tecnico?.nome || 'Não atribuído'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          chamado.prioridade === 'critica' || chamado.prioridade === 'alta' ? 'bg-error/10 text-error' : 'bg-surface-container-high text-on-surface-variant'
                        }`}>
                          {chamado.prioridade}
                        </span>
                        <ChevronRight size={20} className="text-on-surface-variant group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'financeiro' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <section className="space-y-8">
                  <h3 className={sectionTitleClass}><CreditCard size={18} /> Dados de Pagamento</h3>
                  <div className="grid grid-cols-1 gap-6">
                    {infoItem('Forma de Pagamento', cliente.formaPagamento)}
                    {infoItem('Dia de Vencimento', cliente.diaVencimento)}
                    {infoItem('Responsável Financeiro', cliente.financeiroResponsavel)}
                    {infoItem('CPF/CNPJ Pagador', cliente.pagadorCpfCnpj)}
                  </div>
                </section>
                <section className="space-y-8">
                  <h3 className={sectionTitleClass}><Settings size={18} /> Dados Bancários</h3>
                  <div className="grid grid-cols-1 gap-6">
                    {infoItem('Banco', cliente.banco)}
                    {infoItem('Chave Pix', cliente.chavePix)}
                    <div className={`p-6 rounded-3xl border flex items-center justify-between ${cliente.inadimplente ? 'bg-error/5 border-error/20' : 'bg-success/5 border-success/20'}`}>
                      <div className="flex items-center gap-3">
                        {cliente.inadimplente ? <AlertCircle className="text-error" /> : <CheckCircle2 className="text-success" />}
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status Financeiro</p>
                          <p className={`text-sm font-black uppercase tracking-tight ${cliente.inadimplente ? 'text-error' : 'text-success'}`}>
                            {cliente.inadimplente ? 'Inadimplente' : 'Em dia'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'obs' && (
              <div className="space-y-10">
                <section className="space-y-4">
                  <h3 className={sectionTitleClass}><FileText size={18} /> Observações Internas</h3>
                  <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high min-h-[150px]">
                    <p className="text-sm text-on-surface whitespace-pre-wrap">{cliente.observacoesInternas || 'Sem observações internas.'}</p>
                  </div>
                </section>
                <section className="space-y-4">
                  <h3 className={sectionTitleClass}><History size={18} /> Histórico Resumido</h3>
                  <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high min-h-[150px]">
                    <p className="text-sm text-on-surface whitespace-pre-wrap">{cliente.historicoResumido || 'Sem histórico registrado.'}</p>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'acesso' && (
              <PortalAccessTab cliente={cliente} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {showAddEquip && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-surface-container-high">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-on-surface uppercase tracking-tight">Novo Equipamento</h3>
              <button onClick={() => setShowAddEquip(false)}><X size={24} /></button>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">Esta funcionalidade de cadastro rápido será integrada ao serviço.</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setShowAddEquip(false)} className="px-6 py-2 text-xs font-black uppercase tracking-widest">Cancelar</button>
              <button className="px-8 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const sectionTitleClass = "text-sm font-black text-primary uppercase tracking-tight mb-6 flex items-center gap-2 border-b border-surface-container-high pb-2";

import { PortalAccessTab } from './PortalAccessTab';
