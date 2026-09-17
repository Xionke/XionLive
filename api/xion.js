import { createCipheriv } from "node:crypto";
import { inflateSync, gunzipSync } from "node:zlib";

export const config = { api: { responseLimit: false, maxDuration: 30 } };

var API_BASE = "https://apis-data10.tcdru136ovur.ru";
var REFERER = "https://jack27eo.mpgreatestclgczbmiddle.my/";
var ORIGIN = "https://jack27eo.mpgreatestclgczbmiddle.my";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function apiHeaders(extra) {
  return Object.assign({ "User-Agent": UA, "Referer": REFERER, "Origin": ORIGIN, "Accept": "application/json, text/plain, */*" }, extra || {});
}

async function httpsGet(url, headers) {
  var resp = await fetch(url, { headers: headers || apiHeaders(), redirect: "follow" });
  var buf = new Uint8Array(await resp.arrayBuffer());
  var text = () => new TextDecoder().decode(buf);
  var hdrs = {};
  resp.headers.forEach((v, k) => { hdrs[k.toLowerCase()] = v; });
  return { status: resp.status, headers: hdrs, buffer: buf, text };
}

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
function td(b) { return new TextDecoder().decode(b); }

function readFields(buf) {
  var fields = new Map(); var off = 0;
  while (off < buf.length) {
    var tag = readVarint(buf, off); off = tag[1];
    var fnum = tag[0] >> 3, wire = tag[0] & 7;
    if (wire === 0) { var val = readVarint(buf, off); off = val[1]; var tmp = new Uint8Array(8); var sz = 0, v2 = val[0]; while (v2 > 0x7F) { tmp[sz++] = (v2 & 0x7F) | 0x80; v2 >>>= 7; } tmp[sz++] = v2; var list = fields.get(fnum) || []; list.push(tmp.subarray(0, sz)); fields.set(fnum, list); continue; }
    if (wire === 2) { var chunk = readLD(buf, off); off = chunk[1]; var list2 = fields.get(fnum) || []; list2.push(chunk[0]); fields.set(fnum, list2); continue; }
    break;
  }
  return fields;
}

function parseEnvelope(buf) { var f = readFields(buf); return { message: f.has(3) ? td(f.get(3)[0]) : "", payload: f.get(10) || [] }; }

function parseSignatures(buf) {
  var env = parseEnvelope(buf); var results = [];
  env.payload.forEach(function(chunk) {
    var off = 0;
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
      if (code) results.push({ code: code, value: value });
    }
  });
  return results;
}

function parseGeo(buf) { var env = parseEnvelope(buf); if (!env.payload.length) return {}; var f = readFields(env.payload[0]); return { country: f.has(2) ? td(f.get(2)[0]) : "", continent: f.has(3) ? td(f.get(3)[0]) : "" }; }

function parseStreamItem(buf) {
  var f = readFields(buf); var sid = "";
  if (f.has(1)) { var c = f.get(1)[0]; sid = c.length <= 8 ? String(readVarint(c, 0)[0]) : td(c); }
  return { streamId: sid, url: f.has(4) ? td(f.get(4)[0]) : "", name: f.has(3) ? td(f.get(3)[0]) : "", siteType: f.has(9) ? readVarint(f.get(9)[0], 0)[0] : 0 };
}

function parseMatchDetail(buf) { var env = parseEnvelope(buf); if (!env.payload.length) return { stream: [] }; var f = readFields(env.payload[0]); return { stream: (f.get(2) || []).map(parseStreamItem) }; }

function parseStreamDetail(buf) {
  var env = parseEnvelope(buf); if (!env.payload.length) return {};
  var f = readFields(env.payload[0]);
  if (f.has(2)) return parseStreamItem(f.get(2)[0]);
  if (f.has(1)) return parseStreamItem(f.get(1)[0]);
  return parseStreamItem(env.payload[0]);
}

