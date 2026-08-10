import https from 'node:https';
import { writeFile } from 'node:fs/promises';

const RESTRICTED_ORIGIN = 'https://sefin.producaorestrita.nfse.gov.br';
const PRODUCTION_ORIGIN = 'https://sefin.nfse.gov.br';

function officialEnvironment(input: URL) {
  if (input.protocol !== 'https:') throw Object.assign(new Error('A SEFIN exige HTTPS.'), { code: 'FISCAL_HTTPS_REQUIRED' });
  if (input.origin === RESTRICTED_ORIGIN) return { environment: 'producao_restrita' as const, origin: RESTRICTED_ORIGIN, docsPath: '/API/SefinNacional/docs/index', defaultBasePath: '/API/SefinNacional' };
  if (input.origin === PRODUCTION_ORIGIN) return { environment: 'producao' as const, origin: PRODUCTION_ORIGIN, docsPath: '/SefinNacional/docs/index', defaultBasePath: '/SefinNacional' };
  throw Object.assign(new Error('Destino fora dos ambientes oficiais da SEFIN Nacional.'), { code: 'FISCAL_OFFICIAL_DESTINATION_REQUIRED' });
}

function assertRestrictedOrigin(input: URL) {
  if (input.protocol !== 'https:' || input.origin !== RESTRICTED_ORIGIN) {
    throw Object.assign(new Error('Destino fora da Produção Restrita da SEFIN Nacional.'), { code: 'FISCAL_RESTRICTED_DESTINATION_REQUIRED' });
  }
}

function assertOfficialOrigin(input: URL, expectedOrigin: string) {
  officialEnvironment(input);
  if (input.origin !== expectedOrigin) throw Object.assign(new Error('A documentação tentou trocar de ambiente fiscal.'), { code: 'FISCAL_ENVIRONMENT_REDIRECT_BLOCKED' });
}

function assertRestrictedApiUrl(input: URL) {
  assertRestrictedOrigin(input);
  if (!input.pathname.startsWith('/API/SefinNacional/') && !input.pathname.startsWith('/SefinNacional/')) {
    throw Object.assign(new Error('Endpoint fora da API da Produção Restrita da SEFIN Nacional.'), { code: 'FISCAL_RESTRICTED_API_PATH_REQUIRED' });
  }
}

function requestText(url: URL, credentials: { pfx: Buffer; passphrase: string }, accept: string, expectedOrigin = RESTRICTED_ORIGIN) {
  // Swagger UI may load its initializer/spec from another path on the same
  // official restricted host. These calls are read-only GETs.
  assertOfficialOrigin(url, expectedOrigin);
  return new Promise<{ statusCode: number; contentType: string; body: string }>((resolve, reject) => {
    const request = https.request(url, { method: 'GET', pfx: credentials.pfx, passphrase: credentials.passphrase, rejectUnauthorized: true, minVersion: 'TLSv1.2', timeout: 15000, headers: { Accept: accept } }, response => {
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > 3 * 1024 * 1024) request.destroy(new Error('Documentação OpenAPI acima do limite.')); else chunks.push(Buffer.from(chunk)); });
      response.on('end', () => resolve({ statusCode: Number(response.statusCode || 0), contentType: String(response.headers['content-type'] || ''), body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('Timeout consultando o contrato oficial da SEFIN.'), { code: 'SEFIN_OPENAPI_TIMEOUT' })));
    request.on('error', reject); request.end();
  });
}

const absoluteOfficialUrl = (value: string, parent: URL) => {
  const url = new URL(value, parent); assertOfficialOrigin(url, parent.origin); return url;
};

