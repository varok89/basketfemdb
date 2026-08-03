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

  const nombre = equipo?.nombre || "La Basketneta";
  const escudo = equipo?.escudo;
  const descParts = [equipo?.ciudad, equipo?.pais].filter(Boolean);
  const descripcion = descParts.length
    ? `${descParts.join(", ")} — La Basketneta`
    : "Ficha de equipo en La Basketneta";

  const pageUrl = `https://${req.headers.host}/equipos/${id}`;
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
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(nombre)}">
<meta property="og:description" content="${escapeHtml(descripcion)}">
${imageTag}
<meta property="og:url" content="https://labasketneta.app">
<meta name="twitter:card" content="${escudo ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${escapeHtml(nombre)}">
<meta name="twitter:description" content="${escapeHtml(descripcion)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(pageUrl)}">
</head>
<body>
<p>Redirigiendo a la ficha de ${escapeHtml(nombre)}… <a href="${escapeHtml(pageUrl)}">Abrir</a></p>
</body>
</html>`;

  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
};
