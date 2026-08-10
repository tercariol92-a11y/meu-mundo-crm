import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseAuthorizedNfseXml } from '../postAuthorization/authorizedNfse';

async function run() {
  const xml = await readFile('fiscal-private/56096046000100/phase3/sixth-restricted/nfse-autorizada.xml', 'utf8');
  const parsed = parseAuthorizedNfseXml(xml);
  assert.equal(parsed.nfseNumber, '1');
  assert.equal(parsed.competence, '2026-08-08');
  assert.equal(parsed.municipalityCode, '4106902');
  assert.equal(parsed.serviceAmount, 1);
  assert.equal(parsed.statusCode, '100');
  console.log('Post-authorization NFS-e parsing: OK');
}
void run();