function openApiCandidates(html: string, docsUrl: URL) {
  const values = new Set<string>();
  const decoded = html.replace(/&quot;/gi, '"').replace(/\\"/g, '"').replace(/\\\//g, '/');
  for (const pattern of [
    /\b(?:url|configUrl|openApi)\s*:\s*["']([^"']+)["']/gi,
    /["'](?:url|configUrl|openApi)["']\s*:\s*["']([^"']+)["']/gi,
    /["']([^"']*(?:swagger|openapi)[^"']*\.(?:json|ya?ml)[^"']*)["']/gi,
  ]) {
    for (const match of decoded.matchAll(pattern)) {
      if (/\.(?:json|ya?ml)(?:\?|$)/i.test(match[1]) || /\/swagger\/docs\//i.test(match[1])) values.add(absoluteOfficialUrl(match[1], docsUrl).href);
    }
  }
  for (const match of decoded.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    if (/swagger-initializer/i.test(match[1])) values.add(absoluteOfficialUrl(match[1], docsUrl).href);
  }
  return [...values];
}

function resolveJsonPointer(spec: any, ref?: string): any {
  if (!ref || !ref.startsWith('#/')) return undefined;
  return ref.slice(2).split('/').reduce((value, part) => value?.[part.replace(/~1/g, '/').replace(/~0/g, '~')], spec);
}

function resolveSchema(spec: any, schema: any, seen = new Set<string>()): any {
  if (!schema) return null;
  if (schema.$ref) {
    if (seen.has(schema.$ref)) throw Object.assign(new Error('Referência circular no contrato OpenAPI.'), { code: 'SEFIN_OPENAPI_CIRCULAR_REF' });
    return resolveSchema(spec, resolveJsonPointer(spec, schema.$ref), new Set([...seen, schema.$ref]));
  }
  if (Array.isArray(schema.allOf)) {
    return schema.allOf.map((part: any) => resolveSchema(spec, part, seen)).reduce((merged: any, part: any) => ({
      ...merged, ...part,
      properties: { ...(merged.properties || {}), ...(part?.properties || {}) },
      required: [...new Set([...(merged.required || []), ...(part?.required || [])])],
    }), {});
  }
  return schema;
}

export function extractNfsePostContract(spec: any, baseUrl: string) {
  const official = officialEnvironment(new URL(baseUrl));
  const postEntries = Object.entries<any>(spec?.paths || {}).filter(([, methods]) => methods?.post);
  // Only the ordinary DPS issuance contract is valid here. Endpoints such as
  // /decisao-judicial/nfse are separate fiscal flows with different payloads.
  const entry = postEntries.find(([path]) => /^\/nfse\/?$/i.test(path));
  if (!entry) return null;
  const [path, methods] = entry;
  const post = methods.post;
  const content = post.requestBody?.content || {};
  const swaggerBody = (post.parameters || []).find((parameter: any) => parameter?.in === 'body');
  const contentType = Object.keys(content).find(value => /^application\/json\b/i.test(value)) || Object.keys(content)[0] || post.consumes?.[0] || spec.consumes?.[0] || null;
  const schema = contentType && content[contentType]?.schema ? content[contentType].schema : swaggerBody?.schema;
  const resolvedSchema = resolveSchema(spec, schema);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const apiPath = normalizedPath.startsWith('/API/SefinNacional/')
    ? normalizedPath
    : `${String(spec?.basePath || official.defaultBasePath).replace(/\/$/, '')}${normalizedPath}`;
  const endpoint = new URL(apiPath, baseUrl);
  assertOfficialOrigin(endpoint, official.origin);
  const allowedApiPrefixes = official.environment === 'producao_restrita' ? ['/API/SefinNacional', '/SefinNacional'] : ['/SefinNacional'];
  if (!allowedApiPrefixes.some(prefix => endpoint.pathname === prefix || endpoint.pathname.startsWith(`${prefix}/`))) throw Object.assign(new Error('Endpoint fora da API oficial da SEFIN Nacional.'), { code: 'FISCAL_OFFICIAL_API_PATH_REQUIRED' });
  const properties = Object.fromEntries(Object.entries<any>(resolvedSchema?.properties || {}).map(([name, property]) => {
    const resolved = resolveSchema(spec, property);
    return [name, { type: resolved?.type || null, format: resolved?.format || null, examplePresent: resolved?.example !== undefined }];
  }));
  return { endpoint: endpoint.href, method: 'POST', contentType, properties, payloadProperties: Object.keys(properties), requiredProperties: resolvedSchema?.required || [] };
}

export async function discoverRestrictedSefinContract(baseUrl: string, credentials: { pfx: Buffer; passphrase: string }) {
  const base = new URL(baseUrl); const official = officialEnvironment(base);
  if (official.environment === 'producao' && process.env.FISCAL_PRODUCTION_ENABLED !== 'true') throw Object.assign(new Error('Descoberta de Produção Real exige autorização explícita.'), { code: 'FISCAL_PRODUCTION_NOT_ENABLED' });
  const docsUrl = new URL(official.docsPath, base);
  const docs = await requestText(docsUrl, credentials, 'text/html,application/json', official.origin);
  if (docs.statusCode < 200 || docs.statusCode >= 300) throw Object.assign(new Error(`Swagger oficial indisponível (HTTP ${docs.statusCode}).`), { code: 'SEFIN_SWAGGER_UNAVAILABLE' });
  // Public Swagger document only; no request credentials or fiscal payload are
  // included. The temporary copy exists solely to inspect dynamic loaders.
  if (process.env.NODE_ENV !== 'production') await writeFile(`/tmp/sefin-${official.environment}-swagger.html`, docs.body, { mode: 0o600 });
  let candidates = openApiCandidates(docs.body, docsUrl);
  const diagnostics: Array<Record<string, unknown>> = [];
  const initializer = candidates.find(value => /swagger-initializer/i.test(value));
  if (initializer) {
    const script = await requestText(new URL(initializer), credentials, 'application/javascript,text/javascript', official.origin);
    candidates = [...new Set([...candidates.filter(value => value !== initializer), ...openApiCandidates(script.body, new URL(initializer))])];
  }
  for (const candidate of candidates.filter(value => !/swagger-initializer/i.test(value))) {
    const response = await requestText(new URL(candidate), credentials, 'application/json', official.origin);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      diagnostics.push({ candidate, statusCode: response.statusCode, contentType: response.contentType });
      continue;
    }
    let spec: any;
    try { spec = JSON.parse(response.body); }
    catch {
      diagnostics.push({ candidate, statusCode: response.statusCode, contentType: response.contentType, parsed: false });
      continue;
    }
    diagnostics.push({
      candidate,
      statusCode: response.statusCode,
      contentType: response.contentType,
      parsed: true,
      topLevelKeys: Object.keys(spec || {}).slice(0, 20),
      postPaths: Object.entries<any>(spec?.paths || {}).filter(([, methods]) => methods?.post).map(([path]) => path).slice(0, 100),
    });
    const contract = extractNfsePostContract(spec, base.href);
    if (!contract) continue;
    return { environment: official.environment, docsUrl: docsUrl.href, openApiUrl: candidate, ...contract, transmissionPerformed: false };
  }
  throw Object.assign(new Error('O Swagger oficial foi acessado, mas o contrato POST /nfse não pôde ser identificado com segurança.'), {
    code: 'SEFIN_NFSE_CONTRACT_NOT_FOUND',
    diagnostic: { candidateCount: candidates.length, candidates: candidates.slice(0, 20), inspected: diagnostics },
  });
}
