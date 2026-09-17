const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

export const config = { api: { responseLimit: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', 'rb-session, content-type, content-length');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.query.url;
  const referer = req.query.referer || '';
  const origin = req.query.origin || '';
  const method = req.query.method || 'GET';

  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    const headers = { 'User-Agent': UA };
    if (referer) headers['Referer'] = referer;
    if (origin) headers['Origin'] = origin;

    const resp = await fetch(url, { method, headers, redirect: 'follow' });

    const ct = resp.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);

    const rbSession = resp.headers.get('rb-session');
    if (rbSession) res.setHeader('rb-session', rbSession);

    const cl = resp.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);

    const buf = await resp.arrayBuffer();
    res.status(resp.status).send(Buffer.from(buf));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
