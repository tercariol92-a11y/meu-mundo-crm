import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipBufferToXml, base64ToGzipBuffer } from '../xml/compression';
import { prepareRestrictedNfseRequest, RESTRICTED_NFSE_ENDPOINT } from '../phase2/restrictedTransmission';

const contract = {
  endpoint: RESTRICTED_NFSE_ENDPOINT,
  method: 'POST',
  contentType: 'application/json',
  payloadProperties: ['dpsXmlGZipB64'],
  requiredProperties: ['dpsXmlGZipB64'],
};
const signed = '<DPS><Signature>TESTE LOCAL</Signature></DPS>';

test('prepares the confirmed JSON envelope and preserves the signed XML through GZip/Base64', () => {
  process.env.FISCAL_PRODUCTION_ENABLED = 'false';
  const request = prepareRestrictedNfseRequest(contract, signed);
  assert.equal(request.transmissionPerformed, false);
  assert.deepEqual(request.headers, { 'Content-Type': 'application/json', Accept: 'application/json' });
  assert.equal(gzipBufferToXml(base64ToGzipBuffer(request.body.dpsXmlGZipB64)), signed);
});

test('blocks production, judicial paths, unsigned XML and unconfirmed payload fields', () => {
  process.env.FISCAL_PRODUCTION_ENABLED = 'true';
  assert.throws(() => prepareRestrictedNfseRequest(contract, signed), /bloqueada/);
  process.env.FISCAL_PRODUCTION_ENABLED = 'false';
  assert.throws(() => prepareRestrictedNfseRequest({ ...contract, endpoint: 'https://sefin.nfse.gov.br/SefinNacional/nfse' }, signed), /divergente/);
  assert.throws(() => prepareRestrictedNfseRequest({ ...contract, endpoint: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/decisao-judicial/nfse' }, signed), /divergente/);
  assert.throws(() => prepareRestrictedNfseRequest(contract, '<DPS/>'), /assinatura/);
  assert.throws(() => prepareRestrictedNfseRequest({ ...contract, requiredProperties: [] }, signed), /dpsXmlGZipB64/);
});
