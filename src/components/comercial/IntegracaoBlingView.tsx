import { useState, useEffect } from 'react';
import { databaseService } from '../../services/databaseService';
import { BlingConfig } from '../../types';
import { 
  Settings, 
  Key, 
  RefreshCw, 
  ShieldCheck, 
  ExternalLink, 
  Save,
  CheckCircle2,
  AlertCircle,
  Database,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function IntegracaoBlingView() {
  const [config, setConfig] = useState<Partial<BlingConfig>>({
    clientId: '',
    clientSecret: '',
    active: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await databaseService.getBlingConfig();
      if (data) setConfig(data);
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await databaseService.updateBlingConfig(config);
      setToast({ message: 'Configurações salvas com sucesso!', type: 'success' });
      fetchConfig();
    } catch (error) {
      setToast({ message: 'Erro ao salvar configurações.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary shadow-inner">
            <Zap size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-on-surface">Integração Bling API v3</h1>
            <p className="text-sm text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={14} className="text-green-500" />
              Sincronização Segura de Dados
            </p>
          </div>
        </div>
        <p className="text-on-surface-variant leading-relaxed text-sm">
          Conecte seu Mundo CRM ao ERP Bling para automatizar a criação de pedidos, 
          sincronização de clientes e gestão de emissão de notas fiscais.
        </p>
      </div>

      {/* Integration Form */}
      <motion.form 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSave} 
        className="bg-surface-container-low rounded-[2.5rem] border border-surface-container-high p-10 shadow-xl space-y-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Key size={18} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Credenciais da API</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Client ID</label>
                <input
                  type="text"
                  required
                  className="w-full px-6 py-4 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={config.clientId}
                  onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                  placeholder="Seu Bling Client ID..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Client Secret</label>
                <input
                  type="password"
                  required
                  className="w-full px-6 py-4 bg-surface-container-highest/20 border border-surface-container-high rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={config.clientSecret}
                  onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                  placeholder="••••••••••••••••"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Settings size={18} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Configurações de Fluxo</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-5 bg-surface-container-highest/10 rounded-2xl border border-surface-container-high">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">Status da Integração</p>
                  <p className="text-[10px] text-on-surface-variant opacity-60">Ativar/Desativar sincronização</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, active: !config.active })}
                  className={`w-12 h-6 rounded-full transition-all relative ${config.active ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-surface-container-highest'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.active ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="p-5 bg-surface-container-highest/30 rounded-3xl border border-surface-container-high space-y-3">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <RefreshCw size={14} className="animate-spin-slow" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Sincronização Ativa</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-green-500" />
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Clientes: Mundo CRM → Bling</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-green-500" />
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Pedidos: Aprovado → Bling</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-surface-container-high">
          <a 
            href="https://developer.bling.com.br" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest hover:underline"
          >
            Acessar Bling Developer Dashboard
            <ExternalLink size={14} />
          </a>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-10 py-4 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95"
          >
            {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
            Salvar Configurações
          </button>
        </div>
      </motion.form>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Database, label: 'Sincronização', desc: 'Dados em tempo real via Webhooks' },
          { icon: ShieldCheck, label: 'Segurança', desc: 'Auth 2.0 com criptografia ponta-a-ponta' },
          { icon: Zap, label: 'Performance', desc: 'Baseado na API v3 de alta velocidade' }
        ].map((item, i) => (
          <div key={i} className="p-6 bg-surface-container-low rounded-3xl border border-surface-container-high space-y-2">
            <item.icon className="text-primary mb-2" size={24} />
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface">{item.label}</p>
            <p className="text-[10px] text-on-surface-variant leading-relaxed uppercase tracking-wider opacity-60">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' ? 'bg-green-600 text-white border-green-500' : 'bg-red-600 text-white border-red-500'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            <span className="text-sm font-black uppercase tracking-widest">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
