import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  ClipboardList, 
  History, 
  Wrench, 
  User, 
  LogOut,
  ChevronRight,
  Headset,
  FileText,
  FolderOpen,
  Clock
} from 'lucide-react';
import { User as UserType, Cliente } from '../../types';
import { databaseService } from '../../services/databaseService';
import { PortalView } from './CustomerPortal';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../LanguageProvider';

interface CustomerSidebarProps {
  currentView: PortalView;
  onViewChange: (view: PortalView) => void;
  user: UserType;
  clienteData?: Cliente;
  isCollapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

export default function CustomerSidebar({ currentView, onViewChange, user, clienteData, isCollapsed, onCollapse }: CustomerSidebarProps) {
  const { t } = useLanguage();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: t.menu.home, icon: LayoutDashboard },
    { id: 'meus-chamados', label: t.menu.tickets, icon: ClipboardList },
    { id: 'equipamentos', label: t.menu.equipment, icon: Wrench },
    { id: 'documentos', label: t.menu.documents, icon: FolderOpen },
    { id: 'contratos', label: t.menu.contracts, icon: FileText },
    { id: 'perfil', label: t.menu.profile, icon: User },
  ];

  const handleLogout = async () => {
    try {
      await databaseService.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <aside className={`h-screen fixed left-0 top-0 border-r border-surface-container-high bg-surface-container-low flex flex-col py-8 gap-4 z-50 transition-all duration-500 ease-in-out ${isCollapsed ? 'w-24' : 'w-72'}`}>
      <div className="px-6 mb-8 flex items-center justify-between">
        <div className={`flex items-center gap-3 transition-opacity duration-300 ${isCollapsed ? 'opacity-0 invisible w-0' : 'opacity-100'}`}>
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0">
            <Headset size={24} />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-sm font-black uppercase tracking-tight text-on-surface whitespace-nowrap">Portal Cliente</h1>
            <p className="text-[10px] tracking-widest uppercase font-bold text-primary whitespace-nowrap">Mundo Tech</p>
          </div>
        </div>
        <button 
          onClick={() => onCollapse(!isCollapsed)}
          className="p-2 rounded-xl bg-surface-container-high text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
        >
          <ChevronRight size={16} className={`transition-transform duration-500 ${isCollapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-2 px-4">
        {menuItems.map((item) => {
          const isSelected = currentView === item.id || (currentView === 'detalhe-chamado' && item.id === 'meus-chamados');
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as PortalView)}
              className={`flex items-center gap-4 px-4 py-4 transition-all duration-300 group rounded-[24px] relative overflow-hidden ${
                isSelected
                  ? 'bg-primary text-white shadow-xl shadow-primary/30'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:translate-x-1'
              }`}
            >
              <div className="relative z-10 flex items-center justify-center shrink-0">
                <item.icon size={20} className={isSelected ? 'text-white' : 'text-primary group-hover:scale-110 transition-transform'} />
              </div>
              <span className={`text-[10px] tracking-[0.1em] uppercase font-black transition-all duration-500 z-10 whitespace-nowrap ${isCollapsed ? 'opacity-0 translate-x-10 invisible w-0' : 'opacity-100'}`}>
                {item.label}
              </span>
              
              {isSelected && !isCollapsed && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white shadow-sm"
                />
              )}
              
              {/* Subtle hover effect for collapsed mode */}
              {isCollapsed && (
                <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-10 transition-opacity" />
              )}
            </button>
          );
        })}

        <div className="mt-auto border-t border-surface-container-high pt-6 space-y-2">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className={`w-full flex items-center gap-4 px-4 py-4 transition-all duration-300 text-error hover:bg-error/10 rounded-[24px] group ${isCollapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={20} className="shrink-0 group-hover:scale-110 transition-transform" />
            <span className={`text-[10px] tracking-[0.1em] uppercase font-black transition-all duration-500 whitespace-nowrap ${isCollapsed ? 'opacity-0 invisible w-0' : 'opacity-100'}`}>
              {t.menu.logout}
            </span>
          </button>
        </div>
      </nav>

      <div className="px-4 mt-4">
        <div className={`flex items-center gap-4 p-4 rounded-[32px] bg-surface-container-lowest shadow-lg border border-surface-container-high overflow-hidden transition-all duration-500 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border-2 border-surface shadow-sm shrink-0 group hover:scale-110 transition-transform">
            {clienteData?.logoUrl ? (
              <img src={clienteData.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <span className="text-xs font-black uppercase">{clienteData?.nomeFantasia?.charAt(0) || 'C'}</span>
            )}
          </div>
          <div className={`overflow-hidden transition-all duration-500 ${isCollapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
            <p className="text-[10px] font-black text-on-surface truncate uppercase tracking-tighter leading-tight">
              {clienteData?.nomeFantasia || 'Minha Empresa'}
            </p>
            <p className="text-[8px] text-on-surface-variant truncate font-bold uppercase tracking-widest opacity-60">Status: Ativo</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showLogoutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface-container-low p-8 rounded-[32px] shadow-2xl z-[110] text-center"
            >
              <div className="w-16 h-16 bg-error/10 text-error rounded-3xl flex items-center justify-center mx-auto mb-6">
                <LogOut size={32} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-on-surface mb-2">Sair do Portal?</h3>
              <p className="text-sm text-on-surface-variant mb-8 font-medium">Deseja realmente encerrar sua sessão no portal?</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleLogout}
                  className="w-full py-3 bg-error text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-error/90 transition-all shadow-lg shadow-error/20"
                >
                  Sair Agora
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full py-3 bg-surface-container-high text-on-surface rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-surface-container-highest transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </aside>
  );
}
