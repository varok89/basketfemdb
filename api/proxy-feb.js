// api/proxy-feb.js
// Proxy transparente para baloncestoenvivo.feb.es desde Vercel Serverless.
// FEB bloquea las IPs de Supabase Edge (AWS), pero acepta las de Vercel.
//
// Uso desde una edge function Supabase:
//   const r = await fetch("https://labasketneta.app/api/proxy-feb?url=" + encodeURIComponent(febUrl), {
//     headers: { "x-proxy-key": Deno.env.get("SCRAPER_PROXY_KEY") }
//   });
//   const html = await r.text();
//
// Rechaza URLs fuera del dominio FEB para evitar SSRF/abuso.

module.exports = async (req, res) => {
  const key = process.env.SCRAPER_PROXY_KEY;
  if (!key) {
    res.status(500).send("SCRAPER_PROXY_KEY no configurado en Vercel");
    return;
  }
  if (req.headers["x-proxy-key"] !== key) {
    res.status(401).send("unauthorized");
    return;
  }
  const url = req.query.url || "";
  if (!/^https:\/\/baloncestoenvivo\.feb\.es\//.test(url)) {
    res.status(400).send("url debe empezar por https://baloncestoenvivo.feb.es/");
    return;
  }
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.7",
      },
      signal: ctrl.signal,
    });
    clearTimeout(to);
    const text = await r.text();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("x-proxy-status", String(r.status));
    res.status(r.status).send(text);
  } catch (e) {
    res.status(502).send("proxy error: " + (e.message || e));
  }
};
