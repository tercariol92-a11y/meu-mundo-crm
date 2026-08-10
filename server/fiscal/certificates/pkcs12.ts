import forge from 'node-forge';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { validateIcpBrasilChain } from './icpBrasilTrust';

export type CertificateMetadata = { holder: string; issuer: string; serialNumberMasked: string; validFrom: string; validTo: string; cnpj: string | null; hasPrivateKey: boolean; clientAuthCapable: boolean; cnpjCompatible: boolean; chain: ReturnType<typeof validateIcpBrasilChain> };

function isValidNumericCnpj(value: string) {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const digit = (length: 12 | 13) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const remainder = value.slice(0, length).split('').reduce((sum, item, index) => sum + Number(item) * weights[index], 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(value[12]) && digit(13) === Number(value[13]);
}

function extractIcpBrasilCnpj(certificate: forge.pki.Certificate) {
  const prioritizedValues = certificate.subject.attributes
    .filter(attribute => attribute.type === '2.5.4.5' || attribute.shortName === 'serialNumber' || attribute.shortName === 'CN')
    .map(attribute => String(attribute.value || ''));
  const remainingValues = certificate.subject.attributes.map(attribute => String(attribute.value || ''));
  const subjectAltName: any = (certificate.extensions || []).find((extension: any) => extension.name === 'subjectAltName');
  const alternativeValues = (subjectAltName?.altNames || []).flatMap((entry: any) => [entry.value, entry.oid, entry.otherName?.value])
    .filter((value: unknown) => typeof value === 'string') as string[];
  for (const source of [...prioritizedValues, ...alternativeValues, ...remainingValues]) {
    const candidates = source.match(/\d{14}/g) || [];
    const valid = candidates.find(isValidNumericCnpj);
    if (valid) return valid;
  }
  return null;
}

export function parsePkcs12(buffer: Buffer, password: string, expectedCnpj?: string) {
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error('Certificado vazio ou acima do limite de 5 MB.');
  let p12: forge.pkcs12.Pkcs12Pfx;
  try { p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(buffer.toString('binary')), false, password); }
  catch { throw Object.assign(new Error('Senha incorreta ou arquivo PKCS#12 inválido.'), { code: 'INVALID_PKCS12' }); }
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags = [ ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []), ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []) ];
  const certificate = certBags[0]?.cert;
  const privateKey = keyBags[0]?.key;
  if (!certificate) throw new Error('Certificado X.509 ausente no PKCS#12.');
  if (!privateKey) throw Object.assign(new Error('Chave privada ausente no certificado A1.'), { code: 'PRIVATE_KEY_MISSING' });
  if (certificate.validity.notAfter.getTime() <= Date.now()) throw Object.assign(new Error('Certificado digital vencido.'), { code: 'CERTIFICATE_EXPIRED' });
  const subject = certificate.subject.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
  const issuer = certificate.issuer.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
  const cnpj = extractIcpBrasilCnpj(certificate);
  const expected = expectedCnpj?.replace(/[.\/-]/g, '').toUpperCase();
  const cnpjCompatible = !expected || Boolean(cnpj && cnpj === expected);
  if (!cnpjCompatible) throw Object.assign(new Error('CNPJ do certificado divergente da empresa.'), { code: 'CERTIFICATE_CNPJ_MISMATCH' });
  const extensions = certificate.extensions || [];
  const keyUsage: any = extensions.find((ext: any) => ext.name === 'keyUsage');
  const signingCapable = !keyUsage || Boolean(keyUsage.digitalSignature || keyUsage.nonRepudiation);
  if (!signingCapable) throw Object.assign(new Error('Certificado sem uso de chave para assinatura digital.'), { code: 'DIGITAL_SIGNATURE_USAGE_MISSING' });
  const extKeyUsage: any = extensions.find((ext: any) => ext.name === 'extKeyUsage');
  const clientAuthCapable = !extKeyUsage || Boolean(extKeyUsage.clientAuth || extKeyUsage['1.3.6.1.5.5.7.3.2']);
  if (!clientAuthCapable) throw Object.assign(new Error('Certificado sem uso para autenticação do cliente.'), { code: 'CLIENT_AUTH_MISSING' });
  const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
  const certificatePem = forge.pki.certificateToPem(certificate);
  const chainPem = certBags.filter(b => b.cert).map(b => forge.pki.certificateToPem(b.cert!)).join('\n');
  const probe = Buffer.from('nfse-fiscal-key-pair-check');
  const privateObj = createPrivateKey(privateKeyPem); const publicObj = createPublicKey(certificatePem);
  if (privateObj.asymmetricKeyType !== publicObj.asymmetricKeyType) throw new Error('Chave privada não corresponde ao certificado.');
  const chain = validateIcpBrasilChain(certificate, certBags.flatMap(bag => bag.cert ? [bag.cert] : []));
  if (!chain.valid) throw Object.assign(new Error(`Cadeia ICP-Brasil inválida: ${chain.error}`), { code: 'ICP_BRASIL_CHAIN_INVALID' });
  const holder = String(certificate.subject.getField('CN')?.value || certificate.subject.getField('O')?.value || subject);
  const serial = certificate.serialNumber.toUpperCase();
  const serialNumberMasked = serial.length > 8 ? `${serial.slice(0, 4)}…${serial.slice(-4)}` : `${serial.slice(0, 2)}…${serial.slice(-2)}`;
  const metadata: CertificateMetadata = { holder, issuer, serialNumberMasked, validFrom: certificate.validity.notBefore.toISOString(), validTo: certificate.validity.notAfter.toISOString(), cnpj, hasPrivateKey: true, clientAuthCapable, cnpjCompatible, chain };
  return { metadata, privateKeyPem, certificatePem, chainPem, pfx: buffer, passphrase: password, probe };
}
