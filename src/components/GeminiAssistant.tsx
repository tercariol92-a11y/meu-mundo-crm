import { useState, FormEvent, useEffect, useRef } from 'react';
import { generateText } from '../services/geminiService';
import { Send, Bot, User, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User as AppUser } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { useCompanyConfig } from '../hooks/useCompanyConfig';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface GeminiAssistantProps {
  user: AppUser;
}

export default function GeminiAssistant({ user }: GeminiAssistantProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('gemini_messages');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Error parsing gemini_messages:', e);
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { companyConfig } = useCompanyConfig();

  useEffect(() => {
    localStorage.setItem('gemini_messages', JSON.stringify(messages));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await generateText(input);
      const assistantMessage: Message = { role: 'assistant', content: response || 'Desculpe, não obtive resposta do Gemini.' };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: Message = { role: 'assistant', content: 'Desculpe, encontrei um erro. Por favor, tente novamente.' };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('gemini_messages');
    setShowClearConfirm(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] lg:h-[calc(100vh-80px)] bg-surface">
      {/* Header */}
      <div className="bg-surface-container-low border-b border-surface-container-high px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm">
            <Sparkles size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-primary uppercase tracking-tight">Assistente Gemini</h2>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Inteligência Artificial {companyConfig?.nome || 'Meu Mundo CRM'}</p>
          </div>
        </div>
        <button 
          onClick={() => setShowClearConfirm(true)}
          className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-all"
          title="Limpar Chat"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <ConfirmationModal 
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={clearChat}
        title="Limpar Histórico"
        message="Deseja realmente limpar todo o histórico de mensagens do chat?"
        confirmText="Limpar"
        cancelText="Cancelar"
      />

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center text-primary/20 mx-auto mb-6">
                  <Bot size={48} />
                </div>
                <h3 className="text-xl font-bold text-on-surface uppercase tracking-tight mb-2">Olá, {user.displayName?.split(' ')[0]}!</h3>
                <p className="text-on-surface-variant text-sm max-w-sm mx-auto leading-relaxed">
                  Eu sou o assistente inteligente do {companyConfig?.nome || 'Meu Mundo CRM'}. Como posso ajudar você hoje? Posso ajudar com orçamentos, dúvidas técnicas ou análise de dados.
                </p>
              </motion.div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  msg.role === 'user' ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary text-white'
                }`}>
                  {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div className={`max-w-[85%] p-5 rounded-2xl shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-surface-container-high text-on-surface rounded-tr-none' 
                    : 'bg-surface-container-lowest border border-surface-container-high text-on-surface rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <div className="flex gap-4">
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white shrink-0 shadow-md">
                <Bot size={20} />
              </div>
              <div className="bg-surface-container-lowest border border-surface-container-high p-5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-primary" />
                <span className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Gemini está pensando...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-surface-container-low border-t border-surface-container-high p-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte qualquer coisa ao Gemini..."
            className="w-full bg-surface border-2 border-surface-container-highest rounded-2xl py-5 pl-7 pr-16 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none shadow-inner text-sm font-medium"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-primary text-white rounded-xl flex items-center justify-center hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg active:scale-90"
          >
            <Send size={20} />
          </button>
        </form>
        <p className="text-[10px] text-center text-on-surface-variant mt-4 uppercase tracking-[0.2em] font-black opacity-40">
          O Gemini pode fornecer informações imprecisas. Verifique as respostas.
        </p>
      </div>
    </div>
  );
}
