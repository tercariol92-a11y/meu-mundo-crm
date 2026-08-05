import { 
  LayoutDashboard, 
  Users, 
  Briefcase,
  Filter, 
  Headset, 
  Calendar, 
  Wrench, 
  Construction, 
  BarChart3, 
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Target,
  UserCheck,
  FileText,
  CalendarDays,
  Sparkles,
  UserPlus,
  Building2,
  Package,
  MessageSquare,
  BarChart,
  Zap,
  Repeat,
  Bell,
  Star,
  Search,
  Mail,
  RotateCcw,
  ShieldAlert,
  ListTodo,
  CheckSquare
} from 'lucide-react';
import { ViewType, User, Usuario } from '../types';
import { databaseService } from '../services/databaseService';
import { useState, useMemo } from 'react';
import ConfirmationModal from './ConfirmationModal';
import { useCompanyConfig } from '../hooks/useCompanyConfig';
import Logo from './Logo';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  user: Usuario;
}

export default function Sidebar({ currentView, onViewChange, user }: SidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const { companyConfig } = useCompanyConfig();

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId) 
        : [...prev, sectionId]
    );
  };

  const handleLogout = async () => {
    try {
      await databaseService.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const menuItems = useMemo(() => {
    const isAdmin = user.role === 'admin';
    const perms = user.permissions;

    const items = [
      { 
        id: 'dashboard', 
        label: 'Dashboard Geral', 
        icon: BarChart3,
        show: isAdmin || perms?.viewDashboard 
      },
      { 
        id: 'vendedor-dashboard', 
        label: 'Meu Dashboard', 
        icon: LayoutDashboard,
        show: true 
      },
      { 
        id: 'atendimento', 
        label: 'Atendimento', 
        icon: MessageSquare,
        show: isAdmin || perms?.viewAtendimento
      },
      { 
        id: 'assistencia-tecnica', 
        label: 'Assistência Técnica', 
        icon: Wrench,
        show: isAdmin || perms?.viewAssistenciaTecnica
      },
      { 
        id: 'satisfacao', 
        label: 'Satisfação', 
        icon: Star,
        show: isAdmin || perms?.viewRelatorios
      },
      { 
        id: 'gemini-assistant', 
        label: 'Assistente IA', 
        icon: Sparkles,
        show: true
      },
      {
        id: 'gestao',
        label: 'Gestão',
        icon: ListTodo,
        show: isAdmin || perms?.viewGestaoTarefas !== false,
        subItems: [
          { id: 'gestao-tarefas', label: 'Gestão de Tarefas', icon: CheckSquare, show: true }
        ]
      },
      {
        id: 'rh',
        label: 'RH',
        icon: Briefcase,
        show: isAdmin || perms?.viewCadastro,
        subItems: [
          { id: 'rh-cargos-perfis', label: 'Cargos e Perfis', icon: Users, show: true }
        ]
      },
      { 
        id: 'cadastro', 
        label: 'Cadastro', 
        icon: UserPlus,
        show: isAdmin || perms?.viewCadastro,
        subItems: [
          { id: 'comercial-configuracao-empresa', label: 'Dados da Empresa', icon: Building2, show: isAdmin },
          { id: 'user-management', label: 'Configurações de Usuários', icon: Users, show: isAdmin },
          { id: 'integracao-bling', label: 'Integração Bling', icon: Zap, show: isAdmin || perms?.viewBling },
          { id: 'comercial-clientes', label: 'Clientes', icon: UserCheck, show: isAdmin || perms?.viewClientes },
          { id: 'comercial-produtos', label: 'Produtos', icon: Package, show: isAdmin || perms?.viewProdutos },
        ].filter(i => i.show)
      },
      { 
        id: 'comercial', 
        label: 'Comercial', 
        icon: Target,
        show: isAdmin || perms?.viewComercial,
        subItems: [
          { id: 'comercial-dashboard', label: 'Dashboard Comercial', icon: BarChart3, show: isAdmin || perms?.viewDashboard },
          { id: 'retornos', label: 'Retornos Pendentes', icon: Repeat, show: isAdmin || perms?.viewComercial },
          { id: 'comercial-leads', label: 'Leads', icon: Target, show: isAdmin || perms?.viewPipeline },
          { id: 'comercial-orcamentos', label: 'Orçamentos', icon: FileText, show: isAdmin || perms?.viewOrcamentos },
          { id: 'comercial-pipeline', label: 'Pipeline de Vendas', icon: Filter, show: isAdmin || perms?.viewPipeline },
          { id: 'comercial-motivos-perda', label: 'Motivos de Perda', icon: Filter, show: isAdmin },
          { id: 'comercial-acoes', label: 'Ações Comerciais', icon: Sparkles, show: isAdmin || perms?.viewComercial },
          { id: 'comercial-agenda', label: 'Agenda Comercial', icon: CalendarDays, show: isAdmin || perms?.viewComercial },
        ].filter(i => i.show)
      },
      { 
        id: 'prospeccao', 
        label: 'Prospecção', 
        icon: Search,
        show: isAdmin || perms?.viewComercial,
        subItems: [
          { id: 'prospeccao-buscar', label: 'Buscar Empresas', icon: Search, show: true },
          { id: 'prospeccao-leads', label: 'Leads Capturados', icon: Building2, show: true },
          { id: 'prospeccao-campanhas', label: 'Campanhas', icon: BarChart3, show: true },
          { id: 'prospeccao-whatsapp', label: 'WhatsApp', icon: MessageSquare, show: true },
          { id: 'prospeccao-emails', label: 'E-mails', icon: Mail, show: true },
          { id: 'prospeccao-automacao', label: 'Automação', icon: Zap, show: true },
          { id: 'prospeccao-historico', label: 'Histórico', icon: RotateCcw, show: true },
        ]
      },
      { 
        id: 'financeiro', 
        label: 'Financeiro', 
        icon: BarChart,
        show: isAdmin || perms?.viewFinanceiro,
        subItems: [
          { id: 'financeiro-contas-pagar', label: 'Contas a Pagar', icon: FileText, show: true },
          { id: 'financeiro-faturamento', label: 'Faturamento & Notas', icon: FileText, show: true },
          { id: 'financeiro-contratos', label: 'Contratos', icon: Briefcase, show: true }
        ]
      },
      { 
        id: 'suporte', 
        label: 'Suporte', 
        icon: Headset,
        show: isAdmin || perms?.viewAssistenciaTecnica,
        subItems: [
          { id: 'suporte-dashboard', label: 'Dashboard Suporte', icon: BarChart3, show: true },
          { id: 'chamados', label: 'Chamados', icon: Headset, show: true },
          { id: 'equipamentos-pendentes', label: 'Equipamentos Pendentes', icon: ShieldAlert, show: isAdmin || perms?.viewAssistenciaTecnica },
          { id: 'tecnicos', label: 'Técnicos', icon: Wrench, show: isAdmin },
          { id: 'unidades', label: 'Unidades', icon: Building2, show: true },
        ].filter(i => i.show)
      },
    ];

    return items.filter(i => i.show);
  }, [user]);

  return (
    <aside className="h-screen w-52 fixed left-0 top-0 border-r border-surface-container-high bg-surface-container-low flex flex-col py-6 gap-2 z-50">
      <div className="px-6 mb-8">
        <Logo showText />
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto">
        {menuItems.map((item) => {
          if (item.subItems) {
            const isExpanded = expandedSections.includes(item.id) || 
                              currentView.startsWith(item.id + '-') || 
                              (item.id === 'cadastro' && (currentView === 'comercial-clientes' || currentView === 'comercial-produtos' || currentView === 'comercial-funcionarios' || currentView === 'comercial-configuracao-empresa')) ||
                              (item.id === 'financeiro' && (currentView === 'financeiro-contas-pagar' || currentView === 'financeiro-faturamento' || currentView === 'financeiro-contratos')) ||
                              (item.id === 'gestao' && currentView === 'gestao-tarefas') ||
                              (item.id === 'rh' && currentView === 'rh-cargos-perfis') ||
                              (item.id === 'suporte' && (currentView === 'suporte-dashboard' || currentView === 'chamados' || currentView === 'tecnicos' || currentView === 'unidades'));
            
            return (
              <div key={item.id} className="flex flex-col gap-1">
                <button
                  onClick={() => toggleSection(item.id)}
                  className={`flex items-center justify-between w-full px-3 py-2.5 transition-all duration-200 group rounded-lg ${
                    isExpanded
                      ? 'bg-primary/5 text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={20} />
                    <span className="text-xs tracking-wide uppercase font-semibold">{item.label}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                
                {isExpanded && (
                  <div className="flex flex-col gap-1 ml-4 pl-4 border-l border-surface-container-high animate-in slide-in-from-top-2 duration-200">
                    {item.subItems.map((subItem) => {
                      const isSelected = currentView === subItem.id;
                      return (
                        <button
                          key={subItem.id}
                          onClick={() => onViewChange(subItem.id as ViewType)}
                          className={`flex items-center gap-3 px-3 py-2 transition-all duration-200 group rounded-lg ${
                            isSelected
                              ? 'text-primary font-bold'
                              : 'text-on-surface-variant hover:text-primary'
                          }`}
                        >
                          <subItem.icon size={16} />
                          <span className="text-[11px] tracking-wide uppercase">{subItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isSelected = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as ViewType)}
              className={`flex items-center gap-3 px-3 py-2.5 transition-all duration-200 group rounded-lg ${
                isSelected
                  ? 'bg-primary-fixed text-primary border-r-4 border-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <item.icon size={20} />
              <span className="text-xs tracking-wide uppercase font-semibold">{item.label}</span>
            </button>
          );
        })}

        <div className="mt-auto border-t border-surface-container-high pt-4">
          <button
            onClick={() => onViewChange('configuracoes')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-200 group rounded-lg ${
              currentView === 'configuracoes'
                ? 'bg-primary-fixed text-primary border-r-4 border-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <Settings size={20} />
            <span className="text-xs tracking-wide uppercase font-semibold">Configurações</span>
          </button>
          
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-200 text-error hover:bg-error/10 rounded-lg"
          >
            <LogOut size={20} />
            <span className="text-xs tracking-wide uppercase font-semibold">Sair</span>
          </button>
        </div>
      </nav>

      <ConfirmationModal 
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Sair da Conta"
        message="Deseja realmente sair do sistema?"
        confirmText="Sair"
        cancelText="Voltar"
      />

      <div className="px-6 mt-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-lowest shadow-sm">
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-surface-container-high bg-[#dfe5e7] flex items-center justify-center text-[#54656f]">
            <img 
              className="w-full h-full object-cover" 
              src={user.photoURL || 'https://ui-avatars.com/api/?name=M+T&background=2563eb&color=fff&bold=true&size=64'} 
              alt={user.nome || 'Usuário'}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.querySelector('.avatar-initial')?.classList.remove('hidden');
              }}
            />
            <span className="avatar-initial font-bold text-[10px] hidden">{user.nome?.charAt(0) || '?'}</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-bold text-primary truncate uppercase tracking-tighter">{user.nome || 'Usuário'}</p>
            <p className="text-[9px] text-on-surface-variant truncate">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
