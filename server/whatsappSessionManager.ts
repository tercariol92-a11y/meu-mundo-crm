import makeWASocket, { Browsers, DisconnectReason, WASocket, downloadMediaMessage, fetchLatestWaWebVersion, proto, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import type { Bucket } from 'firebase-admin/storage';
import { createSatisfactionRequest, detectSatisfactionScore, hasPendingSatisfactionRequest, processSatisfactionResponse } from './satisfactionService';

export type SessionStatus = 'disconnected'|'connecting'|'qrcode'|'connected'|'error';
export type WhatsAppSession = { userId:string; socket:WASocket|null; status:SessionStatus; phone:string; qrCodeDataUrl:string; lastConnectedAt:string|null; reconnectAttempts:number; authDirectory:string; reconnectTimer?:ReturnType<typeof setTimeout>; generation:number };
const sessions = new Map<string,WhatsAppSession>();
const logger = pino({level:'silent'});
let db:any=null;
let mediaBucket:Bucket|null=null;
const ROOT=path.resolve(process.env.BAILEYS_AUTH_ROOT||path.join(process.cwd(),'auth_info_baileys'));
const safeUid=(uid:string)=>{if(!/^[A-Za-z0-9_-]{6,128}$/.test(uid))throw new Error('UID inválido.');return uid};
const groupDocId=(uid:string,jid:string)=>`${uid}_${jid.replace(/@g\.us$/,'').replace(/[^A-Za-z0-9_-]/g,'_')}`;
const phoneOf=(jid:string)=>jid.split('@')[0].split(':')[0].replace(/\D/g,'');
async function persistPublicFile(buffer:Buffer,storagePath:string,contentType:string,metadata:Record<string,string>){
  const bucket=mediaBucket;
  if(!bucket)throw new Error('FIREBASE_STORAGE_BUCKET_NOT_CONFIGURED');
  const [bucketExists]=await bucket.exists();
  if(!bucketExists)throw new Error('FIREBASE_STORAGE_BUCKET_NOT_FOUND');
  const token=randomUUID();
  await bucket.file(storagePath).save(buffer,{resumable:false,metadata:{contentType,cacheControl:'public,max-age=31536000,immutable',metadata:{firebaseStorageDownloadTokens:token,...metadata}}});
  const mediaUrl=`https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(token)}`;
  console.log('[MEDIA STORAGE UPLOAD]',{storagePath,bucketName:bucket.name,success:true});
  return {mediaUrl,storagePath};
}
export function validateWhatsAppPhone(rawPhone: unknown): { valid: true; phone: string } | { valid: false; error: string } {
  if (typeof rawPhone !== 'string' && typeof rawPhone !== 'number') return { valid: false, error: 'Informe um número de destino completo.' };
  const phone = String(rawPhone).replace(/\D/g, '');
  if (!phone || phone === '55') return { valid: false, error: 'Número incompleto. Informe país, DDD e telefone.' };
  if (phone.startsWith('55') && !/^55\d{10,11}$/.test(phone)) return { valid: false, error: 'Número brasileiro incompleto ou inválido. Use 55 + DDD + número.' };
  if (!phone.startsWith('55') && !/^\d{8,15}$/.test(phone)) return { valid: false, error: 'Número internacional inválido.' };
  return { valid: true, phone };
}
const extract=(m?:proto.IMessage|null):{body:string,type:string,caption?:string}|null=>{if(!m)return null;if(m.ephemeralMessage?.message)return extract(m.ephemeralMessage.message);if(m.viewOnceMessage?.message)return extract(m.viewOnceMessage.message);if(m.viewOnceMessageV2?.message)return extract(m.viewOnceMessageV2.message);if(m.conversation)return{body:m.conversation,type:'text'};if(m.extendedTextMessage?.text)return{body:m.extendedTextMessage.text,type:'text'};if(m.imageMessage)return{body:m.imageMessage.caption||'[Foto recebida]',type:'image',caption:m.imageMessage.caption||''};if(m.videoMessage)return{body:m.videoMessage.caption||'[Vídeo recebido]',type:'video',caption:m.videoMessage.caption||''};if(m.audioMessage)return{body:'[Áudio recebido]',type:'audio'};if(m.documentMessage)return{body:m.documentMessage.caption||m.documentMessage.fileName||'[Documento recebido]',type:'document',caption:m.documentMessage.caption||''};if(m.protocolMessage)return null;return{body:'[Mensagem não textual recebida]',type:'media'}};

async function owner(uid:string){const s=await db?.collection('usuarios').doc(uid).get();const d=s?.exists?s.data():{};return{name:d?.displayName||d?.nome||d?.name||d?.email?.split('@')[0]||'Atendente',email:d?.email||''}}
async function saveSession(s:WhatsAppSession,error=''){if(!db)return;const o=await owner(s.userId);await db.collection('whatsapp_sessions').doc(s.userId).set({userId:s.userId,userName:o.name,userEmail:o.email,phone:s.phone,sessionName:`whatsapp_${s.userId}`,status:s.status,qrCodeDataUrl:s.qrCodeDataUrl,lastConnectedAt:s.lastConnectedAt,lastError:error,provider:'baileys',isActive:s.status==='connected',updatedAt:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp()},{merge:true})}
async function saveMedia(s: WhatsAppSession, msg: any, scope: string, id: string) {
  const leaf: any = msg.message?.ephemeralMessage?.message || msg.message;
  const media = leaf?.imageMessage || leaf?.videoMessage || leaf?.audioMessage || leaf?.documentMessage;
  if (!media) return {};

  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
      logger,
      reuploadRequest: s.socket!.updateMediaMessage
    });
    const mimetype = String(media.mimetype || 'application/octet-stream').split(';')[0].trim();
    const subtype = mimetype.split('/')[1] || 'bin';
    const extension = subtype.replace(/^jpeg$/, 'jpg').replace(/[^A-Za-z0-9]/g, '') || 'bin';
    const defaultBaseName = leaf.imageMessage ? 'imagem' : leaf.videoMessage ? 'video' : leaf.audioMessage ? 'audio' : 'arquivo';
    const receivedName = String(leaf.documentMessage?.fileName || `${defaultBaseName}.${extension}`);
    const fileName = receivedName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 160) || `${defaultBaseName}.${extension}`;
    const storagePath = `whatsapp-media/${s.userId}/${scope}/${id}/${fileName}`;
    console.log(`[WhatsApp Media] mídia baixada; messageId=${id}; bytes=${buffer.length}`);
    const stored=await persistPublicFile(buffer,storagePath,mimetype,{fileName,telefone:scope,messageId:id,origem:'WhatsApp QR Code',ownerUserId:s.userId});
    console.log(`[WhatsApp Media] upload concluído; messageId=${id}; path=${storagePath}`);
    return {
      mediaUrl:stored.mediaUrl,
      thumbnailUrl: leaf.imageMessage ? stored.mediaUrl : '',
      storagePath:stored.storagePath,
      mimetype,
      fileName,
      fileSize: Number(media.fileLength || buffer.length),
      caption: leaf.imageMessage?.caption || leaf.videoMessage?.caption || leaf.documentMessage?.caption || '',
      mediaStatus: 'ready'
    };
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'erro desconhecido';
    console.error(`[WhatsApp Media] falha ao armazenar; messageId=${id}; error=${safeMessage}`);
    return { mediaStatus: 'media_storage_failed', mediaError: safeMessage.startsWith('FIREBASE_STORAGE_BUCKET_') ? safeMessage : 'Não foi possível armazenar a mídia.' };
  }
}

