import { Cliente, ConfiguracaoFiscal, FaturamentoRecorrente } from '../types';
import { fiscalApi } from './fiscalApi';
import { resolveMunicipalityIbgeCode } from './municipalityIbge';

export type SecureA1Session = Record<string, unknown>;
export const fiscalA1SessionRef: { current: SecureA1Session | null } = { current: null };

const digits = (value?: unknown) => String(value || '').replace(/\D/g, '');

export function isValidCnpj(value?: unknown) {
  const cnpj = digits(value);
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calculateDigit = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${first}${second}`);
}

export type NfseDraftIssueOrigin = 'cliente' | 'contrato' | 'configuracao_fiscal';
export interface NfseDraftIssue {
  key: string;
  origin: NfseDraftIssueOrigin;
  label: string;
}

export function validateNfseDraftData(args: { client?: Cliente; config?: ConfiguracaoFiscal | null; description?: string; amount?: number; competence?: string; recurring?: FaturamentoRecorrente; issWithheld?: boolean }): NfseDraftIssue[] {
  const issues: NfseDraftIssue[] = [];
  const add = (key: string, origin: NfseDraftIssueOrigin, label: string) => issues.push({ key, origin, label });
  const client = args.client;
  const config = args.config;
  const fiscal = (args.recurring?.fiscalSnapshot || {}) as Record<string, unknown>;
  if (!client) add('client', 'cliente', 'Cliente/tomador não localizado');
  if (client && !String(client.razaoSocial || client.nomeFantasia || '').trim()) add('clientName', 'cliente', 'Razão social do tomador não informada');
  if (client && !isValidCnpj(client.cnpj || client.pagadorCpfCnpj)) add('clientTaxId', 'cliente', 'CNPJ do tomador inválido: confira os 14 dígitos e os dígitos verificadores');
  if (client && !resolveMunicipalityIbgeCode(client.codigoIbge, client.cidade, client.estado)) add('clientMunicipalityCode', 'cliente', 'Código IBGE do município do tomador ausente ou inválido (deve possuir 7 dígitos)');
  if (client && (!digits(client.cep) || !client.rua || !client.numero || !client.bairro)) add('clientAddress', 'cliente', 'CEP/endereço do tomador incompleto');
  if (!String(args.description || '').trim()) add('serviceDescription', 'contrato', 'Descrição fiscal do serviço ausente');
  if (!(Number(args.amount) > 0)) add('serviceAmount', 'contrato', 'Valor da NFS-e inválido');
  if (!String(fiscal.codigoServicoMunicipal || config?.codigoServicoMunicipal || '').trim()) add('serviceCode', 'contrato', 'Código de tributação nacional/NFS-e não definido');
  if (!String(fiscal.itemLc116 || config?.itemListaServico || '').trim()) add('lc116', 'contrato', 'Item da lista LC 116 não definido');
  if (!String(fiscal.nbs || config?.nbs || '').trim()) add('nbs', 'contrato', 'NBS do serviço não definido');
  const issRate = Number(fiscal.aliquotaIss ?? config?.aliquotaIssPadrao);
  if (!Number.isFinite(issRate) || issRate < 0) add('issRate', 'contrato', 'Alíquota/ISS não configurada');
  if (!/^\d{4}-\d{2}/.test(String(args.competence || ''))) add('competence', 'contrato', 'Competência fiscal inválida');
  if (!config) add('fiscalConfig', 'configuracao_fiscal', 'Configuração fiscal necessária para emissão ausente');
  if (config && digits(config.cnpj).length !== 14) add('providerTaxId', 'configuracao_fiscal', 'CNPJ do prestador ausente ou inválido');
  if (config && !String(config.razaoSocial || '').trim()) add('providerName', 'configuracao_fiscal', 'Razão social do prestador ausente');
  if (config && !String(config.codigoIbge || '').trim()) add('providerMunicipalityCode', 'configuracao_fiscal', 'Município/IBGE do prestador ausente');
  return issues;
}

export function buildValidatedNfseDraft(args: { client: Cliente; config: ConfiguracaoFiscal; description: string; amount: number; competence: string; issWithheld: boolean; credentials: SecureA1Session; recurring?: FaturamentoRecorrente }) {
  const { client, config, recurring } = args;
  const issues = validateNfseDraftData(args);
  if (issues.length) throw Object.assign(new Error(issues[0].label), { code: 'NFSE_DRAFT_INVALID', issues });
  const cnpj = digits(client.cnpj || client.pagadorCpfCnpj);
  const fiscal = (recurring?.fiscalSnapshot || {}) as Record<string, unknown>;
  const municipalityCode = resolveMunicipalityIbgeCode(client.codigoIbge, client.cidade, client.estado);
  const fiscalNbs = digits(fiscal.nbs);
  const nbs = /^\d{9}$/.test(fiscalNbs) ? fiscalNbs : digits(config.nbs);
  const brasiliaNow = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  return {
    ...args.credentials,
    expectedCnpj: config.cnpj,
    generateBoleto: false,
    generateBoletoAfterAuthorization: recurring?.generateBoleto === true,
    clientId: client.id,
    clientName: client.razaoSocial || client.nomeFantasia,
    recurringBillingId: recurring?.id,
    contractId: recurring?.contractId,
    competence: args.competence,
    dpsData: {
      cnpj: config.cnpj, municipalRegistration: config.inscricaoMunicipal, cncAllowsMunicipalRegistration: false,
      companyName: config.razaoSocial, emitterType: '1', series: '1',
      issuedAt: `${brasiliaNow.slice(0, 19)}-03:00`, competenceDate: `${args.competence.slice(0, 7)}-${String(new Date().getDate()).padStart(2, '0')}`,
      nationalServiceCode: digits(fiscal.codigoServicoMunicipal || config.codigoServicoMunicipal).slice(0, 6),
      nbs, serviceDescription: args.description.trim(), serviceValue: args.amount.toFixed(2),
      simpleNationalOption: '3', simpleNationalTaxRegime: '1', specialTaxRegime: '0',
      simpleNationalTotalTaxRate: Number(fiscal.aliquotaIss || config.aliquotaIssPadrao || 6).toFixed(2), issRate: Number(fiscal.aliquotaIss || config.aliquotaIssPadrao || 0).toFixed(2), issWithheld: args.issWithheld,
      taker: { cnpj, name: client.razaoSocial || client.nomeFantasia, municipalityCode, postalCode: digits(client.cep), street: client.rua, number: client.numero, district: client.bairro, email: client.emailFinanceiro || client.emailPrincipal },
    },
  };
}

export async function issueNfseWithValidatedEngine(payload: Record<string, unknown>, options?: { beforeExternalPost?: () => void; dryRun?: boolean }) {
  options?.beforeExternalPost?.();
  if (options?.dryRun) return { dryRun: true, payload, result: 'READY_BEFORE_EXTERNAL_POST' };
  return fiscalApi.issueNfse(payload);
}
