import { proxyFiscal } from './_shared';
export default (req: any, res: any) => proxyFiscal(req, res, '/api/fiscal/certificate/stored/validate');
