import { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Building2, 
  Package, 
  Wrench, 
  Calendar, 
  User, 
  MapPin, 
  FileText,
  Tag,
  Hash,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { databaseService } from '../../services/databaseService';
import { EquipamentoCliente, Cliente, Unidade, Tecnico } from '../../types';

interface EquipmentFormProps {
  equipment: EquipamentoCliente | null;
  onClose: () => void;
  onSuccess: () => void;
  clients: Cliente[];
  units: Unidade[];
  tecnicos: Tecnico[];
}

export default function EquipmentForm({ equipment, onClose, onSuccess, clients, units, tecnicos }: EquipmentFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<EquipamentoCliente>>({
    clienteId: equipment?.clienteId || '',
    unidadeId: equipment?.unidadeId || '',
    tipo: equipment?.tipo || 'Outros',
    marca: equipment?.marca || '',
    modelo: equipment?.modelo || '',
    numeroSerie: equipment?.numeroSerie || '',
    patrimonio: equipment?.patrimonio || '',
    localInstalacao: equipment?.localInstalacao || '',
    dataInstalacao: equipment?.dataInstalacao || new Date().toISOString().split('T')[0],
    dataProximaPreventiva: equipment?.dataProximaPreventiva || '',
    dataUltimaManutencao: equipment?.dataUltimaManutencao || '',
    tecnicoResponsavelId: equipment?.tecnicoResponsavelId || '',
    status: equipment?.status || 'Em operação',
    observacoesTecnicas: equipment?.observacoesTecnicas || '',
    quantidade: equipment?.quantidade || 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (equipment?.id) {
        await databaseService.updateEquipamentoCliente(equipment.id, formData);
      } else {
        await databaseService.createEquipamentoCliente(formData as any);
      }
      onSuccess();
    } catch (error) {
      console.error("Error saving equipment:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUnits = units.filter(u => u.clienteId === formData.clienteId);

  const labelClass = "text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5 block";
  const inputClass = "w-full px-4 py-3 bg-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-primary/20";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-surface-container-lowest rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <Package size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-on-surface uppercase tracking-tighter">
                {equipment ? 'Editar Equipamento' : 'Novo Equipamento'}
              </h2>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Cadastro Técnico de Ativo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Section: Identificação */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-surface-container-high pb-2">
              <Building2 size={16} className="text-primary" />
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface">Identificação e Localização</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={labelClass}>Cliente *</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <select 
                    className={`${inputClass} pl-12`}
                    value={formData.clienteId}
                    onChange={(e) => setFormData({ ...formData, clienteId: e.target.value, unidadeId: '' })}
                    required
                  >
                    <option value="">Selecione o Cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Unidade</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <select 
                    className={`${inputClass} pl-12`}
                    value={formData.unidadeId}
                    onChange={(e) => setFormData({ ...formData, unidadeId: e.target.value })}
                  >
                    <option value="">Sede / Principal</option>
                    {filteredUnits.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Local de Instalação</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <input 
                    type="text" 
                    className={`${inputClass} pl-12`}
                    placeholder="Ex: Recepção, Portaria Norte..."
                    value={formData.localInstalacao}
                    onChange={(e) => setFormData({ ...formData, localInstalacao: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Data de Instalação</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <input 
                    type="date" 
                    className={`${inputClass} pl-12`}
                    value={formData.dataInstalacao}
                    onChange={(e) => setFormData({ ...formData, dataInstalacao: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Especificações */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-surface-container-high pb-2">
              <Package size={16} className="text-primary" />
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface">Especificações do Equipamento</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className={labelClass}>Tipo de Equipamento *</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <select 
                    className={`${inputClass} pl-12`}
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                    required
                  >
                    <option value="Placa">Placa</option>
                    <option value="Catraca">Catraca</option>
                    <option value="Relógio de ponto">Relógio de ponto</option>
                    <option value="Facial">Facial</option>
                    <option value="Outros">Outros equipamentos</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Marca</label>
                <div className="relative">
                  <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <input 
                    type="text" 
                    className={`${inputClass} pl-12`}
                    placeholder="Ex: Henry, Intelbras..."
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Modelo</label>
                <div className="relative">
                  <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <input 
                    type="text" 
                    className={`${inputClass} pl-12`}
                    placeholder="Ex: Primme SF, iFace..."
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Número de Série</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <input 
                    type="text" 
                    className={`${inputClass} pl-12`}
                    placeholder="S/N do fabricante"
                    value={formData.numeroSerie}
                    onChange={(e) => setFormData({ ...formData, numeroSerie: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Patrimônio (Opcional)</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <input 
                    type="text" 
                    className={`${inputClass} pl-12`}
                    placeholder="ID de controle interno"
                    value={formData.patrimonio}
                    onChange={(e) => setFormData({ ...formData, patrimonio: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Quantidade</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <input 
                    type="number" 
                    className={`${inputClass} pl-12`}
                    value={formData.quantidade}
                    onChange={(e) => setFormData({ ...formData, quantidade: Number(e.target.value) })}
                    min="1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Status e Manutenção */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-surface-container-high pb-2">
              <Wrench size={16} className="text-primary" />
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface">Status e Manutenção</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className={labelClass}>Status do Equipamento *</label>
                <div className="relative">
                  <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <select 
                    className={`${inputClass} pl-12`}
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    required
                  >
                    <option value="Em operação">Em operação</option>
                    <option value="Equipamento pronto">Equipamento pronto</option>
                    <option value="Entregue ao cliente">Entregue ao cliente</option>
                    <option value="Em manutenção">Em manutenção</option>
                    <option value="Com falha">Com falha</option>
                    <option value="Parado">Parado</option>
                    <option value="Em análise">Em análise</option>
                    <option value="Aguardando peça">Aguardando peça</option>
                    <option value="Desativado">Desativado</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Técnico Responsável</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <select 
                    className={`${inputClass} pl-12`}
                    value={formData.tecnicoResponsavelId}
                    onChange={(e) => setFormData({ ...formData, tecnicoResponsavelId: e.target.value })}
                  >
                    <option value="">Selecione o Técnico</option>
                    {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Próxima Preventiva</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                  <input 
                    type="date" 
                    className={`${inputClass} pl-12`}
                    value={formData.dataProximaPreventiva}
                    onChange={(e) => setFormData({ ...formData, dataProximaPreventiva: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Observações Técnicas</label>
              <div className="relative">
                <FileText className="absolute left-4 top-4 text-on-surface-variant" size={18} />
                <textarea 
                  className={`${inputClass} pl-12 min-h-[120px] py-4`}
                  placeholder="Detalhes sobre o estado atual, histórico de problemas, peças trocadas..."
                  value={formData.observacoesTecnicas}
                  onChange={(e) => setFormData({ ...formData, observacoesTecnicas: e.target.value })}
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-surface-container-high bg-surface-container-low flex justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-6 py-3 text-on-surface-variant font-black uppercase tracking-widest text-xs hover:bg-surface-container-high rounded-2xl transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-on-primary rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-primary"></div>
            ) : (
              <Save size={18} />
            )}
            {equipment ? 'Salvar Alterações' : 'Cadastrar Equipamento'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
