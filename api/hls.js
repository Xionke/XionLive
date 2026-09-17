export const config = { api: { responseLimit: false, maxDuration: 30 } };

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var REFERER = "https://jack27eo.mpgreatestclgczbmiddle.my/";

function rot13(s) {
  return s.replace(/[a-zA-Z]/g, function(c) {
    var base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}
function decodeQueryParam(val) {
  if (!val) return "";
  return Buffer.from(rot13(decodeURIComponent(val.slice(8))), "base64").toString("utf8");
}
function readHostFromParam(pv) {
  for (var i = 0; i < pv.length; i++) { var at = pv[i].indexOf("@"); if (at >= 0) return pv[i].slice(at + 1); }
  return null;
}
function hasEncodedSegmentParams(segmentUrl) {
  try { var p = new URL(segmentUrl); return p.searchParams.has("_ctump") && p.searchParams.has("_ctuph"); } catch(e) { return false; }
}
function decodeSegmentUrl(segmentUrl) {
  try {
    var p = new URL(segmentUrl);
    var host = readHostFromParam(decodeQueryParam(p.searchParams.get("_ctump")).split(","));
    var path = decodeQueryParam(p.searchParams.get("_ctuph"));
    return host && path ? "https://" + host + path : null;
  } catch(e) { return null; }
}
function unwrapTs(buf) {
  if (buf.length < 4 || buf[0] === 0x47) return buf;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x53) return buf;
  var iend = buf.indexOf(Buffer.from("IEND"));
  if (iend >= 0 && iend + 8 < buf.length) return buf.subarray(iend + 8);
  for (var i = 0; i < Math.min(buf.length, 65536); i++) {
    if (buf[i] === 0x47 && i + 188 < buf.length && buf[i + 188] === 0x47) return buf.subarray(i);
  }
  return buf;
}

var FALLBACK_REFERERS = [
  REFERER,
  "https://mimi01eo.fut0newsiryroquite.cfd/",
  "https://tim01bp.2wc4tool8utphnumber.cfd/",
  "https://morgan01cf.8l3duspoken587uclock.cfd/",
  "https://nadia01eo.tn76degree12ec3out.cfd/",
  "https://jack27eo.mpgreatestclgczbmiddle.my/"
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    var targetUrl = req.query.url;
    var referer = req.query.referer || REFERER;
    if (!targetUrl) return res.status(400).text("url required");

    var fetchUrl = targetUrl;
    if (hasEncodedSegmentParams(fetchUrl)) {
      var decoded = decodeSegmentUrl(fetchUrl);
      if (decoded) fetchUrl = decoded;
    }

    var uniqueReferers = [referer].concat(FALLBACK_REFERERS).filter(function(v, i, a) { return a.indexOf(v) === i; });
    var r = null, lastErr = null;

    for (var fi = 0; fi < uniqueReferers.length; fi++) {
      var cand = uniqueReferers[fi];
      try {
        r = await fetch(fetchUrl, { headers: { "User-Agent": UA, "Referer": cand, "Origin": cand.replace(/\/$/, "") }, redirect: "follow" });
        var buf = new Uint8Array(await r.arrayBuffer());
        var head = new TextDecoder().decode(buf.subarray(0, Math.min(buf.length, 200))).toLowerCase();
        if (r.status >= 200 && r.status < 300 && buf.length && !head.includes("<html")) {
          var ct = r.headers.get("content-type") || "application/octet-stream";
          var head512 = new TextDecoder().decode(buf.subarray(0, Math.min(buf.length, 512)));
          if (ct.includes("mpegurl") || head512.includes("#EXTM3U")) {
            var text = new TextDecoder().decode(buf).replace(/^\uFEFF/, "");
            var origin = new URL(req.url, "https://" + req.headers.host).origin;
            var rewritten = text.split("\n").map(function(line) {
              var t = line.trim();
              if (!t || t.startsWith("#")) return line;
              var abs;
              try { abs = new URL(t, targetUrl).href; } catch(e) { abs = t; }
              return origin + "/api/hls?url=" + encodeURIComponent(abs) + "&referer=" + encodeURIComponent(referer);
            }).join("\n");
            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            return res.status(200).send(Buffer.from(rewritten, "utf8"));
          } else {
            var unwrapped = unwrapTs(buf);
            res.setHeader("Content-Type", ct.includes("mpeg") || ct.includes("video") ? "video/mp2t" : ct);
            return res.status(r.status).send(Buffer.from(unwrapped));
          }
        }
        lastErr = new Error("upstream " + r.status);
        if (r.status !== 403 && r.status !== 502) break;
        r = null;
      } catch (e) { lastErr = e; r = null; }
    }
    throw lastErr || new Error("upstream failed");
  } catch (e) {
    return res.status(502).text("proxy error: " + e.message);
  }
}
