import assert from 'node:assert/strict';
import { shouldAutoCloseInactiveAttendance } from './whatsappInactivity.js';

const now = Date.parse('2026-09-29T15:00:00.000Z');
assert.equal(shouldAutoCloseInactiveAttendance({ status: 'Em atendimento', lastMessageAt: new Date(now - 31 * 60_000) }, now), true);
assert.equal(shouldAutoCloseInactiveAttendance({ status: 'Em atendimento', lastMessageAt: new Date(now - 29 * 60_000) }, now), false);
assert.equal(shouldAutoCloseInactiveAttendance({ status: 'Finalizado', lastMessageAt: new Date(now - 60 * 60_000) }, now), false);
assert.equal(shouldAutoCloseInactiveAttendance({ status: 'Em atendimento', lastMessageAt: new Date(now - 60 * 60_000), pesquisaPendente: true }, now), false);
console.log('WhatsApp inactivity tests: OK');
