import { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { Cliente, Unidade, EquipamentoCliente, Tecnico, Chamado } from '../../types';
import { 
  X, 
  Save, 
  Loader2, 
  AlertCircle, 
  User, 
  Building2, 
  Construction, 
  Clock, 
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  Image as ImageIcon,
  History,
  Zap,
  Sparkles,
  DollarSign,
  Timer,
  ShieldAlert,
  ChevronRight,
  Info,
  Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';

interface TicketFormProps {
  onClose: () => void;
  onSave: () => void;
  chamado?: Chamado;
}

export default function TicketForm({ onClose, onSave, chamado }: TicketFormProps) {
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoCliente[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  
  // Intelligence State
  const [equipmentHistory, setEquipmentHistory] = useState<Chamado[]>([]);
  const [recurrenceAlert, setRecurrenceAlert] = useState(false);
  const [suggestedTechnician, setSuggestedTechnician] = useState<string | null>(null);
  const [suggestedValue, setSuggestedValue] = useState<number | null>(null);
  const [isQuickTicket, setIsQuickTicket] = useState(false);
  const [lastMaintenance, setLastMaintenance] = useState<string | null>(null);
  const [healthScore, setHealthScore] = useState<number>(100);
  const [suggestedSolutions, setSuggestedSolutions] = useState<string[]>([]);
  const [slaTimeRemaining, setSlaTimeRemaining] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Chamado>>({
    clienteId: chamado?.clienteId || '',
    unidadeId: chamado?.unidadeId || '',
    equipamentoClienteId: chamado?.equipamentoClienteId || '',
    tecnicoId: chamado?.tecnicoId || '',
    titulo: chamado?.titulo || '',
    descricao: chamado?.descricao || '',
    prioridade: chamado?.prioridade || 'media',
    tipoAtendimento: chamado?.tipoAtendimento || 'Remoto',
    status: chamado?.status || 'aberto',
    slaDeadline: chamado?.slaDeadline || '',
    fotos: chamado?.fotos || [],
    tempoEstimado: chamado?.tempoEstimado || '',
    valorAtendimento: chamado?.valorAtendimento || 0
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [c, t] = await Promise.all([
          databaseService.getClientes(),
          databaseService.getTecnicos()
        ]);
        setClientes(c || []);
        setTecnicos(t || []);
      } catch (err) {
        console.error('Error loading initial ticket form data:', err);
      } finally {
        setFetchingData(false);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const loadClientData = async () => {
      if (!formData.clienteId) {
        setUnidades([]);
        setEquipamentos([]);
        return;
      }

      try {
        const [u, e] = await Promise.all([
          databaseService.getUnidades(formData.clienteId),
          databaseService.getEquipamentosCliente(formData.clienteId)
        ]);
        setUnidades(u || []);
        setEquipamentos(e || []);
      } catch (err) {
        console.error('Error loading client-specific data:', err);
      }
    };
    loadClientData();
  }, [formData.clienteId]);

  // Intelligence Effect: Equipment History & Suggestions
  useEffect(() => {
    const analyzeEquipment = async () => {
      if (!formData.equipamentoClienteId) {
        setEquipmentHistory([]);
        setRecurrenceAlert(false);
        setLastMaintenance(null);
        return;
      }

      try {
        const history = await databaseService.getChamadosByEquipamentoCliente(formData.equipamentoClienteId);
        if (history) {
          setEquipmentHistory(history);
          
          // Health Score Calculation
          // Base 100, -15 for each ticket in last 90 days, -30 if critical
          let score = 100;
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          
          history.forEach(c => {
            if (c.createdAt && new Date(c.createdAt) > ninetyDaysAgo) {
              score -= c.prioridade === 'critica' ? 30 : 15;
            }
          });
          setHealthScore(Math.max(0, score));

          // Suggested Solutions based on equipment type and history
          const equipment = equipamentos.find(e => e.id === formData.equipamentoClienteId);
          const solutions: string[] = [];
          if (equipment?.tipo === 'Catraca') {
            solutions.push('Verificar solenóide de travamento', 'Limpar sensores ópticos', 'Ajustar mola de retorno');
          } else if (equipment?.tipo === 'Facial') {
            solutions.push('Calibrar sensor infravermelho', 'Atualizar firmware do dispositivo', 'Verificar conectividade de rede');
          } else if (equipment?.tipo === 'Relógio de ponto') {
            solutions.push('Limpar leitor biométrico', 'Verificar bobina de papel', 'Sincronizar relógio interno');
          }
          setSuggestedSolutions(solutions);
          
          // Recurrence Alert: > 2 tickets in last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const recentTickets = history.filter(c => c.createdAt && new Date(c.createdAt) > thirtyDaysAgo);
          setRecurrenceAlert(recentTickets.length >= 2);

          // Last Maintenance
          const lastMaint = history.find(c => c.tipoAtendimento === 'Preventiva');
          setLastMaintenance(lastMaint?.createdAt || null);

          // Suggest Technician based on history
          const techCounts: Record<string, number> = {};
          history.forEach(c => {
            if (c.tecnicoId) techCounts[c.tecnicoId] = (techCounts[c.tecnicoId] || 0) + 1;
          });
          const mostFrequentTech = Object.entries(techCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
          if (mostFrequentTech && !formData.tecnicoId) {
            setSuggestedTechnician(mostFrequentTech);
            setFormData(prev => ({ ...prev, tecnicoId: mostFrequentTech }));
          }
        }
      } catch (err) {
        console.error('Error analyzing equipment:', err);
      }
    };
    analyzeEquipment();
  }, [formData.equipamentoClienteId]);

  // Intelligence Effect: Auto-fill Estimated Time
  useEffect(() => {
    if (!formData.tipoAtendimento || formData.tempoEstimado) return;

    let time = '02:00';
    switch (formData.tipoAtendimento) {
      case 'Preventiva': time = '01:30'; break;
      case 'Corretiva': time = '02:00'; break;
      case 'Instalação': time = '04:00'; break;
      case 'Treinamento': time = '03:00'; break;
    }
    setFormData(prev => ({ ...prev, tempoEstimado: time }));
  }, [formData.tipoAtendimento]);

  // Intelligence Effect: Suggest Value
  useEffect(() => {
    if (!formData.clienteId) return;
    
    const client = clientes.find(c => c.id === formData.clienteId);
    if (client) {
      if (client.possuiContrato) {
        setSuggestedValue(0);
        if (!formData.valorAtendimento) {
          setFormData(prev => ({ ...prev, valorAtendimento: 0 }));
        }
      } else {
        // Calculate: Technical Visit (150) + Hourly Rate (80/h)
        const visitFee = 150;
        const hourlyRate = 80;
        const [hours, minutes] = (formData.tempoEstimado || '02:00').split(':').map(Number);
        const totalHours = hours + (minutes / 60);
        const calculatedValue = visitFee + (totalHours * hourlyRate);
        
        setSuggestedValue(calculatedValue);
        if (!formData.valorAtendimento) {
          setFormData(prev => ({ ...prev, valorAtendimento: calculatedValue }));
        }
      }
    }
  }, [formData.clienteId, formData.tempoEstimado, clientes]);

  // SLA Time Remaining Effect
  useEffect(() => {
    if (!chamado?.slaPrazo || chamado.status === 'concluido') {
      setSlaTimeRemaining(null);
      return;
    }

    const updateSla = () => {
      const deadline = new Date(chamado.slaPrazo!);
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();
      
      const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
      const minutes = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60));
      
      const prefix = diff > 0 ? 'Restam' : 'Atrasado';
      setSlaTimeRemaining(`${prefix} ${hours}h ${minutes}m`);
    };

    updateSla();
    const interval = setInterval(updateSla, 60000);
    return () => clearInterval(interval);
  }, [chamado]);

  const calculateSLA = (prioridade: string) => {
    const now = new Date();
    let hours = 48;
    switch (prioridade) {
      case 'baixa': hours = 72; break;
      case 'media': hours = 48; break;
      case 'alta': hours = 24; break;
      case 'critica': hours = 4; break;
    }
    now.setHours(now.getHours() + hours);
    return now.toISOString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTecnicoId = formData.tecnicoId || tecnicos[0]?.id;

    if (!formData.clienteId || !formData.titulo || !finalTecnicoId) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const slaDeadline = formData.slaDeadline || calculateSLA(formData.prioridade || 'media');
      const data = {
        ...formData,
        tecnicoId: finalTecnicoId,
        slaDeadline,
        clienteId: formData.clienteId!,
        unidadeId: formData.unidadeId || '',
        titulo: formData.titulo!,
        status: formData.status || 'aberto'
      } as Omit<Chamado, 'id' | 'createdAt' | 'updatedAt' | 'cliente' | 'tecnico' | 'equipamentoCliente'>;

      if (chamado?.id) {
        await databaseService.updateChamado(chamado.id, data);
      } else {
        await databaseService.createChamado(data);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving ticket:', err);
      setError('Erro ao salvar o chamado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const filePromises = Array.from(files).map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });

      try {
        const base64Files = await Promise.all(filePromises);
        setFormData(prev => ({
          ...prev,
          fotos: [...(prev.fotos || []), ...base64Files]
        }));
      } catch (err) {
        console.error('Error reading files:', err);
      }
    }
  };

  const removeFoto = (index: number) => {
    const newFotos = [...(formData.fotos || [])];
    newFotos.splice(index, 1);
    setFormData({ ...formData, fotos: newFotos });
  };

  const labelClass = "block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5";
  const inputClass = "w-full bg-surface-container-highest border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-container rounded-[40px] w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl border border-surface-container-high flex flex-col"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Plus size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-on-surface uppercase tracking-tight">
                {chamado?.id ? 'Editar Chamado' : 'Novo Chamado'}
              </h2>
              <div className="flex items-center gap-2">
                {chamado?.id && (
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                      Abertura de Ordem de Serviço
                    </p>
                    {slaTimeRemaining && (
                      <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                        slaTimeRemaining.includes('Restam') ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                      }`}>
                        <Clock size={10} className="inline mr-1" />
                        SLA: {slaTimeRemaining}
                      </div>
                    )}
                  </div>
                )}
                {!chamado?.id && (
                  <button 
                    onClick={() => setIsQuickTicket(!isQuickTicket)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all ${
                      isQuickTicket ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    <Zap size={10} />
                    Chamado Rápido
                  </button>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-all text-on-surface-variant">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            {error && (
              <div className="bg-error/10 border border-error/20 p-4 rounded-2xl flex items-center gap-3 text-error text-sm font-bold">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cliente */}
              <div className="space-y-2">
                <label className={labelClass}>Cliente *</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <select 
                    className={`${inputClass} pl-12`}
                    value={formData.clienteId}
                    onChange={(e) => setFormData({ ...formData, clienteId: e.target.value, unidadeId: '', equipamentoClienteId: '' })}
                    required
                  >
                    <option value="">Selecione o Cliente</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nomeFantasia}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!isQuickTicket && (
                <>
                  {/* Unidade */}
                  <div className="space-y-2">
                    <label className={labelClass}>Unidade</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                      <select 
                        className={`${inputClass} pl-12`}
                        value={formData.unidadeId}
                        onChange={(e) => setFormData({ ...formData, unidadeId: e.target.value })}
                        disabled={!formData.clienteId}
                      >
                        <option value="">Selecione a Unidade</option>
                        {unidades.map(u => (
                          <option key={u.id} value={u.id}>{u.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Equipamento */}
              <div className="space-y-2">
                <label className={labelClass}>Equipamento</label>
                <div className="relative">
                  <Construction className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <select 
                    className={`${inputClass} pl-12`}
                    value={formData.equipamentoClienteId}
                    onChange={(e) => setFormData({ ...formData, equipamentoClienteId: e.target.value })}
                    disabled={!formData.clienteId}
                  >
                    <option value="">Selecione o Equipamento</option>
                    {equipamentos.map(e => {
                      const site = (e as any).site || (e as any).codigoUnidade || '';
                      const desc = (e as any).descricao || (e as any).unidadeNome || e.tipo || '';
                      const fiscal = (e as any).numero_fiscal || (e as any).numeroFiscal || e.numeroSerie || '';
                      const ipVal = (e as any).ip_equipamento || (e as any).ip || '';

                      const part1 = site && desc ? `${site} - ${desc}` : (site || desc);
                      const part2 = fiscal ? `Número fiscal: ${fiscal}` : '';
                      const part3 = ipVal ? `IP: ${ipVal}` : '';

                      const optionText = [part1, part2, part3].filter(Boolean).join(' | ');

                      return (
                        <option key={e.id} value={e.id}>
                          {optionText}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {!isQuickTicket && (
                <>
                  {/* Técnico */}
                  <div className="space-y-2">
                    <label className={labelClass}>Técnico Responsável *</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                      <select 
                        className={`${inputClass} pl-12`}
                        value={formData.tecnicoId}
                        onChange={(e) => setFormData({ ...formData, tecnicoId: e.target.value })}
                        required
                      >
                        <option value="">Selecione o Técnico</option>
                        {tecnicos.map(t => (
                          <option key={t.id} value={t.id}>{t.nome}</option>
                        ))}
                      </select>
                      {suggestedTechnician && (
                        <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-1 text-primary animate-pulse">
                          <Sparkles size={14} />
                          <span className="text-[8px] font-black uppercase">Sugerido</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status do Técnico (Preparação para App) */}
                  <div className="space-y-2">
                    <label className={labelClass}>Status do Chamado</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                      <select 
                        className={`${inputClass} pl-12`}
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      >
                        <option value="aberto">Aberto</option>
                        <option value="em_atendimento">Em Atendimento</option>
                        <option value="aguardando_cliente">Aguardando Cliente</option>
                        <option value="aguardando_peca">Aguardando Peça</option>
                        <option value="concluido">Concluído</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>
                  </div>

                  {/* Tipo Atendimento */}
                  <div className="space-y-2">
                    <label className={labelClass}>Tipo de Atendimento</label>
                    <div className="relative">
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                      <select 
                        className={`${inputClass} pl-12`}
                        value={formData.tipoAtendimento}
                        onChange={(e) => setFormData({ ...formData, tipoAtendimento: e.target.value as any })}
                      >
                        <option value="Remoto">Remoto</option>
                        <option value="Presencial">Presencial</option>
                        <option value="Telefone">Telefone</option>
                        <option value="Corretiva">Corretiva</option>
                        <option value="Preventiva">Preventiva</option>
                        <option value="Instalação">Instalação</option>
                        <option value="Treinamento">Treinamento</option>
                      </select>
                    </div>
                  </div>

                  {/* Prioridade */}
                  <div className="space-y-2">
                    <label className={labelClass}>Prioridade</label>
                    <div className="relative">
                      <AlertTriangle className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                      <select 
                        className={`${inputClass} pl-12`}
                        value={formData.prioridade}
                        onChange={(e) => setFormData({ ...formData, prioridade: e.target.value as any })}
                      >
                        <option value="baixa">Baixa (72h)</option>
                        <option value="media">Média (48h)</option>
                        <option value="alta">Alta (24h)</option>
                        <option value="critica">Crítica (4h)</option>
                      </select>
                    </div>
                  </div>

                  {/* SLA Deadline */}
                  <div className="space-y-2">
                    <label className={labelClass}>Prazo SLA (Manual)</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                      <input 
                        type="datetime-local" 
                        className={`${inputClass} pl-12`}
                        value={formData.slaDeadline}
                        onChange={(e) => setFormData({ ...formData, slaDeadline: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Valor Atendimento */}
                  <div className="space-y-2">
                    <label className={labelClass}>Valor do Atendimento</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                      <input 
                        type="number" 
                        className={`${inputClass} pl-12`}
                        value={formData.valorAtendimento}
                        onChange={(e) => setFormData({ ...formData, valorAtendimento: Number(e.target.value) })}
                        placeholder="0.00"
                        disabled={clientes.find(c => c.id === formData.clienteId)?.possuiContrato}
                      />
                      {clientes.find(c => c.id === formData.clienteId)?.possuiContrato ? (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-success">
                          <ShieldAlert size={14} />
                          <span className="text-[8px] font-black uppercase">Coberto</span>
                        </div>
                      ) : suggestedValue && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-primary">
                          <Sparkles size={14} />
                          <span className="text-[8px] font-black uppercase">Sugerido</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Título */}
            <div className="space-y-2">
              <label className={labelClass}>Título do Chamado *</label>
              <input 
                type="text" 
                className={inputClass}
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Catraca travada na entrada principal"
                required
              />
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <label className={labelClass}>Descrição do Problema</label>
              <textarea 
                className={`${inputClass} h-32 resize-none`}
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descreva detalhadamente o problema relatado pelo cliente..."
              />
            </div>

            {!isQuickTicket && (
              /* Fotos */
              <div className="space-y-4">
                <label className={labelClass}>Imagens / Fotos</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {formData.fotos?.map((foto, index) => (
                    <div key={index} className="relative aspect-video rounded-2xl overflow-hidden border border-surface-container-high group">
                      <img src={foto} alt={`Foto ${index}`} className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => removeFoto(index)}
                        className="absolute top-2 right-2 p-1.5 bg-error text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-video rounded-2xl border-2 border-dashed border-surface-container-high flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-surface-container-low transition-all text-on-surface-variant">
                    <ImageIcon size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Foto</span>
                    <input type="file" className="hidden" multiple accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
              </div>
            )}
          </form>

          {/* Intelligence Sidebar */}
          <div className="w-80 border-l border-surface-container-high bg-surface-container-low/30 p-6 overflow-y-auto custom-scrollbar space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={18} className="text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Inteligência do Chamado</h3>
            </div>

            {formData.equipamentoClienteId ? (
              <>
                {/* Health Score */}
                <div className="bg-surface-container-high/50 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-on-surface">
                      <Zap size={16} className={healthScore > 70 ? 'text-success' : healthScore > 40 ? 'text-warning' : 'text-error'} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Saúde do Equipamento</span>
                    </div>
                    <span className={`text-xs font-black ${healthScore > 70 ? 'text-success' : healthScore > 40 ? 'text-warning' : 'text-error'}`}>
                      {healthScore}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${healthScore > 70 ? 'bg-success' : healthScore > 40 ? 'bg-warning' : 'bg-error'}`}
                      style={{ width: `${healthScore}%` }}
                    />
                  </div>
                  <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-tighter">
                    {healthScore > 70 ? 'Equipamento em bom estado' : healthScore > 40 ? 'Necessita atenção técnica' : 'Estado crítico - Substituição sugerida'}
                  </p>
                </div>

                {/* Recurrence Alert */}
                {recurrenceAlert && (
                  <div className="bg-error/10 border border-error/20 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-error">
                      <ShieldAlert size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Falha Recorrente</span>
                    </div>
                    <p className="text-xs text-error/80 font-medium">
                      Este equipamento apresentou {equipmentHistory.length} chamados recentemente.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button 
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, tipoAtendimento: 'Preventiva', titulo: `[PREVENTIVA SUGERIDA] ${prev.titulo}` }))}
                        className="w-full py-2 bg-error/20 hover:bg-error/30 text-error text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                      >
                        Sugerir Preventiva
                      </button>
                      <button 
                        type="button"
                        className="w-full py-2 bg-error text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm"
                      >
                        Gerar Proposta de Troca
                      </button>
                    </div>
                  </div>
                )}

                {/* Suggested Solutions */}
                {suggestedSolutions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Sugestões de Solução</span>
                    </div>
                    <div className="space-y-2">
                      {suggestedSolutions.map((sol, i) => (
                        <div key={i} className="p-3 bg-primary/5 border border-primary/10 rounded-xl flex items-start gap-2">
                          <ChevronRight size={14} className="text-primary mt-0.5 shrink-0" />
                          <p className="text-[11px] font-medium text-on-surface">{sol}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Last Maintenance */}
                <div className="bg-surface-container-high/50 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-on-surface">
                    <History size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Última Manutenção</span>
                  </div>
                  <p className="text-xs font-bold">
                    {lastMaintenance ? new Date(lastMaintenance).toLocaleDateString() : 'Nenhuma preventiva registrada'}
                  </p>
                </div>

                {/* History List */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Últimos Chamados</span>
                  {equipmentHistory.slice(0, 3).map((h, i) => (
                    <div key={i} className="p-3 bg-surface-container-low border border-surface-container-high rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-primary">{h.status}</span>
                        <span className="text-[9px] text-on-surface-variant font-bold">{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ''}</span>
                      </div>
                      <p className="text-[11px] font-bold text-on-surface line-clamp-1">{h.titulo}</p>
                    </div>
                  ))}
                  {equipmentHistory.length === 0 && (
                    <p className="text-xs text-on-surface-variant italic">Nenhum histórico encontrado.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                  <Info size={24} />
                </div>
                <p className="text-xs text-on-surface-variant font-medium">
                  Selecione um equipamento para ver o histórico e sugestões inteligentes.
                </p>
              </div>
            )}

            {/* Client Info */}
            {formData.clienteId && (
              <div className="pt-6 border-t border-surface-container-high">
                <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Building2 size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Status do Cliente</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-on-surface-variant">CONTRATO</span>
                    <span className={`text-[10px] font-black uppercase ${clientes.find(c => c.id === formData.clienteId)?.possuiContrato ? 'text-success' : 'text-error'}`}>
                      {clientes.find(c => c.id === formData.clienteId)?.possuiContrato ? 'Ativo' : 'Sem Contrato'}
                    </span>
                  </div>
                  {suggestedValue && (
                    <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase">VALOR SUGERIDO</span>
                      <span className="text-xs font-black text-primary">R$ {suggestedValue.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-surface-container-high bg-surface-container-low/50 flex justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high rounded-2xl transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {chamado?.id ? 'Atualizar Chamado' : 'Abrir Chamado'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
