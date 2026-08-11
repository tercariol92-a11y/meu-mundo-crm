import { useState, useMemo, useEffect } from 'react';
import { 
  Proposta, 
  Usuario 
} from '../../types';
import { formatDateBR } from '../../utils/date';
import { databaseService } from '../../services/databaseService';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  User as UserIcon,
  DollarSign,
  ChevronRight,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  PieChart,
  Target,
  Eye,
  Edit2,
  Trash2,
  Download,
  Mail,
  Sparkles,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import QuoteWizard from './QuoteWizard';
import { proposalTotals } from '../../utils/proposalTotals';
import ProposalViewer from './ProposalViewer';
import NegotiationDrawer from './NegotiationDrawer';
import { useGlobalData } from '../../contexts/GlobalDataContext';
import { ProposalSortOption, sortProposals } from '../../utils/proposalOrdering';

interface QuotesListProps {
  user: Usuario;
  onViewChange?: (view: any) => void;
}

export default function QuotesList({ user, onViewChange }: QuotesListProps) {
  const { propostas: quotes, usuarios: usersData, clientes: clientsData, leads: leadsData, loading } = useGlobalData();
  const userId = user.id;
  const isLocalAdmin = user.role === 'admin' || user.roles?.includes('admin');
  const canChangeVendedor = isLocalAdmin || (user as any).permissions?.alterarVendedor;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [vendedorFilter, setVendedorFilter] = useState<string>('Todos');
  const [sortOption, setSortOption] = useState<ProposalSortOption>('recentes');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Proposta | null>(null);
  const [viewingQuote, setViewingQuote] = useState<Proposta | null>(null);
  const [negotiationIndex, setNegotiationIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [atendimentoContext, setAtendimentoContext] = useState<any>(null);

  useEffect(() => {
    const requestedBudgetId = sessionStorage.getItem('atendimento_open_budget_id');
    if (requestedBudgetId && quotes.length) {
      const requested = quotes.find(quote => quote.id === requestedBudgetId);
      if (requested) setViewingQuote(requested);
      sessionStorage.removeItem('atendimento_open_budget_id');
    }
    const raw = sessionStorage.getItem('atendimento_budget_context');
    if (!raw) return;
    try {
      const context = JSON.parse(raw);
      setAtendimentoContext(context);
      setSelectedQuote(null);
      setIsWizardOpen(true);
    } catch { sessionStorage.removeItem('atendimento_budget_context'); }
  }, [quotes]);

  const getClientOrLeadName = (quote: Proposta) => {
    if (quote.clienteNome) return quote.clienteNome;
    if (quote.leadNome) return quote.leadNome;
    
    if (quote.clienteId) {
      const foundClient = (clientsData || []).find(c => c.id === quote.clienteId);
      if (foundClient) return foundClient.nomeFantasia || foundClient.razaoSocial;
    }
    
    if (quote.leadId) {
      const foundLead = (leadsData || []).find(l => l.id === quote.leadId);
      if (foundLead) return foundLead.nome;
    }
    
    return quote.cliente?.nomeFantasia || quote.lead?.nome || '-';
  };

  const vendedores = useMemo(() => {
    return usersData?.filter(u => 
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
    ) || [];
  }, [usersData]);

  const filteredQuotes = useMemo(() => sortProposals(quotes.filter(quote => {
    const entityName = getClientOrLeadName(quote).toLowerCase();
    const matchesSearch = 
      (quote.titulo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      entityName.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || quote.status === statusFilter;
    const matchesVendedor = vendedorFilter === 'Todos' || quote.vendedorId === vendedorFilter;
    return matchesSearch && matchesStatus && matchesVendedor;
  }), sortOption), [quotes, searchTerm, statusFilter, vendedorFilter, sortOption, clientsData, leadsData]);

  const approvedTotals = quotes.filter(q => q.status === 'Aprovado').map(proposalTotals);
  const stats = {
    totalValue: quotes.reduce((sum, q) => sum + proposalTotals(q).investimentoInicial, 0),
    approvalRate: quotes.length > 0 ? (quotes.filter(q => q.status === 'Aprovado').length / quotes.length) * 100 : 0,
    revenue: approvedTotals.reduce((sum, total) => sum + total.investimentoInicial, 0),
    products: approvedTotals.reduce((sum, total) => sum + total.totalProdutos, 0),
    services: approvedTotals.reduce((sum, total) => sum + total.totalServicos, 0),
    mrr: approvedTotals.reduce((sum, total) => sum + total.totalMensal, 0),
    arr: approvedTotals.reduce((sum, total) => sum + total.totalAnual, 0),
    monthlyCount: approvedTotals.filter(total => total.hasMonthly).length,
    annualCount: approvedTotals.filter(total => total.hasAnnual).length,
    activeQuotes: quotes.filter(q => q.status === 'Enviado' || q.status === 'Rascunho' || q.status === 'Em negociação').length
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Rascunho': return 'bg-gray-100 text-gray-700';
      case 'Enviado': return 'bg-blue-100 text-blue-700';
      case 'Em negociação': return 'bg-orange-100 text-orange-700';
      case 'Aprovado': return 'bg-green-100 text-green-700';
      case 'Reprovado': return 'bg-red-100 text-red-700';
      case 'Cancelado': return 'bg-gray-700 text-white';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Rascunho': return <Clock size={12} />;
      case 'Enviado': return <Send size={12} />;
      case 'Em negociação': return <TrendingUp size={12} />;
      case 'Aprovado': return <CheckCircle2 size={12} />;
      case 'Reprovado': return <XCircle size={12} />;
      case 'Cancelado': return <XCircle size={12} />;
      default: return <Clock size={12} />;
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este orçamento?')) {
      try {
        await databaseService.deleteProposta(id);
        setToast({ message: 'Orçamento excluído com sucesso!', type: 'success' });
      } catch (error) {
        setToast({ message: 'Erro ao excluir orçamento.', type: 'error' });
      }
    }
  };

  const handleStatusChange = async (id: string, newStatus: Proposta['status']) => {
    try {
      await databaseService.updateProposta(id, { status: newStatus });
      setToast({ message: `Status atualizado para ${newStatus}`, type: 'success' });
    } catch (error) {
      console.error('Error updating status:', error);
      setToast({ message: 'Erro ao atualizar status.', type: 'error' });
    }
  };

  const handleVendedorChange = async (id: string, newVendedorId: string) => {
    try {
      await databaseService.updateProposta(id, { vendedorId: newVendedorId });
      setToast({ message: 'Vendedor atualizado com sucesso!', type: 'success' });
    } catch (error) {
      console.error('Error updating vendedor:', error);
      setToast({ message: 'Erro ao atualizar vendedor.', type: 'error' });
    }
  };

  const handleDownloadPDF = (quote: Proposta) => {
    setViewingQuote(quote);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleSendEmail = (quote: Proposta) => {
    const entityName = quote.cliente?.nomeFantasia || quote.lead?.nome || 'Cliente';
    const entityEmail = quote.cliente?.emailPrincipal || quote.lead?.email || '';
    const subject = encodeURIComponent(`Proposta Comercial: ${quote.titulo}`);
    const body = encodeURIComponent(`Olá ${entityName},\n\nSegue em anexo a proposta comercial referente a ${quote.titulo}.\n\nAtenciosamente,`);
    window.location.href = `mailto:${entityEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            <h1 className="text-2xl font-black uppercase tracking-tight text-on-surface">Orçamentos</h1>
            <p className="text-sm text-on-surface-variant">Crie e acompanhe propostas comerciais profissionais</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setSelectedQuote(null);
            setIsWizardOpen(true);
          }}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          Novo Orçamento
        </button>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <DollarSign size={20} />
            </div>
            <TrendingUp size={16} className="text-green-500" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Valor em Propostas</p>
          <p className="text-2xl font-black text-on-surface">R$ {stats.totalValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
        </div>

        <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-100 text-green-600 rounded-xl">
              <CheckCircle2 size={20} />
            </div>
            <PieChart size={16} className="text-primary" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Taxa de Aprovação</p>
          <p className="text-2xl font-black text-on-surface">{stats.approvalRate.toFixed(1)}%</p>
        </div>

        <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <TrendingUp size={20} />
            </div>
            <Target size={16} className="text-primary" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Receita Gerada</p>
          <p className="text-2xl font-black text-on-surface">R$ {stats.revenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
        </div>

        <div className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <Clock size={20} />
            </div>
            <TrendingUp size={16} className="text-orange-500" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Propostas Ativas</p>
          <p className="text-2xl font-black text-on-surface">{stats.activeQuotes}</p>
        </div>
        <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high"><p className="text-[9px] font-black uppercase text-on-surface-variant">Produtos vendidos</p><p className="text-xl font-black">R$ {stats.products.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p></div>
        <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high"><p className="text-[9px] font-black uppercase text-on-surface-variant">Serviços vendidos</p><p className="text-xl font-black">R$ {stats.services.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p></div>
        <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high"><p className="text-[9px] font-black uppercase text-on-surface-variant">MRR / ARR</p><p className="text-sm font-black text-blue-700">R$ {stats.mrr.toLocaleString('pt-BR')}/mês</p><p className="text-sm font-black text-purple-700">R$ {stats.arr.toLocaleString('pt-BR')}/ano</p><p className="text-[9px] text-on-surface-variant">{stats.monthlyCount} mensais · {stats.annualCount} anuais</p></div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input
            type="text"
            placeholder="Buscar por título ou cliente..."
            className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-on-surface-variant" />
          <select
            className="flex-1 bg-surface-container-low border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="Todos">Todos os Status</option>
            <option value="Rascunho">Rascunho</option>
            <option value="Enviado">Enviado</option>
            <option value="Em negociação">Em negociação</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Reprovado">Reprovado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <UserIcon size={18} className="text-on-surface-variant" />
          <select
            className="flex-1 bg-surface-container-low border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={vendedorFilter}
            onChange={(e) => setVendedorFilter(e.target.value)}
          >
            <option value="Todos">Todos os Vendedores</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id}>{v.nome}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-on-surface-variant" />
          <select
            aria-label="Ordenar orçamentos"
            className="flex-1 bg-surface-container-low border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value as ProposalSortOption)}
          >
            <option value="recentes">Mais recentes</option>
            <option value="antigos">Mais antigos</option>
            <option value="maior_valor">Maior valor</option>
            <option value="menor_valor">Menor valor</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-low rounded-3xl border border-surface-container-high overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/30 border-b border-surface-container-high">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Orçamento</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Cliente/Lead</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Vendedor</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Valor</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </td>
                </tr>
              ) : filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant italic">
                    Nenhum orçamento encontrado.
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((quote, idx) => (
                  <tr 
                    key={quote.id} 
                    className="hover:bg-surface-container-highest/20 transition-colors group cursor-pointer"
                    onClick={(e) => {
                      // Prevent opening drawer if clicking on interactive select/button elements
                      const targetTag = (e.target as HTMLElement).tagName.toLowerCase();
                      if (targetTag === 'select' || targetTag === 'button' || targetTag === 'svg' || targetTag === 'path' || (e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('select')) {
                        return;
                      }
                      setNegotiationIndex(idx);
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface hover:text-primary transition-colors">{quote.titulo}</p>
                          <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Criado em: {formatDateBR(quote.createdAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <UserIcon size={14} />
                          <span className="text-sm font-medium">{getClientOrLeadName(quote)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative group/vendedor w-[160px]">
                        <div className="flex items-center gap-2">
                          <UserIcon size={14} className="text-on-surface-variant shrink-0" />
                          <select
                            value={quote.vendedorId || ''}
                            disabled={!canChangeVendedor}
                            onChange={(e) => handleVendedorChange(quote.id, e.target.value)}
                            className={`appearance-none cursor-pointer flex items-center gap-1.5 w-full bg-transparent border-none p-0 text-sm font-medium ${quote.vendedorId ? 'text-on-surface' : 'text-on-surface-variant italic'} hover:text-primary transition-colors focus:ring-0 pr-8 disabled:cursor-not-allowed`}
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center' }}
                          >
                            <option value="">Não atribuído</option>
                            {vendedores.map(v => (
                              <option key={v.id} value={v.id}>{v.nome}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm font-bold text-primary">
                        <span>R$</span>
                        <span>{proposalTotals(quote).investimentoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative group/status w-fit">
                        <select
                          value={quote.status}
                          onChange={(e) => handleStatusChange(quote.id, e.target.value as any)}
                          className={`appearance-none cursor-pointer flex items-center gap-1.5 w-fit px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-95 pr-8 ${getStatusColor(quote.status)}`}
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                        >
                          <option value="Rascunho">Rascunho</option>
                          <option value="Enviado">Enviado</option>
                          <option value="Em negociação">Em negociação</option>
                          <option value="Aprovado">Aprovado</option>
                          <option value="Reprovado">Reprovado</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover/status:opacity-100 transition-opacity">
                          {getStatusIcon(quote.status)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setNegotiationIndex(idx)}
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                          title="Central de Negociação"
                        >
                          <Sparkles size={14} /> Negociar
                        </button>
                        <button 
                          onClick={() => setViewingQuote(quote)}
                          className="p-2 hover:bg-surface-container-highest text-primary rounded-lg transition-colors"
                          title="Visualizar Proposta"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => handleDownloadPDF(quote)}
                          className="p-2 hover:bg-surface-container-highest text-on-surface-variant rounded-lg transition-colors"
                          title="Baixar PDF"
                        >
                          <Download size={18} />
                        </button>
                        <button 
                          onClick={() => handleSendEmail(quote)}
                          className="p-2 hover:bg-surface-container-highest text-on-surface-variant rounded-lg transition-colors"
                          title="Enviar por E-mail"
                        >
                          <Mail size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedQuote(quote);
                            setIsWizardOpen(true);
                          }}
                          className="p-2 hover:bg-surface-container-highest text-on-surface-variant rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        {isLocalAdmin && (
                          <button 
                            onClick={() => handleDelete(quote.id)}
                            className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
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
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' 
                ? 'bg-green-600 text-white border-green-500' 
                : 'bg-red-600 text-white border-red-500'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="text-sm font-bold uppercase tracking-widest">{toast.message}</span>
          </motion.div>
        )}
        {negotiationIndex !== null && filteredQuotes[negotiationIndex] && (
          <NegotiationDrawer
            quote={filteredQuotes[negotiationIndex]}
            quotesList={filteredQuotes}
            currentIndex={negotiationIndex}
            user={user}
            onClose={() => setNegotiationIndex(null)}
            onNavigate={(newIndex) => setNegotiationIndex(newIndex)}
            onOpenPDF={(q) => handleDownloadPDF(q)}
          />
        )}
        {isWizardOpen && (
          <QuoteWizard 
            user={user}
            onClose={() => setIsWizardOpen(false)}
            onSave={() => { sessionStorage.removeItem('atendimento_budget_context'); setAtendimentoContext(null); }}
            initialData={selectedQuote || undefined}
            atendimentoContext={atendimentoContext || undefined}
          />
        )}
        {viewingQuote && (
          <ProposalViewer 
            quote={viewingQuote}
            onClose={() => setViewingQuote(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
