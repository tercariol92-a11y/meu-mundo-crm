import { buildNfeAccessKey } from './accessKey';

const NS = 'http://www.portalfiscal.inf.br/nfe';
const escapeXml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '');
const money = (value: number) => Number(value || 0).toFixed(2);
const quantity = (value: number) => Number(value || 0).toFixed(4);

export interface NfePartyAddress {
  street: string; number: string; district: string; cityCode: string; city: string;
  state: string; zipCode: string; countryCode?: string; country?: string;
}

export interface NfeIssuer {
  cnpj: string; legalName: string; tradeName?: string; stateRegistration: string;
  municipalRegistration?: string; crt: '1'; address: NfePartyAddress;
}

export interface NfeRecipient {
  cnpj: string; legalName: string; stateRegistration?: string; email?: string;
  ieIndicator: '1' | '2' | '9'; address: NfePartyAddress;
}

export interface NfeProductItem {
  productCode: string; description: string; ncm: string; cfop: string; unit: string;
  quantity: number; unitValue: number; csosn: '102' | '202'; origin: string;
  cest?: string; gtin?: string; pisCst: string; cofinsCst: string;
}

export interface NfeCommonSaleXmlInput {
  environment: 'homologacao' | 'producao'; issuer: NfeIssuer; recipient: NfeRecipient;
  series: number; number: number; numericCode: string; issuedAt: string;
  items: NfeProductItem[]; freight: number; paymentCode: string; paymentAmount: number;
  additionalInfo?: string;
}

