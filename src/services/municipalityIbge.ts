const normalize = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Códigos oficiais IBGE dos municípios presentes na carteira recorrente.
// Nomes genéricos/ambíguos continuam pendentes, impedindo uma DPS incorreta.
const MUNICIPALITY_CODES: Record<string, string> = {
  curitiba: '4106902', curtiba: '4106902', 'curitiba parana': '4106902',
  paranagua: '4118204', 'sao jose dos pinhais': '4125506', 'fazenda rio grande': '4107652',
  'tijucas do sul': '4127601', 'campo magro': '4104253', 'campina grande do sul': '4104006',
  'rio azul': '4122008', palmeira: '4117701', 'sao paulo': '3550308',
  salvador: '2927408', 'rio negrinho': '4215000',
};

export function resolveMunicipalityIbgeCode(codeOrName: unknown, city?: unknown, state?: unknown) {
  const direct = String(codeOrName || '').replace(/\D/g, '');
  if (/^\d{7}$/.test(direct)) return direct;
  const uf = String(state || '').trim().toUpperCase();
  for (const candidate of [codeOrName, city].map(normalize).filter(Boolean)) {
    if (candidate === 'palmeira' && uf && uf !== 'PR') continue;
    if (MUNICIPALITY_CODES[candidate]) return MUNICIPALITY_CODES[candidate];
  }
  return '';
}
