import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, MoreVertical, Edit2, Trash2, 
  Building2, MapPin, CheckCircle2, XCircle, Loader2,
  Save, X, Globe, Phone, Mail
} from 'lucide-react';
import { Unidade, Cliente } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';

export default function UnidadeList({ user }: { user?: any }) {
  const isAdmin = user?.role === 'admin' || user?.roles?.includes('admin');
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUnidade, setSelectedUnidade] = useState<Unidade | null>(null);
  const [formData, setFormData] = useState<Partial<Unidade>>({
    nome: '',
    clienteId: '',
    endereco: '',
    cidade: '',
    estado: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [unidadesData, clientesData] = await Promise.all([
        databaseService.getUnidades(),
        databaseService.getClientes()
      ]);
      setUnidades(unidadesData || []);
      setClientes(clientesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (selectedUnidade) {
        await databaseService.updateUnidade(selectedUnidade.id, formData);
      } else {
        await databaseService.createUnidade(formData as any);
      }
      await fetchData();
      setShowModal(false);
      setSelectedUnidade(null);
      setFormData({ nome: '', clienteId: '', endereco: '', cidade: '', estado: '' });
    } catch (error) {
      console.error('Error saving unidade:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta unidade?')) return;
    setLoading(true);
    try {
      await databaseService.deleteUnidade(id);
      await fetchData();
    } catch (error) {
      console.error('Error deleting unidade:', error);
    } finally {
      setLoading(false);
    }
  };

  const getClienteName = (clienteId: string) => {
    return clientes.find(c => c.id === clienteId)?.nomeFantasia || 'Cliente não encontrado';
  };

  const filteredUnidades = unidades.filter(u => 
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getClienteName(u.clienteId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && unidades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-on-surface uppercase tracking-tighter">Unidades</h1>
          <p className="text-on-surface-variant text-sm font-medium uppercase tracking-widest flex items-center gap-2">
            <Building2 size={14} className="text-primary" />
            Gestão de Filiais e Unidades de Clientes
          </p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => {
              setSelectedUnidade(null);
              setFormData({ nome: '', clienteId: '', endereco: '', cidade: '', estado: '' });
              setShowModal(true);
            }}
            className="bg-primary text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
          >
            <Plus size={18} />
            Nova Unidade
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
          <input 
            type="text"
            placeholder="Buscar por nome da unidade ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container border border-surface-container-high rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <button className="bg-surface-container border border-surface-container-high text-on-surface rounded-2xl px-6 py-4 text-sm font-bold flex items-center justify-center gap-2 hover:bg-surface-container-high transition-all">
          <Filter size={20} />
          Filtros
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUnidades.map((unidade) => (
          <motion.div
            layout
            key={unidade.id}
            className="bg-surface-container rounded-[32px] p-6 border border-surface-container-high hover:shadow-xl transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                <Building2 size={32} />
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <button 
                    onClick={() => {
                      setSelectedUnidade(unidade);
                      setFormData(unidade);
                      setShowModal(true);
                    }}
                    className="p-2 hover:bg-surface-container-high rounded-xl transition-colors text-on-surface-variant"
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                {isAdmin && (
                  <button 
                    onClick={() => handleDelete(unidade.id)}
                    className="p-2 hover:bg-error/10 rounded-xl transition-colors text-error"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-on-surface uppercase tracking-tight">{unidade.nome}</h3>
                <p className="text-xs font-bold text-primary uppercase tracking-widest">{getClienteName(unidade.clienteId)}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2 text-on-surface-variant">
                  <MapPin size={16} className="shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">
                    {unidade.endereco || 'Endereço não informado'}<br />
                    {unidade.cidade && `${unidade.cidade} - ${unidade.estado}`}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-surface-container-high grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Equipamentos</p>
                  <p className="text-sm font-bold text-on-surface">5 Ativos</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Chamados</p>
                  <p className="text-sm font-bold text-on-surface">2 Abertos</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-container-lowest w-full max-w-md rounded-[32px] shadow-2xl border border-surface-container-high overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-surface-container-high flex justify-between items-center bg-surface-container-low/30">
                <h2 className="text-xl font-black text-on-surface uppercase tracking-tight">
                  {selectedUnidade ? 'Editar Unidade' : 'Nova Unidade'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                  <X size={24} className="text-on-surface-variant" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5 ml-1">Cliente Responsável</label>
                    <select
                      required
                      className="w-full bg-surface-container border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      value={formData.clienteId}
                      onChange={(e) => setFormData({ ...formData, clienteId: e.target.value })}
                    >
                      <option value="">Selecione um cliente...</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id}>{c.nomeFantasia}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5 ml-1">Nome da Unidade</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-surface-container border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Matriz, Filial 01, Unidade Centro"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5 ml-1">Endereço</label>
                    <input
                      type="text"
                      className="w-full bg-surface-container border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5 ml-1">Cidade</label>
                      <input
                        type="text"
                        className="w-full bg-surface-container border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        value={formData.cidade}
                        onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5 ml-1">Estado (UF)</label>
                      <input
                        type="text"
                        maxLength={2}
                        className="w-full bg-surface-container border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        value={formData.estado}
                        onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest text-on-surface-variant hover:bg-surface-container-high transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
