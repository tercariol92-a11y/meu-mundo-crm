import express from 'express';
import Busboy from '@fastify/busboy';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getSessionProfilePicture,
  getWhatsAppStatus,
  initWhatsAppSessions,
  reconnectWhatsApp,
  sendSessionMedia,
  sendSessionMessage
} from './whatsappSessionManager';

const PORT = Number(process.env.PORT || 3001);
const internalSecret = String(process.env.WHATSAPP_INTERNAL_SECRET || '').trim();
const allowedOrigins = new Set([
  'https://meumundocrm.com.br',
  'https://www.meumundocrm.com.br',
  'http://localhost:3000',
  ...String(process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)
]);

let firebaseApp = getApps()[0];
const configuredStorageBucket = process.env.FIREBASE_STORAGE_BUCKET?.trim();
if (!firebaseApp) {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  firebaseApp = initializeApp(projectId && clientEmail && privateKey
    ? { credential: cert({ projectId, clientEmail, privateKey }), projectId, storageBucket: configuredStorageBucket }
    : projectId ? { projectId, storageBucket: configuredStorageBucket } : undefined);
}

const firebaseDatabaseId = process.env.FIREBASE_DATABASE_ID?.trim();
const db = firebaseDatabaseId ? getFirestore(firebaseApp, firebaseDatabaseId) : getFirestore(firebaseApp);
const mediaBucket = configuredStorageBucket ? getStorage(firebaseApp).bucket(configuredStorageBucket) : null;
let storageAvailable = false;
initWhatsAppSessions(db, mediaBucket);
const app = express();
const operationLocks = new Map<string, Promise<unknown>>();

app.use((req, res, next) => {
  const origin = String(req.headers.origin || '');
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Internal-Secret');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ success: false, error: 'Origem não permitida.' });
  next();
});

app.use(express.json({ limit: '15mb' }));

app.get('/health', (_req, res) => res.status(200).json({
  success: true,
  service: 'meu-mundo-whatsapp',
  status: 'online',
  timestamp: new Date().toISOString(),
  storageConfigured: Boolean(configuredStorageBucket),
  storageAvailable
}));

type Principal = { uid: string; isAdmin: boolean };
declare global { namespace Express { interface Request { whatsappPrincipal?: Principal } } }

app.use('/api/whatsapp', async (req, res, next) => {
  try {
    if (!internalSecret) return res.status(503).json({ success: false, code: 'INTERNAL_SECRET_NOT_CONFIGURED', error: 'Segredo interno do serviço não configurado.' });
    if (String(req.headers['x-internal-secret'] || '') !== internalSecret) return res.status(401).json({ success: false, code: 'INVALID_INTERNAL_SECRET', error: 'Segredo interno inválido.' });
    const authorization = String(req.headers.authorization || '');
    if (!authorization.startsWith('Bearer ')) return res.status(401).json({ success: false, code: 'FIREBASE_TOKEN_REQUIRED', error: 'Token Firebase obrigatório.' });
    const decoded = await getAuth().verifyIdToken(authorization.slice(7).trim());
    const profileSnapshot = await db.collection('usuarios').doc(decoded.uid).get();
    const profile = profileSnapshot.exists ? profileSnapshot.data() || {} : {};
    const role = String(profile.role || '').toLowerCase();
    const roles = Array.isArray(profile.roles) ? profile.roles.map((value: unknown) => String(value).toLowerCase()) : [];
    const internalRoles = ['admin','administrador','tecnico','vendedor','financeiro','suporte','gerente_comercial','gerente'];
    const isInternal = profile.userType === 'internal' || internalRoles.includes(role) || roles.some((value: string) => internalRoles.includes(value));
    if (!isInternal) return res.status(403).json({ success: false, error: 'Acesso permitido somente para usuários internos.' });
    req.whatsappPrincipal = { uid: decoded.uid, isAdmin: role === 'admin' || role === 'administrador' || roles.includes('admin') || profile.isAdmin === true };
    next();
  } catch (error) {
    console.error('[Railway WhatsApp] autenticação rejeitada:', error instanceof Error ? error.message : 'erro desconhecido');
    return res.status(401).json({ success: false, code: 'INVALID_FIREBASE_TOKEN', error: 'Token Firebase inválido.' });
  }
});

const uidOf = (req: express.Request) => req.whatsappPrincipal!.uid;
async function locked<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  const current = operationLocks.get(uid);
  if (current) return current as Promise<T>;
  const pending = operation().finally(() => { if (operationLocks.get(uid) === pending) operationLocks.delete(uid); });
  operationLocks.set(uid, pending);
  return pending;
}

