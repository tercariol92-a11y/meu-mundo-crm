import forge from 'node-forge';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TRUST_BUNDLE = resolve(process.cwd(), 'server/fiscal/certificates/icp-brasil/2026-07-13/icp-brasil-bundle.pem');

function loadOfficialCertificates() {
  const text = readFileSync(TRUST_BUNDLE, 'utf8');
  return (text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || []).flatMap(pem => {
    try { return [forge.pki.certificateFromPem(pem)]; } catch { return []; }
  });
}

export function validateIcpBrasilChain(leaf: forge.pki.Certificate, suppliedChain: forge.pki.Certificate[]) {
  const official = loadOfficialCertificates();
  const same = (a: forge.pki.Certificate, b: forge.pki.Certificate) => a.serialNumber === b.serialNumber && a.subject.hash === b.subject.hash;
  const candidates = [...suppliedChain.filter(cert => !same(cert, leaf)), ...official.filter(cert => !same(cert, leaf))];
  const ordered: forge.pki.Certificate[] = [leaf];
  let current = leaf;
  for (let depth = 0; depth < 12 && current.issuer.hash !== current.subject.hash; depth += 1) {
    const issuer = candidates.find(cert => cert.subject.hash === current.issuer.hash && cert.verify(current));
    if (!issuer) break;
    ordered.push(issuer); current = issuer;
  }
  const root = ordered.at(-1)!;
  const rootOfficial = official.some(cert => same(cert, root));
  let valid = false; let error: string | null = null;
  try {
    if (!rootOfficial || root.subject.hash !== root.issuer.hash) throw new Error('Cadeia não alcançou uma raiz oficial autoassinada da ICP-Brasil.');
    forge.pki.verifyCertificateChain(forge.pki.createCaStore([forge.pki.certificateToPem(root)]), ordered.slice(0, -1));
    valid = true;
  } catch (cause) { error = cause instanceof Error ? cause.message : 'Falha na construção da cadeia.'; }
  const cn = (cert: forge.pki.Certificate) => String(cert.subject.getField('CN')?.value || cert.subject.getField('O')?.value || 'Autoridade não identificada');
  return { valid, error, intermediates: ordered.slice(1, -1).map(cn), rootAuthority: rootOfficial ? cn(root) : null, chainLength: ordered.length, officialTrustStoreCertificates: official.length };
}
