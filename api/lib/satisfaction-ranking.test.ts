import assert from 'node:assert/strict';
import { calculateSatisfactionRanking } from './satisfaction-ranking.js';

const reviews = (nome: string, notas: number[]) => notas.map(nota => ({ nota, atendente: nome }));

const scenario1 = calculateSatisfactionRanking([
  ...reviews('A', [5]),
  ...reviews('B', [...Array(12).fill(5), ...Array(3).fill(4)]),
], 'atendente');
assert.equal(scenario1[0].nome, 'B');
assert.equal(scenario1.find(item => item.nome === 'A')?.status, 'EM_QUALIFICACAO');

const scenario2 = calculateSatisfactionRanking([
  ...reviews('A', [...Array(8).fill(5), ...Array(2).fill(4)]),
  ...reviews('B', [...Array(24).fill(5), ...Array(6).fill(4)]),
], 'atendente');
assert.equal(scenario2[0].nome, 'B');

const scenario3 = calculateSatisfactionRanking([
  ...reviews('A', [...Array(16).fill(5), ...Array(4).fill(4)]),
  ...reviews('B', [...Array(15).fill(5), ...Array(2).fill(4), ...Array(3).fill(2)]),
], 'atendente');
assert.equal(scenario3[0].nome, 'A');

const scenario4 = calculateSatisfactionRanking([
  ...reviews('A', [5, 5]), ...reviews('B', [4, 5, 5]),
], 'atendente');
assert.equal(scenario4.some(item => item.elegivelRanking), false);

console.log('Satisfaction ranking tests: OK');
