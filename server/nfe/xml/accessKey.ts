export interface NfeAccessKeyParts {
  cUf: string;
  yearMonth: string;
  cnpj: string;
  model: '55';
  series: number;
  number: number;
  emissionType: '1';
  numericCode: string;
}

export function modulo11Nfe(value: string) {
  let weight = 2;
  let sum = 0;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    sum += Number(value[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const digit = 11 - remainder;
  return digit === 10 || digit === 11 ? 0 : digit;
}

export function buildNfeAccessKey(parts: NfeAccessKeyParts) {
  const base = [
    parts.cUf.padStart(2, '0'),
    parts.yearMonth,
    parts.cnpj.replace(/\D/g, '').padStart(14, '0'),
    parts.model,
    String(parts.series).padStart(3, '0'),
    String(parts.number).padStart(9, '0'),
    parts.emissionType,
    parts.numericCode.padStart(8, '0'),
  ].join('');
  if (!/^\d{43}$/.test(base)) throw new Error('Componentes inválidos para chave de acesso da NF-e.');
  return `${base}${modulo11Nfe(base)}`;
}
