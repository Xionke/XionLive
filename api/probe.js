import { gotScraping } from "got-scraping";

export const config = { api: { maxDuration: 60 } };

export default async function handler(req, res) {
  const targets = {
    data10: "https://apis-data10.tcllu137fien.ru/api/match/live?sportType=1",
    cfdlive: "https://apis-live.ta2mnt200stayr2.cfd/api/match/live?sportType=1",
  };
  const out = {};
  for (const [name, url] of Object.entries(targets)) {
    try {
      const r = await gotScraping({
        url,
        responseType: "buffer",
        timeout: { request: 25000 },
        http2: true,
        headerGeneratorOptions: { browsers: ["chrome"], devices: ["desktop"], operatingSystems: ["windows"] },
      });
      const body = r.body.toString("utf8");
      out[name] = {
        status: r.statusCode,
        challenge: body.includes("Just a moment"),
        size: r.body.length,
        head: body.slice(0, 50).replace(/[^\x20-\x7e]/g, "."),
      };
    } catch (e) {
      out[name] = { err: (e.response ? "status " + e.response.statusCode : e.message).slice(0, 80) };
    }
  }
  res.status(200).json(out);
}
