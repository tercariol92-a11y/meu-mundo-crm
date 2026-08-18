export type NfeEnvironment = 'homologacao' | 'producao';

const PR_ENDPOINTS = {
  homologacao: {
    authorization: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4',
    authorizationResult: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeRetAutorizacao4',
    protocolQuery: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4',
    serviceStatus: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeStatusServico4',
    eventReception: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeRecepcaoEvento4',
    inutilization: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeInutilizacao4',
  },
  producao: {
    authorization: 'https://nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4',
    authorizationResult: 'https://nfe.sefa.pr.gov.br/nfe/NFeRetAutorizacao4',
    protocolQuery: 'https://nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4',
    serviceStatus: 'https://nfe.sefa.pr.gov.br/nfe/NFeStatusServico4',
    eventReception: 'https://nfe.sefa.pr.gov.br/nfe/NFeRecepcaoEvento4',
    inutilization: 'https://nfe.sefa.pr.gov.br/nfe/NFeInutilizacao4',
  },
} as const;

export function getNfeEnvironment() {
  const environment = String(process.env.NFE_ENVIRONMENT || 'homologacao') as NfeEnvironment;
  const productionEnabled = process.env.NFE_PRODUCTION_ENABLED === 'true';

  if (environment !== 'homologacao' && environment !== 'producao') {
    throw new Error('NFE_ENVIRONMENT deve ser homologacao ou producao.');
  }
  if (environment === 'producao' && !productionEnabled) {
    throw Object.assign(new Error('Produção de NF-e permanece bloqueada.'), { code: 'NFE_PRODUCTION_BLOCKED' });
  }

  return {
    environment,
    productionEnabled,
    model: '55' as const,
    layoutVersion: '4.00' as const,
    uf: 'PR' as const,
    ibgeCode: '41' as const,
    endpoints: PR_ENDPOINTS[environment],
  };
}

export function assertNfeEndpointAllowed(url: string, environment: NfeEnvironment) {
  const allowed = Object.values(PR_ENDPOINTS[environment]);
  if (!allowed.includes(url as never)) {
    throw Object.assign(new Error('Endpoint de NF-e não autorizado para o ambiente selecionado.'), {
      code: 'NFE_ENDPOINT_NOT_ALLOWED',
    });
  }
}

export { PR_ENDPOINTS };
