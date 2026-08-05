import React, { useState, useEffect } from 'react';
import { 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Loader2, 
  RefreshCw, 
  Map, 
  Lock, 
  ShieldCheck,
  Mail,
  Eye,
  EyeOff,
  Server
} from 'lucide-react';
import { prospectingService } from '../../services/prospectingService';
import { Usuario } from '../../types';
import { toast } from 'react-hot-toast';

interface IntegrationsSettingsProps {
  user: Usuario;
}

export default function IntegrationsSettings({ user }: IntegrationsSettingsProps) {
  // Google Maps Platform States
  const [apiKey, setApiKey] = useState('');
  const [statusInfo, setStatusInfo] = useState<{
    configured: boolean;
    maskedKey: string;
    status: string;
    error?: string;
  }>({
    configured: false,
    maskedKey: '',
    status: 'Sem configuração'
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // SMTP Settings States
  const [smtpForm, setSmtpForm] = useState({
    host: '',
    port: 587,
    secureType: 'TLS' as 'SSL' | 'TLS' | 'Nenhuma',
    emailRemetente: '',
    nomeRemetente: '',
    usuario: '',
    senha: ''
  });
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean;
    host?: string;
    port?: number;
    secureType?: 'SSL' | 'TLS' | 'Nenhuma';
    emailRemetente?: string;
    nomeRemetente?: string;
    usuario?: string;
    maskedPassword?: string;
  }>({
    configured: false
  });
  const [isSmtpEditing, setIsSmtpEditing] = useState(false);
  const [isSmtpSaving, setIsSmtpSaving] = useState(false);
  const [isSmtpTesting, setIsSmtpTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [smtpDiagnosticMsg, setSmtpDiagnosticMsg] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    loadKeyStatus();
    loadSmtpStatus();
  }, []);

  const loadKeyStatus = async () => {
    setIsLoading(true);
    try {
      const res = await prospectingService.getGoogleMapsKeyStatus();
      setStatusInfo(res);
      if (!res.configured) {
        setIsEditing(true);
      } else {
        setIsEditing(false);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao buscar status da chave de API.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSmtpStatus = async () => {
    try {
      const res = await prospectingService.getSmtpStatus();
      setSmtpStatus(res);
      if (res.configured) {
        setSmtpForm({
          host: res.host || '',
          port: res.port || 587,
          secureType: res.secureType || 'TLS',
          emailRemetente: res.emailRemetente || '',
          nomeRemetente: res.nomeRemetente || '',
          usuario: res.usuario || '',
          senha: res.maskedPassword || ''
        });
        setIsSmtpEditing(false);
      } else {
        setIsSmtpEditing(true);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao buscar status do servidor SMTP.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() && isEditing && statusInfo.configured) {
      setIsEditing(false);
      setApiKey('');
      return;
    }

    setIsLoading(true);
    const saveToast = toast.loading('Salvando e testando chave de API...');
    try {
      const res = await prospectingService.saveGoogleMapsKey(apiKey, user.email || user.id, user.role);
      if (res.success) {
        toast.success('Chave de API salva com sucesso!', { id: saveToast });
        setStatusInfo({
          configured: !!apiKey.trim() || statusInfo.configured,
          maskedKey: res.maskedKey,
          status: res.status,
          error: res.error
        });
        setApiKey('');
        setIsEditing(false);
      } else {
        toast.error(res.error || 'Erro ao validar e salvar a chave de API.', { id: saveToast });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro ao conectar ao servidor.', { id: saveToast });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    const testToast = toast.loading('Testando conexão com a API do Google Places...');
    try {
      const res = await prospectingService.testGoogleMapsKey();
      
      const updatedStatus = await prospectingService.getGoogleMapsKeyStatus();
      setStatusInfo(updatedStatus);

      if (res.success) {
        toast.success('Conexão estabelecida com sucesso!', { id: testToast });
      } else {
        toast.error(`Falha no teste: ${res.error || 'Erro de permissão'}`, { id: testToast });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro ao testar a chave de API.', { id: testToast });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpForm.host || !smtpForm.port || !smtpForm.secureType || !smtpForm.emailRemetente || !smtpForm.nomeRemetente || !smtpForm.usuario || !smtpForm.senha) {
      toast.error('Preencha todos os campos obrigatórios!');
      return;
    }

    setIsSmtpSaving(true);
    const saveToast = toast.loading('Salvando parâmetros do servidor SMTP...');
    try {
      const res = await prospectingService.saveSmtp({
        host: smtpForm.host,
        port: smtpForm.port,
        secureType: smtpForm.secureType,
        emailRemetente: smtpForm.emailRemetente,
        nomeRemetente: smtpForm.nomeRemetente,
        usuario: smtpForm.usuario,
        senha: smtpForm.senha
      });

      if (res.success) {
        toast.success('SMTP configurado e salvo com sucesso!', { id: saveToast });
        setIsSmtpEditing(false);
        setSmtpDiagnosticMsg({ type: '', text: '' });
        await loadSmtpStatus();
      } else {
        toast.error(res.error || 'Erro ao salvar configurações do SMTP.', { id: saveToast });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro ao salvar SMTP.', { id: saveToast });
    } finally {
      setIsSmtpSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!smtpForm.host || !smtpForm.port || !smtpForm.secureType || !smtpForm.emailRemetente || !smtpForm.nomeRemetente || !smtpForm.usuario || !smtpForm.senha) {
      toast.error('Preencha os campos obrigatórios para poder testar!');
      return;
    }

    setIsSmtpTesting(true);
    const testToast = toast.loading('Testando conexão SMTP e enviando e-mail de teste...');
    try {
      const res = await prospectingService.testSmtp({
        host: smtpForm.host,
        port: smtpForm.port,
        secureType: smtpForm.secureType,
        emailRemetente: smtpForm.emailRemetente,
        nomeRemetente: smtpForm.nomeRemetente,
        usuario: smtpForm.usuario,
        senha: smtpForm.senha,
        testEmail: user.email // Envia para o próprio usuário logado
      });

      if (res.success) {
        toast.success(res.message || 'Operação realizada com sucesso!', { id: testToast });
        setSmtpDiagnosticMsg({
          type: 'success',
          text: `Sucesso: Autenticação SMTP validada! E-mail de teste encaminhado para ${user.email}.`
        });
      } else {
        toast.error(res.error || 'Falha na conexão SMTP.', { id: testToast });
        setSmtpDiagnosticMsg({
          type: 'error',
          text: `Erro de Autenticação / Conexão:\n\n${res.error}`
        });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro de conexão com o servidor.', { id: testToast });
      setSmtpDiagnosticMsg({
        type: 'error',
        text: `Erro do Sistema:\n\n${e.message}`
      });
    } finally {
      setIsSmtpTesting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
        <Lock size={48} className="text-red-500 mb-4 opacity-70" />
        <h3 className="font-extrabold text-on-surface uppercase tracking-wider text-base mb-1">Acesso Negado</h3>
        <p className="text-xs text-on-surface-variant max-w-sm">Apenas administradores podem gerenciar chaves e integrações de API.</p>
      </div>
    );
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'API configurada':
        return {
          bg: 'bg-green-500/10 border-green-500/20 text-green-500',
          icon: <CheckCircle2 size={18} className="text-green-500" />,
          label: 'API configurada',
          desc: 'A chave está válida e o Google Places está funcionando perfeitamente.'
        };
      case 'Sem permissão':
        return {
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
          icon: <AlertTriangle size={18} className="text-amber-500" />,
          label: 'Sem permissão',
          desc: 'A chave existe mas a Places API (New) não está ativa ou a chave tem restrições no Console do Google Cloud.'
        };
      case 'API inválida':
        return {
          bg: 'bg-red-500/10 border-red-500/20 text-red-500',
          icon: <XCircle size={18} className="text-red-500" />,
          label: 'API inválida',
          desc: 'A chave de API informada é inválida ou expirou. Verifique o console do Google Cloud.'
        };
      case 'Sem configuração':
        return {
          bg: 'bg-surface-container-high border-surface-container-highest text-on-surface-variant',
          icon: <Key size={18} className="opacity-40" />,
          label: 'Sem configuração',
          desc: 'Nenhuma chave configurada. O sistema de buscas do Google Maps está inativo.'
        };
      default:
        return {
          bg: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
          icon: <RefreshCw size={18} className="text-blue-500 animate-spin" />,
          label: 'Verificando...',
          desc: 'Status da API está sendo verificado ou aguarda o primeiro teste.'
        };
    }
  };

  const statusStyle = getStatusStyle(statusInfo.status);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between border-b border-surface-container-high pb-5">
        <div>
          <h2 className="text-xl font-black text-on-surface uppercase tracking-tight flex items-center gap-2">
            <Key size={24} className="text-primary" />
            Integrações / APIs / Canais
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Configure credenciais externas e dados de SMTP/Google Maps do sistema Meu Mundo CRM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadKeyStatus();
              loadSmtpStatus();
            }}
            disabled={isLoading || isTesting || isSmtpSaving || isSmtpTesting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-container-high hover:bg-surface-container text-on-surface-variant text-xs font-bold transition-all disabled:opacity-50"
          >
            {isLoading || isSmtpSaving ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Atualizar Status Geral
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6 animate-in fade-in duration-300">
          
          {/* Form 1: Google Maps API key */}
          <form onSubmit={handleSave} className="bg-surface-container rounded-2xl border border-surface-container-high p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl">
                  <Map size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-extrabold text-on-surface text-sm uppercase tracking-wide">Google Maps Platform</h3>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Utilizado pelo módulo de Prospecção para varrer empresas diretamente do Google Places API (New).
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                  Chave Google Maps/Places API
                  <Lock size={12} className="opacity-40" />
                </label>
                
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <input 
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Cole sua chave de API (Ex: AIzaSy...)"
                      className="w-full bg-surface-container-lowest border border-surface-container-high focus:border-primary focus:ring-1 focus:ring-primary/20 text-on-surface text-xs font-semibold px-4 py-3 rounded-xl transition-all"
                      required={!statusInfo.configured}
                    />
                    <div className="flex gap-2 justify-end">
                      {statusInfo.configured && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditing(false);
                            setApiKey('');
                          }}
                          className="px-3 py-1.5 text-xs text-on-surface-variant font-bold hover:bg-surface-container-highest rounded-lg transition-all"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                      >
                        Salvar Chave
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3">
                    <span className="font-mono text-xs text-on-surface/80 tracking-widest">
                      {statusInfo.maskedKey || 'Chave não configurada'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="text-xs text-primary font-bold hover:underline"
                    >
                      Alterar Chave
                    </button>
                  </div>
                )}
              </div>

              {/* Passo a passo para ativação da API */}
              <div className="mt-4 pt-4 border-t border-surface-container-high space-y-3">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-primary" />
                  Passo a Passo para Ativar no Google Cloud:
                </h4>
                <ol className="text-[11px] text-on-surface-variant space-y-2.5 list-none pl-0 font-medium leading-relaxed">
                  <li className="flex gap-2.5 items-start">
                    <span className="flex-shrink-0 flex items-center justify-center bg-primary/10 text-primary font-black rounded-full w-5 h-5 text-[10px] mt-0.5">1</span>
                    <span>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">Google Cloud Console</a>.</span>
                  </li>
                  <li className="flex gap-2.5 items-start">
                    <span className="flex-shrink-0 flex items-center justify-center bg-primary/10 text-primary font-black rounded-full w-5 h-5 text-[10px] mt-0.5">2</span>
                    <span>Selecione o <strong>projeto correto</strong> no seletor de projetos no topo esquerdo do painel.</span>
                  </li>
                  <li className="flex gap-2.5 items-start">
                    <span className="flex-shrink-0 flex items-center justify-center bg-primary/10 text-primary font-black rounded-full w-5 h-5 text-[10px] mt-0.5">3</span>
                    <span>Ative a API <a href="https://console.developers.google.com/apis/api/places.googleapis.com/overview" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold hover:text-primary-dark">“Places API (New)”</a> em seu painel de APIs.</span>
                  </li>
                  <li className="flex gap-2.5 items-start">
                    <span className="flex-shrink-0 flex items-center justify-center bg-primary/10 text-primary font-black rounded-full w-5 h-5 text-[10px] mt-0.5">4</span>
                    <span>Confirme que o faturamento do projeto (<strong>faturamento/billing</strong>) está ativo e configurado corretamente.</span>
                  </li>
                  <li className="flex gap-2.5 items-start">
                    <span className="flex-shrink-0 flex items-center justify-center bg-primary/10 text-primary font-black rounded-full w-5 h-5 text-[10px] mt-0.5">5</span>
                    <span>Verifique se as <strong>restrições de credenciais</strong> da sua chave de API dão permissão para utilizar a biblioteca Google Places.</span>
                  </li>
                  <li className="flex gap-2.5 items-start">
                    <span className="flex-shrink-0 flex items-center justify-center bg-primary/10 text-primary font-black rounded-full w-5 h-5 text-[10px] mt-0.5">6</span>
                    <span>Aguarde de <strong>1 a 2 minutos</strong> para que as alterações reflitam na nuvem antes de testar novamente.</span>
                  </li>
                </ol>
              </div>
            </div>
          </form>

          {statusInfo.configured && (
            <div className="bg-surface-container rounded-2xl border border-surface-container-high p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-bold text-on-surface text-xs uppercase tracking-wide">Testar Ferramenta de Varredura</h4>
                <p className="text-[11px] text-on-surface-variant leading-relaxed max-w-md">
                  Execute uma chamada real de teste contra as APIs de busca do Google para mitigar erros de cota ou faturamento.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || isLoading}
                className="w-full sm:w-auto px-5 py-2.5 bg-surface-container-lowest border border-surface-container-highest hover:bg-surface-container shadow-sm text-xs font-black uppercase tracking-wider text-primary rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-primary" />
                    Testando...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} className="text-primary" />
                    Testar conexão Google Places
                  </>
                )}
              </button>
            </div>
          )}

          {/* Form 2: SMTP server configuration */}
          <form onSubmit={handleSaveSmtp} className="bg-surface-container rounded-2xl border border-surface-container-high p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl">
                  <Mail size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-extrabold text-on-surface text-sm uppercase tracking-wide">Servidor de E-mail (SMTP)</h3>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Configure os dados do servidor SMTP corporativo para envio de e-mails de prospecção comercial.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant font-black">Servidor SMTP / Host *</label>
                <input 
                  type="text"
                  disabled={!isSmtpEditing}
                  value={smtpForm.host}
                  onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                  placeholder="smtp.empresa.com"
                  className="w-full bg-surface-container-lowest border border-surface-container-high focus:border-primary focus:ring-1 focus:ring-primary/20 text-on-surface text-xs font-semibold px-4 py-3 rounded-xl transition-all disabled:opacity-60"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant font-black">Porta *</label>
                  <input 
                    type="number"
                    disabled={!isSmtpEditing}
                    value={smtpForm.port}
                    onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value, 10) || 587 })}
                    placeholder="587"
                    className="w-full bg-surface-container-lowest border border-surface-container-high focus:border-primary focus:ring-1 focus:ring-primary/20 text-on-surface text-xs font-semibold px-4 py-3 rounded-xl transition-all disabled:opacity-60"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant font-black">Tipo de segurança *</label>
                  <select
                    disabled={!isSmtpEditing}
                    value={smtpForm.secureType}
                    onChange={(e) => setSmtpForm({ ...smtpForm, secureType: e.target.value as any })}
                    className="w-full bg-surface-container-lowest border border-surface-container-high focus:border-primary focus:ring-1 focus:ring-primary/20 text-on-surface text-xs font-semibold px-4 py-3 rounded-xl transition-all disabled:opacity-60 outline-none h-[42px]"
                    required
                  >
                    <option value="TLS">TLS</option>
                    <option value="SSL">SSL</option>
                    <option value="Nenhuma">Nenhuma</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant font-black">E-mail Remetente *</label>
                <input 
                  type="email"
                  disabled={!isSmtpEditing}
                  value={smtpForm.emailRemetente}
                  onChange={(e) => setSmtpForm({ ...smtpForm, emailRemetente: e.target.value })}
                  placeholder="comercial@empresa.com"
                  className="w-full bg-surface-container-lowest border border-surface-container-high focus:border-primary focus:ring-1 focus:ring-primary/20 text-on-surface text-xs font-semibold px-4 py-3 rounded-xl transition-all disabled:opacity-60"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant font-black">Nome do Remetente *</label>
                <input 
                  type="text"
                  disabled={!isSmtpEditing}
                  value={smtpForm.nomeRemetente}
                  onChange={(e) => setSmtpForm({ ...smtpForm, nomeRemetente: e.target.value })}
                  placeholder="Nome Exibido no Envio"
                  className="w-full bg-surface-container-lowest border border-surface-container-high focus:border-primary focus:ring-1 focus:ring-primary/20 text-on-surface text-xs font-semibold px-4 py-3 rounded-xl transition-all disabled:opacity-60"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant font-black">Usuário SMTP *</label>
                <input 
                  type="text"
                  disabled={!isSmtpEditing}
                  value={smtpForm.usuario}
                  onChange={(e) => setSmtpForm({ ...smtpForm, usuario: e.target.value })}
                  placeholder="Usuario ou E-mail SMTP"
                  className="w-full bg-surface-container-lowest border border-surface-container-high focus:border-primary focus:ring-1 focus:ring-primary/20 text-on-surface text-xs font-semibold px-4 py-3 rounded-xl transition-all disabled:opacity-60"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 relative">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant font-black">Senha SMTP *</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    disabled={!isSmtpEditing}
                    value={smtpForm.senha}
                    onChange={(e) => setSmtpForm({ ...smtpForm, senha: e.target.value })}
                    placeholder={isSmtpEditing ? "Sua senha de envio SMTP" : "••••••••••••"}
                    className="w-full bg-surface-container-lowest border border-surface-container-high focus:border-primary focus:ring-1 focus:ring-primary/20 text-on-surface text-xs font-semibold px-4 py-3 rounded-xl transition-all disabled:opacity-60 pr-10"
                    required
                  />
                  {isSmtpEditing && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-60 hover:opacity-100 transition-opacity"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3">
              {!isSmtpEditing ? (
                <button
                  type="button"
                  onClick={() => setIsSmtpEditing(true)}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-surface-container-lowest border border-surface-container-highest rounded-xl text-primary hover:bg-surface-container-low transition-all"
                >
                  Alterar SMTP
                </button>
              ) : (
                <>
                  {smtpStatus.configured && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSmtpEditing(false);
                        setSmtpForm({
                          host: smtpStatus.host || '',
                          port: smtpStatus.port || 587,
                          secureType: smtpStatus.secureType || 'TLS',
                          emailRemetente: smtpStatus.emailRemetente || '',
                          nomeRemetente: smtpStatus.nomeRemetente || '',
                          usuario: smtpStatus.usuario || '',
                          senha: smtpStatus.maskedPassword || ''
                        });
                        setSmtpDiagnosticMsg({ type: '', text: '' });
                      }}
                      className="px-4 py-2 text-xs font-black uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleTestSmtp}
                    disabled={isSmtpTesting || isSmtpSaving}
                    className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-surface-container-lowest border border-surface-container-highest rounded-xl text-on-surface hover:bg-surface-container-low transition-all flex items-center gap-1.5"
                  >
                    {isSmtpTesting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    Testar Conexão
                  </button>
                  <button
                    type="submit"
                    disabled={isSmtpSaving || isSmtpTesting}
                    className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5"
                  >
                    {isSmtpSaving ? <Loader2 size={13} className="animate-spin" /> : null}
                    Salvar Configuração
                  </button>
                </>
              )}
            </div>
          </form>

        </div>

        {/* Status / Diagnostics Right Column */}
        <div className="space-y-4 animate-in fade-in duration-300">
          
          {/* Card: Google Maps Diagnostics */}
          <div className="bg-surface-container rounded-2xl border border-surface-container-high p-6 space-y-4">
            <h3 className="font-black text-on-surface text-xs uppercase tracking-wide">Painel Maps / Places</h3>
            
            <div className={`p-4 rounded-xl border ${statusStyle.bg} flex items-start gap-3`}>
              <div className="mt-0.5">{statusStyle.icon}</div>
              <div>
                <h4 className="font-extrabold text-xs uppercase tracking-wide leading-tight">
                  {statusStyle.label}
                </h4>
                <p className="text-[10px] opacity-90 mt-1 leading-normal">
                  {statusStyle.desc}
                </p>
              </div>
            </div>

            {statusInfo.error && (
              <div className="text-left bg-red-500/5 rounded-xl border border-red-500/10 p-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-red-500 block mb-1">
                  Diretrizes de Resolução / Log de Erro:
                </span>
                <div className="font-mono text-[10px] text-on-surface-variant whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                  {(() => {
                    const urlRegex = /(https?:\/\/[^\s\n\r]+)/g;
                    const parts = statusInfo.error.split(urlRegex);
                    return parts.map((part, index) => {
                      if (part.match(urlRegex)) {
                        const cleanUrl = part.replace(/[.,;:]$/, "");
                        return (
                          <a 
                            key={index} 
                            href={cleanUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="bg-primary/10 border border-primary/20 text-primary hover:text-primary-dark font-bold hover:underline px-2 py-1 rounded inline-block my-1 text-xs break-all shadow-sm transition-all transition-colors"
                          >
                            👉 Ativar Google API
                          </a>
                        );
                      }
                      return <span key={index}>{part}</span>;
                    });
                  })()}
                </div>
              </div>
            )}
            
            <div className="text-xs text-on-surface-variant space-y-2 pt-2 border-t border-surface-container-high">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span>Tipo do Banco:</span>
                <span className="font-black text-on-surface">Firestore (Seguro)</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span>Visualização:</span>
                <span className="font-black text-on-surface">Mascarada</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span>Acesso do Backend:</span>
                <span className="font-black text-green-500 flex items-center gap-0.5">
                  <ShieldCheck size={12} />
                  Ativo (REST)
                </span>
              </div>
            </div>
          </div>

          {/* Card: SMTP Connection Diagnostics */}
          <div className="bg-surface-container rounded-2xl border border-surface-container-high p-6 space-y-4">
            <h3 className="font-black text-on-surface text-xs uppercase tracking-wide text-primary flex items-center gap-1.5">
              <Server size={14} />
              <span>Conexão SMTP</span>
            </h3>
            
            <div className={`p-4 rounded-xl border ${smtpStatus.configured ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-surface-container-high border-surface-container-highest text-on-surface-variant'} flex items-start gap-3`}>
              <div className="mt-0.5">
                {smtpStatus.configured ? <CheckCircle2 size={18} className="text-green-500" /> : <AlertTriangle size={18} className="text-on-surface-variant opacity-60" />}
              </div>
              <div>
                <h4 className="font-extrabold text-xs uppercase tracking-wide leading-tight">
                  {smtpStatus.configured ? 'SMTP Parametrizado' : 'Aguardando Setup'}
                </h4>
                <p className="text-[10px] opacity-90 mt-1 leading-normal">
                  {smtpStatus.configured 
                    ? `Encaminhador de e-mails corporativo ativo em ${smtpStatus.host}:${smtpStatus.port}`
                    : 'Nenhum servidor SMTP foi homologado. Cadastre os dados ao lado.'
                  }
                </p>
              </div>
            </div>

            {smtpDiagnosticMsg.text && (
              <div className={`text-left rounded-xl border p-4 ${smtpDiagnosticMsg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-600' : 'bg-red-500/10 border-red-500/20 text-red-600'}`}>
                <span className="text-[10px] font-black uppercase tracking-wider block mb-1">
                  Resultado do Diagnóstico:
                </span>
                <div className="font-mono text-[10px] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-semibold">
                  {smtpDiagnosticMsg.text}
                </div>
              </div>
            )}
            
            <div className="text-xs text-on-surface-variant space-y-2 pt-2 border-t border-surface-container-high font-bold">
              <div className="flex justify-between items-center text-[10px]">
                <span>E-mail Remetente:</span>
                <span className="font-black text-on-surface max-w-[120px] truncate">{smtpStatus.emailRemetente || '-'}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span>Criptografia:</span>
                <span className="font-black text-on-surface">{smtpStatus.secureType || '-'}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span>Armazenamento:</span>
                <span className="font-black text-green-500 flex items-center gap-0.5">
                  <ShieldCheck size={12} />
                  Criptografia (DB)
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
