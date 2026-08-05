import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Calendar, 
  Wrench, 
  Building2, 
  MessageSquare,
  FileText,
  Loader2,
  Paperclip,
  Send,
  Image as ImageIcon,
  MoreVertical,
  Paperclip as AttachmentIcon,
  Circle,
  Download,
  Plus
} from 'lucide-react';
import { Chamado, User as UserType, Documento } from '../../types';
import { databaseService } from '../../services/databaseService';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  senderType: 'customer' | 'internal';
  createdAt: any;
  attachments?: { url: string; name: string; type: string }[];
}

interface CustomerTicketDetailProps {
  ticketId: string;
  onBack: () => void;
  user: UserType;
}

export default function CustomerTicketDetail({ ticketId, onBack, user }: CustomerTicketDetailProps) {
  const [ticket, setTicket] = useState<Chamado | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [ticketDocs, setTicketDocs] = useState<Documento[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadTicketData = async () => {
      try {
        const [ticketData, docsData] = await Promise.all([
          databaseService.getChamadoById(ticketId),
          databaseService.getDocumentosByTicket(ticketId)
        ]);
        setTicket(ticketData || null);
        setTicketDocs(docsData || []);
      } catch (err) {
        console.error('Error loading ticket data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTicketData();

    // In a real implementation, this would be an onSnapshot listener
    // For now, let's mock the real-time messages using the databaseService if available
    const unsubscribe = databaseService.onTicketMessagesChange?.(ticketId, (msgs) => {
      setMessages(msgs);
      scrollToBottom();
    }) || (() => {});

    return () => unsubscribe();
  }, [ticketId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await databaseService.sendTicketMessage(ticketId, {
        body: newMessage,
        senderId: user.id,
        senderName: (user as any).nome || 'Cliente',
        senderType: 'customer'
      });
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-20 text-center space-y-4">
        <AlertCircle className="mx-auto text-error" size={48} />
        <h3 className="text-xl font-black uppercase tracking-tight text-on-surface">Chamado não encontrado</h3>
        <button onClick={onBack} className="text-primary font-bold uppercase tracking-widest text-xs font-black">Voltar para a lista</button>
      </div>
    );
  }

  const statusColor = 
    ticket.status === 'aberto' ? 'bg-orange-500' :
    ticket.status === 'concluido' ? 'bg-green-500' :
    'bg-blue-500';

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-surface-container-lowest rounded-[40px] border border-surface-container-high overflow-hidden shadow-2xl">
      {/* Header */}
      <header className="px-8 py-6 border-b border-surface-container-high bg-surface-container-low/50 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-black uppercase tracking-tight text-on-surface">{ticket.titulo}</h1>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high border border-surface-container-highest">
                <Circle size={8} className={`fill-current ${statusColor} text-white`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{ticket.status}</span>
              </div>
            </div>
            <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">Protocolo #{ticket.id.slice(-6).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Unidade</p>
            <p className="text-xs font-bold text-on-surface">{ticket.unidade?.nome || 'Principal'}</p>
          </div>
          <button className="p-2 hover:bg-surface-container-high rounded-full text-on-surface-variant">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-surface-container-lowest relative">
          <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {/* System Info: Ticket Description */}
            <div className="flex justify-center mb-8">
              <div className="max-w-2xl w-full bg-surface-container-low/50 p-6 rounded-3xl border border-dashed border-surface-container-high text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">Descrição Inicial do Chamado</p>
                <p className="text-sm text-on-surface font-medium leading-relaxed italic">"{ticket.descricao}"</p>
                <div className="mt-4 flex items-center justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  <span className="flex items-center gap-1.5"><Calendar size={12} /> {new Date(ticket.createdAt).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(ticket.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            </div>

            {messages.map((msg, idx) => {
              const isMe = msg.senderId === user.id;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] space-y-1`}>
                    <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{msg.senderName}</span>
                      <span className="text-[8px] text-on-surface-variant opacity-60">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className={`p-4 rounded-3xl text-sm font-medium shadow-sm ${
                      isMe 
                        ? 'bg-primary text-white rounded-tr-none' 
                        : 'bg-surface-container-low border border-surface-container-high rounded-tl-none'
                    }`}>
                      {msg.body}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-8 bg-surface-container-low/30 border-t border-surface-container-high">
            <form onSubmit={handleSendMessage} className="relative flex items-end gap-4 bg-surface-container-lowest border border-surface-container-high rounded-[32px] p-2 pr-4 shadow-xl focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <div className="flex items-center">
                <button type="button" className="p-3 text-on-surface-variant hover:text-primary transition-all rounded-full hover:bg-primary/5">
                  <Paperclip size={20} />
                </button>
                <button type="button" className="p-3 text-on-surface-variant hover:text-primary transition-all rounded-full hover:bg-primary/5">
                  <ImageIcon size={20} />
                </button>
              </div>
              <textarea
                rows={1}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Descreva sua dúvida ou envie uma atualização..."
                className="flex-1 bg-transparent border-none focus:ring-0 py-4 text-sm font-medium resize-none max-h-32 custom-scrollbar"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="mb-1 p-4 bg-primary text-white rounded-full hover:bg-primary/90 transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-primary/20"
              >
                {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar Info */}
        <aside className="w-80 border-l border-surface-container-high bg-surface-container-low/20 hidden xl:flex flex-col p-8 space-y-8 overflow-y-auto custom-scrollbar">
          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">SLA do Atendimento</h3>
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container-high shadow-sm space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Primeira Resposta</span>
                  {ticket.slaFirstResponseCompletedAt ? (
                    <span className="text-[9px] font-black uppercase tracking-widest text-green-600 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Concluída
                    </span>
                  ) : (
                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                      ticket.slaFirstResponseDeadline && new Date(ticket.slaFirstResponseDeadline) < new Date() ? 'text-error' : 'text-primary'
                    }`}>
                      {ticket.slaFirstResponseDeadline ? new Date(ticket.slaFirstResponseDeadline).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </span>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Resolução Prevista</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${
                    ticket.slaDeadline && new Date(ticket.slaDeadline) < new Date() && ticket.status !== 'concluido' ? 'text-error' : 'text-on-surface'
                  }`}>
                    {ticket.slaDeadline ? new Date(ticket.slaDeadline).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                  </span>
                </div>

                <div className="pt-3 border-t border-surface-container-high flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Status SLA</span>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    ticket.slaStatus === 'late' || (ticket.slaDeadline && new Date(ticket.slaDeadline) < new Date() && ticket.status !== 'concluido')
                      ? 'bg-red-100 text-red-600' 
                      : 'bg-green-100 text-green-600'
                  }`}>
                    {ticket.slaStatus === 'late' || (ticket.slaDeadline && new Date(ticket.slaDeadline) < new Date() && ticket.status !== 'concluido') ? 'Vencido' : 'Dentro do Prazo'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Técnico Responsável</h3>
            {ticket.tecnico ? (
              <div className="flex items-center gap-4 p-4 rounded-3xl bg-surface-container-lowest border border-surface-container-high shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl">
                  {ticket.tecnico.nome.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-black text-on-surface uppercase tracking-tight">{ticket.tecnico.nome}</p>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{ticket.tecnico.especialidade || 'Técnico Especialista'}</p>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-3xl border border-dashed border-surface-container-high text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Aguardando atribuição</p>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Ativo Vinculado</h3>
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container-high shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-surface-container-high rounded-2xl text-on-surface-variant">
                  <Wrench size={20} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-tight text-on-surface">{ticket.equipamentoCliente?.modelo || 'Não informado'}</p>
                  <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">S/N: {ticket.equipamentoCliente?.numeroSerie || '-'}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-surface-container-high flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Status Ativo</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-green-600">Operacional</span>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Documentos do Chamado</h3>
            <div className="space-y-3">
              {ticketDocs.map(doc => (
                <div key={doc.id} className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-sm group hover:border-primary transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <FileText size={16} />
                    </div>
                    <button 
                      onClick={() => window.open(doc.url, '_blank')}
                      className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] font-black text-on-surface line-clamp-1">{doc.nome}</p>
                  <p className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest opacity-50 mt-1">{doc.tipo} • {new Date(doc.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
              {ticketDocs.length === 0 && (
                <div className="p-6 rounded-3xl border border-dashed border-surface-container-high text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-50">Nenhum documento anexado</p>
                </div>
              )}
              <button 
                onClick={() => {
                  // This would ideally open an upload modal pre-linked to this ticket
                  // For now, let's just alert or navigate
                  alert('Para anexar, utilize o Centro de Documentos e selecione este chamado no campo "Vincular a Chamado".');
                }}
                className="w-full py-3 border-2 border-dashed border-surface-container-high rounded-2xl text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
              >
                <Plus size={14} />
                Anexar Documento
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Histórico Interno</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-2 rounded-full bg-green-500/20 flex flex-col items-center py-2 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-on-surface uppercase tracking-tight">Chamado Aberto</p>
                  <p className="text-[9px] text-on-surface-variant font-bold uppercase">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              {ticket.dataInicioAtendimento && (
                <div className="flex gap-4">
                  <div className="w-2 rounded-full bg-blue-500/20 flex flex-col items-center py-2 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-on-surface uppercase tracking-tight">Em Atendimento</p>
                    <p className="text-[9px] text-on-surface-variant font-bold uppercase">{new Date(ticket.dataInicioAtendimento).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
