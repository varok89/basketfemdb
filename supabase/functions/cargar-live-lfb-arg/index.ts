// cargar-live-lfb-arg v6 - fix paginacion equipos (>1000) + ALIAS map
// Scraper Liga Femenina Basquet Argentina (L028) desde laliganacional.com.ar/lfb
// Endpoint real: /lfb/fixture?handler=ProximosPartidos&fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
// IMPORTANTE: id_ext (hash v2...) cambia entre peticiones. No es estable.
// Clave de dedup: (id_liga, id_equipo_local, id_equipo_visitante, fecha_hora ±4h).
// Modos:
//   schedule → scrape ventana amplia, upsert partidos (sin boxscore)
//   live     → scrape ventana [-30min, +4h] + catch-up, update marcador + boxscore
//   both     → ambas en el mismo tick
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const BASE = "https://www.laliganacional.com.ar";
const UA = { "User-Agent": "Mozilla/5.0", "Accept-Language": "es-ES,es;q=0.9" };

const Params = z.object({
  modo: z.enum(["schedule","live","both"]).optional().default("both"),
  dias_atras: z.number().int().min(0).max(60).optional().default(7),
  dias_adelante: z.number().int().min(0).max(60).optional().default(14),
  limit_detail: z.number().int().min(1).max(50).optional().default(15),
  dry: z.boolean().optional().default(false),
}).strict();

async function fetchHtml(path: string): Promise<string | null> {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`${BASE}${path}`, { headers: UA, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; } finally { clearTimeout(to); }
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const MESES: Record<string, number> = { enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11 };

type PartidoFix = {
  id_ext_temp: string; url: string;
  localClub: string; localTeam: string; localNombre: string;
  visitClub: string; visitTeam: string; visitNombre: string;
  scoreLocal: number | null; scoreVisit: number | null;
  fechaStr: string | null; fechaIso: string | null;
  campo: string;
};

function parseFechaCelda(txt: string): string | null {
  // Formatos vistos: "DD/MM/YYYY HH:MM VENUE" o "DD de mes YYYY HH:MM"
  let m = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) {
    const [, d, mo, y, hh, mm] = m;
    return new Date(Date.UTC(+y, +mo - 1, +d, +hh + 3, +mm)).toISOString();
  }
  m = txt.match(/(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)[\s\w]*?(\d{4})\s*(\d{1,2}):(\d{2})/i);
  if (m) {
    const [, d, mes, y, hh, mm] = m;
    return new Date(Date.UTC(+y, MESES[mes.toLowerCase()], +d, +hh + 3, +mm)).toISOString();
  }
  return null;
}

