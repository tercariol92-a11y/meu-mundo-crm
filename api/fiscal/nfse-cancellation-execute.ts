import { proxyFiscal } from './_shared.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED', error: 'Método não permitido.' }); }
  const accessKey = String(req.body?.accessKey || '');
  if (!/^\d{50}$/.test(accessKey)) return res.status(400).json({ success: false, code: 'INVALID_NFSE_ACCESS_KEY', error: 'Chave de acesso inválida.' });
  const body = { ...(req.body || {}) };
  delete body.accessKey;
  req.body = body;
  return proxyFiscal(req, res, `/api/fiscal/nfse/authorized/${accessKey}/cancellation/execute`);
}
