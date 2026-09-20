import { createCipheriv, createHash } from "node:crypto";

export const config = { api: { responseLimit: false, maxDuration: 60 } };

var UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var DEFAULT_REFERER = "https://jack27eo.mpgreatestclgczbmiddle.my/";
function isChallengeText(text) {
  return typeof text === "string" && text.slice(0, 4096).indexOf("Just a moment") !== -1;
}
var PLAY_DOMAINS_RE = /fctv33|fctv|rbtv|rbsports|superabbit|madplay|hubu\.ru|mpgreatestclgczbmiddle|tm3troops31patrol|tcdru136ovur|2wc4tool8utphnumber|8l3duspoken587uclock|tn76degree12ec3out|fut0newsiryroquite/i;

var SPORT_SLUGS = { football:1, basketball:2, tennis:3, baseball:4, cricket:6, motorsport:7, rugby:8, "american-football":9, "aussie-rules":10, hockey:11, badminton:12, volleyball:13, fighting:14, cycling:15, handball:16, others:90 };
var LOCALE_CODES = new Set(["en","zh","th","vi","id","pt","es","tr","ru","ko","ja","nl","ar","hi","bn","fr","de","it"]);
var MATCH_DETAIL_SIGNATURE_CODE = 0x66;
var SIGNATURE_BOOTSTRAP_CODES = [0x66, 0x67, 0x68, 0x69];
var REQUEST_PARAM_ORDER = ["matchId","leagueId","seasonId","sportType","language","stream"];
var NUMERIC_KEYS = new Set(["sportType","language","leagueId","seasonId","siteType"]);

function rot47(s) {
  return s.split("").map(function(c) {
    var code = c.charCodeAt(0);
    if (code >= 33 && code <= 79) return String.fromCharCode(code + 47);
    if (code >= 80 && code <= 126) return String.fromCharCode(code - 47);
    return c;
  }).join("");
}

function readVarint(buf, off) {
  var v = 0, s = 0, i = off;
  while (i < buf.length) { var b = buf[i++]; v |= (b & 127) << s; if ((b & 128) === 0) break; s += 7; }
  return [v, i];
}
function readLD(buf, off) { var r = readVarint(buf, off); return [buf.subarray(r[1], r[1] + r[0]), r[1] + r[0]]; }
function td(b) { return Buffer.isBuffer(b) ? b.toString("utf8") : new TextDecoder().decode(b); }

function readFields(buf) {
  var fields = new Map(); var off = 0;
  while (off < buf.length) {
    var tag = readVarint(buf, off); off = tag[1];
    var fnum = tag[0] >> 3, wire = tag[0] & 7;
    if (wire === 0) { var val = readVarint(buf, off); off = val[1]; var tmp = Buffer.allocUnsafe(8); var sz = 0, v2 = val[0]; while (v2 > 0x7F) { tmp[sz++] = (v2 & 0x7F) | 0x80; v2 >>>= 7; } tmp[sz++] = v2; var list = fields.get(fnum) || []; list.push(tmp.subarray(0, sz)); fields.set(fnum, list); continue; }
    if (wire === 2) { var chunk = readLD(buf, off); off = chunk[1]; var list2 = fields.get(fnum) || []; list2.push(chunk[0]); fields.set(fnum, list2); continue; }
    break;
  }
  return fields;
}

function parseApiEnvelope(buf) {
  var fields = readFields(buf);
  return { message: fields.get(3) ? td(fields.get(3)[0]) : "", payload: fields.get(10) || [] };
}

function parseSignatureEntries(chunk) {
  var entries = []; var off = 0;
  while (off < chunk.length) {
    var tag = readVarint(chunk, off); off = tag[1];
    if ((tag[0] & 7) !== 2) continue;
    var ld = readLD(chunk, off); off = ld[1]; var inner = ld[0];
    var code = 0, value = "", ii = 0;
    while (ii < inner.length) {
      var it = readVarint(inner, ii); ii = it[1]; var ifn = it[0] >> 3, iwire = it[0] & 7;
      if (iwire === 0) { var iv = readVarint(inner, ii); ii = iv[1]; if (ifn === 1) code = iv[0]; continue; }
      if (iwire === 2) { var ild = readLD(inner, ii); ii = ild[1]; if (ifn === 2) value = td(ild[0]); }
    }
    if (code) entries.push({ code: code, value: value });
  }
  return entries;
}

