import { Proposta } from '../types';
import { proposalTotals } from './proposalTotals';

export type ProposalSortOption = 'recentes' | 'antigos' | 'maior_valor' | 'menor_valor';

function timestampMillis(value: unknown): number | null {
  if (!value) return null;
  try {
    if (typeof (value as any)?.toMillis === 'function') return (value as any).toMillis();
    if (typeof (value as any)?.toDate === 'function') return (value as any).toDate().getTime();
    if (typeof (value as any)?.seconds === 'number') return (value as any).seconds * 1000;
    const millis = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
    return Number.isFinite(millis) ? millis : null;
  } catch {
    return null;
  }
}

export function proposalCreatedAtMillis(proposal: Proposta): number | null {
  const legacy = proposal as Proposta & {
    dataCriacao?: unknown;
    criadoEm?: unknown;
    created_at?: unknown;
    dataCadastro?: unknown;
    orcamentoCriadoEm?: unknown;
  };
  const candidates = [
    proposal.createdAt,
    legacy.dataCriacao,
    legacy.criadoEm,
    legacy.created_at,
    legacy.dataCadastro,
    legacy.orcamentoCriadoEm,
  ];
  for (const candidate of candidates) {
    const millis = timestampMillis(candidate);
    if (millis !== null) return millis;
  }
  return null;
}

function compareCreation(left: Proposta, right: Proposta, direction: 'asc' | 'desc') {
  const leftTime = proposalCreatedAtMillis(left);
  const rightTime = proposalCreatedAtMillis(right);
  if (leftTime === null && rightTime === null) return 0;
  if (leftTime === null) return 1;
  if (rightTime === null) return -1;
  return direction === 'desc' ? rightTime - leftTime : leftTime - rightTime;
}

function proposalValue(proposal: Proposta): number {
  const calculated = proposalTotals(proposal).investimentoInicial;
  if ((proposal.itens || []).length > 0) return calculated;
  return Number(proposal.investimentoInicial ?? proposal.valor ?? calculated) || 0;
}

export function sortProposals(proposals: Proposta[], option: ProposalSortOption = 'recentes') {
  return proposals.map((proposal, index) => ({ proposal, index })).sort((left, right) => {
    let result = 0;
    if (option === 'recentes') result = compareCreation(left.proposal, right.proposal, 'desc');
    if (option === 'antigos') result = compareCreation(left.proposal, right.proposal, 'asc');
    if (option === 'maior_valor' || option === 'menor_valor') {
      const leftValue = proposalValue(left.proposal);
      const rightValue = proposalValue(right.proposal);
      result = option === 'maior_valor' ? rightValue - leftValue : leftValue - rightValue;
      if (result === 0) result = compareCreation(left.proposal, right.proposal, 'desc');
    }
    return result || left.index - right.index;
  }).map(item => item.proposal);
}
