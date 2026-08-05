import React, { useState, useEffect } from 'react';
import { 
  Target, 
  TrendingUp, 
  CircleDollarSign, 
  Percent, 
  Coins, 
  Calendar, 
  Save, 
  Lock, 
  Users, 
  FileText, 
  UserCheck } from 'lucide-react';
import { useGlobalData } from '../../contexts/GlobalDataContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from '../../services/resilientFirestoreClient';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function MetasEmpresariais({ user }: { user: any }) {
  const { metas = [], usuarios = [], loading, refreshData } = useGlobalData();
  const isAdmin = user?.role === 'admin' || user?.roles?.includes('admin') || user?.email === 'tercariol92@gmail.com';

  // View states
  const [activeSubTab, setActiveSubTab] = useState<'empresa' | 'comercial'>('empresa');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isSaving, setIsSaving] = useState(false);

  // Annual Target states
  const [metaAnualDigitada, setMetaAnualDigitada] = useState<string>('');
  const [isDistribuindoAnual, setIsDistribuindoAnual] = useState(false);

  // Sum of existing monthly targets for selected year
  const currentYearMetasValue = React.useMemo(() => {
    return metas
      .filter(m => m.ano === selectedYear && m.tipo === 'faturamento')
      .reduce((sum, m) => sum + (m.valorObjetivo || 0), 0);
  }, [metas, selectedYear]);

  // Handle distributing the yearly target equally among all 12 months
  const handleDistribuirMetaAnual = async () => {
    const rawValue = parseFloat(metaAnualDigitada);
    if (isNaN(rawValue) || rawValue <= 0) {
      toast.error('Por favor, insira um valor válido de meta anual.');
      return;
    }

    if (!isAdmin) {
      toast.error('Apenas administradores podem atualizar as metas corporativas.');
      return;
    }

    setIsDistribuindoAnual(true);
    try {
      const valorMensal = parseFloat((rawValue / 12).toFixed(2));
      
      const promises = Array.from({ length: 12 }, async (_, i) => {
        const monthNum = i + 1;
        const q = query(
          collection(db, 'metas'),
          where('mes', '==', monthNum),
          where('ano', '==', selectedYear),
          where('tipo', '==', 'faturamento')
        );
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const docId = snap.docs[0].id;
          return updateDoc(doc(db, 'metas', docId), {
            valorObjetivo: valorMensal,
            updatedAt: new Date().toISOString()
          });
        } else {
          return addDoc(collection(db, 'metas'), {
            mes: monthNum,
            ano: selectedYear,
            tipo: 'faturamento',
            valorObjetivo: valorMensal,
            createdAt: new Date().toISOString()
          });
        }
      });

      await Promise.all(promises);
      toast.success(`Meta anual de R$ ${rawValue.toLocaleString('pt-BR')} foi dividida igualmente em parcelas de R$ ${valorMensal.toLocaleString('pt-BR')} para todos os 12 meses de ${selectedYear}!`);
      setMetaAnualDigitada('');
      if (refreshData) {
        await refreshData('metas');
      }
    } catch (e) {
      console.error('Erro ao distribuir meta anual:', e);
      toast.error('Erro ao salvar as metas anuais no banco de dados.');
    } finally {
      setIsDistribuindoAnual(false);
    }
  };

  // Enterprise Goals states
  const [faturamento, setFaturamento] = useState<number>(0);
  const [lucro, setLucro] = useState<number>(0);
  const [margem, setMargem] = useState<number>(0);
  const [caixa, setCaixa] = useState<number>(0);
  const [mrr, setMrr] = useState<number>(0);

  // Commercial Goals (Vendor specific) states
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [vendorFaturamento, setVendorFaturamento] = useState<number>(0);
  const [vendorPropostas, setVendorPropostas] = useState<number>(0);
  const [vendorNovosClientes, setVendorNovosClientes] = useState<number>(0);
  const [vendorComissao, setVendorComissao] = useState<number>(0);
  const [isSavingVendor, setIsSavingVendor] = useState(false);

  // List of salespeople
  const vendedores = usuarios.filter((u: any) => 
    u.role === 'vendedor' || 
    u.roles?.includes('vendedor') ||
    u.role === 'gerente_comercial'
  );

  // Sync Enterprise goals state when selectedMonth, selectedYear or metas list changes
  useEffect(() => {
    const metaFat = metas.find(m => m.mes === selectedMonth && m.ano === selectedYear && m.tipo === 'faturamento');
    const metaLuc = metas.find(m => m.mes === selectedMonth && m.ano === selectedYear && m.tipo === 'lucro');
    const metaMargem = metas.find(m => m.mes === selectedMonth && m.ano === selectedYear && m.tipo === 'margem');
    const metaCaixa = metas.find(m => m.mes === selectedMonth && m.ano === selectedYear && m.tipo === 'caixa');
    const metaMrr = metas.find(m => m.mes === selectedMonth && m.ano === selectedYear && m.tipo === 'mrr');

    setFaturamento(metaFat?.valorObjetivo || 0);
    setLucro(metaLuc?.valorObjetivo || 0);
    setMargem(metaMargem?.valorObjetivo || 0);
    setCaixa(metaCaixa?.valorObjetivo || 0);
    setMrr(metaMrr?.valorObjetivo || 0);
  }, [selectedMonth, selectedYear, metas]);

  // Sync selected vendor goals
  useEffect(() => {
    if (!selectedVendorId && vendedores.length > 0) {
      setSelectedVendorId(vendedores[0].id);
    }
  }, [vendedores, selectedVendorId]);

  useEffect(() => {
    if (selectedVendorId) {
      const v = usuarios.find((u: any) => u.id === selectedVendorId);
      if (v) {
        setVendorFaturamento(v.metaMensal || v.monthlyGoal || 0);
        setVendorPropostas(v.metaPropostas || 0);
        setVendorNovosClientes(v.metaNovosClientes || 0);
        setVendorComissao(v.metaComissao || v.commissionRate || 0);
      }
    }
  }, [selectedVendorId, usuarios]);

  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const saveSingleMeta = async (tipo: string, valorObjetivo: number) => {
    const q = query(
      collection(db, 'metas'),
      where('mes', '==', selectedMonth),
      where('ano', '==', selectedYear),
      where('tipo', '==', tipo)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docId = snap.docs[0].id;
      await updateDoc(doc(db, 'metas', docId), {
        valorObjetivo,
        updatedAt: new Date().toISOString()
      });
    } else {
      await addDoc(collection(db, 'metas'), {
        mes: selectedMonth,
        ano: selectedYear,
        tipo,
        valorObjetivo,
        createdAt: new Date().toISOString()
      });
    }
  };

  const handleSaveEnterprise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Somente administradores podem alterar as metas.');
      return;
    }

    setIsSaving(true);
    try {
      await Promise.all([
        saveSingleMeta('faturamento', faturamento),
        saveSingleMeta('lucro', lucro),
        saveSingleMeta('margem', margem),
        saveSingleMeta('caixa', caixa),
        saveSingleMeta('mrr', mrr)
      ]);
      toast.success('Metas empresariais atualizadas para o período!');
    } catch (error) {
      console.error("Erro ao salvar metas:", error);
      toast.error('Ocorreu um erro ao salvar as metas.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveVendorGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Somente administradores podem alterar as metas de vendedores.');
      return;
    }
    if (!selectedVendorId) {
      toast.error('Selecione um vendedor primeiro.');
      return;
    }

    setIsSavingVendor(true);
    try {
      const docRef = doc(db, 'usuarios', selectedVendorId);
      await updateDoc(docRef, {
        metaMensal: vendorFaturamento,
        monthlyGoal: vendorFaturamento,
        metaPropostas: vendorPropostas,
        metaNovosClientes: vendorNovosClientes,
        metaComissao: vendorComissao,
        updatedAt: new Date().toISOString()
      });
      toast.success('Metas de desempenho comercial do vendedor atualizadas!');
      if (refreshData) {
        await refreshData('usuarios');
      }
    } catch (error) {
      console.error("Erro ao salvar metas do vendedor:", error);
      toast.error('Ocorreu um erro ao atualizar as metas do vendedor.');
    } finally {
      setIsSavingVendor(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Sub Tab selection */}
      <div className="flex border-b border-surface-container-high pb-px">
        <button
          onClick={() => setActiveSubTab('empresa')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition ${
            activeSubTab === 'empresa'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          🏢 Metas da Empresa
        </button>
        <button
          onClick={() => setActiveSubTab('comercial')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition ${
            activeSubTab === 'comercial'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          👥 Metas por Vendedor
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'empresa' ? (
          <motion.div
            key="empresa-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Top Warning/Info bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-high p-4 rounded-2xl border border-surface-container-highest animate-in fade-in">
              <div className="flex items-center gap-3">
                <Calendar className="text-primary animate-pulse" size={24} />
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface">Seleção do Período de Gestão</h3>
                  <p className="text-xs text-on-surface-variant">Selecione o mês e o ano para visualizar ou editar as metas empresariais do período.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="flex-1 md:flex-initial text-xs font-black uppercase tracking-wider p-2 bg-surface border border-surface-container-highest rounded-xl cursor-pointer"
                >
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="flex-1 md:flex-initial text-xs font-black uppercase tracking-wider p-2 bg-surface border border-surface-container-highest rounded-xl cursor-pointer"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Planejador de Meta Anual */}
            <div className="bg-surface p-6 rounded-3xl border border-surface-container-high shadow-xs space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2.5 bg-primary/10 text-primary text-[10px] font-black rounded-lg uppercase tracking-wider">
                      Gerenciamento Anual
                    </span>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface">Planejamento de Faturamento Anual ({selectedYear})</h3>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Defina a meta anual consolidada do faturamento e divida-a de forma igualitária (1/12) para cada mês de {selectedYear}. Isso atualizará automaticamente todas as metas mensais.
                  </p>
                </div>
                
                {/* Meta Acumulada no Ano */}
                <div className="bg-surface-container-high border border-surface-container-highest rounded-2xl p-4 text-left md:text-right shrink-0 min-w-[220px]">
                  <span className="text-[9px] font-black uppercase text-on-surface-variant block tracking-wider">Meta Total Planejada em {selectedYear}</span>
                  <span className="text-xl font-black font-mono text-on-surface block mt-1">
                    R$ {currentYearMetasValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] font-semibold text-on-surface-variant block mt-0.5">Acumulado das metas individuais</span>
                </div>
              </div>

              {isAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-4 border-t border-dashed border-surface-container-high">
                  <div className="md:col-span-5 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">Meta de Faturamento para o Ano Inteiro (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-on-surface-variant">R$</span>
                      <input
                        type="number"
                        value={metaAnualDigitada}
                        onChange={(e) => setMetaAnualDigitada(e.target.value)}
                        placeholder="Ex: 1200000"
                        className="w-full pl-9 pr-4 py-2.5 text-sm font-bold bg-surface-container-lowest border border-surface-container-highest rounded-xl outline-none focus:border-primary font-mono text-on-surface"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-7 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={isDistribuindoAnual || !metaAnualDigitada}
                      onClick={handleDistribuirMetaAnual}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-primary text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary/95 transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    >
                      {isDistribuindoAnual ? 'Salvando...' : `Dividir igualmente em 12 meses (R$ ${(parseFloat(metaAnualDigitada) / 12 || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês)`}
                    </button>
                    {metaAnualDigitada && (
                      <button
                        type="button"
                        onClick={() => setMetaAnualDigitada('')}
                        className="px-4 py-3.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-[10px] uppercase tracking-widest rounded-xl transition duration-200 cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {!isAdmin && (
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 p-4 rounded-2xl">
                <Lock size={18} className="mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider">Modo de Apenas Visualização</h4>
                  <p className="text-[11px] leading-relaxed">Você está visualizando as metas definidas para este mês. Alterações são permitidas exclusivamente para administradores.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveEnterprise} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Faturamento */}
                <div className="bg-surface p-6 rounded-3xl border border-surface-container-high shadow-xs space-y-4 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                        <TrendingUp size={20} />
                      </span>
                      <span className="text-[10px] font-black uppercase text-slate-400">Meta Geral</span>
                    </div>
                    <h4 className="text-sm font-bold uppercase text-on-surface">Meta de Faturamento Mensal</h4>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Montante bruto total faturado no mês (vendas, contratos recorrentes e mensalidades).</p>
                  </div>
                  <div className="pt-4 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">Objetivo (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-on-surface-variant">R$</span>
                      <input
                        type="number"
                        disabled={!isAdmin}
                        value={faturamento || ''}
                        onChange={(e) => setFaturamento(Number(e.target.value))}
                        placeholder="0,00"
                        className="w-full pl-9 pr-4 py-2 text-sm font-bold bg-surface-container-lowest border border-surface-container-highest rounded-xl outline-none focus:border-primary disabled:opacity-75 disabled:cursor-not-allowed font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Lucro Líquido */}
                <div className="bg-surface p-6 rounded-3xl border border-surface-container-high shadow-xs space-y-4 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                        <CircleDollarSign size={20} />
                      </span>
                      <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">Foco Financeiro</span>
                    </div>
                    <h4 className="text-sm font-bold uppercase text-on-surface">Meta de Lucro Líquido</h4>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Resultado operacional líquido líquido desejado para o mês de operação após todas as deduções.</p>
                  </div>
                  <div className="pt-4 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">Objetivo (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-on-surface-variant">R$</span>
                      <input
                        type="number"
                        disabled={!isAdmin}
                        value={lucro || ''}
                        onChange={(e) => setLucro(Number(e.target.value))}
                        placeholder="0,00"
                        className="w-full pl-9 pr-4 py-2 text-sm font-bold bg-surface-container-lowest border border-surface-container-highest rounded-xl outline-none focus:border-emerald-500 disabled:opacity-75 disabled:cursor-not-allowed font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Margem Líquida */}
                <div className="bg-surface p-6 rounded-3xl border border-surface-container-high shadow-xs space-y-4 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                        <Percent size={20} />
                      </span>
                      <span className="text-[10px] font-black uppercase text-slate-400">Eficiência</span>
                    </div>
                    <h4 className="text-sm font-bold uppercase text-on-surface">Meta de Margem Líquida (%)</h4>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Taxa percentual desejada de rentabilidade final calculada dividindo Lucro Líquido por Faturamento.</p>
                  </div>
                  <div className="pt-4 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">Margem Desejada (%)</label>
                    <div className="relative">
                      <span className="absolute right-3 top-2.5 text-xs font-bold text-on-surface-variant">%</span>
                      <input
                        type="number"
                        disabled={!isAdmin}
                        value={margem || ''}
                        onChange={(e) => setMargem(Number(e.target.value))}
                        placeholder="0"
                        className="w-full pl-4 pr-8 py-2 text-sm font-bold bg-surface-container-lowest border border-surface-container-highest rounded-xl outline-none focus:border-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Caixa Mínimo */}
                <div className="bg-surface p-6 rounded-3xl border border-surface-container-high shadow-xs space-y-4 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
                        <Coins size={20} />
                      </span>
                      <span className="text-[10px] font-black uppercase text-slate-400">Giro Seguro</span>
                    </div>
                    <h4 className="text-sm font-bold uppercase text-on-surface">Meta de Caixa Mínimo</h4>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Reserva de liquidez mínima tolerada no final do mês para garantir segurança do caixa operacional.</p>
                  </div>
                  <div className="pt-4 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">Alvo Mínimo (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-on-surface-variant">R$</span>
                      <input
                        type="number"
                        disabled={!isAdmin}
                        value={caixa || ''}
                        onChange={(e) => setCaixa(Number(e.target.value))}
                        placeholder="0,00"
                        className="w-full pl-9 pr-4 py-2 text-sm font-bold bg-surface-container-lowest border border-surface-container-highest rounded-xl outline-none focus:border-amber-500 disabled:opacity-75 disabled:cursor-not-allowed font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Receita Recorrente (MRR) */}
                <div className="bg-surface p-6 rounded-3xl border border-surface-container-high shadow-xs space-y-4 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="p-2 bg-violet-500/10 text-violet-500 rounded-xl">
                        <Target size={20} />
                      </span>
                      <span className="text-[10px] font-black uppercase text-slate-400">Recorrência</span>
                    </div>
                    <h4 className="text-sm font-bold uppercase text-on-surface">Meta de Receita Recorrente (MRR)</h4>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Base garantida vindo das assinaturas de suporte ativo e mensalidades contratadas.</p>
                  </div>
                  <div className="pt-4 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">Recorrência Alvo (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-on-surface-variant">R$</span>
                      <input
                        type="number"
                        disabled={!isAdmin}
                        value={mrr || ''}
                        onChange={(e) => setMrr(Number(e.target.value))}
                        placeholder="0,00"
                        className="w-full pl-9 pr-4 py-2 text-sm font-bold bg-surface-container-lowest border border-surface-container-highest rounded-xl outline-none focus:border-violet-500 disabled:opacity-75 disabled:cursor-not-allowed font-mono"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {isAdmin && (
                <div className="flex justify-end pt-4 border-t border-surface-container-high">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 border border-slate-800 text-white font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-850 transition duration-200 shadow-lg disabled:opacity-50"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Metas da Empresa'}
                  </button>
                </div>
              )}
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="comercial-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Top Vendor Selection bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-high p-4 rounded-2xl border border-surface-container-highest">
              <div className="flex items-center gap-3">
                <Users className="text-primary" size={24} />
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface">Seleção do Vendedor</h3>
                  <p className="text-xs text-on-surface-variant">Selecione o membro comercial para o qual deseja gerenciar as metas individuais de entrega.</p>
                </div>
              </div>

              <div className="w-full md:w-auto">
                <select
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="w-full md:w-64 text-xs font-black uppercase tracking-wider p-2 bg-surface border border-surface-container-highest rounded-xl cursor-pointer"
                >
                  <option value="" disabled>Selecione um vendedor...</option>
                  {vendedores.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.nome || v.displayName || v.email}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedVendorId ? (
              <form onSubmit={handleSaveVendorGoals} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Faturamento Alvo */}
                  <div className="bg-surface p-6 rounded-3xl border border-surface-container-high shadow-xs space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                          <TrendingUp size={20} />
                        </span>
                        <span className="text-[10px] font-black uppercase text-slate-400">Vendas</span>
                      </div>
                      <h4 className="text-sm font-bold uppercase text-on-surface">Meta de Faturamento Mensal</h4>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">Valor total em reais de propostas/vendas faturadas exigidas para o vendedor no mês.</p>
                    </div>
                    <div className="pt-4 space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">Alvo Mensal (R$)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs font-bold text-on-surface-variant">R$</span>
                        <input
                          type="number"
                          disabled={!isAdmin}
                          value={vendorFaturamento || ''}
                          onChange={(e) => setVendorFaturamento(Number(e.target.value))}
                          placeholder="0,00"
                          className="w-full pl-9 pr-4 py-2 text-sm font-bold bg-surface-container-lowest border border-surface-container-highest rounded-xl outline-none focus:border-primary font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Meta de Propostas */}
                  <div className="bg-surface p-6 rounded-3xl border border-surface-container-high shadow-xs space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                          <FileText size={20} />
                        </span>
                        <span className="text-[10px] font-black uppercase text-slate-400 font-sans">Prospecção</span>
                      </div>
                      <h4 className="text-sm font-bold uppercase text-on-surface">Meta de Orçamentos / Propostas Enviadas</h4>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">Número de propostas comerciais de vendas ativas que o vendedor deve emitir e enviar para prospects.</p>
                    </div>
                    <div className="pt-4 space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">Quantidade Mínima</label>
                      <input
                        type="number"
                        disabled={!isAdmin}
                        value={vendorPropostas || ''}
                        onChange={(e) => setVendorPropostas(Number(e.target.value))}
                        placeholder="Ex: 10"
                        className="w-full px-4 py-2 text-sm font-bold bg-surface-container-lowest border border-surface-container-highest rounded-xl outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Meta de Novos Clientes */}
                  <div className="bg-surface p-6 rounded-3xl border border-surface-container-high shadow-xs space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                          <UserCheck size={20} />
                        </span>
                        <span className="text-[10px] font-black uppercase text-slate-400">Conversão</span>
                      </div>
                      <h4 className="text-sm font-bold uppercase text-on-surface">Meta de Novos Clientes Convertidos</h4>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">Quantidade mínima de cadastros de novos parceiros comerciais convertidos de Leads para Clientes.</p>
                    </div>
                    <div className="pt-4 space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">Quantidade Mínima</label>
                      <input
                        type="number"
                        disabled={!isAdmin}
                        value={vendorNovosClientes || ''}
                        onChange={(e) => setVendorNovosClientes(Number(e.target.value))}
                        placeholder="Ex: 5"
                        className="w-full px-4 py-2 text-sm font-bold bg-surface-container-lowest border border-surface-container-highest rounded-xl outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Meta de Comissão */}
                  <div className="bg-surface p-6 rounded-3xl border border-surface-container-high shadow-xs space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                          <Coins size={20} />
                        </span>
                        <span className="text-[10px] font-black uppercase text-slate-400">Aceleração</span>
                      </div>
                      <h4 className="text-sm font-bold uppercase text-on-surface">Comissão Estimada no Mês</h4>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">Estimativa de retribuição financeira em comissões que o vendedor pretende angariar no mês de trabalho.</p>
                    </div>
                    <div className="pt-4 space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#54656f] block">Objetivo (R$)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs font-bold text-on-surface-variant">R$</span>
                        <input
                          type="number"
                          disabled={!isAdmin}
                          value={vendorComissao || ''}
                          onChange={(e) => setVendorComissao(Number(e.target.value))}
                          placeholder="0,00"
                          className="w-full pl-9 pr-4 py-2 text-sm font-bold bg-surface-container-lowest border border-surface-container-highest rounded-xl outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                </div>

                {isAdmin && (
                  <div className="flex justify-end pt-4 border-t border-surface-container-high">
                    <button
                      type="submit"
                      disabled={isSavingVendor}
                      className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 border border-slate-800 text-white font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-850 transition duration-200 shadow-lg disabled:opacity-50"
                    >
                      {isSavingVendor ? 'Salvando...' : 'Salvar Metas do Vendedor'}
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <div className="flex flex-col items-center justify-center p-20 text-on-surface-variant border border-dashed border-surface-container-highest rounded-3xl gap-4">
                <Users size={48} className="opacity-20 animate-pulse" />
                <p className="text-xs uppercase font-extrabold tracking-widest">Nenhum vendedor cadastrado ou selecionado no momento.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
