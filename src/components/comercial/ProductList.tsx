import React, { useState, useMemo } from 'react';
import { CurrencyInput } from '../CurrencyInput';
import { Produto, Usuario } from '../../types';
import { databaseService } from '../../services/databaseService';
import { 
  Plus, 
  Search, 
  Filter, 
  X, 
  Save, 
  Trash2, 
  Edit2, 
  Package,
  DollarSign,
  Tag,
  Layers,
  Info,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalData } from '../../contexts/GlobalDataContext';

export default function ProductList({ user }: { user: Usuario }) {
  const { produtos: products, loading } = useGlobalData();
  const canViewLucro = user.role === 'admin' || user.permissions?.viewLucro;
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos');
  const [brandFilter, setBrandFilter] = useState<string>('Todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Produto>>({
    nome: '',
    descricao: '',
    categoria: 'Outros',
    marca: '',
    modelo: '',
    custo: 0,
    margem: 0,
    valorVenda: 0,
    codigo: '',
    codigoBarras: '',
    ativo: true,
    permiteVenda: true,
    permiteLocacao: false,
    observacoes: '',
    imageUrl: ''
  });

  const handleOpenModal = (product?: Produto) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({
        nome: '',
        descricao: '',
        categoria: 'Outros',
        marca: '',
        modelo: '',
        custo: 0,
        margem: 0,
        valorVenda: 0,
        codigo: '',
        codigoBarras: '',
        ativo: true,
        permiteVenda: true,
        permiteLocacao: false,
        observacoes: '',
        imageUrl: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.valorVenda) return;

    try {
      setIsSaving(true);
      if (editingProduct) {
        await databaseService.updateProduto(editingProduct.id, formData);
      } else {
        await databaseService.createProduto(formData as Omit<Produto, 'id' | 'createdAt' | 'updatedAt'>);
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      await databaseService.deleteProduto(id);
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const calculateMargem = (custo: number, venda: number) => {
    if (!custo || custo === 0) return 100;
    return ((venda - custo) / custo) * 100;
  };

  const handleCustoChange = (val: number) => {
    const margem = formData.margem || 0;
    const venda = val * (1 + margem / 100);
    setFormData({ ...formData, custo: val, valorVenda: venda });
  };

  const handleMargemChange = (val: number) => {
    const custo = formData.custo || 0;
    const venda = custo * (1 + val / 100);
    setFormData({ ...formData, margem: val, valorVenda: venda });
  };

  const handleVendaChange = (val: number) => {
    const custo = formData.custo || 0;
    const margem = calculateMargem(custo, val);
    setFormData({ ...formData, valorVenda: val, margem });
  };

  const filteredProducts = useMemo(() => products.filter(product => {
    const matchesSearch = 
      (product.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (product.marca?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (product.modelo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (product.codigo?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'Todos' || product.categoria === categoryFilter;
    const matchesBrand = brandFilter === 'Todas' || product.marca === brandFilter;
    
    return matchesSearch && matchesCategory && matchesBrand;
  }), [products, searchTerm, categoryFilter, brandFilter]);

  const categories = ['Catraca', 'Facial', 'Ponto', 'Software', 'Outros'];
  const brands = Array.from(new Set(products.map(p => p.marca).filter(Boolean))) as string[];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-on-surface">Produtos</h1>
          <p className="text-sm text-on-surface-variant">Gestão comercial e financeira do catálogo de produtos</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          Novo Produto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input
            type="text"
            placeholder="Buscar produtos..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-on-surface-variant shrink-0" />
          <select
            className="flex-1 bg-surface-container-low border border-surface-container-high rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="Todos">Categoria: Todas</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={18} className="text-on-surface-variant shrink-0" />
          <select
            className="flex-1 bg-surface-container-low border border-surface-container-high rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            <option value="Todas">Marca: Todas</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-2xl border border-surface-container-high overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/30 border-b border-surface-container-high">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Produto</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Categoria / Marca</th>
                {canViewLucro && <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Custo (R$)</th>}
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Venda (R$)</th>
                {canViewLucro && <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Margem (%)</th>}
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                      <Package size={48} className="opacity-20" />
                      <p className="font-bold">Nenhum produto cadastrado ainda</p>
                      <p className="text-xs">Clique em Novo Produto para começar</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-surface-container-highest/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-highest overflow-hidden flex items-center justify-center text-primary font-bold border border-surface-container-high shrink-0">
                          {product.imageUrl ? (
                            <img 
                              src={product.imageUrl} 
                              alt={product.nome} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            product.nome?.charAt(0) || '?'
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface">{product.nome}</p>
                          <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-medium">{product.modelo || 'Modelo não informado'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-on-surface">{product.categoria}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">{product.marca || '-'}</p>
                      </div>
                    </td>
                    {canViewLucro && (
                      <td className="px-6 py-4">
                        <p className="text-xs font-medium text-on-surface-variant">
                          R$ {product.custo?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                        </p>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <p className="text-xs font-black text-primary">
                        R$ {product.valorVenda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                      </p>
                    </td>
                    {canViewLucro && (
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold ${calculateMargem(product.custo || 0, product.valorVenda) >= 30 ? 'text-green-600' : 'text-orange-600'}`}>
                          {calculateMargem(product.custo || 0, product.valorVenda).toFixed(1)}%
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${product.ativo ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                        {product.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(product)}
                          className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors" 
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        {user.role === 'admin' && (
                          <button 
                            onClick={() => handleDelete(product.id)}
                            className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors" 
                            title="Excluir"
                          >
                            <Trash2 size={16} />
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
      </div>

      {/* Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-screen w-full max-w-xl bg-surface-container-low shadow-2xl z-[70] flex flex-col"
            >
              <div className="p-6 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-on-surface">
                    {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                  </h2>
                  <p className="text-xs text-on-surface-variant">Cadastre as informações comerciais do produto</p>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Foto do Produto */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Package size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Foto do Produto</h3>
                  </div>
                  <div className="flex items-center gap-6 p-4 bg-surface-container-highest/20 rounded-2xl border border-surface-container-high">
                    <div className="w-24 h-24 rounded-2xl bg-surface-container-low border border-surface-container-high overflow-hidden flex items-center justify-center text-primary font-bold shrink-0">
                      {formData.imageUrl ? (
                        <img 
                          src={formData.imageUrl} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Package size={32} className="opacity-20" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">URL da Imagem</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.imageUrl || ''}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        placeholder="https://exemplo.com/imagem.jpg"
                      />
                      <p className="text-[10px] text-on-surface-variant italic ml-1">Insira o link de uma imagem pública do produto</p>
                    </div>
                  </div>
                </section>

                {/* Dados Básicos */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Package size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Dados Básicos</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome do Produto *</label>
                      <input
                        required
                        type="text"
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.nome || ''}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        placeholder="Ex: Catraca Henry Lumen"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Categoria *</label>
                      <select
                        required
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.categoria || 'Outros'}
                        onChange={(e) => setFormData({ ...formData, categoria: e.target.value as any })}
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Marca</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.marca || ''}
                        onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                        placeholder="Ex: Henry"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Modelo</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.modelo || ''}
                        onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                        placeholder="Ex: Lumen Advance"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Código Interno</label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                        <input
                          type="text"
                          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={formData.codigo || ''}
                          onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                          placeholder="SKU-001"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Precificação */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <DollarSign size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Precificação</h3>
                  </div>
                  <div className={`grid grid-cols-1 ${canViewLucro ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-4 bg-surface-container-highest/10 p-4 rounded-2xl border border-surface-container-high`}>
                    {canViewLucro && (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Custo (R$)</label>
                          <CurrencyInput
                            value={formData.custo || 0}
                            onChange={(val) => handleCustoChange(val)}
                            placeholder="R$ 0,00"
                            className="w-full px-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Margem (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full px-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={formData.margem?.toFixed(1) || 0}
                            onChange={(e) => handleMargemChange(parseFloat(e.target.value))}
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Venda (R$)</label>
                      <CurrencyInput
                        value={formData.valorVenda || 0}
                        onChange={(val) => handleVendaChange(val)}
                        placeholder="R$ 0,00"
                        required
                        className="w-full px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800"
                      />
                    </div>
                  </div>
                </section>

                {/* Controle e Status */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Layers size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Controle e Status</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between p-3 bg-surface-container-highest/20 rounded-xl border border-surface-container-high">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-on-surface">Produto Ativo</span>
                        <span className="text-[10px] text-on-surface-variant">Disponível no sistema</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, ativo: !formData.ativo })}
                        className={`w-12 h-6 rounded-full transition-all relative ${formData.ativo ? 'bg-primary' : 'bg-surface-container-highest'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.ativo ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-surface-container-highest/20 rounded-xl border border-surface-container-high">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-on-surface">Permite Venda</span>
                        <span className="text-[10px] text-on-surface-variant">Disponível em orçamentos</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, permiteVenda: !formData.permiteVenda })}
                        className={`w-12 h-6 rounded-full transition-all relative ${formData.permiteVenda ? 'bg-primary' : 'bg-surface-container-highest'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.permiteVenda ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-surface-container-highest/20 rounded-xl border border-surface-container-high">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-on-surface">Permite Locação</span>
                        <span className="text-[10px] text-on-surface-variant">Disponível para contratos</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, permiteLocacao: !formData.permiteLocacao })}
                        className={`w-12 h-6 rounded-full transition-all relative ${formData.permiteLocacao ? 'bg-primary' : 'bg-surface-container-highest'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.permiteLocacao ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Observações */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Info size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Informações Adicionais</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Descrição Comercial</label>
                      <textarea
                        rows={3}
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        value={formData.descricao || ''}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        placeholder="Breve descrição para propostas"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Observações Internas</label>
                      <textarea
                        rows={3}
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        value={formData.observacoes || ''}
                        onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        placeholder="Notas para a equipe"
                      />
                    </div>
                  </div>
                </section>
              </form>

              <div className="p-6 border-t border-surface-container-high bg-surface-container-highest/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-primary text-white px-8 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
