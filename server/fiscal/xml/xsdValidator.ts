import libxml from 'libxmljs2';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const XSD_ROOT = resolve(process.cwd(), 'server/fiscal/xsd/prod-restrita');
export async function validateXmlAgainstXsd(xml: string, version: string, schemaFile = 'DPS_v1.01.xsd') {
  if (Buffer.byteLength(xml, 'utf8') > 2 * 1024 * 1024) throw new Error('XML acima do limite de 2 MB.');
  if (!/^[A-Za-z0-9._-]+\.xsd$/.test(schemaFile) || !/^\d{4}-\d{2}-\d{2}$/.test(version)) throw new Error('Versão ou esquema inválido.');
  const schemaPath = resolve(XSD_ROOT, version, schemaFile);
  if (!schemaPath.startsWith(`${XSD_ROOT}${sep}`)) throw new Error('Caminho XSD não autorizado.');
  const [xmlDoc, xsdDoc] = [libxml.parseXml(xml), libxml.parseXml(await readFile(schemaPath, 'utf8'), { baseUrl: schemaPath })];
  const valid = xmlDoc.validate(xsdDoc);
  return { valid, errors: xmlDoc.validationErrors.map(error => ({ message: error.message.trim(), line: error.line, column: error.column })) };
}
