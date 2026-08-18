export type NfeSaleDraftStatus =
  | 'RASCUNHO'
  | 'VALIDANDO'
  | 'ASSINANDO'
  | 'ENVIANDO'
  | 'PROCESSANDO'
  | 'AUTORIZADA'
  | 'REJEITADA'
  | 'CANCELADA'
  | 'ERRO';

export interface NfeSaleItemDraft {
  productId: string;
  description: string;
  quantity: number;
  unit: string;
  unitValue: number;
  ncm: string;
  cfop: string;
  origin: string;
  cstCsosn: string;
  cest?: string;
  gtin?: string;
  pisCst: string;
  cofinsCst: string;
}

export interface NfeCommonSaleDraft {
  companyId: string;
  customerId: string;
  environment: 'homologacao' | 'producao';
  model: '55';
  purpose: 'normal';
  operation: 'venda_comum' | 'retorno_conserto';
  items: NfeSaleItemDraft[];
  freight: number;
  status: NfeSaleDraftStatus;
  idempotencyKey: string;
}

export function validateCommonSaleDraft(draft: NfeCommonSaleDraft): string[] {
  const errors: string[] = [];
  if (!draft.companyId) errors.push('Empresa emitente não identificada.');
  if (!draft.customerId) errors.push('Destinatário não identificado.');
  if (!draft.idempotencyKey) errors.push('Chave de idempotência ausente.');
  if (!draft.items.length) errors.push('A NF-e deve possuir ao menos um item.');
  draft.items.forEach((item, index) => {
    const label = `Item ${index + 1}`;
    if (!item.productId) errors.push(`${label}: produto ausente.`);
    if (!item.description.trim()) errors.push(`${label}: descrição ausente.`);
    if (!(item.quantity > 0)) errors.push(`${label}: quantidade deve ser maior que zero.`);
    if (!(item.unitValue > 0)) errors.push(`${label}: valor unitário deve ser maior que zero.`);
    if (!/^\d{8}$/.test(item.ncm.replace(/\D/g, ''))) errors.push(`${label}: NCM deve possuir 8 dígitos.`);
    if (!/^\d{4}$/.test(item.cfop.replace(/\D/g, ''))) errors.push(`${label}: CFOP deve possuir 4 dígitos.`);
    if (!item.origin) errors.push(`${label}: origem da mercadoria ausente.`);
    if (!['102', '202'].includes(item.cstCsosn)) errors.push(`${label}: CSOSN deve ser 102 ou 202.`);
    if (item.cstCsosn === '202' && !/^\d{7}$/.test(String(item.cest || '').replace(/\D/g, ''))) errors.push(`${label}: CSOSN 202 exige CEST com 7 dígitos.`);
    if (!/^\d{2}$/.test(item.pisCst)) errors.push(`${label}: CST PIS deve possuir 2 dígitos.`);
    if (!/^\d{2}$/.test(item.cofinsCst)) errors.push(`${label}: CST COFINS deve possuir 2 dígitos.`);
  });
  return errors;
}