function parseUserGeo(buf) {
  var env = parseApiEnvelope(buf);
  if (!env.payload[0]) return {};
  var fields = readFields(env.payload[0]);
  return { country: fields.get(2) ? td(fields.get(2)[0]) : "", continent: fields.get(3) ? td(fields.get(3)[0]) : "" };
}

function readVarintField(buf) {
  if (!buf) return undefined;
  return readVarint(buf, 0)[0];
}

function parseStreamItem(buf) {
  var fields = readFields(buf);
  var streamIdChunk = fields.get(1) ? fields.get(1)[0] : null;
  var streamId = streamIdChunk && streamIdChunk.length <= 8 ? String(readVarint(streamIdChunk, 0)[0]) : (streamIdChunk ? td(streamIdChunk) : "");
  return {
    streamId: streamId,
    url: fields.get(4) ? td(fields.get(4)[0]) : "",
    name: fields.get(3) ? td(fields.get(3)[0]) : "",
    siteType: readVarintField(fields.get(9) ? fields.get(9)[0] : null)
  };
}

function parseMatchDetail(buf) {
  var env = parseApiEnvelope(buf);
  if (!env.payload[0]) return { stream: [] };
  var root = readFields(env.payload[0]);
  return { stream: (root.get(2) || []).map(parseStreamItem) };
}

function parseStreamDetail(buf) {
  var env = parseApiEnvelope(buf);
  if (!env.payload[0]) return {};
  var fields = readFields(env.payload[0]);
  var streamBuffer = (fields.get(2) ? fields.get(2)[0] : null) || (fields.get(1) ? fields.get(1)[0] : null) || env.payload[0];
  return parseStreamItem(streamBuffer);
}

function normalizeValue(key, value) {
  if (typeof value === "string" && NUMERIC_KEYS.has(key) && /^\d+$/.test(value)) return Number(value);
  return value;
}
function sortRequestParams(params) {
  var normalized = {};
  for (var k in params) normalized[k] = normalizeValue(k, params[k]);
  var order = new Map(REQUEST_PARAM_ORDER.map(function(key, index) { return [key, index]; }));
  var keys = Object.keys(normalized).sort(function(a, b) { return (order.get(a) ?? -1) - (order.get(b) ?? -1); });
  var sorted = {};
  keys.forEach(function(k) { sorted[k] = normalized[k]; });
  return sorted;
}
function requestHashPrefix(params) {
  var md5 = createHash("md5").update(JSON.stringify(sortRequestParams(params)), "utf8").digest("hex");
  return md5.slice(0, 6);
}

