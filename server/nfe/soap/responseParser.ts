import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';

const text = (document: unknown, name: string) => String(xpath.select(`string(//*[local-name(.)='${name}'][1])`, document as any) || '').trim();

export function parseAuthorizationResponse(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const parserError = xpath.select("//*[local-name(.)='parsererror']", document as any) as any[];
  if (parserError.length) throw new Error('Resposta SOAP/XML inválida da SEFAZ.');
  const cStat = text(document, 'cStat');
  const xMotivo = text(document, 'xMotivo');
  const protocol = text(document, 'nProt');
  const accessKey = text(document, 'chNFe');
  const receipt = text(document, 'nRec');
  const authorized = cStat === '100';
  return { cStat, xMotivo, protocol: protocol || undefined, accessKey: accessKey || undefined, receipt: receipt || undefined, authorized, rawXml: xml };
}
