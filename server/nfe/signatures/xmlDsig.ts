import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';

export function signNfeXml(xml: string, privateKeyPem: string, certificatePem: string, infNFeId: string) {
  if (!/^NFe\d{44}$/.test(infNFeId)) throw new Error('Id infNFe inválido.');
  const signer = new SignedXml({ privateKey: privateKeyPem, publicCert: certificatePem });
  signer.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  signer.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
  signer.addReference({
    xpath: `//*[@Id='${infNFeId}']`,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  });
  signer.computeSignature(xml, { location: { reference: "/*[local-name(.)='NFe']/*[local-name(.)='infNFe']", action: 'after' } });
  const signedXml = signer.getSignedXml();
  const document = new DOMParser().parseFromString(signedXml, 'application/xml');
  const signatureNode = (xpath.select("//*[local-name(.)='Signature']", document as any) as any[])[0] as Node | undefined;
  if (!signatureNode) throw new Error('Assinatura XML não foi inserida.');
  const verifier = new SignedXml({ publicCert: certificatePem });
  verifier.loadSignature(signatureNode);
  if (!verifier.checkSignature(signedXml)) throw new Error('Assinatura XML da NF-e não foi verificada.');
  return signedXml;
}
