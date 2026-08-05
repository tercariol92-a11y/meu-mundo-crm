import React, { useState } from 'react';
import { Building2, Users, Settings as SettingsIcon, ShieldAlert, MessageSquare, FileText, Globe, Target } from 'lucide-react';
import CompanySettings from './comercial/CompanySettings';
import UserManagement from './config/UserManagement';
import WhatsAppSettings from './comercial/WhatsAppSettings';
import MyWhatsAppSettings from './config/MyWhatsAppSettings';
import ImportClients from './config/ImportClients';
import IntegrationsSettings from './config/IntegrationsSettings';
import MetasEmpresariais from './config/MetasEmpresariais';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Usuario } from '../types';

type SettingsTab = 'empresa' | 'usuarios' | 'meu-whatsapp' | 'whatsapp-admin' | 'import-clientes' | 'integracao' | 'metas';

interface SettingsViewProps {
  user: Usuario;
}

export default function SettingsView({ user }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const pref = sessionStorage.getItem('preferredSettingsTab');
    const userIsAdmin = user.role === 'admin' || user.roles?.includes('admin');
    if (pref) {
      sessionStorage.removeItem('preferredSettingsTab');
      if (userIsAdmin) return (pref === 'whatsapp' ? 'whatsapp-admin' : pref) as SettingsTab;
    }
    return userIsAdmin ? 'empresa' : 'meu-whatsapp';
  });

  const isAdmin = user.role === 'admin' || user.roles?.includes('admin');

  const tabs = isAdmin ? [
      { id: 'empresa', label: 'Dados da Empresa', icon: Building2 },
      { id: 'metas', label: 'Metas Empresariais', icon: Target },
      { id: 'usuarios', label: 'Gestão de Usuários', icon: Users },
      { id: 'meu-whatsapp', label: 'Meu WhatsApp', icon: MessageSquare },
      { id: 'whatsapp-admin', label: 'WhatsApp Admin', icon: MessageSquare },
      { id: 'import-clientes', label: 'Importar Clientes', icon: FileText },
      { id: 'integracao', label: 'Integrações / APIs', icon: Globe }
    ] : [{ id: 'meu-whatsapp', label: 'Meu WhatsApp', icon: MessageSquare }];

  return (
    <div className="min-h-screen bg-surface">
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 text-primary">
            <SettingsIcon size={32} strokeWidth={2.5} />
            <h1 className="text-3xl font-black text-on-surface uppercase tracking-tighter">Configurações do Sistema</h1>
          </div>
          <p className="text-on-surface-variant text-sm ml-11">
            {isAdmin ? 'Gerencie as informações da sua empresa e os acessos dos usuários.' : 'Conecte e gerencie o seu WhatsApp de atendimento.'}
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="flex items-center gap-2 p-1.5 bg-surface-container-high rounded-2xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-highest/50'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-surface-container-lowest rounded-[32px] border border-surface-container-high shadow-sm overflow-hidden min-h-[600px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'empresa' ? (
                <div className="p-0">
                  <CompanySettings />
                </div>
              ) : activeTab === 'metas' ? (
                <div className="p-0">
                  <MetasEmpresariais user={user} />
                </div>
              ) : activeTab === 'usuarios' && isAdmin ? (
                <div className="p-0">
                  <UserManagement user={user} />
                </div>
              ) : activeTab === 'meu-whatsapp' ? (
                <div className="p-0">
                  <MyWhatsAppSettings />
                </div>
              ) : activeTab === 'whatsapp-admin' && isAdmin ? (
                <div className="p-0">
                  <WhatsAppSettings />
                </div>
              ) : activeTab === 'import-clientes' && isAdmin ? (
                <div className="p-8">
                  <ImportClients user={user} />
                </div>
              ) : activeTab === 'integracao' && isAdmin ? (
                <div className="p-0">
                  <IntegrationsSettings user={user} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-on-surface-variant gap-4">
                  <ShieldAlert size={48} className="opacity-20" />
                  <p className="font-bold uppercase tracking-widest text-sm">Acesso Restrito a Administradores</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
