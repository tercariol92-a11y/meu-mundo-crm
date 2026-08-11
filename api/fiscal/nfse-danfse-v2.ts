import { proxyFiscal } from './_shared';

export default (req: any, res: any) => proxyFiscal(
  req,
  res,
  `/api/fiscal/nfse/authorized/${encodeURIComponent(String(req.query?.accessKey || ''))}/danfse-v2`,
  { method: 'GET' },
);
