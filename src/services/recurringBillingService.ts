import { db } from '../firebase';
import { Cliente, ContratoRecorrente, FaturamentoRecorrente } from '../types';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from './resilientFirestoreClient';

const COLLECTION = 'faturamentos_recorrentes';

const digits = (value?: string) => String(value || '').replace(/\D/g, '');
const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');
const periodStep: Record<ContratoRecorrente['tipoCobranca'], number> = { Mensal: 1, Bimestral: 2, Trimestral: 3, Semestral: 6, Anual: 12 };

export function recurringBillingLogicalKey(companyId: string, contractId: string, competence: string, installment = 1) {
  return `${safeId(companyId)}__${safeId(contractId)}__${competence}__${installment}`;
}

export function contractIsDue(contract: ContratoRecorrente, competence: string) {
  if (!contract.emitirNfseRecorrente || !['Ativo', 'Vencendo'].includes(contract.status)) return false;
  const competenceDate = new Date(`${competence}-01T12:00:00`);
  const start = new Date(`${contract.dataInicio.slice(0, 7)}-01T12:00:00`);
  if (competenceDate < start) return false;
  if (contract.dataTermino && competence > contract.dataTermino.slice(0, 7)) return false;
  const months = (competenceDate.getFullYear() - start.getFullYear()) * 12 + competenceDate.getMonth() - start.getMonth();
  return months % periodStep[contract.tipoCobranca] === 0;
}

export function validateRecurringTaker(client?: Cliente) {
  const missing: string[] = [];
  if (!client) return ['cliente'];
  if (!client.razaoSocial && !client.nomeFantasia) missing.push('razão social');
  const taxId = digits(client.cnpj || client.pagadorCpfCnpj);
  if (![11, 14].includes(taxId.length)) missing.push('CPF/CNPJ');
  if (!client.cep) missing.push('CEP');
  if (!client.rua) missing.push('logradouro');
  if (!client.numero) missing.push('número');
  if (!client.bairro) missing.push('bairro');
  if (!client.cidade) missing.push('município');
  if (!client.estado) missing.push('UF');
  if (!(client as any).codigoIbge) missing.push('código IBGE');
  if (!client.emailFinanceiro && !client.emailPrincipal) missing.push('e-mail fiscal');
  return missing;
}

export function buildRecurringBilling(companyId: string, contract: ContratoRecorrente, client: Cliente | undefined, competence: string, environment: 'producao' | 'producao_restrita'): FaturamentoRecorrente {
  const missingFields = validateRecurringTaker(client);
  const fiscal = contract.fiscal;
  if (!fiscal?.descricaoServico) missingFields.push('descrição fiscal');
  if (!fiscal?.codigoServicoMunicipal) missingFields.push('código de serviço municipal');
  if (!fiscal?.itemLc116) missingFields.push('item LC 116');
  if (!fiscal?.municipioPrestacao) missingFields.push('município de prestação');
  if (!Number(fiscal?.valorNfse || contract.valorMensal)) missingFields.push('valor da NFS-e');
  const [year, month] = competence.split('-').map(Number);
  const maxDay = new Date(year, month, 0).getDate();
  const date = (day: number) => `${competence}-${String(Math.min(Math.max(day, 1), maxDay)).padStart(2, '0')}`;
  const logicalKey = recurringBillingLogicalKey(companyId, contract.id, competence);
  return {
    id: logicalKey, logicalKey, companyId, contractId: contract.id, contractNumber: contract.numeroContrato,
    clientId: contract.clienteId, clientName: contract.clienteNome, competence, installment: 1,
    description: fiscal?.descricaoServico || contract.descricaoServico,
    expectedAmount: Number(fiscal?.valorNfse || contract.valorMensal), billingDate: date(contract.diaFaturamento), dueDate: date(contract.diaVencimento),
    status: missingFields.length ? 'PENDENCIA_CADASTRAL' : 'PRONTO_PARA_EMITIR', missingFields, environment,
    takerSnapshot: client ? { razaoSocial: client.razaoSocial || client.nomeFantasia, cpfCnpj: digits(client.cnpj || client.pagadorCpfCnpj), inscricaoMunicipal: client.inscricaoMunicipal || '', endereco: client.rua, numero: client.numero, bairro: client.bairro, cep: digits(client.cep), municipio: client.cidade, uf: client.estado, codigoIbge: (client as any).codigoIbge || '', emailFiscal: client.emailFinanceiro || client.emailPrincipal } : {},
    fiscalSnapshot: fiscal || {}, generateBoleto: fiscal?.gerarBoleto === true,
  };
}

export async function generateRecurringBillings(companyId: string, contracts: ContratoRecorrente[], clients: Cliente[], competence: string, environment: 'producao' | 'producao_restrita') {
  const generated: FaturamentoRecorrente[] = [];
  for (const contract of contracts.filter(item => contractIsDue(item, competence))) {
    const candidate = buildRecurringBilling(companyId, contract, clients.find(client => client.id === contract.clienteId), competence, environment);
    const ref = doc(db, COLLECTION, candidate.id);
    const existing = await getDoc(ref);
    if (!existing.exists()) await setDoc(ref, { ...candidate, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    generated.push(existing.exists() ? ({ id: existing.id, ...existing.data() } as FaturamentoRecorrente) : candidate);
  }
  return generated;
}

export async function listRecurringBillings(companyId: string) {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map(item => ({ id: item.id, ...item.data() } as FaturamentoRecorrente)).filter(item => item.companyId === companyId);
}

export async function updateRecurringBilling(id: string, data: Partial<FaturamentoRecorrente>) {
  await updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
}
