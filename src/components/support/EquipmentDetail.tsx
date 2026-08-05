import { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  Package, 
  Wrench, 
  Calendar, 
  User, 
  MapPin, 
  FileText,
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Zap,
  ShieldAlert,
  Ticket
} from 'lucide-react';
import { motion } from 'framer-motion';
import { databaseService } from '../../services/databaseService';
import { EquipamentoCliente, Chamado } from '../../types';

interface EquipmentDetailProps {
  equipment: EquipamentoCliente;
  onClose: () => void;
}

export default function EquipmentDetail({ equipment, onClose }: EquipmentDetailProps) {
  const [history, setHistory] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await databaseService.getChamadosByEquipamentoCliente(equipment.id);
        setHistory(data || []);
      } catch (error) {
        console.error("Error fetching equipment history:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [equipment.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Em operação': return 'bg-success/10 text-success border-success/20';
      case 'Equipamento pronto': return 'bg-success/20 text-success border-success/30';
      case 'Entregue ao cliente': return 'bg-primary/20 text-primary border-primary/30';
      case 'Em manutenção': return 'bg-primary/10 text-primary border-primary/20';
      case 'Com falha': return 'bg-error/10 text-error border-error/20';
      case 'Parado': return 'bg-error/10 text-error border-error/20';
      case 'Em análise': return 'bg-warning/10 text-warning border-warning/20';
      case 'Aguardando peça': return 'bg-warning/20 text-warning-container border-warning/30';
      case 'Desativado': return 'bg-surface-container-highest text-on-surface-variant border-surface-container-high';
      default: return 'bg-surface-container text-on-surface-variant';
    }
  };

  const getTicketStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'bg-error/10 text-error border-error/20';
      case 'em_atendimento': return 'bg-primary/10 text-primary border-primary/20';
      case 'aguardando_peca': return 'bg-warning/10 text-warning border-warning/20';
      case 'concluido': return 'bg-success/10 text-success border-success/20';
      case 'cancelado': return 'bg-surface-container-highest text-on-surface-variant border-surface-container-high';
      default: return 'bg-surface-container text-on-surface-variant';
    }
  };

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
        initial={{ opacity: 0, scale: 0.95, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.95, x: 20 }}
        className="relative w-full max-w-5xl bg-surface-container-lowest rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl border ${getStatusColor(equipment.status)}`}>
              <Package size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-on-surface uppercase tracking-tighter">
                {equipment.modelo || equipment.tipo}
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{equipment.marca || 'Marca N/D'}</span>
                <span className="w-1 h-1 rounded-full bg-surface-container-highest" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">S/N: {equipment.numeroSerie || 'N/D'}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Left Panel: Info */}
          <div className="w-full lg:w-1/3 border-r border-surface-container-high overflow-y-auto p-6 space-y-8 bg-surface-container-low/30">
            {/* Status Card */}
            <div className={`p-4 rounded-2xl border ${getStatusColor(equipment.status)} space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Status Atual</span>
                <Zap size={16} />
              </div>
              <p className="text-xl font-black uppercase tracking-tighter">{equipment.status}</p>
            </div>

            {/* Details Grid */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Localização</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Building2 size={18} className="text-primary mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-on-surface">{equipment.cliente?.nomeFantasia}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase">{equipment.unidade?.nome || 'Sede/Principal'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="text-primary mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-on-surface">{equipment.localInstalacao || 'Não informado'}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase">Local de Instalação</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Datas e Prazos</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-surface-container-high rounded-2xl">
                    <Calendar size={16} className="text-primary mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Instalação</p>
                    <p className="text-xs font-bold text-on-surface">{equipment.dataInstalacao ? new Date(equipment.dataInstalacao).toLocaleDateString() : 'N/D'}</p>
                  </div>
                  <div className="p-3 bg-surface-container-high rounded-2xl">
                    <ShieldAlert size={16} className="text-primary mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Próxima Prev.</p>
                    <p className={`text-xs font-bold ${equipment.dataProximaPreventiva && new Date(equipment.dataProximaPreventiva) < new Date() ? 'text-error' : 'text-on-surface'}`}>
                      {equipment.dataProximaPreventiva ? new Date(equipment.dataProximaPreventiva).toLocaleDateString() : 'N/D'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Responsável</h3>
                <div className="flex items-center gap-3 p-3 bg-surface-container-high rounded-2xl">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <User size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface">{equipment.tecnico?.nome || 'Não atribuído'}</p>
                    <p className="text-[10px] text-on-surface-variant uppercase">Técnico Responsável</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Notes */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Observações Técnicas</h3>
              <div className="p-4 bg-surface-container-high rounded-2xl">
                <p className="text-xs text-on-surface leading-relaxed whitespace-pre-wrap italic">
                  {equipment.observacoesTecnicas || 'Nenhuma observação técnica registrada.'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel: History */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <History size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-on-surface uppercase tracking-tighter">Histórico Técnico</h3>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Chamados e Manutenções Vinculadas</p>
                </div>
              </div>
              <div className="px-4 py-2 bg-surface-container-high rounded-xl text-xs font-bold text-on-surface">
                {history.length} Registros
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Carregando histórico...</p>
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-4">
                {history.map((chamado, i) => (
                  <motion.div 
                    key={chamado.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 bg-surface-container-lowest border border-surface-container-high rounded-2xl hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl border shrink-0 ${getTicketStatusColor(chamado.status)}`}>
                          <Ticket size={20} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-primary uppercase">#{chamado.id.slice(-6)}</span>
                            <span className="text-sm font-bold text-on-surface">{chamado.titulo}</span>
                          </div>
                          <p className="text-xs text-on-surface-variant line-clamp-1">{chamado.descricao}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant uppercase">
                              <Calendar size={12} />
                              {chamado.createdAt ? new Date(chamado.createdAt).toLocaleDateString() : 'N/D'}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant uppercase">
                              <User size={12} />
                              {chamado.tecnico?.nome || 'N/D'}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-tighter ${getTicketStatusColor(chamado.status)}`}>
                        {chamado.status.replace('_', ' ')}
                      </div>
                    </div>
                    {chamado.solucaoAplicada && (
                      <div className="mt-4 p-3 bg-surface-container-high rounded-xl border-l-4 border-success">
                        <p className="text-[10px] font-black uppercase tracking-widest text-success mb-1">Solução Aplicada</p>
                        <p className="text-xs text-on-surface font-medium">{chamado.solucaoAplicada}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant bg-surface-container-low/30 rounded-[32px] border-2 border-dashed border-surface-container-high">
                <FileText size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">Nenhum chamado vinculado</p>
                <p className="text-xs">Este equipamento não possui histórico de manutenção registrado.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
