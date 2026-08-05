import React, { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { WhatsAppConfig, WhatsAppTemplate } from '../../types';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { 
  Save, 
  Loader2, 
  Plus, 
  Trash2, 
  Settings2, 
  CheckCircle2, 
  AlertCircle,
  MessageSquare,
  Key,
  Database,
  Type,
  QrCode,
  Wifi,
  WifiOff,
  Smartphone,
  Power,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseApiResponse } from '../../utils/apiResponse';

export default function WhatsAppSettings() {
  const authenticatedWhatsAppFetch = async (url: string, init: RequestInit = {}) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Sessão do usuário não autenticada.');
    return fetch(getAbsoluteUrl(url), { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  };
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mode Selection State
  const [integrationType, setIntegrationType] = useState<'official' | 'qrcode' | 'meta'>('meta');
  const [whatsappProvider, setWhatsappProvider] = useState<'meta' | 'gupshup' | 'baileys'>('meta');
  const [sessionStatus, setSessionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'qrcode'>('disconnected');
  const [sessionPhone, setSessionPhone] = useState<string>('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [sessionOwnerUid, setSessionOwnerUid] = useState<string>('');
  
  // Official Config Fields
  const [formData, setFormData] = useState({
    apiKey: '',
    appName: '',
    source: ''
  });

  // Integration Test state
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Diagnostics, Verify Environment & Sync states
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [envVerify, setEnvVerify] = useState<any>(null);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  
  // Test Send state
  const [testPhone, setTestPhone] = useState('');
  const [testTemplateAlias, setTestTemplateAlias] = useState('');
  const [testParams, setTestParams] = useState('');
  const [testingTemplate, setTestingTemplate] = useState(false);
  const [testResultStatus, setTestResultStatus] = useState<'success' | 'error' | null>(null);
  const [testResultDetails, setTestResultDetails] = useState('');
  const [testTrace, setTestTrace] = useState<any[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const getAbsoluteUrl = (path: string) => {
    try {
      const origin = window.location.origin && window.location.origin !== 'null'
        ? window.location.origin
        : (window.location.href && window.location.href.startsWith('http') ? new URL(window.location.href).origin : '');
      if (origin && origin !== 'null' && (origin.startsWith('http://') || origin.startsWith('https://'))) {
        return `${origin.replace(/\/$/, '')}${path}`;
      }
    } catch (e) {
      console.warn('Failed to resolve absolute URL:', e);
    }
    return path;
  };

  const loadDiagnostics = async () => {
    setLoadingDiagnostics(true);
    try {
      const res = await authenticatedWhatsAppFetch('/api/whatsapp/diagnostics');
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      } else {
        console.warn('Diagnostics response was not ok:', res.status, res.statusText);
      }
    } catch (err: any) {
      console.error('Error fetching WhatsApp diagnostics:', err);
      if (err instanceof Error) {
        console.error('Diagnostics error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
      }
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  const loadEnvironmentVerification = async () => {
    setLoadingVerify(true);
    try {
      const res = await authenticatedWhatsAppFetch('/api/whatsapp/verify-environment', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setEnvVerify(data);
      } else {
        console.warn('Verify environment response was not ok:', res.status, res.statusText);
      }
    } catch (err: any) {
      console.error('Error verifying environment:', err);
      if (err instanceof Error) {
        console.error('Verify environment error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
      }
    } finally {
      setLoadingVerify(false);
    }
  };

  const handleCompleteDiagnostics = async () => {
    setLoadingVerify(true);
    setLoadingDiagnostics(true);
    try {
      const p1 = authenticatedWhatsAppFetch('/api/whatsapp/diagnostics').then(r => r.ok ? r.json() : null);
      const p2 = authenticatedWhatsAppFetch('/api/whatsapp/verify-environment', { method: 'POST' }).then(r => r.ok ? r.json() : null);
      const [diagData, verifyData] = await Promise.all([p1, p2]);
      if (diagData) setDiagnostics(diagData);
      if (verifyData) setEnvVerify(verifyData);
    } catch (err) {
      console.error('Error executing complete diagnostics:', err);
    } finally {
      setLoadingVerify(false);
      setLoadingDiagnostics(false);
    }
  };

  const handleSyncTemplates = async () => {
    setSyncingTemplates(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(getAbsoluteUrl('/api/whatsapp/sync-templates'), { method: 'POST' });
      const data = await parseApiResponse(res, { method: 'POST', uid: auth.currentUser?.uid });
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao sincronizar templates.');
      }
      setSuccess(`Sincronização realizada com sucesso! ${data.syncedCount} templates importados (${data.approvedCount} aprovados/ativos).`);
      
      // Refresh template lists
      const templatesData = await databaseService.getWhatsAppTemplates();
      setTemplates(templatesData || []);
      
      // Refresh diagnostics and verification
      await loadDiagnostics();
      await loadEnvironmentVerification();
    } catch (err: any) {
      console.error('Error syncing templates:', err);
      setError(err.message || 'Erro durante sincronização de templates da Gupshup.');
    } finally {
      setSyncingTemplates(false);
    }
  };

  const handleTestTemplateSend = async () => {
    if (!testPhone || !testTemplateAlias) {
      setTestResultStatus('error');
      setTestResultDetails('Insira o número do telefone de destino e selecione o template.');
      return;
    }

    setTestingTemplate(true);
    setTestResultStatus(null);
    setTestResultDetails('');
    setTestTrace([]);

    try {
      const paramsArray = testParams ? testParams.split(',').map(s => s.trim()) : [];
      
      const res = await fetch(getAbsoluteUrl('/api/whatsapp/send-template'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: testPhone,
          templateName: testTemplateAlias,
          params: paramsArray
        })
      });

      const data = await res.json();

      if (data.trace) {
        setTestTrace(data.trace);
      }

      if (res.ok && data.success) {
        setTestResultStatus('success');
        setTestResultDetails(`Sucesso! Mensagem enviada via ${data.method || 'API'}. Conteúdo: "${data.message || ''}"`);
        // Refresh diagnostics logs
        await loadDiagnostics();
        await loadEnvironmentVerification();
      } else {
        setTestResultStatus('error');
        setTestResultDetails(`Falha no Envio: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (err: any) {
      console.error('Error testing template send:', err);
      setTestResultStatus('error');
      setTestResultDetails(`Falha de Conexão: ${err.message || 'Erro na requisição'}`);
    } finally {
      setTestingTemplate(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
    loadEnvironmentVerification();
  }, []);

  useEffect(() => {
    // 1. Fetch templates
    const fetchTemplates = async () => {
      try {
        const templatesData = await databaseService.getWhatsAppTemplates();
        setTemplates(templatesData || []);
      } catch (err) {
        console.error('Error fetching templates:', err);
      }
    };
    fetchTemplates();

    // 2. Real-time config listener
    const configCollection = collection(db, 'whatsapp_config');
    const unsubscribe = onSnapshot(configCollection, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const configData = { id: doc.id, ...doc.data() } as WhatsAppConfig;
        setConfig(configData);
        setFormData({
          apiKey: configData.apiKey || '',
          appName: configData.appName || '',
          source: configData.source || ''
        });
        const prov = configData.whatsappProvider || 'meta';
        const integration = configData.integrationType || (prov === 'meta' ? 'meta' : prov === 'baileys' ? 'qrcode' : 'official');
        setWhatsappProvider(prov as any);
        setIntegrationType(integration as any);
      } else {
        setConfig(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('Error subscribing to whatsapp_config in real-time:', err);
      setError('Erro ao carregar configurações do banco de dados em tempo real.');
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let unsubscribeSession: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeSession?.();
      unsubscribeSession = undefined;
      setSessionData(null);
      setSessionPhone('');
      setSessionStatus('disconnected');
      setSessionOwnerUid(firebaseUser?.uid || '');
      if (!firebaseUser?.uid) return;

      const sessionRef = doc(db, 'whatsapp_sessions', firebaseUser.uid);
      unsubscribeSession = onSnapshot(sessionRef, (snapshot) => {
        if (!snapshot.exists()) {
          setSessionData(null);
          setSessionPhone('');
          setSessionStatus('disconnected');
          return;
        }
        const ownSession = { id: snapshot.id, ...snapshot.data() } as any;
        if (ownSession.userId && ownSession.userId !== firebaseUser.uid) {
          console.error('[WhatsApp Session] Documento de sessão não pertence ao usuário autenticado.');
          setSessionData(null);
          setSessionPhone('');
          setSessionStatus('disconnected');
          return;
        }
        setSessionData(ownSession);
        setSessionPhone(ownSession.phone || ownSession.sessionPhone || '');
        setSessionStatus(ownSession.status || 'disconnected');
      }, (sessionError) => {
        console.error('[WhatsApp Session] Falha ao consultar sessão do UID:', firebaseUser.uid, sessionError);
        setSessionData(null);
        setSessionPhone('');
        setSessionStatus('disconnected');
      });
    });
    return () => {
      unsubscribeSession?.();
      unsubscribeAuth();
    };
  }, []);

  const handleSaveConfig = async (newProvider?: 'meta' | 'gupshup' | 'baileys') => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const activeProvider = newProvider || whatsappProvider;
      const dataToSave = {
        ...formData,
        integrationType: (activeProvider === 'meta' ? 'meta' : activeProvider === 'baileys' ? 'qrcode' : 'official') as 'official' | 'qrcode' | 'meta',
        whatsappProvider: activeProvider,
      };
      
      if (config) {
        await databaseService.updateWhatsAppConfig(config.id, dataToSave);
      } else {
        await databaseService.createWhatsAppConfig(dataToSave);
      }
      setSuccess('Configurações salvas com sucesso!');
      await loadDiagnostics();
      await loadEnvironmentVerification();
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  // Real WhatsApp QR session handlers
  const handleGenerateQR = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await authenticatedWhatsAppFetch('/api/whatsapp/qr/connect', { method: 'POST' });
      const data = await parseApiResponse(res, { method: 'POST', uid: auth.currentUser?.uid });
      if (!res.ok) throw new Error(data.error || 'Falha ao iniciar conexão.');
      setSuccess('Sessão de conexão inicializada na nuvem com sucesso! Gerando o QR Code...');
      if (data.status) {
        setSessionData(data.status);
        setSessionStatus(data.status.status || 'connecting');
      }

      const deadline = Date.now() + 45_000;
      while (Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 750));
        const statusResponse = await authenticatedWhatsAppFetch('/api/whatsapp/qr/status');
        const statusBody = await parseApiResponse(statusResponse, { method: 'GET', uid: auth.currentUser?.uid });
        if (!statusResponse.ok) throw new Error(statusBody.error || 'Falha ao consultar o QR Code.');
        const ownStatus = statusBody.status;
        if (!ownStatus || ownStatus.uid !== auth.currentUser?.uid) {
          throw new Error('O servidor retornou uma sessão que não pertence ao usuário autenticado.');
        }
        setSessionData(ownStatus);
        setSessionPhone(ownStatus.sessionPhone || '');
        setSessionStatus(ownStatus.status || 'disconnected');
        if (ownStatus.status === 'qrcode' && ownStatus.qrCodeDataUrl) {
          setSuccess('QR Code gerado. Leia-o com o WhatsApp deste usuário.');
          return;
        }
        if (ownStatus.status === 'connected') {
          setSuccess('WhatsApp conectado com sucesso.');
          return;
        }
        if (ownStatus.status === 'disconnected') {
          throw new Error('A sessão foi encerrada antes da geração do QR Code. Tente novamente.');
        }
      }
      throw new Error('Tempo esgotado aguardando a geração do QR Code.');
    } catch (err: any) {
      console.error('Error connecting to QR API:', err);
      setError(err.message || 'Erro ao inicializar sessão de QR Code.');
    } finally {
      setSaving(false);
    }
  };

  const handleReconnectQR = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await authenticatedWhatsAppFetch('/api/whatsapp/qr/reconnect', { method: 'POST' });
      const data = await parseApiResponse(res, { method: 'POST', uid: auth.currentUser?.uid });
      if (!res.ok) throw new Error(data.error || 'Falha ao reiniciar canais.');
      setSuccess('Reconexão solicitada com sucesso! Gerando novo código QR...');
    } catch (err: any) {
      console.error('Error reconnecting QR:', err);
      setError(err.message || 'Erro ao reinicializar conexão.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectQR = async () => {
    if (!confirm('Deseja desvincular seu telefone e desconectar sua sessão do CRM?')) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await authenticatedWhatsAppFetch('/api/whatsapp/qr/disconnect', { method: 'POST' });
      const data = await parseApiResponse(res, { method: 'POST', uid: auth.currentUser?.uid });
      if (!res.ok) throw new Error(data.error || 'Falha ao encerrar.');
      setSuccess('Sessão encerrada e dispositivo removido com sucesso!');
    } catch (err: any) {
      console.error('Error disconnecting from QR API:', err);
      setError(err.message || 'Erro ao desvincular aparelho.');
    } finally {
      setSaving(false);
    }
  };

  // Run Integration Tests
  const handleRunTest = async () => {
    setTesting(true);
    setTestError(null);
    setTestResults(null);
    try {
      const res = await authenticatedWhatsAppFetch('/api/whatsapp/qr/run-test', { method: 'POST' });
      const data = await parseApiResponse(res, { method: 'POST', uid: auth.currentUser?.uid });
      if (!res.ok) throw new Error(data.error || 'A suíte de testes retornou falhas.');
      setTestResults(data);
    } catch (err: any) {
      console.error('Error in run-test request:', err);
      setTestError(err.message || 'Erro crítico ao rodar testes.');
    } finally {
      setTesting(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const newTemplate = await databaseService.createWhatsAppTemplate({
        name: 'Novo Template',
        alias: 'novo_alias',
        language: 'pt_BR',
        category: 'MARKETING',
        status: 'PENDING'
      });
      if (newTemplate) {
        setTemplates([...templates, newTemplate]);
      }
    } catch (err) {
      console.error('Error creating template:', err);
    }
  };

  const handleUpdateTemplate = async (id: string, data: Partial<WhatsAppTemplate>) => {
    try {
      await databaseService.updateWhatsAppTemplate(id, data);
      setTemplates(templates.map(t => t.id === id ? { ...t, ...data } : t));
    } catch (err) {
      console.error('Error updating template:', err);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;
    try {
      await databaseService.deleteWhatsAppTemplate(id);
      setTemplates(templates.filter(t => t.id !== id));
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10">
      {/* Selector Section */}
      <section className="bg-surface-container-low p-6 rounded-[32px] border border-surface-container-high space-y-6 shadow-sm">
        <div className="space-y-1.5">
          <h2 className="text-lg font-black uppercase tracking-tight text-primary flex items-center gap-2">
            <MessageSquare size={20} />
            Estratégia de Integração com WhatsApp
          </h2>
          <p className="text-xs text-on-surface-variant">
            Escolha o modelo de conexão ideal para sua empresa. A plataforma suporta múltiplos canais transparentes no atendimento.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card 1: Official Meta API (Primary) */}
          <div 
            onClick={() => {
              setWhatsappProvider('meta');
              setIntegrationType('meta');
              handleSaveConfig('meta');
            }}
            className={`cursor-pointer group bg-surface-container-lowest p-6 rounded-3xl border transition-all relative ${
              whatsappProvider === 'meta' 
                ? 'border-primary shadow-lg ring-2 ring-primary/10' 
                : 'border-surface-container-high hover:border-primary/40'
            }`}
          >
            {whatsappProvider === 'meta' && (
              <span className="absolute top-4 right-4 bg-primary text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full">
                Ativo
              </span>
            )}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary mt-1">
                <ShieldCheck size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-on-surface">API Oficial Meta</h3>
                <span className="inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-success/10 text-success border border-success/20">
                  RECOMENDADO / PRINCIPAL
                </span>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  Conexão oficial direta e homologada pela Meta. Ideal para operações escaláveis com total segurança e estabilidade.
                </p>
                <ul className="text-[10px] text-on-surface-variant/90 space-y-1 pt-1 font-semibold">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={12} className="text-success" />
                    Estabilidade operacional ilimitada
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={12} className="text-success" />
                    Token e Phone ID protegidos no servidor
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={12} className="text-success" />
                    Envios via templates oficiais homologados
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Card 2: Official Gupshup API */}
          <div 
            onClick={() => {
              setWhatsappProvider('gupshup');
              setIntegrationType('official');
              handleSaveConfig('gupshup');
            }}
            className={`cursor-pointer group bg-surface-container-lowest p-6 rounded-3xl border transition-all relative ${
              whatsappProvider === 'gupshup' 
                ? 'border-indigo-500 shadow-lg ring-2 ring-indigo-500/10' 
                : 'border-surface-container-high hover:border-indigo-500/45'
            }`}
          >
            {whatsappProvider === 'gupshup' && (
              <span className="absolute top-4 right-4 bg-indigo-600 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full">
                Ativo
              </span>
            )}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600 mt-1">
                <Settings2 size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-on-surface">API Oficial Gupshup</h3>
                <span className="inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                  OPÇÃO ADICIONAL
                </span>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  Integração oficial através do gateway/broker parceiro Gupshup.
                </p>
                <ul className="text-[10px] text-on-surface-variant/90 space-y-1 pt-1 font-semibold">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={12} className="text-indigo-600" />
                    Garante disparos estáveis e integrados
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={12} className="text-indigo-600" />
                    Requer conta ativa na Gupshup
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={12} className="text-indigo-600" />
                    Configuração de chaves pela UI do CRM
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Card 3: QR Code (Baileys) */}
          <div 
            onClick={() => {
              setWhatsappProvider('baileys');
              setIntegrationType('qrcode');
              handleSaveConfig('baileys');
            }}
            className={`cursor-pointer group bg-surface-container-lowest p-6 rounded-3xl border transition-all relative ${
              whatsappProvider === 'baileys' 
                ? 'border-warning shadow-lg ring-2 ring-warning/10' 
                : 'border-surface-container-high hover:border-warning/40'
            }`}
          >
            {whatsappProvider === 'baileys' && (
              <span className="absolute top-4 right-4 bg-warning text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full">
                Ativo
              </span>
            )}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-warning/10 rounded-2xl text-warning mt-1">
                <QrCode size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-on-surface">QR Code (Web/Baileys)</h3>
                <span className="inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-warning/10 text-warning border border-warning/20">
                  SECUNDÁRIO / OPCIONAL
                </span>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  Similar ao WhatsApp Web. Conexão imediata por leitura de QR Code para faturamento e suporte direto.
                </p>
                <ul className="text-[10px] text-on-surface-variant/90 space-y-1 pt-1 font-semibold">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={12} className="text-warning" />
                    Fácil configuração instantânea
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={12} className="text-warning" />
                    Mapeamento direto com operadores
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={12} className="text-warning" />
                    Ideal para testes ou pequenas equipes
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WhatsApp Diagnostics & Test Suite Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Diagnostic Panel */}
        <div className="bg-surface-container-low border border-surface-container-high rounded-[32px] p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-primary">
              <ShieldCheck size={24} className="text-primary" />
              <h3 className="text-md font-black uppercase tracking-tight text-on-surface">Auditoria & Diagnóstico do WhatsApp</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCompleteDiagnostics}
                disabled={loadingDiagnostics || loadingVerify}
                className="px-4 py-2 bg-primary/10 hover:bg-primary/25 text-primary text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                title="Executar diagnóstico completo"
              >
                <RefreshCw size={14} className={(loadingDiagnostics || loadingVerify) ? 'animate-spin' : ''} />
                {(loadingDiagnostics || loadingVerify) ? 'Executando...' : 'Executar Diagnóstico Completo'}
              </button>
              {(integrationType === 'official' || integrationType === 'meta') && (
                <button
                  onClick={handleSyncTemplates}
                  disabled={syncingTemplates}
                  className="px-4 py-2 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all flex items-center gap-1.5 shadow-md shadow-primary/15"
                >
                  {syncingTemplates ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                  Sincronizar Templates
                </button>
              )}
            </div>
          </div>

          {/* Integration Mode and Connection Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-highest/35 p-4 rounded-2xl border border-surface-container-high space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">API Ativa</span>
              <p className="text-xs font-black text-on-surface uppercase font-sans">
                {diagnostics?.whatsappProvider === 'meta' ? 'API Oficial Meta — ATIVO' : diagnostics?.whatsappProvider === 'gupshup' ? 'API Oficial Gupshup — ATIVO' : 'QR Code Baileys — ATIVO'}
              </p>
            </div>

            <div className="bg-surface-container-highest/35 p-4 rounded-2xl border border-surface-container-high space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">Modo Ativo</span>
              <p className="text-xs font-extrabold text-on-surface uppercase font-sans">
                {diagnostics?.whatsappProvider === 'meta' ? 'API Oficial Meta' : diagnostics?.whatsappProvider === 'gupshup' ? 'API Oficial Gupshup' : 'QR Code (Baileys)'}
              </p>
            </div>

            <div className="bg-surface-container-highest/35 p-4 rounded-2xl border border-surface-container-high space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">Status API</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${diagnostics?.apiConnected ? 'bg-success animate-pulse' : 'bg-warning'}`} />
                <p className="text-xs font-extrabold text-on-surface uppercase">
                  {diagnostics?.apiConnected ? 'Conectado' : 'Desconectado'}
                </p>
              </div>
            </div>

            <div className="bg-surface-container-highest/35 p-4 rounded-2xl border border-surface-container-high space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">Número Vinculado</span>
              <p className="text-xs font-mono font-bold text-on-surface truncate">
                {diagnostics?.numberConnected || 'Desconectado'}
              </p>
            </div>
          </div>

          {diagnostics?.whatsappProvider === 'meta' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/10">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Phone Number ID</span>
                <p className="text-xs font-mono font-black text-on-surface">1044465882094403</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">Gupshup</span>
                <p className="text-xs font-extrabold text-error">Inativa</p>
              </div>
            </div>
          )}

          {/* Detailed Templates Metrics Section */}
          <div className="space-y-3 border-t border-surface-container-high pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70 block">Métricas Detalhadas dos Templates (Meta)</span>
              {diagnostics?.lastSync && diagnostics?.lastSync !== 'Nunca' && (
                <span className="text-[9px] text-on-surface-variant/50 font-semibold">Sincronizado: {new Date(diagnostics?.lastSync).toLocaleString('pt-BR')}</span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-surface-container-highest/15 p-3 rounded-xl border border-surface-container-high/60 flex flex-col justify-between">
                <span className="text-[9px] font-bold text-on-surface-variant/70 uppercase">Locais Firebase</span>
                <span className="text-xl font-black text-primary mt-1">{diagnostics?.localCount ?? 0}</span>
                <span className="text-[8px] text-on-surface-variant/40 mt-1">Gravados no Firestore</span>
              </div>

              <div className="bg-surface-container-highest/15 p-3 rounded-xl border border-surface-container-high/60 flex flex-col justify-between">
                <span className="text-[9px] font-bold text-on-surface-variant/70 uppercase">
                  {diagnostics?.whatsappProvider === 'meta' ? 'Templates Meta' : 'Encontrados Gupshup'}
                </span>
                <span className="text-xl font-black text-indigo-600 mt-1">{diagnostics?.metaCount ?? 0}</span>
                <span className="text-[8px] text-on-surface-variant/40 mt-1">Existentes na Meta/Gupshup</span>
              </div>

              <div className="bg-surface-container-highest/15 p-3 rounded-xl border border-surface-container-high/60 flex flex-col justify-between">
                <span className="text-[9px] font-bold text-on-surface-variant/70 uppercase">Sincronizados</span>
                <span className="text-xl font-black text-success mt-1">{diagnostics?.syncedCount ?? 0}</span>
                <span className="text-[8px] text-on-surface-variant/40 mt-1">Buscados com sucesso</span>
              </div>

              <div className="bg-success/5 p-3 rounded-xl border border-success/15 flex flex-col justify-between">
                <span className="text-[9px] font-bold text-success uppercase">Aprovados/Ativos</span>
                <span className="text-xl font-black text-success mt-1">{diagnostics?.approvedCount ?? 0}</span>
                <span className="text-[8px] text-success/60 mt-1">Prontos para envio</span>
              </div>

              <div className="bg-warning/5 p-3 rounded-xl border border-warning/15 flex flex-col justify-between">
                <span className="text-[9px] font-bold text-warning uppercase">Pendentes</span>
                <span className="text-xl font-black text-warning mt-1">{diagnostics?.pendingCount ?? 0}</span>
                <span className="text-[8px] text-warning/60 mt-1">Aguardando Meta</span>
              </div>

              <div className="bg-error/5 p-3 rounded-xl border border-error/15 flex flex-col justify-between">
                <span className="text-[9px] font-bold text-error uppercase">Rejeitados</span>
                <span className="text-xl font-black text-error mt-1">{diagnostics?.rejectedCount ?? 0}</span>
                <span className="text-[8px] text-error/60 mt-1">Desativados/Rejeitados</span>
              </div>
            </div>

            {/* Contextual Explanations for 0 / Missing items */}
            {diagnostics?.syncedCount === 0 && (
              <div className="bg-warning/5 border border-dashed border-warning/30 p-3 rounded-xl text-[11px] text-warning font-semibold flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-extrabold uppercase text-[9px]">Pendente de Sincronização Inicial</p>
                  <p className="text-[10px] leading-relaxed mt-0.5 text-on-surface-variant/80">Nenhum template importado na base de dados ainda. Clique em &quot;Sincronizar Templates&quot; acima para buscar os modelos cadastrados no gateway Meta ou Gupshup de forma transparente.</p>
                </div>
              </div>
            )}

            {!diagnostics?.apiConnected && (
              <div className="bg-error/5 border border-dashed border-error/30 p-3 rounded-xl text-[11px] text-error font-semibold flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-extrabold uppercase text-[9px]">Credenciais Inválidas ou Desconectadas</p>
                  <p className="text-[10px] leading-relaxed mt-0.5 text-on-surface-variant/80">
                    O servidor não pôde estabelecer comunicação com o gateway {whatsappProvider === 'meta' ? 'da Meta (Graph API)' : whatsappProvider === 'gupshup' ? 'da Gupshup' : 'Baileys'}. Por favor, verifique as chaves e variáveis de ambiente configuradas no servidor para restabelecer a integração oficial.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-surface-container-high pt-4 space-y-3">
            <div className="space-y-1.5 bg-surface-container-highest/20 p-3.5 rounded-2xl border border-surface-container-high/65">
              <div className="flex items-center gap-1.5 text-on-surface text-xs font-extrabold uppercase tracking-wide">
                <Database size={14} className="text-primary" />
                Histórico Operacional Recente
              </div>
              <div className="space-y-1 text-[11px] font-medium text-on-surface-variant leading-relaxed">
                <p><strong className="text-on-surface font-semibold">Último Envio de Template:</strong> {diagnostics?.lastSendOutcome || 'Nenhum envio registrado'}</p>
                <p><strong className="text-on-surface font-semibold">Último Erro Retornado:</strong> {diagnostics?.lastApiError ? <span className="text-error font-extrabold">{diagnostics.lastApiError}</span> : <span className="text-success font-extrabold">Nenhum erro registrado</span>}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Test Template Tool */}
        <div className="bg-surface-container-low border border-surface-container-high rounded-[32px] p-8 space-y-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-primary">
              <Play size={22} className="text-primary" />
              <h3 className="text-md font-black uppercase tracking-tight text-on-surface">Testar Envio de Template</h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Realize disparos em tempo real para homologar o correto funcionamento das variáveis de ambiente, status do template, e mapeamento de alias.
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Telefone de Destino</label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Ex: 5511999999999"
                    className="w-full bg-surface-container-highest/40 border border-surface-container-high rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-slate-800 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Selecione o Template (Alias)</label>
                  <select
                    value={testTemplateAlias}
                    onChange={(e) => setTestTemplateAlias(e.target.value)}
                    className="w-full bg-surface-container-highest/40 border border-surface-container-high rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-slate-800 font-medium"
                  >
                    <option value="">Selecione...</option>
                    {templates.filter(t => (t.status || '').toUpperCase() === 'APPROVED' || (t.status || '').toUpperCase() === 'ACTIVE').map(t => (
                      <option key={t.id} value={t.alias}>{t.alias} ({t.templateName || t.name})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex justify-between">
                  <span>Variáveis do Parâmetro (Opcionais)</span>
                  <span className="text-[8px] font-bold text-on-surface-variant/50 lowercase">separadas por vírgula</span>
                </label>
                <input
                  type="text"
                  value={testParams}
                  onChange={(e) => setTestParams(e.target.value)}
                  placeholder="Ex: João, Protocolo-552, Equipe Técnica"
                  className="w-full bg-surface-container-highest/40 border border-surface-container-high rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-slate-800 font-medium"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            {/* Real-time sending trace steps visualization */}
            {testTrace && testTrace.length > 0 && (
              <div className="bg-surface-container-highest/40 border border-surface-container-high p-3 rounded-2xl space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/80 block">Histórico de Rastreamento (Trace)</span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {testTrace.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[10px] leading-relaxed">
                      {step.status === 'success' ? (
                        <CheckCircle size={12} className="text-success mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle size={12} className="text-error mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <span className="font-extrabold text-on-surface">{step.step}:</span>{' '}
                        <span className="text-on-surface-variant/90">{step.details}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {testResultStatus && (
              <div className={`p-4 rounded-2xl text-xs font-bold flex items-start gap-2.5 ${
                testResultStatus === 'success' ? 'bg-success/10 text-success border border-success/15' : 'bg-error/10 text-error border border-error/15'
              }`}>
                {testResultStatus === 'success' ? <CheckCircle size={16} className="mt-0.5" /> : <AlertTriangle size={16} className="mt-0.5" />}
                <div className="space-y-0.5">
                  <p className="font-extrabold uppercase text-[10px] tracking-wider">
                    {testResultStatus === 'success' ? 'Envio Autorizado' : 'Erro Identificado'}
                  </p>
                  <p className="text-[11px] leading-relaxed font-semibold">{testResultDetails}</p>
                </div>
              </div>
            )}

            <button
              onClick={handleTestTemplateSend}
              disabled={testingTemplate}
              className="w-full py-3 bg-primary hover:scale-[1.01] transition-transform text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              {testingTemplate ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              Disparar Teste de Template
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Credential Checklist & Real-time Audit Timeline */}
      {integrationType === 'official' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 8 Connection Checks Checklist */}
          <div className="bg-surface-container-low border border-surface-container-high rounded-[32px] p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={22} className="text-primary" />
                <h3 className="text-md font-black uppercase tracking-tight text-on-surface">Auditoria de Credenciais e Conexões</h3>
              </div>
              <button
                onClick={handleCompleteDiagnostics}
                disabled={loadingVerify || loadingDiagnostics}
                className="px-4 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-1.5 hover:scale-[1.02] transition-all shadow-md shadow-primary/10"
              >
                {(loadingVerify || loadingDiagnostics) ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                {(loadingVerify || loadingDiagnostics) ? 'Diagnosticando...' : 'Executar Diagnóstico Completo'}
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Verifique a integridade e conformidade de todos os canais de integração ativos e credenciais cadastradas na plataforma em tempo real.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {envVerify?.results ? (
                Object.entries(envVerify.results)
                  .filter(([key]) => ['apiKey', 'appName', 'sourceNumber', 'apiConnection', 'templatesQuery', 'webhook', 'firestore', 'storage'].includes(key))
                  .map(([key, value]: [string, any]) => (
                    <div
                      key={key}
                      className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-colors ${
                        value.status === 'success' 
                          ? 'bg-success/5 border-success/20 text-success-foreground' 
                          : value.status === 'error' 
                          ? 'bg-error/5 border-error/20 text-error-foreground' 
                          : 'bg-surface-container-highest/20 border-surface-container-high'
                      }`}
                    >
                      {value.status === 'success' ? (
                        <CheckCircle size={18} className="text-success flex-shrink-0 mt-0.5" />
                      ) : value.status === 'error' ? (
                        <AlertCircle size={18} className="text-error flex-shrink-0 mt-0.5" />
                      ) : (
                        <Loader2 className="animate-spin text-muted-foreground flex-shrink-0 mt-0.5" size={18} />
                      )}
                      <div className="truncate space-y-0.5">
                        <p className="text-xs font-black uppercase tracking-wider text-on-surface leading-tight">{value.label || key}</p>
                        <p className="text-[11px] font-semibold text-on-surface-variant truncate leading-relaxed" title={value.details}>
                          {value.details || 'Verificação pendente'}
                        </p>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="col-span-full py-8 flex flex-col items-center justify-center text-on-surface-variant/40 gap-2">
                  <ShieldCheck size={32} />
                  <p className="text-xs font-bold uppercase tracking-wider">Aguardando Validação</p>
                  <p className="text-[10px] font-semibold text-center max-w-xs leading-relaxed mt-1">Toque no botão &quot;Validar Credenciais&quot; acima para realizar uma bateria de 8 testes ao vivo no servidor.</p>
                </div>
              )}
            </div>
          </div>

          {/* Audit Logs Timeline Panel */}
          <div className="bg-surface-container-low border border-surface-container-high rounded-[32px] p-8 space-y-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <Database size={22} className="text-primary" />
                <h3 className="text-md font-black uppercase tracking-tight text-on-surface">Histórico de Eventos & Linha do Tempo</h3>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Acompanhe a sequência em tempo real de eventos operacionais, envios de templates, confirmações de webhook e logs de erros.
              </p>

              <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-2">
                {diagnostics?.auditLogs && diagnostics.auditLogs.length > 0 ? (
                  diagnostics.auditLogs.map((log: any) => {
                    const isExpanded = expandedLogId === log.id;
                    const dateStr = log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : 'Sem data';
                    return (
                      <div
                        key={log.id}
                        className="p-3.5 bg-surface-container-lowest border border-surface-container-high rounded-2xl space-y-2 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {log.status === 'success' ? (
                                <span className="w-2.5 h-2.5 rounded-full bg-success inline-block shadow-sm" />
                              ) : (
                                <span className="w-2.5 h-2.5 rounded-full bg-error inline-block shadow-sm animate-pulse" />
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold uppercase text-on-surface">
                                {log.type === 'webhook' ? 'Mensagem Recebida (Webhook)' : 
                                 log.type === 'send_template' ? 'Mensagem Enviada (Template)' : 
                                 log.type === 'sync' ? 'Sincronização de Templates' : 
                                 log.type === 'connection_test' ? 'Teste de Conexão' : log.type || 'Evento'}
                              </p>
                              <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-wider">{dateStr} • {log.provider || 'gupshup'}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="text-[9px] font-black uppercase text-primary hover:underline px-2.5 py-1 bg-primary/5 rounded"
                          >
                            {isExpanded ? 'Ocultar' : 'Detalhes'}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="bg-surface-container-highest/20 p-3 rounded-xl border border-surface-container-high/65 text-[10px] font-mono overflow-x-auto text-slate-700 space-y-2">
                            {log.destination && <p><strong>Destino:</strong> {log.destination}</p>}
                            {log.templateAlias && <p><strong>Template Alias:</strong> {log.templateAlias}</p>}
                            {log.errorMessage && <p className="text-error"><strong>Erro:</strong> {log.errorMessage}</p>}
                            {log.response && (
                              <div>
                                <strong className="block text-on-surface-variant text-[9px] uppercase tracking-wider mb-1">Payload de Resposta:</strong>
                                <pre className="p-2 bg-slate-900 text-slate-100 rounded text-[9px] leading-relaxed max-h-48 overflow-y-auto">
                                  {JSON.stringify(log.response, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant/40 gap-3 border border-dashed border-surface-container-high rounded-2xl">
                    <Database size={32} />
                    <p className="text-xs font-black uppercase tracking-widest text-[#777]">Nenhum log gravado</p>
                    <p className="text-[10px] font-semibold text-center max-w-xs leading-relaxed text-[#999]">A linha do tempo exibirá eventos assim que envios forem disparados ou webhooks recebidos.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advisory Notification if QR Code is Active */}
      <AnimatePresence>
        {integrationType === 'qrcode' && (
          <motion.section 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-warning/5 border-2 border-dashed border-warning/30 p-6 rounded-[32px] space-y-4">
              <div className="flex items-center gap-3 text-warning">
                <AlertTriangle size={24} />
                <h3 className="font-black text-sm uppercase tracking-wider">Aviso Importante ao Usuário Administrador</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-on-surface-variant font-medium">
                <div className="space-y-2.5">
                  <p className="font-extrabold text-warning">A modalidade via QR Code é uma conexão alternativa:</p>
                  <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
                    <li>Indicada principalmente para pequenas operações manuais.</li>
                    <li>Sua estabilidade depende da conexão de rede do seu smartphone.</li>
                    <li>Pode sofrer desconexões inesperadas devido a restrições do protocolo WhatsApp Web.</li>
                  </ul>
                </div>
                <div className="space-y-2.5 md:border-l md:border-surface-container-high md:pl-6">
                  <p className="font-extrabold text-error">Limitações Operacionais:</p>
                  <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-on-surface-variant/95">
                    <li>Requer eventual re-escaneamento físico do QR Code no console.</li>
                    <li><strong className="text-error">Não recomendado</strong> para disparos automáticos massivos de marketing ou campanhas.</li>
                    <li>Não substitui as vantagens avançadas, filtros e homologações oficiais da API da Meta.</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="bg-surface-container-low border border-surface-container-high rounded-[32px] p-8 shadow-sm">
        <AnimatePresence mode="wait">
          {whatsappProvider === 'meta' ? (
            /* Meta Config View */
            <motion.div
              key="meta-view"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-primary">
                  <ShieldCheck size={24} className="text-success" />
                  <h2 className="text-md font-black uppercase tracking-tight text-on-surface">Configuração de Segurança - API Oficial Meta</h2>
                </div>
              </div>

              <div className="bg-success/5 border border-dashed border-success/30 p-6 rounded-2xl space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={24} className="text-success mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-black uppercase tracking-wider text-on-surface">Proteção de Credenciais Ativa</h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Conforme as diretrizes de segurança da Meta e do Mundo CRM, seu <strong className="text-on-surface">Token de Acesso Permanente</strong> e o <strong className="text-on-surface">Phone Number ID</strong> estão armazenados com segurança nas variáveis de ambiente protegidas do servidor (Vercel).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-surface-container-highest/35 rounded-xl border border-surface-container-high/60 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">Token Meta</p>
                      <p className="text-xs font-semibold text-on-surface mt-1">Configurado pelo servidor (Seguro)</p>
                    </div>
                    <span className="px-2.5 py-1 bg-success/10 text-success text-[9px] font-black uppercase tracking-wider rounded-md border border-success/20">Ativo</span>
                  </div>

                  <div className="p-4 bg-surface-container-highest/35 rounded-xl border border-surface-container-high/60 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">Phone Number ID</p>
                      <p className="text-xs font-mono font-black text-on-surface mt-1">1044465882094403</p>
                    </div>
                    <span className="px-2.5 py-1 bg-success/10 text-success text-[9px] font-black uppercase tracking-wider rounded-md border border-success/20">Ativo</span>
                  </div>

                  <div className="p-4 bg-surface-container-highest/35 rounded-xl border border-surface-container-high/60 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">WhatsApp Business Account ID</p>
                      <p className="text-xs font-semibold text-on-surface mt-1">Configurado pelo servidor via API</p>
                    </div>
                    <span className="px-2.5 py-1 bg-success/10 text-success text-[9px] font-black uppercase tracking-wider rounded-md border border-success/20">Ativo</span>
                  </div>

                  <div className="p-4 bg-surface-container-highest/35 rounded-xl border border-surface-container-high/60 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">Número Vinculado Real</p>
                      <p className="text-xs font-mono font-bold text-on-surface mt-1">+55 41 9658-5672</p>
                    </div>
                    <span className="px-2.5 py-1 bg-success/10 text-success text-[9px] font-black uppercase tracking-wider rounded-md border border-success/20">Ativo</span>
                  </div>
                </div>

                <p className="text-[11px] text-on-surface-variant/80 font-medium leading-relaxed">
                  💡 <strong className="text-on-surface font-semibold">Nota:</strong> Se precisar alterar o número ou o token da sua conta Meta, basta atualizar as variáveis de ambiente na sua hospedagem. Nenhum dado sensível é exposto ou salvo no banco do frontend.
                </p>
              </div>
            </motion.div>
          ) : whatsappProvider === 'gupshup' ? (
            /* Gupshup Config View */
            <motion.div
              key="gupshup-view"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-primary">
                  <Settings2 size={24} />
                  <h2 className="text-md font-black uppercase tracking-tight text-on-surface">Credenciais Gupshup / WhatsApp API Oficial</h2>
                </div>
                <button
                  onClick={() => handleSaveConfig('gupshup')}
                  disabled={saving}
                  className="px-6 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all flex items-center gap-2 group shadow-lg shadow-primary/20"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} className="group-hover:rotate-12 transition-transform" />}
                  Salvar Configurações
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                    <Key size={14} />
                    Gupshup API Key
                  </label>
                  <input
                    type="password"
                    className="w-full bg-surface-container-highest/50 border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-slate-800 font-medium"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="Insira sua API Key do Gupshup"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                    <Database size={14} />
                    App Name
                  </label>
                  <input
                    type="text"
                    className="w-full bg-surface-container-highest/50 border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono text-slate-800"
                    value={formData.appName}
                    onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                    placeholder="Ex: MeuAppWA"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                    <MessageSquare size={14} />
                    Source Number
                  </label>
                  <input
                    type="text"
                    className="w-full bg-surface-container-highest/50 border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono text-slate-800"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    placeholder="Ex: 5511999999999"
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            /* QR Code Connection View */
            <motion.div
              key="qrcode-view"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 text-primary">
                <QrCode size={24} />
                <h2 className="text-md font-black uppercase tracking-tight">Controle de Sessão e Conexão QR Code Real</h2>
              </div>

              {/* Status Row */}
              <div className="bg-surface-container-highest/45 p-6 rounded-3xl border border-surface-container-high flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${
                    sessionStatus === 'connected' ? 'bg-success/10 text-success' : 
                    sessionStatus === 'connecting' || sessionStatus === 'qrcode' ? 'bg-warning/10 text-warning animate-pulse' : 'bg-surface-container-high text-on-surface-variant'
                  }`}>
                    {sessionStatus === 'connected' ? <Wifi size={32} /> : <WifiOff size={32} />}
                  </div>
                  <div className="space-y-1 text-center md:text-left">
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status da Integração</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${sessionStatus === 'connected' ? 'bg-success' : 'bg-warning animate-ping'}`} />
                    </div>
                    <p className="text-lg font-black uppercase text-on-surface">
                      {sessionStatus === 'connected' ? 'Sessão Conectada' : 
                       sessionStatus === 'connecting' ? 'Conectando...' : 
                       sessionStatus === 'qrcode' ? 'Aguardando Leitura' : 'Nenhuma sessão conectada'}
                    </p>
                    {sessionStatus === 'connected' && (
                      <div className="text-xs text-on-surface-variant font-medium space-y-1 mt-1">
                        <p className="font-mono text-success font-medium">Canais Vinculados: {sessionPhone || 'N/A'}</p>
                        {sessionData?.lastConnectedAt && <p className="text-[10px]">Última Conexão: {sessionData.lastConnectedAt}</p>}
                        {sessionData && (
                          <p className="text-[10px]">Nome da Sessão: {sessionData.sessionName || `whatsapp_${sessionOwnerUid}`}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 justify-center">
                  {sessionStatus === 'disconnected' && (
                    <button
                      onClick={handleGenerateQR}
                      disabled={saving}
                      className="px-6 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-primary/10"
                    >
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <Power size={18} />}
                      Gerar QR Code
                    </button>
                  )}

                  {(sessionStatus === 'qrcode' || sessionStatus === 'connecting') && (
                    <>
                      <button
                        onClick={handleReconnectQR}
                        disabled={saving}
                        className="px-6 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all flex items-center gap-1.5 shadow-lg shadow-primary/10"
                      >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                        Gerar Novo QR / Reconectar
                      </button>

                      <button
                        onClick={handleDisconnectQR}
                        disabled={saving}
                        className="px-6 py-2.5 bg-error text-white text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all flex items-center gap-2 shadow-md shadow-error/15"
                      >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Power size={18} />}
                        Desconectar Sessão
                      </button>
                    </>
                  )}

                  {sessionStatus === 'connected' && (
                    <>
                      <button
                        onClick={handleReconnectQR}
                        disabled={saving}
                        className="px-6 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all flex items-center gap-1.5 shadow-lg shadow-primary/10"
                      >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                        Reconectar
                      </button>

                      <button
                        onClick={handleDisconnectQR}
                        disabled={saving}
                        className="px-6 py-2.5 bg-error text-white text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all flex items-center gap-2 shadow-md shadow-error/15"
                      >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Power size={18} />}
                        Desconectar Sessão
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* QR display containers */}
              <AnimatePresence mode="wait">
                {sessionStatus === 'connecting' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center p-8 border border-dashed border-primary/20 rounded-3xl bg-primary/5 gap-4 h-64"
                  >
                    <Loader2 className="animate-spin text-primary" size={36} />
                    <div className="space-y-1 text-center">
                      <p className="text-sm font-bold uppercase tracking-wider text-primary">Inicializando Sessão Real no Servidor...</p>
                      <p className="text-[11px] text-on-surface-variant/70 font-semibold max-w-sm mt-1">Conectando ao daemon daemon do Baileys para puxar os tokens em tempo real. Isso pode levar alguns segundos.</p>
                    </div>
                  </motion.div>
                )}

                {sessionStatus === 'qrcode' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-surface-container-lowest border border-surface-container-high rounded-3xl"
                  >
                    {/* Visual QR Code display from server */}
                    <div className="flex flex-col items-center justify-center w-full">
                      {sessionData?.qrCodeDataUrl ? (
                        <div className="flex flex-col items-center justify-center border-2 border-primary/10 p-4 rounded-2xl relative bg-white shadow-inner max-w-sm mx-auto w-full">
                          <div className="relative p-2 bg-white rounded-lg">
                            <img src={sessionData.qrCodeDataUrl} alt="WhatsApp QR Code Real" className="w-52 h-52 object-contain" />
                            {/* Scrolling scan line animation */}
                            <div className="absolute inset-x-0 h-1 bg-primary/70 shadow-lg shadow-primary/50 top-1/2 animate-[bounce_3s_infinite]" />
                          </div>
                          <span className="text-[9px] font-mono font-black text-on-surface-variant/40 tracking-[0.2em] mt-3 uppercase">Código gerado via Baileys</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-primary/20 rounded-2xl bg-primary/5 gap-4 h-64 w-full">
                          <Loader2 className="animate-spin text-primary" size={36} />
                          <p className="text-xs font-bold uppercase tracking-widest text-[#666] text-center">Sincronizando feed e instanciando o QR Code...</p>
                        </div>
                      )}
                    </div>

                    {/* Step Instructions */}
                    <div className="flex flex-col justify-center space-y-4 font-sans">
                      <div className="flex items-center gap-2 text-primary font-black uppercase text-xs tracking-wider">
                        <Smartphone size={18} />
                        Instruções de Emparelhamento
                      </div>
                      <ol className="list-decimal pl-5 space-y-2 text-xs text-on-surface-variant font-medium leading-relaxed">
                        <li>Abra seu aplicativo do WhatsApp no telefone pessoal cadastrado.</li>
                        <li>Toque no menu de três pontos no topo ou em <strong>Configurações</strong> e escolha <strong>Aparelhos Conectados</strong>.</li>
                        <li>Selecione a opção de <strong>Conectar um aparelho</strong>.</li>
                        <li>Aponte a câmera do celular para o código QR à esquerda para efetuar o login instantâneo.</li>
                      </ol>

                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-3">
                        <HelpCircle size={18} className="text-primary mt-0.5" />
                        <p className="text-[11px] text-on-surface-variant font-semibold leading-relaxed">
                          A sessão e o QR Code se renovam de forma 100% dinâmica. Assim que ler o QR, a tela será atualizada de forma assíncrona notificando o status <strong>Conectado</strong>.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* INTEGRATION TESTING PANEL */}
              <div className="mt-8 bg-surface-container-lowest border border-surface-container-high rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck size={22} className="text-success" />
                    <h3 className="text-sm font-black uppercase tracking-tight text-on-surface">Console de Testes Integrados CRM & WhatsApp</h3>
                  </div>
                  <button
                    onClick={handleRunTest}
                    disabled={testing}
                    className="px-4 py-2 bg-success text-white text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5 hover:scale-105 transition-all shadow-md shadow-success/15"
                  >
                    {testing ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                    {testing ? 'Comitando Testes...' : 'Executar Suíte de Testes'}
                  </button>
                </div>

                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Trata-se de uma suíte automatizada rodando no backend para certificar as pontas da integração. Ela cria um lead simulado, valida o envio de mensagens do CRM para o WhatsApp, monitora a captação e resposta de mensagens recebidas, armazena o histórico em Firestore para auditorias futuras e conduz uma interrupção seguida por reconexão para provar a resiliência e integridade das mensagens sem qualquer perda.
                </p>

                {testError && (
                  <div className="p-3 bg-error/10 text-error rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertTriangle size={16} /> Corretor de Testes: {testError}
                  </div>
                )}

                {testResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-surface-container-highest/60 rounded-2xl border border-surface-container-high space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Relatório da Suíte: {testResults.testSuite}</span>
                      <span className="px-2 py-0.5 bg-success/20 text-success text-[9px] font-black uppercase tracking-widest rounded">
                        {testResults.overallStatus}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {testResults.results?.map((res: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-xs bg-surface-container-lowest p-2.5 rounded-xl border border-surface-container-high">
                          <CheckCircle className="text-success mt-0.5 flex-shrink-0" size={14} />
                          <div>
                            <p className="font-bold text-on-surface">{res.step}</p>
                            <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">{res.details}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-error/10 text-error text-xs font-bold rounded-2xl flex items-center gap-3"
            >
              <AlertCircle size={18} />
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-success/10 text-success text-xs font-bold rounded-2xl flex items-center gap-3"
            >
              <CheckCircle2 size={18} />
              {success}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Templates Mapping (Available for official/both, as mapped above gracefully too!) */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-primary">
            <Type size={24} />
            <h2 className="text-xl font-black uppercase tracking-tight">Mapeamento de Templates de Mensagens</h2>
          </div>
          <button
            onClick={handleCreateTemplate}
            className="px-6 py-2.5 bg-surface-container-high text-on-surface text-xs font-black uppercase tracking-widest rounded-xl hover:bg-surface-container-highest transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Novo Template
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {templates
            .filter(t => integrationType === 'qrcode' || !t.provider || t.provider === 'gupshup')
            .map((template) => (
            <div 
              key={template.id} 
              className="bg-surface-container-low p-6 rounded-3xl border border-surface-container-high space-y-4 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <input
                    type="text"
                    className="bg-transparent border-none p-0 text-sm font-black uppercase tracking-tight focus:ring-0 w-full text-slate-800 font-sans font-extrabold"
                    value={template.templateName || template.name || 'Novo Template'}
                    onChange={(e) => handleUpdateTemplate(template.id, { templateName: e.target.value, name: e.target.value })}
                  />
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">Nome do Template</div>
                </div>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="p-2 text-error/40 hover:text-error hover:bg-error/10 rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">Alias no Código</label>
                  <input
                    type="text"
                    className="w-full bg-surface-container-highest/50 border border-surface-container-high rounded-xl px-3 py-2 text-xs font-mono focus:ring-primary/20 text-slate-800"
                    value={template.alias || ''}
                    onChange={(e) => handleUpdateTemplate(template.id, { alias: e.target.value })}
                    placeholder="ex: chamado_aberto"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">Id Real / Nome Meta</label>
                  <input
                    type="text"
                    className="w-full bg-surface-container-highest/50 border border-surface-container-high rounded-xl px-3 py-2 text-xs font-mono focus:ring-primary/20 text-slate-800"
                    value={template.templateId || template.id || ''}
                    onChange={(e) => handleUpdateTemplate(template.id, { id: e.target.value, templateId: e.target.value })}
                    placeholder="ID do Gupshup/Meta"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                  template.status === 'APPROVED' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                }`}>
                  {template.status || 'STATUS'}
                </span>
                <span className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest font-bold">
                  {template.language} • {template.category}
                </span>
              </div>
            </div>
          ))}
          
          {templates.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-on-surface-variant/40 gap-4 border-2 border-dashed border-surface-container-high rounded-[32px]">
              <MessageSquare size={48} />
              <p className="text-xs font-black uppercase tracking-widest">Nenhum template mapeado</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
