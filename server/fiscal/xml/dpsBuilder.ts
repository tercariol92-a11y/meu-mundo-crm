const NS = 'http://www.sped.fazenda.gov.br/nfse';

export type MinimalDpsInput = {
  /** 1 = Produção; 2 = Produção Restrita. */
  environmentType?: '1' | '2';
  cnpj: string;
  municipalRegistration?: string;
  /**
   * A IM do prestador só pode integrar a DPS quando o CNC NFS-e do município
   * emissor confirmar a existência das informações complementares.
   */
  cncAllowsMunicipalRegistration?: boolean;
  companyName?: string;
  emitterType?: '1' | '2' | '3';
  series: string;
  number: string;
  issuedAt: string;
  competenceDate: string;
  nationalServiceCode: string;
  nbs?: string;
  serviceDescription: string;
  serviceValue: string;
  simpleNationalOption: '1' | '2' | '3';
  simpleNationalTaxRegime?: '1' | '2' | '3';
  simpleNationalTotalTaxRate?: string;
  specialTaxRegime?: string;
  issWithheld?: boolean;
  taker?: {
    cnpj: string;
    name: string;
    municipalityCode?: string;
    postalCode?: string;
    street?: string;
    number?: string;
    district?: string;
    email?: string;
  };
};

const xmlEscape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
const digitsOrUpper = (value: string) => value.replace(/[^0-9A-Z]/gi, '').toUpperCase();
const tag = (name: string, value?: string) => value ? `<${name}>${xmlEscape(value)}</${name}>` : '';

export function buildMinimalCuritibaDps(input: MinimalDpsInput) {
  const environmentType = input.environmentType || '2';
  const cnpj = digitsOrUpper(input.cnpj);
  if (!/^[0-9A-Z]{14}$/.test(cnpj)) throw new Error('CNPJ deve seguir o TSCNPJ ativo (14 caracteres alfanuméricos).');
  if (!/^\d{1,5}$/.test(input.series) || !/^[1-9]\d{0,14}$/.test(input.number)) throw new Error('Série ou número da DPS inválido.');
  if (!/^\d{6}$/.test(input.nationalServiceCode)) throw new Error('Código nacional do serviço deve possuir seis dígitos.');
  if (!/^\d+(\.\d{1,2})?$/.test(input.serviceValue)) throw new Error('Valor do serviço inválido.');
  const id = `DPS41069022${cnpj}${input.series.padStart(5, '0')}${input.number.padStart(15, '0')}`;
  const simpleNationalTaxRegime = input.simpleNationalOption === '3'
    ? (input.simpleNationalTaxRegime || '1')
    : undefined;
  const regAp = input.simpleNationalOption === '3'
    ? `<regApTribSN>${simpleNationalTaxRegime}</regApTribSN>`
    : '';
  const emitterType = input.emitterType || '1';
  const municipalRegistration = input.cncAllowsMunicipalRegistration === true
    ? tag('IM', input.municipalRegistration)
    : '';
  const prestadorName = emitterType === '1' ? '' : tag('xNome', input.companyName);
  let taker = '';
  if (input.taker) {
    const takerCnpj = digitsOrUpper(input.taker.cnpj);
    if (!/^[0-9A-Z]{14}$/.test(takerCnpj)) throw new Error('CNPJ do tomador invalido.');
    if (!input.taker.name?.trim()) throw new Error('Razao social do tomador obrigatoria.');
    const hasAddress = input.taker.municipalityCode && input.taker.postalCode && input.taker.street && input.taker.number && input.taker.district;
    const address = hasAddress
      ? `<end><endNac><cMun>${xmlEscape(input.taker.municipalityCode!.trim())}</cMun><CEP>${digitsOrUpper(input.taker.postalCode!)}</CEP></endNac><xLgr>${xmlEscape(input.taker.street!.trim())}</xLgr><nro>${xmlEscape(input.taker.number!.trim())}</nro><xBairro>${xmlEscape(input.taker.district!.trim())}</xBairro></end>`
      : '';
    taker = `<toma><CNPJ>${takerCnpj}</CNPJ><xNome>${xmlEscape(input.taker.name.trim())}</xNome>${address}${tag('email', input.taker.email)}</toma>`;
  }
  if (input.nbs && !/^\d{9}$/.test(input.nbs)) throw new Error('NBS deve possuir nove dígitos.');
  const totalTax = input.simpleNationalOption === '3'
    ? `<pTotTribSN>${xmlEscape(input.simpleNationalTotalTaxRate || '6.00')}</pTotTribSN>`
    : '<indTotTrib>0</indTotTrib>';
  return {
    id,
    xml: `<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="${NS}" versao="1.01"><infDPS Id="${id}"><tpAmb>${environmentType}</tpAmb><dhEmi>${xmlEscape(input.issuedAt)}</dhEmi><verAplic>MEUMUNDO-FASE1</verAplic><serie>${input.series}</serie><nDPS>${input.number}</nDPS><dCompet>${xmlEscape(input.competenceDate)}</dCompet><tpEmit>${emitterType}</tpEmit><cLocEmi>4106902</cLocEmi><prest><CNPJ>${cnpj}</CNPJ>${municipalRegistration}${prestadorName}<regTrib><opSimpNac>${input.simpleNationalOption}</opSimpNac>${regAp}<regEspTrib>${xmlEscape(input.specialTaxRegime || '0')}</regEspTrib></regTrib></prest>${taker}<serv><locPrest><cLocPrestacao>4106902</cLocPrestacao></locPrest><cServ><cTribNac>${input.nationalServiceCode}</cTribNac><xDescServ>${xmlEscape(input.serviceDescription)}</xDescServ>${tag('cNBS', input.nbs)}</cServ></serv><valores><vServPrest><vServ>${input.serviceValue}</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>${input.issWithheld ? '2' : '1'}</tpRetISSQN></tribMun><totTrib>${totalTax}</totTrib></trib></valores></infDPS></DPS>`,
  };
}
