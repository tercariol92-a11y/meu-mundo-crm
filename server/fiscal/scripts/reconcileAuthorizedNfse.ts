import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { persistAuthorizedNfse } from '../postAuthorization/authorizedNfse';

async function main() {
  const companyId = process.argv[2];
  if (!companyId || !/^[A-Za-z0-9_-]{2,128}$/.test(companyId)) throw new Error('Informe um companyId válido.');
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin fiscal não configurado.');
  const app = getApps().find(item => item.name === 'fiscal-reconcile') || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, 'fiscal-reconcile');
  const db = getFirestore(app, process.env.FIREBASE_DATABASE_ID?.trim() || 'ai-studio-deb852ec-3d57-481f-a30e-1461a2294d90');
  const root = resolve(process.env.FISCAL_CERTIFICATE_STORAGE_PATH || './fiscal-private', companyId, 'phase3', 'sixth-restricted');
  const response = JSON.parse(await readFile(resolve(root, 'response.json'), 'utf8'));
  const xml = await readFile(resolve(root, 'nfse-autorizada.xml'), 'utf8');
  const accessKey = String(response?.chaveAcesso || '');
  if (!/^\d{50}$/.test(accessKey)) throw new Error('Resposta autorizada sem chave válida.');
  const record = await persistAuthorizedNfse({ db, companyId, uid: 'local-post-authorization-reconciliation', accessKey, dpsId: response?.idDps || null, xml, xmlPath: 'private://phase3/sixth-restricted/nfse-autorizada.xml', responsePath: 'private://phase3/sixth-restricted/response.json', httpStatus: 201 });
  console.log(JSON.stringify({ success: true, accessKey, nfseNumber: record.nfseNumber, xmlAvailable: true, danfseAvailable: true, newTransmission: false }));
}
void main();
