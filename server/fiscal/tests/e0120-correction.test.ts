import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildMinimalCuritibaDps } from '../xml/dpsBuilder';
import { validateXmlAgainstXsd } from '../xml/xsdValidator';
import { signXmlForLocalTest } from '../signatures/xmlDsig';
import { prepareRestrictedNfseRequest, RESTRICTED_NFSE_ENDPOINT } from '../phase2/restrictedTransmission';
import { base64ToGzipBuffer, gzipBufferToXml } from '../xml/compression';

async function main() {
const input = {
  cnpj: '56096046000100',
  municipalRegistration: '13448760',
  companyName: 'MUNDO TECH SOLUCOES EM AUTOMACAO LTDA',
  series: '1',
  number: '2',
  issuedAt: '2026-08-08T14:45:00-03:00',
  competenceDate: '2026-08-08',
  nationalServiceCode: '010701',
  nbs: '120012000',
  serviceDescription: 'TESTE PRODUCAO RESTRITA - SEM VALIDADE FISCAL',
  serviceValue: '1.00',
  simpleNationalOption: '3' as const,
  simpleNationalTaxRegime: '1' as const,
};

const dps = buildMinimalCuritibaDps(input);
assert.equal(dps.xml.includes('<IM>'), false, 'E0120: IM deve ser omitida sem confirmação complementar do CNC');
assert.equal(dps.xml.includes('<xNome>'), false, 'E0121: razão social deve ser omitida quando o prestador é o emitente');
assert.equal(dps.xml.includes('<regApTribSN>1</regApTribSN>'), true, 'Regime de apuração deve acompanhar opSimpNac=3');
const before = await validateXmlAgainstXsd(dps.xml, '2026-07-27');
assert.deepEqual(before.errors, []);

const privateKeyPem = await readFile(process.env.FISCAL_TEST_PRIVATE_KEY!, 'utf8');
const certificatePem = await readFile(process.env.FISCAL_TEST_CERTIFICATE!, 'utf8');
const signed = signXmlForLocalTest(dps.xml, privateKeyPem, certificatePem, dps.id);
assert.equal(signed.verified, true);
const after = await validateXmlAgainstXsd(signed.signedXml, '2026-07-27');
assert.deepEqual(after.errors, []);

process.env.FISCAL_PRODUCTION_ENABLED = 'false';
const prepared = prepareRestrictedNfseRequest({
  endpoint: RESTRICTED_NFSE_ENDPOINT,
  method: 'POST',
  contentType: 'application/json',
  payloadProperties: ['dpsXmlGZipB64'],
  requiredProperties: ['dpsXmlGZipB64'],
}, signed.signedXml);
const roundTrip = gzipBufferToXml(base64ToGzipBuffer(prepared.body.dpsXmlGZipB64));
assert.equal(roundTrip, signed.signedXml);
assert.equal(roundTrip.includes('<IM>'), false);
assert.equal(roundTrip.includes('<xNome>'), false);
assert.equal(prepared.transmissionPerformed, false);

console.log(JSON.stringify({
  municipalRegistrationStored: true,
  municipalRegistrationInDps: false,
  prestadorNameInDps: false,
  xsdBeforeSignature: 'PASS',
  xmlDsig: 'PASS',
  xsdAfterSignature: 'PASS',
  gzipBase64Payload: 'PASS',
  transmissionPerformed: false,
}, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
