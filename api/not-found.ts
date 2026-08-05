type VercelRequestLike = {
  method?: string;
  url?: string;
};

type VercelResponseLike = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponseLike;
  json(payload: Record<string, unknown>): unknown;
};

export default function handler(req: VercelRequestLike, res: VercelResponseLike) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(404).json({ success: false, error: `Endpoint ${req.method} ${req.url} não encontrado.` });
}
