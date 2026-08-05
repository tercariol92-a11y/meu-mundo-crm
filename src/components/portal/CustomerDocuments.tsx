import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderOpen, 
  FileText, 
  Download, 
  Search, 
  Plus, 
  Upload, 
  History, 
  Trash2, 
  MessageSquare, 
  Info, 
  ChevronRight, 
  X,
  File,
  Eye,
  MoreVertical,
  CheckCircle2,
  Clock,
  User as UserIcon,
  LayoutGrid,
  List as ListIcon,
  Filter,
  ArrowUpRight,
  Database
} from 'lucide-react';
import { CustomerPortalUser, Cliente, Documento, Chamado } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomerDocumentsProps {
  user: CustomerPortalUser;
  clienteData: Cliente;
}

const CATEGORIES = [
  'Contrato',
  'Nota fiscal',
  'Garantia',
  'Foto do equipamento',
  'Evidência técnica',
  'Documento administrativo',
  'Outros'
];

export default function CustomerDocuments({ user, clienteData }: CustomerDocumentsProps) {
  const [documents, setDocuments] = useState<Documento[]>([]);
  const [tickets, setTickets] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Stats calculation
  const totalStorageUsed = documents.reduce((acc, doc) => acc + (doc.tamanho || 0), 0);
  const storageLimit = 10 * 1024 * 1024 * 1024; // 10GB in bytes
  const storagePercentage = (totalStorageUsed / storageLimit) * 100;

  const loadData = useCallback(async () => {
    try {
      const [docsData, ticketsData] = await Promise.all([
        databaseService.getDocumentosByCliente(user.clienteId),
        databaseService.getChamadosByCliente(user.clienteId)
      ]);
      setDocuments(docsData || []);
      setTickets(ticketsData || []);
    } catch (err) {
      console.error('Error loading documents page data:', err);
    } finally {
      setLoading(false);
    }
  }, [user.clienteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Logic for multiple or single file could go here
      setShowUploadModal(true);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || doc.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = (form.elements.namedItem('file') as HTMLInputElement).files?.[0];

    if (!file) {
      setUploading(false);
      return;
    }

    try {
      // Simulate real file upload here if needed, or just push metadata to Firestore
      await databaseService.createDocumento({
        clienteId: user.clienteId,
        nome: file.name,
        url: URL.createObjectURL(file), // Mock URL for demo
        tipo: file.type.split('/')[1]?.toUpperCase() || 'DOC',
        categoria: formData.get('categoria') as any,
        tamanho: file.size,
        enviadoPor: user.nome,
        enviadoPorTipo: 'cliente',
        userId: user.id,
        status: 'ativo',
        ticketId: formData.get('ticketId') as string || undefined
      });
      
      setShowUploadModal(false);
      loadData();
    } catch (err) {
      console.error('Error uploading document:', err);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-20 flex justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="text-primary">
            <LayoutGrid size={40} />
          </motion.div>
          <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Carregando documentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-on-surface uppercase tracking-tight">Central de Documentos</h2>
          <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest mt-1">Gestão inteligente de arquivos e conformidade técnica</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high flex items-center gap-4 min-w-[240px]">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Database size={20} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Armazenamento</span>
                <span className="text-[10px] font-black text-on-surface">{formatSize(totalStorageUsed)} / 10GB</span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${storagePercentage}%` }}
                  className="h-full bg-primary"
                />
              </div>
            </div>
          </div>

          <button 
            onClick={() => setShowUploadModal(true)}
            className="px-6 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2"
          >
            <Upload size={16} />
            Enviar Documento
          </button>
        </div>
      </div>

      {/* Seção Documentos Recentes */}
      {recentDocs.length > 0 && (
        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
            <Clock size={16} />
            Documentos Recentes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentDocs.map(doc => (
              <motion.div 
                key={doc.id}
                whileHover={{ y: -4 }}
                className="bg-surface-container-low p-6 rounded-[32px] border border-surface-container-high hover:border-primary transition-all group cursor-pointer"
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText size={24} />
                  </div>
                  <span className="text-[10px] font-bold text-on-surface-variant opacity-50 bg-surface-container-high px-2 py-1 rounded-lg uppercase">{doc.tipo}</span>
                </div>
                <h4 className="text-sm font-black text-on-surface leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-1">{doc.nome}</h4>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{doc.categoria}</span>
                  <p className="text-[9px] font-medium text-on-surface-variant">{new Date(doc.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Main Area: Search, Filters & List */}
      <div className="bg-surface-container-low rounded-[40px] border border-surface-container-high p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-6 mb-8 lg:items-center justify-between">
          <div className="flex-1 flex flex-col md:flex-row gap-4">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="PROCURAR POR NOME OU CONTEÚDO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pl-12 pr-8 py-4 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl text-[10px] font-black uppercase tracking-widest appearance-none outline-none focus:ring-2 focus:ring-primary/20 min-w-[200px]"
                >
                  <option value="all">Todas as Categorias</option>
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="flex p-1 bg-surface-container-high rounded-2xl">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:bg-white/50'}`}
                >
                  <ListIcon size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:bg-white/50'}`}
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div 
          onDragEnter={handleDrag} 
          onDragLeave={handleDrag} 
          onDragOver={handleDrag} 
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-[32px] p-12 flex flex-col items-center justify-center transition-all mb-8 ${
            dragActive ? 'border-primary bg-primary/5' : 'border-surface-container-highest bg-surface-container-highest/10 hover:border-primary/30 hover:bg-surface-container-highest/20'
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-surface-container-low shadow-sm flex items-center justify-center text-on-surface-variant mb-4">
            <Upload size={32} />
          </div>
          <p className="text-sm font-black uppercase tracking-widest text-on-surface">Arraste e solte seus arquivos para upload</p>
          <p className="text-xs font-bold text-on-surface-variant mt-2">Suporta PDF, JPG, PNG, DOCX e XLSX até 20MB</p>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="mt-6 text-xs font-black uppercase text-primary hover:underline underline-offset-4"
          >
            Ou selecione do seu computador
          </button>
        </div>

        {/* View content */}
        {filteredDocs.length === 0 ? (
          <div className="p-20 text-center">
            <FolderOpen size={64} className="mx-auto text-on-surface-variant/20 mb-6" />
            <h3 className="text-xl font-black uppercase text-on-surface leading-tight">Nenhum documento encontrado</h3>
            <p className="text-sm font-medium text-on-surface-variant mt-2 max-w-md mx-auto">Não encontramos arquivos com os filtros aplicados. Tente ajustar sua busca ou envie um novo documento.</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="overflow-x-auto overflow-y-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-surface-container-high">
                  <th className="pb-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Documento</th>
                  <th className="pb-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Categoria</th>
                  <th className="pb-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Enviado Por</th>
                  <th className="pb-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Data</th>
                  <th className="pb-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/50">
                {filteredDocs.map(doc => (
                  <tr key={doc.id} className="group hover:bg-surface-container-highest/5 transition-colors">
                    <td className="py-5 pr-4">
                      <div className="flex items-center gap-4 cursor-pointer" onClick={() => setSelectedDoc(doc)}>
                        <div className="w-10 h-10 rounded-xl bg-surface-container-highest/30 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shrink-0">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{doc.nome}</p>
                          <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest opacity-50">{doc.tipo} • {formatSize(doc.tamanho)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-4">
                      <span className="px-3 py-1 bg-surface-container-high rounded-full text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
                        {doc.categoria}
                      </span>
                    </td>
                    <td className="py-5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                          <UserIcon size={12} />
                        </div>
                        <span className="text-xs font-bold text-on-surface-variant">{doc.enviadoPor}</span>
                      </div>
                    </td>
                    <td className="py-5 px-4">
                      <p className="text-xs font-medium text-on-surface-variant">{new Date(doc.createdAt).toLocaleDateString('pt-BR')}</p>
                    </td>
                    <td className="py-5 pl-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => window.open(doc.url, '_blank')}
                          className="p-3 bg-surface-container-high text-on-surface-variant hover:bg-primary hover:text-white rounded-xl transition-all shadow-sm"
                        >
                          <Download size={18} />
                        </button>
                        <button 
                          onClick={() => setSelectedDoc(doc)}
                          className="p-3 bg-surface-container-high text-on-surface-variant hover:bg-primary hover:text-white rounded-xl transition-all shadow-sm"
                        >
                          <History size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {filteredDocs.map(doc => (
                <motion.div 
                  key={doc.id}
                  whileHover={{ y: -4 }}
                  className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high hover:border-primary transition-all group cursor-pointer"
                  onClick={() => setSelectedDoc(doc)}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-16 h-16 rounded-[24px] bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileText size={32} />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="px-2 py-1 bg-surface-container-high rounded-full text-[9px] font-black uppercase tracking-widest text-on-surface-variant">{doc.tipo}</span>
                      <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                  <h4 className="text-lg font-black text-on-surface leading-tight mb-4 group-hover:text-primary transition-colors line-clamp-2 h-12">{doc.nome}</h4>
                  
                  <div className="space-y-3 pt-6 border-t border-surface-container-high">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-on-surface-variant">Categoria</span>
                      <span className="text-on-surface">{doc.categoria}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-on-surface-variant">Tamanho</span>
                      <span className="text-on-surface">{formatSize(doc.tamanho)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-on-surface-variant">Data</span>
                      <span className="text-on-surface">{new Date(doc.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </motion.div>
             ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-surface-dim/80 backdrop-blur-sm"
              onClick={() => setShowUploadModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-surface-container-lowest w-full max-w-xl rounded-[40px] shadow-2xl border border-surface-container-high overflow-hidden"
            >
              <div className="p-8 border-b border-surface-container-high flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black uppercase text-on-surface tracking-tight">Novo Documento</h3>
                  <p className="text-xs font-bold text-on-surface-variant mt-1 uppercase tracking-widest">Selecione o arquivo e a categoria...</p>
                </div>
                <button 
                  onClick={() => setShowUploadModal(false)}
                  className="p-3 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpload} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2">Arquivo</label>
                  <div className="relative group">
                    <input 
                      type="file" 
                      name="file"
                      required
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-full p-8 border-2 border-dashed border-surface-container-high rounded-3xl flex flex-col items-center justify-center gap-3 bg-surface-container-highest/5 group-hover:border-primary group-hover:bg-primary/5 transition-all">
                      <div className="w-12 h-12 rounded-2xl bg-surface-container-low flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                        <Plus size={24} />
                      </div>
                      <p className="text-[10px] font-black uppercase text-on-surface-variant">Clique ou arraste o arquivo aqui</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2">Categoria</label>
                  <select 
                    name="categoria"
                    required
                    className="w-full px-6 py-4 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2">Vincular a Chamado (Opcional)</label>
                  <select 
                    name="ticketId"
                    className="w-full px-6 py-4 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                  >
                    <option value="">Nenhum chamado</option>
                    {tickets.map(ticket => (
                      <option key={ticket.id} value={ticket.id}>
                        #{ticket.id.slice(-6).toUpperCase()} - {ticket.titulo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={uploading}
                    className="flex-2 py-5 bg-primary text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        Confirmar Envio
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Document Detail & Timeline Modal */}
      <AnimatePresence>
        {selectedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-surface-dim/80 backdrop-blur-sm"
              onClick={() => setSelectedDoc(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, x: 20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.9, opacity: 0, x: 20 }}
              className="relative bg-surface-container-lowest w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl border border-surface-container-high overflow-hidden flex flex-col md:flex-row"
            >
              {/* Left Side: Info & Timeline */}
              <div className="flex-1 p-10 overflow-y-auto custom-scrollbar border-b md:border-b-0 md:border-r border-surface-container-high">
               <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-lg shadow-primary/10">
                      <FileText size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase text-on-surface leading-tight">{selectedDoc.nome}</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary mt-1">{selectedDoc.categoria}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedDoc(null)} className="p-3 hover:bg-surface-container-high rounded-full text-on-surface-variant">
                    <X size={24} />
                  </button>
               </div>

                <div className="grid grid-cols-2 gap-4 mb-10">
                  <div className="p-6 bg-surface-container-highest/20 rounded-3xl space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant opacity-50">Tamanho</p>
                    <p className="text-sm font-black text-on-surface">{formatSize(selectedDoc.tamanho)}</p>
                  </div>
                  <div className="p-6 bg-surface-container-highest/20 rounded-3xl space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant opacity-50">Tipo</p>
                    <p className="text-sm font-black text-on-surface">{selectedDoc.tipo}</p>
                  </div>
                  <div className="p-6 bg-surface-container-highest/20 rounded-3xl space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant opacity-50">Enviado em</p>
                    <p className="text-sm font-black text-on-surface">{new Date(selectedDoc.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="p-6 bg-surface-container-highest/20 rounded-3xl space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-on-surface-variant opacity-50">Autor</p>
                    <p className="text-sm font-black text-on-surface">{selectedDoc.enviadoPor}</p>
                  </div>
                </div>

                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                  <History size={16} />
                  Timeline do Documento
                </h4>
                <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-surface-container-high">
                  {selectedDoc.historico?.map((h, i) => (
                    <div key={i} className="relative pl-12">
                      <div className="absolute left-[13px] top-0 w-2 h-2 rounded-full border-2 border-white bg-primary ring-4 ring-primary/5 shadow-sm" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-black uppercase text-on-surface">{h.usuario}</span>
                          <span className="text-[10px] font-bold text-on-surface-variant opacity-30">•</span>
                          <span className="text-[9px] font-bold text-on-surface-variant">{new Date(h.data).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">{h.acao}</p>
                        {h.detalhes && <p className="text-[10px] font-medium text-on-surface-variant mt-1 italic">{h.detalhes}</p>}
                      </div>
                    </div>
                  ))}
                  {(!selectedDoc.historico || selectedDoc.historico.length === 0) && (
                    <div className="pl-12">
                      <p className="text-xs font-medium text-on-surface-variant">Nenhum histórico disponível.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Comments & Actions */}
              <div className="w-full md:w-[350px] bg-surface-container-low flex flex-col">
                <div className="p-8 border-b border-surface-container-high">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => window.open(selectedDoc.url, '_blank')}
                      className="flex-1 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={16} />
                      Download
                    </button>
                    <button 
                      className="p-4 bg-surface-container-high text-on-surface-variant hover:bg-error hover:text-white rounded-2xl transition-all shadow-sm"
                      onClick={async () => {
                         if(confirm('Tem certeza que deseja excluir este documento?')) {
                            await databaseService.deleteDocumento(selectedDoc.id, user.nome);
                            setSelectedDoc(null);
                            loadData();
                         }
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                    <MessageSquare size={16} />
                    Comentários ({selectedDoc.comentarios?.length || 0})
                  </h4>
                  
                  <div className="space-y-4">
                    {selectedDoc.comentarios?.map(c => (
                      <div key={c.id} className="p-4 bg-surface-container-highest/20 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-primary">{c.userName}</span>
                          <span className="text-[8px] font-bold text-on-surface-variant">{new Date(c.data).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <p className="text-[10px] font-medium text-on-surface-variant leading-relaxed">{c.texto}</p>
                      </div>
                    ))}
                    {(!selectedDoc.comentarios || selectedDoc.comentarios.length === 0) && (
                      <div className="text-center py-10 opacity-30 flex flex-col items-center gap-2">
                        <MessageSquare size={32} />
                        <p className="text-[10px] font-black uppercase">Nenhum comentário</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 border-t border-surface-container-high bg-white/50">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="ADICIONAR COMENTÁRIO..."
                      className="w-full pl-6 pr-12 py-4 bg-surface-container-high border border-surface-container-highest rounded-2xl text-[9px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20"
                      onKeyDown={async (e) => {
                        if(e.key === 'Enter' && e.currentTarget.value) {
                          await databaseService.addDocumentoComment(selectedDoc.id, user.id, user.nome, e.currentTarget.value);
                          e.currentTarget.value = '';
                          // Refresh UI
                          const updated = await databaseService.getDocumentosByCliente(user.clienteId);
                          setDocuments(updated);
                          const freshDoc = updated.find(d => d.id === selectedDoc.id);
                          if(freshDoc) setSelectedDoc(freshDoc);
                        }
                      }}
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-primary">
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
