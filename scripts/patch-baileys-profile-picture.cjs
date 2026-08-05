const fs = require('fs');
const path = require('path');

const chatsPath = path.join(process.cwd(), 'node_modules/@whiskeysockets/baileys/lib/Socket/chats.js');
const tokenPath = path.join(process.cwd(), 'node_modules/@whiskeysockets/baileys/lib/Utils/tc-token-utils.js');

if (!fs.existsSync(chatsPath) || !fs.existsSync(tokenPath)) {
  console.log('[Baileys Avatar Patch] pacote não encontrado; nenhuma alteração aplicada.');
  process.exit(0);
}

let chats = fs.readFileSync(chatsPath, 'utf8');
const oldChats = `        const baseContent = [{ tag: 'picture', attrs: { type, query: 'url' } }];
        // WA Web only includes tctoken for user JIDs (not groups/newsletters)
        // and never for own profile pic (Chat model for self has no tcToken).
        // Including tctoken for own JID causes the server to never respond.
        const normalizedJid = jidNormalizedUser(jid);
        const isUserJid = isPnUser(normalizedJid) || isLidUser(normalizedJid);
        const me = authState.creds.me;
        const isSelf = me && (normalizedJid === jidNormalizedUser(me.id) || (me.lid && normalizedJid === jidNormalizedUser(me.lid)));
        let content = baseContent;
        if (serverProps.profilePicPrivacyToken && isUserJid && !isSelf) {
            content = await buildTcTokenFromJid({
                authState,
                jid: normalizedJid,
                baseContent,
                getLIDForPN
            });
        }
        jid = jidNormalizedUser(jid);`;
const newChats = `        const picture = { tag: 'picture', attrs: { type, query: 'url' } };
        // WA Web requires the trusted-contact token inside the picture node.
        const normalizedJid = jidNormalizedUser(jid);
        const isUserJid = isPnUser(normalizedJid) || isLidUser(normalizedJid);
        const me = authState.creds.me;
        const isSelf = me && (normalizedJid === jidNormalizedUser(me.id) || (me.lid && normalizedJid === jidNormalizedUser(me.lid)));
        if (serverProps.profilePicPrivacyToken && isUserJid && !isSelf) {
            const tcTokenContent = await buildTcTokenFromJid({ authState, jid: normalizedJid, getLIDForPN });
            if (tcTokenContent?.length) picture.content = tcTokenContent;
        }
        const content = [picture];
        jid = jidNormalizedUser(jid);`;

if (chats.includes(oldChats)) chats = chats.replace(oldChats, newChats);
else if (!chats.includes('const content = [picture];')) throw new Error('Formato inesperado em chats.js; patch não aplicado.');
fs.writeFileSync(chatsPath, chats);

let token = fs.readFileSync(tokenPath, 'utf8');
token = token.replace(
  `        const tcTokenBuffer = entry?.token;\n        if (!tcTokenBuffer?.length || isTcTokenExpired(entry?.timestamp)) {`,
  `        const tcTokenBuffer = entry?.token;\n        const timestamp = entry?.timestamp;\n        if (!tcTokenBuffer?.length || timestamp === undefined || isTcTokenExpired(timestamp)) {`
);
token = token.replace(`            attrs: {},\n            content: tcTokenBuffer`, `            attrs: { t: String(timestamp) },\n            content: tcTokenBuffer`);
if (!token.includes(`attrs: { t: String(timestamp) }`)) throw new Error('Formato inesperado em tc-token-utils.js; patch não aplicado.');
fs.writeFileSync(tokenPath, token);

console.log('[Baileys Avatar Patch] correção oficial de tctoken aplicada.');
