import React, { useState } from 'react';
import { whatsappService } from '../../services/whatsapp.service';
import { Send, X, MessageCircle, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  name: string;
}

export default function WhatsAppModal({ isOpen, onClose, phone, name }: WhatsAppModalProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const cleanPhone = (p: string) => p.replace(/\D/g, '');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setStatus(null);

    try {
      const targetPhone = cleanPhone(phone);
      if (!targetPhone) throw new Error('Número de telefone inválido.');

      await whatsappService.sendMessage(targetPhone, message);
      
      setStatus({ 
        type: 'success', 
        message: 'Mensagem enviada com sucesso!' 
      });
      
      // Clear after success
      setTimeout(() => {
        onClose();
        setMessage('');
        setStatus(null);
      }, 2000);
    } catch (error: any) {
      console.error('WhatsApp Modal Error:', error);
      setStatus({ 
        type: 'error', 
        message: error.message || 'Falha ao enviar mensagem.' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-surface-container rounded-3xl border border-surface-container-high shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="bg-emerald-500/5 p-6 border-b border-surface-container-high flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600">
                <MessageCircle size={24} fill="currentColor" fillOpacity={0.2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-on-surface">Enviar WhatsApp</h2>
                <p className="text-xs text-on-surface-variant font-medium">Para: {name}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-surface-container-highest rounded-xl transition-colors text-on-surface-variant"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSend} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Telefone</label>
              <div className="px-5 py-3.5 bg-surface/50 border border-surface-container-high rounded-2xl text-sm font-bold text-on-surface/60">
                {phone || 'Não informado'}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Sua Mensagem</label>
              <textarea
                required
                placeholder="Olá! Gostaria de conversar sobre..."
                className="w-full px-5 py-4 bg-surface/50 border border-surface-container-high rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[150px] resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {status && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl flex items-start gap-3 ${
                  status.type === 'success' 
                    ? 'bg-success-container/20 text-success border border-success/20' 
                    : 'bg-error-container/20 text-error border border-error/20'
                }`}
              >
                {status.type === 'success' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
                <p className="text-xs font-semibold leading-relaxed">{status.message}</p>
              </motion.div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 px-6 border border-surface-container-high rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-surface-container-highest transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !message.trim() || !phone}
                className="flex-[2] py-4 px-6 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MessageCircle size={16} fill="currentColor" fillOpacity={0.3} />
                )}
                {loading ? 'Enviando...' : 'Enviar Mensagem'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
