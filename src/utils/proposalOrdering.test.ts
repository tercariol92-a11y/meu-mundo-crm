import assert from 'node:assert/strict';
import { Proposta } from '../types';
import { sortProposals } from './proposalOrdering';

const proposal = (id: string, createdAt: string | undefined, value: number, status: Proposta['status'] = 'Rascunho', vendedorId = 'jefferson'): Proposta => ({
  id, createdAt, valor: value, investimentoInicial: value, titulo: id, status, vendedorId, itens: [],
});

const old = proposal('antigo', '2026-08-09T10:00:00-03:00', 100);
const previous = proposal('anterior', '2026-08-10T10:00:00-03:00', 300, 'Enviado', 'renata');
const newest = proposal('novo', '2026-08-11T10:50:00-03:00', 200, 'Enviado');
const legacy = { ...proposal('legado', undefined, 50), dataCriacao: '2026-08-08T08:00:00-03:00' } as Proposta;
const missingDate = proposal('sem-data', undefined, 25);
const all = [old, newest, missingDate, previous, legacy];

assert.deepEqual(sortProposals(all).map(item => item.id), ['novo', 'anterior', 'antigo', 'legado', 'sem-data']);
assert.deepEqual(sortProposals(all, 'antigos').map(item => item.id), ['legado', 'antigo', 'anterior', 'novo', 'sem-data']);
assert.deepEqual(sortProposals(all, 'maior_valor').map(item => item.id), ['anterior', 'novo', 'antigo', 'legado', 'sem-data']);
assert.deepEqual(sortProposals(all.filter(item => item.vendedorId === 'jefferson')).map(item => item.id), ['novo', 'antigo', 'legado', 'sem-data']);
assert.deepEqual(sortProposals(all.filter(item => item.status === 'Enviado')).map(item => item.id), ['novo', 'anterior']);
const editedOld = { ...old, updatedAt: '2026-08-11T11:30:00-03:00', titulo: 'antigo editado' };
assert.deepEqual(sortProposals([editedOld, newest, previous]).map(item => item.id), ['novo', 'anterior', 'antigo']);

console.log(JSON.stringify({ newestFirst: 'PASS', reloadOrder: 'PASS', sellerFilter: 'PASS', statusFilter: 'PASS', oldEditStable: 'PASS', legacyFallback: 'PASS' }, null, 2));
