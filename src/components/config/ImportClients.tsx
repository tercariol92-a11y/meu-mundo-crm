import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  ChevronRight, 
  Table, 
  History, 
  Loader2,
  Trash2,
  Filter,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, doc, updateDoc } from '../../services/resilientFirestoreClient';
import { Cliente, Usuario, ImportHistory } from '../../types';
import { toast } from 'react-hot-toast';
import { importService } from '../../services/importService';

interface ImportClientsProps {
  user: Usuario;
}

interface SpreadsheetRow {
  nome_fantasia?: string;
  razao_social?: string;
  cnpj?: string;
  cpf?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  contato?: string;
  observacoes?: string;
  [key: string]: any;
}

export default function ImportClients({ user }: ImportClientsProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'result'>('upload');
  const [fileData, setFileData] = useState<SpreadsheetRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [duplicatesMode, setDuplicatesMode] = useState<'update' | 'ignore'>('ignore');
  const [progress, setProgress] = useState(0);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [summary, setSummary] = useState({
    total: 0,
    imported: 0,
    updated: 0,
    ignored: 0,
    errors: [] as { line: number; message: string }[]
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'import_history'),
        where('type', '==', 'clientes'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImportHistory));
      setImportHistory(history);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as SpreadsheetRow[];
        
        if (data.length === 0) {
          toast.error('Planilha vazia');
          return;
        }

        setFileData(data);
        setStep('preview');
      } catch (error) {
        toast.error('Erro ao ler arquivo. Verifique se o formato está correto.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws_data = [
      ['nome_fantasia', 'razao_social', 'cnpj', 'cpf', 'telefone', 'whatsapp', 'email', 'endereco', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'contato', 'observacoes'],
      ['Mundo Tech Ltda', 'Mundo Tech Soluções em Tecnologia', '00.000.000/0001-00', '', '(11) 4004-0000', '(11) 99999-9999', 'contato@mundotech.com.br', 'Rua das Flores', '123', 'Centro', 'São Paulo', 'SP', '01001-000', 'Jefferson', 'Cliente preferencial']
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo Importação");
    XLSX.writeFile(wb, "modelo_importacao_clientes.xlsx");
  };

  const cleanMask = (val: any) => {
    if (!val) return '';
    return String(val).replace(/\D/g, '');
  };

  const startImport = async () => {
    setStep('processing');
    setProgress(0);
    
    try {
      // Fake progress for UX
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 500);

      const result = await importService.importClients({
        clients: fileData,
        duplicatesMode,
        userId: user.id,
        userName: user.nome,
        fileName
      });

      clearInterval(interval);
      setProgress(100);

      if (result.success) {
        setSummary(result.summary);
        setStep('result');
        loadHistory();
        toast.success('Importação concluída!');
      } else {
        throw new Error(result.error || 'Erro desconhecido na importação.');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(`Erro na importação: ${err.message}`);
      setStep('preview');
    }
  };

  return (
    <div className="space-y-6 p-1 bg-surface">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-on-surface uppercase tracking-tight">Importação de Clientes</h2>
          <p className="text-sm text-on-surface-variant italic">Adicione múltiplos clientes de uma só vez usando planilhas Excel ou CSV.</p>
        </div>
        <button 
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all border border-primary/20"
        >
          <Download size={16} />
          Baixar Modelo
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-[32px] border border-surface-container-high overflow-hidden">
        {step === 'upload' && (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Upload size={40} />
            </div>
            <div>
              <h3 className="text-lg font-black text-on-surface uppercase tracking-widest">Upload de Planilha</h3>
              <p className="text-sm text-on-surface-variant max-w-md mx-auto">
                Arraste seu arquivo ou clique no botão abaixo. Suportamos formatos .xlsx, .xls e .csv.
              </p>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 transition-all"
            >
              Selecionar Arquivo
            </button>
          </div>
        )}

        {step === 'preview' && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-primary" />
                <span className="font-bold text-on-surface">{fileName}</span>
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-lg">
                  {fileData.length} REGISTROS
                </span>
              </div>
              <button 
                onClick={() => setStep('upload')}
                className="text-xs font-bold text-on-surface-variant hover:text-red-500 underline"
              >
                Remover arquivo
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-container-low p-6 rounded-2xl border border-surface-container-high space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Se houver CPF/CNPJ duplicado:</h4>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setDuplicatesMode('ignore')}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${
                      duplicatesMode === 'ignore' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-surface-container-highest hover:bg-surface-container-high'
                    }`}
                  >
                    <p className="text-xs font-black uppercase tracking-widest text-on-surface">Ignorar</p>
                    <p className="text-[10px] text-on-surface-variant mt-1">Mantém o cadastro atual e ignora o item da planilha.</p>
                  </button>
                  <button 
                    onClick={() => setDuplicatesMode('update')}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${
                      duplicatesMode === 'update' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-surface-container-highest hover:bg-surface-container-high'
                    }`}
                  >
                    <p className="text-xs font-black uppercase tracking-widest text-on-surface">Atualizar</p>
                    <p className="text-[10px] text-on-surface-variant mt-1">Sobrescreve os dados do cliente com as informações da planilha.</p>
                  </button>
                </div>
              </div>

              <div className="bg-surface-container-low p-6 rounded-2xl border border-surface-container-high space-y-4 overflow-hidden">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Prévia dos dados:</h4>
                <div className="max-h-[200px] overflow-auto custom-scrollbar border rounded-xl">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-white">
                      <tr>
                        {Object.keys(fileData[0] || {}).slice(0, 4).map(key => (
                          <th key={key} className="p-2 text-left border-b font-black uppercase tracking-widest">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fileData.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {Object.values(row).slice(0, 4).map((val, j) => (
                            <td key={j} className="p-2 text-on-surface-variant truncate max-w-[100px]">{String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-surface-container-high">
              <button 
                onClick={() => setStep('upload')}
                className="px-6 py-3 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
              >
                Voltar
              </button>
              <button 
                onClick={startImport}
                className="px-10 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                Processar Importação
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="p-16 flex flex-col items-center justify-center space-y-8">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle className="text-surface-container-highest" strokeWidth="6" stroke="currentColor" fill="transparent" r="44" cx="50" cy="50" />
                <circle 
                  className="text-primary transition-all duration-300" 
                  strokeWidth="6" 
                  strokeDasharray={2 * Math.PI * 44}
                  strokeDashoffset={2 * Math.PI * 44 * (1 - progress / 100)}
                  strokeLinecap="round" 
                  stroke="currentColor" 
                  fill="transparent" 
                  r="44" cx="50" cy="50" 
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black text-primary">{progress}%</span>
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-black text-on-surface uppercase tracking-widest">Processando Clientes...</h3>
              <p className="text-sm text-on-surface-variant mt-2">Por favor, não feche esta página até concluir.</p>
            </div>
          </div>
        )}

        {step === 'result' && (
          <div className="p-8 space-y-8">
            <div className="flex items-center gap-4 p-6 bg-green-50 border border-green-100 rounded-[24px]">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <CheckCircle2 size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-green-800 font-black uppercase tracking-widest">Importação Concluída!</h3>
                <p className="text-green-700/80 text-xs">O arquivo foi processado com sucesso. Confira o resumo abaixo.</p>
              </div>
              <button 
                onClick={() => setStep('upload')}
                className="px-6 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-105 active:scale-95 transition-all"
              >
                Nova Importação
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Lido', value: summary.total, color: 'text-on-surface-variant' },
                { label: 'Importados', value: summary.imported, color: 'text-green-600' },
                { label: 'Atualizados', value: summary.updated, color: 'text-blue-600' },
                { label: 'Duplicados', value: summary.ignored, color: 'text-amber-600' },
              ].map(stat => (
                <div key={stat.label} className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{stat.label}</p>
                  <p className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {summary.errors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-[24px] overflow-hidden">
                <div className="p-4 bg-red-100/50 border-b border-red-100 flex items-center gap-2">
                  <AlertCircle size={18} className="text-red-600" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-red-800">Erros encontrados ({summary.errors.length})</h4>
                </div>
                <div className="max-h-[200px] overflow-auto custom-scrollbar p-4 space-y-2">
                  {summary.errors.map((err, i) => (
                    <div key={i} className="flex gap-4 text-xs">
                      <span className="font-bold text-red-800">Linha {err.line}:</span>
                      <span className="text-red-700">{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History Section */}
      <div className="bg-surface-container-lowest rounded-[32px] border border-surface-container-high overflow-hidden">
        <div className="px-8 py-6 border-b border-surface-container-high flex items-center gap-3">
          <History size={20} className="text-primary" />
          <h3 className="text-sm font-black text-on-surface uppercase tracking-widest">Histórico de Importações</h3>
        </div>
        <div className="p-0">
          {isLoadingHistory ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-primary opacity-20" size={32} />
            </div>
          ) : importHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-container-low border-b border-surface-container-high">
                    <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Data/Hora</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Usuário</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Arquivo</th>
                    <th className="px-8 py-4 text-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Total</th>
                    <th className="px-8 py-4 text-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Sucesso</th>
                    <th className="px-8 py-4 text-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Erro</th>
                    <th className="px-8 py-4 text-center text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {importHistory.map((hist) => (
                    <tr key={hist.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-8 py-4 text-xs font-bold text-on-surface">
                        {new Date(hist.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-8 py-4 text-xs text-on-surface-variant">{hist.userName}</td>
                      <td className="px-8 py-4 text-xs text-on-surface italic">{hist.fileName}</td>
                      <td className="px-8 py-4 text-center text-xs font-bold">{hist.totalRecords}</td>
                      <td className="px-8 py-4 text-center text-xs font-bold text-green-600">{hist.importedCount}</td>
                      <td className="px-8 py-4 text-center text-xs font-bold text-red-600">{hist.errorCount}</td>
                      <td className="px-8 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          hist.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {hist.status === 'completed' ? 'Concluído' : 'Falha'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-on-surface-variant opacity-40">
              <Users size={48} className="mx-auto mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhuma importação encontrada</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
