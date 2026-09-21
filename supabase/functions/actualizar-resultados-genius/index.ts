// actualizar-resultados-genius v1
// Live tracking para ligas que se sirven vía Genius Sports SDK
// (fibalivestats.dcd.shared.geniussports.com). Ligas se marcan con
// ligas.fuente_live='genius'. Los partidos deben tener id_ext = gameId.
//
// Modo cron (sin body): busca todas las ligas Genius con partidos en
// ventana ±4h o es_live=true → refresca todos.
// Modo manual: POST {id_partido} → refresca solo ese partido.
//
// Al detectar fin de partido, carga el boxscore desde tm.1.pl/tm.2.pl
// haciendo delete-all + insert-all en partido_boxscore.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

interface GeniusPlayer {
  firstName?: string; familyName?: string; shirtNumber?: string | number;
  starter?: number; active?: number;
  sMinutes?: string; sPoints?: number;
  sFieldGoalsMade?: number; sFieldGoalsAttempted?: number;
  sThreePointersMade?: number; sThreePointersAttempted?: number;
  sFreeThrowsMade?: number; sFreeThrowsAttempted?: number;
  sReboundsOffensive?: number; sReboundsDefensive?: number; sReboundsTotal?: number;
  sAssists?: number; sSteals?: number; sBlocks?: number;
  sTurnovers?: number; sFoulsPersonal?: number; sFoulsOn?: number;
  sBlocksReceived?: number;
}
interface GeniusTeam {
  name?: string; code?: string; score?: number;
  p1_score?: number; p2_score?: number; p3_score?: number; p4_score?: number;
  pl?: Record<string, GeniusPlayer> | GeniusPlayer[];
}
interface GeniusData {
  clock?: string; period?: number; periodLength?: number;
  periodType?: string; inOT?: number;
  tm?: { "1"?: GeniusTeam; "2"?: GeniusTeam };
}

async function fetchGeniusData(gameId: string): Promise<GeniusData | null> {
  const url = `https://fibalivestats.dcd.shared.geniussports.com/data/${gameId}/data.json?_cb=${Date.now()}`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { await r.body?.cancel(); return null; }
    return await r.json();
  } catch { return null; }
}

function partidoTerminado(d: GeniusData): boolean {
  const clock = (d.clock || "").trim();
  const period = d.period || 0;
  const inOT = d.inOT || 0;
  const scA = d.tm?.["1"]?.score, scB = d.tm?.["2"]?.score;
  if (scA == null || scB == null) return false;
  if (clock !== "00:00" && clock !== "0:00" && clock !== "") return false;
  if (inOT === 0 && period >= 4) return true;
  if (inOT > 0 && period >= 4 + inOT) return true;
  return false;
}

function playersArray(pl: GeniusTeam["pl"]): GeniusPlayer[] {
  if (!pl) return [];
  if (Array.isArray(pl)) return pl;
  return Object.values(pl);
}

function calcValoracion(p: GeniusPlayer): number {
  const pts = p.sPoints || 0;
  const reb = p.sReboundsTotal || 0;
  const ast = p.sAssists || 0;
  const stl = p.sSteals || 0;
  const blk = p.sBlocks || 0;
  const fOn = p.sFoulsOn || 0;
  const fpm = (p.sFieldGoalsAttempted || 0) - (p.sFieldGoalsMade || 0);
  const tlm = (p.sFreeThrowsAttempted || 0) - (p.sFreeThrowsMade || 0);
  const tov = p.sTurnovers || 0;
  const brc = p.sBlocksReceived || 0;
  const fpc = p.sFoulsPersonal || 0;
  return (pts + reb + ast + stl + blk + fOn) - (fpm + tlm + tov + brc + fpc);
}