function timestampMillis(value: any): number {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function refreshContactAvatar(s: WhatsAppSession, msg: any, phone: string, leadData: any) {
  if (msg.key.fromMe || !s.socket) return {};
  const updatedAt = timestampMillis(leadData?.profilePictureUpdatedAt);
  if (leadData?.profilePictureUrl && Date.now() - updatedAt < 24 * 60 * 60 * 1000) return {};

  const candidates = [msg.key.remoteJidAlt, msg.key.remoteJid, msg.key.participant, `${phone}@s.whatsapp.net`]
    .map(value => String(value || '').trim())
    .filter((value, index, list) => value && list.indexOf(value) === index)
    .filter(value => !value.endsWith('@g.us') && value !== 'status@broadcast' && !value.includes('newsletter'));
  for (const jid of candidates) {
    try {
      console.log(`[WhatsApp Avatar] buscando foto; JID=${jid}; telefone=${phone}`);
      const temporaryUrl = await s.socket.profilePictureUrl(jid, 'image');
      if (!temporaryUrl) continue;
      const response = await fetch(temporaryUrl);
      if (!response.ok) throw new Error(`download HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const storagePath = `whatsapp-profile-pictures/${s.userId}/${phone}/avatar.jpg`;
      const stored=await persistPublicFile(buffer,storagePath,contentType,{telefone:phone,origem:'WhatsApp QR Code',ownerUserId:s.userId});
      const permanentUrl=stored.mediaUrl;
      console.log(`[WhatsApp Avatar] foto salva; JID=${jid}; telefone=${phone}`);
      return {
        profilePictureUrl: permanentUrl,
        photoUrl: permanentUrl,
        avatarUrl: permanentUrl,
        profilePictureUpdatedAt: FieldValue.serverTimestamp()
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'indisponível';
      console.log(`[WhatsApp Avatar] foto não disponível; JID=${jid}; motivo=${message}`);
    }
  }
  return { profilePictureUpdatedAt: FieldValue.serverTimestamp() };
}
async function onMessage(s:WhatsAppSession,msg:any){const jid=msg.key.remoteJid||'';if(jid==='status@broadcast'||jid.includes('newsletter'))return;const isGroup=jid.endsWith('@g.us');if(!isGroup&&!jid.endsWith('@s.whatsapp.net')&&!jid.endsWith('@lid'))return;const x=extract(msg.message);if(!x)return;const id=msg.key.id||`msg-${Date.now()}`;const o=await owner(s.userId);if(isGroup){const meta=await s.socket!.groupMetadata(jid);const gid=groupDocId(s.userId,jid);const ref=db.collection('whatsapp_groups').doc(gid);const mref=ref.collection('messages').doc(id);if((await mref.get()).exists)return;const participant=msg.key.participant||msg.participant||'';const pname=msg.key.fromMe?'WhatsApp Web':msg.pushName||phoneOf(participant)||'Participante';const media=await saveMedia(s,msg,`group-${gid}`,id);await mref.set({messageId:id,remoteJid:jid,groupId:gid,groupName:meta.subject,isGroup:true,participantJid:participant,participantPhone:phoneOf(participant),participantName:pname,body:x.body,mensagem:x.body,type:x.type,direction:msg.key.fromMe?'out':'in',fromMe:!!msg.key.fromMe,status:msg.key.fromMe?'sent':'received',ownerUserId:s.userId,whatsappOwnerUserId:s.userId,whatsappSessionId:s.userId,sessionPhone:s.phone,sentByUserId:null,...media,timestamp:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp()});await ref.set({groupId:gid,groupJid:jid,remoteJid:jid,name:meta.subject,subject:meta.subject,participantsCount:meta.participants.length,isGroup:true,ownerUserId:s.userId,whatsappOwnerUserId:s.userId,whatsappSessionId:s.userId,sessionPhone:s.phone,lastMessage:`${pname}: ${x.body}`,lastMessageAt:FieldValue.serverTimestamp(),lastMessageId:id,...(!msg.key.fromMe?{unreadCount:FieldValue.increment(1)}:{}),updatedAt:FieldValue.serverTimestamp()},{merge:true});return}
const raw=jid.endsWith('@lid')?(msg.key.remoteJidAlt||''):jid;if(!raw.endsWith('@s.whatsapp.net'))return;const phone=phoneOf(raw);const leads=db.collection('leads');const q=await leads.where('whatsappOwnerUserId','==',s.userId).where('telefone','==',phone).limit(1).get();const ref=q.empty?leads.doc():q.docs[0].ref;const mref=ref.collection('messages').doc(id);if((await mref.get()).exists)return;const media=await saveMedia(s,msg,phone,id);await mref.set({messageId:id,metaMessageId:id,telefone:phone,phone,body:x.body,mensagem:x.body,type:x.type,direction:msg.key.fromMe?'out':'in',fromMe:!!msg.key.fromMe,status:msg.key.fromMe?'sent':'received',ownerUserId:s.userId,whatsappOwnerUserId:s.userId,whatsappSessionId:s.userId,sessionPhone:s.phone,sentByUserId:null,...media,timestamp:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp()});await ref.set({nome:msg.pushName||'Contato WhatsApp',telefone:phone,phone,whatsapp:phone,channel:'whatsapp_qr',ownerUserId:s.userId,ownerUserName:o.name,ownerUserEmail:o.email,whatsappOwnerUserId:s.userId,whatsappSessionId:s.userId,sessionPhone:s.phone,assignedUserId:s.userId,assignedUserName:o.name,ultimaMensagem:x.body,lastMessage:x.body,lastMessageAt:FieldValue.serverTimestamp(),lastMessageId:id,...(!msg.key.fromMe?{unreadCount:FieldValue.increment(1)}:{}),updatedAt:FieldValue.serverTimestamp(),status:'Em atendimento'},{merge:true});if(!msg.key.fromMe&&x.type==='text'){await processSatisfactionResponse(db,{phone,sessionOwnerUid:s.userId,messageId:id,text:x.body,leadId:ref.id,sendAcknowledgement:(text)=>sendSessionMessage(s.userId,phone,text)})}}

async function onSessionMessage(s: WhatsAppSession, msg: any) {
  const jid = msg.key.remoteJid || '';
  if (jid === 'status@broadcast' || jid.includes('newsletter')) return;
  if (jid.endsWith('@g.us')) return onMessage(s, msg);
  if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) return;
  const extracted = extract(msg.message);
  if (!extracted) return;

  const rawJid = jid.endsWith('@lid') ? (msg.key.remoteJidAlt || '') : jid;
  if (!rawJid.endsWith('@s.whatsapp.net')) return;
  const phone = phoneOf(rawJid);
  const messageId = msg.key.id || `msg-${Date.now()}`;
  const ownerData = await owner(s.userId);
  console.log(`[SATISFACTION] Incoming message received; messageId=${messageId}`);

  const requests = await db.collection('satisfaction_requests').where('normalizedPhone', '==', phone).get();
  const pendingRequest = requests.docs
    .map((document: any) => ({ id: document.id, ...document.data() }))
    .find((request: any) => request.status === 'pending' && (!request.whatsappSessionOwnerUid || request.whatsappSessionOwnerUid === s.userId));
  let pendingByRequest = await hasPendingSatisfactionRequest(db, phone, s.userId);

  const leads = db.collection('leads');
  const ownedLead = await leads.where('whatsappOwnerUserId', '==', s.userId).where('telefone', '==', phone).limit(1).get();
  const leadRef = !ownedLead.empty
    ? ownedLead.docs[0].ref
    : pendingRequest?.leadId
      ? leads.doc(pendingRequest.leadId)
      : leads.doc();
  const leadSnapshot = await leadRef.get();
  const leadData = leadSnapshot.exists ? leadSnapshot.data() : {};
  if (!pendingByRequest && leadData?.pesquisaPendente === true) {
    await createSatisfactionRequest(db, {
      conversationId: leadData?.conversationId || leadRef.id, leadId: leadRef.id,
      clientId: leadData?.clienteId || '', clientName: leadData?.nome || msg.pushName || 'Contato WhatsApp',
      contactPhone: phone, atendimentoId: leadData?.attendanceId || leadData?.atendimentoId || leadRef.id,
      ticketId: leadData?.ticketId || '', assignedUserId: leadData?.assignedUserId || leadData?.responsavelId || s.userId,
      assignedUserName: leadData?.assignedUserName || leadData?.atendenteFinalizacao || ownerData.name,
      technicianId: leadData?.technicianId || leadData?.tecnicoId || '',
      technicianName: leadData?.technicianName || leadData?.tecnicoNome || leadData?.tecnico || '',
      profilePictureUrl: leadData?.profilePictureUrl || leadData?.photoUrl || '',
      whatsappSessionOwnerUid: s.userId, whatsappMessageId: `legacy-${leadRef.id}`,
      finalizedAt: leadData?.finalizedAt || leadData?.atendimentoFinalizadoEm || null
    });
    pendingByRequest = true;
  }
  const awaitingRating = leadData?.awaitingSatisfactionRating === true || leadData?.pesquisaPendente === true || pendingByRequest;
  const alreadyFinalized = String(leadData?.status || '').toLowerCase() === 'finalizado' || leadData?.attendanceStatus === 'Finalizado';
  console.log('[SAT DEBUG] incoming', {
    fromPhone: phone,
    senderJid: rawJid,
    bodyText: extracted.body,
    leadId: leadRef.id,
    statusAtual: leadData?.status || '',
    awaitingSatisfactionRating: leadData?.awaitingSatisfactionRating === true,
    satisfactionRequestedAt: leadData?.satisfactionRequestedAt || null,
    attendanceId: leadData?.attendanceId || leadData?.conversationId || leadRef.id
  });

  const messageRef = leadRef.collection('messages').doc(messageId);
  if ((await messageRef.get()).exists) {
    console.log('[SATISFACTION] Duplicate message ignored');
    return;
  }

  const media = await saveMedia(s, msg, phone, messageId);
  const avatarFields = await refreshContactAvatar(s, msg, phone, leadData);
  const timestamp = FieldValue.serverTimestamp();
  await messageRef.set({
    messageId, metaMessageId: messageId, telefone: phone, phone,
    body: extracted.body, mensagem: extracted.body, type: extracted.type,
    direction: msg.key.fromMe ? 'out' : 'in', fromMe: Boolean(msg.key.fromMe),
    status: msg.key.fromMe ? 'sent' : 'received', ownerUserId: s.userId,
    whatsappOwnerUserId: s.userId, whatsappSessionId: s.userId,
    sessionPhone: s.phone, sentByUserId: null, ...media,
    timestamp, createdAt: timestamp
  });

  if (!msg.key.fromMe && awaitingRating) {
    console.log('[SATISFACTION] Lead awaiting rating');
    const rating = extracted.type === 'text' ? detectSatisfactionScore(extracted.body) : null;
    if (rating !== null) {
      console.log(`[SATISFACTION] Valid rating detected: ${rating}`);
      await processSatisfactionResponse(db, {
        phone, sessionOwnerUid: s.userId, messageId, text: extracted.body, leadId: leadRef.id,
        sendAcknowledgement: text => sendSessionMessage(s.userId, phone, text)
      });
    } else {
      console.log('[SATISFACTION] Invalid answer, keeping survey pending');
    }
    await leadRef.set({
      nome: leadData?.nome || msg.pushName || 'Contato WhatsApp', telefone: phone, phone, whatsapp: phone,
      ultimaMensagem: extracted.body, lastMessage: extracted.body, lastMessageAt: timestamp, lastMessageId: messageId,
      status: 'Finalizado', attendanceStatus: 'Finalizado', unreadCount: 0,
      ...(rating === null ? { awaitingSatisfactionRating: true } : {}),
      updatedAt: timestamp
    }, { merge: true });
    console.log('[SATISFACTION] Conversation kept finalized');
    return;
  }

  const keepFinalized = alreadyFinalized;
  await leadRef.set({
    nome: leadData?.nome || msg.pushName || 'Contato WhatsApp', telefone: phone, phone, whatsapp: phone,
    channel: 'whatsapp_qr', ownerUserId: s.userId, ownerUserName: ownerData.name,
    ownerUserEmail: ownerData.email, whatsappOwnerUserId: s.userId, whatsappSessionId: s.userId,
    sessionPhone: s.phone, assignedUserId: leadData?.assignedUserId || s.userId,
    assignedUserName: leadData?.assignedUserName || ownerData.name,
    ...avatarFields,
    ultimaMensagem: extracted.body, lastMessage: extracted.body, lastMessageAt: timestamp, lastMessageId: messageId,
    ...(keepFinalized
      ? { status: 'Finalizado', attendanceStatus: 'Finalizado', unreadCount: 0 }
      : { status: 'Em atendimento', ...(!msg.key.fromMe ? { unreadCount: FieldValue.increment(1) } : {}) }),
    updatedAt: timestamp
  }, { merge: true });
}

export function initWhatsAppSessions(database:any,bucket:Bucket|null=null){db=database;mediaBucket=bucket;void initializeExistingSessions()}
export function getWhatsAppSession(uid:string){return sessions.get(safeUid(uid))||null}
export function getWhatsAppSocket(uid:string){return getWhatsAppSession(uid)?.socket||null}
export async function connectWhatsApp(uid:string,force=false,resetCredentials=false){safeUid(uid);const old=sessions.get(uid);if(old?.socket&&!force&&(old.status==='connected'||old.status==='connecting'||old.status==='qrcode'))return;if(old?.reconnectTimer)clearTimeout(old.reconnectTimer);try{old?.socket?.ev.removeAllListeners();old?.socket?.end(undefined)}catch{}sessions.delete(uid);const authDirectory=path.join(ROOT,uid);if(resetCredentials){console.log(`[WhatsApp QR] reiniciando credenciais somente do UID ${uid}: ${authDirectory}`);await fs.promises.rm(authDirectory,{recursive:true,force:true})}const s:WhatsAppSession={userId:uid,socket:null,status:'connecting',phone:'',qrCodeDataUrl:'',lastConnectedAt:null,reconnectAttempts:old?.reconnectAttempts||0,authDirectory,generation:(old?.generation||0)+1};sessions.set(uid,s);await fs.promises.mkdir(s.authDirectory,{recursive:true});console.log(`[WhatsApp QR] iniciando sessão UID=${uid} authDirectory=${s.authDirectory}`);const auth=await useMultiFileAuthState(s.authDirectory);const {version}=await fetchLatestWaWebVersion();const socket=makeWASocket({version,auth:auth.state,logger,browser:Browsers.macOS('Chrome'),printQRInTerminal:false});s.socket=socket;socket.ev.on('creds.update',auth.saveCreds);socket.ev.on('messages.upsert',async e=>{if(e.type!=='notify'||sessions.get(uid)!==s)return;for(const m of e.messages)await onSessionMessage(s,m).catch(err=>console.error(`[WA ${uid}] mensagem:`,err?.message))});socket.ev.on('connection.update',async u=>{if(sessions.get(uid)!==s)return;if(u.qr){s.status='qrcode';s.qrCodeDataUrl=await QRCode.toDataURL(u.qr);console.log(`[WhatsApp QR] QR gerado UID=${uid} tamanho=${s.qrCodeDataUrl.length}`);void saveSession(s).catch(error=>console.error(`[WhatsApp QR] falha ao salvar QR UID=${uid}:`,error?.message))}if(u.connection==='open'){s.status='connected';s.phone=phoneOf(socket.user?.id||'');s.lastConnectedAt=new Date().toISOString();s.reconnectAttempts=0;s.qrCodeDataUrl='';console.log(`[WhatsApp QR] sessão conectada UID=${uid}`);void saveSession(s).catch(error=>console.error(`[WhatsApp QR] falha ao salvar sessão UID=${uid}:`,error?.message))}if(u.connection==='close'){const code=(u.lastDisconnect?.error as Boom)?.output?.statusCode;s.socket=null;s.status=code===DisconnectReason.loggedOut?'disconnected':'connecting';void saveSession(s,String(code||'')).catch(error=>console.error(`[WhatsApp QR] falha ao salvar desconexão UID=${uid}:`,error?.message));if(code!==DisconnectReason.loggedOut&&s.reconnectAttempts<6){const delay=Math.min(1000*2**s.reconnectAttempts++,30000);s.reconnectTimer=setTimeout(()=>void connectWhatsApp(uid,true),delay)}}});void saveSession(s).catch(error=>console.error(`[WhatsApp QR] falha ao salvar início UID=${uid}:`,error?.message))}
export async function disconnectWhatsApp(uid:string,clear=false){const s=sessions.get(safeUid(uid));if(!s)return;if(s.reconnectTimer)clearTimeout(s.reconnectTimer);try{s.socket?.ev.removeAllListeners();s.socket?.end(undefined)}catch{}s.socket=null;s.status='disconnected';s.qrCodeDataUrl='';await saveSession(s);sessions.delete(uid);if(clear)await fs.promises.rm(s.authDirectory,{recursive:true,force:true})}
export const reconnectWhatsApp=(uid:string)=>connectWhatsApp(uid,true);
export function getWhatsAppStatus(uid:string){const s=sessions.get(safeUid(uid));return s?{uid,status:s.status,sessionName:`whatsapp_${uid}`,sessionPhone:s.phone,qrCodeDataUrl:s.qrCodeDataUrl,lastConnectedAt:s.lastConnectedAt}:{uid,status:'disconnected',sessionName:`whatsapp_${uid}`,sessionPhone:'',qrCodeDataUrl:'',lastConnectedAt:null}}
export function listWhatsAppSessions(){return[...sessions.values()].map(s=>({userId:s.userId,...getWhatsAppStatus(s.userId)}))}
export async function initializeExistingSessions(){if(!fs.existsSync(ROOT))return;for(const e of await fs.promises.readdir(ROOT,{withFileTypes:true}))if(e.isDirectory()&&/^[A-Za-z0-9_-]{6,128}$/.test(e.name))void connectWhatsApp(e.name)}
export async function sendSessionMessage(uid:string,destination:string,text:string){const s=getWhatsAppSession(uid);if(!s?.socket||s.status!=='connected')throw new Error('Sessão WhatsApp do usuário desconectada.');const jid=destination.endsWith('@g.us')?destination:`${destination.replace(/\D/g,'')}@s.whatsapp.net`;const sent=await s.socket.sendMessage(jid,{text});return{success:true,messageId:sent?.key.id,jid,remoteJid:jid,messages:[{id:sent?.key.id}]}}
export async function sendSessionMedia(uid:string,destination:string,buffer:Buffer,mimetype:string,fileName:string,caption='',context:Record<string,string>={}){
  const s=getWhatsAppSession(uid);
  if(!s?.socket||s.status!=='connected')throw new Error('Sessão WhatsApp do usuário desconectada.');
  const isGroup=destination.endsWith('@g.us');
  const phone=destination.replace(/\D/g,'');
  const chatId=isGroup?destination:`${phone}@s.whatsapp.net`;
  const type=mimetype.startsWith('image/')?'image':mimetype.startsWith('video/')?'video':mimetype.startsWith('audio/')?'audio':'document';
  const safeFileName=String(fileName||`${type}.bin`).replace(/[^A-Za-z0-9._-]/g,'_').slice(0,160);
  console.log('[MEDIA SEND]',{chatId,fileName:safeFileName,mimeType:mimetype,fileSize:buffer.length});
  const content:any=type==='image'?{image:buffer,caption,mimetype}:type==='video'?{video:buffer,caption,mimetype}:type==='audio'?{audio:buffer,mimetype,ptt:false}:{document:buffer,mimetype,fileName:safeFileName,caption};
  const sent=await s.socket.sendMessage(chatId,content);
  const messageId=String(sent?.key.id||'');
  if(!messageId)throw new Error('O WhatsApp não confirmou o messageId da mídia.');
  console.log('[IMAGE SENT TO WHATSAPP]',{messageId,chatId,status:'sent'});

  const storagePath=`whatsapp-media/${uid}/${chatId}/${messageId}/${safeFileName}`;
  const timestamp=FieldValue.serverTimestamp();
  const collectionName=isGroup?'whatsapp_groups':'leads';
  let parentRef:any=null;
  if(isGroup){
    const groupId=context.groupId||groupDocId(uid,chatId);
    parentRef=db.collection(collectionName).doc(groupId);
  }else{
    const hintedId=String(context.leadId||'').trim();
    if(hintedId){
      const hinted=await db.collection(collectionName).doc(hintedId).get();
      const hintedData=hinted.exists?hinted.data():null;
      if(hintedData&&(!hintedData.whatsappOwnerUserId||hintedData.whatsappOwnerUserId===uid))parentRef=hinted.ref;
    }
    if(!parentRef){
      const match=await db.collection(collectionName).where('whatsappOwnerUserId','==',uid).where('telefone','==',phone).limit(1).get();
      parentRef=match.empty?db.collection(collectionName).doc():match.docs[0].ref;
    }
  }
  const messageRef=parentRef.collection('messages').doc(messageId);
  let stored:{mediaUrl:string;storagePath:string}|null=null;
  let mediaStatus='ready';
  let mediaError='';
  try{
    stored=await persistPublicFile(buffer,storagePath,mimetype,{fileName:safeFileName,chatId,messageId,origem:'WhatsApp QR Code',ownerUserId:uid});
  }catch(error){
    const safeError=error instanceof Error?error.message:'Falha de armazenamento';
    mediaStatus='media_storage_failed';
    mediaError=safeError.startsWith('FIREBASE_STORAGE_BUCKET_')?safeError:'Não foi possível armazenar a mídia.';
    console.error('[MEDIA STORAGE UPLOAD]',{storagePath,bucketName:mediaBucket?.name||'',success:false,error:mediaError,messageId});
  }
  const messageDocument={
    messageId,metaMessageId:messageId,chatId,contactId:parentRef.id,sessionUid:uid,
    telefone:phone,phone,direction:'out',messageDirection:'outgoing',fromMe:true,type,
    text:caption,body:caption,mensagem:caption,caption,mimetype,mimeType:mimetype,fileName:safeFileName,
    fileSize:buffer.length,mediaUrl:stored?.mediaUrl||'',thumbnailUrl:type==='image'?(stored?.mediaUrl||''):'',storagePath,
    mediaStatus,mediaError,status:'sent',senderId:context.attendantId||uid,attendantId:context.attendantId||uid,
    attendantName:context.attendantName||'',attendantEmail:context.attendantEmail||'',
    ownerUserId:uid,whatsappOwnerUserId:uid,whatsappSessionId:uid,conversationId:context.conversationId||parentRef.id,
    timestamp,createdAt:timestamp
  };
  const batch=db.batch();
  batch.set(messageRef,messageDocument,{merge:true});
  batch.set(parentRef,{lastMessage:caption||`[${type}] ${safeFileName}`,ultimaMensagem:caption||`[${type}] ${safeFileName}`,lastMessageId:messageId,lastMessageAt:timestamp,updatedAt:timestamp},{merge:true});
  await batch.commit();
  console.log('[MEDIA FIRESTORE SAVE]',{documentId:messageRef.id,messageId,mediaUrl:stored?.mediaUrl||'',type,mediaStatus});
  return{success:true,delivered:true,messageId,chatId,jid:chatId,remoteJid:chatId,canonicalPhone:phone,type,caption,mimeType:mimetype,mimetype,fileName:safeFileName,fileSize:buffer.length,mediaUrl:stored?.mediaUrl||'',thumbnailUrl:type==='image'?(stored?.mediaUrl||''):'',storagePath,timestamp:Date.now(),status:'sent',mediaStatus,mediaError};
}
export async function getSessionProfilePicture(uid:string,jid:string){const s=getWhatsAppSession(uid);if(!s?.socket||s.status!=='connected')throw new Error('Sessão WhatsApp do usuário desconectada.');const cleanJid=String(jid||'').trim();if(!cleanJid||cleanJid.includes('newsletter')||cleanJid==='status@broadcast'||cleanJid.endsWith('@g.us'))throw new Error('JID de contato inválido.');return await s.socket.profilePictureUrl(cleanJid,'image')}
