import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function main() {
  const companyId = process.argv[2]; const accessKey = process.argv[3];
  if (!companyId || !accessKey) throw new Error('Empresa e chave obrigatórias.');
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim(); const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim(); const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin fiscal não configurado.');
  const app = getApps().find(item => item.name === 'fiscal-verify') || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, 'fiscal-verify');
  const db = getFirestore(app, process.env.FIREBASE_DATABASE_ID?.trim() || 'ai-studio-deb852ec-3d57-481f-a30e-1461a2294d90');
  const document = await db.collection('notas_fiscais_servico').doc(accessKey).get(); const data = document.data();
  const duplicates = await db.collection('notas_fiscais_servico').where('reference', '==', accessKey).get();
  const attempt = await db.collection('companies').doc(companyId).collection('fiscal_phase3_attempts').doc('sixth-restricted').get();
  console.log(JSON.stringify({ found: document.exists, companyMatches: data?.companyId === companyId, status: data?.status || null, nfseNumber: data?.numeroNota || null, xmlAvailable: data?.xmlAvailable === true, danfseAvailable: data?.danfseAvailable === true, environment: data?.environment || null, matchingDocuments: duplicates.size, transmissionAttemptLocked: attempt.exists, attemptStatus: attempt.data()?.status || null }));
}
void main();
