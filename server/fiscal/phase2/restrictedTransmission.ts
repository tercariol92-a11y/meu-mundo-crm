import { xmlToGzipBuffer, gzipBufferToBase64 } from '../xml/compression';
import https from 'node:https';

export const RESTRICTED_NFSE_ENDPOINT = 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse';
export const PRODUCTION_NFSE_ENDPOINT = 'https://sefin.nfse.gov.br/SefinNacional/nfse';

export type ConfirmedNfseContract = {
  endpoint: string;
  method: string;
  contentType: string | null;
  payloadProperties: string[];
  requiredProperties: string[];
};

export function prepareRestrictedNfseRequest(contract: ConfirmedNfseContract, signedDpsXml: string) {
  if (process.env.FISCAL_PRODUCTION_ENABLED === 'true') throw new Error('Produção fiscal deve permanecer bloqueada.');
  if (contract.endpoint !== RESTRICTED_NFSE_ENDPOINT) throw new Error('Endpoint de emissão restrita divergente do contrato oficial confirmado.');
  if (contract.method.toUpperCase() !== 'POST') throw new Error('Método divergente do contrato oficial.');
  if (!contract.contentType || !/^application\/json\b/i.test(contract.contentType)) throw new Error('Content-Type divergente do contrato oficial.');
  if (!contract.payloadProperties.includes('dpsXmlGZipB64') || !contract.requiredProperties.includes('dpsXmlGZipB64')) {
    throw new Error('Campo obrigatório dpsXmlGZipB64 ausente no contrato oficial.');
  }
  if (!signedDpsXml.includes('<Signature') && !signedDpsXml.includes(':Signature')) throw new Error('DPS sem assinatura XMLDSig.');
  const dpsXmlGZipB64 = gzipBufferToBase64(xmlToGzipBuffer(signedDpsXml));
  return {
    endpoint: RESTRICTED_NFSE_ENDPOINT,
    method: 'POST' as const,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: { dpsXmlGZipB64 },
    transmissionPerformed: false,
  };
}

export function transmitPreparedRestrictedNfse(
  prepared: ReturnType<typeof prepareRestrictedNfseRequest>,
  credentials: { pfx: Buffer; passphrase: string },
  timeoutMs = 30000,
) {
  if (prepared.endpoint !== RESTRICTED_NFSE_ENDPOINT || prepared.method !== 'POST') throw new Error('Destino restrito inválido.');
  if (process.env.FISCAL_PRODUCTION_ENABLED === 'true') throw new Error('Produção fiscal deve permanecer bloqueada.');
  const body = Buffer.from(JSON.stringify(prepared.body), 'utf8');
  return new Promise<{ statusCode: number; contentType: string; body: Buffer; elapsedMs: number }>((resolve, reject) => {
    const started = Date.now();
    const request = https.request(RESTRICTED_NFSE_ENDPOINT, {
      method: 'POST',
      pfx: credentials.pfx,
      passphrase: credentials.passphrase,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      timeout: timeoutMs,
      headers: { ...prepared.headers, 'Content-Length': String(body.length) },
    }, response => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) request.destroy(new Error('Resposta SEFIN acima do limite seguro.'));
        else chunks.push(Buffer.from(chunk));
      });
      response.on('end', () => resolve({
        statusCode: Number(response.statusCode || 0),
        contentType: String(response.headers['content-type'] || ''),
        body: Buffer.concat(chunks),
        elapsedMs: Date.now() - started,
      }));
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('Timeout na primeira transmissão restrita; resultado desconhecido e sem retentativa automática.'), { code: 'SEFIN_RESTRICTED_TIMEOUT_UNKNOWN' })));
    request.on('error', reject);
    request.end(body);
  });
}

export function prepareNfseRequest(endpoint: string, signedDpsXml: string) {
  const allowed = new Set([RESTRICTED_NFSE_ENDPOINT, PRODUCTION_NFSE_ENDPOINT]);
  if (!allowed.has(endpoint)) throw new Error('Endpoint fiscal fora da lista oficial permitida.');
  if (endpoint === PRODUCTION_NFSE_ENDPOINT && process.env.FISCAL_PRODUCTION_ENABLED !== 'true') throw new Error('Produção fiscal não autorizada pelo ambiente.');
  if (endpoint === RESTRICTED_NFSE_ENDPOINT && process.env.FISCAL_ENVIRONMENT === 'producao') throw new Error('Ambiente real não pode transmitir para Produção Restrita.');
  if (!signedDpsXml.includes('<Signature') && !signedDpsXml.includes(':Signature')) throw new Error('DPS sem assinatura XMLDSig.');
  return {
    endpoint,
    method: 'POST' as const,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: { dpsXmlGZipB64: gzipBufferToBase64(xmlToGzipBuffer(signedDpsXml)) },
    transmissionPerformed: false,
  };
}

export function transmitPreparedNfse(
  prepared: ReturnType<typeof prepareNfseRequest>,
  credentials: { pfx: Buffer; passphrase: string },
  timeoutMs = 30000,
) {
  const allowed = new Set([RESTRICTED_NFSE_ENDPOINT, PRODUCTION_NFSE_ENDPOINT]);
  if (!allowed.has(prepared.endpoint) || prepared.method !== 'POST') throw new Error('Destino fiscal inválido.');
  if (prepared.endpoint === PRODUCTION_NFSE_ENDPOINT && process.env.FISCAL_PRODUCTION_ENABLED !== 'true') throw new Error('Produção fiscal não autorizada pelo ambiente.');
  const body = Buffer.from(JSON.stringify(prepared.body), 'utf8');
  return new Promise<{ statusCode: number; contentType: string; body: Buffer; elapsedMs: number }>((resolve, reject) => {
    const started = Date.now();
    const request = https.request(prepared.endpoint, {
      method: 'POST', pfx: credentials.pfx, passphrase: credentials.passphrase,
      rejectUnauthorized: true, minVersion: 'TLSv1.2', timeout: timeoutMs,
      headers: { ...prepared.headers, 'Content-Length': String(body.length) },
    }, response => {
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > 8 * 1024 * 1024) request.destroy(new Error('Resposta SEFIN acima do limite seguro.')); else chunks.push(Buffer.from(chunk)); });
      response.on('end', () => resolve({ statusCode: Number(response.statusCode || 0), contentType: String(response.headers['content-type'] || ''), body: Buffer.concat(chunks), elapsedMs: Date.now() - started }));
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('Timeout fiscal; resultado desconhecido. Não retransmitir sem consulta.'), { code: 'SEFIN_TIMEOUT_UNKNOWN' })));
    request.on('error', reject); request.end(body);
  });
}
