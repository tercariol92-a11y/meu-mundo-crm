import assert from 'node:assert/strict';
import { resolveSimpleNationalSituation } from '../../../src/services/fiscalSimpleNational';

assert.throws(
  () => resolveSimpleNationalSituation({}, '2026-08-08'),
  /Confirme a situação oficial no Simples Nacional para a competência 2026-08/,
);

assert.throws(
  () => resolveSimpleNationalSituation({ situacaoSimplesNacional: '3', situacaoSimplesNacionalCompetencia: '2026-07' }, '2026-08-08'),
  /a DPS usa 2026-08/,
);

for (const situation of ['1', '2', '3'] as const) {
  assert.equal(
    resolveSimpleNationalSituation({ situacaoSimplesNacional: situation, situacaoSimplesNacionalCompetencia: '2026-08' }, '2026-08-08'),
    situation,
  );
}

console.log('E0160 validation tests passed: monthly official status is required; no value is inferred.');
