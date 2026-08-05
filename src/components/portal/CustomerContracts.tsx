import React from 'react';
import { FileText, Calendar, CheckCircle2 } from 'lucide-react';
import { CustomerPortalUser, Cliente } from '../../types';

interface CustomerContractsProps {
  user: CustomerPortalUser;
  clienteData: Cliente;
}

export default function CustomerContracts({ user, clienteData }: CustomerContractsProps) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-on-surface uppercase tracking-tight">Meus Contratos</h2>
          <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Visualize seus contratos ativos e vigência</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {clienteData.possuiContrato ? (
          <div className="bg-surface-container-low p-8 rounded-[2rem] border border-surface-container-high shadow-lg">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="font-black text-lg text-on-surface uppercase tracking-tight">Contrato de Manutenção</h3>
                <p className="text-[10px] text-green-600 font-black uppercase tracking-widest flex items-center gap-1">
                  <CheckCircle2 size={12} /> Ativo
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between py-3 border-b border-surface-container-high">
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Número</span>
                <span className="text-xs font-bold text-on-surface">{clienteData.contratoNumero || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-surface-container-high">
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Início</span>
                <span className="text-xs font-bold text-on-surface">{clienteData.contratoInicio || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-surface-container-high">
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Vencimento</span>
                <span className="text-xs font-bold text-on-surface">{clienteData.contratoVencimento || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tipo de Suporte</span>
                <span className="text-xs font-bold text-primary uppercase">{clienteData.slaConfig?.supportType || 'Padrão'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="col-span-full bg-surface-container-low p-12 rounded-[2rem] border border-surface-container-high text-center">
            <FileText size={48} className="mx-auto text-on-surface-variant/20 mb-4" />
            <h3 className="text-lg font-black text-on-surface uppercase tracking-tight">Nenhum contrato ativo</h3>
            <p className="text-sm text-on-surface-variant max-w-sm mx-auto mt-2">Você não possui contratos de manutenção registrados no momento.</p>
          </div>
        )}
      </div>
    </div>
  );
}
