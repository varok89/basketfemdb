// Proxy a la ficha oficial FIBA por person_id. Scrapea el JSON-LD Person del HTML
// (server-side, sin CORS). Devuelve datos normalizados para autocompletar la BD.
//
// GET /api/fiba-person/226235 → { id, name, height_cm, birthdate, nationality, gender, url }

module.exports = async (req, res) => {
  // CORS (para llamar desde basketfemdb.vercel.app y previews).
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const { id } = req.query;
  const personId = String(id || "").replace(/[^0-9]/g, "");
  if (!personId) { res.status(400).json({ error: "id requerido (número)" }); return; }

  try {
    const fibaUrl = `https://www.fiba.basketball/en/players/${personId}`;
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };
    // FIBA/Cloudflare rate-limita agresivamente cuando ven muchos hits desde una IP.
    // Reintentamos con backoff exponencial si la respuesta no parece útil.
    let html = "";
    let lastStatus = 0;
    const delays = [0, 800, 2000, 4500];
    for (const wait of delays) {
      if (wait > 0) await new Promise(rr => setTimeout(rr, wait + Math.floor(Math.random() * 400)));
      const r = await fetch(fibaUrl, { redirect: "follow", headers });
      lastStatus = r.status;
      html = await r.text();
      // Consideramos "buena respuesta" si trae el JSON-LD o al menos los labels de la ficha.
      if (r.ok && (html.includes('"@type":"Person"') || /HEIGHT|NATIONALITY|DATE OF BIRTH/i.test(html))) break;
    }
    if (!html) { res.status(lastStatus || 502).json({ error: "FIBA HTTP " + lastStatus, id: personId }); return; }

    // El HTML del perfil incluye un JSON-LD schema.org Person con los datos oficiales.
    const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g;
    let person = null;
    let jsonLdCount = 0;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
      jsonLdCount++;
      try {
        const parsed = JSON.parse(m[1]);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const it of items) {
          if (it && it["@type"] === "Person") { person = it; break; }
        }
        if (person) break;
      } catch (_) { /* seguir buscando */ }
    }
    if (!person) {
      // Fallback: parsear directamente los campos visibles del HTML (SSR de Next.js con el bloque bio).
      const nameM = html.match(/<title>([^<]+)<\/title>/i);
      const heightMatch = html.match(/HEIGHT[\s\S]{0,120}?(\d{2,3})\s*cm/i);
      const dobMatch = html.match(/DATE OF BIRTH[\s\S]{0,200}?([A-Z][a-z]{2,8})\s+(\d{1,2}),?\s+(\d{4})/);
      const natMatch = html.match(/NATIONALITY[\s\S]{0,120}?\b([A-Z]{3})\b/);
      if (heightMatch || dobMatch || natMatch) {
        let birthdate = null;
        if (dobMatch) {
          const d = new Date(`${dobMatch[1]} ${dobMatch[2]}, ${dobMatch[3]}`);
          if (!isNaN(d.getTime())) birthdate = d.toISOString().slice(0, 10);
        }
        res.status(200).json({
          id: personId,
          name: nameM ? nameM[1].split("(")[0].trim() : null,
          height_cm: heightMatch ? parseInt(heightMatch[1], 10) : null,
          birthdate,
          nationality: natMatch ? natMatch[1] : null,
          gender: null,
          url: fibaUrl,
          fallback: "regex",
        });
        return;
      }
      res.status(404).json({
        error: "Person JSON-LD no encontrado",
        id: personId,
        htmlLen: html.length,
        jsonLdCount,
        htmlHead: html.slice(0, 300),
      });
      return;
    }

    // Normalizar height "182 cm" → 182 (int).
    let heightCm = null;
    if (typeof person.height === "string") {
      const hm = person.height.match(/(\d{2,3})\s*cm/i);
      if (hm) heightCm = parseInt(hm[1], 10);
    } else if (typeof person.height === "number") {
      heightCm = person.height;
    }

    // Normalizar fecha nac a YYYY-MM-DD.
    let birthdate = null;
    if (person.birthDate) {
      const bd = new Date(person.birthDate);
      if (!isNaN(bd.getTime())) birthdate = bd.toISOString().slice(0, 10);
    }

    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.status(200).json({
      id: personId,
      name: person.name || null,
      height_cm: heightCm,
      birthdate: birthdate,
      nationality: person.nationality || null,
      gender: person.gender || null,
      url: person.url || fibaUrl,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, id: personId });
  }
};
