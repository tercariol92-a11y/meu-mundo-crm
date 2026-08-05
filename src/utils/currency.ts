/**
 * Formatting and Parsing Utilities for BRL Currency
 */

/**
 * Formats a number to BRL standard: R$ 1.500,00
 */
export function formatToBRL(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return 'R$ 0,00';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Formats a number to Brazilian numeric display (without R$ symbol): 1.500,00
 */
export function formatNumberBR(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return '0,00';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '0,00';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Parses a BRL string (with dots, commas, or R$ symbol) into a safe float/number
 */
export function parseBRLToFloat(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  
  const valStr = String(value).trim();
  if (!valStr) return 0;

  // Remove currency symbol, spaces, and thousand separator dots
  // Then replace decimal comma with a dot
  const cleanStr = valStr
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');

  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : parsed;
}
