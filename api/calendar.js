// Endpoint iCal: devuelve un .ics con los partidos de un equipo o liga
// para que el usuario lo suscriba en Google/Apple Calendar y actualice
// automaticamente.
//
// URLs:
//   /api/calendar?tipo=equipo&id=E001
//   /api/calendar?tipo=liga&id=L001
//   /api/calendar?tipo=liga&id=L001&temporada=2025-26

const { createClient } = require("@supabase/supabase-js");

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

function escapeIcs(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
function ts(d) {
  // Formato UTC iCal: YYYYMMDDTHHMMSSZ
  const p = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function buildIcs({ nombre, partidos, equiposMap, ligasMap }) {
  const now = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Basketneta//Calendar//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(nombre)}`,
    `X-WR-CALDESC:${escapeIcs("Partidos de " + nombre + " · La Basketneta")}`,
  ];
  for (const p of partidos) {
    if (!p.fecha_hora) continue;
    const start = new Date(p.fecha_hora);
    if (isNaN(start.getTime())) continue;
    const end = new Date(start.getTime() + 2 * 3600 * 1000); // 2h de duracion estimada
    const eqL = equiposMap[p.id_equipo_local]?.nombre || "?";
    const eqV = equiposMap[p.id_equipo_visitante]?.nombre || "?";
    const liga = ligasMap[p.id_liga]?.nombre || "";
    const played = p.resultado_local != null && p.resultado_visitante != null;
    const summary = played
      ? `${eqL} ${p.resultado_local}-${p.resultado_visitante} ${eqV}`
      : `${eqL} vs ${eqV}`;
    const desc = [liga, p.notas, `https://labasketneta.app/partidos/partido/${p.id}`].filter(Boolean).join(" · ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:partido-${p.id}@labasketneta.app`,
      `DTSTAMP:${ts(now)}`,
      `DTSTART:${ts(start)}`,
      `DTEND:${ts(end)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(desc)}`,
      `URL:https://labasketneta.app/partidos/partido/${p.id}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://x");
    const tipo = url.searchParams.get("tipo");
    const id = url.searchParams.get("id");
    const temporadaFilter = url.searchParams.get("temporada");
    const nombreParam = url.searchParams.get("nombre");
    if (!tipo || !id) {
      res.status(400).send("faltan parametros tipo e id");
      return;
    }
    const supa = createClient(SUPA_URL, SUPA_KEY);
    let q = supa.from("partidos").select("id,fecha_hora,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante,notas,id_liga,temporada");
    if (tipo === "equipo") q = q.or(`id_equipo_local.eq.${id},id_equipo_visitante.eq.${id}`);
    else if (tipo === "liga") q = q.eq("id_liga", id);
    else { res.status(400).send("tipo debe ser equipo o liga"); return; }
    if (temporadaFilter) q = q.eq("temporada", temporadaFilter);
    q = q.order("fecha_hora", { ascending: true });
    const { data: partidos, error } = await q;
    if (error) { res.status(500).send("db error"); return; }
    const eqIds = new Set();
    (partidos || []).forEach(p => { if (p.id_equipo_local) eqIds.add(p.id_equipo_local); if (p.id_equipo_visitante) eqIds.add(p.id_equipo_visitante); });
    const [{ data: eqs }, { data: ligas }] = await Promise.all([
      eqIds.size ? supa.from("equipos").select("id_equipo,nombre").in("id_equipo", [...eqIds]) : Promise.resolve({ data: [] }),
      supa.from("ligas").select("id_liga,nombre").eq("id_liga", tipo === "liga" ? id : partidos?.[0]?.id_liga || "___nope___"),
    ]);
    const equiposMap = {}; (eqs || []).forEach(e => equiposMap[e.id_equipo] = e);
    const ligasMap = {}; (ligas || []).forEach(l => ligasMap[l.id_liga] = l);
    let nombre = nombreParam;
    if (!nombre) {
      if (tipo === "equipo") nombre = equiposMap[id]?.nombre || "Equipo " + id;
      else nombre = ligasMap[id]?.nombre || "Liga " + id;
    }
    const ics = buildIcs({ nombre, partidos: partidos || [], equiposMap, ligasMap });
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600");
    res.setHeader("Content-Disposition", `inline; filename="${(tipo === "equipo" ? "equipo" : "liga")}-${id}.ics"`);
    res.status(200).send(ics);
  } catch (e) {
    console.error("[calendar]", e.message);
    res.status(500).send("error");
  }
};