app.get('/api/whatsapp/qr/status', (req, res) => res.json({ success: true, status: getWhatsAppStatus(uidOf(req)) }));
app.post('/api/whatsapp/qr/connect', async (req, res, next) => { try { const uid=uidOf(req);await locked(uid,()=>connectWhatsApp(uid));res.status(202).json({success:true,status:getWhatsAppStatus(uid)}); } catch(error){next(error)} });
app.post('/api/whatsapp/qr/generate', async (req, res, next) => { try { const uid=uidOf(req);await locked(uid,()=>connectWhatsApp(uid));res.status(202).json({success:true,status:getWhatsAppStatus(uid)}); } catch(error){next(error)} });
app.post('/api/whatsapp/qr/reconnect', async (req, res, next) => { try { const uid=uidOf(req);await locked(uid,()=>reconnectWhatsApp(uid));res.status(202).json({success:true,status:getWhatsAppStatus(uid)}); } catch(error){next(error)} });
app.post('/api/whatsapp/qr/disconnect', async (req, res, next) => { try { const uid=uidOf(req);await locked(uid,()=>disconnectWhatsApp(uid,req.body?.clearCredentials===true));res.json({success:true,status:getWhatsAppStatus(uid)}); } catch(error){next(error)} });

app.post('/api/whatsapp/send', async (req, res, next) => {
  try { const {to,message}=req.body||{};if(!to||!message)return res.status(400).json({success:false,error:'Destino e mensagem são obrigatórios.'});return res.json(await sendSessionMessage(uidOf(req),String(to),String(message))); } catch(error){next(error)}
});

app.post('/api/whatsapp/send-media', (req, res, next) => {
  if (!String(req.headers['content-type'] || '').includes('multipart/form-data')) return res.status(415).json({ success:false,error:'Use multipart/form-data.' });
  const fields:Record<string,string>={};let fileBuffer=Buffer.alloc(0);let mimetype='application/octet-stream';let fileName='arquivo';
  const busboy=new Busboy({headers:req.headers as any,limits:{fileSize:20*1024*1024,files:1}});
  busboy.on('field',(name,value)=>{fields[name]=value});
  busboy.on('file',(_name,stream,filename,_encoding,mimeType)=>{mimetype=mimeType||mimetype;fileName=filename||fileName;const chunks:Buffer[]=[];stream.on('data',chunk=>chunks.push(Buffer.from(chunk)));stream.on('end',()=>{fileBuffer=Buffer.concat(chunks)})});
  busboy.on('finish',async()=>{try{if(!fields.to||!fileBuffer.length)return res.status(400).json({success:false,error:'Destino e arquivo são obrigatórios.'});res.json(await sendSessionMedia(uidOf(req),fields.to,fileBuffer,mimetype,fields.fileName||fileName,fields.caption||'',fields));}catch(error){next(error)}});
  busboy.on('error',next);req.pipe(busboy);
});

app.get('/api/whatsapp/profile-picture/:jid', async (req,res,next) => {
  try {
    const url=await getSessionProfilePicture(uidOf(req),req.params.jid,req.query.refresh==='true');
    res.json({success:true,profilePictureUrl:url});
  } catch(error) {
    const code=error instanceof Error?error.message:'';
    if(code==='INVALID_PROFILE_JID')return res.status(400).json({success:false,error:'JID inválido.'});
    next(error);
  }
});

app.use('/api', (req,res) => res.status(404).json({success:false,error:`Endpoint ${req.method} ${req.path} não encontrado.`}));
app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error('[Railway WhatsApp] erro:',error instanceof Error?error.message:'erro desconhecido');res.status(500).json({success:false,error:error instanceof Error?error.message:'Falha interna no serviço WhatsApp.'})});

async function start() {
  const projectId = firebaseApp.options.projectId || '';
  if (!configuredStorageBucket || !mediaBucket) {
    console.error('[FIREBASE STORAGE CONFIG]', { projectId, bucketName: '', bucketExists: false });
    console.error('FIREBASE_STORAGE_BUCKET_NOT_CONFIGURED');
  } else {
    const [bucketExists] = await mediaBucket.exists();
    storageAvailable = bucketExists;
    console.log('[FIREBASE STORAGE CONFIG]', { projectId, bucketName: mediaBucket.name, bucketExists });
    if (!bucketExists) console.error('FIREBASE_STORAGE_BUCKET_NOT_FOUND');
  }
  app.listen(PORT,'0.0.0.0',()=>console.log(`[Railway WhatsApp] serviço online na porta ${PORT}; authRoot=${process.env.BAILEYS_AUTH_ROOT||'./auth_info_baileys'}`));
}

void start().catch(error => {
  console.error('[Railway WhatsApp] falha ao validar inicialização:', error instanceof Error ? error.message : 'erro desconhecido');
  process.exitCode = 1;
});
