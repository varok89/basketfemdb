// cargar-calendario-genius v3
// v3: paginación real al cargar equipos (el .limit(20000) anterior cedía al
//     max-rows del server ~1000 y se creaban duplicados). Además, red de
//     seguridad en resolverEquipo: antes de crear, doble-check por SELECT
//     directo por nombre normalizado. Consulta equipos_alias source='genius'.
// v2: base scraper Genius Sports hosted.dcd.shared.geniussports.com.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const TZ_POR_PAIS: Record<string, string> = {
  "Dinamarca":"Europe/Copenhagen", "Bélgica":"Europe/Brussels",
  "Islandia":"Atlantic/Reykjavik", "Reino Unido":"Europe/London",
  "Inglaterra":"Europe/London", "Alemania":"Europe/Berlin",
  "Francia":"Europe/Paris", "España":"Europe/Madrid",
  "Italia":"Europe/Rome", "Suiza":"Europe/Zurich",
  "Suecia":"Europe/Stockholm", "Noruega":"Europe/Oslo",
  "Finlandia":"Europe/Helsinki", "Estonia":"Europe/Tallinn",
  "Letonia":"Europe/Riga", "Lituania":"Europe/Vilnius",
  "Polonia":"Europe/Warsaw", "Chequia":"Europe/Prague",
  "Eslovaquia":"Europe/Bratislava", "Hungría":"Europe/Budapest",
  "Grecia":"Europe/Athens", "Rumanía":"Europe/Bucharest",
  "Luxemburgo":"Europe/Luxembourg",
};
const MESES: Record<string, number> = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };

function parseFechaGenius(str: string, tz: string): string | null {
  const m = /^(\w+)\s+(\d+),\s+(\d+),\s+(\d+):(\d+)\s+(AM|PM)$/i.exec(str.trim());
  if (!m) return null;
  const [, mon, day, year, hourStr, minStr, ampm] = m;
  const mo = MESES[mon.slice(0, 3)]; if (mo == null) return null;
  let h = parseInt(hourStr, 10);
  if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
  if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
  const asUTC = new Date(Date.UTC(parseInt(year,10), mo, parseInt(day,10), h, parseInt(minStr,10), 0));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(asUTC);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || "0", 10);
  const tzUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(asUTC.getTime() - (tzUTC - asUTC.getTime())).toISOString();
}

function temporadaActual(): string {
  const now = new Date();
  const inicio = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, "0")}`;
}

interface PartidoGenius {
  gameId: string; status: string; fechaTxt: string | null;
  home: { nombre: string; logo: string | null };
  away: { nombre: string; logo: string | null };
  score_home: number | null; score_away: number | null;
}

function parseSchedule(html: string): PartidoGenius[] {
  const out: PartidoGenius[] = [];
  const rxMatch = /<div class="match-wrap\s+STATUS_(\w+)"\s+id\s*=\s*"extfix_(\d+)">/g;
  const bloques: { pos: number; gameId: string; status: string }[] = [];
  let m;
  while ((m = rxMatch.exec(html)) !== null) bloques.push({ pos: m.index, status: m[1], gameId: m[2] });
  for (let i = 0; i < bloques.length; i++) {
    const start = bloques[i].pos;
    const end = i + 1 < bloques.length ? bloques[i + 1].pos : html.length;
    const chunk = html.slice(start, end);
    const fechaM = /match-time"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/.exec(chunk);
    const fechaTxt = fechaM ? fechaM[1].trim() : null;
    const teams = [...chunk.matchAll(/class="team-name-full">([^<]+)</g)].map(x => x[1].trim());
    const logos = [...chunk.matchAll(/team-logo[\s\S]{0,300}?<img\s+src\s*=\s*"([^"]+)"/g)].map(x => x[1]);
    const scores = [...chunk.matchAll(/team-score[^"]*"[\s\S]{0,300}?<span[^>]*>(\d+)<\/span>/g)].map(x => parseInt(x[1], 10));
    if (teams.length < 2) continue;
    out.push({
      gameId: bloques[i].gameId, status: bloques[i].status, fechaTxt,
      home: { nombre: teams[0], logo: logos[0] || null },
      away: { nombre: teams[1], logo: logos[1] || null },
      score_home: scores[0] ?? null, score_away: scores[1] ?? null,
    });
  }
  return out;
}

// Paginación real (Supabase corta a max-rows ~1000 aunque pidas .limit(20000)).
async function fetchAllTeams() {
  const out: Array<{ id_equipo: string; nombre: string }> = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await sb.from("equipos").select("id_equipo, nombre").range(from, from + step - 1);
    if (error) throw new Error(`fetchAllTeams: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < step) break;
    from += step;
  }
  return out;
}

async function resolverEquipo(nombre: string, escudo: string | null, equiposMap: Map<string, string>, aliasMap: Map<string, string>, nextIdRef: { n: number }): Promise<string> {
  const clave = norm(nombre);
  if (aliasMap.has(clave)) return aliasMap.get(clave)!;
  if (equiposMap.has(clave)) return equiposMap.get(clave)!;
  // Red de seguridad: doble-check por SELECT directo antes de crear.
  const { data: existente } = await sb.from("equipos").select("id_equipo").ilike("nombre", nombre.trim()).limit(1).maybeSingle();
  if (existente?.id_equipo) { equiposMap.set(clave, existente.id_equipo); return existente.id_equipo; }
  const limpioNombre = nombre.replace(/&amp;/g, "&");
  const nuevoId = `E${nextIdRef.n}`;
  nextIdRef.n += 1;
  const { error } = await sb.from("equipos").insert({ id_equipo: nuevoId, nombre: limpioNombre, escudo, tipo: "club" });
  if (error) throw new Error(`Crear equipo ${nombre}: ${error.message}`);
  equiposMap.set(clave, nuevoId);
  return nuevoId;
}

