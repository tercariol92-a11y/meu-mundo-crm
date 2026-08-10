import https from 'node:https';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

const RESTRICTED_DANFSE_ORIGIN = 'https://adn.producaorestrita.nfse.gov.br';
const RESTRICTED_PORTAL_ORIGIN = 'https://www.producaorestrita.nfse.gov.br';
const RESTRICTED_CERTIFICATE_ORIGIN = 'https://certificado.producaorestrita.nfse.gov.br';

function xmlValue(xml: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<(?:(?:\\w+):)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${escaped}>`));
  return match?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() || null;
}

export function parseAuthorizedNfseXml(xml: string) {
  return {
    nfseNumber: xmlValue(xml, 'nNFSe'),
    dpsNumber: xmlValue(xml, 'nDPS'),
    dpsSeries: xmlValue(xml, 'serie'),
    dfseNumber: xmlValue(xml, 'nDFSe'),
    processedAt: xmlValue(xml, 'dhProc'),
    competence: xmlValue(xml, 'dCompet'),
    municipalityCode: xmlValue(xml, 'cLocIncid'),
    municipalityName: xmlValue(xml, 'xLocIncid'),
    serviceDescription: xmlValue(xml, 'xDescServ') || xmlValue(xml, 'xTribNac'),
    nationalServiceDescription: xmlValue(xml, 'xTribNac'),
    nationalServiceCode: xmlValue(xml, 'cTribNac'),
    nbs: xmlValue(xml, 'cNBS'),
    serviceAmount: Number(xmlValue(xml, 'vServ') || xmlValue(xml, 'vLiq') || 0),
    issuerCnpj: xmlValue(xml, 'CNPJ'),
    issuerName: xmlValue(xml, 'xNome'),
    statusCode: xmlValue(xml, 'cStat'),
  };
}

export async function persistAuthorizedNfse(args: {
  db: Firestore;
  companyId: string;
  uid: string;
  accessKey: string;
  dpsId: string | null;
  xml: string;
  xmlPath: string;
  responsePath: string;
  httpStatus: number;
  environment?: 'producao_restrita' | 'producao';
  clientId?: string;
  clientName?: string;
}) {
  const parsed = parseAuthorizedNfseXml(args.xml);
  const ref = args.db.collection('notas_fiscais_servico').doc(args.accessKey);
  const existing = await ref.get();
  const data = {
    companyId: args.companyId,
    clienteId: args.clientId || '',
    clienteNome: args.clientName || 'Tomador não informado na DPS de teste',
    municipioPrestacao: parsed.municipalityCode || '',
    codigoServico: parsed.nationalServiceCode || '',
    descricaoServico: parsed.serviceDescription || 'Serviço autorizado pela SEFIN Nacional',
    valorServico: parsed.serviceAmount,
    iss: 0,
    issRetido: false,
    retencoes: { totalRetido: 0 },
    dataCompetencia: parsed.competence || '',
    competence: parsed.competence || '',
    dataEmissao: parsed.processedAt?.slice(0, 10) || '',
    emittedAt: parsed.processedAt || null,
    status: 'AUTORIZADA',
    numeroNota: parsed.nfseNumber || '',
    invoiceNumber: parsed.nfseNumber || '',
    numeroDps: parsed.dpsNumber || '',
    serieDps: parsed.dpsSeries || '',
    chaveAcesso: args.accessKey,
    chaveAcessoOficial: args.accessKey,
    codigoVerificacao: args.accessKey,
    reference: args.accessKey,
    provider: 'sefin_nacional',
    providerStatus: 'AUTORIZADA',
    protocol: args.dpsId,
    nfseId: args.dpsId,
    dfseNumber: parsed.dfseNumber,
    sefinStatusCode: parsed.statusCode,
    authorizationHttpStatus: args.httpStatus,
    xmlAvailable: true,
    danfseAvailable: true,
    xmlAutorizado: args.xml,
    xmlPath: args.xmlPath,
    responsePath: args.responsePath,
    environment: args.environment || 'producao_restrita',
    updatedBy: args.uid,
    updatedAt: FieldValue.serverTimestamp(),
    ...(existing.exists ? {} : { createdBy: args.uid, createdAt: FieldValue.serverTimestamp() }),
  };
  await ref.set(data, { merge: true });
  return { id: ref.id, ...data, ...parsed };
}

export function downloadRestrictedDanfse(
  accessKey: string,
  credentials: { pfx: Buffer; passphrase: string },
  timeoutMs = 30000,
) {
  if (process.env.FISCAL_PRODUCTION_ENABLED === 'true') throw new Error('Produção fiscal deve permanecer bloqueada.');
  if (!/^\d{50}$/.test(accessKey)) throw Object.assign(new Error('Chave de acesso da NFS-e inválida.'), { status: 400, code: 'INVALID_NFSE_ACCESS_KEY' });
  const legacyEndpoint = `${RESTRICTED_DANFSE_ORIGIN}/danfse/${accessKey}`;
  const requestPdf = (endpoint: string) => new Promise<{ statusCode: number; contentType: string; body: Buffer }>((resolve, reject) => {
    const request = https.request(endpoint, {
      method: 'GET', pfx: credentials.pfx, passphrase: credentials.passphrase,
      rejectUnauthorized: true, minVersion: 'TLSv1.2', timeout: timeoutMs,
      headers: { Accept: 'application/pdf' },
    }, response => {
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 15 * 1024 * 1024) request.destroy(new Error('DANFSe acima do limite seguro.'));
        else chunks.push(Buffer.from(chunk));
      });
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        const statusCode = Number(response.statusCode || 0);
        const contentType = String(response.headers['content-type'] || '');
        if (statusCode < 200 || statusCode >= 300) {
          const detail = body.toString('utf8').slice(0, 1000);
          reject(Object.assign(new Error(`A API oficial do DANFSe retornou HTTP ${statusCode}.`), { status: 502, code: 'OFFICIAL_DANFSE_HTTP_ERROR', diagnostic: { statusCode, detail } }));
          return;
        }
        if (!contentType.toLowerCase().includes('application/pdf') || body.subarray(0, 5).toString('ascii') !== '%PDF-') {
          reject(Object.assign(new Error('A API nacional não retornou um DANFSe PDF válido.'), { status: 502, code: 'INVALID_OFFICIAL_DANFSE_RESPONSE', diagnostic: { statusCode, contentType, bytes: body.length } }));
          return;
        }
        resolve({ statusCode, contentType, body });
      });
    });
    request.on('timeout', () => request.destroy(new Error('Timeout ao consultar o DANFSe.')));
    request.on('error', reject);
    request.end();
  });

  type PortalCookie = { name: string; value: string; domain: string; path: string; hostOnly: boolean };
  const portalAgent = new https.Agent({
    keepAlive: true,
    pfx: credentials.pfx,
    passphrase: credentials.passphrase,
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
  });
  const portalRequest = (endpoint: string, cookies: PortalCookie[], redirects = 0, referer?: string): Promise<{ statusCode: number; contentType: string; body: Buffer; endpoint: string }> => {
    if (redirects > 6) return Promise.reject(Object.assign(new Error('Redirecionamentos excessivos no Portal Nacional.'), { code: 'DANFSE_REDIRECT_LIMIT' }));
    const url = new URL(endpoint);
    if (![RESTRICTED_PORTAL_ORIGIN, RESTRICTED_CERTIFICATE_ORIGIN].includes(url.origin)) return Promise.reject(Object.assign(new Error('O Portal Nacional tentou redirecionar para um host não autorizado.'), { code: 'DANFSE_UNSAFE_REDIRECT' }));
    const matchingCookies = cookies
      .filter(cookie => (cookie.hostOnly ? url.hostname === cookie.domain : url.hostname === cookie.domain || url.hostname.endsWith(`.${cookie.domain}`)) && url.pathname.startsWith(cookie.path))
      .sort((left, right) => Number(right.hostOnly) - Number(left.hostOnly) || right.path.length - left.path.length);
    // The certificate and portal hosts may set cookies with the same name but
    // different scopes. Browsers prefer the most specific matching cookie;
    // sending both can make ASP.NET/WAF read the stale cross-domain session.
    const requestCookies = matchingCookies.filter((cookie, index, list) => list.findIndex(item => item.name === cookie.name) === index);
    return new Promise((resolve, reject) => {
      const request = https.request(url, {
        method: 'GET', agent: portalAgent, timeout: timeoutMs,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,image/avif,image/webp,*/*;q=0.7',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36',
          ...(referer ? { Referer: referer } : {}),
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          ...(requestCookies.length ? { Cookie: requestCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ') } : {}),
        },
      }, response => {
        console.log('[Fiscal DANFSe Portal]', { host: url.host, path: url.pathname, statusCode: Number(response.statusCode || 0), statusMessage: response.statusMessage || '', contentType: String(response.headers['content-type'] || ''), contentDisposition: String(response.headers['content-disposition'] || ''), server: String(response.headers.server || ''), sentCookieNames: requestCookies.map(cookie => cookie.name), cookieNames: (response.headers['set-cookie'] || []).map(cookie => cookie.split('=', 1)[0]) });
        for (const rawCookie of response.headers['set-cookie'] || []) {
          const parts = rawCookie.split(';').map(part => part.trim()); const pair = parts[0]; const separator = pair.indexOf('=');
          if (separator > 0) {
            const domainAttribute = parts.find(part => /^domain=/i.test(part))?.slice(7).replace(/^\./, '').toLowerCase();
            const pathAttribute = parts.find(part => /^path=/i.test(part))?.slice(5) || '/';
            const cookie: PortalCookie = { name: pair.slice(0, separator), value: pair.slice(separator + 1), domain: domainAttribute || url.hostname, path: pathAttribute, hostOnly: !domainAttribute };
            const existingIndex = cookies.findIndex(item => item.name === cookie.name && item.domain === cookie.domain && item.path === cookie.path);
            if (existingIndex >= 0) cookies[existingIndex] = cookie; else cookies.push(cookie);
          }
        }
        const location = response.headers.location;
        if (location && response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
          response.resume();
          portalRequest(new URL(location, url).toString(), cookies, redirects + 1, url.toString()).then(resolve, reject);
          return;
        }
        const chunks: Buffer[] = []; let size = 0;
        response.on('data', chunk => {
          size += chunk.length;
          if (size > 15 * 1024 * 1024) request.destroy(new Error('DANFSe acima do limite seguro.'));
          else chunks.push(Buffer.from(chunk));
        });
        response.on('end', () => resolve({ statusCode: Number(response.statusCode || 0), contentType: String(response.headers['content-type'] || ''), body: Buffer.concat(chunks), endpoint: url.toString() }));
      });
      request.on('timeout', () => request.destroy(new Error('Timeout ao consultar o Portal Nacional.')));
      request.on('error', reject);
      request.end();
    });
  };

  return requestPdf(legacyEndpoint).catch(async (error: any) => {
    if (error?.code !== 'OFFICIAL_DANFSE_HTTP_ERROR' || error?.diagnostic?.statusCode !== 404) throw error;
    const cookies: PortalCookie[] = [];
    const authentication = await portalRequest(`${RESTRICTED_CERTIFICATE_ORIGIN}/EmissorNacional/Certificado`, cookies);
    if (authentication.statusCode < 200 || authentication.statusCode >= 400) {
      throw Object.assign(new Error(`Autenticação do Portal Nacional retornou HTTP ${authentication.statusCode}.`), { status: 502, code: 'DANFSE_PORTAL_AUTH_FAILED', diagnostic: { endpoint: authentication.endpoint, statusCode: authentication.statusCode, contentType: authentication.contentType } });
    }
    const detail = await portalRequest(`${RESTRICTED_PORTAL_ORIGIN}/EmissorNacional/Notas/Visualizar/Index/${accessKey}`, cookies, 0, `${RESTRICTED_PORTAL_ORIGIN}/EmissorNacional/Dashboard`);
    if (detail.statusCode !== 200 || !detail.contentType.toLowerCase().includes('text/html')) {
      throw Object.assign(new Error(`Consulta autenticada da NFS-e retornou HTTP ${detail.statusCode}.`), { status: 502, code: 'OFFICIAL_NFSE_DETAIL_HTTP_ERROR', diagnostic: { endpoint: detail.endpoint, statusCode: detail.statusCode, contentType: detail.contentType } });
    }
    const officialHref = [...detail.body.toString('utf8').matchAll(/href=["']([^"']*\/Notas\/Download\/DANFSe[^"']*)["']/gi)][0]?.[1]?.replace(/&amp;/g, '&');
    if (!officialHref) throw Object.assign(new Error('O Portal Nacional não disponibilizou o link oficial do DANFSe para esta NFS-e.'), { status: 404, code: 'OFFICIAL_DANFSE_LINK_NOT_AVAILABLE' });
    const result = await portalRequest(new URL(officialHref, RESTRICTED_PORTAL_ORIGIN).toString(), cookies, 0, detail.endpoint);
    if (result.statusCode < 200 || result.statusCode >= 300) {
      if (result.statusCode === 403) {
        throw Object.assign(new Error('O Portal Nacional exige validação hCaptcha interativa para liberar o DANFSe oficial.'), {
          status: 409,
          code: 'OFFICIAL_DANFSE_CAPTCHA_REQUIRED',
          diagnostic: { endpoint: result.endpoint, statusCode: result.statusCode, contentType: result.contentType },
        });
      }
      throw Object.assign(new Error(`Download oficial do DANFSe retornou HTTP ${result.statusCode}.`), { status: 502, code: 'OFFICIAL_DANFSE_PORTAL_HTTP_ERROR', diagnostic: { endpoint: result.endpoint, statusCode: result.statusCode, contentType: result.contentType, detail: result.body.toString('utf8').slice(0, 1000) } });
    }
    if (!result.contentType.toLowerCase().includes('application/pdf') || result.body.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw Object.assign(new Error('O Portal Nacional não retornou o DANFSe oficial em PDF.'), { status: 502, code: 'INVALID_OFFICIAL_DANFSE_PORTAL_RESPONSE', diagnostic: { endpoint: result.endpoint, statusCode: result.statusCode, contentType: result.contentType, bytes: result.body.length } });
    }
    return { statusCode: result.statusCode, contentType: result.contentType, body: result.body };
  });
}
