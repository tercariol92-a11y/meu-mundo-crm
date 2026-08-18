import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Star } from 'lucide-react';

type TicketSummary = { protocol: string; clientName: string; technicianName: string; answered: boolean };
type RatingKey = 'technicalSupport' | 'services' | 'commercialSupport' | 'product' | 'administrative';

const topics: Array<{ key: RatingKey; label: string }> = [
  { key: 'technicalSupport', label: 'Suporte Técnico' },
  { key: 'services', label: 'Serviços' },
  { key: 'commercialSupport', label: 'Suporte Comercial (Executivo de Vendas)' },
  { key: 'product', label: 'Produto' },
  { key: 'administrative', label: 'Áreas administrativas (financeiro/faturamento/jurídico)' },
];
const npsColors = ['#b91c1c','#dc2626','#f04424','#f97316','#f59e0b','#fbbf24','#eab308','#d4e157','#a3d52f','#84cc16','#4caf50'];

export default function SupportSatisfactionPublic() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [ticket, setTicket] = useState<TicketSummary | null>(null);
  const [nps, setNps] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({ technicalSupport: 0, services: 0, commercialSupport: 0, product: 0, administrative: 0 });
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch(`/api/support/satisfaction?token=${encodeURIComponent(token)}`).then(async response => {
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Não foi possível abrir a avaliação.');
      setTicket(body.ticket);
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Não foi possível abrir a avaliação.')).finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    if (nps === null) return setError('Selecione uma nota NPS de 0 a 10.');
    if (topics.some(topic => !ratings[topic.key])) return setError('Avalie todos os tópicos de 1 a 5 estrelas.');
    setSending(true); setError('');
    try {
      const response = await fetch('/api/support/satisfaction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, nps, ratings, comment }) });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Não foi possível enviar a avaliação.');
      setSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível enviar a avaliação.'); }
    finally { setSending(false); }
  };

  return <main className="min-h-screen bg-white px-4 py-10 text-slate-800">
    <section className="mx-auto w-full max-w-3xl">
      <header className="mb-10 text-center"><div className="inline-flex items-center gap-3"><span className="text-3xl font-medium tracking-tight text-slate-900">MEU MUNDO</span><span className="h-8 w-px bg-slate-200"/><span className="text-3xl font-black text-blue-600">CRM</span></div><p className="mt-2 text-xs font-bold uppercase tracking-[.28em] text-slate-400">Plataforma de Gestão</p></header>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div> : error && !ticket ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : sent || ticket?.answered ? <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-12 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={52}/><h1 className="mt-4 text-2xl font-bold">Obrigado pela sua avaliação!</h1><p className="mt-2 text-slate-600">Sua resposta foi registrada com segurança.</p></div> : ticket && <div className="space-y-10">
        <div><h1 className="text-2xl font-black">Olá, {ticket.clientName}!</h1><p className="mt-3 leading-7 text-slate-600">O chamado <b>#{ticket.protocol}</b>, atendido por <b>{ticket.technicianName}</b>, foi concluído. Queremos ouvir você — leva menos de 1 minuto.</p></div>
        <section><h2 className="text-lg font-black">1. Pesquisa de Satisfação</h2><p className="mt-2 text-slate-600">Em uma escala de 0 a 10, o quanto você recomendaria nossa empresa para um parceiro de negócios?</p><div className="mt-5 grid grid-cols-6 gap-2 sm:grid-cols-11">{Array.from({length:11},(_,value)=><button type="button" key={value} onClick={()=>setNps(value)} className={`h-14 rounded-lg text-lg font-black text-white transition ${nps===value?'ring-4 ring-slate-700 ring-offset-2 scale-105':''}`} style={{backgroundColor:npsColors[value]}}>{value}</button>)}</div></section>
        <section><label className="font-semibold">Obrigado por sua resposta! Em poucas palavras, comente o que motivou sua nota <span className="font-normal text-slate-500">(opcional)</span></label><textarea value={comment} onChange={event=>setComment(event.target.value)} maxLength={1000} rows={5} className="mt-3 w-full rounded-xl border-2 border-dashed border-slate-300 p-4 outline-none focus:border-blue-500"/></section>
        {topics.map((topic,index)=><section key={topic.key}><h2 className="text-lg font-black">{index+2}. {topic.label}</h2><div className="mt-4 flex justify-center gap-3">{[1,2,3,4,5].map(value=><button type="button" key={value} onClick={()=>setRatings(current=>({...current,[topic.key]:value}))} aria-label={`${value} estrelas para ${topic.label}`}><Star size={44} className={value<=ratings[topic.key]?'fill-amber-400 text-amber-400':'text-slate-300 hover:text-amber-300'}/></button>)}</div></section>)}
        {error&&<p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end border-t border-slate-200 pt-6"><button type="button" onClick={submit} disabled={sending} className="rounded-lg bg-green-600 px-8 py-3 font-black text-white shadow hover:bg-green-700 disabled:opacity-60">{sending?'Enviando...':'Enviar ✓'}</button></div>
      </div>}
    </section>
  </main>;
}
