import https from 'node:https';
import { URL } from 'node:url';
import { assertNfeEndpointAllowed, type NfeEnvironment } from '../config/environment';

const SOAP_NS = 'http://www.w3.org/2003/05/soap-envelope';
const SERVICE_NS = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4';

export function buildAuthorizationSoapEnvelope(enviNFeXml: string) {
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="${SOAP_NS}"><soap12:Body><nfeDadosMsg xmlns="${SERVICE_NS}">${enviNFeXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

export async function authorizeNfeBatch(args: {
  environment: NfeEnvironment; endpoint: string; batchXml: string;
  credentials: { pfx: Buffer; passphrase: string }; timeoutMs?: number;
}) {
  if (process.env.NFE_TRANSMISSION_ENABLED !== 'true') {
    throw Object.assign(new Error('Transmissão de NF-e está bloqueada neste ambiente.'), { code: 'NFE_TRANSMISSION_BLOCKED' });
  }
  assertNfeEndpointAllowed(args.endpoint, args.environment);
  if (args.environment === 'producao' && process.env.NFE_PRODUCTION_ENABLED !== 'true') {
    throw Object.assign(new Error('Produção de NF-e está bloqueada.'), { code: 'NFE_PRODUCTION_BLOCKED' });
  }
  const url = new URL(args.endpoint);
  const body = buildAuthorizationSoapEnvelope(args.batchXml);
  return new Promise<{ statusCode: number; contentType: string; body: string }>((resolve, reject) => {
    const request = https.request(url, {
      method: 'POST', pfx: args.credentials.pfx, passphrase: args.credentials.passphrase,
      rejectUnauthorized: true, minVersion: 'TLSv1.2', timeout: args.timeoutMs || 30000,
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', 'Content-Length': Buffer.byteLength(body) },
    }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve({ statusCode: response.statusCode || 0, contentType: String(response.headers['content-type'] || ''), body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('Timeout na autorização NF-e.'), { code: 'NFE_TIMEOUT' })));
    request.on('error', reject);
    request.end(body);
  });
}
