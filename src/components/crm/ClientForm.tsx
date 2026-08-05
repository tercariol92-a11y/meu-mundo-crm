import React, { useState, useEffect } from 'react';
import { 
  X, Save, Building2, User, MapPin, Briefcase, 
  Construction, Laptop, CreditCard, FileText,
  CheckCircle2, AlertCircle, Plus, Trash2, History, Loader2, Repeat, Clock, Settings
} from 'lucide-react';
import { Cliente, EquipamentoCliente, Chamado, SLAConfig, CustomerPortalUser } from '../../types';
import { databaseService } from '../../services/databaseService';
import { useCompanyConfig } from '../../hooks/useCompanyConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { PortalAccessTab } from './PortalAccessTab';

interface ClientFormProps {
  cliente?: Cliente;
  onSave: (data: Partial<Cliente>) => Promise<any>;
  onClose: () => void;
  userId: string;
}

type TabType = 'empresa' | 'contato' | 'endereco' | 'comercial' | 'sla' | 'acesso' | 'tecnico' | 'software' | 'atendimentos' | 'financeiro' | 'obs';

export default function ClientForm({ cliente, onSave, onClose, userId }: ClientFormProps) {
  const { companyConfig } = useCompanyConfig();
  const [activeTab, setActiveTab] = useState<TabType>('empresa');
  const [loading, setLoading] = useState(false);
  const [equipamentos, setEquipamentos] = useState<Partial<EquipamentoCliente>[]>([]);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [formData, setFormData] = useState<Partial<Cliente>>(() => {
    const base = {
      nomeFantasia: '',
      tipoPessoa: 'Jurídica' as const,
      status: 'Ativo' as const,
      pais: 'Brasil',
      possuiContrato: false,
      suporteAtivo: false,
      usaEquipamento: false,
      equipamentoQuantidade: 0,
      possuiCatraca: false,
      possuiFacial: false,
      possuiPonto: false,
      usaSoftware: false,
      integraSenior: false,
      integraTotvs: false,
      integraSecullum: false,
      inadimplente: false,
      usuarioId: userId,
      proximoRetorno: {
        data: '',
        hora: '',
        observacao: '',
        concluido: false
      },
      slaConfig: {
        planName: 'Plano Básico',
        firstResponseHours: 4,
        resolutionHours: 48,
        workingHoursStart: '08:00',
        workingHoursEnd: '18:00',
        workingDays: [1, 2, 3, 4, 5],
        supportType: 'Remoto' as const
      }
    };
    return cliente ? { ...base, ...cliente } : base;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(cliente?.logoUrl || null);

  useEffect(() => {
    if (cliente?.id) {
      fetchData();
    }
  }, [cliente?.id]);

  const fetchData = async () => {
    if (!cliente?.id) return;
    try {
      const [equipsData, chamadosData] = await Promise.all([
        databaseService.getEquipamentosCliente(cliente.id),
        databaseService.getChamados(cliente.id)
      ]);
      setEquipamentos(equipsData || []);
      setChamados(chamadosData || []);
    } catch (error) {
      console.error('Error fetching client data:', error);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    let firstErrorTab: TabType | null = null;

    if (!formData.nomeFantasia?.trim()) {
      newErrors.nomeFantasia = 'Nome Fantasia é obrigatório';
      if (!firstErrorTab) firstErrorTab = 'empresa';
    }
    if (!formData.cnpj?.trim()) {
      newErrors.cnpj = 'CNPJ / CPF é obrigatório';
      if (!firstErrorTab) firstErrorTab = 'empresa';
    }
    if (!formData.responsavelNome?.trim()) {
      newErrors.responsavelNome = 'Nome do contato é obrigatório';
      if (!firstErrorTab) firstErrorTab = 'contato';
    }
    if (!formData.celularWhatsapp?.trim() && !formData.telefoneFixo?.trim()) {
      newErrors.telefoneFixo = 'Pelo menos um telefone é obrigatório';
      newErrors.celularWhatsapp = 'Pelo menos um telefone é obrigatório';
      if (!firstErrorTab) firstErrorTab = 'contato';
    }
    
    setErrors(newErrors);
    if (firstErrorTab) {
      setActiveTab(firstErrorTab);
      setSubmitError('Por favor, preencha todos os campos obrigatórios marcados com *');
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: any) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    setSubmitError(null);
    
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        usuarioId: formData.usuarioId || userId
      };
      
      console.log('Saving client data:', dataToSave);
      const savedCliente = await onSave(dataToSave);
      
      if (!savedCliente) {
        throw new Error('Não foi possível obter os dados do cliente salvo.');
      }

      // Save equipments if any
      if (savedCliente.id && equipamentos.length > 0) {
        console.log('Saving equipments for client:', savedCliente.id);
        for (const equip of equipamentos) {
          if (!equip.id) {
            try {
              await databaseService.createEquipamentoCliente({
                ...equip,
                clienteId: savedCliente.id
              } as any);
            } catch (equipError) {
              console.error('Error saving equipment:', equipError);
              // We don't throw here to avoid losing the client save, but we could notify
            }
          }
        }
      }
      
      onClose();
    } catch (error: any) {
      console.error('Detailed error saving client:', error);
      let errorMessage = error.message || error.details || 'Ocorreu um erro ao salvar o cliente. Por favor, tente novamente.';
      
      // Traduzir erros comuns do Firebase
      if (typeof errorMessage === 'string') {
        if (errorMessage.includes('permission-denied')) {
          errorMessage = 'Você não tem permissão para realizar esta operação. Verifique se seu perfil está configurado corretamente.';
        } else if (errorMessage.includes('already-exists')) {
          errorMessage = 'Este registro já existe no banco de dados.';
        }
      }
      
      setSubmitError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Cliente, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSubmitError(null);
    
    setErrors(prev => {
      const newErrs = { ...prev };
      delete newErrs[field];
      
      // Clear related errors
      if (field === 'celularWhatsapp' || field === 'telefoneFixo') {
        delete newErrs.celularWhatsapp;
        delete newErrs.telefoneFixo;
      }
      
      if (field === 'tipoPessoa') {
        delete newErrs.cnpj;
      }
      
      return newErrs;
    });
  };

  const handleSLAChange = (field: keyof SLAConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      slaConfig: {
        ...(prev.slaConfig || {
          planName: 'Plano Básico',
          firstResponseHours: 4,
          resolutionHours: 48,
          workingHoursStart: '08:00',
          workingHoursEnd: '18:00',
          workingDays: [1, 2, 3, 4, 5],
          supportType: 'Remoto' as const
        }),
        [field]: value
      }
    }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
        handleChange('logoUrl', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const tabs = [
    { id: 'empresa', label: 'Empresa', icon: Building2 },
    { id: 'contato', label: 'Contato', icon: User },
    { id: 'endereco', label: 'Endereço', icon: MapPin },
    { id: 'comercial', label: 'Comercial', icon: Briefcase },
    { id: 'sla', label: 'SLA', icon: Clock },
    { id: 'acesso', label: 'Acesso Portal', icon: Settings },
    { id: 'tecnico', label: 'Equipamentos', icon: Construction },
    { id: 'software', label: 'Software', icon: Laptop },
    { id: 'atendimentos', label: 'Atendimentos', icon: History },
    { id: 'financeiro', label: 'Financeiro', icon: CreditCard },
    { id: 'obs', label: 'Observações', icon: FileText },
  ];

  const inputClass = "w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";
  const labelClass = "block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5 ml-1";
  const sectionTitleClass = "text-sm font-black text-primary uppercase tracking-tight mb-6 flex items-center gap-2 border-b border-surface-container-high pb-2";

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-surface-container-lowest w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl border border-surface-container-high flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-surface-container-high flex justify-between items-center bg-surface-container-low/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-on-surface uppercase tracking-tight">
                {cliente ? 'Editar Cliente' : 'Novo Cadastro de Cliente'}
              </h2>
              <div className="flex items-center gap-2">
                {companyConfig?.logoUrl && (
                  <img 
                    src={companyConfig.logoUrl} 
                    alt="Logo" 
                    className="h-4 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                )}
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">• Gestão Empresarial</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-xl transition-all text-on-surface-variant">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-64 bg-surface-container-low/50 border-r border-surface-container-high p-4 flex flex-col gap-1 overflow-y-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === tab.id 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Form Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-8"
                >
                  {activeTab === 'empresa' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2 flex flex-col items-center justify-center mb-6 bg-surface-container-low/50 p-8 rounded-3xl border-2 border-dashed border-surface-container-high group relative overflow-hidden">
                        <div className="relative">
                          <div className="w-32 h-32 bg-surface-container-high rounded-3xl flex items-center justify-center overflow-hidden border-4 border-surface-container-lowest shadow-xl transition-transform group-hover:scale-105 duration-500">
                            {logoPreview ? (
                              <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Building2 size={48} className="text-on-surface-variant opacity-20" />
                            )}
                          </div>
                          <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary-container hover:text-primary transition-all hover:scale-110 active:scale-95">
                            <Plus size={20} />
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                          </label>
                          {logoPreview && (
                            <button 
                              type="button"
                              onClick={() => {
                                setLogoPreview(null);
                                handleChange('logoUrl', null);
                              }}
                              className="absolute -top-2 -right-2 w-8 h-8 bg-error text-white rounded-lg flex items-center justify-center shadow-lg hover:bg-error-container hover:text-error transition-all hover:scale-110 opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        <div className="mt-4 text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Logo ou Foto do Cliente</p>
                          <p className="text-[8px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">Clique no + para alterar</p>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <h3 className={sectionTitleClass}><Building2 size={18} /> Dados da Empresa</h3>
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Razão Social</label>
                        <input 
                          type="text" 
                          className={inputClass} 
                          value={formData.razaoSocial || ''} 
                          onChange={e => handleChange('razaoSocial', e.target.value)}
                          placeholder="Ex: Nome Completo da Empresa LTDA"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Nome Fantasia *</label>
                        <input 
                          type="text" 
                          className={`${inputClass} ${errors.nomeFantasia ? 'border-error ring-1 ring-error/20' : ''}`}
                          value={formData.nomeFantasia || ''} 
                          onChange={e => handleChange('nomeFantasia', e.target.value)}
                          placeholder="Ex: Nome da Empresa"
                        />
                        {errors.nomeFantasia && <p className="text-[10px] text-error mt-1 font-bold">{errors.nomeFantasia}</p>}
                      </div>
                      <div>
                        <label className={labelClass}>CNPJ / CPF *</label>
                        <input 
                          type="text" 
                          className={`${inputClass} ${errors.cnpj ? 'border-error ring-1 ring-error/20' : ''}`}
                          value={formData.cnpj || ''} 
                          onChange={e => handleChange('cnpj', e.target.value)}
                          placeholder="00.000.000/0000-00"
                        />
                        {errors.cnpj && <p className="text-[10px] text-error mt-1 font-bold">{errors.cnpj}</p>}
                      </div>
                      <div>
                        <label className={labelClass}>Inscrição Estadual</label>
                        <input type="text" className={inputClass} value={formData.inscricaoEstadual || ''} onChange={e => handleChange('inscricaoEstadual', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Inscrição Municipal</label>
                        <input type="text" className={inputClass} value={formData.inscricaoMunicipal || ''} onChange={e => handleChange('inscricaoMunicipal', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Tipo de Pessoa</label>
                        <select className={inputClass} value={formData.tipoPessoa} onChange={e => handleChange('tipoPessoa', e.target.value)}>
                          <option value="Jurídica">Jurídica</option>
                          <option value="Física">Física</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Status do Cliente</label>
                        <select className={inputClass} value={formData.status} onChange={e => handleChange('status', e.target.value)}>
                          <option value="Ativo">Ativo</option>
                          <option value="Inativo">Inativo</option>
                          <option value="Bloqueado">Bloqueado</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {activeTab === 'contato' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <h3 className={sectionTitleClass}><User size={18} /> Contato Principal</h3>
                      </div>
                      <div>
                        <label className={labelClass}>Nome do Responsável *</label>
                        <input 
                          type="text" 
                          className={`${inputClass} ${errors.responsavelNome ? 'border-error ring-1 ring-error/20' : ''}`}
                          value={formData.responsavelNome || ''} 
                          onChange={e => handleChange('responsavelNome', e.target.value)} 
                        />
                        {errors.responsavelNome && <p className="text-[10px] text-error mt-1 font-bold">{errors.responsavelNome}</p>}
                      </div>
                      <div>
                        <label className={labelClass}>Cargo</label>
                        <input type="text" className={inputClass} value={formData.responsavelCargo || ''} onChange={e => handleChange('responsavelCargo', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Telefone Fixo</label>
                        <input 
                          type="text" 
                          className={`${inputClass} ${errors.telefoneFixo ? 'border-error ring-1 ring-error/20' : ''}`}
                          value={formData.telefoneFixo || ''} 
                          onChange={e => handleChange('telefoneFixo', e.target.value)} 
                          placeholder="(00) 0000-0000" 
                        />
                        {errors.telefoneFixo && <p className="text-[10px] text-error mt-1 font-bold">{errors.telefoneFixo}</p>}
                      </div>
                      <div>
                        <label className={labelClass}>Celular / WhatsApp *</label>
                        <input 
                          type="text" 
                          className={`${inputClass} ${errors.celularWhatsapp ? 'border-error ring-1 ring-error/20' : ''}`}
                          value={formData.celularWhatsapp || ''} 
                          onChange={e => handleChange('celularWhatsapp', e.target.value)} 
                          placeholder="(00) 00000-0000" 
                        />
                        {errors.celularWhatsapp && <p className="text-[10px] text-error mt-1 font-bold">{errors.celularWhatsapp}</p>}
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>E-mail Principal</label>
                        <input type="text" className={inputClass} value={formData.emailPrincipal || ''} onChange={e => handleChange('emailPrincipal', e.target.value)} placeholder="exemplo@empresa.com.br" />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Site / Website</label>
                        <input type="text" className={inputClass} value={formData.website || ''} onChange={e => handleChange('website', e.target.value)} placeholder="www.cliente.com.br" />
                      </div>
                      <div>
                        <label className={labelClass}>E-mail Financeiro</label>
                        <input type="text" className={inputClass} value={formData.emailFinanceiro || ''} onChange={e => handleChange('emailFinanceiro', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>E-mail Técnico</label>
                        <input type="text" className={inputClass} value={formData.emailTecnico || ''} onChange={e => handleChange('emailTecnico', e.target.value)} />
                      </div>
                    </div>
                  )}

                  {activeTab === 'endereco' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-3">
                        <h3 className={sectionTitleClass}><MapPin size={18} /> Endereço</h3>
                      </div>
                      <div>
                        <label className={labelClass}>CEP</label>
                        <input type="text" className={inputClass} value={formData.cep || ''} onChange={e => handleChange('cep', e.target.value)} placeholder="00000-000" />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Rua / Avenida</label>
                        <input type="text" className={inputClass} value={formData.rua || ''} onChange={e => handleChange('rua', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Número</label>
                        <input type="text" className={inputClass} value={formData.numero || ''} onChange={e => handleChange('numero', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Complemento</label>
                        <input type="text" className={inputClass} value={formData.complemento || ''} onChange={e => handleChange('complemento', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Bairro</label>
                        <input type="text" className={inputClass} value={formData.bairro || ''} onChange={e => handleChange('bairro', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Cidade</label>
                        <input type="text" className={inputClass} value={formData.cidade || ''} onChange={e => handleChange('cidade', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Estado</label>
                        <input type="text" className={inputClass} value={formData.estado || ''} onChange={e => handleChange('estado', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>País</label>
                        <input type="text" className={inputClass} value={formData.pais || ''} onChange={e => handleChange('pais', e.target.value)} />
                      </div>
                    </div>
                  )}

                  {activeTab === 'comercial' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <h3 className={sectionTitleClass}><Briefcase size={18} /> Dados Comerciais</h3>
                      </div>
                      <div>
                        <label className={labelClass}>Origem do Lead</label>
                        <input type="text" className={inputClass} value={formData.origemLead || ''} onChange={e => handleChange('origemLead', e.target.value)} placeholder="Ex: Google, Indicação" />
                      </div>
                      <div>
                        <label className={labelClass}>Vendedor Responsável</label>
                        <input type="text" className={inputClass} value={formData.vendedorResponsavel || ''} onChange={e => handleChange('vendedorResponsavel', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Segmento</label>
                        <input type="text" className={inputClass} value={formData.segmento || ''} onChange={e => handleChange('segmento', e.target.value)} placeholder="Ex: Academia, Condomínio" />
                      </div>
                      <div>
                        <label className={labelClass}>SLA de Atendimento</label>
                        <input type="text" className={inputClass} value={formData.slaAtendimento || ''} onChange={e => handleChange('slaAtendimento', e.target.value)} placeholder="Ex: 24h, 48h" />
                      </div>
                      
                      <div className="md:col-span-2 bg-surface-container-low p-6 rounded-2xl border border-surface-container-high space-y-6">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-widest text-on-surface">Cliente possui contrato?</span>
                          <button 
                            type="button"
                            onClick={() => handleChange('possuiContrato', !formData.possuiContrato)}
                            className={`w-12 h-6 rounded-full transition-all relative ${formData.possuiContrato ? 'bg-primary' : 'bg-surface-container-highest'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.possuiContrato ? 'left-7' : 'left-1'}`}></div>
                          </button>
                        </div>

                        {formData.possuiContrato && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-surface-container-high"
                          >
                            <div>
                              <label className={labelClass}>Número do Contrato</label>
                              <input type="text" className={inputClass} value={formData.contratoNumero || ''} onChange={e => handleChange('contratoNumero', e.target.value)} />
                            </div>
                            <div>
                              <label className={labelClass}>Valor Mensal</label>
                              <input 
                                type="number" 
                                className={inputClass} 
                                value={formData.contratoValorMensal || ''} 
                                onChange={e => {
                                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                  handleChange('contratoValorMensal', val);
                                }} 
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Data de Início</label>
                              <input type="date" className={inputClass} value={formData.contratoInicio || ''} onChange={e => handleChange('contratoInicio', e.target.value)} />
                            </div>
                            <div>
                              <label className={labelClass}>Data de Vencimento</label>
                              <input type="date" className={inputClass} value={formData.contratoVencimento || ''} onChange={e => handleChange('contratoVencimento', e.target.value)} />
                            </div>
                          </motion.div>
                        )}

                        <div className="pt-6 border-t border-surface-container-high">
                          <h3 className={sectionTitleClass}><Repeat size={18} /> Próximo Retorno</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className={labelClass}>Data do Retorno</label>
                              <input 
                                type="date" 
                                className={inputClass} 
                                value={formData.proximoRetorno?.data || ''} 
                                onChange={e => handleChange('proximoRetorno', { ...formData.proximoRetorno, data: e.target.value })} 
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Horário</label>
                              <input 
                                type="time" 
                                className={inputClass} 
                                value={formData.proximoRetorno?.hora || ''} 
                                onChange={e => handleChange('proximoRetorno', { ...formData.proximoRetorno, hora: e.target.value })} 
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className={labelClass}>Observação do Retorno</label>
                              <textarea 
                                className={`${inputClass} h-20 resize-none`} 
                                value={formData.proximoRetorno?.observacao || ''} 
                                onChange={e => handleChange('proximoRetorno', { ...formData.proximoRetorno, observacao: e.target.value })} 
                                placeholder="O que deve ser conversado no retorno?"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'sla' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <h3 className={sectionTitleClass}><Clock size={18} /> Configuração de SLA (Service Level Agreement)</h3>
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Nome do Plano de SLA</label>
                        <input 
                          type="text" 
                          className={inputClass} 
                          value={formData.slaConfig?.planName || ''} 
                          onChange={e => handleSLAChange('planName', e.target.value)}
                          placeholder="Ex: Plano Premium, Suporte Gold"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Primeira Resposta (Horas Úteis)</label>
                        <input 
                          type="number" 
                          className={inputClass} 
                          value={formData.slaConfig?.firstResponseHours || ''} 
                          onChange={e => handleSLAChange('firstResponseHours', parseInt(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Resolução Total (Horas Úteis)</label>
                        <input 
                          type="number" 
                          className={inputClass} 
                          value={formData.slaConfig?.resolutionHours || ''} 
                          onChange={e => handleSLAChange('resolutionHours', parseInt(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Início do Horário de Atendimento</label>
                        <input 
                          type="time" 
                          className={inputClass} 
                          value={formData.slaConfig?.workingHoursStart || ''} 
                          onChange={e => handleSLAChange('workingHoursStart', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Fim do Horário de Atendimento</label>
                        <input 
                          type="time" 
                          className={inputClass} 
                          value={formData.slaConfig?.workingHoursEnd || ''} 
                          onChange={e => handleSLAChange('workingHoursEnd', e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Tipo de Suporte Contratado</label>
                        <select 
                          className={inputClass} 
                          value={formData.slaConfig?.supportType || ''} 
                          onChange={e => handleSLAChange('supportType', e.target.value as any)}
                        >
                          <option value="Remoto">Apenas Remoto</option>
                          <option value="Presencial">Presencial e Remoto</option>
                          <option value="Híbrido">Híbrido (Remoto e On-site sob demanda)</option>
                          <option value="VIP">VIP (24/7 com canal exclusivo)</option>
                        </select>
                      </div>

                      <div className="md:col-span-2 bg-primary/5 p-6 rounded-3xl border border-primary/20 mt-4">
                        <div className="flex gap-4">
                          <AlertCircle className="text-primary shrink-0" size={24} />
                          <div className="space-y-2">
                            <h4 className="text-xs font-black uppercase tracking-widest text-primary">Informações do SLA</h4>
                            <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                              As regras de SLA são aplicadas automaticamente no momento da abertura do chamado. 
                              O cálculo leva em conta apenas os dias úteis (Segunda a Sexta) e o intervalo de horário definido acima.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'acesso' && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 text-primary mb-2">
                        <Settings size={20} />
                        <h3 className="text-sm font-black uppercase tracking-[0.2em]">Configuração de Acesso ao Portal</h3>
                      </div>
                      
                      {cliente?.id ? (
                        <PortalAccessTab cliente={cliente} />
                      ) : (
                        <div className="bg-surface-container-low p-8 rounded-3xl border border-surface-container-high text-center space-y-4">
                          <div className="w-16 h-16 bg-surface-container-highest rounded-2xl flex items-center justify-center text-on-surface-variant mx-auto">
                            <Settings size={32} />
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-sm font-black uppercase tracking-tight text-on-surface">Cadastro Inicial Necessário</h4>
                            <p className="text-xs text-on-surface-variant font-medium leading-relaxed max-w-xs mx-auto">
                              Salve o cadastro do cliente primeiro para poder liberar o acesso ao Portal do Cliente.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'tecnico' && (
                    <div className="space-y-8">
                      <div className="flex justify-between items-center border-b border-surface-container-high pb-4">
                        <h3 className="text-lg font-black text-primary uppercase tracking-tight flex items-center gap-2">
                          <Construction size={18} /> Equipamentos Instalados
                        </h3>
                        <button 
                          type="button"
                          onClick={() => setEquipamentos([...equipamentos, { tipo: 'Catraca', quantidade: 1, status: 'Em operação' }])}
                          className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary px-4 py-2 rounded-xl hover:bg-primary/20 transition-all flex items-center gap-2"
                        >
                          <Plus size={14} /> Adicionar Equipamento
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-6">
                        {equipamentos.length === 0 ? (
                          <div className="py-10 text-center bg-surface-container-low/50 rounded-3xl border-2 border-dashed border-surface-container-high">
                            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nenhum equipamento adicionado ainda.</p>
                          </div>
                        ) : (
                          equipamentos.map((equip, index) => (
                            <div key={index} className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high relative group">
                              <button 
                                type="button"
                                onClick={() => setEquipamentos(equipamentos.filter((_, i) => i !== index))}
                                className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={18} />
                              </button>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                  <label className={labelClass}>Tipo de Equipamento</label>
                                  <select 
                                    className={inputClass} 
                                    value={equip.tipo} 
                                    onChange={e => {
                                      const newEquips = [...equipamentos];
                                      newEquips[index].tipo = e.target.value as any;
                                      setEquipamentos(newEquips);
                                    }}
                                  >
                                    <option value="Catraca">Catraca</option>
                                    <option value="Facial">Facial</option>
                                    <option value="Ponto">Relógio de Ponto</option>
                                    <option value="Outros">Outros (Especificar)</option>
                                  </select>
                                </div>

                                {equip.tipo === 'Outros' && (
                                  <div>
                                    <label className={labelClass}>Nome do Equipamento</label>
                                    <input 
                                      type="text" 
                                      className={inputClass} 
                                      value={equip.nome || ''} 
                                      onChange={e => {
                                        const newEquips = [...equipamentos];
                                        newEquips[index].nome = e.target.value;
                                        setEquipamentos(newEquips);
                                      }}
                                      placeholder="Ex: Torniquete, Sensor"
                                    />
                                  </div>
                                )}

                                <div>
                                  <label className={labelClass}>Marca</label>
                                  <input 
                                    type="text" 
                                    className={inputClass} 
                                    value={equip.marca || ''} 
                                    onChange={e => {
                                      const newEquips = [...equipamentos];
                                      newEquips[index].marca = e.target.value;
                                      setEquipamentos(newEquips);
                                    }}
                                  />
                                </div>

                                <div>
                                  <label className={labelClass}>Modelo</label>
                                  <input 
                                    type="text" 
                                    className={inputClass} 
                                    value={equip.modelo || ''} 
                                    onChange={e => {
                                      const newEquips = [...equipamentos];
                                      newEquips[index].modelo = e.target.value;
                                      setEquipamentos(newEquips);
                                    }}
                                  />
                                </div>

                                <div>
                                  <label className={labelClass}>Número de Série</label>
                                  <input 
                                    type="text" 
                                    className={inputClass} 
                                    value={equip.numeroSerie || ''} 
                                    onChange={e => {
                                      const newEquips = [...equipamentos];
                                      newEquips[index].numeroSerie = e.target.value;
                                      setEquipamentos(newEquips);
                                    }}
                                  />
                                </div>

                                <div>
                                  <label className={labelClass}>Quantidade</label>
                                  <input 
                                    type="number" 
                                    className={inputClass} 
                                    value={equip.quantidade || 1} 
                                    onChange={e => {
                                      const newEquips = [...equipamentos];
                                      newEquips[index].quantidade = parseInt(e.target.value);
                                      setEquipamentos(newEquips);
                                    }}
                                  />
                                </div>

                                <div>
                                  <label className={labelClass}>Local de Instalação</label>
                                  <input 
                                    type="text" 
                                    className={inputClass} 
                                    value={equip.localInstalacao || ''} 
                                    onChange={e => {
                                      const newEquips = [...equipamentos];
                                      newEquips[index].localInstalacao = e.target.value;
                                      setEquipamentos(newEquips);
                                    }}
                                  />
                                </div>

                                <div className="md:col-span-3">
                                  <label className={labelClass}>Observações Técnicas</label>
                                  <textarea 
                                    className={`${inputClass} h-20 resize-none`} 
                                    value={equip.observacoesTecnicas || ''} 
                                    onChange={e => {
                                      const newEquips = [...equipamentos];
                                      newEquips[index].observacoesTecnicas = e.target.value;
                                      setEquipamentos(newEquips);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'software' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <h3 className={sectionTitleClass}><Laptop size={18} /> Software e Integrações</h3>
                      </div>

                      <div className="md:col-span-2 flex items-center justify-between bg-surface-container-low p-4 rounded-xl border border-surface-container-high">
                        <span className="text-xs font-black uppercase tracking-widest text-on-surface">Usa Software?</span>
                        <button 
                          type="button"
                          onClick={() => handleChange('usaSoftware', !formData.usaSoftware)}
                          className={`w-12 h-6 rounded-full transition-all relative ${formData.usaSoftware ? 'bg-primary' : 'bg-surface-container-highest'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.usaSoftware ? 'left-7' : 'left-1'}`}></div>
                        </button>
                      </div>

                      {formData.usaSoftware && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6"
                        >
                          <div>
                            <label className={labelClass}>Nome do Software</label>
                            <input type="text" className={inputClass} value={formData.softwareNome || ''} onChange={e => handleChange('softwareNome', e.target.value)} />
                          </div>
                          <div>
                            <label className={labelClass}>Tipo de Software</label>
                            <select className={inputClass} value={formData.softwareTipo || ''} onChange={e => handleChange('softwareTipo', e.target.value)}>
                              <option value="">Selecione...</option>
                              <option value="controle de acesso">Controle de Acesso</option>
                              <option value="ponto">Ponto</option>
                              <option value="RH">RH</option>
                              <option value="portaria">Portaria</option>
                              <option value="outro">Outro</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Origem do Software</label>
                            <select className={inputClass} value={formData.softwareOrigem || ''} onChange={e => handleChange('softwareOrigem', e.target.value)}>
                              <option value="Próprio">Nosso (Próprio)</option>
                              <option value="Terceiro">Terceiro</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>Integrações Ativas</label>
                            <div className="grid grid-cols-3 gap-4 mt-2">
                              {[
                                { id: 'integraSenior', label: 'Senior' },
                                { id: 'integraTotvs', label: 'TOTVS' },
                                { id: 'integraSecullum', label: 'Secullum' },
                              ].map(item => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleChange(item.id as keyof Cliente, !formData[item.id as keyof Cliente])}
                                  className={`px-4 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                                    formData[item.id as keyof Cliente] ? 'bg-primary text-white border-primary' : 'bg-surface-container-low border-surface-container-high text-on-surface-variant'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>Outra Integração / Obs Técnicas</label>
                            <textarea className={`${inputClass} h-24 resize-none`} value={formData.observacoesTecnicas || ''} onChange={e => handleChange('observacoesTecnicas', e.target.value)} />
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {activeTab === 'atendimentos' && (
                    <div className="space-y-8">
                      <div className="border-b border-surface-container-high pb-4">
                        <h3 className="text-lg font-black text-primary uppercase tracking-tight flex items-center gap-2">
                          <History size={18} /> Histórico de Atendimentos
                        </h3>
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">
                          Consulte os chamados realizados para este cliente
                        </p>
                      </div>

                      {chamados.length === 0 ? (
                        <div className="py-20 text-center bg-surface-container-low/50 rounded-3xl border-2 border-dashed border-surface-container-high">
                          <History size={48} className="mx-auto text-on-surface-variant opacity-20 mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nenhum atendimento registrado.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {chamados.map((chamado) => (
                            <div key={chamado.id} className="bg-surface-container-low border border-surface-container-high rounded-2xl p-5">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-black text-on-surface uppercase tracking-tight text-sm">{chamado.titulo}</h4>
                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                                      chamado.status === 'concluido' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                                    }`}>
                                      {chamado.status.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest mt-0.5">
                                    {new Date(chamado.createdAt!).toLocaleDateString()} • {chamado.tipoAtendimento || 'Geral'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant">Técnico</p>
                                  <p className="text-xs font-bold text-on-surface">{chamado.tecnico?.nome || '---'}</p>
                                </div>
                              </div>
                              <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-high text-xs text-on-surface leading-relaxed">
                                {chamado.descricao}
                              </div>
                              {chamado.solucaoAplicada && (
                                <div className="mt-3 p-4 bg-success/5 rounded-xl border border-success/10 text-xs text-on-surface leading-relaxed">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-success mb-1">Solução:</p>
                                  {chamado.solucaoAplicada}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'financeiro' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <h3 className={sectionTitleClass}><CreditCard size={18} /> Dados Financeiros</h3>
                      </div>
                      <div>
                        <label className={labelClass}>Forma de Pagamento</label>
                        <input type="text" className={inputClass} value={formData.formaPagamento || ''} onChange={e => handleChange('formaPagamento', e.target.value)} placeholder="Ex: Boleto, Pix, Cartão" />
                      </div>
                      <div>
                        <label className={labelClass}>Dia de Vencimento</label>
                        <input 
                          type="number" 
                          className={inputClass} 
                          value={formData.diaVencimento || ''} 
                          onChange={e => {
                            const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                            handleChange('diaVencimento', val);
                          }} 
                          min="1" 
                          max="31" 
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Responsável Financeiro</label>
                        <input type="text" className={inputClass} value={formData.financeiroResponsavel || ''} onChange={e => handleChange('financeiroResponsavel', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>CPF/CNPJ do Pagador</label>
                        <input type="text" className={inputClass} value={formData.pagadorCpfCnpj || ''} onChange={e => handleChange('pagadorCpfCnpj', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Banco</label>
                        <input type="text" className={inputClass} value={formData.banco || ''} onChange={e => handleChange('banco', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Chave Pix</label>
                        <input type="text" className={inputClass} value={formData.chavePix || ''} onChange={e => handleChange('chavePix', e.target.value)} />
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between bg-error/5 p-4 rounded-xl border border-error/20">
                        <div className="flex items-center gap-2 text-error">
                          <AlertCircle size={18} />
                          <span className="text-xs font-black uppercase tracking-widest">Cliente Inadimplente?</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleChange('inadimplente', !formData.inadimplente)}
                          className={`w-12 h-6 rounded-full transition-all relative ${formData.inadimplente ? 'bg-error' : 'bg-surface-container-highest'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.inadimplente ? 'left-7' : 'left-1'}`}></div>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'obs' && (
                    <div className="grid grid-cols-1 gap-6">
                      <div className="md:col-span-2">
                        <h3 className={sectionTitleClass}><FileText size={18} /> Observações Gerais</h3>
                      </div>
                      <div>
                        <label className={labelClass}>Observações Internas</label>
                        <textarea className={`${inputClass} h-32 resize-none`} value={formData.observacoesInternas || ''} onChange={e => handleChange('observacoesInternas', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Histórico Resumido</label>
                        <textarea className={`${inputClass} h-32 resize-none`} value={formData.historicoResumido || ''} onChange={e => handleChange('historicoResumido', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Preferências de Atendimento</label>
                        <input type="text" className={inputClass} value={formData.preferenciasAtendimento || ''} onChange={e => handleChange('preferenciasAtendimento', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Restrições Técnicas ou Comerciais</label>
                        <input type="text" className={inputClass} value={formData.restricoesTecnicas || ''} onChange={e => handleChange('restricoesTecnicas', e.target.value)} />
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-surface-container-high bg-surface-container-low/30 flex flex-col gap-4">
              {submitError && (
                <div className="flex items-center gap-2 text-error bg-error/10 p-3 rounded-xl border border-error/20">
                  <AlertCircle size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{submitError}</span>
                </div>
              )}
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSubmit}
                  className="px-8 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar Cliente
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

