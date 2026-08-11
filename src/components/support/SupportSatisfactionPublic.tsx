import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Star } from 'lucide-react';

type TicketSummary = { protocol: string; clientName: string; technicianName: string; answered: boolean; rating?: number | null };

export default function SupportSatisfactionPublic() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [ticket, setTicket] = useState<TicketSummary | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch(`/api/support/satisfaction?token=${encodeURIComponent(token)}`)
      .then(async response => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error || 'Não foi possível abrir a avaliação.');
        setTicket(body.ticket);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Não foi possível abrir a avaliação.'))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    if (!rating) return setError('Selecione uma nota de 1 a 5.');
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/support/satisfaction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, rating, comment }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Não foi possível enviar a avaliação.');
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível enviar a avaliação.');
    } finally { setSending(false); }
  };

  return <main className="min-h-screen bg-slate-100 px-4 py-10 flex items-center justify-center">
    <section className="w-full max-w-xl rounded-3xl bg-white p-7 shadow-xl border border-slate-200">
      <div className="text-center mb-7"><p className="text-xs font-black uppercase tracking-[.25em] text-blue-600">Meu Mundo CRM</p><h1 className="mt-2 text-2xl font-black text-slate-900">Avaliação do atendimento</h1></div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" /></div> : error && !ticket ? <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : sent || ticket?.answered ? <div className="text-center py-8"><CheckCircle2 className="mx-auto text-emerald-600" size={48}/><h2 className="mt-3 text-xl font-bold">Obrigado pela sua avaliação!</h2><p className="mt-2 text-slate-600">Sua resposta foi registrada.</p></div> : ticket && <>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><p><b>Chamado:</b> #{ticket.protocol}</p><p><b>Cliente:</b> {ticket.clientName}</p><p><b>Técnico:</b> {ticket.technicianName}</p></div>
        <p className="mt-6 text-center font-bold text-slate-900">Como você avalia o atendimento?</p>
        <div className="mt-3 flex justify-center gap-2">{[1,2,3,4,5].map(value => <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} estrela${value > 1 ? 's' : ''}`} className="rounded-xl p-2 hover:bg-amber-50"><Star size={36} className={value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}/></button>)}</div>
        <label className="mt-5 block text-sm font-bold text-slate-700">Comentário (opcional)</label><textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={1000} rows={4} className="mt-2 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-600"/>
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="button" onClick={submit} disabled={sending} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-60">{sending ? 'Enviando...' : 'Enviar avaliação'}</button>
      </>}
    </section>
  </main>;
}
