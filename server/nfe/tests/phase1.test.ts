import assert from 'node:assert/strict';
import { getNfeEnvironment, assertNfeEndpointAllowed, PR_ENDPOINTS } from '../config/environment';
import { validateCommonSaleDraft } from '../domain/saleDraft';
import { COMPANY_CRT, resolveCfop, validateProductTaxProfile } from '../domain/taxRules';

process.env.NFE_ENVIRONMENT = 'homologacao';
process.env.NFE_PRODUCTION_ENABLED = 'false';

const environment = getNfeEnvironment();
assert.equal(environment.environment, 'homologacao');
assert.equal(environment.model, '55');
assert.doesNotThrow(() => assertNfeEndpointAllowed(PR_ENDPOINTS.homologacao.authorization, 'homologacao'));
assert.throws(() => assertNfeEndpointAllowed(PR_ENDPOINTS.producao.authorization, 'homologacao'));

const errors = validateCommonSaleDraft({
  companyId: 'company-test',
  customerId: 'customer-test',
  environment: 'homologacao',
  model: '55',
  purpose: 'normal',
  operation: 'venda_comum',
  freight: 0,
  status: 'RASCUNHO',
  idempotencyKey: 'company-test:homologacao:1:1',
  items: [{
    productId: 'product-test',
    description: 'PRODUTO PARA TESTE EM HOMOLOGAÇÃO',
    quantity: 1,
    unit: 'UN',
    unitValue: 10,
    ncm: '84716052',
    cfop: '5102',
    origin: '0',
    cstCsosn: '102',
    pisCst: '07',
    cofinsCst: '07',
  }],
});
assert.deepEqual(errors, []);

process.env.NFE_ENVIRONMENT = 'producao';
assert.throws(() => getNfeEnvironment(), /bloqueada/);

assert.equal(COMPANY_CRT, '1');
assert.equal(resolveCfop('venda_comum', 'PR'), '5102');
assert.equal(resolveCfop('venda_comum', 'SC'), '6102');
assert.equal(resolveCfop('retorno_conserto', 'PR'), '5916');
assert.equal(resolveCfop('retorno_conserto', 'SP'), '6916');
assert.deepEqual(validateProductTaxProfile({ csosn: '102', ncm: '84716052', hasIcmsSt: false }), []);
assert.deepEqual(validateProductTaxProfile({ csosn: '102', ncm: '85437099', hasIcmsSt: false }), []);
assert.deepEqual(validateProductTaxProfile({ csosn: '202', ncm: '84716052', cest: '2101200', hasIcmsSt: true }), []);
assert.match(validateProductTaxProfile({ csosn: '202', ncm: '84716052', hasIcmsSt: true }).join(' '), /CEST/);

const shopCwbDraftErrors = validateCommonSaleDraft({
  companyId: '56096046000100',
  customerId: 'shop-cwb-48088816000145',
  environment: 'homologacao',
  model: '55',
  purpose: 'normal',
  operation: 'venda_comum',
  freight: 0,
  status: 'RASCUNHO',
  idempotencyKey: '56096046000100:homologacao:shop-cwb:ncm-85437099',
  items: [{
    productId: 'relogio-ponto-test',
    description: 'RELÓGIO DE PONTO — TESTE LOCAL SEM TRANSMISSÃO',
    quantity: 1,
    unit: 'UN',
    unitValue: 10,
    ncm: '85437099',
    cfop: '5102',
    origin: '0',
    cstCsosn: '102',
    pisCst: '07',
    cofinsCst: '07',
  }],
});
assert.deepEqual(shopCwbDraftErrors, []);

console.log('NF-e Fase 1: configuração isolada, homologação e bloqueio de produção OK.');
