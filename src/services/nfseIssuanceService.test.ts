import assert from 'node:assert/strict';
import test from 'node:test';
import { buildValidatedNfseDraft, issueNfseWithValidatedEngine } from './nfseIssuanceService';

const client: any = { id:'c1', razaoSocial:'CLIENTE TESTE', nomeFantasia:'CLIENTE', cnpj:'48088816000145', cep:'80000000', rua:'Rua Teste', numero:'10', bairro:'Centro', cidade:'Curitiba', estado:'PR', codigoIbge:'4106902', emailFinanceiro:'fiscal@example.com' };
const config: any = { cnpj:'56096046000100', razaoSocial:'MUNDO TECH', inscricaoMunicipal:'13448760', codigoIbge:'4106902', codigoServicoMunicipal:'010701', itemListaServico:'14.01', nbs:'120012000', aliquotaIssPadrao:6 };
const billing: any = { id:'empresa__ctr__2026-08__1', contractId:'ctr', competence:'2026-08', fiscalSnapshot:{ codigoServicoMunicipal:'010701', itemLc116:'14.01', nbs:'120012000', aliquotaIss:6, issRetido:false }, generateBoleto:false };

test('manual and recurring issuance share the validated engine payload', async () => {
  const payload = buildValidatedNfseDraft({ client, config, description:'Manutenção mensal', amount:100, competence:'2026-08', issWithheld:false, credentials:{ certificateBase64:'redacted', password:'memory-only' }, recurring:billing });
  assert.equal((payload.dpsData as any).taker.cnpj, '48088816000145');
  assert.equal(payload.recurringBillingId, billing.id);
  assert.equal(payload.generateBoleto, false);
  let boundaryReached = false;
  const result: any = await issueNfseWithValidatedEngine(payload, { dryRun:true, beforeExternalPost:()=>{ boundaryReached=true; } });
  assert.equal(boundaryReached, true);
  assert.equal(result.result, 'READY_BEFORE_EXTERNAL_POST');
});

test('invalid taker is rejected before reaching the fiscal engine', () => {
  assert.throws(() => buildValidatedNfseDraft({ client:{...client,cnpj:'123'}, config, description:'Serviço', amount:100, competence:'2026-08', issWithheld:false, credentials:{} }), /CNPJ/);
});
