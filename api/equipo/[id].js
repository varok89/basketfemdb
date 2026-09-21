const { createClient } = require("@supabase/supabase-js");

// Cliente Supabase reutilizado entre invocaciones (warm lambda)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = async (req, res) => {
  const { id } = req.query;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    res.status(500).send("Faltan variables de entorno de Supabase.");
    return;
  }

  const { data: equipo } = await supabase
    .from("equipos")
    .select("nombre,ciudad,pais,escudo")
    .eq("id_equipo", id)
    .maybeSingle();

  const pageUrl = `https://${req.headers.host}/equipos/${id}`;

  if (!equipo) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(404).send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Equipo no encontrado · La Basketneta</title><meta name="robots" content="noindex"></head>
<body><h1>Equipo no encontrado</h1><p>La ficha solicitada no existe en La Basketneta.</p></body></html>`);
    return;
  }

  const nombre = equipo.nombre || "Equipo";
  const escudo = equipo.escudo;
  const descParts = [equipo.ciudad, equipo.pais].filter(Boolean);
  const descripcion = descParts.length
    ? `${descParts.join(", ")} — La Basketneta`
    : "Ficha de equipo en La Basketneta";

  const bodyMeta = descParts.length ? `<p>${escapeHtml(descParts.join(", "))}</p>` : "";
  const imageTag = escudo
    ? `<meta property="og:image" content="${escapeHtml(escudo)}">
<meta name="twitter:image" content="${escapeHtml(escudo)}">`
    : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<title>${escapeHtml(nombre)} · La Basketneta</title>
<link rel="canonical" href="${escapeHtml(pageUrl)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(nombre)}">
<meta property="og:description" content="${escapeHtml(descripcion)}">
${imageTag}
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta name="twitter:card" content="${escudo ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${escapeHtml(nombre)}">
<meta name="twitter:description" content="${escapeHtml(descripcion)}">
</head>
<body>
<h1>${escapeHtml(nombre)}</h1>
${bodyMeta}
<p>Plantilla, calendario y estadísticas en <a href="${escapeHtml(pageUrl)}">La Basketneta</a>.</p>
</body>
</html>`;

  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
};
