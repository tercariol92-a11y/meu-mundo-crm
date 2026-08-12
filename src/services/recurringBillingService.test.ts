import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecurringBilling, contractIsDue, recurringBillingLogicalKey } from './recurringBillingService';

const contract: any = { id: 'ctr9075', clienteId: 'client1', clienteNome: 'AGRICER', numeroContrato: 'CTR-9075', descricaoServico: 'Suporte', valorMensal: 100, dataInicio: '2026-01-01', diaFaturamento: 5, diaVencimento: 15, tipoCobranca: 'Mensal', status: 'Ativo', emitirNfseRecorrente: true, fiscal: { descricaoServico: 'Suporte mensal', codigoServicoMunicipal: '010701', itemLc116: '14.01', aliquotaIss: 6, issRetido: false, municipioPrestacao: 'Curitiba', valorNfse: 100, gerarBoleto: false } };
const client: any = { id: 'client1', razaoSocial: 'AGRICER LTDA', nomeFantasia: 'AGRICER', cnpj: '12345678000199', cep: '80000000', rua: 'Rua Teste', numero: '10', bairro: 'Centro', cidade: 'Curitiba', estado: 'PR', codigoIbge: '4106902', emailFinanceiro: 'fiscal@example.com' };
const config: any = { cnpj:'56096046000100', razaoSocial:'MUNDO TECH', codigoIbge:'4106902', codigoServicoMunicipal:'010701', itemListaServico:'14.01', nbs:'120012000', aliquotaIssPadrao:6 };

test('CTR-9075 generates one ready billing for the competence', () => {
  assert.equal(contractIsDue(contract, '2026-08'), true);
  const billing = buildRecurringBilling('empresa1', contract, client, '2026-08', 'producao', config);
  assert.equal(billing.status, 'PRONTO_PARA_EMITIR');
  assert.equal(billing.logicalKey, recurringBillingLogicalKey('empresa1', 'ctr9075', '2026-08'));
  assert.equal(billing.expectedAmount, 100);
});

test('same company, contract and competence always produce the same id', () => {
  assert.equal(recurringBillingLogicalKey('empresa1', 'ctr9075', '2026-08'), recurringBillingLogicalKey('empresa1', 'ctr9075', '2026-08'));
  assert.notEqual(recurringBillingLogicalKey('empresa1', 'ctr9075', '2026-08'), recurringBillingLogicalKey('empresa1', 'ctr9075', '2026-09'));
});

test('missing taker data blocks fiscal emission without transmitting', () => {
  const billing = buildRecurringBilling('empresa1', contract, { ...client, codigoIbge: '', cidade: 'Município desconhecido', cnpj: '' }, '2026-08', 'producao', config);
  assert.equal(billing.status, 'PENDENCIA_CADASTRAL');
  assert.ok(billing.missingFields.some(item => item.includes('CNPJ')));
  assert.ok(billing.missingFields.some(item => item.includes('IBGE')));
});
