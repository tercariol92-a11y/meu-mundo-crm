import makeWASocket, { Browsers, DisconnectReason, WASocket, downloadMediaMessage, fetchLatestBaileysVersion, proto, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { createSatisfactionRequest, detectSatisfactionScore, hasPendingSatisfactionRequest, processSatisfactionResponse } from './satisfactionService';

export type SessionStatus = 'disconnected'|'connecting'|'qrcode'|'connected'|'error';
export type WhatsAppSession = { userId:string; sessionId:string; socket:WASocket|null; status:SessionStatus; phone:string; qrCodeDataUrl:string; lastConnectedAt:string|null; reconnectAttempts:number; authDirectory:string; reconnectTimer?:ReturnType<typeof setTimeout>; qrExpiryTimer?:ReturnType<typeof setTimeout>; connectTimeoutTimer?:ReturnType<typeof setTimeout>; generation:number; createdAtMs:number; lastStatusAtMs:number; lastError:string };
const sessions = new Map<string,WhatsAppSession>();
const activeSessionByUid = new Map<string,string>();
const logger = pino({level:'silent'});
let db:any=null;
let mediaBucket:Bucket|null=null;
const ROOT=path.resolve(process.env.BAILEYS_AUTH_ROOT||path.join(process.cwd(),'auth_info_baileys'));
const safeUid=(uid:string)=>{if(!/^[A-Za-z0-9_-]{6,128}$/.test(uid))throw new Error('UID inválido.');return uid};
const sessionIdOf=(uid:string,phone:string)=>`${safeUid(uid)}_${String(phone||'pending').replace(/\D/g,'')||'pending'}`;
const groupDocId=(sessionId:string,jid:string)=>`${sessionId}_${jid.replace(/@g\.us$/,'').replace(/[^A-Za-z0-9_-]/g,'_')}`;
const phoneOf=(jid:string)=>jid.split('@')[0].split(':')[0].replace(/\D/g,'');
async function persistPublicFile(buffer:Buffer,storagePath:string,contentType:string,metadata:Record<string,string>,useSignedUrl=false){
  const bucket=mediaBucket;
  if(!bucket)throw new Error('FIREBASE_STORAGE_BUCKET_NOT_CONFIGURED');
  const [bucketExists]=await bucket.exists();
  if(!bucketExists)throw new Error('FIREBASE_STORAGE_BUCKET_NOT_FOUND');
  const token=randomUUID();
  const file=bucket.file(storagePath);
  await file.save(buffer,{resumable:false,metadata:{contentType,cacheControl:'public,max-age=86400',metadata:{firebaseStorageDownloadTokens:token,...metadata}}});
  if(useSignedUrl){
    const [signedUrl]=await file.getSignedUrl({action:'read',expires:Date.now()+24*60*60*1000});
    console.log('[STORAGE SIGNED URL]',{storagePath,expiresInHours:24,success:true});
    return {mediaUrl:signedUrl,storagePath};
  }
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
const responseWindowId=(sessionId:string,conversationId:string)=>`${sessionId}_${conversationId}`.replace(/[^A-Za-z0-9_-]/g,'_');
async function recordIncomingResponseWindow(s:WhatsAppSession,conversationId:string,phone:string,contactName:string,assignedUserId:string,assignedUserName:string,messageId:string){
  const ref=db.collection('whatsapp_response_windows').doc(responseWindowId(s.sessionId,conversationId));
  await db.runTransaction(async(tx:any)=>{const snap=await tx.get(ref);const current=snap.exists?snap.data():null;if(current?.status==='pending'){tx.set(ref,{messageCount:FieldValue.increment(1),lastIncomingMessageId:messageId,lastIncomingAtMs:Date.now(),updatedAt:FieldValue.serverTimestamp()},{merge:true});return;}tx.set(ref,{firebaseUid:s.userId,sessionId:s.sessionId,conversationId,phone,contactName,assignedUserId,assignedUserName,status:'pending',startedAtMs:Date.now(),firstIncomingMessageId:messageId,lastIncomingMessageId:messageId,messageCount:1,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});});
}
async function recordHumanResponse(s:WhatsAppSession,conversationId:string,phone:string,messageId:string,context:Record<string,any>){
  if(context.manualFromAtendimento!==true)return;
  const windowRef=db.collection('whatsapp_response_windows').doc(responseWindowId(s.sessionId,conversationId));
  await db.runTransaction(async(tx:any)=>{const snap=await tx.get(windowRef);if(!snap.exists)return;const waiting=snap.data();if(waiting.status!=='pending'||!waiting.startedAtMs)return;const respondedAtMs=Date.now();const responseTimeMinutes=Math.max(0,Math.round((respondedAtMs-Number(waiting.startedAtMs))/60000));const metricRef=db.collection('whatsapp_response_metrics').doc(messageId);tx.set(metricRef,{firebaseUid:s.userId,sessionId:s.sessionId,conversationId,phone,contactName:waiting.contactName||'',attendantId:String(context.attendantId||s.userId),attendantName:String(context.attendantName||'Atendente'),firstIncomingMessageId:waiting.firstIncomingMessageId,responseMessageId:messageId,messageCount:waiting.messageCount||1,startedAtMs:waiting.startedAtMs,respondedAtMs,responseTimeMinutes,status:'answered',createdAt:FieldValue.serverTimestamp()});tx.set(windowRef,{status:'answered',responseMessageId:messageId,respondedAtMs,responseTimeMinutes,attendantId:String(context.attendantId||s.userId),attendantName:String(context.attendantName||'Atendente'),updatedAt:FieldValue.serverTimestamp()},{merge:true});});
}
async function saveSession(s:WhatsAppSession,error=''){if(!db)return;const o=await owner(s.userId);if(error)s.lastError=error;await db.collection('whatsapp_sessions').doc(s.userId).set({userId:s.userId,firebaseUid:s.userId,sessionId:s.sessionId,instanceId:s.sessionId,connectedPhone:s.phone,userName:o.name,userEmail:o.email,phone:s.phone,sessionName:`whatsapp_${s.sessionId}`,status:s.status,qrCodeDataUrl:s.qrCodeDataUrl,lastConnectedAt:s.lastConnectedAt,connectedAt:s.lastConnectedAt,lastSeen:FieldValue.serverTimestamp(),lastError:s.lastError,provider:'baileys',isActive:s.status==='connected',updatedAt:FieldValue.serverTimestamp()},{merge:true})}
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
    const storagePath = `whatsapp-sessions/${s.userId}/${s.sessionId}/media/${scope}/${id}/${fileName}`;
    console.log(`[WhatsApp Media] mídia baixada; messageId=${id}; bytes=${buffer.length}`);
    const stored=await persistPublicFile(buffer,storagePath,mimetype,{fileName,telefone:scope,messageId:id,origem:'WhatsApp QR Code',ownerUserId:s.userId},true);
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

function whatsappTimestampMillis(value: any): number {
  if (typeof value === 'number') return value < 10_000_000_000 ? value * 1000 : value;
  if (typeof value === 'bigint') return Number(value) * 1000;
  if (value && typeof value.toNumber === 'function') return value.toNumber() * 1000;
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? (numeric < 10_000_000_000 ? numeric * 1000 : numeric) : Date.now();
}

/**
 * Persists history without running the live-message side effects (unread
 * counters, satisfaction surveys, response-time metrics or notifications).
 */
async function saveHistoricalMessage(s: WhatsAppSession, msg: any) {
  const jid = String(msg?.key?.remoteJid || '');
  if (!jid || jid === 'status@broadcast' || jid.includes('newsletter')) return false;
  const extracted = extract(msg?.message);
  const messageId = String(msg?.key?.id || '');
  if (!extracted || !messageId) return false;
  const occurredAtMs = whatsappTimestampMillis(msg.messageTimestamp);
  const occurredAt = new Date(occurredAtMs);
  const common = {
    messageId, metaMessageId: messageId, body: extracted.body, mensagem: extracted.body,
    type: extracted.type, direction: msg.key.fromMe ? 'out' : 'in', fromMe: Boolean(msg.key.fromMe),
    status: msg.key.fromMe ? 'sent' : 'received', ownerUserId: s.userId, firebaseUid: s.userId,
    whatsappOwnerUserId: s.userId, whatsappSessionId: s.sessionId, sessionId: s.sessionId,
    connectedPhone: s.phone, sessionPhone: s.phone, remoteJid: jid, jid, chatId: jid,
    participantJid: String(msg.key.participant || msg.participant || ''),
    originalMessageTimestampMs: occurredAtMs, timestamp: occurredAt, createdAt: occurredAt,
    importedFromWhatsAppHistory: true, historyImportedAt: FieldValue.serverTimestamp(),
    // Historical media is intentionally not downloaded in bulk. The record
    // remains visible and can be hydrated separately without exhausting storage.
    ...(extracted.type !== 'text' ? { mediaStatus: 'history_metadata_only' } : {})
  };

  if (jid.endsWith('@g.us')) {
    const groupId = groupDocId(s.sessionId, jid);
    const groupRef = db.collection('whatsapp_groups').doc(groupId);
    const messageRef = groupRef.collection('messages').doc(messageId);
    if ((await messageRef.get()).exists) return false;
    await messageRef.set({ ...common, groupId, isGroup: true });
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      await groupRef.set({
        firebaseUid: s.userId, ownerUserId: s.userId, whatsappSessionId: s.sessionId,
        sessionId: s.sessionId, connectedPhone: s.phone, groupId, groupJid: jid,
        remoteJid: jid, name: msg.pushName || 'Grupo WhatsApp', subject: msg.pushName || 'Grupo WhatsApp',
        isGroup: true, lastMessage: extracted.body, lastMessageAt: occurredAt,
        lastMessageId: messageId, unreadCount: 0, importedFromWhatsAppHistory: true,
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    return true;
  }

  const rawJid = jid.endsWith('@lid') ? String(msg.key.remoteJidAlt || '') : jid;
  if (!rawJid.endsWith('@s.whatsapp.net')) return false;
  const phone = phoneOf(rawJid);
  if (!phone) return false;
  const leads = db.collection('leads');
  const ownedLead = await leads.where('whatsappSessionId', '==', s.sessionId).where('telefone', '==', phone).limit(1).get();
  const leadRef = ownedLead.empty ? leads.doc() : ownedLead.docs[0].ref;
  const leadSnap = await leadRef.get();
  const messageRef = leadRef.collection('messages').doc(messageId);
  if ((await messageRef.get()).exists) return false;
  await messageRef.set({ ...common, telefone: phone, phone, remoteJid: rawJid, jid: rawJid, chatId: rawJid });
  if (!leadSnap.exists) {
    const ownerData = await owner(s.userId);
    await leadRef.set({
      nome: msg.pushName || phone, telefone: phone, phone, whatsapp: phone, channel: 'whatsapp_qr',
      ownerUserId: s.userId, ownerUserName: ownerData.name, ownerUserEmail: ownerData.email,
      firebaseUid: s.userId, whatsappOwnerUserId: s.userId, whatsappSessionId: s.sessionId,
      sessionId: s.sessionId, connectedPhone: s.phone, sessionPhone: s.phone, jid: rawJid, chatId: rawJid,
      assignedUserId: s.userId, assignedUserName: ownerData.name, ultimaMensagem: extracted.body,
      lastMessage: extracted.body, lastMessageAt: occurredAt, lastMessageId: messageId,
      status: 'Novo', unreadCount: 0, importedFromWhatsAppHistory: true,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
  }
  return true;
}

async function importWhatsAppHistory(s: WhatsAppSession, messages: any[], progress?: number, isLatest?: boolean) {
  if (!isCurrentSession(s.userId, s)) return;
  // During pairing Baileys may deliver history before connection.open changes
  // the pending session id to the definitive phone-scoped id.
  if (s.status !== 'connected' || !s.phone) {
    setTimeout(() => void importWhatsAppHistory(s, messages, progress, isLatest), 1000);
    return;
  }
  let imported = 0;
  let ignored = 0;
  for (const message of messages) {
    try { (await saveHistoricalMessage(s, message)) ? imported++ : ignored++; }
    catch (error) { ignored++; console.error('[WHATSAPP HISTORY MESSAGE ERROR]', { firebaseUid: s.userId, messageId: message?.key?.id || '', error: error instanceof Error ? error.message : 'falha desconhecida' }); }
  }
  await db.collection('whatsapp_sessions').doc(s.userId).set({
    historySyncStatus: isLatest ? 'complete' : 'syncing', historySyncProgress: Number(progress || 0),
    historyMessagesImported: FieldValue.increment(imported), historyMessagesIgnored: FieldValue.increment(ignored),
    historyLastBatchAt: FieldValue.serverTimestamp(), ...(isLatest ? { historySyncedAt: FieldValue.serverTimestamp() } : {})
  }, { merge: true });
  console.log('[WHATSAPP HISTORY SYNC]', { firebaseUid: s.userId, sessionId: s.sessionId, imported, ignored, progress, isLatest });
}

async function refreshContactAvatar(s: WhatsAppSession, msg: any, phone: string, leadData: any) {
  if (msg.key.fromMe || !s.socket) return {};
  const updatedAt = timestampMillis(leadData?.profilePictureUpdatedAt);
  if (updatedAt && Date.now() - updatedAt < 24 * 60 * 60 * 1000) return {};

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
      // WhatsApp's profile CDN may answer with application/octet-stream even
      // though profilePictureUrl(..., 'image') returns JPEG bytes. Persisting
      // that header makes browsers refuse the avatar as an <img>.
      const contentType = 'image/jpeg';
      const storagePath = `whatsapp-sessions/${s.userId}/${s.sessionId}/profile-pictures/${phone}.jpg`;
      const stored=await persistPublicFile(buffer,storagePath,contentType,{telefone:phone,origem:'WhatsApp QR Code',ownerUserId:s.userId},true);
      const permanentUrl=stored.mediaUrl;
      console.log(`[WhatsApp Avatar] foto salva; JID=${jid}; telefone=${phone}`);
      return {
        profilePictureUrl: permanentUrl,
        profilePictureUpdatedAt: FieldValue.serverTimestamp(),
        profilePictureJid: jid,
        jid,
        phone
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'indisponível';
      console.log(`[WhatsApp Avatar] foto não disponível; JID=${jid}; motivo=${message}`);
    }
  }
  return { profilePictureUpdatedAt: FieldValue.serverTimestamp() };
}

function normalizeProfileJid(rawJid:string){
  const value=decodeURIComponent(String(rawJid||'').trim());
  if(!value)throw new Error('INVALID_PROFILE_JID');
  if(value==='status@broadcast'||value.includes('newsletter'))throw new Error('INVALID_PROFILE_JID');
  if(value.endsWith('@g.us')||value.endsWith('@s.whatsapp.net'))return value;
  const phone=phoneOf(value);
  if(!phone)throw new Error('INVALID_PROFILE_JID');
  return `${phone}@s.whatsapp.net`;
}

export async function getSessionProfilePicture(uid:string,rawJid:string,force=false,requestedSessionId='',contactId=''){
  const s=getWhatsAppSession(uid);
  if(!s?.socket||s.status!=='connected')throw new Error('WHATSAPP_SESSION_DISCONNECTED');
  if(requestedSessionId&&requestedSessionId!==s.sessionId)throw new Error('WHATSAPP_SESSION_MISMATCH');
  const jid=normalizeProfileJid(rawJid);
  const isGroup=jid.endsWith('@g.us');
  const phone=phoneOf(jid);
  const collectionName=isGroup?'whatsapp_groups':'leads';
  const collection=db.collection(collectionName);
  const queryField=isGroup?'remoteJid':'telefone';
  const queryValue=isGroup?jid:phone;
  let snapshot:any=null;
  const safeContactId=String(contactId||'').replace(/^group:/,'').trim();
  if(safeContactId){const direct=await collection.doc(safeContactId).get();const directData=direct.data();if(direct.exists&&(directData?.whatsappSessionId===s.sessionId||directData?.sessionId===s.sessionId))snapshot=direct}
  if(!snapshot){const sessionDocuments=await collection.where('whatsappSessionId','==',s.sessionId).get();snapshot=sessionDocuments.docs.find((document:any)=>document.data()?.[queryField]===queryValue)||null}
  if(!snapshot) snapshot=null;
  const ref=snapshot?.ref||(isGroup?collection.doc(groupDocId(s.sessionId,jid)):collection.doc());
  const current=snapshot?.data()||{};
  const cachedUrl=String(current.profilePictureUrl||current.groupPhotoUrl||current.profilePicture||current.avatarUrl||current.photoUrl||current.picture||'').trim();
  const updatedAt=timestampMillis(current.profilePictureUpdatedAt);
  const cacheExpired=!updatedAt||Date.now()-updatedAt>=24*60*60*1000;
  console.log('[PROFILE PICTURE LOOKUP]',{uid,jid,hasCachedUrl:Boolean(cachedUrl),cacheExpired});
  if(!force&&!cacheExpired)return cachedUrl||null;
  try{
    const temporaryUrl=await s.socket.profilePictureUrl(jid,'image').catch((error:any)=>{
      const code=Number(error?.output?.statusCode||error?.status||0);
      if(code===401||code===403||code===404)return undefined;
      throw error;
    });
    const baseFields={firebaseUid:uid,sessionId:s.sessionId,whatsappSessionId:s.sessionId,connectedPhone:s.phone,contactId:ref.id,contactJid:jid,jid,phone,contactName:current.nome||current.name||current.subject||current.pushName||(isGroup?'Grupo WhatsApp':'Contato WhatsApp'),profilePictureUpdatedAt:FieldValue.serverTimestamp(),profilePictureLastCheckedAt:FieldValue.serverTimestamp()};
    if(!temporaryUrl){
      await ref.set({...baseFields,profilePictureStatus:'unavailable'},{merge:true});
      console.log('[PROFILE PICTURE RESULT]',{jid,found:false,stored:false});
      return null;
    }
    const response=await fetch(temporaryUrl);
    if(!response.ok){
      if([401,403,404].includes(response.status)){
        await ref.set({...baseFields,profilePictureStatus:'unavailable'},{merge:true});
        console.log('[PROFILE PICTURE RESULT]',{jid,found:false,stored:false});
        return null;
      }
      throw new Error(`PROFILE_DOWNLOAD_HTTP_${response.status}`);
    }
    const buffer=Buffer.from(await response.arrayBuffer());
    // Profile pictures returned in image mode are JPEGs. Do not propagate the
    // temporary CDN's generic application/octet-stream header to Storage.
    const contentType='image/jpeg';
    const safeJid=jid.replace(/[^A-Za-z0-9@._-]/g,'_');
    const stored=await persistPublicFile(buffer,`whatsapp-sessions/${uid}/${s.sessionId}/profile-pictures/${safeJid}.jpg`,contentType,{jid,phone,origem:'WhatsApp QR Code',ownerUserId:uid,sessionId:s.sessionId},true);
    await ref.set({...baseFields,profilePictureUrl:stored.mediaUrl,profilePictureStoragePath:`whatsapp-sessions/${uid}/${s.sessionId}/profile-pictures/${safeJid}.jpg`,profilePictureStatus:'ready'},{merge:true});
    console.log('[PROFILE PICTURE RESULT]',{jid,found:true,stored:true});
    return stored.mediaUrl;
  }catch(error){
    const errorCode=error instanceof Error?error.message:'PROFILE_LOOKUP_FAILED';
    console.error('[PROFILE PICTURE ERROR]',{jid,errorCode});
    throw error;
  }
}
async function onMessage(s:WhatsAppSession,msg:any){
  const jid=msg.key.remoteJid||'';
  if(!jid.endsWith('@g.us'))return;
  const x=extract(msg.message);if(!x)return;
  const id=msg.key.id||`msg-${Date.now()}`;
  const meta=await s.socket!.groupMetadata(jid);
  const gid=groupDocId(s.sessionId,jid);
  const ref=db.collection('whatsapp_groups').doc(gid);
  const mref=ref.collection('messages').doc(id);
  if((await mref.get()).exists)return;
  const participant=msg.key.participant||msg.participant||'';
  const pname=msg.key.fromMe?'WhatsApp Web':msg.pushName||phoneOf(participant)||'Participante';
  const media=await saveMedia(s,msg,`group-${gid}`,id);
  const sessionFields={firebaseUid:s.userId,ownerUserId:s.userId,whatsappOwnerUserId:s.userId,whatsappSessionId:s.sessionId,sessionId:s.sessionId,connectedPhone:s.phone,sessionPhone:s.phone,jid,chatId:jid};
  await mref.set({...sessionFields,messageId:id,remoteJid:jid,groupId:gid,groupName:meta.subject,isGroup:true,participantJid:participant,participantPhone:phoneOf(participant),participantName:pname,body:x.body,mensagem:x.body,type:x.type,direction:msg.key.fromMe?'out':'in',fromMe:!!msg.key.fromMe,status:msg.key.fromMe?'sent':'received',sentByUserId:null,...media,timestamp:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp()});
  await ref.set({...sessionFields,groupId:gid,groupJid:jid,remoteJid:jid,name:meta.subject,subject:meta.subject,participantsCount:meta.participants.length,isGroup:true,lastMessage:`${pname}: ${x.body}`,lastMessageAt:FieldValue.serverTimestamp(),lastMessageId:id,...(!msg.key.fromMe?{unreadCount:FieldValue.increment(1)}:{}),updatedAt:FieldValue.serverTimestamp()},{merge:true});
}

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
  const ownedLead = await leads.where('whatsappSessionId', '==', s.sessionId).where('telefone', '==', phone).limit(1).get();
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
    firebaseUid: s.userId, whatsappOwnerUserId: s.userId, whatsappSessionId: s.sessionId, sessionId: s.sessionId,
    connectedPhone: s.phone, sessionPhone: s.phone, jid: rawJid, chatId: rawJid, sentByUserId: null, ...media,
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
    ownerUserEmail: ownerData.email, firebaseUid: s.userId, whatsappOwnerUserId: s.userId, whatsappSessionId: s.sessionId, sessionId: s.sessionId,
    connectedPhone: s.phone, sessionPhone: s.phone, jid: rawJid, chatId: rawJid, assignedUserId: leadData?.assignedUserId || s.userId,
    assignedUserName: leadData?.assignedUserName || ownerData.name,
    ...avatarFields,
    ultimaMensagem: extracted.body, lastMessage: extracted.body, lastMessageAt: timestamp, lastMessageId: messageId,
    ...(keepFinalized
      ? { status: 'Finalizado', attendanceStatus: 'Finalizado', unreadCount: 0 }
      : { status: 'Em atendimento', ...(!msg.key.fromMe ? { unreadCount: FieldValue.increment(1) } : {}) }),
    updatedAt: timestamp
  }, { merge: true });
  if(!msg.key.fromMe)await recordIncomingResponseWindow(s,leadRef.id,phone,leadData?.nome||msg.pushName||'Contato WhatsApp',leadData?.assignedUserId||s.userId,leadData?.assignedUserName||ownerData.name,messageId);
}

export function initWhatsAppSessions(database:any,bucket:Bucket|null=null){db=database;mediaBucket=bucket;return initializeExistingSessions()}
export function getWhatsAppSession(uid:string){const safe=safeUid(uid);const sessionId=activeSessionByUid.get(safe);return sessionId?sessions.get(sessionId)||null:null}
export function getWhatsAppSocket(uid:string){return getWhatsAppSession(uid)?.socket||null}
const isCurrentSession=(uid:string,s:WhatsAppSession)=>getWhatsAppSession(uid)===s;
export async function connectWhatsApp(uid:string,force=false,resetCredentials=false){
  safeUid(uid);const old=getWhatsAppSession(uid);
  const oldIsStale=Boolean(old&&['connecting','qrcode','error'].includes(old.status)&&Date.now()-old.lastStatusAtMs>90_000);
  if(old?.socket&&!force&&!oldIsStale&&(old.status==='connected'||old.status==='connecting'||old.status==='qrcode'))return;
  if(old?.reconnectTimer)clearTimeout(old.reconnectTimer);
  if(old?.qrExpiryTimer)clearTimeout(old.qrExpiryTimer);
  if(old?.connectTimeoutTimer)clearTimeout(old.connectTimeoutTimer);
  try{old?.socket?.ev.removeAllListeners();old?.socket?.end(undefined)}catch{}
  if(old)sessions.delete(old.sessionId);
  const authDirectory=path.join(ROOT,uid);
  if(resetCredentials)await fs.promises.rm(authDirectory,{recursive:true,force:true});
  const pendingId=sessionIdOf(uid,'');
  const now=Date.now();
  const s:WhatsAppSession={userId:uid,sessionId:pendingId,socket:null,status:'connecting',phone:'',qrCodeDataUrl:'',lastConnectedAt:null,reconnectAttempts:old?.reconnectAttempts||0,authDirectory,generation:(old?.generation||0)+1,createdAtMs:now,lastStatusAtMs:now,lastError:''};
  sessions.set(pendingId,s);activeSessionByUid.set(uid,pendingId);
  await fs.promises.mkdir(s.authDirectory,{recursive:true});
  console.log('[WHATSAPP SESSION ACTIVE]',{firebaseUid:uid,sessionId:s.sessionId,connectedPhone:''});
  const auth=await useMultiFileAuthState(s.authDirectory);
  const versionResult=await fetchLatestBaileysVersion({signal:AbortSignal.timeout(15_000)});
  if(!versionResult.isLatest)console.warn('[WHATSAPP VERSION FALLBACK]',{firebaseUid:uid,error:versionResult.error instanceof Error?versionResult.error.message:'versão local da biblioteca'});
  const socket=makeWASocket({version:versionResult.version,auth:auth.state,logger,browser:Browsers.macOS('Chrome'),printQRInTerminal:false,syncFullHistory:true,markOnlineOnConnect:false,shouldSyncHistoryMessage:()=>true});s.socket=socket;
  s.connectTimeoutTimer=setTimeout(()=>{
    if(!isCurrentSession(uid,s)||s.status!=='connecting')return;
    try{s.socket?.ev.removeAllListeners();s.socket?.end(undefined)}catch{}
    s.socket=null;s.status='error';s.lastStatusAtMs=Date.now();s.lastError='QR_CODE_NOT_GENERATED';
    void saveSession(s);
  },30_000);
  socket.ev.on('creds.update',auth.saveCreds);
  socket.ev.on('messaging-history.set',event=>{
    if(!isCurrentSession(uid,s))return;
    void importWhatsAppHistory(s,event.messages||[],event.progress,event.isLatest)
      .catch(error=>console.error('[WHATSAPP HISTORY SYNC ERROR]',{firebaseUid:uid,error:error instanceof Error?error.message:'falha desconhecida'}));
  });
  socket.ev.on('messages.upsert',async e=>{if(e.type!=='notify'||!isCurrentSession(uid,s))return;for(const m of e.messages)await onSessionMessage(s,m).catch(err=>console.error(`[WA ${uid}] mensagem:`,err?.message))});
  socket.ev.on('connection.update',async u=>{
    if(!isCurrentSession(uid,s))return;
    if(u.qr){
      if(s.connectTimeoutTimer)clearTimeout(s.connectTimeoutTimer);
      s.status='qrcode';s.lastStatusAtMs=Date.now();s.lastError='';s.qrCodeDataUrl=await QRCode.toDataURL(u.qr);
      if(s.qrExpiryTimer)clearTimeout(s.qrExpiryTimer);
      s.qrExpiryTimer=setTimeout(()=>{if(!isCurrentSession(uid,s)||s.status!=='qrcode')return;try{s.socket?.ev.removeAllListeners();s.socket?.end(undefined)}catch{}s.socket=null;s.status='error';s.lastStatusAtMs=Date.now();s.qrCodeDataUrl='';s.lastError='QR_CODE_EXPIRED';void saveSession(s)},90_000);
      void saveSession(s)
    }
    if(u.connection==='open'){
      if(s.connectTimeoutTimer)clearTimeout(s.connectTimeoutTimer);
      if(s.qrExpiryTimer)clearTimeout(s.qrExpiryTimer);
      const oldSessionId=s.sessionId;s.phone=phoneOf(socket.user?.id||'');s.sessionId=sessionIdOf(uid,s.phone);
      sessions.delete(oldSessionId);sessions.set(s.sessionId,s);activeSessionByUid.set(uid,s.sessionId);
      s.status='connected';s.lastStatusAtMs=Date.now();s.lastConnectedAt=new Date().toISOString();s.reconnectAttempts=0;s.qrCodeDataUrl='';s.lastError='';
      console.log('[WHATSAPP SESSION SWITCH]',{oldSessionId,newSessionId:s.sessionId});
      console.log('[WHATSAPP SESSION ACTIVE]',{firebaseUid:uid,sessionId:s.sessionId,connectedPhone:s.phone});
      void saveSession(s);
    }
    if(u.connection==='close'){
      if(s.connectTimeoutTimer)clearTimeout(s.connectTimeoutTimer);
      if(s.qrExpiryTimer)clearTimeout(s.qrExpiryTimer);
      const code=(u.lastDisconnect?.error as Boom)?.output?.statusCode;s.socket=null;s.status=code===DisconnectReason.loggedOut?'disconnected':'connecting';s.lastStatusAtMs=Date.now();void saveSession(s,String(code||''));
      if(code!==DisconnectReason.loggedOut&&s.reconnectAttempts<6){const delay=Math.min(1000*2**s.reconnectAttempts++,30000);s.reconnectTimer=setTimeout(()=>void connectWhatsApp(uid,true),delay)}
    }
  });
  void saveSession(s);
}

async function deleteSessionHistory(s:WhatsAppSession){
  let conversationsDeleted=0,messagesDeleted=0,mediaDeleted=0;
  for(const collectionName of ['leads','whatsapp_groups']){
    const current=await db.collection(collectionName).where('whatsappSessionId','==',s.sessionId).get();
    const owned=await db.collection(collectionName).where('whatsappOwnerUserId','==',s.userId).get();
    const documents=new Map(current.docs.map((document:any)=>[document.id,document]));
    for(const document of owned.docs){
      const data=document.data();
      if(data.whatsappSessionId===s.userId&&String(data.sessionPhone||data.connectedPhone||'').replace(/\D/g,'')===s.phone)documents.set(document.id,document);
    }
    for(const document of documents.values() as any){
      const data=document.data();
      const messages=await document.ref.collection('messages').get();messagesDeleted+=messages.size;
      if(mediaBucket){
        for(const message of messages.docs){const storagePath=String(message.data().storagePath||'');if(storagePath){await mediaBucket.file(storagePath).delete().catch(()=>undefined);mediaDeleted++}}
      }
      const linked=collectionName==='leads'&&Boolean(data.clienteId||data.clientId||data.linkedClientId);
      if(linked){
        for(const message of messages.docs)await message.ref.delete();
        await document.ref.set({whatsappSessionId:FieldValue.delete(),sessionId:FieldValue.delete(),connectedPhone:FieldValue.delete(),sessionPhone:FieldValue.delete(),ultimaMensagem:FieldValue.delete(),lastMessage:FieldValue.delete(),lastMessageId:FieldValue.delete(),unreadCount:0,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      }else{await db.recursiveDelete(document.ref);conversationsDeleted++}
    }
  }
  const pending=await db.collection('satisfaction_requests').where('whatsappSessionOwnerUid','==',s.userId).get();
  for(const document of pending.docs)if(document.data().status==='pending')await document.ref.delete();
  if(mediaBucket){const [files]=await mediaBucket.getFiles({prefix:`whatsapp-sessions/${s.userId}/${s.sessionId}/`});mediaDeleted+=files.length;await Promise.all(files.map(file=>file.delete().catch(()=>undefined)))}
  console.log('[WHATSAPP HISTORY DELETE]',{sessionId:s.sessionId,conversationsDeleted,messagesDeleted,mediaDeleted});
  return{conversationsDeleted,messagesDeleted,mediaDeleted};
}

export async function disconnectWhatsApp(uid:string,clear=true,clearHistory=true){
  const s=getWhatsAppSession(safeUid(uid));if(!s)return{sessionId:'',conversationsDeleted:0,messagesDeleted:0,mediaDeleted:0};
  console.log('[WHATSAPP DISCONNECT START]',{sessionId:s.sessionId,connectedPhone:s.phone});
  if(s.reconnectTimer)clearTimeout(s.reconnectTimer);if(s.qrExpiryTimer)clearTimeout(s.qrExpiryTimer);if(s.connectTimeoutTimer)clearTimeout(s.connectTimeoutTimer);try{s.socket?.ev.removeAllListeners();await s.socket?.logout()}catch{try{s.socket?.end(undefined)}catch{}}
  s.socket=null;s.status='disconnected';s.qrCodeDataUrl='';
  const deleted=clearHistory?await deleteSessionHistory(s):{conversationsDeleted:0,messagesDeleted:0,mediaDeleted:0};
  await db.collection('whatsapp_sessions').doc(uid).delete().catch(()=>undefined);
  sessions.delete(s.sessionId);activeSessionByUid.delete(uid);
  if(clear)await fs.promises.rm(s.authDirectory,{recursive:true,force:true});
  return{sessionId:s.sessionId,...deleted};
}
export const reconnectWhatsApp=(uid:string)=>connectWhatsApp(uid,true);
export const generateWhatsAppQr=async(uid:string)=>{const current=getWhatsAppSession(uid);if(current?.status==='connected')return;await connectWhatsApp(uid,true,true)};
export function getWhatsAppStatus(uid:string){const s=getWhatsAppSession(uid);return s?{uid,userId:uid,sessionId:s.sessionId,instanceId:s.sessionId,connectedPhone:s.phone,status:s.status,sessionName:`whatsapp_${s.sessionId}`,sessionPhone:s.phone,qrCodeDataUrl:s.qrCodeDataUrl,lastConnectedAt:s.lastConnectedAt,lastSeen:new Date(s.lastStatusAtMs).toISOString(),lastError:s.lastError}:{uid,userId:uid,sessionId:'',instanceId:'',connectedPhone:'',status:'disconnected',sessionName:'',sessionPhone:'',qrCodeDataUrl:'',lastConnectedAt:null,lastSeen:null,lastError:''}}
export function listWhatsAppSessions(){return[...sessions.values()].map(s=>({userId:s.userId,...getWhatsAppStatus(s.userId)}))}
export async function initializeExistingSessions(){
  if(!fs.existsSync(ROOT))return;
  const entries=await fs.promises.readdir(ROOT,{withFileTypes:true});
  const userIds=entries.filter(e=>e.isDirectory()&&/^[A-Za-z0-9_-]{6,128}$/.test(e.name)).map(e=>e.name);
  const results=await Promise.allSettled(userIds.map(uid=>connectWhatsApp(uid)));
  results.forEach((result,index)=>{if(result.status==='rejected')console.error('[WHATSAPP SESSION RESTORE ERROR]',{firebaseUid:userIds[index],error:result.reason instanceof Error?result.reason.message:'falha desconhecida'})});
}
export async function sendSessionMessage(uid:string,destination:string,text:string,context:Record<string,any>={}){
  const s=getWhatsAppSession(uid);if(!s?.socket||s.status!=='connected')throw new Error('Sessão WhatsApp do usuário desconectada.');
  const isGroup=destination.endsWith('@g.us');
  const normalizedPhone=destination.replace(/\D/g,'');
  if(!isGroup&&!normalizedPhone)throw new Error('Número destinatário inválido.');
  let jid=isGroup?destination:`${normalizedPhone}@s.whatsapp.net`;
  if(!isGroup){
    const availability=await s.socket.onWhatsApp(normalizedPhone);
    const registered=availability?.find(item=>item.exists&&item.jid);
    if(!registered?.jid)throw new Error('O número destinatário não possui WhatsApp.');
    jid=registered.jid;
  }
  const cleanText=String(text||'').trim();
  if(!cleanText)throw new Error('A mensagem não pode estar vazia.');
  const attendantName=String(context.attendantName||'').trim();
  const alreadyIdentified=/^\*[^*\n]+:\*\s*\n/.test(cleanText);
  const whatsappBody=context.manualFromAtendimento===true&&attendantName&&!alreadyIdentified?`*${attendantName}:*\n${cleanText}`:cleanText;
  const sent=await s.socket.sendMessage(jid,{text:whatsappBody});
  const messageId=String(sent?.key.id||'');if(!messageId)throw new Error('O WhatsApp não confirmou o messageId do envio.');
  console.log('[WHATSAPP SEND SUCCESS]',{messageId,remoteJid:jid,sessionId:s.sessionId,firebaseUid:uid});
  if(context.manualFromAtendimento===true){
    const phone=phoneOf(jid);const collectionName=isGroup?'whatsapp_groups':'leads';let parentRef:any=null;
    if(isGroup){parentRef=db.collection(collectionName).doc(context.groupId||groupDocId(s.sessionId,jid))}
    else if(context.conversationId){const hinted=await db.collection(collectionName).doc(String(context.conversationId)).get();if(hinted.exists&&hinted.data()?.whatsappSessionId===s.sessionId)parentRef=hinted.ref}
    if(!parentRef){const field=isGroup?'remoteJid':'telefone';const value=isGroup?jid:phone;const match=await db.collection(collectionName).where('whatsappSessionId','==',s.sessionId).where(field,'==',value).limit(1).get();parentRef=match.empty?db.collection(collectionName).doc():match.docs[0].ref}
    const timestamp=FieldValue.serverTimestamp();
    await parentRef.collection('messages').doc(messageId).set({
      firebaseUid:uid,sessionId:s.sessionId,whatsappSessionId:s.sessionId,connectedPhone:s.phone,sessionPhone:s.phone,jid,remoteJid:jid,chatId:jid,
      messageId,metaMessageId:messageId,conversationId:parentRef.id,telefone:phone,phone,body:cleanText,mensagem:cleanText,text:cleanText,whatsappBody,
      direction:'out',messageDirection:'outbound',fromMe:true,type:'text',status:'sent',senderType:'user',
      attendantId:String(context.attendantId||uid),attendantName,attendantEmail:String(context.attendantEmail||''),
      sentBy:String(context.attendantId||uid),sentByUserId:String(context.attendantId||uid),sentByName:attendantName,
      sender:attendantName,atendente:attendantName,atendenteNome:attendantName,ownerUserId:uid,whatsappOwnerUserId:uid,timestamp,sentAt:timestamp,createdAt:timestamp
    },{merge:true});
    await parentRef.set({assignedUserId:String(context.attendantId||uid),assignedUserName:attendantName,lastMessage:cleanText,ultimaMensagem:cleanText,lastMessageId:messageId,lastMessageAt:timestamp,updatedAt:timestamp},{merge:true});
    if(!isGroup)await recordHumanResponse(s,parentRef.id,phone,messageId,context);
  }
  return{success:true,messageId,sessionId:s.sessionId,firebaseUid:uid,jid,remoteJid:jid,whatsappBody,status:'sent',messages:[{id:messageId}]}
}
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

  const storagePath=`whatsapp-sessions/${uid}/${s.sessionId}/media/${chatId}/${messageId}/${safeFileName}`;
  const timestamp=FieldValue.serverTimestamp();
  const collectionName=isGroup?'whatsapp_groups':'leads';
  let parentRef:any=null;
  if(isGroup){
    const groupId=context.groupId||groupDocId(s.sessionId,chatId);
    parentRef=db.collection(collectionName).doc(groupId);
  }else{
    const hintedId=String(context.leadId||'').trim();
    if(hintedId){
      const hinted=await db.collection(collectionName).doc(hintedId).get();
      const hintedData=hinted.exists?hinted.data():null;
      if(hintedData&&(!hintedData.whatsappOwnerUserId||hintedData.whatsappOwnerUserId===uid))parentRef=hinted.ref;
    }
    if(!parentRef){
      const match=await db.collection(collectionName).where('whatsappSessionId','==',s.sessionId).where('telefone','==',phone).limit(1).get();
      parentRef=match.empty?db.collection(collectionName).doc():match.docs[0].ref;
    }
  }
  const messageRef=parentRef.collection('messages').doc(messageId);
  let stored:{mediaUrl:string;storagePath:string}|null=null;
  let mediaStatus='ready';
  let mediaError='';
  try{
    stored=await persistPublicFile(buffer,storagePath,mimetype,{fileName:safeFileName,chatId,messageId,origem:'WhatsApp QR Code',ownerUserId:uid},true);
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
    attendantName:context.attendantName||'',attendantEmail:context.attendantEmail||'',senderType:'user',
    sentBy:context.attendantId||uid,sentByUserId:context.attendantId||uid,sentByName:context.attendantName||'',sender:context.attendantName||'',atendente:context.attendantName||'',atendenteNome:context.attendantName||'',
    firebaseUid:uid,ownerUserId:uid,whatsappOwnerUserId:uid,whatsappSessionId:s.sessionId,sessionId:s.sessionId,connectedPhone:s.phone,sessionPhone:s.phone,jid:chatId,
    conversationId:context.conversationId||parentRef.id,
    timestamp,createdAt:timestamp
  };
  const batch=db.batch();
  batch.set(messageRef,messageDocument,{merge:true});
  batch.set(parentRef,{firebaseUid:uid,whatsappOwnerUserId:uid,whatsappSessionId:s.sessionId,sessionId:s.sessionId,connectedPhone:s.phone,sessionPhone:s.phone,jid:chatId,chatId,lastMessage:caption||`[${type}] ${safeFileName}`,ultimaMensagem:caption||`[${type}] ${safeFileName}`,lastMessageId:messageId,lastMessageAt:timestamp,updatedAt:timestamp},{merge:true});
  await batch.commit();
  if(!isGroup)await recordHumanResponse(s,parentRef.id,phone,messageId,{...context,manualFromAtendimento:true});
  console.log('[MEDIA FIRESTORE SAVE]',{documentId:messageRef.id,messageId,mediaUrl:stored?.mediaUrl||'',type,mediaStatus});
  return{success:true,delivered:true,messageId,chatId,jid:chatId,remoteJid:chatId,canonicalPhone:phone,type,caption,mimeType:mimetype,mimetype,fileName:safeFileName,fileSize:buffer.length,mediaUrl:stored?.mediaUrl||'',thumbnailUrl:type==='image'?(stored?.mediaUrl||''):'',storagePath,timestamp:Date.now(),status:'sent',mediaStatus,mediaError};
}
