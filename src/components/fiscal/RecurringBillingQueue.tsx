import React, { MutableRefObject, useEffect, useMemo, useState } from 'react';
import { CheckSquare, RefreshCw, Square } from 'lucide-react';
import { Cliente, ConfiguracaoFiscal, ContratoRecorrente, FaturamentoRecorrente, Usuario } from '../../types';
import { generateRecurringBillings, listRecurringBillings, updateRecurringBilling } from '../../services/recurringBillingService';
import { buildValidatedNfseDraft, issueNfseWithValidatedEngine } from '../../services/nfseIssuanceService';

export default function RecurringBillingQueue({ user, contracts, clients, config, credentialsRef, environment = 'producao', onCompleted }: { user: Usuario; contracts: ContratoRecorrente[]; clients: Cliente[]; config: ConfiguracaoFiscal | null; credentialsRef: MutableRefObject<Record<string, unknown> | null>; environment?: 'producao' | 'producao_restrita'; onCompleted?: () => void }) {
  const [items, setItems] = useState<FaturamentoRecorrente[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const companyId = user.companyId || 'default';
  const competence = new Date().toISOString().slice(0, 7);
  const refresh = async () => {
    setLoading(true);
    try {
      await generateRecurringBillings(companyId, contracts, clients, competence, environment);
      setItems((await listRecurringBillings(companyId)).filter(item => item.competence === competence));
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [companyId, competence, contracts.length, clients.length, environment]);
  const ready = items.filter(item => item.status === 'PRONTO_PARA_EMITIR');
  const chosen = useMemo(() => items.filter(item => selected.includes(item.id)), [items, selected]);
  const total = chosen.reduce((sum, item) => sum + item.expectedAmount, 0);
  const processSequentially = async () => {
    if (!credentialsRef.current) { setMessage('Valide a senha do certificado A1 uma única vez antes de iniciar o lote.'); return; }
    if (!config) { setMessage('Configuração fiscal da empresa indisponível.'); return; }
    setProcessing(true); setMessage('');
    for (const billing of chosen) {
      const client = clients.find(item => item.id === billing.clientId);
      if (!client) { await updateRecurringBilling(billing.id, { status: 'PENDENCIA_CADASTRAL', missingFields: ['cliente'] }); continue; }
      try {
        await updateRecurringBilling(billing.id, { status: 'EM_PROCESSAMENTO' });
        const fiscal = billing.fiscalSnapshot as any;
        const draft = buildValidatedNfseDraft({ client, config, description: billing.description, amount: billing.expectedAmount, competence: billing.competence, issWithheld: fiscal.issRetido === true, credentials: credentialsRef.current, recurring: billing });
        const result: any = await issueNfseWithValidatedEngine(draft);
        if (result?.result !== 'AUTORIZADA' || !result?.accessKey) throw Object.assign(new Error(result?.message || 'NFS-e não autorizada.'), { code: result?.code });
        await updateRecurringBilling(billing.id, { status: 'AUTORIZADA', nfseNumber: result.nfseNumber, dpsNumber: result.dpsId, officialAccessKey: result.accessKey, authorizedAt: new Date().toISOString(), authorizedXml: result.xmlStored ? 'private' : undefined, danfseReference: result.danfseAvailable ? result.accessKey : undefined });
      } catch (error: any) {
        const inconclusive = /timeout|inconclus/i.test(String(error?.message || ''));
        await updateRecurringBilling(billing.id, { status: inconclusive ? 'EM_PROCESSAMENTO' : 'REJEITADA', sefinError: { code: error?.code, message: inconclusive ? `INCONCLUSIVO: ${error.message}` : (error?.message || 'Falha fiscal') } });
      }
    }
    setConfirming(false); setSelected([]); setProcessing(false); await refresh(); onCompleted?.();
  };
  return <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/30 overflow-hidden">
    <div className="p-4 flex items-center justify-between gap-3 border-b border-blue-100">
      <div><h3 className="font-extrabold text-slate-800">FATURAMENTO RECORRENTE</h3><p className="text-xs text-slate-500">Competência {competence} · preparação sem emissão automática</p></div>
      <button type="button" onClick={() => void refresh()} className="p-2 rounded-lg bg-white border" title="Atualizar fila"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/></button>
    </div>
    <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-[10px] uppercase text-slate-500 bg-white/70"><th className="p-3"></th><th>Cliente</th><th>Contrato</th><th>Competência</th><th>Descrição</th><th>Valor</th><th>Faturamento</th><th>Vencimento</th><th>Status</th><th>Ambiente</th></tr></thead>
      <tbody>{items.map(item => { const selectable = item.status === 'PRONTO_PARA_EMITIR'; const checked = selected.includes(item.id); return <tr key={item.id} className="border-t border-blue-100 bg-white/60"><td className="p-3"><button type="button" disabled={!selectable} onClick={() => setSelected(old => checked ? old.filter(id => id !== item.id) : [...old, item.id])}>{checked ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16} className={selectable ? '' : 'opacity-30'}/>}</button></td><td className="font-bold">{item.clientName}</td><td>{item.contractNumber}</td><td>{item.competence}</td><td className="max-w-56 truncate">{item.description}</td><td>R$ {item.expectedAmount.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td><td>{item.billingDate}</td><td>{item.dueDate}</td><td><span className={item.status === 'PRONTO_PARA_EMITIR' ? 'text-emerald-700 font-bold' : item.status === 'PENDENCIA_CADASTRAL' ? 'text-amber-700 font-bold' : 'font-bold'} title={item.missingFields.join(', ')}>{item.status.replaceAll('_',' ')}</span></td><td>{item.environment === 'producao' ? 'Produção Real' : 'Produção Restrita'}</td></tr>})}</tbody>
    </table></div>
    <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100"><button type="button" onClick={() => setSelected(selected.length === ready.length ? [] : ready.map(item => item.id))} className="text-xs font-bold text-blue-700">{selected.length === ready.length && ready.length ? 'DESMARCAR TODAS' : 'SELECIONAR PRONTAS'}</button><button type="button" disabled={!chosen.length} onClick={() => setConfirming(true)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-40">EMITIR NFS-e SELECIONADAS</button></div>
    {message && <p className="p-3 text-xs font-bold text-amber-700 bg-amber-50 border-t">{message}</p>}
    {confirming && <div className="p-4 border-t border-blue-200 bg-white"><p className="font-bold">Confirmar emissão individual sequencial</p><p className="text-xs mt-1">Quantidade: {chosen.length} · Total: R$ {total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p><p className="text-xs text-slate-500 mt-1">{chosen.map(item => item.clientName).join(', ')}</p><div className="mt-3 flex gap-2"><button disabled={processing} onClick={() => setConfirming(false)} className="px-3 py-2 border rounded-lg text-xs font-bold">VOLTAR</button><button disabled={processing} onClick={() => void processSequentially()} className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-50">{processing ? 'PROCESSANDO UMA POR VEZ...' : 'CONFIRMAR EMISSÃO'}</button></div></div>}
  </div>;
}
