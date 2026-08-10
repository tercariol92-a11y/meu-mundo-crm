import { FieldValue, type Firestore } from 'firebase-admin/firestore';
export async function writeFiscalAudit(db: Firestore, companyId: string, uid: string, action: string, details: Record<string, unknown>) {
  const environment = process.env.FISCAL_ENVIRONMENT === 'producao' ? 'producao' : 'producao_restrita';
  await db.collection('companies').doc(companyId).collection('fiscal_technical_audit').add({ companyId, uid, action, details, phase: 1, environment, createdAt: FieldValue.serverTimestamp() });
}
