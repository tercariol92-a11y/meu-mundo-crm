import { useState, useMemo } from 'react';
import { 
  Search, Filter, Plus, Building2, 
  FileText, Construction, Laptop,
  ChevronRight, ChevronLeft, Trash2, Edit2, Eye,
  MessageCircle
} from 'lucide-react';
import { Cliente, Usuario } from '../../types';
import { databaseService } from '../../services/databaseService';
import ClientForm from './ClientForm';
import ClientDetail from './ClientDetail';
import WhatsAppModal from '../comercial/WhatsAppModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalData } from '../../contexts/GlobalDataContext';

interface ClientListProps {
  user: Usuario;
  onViewChange?: (view: any) => void;
}

export default function ClientList({ user, onViewChange }: ClientListProps) {
  const userId = user.id;
  const isLocalAdmin = user.role === 'admin' || user.roles?.includes('admin');
  const { clientes, loading } = useGlobalData();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedContactForWhatsApp, setSelectedContactForWhatsApp] = useState<{name: string, phone: string} | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | undefined>();
  
  // Filtros
  const [filters, setFilters] = useState({
    status: '',
    possuiContrato: '',
    usaSoftware: '',
    usaEquipamento: '',
  });

  const handleSave = async (data: Partial<Cliente>) => {
    try {
      let result;
      if (selectedCliente) {
        result = await databaseService.updateCliente(selectedCliente.id, data);
      } else {
        result = await databaseService.createCliente(data as any);
      }
      return result;
    } catch (error) {
      console.error('Error saving client:', error);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        await databaseService.deleteCliente(id);
      } catch (error) {
        console.error('Error deleting client:', error);
      }
    }
  };

  const filteredClientes = useMemo(() => clientes.filter(c => {
    const matchesSearch = 
      c.nomeFantasia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.razaoSocial?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (c.cnpj || '').includes(searchTerm) ||
      (c.equipamentoSerie || '').includes(searchTerm);

    const matchesStatus = !filters.status || c.status === filters.status;
    const matchesContrato = !filters.possuiContrato || (filters.possuiContrato === 'sim' ? c.possuiContrato : !c.possuiContrato);
    const matchesSoftware = !filters.usaSoftware || (filters.usaSoftware === 'sim' ? c.usaSoftware : !c.usaSoftware);
    const matchesEquipamento = !filters.usaEquipamento || (filters.usaEquipamento === 'sim' ? c.usaEquipamento : !c.usaEquipamento);

    return matchesSearch && matchesStatus && matchesContrato && matchesSoftware && matchesEquipamento;
  }), [clientes, searchTerm, filters]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {onViewChange && (
            <button 
              onClick={() => onViewChange('comercial-dashboard')}
              className="p-2 hover:bg-surface-container-highest rounded-xl transition-colors text-on-surface-variant border border-surface-container-high"
              title="Voltar ao Dashboard"
            >
              <ChevronRight className="rotate-180" size={20} />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-black text-on-surface uppercase tracking-tight">Gestão de Clientes</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-on-surface-variant font-bold uppercase tracking-widest">Base de Clientes •</p>
              <img 
                src="https://www.mundotechequipamentos.com.br/wp-content/uploads/2022/08/pic-logomarca-mundo-tech-neutra-preta-v1.png" 
                alt="Logo" 
                className="h-4 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
        <button 
          onClick={() => { setSelectedCliente(undefined); setShowForm(true); }}
          className="bg-primary text-on-primary px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:scale-105 transition-all shadow-xl shadow-primary/20"
        >
          <Plus size={20} />
          Cadastrar Cliente
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, CNPJ, série ou razão social..."
              className="w-full bg-surface-container-lowest border border-surface-container-high rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-6 py-3.5 rounded-2xl border flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${
              showFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container-lowest border-surface-container-high text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <Filter size={18} />
            Filtros Avançados
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-surface-container-high overflow-hidden"
            >
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Status</label>
                <select 
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl px-4 py-2.5 text-xs font-bold"
                  value={filters.status}
                  onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Bloqueado">Bloqueado</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Contrato Ativo</label>
                <select 
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl px-4 py-2.5 text-xs font-bold"
                  value={filters.possuiContrato}
                  onChange={e => setFilters(prev => ({ ...prev, possuiContrato: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Usa Software</label>
                <select 
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl px-4 py-2.5 text-xs font-bold"
                  value={filters.usaSoftware}
                  onChange={e => setFilters(prev => ({ ...prev, usaSoftware: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Usa Equipamento</label>
                <select 
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl px-4 py-2.5 text-xs font-bold"
                  value={filters.usaEquipamento}
                  onChange={e => setFilters(prev => ({ ...prev, usaEquipamento: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-surface-container-high">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Cliente / Empresa</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Contrato</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Técnico / Software</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Contato</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                      <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Carregando base de clientes...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-50">
                      <Building2 size={48} className="text-on-surface-variant" />
                      <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Nenhum cliente encontrado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => (
                  <tr 
                    key={cliente.id} 
                    className="hover:bg-surface-container-low/30 transition-colors group cursor-pointer"
                    onClick={() => { setSelectedCliente(cliente); setShowDetail(true); }}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-surface-container-high rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform overflow-hidden border border-surface-container-high shadow-sm">
                          {cliente.logoUrl ? (
                            <img src={cliente.logoUrl} alt={cliente.nomeFantasia} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Building2 size={20} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-black text-on-surface uppercase tracking-tight">{cliente.nomeFantasia}</p>
                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">{cliente.cnpj || 'CNPJ não informado'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        cliente.status === 'Ativo' ? 'bg-success/10 text-success' : 
                        cliente.status === 'Inativo' ? 'bg-on-surface-variant/10 text-on-surface-variant' : 
                        'bg-error/10 text-error'
                      }`}>
                        {cliente.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {cliente.possuiContrato ? (
                        <div className="flex items-center gap-2 text-success">
                          <FileText size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Ativo</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-50">Sem Contrato</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex gap-2">
                        {cliente.usaEquipamento && (
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary" title="Possui Equipamentos">
                            <Construction size={16} />
                          </div>
                        )}
                        {cliente.usaSoftware && (
                          <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary" title="Usa Software">
                            <Laptop size={16} />
                          </div>
                        )}
                        {!cliente.usaEquipamento && !cliente.usaSoftware && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-50">Nenhum</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        <p>{cliente.responsavelNome || 'N/A'}</p>
                        <p className="text-primary">{cliente.celularWhatsapp || cliente.telefoneFixo || 'Sem telefone'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            if (onViewChange) {
                              onViewChange('atendimento');
                              localStorage.setItem('whatsapp_target_phone', cliente.celularWhatsapp || cliente.telefoneFixo || '');
                            }
                          }}
                          className="p-2.5 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all"
                          title="Ir para WhatsApp"
                        >
                          <MessageCircle className="w-[18px] h-[18px]" fill="currentColor" fillOpacity={0.2} />
                        </button>
                        <button 
                          onClick={() => { setSelectedCliente(cliente); setShowDetail(true); }}
                          className="p-2.5 hover:bg-primary/10 text-primary rounded-xl transition-all"
                          title="Ver Detalhes"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => { setSelectedCliente(cliente); setShowForm(true); }}
                          className="p-2.5 hover:bg-primary/10 text-primary rounded-xl transition-all"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        {isLocalAdmin && (
                          <button 
                            onClick={() => handleDelete(cliente.id)}
                            className="p-2.5 hover:bg-error/10 text-error rounded-xl transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Placeholder */}
        <div className="px-6 py-4 border-t border-surface-container-high bg-surface-container-low/30 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Mostrando {filteredClientes.length} de {clientes.length} clientes
          </p>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant disabled:opacity-30" disabled><ChevronLeft size={18} /></button>
            <button className="w-8 h-8 bg-primary text-white rounded-lg text-[10px] font-black">1</button>
            <button className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant disabled:opacity-30" disabled><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <ClientForm 
          cliente={selectedCliente}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setSelectedCliente(undefined); }}
          userId={userId}
          onOpenWhatsApp={(contact) => {
            const phone = contact.celularWhatsapp || contact.telefone || '';
            localStorage.setItem('whatsapp_target_phone', phone);
            localStorage.setItem('whatsapp_target_name', contact.nome);
            setShowForm(false);
            onViewChange?.('atendimento');
          }}
        />
      )}

      {/* Detail Modal */}
      {showDetail && selectedCliente && (
        <ClientDetail 
          cliente={selectedCliente}
          onClose={() => { setShowDetail(false); setSelectedCliente(undefined); }}
          onEdit={() => { setShowDetail(false); setShowForm(true); }}
        />
      )}

      <WhatsAppModal 
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        name={selectedContactForWhatsApp?.name || ''}
        phone={selectedContactForWhatsApp?.phone || ''}
      />
    </div>
  );
}