export function buildCommonSaleNfeXml(input: NfeCommonSaleXmlInput) {
  if (!input.items.length) throw new Error('NF-e sem itens.');
  if (!/^\d{14}$/.test(digits(input.issuer.cnpj))) throw new Error('CNPJ do emitente inválido.');
  if (!/^\d{14}$/.test(digits(input.recipient.cnpj))) throw new Error('CNPJ do destinatário inválido.');
  input.items.forEach((item, index) => {
    const label = `Item ${index + 1}`;
    if (!/^\d{8}$/.test(digits(item.ncm))) throw new Error(`${label}: NCM inválido.`);
    if (!/^\d{4}$/.test(digits(item.cfop))) throw new Error(`${label}: CFOP inválido.`);
    if (!/^[0-8]$/.test(item.origin)) throw new Error(`${label}: origem da mercadoria inválida.`);
    if (!['102', '202'].includes(item.csosn)) throw new Error(`${label}: CSOSN não suportado.`);
    if (item.csosn === '202' && !/^\d{7}$/.test(digits(item.cest))) throw new Error(`${label}: CSOSN 202 exige CEST válido.`);
    if (!/^\d{2}$/.test(item.pisCst) || !/^\d{2}$/.test(item.cofinsCst)) throw new Error(`${label}: CST de PIS/COFINS inválido.`);
  });
  const tpAmb = input.environment === 'producao' ? '1' : '2';
  const yearMonth = input.issuedAt.slice(2, 7).replace('-', '');
  const accessKey = buildNfeAccessKey({ cUf: '41', yearMonth, cnpj: input.issuer.cnpj, model: '55', series: input.series, number: input.number, emissionType: '1', numericCode: input.numericCode });
  const totalProducts = input.items.reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
  const totalInvoice = totalProducts + Number(input.freight || 0);
  const destination = input.recipient.address.state.toUpperCase() === input.issuer.address.state.toUpperCase() ? '1' : '2';
  const homologationName = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
  const recipientName = tpAmb === '2' ? homologationName : input.recipient.legalName;

  const addressXml = (address: NfePartyAddress) => `<xLgr>${escapeXml(address.street)}</xLgr><nro>${escapeXml(address.number)}</nro><xBairro>${escapeXml(address.district)}</xBairro><cMun>${digits(address.cityCode)}</cMun><xMun>${escapeXml(address.city)}</xMun><UF>${escapeXml(address.state.toUpperCase())}</UF><CEP>${digits(address.zipCode)}</CEP><cPais>${digits(address.countryCode || '1058')}</cPais><xPais>${escapeXml(address.country || 'BRASIL')}</xPais>`;
  const itemsXml = input.items.map((item, index) => {
    const value = item.quantity * item.unitValue;
    const cest = item.cest ? `<CEST>${digits(item.cest)}</CEST>` : '';
    const gtin = digits(item.gtin) || 'SEM GTIN';
    const icms = item.csosn === '102'
      ? `<ICMSSN102><orig>${escapeXml(item.origin)}</orig><CSOSN>102</CSOSN></ICMSSN102>`
      : `<ICMSSN202><orig>${escapeXml(item.origin)}</orig><CSOSN>202</CSOSN><modBCST>4</modBCST><pMVAST>0.00</pMVAST><pRedBCST>0.00</pRedBCST><vBCST>0.00</vBCST><pICMSST>0.00</pICMSST><vICMSST>0.00</vICMSST></ICMSSN202>`;
    return `<det nItem="${index + 1}"><prod><cProd>${escapeXml(item.productCode)}</cProd><cEAN>${gtin}</cEAN><xProd>${escapeXml(item.description)}</xProd><NCM>${digits(item.ncm)}</NCM>${cest}<CFOP>${digits(item.cfop)}</CFOP><uCom>${escapeXml(item.unit)}</uCom><qCom>${quantity(item.quantity)}</qCom><vUnCom>${money(item.unitValue)}</vUnCom><vProd>${money(value)}</vProd><cEANTrib>${gtin}</cEANTrib><uTrib>${escapeXml(item.unit)}</uTrib><qTrib>${quantity(item.quantity)}</qTrib><vUnTrib>${money(item.unitValue)}</vUnTrib><indTot>1</indTot></prod><imposto><ICMS>${icms}</ICMS><PIS><PISNT><CST>${escapeXml(item.pisCst)}</CST></PISNT></PIS><COFINS><COFINSNT><CST>${escapeXml(item.cofinsCst)}</CST></COFINSNT></COFINS></imposto></det>`;
  }).join('');

  const infNFe = `<infNFe Id="NFe${accessKey}" versao="4.00"><ide><cUF>41</cUF><cNF>${input.numericCode.padStart(8, '0')}</cNF><natOp>VENDA DE MERCADORIA</natOp><mod>55</mod><serie>${input.series}</serie><nNF>${input.number}</nNF><dhEmi>${escapeXml(input.issuedAt)}</dhEmi><tpNF>1</tpNF><idDest>${destination}</idDest><cMunFG>${digits(input.issuer.address.cityCode)}</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>${accessKey.slice(-1)}</cDV><tpAmb>${tpAmb}</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>MEU_MUNDO_CRM_1.0</verProc></ide><emit><CNPJ>${digits(input.issuer.cnpj)}</CNPJ><xNome>${escapeXml(input.issuer.legalName)}</xNome>${input.issuer.tradeName ? `<xFant>${escapeXml(input.issuer.tradeName)}</xFant>` : ''}<enderEmit>${addressXml(input.issuer.address)}</enderEmit><IE>${digits(input.issuer.stateRegistration)}</IE>${input.issuer.municipalRegistration ? `<IM>${digits(input.issuer.municipalRegistration)}</IM>` : ''}<CRT>1</CRT></emit><dest><CNPJ>${digits(input.recipient.cnpj)}</CNPJ><xNome>${escapeXml(recipientName)}</xNome><enderDest>${addressXml(input.recipient.address)}</enderDest><indIEDest>${input.recipient.ieIndicator}</indIEDest>${input.recipient.stateRegistration ? `<IE>${digits(input.recipient.stateRegistration)}</IE>` : ''}${input.recipient.email ? `<email>${escapeXml(input.recipient.email)}</email>` : ''}</dest>${itemsXml}<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${money(totalProducts)}</vProd><vFrete>${money(input.freight)}</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${money(totalInvoice)}</vNF><vTotTrib>0.00</vTotTrib></ICMSTot></total><transp><modFrete>9</modFrete></transp><pag><detPag><indPag>0</indPag><tPag>${escapeXml(input.paymentCode)}</tPag><vPag>${money(input.paymentAmount)}</vPag></detPag></pag>${input.additionalInfo ? `<infAdic><infCpl>${escapeXml(input.additionalInfo)}</infCpl></infAdic>` : ''}</infNFe>`;
  return { accessKey, infNFeId: `NFe${accessKey}`, xml: `<NFe xmlns="${NS}">${infNFe}</NFe>`, totalInvoice };
}

export function wrapNfeAuthorizationBatch(signedNfeXml: string, batchId: string) {
  if (!/^\d{1,15}$/.test(batchId)) throw new Error('Identificador do lote inválido.');
  return `<enviNFe xmlns="${NS}" versao="4.00"><idLote>${batchId}</idLote><indSinc>1</indSinc>${signedNfeXml}</enviNFe>`;
}
