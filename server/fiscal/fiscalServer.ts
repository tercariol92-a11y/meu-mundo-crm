import express from 'express';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile, chmod, readFile } from 'node:fs/promises';
import { basename, extname, resolve, sep } from 'node:path';
import { getFiscalEnvironment } from './config/environment';
import { parsePkcs12 } from './certificates/pkcs12';
import { testMtlsConnection } from './mtls/client';
import { validateXmlAgainstXsd } from './xml/xsdValidator';
import { signXmlForLocalTest } from './signatures/xmlDsig';
import { xmlToGzipBuffer, gzipBufferToBase64, base64ToGzipBuffer, gzipBufferToXml } from './xml/compression';
import { buildMinimalCuritibaDps } from './xml/dpsBuilder';
import { writeFiscalAudit } from './audit/auditService';
import { discoverRestrictedSefinContract } from './phase2/openApiDiscovery';
import { prepareRestrictedNfseRequest, RESTRICTED_NFSE_ENDPOINT, transmitPreparedRestrictedNfse, prepareNfseRequest, PRODUCTION_NFSE_ENDPOINT, transmitPreparedNfse } from './phase2/restrictedTransmission';
import { downloadRestrictedDanfse, parseAuthorizedNfseXml, persistAuthorizedNfse } from './postAuthorization/authorizedNfse';
import { consultOfficialCancellation, interpretOfficialCancellationResponse, prepareCancellationEvent, PRODUCTION_EVENTS_ENDPOINT_TEMPLATE, transmitPreparedCancellationEvent } from './cancellation/cancellationEvent';
import { DANFSE_LAYOUT_VERSION, generateDanfseV2FromAuthorizedXml } from './danfse/danfseV2';

const PORT = Number(process.env.PORT || process.env.FISCAL_PORT || 3002);
const FIREBASE_DATABASE_ID = process.env.FIREBASE_DATABASE_ID?.trim() || 'ai-studio-deb852ec-3d57-481f-a30e-1461a2294d90';
const MAX_JSON = '8mb';
const app = express();
const fiscalDownloadTokens = new Map<string, { buffer: Buffer; mimeType: string; fileName: string; expiresAt: number }>();
app.disable('x-powered-by');
app.use(express.json({ limit: MAX_JSON, type: 'application/json' }));

function adminApp() {
  const existing = getApps().find(item => item.name === 'fiscal-service'); if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim(); const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim(); const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin do serviço fiscal não configurado.');
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, 'fiscal-service');
}

