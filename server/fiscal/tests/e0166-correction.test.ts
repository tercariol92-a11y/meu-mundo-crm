import assert from 'node:assert/strict';
import { buildMinimalCuritibaDps } from '../xml/dpsBuilder';

const base = {
  cnpj: '56096046000100', series: '1', number: '900001',
  issuedAt: '2026-08-08T18:30:00-03:00', competenceDate: '2026-08-08',
  nationalServiceCode: '010701', nbs: '120012000',
  serviceDescription: 'TESTE PRODUCAO RESTRITA - SEM VALIDADE FISCAL', serviceValue: '1.00',
  simpleNationalOption: '3' as const, specialTaxRegime: '0',
  emitterType: '1' as const, cncAllowsMunicipalRegistration: false,
};

assert.match(buildMinimalCuritibaDps(base).xml, /<regApTribSN>1<\/regApTribSN>/);
const corrected = buildMinimalCuritibaDps({ ...base, simpleNationalTaxRegime: '1' });
assert.match(corrected.xml, /<opSimpNac>3<\/opSimpNac><regApTribSN>1<\/regApTribSN><regEspTrib>0<\/regEspTrib>/);
assert.doesNotMatch(corrected.xml, /<indTotTrib>/);
assert.match(corrected.xml, /<pTotTribSN>6\.00<\/pTotTribSN>/);
assert.doesNotMatch(corrected.xml, /<(?:\w+:)?IM(?:\s|>)/);
assert.doesNotMatch(corrected.xml, /<(?:\w+:)?xNome(?:\s|>)/);
console.log('E0166 correction test passed.');
