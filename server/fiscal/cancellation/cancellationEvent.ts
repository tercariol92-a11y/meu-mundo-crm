import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import https from 'node:https';
import { base64ToGzipBuffer, gzipBufferToBase64, gzipBufferToXml, xmlToGzipBuffer } from '../xml/compression';
import { validateXmlAgainstXsd } from '../xml/xsdValidator';
import { verifyXmlSignature } from '../signatures/xmlDsig';

export const CANCELLATION_EVENT_CODE = '101101' as const;
export const CANCELLATION_EVENT_ELEMENT = 'e101101' as const;
export const CANCELLATION_EVENT_ID_TYPE = '101' as const;
export const CANCELLATION_EVENT_SEQUENCE = '001' as const;
export const PRODUCTION_EVENTS_ENDPOINT_TEMPLATE = 'https://sefin.nfse.gov.br/SefinNacional/nfse/{chaveAcesso}/eventos';
export const RESTRICTED_EVENTS_ENDPOINT_TEMPLATE = 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse/{chaveAcesso}/eventos';

export type CancellationReasonCode = '1' | '2' | '9';

export type CancellationEventInput = {
  accessKey: string;
  authorCnpj: string;
  environmentType: '1' | '2';
  reasonCode: CancellationReasonCode;
  reason: string;
  occurredAt?: string;
};

export function buildCancellationConsultationUrls(
  accessKeyInput: string,
  environment: 'producao' | 'producao_restrita',
) {
  const accessKey = digits(accessKeyInput);
  if (!/^\d{50}$/.test(accessKey)) throw new Error('Chave oficial da NFS-e inválida.');
  const template = environment === 'producao'
    ? PRODUCTION_EVENTS_ENDPOINT_TEMPLATE
    : RESTRICTED_EVENTS_ENDPOINT_TEMPLATE;
  const allEvents = template.replace('{chaveAcesso}', accessKey);
  return {
    allEvents,
    cancellationEvent: `${allEvents}/${CANCELLATION_EVENT_CODE}/1`,
  };
}

/**
 * Interpreta uma resposta oficial de evento já obtida da SEFIN. Não altera
 * estado: o chamador só pode persistir CANCELADA quando `confirmed` for true.
 */
export function parseOfficialCancellationEventXml(xml: string, expectedAccessKeyInput: string) {
  const expectedAccessKey = digits(expectedAccessKeyInput);
  if (!/^\d{50}$/.test(expectedAccessKey)) throw new Error('Chave oficial da NFS-e inválida.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const text = (expression: string) => String(xpath.select(`string(${expression})`, document) || '').trim();
  const linkedAccessKey = digits(text("//*[local-name()='pedRegEvento']/*[local-name()='infPedReg']/*[local-name()='chNFSe']"));
  const cancellationDescription = text("//*[local-name()='e101101']/*[local-name()='xDesc']");
  const eventId = text("//*[local-name()='infEvento']/@Id") || text("//*[local-name()='infPedReg']/@Id");
  const protocol = text("//*[local-name()='nProt']") || text("//*[local-name()='idEvento']") || text("//*[local-name()='nDFSe']");
  const registeredAt = text("//*[local-name()='dhProc']") || text("//*[local-name()='dhEvento']");
  const eventSequence = text("//*[local-name()='nSeqEvento']") || '1';
  const confirmed = linkedAccessKey === expectedAccessKey && Boolean(cancellationDescription);
  return {
    confirmed,
    status: confirmed ? 'CANCELADA' as const : 'INCONCLUSIVO' as const,
    accessKey: linkedAccessKey || null,
    eventId: eventId || null,
    protocol: protocol || null,
    registeredAt: registeredAt || null,
    eventSequence,
  };
}

function digits(value: string) { return String(value || '').replace(/\D/g, ''); }
function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function eventDate(value?: string) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) throw new Error('Data do evento de cancelamento inválida.');
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  return `${formatter.format(parsed).replace(' ', 'T')}-03:00`;
}

