export const config = { api: { responseLimit: false, maxDuration: 30 } };

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var REFERER = "https://www.fctv33hd.pw/";
var ORIGIN = "https://www.fctv33hd.pw";

var API_HOSTS = [
  "https://apis-data10.tcllu137fien.ru",
  "https://apis-data11.tcllu137fien.ru",
  "https://apis-data10.tcdru136ovur.ru",
  "https://apis-data8.tcdru136ovur.ru",
  "https://apis-data-defra10.tcllu137fien.ru"
];
var SPORT_TYPES = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 90];

var gotScraping;
async function getGotScraping() {
  if (!gotScraping) {
    gotScraping = (await import("got-scraping")).gotScraping;
  }
  return gotScraping;
}

function isChallengeText(text) {
  return typeof text === "string" && text.slice(0, 4096).indexOf("Just a moment") !== -1;
}

var MATCH_CACHE = null;
var MATCH_CACHE_TS = 0;
var MATCH_CACHE_TTL = 60000;

async function fetchSport(host, sport) {
  var url = host + "/api/match/live?sportType=" + sport;
  var gs = await getGotScraping();
  var resp = await gs({
    url: url,
    headers: {
      "User-Agent": UA,
      "Referer": REFERER,
      "Origin": ORIGIN,
      "Accept": "application/json, text/plain, */*"
    },
    timeout: { request: 7000 },
    followRedirect: true,
    responseType: "buffer"
  });
  if (resp.statusCode !== 200) throw new Error("HTTP " + resp.statusCode);
  var body = resp.body;
  var buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  var head = buf.subarray(0, 200).toString("utf8");
  if (isChallengeText(head)) throw new Error("Cloudflare challenge");
  return { buf: buf, sport: sport };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    var now = Date.now();
    if (MATCH_CACHE && now - MATCH_CACHE_TS < MATCH_CACHE_TTL) {
      res.setHeader("X-Cache", "memory");
      return res.status(200).json(MATCH_CACHE);
    }

    var allMatches = [];
    var lastErr = null;

    for (var hi = 0; hi < API_HOSTS.length; hi++) {
      var host = API_HOSTS[hi];
      var promises = SPORT_TYPES.map(function(sport) {
        return fetchSport(host, sport).catch(function(e) {
          lastErr = e;
          return null;
        });
      });

      var results = await Promise.all(promises);
      var fetched = 0;
      for (var ri = 0; ri < results.length; ri++) {
        if (results[ri]) {
          fetched++;
          try {
            var parsed = parseMatchesFromBuffer(results[ri].buf, results[ri].sport);
            for (var pi = 0; pi < parsed.length; pi++) allMatches.push(parsed[pi]);
          } catch (e) {}
        }
      }

      if (fetched > 0) break;
    }

    if (!allMatches.length) {
      if (MATCH_CACHE) {
        res.setHeader("X-Cache", "stale-memory");
        return res.status(200).json(MATCH_CACHE);
      }
      return res.status(502).json({
        error: lastErr ? lastErr.message : "all upstream hosts failed",
        hint: "Upstream API is blocking server IPs. Add SCRAPERAPI_KEY env var in Vercel dashboard for reliable access."
      });
    }

    var response = { matches: allMatches, ts: now, count: allMatches.length };
    MATCH_CACHE = response;
    MATCH_CACHE_TS = now;

    res.setHeader("X-Cache", "fresh");
    return res.status(200).json(response);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

function parseMatchesFromBuffer(arrayBuffer, sportType) {
  var buffer = new Uint8Array(arrayBuffer);
  var matches = [];
  var topFields = readFields(buffer);
  var statusChunk = topFields.get(3) && topFields.get(3)[0];
  var status = statusChunk ? td(statusChunk) : "";
  if (status !== "Success") return matches;

  var payloadChunk = topFields.get(10) && topFields.get(10)[0];
  if (!payloadChunk) return matches;

  var payloadFields = readFields(payloadChunk);
  var liveMatchIds = new Set();

  var field2 = payloadFields.get(2) || [];
  for (var i = 0; i < field2.length; i++) {
    try {
      var inner = readFields(field2[i]);
      var matchId = readVarintField(inner.get(50) && inner.get(50)[0]);
      if (matchId && matchId > 1e5) liveMatchIds.add(matchId);
    } catch (e) {}
  }

  var entries = payloadFields.get(1) || [];
  for (var j = 0; j < entries.length; j++) {
    try {
      var entryBuf = entries[j];
      var fields = readFields(entryBuf);
      var matchId2 = readVarintField(fields.get(1) && fields.get(1)[0]);
      if (!matchId2 || matchId2 < 1e5) continue;

      var statusValue = readVarintField(fields.get(22) && fields.get(22)[0]);
      if (statusValue === 3) continue;

      var isLive = liveMatchIds.has(matchId2);
      if (!isLive) continue;

      var strings = extractStringsFromBuffer(entryBuf);
      var cleanCtrl = function(s) {
        return s.replace(/[^\x20-\x7E]+/g, " ").replace(/^\W+/, "").trim();
      };

      var leagueStrRaw = undefined;
      for (var k = 0; k < strings.length; k++) {
        var s = cleanCtrl(strings[k]);
        if (!s.startsWith("http") && s.length > 3 && !/^\d/.test(s) && s.split(" ").length > 1) {
          leagueStrRaw = s;
          break;
        }
      }
      var leagueStr = leagueStrRaw ? leagueStrRaw.split("http")[0].split('"')[0].trim() : "";

      var vsRaw = undefined;
      for (var m = 0; m < strings.length; m++) {
        if (strings[m].indexOf(" vs ") !== -1) {
          vsRaw = strings[m];
          break;
        }
      }
      var vsStr = vsRaw ? cleanCtrl(vsRaw) : null;

      if (vsStr) {
        var cleaned = vsStr.replace(/\s+/g, " ").trim();
        var parts = cleaned.split(" vs ");
        var home = parts[0].trim();
        var away = parts[1].trim();
        var slug = (home + " " + away).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        var mdata = btoa(matchId2 + "_" + sportType);
        var SPORT_NAMES = { 1: "football", 2: "basketball", 3: "tennis", 4: "baseball", 6: "cricket", 7: "motorsport", 8: "rugby", 9: "american-football", 10: "aussie-rules", 11: "hockey", 12: "badminton", 13: "volleyball", 14: "fighting", 15: "cycling", 16: "handball", 90: "others" };
        var sportSlug = SPORT_NAMES[sportType] || "others";
        matches.push({
          matchId: matchId2,
          league: leagueStr || "",
          home: home,
          away: away,
          name: cleaned,
          url: "https://www.fctv33hd.pw/" + sportSlug + "/" + slug + "-" + matchId2 + ".html?mdata=" + encodeURIComponent(mdata),
          source: "www.fctv33hd.pw",
          status: "live",
          sport: sportSlug
        });
      }
    } catch (e) {}
  }
  return matches;
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

function readVarintField(buf) {
  if (!buf) return undefined;
  return readVarint(buf, 0)[0];
}

function extractStringsFromBuffer(buffer) {
  var strings = [];
  var offset = 0;
  while (offset < buffer.length) {
    try {
      var tagResult = readVarint(buffer, offset);
      var tag = tagResult[0];
      offset = tagResult[1];
      var wire = tag & 7;
      if (wire === 2) {
        var chunkResult = readLD(buffer, offset);
        var chunk = chunkResult[0];
        offset = chunkResult[1];
        var str = td(chunk);
        if (str.length > 1) strings.push(str);
      } else if (wire === 0) {
        var skipResult = readVarint(buffer, offset);
        offset = skipResult[1];
      } else {
        break;
      }
    } catch (e) {
      break;
    }
  }
  return strings;
}
