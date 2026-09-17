export const config = { api: { responseLimit: false, maxDuration: 10 } };

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    var url = req.query.url;
    var referer = req.query.referer || "";
    var origin = req.query.origin || "";
    if (!url) return res.status(400).json({ error: "url required" });

    var headers = { "User-Agent": UA };
    if (referer) headers["Referer"] = referer;
    if (origin) headers["Origin"] = origin;

    var resp = await fetch(url, { headers, redirect: "follow" });
    var buf = new Uint8Array(await resp.arrayBuffer());

    var ct = resp.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.setHeader("Access-Control-Expose-Headers", "*");
    resp.headers.forEach((v, k) => { if (k.toLowerCase() === "rb-session") res.setHeader("rb-session", v); });

    res.status(resp.status).send(Buffer.from(buf));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
