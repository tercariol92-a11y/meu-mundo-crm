import React, { useState, useEffect } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  Check, 
  Loader2, 
  Image as ImageIcon,
  Building2,
  Cpu,
  Bookmark,
  Hash,
  Calendar,
  MapPin,
  HelpCircle,
  Activity,
  MessageSquare,
  ShieldAlert
} from 'lucide-react';
import { User, Unidade, SolicitacaoEquipamento } from '../../types';
import { databaseService } from '../../services/databaseService';
import { toast } from 'react-hot-toast';

interface EquipmentRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  unidades: Unidade[];
  onSuccess: () => void;
  editingRequest: SolicitacaoEquipamento | null;
}

export default function EquipmentRegistrationModal({
  isOpen,
  onClose,
  user,
  unidades,
  onSuccess,
  editingRequest
}: EquipmentRegistrationModalProps) {
  const [unidadeId, setUnidadeId] = useState('');
  const [tipo, setTipo] = useState<'Placa' | 'Catraca' | 'Relógio de ponto' | 'Facial' | 'Outros'>('Placa');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [patrimonio, setPatrimonio] = useState('');
  const [dataAproximadaInstalacao, setDataAproximadaInstalacao] = useState('');
  const [localInstalacao, setLocalInstalacao] = useState('');
  const [adquiridoMundoTech, setAdquiridoMundoTech] = useState<'Sim' | 'Não' | 'Não sei'>('Não sei');
  const [funcionando, setFuncionando] = useState<'Sim' | 'Não' | 'Parcialmente'>('Sim');
  const [observacoes, setObservacoes] = useState('');
  
  // File inputs
  const [fotoEquipamento, setFotoEquipamento] = useState<string>('');
  const [fotoEtiqueta, setFotoEtiqueta] = useState<string>('');
  const [notaFiscalDoc, setNotaFiscalDoc] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);

  // Filter units user has access to
  const allowedUnidadesIds: string[] = [];
  if ((user as any).unidadeId) {
    allowedUnidadesIds.push((user as any).unidadeId);
  }
  if ((user as any).unidadesIds && Array.isArray((user as any).unidadesIds)) {
    allowedUnidadesIds.push(...(user as any).unidadesIds);
  }

  const userUnits = unidades.filter(u => {
    if (allowedUnidadesIds.length > 0) {
      return allowedUnidadesIds.includes(u.id);
    }
    return true;
  });

  useEffect(() => {
    if (editingRequest) {
      setUnidadeId(editingRequest.unidadeId || '');
      setTipo(editingRequest.tipo || 'Placa');
      setMarca(editingRequest.marca || '');
      setModelo(editingRequest.modelo || '');
      setNumeroSerie(editingRequest.numeroSerie || '');
      setPatrimonio(editingRequest.patrimonio || '');
      setDataAproximadaInstalacao(editingRequest.dataAproximadaInstalacao || '');
      setLocalInstalacao(editingRequest.localInstalacao || '');
      setAdquiridoMundoTech(editingRequest.adquiridoMundoTech || 'Não sei');
      setFuncionando(editingRequest.funcionando || 'Sim');
      setObservacoes(editingRequest.observacoes || '');
      setFotoEquipamento(editingRequest.fotoEquipamento || '');
      setFotoEtiqueta(editingRequest.fotoEtiqueta || '');
      setNotaFiscalDoc(editingRequest.notaFiscalDoc || '');
    } else {
      // Default initial states
      if (userUnits.length > 0) {
        setUnidadeId(userUnits[0].id);
      }
      setTipo('Placa');
      setMarca('');
      setModelo('');
      setNumeroSerie('');
      setPatrimonio('');
      setDataAproximadaInstalacao('');
      setLocalInstalacao('');
      setAdquiridoMundoTech('Não sei');
      setFuncionando('Sim');
      setObservacoes('');
      setFotoEquipamento('');
      setFotoEtiqueta('');
      setNotaFiscalDoc('');
    }
  }, [editingRequest, isOpen, unidades]);

  if (!isOpen) return null;

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'equipamento' | 'etiqueta' | 'documento') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 5MB.");
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      if (type === 'equipamento') {
        setFotoEquipamento(base64);
      } else if (type === 'etiqueta') {
        setFotoEtiqueta(base64);
      } else {
        setNotaFiscalDoc(base64);
      }
      toast.success("Arquivo carregado com sucesso!");
    } catch (err) {
      console.error("Error converting file to base64:", err);
      toast.error("Erro ao carregar o arquivo.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unidadeId) {
      toast.error("Selecione a unidade instalada.");
      return;
    }
    if (!numeroSerie.trim()) {
      toast.error("O número de série é obrigatório.");
      return;
    }
    if (!fotoEquipamento) {
      toast.error("A foto do equipamento é obrigatória.");
      return;
    }
    if (!fotoEtiqueta) {
      toast.error("A foto da etiqueta com número de série é obrigatória.");
      return;
    }

    setSubmitting(true);
    try {
      // Find unit name
      const targetUnit = unidades.find(u => u.id === unidadeId);
      const unidadeNome = targetUnit?.nome || 'Unidade';

      // 1. Check if the serial number already exists in the system
      const existing = await databaseService.checkSerialNumberExists(numeroSerie.trim());
      
      let isDuplicated = false;
      let analiseDuplicidade = false;

      if (existing) {
        if (existing.clienteId === user.clienteId && existing.unidadeId === unidadeId) {
          toast.error("Este equipamento já está cadastrado em sua conta nesta unidade.");
          setSubmitting(false);
          return;
        } else {
          // If it's linked to another unit or another client, we create a duplication review request
          analiseDuplicidade = true;
          isDuplicated = true;
        }
      }

      const payload: Omit<SolicitacaoEquipamento, 'id' | 'createdAt' | 'updatedAt'> = {
        clienteId: user.clienteId!,
        unidadeId,
        tipo,
        marca: marca.trim(),
        modelo: modelo.trim(),
        numeroSerie: numeroSerie.trim(),
        patrimonio: patrimonio.trim() || undefined,
        dataAproximadaInstalacao,
        localInstalacao: localInstalacao.trim(),
        adquiridoMundoTech,
        funcionando,
        observacoes: observacoes.trim() || undefined,
        fotoEquipamento,
        fotoEtiqueta,
        notaFiscalDoc: notaFiscalDoc || undefined,
        status: 'Aguardando validação',
        analiseDuplicidade,
        createdBy: user.email || 'cliente',
        // Attach joins for easier list viewing
        unidade: targetUnit ? { id: targetUnit.id, nome: targetUnit.nome } as any : undefined
      };

      if (editingRequest) {
        await databaseService.updateSolicitacaoEquipamento(editingRequest.id, payload);
        toast.success("Solicitação de cadastro atualizada com sucesso!");
      } else {
        await databaseService.createSolicitacaoEquipamento(payload);
        if (isDuplicated) {
          toast.success("Este número de série já existe no sistema. Sua solicitação foi enviada para análise da equipe Mundo Tech.", { duration: 6000 });
        } else {
          toast.success("Solicitação de cadastro enviada com sucesso!");
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error submitting equipment request:", err);
      toast.error("Erro ao processar solicitação de cadastro.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm overflow-y-auto">
      <div className="bg-surface rounded-[40px] border border-surface-container-high w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-surface px-8 py-6 border-b border-surface-container-high flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-on-surface">
              {editingRequest ? 'Editar Solicitação de Cadastro' : 'Cadastrar Equipamento'}
            </h2>
            <p className="text-xs text-on-surface-variant font-medium mt-1">
              Envie as informações do seu equipamento para validação pela equipe técnica Mundo Tech.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-3 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-8 space-y-8 flex-1">
          
          {/* Sessão 1: Informações Gerais */}
          <div className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <Cpu size={16} /> Informações do Equipamento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Unidade */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block flex items-center gap-1">
                  <Building2 size={12} className="text-primary/70" /> Unidade Instalada *
                </label>
                <select
                  required
                  value={unidadeId}
                  onChange={(e) => setUnidadeId(e.target.value)}
                  className="w-full px-4 py-3.5 bg-surface-container-low border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Selecione uma unidade...</option>
                  {userUnits.map(unit => (
                    <option key={unit.id} value={unit.id}>{unit.nome}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de Equipamento */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block flex items-center gap-1">
                  <Cpu size={12} className="text-primary/70" /> Tipo de Equipamento *
                </label>
                <select
                  required
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as any)}
                  className="w-full px-4 py-3.5 bg-surface-container-low border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Placa">Placa</option>
                  <option value="Catraca">Catraca</option>
                  <option value="Relógio de ponto">Relógio de ponto</option>
                  <option value="Facial">Facial</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              {/* Marca */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block flex items-center gap-1">
                  <Bookmark size={12} className="text-primary/70" /> Marca *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Control iD, Henry, Intelbras..."
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  className="w-full px-4 py-3.5 bg-surface-container-low border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Modelo */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block flex items-center gap-1">
                  <Bookmark size={12} className="text-primary/70" /> Modelo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: iDAccess, Primme SF, facial iDFace..."
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  className="w-full px-4 py-3.5 bg-surface-container-low border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Número de Série */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block flex items-center gap-1">
                  <Hash size={12} className="text-primary/70" /> Número de Série *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Identificação única do fabricante..."
                  value={numeroSerie}
                  onChange={(e) => setNumeroSerie(e.target.value)}
                  className="w-full px-4 py-3.5 bg-surface-container-low border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Número de Patrimônio */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block flex items-center gap-1">
                  <Hash size={12} className="text-primary/70" /> Número de Patrimônio (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Número de tombo/patrimônio interno..."
                  value={patrimonio}
                  onChange={(e) => setPatrimonio(e.target.value)}
                  className="w-full px-4 py-3.5 bg-surface-container-low border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Data Aproximada de Instalação */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block flex items-center gap-1">
                  <Calendar size={12} className="text-primary/70" /> Data Aproximada da Instalação *
                </label>
                <input
                  type="date"
                  required
                  value={dataAproximadaInstalacao}
                  onChange={(e) => setDataAproximadaInstalacao(e.target.value)}
                  className="w-full px-4 py-3.5 bg-surface-container-low border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Local de Instalação */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block flex items-center gap-1">
                  <MapPin size={12} className="text-primary/70" /> Local de Instalação (Setor/Localidade) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Recepção, Entrada Principal, Almoxarifado..."
                  value={localInstalacao}
                  onChange={(e) => setLocalInstalacao(e.target.value)}
                  className="w-full px-4 py-3.5 bg-surface-container-low border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Sessão 2: Informações de Aquisição & Operação */}
          <div className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <Activity size={16} /> Estado do Equipamento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Adquirido com Mundo Tech */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3 block flex items-center gap-1">
                  <HelpCircle size={12} className="text-primary/70" /> Equipamento adquirido com a Mundo Tech?
                </label>
                <div className="flex gap-3">
                  {(['Sim', 'Não', 'Não sei'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setAdquiridoMundoTech(option)}
                      className={`flex-1 py-3 border rounded-xl text-xs font-bold transition-all ${
                        adquiridoMundoTech === option
                          ? 'bg-primary/5 text-primary border-primary shadow-sm'
                          : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:bg-surface-container-high/50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Funcionamento */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3 block flex items-center gap-1">
                  <Activity size={12} className="text-primary/70" /> O Equipamento está funcionando?
                </label>
                <div className="flex gap-3">
                  {(['Sim', 'Não', 'Parcialmente'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFuncionando(option)}
                      className={`flex-1 py-3 border rounded-xl text-xs font-bold transition-all ${
                        funcionando === option
                          ? 'bg-primary/5 text-primary border-primary shadow-sm'
                          : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:bg-surface-container-high/50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block flex items-center gap-1">
                <MessageSquare size={12} className="text-primary/70" /> Observações Adicionais
              </label>
              <textarea
                placeholder="Descreva observações, histórico, detalhes técnicos que possam auxiliar na validação do equipamento..."
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-low border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
          </div>

          {/* Sessão 3: Fotos & Documentos */}
          <div className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <ImageIcon size={16} /> Fotos e Documentação
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Foto do Equipamento */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">
                  Foto do Equipamento *
                </label>
                <div className="border border-dashed border-surface-container-high rounded-3xl p-6 text-center hover:bg-surface-container-low/40 transition-colors flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden bg-surface-container-low">
                  {fotoEquipamento ? (
                    <div className="absolute inset-0 group">
                      <img src={fotoEquipamento} alt="Equipamento" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <label className="cursor-pointer px-4 py-2 bg-white/95 text-primary text-xs font-bold rounded-lg hover:scale-105 transition-transform shadow-lg">
                          Alterar Foto
                          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'equipamento')} className="hidden" />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2 w-full">
                      <UploadCloud size={32} className="text-on-surface-variant/50" />
                      <span className="text-xs font-bold text-on-surface">Enviar Foto</span>
                      <span className="text-[9px] text-on-surface-variant font-medium">JPEG, PNG até 5MB</span>
                      <input type="file" required accept="image/*" onChange={(e) => handleFileChange(e, 'equipamento')} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              {/* Foto da Etiqueta */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">
                  Etiqueta com S/N *
                </label>
                <div className="border border-dashed border-surface-container-high rounded-3xl p-6 text-center hover:bg-surface-container-low/40 transition-colors flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden bg-surface-container-low">
                  {fotoEtiqueta ? (
                    <div className="absolute inset-0 group">
                      <img src={fotoEtiqueta} alt="Etiqueta S/N" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <label className="cursor-pointer px-4 py-2 bg-white/95 text-primary text-xs font-bold rounded-lg hover:scale-105 transition-transform shadow-lg">
                          Alterar Foto
                          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'etiqueta')} className="hidden" />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2 w-full">
                      <UploadCloud size={32} className="text-on-surface-variant/50" />
                      <span className="text-xs font-bold text-on-surface">Enviar Foto</span>
                      <span className="text-[9px] text-on-surface-variant font-medium">Foque no número de série</span>
                      <input type="file" required accept="image/*" onChange={(e) => handleFileChange(e, 'etiqueta')} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              {/* Nota Fiscal ou Documento */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">
                  Nota Fiscal ou Doc (Opcional)
                </label>
                <div className="border border-dashed border-surface-container-high rounded-3xl p-6 text-center hover:bg-surface-container-low/40 transition-colors flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden bg-surface-container-low">
                  {notaFiscalDoc ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-primary/5">
                      <FileText size={36} className="text-primary mb-2 animate-bounce" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary truncate max-w-full px-2">Documento Anexado</span>
                      <label className="cursor-pointer mt-3 px-3 py-1 bg-surface border border-primary/20 text-primary text-[10px] font-bold rounded-lg hover:bg-primary/5">
                        Substituir Doc
                        <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'documento')} className="hidden" />
                      </label>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2 w-full">
                      <UploadCloud size={32} className="text-on-surface-variant/50" />
                      <span className="text-xs font-bold text-on-surface">Anexar NF ou PDF</span>
                      <span className="text-[9px] text-on-surface-variant font-medium">Nota fiscal ou recibo</span>
                      <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'documento')} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-6 border-t border-surface-container-high flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-3.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3.5 bg-primary hover:bg-primary/90 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check size={16} />
                  {editingRequest ? 'Salvar Alterações' : 'Enviar Solicitação'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
