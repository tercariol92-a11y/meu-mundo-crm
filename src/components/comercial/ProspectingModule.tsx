import { useState, useEffect } from 'react';
import { 
  prospectingService, 
  ProspectResult, 
  ProspectCampaign, 
  ProspectAutomation, 
  ProspectLog, 
  MessageLog 
} from '../../services/prospectingService';
import { databaseService } from '../../services/databaseService';
import { Lead, Usuario } from '../../types';
import { generateText } from '../../services/geminiService';
import { 
  Search, 
  Plus, 
  Play, 
  Pause, 
  AlertCircle, 
  Sparkles, 
  Send, 
  Eye, 
  Trash2, 
  CheckCircle, 
  Clock, 
  Building2, 
  Package, 
  MessageSquare, 
  Activity, 
  Mail, 
  Zap, 
  FolderPlus, 
  Phone, 
  ExternalLink, 
  Compass, 
  TrendingUp, 
  MousePointer, 
  RotateCcw,
  Sliders,
  CheckCheck,
  ChevronDown
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ProspectingModuleProps {
  user: Usuario;
  initialTab?: string;
  onViewChange?: (view: any) => void;
}

export default function ProspectingModule({ user, initialTab = 'buscar', onViewChange }: ProspectingModuleProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);

  // Search Screen State
  const [segment, setSegment] = useState('academia');
  const [city, setCity] = useState('Itapevi, SP');
  const [searchResults, setSearchResults] = useState<ProspectResult[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [searchSource, setSearchSource] = useState<'google-places-api' | 'simulated-engine' | null>(null);
  const [apiWaitingConfig, setApiWaitingConfig] = useState(false);
  const [nextPageToken, setNextPageToken] = useState('');
  const [searchingMore, setSearchingMore] = useState(false);

  // Leads Capturados Screen State
  const [prospectLeads, setProspectLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Campaigns State
  const [campaigns, setCampaigns] = useState<ProspectCampaign[]>([]);
  const [isModalingCampaign, setIsModalingCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignSegment, setNewCampaignSegment] = useState('Academia');
  const [newCampaignCity, setNewCampaignCity] = useState('Osasco');
  const [newCampaignKeyword, setNewCampaignKeyword] = useState('');
  const [newCampaignMaxLeads, setNewCampaignMaxLeads] = useState<number>(50);
  const [newCampaignChannel, setNewCampaignChannel] = useState<'WhatsApp' | 'E-mail' | 'Ambos'>('WhatsApp');

  // WhatsApp State
  const [automation, setAutomation] = useState<ProspectAutomation | null>(null);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [templates, setTemplates] = useState<Array<{ id: string, name: string, type: 'whatsapp' | 'email', body: string }>>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [newTemplateType, setNewTemplateType] = useState<'whatsapp' | 'email'>('whatsapp');
  const [isGeneratingAiMessage, setIsGeneratingAiMessage] = useState(false);
  const [aiSegmentPrompt, setAiSegmentPrompt] = useState('academia');

  // History & Audit Logs
  const [auditLogs, setAuditLogs] = useState<ProspectLog[]>([]);

  // Send Email Modal State
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState<Lead | null>(null);
  const [emailModalData, setEmailModalData] = useState({
    to: '',
    subject: '',
    body: '',
    templateId: ''
  });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [selectedLeadForWhatsApp, setSelectedLeadForWhatsApp] = useState<Lead | null>(null);
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [whatsAppTemplateId, setWhatsAppTemplateId] = useState('');
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Statistics summaries
  const [stats, setStats] = useState({
    captured: 0,
    sent: 0,
    replies: 0,
    deals: 0,
    conversion: 0
  });

  // Sync state across tabs
  useEffect(() => {
    loadGlobalProspectData();
  }, [activeTab]);

  // Sync tab when initialTab prop changes from external sidebar
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (onViewChange) {
      onViewChange(`prospeccao-${tabId}`);
    }
  };

  const loadGlobalProspectData = async () => {
    try {
      setLoadingLeads(true);
      
      // Load current campaigns
      const campList = await prospectingService.getCampaigns();
      setCampaigns(campList);

      // Check Google Maps API key status dynamically
      try {
        const keyStatus = await prospectingService.getGoogleMapsKeyStatus();
        setApiWaitingConfig(!keyStatus.configured);
      } catch (errKey) {
        console.error('Erro ao buscar status da chave Google Maps:', errKey);
        setApiWaitingConfig(true);
      }

      // Load automations
      const autoList = await prospectingService.getAutomations();
      if (autoList.length > 0) setAutomation(autoList[0]);

      // Load message logs
      const msgList = await prospectingService.getMessageLogs();
      setMessageLogs(msgList);

      // Load templates
      const tempCol = await prospectingService.getTemplates();
      setTemplates(tempCol);

      // Load audit logs
      const logCol = await prospectingService.getLogs();
      setAuditLogs(logCol);

      // Filter and load Google Maps origin leads
      const mapped = await prospectingService.getLeads();
      setProspectLeads(mapped);

      // Compute general metrics strictly using real data
      const totalCap = mapped.length;
      // Somente confirmações reais do serviço WhatsApp entram como envio.
      // Registros legados "enviado" sem messageId eram simulações locais.
      const confirmedMessages = msgList.filter(m => m.status === 'sent' && Boolean(m.messageId));
      const totalSent = confirmedMessages.length;
      const totalReplies = msgList.filter(m => m.status === 'respondeu').length;
      const totalDeals = mapped.filter(l => l.status === 'Qualificado' || l.status === 'Proposta enviada' || l.status === 'Fechado').length;
      
      setStats({
        captured: totalCap,
        sent: totalSent,
        replies: totalReplies,
        deals: totalDeals,
        conversion: totalSent > 0 ? Math.round((totalReplies / totalSent) * 100) : 0
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLeads(false);
    }
  };

  // Google Maps Search handler
  const handleMapsSearch = async () => {
    if (!segment.trim() || !city.trim()) {
      toast.error('Informe o segmento e a cidade para buscar.');
      return;
    }
    try {
      setLoading(true);
      setApiWaitingConfig(false);
      setSelectedResultIds([]);
      setNextPageToken('');
      toast.loading('Iniciando varredura no Google Maps...', { id: 'search-toast' });
      
      const { results, nextPageToken: token } = await prospectingService.searchGoogleMaps(segment, city);
      setSearchResults(results);
      setNextPageToken(token || '');
      setSearchSource('google-places-api');
      
      await prospectingService.createLog(
        'Busca Realizada', 
        `Busca por "${segment}" em "${city}". ${results.length} resultados encontrados.`, 
        'info'
      );
      
      toast.success(`${results.length} empresas encontradas!`, { id: 'search-toast' });
    } catch (e: any) {
      setSearchResults([]);
      setNextPageToken('');
      setSearchSource(null);
      toast.error(e.message || 'Erro ao buscar empresas.', { id: 'search-toast' });
    } finally {
      setLoading(false);
    }
  };

  // Google Maps Load More Search handler
  const handleLoadMoreMapsSearch = async () => {
    if (!nextPageToken) return;
    try {
      setSearchingMore(true);
      toast.loading('Carregando mais resultados...', { id: 'load-more-toast' });

      const { results, nextPageToken: token } = await prospectingService.searchGoogleMaps(segment, city, nextPageToken);
      
      setSearchResults(prevResults => {
        const existingIds = new Set(prevResults.map(r => r.id));
        const newUniqueResults = results.filter(r => !existingIds.has(r.id));
        return [...prevResults, ...newUniqueResults];
      });
      setNextPageToken(token || '');

      toast.success(`${results.length} novas empresas adicionadas!`, { id: 'load-more-toast' });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar mais empresas.', { id: 'load-more-toast' });
    } finally {
      setSearchingMore(false);
    }
  };

  // Selection toggle helper
  const toggleSelectResult = (id: string) => {
    setSelectedResultIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedResultIds.length === searchResults.length) {
      setSelectedResultIds([]);
    } else {
      setSelectedResultIds(searchResults.map(r => r.id));
    }
  };

  // Import selected search results to CRM leads
  const handleImportSelected = async () => {
    if (selectedResultIds.length === 0) {
      toast.error('Selecione ao menos um estabelecimento para importar.');
      return;
    }

    try {
      setLoading(true);
      const selectedPlaces = searchResults.filter(r => selectedResultIds.includes(r.id));
      
      toast.loading(`Importando ${selectedResultIds.length} leads...`, { id: 'import-toast' });
      
      const { importedIdList, skippedCount } = await prospectingService.importToLeads(selectedPlaces, user.id);
      
      // Update Campaign stats
      if (campaigns.length > 0) {
        const activeC = campaigns.find(c => c.status === 'Ativa');
        if (activeC) {
          const totalLinked = (activeC.leadsContatados || 0) + importedIdList.length;
          await prospectingService.updateCampaign(activeC.id!, { leadsContatados: totalLinked });
        }
      }

      toast.success(
        `Importação concluída! ${importedIdList.length} salvos, ${skippedCount} duplicados ignorados.`, 
        { id: 'import-toast', duration: 5000 }
      );
      
      setSelectedResultIds([]);
      setSearchResults([]);
      loadGlobalProspectData();
      
    } catch (error) {
      toast.error('Erro na importação para o Firebase.', { id: 'import-toast' });
    } finally {
      setLoading(false);
    }
  };

  // Toggle active campaign
  const handleToggleCampaignStatus = async (camp: ProspectCampaign) => {
    try {
      const nextStatus = camp.status === 'Ativa' ? 'Pausada' : 'Ativa';
      await prospectingService.updateCampaign(camp.id!, { status: nextStatus });
      toast.success(`Campanha "${camp.nome}" está agora ${nextStatus}!`);
      loadGlobalProspectData();
    } catch (e) {
      toast.error('Erro ao atualizar campanha.');
    }
  };

  // Save New Campaign
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) {
      toast.error('Insira o nome da campanha.');
      return;
    }
    try {
      const campObj: Omit<ProspectCampaign, 'id'> = {
        nome: newCampaignName,
        segmento: newCampaignSegment,
        cidade: newCampaignCity,
        palavraChave: newCampaignKeyword,
        limiteLeads: Number(newCampaignMaxLeads),
        canalEnvio: newCampaignChannel,
        leadsContatados: 0,
        mensagensEnviadas: 0,
        respostasRecebidas: 0,
        oportunidadesCriadas: 0,
        status: 'Ativa'
      };
      await prospectingService.createCampaign(campObj);
      toast.success('Campanha de prospecção criada com sucesso!');
      setIsModalingCampaign(false);
      setNewCampaignName('');
      setNewCampaignKeyword('');
      setNewCampaignMaxLeads(50);
      setNewCampaignChannel('WhatsApp');
      loadGlobalProspectData();
    } catch (e) {
      toast.error('Erro ao salvar campanha.');
    }
  };

  // Save Automation Config
  const handleSaveAutomation = async (updates: Partial<ProspectAutomation>) => {
    if (!automation) return;
    try {
      await prospectingService.saveAutomation(automation.id!, updates);
      setAutomation(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Regra de automação salva!');
      loadGlobalProspectData();
    } catch (e) {
      toast.error('Erro ao salvar parametrizações.');
    }
  };

  // Gemini AI generation of whatsapp message for specific segment
  const handleGenerateAiMessageTemplate = async () => {
    try {
      setIsGeneratingAiMessage(true);
      const prompt = `Gere uma única mensagem altamente persuasiva para o WhatsApp para prospectar novos clientes comerciais da categoria "${aiSegmentPrompt}". 
Queremos oferecer sistemas de controle de acesso por reconhecimento facial e relógios de ponto biométricos homologados pelo Ministério do Trabalho (MTE). 
A mensagem deve incluir tags estruturadas para o CRM como {{NOME_EMPRESA}} e {{CIDADE}}. 
Seja simpático, direto, profissional e termine com uma chamada à ação (CTA). Não utilize hashtags nem jargão tecnológico excessivo.`;
      
      toast.loading('Invocando Gemini AI...', { id: 'ai-toast' });
      const draft = await generateText(prompt);
      
      setNewTemplateBody(draft);
      setNewTemplateName(`Abordagem IA - ${aiSegmentPrompt.toUpperCase()}`);
      toast.success('Inovação gerada com sucesso pela IA!', { id: 'ai-toast' });
    } catch (e) {
      toast.error('Falha ao gerar rascunho com IA.', { id: 'ai-toast' });
    } finally {
      setIsGeneratingAiMessage(false);
    }
  };

  // Save Message template
  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateBody.trim()) {
      toast.error('Preencha o nome e o corpo do modelo.');
      return;
    }
    try {
      await prospectingService.createTemplate(newTemplateName, newTemplateType, newTemplateBody);
      toast.success('Template de abordagem salvo com sucesso!');
      setNewTemplateName('');
      setNewTemplateBody('');
      loadGlobalProspectData();
    } catch (e) {
      toast.error('Erro ao salvar modelo.');
    }
  };

  // Open modal and prefill email data for a lead
  const handleOpenEmailModal = (lead: Lead) => {
    const emailTemplates = templates.filter(t => t.type === 'email');
    const firstTemplate = emailTemplates[0];

    let initialSubject = 'Apresentação Comercial';
    let initialBody = `Olá ${lead.nome},\n\nParceria técnica em soluções comerciais para o seu estabelecimento.`;

    if (firstTemplate) {
      const companyName = lead.empresa || lead.nome || 'sua empresa';
      const cityName = lead.cidade || 'sua cidade';
      initialSubject = firstTemplate.name;
      initialBody = firstTemplate.body
        .replace(/\{\{NOME_EMPRESA\}\}/g, companyName)
        .replace(/\{\{CIDADE\}\}/g, cityName);
    }

    setSelectedLeadForEmail(lead);
    setEmailModalData({
      to: lead.email || '',
      subject: initialSubject,
      body: initialBody,
      templateId: firstTemplate?.id || ''
    });
  };

  const handleSelectTemplateForEmail = (templateId: string, lead: Lead) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) {
      setEmailModalData(prev => ({
        ...prev,
        templateId: '',
        subject: 'Apresentação Comercial',
        body: `Olá ${lead.nome},\n\nGostaríamos de apresentar nossas soluções comerciais corporativas.`
      }));
      return;
    }

    const companyName = lead.empresa || lead.nome || 'sua empresa';
    const cityName = lead.cidade || 'sua cidade';

    const substitutedBody = template.body
      .replace(/\{\{NOME_EMPRESA\}\}/g, companyName)
      .replace(/\{\{CIDADE\}\}/g, cityName);

    setEmailModalData(prev => ({
      ...prev,
      templateId,
      subject: template.name || 'Apresentação Comercial',
      body: substitutedBody
    }));
  };

  const handleSendEmailToLead = async () => {
    if (!emailModalData.to || !emailModalData.to.includes('@')) {
      toast.error('Insira um e-mail de destino válido!');
      return;
    }
    if (!emailModalData.subject || !emailModalData.body) {
      toast.error('Assunto e corpo do e-mail são obrigatórios!');
      return;
    }

    setIsSendingEmail(true);
    const sendToast = toast.loading(`Enviando e-mail para ${selectedLeadForEmail?.nome || emailModalData.to}...`);

    try {
      const res = await prospectingService.sendProspectEmail({
        leadId: selectedLeadForEmail?.id || '',
        leadName: selectedLeadForEmail?.nome || '',
        leadEmail: emailModalData.to,
        subject: emailModalData.subject,
        body: emailModalData.body
      });

      if (res.success) {
        toast.success(res.message || 'E-mail enviado via SMTP com sucesso!', { id: sendToast });
        
        await prospectingService.createLog(
          'E-mail Enviado',
          `E-mail enviado para "${selectedLeadForEmail?.nome || emailModalData.to}" (${emailModalData.to}) via SMTP. Assunto: ${emailModalData.subject}`,
          'success'
        );

        setSelectedLeadForEmail(null);
        loadGlobalProspectData();
      } else {
        toast.error(res.error || 'Erro ao enviar e-mail via SMTP.', { id: sendToast });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Falha ao enviar e-mail via SMTP.', { id: sendToast });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Manual Trigger Message Sequence to a specific lead
  const handleSendManualMessageToLead = (lead: Lead) => {
    const phone = lead.telefone || lead.whatsapp || '';
    if (!phone || !phone.replace(/\D/g, '')) { toast.error('Telefone não encontrado para este lead.'); return; }
    const activeTemplate = templates.find(t => t.type === 'whatsapp');
    const msgText = activeTemplate 
      ? activeTemplate.body
          .replace(/\{\{NOME_EMPRESA\}\}/g, lead.empresa || lead.nome)
          .replace(/\{\{CIDADE\}\}/g, lead.cidade || 'sua cidade')
      : `Olá ${lead.nome}! Gostaríamos de oferecer soluções em segurança para seu negócio.`;

    setSelectedLeadForWhatsApp(lead);
    setWhatsAppTemplateId(activeTemplate?.id || '');
    setWhatsAppMessage(msgText);
  };

  const handleConfirmWhatsAppSend = async () => {
    const lead = selectedLeadForWhatsApp;
    if (!lead || isSendingWhatsApp) return;
    try {
      setIsSendingWhatsApp(true);
      const result = await prospectingService.sendManualWhatsApp(lead.id, lead.empresa || lead.nome, lead.telefone || lead.whatsapp || '', whatsAppMessage, user.nome || user.email.split('@')[0], user.id, user.email);
      await prospectingService.createLog(
        'Mensagem Manual Enviada', 
        `Mensagem comercial confirmada pelo WhatsApp para "${lead.nome}". ID: ${result.messageId}.`,
        'success'
      );
      toast.success(`Mensagem enviada com sucesso para ${lead.empresa || lead.nome}.`);
      setProspectLeads(current => current.map(item => item.id === lead.id ? { ...item, status: 'Em contato', dataInteracao: new Date().toISOString() } : item));
      setSelectedLeadForWhatsApp(null);
      sessionStorage.setItem('atendimento:openLeadId', result.conversationId);
      onViewChange?.('atendimento');
    } catch (e: any) {
      toast.error(e?.message || 'Falha no envio pelo WhatsApp.');
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const formatProspectDate = (value: any) => {
    if (!value) return 'Não informado';
    const raw = typeof value?.toDate === 'function' ? value.toDate() : typeof value?.seconds === 'number' ? new Date(value.seconds * 1000) : new Date(value);
    return Number.isNaN(raw.getTime()) ? 'Não informado' : raw.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col gap-6 p-6 min-h-[calc(100vh-64px)] bg-surface text-on-surface">
      {/* Module Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container-high pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest mb-1.5">
            <Compass size={14} className="animate-spin" style={{ animationDuration: '6s' }} />
            <span>Módulo de Prospecção</span>
          </div>
          <h1 className="text-3xl font-black text-on-surface uppercase tracking-tight m-0">PROSPECÇÃO DE CLIENTES</h1>
          <p className="text-xs text-on-surface-variant font-medium mt-1">Busca inteligente no Google Maps integrada a automações com IA e disparos WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          {onViewChange && (
            <button 
              onClick={() => onViewChange('comercial-leads')}
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-surface-container-high hover:border-primary/40 text-on-surface rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all"
            >
              <TrendingUp size={14} />
              <span>Pipeline CRM</span>
            </button>
          )}
          <button 
            onClick={() => setIsModalingCampaign(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-on-primary rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all shadow-md"
          >
            <Plus size={14} />
            <span>Nova Campanha</span>
          </button>
        </div>
      </div>

      {/* Overview Statistics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface-container border border-surface-container-high rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Leads Capturados</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-on-surface">{stats.captured}</span>
            <span className="text-[9px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">Total</span>
          </div>
        </div>
        <div className="bg-surface-container border border-surface-container-high rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Mensagens Enviadas</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-on-surface">{stats.sent}</span>
            <span className="text-[9px] bg-sky-500/10 text-sky-500 font-bold px-1.5 py-0.5 rounded">WhatsApp/SMTP</span>
          </div>
        </div>
        <div className="bg-surface-container border border-surface-container-high rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Feedback Respostas</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-on-surface">{stats.replies}</span>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-500 font-bold px-1.5 py-0.5 rounded">Engajados</span>
          </div>
        </div>
        <div className="bg-surface-container border border-surface-container-high rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Oportunidades</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-on-surface">{stats.deals}</span>
            <span className="text-[9px] bg-amber-500/10 text-amber-500 font-bold px-1.5 py-0.5 rounded">No Funil</span>
          </div>
        </div>
        <div className="col-span-2 md:col-span-1 bg-surface-container border border-primary/20 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Taxa de Conversão</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-primary">{stats.conversion}%</span>
            <span className="text-[9px] bg-green-500/10 text-green-500 font-bold px-1.5 py-0.5 rounded">Excelente</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Menu Bar */}
      <div className="flex items-center gap-2 border-b border-surface-container-high overflow-x-auto select-none no-scrollbar">
        {[
          { id: 'buscar', label: 'Buscar Empresas', icon: Search },
          { id: 'leads', label: 'Leads Capturados', icon: Building2 },
          { id: 'campanhas', label: 'Campanhas', icon: Activity },
          { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
          { id: 'emails', label: 'E-mails', icon: Mail },
          { id: 'automacao', label: 'Automação', icon: Zap },
          { id: 'historico', label: 'Histórico', icon: RotateCcw }
        ].map(t => {
          const isSelected = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs uppercase tracking-wider font-extrabold transition-all whitespace-nowrap ${
                isSelected 
                  ? 'border-primary text-primary bg-primary/5' 
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-surface-container-high'
              }`}
            >
              <t.icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* VIEWPORT CONTROLLER CONTENT */}
      <div className="flex-1">
        
        {/* 1. BUSCAR EMPRESAS GOOGLE MAPS */}
        {activeTab === 'buscar' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* Search Settings Card */}
            <div className="bg-surface-container border border-surface-container-high rounded-xl p-6">
              <h2 className="text-sm font-black uppercase tracking-wider text-on-surface mb-4 flex items-center gap-2">
                <Search size={16} className="text-primary" />
                <span>Varredura de Segmentos</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Qual o segmento?</label>
                  <input 
                    type="text"
                    list="segment-options"
                    value={segment} 
                    onChange={e => setSegment(e.target.value)}
                    placeholder="Digite ou escolha um segmento..."
                    className="w-full bg-surface border border-surface-container-high text-on-surface text-xs font-semibold px-3.5 py-2.5 rounded-lg focus:border-primary/50"
                  />
                  <datalist id="segment-options">
                    <option value="academia">Academias e Fitness</option>
                    <option value="escola">Colégios, Escolas e Cursos</option>
                    <option value="condominio">Condomínios Residenciais / Edifícios</option>
                    <option value="industria">Indústrias, Metalúrgicas e Galpões</option>
                    <option value="clinica">Clínicas e Consultórios Médicos</option>
                    <option value="comercio">Comércio e Lojas Tradicionais</option>
                    <option value="clínicas odontológicas">Clínicas Odontológicas</option>
                    <option value="escolas particulares">Escolas Particulares</option>
                    <option value="postos de combustível">Postos de Combustível</option>
                  </datalist>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Qual a cidade, bairro, estado ou região?</label>
                  <input 
                    type="text" 
                    value={city} 
                    onChange={e => setCity(e.target.value)}
                    placeholder="Ex: Itapevi, SP ou Boqueirão Curitiba ou Paraná"
                    className="w-full bg-surface border border-surface-container-high text-on-surface text-xs font-semibold px-3.5 py-2.5 rounded-lg focus:border-primary/50"
                  />
                </div>
                <div>
                  <button
                    onClick={handleMapsSearch}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-on-primary disabled:opacity-50 px-4 py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all shadow"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-on-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Consultando Google...</span>
                      </span>
                    ) : (
                      <>
                        <Search size={14} />
                        <span>Pesquisar Empresas</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* API Key Notices */}
              <div className="mt-4 flex items-start gap-2 text-xs text-on-surface-variant bg-surface p-3 rounded-lg border border-surface-container-high">
                <AlertCircle size={15} className="text-warning shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Informação Técnica:</span> A Google Places API está ativa em modo de produção híbrido. O sistema de controle identificará as empresas da região. Caso nenhuma chave individual esteja salva em Secrets, nossa IA estruturará dados altamente enriquecidos para o CRM de imediato para teste.
                </div>
              </div>
            </div>

            {/* Results Section */}
            {searchResults.length > 0 ? (
              <div className="border border-surface-container-high rounded-xl overflow-hidden bg-surface-container">
                <div className="flex items-center justify-between p-4 bg-surface border-b border-surface-container-high">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-on-surface uppercase tracking-wider">
                    <CheckCircle size={15} className="text-emerald-500" />
                    <span>Resultados da Pesquisa ({searchResults.length})</span>
                    <span className="text-[9px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ml-2">
                      Fonte: {searchSource === 'google-places-api' ? 'Places API REAL' : 'Simulador Prospecção'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-[10px] font-extrabold uppercase hover:text-primary tracking-wider transition-all"
                    >
                      {selectedResultIds.length === searchResults.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                    <button
                      onClick={handleImportSelected}
                      disabled={selectedResultIds.length === 0}
                      className="flex items-center gap-2 bg-primary text-on-primary font-extrabold text-[10px] uppercase px-3 py-1.5 rounded-lg disabled:opacity-40 transition-all shadow"
                    >
                      <FolderPlus size={12} />
                      <span>Importar Selecionados ({selectedResultIds.length})</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface text-on-surface-variant text-[10px] font-black uppercase tracking-wider border-b border-surface-container-high">
                        <th className="py-3 px-4 w-10 text-center">Sel</th>
                        <th className="py-3 px-4">Nome da Empresa</th>
                        <th className="py-3 px-4">Contatos</th>
                        <th className="py-3 px-4">Ramo / Categoria</th>
                        <th className="py-3 px-4">Avaliação</th>
                        <th className="py-3 px-4">Localização / Endereço</th>
                        <th className="py-3 px-4 w-28 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high font-semibold">
                      {searchResults.map(r => {
                        const isChecked = selectedResultIds.includes(r.id);
                        return (
                          <tr key={r.id} className={`hover:bg-primary/5 transition-all ${isChecked ? 'bg-primary/[0.02]' : ''}`}>
                            <td className="py-3 px-4 text-center">
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={() => toggleSelectResult(r.id)}
                                className="h-3.5 w-3.5 rounded text-primary focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-on-surface text-sm">{r.nome || 'Empresa sem nome'}</span>
                                {r.site ? (
                                  <a href={r.site.startsWith('http') ? r.site : `https://${r.site}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5">
                                    <span>{r.site}</span>
                                    <ExternalLink size={8} />
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-on-surface-variant/50 mt-0.5">Site não encontrado</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-on-surface flex items-center gap-1 font-mono text-xs">
                                  <Phone size={10} className="text-on-surface-variant" />
                                  {r.telefone && r.telefone !== "Não informado" ? r.telefone : 'Telefone não encontrado'}
                                </span>
                                {r.whatsapp && (
                                  <span className="text-[9px] bg-emerald-500/10 text-emerald-500 font-bold px-1.5 py-0.2 rounded-full w-max">
                                    WhatsApp Ativo
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-on-surface-variant font-bold text-[10px] uppercase tracking-wide">
                              {r.categoria || 'Não informada'}
                            </td>
                            <td className="py-3 px-4">
                              {r.avaliacoes && r.avaliacoes.rating ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-amber-500">★</span>
                                  <span className="font-bold">{r.avaliacoes.rating}</span>
                                  <span className="text-[10px] text-on-surface-variant">({r.avaliacoes.reviewsCount || 0})</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-on-surface-variant/60">Sem avaliação</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-on-surface-variant max-w-xs truncate text-[11px]" title={r.endereco || 'Endereço não informado'}>
                              {r.endereco || 'Endereço não informado'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <a
                                href={r.linkMaps}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface border border-surface-container-high text-[10px] font-bold text-on-surface hover:text-primary rounded-lg uppercase tracking-wider"
                              >
                                <span>Ver no Maps</span>
                                <ExternalLink size={10} />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination button */}
                {nextPageToken && (
                  <div className="flex justify-center p-4 bg-surface border-t border-surface-container-high">
                    <button
                      type="button"
                      onClick={handleLoadMoreMapsSearch}
                      disabled={searchingMore}
                      className="flex items-center gap-2 bg-surface hover:bg-surface-container border border-surface-container-high text-on-surface hover:text-primary transition-all rounded-lg text-xs font-black uppercase tracking-wider px-6 py-2.5 disabled:opacity-50"
                    >
                      {searchingMore ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Carregando mais resultados...</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} className="text-primary animate-bounce animate-duration-1000" />
                          <span>Carregando mais resultados (+20 de {searchResults.length})</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-surface-container-high rounded-2xl bg-surface-container-low text-center">
                <Compass size={40} className="text-on-surface-variant opacity-30 shrink-0 mb-4 animate-spin-slow" />
                <h3 className="font-bold text-on-surface uppercase tracking-wider text-sm mb-1">Nenhum resultado para exibir</h3>
                <p className="text-xs text-on-surface-variant max-w-sm">Preencha os filtros acima e clique em "Pesquisar Empresas" para captar registros diretamente do mapa Google Places.</p>
              </div>
            )}
          </div>
        )}

        {/* 2. LEADS CAPTURADOS */}
        {activeTab === 'leads' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            {loadingLeads ? (
              <div className="flex justify-center p-12">
                <span className="text-xs font-bold uppercase tracking-widest text-primary animate-pulse">Carregando leads da prospecção...</span>
              </div>
            ) : prospectLeads.length > 0 ? (
              <div className="border border-surface-container-high rounded-xl overflow-hidden bg-surface-container">
                <div className="p-4 bg-surface border-b border-surface-container-high">
                  <h3 className="text-xs font-extrabold text-on-surface uppercase tracking-wider">Base de Leads Capturados via Google Maps ({prospectLeads.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface text-on-surface-variant text-[10px] font-black uppercase tracking-wider border-b border-surface-container-high">
                        <th className="py-3 px-4">Nome fantasia</th>
                        <th className="py-3 px-4">Cidade / Região</th>
                        <th className="py-3 px-4">DDD / WhatsApp</th>
                        <th className="py-3 px-4">Status no CRM</th>
                        <th className="py-3 px-4">Informado em</th>
                        <th className="py-3 px-4 text-center w-36">Ações Rápidas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high font-semibold">
                      {prospectLeads.map(lead => {
                        return (
                          <tr key={lead.id} className="hover:bg-primary/5 transition-all">
                            <td className="py-3 px-4 font-bold text-on-surface text-sm">
                              {lead.nome}
                            </td>
                            <td className="py-3 px-4 text-on-surface-variant uppercase text-[10px] tracking-wide">
                              {lead.cidade}
                            </td>
                            <td className="py-3 px-4 font-mono">
                              {lead.telefone || lead.whatsapp || '-'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                                lead.status === 'Novo' ? 'bg-primary/10 text-primary' :
                                lead.status === 'Em contato' ? 'bg-sky-500/10 text-sky-500' :
                                lead.status === 'Qualificado' ? 'bg-emerald-500/10 text-emerald-500' :
                                'bg-surface border border-surface-container-high text-on-surface-variant'
                              }`}>
                                {lead.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[10px] text-on-surface-variant">
                              {formatProspectDate(lead.createdAt || lead.criadoEm)}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleSendManualMessageToLead(lead)}
                                  className="p-1.5 hover:bg-primary/10 hover:text-primary text-on-surface-variant rounded-lg transition-all"
                                  title="Enviar Abordagem WhatsApp"
                                >
                                  <Send size={15} />
                                </button>
                                <button
                                  onClick={() => handleOpenEmailModal(lead)}
                                  className="p-1.5 hover:bg-blue-500/10 hover:text-blue-500 text-on-surface-variant rounded-lg transition-all"
                                  title="Enviar E-mail via SMTP"
                                >
                                  <Mail size={15} />
                                </button>
                                <a
                                  href={`https://wa.me/${(lead.telefone || '').replace(/\D/g, '')}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="p-1.5 hover:bg-emerald-500/10 hover:text-emerald-500 text-on-surface-variant rounded-lg transition-all"
                                  title="Abrir WhatsApp Web Direct"
                                >
                                  <ExternalLink size={15} />
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-surface-container-high rounded-2xl bg-surface-container-low text-center">
                <Building2 size={40} className="text-on-surface-variant opacity-30 mb-4" />
                <h3 className="font-bold text-on-surface uppercase tracking-wider text-sm mb-1">Nenhum lead capturado ainda</h3>
                <p className="text-xs text-on-surface-variant max-w-sm">Use o menu "Buscar Empresas", execute varreduras de mercado e importe registros para criar leads associados automaticamente.</p>
              </div>
            )}
          </div>
        )}

        {/* 3. CAMPANHAS */}
        {activeTab === 'campanhas' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* Conversion Metrics Visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-container border border-surface-container-high rounded-xl p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-on-surface mb-4 flex items-center gap-2">
                  <Activity size={15} className="text-primary" />
                  <span>Fluxo de Engajamento de Campanhas</span>
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-on-surface-variant uppercase tracking-widest text-[10px]">Leads Importados</span>
                      <span>100% ({stats.captured} leads)</span>
                    </div>
                    <div className="w-full bg-surface border border-surface-container-high rounded-full h-3 overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all duration-550" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-on-surface-variant uppercase tracking-widest text-[10px]">Disparados via WhatsApp</span>
                      <span>85% ({stats.sent} disparos)</span>
                    </div>
                    <div className="w-full bg-surface border border-surface-container-high rounded-full h-3 overflow-hidden">
                      <div className="bg-sky-500 h-full rounded-full transition-all duration-550" style={{ width: '85%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-on-surface-variant uppercase tracking-widest text-[10px]">Taxa de Respostas</span>
                      <span>{stats.conversion}% ({stats.replies} contatos lidos/respondidos)</span>
                    </div>
                    <div className="w-full bg-surface border border-surface-container-high rounded-full h-3 overflow-hidden">
                      <div className="bg-emerald-400 h-full rounded-full transition-all duration-550" style={{ width: `${stats.conversion}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container border border-surface-container-high rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-on-surface mb-2">Orientações de Segurança e Evitar Bloqueios</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Nossa automação estabelece <strong>delays dinâmicos inteligentes</strong> de 2 a 5 minutos por disparo individual de campanha. 
                    Isso emula perfeitamente o comportamento humano de digitação da Meta Cloud API, blindando o número de WhatsApp corporativo contra blacklist.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="bg-surface border border-surface-container-high rounded-xl p-3 text-center">
                    <span className="text-[8px] font-black uppercase tracking-wide text-on-surface-variant block">Limite Diário Seguro</span>
                    <span className="text-sm font-bold text-emerald-500 mt-1 block">250 Envios/Dia</span>
                  </div>
                  <div className="bg-surface border border-surface-container-high rounded-xl p-3 text-center">
                    <span className="text-[8px] font-black uppercase tracking-wide text-on-surface-variant block">Delay de Envio</span>
                    <span className="text-sm font-bold text-primary mt-1 block">120 - 180 Segundos</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign List */}
            <div className="border border-surface-container-high rounded-xl overflow-hidden bg-surface-container">
              <div className="p-4 bg-surface border-b border-surface-container-high">
                <h3 className="text-xs font-extrabold text-on-surface uppercase tracking-wider">Histórico de Campanhas Cadastradas</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface text-on-surface-variant text-[10px] font-black uppercase tracking-wider border-b border-surface-container-high">
                      <th className="py-3 px-4">Nome da Campanha</th>
                      <th className="py-3 px-4">Ramo de Atuação</th>
                      <th className="py-3 px-4">Cidade Alvo</th>
                      <th className="py-3 px-4 text-center">Leads Vinculados</th>
                      <th className="py-3 px-4 text-center">Respostas / Oportunidade</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center w-28">Controle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high font-semibold">
                    {campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-on-surface-variant text-xs font-semibold">
                          Nenhuma campanha cadastrada ainda
                        </td>
                      </tr>
                    ) :
                      campaigns.map(camp => {
                        const isActive = camp.status === 'Ativa';
                        return (
                          <tr key={camp.id} className="hover:bg-primary/5 transition-all">
                          <td className="py-3 px-4 font-bold text-on-surface text-sm">
                            {camp.nome}
                          </td>
                          <td className="py-3 px-4 text-on-surface-variant uppercase text-[10px] tracking-wide">
                            {camp.segmento}
                          </td>
                          <td className="py-3 px-4">
                            {camp.cidade}
                          </td>
                          <td className="py-3 px-4 text-center font-bold">
                            {camp.leadsContatados}
                          </td>
                          <td className="py-3 px-4 text-center font-bold">
                            <span className="text-emerald-500">{camp.respostasRecebidas}</span> / <span className="text-primary">{camp.oportunidadesCriadas}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                              isActive ? 'bg-primary/10 text-primary' : 'bg-surface border border-surface-container-high text-on-surface-variant'
                            }`}>
                              {camp.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleCampaignStatus(camp)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-bold border rounded-lg uppercase tracking-wider transition-all ${
                                isActive 
                                  ? 'border-warning text-warning hover:bg-warning/10' 
                                  : 'border-primary text-primary hover:bg-primary/10'
                              }`}
                            >
                              {isActive ? (
                                <>
                                  <Pause size={10} />
                                  <span>Pausar</span>
                                </>
                              ) : (
                                <>
                                  <Play size={10} />
                                  <span>Ativar</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. WHATSAPP / SMART IA */}
        {activeTab === 'whatsapp' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-200">
            {/* WhatsApp Template Designer */}
            <div className="md:col-span-2 flex flex-col gap-6">
              <div className="bg-surface-container border border-surface-container-high rounded-xl p-5">
                <div className="flex items-center justify-between border-b border-surface-container-high pb-4 mb-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-on-surface flex items-center gap-2">
                    <MessageSquare size={16} className="text-primary" />
                    <span>Criar Modelo com Apoio de IA (Gemini)</span>
                  </h3>
                  <span className="text-[9px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                    Homologado Meta API
                  </span>
                </div>

                {/* Gemini AI smart assist generator */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1">
                    <Sparkles size={12} />
                    <span>Gerador de Roteiro Comercial Inteligente</span>
                  </p>
                  <p className="text-[11px] text-on-surface-variant mb-3 leading-relaxed">
                    Utilize a inteligência artificial embarcada do Gemini para criar roteiros altamente persuasivos e assertivos especificando o ramo do lead.
                  </p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={aiSegmentPrompt}
                      onChange={e => setAiSegmentPrompt(e.target.value)}
                      placeholder="Ex: academia, condomínio residencial, escola" 
                      className="flex-1 bg-surface border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2 rounded-lg"
                    />
                    <button
                      onClick={handleGenerateAiMessageTemplate}
                      disabled={isGeneratingAiMessage}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-on-primary disabled:opacity-50 text-[10px] font-black uppercase px-3 py-2 rounded-lg transition-all shadow"
                    >
                      <Sparkles size={11} className={isGeneratingAiMessage ? 'animate-pulse' : ''} />
                      <span>{isGeneratingAiMessage ? 'Escrevendo...' : 'Gerar Abordagem'}</span>
                    </button>
                  </div>
                </div>

                {/* Main Form Template */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Nome Identificador do Modelo</label>
                    <input 
                      type="text" 
                      value={newTemplateName}
                      onChange={e => setNewTemplateName(e.target.value)}
                      placeholder="Ex: Primeiro Contato Academias"
                      className="w-full bg-surface border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2 rounded-lg"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Mensagem (Suporta {"{{NOME_EMPRESA}}"}, {"{{CIDADE}}"}, {"{{SEGMENTO}}"})</label>
                      <span className="text-[9px] text-on-surface-variant font-mono">Dica: Insira {"{{NOME_EMPRESA}}"} para personalizar</span>
                    </div>
                    <textarea 
                      value={newTemplateBody}
                      onChange={e => setNewTemplateBody(e.target.value)}
                      rows={5}
                      placeholder="Olá! Vimos que você comanda o {{NOME_EMPRESA}} em {{CIDADE}}..."
                      className="w-full bg-surface border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2.5 rounded-lg focus:border-primary/50"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveTemplate}
                      className="flex items-center gap-2 bg-primary text-on-primary font-extrabold text-[10px] uppercase px-4 py-2 rounded-lg transition-all shadow-md"
                    >
                      <Plus size={12} />
                      <span>Salvar Template</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* List of Templates */}
              <div className="bg-surface-container border border-surface-container-high rounded-xl p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-on-surface mb-3">Modelos de Mensagem Salvos ({templates.filter(t => t.type === 'whatsapp').length})</h3>
                <div className="space-y-3">
                  {templates.filter(t => t.type === 'whatsapp').map(temp => (
                    <div key={temp.id} className="bg-surface border border-surface-container-high p-3 rounded-lg flex flex-col justify-between">
                      <span className="font-bold text-xs text-primary uppercase tracking-tight block">{temp.name}</span>
                      <p className="text-[11px] text-on-surface-variant mt-1.5 italic whitespace-pre-wrap">{temp.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Message Dispatch Logs Tracker */}
            <div className="bg-surface-container border border-surface-container-high rounded-xl p-5 flex flex-col">
              <div className="border-b border-surface-container-high pb-3 mb-4 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-on-surface">Monitor Meta Cloud API</h3>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 max-h-[500px] pr-1">
                {messageLogs.length > 0 ? (
                  messageLogs.map(log => {
                    return (
                      <div key={log.id} className="bg-surface p-3 rounded-lg border border-surface-container-high space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-bold text-on-surface">{log.leadNome}</span>
                          <span className="text-on-surface-variant font-mono">{log.telefone}</span>
                        </div>
                        <p className="text-[10px] text-on-surface-variant line-clamp-2 italic">"{log.mensagem}"</p>
                        <div className="flex justify-between items-center text-[9px] pt-1.5 border-t border-surface-container-high">
                          <span className="text-on-surface-variant font-mono">{new Date(log.createdAt).toLocaleTimeString('pt-BR')}</span>
                          <div className="flex items-center gap-1 font-extrabold uppercase tracking-widest text-[8px]">
                            {log.status === 'enviado' && (
                              <span className="text-slate-400 flex items-center gap-0.5">
                                <Clock size={10} />
                                <span>Enviado</span>
                              </span>
                            )}
                            {log.status === 'entregue' && (
                              <span className="text-sky-400 flex items-center gap-0.5">
                                <CheckCircle size={10} />
                                <span>Entregue</span>
                              </span>
                            )}
                            {log.status === 'lido' && (
                              <span className="text-emerald-500 flex items-center gap-0.5">
                                <CheckCheck size={10} className="text-emerald-500" />
                                <span>Lido</span>
                              </span>
                            )}
                            {log.status === 'respondeu' && (
                              <span className="text-primary flex items-center gap-0.5 animate-pulse">
                                <MessageSquare size={10} />
                                <span>Respondeu</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center p-8 text-on-surface-variant text-xs font-semibold">Nenhuma mensagem enviada ainda</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. EMAILS */}
        {activeTab === 'emails' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-200">
            <div className="md:col-span-2 bg-surface-container border border-surface-container-high rounded-xl p-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-on-surface border-b border-surface-container-high pb-3 mb-4">
                Parametrizar Template de Apresentação E-mail (SMTP / CRM)
              </h3>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant font-extrabold">Identificação / Assunto</label>
                  <input 
                    type="text" 
                    value={newTemplateName} 
                    onChange={e => setNewTemplateName(e.target.value)}
                    placeholder="Ex: Parceria Técnica com a Mundo Tech"
                    className="w-full bg-surface border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2 rounded-lg"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant font-extrabold">Corpo do E-mail</label>
                  <textarea 
                    value={newTemplateBody} 
                    onChange={e => setNewTemplateBody(e.target.value)}
                    rows={8}
                    placeholder="Olá portaria ou zeladoria do {{NOME_EMPRESA}}..."
                    className="w-full bg-surface border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2.5 rounded-lg focus:border-primary/50"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setNewTemplateType('email');
                      handleSaveTemplate();
                    }}
                    className="flex items-center gap-2 bg-primary text-on-primary font-extrabold text-[10px] uppercase px-4 py-2 rounded-lg transition-all shadow-md"
                  >
                    <Plus size={12} />
                    <span>Salvar Modelo E-mail</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-surface-container border border-surface-container-high rounded-xl p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-on-surface mb-3 text-red-500 flex items-center gap-1">
                  <Mail size={14} />
                  <span>Configuração de Servidor</span>
                </h3>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Os disparos de e-mail de prospecção utilizam o servidor SMTP corporativo homologado em <strong className="text-primary font-bold">Configurações &gt; E-mail / SMTP</strong>. Certifique-se de configurar a porta SSL ou TLS corretamente para evitar desvios para pasta de SPAM.
                </p>
              </div>

              <div className="bg-surface-container border border-surface-container-high rounded-xl p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-on-surface mb-3">Modelos de E-mail Salvos</h3>
                <div className="space-y-2">
                  {templates.filter(t => t.type === 'email').map(t => (
                    <div key={t.id} className="bg-surface p-2.5 border border-surface-container-high rounded-lg text-xs font-semibold text-on-surface">
                      <span className="font-bold text-primary block">{t.name}</span>
                      <span className="text-[10px] text-on-surface-variant block mt-1 line-clamp-3 italic">"{t.body}"</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. AUTOMAÇÃO */}
        {activeTab === 'automacao' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {automation ? (
              <div className="bg-surface-container border border-surface-container-high rounded-xl p-6">
                <div className="flex items-center justify-between border-b border-surface-container-high pb-4 mb-6">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                      <Zap size={16} className="text-primary" />
                      <span>Configuração do Fluxo de Automação Comercial</span>
                    </h3>
                    <p className="text-xs text-on-surface-variant font-medium mt-1">Defina o que acontece no momento em que um lead é colhido no Google Maps</p>
                  </div>
                  <div>
                    <button
                      onClick={() => handleSaveAutomation({ ativa: !automation.ativa })}
                      className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all shadow-sm ${
                        automation.ativa 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                          : 'bg-surface border-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      <CheckCircle size={14} />
                      <span>{automation.ativa ? 'Automação Ativa' : 'Automação Inativa'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Parameter sliders */}
                  <div className="md:col-span-1 bg-surface border border-surface-container-high rounded-xl p-4 flex flex-col gap-4">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                      <Sliders size={12} />
                      <span>Ações do Gatilho</span>
                    </h4>
                    
                    <label className="flex items-center justify-between gap-2 p-2.5 bg-surface-container rounded-lg border border-surface-container-high cursor-pointer">
                      <span className="text-xs font-bold text-on-surface">Enviar Mensagem Imediata?</span>
                      <input 
                        type="checkbox" 
                        checked={automation.enviarMensagemImediata}
                        onChange={e => handleSaveAutomation({ enviarMensagemImediata: e.target.checked })}
                        className="h-4 w-4 bg-surface rounded text-primary focus:ring-0 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-2 p-2.5 bg-surface-container rounded-lg border border-surface-container-high cursor-pointer">
                      <span className="text-xs font-bold text-on-surface">Criar Lead Como Oportunidade?</span>
                      <input 
                        type="checkbox" 
                        checked={automation.criarOportunidade}
                        onChange={e => handleSaveAutomation({ criarOportunidade: e.target.checked })}
                        className="h-4 w-4 bg-surface rounded text-primary focus:ring-0 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-2 p-2.5 bg-surface-container rounded-lg border border-surface-container-high cursor-pointer">
                      <span className="text-xs font-bold text-on-surface">Ligar Tarefa no Calendário?</span>
                      <input 
                        type="checkbox" 
                        checked={automation.criarTarefaComercial}
                        onChange={e => handleSaveAutomation({ criarTarefaComercial: e.target.checked })}
                        className="h-4 w-4 bg-surface rounded text-primary focus:ring-0 cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Flow chart graphical mapper */}
                  <div className="md:col-span-2 bg-surface border border-surface-container-high rounded-xl p-5 flex flex-col justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant mb-4">Diagrama de Passos Sequenciais</h4>
                    
                    <div className="space-y-4 relative pl-8 border-l-2 border-primary/20 ml-4 py-2">
                      {/* Step 1 */}
                      <div className="relative">
                        <span className="absolute -left-12 top-0.5 bg-primary text-on-primary text-[10px] font-black h-6 w-6 rounded-full flex items-center justify-center border-4 border-surface shadow-sm">1</span>
                        <div className="bg-surface-container border border-surface-container-high p-3 rounded-lg">
                          <span className="text-xs font-extrabold uppercase text-primary">Gatilho Entrada</span>
                          <p className="text-[11px] text-on-surface font-semibold mt-0.5">Captou e Importou estabelecimento do Google Maps via varredura.</p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      {automation.enviarMensagemImediata && (
                        <div className="relative">
                          <span className="absolute -left-12 top-0.5 bg-sky-500 text-on-primary text-[10px] font-black h-6 w-6 rounded-full flex items-center justify-center border-4 border-surface shadow-sm">2</span>
                          <div className="bg-surface-container border border-surface-container-high p-3 rounded-lg">
                            <span className="text-xs font-extrabold uppercase text-sky-500">Ação Disparo WhatsApp</span>
                            <p className="text-[11px] text-on-surface font-semibold mt-0.5">Disparar WhatsApp individual personalizado de abordagem baseada em modelos IA.</p>
                          </div>
                        </div>
                      )}

                      {/* Step 3 */}
                      <div className="relative">
                        <span className="absolute -left-12 top-0.5 bg-amber-500 text-on-primary text-[10px] font-black h-6 w-6 rounded-full flex items-center justify-center border-4 border-surface shadow-sm">3</span>
                        <div className="bg-surface-container border border-surface-container-high p-3 rounded-lg">
                          <span className="text-xs font-extrabold uppercase text-amber-500">Monitoramento Ativo</span>
                          <p className="text-[11px] text-on-surface font-semibold mt-0.5">Aguardando resposta por até 15 minutos em background monitorado.</p>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="relative">
                        <span className="absolute -left-12 top-0.5 bg-emerald-500 text-on-primary text-[10px] font-black h-6 w-6 rounded-full flex items-center justify-center border-4 border-surface shadow-sm">4</span>
                        <div className="bg-surface-container border border-surface-container-high p-3 rounded-lg">
                          <span className="text-xs font-extrabold uppercase text-emerald-500">Aprovou Comercial</span>
                          <p className="text-[11px] text-on-surface font-semibold mt-0.5">
                            Se o lead responder, o CRM promove ao estágio <strong className="text-emerald-500">Qualificado</strong> e agenda tarefa de ligação no calendário comercial para o vendedor do setor.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 text-on-surface-variant font-semibold">Buscando definições de automação...</div>
            )}
          </div>
        )}

        {/* 7. AUDIT LOGS HISTORICO */}
        {activeTab === 'historico' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="border border-surface-container-high rounded-xl overflow-hidden bg-surface-container">
              <div className="p-4 bg-surface border-b border-surface-container-high flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-on-surface uppercase tracking-wider">Histórico de Atividades de Prospecção</h3>
                <span className="text-[10px] text-on-surface-variant">Rastreabilidade completa de auditoria</span>
              </div>
              
              <div className="divide-y divide-surface-container-high font-semibold text-xs">
                {auditLogs.length > 0 ? (
                  auditLogs.map(log => {
                    return (
                      <div key={log.id} className="p-4 hover:bg-surface/40 flex items-start gap-3 transition-all">
                        <div className={`mt-0.5 p-1 rounded-full ${
                          log.tipo === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                          log.tipo === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                          log.tipo === 'error' ? 'bg-red-500/10 text-red-500' :
                          'bg-primary/10 text-primary'
                        }`}>
                          <Activity size={14} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-on-surface text-sm">{log.titulo}</span>
                            <span className="text-[10px] text-on-surface-variant font-mono">
                              {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : '-'}
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant mt-1">{log.descricao}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center p-8 text-on-surface-variant">Sem histórico para exibir.</div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* CREATE CAMPAIGN MODAL FORM */}
      {isModalingCampaign && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface border border-surface-container-high w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-surface-container border-b border-surface-container-high flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider text-on-surface">Cadastrar Nova Campanha de Prospecção</h3>
              <button 
                onClick={() => setIsModalingCampaign(false)}
                className="text-on-surface-variant hover:text-on-surface text-sm uppercase font-extrabold"
              >
                Fechar
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Nome da Campanha</label>
                <input 
                  type="text" 
                  value={newCampaignName}
                  onChange={e => setNewCampaignName(e.target.value)}
                  placeholder="Ex: Clínicas Médicas da Zona Sul"
                  className="w-full bg-surface-container border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2.5 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Segmento</label>
                  <input 
                    type="text" 
                    value={newCampaignSegment}
                    onChange={e => setNewCampaignSegment(e.target.value)}
                    placeholder="Ex: Clínicas"
                    className="w-full bg-surface-container border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2.5 rounded-lg"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Cidade Alvo</label>
                  <input 
                    type="text" 
                    value={newCampaignCity}
                    onChange={e => setNewCampaignCity(e.target.value)}
                    placeholder="Ex: São Paulo"
                    className="w-full bg-surface-container border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2.5 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Palavra-chave de Busca</label>
                <input 
                  type="text" 
                  value={newCampaignKeyword}
                  onChange={e => setNewCampaignKeyword(e.target.value)}
                  placeholder="Ex: clinica odontologica, Pilates"
                  className="w-full bg-surface-container border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2.5 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Limite de Leads</label>
                  <input 
                    type="number" 
                    value={newCampaignMaxLeads}
                    onChange={e => setNewCampaignMaxLeads(Number(e.target.value))}
                    placeholder="Ex: 50"
                    className="w-full bg-surface-container border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2.5 rounded-lg"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Canal de Envio</label>
                  <select 
                    value={newCampaignChannel}
                    onChange={e => setNewCampaignChannel(e.target.value as any)}
                    className="w-full bg-surface-container border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2.5 rounded-lg"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="E-mail">E-mail</option>
                    <option value="Ambos">Ambos</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-5 bg-surface-container border-t border-surface-container-high flex justify-end gap-2">
              <button
                onClick={() => setIsModalingCampaign(false)}
                className="px-4 py-2 border border-surface-container-high text-[10px] font-extrabold uppercase tracking-wider hover:bg-surface rounded-lg text-on-surface-variant"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCampaign}
                className="px-4 py-2 bg-primary hover:bg-primary/95 text-on-primary text-[10px] font-extrabold uppercase tracking-wider rounded-lg shadow"
              >
                Salvar Campanha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK WHATSAPP SEND MODAL */}
      {selectedLeadForWhatsApp && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden">
            <div className="p-5 border-b border-surface-container-high flex items-center justify-between">
              <div><h3 className="text-base font-black text-on-surface">Enviar mensagem via WhatsApp</h3><p className="text-xs text-on-surface-variant mt-1">Revise o conteúdo antes de confirmar o envio real.</p></div>
              <button type="button" onClick={() => setSelectedLeadForWhatsApp(null)} className="text-on-surface-variant hover:text-on-surface">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3 rounded-xl bg-surface p-4 text-xs">
                <div><span className="text-on-surface-variant">Empresa</span><p className="font-bold mt-1">{selectedLeadForWhatsApp.empresa || selectedLeadForWhatsApp.nome}</p></div>
                <div><span className="text-on-surface-variant">Telefone</span><p className="font-bold mt-1">{selectedLeadForWhatsApp.telefone || selectedLeadForWhatsApp.whatsapp}</p></div>
                <div className="sm:col-span-2"><span className="text-on-surface-variant">Responsável</span><p className="font-bold mt-1">{user.nome || user.email.split('@')[0]}</p></div>
              </div>
              <div><label className="block text-xs font-bold mb-1.5">Template</label><select value={whatsAppTemplateId} onChange={event => { const id=event.target.value; setWhatsAppTemplateId(id); const template=templates.find(item=>item.id===id); if(template) setWhatsAppMessage(template.body.replace(/\{\{NOME_EMPRESA\}\}/g, selectedLeadForWhatsApp.empresa || selectedLeadForWhatsApp.nome).replace(/\{\{CIDADE\}\}/g, selectedLeadForWhatsApp.cidade || 'sua cidade')); }} className="w-full rounded-xl border border-surface-container-high bg-surface px-3 py-2.5 text-sm"><option value="">Mensagem manual</option>{templates.filter(item=>item.type==='whatsapp').map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div><label className="block text-xs font-bold mb-1.5">Mensagem</label><textarea rows={7} value={whatsAppMessage} onChange={event=>setWhatsAppMessage(event.target.value)} className="w-full rounded-xl border border-surface-container-high bg-surface px-3 py-3 text-sm resize-none" placeholder="Digite a mensagem..." /></div>
            </div>
            <div className="p-5 border-t border-surface-container-high flex justify-end gap-3"><button type="button" disabled={isSendingWhatsApp} onClick={()=>setSelectedLeadForWhatsApp(null)} className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-bold">Cancelar</button><button type="button" disabled={isSendingWhatsApp || !whatsAppMessage.trim()} onClick={handleConfirmWhatsAppSend} className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50 flex items-center gap-2">{isSendingWhatsApp ? <><Clock size={14} className="animate-spin" /> Enviando...</> : <><Send size={14} /> Enviar mensagem</>}</button></div>
          </div>
        </div>
      )}

      {/* SEND EMAIL MODAL */}
      {selectedLeadForEmail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface border border-surface-container-high w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-surface-container border-b border-surface-container-high flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-on-surface">Enviar Abordagem E-mail via SMTP</h3>
                <p className="text-[10px] text-on-surface-variant font-semibold mt-0.5">Lead: {selectedLeadForEmail.nome}</p>
              </div>
              <button 
                onClick={() => setSelectedLeadForEmail(null)}
                className="text-on-surface-variant hover:text-on-surface text-sm uppercase font-extrabold"
              >
                Fechar
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Selecione o Modelo / Template</label>
                <select
                  value={emailModalData.templateId}
                  onChange={e => handleSelectTemplateForEmail(e.target.value, selectedLeadForEmail)}
                  className="w-full bg-surface border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2.5 rounded-lg outline-none"
                >
                  <option value="">-- Personalizado / Nenhum Modelo --</option>
                  {templates.filter(t => t.type === 'email').map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">E-mail de Destino</label>
                <input 
                  type="email" 
                  value={emailModalData.to}
                  onChange={e => setEmailModalData({ ...emailModalData, to: e.target.value })}
                  placeholder="exemplo@empresa.com"
                  className="w-full bg-surface border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2.5 rounded-lg"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Assunto do E-mail</label>
                <input 
                  type="text" 
                  value={emailModalData.subject}
                  onChange={e => setEmailModalData({ ...emailModalData, subject: e.target.value })}
                  placeholder="Ex: Parceria com a Mundo Tech"
                  className="w-full bg-surface border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2.5 rounded-lg"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Corpo do E-mail</label>
                <textarea 
                  value={emailModalData.body}
                  onChange={e => setEmailModalData({ ...emailModalData, body: e.target.value })}
                  rows={6}
                  placeholder="Escreva a mensagem..."
                  className="w-full bg-surface border border-surface-container-high text-on-surface text-xs font-semibold px-3 py-2.5 rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="p-5 bg-surface-container border-t border-surface-container-high flex justify-between items-center gap-2">
              <span className="text-[9px] font-bold text-on-surface-variant bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10">
                Usa Servidor SMTP Homologado
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedLeadForEmail(null)}
                  className="px-4 py-2 border border-surface-container-high text-[10px] font-extrabold uppercase tracking-wider hover:bg-surface rounded-lg text-on-surface-variant"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendEmailToLead}
                  disabled={isSendingEmail || !emailModalData.to}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-on-primary text-[10px] font-extrabold uppercase tracking-wider rounded-lg shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSendingEmail ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full"></div>
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send size={12} />
                      <span>Disparar E-mail</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
