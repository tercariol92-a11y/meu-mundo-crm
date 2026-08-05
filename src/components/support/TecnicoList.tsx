import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, MoreVertical, Edit2, Trash2, 
  User, Mail, Shield, CheckCircle2, XCircle, Loader2,
  Wrench, Award, Clock, Save, Camera
} from 'lucide-react';
import { Tecnico, Usuario } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';

export default function TecnicoList({ user }: { user?: Usuario }) {
  const isAdmin = user?.role === 'admin' || user?.roles?.includes('admin');
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState<Tecnico | null>(null);
  const [formData, setFormData] = useState<Partial<Tecnico>>({
    nome: '',
    especialidade: '',
    status: 'Ativo',
    usuarioId: '',
    fotoUrl: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tecnicosData, usuariosData] = await Promise.all([
        databaseService.getTecnicos(),
        databaseService.getUsuarios()
      ]);
      setTecnicos(tecnicosData || []);
      setUsuarios(usuariosData?.filter(u => u.role === 'tecnico' || u.role === 'admin') || []);
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
      if (selectedTecnico) {
        await databaseService.updateTecnico(selectedTecnico.id, formData);
      } else {
        await databaseService.createTecnico(formData as any);
      }
      await fetchData();
      setShowModal(false);
      setSelectedTecnico(null);
      setFormData({ nome: '', especialidade: '', status: 'Ativo', usuarioId: '', fotoUrl: '' });
    } catch (error) {
      console.error('Error saving tecnico:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este técnico?')) return;
    setLoading(true);
    try {
      await databaseService.deleteTecnico(id);
      await fetchData();
    } catch (error) {
      console.error('Error deleting tecnico:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTecnicos = tecnicos.filter(t => 
    t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.especialidade?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && tecnicos.length === 0) {
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
          <h1 className="text-3xl font-black text-on-surface uppercase tracking-tighter">Equipe Técnica</h1>
          <p className="text-on-surface-variant text-sm font-medium uppercase tracking-widest flex items-center gap-2">
            <Wrench size={14} className="text-primary" />
            Gestão de Técnicos e Especialistas
          </p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => {
              setSelectedTecnico(null);
              setFormData({ nome: '', especialidade: '', status: 'Ativo', usuarioId: '', fotoUrl: '' });
              setShowModal(true);
            }}
            className="bg-primary text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
          >
            <Plus size={18} />
            Novo Técnico
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
          <input 
            type="text"
            placeholder="Buscar por nome ou especialidade..."
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
        {filteredTecnicos.map((tecnico) => (
          <motion.div
            layout
            key={tecnico.id}
            className="bg-surface-container rounded-[32px] p-6 border border-surface-container-high hover:shadow-xl transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner overflow-hidden border-2 border-surface-container-high">
                {tecnico.fotoUrl ? (
                  <img src={tecnico.fotoUrl} alt={tecnico.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={32} />
                )}
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <button 
                    onClick={() => {
                      setSelectedTecnico(tecnico);
                      setFormData(tecnico);
                      setShowModal(true);
                    }}
                    className="p-2 hover:bg-surface-container-high rounded-xl transition-colors text-on-surface-variant"
                  >
                    <Edit2 size={18} />
                  </button>
                )}
                {isAdmin && (
                  <button 
                    onClick={() => handleDelete(tecnico.id)}
                    className="p-2 hover:bg-error/10 rounded-xl transition-colors text-error"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-on-surface uppercase tracking-tight">{tecnico.nome}</h3>
                <p className="text-xs font-bold text-primary uppercase tracking-widest">{tecnico.especialidade || 'Técnico Geral'}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                  tecnico.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {tecnico.status === 'Ativo' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {tecnico.status}
                </span>
              </div>

              <div className="pt-4 border-t border-surface-container-high grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Chamados</p>
                  <p className="text-sm font-bold text-on-surface">12 Ativos</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Avaliação</p>
                  <p className="text-sm font-bold text-on-surface">4.8 ★</p>
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
                  {selectedTecnico ? 'Editar Técnico' : 'Novo Técnico'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                  <XCircle size={24} className="text-on-surface-variant" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  {/* Photo Upload */}
                  <div className="flex flex-col items-center gap-4 mb-6">
                    <div className="relative group">
                      <div className="w-24 h-24 bg-surface-container rounded-3xl border-2 border-dashed border-surface-container-high flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/50">
                        {formData.fotoUrl ? (
                          <img src={formData.fotoUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User size={40} className="text-on-surface-variant" />
                        )}
                        <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                          <Camera size={24} className="text-white" />
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setFormData({ ...formData, fotoUrl: reader.result as string });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                      {formData.fotoUrl && (
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, fotoUrl: '' })}
                          className="absolute -top-2 -right-2 p-1.5 bg-error text-white rounded-xl shadow-lg hover:scale-110 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Foto do Técnico</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5 ml-1">Vincular Usuário</label>
                    <select
                      required
                      className="w-full bg-surface-container border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      value={formData.usuarioId}
                      onChange={(e) => {
                        const user = usuarios.find(u => u.id === e.target.value);
                        setFormData({ 
                          ...formData, 
                          usuarioId: e.target.value,
                          nome: user?.nome || formData.nome
                        });
                      }}
                    >
                      <option value="">Selecione um usuário...</option>
                      {usuarios.map(u => (
                        <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5 ml-1">Nome de Exibição</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-surface-container border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5 ml-1">Especialidade</label>
                    <input
                      type="text"
                      className="w-full bg-surface-container border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      value={formData.especialidade}
                      onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                      placeholder="Ex: Redes, Elétrica, Software"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1.5 ml-1">Status</label>
                    <select
                      className="w-full bg-surface-container border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                      <option value="Férias">Férias</option>
                    </select>
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
