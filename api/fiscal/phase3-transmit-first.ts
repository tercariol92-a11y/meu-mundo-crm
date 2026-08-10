import { proxyFiscal } from './_shared';
export default (req: any, res: any) => proxyFiscal(req, res, '/api/fiscal/phase3/transmit-first-restricted');
