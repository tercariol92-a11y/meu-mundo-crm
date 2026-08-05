import { createPortal } from 'react-dom';
import { Chamado } from '../../types';
import { 
  X, 
  Download, 
  Building2, 
  User, 
  MapPin, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  Briefcase, 
  Info,
  Wrench,
  CheckCircle,
  FileText
} from 'lucide-react';

interface OSPrintViewerProps {
  chamado: Chamado;
  onClose: () => void;
}

export default function OSPrintViewer({ chamado, onClose }: OSPrintViewerProps) {
  const isConcluido = chamado.status === 'concluido' || chamado.status === 'finalizado';
  const titleOS = isConcluido ? 'Ordem de Serviço Executada' : 'Ordem de Serviço Parcial';
  const shortId = chamado.id.slice(-6).toUpperCase();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberto': return 'Aberto';
      case 'em_atendimento': return 'Em Atendimento';
      case 'aguardando_cliente': return 'Aguardando Cliente';
      case 'aguardando_peca': return 'Aguardando Peça';
      case 'concluido': return 'Concluído';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'baixa': return 'Baixa';
      case 'media': return 'Média';
      case 'alta': return 'Alta';
      case 'critica': return 'Crítica';
      default: return priority;
    }
  };

  const getAddress = () => {
    if (!chamado.cliente) return 'Não informado';
    const parts = [
      chamado.cliente.rua && `${chamado.cliente.rua}, ${chamado.cliente.numero || 'S/N'}`,
      chamado.cliente.complemento && `Compl: ${chamado.cliente.complemento}`,
      chamado.cliente.bairro,
      chamado.cliente.cidade && `${chamado.cliente.cidade} - ${chamado.cliente.estado || ''}`,
      chamado.cliente.cep && `CEP: ${chamado.cliente.cep}`
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Não informado';
  };

  const getTempoAberto = () => {
    if (!chamado.createdAt) return '---';
    const end = chamado.dataFechamento ? new Date(chamado.dataFechamento) : new Date();
    const start = new Date(chamado.createdAt);
    const diffMs = end.getTime() - start.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHrs}h ${diffMins}m`;
  };

  const formatDateBR = (dateStr?: string) => {
    if (!dateStr) return '---';
    try {
      return new Date(dateStr).toLocaleString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* 1. PRINT CUSTOM CSS STYLING */}
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            color: black !important;
          }

          /* Hide everything else */
          body > :not(#os-print-area) {
            display: none !important;
          }
          
          #root {
            display: none !important;
          }

          #os-print-area {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: white !important;
            margin: 0 !important;
            padding: 20mm !important;
            box-sizing: border-box !important;
          }

          #os-print-area * {
            visibility: visible !important;
            color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          .print-no-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-border {
            border: 1px solid #e2e8f0 !important;
          }
        }
      `}</style>

      {/* 2. ON-SCREEN VISUALIZATION MODAL */}
      <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[250] flex items-center justify-center p-4 overflow-y-auto print:hidden">
        <div className="w-full max-w-4xl bg-surface-container rounded-[32px] shadow-2xl flex flex-col overflow-hidden border border-surface-container-high my-8 max-h-[90vh]">
          
          {/* Toolbar */}
          <div className="px-8 py-5 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-on-surface">Exportar Ordem de Serviço</h2>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-0.5">Chamado #{shortId}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-primary/95 transition-all shadow-lg shadow-primary/15"
              >
                <Download size={16} />
                Baixar PDF / Imprimir
              </button>
              <button 
                onClick={onClose}
                className="flex items-center gap-2 bg-surface-container-high text-on-surface-variant px-4 py-2.5 rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-surface-container-highest transition-all border border-surface-container-high"
              >
                <X size={16} />
                Sair
              </button>
            </div>
          </div>

          {/* Scollable Area containing the beautiful print sheet replica */}
          <div className="flex-1 overflow-y-auto bg-surface-container-lowest p-8 md:p-12">
            <div className="max-w-3xl mx-auto bg-white text-slate-900 shadow-lg border border-slate-100 p-8 md:p-12 rounded-2xl space-y-8">
              
              {/* Document Header */}
              <div className="flex flex-col md:flex-row justify-between items-start border-b border-slate-200 pb-6 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm italic">
                      MT
                    </div>
                    <span className="text-xl font-black text-blue-600 tracking-tighter uppercase">MUNDO TECH</span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <p className="font-bold text-slate-700">Mundo Tech Soluções em Tecnologia LTDA</p>
                    <p>CNPJ: 12.345.678/0001-90</p>
                    <p>Tel: (11) 3333-3333 | E-mail: contato@mundotech.com.br</p>
                  </div>
                </div>

                <div className="text-left md:text-right space-y-1">
                  <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${isConcluido ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    {titleOS}
                  </span>
                  <p className="text-2xl font-black text-slate-900 mt-2">ORDEM DE SERVIÇO</p>
                  <p className="text-xs font-bold text-slate-500">Nº MT-{shortId}</p>
                </div>
              </div>

              {/* Grid 1: Cliente e Chamado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Dados do Cliente */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-blue-600 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                    <Building2 size={12} /> Dados do Cliente
                  </h3>
                  <div className="text-xs space-y-2">
                    <p><strong className="text-slate-500">Razão Social / Nome:</strong> <span className="font-bold text-slate-800">{chamado.cliente?.razaoSocial || chamado.cliente?.nomeFantasia || chamado.clienteNome || '---'}</span></p>
                    {chamado.cliente?.cnpj && <p><strong className="text-slate-500">CNPJ:</strong> <span className="text-slate-700">{chamado.cliente.cnpj}</span></p>}
                    <p><strong className="text-slate-500">Endereço:</strong> <span className="text-slate-700">{getAddress()}</span></p>
                    <p><strong className="text-slate-500">Responsável:</strong> <span className="text-slate-700">{chamado.cliente?.responsavelNome || 'Não informado'}</span></p>
                  </div>
                </div>

                {/* Dados do Atendimento */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-blue-600 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                    <Clock size={12} /> Dados do Chamado
                  </h3>
                  <div className="text-xs space-y-2">
                    <p><strong className="text-slate-500">Título:</strong> <span className="font-bold text-slate-800">{chamado.titulo}</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      <p><strong className="text-slate-500">Status:</strong> <span className="font-semibold text-slate-700">{getStatusLabel(chamado.status)}</span></p>
                      <p><strong className="text-slate-500">Prioridade:</strong> <span className="font-semibold text-slate-700">{getPriorityLabel(chamado.prioridade)}</span></p>
                    </div>
                    <p><strong className="text-slate-500">Técnico Responsável:</strong> <span className="text-slate-700">{chamado.tecnico?.nome || 'Não atribuído'}</span></p>
                    <p><strong className="text-slate-500">Abertura:</strong> <span className="text-slate-700">{formatDateBR(chamado.createdAt)}</span></p>
                    {isConcluido && chamado.dataFechamento && (
                      <p><strong className="text-slate-500">Conclusão:</strong> <span className="text-slate-700">{formatDateBR(chamado.dataFechamento)}</span></p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <p><strong className="text-slate-500">Tempo em Aberto:</strong> <span className="text-slate-700">{getTempoAberto()}</span></p>
                      {chamado.slaDeadline && (
                        <p><strong className="text-slate-500">SLA Limite:</strong> <span className="text-slate-700">{formatDateBR(chamado.slaDeadline)}</span></p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Descrição do Problema */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-blue-600 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                  <ShieldAlert size={12} /> Descrição do Problema / Solicitação
                </h3>
                <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-700 leading-relaxed border border-slate-100">
                  {chamado.descricao || 'Nenhuma descrição detalhada informada.'}
                </div>
              </div>

              {/* Serviço Executado */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-blue-600 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                    <Wrench size={12} /> Serviço Técnico Executado
                  </h3>
                  <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-700 leading-relaxed border border-slate-100 min-h-[80px]">
                    {chamado.solucaoAplicada || 'Atendimento técnico em andamento. Solução não finalizada.'}
                  </div>
                </div>

                {/* Peças Utilizadas */}
                <div className="space-y-2">
                  <h4 className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Peças / Materiais Utilizados</h4>
                  {chamado.pecasUtilizadas && chamado.pecasUtilizadas.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-bold border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2">Peça / Material</th>
                            <th className="px-4 py-2 text-center w-24">Quantidade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {chamado.pecasUtilizadas.map((peca, idx) => (
                            <tr key={idx} className="text-slate-700">
                              <td className="px-4 py-2 font-medium">{peca.nome}</td>
                              <td className="px-4 py-2 text-center">{peca.quantidade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic px-2">Nenhum registro de peça ou material trocado para este atendimento.</p>
                  )}
                </div>

                {/* Observações adicionais */}
                <div className="space-y-2">
                  <h4 className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Observações Técnicas Complementares</h4>
                  <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3">
                    {chamado.observacoesTecnicas || 'Nenhuma observação complementar registrada.'}
                  </p>
                </div>
              </div>

              {/* Assinaturas / Encerramento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-10 border-t border-slate-200 print-no-break">
                {/* Assinatura Técnico */}
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-full border-b border-slate-300 pb-1 mt-10"></div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">{chamado.tecnico?.nome || 'Assinatura do Técnico'}</p>
                    <p className="text-slate-500 uppercase text-[9px] tracking-wider font-bold mt-0.5">Mundo Tech Técnico Responsável</p>
                    <p className="text-slate-400 text-[10px] mt-1">Data: ____/____/________</p>
                  </div>
                </div>

                {/* Assinatura Cliente */}
                <div className="flex flex-col items-center text-center space-y-4">
                  {chamado.assinaturaCliente ? (
                    <div className="h-16 flex items-center justify-center p-1 bg-slate-50 rounded-lg border border-slate-200">
                      <img src={chamado.assinaturaCliente} alt="Assinatura" className="max-h-full" />
                    </div>
                  ) : (
                    <div className="w-full border-b border-slate-300 pb-1 mt-10"></div>
                  )}
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">{chamado.cliente?.responsavelNome || chamado.clienteNome || 'Assinatura do Cliente'}</p>
                    <p className="text-slate-500 uppercase text-[9px] tracking-wider font-bold mt-0.5">Cliente Representante Autorizado</p>
                    <p className="text-slate-400 text-[10px] mt-1">Data: ____/____/________</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* 3. HARD PORTAL FOR ISOLATED BROWSER PRINT DIALOG */}
      {createPortal(
        <div id="os-print-area" className="hidden print:block bg-white text-slate-900 font-sans">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-300 pb-4">
            <div className="space-y-1">
              <h2 className="text-lg font-black text-blue-600 tracking-tighter uppercase">MUNDO TECH</h2>
              <div className="text-[10px] text-slate-600 leading-tight">
                <p className="font-bold text-slate-800">Mundo Tech Soluções em Tecnologia LTDA</p>
                <p>CNPJ: 12.345.678/0001-90</p>
                <p>Tel: (11) 3333-3333 | E-mail: contato@mundotech.com.br</p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block border border-slate-400 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-widest text-slate-700 rounded">
                {titleOS}
              </span>
              <p className="text-lg font-black text-slate-900 mt-1">ORDEM DE SERVIÇO</p>
              <p className="text-[10px] font-bold text-slate-500">Nº MT-{shortId}</p>
            </div>
          </div>

          {/* Core Info Block */}
          <div className="grid grid-cols-2 gap-6 mt-6 border border-slate-200 p-4 rounded bg-slate-50/50">
            {/* Client */}
            <div className="space-y-1">
              <h3 className="text-[9px] font-black uppercase tracking-wider text-blue-600 border-b border-slate-200 pb-0.5">
                Dados do Cliente
              </h3>
              <div className="text-[10px] space-y-1 leading-normal">
                <p><strong>Razão Social / Nome:</strong> {chamado.cliente?.razaoSocial || chamado.cliente?.nomeFantasia || chamado.clienteNome || '---'}</p>
                {chamado.cliente?.cnpj && <p><strong>CNPJ:</strong> {chamado.cliente.cnpj}</p>}
                <p><strong>Endereço:</strong> {getAddress()}</p>
                <p><strong>Contato Responsável:</strong> {chamado.cliente?.responsavelNome || '---'}</p>
              </div>
            </div>

            {/* Ticket Info */}
            <div className="space-y-1">
              <h3 className="text-[9px] font-black uppercase tracking-wider text-blue-600 border-b border-slate-200 pb-0.5">
                Dados do Chamado
              </h3>
              <div className="text-[10px] space-y-1 leading-normal">
                <p><strong>Título:</strong> {chamado.titulo}</p>
                <p><strong>Status:</strong> {getStatusLabel(chamado.status)} | <strong>Prioridade:</strong> {getPriorityLabel(chamado.prioridade)}</p>
                <p><strong>Técnico Responsável:</strong> {chamado.tecnico?.nome || 'Não atribuído'}</p>
                <p><strong>Abertura:</strong> {formatDateBR(chamado.createdAt)}</p>
                {isConcluido && chamado.dataFechamento && (
                  <p><strong>Conclusão:</strong> {formatDateBR(chamado.dataFechamento)}</p>
                )}
                <p><strong>SLA Limite:</strong> {formatDateBR(chamado.slaDeadline || chamado.slaPrazo)} | <strong>Tempo em Aberto:</strong> {getTempoAberto()}</p>
              </div>
            </div>
          </div>

          {/* Description Block */}
          <div className="mt-6 space-y-1">
            <h3 className="text-[9px] font-black uppercase tracking-wider text-blue-600 border-b border-slate-200 pb-0.5">
              Descrição da Solicitação / Ocorrência
            </h3>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded text-[10px] text-slate-700 leading-relaxed italic">
              "{chamado.descricao || 'Nenhum detalhe de descrição fornecido.'}"
            </div>
          </div>

          {/* Service Performed Block */}
          <div className="mt-6 space-y-1 print-no-break">
            <h3 className="text-[9px] font-black uppercase tracking-wider text-blue-600 border-b border-slate-200 pb-0.5">
              Ações Técnicas Executadas
            </h3>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded text-[10px] text-slate-700 leading-relaxed min-h-[60px]">
              {chamado.solucaoAplicada || 'Atendimento em andamento. Solução técnica não preenchida.'}
            </div>
          </div>

          {/* Pieces Block */}
          {chamado.pecasUtilizadas && chamado.pecasUtilizadas.length > 0 && (
            <div className="mt-4 space-y-1 print-no-break">
              <h4 className="text-[8px] font-extrabold uppercase tracking-wider text-slate-500">Peças Utilizadas</h4>
              <table className="w-full text-[9px] text-left border border-slate-200">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-1">Descrição do Item</th>
                    <th className="px-3 py-1 text-center w-24">Qtd.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chamado.pecasUtilizadas.map((p, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-1 font-medium">{p.nome}</td>
                      <td className="px-3 py-1 text-center">{p.quantidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Comments Block */}
          {chamado.observacoesTecnicas && (
            <div className="mt-4 space-y-1 print-no-break">
              <h4 className="text-[8px] font-extrabold uppercase tracking-wider text-slate-500">Observações Técnicas</h4>
              <p className="text-[10px] text-slate-700 bg-slate-50 border border-slate-100 rounded p-3">
                {chamado.observacoesTecnicas}
              </p>
            </div>
          )}

          {/* Signatures Block */}
          <div className="grid grid-cols-2 gap-12 mt-12 print-no-break">
            <div className="flex flex-col items-center text-center">
              <div className="w-full border-b border-slate-400 pb-0.5 mt-8"></div>
              <div className="text-[10px] mt-1">
                <p className="font-bold">{chamado.tecnico?.nome || 'Assinatura do Técnico'}</p>
                <p className="text-slate-500 text-[8px] font-bold uppercase tracking-wider">Técnico Responsável - Mundo Tech</p>
                <p className="text-slate-400 text-[8px] mt-0.5">Data: ____/____/________</p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center">
              {chamado.assinaturaCliente ? (
                <div className="h-10 flex items-center justify-center p-0.5 border border-slate-200 rounded">
                  <img src={chamado.assinaturaCliente} alt="Assinatura" className="max-h-full" />
                </div>
              ) : (
                <div className="w-full border-b border-slate-400 pb-0.5 mt-8"></div>
              )}
              <div className="text-[10px] mt-1">
                <p className="font-bold">{chamado.cliente?.responsavelNome || chamado.clienteNome || 'Assinatura do Cliente'}</p>
                <p className="text-slate-500 text-[8px] font-bold uppercase tracking-wider">Representante Autorizado do Cliente</p>
                <p className="text-slate-400 text-[8px] mt-0.5">Data: ____/____/________</p>
              </div>
            </div>
          </div>

        </div>,
        document.body
      )}
    </>
  );
}
