import assert from 'node:assert/strict';
import { calculateSatisfactionRanking } from './satisfaction-ranking.js';

const reviews = (nome: string, notas: number[]) => notas.map(nota => ({ nota, atendente: nome }));

const scenario1 = calculateSatisfactionRanking([
  ...reviews('A', [5]),
  ...reviews('B', [...Array(12).fill(5), ...Array(3).fill(4)]),
], 'atendente', [{ nome: 'A', total: 1 }, { nome: 'B', total: 20 }]);
assert.equal(scenario1[0].nome, 'B');
assert.equal(scenario1.find(item => item.nome === 'A')?.status, 'EM_QUALIFICACAO');

const scenario2 = calculateSatisfactionRanking([
  ...reviews('A', [...Array(8).fill(5), ...Array(2).fill(4)]),
  ...reviews('B', [...Array(24).fill(5), ...Array(6).fill(4)]),
], 'atendente', [{ nome: 'A', total: 10 }, { nome: 'B', total: 40 }]);
assert.equal(scenario2[0].nome, 'B');

const scenario3 = calculateSatisfactionRanking([
  ...reviews('A', [...Array(16).fill(5), ...Array(4).fill(4)]),
  ...reviews('B', [...Array(15).fill(5), ...Array(2).fill(4), ...Array(3).fill(2)]),
], 'atendente', [{ nome: 'A', total: 30 }, { nome: 'B', total: 30 }]);
assert.equal(scenario3[0].nome, 'A');

const scenario4 = calculateSatisfactionRanking([
  ...reviews('A', [5, 5]), ...reviews('B', [4, 5, 5]),
], 'atendente');
assert.equal(scenario4.some(item => item.elegivelRanking), false);

const coverageScenario = calculateSatisfactionRanking(
  reviews('A', Array(10).fill(5)),
  'atendente',
  [{ nome: 'A', total: 50 }],
);
assert.equal(coverageScenario[0].percentualCobertura, 20);
assert.equal(coverageScenario[0].avaliacoesNecessarias, 26);
assert.equal(coverageScenario[0].faltamAvaliacoes, 16);
assert.equal(coverageScenario[0].elegivelRanking, false);

const noReviewScenario = calculateSatisfactionRanking([], 'atendente', [{ nome: 'Sem avaliação', total: 12 }]);
assert.equal(noReviewScenario[0].totalAvaliacoes, 0);
assert.equal(noReviewScenario[0].totalAtendimentos, 12);
assert.equal(noReviewScenario[0].faltamAvaliacoes, 10);

const channelScenario = calculateSatisfactionRanking(
  reviews('Técnico', Array(10).fill(5)),
  'atendente',
  [
    { nome: 'Técnico', total: 7, atendimentosWhatsapp: 7 },
    { nome: 'Técnico', total: 5, chamadosExternos: 5 },
  ],
);
assert.equal(channelScenario[0].atendimentosWhatsapp, 7);
assert.equal(channelScenario[0].chamadosExternos, 5);
assert.equal(channelScenario[0].totalAtendimentos, 12);

const crossSourceIdentityScenario = calculateSatisfactionRanking(
  Array.from({ length: 6 }, () => ({ nota: 5, atendenteId: 'usuario-uid', atendente: 'Marcus Mundo Tech' })),
  'atendente',
  [
    { id: 'tecnico-documento', nome: 'Marcus Mundo Tech', total: 8, atendimentosWhatsapp: 8 },
    { id: 'usuario-uid', nome: 'Marcus Mundo Tech', total: 4, atendimentosWhatsapp: 4 },
  ],
);
assert.equal(crossSourceIdentityScenario.length, 1);
assert.equal(crossSourceIdentityScenario[0].totalAtendimentos, 12);
assert.equal(crossSourceIdentityScenario[0].atendimentosWhatsapp, 12);
assert.equal(crossSourceIdentityScenario[0].totalAvaliacoes, 6);

console.log('Satisfaction ranking tests: OK');