function secretMatches(received: string) {
  const expected = process.env.FISCAL_SERVICE_INTERNAL_SECRET || '';
  return expected.length >= 32 && expected.length === received.length && timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function createFiscalDownload(buffer: Buffer, mimeType: string, fileName: string) {
  const token = randomBytes(24).toString('hex');
  fiscalDownloadTokens.set(token, { buffer, mimeType, fileName, expiresAt: Date.now() + 60_000 });
  return `/api/fiscal/file-download?token=${token}`;
}

app.get('/api/fiscal/file-download', (req, res) => {
  if (!secretMatches(String(req.headers['x-internal-secret'] || ''))) return res.status(403).end();
  const token = String(req.query.token || '');
  const entry = fiscalDownloadTokens.get(token);
  fiscalDownloadTokens.delete(token);
  if (!entry || entry.expiresAt < Date.now()) return res.status(404).end();
  res.setHeader('Content-Type', entry.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${entry.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
  res.setHeader('Content-Length', String(entry.buffer.length));
  return res.status(200).send(entry.buffer);
});

async function protect(req: any, res: any, next: any) {
  try {
    if (!secretMatches(String(req.header('X-Internal-Secret') || ''))) return res.status(401).json({ success: false, code: 'INVALID_INTERNAL_SECRET', error: 'Segredo interno inválido.' });
    const authorization = String(req.header('Authorization') || '');
    if (!authorization.startsWith('Bearer ')) return res.status(401).json({ success: false, code: 'FIREBASE_TOKEN_REQUIRED', error: 'Token Firebase obrigatório.' });
    const firebaseApp = adminApp(); const decoded = await getAuth(firebaseApp).verifyIdToken(authorization.slice(7).trim()); const db = getFirestore(firebaseApp, FIREBASE_DATABASE_ID);
    const user = (await db.collection('usuarios').doc(decoded.uid).get()).data() || {};
    const roles = new Set([
      String(user.role || ''),
      ...((Array.isArray(user.roles) ? user.roles : []).map((role: unknown) => String(role))),
      String(decoded.role || ''),
    ].filter(Boolean));
    if (!roles.has('admin') && !roles.has('financeiro')) {
      return res.status(403).json({ success: false, code: 'FISCAL_ACCESS_REQUIRED', error: 'Permissão fiscal administrativa ou financeira obrigatória.' });
    }
    const companyId = String(user.companyId || user.tenantId || user.empresaId || decoded.companyId || '');
    if (!companyId || !/^[A-Za-z0-9_-]{2,128}$/.test(companyId)) return res.status(403).json({ success: false, code: 'COMPANY_REQUIRED', error: 'Empresa fiscal inválida.' });
    req.fiscal = { decoded, db, companyId }; next();
  } catch (error) { next(error); }
}

function readCertificate(body: any) {
  const fileName = String(body?.fileName || 'certificate.pfx');
  const mimeType = String(body?.mimeType || '').split(';', 1)[0].trim().toLowerCase();
  const normalizedName = fileName.normalize('NFC');
  const extension = extname(normalizedName).toLowerCase();
  if (!normalizedName || normalizedName.length > 120 || basename(normalizedName) !== normalizedName || !['.pfx', '.p12'].includes(extension)) {
    throw Object.assign(new Error('O certificado deve ser um arquivo local .pfx ou .p12 válido.'), { status: 400, code: 'INVALID_CERTIFICATE_FILENAME' });
  }
  const browserPkcs12MimeTypes = new Set(['', 'application/x-pkcs12', 'application/pkcs12', 'application/octet-stream', 'application/x-pkcs12-cert']);
  if (!browserPkcs12MimeTypes.has(mimeType)) {
    throw Object.assign(new Error('O navegador informou um tipo de arquivo incompatível com PKCS#12.'), { status: 400, code: 'INVALID_CERTIFICATE_MIME' });
  }
  const certificateBase64 = String(body?.certificateBase64 || '').replace(/^data:.*?;base64,/, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(certificateBase64)) throw Object.assign(new Error('Conteúdo Base64 inválido.'), { status: 400 });
  const buffer = Buffer.from(certificateBase64, 'base64');
  if (buffer.length > 5 * 1024 * 1024) throw Object.assign(new Error('Arquivo acima do limite de 5 MB.'), { status: 413 });
  return { fileName, buffer, password: String(body?.password || '') };
}

app.get('/health', (_req, res) => res.status(200).json({ success: true, service: 'meu-mundo-fiscal', phase: 1, status: 'online', timestamp: new Date().toISOString() }));
app.get('/api/fiscal/environment', protect, (req: any, res) => {
  const environment = getFiscalEnvironment();
  res.json({ success: true, data: { ...environment, companyId: req.fiscal.companyId, productionBlocked: environment.environment !== 'producao', transmissionEnabled: environment.environment === 'producao' && environment.productionEnabled } });
});

app.post('/api/fiscal/certificate/validate', protect, async (req: any, res, next) => {
  const requestId = randomBytes(8).toString('hex');
  let stage = 'receive_request';
  let receivedBytes = 0;
  const safeRequest = {
    requestId,
    endpoint: '/api/fiscal/certificate/validate',
    method: req.method,
    mimeType: typeof req.body?.mimeType === 'string' ? req.body.mimeType : undefined,
    certificatePayloadPresent: typeof req.body?.certificateBase64 === 'string' && req.body.certificateBase64.length > 0,
    passwordPresent: typeof req.body?.password === 'string' && req.body.password.length > 0,
  };
  try {
  stage = 'decode_pkcs12';
  const input = readCertificate(req.body); receivedBytes = input.buffer.length;
  stage = 'open_pkcs12';
  const parsed = parsePkcs12(input.buffer, input.password, String(req.body?.expectedCnpj || ''));
  stage = 'persist_private_certificate';
  const root = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private'); const companyDir = resolve(root, req.fiscal.companyId, 'certificates');
  if (!companyDir.startsWith(`${root}${sep}`)) throw new Error('Caminho privado inválido.');
  await mkdir(companyDir, { recursive: true, mode: 0o700 }); const path = resolve(companyDir, 'active.pfx'); await writeFile(path, input.buffer, { mode: 0o600 }); await chmod(path, 0o600);
  stage = 'persist_certificate_metadata';
  await req.fiscal.db.collection('companies').doc(req.fiscal.companyId).collection('fiscal').doc('certificate').set({ ...parsed.metadata, storageReference: 'private://active-certificate', updatedBy: req.fiscal.decoded.uid, updatedAt: FieldValue.serverTimestamp() });
  stage = 'write_audit';
  await writeFiscalAudit(req.fiscal.db, req.fiscal.companyId, req.fiscal.decoded.uid, 'certificate_validated', { serialNumberMasked: parsed.metadata.serialNumberMasked, validTo: parsed.metadata.validTo, cnpj: parsed.metadata.cnpj, chainValid: parsed.metadata.chain.valid });
  console.info('[FISCAL CERTIFICATE VALIDATION]', { ...safeRequest, status: 200, stage: 'complete', receivedBytes, pkcs12Opened: true });
  res.json({ success: true, data: parsed.metadata });
  } catch (error) {
    console.error('[FISCAL CERTIFICATE VALIDATION]', { ...safeRequest, status: Number((error as any)?.status || 500), stage, receivedBytes, pkcs12Opened: stage !== 'decode_pkcs12' && stage !== 'open_pkcs12', code: (error as any)?.code, message: error instanceof Error ? error.message : 'unknown' });
    next(error);
  }
});

app.post('/api/fiscal/mtls/test', protect, async (req: any, res, next) => { try {
  const input = readCertificate(req.body); const parsed = parsePkcs12(input.buffer, input.password, String(req.body?.expectedCnpj || '')); const environment = getFiscalEnvironment();
  const result = await testMtlsConnection(environment.baseUrl, { pfx: parsed.pfx, passphrase: parsed.passphrase }, Math.min(Math.max(Number(req.body?.timeoutMs || 15000), 1000), 30000));
  await writeFiscalAudit(req.fiscal.db, req.fiscal.companyId, req.fiscal.decoded.uid, 'mtls_test', { accepted: result.accepted, statusCode: result.statusCode, elapsedMs: result.elapsedMs });
  res.json({ success: true, data: result });
} catch (error) { next(error); } });

app.post('/api/fiscal/xml/validate', protect, async (req: any, res, next) => { try {
  const environment = getFiscalEnvironment(); const xml = String(req.body?.xml || ''); const result = await validateXmlAgainstXsd(xml, environment.xsdVersion, String(req.body?.schemaFile || 'DPS_v1.01.xsd'));
  await writeFiscalAudit(req.fiscal.db, req.fiscal.companyId, req.fiscal.decoded.uid, 'xml_validation', { valid: result.valid, errorCount: result.errors.length, schemaFile: req.body?.schemaFile || 'DPS_v1.01.xsd' });
  res.status(result.valid ? 200 : 422).json({ success: result.valid, data: result });
} catch (error) { next(error); } });

app.post('/api/fiscal/xml/sign-test', protect, async (req: any, res, next) => { try {
  const input = readCertificate(req.body); const parsed = parsePkcs12(input.buffer, input.password, String(req.body?.expectedCnpj || ''));
  const built = req.body?.dpsData ? buildMinimalCuritibaDps({ ...req.body.dpsData, cnpj: parsed.metadata.cnpj || req.body.dpsData.cnpj }) : null;
  const xml = built?.xml || String(req.body?.xml || '');
  const environment = getFiscalEnvironment();
  const before = await validateXmlAgainstXsd(xml, environment.xsdVersion, 'DPS_v1.01.xsd');
  if (!before.valid) return res.status(422).json({ success: false, code: 'DPS_XSD_INVALID_BEFORE_SIGNATURE', error: 'DPS local inválida antes da assinatura.', data: { errors: before.errors } });
  const signed = signXmlForLocalTest(xml, parsed.privateKeyPem, parsed.certificatePem, built?.id || String(req.body?.elementId || ''));
  const after = await validateXmlAgainstXsd(signed.signedXml, environment.xsdVersion, 'DPS_v1.01.xsd');
  const compressed = xmlToGzipBuffer(signed.signedXml); const base64 = gzipBufferToBase64(compressed); const recovered = gzipBufferToXml(base64ToGzipBuffer(base64));
  const roundTrip = recovered === signed.signedXml;
  await writeFiscalAudit(req.fiscal.db, req.fiscal.companyId, req.fiscal.decoded.uid, 'xml_sign_test', { verified: signed.verified, roundTrip, compressedBytes: compressed.length });
  const data = { dpsId: built?.id || null, xsdValidBeforeSignature: before.valid, xsdValidAfterSignature: after.valid, signatureVerified: signed.verified, gzipBase64RoundTrip: roundTrip, signedXmlSha256Available: true, compressedBytes: compressed.length, transmitted: false };
  if (!after.valid) return res.status(422).json({ success: false, code: 'DPS_XSD_INVALID_AFTER_SIGNATURE', error: 'DPS assinada inválida conforme o XSD oficial.', data: { ...data, errors: after.errors } });
  if (!signed.verified) return res.status(422).json({ success: false, code: 'XML_SIGNATURE_INVALID', error: 'A assinatura XMLDSig não pôde ser verificada.', data });
  if (!roundTrip) return res.status(422).json({ success: false, code: 'GZIP_BASE64_ROUNDTRIP_FAILED', error: 'Falha no teste local de compactação GZip/Base64.', data });
  res.json({ success: true, data });
} catch (error) { next(error); } });

app.post('/api/fiscal/phase2/discover-contract', protect, async (req: any, res, next) => { try {
  const input = readCertificate(req.body); const parsed = parsePkcs12(input.buffer, input.password, String(req.body?.expectedCnpj || '')); const environment = getFiscalEnvironment();
  const contract = await discoverRestrictedSefinContract(environment.baseUrl, { pfx: parsed.pfx, passphrase: parsed.passphrase });
  await writeFiscalAudit(req.fiscal.db, req.fiscal.companyId, req.fiscal.decoded.uid, 'phase2_contract_discovered', { endpoint: contract.endpoint, method: contract.method, contentType: contract.contentType, payloadProperties: contract.payloadProperties, transmissionPerformed: false });
  res.json({ success: true, data: contract });
} catch (error) { next(error); } });

app.post('/api/fiscal/nfse/prepare-final-test', protect, async (req: any, res, next) => { try {
  const environment = getFiscalEnvironment();
  if (environment.productionEnabled || process.env.FISCAL_PRODUCTION_ENABLED === 'true' || environment.baseUrl !== 'https://sefin.producaorestrita.nfse.gov.br') {
    throw Object.assign(new Error('Preparacao permitida somente na Producao Restrita.'), { code: 'RESTRICTED_ONLY' });
  }
  const input = readCertificate(req.body);
  const parsed = parsePkcs12(input.buffer, input.password, String(req.body?.expectedCnpj || ''));
  const built = buildMinimalCuritibaDps({ ...req.body.dpsData, cnpj: parsed.metadata.cnpj || req.body?.dpsData?.cnpj });
  if (!built.xml.includes('<toma>') || !built.xml.includes('<CNPJ>48088816000145</CNPJ>')) {
    return res.status(422).json({ success: false, code: 'TAKER_NOT_IN_DPS', error: 'Tomador obrigatorio nao foi incorporado a DPS.' });
  }
  const before = await validateXmlAgainstXsd(built.xml, environment.xsdVersion, 'DPS_v1.01.xsd');
  if (!before.valid) return res.status(422).json({ success: false, code: 'DPS_XSD_INVALID_BEFORE_SIGNATURE', error: 'DPS invalida antes da assinatura.', data: { errors: before.errors } });
  const signed = signXmlForLocalTest(built.xml, parsed.privateKeyPem, parsed.certificatePem, built.id);
  const after = await validateXmlAgainstXsd(signed.signedXml, environment.xsdVersion, 'DPS_v1.01.xsd');
  const contract = { endpoint: RESTRICTED_NFSE_ENDPOINT, method: 'POST', contentType: 'application/json', payloadProperties: ['dpsXmlGZipB64'], requiredProperties: ['dpsXmlGZipB64'] };
  const prepared = prepareRestrictedNfseRequest(contract, signed.signedXml);
  if (!after.valid || !signed.verified) return res.status(422).json({ success: false, code: 'SIGNED_DPS_INVALID', error: 'DPS assinada invalida.', data: { errors: after.errors } });
  res.json({ success: true, data: { dpsId: built.id, takerCnpj: '48088816000145', takerIncluded: true, xsdBefore: true, signatureVerified: true, xsdAfter: true, gzipBase64Ready: typeof prepared.body.dpsXmlGZipB64 === 'string', endpoint: prepared.endpoint, transmitted: false } });
} catch (error) { next(error); } });

app.post('/api/fiscal/nfse/issue-restricted', protect, async (req: any, res, next) => { try {
  const environment = getFiscalEnvironment();
  const isProduction = environment.environment === 'producao';
  const endpoint = isProduction ? PRODUCTION_NFSE_ENDPOINT : RESTRICTED_NFSE_ENDPOINT;
  if (isProduction && (!environment.productionEnabled || environment.baseUrl !== 'https://sefin.nfse.gov.br')) throw Object.assign(new Error('Produção Real não autorizada.'), { code: 'PRODUCTION_NOT_AUTHORIZED' });
  if (!isProduction && environment.baseUrl !== 'https://sefin.producaorestrita.nfse.gov.br') throw Object.assign(new Error('Produção Restrita inválida.'), { code: 'RESTRICTED_HOST_INVALID' });
  if (req.body?.generateBoleto === true) {
    return res.status(422).json({ success: false, code: 'BOLETO_NOT_ALLOWED', error: 'A emissão fiscal não permite geração automática de boleto.' });
  }

  const input = readCertificate(req.body);
  const parsed = parsePkcs12(input.buffer, input.password, String(req.body?.expectedCnpj || ''));
  const environmentKey = isProduction ? 'producao' : 'producao_restrita';
  const series = String(req.body?.dpsData?.series || '1').replace(/\D/g, '').slice(0, 5) || '1';
  const issuanceCollection = req.fiscal.db.collection('companies').doc(req.fiscal.companyId).collection('fiscal_nfse_issuance_requests');
  const previousIssues = await issuanceCollection.where('environment', '==', environmentKey).get();
  const previousMaximum = previousIssues.docs.reduce((maximum: number, snapshot: any) => {
    const id = String(snapshot.data()?.dpsId || '');
    const number = Number(id.match(/(\d{15})$/)?.[1] || 0);
    return Number.isSafeInteger(number) ? Math.max(maximum, number) : maximum;
  }, 0);
  const sequenceRef = req.fiscal.db.collection('companies').doc(req.fiscal.companyId).collection('fiscal_counters').doc(`dps_${environmentKey}_serie_${series}`);
  const dpsNumber = await req.fiscal.db.runTransaction(async (transaction: any) => {
    const sequence = await transaction.get(sequenceRef);
    const storedNext = Number(sequence.data()?.nextNumber || 0);
    const nextNumber = Math.max(storedNext, previousMaximum + 1, 1);
    transaction.set(sequenceRef, { environment: environmentKey, series, lastNumber: nextNumber, nextNumber: nextNumber + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return String(nextNumber);
  });
  const built = buildMinimalCuritibaDps({
    ...req.body.dpsData,
    series,
    number: dpsNumber,
    environmentType: isProduction ? '1' : '2',
    cnpj: parsed.metadata.cnpj || req.body?.dpsData?.cnpj,
    cncAllowsMunicipalRegistration: false,
  });
  const requestedTakerCnpj = String(req.body?.dpsData?.taker?.cnpj || '').replace(/\D/g, '');
  if (requestedTakerCnpj.length !== 14 || !built.xml.includes('<toma>') || !built.xml.includes(`<CNPJ>${requestedTakerCnpj}</CNPJ>`)) {
    return res.status(422).json({ success: false, code: 'TAKER_NOT_IN_DPS', error: 'O CNPJ do tomador solicitado não foi incorporado corretamente à DPS.' });
  }
  const prestadorXml = built.xml.match(/<(?:\w+:)?prest(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?prest>/)?.[1] || '';
  if (/<(?:\w+:)?IM(?:\s|>)/.test(prestadorXml) || /<(?:\w+:)?xNome(?:\s|>)/.test(prestadorXml)) {
    return res.status(422).json({ success: false, code: 'APPROVED_PRESTADOR_RULES_DIVERGENT', error: 'As correções E0120/E0121 não foram preservadas.' });
  }
  if (!built.xml.includes('<opSimpNac>3</opSimpNac>') || !built.xml.includes('<regApTribSN>1</regApTribSN>') || built.xml.includes('<indTotTrib>')) {
    return res.status(422).json({ success: false, code: 'APPROVED_TAX_RULES_DIVERGENT', error: 'As regras fiscais já aprovadas não foram preservadas.' });
  }

  const before = await validateXmlAgainstXsd(built.xml, environment.xsdVersion, 'DPS_v1.01.xsd');
  if (!before.valid) {
    console.error('[Fiscal NFS-e] DPS XSD validation failed', before.errors);
    return res.status(422).json({ success: false, code: 'DPS_XSD_INVALID', error: 'DPS inválida antes da assinatura.', data: { errors: before.errors } });
  }
  const signed = signXmlForLocalTest(built.xml, parsed.privateKeyPem, parsed.certificatePem, built.id);
  const after = await validateXmlAgainstXsd(signed.signedXml, environment.xsdVersion, 'DPS_v1.01.xsd');
  if (!signed.verified || !after.valid) return res.status(422).json({ success: false, code: 'SIGNED_DPS_INVALID', error: 'DPS assinada inválida.', data: { signatureVerified: signed.verified, errors: after.errors } });

  const prepared = prepareNfseRequest(endpoint, signed.signedXml);
  const issueRef = req.fiscal.db.collection('companies').doc(req.fiscal.companyId).collection('fiscal_nfse_issuance_requests').doc(`${environmentKey}_${built.id}`);
  try {
    await issueRef.create({ status: 'transmitting', environment: environmentKey, dpsId: built.id, endpoint, createdBy: req.fiscal.decoded.uid, createdAt: FieldValue.serverTimestamp(), requestSha256: createHash('sha256').update(JSON.stringify(prepared.body)).digest('hex'), boletoGenerated: false });
  } catch (error: any) {
    if (error?.code === 6 || String(error?.message || '').toLowerCase().includes('already exists')) {
      return res.status(409).json({ success: false, code: 'DUPLICATE_DPS', error: 'Esta DPS já foi transmitida ou está em processamento.' });
    }
    throw error;
  }

  let response;
  try {
    response = await transmitPreparedNfse(prepared, { pfx: parsed.pfx, passphrase: parsed.passphrase });
  } catch (error) {
    await issueRef.set({ status: 'unknown', transportError: error instanceof Error ? error.message : 'Falha de transporte', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }

  const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private');
  const issueDir = resolve(privateRoot, req.fiscal.companyId, 'nfse-issues', built.id);
  if (!issueDir.startsWith(`${privateRoot}${sep}`)) throw new Error('Caminho fiscal privado inválido.');
  await mkdir(issueDir, { recursive: true, mode: 0o700 });
  await writeFile(resolve(issueDir, 'response.json'), response.body, { mode: 0o600 });
  let payload: any = null;
  try { payload = JSON.parse(response.body.toString('utf8')); } catch { payload = null; }
  const firstError = Array.isArray(payload?.erros) ? payload.erros[0] : null;
  const nfseCompressed = typeof payload?.nfseXmlGZipB64 === 'string' ? payload.nfseXmlGZipB64 : null;
  let authorizedXml: string | null = null;
  if (nfseCompressed) {
    authorizedXml = gzipBufferToXml(base64ToGzipBuffer(nfseCompressed));
    await writeFile(resolve(issueDir, 'nfse-autorizada.xml'), authorizedXml, { mode: 0o600 });
  }
  const authorized = response.statusCode >= 200 && response.statusCode < 300 && !!(payload?.chaveAcesso || authorizedXml);
  const parsedNfse = authorizedXml ? parseAuthorizedNfseXml(authorizedXml) : null;
  const summary = {
    environment: environmentKey, endpoint, dpsId: built.id,
    httpStatus: response.statusCode, result: authorized ? 'AUTORIZADA' : 'REJEITADA',
    code: firstError?.Codigo || firstError?.codigo || null,
    message: firstError?.Descricao || firstError?.descricao || (authorized ? `NFS-e autorizada em ${isProduction ? 'Produção Real' : 'Produção Restrita'}.` : 'SEFIN rejeitou ou não autorizou a DPS.'),
    nfseNumber: payload?.numero || payload?.numeroNfse || payload?.nNFSe || parsedNfse?.nfseNumber || null,
    accessKey: payload?.chaveAcesso || null, protocol: payload?.protocolo || payload?.idDps || payload?.idDPS || null,
    xmlStored: !!authorizedXml, danfseAvailable: !!authorizedXml, boletoGenerated: false,
  };
  await issueRef.set({ ...summary, status: authorized ? 'authorized' : 'rejected', responsePath: `private://nfse-issues/${built.id}/response.json`, xmlPath: authorizedXml ? `private://nfse-issues/${built.id}/nfse-autorizada.xml` : null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (authorized && authorizedXml && summary.accessKey) {
    await persistAuthorizedNfse({ db: req.fiscal.db, companyId: req.fiscal.companyId, uid: req.fiscal.decoded.uid, accessKey: summary.accessKey, dpsId: summary.protocol, xml: authorizedXml, xmlPath: `private://nfse-issues/${built.id}/nfse-autorizada.xml`, responsePath: `private://nfse-issues/${built.id}/response.json`, httpStatus: response.statusCode, environment: environmentKey, clientId: String(req.body?.clientId || ''), clientName: String(req.body?.clientName || '') });
    const recurringBillingId = String(req.body?.recurringBillingId || '');
    if (recurringBillingId) await req.fiscal.db.collection('faturamentos_recorrentes').doc(recurringBillingId).set({ status: 'AUTORIZADA', nfseNumber: summary.nfseNumber, dpsNumber: built.id, officialAccessKey: summary.accessKey, authorizedAt: FieldValue.serverTimestamp(), authorizedXml: `private://nfse-issues/${built.id}/nfse-autorizada.xml`, danfseReference: summary.accessKey, environment: environmentKey, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  await writeFiscalAudit(req.fiscal.db, req.fiscal.companyId, req.fiscal.decoded.uid, isProduction ? 'nfse_production_issued_from_form' : 'nfse_restricted_issued_from_form', summary);
  return res.status(authorized ? response.statusCode : 422).json({ success: authorized, data: summary, ...(authorized ? {} : { code: summary.code || 'SEFIN_REJECTED', error: summary.message }) });
} catch (error) { next(error); } });

app.post('/api/fiscal/phase3/transmit-first-restricted', protect, async (req: any, res, next) => { try {
  const environment = getFiscalEnvironment();
  if (environment.productionEnabled || process.env.FISCAL_PRODUCTION_ENABLED === 'true' || environment.baseUrl !== 'https://sefin.producaorestrita.nfse.gov.br') {
    throw Object.assign(new Error('Primeira transmissão permitida somente na Produção Restrita.'), { code: 'PHASE3_RESTRICTED_ONLY' });
  }
  const attempts = req.fiscal.db.collection('companies').doc(req.fiscal.companyId).collection('fiscal_phase3_attempts');
  const firstAttempt = await attempts.doc('first-restricted').get();
  const firstAttemptData = firstAttempt.data();
  let firstAttemptCode = firstAttemptData?.code || null;
  if (firstAttempt.exists && !firstAttemptCode) {
    const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private');
    const firstResponsePath = resolve(privateRoot, req.fiscal.companyId, 'phase3', 'first-restricted', 'response.json');
    if (!firstResponsePath.startsWith(`${privateRoot}${sep}`)) throw new Error('Caminho fiscal privado inválido.');
    try {
      const firstResponse = JSON.parse(await readFile(firstResponsePath, 'utf8'));
      const firstError = Array.isArray(firstResponse?.erros) ? firstResponse.erros[0] : null;
      firstAttemptCode = firstError?.Codigo || firstError?.codigo || null;
    } catch {
      firstAttemptCode = null;
    }
  }
  const isAuthorizedSecondAttempt = firstAttempt.exists && firstAttemptCode === 'E0120';
  if (firstAttempt.exists && !isAuthorizedSecondAttempt) {
    return res.status(409).json({ success: false, code: 'PHASE3_RETRY_NOT_ALLOWED', error: 'Uma nova transmissão não está autorizada para o resultado anterior.' });
  }
  const secondAttempt = await attempts.doc('second-restricted').get();
  const secondAttemptData = secondAttempt.data();
  let secondAttemptCode = secondAttemptData?.code || null;
  if (secondAttempt.exists && !secondAttemptCode) {
    const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private');
    const secondResponsePath = resolve(privateRoot, req.fiscal.companyId, 'phase3', 'second-restricted', 'response.json');
    if (!secondResponsePath.startsWith(`${privateRoot}${sep}`)) throw new Error('Caminho fiscal privado inválido.');
    try {
      const secondResponse = JSON.parse(await readFile(secondResponsePath, 'utf8'));
      const secondError = Array.isArray(secondResponse?.erros) ? secondResponse.erros[0] : null;
      secondAttemptCode = secondError?.Codigo || secondError?.codigo || null;
    } catch {
      secondAttemptCode = null;
    }
  }
  const isAuthorizedThirdAttempt = isAuthorizedSecondAttempt && secondAttempt.exists && secondAttemptCode === 'E0121';
  if (secondAttempt.exists && !isAuthorizedThirdAttempt) {
    return res.status(409).json({ success: false, code: 'PHASE3_THIRD_ATTEMPT_NOT_ALLOWED', error: 'A terceira transmissão exige uma segunda rejeição E0121 registrada.' });
  }
  const thirdAttempt = await attempts.doc('third-restricted').get();
  const thirdAttemptData = thirdAttempt.data();
  let thirdAttemptCode = thirdAttemptData?.code || null;
  if (thirdAttempt.exists && !thirdAttemptCode) {
    const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private');
    const thirdResponsePath = resolve(privateRoot, req.fiscal.companyId, 'phase3', 'third-restricted', 'response.json');
    if (!thirdResponsePath.startsWith(`${privateRoot}${sep}`)) throw new Error('Caminho fiscal privado inválido.');
    try {
      const thirdResponse = JSON.parse(await readFile(thirdResponsePath, 'utf8'));
      const thirdError = Array.isArray(thirdResponse?.erros) ? thirdResponse.erros[0] : null;
      thirdAttemptCode = thirdError?.Codigo || thirdError?.codigo || null;
    } catch {
      thirdAttemptCode = null;
    }
  }
  const isAuthorizedFourthAttempt = isAuthorizedThirdAttempt && thirdAttempt.exists && thirdAttemptCode === 'E0160';
  if (thirdAttempt.exists && !isAuthorizedFourthAttempt) {
    return res.status(409).json({ success: false, code: 'PHASE3_FOURTH_ATTEMPT_NOT_ALLOWED', error: 'A quarta transmissão exige uma terceira rejeição E0160 registrada.' });
  }
  const fourthAttempt = await attempts.doc('fourth-restricted').get();
  const fourthAttemptData = fourthAttempt.data();
  let fourthAttemptCode = fourthAttemptData?.code || null;
  if (fourthAttempt.exists && !fourthAttemptCode) {
    const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private');
    const fourthResponsePath = resolve(privateRoot, req.fiscal.companyId, 'phase3', 'fourth-restricted', 'response.json');
    if (!fourthResponsePath.startsWith(`${privateRoot}${sep}`)) throw new Error('Caminho fiscal privado inválido.');
    try {
      const fourthResponse = JSON.parse(await readFile(fourthResponsePath, 'utf8'));
      const fourthError = Array.isArray(fourthResponse?.erros) ? fourthResponse.erros[0] : null;
      fourthAttemptCode = fourthError?.Codigo || fourthError?.codigo || null;
    } catch {
      fourthAttemptCode = null;
    }
  }
  const isAuthorizedFifthAttempt = isAuthorizedFourthAttempt && fourthAttempt.exists && fourthAttemptCode === 'E0166';
  if (fourthAttempt.exists && !isAuthorizedFifthAttempt) {
    return res.status(409).json({ success: false, code: 'PHASE3_FIFTH_ATTEMPT_NOT_ALLOWED', error: 'A quinta transmissão exige uma quarta rejeição E0166 registrada.' });
  }
  const fifthAttempt = await attempts.doc('fifth-restricted').get();
  const fifthAttemptData = fifthAttempt.data();
  let fifthAttemptCode = fifthAttemptData?.code || null;
  if (fifthAttempt.exists && !fifthAttemptCode) {
    const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private');
    const fifthResponsePath = resolve(privateRoot, req.fiscal.companyId, 'phase3', 'fifth-restricted', 'response.json');
    if (!fifthResponsePath.startsWith(`${privateRoot}${sep}`)) throw new Error('Caminho fiscal privado inválido.');
    try {
      const fifthResponse = JSON.parse(await readFile(fifthResponsePath, 'utf8'));
      const fifthError = Array.isArray(fifthResponse?.erros) ? fifthResponse.erros[0] : null;
      fifthAttemptCode = fifthError?.Codigo || fifthError?.codigo || null;
    } catch {
      fifthAttemptCode = null;
    }
  }
  const isAuthorizedSixthAttempt = isAuthorizedFifthAttempt && fifthAttempt.exists && fifthAttemptCode === 'E0712';
  if (fifthAttempt.exists && !isAuthorizedSixthAttempt) {
    return res.status(409).json({ success: false, code: 'PHASE3_SIXTH_ATTEMPT_NOT_ALLOWED', error: 'A sexta transmissão exige uma quinta rejeição E0712 registrada.' });
  }
  const attemptNumber = isAuthorizedSixthAttempt ? 6 : isAuthorizedFifthAttempt ? 5 : isAuthorizedFourthAttempt ? 4 : isAuthorizedThirdAttempt ? 3 : isAuthorizedSecondAttempt ? 2 : 1;
  const attemptName = attemptNumber === 6 ? 'sixth-restricted' : attemptNumber === 5 ? 'fifth-restricted' : attemptNumber === 4 ? 'fourth-restricted' : attemptNumber === 3 ? 'third-restricted' : attemptNumber === 2 ? 'second-restricted' : 'first-restricted';
  const input = readCertificate(req.body);
  const parsed = parsePkcs12(input.buffer, input.password, String(req.body?.expectedCnpj || ''));
  const built = buildMinimalCuritibaDps({ ...req.body.dpsData, cnpj: parsed.metadata.cnpj || req.body?.dpsData?.cnpj, cncAllowsMunicipalRegistration: false });
  if (attemptNumber >= 2 && /<(?:\w+:)?IM(?:\s|>)/.test(built.xml)) {
    return res.status(422).json({ success: false, code: 'PHASE3_E0120_IM_STILL_PRESENT', error: 'A IM do prestador ainda está presente na DPS corrigida.' });
  }
  if (attemptNumber >= 3 && /<(?:\w+:)?xNome(?:\s|>)/.test(built.xml)) {
    return res.status(422).json({ success: false, code: 'PHASE3_E0121_NAME_STILL_PRESENT', error: 'A razão social do prestador ainda está presente na DPS corrigida.' });
  }
  if (attemptNumber >= 4 && (!built.xml.includes('<opSimpNac>3</opSimpNac>') || !built.xml.includes('<dCompet>2026-08-08</dCompet>') || !built.xml.includes('<regEspTrib>0</regEspTrib>'))) {
    return res.status(422).json({ success: false, code: 'PHASE3_E0160_VALUES_DIVERGENT', error: 'Os valores autorizados para a correção E0160 estão divergentes.' });
  }
  if (attemptNumber >= 5 && !built.xml.includes('<regApTribSN>1</regApTribSN>')) {
    return res.status(422).json({ success: false, code: 'PHASE3_E0166_REGIME_MISSING', error: 'O regime de apuração do Simples Nacional não corresponde à correção E0166.' });
  }
  if (attemptNumber >= 6 && (built.xml.includes('<indTotTrib>') || !built.xml.includes('<pTotTribSN>6.00</pTotTribSN>'))) {
    return res.status(422).json({ success: false, code: 'PHASE3_E0712_TOTAL_TAX_INDICATOR_PRESENT', error: 'O indicador proibido pelo E0712 ainda está presente ou o total do Simples está ausente.' });
  }
  const before = await validateXmlAgainstXsd(built.xml, environment.xsdVersion, 'DPS_v1.01.xsd');
  if (!before.valid) return res.status(422).json({ success: false, code: 'PHASE3_DPS_XSD_INVALID', error: 'DPS restrita inválida antes da assinatura.', data: { errors: before.errors } });
  const signed = signXmlForLocalTest(built.xml, parsed.privateKeyPem, parsed.certificatePem, built.id);
  const after = await validateXmlAgainstXsd(signed.signedXml, environment.xsdVersion, 'DPS_v1.01.xsd');
  if (!signed.verified || !after.valid) return res.status(422).json({ success: false, code: 'PHASE3_SIGNED_DPS_INVALID', error: 'DPS restrita inválida apó assinatura.', data: { signatureVerified: signed.verified, errors: after.errors } });
  if (attemptNumber >= 2 && /<(?:\w+:)?IM(?:\s|>)/.test(signed.signedXml)) {
    return res.status(422).json({ success: false, code: 'PHASE3_E0120_IM_STILL_PRESENT', error: 'A IM do prestador reapareceu no XML assinado.' });
  }
  if (attemptNumber >= 3 && /<(?:\w+:)?xNome(?:\s|>)/.test(signed.signedXml)) {
    return res.status(422).json({ success: false, code: 'PHASE3_E0121_NAME_STILL_PRESENT', error: 'A razão social do prestador reapareceu no XML assinado.' });
  }
  const contract = {
    endpoint: RESTRICTED_NFSE_ENDPOINT,
    method: 'POST',
    contentType: 'application/json',
    payloadProperties: ['dpsXmlGZipB64'],
    requiredProperties: ['dpsXmlGZipB64'],
  };
  const prepared = prepareRestrictedNfseRequest(contract, signed.signedXml);
  const attemptRef = attempts.doc(attemptName);
  try {
    await attemptRef.create({
      environment: 'producao_restrita', endpoint: RESTRICTED_NFSE_ENDPOINT, dpsId: built.id,
      status: 'transmitting', createdAt: FieldValue.serverTimestamp(), createdBy: req.fiscal.decoded.uid,
      requestSha256: createHash('sha256').update(JSON.stringify(prepared.body)).digest('hex'),
      attemptNumber,
      correction: attemptNumber === 6 ? 'E0712_OMIT_IND_TOT_TRIB_USE_P_TOT_TRIB_SN' : attemptNumber === 5 ? 'E0166_REG_AP_TRIB_SN_1' : attemptNumber === 4 ? 'E0160_CONFIRMED_SIMPLES_ME_EPP_COMPETENCE' : attemptNumber === 3 ? 'E0120_E0121_OMIT_PRESTADOR_IM_NAME' : attemptNumber === 2 ? 'E0120_OMIT_PRESTADOR_IM' : null,
      municipalRegistrationIncluded: false,
      prestadorNameIncluded: false,
    });
  } catch (error: any) {
    if (error?.code === 6 || String(error?.message || '').toLowerCase().includes('already exists')) {
      const ordinal = attemptNumber === 6 ? 'sexta' : attemptNumber === 5 ? 'quinta' : attemptNumber === 4 ? 'quarta' : attemptNumber === 3 ? 'terceira' : attemptNumber === 2 ? 'segunda' : 'primeira';
      return res.status(409).json({ success: false, code: `PHASE3_ATTEMPT_${attemptNumber}_ALREADY_USED`, error: `A ${ordinal} transmissão restrita já foi executada ou iniciada. Nenhuma nova tentativa automática foi feita.` });
    }
    throw error;
  }
  let response;
  try {
    response = await transmitPreparedRestrictedNfse(prepared, { pfx: parsed.pfx, passphrase: parsed.passphrase });
  } catch (error) {
    await attemptRef.set({ status: 'unknown', transportError: error instanceof Error ? error.message : 'Falha de transporte', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
  const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private');
  const attemptDir = resolve(privateRoot, req.fiscal.companyId, 'phase3', attemptName);
  if (!attemptDir.startsWith(`${privateRoot}${sep}`)) throw new Error('Caminho fiscal privado inválido.');
  await mkdir(attemptDir, { recursive: true, mode: 0o700 });
  await writeFile(resolve(attemptDir, 'response.json'), response.body, { mode: 0o600 });
  let payload: any = null;
  try { payload = JSON.parse(response.body.toString('utf8')); } catch { payload = null; }
  const errors = Array.isArray(payload?.erros) ? payload.erros : [];
  const firstError = errors[0] || null;
  const nfseCompressed = typeof payload?.nfseXmlGZipB64 === 'string' ? payload.nfseXmlGZipB64 : null;
  let xmlStored = false;
  let authorizedXml: string | null = null;
  if (nfseCompressed) {
    const xml = gzipBufferToXml(base64ToGzipBuffer(nfseCompressed));
    await writeFile(resolve(attemptDir, 'nfse-autorizada.xml'), xml, { mode: 0o600 });
    authorizedXml = xml;
    xmlStored = true;
  }
  const authorized = response.statusCode >= 200 && response.statusCode < 300 && !!(payload?.chaveAcesso || nfseCompressed);
  const parsedNfse = authorizedXml ? parseAuthorizedNfseXml(authorizedXml) : null;
  const summary = {
    environment: 'producao_restrita', endpoint: RESTRICTED_NFSE_ENDPOINT, dpsId: built.id,
    httpStatus: response.statusCode, contentType: response.contentType, elapsedMs: response.elapsedMs,
    result: authorized ? 'AUTORIZADA' : 'REJEITADA', code: firstError?.Codigo || firstError?.codigo || null,
    message: firstError?.Descricao || firstError?.descricao || (authorized ? 'NFS-e autorizada em Produção Restrita.' : 'SEFIN rejeitou ou não autorizou a DPS.'),
    nfseNumber: payload?.numero || payload?.numeroNfse || payload?.nNFSe || parsedNfse?.nfseNumber || null,
    accessKey: payload?.chaveAcesso || null, protocol: payload?.protocolo || payload?.idDps || payload?.idDPS || null,
    xmlStored, responseStored: true, attemptNumber, municipalRegistrationIncluded: false, prestadorNameIncluded: false,
  };
  await attemptRef.set({ ...summary, status: authorized ? 'authorized' : 'rejected', responsePath: `private://phase3/${attemptName}/response.json`, xmlPath: xmlStored ? `private://phase3/${attemptName}/nfse-autorizada.xml` : null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (authorized && authorizedXml && summary.accessKey) {
    await persistAuthorizedNfse({ db: req.fiscal.db, companyId: req.fiscal.companyId, uid: req.fiscal.decoded.uid, accessKey: summary.accessKey, dpsId: summary.protocol, xml: authorizedXml, xmlPath: `private://phase3/${attemptName}/nfse-autorizada.xml`, responsePath: `private://phase3/${attemptName}/response.json`, httpStatus: response.statusCode });
  }
  await writeFiscalAudit(req.fiscal.db, req.fiscal.companyId, req.fiscal.decoded.uid, `phase3_attempt_${attemptNumber}_restricted_transmission`, summary);
  res.status(authorized ? 200 : 422).json({ success: authorized, data: summary, ...(authorized ? {} : { code: summary.code || 'SEFIN_REJECTED', error: summary.message }) });
} catch (error) { next(error); } });

app.post('/api/fiscal/nfse/reconcile-authorized', protect, async (req: any, res, next) => { try {
  const attemptName = 'sixth-restricted';
  const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private');
  const attemptDir = resolve(privateRoot, req.fiscal.companyId, 'phase3', attemptName);
  if (!attemptDir.startsWith(`${privateRoot}${sep}`)) throw new Error('Caminho fiscal privado inválido.');
  const responsePayload = JSON.parse(await readFile(resolve(attemptDir, 'response.json'), 'utf8'));
  const accessKey = String(req.body?.accessKey || responsePayload?.chaveAcesso || '');
  if (!/^\d{50}$/.test(accessKey)) return res.status(400).json({ success: false, code: 'INVALID_NFSE_ACCESS_KEY', error: 'Chave de acesso da NFS-e inválida.' });
  if (responsePayload?.chaveAcesso !== accessKey) return res.status(404).json({ success: false, code: 'AUTHORIZED_NFSE_NOT_FOUND', error: 'NFS-e autorizada não encontrada para esta empresa.' });
  const xml = await readFile(resolve(attemptDir, 'nfse-autorizada.xml'), 'utf8');
  const record = await persistAuthorizedNfse({ db: req.fiscal.db, companyId: req.fiscal.companyId, uid: req.fiscal.decoded.uid, accessKey, dpsId: responsePayload?.idDps || null, xml, xmlPath: `private://phase3/${attemptName}/nfse-autorizada.xml`, responsePath: `private://phase3/${attemptName}/response.json`, httpStatus: 201 });
  await writeFiscalAudit(req.fiscal.db, req.fiscal.companyId, req.fiscal.decoded.uid, 'authorized_nfse_reconciled', { accessKey, nfseNumber: record.nfseNumber, newTransmission: false });
  res.json({ success: true, data: { accessKey, nfseNumber: record.nfseNumber, xmlAvailable: true, danfseAvailable: true, newTransmission: false } });
} catch (error) { next(error); } });

app.get('/api/fiscal/nfse/authorized/:accessKey/xml', protect, async (req: any, res, next) => { try {
  const accessKey = String(req.params.accessKey || '');
  if (!/^\d{50}$/.test(accessKey)) return res.status(400).json({ success: false, code: 'INVALID_NFSE_ACCESS_KEY', error: 'Chave de acesso inválida.' });
  const record = await req.fiscal.db.collection('notas_fiscais_servico').doc(accessKey).get();
  if (!record.exists || record.data()?.companyId !== req.fiscal.companyId) return res.status(404).json({ success: false, code: 'AUTHORIZED_NFSE_NOT_FOUND', error: 'NFS-e não encontrada.' });
  const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private');
  const storedXmlPath = String(record.data()?.xmlPath || '');
  if (!storedXmlPath.startsWith('private://')) throw new Error('Caminho do XML autorizado não registrado.');
  const companyRoot = resolve(privateRoot, req.fiscal.companyId);
  const xmlPath = resolve(companyRoot, storedXmlPath.slice('private://'.length));
  if (!xmlPath.startsWith(`${companyRoot}${sep}`)) throw new Error('Caminho fiscal privado inválido.');
  const xml = await readFile(xmlPath, 'utf8');
  console.log('[Fiscal Download] XML autorizado preparado', { accessKey: accessKey.slice(-8), bytes: Buffer.byteLength(xml) });
  const fileName = `NFSe-${record.data()?.numeroNota || 'autorizada'}-${accessKey.slice(-8)}.xml`;
  res.json({ success: true, data: { fileName, mimeType: 'application/xml', downloadUrl: createFiscalDownload(Buffer.from(xml, 'utf8'), 'application/xml', fileName) } });
} catch (error) { next(error); } });

app.get('/api/fiscal/nfse/authorized/:accessKey/danfse-v2', protect, async (req: any, res, next) => { try {
  const accessKey = String(req.params.accessKey || '');
  if (!/^\d{50}$/.test(accessKey)) return res.status(400).json({ success: false, code: 'INVALID_NFSE_ACCESS_KEY', error: 'Chave de acesso inválida.' });
  const record = await req.fiscal.db.collection('notas_fiscais_servico').doc(accessKey).get();
  if (!record.exists || record.data()?.companyId !== req.fiscal.companyId) return res.status(404).json({ success: false, code: 'AUTHORIZED_NFSE_NOT_FOUND', error: 'NFS-e não encontrada.' });
  if (!['AUTORIZADA', 'Autorizada'].includes(String(record.data()?.status || ''))) return res.status(409).json({ success: false, code: 'NFSE_NOT_AUTHORIZED', error: 'O DANFSe somente pode ser gerado para NFS-e autorizada.' });
  const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private');
  const storedXmlPath = String(record.data()?.xmlPath || '');
  if (!storedXmlPath.startsWith('private://')) throw new Error('Caminho do XML autorizado não registrado.');
  const companyRoot = resolve(privateRoot, req.fiscal.companyId);
  const xmlPath = resolve(companyRoot, storedXmlPath.slice('private://'.length));
  if (!xmlPath.startsWith(`${companyRoot}${sep}`)) throw new Error('Caminho fiscal privado inválido.');
  const xml = await readFile(xmlPath, 'utf8');
  const pdf = await generateDanfseV2FromAuthorizedXml(xml, accessKey);
  const fileName = `DANFSe-${record.data()?.numeroNota || 'autorizada'}-${accessKey.slice(-8)}.pdf`;
  await writeFiscalAudit(req.fiscal.db, req.fiscal.companyId, req.fiscal.decoded.uid, 'danfse_v2_generated_from_authorized_xml', { accessKeySuffix: accessKey.slice(-8), nfseNumber: record.data()?.numeroNota || null, layoutVersion: DANFSE_LAYOUT_VERSION, bytes: pdf.length });
  res.json({ success: true, data: { fileName, mimeType: 'application/pdf', downloadUrl: createFiscalDownload(pdf, 'application/pdf', fileName), layoutVersion: DANFSE_LAYOUT_VERSION, source: 'authorized_xml', officialStandard: true } });
} catch (error) { next(error); } });

app.post('/api/fiscal/nfse/authorized/:accessKey/cancellation/prepare', protect, async (req: any, res, next) => { try {
  const accessKey = String(req.params.accessKey || '');
  if (!/^\d{50}$/.test(accessKey)) return res.status(400).json({ success: false, code: 'INVALID_NFSE_ACCESS_KEY', error: 'Chave de acesso inválida.' });
  const environment = getFiscalEnvironment();
  if (environment.environment !== 'producao' || environment.baseUrl !== 'https://sefin.nfse.gov.br') {
    return res.status(409).json({ success: false, code: 'PRODUCTION_CANCELLATION_REQUIRES_REAL_ENVIRONMENT', error: 'A preparação solicitada exige o ambiente de Produção Real.' });
  }
  const noteRef = req.fiscal.db.collection('notas_fiscais_servico').doc(accessKey);
  const note = await noteRef.get();
  const noteData = note.data() || {};
  if (!note.exists || noteData.companyId !== req.fiscal.companyId) return res.status(404).json({ success: false, code: 'AUTHORIZED_NFSE_NOT_FOUND', error: 'NFS-e autorizada não encontrada.' });
  if (noteData.environment !== 'producao') return res.status(409).json({ success: false, code: 'NOT_PRODUCTION_NFSE', error: 'A NFS-e informada não pertence à Produção Real.' });
  if (!['AUTORIZADA', 'Autorizada'].includes(String(noteData.status || ''))) return res.status(409).json({ success: false, code: 'NFSE_NOT_AUTHORIZED', error: 'Somente NFS-e autorizada pode iniciar o cancelamento.' });
  const cancellationRef = req.fiscal.db.collection('companies').doc(req.fiscal.companyId).collection('fiscal_nfse_cancellation_requests').doc(accessKey);
  const existing = await cancellationRef.get();
  const existingData = existing.data() || {};
  const reconciliationHttp = existingData.reconciliationHttp || {};
  const noteConsultStatus = Number(reconciliationHttp.nfse?.statusCode || reconciliationHttp.nfse || 0);
  const directEventStatus = Number(reconciliationHttp.cancellationEvent?.statusCode || reconciliationHttp.cancellationEvent || 0);
  const genericEventsStatus = Number(reconciliationHttp.allEvents?.statusCode || reconciliationHttp.events?.statusCode || reconciliationHttp.allEvents || reconciliationHttp.events || 0);
  const officiallyAuthorizedWithoutCancellation = noteConsultStatus === 200
    && directEventStatus === 404
    && [200, 404, 503].includes(genericEventsStatus);
  if (['transmitting', 'unknown', 'registered', 'cancelled'].includes(String(existingData.status || '')) && !officiallyAuthorizedWithoutCancellation) {
    return res.status(409).json({ success: false, code: 'CANCELLATION_ALREADY_STARTED', error: 'Já existe cancelamento iniciado para esta NFS-e. Consulte a situação oficial antes de qualquer nova tentativa.' });
  }
  const input = readCertificate(req.body);
  const parsed = parsePkcs12(input.buffer, input.password, String(req.body?.expectedCnpj || ''));
  const prepared = await prepareCancellationEvent({
    accessKey,
    authorCnpj: parsed.metadata.cnpj || String(req.body?.expectedCnpj || ''),
    environmentType: '1',
    reasonCode: String(req.body?.reasonCode || '') as '1' | '2' | '9',
    reason: String(req.body?.reason || ''),
  }, { privateKeyPem: parsed.privateKeyPem, certificatePem: parsed.certificatePem }, environment.xsdVersion);
  if (!prepared.valid) return res.status(422).json({ success: false, code: 'CANCELLATION_EVENT_INVALID', error: 'Evento de cancelamento inválido.', data: { stage: prepared.stage, errors: prepared.errors } });
  const endpoint = PRODUCTION_EVENTS_ENDPOINT_TEMPLATE.replace('{chaveAcesso}', accessKey);
  await cancellationRef.set({
    accessKey,
    nfseNumber: noteData.numeroNota || noteData.invoiceNumber || null,
    status: 'validated_not_transmitted',
    eventCode: prepared.eventCode,
    eventSequence: prepared.eventSequence,
    eventId: prepared.id,
    reasonCode: String(req.body?.reasonCode || ''),
    reason: String(req.body?.reason || '').trim(),
    endpoint,
    environment: 'producao',
    requestSha256: createHash('sha256').update(prepared.payloadSha256Source).digest('hex'),
    preparedBy: req.fiscal.decoded.uid,
    preparedAt: FieldValue.serverTimestamp(),
    transmitted: false,
  }, { merge: true });
  await writeFiscalAudit(req.fiscal.db, req.fiscal.companyId, req.fiscal.decoded.uid, 'nfse_cancellation_validated_not_transmitted', {
    accessKeySuffix: accessKey.slice(-8), nfseNumber: noteData.numeroNota || null,
    eventCode: prepared.eventCode, eventSequence: prepared.eventSequence,
    xsdBefore: prepared.xsdValidBeforeSignature, signatureVerified: prepared.signatureVerified,
    xsdAfter: prepared.xsdValidAfterSignature, gzipBase64Ready: prepared.gzipBase64Ready,
    transmitted: false,
  });
  return res.json({ success: true, data: {
    accessKey, nfseNumber: noteData.numeroNota || null, endpoint,
    eventCode: prepared.eventCode, eventElement: prepared.eventElement, eventSequence: prepared.eventSequence,
    xsdValidBeforeSignature: prepared.xsdValidBeforeSignature,
    signatureVerified: prepared.signatureVerified,
    xsdValidAfterSignature: prepared.xsdValidAfterSignature,
    gzipBase64Ready: prepared.gzipBase64Ready,
    transmitted: false,
  } });
} catch (error) { next(error); } });

app.post('/api/fiscal/nfse/authorized/:accessKey/cancellation/reconcile', protect, async (req: any, res, next) => { try {
  const accessKey = String(req.params.accessKey || '');
  if (!/^\d{50}$/.test(accessKey)) return res.status(400).json({ success: false, code: 'INVALID_NFSE_ACCESS_KEY', error: 'Chave de acesso inválida.' });
  const environment = getFiscalEnvironment();
  if (environment.environment !== 'producao' || environment.baseUrl !== 'https://sefin.nfse.gov.br') {
    return res.status(409).json({ success: false, code: 'PRODUCTION_RECONCILIATION_REQUIRES_REAL_ENVIRONMENT', error: 'Conciliação exige Produção Real.' });
  }
  const noteRef = req.fiscal.db.collection('notas_fiscais_servico').doc(accessKey);
  const note = await noteRef.get(); const noteData = note.data() || {};
  if (!note.exists || noteData.companyId !== req.fiscal.companyId) return res.status(404).json({ success: false, code: 'AUTHORIZED_NFSE_NOT_FOUND', error: 'NFS-e não encontrada.' });
  const cancellationRef = req.fiscal.db.collection('companies').doc(req.fiscal.companyId).collection('fiscal_nfse_cancellation_requests').doc(accessKey);
  const cancellation = await cancellationRef.get();
  if (!cancellation.exists) return res.status(404).json({ success: false, code: 'CANCELLATION_REQUEST_NOT_FOUND', error: 'Registro local de cancelamento não encontrado.' });
  const password = String(req.body?.password || '');
  if (!password) return res.status(400).json({ success: false, code: 'CERTIFICATE_PASSWORD_REQUIRED', error: 'Senha do certificado obrigatória para consulta mTLS.' });
  const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private');
  const companyRoot = resolve(privateRoot, req.fiscal.companyId);
  const pfxPath = resolve(companyRoot, 'certificates', 'active.pfx');
  if (!pfxPath.startsWith(`${companyRoot}${sep}`)) throw new Error('Caminho fiscal privado inválido.');
  const pfx = await readFile(pfxPath);
  const parsed = parsePkcs12(pfx, password, String(req.body?.expectedCnpj || ''));
  const official = await consultOfficialCancellation(accessKey, { pfx: parsed.pfx, passphrase: parsed.passphrase });
  const reconciledAt = FieldValue.serverTimestamp();
  if (official.status === 'CANCELADA' && official.confirmation) {
    await cancellationRef.set({ status: 'registered', transmitted: true, eventId: official.confirmation.eventId, protocol: official.confirmation.protocol, registeredAtOfficial: official.confirmation.registeredAt, reconciliationStatus: 'CANCELADA', reconciledAt, reconciliationHttp: official.responses }, { merge: true });
    await noteRef.set({ status: 'CANCELADA', cancellationStatus: 'registered', cancellationEventId: official.confirmation.eventId, cancellationProtocol: official.confirmation.protocol, cancelledAt: reconciledAt, updatedAt: reconciledAt }, { merge: true });
  } else if (official.status === 'AUTORIZADA') {
    await cancellationRef.set({ status: 'failed_safe', reconciliationStatus: 'AUTORIZADA_SEM_E101101', reconciledAt, reconciliationHttp: official.responses, releasedForManualRetry: true }, { merge: true });
  } else {
    await cancellationRef.set({ status: 'unknown', reconciliationStatus: 'INCONCLUSIVO', reconciledAt, reconciliationHttp: official.responses, releasedForManualRetry: false }, { merge: true });
  }
  await writeFiscalAudit(req.fiscal.db, req.fiscal.companyId, req.fiscal.decoded.uid, 'nfse_cancellation_reconciled', { accessKeySuffix: accessKey.slice(-8), nfseNumber: noteData.numeroNota || null, officialStatus: official.status, eventFound: Boolean(official.confirmation), responses: official.responses, retransmissionPerformed: false });
  return res.json({ success: true, data: { accessKey, nfseNumber: noteData.numeroNota || null, officialStatus: official.status, eventFound: Boolean(official.confirmation), eventId: official.confirmation?.eventId || null, protocol: official.confirmation?.protocol || null, eventDateTime: official.confirmation?.registeredAt || null, responses: official.responses, mayReleaseManualRetry: official.status === 'AUTORIZADA', retransmissionPerformed: false } });
} catch (error) { next(error); } });

app.post('/api/fiscal/nfse/authorized/:accessKey/cancellation/execute', protect, async (req: any, res, next) => { try {
  const accessKey = String(req.params.accessKey || '');
  if (!/^\d{50}$/.test(accessKey)) return res.status(400).json({ success: false, code: 'INVALID_NFSE_ACCESS_KEY', error: 'Chave de acesso inválida.' });
  const environment = getFiscalEnvironment();
  if (environment.environment !== 'producao' || !environment.productionEnabled || environment.baseUrl !== 'https://sefin.nfse.gov.br') {
    return res.status(409).json({ success: false, code: 'PRODUCTION_CANCELLATION_NOT_AUTHORIZED', error: 'Cancelamento exige Produção Real habilitada.' });
  }
  const noteRef = req.fiscal.db.collection('notas_fiscais_servico').doc(accessKey);
  const note = await noteRef.get(); const noteData = note.data() || {};
  if (!note.exists || noteData.companyId !== req.fiscal.companyId) return res.status(404).json({ success: false, code: 'AUTHORIZED_NFSE_NOT_FOUND', error: 'NFS-e autorizada não encontrada.' });
  if (noteData.environment !== 'producao' || !['AUTORIZADA', 'Autorizada'].includes(String(noteData.status || ''))) return res.status(409).json({ success: false, code: 'NFSE_NOT_CANCELLABLE', error: 'A NFS-e não está autorizada em Produção Real.' });
  const cancellationRef = req.fiscal.db.collection('companies').doc(req.fiscal.companyId).collection('fiscal_nfse_cancellation_requests').doc(accessKey);
  const existing = await cancellationRef.get(); const existingData = existing.data() || {};
  if (String(existingData.status || '') !== 'validated_not_transmitted') return res.status(409).json({ success: false, code: 'CANCELLATION_NOT_PREPARED_OR_ALREADY_STARTED', error: 'O evento não está validado para uma transmissão única ou já foi iniciado.' });
  const reasonCode = String(req.body?.reasonCode || ''); const reason = String(req.body?.reason || '').trim();
  if (existingData.reasonCode !== reasonCode || existingData.reason !== reason) return res.status(409).json({ success: false, code: 'CANCELLATION_PREPARATION_MISMATCH', error: 'Motivo divergente do evento previamente validado.' });
  const input = readCertificate(req.body); const parsed = parsePkcs12(input.buffer, input.password, String(req.body?.expectedCnpj || ''));
  const prepared = await prepareCancellationEvent({ accessKey, authorCnpj: parsed.metadata.cnpj || String(req.body?.expectedCnpj || ''), environmentType: '1', reasonCode: reasonCode as '1' | '2' | '9', reason }, { privateKeyPem: parsed.privateKeyPem, certificatePem: parsed.certificatePem }, environment.xsdVersion);
  if (!prepared.valid) return res.status(422).json({ success: false, code: 'CANCELLATION_EVENT_INVALID', error: 'Evento de cancelamento inválido.', data: { stage: prepared.stage, errors: prepared.errors } });
  const endpoint = PRODUCTION_EVENTS_ENDPOINT_TEMPLATE.replace('{chaveAcesso}', accessKey);
  await req.fiscal.db.runTransaction(async (transaction: any) => {
    const current = await transaction.get(cancellationRef);
    if (String(current.data()?.status || '') !== 'validated_not_transmitted') throw Object.assign(new Error('Cancelamento já iniciado.'), { status: 409, code: 'CANCELLATION_ALREADY_STARTED' });
    transaction.set(cancellationRef, { status: 'transmitting', transmissionStartedAt: FieldValue.serverTimestamp(), requestSha256: createHash('sha256').update(prepared.payloadSha256Source).digest('hex') }, { merge: true });
  });
  let officialResponse;
  try {
    officialResponse = await transmitPreparedCancellationEvent(endpoint, prepared.eventoXmlGZipB64, { pfx: parsed.pfx, passphrase: parsed.passphrase });
  } catch (error) {
    await cancellationRef.set({ status: 'unknown', lastErrorCode: (error as any)?.code || 'TRANSPORT_ERROR', lastErrorAt: FieldValue.serverTimestamp() }, { merge: true });
    return res.status(502).json({
      success: false,
      code: (error as any)?.code || 'SEFIN_CANCELLATION_TRANSPORT_ERROR',
      error: error instanceof Error ? error.message : 'Falha de transporte após iniciar o POST de cancelamento.',
      data: { transmissionAttempted: true, confirmationReceived: false },
    });
  }
  const responseText = officialResponse.body.toString('utf8');
  const interpreted = interpretOfficialCancellationResponse(officialResponse, accessKey);
  const confirmation = interpreted.confirmation || { confirmed: false, status: 'INCONCLUSIVO' as const, eventId: null, protocol: null, registeredAt: null };
  const officialEventXml = interpreted.eventXml;
  const accepted = interpreted.accepted;
  const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private');
  const companyRoot = resolve(privateRoot, req.fiscal.companyId); const cancellationDir = resolve(companyRoot, 'cancellations', accessKey);
  if (!cancellationDir.startsWith(`${companyRoot}${sep}`)) throw new Error('Caminho fiscal privado inválido.');
  await mkdir(cancellationDir, { recursive: true, mode: 0o700 });
  const responseFile = resolve(cancellationDir, 'official-response.json'); await writeFile(responseFile, responseText, { mode: 0o600 });
  if (officialEventXml) await writeFile(resolve(cancellationDir, 'official-event.xml'), officialEventXml, { mode: 0o600 });
  await cancellationRef.set({
    status: accepted ? 'registered' : (officialResponse.statusCode >= 200 && officialResponse.statusCode < 300 ? 'unknown' : 'rejected'),
    httpStatus: officialResponse.statusCode, eventId: confirmation.eventId, protocol: confirmation.protocol,
    registeredAtOfficial: confirmation.registeredAt, responsePath: `private://cancellations/${accessKey}/official-response.json`,
    eventXmlPath: officialEventXml ? `private://cancellations/${accessKey}/official-event.xml` : null,
    responseCode: interpreted.responseCode, responseMessage: interpreted.responseMessage,
    transmissionFinishedAt: FieldValue.serverTimestamp(), transmitted: true,
  }, { merge: true });
  if (accepted) await noteRef.set({ status: 'CANCELADA', cancellationStatus: 'registered', cancellationEventId: confirmation.eventId, cancellationProtocol: confirmation.protocol, cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await writeFiscalAudit(req.fiscal.db, req.fiscal.companyId, req.fiscal.decoded.uid, accepted ? 'nfse_cancellation_registered' : 'nfse_cancellation_rejected_or_unknown', { accessKeySuffix: accessKey.slice(-8), nfseNumber: noteData.numeroNota || null, httpStatus: officialResponse.statusCode, confirmed: confirmation.confirmed, eventId: confirmation.eventId, protocol: confirmation.protocol });
  const upstreamFailure = !accepted && officialResponse.statusCode >= 400;
  const errorMessage = interpreted.responseMessage || 'A SEFIN respondeu ao POST, mas não confirmou o cancelamento.';
  return res.status(accepted ? 200 : (upstreamFailure ? 502 : 422)).json({
    success: accepted,
    code: accepted ? 'NFSE_CANCELLED' : (upstreamFailure ? 'SEFIN_CANCELLATION_HTTP_ERROR' : 'CANCELLATION_NOT_CONFIRMED'),
    error: accepted ? undefined : `SEFIN cancelamento respondeu HTTP ${officialResponse.statusCode}: ${errorMessage}`,
    data: { transmissionAttempted: true, confirmationReceived: accepted, httpStatus: officialResponse.statusCode, status: interpreted.status, eventId: confirmation.eventId, protocol: confirmation.protocol, responseCode: interpreted.responseCode, responseMessage: interpreted.responseMessage },
  });
} catch (error) { next(error); } });

app.post('/api/fiscal/nfse/authorized/:accessKey/danfse', protect, async (req: any, res, next) => { try {
  const accessKey = String(req.params.accessKey || '');
  if (!/^\d{50}$/.test(accessKey)) return res.status(400).json({ success: false, code: 'INVALID_NFSE_ACCESS_KEY', error: 'Chave de acesso inválida.' });
  const record = await req.fiscal.db.collection('notas_fiscais_servico').doc(accessKey).get();
  if (!record.exists || record.data()?.companyId !== req.fiscal.companyId) return res.status(404).json({ success: false, code: 'AUTHORIZED_NFSE_NOT_FOUND', error: 'NFS-e não encontrada.' });
  const input = readCertificate(req.body);
  const parsed = parsePkcs12(input.buffer, input.password, String(req.body?.expectedCnpj || ''));
  const official = await downloadRestrictedDanfse(accessKey, { pfx: parsed.pfx, passphrase: parsed.passphrase });
  const pdf = official.body;
  console.log('[Fiscal Download] DANFSe oficial obtido', { accessKey: accessKey.slice(-8), httpStatus: official.statusCode, bytes: pdf.length });
  const fileName = `DANFSe-${record.data()?.numeroNota || 'autorizada'}-${accessKey.slice(-8)}.pdf`;
  res.json({ success: true, data: { fileName, mimeType: 'application/pdf', downloadUrl: createFiscalDownload(pdf, 'application/pdf', fileName), source: 'adn_nacional_oficial', official: true, httpStatus: official.statusCode } });
} catch (error) { next(error); } });

app.use((error: any, _req: any, res: any, _next: any) => {
  console.error('[FISCAL ERROR]', {
    code: error?.code,
    message: error instanceof Error ? error.message : 'unknown',
    ...(error?.diagnostic ? { diagnostic: error.diagnostic } : {}),
  });
  res.status(Number(error?.status || 500)).json({ success: false, code: error?.code || 'FISCAL_ERROR', error: error instanceof Error ? error.message : 'Falha interna no serviço fiscal.' });
});

if (process.env.NODE_ENV !== 'test') app.listen(PORT, '0.0.0.0', () => console.log(`[Fiscal] Fase 1 online na porta ${PORT}; produção bloqueada.`));
export { app };
