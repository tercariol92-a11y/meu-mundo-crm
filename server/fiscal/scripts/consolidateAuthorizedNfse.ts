import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { persistAuthorizedNfse } from '../postAuthorization/authorizedNfse';

async function main() {
  const [companyId, dpsId] = process.argv.slice(2);
  if (!companyId || !/^[A-Za-z0-9_-]{2,128}$/.test(companyId)) throw new Error('companyId inválido.');
  if (!dpsId || !/^DPS\d{40,60}$/.test(dpsId)) throw new Error('Identificador da DPS inválido.');

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin fiscal não configurado.');

  const firebaseApp = getApps().find(item => item.name === 'fiscal-consolidation') || initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  }, 'fiscal-consolidation');
  const db = getFirestore(firebaseApp, process.env.FIREBASE_DATABASE_ID?.trim() || 'ai-studio-deb852ec-3d57-481f-a30e-1461a2294d90');
  const relativeRoot = `nfse-issues/${dpsId}`;
  const privateRoot = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private', companyId, relativeRoot);
  const response = JSON.parse(await readFile(resolve(privateRoot, 'response.json'), 'utf8'));
  const xml = await readFile(resolve(privateRoot, 'nfse-autorizada.xml'), 'utf8');
  const accessKey = String(response?.chaveAcesso || '');
  if (!/^\d{50}$/.test(accessKey)) throw new Error('Resposta sem chave oficial de 50 dígitos.');

  const record = await persistAuthorizedNfse({
    db,
    companyId,
    uid: 'local-fiscal-consolidation',
    accessKey,
    dpsId,
    xml,
    xmlPath: `private://${relativeRoot}/nfse-autorizada.xml`,
    responsePath: `private://${relativeRoot}/response.json`,
    httpStatus: 201,
    environment: 'producao',
    clientName: 'Shop CWB Equipamentos e Acessórios Ltda.',
  });
  const counter = await db.collection('companies').doc(companyId).collection('fiscal_counters').doc('dps_producao_serie_1').get();
  const issuance = await db.collection('companies').doc(companyId).collection('fiscal_nfse_issuance_requests').doc(`producao_${dpsId}`).get();

  console.log(JSON.stringify({
    success: true,
    nfseNumber: record.nfseNumber,
    dpsNumber: record.dpsNumber,
    dpsSeries: record.dpsSeries,
    environment: record.environment,
    officialAccessKeyStored: record.chaveAcessoOficial === accessKey,
    authorizedXmlStored: record.xmlAutorizado === xml,
    nextDpsNumber: counter.data()?.nextNumber || null,
    issuanceStatus: issuance.data()?.status || null,
    newTransmission: false,
  }));
}

void main();
