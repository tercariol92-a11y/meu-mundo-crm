import assert from 'node:assert/strict';
import { xmlToGzipBuffer, gzipBufferToBase64, base64ToGzipBuffer, gzipBufferToXml } from '../xml/compression';
import { getFiscalEnvironment } from '../config/environment';
import { parsePkcs12 } from '../certificates/pkcs12';
import { validateXmlAgainstXsd } from '../xml/xsdValidator';
import { signXmlForLocalTest, verifyXmlSignature } from '../signatures/xmlDsig';
import { readFile } from 'node:fs/promises';
import { buildMinimalCuritibaDps } from '../xml/dpsBuilder';

async function main() {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><root><value>Curitiba &amp; NFS-e</value></root>';
  assert.equal(gzipBufferToXml(base64ToGzipBuffer(gzipBufferToBase64(xmlToGzipBuffer(xml)))), xml);
  process.env.FISCAL_ENVIRONMENT = 'producao'; process.env.FISCAL_PRODUCTION_ENABLED = 'false';
  assert.throws(() => getFiscalEnvironment(), /bloqueado/);
  process.env.FISCAL_ENVIRONMENT = 'producao_restrita';
  assert.equal(getFiscalEnvironment().environment, 'producao_restrita');
  assert.throws(() => parsePkcs12(Buffer.from('not-pkcs12'), 'wrong'), /PKCS#12 inválido/);
  assert.throws(() => parsePkcs12(Buffer.alloc(5 * 1024 * 1024 + 1), 'x'), /acima do limite/);
  await assert.rejects(() => validateXmlAgainstXsd('<DPS/>', '../escape', '../bad.xsd'), /Versão ou esquema inválido/);
  const invalid = await validateXmlAgainstXsd('<DPS xmlns="urn:wrong"/>', '2026-07-27');
  assert.equal(invalid.valid, false);
  const dpsInput = { cnpj: '12345678000190', municipalRegistration: '13448760', series: '1', number: '1', issuedAt: '2026-08-06T12:00:00-03:00', competenceDate: '2026-08-06', nationalServiceCode: '010101', serviceDescription: 'DPS LOCAL DE TESTE SEM VALIDADE FISCAL', serviceValue: '1.00', simpleNationalOption: '1' as const };
  const dps = buildMinimalCuritibaDps(dpsInput);
  assert.equal(dps.xml.includes('<IM>'), false, 'IM deve ser omitida sem confirmação complementar do CNC');
  const dpsWithCncPermission = buildMinimalCuritibaDps({ ...dpsInput, cncAllowsMunicipalRegistration: true });
  assert.equal(dpsWithCncPermission.xml.includes('<IM>13448760</IM>'), true, 'IM deve ser incluída somente com confirmação do CNC');
  const dpsValidation = await validateXmlAgainstXsd(dps.xml, '2026-07-27');
  assert.deepEqual(dpsValidation.errors, []);
  let signature = 'SKIPPED_NO_TEST_CERTIFICATE';
  if (process.env.FISCAL_TEST_PFX) {
    const parsed = parsePkcs12(await readFile(process.env.FISCAL_TEST_PFX), process.env.FISCAL_TEST_PFX_PASSWORD || '');
    const signed = signXmlForLocalTest(dps.xml, parsed.privateKeyPem, parsed.certificatePem, dps.id);
    assert.equal(signed.verified, true); signature = 'PASS';
    const signedValidation = await validateXmlAgainstXsd(signed.signedXml, '2026-07-27');
    assert.deepEqual(signedValidation.errors, []);
    const tampered = signed.signedXml.replace('<tpAmb>2</tpAmb>', '<tpAmb>1</tpAmb>');
    assert.equal(verifyXmlSignature(tampered, parsed.certificatePem), false); signature = 'PASS_VALID_AND_TAMPER_REJECTED';
  }
  console.log(JSON.stringify({ gzipBase64RoundTrip: 'PASS', productionBlocked: 'PASS', restrictedEnvironment: 'PASS', invalidPkcs12: 'PASS', oversizedCertificate: 'PASS', pathTraversal: 'PASS', invalidNamespace: 'PASS', minimalCuritibaDpsXsd: 'PASS', signature }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
