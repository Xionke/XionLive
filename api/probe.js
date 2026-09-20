export const config = { api: { maxDuration: 60 } };

export default async function handler(req, res) {
  const out = { node: process.version };
  try {
    const mod = await import("got-scraping");
    const { gotScraping } = mod;
    out.import = "ok";
    try {
      const r = await gotScraping({
        url: "https://apis-data10.tcllu137fien.ru/api/match/live?sportType=1",
        responseType: "buffer",
        timeout: { request: 25000 },
        http2: true,
        headerGeneratorOptions: { browsers: ["chrome"], devices: ["desktop"], operatingSystems: ["windows"] },
      });
      const body = r.body.toString("utf8");
      out.gotScraping = {
        status: r.statusCode,
        challenge: body.includes("Just a moment"),
        size: r.body.length,
        head: body.slice(0, 50).replace(/[^\x20-\x7e]/g, "."),
      };
    } catch (e) {
      out.gotScraping = { err: (e.response ? "status " + e.response.statusCode + " " + e.response.body.slice(0, 40) : e.message).slice(0, 150) };
    }
  } catch (ie) {
    out.import = "FAIL: " + String(ie && ie.message ? ie.message : ie).slice(0, 200);
  }
  // plain fetch control
  try {
    const fr = await fetch("https://apis-data10.tcllu137fien.ru/api/match/live?sportType=1");
    out.plainFetch = { status: fr.status };
  } catch (fe) {
    out.plainFetch = { err: String(fe.message || fe).slice(0, 100) };
  }
  res.status(200).json(out);
}
