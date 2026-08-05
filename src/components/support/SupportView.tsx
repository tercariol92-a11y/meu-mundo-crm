import { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { Chamado, User, Cliente, Tecnico, Reminder } from '../../types';
import { 
  Plus, 
  Search, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  User as UserIcon,
  Construction,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  History,
  Loader2,
  Bell,
  MessageSquare,
  MessageCircle,
  Mail,
  ArrowRight,
  Zap,
  Timer,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TicketForm from './TicketForm';
import ServiceOrder from './ServiceOrder';
import OSPrintViewer from './OSPrintViewer';
import SupportDashboard from './SupportDashboard';
import WhatsAppModal from '../comercial/WhatsAppModal';
import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SupportViewProps {
  user: User;
  mode?: 'dashboard' | 'chamados';
}

export default function SupportView({ user, mode = 'dashboard' }: SupportViewProps) {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [clients, setClients] = useState<Record<string, Cliente>>({});
  const [tecnicos, setTecnicos] = useState<Record<string, Tecnico>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedChamadoId, setSelectedChamadoId] = useState<string | null>(null);
  const [selectedChamadoForEdit, setSelectedChamadoForEdit] = useState<Chamado | null>(null);
  const [exportingChamado, setExportingChamado] = useState<Chamado | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedContactForWhatsApp, setSelectedContactForWhatsApp] = useState<{name: string, phone: string} | null>(null);
  const [filter, setFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch core lists in parallel - these are single getDocs calls
      const [chamadosData, remindersData, clientsData, tecnicosData] = await Promise.all([
        user.role === 'tecnico' ? databaseService.getChamadosByTecnico(user.id) : databaseService.getChamados(),
        databaseService.getReminders(),
        databaseService.getClientes(),
        databaseService.getTecnicos()
      ]);

      // Create lookup maps to quickly "join" data in memory
      const clientMap: Record<string, Cliente> = {};
      clientsData?.forEach(c => { clientMap[c.id] = c; });
      
      const tecnicoMap: Record<string, Tecnico> = {};
      tecnicosData?.forEach(t => { tecnicoMap[t.id] = t; });

      setClients(clientMap);
      setTecnicos(tecnicoMap);
      setChamados(chamadosData || []);
      setReminders(remindersData || []);
    } catch (err) {
      console.error('Error fetching support data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id, user.role]);

  const filteredChamados = chamados.map(c => ({
    ...c,
    cliente: c.clienteId ? clients[c.clienteId] : c.cliente,
    tecnico: c.tecnicoId ? tecnicos[c.tecnicoId] : c.tecnico
  })).filter(c => {
    let matchesFilter = filter === 'todos' || c.status === filter;
    if (filter === 'atrasados') {
      matchesFilter = c.status !== 'concluido' && c.slaDeadline && new Date(c.slaDeadline) < new Date();
    }
    const matchesSearch = c.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (c.cliente?.nomeFantasia?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'bg-primary/10 text-primary';
      case 'em_atendimento': return 'bg-secondary/10 text-secondary';
      case 'aguardando_cliente': return 'bg-warning/10 text-warning';
      case 'aguardando_peca': return 'bg-warning/10 text-warning';
      case 'concluido': return 'bg-success/10 text-success';
      case 'cancelado': return 'bg-error/10 text-error';
      default: return 'bg-surface-container-highest text-on-surface-variant';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'baixa': return 'bg-surface-container-highest text-on-surface-variant';
      case 'media': return 'bg-primary/10 text-primary';
      case 'alta': return 'bg-warning/10 text-warning';
      case 'critica': return 'bg-error text-white';
      default: return 'bg-surface-container-highest text-on-surface-variant';
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {mode === 'dashboard' ? (
        <SupportDashboard 
          chamados={chamados} 
          reminders={reminders} 
          onFilterChange={setFilter}
          currentFilter={filter}
          onNewTicket={() => setShowForm(true)}
          user={user}
        />
      ) : (
        <>
          {/* Header for Chamados Tab */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-on-surface uppercase tracking-tighter">Chamados</h1>
              <p className="text-on-surface-variant text-sm font-medium mt-1">Lista completa de atendimentos e ordens de serviço.</p>
            </div>
            <button 
              onClick={() => setShowForm(true)}
              className="bg-primary text-on-primary px-8 py-4 rounded-[24px] font-black uppercase tracking-widest text-xs flex items-center gap-3 hover:scale-105 transition-all shadow-xl shadow-primary/20"
            >
              <Plus size={20} /> Novo Chamado
            </button>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-surface-container rounded-[32px] p-4 border border-surface-container-high">
            <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 no-scrollbar">
              {(['todos', 'aberto', 'em_atendimento', 'aguardando_cliente', 'aguardando_peca', 'concluido', 'atrasados'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    filter === f 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  {f === 'em_atendimento' ? 'Em Atendimento' : 
                   f === 'aguardando_cliente' ? 'Aguardando Cliente' : 
                   f === 'aguardando_peca' ? 'Aguardando Peça' : 
                   f === 'atrasados' ? 'Atrasados' : 
                   f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por cliente ou título..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-container-high border-none rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Ticket List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">
                Lista de Atendimentos ({filteredChamados.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="animate-spin text-primary" size={48} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Carregando chamados...</p>
                </div>
              ) : filteredChamados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-surface-container rounded-[40px] border-2 border-dashed border-surface-container-high">
                  <AlertCircle size={48} className="text-on-surface-variant opacity-20 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nenhum chamado encontrado.</p>
                </div>
              ) : (
                filteredChamados.map((chamado, i) => {
                  const isLate = chamado.status !== 'concluido' && chamado.slaDeadline && new Date(chamado.slaDeadline) < new Date();
                  const hoursOpen = chamado.createdAt ? differenceInHours(new Date(), new Date(chamado.createdAt)) : 0;
                  const isCritical = chamado.prioridade === 'critica';

                  return (
                    <motion.div
                      key={chamado.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedChamadoId(chamado.id)}
                      className={`bg-surface-container hover:bg-surface-container-high rounded-[32px] p-6 border transition-all cursor-pointer group relative overflow-hidden ${
                        isLate ? 'border-error/40 ring-1 ring-error/10' : 
                        isCritical ? 'border-warning/40' : 'border-surface-container-high'
                      }`}
                    >
                      {/* Visual indicators for urgency */}
                      {isLate && <div className="absolute top-0 left-0 w-1.5 h-full bg-error" />}
                      {isCritical && !isLate && <div className="absolute top-0 left-0 w-1.5 h-full bg-warning" />}

                      <div className="flex flex-col md:flex-row md:items-center gap-6">
                        {/* Status Icon */}
                        <div className="relative shrink-0">
                          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-sm ${getStatusColor(chamado.status)}`}>
                            {chamado.status === 'concluido' ? <CheckCircle2 size={32} /> : 
                             chamado.status === 'aguardando_peca' ? <Zap size={32} /> :
                             chamado.status === 'aguardando_cliente' ? <MessageSquare size={32} /> :
                             isLate ? <AlertTriangle size={32} className="text-error" /> :
                             <Clock size={32} />}
                          </div>
                          {chamado.cliente?.logoUrl && (
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl border-4 border-surface-container bg-white overflow-hidden shadow-md">
                              <img src={chamado.cliente.logoUrl} alt="" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                            </div>
                          )}
                        </div>

                        {/* Main Info */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-black text-on-surface uppercase tracking-tight group-hover:text-primary transition-colors truncate max-w-md">
                              {chamado.titulo}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getPriorityColor(chamado.prioridade)}`}>
                                {chamado.prioridade}
                              </span>
                              {isLate && (
                                <span className="bg-error text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 animate-pulse">
                                  <AlertTriangle size={12} /> Atrasado
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                            <div className="flex items-center gap-2 text-on-surface-variant">
                              <div className="w-6 h-6 rounded-lg bg-surface-container-highest flex items-center justify-center">
                                <UserIcon size={12} />
                              </div>
                              <span className="text-sm font-bold text-on-surface">{chamado.cliente?.nomeFantasia}</span>
                            </div>
                            <div className="flex items-center gap-2 text-on-surface-variant">
                              <div className="w-6 h-6 rounded-lg bg-surface-container-highest flex items-center justify-center">
                                <Construction size={12} />
                              </div>
                              <span className="text-sm font-medium">{chamado.equipamentoCliente?.tipo} • {chamado.equipamentoCliente?.marca}</span>
                            </div>
                            <div className="flex items-center gap-2 text-on-surface-variant">
                              <div className="w-6 h-6 rounded-lg bg-surface-container-highest flex items-center justify-center">
                                <Timer size={12} />
                              </div>
                              <span className="text-sm font-medium">{hoursOpen}h em aberto</span>
                            </div>
                            {chamado.slaDeadline && (
                              <div className={`flex items-center gap-2 px-3 py-1 rounded-xl ${isLate ? 'bg-error/10 text-error font-black' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                                <History size={14} />
                                <span className="text-xs">SLA: {format(new Date(chamado.slaDeadline), 'dd/MM HH:mm')}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Technician Info */}
                        <div className="flex items-center gap-4 px-6 md:border-l border-surface-container-high">
                          <div className="text-right hidden sm:block">
                            <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Técnico Responsável</p>
                            <p className="text-sm font-black text-on-surface">{chamado.tecnico?.nome || 'Não atribuído'}</p>
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant overflow-hidden border-2 border-surface-container-high">
                            {chamado.tecnico?.fotoUrl ? (
                              <img src={chamado.tecnico.fotoUrl} alt={chamado.tecnico.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <UserIcon size={24} />
                            )}
                          </div>
                        </div>

                        {/* Action */}
                        <div className="flex items-center justify-center gap-3">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContactForWhatsApp({ 
                                name: chamado.cliente?.nomeFantasia || chamado.cliente?.razaoSocial || 'Cliente', 
                                phone: chamado.cliente?.celularWhatsapp || chamado.cliente?.telefoneFixo || '' 
                              });
                              setIsWhatsAppModalOpen(true);
                            }}
                            className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                            title="Enviar WhatsApp"
                          >
                            <MessageCircle size={24} fill="currentColor" fillOpacity={0.2} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setExportingChamado(chamado);
                            }}
                            className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                            title="Exportar OS"
                          >
                            <FileText size={22} />
                          </button>
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm group-hover:shadow-lg group-hover:shadow-primary/20">
                            <ChevronRight size={24} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {(showForm || selectedChamadoForEdit) && (
          <TicketForm 
            chamado={selectedChamadoForEdit || undefined}
            onClose={() => {
              setShowForm(false);
              setSelectedChamadoForEdit(null);
            }} 
            onSave={() => {
              fetchData();
              setShowForm(false);
              setSelectedChamadoForEdit(null);
            }}
          />
        )}
        {selectedChamadoId && (
          <ServiceOrder 
            chamadoId={selectedChamadoId}
            onClose={() => setSelectedChamadoId(null)}
            onUpdate={fetchData}
            onEdit={(chamado) => {
              setSelectedChamadoId(null);
              setSelectedChamadoForEdit(chamado);
            }}
          />
        )}
        {exportingChamado && (
          <OSPrintViewer 
            chamado={exportingChamado}
            onClose={() => setExportingChamado(null)}
          />
        )}
      </AnimatePresence>

      <WhatsAppModal 
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        name={selectedContactForWhatsApp?.name || ''}
        phone={selectedContactForWhatsApp?.phone || ''}
      />
    </div>
  );
}
