import * as XLSX from 'xlsx';
import { BoletoBancario, Cliente } from '../types';

const BTG_TEMPLATE_URL = '/templates/BTG_Planilha_Modelo_Boleto_Em_Lote_V.2.5.2.xlsm';
const FIRST_DATA_ROW = 4;

export interface BtgBoletoExportItem {
  boleto: BoletoBancario;
  cliente: Cliente;
}

export interface BtgBoletoValidationIssue {
  boletoId: string;
  clienteNome: string;
  fields: string[];
}

const digits = (value?: string) => String(value || '').replace(/\D/g, '');
const text = (value?: string) => String(value || '').trim();

const formatDecimal = (value: number) => Number(value || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

const parseLocalDate = (value: string) => {
  const normalized = String(value || '').slice(0, 10);
  const [year, month, day] = normalized.includes('-')
    ? normalized.split('-').map(Number)
    : normalized.split('/').reverse().map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const notificationType = (cliente: Cliente) => {
  const hasEmail = Boolean(text(cliente.emailFinanceiro || cliente.emailPrincipal));
  const hasPhone = Boolean(digits(cliente.celularWhatsapp || cliente.telefoneFixo));
  if (hasEmail && hasPhone) return 'Email/Sms';
  if (hasEmail) return 'Email';
  if (hasPhone) return 'Sms';
  return 'SemNotificacao';
};

export const validateBtgBoletoItems = (items: BtgBoletoExportItem[]): BtgBoletoValidationIssue[] => {
  return items.flatMap(({ boleto, cliente }) => {
    const missing: string[] = [];
    const document = digits(cliente.cnpj);
    if (![11, 14].includes(document.length)) missing.push('CPF/CNPJ válido');
    if (!text(cliente.razaoSocial || cliente.nomeFantasia)) missing.push('nome/razão social');
    if (digits(cliente.cep).length !== 8) missing.push('CEP');
    if (!text(cliente.rua)) missing.push('endereço');
    if (!text(cliente.numero)) missing.push('número');
    if (!text(cliente.bairro)) missing.push('bairro');
    if (!text(cliente.cidade)) missing.push('cidade');
    if (text(cliente.estado).length !== 2) missing.push('UF');
    if (!text(boleto.nossoNumero) || text(boleto.nossoNumero).length > 15) missing.push('seu número (máx. 15 caracteres)');
    if (!(Number(boleto.valorCobrado) > 0)) missing.push('valor maior que zero');
    if (!parseLocalDate(boleto.vencimento)) missing.push('vencimento válido');
    return missing.length ? [{ boletoId: boleto.id, clienteNome: boleto.clienteNome, fields: missing }] : [];
  });
};

const setCell = (sheet: XLSX.WorkSheet, address: string, value: string | number | Date, styleSource?: XLSX.CellObject) => {
  const isDate = value instanceof Date;
  sheet[address] = {
    t: isDate ? 'd' : typeof value === 'number' ? 'n' : 's',
    v: value,
    z: isDate ? 'dd/mm/yyyy' : '@',
    ...(styleSource?.s ? { s: styleSource.s } : {}),
  } as XLSX.CellObject;
};

export const buildBtgBoletoWorkbook = async (items: BtgBoletoExportItem[]): Promise<Blob> => {
  const issues = validateBtgBoletoItems(items);
  if (issues.length) throw new Error('Existem cobranças com dados incompletos para a planilha BTG.');

  const response = await fetch(BTG_TEMPLATE_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Modelo oficial BTG indisponível (HTTP ${response.status}).`);
  const template = await response.arrayBuffer();
  const workbook = XLSX.read(template, { type: 'array', bookVBA: true, cellStyles: true, cellDates: true });
  const sheet = workbook.Sheets.Boletos;
  if (!sheet) throw new Error('A aba Boletos não existe no modelo oficial BTG.');

  const templateStyles = Array.from({ length: 26 }, (_, column) =>
    sheet[XLSX.utils.encode_cell({ r: 3, c: column })] ||
    sheet[XLSX.utils.encode_cell({ r: 2, c: column })]
  );
  items.forEach(({ boleto, cliente }, index) => {
    const row = FIRST_DATA_ROW + index;
    const email = text(cliente.emailFinanceiro || cliente.emailPrincipal);
    const phone = digits(cliente.celularWhatsapp || cliente.telefoneFixo);
    const values: Array<string | number | Date> = [
      digits(cliente.cnpj),
      text(cliente.razaoSocial || cliente.nomeFantasia),
      phone,
      email,
      notificationType(cliente),
      digits(cliente.cep),
      text(cliente.rua),
      text(cliente.numero),
      text(cliente.complemento),
      text(cliente.bairro),
      text(cliente.cidade),
      text(cliente.estado).toUpperCase(),
      text(boleto.nossoNumero).slice(0, 15),
      formatDecimal(Number(boleto.valorCobrado)),
      parseLocalDate(boleto.vencimento)!,
      90,
      30,
      60,
      `Cobrança ${boleto.documentoOrigemTipo} ${boleto.documentoOrigemId}`.slice(0, 200),
      Number(boleto.juros) > 0 ? 'Porcentagem por mês' : 'SemPenalidade',
      formatDecimal(Number(boleto.juros || 0)),
      Number(boleto.multa) > 0 ? 'Porcentagem' : 'SemPenalidade',
      formatDecimal(Number(boleto.multa || 0)),
      Number(boleto.desconto) > 0 ? 'Porcentagem' : 'SemDesconto',
      formatDecimal(Number(boleto.desconto || 0)),
      parseLocalDate(boleto.vencimento)!,
    ];
    values.forEach((value, column) => setCell(sheet, XLSX.utils.encode_cell({ r: row - 1, c: column }), value, templateStyles[column]));
  });

  const endRow = Math.max(FIRST_DATA_ROW + items.length - 1, 3);
  sheet['!ref'] = `A1:AD${Math.max(endRow, 4078)}`;
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsm', bookVBA: true, cellStyles: true });
  return new Blob([bytes], { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
};

export const downloadBtgBoletoWorkbook = async (items: BtgBoletoExportItem[]) => {
  const blob = await buildBtgBoletoWorkbook(items);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `BTG-Boletos-${today}.xlsm`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};
