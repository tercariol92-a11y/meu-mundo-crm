import React, { useState } from 'react';
import { whatsappService } from '../../services/whatsapp.service';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function WhatsAppWebHookTest() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      // Limpar o telefone para conter apenas números
      const cleanPhone = phone.replace(/\D/g, '');
      
      const result = await whatsappService.sendMessage(cleanPhone, message);
      setStatus({ 
        type: 'success', 
        message: 'Mensagem enviada com sucesso! ID: ' + (result.response?.messages?.[0]?.id || 'OK')
      });
    } catch (error: any) {
      setStatus({ 
        type: 'error', 
        message: error.message || 'Falha ao enviar mensagem.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-surface-container rounded-3xl border border-surface-container-high shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
          <Send size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-on-surface">Teste WhatsApp API</h2>
          <p className="text-xs text-on-surface-variant">Meta Cloud API (Official)</p>
        </div>
      </div>

      <form onSubmit={handleTest} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Telefone (com DDI)</label>
          <input
            type="text"
            placeholder="5511999999999"
            className="w-full px-5 py-3.5 bg-surface/50 border border-surface-container-high rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Mensagem</label>
          <textarea
            placeholder="Olá, esta é uma mensagem de teste do CRM."
            className="w-full px-5 py-3.5 bg-surface/50 border border-surface-container-high rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-none"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>

        {status && (
          <div className={`p-4 rounded-2xl flex items-start gap-3 ${
            status.type === 'success' ? 'bg-success-container/20 text-success border border-success/20' : 'bg-error-container/20 text-error border border-error/20'
          }`}>
            {status.type === 'success' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
            <p className="text-xs font-medium leading-relaxed">{status.message}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-primary text-on-primary rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          {loading ? 'Enviando...' : 'Enviar Teste'}
        </button>
      </form>
    </div>
  );
}
