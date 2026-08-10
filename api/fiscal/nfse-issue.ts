import type { VercelRequest, VercelResponse } from '@vercel/node';
import { proxyFiscal } from './_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return proxyFiscal(req, res, '/api/fiscal/nfse/issue-restricted');
}
