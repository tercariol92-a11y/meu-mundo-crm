import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Search, 
  Send, 
  Paperclip, 
  MoreVertical, 
  User, 
  Building2, 
  Target, 
  Headset, 
  Wrench, 
  Plus, 
  Link as LinkIcon,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  FileText,
  MessageSquare,
  Phone,
  ChevronRight,
  ChevronLeft,
  Filter,
  ArrowRight,
  MessageCircle,
  Share2,
  X,
  History,
  UserMinus,
  Archive,
  Copy,
  FileImage,
  FileVideo,
  Music,
  Camera,
  Paperclip as PaperclipIcon,
  Bell,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { databaseService } from '../../services/databaseService';
import { whatsappService } from '../../services/whatsapp.service';
import { whatsappApi } from '../../services/whatsappApi';
import { Conversation, ChatMessage, Usuario, ConversationStatus, Chamado, Cliente, Proposta, Lead, WhatsAppTemplate } from '../../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import ContactAvatarUploader from './ContactAvatarUploader';
import QuoteWizard from '../comercial/QuoteWizard';
import ProposalViewer from '../comercial/ProposalViewer';
import { auth } from '../../firebase';

function getAttendantIdentity(user: Usuario) {
  const compatibleUser = user as Usuario & { displayName?: string; name?: string };
  const email = String(compatibleUser.email || '').trim();
  const attendantName = String(
    compatibleUser.displayName || compatibleUser.nome || compatibleUser.name || email.split('@')[0] || 'Atendente'
  ).trim() || 'Atendente';
  return { attendantName, attendantId: compatibleUser.id || auth.currentUser?.uid || '', attendantEmail: email || auth.currentUser?.email || '' };
}

function getConversationAvatar(conversation?: Conversation | null) {
  return conversation?.groupPhotoUrl || getAvatarUrl(conversation?.lead);
}

// Robust helper to parse any date format safely (ISO string, Timestamp, Date, Unix number) without breaking the UI
export function safeDate(value: any): Date | null {
  if (!value) return null;
  
  // 1. If it's already a Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  
  // 2. If it's a Firestore Timestamp with .toDate() method
  if (typeof value.toDate === 'function') {
    try {
      const d = value.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) {
        return d;
      }
    } catch (e) {
      // Ignore
    }
  }
  
  // 3. If it's an object with seconds/nanoseconds (raw Firestore Timestamp)
  if (typeof value === 'object') {
    const seconds = value.seconds !== undefined ? value.seconds : value._seconds;
    if (typeof seconds === 'number') {
      const d = new Date(seconds * 1000);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
  }
  
  // 4. If it's a number (milliseconds/seconds)
  if (typeof value === 'number') {
    // If it looks like seconds rather than milliseconds (e.g. less than year 3000)
    const multiplier = value < 10000000000 ? 1000 : 1;
    const d = new Date(value * multiplier);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }
  
  // 5. If it's a string, try parsing it
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d;
    }
    // Try to parse number if string contains only digits
    if (/^\d+$/.test(value)) {
      const parsedNum = parseInt(value, 10);
      const multiplier = parsedNum < 10000000000 ? 1000 : 1;
      const dNum = new Date(parsedNum * multiplier);
      if (!isNaN(dNum.getTime())) {
        return dNum;
      }
    }
  }
  
  return null;
}

// Robust helper to format any date safely, returning "-" if the date is invalid or unavailable
export function safeFormatTime(value: any, formatStr: string = 'HH:mm', options?: any): string {
  const date = safeDate(value);
  if (!date) return '-';
  try {
    return format(date, formatStr, options);
  } catch (err) {
    console.error('[SAFE DATE] Error formatting date:', err, value);
    return '-';
  }
}

function getAvatarUrl(lead?: Lead) {
  return lead?.profilePictureUrl || lead?.photoUrl || lead?.avatarUrl || lead?.fotoPerfil || null;
}

function dateLabel(value: any) {
  const date = safeDate(value);
  if (!date) return '-';
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (startDate === startToday) return 'Hoje';
  if (startDate === startToday - 86400000) return 'Ontem';
  return format(date, 'dd/MM/yyyy');
}

function renderLinkedText(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{part}</a>
    ) : part
  );
}

