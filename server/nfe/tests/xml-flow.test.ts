import assert from 'node:assert/strict';
import forge from 'node-forge';
import { buildCommonSaleNfeXml, wrapNfeAuthorizationBatch } from '../xml/nfeBuilder';
import { signNfeXml } from '../signatures/xmlDsig';
import { buildAuthorizationSoapEnvelope, authorizeNfeBatch } from '../soap/authorizationClient';
import { parseAuthorizationResponse } from '../soap/responseParser';
import { validateNfeXmlAgainstOfficialXsd } from '../xml/xsdValidator';
import { prepareNfeAuthorization } from '../application/prepareAuthorization';

const keys = forge.pki.rsa.generateKeyPair(2048);
const certificate = forge.pki.createCertificate();
certificate.publicKey = keys.publicKey;
certificate.serialNumber = '01';
certificate.validity.notBefore = new Date(Date.now() - 60_000);
certificate.validity.notAfter = new Date(Date.now() + 86_400_000);
certificate.setSubject([{ name: 'commonName', value: 'TESTE LOCAL NF-E' }]);
certificate.setIssuer([{ name: 'commonName', value: 'TESTE LOCAL NF-E' }]);
certificate.sign(keys.privateKey, forge.md.sha256.create());
const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
const certificatePem = forge.pki.certificateToPem(certificate);

const builtInputIssuer = {
  cnpj: '56096046000100', legalName: 'MUNDO TECH SOLUCOES EM AUTOMACAO LTDA', stateRegistration: '9124880200', crt: '1' as const,
  address: { street: 'RUA TESTE', number: '1', district: 'CENTRO', cityCode: '4106902', city: 'CURITIBA', state: 'PR', zipCode: '80000000' },
};
const builtInputRecipient = {
  cnpj: '48088816000145', legalName: 'SHOP CWB EQUIPAMENTOS E ACESSORIOS LTDA', ieIndicator: '9' as const,
  address: { street: 'RUA TESTE', number: '2', district: 'CENTRO', cityCode: '4106902', city: 'CURITIBA', state: 'PR', zipCode: '80000000' },
};
const builtInputItems = [{ productCode: 'REP-001', description: 'RELOGIO DE PONTO', ncm: '85437099', cfop: '5102', unit: 'UN', quantity: 1, unitValue: 10, csosn: '102' as const, origin: '0', pisCst: '07', cofinsCst: '07' }];

const built = buildCommonSaleNfeXml({
  environment: 'homologacao', series: 1, number: 1, numericCode: '12345678',
  issuedAt: '2026-08-17T12:00:00-03:00', freight: 0, paymentCode: '01', paymentAmount: 10,
  issuer: builtInputIssuer,
  recipient: builtInputRecipient,
  items: builtInputItems,
});
assert.equal(built.accessKey.length, 44);
assert.match(built.xml, /<tpAmb>2<\/tpAmb>/);
assert.match(built.xml, /<NCM>85437099<\/NCM>/);
assert.match(built.xml, /<CFOP>5102<\/CFOP>/);
assert.match(built.xml, /<CSOSN>102<\/CSOSN>/);
assert.match(built.xml, /NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL/);

const signed = signNfeXml(built.xml, privateKeyPem, certificatePem, built.infNFeId);
assert.match(signed, /Signature/);
const batch = wrapNfeAuthorizationBatch(signed, '1');
const soap = buildAuthorizationSoapEnvelope(batch);
assert.match(soap, /application\/soap\+xml|soap12:Envelope/);
assert.match(batch, /<indSinc>1<\/indSinc>/);

async function main() {
  const signedXsd = await validateNfeXmlAgainstOfficialXsd(signed, 'PL_010e_v1.02');
  assert.equal(signedXsd.valid, true, JSON.stringify(signedXsd.errors));

  process.env.NFE_TRANSMISSION_ENABLED = 'false';
  await assert.rejects(() => authorizeNfeBatch({ environment: 'homologacao', endpoint: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4', batchXml: batch, credentials: { pfx: Buffer.from('not-used'), passphrase: 'not-used' } }), /bloqueada/);

  const parsed = parseAuthorizationResponse('<?xml version="1.0"?><retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>2</tpAmb><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo><protNFe><infProt><chNFe>41123456789012345678901234567890123456789012</chNFe><nProt>141260000000001</nProt></infProt></protNFe></retEnviNFe>');
  assert.equal(parsed.authorized, true);
  assert.equal(parsed.protocol, '141260000000001');

  process.env.NFE_ENVIRONMENT = 'homologacao';
  process.env.NFE_PRODUCTION_ENABLED = 'false';
  const prepared = await prepareNfeAuthorization({
    input: {
      environment: 'homologacao', series: 1, number: 2, numericCode: '87654321',
      issuedAt: '2026-08-17T12:00:00-03:00', freight: 0, paymentCode: '01', paymentAmount: 10,
      issuer: builtInputIssuer,
      recipient: builtInputRecipient,
      items: builtInputItems,
    },
    privateKeyPem,
    certificatePem,
    batchId: '2',
  });
  assert.equal(prepared.readyForTransmission, true);
  assert.equal(prepared.transmitted, false);
  assert.equal(prepared.environment, 'homologacao');
  assert.match(prepared.endpoint, /homologacao/);

  console.log('NF-e XML local: XSD oficial PL_010e_v1.02, chave, XML 4.00, assinatura, lote, SOAP, parser e bloqueio de transmissão OK.');
}

void main();