var NUMERIC_KEYS = { sportType: 1, language: 1, leagueId: 1, seasonId: 1, siteType: 1 };
var PARAM_ORDER = ["matchId", "leagueId", "seasonId", "sportType", "language", "stream"];

function sortParams(p) {
  var norm = {};
  for (var k in p) norm[k] = (NUMERIC_KEYS[k] && typeof p[k] === "string" && /^\d+$/.test(p[k])) ? Number(p[k]) : p[k];
  var keys = Object.keys(norm).sort(function(a, b) { var ai = PARAM_ORDER.indexOf(a), bi = PARAM_ORDER.indexOf(b); return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi); });
  var sorted = {}; keys.forEach(function(k) { sorted[k] = norm[k]; }); return sorted;
}

function md5(s) {
  function L(k,d){return(k<<d)|(k>>>(32-d))}
  function K(G,k){var I,d,F,H,x;F=(G&2147483648);H=(k&2147483648);I=(G&1073741824);d=(k&1073741824);x=(G&1073741823)+(k&1073741823);if(I&d){return(x^2147483648^F^H)}if(I|d){if(x&1073741824){return(x^3221225472^F^H)}else{return(x^1073741824^F^H)}}else{return(x^F^H)}}
  function aa(a,b,c,d,x,s,ac){a=K(a,K(K(b&c|~b&d,x),ac));return K(L(a,s),b)}
  function ba(a,b,c,d,x,s,ac){a=K(a,K(K(b&d|c&~d,x),ac));return K(L(a,s),b)}
  function ca(a,b,c,d,x,s,ac){a=K(a,K(K(b^c^d,x),ac));return K(L(a,s),b)}
  function da(a,b,c,d,x,s,ac){a=K(a,K(K(c^(b|~d),x),ac));return K(L(a,s),b)}
  function ConvertToWordArray(s){var lWordCount;var lMessageLength=s.length;var lNumberOfWords_temp1=lMessageLength+8;var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1%64))/64;var lNumberOfWords=(lNumberOfWords_temp2+1)*16;var lWordArray=Array(lNumberOfWords-1);var lBytePosition=0;var lByteCount=0;while(lByteCount<lMessageLength){lWordCount=(lByteCount-(lByteCount%4))/4;lBytePosition=(lByteCount%4)*8;lWordArray[lWordCount]=(lWordArray[lWordCount]|(s.charCodeAt(lByteCount)<<lBytePosition));lByteCount++}lWordCount=(lByteCount-(lByteCount%4))/4;lBytePosition=(lByteCount%4)*8;lWordArray[lWordCount]=lWordArray[lWordCount]|(128<<lBytePosition);lWordArray[lNumberOfWords-2]=lMessageLength<<3;lWordArray[lNumberOfWords-1]=lMessageLength>>>29;return lWordArray}
  function WordToHex(lValue){var WordToHexValue="",WordToHexValue_temp="",lByte,lCount;for(lCount=0;lCount<=3;lCount++){lByte=(lValue>>>(lCount*8))&255;WordToHexValue_temp="0"+lByte.toString(16);WordToHexValue=WordToHexValue+WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2)}return WordToHexValue}
  var x=ConvertToWordArray(s);var a=0x67452301,b=0xEFCDAB89,c=0x98BADCFE,d=0x10325476;
  var S11=7,S12=12,S13=17,S14=22,S21=5,S22=9,S23=14,S24=20,S31=4,S32=11,S33=16,S34=23,S41=6,S42=10,S43=15,S44=21;
  for(var k=0;k<x.length;k+=16){var AA=a,BB=b,CC=c,DD=d;
    a=aa(a,b,c,d,x[k],S11,0xD76AA478);d=aa(d,a,b,c,x[k+1],S12,0xE8C7B756);c=aa(c,d,a,b,x[k+2],S13,0x242070DB);b=aa(b,c,d,a,x[k+3],S14,0xC1BDCEEE);a=aa(a,b,c,d,x[k+4],S11,0xF57C0FAF);d=aa(d,a,b,c,x[k+5],S12,0x4787C62A);c=aa(c,d,a,b,x[k+6],S13,0xA8304613);b=aa(b,c,d,a,x[k+7],S14,0xFD469501);a=aa(a,b,c,d,x[k+8],S11,0x698098D8);d=aa(d,a,b,c,x[k+9],S12,0x8B44F7AF);c=aa(c,d,a,b,x[k+10],S13,0xFFFF5BB1);b=aa(b,c,d,a,x[k+11],S14,0x895CD7BE);a=aa(a,b,c,d,x[k+12],S11,0x6B901122);d=aa(d,a,b,c,x[k+13],S12,0xFD987193);c=aa(c,d,a,b,x[k+14],S13,0xA679438E);b=aa(b,c,d,a,x[k+15],S14,0x49B40821);
    a=ba(a,b,c,d,x[k+1],S21,0xF61E2562);d=ba(d,a,b,c,x[k+6],S22,0xC040B340);c=ba(c,d,a,b,x[k+11],S23,0x265E5A51);b=ba(b,c,d,a,x[k],S24,0xE9B6C7AA);a=ba(a,b,c,d,x[k+5],S21,0xD62F105D);d=ba(d,a,b,c,x[k+10],S22,0x2441453);c=ba(c,d,a,b,x[k+15],S23,0xD8A1E681);b=ba(b,c,d,a,x[k+4],S24,0xE7D3FBC8);a=ba(a,b,c,d,x[k+9],S21,0x21E1CDE6);d=ba(d,a,b,c,x[k+14],S22,0xC33707D6);c=ba(c,d,a,b,x[k+3],S23,0xF4D50D87);b=ba(b,c,d,a,x[k+8],S24,0x455A14ED);a=ba(a,b,c,d,x[k+13],S21,0xA9E3E905);d=ba(d,a,b,c,x[k+2],S22,0xFCEFA3F8);c=ba(c,d,a,b,x[k+7],S23,0x676F02D9);b=ba(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
    a=ca(a,b,c,d,x[k+5],S31,0xFFFA3942);d=ca(d,a,b,c,x[k+8],S32,0x8771F681);c=ca(c,d,a,b,x[k+11],S33,0x6D9D6122);b=ca(b,c,d,a,x[k+14],S34,0xFDE5380C);a=ca(a,b,c,d,x[k+1],S31,0xA4BEEA44);d=ca(d,a,b,c,x[k+4],S32,0x4BDECFA9);c=ca(c,d,a,b,x[k+7],S33,0xF6BB4B60);b=ca(b,c,d,a,x[k+10],S34,0xBEBFBC70);a=ca(a,b,c,d,x[k+13],S31,0x289B7EC6);d=ca(d,a,b,c,x[k],S32,0xEAA127FA);c=ca(c,d,a,b,x[k+3],S33,0xD4EF3085);b=ca(b,c,d,a,x[k+6],S34,0x4881D05);a=ca(a,b,c,d,x[k+9],S31,0xD9D4D039);d=ca(d,a,b,c,x[k+12],S32,0xE6DB99E5);c=ca(c,d,a,b,x[k+15],S33,0x1FA27CF8);b=ca(b,c,d,a,x[k+2],S34,0xC4AC5665);
    a=da(a,b,c,d,x[k],S41,0xF4292244);d=da(d,a,b,c,x[k+7],S42,0x432AFF97);c=da(c,d,a,b,x[k+14],S43,0xAB9423A7);b=da(b,c,d,a,x[k+5],S44,0xFC93A039);a=da(a,b,c,d,x[k+12],S41,0x655B59C3);d=da(d,a,b,c,x[k+3],S42,0x8F0CCC92);c=da(c,d,a,b,x[k+10],S43,0xFFEFF47D);b=da(b,c,d,a,x[k+1],S44,0x85845DD1);a=da(a,b,c,d,x[k+8],S41,0x6FA87E4F);d=da(d,a,b,c,x[k+15],S42,0xFE2CE6E0);c=da(c,d,a,b,x[k+6],S43,0xA3014314);b=da(b,c,d,a,x[k+13],S44,0x4E0811A1);a=da(a,b,c,d,x[k+4],S41,0xF7537E82);d=da(d,a,b,c,x[k+11],S42,0xBD3AF235);c=da(c,d,a,b,x[k+2],S43,0x2AD7D2BB);b=da(b,c,d,a,x[k+9],S44,0xEB86D391);
    a=K(a,AA);b=K(b,BB);c=K(c,CC);d=K(d,DD)}
  return(WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d)).toLowerCase();
}

