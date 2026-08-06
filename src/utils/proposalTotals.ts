import type { ItemProposta, Proposta } from '../types';

export type ProposalItemType = 'produto' | 'servico' | 'recorrencia';
export type ProposalPeriodicity = 'unica' | 'mensal' | 'anual';

const monthlyTerms = /\b(mensal|mensalidade|licen[cç]a mensal|sistema mensal)\b/i;
const annualTerms = /\b(anual|anuidade|licen[cç]a anual)\b/i;
const serviceTerms = /\b(instala[cç][aã]o|configura[cç][aã]o|implanta[cç][aã]o|treinamento|servi[cç]o|m[aã]o de obra|suporte)\b/i;
const productTerms = /\b(catraca|leitor|facial|equipamento|acess[oó]rio|rel[oó]gio|controlador|pedestal|cabo|fonte)\b/i;

export function inferProposalItemClassification(item: Partial<ItemProposta>) {
  if (item.tipoItem && item.periodicidade) {
    return { tipoItem: item.tipoItem, periodicidade: item.periodicidade, migrationNeedsReview: Boolean(item.migrationNeedsReview) };
  }
  const text = `${item.nome || ''} ${item.descricao || ''}`.trim();
  if (annualTerms.test(text)) return { tipoItem: 'recorrencia' as const, periodicidade: 'anual' as const, migrationNeedsReview: false };
  if (monthlyTerms.test(text)) return { tipoItem: 'recorrencia' as const, periodicidade: 'mensal' as const, migrationNeedsReview: false };
  if (serviceTerms.test(text)) return { tipoItem: 'servico' as const, periodicidade: 'unica' as const, migrationNeedsReview: false };
  if (productTerms.test(text) || item.produtoId || item.productId) return { tipoItem: 'produto' as const, periodicidade: 'unica' as const, migrationNeedsReview: false };
  return { tipoItem: 'produto' as const, periodicidade: 'unica' as const, migrationNeedsReview: true };
}

export function normalizeProposalItem(item: ItemProposta): ItemProposta {
  const classification = inferProposalItemClassification(item);
  let tipoItem = item.tipoItem || classification.tipoItem;
  let periodicidade = item.periodicidade || classification.periodicidade;
  if (tipoItem === 'produto') periodicidade = 'unica';
  if (tipoItem === 'recorrencia' && periodicidade === 'unica') periodicidade = 'mensal';
  const quantidade = Math.max(1, Number(item.quantidade) || 1);
  const valorUnitario = Math.max(0, Number(item.valorUnitario) || 0);
  const subtotal = quantidade * valorUnitario;
  const desconto = Math.min(subtotal, Math.max(0, Number(item.desconto) || 0));
  const valorFinal = Math.max(0, subtotal - desconto);
  return {
    ...item,
    quantidade,
    valorUnitario,
    subtotal,
    total: valorFinal,
    desconto,
    valorFinal,
    tipoItem,
    periodicidade,
    migrationNeedsReview: item.migrationNeedsReview ?? classification.migrationNeedsReview,
  };
}

export function calculateProposalTotals(items: ItemProposta[]) {
  const normalizedItems = (items || []).map(normalizeProposalItem);
  const sum = (predicate: (item: ItemProposta) => boolean) => normalizedItems
    .filter(predicate)
    .reduce((total, item) => total + (item.valorFinal ?? item.total ?? 0), 0);
  const totalProdutos = sum(item => item.tipoItem === 'produto');
  const totalServicos = sum(item => item.tipoItem === 'servico' && item.periodicidade === 'unica');
  const totalMensal = sum(item => item.periodicidade === 'mensal');
  const totalAnual = sum(item => item.periodicidade === 'anual');
  return {
    items: normalizedItems,
    totalProdutos,
    totalServicos,
    totalMensal,
    totalAnual,
    investimentoInicial: totalProdutos + totalServicos,
    hasMonthly: totalMensal > 0,
    hasAnnual: totalAnual > 0,
    needsManualReview: normalizedItems.some(item => item.migrationNeedsReview),
  };
}

export function proposalTotals(proposal: Pick<Proposta, 'itens' | 'valor'>) {
  return calculateProposalTotals(proposal.itens || []);
}
