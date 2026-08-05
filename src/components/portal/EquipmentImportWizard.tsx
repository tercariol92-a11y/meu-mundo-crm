import React, { useState, useEffect } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Save, 
  Download, 
  Building2,
  FileText,
  AlertCircle,
  HelpCircle,
  Play
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { User, Unidade, EquipamentoCliente, SolicitacaoEquipamento, ModeloMapeamento } from '../../types';
import { databaseService } from '../../services/databaseService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface EquipmentImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  unidades: Unidade[];
  existingEquipments: EquipamentoCliente[];
  onSuccess: () => void;
}

interface ValidationResult {
  rowNum: number;
  data: {
    codigoUnidade: string;
    unidadeNome: string;
    fusoHorario: string;
    codigoEmpresa: string;
    nomeEmpresa: string;
    codigoFilial: string;
    apelidoFilial: string;
    localFisico: string;
    numeroSerie: string;
    ipEquipamento: string;
    tipo: 'Placa' | 'Catraca' | 'Relógio de ponto' | 'Facial' | 'Outros';
    marca: string;
    modelo: string;
    existingClientId: string | null;
    existingUnitId: string | null;
    existingEqId: string | null;
  };
  status: 'Novo' | 'Atualizar' | 'Erro';
  errors: string[];
}

// Map spreadsheet headers exactly to the requested standard layout
const STANDARD_COLUMNS = [
  "Site",
  "Descrição",
  "Diferença Fuso",
  "Empresa",
  "Nome (Empresa)",
  "Filial",
  "Apelido (Filial)",
  "Local Físico",
  "Número Fiscal",
  "IP do Equipamento"
];

// Normalize text for strict comparison
const normalizeHeader = (s: string) => String(s || '').trim().toLowerCase();

