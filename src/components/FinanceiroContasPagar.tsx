import { useState, useMemo, useRef, useEffect } from 'react';
import { CurrencyInput } from './CurrencyInput';
import { formatToBRL, formatNumberBR } from '../utils/currency';
import FinanceiroFiscalArea from './FinanceiroFiscalArea';
import { 
  Plus, Search, Edit2, Trash2, DollarSign, AlertCircle, 
  TrendingUp, BarChart3, Download, FileSpreadsheet, FileText, CheckCircle2, 
  HelpCircle, MoreVertical, X, Calendar as CalendarIcon, Filter, Clock, 
  ArrowUpRight, ArrowDownRight, Printer, RefreshCw, Upload, ShieldCheck, 
  Award, Eye, Check, Briefcase, Receipt, Settings
} from 'lucide-react';
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, AreaChart, Area
} from 'recharts';
import { useGlobalData } from '../contexts/GlobalDataContext';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, 
  setDoc, getDocs, query, where 
} from '../services/resilientFirestoreClient';
import { ContaPagar, Meta, CategoryType, AuditLog, Usuario, ContratoRecorrente, Unidade } from '../types';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { databaseService } from '../services/databaseService';
import FinanceiroContratosRecorrentes from './FinanceiroContratosRecorrentes';

interface FinanceiroContasPagarProps {
  user: Usuario;
  defaultTab?: 'dashboard' | 'lista' | 'metas' | 'relatorios' | 'faturamento' | 'contratos';
}

const CATEGOR_FIXAS = [
  'Aluguel',
  'Internet',
  'Energia elétrica',
  'Água',
  'Telefonia',
  'Folha de pagamento',
  'Impostos',
  'Contabilidade',
  'Veículos',
  'Outros'
];

const CATEGOR_VARIAVEIS = [
  'Compras de mercadorias',
  'Combustível',
  'Hospedagem',
  'Alimentação',
  'Fretes',
  'Manutenção',
  'Marketing',
  'Outros'
];

