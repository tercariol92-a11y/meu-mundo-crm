export const COMPANY_CRT = '1' as const; // Simples Nacional
export const COMPANY_UF = 'PR' as const;

export type SupportedCsosn = '102' | '202';
export type NfeOperation = 'venda_comum' | 'retorno_conserto';

export interface ProductTaxProfile {
  csosn: SupportedCsosn;
  ncm: string;
  cest?: string;
  hasIcmsSt?: boolean;
}

export function isInterstate(destinationUf: string) {
  return destinationUf.trim().toUpperCase() !== COMPANY_UF;
}

export function resolveCfop(operation: NfeOperation, destinationUf: string) {
  const interstate = isInterstate(destinationUf);
  if (operation === 'venda_comum') return interstate ? '6102' : '5102';
  return interstate ? '6916' : '5916';
}

export function validateProductTaxProfile(profile: ProductTaxProfile): string[] {
  const errors: string[] = [];
  const ncm = profile.ncm.replace(/\D/g, '');
  const cest = String(profile.cest || '').replace(/\D/g, '');

  if (!/^\d{8}$/.test(ncm)) errors.push('NCM deve possuir 8 dígitos.');
  if (profile.csosn === '102' && profile.hasIcmsSt) {
    errors.push('CSOSN 102 não deve ser marcado como operação com ICMS-ST.');
  }
  if (profile.csosn === '202') {
    if (!profile.hasIcmsSt) errors.push('CSOSN 202 exige operação com ICMS-ST.');
    if (!/^\d{7}$/.test(cest)) errors.push('CSOSN 202 exige CEST válido com 7 dígitos.');
  }
  return errors;
}