// Roster indexado por variantes de nombre. Match por (en orden):
//   1) nombre completo exacto ("katrine horneman lassen")
//   2) apellido único ("lassen" → Katrine Horneman Lassen)
//   3) apellido + inicial del nombre ("k lassen")
function indexarRoster(rows: Array<{id_jugadora: string; nombre: string; id_equipo: string}>) {
  const byFull = new Map<string, string>();
  const bySurname = new Map<string, Set<string>>(); // apellido → {id_jugadoraA, id_jugadoraB}
  const byInitialSurname = new Map<string, string>(); // "k lassen" → id
  for (const r of rows) {
    const partes = norm(r.nombre).split(" ").filter(Boolean);
    if (partes.length === 0) continue;
    byFull.set(partes.join(" "), r.id_jugadora);
    // Apellido = última palabra
    const apellido = partes[partes.length - 1];
    if (!bySurname.has(apellido)) bySurname.set(apellido, new Set());
    bySurname.get(apellido)!.add(r.id_jugadora);
    // Inicial + apellido
    const inicial = partes[0].charAt(0);
    if (inicial) byInitialSurname.set(`${inicial} ${apellido}`, r.id_jugadora);
  }
  return { byFull, bySurname, byInitialSurname };
}

function mapearJugadora(
  idx: ReturnType<typeof indexarRoster>, p: GeniusPlayer
): string | null {
  const fname = norm(p.firstName || "");
  const lname = norm(p.familyName || "");
  if (!fname && !lname) return null;
  const full = `${fname} ${lname}`.trim();
  if (idx.byFull.has(full)) return idx.byFull.get(full)!;
  // Apellido único
  const cand = idx.bySurname.get(lname);
  if (cand && cand.size === 1) return [...cand][0];
  // Inicial del nombre + apellido
  const inicial = fname.charAt(0);
  if (inicial) {
    const key = `${inicial} ${lname}`;
    if (idx.byInitialSurname.has(key)) return idx.byInitialSurname.get(key)!;
  }
  return null;
}

async function cargarBoxscore(
  idPartido: number, d: GeniusData, idLocal: string, idVisit: string,
  idLiga: string, temporada: string
): Promise<{filas: number; sin_mapear: number}> {
  const { data: temps } = await sb.from("temporadas")
    .select("id_jugadora, id_equipo, jugadoras(nombre)")
    .eq("id_liga", idLiga).eq("temporada", temporada)
    .in("id_equipo", [idLocal, idVisit]);
  const rowsLocal: Array<{id_jugadora: string; nombre: string; id_equipo: string}> = [];
  const rowsVisit: Array<{id_jugadora: string; nombre: string; id_equipo: string}> = [];
  for (const t of temps || []) {
    const nombre = (t.jugadoras as any)?.nombre || "";
    if (!nombre) continue;
    const target = t.id_equipo === idLocal ? rowsLocal : rowsVisit;
    target.push({ id_jugadora: t.id_jugadora, nombre, id_equipo: t.id_equipo });
  }
  const idxLocal = indexarRoster(rowsLocal);
  const idxVisit = indexarRoster(rowsVisit);

  const filas: any[] = [];
  let sinMapear = 0;
  const push = (players: GeniusPlayer[], idEquipo: string, idx: ReturnType<typeof indexarRoster>) => {
    for (const p of players) {
      if (!p.firstName && !p.familyName) continue;
      const idJug = mapearJugadora(idx, p);
      if (!idJug) sinMapear++;
      filas.push({
        id_partido: idPartido,
        id_jugadora: idJug,
        id_equipo: idEquipo,
        nombre: `${p.firstName || ""} ${p.familyName || ""}`.trim(),
        dorsal: p.shirtNumber != null ? Number(p.shirtNumber) : null,
        titular: p.starter === 1,
        minutos: p.sMinutes || null,
        puntos: p.sPoints || 0,
        tc_anotados: p.sFieldGoalsMade || 0,
        tc_intentados: p.sFieldGoalsAttempted || 0,
        t3_anotados: p.sThreePointersMade || 0,
        t3_intentados: p.sThreePointersAttempted || 0,
        tl_anotados: p.sFreeThrowsMade || 0,
        tl_intentados: p.sFreeThrowsAttempted || 0,
        reb_ofensivos: p.sReboundsOffensive || 0,
        reb_defensivos: p.sReboundsDefensive || 0,
        reb_totales: p.sReboundsTotal || 0,
        asistencias: p.sAssists || 0,
        robos: p.sSteals || 0,
        tapones: p.sBlocks || 0,
        perdidas: p.sTurnovers || 0,
        faltas: p.sFoulsPersonal || 0,
        valoracion: calcValoracion(p),
      });
    }
  };
  push(playersArray(d.tm?.["1"]?.pl), idLocal, idxLocal);
  push(playersArray(d.tm?.["2"]?.pl), idVisit, idxVisit);

  if (filas.length === 0) return { filas: 0, sin_mapear: 0 };
  await sb.from("partido_boxscore").delete().eq("id_partido", idPartido);
  const { error } = await sb.from("partido_boxscore").insert(filas);
  if (error) throw new Error(`Insert boxscore: ${error.message}`);
  return { filas: filas.length, sin_mapear: sinMapear };
}

