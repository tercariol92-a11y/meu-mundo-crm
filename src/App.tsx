import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AuthForm from './components/AuthForm';
import TopBar from './components/TopBar';
import FloatingActionMenu from './components/FloatingActionMenu';
import { ViewType, Usuario, CustomerPortalUser } from './types';
import { LayoutDashboard, Users, Menu, X, MessageSquare } from 'lucide-react';
import { databaseService } from './services/databaseService';
import { auth, onAuthStateChanged, db } from './firebase';
import { doc, onSnapshot } from './services/resilientFirestoreClient';

import Dashboard from './components/Dashboard';
import LeadsList from './components/comercial/LeadsList';
import ClientList from './components/crm/ClientList';
import QuotesList from './components/comercial/QuotesList';
import SalesPipeline from './components/comercial/SalesPipeline';
import CommercialDashboard from './components/comercial/CommercialDashboard';
import AgendaComercialView from './components/comercial/AgendaComercial';
import CommercialActionsView from './components/comercial/CommercialActions';
import LossReasonsView from './components/comercial/LossReasons';
import ProductList from './components/comercial/ProductList';
import EmployeeList from './components/comercial/EmployeeList';
import CompanySettings from './components/comercial/CompanySettings';
import GeminiAssistant from './components/GeminiAssistant';
import SupportView from './components/support/SupportView';
import UnidadeList from './components/support/UnidadeList';
import TecnicoList from './components/support/TecnicoList';
import SettingsView from './components/SettingsView';
import TechnicalAssistanceView from './components/support/TechnicalAssistanceView';
import PendingEquipmentsView from './components/support/PendingEquipmentsView';
import AtendimentoView from './components/atendimento/AtendimentoView';
import SatisfacaoView from './components/satisfacao/SatisfacaoView';
import VendedorDashboard from './components/comercial/VendedorDashboard';
import RetornosView from './components/comercial/RetornosView';
import IntegracaoBlingView from './components/comercial/IntegracaoBlingView';
import ProspectingModule from './components/comercial/ProspectingModule';
import UserManagement from './components/config/UserManagement';
import CommissionCard from './components/comercial/CommissionCard';
import Logo from './components/Logo';
import CustomerPortal from './components/portal/CustomerPortal';
import TechPortal from './components/tech/TechPortal';
import FinanceiroContasPagar from './components/FinanceiroContasPagar';
import GestaoTarefasView from './components/gestao/GestaoTarefasView';
import CargosEPerfisView from './components/rh/CargosEPerfisView';