export function buildCancellationEvent(input: CancellationEventInput) {
  const accessKey = digits(input.accessKey);
  const authorCnpj = digits(input.authorCnpj);
  const reason = String(input.reason || '').trim();
  if (!/^\d{50}$/.test(accessKey)) throw new Error('Chave oficial da NFS-e inválida.');
  if (!/^\d{14}$/.test(authorCnpj)) throw new Error('CNPJ do autor do cancelamento inválido.');
  if (!['1', '2', '9'].includes(input.reasonCode)) throw new Error('Código oficial de motivo de cancelamento inválido.');
  if (reason.length < 15 || reason.length > 255) throw new Error('O motivo deve possuir entre 15 e 255 caracteres.');
  // TSIdPedRegEvt reserva, após a chave de 50 posições, três posições
  // para o tipo (101) e três para o pedido (001). O elemento específico é e101101.
  const id = `PRE${accessKey}${CANCELLATION_EVENT_ID_TYPE}${CANCELLATION_EVENT_SEQUENCE}`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infPedReg Id="${id}"><tpAmb>${input.environmentType}</tpAmb><verAplic>MeuMundoCRM_1.0</verAplic><dhEvento>${eventDate(input.occurredAt)}</dhEvento><CNPJAutor>${authorCnpj}</CNPJAutor><chNFSe>${accessKey}</chNFSe><${CANCELLATION_EVENT_ELEMENT}><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>${input.reasonCode}</cMotivo><xMotivo>${escapeXml(reason)}</xMotivo></${CANCELLATION_EVENT_ELEMENT}></infPedReg></pedRegEvento>`;
  return { id, xml, accessKey, authorCnpj };
}

export function signCancellationEvent(xml: string, privateKeyPem: string, certificatePem: string, id: string) {
  const signer = new SignedXml({ privateKey: privateKeyPem, publicCert: certificatePem });
  signer.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  signer.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  signer.addReference({
    xpath: `//*[@Id='${id}']`,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });
  signer.computeSignature(xml, { location: { reference: `/*[local-name(.)='pedRegEvento']`, action: 'append' } });
  const signedXml = signer.getSignedXml();
  return { signedXml, verified: verifyXmlSignature(signedXml, certificatePem) };
}

export async function prepareCancellationEvent(
  input: CancellationEventInput,
  credentials: { privateKeyPem: string; certificatePem: string },
  xsdVersion: string,
) {
  const built = buildCancellationEvent(input);
  const before = await validateXmlAgainstXsd(built.xml, xsdVersion, 'pedRegEvento_v1.01.xsd');
  if (!before.valid) return { valid: false, stage: 'xsd_before_signature' as const, errors: before.errors };
  const signed = signCancellationEvent(built.xml, credentials.privateKeyPem, credentials.certificatePem, built.id);
  const after = await validateXmlAgainstXsd(signed.signedXml, xsdVersion, 'pedRegEvento_v1.01.xsd');
  const gzipBase64 = gzipBufferToBase64(xmlToGzipBuffer(signed.signedXml));
  return {
    valid: signed.verified && after.valid,
    stage: signed.verified && after.valid ? 'ready' as const : 'signed_validation' as const,
    id: built.id,
    eventCode: CANCELLATION_EVENT_CODE,
    eventElement: CANCELLATION_EVENT_ELEMENT,
    eventSequence: CANCELLATION_EVENT_SEQUENCE,
    xsdValidBeforeSignature: before.valid,
    signatureVerified: signed.verified,
    xsdValidAfterSignature: after.valid,
    gzipBase64Ready: gzipBase64.length > 0,
    eventoXmlGZipB64: gzipBase64,
    payloadSha256Source: gzipBase64,
    signedXml: signed.signedXml,
    errors: after.errors,
    transmitted: false,
  };
}

