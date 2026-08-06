import React, { useState, useEffect } from 'react';
import { 
  Usuario, 
  UserRole, 
  User as UserType, 
  UserPermissions,
  CargoEPerfil,
  VinculoCargoUsuario
} from '../../types';
import { useGlobalData } from '../../contexts/GlobalDataContext';
import { databaseService } from '../../services/databaseService';
import { cargosService } from '../../services/cargosService';
import ConfirmationModal from '../ConfirmationModal';
import { 
  Plus, 
  Search, 
  X, 
  Save, 
  Trash2, 
  Edit2, 
  User as UserIcon,
  Shield,
  Mail,
  Loader2,
  CheckCircle2,
  Key,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  ChevronDown,
  DollarSign,
  Target,
  Eye,
  Settings,
  Lock,
  Unlock,
  AlertCircle,
  Briefcase,
  Star,
  Check,
  CheckSquare,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UserManagement({ user }: { user: UserType }) {
  const { usuarios: users, loading, refreshData } = useGlobalData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('basic');
  const [isEditingMode, setIsEditingMode] = useState(false);

  // Search filter for available cargos dropdown
  const [cargoSearchQuery, setCargoSearchQuery] = useState('');

  // States for password change feature
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [cargosList, setCargosList] = useState<CargoEPerfil[]>([]);

  useEffect(() => {
    const unsub = cargosService.subscribeCargos((data) => setCargosList(data));
    return () => unsub();
  }, []);

  const isLocalAdmin = user.role === 'admin' || (user as any).roles?.includes('admin');
  const canEditCommissions = isLocalAdmin || (user as any).permissions?.editComissao;

  const [formData, setFormData] = useState<Partial<Usuario & { password?: string }>>({
    nome: '',
    email: '',
    role: 'vendedor',
    roles: ['vendedor'],
    ativo: true,
    password: '',
    receivesCommission: false,
    commissionType: 'none',
    commissionRate: 0,
    commissionProductRate: 0,
    commissionServiceRate: 0,
    commissionMonthlyRate: 0,
    commissionAnnualRate: 0,
    commissionFixedValue: 0,
    monthlyGoal: 0,
    canViewCommission: false,
    cargosVinculados: [],
    permissions: databaseService.getDefaultPermissionsForRole(['vendedor'])
  });

  const fetchUsers = async () => {
    // refreshData handles fetching via onSnapshot in GlobalDataContext
    await refreshData('usuarios');
  };

  const handleOpenModal = (u?: Usuario) => {
    setCargoSearchQuery('');
    if (u) {
      setEditingUser(u);
      setIsEditingMode(false); // Start in view mode for existing users
      const normalizedCargos = cargosService.normalizeUserCargos(u);
      const { mergedPermissions } = cargosService.calculateCumulativePermissions(normalizedCargos, cargosList, u.permissions);

      const primaryVinculo = normalizedCargos.find(v => v.isPrimary);

      setFormData({ 
        ...u, 
        password: '',
        cargoId: primaryVinculo?.cargoId || u.cargoId,
        cargoNome: primaryVinculo?.cargoNome || u.cargoNome,
        cargosVinculados: normalizedCargos,
        roles: u.roles || [u.role],
        receivesCommission: u.receivesCommission || (u.tipoComissao && u.tipoComissao !== 'nenhuma') || false,
        commissionType: u.commissionType || (u.tipoComissao === 'percentual' ? 'percent' : u.tipoComissao === 'fixo' ? 'fixed' : 'none'),
        commissionRate: u.commissionRate || u.comissaoPadrao || 0,
        commissionProductRate: u.commissionProductRate ?? u.commissionRate ?? u.comissaoPadrao ?? 0,
        commissionServiceRate: u.commissionServiceRate ?? u.commissionRate ?? u.comissaoPadrao ?? 0,
        commissionMonthlyRate: u.commissionMonthlyRate ?? u.commissionRate ?? u.comissaoPadrao ?? 0,
        commissionAnnualRate: u.commissionAnnualRate ?? u.commissionRate ?? u.comissaoPadrao ?? 0,
        commissionFixedValue: u.commissionFixedValue || u.valorFixoComissao || 0,
        monthlyGoal: u.monthlyGoal || u.metaMensal || 0,
        canViewCommission: u.canViewCommission !== undefined ? u.canViewCommission : (u.podeVerComissao !== undefined ? u.podeVerComissao : false),
        permissions: mergedPermissions
      });
    } else {
      setEditingUser(null);
      setIsEditingMode(true); // Start in edit mode for new users
      setFormData({
        nome: '',
        email: '',
        role: 'vendedor',
        roles: ['vendedor'],
        ativo: true,
        password: '',
        receivesCommission: false,
        commissionType: 'none',
        commissionRate: 0,
        commissionProductRate: 0,
        commissionServiceRate: 0,
        commissionMonthlyRate: 0,
        commissionAnnualRate: 0,
        commissionFixedValue: 0,
        monthlyGoal: 0,
        canViewCommission: false,
        cargosVinculados: [],
        permissions: databaseService.getDefaultPermissionsForRole(['vendedor'])
      });
    }
    setIsModalOpen(true);
  };

  // Cargo Multi-select helper functions
  const handleAddCargoToUser = (cargoId: string) => {
    const selectedCargo = cargosList.find(c => c.id === cargoId);
    if (!selectedCargo) return;

    const currentVinculos = formData.cargosVinculados || [];
    if (currentVinculos.some(v => v.cargoId === cargoId)) return;

    const isFirstCargo = currentVinculos.length === 0;
    const newVinculo: VinculoCargoUsuario = {
      cargoId: selectedCargo.id,
      cargoNome: selectedCargo.nome,
      isPrimary: isFirstCargo,
      assignedAt: new Date().toISOString()
    };

    const updatedVinculos = [...currentVinculos, newVinculo];
    const primaryVinculo = updatedVinculos.find(v => v.isPrimary) || updatedVinculos[0];

    const { mergedPermissions } = cargosService.calculateCumulativePermissions(updatedVinculos, cargosList, formData.permissions);

    setFormData({
      ...formData,
      cargoId: primaryVinculo.cargoId,
      cargoNome: primaryVinculo.cargoNome,
      cargosVinculados: updatedVinculos,
      permissions: mergedPermissions
    });
    setCargoSearchQuery('');
  };

  const handleRemoveCargoFromUser = (cargoId: string) => {
    const currentVinculos = formData.cargosVinculados || [];
    const filtered = currentVinculos.filter(v => v.cargoId !== cargoId);

    if (filtered.length > 0 && !filtered.some(v => v.isPrimary)) {
      filtered[0].isPrimary = true;
    }

    const primaryVinculo = filtered.find(v => v.isPrimary);
    const { mergedPermissions } = cargosService.calculateCumulativePermissions(filtered, cargosList, formData.permissions);

    setFormData({
      ...formData,
      cargoId: primaryVinculo?.cargoId || '',
      cargoNome: primaryVinculo?.cargoNome || '',
      cargosVinculados: filtered,
      permissions: mergedPermissions
    });
  };

  const handleSetPrimaryCargo = (cargoId: string) => {
    const currentVinculos = formData.cargosVinculados || [];
    const updated = currentVinculos.map(v => ({
      ...v,
      isPrimary: v.cargoId === cargoId
    }));

    const primaryVinculo = updated.find(v => v.isPrimary);
    const { mergedPermissions } = cargosService.calculateCumulativePermissions(updated, cargosList, formData.permissions);

    setFormData({
      ...formData,
      cargoId: primaryVinculo?.cargoId || '',
      cargoNome: primaryVinculo?.cargoNome || '',
      cargosVinculados: updated,
      permissions: mergedPermissions
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setMessage(null);
  };

  const handlePermissionChange = (key: keyof UserPermissions, value: boolean) => {
    if (!formData.permissions) return;
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [key]: value
      }
    });
  };

  const handleRoleToggle = (role: UserRole) => {
    const currentRoles = formData.roles || [];
    let newRoles: UserRole[];
    
    if (currentRoles.includes(role)) {
      if (currentRoles.length === 1) return; // Must have at least one role
      newRoles = currentRoles.filter(r => r !== role);
    } else {
      newRoles = [...currentRoles, role];
    }

    setFormData({
      ...formData,
      role: newRoles[0], // Use first as primary
      roles: newRoles,
      permissions: databaseService.getDefaultPermissionsForRole(newRoles)
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.email) return;

    // Commission Validations
    if (formData.receivesCommission) {
      if (!formData.monthlyGoal || formData.monthlyGoal <= 0) {
        setMessage({ type: 'error', text: 'A meta mensal é obrigatória se houver comissão habilitada.' });
        setExpandedSection('commissions');
        return;
      }
      
      if (formData.commissionType === 'percent') {
        const pct = formData.commissionRate || 0;
        if (pct < 0 || pct > 100) {
          setMessage({ type: 'error', text: 'O percentual de comissão deve estar entre 0 e 100%.' });
          setExpandedSection('commissions');
          return;
        }
      }

      if (formData.commissionType === 'fixed') {
        if (!formData.commissionFixedValue || formData.commissionFixedValue <= 0) {
          setMessage({ type: 'error', text: 'O valor fixo da comissão deve ser maior que zero.' });
          setExpandedSection('commissions');
          return;
        }
      }
    } else {
      // Ensure values are reset if commission is disabled
      formData.commissionType = 'none';
      formData.commissionRate = 0;
      formData.commissionFixedValue = 0;
      formData.monthlyGoal = 0;
      formData.canViewCommission = false;
    }

    try {
      setIsSaving(true);
      if (editingUser) {
        // Ensure meta is set if commission is enabled
        const updateData = { ...formData };
        if (updateData.receivesCommission && (!updateData.monthlyGoal || updateData.monthlyGoal <= 0)) {
           // Meta will be validated above, but just in case
        }

        await databaseService.updateUsuario(editingUser.id, updateData);

        if (updateData.cargosVinculados && updateData.cargosVinculados.length > 0) {
          try {
            await cargosService.vincularMultiplosCargosAUsuario(
              editingUser.id,
              updateData.cargosVinculados,
              editingUser.nome || formData.nome || '',
              cargosList,
              user.nome,
              updateData.permissions
            );
          } catch (e) {
            console.error("Error triggering multi-cargo binding side effects:", e);
          }
        }

        setMessage({ type: 'success', text: 'Dados e múltiplos cargos salvos com sucesso!' });
        
        setTimeout(() => {
          setIsEditingMode(false);
          setMessage(null);
        }, 1500);
      } else {
        if (!formData.password || formData.password.length < 6) {
          setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
          return;
        }

        const existing = users.find(u => u.email.toLowerCase() === formData.email?.toLowerCase());
        if (existing) {
          setMessage({ type: 'error', text: 'Já existe um usuário com este email.' });
          return;
        }

        const { password, ...userData } = formData;
        await databaseService.adminCreateUser(formData.email, password!, userData as Omit<Usuario, 'id' | 'createdAt' | 'updatedAt'>);
        setMessage({ type: 'success', text: 'Usuário cadastrado com sucesso!' });
      }
      await fetchUsers();
      setTimeout(() => handleCloseModal(), 1500);
    } catch (error: any) {
      console.error('Error saving user:', error);
      let errorMsg = 'Erro ao salvar usuário.';
      if (error.code === 'auth/email-already-in-use') errorMsg = 'Este email já está em uso.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    
    try {
      setIsDeleting(true);
      await databaseService.deleteUsuario(confirmDelete);
      setConfirmDelete(null);
      setMessage({ type: 'success', text: 'Usuário removido com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting user:', error);
      setMessage({ type: 'error', text: 'Erro ao excluir usuário.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const permissionGroups = [
    {
      title: 'Módulos e Visualização',
      permissions: [
        { key: 'viewDashboard', label: 'Visualizar Dashboard' },
        { key: 'viewAtendimento', label: 'Visualizar Atendimento' },
        { key: 'viewAssistenciaTecnica', label: 'Visualizar Assistência Técnica' },
        { key: 'viewCadastro', label: 'Visualizar Cadastro' },
        { key: 'viewComercial', label: 'Visualizar Comercial' },
        { key: 'viewClientes', label: 'Visualizar Clientes' },
        { key: 'viewProdutos', label: 'Visualizar Produtos' },
        { key: 'viewOrcamentos', label: 'Visualizar Orçamentos' },
        { key: 'viewPipeline', label: 'Visualizar Pipeline de Vendas' },
        { key: 'viewBling', label: 'Visualizar Integração Bling' },
      ]
    },
    {
      title: 'Ações de Orçamento/Venda',
      permissions: [
        { key: 'createOrcamento', label: 'Criar Orçamento' },
        { key: 'editOrcamento', label: 'Editar Orçamento' },
        { key: 'deleteOrcamento', label: 'Excluir Orçamento' },
        { key: 'alterarVendedor', label: 'Alterar Vendedor da Venda' },
        { key: 'alterarStatusVenda', label: 'Alterar Status da Venda' },
      ]
    },
    {
      title: 'Financeiro e Relatórios',
      permissions: [
        { key: 'viewFinanceiro', label: 'Visualizar Valores Financeiros' },
        { key: 'viewLucro', label: 'Visualizar Lucros e Margens' },
        { key: 'viewComissao', label: 'Visualizar Comissão' },
        { key: 'editComissao', label: 'Editar % de Comissão' },
        { key: 'viewRelatorios', label: 'Visualizar Relatórios' },
        { key: 'exportRelatorios', label: 'Exportar Relatórios' },
      ]
    }
  ];

  const roles: { value: UserRole; label: string; desc: string }[] = [
    { value: 'admin', label: 'Administrador', desc: 'Acesso total ao sistema' },
    { value: 'vendedor', label: 'Vendedor', desc: 'Comercial e CRM' },
    { value: 'suporte', label: 'Suporte', desc: 'Atendimento ao Cliente' },
    { value: 'tecnico', label: 'Técnico', desc: 'Chamados e Equipamentos' },
    { value: 'financeiro', label: 'Financeiro', desc: 'Faturamento e Cobrança' },
    { value: 'gerente_comercial', label: 'Gerente Comercial', desc: 'Gestão da equipe de vendas' }
  ];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-[calc(100vh-64px)] custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-on-surface">Configurações de Usuários</h1>
          <p className="text-sm text-on-surface-variant font-bold uppercase tracking-widest">Gestão de acessos, permissões e comissionamento</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
        >
          <Plus size={18} />
          Criar Novo Usuário
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          className="w-full pl-12 pr-4 py-3 bg-surface-container-low border border-surface-container-high rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-surface-container-low rounded-[2.5rem] border border-surface-container-high overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/30 border-b border-surface-container-high">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Usuário</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Cargos e Perfis RH</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tipo / Acesso</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Comissão</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-primary mx-auto" size={32} />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                      <UserIcon size={48} className="opacity-10" />
                      <p className="font-bold uppercase text-xs tracking-widest">Nenhum usuário encontrado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-container-highest/10 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#dfe5e7] flex items-center justify-center text-[#54656f] font-black border border-primary/10 shadow-inner overflow-hidden">
                          <img 
                            src={u.photoURL || 'https://ui-avatars.com/api/?name=M+T&background=2563eb&color=fff&bold=true&size=128'} 
                            alt={u.nome} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement?.querySelector('.avatar-initial')?.classList.remove('hidden');
                            }}
                          />
                          <span className="avatar-initial hidden">{u.nome?.charAt(0) || '?'}</span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-on-surface uppercase tracking-tight">{u.nome}</p>
                          <p className="text-[10px] text-on-surface-variant font-bold">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const vinculos = cargosService.normalizeUserCargos(u);
                        if (vinculos.length === 0) {
                          return <span className="text-[10px] text-on-surface-variant/40 uppercase font-bold">Nenhum Cargo</span>;
                        }
                        return (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {vinculos.map((v) => (
                              <span
                                key={v.cargoId}
                                className={`px-2 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 border ${
                                  v.isPrimary 
                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' 
                                    : 'bg-surface-container-highest text-on-surface-variant border-surface-container-high'
                                }`}
                              >
                                {v.isPrimary && <Star size={10} className="fill-amber-500 text-amber-500 shrink-0" />}
                                {v.cargoNome}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        <Shield size={14} className="text-primary shrink-0 mt-1" />
                        {(u.roles || [u.role]).map((r, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-surface-container-highest text-[8px] font-black uppercase tracking-widest border border-surface-container-high whitespace-nowrap">
                            {roles.find(role => role.value === r)?.label || r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-1.5 ${u.ativo ? 'text-green-600' : 'text-on-surface-variant opacity-60'}`}>
                        {u.ativo ? <CheckCircle2 size={14} /> : <X size={14} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.receivesCommission || u.tipoComissao === 'percentual' || u.tipoComissao === 'fixo' ? (
                        <div className="flex items-center gap-1 text-[10px] font-black text-primary">
                          <DollarSign size={12} />
                          <span>
                            {u.commissionType === 'percent' || u.tipoComissao === 'percentual' 
                              ? `${u.commissionRate || u.comissaoPadrao || 0}%` 
                              : `R$ ${(u.commissionFixedValue || u.valorFixoComissao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant opacity-40 uppercase font-black">Sem comissão</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenModal(u)}
                          className="p-3 hover:bg-primary hover:text-white text-on-surface-variant rounded-2xl transition-all shadow-sm hover:shadow-lg hover:shadow-primary/20"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        {isLocalAdmin && u.id !== user.id && (
                          <button 
                            onClick={() => setConfirmDelete(u.id)}
                            className="p-3 hover:bg-error hover:text-white text-on-surface-variant rounded-2xl transition-all shadow-sm hover:shadow-lg hover:shadow-error/20"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-screen w-full max-w-xl bg-surface-container-low shadow-2xl z-[110] flex flex-col"
            >
              <div className="p-8 border-b border-surface-container-high flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-on-surface">
                    {editingUser ? 'Ficha do Usuário' : 'Novo Colaborador'}
                  </h2>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">
                    {editingUser ? editingUser.email : 'Configuração inicial de acesso'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {(isLocalAdmin || (user as any).permissions?.editComissao || user.role === 'admin') && !isEditingMode && (
                    <button
                      type="button"
                      onClick={() => setIsEditingMode(true)}
                      className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all border border-primary/20"
                    >
                      <Edit2 size={14} />
                      Editar Informações
                    </button>
                  )}
                  <button 
                    onClick={handleCloseModal}
                    className="p-3 hover:bg-surface-container-high rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSave} className={`flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar ${!isEditingMode && editingUser ? 'opacity-90' : ''}`}>
                {/* Visual indicator for edit mode */}
                {isEditingMode && canEditCommissions && editingUser && (
                  <div className="bg-primary/5 border border-primary/20 p-3 rounded-2xl flex items-center gap-2 text-primary">
                    <Edit2 size={14} className="shrink-0" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Você está em Modo de Edição</p>
                  </div>
                )}
                {/* Status Toggle */}
                <div className="flex items-center justify-between p-6 bg-surface-container-highest/10 rounded-[2rem] border border-surface-container-high">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${formData.ativo ? 'bg-green-100 text-green-600' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      {formData.ativo ? <Shield size={24} /> : <Shield size={24} className="opacity-40" />}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-on-surface">Status da Conta</p>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                        O usuário está {formData.ativo ? 'habilitado' : 'bloqueado'} para acessar o sistema
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!isEditingMode || !isLocalAdmin}
                    onClick={() => setFormData({ ...formData, ativo: !formData.ativo })}
                    className={`w-14 h-7 rounded-full relative transition-all ${formData.ativo ? 'bg-green-600 shadow-lg shadow-green-600/20' : 'bg-surface-container-high'} disabled:opacity-50`}
                  >
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${formData.ativo ? 'left-8' : 'left-1'}`} />
                  </button>
                </div>

                {/* Section: Basic Info */}
                <div className="space-y-4">
                  <button 
                    type="button"
                    onClick={() => setExpandedSection(expandedSection === 'basic' ? null : 'basic')}
                    className="w-full flex items-center justify-between py-2 border-b border-surface-container-high"
                  >
                    <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-[0.2em]">
                      <UserIcon size={14} />
                      Dados Identificadores
                    </div>
                    {expandedSection === 'basic' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  
                  {expandedSection === 'basic' && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome Completo</label>
                          <input
                            required
                            readOnly={!isEditingMode || !isLocalAdmin}
                            type="text"
                            className="w-full px-5 py-3.5 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 read-only:opacity-60"
                            value={formData.nome || ''}
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            placeholder="João da Silva"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Funções no Sistema (Multisseleção)</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {roles.map(r => {
                              const isSelected = (formData.roles || []).includes(r.value);
                              return (
                                <button
                                  key={r.value}
                                  type="button"
                                  disabled={!isEditingMode || !isLocalAdmin}
                                  onClick={() => handleRoleToggle(r.value)}
                                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center gap-1 ${
                                    isSelected 
                                      ? 'bg-primary/10 border-primary text-primary shadow-inner shadow-primary/10' 
                                      : 'bg-surface-container-highest/20 border-surface-container-high text-on-surface-variant'
                                  } disabled:opacity-60`}
                                >
                                  <span className="text-[10px] font-black uppercase tracking-tight">{r.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      {/* Multisseleção de Cargos e Perfis RH */}
                      <div className="space-y-3 p-4 bg-surface-container-highest/10 rounded-2xl border border-surface-container-high">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                            <Briefcase size={14} className="text-primary" />
                            Cargos e Perfis RH (Multisseleção)
                          </label>
                          <span className="text-[9px] font-bold text-on-surface-variant/70 uppercase">
                            {(formData.cargosVinculados || []).length} cargo(s) vinculado(s)
                          </span>
                        </div>

                        {/* Selected Cargo Chips */}
                        <div className="flex flex-wrap gap-2">
                          {(formData.cargosVinculados || []).length === 0 ? (
                            <div className="p-3 bg-surface-container-highest/20 rounded-xl border border-dashed border-surface-container-high w-full text-center">
                              <p className="text-[11px] font-bold text-on-surface-variant/70">Nenhum cargo vinculado ainda.</p>
                              <p className="text-[9px] text-on-surface-variant/50">Selecione um ou mais cargos abaixo para conceder permissões e metas.</p>
                            </div>
                          ) : (
                            (formData.cargosVinculados || []).map((v) => (
                              <div 
                                key={v.cargoId}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                                  v.isPrimary 
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20' 
                                    : 'bg-surface-container-highest/30 border-surface-container-high text-on-surface'
                                }`}
                              >
                                {v.isPrimary ? (
                                  <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-md shadow-xs">
                                    <Star size={10} className="fill-white" /> Principal
                                  </span>
                                ) : (
                                  isEditingMode && isLocalAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetPrimaryCargo(v.cargoId)}
                                      title="Definir como Cargo Principal"
                                      className="text-[9px] font-black uppercase tracking-wider text-amber-600 hover:text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-300/40 hover:bg-amber-100 transition-all"
                                    >
                                      Tornar Principal
                                    </button>
                                  )
                                )}

                                <span className="font-bold">{v.cargoNome}</span>

                                {isEditingMode && isLocalAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCargoFromUser(v.cargoId)}
                                    title="Remover cargo"
                                    className="p-1 hover:bg-red-500/10 text-on-surface-variant hover:text-red-600 rounded-lg transition-colors ml-1"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Search and Add Cargo Selector */}
                        {isEditingMode && isLocalAdmin && (
                          <div className="pt-2 border-t border-surface-container-high space-y-2">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
                              <input
                                type="text"
                                value={cargoSearchQuery}
                                onChange={(e) => setCargoSearchQuery(e.target.value)}
                                placeholder="Pesquisar cargo para adicionar..."
                                className="w-full pl-9 pr-3 py-2 bg-surface border border-surface-container-high rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
                              />
                            </div>

                            {/* Unselected Cargos Dropdown / Grid */}
                            <div className="max-h-36 overflow-y-auto space-y-1 custom-scrollbar pt-1">
                              {cargosList
                                .filter(c => 
                                  !formData.cargosVinculados?.some(v => v.cargoId === c.id) &&
                                  c.nome.toLowerCase().includes(cargoSearchQuery.toLowerCase())
                                )
                                .map(c => (
                                  <div
                                    key={c.id}
                                    onClick={() => handleAddCargoToUser(c.id)}
                                    className="flex items-center justify-between p-2 hover:bg-primary/10 rounded-xl cursor-pointer text-xs transition-colors border border-transparent hover:border-primary/20 group"
                                  >
                                    <div>
                                      <span className="font-bold text-on-surface group-hover:text-primary">{c.nome}</span>
                                      <span className="text-[10px] text-on-surface-variant ml-2 font-medium">({c.area})</span>
                                    </div>
                                    <span className="text-[9px] font-black uppercase text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                      <Plus size={12} /> Vincular
                                    </span>
                                  </div>
                                ))}

                              {cargosList.filter(c => !formData.cargosVinculados?.some(v => v.cargoId === c.id) && c.nome.toLowerCase().includes(cargoSearchQuery.toLowerCase())).length === 0 && (
                                <p className="text-[10px] text-on-surface-variant/60 text-center py-2">
                                  {cargoSearchQuery ? 'Nenhum cargo encontrado com esse nome.' : 'Todos os cargos disponíveis já estão vinculados.'}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {(formData.cargosVinculados || []).length > 0 && (
                          <div className="p-2.5 bg-primary/5 rounded-xl border border-primary/10 text-[10px] text-primary font-bold flex items-center gap-2">
                            <Sparkles size={14} className="shrink-0 text-primary" />
                            <span>
                              Este colaborador acumula permissões, checklists diários e treinamentos de <strong>{(formData.cargosVinculados || []).length} cargo(s)</strong> simultaneamente.
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Email Principal</label>
                        <input
                          required
                          readOnly={!!editingUser} // Email is immutable once created to maintain sync with Auth
                          type="email"
                          className={`w-full px-5 py-3.5 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 ${editingUser ? 'opacity-50' : ''}`}
                          value={formData.email || ''}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="email@mundotech.com.br"
                        />
                      </div>
                      {!editingUser && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Senha Provisória</label>
                          <input
                            required
                            type="text"
                            className="w-full px-5 py-3.5 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={formData.password || ''}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Mínimo 6 caracteres"
                          />
                        </div>
                      )}
                      {editingUser && isLocalAdmin && isEditingMode && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNewPassword('');
                              setConfirmNewPassword('');
                              setPasswordError(null);
                              setPasswordSuccess(null);
                              setIsChangePasswordOpen(true);
                            }}
                            className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                            <Key size={14} />
                            Trocar senha
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Section: Commissions (Show if Admin or has roles) */}
                {(isLocalAdmin || formData.roles?.includes('vendedor') || formData.roles?.includes('gerente_comercial')) && (
                  <div className="space-y-4">
                    <button 
                      type="button"
                      onClick={() => setExpandedSection(expandedSection === 'commissions' ? null : 'commissions')}
                      className="w-full flex items-center justify-between py-2 border-b border-surface-container-high"
                    >
                      <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-[0.2em]">
                        <DollarSign size={14} />
                        Configuração de Comissionamento
                      </div>
                      {expandedSection === 'commissions' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    
                    {expandedSection === 'commissions' && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-2">
                        {/* Recebe Comissão Toggle */}
                        <div className="flex items-center justify-between p-4 bg-surface-container-highest/10 rounded-2xl border border-dashed border-surface-container-high">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${formData.receivesCommission ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                              <DollarSign size={20} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">Colaborador recebe comissão?</p>
                              <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">Habilitar cálculos automáticos para este usuário</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!isEditingMode || !canEditCommissions}
                            onClick={() => {
                              const newValue = !formData.receivesCommission;
                              setFormData({ 
                                ...formData, 
                                receivesCommission: newValue,
                                commissionType: newValue ? (formData.commissionType === 'none' ? 'percent' : formData.commissionType) : 'none'
                              });
                            }}
                            className={`w-12 h-6 rounded-full relative transition-all ${formData.receivesCommission ? 'bg-primary' : 'bg-surface-container-high transition-colors'} ${(!isEditingMode || !canEditCommissions) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:ring-2 hover:ring-primary/20'} z-10`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${formData.receivesCommission ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>

                        {formData.receivesCommission && (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Tipo de comissão</label>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { id: 'percent', label: 'Percentual' },
                                  { id: 'fixed', label: 'Valor Fixo' }
                                ].map(t => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    disabled={!isEditingMode || !canEditCommissions}
                                    onClick={() => setFormData({ ...formData, commissionType: t.id as any })}
                                    className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-tight transition-all ${
                                      formData.commissionType === t.id 
                                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                                        : 'bg-surface-container-highest/20 border-surface-container-high text-on-surface-variant'
                                    } disabled:opacity-60 cursor-pointer`}
                                  >
                                    {t.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              {formData.commissionType === 'percent' && (
                                <div className="space-y-1.5 col-span-2">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Percentual de Comissão</label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      max="100"
                                      readOnly={!isEditingMode || !canEditCommissions}
                                      className="w-full pl-5 pr-10 py-3.5 bg-surface-container-highest/10 border border-surface-container-high rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 read-only:bg-surface-container-high/20"
                                      value={formData.commissionRate || 0}
                                      onChange={(e) => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                                      placeholder="0.0"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-black text-xs">%</span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                                    {([['commissionProductRate', 'Produtos'], ['commissionServiceRate', 'Serviços'], ['commissionMonthlyRate', 'Mensalidade'], ['commissionAnnualRate', 'Anuidade']] as const).map(([field, label]) => (
                                      <label key={field} className="text-[9px] font-black uppercase text-on-surface-variant">{label}<div className="relative mt-1"><input type="number" min="0" max="100" step="0.1" readOnly={!isEditingMode || !canEditCommissions} value={formData[field] ?? formData.commissionRate ?? 0} onChange={(e) => setFormData({ ...formData, [field]: Number(e.target.value) })} className="w-full px-3 py-2 pr-7 rounded-xl border border-surface-container-high bg-surface text-xs font-bold"/><span className="absolute right-2 top-2 text-xs">%</span></div></label>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {formData.commissionType === 'fixed' && (
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Valor fixo de comissão</label>
                                  <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-black text-xs">R$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      readOnly={!isEditingMode || !canEditCommissions}
                                      className="w-full pl-12 pr-5 py-3.5 bg-surface-container-highest/10 border border-surface-container-high rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 read-only:bg-surface-container-high/20"
                                      value={formData.commissionFixedValue || 0}
                                      onChange={(e) => setFormData({ ...formData, commissionFixedValue: Number(e.target.value) })}
                                      placeholder="0.00"
                                    />
                                  </div>
                                </div>
                              )}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Meta mensal</label>
                                <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-black text-xs">R$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    readOnly={!isEditingMode || !canEditCommissions}
                                    className="w-full pl-12 pr-5 py-3.5 bg-surface-container-highest/10 border border-surface-container-high rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 read-only:bg-surface-container-high/20"
                                    value={formData.monthlyGoal || 0}
                                    onChange={(e) => setFormData({ ...formData, monthlyGoal: Number(e.target.value) })}
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                              <div className="flex items-center gap-3">
                                <Eye size={18} className="text-primary" />
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">Pode visualizar comissão?</p>
                                  <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">O vendedor poderá ver sua própria comissão</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {[
                                  { label: 'Sim', value: true },
                                  { label: 'Não', value: false }
                                ].map((opt) => (
                                  <button
                                    key={opt.label}
                                    type="button"
                                    disabled={!isEditingMode || !canEditCommissions}
                                    onClick={() => setFormData({ ...formData, canViewCommission: opt.value })}
                                    className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                                      formData.canViewCommission === opt.value
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-surface-container-high text-on-surface-variant border-surface-container-highest'
                                    } disabled:opacity-50`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Section: Permissions Matrix */}
                <div className="space-y-4">
                  <button 
                    type="button"
                    onClick={() => setExpandedSection(expandedSection === 'permissions' ? null : 'permissions')}
                    className="w-full flex items-center justify-between py-2 border-b border-surface-container-high"
                  >
                    <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-[0.2em]">
                      <Lock size={14} />
                      Matriz de Níveis de Acesso
                    </div>
                    {expandedSection === 'permissions' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  
                  {expandedSection === 'permissions' && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pt-4">
                      {/* Permissão Especial: Visualizar outros orçamentos */}
                      <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <div className="flex items-center gap-3">
                          <Eye size={18} className="text-primary" />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">Visualizar outros orçamentos?</p>
                            <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">
                              Sim: vê todos os orçamentos | Não: vê apenas os orçamentos criados por ele mesmo
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {[
                            { label: 'Sim', value: true },
                            { label: 'Não', value: false }
                          ].map((opt) => (
                            <button
                              key={opt.label}
                              type="button"
                              disabled={!isEditingMode || !isLocalAdmin}
                              onClick={() => handlePermissionChange('viewOthersOrcamentos', opt.value)}
                              className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                                (formData.permissions?.viewOthersOrcamentos) === opt.value
                                  ? 'bg-primary text-white border-primary shadow-sm'
                                  : 'bg-surface-container-high text-on-surface-variant border-surface-container-highest'
                              } disabled:opacity-50`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {permissionGroups.map((group, gIdx) => {
                        const { inheritanceMap } = cargosService.calculateCumulativePermissions(formData.cargosVinculados || [], cargosList);

                        return (
                          <div key={gIdx} className="space-y-4">
                            <h4 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">{group.title}</h4>
                            <div className="grid grid-cols-1 gap-2">
                              {group.permissions.map((perm) => {
                                const inheritedFrom = inheritanceMap[perm.key as keyof UserPermissions] || [];
                                const isInherited = inheritedFrom.length > 0;

                                return (
                                  <label 
                                    key={perm.key} 
                                    className="flex items-center justify-between p-4 bg-surface-container-highest/10 rounded-2xl border border-surface-container-high cursor-pointer hover:bg-surface-container-highest/20 transition-all"
                                  >
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface">{perm.label}</span>
                                      {isInherited && (
                                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md flex items-center gap-1 w-fit border border-emerald-200/50">
                                          <Check size={10} /> Concedida por: {inheritedFrom.join(', ')}
                                        </span>
                                      )}
                                    </div>
                                    <div className="relative">
                                        <input 
                                          type="checkbox"
                                          className="sr-only"
                                          disabled={!isEditingMode || !isLocalAdmin}
                                          id={`perm-${perm.key}`}
                                          checked={formData.permissions?.[perm.key as keyof UserPermissions] || false}
                                          onChange={(e) => handlePermissionChange(perm.key as keyof UserPermissions, e.target.checked)}
                                        />
                                        <div className={`w-10 h-5 rounded-full transition-all ${formData.permissions?.[perm.key as keyof UserPermissions] ? 'bg-primary' : 'bg-surface-container-high'} ${(!isEditingMode || !isLocalAdmin) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${formData.permissions?.[perm.key as keyof UserPermissions] ? 'left-5.5' : 'left-0.5'}`} />
                                        </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </div>

                <div className="h-20" /> {/* Spacer */}
              </form>

              <div className="p-8 border-t border-surface-container-high bg-surface-container-low flex flex-col gap-4">
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${
                      message.type === 'success' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                    }`}
                  >
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} className="text-white" />}
                    {message.text}
                  </motion.div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest transition-all"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || (!isEditingMode && !!editingUser)}
                    className="flex-[2] py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {!isEditingMode && !!editingUser ? 'Modo Visualização' : (editingUser ? 'Atualizar Diretrizes' : 'Confirmar Cadastro')}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Excluir Usuário"
        message="Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita e ele perderá todo acesso ao sistema."
        confirmText={isDeleting ? "Excluindo..." : "Excluir Usuário"}
        cancelText="Manter Usuário"
        variant="danger"
      />

      {/* Change Password Modal */}
      <AnimatePresence>
        {isChangePasswordOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChangePasswordOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-container border border-surface-container-high rounded-[2rem] shadow-2xl z-[160] overflow-hidden flex flex-col p-8 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-on-surface flex items-center gap-2">
                    <Key className="text-amber-500" size={20} />
                    Trocar Senha
                  </h3>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                    Usuário: {editingUser?.nome || editingUser?.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {passwordError && (
                <div className="p-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-600/10">
                  <AlertCircle size={16} />
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-4 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-green-600/10">
                  <CheckCircle2 size={16} />
                  {passwordSuccess}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">
                    Nova senha
                  </label>
                  <input
                    type="password"
                    required
                    className="w-full px-5 py-3.5 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError(null);
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">
                    Confirmar nova senha
                  </label>
                  <input
                    type="password"
                    required
                    className="w-full px-5 py-3.5 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Repita a nova senha"
                    value={confirmNewPassword}
                    onChange={(e) => {
                      setConfirmNewPassword(e.target.value);
                      setPasswordError(null);
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="flex-1 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newPassword || !confirmNewPassword) {
                      setPasswordError("Por favor, preencha todos os campos.");
                      return;
                    }
                    if (newPassword.length < 6) {
                      setPasswordError("A senha deve ter pelo menos 6 caracteres.");
                      return;
                    }
                    if (newPassword !== confirmNewPassword) {
                      setPasswordError("As duas senhas informadas não são iguais.");
                      return;
                    }

                    try {
                      setIsChangingPassword(true);
                      setPasswordError(null);
                      
                      // Call the service to update password
                      await databaseService.changeUserPassword(
                        user.id, // Current logged-in admin user ID
                        editingUser!.id, // Target user ID
                        newPassword
                      );

                      // Log this action securely on the client side where the user is authenticated in Firestore
                      try {
                        const adminName = user.nome || "Administrador";
                        const targetName = editingUser!.nome || editingUser!.email || "Usuário";
                        await databaseService.saveAccessLog(
                          user.id,
                          adminName,
                          'admin_password_change',
                          `Administrador ${adminName} alterou a senha do usuário ${targetName}.`
                        );
                      } catch (logErr) {
                        console.warn("Could not save access log for password change:", logErr);
                      }

                      setPasswordSuccess("Senha alterada com sucesso.");
                      
                      setTimeout(() => {
                        setIsChangePasswordOpen(false);
                        setPasswordSuccess(null);
                        setNewPassword('');
                        setConfirmNewPassword('');
                      }, 2000);
                    } catch (err: any) {
                      console.error("Error setting password:", err);
                      setPasswordError(err.message || "Erro ao alterar a senha.");
                    } finally {
                      setIsChangingPassword(false);
                    }
                  }}
                  disabled={isChangingPassword}
                  className="flex-1 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest bg-primary text-white shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isChangingPassword ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Save size={14} />
                  )}
                  Salvar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
