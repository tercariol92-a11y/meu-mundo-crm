import { useState, useEffect } from 'react';
import * as React from 'react';
import { databaseService } from '../../services/databaseService';
import { ConfiguracaoEmpresa } from '../../types';
import { 
  Building2, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  Save, 
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  FileText,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';

import { useCompany } from '../../contexts/CompanyContext';

export default function CompanySettings() {
  const { refreshConfig } = useCompany();
  const [config, setConfig] = useState<Partial<ConfiguracaoEmpresa>>({
    nome: '',
    razaoSocial: '',
    cnpj: '',
    logoUrl: '',
    capaUrl: '',
    website: '',
    email: '',
    telefone: '',
    endereco: '',
    cidade: '',
    estado: '',
    sobreEmpresa: '',
    diferenciais: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await databaseService.getConfiguracaoEmpresa();
      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await databaseService.updateConfiguracaoEmpresa(config);
      await refreshConfig();
      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-on-surface uppercase tracking-tighter">Configurações da Empresa</h1>
          <p className="text-on-surface-variant text-sm">Personalize os dados que aparecem nas suas propostas e no sistema.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Identidade Visual */}
        <section className="bg-surface-container rounded-[32px] p-8 border border-surface-container-high space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <ImageIcon size={24} />
            <h2 className="text-sm font-black uppercase tracking-widest">Identidade Visual</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">URL da Logo</label>
              <input
                type="text"
                value={config.logoUrl || ''}
                onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="https://exemplo.com/logo.png"
              />
              <p className="text-[10px] text-on-surface-variant italic">Recomendado: Logo em formato PNG com fundo transparente.</p>
            </div>
            <div className="flex justify-center">
              <div className="w-48 h-24 bg-surface-container-highest rounded-2xl border-2 border-dashed border-surface-container-high flex items-center justify-center overflow-hidden">
                {config.logoUrl ? (
                  <img src={config.logoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain p-4" referrerPolicy="no-referrer" />
                ) : (
                  <ImageIcon size={32} className="text-on-surface-variant/20" />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center border-t border-surface-container-high pt-8">
            <div className="space-y-4">
              <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">URL da Capa da Proposta</label>
              <input
                type="text"
                value={config.capaUrl || ''}
                onChange={(e) => setConfig({ ...config, capaUrl: e.target.value })}
                className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="https://exemplo.com/capa.jpg"
              />
              <p className="text-[10px] text-on-surface-variant italic">Recomendado: Imagem em alta resolução (1920x1080).</p>
            </div>
            <div className="flex justify-center">
              <div className="w-full aspect-video bg-surface-container-highest rounded-2xl border-2 border-dashed border-surface-container-high flex items-center justify-center overflow-hidden">
                {config.capaUrl ? (
                  <img src={config.capaUrl} alt="Capa Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon size={32} className="text-on-surface-variant/20" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">Preview da Capa</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Dados Básicos */}
        <section className="bg-surface-container rounded-[32px] p-8 border border-surface-container-high space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <Building2 size={24} />
            <h2 className="text-sm font-black uppercase tracking-widest">Dados da Empresa</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nome Fantasia</label>
              <input
                type="text"
                required
                value={config.nome || ''}
                onChange={(e) => setConfig({ ...config, nome: e.target.value })}
                className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Razão Social</label>
              <input
                type="text"
                value={config.razaoSocial || ''}
                onChange={(e) => setConfig({ ...config, razaoSocial: e.target.value })}
                className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">CNPJ</label>
              <input
                type="text"
                value={config.cnpj || ''}
                onChange={(e) => setConfig({ ...config, cnpj: e.target.value })}
                className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Website</label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                <input
                  type="text"
                  value={config.website || ''}
                  onChange={(e) => setConfig({ ...config, website: e.target.value })}
                  className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="www.suaempresa.com.br"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Contato e Localização */}
        <section className="bg-surface-container rounded-[32px] p-8 border border-surface-container-high space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <MapPin size={24} />
            <h2 className="text-sm font-black uppercase tracking-widest">Contato e Localização</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Email Comercial</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                <input
                  type="email"
                  value={config.email || ''}
                  onChange={(e) => setConfig({ ...config, email: e.target.value })}
                  className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                <input
                  type="text"
                  value={config.telefone || ''}
                  onChange={(e) => setConfig({ ...config, telefone: e.target.value })}
                  className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Endereço Completo</label>
              <input
                type="text"
                value={config.endereco || ''}
                onChange={(e) => setConfig({ ...config, endereco: e.target.value })}
                className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Cidade</label>
              <input
                type="text"
                value={config.cidade || ''}
                onChange={(e) => setConfig({ ...config, cidade: e.target.value })}
                className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Estado (UF)</label>
              <input
                type="text"
                maxLength={2}
                value={config.estado || ''}
                onChange={(e) => setConfig({ ...config, estado: e.target.value.toUpperCase() })}
                className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
        </section>

        {/* Conteúdo da Proposta */}
        <section className="bg-surface-container rounded-[32px] p-8 border border-surface-container-high space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <FileText size={24} />
            <h2 className="text-sm font-black uppercase tracking-widest">Conteúdo das Propostas</h2>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-primary" />
                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Sobre a Empresa (Padrão)</label>
              </div>
              <textarea
                rows={4}
                value={config.sobreEmpresa || ''}
                onChange={(e) => setConfig({ ...config, sobreEmpresa: e.target.value })}
                className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                placeholder="Descreva sua empresa para aparecer nas propostas..."
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-primary" />
                <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nossos Diferenciais (Padrão)</label>
              </div>
              <textarea
                rows={4}
                value={config.diferenciais || ''}
                onChange={(e) => setConfig({ ...config, diferenciais: e.target.value })}
                className="w-full bg-surface-container-highest border border-surface-container-high rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                placeholder="Liste os diferenciais da sua empresa..."
              />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-4">
          {message && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-2 text-sm font-bold ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
            >
              {message.type === 'success' && <CheckCircle2 size={18} />}
              {message.text}
            </motion.div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar Configurações
          </button>
        </div>
      </form>
    </div>
  );
}
