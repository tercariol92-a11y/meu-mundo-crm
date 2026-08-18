import React, { useState, useEffect, useRef } from 'react';
import { CurrencyInput } from './CurrencyInput';
import { formatToBRL, formatNumberBR } from '../utils/currency';
import {
  FileText, CreditCard, Settings, Plus, Search, CheckCircle, 
  XCircle, AlertCircle, RefreshCw, BarChart2, Download, Printer, 
  Trash2, Shield, Sliders, DollarSign, Clock, HelpCircle, 
  Building2, ArrowUpRight, Zap, ListFilter, Upload
} from 'lucide-react';
import { databaseService } from '../services/databaseService';
import { fiscalApi } from '../services/fiscalApi';
import RecurringBillingQueue from './fiscal/RecurringBillingQueue';
import { buildValidatedNfseDraft, fiscalA1SessionRef, issueNfseWithValidatedEngine } from '../services/nfseIssuanceService';
import { 
  Cliente, Produto, NotaFiscalProduto, NotaFiscalServico, 
  BoletoBancario, ContaBancaria, ConfiguracaoFiscal, Usuario,
  FiscalAuditLog
} from '../types';

interface FinanceiroFiscalAreaProps {
  user: Usuario;
}

export default function FinanceiroFiscalArea({ user }: FinanceiroFiscalAreaProps) {
  // Navigation tabs - aligned to the 7 required submenus
  const [activeSubTab, setActiveSubTab] = useState<'nfe' | 'nfse' | 'boletos' | 'contas' | 'config' | 'relatorios' | 'auditoria'>('relatorios');
  
  // State lists
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [nfeList, setNfeList] = useState<NotaFiscalProduto[]>([]);
  const [nfseList, setNfseList] = useState<NotaFiscalServico[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [boletos, setBoletos] = useState<BoletoBancario[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [configFiscal, setConfigFiscal] = useState<ConfiguracaoFiscal | null>(null);
  const [activeFiscalEnvironment, setActiveFiscalEnvironment] = useState<'producao' | 'producao_restrita' | null>(null);
  const [auditLogs, setAuditLogs] = useState<FiscalAuditLog[]>([]);
  
  // App-wide loaders & generic inputs
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState('todos');

  // New Modals/Forms State
  const [isNfeModalOpen, setIsNfeModalOpen] = useState(false);
  const [isNfseModalOpen, setIsNfseModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [selectedBoleto, setSelectedBoleto] = useState<BoletoBancario | null>(null);
  const [selectedNf, setSelectedNf] = useState<{tipo: 'produto'|'servico', data: any} | null>(null);
  const [cancellationNote, setCancellationNote] = useState<NotaFiscalServico | null>(null);
  const [cancellationReasonCode, setCancellationReasonCode] = useState<'1' | '2' | '9'>('1');
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationConfirmed, setCancellationConfirmed] = useState(false);
  const [isPreparingCancellation, setIsPreparingCancellation] = useState(false);
  const [isReconcilingCancellation, setIsReconcilingCancellation] = useState(false);
  const [cancellationValidation, setCancellationValidation] = useState<Record<string, unknown> | null>(null);
  const [danfsePreview, setDanfsePreview] = useState<{ url: string; fileName: string; nfs: NotaFiscalServico } | null>(null);
  const [isPreparingDanfse, setIsPreparingDanfse] = useState(false);

  useEffect(() => () => { if (danfsePreview?.url) URL.revokeObjectURL(danfsePreview.url); }, [danfsePreview?.url]);

  // XML Importation States
  const [isImportXmlModalOpen, setIsImportXmlModalOpen] = useState(false);
  const [xmlTypeFilter, setXmlTypeFilter] = useState<'todos' | 'nfe' | 'nfse'>('todos');
  const [xmlTextContent, setXmlTextContent] = useState('');
  const [parsedInvoice, setParsedInvoice] = useState<any | null>(null);
  const [linkingClientLoading, setLinkingClientLoading] = useState(false);
  const [saveWithFinancialDoc, setSaveWithFinancialDoc] = useState(true);

  // Verification helper for permissions
  const userRoles = new Set([user?.role, ...(user?.roles || [])].filter(Boolean));
  const isAdmin = userRoles.has('admin');
  const isFinanceiro = userRoles.has('financeiro') || user?.permissions?.viewFinanceiro;
  
  // Custom permissions for fiscal actions
  const canEmit = isAdmin || isFinanceiro;
  const canCancel = isAdmin || isFinanceiro;
  const canSetConfig = isAdmin; // Only Admins can change configuration or integrations
  const canImportXML = isAdmin || isFinanceiro || (user?.permissions as any)?.importarXml === true;

  // Notification / Feedback Toast State
  const [toast, setToast] = useState<{type: 'success'|'error'|'info', message: string} | null>(null);

  const showToast = (message: string, type: 'success'|'error'|'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Pre-fetch all necessary data
  const loadData = async () => {
    setLoading(true);
    try {
      const [
        clientesData, 
        produtosData, 
        nfeData, 
        nfseData, 
        boletosData, 
        contasData, 
        fiscalConfigData,
        auditLogsData
      ] = await Promise.all([
        databaseService.getClientes(),
        databaseService.getProdutos(),
        databaseService.getNotasFiscaisProduto(),
        databaseService.getNotasFiscaisServico(),
        databaseService.getBoletosBancarios(),
        databaseService.getContasBancarias(),
        databaseService.getConfiguracaoFiscal(),
        databaseService.getFiscalAuditLogs()
      ]);

      setClientes(clientesData || []);
      setProdutos(produtosData || []);
      setNfeList(nfeData || []);
      setNfseList((nfseData || []).map((item: any) => ({
        ...item,
        clienteId: item.clienteId || item.clientId || '',
        clienteNome: item.clienteNome || item.clientName || 'Cliente',
        municipioPrestacao: item.municipioPrestacao || item.incidenceMunicipality || '',
        codigoServico: item.codigoServico || item.municipalServiceCode || '',
        descricaoServico: item.descricaoServico || item.invoiceDescription || item.description || '',
        valorServico: Number(item.valorServico ?? item.serviceAmount ?? item.totalAmount ?? 0),
        iss: Number(item.iss ?? item.issRate ?? 0),
        issRetido: Boolean(item.issRetido ?? item.issWithheld),
        retencoes: item.retencoes || { totalRetido: 0 },
        dataCompetencia: item.dataCompetencia || item.competence || '',
        numeroNota: item.numeroNota || item.invoiceNumber || '',
        codigoVerificacao: item.codigoVerificacao || item.verificationCode,
        dataEmissao: item.dataEmissao || item.emittedAt || '',
      })));
      setBoletos(boletosData || []);
      setContasBancarias(contasData || []);
      setConfigFiscal(fiscalConfigData ? {
        ...fiscalConfigData,
        id: fiscalConfigData.id || 'config',
        cnpj: fiscalConfigData.cnpj || '',
        razaoSocial: fiscalConfigData.razaoSocial || '',
        nomeFantasia: fiscalConfigData.nomeFantasia || fiscalConfigData.tradeName || '',
        inscricaoEstadual: fiscalConfigData.inscricaoEstadual || fiscalConfigData.stateRegistration || '',
        inscricaoMunicipal: fiscalConfigData.inscricaoMunicipal || fiscalConfigData.municipalRegistration || '',
        regimeTributario: fiscalConfigData.regimeTributario || fiscalConfigData.taxRegime || 'Simples Nacional',
        municipio: fiscalConfigData.municipio || fiscalConfigData.municipality || '',
        codigoIbge: fiscalConfigData.codigoIbge || fiscalConfigData.ibgeCode || '',
        aliquotaIssPadrao: fiscalConfigData.aliquotaIssPadrao ?? fiscalConfigData.defaultIssRate ?? 0,
        codigoServicoMunicipal: fiscalConfigData.codigoServicoMunicipal || fiscalConfigData.municipalServiceCode || '',
        itemListaServico: fiscalConfigData.itemListaServico || fiscalConfigData.lc116Item || '',
        cnae: fiscalConfigData.cnae || '',
        situacaoSimplesNacional: fiscalConfigData.situacaoSimplesNacional,
        situacaoSimplesNacionalCompetencia: fiscalConfigData.situacaoSimplesNacionalCompetencia || '',
        situacaoSimplesNacionalFonte: fiscalConfigData.situacaoSimplesNacionalFonte || '',
        certificadoDigitalNome: fiscalConfigData.certificadoDigitalNome || fiscalConfigData.certificateFileName,
        certificadoVencimento: fiscalConfigData.certificadoVencimento || fiscalConfigData.certificateValidTo?.slice(0, 10),
        ambiente: 'Homologação',
        provedorFiscal: 'sefin_nacional',
      } : { id:'config', cnpj:'', razaoSocial:'', inscricaoEstadual:'', inscricaoMunicipal:'', regimeTributario:'Simples Nacional', ambiente:'Homologação', municipio:'', codigoIbge:'', provedorFiscal:'sefin_nacional' });
      setAuditLogs(auditLogsData || []);
      setContracts((await databaseService.getContratosRecorrentes?.()) || []);
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao carregar dados fiscais', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    void fiscalApi.getEnvironment()
      .then(environment => setActiveFiscalEnvironment(environment.environment === 'producao' ? 'producao' : 'producao_restrita'))
      .catch(() => setActiveFiscalEnvironment(null));
  }, []);

  // Form states for NFe
  const [nfeForm, setNfeForm] = useState({
    clienteId: '',
    produtoId: '',
    operacao: 'venda_comum' as 'venda_comum' | 'retorno_conserto',
    cfop: '5102', // Venda interna de mercadoria adquirida de terceiros
    cstCsosn: '102', // Simples Nacional sem permissão de crédito e sem ST
    ncm: '',
    origemMercadoria: '0',
    unidadeTributavel: 'UN',
    cest: '',
    gtin: '',
    pisCst: '',
    cofinsCst: '',
    valorProduto: 0,
    frete: 0,
    formaPagamento: 'Boleto' as const,
    condicaoPagamento: '30 Dias' as const,
    emitirBoleto: false,
    observacoes: ''
  });

  // Form states for NFSe
  const [nfseForm, setNfseForm] = useState({
    clienteId: '',
    codigoServico: '01.07', // Suporte Técnico / informática
    descricaoServico: 'SERVIÇOS DE ASSISTÊNCIA TÉCNICA E SUPORTE EM TI',
    valorServico: 0,
    iss: 5, // % Standard
    issRetido: false,
    retencaoPis: 0,
    retencaoCofins: 0,
    retencaoCsll: 0,
    retencaoIrrf: 0,
    emitirBoleto: true,
    observacoes: 'Competência do serviço efetuado conforme contrato.'
    ,serviceKind: 'suporte'
    ,discount: 0
    ,competence: new Date().toISOString().slice(0, 7)
  });

  // Calculate NFS-e Net Values
  const getCalculatedNfseTaxes = (val: number, issPercent: number, retido: boolean) => {
    const issValue = parseFloat((val * (issPercent / 100)).toFixed(2));
    // Simulated general retentions (usually above 215.05 BRL in Brazil)
    const activeRetentions = val >= 215 ? {
      pis: parseFloat((val * 0.0065).toFixed(2)),
      cofins: parseFloat((val * 0.03).toFixed(2)),
      csll: parseFloat((val * 0.01).toFixed(2)),
      irrf: parseFloat((val * 0.015).toFixed(2)),
    } : { pis: 0, cofins: 0, csll: 0, irrf: 0 };

    const totalRetido = parseFloat((activeRetentions.pis + activeRetentions.cofins + activeRetentions.csll + activeRetentions.irrf).toFixed(2));
    const finalValue = parseFloat((val - (retido ? issValue : 0) - totalRetido).toFixed(2));

    return {
      issValor: issValue,
      retencoes: activeRetentions,
      totalRetido,
      valorLiquido: finalValue
    };
  };

  // Bank Account Form State
  const [bankForm, setBankForm] = useState({
    nomeIdentificador: '',
    banco: 'Itaú' as const,
    agencia: '',
    conta: '',
    carteira: '109',
    convenio: '',
    codigoBeneficiario: '',
    jurosPadrao: 1.0,
    multaPadrao: 2.0,
    descontoPadrao: 0.0,
    instrucoesPadrao: 'Não cobrar juros até o vencimento.'
  });

  // Submits a new sale invoice (NF-e)
  const handleNfeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEmit) {
      showToast('Permissão negada para emitir NF-e.', 'error');
      return;
    }
    if (!nfeForm.clienteId || !nfeForm.produtoId || nfeForm.valorProduto <= 0) {
      showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }
    if (!/^\d{8}$/.test(String(nfeForm.ncm || '').replace(/\D/g, ''))) {
      showToast('Cadastre um NCM válido com 8 dígitos no produto antes de preparar a NF-e.', 'error');
      return;
    }
    if (nfeForm.cstCsosn === '202' && !/^\d{7}$/.test(String(nfeForm.cest || '').replace(/\D/g, ''))) {
      showToast('O CSOSN 202 exige CEST válido com 7 dígitos no cadastro do produto.', 'error');
      return;
    }

    try {
      const clientObj = clientes.find(c => c.id === nfeForm.clienteId);
      const prodObj = produtos.find(p => p.id === nfeForm.produtoId);

      if (!clientObj || !prodObj) {
        showToast('Cliente ou Produto de referência inválido.', 'error');
        return;
      }

      // NF-e de produto permanece como rascunho até autorização real da SEFA/PR.
      // Nenhuma chave, protocolo, tributo ou status fiscal pode ser simulado no navegador.
      const draftNumber = `RASC-${Date.now()}`;
      const docPayload: Omit<NotaFiscalProduto, 'id' | 'createdAt' | 'updatedAt'> = {
        clienteId: clientObj.id,
        clienteNome: clientObj.razaoSocial || clientObj.nomeFantasia,
        cnpjCpf: clientObj.cnpj || 'Não Informado',
        inscricaoEstadual: clientObj.inscricaoEstadual || 'Isento',
        endereco: `${clientObj.rua || 'Rua s/n'}, ${clientObj.numero || 'S/N'}`,
        bairro: clientObj.bairro || 'Centro',
        cidade: clientObj.cidade || 'São Paulo',
        estado: clientObj.estado || 'SP',
        cep: clientObj.cep || '00000-000',
        produtoId: prodObj.id,
        produtoNome: prodObj.nome,
        ncm: nfeForm.ncm,
        cfop: nfeForm.cfop,
        cstCsosn: nfeForm.cstCsosn,
        origemMercadoria: nfeForm.origemMercadoria,
        unidadeTributavel: nfeForm.unidadeTributavel,
        cest: nfeForm.cest,
        gtin: nfeForm.gtin,
        pisCst: nfeForm.pisCst,
        cofinsCst: nfeForm.cofinsCst,
        valorProduto: Number(nfeForm.valorProduto),
        frete: Number(nfeForm.frete || 0),
        impostos: {
          totalImpostos: 0
        },
        formaPagamento: nfeForm.formaPagamento,
        condicaoPagamento: nfeForm.condicaoPagamento,
        observacoes: nfeForm.observacoes || 'Mercadoria despachada. Garantia de 12 meses.',
        status: 'Rascunho',
        ambienteNfe: 'homologacao',
        numeroNota: draftNumber,
        serie: '',
        dataEmissao: new Date().toISOString().split('T')[0]
      };

      // 4. Save to Firestore
      const createdNf = await databaseService.createNotaFiscalProduto(docPayload);

      // Auditoria registra somente a criação do rascunho; não registra emissão.
      await databaseService.createFiscalAuditLog({
        userId: user.id || 'system',
        userName: user.nome || 'Sistema',
        action: 'configuracao_alterada',
        details: `Rascunho de NF-e de produto criado em homologação. Cliente: ${docPayload.clienteNome}. Valor: ${formatToBRL(docPayload.valorProduto + (docPayload.frete || 0))}. Nenhuma transmissão realizada.`,
        tipoDocumento: 'nfe',
        documentNumero: createdNf.numeroNota
      });

      showToast('Rascunho salvo. Nenhuma NF-e foi transmitida.', 'info');
      setIsNfeModalOpen(false);
      loadData();
    } catch (error) {
      console.error(error);
      showToast('Falha ao emitir NF-e.', 'error');
    }
  };

  // Submits a new service invoice (NFS-e)
  const handleNfseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEmit) {
      showToast('Permissão negada para emitir NFS-e.', 'error');
      return;
    }
    if (!nfseForm.clienteId || !nfseForm.descricaoServico || nfseForm.valorServico <= 0) {
      showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    try {
      const clientObj = clientes.find(c => c.id === nfseForm.clienteId);
      if (!clientObj) {
        showToast('Cliente de referência inválido.', 'error');
        return;
      }

      const credentials = certificateSessionRef.current;
      if (!credentials) throw new Error('A sessao protegida do certificado A1 precisa estar validada antes de preparar a emissao.');
      if (!configFiscal) throw new Error('Configuração fiscal da empresa indisponível.');
      const draft = buildValidatedNfseDraft({ client: clientObj, config: configFiscal, description: nfseForm.descricaoServico, amount: nfseForm.valorServico, competence: nfseForm.competence, issWithheld: nfseForm.issRetido, credentials });
      const issued = await issueNfseWithValidatedEngine(draft);
      if (issued?.result !== 'AUTORIZADA' || !issued?.accessKey) throw new Error(issued?.message || 'A SEFIN não autorizou a NFS-e.');
      showToast(`NFS-e ${issued.nfseNumber || ''} autorizada em ${issued.environment === 'producao' ? 'Produção Real' : 'Produção Restrita'}.`, 'success');
      setIsNfseModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Falha ao emitir NFS-e.', 'error');
    }
  };

  // ==========================================
  // --- XML Import Processing ---
  // ==========================================

  const parseXmlInvoice = (xmlText: string) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    // Check parsing error
    const parseError = xmlDoc.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      throw new Error("Formato XML inválido ou corrompido.");
    }

    // Detect type
    const isNfe = xmlDoc.getElementsByTagName("infNFe").length > 0 || xmlDoc.getElementsByTagName("NFe").length > 0;
    const isNfse = xmlDoc.getElementsByTagName("CompNfse").length > 0 || 
                   xmlDoc.getElementsByTagName("Nfse").length > 0 || 
                   xmlDoc.getElementsByTagName("tcDeclaracaoPrestacaoServico").length > 0 ||
                   xmlDoc.getElementsByTagName("GerarNfseResposta").length > 0 ||
                   (xmlDoc.getElementsByTagName("Servico").length > 0 && !isNfe);

    if (!isNfe && !isNfse) {
      throw new Error("O XML de faturamento fornecido não é uma NF-e de Produto ou NFS-e de Serviço válida.");
    }

    const helperVal = (selectors: string[]): string => {
      for (const sel of selectors) {
        const el = xmlDoc.querySelector(sel);
        if (el?.textContent) return el.textContent.trim();
      }
      return '';
    };

    const tipo = isNfe ? 'nfe' : 'nfse';

    const numeroNota = helperVal(['ide > nNF', 'nNF', 'Numero', 'InfNfse > Numero', 'nDoc']);
    const serie = helperVal(['ide > serie', 'serie', 'Serie', 'InfNfse > Serie']) || '1';
    
    let chaveAcesso = '';
    if (isNfe) {
      const infNfeEl = xmlDoc.querySelector('infNFe');
      const idAttr = infNfeEl?.getAttribute('Id') || infNfeEl?.getAttribute('id') || '';
      if (idAttr.startsWith('NFe')) {
        chaveAcesso = idAttr.slice(3);
      } else {
        chaveAcesso = idAttr || helperVal(['chNFe', 'procRef > nProt']);
      }
      if (!chaveAcesso) {
        chaveAcesso = helperVal(['chNFe']);
      }
    } else {
      chaveAcesso = helperVal(['CodigoVerificacao', 'InfNfse > CodigoVerificacao', 'codigoVerificacao']);
    }

    // Fallback: If no chaveAcesso can be parsed, let's generate a smart verifiably unique hash
    const rawEmitCNPJ = helperVal(['emit > CNPJ', 'emit CNPJ', 'PrestadorServico CNPJ', 'PrestadorServico > IdentificacaoPrestador > Cnpj', 'CnpjPrestador', 'Prestador CNPJ', 'IdentificacaoPrestador Cnpj', 'CpfCnpj Cnpj']);
    const dataEmissaoStr = helperVal(['dhEmi', 'dEmi', 'DataEmissao', 'InfNfse > DataEmissao', 'dtEmissao', 'dCompetencia']);
    
    if (!chaveAcesso && numeroNota) {
      chaveAcesso = `GEN_${rawEmitCNPJ || 'EMI'}_${numeroNota}_${dataEmissaoStr?.replace(/\D/g, '') || '0'}`;
    }

    let dataEmissao = new Date().toISOString().split('T')[0];
    if (dataEmissaoStr) {
      try {
        const parsedDate = new Date(dataEmissaoStr);
        if (!isNaN(parsedDate.getTime())) {
          dataEmissao = parsedDate.toISOString().split('T')[0];
        } else {
          dataEmissao = dataEmissaoStr.slice(0, 10);
        }
      } catch (_) {}
    }

    const emitCNPJ = helperVal(['emit > CNPJ', 'emit CNPJ', 'PrestadorServico CNPJ', 'PrestadorServico > IdentificacaoPrestador > Cnpj', 'CnpjPrestador', 'Prestador CNPJ', 'IdentificacaoPrestador Cnpj', 'CpfCnpj Cnpj']);
    const emitCPF = helperVal(['emit > CPF', 'emit CPF']);
    const emitNome = helperVal(['emit > xNome', 'emit xNome', 'PrestadorServico RazaoSocial', 'PrestadorServico > RazaoSocial', 'RazaoSocialPrestador', 'Prestador RazaoSocial', 'NomeEmitente', 'PrestadorServico > Nome']);
    
    const destCNPJ = helperVal(['dest > CNPJ', 'dest CNPJ', 'TomadorServico CNPJ', 'TomadorServico > IdentificacaoTomador > CpfCnpj > Cnpj', 'CnpjTomador', 'Tomador CNPJ', 'CpfCnpj Cnpj']);
    const destCPF = helperVal(['dest > CPF', 'dest CPF', 'TomadorServico CPF', 'TomadorServico > IdentificacaoTomador > CpfCnpj > Cpf', 'CpfTomador', 'CpfCnpj Cpf']);
    const destNome = helperVal(['dest > xNome', 'dest xNome', 'TomadorServico RazaoSocial', 'TomadorServico > RazaoSocial', 'RazaoSocialTomador', 'Tomador RazaoSocial', 'NomeTomador']);

    const destEnder = {
      rua: helperVal(['dest > enderDest > xLgr', 'dest xLgr', 'TomadorServico Endereco > Logradouro', 'Tomador Logradouro']),
      numero: helperVal(['dest > enderDest > nro', 'dest nro', 'TomadorServico Endereco > Numero', 'Tomador Numero']),
      bairro: helperVal(['dest > enderDest > xBairro', 'dest xBairro', 'TomadorServico Endereco > Bairro', 'Tomador Bairro']),
      cidade: helperVal(['dest > enderDest > xMun', 'dest xMun', 'TomadorServico Endereco > Cidade', 'TomadorServico Endereco > CodigoMunicipio', 'Tomador Cidade']),
      estado: helperVal(['dest > enderDest > UF', 'dest UF', 'TomadorServico Endereco > EstadoCode', 'TomadorServico Endereco > Estado', 'TomadorServico Endereco > Uf', 'Tomador Uf']),
      cep: helperVal(['dest > enderDest > CEP', 'dest CEP', 'TomadorServico Endereco > Cep', 'Tomador Cep']),
    };

    const emitEnder = {
      rua: helperVal(['emit > enderEmit > xLgr', 'emit xLgr', 'PrestadorServico Endereco > Logradouro']),
      numero: helperVal(['emit > enderEmit > nro', 'emit nro', 'PrestadorServico Endereco > Numero']),
      bairro: helperVal(['emit > enderEmit > xBairro', 'emit xBairro', 'PrestadorServico Endereco > Bairro']),
      cidade: helperVal(['emit > enderEmit > xMun', 'emit xMun', 'PrestadorServico Endereco > Cidade']),
      estado: helperVal(['emit > enderEmit > UF', 'emit UF', 'PrestadorServico Endereco > Estado']),
      cep: helperVal(['emit > enderEmit > CEP', 'emit CEP', 'PrestadorServico Endereco > Cep']),
    };

    const itens: any[] = [];
    if (isNfe) {
      const itemElements = xmlDoc.getElementsByTagName('det');
      for (let i = 0; i < itemElements.length; i++) {
        const itemNode = itemElements[i];
        const prodNode = itemNode.getElementsByTagName('prod')[0];
        if (prodNode) {
          itens.push({
            codigo: prodNode.getElementsByTagName('cProd')[0]?.textContent?.trim() || '',
            descricao: prodNode.getElementsByTagName('xProd')[0]?.textContent?.trim() || '',
            ncm: prodNode.getElementsByTagName('NCM')[0]?.textContent?.trim() || '',
            cfop: prodNode.getElementsByTagName('CFOP')[0]?.textContent?.trim() || '',
            cstCsosn: itemNode.getElementsByTagName('CST')[0]?.textContent?.trim() || itemNode.getElementsByTagName('CSOSN')[0]?.textContent?.trim() || '0102',
            valorUnitario: parseFloat(prodNode.getElementsByTagName('vUnCom')[0]?.textContent || '0'),
            quantidade: parseFloat(prodNode.getElementsByTagName('qCom')[0]?.textContent || '0'),
            valorTotal: parseFloat(prodNode.getElementsByTagName('vProd')[0]?.textContent || '0'),
          });
        }
      }
    } else {
      itens.push({
        codigo: helperVal(['Servico > ItemListaServico', 'Servico ItemListaServico', 'CodigoServico', 'CodigoItemServico']),
        descricao: helperVal(['Servico > Discriminacao', 'Servico Discriminacao', 'Discriminacao', 'DiscriminacaoServico']),
        valorTotal: parseFloat(helperVal(['Valores > ValorServicos', 'vServ', 'ValorServicos', 'ValorServico']) || '0'),
      });
    }

    const valorTotal = isNfe 
      ? parseFloat(helperVal(['total > ICMSTot > vNF', 'vNF']) || '0')
      : (parseFloat(helperVal(['Valores > ValorServicos', 'vServ', 'ValorServicos', 'ValorServico']) || '0') || parseFloat(helperVal(['Valores > ValorLiquidoNfse', 'vLiq', 'ValorLiquidoNfse']) || '0'));

    const impostos = isNfe ? {
      icmsValor: parseFloat(helperVal(['total > ICMSTot > vICMS', 'vICMS']) || '0'),
      ipiValor: parseFloat(helperVal(['total > ICMSTot > vIPI', 'vIPI']) || '0'),
      pisValor: parseFloat(helperVal(['total > ICMSTot > vPIS', 'vPIS']) || '0'),
      cofinsValor: parseFloat(helperVal(['total > ICMSTot > vCOFINS', 'vCOFINS']) || '0'),
      totalImpostos: parseFloat(helperVal(['total > ICMSTot > vTotTrib', 'vTotTrib']) || '0')
    } : {
      iss: parseFloat(helperVal(['Valores > ValorIss', 'vIss', 'ValorIss', 'ValorISS']) || '0'),
      issRetido: (helperVal(['Valores > IssRetido', 'IssRetido', 'ISS_CONF_RETIDO']) === '1' || helperVal(['Valores > IssRetido', 'IssRetido']) === 'true'),
      pis: parseFloat(helperVal(['Valores > ValorPis', 'vPis', 'ValorPis']) || '0'),
      cofins: parseFloat(helperVal(['Valores > ValorCofins', 'vCofins', 'ValorCofins']) || '0'),
      csll: parseFloat(helperVal(['Valores > ValorCsll', 'vCsll', 'ValorCsll']) || '0'),
      irrf: parseFloat(helperVal(['Valores > ValorIr', 'vIr', 'ValorIr', 'ValorIrrf']) || '0'),
      inss: parseFloat(helperVal(['Valores > ValorInss', 'vInss', 'ValorInss']) || '0'),
      totalRetido: parseFloat(helperVal(['Valores > ValorRetencoes', 'ValorRetencoes', 'ValorRetencoesFederais']) || '0')
    };

    return {
      tipo,
      numeroNota,
      serie,
      chaveAcesso,
      dataEmissao,
      emitCNPJ: emitCNPJ || emitCPF,
      emitNome: emitNome || 'Emitente Desconhecido',
      emitEnder,
      destCNPJ: destCNPJ || destCPF,
      destNome: destNome || 'Destinatário Desconhecido',
      destEnder,
      itens,
      valorTotal,
      impostos,
      status: 'Autorizada' as const
    };
  };

  const handleXmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canImportXML) {
      showToast('Você não possui autorização para importar arquivos XML. Consulte o administrador.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setXmlTextContent(text);
      try {
        const parsed = parseXmlInvoice(text);
        
        // Ensure XML type matches filter restriction if we come from NFe or NFSe sub-tab
        if (xmlTypeFilter !== 'todos' && parsed.tipo !== xmlTypeFilter) {
          showToast(`O XML enviado é do tipo de faturamento incorreto (esperado: ${xmlTypeFilter === 'nfe' ? 'NF-e' : 'NFS-e'}).`, 'error');
          return;
        }

        // Duplicate Check
        const isDuplicateNfe = nfeList.some(n => n.chaveAcesso === parsed.chaveAcesso || (n.numeroNota === parsed.numeroNota && n.serie === parsed.serie));
        const isDuplicateNfse = nfseList.some(n => n.codigoVerificacao === parsed.chaveAcesso || n.numeroNota === parsed.numeroNota);
        
        if (isDuplicateNfe || isDuplicateNfse) {
          showToast('Nota já importada anteriormente no sistema.', 'error');
          setParsedInvoice({ ...parsed, duplicateError: true });
          return;
        }

        // Detect appropriate Client/Partner mapping
        let clientXmlCNPJ = parsed.destCNPJ;
        let clientXmlNome = parsed.destNome;
        let clientEnder = parsed.destEnder;
        let isSale = true; // By default we assume we are emitting (sales)

        if (configFiscal?.cnpj) {
          const configCNPJClipped = configFiscal.cnpj.replace(/\D/g, '');
          const emitCNPJClipped = (parsed.emitCNPJ || '').replace(/\D/g, '');
          const destCNPJClipped = (parsed.destCNPJ || '').replace(/\D/g, '');
          if (destCNPJClipped === configCNPJClipped) {
            // We are the destinatário, hence this is a PURCHASE invoice (Contas a Pagar)
            clientXmlCNPJ = parsed.emitCNPJ;
            clientXmlNome = parsed.emitNome;
            clientEnder = parsed.emitEnder;
            isSale = false;
          }
        }

        // Link with existing client
        const cleanedXmlCNPJ = (clientXmlCNPJ || '').replace(/\D/g, '');
        const foundClient = clientes.find(c => {
          const dbCNPJ = (c.cnpj || '').replace(/\D/g, '');
          return dbCNPJ && dbCNPJ === cleanedXmlCNPJ;
        });

        setParsedInvoice({
          ...parsed,
          clientXmlCNPJ,
          clientXmlNome,
          clientEnder,
          isSale,
          linkedCliente: foundClient || null,
          duplicateError: false
        });

        if (foundClient) {
          showToast('XML lido e cliente vinculado com sucesso!', 'success');
        } else {
          showToast('XML lido com sucesso. Cliente não localizado no banco de dados.', 'info');
        }
      } catch (err: any) {
        console.error(err);
        showToast(err.message || 'Falha ao processar arquivo XML.', 'error');
        setParsedInvoice(null);
      }
    };
    reader.readAsText(file);
  };

  const handleAutoCreateClient = async () => {
    if (!parsedInvoice) return;
    setLinkingClientLoading(true);
    try {
      const newClientPayload = {
        nomeFantasia: parsedInvoice.clientXmlNome || parsedInvoice.destNome || 'Cliente Importado',
        razaoSocial: parsedInvoice.clientXmlNome || parsedInvoice.destNome || 'Cliente Importado',
        cnpj: parsedInvoice.clientXmlCNPJ || parsedInvoice.destCNPJ || '',
        tipoPessoa: (parsedInvoice.clientXmlCNPJ || parsedInvoice.destCNPJ || '').replace(/\D/g, '').length > 11 ? 'Jurídica' as const : 'Física' as const,
        status: 'Ativo' as const,
        rua: parsedInvoice.clientEnder?.rua || '',
        numero: parsedInvoice.clientEnder?.numero || '',
        bairro: parsedInvoice.clientEnder?.bairro || '',
        cidade: parsedInvoice.clientEnder?.cidade || '',
        estado: parsedInvoice.clientEnder?.estado || '',
        cep: parsedInvoice.clientEnder?.cep || '',
        observacoesComerciais: 'Cadastrado automaticamente via importação de XML Fiscal.'
      };
      
      const created = await databaseService.createCliente(newClientPayload);
      const updatedClientes = await databaseService.getClientes();
      setClientes(updatedClientes);
      
      setParsedInvoice(prev => {
        if (!prev) return null;
        return {
          ...prev,
          linkedCliente: created
        };
      });
      showToast('Nota vinculada ao cliente com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Falha ao cadastrar cliente automaticamente.', 'error');
    } finally {
      setLinkingClientLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedInvoice) return;
    if (parsedInvoice.duplicateError) {
      showToast('Nota já importada anteriormente.', 'error');
      return;
    }

    try {
      setLoading(true);

      const clientName = parsedInvoice.linkedCliente?.razaoSocial || parsedInvoice.linkedCliente?.nomeFantasia || parsedInvoice.clientXmlNome;
      const clientID = parsedInvoice.linkedCliente?.id || 'importado_sem_id';

      // 1. Create Invoice Document in Firestore
      if (parsedInvoice.tipo === 'nfe') {
        const payload: Omit<NotaFiscalProduto, 'id' | 'createdAt' | 'updatedAt'> = {
          clienteId: clientID,
          clienteNome: clientName,
          cnpjCpf: parsedInvoice.clientXmlCNPJ || '',
          endereco: `${parsedInvoice.clientEnder?.rua || ''}, ${parsedInvoice.clientEnder?.numero || ''} ${parsedInvoice.clientEnder?.bairro || ''}`,
          cidade: parsedInvoice.clientEnder?.cidade || '',
          estado: parsedInvoice.clientEnder?.estado || '',
          produtoId: 'xml_importado',
          produtoNome: parsedInvoice.itens?.[0]?.descricao || 'Venda Importada XML',
          ncm: parsedInvoice.itens?.[0]?.ncm || '84715010',
          cfop: parsedInvoice.itens?.[0]?.cfop || '5102',
          cstCsosn: parsedInvoice.itens?.[0]?.cstCsosn || '0102',
          valorProduto: parsedInvoice.valorTotal,
          frete: 0,
          impostos: {
            icmsValor: parsedInvoice.impostos?.icmsValor || 0,
            ipiValor: parsedInvoice.impostos?.ipiValor || 0,
            pisValor: parsedInvoice.impostos?.pisValor || 0,
            cofinsValor: parsedInvoice.impostos?.cofinsValor || 0,
            totalImpostos: parsedInvoice.impostos?.totalImpostos || 0,
          },
          formaPagamento: 'Boleto',
          condicaoPagamento: '30 Dias',
          status: 'Autorizada',
          chaveAcesso: parsedInvoice.chaveAcesso,
          numeroNota: parsedInvoice.numeroNota,
          serie: parsedInvoice.serie || '1',
          dataEmissao: parsedInvoice.dataEmissao,
          xmlOriginal: xmlTextContent,
          observacoes: `XML Importado. Emitente: ${parsedInvoice.emitNome} (CNPJ: ${parsedInvoice.emitCNPJ})`
        };
        await databaseService.createNotaFiscalProduto(payload);
      } else {
        const payload: Omit<NotaFiscalServico, 'id' | 'createdAt' | 'updatedAt'> = {
          clienteId: clientID,
          clienteNome: clientName,
          municipioPrestacao: parsedInvoice.clientEnder?.cidade || 'Prestacao',
          codigoServico: parsedInvoice.itens?.[0]?.codigo || '0101',
          descricaoServico: parsedInvoice.itens?.[0]?.descricao || 'NFS-e Importada XML',
          valorServico: parsedInvoice.valorTotal,
          iss: parsedInvoice.impostos?.iss || 0,
          issRetido: parsedInvoice.impostos?.issRetido || false,
          retencoes: {
            pis: parsedInvoice.impostos?.pis || 0,
            cofins: parsedInvoice.impostos?.cofins || 0,
            csll: parsedInvoice.impostos?.csll || 0,
            irrf: parsedInvoice.impostos?.irrf || 0,
            inss: parsedInvoice.impostos?.inss || 0,
            totalRetido: parsedInvoice.impostos?.totalRetido || 0,
          },
          dataCompetencia: parsedInvoice.dataEmissao,
          status: 'Autorizada',
          numeroNota: parsedInvoice.numeroNota,
          codigoVerificacao: parsedInvoice.chaveAcesso,
          dataEmissao: parsedInvoice.dataEmissao,
          xmlOriginal: xmlTextContent,
          observacoes: `XML Importado. Prestador: ${parsedInvoice.emitNome} (CNPJ: ${parsedInvoice.emitCNPJ})`
        };
        await databaseService.createNotaFiscalServico(payload);
      }

      // 2. Clear auto financial accounts payable integration if checked
      if (saveWithFinancialDoc) {
        const financialPayload = {
          descricao: `Importação XML: Nota nº ${parsedInvoice.numeroNota} (${parsedInvoice.tipo === 'nfe' ? 'NF-e' : 'NFS-e'})`,
          categoria: parsedInvoice.tipo === 'nfe' ? 'Compras de mercadorias' : 'Outros',
          categoryType: 'Variavel',
          fornecedor: parsedInvoice.emitNome || 'Emissor XML',
          valor: parsedInvoice.valorTotal,
          dataVencimento: parsedInvoice.dataEmissao,
          dataPagamento: null,
          status: 'Pendente',
          observacoes: `Lançamento financeiro gerado de forma automática com base no XML importado. Chave/Verificação: ${parsedInvoice.chaveAcesso}`
        };
        await databaseService.createContaPagar(financialPayload);
      }

      // 3. Register XML Import in Fiscal Audit Log
      await databaseService.createFiscalAuditLog({
        userId: user.id || 'sistema',
        userName: user.nome || 'Usuário',
        action: parsedInvoice.tipo === 'nfe' ? 'emissao_nfe' : 'emissao_nfse',
        details: `XML importado com sucesso da nota número ${parsedInvoice.numeroNota} pelo usuário autorizado. Lançamento financeiro auto-integrado.`,
        tipoDocumento: parsedInvoice.tipo,
        documentNumero: parsedInvoice.numeroNota
      });

      showToast('XML importado com sucesso!', 'success');
      setIsImportXmlModalOpen(false);
      setParsedInvoice(null);
      setXmlTextContent('');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Erro ao gravar importação fiscal no banco de dados.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // --- Back / Existing code continued ---
  // ==========================================

  // Create new Bank/Integration Account
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSetConfig) {
      showToast('Apenas administradores podem gerenciar integrações bancárias.', 'error');
      return;
    }
    if (!bankForm.nomeIdentificador || !bankForm.agencia || !bankForm.conta) {
      showToast('Preencha os dados bancários obrigatórios.', 'error');
      return;
    }

    try {
      await databaseService.createContaBancaria({
        ...bankForm,
        ativo: true
      });

      // Salva log de auditoria fiscal
      await databaseService.createFiscalAuditLog({
        userId: user.id || 'system',
        userName: user.nome || 'Sistema',
        action: 'integracao_alterada',
        details: `Cadastro de nova integração bancária: ${bankForm.nomeIdentificador} (${bankForm.banco} - Ag: ${bankForm.agencia}, C/C: ${bankForm.conta}).`,
        tipoDocumento: 'conta'
      });

      showToast('Integração Bancária cadastrada com sucesso!');
      setIsAccountModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Erro ao gravar conta.', 'error');
    }
  };

  // Manual slip clearing (baixa manual)
  const handleClearBoleto = async (boletoId: string) => {
    if (!canCancel) { // canCancel has the same security scope as manual clearing/editing
      showToast('Permissão negada para dar baixa manual.', 'error');
      return;
    }
    try {
      const bolObj = boletos.find(b => b.id === boletoId);
      const docNum = bolObj?.nossoNumero || '';

      await databaseService.updateBoletoBancario(boletoId, {
        status: 'Pago',
        baixaTipo: 'Manual',
        dataPagamento: new Date().toISOString().split('T')[0]
      });

      // Salva log de auditoria fiscal
      await databaseService.createFiscalAuditLog({
        userId: user.id || 'system',
        userName: user.nome || 'Sistema',
        action: 'baixa_boleto',
        details: `Baixa manual registrada para o boleto nº ${docNum}. Cliente: ${bolObj?.clienteNome || 'Desconhecido'}. Valor original: ${formatToBRL(bolObj?.valorOriginal || 0)}.`,
        tipoDocumento: 'boleto',
        documentNumero: docNum
      });

      showToast('Boleto marcado como PAGO (Baixa manual registrada)!');
      setSelectedBoleto(null);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Erro ao realizar baixa.', 'error');
    }
  };

  // Cancels a registered invoice (Produto or Serviço)
  const handleCancelInvoice = async (id: string, tipo: 'produto' | 'servico') => {
    if (!canCancel) {
      showToast('Apenas gerentes ou diretores financeiros podem cancelar notas emitidas.', 'error');
      return;
    }
    if (!window.confirm('Tem certeza de que deseja solicitar o cancelamento fiscal desta nota?')) {
      return;
    }

    try {
      if (tipo === 'produto') {
        const nfObj = nfeList.find(n => n.id === id);
        await databaseService.updateNotaFiscalProduto(id, { status: 'Cancelada' });
        // Also cancel linked boleto if exists
        if (nfObj?.boletoCriadoId) {
          await databaseService.updateBoletoBancario(nfObj.boletoCriadoId, { status: 'Cancelado' });
        }

        // Salva log de auditoria fiscal
        await databaseService.createFiscalAuditLog({
          userId: user.id || 'system',
          userName: user.nome || 'Sistema',
          action: 'cancelamento_nfe',
          details: `Cancelamento de NF-e nº ${nfObj?.numeroNota || id}. Cliente: ${nfObj?.clienteNome || 'Desconhecido'}. Valor: ${formatToBRL((nfObj?.valorProduto || 0) + (nfObj?.frete || 0))}. ${nfObj?.boletoCriadoId ? 'Boleto de cobrança vinculado também cancelado.' : ''}`,
          tipoDocumento: 'nfe',
          documentNumero: nfObj?.numeroNota
        });
      } else {
        throw new Error('Cancelamento bloqueado durante a Fase 1 técnica da SEFIN Nacional.');
      }
      showToast('Nota Fiscal CANCELADA!');
      setSelectedNf(null);
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Erro ao cancelar a nota.', 'error');
    }
  };

  // Save changes to general tax details
  const [isSavingTaxConf, setIsSavingTaxConf] = useState(false);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [isUploadingCertificate, setIsUploadingCertificate] = useState(false);
  type A1CheckStatus = 'pending' | 'running' | 'passed' | 'failed';
  const initialA1Checks = [
    ['a1', 'A1 válido'], ['password', 'Senha correta'], ['validity', 'Certificado vigente'],
    ['cnpj', 'CNPJ compatível'], ['chain', 'Cadeia ICP-Brasil válida'],
    ['privateKey', 'Chave privada encontrada'], ['clientAuth', 'clientAuth válido'],
    ['mtls', 'mTLS aceito pela SEFIN'], ['dps', 'DPS local válida'],
    ['signature', 'XML assinado válido'],
  ] as const;
  const [a1Checks, setA1Checks] = useState<Record<string, { label: string; status: A1CheckStatus; detail?: string }>>(() => Object.fromEntries(initialA1Checks.map(([key, label]) => [key, { label, status: 'pending' }])));
  const [phase2Contract, setPhase2Contract] = useState<{ status: 'idle' | 'running' | 'ready' | 'blocked'; detail?: string; endpoint?: string; method?: string; contentType?: string; payloadProperties?: string[]; environment?: 'producao' | 'producao_restrita' }>({ status: 'idle' });
  const [phase3Result, setPhase3Result] = useState<{ status: 'idle' | 'running' | 'authorized' | 'rejected'; detail?: string; httpStatus?: number; code?: string | null; accessKey?: string | null }>({ status: 'idle' });
  const certificatePasswordInputRef = useRef<HTMLInputElement>(null);
  const certificateSessionRef = fiscalA1SessionRef;
  const authorizedReconciledRef = useRef(false);
  useEffect(() => {
    if (!isAdmin || loading || authorizedReconciledRef.current) return;
    authorizedReconciledRef.current = true;
    void fiscalApi.reconcileAuthorizedNfse().then(() => loadData()).catch(() => undefined);
  }, [isAdmin, loading]);
  const updateA1Check = (key: string, status: A1CheckStatus, detail?: string) => setA1Checks(previous => ({ ...previous, [key]: { ...previous[key], status, detail } }));
  const resetA1Checks = () => setA1Checks(Object.fromEntries(initialA1Checks.map(([key, label]) => [key, { label, status: 'pending' }])));
  const useValidatedProductionContractFallback = (error: unknown) => {
    const fiscalError = error as Error & { code?: string };
    const swaggerUnavailable = fiscalError?.code === 'SEFIN_SWAGGER_UNAVAILABLE' || /Swagger oficial indisponível.*HTTP 503/i.test(fiscalError?.message || '');
    if (activeFiscalEnvironment !== 'producao' || !swaggerUnavailable) return false;
    setPhase2Contract({
      status: 'ready',
      detail: 'SWAGGER: indisponível temporariamente — usando contrato oficial já validado',
      endpoint: 'https://sefin.nfse.gov.br/SefinNacional/nfse',
      method: 'POST',
      contentType: 'application/json',
      payloadProperties: ['dpsXmlGZipB64'],
      environment: 'producao',
    });
    return true;
  };
  const revalidatePhase2Contract = async () => {
    const credentials = certificateSessionRef.current;
    if (!credentials) return showToast('A sessão segura do A1 não está disponível.', 'error');
    setPhase2Contract({ status: 'running', detail: 'Consultando o contrato OpenAPI oficial via mTLS...' });
    try {
      const contract = await fiscalApi.discoverPhase2Contract(credentials);
      setPhase2Contract({ status: 'ready', detail: 'Contrato oficial confirmado. Nenhuma DPS foi transmitida.', endpoint: contract.endpoint, method: contract.method, contentType: contract.contentType, payloadProperties: contract.payloadProperties, environment: contract.environment });
    } catch (error) {
      if (!useValidatedProductionContractFallback(error)) setPhase2Contract({ status: 'blocked', detail: error instanceof Error ? error.message : 'Não foi possível confirmar o contrato oficial.' });
    }
  };
  const validateA1Credentials = async (common: Record<string, unknown>, mode: 'upload' | 'stored', displayName?: string) => {
    if (!configFiscal?.cnpj || !configFiscal.inscricaoMunicipal || !configFiscal.codigoServicoMunicipal) return showToast('Preencha CNPJ, Inscrição Municipal e Código do Serviço.', 'error');
    setIsUploadingCertificate(true);
    resetA1Checks();
    setPhase2Contract({ status: 'idle' });
    setPhase3Result({ status: 'idle' });
    let currentStep = 'a1';
    try {
      certificateSessionRef.current = common;
      updateA1Check('a1', 'running');
      const certificate = mode === 'stored'
        ? await fiscalApi.validateStoredCertificate(common)
        : await fiscalApi.validateCertificate(common);
      updateA1Check('a1', 'passed', 'PKCS#12 lido e validado.');
      updateA1Check('password', 'passed', 'Senha aceita pelo PKCS#12.');
      updateA1Check('validity', 'passed', `${certificate.validFrom} a ${certificate.validTo}`);
      updateA1Check('privateKey', certificate.hasPrivateKey ? 'passed' : 'failed', certificate.hasPrivateKey ? 'Chave privada presente.' : 'Chave privada ausente.');
      updateA1Check('cnpj', certificate.cnpjCompatible ? 'passed' : 'failed', certificate.cnpj ? `CNPJ identificado: ${certificate.cnpj}` : 'CNPJ não identificado.');
      updateA1Check('chain', certificate.chain?.valid ? 'passed' : 'failed', certificate.chain?.valid ? `Raiz: ${certificate.chain.rootAuthority}` : certificate.chain?.error);
      updateA1Check('clientAuth', certificate.clientAuthCapable ? 'passed' : 'failed', certificate.clientAuthCapable ? 'Uso de autenticação de cliente permitido.' : 'Uso clientAuth ausente.');
      currentStep = 'mtls'; updateA1Check('mtls', 'running');
      const mtls = await fiscalApi.testMtls(common);
      updateA1Check('mtls', mtls.accepted ? 'passed' : 'failed', mtls.accepted ? `HTTP ${mtls.statusCode}; ${mtls.tlsProtocol}; ${mtls.elapsedMs} ms.` : 'Certificado rejeitado no handshake.');
      const now = new Date();
      const offset = -now.getTimezoneOffset(); const sign = offset >= 0 ? '+' : '-'; const pad = (n:number) => String(Math.abs(Math.trunc(n))).padStart(2, '0');
      const issuedAt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${sign}${pad(offset/60)}:${pad(offset%60)}`;
      const nationalServiceCode = String(configFiscal.codigoServicoMunicipal).replace(/\D/g, '').padEnd(6, '0').slice(0, 6);
      const competenceDate = '2026-08-08';
      const dpsData = { series: '1', number: String(Date.now()).slice(-12), issuedAt, competenceDate, nationalServiceCode, nbs: configFiscal.nbs || undefined, serviceDescription: 'TESTE PRODUCAO RESTRITA - SEM VALIDADE FISCAL', serviceValue: '1.00', simpleNationalOption: '3' as const, simpleNationalTaxRegime: '1' as const, specialTaxRegime: '0', municipalRegistration: configFiscal.inscricaoMunicipal, companyName: configFiscal.razaoSocial };
      currentStep = 'dps'; updateA1Check('dps', 'running');
      const dps = await fiscalApi.signLocalDps({ ...common, dpsData });
      updateA1Check('dps', dps.xsdValidBeforeSignature && dps.xsdValidAfterSignature ? 'passed' : 'failed', `XSD antes: ${dps.xsdValidBeforeSignature ? 'OK' : 'falhou'}; depois: ${dps.xsdValidAfterSignature ? 'OK' : 'falhou'}.`);
      updateA1Check('signature', dps.signatureVerified ? 'passed' : 'failed', dps.signatureVerified ? 'XMLDSig verificada pela chave pública.' : 'Verificação XMLDSig falhou.');
      setPhase2Contract({ status: 'running', detail: 'Consultando o contrato OpenAPI oficial via mTLS...' });
      try {
        const contract = await fiscalApi.discoverPhase2Contract(common);
        setPhase2Contract({ status: 'ready', detail: 'Contrato oficial confirmado. Nenhuma DPS foi transmitida.', endpoint: contract.endpoint, method: contract.method, contentType: contract.contentType, payloadProperties: contract.payloadProperties, environment: contract.environment });
      } catch (phase2Error) {
        if (!useValidatedProductionContractFallback(phase2Error)) setPhase2Contract({ status: 'blocked', detail: phase2Error instanceof Error ? phase2Error.message : 'Não foi possível confirmar o contrato oficial.' });
      }
      setConfigFiscal(previous => previous ? { ...previous, certificadoDigitalNome: displayName || previous.certificadoDigitalNome || 'Certificado A1 salvo', certificadoVencimento: String(certificate.validTo || '').slice(0, 10) } : previous);
      showToast(`A1 validado. Cadeia ICP-Brasil: OK; mTLS HTTP ${mtls.statusCode || 'sem resposta'}; assinatura local: ${dps.signatureVerified ? 'OK' : 'falhou'}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao validar certificado.';
      if (currentStep === 'a1') { updateA1Check('a1', 'failed', message); updateA1Check('password', 'failed', message); }
      else updateA1Check(currentStep, 'failed', message);
      showToast(`Falha na etapa ${currentStep}: ${message}`, 'error');
    }
    finally { setCertificatePassword(''); setIsUploadingCertificate(false); }
  };
  const handleStoredCertificate = async () => {
    await validateA1Credentials({ useStoredCertificate: true, expectedCnpj: configFiscal?.cnpj || '' }, 'stored');
  };
  const handleCertificateFile = async (file?: File) => {
    if (!file) return;
    const password = certificatePasswordInputRef.current?.value ?? certificatePassword;
    if (!password) return showToast('Informe a senha do certificado A1 antes de selecionar o arquivo.', 'error');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(new Error('Falha ao ler certificado.')); reader.readAsDataURL(file);
      });
      await validateA1Credentials({ fileName: file.name, mimeType: file.type || 'application/x-pkcs12', certificateBase64: base64, password, expectedCnpj: configFiscal?.cnpj || '' }, 'upload', file.name);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao ler certificado.', 'error');
    }
  };
  const handleSaveFiscalConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSetConfig) {
      showToast('Apenas administradores podem modificar as configurações fiscais.', 'error');
      return;
    }
    if (!configFiscal) return;

    setIsSavingTaxConf(true);
    try {
      await databaseService.saveConfiguracaoFiscal(configFiscal);

      showToast('Configurações fiscais atualizadas com sucesso!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar parametrização fiscal.', 'error');
    } finally {
      setIsSavingTaxConf(false);
    }
  };

  // Filtering utilities
  const filteredNfe = nfeList.filter(n => {
    const matchesSearch = n.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (n.numeroNota || '').includes(searchTerm) ||
                          n.produtoNome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || n.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredNfse = nfseList.filter(n => {
    const matchesSearch = n.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          n.numeroNota.includes(searchTerm) || 
                          n.descricaoServico.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || n.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const recordFiscalOperationalAudit = async (
    action: 'consulta_nfse' | 'download_xml_nfse' | 'download_danfse_nfse' | 'impressao_nfse',
    nfs: NotaFiscalServico,
  ) => {
    try {
      const created = await databaseService.createFiscalAuditLog({
        userId: user.id,
        userName: user.nome,
        action,
        tipoDocumento: 'nfse',
        documentNumero: nfs.numeroNota || '',
        details: `NFS-e ${nfs.numeroNota || 'sem número'} · ${nfs.environment === 'producao' ? 'Produção Real' : 'Produção Restrita'} · chave final ${String(nfs.chaveAcessoOficial || nfs.chaveAcesso || nfs.reference || '').slice(-8) || 'n/a'}`,
      });
      setAuditLogs(previous => [created, ...previous]);
    } catch (error) {
      console.error('[Fiscal Audit] Não foi possível registrar a ação operacional.', error);
    }
  };

  const handleViewInvoice = (tipo: 'produto' | 'servico', data: NotaFiscalProduto | NotaFiscalServico) => {
    setSelectedNf({ tipo, data });
    if (tipo === 'servico') void recordFiscalOperationalAudit('consulta_nfse', data as NotaFiscalServico);
  };

  const openCancellationPreparation = (nfs: NotaFiscalServico) => {
    if (!canCancel) return showToast('Permissão fiscal insuficiente para preparar cancelamento.', 'error');
    if (nfs.environment !== 'producao') return showToast('Esta etapa prepara somente cancelamento em Produção Real.', 'error');
    if (!['AUTORIZADA', 'Autorizada'].includes(nfs.status)) return showToast('Somente NFS-e autorizada pode ser cancelada.', 'error');
    const accessKey = nfs.chaveAcessoOficial || nfs.chaveAcesso || nfs.reference;
    if (!accessKey || !/^\d{50}$/.test(accessKey)) return showToast('A NFS-e não possui chave oficial válida.', 'error');
    setCancellationNote(nfs);
    setCancellationReasonCode('1');
    setCancellationReason('');
    setCancellationConfirmed(false);
    setCancellationValidation(null);
  };

  const validateCancellationPreparation = async () => {
    if (!cancellationNote || isPreparingCancellation) return;
    if (!cancellationConfirmed) return showToast('Confirme que compreende o efeito fiscal futuro do cancelamento.', 'error');
    if (cancellationReason.trim().length < 15) return showToast('Informe um motivo com pelo menos 15 caracteres.', 'error');
    const credentials = certificateSessionRef.current;
    if (!credentials) return showToast('Valide o certificado A1 nesta sessão antes de preparar o evento.', 'error');
    const accessKey = cancellationNote.chaveAcessoOficial || cancellationNote.chaveAcesso || cancellationNote.reference || '';
    setIsPreparingCancellation(true);
    try {
      const result = await fiscalApi.prepareOfficialCancellation(accessKey, {
        ...credentials,
        expectedCnpj: configFiscal?.cnpj || '',
        reasonCode: cancellationReasonCode,
        reason: cancellationReason.trim(),
      });
      setCancellationValidation(result);
      showToast('Evento validado localmente. Nenhum cancelamento foi transmitido.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao validar o evento de cancelamento.', 'error');
    } finally {
      setIsPreparingCancellation(false);
    }
  };

  const executeOfficialCancellation = async () => {
    if (!cancellationNote || isPreparingCancellation || !cancellationValidation) return;
    const validationReady = cancellationValidation.xsdValidBeforeSignature === true
      && cancellationValidation.signatureVerified === true
      && cancellationValidation.xsdValidAfterSignature === true
      && cancellationValidation.gzipBase64Ready === true;
    if (!validationReady) return showToast('Cancelamento não transmitido: o checklist local não está integralmente aprovado.', 'error');
    const credentials = certificateSessionRef.current;
    if (!credentials) return showToast('A sessão segura do certificado A1 não está disponível.', 'error');
    const accessKey = cancellationNote.chaveAcessoOficial || cancellationNote.chaveAcesso || cancellationNote.reference || '';
    setIsPreparingCancellation(true);
    try {
      const result = await fiscalApi.executeOfficialCancellation(accessKey, { ...credentials, expectedCnpj: configFiscal?.cnpj || '', reasonCode: cancellationReasonCode, reason: cancellationReason.trim() });
      setNfseList(previous => previous.map(item => (item.chaveAcessoOficial || item.chaveAcesso || item.reference) === accessKey ? { ...item, status: 'CANCELADA', cancellationStatus: 'registered', cancellationEventId: result.eventId, cancellationProtocol: result.protocol } : item));
      showToast('Cancelamento confirmado oficialmente pela SEFIN.');
      setCancellationNote(null); setCancellationValidation(null);
    } catch (error) {
      const fiscalError = error as Error & { code?: string; data?: Record<string, unknown> };
      const attempted = fiscalError.data?.transmissionAttempted === true;
      const prefix = attempted ? 'POST iniciado' : 'POST não realizado';
      const technicalMessage = fiscalError instanceof Error ? fiscalError.message : 'Falha técnica no fluxo interno de cancelamento.';
      showToast(`${prefix}: ${technicalMessage}${fiscalError.code ? ` [${fiscalError.code}]` : ''}`, 'error');
    } finally { setIsPreparingCancellation(false); }
  };

  const reconcileOfficialCancellation = async () => {
    if (!cancellationNote || isReconcilingCancellation) return;
    if (!certificatePassword) return showToast('Informe a senha do A1 para a consulta oficial por mTLS.', 'error');
    const accessKey = cancellationNote.chaveAcessoOficial || cancellationNote.chaveAcesso || cancellationNote.reference || '';
    setIsReconcilingCancellation(true);
    try {
      const result = await fiscalApi.reconcileOfficialCancellation(accessKey, { password: certificatePassword, expectedCnpj: configFiscal?.cnpj || '' });
      if (result.officialStatus === 'CANCELADA') {
        setNfseList(previous => previous.map(item => (item.chaveAcessoOficial || item.chaveAcesso || item.reference) === accessKey ? { ...item, status: 'CANCELADA', cancellationStatus: 'registered', cancellationEventId: result.eventId, cancellationProtocol: result.protocol } : item));
        showToast('Cancelamento localizado e confirmado oficialmente pela SEFIN.');
      } else if (result.officialStatus === 'AUTORIZADA') showToast('NFS-e autorizada e nenhum E101101 localizado. Nova tentativa manual pode ser liberada.', 'info');
      else showToast('Consulta inconclusiva. O bloqueio de idempotência foi mantido.', 'error');
      // A conciliação consulta apenas o estado oficial. Ela não representa o
      // checklist criptográfico do XML e, portanto, não deve marcar as quatro
      // validações locais como erro por ausência desses campos.
      setCancellationValidation(null);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Falha na conciliação oficial.', 'error'); }
    finally { setIsReconcilingCancellation(false); }
  };

  const handleDownloadAuthorizedXml = async (nfs: NotaFiscalServico) => {
    const accessKey = nfs.chaveAcessoOficial || nfs.chaveAcesso || nfs.reference || nfs.codigoVerificacao;
    if (!accessKey) return showToast('Esta NFS-e não possui chave de acesso.', 'error');
    try { await fiscalApi.downloadAuthorizedXml(accessKey); await recordFiscalOperationalAudit('download_xml_nfse', nfs); showToast('XML autorizado baixado com sucesso.'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Falha ao baixar XML.', 'error'); }
  };

  const danfseAccessKey = (nfs: NotaFiscalServico) => nfs.chaveAcessoOficial || nfs.chaveAcesso || nfs.reference || nfs.codigoVerificacao || '';

  const handleViewDanfse = async (nfs: NotaFiscalServico) => {
    const accessKey = danfseAccessKey(nfs);
    if (!accessKey) return showToast('Esta NFS-e não possui chave de acesso.', 'error');
    setIsPreparingDanfse(true);
    try {
      const file = await fiscalApi.prepareDanfseV2(accessKey);
      if (danfsePreview?.url) URL.revokeObjectURL(danfsePreview.url);
      setDanfsePreview({ url: URL.createObjectURL(file.blob), fileName: file.fileName, nfs });
      await recordFiscalOperationalAudit('consulta_nfse', nfs);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Falha ao gerar DANFSe.', 'error'); }
    finally { setIsPreparingDanfse(false); }
  };

  const handleDownloadDanfse = async (nfs: NotaFiscalServico) => {
    const accessKey = nfs.chaveAcessoOficial || nfs.chaveAcesso || nfs.reference || nfs.codigoVerificacao;
    if (!accessKey) return showToast('Esta NFS-e não possui chave de acesso.', 'error');
    try { await fiscalApi.downloadDanfseV2(accessKey); await recordFiscalOperationalAudit('download_danfse_nfse', nfs); showToast('DANFSe v2.0 baixado com sucesso.'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Falha ao baixar DANFSe.', 'error'); }
  };

  const handlePrintDanfse = async (nfs: NotaFiscalServico) => {
    const accessKey = danfseAccessKey(nfs);
    if (!accessKey) return showToast('Esta NFS-e não possui chave de acesso.', 'error');
    const popup = window.open('', '_blank');
    if (!popup) return showToast('Permita a abertura da janela de impressão.', 'error');
    popup.document.body.textContent = 'Preparando DANFSe v2.0...';
    try {
      const file = await fiscalApi.prepareDanfseV2(accessKey); const url = URL.createObjectURL(file.blob);
      popup.location.href = url;
      popup.addEventListener('load', () => { popup.focus(); popup.print(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }, { once: true });
      await recordFiscalOperationalAudit('impressao_nfse', nfs);
    } catch (error) { popup.close(); showToast(error instanceof Error ? error.message : 'Falha ao imprimir DANFSe.', 'error'); }
  };

  const filteredBoletos = boletos.filter(b => {
    const matchesSearch = b.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          b.nossoNumero.includes(searchTerm);
    const matchesStatus = statusFilter === 'todos' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate high level metrics
  const totalFaturamentoServicos = nfseList.filter(n => n.status === 'AUTORIZADA' || n.status === 'Autorizada').reduce((acc, cr) => acc + cr.valorServico, 0);
  const totalFaturamentoProdutos = nfeList.filter(n => n.status === 'Autorizada').reduce((acc, cr) => acc + cr.valorProduto, 0);
  const totalFaturamentoGeral = totalFaturamentoServicos + totalFaturamentoProdutos;

  const totalBoletosEmitidos = boletos.length;
  const totalBoletosPagos = boletos.filter(b => b.status === 'Pago').reduce((acc, cr) => acc + cr.valorCobrado, 0);
  const totalBoletosVencidos = boletos.filter(b => b.status === 'Vencido').reduce((acc, cr) => acc + cr.valorCobrado, 0);
  const totalBoletosPendentes = boletos.filter(b => b.status === 'Pendente').reduce((acc, cr) => acc + cr.valorCobrado, 0);

  return (
    <div className="bg-slate-50 min-h-screen relative p-1 pb-16">
      {/* Toast Alert Popups */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold uppercase tracking-wider animate-bounce ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
          toast.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
          'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          {toast.type === 'success' && <CheckCircle className="text-emerald-600" size={16} />}
          {toast.type === 'error' && <XCircle className="text-rose-600" size={16} />}
          {toast.type === 'info' && <AlertCircle className="text-blue-600" size={16} />}
          {toast.message}
        </div>
      )}

      {danfsePreview && <div className="fixed inset-0 z-[190] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Visualizar DANFSe v2.0"><div className="flex h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-4 py-3"><div><h3 className="font-bold text-slate-900">DANFSe v2.0 · NFS-e {danfsePreview.nfs.numeroNota}</h3><p className="text-xs text-slate-500">Gerado exclusivamente do XML autorizado · NT 008/2026 v1.02</p></div><div className="flex gap-2"><button onClick={() => void handlePrintDanfse(danfsePreview.nfs)} className="rounded-lg border px-3 py-2 text-xs font-bold"><Printer size={14} className="inline mr-1"/>IMPRIMIR</button><button onClick={() => void handleDownloadDanfse(danfsePreview.nfs)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white"><Download size={14} className="inline mr-1"/>BAIXAR PDF</button><button onClick={() => setDanfsePreview(null)} className="rounded-lg border px-3 py-2 text-xs font-bold">FECHAR</button></div></div><iframe title={danfsePreview.fileName} src={danfsePreview.url} className="h-full w-full bg-slate-100" /></div></div>}

      {/* Main Fiscal Tab Row switcher */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="text-blue-600" size={20} />
              Central de Faturamento & Gestão Fiscal
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">MÓDULO ATUAL: NOTA FISCAL DE SERVIÇO · NF-e DE PRODUTOS AINDA NÃO IMPLEMENTADA</p>
            <div className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black tracking-wider ${activeFiscalEnvironment === 'producao' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : activeFiscalEnvironment === 'producao_restrita' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              AMBIENTE ATUAL: {activeFiscalEnvironment === 'producao' ? 'PRODUÇÃO REAL' : activeFiscalEnvironment === 'producao_restrita' ? 'PRODUÇÃO RESTRITA' : 'NÃO IDENTIFICADO'}
            </div>
          </div>
          <div className="flex items-center gap-2 self-start md:self-center">
            {canEmit && (
              <>
                <button 
                  onClick={() => {
                    setNfseForm({ ...nfseForm, clienteId: '', valorServico: 0, emitirBoleto: false });
                    setIsNfseModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <Plus size={14} /> NOVA NFS-E — SERVIÇO
                </button>
              </>
            )}
          </div>
        </div>

        {/* Nested Nav Tabs */}
        <div className="flex border-b border-slate-100 overflow-x-auto gap-1">
          {[
            { id: 'nfe', label: 'Notas Fiscais (NF-e)', icon: FileText },
            { id: 'nfse', label: 'Notas de Serviço (NFS-e)', icon: Clock },
            { id: 'boletos', label: 'Boletos', icon: CreditCard },
            { id: 'contas', label: 'Integrações Bancárias', icon: Building2 },
            { id: 'config', label: 'Configurações Fiscais', icon: Settings },
            { id: 'relatorios', label: 'Relatórios', icon: BarChart2 },
            { id: 'auditoria', label: 'Histórico e Auditoria', icon: Shield }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id as any);
                  setSearchTerm('');
                  setStatusFilter('todos');
                }}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer ${
                  activeSubTab === tab.id 
                    ? 'border-blue-600 text-blue-600 font-extrabold' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-4 animate-pulse">
            Carregando Painel Fiscal...
          </span>
        </div>
      ) : (
        <>
          {/* ================= 1. tab RELATORIOS ================= */}
          {activeSubTab === 'relatorios' && (
            <div className="space-y-6">
              {/* Financial Bento Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Faturamento Consolidado</span>
                    <h3 className="text-xl font-extrabold text-slate-800 mt-1">
                      R$ {totalFaturamentoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-0.5">
                      <ArrowUpRight size={12} /> +12.4% vs mês anterior
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <DollarSign size={20} />
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Boletos Liquidados</span>
                    <h3 className="text-xl font-extrabold text-emerald-700 mt-1">
                      R$ {totalBoletosPagos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Da carteira total cobrada
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <CheckCircle size={20} />
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Boletos em Aberto</span>
                    <h3 className="text-xl font-extrabold text-amber-700 mt-1">
                      R$ {totalBoletosPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Aguardando vencimento
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <Clock size={20} />
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Valores Vencidos</span>
                    <h3 className="text-xl font-extrabold text-rose-700 mt-1">
                      R$ {totalBoletosVencidos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[10px] text-rose-500 font-bold mt-1">
                     Necessita renegociação
                    </p>
                  </div>
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                    <AlertCircle size={20} />
                  </div>
                </div>
              </div>

              {/* Sub-Analytics splitting: Products vs Services */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sector Performance */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">Faturamento por Categoria</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                        <span>Manutenção & Suporte Técnico (Prestação)</span>
                        <span>R$ {totalFaturamentoServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${totalFaturamentoGeral > 0 ? (totalFaturamentoServicos / totalFaturamentoGeral)*100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                        <span>Venda de Equipamentos & Produtos Físicos</span>
                        <span>R$ {totalFaturamentoProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-sky-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${totalFaturamentoGeral > 0 ? (totalFaturamentoProdutos / totalFaturamentoGeral)*100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Notas NFS-e Ativas</span>
                      <strong className="text-sm font-extrabold text-indigo-700">{nfseList.filter(n => n.status === 'AUTORIZADA' || n.status === 'Autorizada').length}</strong>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Notas NF-e Ativas</span>
                      <strong className="text-sm font-extrabold text-sky-700">{nfeList.filter(n=>n.status==='Autorizada').length}</strong>
                    </div>
                  </div>
                </div>

                {/* API Integrations Status Check */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Conexões Sincronizadas & APIs</h4>
                    <p className="text-xs text-slate-400 mb-4">
                      Monitore e configure gateways para transmissão direta de arquivos fiscais XML e baixas de boletos bancários.
                    </p>
                    
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                        <span className="text-xs font-bold text-slate-700">Prefeitura NFS-e Automática</span>
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase text-amber-800 bg-amber-100 border border-amber-200 rounded-md">
                          PRONTO PARA ATIVAÇÃO
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                        <span className="text-xs font-bold text-slate-700">Gateway ASAAS Cobranças</span>
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-md flex items-center gap-0.5">
                          <Zap size={10} /> CONECTADO
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                        <span className="text-xs font-bold text-slate-700">Painel Sefaz NF-e Estadual</span>
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-md flex items-center gap-0.5">
                          <Zap size={10} /> HOMOLOGAÇÃO
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Shield className="text-blue-600" size={13} strokeWidth={2.5} />
                      Ambiente Criptografado SSL
                    </span>
                    <button 
                      onClick={() => setActiveSubTab('config')}
                      className="text-xs text-blue-600 hover:underline font-bold"
                    >
                      Configurar Chaves
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= 2. tab NFE (PRODUTOS) ================= */}
          {activeSubTab === 'nfe' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/40">
                <div className="relative flex-1 max-w-sm">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search por cliente, número ou equipamento..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <ListFilter size={14} className="text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="border border-slate-200 rounded-xl py-1 px-3 text-xs text-slate-600 focus:ring-1 bg-white"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="Autorizada">Autorizada</option>
                    <option value="Rascunho">Rascunho</option>
                    <option value="Cancelada">Cancelada</option>
                    <option value="Rejeitada">Rejeitada</option>
                  </select>

                  <button
                    onClick={() => {
                      if (!canImportXML) {
                        showToast('Você não tem permissão para importar XML. Solicite ao administrador.', 'error');
                        return;
                      }
                      setXmlTypeFilter('nfe');
                      setParsedInvoice(null);
                      setXmlTextContent('');
                      setIsImportXmlModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-colors ml-1 cursor-pointer"
                  >
                    <Upload size={13} /> Importar XML
                  </button>
                </div>
              </div>

              {filteredNfe.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <p className="text-xs font-bold uppercase tracking-wider">Nenhuma NF-e encontrada</p>
                  <p className="text-[11px] text-slate-400 mt-1">Sua busca não retornou resultados ou não há notas emitidas neste filtro.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        <th className="p-3">Série/Número</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Item Vendido</th>
                        <th className="p-3">Valor da Nota</th>
                        <th className="p-3">Emissão</th>
                        <th className="p-3">Chave de Acesso</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredNfe.map(nf => (
                        <tr key={nf.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-700">
                            {nf.serie}/{nf.numeroNota}
                          </td>
                          <td className="p-3">
                            <span className="font-bold block text-slate-800">{nf.clienteNome}</span>
                            <span className="text-[10px] text-slate-400">{nf.cnpjCpf}</span>
                          </td>
                          <td className="p-3 text-slate-600">
                            {nf.produtoNome}
                          </td>
                          <td className="p-3 font-semibold text-slate-700">
                            R$ {(nf.valorProduto + (nf.frete || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-slate-500">
                            {nf.dataEmissao}
                          </td>
                          <td className="p-3 font-mono text-[9px] text-slate-400 max-w-[120px] truncate">
                            {nf.chaveAcesso || '-'}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                              nf.status === 'Autorizada' ? 'bg-emerald-50 text-emerald-700' :
                              nf.status === 'Cancelada' ? 'bg-rose-50 text-rose-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {nf.status}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button 
                              onClick={() => setSelectedNf({ tipo: 'produto', data: nf })}
                              className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded"
                              title="Visualizar Detalhes"
                            >
                              <Search size={14} />
                            </button>
                            {canCancel && nf.status === 'Autorizada' && (
                              <button 
                                onClick={() => handleCancelInvoice(nf.id, 'produto')}
                                className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                title="Cancelar Nota"
                              >
                                <XCircle size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================= 3. tab NFSE (SERVIÇOS) ================= */}
          {activeSubTab === 'nfse' && (
            <div>
              <RecurringBillingQueue user={user} contracts={contracts} clients={clientes} config={configFiscal} credentialsRef={certificateSessionRef} environment={activeFiscalEnvironment || 'producao_restrita'} onCompleted={() => void loadData()} />
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/40">
                <div className="relative flex-1 max-w-sm">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search por cliente, serviço prestado ou nota..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <ListFilter size={14} className="text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="border border-slate-200 rounded-xl py-1 px-3 text-xs text-slate-600 focus:ring-1 bg-white"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="Autorizada">Autorizada</option>
                    <option value="Rascunho">Rascunho</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>

                  <button
                    onClick={() => {
                      if (!canImportXML) {
                        showToast('Você não tem permissão para importar XML. Solicite ao administrador.', 'error');
                        return;
                      }
                      setXmlTypeFilter('nfse');
                      setParsedInvoice(null);
                      setXmlTextContent('');
                      setIsImportXmlModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-colors ml-1 cursor-pointer"
                  >
                    <Upload size={13} /> Importar XML
                  </button>
                </div>
              </div>

              {filteredNfse.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <p className="text-xs font-bold uppercase tracking-wider">Nenhuma NFS-e cadastrada</p>
                  <p className="text-[11px] text-slate-400 mt-1">Não constam faturamentos de serviço emitidos.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        <th className="p-3">Num. NFS-e</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Descrição do Faturamento</th>
                        <th className="p-3">Valor de Serviço</th>
                        <th className="p-3">ISS Estimado</th>
                        <th className="p-3">Data Competência</th>
                        <th className="p-3">Ambiente</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredNfse.map(nfs => (
                        <tr key={nfs.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-700">
                            {nfs.numeroNota}
                          </td>
                          <td className="p-3">
                            <span className="font-bold block text-slate-800">{nfs.clienteNome}</span>
                            <span className="text-[10px] text-slate-400">Cod. Ibge: {nfs.municipioPrestacao}</span>
                          </td>
                          <td className="p-3 text-slate-600 italic">
                            {nfs.descricaoServico}
                          </td>
                          <td className="p-3 font-semibold text-slate-700">
                            R$ {nfs.valorServico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-slate-500">
                            R$ {(nfs.valorServico * (nfs.iss / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({nfs.iss}%)
                          </td>
                          <td className="p-3 text-slate-500 font-mono">
                            {nfs.dataCompetencia}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${nfs.environment === 'producao' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                              {nfs.environment === 'producao' ? 'Produção Real' : 'Produção Restrita'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                              (nfs.status === 'AUTORIZADA' || nfs.status === 'Autorizada') ? 'bg-emerald-50 text-emerald-700' :
                              nfs.status === 'Cancelada' ? 'bg-rose-50 text-rose-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {nfs.status}
                            </span>
                          </td>
                          <td className="p-3"><div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button 
                              onClick={() => handleViewInvoice('servico', nfs)}
                              title="Visualizar NFS-e"
                              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                            >
                              <Search size={13} /> Visualizar
                            </button>
                            {(nfs.status === 'AUTORIZADA' || nfs.status === 'Autorizada') && nfs.danfseAvailable && (
                              <>
                                <button onClick={() => void handleViewDanfse(nfs)} disabled={isPreparingDanfse} title="Visualizar DANFSe" className="inline-flex items-center gap-1 rounded border border-indigo-200 px-2 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"><FileText size={13} /> DANFSe</button>
                                <button onClick={() => void handlePrintDanfse(nfs)} title="Imprimir DANFSe" className="inline-flex items-center gap-1 rounded border border-violet-200 px-2 py-1 text-[10px] font-bold text-violet-600 hover:bg-violet-50"><Printer size={13} /> Imprimir</button>
                              </>
                            )}
                            {(nfs.status === 'AUTORIZADA' || nfs.status === 'Autorizada') && nfs.xmlAvailable && (
                              <button onClick={() => void handleDownloadAuthorizedXml(nfs)} title="Baixar XML autorizado" className="inline-flex items-center gap-1 rounded border border-blue-200 px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50"><Download size={13} /> XML</button>
                            )}
                            {canCancel && nfs.environment === 'producao' && (nfs.status === 'AUTORIZADA' || nfs.status === 'Autorizada') && (
                              <button
                                type="button"
                                onClick={() => openCancellationPreparation(nfs)}
                                title="Preparar cancelamento oficial"
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                              >
                                <XCircle size={14} />
                              </button>
                            )}
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div></div>
          )}

          {/* ================= 4. tab BOLETOS ================= */}
          {activeSubTab === 'boletos' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/40">
                <div className="relative flex-1 max-w-sm">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Filtrar por nome do cliente ou número..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <ListFilter size={14} className="text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="border border-slate-200 rounded-xl py-1 px-3 text-xs text-slate-600 focus:ring-1 bg-white"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="Pendente">Abertos (Pendentes)</option>
                    <option value="Pago">Marcado como Pago</option>
                    <option value="Vencido">Inadimplentes Vencidos</option>
                    <option value="Cancelado">Cancelados</option>
                  </select>
                </div>
              </div>

              {filteredBoletos.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <p className="text-xs font-bold uppercase tracking-wider">Nenhum boleto gerado</p>
                  <p className="text-[11px] text-slate-400 mt-1">Utilize as opções de faturamento acima para emitir faturas de teste.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        <th className="p-3">Nosso Número</th>
                        <th className="p-3">Banco / Convênio</th>
                        <th className="p-3">Cliente Destinatário</th>
                        <th className="p-3">Vencimento</th>
                        <th className="p-3">Valor Cobrado</th>
                        <th className="p-3">Multas & Juros</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredBoletos.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-700">
                            {b.nossoNumero}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800">{b.bancoNome}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block">{b.clienteNome}</span>
                            <span className="text-[10px] text-slate-400">Origem: {b.documentoOrigemTipo} #{b.documentoOrigemId.substring(0, 8)}...</span>
                          </td>
                          <td className="p-3 text-slate-500 font-mono">
                            {b.vencimento}
                          </td>
                          <td className="p-3 font-semibold text-slate-800">
                            R$ {b.valorCobrado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-[11px] text-slate-500">
                            Juros: {b.juros}% | Multa: {b.multa}%
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                              b.status === 'Pago' ? 'bg-emerald-50 text-emerald-700' :
                              b.status === 'Vencido' ? 'bg-rose-50 text-rose-700' :
                              b.status === 'Cancelado' ? 'bg-slate-100 text-slate-500 line-through' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-1.5">
                            <button 
                              onClick={() => setSelectedBoleto(b)}
                              className="p-1 px-2.5 py-1 text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:text-slate-800 hover:bg-slate-100 text-[10px]"
                              title="Segunda Via"
                            >
                              2ª Via / Visualizar
                            </button>
                            {canCancel && b.status === 'Pendente' && (
                              <button 
                                onClick={() => handleClearBoleto(b.id)}
                                className="px-2 py-1 bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-200 hover:bg-emerald-100 transition-colors rounded-lg text-[10px]"
                                title="Liquidar Manualmente"
                              >
                                Baixa
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================= 5. tab INTEGRACAO BANCOS ================= */}
          {activeSubTab === 'contas' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bank Integration Form & status list */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Contas Ativas para Emissão via API</h4>
                    {canSetConfig && (
                      <button 
                        onClick={() => setIsAccountModalOpen(true)}
                        className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase transition-colors"
                      >
                        <Plus size={12} /> Adicionar Conta
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {contasBancarias.map(account => (
                      <div key={account.id} className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-300 transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-800">{account.nomeIdentificador}</span>
                            {account.ativo && (
                              <span className="px-1.5 py-0.5 text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
                                Padrao Emissao
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1 gap-x-4 mt-2 text-[11px] text-slate-500">
                            <p><b>Banco:</b> {account.banco}</p>
                            <p><b>Agência:</b> {account.agencia}</p>
                            <p><b>Conta:</b> {account.conta}</p>
                            <p><b>Carteira/Convênio:</b> {account.carteira || '-'} / {account.convenio || 'Sem credenciais'}</p>
                            <p><b>Juros padrão:</b> {account.jurosPadrao}% pm</p>
                            <p><b>Multa:</b> {account.multaPadrao}%</p>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 italic">
                          ID: #{account.id.substring(0,6)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Integration partners setups */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-705 mb-3">Módulos Logísticos e ERP de Apoio</h4>
                    <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                      Conecte e envie seus dados automaticamente para ERPs parceiros na emissão para manter o inventário e fiscal sincronizados de fato.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 transition-colors">
                        <div>
                          <p className="text-xs font-bold text-slate-700">Integração Bling</p>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Sincroniza estoque de produtos</span>
                        </div>
                        <button className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-100">
                          Configurar
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 transition-colors">
                        <div>
                          <p className="text-xs font-bold text-slate-700">PlugNotas / Tecnolíngua</p>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Transmissora em massa de notas</span>
                        </div>
                        <button className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-lg border border-amber-100">
                          Homologar
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 transition-colors">
                        <div>
                          <p className="text-xs font-bold text-slate-700">SEFIN Nacional</p>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Produção Restrita · Fase 1 técnica</span>
                        </div>
                        <button className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200">
                          Inativo
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400">
                    *Integração fiscal direta com a SEFIN Nacional; produção real permanece bloqueada.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= 6. tab CERTIFICADO & CONFIG FISCAIS ================= */}
          {activeSubTab === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {configFiscal && (
                <form onSubmit={handleSaveFiscalConfig} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">Parametrização Fiscal Governamental</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Razão Social Emissora</label>
                      <input 
                        type="text" 
                        value={configFiscal.razaoSocial}
                        onChange={e => setConfigFiscal({...configFiscal, razaoSocial: e.target.value})}
                        disabled={!canSetConfig}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 focus:ring-1 bg-slate-50/50 focus:bg-white"
                        required
                      />
                    </div>
                    <div><label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Município emissor</label><input value={configFiscal.municipio || ''} onChange={e => setConfigFiscal({...configFiscal, municipio:e.target.value})} disabled={!canSetConfig} required className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5" /></div>
                    <div><label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Código IBGE</label><input value={configFiscal.codigoIbge || ''} onChange={e => setConfigFiscal({...configFiscal, codigoIbge:e.target.value})} disabled={!canSetConfig} required maxLength={7} className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5" /></div>
                    <div><label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Código serviço municipal</label><input value={configFiscal.codigoServicoMunicipal || ''} onChange={e => setConfigFiscal({...configFiscal, codigoServicoMunicipal:e.target.value})} disabled={!canSetConfig} className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5" /></div>
                    <div><label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Item LC 116</label><input value={configFiscal.itemListaServico || ''} onChange={e => setConfigFiscal({...configFiscal, itemListaServico:e.target.value})} disabled={!canSetConfig} className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5" /></div>
                    <div><label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">CNAE</label><input value={configFiscal.cnae || ''} onChange={e => setConfigFiscal({...configFiscal, cnae:e.target.value})} disabled={!canSetConfig} className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5" /></div>
                    <div><label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">NBS (quando aplicável)</label><input value={configFiscal.nbs || ''} onChange={e => setConfigFiscal({...configFiscal, nbs:e.target.value.replace(/\D/g, '').slice(0,9)})} disabled={!canSetConfig} inputMode="numeric" maxLength={9} className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5" /></div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">CNPJ do Beneficiário</label>
                      <input 
                        type="text" 
                        value={configFiscal.cnpj}
                        onChange={e => setConfigFiscal({...configFiscal, cnpj: e.target.value})}
                        disabled={!canSetConfig}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 focus:ring-1 bg-slate-50/50"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Inscrição Estadual (I.E)</label>
                      <input 
                        type="text" 
                        value={configFiscal.inscricaoEstadual}
                        onChange={e => setConfigFiscal({...configFiscal, inscricaoEstadual: e.target.value})}
                        disabled={!canSetConfig}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 focus:ring-1"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Inscrição Municipal (I.M)</label>
                      <input 
                        type="text" 
                        value={configFiscal.inscricaoMunicipal || ''}
                        onChange={e => setConfigFiscal({...configFiscal, inscricaoMunicipal: e.target.value})}
                        disabled={!canSetConfig}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 focus:ring-1"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Regime Tributário</label>
                      <select 
                        value={configFiscal.regimeTributario}
                        onChange={e => setConfigFiscal({...configFiscal, regimeTributario: e.target.value as any})}
                        disabled={!canSetConfig}
                        className="w-full text-xs border border-slate-200 bg-white rounded-xl px-3 py-1.5 focus:ring-1"
                      >
                        <option value="Simples Nacional">Simples Nacional (ME/EPP)</option>
                        <option value="Lucro Presumido">Lucro Presumido (Retenções na fonte)</option>
                        <option value="Lucro Real">Lucro Real</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Situação oficial no Simples — competência</label>
                      <select
                        value={configFiscal.situacaoSimplesNacional || ''}
                        onChange={e => setConfigFiscal({ ...configFiscal, situacaoSimplesNacional: (e.target.value || undefined) as ConfiguracaoFiscal['situacaoSimplesNacional'] })}
                        disabled={!canSetConfig}
                        className="w-full text-xs border border-slate-200 bg-white rounded-xl px-3 py-1.5 focus:ring-1"
                      >
                        <option value="">Selecione após consulta oficial</option>
                        <option value="1">1 — Não Optante</option>
                        <option value="2">2 — Optante MEI</option>
                        <option value="3">3 — Optante ME/EPP</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Mês da situação oficial</label>
                      <input
                        type="month"
                        value={configFiscal.situacaoSimplesNacionalCompetencia || ''}
                        onChange={e => setConfigFiscal({ ...configFiscal, situacaoSimplesNacionalCompetencia: e.target.value })}
                        disabled={!canSetConfig}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 focus:ring-1"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Fonte da confirmação oficial</label>
                      <input
                        value={configFiscal.situacaoSimplesNacionalFonte || ''}
                        onChange={e => setConfigFiscal({ ...configFiscal, situacaoSimplesNacionalFonte: e.target.value })}
                        disabled={!canSetConfig}
                        placeholder="Ex.: consulta oficial do Simples Nacional/CNC"
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 focus:ring-1"
                      />
                      <p className="text-[10px] text-amber-700 mt-1">Este valor é mensal e não é inferido automaticamente pelo regime tributário visual.</p>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Alíquota ISS Estimado (%)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={configFiscal.aliquotaSimplesPadrao || 0}
                        onChange={e => setConfigFiscal({...configFiscal, aliquotaSimplesPadrao: Number(e.target.value)})}
                        disabled={!canSetConfig}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 focus:ring-1"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Shield className="text-blue-600" size={14} />
                        Certificado Digital (A1 / Token)
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Utilizado para assinar XML e efetuar conexão autenticada.
                      </p>
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded block mt-2 w-max">
                        CADASTRADO: {configFiscal.certificadoDigitalNome || 'Nenhum certificado ativo'}
                      </span>
                    </div>
                    {canSetConfig && (
                      <div className="space-y-2">
                        <input ref={certificatePasswordInputRef} type="password" value={certificatePassword} onChange={e => setCertificatePassword(e.target.value)} placeholder="Senha (somente no primeiro cadastro)" autoComplete="new-password" className="block w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5" />
                        {configFiscal.certificadoDigitalNome && (
                          <button type="button" disabled={isUploadingCertificate} onClick={() => void handleStoredCertificate()} className="block w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold uppercase rounded-lg tracking-wider text-center">
                            {isUploadingCertificate ? 'Validando certificado...' : 'Usar certificado salvo'}
                          </button>
                        )}
                        <label className="block px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase rounded-lg tracking-wider text-center cursor-pointer">{isUploadingCertificate ? 'Aguarde...' : 'Substituir Certificado'}<input type="file" accept=".pfx,.p12,application/x-pkcs12" disabled={isUploadingCertificate} onChange={e => { void handleCertificateFile(e.target.files?.[0]); e.currentTarget.value=''; }} className="hidden" /></label>
                        {configFiscal.certificadoDigitalNome && <p className="text-[10px] text-slate-500">O A1 e sua senha protegida ficam no cofre privado do serviço fiscal. Não é necessário digitá-la novamente.</p>}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-live="polite">
                    {Object.entries(a1Checks).map(([key, check]) => (
                      <div key={key} className={`rounded-lg border px-3 py-2 text-[11px] ${check.status === 'passed' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : check.status === 'failed' ? 'border-red-200 bg-red-50 text-red-800' : check.status === 'running' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                        <div className="font-bold">{check.status === 'passed' ? '✓' : check.status === 'failed' ? '✕' : check.status === 'running' ? '…' : '○'} {check.label}</div>
                        {check.detail && <div className="mt-1 break-words opacity-80">{check.detail}</div>}
                      </div>
                    ))}
                  </div>

                  <div className={`rounded-xl border px-4 py-3 text-[11px] ${phase2Contract.status === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : phase2Contract.status === 'blocked' ? 'border-amber-200 bg-amber-50 text-amber-900' : phase2Contract.status === 'running' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <div className="font-black uppercase">Fase 2 — Contrato SEFIN {phase2Contract.environment === 'producao' ? 'Produção Real' : phase2Contract.environment === 'producao_restrita' ? 'Produção Restrita' : 'Ambiente ativo'}</div>
                    <div className="mt-1">{phase2Contract.detail || 'Aguardando validação autenticada do A1.'}</div>
                    {phase2Contract.endpoint && <div className="mt-2 font-mono break-all">{phase2Contract.method} {phase2Contract.endpoint}</div>}
                    {phase2Contract.contentType && <div>Content-Type: {phase2Contract.contentType}</div>}
                    {phase2Contract.payloadProperties?.length ? <div>Payload oficial: {phase2Contract.payloadProperties.join(', ')}</div> : null}
                    {phase2Contract.status !== 'running' && certificateSessionRef.current && (
                      <button type="button" onClick={() => void revalidatePhase2Contract()} className="mt-2 rounded-lg border border-current px-3 py-1.5 font-bold">
                        Revalidar contrato oficial
                      </button>
                    )}
                  </div>
                  <div className={`rounded-xl border px-4 py-3 text-[11px] ${phase3Result.status === 'authorized' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : phase3Result.status === 'rejected' ? 'border-red-200 bg-red-50 text-red-800' : phase3Result.status === 'running' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <div className="font-black uppercase">Fase 3 — Primeira transmissão restrita</div>
                    <div className="mt-1">{phase3Result.detail || 'Aguardando execução autorizada.'}</div>
                    {phase3Result.httpStatus ? <div>HTTP {phase3Result.httpStatus}{phase3Result.code ? ` · ${phase3Result.code}` : ''}</div> : null}
                    {phase3Result.accessKey ? <div className="font-mono break-all">Chave: {phase3Result.accessKey}</div> : null}
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button 
                      type="submit"
                      disabled={isSavingTaxConf || !canSetConfig}
                      className="px-4 py-2 bg-blue-600 col-span-2 disabled:bg-blue-300 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase transition-colors"
                    >
                      {isSavingTaxConf ? 'Gravando Alterações...' : 'Salvar Regras Tributárias'}
                    </button>
                  </div>
                </form>
              )}

              {/* Informação do Ambiente */}
              <div className="bg-white p-5 rounded-2xl border border-slate-202 shadow-xs space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Segurança & Auditoria</h4>
                <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${activeFiscalEnvironment === 'producao' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                  <p className="font-extrabold flex items-center gap-1">
                    <Sliders size={12} /> Nota de Compliance Técnico:
                  </p>
                  <p>{activeFiscalEnvironment === 'producao'
                    ? 'AMBIENTE DE PRODUÇÃO REAL. As NFS-e autorizadas pela SEFIN neste ambiente possuem validade fiscal. Confira os dados antes da transmissão.'
                    : activeFiscalEnvironment === 'producao_restrita'
                      ? 'AMBIENTE DE TESTES / PRODUÇÃO RESTRITA. As emissões realizadas neste ambiente não possuem validade fiscal.'
                      : 'AMBIENTE FISCAL NÃO IDENTIFICADO. Não transmita documentos até confirmar o ambiente ativo.'}
                  </p>
                </div>

                <div className="text-xs space-y-2">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Histórico de ações fiscais do usuário:</p>
                  <div className="space-y-1.5 text-[10px]">
                    <p className="p-2 border-b border-slate-100 text-slate-500">
                      <b>• {user.nome}</b> carregou o Painel Fiscal consolidado.
                    </p>
                    <p className="p-2 border-b border-slate-100 text-slate-500">
                      <b>• {user.nome}</b> consultou o ambiente de teste SEFAZ SP. Status: OK.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= 7. tab HISTORICO E AUDITORIA ================= */}
          {activeSubTab === 'auditoria' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Trilha de Auditoria & Compliance Fiscal</h3>
                  <p className="text-[11px] text-slate-400">Rastreamento inalterável de todas as ações de emissão, cancelamento e parametrização fiscal</p>
                </div>
                <div className="flex gap-2 font-semibold">
                  <button 
                    onClick={() => {
                      const headers = ['ID', 'Data/Hora', 'Usuário', 'Ação', 'Detalhamento', 'Documento'];
                      const rows = auditLogs.map(log => [
                        log.id,
                        log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : 'Agora',
                        log.userName,
                        log.action,
                        log.details,
                        log.documentNumero || 'N/A'
                      ]);
                      const csvContent = "data:text/csv;charset=utf-8," 
                        + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `auditoria_fiscal_${new Date().toISOString().split('T')[0]}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                  >
                    <Download size={13} /> Exportar CSV
                  </button>
                  <button 
                    onClick={loadData}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                  >
                    <RefreshCw size={13} /> Sincronizar
                  </button>
                </div>
              </div>

              {/* Controls bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Filtrar por usuário, documento ou descrição..."
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-hidden focus:border-blue-500/80 transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Filter option */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-extrabold uppercase shrink-0">Tipo de Ação:</span>
                  <select
                    value={auditTypeFilter}
                    onChange={(e) => setAuditTypeFilter(e.target.value)}
                    className="w-full p-1.5 border border-slate-200 rounded-lg text-xs cursor-pointer outline-hidden"
                  >
                    <option value="todos">Todos os Registros</option>
                    <option value="emissao_nfe">Emissão de NF-e</option>
                    <option value="emissao_nfse">Emissão de NFS-e</option>
                    <option value="consulta_nfse">Consulta de NFS-e</option>
                    <option value="download_xml_nfse">Download de XML oficial</option>
                    <option value="download_danfse_nfse">Download de DANFSe oficial</option>
                    <option value="impressao_nfse">Impressão de DANFSe oficial</option>
                    <option value="cancelamento_nfe">Cancelamento NF-e</option>
                    <option value="cancelamento_nfse">Cancelamento NFS-e</option>
                    <option value="baixa_boleto">Baixa de Boleto</option>
                    <option value="integracao_alterada">Integrações Bancárias</option>
                    <option value="configuracao_alterada">Configuração Fiscal</option>
                  </select>
                </div>

                <div className="flex items-center justify-end">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md">
                    Total: {auditLogs.length} registros salvos
                  </span>
                </div>
              </div>

              {/* Logs Table */}
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] text-slate-400 font-black uppercase tracking-widest animate-fade-in">
                      <th className="p-3">Data/Hora</th>
                      <th className="p-3">Operador</th>
                      <th className="p-3">Tipo de Operação</th>
                      <th className="p-3">Detalhamento</th>
                      <th className="p-3 text-right">Id Doc / Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {auditLogs
                      .filter(log => {
                        const matchType = auditTypeFilter === 'todos' || log.action === auditTypeFilter;
                        const matchString = 
                          (log.userName || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
                          (log.details || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
                          (log.documentNumero || '').toLowerCase().includes(auditSearch.toLowerCase());
                        return matchType && matchString;
                      })
                      .map((log) => {
                        // Badge formatting setup
                        let badgeColor = 'bg-blue-50 text-blue-700 border-blue-100';
                        let badgeLabel: string = log.action;
                        if (log.action === 'emissao_nfe') {
                          badgeColor = 'bg-sky-50 text-sky-700 border-sky-100';
                          badgeLabel = 'EMISSÃO NF-E';
                        } else if (log.action === 'emissao_nfse') {
                          badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                          badgeLabel = 'EMISSÃO NFS-E';
                        } else if (log.action === 'cancelamento_nfe' || log.action === 'cancelamento_nfse') {
                          badgeColor = 'bg-rose-50 text-rose-700 border-rose-100';
                          badgeLabel = 'CANCELAMENTO';
                        } else if (log.action === 'baixa_boleto') {
                          badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                          badgeLabel = 'LIQUIDAÇÃO BOLETO';
                        } else if (log.action === 'configuracao_alterada') {
                          badgeColor = 'bg-purple-50 text-purple-700 border-purple-100';
                          badgeLabel = 'PARÂMETROS FISCAIS';
                        } else if (log.action === 'integracao_alterada') {
                          badgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                          badgeLabel = 'CONTAS BANCÁRIAS';
                        }

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/20 transition-colors">
                            <td className="p-3 text-[11px] font-mono whitespace-nowrap text-slate-500">
                              {log.createdAt ? (
                                new Date(log.createdAt).toLocaleString('pt-BR')
                              ) : (
                                new Date().toLocaleString('pt-BR')
                              )}
                            </td>
                            <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                              {log.userName}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex px-2 py-0.5 border text-[9px] font-extrabold uppercase rounded-md tracking-wider ${badgeColor}`}>
                                {badgeLabel}
                              </span>
                            </td>
                            <td className="p-3 text-[11px] leading-relaxed text-slate-500 max-w-sm md:max-w-md lg:max-w-xl truncateOver" title={log.details}>
                              {log.details}
                            </td>
                            <td className="p-3 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                              {log.documentNumero ? `#${log.documentNumero}` : 'N/A'}
                            </td>
                          </tr>
                        );
                      })}

                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-semibold uppercase tracking-wider">
                          Nenhum registro de auditoria disponível na trilha de compliance atualmente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ================= MODAL: EMISSÃO DE NOTA PRODUTO (NF-e) ================= */}
      {isNfeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-5">
            <h3 className="text-md font-extrabold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText className="text-blue-600" size={18} />
              Rascunho de NF-e de Produto · Homologação
            </h3>

            <form onSubmit={handleNfeSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Selecionar Cliente <b className="text-rose-500">*</b></label>
                <select
                  required
                  value={nfeForm.clienteId}
                  onChange={e => {
                    const cl = clientes.find(c => c.id === e.target.value);
                    const interestadual = String(cl?.estado || 'PR').trim().toUpperCase() !== 'PR';
                    const cfop = nfeForm.operacao === 'retorno_conserto'
                      ? (interestadual ? '6916' : '5916')
                      : (interestadual ? '6102' : '5102');
                    setNfeForm({ ...nfeForm, clienteId: e.target.value, cfop });
                  }}
                  className="w-full border border-slate-200 bg-white rounded-xl p-2 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Escolha um Cliente Ativo --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.razaoSocial || c.nomeFantasia} ({c.cnpj || 'Sem CNPJ'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Operação fiscal</label>
                  <select
                    value={nfeForm.operacao}
                    onChange={e => {
                      const operacao = e.target.value as 'venda_comum' | 'retorno_conserto';
                      const cliente = clientes.find(c => c.id === nfeForm.clienteId);
                      const interestadual = String(cliente?.estado || 'PR').trim().toUpperCase() !== 'PR';
                      const cfop = operacao === 'retorno_conserto'
                        ? (interestadual ? '6916' : '5916')
                        : (interestadual ? '6102' : '5102');
                      setNfeForm({ ...nfeForm, operacao, cfop });
                    }}
                    className="w-full border border-slate-200 bg-white rounded-xl p-2"
                  >
                    <option value="venda_comum">Venda comum</option>
                    <option value="retorno_conserto">Retorno de mercadoria recebida para conserto</option>
                  </select>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                  <b>CRT 1 · Simples Nacional</b><br />
                  CFOP definido pela operação e UF do destinatário. A tributação do item ainda será validada antes da homologação.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Produto Vendido <b className="text-rose-500">*</b></label>
                  <select
                    required
                    value={nfeForm.produtoId}
                    onChange={e => {
                      const prod = produtos.find(p => p.id === e.target.value);
                      if (prod) {
                        setNfeForm({
                          ...nfeForm,
                          produtoId: e.target.value,
                          valorProduto: prod.valorVenda,
                          ncm: String(prod.ncm || '').replace(/\D/g, ''),
                          cstCsosn: prod.csosn || '102',
                          origemMercadoria: prod.origemMercadoria || '0',
                          unidadeTributavel: prod.unidadeTributavel || 'UN',
                          cest: String(prod.cest || '').replace(/\D/g, ''),
                          gtin: String(prod.gtin || '').replace(/\D/g, ''),
                          pisCst: prod.pisCst || '',
                          cofinsCst: prod.cofinsCst || '',
                        });
                      } else {
                        setNfeForm({ ...nfeForm, produtoId: e.target.value, ncm: '', cest: '', gtin: '', pisCst: '', cofinsCst: '' });
                      }
                    }}
                    className="w-full border border-slate-200 bg-white rounded-xl p-2 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- Escolha o Produto --</option>
                    {produtos.map(p => (
                      <option key={p.id} value={p.id}>{p.nome} (R$ {p.valorVenda})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Valor do Produto (R$) <b className="text-rose-500">*</b></label>
                  <CurrencyInput
                    value={nfeForm.valorProduto || 0}
                    onChange={val => setNfeForm({ ...nfeForm, valorProduto: val })}
                    placeholder="R$ 0,00"
                    required
                    className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className={`rounded-xl border p-3 ${/^\d{8}$/.test(nfeForm.ncm) ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
                <div className="text-[11px] font-black uppercase">NCM do produto</div>
                <div className="mt-1 text-xs font-mono">{nfeForm.ncm || 'Não cadastrado'}</div>
                {!/^\d{8}$/.test(nfeForm.ncm) && <div className="mt-1 text-[10px] font-bold">Corrija o produto em Comercial → Produtos antes de preparar a NF-e.</div>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Frete (R$)</label>
                  <CurrencyInput
                    value={nfeForm.frete || 0}
                    onChange={val => setNfeForm({ ...nfeForm, frete: val })}
                    placeholder="R$ 0,00"
                    className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">CFOP Mapeado <b className="text-rose-500">*</b></label>
                  <input
                    type="text"
                    required
                    value={nfeForm.cfop}
                    onChange={e => setNfeForm({ ...nfeForm, cfop: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Situação Tributária CTS/CSOSN</label>
                  <input
                    type="text"
                    required
                    value={nfeForm.cstCsosn}
                    onChange={e => setNfeForm({ ...nfeForm, cstCsosn: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Forma Pagamento <b className="text-rose-500">*</b></label>
                  <select
                    value={nfeForm.formaPagamento}
                    onChange={e => setNfeForm({ ...nfeForm, formaPagamento: e.target.value as any })}
                    className="w-full border border-slate-200 bg-white rounded-xl p-2 focus:ring-1"
                  >
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="Pix">PIX imediato</option>
                    <option value="Cartao">Cartão de Crédito</option>
                    <option value="Dinheiro">Dinheiro vivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Condição de Pagamento</label>
                  <select
                    value={nfeForm.condicaoPagamento}
                    onChange={e => setNfeForm({ ...nfeForm, condicaoPagamento: e.target.value as any })}
                    className="w-full border border-slate-200 bg-white rounded-xl p-2 focus:ring-1"
                  >
                    <option value="30 Dias">A prazo (30 dias)</option>
                    <option value="A Vista">À Vista</option>
                    <option value="30/60 Dias">Parcial (30/60 dias)</option>
                    <option value="Parcelado">Parcelamento customizado</option>
                  </select>
                </div>
              </div>

              {nfeForm.formaPagamento === 'Boleto' && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-150 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="checkboxEmitirBoleto"
                    checked={nfeForm.emitirBoleto}
                    onChange={e => setNfeForm({ ...nfeForm, emitirBoleto: e.target.checked })}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor="checkboxEmitirBoleto" className="text-[11px] font-bold text-blue-900 select-none cursor-pointer">
                    Gerar Boleto Bancário Integrado no Financeiro do Cliente?
                  </label>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Observações Gerais</label>
                <textarea
                  value={nfeForm.observacoes}
                  onChange={e => setNfeForm({ ...nfeForm, observacoes: e.target.value })}
                  placeholder="Informações adicionais para o cliente e rodapé fiscal..."
                  className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNfeModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-bold uppercase transition"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md"
                >
                  Salvar rascunho sem transmitir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EMISSÃO DE NOTA SERVIÇO (NFS-e) ================= */}
      {isNfseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-5">
            <h3 className="text-md font-extrabold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText className="text-indigo-600" size={18} />
              Emissão de NFS-e (Notas de Serviços e Suporte)
            </h3>

            <form onSubmit={handleNfseSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Cliente Solicitante <b className="text-rose-500">*</b></label>
                <select
                  required
                  value={nfseForm.clienteId}
                  onChange={e => setNfseForm({ ...nfseForm, clienteId: e.target.value })}
                  className="w-full border border-slate-200 bg-white rounded-xl p-2 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Escolha um Cliente --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.razaoSocial || c.nomeFantasia}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Faturamento Referente à <b className="text-rose-500">*</b></label>
                <input
                  type="text"
                  required
                  value={nfseForm.descricaoServico}
                  onChange={e => setNfseForm({ ...nfseForm, descricaoServico: e.target.value })}
                  className="w-full border border-slate-200 bg-white rounded-xl p-2 focus:ring-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Alíquota ISS (%)</label>
                  <input
                    type="number"
                    step="1"
                    value={nfseForm.iss}
                    onChange={e => setNfseForm({ ...nfseForm, iss: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Valor do Serviço (R$) <b className="text-rose-500">*</b></label>
                  <CurrencyInput
                    value={nfseForm.valorServico || 0}
                    onChange={val => setNfseForm({ ...nfseForm, valorServico: val })}
                    placeholder="R$ 0,00"
                    required
                    className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1 bg-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chkIssRetido"
                    checked={nfseForm.issRetido}
                    onChange={e => setNfseForm({ ...nfseForm, issRetido: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded"
                  />
                  <label htmlFor="chkIssRetido" className="text-[11px] font-bold text-indigo-900 select-none cursor-pointer">
                    Este imposto de ISS é Retido na Fonte?
                  </label>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chkEmitirBoletoService"
                  checked={false}
                  disabled
                  onChange={() => undefined}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded"
                />
                <label htmlFor="chkEmitirBoletoService" className="text-[11px] font-bold text-blue-900 select-none cursor-pointer">
                  Gerar Boleto Bancário Automático para Liquidação (desativado nesta emissão)
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Declaração Adicional para o NFS-e</label>
                <textarea
                  value={nfseForm.observacoes}
                  onChange={e => setNfseForm({ ...nfseForm, observacoes: e.target.value })}
                  placeholder="Adicione referências de ordem de serviço, etc."
                  className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNfseModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-bold uppercase"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition"
                >
                  Emitir NFS-e Serviços
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADICIONAR BANCO PARA INTEGRAÇÃO ================= */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5">
            <h3 className="text-md font-extrabold text-slate-800 mb-3 border-b border-slate-100 pb-2">
              Cadastrar Banco de Teste (PIX / Carteira de Boleto)
            </h3>

            <form onSubmit={handleAccountSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nome de Identificação da Conta <b className="text-rose-500">*</b></label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Itaú Fauramento, ASAAS Sandbox"
                  value={bankForm.nomeIdentificador}
                  onChange={e => setBankForm({ ...bankForm, nomeIdentificador: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Banco Layout</label>
                  <select
                    value={bankForm.banco}
                    onChange={e => setBankForm({ ...bankForm, banco: e.target.value as any })}
                    className="w-full border border-slate-200 bg-white rounded-xl p-2 focus:ring-1"
                  >
                    <option value="Itaú">Banco Itaú</option>
                    <option value="Bradesco">Bradesco</option>
                    <option value="Banco do Brasil">Banco do Brasil</option>
                    <option value="Sicredi">Sicredi</option>
                    <option value="Sicoob">Sicoob</option>
                    <option value="Asaas">Asaas API</option>
                    <option value="Outro">Outro Gateway</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Código do Convênio API</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 109231"
                    value={bankForm.convenio}
                    onChange={e => setBankForm({ ...bankForm, convenio: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Agência</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 0102"
                    value={bankForm.agencia}
                    onChange={e => setBankForm({ ...bankForm, agencia: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Conta Corrente / DV</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 48123-9"
                    value={bankForm.conta}
                    onChange={e => setBankForm({ ...bankForm, conta: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2 focus:ring-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-bold uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase transition"
                >
                  Gravar Integração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DETALHE PRINCIPAL DA NOTA FISCAL SELECIONADA ================= */}
      {selectedNf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl p-6 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {selectedNf.tipo === 'servico'
                    ? `NFS-e ${selectedNf.data.status} · ${selectedNf.data.environment === 'producao' ? 'Produção Real' : 'Produção Restrita'}`
                    : 'Documento fiscal'}
                </span>
                <h3 className="text-sm font-extrabold text-slate-800">
                  {selectedNf.tipo === 'produto' ? 'Nota Fiscal de Venda de Produto (NF-e)' : 'Nota de Prestação de Serviço (NFS-e)'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedNf(null)}
                className="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full p-1"
              >
                ✕
              </button>
            </div>

            {/* Simulated Printed Voucher Header */}
            <div className="border border-slate-200 p-4 rounded-xl space-y-3 bg-slate-50/50 text-xs text-slate-600 font-mono">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <div>
                  <p className="font-bold text-slate-800">{configFiscal?.razaoSocial || 'EMPRESA PRESTADORA'}</p>
                  <p>CNPJ: {configFiscal?.cnpj || 'Não informado'} | {configFiscal?.municipio || 'Município não informado'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">Número: #{selectedNf.data.numeroNota}</p>
                  <p>Emissão: {selectedNf.data.emittedAt || selectedNf.data.dataEmissao}</p>
                  {selectedNf.tipo === 'servico' && <p>DPS: {selectedNf.data.numeroDps || 'Não informada'} · Série: {selectedNf.data.serieDps || 'Não informada'}</p>}
                  <p className="text-[10px] font-bold text-emerald-600">{selectedNf.tipo === 'servico' ? 'SEFIN NACIONAL - AUTORIZADA' : 'SEFAZ - PROCESSO AUTORIZADO'}</p>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-800 border-b border-slate-200 pb-1 uppercase text-[10px]">Destinatário / Cliente</p>
                <p className="font-bold mt-1 text-slate-700">{selectedNf.data.clienteNome}</p>
                <p>CNPJ/CPF: {selectedNf.data.cnpjCpf || clientes.find(cliente => cliente.id === selectedNf.data.clienteId)?.cnpj || 'Não informado'}</p>
                <p>Endereço: {selectedNf.data.endereco || 'Informado na Ficha cadastral'}</p>
              </div>

              {selectedNf.tipo === 'produto' ? (
                <div>
                  <p className="font-bold text-slate-800 border-b border-slate-200 pb-1 uppercase text-[10px]">Especificações NFe</p>
                  <div className="grid grid-cols-2 mt-1.5 gap-y-1">
                    <p><b>Mercadoria:</b> {selectedNf.data.produtoNome}</p>
                    <p><b>CFOP:</b> {selectedNf.data.cfop}</p>
                    <p><b>NCM:</b> {selectedNf.data.ncm || 'Isento'}</p>
                    <p><b>CST/CSOSN:</b> {selectedNf.data.cstCsosn}</p>
                    <p><b>Forma de Pago:</b> {selectedNf.data.formaPagamento}</p>
                    <p><b>Prazo:</b> {selectedNf.data.condicaoPagamento}</p>
                  </div>
                  <div className="mt-3 bg-slate-100 p-2.5 rounded-lg text-right font-sans font-bold text-slate-800">
                    Total Produto: R$ {selectedNf.data.valorProduto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (+ Frete: R$ {selectedNf.data.frete.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-slate-800 border-b border-slate-200 pb-1 uppercase text-[10px]">Discriminação dos Serviços</p>
                  <p className="mt-1">{selectedNf.data.descricaoServico}</p>
                  <p className="mt-1 text-[11px]"><b>Código Serviço:</b> {selectedNf.data.codigoServico}</p>
                  <p className="text-[11px]"><b>Alíquota Tributária de ISS:</b> {selectedNf.data.iss}%</p>
                  <div className="mt-3 bg-slate-100 p-2.5 rounded-lg text-right font-sans font-bold text-indigo-900">
                    Valor total contratado: R$ {selectedNf.data.valorServico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 pt-2 text-[10px] text-slate-400">
                <b>CHAVE OFICIAL SEFIN:</b> {selectedNf.data.chaveAcessoOficial || selectedNf.data.chaveAcesso || selectedNf.data.reference || selectedNf.data.codigoVerificacao || 'Não informada'}
              </div>
            </div>

            <div className="flex justify-between items-center mt-5">
              <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${
                (selectedNf.data.status === 'Autorizada' || selectedNf.data.status === 'AUTORIZADA') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                'bg-rose-50 text-rose-700 border border-rose-100'
              }`}>
                Status {selectedNf.tipo === 'servico' ? 'SEFIN' : 'SEFAZ'}: {selectedNf.data.status}
              </span>

              <div className="space-x-1.5">
                {selectedNf.tipo === 'servico' && selectedNf.data.xmlAvailable && <button
                  onClick={() => void handleDownloadAuthorizedXml(selectedNf.data)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase rounded-lg inline-flex items-center gap-1"
                >
                  <Download size={13} /> Baixar XML
                </button>}
                {selectedNf.tipo === 'servico' && selectedNf.data.danfseAvailable && <button onClick={() => void handleViewDanfse(selectedNf.data)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase rounded-lg inline-flex items-center gap-1"><FileText size={13} /> Visualizar DANFSe</button>}
                {selectedNf.tipo === 'servico' && selectedNf.data.danfseAvailable && <button onClick={() => void handlePrintDanfse(selectedNf.data)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase rounded-lg inline-flex items-center gap-1"><Printer size={13} /> Imprimir</button>}
                {selectedNf.tipo === 'servico' && selectedNf.data.danfseAvailable && <button onClick={() => void handleDownloadDanfse(selectedNf.data)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase rounded-lg inline-flex items-center gap-1"><Download size={13} /> Baixar PDF</button>}
                {canCancel && selectedNf.tipo === 'servico' && selectedNf.data.environment === 'producao' && (selectedNf.data.status === 'Autorizada' || selectedNf.data.status === 'AUTORIZADA') && (
                  <button
                    type="button"
                    onClick={() => openCancellationPreparation(selectedNf.data)}
                    title="Preparar o evento oficial sem transmitir"
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold uppercase rounded-lg border border-rose-200 inline-flex items-center gap-1"
                  >
                    <XCircle size={13} /> Preparar cancelamento oficial
                  </button>
                )}
                <button 
                  onClick={() => setSelectedNf(null)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-lg"
                >
                  Entendido / Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preparação local do evento oficial; esta tela não possui ação de transmissão. */}
      {cancellationNote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Evento oficial e101101 · Produção Real</p>
                <h3 className="text-base font-extrabold text-slate-800">Preparar cancelamento de NFS-e</h3>
                <p className="text-[11px] text-slate-500">Validação local somente. Nenhum evento será enviado à SEFIN.</p>
              </div>
              <button type="button" onClick={() => setCancellationNote(null)} className="p-1 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p><b>NFS-e:</b> {cancellationNote.numeroNota}</p>
              <p><b>Cliente:</b> {cancellationNote.clienteNome}</p>
              <p><b>Valor:</b> R$ {cancellationNote.valorServico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p><b>Ambiente:</b> Produção Real</p>
              <p className="col-span-2 break-all font-mono text-[10px]"><b>Chave:</b> {cancellationNote.chaveAcessoOficial || cancellationNote.chaveAcesso || cancellationNote.reference}</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Motivo oficial</label>
              <select value={cancellationReasonCode} onChange={event => setCancellationReasonCode(event.target.value as '1' | '2' | '9')} className="w-full border border-slate-200 rounded-xl p-2 text-xs">
                <option value="1">1 — Erro na emissão</option>
                <option value="2">2 — Serviço não prestado</option>
                <option value="9">9 — Outros</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Justificativa obrigatória</label>
              <textarea value={cancellationReason} onChange={event => setCancellationReason(event.target.value)} minLength={15} maxLength={255} rows={4} placeholder="Descreva o motivo com 15 a 255 caracteres." className="w-full border border-slate-200 rounded-xl p-2 text-xs" />
              <p className="text-[10px] text-slate-400 text-right">{cancellationReason.trim().length}/255</p>
            </div>
            <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
              <input type="checkbox" checked={cancellationConfirmed} onChange={event => setCancellationConfirmed(event.target.checked)} className="mt-0.5" />
              <span>Confirmo que revisei a nota e compreendo que uma futura transmissão autorizada produzirá efeito fiscal. Nesta etapa, o sistema apenas validará o XML e a assinatura.</span>
            </label>

            {cancellationValidation && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900">
                <p className="font-black uppercase">Evento pronto, não transmitido</p>
                <p>XSD antes: {cancellationValidation.xsdValidBeforeSignature ? 'OK' : 'ERRO'} · XMLDSig: {cancellationValidation.signatureVerified ? 'OK' : 'ERRO'} · XSD depois: {cancellationValidation.xsdValidAfterSignature ? 'OK' : 'ERRO'} · GZip/Base64: {cancellationValidation.gzipBase64Ready ? 'OK' : 'ERRO'}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setCancellationNote(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold uppercase text-slate-600">Fechar</button>
              <button type="button" disabled={isReconcilingCancellation} onClick={() => void reconcileOfficialCancellation()} className="px-4 py-2 rounded-xl border border-blue-300 bg-blue-50 text-blue-700 disabled:opacity-50 text-xs font-black uppercase">
                {isReconcilingCancellation ? 'Consultando SEFIN...' : 'Consultar situação oficial'}
              </button>
              <button type="button" disabled={isPreparingCancellation || !cancellationConfirmed || cancellationReason.trim().length < 15} onClick={() => void validateCancellationPreparation()} className="px-4 py-2 rounded-xl bg-rose-600 disabled:bg-rose-300 text-white text-xs font-black uppercase">
                {isPreparingCancellation ? 'Validando evento...' : 'Validar evento sem transmitir'}
              </button>
              {cancellationValidation && (
                <button type="button" disabled={isPreparingCancellation} onClick={() => void executeOfficialCancellation()} className="px-4 py-2 rounded-xl bg-red-700 disabled:bg-red-300 text-white text-xs font-black uppercase">
                  {isPreparingCancellation ? 'Processando...' : 'Cancelar oficialmente'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= VISUALIZADOR DE SEGUNDA VIA DE BOLETO BANCÁRIO ================= */}
      {selectedBoleto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl p-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-705 flex items-center gap-2">
                <CreditCard className="text-blue-600" size={16} />
                Visualização de Fatura / 2ª Via de Boleto Bancário
              </h3>
              <button 
                onClick={() => setSelectedBoleto(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold bg-slate-100 hover:bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Professional Printed Format */}
            <div className="border-2 border-dashed border-slate-200 p-4 rounded-xl text-xs space-y-4 font-mono bg-amber-50/10">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <div>
                  <h4 className="font-extrabold text-[#000080]">{selectedBoleto.bancoNome.toUpperCase()} S.A</h4>
                  <p className="text-[10px]">Beneficiário: Mundo Tech Assistência</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">Nosso Número: {selectedBoleto.nossoNumero}</p>
                  <p>Vencimento: <strong className="text-red-700">{selectedBoleto.vencimento}</strong></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 border-b border-slate-205 pb-3">
                <p><b>Pagador:</b> {selectedBoleto.clienteNome}</p>
                <p className="text-right"><b>Emissão:</b> {selectedBoleto.dataDocumento}</p>
                <p><b>Documento Origem:</b> {selectedBoleto.documentoOrigemTipo} #{selectedBoleto.documentoOrigemId.substring(0,8)}</p>
                <p className="text-right"><b>Status:</b> <strong className="uppercase text-[10px]">{selectedBoleto.status}</strong></p>
              </div>

              <div>
                <p className="font-bold text-[10px] text-slate-500 uppercase">Demonstrativo de Valores & Instruções do Boleto:</p>
                <div className="bg-slate-50 p-2 px-3.5 rounded-lg space-y-1 text-[11px] mt-1.5">
                  <p>• Cobrança gerada automaticamente pelo emissor integrado.</p>
                  <p>• Juros de mora ao dia: {selectedBoleto.juros}% ao mês / Multas: {selectedBoleto.multa}% após o vencimento.</p>
                </div>
              </div>

              <div className="text-right border-t border-slate-200 pt-3">
                <span className="text-[10px] text-slate-400 block font-sans">VALOR COBRADO TOTAL</span>
                <strong className="text-base font-sans font-black text-slate-800">
                  R$ {selectedBoleto.valorCobrado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>

              {/* Barcode line mock */}
              <div className="pt-2 flex flex-col items-center">
                <div className="h-7 w-full bg-slate-900 rounded mb-1 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                  <span className="text-[8px] text-white tracking-widest font-sans uppercase">CÓDIGO DE BARRAS DE TESTE DO AMBIENTE DE HOMOLOGAÇÃO</span>
                </div>
                <span className="text-[8px] tracking-wide text-slate-400">34191.79001 01043.513184 91024.150008 7 90120000030000</span>
              </div>
            </div>

            <div className="flex justify-between items-center mt-5">
              <span className="text-[10px] text-slate-400 font-bold italic">
                *Simulado para testes no sandbox bancário.
              </span>

              <div className="space-x-1">
                <button 
                  onClick={() => alert('Download do arquivo de boleto simulado no formato PDF iniciado.')}
                  className="px-3 py-1.5 bg-slate-105 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase inline-flex items-center gap-1"
                >
                  <Download size={13} /> Baixar PDF
                </button>
                {canCancel && selectedBoleto.status === 'Pendente' && (
                  <button 
                    onClick={() => handleClearBoleto(selectedBoleto.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase"
                  >
                    Marcar Pago (Manual)
                  </button>
                )}
                <button 
                  onClick={() => setSelectedBoleto(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold uppercase"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: INGRESSO / IMPORTAÇÃO DE XML ================= */}
      {isImportXmlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Upload className="text-emerald-600" size={18} />
                Importação Automatizada de XML Fiscal
              </h3>
              <button 
                onClick={() => {
                  setIsImportXmlModalOpen(false);
                  setParsedInvoice(null);
                  setXmlTextContent('');
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                X
              </button>
            </div>

            <div className="space-y-4">
              {/* File input drag and drop area */}
              <div className="border border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-6 text-center transition-all bg-slate-50/50 cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".xml" 
                  onChange={handleXmlUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center">
                  <Upload className="text-slate-400 mb-2" size={28} />
                  <p className="text-xs font-bold text-slate-700">Selecione ou clique para arrastar o arquivo XML de Nota</p>
                  <p className="text-[10px] text-slate-400 mt-1">Suporta NF-e (Produto) e NFS-e (Serviço) padrão XML nacional</p>
                </div>
              </div>

              {parsedInvoice && (
                <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-150 space-y-3.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase py-0.5 px-2 bg-emerald-100 text-emerald-800 rounded-full">
                      {parsedInvoice.tipo === 'nfe' ? 'Nota de Produto (NF-e)' : 'Nota de Serviço (NFS-e)'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Chave: {parsedInvoice.chaveAcesso || 'N/A'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100 font-sans">
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Número da Nota</p>
                      <p className="font-extrabold text-slate-800">#{parsedInvoice.numeroNota} / Série {parsedInvoice.serie}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Data de Emissão</p>
                      <p className="font-semibold text-slate-800">{parsedInvoice.dataEmissao}</p>
                    </div>
                  </div>

                  {/* Issuer and Receiver info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Emitente (Fornecedor)</p>
                      <p className="font-bold text-slate-700 line-clamp-1">{parsedInvoice.emitNome}</p>
                      <p className="text-slate-500 font-mono text-[10px]">CNPJ: {parsedInvoice.emitCNPJ}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Destinatário (Comprador)</p>
                      <p className="font-bold text-slate-700 line-clamp-1">{parsedInvoice.destNome}</p>
                      <p className="text-slate-500 font-mono text-[10px]">CNPJ: {parsedInvoice.destCNPJ}</p>
                    </div>
                  </div>

                  {/* Auto-detected client binding card */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 mt-2 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Cliente de Referência Vinculado</p>
                      {parsedInvoice.linkedCliente ? (
                        <div className="mt-1">
                          <p className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {parsedInvoice.linkedCliente.razaoSocial || parsedInvoice.linkedCliente.nomeFantasia}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5">CNPJ Banco: {parsedInvoice.linkedCliente.cnpj || 'Sem CNPJ'}</p>
                        </div>
                      ) : (
                        <div className="mt-1 bg-amber-50 p-1.5 px-2 rounded-lg border border-amber-100">
                          <p className="text-[10px] text-amber-700 font-bold mb-0.5">Cliente não localizado no banco de dados.</p>
                          <p className="text-[9px] text-amber-600">Para vincular e conseguir realizar a importação corretamente, você deve cadastrar esse cliente agora.</p>
                        </div>
                      )}
                    </div>
                    {!parsedInvoice.linkedCliente && (
                      <button
                        type="button"
                        disabled={linkingClientLoading}
                        onClick={handleAutoCreateClient}
                        className="px-3 py-1.5 bg-slate-850 hover:bg-slate-900 border border-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                      >
                        {linkingClientLoading ? 'Processando...' : 'Cadastrar Cliente'}
                      </button>
                    )}
                  </div>

                  {/* Items description table */}
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1.5">Itens Detectados do XML:</p>
                    <div className="max-h-24 overflow-y-auto border border-slate-150 rounded-xl bg-white">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100 text-[9px] text-slate-400 uppercase font-black tracking-widest">
                          <tr>
                            <th className="p-2">Cód.</th>
                            <th className="p-2">Descrição</th>
                            <th className="p-2 text-right">Valor Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[10px] text-slate-600 font-sans">
                          {parsedInvoice.itens?.map((it: any, index: number) => (
                            <tr key={index}>
                              <td className="p-2 font-mono text-[9px]">{it.codigo || '-'}</td>
                              <td className="p-2 truncate max-w-[200px]">{it.descricao || 'Item sem descrição'}</td>
                              <td className="p-2 text-right font-bold">R$ {it.valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Financial doc dynamic creation parameters */}
                  <div className="bg-slate-100/50 p-2.5 rounded-xl border border-slate-200/80 space-y-2 mt-1">
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={saveWithFinancialDoc}
                        onChange={e => setSaveWithFinancialDoc(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer h-3.5 w-3.5"
                      />
                      <span>Criar lançamento financeiro (Contas a Pagar) deste XML</span>
                    </label>
                    <p className="text-[10px] text-slate-400 pl-5">Gera automaticamente uma fatura a pagar vinculada ao fornecedor/emissor correspondente com status "Pendente" no fluxo de Contas a Pagar do Financeiro.</p>
                  </div>

                  <div className="pt-2 flex justify-between items-center">
                    <p className="text-[10px] text-slate-400">Total Geral da Fatura:</p>
                    <strong className="text-sm font-extrabold text-slate-800">
                      R$ {parsedInvoice.valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-5">
              <button
                type="button"
                onClick={() => {
                  setIsImportXmlModalOpen(false);
                  setParsedInvoice(null);
                  setXmlTextContent('');
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-bold uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!parsedInvoice || !parsedInvoice.linkedCliente || parsedInvoice.duplicateError || loading}
                onClick={handleConfirmImport}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase disabled:opacity-40 transition-opacity cursor-pointer flex items-center gap-1 shadow-sm"
              >
                {loading ? 'Processando...' : 'Confirmar & Importar Nota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
