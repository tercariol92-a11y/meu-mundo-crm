import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  User, 
  Mail, 
  Building2, 
  Phone, 
  MapPin, 
  Shield, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Key,
  Globe,
  FileText,
  Camera,
  Briefcase,
  History,
  Smartphone,
  Lock,
  Users,
  CreditCard,
  Calendar,
  Clock,
  Package,
  ArrowUpRight,
  Headset,
  Bell,
  Languages,
  Moon,
  Sun,
  Laptop,
  Plus,
  Trash2,
  X,
  Edit2,
  Send
} from 'lucide-react';
import { User as UserType, Cliente, CustomerPortalUser, EquipamentoCliente, AccessLog } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../ThemeProvider';
import { useLanguage } from '../LanguageProvider';
import { requestPushPermission } from '../../utils/pushNotifications';

interface CustomerProfileProps {
  user: CustomerPortalUser;
  clienteData?: Cliente;
  onNavigate?: (view: any) => void;
}

export default function CustomerProfile({ user: initialUser, clienteData: initialCliente, onNavigate }: CustomerProfileProps) {
  const { theme, setTheme } = useTheme();
  const { language: lang, t, setLanguage } = useLanguage();
  
  // States
  const [user, setUser] = useState<CustomerPortalUser>(initialUser);
  const [cliente, setCliente] = useState<Cliente | undefined>(initialCliente);
  const [activeTab, setActiveTab] = useState<'perfil' | 'empresa' | 'seguranca' | 'preferencias' | 'contrato'>('perfil');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [authorizedContacts, setAuthorizedContacts] = useState<CustomerPortalUser[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [equipments, setEquipments] = useState<EquipamentoCliente[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<CustomerPortalUser> | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (!cliente?.id) return;
    try {
      const [contacts, statsData, equipData, logs] = await Promise.all([
        databaseService.getPortalUsers(cliente.id),
        databaseService.getSLAStats(cliente.id),
        databaseService.getEquipamentosByCliente(cliente.id),
        databaseService.getAccessLogs(user.id)
      ]);
      setAuthorizedContacts(contacts || []);
      setStats(statsData);
      setEquipments(equipData || []);
      setAccessLogs(logs || []);
    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setLoading(false);
    }
  }, [cliente?.id, user.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleSaveProfile = async (formData: Partial<CustomerPortalUser>) => {
    setIsSaving(true);
    try {
      await databaseService.updatePortalUser(user.id, formData);
      setUser(prev => ({ ...prev, ...formData }));
      showMessage('success', 'Perfil atualizado com sucesso!');
    } catch (err) {
      showMessage('error', 'Erro ao salvar alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCompany = async (formData: Partial<Cliente>) => {
    if (!cliente?.id) return;
    setIsSaving(true);
    try {
      await databaseService.updateCliente(cliente.id, formData);
      setCliente(prev => ({ ...prev!, ...formData }));
      showMessage('success', 'Dados da empresa atualizados!');
    } catch (err) {
      showMessage('error', 'Erro ao salvar dados da empresa.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePreference = async (key: string, value: any) => {
    try {
      const updatedPrefs = { ...user.preferences, [key]: value };
      await databaseService.updatePortalUser(user.id, { preferences: updatedPrefs });
      setUser(prev => ({ ...prev, preferences: updatedPrefs }));
      
      if (key === 'theme') setTheme(value);
      if (key === 'pushNotifications' && value === true) {
        await requestPushPermission(user.id);
      }
      
      showMessage('success', t.preferences + ' atualizada!');
    } catch (err) {
      console.error('Error updating preference:', err);
    }
  };

  const handlePhotoUpload = async (file: File, type: 'avatar' | 'logo') => {
    setIsSaving(true);
    try {
      const path = type === 'avatar' ? `users/${user.id}/avatar` : `clients/${cliente?.id}/logo`;
      const url = await databaseService.uploadFile(file, path);
      
      if (type === 'avatar') {
        await databaseService.updatePortalUser(user.id, { photoURL: url });
        setUser(prev => ({ ...prev, photoURL: url }));
      } else if (cliente?.id) {
        await databaseService.updateCliente(cliente.id, { logoUrl: url });
        setCliente(prev => ({ ...prev!, logoUrl: url }));
      }
      showMessage('success', 'Imagem atualizada com sucesso!');
    } catch (err) {
      showMessage('error', 'Erro ao fazer upload da imagem.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateContact = async (data: any) => {
    if (!cliente?.id) return;
    try {
      await databaseService.createAuthorizedContact(cliente.id, {
        ...data,
        ativo: true
      });
      loadData();
      setShowContactModal(false);
      showMessage('success', 'Contato adicionado!');
    } catch (err) {
      showMessage('error', 'Erro ao adicionar contato.');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant animate-pulse">Carregando painel de gestão...</p>
      </div>
    );
  }

  const tabs = [
    { id: 'perfil', label: t.profile, icon: User },
    { id: 'empresa', label: t.company, icon: Building2 },
    { id: 'seguranca', label: t.security, icon: Shield },
    { id: 'preferencias', label: t.preferences, icon: Bell },
    { id: 'contrato', label: t.contract, icon: FileText },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header Premium */}
      <header className="relative p-10 rounded-[48px] bg-surface-container-lowest border border-surface-container-high shadow-2xl overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-primary/10 transition-all duration-700" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl -ml-20 -mb-20" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-[40px] bg-surface-container-highest flex items-center justify-center border-4 border-surface shadow-xl overflow-hidden">
              {cliente?.logoUrl ? (
                <img src={cliente.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={48} className="text-primary/20" />
              )}
            </div>
            <button 
              onClick={() => logoInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 p-3 bg-primary text-white rounded-2xl shadow-lg border-4 border-surface-container-lowest hover:scale-110 active:scale-95 transition-all"
            >
              <Camera size={16} />
            </button>
            <input type="file" ref={logoInputRef} onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], 'logo')} className="hidden" accept="image/*" />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
              <h1 className="text-3xl font-black uppercase tracking-tight text-on-surface">
                {cliente?.nomeFantasia || 'Sua Empresa'}
              </h1>
              <span className="px-4 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 self-center md:self-auto">
                {t.current}
              </span>
            </div>
            <p className="text-on-surface-variant font-medium flex items-center justify-center md:justify-start gap-2">
              <MapPin size={14} className="text-primary" />
              {cliente?.cidade ? `${cliente.cidade}, ${cliente.estado}` : 'Localização não informada'}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full lg:w-auto">
            {[
              { label: 'Equipamentos', value: equipments.length },
              { label: 'Abertos', value: stats?.total || 0 },
              { label: 'SLA Médio', value: `${stats?.avgResolutionTime || '0'}h` },
              { label: 'Disponibilidade', value: '100%', color: 'text-green-500' }
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-3xl bg-surface-container-highest/30 border border-surface-container-high text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{stat.label}</p>
                <p className={`text-xl font-black ${stat.color || 'text-primary'}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="flex items-center gap-2 p-2 bg-surface-container-low rounded-[32px] border border-surface-container-high overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-3 px-6 py-4 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' 
                : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-primary'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          <div className="lg:col-span-2 space-y-8">
            {activeTab === 'perfil' && (
              <section className="bg-surface-container-lowest p-8 md:p-10 rounded-[48px] border border-surface-container-high shadow-lg space-y-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <User size={20} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em]">{t.profile}</h3>
                </div>

                <div className="flex flex-col md:flex-row gap-10">
                  <div className="relative group/avatar">
                    <div className="w-32 h-32 rounded-[40px] bg-surface-container-highest border-4 border-surface shadow-xl overflow-hidden">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User size={40} className="m-auto mt-10 text-primary/20" />
                      )}
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 p-3 bg-secondary text-white rounded-2xl shadow-lg border-4 border-surface-container-lowest hover:scale-110 active:scale-95 transition-all"
                    >
                      <Camera size={16} />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], 'avatar')} className="hidden" accept="image/*" />
                  </div>

                  <form className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    handleSaveProfile({
                      nome: formData.get('nome') as string,
                      cargo: formData.get('cargo') as string,
                      telefone: formData.get('telefone') as string,
                      ramal: formData.get('ramal') as string,
                    });
                  }}>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">Nome Completo</label>
                      <input name="nome" type="text" defaultValue={user.nome} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">Cargo</label>
                      <input name="cargo" type="text" defaultValue={user.cargo} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div className="space-y-2 opacity-60">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">E-mail</label>
                      <div className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold">{user.email}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">WhatsApp</label>
                        <input name="telefone" type="text" defaultValue={user.telefone} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Ramal</label>
                        <input name="ramal" type="text" defaultValue={user.ramal} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                    </div>
                    <div className="md:col-span-2 pt-6 flex justify-end">
                      <button disabled={isSaving} type="submit" className="px-10 py-4 bg-primary text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2">
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                        {t.save}
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            )}

            {activeTab === 'empresa' && (
              <section className="bg-surface-container-lowest p-8 md:p-10 rounded-[48px] border border-surface-container-high shadow-lg space-y-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
                    <Building2 size={20} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em]">{t.companyInfo}</h3>
                </div>

                <form className="grid grid-cols-1 md:grid-cols-2 gap-8" onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleSaveCompany({
                    razaoSocial: formData.get('razaoSocial') as string,
                    nomeFantasia: formData.get('nomeFantasia') as string,
                    emailPrincipal: formData.get('email') as string,
                    celularWhatsapp: formData.get('phone') as string,
                    rua: formData.get('rua') as string,
                    numero: formData.get('numero') as string,
                    bairro: formData.get('bairro') as string,
                    cep: formData.get('cep') as string,
                    cidade: formData.get('cidade') as string,
                    estado: formData.get('estado') as string,
                  });
                }}>
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary border-b border-primary/10 pb-2">Identificação</h4>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Razão Social</label>
                        <input name="razaoSocial" defaultValue={cliente?.razaoSocial} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome Fantasia</label>
                        <input name="nomeFantasia" defaultValue={cliente?.nomeFantasia} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">E-mail Corporativo</label>
                          <input name="email" defaultValue={cliente?.emailPrincipal} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Telefone / WhatsApp</label>
                          <input name="phone" defaultValue={cliente?.celularWhatsapp} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary border-b border-primary/10 pb-2">Localização</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="col-span-3 space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Rua</label>
                        <input name="rua" defaultValue={cliente?.rua} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Nº</label>
                        <input name="numero" defaultValue={cliente?.numero} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Bairro</label>
                        <input name="bairro" defaultValue={cliente?.bairro} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">CEP</label>
                        <input name="cep" defaultValue={cliente?.cep} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Cidade</label>
                        <input name="cidade" defaultValue={cliente?.cidade} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">UF</label>
                        <input name="estado" defaultValue={cliente?.estado} className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 pt-6 flex justify-end">
                    <button type="submit" disabled={isSaving} className="px-10 py-4 bg-primary text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all">
                      {isSaving ? 'Salvando...' : t.save}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {activeTab === 'seguranca' && (
              <section className="bg-surface-container-lowest p-8 md:p-10 rounded-[48px] border border-surface-container-high shadow-lg space-y-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                    <Shield size={20} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em]">{t.security}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 rounded-[40px] bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 space-y-6">
                    <div className="flex items-center gap-2 text-red-600">
                      <Lock size={18} />
                      <h4 className="text-[10px] font-black uppercase tracking-widest">Proteção da Conta</h4>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                      Para sua segurança, ao solicitar a redefinição de senha, você receberá um link seguro em seu email cadastrado.
                    </p>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="w-full py-4 bg-white dark:bg-surface-container text-red-600 border border-red-200 dark:border-red-900/30 rounded-[24px] font-black uppercase tracking-widest text-[10px] hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-3 shadow-sm"
                    >
                      <Key size={16} />
                      {t.resetPassword}
                    </button>
                  </div>

                  <div className="p-8 rounded-[40px] bg-primary/5 border border-primary/10 space-y-6">
                    <div className="flex items-center gap-2 text-primary">
                      <Smartphone size={18} />
                      <h4 className="text-[10px] font-black uppercase tracking-widest">Autenticação em Duas Etapas</h4>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                        Proteja sua conta com uma camada extra de segurança via SMS ou App Authenticator.
                      </p>
                      <button 
                        onClick={() => handleUpdatePreference('twoFactorEnabled', !user.twoFactorEnabled)}
                        className={`w-14 h-8 rounded-full relative transition-all duration-300 ${user.twoFactorEnabled ? 'bg-primary' : 'bg-surface-container-high'}`}
                      >
                        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-300 ${user.twoFactorEnabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-on-surface opacity-40">
                    <History size={16} />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">{t.history}</h4>
                  </div>
                  <div className="overflow-hidden rounded-[32px] border border-surface-container-high">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-surface-container-low border-b border-surface-container-high">
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Ação</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Data / Hora</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t.ipAddress}</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t.status}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container-high bg-surface-container-lowest">
                          {accessLogs.length > 0 ? accessLogs.map(log => (
                            <tr key={log.id}>
                              <td className="px-8 py-5 text-xs font-black uppercase tracking-widest text-primary">{log.action.replace('_', ' ')}</td>
                              <td className="px-8 py-5 text-xs font-bold text-on-surface whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString('pt-BR')}
                              </td>
                              <td className="px-8 py-5 text-xs font-medium text-on-surface-variant">{log.ip}</td>
                              <td className="px-8 py-5">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${log.action === 'login' ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'}`}>
                                  Concluído
                                </span>
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={4} className="px-8 py-10 text-center text-xs font-bold text-on-surface-variant italic">
                                Nenhum registro de acesso encontrado.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'preferencias' && (
              <section className="bg-surface-container-lowest p-8 md:p-10 rounded-[48px] border border-surface-container-high shadow-lg space-y-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Bell size={20} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em]">{t.notifications}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary border-b border-primary/10 pb-2">Canais de Notificação</h4>
                    <div className="space-y-6">
                      {[
                        { key: 'emailNotifications', icon: Mail, label: t.emailNotifications, sub: 'Status de chamados, alertas de SLA e novos documentos' },
                        { key: 'whatsappNotifications', icon: Smartphone, label: t.whatsappNotifications, sub: 'Alertas críticos, técnico em deslocamento e preventivas' },
                        { key: 'pushNotifications', icon: Bell, label: t.pushNotifications, sub: 'Notificações instantâneas no seu navegador e celular' }
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between gap-4 p-4 rounded-3xl hover:bg-surface-container-low transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-primary/5 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                              <item.icon size={18} />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">{item.label}</p>
                              <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60 leading-tight max-w-[180px]">
                                {item.sub}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleUpdatePreference(item.key, !(user.preferences as any)?.[item.key])}
                            className={`w-12 h-6 rounded-full relative transition-all duration-300 ${(user.preferences as any)?.[item.key] ? 'bg-primary' : 'bg-surface-container-high'}`}
                          >
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${(user.preferences as any)?.[item.key] ? 'left-6.5' : 'left-0.5'}`} />
                          </button>
                        </div>
                      ))}

                      {user.preferences?.whatsappNotifications && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-2 px-4 space-y-3"
                        >
                          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-800/30">
                            <Smartphone size={14} className="text-green-600" />
                            <input 
                              type="text" 
                              placeholder="Validar WhatsApp (Ex: 11999999999)"
                              defaultValue={user.telefone}
                              className="bg-transparent border-none text-[10px] font-bold text-green-700 outline-none w-full"
                            />
                            <button className="px-3 py-1 bg-green-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-green-700 transition-all flex items-center gap-1">
                              <Send size={10} /> Testar
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary border-b border-primary/10 pb-2">Sistema & Interface</h4>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                          <Languages size={14} className="text-primary" /> {t.language}
                        </label>
                        <select 
                          value={lang}
                          onChange={(e) => handleUpdatePreference('language', e.target.value)}
                          className="w-full px-5 py-4 bg-surface border border-surface-container-high rounded-2xl text-xs font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                        >
                          <option value="pt-BR">Português (Brasil)</option>
                          <option value="en">English (Global)</option>
                          <option value="es">Español (Latino)</option>
                        </select>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                          <Moon size={14} className="text-primary" /> {t.theme}
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: 'light', icon: Sun, label: t.light },
                            { id: 'dark', icon: Moon, label: t.dark },
                            { id: 'system', icon: Laptop, label: t.system }
                          ].map((item) => (
                            <button
                              key={item.id}
                              onClick={() => handleUpdatePreference('theme', item.id)}
                              className={`py-4 rounded-[24px] border flex flex-col items-center gap-2 transition-all group ${
                                theme === item.id
                                  ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                                  : 'bg-surface-container-lowest border-surface-container-high text-on-surface-variant hover:border-primary/40'
                              }`}
                            >
                              <item.icon size={18} className={theme === item.id ? 'text-white' : 'text-primary'} />
                              <span className="text-[9px] font-black uppercase tracking-widest">
                                {item.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'contrato' && (
              <section className="bg-surface-container-lowest p-8 md:p-10 rounded-[48px] border border-surface-container-high shadow-lg space-y-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <CreditCard size={20} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em]">{t.contract}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { icon: FileText, label: 'Plano Ativo', value: cliente?.slaConfig?.planName || 'Enterprise Platinum' },
                    { icon: Calendar, label: 'Vigência', value: cliente?.contratoVencimento || '12/12/2026' },
                    { icon: Clock, label: 'SLA Resposta', value: `${cliente?.slaConfig?.firstResponseHours || 4}h Úteis` }
                  ].map((item, i) => (
                    <div key={i} className="p-6 rounded-[32px] bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 flex flex-col items-center text-center gap-4 group hover:bg-blue-50 transition-colors">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-surface-container shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        <item.icon size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">{item.label}</p>
                        <p className="text-sm font-black text-on-surface">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 rounded-[40px] bg-surface-container-low border border-surface-container-high space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary border-b border-primary/10 pb-2">Cláusulas de Suporte</h4>
                    <div className="space-y-4">
                      {[
                        { label: 'Tipo de Suporte', value: cliente?.slaConfig?.supportType || 'Híbrido 24/7' },
                        { label: 'Franquia Técnica', value: 'Ilimitada' },
                        { label: 'Visitas Mensais', value: '02 Inclusas' },
                        { label: 'Multa Rescisória', value: 'Conforme Contrato' }
                      ].map((detail, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                          <span className="text-on-surface-variant opacity-60">{detail.label}</span>
                          <span className="text-on-surface">{detail.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-8 rounded-[40px] bg-surface-container-highest/20 border border-surface-container-high flex flex-col justify-center items-center text-center gap-6 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                    <div className="relative space-y-2">
                       <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant leading-relaxed">Visualize seu instrumento contratual <br /> completo em PDF assinado.</p>
                    </div>
                    <button className="relative px-8 py-4 bg-primary text-white rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/30">
                      <ArrowUpRight size={16} /> Ver Contrato (PDF)
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-8">
            <section className="bg-surface-container-lowest p-8 rounded-[48px] border border-surface-container-high shadow-lg space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <Users size={18} />
                  <h3 className="text-[10px] font-black uppercase tracking-widest">{t.contacts}</h3>
                </div>
                <button 
                  onClick={() => {
                    setEditingContact(null);
                    setShowContactModal(true);
                  }}
                  className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-lg shadow-primary/20"
                >
                  <Plus size={16} />
                </button>
              </div>
              
              <div className="space-y-4">
                {authorizedContacts.map(contact => (
                  <div key={contact.id} className="group relative flex items-center gap-3 p-4 rounded-3xl bg-surface-container-low border border-surface-container-high transition-all hover:border-primary">
                    <div className="w-10 h-10 rounded-2xl bg-surface-container-highest flex items-center justify-center overflow-hidden border-2 border-surface shadow-sm">
                      {contact.photoURL ? (
                        <img src={contact.photoURL} alt={contact.nome} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-black uppercase text-primary/40">{contact.nome.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface truncate">{contact.nome}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-[8px] font-black uppercase tracking-widest text-primary/60 border border-surface-container-high">
                          {contact.contatoTipo || 'TI'}
                        </span>
                        <p className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest opacity-50 truncate">
                          {contact.cargo || 'Responsável'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all"><Edit2 size={12} /></button>
                      <button className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-primary p-8 md:p-10 rounded-[48px] shadow-2xl relative overflow-hidden group perspective-1000">
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, 0]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" 
              />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full -ml-16 -mb-16 blur-2xl" />
              
              <div className="relative space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-white">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Headset size={28} className="animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base font-black uppercase tracking-widest">{t.support}</h3>
                      <p className="text-[10px] font-bold text-white/70 uppercase tracking-tight">Central técnica especializada Mundo Tech</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 rounded-full border border-green-500/30 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-green-400">Online</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {[
                    { 
                      icon: Smartphone, 
                      label: 'WhatsApp Direto', 
                      value: '(41) 99658-5672', 
                      link: 'https://wa.me/5541996585672',
                      color: 'hover:bg-[#25D366]/20 group/wa'
                    },
                    { 
                      icon: Mail, 
                      label: 'E-mail Corporativo', 
                      value: 'suporte@mundotechequipamentos.com.br', 
                      link: 'mailto:suporte@mundotechequipamentos.com.br',
                      color: 'hover:bg-white/10 group/mail'
                    }
                  ].map((item, i) => (
                    <motion.a 
                      key={i} 
                      href={item.link} 
                      target="_blank" 
                      rel="noreferrer" 
                      whileHover={{ x: 5, scale: 1.02 }}
                      className={`flex items-center gap-4 p-5 rounded-[32px] bg-black/10 text-white border border-white/5 transition-all backdrop-blur-sm ${item.color}`}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                        <item.icon size={20} className="group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-0.5">{item.label}</p>
                        <p className="text-xs font-black truncate">{item.value}</p>
                      </div>
                    </motion.a>
                  ))}
                </div>

                <motion.button 
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onNavigate?.('novo-chamado')}
                  className="w-full py-6 bg-white text-primary rounded-[32px] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-black/20 hover:shadow-white/10 transition-all relative overflow-hidden group/btn"
                >
                  <div className="absolute inset-0 bg-primary opacity-0 group-hover/btn:opacity-[0.03] transition-opacity" />
                  <span className="relative flex items-center justify-center gap-3">
                    {t.openTicket}
                    <ArrowUpRight size={16} />
                  </span>
                </motion.button>
              </div>
            </section>

            {message && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-6 rounded-[32px] text-xs font-bold flex items-center gap-3 shadow-lg border ${
                  message.type === 'success' ? 'bg-green-500/10 border-green-500 text-green-700' : 'bg-red-500/10 border-red-500 text-red-700'
                }`}
              >
                {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                {message.text}
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Authorized Contact Modal */}
      <AnimatePresence>
        {showContactModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowContactModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-surface-container-lowest rounded-[48px] border border-surface-container-high shadow-2xl p-10 space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black uppercase tracking-tight text-on-surface">{t.addContact}</h2>
                <button onClick={() => setShowContactModal(false)} className="p-3 rounded-2xl hover:bg-surface-container-high transition-colors"><X size={20} /></button>
              </div>

              <form className="space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                handleCreateContact({
                  nome: fd.get('nome'),
                  email: fd.get('email'),
                  telefone: fd.get('phone'),
                  cargo: fd.get('cargo'),
                  contatoTipo: fd.get('tipo'),
                  permissoes: {
                    abrirChamado: true,
                    visualizarChamados: true,
                    receberNotificacoes: true,
                    visualizarDocumentos: true
                  }
                });
              }}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome Completo</label>
                    <input name="nome" required className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">E-mail</label>
                    <input name="email" type="email" required className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Telefone</label>
                    <input name="phone" className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Cargo</label>
                    <input name="cargo" className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Tipo de Contato</label>
                    <select name="tipo" className="w-full px-6 py-4 bg-surface border border-surface-container-high rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                      <option value="TI">TI</option>
                      <option value="RH">RH</option>
                      <option value="Portaria">Portaria</option>
                      <option value="Compras">Compras</option>
                      <option value="Administrativo">Administrativo</option>
                      <option value="Geral">Geral</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowContactModal(false)} className="flex-1 py-4 bg-surface-container-high text-on-surface rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-surface-container-highest transition-all">Cancelar</button>
                  <button type="submit" className="flex-2 py-4 bg-primary text-white rounded-3xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">Confirmar Cadastro</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-surface-container-lowest rounded-[40px] border border-surface-container-high shadow-2xl p-10 space-y-8"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center">
                  <Lock size={32} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight text-on-surface">Redefinir Senha</h2>
                <p className="text-xs text-on-surface-variant font-bold leading-relaxed">
                  Por segurança, enviaremos um link de redefinição para o seu email: <br />
                  <span className="text-primary">{user.email}</span>
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    try {
                      await databaseService.resetUserPassword(user.email);
                      setShowPasswordModal(false);
                      showMessage('success', 'Link enviado com sucesso!');
                    } catch (e) {
                      showMessage('error', 'Erro ao enviar o link.');
                    }
                  }}
                  className="w-full py-5 bg-primary text-white rounded-3xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                >
                  Enviar Link Agora
                </button>
                <button onClick={() => setShowPasswordModal(false)} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-all">Cancelar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
