import { proxyWhatsAppRequest } from './_shared';

export default function handler(req: any, res: any) {
  return proxyWhatsAppRequest(req, res, { method: 'POST', upstreamAction: 'reconnect' });
}
