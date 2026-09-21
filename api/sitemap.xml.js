const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const SITE = "https://labasketneta.app";

function xmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

module.exports = async (req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    res.status(500).send("Faltan variables de entorno de Supabase.");
    return;
  }

  // Supabase capa el select a 1000 filas por defecto → paginamos.
  async function fetchAll(table, col) {
    const out = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabase.from(table).select(col).range(from, from + step - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      out.push(...data.map(r => r[col]));
      if (data.length < step) break;
      from += step;
    }
    return out;
  }

  let jugadoras = [], equipos = [];
  try {
    [jugadoras, equipos] = await Promise.all([
      fetchAll("jugadoras", "id_jugadora"),
      fetchAll("equipos", "id_equipo"),
    ]);
  } catch (e) {
    res.status(500).send(`Error consultando Supabase: ${e.message}`);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  const urls = [
    { loc: `${SITE}/`, priority: "1.0", changefreq: "daily" },
    ...equipos.map(id => ({ loc: `${SITE}/equipos/${encodeURIComponent(id)}`, priority: "0.7", changefreq: "weekly" })),
    ...jugadoras.map(id => ({ loc: `${SITE}/jugadoras/${encodeURIComponent(id)}`, priority: "0.6", changefreq: "weekly" })),
  ];

  const body = urls.map(u =>
    `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${today}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;

  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.status(200).send(xml);
};
