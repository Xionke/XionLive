(function() {
  "use strict";

  const API_BASE = "https://apis-data10.tcdru136ovur.ru";
  const REFERER = "https://jack27eo.mpgreatestclgczbmiddle.my/";
  const ORIGIN = "https://jack27eo.mpgreatestclgczbmiddle.my";
  const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  const MATCH_DETAIL_API_PATH = "/api/match/detail";
  const MATCH_DETAIL_SIGNATURE_CODE = 102;
  const SIGNATURE_BOOTSTRAP_CODES = [102, 103, 104, 105];
  const REQUEST_PARAM_ORDER = ["matchId", "leagueId", "seasonId", "sportType", "language", "stream"];
  const NUMERIC_KEYS = new Set(["sportType", "language", "leagueId", "seasonId", "siteType"]);
  const SPORT_SLUGS = {
    football:1, basketball:2, tennis:3, baseball:4, cricket:6, motorsport:7,
    rugby:8, "american-football":9, "aussie-rules":10, hockey:11, badminton:12,
    volleyball:13, fighting:14, cycling:15, handball:16, others:90
  };
  const LOCALE_CODES = new Set(["en","es","de","fr","pt","ru","it","nl","pl","tr","ar","zh","ja","ko"]);
  const AES_KEY = "a7981cc9eb2f4d19dcfea57b101ecd89";
  const AES_IV = "8017d3a8f1400d2f";

  // ─── Minimal MD5 ────────────────────────────────────────────────────
  function md5hex(str) {
    function md5cycle(x, k) {
      var a = x[0], b = x[1], c = x[2], d = x[3];
      a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
      c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
      a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
      c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
      a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
      c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
      a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
      c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
      a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
      c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
      a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
      c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
      a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
      c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
      a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
      c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
      a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
      c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
      a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
      c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
      a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
      c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
      a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
      c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
      a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
      c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
      a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
      c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
      a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
      c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
      a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
      c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
      x[0] = add32(a, x[0]); x[1] = add32(b, x[1]);
      x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
    }
    function cmn(q, a, b, x, s, t) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
    function md51(s) {
      var n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
      for (i = 64; i <= n; i += 64) {
        md5cycle(state, md5blk(s.substring(i - 64, i)));
      }
      s = s.substring(i - 64);
      var tail = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
      for (i = 0; i < s.length; i++)
        tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
      tail[i >> 2] |= 0x80 << ((i % 4) << 3);
      if (i > 55) { md5cycle(state, tail); tail = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]; }
      tail[14] = n * 8;
      md5cycle(state, tail);
      return state;
    }
    function md5blk(s) {
      var md5blks = [], i;
      for (i = 0; i < 64; i += 4) {
        md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
      }
      return md5blks;
    }
    var hex_chr = "0123456789abcdef".split("");
    function rhex(n) {
      var s = "", j = 0;
      for (; j < 4; j++)
        s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
      return s;
    }
    function hex(x) { for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]); return x.join(""); }
    function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
    return hex(md51(str));
  }

  // ─── rot47 ──────────────────────────────────────────────────────────
  function rot47(input) {
    return [...input].map(char => {
      const code = char.charCodeAt(0);
      if (code >= 33 && code <= 79) return String.fromCharCode(code + 47);
      if (code >= 80 && code <= 126) return String.fromCharCode(code - 47);
      return char;
    }).join('');
  }

  // ─── Uint8Array concat ──────────────────────────────────────────────
  function concatBytes(...arrays) {
    let total = 0;
    for (const a of arrays) total += a.length;
    const result = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) { result.set(a, offset); offset += a.length; }
    return result;
  }

  // ─── Protobuf helpers ───────────────────────────────────────────────
  function readVarint(buffer, offset) {
    let value = 0, shift = 0, pos = offset;
    while (pos < buffer.length) {
      const b = buffer[pos++];
      value |= (b & 0x7F) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    return [value >>> 0, pos];
  }

  function readLengthDelimited(buffer, offset) {
    const [len, next] = readVarint(buffer, offset);
    return [buffer.slice(next, next + len), next + len];
  }

  function readString(buffer, offset) {
    const [chunk, next] = readLengthDelimited(buffer, offset);
    return [new TextDecoder().decode(chunk), next];
  }

  function readFields(buffer) {
    const fields = new Map();
    let offset = 0;
    while (offset < buffer.length) {
      const [tag, tagEnd] = readVarint(buffer, offset);
      const fieldNumber = tag >>> 3;
      const wireType = tag & 0x07;
      if (wireType === 0) {
        const [val, next] = readVarint(buffer, tagEnd);
        const tmp = new Uint8Array(8);
        let v = val, i = 0;
        while (v > 0x7F) { tmp[i++] = (v & 0x7F) | 0x80; v >>>= 7; }
        tmp[i++] = v;
        if (!fields.has(fieldNumber)) fields.set(fieldNumber, []);
        fields.get(fieldNumber).push(tmp.slice(0, i));
        offset = next;
      } else if (wireType === 2) {
        const [chunk, next] = readLengthDelimited(buffer, tagEnd);
        if (!fields.has(fieldNumber)) fields.set(fieldNumber, []);
        fields.get(fieldNumber).push(chunk);
        offset = next;
      } else {
        break;
      }
    }
    return fields;
  }

  // ─── Protobuf parsers ───────────────────────────────────────────────
  function parseApiEnvelope(buffer) {
    const fields = readFields(buffer);
    const message = fields.has(3) ? new TextDecoder().decode(fields.get(3)[0]) : "";
    const payload = fields.get(10) || [];
    return { message, payload };
  }

  function parseSignatureEntries(buffer) {
    const entries = [];
    let offset = 0;
    while (offset < buffer.length) {
      const [tag, next] = readVarint(buffer, offset);
      offset = next;
      if ((tag & 7) !== 2) continue;
      const [chunk, after] = readLengthDelimited(buffer, offset);
      offset = after;
      let code = 0, value = "";
      let inner = 0;
      while (inner < chunk.length) {
        const [innerTag, innerNext] = readVarint(chunk, inner);
        inner = innerNext;
        const innerField = innerTag >> 3;
        const innerWire = innerTag & 7;
        if (innerWire === 0) {
          const [num, numNext] = readVarint(chunk, inner);
          inner = numNext;
          if (innerField === 1) code = num;
          continue;
        }
        if (innerWire === 2) {
          const [text, textNext] = readString(chunk, inner);
          inner = textNext;
          if (innerField === 2) value = text;
        }
      }
      if (code) entries.push({ code, value });
    }
    return entries;
  }

  function parseUserGeo(buffer) {
    const envelope = parseApiEnvelope(buffer);
    if (!envelope.payload.length) return { country: "", continent: "" };
    const fields = readFields(envelope.payload[0]);
    const country = fields.has(2) ? new TextDecoder().decode(fields.get(2)[0]) : "";
    const continent = fields.has(3) ? new TextDecoder().decode(fields.get(3)[0]) : "";
    return { country, continent };
  }

  function parseStreamItem(buffer) {
    const fields = readFields(buffer);
    let streamId = "";
    if (fields.has(1)) {
      const chunk = fields.get(1)[0];
      if (chunk.length === 1) { streamId = String(chunk[0]); }
      else { streamId = new TextDecoder().decode(chunk); }
    }
    const url = fields.has(4) ? new TextDecoder().decode(fields.get(4)[0]) : "";
    const name = fields.has(3) ? new TextDecoder().decode(fields.get(3)[0]) : "";
    let siteType = 0;
    if (fields.has(9)) { const [v] = readVarint(fields.get(9)[0], 0); siteType = v; }
    return { streamId, url, name, siteType };
  }

  function parseMatchDetail(buffer) {
    const envelope = parseApiEnvelope(buffer);
    const stream = [];
    if (envelope.payload.length) {
      const fields = readFields(envelope.payload[0]);
      const items = fields.get(2) || [];
      for (const item of items) { stream.push(parseStreamItem(item)); }
    }
    return { stream };
  }

  function parseStreamDetail(buffer) {
    const envelope = parseApiEnvelope(buffer);
    log("parseStreamDetail: envelope message:", envelope.message, "payload count:", envelope.payload.length);
    if (envelope.payload.length) {
      const inner = readFields(envelope.payload[0]);
      if (inner.has(2)) return parseStreamItem(inner.get(2)[0]);
      if (inner.has(1)) return parseStreamItem(inner.get(1)[0]);
      return parseStreamItem(envelope.payload[0]);
    }
    var preview = "";
    if (buffer.length > 0) {
      var firstBytes = Array.from(buffer.slice(0, 32)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join(' ');
      preview = " first32=[" + firstBytes + "]";
    }
    throw new Error("Empty stream detail response (bufLen=" + buffer.length + preview + ")");
  }

  function readVarintField(buffer) {
    const [val] = readVarint(buffer, 0);
    return val;
  }

  // ─── Request signing ────────────────────────────────────────────────
  function normalizeValue(key, value) {
    if (typeof value === "string" && NUMERIC_KEYS.has(key) && /^\d+$/.test(value)) return Number(value);
    return value;
  }
  function sortRequestParams(params) {
    const normalized = Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, normalizeValue(key, value)])
    );
    const order = new Map(REQUEST_PARAM_ORDER.map((key, index) => [key, index]));
    const keys = Object.keys(normalized).sort((a, b) => (order.get(a) ?? -1) - (order.get(b) ?? -1));
    return Object.fromEntries(keys.map((key) => [key, normalized[key]]));
  }
  function requestHashPrefix(params) {
    return md5hex(JSON.stringify(sortRequestParams(params))).slice(0, 6);
  }

  // ─── AES-256-CBC (Web Crypto) ──────────────────────────────────────
  async function buildSignedStreamUrl(obfuscatedUrl, sessionToken) {
    const decoded = rot47(obfuscatedUrl).slice(8);
    const parsed = new URL(decoded);
    const keyBytes = new TextEncoder().encode(AES_KEY);
    const ivBytes = new TextEncoder().encode(AES_IV);
    const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["encrypt"]);
    const encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv: ivBytes }, cryptoKey, new TextEncoder().encode(sessionToken));
    const token = encodeURIComponent(btoa(String.fromCharCode(...new Uint8Array(encrypted)))) + "a";
    return parsed.origin + "/token-" + token + parsed.pathname + parsed.search;
  }

  // ─── buildHeaders ───────────────────────────────────────────────────
  function buildHeaders(context) {
    return {
      Referer: context.pageReferer,
      Origin: context.pageOrigin,
      Accept: "application/json, text/plain, */*",
      "User-Agent": USER_AGENT
    };
  }

  // ─── URL parsers ────────────────────────────────────────────────────
  function decodeMetadataParam(raw) {
    const normalized = decodeURIComponent(raw).replace(/\s/g, "");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const plain = atob(padded);
    const [matchId, sportType] = plain.split("_");
    return { matchId, sportType: Number(sportType) };
  }

  function parseMatchPagePath(input) {
    const url = new URL(input.trim());
    const parts = url.pathname.split("/").filter(Boolean);
    let index = 0;
    if (parts[index] && LOCALE_CODES.has(parts[index])) index += 1;
    const sportSlug = parts[index];
    const sportType = SPORT_SLUGS[sportSlug];
    const slugSegment = parts[index + 1];
    const cleanSegment = slugSegment.replace(/\.html$/i, "");
    const matchId = cleanSegment.slice(cleanSegment.lastIndexOf("-") + 1);
    return { matchId, sportType, pageReferer: url.origin + "/", pageOrigin: url.origin };
  }

  var log = function() { var a = ["[xion-resolver]"]; for (var i = 0; i < arguments.length; i++) a.push(arguments[i]); console.log.apply(console, a); };

  // ─── Web HTTP helper (routes through /api/proxy for CORS) ──────────
  function proxyUrl(targetUrl, headers) {
    var p = "/api/proxy?url=" + encodeURIComponent(targetUrl);
    if (headers && headers.Referer) p += "&referer=" + encodeURIComponent(headers.Referer);
    if (headers && headers.Origin) p += "&origin=" + encodeURIComponent(headers.Origin);
    return p;
  }

  async function nativeFetch(url, headers, expectBinary) {
    var pUrl = proxyUrl(url, headers);
    log("nativeFetch:", pUrl.substring(0, 120));
    var fetchResp = await fetch(pUrl);
    if (expectBinary) {
      var h = {};
      fetchResp.headers.forEach(function(v, k) { h[k.toLowerCase()] = v; });
      return { status: fetchResp.status, ok: fetchResp.ok, headers: h, data: new Uint8Array(await fetchResp.arrayBuffer()) };
    } else {
      var h2 = {};
      fetchResp.headers.forEach(function(v, k) { h2[k.toLowerCase()] = v; });
      return { status: fetchResp.status, ok: fetchResp.ok, headers: h2, text: await fetchResp.text() };
    }
  }

  // ─── Shared resolution steps ────────────────────────────────────────
  async function fetchSiteConfig(pageReferer, pageOrigin) {
    var resp = await nativeFetch(API_BASE + "/api/common/params", buildHeaders({ pageReferer, pageOrigin }), false);
    try {
      var configText = rot47(resp.text);
      return JSON.parse(configText);
    } catch(e) {
      throw new Error("Config parse failed: " + e.message + " | rawType=" + typeof resp.text + " | preview=" + String(resp.text).substring(0, 120));
    }
  }

  function findPlayerReferer(siteConfig) {
    const gPlayerDomains = JSON.parse(siteConfig["g_player_domains"] || "{}");
    const webClients = JSON.parse(siteConfig["common:web:client"] || "{}");
    let playerReferer = REFERER;
    const streamSiteDigit = "foth";
    const host = webClients[streamSiteDigit] && webClients[streamSiteDigit].iframePlayerDomains && webClients[streamSiteDigit].iframePlayerDomains[0];
    if (host) {
      playerReferer = "https://" + host.replace(/^https?:\/\//, "").replace(/\/$/, "") + "/";
    } else {
      for (const key of Object.keys(webClients)) {
        const h = webClients[key] && webClients[key].iframePlayerDomains && webClients[key].iframePlayerDomains[0];
        if (h) { playerReferer = "https://" + h.replace(/^https?:\/\//, "").replace(/\/$/, "") + "/"; break; }
      }
      if (playerReferer === REFERER) {
        const fallback = gPlayerDomains[streamSiteDigit];
        if (Array.isArray(fallback)) {
          const cand = fallback.find(item => /^https?:\/\//i.test(item));
          if (cand) playerReferer = "https://" + cand.replace(/^https?:\/\//, "").replace(/\/$/, "") + "/";
        }
        if (playerReferer === REFERER) {
          for (const key of Object.keys(gPlayerDomains)) {
            const arr = gPlayerDomains[key];
            if (Array.isArray(arr)) {
              const cand = arr.find(item => /^https?:\/\//i.test(item));
              if (cand) { playerReferer = "https://" + cand.replace(/^https?:\/\//, "").replace(/\/$/, "") + "/"; break; }
            }
          }
        }
      }
    }
    return playerReferer;
  }

  async function fetchSignatureMap(matchId, sportType, pageReferer, pageOrigin) {
    const codesParam = SIGNATURE_BOOTSTRAP_CODES.map(c => "code=" + c).join("&");
    var resp = await nativeFetch(API_BASE + "/api/common/bs?stream=true&sportType=" + sportType + "&matchId=" + matchId + "&" + codesParam, buildHeaders({ pageReferer, pageOrigin }), true);
    var sigEnvelope = parseApiEnvelope(resp.data);
    var sigEntries = sigEnvelope.payload.flatMap(chunk => parseSignatureEntries(chunk));
    var sigMap = {};
    for (var e of sigEntries) sigMap[e.code] = e.value;
    return sigMap;
  }

  async function fetchMatchStreams(matchId, sportType, sigMap, pageReferer, pageOrigin) {
    const suffix = sigMap[MATCH_DETAIL_SIGNATURE_CODE] || sigMap[102];
    if (!suffix) throw new Error("Signature key for code 102 not found");
    const detailParams = { matchId, sportType, language: 0, stream: true };
    const hashPrefix = requestHashPrefix(detailParams);
    const detailUrl = API_BASE + "/sfver" + hashPrefix + suffix + MATCH_DETAIL_API_PATH + "?matchId=" + matchId + "&sportType=" + sportType + "&language=0&stream=true";
    var resp = await nativeFetch(detailUrl, buildHeaders({ pageReferer, pageOrigin }), true);
    return parseMatchDetail(resp.data);
  }

  async function resolveStreamToUrl(stream, matchId, sportType, playerReferer, pageReferer, pageOrigin) {
    const detailStreamUrl = API_BASE + "/api/stream/detail?streamId=" + stream.streamId + "&matchId=" + matchId + "&sportType=" + sportType + "&siteType=" + stream.siteType + "&digit=foth";
    log("Fetching stream detail:", detailStreamUrl);
    var resp = await nativeFetch(detailStreamUrl, buildHeaders({ pageReferer, pageOrigin }), true);
    var sessionToken = resp.headers["rb-session"] || "";
    log("rb-session:", sessionToken ? sessionToken.substring(0, 20) + "..." : "(empty)");
    log("Stream detail response size:", resp.data.length, "first bytes:", Array.from(resp.data.slice(0, 16)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join(' '));
    if (resp.data.length < 2) {
      throw new Error("Stream detail empty (status=" + resp.status + ", size=" + resp.data.length + ")");
    }
    var streamDetail = parseStreamDetail(resp.data);
    if (!streamDetail.url) throw new Error("Stream detail missing URL (parsed " + resp.data.length + " bytes)");
    var streamUrl = await buildSignedStreamUrl(streamDetail.url, sessionToken);
    return {
      name: stream.name || streamDetail.name || "",
      streamUrl,
      playableUrl: streamUrl,
      referer: playerReferer
    };
  }

  // ─── Main resolver (fully client-side, no server needed) ────────────
  async function resolveXionMatch(matchUrl, requestedStreamId) {
    log("resolveXionMatch: matchUrl=" + matchUrl, "streamId=" + requestedStreamId);
    var parsed = parseMatchPagePath(matchUrl);
    var matchId = parsed.matchId;
    var sportType = parsed.sportType;
    var pageReferer = parsed.pageReferer;
    var pageOrigin = parsed.pageOrigin;
    log("parsed: matchId=" + matchId + " sportType=" + sportType);

    var siteConfig = await fetchSiteConfig(pageReferer, pageOrigin);
    var playerReferer = findPlayerReferer(siteConfig);
    log("playerReferer:", playerReferer);

    var sigMap = await fetchSignatureMap(matchId, sportType, pageReferer, pageOrigin);
    var matchData = await fetchMatchStreams(matchId, sportType, sigMap, pageReferer, pageOrigin);
    var streams = matchData.stream;
    log("found " + streams.length + " streams");

    if (!streams.length) throw new Error("No streams found for this match");

    if (requestedStreamId) {
      var stream = streams.find(function(s) { return s.streamId === requestedStreamId; });
      if (!stream) throw new Error("Stream not found: " + requestedStreamId);
      var result = await resolveStreamToUrl(stream, matchId, sportType, playerReferer, pageReferer, pageOrigin);
      log("resolved stream:", result.name, "url:", result.playableUrl.substring(0, 80));
      return {
        playableUrl: result.playableUrl,
        streamUrl: result.playableUrl,
        referer: result.referer,
        name: result.name,
        streams: streams.map(function(s) { return { streamId: s.streamId, name: s.name }; })
      };
    }

    return {
      playableUrl: undefined,
      streams: streams.map(function(s) { return { streamId: s.streamId, name: s.name }; }),
      name: '',
      referer: playerReferer
    };
  }

  window.resolveXionMatch = resolveXionMatch;
  window.xionProxyUrl = proxyUrl;
})();
