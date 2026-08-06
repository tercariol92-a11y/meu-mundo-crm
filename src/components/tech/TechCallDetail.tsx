import { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { Chamado, ChamadoStatus, Tecnico } from '../../types';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  MessageSquare, 
  Navigation,
  Clock,
  History,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Camera,
  Image,
  Save,
  PenTool,
  Tag,
  Smartphone,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SignaturePad from './SignaturePad';
import { CameraCaptureModal } from '../common/CameraCaptureModal';
import ServiceOrderPhotoGallery from '../support/ServiceOrderPhotoGallery';
import { serviceOrderPhotosService } from '../../services/serviceOrderPhotosService';

interface TechCallDetailProps {
  callId: string;
  tecnico: Tecnico;
  onBack: () => void;
  onStatusUpdate?: () => void;
}

export default function TechCallDetail({ callId, tecnico, onBack, onStatusUpdate }: TechCallDetailProps) {
  const [call, setCall] = useState<Chamado | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  // Local states for updating
  const [observacoes, setObservacoes] = useState('');
  const [servicoExecutado, setServicoExecutado] = useState('');
  const [pecas, setPecas] = useState<{ nome: string; quantidade: number }[]>([]);
  const [newPeca, setNewPeca] = useState({ nome: '', quantidade: 1 });

  useEffect(() => {
    async function loadData() {
      try {
        const data = await databaseService.getChamadoById(callId);
        if (data) {
          setCall(data);
          setObservacoes(data.observacoesTecnicas || '');
          setServicoExecutado(data.servicoExecutado || '');
          setPecas(data.pecasUtilizadas || []);
        }
      } catch (error) {
        console.error('Error loading call details:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [callId]);

  const updateStatus = async (newStatus: ChamadoStatus) => {
    if (!call) return;
    setIsSaving(true);
    try {
      await databaseService.updateChamado(call.id, { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      setCall({ ...call, status: newStatus });
      onStatusUpdate?.();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveData = async () => {
    if (!call) return;
    setIsSaving(true);
    try {
      const updates: Partial<Chamado> = {
        observacoesTecnicas: observacoes,
        servicoExecutado: servicoExecutado,
        pecasUtilizadas: pecas,
        updatedAt: new Date().toISOString()
      };
      await databaseService.updateChamado(call.id, updates);
      setCall({ ...call, ...updates });
    } catch (error) {
      console.error('Error saving call data:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinish = async (signatureDataUrl: string) => {
    if (!call) return;
    setIsSaving(true);
    try {
      const updates: Partial<Chamado> = {
        status: 'finalizado',
        assinaturaCliente: signatureDataUrl,
        assinaturaData: new Date().toISOString(),
        dataFechamento: new Date().toISOString(),
        observacoesTecnicas: observacoes,
        servicoExecutado: servicoExecutado,
        pecasUtilizadas: pecas,
        updatedAt: new Date().toISOString()
      };
      await databaseService.updateChamado(call.id, updates);
      setCall({ ...call, ...updates });
      setShowSignature(false);
      onStatusUpdate?.();
    } catch (error) {
      console.error('Error finishing call:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addPeca = () => {
    if (!newPeca.nome.trim()) return;
    setPecas([...pecas, newPeca]);
    setNewPeca({ nome: '', quantidade: 1 });
  };

  const removePeca = (index: number) => {
    setPecas(pecas.filter((_, i) => i !== index));
  };

  const openMaps = () => {
    if (!call?.unidade) return;
    const address = `${call.unidade.endereco}, ${call.unidade.cidade}, ${call.unidade.estado}`;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  const openWhatsApp = () => {
    if (!call?.cliente?.celularWhatsapp) return;
    const phone = call.cliente.celularWhatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}`, '_blank');
  };

  const makeCall = () => {
    if (!call?.cliente?.celularWhatsapp && !call?.cliente?.telefoneFixo) return;
    const phone = (call.cliente.celularWhatsapp || call.cliente.telefoneFixo || '').replace(/\D/g, '');
    window.open(`tel:${phone}`, '_blank');
  };

  if (isLoading || !call) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isFinalized = call.status === 'finalizado';

  return (
    <div className="flex flex-col h-full bg-surface pb-32">
      {/* Header */}
      <div className="bg-surface-container-low px-4 py-4 flex items-center gap-4 border-b border-surface-container-high sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">#{call.protocolo || call.id.slice(0, 8)}</p>
          <h1 className="text-lg font-black text-on-surface uppercase tracking-tight truncate max-w-[200px]">Atendimento</h1>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
          call.status === 'finalizado' ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'
        }`}>
          {call.status.replace('_', ' ')}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Customer Quick Info */}
        <section className="bg-surface-container-lowest p-6 rounded-[2.5rem] border border-surface-container-high shadow-sm space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary/5 rounded-3xl flex items-center justify-center text-primary border border-primary/10">
              <MapPin size={32} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-on-surface leading-tight uppercase tracking-tight">{call.cliente?.nomeFantasia || 'Cliente'}</h2>
              <p className="text-sm text-on-surface-variant line-clamp-2 mt-1">{call.unidade?.endereco || 'Endereço não informado'}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={makeCall}
              className="flex flex-col items-center justify-center gap-2 py-4 bg-surface-container-high rounded-3xl text-primary"
            >
              <Phone size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Ligar</span>
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={openWhatsApp}
              className="flex flex-col items-center justify-center gap-2 py-4 bg-green-50 rounded-3xl text-green-600"
            >
              <MessageSquare size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">WhatsApp</span>
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={openMaps}
              className="flex flex-col items-center justify-center gap-2 py-4 bg-blue-50 rounded-3xl text-blue-600"
            >
              <Navigation size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Rotas</span>
            </motion.button>
          </div>
        </section>

        {/* Call Info Content */}
        <section className="space-y-4 px-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em]">Detalhes da Chamada</h3>
          </div>
          <div className="space-y-4 bg-surface-container-low p-6 rounded-[2rem] border border-outline/30">
            <div>
              <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-50">Título</p>
              <h4 className="font-bold text-on-surface">{call.titulo}</h4>
            </div>
            {call.descricao && (
              <div>
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-50">Descrição do Problema</p>
                <p className="text-sm text-on-surface leading-relaxed">{call.descricao}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-50">Tipo</p>
                <div className="flex items-center gap-2 text-on-surface font-bold text-xs">
                  <Tag size={14} className="text-primary" />
                  {call.tipoAtendimento || 'Não informado'}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-50">Equipamento</p>
                <div className="flex items-center gap-2 text-on-surface font-bold text-xs">
                  <Smartphone size={14} className="text-primary" />
                  {call.equipamentoCliente?.nome || 'Não vinculado'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tech Forms */}
        <section className="space-y-6">
          <div className="px-2">
            <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em]">Registro Técnico</h3>
          </div>

          {!isFinalized && (
            <div className="grid grid-cols-2 gap-3 px-2">
              <button 
                onClick={() => updateStatus('em_deslocamento')}
                className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border-2 transition-all ${
                  call.status === 'em_deslocamento' 
                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                    : 'bg-white border-outline/20 text-on-surface-variant hover:border-primary'
                }`}
              >
                <Navigation size={18} />
                A Caminho
              </button>
              <button 
                onClick={() => updateStatus('em_atendimento')}
                className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border-2 transition-all ${
                  call.status === 'em_atendimento' 
                    ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20' 
                    : 'bg-white border-outline/20 text-on-surface-variant hover:border-orange-500'
                }`}
              >
                <Clock size={18} />
                No Local
              </button>
            </div>
          )}

          <div className="space-y-6 px-2">
            {/* Service Executed */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Serviço Executado</label>
              <textarea 
                readOnly={isFinalized}
                value={servicoExecutado}
                onChange={(e) => setServicoExecutado(e.target.value)}
                placeholder="Descreva o que foi feito..."
                rows={4}
                className="w-full bg-surface-container-low border-2 border-outline/20 rounded-3xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none"
              />
            </div>

            {/* Observations */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Observações / Pendências</label>
              <textarea 
                readOnly={isFinalized}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Notas técnicas ou problemas encontrados..."
                rows={3}
                className="w-full bg-surface-container-low border-2 border-outline/20 rounded-3xl p-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none"
              />
            </div>

            {/* Parts Used */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Peças e Materiais</label>
              
              {!isFinalized && (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Nome da peça"
                    value={newPeca.nome}
                    onChange={(e) => setNewPeca({ ...newPeca, nome: e.target.value })}
                    className="flex-1 bg-surface-container-low border-2 border-outline/20 rounded-2xl px-4 py-3 text-sm"
                  />
                  <input 
                    type="number" 
                    value={newPeca.quantidade}
                    onChange={(e) => setNewPeca({ ...newPeca, quantidade: Number(e.target.value) })}
                    className="w-20 bg-surface-container-low border-2 border-outline/20 rounded-2xl px-2 py-3 text-center text-sm"
                  />
                  <button 
                    onClick={addPeca}
                    className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-md"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {pecas.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-surface-container-low p-4 rounded-2xl border border-outline/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-black text-xs">
                        {p.quantidade}x
                      </div>
                      <span className="text-sm font-bold text-on-surface">{p.nome}</span>
                    </div>
                    {!isFinalized && (
                      <button onClick={() => removePeca(i)} className="text-error/60 hover:text-error p-1">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
                {pecas.length === 0 && (
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-widest text-center py-4 bg-surface-container-low rounded-2xl border border-dashed border-outline/30">Nenhuma peça registrada</p>
                )}
              </div>
            </div>

            {/* Photos */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Fotos do Atendimento</label>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {!isFinalized && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="w-24 h-24 bg-surface-container-high rounded-3xl border-2 border-dashed border-outline/30 flex flex-col items-center justify-center text-on-surface-variant gap-1 shrink-0 active:scale-95 transition-all cursor-pointer"
                    >
                      <Camera size={24} className="text-primary" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-center px-1">Câmera</span>
                    </button>
                    <label className="w-24 h-24 bg-surface-container-high rounded-3xl border-2 border-dashed border-outline/30 flex flex-col items-center justify-center text-on-surface-variant gap-1 shrink-0 active:scale-95 transition-all cursor-pointer">
                      <Image size={24} className="text-primary" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-center px-1">Galeria</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const uploaded=await serviceOrderPhotosService.upload(call.id,file,file.name);
                            const newFotos = [...(call.fotos || []), uploaded.url];
                            await databaseService.updateChamado(call.id, { fotos: newFotos });
                            setCall({ ...call, fotos: newFotos });
                          }
                        }}
                      />
                    </label>
                  </>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-full"><ServiceOrderPhotoGallery orderId={call.id} photos={call.fotos || []} addedBy={tecnico.nome} addedAt={call.updatedAt || call.createdAt} canDelete={!isFinalized && call.tecnicoId === tecnico.id} onDelete={async index => { const target=(call.fotos || [])[index]; await serviceOrderPhotosService.remove(target); const newFotos=(call.fotos || []).filter((_, photoIndex)=>photoIndex!==index); await databaseService.updateChamado(call.id,{fotos:newFotos}); setCall({...call,fotos:newFotos}); }} /></div>
              </div>
            </div>
          </div>
        </section>

        {/* History / Previous Attendance */}
        <section className="space-y-4 px-2">
          <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em]">Histórico do Cliente</h3>
          <div className="bg-surface-container-low p-4 rounded-[2rem] border border-outline/30 divide-y divide-outline/10">
            <div className="py-3 flex items-start gap-3">
              <History size={16} className="text-on-surface-variant opacity-40 mt-1" />
              <div>
                <p className="text-xs font-bold text-on-surface">Última manutenção em 12/03/2026</p>
                <p className="text-[10px] text-on-surface-variant">Troca de bobina e limpeza geral.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Signature View if finalized */}
        {isFinalized && call.assinaturaCliente && (
          <section className="space-y-4 px-2">
            <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em]">Assinatura</h3>
            <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline/30 flex flex-col items-center">
              <img src={call.assinaturaCliente} alt="Assinatura" className="max-h-32 mb-4" />
              <div className="text-center">
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Finalizado por {tecnico.nome}</p>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                  {call.assinaturaData ? new Date(call.assinaturaData).toLocaleString('pt-BR') : '-'}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Floating Action Bars */}
      {!isFinalized && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-surface/80 backdrop-blur-lg border-t border-surface-container-high z-20 flex gap-4 shadow-2xl">
          <button 
            onClick={handleSaveData}
            disabled={isSaving}
            className="flex-1 bg-surface-container-highest text-on-surface font-black uppercase tracking-widest text-xs py-5 rounded-3xl flex items-center justify-center gap-2 border-2 border-outline/10 active:scale-95 transition-all"
          >
            <Save size={20} />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
          <button 
            disabled={isSaving}
            onClick={() => setShowSignature(true)}
            className="flex-1 bg-primary text-white font-black uppercase tracking-widest text-xs py-5 rounded-3xl flex items-center justify-center gap-2 shadow-xl shadow-primary/30 active:scale-95 transition-all"
          >
            <CheckCircle2 size={20} />
            Finalizar
          </button>
        </div>
      )}

      {/* Signature Modal */}
      {showSignature && (
        <SignaturePad 
          onSave={handleFinish}
          onCancel={() => setShowSignature(false)}
        />
      )}

      {/* Other Statuses in a menu or quick access if needed */}
      {!isFinalized && (
        <div className="px-6 py-4 flex justify-around">
          <button 
            onClick={() => updateStatus('retorno_agendado')}
            className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100"
          >
            <Clock size={20} className="text-orange-500" />
            <span className="text-[8px] font-black uppercase tracking-widest">Reagendar</span>
          </button>
          <button 
            onClick={() => updateStatus('aguardando_peca')}
            className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100"
          >
            <AlertCircle size={20} className="text-error" />
            <span className="text-[8px] font-black uppercase tracking-widest">Aguard. Peça</span>
          </button>
          <button 
            onClick={() => updateStatus('não_concluido')}
            className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100"
          >
            <X size={20} className="text-on-surface-variant" />
            <span className="text-[8px] font-black uppercase tracking-widest">Incompleto</span>
          </button>
        </div>
      )}

      {call && (
        <CameraCaptureModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onCapture={async (base64Data) => {
            const uploaded=await serviceOrderPhotosService.uploadDataUrl(call.id,base64Data);
            const newFotos = [...(call.fotos || []), uploaded.url];
            await databaseService.updateChamado(call.id, { fotos: newFotos });
            setCall({ ...call, fotos: newFotos });
          }}
        />
      )}
    </div>
  );
}
