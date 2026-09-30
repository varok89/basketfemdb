// cargar-calendario-custom v7
// v7: fix duplicados equipos. `.limit(20000)` no funciona (PostgREST corta
//     a 1000). Usar paginación `.range()` como cargar-calendario-genius.
//     Además, red de seguridad `ilike("nombre", nombre.trim())` antes de
//     insertar equipo nuevo (misma técnica que genius). Evita crear
//     E1577-E1584 duplicados cuando el equipo real existe fuera del top-1000.
// v6: parseFlbb extrae match_url; procesarLiga hace un 2º fetch por partido
//     (solo para los que aún no tienen id_ext_fibalive Y son de las próximas 3 semanas
//     o pasados 7 días) para pillar el gameId fibalive embebido en el match page
//     de luxembourg.basketball. Con eso el cron genius-live-refresh trae live gratis.
// v5: fix regex parseZbl cutoff.
// v4: parsers 'zbl' y 'exz'.
// v3: auto-vincular gameIds fibalive.
// v2: modo preview + aliases. v1: parser flbb.

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

// v7: paginación real de equipos (antes .limit(20000) que PostgREST corta a 1000).
async function fetchAllTeams(): Promise<Array<{ id_equipo: string; nombre: string }>> {
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
  ext_fibalive?: string | null;
  match_url?: string | null; // URL absoluta del match individual (para 2º fetch)
}