async function procesarPartido(p: any): Promise<any> {
  if (!p.id_ext) return { id: p.id, ok: false, motivo: "sin id_ext" };
  const d = await fetchGeniusData(String(p.id_ext));
  if (!d || !d.tm?.["1"] || !d.tm?.["2"]) return { id: p.id, ok: false, motivo: "sin datos" };

  const scA = d.tm["1"].score, scB = d.tm["2"].score;
  if (scA == null || scB == null) return { id: p.id, ok: false, motivo: "sin marcador" };

  const terminado = partidoTerminado(d);
  const periodo = d.period ?? null;
  const parcLoc = [d.tm["1"].p1_score, d.tm["1"].p2_score, d.tm["1"].p3_score, d.tm["1"].p4_score].filter(x => x != null);
  const parcVis = [d.tm["2"].p1_score, d.tm["2"].p2_score, d.tm["2"].p3_score, d.tm["2"].p4_score].filter(x => x != null);
  const parciales = parcLoc.length && parcVis.length ? { local: parcLoc, visitante: parcVis } : null;

  const upd: any = {
    resultado_local: scA,
    resultado_visitante: scB,
    es_live: !terminado,
    periodo: terminado ? null : periodo,
  };
  if (parciales) upd.parciales = parciales;
  if (!p.fuente) upd.fuente = "genius";

  await sb.from("partidos").update(upd).eq("id", p.id);

  let boxRes: any = null;
  if (terminado && p.id_equipo_local && p.id_equipo_visitante) {
    const { count: yaHay } = await sb.from("partido_boxscore")
      .select("id_partido", { count: "exact", head: true })
      .eq("id_partido", p.id);
    if ((yaHay ?? 0) === 0) {
      try {
        boxRes = await cargarBoxscore(p.id, d, p.id_equipo_local, p.id_equipo_visitante, p.id_liga, p.temporada);
      } catch (e) { boxRes = { error: String(e) }; }
    }
  }

  return { id: p.id, id_ext: p.id_ext, ok: true, score: `${scA}-${scB}`, periodo, clock: d.clock, terminado, boxscore: boxRes };
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

    if (body.id_partido) {
      const { data: p, error } = await sb.from("partidos")
        .select("id, id_ext, id_liga, temporada, id_equipo_local, id_equipo_visitante, es_live, fuente")
        .eq("id", body.id_partido).maybeSingle();
      if (error || !p) return json({ ok: false, error: "partido no encontrado" }, 404);
      const res = await procesarPartido(p);
      return json({ ok: true, modo: "manual", resultado: res });
    }

    const { data: ligas } = await sb.from("ligas").select("id_liga").eq("fuente_live", "genius");
    if (!ligas || ligas.length === 0) return json({ ok: true, mensaje: "Sin ligas 'genius'" });
    const idLigas = ligas.map(l => l.id_liga);

    const ahora = new Date();
    const desde = new Date(ahora.getTime() - 30 * 60 * 1000).toISOString();
    const hasta = new Date(ahora.getTime() + 4 * 60 * 60 * 1000).toISOString();
    const { data: partidos } = await sb.from("partidos")
      .select("id, id_ext, id_liga, temporada, id_equipo_local, id_equipo_visitante, es_live, fuente")
      .in("id_liga", idLigas)
      .not("id_ext", "is", null)
      .or(`es_live.eq.true,and(fecha_hora.gte.${desde},fecha_hora.lte.${hasta})`);

    if (!partidos || partidos.length === 0) return json({ ok: true, mensaje: "Sin partidos activos" });

    const resultados: any[] = [];
    for (const p of partidos.slice(0, 25)) {
      try {
        resultados.push(await procesarPartido(p));
      } catch (e) {
        resultados.push({ id: p.id, ok: false, error: String(e) });
      }
    }
    return json({ ok: true, modo: "cron", procesados: resultados.length, resultados });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
