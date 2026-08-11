import React, { MutableRefObject, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CheckSquare, Download, FileText, Printer, RefreshCw, Square, X } from 'lucide-react';
import { Cliente, ConfiguracaoFiscal, ContratoRecorrente, FaturamentoRecorrente, Usuario } from '../../types';
import { buildRecurringBilling, generateRecurringBillings, listRecurringBillings, updateRecurringBilling } from '../../services/recurringBillingService';
import { buildValidatedNfseDraft, issueNfseWithValidatedEngine, validateNfseDraftData } from '../../services/nfseIssuanceService';
import { databaseService } from '../../services/databaseService';
import { fiscalApi } from '../../services/fiscalApi';

type Props = { user: Usuario; contracts: ContratoRecorrente[]; clients: Cliente[]; config: ConfiguracaoFiscal | null; credentialsRef: MutableRefObject<Record<string, unknown> | null>; environment?: 'producao' | 'producao_restrita'; onCompleted?: () => void | Promise<void> };
const digits = (value?: unknown) => String(value || '').replace(/\D/g, '');

export default function RecurringBillingQueue({ user, contracts, clients, config, credentialsRef, environment = 'producao', onCompleted }: Props) {
  const [items, setItems] = useState<FaturamentoRecorrente[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<FaturamentoRecorrente | null>(null);
  const [clientDraft, setClientDraft] = useState<Partial<Cliente>>({});
  const [fiscalDraft, setFiscalDraft] = useState<NonNullable<ContratoRecorrente['fiscal']> | null>(null);
  const [configDraft, setConfigDraft] = useState<ConfiguracaoFiscal | null>(config);
  const [saving, setSaving] = useState(false);
  const [documentLoading, setDocumentLoading] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [batchSummary, setBatchSummary] = useState<{ processed: number; authorized: number; errors: number; billedAmount: number; items: FaturamentoRecorrente[] } | null>(null);
  const companyId = user.companyId || 'default';
  const competence = new Date().toISOString().slice(0, 7);

  const refresh = async () => {
    setLoading(true);
    try {
      await generateRecurringBillings(companyId, contracts, clients, competence, environment, configDraft || config);
      setItems((await listRecurringBillings(companyId)).filter(item => item.competence === competence && contracts.some(contract => contract.id === item.contractId)));
    } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [companyId, competence, contracts.length, clients.length, environment, config?.updatedAt]);

  const ready = items.filter(item => item.status === 'PRONTO_PARA_EMITIR');
  const chosen = useMemo(() => items.filter(item => selected.includes(item.id)), [items, selected]);
  const total = chosen.reduce((sum, item) => sum + item.expectedAmount, 0);
  const toggleSelection = (id: string) => setSelected(current => current.includes(id) ? current.filter(itemId => itemId !== id) : [...current, id]);
  const editingContract = editing ? contracts.find(contract => contract.id === editing.contractId) : undefined;
  const editingClient = editing ? clients.find(client => client.id === editing.clientId) : undefined;
  const previewClient = editingClient ? ({ ...editingClient, ...clientDraft } as Cliente) : undefined;
  const previewContract = editingContract && fiscalDraft ? ({ ...editingContract, fiscal: fiscalDraft } as ContratoRecorrente) : editingContract;
  const previewBilling = editing && previewContract ? buildRecurringBilling(companyId, previewContract, previewClient, editing.competence, environment, configDraft || config) : editing;
  const issues = previewBilling ? validateNfseDraftData({ client: previewClient, config: configDraft || config, description: previewBilling.description, amount: previewBilling.expectedAmount, competence: previewBilling.competence, recurring: previewBilling, issWithheld: previewContract?.fiscal?.issRetido }) : [];
  const issueKeys = new Set(issues.map(issue => issue.key));

  const openIssues = (billing: FaturamentoRecorrente) => {
    const client = clients.find(item => item.id === billing.clientId);
    const contract = contracts.find(item => item.id === billing.contractId);
    setEditing(billing); setClientDraft(client ? { ...client } : {}); setFiscalDraft(contract?.fiscal ? { ...contract.fiscal } : null); setConfigDraft(config); setMessage('');
  };

  const saveAndRevalidate = async () => {
    if (!editing || !editingClient || !editingContract || !fiscalDraft || !configDraft) return;
    setSaving(true); setMessage('');
    try {
      const nextClient = { ...editingClient, ...clientDraft } as Cliente;
      const nextContract = { ...editingContract, fiscal: fiscalDraft, descricaoServico: fiscalDraft.descricaoServico, valorMensal: Number(fiscalDraft.valorNfse || editingContract.valorMensal) } as ContratoRecorrente;
      await databaseService.updateCliente(editingClient.id, clientDraft);
      await databaseService.updateContratoRecorrente(editingContract.id, { fiscal: fiscalDraft, descricaoServico: nextContract.descricaoServico, valorMensal: nextContract.valorMensal });
      await databaseService.saveConfiguracaoFiscal(configDraft);
      const candidate = buildRecurringBilling(companyId, nextContract, nextClient, editing.competence, environment, configDraft);
      await updateRecurringBilling(editing.id, candidate);
      setItems(old => old.map(item => item.id === candidate.id ? candidate : item));
      if (candidate.status === 'PRONTO_PARA_EMITIR') { setEditing(null); setMessage('Cadastro validado. Cobrança pronta para faturar.'); }
      else { setEditing(candidate); setMessage(`Ainda existem ${candidate.missingFields.length} pendência(s).`); }
      await Promise.resolve(onCompleted?.());
    } catch (error: any) { setMessage(error?.message || 'Falha ao salvar as correções.'); }
    finally { setSaving(false); }
  };

  const processSequentially = async () => {
    if (!credentialsRef.current) { setMessage('Valide a senha do certificado A1 uma única vez antes de iniciar o lote.'); return; }
    if (!config) { setMessage('Configuração fiscal da empresa indisponível.'); return; }
    setProcessing(true); setMessage('');
    const processedItems: FaturamentoRecorrente[] = [];
    let authorizedCount = 0;
    let errorCount = 0;
    let billedAmount = 0;
    for (const billing of chosen) {
      const client = clients.find(item => item.id === billing.clientId);
      if (!client) { await updateRecurringBilling(billing.id, { status: 'PENDENCIA_CADASTRAL', missingFields: ['Cliente/tomador não localizado'] }); errorCount += 1; continue; }
      try {
        await updateRecurringBilling(billing.id, { status: 'EM_PROCESSAMENTO' });
        const fiscal = billing.fiscalSnapshot as any;
        const draft = buildValidatedNfseDraft({ client, config, description: billing.description, amount: billing.expectedAmount, competence: billing.competence, issWithheld: fiscal.issRetido === true, credentials: credentialsRef.current, recurring: billing });
        const result: any = await issueNfseWithValidatedEngine(draft);
        if (result?.result !== 'AUTORIZADA' || !result?.accessKey) throw Object.assign(new Error(result?.message || 'NFS-e não autorizada.'), { code: result?.code });
        const authorizedItem = { ...billing, status: 'AUTORIZADA', nfseNumber: result.nfseNumber, dpsNumber: result.dpsId, officialAccessKey: result.accessKey, authorizedAt: new Date().toISOString(), authorizedXml: result.xmlStored ? 'private' : undefined, danfseReference: result.danfseAvailable ? result.accessKey : undefined } as FaturamentoRecorrente;
        await updateRecurringBilling(billing.id, authorizedItem);
        processedItems.push(authorizedItem); authorizedCount += 1; billedAmount += billing.expectedAmount;
      } catch (error: any) {
        const inconclusive = /timeout|inconclus/i.test(String(error?.message || ''));
        await updateRecurringBilling(billing.id, { status: inconclusive ? 'EM_PROCESSAMENTO' : 'REJEITADA', sefinError: { code: error?.code, message: inconclusive ? `INCONCLUSIVO: ${error.message}` : (error?.message || 'Falha fiscal') } });
        errorCount += 1;
      }
    }
    setBatchSummary({ processed: chosen.length, authorized: authorizedCount, errors: errorCount, billedAmount, items: processedItems });
    setConfirming(false); setSelected([]); setProcessing(false); await refresh(); await Promise.resolve(onCompleted?.());
  };

  const inputClass = (bad: boolean) => `w-full rounded-lg border px-3 py-2 text-xs outline-none ${bad ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`;
  const statusLabel = (item: FaturamentoRecorrente) => item.status === 'AUTORIZADA' ? `✓ NFS-e emitida nº ${item.nfseNumber || '-'}` : item.status === 'PRONTO_PARA_EMITIR' ? '✓ Pronta para faturar' : item.status.replaceAll('_', ' ');

  const accessKey = (item: FaturamentoRecorrente) => String(item.officialAccessKey || item.danfseReference || '');
  const auditDocument = async (item: FaturamentoRecorrente, action: 'consulta_nfse' | 'download_xml_nfse' | 'download_danfse_nfse' | 'impressao_nfse') => {
    try { await databaseService.createFiscalAuditLog({ userId: user.id, userName: user.nome, action, tipoDocumento: 'nfse', documentNumero: item.nfseNumber || '', details: `Cobrança recorrente ${item.contractNumber} · competência ${item.competence}` }); } catch { /* O documento continua disponível mesmo se a auditoria estiver temporariamente indisponível. */ }
  };
  const viewDanfse = async (item: FaturamentoRecorrente) => {
    const key = accessKey(item); if (!key) return setMessage('Chave oficial da NFS-e não encontrada.');
    const popup = window.open('', '_blank'); if (!popup) return setMessage('Permita a abertura da visualização do DANFSe.');
    popup.document.body.textContent = 'Preparando DANFSe v2.0...'; setDocumentLoading(item.id);
    try { const file = await fiscalApi.prepareDanfseV2(key); const url = URL.createObjectURL(file.blob); popup.location.href = url; setTimeout(() => URL.revokeObjectURL(url), 60_000); await auditDocument(item, 'consulta_nfse'); }
    catch (error) { popup.close(); setMessage(error instanceof Error ? error.message : 'Falha ao visualizar DANFSe.'); }
    finally { setDocumentLoading(''); }
  };
  const printDanfse = async (item: FaturamentoRecorrente) => {
    const key = accessKey(item); if (!key) return setMessage('Chave oficial da NFS-e não encontrada.');
    const popup = window.open('', '_blank'); if (!popup) return setMessage('Permita a abertura da impressão.');
    popup.document.body.textContent = 'Preparando impressão...'; setDocumentLoading(item.id);
    try { const file = await fiscalApi.prepareDanfseV2(key); const url = URL.createObjectURL(file.blob); popup.location.href = url; popup.addEventListener('load', () => { popup.focus(); popup.print(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }, { once: true }); await auditDocument(item, 'impressao_nfse'); }
    catch (error) { popup.close(); setMessage(error instanceof Error ? error.message : 'Falha ao imprimir DANFSe.'); }
    finally { setDocumentLoading(''); }
  };
  const downloadDanfse = async (item: FaturamentoRecorrente) => { const key = accessKey(item); if (!key) return setMessage('Chave oficial da NFS-e não encontrada.'); setDocumentLoading(item.id); try { await fiscalApi.downloadDanfseV2(key); await auditDocument(item, 'download_danfse_nfse'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao baixar DANFSe.'); } finally { setDocumentLoading(''); } };
  const downloadXml = async (item: FaturamentoRecorrente) => { const key = accessKey(item); if (!key) return setMessage('Chave oficial da NFS-e não encontrada.'); setDocumentLoading(item.id); try { await fiscalApi.downloadAuthorizedXml(key); await auditDocument(item, 'download_xml_nfse'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao baixar XML.'); } finally { setDocumentLoading(''); } };
  const authorizedDocuments = items.filter(item => item.status === 'AUTORIZADA' && selectedDocuments.includes(item.id));
  const toggleDocument = (id: string) => setSelectedDocuments(current => current.includes(id) ? current.filter(itemId => itemId !== id) : [...current, id]);
  const downloadSelected = async (kind: 'xml' | 'danfse') => {
    setDocumentLoading(`batch-${kind}`); setMessage('');
    for (const item of authorizedDocuments) {
      try {
        if (kind === 'xml') await fiscalApi.downloadAuthorizedXml(accessKey(item));
        else await fiscalApi.downloadDanfseV2(accessKey(item));
        await auditDocument(item, kind === 'xml' ? 'download_xml_nfse' : 'download_danfse_nfse');
      } catch (error) { setMessage(error instanceof Error ? error.message : `Falha ao baixar ${kind}.`); break; }
    }
    setDocumentLoading('');
  };
  const printSelected = async () => {
    const jobs = authorizedDocuments.map(item => ({ item, popup: window.open('', '_blank') }));
    if (jobs.some(job => !job.popup)) { jobs.forEach(job => job.popup?.close()); return setMessage('Permita as janelas de impressão para imprimir as NFS-e selecionadas.'); }
    setDocumentLoading('batch-print'); setMessage('');
    for (const job of jobs) {
      try {
        job.popup!.document.body.textContent = `Preparando DANFSe da NFS-e ${job.item.nfseNumber || ''}...`;
        const file = await fiscalApi.prepareDanfseV2(accessKey(job.item)); const url = URL.createObjectURL(file.blob);
        job.popup!.location.href = url;
        job.popup!.addEventListener('load', () => { job.popup!.focus(); job.popup!.print(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }, { once: true });
        await auditDocument(job.item, 'impressao_nfse');
      } catch (error) { job.popup!.close(); setMessage(error instanceof Error ? error.message : 'Falha ao imprimir DANFSe.'); break; }
    }
    setDocumentLoading('');
  };

  return <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/30 overflow-hidden">
    <div className="p-4 flex items-center justify-between gap-3 border-b border-blue-100"><div><h3 className="font-extrabold text-slate-800">FATURAMENTO RECORRENTE</h3><p className="text-xs text-slate-500">Competência {competence} · {environment === 'producao' ? 'Produção Real' : 'Produção Restrita'}</p></div><button type="button" onClick={() => void refresh()} className="p-2 rounded-lg bg-white border" title="Atualizar fila"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/></button></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-xs"><thead><tr className="text-left text-[10px] uppercase text-slate-500 bg-white/70"><th className="p-3 w-20">Selecionar</th><th className="p-3">Cliente</th><th className="p-3">Contrato</th><th className="p-3">Competência</th><th className="p-3">Serviço</th><th className="p-3">Valor</th><th className="p-3">Faturamento</th><th className="p-3">Vencimento</th><th className="p-3">Status</th><th className="p-3">Ação</th></tr></thead>
      <tbody>{items.map(item => { const selectable = item.status === 'PRONTO_PARA_EMITIR'; const checked = selected.includes(item.id); const documentChecked = selectedDocuments.includes(item.id); const busy = documentLoading === item.id; return <tr key={item.id} className="border-t border-blue-100 bg-white/60"><td className="p-3"><button type="button" aria-label={item.status === 'AUTORIZADA' ? `Selecionar documentos da NFS-e ${item.nfseNumber || ''}` : `Selecionar ${item.clientName}`} disabled={!selectable && item.status !== 'AUTORIZADA'} onClick={() => item.status === 'AUTORIZADA' ? toggleDocument(item.id) : toggleSelection(item.id)}>{(item.status === 'AUTORIZADA' ? documentChecked : checked) ? <CheckSquare size={17} className="text-blue-600"/> : <Square size={17} className={(selectable || item.status === 'AUTORIZADA') ? '' : 'opacity-30'}/>}</button></td><td className="p-3 font-bold">{item.clientName}</td><td className="p-3">{item.contractNumber}</td><td className="p-3">{item.competence}</td><td className="p-3 max-w-56 truncate">{item.description}</td><td className="p-3">R$ {item.expectedAmount.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td><td className="p-3">{item.billingDate}</td><td className="p-3">{item.dueDate}</td><td className="p-3 font-bold">{statusLabel(item)}</td><td className="p-3">{item.status === 'PENDENCIA_CADASTRAL' ? <button type="button" onClick={() => openIssues(item)} className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-2 font-bold text-amber-800"><AlertTriangle size={14}/> Ver pendências</button> : item.status === 'PRONTO_PARA_EMITIR' ? <span className="inline-flex items-center gap-1 text-emerald-700 font-bold"><CheckCircle2 size={14}/> Pronta para emissão</span> : item.status === 'AUTORIZADA' ? <div className="flex flex-wrap items-center gap-2"><button disabled={busy} onClick={() => void viewDanfse(item)} className="font-bold text-indigo-600 hover:underline disabled:opacity-40">Ver DANFSe</button><span className="text-slate-300">|</span><button disabled={busy} onClick={() => void printDanfse(item)} className="font-bold text-violet-600 hover:underline disabled:opacity-40">Imprimir</button><span className="text-slate-300">|</span><button disabled={busy} onClick={() => void downloadXml(item)} className="font-bold text-blue-600 hover:underline disabled:opacity-40">XML</button></div> : null}</td></tr>})}</tbody>
    </table></div>
    <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100"><button type="button" onClick={() => setSelected(selected.length === ready.length ? [] : ready.map(item => item.id))} className="text-xs font-bold text-blue-700">{selected.length === ready.length && ready.length ? 'DESMARCAR TODAS' : 'SELECIONAR PRONTAS'}</button><button type="button" disabled={!chosen.length} onClick={() => setConfirming(true)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-40">EMITIR NFS-e SELECIONADAS</button></div>
    {!!authorizedDocuments.length && <div className="flex flex-wrap items-center gap-2 border-t border-blue-100 bg-white p-4"><span className="mr-auto text-xs font-bold text-slate-600">{authorizedDocuments.length} NFS-e selecionada(s)</span><button disabled={!!documentLoading} onClick={() => void downloadSelected('danfse')} className="rounded-lg border px-3 py-2 text-xs font-bold"><Download size={14} className="mr-1 inline"/>Baixar DANFSe selecionadas</button><button disabled={!!documentLoading} onClick={() => void downloadSelected('xml')} className="rounded-lg border px-3 py-2 text-xs font-bold"><Download size={14} className="mr-1 inline"/>Baixar XML selecionados</button><button disabled={!!documentLoading} onClick={() => void printSelected()} className="rounded-lg border px-3 py-2 text-xs font-bold"><Printer size={14} className="mr-1 inline"/>Imprimir selecionadas</button></div>}
    {batchSummary && <div className="border-t border-emerald-200 bg-emerald-50 p-4"><h4 className="font-extrabold text-emerald-900">Faturamento concluído</h4><div className="mt-2 grid gap-2 text-xs text-emerald-900 sm:grid-cols-2 lg:grid-cols-4"><span>{batchSummary.processed} contratos processados</span><span>{batchSummary.authorized} NFS-e autorizadas</span><span>{batchSummary.errors} com erro</span><span>Valor faturado: R$ {batchSummary.billedAmount.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></div>{!!batchSummary.items.length && <button onClick={() => setSelectedDocuments(batchSummary.items.map(item => item.id))} className="mt-3 text-xs font-bold text-emerald-800 underline">Selecionar documentos autorizados deste lote</button>}</div>}
    {message && <p className="p-3 text-xs font-bold text-amber-700 bg-amber-50 border-t">{message}</p>}
    {confirming && <div className="p-4 border-t border-blue-200 bg-white"><p className="font-bold">Confirmar emissão individual sequencial</p><p className="text-xs mt-1">Quantidade: {chosen.length} · Total: R$ {total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p><div className="mt-3 flex gap-2"><button disabled={processing} onClick={() => setConfirming(false)} className="px-3 py-2 border rounded-lg text-xs font-bold">VOLTAR</button><button disabled={processing} onClick={() => void processSequentially()} className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-50">{processing ? 'PROCESSANDO UMA POR VEZ...' : 'CONFIRMAR EMISSÃO'}</button></div></div>}

    {editing && <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/45 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5"><div><h2 className="font-extrabold text-slate-900">Pendências para emissão da NFS-e</h2><p className="text-xs text-slate-500">{editing.clientName} · {editing.contractNumber}</p></div><button onClick={() => setEditing(null)}><X size={20}/></button></div>
      <div className="p-5"><div className="mb-5 space-y-2 rounded-xl border p-4">{issues.length ? issues.map(issue => <div key={issue.key} className="flex items-center gap-2 text-sm text-rose-700"><AlertTriangle size={15}/><span>{issue.label}</span><span className="ml-auto text-[10px] uppercase text-slate-400">Salvar em {issue.origin === 'cliente' ? 'Dados do cliente' : issue.origin === 'contrato' ? 'Dados fiscais do contrato' : 'Configuração fiscal'}</span></div>) : <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={16}/> Todos os dados estão válidos.</div>}</div>
        <div className="grid gap-5 md:grid-cols-2"><section className="space-y-3 rounded-xl border p-4"><h3 className="font-bold">Dados do cliente</h3><label className="block text-xs">CNPJ <input value={String(clientDraft.cnpj || '')} onChange={e=>setClientDraft(v=>({...v,cnpj:e.target.value}))} className={inputClass(issueKeys.has('clientTaxId'))}/></label><label className="block text-xs">Razão Social <input value={String(clientDraft.razaoSocial || '')} onChange={e=>setClientDraft(v=>({...v,razaoSocial:e.target.value}))} className={inputClass(issueKeys.has('clientName'))}/></label><label className="block text-xs">Município/IBGE <input value={String(clientDraft.codigoIbge || '')} onChange={e=>setClientDraft(v=>({...v,codigoIbge:e.target.value}))} className={inputClass(issueKeys.has('clientMunicipalityCode'))}/></label><div className="grid grid-cols-2 gap-2"><label className="text-xs">CEP<input value={String(clientDraft.cep || '')} onChange={e=>setClientDraft(v=>({...v,cep:e.target.value}))} className={inputClass(issueKeys.has('clientAddress'))}/></label><label className="text-xs">UF<input value={String(clientDraft.estado || '')} onChange={e=>setClientDraft(v=>({...v,estado:e.target.value}))} className={inputClass(false)}/></label><label className="text-xs">Logradouro<input value={String(clientDraft.rua || '')} onChange={e=>setClientDraft(v=>({...v,rua:e.target.value}))} className={inputClass(issueKeys.has('clientAddress'))}/></label><label className="text-xs">Número<input value={String(clientDraft.numero || '')} onChange={e=>setClientDraft(v=>({...v,numero:e.target.value}))} className={inputClass(issueKeys.has('clientAddress'))}/></label><label className="text-xs">Bairro<input value={String(clientDraft.bairro || '')} onChange={e=>setClientDraft(v=>({...v,bairro:e.target.value}))} className={inputClass(issueKeys.has('clientAddress'))}/></label><label className="text-xs">Município<input value={String(clientDraft.cidade || '')} onChange={e=>setClientDraft(v=>({...v,cidade:e.target.value}))} className={inputClass(false)}/></label></div></section>
          <section className="space-y-3 rounded-xl border p-4"><h3 className="font-bold">Dados fiscais do contrato</h3>{fiscalDraft && <><label className="block text-xs">Descrição fiscal<input value={fiscalDraft.descricaoServico} onChange={e=>setFiscalDraft(v=>v&&({...v,descricaoServico:e.target.value}))} className={inputClass(issueKeys.has('serviceDescription'))}/></label><label className="block text-xs">Código tributação NFS-e<input value={fiscalDraft.codigoServicoMunicipal} onChange={e=>setFiscalDraft(v=>v&&({...v,codigoServicoMunicipal:e.target.value}))} className={inputClass(issueKeys.has('serviceCode'))}/></label><div className="grid grid-cols-2 gap-2"><label className="text-xs">Item LC 116<input value={fiscalDraft.itemLc116} onChange={e=>setFiscalDraft(v=>v&&({...v,itemLc116:e.target.value}))} className={inputClass(issueKeys.has('lc116'))}/></label><label className="text-xs">NBS<input value={fiscalDraft.nbs || ''} onChange={e=>setFiscalDraft(v=>v&&({...v,nbs:e.target.value}))} className={inputClass(issueKeys.has('nbs'))}/></label><label className="text-xs">CNAE<input value={fiscalDraft.cnae || ''} onChange={e=>setFiscalDraft(v=>v&&({...v,cnae:e.target.value}))} className={inputClass(false)}/></label><label className="text-xs">Alíquota ISS (%)<input type="number" step="0.01" value={fiscalDraft.aliquotaIss} onChange={e=>setFiscalDraft(v=>v&&({...v,aliquotaIss:Number(e.target.value)}))} className={inputClass(issueKeys.has('issRate'))}/></label><label className="col-span-2 text-xs">Município da prestação<input value={fiscalDraft.municipioPrestacao} onChange={e=>setFiscalDraft(v=>v&&({...v,municipioPrestacao:e.target.value}))} className={inputClass(false)}/></label></div></>}</section></div>
        <div className="mt-5 flex justify-end gap-2"><button onClick={()=>setEditing(null)} className="rounded-xl border px-4 py-2 text-xs font-bold">CANCELAR</button><button disabled={saving} onClick={()=>void saveAndRevalidate()} className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'SALVANDO...' : 'SALVAR E VALIDAR NOVAMENTE'}</button></div></div></div></div>}
  </div>;
}
