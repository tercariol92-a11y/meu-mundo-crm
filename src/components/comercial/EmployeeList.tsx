import React, { useState, useEffect } from 'react';
import { Usuario, UserRole, User as UserType } from '../../types';
import { databaseService } from '../../services/databaseService';
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
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EmployeeList({ user }: { user?: UserType }) {
  const [employees, setEmployees] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Usuario | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState<Partial<Usuario & { password?: string }>>({
    nome: '',
    email: '',
    role: 'vendedor',
    password: ''
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await databaseService.getUsuarios();
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (employee?: Usuario) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({ ...employee, password: '' });
    } else {
      setEditingEmployee(null);
      setFormData({
        nome: '',
        email: '',
        role: 'vendedor',
        password: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.email) return;

    try {
      setIsSaving(true);
      if (editingEmployee) {
        await databaseService.updateUsuario(editingEmployee.id, formData);
        setMessage({ type: 'success', text: 'Usuário atualizado com sucesso!' });
      } else {
        if (!formData.password || formData.password.length < 6) {
          setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
          return;
        }

        // Check if email already exists
        const existing = employees.find(emp => emp.email.toLowerCase() === formData.email?.toLowerCase());
        if (existing) {
          setMessage({ type: 'error', text: 'Já existe um usuário com este email.' });
          return;
        }

        const { password, ...userData } = formData;
        await databaseService.adminCreateUser(formData.email, password!, userData as Omit<Usuario, 'id' | 'createdAt' | 'updatedAt'>);
        setMessage({ type: 'success', text: 'Usuário cadastrado com sucesso!' });
      }
      await fetchEmployees();
      setTimeout(() => handleCloseModal(), 2000);
    } catch (error: any) {
      console.error('Error saving employee:', error);
      let errorMsg = 'Erro ao salvar usuário.';
      if (error.code === 'auth/email-already-in-use') errorMsg = 'Este email já está em uso.';
      if (error.code === 'auth/weak-password') errorMsg = 'A senha é muito fraca.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!window.confirm(`Deseja enviar um email de redefinição de senha para ${email}?`)) return;
    try {
      await databaseService.resetUserPassword(email);
      setMessage({ type: 'success', text: 'Email de redefinição enviado com sucesso!' });
    } catch (error) {
      console.error('Error resetting password:', error);
      setMessage({ type: 'error', text: 'Erro ao enviar email de redefinição.' });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    
    try {
      setIsDeleting(true);
      await databaseService.deleteUsuario(confirmDelete);
      await fetchEmployees();
      setConfirmDelete(null);
      setMessage({ type: 'success', text: 'Usuário excluído com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting employee:', error);
      setMessage({ type: 'error', text: 'Erro ao excluir usuário. Verifique suas permissões.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      (emp.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (emp.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const roles: { value: UserRole; label: string }[] = [
    { value: 'admin', label: 'Administrador' },
    { value: 'tecnico', label: 'Técnico' },
    { value: 'vendedor', label: 'Vendedor/Comercial' },
    { value: 'financeiro', label: 'Financeiro' },
    { value: 'suporte', label: 'Suporte' }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-on-surface">Usuários do Sistema</h1>
          <p className="text-sm text-on-surface-variant">Gerencie quem pode acessar o sistema e seus níveis de permissão</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          Novo Usuário
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-surface-container-low rounded-2xl border border-surface-container-high overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/30 border-b border-surface-container-high">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Usuário</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Email</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nível de Acesso</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Data de Cadastro</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-primary mx-auto" size={32} />
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                      <UserIcon size={48} className="opacity-20" />
                      <p className="font-bold">Nenhum usuário encontrado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-surface-container-highest/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-highest overflow-hidden flex items-center justify-center text-primary font-bold border border-surface-container-high shrink-0">
                          {emp.nome?.charAt(0) || '?'}
                        </div>
                        <p className="text-sm font-bold text-on-surface">{emp.nome}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <Mail size={14} />
                        {emp.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Shield size={14} className={emp.role === 'admin' ? 'text-primary' : 'text-on-surface-variant'} />
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                          emp.role === 'admin' ? 'bg-primary/10 text-primary border-primary/20' :
                          emp.role === 'tecnico' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                          {roles.find(r => r.value === emp.role)?.label || emp.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-on-surface-variant">
                        {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString('pt-BR') : '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(emp)}
                          className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors" 
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        {user?.role === 'admin' && user?.id !== emp.id && (
                          <button 
                            onClick={() => setConfirmDelete(emp.id)}
                            className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors" 
                            title="Excluir"
                          >
                            <Trash2 size={16} />
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface-container-low rounded-[32px] p-8 shadow-2xl z-[110] border border-surface-container-high"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-red-100 text-red-600 flex items-center justify-center mb-2">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-on-surface">Excluir Usuário?</h3>
                <p className="text-sm text-on-surface-variant">
                  Esta ação não pode ser desfeita. O usuário perderá acesso imediato ao sistema.
                </p>
                <div className="flex flex-col w-full gap-2 mt-4">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full py-3 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Confirmar Exclusão'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="w-full py-3 bg-surface-container-high text-on-surface rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-surface-container-highest transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Employee Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-screen w-full max-w-md bg-surface-container-low shadow-2xl z-[70] flex flex-col"
            >
              <div className="p-6 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-on-surface">
                    {editingEmployee ? 'Editar Usuário' : 'Novo Usuário'}
                  </h2>
                  <p className="text-xs text-on-surface-variant">Configure o nível de acesso do colaborador</p>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-8">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <UserIcon size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Informações Pessoais</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome Completo</label>
                      <input
                        required
                        type="text"
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.nome || ''}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        placeholder="Ex: João Silva"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Email</label>
                      <input
                        required
                        type="email"
                        className="w-full px-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="joao@empresa.com.br"
                      />
                    </div>

                    {!editingEmployee ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Senha Inicial</label>
                        <div className="relative">
                          <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                          <input
                            required
                            type="password"
                            minLength={6}
                            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-highest/30 border border-surface-container-high rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={formData.password || ''}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Mínimo 6 caracteres"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleResetPassword(formData.email!)}
                          className="flex items-center gap-2 text-primary hover:text-primary/80 text-[10px] font-black uppercase tracking-widest transition-colors"
                        >
                          <RefreshCw size={14} />
                          Enviar email de redefinição de senha
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Shield size={18} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Nível de Acesso</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {roles.map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: role.value })}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                          formData.role === role.value 
                            ? 'bg-primary/5 border-primary text-primary' 
                            : 'bg-surface-container-highest/20 border-surface-container-high text-on-surface-variant hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Shield size={18} />
                          <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-widest">{role.label}</p>
                            <p className="text-[10px] opacity-70">
                              {role.value === 'admin' ? 'Acesso total ao sistema' :
                               role.value === 'tecnico' ? 'Gestão de chamados e equipamentos' :
                               'Acesso limitado a consultas'}
                            </p>
                          </div>
                        </div>
                        {formData.role === role.value && <CheckCircle2 size={18} />}
                      </button>
                    ))}
                  </div>
                </section>

                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      message.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                    }`}
                  >
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
                    {message.text}
                  </motion.div>
                )}
              </form>

              <div className="p-6 border-t border-surface-container-high bg-surface-container-highest/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-primary text-white px-8 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  {editingEmployee ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
