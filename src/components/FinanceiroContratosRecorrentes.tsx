import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Briefcase, Plus, Search, CheckCircle, XCircle, AlertCircle, 
  RefreshCw, DollarSign, Clock, HelpCircle, ArrowUpRight, ShieldCheck, 
  ChevronRight, Calendar, Edit2, Trash2, Sliders, CheckSquare, Square,
  Building2, Percent, Users, AlertTriangle, FileCheck, X
} from 'lucide-react';
import { databaseService } from '../services/databaseService';
import { Cliente, ContratoRecorrente, Unidade, Usuario, NotaFiscalServico, BoletoBancario, ContratoItem } from '../types';
import { toast } from 'react-hot-toast';
import { db } from '../firebase';
import { collection, getDocs, addDoc } from '../services/resilientFirestoreClient';
import { CurrencyInput } from './CurrencyInput';
import { formatToBRL, formatNumberBR } from '../utils/currency';

interface FinanceiroContratosRecorrentesProps {
  user: Usuario;
}

export default function FinanceiroContratosRecorrentes({ user }: FinanceiroContratosRecorrentesProps) {
  // Lists state
  const [contratos, setContratos] = useState<ContratoRecorrente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'Ativo' | 'Vencendo' | 'Vencido' | 'Suspenso' | 'Encerrado'>('todos');
  const [subTab, setSubTab] = useState<'painel' | 'faturar'>('painel');

  // Form states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContratoRecorrente | null>(null);
  
  const [form, setForm] = useState({
    clienteId: '',
    clienteNome: '',
    unidadeId: '',
    unidadeNome: '',
    numeroContrato: '',
    descricaoServico: 'SERVIÇOS RECORRENTES DE ASSISTÊNCIA TÉCNICA E SUPORTE DE TI.',
    valorMensal: 0,
    dataInicio: new Date().toISOString().split('T')[0],
    dataTermino: '',
    diaFaturamento: 5,
    diaVencimento: 15,
    tipoCobranca: 'Mensal' as 'Mensal' | 'Bimestral' | 'Trimestral' | 'Semestral' | 'Anual',
    status: 'Ativo' as 'Ativo' | 'Vencendo' | 'Vencido' | 'Suspenso' | 'Encerrado',
    observacoes: '',
    tipoContrato: 'Suporte técnico' as 'Suporte técnico' | 'Manutenção preventiva' | 'Locação de equipamentos' | 'Software' | 'Sistema de ponto' | 'Controle de acesso' | 'Outros',
    reajusteAnual: false,
    indiceReajuste: 'IGPM' as string,
    itens: [] as ContratoItem[]
  });

  // Toggle to synchronize contract monthly total with the sum of its items
  const [syncValueWithItens, setSyncValueWithItens] = useState(true);

  // Temporary state for contract sub-items form
  const [itemForm, setItemForm] = useState({
    tipoItem: 'Equipamento' as 'Equipamento' | 'Software' | 'Serviço',
    modelo: '',
    marca: '',
    numeroSerie: '',
    quantidade: 1,
    localId: '',
    localNome: '',
    valorIndividual: 0,
    observacoes: ''
  });

  // Multi-select for Invoice batching
  const [selectedContractIds, setSelectedContractIds] = useState<string[]>([]);
  const [isBillingProgress, setIsBillingProgress] = useState(false);

  // User privileges
  const isAdmin = user?.role === 'admin' || user?.roles?.includes('admin');
  const isFinanceiro = user?.role === 'financeiro' || user?.roles?.includes('financeiro');
  const canSeeValues = isAdmin || isFinanceiro || user?.permissions?.viewFinanceiro;
  const canManage = isAdmin; // Only administrators can create, edit, delete or bill contracts
  const canBill = isAdmin;

  // Get current Period (YYYY-MM)
  const currentPeriod = useMemo(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  }, []);

  const getMonthName = (periodStr: string) => {
    const [year, month] = periodStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  };

  // Pre-load accounts data
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const cls = await databaseService.getClientes();
      setClientes(cls || []);

      const snap = await getDocs(collection(db, 'contratos'));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContratoRecorrente));
      setContratos(list);
    } catch (err: any) {
      console.error('Error fetching contracts data:', err);
      toast.error('Erro ao carregar dados dos contratos recorrentes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch Units whenever cliente changes
  useEffect(() => {
    if (!form.clienteId) {
      setUnidades([]);
      return;
    }
    const fetchUnits = async () => {
      try {
        const res = await databaseService.getUnidades(form.clienteId);
        setUnidades(res || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUnits();
  }, [form.clienteId]);

  // Update clientNome in form when selecting customer
  const handleClientSelect = (cid: string) => {
    const target = clientes.find(c => c.id === cid);
    if (target) {
      setForm(prev => ({
        ...prev,
        clienteId: cid,
        clienteNome: target.razaoSocial || target.nomeFantasia || ''
      }));
    }
  };

  // Update unitNome in form when selecting unit
  const handleUnitSelect = (uid: string) => {
    const target = unidades.find(u => u.id === uid);
    if (target) {
      setForm(prev => ({
        ...prev,
        unidadeId: uid,
        unidadeNome: target.nome || ''
      }));
    } else {
      setForm(prev => ({ ...prev, unidadeId: '', unidadeNome: '' }));
    }
  };

  // Dashboard calculations
  const stats = useMemo(() => {
    const activeConts = contratos.filter(c => c.status === 'Ativo');
    const vencendoConts = contratos.filter(c => c.status === 'Vencendo');
    const suspendedConts = contratos.filter(c => c.status === 'Suspenso');
    const vencidoConts = contratos.filter(c => c.status === 'Vencido');
    const encerradoConts = contratos.filter(c => c.status === 'Encerrado');

    const totalActiveCount = activeConts.length + vencendoConts.length;
    
    // MRR is calculated from all active and expiring contracts
    const mrr = [...activeConts, ...vencendoConts].reduce((acc, c) => acc + (c.valorMensal || 0), 0);
    const arr = mrr * 12;

    // Billing Status in current YYYY-MM
    let billedThisMonthValue = 0;
    let billedThisMonthCount = 0;
    let pendingThisMonthValue = 0;
    let pendingThisMonthCount = 0;

    // Only invoice active/vencendo contracts
    const invoiceableConts = contratos.filter(c => c.status === 'Ativo' || c.status === 'Vencendo');

    invoiceableConts.forEach(c => {
      const alreadyBilled = c.faturamentosGerados?.includes(currentPeriod);
      if (alreadyBilled) {
        billedThisMonthValue += c.valorMensal;
        billedThisMonthCount += 1;
      } else {
        pendingThisMonthValue += c.valorMensal;
        pendingThisMonthCount += 1;
      }
    });

    // Calc expiring contracts in next 30 days
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const expiringCount = contratos.filter(c => {
      if (c.status === 'Vencendo') return true;
      if (c.status !== 'Ativo') return false;
      if (!c.dataTermino) return false;
      const endD = new Date(c.dataTermino);
      return endD >= today && endD <= thirtyDaysFromNow;
    }).length;

    const expiredCount = contratos.filter(c => {
      if (c.status === 'Vencido') return true;
      if (c.status !== 'Ativo' && c.status !== 'Vencendo') return false;
      if (!c.dataTermino) return false;
      const endD = new Date(c.dataTermino);
      return endD < today;
    }).length;

    return {
      activeCount: totalActiveCount,
      suspendedCount: suspendedConts.length,
      vencendoCount: expiringCount,
      vencidoCount: expiredCount,
      mrr,
      arr,
      billedValue: billedThisMonthValue,
      billedCount: billedThisMonthCount,
      pendingValue: pendingThisMonthValue,
      pendingCount: pendingThisMonthCount
    };
  }, [contratos, currentPeriod]);

  // Filters logic with Client portal restriction
  const filteredContracts = useMemo(() => {
    return contratos.filter(c => {
      // Security: if user is role 'cliente', show only their contracts
      if (user?.role === 'cliente' && user?.clienteId && c.clienteId !== user.clienteId) {
        return false;
      }

      const matchSearch = 
        c.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.numeroContrato.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.descricaoServico && c.descricaoServico.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchStatus = statusFilter === 'todos' || c.status === statusFilter;
      
      return matchSearch && matchStatus;
    });
  }, [contratos, searchTerm, statusFilter, user]);

  // Contracts pending invoicing (Active/Vencendo & Not billed this month & user has permission)
  const pendingInvoicingList = useMemo(() => {
    if (user?.role === 'cliente') return [];
    
    return contratos.filter(c => {
      if (c.status !== 'Ativo' && c.status !== 'Vencendo') return false;
      const alreadyBilled = c.faturamentosGerados?.includes(currentPeriod);
      return !alreadyBilled;
    });
  }, [contratos, currentPeriod, user]);

  // Open New Contract Drawer
  const openNewContractDrawer = () => {
    setEditingContract(null);
    setForm({
      clienteId: '',
      clienteNome: '',
      unidadeId: '',
      unidadeNome: '',
      numeroContrato: `CTR-${Math.floor(Math.random() * 9000) + 1000}`,
      descricaoServico: 'SERVIÇOS RECORRENTES DE ASSISTÊNCIA TÉCNICA E SUPORTE DE TI.',
      valorMensal: 0,
      dataInicio: new Date().toISOString().split('T')[0],
      dataTermino: '',
      diaFaturamento: 5,
      diaVencimento: 15,
      tipoCobranca: 'Mensal',
      status: 'Ativo',
      observacoes: '',
      tipoContrato: 'Suporte técnico',
      reajusteAnual: false,
      indiceReajuste: 'IGPM',
      itens: []
    });
    setSyncValueWithItens(true);
    setIsDrawerOpen(true);
  };

  // Open Edit Contract Drawer
  const openEditContractDrawer = (contract: ContratoRecorrente) => {
    setEditingContract(contract);
    setForm({
      clienteId: contract.clienteId,
      clienteNome: contract.clienteNome,
      unidadeId: contract.unidadeId || '',
      unidadeNome: contract.unidadeNome || '',
      numeroContrato: contract.numeroContrato,
      descricaoServico: contract.descricaoServico,
      valorMensal: contract.valorMensal,
      dataInicio: contract.dataInicio,
      dataTermino: contract.dataTermino || '',
      diaFaturamento: contract.diaFaturamento,
      diaVencimento: contract.diaVencimento,
      tipoCobranca: contract.tipoCobranca,
      status: contract.status,
      observacoes: contract.observacoes || '',
      tipoContrato: contract.tipoContrato || 'Suporte técnico',
      reajusteAnual: contract.reajusteAnual || false,
      indiceReajuste: contract.indiceReajuste || 'IGPM',
      itens: contract.itens || []
    });
    setSyncValueWithItens(false); // Let edits preserve actual set value
    setIsDrawerOpen(true);
  };

  // Add individual commercial contracts sub-items
  const handleAddItem = () => {
    if (!itemForm.modelo.trim()) {
      toast.error('Por favor, informe o modelo / descrição do item comercial.');
      return;
    }
    
    const newItemObj = {
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      tipoItem: itemForm.tipoItem,
      modelo: itemForm.modelo,
      marca: itemForm.marca,
      numeroSerie: itemForm.numeroSerie,
      quantidade: itemForm.quantidade,
      localId: itemForm.localId,
      localNome: itemForm.localNome,
      valorIndividual: itemForm.valorIndividual,
      observacoes: itemForm.observacoes
    };

    const updatedItens = [...form.itens, newItemObj];
    
    // Auto-compute contract value if synchronization is toggled active
    const computedValorMensal = syncValueWithItens
      ? updatedItens.reduce((sum, item) => sum + (item.valorIndividual * item.quantidade), 0)
      : form.valorMensal;

    setForm(prev => ({
      ...prev,
      itens: updatedItens,
      valorMensal: computedValorMensal
    }));

    // Reset standard temporary list inputs
    setItemForm({
      tipoItem: 'Equipamento',
      modelo: '',
      marca: '',
      numeroSerie: '',
      quantidade: 1,
      localId: '',
      localNome: '',
      valorIndividual: 0,
      observacoes: ''
    });

    toast.success('Equipamento/Software adicionado.');
  };

  // Remove individual sub-items
  const handleRemoveItem = (itemId: string) => {
    const updatedItens = form.itens.filter(item => item.id !== itemId);
    
    const computedValorMensal = syncValueWithItens
      ? updatedItens.reduce((sum, item) => sum + (item.valorIndividual * item.quantidade), 0)
      : form.valorMensal;

    setForm(prev => ({
      ...prev,
      itens: updatedItens,
      valorMensal: computedValorMensal
    }));

    toast.success('Equipamento/Software removido.');
  };

  // Submit / Save contract
  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast.error('Você não tem permissões administrativas para gerenciar contratos.');
      return;
    }
    if (!form.clienteId || !form.numeroContrato || form.valorMensal <= 0) {
      toast.error('Preencha os campos obrigatórios e garanta um valor positivo.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingContract) {
        // Update
        await databaseService.updateContratoRecorrente(editingContract.id, {
          ...form,
          faturamentosGerados: editingContract.faturamentosGerados || []
        });
        toast.success('Contrato atualizado com sucesso!');
      } else {
        // Create
        await databaseService.createContratoRecorrente({
          ...form,
          faturamentosGerados: []
        });
        toast.success('Contrato cadastrado com sucesso!');
      }
      setIsDrawerOpen(false);
      loadInitialData(); // Refresh list
    } catch (err: any) {
      console.error(err);
      toast.error('Falha ao salvar contrato.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete contract
  const handleDeleteContract = async (id: string) => {
    if (!canManage) {
      toast.error('Permissão negada.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja remover este contrato?')) return;

    try {
      await databaseService.deleteContratoRecorrente(id);
      toast.success('Contrato excluído com sucesso.');
      loadInitialData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir contrato.');
    }
  };

  // Batch Billing Automation Execution (NFS-e & Boleto Generator)
  const handleRunBilling = async (idsToBill: string[]) => {
    if (!canManage) {
      toast.error('Operação de faturamento não permitida para o seu usuário.');
      return;
    }
    if (idsToBill.length === 0) {
      toast.error('Selecione ao menos um contrato pendente.');
      return;
    }

    setIsBillingProgress(true);
    
    // Read bank accounts to issue boletos
    let bankAccounts: any[] = [];
    try {
      bankAccounts = await databaseService.getContasBancarias();
    } catch (err) {
      console.warn('Could not query real bank accounts', err);
    }

    const defaultBank = bankAccounts[0] || {
      id: 'default-bank',
      banco: 'Sicoob',
      conta: '91823-1',
      agencia: '3024',
      jurosPadrao: 1.0,
      multaPadrao: 2.0,
      descontoPadrao: 0
    };

    let processedCount = 0;
    let totalBilledVal = 0;

    for (const contractId of idsToBill) {
      const contract = contratos.find(c => c.id === contractId);
      if (!contract) continue;

      try {
        // PROGRESS PROGRESSIVE NUMBERS
        const nextNfseNumber = String(Math.floor(Math.random() * 900000) + 100000);
        const nextBoletoNum = String(Math.floor(Math.random() * 900000) + 100000);

        // 1. Calculations & Tax parameters simulation (Brazilian Simples Nacional standard)
        const totalVal = contract.valorMensal;
        const issValue = parseFloat((totalVal * 0.02).toFixed(2)); // 2% ISS standard
        
        // 2. Assemble and Create NFS-e
        const nfsePayload: Omit<NotaFiscalServico, 'id' | 'createdAt' | 'updatedAt'> = {
          clienteId: contract.clienteId,
          clienteNome: contract.clienteNome,
          municipioPrestacao: 'Feira de Santana - BA',
          codigoServico: '0101', // Technical consulting services
          descricaoServico: `${contract.descricaoServico} - REFERENTE AO PERÍODO DE ${getMonthName(currentPeriod).toUpperCase()}. CONTRATO NÚMERO: ${contract.numeroContrato}`,
          valorServico: totalVal,
          iss: 2,
          issRetido: false,
          retencoes: {
            pis: 0,
            cofins: 0,
            csll: 0,
            irrf: 0,
            totalRetido: 0
          },
          dataCompetencia: new Date().toISOString().split('T')[0],
          observacoes: `Faturamento recorrente mensal automático do contrato comercial nº ${contract.numeroContrato}.`,
          status: 'Autorizada',
          numeroNota: nextNfseNumber,
          codigoVerificacao: Math.random().toString(36).substring(2, 10).toUpperCase(),
          dataEmissao: new Date().toISOString().split('T')[0],
          xmlOriginal: `<?xml version="1.0" encoding="UTF-8"?><Nfse><InfNfse><Numero>${nextNfseNumber}</Numero><CodigoVerificacao>NFSE-${nextNfseNumber}</CodigoVerificacao><DataEmissao>${new Date().toISOString()}</DataEmissao><Valores><ValorServicos>${totalVal}</ValorServicos></Valores></InfNfse></Nfse>`,
          pdfUrl: `https://mundotech.srv.br/nota-fiscal/pdf/${contract.id}`,
          contratoId: contract.id
        };

        const nfseResult = await databaseService.createNotaFiscalServico(nfsePayload);

        // 3. Assemble and Create Boleto
        const boletoPayload: Omit<BoletoBancario, 'id' | 'createdAt' | 'updatedAt'> = {
          clienteId: contract.clienteId,
          clienteNome: contract.clienteNome,
          bancoId: defaultBank.id,
          bancoNome: defaultBank.banco,
          nossoNumero: nextBoletoNum,
          valorOriginal: totalVal,
          valorCobrado: totalVal,
          vencimento: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days from now
          dataDocumento: new Date().toISOString().split('T')[0],
          documentoOrigemId: nfseResult.id,
          documentoOrigemTipo: 'Servico',
          juros: defaultBank.jurosPadrao || 1,
          multa: defaultBank.multaPadrao || 2,
          desconto: defaultBank.descontoPadrao || 0,
          status: 'Pendente',
          pdfSimuladoUrl: `https://mockup-bank.io/invoice/render/${nextBoletoNum}`
        };

        const boletoResult = await databaseService.createBoletoBancario(boletoPayload);

        // Link Boleto back inside NFS-e
        await databaseService.updateNotaFiscalServico(nfseResult.id, { boletoCriadoId: boletoResult.id });

        // 3b. Create Accounts Receivable record in contasReceber collection
        await addDoc(collection(db, 'contasReceber'), {
          clienteId: contract.clienteId,
          clienteNome: contract.clienteNome,
          contratoId: contract.id,
          contratoNumero: contract.numeroContrato,
          valor: totalVal,
          boletoCriadoId: boletoResult.id,
          notaFiscalCriadaId: nfseResult.id,
          pdfNotaUrl: nfsePayload.pdfUrl,
          xmlNotaOriginal: nfsePayload.xmlOriginal,
          numeroNota: nextNfseNumber,
          nossoNumeroBoleto: nextBoletoNum,
          dataGeracao: new Date().toISOString().split('T')[0],
          dataVencimento: boletoPayload.vencimento,
          status: 'Pendente',
          faturamentoPeriodo: currentPeriod,
          createdAt: new Date().toISOString(),
          observacoes: `Contas a Receber gerado pelo faturamento do Contrato nº ${contract.numeroContrato} - Período: ${getMonthName(currentPeriod)}`
        });

        // 4. Update parent Contract recorrente's faturamentosGerados list
        const updatedFaturamentosArray = [...(contract.faturamentosGerados || []), currentPeriod];
        await databaseService.updateContratoRecorrente(contract.id, {
          faturamentosGerados: updatedFaturamentosArray
        });

        // 5. Register Log
        await databaseService.createFiscalAuditLog({
          userId: user.id || 'system',
          userName: user.nome || 'Sistema',
          action: 'emissao_nfse',
          details: `Faturamento recorrente do contrato nº ${contract.numeroContrato}. NFS-e nº ${nextNfseNumber} e Boleto nº ${nextBoletoNum} emitidos. Cliente: ${contract.clienteNome}. Valor: ${formatToBRL(totalVal)}`,
          tipoDocumento: 'nfse',
          documentNumero: nextNfseNumber
        });

        processedCount += 1;
        totalBilledVal += totalVal;
      } catch (err) {
        console.error(`Error billing contract ${contract.id}:`, err);
      }
    }

    toast.success(`Sucesso! ${processedCount} contratos faturados. Total: R$ ${totalBilledVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    setSelectedContractIds([]);
    setIsBillingProgress(false);
    loadInitialData(); // Refresh lists and calculations
  };

  const toggleSelectContract = (cid: string) => {
    setSelectedContractIds(prev => 
      prev.includes(cid) ? prev.filter(id => id !== cid) : [...prev, cid]
    );
  };

  const handleSelectAll = () => {
    if (selectedContractIds.length === pendingInvoicingList.length) {
      setSelectedContractIds([]);
    } else {
      setSelectedContractIds(pendingInvoicingList.map(c => c.id));
    }
  };

  const getAlertList = () => {
    const today = new Date();
    const todayDay = today.getDate();

    const notBilledYet = pendingInvoicingList.filter(c => todayDay >= c.diaFaturamento);
    
    // Contracts expiring in next 30 days
    const activeConts = contratos.filter(c => c.status === 'Ativo');
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const expiringSoon = activeConts.filter(c => {
      if (!c.dataTermino) return false;
      const endD = new Date(c.dataTermino);
      return endD >= today && endD <= thirtyDaysFromNow;
    });

    return {
      notBilledYet,
      expiringSoon
    };
  };

  const alerts = getAlertList();

  return (
    <div className="space-y-6">
      {/* SECTION TABS SUBMENU */}
      <div className="flex bg-slate-50 border border-slate-100 p-1.5 rounded-xl gap-1 max-w-md">
        <button
          onClick={() => setSubTab('painel')}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all duration-300 ${
            subTab === 'painel' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Painel & Contratos
        </button>
        <button
          onClick={() => setSubTab('faturar')}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg relative transition-all duration-300 ${
            subTab === 'faturar' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Faturar Contratos
          {pendingInvoicingList.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
              {pendingInvoicingList.length}
            </span>
          )}
        </button>
      </div>

      {/* RECENT ALERTS */}
      {(() => {
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        // Calculate all 4 requested alert categories:
        const activeOrVencendoList = contratos.filter(c => c.status === 'Ativo' || c.status === 'Vencendo');
        
        // 1. Expiring soon or marked as Vencendo
        const expiringSoon = contratos.filter(c => {
          if (c.status === 'Vencendo') return true;
          if (c.status !== 'Ativo') return false;
          if (!c.dataTermino) return false;
          const endD = new Date(c.dataTermino);
          return endD >= today && endD <= thirtyDaysFromNow;
        });

        // 2. Expired
        const expiredList = contratos.filter(c => {
          if (c.status === 'Vencido') return true;
          if (c.status !== 'Ativo' && c.status !== 'Vencendo') return false;
          if (!c.dataTermino) return false;
          const endD = new Date(c.dataTermino);
          return endD < today;
        });

        // 3. Active without expiry validity date
        const noExpiryList = activeOrVencendoList.filter(c => !c.dataTermino);

        // 4. Suspended
        const suspendedList = contratos.filter(c => c.status === 'Suspenso');

        // Check if we have any alerts to present
        const hasAlerts = expiringSoon.length > 0 || expiredList.length > 0 || noExpiryList.length > 0 || suspendedList.length > 0 || alerts.notBilledYet.length > 0;

        if (!hasAlerts) return null;

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* COLUMN 1: EXPIRING & OVERDUE */}
            <div className="space-y-3">
              {expiredList.length > 0 && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 p-4 rounded-2xl text-red-950 animate-in fade-in duration-300">
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-red-900">Alerta de Validade: Contratos Vencidos ({expiredList.length})</p>
                    <div className="text-[11px] text-red-700 font-medium mt-1">
                      Os seguintes contratos já atingiram a data de término e requerem renovação ou aditivo:
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                        {expiredList.map(c => (
                          <li key={c.id}>
                            <b>{c.clienteNome}</b> (nº {c.numeroContrato}) — Expirou em {c.dataTermino ? c.dataTermino.split('-').reverse().join('/') : 'Sem Data'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {expiringSoon.length > 0 && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-950 animate-in fade-in duration-300">
                  <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-900">Atenção: Contratos Vencendo em 30 Dias ({expiringSoon.length})</p>
                    <div className="text-[11px] text-amber-700 font-medium mt-1">
                      Contratos próximos do vencimento:
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                        {expiringSoon.map(c => (
                          <li key={c.id}>
                            <b>{c.clienteNome}</b> (nº {c.numeroContrato}) — Expira em {c.dataTermino ? c.dataTermino.split('-').reverse().join('/') : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* COLUMN 2: UNDEFINED VALIDITIES & SUSPENDED DATA */}
            <div className="space-y-3">
              {noExpiryList.length > 0 && (
                <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl text-slate-950 animate-in fade-in duration-300">
                  <Clock className="text-slate-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Controle: Contratos sem Data de Validade ({noExpiryList.length})</p>
                    <div className="text-[11px] text-slate-600 font-medium mt-1">
                      Contratos recorrentes ativos sem uma data limite registrada (vigência indeterminada):
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                        {noExpiryList.map(c => (
                          <li key={c.id}>
                            <b>{c.clienteNome}</b> (nº {c.numeroContrato}) — Tipo: {c.tipoContrato || 'Outros'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {suspendedList.length > 0 && (
                <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 p-4 rounded-2xl text-orange-950 animate-in fade-in duration-300">
                  <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-900">Aviso: Contratos Suspensos ({suspendedList.length})</p>
                    <div className="text-[11px] text-orange-700 font-medium mt-1">
                      Contratos que estão suspensos temporariamente e não devem ser faturados:
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                        {suspendedList.map(c => (
                          <li key={c.id}>
                            <b>{c.clienteNome}</b> (nº {c.numeroContrato}) — Desativado temporariamente
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {alerts.notBilledYet.length > 0 && (
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 p-4 rounded-2xl text-blue-950 animate-in fade-in duration-300">
                  <Calendar className="text-blue-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-900">Faturamento Pendente no Mês ({alerts.notBilledYet.length})</p>
                    <p className="text-[11px] text-blue-600 font-medium mt-1">
                      Contratos cuja data de faturamento passou e estão pendentes de envio de NFS-e no período.
                    </p>
                    <button 
                      onClick={() => setSubTab('faturar')} 
                      className="text-[10px] font-bold text-blue-700 hover:underline mt-1 flex items-center gap-1 cursor-pointer"
                    >
                      Executar Faturamento Pendente <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* STATS DECK - 6 CORE KPI METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Metric 1: Active Accounts */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-3.5 shadow-xs">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Briefcase size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contratos Ativos</p>
            <p className="text-xl font-bold text-slate-800">{stats.activeCount}</p>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Em vigor</span>
          </div>
        </div>

        {/* Metric 2: MRR */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-3.5 shadow-xs">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">MRR (Faturamento)</p>
            <p className="text-xl font-bold text-slate-800">
              {canSeeValues ? `R$ ${stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ •••••'}
            </p>
            <span className="text-[10px] text-emerald-600 font-semibold uppercase">
              {canSeeValues ? `Anual: R$ ${stats.arr.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}` : 'Anual: R$ ••••'}
            </span>
          </div>
        </div>

        {/* Metric 3: Billed */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-3.5 shadow-xs">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Faturado no Mês</p>
            <p className="text-xl font-bold text-slate-800">
              {canSeeValues ? `R$ ${stats.billedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ •••••'}
            </p>
            <span className="text-[10px] text-sky-600 font-medium uppercase">{stats.billedCount} faturados</span>
          </div>
        </div>

        {/* Metric 4: Pending */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-3.5 shadow-xs">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pendente no Mês</p>
            <p className="text-xl font-bold text-slate-800">
              {canSeeValues ? `R$ ${stats.pendingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ •••••'}
            </p>
            <span className="text-[10px] text-amber-600 font-medium uppercase">{stats.pendingCount} pendentes</span>
          </div>
        </div>

        {/* Metric 5: Expiring Soon */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-3.5 shadow-xs">
          <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Vencendo (30d)</p>
            <p className="text-xl font-bold text-slate-800">{stats.vencendoCount}</p>
            <span className="text-[10px] text-yellow-600 font-medium uppercase">Requer atenção</span>
          </div>
        </div>

        {/* Metric 6: Expired Total */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-3.5 shadow-xs">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Vencidos</p>
            <p className="text-xl font-bold text-slate-800">{stats.vencidoCount}</p>
            <span className="text-[10px] text-red-600 font-semibold uppercase">Expirados</span>
          </div>
        </div>
      </div>

      {subTab === 'painel' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          {/* HEADER ACTIONS */}
          <div className="p-5 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center border-b border-slate-100">
            <div className="flex-1 max-w-sm relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Filtrar por cliente, contrato ou descrição..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl text-slate-600 focus:outline-none bg-white cursor-pointer"
              >
                <option value="todos">Todos os Status</option>
                <option value="Ativo">Ativo</option>
                <option value="Vencendo">Vencendo</option>
                <option value="Vencido">Vencido</option>
                <option value="Suspenso">Suspenso</option>
                <option value="Encerrado">Encerrado</option>
              </select>

              {canManage && (
                <button
                  onClick={openNewContractDrawer}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-cyan cursor-pointer"
                >
                  <Plus size={15} />
                  Novo Contrato
                </button>
              )}
            </div>
          </div>

          {/* LIST TABLE CONTAINER */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100">
                  <th className="py-3.5 px-5">Contrato / Cliente</th>
                  <th className="py-3.5 px-5">Serviço Comercial</th>
                  <th className="py-3.5 px-5">Valor Mensal</th>
                  <th className="py-3.5 px-5">Regras de Cobrança</th>
                  <th className="py-3.5 px-5">Vigência</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredContracts.map(c => {
                  const isBilledThisMonth = c.faturamentosGerados?.includes(currentPeriod);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{c.numeroContrato}</span>
                          {c.tipoContrato && (
                            <span className="inline-block text-[9px] font-bold tracking-tight bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">
                              {c.tipoContrato}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">{c.clienteNome}</div>
                        {c.unidadeNome && (
                          <span className="inline-block mt-1 text-[9px] font-semibold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                            {c.unidadeNome}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 max-w-xs truncate">
                        <div className="text-slate-700 font-medium truncate" title={c.descricaoServico}>
                          {c.descricaoServico}
                        </div>
                        {c.observacoes && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">{c.observacoes}</div>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900">
                          {canSeeValues ? `R$ ${c.valorMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ •••••'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium lowercase">({c.tipoCobranca})</div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-xs text-slate-700">
                          Dia faturamento: <b>{String(c.diaFaturamento).padStart(2, '0')}</b>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Dia vencimento: {String(c.diaVencimento).padStart(2, '0')}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-slate-600 font-medium">
                          {c.dataInicio.split('-').reverse().join('/')}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Até {c.dataTermino ? c.dataTermino.split('-').reverse().join('/') : 'Indeterminado'}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col gap-1.5">
                          <span className={`inline-flex self-start px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                            c.status === 'Ativo' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : c.status === 'Vencendo'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : c.status === 'Vencido'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : c.status === 'Suspenso'
                              ? 'bg-orange-50 text-orange-600 border border-orange-200'
                            : 'bg-slate-50 text-slate-700 border border-slate-200'
                          }`}>
                            {c.status}
                          </span>
 
                          <span className={`inline-flex self-start items-center gap-1 text-[9px] font-semibold bg-white border px-1.5 py-0.5 rounded ${
                            isBilledThisMonth 
                              ? 'text-sky-600 border-sky-100' 
                              : 'text-amber-500 border-amber-100'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isBilledThisMonth ? 'bg-sky-500' : 'bg-amber-500'}`} />
                            {isBilledThisMonth ? 'Faturado neste Mês' : 'Aguardando Faturamento'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManage ? (
                            <>
                              <button
                                onClick={() => openEditContractDrawer(c)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-all animate-none"
                                title="Editar Contrato"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteContract(c.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-all"
                                title="Excluir Contrato"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-1 py-0.5 rounded">
                              VISUALIZAÇÃO
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredContracts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      Nenhum contrato recorrente encontrado para os filtros ativos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABS 2: FATURAR CONTRATOS (Specific Invoice Queue screen) */}
      {subTab === 'faturar' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Faturamento Automatizado de Contratos</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Selecione os contratos pendentes abaixo para emitir as NFS-e de prestação de serviços de forma simultânea e enviar os boletos bancários ao e-mail dos clientes.
                </p>
              </div>
              <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 flex items-center gap-3">
                <Calendar className="text-blue-600 shrink-0" size={16} />
                <span className="text-xs font-bold text-slate-600 uppercase">
                  Período Atual: <b className="text-blue-600 font-extrabold">{getMonthName(currentPeriod).toUpperCase()}</b>
                </span>
              </div>
            </div>

            {/* BATCH ACTION CONTROLS */}
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center p-4 bg-blue-50/50 hover:bg-blue-50/70 border border-blue-100 rounded-2xl gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  disabled={pendingInvoicingList.length === 0}
                  className="p-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-slate-600 disabled:opacity-50 cursor-pointer"
                  title={selectedContractIds.length === pendingInvoicingList.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                >
                  {selectedContractIds.length === pendingInvoicingList.length && pendingInvoicingList.length > 0 ? (
                    <CheckSquare size={16} className="text-blue-600" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
                <div>
                  <span className="text-xs text-slate-600 font-semibold block uppercase">
                    Selecionados: <b>{selectedContractIds.length}</b> de <b>{pendingInvoicingList.length}</b> pendentes
                  </span>
                  <span className="text-xs text-blue-800 font-extrabold uppercase mt-0.5 block">
                    Valor total de envio: R$ {
                      pendingInvoicingList
                        .filter(c => selectedContractIds.includes(c.id))
                        .reduce((acc, c) => acc + c.valorMensal, 0)
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    }
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRunBilling(selectedContractIds)}
                  disabled={selectedContractIds.length === 0 || isBillingProgress}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isBillingProgress ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <FileCheck size={14} />
                  )}
                  Faturar Selecionados
                </button>
                <button
                  onClick={() => {
                    const allIds = pendingInvoicingList.map(c => c.id);
                    handleRunBilling(allIds);
                  }}
                  disabled={pendingInvoicingList.length === 0 || isBillingProgress}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  Faturar Todos os {pendingInvoicingList.length}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100">
                    <th className="py-3 px-5 w-12 text-center">Selecionar</th>
                    <th className="py-3 px-5">Contrato / Cliente</th>
                    <th className="py-3 px-5">Serviço de Faturamento</th>
                    <th className="py-3 px-5">Valor Contract</th>
                    <th className="py-3 px-5">Cronograma</th>
                    <th className="py-3 px-5">Status Mês</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {pendingInvoicingList.map(c => {
                    const isSelected = selectedContractIds.includes(c.id);
                    const today = new Date();
                    const billingCompletedDay = today.getDate() >= c.diaFaturamento;

                    return (
                      <tr 
                        key={c.id} 
                        onClick={() => toggleSelectContract(c.id)}
                        className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/20' : ''
                        }`}
                      >
                        <td className="py-3.5 px-5 text-center">
                          <button 
                            type="button"
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-blue-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-slate-800">{c.numeroContrato}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{c.clienteNome}</div>
                        </td>
                        <td className="py-3.5 px-5 max-w-xs truncate font-medium text-slate-600">
                          {c.descricaoServico}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          R$ {c.valorMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className={`text-[11px] font-semibold ${billingCompletedDay ? 'text-emerald-700' : 'text-slate-500'}`}>
                            Fatura dia {String(c.diaFaturamento).padStart(2, '0')}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            Vencimento dia {String(c.diaVencimento).padStart(2, '0')}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold border px-2 py-0.5 rounded-full ${
                            billingCompletedDay 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : 'bg-slate-50 text-slate-500 border-slate-100'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${billingCompletedDay ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`} />
                            {billingCompletedDay ? 'Pronto para Fatura' : 'Aguardando Período'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {pendingInvoicingList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                        Não existem contratos com cobrança pendente para o mês de {getMonthName(currentPeriod)}. Todos faturados com satisfação!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER FOR CREATING/EDITING CONTRACTS */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[110] flex justify-end">
          {/* Black blur overlay */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
          />

          {/* Form container slide out panel */}
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  {editingContract ? 'Editar Contrato Recorrente' : 'Novo Contrato Recorrente'}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Módulo de Faturamento e MRR</p>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="space-y-4 flex-1">
              {/* Cliente search select */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Cliente Especial *</label>
                <select
                  value={form.clienteId}
                  onChange={e => handleClientSelect(e.target.value)}
                  disabled={!!editingContract} // Cannot change customer of existing contract for safety
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                  required
                >
                  <option value="">Selecione o Cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.razaoSocial || c.nomeFantasia || (c as any).nome || 'Cliente sem nome'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unidade list based on customer selection */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Unidade do Contrato</label>
                <select
                  value={form.unidadeId}
                  onChange={e => handleUnitSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">Todas Unidades (Sede Principal)</option>
                  {unidades.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nome} ({u.cidade} - {u.estado})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Contrato selection */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Tipo de Contrato *</label>
                <select
                  value={form.tipoContrato || ''}
                  onChange={e => setForm(prev => ({ ...prev, tipoContrato: e.target.value as any }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                  required
                >
                  <option value="">Selecione o Tipo de Contrato...</option>
                  <option value="Suporte técnico">Suporte técnico</option>
                  <option value="Manutenção preventiva">Manutenção preventiva</option>
                  <option value="Locação de equipamentos">Locação de equipamentos</option>
                  <option value="Software">Software</option>
                  <option value="Sistema de ponto">Sistema de ponto</option>
                  <option value="Controle de acesso">Controle de acesso</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              {/* Contrato Number */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Número do Contrato *</label>
                <input
                  type="text"
                  value={form.numeroContrato}
                  onChange={e => setForm(prev => ({ ...prev, numeroContrato: e.target.value }))}
                  placeholder="EX: SUP-8041"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white font-bold"
                  required
                />
              </div>

              {/* Descricao Servico */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Descrição de Serviços Fiscais *</label>
                <textarea
                  value={form.descricaoServico}
                  onChange={e => setForm(prev => ({ ...prev, descricaoServico: e.target.value }))}
                  placeholder="Serviço técnico para NFS-e..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white h-20 resize-none font-medium text-slate-600"
                  required
                />
              </div>

              {/* Valor mensal */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Valor Mensal Cobrado (R$) *</label>
                <div className="relative">
                  <CurrencyInput
                    value={form.valorMensal || 0}
                    onChange={val => setForm(prev => ({ ...prev, valorMensal: val }))}
                    placeholder="R$ 0,00"
                    disabled={syncValueWithItens && form.itens.length > 0}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white font-bold disabled:bg-slate-50 disabled:text-slate-500"
                    required
                  />
                </div>
                {form.itens.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="sync-toggle"
                      checked={syncValueWithItens}
                      onChange={e => {
                        const nextVal = e.target.checked;
                        setSyncValueWithItens(nextVal);
                        if (nextVal) {
                          const computedSum = form.itens.reduce((sum, item) => sum + (item.valorIndividual * item.quantidade), 0);
                          setForm(prev => ({ ...prev, valorMensal: computedSum }));
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="sync-toggle" className="text-[10px] font-bold text-slate-500 uppercase tracking-tight cursor-pointer">
                      Sincronizar valor com os itens (R$ {form.itens.reduce((sum, item) => sum + (item.valorIndividual * item.quantidade), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                    </label>
                  </div>
                )}
              </div>

              {/* Reajuste Anual & Indice de Reajuste */}
              <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="reajuste-toggle"
                    checked={form.reajusteAnual || false}
                    onChange={e => setForm(prev => ({ ...prev, reajusteAnual: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                  />
                  <label htmlFor="reajuste-toggle" className="text-xs font-bold text-slate-700 cursor-pointer uppercase tracking-tight">
                    Aplicar Reajuste Anual
                  </label>
                </div>
                {form.reajusteAnual && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1">Índice de Reajuste *</label>
                    <select
                      value={form.indiceReajuste || ''}
                      onChange={e => setForm(prev => ({ ...prev, indiceReajuste: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                      required={form.reajusteAnual}
                    >
                      <option value="">Selecione o índice...</option>
                      <option value="IGP-M">IGP-M (FGV)</option>
                      <option value="IPCA">IPCA (IBGE)</option>
                      <option value="IPC">IPC (FIPE)</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Timing Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 font-semibold">Dia de Faturamento *</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={form.diaFaturamento || ''}
                    onChange={e => setForm(prev => ({ ...prev, diaFaturamento: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 font-semibold">Dia de Vencimento *</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={form.diaVencimento || ''}
                    onChange={e => setForm(prev => ({ ...prev, diaVencimento: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                    required
                  />
                </div>
              </div>

              {/* Vigencia Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 font-semibold font-sans">Início Vigência *</label>
                  <input
                    type="date"
                    value={form.dataInicio}
                    onChange={e => setForm(prev => ({ ...prev, dataInicio: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 font-semibold font-sans">Término Vigência</label>
                  <input
                    type="date"
                    value={form.dataTermino}
                    onChange={e => setForm(prev => ({ ...prev, dataTermino: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                  />
                </div>
              </div>

              {/* Cobranca and Status Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 font-semibold">Período Cobrança</label>
                  <select
                    value={form.tipoCobranca}
                    onChange={e => setForm(prev => ({ ...prev, tipoCobranca: e.target.value as any }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Mensal">Mensal</option>
                    <option value="Bimestral">Bimestral</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Semestral">Semestral</option>
                    <option value="Anual">Anual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 font-semibold">Status do Contrato</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Vencendo">Vencendo</option>
                    <option value="Vencido">Vencido</option>
                    <option value="Suspenso">Suspenso</option>
                    <option value="Encerrado">Encerrado</option>
                  </select>
                </div>
              </div>

              {/* EQUIPAMENTOS E SOFTWARES VINCULADOS AO CONTRATO */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-700 flex items-center gap-1.5">
                    <Briefcase size={13} className="text-blue-500" />
                    Itens Vinculados ({form.itens?.length || 0})
                  </h4>
                </div>

                {/* Sub-item Form Block */}
                <div className="bg-slate-50 border border-dashed border-slate-200 p-3.5 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Adicionar Equipamento, Software ou Serviço</span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Tipo de Item</label>
                      <select
                        value={itemForm.tipoItem}
                        onChange={e => setItemForm(prev => ({ ...prev, tipoItem: e.target.value as any }))}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="Equipamento">Equipamento</option>
                        <option value="Software">Software</option>
                        <option value="Serviço">Serviço</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Modelo / Descrição *</label>
                      <input
                        type="text"
                        value={itemForm.modelo}
                        onChange={e => setItemForm(prev => ({ ...prev, modelo: e.target.value }))}
                        placeholder="EX: Câmera Intelbras 1220 B"
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Marca</label>
                      <input
                        type="text"
                        value={itemForm.marca}
                        onChange={e => setItemForm(prev => ({ ...prev, marca: e.target.value }))}
                        placeholder="Intelbras, Hikvision..."
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Número de Série / Chave</label>
                      <input
                        type="text"
                        value={itemForm.numeroSerie}
                        onChange={e => setItemForm(prev => ({ ...prev, numeroSerie: e.target.value }))}
                        placeholder="Serial, ID de Licença..."
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Quantidade</label>
                      <input
                        type="number"
                        min={1}
                        value={itemForm.quantidade}
                        onChange={e => setItemForm(prev => ({ ...prev, quantidade: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Valor Unitário (R$)</label>
                      <CurrencyInput
                        value={itemForm.valorIndividual || 0}
                        onChange={val => setItemForm(prev => ({ ...prev, valorIndividual: val }))}
                        placeholder="R$ 0,00"
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Observações do Item</label>
                    <input
                      type="text"
                      value={itemForm.observacoes}
                      onChange={e => setItemForm(prev => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Observações ou local específico..."
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                  >
                    <Plus size={14} />
                    Vincular Item ao Contrato
                  </button>
                </div>

                {/* Linked Items List */}
                {form.itens && form.itens.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {form.itens.map(item => (
                      <div key={item.id} className="p-2.5 bg-white border border-slate-200 rounded-xl relative hover:border-slate-300 transition-all">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="absolute top-2.5 right-2.5 text-rose-500 hover:bg-rose-50 p-1 rounded-md transition-all cursor-pointer"
                          title="Remover Item"
                        >
                          <Trash2 size={13} />
                        </button>
                        
                        <div className="flex items-center gap-1.5">
                          <span className={`${
                            item.tipoItem === 'Equipamento' 
                              ? 'bg-blue-50 text-blue-700' 
                              : item.tipoItem === 'Software'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-green-50 text-green-700'
                          } text-[8.5px] font-bold uppercase px-1.5 py-0.5 rounded`}>
                            {item.tipoItem}
                          </span>
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase">Qtd: {item.quantidade}</span>
                        </div>

                        <p className="text-xs font-bold text-slate-800 mt-1 truncate pr-8">{item.modelo}</p>
                        
                        {item.marca && (
                          <span className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5 block">Marca: {item.marca}</span>
                        )}
                        {item.numeroSerie && (
                          <span className="text-[9px] text-slate-500 font-mono block mt-0.5">S/N: {item.numeroSerie}</span>
                        )}
                        {item.valorIndividual > 0 && (
                          <p className="text-[9.5px] font-bold text-emerald-600 mt-1 uppercase">
                            Valor Unitário: R$ {item.valorIndividual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                        {item.observacoes && (
                          <p className="text-[9px] text-slate-400 italic mt-0.5 font-medium truncate">{item.observacoes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 text-center py-2 italic font-semibold uppercase bg-slate-50 border border-slate-100 rounded-xl">
                    Nenhum item comercial vinculado a este contrato ainda.
                  </p>
                )}
              </div>

              {/* Observacoes */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Anotações Internas</label>
                <textarea
                  value={form.observacoes}
                  onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Detalhamento complementar..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white h-16 resize-none font-medium text-slate-600"
                />
              </div>

              {/* Save Control Buttons */}
              <div className="pt-4 border-t flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
