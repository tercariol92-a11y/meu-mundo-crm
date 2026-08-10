import { gzipSync, gunzipSync } from 'node:zlib';
export const xmlToGzipBuffer = (xml: string) => gzipSync(Buffer.from(xml, 'utf8'));
export const gzipBufferToBase64 = (buffer: Buffer) => buffer.toString('base64');
export const base64ToGzipBuffer = (value: string) => Buffer.from(value, 'base64');
export const gzipBufferToXml = (buffer: Buffer) => gunzipSync(buffer).toString('utf8');
