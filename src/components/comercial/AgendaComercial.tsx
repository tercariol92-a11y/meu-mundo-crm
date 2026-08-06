import { FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle, Ban, Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Edit3, Filter, MapPin, Phone, Plus, Search, Users, X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useGlobalData } from '../../contexts/GlobalDataContext';
import { AgendaComercial, Usuario } from '../../types';
import {
  appointmentStart, commercialAgendaService, isAgendaAdmin, resolveCompanyId,
  SaveAppointmentInput, SAO_PAULO_TIME_ZONE,
} from '../../services/commercialAgendaService';

interface Props { user: Usuario; }
type PeriodFilter = 'selected' | 'today' | 'tomorrow' | 'week' | 'next7' | 'late' | 'completed' | 'all';

const TYPES: AgendaComercial['type'][] = ['Ligação', 'Reunião', 'Visita', 'Retorno', 'Demonstração', 'Instalação', 'Treinamento', 'Proposta', 'Cobrança', 'Outro'];
const STATUSES: AgendaComercial['status'][] = ['Agendado', 'Confirmado', 'Em andamento', 'Concluído', 'Cancelado', 'Não realizado'];
const PRIORITIES: NonNullable<AgendaComercial['priority']>[] = ['Baixa', 'Média', 'Alta', 'Urgente'];
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const sameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const statusDone = (status: string) => ['Concluído', 'Cancelado', 'Não realizado'].includes(status);

const emptyForm = (user: Usuario, date: Date): SaveAppointmentInput => ({
  title: '', description: '', date: dateKey(date), startTime: '09:00', endTime: '10:00',
  responsibleUserId: user.id, responsibleUserName: user.nome, type: 'Reunião', priority: 'Média',
  status: 'Agendado', reminderMinutes: 30, companyId: resolveCompanyId(user),
});