export default function EquipmentImportWizard({
  isOpen,
  onClose,
  user,
  unidades,
  existingEquipments,
  onSuccess
}: EquipmentImportWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [savedModels, setSavedModels] = useState<ModeloMapeamento[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [isAutoRecognized, setIsAutoRecognized] = useState(false);
  
  // Mapping configuration (System Field -> Excel Header)
  const [mapping, setMapping] = useState<Record<string, string>>({
    codigoUnidade: '',
    unidadeNome: '',
    fusoHorario: '',
    codigoEmpresa: '',
    nomeEmpresa: '',
    codigoFilial: '',
    apelidoFilial: '',
    localFisico: '',
    numeroSerie: '',
    ipEquipamento: ''
  });

  // Save model states
  const [saveAsModel, setSaveAsModel] = useState(false);
  const [newModelName, setNewModelName] = useState('');

  // Validation results
  const [validatedData, setValidatedData] = useState<ValidationResult[]>([]);
  const [stats, setStats] = useState({
    newCount: 0,
    updateCount: 0,
    errorCount: 0
  });

  // Import states
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedLogs, setImportedLogs] = useState({
    success: 0,
    error: 0
  });

  // Definition of fields that are matched and shown on mapping page
  const systemFields = [
    { key: 'codigoUnidade', label: 'Código da Unidade', required: true, desc: 'Identificador do site/unidade (ex: Site)' },
    { key: 'unidadeNome', label: 'Unidade / Filial', required: true, desc: 'Descrição ou nome da unidade (ex: Descrição)' },
    { key: 'fusoHorario', label: 'Fuso Horário', required: false, desc: 'Diferença de fuso horário (ex: Diferença Fuso)' },
    { key: 'codigoEmpresa', label: 'Código da Empresa', required: true, desc: 'Código numérico do cliente (ex: Empresa)' },
    { key: 'nomeEmpresa', label: 'Empresa', required: true, desc: 'Razão Social ou Nome Fantasia (ex: Nome (Empresa))' },
    { key: 'codigoFilial', label: 'Código da Filial', required: false, desc: 'Código numérico da filial (ex: Filial)' },
    { key: 'apelidoFilial', label: 'Filial', required: false, desc: 'Nome ou apelido da filial (ex: Apelido (Filial))' },
    { key: 'localFisico', label: 'Patrimônio Local', required: false, desc: 'Patrimônio ou local físico do ativo (ex: Local Físico)' },
    { key: 'numeroSerie', label: 'Número de Série / Patrimônio', required: true, desc: 'Identificador único fiscal (ex: Número Fiscal)' },
    { key: 'ipEquipamento', label: 'Endereço IP', required: false, desc: 'Endereço IP do equipamento (ex: IP do Equipamento)' }
  ];

  // Load mapping models
  useEffect(() => {
    if (user.clienteId && isOpen) {
      databaseService.getModelosMapeamento(user.clienteId).then(models => {
        setSavedModels(models || []);
      }).catch(err => {
        console.error("Error loading mapping models:", err);
      });
    }
  }, [user.clienteId, isOpen]);

  if (!isOpen) return null;

  // STEP 1: File Downloading Template
  const downloadTemplate = () => {
    const headers = [...STANDARD_COLUMNS];
    
    // Provide realistic rows matching Fertipar layout exactly
    const rows = [
      ["00083", "2°ANDAR - CURITIBA - PR - TP", "0000:00", "0001", "FERTIPAR FERTILIZANTES DO PARANA LTDA", "0001", "MATRIZ", "0000111", "00009003650028947", "192.168.050.204"],
      ["00084", "MAFRA - SC", "0000:00", "0001", "FERTIPAR FERTILIZANTES DO PARANA LTDA", "0001", "MATRIZ", "0000112", "00009003650028766", "192.168.134.109"],
      ["00114", "UBERABA - MG", "0003:00-", "0002", "FERTIGRAN FERTILIZANTES DO VALE DO RIO G", "0002", "UBERABA", "0000143", "00009003650040279", "192.168.240.233"],
      ["00156", "PORTO ALEGRE - RS", "0003:00-", "0003", "FERTILIZANTES PIRATINI LTDA", "0001", "POA I", "0000185", "00009003650050150", "192.168.136.246"]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Modelo Portal Cliente");
    XLSX.writeFile(wb, "modelo_importacao_portal_cliente.xlsx");
    toast.success("Modelo baixado com sucesso!");
  };

  // Drag and Drop & select handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast.error("Formato inválido. Por favor, envie um arquivo Excel (.xlsx, .xls) ou CSV.");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();

    if (file.name.endsWith('.csv')) {
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').map(line => line.split(/,|;/).map(cell => cell.trim().replace(/^"|"$/g, '')));
          const headers = lines[0].filter(h => h !== '');
          const rows = lines.slice(1).filter(r => r.length > 0 && r.some(c => c !== ''));
          
          setFileHeaders(headers);
          setRawRows(rows);
          autoDetectMappings(headers);
          setCurrentStep(2);
          toast.success("Planilha lida com sucesso!");
        } catch (err) {
          console.error(err);
          toast.error("Erro ao ler arquivo CSV.");
        }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
          
          if (jsonData.length === 0) {
            toast.error("A planilha está vazia.");
            return;
          }

          const headers = (jsonData[0] as any[]).map(h => String(h || '').trim()).filter(h => h !== '');
          const rows = jsonData.slice(1).filter(row => row && row.length > 0 && row.some((cell: any) => cell !== null && cell !== undefined && cell !== ''));
          
          setFileHeaders(headers);
          setRawRows(rows);
          autoDetectMappings(headers);
          setCurrentStep(2);
          toast.success("Planilha lida com sucesso!");
        } catch (err) {
          console.error(err);
          toast.error("Erro ao processar arquivo Excel.");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Automated Mapping Detector (Strict layout vs fuzzy synonyms)
  const autoDetectMappings = (headers: string[]) => {
    const newMapping: Record<string, string> = {
      codigoUnidade: '',
      unidadeNome: '',
      fusoHorario: '',
      codigoEmpresa: '',
      nomeEmpresa: '',
      codigoFilial: '',
      apelidoFilial: '',
      localFisico: '',
      numeroSerie: '',
      ipEquipamento: ''
    };

    const normalizedHeaders = headers.map(normalizeHeader);

    // Check if the spreadsheet has exactly the standard layout
    const hasAllStandard = STANDARD_COLUMNS.every(col => normalizedHeaders.includes(normalizeHeader(col)));

    if (hasAllStandard) {
      // Perfect match! Set exact mappings automatically
      headers.forEach(header => {
        const norm = normalizeHeader(header);
        if (norm === normalizeHeader("Site")) newMapping.codigoUnidade = header;
        else if (norm === normalizeHeader("Descrição")) newMapping.unidadeNome = header;
        else if (norm === normalizeHeader("Diferença Fuso")) newMapping.fusoHorario = header;
        else if (norm === normalizeHeader("Empresa")) newMapping.codigoEmpresa = header;
        else if (norm === normalizeHeader("Nome (Empresa)")) newMapping.nomeEmpresa = header;
        else if (norm === normalizeHeader("Filial")) newMapping.codigoFilial = header;
        else if (norm === normalizeHeader("Apelido (Filial)")) newMapping.apelidoFilial = header;
        else if (norm === normalizeHeader("Local Físico")) newMapping.localFisico = header;
        else if (norm === normalizeHeader("Número Fiscal")) newMapping.numeroSerie = header;
        else if (norm === normalizeHeader("IP do Equipamento")) newMapping.ipEquipamento = header;
      });
      setIsAutoRecognized(true);
    } else {
      // Fuzzy detect mappings for files with different layouts
      setIsAutoRecognized(false);
      
      const rulesMap: Record<string, string[]> = {
        codigoUnidade: ['site', 'código da unidade', 'codigo unidade', 'site id', 'unidade id'],
        unidadeNome: ['descrição', 'descricao', 'unidade / filial', 'unidade', 'filial desc', 'nome unidade'],
        fusoHorario: ['diferença fuso', 'diferenca fuso', 'fuso horário', 'fuso horario', 'fuso', 'timezone'],
        codigoEmpresa: ['empresa', 'código da empresa', 'codigo empresa', 'empresa id', 'cod empresa'],
        nomeEmpresa: ['nome (empresa)', 'empresa nome', 'nome empresa', 'razão social', 'razao social', 'cliente'],
        codigoFilial: ['filial', 'código da filial', 'codigo filial', 'filial id', 'cod filial'],
        apelidoFilial: ['apelido (filial)', 'apelido filial', 'nome filial', 'filial nome', 'apelido'],
        localFisico: ['local físico', 'local fisico', 'patrimônio local', 'patrimonio local', 'sala', 'setor', 'localização', 'local'],
        numeroSerie: ['número fiscal', 'numero fiscal', 'número de série', 'numero de serie', 'série', 'serie', 'n de serie', 'serial', 'sn'],
        ipEquipamento: ['ip do equipamento', 'ip', 'endereço ip', 'endereco ip', 'ip equipamento', 'ip dispositivo']
      };

      headers.forEach(header => {
        const lowerHeader = normalizeHeader(header);
        Object.keys(rulesMap).forEach(systemKey => {
          if (!newMapping[systemKey]) {
            const matched = rulesMap[systemKey].some(synonym => {
              return lowerHeader === synonym || lowerHeader.includes(synonym);
            });
            if (matched) {
              newMapping[systemKey] = header;
            }
          }
        });
      });
    }

    setMapping(newMapping);
  };

  // Selection of previous models
  const handleModelSelect = (modelId: string) => {
    setSelectedModelId(modelId);
    if (!modelId) return;

    const model = savedModels.find(m => m.id === modelId);
    if (model && model.mapeamento) {
      const restoredMapping = { ...mapping };
      Object.keys(restoredMapping).forEach(key => {
        if (fileHeaders.includes(model.mapeamento[key])) {
          restoredMapping[key] = model.mapeamento[key];
        } else {
          restoredMapping[key] = '';
        }
      });
      setMapping(restoredMapping);
      setIsAutoRecognized(false);
      toast.success(`Modelo "${model.nome}" aplicado!`);
    }
  };

  // Helper to extract value from a raw row by mapped header
  const getRowValue = (row: any[], fieldName: string) => {
    const header = mapping[fieldName];
    if (!header) return '';
    const index = fileHeaders.indexOf(header);
    if (index === -1) return '';
    
    const value = row[index];
    return value !== undefined && value !== null ? String(value).trim() : '';
  };

  // Helper to parse equipment details based on description
  const parseEquipmentDetails = (desc: string) => {
    const descLower = desc.toLowerCase();
    let brand = 'Mundo Tech';
    let model = 'Equipamento Importado';
    let type: 'Placa' | 'Catraca' | 'Relógio de ponto' | 'Facial' | 'Outros' = 'Relógio de ponto';

    if (descLower.includes('dimep')) {
      brand = 'DIMEP';
      model = 'Dimep Smart';
    } else if (descLower.includes('control id') || descLower.includes('idclass') || descLower.includes('controlid')) {
      brand = 'Control iD';
      model = 'iDClass';
    } else if (descLower.includes('intelbras')) {
      brand = 'Intelbras';
      model = 'Facial 3000';
      type = 'Facial';
    } else if (descLower.includes('henry')) {
      brand = 'Henry';
      model = 'Prisma';
    } else if (descLower.includes('topdata') || descLower.includes('inner')) {
      brand = 'Topdata';
      model = 'Inner Plus';
    }

    if (descLower.includes('facial') || descLower.includes('face') || descLower.includes('rosto')) {
      type = 'Facial';
    } else if (descLower.includes('catraca') || descLower.includes('torniquete') || descLower.includes('giratoria') || descLower.includes('giratória')) {
      type = 'Catraca';
    } else if (descLower.includes('placa') || descLower.includes('board')) {
      type = 'Placa';
    }

    return { brand, model, type };
  };

  // STEP 2: Submission and Moving to Validation Step
  const handleMappingConfirm = async () => {
    // Check required mappings
    if (!mapping.codigoUnidade) {
      toast.error("O mapeamento de 'Código da Unidade' é obrigatório.");
      return;
    }
    if (!mapping.unidadeNome) {
      toast.error("O mapeamento de 'Unidade / Filial' é obrigatório.");
      return;
    }
    if (!mapping.codigoEmpresa) {
      toast.error("O mapeamento de 'Código da Empresa' é obrigatório.");
      return;
    }
    if (!mapping.nomeEmpresa) {
      toast.error("O mapeamento de 'Empresa' é obrigatório.");
      return;
    }
    if (!mapping.numeroSerie) {
      toast.error("O mapeamento de 'Número de Série / Patrimônio' é obrigatório.");
      return;
    }

    try {
      setImporting(true);
      setCurrentStep(3);
      
      // Fetch fresh DB list to validate existence / match
      const [allClients, allUnits, allEquipments] = await Promise.all([
        databaseService.getClientes() || [],
        databaseService.getUnidades() || [],
        databaseService.getEquipamentosCliente() || []
      ]);

      validateDataRows(allClients || [], allUnits || [], allEquipments || []);
    } catch (err) {
      console.error("Error loading data for validation:", err);
      toast.error("Erro ao carregar dados para validação.");
    } finally {
      setImporting(false);
    }
  };

  // STEP 3: Data validation loop
  const validateDataRows = (allClients: any[], allUnits: any[], allEquipments: any[]) => {
    let newCount = 0;
    let updateCount = 0;
    let errorCount = 0;

    const userClientId = user.clienteId || (user as any).empresaId;
    const userClientObj = userClientId ? allClients.find(c => c.id === userClientId) : null;

    const results: ValidationResult[] = rawRows.map((row, index) => {
      const codigoUnidade = getRowValue(row, 'codigoUnidade');
      const unidadeNome = getRowValue(row, 'unidadeNome');
      const fusoHorario = getRowValue(row, 'fusoHorario') || '0000:00';
      const codigoEmpresa = getRowValue(row, 'codigoEmpresa');
      const nomeEmpresa = getRowValue(row, 'nomeEmpresa');
      const codigoFilial = getRowValue(row, 'codigoFilial');
      const apelidoFilial = getRowValue(row, 'apelidoFilial');
      const localFisico = getRowValue(row, 'localFisico');
      const numeroSerie = getRowValue(row, 'numeroSerie');
      const ipEquipamento = getRowValue(row, 'ipEquipamento');

      const errors: string[] = [];

      if (!numeroSerie) {
        errors.push("Número Fiscal (Número de Série) é obrigatório.");
      }
      if (!codigoUnidade) {
        errors.push("Código da Unidade (Site) é obrigatório.");
      }
      if (!unidadeNome) {
        errors.push("Unidade / Filial (Descrição) é obrigatória.");
      }

      const finalNomeEmpresa = nomeEmpresa || userClientObj?.nomeFantasia || userClientObj?.razaoSocial || '';
      const finalCodigoEmpresa = codigoEmpresa || userClientObj?.codigo || '';

      if (!finalCodigoEmpresa && !userClientId) {
        errors.push("Código da Empresa é obrigatório.");
      }
      if (!finalNomeEmpresa && !userClientId) {
        errors.push("Empresa (Nome) é obrigatória.");
      }

      // Find if Client exists in memory
      const existingClient = userClientId 
        ? userClientObj 
        : allClients.find(c => 
            (c.nomeFantasia && c.nomeFantasia.toLowerCase() === finalNomeEmpresa?.toLowerCase()) || 
            (c.razaoSocial && c.razaoSocial.toLowerCase() === finalNomeEmpresa?.toLowerCase()) || 
            (c.codigo && String(c.codigo) === String(finalCodigoEmpresa))
          );

      // Find if Unidade exists in memory
      let existingUnit = null;
      if (existingClient) {
        existingUnit = allUnits.find(u => 
          u.clienteId === existingClient.id && 
          (
            (u.nome && u.nome.toLowerCase() === unidadeNome?.toLowerCase()) || 
            (u.codigoUnidade && String(u.codigoUnidade) === String(codigoUnidade))
          )
        );
      }

      // Find if Equipment exists
      const existingEq = allEquipments.find(e => 
        e.numeroSerie && e.numeroSerie.toLowerCase() === numeroSerie?.toLowerCase()
      );

      let status: 'Novo' | 'Atualizar' | 'Erro' = 'Novo';
      if (errors.length > 0) {
        status = 'Erro';
        errorCount++;
      } else if (existingEq) {
        status = 'Atualizar';
        updateCount++;
      } else {
        status = 'Novo';
        newCount++;
      }

      const details = parseEquipmentDetails(unidadeNome || '');

      return {
        rowNum: index + 2,
        data: {
          codigoUnidade,
          unidadeNome,
          fusoHorario,
          codigoEmpresa: finalCodigoEmpresa,
          nomeEmpresa: finalNomeEmpresa,
          codigoFilial,
          apelidoFilial,
          localFisico,
          numeroSerie,
          ipEquipamento,
          tipo: details.type,
          marca: details.brand,
          modelo: details.model,
          existingClientId: existingClient ? existingClient.id : null,
          existingUnitId: existingUnit ? existingUnit.id : null,
          existingEqId: existingEq ? existingEq.id : null
        },
        status,
        errors
      };
    });

    setValidatedData(results);
    setStats({
      newCount,
      updateCount,
      errorCount
    });
  };

  // Helper query-checks for safety during sequential operations
  const findClientByNameOrCode = async (name: string, code: string) => {
    try {
      const clients = await databaseService.getClientes() || [];
      return clients.find(c => 
        (c.nomeFantasia && c.nomeFantasia.toLowerCase() === name?.toLowerCase()) || 
        (c.razaoSocial && c.razaoSocial.toLowerCase() === name?.toLowerCase()) || 
        (c.codigo && String(c.codigo) === String(code))
      );
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const findUnitInDb = async (clientId: string, name: string, code: string) => {
    try {
      const units = await databaseService.getUnidades(clientId) || [];
      return units.find(u => 
        (u.nome && u.nome.toLowerCase() === name?.toLowerCase()) || 
        (u.codigoUnidade && String(u.codigoUnidade) === String(code))
      );
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const findEquipmentBySerial = async (serial: string) => {
    try {
      const equipments = await databaseService.getEquipamentosCliente() || [];
      return equipments.find(e => 
        e.numeroSerie && e.numeroSerie.toLowerCase() === serial?.toLowerCase()
      );
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  // STEP 4: Process Import execution (Directly writing to Database)
  const executeImport = async () => {
    setImporting(true);
    setImportProgress(0);

    // Save model if requested
    if (saveAsModel && newModelName.trim() && user.clienteId) {
      try {
        await databaseService.createModeloMapeamento({
          clienteId: user.clienteId,
          nome: newModelName.trim(),
          mapeamento: mapping
        });
        toast.success(`Modelo de mapeamento "${newModelName}" salvo!`);
      } catch (err) {
        console.error("Error saving mapping model:", err);
      }
    }

    const validItems = validatedData.filter(item => item.status !== 'Erro');
    const totalToImport = validItems.length;

    if (totalToImport === 0) {
      toast.error("Nenhum item válido para importar.");
      setImporting(false);
      return;
    }

    setCurrentStep(4);
    let successCount = 0;
    let failCount = 0;

    // Cache to prevent recreating the same entity if listed multiple times in the uploaded spreadsheet
    const createdClientsCache: Record<string, string> = {};
    const createdUnitsCache: Record<string, string> = {};

    for (let i = 0; i < totalToImport; i++) {
      const item = validItems[i];
      try {
        const userClientId = user.clienteId || (user as any).empresaId;
        let clientToUseId = userClientId || item.data.existingClientId;
        const companyName = item.data.nomeEmpresa;
        const companyCode = item.data.codigoEmpresa;

        // 1. Identify or Auto-Create Client/Empresa
        if (!clientToUseId) {
          if (createdClientsCache[companyName]) {
            clientToUseId = createdClientsCache[companyName];
          } else {
            const existingInDb = await findClientByNameOrCode(companyName, companyCode);
            if (existingInDb) {
              clientToUseId = existingInDb.id;
              createdClientsCache[companyName] = clientToUseId;
            } else {
              const newClient = await databaseService.createCliente({
                nomeFantasia: companyName,
                razaoSocial: companyName,
                status: 'Ativo',
                codigo: companyCode,
                responsavelNome: 'Portal Importador',
                emailPrincipal: `contato@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br`
              });
              clientToUseId = newClient.id;
              createdClientsCache[companyName] = clientToUseId;
            }
          }
        }

        // 2. Identify or Auto-Create Unidade (with Filial and Fuso details)
        let unitToUseId = item.data.existingUnitId;
        const unitName = item.data.unidadeNome;
        const unitCode = item.data.codigoUnidade;
        const fuso = item.data.fusoHorario;
        const colFilial = item.data.codigoFilial;
        const apFilial = item.data.apelidoFilial;

        const unitCacheKey = `${clientToUseId}_${unitName}_${unitCode}`;

        if (!unitToUseId) {
          if (createdUnitsCache[unitCacheKey]) {
            unitToUseId = createdUnitsCache[unitCacheKey];
          } else {
            const existingInDb = await findUnitInDb(clientToUseId, unitName, unitCode);
            if (existingInDb) {
              unitToUseId = existingInDb.id;
              createdUnitsCache[unitCacheKey] = unitToUseId;
            } else {
              const newUnit = await databaseService.createUnidade({
                clienteId: clientToUseId,
                nome: unitName,
                codigoUnidade: unitCode || '',
                codigoFilial: colFilial || '',
                apelidoFilial: apFilial || '',
                fusoHorario: fuso || '',
                endereco: 'Importado via Planilha',
                cidade: '',
                estado: ''
              } as any);
              unitToUseId = newUnit.id;
              createdUnitsCache[unitCacheKey] = unitToUseId;
            }
          }
        }

        // 3. Identify or Auto-Create / Update Equipamento
        const serial = item.data.numeroSerie;
        const localFisico = item.data.localFisico;
        const ipVal = item.data.ipEquipamento;

        const eqData: any = {
          clienteId: clientToUseId,
          unidadeId: unitToUseId,
          tipo: item.data.tipo,
          marca: item.data.marca,
          modelo: item.data.modelo,
          numeroSerie: serial,
          patrimonio: localFisico || serial,
          quantidade: 1,
          localInstalacao: localFisico || '',
          ip: ipVal,
          fusoHorario: fuso,
          codigoEmpresa: companyCode,
          nomeEmpresa: companyName,
          codigoFilial: colFilial,
          apelidoFilial: apFilial,
          codigoUnidade: unitCode,
          unidadeNome: unitName,
          status: 'Em operação',
          active: true,
          isActive: true,
          approved: true,
          
          // Additional custom/snake_case fields required for integration
          cliente_id: clientToUseId,
          empresa_id: clientToUseId,
          unidade_id: unitToUseId,
          numero_serie: serial,
          numero_fiscal: serial,
          site: unitCode,
          descricao: unitName,
          local_fisico: localFisico || '',
          ip_equipamento: ipVal || '',
          ativo: true,
          origem: 'importacao',
          created_at: new Date().toISOString()
        };

        if (item.data.existingEqId) {
          // Update existing equipment
          await databaseService.updateEquipamentoCliente(item.data.existingEqId, eqData);
        } else {
          // Double-check global DB to avoid potential overlaps
          const existingInDb = await findEquipmentBySerial(serial);
          if (existingInDb) {
            await databaseService.updateEquipamentoCliente(existingInDb.id, eqData);
          } else {
            // Create new equipment
            await databaseService.createEquipamentoCliente(eqData);
          }
        }

        successCount++;
      } catch (err) {
        console.error("Error importing row:", item, err);
        failCount++;
      }

      setImportProgress(Math.round(((i + 1) / totalToImport) * 100));
      setImportedLogs({ success: successCount, error: failCount });
    }

    // Save logs of the operation
    try {
      await databaseService.createEquipamentoImportadoLog({
        clienteId: user.clienteId || 'sistema',
        userId: user.id || 'sistema',
        userName: user.nome || 'Cliente',
        fileName,
        totalRecords: rawRows.length,
        importedCount: successCount,
        duplicateCount: stats.updateCount,
        errorCount: stats.errorCount + failCount,
        status: failCount === 0 ? 'completed' : 'failed',
        errors: validatedData
          .filter(d => d.status === 'Erro')
          .map(d => ({ line: d.rowNum, message: d.errors.join(' | ') }))
      });
    } catch (err) {
      console.error("Error writing import logs:", err);
    }

    setImporting(false);
    toast.success("Importação realizada com sucesso!");
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-surface rounded-[40px] border border-surface-container-high w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-surface px-8 py-6 border-b border-surface-container-high flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-on-surface">
              Importador de Equipamentos
            </h2>
            <p className="text-xs text-on-surface-variant font-medium mt-1">
              Importação automatizada com reconhecimento de estrutura padrão do Portal Cliente (Fertipar).
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Wizard Progress Stepper */}
        <div className="px-10 py-6 bg-surface-container-low border-b border-surface-container-high flex items-center justify-center gap-4">
          {[
            { step: 1, label: 'Seleção' },
            { step: 2, label: 'Mapeamento' },
            { step: 3, label: 'Validação' },
            { step: 4, label: 'Resultado' }
          ].map((item, idx) => (
            <React.Fragment key={item.step}>
              {idx > 0 && <div className={`h-1 flex-1 max-w-[60px] rounded-full ${currentStep >= item.step ? 'bg-primary' : 'bg-surface-container-high'}`} />}
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  currentStep === item.step 
                    ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/20' 
                    : currentStep > item.step 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {currentStep > item.step ? '✓' : item.step}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${currentStep === item.step ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {item.label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Wizard Content */}
        <div className="flex-1 p-8 overflow-y-auto min-h-[350px]">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: SELECT FILE */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8 max-w-2xl mx-auto"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-black text-on-surface uppercase tracking-tight">Selecione seu arquivo</h3>
                  <p className="text-xs text-on-surface-variant font-medium">
                    Arraste ou clique para selecionar a planilha Excel (.xlsx, .xls) ou CSV contendo os dados.
                  </p>
                </div>

                {/* Drag-and-drop area */}
                <div className="relative group border-2 border-dashed border-surface-container-highest hover:border-primary/50 bg-surface-container-low/30 hover:bg-surface-container-low/70 rounded-[32px] p-12 transition-all cursor-pointer flex flex-col items-center justify-center text-center">
                  <input 
                    type="file" 
                    accept=".xlsx,.xls,.csv" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={handleFileChange}
                  />
                  <div className="w-16 h-16 bg-primary/10 group-hover:bg-primary text-primary group-hover:text-white rounded-[24px] flex items-center justify-center transition-all shadow-md">
                    <UploadCloud size={32} />
                  </div>
                  <h4 className="text-sm font-black text-on-surface uppercase tracking-wider mt-6">Clique ou Arraste a planilha aqui</h4>
                  <p className="text-[11px] text-on-surface-variant font-medium mt-1">Formatos compatíveis: Excel (.xlsx, .xls) ou CSV de até 10MB</p>
                </div>

                {/* Templates download section */}
                <div className="bg-surface-container-low border border-surface-container-high rounded-[24px] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-on-surface uppercase tracking-widest">Baixar Planilha Modelo Padrão</h4>
                      <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Clique para baixar o arquivo no formato do Portal Cliente (Fertipar, Piratini, etc).</p>
                    </div>
                  </div>
                  <button
                    onClick={downloadTemplate}
                    className="w-full sm:w-auto px-5 py-3 bg-white hover:bg-surface-container-high border border-surface-container-high text-on-surface text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <Download size={14} />
                    Baixar Planilha Padrão
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: MAPPING COLUMNS */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8"
              >
                {/* Auto Recognition Status Alert */}
                {isAutoRecognized && (
                  <div className="bg-green-50 border border-green-200 text-green-800 rounded-3xl p-6 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-black text-lg shrink-0">
                      ✓
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-green-900">✓ Estrutura reconhecida automaticamente. Nenhum mapeamento é necessário.</h4>
                      <p className="text-xs text-green-700 font-medium mt-0.5">Todas as colunas do padrão oficial do Portal Cliente (Fertipar) foram detectadas e vinculadas perfeitamente.</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low border border-surface-container-high p-6 rounded-[24px]">
                  <div>
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-widest">Associação de Colunas</h3>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-1">
                      Mapeie as colunas da planilha aos respectivos campos do sistema (as colunas ausentes ficarão em branco).
                    </p>
                  </div>

                  {savedModels.length > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Mapeamento Salvo:</span>
                      <select
                        value={selectedModelId}
                        onChange={(e) => handleModelSelect(e.target.value)}
                        className="bg-white border border-surface-container-high px-4 py-2.5 rounded-xl text-xs font-bold text-on-surface focus:outline-none shadow-sm"
                      >
                        <option value="">-- Mapeamento Padrão / Automático --</option>
                        {savedModels.map(m => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Form layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {systemFields.map(field => (
                    <div key={field.key} className="bg-white border border-surface-container-high rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mt-1 ${field.required ? 'bg-primary/5 text-primary' : 'bg-surface-container-high/50 text-on-surface-variant'}`}>
                        {field.key === 'codigoUnidade' ? <Building2 size={18} /> : <FileText size={18} />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black uppercase tracking-wider text-on-surface">
                            {field.label} {field.required && <span className="text-primary">*</span>}
                          </label>
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${field.required ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-50 text-gray-500'}`}>
                            {field.required ? 'Obrigatório' : 'Opcional'}
                          </span>
                        </div>
                        <p className="text-[10px] text-on-surface-variant font-medium">{field.desc}</p>
                        
                        <select
                          value={mapping[field.key] || ''}
                          onChange={(e) => {
                            setMapping({ ...mapping, [field.key]: e.target.value });
                            setIsAutoRecognized(false);
                          }}
                          className={`w-full bg-surface-container-low border rounded-xl px-4 py-2.5 text-xs font-bold mt-2 focus:outline-none transition-all ${
                            mapping[field.key] 
                              ? 'border-primary text-primary bg-primary/5' 
                              : field.required 
                                ? 'border-surface-container-highest text-on-surface-variant' 
                                : 'border-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          <option value="">-- Escolha uma coluna --</option>
                          {fileHeaders.map(header => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save model settings */}
                <div className="bg-surface-container-low border border-surface-container-high rounded-[24px] p-6 space-y-4 max-w-md">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAsModel}
                      onChange={(e) => setSaveAsModel(e.target.checked)}
                      className="w-4.5 h-4.5 accent-primary border border-surface-container-high rounded-md"
                    />
                    <span className="text-xs font-black uppercase tracking-widest text-on-surface select-none">Salvar este mapeamento para o futuro?</span>
                  </label>
                  
                  {saveAsModel && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-1 pl-7.5"
                    >
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nome do Modelo (ex: Modelo Fertipar)</label>
                      <input
                        type="text"
                        placeholder="Insira o nome do modelo"
                        value={newModelName}
                        onChange={(e) => setNewModelName(e.target.value)}
                        className="w-full bg-white border border-surface-container-high rounded-xl px-4 py-3 text-xs font-medium focus:outline-none"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Action button */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-surface-container-high">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-4 bg-white border border-surface-container-high text-on-surface text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-surface-container-low transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleMappingConfirm}
                    className="px-6 py-4 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
                  >
                    Validar Registros
                    <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: VALIDATION AND PREVIEW */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8"
              >
                {/* Stats cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-100 p-6 rounded-[24px] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-green-800 uppercase tracking-widest">Novos Equipamentos</p>
                      <p className="text-3xl font-black text-green-900 mt-1">{stats.newCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-black">
                      +
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-100 p-6 rounded-[24px] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Já Cadastrados (Atualizar)</p>
                      <p className="text-3xl font-black text-orange-900 mt-1">{stats.updateCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center">
                      ↻
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-100 p-6 rounded-[24px] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-red-800 uppercase tracking-widest">Inconsistências / Erros</p>
                      <p className="text-3xl font-black text-red-900 mt-1">{stats.errorCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-lg font-black">
                      !
                    </div>
                  </div>
                </div>

                {/* Table Preview */}
                <div className="border border-surface-container-high rounded-[32px] overflow-hidden bg-white shadow-sm flex flex-col">
                  <div className="bg-surface-container-low px-6 py-4 border-b border-surface-container-high flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-on-surface">Visualização de Registros</h3>
                    <span className="text-[10px] font-bold text-on-surface-variant">Mostrando {validatedData.length} linhas</span>
                  </div>

                  <div className="overflow-x-auto max-h-[350px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-surface-container-high">
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Linha Planilha</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Status</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Empresa</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Unidade / Filial</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">N° Série</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">IP do Equipamento</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Fuso Horário</th>
                          <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Detalhes / Alertas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-high">
                        {validatedData.map((item) => (
                          <tr key={item.rowNum} className="hover:bg-surface-container-low/30 transition-colors">
                            <td className="px-6 py-4 text-xs font-bold text-on-surface-variant">Linha {item.rowNum}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                item.status === 'Novo' 
                                  ? 'bg-green-50 text-green-700 border-green-100' 
                                  : item.status === 'Atualizar' 
                                    ? 'bg-orange-50 text-orange-700 border-orange-100' 
                                    : 'bg-red-50 text-red-700 border-red-100'
                              }`}>
                                {item.status === 'Novo' ? 'Novo' : item.status === 'Atualizar' ? 'Atualizar' : 'Inconsistente'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-on-surface truncate max-w-[120px]" title={item.data.nomeEmpresa}>{item.data.nomeEmpresa || '-'}</td>
                            <td className="px-6 py-4 text-xs font-bold text-on-surface truncate max-w-[120px]" title={item.data.unidadeNome}>{item.data.unidadeNome || '-'}</td>
                            <td className="px-6 py-4 text-xs font-bold text-on-surface font-mono">{item.data.numeroSerie || '-'}</td>
                            <td className="px-6 py-4 text-xs font-medium text-on-surface font-mono">{item.data.ipEquipamento || '-'}</td>
                            <td className="px-6 py-4 text-xs font-medium text-on-surface font-mono">{item.data.fusoHorario || '-'}</td>
                            <td className="px-6 py-4">
                              {item.errors.length > 0 ? (
                                <div className="flex items-center gap-1.5 text-red-600">
                                  <AlertTriangle size={14} />
                                  <span className="text-[10px] font-bold truncate max-w-[150px]" title={item.errors.join(', ')}>
                                    {item.errors.join(', ')}
                                  </span>
                                </div>
                              ) : item.status === 'Atualizar' ? (
                                <span className="text-[10px] text-orange-600 font-bold">Já cadastrado. Será atualizado.</span>
                              ) : (
                                <span className="text-[10px] text-green-600 font-bold">Pronto para importar</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Confirm section */}
                <div className="flex items-center justify-between pt-6 border-t border-surface-container-high">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-4 bg-white border border-surface-container-high text-on-surface text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-surface-container-low transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={executeImport}
                    disabled={stats.newCount + stats.updateCount === 0}
                    className="px-6 py-4 bg-primary disabled:bg-primary/50 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
                  >
                    Iniciar Importação
                    <Play size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: RESULT */}
            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md mx-auto py-10 text-center space-y-8"
              >
                {importing ? (
                  <div className="space-y-6">
                    <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                      <Loader2 className="animate-spin text-primary w-20 h-20" />
                      <span className="absolute text-xs font-black text-on-surface">{importProgress}%</span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-black text-on-surface uppercase tracking-tight">Importando Equipamentos...</h3>
                      <p className="text-xs text-on-surface-variant font-medium">
                        Identificando/criando empresas, filiais, unidades, fuso horários, IPs e atualizando os ativos em tempo real...
                      </p>
                    </div>
                    
                    {/* Progress details */}
                    <div className="bg-surface-container-low border border-surface-container-high p-4 rounded-2xl grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Concluídos</p>
                        <p className="text-lg font-black text-primary">{importedLogs.success}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Falhas</p>
                        <p className="text-lg font-black text-red-600">{importedLogs.error}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="w-20 h-20 bg-green-50 text-green-600 rounded-[32px] flex items-center justify-center mx-auto shadow-md">
                      <CheckCircle2 size={40} />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-on-surface uppercase tracking-tight">Importação Concluída!</h3>
                      <p className="text-xs text-on-surface-variant font-medium">
                        Os registros válidos da planilha foram processados, com as empresas, filiais, unidades e equipamentos criados ou atualizados diretamente no sistema!
                      </p>
                    </div>

                    {/* Result stats summary */}
                    <div className="bg-surface-container-low border border-surface-container-high p-6 rounded-[28px] divide-y divide-surface-container-high text-left">
                      <div className="py-3 flex items-center justify-between text-xs">
                        <span className="font-bold text-on-surface-variant">Total processado:</span>
                        <span className="font-black text-on-surface">{validatedData.length} registros</span>
                      </div>
                      <div className="py-3 flex items-center justify-between text-xs">
                        <span className="font-bold text-on-surface-variant">Importados / Atualizados:</span>
                        <span className="font-black text-green-600">{importedLogs.success} itens</span>
                      </div>
                      <div className="py-3 flex items-center justify-between text-xs">
                        <span className="font-bold text-on-surface-variant">Ignorados / Com Erros:</span>
                        <span className="font-black text-red-600">{stats.errorCount + importedLogs.error} itens</span>
                      </div>
                    </div>

                    <button
                      onClick={onClose}
                      className="w-full px-6 py-4 bg-primary hover:bg-primary/90 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-primary/20"
                    >
                      Concluir e Fechar
                    </button>
                  </div>
                )}
              </motion.div>
            )}
            
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
