const { createClient } = require("@supabase/supabase-js");
const { countryFlag } = require("../_lib/countryFlags.js");

const FALLBACK_PHOTO = "https://static.flashscore.com/res/image/empty-face-woman-share.gif";

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

  const { data: jugadora } = await supabase
    .from("jugadoras")
    .select("nombre,posicion,posicion2,nacionalidad,nacionalidad2,foto")
    .eq("id_jugadora", id)
    .maybeSingle();

  const nombre = jugadora?.nombre || "La Basketneta";
  const posiciones = [jugadora?.posicion, jugadora?.posicion2].filter(Boolean).join("/");
  const banderas = [countryFlag(jugadora?.nacionalidad), countryFlag(jugadora?.nacionalidad2)]
    .filter(Boolean).join(" ");
  const foto = jugadora?.foto || FALLBACK_PHOTO;
  const descParts = [posiciones, banderas].filter(Boolean);
  const descripcion = descParts.length
    ? `${descParts.join(" · ")} — La Basketneta`
    : "Ficha de jugadora en La Basketneta";

  const pageUrl = `https://${req.headers.host}/jugadoras/${id}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<title>${escapeHtml(nombre)} · La Basketneta</title>
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(nombre)}">
<meta property="og:description" content="${escapeHtml(descripcion)}">
<meta property="og:image" content="${escapeHtml(foto)}">
<meta property="og:url" content="https://labasketneta.app">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(nombre)}">
<meta name="twitter:description" content="${escapeHtml(descripcion)}">
<meta name="twitter:image" content="${escapeHtml(foto)}">
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