export default function AgendaComercialView({ user }: Props) {
  const { agendaComercial, usuarios, clientes, leads, loading } = useGlobalData();
  const admin = isAgendaAdmin(user);
  const companyId = resolveCompanyId(user);
  const today = useMemo(() => startOfDay(new Date()), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [search, setSearch] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState(user.id);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [editing, setEditing] = useState<AgendaComercial | null>(null);
  const [form, setForm] = useState<SaveAppointmentInput>(() => emptyForm(user, today));
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const companyAppointments = useMemo(() => agendaComercial.filter(item => {
    const itemCompany = item.companyId || 'default';
    const owner = item.responsibleUserId || item.responsavelId;
    return itemCompany === companyId && (admin ? true : owner === user.id);
  }), [agendaComercial, admin, companyId, user.id]);

  const appointmentCount = useMemo(() => companyAppointments.reduce<Record<string, number>>((acc, item) => {
    const start = appointmentStart(item); if (start) acc[dateKey(start)] = (acc[dateKey(start)] || 0) + 1; return acc;
  }, {}), [companyAppointments]);

  const visible = useMemo(() => {
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + (7 - today.getDay()));
    const next7 = new Date(today); next7.setDate(today.getDate() + 7);
    return companyAppointments.filter(item => {
      const start = appointmentStart(item); if (!start) return false;
      const owner = item.responsibleUserId || item.responsavelId;
      const text = `${item.title || item.titulo} ${item.description || item.descricao || ''} ${item.customerName || item.clienteNome || ''}`.toLowerCase();
      if (admin && responsibleFilter !== 'all' && owner !== responsibleFilter) return false;
      if (search && !text.includes(search.toLowerCase())) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      if (typeFilter && (item.type || item.tipo) !== typeFilter) return false;
      if (priorityFilter && (item.priority || item.prioridade) !== priorityFilter) return false;
      if (period === 'selected' && !sameDay(start, selectedDate)) return false;
      if (period === 'today' && !sameDay(start, today)) return false;
      if (period === 'tomorrow' && !sameDay(start, tomorrow)) return false;
      if (period === 'week' && !(start >= today && start < weekEnd)) return false;
      if (period === 'next7' && !(start >= today && start < next7)) return false;
      if (period === 'late' && !(start < new Date() && !statusDone(item.status))) return false;
      if (period === 'completed' && item.status !== 'Concluído') return false;
      return true;
    }).sort((a, b) => (appointmentStart(a)?.getTime() || 0) - (appointmentStart(b)?.getTime() || 0));
  }, [companyAppointments, admin, responsibleFilter, search, statusFilter, typeFilter, priorityFilter, period, selectedDate, today]);

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  }, [month]);

  const openCreate = (date = selectedDate) => { setEditing(null); setForm(emptyForm(user, date)); setError(''); setModalOpen(true); };
  const openEdit = (item: AgendaComercial) => {
    const start = appointmentStart(item) || today;
    const end = item.endAt?.toDate?.() || (item.endAt ? new Date(item.endAt) : new Date(start.getTime() + 3600000));
    setEditing(item); setError(''); setForm({ id: item.id, title: item.title || item.titulo, description: item.description || item.descricao,
      date: dateKey(start), startTime: start.toTimeString().slice(0, 5), endTime: end.toTimeString().slice(0, 5),
      responsibleUserId: item.responsibleUserId || item.responsavelId, responsibleUserName: item.responsibleUserName || item.responsavelNome || '',
      customerId: item.customerId || item.clienteId, customerName: item.customerName || item.clienteNome, leadId: item.leadId,
      phone: item.phone || item.telefone, address: item.address || item.endereco || item.local, type: item.type || item.tipo,
      priority: item.priority || item.prioridade || 'Média', status: item.status, reminderMinutes: item.reminderMinutes ?? 30, companyId });
    setModalOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSaving(true);
    try { await commercialAgendaService.save(form); setMessage(editing ? 'Compromisso atualizado.' : 'Compromisso criado.'); setModalOpen(false); }
    catch (err: any) {
      if (err?.code === 'AGENDA_CONFLICT' && admin && window.confirm(`${err.message}\n\nDeseja salvar mesmo assim?`)) {
        try { await commercialAgendaService.save(form, true); setMessage('Compromisso salvo com conflito autorizado.'); setModalOpen(false); }
        catch (retry: any) { setError(retry.message || 'Falha ao salvar.'); }
      } else setError(err?.message || 'Falha ao salvar o compromisso.');
    } finally { setSaving(false); }
  };

  const setStatus = async (item: AgendaComercial, status: AgendaComercial['status']) => {
    try { await commercialAgendaService.updateStatus(item.id, status); setMessage(`Compromisso marcado como ${status}.`); }
    catch (err: any) { setMessage(''); setError(err?.message || 'Falha ao atualizar status.'); }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" /></div>;

  return <div className="p-6 space-y-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div><h1 className="text-2xl font-black uppercase tracking-tight">Agenda Comercial</h1><p className="text-sm text-on-surface-variant">Compromissos vinculados por usuário e empresa</p></div>
      <button onClick={() => openCreate()} className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs"><Plus size={18}/> Novo Compromisso</button>
    </div>
    {(message || error) && <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{error || message}</div>}

    {admin && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {usuarios.filter(u => u.ativo).map(member => { const mine = companyAppointments.filter(a => (a.responsibleUserId || a.responsavelId) === member.id); const done = mine.filter(a => a.status === 'Concluído').length; const rate = mine.length ? Math.round(done / mine.length * 100) : 0; return <button key={member.id} onClick={() => { setResponsibleFilter(member.id); setPeriod('all'); }} className="text-left p-4 bg-surface-container-low border rounded-2xl"><p className="font-black text-xs">{member.nome}</p><p className={`text-lg font-black ${rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{rate}%</p><p className="text-[10px] text-on-surface-variant">{mine.length} compromissos</p></button>; })}
    </div>}

    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <aside className="space-y-4">
        <div className="bg-surface-container-low border rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4"><h3 className="text-xs font-black uppercase">{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: SAO_PAULO_TIME_ZONE })}</h3><div><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))} className="p-1"><ChevronLeft size={17}/></button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))} className="p-1"><ChevronRight size={17}/></button></div></div>
          <div className="grid grid-cols-7 text-center mb-2">{['D','S','T','Q','Q','S','S'].map((d,i)=><span key={i} className="text-[10px] font-black text-on-surface-variant">{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">{calendarDays.map((day,i) => day ? <button key={dateKey(day)} onClick={() => { setSelectedDate(day); setPeriod('selected'); }} className={`relative aspect-square rounded-lg text-[10px] font-bold ${sameDay(day, selectedDate) ? 'bg-primary text-white' : sameDay(day,today) ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-high'}`}>{day.getDate()}{appointmentCount[dateKey(day)] ? <span className="absolute right-0.5 bottom-0.5 w-1.5 h-1.5 rounded-full bg-amber-500"/> : null}</button> : <span key={`empty-${i}`}/>)}</div>
          <button onClick={() => openCreate(selectedDate)} className="mt-4 w-full text-[10px] font-black uppercase text-primary">+ Criar em {selectedDate.toLocaleDateString('pt-BR')}</button>
        </div>
        <div className="bg-surface-container-low border rounded-3xl p-5"><h3 className="text-xs font-black uppercase mb-3 flex gap-2"><AlertCircle size={16}/> Alertas</h3>{companyAppointments.filter(a => { const s=appointmentStart(a); return s && !statusDone(a.status) && s < new Date(); }).slice(0,5).map(a=><p key={a.id} className="text-[10px] text-red-600 mb-2">{a.titulo} está atrasado.</p>)}</div>
      </aside>

      <main className="lg:col-span-3 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">{([['today','Hoje'],['tomorrow','Amanhã'],['week','Esta semana'],['next7','Próximos 7 dias'],['late','Atrasados'],['completed','Concluídos'],['all','Todos']] as [PeriodFilter,string][]).map(([key,label])=><button key={key} onClick={()=>setPeriod(key)} className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-black uppercase ${period===key?'bg-primary text-white':'bg-surface-container-high'}`}>{label}</button>)}</div>
        <div className="grid md:grid-cols-5 gap-2">
          <div className="md:col-span-2 relative"><Search size={16} className="absolute left-3 top-3 text-on-surface-variant"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar compromissos" className="w-full rounded-xl border bg-surface-container-low py-2.5 pl-10 pr-3 text-xs"/></div>
          {admin && <select value={responsibleFilter} onChange={e=>setResponsibleFilter(e.target.value)} className="rounded-xl border px-3 text-xs"><option value="all">Todos os funcionários</option>{usuarios.filter(u=>u.ativo).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select>}
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="rounded-xl border px-3 text-xs"><option value="">Todos os tipos</option>{TYPES.map(v=><option key={v}>{v}</option>)}</select>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="rounded-xl border px-3 text-xs"><option value="">Todos os status</option>{STATUSES.map(v=><option key={v}>{v}</option>)}</select>
        </div>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant"><Filter size={14}/>{visible.length} compromisso(s)</div>
        {visible.length ? visible.map(item => { const start=appointmentStart(item)!; const late=start<new Date()&&!statusDone(item.status); return <motion.article key={item.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className={`bg-surface-container-low border p-4 rounded-2xl flex flex-col md:flex-row justify-between gap-4 ${late?'border-red-300':'border-surface-container-high'}`}>
          <div className="flex gap-4"><div className={`p-3 rounded-xl h-fit ${late?'bg-red-100 text-red-600':'bg-primary/10 text-primary'}`}><CalendarIcon size={20}/></div><div><h3 className="font-black text-sm uppercase">{item.title||item.titulo}</h3><div className="flex flex-wrap gap-3 mt-1 text-[10px] font-bold text-on-surface-variant"><span className="flex gap-1"><Clock size={12}/>{start.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</span>{(item.address||item.endereco||item.local)&&<span className="flex gap-1"><MapPin size={12}/>{item.address||item.endereco||item.local}</span>}{(item.phone||item.telefone)&&<span className="flex gap-1"><Phone size={12}/>{item.phone||item.telefone}</span>}</div><p className="text-xs mt-2">{item.customerName||item.clienteNome||item.descricao}</p><div className="flex flex-wrap gap-2 mt-2 text-[9px] font-black uppercase"><span className="bg-slate-100 px-2 py-1 rounded">{item.type||item.tipo}</span><span className="bg-amber-50 text-amber-700 px-2 py-1 rounded">{item.priority||item.prioridade||'Média'}</span><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">{item.responsibleUserName||item.responsavelNome||usuarios.find(u=>u.id===(item.responsibleUserId||item.responsavelId))?.nome}</span><span className={late?'text-red-600':'text-green-700'}>{late?'Atrasado':item.status}</span></div></div></div>
          <div className="flex gap-1 self-end md:self-center"><button title="Editar" onClick={()=>openEdit(item)} className="p-2 rounded-xl hover:bg-surface-container-high"><Edit3 size={17}/></button>{!statusDone(item.status)&&<><button title="Concluir" onClick={()=>setStatus(item,'Concluído')} className="p-2 text-green-600"><CheckCircle2 size={18}/></button><button title="Cancelar" onClick={()=>setStatus(item,'Cancelado')} className="p-2 text-red-600"><Ban size={18}/></button></>}</div>
        </motion.article>; }) : <div className="py-20 text-center border border-dashed rounded-3xl text-on-surface-variant"><AlertCircle size={42} className="mx-auto opacity-20 mb-3"/><p className="text-xs font-black uppercase">Nenhum compromisso encontrado</p></div>}
      </main>
    </div>

    {modalOpen && <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setModalOpen(false)}}><form onSubmit={submit} className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-4">
      <div className="flex justify-between"><div><h2 className="text-xl font-black uppercase">{editing?'Editar':'Novo'} Compromisso</h2><p className="text-xs text-on-surface-variant">Horário de Brasília • {SAO_PAULO_TIME_ZONE}</p></div><button type="button" onClick={()=>setModalOpen(false)}><X/></button></div>
      {error&&<div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <label className="md:col-span-2 text-xs font-bold">Título *<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="mt-1 w-full border rounded-xl p-3"/></label>
        <label className="md:col-span-2 text-xs font-bold">Descrição<textarea value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} className="mt-1 w-full border rounded-xl p-3"/></label>
        <label className="text-xs font-bold">Data *<input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} className="mt-1 w-full border rounded-xl p-3"/></label>
        <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">Início<input required type="time" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})} className="mt-1 w-full border rounded-xl p-3"/></label><label className="text-xs font-bold">Fim<input required type="time" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})} className="mt-1 w-full border rounded-xl p-3"/></label></div>
        <label className="text-xs font-bold">Responsável<select disabled={!admin} value={form.responsibleUserId} onChange={e=>{const u=usuarios.find(x=>x.id===e.target.value);setForm({...form,responsibleUserId:e.target.value,responsibleUserName:u?.nome||''})}} className="mt-1 w-full border rounded-xl p-3 bg-white">{(admin?usuarios.filter(u=>u.ativo):[user]).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>
        <label className="text-xs font-bold">Cliente<select value={form.customerId||''} onChange={e=>{const c=clientes.find(x=>x.id===e.target.value);setForm({...form,customerId:e.target.value||undefined,customerName:c?.nomeFantasia,phone:c?.celularWhatsapp||c?.telefoneFixo||form.phone})}} className="mt-1 w-full border rounded-xl p-3 bg-white"><option value="">Nenhum</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}</select></label>
        <label className="text-xs font-bold">Lead<select value={form.leadId||''} onChange={e=>{const l=leads.find(x=>x.id===e.target.value);setForm({...form,leadId:e.target.value||undefined,customerName:l?.nome,phone:l?.whatsapp||l?.telefone||form.phone,address:(l as any)?.endereco||form.address})}} className="mt-1 w-full border rounded-xl p-3 bg-white"><option value="">Nenhum</option>{leads.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
        <label className="text-xs font-bold">Telefone<input value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})} className="mt-1 w-full border rounded-xl p-3"/></label>
        <label className="md:col-span-2 text-xs font-bold">Endereço<input value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})} className="mt-1 w-full border rounded-xl p-3"/></label>
        <label className="text-xs font-bold">Tipo<select value={form.type} onChange={e=>setForm({...form,type:e.target.value as any})} className="mt-1 w-full border rounded-xl p-3 bg-white">{TYPES.map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="text-xs font-bold">Prioridade<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as any})} className="mt-1 w-full border rounded-xl p-3 bg-white">{PRIORITIES.map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="text-xs font-bold">Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as any})} className="mt-1 w-full border rounded-xl p-3 bg-white">{STATUSES.map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="text-xs font-bold">Lembrete<select value={form.reminderMinutes} onChange={e=>setForm({...form,reminderMinutes:Number(e.target.value)})} className="mt-1 w-full border rounded-xl p-3 bg-white"><option value={0}>Sem lembrete</option><option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={60}>1 hora</option><option value={1440}>1 dia</option></select></label>
      </div>
      <div className="flex justify-end gap-3 pt-3"><button type="button" disabled={saving} onClick={()=>setModalOpen(false)} className="px-5 py-3 rounded-xl border font-black text-xs uppercase">Cancelar</button><button disabled={saving} className="px-5 py-3 rounded-xl bg-primary text-white font-black text-xs uppercase">{saving?'Salvando...':'Salvar compromisso'}</button></div>
    </form></div>}
  </div>;
}
