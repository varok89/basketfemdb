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
    const r = await fetch(fibaUrl, { redirect: "follow", headers: { "User-Agent": "basketfemdb-fiba-proxy" } });
    if (!r.ok) { res.status(r.status).json({ error: "FIBA HTTP " + r.status, id: personId }); return; }
    const html = await r.text();

    // El HTML del perfil incluye un JSON-LD schema.org Person con los datos oficiales.
    const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g;
    let person = null;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(m[1]);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const it of items) {
          if (it && it["@type"] === "Person") { person = it; break; }
        }
        if (person) break;
      } catch (_) { /* seguir buscando */ }
    }
    if (!person) { res.status(404).json({ error: "Person JSON-LD no encontrado", id: personId }); return; }

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
