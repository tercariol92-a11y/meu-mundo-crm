import { proxyFiscal } from './_shared';

export default (req: any, res: any) => {
  const accessKey = String(req.body?.accessKey || '');
  if (!/^\d{50}$/.test(accessKey)) return res.status(400).json({ success: false, code: 'INVALID_NFSE_ACCESS_KEY', error: 'Chave de acesso inválida.' });
  const body = { ...(req.body || {}) };
  delete body.accessKey;
  req.body = body;
  return proxyFiscal(req, res, `/api/fiscal/nfse/authorized/${accessKey}/cancellation/prepare`);
};