function normalizePlayerReferer(host) {
  return "https://" + host.replace(/^https?:\/\//, "").replace(/\/$/, "") + "/";
}

function buildHeaders(context) {
  return {
    "Referer": context.pageReferer,
    "Origin": context.pageOrigin,
    "Accept": "application/json, text/plain, */*",
    "User-Agent": UA,
  };
}

function parseMatchPagePath(input) {
  var url;
  try { url = new URL(input.trim()); } catch { return null; }
  var parts = url.pathname.split("/").filter(Boolean);
  var index = 0;
  if (parts[index] && LOCALE_CODES.has(parts[index])) index += 1;
  var sportSlug = parts[index];
  if (!sportSlug) return null;
  var sportType = SPORT_SLUGS[sportSlug];
  if (sportType === undefined) return null;
  var slugSegment = parts[index + 1];
  if (!slugSegment || slugSegment.indexOf("-") === -1) return null;
  var cleanSegment = slugSegment.replace(/\.html$/i, "");
  var matchId = cleanSegment.slice(cleanSegment.lastIndexOf("-") + 1);
  if (!/^\d+$/.test(matchId)) return null;
  var pageReferer = url.origin + "/";
  var metadata = url.searchParams.get("mdata");
  if (metadata) {
    try {
      var normalized = decodeURIComponent(metadata).replace(/\s/g, "");
      var padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      var plain = Buffer.from(padded, "base64").toString("utf8");
      var parts2 = plain.split("_");
      if (parts2[0] && parts2[1] && /^\d+$/.test(parts2[0])) {
        return { matchId: parts2[0], sportType: Number(parts2[1]), pageReferer: pageReferer, pageOrigin: url.origin };
      }
    } catch {}
  }
  return { matchId: matchId, sportType: sportType, pageReferer: pageReferer, pageOrigin: url.origin };
}

function parseStreamSiteDigitFromPage(pageHtml, pageUrl) {
  var match;
  match = pageHtml.match(/layout:"livestream-([^"]+)"/);
  if (match && match[1]) return match[1];
  match = pageHtml.match(/DIGIT_ENV['"]\s*:\s*['"]([^'"]+)['"]/);
  if (match && match[1] && match[1] !== "production" && match[1].length < 10) return match[1];
  match = pageHtml.match(/cDigit['"]\s*:\s*['"]([^'"]+)['"]/);
  if (match && match[1] && match[1] !== "production" && match[1].length < 10) return match[1];
  match = pageHtml.match(/DIGIT_ENV_MIRROR['"]\s*:\s*['"]([^'"]+)['"]/);
  if (match && match[1] !== "" && match[1].length < 10) return match[1];
  if (pageHtml.indexOf("fctv33") !== -1 || PLAY_DOMAINS_RE.test(pageUrl || "")) return "foth";
  throw new Error("stream site digit not found on match page");
}

function parseDataApiBaseUrlFromPage(pageHtml) {
  var match = pageHtml.match(/apis-data\d+\.[a-z0-9.-]+/);
  if (!match) throw new Error("data api host not found on match page");
  return "https://" + match[0];
}

function buildPlaySiteUrl(playerDomainBase, pageUrl) {
  var source = new URL(pageUrl.trim());
  var target = new URL(playerDomainBase);
  target.pathname = source.pathname
    .replace(/-match-(\d+)/, "-$1")
    .replace(/-\d{2}-\d{4}(\.html)$/i, "$1");
  target.searchParams.set("icg", "UEs");
  target.searchParams.set("ilang", source.searchParams.get("ilang") || "en");
  return target.href;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    var rawUrl = req.query.url;
    var requestedStreamId = req.query.streamId;
    if (!rawUrl) return res.status(400).json({ error: "url required" });
    var input = (rawUrl || "").trim();

    var isM3u8 = input.toLowerCase().indexOf(".m3u8") !== -1;
    if (isM3u8) {
      try {
        var u = new URL(input);
        var referer = u.searchParams.get("referer") || DEFAULT_REFERER;
        var clean = new URL(input);
        clean.searchParams.delete("referer");
        var name = decodeURIComponent(u.pathname.split("/").pop() || "Brugge").replace(/\.m3u8.*$/i, "") || "XionLive";
        var origin = new URL(req.url, "https://" + req.headers.host).origin;
        return res.status(200).json({ name: name, streamUrl: clean.href, referer: referer, playableUrl: origin + "/api/hls?url=" + encodeURIComponent(clean.href) + "&referer=" + encodeURIComponent(referer) });
      } catch (e) {
        return res.status(400).json({ error: "invalid m3u8 url" });
      }
    }

    var parsed = parseMatchPagePath(input);
    if (!parsed) return res.status(400).json({ error: "Could not parse match page URL" });
    var requestContext = { pageReferer: parsed.pageReferer, pageOrigin: parsed.pageOrigin };

    var pageResp = await fetch(input, { headers: buildHeaders(requestContext), redirect: "follow" });
    var pageHtml = await pageResp.text();
    if (isChallengeText(pageHtml)) throw new Error("Upstream blocked this server (Cloudflare challenge). Retry in a moment.");
    try {
      var finalOrigin = new URL(pageResp.url || input).origin;
      requestContext = { pageReferer: finalOrigin + "/", pageOrigin: finalOrigin };
    } catch (e2) {}
    var dataApiBaseUrl = parseDataApiBaseUrlFromPage(pageHtml);
    var streamSiteDigit = parseStreamSiteDigitFromPage(pageHtml, input);

    var configResp = await fetch(dataApiBaseUrl + "/api/common/params", { headers: buildHeaders(requestContext) });
    var configRaw = await configResp.text();
    if (isChallengeText(configRaw)) throw new Error("Upstream blocked this server (Cloudflare challenge). Retry in a moment.");
    var configText = rot47(configRaw);
    var siteConfig = JSON.parse(configText);
    var webClients = JSON.parse(siteConfig["common:web:client"] || "{}");
    var gPlayerDomains = JSON.parse(siteConfig["g_player_domains"] || "{}");

    var playerDomain = null;
    var wcKeys = Object.keys(webClients);
    for (var i = 0; i < wcKeys.length; i++) {
      var h = webClients[wcKeys[i]] && webClients[wcKeys[i]].iframePlayerDomains && webClients[wcKeys[i]].iframePlayerDomains[0];
      if (h) { playerDomain = h; break; }
    }
    if (!playerDomain) {
      var gdKeys = Object.keys(gPlayerDomains);
      for (var gi = 0; gi < gdKeys.length; gi++) {
        var arr = gPlayerDomains[gdKeys[gi]];
        if (Array.isArray(arr)) {
          for (var gj = 0; gj < arr.length; gj++) {
            if (/^https?:\/\//i.test(arr[gj])) { playerDomain = arr[gj]; break; }
          }
          if (playerDomain) break;
        }
      }
    }
    var playerReferer = playerDomain ? normalizePlayerReferer(playerDomain) : DEFAULT_REFERER;

    var isInputPlayDomain = PLAY_DOMAINS_RE.test(input);
    if (!isInputPlayDomain && playerDomain && PLAY_DOMAINS_RE.test(playerDomain)) {
      var playUrl = buildPlaySiteUrl(playerDomain, input);
      var playPageResp = await fetch(playUrl, { headers: buildHeaders(requestContext), redirect: "follow" });
      var playPageHtml = await playPageResp.text();
      dataApiBaseUrl = parseDataApiBaseUrlFromPage(playPageHtml);
      streamSiteDigit = parseStreamSiteDigitFromPage(playPageHtml, playUrl);
      var playParsed = new URL(playUrl);
      requestContext = { pageReferer: playParsed.origin + "/", pageOrigin: playParsed.origin };
    }

    var geoResp = await fetch(dataApiBaseUrl + "/api/user/info", { headers: buildHeaders(requestContext) });
    var geoBuf = Buffer.from(await geoResp.arrayBuffer());
    var geo = parseUserGeo(geoBuf);

    var query = new URLSearchParams();
    query.set("stream", "true");
    query.set("sportType", String(parsed.sportType));
    query.set("matchId", parsed.matchId);
    for (var ci = 0; ci < SIGNATURE_BOOTSTRAP_CODES.length; ci++) query.append("code", String(SIGNATURE_BOOTSTRAP_CODES[ci]));
    var sigResp = await fetch(dataApiBaseUrl + "/api/common/bs?" + query.toString(), { headers: buildHeaders(requestContext) });
    var sigBuf = Buffer.from(await sigResp.arrayBuffer());
    var sigEnv = parseApiEnvelope(sigBuf);
    if (sigEnv.message !== "Success") throw new Error("signature bootstrap failed: " + sigEnv.message);
    var signatureKeys = new Map();
    sigEnv.payload.forEach(function(chunk) { parseSignatureEntries(chunk).forEach(function(entry) { signatureKeys.set(entry.code, entry.value); }); });

    var suffix = signatureKeys.get(MATCH_DETAIL_SIGNATURE_CODE);
    if (!suffix) throw new Error("missing body signature");

    var detailQuery = sortRequestParams({ matchId: parsed.matchId, sportType: parsed.sportType, language: 0, stream: true });
    var qs = new URLSearchParams();
    for (var dk in detailQuery) qs.set(dk, String(detailQuery[dk]));
    var detailUrl = dataApiBaseUrl + "/sfver" + requestHashPrefix({ matchId: parsed.matchId, sportType: parsed.sportType, language: 0, stream: true }) + suffix + "/api/match/detail?" + qs.toString();
    var detailResp = await fetch(detailUrl, { headers: buildHeaders(requestContext) });
    var detailBuf = Buffer.from(await detailResp.arrayBuffer());
    var match = parseMatchDetail(detailBuf);
    var liveStreams = match.stream.filter(function(s) { return s.streamId; });
    if (!liveStreams.length) throw new Error("no stream on match (not live yet?)");

    if (!requestedStreamId && input.indexOf("?") !== -1) {
      try { requestedStreamId = new URL(input).searchParams.get("streamId"); } catch {}
    }

    if (!requestedStreamId) {
      return res.status(200).json({
        name: "Match " + parsed.matchId,
        matchId: parsed.matchId,
        streams: liveStreams.map(function(s) { return { streamId: s.streamId, name: s.name || "Stream " + s.streamId, siteType: s.siteType }; }),
        referer: playerReferer,
      });
    }

    var stream = liveStreams.find(function(s) { return String(s.streamId) === String(requestedStreamId); }) || liveStreams[0];
    if (!stream) throw new Error("stream not found");

    var streamDetailUrl = new URL(dataApiBaseUrl + "/api/stream/detail");
    streamDetailUrl.searchParams.set("streamId", stream.streamId);
    streamDetailUrl.searchParams.set("matchId", parsed.matchId);
    streamDetailUrl.searchParams.set("sportType", String(parsed.sportType));
    streamDetailUrl.searchParams.set("siteType", String(stream.siteType));
    streamDetailUrl.searchParams.set("digit", streamSiteDigit);
    if (geo.continent) streamDetailUrl.searchParams.set("continent", geo.continent);
    if (geo.country) streamDetailUrl.searchParams.set("country", geo.country);
    var sdResp = await fetch(streamDetailUrl.toString(), { headers: buildHeaders(requestContext) });
    var sdBuf = Buffer.from(await sdResp.arrayBuffer());
    var sdEnvelope = parseApiEnvelope(sdBuf);
    if (sdEnvelope.message !== "Success") throw new Error("stream detail failed: " + sdEnvelope.message);
    var sessionToken = sdResp.headers.get("rb-session");
    if (!sessionToken) throw new Error("stream detail missing session token");
    var detail = parseStreamDetail(sdBuf);
    if (!detail.url) throw new Error("stream detail missing url");

    var decoded = rot47(detail.url).slice(8);
    if (!decoded.startsWith("http://") && !decoded.startsWith("https://")) throw new Error("stream URL not HTTP");
    var streamParsed = new URL(decoded);
    var cipher = createCipheriv("aes-256-cbc", Buffer.from("a7981cc9eb2f4d19dcfea57b101ecd89", "utf8"), Buffer.from("8017d3a8f1400d2f", "utf8"));
    var encrypted = Buffer.concat([cipher.update(sessionToken, "utf8"), cipher.final()]);
    var token = encodeURIComponent(encrypted.toString("base64")) + "a";
    var signedUrl = streamParsed.origin + "/token-" + token + streamParsed.pathname + streamParsed.search;

    var origin = new URL(req.url, "https://" + req.headers.host).origin;
    var playableUrl = origin + "/api/hls?url=" + encodeURIComponent(signedUrl) + "&referer=" + encodeURIComponent(playerReferer);

    return res.status(200).json({
      name: stream.name || "Brugge " + parsed.matchId,
      streamUrl: signedUrl,
      referer: playerReferer,
      playableUrl: playableUrl,
    });
  } catch (e) {
    var msg = e instanceof Error ? e.message : "resolve failed";
    var blocked = /Cloudflare|blocked this server/i.test(msg);
    return res.status(blocked ? 503 : 502).json({
      error: msg,
      hint: blocked ? "Temporary upstream rate-limit. Please retry in a few seconds." : undefined,
    });
  }
}
