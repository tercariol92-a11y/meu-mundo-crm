import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, CheckCircle2, AlertCircle, Loader2, X, Mail, User as UserIcon
} from 'lucide-react';
import { Cliente, CustomerPortalUser } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';

interface PortalAccessTabProps {
  cliente: Cliente;
}

export function PortalAccessTab({ cliente }: PortalAccessTabProps) {
  const [users, setUsers] = useState<CustomerPortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ nome: '', email: '', password: '', ativo: true });
  const [isSaving, setIsSaving] = useState(false);
  
  // New states for authorized emails and users
  const [newEmail, setNewEmail] = useState('');
  const [newUid, setNewUid] = useState('');
  const [emails, setEmails] = useState<string[]>(cliente.emailsAutorizados || []);
  const [uids, setUids] = useState<string[]>(cliente.usuariosVinculados || []);

  useEffect(() => {
    fetchUsers();
    setEmails(cliente.emailsAutorizados || []);
    setUids(cliente.usuariosVinculados || []);
  }, [cliente.id, cliente.emailsAutorizados, cliente.usuariosVinculados]);

  const fetchUsers = async () => {
    try {
      const data = await databaseService.getPortalUsers(cliente.id);
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching portal users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClient = async (updatedEmails: string[], updatedUids: string[]) => {
    try {
      await databaseService.updateCliente(cliente.id, {
        emailsAutorizados: updatedEmails,
        usuariosVinculados: updatedUids
      });
    } catch (error) {
      console.error('Error updating client portal settings:', error);
      alert('Erro ao salvar configurações do portal.');
    }
  };

  const addEmail = () => {
    const cleanEmail = newEmail.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@') || emails.map(e => e.toLowerCase().trim()).includes(cleanEmail)) return;
    const updated = [...emails, cleanEmail];
    setEmails(updated);
    setNewEmail('');
    handleUpdateClient(updated, uids);
  };

  const removeEmail = (email: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const updated = emails.filter(e => e.toLowerCase().trim() !== cleanEmail);
    setEmails(updated);
    handleUpdateClient(updated, uids);
  };

  const addUid = () => {
    const cleanUid = newUid.trim();
    if (!cleanUid || uids.includes(cleanUid)) return;
    const updated = [...uids, cleanUid];
    setUids(updated);
    setNewUid('');
    handleUpdateClient(emails, updated);
  };

  const removeUid = (uid: string) => {
    const cleanUid = uid.trim();
    const updated = uids.filter(u => u.trim() !== cleanUid);
    setUids(updated);
    handleUpdateClient(emails, updated);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = formData.email.toLowerCase().trim();
    if (!formData.nome || !cleanEmail) return;

    setIsSaving(true);
    try {
      await databaseService.adminCreatePortalUser(cleanEmail, formData.password || undefined, {
        nome: formData.nome,
        email: cleanEmail,
        clienteId: cliente.id,
        ativo: formData.ativo
      });
      setIsModalOpen(false);
      setFormData({ nome: '', email: '', password: '', ativo: true });
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating portal user:', error);
      alert(error.message || 'Erro ao vincular usuário do portal. Verifique se o e-mail já está em uso ou se os dados estão corretos.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUserStatus = async (user: CustomerPortalUser) => {
    try {
      await databaseService.updatePortalUser(user.id, { ativo: !user.ativo });
      fetchUsers();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleDeleteUser = async (user: CustomerPortalUser) => {
    if (!confirm(`Excluir acesso de ${user.nome}?`)) return;
    try {
      await databaseService.deletePortalUser(user.id);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  return (
    <div className="space-y-8">
      {/* SEÇÃO 1: VÍNCULOS DINÂMICOS (NOVO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Emails Autorizados */}
        <div className="bg-surface-container-low p-6 rounded-[32px] border border-surface-container-high space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <Mail size={20} />
            <h3 className="text-sm font-black uppercase tracking-tight">E-mails Autorizados</h3>
          </div>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest leading-relaxed">
            Usuários que logarem com estes e-mails terão acesso automático ao portal deste cliente.
          </p>
          
          <div className="flex gap-2">
            <input 
              type="email" 
              placeholder="exemplo@email.com"
              className="flex-1 px-4 py-2 bg-surface-container-medium border border-surface-container-high rounded-xl text-xs font-bold"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addEmail()}
            />
            <button 
              onClick={addEmail}
              className="p-2 bg-primary text-white rounded-xl hover:scale-105 transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {emails.map(email => (
              <span key={email} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter">
                {email}
                <button onClick={() => removeEmail(email)} className="hover:text-error transition-colors"><X size={14} /></button>
              </span>
            ))}
            {emails.length === 0 && <p className="text-[10px] text-on-surface-variant italic">Nenhum e-mail extra autorizado</p>}
          </div>
        </div>

        {/* Usuários Vinculados ID */}
        <div className="bg-surface-container-low p-6 rounded-[32px] border border-surface-container-high space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <UserIcon size={20} />
            <h3 className="text-sm font-black uppercase tracking-tight">IDs de Usuários (Auth UID)</h3>
          </div>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest leading-relaxed">
            Vincule diretamente o UID do Firebase Auth para garantir o acesso deste usuário.
          </p>
          
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="UID do Firebase"
              className="flex-1 px-4 py-2 bg-surface-container-medium border border-surface-container-high rounded-xl text-xs font-mono font-bold"
              value={newUid}
              onChange={(e) => setNewUid(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addUid()}
            />
            <button 
              onClick={addUid}
              className="p-2 bg-primary text-white rounded-xl hover:scale-105 transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {uids.map(uid => (
              <span key={uid} className="flex items-center gap-2 bg-black/10 text-on-surface px-3 py-1.5 rounded-full text-[10px] font-bold font-mono">
                {uid.substring(0, 12)}...
                <button onClick={() => removeUid(uid)} className="hover:text-error transition-colors"><X size={14} /></button>
              </span>
            ))}
            {uids.length === 0 && <p className="text-[10px] text-on-surface-variant italic">Nenhum UID vinculado</p>}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-surface-container-low p-6 rounded-3xl border border-surface-container-high shadow-sm">
        <div>
          <h3 className="text-lg font-black text-on-surface uppercase tracking-tight">Vínculo de Usuário do Portal</h3>
          <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Gerencie e associe diretamente usuários com o portal deste cliente</p>
        </div>
        <button 
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={16} />
          Vincular Usuário do Portal
        </button>
      </div>

      <div className="bg-surface-container-low border border-surface-container-high rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-container-highest/20 border-b border-surface-container-high">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nome</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Email</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-high/50">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="animate-spin text-primary mx-auto" size={24} /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-xs text-on-surface-variant font-bold uppercase tracking-widest">Nenhum usuário com acesso</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id} className="hover:bg-surface-container-highest/5 transition-colors">
                  <td className="px-6 py-4 font-bold text-sm text-on-surface">{u.nome}</td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant">{u.email}</td>
                  <td className="px-6 py-4">
                    <button 
                      type="button"
                      onClick={() => toggleUserStatus(u)}
                      className={`flex items-center gap-1.5 ${u.ativo ? 'text-green-600' : 'text-on-surface-variant'}`}
                    >
                      {u.ativo ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span className="text-[10px] font-black uppercase tracking-widest">{u.ativo ? 'Ativo' : 'Inativo'}</span>
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      type="button"
                      onClick={() => handleDeleteUser(u)}
                      className="p-2 hover:bg-error/10 text-on-surface-variant hover:text-error rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-container-lowest p-8 rounded-[2.5rem] shadow-2xl z-[210] border border-surface-container-high/50 text-left">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-on-surface uppercase tracking-tight">Vincular Usuário do Portal</h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-surface-container-high rounded-full"><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Nome Completo</label>
                  <input required type="text" className="w-full px-5 py-3 bg-surface-container-medium border border-surface-container-high rounded-2xl text-sm font-bold" value={formData.nome || ''} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Email de Acesso</label>
                  <input required type="email" className="w-full px-5 py-3 bg-surface-container-medium border border-surface-container-high rounded-2xl text-sm font-bold animate-none" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Senha Inicial (Opcional)</label>
                  <input type="text" placeholder="Padrão: MundoTech@2026" className="w-full px-5 py-3 bg-surface-container-medium border border-surface-container-high rounded-2xl text-sm font-mono" value={formData.password || ''} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Status Inicial</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, ativo: true })}
                      className={`flex-1 py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
                        formData.ativo 
                          ? 'bg-green-500/10 border-green-500 text-green-600 shadow-md shadow-green-500/5' 
                          : 'bg-surface-container-medium border-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      Ativo
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, ativo: false })}
                      className={`flex-1 py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
                        !formData.ativo 
                          ? 'bg-error/10 border-error text-error shadow-md shadow-error/5' 
                          : 'bg-surface-container-medium border-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      Inativo
                    </button>
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition-all disabled:opacity-50 shadow-xl shadow-primary/20 pt-3"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Conceder e Vincular Acesso'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
