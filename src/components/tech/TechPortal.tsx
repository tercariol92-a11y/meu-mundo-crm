import { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { User, Tecnico } from '../../types';
import TechDashboard from './TechDashboard';
import TechCallList from './TechCallList';
import TechCallDetail from './TechCallDetail';
import { LayoutDashboard, ClipboardList, User as UserIcon, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TechPortalProps {
  user: User;
  onLogout: () => void;
}

export default function TechPortal({ user, onLogout }: TechPortalProps) {
  const [tecnico, setTecnico] = useState<Tecnico | null>(null);
  const [view, setView] = useState<'dashboard' | 'list' | 'detail'>('dashboard');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTecnico() {
      try {
        const data = await databaseService.getTecnicoByUserId(user.id);
        setTecnico(data);
      } catch (error) {
        console.error('Error loading technician data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadTecnico();
  }, [user.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!tecnico) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-10 text-center bg-surface">
        <div className="w-20 h-20 bg-error/10 text-error rounded-3xl flex items-center justify-center mb-6">
          <UserIcon size={40} />
        </div>
        <h2 className="text-xl font-black text-on-surface uppercase tracking-tight mb-2">Perfil não encontrado</h2>
        <p className="text-sm text-on-surface-variant mb-8">
          Seu usuário não está vinculado a um perfil técnico. Por favor, entre em contato com o suporte.
        </p>
        <button 
          onClick={onLogout}
          className="px-8 py-4 bg-surface-container-high rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    );
  }

  const navigateToCall = (id: string) => {
    setSelectedCallId(id);
    setView('detail');
  };

  const renderContent = () => {
    switch (view) {
      case 'dashboard':
        return <TechDashboard tecnico={tecnico} onViewCall={navigateToCall} onViewAll={() => setView('list')} />;
      case 'list':
        return <TechCallList tecnico={tecnico} onViewCall={navigateToCall} onBack={() => setView('dashboard')} />;
      case 'detail':
        return selectedCallId ? (
          <TechCallDetail 
            callId={selectedCallId} 
            tecnico={tecnico} 
            onBack={() => setView('list')} 
            onStatusUpdate={() => {}} // Could refresh dashboard stats if needed
          />
        ) : null;
      default:
        return <TechDashboard tecnico={tecnico} onViewCall={navigateToCall} onViewAll={() => setView('list')} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface font-sans select-none overflow-hidden max-w-md mx-auto shadow-2xl">
      {/* Content Area */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={view + (selectedCallId || '')}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-0 overflow-y-auto"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom bar navigation (only for main views) */}
      {view !== 'detail' && (
        <nav className="bg-surface-container-low border-t border-surface-container-high px-6 py-4 flex items-center justify-around pb-8">
          <button 
            onClick={() => setView('dashboard')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'dashboard' ? 'text-primary scale-110' : 'text-on-surface-variant opacity-40'}`}
          >
            <LayoutDashboard size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest">Início</span>
          </button>
          
          <button 
            onClick={() => setView('list')}
            className={`flex flex-col items-center gap-1 transition-all ${view === 'list' ? 'text-primary scale-110' : 'text-on-surface-variant opacity-40'}`}
          >
            <ClipboardList size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest">Chamados</span>
          </button>
          
          <button 
            onClick={onLogout}
            className="flex flex-col items-center gap-1 text-on-surface-variant opacity-40 active:text-error active:opacity-100"
          >
            <LogOut size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest">Sair</span>
          </button>
        </nav>
      )}
    </div>
  );
}