function parseFixtureRango(html: string): PartidoFix[] {
  const rows = [...html.matchAll(/<tr\s+class="fila-tabla-calendarios[^"]*"[\s\S]*?<\/tr>/g)];
  const out: PartidoFix[] = [];
  for (const r of rows) {
    const h = r[0];
    const eqRe = /\/lfb\/equipo\/(\d+)\/(\d+)\/[^"]+"[\s\S]*?<strong[^>]*>([^<]+)<\/strong>/g;
    const equipos: { club: string; team: string; nombre: string }[] = [];
    let em: RegExpExecArray | null;
    while ((em = eqRe.exec(h)) !== null) {
      // dedupe (local tiene 2 refs: escudo + nombre)
      if (!equipos.find(e => e.club === em![1] && e.team === em![2])) {
        equipos.push({ club: em![1], team: em![2], nombre: em![3].trim() });
      }
    }
    if (equipos.length < 2) continue;
    const scoresRe = /<td\s+class="resultados"[^>]*>\s*<strong>\s*(\d+)\s*<\/strong>\s*<\/td>/g;
    const scores: number[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = scoresRe.exec(h)) !== null) scores.push(parseInt(sm[1]));

    const partidoLink = h.match(/\/lfb\/partido\/([^"\/]+)\/([^"\/]+)/);
    const id_ext_temp = partidoLink ? partidoLink[1] : "";
    const url = partidoLink ? `/lfb/partido/${partidoLink[1]}/${partidoLink[2]}` : "";

    const textoHtml = h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const fechaIso = parseFechaCelda(textoHtml);
    const campoM = textoHtml.match(/\d{1,2}:\d{2}\s+(.+?)(?:\s{2}|$)/);
    const campo = campoM ? campoM[1].trim().slice(0, 100) : "";

    out.push({
      id_ext_temp, url,
      localClub: equipos[0].club, localTeam: equipos[0].team, localNombre: equipos[0].nombre,
      visitClub: equipos[1].club, visitTeam: equipos[1].team, visitNombre: equipos[1].nombre,
      scoreLocal: scores[0] ?? null, scoreVisit: scores[1] ?? null,
      fechaStr: null, fechaIso, campo,
    });
  }
  return out;
}

async function fetchFixtureRango(desdeYmd: string, hastaYmd: string): Promise<PartidoFix[]> {
  const html = await fetchHtml(`/lfb/fixture?handler=ProximosPartidos&fechaInicio=${desdeYmd}&fechaFin=${hastaYmd}`);
  if (!html) return [];
  return parseFixtureRango(html);
}

function matchEquipo(equipos: Map<string, string>, local: PartidoFix["localClub"], team: string, nombre: string, byNombre: Map<string, string>): string | null {
  const k = `${local}|${team}`;
  if (equipos.has(k)) return equipos.get(k)!;
  const n = norm(nombre);
  if (byNombre.has(n)) return byNombre.get(n)!;
  // partial contains
  for (const [cand, id] of byNombre) {
    if (cand.includes(n) || n.includes(cand)) return id;
  }
  return null;
}

async function doSchedule(diasAtras: number, diasAdelante: number, dry: boolean) {
  const now = new Date();
  const d1 = new Date(now.getTime() - diasAtras * 86400000);
  const d2 = new Date(now.getTime() + diasAdelante * 86400000);
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
  const partidos = await fetchFixtureRango(fmt(d1), fmt(d2));

  // Mapeo equipos L028 por nombre
  const { data: tempL028 } = await sb.from("temporadas").select("id_equipo").eq("id_liga","L028").range(0, 9999);
  const l028Set = new Set((tempL028||[]).map((r:any) => r.id_equipo));
  const { data: equiposAll } = await sb.from("equipos").select("id_equipo,nombre").range(0, 9999);
  const byNombre = new Map<string, string>();
  for (const e of equiposAll||[]) if (l028Set.has(e.id_equipo)) byNombre.set(norm(e.nombre), e.id_equipo);
  const byLfbId = new Map<string, string>(); // vacio por ahora, se usa si extendemos equipos con lfb_club_id

  // Partidos L028 ya en BD, para match
  const { data: existing } = await sb.from("partidos").select("id,id_equipo_local,id_equipo_visitante,fecha_hora,resultado_local,resultado_visitante").eq("id_liga","L028").gte("fecha_hora", new Date(now.getTime() - (diasAtras+30)*86400000).toISOString()).range(0, 9999);

  const rep: any = { ventana: `${fmt(d1)} -> ${fmt(d2)}`, parseados: partidos.length, insertados: 0, actualizados: 0, sin_mapear_eq: [] };
  for (const p of partidos) {
    const idLocal = matchEquipo(byLfbId, p.localClub, p.localTeam, p.localNombre, byNombre);
    const idVisit = matchEquipo(byLfbId, p.visitClub, p.visitTeam, p.visitNombre, byNombre);
    if (!idLocal || !idVisit) { if (rep.sin_mapear_eq.length < 15) rep.sin_mapear_eq.push(`${p.localNombre} vs ${p.visitNombre}`); continue; }
    if (!p.fechaIso) continue;
    const fechaMs = new Date(p.fechaIso).getTime();
    const encontrado = (existing||[]).find((e:any) => e.id_equipo_local === idLocal && e.id_equipo_visitante === idVisit && Math.abs(new Date(e.fecha_hora).getTime() - fechaMs) < 4*3600*1000);
    const row: any = {
      id_liga: "L028",
      id_equipo_local: idLocal, id_equipo_visitante: idVisit,
      fecha_hora: p.fechaIso, fuente: "laliganacional",
    };
    if (p.scoreLocal != null) row.resultado_local = p.scoreLocal;
    if (p.scoreVisit != null) row.resultado_visitante = p.scoreVisit;
    if (encontrado) {
      // update si cambian score o fecha
      const upd: any = {};
      if (p.scoreLocal != null && p.scoreLocal !== encontrado.resultado_local) upd.resultado_local = p.scoreLocal;
      if (p.scoreVisit != null && p.scoreVisit !== encontrado.resultado_visitante) upd.resultado_visitante = p.scoreVisit;
      if (!dry && Object.keys(upd).length) {
        await sb.from("partidos").update(upd).eq("id", encontrado.id);
        rep.actualizados++;
      }
    } else {
      if (!dry) {
        const { error } = await sb.from("partidos").insert(row);
        if (!error) rep.insertados++;
      } else rep.insertados++;
    }
  }
  return rep;
}

function parsePartidoDetail(html: string) {
  const estMatch = html.match(/>\s*(Finalizado|No comenzado|En Vivo|En vivo|Descanso|Cuarto \d+)\s*</i);
  const estado = estMatch ? estMatch[1].trim() : "";
  let scores: number[] = [];
  const scRe = /<(?:span|div|strong)[^>]*class="[^"]*(?:score|result|marcador|puntos|resultado)[^"]*"[^>]*>\s*(\d{1,3})\s*</gi;
  let sm: RegExpExecArray | null;
  while ((sm = scRe.exec(html)) !== null) scores.push(parseInt(sm[1]));

  const box: { teamIdx: 0|1; dorsal: string; playerId: string; nombre: string; ptos: number; reb: number; ast: number; fal: number; val: number }[] = [];
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/g)];
  let teamIdx: 0|1 = 0; let found = 0;
  for (const t of tables) {
    const h = t[0];
    if (!/PTOS/i.test(h) || !/REB/i.test(h)) continue;
    const rows = [...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
    for (const r of rows) {
      const row = r[1];
      const pid = row.match(/\/fotos\/(\d+)/)?.[1] || "";
      const dor = row.match(/<strong>\s*(\d+)\s*<\/strong>/)?.[1] || "";
      const nom = row.match(/alt="([^"]+)"/)?.[1]?.trim() || "";
      if (!pid || !nom) continue;
      const cells = [...row.matchAll(/<td[^>]*>\s*(-?\d+)\s*<\/td>/g)].map(m => parseInt(m[1]));
      if (cells.length < 5) continue;
      box.push({ teamIdx, dorsal: dor, playerId: pid, nombre: nom, ptos: cells[0]||0, reb: cells[1]||0, ast: cells[2]||0, fal: cells[3]||0, val: cells[4]||0 });
    }
    found++;
    teamIdx = (teamIdx + 1) % 2 as 0|1;
    if (found >= 2) break;
  }
  return { estado, resultado_local: scores[0] ?? null, resultado_visitante: scores[1] ?? null, box };
}

