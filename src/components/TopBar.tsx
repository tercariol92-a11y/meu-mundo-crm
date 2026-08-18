import { Bell, MessageCircle, Search } from 'lucide-react';
import { Conversation, User, ViewType } from '../types';
import { useEffect, useRef, useState } from 'react';
import { databaseService } from '../services/databaseService';
import { whatsappApi } from '../services/whatsappApi';
import toast from 'react-hot-toast';

interface TopBarProps {
  user: User;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const messagePreview = (conversation: Conversation) => {
  const raw = String(conversation.lastMessageBody || '').trim();
  if (!raw) return 'Nova mensagem recebida';
  if (/^\[(foto|imagem|image)/i.test(raw)) return '📷 Enviou uma imagem';
  if (/^\[(áudio|audio)/i.test(raw)) return '🎤 Enviou um áudio';
  if (/^\[(documento|arquivo)/i.test(raw)) return '📎 Enviou um documento';
  return raw.length > 90 ? `${raw.slice(0, 90)}…` : raw;
};

export default function TopBar({ user, currentView, onViewChange }: TopBarProps) {
  const [whatsappUnread, setWhatsappUnread] = useState(0);
  const [unreadConversations, setUnreadConversations] = useState<Conversation[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const previousUnread = useRef(new Map<string, number>());
  const snapshotReady = useRef(false);
  const currentViewRef = useRef(currentView);

  useEffect(() => { currentViewRef.current = currentView; }, [currentView]);

  useEffect(() => {
    let unsubscribe=()=>{};let cancelled=false;
    void whatsappApi.getStatus().then(result=>{
      if(cancelled)return;
      const sessionId=result?.status?.status==='connected'?String(result.status.sessionId||''):'';
      if(!sessionId){setWhatsappUnread(0);return}
      unsubscribe=databaseService.onConversationsChange(sessionId,(conversations)=>{
        const unread = conversations
          .filter(conversation => (conversation.unreadCount || 0) > 0)
          .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        setUnreadConversations(unread);
        setWhatsappUnread(unread.reduce((total,conversation)=>total+(conversation.unreadCount||0),0));

        if (snapshotReady.current && currentViewRef.current !== 'atendimento') {
          unread.forEach(conversation => {
            const oldCount = previousUnread.current.get(conversation.id) || 0;
            if ((conversation.unreadCount || 0) <= oldCount) return;
            const preview = messagePreview(conversation);
            toast((item) => (
              <button className="text-left" onClick={() => { openConversation(conversation); toast.dismiss(item.id); }}>
                <strong className="block text-sm">Nova mensagem de {conversation.contactName}</strong>
                <span className="block max-w-72 truncate text-xs text-slate-600">{preview}</span>
              </button>
            ), { icon: '💬', duration: 7000 });
            const audio = new Audio('/sounds/messenger-notification.mp3?v=2');
            audio.volume = 0.65;
            void audio.play().catch(() => undefined);
          });
        }
        previousUnread.current = new Map(conversations.map(conversation => [conversation.id, conversation.unreadCount || 0]));
        snapshotReady.current = true;
      });
    }).catch(()=>setWhatsappUnread(0));
    return()=>{cancelled=true;unsubscribe();snapshotReady.current=false;previousUnread.current.clear()};
  }, [user.id]);

  const openConversation = (conversation: Conversation) => {
    localStorage.setItem('whatsapp_target_phone', String(conversation.phone || conversation.remoteJid || ''));
    setShowNotifications(false);
    onViewChange('atendimento');
  };

  return (
    <header className="h-20 bg-surface-container-lowest border-b border-surface-container-high px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex-1 max-w-xl">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar no sistema..." 
            className="w-full bg-surface-container-low border border-surface-container-high rounded-xl py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => setShowNotifications(value => !value)}
          className="relative p-2 text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all"
          aria-label={`${whatsappUnread} mensagens não lidas`}
        >
          <Bell size={22} />
          {whatsappUnread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-error text-white text-[10px] font-black rounded-full border-2 border-surface-container-lowest flex items-center justify-center">
              {whatsappUnread > 99 ? '99+' : whatsappUnread}
            </span>
          )}
        </button>

        {showNotifications && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" onClick={() => setShowNotifications(false)} aria-label="Fechar notificações" />
            <div className="absolute right-24 top-16 z-50 w-[380px] overflow-hidden rounded-2xl border border-surface-container-high bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-surface-container-high px-5 py-4">
                <div>
                  <p className="text-sm font-black text-on-surface">Novas mensagens</p>
                  <p className="text-[11px] text-on-surface-variant">{whatsappUnread} mensagem(ns) aguardando leitura</p>
                </div>
                <MessageCircle className="text-primary" size={20} />
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {unreadConversations.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-on-surface-variant">Nenhuma mensagem nova.</div>
                ) : unreadConversations.map(conversation => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => openConversation(conversation)}
                    className="flex w-full items-start gap-3 border-b border-surface-container-low px-5 py-4 text-left transition-colors hover:bg-blue-50"
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-black text-primary">
                      {conversation.contactName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="truncate text-sm text-on-surface">{conversation.contactName}</strong>
                        <span className="shrink-0 rounded-full bg-error px-2 py-0.5 text-[10px] font-black text-white">{conversation.unreadCount}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-on-surface-variant">{messagePreview(conversation)}</p>
                    </div>
                  </button>
                ))}
              </div>
              {unreadConversations.length > 0 && (
                <button type="button" onClick={() => { setShowNotifications(false); onViewChange('atendimento'); }} className="w-full bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-white">
                  Abrir atendimento
                </button>
              )}
            </div>
          </>
        )}

        <div className="h-8 w-[1px] bg-surface-container-high"></div>

        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-on-surface uppercase tracking-tighter leading-none mb-1">{user.displayName || 'Usuário'}</p>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest leading-none">{user.role || 'Cliente'}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#dfe5e7] flex items-center justify-center text-[#54656f] border border-[#d1d7db] shadow-sm overflow-hidden">
            <img 
              src={user.photoURL || 'https://ui-avatars.com/api/?name=M+T&background=2563eb&color=fff&bold=true&size=64'} 
              alt="Avatar" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.querySelector('.avatar-initial')?.classList.remove('hidden');
              }}
            />
            <span className="avatar-initial font-bold text-sm hidden">{(user.displayName || user.nome)?.charAt(0) || '?'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