async function procesarLiga(liga: any, temporadaFijada?: string): Promise<any> {
  if (!liga.genius_org || !liga.genius_comp_id) return { ok: false, id_liga: liga.id_liga, motivo: "sin genius_org/comp_id" };
  const temporada = temporadaFijada || temporadaActual();
  const tz = TZ_POR_PAIS[liga.pais || ""] || "UTC";
  const url = `https://hosted.dcd.shared.geniussports.com/${liga.genius_org}/en/competition/${liga.genius_comp_id}/schedule?_cb=${Date.now()}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) return { ok: false, id_liga: liga.id_liga, motivo: `HTTP ${r.status}` };
  const html = await r.text();
  const partidos = parseSchedule(html);
  if (partidos.length === 0) return { ok: true, id_liga: liga.id_liga, temporada, total_scrape: 0, motivo: "vacío" };

  const allTeams = await fetchAllTeams();
  const equiposMap = new Map<string, string>();
  let maxNum = 0;
  allTeams.forEach(e => {
    equiposMap.set(norm(e.nombre), e.id_equipo);
    const n = parseInt(String(e.id_equipo).replace(/^E/, ""), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  });
  const { data: aliases } = await sb.from("equipos_alias").select("id_equipo, alias_normalizado").eq("source", "genius");
  const aliasMap = new Map<string, string>();
  (aliases || []).forEach(a => aliasMap.set(a.alias_normalizado, a.id_equipo));
  const startTeams = equiposMap.size;
  const nextIdRef = { n: maxNum + 1 };

  const { data: existentes } = await sb.from("partidos")
    .select("id, id_ext, fecha_hora, id_equipo_local, id_equipo_visitante")
    .eq("id_liga", liga.id_liga).eq("temporada", temporada);
  const porExt = new Map<string, any>();
  (existentes || []).forEach(p => { if (p.id_ext) porExt.set(String(p.id_ext), p); });

  let creados = 0, actualizados = 0, sinFecha = 0;
  const detalles: string[] = [];
  for (const g of partidos) {
    const idLocal = await resolverEquipo(g.home.nombre, g.home.logo, equiposMap, aliasMap, nextIdRef).catch(e => { detalles.push(`err team L ${g.gameId}: ${e.message}`); return null; });
    const idVisit = await resolverEquipo(g.away.nombre, g.away.logo, equiposMap, aliasMap, nextIdRef).catch(e => { detalles.push(`err team V ${g.gameId}: ${e.message}`); return null; });
    if (!idLocal || !idVisit) continue;
    const fechaISO = g.fechaTxt ? parseFechaGenius(g.fechaTxt, tz) : null;
    if (!fechaISO) sinFecha++;
    const ya = porExt.get(g.gameId);
    if (ya) {
      const upd: any = {};
      if (fechaISO && (!ya.fecha_hora || String(ya.fecha_hora).slice(0, 16) !== fechaISO.slice(0, 16))) upd.fecha_hora = fechaISO;
      if (!ya.id_equipo_local) upd.id_equipo_local = idLocal;
      if (!ya.id_equipo_visitante) upd.id_equipo_visitante = idVisit;
      if (Object.keys(upd).length > 0) { await sb.from("partidos").update(upd).eq("id", ya.id); actualizados++; }
    } else {
      const row: any = {
        id_liga: liga.id_liga, temporada, id_ext: g.gameId, fuente: "genius",
        id_equipo_local: idLocal, id_equipo_visitante: idVisit, fecha_hora: fechaISO,
      };
      if (g.status === "COMPLETED" && g.score_home != null && g.score_away != null) {
        row.resultado_local = g.score_home; row.resultado_visitante = g.score_away;
      }
      const { error } = await sb.from("partidos").insert(row);
      if (error) detalles.push(`err ${g.gameId}: ${error.message}`); else creados++;
    }
  }

  return {
    ok: true, id_liga: liga.id_liga, temporada, total_scrape: partidos.length,
    creados, actualizados, sin_fecha: sinFecha,
    equipos_creados: equiposMap.size - startTeams,
    detalles: detalles.slice(0, 10),
  };
}

Deno.serve(async (req) => {
  const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    let q = sb.from("ligas").select("id_liga, nombre, pais, genius_org, genius_comp_id")
      .eq("fuente_live", "genius").not("genius_org", "is", null).not("genius_comp_id", "is", null);
    if (body.id_liga) q = q.eq("id_liga", body.id_liga);
    const { data: ligas, error } = await q;
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!ligas || ligas.length === 0) return json({ ok: true, mensaje: "Sin ligas Genius" });
    const resultados: any[] = [];
    for (const l of ligas) {
      try { resultados.push(await procesarLiga(l, body.temporada)); }
      catch (e) { resultados.push({ ok: false, id_liga: l.id_liga, error: String(e) }); }
    }
    return json({ ok: true, procesadas: resultados.length, resultados });
  } catch (e) { return json({ ok: false, error: String(e) }, 500); }
});