export default function FinanceiroContasPagar({ user, defaultTab = 'dashboard' }: FinanceiroContasPagarProps) {
  const { 
    contasPagar, metas, clientes, propostas, leads, contratos = [], loading 
  } = useGlobalData();

  const isAdmin = user?.role === 'admin' || user?.roles?.includes('admin');
  const hasFinancePermission = isAdmin || user?.permissions?.viewFinanceiro || user?.role === 'financeiro';
  
  if (!hasFinancePermission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-surface-container-lowest border border-dashed border-surface-container-high rounded-[40px] m-8">
        <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mb-4 shadow-md">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight text-on-surface">Acesso Restrito</h2>
        <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mt-2 max-w-md opacity-75">
          Você não tem permissão para visualizar o painel de Contas a Pagar e Despesas da empresa.
        </p>
      </div>
    );
  }

  const canWrite = isAdmin || user.permissions?.viewFinanceiro;

  // Tabs: 'dashboard' | 'lista' | 'metas' | 'relatorios' | 'faturamento' | 'contratos'
  const [activeTab, setActiveTab ] = useState<'dashboard' | 'lista' | 'metas' | 'relatorios' | 'faturamento' | 'contratos'>((defaultTab as any) || 'dashboard');

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab as any);
    }
  }, [defaultTab]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'fixa' | 'variavel'>('todos');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'Pendente' | 'Pago' | 'Vencido'>('todos');
  const [filterCategory, setFilterCategory] = useState<string>('todos');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Modal / Side Panel states
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ContaPagar | null>(null);

  // Form states
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState(CATEGOR_FIXAS[0]);
  const [categoryType, setCategoryType] = useState<CategoryType>('fixa');
  const [recorrenteSemVencimento, setRecorrenteSemVencimento] = useState(false);
  const [fornecedor, setFornecedor] = useState('');
  const [valor, setValor] = useState<number>(0);
  const [dataVencimento, setDataVencimento] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  const [statusVal, setStatusVal] = useState<'Pendente' | 'Pago' | 'Vencido'>('Pendente');
  const [observacoes, setObservacoes] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number; url: string; type: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Goal management states
  const [metaFaturamento, setMetaFaturamento] = useState<number>(0);
  const [metaLucro, setMetaLucro] = useState<number>(0);
  const [metaVendasStr, setMetaVendasStr] = useState<string>('');
  const [isSavingMetas, setIsSavingMetas] = useState(false);

  // Get active and upcoming accounts
  const nowStr = new Date().toISOString().split('T')[0];

  // Auto-calculation of date-based status and standard lists
  const processedContas = useMemo(() => {
    return contasPagar.map(conta => {
      // If it's pendente but vencido compared to local date, classify as Vencido
      if (conta.status === 'Pendente' && conta.dataVencimento < nowStr) {
        return { ...conta, isOverdue: true };
      }
      return { ...conta, isOverdue: false };
    });
  }, [contasPagar, nowStr]);

  // Current month's calculations
  const now = new Date();
  const currentMonthNum = now.getMonth() + 1; // 1-indexed
  const currentYearNum = now.getFullYear();

  // Selected or current month filter for metrics (default: current month)
  const isWithinSelectedMonthYear = (dateStr: string, fallbackDate1?: string, fallbackDate2?: string) => {
    const target = dateStr || fallbackDate1 || fallbackDate2;
    if (!target) return false;
    const d = new Date(target);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  // Filtered expenses based on all filter parameters
  const filteredExpensesList = useMemo(() => {
    return processedContas.filter(e => {
      const matchSearch = e.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.observacoes && e.observacoes.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = filterType === 'todos' || e.categoryType === filterType;
      const matchStatus = filterStatus === 'todos' || 
                         (filterStatus === 'Vencido' ? (e.status === 'Vencido' || (e.status === 'Pendente' && e.dataVencimento < nowStr)) : e.status === filterStatus);
      const matchCategory = filterCategory === 'todos' || e.categoria === filterCategory;

      let matchDates = true;
      if (dateRange.start) {
        matchDates = matchDates && e.dataVencimento >= dateRange.start;
      }
      if (dateRange.end) {
        matchDates = matchDates && e.dataVencimento <= dateRange.end;
      }
      return matchSearch && matchType && matchStatus && matchCategory && matchDates;
    });
  }, [processedContas, searchTerm, filterType, filterStatus, filterCategory, dateRange, nowStr]);

  // --- REVENUE AND INCOMING CALCULATIONS ---
  // Calculates faturamento from Global context
  const financialInflow = useMemo(() => {
    // 1. Recurrent Contract Value
    const activeContractRevenue = contratos
      .filter(c => c.status === 'Ativo' || c.status === 'Vencendo')
      .reduce((acc, c) => acc + (c.valorMensal || 0), 0);

    // 2. Approved Proposals
    const approvedPropostasThisMonth = propostas.filter(p => {
      if (p.status !== 'Aprovado') return false;
      const dateStr = p.dataAprovacao || p.updatedAt || p.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const propostasTotalValue = approvedPropostasThisMonth.reduce((acc, p) => acc + p.valor, 0);

    // 3. Closed Sales Leads this Month
    const wonLeadsThisMonth = leads.filter(l => {
      if (l.status !== 'Fechado') return false;
      const dateStr = l.dataFechamento || l.updatedAt || l.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const leadsTotalValue = wonLeadsThisMonth.reduce((acc, l) => acc + (l.valorEstimado || 0), 0);

    const totalFaturamento = activeContractRevenue + propostasTotalValue + leadsTotalValue;
    const countVendasRealizadas = approvedPropostasThisMonth.length + wonLeadsThisMonth.length;

    return {
      activeContractRevenue,
      propostasTotalValue,
      leadsTotalValue,
      totalFaturamento,
      countVendasRealizadas
    };
  }, [contratos, propostas, leads]);

  // --- OUTGOING / EXPENSES CALCULATIONS ---
  const expenseMetrics = useMemo(() => {
    const expensesThisMonth = processedContas.filter(e => isWithinSelectedMonthYear(e.dataVencimento, e.dataPagamento, e.createdAt));
    
    const totalPagar = expensesThisMonth.reduce((sum, e) => sum + e.valor, 0);
    const totalPago = expensesThisMonth.filter(e => e.status === 'Pago').reduce((sum, e) => sum + e.valor, 0);
    const totalPendente = expensesThisMonth.filter(e => e.status === 'Pendente' && e.dataVencimento >= nowStr).reduce((sum, e) => sum + e.valor, 0);
    const totalVencido = expensesThisMonth.filter(e => e.isOverdue || e.status === 'Vencido').reduce((sum, e) => sum + e.valor, 0);

    return {
      totalPagar,
      totalPago,
      totalPendente,
      totalVencido
    };
  }, [processedContas, nowStr]);

  // Forecasted Cashflow (Previsto = Receitas Previstas - Contas a pagar pendentes)
  const estimatedProfit = financialInflow.totalFaturamento - expenseMetrics.totalPagar;
  const financialHealth = estimatedProfit > 0 ? 'saudável' : estimatedProfit === 0 ? 'estável' : 'atenção';

  // --- GOALS AND TARGETS FROM DATABASE ---
  const currentGoals = useMemo(() => {
    const faturamentoGoalObj = metas.find(m => m.mes === currentMonthNum && m.ano === currentYearNum && m.tipo === 'faturamento');
    const lucroGoalObj = metas.find(m => m.mes === currentMonthNum && m.ano === currentYearNum && m.tipo === 'lucro');
    const vendasGoalObj = metas.find(m => m.mes === currentMonthNum && m.ano === currentYearNum && m.tipo === 'vendas');

    return {
      faturamento: faturamentoGoalObj?.valorObjetivo || 0,
      lucro: lucroGoalObj?.valorObjetivo || 0,
      vendas: vendasGoalObj?.valorObjetivo || 0,
    };
  }, [metas, currentMonthNum, currentYearNum]);

  // Initialize goal inputs
  useMemo(() => {
    if (currentGoals.faturamento) setMetaFaturamento(currentGoals.faturamento);
    if (currentGoals.lucro) setMetaLucro(currentGoals.lucro);
    if (currentGoals.vendas) setMetaVendasStr(currentGoals.vendas.toString());
  }, [currentGoals]);

  // Percentual atingido das metas
  const goalsCompletion = useMemo(() => {
    const fat = currentGoals.faturamento > 0 ? (financialInflow.totalFaturamento / currentGoals.faturamento) * 100 : 0;
    const luc = currentGoals.lucro > 0 ? (estimatedProfit / currentGoals.lucro) * 100 : 0;
    const ven = currentGoals.vendas > 0 ? (financialInflow.countVendasRealizadas / currentGoals.vendas) * 100 : 0;

    return {
      faturamento: Math.min(Math.round(fat), 999),
      lucro: Math.min(Math.round(luc), 999),
      vendas: Math.min(Math.round(ven), 999)
    };
  }, [currentGoals, financialInflow, estimatedProfit]);

  // --- ALERTS AND BANNERS ---
  const alertsList = useMemo(() => {
    const today = nowStr;
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Vencendo hoje
    const todayDue = processedContas.filter(e => e.status === 'Pendente' && e.dataVencimento === today);
    // Vencendo em 7 dias (excluindo hoje)
    const upcomingSevenDaysDue = processedContas.filter(e => e.status === 'Pendente' && e.dataVencimento > today && e.dataVencimento <= sevenDaysLater);
    // Vencidas
    const overdue = processedContas.filter(e => e.isOverdue || e.status === 'Vencido');

    return {
      todayDue,
      upcomingSevenDaysDue,
      overdue
    };
  }, [processedContas, nowStr]);

  // Handle category group change (e.g., Aluguel maps to 'fixa', Combustível to 'variavel')
  const handleCategorySelection = (cat: string) => {
    setCategoria(cat);
    if (CATEGOR_FIXAS.includes(cat)) {
      setCategoryType('fixa');
    } else if (CATEGOR_VARIAVEIS.includes(cat)) {
      setCategoryType('variavel');
    }
  };

  // Drag & Drop / File selection handling
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `comprovantes/${Date.now()}_${file.name}`);
      const uploadTask = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(uploadTask.ref);
      
      setAttachedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        url: downloadUrl
      });
      toast.success('Comprovante em anexo carregado com sucesso!');
    } catch (error) {
      console.error("Error uploading file to storage:", error);
      // Resilient Fallback to local data URI
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachedFile({
            name: file.name,
            size: file.size,
            type: file.type,
            url: event.target.result as string // Local mock Base64 data-uri
          });
          toast.success('Comprovante anexado localmente.');
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  // Reset expense form
  const resetExpenseForm = () => {
    setDescricao('');
    setCategoria(CATEGOR_FIXAS[0]);
    setCategoryType('fixa');
    setRecorrenteSemVencimento(false);
    setFornecedor('');
    setValor(0);
    setDataVencimento('');
    setDataPagamento('');
    setStatusVal('Pendente');
    setObservacoes('');
    setAttachedFile(null);
    setEditingExpense(null);
  };

  // Open edit modal
  const openEditExpense = (expense: ContaPagar) => {
    setEditingExpense(expense);
    setDescricao(expense.descricao);
    setCategoria(expense.categoria);
    setCategoryType(expense.categoryType);
    setRecorrenteSemVencimento(expense.recorrenteSemVencimento || false);
    setFornecedor(expense.fornecedor);
    setValor(expense.valor);
    setDataVencimento(expense.dataVencimento || '');
    setDataPagamento(expense.dataPagamento || '');
    setStatusVal(expense.status);
    setObservacoes(expense.observacoes || '');
    setAttachedFile(expense.comprovante || null);
    setIsNewExpenseOpen(true);
  };

  // Submit new/edited Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const isRecurringNoDue = categoryType === 'fixa' && recorrenteSemVencimento;
    if (!descricao || !fornecedor || valor <= 0 || (!dataVencimento && !isRecurringNoDue)) {
      toast.error('Preencha todos os campos obrigatórios e garanta que o valor seja maior que zero!');
      return;
    }

    const valorNum = valor;

    const todayDateStr = new Date().toISOString();

    const auditActionLog: AuditLog = {
      action: editingExpense ? 'update' : 'create',
      userId: user.id || 'sistema',
      userName: user.nome || 'Usuário',
      timestamp: todayDateStr,
      details: editingExpense ? `Editou conta ${descricao}` : `Cadastrou conta ${descricao}`
    };

    const expensePayload: Partial<ContaPagar> = {
      descricao,
      categoria,
      categoryType,
      recorrenteSemVencimento: categoryType === 'fixa' ? recorrenteSemVencimento : false,
      fornecedor,
      valor: valorNum,
      dataVencimento: isRecurringNoDue ? '' : dataVencimento,
      dataPagamento: dataPagamento || null,
      status: statusVal,
      observacoes,
      comprovante: attachedFile
    };

    try {
      if (editingExpense) {
        // Enforce audit history
        const updatedHistory = editingExpense.history ? [...editingExpense.history, auditActionLog] : [auditActionLog];
        await updateDoc(doc(db, 'contas_pagar', editingExpense.id), {
          ...expensePayload,
          updatedBy: user.id,
          updatedByName: user.nome || 'Usuário',
          updatedAt: todayDateStr,
          history: updatedHistory
        });
        toast.success('Despesa atualizada com sucesso!');
      } else {
        await addDoc(collection(db, 'contas_pagar'), {
          ...expensePayload,
          createdBy: user.id,
          createdByName: user.nome || 'Usuário',
          createdAt: todayDateStr,
          history: [auditActionLog]
        });
        toast.success('Despesa cadastrada com sucesso!');
      }
      setIsNewExpenseOpen(false);
      resetExpenseForm();
    } catch (err) {
      console.error('Error saving write operation to firestore:', err);
      toast.error('Falha ao salvar dados de contas a pagar.');
    }
  };

  // Toggle paid status quickly
  const togglePaidStatusQuickly = async (expense: ContaPagar) => {
    if (!canWrite) {
      toast.error('Sem permissão para esta ação');
      return;
    }

    const isNowPaid = expense.status !== 'Pago';
    const updatedStatus = isNowPaid ? 'Pago' : 'Pendente';
    const updatedPayDate = isNowPaid ? nowStr : null;
    const todayDateStr = new Date().toISOString();

    const auditActionLog: AuditLog = {
      action: 'update',
      userId: user.id || 'sistema',
      userName: user.nome || 'Usuário',
      timestamp: todayDateStr,
      details: `Marcou lançamento como ${updatedStatus}`
    };

    try {
      const updatedHistory = expense.history ? [...expense.history, auditActionLog] : [auditActionLog];
      await updateDoc(doc(db, 'contas_pagar', expense.id), {
        status: updatedStatus,
        dataPagamento: updatedPayDate,
        updatedBy: user.id,
        updatedByName: user.nome || 'Usuário',
        updatedAt: todayDateStr,
        history: updatedHistory
      });
      toast.success(isNowPaid ? 'Conta marcada como Paga!' : 'Conta marcada como Pendente.');
    } catch (error) {
      console.error("Error setting quick paid status:", error);
      toast.error('Falha ao atualizar status de pagamento.');
    }
  };

  // Force Admin-only deletion
  const handleDeleteExpense = async (expenseId: string) => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem excluir despesas');
      return;
    }

    const confirmDel = window.confirm('Tem certeza de que deseja excluir este lançamento permanentemente?');
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, 'contas_pagar', expenseId));
      toast.success('Despesa excluída com sucesso!');
    } catch (err) {
      console.error('Error deleting document:', err);
      toast.error('Erro ao excluir documento.');
    }
  };

  // Save Meta limits on db
  const handleSaveMetas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Apenas administradores podem atualizar metas da empresa!');
      return;
    }

    setIsSavingMetas(true);
    const billingGoalVal = metaFaturamento || 0;
    const profitGoalVal = metaLucro || 0;
    const salesGoalVal = parseFloat(metaVendasStr) || 0;

    try {
      const targetsToSave = [
        { tipo: 'faturamento', valor: billingGoalVal },
        { tipo: 'lucro', valor: profitGoalVal },
        { tipo: 'vendas', valor: salesGoalVal }
      ];

      for (const target of targetsToSave) {
        // Look if there represents an existing record for the same month/year/type
        const q = query(
          collection(db, 'metas'),
          where('mes', '==', currentMonthNum),
          where('ano', '==', currentYearNum),
          where('tipo', '==', target.tipo)
        );
        const querySnap = await getDocs(q);

        if (!querySnap.empty) {
          // Update
          const docId = querySnap.docs[0].id;
          await updateDoc(doc(db, 'metas', docId), {
            valorObjetivo: target.valor,
            updatedAt: new Date().toISOString()
          });
        } else {
          // Create
          await addDoc(collection(db, 'metas'), {
            mes: currentMonthNum,
            ano: currentYearNum,
            tipo: target.tipo,
            valorObjetivo: target.valor,
            createdAt: new Date().toISOString()
          });
        }
      }
      toast.success('Metas financeiras salvas com sucesso!');
    } catch (err) {
      console.error("Error setting metas:", err);
      toast.error('Erro ao salvar as metas.');
    } finally {
      setIsSavingMetas(false);
    }
  };

  // Real-time chart preparation: expenses grouped by Category Type (Fixa vs Variável)
  const categoryPieData = useMemo(() => {
    const dataMap: { [key: string]: number } = {};
    filteredExpensesList.forEach(e => {
      const key = e.categoria;
      dataMap[key] = (dataMap[key] || 0) + e.valor;
    });

    return Object.keys(dataMap).map(catName => ({
      name: catName,
      value: dataMap[catName],
      type: CATEGOR_FIXAS.includes(catName) ? 'Fixa' : 'Variável'
    })).sort((a, b) => b.value - a.value);
  }, [filteredExpensesList]);

  const COLORS = ['#2563eb', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#64748b'];

  // Excel spreadsheet exporter
  const exportToExcelSheet = () => {
    const excelRows = filteredExpensesList.map((e, index) => ({
      'ID': index + 1,
      'Descrição': e.descricao,
      'Categoria': e.categoria,
      'Tipo': e.categoryType === 'fixa' ? 'Fixa' : 'Variável',
      'Fornecedor': e.fornecedor,
      'Valor (R$)': e.valor,
      'Vencimento': e.dataVencimento,
      'Data de Pagamento': e.dataPagamento || 'Pendente',
      'Status': e.status,
      'Comprovante': e.comprovante?.name || 'Nenhum',
      'Cadastrado Por': e.createdByName,
      'Criado Em': e.createdAt ? new Date(e.createdAt).toLocaleDateString('pt-BR') : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contas a Pagar');
    XLSX.writeFile(workbook, `MundoTech_Contas_A_Pagar_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Documento Excel (.xlsx) exportado com sucesso!');
  };

  // Print PDF
  const triggerPdfPrint = () => {
    window.print();
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full uppercase tracking-wider">
              Finanças
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Contas a Pagar
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerenciamento completo de despesas comerciais, fluxo de caixa e atingimento de metas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { resetExpenseForm(); setIsNewExpenseOpen(true); }}
            disabled={!canWrite}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer"
          >
            <Plus size={16} />
            Novo Lançamento
          </button>
        </div>
      </div>

      {/* SYSTEM ALERTS STRIP (Alertas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {/* Contas Vencidas */}
        {alertsList.overdue.length > 0 && (
          <div className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl relative shadow-xs">
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
              <AlertCircle size={18} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-red-900 uppercase tracking-wide">Despesas Vencidas!</p>
              <p className="text-xs font-medium text-red-700 mt-0.5">
                Existem <b>{alertsList.overdue.length}</b> despesas aguardando pagamento após o vencimento.
              </p>
            </div>
          </div>
        )}

        {/* Contas Vencendo Hoje */}
        {alertsList.todayDue.length > 0 ? (
          <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl relative shadow-xs">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <Clock size={18} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Vence Hoje</p>
              <p className="text-xs font-medium text-amber-700 mt-0.5">
                Há <b>{alertsList.todayDue.length}</b> contas que expiram hoje no valor de R$ {alertsList.todayDue.reduce((s, e) => s + e.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
              </p>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-3 p-3.5 bg-green-50/50 border border-green-100 rounded-xl shadow-xs">
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <CheckCircle2 size={18} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-green-900 uppercase tracking-wide">Tudo em ordem</p>
              <p className="text-xs text-green-700 mt-0.5">Nenhuma conta expira no dia de hoje.</p>
            </div>
          </div>
        )}

        {/* Contas Vencendo em 7 Dias */}
        {alertsList.upcomingSevenDaysDue.length > 0 && (
          <div className="flex items-center gap-3 p-3.5 bg-blue-50/80 border border-blue-100 rounded-xl relative shadow-xs">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <CalendarIcon size={18} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-blue-900 uppercase tracking-wide">Atenção Próximos Dias</p>
              <p className="text-xs font-medium text-blue-700 mt-0.5">
                Há <b>{alertsList.upcomingSevenDaysDue.length}</b> contas expirando nos próximos 7 dias. Organize seu caixa!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* DASHBOARD MODULE SWITCH TABS */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all duration-200 shrink-0 cursor-pointer ${
            activeTab === 'dashboard' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={15} />
            Dashboard & Indicadores
          </div>
        </button>

        <button
          onClick={() => setActiveTab('lista')}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all duration-200 shrink-0 cursor-pointer ${
            activeTab === 'lista' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Filter size={15} />
            Lanctos e Cadastro ({filteredExpensesList.length})
          </div>
        </button>

        <button
          onClick={() => setActiveTab('metas')}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all duration-200 shrink-0 cursor-pointer ${
            activeTab === 'metas' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Award size={15} />
            Metas do Mês
          </div>
        </button>

        <button
          onClick={() => setActiveTab('relatorios')}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all duration-200 shrink-0 cursor-pointer ${
            activeTab === 'relatorios' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText size={15} />
            Relatórios & Exportação
          </div>
        </button>

        <button
          onClick={() => setActiveTab('faturamento')}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all duration-200 shrink-0 cursor-pointer ${
            activeTab === 'faturamento' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText size={15} />
            Faturamento & Notas Fiscais
          </div>
        </button>

        <button
          onClick={() => setActiveTab('contratos')}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all duration-200 shrink-0 cursor-pointer ${
            activeTab === 'contratos' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Briefcase size={15} />
            Contratos Recorrentes ({contratos.length})
          </div>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 uppercase tracking-widest mt-4">Carregando dados financeiros...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: DASHBOARD FINANCEIRO */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Core metrics row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 hover:shadow-xs transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3 text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Contas do Mês (Total)</span>
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-700">
                      <DollarSign size={16} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 leading-none">
                    R$ {expenseMetrics.totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Somatório de despesas com vencimento este mês.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 hover:shadow-xs transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3 text-green-500">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total Pago</span>
                    <div className="p-2 bg-green-50 rounded-lg text-green-600">
                      <CheckCircle2 size={16} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-green-600 leading-none">
                    R$ {expenseMetrics.totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </h3>
                  {expenseMetrics.totalPagar > 0 ? (
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                      <div className="bg-green-500 h-full rounded-full" style={{ width: `${(expenseMetrics.totalPago / expenseMetrics.totalPagar) * 100}%` }}></div>
                    </div>
                  ) : <div className="mt-4"></div>}
                  <p className="text-[10px] text-slate-500 mt-1">
                    {expenseMetrics.totalPagar > 0 ? `${Math.round((expenseMetrics.totalPago / expenseMetrics.totalPagar) * 100)}% das despesas totais pagas.` : 'Sem despesas cadastradas.'}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 hover:shadow-xs transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3 text-blue-500">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total Aberto (Pendentes)</span>
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                      <Clock size={16} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-blue-600 leading-none">
                    R$ {expenseMetrics.totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Lançamentos sem pagar que vencem futuramente.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 hover:shadow-xs transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3 text-red-500">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total Vencido</span>
                    <div className="p-2 bg-red-50 rounded-lg text-red-600">
                      <AlertCircle size={16} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-red-600 leading-none">
                    R$ {expenseMetrics.totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Exige regularização imediata do financeiro.
                  </p>
                </div>
              </div>

              {/* ESTIMATED HEALTH / CASHFLOW COMPARISONS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Health & Forecast */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Saúde Financeira e Caixa Previsto</h4>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl mb-4 border border-slate-100">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resultado (Lucro Previsto)</p>
                        <p className={`text-xl font-bold mt-0.5 ${estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          R$ {estimatedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider shrink-0 ${
                        financialHealth === 'saudável' 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : financialHealth === 'estável' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {financialHealth === 'saudável' ? 'Lucro Saudável' : financialHealth === 'estável' ? 'Equilibrado' : 'Déficit Previsto'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Receitas Totais Estimadas</span>
                        <span className="font-semibold text-slate-900">R$ {financialInflow.totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs border-b border-dashed border-slate-100 pb-2">
                        <span className="text-slate-500">Despesas Totais Estimadas</span>
                        <span className="font-semibold text-slate-900">R$ {expenseMetrics.totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-500 font-medium">Margem Operacional Estimada</span>
                        <span className="font-bold text-slate-900">
                          {financialInflow.totalFaturamento > 0 ? `${Math.round((estimatedProfit / financialInflow.totalFaturamento) * 100)}%` : '0%'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 bg-blue-50/50 -mx-6 -mb-6 p-4 rounded-b-2xl">
                    <div className="flex items-start gap-2.5 text-xs text-blue-800 leading-normal">
                      <TrendingUp size={16} className="shrink-0 mt-0.5" />
                      <div>
                        O faturamento é computado a partir de valores recorrentes ativos de clientes (R$ {financialInflow.activeContractRevenue.toLocaleString('pt-BR')}) adicionados às propostas aprovadas e vendas fechadas este mês.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Graph (Monthly Comparison & Inflow vs Outflow) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Fluxo de Caixa Mensal Previsto</h4>
                    <div className="h-[230px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: 'Receitas', total: financialInflow.totalFaturamento, fill: '#10b981' },
                            { name: 'Contas a Pagar', total: expenseMetrics.totalPagar, fill: '#ef4444' }
                          ]}
                          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" fontSize={11} stroke="#64748b" />
                          <YAxis fontSize={10} stroke="#64748b" />
                          <Tooltip formatter={(value: any) => `R$ ${parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                          <Bar dataKey="total" radius={[8, 8, 0, 0]} barSize={50}>
                            <Cell fill="#10b981" />
                            <Cell fill="#3b82f6" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 justify-center text-[10px] uppercase font-bold text-slate-500 tracking-wider pt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-xs"></div>
                      Receitas (Inflow)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-blue-500 rounded-xs"></div>
                      Contas (Outflow)
                    </div>
                  </div>
                </div>
              </div>

              {/* EXPENSES SPLIT GRAPH */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Despesas por Categoria (Pie Chart) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Distribuição de Contas por Categoria</h4>
                  
                  {categoryPieData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <div className="h-[210px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categoryPieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {categoryPieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: any) => `R$ ${parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                          <span className="text-base font-bold text-slate-800">R$ {expenseMetrics.totalPagar.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>

                      <div className="max-h-[220px] overflow-y-auto space-y-2 pr-2">
                        {categoryPieData.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                              <span className="text-slate-600 truncate">{item.name}</span>
                              <span className="text-[9px] px-1 bg-slate-100 text-slate-500 rounded font-semibold uppercase">{item.type}</span>
                            </div>
                            <span className="font-bold text-slate-950">
                              R$ {item.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs">
                      Sem lançamentos para gerar estatísticas.
                    </div>
                  )}
                </div>

                {/* Fixas vs Variáveis Split */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Análise: Despesas Fixas vs Variáveis</h4>
                    {processedContas.length > 0 ? (
                      <div className="space-y-6 pt-2">
                        {/* Fixas */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                              <span className="w-3 h-3 bg-blue-600 rounded-sm"></span>
                              Despesas Fixas
                            </div>
                            <span className="font-bold text-slate-900">
                              R$ {processedContas.filter(c => c.categoryType === 'fixa' && isWithinSelectedMonthYear(c.dataVencimento, c.dataPagamento, c.createdAt)).reduce((s, e) => s + e.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full" style={{ 
                              width: `${(processedContas.filter(c => c.categoryType === 'fixa' && isWithinSelectedMonthYear(c.dataVencimento, c.dataPagamento, c.createdAt)).reduce((s, e) => s + e.valor, 0) / (expenseMetrics.totalPagar || 1)) * 100}%` 
                            }}></div>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Valores contínuos essenciais para a operação da empresa (Aluguel, Internet, Folha de Pgto, etc.).
                          </p>
                        </div>

                        {/* Variáveis */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                              <span className="w-3 h-3 bg-emerald-500 rounded-sm"></span>
                              Despesas Variáveis
                            </div>
                            <span className="font-bold text-slate-900">
                              R$ {processedContas.filter(c => c.categoryType === 'variavel' && isWithinSelectedMonthYear(c.dataVencimento, c.dataPagamento, c.createdAt)).reduce((s, e) => s + e.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ 
                              width: `${(processedContas.filter(c => c.categoryType === 'variavel' && isWithinSelectedMonthYear(c.dataVencimento, c.dataPagamento, c.createdAt)).reduce((s, e) => s + e.valor, 0) / (expenseMetrics.totalPagar || 1)) * 100}%` 
                            }}></div>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Despesas sazonais diretamente associadas à execução das atividades (Estoque, Viagens, Marketing, etc.).
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[150px] flex items-center justify-center text-slate-400 text-xs">
                        Para visualizar o balanceamento, adicione despesas.
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-amber-50 text-amber-900 text-[11px] rounded-lg mt-4 border border-amber-100 leading-normal">
                    Recomendação financeira: Mantenha as despesas fixas abaixo de 40% do faturamento pretendido para garantir uma boa margem de lucro e liquidez.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LISTAGEM E CADASTRO */}
          {activeTab === 'lista' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* FILTERS AND CONTROLS COCKPIT */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Buscar por descrição, fornecedor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 text-slate-800 text-xs font-medium rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                    />
                  </div>

                  {/* Filter by Category Type */}
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="py-2 px-3 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 bg-white outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="todos">Todos os Tipos (Fixas / Variáveis)</option>
                    <option value="fixa">Despesas Fixas</option>
                    <option value="variavel">Despesas Variáveis</option>
                  </select>

                  {/* Filter by status */}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="py-2 px-3 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 bg-white outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="Pendente">Pendentes</option>
                    <option value="Pago">Pagas (Concluídas)</option>
                    <option value="Vencido">Vencidas</option>
                  </select>

                  {/* Custom specific categories */}
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="py-2 px-3 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 bg-white outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="todos">Todas as Categorias</option>
                    <optgroup label="Despesas Fixas">
                      {CATEGOR_FIXAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                    <optgroup label="Despesas Variáveis">
                      {CATEGOR_VARIAVEIS.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Date ranges */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px] font-semibold uppercase">Vencimento entre:</span>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="p-1 px-2 border border-slate-200 rounded bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-slate-400">e</span>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="p-1 px-2 border border-slate-200 rounded bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {(dateRange.start || dateRange.end) && (
                      <button 
                        onClick={() => setDateRange({ start: '', end: '' })}
                        className="p-1 text-red-500 hover:text-red-700 bg-red-50 rounded"
                        title="Limpar Datas"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px]">Encontrados: <b className="text-slate-900">{filteredExpensesList.length}</b></span>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <span className="text-slate-500 text-[11px]">Soma Filtrada: <b className="text-slate-900">R$ {filteredExpensesList.reduce((s, e) => s + e.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b></span>
                  </div>
                </div>
              </div>

              {/* TABLE AREA */}
              {filteredExpensesList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        <th className="p-4">Descrição / Fornecedor</th>
                        <th className="p-4">Categoria</th>
                        <th className="p-4">Valor</th>
                        <th className="p-4">Vencimento</th>
                        <th className="p-4">Data Pagto</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center">Docs</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                      {filteredExpensesList.map((e) => {
                        const isOverdue = e.status === 'Pendente' && e.dataVencimento < nowStr;
                        return (
                          <tr key={e.id} className="hover:bg-slate-50/50 transition duration-150">
                            {/* Descrição e Fornecedor */}
                            <td className="p-4">
                              <div className="truncate max-w-[200px]">
                                <p className="font-bold text-slate-900 truncate" title={e.descricao}>{e.descricao}</p>
                                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{e.fornecedor}</p>
                              </div>
                            </td>
                            {/* Categoria */}
                            <td className="p-4">
                              <div>
                                <p className="text-slate-800">{e.categoria}</p>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                                  e.categoryType === 'fixa' ? 'bg-blue-100/50 text-blue-800' : 'bg-amber-100/50 text-amber-800'
                                }`}>
                                  {e.categoryType === 'fixa' ? 'Fixa' : 'Variável'}
                                </span>
                              </div>
                            </td>
                            {/* Valor */}
                            <td className="p-4 font-bold text-slate-950">
                              R$ {e.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            {/* Vencimento */}
                            <td className="p-4">
                              {new Date(e.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            {/* Data de pagamento */}
                            <td className="p-4">
                              {e.dataPagamento 
                                ? new Date(e.dataPagamento + 'T12:00:00').toLocaleDateString('pt-BR') 
                                : <span className="text-slate-400 font-medium font-mono text-[10px] uppercase">--</span>}
                            </td>
                            {/* Status */}
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                                e.status === 'Pago' 
                                  ? 'bg-green-50 text-green-700 border border-green-200' 
                                  : isOverdue || e.status === 'Vencido'
                                    ? 'bg-red-50 text-red-700 border border-red-200' 
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {e.status === 'Pago' ? 'Pago' : isOverdue ? 'Vencido' : 'Pendente'}
                              </span>
                            </td>
                            {/* Attached receipt file */}
                            <td className="p-4 text-center">
                              {e.comprovante ? (
                                <a
                                  href={e.comprovante.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 inline-block rounded-md"
                                  title={`Ver comprovante: ${e.comprovante.name}`}
                                >
                                  <Eye size={16} />
                                </a>
                              ) : (
                                <span className="text-slate-400 font-medium font-mono text-[10px]">--</span>
                              )}
                            </td>
                            {/* Actions column */}
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Direct click quick paid status toggler */}
                                <button
                                  onClick={() => togglePaidStatusQuickly(e)}
                                  disabled={!canWrite}
                                  className={`p-1.5 hover:bg-slate-100 rounded-md shrink-0 transition cursor-pointer ${
                                    e.status === 'Pago' ? 'text-green-600' : 'text-slate-400 hover:text-green-600'
                                  }`}
                                  title={e.status === 'Pago' ? 'Marcar como não pago' : 'Marcar como Pago'}
                                >
                                  <Check size={16} />
                                </button>

                                <button
                                  onClick={() => openEditExpense(e)}
                                  disabled={!canWrite}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md shrink-0 transition cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  onClick={() => handleDeleteExpense(e.id)}
                                  disabled={!isAdmin}
                                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-md shrink-0 transition cursor-pointer disabled:opacity-40"
                                  title="Excluir (Apenas Admins)"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                  <Filter size={32} className="opacity-30 mb-2" />
                  Nenhum lançamento corresponde aos filtros ativos.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CADASTRO DE METAS */}
          {activeTab === 'metas' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Metas Form Config Panel */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck size={18} className="text-blue-600" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Definição de Diretrizes ({now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })})</h3>
                </div>
                <p className="text-xs text-slate-500 mb-6">
                  Adicione e altere os objetivos mensais da empresa. Apenas administradores do sistema podem salvar as novas definições.
                </p>

                <form onSubmit={handleSaveMetas} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Meta de Faturamento Mensal (R$)</label>
                    <CurrencyInput
                      value={metaFaturamento}
                      onChange={(val) => setMetaFaturamento(val)}
                      placeholder="R$ 0,00"
                      disabled={!isAdmin}
                      className="w-full p-2.5 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg bg-slate-50 border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Meta de Lucro Mensal (R$)</label>
                    <CurrencyInput
                      value={metaLucro}
                      onChange={(val) => setMetaLucro(val)}
                      placeholder="R$ 0,00"
                      disabled={!isAdmin}
                      className="w-full p-2.5 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg bg-slate-50 border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Meta de Vendas (Quantidade)</label>
                    <input
                      type="number"
                      placeholder="Ex: 20"
                      value={metaVendasStr}
                      onChange={(e) => setMetaVendasStr(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full p-2.5 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg bg-slate-50 border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-hidden"
                    />
                  </div>

                  {isAdmin ? (
                    <button
                      type="submit"
                      disabled={isSavingMetas}
                      className="w-full py-2.5 text-xs font-black uppercase text-white bg-blue-600 hover:bg-blue-700 transition rounded-lg shadow-sm"
                    >
                      {isSavingMetas ? 'Salvando...' : 'Salvar Diretrizes'}
                    </button>
                  ) : (
                    <div className="p-3 bg-slate-100 text-[#54656f] text-center rounded-lg text-[10px] uppercase font-bold tracking-wider">
                      Somente administradores podem editar.
                    </div>
                  )}
                </form>
              </div>

              {/* Real-time Goals tracker panels */}
              <div className="lg:col-span-2 space-y-4">
                {/* 1. Goal faturamento */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <TrendingUp size={16} />
                      </div>
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Meta de Faturamento</span>
                        <h4 className="text-sm font-bold text-slate-800">Contratos + Vendas de Projetos</h4>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 text-sm">
                        R$ {financialInflow.totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / 
                        <span className="text-slate-400 text-xs font-medium"> R$ {currentGoals.faturamento.toLocaleString('pt-BR')}</span>
                      </p>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 h-3 rounded-full mt-4 overflow-hidden relative">
                    <div className={`h-full rounded-full transition-all duration-500 ${
                      goalsCompletion.faturamento >= 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`} style={{ width: `${Math.min(goalsCompletion.faturamento, 100)}%` }}></div>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs">
                    <span className="text-slate-500 text-[11px]">Progresso de Arrecadação</span>
                    <span className={`font-black text-xs ${goalsCompletion.faturamento >= 100 ? 'text-green-600' : 'text-blue-600'}`}>
                      {goalsCompletion.faturamento}% Atingido
                    </span>
                  </div>
                </div>

                {/* 2. Goal profit */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <DollarSign size={16} />
                      </div>
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Meta de Lucro</span>
                        <h4 className="text-sm font-bold text-slate-800">Resultado Líquido Estimado</h4>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 text-sm">
                        R$ {estimatedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / 
                        <span className="text-slate-400 text-xs font-medium"> R$ {currentGoals.lucro.toLocaleString('pt-BR')}</span>
                      </p>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 h-3 rounded-full mt-4 overflow-hidden relative">
                    <div className={`h-full rounded-full transition-all duration-500 ${
                      goalsCompletion.lucro >= 100 ? 'bg-green-500' : 'bg-emerald-500'
                    }`} style={{ width: `${Math.min(Math.max(goalsCompletion.lucro, 0), 100)}%` }}></div>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs">
                    <span className="text-slate-500 text-[11px]">Progresso de Lucro (Receita - Contas)</span>
                    <span className={`font-black text-xs ${goalsCompletion.lucro >= 100 ? 'text-green-600' : 'text-emerald-600'}`}>
                      {goalsCompletion.lucro}% Atingido
                    </span>
                  </div>
                </div>

                {/* 3. Goal won sales */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                        <Award size={16} />
                      </div>
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Meta de Vendas</span>
                        <h4 className="text-sm font-bold text-slate-800">Propostas Aprovadas + Leads Ganhos</h4>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 text-sm">
                        {financialInflow.countVendasRealizadas} Vendas / 
                        <span className="text-slate-400 text-xs font-medium"> {currentGoals.vendas} Vendas</span>
                      </p>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 h-3 rounded-full mt-4 overflow-hidden relative">
                    <div className={`h-full rounded-full transition-all duration-500 ${
                      goalsCompletion.vendas >= 100 ? 'bg-green-500' : 'bg-amber-500'
                    }`} style={{ width: `${Math.min(goalsCompletion.vendas, 100)}%` }}></div>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs">
                    <span className="text-slate-500 text-[11px]">Contratos Ativados ou Fechados no mês</span>
                    <span className={`font-black text-xs ${goalsCompletion.vendas >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                      {goalsCompletion.vendas}% Atingido
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RELATORIOS */}
          {activeTab === 'relatorios' && (
            <div className="space-y-6">
              {/* EXPORT OPTIONS BOX */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Extrair Relatórios para Direção</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Baixe em planilhas Excel (.xlsx) completas ou imprima/gere cópias em PDF bem estruturadas.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5 items-center">
                  <button
                    onClick={exportToExcelSheet}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs leading-none transition shadow-xs cursor-pointer"
                  >
                    <FileSpreadsheet size={16} />
                    Exportar Excel (.xlsx)
                  </button>

                  <button
                    onClick={triggerPdfPrint}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs leading-none transition shadow-xs cursor-pointer"
                  >
                    <Printer size={16} />
                    Exportar PDF / Imprimir
                  </button>
                </div>
              </div>

              {/* REPORT TABLES & GRAPH SUMMARIES */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                {/* Spends by Category (Relatório por categoria) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Relatório por Categoria de Despesa</h4>
                  
                  <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1">
                    {categoryPieData.map((item) => (
                      <div key={item.name} className="flex justify-between items-center py-3 text-xs">
                        <div>
                          <p className="font-bold text-slate-850">{item.name}</p>
                          <span className={`text-[9px] px-1 bg-slate-100 text-slate-500 rounded uppercase font-semibold`}>{item.type}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900">
                            R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {Math.round((item.value / (expenseMetrics.totalPagar || 1)) * 100)}% do orçamento
                          </p>
                        </div>
                      </div>
                    ))}
                    {categoryPieData.length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-xs">Sem despesas registradas</div>
                    )}
                  </div>
                </div>

                {/* Spends by Provider (Relatório por fornecedor) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Relatório por Fornecedor (Top Spends)</h4>
                  
                  <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1">
                    {useMemo(() => {
                      const dataMap: { [key: string]: number } = {};
                      filteredExpensesList.forEach(e => {
                        dataMap[e.fornecedor] = (dataMap[e.fornecedor] || 0) + e.valor;
                      });
                      return Object.keys(dataMap).map(pName => ({
                        name: pName,
                        value: dataMap[pName]
                      })).sort((a, b) => b.value - a.value);
                    }, [filteredExpensesList]).map((item) => (
                      <div key={item.name} className="flex justify-between items-center py-3 text-xs">
                        <span className="font-bold text-slate-800">{item.name}</span>
                        <div className="text-right font-semibold">
                          <p className="font-bold text-slate-950">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          <p className="text-[10px] text-slate-400 font-medium">Contas enviadas no período</p>
                        </div>
                      </div>
                    ))}
                    {filteredExpensesList.length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-xs">Sem despesas registradas</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'faturamento' && (
            <FinanceiroFiscalArea user={user} />
          )}

          {activeTab === 'contratos' && (
            <FinanceiroContratosRecorrentes user={user} />
          )}
        </>
      )}

      {/* NEW/EDIT EXPENSE DIALOG DRAWER (Cadastrar / Editar Lançamento) */}
      {isNewExpenseOpen && (
        <div className="fixed inset-0 z-[110] flex justify-end">
          {/* Black blur overlay */}
          <div 
            onClick={() => { setIsNewExpenseOpen(false); resetExpenseForm(); }}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
          />

          {/* Form container slide out panel */}
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  {editingExpense ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5uppercase">Módulo de Despesas Contas a Pagar</p>
              </div>
              <button 
                onClick={() => { setIsNewExpenseOpen(false); resetExpenseForm(); }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 flex-1">
              {/* Descrição */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Descrição do Lançamento *</label>
                <input
                  type="text"
                  placeholder="Ex: Pagamento aluguel matriz"
                  required
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-hidden"
                />
              </div>

              {/* Fornecedor */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Fornecedor / Credor *</label>
                <input
                  type="text"
                  placeholder="Ex: Imobiliária Alvorada"
                  required
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-hidden"
                />
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Categoria de Custo *</label>
                <select
                  value={categoria}
                  onChange={(e) => handleCategorySelection(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg bg-slate-50 focus:ring-1 focus:ring-blue-500 outline-hidden"
                >
                  <optgroup label="Despesas Fixas">
                    {CATEGOR_FIXAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                  <optgroup label="Despesas Variáveis">
                    {CATEGOR_VARIAVEIS.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                </select>
                <p className="text-[10px] italic text-slate-400 mt-1 uppercase font-bold tracking-wider">
                  Mapeado como: <b className="text-slate-600">{categoryType === 'fixa' ? 'Fixa' : 'Variável'}</b>
                </p>
              </div>

              {categoryType === 'fixa' && (
                <div className="flex items-center gap-2 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 animate-in fade-in duration-300">
                  <input
                    id="recorrente-sem-vencimento-chk"
                    type="checkbox"
                    checked={recorrenteSemVencimento}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setRecorrenteSemVencimento(isChecked);
                      if (isChecked) {
                        setDataVencimento('');
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 accent-primary cursor-pointer"
                  />
                  <label htmlFor="recorrente-sem-vencimento-chk" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    Despesa recorrente sem vencimento (recorrência contínua)
                  </label>
                </div>
              )}

              {/* Row for Amount and Due date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Valor (R$) *</label>
                  <CurrencyInput
                    value={valor}
                    onChange={(val) => setValor(val)}
                    placeholder="R$ 0,00"
                    required
                    className="w-full p-2.5 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wide mb-1 ${categoryType === 'fixa' && recorrenteSemVencimento ? 'text-slate-400' : 'text-slate-500'}`}>
                    Vencimento {categoryType === 'fixa' && recorrenteSemVencimento ? '(Automático)' : '*'}
                  </label>
                  <input
                    type="date"
                    required={!(categoryType === 'fixa' && recorrenteSemVencimento)}
                    disabled={categoryType === 'fixa' && recorrenteSemVencimento}
                    value={categoryType === 'fixa' && recorrenteSemVencimento ? '' : dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Payment details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Status Lançamento</label>
                  <select
                    value={statusVal}
                    onChange={(e) => {
                      const selected = e.target.value as any;
                      setStatusVal(selected);
                      if (selected === 'Pago' && !dataPagamento) {
                        setDataPagamento(nowStr);
                      } else if (selected !== 'Pago') {
                        setDataPagamento('');
                      }
                    }}
                    className="w-full p-2.5 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg bg-slate-50 focus:ring-1 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Pago">Pago</option>
                    <option value="Vencido">Vencido</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Pago em (Data)</label>
                  <input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => {
                      setDataPagamento(e.target.value);
                      if (e.target.value) {
                        setStatusVal('Pago');
                      }
                    }}
                    className="w-full p-2.5 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Comentários / Observações */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Observações / Detalhes</label>
                <textarea
                  placeholder="Informações adicionais do lançamento..."
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-hidden resize-none"
                />
              </div>

              {/* COMPROVANTE EXPENDITURE ATTACHMENT */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Comprovante em Anexo</label>
                
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 p-4 rounded-xl text-center cursor-pointer bg-slate-50 hover:bg-slate-100/50 transition-colors"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelection}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  />
                  
                  {isUploading ? (
                    <div className="flex flex-col items-center justify-center py-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase">Carregando...</p>
                    </div>
                  ) : attachedFile ? (
                    <div className="flex items-center gap-2 justify-center text-xs text-slate-800">
                      <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                      <div className="text-left overflow-hidden">
                        <p className="font-bold truncate max-w-[170px] text-slate-900">{attachedFile.name}</p>
                        <p className="text-[9px] text-slate-400">{(attachedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAttachedFile(null); }}
                        className="p-1 hover:bg-slate-200 text-red-500 rounded ml-2"
                        title="Remover anexo"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <Upload size={18} className="text-slate-400 mb-1" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Arraste ou clique para anexar</p>
                      <p className="text-[9px] text-slate-400">Imagens ou PDFs correspondentes ao recibo.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-4 border-t flex gap-2">
                <button
                  type="button"
                  onClick={() => { setIsNewExpenseOpen(false); resetExpenseForm(); }}
                  className="flex-1 py-2.5 text-xs font-bold uppercase border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-black uppercase text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm cursor-pointer"
                >
                  {editingExpense ? 'Gravar Alterações' : 'Salvar despesa'}
                </button>
              </div>

              {/* Audit Trails log summary in Edit mode */}
              {editingExpense?.history && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2.5">Histórico do Lançamento</h4>
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                    {editingExpense.history.slice().reverse().map((log, index) => (
                      <div key={index} className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] leading-relaxed">
                        <span className="font-bold text-slate-800 uppercase">{log.userName}</span>: {log.details || log.action}
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{new Date(log.timestamp).toLocaleString('pt-BR')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
