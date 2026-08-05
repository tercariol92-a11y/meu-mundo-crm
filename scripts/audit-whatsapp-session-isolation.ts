import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId=process.env.FIREBASE_PROJECT_ID?.trim();
const clientEmail=process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n').trim();
if(!projectId||!clientEmail||!privateKey)throw new Error('Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.');
const app=getApps()[0]||initializeApp({credential:cert({projectId,clientEmail,privateKey}),projectId});
const databaseId=process.env.FIREBASE_DATABASE_ID?.trim();
const db=databaseId?getFirestore(app,databaseId):getFirestore(app);

async function auditCollection(collectionName:string){
  const snapshot=await db.collection(collectionName).get();
  let withoutSessionId=0,mixedIdentity=0,messages=0,messagesWithoutSessionId=0;
  for(const document of snapshot.docs){
    const data=document.data();
    if(!data.whatsappSessionId&&!data.sessionId)withoutSessionId++;
    if(data.whatsappSessionId&&data.sessionId&&data.whatsappSessionId!==data.sessionId)mixedIdentity++;
    const child=await document.ref.collection('messages').get();messages+=child.size;
    messagesWithoutSessionId+=child.docs.filter(message=>!message.data().whatsappSessionId&&!message.data().sessionId).length;
  }
  return{collection:collectionName,conversations:snapshot.size,withoutSessionId,mixedIdentity,messages,messagesWithoutSessionId};
}

async function main(){
  const report={generatedAt:new Date().toISOString(),collections:await Promise.all(['leads','whatsapp_groups'].map(auditCollection))};
  console.log(JSON.stringify(report,null,2));
}

void main().catch(error=>{console.error(error instanceof Error?error.message:'Falha na auditoria.');process.exitCode=1});
