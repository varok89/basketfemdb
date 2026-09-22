// cargar-calendario-custom v1
// Router de scrapers custom configurados en scrapers_ligas.
// Aditivo: no reemplaza cargar-calendario-genius ni las funciones FEB/LFB.
// Parsers actuales:
//   - flbb: luxembourg.basketball
// Body: { id_liga } (opcional: si no, procesa todos los activos)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function temporadaActual(): string {
  const now = new Date();
  const inicio = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, "0")}`;
}

// Convierte "YYYY-MM-DD HH:MM" en tz local a ISO UTC.
function toISOFromLocal(fechaISO: string, hh: number, mm: number, tz: string): string | null {
  const [y, mo, d] = fechaISO.split("-").map(x => parseInt(x, 10));
  if (!y || !mo || !d) return null;
  const asUTC = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0));
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(asUTC);
    const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || "0", 10);
    const tzUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return new Date(asUTC.getTime() - (tzUTC - asUTC.getTime())).toISOString();
  } catch { return asUTC.toISOString(); }
}

interface PartidoParseado {
  ext_id: string;
  fecha_iso: string | null;
  local_nombre: string;
  visit_nombre: string;
  local_logo?: string | null;
  visit_logo?: string | null;
  score_local?: number | null;
  score_visit?: number | null;
}

// Parser FLBB (luxembourg.basketball).
// <div class="row match-item calendarmatch" data-cluba="X" data-clubb="Y">…</div>
// El link <a href="/match/{id}/{yyyy-mm-dd}/…"> da id externo + fecha base.
// El bloque incluye "DD/MM/YYYY - HHhMM" con la hora local, 2 <img class="imglogo">,
// y en partidos jugados un ">NN - MM<" con la puntuación.
function parseFlbb(html: string, tz: string): PartidoParseado[] {
  const out: PartidoParseado[] = [];
  const rx = /<div class="row match-item calendarmatch"\s+data-cluba="([^"]+)"\s+data-clubb="([^"]+)"([\s\S]{0,4000}?)(?=<div class="row match-item calendarmatch"|<div class="row calendardate"|<\/section>)/g;
  let m;
  while ((m = rx.exec(html)) !== null) {
    const local = m[1].trim();
    const visit = m[2].trim();
    const chunk = m[0];
    const linkM = chunk.match(/\/match\/(\d+)\/(\d{4}-\d{2}-\d{2})\//);
    if (!linkM) continue;
    const ext_id = linkM[1];
    const fechaBase = linkM[2];
    const horaM = chunk.match(/\d{2}\/\d{2}\/\d{4}\s*-\s*(\d{1,2})h(\d{2})/);
    const hh = horaM ? parseInt(horaM[1], 10) : 0;
    const mmn = horaM ? parseInt(horaM[2], 10) : 0;
    const fecha_iso = toISOFromLocal(fechaBase, hh, mmn, tz);
    const logos = [...chunk.matchAll(/imglogo[^>]*src\s*=\s*"([^"]+)"/g)].map(x => x[1]);
    const scoreM = chunk.match(/>\s*(\d{1,3})\s*[-:]\s*(\d{1,3})\s*</);
    out.push({
      ext_id, fecha_iso,
      local_nombre: local, visit_nombre: visit,
      local_logo: logos[0] || null, visit_logo: logos[1] || null,
      score_local: scoreM ? parseInt(scoreM[1], 10) : null,
      score_visit: scoreM ? parseInt(scoreM[2], 10) : null,
    });
  }
  return out;
}

const PARSERS: Record<string, (html: string, tz: string) => PartidoParseado[]> = {
  flbb: parseFlbb,
};

async function procesarLiga(cfg: any): Promise<any> {
  const parser = PARSERS[cfg.parser];
  if (!parser) return { ok: false, id_liga: cfg.id_liga, error: `Parser desconocido: ${cfg.parser}` };
  const temporada = cfg.temporada || temporadaActual();
  let html: string;
  try {
    const r = await fetch(cfg.url_calendario, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return { ok: false, id_liga: cfg.id_liga, error: `HTTP ${r.status}` };
    html = await r.text();
  } catch (e) { return { ok: false, id_liga: cfg.id_liga, error: `fetch ${(e as Error).name}` }; }

  const partidos = parser(html, cfg.tz || "UTC");
  if (!partidos.length) return { ok: true, id_liga: cfg.id_liga, temporada, total: 0, mensaje: "sin partidos parseables" };

  const { data: allTeams } = await sb.from("equipos").select("id_equipo, nombre").limit(20000);
  const equiposMap = new Map<string, string>();
  let maxNum = 0;
  (allTeams || []).forEach(e => {
    equiposMap.set(norm(e.nombre), e.id_equipo);
    const n = parseInt(String(e.id_equipo).replace(/^E/, ""), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  });
  const startTeams = equiposMap.size;
  let nextId = maxNum + 1;

  async function resolverEquipo(nombre: string, escudo: string | null): Promise<string> {
    const clave = norm(nombre);
    if (equiposMap.has(clave)) return equiposMap.get(clave)!;
    const nuevoId = `E${nextId++}`;
    const { error } = await sb.from("equipos").insert({ id_equipo: nuevoId, nombre, escudo, tipo: "club" });
    if (error) throw new Error(`Crear ${nombre}: ${error.message}`);
    equiposMap.set(clave, nuevoId);
    return nuevoId;
  }

  const { data: existentes } = await sb.from("partidos")
    .select("id, id_ext, fecha_hora, id_equipo_local, id_equipo_visitante, resultado_local, resultado_visitante")
    .eq("id_liga", cfg.id_liga).eq("temporada", temporada);
  const porExt = new Map<string, any>();
  (existentes || []).forEach(p => { if (p.id_ext) porExt.set(String(p.id_ext), p); });

  let creados = 0, actualizados = 0, sinFecha = 0;
  const errs: string[] = [];
  for (const p of partidos) {
    try {
      const idL = await resolverEquipo(p.local_nombre, p.local_logo || null);
      const idV = await resolverEquipo(p.visit_nombre, p.visit_logo || null);
      if (!p.fecha_iso) sinFecha++;
      const ya = porExt.get(p.ext_id);
      if (ya) {
        const upd: any = {};
        if (p.fecha_iso && (!ya.fecha_hora || String(ya.fecha_hora).slice(0, 16) !== p.fecha_iso.slice(0, 16))) upd.fecha_hora = p.fecha_iso;
        if (!ya.id_equipo_local) upd.id_equipo_local = idL;
        if (!ya.id_equipo_visitante) upd.id_equipo_visitante = idV;
        if (p.score_local != null && p.score_visit != null && (ya.resultado_local == null || ya.resultado_visitante == null)) {
          upd.resultado_local = p.score_local; upd.resultado_visitante = p.score_visit;
        }
        if (Object.keys(upd).length > 0) { await sb.from("partidos").update(upd).eq("id", ya.id); actualizados++; }
      } else {
        const row: any = {
          id_liga: cfg.id_liga, temporada, id_ext: p.ext_id, fuente: cfg.parser,
          id_equipo_local: idL, id_equipo_visitante: idV, fecha_hora: p.fecha_iso,
        };
        if (p.score_local != null && p.score_visit != null) {
          row.resultado_local = p.score_local; row.resultado_visitante = p.score_visit;
        }
        const { error } = await sb.from("partidos").insert(row);
        if (error) errs.push(`err ${p.ext_id}: ${error.message}`); else creados++;
      }
    } catch (e) { errs.push(`err ${p.ext_id}: ${(e as Error).message}`); }
  }

  const result = {
    ok: true, id_liga: cfg.id_liga, temporada,
    total: partidos.length, creados, actualizados, sin_fecha: sinFecha,
    equipos_creados: equiposMap.size - startTeams,
    errores: errs.slice(0, 10),
  };
  await sb.from("scrapers_ligas").update({ last_run: new Date().toISOString(), last_result: result }).eq("id_liga", cfg.id_liga);
  return result;
}

Deno.serve(async (req) => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    let q = sb.from("scrapers_ligas").select("*").eq("activo", true);
    if (body.id_liga) q = q.eq("id_liga", body.id_liga);
    const { data: cfgs, error } = await q;
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!cfgs || cfgs.length === 0) return json({ ok: true, mensaje: "Sin scrapers custom activos" });
    const resultados: any[] = [];
    for (const cfg of cfgs) {
      try { resultados.push(await procesarLiga(cfg)); }
      catch (e) { resultados.push({ ok: false, id_liga: cfg.id_liga, error: String(e) }); }
    }
    return json({ ok: true, procesadas: resultados.length, resultados });
  } catch (e) { return json({ ok: false, error: String(e) }, 500); }
});