async function doLive(limit_detail: number, dry: boolean) {
  // Partidos L028 en ventana live [-30min, +4h] o pasados sin resultado 60d
  const now = new Date();
  const desde = new Date(now.getTime() - 30*60*1000).toISOString();
  const hasta = new Date(now.getTime() + 4*3600*1000).toISOString();
  const catchupDesde = new Date(now.getTime() - 60*86400*1000).toISOString();
  const { data: cand1 } = await sb.from("partidos").select("id,fecha_hora,es_live,resultado_local,resultado_visitante,id_equipo_local,id_equipo_visitante").eq("id_liga","L028")
    .or(`es_live.eq.true,and(fecha_hora.gte.${desde},fecha_hora.lte.${hasta})`);
  const { data: cand2 } = await sb.from("partidos").select("id,fecha_hora,es_live,resultado_local,resultado_visitante,id_equipo_local,id_equipo_visitante").eq("id_liga","L028")
    .is("resultado_local", null).gte("fecha_hora", catchupDesde).lte("fecha_hora", desde);
  const map = new Map(); for (const p of (cand1||[])) map.set(p.id, p); for (const p of (cand2||[])) if (!map.has(p.id)) map.set(p.id, p);
  const candidatos = [...map.values()].slice(0, limit_detail);

  if (candidatos.length === 0) return { candidatos: 0, actualizados: 0, boxscore_insertados: 0 };

  // Para obtener id_ext_temp actual: hacer un scrape del fixture en una ventana que cubra
  // todas las fechas de los candidatos y mapear por (local, visit, fecha±4h).
  const fechas = candidatos.map(c => new Date(c.fecha_hora));
  const minF = new Date(Math.min(...fechas.map(d => d.getTime())));
  const maxF = new Date(Math.max(...fechas.map(d => d.getTime())));
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
  const fixPartidos = await fetchFixtureRango(fmt(new Date(minF.getTime() - 86400000)), fmt(new Date(maxF.getTime() + 86400000)));

  const { data: tempL028 } = await sb.from("temporadas").select("id_equipo").eq("id_liga","L028");
  const l028Set = new Set((tempL028||[]).map((r:any) => r.id_equipo));
  const { data: equiposAll } = await sb.from("equipos").select("id_equipo,nombre");
  const byNombre = new Map<string, string>();
  for (const e of equiposAll||[]) if (l028Set.has(e.id_equipo)) byNombre.set(norm(e.nombre), e.id_equipo);
  const byLfbId = new Map<string, string>();

  const { data: jugsAll } = await sb.from("jugadoras").select("id_jugadora,nombre").limit(30000);
  const nameMap = new Map<string, string>();
  for (const j of jugsAll||[]) nameMap.set(norm(j.nombre), j.id_jugadora);

  const rep: any = { candidatos: candidatos.length, actualizados: 0, boxscore_insertados: 0, sin_mapear_jug: [], sin_match_fix: [], errores: [] };
  for (const c of candidatos) {
    // Buscar partido en fixture por (local, visit, fecha±4h)
    const cFecha = new Date(c.fecha_hora).getTime();
    const fix = fixPartidos.find(f => {
      if (!f.fechaIso) return false;
      const idL = matchEquipo(byLfbId, f.localClub, f.localTeam, f.localNombre, byNombre);
      const idV = matchEquipo(byLfbId, f.visitClub, f.visitTeam, f.visitNombre, byNombre);
      if (idL !== c.id_equipo_local || idV !== c.id_equipo_visitante) return false;
      return Math.abs(new Date(f.fechaIso).getTime() - cFecha) < 4*3600*1000;
    });
    if (!fix) { if (rep.sin_match_fix.length < 10) rep.sin_match_fix.push(c.id); continue; }

    const html = await fetchHtml(fix.url);
    if (!html) { rep.errores.push(`${fix.url}:no_html`); continue; }
    const detail = parsePartidoDetail(html);

    const upd: any = {};
    if (detail.resultado_local != null && detail.resultado_local !== c.resultado_local) upd.resultado_local = detail.resultado_local;
    if (detail.resultado_visitante != null && detail.resultado_visitante !== c.resultado_visitante) upd.resultado_visitante = detail.resultado_visitante;
    const es_live = /vivo|cuarto|descanso/i.test(detail.estado);
    if (c.es_live !== es_live) upd.es_live = es_live;
    if (!dry && Object.keys(upd).length) { await sb.from("partidos").update(upd).eq("id", c.id); rep.actualizados++; }

    if (detail.box.length > 0) {
      const filas: any[] = [];
      for (const b of detail.box) {
        const [apell, nomb] = b.nombre.split(",").map(s => s.trim());
        const n1 = norm(`${nomb || ""} ${apell || ""}`.trim());
        const n2 = norm(b.nombre);
        const id_jugadora = nameMap.get(n1) || nameMap.get(n2);
        if (!id_jugadora) { if (rep.sin_mapear_jug.length < 20) rep.sin_mapear_jug.push(b.nombre); continue; }
        const id_equipo = b.teamIdx === 0 ? c.id_equipo_local : c.id_equipo_visitante;
        filas.push({
          id_partido: c.id, id_jugadora, id_equipo, nombre: b.nombre, dorsal: b.dorsal,
          puntos: b.ptos, reb_totales: b.reb, asistencias: b.ast, faltas: b.fal, valoracion: b.val,
          tc_anotados: 0, tc_intentados: 0, t3_anotados: 0, t3_intentados: 0, tl_anotados: 0, tl_intentados: 0,
          reb_ofensivos: 0, reb_defensivos: 0, robos: 0, tapones: 0, perdidas: 0, minutos: "0", titular: false,
        });
      }
      if (!dry && filas.length > 0) {
        const { error } = await sb.from("partido_boxscore").upsert(filas, { onConflict: "id_partido,id_jugadora" });
        if (error) rep.errores.push(`box ${c.id}: ${error.message}`);
        else rep.boxscore_insertados += filas.length;
      }
    }
  }
  return rep;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jr = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  let body: any = {}; try { body = await req.json(); } catch {}
  const parsed = Params.safeParse(body);
  if (!parsed.success) return jr({ ok: false, error: "Params invalidos", detalles: parsed.error.issues }, 400);
  const { modo, dias_atras, dias_adelante, limit_detail, dry } = parsed.data;

  const out: any = { modo, dry };
  if (modo === "schedule" || modo === "both") out.schedule = await doSchedule(dias_atras, dias_adelante, dry);
  if (modo === "live" || modo === "both") out.live = await doLive(limit_detail, dry);
  return jr({ ok: true, ...out });
});