function parseFlbb(html: string, tz: string): PartidoParseado[] {
  const out: PartidoParseado[] = [];
  const rx = /<div class="row match-item calendarmatch"\s+data-cluba="([^"]+)"\s+data-clubb="([^"]+)"([\s\S]{0,4000}?)(?=<div class="row match-item calendarmatch"|<div class="row calendardate"|<\/section>)/g;
  let m;
  while ((m = rx.exec(html)) !== null) {
    const local = m[1].trim();
    const visit = m[2].trim();
    const chunk = m[0];
    const linkM = chunk.match(/\/match\/(\d+)\/(\d{4}-\d{2}-\d{2})\/([^"'\s>]+)/);
    if (!linkM) continue;
    const ext_id = linkM[1];
    const fechaBase = linkM[2];
    const matchUrlPath = `/match/${linkM[1]}/${linkM[2]}/${linkM[3]}`.replace(/\/$/, "");
    const horaM = chunk.match(/\d{2}\/\d{2}\/\d{4}\s*-\s*(\d{1,2})h(\d{2})/);
    const hh = horaM ? parseInt(horaM[1], 10) : 0;
    const mmn = horaM ? parseInt(horaM[2], 10) : 0;
    const fecha_iso = toISOFromLocal(fechaBase, hh, mmn, tz);
    const logos = [...chunk.matchAll(/imglogo[^>]*src\s*=\s*"([^"]+)"/g)].map(x => x[1]);
    const scoreM = chunk.match(/>\s*(\d{1,3})\s*[-:]\s*(\d{1,3})\s*</);
    out.push({
      ext_id, fecha_iso, local_nombre: local, visit_nombre: visit,
      local_logo: logos[0] || null, visit_logo: logos[1] || null,
      score_local: scoreM ? parseInt(scoreM[1], 10) : null,
      score_visit: scoreM ? parseInt(scoreM[2], 10) : null,
      match_url: `https://www.luxembourg.basketball${matchUrlPath}`,
    });
  }
  return out;
}

function parseZbl(html: string, tz: string): PartidoParseado[] {
  const out: PartidoParseado[] = [];
  const rx = /<tr[^>]*>([\s\S]{0,8000}?\/zapas\/(\d+)[\s\S]{0,6000}?)<\/tr>/g;
  let m;
  const seen = new Set<string>();
  while ((m = rx.exec(html)) !== null) {
    const chunk = m[1];
    const ext_id = m[2];
    if (seen.has(ext_id)) continue;
    seen.add(ext_id);
    const dsort = chunk.match(/data-sort="(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})"/);
    let fecha_iso: string | null = null;
    if (dsort) {
      fecha_iso = toISOFromLocal(`${dsort[1]}-${dsort[2]}-${dsort[3]}`, parseInt(dsort[4], 10), parseInt(dsort[5], 10), tz);
    }
    const teams = [...chunk.matchAll(/<div class="text-nowrap">([^<]+)<\/div>/g)].map(x => x[1].trim());
    if (teams.length < 2) continue;
    const logos = [...chunk.matchAll(/<img[^>]+src="([^"]+)"[^>]*alt=""/g)].map(x => x[1]).slice(0, 2);
    const scoreM = chunk.match(/<td[^>]*>\s*(\d{1,3})\s*<br>\s*(\d{1,3})\s*<\/td>/);
    const gidM = chunk.match(/webcast\/CBFFE\/(\d+)/);
    out.push({
      ext_id, fecha_iso,
      local_nombre: teams[0], visit_nombre: teams[1],
      local_logo: logos[0] || null, visit_logo: logos[1] || null,
      score_local: scoreM ? parseInt(scoreM[1], 10) : null,
      score_visit: scoreM ? parseInt(scoreM[2], 10) : null,
      ext_fibalive: gidM ? gidM[1] : null,
    });
  }
  return out;
}

function parseExz(html: string, tz: string): PartidoParseado[] {
  const out: PartidoParseado[] = [];
  const rx = /<tr class="(?:odd|even)">([\s\S]{0,3000}?)<\/tr>/g;
  let m;
  const seen = new Set<string>();
  while ((m = rx.exec(html)) !== null) {
    const chunk = m[1];
    const idM = chunk.match(/matchId=(\d+)/);
    if (!idM) continue;
    const ext_id = idM[1];
    if (seen.has(ext_id)) continue;
    seen.add(ext_id);
    const fechaM = chunk.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    let fecha_iso: string | null = null;
    if (fechaM) fecha_iso = toISOFromLocal(`${fechaM[3]}-${fechaM[2]}-${fechaM[1]}`, 0, 0, tz);
    const teams = [...chunk.matchAll(/<a[^>]+href="\/stats\/team\?teamId=\d+[^"]*"[^>]*>([^<]+)<\/a>/g)].map(x => x[1].trim());
    if (teams.length < 2) continue;
    const scoreM = chunk.match(/<a[^>]+href="\/stats\/match-stats\?[^"]+"[^>]*>(\d{1,3}):(\d{1,3})<\/a>/);
    out.push({
      ext_id, fecha_iso,
      local_nombre: teams[0], visit_nombre: teams[1],
      local_logo: null, visit_logo: null,
      score_local: scoreM ? parseInt(scoreM[1], 10) : null,
      score_visit: scoreM ? parseInt(scoreM[2], 10) : null,
    });
  }
  return out;
}

const PARSERS: Record<string, (html: string, tz: string) => PartidoParseado[]> = {
  flbb: parseFlbb, zbl: parseZbl, exz: parseExz,
};

// Segunda pasada: para cada partido cuyo match_url exista y aún no tenga
// ext_fibalive, hacer fetch a esa URL y extraer el gameId de
// fibalivestats.dcd.shared.geniussports.com/u/LUX/{gameId}/.
async function enriquecerFibaliveDesdeMatchPages(partidos: PartidoParseado[]): Promise<number> {
  const target = partidos.filter(p => p.match_url && !p.ext_fibalive);
  let hits = 0;
  // Concurrencia limitada.
  const CONC = 6;
  const queue = [...target];
  async function worker() {
    while (queue.length) {
      const p = queue.shift(); if (!p) return;
      try {
        const r = await fetch(p.match_url!, {
          headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
          signal: AbortSignal.timeout(12000),
        });
        if (!r.ok) continue;
        const html = await r.text();
        const m = html.match(/fibalivestats\.dcd\.shared\.geniussports\.com\/u\/[A-Z]+\/(\d+)/);
        if (m) { p.ext_fibalive = m[1]; hits++; }
      } catch { /* ignore */ }
    }
  }
  await Promise.all(Array.from({length: CONC}, worker));
  return hits;
}

async function autoVincularFibalive(cfg: any, temporada: string): Promise<any> {
  if (!cfg.genius_comp_id) return { skipped: "sin genius_comp_id" };
  const url = `https://fibalivestats.dcd.shared.geniussports.com/data/competition/${cfg.genius_comp_id}.json?_cb=${Date.now()}`;
  let list: any[] = [];
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    list = await r.json();
  } catch (e) { return { error: `fetch ${(e as Error).name}` }; }
  if (!Array.isArray(list) || list.length === 0) return { total_fibalive: 0 };

  const { data: partidosBD } = await sb.from("partidos")
    .select("id, fecha_hora, id_equipo_local, id_equipo_visitante, id_ext_fibalive")
    .eq("id_liga", cfg.id_liga).eq("temporada", temporada)
    .is("id_ext_fibalive", null);
  if (!partidosBD || partidosBD.length === 0) return { total_fibalive: list.length, vinculados: 0, mensaje: "todos ya vinculados" };

  const { data: aliases } = await sb.from("equipos_alias").select("id_equipo, alias_normalizado").eq("source", cfg.parser);
  const aliasMap = new Map<string, string>();
  (aliases || []).forEach(a => aliasMap.set(a.alias_normalizado, a.id_equipo));
  const allTeams = await fetchAllTeams();
  const nameMap = new Map<string, string>();
  allTeams.forEach(e => nameMap.set(norm(e.nombre), e.id_equipo));
  const resolveTeam = (nombre: string): string | null => {
    const k = norm(nombre);
    return aliasMap.get(k) || nameMap.get(k) || null;
  };

  let vinculados = 0;
  const detalles: string[] = [];
  const WINDOW_MS = 90 * 60 * 1000;
  for (const m of list) {
    const idLocal = resolveTeam(m.homename || "");
    const idVisit = resolveTeam(m.awayname || "");
    if (!idLocal || !idVisit) continue;
    const fechaFibalive = m.matchTimeUTC ? Date.parse(m.matchTimeUTC) : Date.parse(m.matchTime + "Z");
    if (isNaN(fechaFibalive)) continue;
    const candidato = partidosBD.find(p => {
      if (!p.fecha_hora) return false;
      const dt = Date.parse(p.fecha_hora);
      if (isNaN(dt) || Math.abs(dt - fechaFibalive) > WINDOW_MS) return false;
      return (p.id_equipo_local === idLocal && p.id_equipo_visitante === idVisit)
          || (p.id_equipo_local === idVisit && p.id_equipo_visitante === idLocal);
    });
    if (!candidato) continue;
    const { error } = await sb.from("partidos").update({ id_ext_fibalive: String(m.matchId) }).eq("id", candidato.id);
    if (!error) {
      vinculados++;
      candidato.id_ext_fibalive = String(m.matchId);
      detalles.push(`${m.matchId} → ${candidato.id} (${m.homename} vs ${m.awayname})`);
    }
  }
  return { total_fibalive: list.length, sin_id_ext_fibalive_bd: partidosBD.length, vinculados, detalles: detalles.slice(0, 10) };
}

async function procesarLiga(cfg: any, opts: { preview?: boolean } = {}): Promise<any> {
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

  // Enriquecer con gameId fibalive desde match pages (parser flbb principalmente).
  // Filtramos: solo partidos con match_url, sin gameId ya, y ventana [-7 días, +21 días]
  // para evitar 100 fetches innecesarios de partidos lejanos que aún no lo tendrán.
  const now = Date.now();
  const enrichCandidates = partidos.filter(p => {
    if (!p.match_url || p.ext_fibalive) return false;
    if (!p.fecha_iso) return true; // sin fecha → próximo, mérece intento
    const dt = Date.parse(p.fecha_iso);
    if (isNaN(dt)) return true;
    return dt >= now - 7*86400_000 && dt <= now + 21*86400_000;
  });
  let enrich_hits = 0;
  if (enrichCandidates.length) enrich_hits = await enriquecerFibaliveDesdeMatchPages(enrichCandidates);

  if (opts.preview) {
    const uniq = new Map<string, { nombre: string; logo: string | null }>();
    for (const p of partidos) {
      if (!uniq.has(norm(p.local_nombre))) uniq.set(norm(p.local_nombre), { nombre: p.local_nombre, logo: p.local_logo || null });
      if (!uniq.has(norm(p.visit_nombre))) uniq.set(norm(p.visit_nombre), { nombre: p.visit_nombre, logo: p.visit_logo || null });
    }
    const equiposScraper = [...uniq.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    const con_fibalive = partidos.filter(p => p.ext_fibalive).length;
    return { ok: true, id_liga: cfg.id_liga, temporada, total_partidos: partidos.length, con_gameId_fibalive: con_fibalive, enrich_intentos: enrichCandidates.length, enrich_hits, equipos_scraper: equiposScraper };
  }

  // v7: paginación en lugar de .limit(20000) que PostgREST corta a 1000.
  const allTeams = await fetchAllTeams();
  const equiposMap = new Map<string, string>();
  let maxNum = 0;
  allTeams.forEach(e => {
    equiposMap.set(norm(e.nombre), e.id_equipo);
    const n = parseInt(String(e.id_equipo).replace(/^E/, ""), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  });
  const { data: aliases } = await sb.from("equipos_alias").select("id_equipo, alias_normalizado").eq("source", cfg.parser);
  const aliasMap = new Map<string, string>();
  (aliases || []).forEach(a => aliasMap.set(a.alias_normalizado, a.id_equipo));
  const startTeams = equiposMap.size;
  let nextId = maxNum + 1;

  async function resolverEquipo(nombre: string, escudo: string | null): Promise<string> {
    const clave = norm(nombre);
    if (aliasMap.has(clave)) return aliasMap.get(clave)!;
    if (equiposMap.has(clave)) return equiposMap.get(clave)!;
    // v7: red de seguridad — doble-check por SELECT directo antes de crear
    // (evita duplicados si nombre BD y nombre scraper difieren solo en variantes
    // menores que el matcher `norm()` no captura pero ilike case-insensitive sí).
    const { data: existente } = await sb.from("equipos").select("id_equipo").ilike("nombre", nombre.trim()).limit(1).maybeSingle();
    if (existente?.id_equipo) { equiposMap.set(clave, existente.id_equipo); return existente.id_equipo; }
    const nuevoId = `E${nextId++}`;
    const { error } = await sb.from("equipos").insert({ id_equipo: nuevoId, nombre, escudo, tipo: "club" });
    if (error) throw new Error(`Crear ${nombre}: ${error.message}`);
    equiposMap.set(clave, nuevoId);
    return nuevoId;
  }

  const { data: existentes } = await sb.from("partidos")
    .select("id, id_ext, fecha_hora, id_equipo_local, id_equipo_visitante, resultado_local, resultado_visitante, id_ext_fibalive")
    .eq("id_liga", cfg.id_liga).eq("temporada", temporada);
  const porExt = new Map<string, any>();
  (existentes || []).forEach(p => { if (p.id_ext) porExt.set(String(p.id_ext), p); });

  let creados = 0, actualizados = 0, sinFecha = 0, fibalive_directos = 0;
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
        if (p.ext_fibalive && !ya.id_ext_fibalive) { upd.id_ext_fibalive = p.ext_fibalive; fibalive_directos++; }
        if (Object.keys(upd).length > 0) { await sb.from("partidos").update(upd).eq("id", ya.id); actualizados++; }
      } else {
        const row: any = {
          id_liga: cfg.id_liga, temporada, id_ext: p.ext_id, fuente: cfg.parser,
          id_equipo_local: idL, id_equipo_visitante: idV, fecha_hora: p.fecha_iso,
        };
        if (p.score_local != null && p.score_visit != null) {
          row.resultado_local = p.score_local; row.resultado_visitante = p.score_visit;
        }
        if (p.ext_fibalive) { row.id_ext_fibalive = p.ext_fibalive; fibalive_directos++; }
        const { error } = await sb.from("partidos").insert(row);
        if (error) errs.push(`err ${p.ext_id}: ${error.message}`); else creados++;
      }
    } catch (e) { errs.push(`err ${p.ext_id}: ${(e as Error).message}`); }
  }

  const autoFibalive = await autoVincularFibalive(cfg, temporada);

  const result = {
    ok: true, id_liga: cfg.id_liga, temporada,
    total: partidos.length, creados, actualizados, sin_fecha: sinFecha,
    equipos_creados: equiposMap.size - startTeams,
    fibalive_directos, enrich_intentos: enrichCandidates.length, enrich_hits,
    errores: errs.slice(0, 10), auto_fibalive: autoFibalive,
  };
  await sb.from("scrapers_ligas").update({ last_run: new Date().toISOString(), last_result: result }).eq("id_liga", cfg.id_liga);
  return result;
}

async function descubrirCompId(gameId: string): Promise<{ comp_id: number | null; error?: string }> {
  try {
    const trySlugs = ["LUX", "WBBL", "BB", "DAM", "KKI", "FLB", "CBFFE", "SBA"];
    for (const slug of trySlugs) {
      const r = await fetch(`https://fibalivestats.dcd.shared.geniussports.com/u/${slug}/${gameId}/`, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) continue;
      const html = await r.text();
      const m = html.match(/compId"\s*value\s*=\s*"(\d+)"/);
      if (m) return { comp_id: parseInt(m[1], 10) };
    }
    return { comp_id: null, error: "compId no encontrado en ningún slug" };
  } catch (e) { return { comp_id: null, error: (e as Error).message }; }
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

    if (body.discover_comp_id_from_game) {
      const gameId = String(body.discover_comp_id_from_game).match(/\d{5,}/)?.[0];
      if (!gameId) return json({ ok: false, error: "gameId inválido" }, 400);
      const r = await descubrirCompId(gameId);
      return json({ ok: !!r.comp_id, ...r, gameId });
    }

    let q = sb.from("scrapers_ligas").select("*").eq("activo", true);
    if (body.id_liga) q = q.eq("id_liga", body.id_liga);
    const { data: cfgs, error } = await q;
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!cfgs || cfgs.length === 0) return json({ ok: true, mensaje: "Sin scrapers custom activos" });
    const preview = !!body.preview;
    const resultados: any[] = [];
    for (const cfg of cfgs) {
      try { resultados.push(await procesarLiga(cfg, { preview })); }
      catch (e) { resultados.push({ ok: false, id_liga: cfg.id_liga, error: String(e) }); }
    }
    return json({ ok: true, procesadas: resultados.length, resultados });
  } catch (e) { return json({ ok: false, error: String(e) }, 500); }
});
