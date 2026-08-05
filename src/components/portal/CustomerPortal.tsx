import React, { useState, useEffect } from 'react';
import { User as BaseUser, Chamado, EquipamentoCliente, Unidade, CustomerPortalUser } from '../../types';
import { databaseService } from '../../services/databaseService';
import CustomerSidebar from './CustomerSidebar';
import CustomerDashboard from './CustomerDashboard';
import CustomerTicketForm from './CustomerTicketForm';
import CustomerTicketList from './CustomerTicketList';
import CustomerTicketDetail from './CustomerTicketDetail';
import CustomerEquipmentList from './CustomerEquipmentList';
import CustomerEquipmentDetail from './CustomerEquipmentDetail';
import CustomerContracts from './CustomerContracts';
import CustomerDocuments from './CustomerDocuments';
import CustomerSLAView from './CustomerSLAView';
import CustomerProfile from './CustomerProfile';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../LanguageProvider';

interface CustomerPortalProps {
  user: CustomerPortalUser;
}

export type PortalView = 
  | 'dashboard' 
  | 'novo-chamado'
  | 'meus-chamados' 
  | 'equipamentos' 
  | 'equipamento-detalhe'
  | 'contratos'
  | 'documentos'
  | 'sla'
  | 'perfil'
  | 'detalhe-chamado';

export default function CustomerPortal({ user }: CustomerPortalProps) {
  const { setLanguage } = useLanguage();
  const [currentView, setCurrentView] = useState<PortalView>('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [preFilledTicket, setPreFilledTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clienteData, setClienteData] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (user.preferences?.language) {
      setLanguage(user.preferences.language);
    }
  }, [user.preferences?.language, setLanguage]);

  useEffect(() => {
    const loadClienteData = async () => {
      // If the user is internal (e.g., administrator, technical, support, sales, manager), bypass the client link verification
      const isInternal = (user as any).userType === 'internal' || 
                         ['admin', 'tecnico', 'vendedor', 'financeiro', 'suporte', 'gerente_comercial', 'gerente'].includes((user as any).role) ||
                         user.email?.toLowerCase().endsWith('@mundotechequipamentos.com.br') ||
                         user.email?.toLowerCase().endsWith('@mundotechsolucoes.com.br');

      if (isInternal) {
        setLoading(false);
        return;
      }

      if (!user.clienteId) {
        setError('Vínculo com cliente não encontrado. Entre em contato com o suporte.');
        setLoading(false);
        return;
      }

      try {
        const data = await databaseService.getClienteById(user.clienteId);
        if (!data) {
          setError('Dados do cliente não encontrados.');
        } else {
          setClienteData(data);
        }
      } catch (err) {
        console.error('Error loading cliente data:', err);
        setError('Erro ao carregar dados do portal.');
      } finally {
        setLoading(false);
      }
    };

    loadClienteData();
  }, [user.clienteId]);

  const handleViewTicket = (id: string) => {
    setSelectedTicketId(id);
    setCurrentView('detalhe-chamado');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <CustomerDashboard user={user} onNavigate={setCurrentView} onViewTicket={handleViewTicket} />;
      case 'novo-chamado':
        return (
          <CustomerTicketForm 
            user={user} 
            preFilledData={preFilledTicket}
            onCancel={() => {
              setPreFilledTicket(null);
              setCurrentView('meus-chamados');
            }} 
            onSuccess={() => {
              setPreFilledTicket(null);
              setCurrentView('meus-chamados');
            }} 
          />
        );
      case 'meus-chamados':
        return <CustomerTicketList user={user} onViewTicket={handleViewTicket} />;
      case 'equipamentos':
        return (
          <CustomerEquipmentList 
            user={user as any} 
            onViewDetail={(id) => {
              setSelectedEquipmentId(id);
              setCurrentView('equipamento-detalhe');
            }}
          />
        );
      case 'equipamento-detalhe':
        return selectedEquipmentId ? (
          <CustomerEquipmentDetail
            user={user}
            equipmentId={selectedEquipmentId}
            onBack={() => setCurrentView('equipamentos')}
            onOpenTicket={(data) => {
              setPreFilledTicket(data);
              setCurrentView('novo-chamado');
            }}
          />
        ) : <CustomerEquipmentList user={user as any} onViewDetail={(id) => {
          setSelectedEquipmentId(id);
          setCurrentView('equipamento-detalhe');
        }} />;
      case 'contratos':
        return <CustomerContracts user={user as any} clienteData={clienteData} />;
      case 'documentos':
        return <CustomerDocuments user={user as any} clienteData={clienteData} />;
      case 'sla':
        return <CustomerSLAView user={user as any} clienteData={clienteData} />;
      case 'perfil':
        return <CustomerProfile user={user as any} clienteData={clienteData} onNavigate={setCurrentView} />;
      case 'detalhe-chamado':
        return selectedTicketId ? (
          <CustomerTicketDetail 
            ticketId={selectedTicketId} 
            onBack={() => setCurrentView('meus-chamados')} 
            user={user}
          />
        ) : <CustomerTicketList user={user} onViewTicket={handleViewTicket} />;
      default:
        return <CustomerDashboard user={user} onNavigate={setCurrentView} onViewTicket={handleViewTicket} />;
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-surface-container-lowest">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={40} />
          <p className="text-sm font-medium text-on-surface-variant">Carregando Portal do Cliente...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-surface-container-lowest p-6">
        <div className="max-w-md w-full bg-error/5 border border-error/20 p-8 rounded-3xl text-center space-y-4">
          <AlertCircle className="mx-auto text-error" size={48} />
          <h2 className="text-xl font-black text-error uppercase tracking-tight">Acesso Restrito</h2>
          <p className="text-sm text-on-surface-variant font-medium">{error}</p>
          
          <div className="pt-4 pb-2 border-t border-error/10">
            <p className="text-[10px] text-on-surface-variant opacity-60 uppercase tracking-widest font-black mb-1">Seu e-mail logado:</p>
            <p className="text-xs font-black text-primary bg-primary/5 py-2 px-4 rounded-xl inline-block">{user.email}</p>
          </div>

          <p className="text-[10px] text-on-surface-variant italic">Solicite ao administrador para vincular seu e-mail ao cadastro do cliente.</p>

          <button 
            onClick={() => databaseService.signOut()}
            className="w-full mt-4 px-6 py-4 bg-error text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-error/20 hover:scale-105 active:scale-95 transition-all"
          >
            Sair do Sistema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest flex">
      <CustomerSidebar 
        currentView={currentView} 
        onViewChange={(view) => {
          setCurrentView(view);
          setSelectedTicketId(null);
        }} 
        user={user}
        clienteData={clienteData}
        isCollapsed={isSidebarCollapsed}
        onCollapse={setIsSidebarCollapsed}
      />
      
      <main className={`flex-1 p-8 overflow-y-auto transition-all duration-500 ${isSidebarCollapsed ? 'ml-24' : 'ml-72'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView + (selectedTicketId || '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
