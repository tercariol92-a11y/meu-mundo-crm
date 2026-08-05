import { Bell, Search, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import { useEffect, useState } from 'react';
import { databaseService } from '../services/databaseService';

interface TopBarProps {
  user: User;
}

export default function TopBar({ user }: TopBarProps) {
  const [whatsappUnread, setWhatsappUnread] = useState(0);

  useEffect(() => databaseService.onConversationsChange((conversations) => {
    setWhatsappUnread(conversations.reduce((total, conversation) => total + (conversation.unreadCount || 0), 0));
  }), []);

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
        <button className="relative p-2 text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-all">
          <Bell size={22} />
          {whatsappUnread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-error text-white text-[10px] font-black rounded-full border-2 border-surface-container-lowest flex items-center justify-center">
              {whatsappUnread > 99 ? '99+' : whatsappUnread}
            </span>
          )}
        </button>

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