function requestHash(params) { return md5(JSON.stringify(sortParams(params))).slice(0, 6); }

function aesEncrypt(data) {
  var key = Buffer.from("a7981cc9eb2f4d19dcfea57b101ecd89", "utf8");
  var iv = Buffer.from("8017d3a8f1400d2f", "utf8");
  var cipher = createCipheriv("aes-256-cbc", key, iv);
  var encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  return encrypted.toString("base64");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    var pageUrl = req.query.url;
    var requestedStreamId = req.query.streamId;
    if (!pageUrl) return res.status(400).json({ error: "url required" });

    var headers = apiHeaders();
    var parsed = new URL(pageUrl.trim());
    var mdata = parsed.searchParams.get("mdata");
    var matchId, sportType;
    if (mdata) {
      var padded = decodeURIComponent(mdata) + "=".repeat((4 - decodeURIComponent(mdata).length % 4) % 4);
      var plain = atob(padded);
      var parts = plain.split("_");
      matchId = parts[0]; sportType = Number(parts[1]);
    } else {
      var pathParts = parsed.pathname.split("/").filter(Boolean); var si = 0;
      var localeSet = { en:1, es:1, de:1, fr:1, pt:1, ru:1, it:1, nl:1, pl:1, tr:1, ar:1, zh:1, ja:1, ko:1 };
      if (pathParts[si] && localeSet[pathParts[si]]) si++;
      var slugMap = { football:1, basketball:2, tennis:3, baseball:4, cricket:6, motorsport:7, rugby:8, "american-football":9, "aussie-rules":10, hockey:11, badminton:12, volleyball:13, fighting:14, cycling:15, handball:16, others:90 };
      sportType = slugMap[pathParts[si]] || 1;
      var slug = (pathParts[si + 1] || "").replace(/\.html$/i, "");
      matchId = slug.slice(slug.lastIndexOf("-") + 1);
    }

    var configResp = await httpsGet(API_BASE + "/api/common/params", headers);
    var configText = rot47(configResp.text());
    var siteConfig = JSON.parse(configText);
    var gPlayerDomains = JSON.parse(siteConfig["g_player_domains"] || "{}");
    var webClients = JSON.parse(siteConfig["common:web:client"] || "{}");

    var playerReferer = REFERER;
    var streamSiteDigit = "foth";
    var wh = webClients[streamSiteDigit] && webClients[streamSiteDigit].iframePlayerDomains && webClients[streamSiteDigit].iframePlayerDomains[0];
    if (wh) { playerReferer = "https://" + wh.replace(/^https?:\/\//, "").replace(/\/$/, "") + "/"; }
    else {
      var keys = Object.keys(webClients);
      for (var i = 0; i < keys.length; i++) { var h = webClients[keys[i]] && webClients[keys[i]].iframePlayerDomains && webClients[keys[i]].iframePlayerDomains[0]; if (h) { playerReferer = "https://" + h.replace(/^https?:\/\//, "").replace(/\/$/, "") + "/"; break; } }
      if (playerReferer === REFERER) { var fallback = gPlayerDomains[streamSiteDigit]; if (Array.isArray(fallback)) { for (var j = 0; j < fallback.length; j++) { if (/^https?:\/\//i.test(fallback[j])) { playerReferer = "https://" + fallback[j].replace(/^https?:\/\//, "").replace(/\/$/, "") + "/"; break; } } } }
      if (playerReferer === REFERER) { var gkeys = Object.keys(gPlayerDomains); for (var gi = 0; gi < gkeys.length; gi++) { var arr = gPlayerDomains[gkeys[gi]]; if (Array.isArray(arr)) { for (var gj = 0; gj < arr.length; gj++) { if (/^https?:\/\//i.test(arr[gj])) { playerReferer = "https://" + arr[gj].replace(/^https?:\/\//, "").replace(/\/$/, "") + "/"; break; } } if (playerReferer !== REFERER) break; } } }
    }

    var codesParam = [102, 103, 104, 105].map(function(c) { return "code=" + c; }).join("&");
    var sigResp = await httpsGet(API_BASE + "/api/common/bs?stream=true&sportType=" + sportType + "&matchId=" + matchId + "&" + codesParam, headers);
    var sigEntries = parseSignatures(sigResp.buffer);
    var sigMap = {};
    sigEntries.forEach(function(e) { sigMap[e.code] = e.value; });

    var suffix = sigMap[102];
    if (!suffix) throw new Error("Signature key 102 not found");
    var detailParams = { matchId: matchId, sportType: sportType, language: 0, stream: true };
    var hash = requestHash(detailParams);
    var detailUrl = API_BASE + "/sfver" + hash + suffix + "/api/match/detail?matchId=" + matchId + "&sportType=" + sportType + "&language=0&stream=true";
    var detailResp = await httpsGet(detailUrl, headers);
    var matchDetail = parseMatchDetail(detailResp.buffer);
    var liveStreams = matchDetail.stream.filter(function(s) { return s.streamId; });

    if (!requestedStreamId && liveStreams.length > 1) {
      return res.status(200).json({ name: "Match " + matchId, matchId: matchId, streams: liveStreams.map(function(s) { return { streamId: s.streamId, name: s.name || "Stream " + s.streamId, siteType: s.siteType }; }), referer: playerReferer });
    }

    var stream = liveStreams.find(function(s) { return String(s.streamId) === String(requestedStreamId); }) || liveStreams[0];
    if (!stream) throw new Error("No streams available");

    var digits = Object.keys(webClients);
    if (digits.length === 0) digits = ["foth"];
    var signedUrl = null;

    var streamsToTry = [stream].concat(liveStreams.filter(function(s) { return s.streamId !== stream.streamId; }));
    var seen = {};
    streamsToTry = streamsToTry.filter(function(s) { if (seen[s.streamId]) return false; seen[s.streamId] = true; return true; });

    for (var si3 = 0; si3 < streamsToTry.length && !signedUrl; si3++) {
      var tryStream = streamsToTry[si3];
      for (var di = 0; di < digits.length && !signedUrl; di++) {
        var digit = digits[di];
        var streamDetailUrl = API_BASE + "/api/stream/detail?streamId=" + tryStream.streamId + "&matchId=" + matchId + "&sportType=" + sportType + "&siteType=" + tryStream.siteType + "&digit=" + digit;
        try {
          var sdResp = await httpsGet(streamDetailUrl, headers);
          var sdToken = sdResp.headers["rb-session"] || "";
          var streamDetail = parseStreamDetail(sdResp.buffer);
          if (!streamDetail.url) continue;
          var decoded = rot47(streamDetail.url).slice(8);
          if (!decoded.startsWith("http://") && !decoded.startsWith("https://")) continue;
          var streamParsed = new URL(decoded);
          var token = encodeURIComponent(aesEncrypt(sdToken)) + "a";
          signedUrl = streamParsed.origin + "/token-" + token + streamParsed.pathname + streamParsed.search;
          stream = tryStream;
        } catch (e) { /* skip */ }
      }
    }

    if (!signedUrl) throw new Error("No HTTP stream found for this match");

    return res.status(200).json({ name: stream.name || "", streamUrl: signedUrl, playableUrl: signedUrl, referer: playerReferer });
  } catch (e) {
    return res.status(502).json({ error: e.message || String(e) });
  }
}
