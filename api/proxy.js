export const config = { api: { responseLimit: false, maxDuration: 10 } };

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Cloudflare interstitial pages arrive with 200/403 and "Just a moment..." —
// treating them as success would poison the protobuf parser client-side.
function isChallengeText(text) {
  return typeof text === "string" && text.slice(0, 4096).indexOf("Just a moment") !== -1;
}

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

    var resp = null, lastErr = null, buf = null;
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        resp = await fetch(url, { headers, redirect: "follow" });
        buf = new Uint8Array(await resp.arrayBuffer());
        var head = new TextDecoder().decode(buf.subarray(0, Math.min(buf.length, 4096)));
        if (resp.ok && !isChallengeText(head)) break;
        lastErr = new Error("upstream " + resp.status + (isChallengeText(head) ? " (Cloudflare challenge)" : ""));
        if (resp.status >= 400 && resp.status < 500 && !isChallengeText(head)) break;
        if (attempt === 1) break;
        await new Promise(function (r) { setTimeout(r, 400); });
      } catch (e) { lastErr = e; resp = null; }
    }

    if (!resp || !resp.ok || isChallengeText(new TextDecoder().decode(buf.subarray(0, Math.min(buf.length, 4096))))) {
      return res.status(502).json({
        error: lastErr ? lastErr.message : "upstream failed",
        hint: "Upstream API is rate-limiting server IPs right now. It usually recovers within a minute — the app retries automatically.",
      });
    }

    var ct = resp.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.setHeader("Access-Control-Expose-Headers", "*");
    resp.headers.forEach(function (v, k) { if (k.toLowerCase() === "rb-session") res.setHeader("rb-session", v); });

    res.status(resp.status).send(Buffer.from(buf));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
