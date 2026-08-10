import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';

export function verifyXmlSignature(xml: string, certificatePem: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const signatureNode = xpath.select("//*[local-name(.)='Signature']", document)[0] as Node | undefined;
  if (!signatureNode) return false;
  const verifier = new SignedXml({ publicCert: certificatePem });
  verifier.loadSignature(signatureNode);
  return verifier.checkSignature(xml);
}

export function signXmlForLocalTest(xml: string, privateKeyPem: string, certificatePem: string, id: string) {
  if (!/^[A-Za-z][A-Za-z0-9_.:-]{2,100}$/.test(id)) throw new Error('Id XML inválido.');
  const signer = new SignedXml({ privateKey: privateKeyPem, publicCert: certificatePem });
  signer.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  signer.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  signer.addReference({ xpath: `//*[@Id='${id}']`, transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature','http://www.w3.org/TR/2001/REC-xml-c14n-20010315'], digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' });
  // O leiaute nacional assina infDPS, mas exige ds:Signature como filha de DPS,
  // imediatamente após infDPS (TCDPS no XSD oficial).
  signer.computeSignature(xml, { location: { reference: `/*[local-name(.)='DPS']`, action: 'append' } });
  const signedXml = signer.getSignedXml();
  const verified = verifyXmlSignature(signedXml, certificatePem);
  return { signedXml, verified, errors: [] };
}
