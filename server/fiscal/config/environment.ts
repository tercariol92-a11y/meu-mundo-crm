export type FiscalEnvironment = 'producao_restrita' | 'producao';

export function getFiscalEnvironment() {
  const environment = String(process.env.FISCAL_ENVIRONMENT || 'producao_restrita') as FiscalEnvironment;
  const productionEnabled = process.env.FISCAL_PRODUCTION_ENABLED === 'true';
  if (environment !== 'producao_restrita' && environment !== 'producao') throw new Error('FISCAL_ENVIRONMENT inválido.');
  const restrictedBaseUrl = String(process.env.SEFIN_RESTRICTED_BASE_URL || 'https://sefin.producaorestrita.nfse.gov.br').replace(/\/$/, '');
  if (!restrictedBaseUrl.startsWith('https://sefin.producaorestrita.nfse.gov.br')) throw new Error('Host de Produção Restrita não autorizado.');
  const productionBaseUrl = String(process.env.SEFIN_PRODUCTION_BASE_URL || 'https://sefin.nfse.gov.br').replace(/\/$/, '');
  if (productionBaseUrl !== 'https://sefin.nfse.gov.br') throw new Error('Host de Produção Real não autorizado.');
  if (environment === 'producao' && !productionEnabled) throw Object.assign(new Error('Ambiente fiscal de produção está bloqueado.'), { code: 'FISCAL_PRODUCTION_BLOCKED' });
  return {
    environment,
    productionEnabled,
    baseUrl: environment === 'producao' ? productionBaseUrl : restrictedBaseUrl,
    xsdVersion: process.env.FISCAL_XSD_ACTIVE_VERSION || '2026-07-27',
  };
}
