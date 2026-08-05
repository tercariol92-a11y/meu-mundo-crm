export function parseDate(value: any): Date | null {
  if (!value) return null;
  
  // Handlers for Firestore Timestamps
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  if (typeof value === 'object' && 'seconds' in value) {
    const ms = value.seconds * 1000 + (value.nanoseconds || 0) / 1000000;
    return new Date(ms);
  }
  
  // Standard parsing for strings, numbers, Dates
  if (value instanceof Date) {
    return value;
  }
  
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d;
  }
  
  return null;
}

export function formatDateBR(value: any): string {
  const d = parseDate(value);
  if (!d) return '-';
  return d.toLocaleDateString('pt-BR');
}
