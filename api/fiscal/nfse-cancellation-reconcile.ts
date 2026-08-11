import { proxyFiscal } from './_shared.js';

export default async function handler(req: any, res: any) {
  const accessKey = String(req.body?.accessKey || '');
  if (!/^\d{50}$/.test(accessKey)) return res.status(400).json({ success: false, code: 'INVALID_NFSE_ACCESS_KEY', error: 'Chave de acesso inválida.' });
  return proxyFiscal(req, res, `/api/fiscal/nfse/authorized/${accessKey}/cancellation/reconcile`);
}
