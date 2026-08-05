import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { AlertCircle, CheckCircle2, Loader2, Power, QrCode, RefreshCw, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { auth } from '../../firebase';
import { whatsappApi } from '../../services/whatsappApi';

type OwnSessionStatus = 'connected' | 'disconnected' | 'connecting' | 'qrcode';
type OwnSession = {
  uid?: string;
  userId?: string;
  status?: OwnSessionStatus;
  sessionName?: string;
  sessionPhone?: string;
  phone?: string;
  qrCodeDataUrl?: string;
  lastConnectedAt?: string | null;
};

export default function MyWhatsAppSettings() {
  const [uid, setUid] = useState('');
  const [session, setSession] = useState<OwnSession | null>(null);
  const [status, setStatus] = useState<OwnSessionStatus>('disconnected');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const applyStatus = (ownSession: OwnSession) => {
    const currentUid = auth.currentUser?.uid;
    const returnedUid = ownSession.uid || ownSession.userId;
    if (returnedUid && returnedUid !== currentUid) {
      throw new Error('O servidor retornou uma sessão de outro usuário.');
    }
    setSession(ownSession);
    setStatus(ownSession.status || 'disconnected');
  };

  const pollOwnStatus = async () => {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      await new Promise(resolve => window.setTimeout(resolve, 750));
      const body = await whatsappApi.getStatus();
      applyStatus(body.status || {});
      if (body.status?.status === 'qrcode' && body.status?.qrCodeDataUrl) return 'qrcode';
      if (body.status?.status === 'connected') return 'connected';
    }
    throw new Error('Tempo esgotado aguardando o WhatsApp. Tente novamente.');
  };

  useEffect(() => {
    let statusTimer: number | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, firebaseUser => {
      if (statusTimer) window.clearInterval(statusTimer);
      setUid(firebaseUser?.uid || '');
      setSession(null);
      setStatus('disconnected');
      if (!firebaseUser) return;
      const refreshStatus = () => void whatsappApi.getStatus().then(async body => {
          applyStatus(body.status || {});
        }).catch(statusError => {
          setError(statusError instanceof Error ? statusError.message : 'Não foi possível consultar sua sessão.');
        });
      refreshStatus();
      statusTimer = window.setInterval(refreshStatus, 3_000);
    });
    return () => { if (statusTimer) window.clearInterval(statusTimer); unsubscribeAuth(); };
  }, []);

  const startConnection = async (action: 'connect' | 'reconnect') => {
    if (loading) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const body = await whatsappApi.getQr(action);
      if (body.status) applyStatus(body.status);
      const result = await pollOwnStatus();
      setSuccess(result === 'connected' ? 'Seu WhatsApp foi conectado.' : 'QR Code gerado. Leia-o no seu WhatsApp.');
    } catch (connectionError) {
      setError(connectionError instanceof Error ? connectionError.message : 'Falha ao gerar o QR Code.');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    if (loading || !window.confirm('Deseja desconectar somente o seu WhatsApp?')) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      await whatsappApi.disconnect(true, true);
      Object.keys(localStorage).filter(key=>key.startsWith('whatsapp_')||key.startsWith('chat_')).forEach(key=>localStorage.removeItem(key));
      Object.keys(sessionStorage).filter(key=>key.startsWith('whatsapp_')||key.startsWith('chat_')).forEach(key=>sessionStorage.removeItem(key));
      setSession(null); setStatus('disconnected'); setSuccess('Sua sessão foi desconectada.');
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : 'Falha ao desconectar sua sessão.');
    } finally {
      setLoading(false);
    }
  };

  const phone = session?.sessionPhone || session?.phone || '';

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-primary">
        <QrCode size={28} />
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-on-surface">Meu WhatsApp</h2>
          <p className="text-xs text-on-surface-variant">Conecte e gerencie somente a sua sessão pessoal do atendimento.</p>
        </div>
      </div>

      <div className="bg-surface-container-highest/45 p-6 rounded-3xl border border-surface-container-high flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${status === 'connected' ? 'bg-success/10 text-success' : 'bg-surface-container-high text-on-surface-variant'}`}>
            {status === 'connected' ? <Wifi size={32} /> : <WifiOff size={32} />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Status da minha sessão</p>
            <p className="text-lg font-black uppercase text-on-surface">
              {status === 'connected' ? 'Sessão conectada' : status === 'qrcode' ? 'Aguardando leitura' : status === 'connecting' ? 'Conectando...' : 'Nenhuma sessão conectada'}
            </p>
            {phone && <p className="text-xs font-mono font-bold text-success mt-1">Número conectado: {phone}</p>}
            {session?.lastConnectedAt && <p className="text-[10px] text-on-surface-variant mt-1">Última conexão: {session.lastConnectedAt}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          {status === 'disconnected' ? (
            <button onClick={() => startConnection('connect')} disabled={loading || !uid} className="px-6 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Power size={18} />} Gerar QR Code
            </button>
          ) : (
            <button onClick={() => startConnection('reconnect')} disabled={loading} className="px-6 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />} Reconectar
            </button>
          )}
          {status !== 'disconnected' && (
            <button onClick={disconnect} disabled={loading} className="px-6 py-2.5 bg-error text-white text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 disabled:opacity-60">
              <Power size={18} /> Desconectar
            </button>
          )}
        </div>
      </div>

      {status === 'connecting' && <div className="h-60 rounded-3xl border border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-3"><Loader2 className="animate-spin text-primary" size={38} /><p className="text-xs font-black uppercase text-primary">Gerando seu QR Code...</p></div>}
      {status === 'qrcode' && session?.qrCodeDataUrl && (
        <div className="grid md:grid-cols-2 gap-8 p-6 rounded-3xl border border-surface-container-high bg-surface-container-lowest">
          <div className="flex justify-center"><div className="bg-white p-4 rounded-2xl border"><img src={session.qrCodeDataUrl} alt="QR Code do meu WhatsApp" className="w-56 h-56 object-contain" /></div></div>
          <div className="flex flex-col justify-center gap-3"><div className="flex items-center gap-2 text-primary"><Smartphone size={20} /><h3 className="text-sm font-black uppercase">Conectar aparelho</h3></div><ol className="list-decimal pl-5 text-xs text-on-surface-variant space-y-2"><li>Abra o WhatsApp no seu telefone.</li><li>Acesse Configurações → Aparelhos conectados.</li><li>Toque em Conectar um aparelho.</li><li>Leia este QR Code.</li></ol></div>
        </div>
      )}

      {error && <div role="alert" className="p-4 rounded-2xl bg-error/10 text-error text-xs font-bold flex items-center gap-3"><AlertCircle size={18} />{error}</div>}
      {success && <div className="p-4 rounded-2xl bg-success/10 text-success text-xs font-bold flex items-center gap-3"><CheckCircle2 size={18} />{success}</div>}
    </div>
  );
}
