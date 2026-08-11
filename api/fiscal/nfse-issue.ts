import { proxyFiscal } from './_shared.js';

export default async function handler(req: any, res: any) {
  return proxyFiscal(req, res, '/api/fiscal/nfse/issue-restricted');
}
