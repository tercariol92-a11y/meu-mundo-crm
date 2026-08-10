import assert from 'node:assert/strict';
import test from 'node:test';
import forge from 'node-forge';
import { buildCancellationConsultationUrls, buildCancellationEvent, buildCancellationTransmissionBody, CANCELLATION_EVENT_ID_TYPE, CANCELLATION_EVENT_SEQUENCE, interpretOfficialCancellationResponse, parseOfficialCancellationEventXml, prepareCancellationEvent } from '../cancellation/cancellationEvent';
import { validateXmlAgainstXsd } from '../xml/xsdValidator';
import { gzipBufferToBase64, xmlToGzipBuffer } from '../xml/compression';

const accessKey = '41069022256096046000100000000000000326080948071412';

test('builds the official e101101 cancellation request without transmitting it', async () => {
  const built = buildCancellationEvent({
    accessKey,
    authorCnpj: '56096046000100',
    environmentType: '1',
    reasonCode: '2',
    reason: 'Serviço não prestado conforme solicitação do tomador.',
    occurredAt: '2026-08-10T12:00:00-03:00',
  });
  assert.equal(built.id, `PRE${accessKey}${CANCELLATION_EVENT_ID_TYPE}${CANCELLATION_EVENT_SEQUENCE}`);
  assert.match(built.xml, /<tpAmb>1<\/tpAmb>/);
  assert.match(built.xml, /<e101101><xDesc>Cancelamento de NFS-e<\/xDesc><cMotivo>2<\/cMotivo>/);
  assert.doesNotMatch(built.xml, /Signature/);
  const validation = await validateXmlAgainstXsd(built.xml, '2026-07-27', 'pedRegEvento_v1.01.xsd');
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
});

test('rejects unsupported reasons and unsafe input', () => {
  assert.throws(() => buildCancellationEvent({ accessKey, authorCnpj: '56096046000100', environmentType: '1', reasonCode: '3' as never, reason: 'Motivo suficientemente longo.' }), /Código oficial/);
  assert.throws(() => buildCancellationEvent({ accessKey, authorCnpj: '56096046000100', environmentType: '1', reasonCode: '9', reason: 'curto' }), /entre 15 e 255/);
});

test('builds official consultation URLs and only confirms a matching cancellation event', () => {
  const urls = buildCancellationConsultationUrls(accessKey, 'producao');
  assert.equal(urls.allEvents, `https://sefin.nfse.gov.br/SefinNacional/nfse/${accessKey}/eventos`);
  assert.equal(urls.cancellationEvent, `${urls.allEvents}/101101/1`);
  const response = `<?xml version="1.0"?><evento xmlns="http://www.sped.fazenda.gov.br/nfse"><infEvento Id="EVT123"><nSeqEvento>1</nSeqEvento><dhProc>2026-08-10T12:01:00-03:00</dhProc><pedRegEvento><infPedReg><chNFSe>${accessKey}</chNFSe><e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>2</cMotivo><xMotivo>Serviço não prestado.</xMotivo></e101101></infPedReg></pedRegEvento></infEvento></evento>`;
  assert.equal(parseOfficialCancellationEventXml(response, accessKey).confirmed, true);
  assert.equal(parseOfficialCancellationEventXml(response, `9${accessKey.slice(1)}`).confirmed, false);
});

test('validates, signs and revalidates the cancellation event without transmission', async () => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = '01';
  certificate.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  certificate.validity.notAfter = new Date('2027-01-01T00:00:00Z');
  const attributes = [{ name: 'commonName', value: 'Teste local sem validade' }];
  certificate.setSubject(attributes); certificate.setIssuer(attributes);
  certificate.setExtensions([{ name: 'basicConstraints', cA: false }, { name: 'keyUsage', digitalSignature: true }]);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  const prepared = await prepareCancellationEvent({
    accessKey, authorCnpj: '56096046000100', environmentType: '1', reasonCode: '1',
    reason: 'Erro na emissão identificado durante conferência fiscal.',
    occurredAt: '2026-08-10T12:00:00-03:00',
  }, {
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    certificatePem: forge.pki.certificateToPem(certificate),
  }, '2026-07-27');
  assert.equal(prepared.valid, true, JSON.stringify(prepared.errors));
  assert.equal(prepared.signatureVerified, true);
  assert.equal(prepared.xsdValidAfterSignature, true);
  assert.equal(prepared.gzipBase64Ready, true);
  assert.equal(prepared.transmitted, false);
});

test('recognizes the synchronous official cancellation envelope and event identifier', () => {
  const officialEvent = `<?xml version="1.0"?><evento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infEvento Id="EVT123"><verAplic>SEFIN</verAplic><ambGer>2</ambGer><nSeqEvento>001</nSeqEvento><dhProc>2026-08-10T12:01:00-03:00</dhProc><nDFSe>987</nDFSe><pedRegEvento versao="1.01"><infPedReg Id="PRE"><tpAmb>1</tpAmb><verAplic>CRM</verAplic><dhEvento>2026-08-10T12:00:00-03:00</dhEvento><CNPJAutor>56096046000100</CNPJAutor><chNFSe>${accessKey}</chNFSe><e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>2</cMotivo><xMotivo>Serviço não prestado.</xMotivo></e101101></infPedReg></pedRegEvento></infEvento></evento>`;
  const envelope = { data: { eventoXmlGZipB64: gzipBufferToBase64(xmlToGzipBuffer(officialEvent)) } };
  const result = interpretOfficialCancellationResponse({ statusCode: 201, contentType: 'application/json', body: JSON.stringify(envelope) }, accessKey);
  assert.equal(result.accepted, true);
  assert.equal(result.status, 'CANCELADA');
  assert.equal(result.confirmation?.eventId, 'EVT123');
  assert.equal(result.confirmation?.protocol, '987');
});

test('preserves the official rejection code and message from nested JSON', () => {
  const result = interpretOfficialCancellationResponse({ statusCode: 400, contentType: 'application/json', body: JSON.stringify({ erros: [{ codigo: 'E9999', descricao: 'Evento rejeitado pela regra oficial.' }] }) }, accessKey);
  assert.equal(result.accepted, false);
  assert.equal(result.status, 'REJEITADA');
  assert.equal(result.responseCode, 'E9999');
  assert.equal(result.responseMessage, 'Evento rejeitado pela regra oficial.');
});

test('uses the official JSON field for registering a cancellation event', () => {
  const encodedEvent = 'H4sIAAAAAAAA';
  const payload = JSON.parse(buildCancellationTransmissionBody(encodedEvent).toString('utf8'));
  assert.deepEqual(payload, { pedidoRegistroEventoXmlGZipB64: encodedEvent });
  assert.equal('eventoXmlGZipB64' in payload, false);
});
