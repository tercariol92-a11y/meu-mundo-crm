import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Building2, 
  Wrench, 
  AlertCircle,
  FileText,
  Camera,
  Calendar,
  Clock,
  PlusCircle
} from 'lucide-react';
import { User, Chamado, Unidade, EquipamentoCliente } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion } from 'framer-motion';
import EquipmentRegistrationModal from './EquipmentRegistrationModal';

interface CustomerTicketFormProps {
  user: any;
  onCancel: () => void;
  onSuccess: () => void;
  preFilledData?: any;
}

export default function CustomerTicketForm({ user, onCancel, onSuccess, preFilledData }: CustomerTicketFormProps) {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const [cliente, setCliente] = useState<any>(null);

  const [formData, setFormData] = useState<Partial<Chamado>>({
    titulo: preFilledData?.titulo || '',
    descricao: preFilledData?.descricao || '',
    prioridade: 'media',
    status: 'aberto',
    tipoAtendimento: preFilledData?.tipoAtendimento || 'Remoto',
    clienteId: user.clienteId || (user as any).empresaId || '',
    unidadeId: preFilledData?.unidadeId || (user as any).unidadeId || '',
    equipamentoClienteId: preFilledData?.equipamentoClienteId || '',
  });

  useEffect(() => {
    console.log('[DEBUG] Componente CustomerTicketForm montado. Dados do Usuário:', {
      id: user.id || (user as any).uid,
      nome: user.nome || (user as any).displayName,
      email: user.email,
      clienteId: user.clienteId,
      empresaId: (user as any).empresaId,
      unidadeId: (user as any).unidadeId,
      userType: user.userType || (user as any).perfil || (user as any).tipo,
      ativo: user.ativo
    });

    const loadFormData = async () => {
      const resolvedClienteId = user.clienteId || (user as any).empresaId;
      if (!resolvedClienteId) {
        setLoading(false);
        return;
      }
      try {
        let unidadesData: Unidade[] = [];
        let equipamentosData: EquipamentoCliente[] = [];
        let clienteInfo: any = null;

        try {
          unidadesData = await databaseService.getUnidadesByCliente(resolvedClienteId) || [];
        } catch (e) {
          console.error('[DEBUG] Erro ao carregar unidades do cliente:', e);
        }

        try {
          equipamentosData = await databaseService.getEquipamentosByCliente(resolvedClienteId) || [];
        } catch (e) {
          console.error('[DEBUG] Erro ao carregar equipamentos do cliente:', e);
        }

        try {
          clienteInfo = await databaseService.getClienteById(resolvedClienteId) || null;
        } catch (e) {
          console.error('[DEBUG] Erro ao carregar dados do cliente:', e);
        }

        setUnidades(unidadesData);
        setEquipamentos(equipamentosData);
        setCliente(clienteInfo);

        // Se a unidade do form não estiver definida, mas o usuário tiver uma unidadeId vinculada, ou se houver unidades carregadas
        const prefilledUnidadeId = preFilledData?.unidadeId || (user as any).unidadeId || (unidadesData && unidadesData.length > 0 ? unidadesData[0].id : '');
        setFormData(prev => ({
          ...prev,
          clienteId: resolvedClienteId,
          unidadeId: prefilledUnidadeId
        }));
      } catch (err) {
        console.error('[DEBUG] Erro ao carregar dados do formulário:', err);
      } finally {
        setLoading(false);
      }
    };
    loadFormData();
  }, [user, preFilledData]);

  // Diagnostic Logging Effect as requested by the user
  useEffect(() => {
    if (loading) return;

    const filtered = equipamentos.filter(e => {
      const isActive = e.status !== 'Desativado' && (e as any).ativo !== false;
      const matchesUnit = !formData.unidadeId || e.unidadeId === formData.unidadeId || (e as any).unidade_id === formData.unidadeId;
      
      if (!isActive) {
        console.log(`[DIAGNOSTIC] Equipamento descartado (Inativo):`, e.id, `Status: ${e.status}, Ativo: ${(e as any).ativo}`);
      } else if (!matchesUnit) {
        console.log(`[DIAGNOSTIC] Equipamento descartado (Filtro Unidade):`, e.id, `Unidade do Equipamento: ${e.unidadeId || (e as any).unidade_id}, Unidade Selecionada: ${formData.unidadeId}`);
      }
      
      return isActive && matchesUnit;
    });

    console.log('[DIAGNOSTIC] currentUser:', user);
    console.log('[DIAGNOSTIC] equipamentos:', equipamentos);
    console.log('[DIAGNOSTIC] filteredEquipments:', filtered);
  }, [loading, user, equipamentos, formData.unidadeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const resolvedClienteId = user.clienteId || (user as any).empresaId;
    let resolvedUnidadeId = formData.unidadeId || (user as any).unidadeId;

    // 8. Se unidade não estiver vinculada, usar unidade padrão do cliente
    if (!resolvedUnidadeId && unidades && unidades.length > 0) {
      resolvedUnidadeId = unidades[0].id;
    }

    // 1. Log diagnostic info to browser console
    console.log('[DEBUG] Tentando abrir chamado. Diagnóstico do usuário:', {
      user_id: user.id || (user as any).uid,
      user_nome: user.nome || (user as any).displayName,
      user_email: user.email,
      user_clienteId: user.clienteId,
      user_empresaId: (user as any).empresaId,
      user_unidadeId: (user as any).unidadeId,
      user_perfil: user.userType || (user as any).perfil || (user as any).tipo,
      formData_unidadeId: formData.unidadeId,
      resolved_clienteId: resolvedClienteId,
      resolved_unidadeId: resolvedUnidadeId
    });

    // 3. Antes de salvar o chamado, validar os campos obrigatórios.
    // Se algum campo estiver ausente, exibir mensagem clara:
    if (!resolvedClienteId || !resolvedUnidadeId) {
      console.error('[DEBUG] Erro de validação: clienteId ou unidadeId ausente.');
      setMessage({ 
        type: 'error', 
        text: 'Usuário cliente não está vinculado a uma empresa/unidade. Corrija o cadastro.' 
      });
      setIsSaving(false);
      return;
    }

    if (!formData.titulo?.trim() || !formData.descricao?.trim()) {
      setMessage({ type: 'error', text: 'Preencha os campos de Título e Descrição.' });
      setIsSaving(false);
      return;
    }

    const selectedUnidade = unidades.find(u => u.id === resolvedUnidadeId);
    const resolvedUnidadeNome = selectedUnidade ? selectedUnidade.nome : 'Unidade Padrão';

    const selectedEquipamento = equipamentos.find(e => e.id === formData.equipamentoClienteId);
    const resolvedEquipamentoId = selectedEquipamento ? selectedEquipamento.id : null;
    const resolvedEquipamentoNome = selectedEquipamento 
      ? `${selectedEquipamento.tipo || ''} - ${selectedEquipamento.modelo || ''} (${selectedEquipamento.numeroSerie || ''})`
      : 'Equipamento não informado';

    // 6. Ajustar a função de criação de chamado para salvar os campos requeridos
    const payload: any = {
      titulo: formData.titulo.trim(),
      descricao: formData.descricao.trim(),
      prioridade: formData.prioridade || 'media',
      status: 'aberto',
      clienteId: resolvedClienteId,
      clienteNome: cliente?.nomeFantasia || cliente?.razaoSocial || cliente?.nome || 'Cliente',
      unidadeId: resolvedUnidadeId,
      unidadeNome: resolvedUnidadeNome,
      equipamentoId: resolvedEquipamentoId,
      equipamentoClienteId: resolvedEquipamentoId,
      equipamentoNome: resolvedEquipamentoNome,
      criadoPor: user.id || (user as any).uid || '',
      criadoPorNome: user.nome || (user as any).displayName || 'Cliente',
      criadoPorEmail: user.email || '',
      origem: 'portal_cliente',
      tipoAtendimento: formData.tipoAtendimento || 'Remoto'
    };

    // 4. Verificar se existe campo undefined sendo enviado ao Firestore.
    // Antes de criar o chamado, remover ou substituir valores undefined por null ou string vazia.
    const cleanPayload: any = {};
    Object.keys(payload).forEach(key => {
      const val = payload[key];
      if (val === undefined) {
        cleanPayload[key] = null;
      } else {
        cleanPayload[key] = val;
      }
    });

    console.log('[DEBUG] Payload limpo enviado ao Firestore:', cleanPayload);

    try {
      await databaseService.createChamado(cleanPayload);
      console.log('[DEBUG] Chamado criado com sucesso!');
      setMessage({ type: 'success', text: 'Chamado aberto com sucesso!' });
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error('[DEBUG] Erro real retornado pelo Firestore:', err);
      setMessage({ 
        type: 'error', 
        text: `Erro ao abrir chamado: ${err.message || 'Tente novamente.'}` 
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-on-surface">Novo Chamado</h1>
          <p className="text-sm text-on-surface-variant font-medium">Descreva o problema para que possamos ajudar.</p>
        </div>
        <button
          onClick={onCancel}
          className="p-3 hover:bg-surface-container-high rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm space-y-8">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <FileText size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest">Informações do Chamado</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Título do Problema</label>
                  <input
                    required
                    type="text"
                    className="w-full px-6 py-4 bg-surface-container-highest/30 border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    placeholder="Ex: Catraca não libera acesso"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Descrição Detalhada</label>
                  <textarea
                    required
                    rows={6}
                    className="w-full px-6 py-4 bg-surface-container-highest/30 border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Descreva o que está acontecendo, erros exibidos, etc."
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Camera size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest">Anexos (Opcional)</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  type="button"
                  className="aspect-square rounded-2xl border-2 border-dashed border-surface-container-high flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:border-primary hover:text-primary transition-all group"
                >
                  <PlusCircle size={24} className="group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Foto</span>
                </button>
              </div>
            </section>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface-container-low p-8 rounded-[40px] border border-surface-container-high shadow-sm space-y-6">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Building2 size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest">Localização</h3>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Unidade / Filial</label>
                <select
                  required
                  className="w-full px-6 py-4 bg-surface-container-highest/30 border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                  value={formData.unidadeId}
                  onChange={(e) => setFormData({ ...formData, unidadeId: e.target.value })}
                >
                  <option value="">Selecione a unidade</option>
                  {unidades.map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Wrench size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest">Equipamento</h3>
              </div>
              
              {equipamentos.length === 0 ? (
                <div className="p-5 bg-surface border border-surface-container-high rounded-[24px] flex flex-col items-center text-center gap-3 shadow-sm">
                  <AlertCircle className="text-primary/70 animate-pulse" size={24} />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">Nenhum equipamento cadastrado</h4>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Cadastre o seu equipamento para vinculá-lo ao chamado.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRegistrationModalOpen(true)}
                    className="px-5 py-3 bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    <PlusCircle size={14} />
                    Cadastrar equipamento
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Equipamento com Problema</label>
                  <select
                    className="w-full px-6 py-4 bg-surface-container-highest/30 border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                    value={formData.equipamentoClienteId}
                    onChange={(e) => {
                      const eqId = e.target.value;
                      const selected = equipamentos.find(eq => eq.id === eqId);
                      if (selected) {
                        const targetUnitId = selected.unidadeId || (selected as any).unidade_id || '';
                        setFormData(prev => ({
                          ...prev,
                          equipamentoClienteId: eqId,
                          unidadeId: targetUnitId || prev.unidadeId
                        }));
                      } else {
                        setFormData(prev => ({ ...prev, equipamentoClienteId: eqId }));
                      }
                    }}
                  >
                    <option value="">Selecione o equipamento (opcional)</option>
                    {equipamentos
                      .filter(e => {
                        // Filter active equipments
                        const isActive = e.status !== 'Desativado' && (e as any).ativo !== false;
                        return isActive;
                      })
                      .sort((a, b) => {
                        const aMatches = !formData.unidadeId || a.unidadeId === formData.unidadeId || (a as any).unidade_id === formData.unidadeId;
                        const bMatches = !formData.unidadeId || b.unidadeId === formData.unidadeId || (b as any).unidade_id === formData.unidadeId;
                        if (aMatches && !bMatches) return -1;
                        if (!aMatches && bMatches) return 1;
                        return 0;
                      })
                      .map(e => {
                        const site = (e as any).site || (e as any).codigoUnidade || '';
                        const desc = (e as any).descricao || (e as any).unidadeNome || e.tipo || '';
                        const fiscal = (e as any).numero_fiscal || (e as any).numeroFiscal || e.numeroSerie || '';
                        const ipVal = (e as any).ip_equipamento || (e as any).ip || '';
                        
                        const part1 = site && desc ? `${site} - ${desc}` : (site || desc);
                        const part2 = fiscal ? `Número fiscal: ${fiscal}` : '';
                        const part3 = ipVal ? `IP: ${ipVal}` : '';
                        
                        const optionText = [part1, part2, part3].filter(Boolean).join(' | ');
                        
                        const isMatch = !formData.unidadeId || e.unidadeId === formData.unidadeId || (e as any).unidade_id === formData.unidadeId;
                        const prefix = formData.unidadeId && !isMatch ? '[Outra Unidade] ' : '';

                        return (
                          <option key={e.id} value={e.id}>
                            {prefix}{optionText}
                          </option>
                        );
                      })}
                  </select>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <AlertCircle size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest">Prioridade</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['baixa', 'media', 'alta'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFormData({ ...formData, prioridade: p })}
                    className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                      formData.prioridade === p 
                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                        : 'bg-surface-container-highest/20 border-surface-container-high text-on-surface-variant hover:border-primary/50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </section>

            {message && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                  message.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                }`}
              >
                {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {message.text}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={!formData.titulo?.trim() || !formData.descricao?.trim() || isSaving}
              className="w-full py-4 bg-primary text-white rounded-[24px] font-black uppercase tracking-widest text-xs hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Abrir Chamado
            </button>
          </div>
        </div>
      </form>

      {/* Painel de Depuração Temporário */}
      <div className="mt-8 p-5 bg-surface border border-surface-container-high rounded-[24px] text-xs font-mono shadow-sm">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowDebugPanel(!showDebugPanel)}>
          <span className="text-primary font-bold flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
            <span className="animate-pulse text-red-500">●</span> Painel de Diagnóstico de Integração (Temporário)
          </span>
          <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">{showDebugPanel ? 'Colapsar' : 'Expandir'}</span>
        </div>
        
        {showDebugPanel && (
          <div className="mt-4 space-y-3 pt-3 border-t border-surface-container-high text-[11px] text-on-surface-variant">
            <div>
              <span className="font-bold text-on-surface">Cliente Logado (ID):</span> {user.clienteId || (user as any).empresaId || 'Não definido'}
            </div>
            <div>
              <span className="font-bold text-on-surface">Equipamentos Recuperados do Banco ({equipamentos.length}):</span>
              {equipamentos.length === 0 ? (
                <span className="text-red-500 ml-1">Nenhum equipamento retornado para este cliente</span>
              ) : (
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  {equipamentos.map(e => (
                    <li key={e.id}>
                      ID: {e.id} | Site/Unidade: {(e as any).site || (e as any).codigoUnidade || 'N/A'} | Desc: {(e as any).descricao || (e as any).unidadeNome || e.tipo || 'N/A'} | S/N: {(e as any).numero_fiscal || e.numeroSerie} | Ativo: {String((e as any).ativo)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <span className="font-bold text-on-surface">Equipamentos Após Filtros Ativos ({
                equipamentos.filter(e => {
                  const isActive = e.status !== 'Desativado' && (e as any).ativo !== false;
                  const matchesUnit = !formData.unidadeId || e.unidadeId === formData.unidadeId || (e as any).unidade_id === formData.unidadeId;
                  return isActive && matchesUnit;
                }).length
              }):</span>
              {equipamentos.filter(e => {
                const isActive = e.status !== 'Desativado' && (e as any).ativo !== false;
                const matchesUnit = !formData.unidadeId || e.unidadeId === formData.unidadeId || (e as any).unidade_id === formData.unidadeId;
                return isActive && matchesUnit;
              }).length === 0 ? (
                <span className="text-red-500 ml-1">Nenhum passou nos filtros de ativo e unidade</span>
              ) : (
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  {equipamentos
                    .filter(e => {
                      const isActive = e.status !== 'Desativado' && (e as any).ativo !== false;
                      const matchesUnit = !formData.unidadeId || e.unidadeId === formData.unidadeId || (e as any).unidade_id === formData.unidadeId;
                      return isActive && matchesUnit;
                    })
                    .map(e => (
                      <li key={e.id}>
                        ID: {e.id} | Desc: {(e as any).descricao || (e as any).unidadeNome || e.tipo}
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <div>
              <span className="font-bold text-on-surface">Fonte dos dados:</span> databaseService.getEquipamentosByCliente (Query Robusta Unificada)
            </div>
          </div>
        )}
      </div>

      <EquipmentRegistrationModal
        isOpen={isRegistrationModalOpen}
        onClose={() => setIsRegistrationModalOpen(false)}
        user={user}
        unidades={unidades}
        onSuccess={async () => {
          const resolvedClienteId = user.clienteId || (user as any).empresaId;
          if (resolvedClienteId) {
            try {
              const equipmentsData = await databaseService.getEquipamentosByCliente(resolvedClienteId);
              setEquipamentos(equipmentsData || []);
            } catch (err) {
              console.error('[DEBUG] Erro ao recarregar equipamentos:', err);
            }
          }
        }}
        editingRequest={null}
      />
    </div>
  );
}