function IncomingImage({ message }: { message: ChatMessage }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const legacyMessage = message as ChatMessage & { messageId?: string; imageUrl?: string; fileUrl?: string; url?: string };
  const mediaUrl = whatsappApi.resolveMediaUrl(legacyMessage);
  useEffect(() => {
    console.log('[IMAGE RENDER]', { messageId: legacyMessage.messageId || message.id, type: message.type, mediaUrl, thumbnailUrl: message.thumbnailUrl || '' });
  }, [legacyMessage.messageId, message.id, message.type, mediaUrl, message.thumbnailUrl]);
  if (message.mediaStatus === 'processing') return <div className="p-3 text-xs text-[#667781]">Processando imagem...</div>;
  if (message.mediaStatus === 'error' || failed || !mediaUrl) {
    return <div className="p-3 text-xs text-[#667781] flex items-center gap-2"><AlertCircle size={16} />Não foi possível carregar esta imagem.</div>;
  }
  return (
    <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block relative bg-[#f0f2f5] min-h-24">
      {loading && <div className="absolute inset-0 flex items-center justify-center text-xs text-[#667781]">Carregando imagem...</div>}
      <img
        src={message.thumbnailUrl || mediaUrl}
        alt={message.caption || message.fileName || 'Imagem recebida'}
        className={`w-full max-w-[360px] max-h-[420px] object-contain transition-opacity ${loading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setFailed(true); }}
      />
    </a>
  );
}

interface AtendimentoViewProps {
  user: Usuario;
  onViewChange?: (view: any) => void;
}

export default function AtendimentoView({ user, onViewChange }: AtendimentoViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Usuario[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationSnapshotReady = useRef(false);
  const previousUnread = useRef(new Map<string, number>());
  const notifiedEvents = useRef(new Set<string>());
  const selectedIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const originalTitle = useRef(document.title);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('soundNotificationsEnabled') !== 'false');
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [highlightedConversation, setHighlightedConversation] = useState<string | null>(null);

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  useEffect(() => {
    conversations.forEach(({ lead }) => {
      if (!lead) return;
      console.log('[Avatar Frontend]', {
        id: lead.id,
        nome: lead.nome,
        profilePictureUrl: lead.profilePictureUrl,
        photoUrl: lead.photoUrl,
        avatarUrl: lead.avatarUrl
      });
    });
  }, [conversations]);

  const unlockAudio = useCallback(async () => {
    try {
      const audio = new Audio('/sounds/messenger-notification.mp3?v=2');
      audioRef.current = audio;
      audio.preload = 'auto';
      audio.volume = 1.0;
      audio.muted = true;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      setAudioUnlocked(true);
      return true;
    } catch {
      setAudioUnlocked(false);
      return false;
    }
  }, []);

  const playIncomingSound = useCallback(async (isTest = false) => {
    if (!soundEnabled && !isTest) return;
    const audio = new Audio('/sounds/messenger-notification.mp3?v=2');
    audioRef.current = audio;
    audio.preload = 'auto';
    audio.volume = 1;
    audio.currentTime = 0;
    await audio.play()
      .then(() => {
        console.log('[Atendimento] som reproduzido com sucesso');
        console.log('[Atendimento] alerta sonoro disparado');
        setAudioUnlocked(true);
        if (isTest) toast.success('Alertas sonoros ativados');
      })
      .catch((error) => {
        console.error('[Atendimento] falha ao reproduzir som:', error);
        setAudioUnlocked(false);
        toast((item) => (
          <button onClick={() => { toast.dismiss(item.id); void playIncomingSound(true); }} className="font-bold text-left">
            Clique no ícone de som para ativar os alertas.
          </button>
        ), { icon: '🔇', duration: 8000 });
      });
  }, [soundEnabled]);

  useEffect(() => {
    const handleFirstInteraction = () => void unlockAudio();
    document.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    return () => document.removeEventListener('pointerdown', handleFirstInteraction);
  }, [unlockAudio]);

  useEffect(() => {
    const totalUnread = conversations.reduce((total, conversation) => total + (conversation.unreadCount || 0), 0);
    document.title = totalUnread > 0 ? `(${totalUnread}) Meu Mundo CRM` : originalTitle.current;
    return () => { document.title = originalTitle.current; };
  }, [conversations]);

  const testNotificationSound = useCallback(async () => {
    setSoundEnabled(true);
    localStorage.setItem('soundNotificationsEnabled', 'true');
    await playIncomingSound(true);
  }, [playIncomingSound]);

  const enableBrowserNotifications = useCallback(async () => {
    if (!('Notification' in window)) return toast.error('Este navegador não oferece notificações.');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') toast.success('Notificações do navegador ativadas.');
    else toast.error('Permissão de notificações não concedida.');
  }, []);
  
  const selectedConversation = useMemo(() => 
    conversations.find(c => c.id === selectedId),
    [conversations, selectedId]
  );
  
  // Keep track of the selected lead phone explicitly
  const selectedPhoneRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedConversation) {
      selectedPhoneRef.current = selectedConversation.phone;
      
      // Fetch client data lazily
      if (selectedConversation.clientId) {
        databaseService.getClienteById(selectedConversation.clientId).then(client => {
          setSelectedClient(client || null);
        }).catch(err => {
          console.error("Error fetching client for conversation:", err);
          setSelectedClient(null);
        });
      } else {
        setSelectedClient(null);
      }
    } else {
      setSelectedClient(null);
    }
  }, [selectedConversation]);
  
  // Resizable Logic
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('chat_sidebar_width');
    return saved ? parseInt(saved) : 420;
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('chat_sidebar_collapsed') === 'true';
  });
  const isResizing = useRef(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    // Calculate width relative to the left sidebar (w-52 = 208px)
    const newWidth = Math.max(300, Math.min(650, e.clientX - 208));
    setSidebarWidth(newWidth);
    localStorage.setItem('chat_sidebar_width', newWidth.toString());
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('chat_sidebar_collapsed', String(next));
      return next;
    });
  };

  const [filterStatus, setFilterStatus] = useState<ConversationStatus | 'todos'>('todos');
  const [filterOwner, setFilterOwner] = useState<'meu' | 'todos'>('todos');
  const [conversationKind, setConversationKind] = useState<'todos' | 'individual' | 'grupo'>('todos');
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [showContactEditModal, setShowContactEditModal] = useState(false);
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showLinkClientModal, setShowLinkClientModal] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [showCreateProposalModal, setShowCreateProposalModal] = useState(false);
  const [showCommercialDocumentMenu, setShowCommercialDocumentMenu] = useState(false);
  const [budgetWizardContext, setBudgetWizardContext] = useState<any>(null);
  const [editingBudget, setEditingBudget] = useState<Proposta | undefined>();
  const [viewingBudget, setViewingBudget] = useState<Proposta | null>(null);
  const [continueToBudgetAfterClient, setContinueToBudgetAfterClient] = useState(false);
  const [showConvertLeadModal, setShowConvertLeadModal] = useState(false);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [proposals, setProposals] = useState<Proposta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = databaseService.onConversationsChange((data) => {
      if (conversationSnapshotReady.current) {
        data.forEach(conv => {
          const oldUnread = previousUnread.current.get(conv.id) || 0;
          const eventKey = conv.lastMessageId || `${conv.id}:${conv.updatedAt}:${conv.unreadCount}`;
          if (conv.unreadCount > oldUnread && !notifiedEvents.current.has(eventKey)) {
            notifiedEvents.current.add(eventKey);
            console.log(`[Atendimento] nova mensagem detectada; messageId=${eventKey}`);
            const rawPreview = conv.lastMessageBody || 'Nova mensagem recebida';
            const preview = rawPreview.startsWith('[Foto') ? '📷 Enviou uma imagem' :
              rawPreview.startsWith('[Áudio') ? '🎤 Enviou um áudio' :
              rawPreview.startsWith('[Documento') ? '📎 Enviou um documento' : rawPreview.slice(0, 100);
            setHighlightedConversation(conv.id);
            window.setTimeout(() => setHighlightedConversation(current => current === conv.id ? null : current), 5000);
            toast((item) => (
              <button className="text-left" onClick={() => { setSelectedId(conv.id); toast.dismiss(item.id); }}>
                <strong className="block text-sm">{conv.isGroup ? `Nova mensagem em ${conv.contactName}` : `Nova mensagem de ${conv.contactName}`}</strong>
                <span className="block text-xs text-slate-600 max-w-72 truncate">“{preview}”</span>
              </button>
            ), { duration: 6000, icon: '💬' });
            void playIncomingSound();
            if ('Notification' in window && Notification.permission === 'granted') {
              const notification = new Notification(conv.isGroup ? `Nova mensagem em ${conv.contactName}` : conv.contactName, { body: preview, icon: getConversationAvatar(conv) || '/icons/default-avatar.svg', tag: eventKey });
              notification.onclick = () => { window.focus(); setSelectedId(conv.id); notification.close(); };
            }
          } else if (conv.unreadCount > oldUnread && notifiedEvents.current.has(eventKey)) {
            console.log(`[Atendimento] alerta duplicado ignorado; messageId=${eventKey}`);
          }
        });
      }
      previousUnread.current = new Map(data.map(conv => [conv.id, conv.unreadCount || 0]));
      conversationSnapshotReady.current = true;
      setConversations(data);
      setLoading(false);

      // Check for deep link
      const targetPhone = localStorage.getItem('whatsapp_target_phone');
      if (targetPhone && data.length > 0) {
        // Find existing conversation OR conversation that was just created
        const conv = data.find(c => 
          c.phone === targetPhone || 
          c.phone === `55${targetPhone}` || 
          targetPhone === `55${c.phone}`
        );
        if (conv) {
          setSelectedId(conv.id);
          localStorage.removeItem('whatsapp_target_phone');
        }
      }
    });

    // Load users for transfer
    databaseService.getUsuarios().then(setUsers);
    // Load clients for linking
    databaseService.getClientes().then(setClients);

    return () => unsubscribe();
  }, [playIncomingSound]);

  // Load proposals for the selected conversation
  useEffect(() => {
    if (selectedConversation) {
      const leadId = selectedConversation.leadId;
      const clientId = selectedConversation.clientId;
      
      if (leadId || clientId) {
        databaseService.getPropostas().then(allProposals => {
          const filtered = allProposals.filter(p => 
            (leadId && p.leadId === leadId) || 
            (clientId && p.clienteId === clientId)
          );
          setProposals(filtered);
        });
      }
    } else {
      setProposals([]);
    }
  }, [selectedConversation]);

  // Auto-scroll to bottom quando messages change
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [messages]);

  const getStatusBadge = (status: ConversationStatus) => {
    const configs: Record<ConversationStatus, { label: string, color: string }> = {
      novo: { label: 'Novo', color: 'bg-primary/10 text-primary' },
      em_atendimento: { label: 'Em Atendimento', color: 'bg-blue-100 text-blue-700 shadow-sm' },
      aguardando_cliente: { label: 'Aguardando Cliente', color: 'bg-warning/10 text-warning border border-warning/20' },
      aguardando_interno: { label: 'Aguardando Interno', color: 'bg-purple-100 text-purple-700' },
      finalizado: { label: 'Finalizado', color: 'bg-success/10 text-success' },
      arquivado: { label: 'Arquivado', color: 'bg-gray-100 text-gray-600' },
      bloqueado: { label: 'Bloqueado', color: 'bg-red-100 text-red-700' },
      convertido_chamado: { label: 'Chamado Aberto', color: 'bg-error/10 text-error' },
      convertido_lead: { label: 'Lead Criado', color: 'bg-secondary/10 text-secondary' },
    };

    const config = configs[status] || configs.novo;
    return (
      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${config.color}`}>
        {config.label}
      </span>
    );
  };

  useEffect(() => {
    if (selectedConversation) {
      const unsubscribe = selectedConversation.isGroup && selectedConversation.groupId
        ? databaseService.onGroupMessagesChange(selectedConversation.groupId, (data) => setMessages(data))
        : databaseService.onMessagesChange(selectedConversation.leadId || selectedConversation.id, (data) => {
        setMessages(data);
      });
      return () => unsubscribe();
    } else {
      setMessages([]);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (selectedId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === selectedId);
      if (conv?.phone) {
        selectedPhoneRef.current = conv.phone;
      }
      if (conv?.leadId && conv.unreadCount > 0) {
        databaseService.markAsRead(conv.leadId);
      } else if (conv?.isGroup && conv.groupId && conv.unreadCount > 0) {
        databaseService.markGroupAsRead(conv.groupId);
      }
    }
  }, [selectedId, conversations]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!selectedId || !selectedConversation) {
      setError('Nenhuma conversa selecionada');
      return;
    }

    const telefoneOriginal = selectedConversation.telefone || selectedConversation.phone;
    if (!telefoneOriginal) {
      setError('Telefone não encontrado para este contato');
      return;
    }

    const messageTextTrim = messageText.trim();
    if (!messageTextTrim) {
      return;
    }

    // Normalização do telefone conforme solicitado
    const telefoneFinal = String(telefoneOriginal || '').replace(/\D/g, '');
    const telefoneWhatsApp = selectedConversation.isGroup
      ? String(selectedConversation.remoteJid || telefoneOriginal)
      : (telefoneFinal.startsWith('55') ? telefoneFinal : `55${telefoneFinal}`);
    
    const { attendantName, attendantId, attendantEmail } = getAttendantIdentity(user);

    // Optimistic UI update
    const optimisticMsg: ChatMessage = {
      id: 'optimistic-' + Date.now(),
      conversationId: selectedId,
      body: messageTextTrim,
      direction: 'out',
      fromMe: true,
      sender: attendantName,
      atendente: attendantName,
      attendantName,
      attendantId,
      attendantEmail,
      senderType: 'user',
      timestamp: new Date().toISOString(),
      status: 'sending',
      type: 'text'
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    setMessageText('');

    try {
      // Usando telefoneWhatsApp e messageTextTrim conforme solicitado
      const res = await whatsappService.sendMessage(telefoneWhatsApp, messageTextTrim, attendantName, {
        attendantId,
        attendantEmail,
        source: 'atendimento',
        isGroup: Boolean(selectedConversation.isGroup),
        groupId: selectedConversation.groupId
      });
      if (!res?.messageId) throw new Error('O Baileys não confirmou o messageId do envio.');
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      setError(error.message || 'Erro ao enviar mensagem');
      setMessageText(messageTextTrim);
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleAssume = async () => {
    if (!selectedId || !selectedConversation) return;
    try {
      await databaseService.assignConversation(selectedConversation.leadId, user.id);
    } catch (error) {
      console.error('Error assuming conversation:', error);
    }
  };

  const handleFinalize = async () => {
    console.log('[FINALIZE] Button clicked');
    if (isFinalizing) return;
    const leadId = selectedConversation?.leadId || selectedId;
    if (!leadId || !selectedConversation) {
      setFinalizeError('Não foi possível identificar o atendimento selecionado.');
      return;
    }
    try {
      setIsFinalizing(true);
      setFinalizeError(null);
      const attendantName = user.nome || user.email?.split('@')[0] || 'Atendente';
      const result = await databaseService.finalizeAtendimento(leadId, attendantName);
      setConversations(current => current.map(conversation => conversation.id === selectedId
        ? { ...conversation, status: 'finalizado' as ConversationStatus, unreadCount: 0 }
        : conversation));
      setShowFinalizeModal(false);
      setSelectedId(null);
      console.log('[FINALIZE] Modal closed');
      if (result?.surveySent === false) {
        toast.success('Atendimento finalizado, mas a mensagem de satisfação não pôde ser enviada.', { duration: 7000 });
      } else {
        toast.success('Atendimento finalizado com sucesso.');
      }
    } catch (error: any) {
      console.error('[FINALIZE] Error', error);
      setFinalizeError(error?.message || 'Não foi possível finalizar o atendimento. Tente novamente.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const isWithin24h = (dateStr?: string) => {
    if (!dateStr) return false;
    const date = safeDate(dateStr);
    if (!date) return false;
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    return diff < 24;
  };

  const handleTransfer = async (targetUserId: string) => {
    if (!selectedId || !selectedConversation) return;
    try {
      await databaseService.assignConversation(selectedConversation.leadId, targetUserId);
      setShowTransferModal(false);
    } catch (error) {
      console.error('Error transferring conversation:', error);
    }
  };

  const refreshConversationProposals = useCallback(async () => {
    if (!selectedConversation) return;
    const allProposals = await databaseService.getPropostas();
    setProposals(allProposals.filter(p =>
      (selectedConversation.leadId && p.leadId === selectedConversation.leadId) ||
      (selectedConversation.clientId && p.clienteId === selectedConversation.clientId) ||
      ((p as any).conversationId && (p as any).conversationId === selectedConversation.id)
    ));
  }, [selectedConversation]);

  const handleLinkClient = async (clientId: string) => {
    if (!selectedId || !selectedConversation) return;
    try {
      await databaseService.updateLead(selectedConversation.leadId, { clienteId: clientId });
      setShowLinkClientModal(false);
      setClients(await databaseService.getClientes());
      if (continueToBudgetAfterClient) {
        setContinueToBudgetAfterClient(false);
        openOfficialBudget(undefined, clientId);
      }
    } catch (error) {
      console.error('Error linking client:', error);
    }
  };

  const handleConvertLead = async () => {
    if (!selectedId || !selectedConversation) return;
    try {
      await databaseService.updateLead(selectedConversation.leadId, { 
        status: 'Qualificado',
      });
      setShowConvertLeadModal(false);
    } catch (error) {
      console.error('Error converting lead:', error);
    }
  };

  const handleCreateProposal = async (data: any) => {
    if (!selectedId || !selectedConversation) return;
    try {
      await databaseService.createProposta({
        ...data,
        leadId: selectedConversation.leadId,
        clienteId: selectedConversation.clientId,
        status: 'Enviado',
        vendedorId: user.id,
      });
      setShowCreateProposalModal(false);
      // Refresh proposals
      databaseService.getPropostas().then(allProposals => {
        const filtered = allProposals.filter(p => 
          (selectedConversation.leadId && p.leadId === selectedConversation.leadId) || 
          (selectedConversation.clientId && p.clienteId === selectedConversation.clientId)
        );
        setProposals(filtered);
      });
    } catch (error) {
      console.error('Error creating proposal:', error);
    }
  };

  const openOfficialBudget = (quickProposal?: Record<string, any>, linkedClientId?: string) => {
    if (!selectedConversation) return;
    const lead: any = selectedConversation.lead || {};
    const context = {
      origin: 'whatsapp_atendimento',
      createdFromModule: 'atendimento',
      conversationId: selectedConversation.id,
      atendimentoId: selectedConversation.id,
      leadId: selectedConversation.leadId,
      clienteId: linkedClientId || selectedConversation.clientId,
      contactPhone: selectedConversation.phone,
      ownerUserId: (selectedConversation as any).ownerUserId || (selectedConversation as any).whatsappOwnerUserId || user.id,
      assignedUserId: (selectedConversation as any).assignedUserId || selectedConversation.assignedTo || user.id,
      createdByUserId: user.id,
      createdByUserName: user.nome,
      vendedorId: (selectedConversation as any).assignedUserId || selectedConversation.assignedTo || user.id,
      contato: {
        nome: selectedConversation.contactName,
        telefone: selectedConversation.phone,
        email: lead.email || '',
        empresa: lead.empresa || lead.nomeFantasia || '',
        cnpj: lead.cnpj || lead.cpfCnpj || '',
        endereco: lead.endereco || ''
      },
      quickProposal: quickProposal || null
    };
    setShowCommercialDocumentMenu(false);
    setShowCreateProposalModal(false);
    setEditingBudget(undefined);
    setBudgetWizardContext(context);
  };

  const openLinkedBudget = (budgetId: string) => {
    const budget = proposals.find(item => item.id === budgetId);
    if (budget) setViewingBudget(budget);
  };

  const handleCreateTicket = async (data: Partial<Chamado>) => {
    if (!selectedId || !selectedConversation) return;
    try {
      // 1. Create ticket
      const result = await databaseService.createChamado({
        ...data,
        clienteId: selectedConversation.clientId || '',
        unidadeId: selectedConversation.unitId || '',
        status: 'aberto',
        prioridade: 'media',
        titulo: data.titulo || `Atendimento WhatsApp: ${selectedConversation.contactName}`,
        descricao: data.descricao || `Conversa iniciada via WhatsApp.\nHistórico breve: ${messages.slice(-5).map(m => `[${m.direction}] ${m.body}`).join('\n')}`,
      } as any);

      const ticketId = (result as any).id;

      // 2. Link conversation to ticket
      await databaseService.updateConversation(selectedId, { 
        ticketId,
        status: 'convertido_chamado'
      });

      setShowCreateTicketModal(false);
    } catch (error) {
      console.error('Erro ao abrir chamado:', error);
    }
  };

  const handleArchive = async () => {
    if (!selectedId || !selectedConversation) return;
    try {
      await databaseService.archiveConversation(selectedConversation.leadId);
      setSelectedId(null);
      setShowTopMenu(false);
    } catch (error) {
      console.error('Error archiving:', error);
    }
  };

  const handleSendTemplate = async (templateName: any, params: string[]) => {
    if (!selectedId || !selectedConversation) return;

    const phone = selectedConversation.telefone || selectedConversation.phone;
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const telefoneFinal = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const attendant = user.nome || user.email || 'Jefferson';

    try {
      const response = await whatsappService.sendTemplate({
        destination: telefoneFinal,
        templateName,
        params
      });

      if (response.success) {
        // Save to chat history
        const timestamp = new Date().toISOString();
        const whatsappMessageId = response?.result?.messages?.[0]?.id || response?.messages?.[0]?.id || 'template-' + Date.now();
        await databaseService.sendTemplateMessage(selectedId, {
          templateName,
          params,
          atendente: attendant,
          body: `[TEMPLATE: ${templateName}] Enviado com sucesso.`,
          whatsappMessageId
        });
        
        setShowTemplateModal(false);
        // Refresh messages will happen via listener
      } else {
        throw new Error(response.error || 'Erro ao enviar template');
      }
    } catch (error: any) {
      console.error('Erro ao enviar template:', error);
      setError(error.message || 'Erro ao enviar template');
    }
  };
 
  const handleBlock = async () => {
    if (!selectedId || !selectedConversation) return;
    try {
      await databaseService.blockContact(selectedConversation.leadId);
      setSelectedId(null);
      setShowBlockConfirm(false);
      setShowTopMenu(false);
    } catch (error) {
      console.error('Error blocking:', error);
    }
  };

  const handleMarkAsUnread = async () => {
    if (!selectedId || !selectedConversation) return;
    try {
      await databaseService.markAsUnread(selectedConversation.leadId);
      setShowTopMenu(false);
    } catch (error) {
      console.error('Error marking as unread:', error);
    }
  };

  const [availableTemplates, setAvailableTemplates] = useState<WhatsAppTemplate[]>([]);

  useEffect(() => {
    if (showTemplateModal) {
      databaseService.getWhatsAppTemplates().then(templates => {
        const filtered = (templates || []).filter(t => {
          const statusStr = (t.status || "").toUpperCase();
          return statusStr === "APPROVED" || statusStr === "ACTIVE";
        });
        setAvailableTemplates(filtered);
      });
    }
  }, [showTemplateModal]);

  const copyLeadLink = () => {
    if (!selectedId) return;
    const url = `${window.location.origin}/atendimento?id=${selectedId}`;
    navigator.clipboard.writeText(url);
    setShowShareMenu(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setFilePreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
      setShowAttachMenu(false);
    }
  };

  const handleSendMedia = async () => {
    if (!selectedId || !selectedConversation || !selectedFile || isSendingMedia) return;
    const rawDestination = String(selectedConversation.remoteJid || selectedConversation.telefone || selectedConversation.phone || '');
    const phone = rawDestination.replace(/\D/g, '');
    const completePhone = selectedConversation.isGroup ? rawDestination : (phone.startsWith('55') ? phone : `55${phone}`);
    const caption = messageText.trim();
    const { attendantName, attendantId, attendantEmail } = getAttendantIdentity(user);
    setIsSendingMedia(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('to', completePhone);
      formData.append('file', selectedFile, selectedFile.name);
      formData.append('caption', caption);
      formData.append('leadId', selectedConversation.leadId || selectedId);
      formData.append('conversationId', selectedId);
      formData.append('isGroup', String(Boolean(selectedConversation.isGroup)));
      if (selectedConversation.groupId) formData.append('groupId', selectedConversation.groupId);
      formData.append('attendantName', attendantName);
      formData.append('attendantId', attendantId);
      formData.append('attendantEmail', attendantEmail);
      formData.append('manualFromAtendimento', 'true');
      const result = await whatsappApi.sendImage(formData);
      if (!result.success || !result.messageId) {
        throw new Error(result.error || 'Não foi possível enviar a imagem.');
      }
      setSelectedFile(null);
      setFilePreview(null);
      setMessageText('');
    } catch (error: any) {
      console.error('Erro ao enviar mídia:', error);
      setError(error.message || 'Não foi possível enviar a imagem.');
    } finally {
      setIsSendingMedia(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedId || !selectedConversation) return;
    try {
      await databaseService.updateLeadStatus(selectedConversation.leadId, newStatus);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations
      .filter(c => {
        const matchesSearch = 
          c.contactName.toLowerCase().includes(searchTerm.toLowerCase()) || 
          c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.lastMessageBody && c.lastMessageBody.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = filterStatus === 'todos' || c.status === filterStatus;
        const matchesOwner = filterOwner === 'todos' || c.assignedTo === user.id;
        const matchesKind = conversationKind === 'todos' || (conversationKind === 'grupo' ? c.isGroup : !c.isGroup);
        return matchesSearch && matchesStatus && matchesOwner && matchesKind;
      })
      .sort((a, b) => {
        const dA = safeDate(a.lastMessageAt);
        const dB = safeDate(b.lastMessageAt);
        const dateA = dA ? dA.getTime() : 0;
        const dateB = dB ? dB.getTime() : 0;
        return dateB - dateA;
      });
  }, [conversations, searchTerm, filterStatus, filterOwner, conversationKind, user.id]);

  const getStatusCount = (status: ConversationStatus | 'todos') => {
    if (status === 'todos') return conversations.length;
    return conversations.filter(c => c.status === status).length;
  };

  return (
    <div className="h-[calc(100vh-64px)] flex bg-[#f0f2f5] overflow-hidden select-none">
      {/* Coluna 1: Lista de Conversas (Estilo WhatsApp) */}
      <div 
        style={{ width: isCollapsed ? 76 : sidebarWidth }}
        className="border-r border-[#d1d7db] flex flex-col bg-white shrink-0 z-20 relative transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-[4px_0_12px_rgba(0,0,0,0.03)]"
      >
        <div className={`bg-[#f0f2f5] flex flex-col transition-all duration-500 border-b border-[#d1d7db]/10 ${isCollapsed ? 'h-16' : 'h-[118px]'}`}>
          {/* Header Busca */}
          <div className={`flex items-center px-4 justify-between transition-all ${isCollapsed ? 'h-full justify-center' : 'h-16'}`}>
            <div className={`w-10 h-10 rounded-full bg-[#dfe5e7] border border-[#d1d7db] flex items-center justify-center shrink-0 shadow-sm transition-all duration-500 overflow-hidden ${isCollapsed ? 'scale-90' : ''}`}>
              <img 
                src={user.photoURL || 'https://ui-avatars.com/api/?name=M+T&background=2563eb&color=fff&bold=true&size=64'} 
                alt={user.nome || 'Usuário'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.querySelector('.avatar-initial')?.classList.remove('hidden');
                }}
              />
              <span className="avatar-initial font-bold text-[#54656f] hidden">{user.nome?.charAt(0) || '?'}</span>
            </div>
            {!isCollapsed && (
              <div className="flex gap-1">
                <button
                  onClick={() => void testNotificationSound()}
                  className={`p-2 hover:bg-[#d1d7db]/60 rounded-full transition-all ${soundEnabled ? 'text-[#25d366]' : 'text-[#667781]'}`}
                  title="Ativar e testar alertas sonoros"
                >
                  {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
                <button
                  onClick={() => void testNotificationSound()}
                  className="p-2 hover:bg-[#d1d7db]/60 rounded-full transition-all text-[#54656f] hover:text-primary"
                  title="Testar som"
                >
                  <Bell size={20} />
                </button>
                {'Notification' in window && Notification.permission !== 'granted' && (
                  <button
                    onClick={() => void enableBrowserNotifications()}
                    className="px-2 py-1 text-[9px] font-black uppercase tracking-wide text-primary hover:bg-primary/10 rounded-lg"
                    title="Ativar notificações do navegador"
                  >
                    Ativar notificações
                  </button>
                )}
                <button className="p-2 hover:bg-[#d1d7db]/60 rounded-full transition-all text-[#54656f] hover:text-primary group" title="Nova Conversa">
                  <MessageSquare size={20} className="group-hover:scale-110 transition-transform" />
                </button>
                <button className="p-2 hover:bg-[#d1d7db]/60 rounded-full transition-all text-[#54656f] hover:text-primary group">
                  <MoreVertical size={20} className="group-hover:rotate-90 transition-transform" />
                </button>
              </div>
            )}
          </div>
          
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-3 pb-3"
            >
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-[#667781] group-focus-within:text-primary transition-colors" />
                </div>
                <input 
                  type="text" 
                  placeholder="Pesquisar mensagens ou contato..."
                  className="w-full bg-white border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 shadow-sm transition-all placeholder:text-[#667781]/60"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* Filtros de Status */}
        {!isCollapsed && (
          <div className="flex px-3 pt-3 gap-2 bg-white">
            {([['todos', 'Todos'], ['individual', 'Individuais'], ['grupo', 'Grupos']] as const).map(([value, label]) => (
              <button key={value} onClick={() => setConversationKind(value)} className={`flex-1 px-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors ${conversationKind === value ? 'bg-[#075e54] text-white' : 'bg-[#f0f2f5] text-[#54656f]'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        {!isCollapsed && (
              <div className="flex px-3 py-3 gap-2 border-b border-[#f0f2f5] overflow-x-auto no-scrollbar bg-white">
                {['todos', 'Novo', 'Em atendimento', 'Aguardando cliente', 'Resolvido', 'Finalizado', 'Arquivado', 'Bloqueado'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status.toLowerCase().replace(' ', '_') as any)}
                    className={`px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.05em] whitespace-nowrap transition-all flex items-center gap-2 group ${
                      filterStatus === status.toLowerCase().replace(' ', '_') 
                        ? 'bg-primary text-white shadow-xl shadow-primary/20 ring-2 ring-primary/10 scale-105' 
                        : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#d1d7db]/50 hover:scale-102'
                    }`}
                  >
                    {status}
                    <span className={`text-[9px] min-w-[18px] px-1.5 py-0.5 rounded-md flex items-center justify-center transition-all ${filterStatus === status.toLowerCase().replace(' ', '_') ? 'bg-white/20' : 'bg-black/5 group-hover:bg-black/10'}`}>
                      {status === 'todos' ? conversations.length : conversations.filter(c => c.lead?.status === status).length}
                    </span>
                  </button>
                ))}
              </div>
        )}

        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
              <p className="text-[10px] font-black uppercase tracking-widest">Carregando...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center text-on-surface-variant overflow-hidden">
              <MessageSquare size={isCollapsed ? 24 : 48} className="mb-4 opacity-10" />
              {!isCollapsed && (
                <>
                  <p className="text-sm font-bold text-[#111b21]/40 mb-1">Nenhuma conversa</p>
                  <p className="text-xs text-[#667781]/40 uppercase tracking-widest font-black">Ajuste os filtros</p>
                </>
              )}
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`w-full flex items-center px-3 py-4 border-b border-[#f0f2f5] transition-all hover:bg-[#f5f6f6] text-left relative group ${selectedId === conv.id ? 'bg-[#ebebeb] ring-inset ring-l-4 ring-primary' : ''} ${highlightedConversation === conv.id ? 'bg-emerald-50 ring-2 ring-inset ring-[#25d366]/40' : ''} ${isCollapsed ? 'justify-center py-5' : ''}`}
                title={isCollapsed ? conv.contactName : undefined}
              >
                <div className="relative shrink-0 transition-transform group-hover:scale-105">
                  <ContactAvatarUploader 
                    leadId={conv.leadId || ''} 
                    photoURL={getConversationAvatar(conv)} 
                    name={conv.contactName} 
                    size="md" 
                    editable={false} 
                    className={selectedId === conv.id ? 'border-primary/20 shadow-md' : ''}
                  />
                  {conv.channel === 'whatsapp' && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#25d366] rounded-full border-2 border-white flex items-center justify-center text-white shadow-sm">
                      <MessageCircle size={10} fill="currentColor" />
                    </div>
                  )}
                  {isCollapsed && conv.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#25d366] rounded-full border-2 border-white flex items-center justify-center shadow-lg transform scale-110">
                      <span className="text-[9px] font-black text-white">{conv.unreadCount}</span>
                    </div>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="flex-1 min-w-0 ml-4">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="text-[15px] font-bold text-[#111b21] truncate leading-tight group-hover:text-primary transition-colors">
                        {conv.contactName}
                      </h3>
                      <span className={`text-[10px] whitespace-nowrap ml-2 uppercase tracking-tighter ${conv.unreadCount > 0 ? 'text-[#25d366] font-black' : 'text-[#667781] font-medium'}`}>
                        {conv.lastMessageAt ? safeFormatTime(conv.lastMessageAt, 'HH:mm') : ''}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {conv.lastMessageDirection === 'outbound' && (
                          conv.lastMessageStatus === 'read' ? <CheckCheck size={14} className="text-[#53bdeb] shrink-0" /> :
                          <Check size={14} className="text-[#667781] shrink-0" />
                        )}
                        <p className={`text-[13px] truncate leading-tight flex-1 ${conv.unreadCount > 0 ? 'text-[#111b21] font-bold' : 'text-[#667781]'}`}>
                          {conv.lastMessageBody || 'Sem mensagens'}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="bg-[#25d366] text-white text-[10px] font-black min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5 ml-2 shadow-[0_4px_10px_rgba(37,211,102,0.3)] transform group-hover:scale-110 transition-transform">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
                      {getStatusBadge(conv.status)}
                      {conv.lead && !conv.isGroup && (
                        <span className="px-2 py-0.5 rounded-md bg-secondary/5 text-secondary text-[8px] font-black uppercase tracking-[0.1em] border border-secondary/10">Lead</span>
                      )}
                      {conv.isGroup && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase tracking-[0.1em] border border-emerald-100">Grupo</span>
                      )}
                    </div>
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Resizable Divider Interaction Area */}
      <div 
        onMouseDown={startResizing}
        className={`w-1 cursor-col-resize hover:bg-primary/30 transition-all duration-300 z-40 group relative flex items-center justify-center ${isCollapsed ? 'hidden' : ''}`}
      >
        <div className="absolute top-0 bottom-0 left-[-4px] right-[-4px] group-hover:bg-primary/5 transition-colors"></div> {/* Draggable area expandido */}
        
        {/* Glow effect on hover */}
        <div className="absolute inset-y-0 left-0 w-[2px] bg-primary opacity-0 group-hover:opacity-20 blur-[1px] transition-opacity"></div>
        
        {/* Center line */}
        <div className="w-[1px] h-12 bg-[#d1d7db] group-hover:h-full group-hover:bg-primary/40 transition-all duration-300"></div>

        {/* Toggle Collapse Button (Centered on divider) */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse();
          }}
          className="absolute z-50 bg-white border border-[#d1d7db] shadow-[0_4px_12px_rgba(0,0,0,0.12)] rounded-full p-2 transition-all hover:scale-125 active:scale-95 text-[#667781] hover:text-primary hover:border-primary/30 group/btn translate-x-[-1px]"
        >
          <ChevronLeft size={14} className="group-hover/btn:-translate-x-0.5 transition-all duration-300" />
        </button>
      </div>

      {/* Re-expand button when collapsed */}
      {isCollapsed && (
        <div className="absolute left-[76px] top-0 bottom-0 w-1 flex items-center z-50">
          <button 
            onClick={toggleCollapse}
            className="absolute left-[-16px] bg-white border border-[#d1d7db] shadow-[0_4px_12px_rgba(0,0,0,0.15)] rounded-full p-2 hover:text-primary hover:scale-125 transition-all active:scale-95 group/expand"
          >
            <ChevronRight size={18} className="group-hover/expand:translate-x-0.5 transition-transform" />
          </button>
        </div>
      )}

      {/* Coluna 2: Janela de Chat (Estilo WhatsApp) */}
      <div className="flex-1 flex flex-col bg-[#efeae2] relative min-w-0">
        {selectedConversation ? (
          <>
            {/* Header Chat */}
            <div className="h-16 bg-[#f0f2f5] flex items-center justify-between px-4 z-10 shrink-0 shadow-sm border-b border-[#d1d7db]">
              <div className="flex items-center gap-3 overflow-hidden cursor-pointer group" onClick={() => {/* Toggle Sidebar Right if needed */}}>
                  <div className="relative group/avatar">
                    <ContactAvatarUploader 
                      leadId={selectedConversation.leadId || ''} 
                      photoURL={getConversationAvatar(selectedConversation)} 
                      name={selectedConversation.contactName} 
                      size="sm" 
                      editable={!selectedConversation.isGroup}
                      inputId="header-avatar-input"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[#111b21] truncate leading-none mb-1 group-hover:text-primary transition-colors">
                        {selectedConversation.contactName}
                      </h3>
                      {!selectedConversation.isGroup && <select 
                        value={selectedConversation.lead?.status || 'Novo'}
                        onChange={(e) => handleUpdateStatus(e.target.value)}
                        className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border-none focus:ring-0 cursor-pointer transition-colors ${
                          selectedConversation.lead?.status === 'Novo' ? 'bg-blue-100 text-blue-700' :
                          selectedConversation.lead?.status === 'Em contato' ? 'bg-yellow-100 text-yellow-700' :
                          selectedConversation.lead?.status === 'Aguardando cliente' ? 'bg-orange-100 text-orange-700' :
                          selectedConversation.lead?.status === 'Resolvido' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <option value="Novo">Novo</option>
                        <option value="Em atendimento">Em atendimento</option>
                        <option value="Aguardando cliente">Aguardando cliente</option>
                        <option value="Resolvido">Resolvido</option>
                        <option value="Finalizado">Finalizado</option>
                      </select>}
                    </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-[#667781] truncate">
                      {selectedConversation.isGroup
                        ? `${selectedConversation.participantsCount || 0} participantes`
                        : selectedConversation.phone}
                    </p>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#25d366]"></span>
                    <span className="text-[10px] text-[#667781] font-medium">Online</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!selectedConversation.isGroup && <>
                {!selectedConversation.assignedTo && (
                  <button 
                    onClick={handleAssume}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-primary/20 active:scale-95"
                  >
                    <Headset size={16} />
                    Assumir
                  </button>
                )}
                <div className="h-8 w-[1px] bg-[#d1d7db] mx-2"></div>
                <div className="flex gap-1">
                  <button className="p-2.5 hover:bg-[#d1d7db]/40 rounded-full transition-colors text-[#54656f]" title="Chamada">
                    <Phone size={20} />
                  </button>
                  <button 
                    onClick={() => setShowTransferModal(true)}
                    className="p-2.5 hover:bg-[#d1d7db]/40 rounded-full transition-colors text-[#54656f]"
                    title="Transferir"
                  >
                    <Share2 size={20} />
                  </button>
                  <button 
                    onClick={() => setShowFinalizeModal(true)}
                    className="p-2.5 hover:bg-[#d1d7db]/40 rounded-full transition-colors text-[#54656f]"
                    title="Finalizar"
                  >
                    <CheckCheck size={20} className="text-[#25d366]" />
                  </button>
                  <div className="relative">
                    <button 
                      onClick={() => setShowTopMenu(!showTopMenu)}
                      className={`p-2.5 hover:bg-[#d1d7db]/40 rounded-full transition-colors ${showTopMenu ? 'bg-[#d1d7db]/60 text-primary' : 'text-[#54656f]'}`}
                    >
                      <MoreVertical size={20} />
                    </button>
                    {showTopMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowTopMenu(false)} />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#e9edef] z-20 py-2 overflow-hidden"
                        >
                          <button onClick={() => { setShowTopMenu(false); setShowContactEditModal(true); }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3">
                            <User size={18} className="opacity-70" /> Ver dados do contato
                          </button>
                          <button onClick={() => { 
                            setShowTopMenu(false); 
                            // Open the hidden file input that triggers the avatar update
                            document.getElementById('header-avatar-input')?.click();
                          }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3">
                            <Camera size={18} className="opacity-70" /> Editar foto
                          </button>
                          <button onClick={handleMarkAsUnread} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3">
                            <MessageSquare size={18} className="opacity-70" /> Marcar como não lida
                          </button>
                          <button onClick={() => { setShowTopMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3 opacity-50 cursor-not-allowed">
                            <Plus size={18} className="opacity-70" /> Etiquetar conversa
                          </button>
                          <div className="h-px bg-[#f0f2f5] my-1"></div>
                          <button onClick={() => { setShowTopMenu(false); setShowTransferModal(true); }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3">
                            <Share2 size={18} className="opacity-70" /> Transferir atendimento
                          </button>
                          <button onClick={() => { setShowTopMenu(false); setShowFinalizeModal(true); }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3">
                            <CheckCheck size={18} className="opacity-70 text-[#25d366]" /> Finalizar atendimento
                          </button>
                          <button onClick={handleArchive} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3">
                            <Archive size={18} className="opacity-70" /> Arquivar conversa
                          </button>
                          <button onClick={() => { setShowTopMenu(false); setShowBlockConfirm(true); }} className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error/5 flex items-center gap-3">
                            <UserMinus size={18} className="opacity-70" /> Bloquear contato
                          </button>
                        </motion.div>
                      </>
                    )}
                  </div>
                </div>
                </>}
              </div>
            </div>

            {/* Mensagens */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
                >
                  <div className="bg-error text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between border border-white/20 backdrop-blur-md bg-opacity-90">
                    <div className="flex items-center gap-3">
                      <AlertCircle size={20} />
                      <p className="text-xs font-black uppercase tracking-widest">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-10 py-8 space-y-4 relative custom-scrollbar bg-fixed"
              style={{ 
                backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                backgroundSize: '400px',
                backgroundBlendMode: 'overlay',
                backgroundColor: '#efeae2',
                opacity: 0.95
              }}
            >
              {messages.map((msg, idx) => {
                const isOutbound = 
                  msg.fromMe === true || 
                  msg.tipo === 'sent' || 
                  msg.type === 'sent' || 
                  msg.direction === 'out' || 
                  msg.direction === 'outbound' ||
                  msg.from === 'me';
                
                const content = (
                  msg.texto || 
                  msg.text || 
                  msg.mensagem || 
                  msg.body || 
                  msg.message || 
                  ''
                ).trim();
                const visibleContent = msg.type === 'image'
                  ? (msg.caption || (/^\[Foto recebida\]$/.test(content) ? '' : content.replace(/^\[Foto\]\s*/, '')))
                  : content;

                if (!content && !msg.mediaUrl && !['image', 'video', 'audio', 'document', 'sticker', 'location'].includes(msg.type)) return null;
                
                const msgDateStr = msg.timestamp ? safeFormatTime(msg.timestamp, 'yyyy-MM-dd') : '';
                const prevMsgDateStr = (idx > 0 && messages[idx - 1].timestamp) ? safeFormatTime(messages[idx - 1].timestamp, 'yyyy-MM-dd') : '';
                const showDate = idx === 0 || (msgDateStr !== prevMsgDateStr && msgDateStr !== '-' && msgDateStr !== '');
                
                return (
                  <div key={msg.id || idx}>
                    {showDate && (
                      <div className="flex justify-center my-6">
                        <span className="bg-[#d1d7db]/60 backdrop-blur-sm text-[#54656f] text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                          {dateLabel(msg.timestamp || Date.now())}
                        </span>
                      </div>
                    )}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-4`}
                    >
                      <div className={`max-w-[85%] sm:max-w-[65%] rounded-2xl px-3 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.05)] relative group ${
                        isOutbound 
                          ? 'bg-[#dcf8c6] text-[#303030] rounded-tr-none' 
                          : 'bg-white text-[#303030] rounded-tl-none border border-[#e9edef]'
                      }`}>
                        {/* Triângulo do balão */}
                        <div className={`absolute top-0 w-3 h-4 ${isOutbound ? '-right-2' : '-left-2'}`}>
                          <svg viewBox="0 0 10 15" className={`w-full h-full ${isOutbound ? 'fill-[#dcf8c6]' : 'fill-white'}`}>
                            {isOutbound ? (
                              <path d="M0,0 L10,0 L0,15 Z" />
                            ) : (
                              <path d="M10,0 L0,0 L10,15 Z" />
                            )}
                          </svg>
                        </div>

                        {isOutbound && (
                          <div className="flex items-center gap-1.5 mb-0.5 px-0.5">
                            <span className="text-[11px] font-semibold text-[#075e54] leading-tight">
                              {msg.senderType === 'user'
                                ? (msg.attendantName || msg.atendente || msg.atendenteNome || msg.sender || 'Atendente')
                                : (msg.atendente || msg.atendenteNome || msg.sender || 'Sistema CRM')}
                            </span>
                          </div>
                        )}
                        {!isOutbound && selectedConversation.isGroup && (
                          <div className="flex items-center gap-1.5 mb-0.5 px-0.5">
                            <span className="text-[11px] font-semibold text-[#7c3aed] leading-tight">
                              {msg.participantName || msg.sender || 'Participante'}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex flex-col px-0.5">
                          {msg.type === 'media_pending' ? (
                            <div className="bg-black/5 rounded-xl p-3 border border-black/5 mb-2">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm">
                                  {msg.mediaType?.startsWith('image/') ? <ImageIcon size={20} /> : 
                                   msg.mediaType?.startsWith('video/') ? <FileVideo size={20} /> :
                                   <FileText size={20} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold truncate">{msg.mediaName || msg.fileName}</p>
                                  <p className="text-[10px] opacity-70 uppercase tracking-widest">Enviando... • {((msg.mediaSize || msg.fileSize || 0) / 1024).toFixed(1)} KB</p>
                                </div>
                              </div>
                            </div>
                          ) : msg.mediaUrl ? (
                            <div className="mb-2 rounded-xl overflow-hidden border border-[#e9edef] bg-[#f8f9fa] max-w-[300px]">
                              {msg.type === 'image' ? (
                                <IncomingImage message={msg} />
                              ) : msg.type === 'video' ? (
                                <video src={msg.mediaUrl} controls className="w-full h-auto max-h-60" />
                              ) : msg.type === 'audio' ? (
                                <audio src={msg.mediaUrl} controls className="w-full" />
                              ) : (
                                <div className="p-3 flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm">
                                    <FileText size={20} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold truncate">{msg.mediaName || msg.fileName || 'Documento'}</p>
                                    <p className="text-[9px] text-[#667781]">{msg.mimetype || msg.mediaType || ''}{(msg.fileSize || msg.mediaSize) ? ` • ${((msg.fileSize || msg.mediaSize || 0) / 1024).toFixed(1)} KB` : ''}</p>
                                    <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary font-bold uppercase hover:underline">Abrir / baixar</a>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : msg.type === 'image' ? (
                            <IncomingImage message={msg} />
                          ) : ['video', 'audio', 'document', 'sticker'].includes(msg.type) ? (
                            <div className="mb-2 rounded-xl bg-black/5 p-3 text-xs text-[#667781] flex items-center gap-2">
                              {msg.type === 'image' ? <ImageIcon size={18} /> : msg.type === 'video' ? <FileVideo size={18} /> : <FileText size={18} />}
                              Mídia indisponível para visualização
                            </div>
                          ) : null}
                          
                          {visibleContent && <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap text-[#111b21] break-words">{renderLinkedText(visibleContent)}</p>}
                          <div className="flex items-center justify-end gap-1 mt-1 ml-10 self-end">
                            <span className="text-[10px] text-[#00000073] font-medium">
                              {msg.timestamp ? safeFormatTime(msg.timestamp, 'HH:mm') : ''}
                            </span>
                            {isOutbound && (
                              <div className="flex">
                                {msg.status === 'read' ? (
                                  <CheckCheck size={15} className="text-[#53bdeb]" />
                                ) : msg.status === 'delivered' ? (
                                  <CheckCheck size={15} className="text-[#667781]" />
                                ) : msg.status === 'failed' ? (
                                  <AlertCircle size={15} className="text-error" />
                                ) : (
                                  <Check size={15} className="text-[#667781]" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>

            {/* Input WhatsApp Style */}
            <div className="bg-[#f0f2f5] px-6 py-4 border-t border-[#d1d7db] z-10 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
              {!selectedConversation.isGroup && !isWithin24h(selectedConversation.lastMessageAt) && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-center justify-between gap-4 text-yellow-800 shadow-sm">
                  <div className="flex items-center gap-3">
                    <AlertCircle size={20} className="text-yellow-600 shrink-0" />
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest leading-none">Sessão Expirada</p>
                      <p className="text-[10px] mt-1 opacity-80">O cliente não responde há mais de 24h. Use um template para reativar.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowTemplateModal(true)}
                    className="px-4 py-2 bg-yellow-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-yellow-700 transition-all active:scale-95 shadow-md shadow-yellow-600/20 whitespace-nowrap"
                  >
                    ATIVAR AGORA
                  </button>
                </div>
              )}
              
              <form 
                onSubmit={handleSendMessage}
                className="flex items-center gap-4"
              >
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <button 
                      type="button" 
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      className={`p-2.5 hover:bg-[#d1d7db]/50 rounded-full transition-all active:scale-90 ${showShareMenu ? 'text-primary bg-[#d1d7db]/60' : 'text-[#54656f]'}`} 
                      title="Compartilhar"
                    >
                      <Share2 size={24} />
                    </button>
                    {showShareMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowShareMenu(false)} />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-2xl shadow-[0_-8px_30px_rgb(0,0,0,0.12)] border border-[#e9edef] z-20 py-2 overflow-hidden"
                        >
                          <button onClick={() => { setShowShareMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3 opacity-50 cursor-not-allowed">
                            <User size={18} className="opacity-70" /> Enviar contato
                          </button>
                          <button onClick={() => { setShowShareMenu(false); copyLeadLink(); }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3">
                            <MessageSquare size={18} className="opacity-70" /> Compartilhar conversa
                          </button>
                          <button onClick={copyLeadLink} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3">
                            <Copy size={18} className="opacity-70" /> Copiar link do lead
                          </button>
                          <button onClick={() => { setShowShareMenu(false); setShowTransferModal(true); }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3">
                            <Share2 size={18} className="opacity-70" /> Encaminhar conversa
                          </button>
                        </motion.div>
                      </>
                    )}
                  </div>

                  <div className="relative">
                    <button 
                      type="button" 
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className={`p-2.5 hover:bg-[#d1d7db]/50 rounded-full transition-all active:scale-90 ${showAttachMenu ? 'text-primary bg-[#d1d7db]/60' : 'text-[#54656f]'}`} 
                      title="Anexo"
                    >
                      <PaperclipIcon size={24} />
                    </button>
                    {showAttachMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowAttachMenu(false)} />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-2xl shadow-[0_-8px_30px_rgb(0,0,0,0.12)] border border-[#e9edef] z-20 py-2 overflow-hidden"
                        >
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileSelect}
                          />
                          <button onClick={() => { fileInputRef.current?.click(); }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3">
                            <FileImage size={18} className="opacity-70 text-blue-500" /> Enviar imagem
                          </button>
                          <button onClick={() => { fileInputRef.current?.click(); }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3">
                            <FileVideo size={18} className="opacity-70 text-purple-500" /> Enviar vídeo
                          </button>
                          <button onClick={() => { fileInputRef.current?.click(); }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3">
                            <FileText size={18} className="opacity-70 text-orange-500" /> Enviar documento PDF
                          </button>
                          <button onClick={() => { setShowAttachMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3 opacity-50 cursor-not-allowed">
                            <Music size={18} className="opacity-70 text-red-500" /> Enviar áudio
                          </button>
                          <button onClick={() => { setShowAttachMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-[#54656f] hover:bg-[#f5f6f6] flex items-center gap-3 opacity-50 cursor-not-allowed">
                            <Camera size={18} className="opacity-70 text-teal-500" /> Tirar foto
                          </button>
                        </motion.div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 relative flex items-center gap-2">
                  {selectedFile && (
                    <div className="absolute bottom-full left-0 mb-4 p-3 bg-white rounded-2xl shadow-xl border border-[#e9edef] flex items-center gap-3 min-w-[200px] z-20 animate-in slide-in-from-bottom-2">
                      {filePreview ? (
                        <img src={filePreview} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[#f0f2f5] flex items-center justify-center text-[#667781]">
                          <FileText size={24} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[#111b21] truncate">{selectedFile.name}</p>
                        <p className="text-[10px] text-[#667781]">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button onClick={() => { setSelectedFile(null); setFilePreview(null); }} className="p-1 hover:bg-[#f0f2f5] rounded-full text-[#667781]">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  
                  <textarea 
                    rows={1}
                    disabled={!selectedConversation.isGroup && !isWithin24h(selectedConversation.lastMessageAt)}
                    placeholder={selectedConversation.isGroup || isWithin24h(selectedConversation.lastMessageAt) ? "Digite sua mensagem..." : "Aguardando interação..."}
                    className="w-full bg-white border-none rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 shadow-sm disabled:cursor-not-allowed resize-none custom-scrollbar max-h-32 transition-all"
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (selectedFile && !isSendingMedia) handleSendMedia();
                        else if (messageText.trim()) handleSendMessage();
                      }
                    }}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSendingMedia || (!messageText.trim() && !selectedFile) || (!selectedConversation.isGroup && !isWithin24h(selectedConversation.lastMessageAt))}
                  onClick={(e) => {
                    e.preventDefault();
                    if (selectedFile && !isSendingMedia) {
                      handleSendMedia();
                    } else if (messageText.trim()) {
                      handleSendMessage();
                    }
                  }}
                  className="p-3.5 bg-primary text-white rounded-full hover:brightness-110 active:scale-90 transition-all disabled:opacity-50 disabled:scale-100 shadow-[0_10px_20px_rgba(var(--primary-rgb),0.3)] group"
                >
                  {isSendingMedia ? <span className="text-[10px] font-black px-1">Enviando...</span> : <Send size={24} fill="white" className="group-hover:rotate-12 transition-transform" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] text-[#667781] p-12 text-center border-b-[6px] border-[#25d366]">
            <div className="w-64 h-64 relative mb-10">
              <div className="absolute inset-0 bg-[#e1e9eb] rounded-full scale-110"></div>
              <img 
                src="https://a.slack-edge.com/80588/img/services/whatsapp_512.png" 
                alt="WhatsApp" 
                className="w-full h-full object-contain relative z-10 opacity-30 grayscale"
              />
            </div>
            <h3 className="text-[32px] font-extralight text-[#41525d] mb-4">WhatsApp Web Para Negócios</h3>
            <p className="text-sm max-w-md leading-relaxed">
              Responda seus clientes em tempo real, gerencie leads e converta atendimentos em chamados técnicos diretamente do seu painel CRM.
            </p>
            <div className="mt-12 flex items-center gap-2 text-xs opacity-50 uppercase tracking-[2px]">
              <CheckCheck size={16} /> 
              Criptografado de ponta a ponta
            </div>
          </div>
        )}
      </div>

      {/* Coluna 3: Painel CRM Lateral (Estilo Kommo) */}
      <AnimatePresence>
        {selectedConversation && !selectedConversation.isGroup && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-white border-l border-[#d1d7db] flex flex-col overflow-hidden shrink-0 shadow-[-4px_0_10px_rgba(0,0,0,0.02)] z-30"
          >
            {/* Header Perfil CRM */}
            <div className="p-6 border-b border-[#f0f2f5] bg-white">
              <div className="flex flex-col items-center text-center">
                <div className="relative group/avatar-sidebar">
                  <ContactAvatarUploader 
                    leadId={selectedConversation.leadId || ''} 
                    photoURL={getAvatarUrl(selectedConversation.lead)} 
                    name={selectedConversation.contactName} 
                    size="xl" 
                    className="mb-4"
                  />
                </div>
                <h3 className="text-lg font-bold text-[#111b21] truncate w-full leading-tight">{selectedConversation.contactName}</h3>
                <button 
                  onClick={() => setShowContactEditModal(true)}
                  className="mt-1 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  Editar contato
                </button>
                <p className="text-xs text-[#667781] font-medium mt-2 mb-4">{selectedConversation.phone}</p>
                
                <div className="flex flex-wrap justify-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider border border-primary/5">WhatsApp</span>
                  <span className="px-3 py-1 rounded-full bg-[#25d366]/10 text-[#075e54] text-[10px] font-bold uppercase tracking-wider border border-[#25d366]/5">Online</span>
                </div>
              </div>
            </div>

            {/* Seções de Dados */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
              {/* Card Cliente */}
              <section>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#667781] flex items-center gap-2">
                    <Building2 size={14} className="opacity-70" />
                    Entidade / Cliente
                  </h4>
                  <button className="text-primary hover:bg-primary/5 p-1 rounded-full transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
                
                {selectedClient ? (
                  <div className="p-4 bg-[#f8f9fa] rounded-2xl border border-[#e9edef] group hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
                    <p className="text-sm font-bold text-[#111b21] mb-1 leading-tight">{selectedClient.nomeFantasia}</p>
                    <p className="text-[11px] text-[#667781] font-medium">CNPJ: {selectedClient.cnpj}</p>
                    <div className="mt-3 pt-3 border-t border-[#e9edef] flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-wider">
                      Visualizar Empresa <ChevronRight size={14} />
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowLinkClientModal(true)}
                    className="w-full py-8 border-2 border-dashed border-[#e9edef] rounded-2xl text-[#667781] hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center gap-2 group"
                  >
                    <Building2 size={24} className="opacity-20 group-hover:opacity-40 transition-opacity" />
                    <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Vincular Cliente</span>
                  </button>
                )}
              </section>

              {/* Card Lead */}
              <section>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#667781] flex items-center gap-2">
                    <Target size={14} className="opacity-70" />
                    Pipeline / Lead
                  </h4>
                  <button 
                    onClick={() => setShowConvertLeadModal(true)}
                    className="text-secondary hover:bg-secondary/5 p-1 rounded-full transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {selectedConversation.lead ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2 py-1 rounded bg-secondary text-white text-[9px] font-bold uppercase tracking-wider">
                          {selectedConversation.lead.status}
                        </span>
                        <span className="text-[11px] font-bold text-[#111b21]">
                          {selectedConversation.lead.valorEstimado ? `R$ ${selectedConversation.lead.valorEstimado.toLocaleString()}` : '--'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#111b21] mb-1 leading-tight">{selectedConversation.lead.nome}</p>
                      <p className="text-[11px] text-[#667781]">Oportunidade ativa</p>
                    </div>
                    
                    <button 
                      onClick={() => proposals.length > 0 ? openLinkedBudget(proposals[0].id) : setShowCommercialDocumentMenu(true)}
                      className="w-full py-3 bg-white border border-secondary/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-secondary hover:bg-secondary/5 transition-all flex items-center justify-center gap-2"
                    >
                      <FileText size={14} />
                      {proposals.length > 0 ? 'Ver Orçamento' : 'Criar Orçamento'}
                    </button>
                    {proposals.length > 0 && <button onClick={() => setShowCommercialDocumentMenu(true)} className="w-full py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Novo orçamento</button>}
                    
                    {/* List existing proposals */}
                    {proposals.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[#667781] ml-1">Propostas ({proposals.length})</p>
                        {proposals.map(p => (
                          <div key={p.id} className="w-full p-3 bg-white border border-[#e9edef] rounded-xl hover:border-primary/30 transition-all">
                            <div className="flex items-start justify-between gap-2">
                              <button type="button" onClick={() => openLinkedBudget(p.id)} className="min-w-0 text-left flex-1">
                                <p className="text-[10px] font-bold truncate">#{p.id.slice(-6).toUpperCase()} · {p.titulo}</p>
                                <p className="text-[9px] text-[#667781]">R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · {p.validadeProposta || 'sem validade'}</p>
                              </button>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${p.status === 'Aprovado' ? 'bg-success/10 text-success' : p.status === 'Enviado' ? 'bg-info/10 text-info' : 'bg-gray-100 text-gray-500'}`}>{p.status}</span>
                            </div>
                            <div className="flex gap-3 mt-2 text-[8px] font-black uppercase tracking-wider">
                              <button onClick={() => openLinkedBudget(p.id)} className="text-primary">Visualizar / PDF</button>
                              <button onClick={() => { setEditingBudget(p); setBudgetWizardContext({ origin: 'whatsapp_atendimento', conversationId: selectedConversation.id, atendimentoId: selectedConversation.id, leadId: selectedConversation.leadId, clienteId: selectedConversation.clientId, contactPhone: selectedConversation.phone, vendedorId: p.vendedorId || user.id }); }} className="text-secondary">Editar</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowConvertLeadModal(true)}
                    className="w-full py-8 border-2 border-dashed border-[#e9edef] rounded-2xl text-[#667781] hover:border-secondary/40 hover:bg-secondary/5 transition-all flex flex-col items-center gap-2 group"
                  >
                    <Target size={24} className="opacity-20 group-hover:opacity-40 transition-opacity" />
                    <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Criar Oportunidade</span>
                  </button>
                )}
              </section>

              {/* Chamados Técnicos */}
              <section>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#667781] flex items-center gap-2">
                    <Headset size={14} className="opacity-70" />
                    Suporte Técnico
                  </h4>
                  <button 
                    onClick={() => setShowCreateTicketModal(true)}
                    className="text-error hover:bg-error/5 p-1 rounded-full transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {selectedConversation.ticket ? (
                  <div className="p-4 bg-error/5 rounded-2xl border border-error/10 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-error animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.4)]"></div>
                    </div>
                    <p className="text-[10px] font-black text-error mb-1 tracking-widest">#{selectedConversation.ticket.id.slice(-6).toUpperCase()}</p>
                    <p className="text-sm font-bold text-[#111b21] mb-3 leading-tight">{selectedConversation.ticket.titulo}</p>
                    <button className="w-full py-2 bg-error text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-md hover:bg-error/90 active:scale-95 transition-all">
                      Abrir Chamado
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowCreateTicketModal(true)}
                    className="w-full py-8 border-2 border-dashed border-[#e9edef] rounded-2xl text-[#667781] hover:border-error/40 hover:bg-error/5 transition-all flex flex-col items-center gap-2 group"
                  >
                    <Wrench size={24} className="opacity-20 group-hover:opacity-40 transition-opacity" />
                    <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Abrir Chamado</span>
                  </button>
                )}
              </section>

              {/* Notas Internas */}
              <section>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#667781] mb-3 px-1">Notas Internas</h4>
                <div className="space-y-3">
                  <div className="bg-[#fff9c4]/40 p-3 rounded-2xl border border-[#fbc02d]/20 text-[11px] text-[#424242] leading-relaxed shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#fbc02d]"></div>
                    <strong className="text-[#f57f17]">@sistema:</strong> Cliente solicitou orçamento para manutenção preventiva em 3 compressores.
                  </div>
                  <div className="relative">
                    <textarea 
                      className="w-full bg-[#f8f9fa] border border-[#e9edef] rounded-2xl p-4 text-xs focus:ring-2 focus:ring-primary/10 focus:border-primary/20 focus:outline-none resize-none transition-all"
                      placeholder="Adicionar nota para equipe..."
                      rows={3}
                    />
                    <button className="absolute bottom-3 right-3 text-primary hover:scale-110 active:scale-90 transition-all">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* Ações de Conversão */}
            <div className="p-5 bg-white border-t border-[#f0f2f5] flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowFinalizeModal(true)}
                  className="py-3 bg-[#f8f9fa] border border-[#e9edef] rounded-xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-[#e9edef] transition-all shadow-sm text-[#111b21]"
                >
                  Finalizar
                </button>
                <button 
                  onClick={() => setShowConvertLeadModal(true)}
                  className="py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-[0_8px_20px_rgba(var(--primary-rgb),0.2)] hover:brightness-110 active:scale-95 transition-all"
                >
                  Converter
                </button>
              </div>
              <button 
                onClick={() => setShowTransferModal(true)}
                className="w-full py-3 bg-white border border-[#e9edef] rounded-xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-[#f8f9fa] transition-all text-[#667781] flex items-center justify-center gap-2 group"
              >
                <Share2 size={14} className="group-hover:rotate-12 transition-transform" />
                Transferir Atendimento
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modais Customizados */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.2);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />
      <AnimatePresence>
        {showLinkClientModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface rounded-3xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-surface-container-high"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                  <Building2 className="text-primary" size={20} />
                  {isCreatingClient ? 'Novo Cliente' : 'Vincular Cliente'}
                </h3>
                <button 
                  onClick={() => {
                    setShowLinkClientModal(false);
                    setIsCreatingClient(false);
                  }} 
                  className="p-2 hover:bg-surface-container-high rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
              
              {!isCreatingClient ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                    <input 
                      type="text" 
                      placeholder="Pesquisar por nome ou CNPJ..." 
                      className="w-full bg-surface-container-low border border-surface-container-high rounded-xl pl-10 pr-4 py-3 text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      onChange={(e) => {
                        const term = e.target.value.toLowerCase();
                        databaseService.getClientes().then(all => {
                          const filtered = (all || []).filter(c => 
                            c.nomeFantasia.toLowerCase().includes(term) || 
                            c.cnpj.includes(term)
                          );
                          setClients(filtered);
                        });
                      }}
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {(clients || []).map(client => (
                      <button 
                        key={client.id}
                        onClick={() => handleLinkClient(client.id)}
                        className="w-full p-4 rounded-2xl border border-surface-container-high bg-surface hover:border-primary hover:bg-primary/5 text-left transition-all flex items-center justify-between group"
                      >
                        <div>
                          <p className="text-xs font-bold text-on-surface uppercase tracking-tight">{client.nomeFantasia}</p>
                          <p className="text-[10px] text-on-surface-variant">CNPJ: {client.cnpj}</p>
                        </div>
                        <ChevronRight size={16} className="text-on-surface-variant group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                    {(!clients || clients.length === 0) && (
                      <div className="text-center py-10 opacity-50">
                        <p className="text-xs font-bold uppercase tracking-widest">Nenhum cliente encontrado</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 text-center">
                    <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest mb-3">Não encontrou o cliente?</p>
                    <button 
                      onClick={() => setIsCreatingClient(true)}
                      className="w-full py-4 border-2 border-dashed border-primary/20 rounded-2xl text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 transition-all text-center"
                    >
                      Cadastrar Novo Cliente
                    </button>
                    <button
                      onClick={() => { setContinueToBudgetAfterClient(true); setIsCreatingClient(true); }}
                      className="w-full mt-2 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                    >
                      Cadastrar e continuar para orçamento
                    </button>
                  </div>
                </div>
              ) : (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const clientData = {
                      nomeFantasia: formData.get('nomeFantasia') as string,
                      razaoSocial: (formData.get('empresa') || formData.get('nomeFantasia')) as string,
                      cnpj: formData.get('cnpj') as string,
                      celularWhatsapp: (formData.get('telefone') || selectedConversation?.phone || '') as string,
                      emailPrincipal: formData.get('email') as string,
                      responsavelNome: formData.get('responsavel') as string,
                      rua: formData.get('endereco') as string,
                      observacoesComerciais: formData.get('observacoes') as string,
                      origemLead: 'Atendimento WhatsApp',
                      vendedorResponsavel: user.id,
                      status: 'Ativo' as const
                    };

                    try {
                      const newClient = await databaseService.createCliente(clientData as any);
                      if (newClient && newClient.id) {
                        await handleLinkClient(newClient.id);
                        setIsCreatingClient(false);
                      }
                    } catch (error) {
                      console.error('Error creating client:', error);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Nome Fantasia</label>
                    <input 
                      name="nomeFantasia"
                      defaultValue={selectedConversation?.contactName}
                      required
                      className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Empresa</label>
                      <input name="empresa" className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Telefone</label>
                      <input name="telefone" defaultValue={selectedConversation?.phone} className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">E-mail</label>
                      <input name="email" type="email" defaultValue={(selectedConversation?.lead as any)?.email || ''} className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                    </div>
                    <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">CNPJ (Opcional)</label>
                    <input 
                      name="cnpj"
                      className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Responsável</label>
                      <input name="responsavel" defaultValue={selectedConversation?.contactName} className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Endereço</label>
                      <input name="endereco" className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Observações</label>
                    <textarea name="observacoes" rows={3} className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none" />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsCreatingClient(false)}
                      className="flex-1 py-4 border border-surface-container-high rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-surface-container-low transition-all"
                    >
                      Voltar
                    </button>
                    <button 
                      type="submit"
                      className="flex-2 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
                    >
                      Criar e Vincular
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}

        {showConvertLeadModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-surface-container-high"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                  <Target className="text-secondary" size={20} />
                  Oportunidade
                </h3>
                <button onClick={() => setShowConvertLeadModal(false)} className="p-2 hover:bg-surface-container-high rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  nome: formData.get('nome') as string,
                  valorEstimado: Number(formData.get('valorEstimado')),
                  status: 'Qualificado' as const
                };
                
                try {
                  if (selectedConversation?.leadId) {
                    await databaseService.updateLead(selectedConversation.leadId, data);
                  } else {
                    await databaseService.createLead({
                      ...data,
                      telefone: selectedConversation?.phone || '',
                      whatsapp: selectedId || '',
                      origem: 'WhatsApp',
                      dataInteracao: new Date().toISOString(),
                    });
                  }
                  setShowConvertLeadModal(false);
                } catch (error) {
                  console.error(error);
                }
              }} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Título</label>
                  <input 
                    name="nome"
                    required
                    defaultValue={selectedConversation?.lead?.nome || selectedConversation?.contactName}
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-secondary/20 focus:outline-none"
                    placeholder="Ex: Novo Projeto de CFTV"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Valor Estimado (R$)</label>
                  <input 
                    name="valorEstimado"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={selectedConversation?.lead?.valorEstimado}
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-secondary/20 focus:outline-none"
                    placeholder="0,00"
                  />
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-secondary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all">
                    Confirmar Conversão
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showCommercialDocumentMenu && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-5">
                <div><h3 className="text-lg font-black uppercase">Gerar documento comercial</h3><p className="text-xs text-slate-500">Escolha o tipo de documento.</p></div>
                <button onClick={() => setShowCommercialDocumentMenu(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
              </div>
              <div className="space-y-3">
                <button onClick={() => openOfficialBudget()} className="w-full text-left p-5 rounded-2xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors">
                  <div className="flex items-center justify-between"><span className="font-black uppercase text-sm text-primary">Orçamento completo</span><span className="text-[9px] font-black uppercase bg-primary text-white px-2 py-1 rounded-full">Recomendado</span></div>
                  <p className="text-xs text-slate-600 mt-2">Produtos, serviços, valores, condições e PDF oficial.</p>
                </button>
                <button onClick={() => { setShowCommercialDocumentMenu(false); setShowCreateProposalModal(true); }} className="w-full text-left p-5 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors">
                  <span className="font-black uppercase text-sm text-slate-700">Proposta rápida</span>
                  <p className="text-xs text-slate-500 mt-2">Registro preliminar com valor estimado e envio imediato.</p>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showCreateProposalModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-surface-container-high"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                  <FileText className="text-secondary" size={20} />
                  Proposta Rápida
                </h3>
                <button onClick={() => setShowCreateProposalModal(false)} className="p-2 hover:bg-surface-container-high rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleCreateProposal({
                  titulo: formData.get('titulo') as string,
                  valor: Number(formData.get('valor')),
                  descricao: formData.get('descricao') as string,
                  observacoes: formData.get('observacoes') as string,
                  validade: Number(formData.get('validade')) || 15,
                });
              }} className="space-y-4">
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                  Esta é uma proposta rápida e não substitui o orçamento comercial completo.
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Título da Proposta</label>
                  <input 
                    name="titulo"
                    required
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-secondary/20 focus:outline-none"
                    placeholder="Ex: Proposta de Infraestrutura"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Valor (R$)</label>
                    <input 
                      name="valor"
                      type="number"
                      step="0.01"
                      required
                      className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-secondary/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Validade (dias)</label>
                    <input 
                      name="validade"
                      type="number"
                      defaultValue={15}
                      className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-secondary/20 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Solução / Solution</label>
                  <textarea 
                    name="descricao"
                    rows={4}
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-secondary/20 focus:outline-none resize-none"
                    placeholder="Detalhamento da solução..."
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Observações (Internas)</label>
                  <textarea 
                    name="observacoes"
                    rows={2}
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-secondary/20 focus:outline-none resize-none"
                    placeholder="Notas extras..."
                  />
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-4 bg-secondary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-secondary/20 hover:brightness-110 active:scale-95 transition-all">
                    Salvar como proposta rápida
                  </button>
                  <button type="button" onClick={(event) => {
                    const form = event.currentTarget.closest('form');
                    const values = form ? new FormData(form) : null;
                    openOfficialBudget(values ? {
                      titulo: String(values.get('titulo') || ''), valor: Number(values.get('valor') || 0),
                      validade: Number(values.get('validade') || 15), descricao: String(values.get('descricao') || ''),
                      observacoes: String(values.get('observacoes') || '')
                    } : undefined);
                  }} className="w-full mt-2 py-3 bg-white border border-primary text-primary rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-primary/5">
                    Converter em orçamento completo
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showFinalizeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-surface-container-high"
            >
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center text-success mb-6 mx-auto">
                <Check size={32} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tighter text-center mb-2 text-on-surface">Finalizar Atendimento?</h3>
              <p className="text-xs text-on-surface-variant text-center mb-8">O histórico será arquivado e o cliente receberá uma notificação de encerramento se configurado.</p>
              
              <div className="flex gap-3">
                <button 
                  type="button"
                  disabled={isFinalizing}
                  onClick={() => { setShowFinalizeModal(false); setFinalizeError(null); }}
                  className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-surface-container-high hover:bg-surface-container-low transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleFinalize}
                  disabled={isFinalizing}
                  className="flex-1 py-4 bg-success text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-success/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                >
                  {isFinalizing && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                  {isFinalizing ? 'Finalizando...' : 'Finalizar'}
                </button>
              </div>
              {finalizeError && (
                <div role="alert" className="mt-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-xs font-semibold text-error text-center">
                  {finalizeError}
                </div>
              )}
            </motion.div>
          </div>
        )}

        {showTransferModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-surface rounded-3xl p-6 max-w-md w-full shadow-2xl border border-surface-container-high"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                  <Share2 className="text-primary" size={20} />
                  Transferir Atendimento
                </h3>
                <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-surface-container-high rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {users.filter(u => u.id !== user.id).map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleTransfer(u.id)}
                    className="w-full p-4 flex items-center gap-3 bg-surface-container-low hover:bg-primary/5 rounded-2xl border border-transparent hover:border-primary/20 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {u.nome?.[0] || u.email[0]}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-tight">{u.nome || u.email}</p>
                      <p className="text-[10px] text-on-surface-variant">{u.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {showCreateTicketModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-surface rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-surface-container-high"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                  <Headset className="text-error" size={20} />
                  Abrir Novo Chamado
                </h3>
                <button onClick={() => setShowCreateTicketModal(false)} className="p-2 hover:bg-surface-container-high rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleCreateTicket({
                  titulo: formData.get('titulo') as string,
                  descricao: formData.get('descricao') as string,
                  prioridade: formData.get('prioridade') as any,
                });
              }} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Título do Problema</label>
                  <input 
                    name="titulo"
                    required
                    defaultValue={`WhatsApp: ${selectedConversation?.contactName}`}
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-error/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Descrição Adicional</label>
                  <textarea 
                    name="descricao"
                    rows={4}
                    className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-error/20 focus:outline-none resize-none"
                    placeholder="Detalhes técnicos ou observações do atendente..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-2 mb-1 block">Prioridade</label>
                  <select name="prioridade" className="w-full bg-surface-container-low border border-surface-container-high rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-error/20 focus:outline-none appearance-none">
                    <option value="baixa">Baixa</option>
                    <option value="media" selected>Média</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowCreateTicketModal(false)} 
                    className="flex-1 py-4 border border-surface-container-high rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-surface-container-low transition-all"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="flex-2 py-4 bg-error text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-error/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Gerar Chamado
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showContactEditModal && selectedConversation.lead && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-[#e9edef] max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                  <User size={24} className="text-primary" />
                  Editar Contato
                </h3>
                <button onClick={() => setShowContactEditModal(false)} className="p-2 hover:bg-[#f0f2f5] rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                try {
                  await databaseService.updateLead(selectedConversation.leadId, {
                    nome: formData.get('nome') as string,
                    email: formData.get('email') as string,
                    telefone: formData.get('telefone') as string,
                    empresa: formData.get('empresa') as string,
                    cpfCnpj: formData.get('cpfCnpj') as string,
                    observacoes: formData.get('observacoes') as string,
                    status: formData.get('status') as any
                  });
                  setShowContactEditModal(false);
                } catch (error) {
                  console.error('Erro ao salvar contato:', error);
                }
              }} className="space-y-6">
                
                <div className="flex flex-col items-center pb-6 border-b border-[#f0f2f5]">
                  <ContactAvatarUploader 
                    leadId={selectedConversation.leadId || ''} 
                    photoURL={getAvatarUrl(selectedConversation.lead)} 
                    name={selectedConversation.lead.nome} 
                    size="xl" 
                  />
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[#667781]">Foto do Contato</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#667781] ml-2 mb-1 block">Nome Completo</label>
                    <input name="nome" defaultValue={selectedConversation.lead.nome} required className="w-full bg-[#f8f9fa] border border-[#e9edef] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/10 transition-all outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#667781] ml-2 mb-1 block">Telefone</label>
                    <input name="telefone" defaultValue={selectedConversation.lead.telefone} className="w-full bg-[#f8f9fa] border border-[#e9edef] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/10 transition-all outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#667781] ml-2 mb-1 block">E-mail</label>
                    <input name="email" type="email" defaultValue={selectedConversation.lead.email} className="w-full bg-[#f8f9fa] border border-[#e9edef] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/10 transition-all outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#667781] ml-2 mb-1 block">Empresa</label>
                    <input name="empresa" defaultValue={selectedConversation.lead.empresa} className="w-full bg-[#f8f9fa] border border-[#e9edef] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/10 transition-all outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#667781] ml-2 mb-1 block">CPF/CNPJ</label>
                    <input name="cpfCnpj" defaultValue={selectedConversation.lead.cpfCnpj} className="w-full bg-[#f8f9fa] border border-[#e9edef] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/10 transition-all outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#667781] ml-2 mb-1 block">Status do Lead</label>
                    <select name="status" defaultValue={selectedConversation.lead.status} className="w-full bg-[#f8f9fa] border border-[#e9edef] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/10 outline-none appearance-none">
                      <option value="Novo">Novo</option>
                      <option value="Em atendimento">Em atendimento</option>
                      <option value="Aguardando cliente">Aguardando cliente</option>
                      <option value="Resolvido">Resolvido</option>
                      <option value="Finalizado">Finalizado</option>
                      <option value="Arquivado">Arquivado</option>
                      <option value="Bloqueado">Bloqueado</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#667781] ml-2 mb-1 block">Observações</label>
                    <textarea name="observacoes" defaultValue={selectedConversation.lead.observacoes} rows={3} className="w-full bg-[#f8f9fa] border border-[#e9edef] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/10 transition-all outline-none resize-none" />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowContactEditModal(false)} className="flex-1 py-4 border border-[#e9edef] rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-[#f8f9fa] transition-all">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-2 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all">
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showTemplateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-[#e9edef]"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                  <MessageCircle size={24} className="text-primary" />
                  Reativar Conversa
                </h3>
                <button onClick={() => setShowTemplateModal(false)} className="p-2 hover:bg-[#f0f2f5] rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <p className="text-sm text-[#667781] mb-8 leading-relaxed">
                A janela de 24h expirou. Selecione um template oficial da Meta aprovado para reativar o contato com o cliente.
              </p>
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {availableTemplates.length > 0 ? (
                  availableTemplates.map((template) => (
                    <button 
                      key={template.id}
                      onClick={() => handleSendTemplate(template.alias || template.name, [selectedConversation.contactName])}
                      className="w-full p-5 rounded-2xl border border-[#e9edef] bg-white hover:border-primary hover:bg-primary/5 text-left transition-all flex items-center justify-between group active:scale-[0.98]"
                    >
                      <div className="flex-1">
                        <p className="text-xs font-black text-[#111b21] uppercase tracking-tight mb-1 group-hover:text-primary transition-colors">{template.name}</p>
                        <p className="text-[10px] text-[#667781] font-medium leading-relaxed opacity-70">Alias: {template.alias || '--'}</p>
                      </div>
                      <Send size={16} className="text-[#d1d7db] group-hover:text-primary transition-colors group-hover:translate-x-1" />
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12 px-6 border-2 border-dashed border-[#e9edef] rounded-3xl">
                    <AlertCircle size={40} className="mx-auto text-[#667781] mb-6 opacity-20" />
                    <p className="text-sm font-black text-[#111b21] uppercase tracking-widest mb-2">Sem templates configurados</p>
                    <p className="text-xs text-[#667781] leading-relaxed">
                      Configure um template aprovado da Meta para reativar a conversa.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-8">
                <button 
                  onClick={() => setShowTemplateModal(false)}
                  className="w-full py-4 bg-[#f8f9fa] border border-[#e9edef] rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-[#54656f] hover:bg-[#e9edef] transition-all active:scale-95 shadow-sm"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showBlockConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-surface-container-high"
            >
              <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-error mb-6 mx-auto">
                <UserMinus size={32} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tighter text-center mb-2 text-on-surface">Bloquear Contato?</h3>
              <p className="text-xs text-on-surface-variant text-center mb-8">O contato será marcado como bloqueado e o atendimento será encerrado. Você não receberá novas mensagens deste contato.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowBlockConfirm(false)}
                  className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-surface-container-high hover:bg-surface-container-low transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleBlock}
                  className="flex-1 py-4 bg-error text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-error/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Bloquear
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {budgetWizardContext && (
          <QuoteWizard
            user={user}
            initialData={editingBudget}
            atendimentoContext={budgetWizardContext}
            onClose={() => { setBudgetWizardContext(null); setEditingBudget(undefined); }}
            onSave={() => {
              void refreshConversationProposals();
              toast.success(editingBudget ? 'Orçamento atualizado.' : 'Orçamento criado no módulo Comercial.');
            }}
          />
        )}

        {viewingBudget && (
          <ProposalViewer quote={viewingBudget} onClose={() => setViewingBudget(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
