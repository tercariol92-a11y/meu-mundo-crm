export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const serviceUrl = process.env.FISCAL_SERVICE_URL?.trim();
    const secret = process.env.FISCAL_SERVICE_INTERNAL_SECRET?.trim();
    if (!serviceUrl || !secret) return res.status(503).end();
    const target = new URL('/api/fiscal/file-download', serviceUrl);
    target.searchParams.set('token', String(req.query?.token || ''));
    const upstream = await fetch(target, { headers: { 'X-Internal-Secret': secret } });
    res.status(upstream.status);
    for (const header of ['content-type', 'content-disposition', 'content-length']) {
      const value = upstream.headers.get(header); if (value) res.setHeader(header, value);
    }
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    return res.status(500).end();
  }
}
