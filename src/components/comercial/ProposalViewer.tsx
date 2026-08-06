import { Proposta, Cliente, Lead, ConfiguracaoEmpresa } from '../../types';
import { formatDateBR } from '../../utils/date';
import { 
  Download, 
  Printer, 
  X, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  ShieldCheck,
  Zap,
  Award,
  Package,
  DollarSign,
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { databaseService } from '../../services/databaseService';
import { proposalTotals } from '../../utils/proposalTotals';

import { useCompanyConfig } from '../../hooks/useCompanyConfig';

interface ProposalViewerProps {
  quote: Proposta;
  onClose: () => void;
}

export default function ProposalViewer({ quote, onClose }: ProposalViewerProps) {
  const { companyConfig, loading } = useCompanyConfig();

  const handlePrint = () => {
    if (loading) {
      console.warn('Aguardando carregamento dos dados para impressão...');
      return;
    }
    
    // Pequeno delay para garantir que o DOM está pronto e o browser respirou
    console.log('--- Iniciando Impressão de Proposta ---');
    setTimeout(() => {
      const printArea = document.getElementById('proposal-print-area');
      console.log('Status da área de impressão:', printArea ? 'PRONTA' : 'NÃO ENCONTRADA');
      if (printArea) {
        console.log('Conteúdo detectado (v) em characters:', printArea.innerHTML.length);
      }
      window.print();
    }, 300);
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Proposta Comercial: ${quote.titulo} - ${companyName}`);
    const body = encodeURIComponent(`Olá ${entityName},\n\nSegue em anexo a proposta comercial referente a ${quote.titulo}.\n\nVocê também pode visualizar os detalhes no nosso sistema.\n\nAtenciosamente,\n${companyName}`);
    window.location.href = `mailto:${entityEmail}?subject=${subject}&body=${body}`;
  };

  const entity = quote.cliente || quote.lead;
  const entityName = quote.cliente?.nomeFantasia || quote.lead?.nome || null;
  const entityEmail = quote.cliente?.emailPrincipal || quote.lead?.email || null;
  const entityPhone = quote.cliente?.celularWhatsapp || quote.lead?.whatsapp || null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center">
        <Loader2 className="animate-spin text-white" size={48} />
      </div>
    );
  }

  const companyName = companyConfig?.nome || 'MEU MUNDO CRM';
  const companyWebsite = companyConfig?.website || 'www.meumundocrm.com.br';
  const companyLocation = companyConfig?.cidade ? `${companyConfig.cidade}, ${companyConfig.estado || ''}` : 'Brasil';
  const companyLogo = companyConfig?.logoUrl;
  const companyCapa = companyConfig?.capaUrl;
  const totals = proposalTotals(quote);

  return (
    <>
      <style>{`
        @media print {
          @page {
            margin: 1.5cm;
            size: A4;
          }
          
          /* NUCLEAR ISOLATION */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }

          /* Hide EVERYTHING else in the app including portal root siblings */
          body > :not(#proposal-print-area) {
            display: none !important;
          }
          
          /* Hide the React root as well */
          #root {
            display: none !important;
          }

          /* Show only the targeted print area */
          #proposal-print-area {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            min-height: 100% !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 999999 !important;
          }

          #proposal-print-area * {
            visibility: visible !important;
          }
          
          /* Hide specific UI elements inside the printable content if any leaked */
          .toolbar-print-hide, .no-print, .print-hidden {
            display: none !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Section controls for professional flow */
          .section-block {
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            margin-bottom: 2rem !important;
            display: block !important;
            width: 100% !important;
          }

          .page-break-after {
            page-break-after: always !important;
            break-after: page !important;
          }
          
          .print-table {
            display: table !important;
            width: 100% !important;
          }
          
          .print-header-repeater {
            display: table-header-group !important;
          }
          
          .print-content-row {
            display: table-row-group !important;
          }
          
          h1, h2, h3, h4 { color: black !important; line-height: normal !important; }
          p, span, td { color: #1a1a1a !important; }
          
          p, span, h1, h2, h3, h4 {
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
          }
        }
      `}</style>

      {/* 1. VIEW ON SCREEN (MODAL) */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 overflow-y-auto print:hidden">
        <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
          
          {/* Toolbar */}
          <div className="px-8 py-4 bg-surface-container-highest border-b border-surface-container-high flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-on-surface">Visualização da Proposta</h2>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                quote.status === 'Aprovado' ? 'bg-green-100 text-green-700' :
                quote.status === 'Reprovado' ? 'bg-red-100 text-red-700' :
                quote.status === 'Em negociação' ? 'bg-orange-100 text-orange-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {quote.status === 'Aprovado' ? <CheckCircle2 size={12} /> : 
                 quote.status === 'Reprovado' ? <AlertCircle size={12} /> : 
                 quote.status === 'Em negociação' ? <Clock size={12} /> : <Clock size={12} />}
                {quote.status}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleSendEmail}
                className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20"
              >
                <Mail size={18} />
                Enviar por E-mail
              </button>
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                <Download size={18} />
                Baixar PDF / Imprimir
              </button>
              <button 
                onClick={onClose}
                className="flex items-center gap-2 bg-surface-container-highest text-on-surface-variant px-4 py-2 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-surface-container-high transition-all border border-surface-container-high"
              >
                <X size={18} />
                Sair
              </button>
            </div>
          </div>

          {/* Simple scrollable preview for screen */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto bg-white shadow-xl p-12 space-y-12 rounded-2xl">
               <div className="flex justify-between items-start border-b pb-8">
                  <div className="space-y-4">
                    {companyLogo && <img src={companyLogo} alt={companyName} className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />}
                    <h1 className="text-4xl font-black text-primary">{quote.titulo}</h1>
                    <p className="text-on-surface-variant">#{quote.id.slice(-6).toUpperCase()} | {formatDateBR(quote.createdAt)}</p>
                  </div>
                  {entityName && (
                    <div className="text-right">
                      <p className="font-black text-primary uppercase text-xs tracking-widest">Atenção para:</p>
                      <h2 className="text-xl font-bold">{entityName}</h2>
                    </div>
                  )}
               </div>
               <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <h3 className="font-bold flex items-center gap-2">Valor Total</h3>
                    <p className="text-3xl font-black text-primary">R$ {totals.investimentoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-bold">Validade</h3>
                    <p className="text-lg">{quote.validadeProposta || '10 dias'}</p>
                  </div>
               </div>
               <p className="text-on-surface-variant leading-relaxed italic border-l-4 border-primary/20 pl-6">
                 Esta é uma visualização rápida. Clique em "Baixar PDF" para ver o documento completo com capa, detalhes técnicos e condições comerciais.
               </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PRINT PORTAL - Absolute isolation at Body level */}
      {createPortal(
        <div id="proposal-print-area" className="hidden print:block bg-white text-black font-sans">
          <div className="max-w-none mx-auto bg-white print:p-0">
            {/* 1. COVER PAGE - Always page 1 */}
            <section 
              className="h-[950px] flex flex-col justify-between border-b-8 border-primary pb-16 relative overflow-hidden print:h-[260mm] print:w-full print:m-0 print:p-16 print:page-break-after print:border-b-0 bg-white"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-3">
                  {companyLogo ? (
                    <img src={companyLogo} alt={companyName} className="h-14 w-auto object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-48 h-14 bg-primary/5 rounded-xl flex items-center justify-center font-black text-xl italic tracking-tighter text-primary">
                      {companyName}
                    </div>
                  )}
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/60">Soluções Corporativas</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Documento de Proposta</p>
                  <p className="text-xl font-black text-primary uppercase">PROPOSTA COMERCIAL</p>
                  <div className="flex flex-col text-[10px] font-bold text-on-surface-variant">
                    <span>Nº #{quote.id.slice(-6).toUpperCase()}</span>
                    <span>Emissão: {formatDateBR(quote.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center space-y-12">
                <div className="space-y-6">
                  <div className="inline-block px-4 py-1.5 bg-primary/10 rounded-full">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Solução de Alta Performance</p>
                  </div>
                  <h1 className="text-5xl font-black leading-tight tracking-tight uppercase text-on-surface break-words max-w-2xl">
                    {quote.titulo}
                  </h1>
                  <p className="text-sm font-medium text-on-surface-variant max-w-lg leading-relaxed">
                    Transformando a gestão de tempo em produtividade, segurança e conformidade legal para sua organização.
                  </p>
                </div>
                
                {entityName && (
                  <div className="space-y-4 max-w-xl">
                    <p className="text-xs font-black uppercase tracking-widest text-primary border-l-4 border-primary pl-4">Preparado exclusivamente para:</p>
                    <div className="flex items-center gap-6 p-6 bg-gray-50 rounded-3xl border border-gray-100 shadow-sm">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl bg-white text-primary shadow-sm">
                        {entityName.charAt(0)}
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-2xl font-black uppercase tracking-tight text-on-surface">{entityName}</h2>
                        <div className="flex items-center gap-4 text-xs text-on-surface-variant font-medium">
                          {entityEmail && <span className="flex items-center gap-1.5"><Mail size={12} className="text-primary" /> {entityEmail}</span>}
                          {entityPhone && <span className="flex items-center gap-1.5"><Phone size={12} className="text-primary" /> {entityPhone}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-12 pt-12 border-t border-gray-100">
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-on-surface">Confiabilidade</h4>
                    <p className="text-[10px] text-on-surface-variant">Sistemas certificados.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-on-surface">Performance</h4>
                    <p className="text-[10px] text-on-surface-variant">Foco em agilidade.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                    <Award size={20} />
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-on-surface">Excelência</h4>
                    <p className="text-[10px] text-on-surface-variant">Padrão A premium.</p>
                  </div>
                </div>
              </div>
            </section>

            <table className="print-table">
              <thead className="print-header-repeater">
                <tr>
                  <td>
                    <div className="h-20 flex items-center justify-between px-12 border-b border-gray-100 mb-8 bg-white print:pt-4 opacity-60">
                      <div className="flex items-center gap-4 text-primary scale-75 origin-left">
                        {companyLogo ? (
                          <img src={companyLogo} alt={companyName} className="h-8 w-auto object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="bg-primary/5 px-2 py-1 rounded-lg font-black text-[10px] italic">
                            {companyName}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[7px] font-black uppercase tracking-widest text-primary/40">Resumo da Proposta</p>
                        <p className="text-[8px] font-bold text-on-surface">#{quote.id.slice(-6).toUpperCase()}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </thead>
              <tbody className="print-content-row">
                <tr>
                  <td className="p-0">
                    <div className="p-12 space-y-12">
                      <section className="space-y-12">
                        <div className="section-block grid grid-cols-2 gap-12">
                          <div className="space-y-6">
                            <h3 className="text-lg font-black uppercase tracking-widest text-primary flex items-center gap-2 underline underline-offset-8">
                              <Building2 size={24} /> Sobre a Empresa
                            </h3>
                            <p className="text-sm text-gray-700 leading-relaxed text-justify">
                              {quote.sobreEmpresa || companyConfig?.sobreEmpresa || 'Somos uma empresa dedicada a fornecer as melhores soluções tecnológicas para nossos clientes, focando em inovação, segurança e eficiência operacional.'}
                            </p>
                          </div>
                          <div className="space-y-6">
                            <h3 className="text-lg font-black uppercase tracking-widest text-primary flex items-center gap-2 underline underline-offset-8">
                              <Zap size={24} /> Diferenciais
                            </h3>
                            <p className="text-sm text-gray-700 leading-relaxed text-justify">
                              {quote.diferenciais || companyConfig?.diferenciais || 'Nosso compromisso é com o resultado do cliente, oferecendo suporte técnico 24/7, garantia estendida e treinamento especializado para todas as soluções implementadas.'}
                            </p>
                          </div>
                        </div>

                        <div className="p-8 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                          <h3 className="text-lg font-black uppercase tracking-widest text-primary">Solução Proposta</h3>
                          <p className="text-lg font-medium text-gray-800 leading-relaxed italic">
                             "{quote.solucaoProposta || 'A solução apresentada visa otimizar os processos atuais, garantindo maior controle e segurança para sua organização.'}"
                          </p>
                        </div>
                      </section>

                      <section className="space-y-12">
                        <h3 className="text-lg font-black uppercase tracking-widest text-primary flex items-center gap-2 underline underline-offset-8">
                          <Package size={24} /> Produtos e Equipamentos
                        </h3>
                        <div className="space-y-4">
                          {quote.itens.map((item, idx) => (
                            <div key={idx} className="section-block flex gap-6 items-start p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                              <div className="w-24 h-24 rounded-xl bg-white border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                                {item.imageUrl ? <img src={item.imageUrl} alt={item.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package size={32} className="text-gray-200" />}
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex justify-between items-start">
                                  <div><h4 className="text-base font-black text-black uppercase">{item.nome}</h4><span className="text-[8px] font-black uppercase text-primary">{totals.items[idx].periodicidade === 'mensal' ? 'Mensal' : totals.items[idx].periodicidade === 'anual' ? 'Anual' : totals.items[idx].tipoItem === 'servico' ? 'Serviço' : 'Produto'}</span></div>
                                  <span className="text-[10px] font-black bg-primary text-white px-2 py-1 rounded">QTD: {item.quantidade}</span>
                                </div>
                                <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">{item.descricao}</p>
                                {(item.beneficios || item.descricao) && (
                                  <div className="pt-2 flex flex-wrap gap-2">
                                    <span className="text-[9px] font-bold text-primary uppercase bg-primary/5 px-2 py-0.5 rounded border border-primary/10 tracking-widest flex items-center gap-1">
                                      <ShieldCheck size={10} /> Qualidade Premium
                                    </span>
                                    <span className="text-[9px] font-bold text-secondary uppercase bg-secondary/5 px-2 py-0.5 rounded border border-secondary/10 tracking-widest flex items-center gap-1">
                                      <Zap size={10} /> Eficiência Técnica
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-8">
                        <h3 className="text-lg font-black uppercase tracking-widest text-primary flex items-center gap-2 underline underline-offset-8">
                          <DollarSign size={24} /> Investimento
                        </h3>
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left">Item</th>
                                <th className="px-4 py-2 text-center">Qtd</th>
                                <th className="px-4 py-2 text-right">Unitário</th>
                                <th className="px-4 py-2 text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {quote.itens.map((item, idx) => (
                                <tr key={idx}>
                                  <td className="px-4 py-2 font-bold">{item.nome}<div className="text-[8px] uppercase text-primary">{totals.items[idx].periodicidade === 'mensal' ? 'Mensal' : totals.items[idx].periodicidade === 'anual' ? 'Anual' : totals.items[idx].tipoItem === 'servico' ? 'Serviço' : 'Produto'}</div></td>
                                  <td className="px-4 py-2 text-center">{item.quantidade}</td>
                                  <td className="px-4 py-2 text-right text-xs text-gray-500">R$ {item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-2 text-right">R$ {(totals.items[idx].valorFinal ?? totals.items[idx].total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              ))}
                              {totals.totalProdutos > 0 && <tr className="bg-gray-50 font-bold"><td colSpan={3} className="px-4 py-2 text-right uppercase">Total de produtos</td><td className="px-4 py-2 text-right">R$ {totals.totalProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>}
                              {totals.totalServicos > 0 && <tr className="bg-gray-50 font-bold"><td colSpan={3} className="px-4 py-2 text-right uppercase">Total de serviços</td><td className="px-4 py-2 text-right">R$ {totals.totalServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>}
                              <tr className="bg-primary/10 font-black text-primary"><td colSpan={3} className="px-4 py-4 text-right uppercase tracking-widest">Investimento inicial</td><td className="px-4 py-4 text-right text-xl">R$ {totals.investimentoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                              {totals.totalMensal > 0 && <tr className="bg-blue-50 font-black text-blue-700"><td colSpan={3} className="px-4 py-3 text-right uppercase">Mensalidade</td><td className="px-4 py-3 text-right">R$ {totals.totalMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</td></tr>}
                              {totals.totalAnual > 0 && <tr className="bg-purple-50 font-black text-purple-700"><td colSpan={3} className="px-4 py-3 text-right uppercase">Anuidade</td><td className="px-4 py-3 text-right">R$ {totals.totalAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/ano</td></tr>}
                            </tbody>
                          </table>
                        </div>

                        <div className="grid grid-cols-2 gap-8 pt-8">
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Condições</h4>
                            <div className="text-xs space-y-2">
                              <p><strong>Pagamento:</strong> {quote.formaPagamento || 'A combinar'}</p>
                              <p><strong>Entrega:</strong> {quote.prazoEntrega || 'Imediato'}</p>
                              <p><strong>Validade:</strong> {quote.validadeProposta || '10 dias'}</p>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Observações</h4>
                            <p className="text-[10px] text-gray-600 italic leading-relaxed">{quote.observacoes || 'Proposta sujeita a disponibilidade.'}</p>
                          </div>
                        </div>

                        {/* Signatures Section */}
                        <div className="pt-24 section-block">
                          <div className="grid grid-cols-2 gap-24 px-8">
                            {/* Company Signature */}
                            <div className="space-y-6">
                              <div className="border-b-2 border-black/20 w-full h-12" />
                              <div className="text-center space-y-2">
                                <p className="text-[11px] font-black text-on-surface uppercase tracking-tight">
                                  {companyConfig?.nome || 'MUNDO TECH RELÓGIOS DE PONTO E CATRACAS'}
                                </p>
                                <div className="space-y-1">
                                  <p className="text-[9px] text-on-surface-variant uppercase tracking-widest font-bold">Responsável pela Proposta</p>
                                  <p className="text-[8px] text-on-surface-variant italic">Assinatura da Contratada</p>
                                </div>
                                <div className="pt-4 flex items-center justify-center gap-2 text-[10px] text-on-surface-variant">
                                  <span>Data:</span>
                                  <span className="border-b border-black/10 w-24 h-4 inline-block" />
                                </div>
                              </div>
                            </div>

                            {/* Client Signature */}
                            <div className="space-y-6">
                              <div className="border-b-2 border-black/20 w-full h-12" />
                              <div className="text-center space-y-2">
                                <p className="text-[11px] font-black text-on-surface uppercase tracking-tight">
                                  {entityName || 'CONTRATANTE'}
                                </p>
                                <div className="space-y-1">
                                  <p className="text-[9px] text-on-surface-variant uppercase tracking-widest font-bold">
                                    {(quote.cliente?.tipoPessoa === 'Física' ? 'CPF: ' : 'CNPJ: ') + (quote.cliente?.cnpj || quote.cliente?.pagadorCpfCnpj || '____________________')}
                                  </p>
                                  <p className="text-[8px] text-on-surface-variant italic">Assinatura do Contratante</p>
                                </div>
                                <div className="pt-4 flex items-center justify-center gap-2 text-[10px] text-on-surface-variant">
                                  <span>Data:</span>
                                  <span className="border-b border-black/10 w-24 h-4 inline-block" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>

                      <footer className="pt-12 border-t border-gray-100 space-y-6">
                        <div className="flex justify-between items-start text-[8px] font-black uppercase tracking-[0.15em] text-gray-400 leading-normal">
                          <div className="space-y-1">
                            <p className="flex items-center gap-2 text-primary/60"><Globe size={10} /> {companyWebsite}</p>
                            <p className="flex items-center gap-2 text-primary/60"><MapPin size={10} /> {companyLocation}</p>
                          </div>
                          <div className="text-right space-y-1">
                            <p className="flex items-center justify-end gap-2 text-primary/60"><Phone size={10} /> {companyConfig?.telefone || '(00) 0000-0000'}</p>
                            <p className="flex items-center justify-end gap-2 text-primary/60"><Mail size={10} /> {companyConfig?.email || 'comercial@mundotech.com.br'}</p>
                          </div>
                        </div>
                        <div className="text-center space-y-2 border-t border-gray-50 pt-6">
                          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/40 italic">"Excelência e Precisão em Controle de Ponto e Acesso."</p>
                          <p className="text-[7px] text-gray-300 uppercase tracking-widest font-bold">© 2026 {companyName} - Todos os direitos reservados</p>
                        </div>
                      </footer>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