import { ThemeProvider } from './components/ThemeProvider';
import { LanguageProvider } from './components/LanguageProvider';
import { CompanyProvider } from './contexts/CompanyContext';
import { GlobalDataProvider } from './contexts/GlobalDataContext';
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <CompanyProvider>
          <GlobalDataProvider>
            <AppContent />
            <Toaster position="top-right" />
          </GlobalDataProvider>
        </CompanyProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [user, setUser] = useState<Usuario | CustomerPortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Global Navigation Event Listener for nested dashboards and triggers
  useEffect(() => {
    const handleNavigation = (e: Event) => {
      const customEvent = e as CustomEvent<{ view: string; tab?: string }>;
      if (customEvent.detail && customEvent.detail.view) {
        setCurrentView(customEvent.detail.view as any);
        if (customEvent.detail.tab) {
          sessionStorage.setItem('preferredSettingsTab', customEvent.detail.tab);
        }
      }
    };
    window.addEventListener('navigateApp', handleNavigation);
    return () => {
      window.removeEventListener('navigateApp', handleNavigation);
    };
  }, []);
  
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (firebaseUser) {
        databaseService.syncProfile(firebaseUser).then((usuario) => {
          if (usuario) {
            if ((usuario as any).ativo === false) {
              databaseService.signOut();
              setUser(null);
              setLoading(false);
              return;
            }
            setUser(usuario as any);
            setLoading(false);

            // Set up real-time listener for updates (promotions, status updates, client linkage, etc.)
            const collectionName = usuario.userType === 'internal' ? 'usuarios' : 'customer_portal_users';
            unsubscribeSnapshot = onSnapshot(doc(db, collectionName, firebaseUser.uid), (snap) => {
              if (snap.exists()) {
                const updatedData = { id: snap.id, ...snap.data(), userType: usuario.userType } as any;
                
                // If the user's status got set to false, sign them out immediately
                if (updatedData.ativo === false) {
                  databaseService.signOut();
                  setUser(null);
                  return;
                }
                
                // Update profile cache as well to prevent cache hits with old data
                databaseService.profileCache.set(firebaseUser.uid, updatedData);
                setUser(updatedData);
              }
            });
          } else {
            setUser(null);
            setLoading(false);
          }
        }).catch(err => {
          console.error("Error syncing user profile:", err);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  // Redirect non-admins to 'vendedor-dashboard' when landing on 'dashboard'
  useEffect(() => {
    if (user && user.userType === 'internal') {
      const internalUser = user as Usuario;
      const isAdmin = internalUser.role === 'admin' || internalUser.roles?.includes('admin');
      if (currentView === 'dashboard' && !isAdmin) {
        setCurrentView('vendedor-dashboard');
      }
    }
  }, [user, currentView]);

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case 'new-lead':
        setCurrentView('comercial-leads');
        break;
      case 'new-client':
        setCurrentView('comercial-clientes');
        break;
      case 'new-quote':
        setCurrentView('comercial-orcamentos');
        break;
      case 'new-visit':
        setCurrentView('comercial-agenda');
        break;
      case 'new-ticket':
        setCurrentView('chamados');
        break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="text-slate-400 font-bold uppercase tracking-widest animate-pulse">
          Meu Mundo CRM 
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Iniciando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <AuthForm onSuccess={async (u) => {
          try {
            const perfil = await databaseService.syncProfile(u);
            setUser(perfil as any);
          } catch (err) {
            console.error('Error syncing profile:', err);
          }
        }} />
      </div>
    );
  }

  const userEmail = (user.email || '').toLowerCase().trim();
  
  // 1. Check if user has internal role/function
  const isInternalRole = ['admin', 'tecnico', 'vendedor', 'financeiro', 'suporte', 'gerente_comercial', 'gerente'].includes((user as any).role);
  
  // 2. Check if user belongs to an internal domain or has an internal userType
  const isInternalDomain = userEmail.endsWith('@mundotechequipamentos.com.br') || 
                           userEmail.endsWith('@mundotechsolucoes.com.br') || 
                           userEmail === 'tercariol92@gmail.com';
  
  const isInternal = user.userType === 'internal' || isInternalRole || isInternalDomain;

  // 3. Only users with role "cliente" or who are not internal should be routed to Customer Portal
  if ((user as any).role === 'cliente' || !isInternal) {
    return <CustomerPortal user={user as CustomerPortalUser} />;
  }

  const internalUser = user as Usuario;

  if (internalUser.role === 'tecnico') {
    return <TechPortal user={internalUser} onLogout={() => databaseService.signOut()} />;
  }

  const renderView = () => {
    if (!internalUser) return null;
    const userRole = internalUser.role;

    switch (currentView) {
      case 'dashboard':
        return <Dashboard user={internalUser} />;
      case 'comercial-leads':
        return <LeadsList user={internalUser} onViewChange={setCurrentView} />;
      case 'comercial-clientes':
      case 'crm-clientes':
      case 'clientes':
        return <ClientList user={internalUser} onViewChange={setCurrentView} />;
      case 'comercial-orcamentos':
      case 'crm-orcamentos':
        return <QuotesList user={internalUser} onViewChange={setCurrentView} />;
      case 'comercial-pipeline':
        return <SalesPipeline userId={internalUser.id} />;
      case 'comercial-dashboard':
        return <CommercialDashboard user={internalUser} />;
      case 'comercial-agenda':
      case 'crm-agenda':
        return <AgendaComercialView userId={internalUser.id} />;
      case 'comercial-acoes':
        return <CommercialActionsView userId={internalUser.id} />;
      case 'comercial-motivos-perda':
        return <LossReasonsView userId={internalUser.id} />;
      case 'comercial-produtos':
        return <ProductList user={internalUser} />;
      case 'comercial-funcionarios':
      case 'user-management':
        return <UserManagement user={internalUser} />;
      case 'financeiro-contas-pagar':
        return <FinanceiroContasPagar user={internalUser} defaultTab="dashboard" />;
      case 'financeiro-faturamento':
        return <FinanceiroContasPagar user={internalUser} defaultTab="faturamento" />;
      case 'financeiro-contratos':
        return <FinanceiroContasPagar user={internalUser} defaultTab="contratos" />;
      case 'gestao-tarefas':
        return <GestaoTarefasView user={internalUser} />;
      case 'rh-cargos-perfis':
        return <CargosEPerfisView user={internalUser} />;
      case 'comercial-configuracao-empresa':
        return <CompanySettings />;
      case 'configuracoes':
        return <SettingsView user={internalUser} />;
      case 'suporte-dashboard':
        return <SupportView user={internalUser} mode="dashboard" />;
      case 'chamados':
        return <SupportView user={internalUser} mode="chamados" />;
      case 'unidades':
        return <UnidadeList user={internalUser} />;
      case 'assistencia-tecnica':
        return <TechnicalAssistanceView user={internalUser} />;
      case 'equipamentos-pendentes':
        return <PendingEquipmentsView user={internalUser} />;
      case 'atendimento':
        return <AtendimentoView user={internalUser} onViewChange={setCurrentView} />;
      case 'satisfacao':
        return <SatisfacaoView />;
      case 'tecnicos':
        return <TecnicoList user={internalUser} />;
      case 'gemini-assistant':
        return <GeminiAssistant user={internalUser} />;
      case 'vendedor-dashboard':
        return <VendedorDashboard user={internalUser} />;
      case 'retornos':
        return <RetornosView />;
      case 'integracao-bling':
        return <IntegracaoBlingView />;
      case 'prospeccao-buscar':
      case 'prospeccao-leads':
      case 'prospeccao-campanhas':
      case 'prospeccao-whatsapp':
      case 'prospeccao-emails':
      case 'prospeccao-automacao':
      case 'prospeccao-historico':
        return <ProspectingModule user={internalUser} initialTab={currentView.replace('prospeccao-', '')} onViewChange={setCurrentView} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] text-on-surface-variant p-8">
            <h2 className="text-2xl font-bold uppercase tracking-widest text-primary/20">Em Desenvolvimento</h2>
            <div className="flex flex-col items-center gap-2 mt-4 text-center">
              <p className="text-xs font-medium uppercase tracking-widest opacity-40">Esta seção ({currentView}) está sendo preparada para o</p>
              <Logo showText className="h-8 w-auto opacity-30 grayscale" />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block">
        <Sidebar currentView={currentView} onViewChange={(v) => { setCurrentView(v); setIsSidebarOpen(false); }} user={internalUser} />
      </div>

      {/* Sidebar - Mobile Overlay */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="relative w-64 h-full animate-in slide-in-from-left duration-300">
            <Sidebar currentView={currentView} onViewChange={(v) => { setCurrentView(v); setIsSidebarOpen(false); }} user={internalUser} />
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="absolute top-4 right-[-3rem] p-2 bg-primary text-white rounded-lg shadow-lg"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}
      
      <main className="flex-1 min-h-screen flex flex-col lg:ml-52">
        <div className="lg:hidden sticky top-0 z-40 bg-surface-container-lowest border-b border-surface-container-high px-4 h-16 flex items-center justify-between">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-primary">
            <Menu size={24} />
          </button>
          <Logo className="h-8 w-auto" />
          <div className="w-10 h-10"></div> {/* Spacer */}
        </div>

        <div className="hidden lg:block">
          <TopBar user={internalUser} />
        </div>

        <div className="flex-1 pb-20 lg:pb-0 flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            {renderView()}
          </div>
          
          {(user as any).role === 'vendedor' && (user as any).podeVerComissao !== false && (
            <div className="hidden xl:block w-80 p-6 border-l border-surface-container-high bg-surface-container-lowest/50">
              <CommissionCard userId={user.id} />
            </div>
          )}
        </div>

        {/* Floating Action Menu */}
        <FloatingActionMenu onAction={handleAction} />

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 w-full h-16 bg-surface-container-lowest border-t border-surface-container-high flex justify-around items-center z-50">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`flex flex-col items-center gap-1 flex-1 py-2 ${currentView === 'dashboard' ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Início</span>
          </button>
          <button 
            onClick={() => setCurrentView('atendimento')}
            className={`flex flex-col items-center gap-1 flex-1 py-2 ${currentView === 'atendimento' ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            <MessageSquare size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Atendimento</span>
          </button>
          <button 
            onClick={() => setCurrentView('comercial-clientes')}
            className={`flex flex-col items-center gap-1 flex-1 py-2 ${currentView === 'comercial-clientes' ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            <Users size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Comercial</span>
          </button>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center gap-1 flex-1 py-2 text-on-surface-variant"
          >
            <Menu size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">Menu</span>
          </button>
        </nav>
      </main>
    </div>
  );
}
