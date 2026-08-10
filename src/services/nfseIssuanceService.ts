import { Cliente, ConfiguracaoFiscal, FaturamentoRecorrente } from '../types';
import { fiscalApi } from './fiscalApi';

export type SecureA1Session = Record<string, unknown>;
export const fiscalA1SessionRef: { current: SecureA1Session | null } = { current: null };

const digits = (value?: unknown) => String(value || '').replace(/\D/g, '');

export function buildValidatedNfseDraft(args: { client: Cliente; config: ConfiguracaoFiscal; description: string; amount: number; competence: string; issWithheld: boolean; credentials: SecureA1Session; recurring?: FaturamentoRecorrente }) {
  const { client, config, recurring } = args;
  const cnpj = digits(client.cnpj || client.pagadorCpfCnpj);
  if (cnpj.length !== 14) throw new Error('CNPJ do tomador inválido.');
  if (!args.description.trim()) throw new Error('Descrição fiscal obrigatória.');
  if (!(args.amount > 0)) throw new Error('Valor da NFS-e deve ser maior que zero.');
  if (!/^\d{4}-\d{2}/.test(args.competence)) throw new Error('Competência fiscal inválida.');
  const fiscal = (recurring?.fiscalSnapshot || {}) as Record<string, unknown>;
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
      nationalServiceCode: digits(fiscal.codigoServicoMunicipal || config.codigoServicoMunicipal || '010701').slice(0, 6),
      nbs: digits(fiscal.nbs || config.nbs || '120012000'), serviceDescription: args.description.trim(), serviceValue: args.amount.toFixed(2),
      simpleNationalOption: '3', simpleNationalTaxRegime: '1', specialTaxRegime: '0',
      simpleNationalTotalTaxRate: Number(fiscal.aliquotaIss || config.aliquotaIssPadrao || 6).toFixed(2), issWithheld: args.issWithheld,
      taker: { cnpj, name: client.razaoSocial || client.nomeFantasia, municipalityCode: String((client as any).codigoIbge || ''), postalCode: digits(client.cep), street: client.rua, number: client.numero, district: client.bairro, email: client.emailFinanceiro || client.emailPrincipal },
    },
  };
}

export async function issueNfseWithValidatedEngine(payload: Record<string, unknown>, options?: { beforeExternalPost?: () => void; dryRun?: boolean }) {
  options?.beforeExternalPost?.();
  if (options?.dryRun) return { dryRun: true, payload, result: 'READY_BEFORE_EXTERNAL_POST' };
  return fiscalApi.issueNfse(payload);
}
