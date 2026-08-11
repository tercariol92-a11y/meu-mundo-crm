import { useState, useEffect, useRef } from 'react';
import { 
  Proposta, 
  Cliente, 
  ClienteContato,
  Lead, 
  Produto, 
  ItemProposta,
  Usuario 
} from '../../types';
import { databaseService } from '../../services/databaseService';
import { 
  Search, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Package, 
  User, 
  Building2,
  DollarSign,
  Calendar,
  FileText,
  X
} from 'lucide-react';
import { useCompanyConfig } from '../../hooks/useCompanyConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateProposalTotals, normalizeProposalItem } from '../../utils/proposalTotals';
import { clientContactsService } from '../../services/clientContactsService';

interface QuoteWizardProps {
  user: Usuario;
  onClose: () => void;
  onSave: () => void;
  initialData?: Proposta;
  atendimentoContext?: any;
}

export default function QuoteWizard({ user, onClose, onSave, initialData, atendimentoContext }: QuoteWizardProps) {
  const { companyConfig } = useCompanyConfig();
  const userId = user.id;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const savedRef = useRef(false);
  
  // Step 1: Client/Lead Selection
  const [clients, setClients] = useState<Cliente[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [vendedores, setVendedores] = useState<Usuario[]>([]);
  const [searchEntity, setSearchEntity] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<{ id: string, type: 'cliente' | 'lead', name: string } | null>(
    initialData ? (initialData.clienteId ? { id: initialData.clienteId, type: 'cliente', name: initialData.cliente?.nomeFantasia || '' } : { id: initialData.leadId!, type: 'lead', name: initialData.lead?.nome || '' })
      : atendimentoContext ? (atendimentoContext.clienteId
        ? { id: atendimentoContext.clienteId, type: 'cliente' as const, name: atendimentoContext.contato?.nome || '' }
        : { id: atendimentoContext.leadId || '', type: 'lead' as const, name: atendimentoContext.contato?.nome || 'Contato WhatsApp' }) : null
  );
  const [clientContacts, setClientContacts] = useState<ClienteContato[]>([]);
  const [selectedContactId, setSelectedContactId] = useState(initialData?.contatoId || '');

  // Step 2: Products
  const [products, setProducts] = useState<Produto[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedItems, setSelectedItems] = useState<ItemProposta[]>(() => {
    return (initialData?.itens || []).map(item => normalizeProposalItem({
      ...item,
      productId: item.productId || item.produtoId,
      valorOriginal: item.valorOriginal ?? item.valorOriginal ?? item.valorUnitario,
      valorEditado: item.valorEditado !== undefined ? item.valorEditado : (item.valorUnitario !== item.valorOriginal ? item.valorUnitario : undefined),
      subtotal: item.subtotal ?? item.total ?? (item.quantidade * item.valorUnitario)
    }));
  });

  // Step 3: Terms
  const [formData, setFormData] = useState({
    titulo: initialData?.titulo || atendimentoContext?.quickProposal?.titulo || `Orçamento - ${atendimentoContext?.contato?.nome || ''}`,
    formaPagamento: initialData?.formaPagamento || '',
    prazoEntrega: initialData?.prazoEntrega || '',
    validadeProposta: initialData?.validadeProposta || (atendimentoContext?.quickProposal?.validade ? `${atendimentoContext.quickProposal.validade} dias` : '10 dias'),
    observacoes: initialData?.observacoes || atendimentoContext?.quickProposal?.observacoes || '',
    solucaoProposta: initialData?.solucaoProposta || atendimentoContext?.quickProposal?.descricao || '',
    sobreEmpresa: initialData?.sobreEmpresa || '',
    diferenciais: initialData?.diferenciais || '',
    vendedorId: initialData?.vendedorId || atendimentoContext?.vendedorId || userId
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const loadContacts = async () => {
      if (selectedEntity?.type !== 'cliente') return setClientContacts([]);
      const client = clients.find(item => item.id === selectedEntity.id);
      if (!client) return;
      const contacts = await clientContactsService.list(client);
      setClientContacts(contacts);
      if (!selectedContactId && contacts.length) setSelectedContactId(clientContactsService.byPurpose(contacts, 'orcamento')[0].id);
    };
    void loadContacts();
  }, [selectedEntity?.id, selectedEntity?.type, clients]);

  const fetchData = async () => {
    try {
      const [clientsData, leadsData, productsData, usersData] = await Promise.all([
        databaseService.getClientes(),
        databaseService.getLeads(),
        databaseService.getProdutos(),
        databaseService.getUsuarios()
      ]);
      setClients(clientsData || []);
      setLeads(leadsData || []);
      setProducts(productsData || []);
      // Filter for users who can be sellers (admin, vendedor, gerente_comercial, or anyone who receives commission)
      setVendedores(usersData?.filter(u => 
        u.ativo !== false && (
          u.role === 'admin' || 
          u.role === 'vendedor' || 
          u.role === 'gerente_comercial' || 
          u.roles?.includes('vendedor') || 
          u.roles?.includes('admin') || 
          u.roles?.includes('gerente_comercial') || 
          u.receivesCommission === true ||
          (u as any).podeVender === true
        )
      ) || []);

      // If creating a new proposal, use company defaults
      if (!initialData) {
        setFormData(prev => ({
          ...prev,
          sobreEmpresa: companyConfig?.sobreEmpresa || 'Somos especialistas em soluções tecnológicas para segurança e controle de acesso.',
          diferenciais: companyConfig?.diferenciais || 'Suporte técnico especializado, equipamentos de última geração e atendimento personalizado.'
        }));
      } else {
        // If editing an existing proposal but fields are empty, fill with company defaults
        setFormData(prev => ({
          ...prev,
          sobreEmpresa: prev.sobreEmpresa || companyConfig?.sobreEmpresa || '',
          diferenciais: prev.diferenciais || companyConfig?.diferenciais || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching wizard data:', error);
    }
  };

  const filteredEntities = [
    ...clients.map(c => ({ id: c.id, type: 'cliente' as const, name: c.nomeFantasia })),
    ...leads.filter(l => l.status !== 'Fechado').map(l => ({ id: l.id, type: 'lead' as const, name: l.nome }))
  ].filter(e => e.name.toLowerCase().includes(searchEntity.toLowerCase()));

  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.modelo?.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const addItem = (product: Produto) => {
    const existing = selectedItems.find(item => item.produtoId === product.id);
    if (existing) {
      setSelectedItems(selectedItems.map(item => {
        if (item.produtoId === product.id) {
          const qty = item.quantidade + 1;
          const price = item.valorEditado !== undefined ? item.valorEditado : (item.valorOriginal ?? item.valorUnitario);
          const sub = qty * price;
          return normalizeProposalItem({
            ...item,
            quantidade: qty,
            valorUnitario: price,
            subtotal: sub,
            total: sub
          });
        }
        return item;
      }));
    } else {
      setSelectedItems([...selectedItems, normalizeProposalItem({
        produtoId: product.id,
        productId: product.id,
        nome: product.nome,
        quantidade: 1,
        valorUnitario: product.valorVenda,
        valorOriginal: product.valorVenda,
        valorEditado: undefined,
        custoUnitario: typeof product.custo === 'number' && product.custo > 0 ? product.custo : ((product.valorVenda || 0) * 0.6),
        subtotal: product.valorVenda,
        total: product.valorVenda,
        imageUrl: product.imageUrl,
        descricao: product.descricao,
        beneficios: product.beneficios,
        desconto: 0,
        valorFinal: product.valorVenda
      })]);
    }
  };

  const removeItem = (productId: string) => {
    setSelectedItems(selectedItems.filter(item => item.produtoId !== productId));
  };

  const updateQuantity = (productId: string, qty: number) => {
    if (qty < 1) return;
    setSelectedItems(selectedItems.map(item => {
      if (item.produtoId === productId) {
        const price = item.valorEditado !== undefined ? item.valorEditado : (item.valorOriginal ?? item.valorUnitario);
        const sub = qty * price;
        return normalizeProposalItem({
          ...item,
          quantidade: qty,
          valorUnitario: price,
          subtotal: sub,
          total: sub
        });
      }
      return item;
    }));
  };

  const updateUnitPrice = (productId: string, price: number) => {
    setSelectedItems(selectedItems.map(item => {
      if (item.produtoId === productId) {
        const sub = item.quantidade * price;
        return normalizeProposalItem({
          ...item,
          valorEditado: price,
          valorUnitario: price,
          subtotal: sub,
          total: sub
        });
      }
      return item;
    }));
  };

  const updateItemBilling = (productId: string, changes: Partial<ItemProposta>) => {
    setSelectedItems(items => items.map(item => item.produtoId === productId ? normalizeProposalItem({ ...item, ...changes }) : item));
  };

  const totals = calculateProposalTotals(selectedItems);
  const totalValue = totals.investimentoInicial;

  const requestClose = () => {
    const hasChanges = selectedItems.length > (initialData?.itens?.length || 0) || step > 1;
    if (!savedRef.current && hasChanges && !window.confirm('Existem alterações não salvas. Deseja sair do orçamento?')) return;
    onClose();
  };

  const getBRLDisplay = (item: ItemProposta) => {
    const value = item.valorEditado !== undefined ? item.valorEditado : (item.valorOriginal ?? item.valorUnitario);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const handleBRLInputChange = (productId: string, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '');
    if (digits === '') {
      updateUnitPrice(productId, 0);
      return;
    }
    const numericValue = parseFloat(digits) / 100;
    updateUnitPrice(productId, numericValue);
  };

  const handleSave = async () => {
    if (!selectedEntity || selectedItems.length === 0 || !formData.titulo || !formData.vendedorId) return;

    setLoading(true);
    try {
      const propostaData: Omit<Proposta, 'id' | 'createdAt' | 'updatedAt'> = {
        titulo: formData.titulo,
        valor: totalValue,
        status: initialData?.status || 'Rascunho',
        itens: totals.items,
        totalProdutos: totals.totalProdutos,
        totalServicos: totals.totalServicos,
        totalMensal: totals.totalMensal,
        totalAnual: totals.totalAnual,
        investimentoInicial: totals.investimentoInicial,
        clienteId: selectedEntity.type === 'cliente' ? selectedEntity.id : undefined,
        clienteNome: selectedEntity.type === 'cliente' ? selectedEntity.name : undefined,
        ...(selectedEntity.type === 'cliente' && selectedContactId ? (() => {
          const contact = clientContacts.find(item => item.id === selectedContactId);
          return { contatoId: contact?.id, contatoNome: contact?.nome, contatoTelefone: contact?.celularWhatsapp || contact?.telefone, contatoEmail: contact?.email };
        })() : {}),
        leadId: selectedEntity.type === 'lead' ? selectedEntity.id : undefined,
        leadNome: selectedEntity.type === 'lead' ? selectedEntity.name : undefined,
        ...formData
        ,...(atendimentoContext ? {
          origin: 'whatsapp_atendimento', conversationId: atendimentoContext.conversationId,
          atendimentoId: atendimentoContext.atendimentoId, contactPhone: atendimentoContext.contactPhone,
          createdFromModule: 'atendimento', createdByUserId: atendimentoContext.createdByUserId,
          createdByUserName: atendimentoContext.createdByUserName, ownerUserId: atendimentoContext.ownerUserId,
          assignedUserId: atendimentoContext.assignedUserId
        } : {})
      };

      if (initialData?.id) {
        await databaseService.updateProposta(initialData.id, propostaData);
      } else {
        const saved = await databaseService.createProposta(propostaData);
        if (saved?.id && atendimentoContext?.leadId) {
          await databaseService.updateLead(atendimentoContext.leadId, {
            orcamentoId: saved.id, orcamentoNumero: saved.id.slice(-6).toUpperCase(), orcamentoStatus: propostaData.status,
            orcamentoValor: propostaData.valor, orcamentoCriadoEm: new Date().toISOString()
          } as any);
        }
      }
      savedRef.current = true;
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving quote:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-container-low w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-surface-container-high"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-surface-container-high flex items-center justify-between bg-surface-container-lowest">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-on-surface">
              {initialData ? 'Editar Orçamento' : 'Novo Orçamento'}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              {companyConfig?.logoUrl && (
                <img 
                  src={companyConfig.logoUrl} 
                  alt="Logo" 
                  className="h-4 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              )}
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">• {companyConfig?.nome || 'Gestão Comercial'}</p>
            </div>
            <div className="flex items-center gap-4 mt-3">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    step === s ? 'bg-primary text-white' : 
                    step > s ? 'bg-green-500 text-white' : 'bg-surface-container-highest text-on-surface-variant'
                  }`}>
                    {step > s ? <Check size={12} /> : s}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    step === s ? 'text-primary' : 'text-on-surface-variant'
                  }`}>
                    {s === 1 ? 'Cliente' : s === 2 ? 'Produtos' : 'Condições'}
                  </span>
                  {s < 3 && <div className="w-8 h-[1px] bg-surface-container-high" />}
                </div>
              ))}
            </div>
          </div>
          <button 
            onClick={requestClose} 
            className="flex items-center gap-2 bg-surface-container-highest text-on-surface-variant px-4 py-2 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-surface-container-high transition-all border border-surface-container-high"
          >
            <X size={18} />
            Sair
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <User size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Selecionar Cliente ou Lead</h3>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por nome..."
                      className="w-full pl-12 pr-4 py-4 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      value={searchEntity}
                      onChange={(e) => setSearchEntity(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredEntities.map((entity) => (
                      <button
                        key={`${entity.type}-${entity.id}`}
                        onClick={() => { setSelectedEntity(entity); setSelectedContactId(''); }}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                          selectedEntity?.id === entity.id 
                            ? 'bg-primary/10 border-primary shadow-sm' 
                            : 'bg-surface-container-low border-surface-container-high hover:border-primary/50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          entity.type === 'cliente' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {entity.type === 'cliente' ? <Building2 size={20} /> : <User size={20} />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-on-surface">{entity.name}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-50">
                            {entity.type === 'cliente' ? 'Cliente' : 'Lead'}
                          </p>
                        </div>
                        {selectedEntity?.id === entity.id && (
                          <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center">
                            <Check size={14} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {selectedEntity?.type === 'cliente' && (
                    <div className="p-4 rounded-2xl border border-surface-container-high bg-surface-container-low">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">Contato que receberá o orçamento</label>
                      <select className="w-full px-4 py-3 rounded-xl border border-surface-container-high bg-surface" value={selectedContactId} onChange={event => setSelectedContactId(event.target.value)}>
                        <option value="">Selecione o contato</option>
                        {clientContacts.map(contact => <option key={contact.id} value={contact.id}>{contact.nome} — {contact.departamentoOutro || contact.departamento || 'Contato'}{contact.recebeOrcamento ? ' · Recebe orçamento' : ''}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Product Search */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                      <Package size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Adicionar Itens</h3>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                      <input
                        type="text"
                        placeholder="Buscar produtos..."
                        className="w-full pl-10 pr-4 py-3 bg-surface-container-highest/20 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                      {filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => addItem(product)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-surface-container-high hover:border-primary/50 transition-all text-left bg-surface-container-lowest group"
                        >
                          <div className="w-12 h-12 rounded-lg bg-surface-container-highest overflow-hidden flex items-center justify-center text-primary font-bold shrink-0">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              product.nome.charAt(0)
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-on-surface">{product.nome}</p>
                            <p className="text-[10px] text-primary font-black">R$ {product.valorVenda.toLocaleString('pt-BR')}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus size={16} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Items */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-primary">
                        <FileText size={18} />
                        <h3 className="text-xs font-black uppercase tracking-widest">Itens Selecionados</h3>
                      </div>
                      <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                        {selectedItems.length} itens
                      </span>
                    </div>
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                      {selectedItems.length === 0 ? (
                        <div className="py-12 text-center border-2 border-dashed border-surface-container-high rounded-2xl">
                          <Package size={32} className="mx-auto text-on-surface-variant opacity-20 mb-2" />
                          <p className="text-xs text-on-surface-variant italic">Nenhum item adicionado</p>
                        </div>
                      ) : (
                        selectedItems.map((item) => (
                          <div key={item.produtoId} className="p-4 bg-surface-container-highest/30 rounded-2xl border border-surface-container-high space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-on-surface">{item.nome}</p>
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  {item.periodicidade === 'mensal' ? 'Mensal' : item.periodicidade === 'anual' ? 'Anual' : item.tipoItem === 'servico' ? 'Serviço' : 'Produto'}
                                </span>
                                {item.migrationNeedsReview && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Revisar classificação</span>}
                              </div>
                              <button onClick={() => removeItem(item.produtoId)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <label className="space-y-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Tipo do item</span>
                                <select value={item.tipoItem || 'produto'} onChange={(e) => {
                                  const tipoItem = e.target.value as ItemProposta['tipoItem'];
                                  updateItemBilling(item.produtoId, { tipoItem, periodicidade: tipoItem === 'produto' ? 'unica' : tipoItem === 'recorrencia' && item.periodicidade === 'unica' ? 'mensal' : item.periodicidade });
                                }} className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-xs font-bold">
                                  <option value="produto">Produto</option><option value="servico">Serviço</option><option value="recorrencia">Recorrência</option>
                                </select>
                              </label>
                              <label className="space-y-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Forma de cobrança</span>
                                <select value={item.periodicidade || 'unica'} disabled={item.tipoItem === 'produto'} onChange={(e) => updateItemBilling(item.produtoId, { periodicidade: e.target.value as ItemProposta['periodicidade'] })} className="w-full px-3 py-2 rounded-xl border border-surface-container-high bg-surface text-xs font-bold disabled:opacity-60">
                                  {item.tipoItem !== 'recorrencia' && <option value="unica">Pagamento único</option>}<option value="mensal">Mensal</option><option value="anual">Anual</option>
                                </select>
                              </label>
                            </div>
                            <div className="flex flex-wrap items-end justify-between gap-4">
                              <div className="space-y-1.5 flex-1 min-w-[120px]">
                                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Valor Unitário</label>
                                <div className="relative">
                                  <input 
                                    type="text"
                                    value={getBRLDisplay(item)}
                                    onChange={(e) => handleBRLInputChange(item.produtoId, e.target.value)}
                                    className="w-full px-4 py-2 bg-surface-container-low border border-surface-container-high rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="R$ 0,00"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5 w-28">
                                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Desconto R$</label>
                                <input type="number" min="0" step="0.01" value={item.desconto || 0} onChange={(e) => updateItemBilling(item.produtoId, { desconto: Number(e.target.value) })} className="w-full px-3 py-2 bg-surface-container-low border border-surface-container-high rounded-xl text-sm font-bold" />
                              </div>

                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => updateQuantity(item.produtoId, item.quantidade - 1)}
                                  className="w-8 h-8 rounded-lg bg-surface-container-low border border-surface-container-high flex items-center justify-center text-on-surface hover:bg-surface-container-highest transition-colors"
                                >
                                  -
                                </button>
                                <span className="text-sm font-bold w-8 text-center">{item.quantidade}</span>
                                <button 
                                  onClick={() => updateQuantity(item.produtoId, item.quantidade + 1)}
                                  className="w-8 h-8 rounded-lg bg-surface-container-low border border-surface-container-high flex items-center justify-center text-on-surface hover:bg-surface-container-highest transition-colors"
                                >
                                  +
                                </button>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black">Subtotal</p>
                                <p className="text-sm font-bold text-primary">R$ {(item.valorFinal ?? item.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {selectedItems.length > 0 && (
                      <div className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 space-y-2">
                        {totals.totalProdutos > 0 && <div className="flex justify-between text-xs"><span>Total de produtos</span><b>R$ {totals.totalProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b></div>}
                        {totals.totalServicos > 0 && <div className="flex justify-between text-xs"><span>Total de serviços</span><b>R$ {totals.totalServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b></div>}
                        <div className="flex justify-between border-t border-white/30 pt-2"><span className="text-xs font-black uppercase tracking-widest">Investimento inicial</span><span className="text-xl font-black">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                        {totals.totalMensal > 0 && <div className="flex justify-between text-xs"><span>Mensalidade</span><b>R$ {totals.totalMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</b></div>}
                        {totals.totalAnual > 0 && <div className="flex justify-between text-xs"><span>Anuidade</span><b>R$ {totals.totalAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/ano</b></div>}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-primary">
                        <FileText size={18} />
                        <h3 className="text-xs font-black uppercase tracking-widest">Informações Gerais</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Título do Orçamento</label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 bg-surface-container-highest/20 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={formData.titulo}
                            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                            placeholder="Ex: Proposta de Controle de Acesso - Sede"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Forma de Pagamento</label>
                            <input
                              type="text"
                              className="w-full px-4 py-3 bg-surface-container-highest/20 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                              value={formData.formaPagamento}
                              onChange={(e) => setFormData({ ...formData, formaPagamento: e.target.value })}
                              placeholder="Ex: 50% entrada + 50% 30 dias"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Prazo de Entrega</label>
                            <input
                              type="text"
                              className="w-full px-4 py-3 bg-surface-container-highest/20 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                              value={formData.prazoEntrega}
                              onChange={(e) => setFormData({ ...formData, prazoEntrega: e.target.value })}
                              placeholder="Ex: 7 a 10 dias úteis"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Vendedor Responsável *</label>
                          <select
                            required
                            disabled={user.role !== 'admin' && !user.permissions?.alterarVendedor}
                            className="w-full px-4 py-3 bg-surface-container-highest/20 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                            value={formData.vendedorId}
                            onChange={(e) => setFormData({ ...formData, vendedorId: e.target.value })}
                          >
                            <option value="">Selecione o vendedor...</option>
                            {vendedores.map(v => (
                              <option key={v.id} value={v.id}>{v.nome}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Solução Proposta (Resumo)</label>
                          <textarea
                            className="w-full px-4 py-3 bg-surface-container-highest/20 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-none"
                            value={formData.solucaoProposta}
                            onChange={(e) => setFormData({ ...formData, solucaoProposta: e.target.value })}
                            placeholder="Descreva brevemente a solução oferecida..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-primary">
                        <Building2 size={18} />
                        <h3 className="text-xs font-black uppercase tracking-widest">Conteúdo da Proposta Visual</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Sobre a Empresa</label>
                          <textarea
                            className="w-full px-4 py-3 bg-surface-container-highest/20 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px] resize-none"
                            value={formData.sobreEmpresa}
                            onChange={(e) => setFormData({ ...formData, sobreEmpresa: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Nossos Diferenciais</label>
                          <textarea
                            className="w-full px-4 py-3 bg-surface-container-highest/20 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px] resize-none"
                            value={formData.diferenciais}
                            onChange={(e) => setFormData({ ...formData, diferenciais: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Observações Internas</label>
                          <textarea
                            className="w-full px-4 py-3 bg-surface-container-highest/20 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px] resize-none"
                            value={formData.observacoes}
                            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                            placeholder="Notas que não aparecem na proposta visual..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-surface-container-high bg-surface-container-lowest flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={requestClose}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase text-xs tracking-widest transition-all bg-surface-container-highest text-on-surface hover:bg-surface-container-high border border-surface-container-high"
            >
              <X size={18} />
              Sair
            </button>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase text-xs tracking-widest transition-all bg-surface-container-highest text-on-surface hover:bg-surface-container-high"
              >
                <ChevronLeft size={18} />
                Voltar
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !selectedEntity || step === 2 && selectedItems.length === 0}
                className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
              >
                Próximo
                <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={loading || !formData.titulo}
                className="flex items-center gap-2 bg-primary text-white px-10 py-3 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check size={18} />
                )}
                {initialData ? 'Atualizar Orçamento' : 'Finalizar Orçamento'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
