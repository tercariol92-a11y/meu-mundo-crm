import { useState, useEffect } from 'react';
import { 
  Wrench, 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Eye, 
  Edit2, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  PauseCircle, 
  Settings, 
  ChevronRight,
  Zap,
  ShieldAlert,
  Building2,
  User,
  Calendar,
  Package,
  History,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { databaseService } from '../../services/databaseService';
import { EquipamentoCliente, Cliente, Unidade, Tecnico, User as AppUser, Chamado } from '../../types';
import EquipmentForm from './EquipmentForm';
import EquipmentDetail from './EquipmentDetail';

interface TechnicalAssistanceViewProps {
  user: AppUser;
}

export default function TechnicalAssistanceView({ user }: TechnicalAssistanceViewProps) {
  const [equipments, setEquipments] = useState<EquipamentoCliente[]>([]);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [units, setUnits] = useState<Unidade[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipamentoCliente | null>(null);
  const [filters, setFilters] = useState({
    clienteId: '',
    unidadeId: '',
    tipo: '',
    status: '',
    tecnicoId: '',
    comFalha: false,
    aguardandoPeca: false,
    preventivaVencida: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eqData, clData, unData, teData] = await Promise.all([
        databaseService.getEquipamentosCliente(),
        databaseService.getClientes(),
        databaseService.getUnidades(),
        databaseService.getTecnicos()
      ]);

      // Enrich equipment data with client, unit, and technician info
      const enrichedEquipments = (eqData || []).map(eq => ({
        ...eq,
        cliente: clData?.find(c => c.id === eq.clienteId),
        unidade: unData?.find(u => u.id === eq.unidadeId),
        tecnico: teData?.find(t => t.id === eq.tecnicoResponsavelId)
      }));

      setEquipments(enrichedEquipments);
      setClients(clData || []);
      setUnits(unData || []);
      setTecnicos(teData || []);
    } catch (error) {
      console.error("Error fetching technical assistance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipments = equipments.filter(eq => {
    const matchesSearch = 
      eq.numeroSerie?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.cliente?.nomeFantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.modelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.marca?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesClient = !filters.clienteId || eq.clienteId === filters.clienteId;
    const matchesUnit = !filters.unidadeId || eq.unidadeId === filters.unidadeId;
    const matchesType = !filters.tipo || eq.tipo === filters.tipo;
    const matchesStatus = !filters.status || eq.status === filters.status;
    const matchesTechnician = !filters.tecnicoId || eq.tecnicoResponsavelId === filters.tecnicoId;
    
    const matchesFalha = !filters.comFalha || eq.status === 'Com falha';
    const matchesPeca = !filters.aguardandoPeca || eq.status === 'Aguardando peça';
    
    const isPreventivaVencida = eq.dataProximaPreventiva ? new Date(eq.dataProximaPreventiva) < new Date() : false;
    const matchesPreventiva = !filters.preventivaVencida || isPreventivaVencida;

    return matchesSearch && matchesClient && matchesUnit && matchesType && matchesStatus && matchesTechnician && matchesFalha && matchesPeca && matchesPreventiva;
  });

  const stats = {
    operacao: equipments.filter(e => e.status === 'Em operação').length,
    manutencao: equipments.filter(e => e.status === 'Em manutenção').length,
    falha: equipments.filter(e => e.status === 'Com falha').length,
    aguardando: equipments.filter(e => e.status === 'Aguardando peça').length,
    preventivasVencidas: equipments.filter(e => e.dataProximaPreventiva && new Date(e.dataProximaPreventiva) < new Date()).length
  };

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Em operação': return <CheckCircle2 size={14} />;
      case 'Equipamento pronto': return <CheckCircle2 size={14} />;
      case 'Entregue ao cliente': return <Package size={14} />;
      case 'Em manutenção': return <Wrench size={14} />;
      case 'Com falha': return <AlertCircle size={14} />;
      case 'Parado': return <PauseCircle size={14} />;
      case 'Em análise': return <Search size={14} />;
      case 'Aguardando peça': return <Clock size={14} />;
      case 'Desativado': return <Settings size={14} />;
      default: return <AlertCircle size={14} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-on-surface uppercase tracking-tighter flex items-center gap-2">
            <Wrench className="text-primary" />
            Assistência Técnica
          </h1>
          <p className="text-sm text-on-surface-variant font-medium">Gestão e monitoramento do parque de equipamentos instalados</p>
        </div>
        <button 
          onClick={() => { setSelectedEquipment(null); setShowForm(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-lg transition-all active:scale-95"
        >
          <Plus size={18} />
          Cadastrar Equipamento
        </button>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Em Operação', value: stats.operacao, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Em Manutenção', value: stats.manutencao, icon: Wrench, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Com Falha', value: stats.falha, icon: AlertCircle, color: 'text-error', bg: 'bg-error/10' },
          { label: 'Aguardando Peça', value: stats.aguardando, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Preventivas Vencidas', value: stats.preventivasVencidas, icon: ShieldAlert, color: 'text-error', bg: 'bg-error/20' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-surface-container-lowest p-4 rounded-3xl border border-surface-container-high shadow-sm flex items-center gap-4"
          >
            <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{stat.label}</p>
              <p className="text-2xl font-black text-on-surface">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="bg-surface-container-lowest p-6 rounded-3xl border border-surface-container-high shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por série, cliente, modelo ou marca..."
              className="w-full pl-12 pr-4 py-3 bg-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select 
              className="px-4 py-3 bg-surface-container-high rounded-2xl text-xs font-bold uppercase tracking-widest focus:outline-none"
              value={filters.clienteId}
              onChange={(e) => setFilters({ ...filters, clienteId: e.target.value })}
            >
              <option value="">Todos Clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
            </select>
            <select 
              className="px-4 py-3 bg-surface-container-high rounded-2xl text-xs font-bold uppercase tracking-widest focus:outline-none"
              value={filters.tipo}
              onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
            >
              <option value="">Todos Tipos</option>
              <option value="Placa">Placa</option>
              <option value="Catraca">Catraca</option>
              <option value="Relógio de ponto">Relógio de ponto</option>
              <option value="Facial">Facial</option>
              <option value="Outros">Outros</option>
            </select>
            <select 
              className="px-4 py-3 bg-surface-container-high rounded-2xl text-xs font-bold uppercase tracking-widest focus:outline-none"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Todos Status</option>
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
            <button 
              onClick={() => setFilters({
                clienteId: '',
                unidadeId: '',
                tipo: '',
                status: '',
                tecnicoId: '',
                comFalha: false,
                aguardandoPeca: false,
                preventivaVencida: false
              })}
              className="p-3 bg-surface-container-high text-on-surface-variant rounded-2xl hover:bg-error/10 hover:text-error transition-all"
              title="Limpar Filtros"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded border-surface-container-highest text-primary focus:ring-primary"
              checked={filters.comFalha}
              onChange={(e) => setFilters({ ...filters, comFalha: e.target.checked })}
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">Com Falha</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded border-surface-container-highest text-primary focus:ring-primary"
              checked={filters.aguardandoPeca}
              onChange={(e) => setFilters({ ...filters, aguardandoPeca: e.target.checked })}
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">Aguardando Peça</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded border-surface-container-highest text-primary focus:ring-primary"
              checked={filters.preventivaVencida}
              onChange={(e) => setFilters({ ...filters, preventivaVencida: e.target.checked })}
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant group-hover:text-primary transition-colors">Preventiva Vencida</span>
          </label>
        </div>
      </div>

      {/* List */}
      <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high/50 border-b border-surface-container-high">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Cliente / Unidade</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Equipamento</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Série / Patrimônio</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Manutenção</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {filteredEquipments.map((eq) => (
                <tr key={eq.id} className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-on-surface">{eq.cliente?.nomeFantasia || 'N/D'}</span>
                      <span className="text-[10px] font-medium text-on-surface-variant uppercase">{eq.unidade?.nome || 'Sede/Principal'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-surface-container-high text-primary">
                        <Package size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-on-surface">{eq.modelo || eq.tipo}</span>
                        <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-tighter">{eq.marca || 'Marca N/D'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-mono font-bold text-on-surface">{eq.numeroSerie || 'S/N'}</span>
                      {eq.patrimonio && <span className="text-[9px] font-bold text-primary uppercase tracking-widest">PAT: {eq.patrimonio}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-tighter ${getStatusColor(eq.status)}`}>
                      {getStatusIcon(eq.status)}
                      {eq.status}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant">
                        <History size={12} className="text-primary" />
                        Última: {eq.dataUltimaManutencao ? new Date(eq.dataUltimaManutencao).toLocaleDateString() : 'N/D'}
                      </div>
                      <div className={`flex items-center gap-1.5 text-[10px] font-bold ${eq.dataProximaPreventiva && new Date(eq.dataProximaPreventiva) < new Date() ? 'text-error' : 'text-on-surface-variant'}`}>
                        <Calendar size={12} className="text-primary" />
                        Prox: {eq.dataProximaPreventiva ? new Date(eq.dataProximaPreventiva).toLocaleDateString() : 'N/D'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { setSelectedEquipment(eq); setShowDetail(true); }}
                        className="p-2 text-on-surface-variant hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                        title="Ver Detalhes"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => { setSelectedEquipment(eq); setShowForm(true); }}
                        className="p-2 text-on-surface-variant hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm('Deseja realmente excluir este equipamento?')) {
                            await databaseService.deleteEquipamentoCliente(eq.id);
                            fetchData();
                          }
                        }}
                        className="p-2 text-on-surface-variant hover:bg-error/10 hover:text-error rounded-xl transition-all"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEquipments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
              <Package size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-bold uppercase tracking-widest">Nenhum equipamento encontrado</p>
              <p className="text-xs">Tente ajustar seus filtros ou busca</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <EquipmentForm 
            equipment={selectedEquipment} 
            onClose={() => setShowForm(false)} 
            onSuccess={() => { setShowForm(false); fetchData(); }}
            clients={clients}
            units={units}
            tecnicos={tecnicos}
          />
        )}
        {showDetail && selectedEquipment && (
          <EquipmentDetail 
            equipment={selectedEquipment} 
            onClose={() => setShowDetail(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
