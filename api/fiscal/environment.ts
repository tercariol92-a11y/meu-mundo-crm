import { proxyFiscal } from './_shared.js';

export default (req: any, res: any) => proxyFiscal(req, res, '/api/fiscal/environment', { method: 'GET' });
