import test from 'node:test';
import assert from 'node:assert/strict';
import { extractNfsePostContract } from '../phase2/openApiDiscovery';

const restricted = 'https://sefin.producaorestrita.nfse.gov.br';

test('resolves the official POST /nfse request schema through nested OpenAPI refs', () => {
  const spec = {
    openapi: '3.0.1',
    paths: {
      '/decisao-judicial/nfse': {
        post: { requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { xmlGZipB64: { type: 'string' } } } } } } },
      },
      '/nfse': {
        post: { requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GerarNfseRequest' } } } } },
      },
    },
    components: { schemas: {
      GerarNfseRequest: { allOf: [{ $ref: '#/components/schemas/DpsEnvelope' }] },
      DpsEnvelope: { type: 'object', required: ['dpsXmlGZipB64'], properties: { dpsXmlGZipB64: { type: 'string', format: 'byte' } } },
    } },
  };
  const contract = extractNfsePostContract(spec, restricted);
  assert.equal(contract?.endpoint, `${restricted}/API/SefinNacional/nfse`);
  assert.equal(contract?.method, 'POST');
  assert.equal(contract?.contentType, 'application/json');
  assert.deepEqual(contract?.requiredProperties, ['dpsXmlGZipB64']);
  assert.deepEqual(contract?.properties.dpsXmlGZipB64, { type: 'string', format: 'byte', examplePresent: false });
});

test('supports Swagger 2 body definitions without weakening the restricted host', () => {
  const spec = {
    swagger: '2.0', basePath: '/SefinNacional', consumes: ['application/json'],
    paths: { '/nfse': { post: { parameters: [{ in: 'body', schema: { $ref: '#/definitions/DpsRequest' } }] } } },
    definitions: { DpsRequest: { type: 'object', required: ['dpsXmlGZipB64'], properties: { dpsXmlGZipB64: { type: 'string' } } } },
  };
  const contract = extractNfsePostContract(spec, restricted);
  assert.equal(contract?.endpoint, `${restricted}/SefinNacional/nfse`);
  assert.deepEqual(contract?.payloadProperties, ['dpsXmlGZipB64']);
});

test('resolves the official production endpoint without reusing the restricted base path', () => {
  const contract = extractNfsePostContract({ paths: { '/nfse': { post: { requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['dpsXmlGZipB64'], properties: { dpsXmlGZipB64: { type: 'string' } } } } } } } } } }, 'https://sefin.nfse.gov.br');
  assert.equal(contract?.endpoint, 'https://sefin.nfse.gov.br/SefinNacional/nfse');
  assert.deepEqual(contract?.requiredProperties, ['dpsXmlGZipB64']);
});

test('blocks hosts outside the two official SEFIN environments', () => {
  assert.throws(() => extractNfsePostContract({ paths: {} }, 'https://example.com'));
});
