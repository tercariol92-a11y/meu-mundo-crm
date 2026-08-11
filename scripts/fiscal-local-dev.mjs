import express from 'express';
import { createServer as createViteServer } from 'vite';

const app = express();
app.use(express.json({ limit: '25mb' }));

const routeMap = new Map([
  ['/api/fiscal/certificate-validate', '/api/fiscal/certificate/validate'],
  ['/api/fiscal/mtls-test', '/api/fiscal/mtls/test'],
  ['/api/fiscal/xml-sign-test', '/api/fiscal/xml/sign-test'],
  ['/api/fiscal/phase2-discover', '/api/fiscal/phase2/discover-contract'],
  ['/api/fiscal/nfse-prepare-final', '/api/fiscal/nfse/prepare-final-test'],
  ['/api/fiscal/nfse-issue', '/api/fiscal/nfse/issue-restricted'],
  ['/api/fiscal/nfse-issue-restricted', '/api/fiscal/nfse/issue-restricted'],
  ['/api/fiscal/phase3-transmit-first', '/api/fiscal/phase3/transmit-first-restricted'],
  ['/api/fiscal/nfse-reconcile', '/api/fiscal/nfse/reconcile-authorized'],
]);

const cancellationRouteMap = new Map([
  ['/api/fiscal/nfse-cancellation-prepare', 'prepare'],
  ['/api/fiscal/nfse-cancellation-reconcile', 'reconcile'],
  ['/api/fiscal/nfse-cancellation-execute', 'execute'],
]);

async function proxyFiscal(req, res) {
  const cancellationAction = cancellationRouteMap.get(req.path);
  const accessKey = String(req.body?.accessKey || '');
  if (cancellationAction && !/^\d{50}$/.test(accessKey)) return res.status(400).json({ success: false, code: 'INVALID_NFSE_ACCESS_KEY', error: 'Chave de acesso inválida.' });
  const targetPath = cancellationAction
    ? `/api/fiscal/nfse/authorized/${accessKey}/cancellation/${cancellationAction}`
    : routeMap.get(req.path);
  if (!targetPath) return res.status(404).json({ success: false, error: 'Rota fiscal local não encontrada.' });

  const upstream = await fetch(new URL(targetPath, 'http://127.0.0.1:3002'), {
    method: 'POST',
    headers: {
      authorization: String(req.headers.authorization || ''),
      'x-internal-secret': String(process.env.FISCAL_SERVICE_INTERNAL_SECRET || ''),
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(req.body || {}),
  });
  const body = await upstream.text();
  res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(body);
}

for (const route of routeMap.keys()) app.post(route, proxyFiscal);
for (const route of cancellationRouteMap.keys()) app.post(route, proxyFiscal);

app.get('/api/fiscal/environment', async (req, res) => {
  const upstream = await fetch('http://127.0.0.1:3002/api/fiscal/environment', { headers: { authorization: String(req.headers.authorization || ''), 'x-internal-secret': String(process.env.FISCAL_SERVICE_INTERNAL_SECRET || ''), accept: 'application/json' } });
  res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(await upstream.text());
});

app.get('/api/fiscal/nfse-xml', async (req, res) => {
  const accessKey = encodeURIComponent(String(req.query.accessKey || ''));
  const upstream = await fetch(`http://127.0.0.1:3002/api/fiscal/nfse/authorized/${accessKey}/xml`, { headers: { authorization: String(req.headers.authorization || ''), 'x-internal-secret': String(process.env.FISCAL_SERVICE_INTERNAL_SECRET || ''), accept: 'application/json' } });
  res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(await upstream.text());
});

app.get('/api/fiscal/nfse-danfse-v2', async (req, res) => {
  const accessKey = encodeURIComponent(String(req.query.accessKey || ''));
  const upstream = await fetch(`http://127.0.0.1:3002/api/fiscal/nfse/authorized/${accessKey}/danfse-v2`, { headers: { authorization: String(req.headers.authorization || ''), 'x-internal-secret': String(process.env.FISCAL_SERVICE_INTERNAL_SECRET || ''), accept: 'application/json' } });
  res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(await upstream.text());
});

app.get('/api/fiscal/file-download', async (req, res) => {
  const token = encodeURIComponent(String(req.query.token || ''));
  const upstream = await fetch(`http://127.0.0.1:3002/api/fiscal/file-download?token=${token}`, { headers: { 'x-internal-secret': String(process.env.FISCAL_SERVICE_INTERNAL_SECRET || '') } });
  res.status(upstream.status);
  for (const header of ['content-type', 'content-disposition', 'content-length']) {
    const value = upstream.headers.get(header); if (value) res.setHeader(header, value);
  }
  res.send(Buffer.from(await upstream.arrayBuffer()));
});

app.get('/api/fiscal/nfse-danfse', async (req, res) => {
  return res.status(405).json({ success: false, error: 'Método não permitido.' });
});

app.post('/api/fiscal/nfse-danfse', async (req, res) => {
  const accessKey = encodeURIComponent(String(req.query.accessKey || ''));
  const upstream = await fetch(`http://127.0.0.1:3002/api/fiscal/nfse/authorized/${accessKey}/danfse`, { method: 'POST', headers: { authorization: String(req.headers.authorization || ''), 'x-internal-secret': String(process.env.FISCAL_SERVICE_INTERNAL_SECRET || ''), 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(req.body || {}) });
  res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(await upstream.text());
});

const vite = await createViteServer({
  configFile: 'vite.config.ts',
  root: process.cwd(),
  server: { middlewareMode: true, hmr: false },
  appType: 'spa',
});
app.use(vite.middlewares);
app.listen(3000, '127.0.0.1', () => console.log('Fiscal UI local em http://127.0.0.1:3000'));
