const { createClient } = require("@supabase/supabase-js");

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = async (req, res) => {
  const { id } = req.query;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    res.status(500).send("Faltan variables de entorno de Supabase en este proyecto de Vercel.");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: equipo, error } = await supabase
    .from("equipos")
    .select("nombre,ciudad,pais,escudo")
    .eq("id_equipo", id)
    .maybeSingle();

  const nombre = equipo?.nombre || "La Basketneta";
  const ciudad = equipo?.ciudad;
  const pais = equipo?.pais;
  // Sin fallback fijo hardcodeado aquí: si no hay escudo, omitimos og:image
  // en vez de forzar una imagen por defecto que el propio Alvaro decidió no fijar
  // de forma permanente en el código (ver discusión sobre la URL de gstatic).
  const escudo = equipo?.escudo;

  const descParts = [ciudad, pais].filter(Boolean);
  const descripcion = descParts.length
    ? `${descParts.join(", ")} — La Basketneta`
    : "Ficha de equipo en La Basketneta";

  const pageUrl = `https://${req.headers.host}/equipos/${id}`;
  // og:url fijo a propósito (misma decisión que en el endpoint de jugadora):
  // si el dominio de producción cambia, este valor no se actualiza solo.
  const cleanDomainUrl = "https://labasketneta.app";

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
<meta property="og:url" content="${escapeHtml(cleanDomainUrl)}">
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