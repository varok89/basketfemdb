const { createClient } = require("@supabase/supabase-js");

const FALLBACK_PHOTO = "https://static.flashscore.com/res/image/empty-face-woman-share.gif";

// Escapa texto para insertarlo de forma segura dentro de atributos HTML.
// Sin esto, un nombre con comillas o "&" rompería el HTML generado.
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

  const { data: jugadora, error } = await supabase
    .from("jugadoras")
    .select("nombre,posicion,posicion2,nacionalidad,nacionalidad2,foto")
    .eq("id_jugadora", id)
    .maybeSingle();

  // Si no existe la jugadora (id inválido, borrada, etc.), no inventamos datos:
  // servimos metadatos genéricos de la app y dejamos que el cliente decida qué mostrar.
  const nombre = jugadora?.nombre || "BasketFem DB";
  const posiciones = [jugadora?.posicion, jugadora?.posicion2].filter(Boolean).join("/");
  const nacionalidades = [jugadora?.nacionalidad, jugadora?.nacionalidad2].filter(Boolean).join(" / ");
  const foto = jugadora?.foto || FALLBACK_PHOTO;

  const descParts = [posiciones, nacionalidades].filter(Boolean);
  const descripcion = descParts.length
    ? `${descParts.join(" · ")} — BasketFem DB`
    : "Ficha de jugadora en BasketFem DB";

  const pageUrl = `https://${req.headers.host}/jugadoras/${id}`;
  // og:url muestra el dominio limpio en la tarjeta de WhatsApp (lo que se ve bajo el título),
  // pero el enlace real al que navega el click sigue siendo pageUrl (vía http-equiv=refresh y el <a> de abajo).
  // Confirmado: og:url es solo metadato informativo, no controla la navegación al pulsar la tarjeta.
  // Valor FIJO a propósito (decisión explícita de Alvaro): si el dominio de producción cambia
  // en el futuro, este valor NO se actualiza solo — hay que editarlo a mano aquí.
  const cleanDomainUrl = "https://basketfemdb.vercel.app";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<title>${escapeHtml(nombre)} · BasketFem DB</title>
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(nombre)}">
<meta property="og:description" content="${escapeHtml(descripcion)}">
<meta property="og:image" content="${escapeHtml(foto)}">
<meta property="og:url" content="${escapeHtml(cleanDomainUrl)}">
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

  // Cache corto en el borde de Vercel: si editas la jugadora, el preview se refresca
  // en minutos, no se queda servida una versión vieja indefinidamente.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
};