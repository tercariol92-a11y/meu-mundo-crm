import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { DOMParser } from '@xmldom/xmldom';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const DANFSE_LAYOUT_VERSION = 'NT008-1.02-20260714';

type XmlNode = Element | null;
type Field = { label: string; value?: string | null; width?: number };

const cache = new Map<string, { pdf: Buffer; expiresAt: number }>();
const pt = (cm: number) => cm * 28.3464567;
const safe = (value?: string | null) => String(value || '').trim();
const money = (value?: string | null) => {
  const number = Number(String(value || '0').replace(',', '.'));
  return Number.isFinite(number) ? number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
};
const date = (value?: string | null) => {
  const text = safe(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return text;
  const [year, month, day] = text.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};
const dateTime = (value?: string | null) => {
  const text = safe(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return date(text);
  return `${date(text)} ${text.slice(11, 19)}`;
};
const documentNumber = (value?: string | null) => {
  const digits = safe(value).replace(/\D/g, '');
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return safe(value);
};
const describe = (value: string, descriptions: Record<string, string>) => value ? (descriptions[value] || value) : '';

function children(node: XmlNode, localName?: string) {
  if (!node) return [] as Element[];
  return Array.from(node.childNodes || []).filter((item): item is Element => item.nodeType === 1 && (!localName || item.localName === localName));
}
function child(node: XmlNode, localName: string) { return children(node, localName)[0] || null; }
function descendant(node: XmlNode, localName: string) {
  if (!node) return null;
  if (node.localName === localName) return node;
  for (const current of children(node)) { const found = descendant(current, localName); if (found) return found; }
  return null;
}
function value(node: XmlNode, ...path: string[]) {
  let current = node;
  for (const part of path) current = child(current, part);
  return safe(current?.textContent);
}
function firstValue(node: XmlNode, ...names: string[]) {
  for (const name of names) { const text = safe(descendant(node, name)?.textContent); if (text) return text; }
  return '';
}
function address(node: XmlNode) {
  const national = descendant(node, 'enderNac') || descendant(node, 'endNac');
  const parent = national?.parentNode?.nodeType === 1 ? national.parentNode as Element : null;
  const base = parent?.localName === 'end' ? parent : national;
  return {
    street: firstValue(base, 'xLgr'), number: firstValue(base, 'nro'), complement: firstValue(base, 'xCpl'),
    district: firstValue(base, 'xBairro'), municipalityCode: firstValue(national, 'cMun'), uf: firstValue(national, 'UF'),
    cep: firstValue(national, 'CEP'),
  };
}
function party(node: XmlNode) {
  const end = address(node);
  return {
    taxId: documentNumber(firstValue(node, 'CNPJ', 'CPF', 'NIF')),
    municipalRegistration: firstValue(node, 'IM'), name: firstValue(node, 'xNome'), phone: firstValue(node, 'fone'), email: firstValue(node, 'email'),
    address: [end.street, end.number, end.complement, end.district].filter(Boolean).join(', '),
    municipality: [firstValue(node, 'xMun', 'xLoc'), end.uf].filter(Boolean).join(' / '),
    municipalityCode: end.municipalityCode, cep: end.cep,
  };
}
function parse(xml: string, expectedAccessKey: string) {
  if (!xml || Buffer.byteLength(xml) > 5 * 1024 * 1024) throw new Error('XML autorizado ausente ou acima do limite seguro.');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML autorizado contém declaração não permitida.');
  const errors: string[] = [];
  const document = new DOMParser({ onError: (level, message) => { if (level !== 'warning') errors.push(message); } }).parseFromString(xml, 'application/xml');
  if (errors.length || document.documentElement?.localName !== 'NFSe') throw new Error('XML autorizado da NFS-e é inválido.');
  const root = document.documentElement;
  const info = child(root, 'infNFSe');
  const dpsInfo = descendant(descendant(info, 'DPS'), 'infDPS');
  if (!info || !dpsInfo) throw new Error('XML autorizado não contém os blocos oficiais infNFSe e infDPS.');
  const accessKey = safe(info.getAttribute('Id')).replace(/^NFS/, '') || expectedAccessKey;
  if (accessKey !== expectedAccessKey || !/^\d{50}$/.test(accessKey)) throw new Error('Chave do XML autorizado diverge da NFS-e solicitada.');
  const provider = party(descendant(info, 'emit') || descendant(dpsInfo, 'prest'));
  const taker = party(descendant(dpsInfo, 'toma'));
  const recipient = party(descendant(dpsInfo, 'dest'));
  const intermediary = party(descendant(dpsInfo, 'interm'));
  const service = descendant(dpsInfo, 'serv');
  const values = descendant(dpsInfo, 'valores');
  const municipalTax = descendant(values, 'tribMun');
  const federalTax = descendant(values, 'tribFed');
  const ibsCbs = descendant(values, 'IBSCBS') || descendant(values, 'tribIBSCBS');
  const opSimpNac = firstValue(dpsInfo, 'opSimpNac');
  const regApTribSN = firstValue(dpsInfo, 'regApTribSN');
  const environmentGenerator = firstValue(info, 'ambGer');
  const emissionType = firstValue(info, 'tpEmis', 'procEmi');
  const issType = firstValue(municipalTax, 'tribISSQN');
  const issWithholding = firstValue(municipalTax, 'tpRetISSQN');
  const specialRegime = firstValue(dpsInfo, 'regEspTrib');
  return {
    accessKey, environment: firstValue(dpsInfo, 'tpAmb'), municipalityIssuer: firstValue(info, 'xLocEmi'), municipalityService: firstValue(info, 'xLocPrestacao'),
    nfseNumber: firstValue(info, 'nNFSe'), competence: firstValue(dpsInfo, 'dCompet'), processedAt: firstValue(info, 'dhProc'), dpsNumber: firstValue(dpsInfo, 'nDPS'), dpsSeries: firstValue(dpsInfo, 'serie'), dpsIssuedAt: firstValue(dpsInfo, 'dhEmi'),
    environmentGenerator: describe(environmentGenerator, { '1': 'Sistema próprio do município', '2': 'SEFIN Nacional NFS-e' }),
    issuer: describe(emissionType, { '1': 'Aplicativo do contribuinte (Web Service)', '2': 'Aplicativo do fisco (Web)', '3': 'Aplicativo do fisco (App)' }),
    status: firstValue(info, 'cStat') === '100' ? 'AUTORIZADA' : firstValue(info, 'cStat'), purpose: firstValue(info, 'finNFSe') || 'NFS-e',
    provider, taker, recipient, intermediary,
    simpleNational: opSimpNac === '3' ? 'Optante - ME/EPP' : opSimpNac === '2' ? 'Optante - MEI' : opSimpNac === '1' ? 'Não optante' : opSimpNac,
    snAssessment: describe(regApTribSN, {
      '1': 'Tributos federais e municipal pelo Simples Nacional',
      '2': 'Tributos federais pelo SN e ISSQN fora do SN',
      '3': 'Tributos federais e municipal fora do SN',
    }),
    nationalServiceCode: firstValue(service, 'cTribNac'), municipalServiceCode: firstValue(service, 'cTribMun'), nbs: firstValue(service, 'cNBS'), serviceLocation: firstValue(info, 'xLocPrestacao', 'xLocIncid'), nationalServiceDescription: firstValue(info, 'xTribNac'), serviceDescription: firstValue(service, 'xDescServ'),
    issType: describe(issType, { '1': 'Operação tributável', '2': 'Imunidade', '3': 'Exportação de serviço', '4': 'Não incidência' }),
    issIncidence: firstValue(info, 'xLocIncid'),
    specialRegime: describe(specialRegime, { '0': 'Nenhum', '1': 'Ato Cooperado', '2': 'Estimativa', '3': 'Microempresa Municipal', '4': 'Notário ou Registrador', '5': 'Profissional Autônomo', '6': 'Sociedade de Profissionais', '9': 'Outros' }),
    immunity: firstValue(municipalTax, 'tpImunidade'), suspension: firstValue(municipalTax, 'exigSusp'), process: firstValue(municipalTax, 'nProcesso'), municipalBenefit: firstValue(municipalTax, 'BM'), deductions: firstValue(values, 'vDedRed'), unconditionalDiscount: firstValue(values, 'vDescIncond'), issBase: firstValue(info, 'vBC'), issRate: firstValue(info, 'pAliqAplic'),
    issWithholding: describe(issWithholding, { '1': 'Não retido', '2': 'Retido pelo tomador', '3': 'Retido pelo intermediário' }), issAmount: firstValue(info, 'vISSQN'),
    irrf: firstValue(federalTax, 'vIRRF'), socialSecurity: firstValue(federalTax, 'vRetCP'), socialContributions: firstValue(federalTax, 'vTotTribFed'), pis: firstValue(federalTax, 'vPIS'), cofins: firstValue(federalTax, 'vCOFINS'),
    cst: firstValue(ibsCbs, 'CST'), taxClassification: firstValue(ibsCbs, 'cClassTrib'), ibsBase: firstValue(ibsCbs, 'vBC'), ibsMunicipal: firstValue(ibsCbs, 'vIBSMun'), ibsState: firstValue(ibsCbs, 'vIBSUF'), ibsTotal: firstValue(ibsCbs, 'vIBS'), cbsTotal: firstValue(ibsCbs, 'vCBS'),
    serviceAmount: firstValue(values, 'vServ'), conditionalDiscount: firstValue(values, 'vDescCond'), retainedTotal: firstValue(info, 'vTotalRet'), liquidAmount: firstValue(info, 'vLiq'),
    complementary: firstValue(dpsInfo, 'xInfComp', 'infAdic'),
  };
}

function border(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, fill = false) {
  doc.lineWidth(0.5).rect(x, y, width, height); if (fill) doc.fillAndStroke('#f2f2f2', '#000000'); else doc.stroke('#000000');
}
function text(doc: PDFKit.PDFDocument, content: unknown, x: number, y: number, width: number, options: PDFKit.Mixins.TextOptions = {}) {
  doc.fillColor('#000000').font('Helvetica').fontSize(5.7).text(safe(String(content ?? '')), x, y, { width, height: 8, lineBreak: false, ellipsis: true, ...options });
}
function label(doc: PDFKit.PDFDocument, content: string, x: number, y: number, width: number) {
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(5.4).text(content, x, y, { width, lineBreak: false, ellipsis: true });
}
function fields(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, title: string, entries: Field[], options: { message?: string; rows?: number } = {}) {
  border(doc, x, y, width, height);
  const header = pt(0.42); doc.save().rect(x, y, width, header).fill('#f2f2f2').restore();
  doc.font('Helvetica-Bold').fontSize(6.7).text(title, x + 4, y + 3, { width: width - 8, lineBreak: false });
  if (options.message) { text(doc, options.message, x + 5, y + header + 6, width - 10); return; }
  const rows = options.rows || 2; const rowHeight = (height - header) / rows; const cols = Math.max(1, Math.ceil(entries.length / rows)); const cellWidth = width / cols;
  entries.forEach((entry, index) => {
    const row = index % rows; const col = Math.floor(index / rows); const cx = x + col * cellWidth; const cy = y + header + row * rowHeight;
    label(doc, entry.label, cx + 5, cy + 3, cellWidth - 10); text(doc, entry.value || '', cx + 5, cy + 11, cellWidth - 10);
  });
}

export async function generateDanfseV2FromAuthorizedXml(xml: string, accessKey: string) {
  const data = parse(xml, accessKey);
  const cacheKey = `${accessKey}:${DANFSE_LAYOUT_VERSION}`;
  const cached = cache.get(cacheKey); if (cached && cached.expiresAt > Date.now()) return cached.pdf;
  const qr = await QRCode.toBuffer(`https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${accessKey}`, { type: 'png', width: 220, margin: 0, errorCorrectionLevel: 'M' });
  const logoPath = resolve(process.cwd(), 'server/fiscal/danfse/assets/nfse-logo-horizontal.png');
  const logo = await readFile(logoPath);
  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true, compress: true, info: { Title: `DANFSe ${data.nfseNumber}`, Subject: `DANFSe v2.0 - ${DANFSE_LAYOUT_VERSION}`, Creator: 'Meu Mundo CRM - gerado exclusivamente do XML autorizado' } });
  const chunks: Buffer[] = []; doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
  const completed = new Promise<Buffer>((resolvePromise, reject) => { doc.on('end', () => resolvePromise(Buffer.concat(chunks))); doc.on('error', reject); });
  const pageW = pt(21); const margin = pt(0.18); const x = margin; const w = pageW - margin * 2; let y = margin;
  border(doc, x, y, w, pt(1.16), true);
  doc.image(logo, x + pt(0.18), y + pt(0.13), { fit: [pt(4), pt(0.85)] });
  doc.fillColor('#000000');
  doc.font('Helvetica-Bold').fontSize(9).text('DANFSe v2.0', x + pt(5.1), y + pt(0.20), { width: pt(10.2), align: 'center' });
  doc.font('Helvetica-Bold').fontSize(9).text('Documento Auxiliar da NFS-e', x + pt(5.1), y + pt(0.54), { width: pt(10.2), align: 'center' });
  text(doc, `Município: ${data.municipalityIssuer || '-'}`, x + pt(15.35), y + pt(0.16), pt(5));
  text(doc, `Ambiente Gerador: ${data.environmentGenerator || '-'}`, x + pt(15.35), y + pt(0.45), pt(5));
  text(doc, `Tipo de Ambiente: ${data.environment === '2' ? 'Produção Restrita' : 'Produção Real'}`, x + pt(15.35), y + pt(0.74), pt(5));
  if (data.environment === '2') doc.fillColor('#d00000').font('Helvetica-Bold').fontSize(8).text('NFS-e SEM VALIDADE JURÍDICA', x + pt(5.1), y + pt(0.88), { width: pt(10.2), align: 'center' });
  y += pt(1.16);
  border(doc, x, y, w, pt(2.84));
  label(doc, 'CHAVE DE ACESSO DA NFS-e', x + 5, y + 4, pt(15)); text(doc, accessKey, x + 5, y + 13, pt(15));
  const idY = y + pt(0.75); const idCols = [
    ['NÚMERO DA NFS-e', data.nfseNumber], ['COMPETÊNCIA DA NFS-e', date(data.competence)], ['DATA E HORA DA EMISSÃO DA NFS-e', dateTime(data.processedAt)],
    ['NÚMERO DA DPS', data.dpsNumber], ['SÉRIE DA DPS', data.dpsSeries], ['DATA E HORA DA EMISSÃO DA DPS', dateTime(data.dpsIssuedAt)],
    ['EMITENTE DA NFS-e', data.issuer], ['SITUAÇÃO DA NFS-e', data.status], ['FINALIDADE', data.purpose],
  ];
  idCols.forEach(([l, v], i) => { const col = i % 3; const row = Math.floor(i / 3); const cx = x + col * pt(5.3); const cy = idY + row * pt(0.55); label(doc, l, cx + 5, cy, pt(5)); text(doc, v, cx + 5, cy + 9, pt(5)); });
  doc.image(qr, x + w - pt(3.85), y + pt(0.18), { width: pt(1.75), height: pt(1.75) });
  text(doc, 'A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e.', x + w - pt(3.75), y + pt(2.04), pt(3.55), { lineBreak: true, align: 'center', height: pt(0.62) });
  y += pt(2.84);
  const partyEntries = (partyData: ReturnType<typeof party>, provider = false): Field[] => [
    { label: 'CNPJ / CPF / NIF', value: partyData.taxId }, { label: 'Indicador Municipal (Inscrição)', value: partyData.municipalRegistration }, { label: 'Telefone', value: partyData.phone },
    { label: 'Nome / Nome Empresarial', value: partyData.name }, { label: 'Município / Sigla UF', value: partyData.municipality }, { label: 'Código IBGE / CEP', value: [partyData.municipalityCode, partyData.cep].filter(Boolean).join(' / ') },
    { label: 'Endereço', value: partyData.address }, { label: 'E-mail', value: partyData.email }, ...(provider ? [{ label: 'Simples Nacional na Data de Competência', value: data.simpleNational }, { label: 'Regime de Apuração Tributária pelo SN', value: data.snAssessment }] : []),
  ];
  const providerH = pt(2.58); fields(doc, x, y, w, providerH, 'PRESTADOR / FORNECEDOR', partyEntries(data.provider, true), { rows: 3 }); y += providerH;
  const compactH = pt(1.96); fields(doc, x, y, w, compactH, 'TOMADOR / ADQUIRENTE', partyEntries(data.taker), data.taker.taxId ? { rows: 3 } : { message: 'TOMADOR/ADQUIRENTE DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e' }); y += compactH;
  fields(doc, x, y, w, compactH, 'DESTINATÁRIO DA OPERAÇÃO', partyEntries(data.recipient), data.recipient.taxId ? { rows: 3 } : { message: data.taker.taxId ? 'O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE DA OPERAÇÃO' : 'DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e' }); y += compactH;
  fields(doc, x, y, w, compactH, 'INTERMEDIÁRIO DA OPERAÇÃO', partyEntries(data.intermediary), data.intermediary.taxId ? { rows: 3 } : { message: 'INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e' }); y += compactH;
  const serviceH = pt(3.05); border(doc, x, y, w, serviceH); doc.save().rect(x, y, w, pt(0.42)).fill('#f2f2f2').restore(); doc.font('Helvetica-Bold').fontSize(6.7).text('SERVIÇO PRESTADO', x + 4, y + 3);
  const serviceCols = [[ 'Código de Tributação Nacional / Municipal', [data.nationalServiceCode, data.municipalServiceCode].filter(Boolean).join(' / ') ], ['Código da NBS', data.nbs], ['Local da Prestação / Sigla UF / País', data.serviceLocation]];
  serviceCols.forEach(([l, v], i) => { const cx = x + i * w / 3; label(doc, l, cx + 5, y + pt(0.52), w / 3 - 10); text(doc, v, cx + 5, y + pt(0.82), w / 3 - 10); });
  label(doc, 'Descrição do Código de Tributação Nacional / Municipal', x + 5, y + pt(1.12), w - 10); text(doc, data.nationalServiceDescription, x + 5, y + pt(1.40), w - 10);
  label(doc, 'Descrição do Serviço', x + 5, y + pt(1.72), w - 10); doc.font('Helvetica').fontSize(6.4).text(data.serviceDescription, x + 5, y + pt(2.02), { width: w - 10, height: pt(0.88), ellipsis: true }); y += serviceH;
  const taxH = pt(2.42); fields(doc, x, y, w, taxH, 'TRIBUTAÇÃO MUNICIPAL (ISSQN)', [
    { label: 'Tipo de Tributação do ISSQN', value: data.issType }, { label: 'Município / UF / País de Incidência', value: data.issIncidence }, { label: 'Regime Especial de Tributação', value: data.specialRegime }, { label: 'Tipo de Imunidade', value: data.immunity },
    { label: 'Suspensão da Exigibilidade', value: data.suspension }, { label: 'Número Processo Suspensão', value: data.process }, { label: 'Benefício Municipal', value: data.municipalBenefit }, { label: 'Total Deduções/Reduções', value: data.deductions ? `R$ ${money(data.deductions)}` : '' },
    { label: 'Desconto Incondicionado', value: data.unconditionalDiscount ? `R$ ${money(data.unconditionalDiscount)}` : '' }, { label: 'BC ISSQN', value: data.issBase ? `R$ ${money(data.issBase)}` : '' }, { label: 'Alíquota Aplicada', value: data.issRate ? `${data.issRate}%` : '' }, { label: 'Retenção do ISSQN', value: data.issWithholding }, { label: 'ISSQN Apurado', value: data.issAmount ? `R$ ${money(data.issAmount)}` : '' },
  ], { rows: 3 }); y += taxH;
  const federalH = pt(1.48); fields(doc, x, y, w, federalH, 'TRIBUTAÇÃO FEDERAL (EXCETO CBS)', [
    { label: 'IRRF', value: data.irrf ? `R$ ${money(data.irrf)}` : '' }, { label: 'Contribuição Previdenciária - Retida', value: data.socialSecurity ? `R$ ${money(data.socialSecurity)}` : '' }, { label: 'Contribuições Sociais - Retidas', value: data.socialContributions ? `R$ ${money(data.socialContributions)}` : '' }, { label: 'PIS - Débito Apuração Própria', value: data.pis ? `R$ ${money(data.pis)}` : '' }, { label: 'COFINS - Débito Apuração Própria', value: data.cofins ? `R$ ${money(data.cofins)}` : '' },
  ], { rows: 2 }); y += federalH;
  const ibsH = pt(1.72); fields(doc, x, y, w, ibsH, 'TRIBUTAÇÃO IBS / CBS', [
    { label: 'CST / cClassTrib', value: [data.cst, data.taxClassification].filter(Boolean).join(' / ') }, { label: 'Base de Cálculo', value: data.ibsBase ? `R$ ${money(data.ibsBase)}` : '' }, { label: 'Valor Apurado Municipal - IBS', value: data.ibsMunicipal ? `R$ ${money(data.ibsMunicipal)}` : '' }, { label: 'Valor Apurado Estadual - IBS', value: data.ibsState ? `R$ ${money(data.ibsState)}` : '' }, { label: 'Valor Total Apurado - IBS', value: data.ibsTotal ? `R$ ${money(data.ibsTotal)}` : '' }, { label: 'Valor Total Apurado - CBS', value: data.cbsTotal ? `R$ ${money(data.cbsTotal)}` : '' },
  ], { rows: 2 }); y += ibsH;
  const totalsH = pt(1.62); fields(doc, x, y, w, totalsH, 'VALOR TOTAL DA NFS-e', [
    { label: 'VALOR TOTAL DA OPERAÇÃO / SERVIÇO', value: `R$ ${money(data.serviceAmount)}` }, { label: 'Desconto Incondicionado', value: `R$ ${money(data.unconditionalDiscount)}` }, { label: 'Desconto Condicionado', value: `R$ ${money(data.conditionalDiscount)}` }, { label: 'Total das Retenções (ISSQN / Federais)', value: `R$ ${money(data.retainedTotal)}` }, { label: 'VALOR LÍQUIDO DA NFS-e', value: `R$ ${money(data.liquidAmount)}` }, { label: 'Total do IBS/CBS', value: `R$ ${money(String(Number(data.ibsTotal || 0) + Number(data.cbsTotal || 0)))}` },
  ], { rows: 2 }); y += totalsH;
  const complementaryH = Math.max(pt(2.45), pt(29.7) - margin - y - pt(0.78)); border(doc, x, y, w, complementaryH); doc.save().rect(x, y, w, pt(0.42)).fill('#f2f2f2').restore(); doc.font('Helvetica-Bold').fontSize(6.7).text('INFORMAÇÕES COMPLEMENTARES', x + 4, y + 3); doc.font('Helvetica').fontSize(5.7).text(data.complementary || '', x + 5, y + pt(0.55), { width: w - 10, height: complementaryH - pt(0.62), ellipsis: true }); y += complementaryH;
  const receiptH = pt(0.70); border(doc, x, y, w, receiptH); label(doc, 'DATA CIENTIFICAÇÃO:', x + 5, y + 4, w / 4); label(doc, 'IDENTIFICAÇÃO E ASSINATURA', x + w / 4 + 5, y + 4, w / 3); label(doc, `Nº NFS-e / CHAVE NFS-e: ${data.nfseNumber} / ${accessKey}`, x + w * 0.58, y + 4, w * 0.4);
  doc.end();
  const pdf = await completed;
  cache.set(cacheKey, { pdf, expiresAt: Date.now() + 10 * 60_000 });
  if (cache.size > 100) cache.delete(cache.keys().next().value as string);
  return pdf;
}
