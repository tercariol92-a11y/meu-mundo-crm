import libxml from 'libxmljs2';
import { access, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const XSD_ROOT = resolve(process.cwd(), 'server/nfe/xsd/official');

export async function validateNfeXmlAgainstOfficialXsd(xml: string, packageVersion: string, schemaFile = 'nfe_v4.00.xsd') {
  if (!/^[A-Za-z0-9._-]+$/.test(packageVersion) || !/^[A-Za-z0-9._-]+\.xsd$/.test(schemaFile)) throw new Error('Pacote ou XSD inválido.');
  const schemaPath = resolve(XSD_ROOT, packageVersion, schemaFile);
  if (!schemaPath.startsWith(`${XSD_ROOT}${sep}`)) throw new Error('Caminho XSD não autorizado.');
  try { await access(schemaPath); } catch {
    throw Object.assign(new Error(`Pacote XSD oficial da NF-e não instalado: ${packageVersion}/${schemaFile}.`), { code: 'NFE_XSD_NOT_INSTALLED' });
  }
  const xmlDoc = libxml.parseXml(xml);
  const xsdDoc = libxml.parseXml(await readFile(schemaPath, 'utf8'), { baseUrl: schemaPath });
  const valid = xmlDoc.validate(xsdDoc);
  return { valid, errors: xmlDoc.validationErrors.map(error => ({ message: error.message.trim(), line: error.line, column: error.column })) };
}
