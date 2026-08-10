import https from 'node:https';
import { URL } from 'node:url';

export async function testMtlsConnection(baseUrl: string, credentials: { pfx: Buffer; passphrase: string }, timeoutMs = 15000) {
  const base = new URL(baseUrl);
  const url = new URL(base.hostname === 'sefin.nfse.gov.br' ? '/SefinNacional/docs/index' : '/API/SefinNacional/docs/index', baseUrl);
  const allowedHosts = new Set(['sefin.producaorestrita.nfse.gov.br', 'sefin.nfse.gov.br']);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) throw new Error('Host mTLS fiscal não autorizado.');
  return new Promise<{ dnsResolved: boolean; accepted: boolean; statusCode?: number; elapsedMs: number; tlsProtocol?: string | null; serverCertificate?: { subject: string; issuer: string; validTo: string } }>((resolvePromise, reject) => {
    const started = Date.now();
    const request = https.request(url, { method: 'GET', pfx: credentials.pfx, passphrase: credentials.passphrase, rejectUnauthorized: true, timeout: timeoutMs, minVersion: 'TLSv1.2' }, response => {
      const socket: any = response.socket; const peer = socket.getPeerCertificate?.() || {};
      response.resume(); resolvePromise({ dnsResolved: true, accepted: true, statusCode: response.statusCode, elapsedMs: Date.now() - started, tlsProtocol: socket.getProtocol?.() || null, serverCertificate: { subject: String(peer.subject?.CN || ''), issuer: String(peer.issuer?.CN || ''), validTo: String(peer.valid_to || '') } });
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('Timeout no handshake mTLS.'), { code: 'MTLS_TIMEOUT' })));
    request.on('error', reject); request.end();
  });
}
