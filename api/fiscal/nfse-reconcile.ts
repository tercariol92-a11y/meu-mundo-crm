import { proxyFiscal } from './_shared';
export default (req: any, res: any) => proxyFiscal(req, res, '/api/fiscal/nfse/reconcile-authorized');