export function transmitPreparedCancellationEvent(
  endpoint: string,
  eventoXmlGZipB64: string,
  credentials: { pfx: Buffer; passphrase: string },
  timeoutMs = 30000,
) {
  const parsedEndpoint = new URL(endpoint);
  if (parsedEndpoint.origin !== 'https://sefin.nfse.gov.br' || !/^\/SefinNacional\/nfse\/\d{50}\/eventos$/.test(parsedEndpoint.pathname)) {
    throw new Error('Endpoint oficial de cancelamento em Produção Real inválido.');
  }
  if (process.env.FISCAL_PRODUCTION_ENABLED !== 'true' || process.env.FISCAL_ENVIRONMENT !== 'producao') {
    throw new Error('Cancelamento em Produção Real não autorizado pelo ambiente.');
  }
  if (!eventoXmlGZipB64) throw new Error('Evento assinado e compactado ausente.');
  const body = buildCancellationTransmissionBody(eventoXmlGZipB64);
  return new Promise<{ statusCode: number; contentType: string; body: Buffer; elapsedMs: number }>((resolve, reject) => {
    const started = Date.now();
    const request = https.request(endpoint, {
      method: 'POST', pfx: credentials.pfx, passphrase: credentials.passphrase,
      rejectUnauthorized: true, minVersion: 'TLSv1.2', timeout: timeoutMs,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Content-Length': String(body.length) },
    }, response => {
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) request.destroy(new Error('Resposta SEFIN acima do limite seguro.'));
        else chunks.push(Buffer.from(chunk));
      });
      response.on('end', () => resolve({ statusCode: Number(response.statusCode || 0), contentType: String(response.headers['content-type'] || ''), body: Buffer.concat(chunks), elapsedMs: Date.now() - started }));
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('Timeout no cancelamento; situação desconhecida. Consulte a SEFIN antes de nova tentativa.'), { code: 'SEFIN_CANCELLATION_TIMEOUT_UNKNOWN' })));
    request.on('error', reject);
    request.end(body);
  });
}

export function buildCancellationTransmissionBody(eventoXmlGZipB64: string) {
  if (!eventoXmlGZipB64) throw new Error('Evento assinado e compactado ausente.');
  return Buffer.from(JSON.stringify({ pedidoRegistroEventoXmlGZipB64: eventoXmlGZipB64 }), 'utf8');
}

type OfficialReadResult = {
  endpoint: string;
  statusCode: number;
  contentType: string;
  body: Buffer;
};

function readOfficialEndpoint(
  endpoint: string,
  credentials: { pfx: Buffer; passphrase: string },
  timeoutMs = 30000,
) {
  const parsed = new URL(endpoint);
  if (parsed.origin !== 'https://sefin.nfse.gov.br' || !/^\/SefinNacional\/nfse\/\d{50}(?:\/eventos(?:\/101101\/1)?)?$/.test(parsed.pathname)) {
    throw new Error('Endpoint oficial de consulta em Produção Real inválido.');
  }
  return new Promise<OfficialReadResult>((resolve, reject) => {
    const request = https.request(endpoint, {
      method: 'GET',
      pfx: credentials.pfx,
      passphrase: credentials.passphrase,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      timeout: timeoutMs,
      headers: { Accept: 'application/json, application/xml, text/xml' },
    }, response => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) request.destroy(new Error('Resposta SEFIN acima do limite seguro.'));
        else chunks.push(Buffer.from(chunk));
      });
      response.on('end', () => resolve({
        endpoint,
        statusCode: Number(response.statusCode || 0),
        contentType: String(response.headers['content-type'] || ''),
        body: Buffer.concat(chunks),
      }));
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('Timeout na consulta oficial do cancelamento.'), { code: 'SEFIN_CANCELLATION_QUERY_TIMEOUT' })));
    request.on('error', reject);
    request.end();
  });
}

function collectEventXmls(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string') {
    if (value.includes('<') && /(?:pedRegEvento|evento)/i.test(value)) output.push(value);
    else if (/^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.length > 80) {
      try { output.push(gzipBufferToXml(Buffer.from(value, 'base64'))); } catch { /* campo não é XML GZip/Base64 */ }
    }
  } else if (Array.isArray(value)) value.forEach(item => collectEventXmls(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectEventXmls(item, output));
  return output;
}

function findResponseScalar(value: unknown, names: string[]): string | null {
  if (!value || typeof value !== 'object') return null;
  const accepted = new Set(names.map(name => name.toLowerCase()));
  for (const [key, item] of Object.entries(value)) {
    if (accepted.has(key.toLowerCase()) && ['string', 'number'].includes(typeof item)) return String(item).trim() || null;
  }
  for (const item of Object.values(value)) {
    if (item && typeof item === 'object') {
      const found = findResponseScalar(item, names);
      if (found) return found;
    }
  }
  return null;
}

