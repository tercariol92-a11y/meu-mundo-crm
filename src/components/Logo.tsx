import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export default function Logo({ className = "h-10 w-auto", showText = true }: LogoProps) {
  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="flex items-center overflow-hidden">
            <span className="text-2xl font-medium tracking-tight text-[#0F172A] uppercase">
              Meu Mundo
            </span>
            <div className="w-[1px] h-4 bg-slate-200 mx-4"></div>
            <span className="text-2xl font-black tracking-tighter text-[#2563EB] uppercase relative">
              CRM
              <div className="absolute -bottom-1 left-0 w-full h-[2px] bg-[#2563EB] opacity-30"></div>
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-1.5">
          <div className="h-[1px] w-3 bg-[#2563EB] opacity-30"></div>
          <span className="text-[8px] font-bold tracking-[0.2em] text-slate-400 uppercase">
            Plataforma de Gestão
          </span>
        </div>
      </div>
    </div>
  );
}
