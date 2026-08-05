import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { CustomerPortalUser, Cliente } from '../../types';

interface CustomerSLAViewProps {
  user: CustomerPortalUser;
  clienteData: Cliente;
}

export default function CustomerSLAView({ user, clienteData }: CustomerSLAViewProps) {
  const sla = clienteData.slaConfig;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-on-surface uppercase tracking-tight">Meus Acordos de Nível de Serviço (SLA)</h2>
          <p className="text-xs text-on-surface-variant font-bold uppercase tracking-widest">Confira os prazos acordados para suporte e resolução</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-surface-container-low p-8 rounded-[2rem] border border-surface-container-high shadow-lg flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
            <Clock size={32} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">Primeira Resposta</h3>
          <div className="text-4xl font-black text-on-surface tracking-tighter mb-1">
            {sla?.firstResponseHours || '---'}h
          </div>
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Tempo máximo para contato inicial</p>
        </div>

        <div className="bg-surface-container-low p-8 rounded-[2rem] border border-surface-container-high shadow-lg flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-2xl flex items-center justify-center mb-6">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">Resolução Final</h3>
          <div className="text-4xl font-black text-on-surface tracking-tighter mb-1">
            {sla?.resolutionHours || '---'}h
          </div>
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Tempo máximo para conclusão</p>
        </div>

        <div className="bg-surface-container-low p-8 rounded-[2rem] border border-surface-container-high shadow-lg flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
            <Info size={32} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant mb-2">Tipo de Atendimento</h3>
          <div className="text-xl font-black text-on-surface uppercase tracking-tight mb-1 mt-3">
            {sla?.supportType || 'Padrão'}
          </div>
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Modelo de suporte contratado</p>
        </div>
      </div>

      <div className="bg-surface-container-low p-8 rounded-[2rem] border border-surface-container-high">
        <h3 className="text-sm font-black text-on-surface uppercase tracking-wider mb-6 flex items-center gap-2">
          <AlertCircle size={18} className="text-primary" />
          Horário de Atendimento
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-surface-container-high">
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Dias da Semana</span>
              <span className="text-xs font-bold text-on-surface">Segunda a Sexta</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-surface-container-high">
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Horário Comercial</span>
              <span className="text-xs font-bold text-on-surface">
                {sla?.workingHoursStart || '08:00'} às {sla?.workingHoursEnd || '18:00'}
              </span>
            </div>
          </div>
          <div className="p-6 bg-surface-container-highest/20 rounded-2xl">
            <p className="text-xs font-medium text-on-surface-variant leading-relaxed italic">
              "Chamados abertos fora do horário comercial iniciarão a contagem do SLA no próximo dia útil às {sla?.workingHoursStart || '08:00'}."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
