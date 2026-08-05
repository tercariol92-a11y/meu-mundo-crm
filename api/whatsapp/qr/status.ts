import { proxyWhatsAppRequest, type VercelRequestLike, type VercelResponseLike } from './_shared.js';

export default function handler(req: VercelRequestLike, res: VercelResponseLike) {
  return proxyWhatsAppRequest(req, res, { method: 'GET', upstreamAction: 'status' });
}
