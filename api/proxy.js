export const config = { api: { responseLimit: false, maxDuration: 60 } };

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Cloudflare interstitial pages arrive with 200/403 and "Just a moment..." —
// treating them as success would poison the protobuf parser client-side.
function isChallengeText(text) {
  return typeof text === "string" && text.slice(0, 4096).indexOf("Just a moment") !== -1;
}

// Crowd cache: visitors with clean IPs seed it on success; challenged IPs read it on failure.
var CACHE = {};
var CACHE_TTL_MS = 90000;

function cacheKey(url) {
  try { var u = new URL(url); return u.pathname + (u.search || ""); } catch (e) { return url; }
}

// Residential/anti-bot service fallback: only used when direct + crowd cache both fail.
function serviceUrl(url) {
  var k;
  if ((k = process.env.SCRAPERAPI_KEY)) return "https://api.scraperapi.com/?api_key=" + k + "&url=" + encodeURIComponent(url);
  if ((k = process.env.SCRAPINGBEE_KEY)) return "https://app.scrapingbee.com/api/v1/?api_key=" + k + "&url=" + encodeURIComponent(url) + "&premium_proxy=true&transparent_headers=true";
  if ((k = process.env.SCRAPERBOX_KEY)) return "https://api.scraperbox.com/v2/scrape?token=" + k + "&url=" + encodeURIComponent(url) + "&javascript_render=false";
  if ((k = process.env.SCRAPE_DO_KEY)) return "https://api.scrape.do?token=" + k + "&url=" + encodeURIComponent(url);
  if ((k = process.env.ZENROWS_KEY)) return "https://api.zenrows.com/v1/?apikey=" + k + "&url=" + encodeURIComponent(url) + "&antibot=true";
  return null;
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
      var ck = cacheKey(url);
      var ce = CACHE[ck];
      var nowMs = Date.now();
      if (ce && nowMs - ce.ts < CACHE_TTL_MS) {
        if (ce.ct) res.setHeader("Content-Type", ce.ct);
        res.setHeader("X-Cache", "crowd-hit");
        return res.status(200).send(Buffer.from(ce.buf));
      }
      if (ce && ce.src === "service" && nowMs - ce.ts < 300000) {
        if (ce.ct) res.setHeader("Content-Type", ce.ct);
        res.setHeader("X-Cache", "service-stale");
        return res.status(200).send(Buffer.from(ce.buf));
      }
      var sUrl = serviceUrl(url);
      global.__xionSvcLast = global.__xionSvcLast || {};
      if (sUrl && nowMs - (global.__xionSvcLast[ck] || 0) >= 45000) {
        global.__xionSvcLast[ck] = nowMs;
        try {
          var ac = new AbortController();
          var st = setTimeout(function () { ac.abort(); }, 25000);
          var sResp = await fetch(sUrl, { headers: { "User-Agent": UA }, signal: ac.signal });
          clearTimeout(st);
          var sBuf = new Uint8Array(await sResp.arrayBuffer());
          var sHead = new TextDecoder().decode(sBuf.subarray(0, Math.min(sBuf.length, 4096)));
          if (sResp.ok && !isChallengeText(sHead) && sBuf.length > 2) {
            try { CACHE[cacheKey(url)] = { buf: sBuf, ct: sResp.headers.get("content-type"), ts: Date.now(), src: "service" }; } catch (ce2) {}
            if (sResp.headers.get("content-type")) res.setHeader("Content-Type", sResp.headers.get("content-type"));
            res.setHeader("X-Cache", "service");
            return res.status(200).send(Buffer.from(sBuf));
          }
        } catch (se2) {}
      }
      if (ce && nowMs - ce.ts < 1800000) {
        if (ce.ct) res.setHeader("Content-Type", ce.ct);
        res.setHeader("X-Cache", "stale");
        return res.status(200).send(Buffer.from(ce.buf));
      }
      return res.status(502).json({
        error: lastErr ? lastErr.message : "upstream failed",
        hint: "Upstream API is rate-limiting server IPs right now. It usually recovers within a minute — the app retries automatically.",
      });
    }

    try { CACHE[cacheKey(url)] = { buf: buf, ct: resp.headers.get("content-type"), ts: Date.now(), src: "crowd" }; } catch (se) {}
    var ct = resp.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.setHeader("Access-Control-Expose-Headers", "*");
    resp.headers.forEach(function (v, k) { if (k.toLowerCase() === "rb-session") res.setHeader("rb-session", v); });

    res.status(resp.status).send(Buffer.from(buf));
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
