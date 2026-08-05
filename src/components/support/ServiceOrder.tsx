import { useState, useEffect, useRef } from 'react';
import { databaseService } from '../../services/databaseService';
import { Chamado } from '../../types';
import { 
  X, 
  Save, 
  Loader2, 
  AlertCircle, 
  User, 
  Building2, 
  Construction, 
  Clock, 
  CheckCircle2,
  Play,
  Camera,
  Image,
  Edit2,
  PenTool,
  FileText,
  MapPin,
  Trash2,
  Plus,
  Check,
  Pause,
  Send,
  MessageSquare,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SignatureCanvas from 'react-signature-canvas';
import { CameraCaptureModal } from '../common/CameraCaptureModal';
import OSPrintViewer from './OSPrintViewer';

interface ServiceOrderProps {
  chamadoId: string;
  onClose: () => void;
  onUpdate: () => void;
  onEdit?: (chamado: Chamado) => void;
}

export default function ServiceOrder({ chamadoId, onClose, onUpdate, onEdit }: ServiceOrderProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [solucao, setSolucao] = useState('');
  const [obs, setObs] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<{ item: string; concluido: boolean }[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [showSendOptions, setShowSendOptions] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const sigPad = useRef<SignatureCanvas>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const fetchChamado = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await databaseService.getChamadoById(chamadoId);
        if (data) {
          setChamado(data);
          setSolucao(data.solucaoAplicada || '');
          setObs(data.observacoesTecnicas || '');
          setFotos(data.fotos || []);
          setChecklist(data.checklist || [
            { item: 'Verificação de cabos e conexões', concluido: false },
            { item: 'Limpeza do equipamento', concluido: false },
            { item: 'Teste de funcionamento', concluido: false },
            { item: 'Verificação de software/firmware', concluido: false }
          ]);
        } else {
          setError('Chamado não encontrado.');
        }
      } catch (err) {
        console.error('Error fetching chamado:', err);
        setError('Erro ao carregar os dados do chamado.');
      } finally {
        setLoading(false);
      }
    };
    fetchChamado();
  }, [chamadoId]);

  const handleStart = async () => {
    if (!chamado) return;
    setSaving(true);
    try {
      await databaseService.updateChamado(chamado.id, {
        status: 'em_atendimento',
        dataInicioAtendimento: new Date().toISOString()
      });
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error starting service:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleWaitPart = async () => {
    if (!chamado) return;
    setSaving(true);
    try {
      await databaseService.updateChamado(chamado.id, {
        status: 'aguardando_peca',
        solucaoAplicada: solucao,
        observacoesTecnicas: obs,
        fotos: fotos,
        checklist: checklist
      });
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error setting waiting for part:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleWaitClient = async () => {
    if (!chamado) return;
    setSaving(true);
    try {
      await databaseService.updateChamado(chamado.id, {
        status: 'aguardando_cliente',
        solucaoAplicada: solucao,
        observacoesTecnicas: obs,
        fotos: fotos,
        checklist: checklist
      });
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error setting waiting for client:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSendToClient = async (via: 'whatsapp' | 'email') => {
    if (!chamado) return;
    setSending(true);
    setError(null);
    try {
      // Simulate sending notification
      // In a real app, this would call a Cloud Function or an API
      await databaseService.updateChamado(chamado.id, {
        sentToClient: true,
        sentVia: via === 'whatsapp' ? 'whatsapp' : 'email',
        notifications: [
          ...(chamado.notifications || []),
          {
            id: Math.random().toString(36).substr(2, 9),
            userId: chamado.tecnicoId || '',
            ticketId: chamado.id,
            title: 'Resumo Enviado',
            type: 'success',
            read: false,
            createdAt: new Date().toISOString(),
            message: `Resumo do atendimento #${chamado.id.slice(-6).toUpperCase()} enviado via ${via}.`
          }
        ]
      });
      
      setShowSendOptions(false);
      onUpdate();
    } catch (err) {
      console.error('Error sending to client:', err);
      setError('Erro ao enviar resumo. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const handleFinish = async () => {
    if (!chamado) return;
    setError(null);

    if (!solucao) {
      setError('Por favor, descreva a solução aplicada.');
      // Scroll to the solution field
      const solutionEl = document.getElementById('solucao-textarea');
      if (solutionEl) {
        solutionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        solutionEl.focus();
      }
      return;
    }

    let signatureData = '';
    if (sigPad.current && !sigPad.current.isEmpty()) {
      signatureData = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
    }

    setSaving(true);
    try {
      await databaseService.updateChamado(chamado.id, {
        status: 'concluido',
        solucaoAplicada: solucao,
        observacoesTecnicas: obs,
        fotos: fotos,
        checklist: checklist,
        assinaturaCliente: signatureData,
        dataFechamento: new Date().toISOString()
      });
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error finishing service:', err);
      setError('Erro ao finalizar atendimento. Verifique sua conexão ou permissões.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setFotos(prev => [...prev, ...base64Files]);
      } catch (err) {
        console.error('Error reading files:', err);
      }
    }
  };

  const removeFoto = (index: number) => {
    const newFotos = [...fotos];
    newFotos.splice(index, 1);
    setFotos(newFotos);
  };

  const toggleChecklist = (index: number) => {
    const newChecklist = [...checklist];
    newChecklist[index].concluido = !newChecklist[index].concluido;
    setChecklist(newChecklist);
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist([...checklist, { item: newChecklistItem, concluido: false }]);
    setNewChecklistItem('');
  };

  const removeChecklistItem = (index: number) => {
    const newChecklist = [...checklist];
    newChecklist.splice(index, 1);
    setChecklist(newChecklist);
  };

  const clearSignature = () => {
    if (sigPad.current) sigPad.current.clear();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!chamado) return null;

  const labelClass = "block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5";
  const inputClass = "w-full bg-surface-container-highest border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-container rounded-[40px] w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-surface-container-high flex flex-col"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low/50">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              chamado.status === 'concluido' ? 'bg-success/10 text-success' : 
              chamado.status === 'aguardando_peca' ? 'bg-warning/10 text-warning' :
              'bg-primary/10 text-primary'
            }`}>
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-on-surface uppercase tracking-tight">
                Ordem de Serviço #{chamado.id.slice(-6).toUpperCase()}
              </h2>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                {chamado.tipoAtendimento} • {chamado.prioridade}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setExporting(true)} 
              className="p-2 hover:bg-surface-container-high rounded-full transition-all text-blue-600"
              title="Exportar OS"
            >
              <FileText size={24} />
            </button>
            <button 
              onClick={() => onEdit?.(chamado)} 
              className="p-2 hover:bg-surface-container-high rounded-full transition-all text-primary"
              title="Editar Chamado"
            >
              <Edit2 size={24} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-all text-on-surface-variant">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar"
        >
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Dados do Cliente</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="text-on-surface-variant" size={18} />
                  <span className="text-sm font-bold text-on-surface">{chamado.cliente?.nomeFantasia || '---'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="text-on-surface-variant" size={18} />
                  <span className="text-sm text-on-surface-variant">{chamado.unidade?.nome || 'Unidade Principal'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="text-on-surface-variant" size={18} />
                  <span className="text-sm text-on-surface-variant">{chamado.cliente?.cidade} - {chamado.cliente?.estado}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Equipamento & Técnico</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Construction className="text-on-surface-variant" size={18} />
                  <span className="text-sm font-bold text-on-surface">
                    {chamado.equipamentoCliente?.tipo} - {chamado.equipamentoCliente?.marca}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <User className="text-on-surface-variant" size={18} />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-on-surface-variant">Técnico:</span>
                    <span className="text-sm font-bold text-on-surface">{chamado.tecnico?.nome || 'Não atribuído'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="text-on-surface-variant" size={18} />
                  <span className="text-sm text-on-surface-variant">SLA: {chamado.slaPrazo ? new Date(chamado.slaPrazo).toLocaleString() : '---'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Issue Description */}
          <div className="space-y-2">
            <label className={labelClass}>Descrição do Problema</label>
            <div className="p-4 bg-surface-container-highest rounded-2xl text-sm text-on-surface border border-surface-container-high italic">
              "{chamado.descricao}"
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-4">
            <label className={labelClass}>Checklist de Atendimento</label>
            <div className="bg-surface-container-low rounded-3xl border border-surface-container-high overflow-hidden">
              <div className="p-4 space-y-2">
                {checklist.map((item, index) => (
                  <div key={index} className="flex items-center justify-between group">
                    <button
                      type="button"
                      onClick={() => toggleChecklist(index)}
                      className="flex items-center gap-3 flex-1 text-left"
                      disabled={chamado.status === 'concluido'}
                    >
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        item.concluido ? 'bg-success border-success text-white' : 'border-surface-container-highest'
                      }`}>
                        {item.concluido && <Check size={14} />}
                      </div>
                      <span className={`text-sm ${item.concluido ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                        {item.item}
                      </span>
                    </button>
                    {chamado.status !== 'concluido' && (
                      <button 
                        onClick={() => removeChecklistItem(index)}
                        className="p-1.5 text-error opacity-0 group-hover:opacity-100 transition-all hover:bg-error/10 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {chamado.status !== 'concluido' && (
                <div className="p-4 bg-surface-container-high/50 border-t border-surface-container-high flex gap-2">
                  <input 
                    type="text"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    placeholder="Novo item de checklist..."
                    className="flex-1 bg-surface-container-highest border-none rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-primary/20"
                    onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                  />
                  <button 
                    onClick={addChecklistItem}
                    className="p-2 bg-primary text-white rounded-xl hover:scale-105 transition-all"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* OS Fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className={labelClass}>Solução Aplicada *</label>
              <textarea 
                id="solucao-textarea"
                className={`${inputClass} h-32 resize-none ${error && !solucao ? 'border-error ring-1 ring-error/20' : ''}`}
                value={solucao}
                onChange={(e) => {
                  setSolucao(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Descreva o que foi feito para resolver o problema..."
                disabled={chamado.status === 'concluido'}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Observações Técnicas</label>
              <textarea 
                className={`${inputClass} h-24 resize-none`}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Observações adicionais, peças trocadas, etc..."
                disabled={chamado.status === 'concluido'}
              />
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className={labelClass}>Fotos do Atendimento (Antes/Depois)</label>
              {chamado.status !== 'concluido' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 border border-primary/25 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    <Camera size={14} /> Tirar Foto (Câmera)
                  </button>
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 border border-primary/25 px-3 py-1.5 rounded-lg transition-all cursor-pointer">
                    <Image size={14} /> Escolher da Galeria
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoUpload} />
                  </label>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {fotos.map((foto, index) => (
                <div key={index} className="relative aspect-video rounded-2xl overflow-hidden border border-surface-container-high group">
                  <img src={foto} alt={`OS Foto ${index}`} className="w-full h-full object-cover" />
                  {chamado.status !== 'concluido' && (
                    <button 
                      onClick={() => removeFoto(index)}
                      className="absolute top-2 right-2 p-1.5 bg-error text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {fotos.length === 0 && (
                <div className="md:col-span-4 py-8 text-center bg-surface-container-low rounded-2xl border-2 border-dashed border-surface-container-high">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nenhuma foto registrada.</p>
                </div>
              )}
            </div>
          </div>

          {/* Signature */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Assinatura do Cliente</label>
              {chamado.status !== 'concluido' && (
                <button 
                  onClick={clearSignature}
                  className="text-[10px] font-black uppercase tracking-widest text-error hover:bg-error/10 px-3 py-1.5 rounded-lg transition-all"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="bg-white rounded-3xl border-2 border-dashed border-surface-container-high overflow-hidden">
              {chamado.assinaturaCliente ? (
                <div className="h-48 flex items-center justify-center p-4">
                  <img src={chamado.assinaturaCliente} alt="Assinatura" className="max-h-full" />
                </div>
              ) : chamado.status === 'concluido' ? (
                <div className="h-48 flex items-center justify-center text-on-surface-variant opacity-40">
                  <PenTool size={32} />
                  <span className="ml-3 text-[10px] font-black uppercase tracking-widest">Sem assinatura registrada</span>
                </div>
              ) : (
                <SignatureCanvas 
                  ref={sigPad}
                  penColor="black"
                  canvasProps={{
                    className: "w-full h-48 cursor-crosshair"
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-surface-container-high bg-surface-container-low/50 flex flex-col gap-4">
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-error/10 border border-error/20 p-3 rounded-2xl flex items-center gap-3 text-error"
              >
                <AlertCircle size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
            {chamado.status === 'concluido' && (
              <div className="relative">
                <button
                  onClick={() => setShowSendOptions(!showSendOptions)}
                  className="px-6 py-3 bg-primary/10 text-primary text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-primary/20 transition-all flex items-center gap-2"
                >
                  <Send size={18} />
                  Enviar Resumo
                </button>

                <AnimatePresence>
                  {showSendOptions && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 mb-2 w-48 bg-surface-container rounded-2xl shadow-xl border border-surface-container-high overflow-hidden z-10"
                    >
                      <button
                        onClick={() => handleSendToClient('whatsapp')}
                        disabled={sending}
                        className="w-full px-4 py-3 text-left text-xs font-bold text-on-surface hover:bg-surface-container-high flex items-center gap-3 transition-all"
                      >
                        <MessageSquare size={16} className="text-success" />
                        WhatsApp
                      </button>
                      <button
                        onClick={() => handleSendToClient('email')}
                        disabled={sending}
                        className="w-full px-4 py-3 text-left text-xs font-bold text-on-surface hover:bg-surface-container-high flex items-center gap-3 transition-all border-t border-surface-container-high"
                      >
                        <Mail size={16} className="text-primary" />
                        E-mail
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {chamado.status === 'aberto' && (
              <button
                onClick={handleStart}
                disabled={saving}
                className="px-8 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                Iniciar Atendimento
              </button>
            )}
            {(chamado.status === 'em_atendimento' || chamado.status === 'aguardando_peca' || chamado.status === 'aguardando_cliente') && (
              <>
                <button
                  onClick={handleWaitClient}
                  disabled={saving}
                  className="px-6 py-3 bg-surface-container-high text-on-surface text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-surface-container-highest transition-all flex items-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <User size={18} />}
                  Aguardando Cliente
                </button>
                <button
                  onClick={handleWaitPart}
                  disabled={saving}
                  className="px-6 py-3 bg-warning text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-lg shadow-warning/20 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Pause size={18} />}
                  Aguardando Peça
                </button>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="px-8 py-3 bg-success text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-lg shadow-success/20 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  Finalizar Atendimento
                </button>
              </>
            )}
            {chamado.status === 'concluido' && (
              <div className="flex items-center gap-2 text-success bg-success/10 px-6 py-3 rounded-2xl border border-success/20">
                <CheckCircle2 size={18} />
                <span className="text-xs font-black uppercase tracking-widest">Atendimento Concluído</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>

    <CameraCaptureModal
      isOpen={isCameraOpen}
      onClose={() => setIsCameraOpen(false)}
      onCapture={(base64Data) => {
        setFotos(prev => [...prev, base64Data]);
      }}
    />

    {exporting && (
      <OSPrintViewer 
        chamado={chamado}
        onClose={() => setExporting(false)}
      />
    )}
  </div>
);
}