export function interpretOfficialCancellationResponse(
  response: { statusCode: number; contentType?: string; body: Buffer | string },
  expectedAccessKey: string,
) {
  const responseText = Buffer.isBuffer(response.body) ? response.body.toString('utf8').trim() : String(response.body || '').trim();
  let responseJson: unknown = null;
  const eventXmls: string[] = [];
  if (responseText.startsWith('<')) eventXmls.push(responseText);
  else if (responseText) {
    try {
      responseJson = JSON.parse(responseText);
      collectEventXmls(responseJson, eventXmls);
    } catch {
      try { eventXmls.push(gzipBufferToXml(base64ToGzipBuffer(responseText))); } catch { /* resposta textual não é evento */ }
    }
  }
  const confirmation = eventXmls
    .map(xml => { try { return parseOfficialCancellationEventXml(xml, expectedAccessKey); } catch { return null; } })
    .find(item => item?.confirmed) || null;
  const responseCode = findResponseScalar(responseJson, ['codigo', 'code', 'cStat', 'codigoErro']);
  const responseMessage = findResponseScalar(responseJson, ['mensagem', 'message', 'xMotivo', 'descricao', 'description']);
  const httpAccepted = response.statusCode >= 200 && response.statusCode < 300;
  return {
    accepted: httpAccepted && Boolean(confirmation),
    status: httpAccepted && confirmation ? 'CANCELADA' as const : (response.statusCode >= 400 ? 'REJEITADA' as const : 'INCONCLUSIVO' as const),
    confirmation,
    responseCode,
    responseMessage,
    eventXml: confirmation ? eventXmls.find(xml => {
      try { return parseOfficialCancellationEventXml(xml, expectedAccessKey).confirmed; } catch { return false; }
    }) || '' : '',
  };
}

export async function consultOfficialCancellation(
  accessKeyInput: string,
  credentials: { pfx: Buffer; passphrase: string },
) {
  if (process.env.FISCAL_ENVIRONMENT !== 'producao') throw new Error('Consulta exige ambiente de Produção Real.');
  const accessKey = digits(accessKeyInput);
  const urls = buildCancellationConsultationUrls(accessKey, 'producao');
  const noteUrl = `https://sefin.nfse.gov.br/SefinNacional/nfse/${accessKey}`;
  const [note, allEvents, cancellationEvent] = await Promise.all([
    readOfficialEndpoint(noteUrl, credentials),
    readOfficialEndpoint(urls.allEvents, credentials),
    readOfficialEndpoint(urls.cancellationEvent, credentials),
  ]);
  const eventXmls: string[] = [];
  for (const response of [allEvents, cancellationEvent]) {
    const text = response.body.toString('utf8').trim();
    if (!text) continue;
    if (/xml/i.test(response.contentType) || text.startsWith('<')) eventXmls.push(text);
    else { try { collectEventXmls(JSON.parse(text), eventXmls); } catch { /* resposta não estruturada */ } }
  }
  const confirmation = eventXmls
    .map(xml => { try { return parseOfficialCancellationEventXml(xml, accessKey); } catch { return null; } })
    .find(item => item?.confirmed) || null;
  const noteExists = note.statusCode >= 200 && note.statusCode < 300;
  const specificCancellationNotFound = cancellationEvent.statusCode === 404;
  const genericEventsNonBlocking = [200, 404, 503].includes(allEvents.statusCode);
  const status = confirmation
    ? 'CANCELADA'
    : (noteExists && specificCancellationNotFound && genericEventsNonBlocking ? 'AUTORIZADA' : 'INCONCLUSIVO');
  const safeMessage = (response: OfficialReadResult) => {
    const text = response.body.toString('utf8').trim();
    if (!text) return null;
    try { const json = JSON.parse(text); return String(json?.mensagem || json?.message || json?.xMotivo || '').slice(0, 500) || null; }
    catch { return text.startsWith('<') ? null : text.slice(0, 500); }
  };
  return {
    status,
    confirmation,
    responses: {
      nfse: { statusCode: note.statusCode, message: safeMessage(note) },
      events: { statusCode: allEvents.statusCode, message: safeMessage(allEvents) },
      cancellationEvent: { statusCode: cancellationEvent.statusCode, message: safeMessage(cancellationEvent) },
    },
  };
}
