import { db } from '../firebase';
import { Cliente, ConfiguracaoFiscal, ContratoRecorrente, FaturamentoRecorrente } from '../types';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from './resilientFirestoreClient';
import { validateNfseDraftData } from './nfseIssuanceService';

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

export function buildRecurringBilling(companyId: string, contract: ContratoRecorrente, client: Cliente | undefined, competence: string, environment: 'producao' | 'producao_restrita', config?: ConfiguracaoFiscal | null): FaturamentoRecorrente {
  const fiscal = contract.fiscal;
  const [year, month] = competence.split('-').map(Number);
  const maxDay = new Date(year, month, 0).getDate();
  const date = (day: number) => `${competence}-${String(Math.min(Math.max(day, 1), maxDay)).padStart(2, '0')}`;
  const logicalKey = recurringBillingLogicalKey(companyId, contract.id, competence);
  const candidate: FaturamentoRecorrente = {
    id: logicalKey, logicalKey, companyId, contractId: contract.id, contractNumber: contract.numeroContrato,
    clientId: contract.clienteId, clientName: contract.clienteNome, competence, installment: 1,
    description: fiscal?.descricaoServico || contract.descricaoServico,
    expectedAmount: Number(fiscal?.valorNfse || contract.valorMensal), billingDate: date(contract.diaFaturamento), dueDate: date(contract.diaVencimento),
    status: 'PENDENCIA_CADASTRAL', missingFields: [], environment,
    takerSnapshot: client ? { razaoSocial: client.razaoSocial || client.nomeFantasia, cpfCnpj: digits(client.cnpj || client.pagadorCpfCnpj), inscricaoMunicipal: client.inscricaoMunicipal || '', endereco: client.rua, numero: client.numero, bairro: client.bairro, cep: digits(client.cep), municipio: client.cidade, uf: client.estado, codigoIbge: client.codigoIbge || '', emailFiscal: client.emailFinanceiro || client.emailPrincipal } : {},
    fiscalSnapshot: fiscal || {}, generateBoleto: fiscal?.gerarBoleto === true,
  };
  const validationIssues = validateNfseDraftData({ client, config, description: candidate.description, amount: candidate.expectedAmount, competence, recurring: candidate, issWithheld: fiscal?.issRetido === true });
  candidate.validationIssues = validationIssues;
  candidate.missingFields = validationIssues.map(issue => issue.label);
  candidate.status = validationIssues.length ? 'PENDENCIA_CADASTRAL' : 'PRONTO_PARA_EMITIR';
  return candidate;
}

export async function generateRecurringBillings(companyId: string, contracts: ContratoRecorrente[], clients: Cliente[], competence: string, environment: 'producao' | 'producao_restrita', config?: ConfiguracaoFiscal | null) {
  const generated: FaturamentoRecorrente[] = [];
  const officialContractIds = new Set(contracts.map(contract => contract.id));
  const currentBillings = (await getDocs(collection(db, COLLECTION))).docs.map(item => ({ id: item.id, ...item.data() } as FaturamentoRecorrente));
  for (const billing of currentBillings.filter(item => item.companyId === companyId && !officialContractIds.has(item.contractId) && ['PENDENTE', 'PENDENCIA_CADASTRAL', 'PRONTO_PARA_EMITIR', 'REJEITADA'].includes(item.status))) {
    await deleteDoc(doc(db, COLLECTION, billing.id));
  }
  for (const contract of contracts.filter(item => contractIsDue(item, competence))) {
    const candidate = buildRecurringBilling(companyId, contract, clients.find(client => client.id === contract.clienteId), competence, environment, config);
    const ref = doc(db, COLLECTION, candidate.id);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, { ...candidate, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      generated.push(candidate);
    } else {
      const current = { id: existing.id, ...existing.data() } as FaturamentoRecorrente;
      if (!['AUTORIZADA', 'CANCELADA', 'EM_PROCESSAMENTO'].includes(current.status)) {
        await setDoc(ref, { ...candidate, createdAt: current.createdAt || serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
        generated.push({ ...current, ...candidate });
      } else generated.push(current);
    }
  }
  return generated;
}

export async function removePendingRecurringBillingsForContract(contractId: string) {
  const snap = await getDocs(collection(db, COLLECTION));
  const removable = snap.docs
    .map(item => ({ id: item.id, ...item.data() } as FaturamentoRecorrente))
    .filter(item => item.contractId === contractId && ['PENDENTE', 'PENDENCIA_CADASTRAL', 'PRONTO_PARA_EMITIR', 'REJEITADA'].includes(item.status));
  for (const billing of removable) await deleteDoc(doc(db, COLLECTION, billing.id));
  return removable.length;
}

export async function listRecurringBillings(companyId: string) {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map(item => ({ id: item.id, ...item.data() } as FaturamentoRecorrente)).filter(item => item.companyId === companyId);
}

export async function updateRecurringBilling(id: string, data: Partial<FaturamentoRecorrente>) {
  await updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
}
