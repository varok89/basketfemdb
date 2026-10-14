// cargar-live-dbbl v1
// Live tracking + boxscore para 1. DBBL (Damen Basketball Bundesliga, Alemania, L026).
// Fuente: AJAX público toyota-dbbl.de/wp/wp-admin/admin-ajax.php action=fetch_detail_game_stats
//
// Modo cron (sin body): partidos L026 en ventana [-30min, +4h] o es_live → refresca.
// Modo manual: POST {id_partido} o {id_partido, force:true} → refresca ese partido.
//
// Datos:
//   stats.status: OFFICIAL (terminado) | LIVE | SCHEDULED | ...
//   stats.result.homeTeamFinalScore + Q1-4 + OT1-9 → marcador y parciales.
//   stats.result.latestPeriod: "Q1".."Q4" | "OT1".. → periodo actual.
//   homeTeamPlayer[] + guestTeamPlayer[]: strings HTML con <td>s por jugadora.
//     Columnas: [Nombre+Dorsal], MIN, PTS, REB, ASS, ST, 2PM, 2PA, 2P%, 3PM, 3PA,
//               3P%, FGM, FGA, FG%, FTM, FTA, FT%, DR, OR, BS, TO, PF, EF, +/-.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const ID_LIGA = "L026";
const AJAX_URL = "https://toyota-dbbl.de/wp/wp-admin/admin-ajax.php";
const LEAGUE_NAME = "1. DBBL";

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function normalizarNombre(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  return s.toLowerCase().split(/(\s+)/).map((w) =>
    w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w
  ).join("");
}

async function cargarHuecosJug(): Promise<number[]> {
  const all = new Set<number>();
  for (let off = 0; off < 20; off++) {
    const { data } = await sb.from("jugadoras").select("id_jugadora")
      .order("id_jugadora", { ascending: true }).range(off * 1000, off * 1000 + 999);
    if (!data || !data.length) break;
    for (const r of data) { const n = parseInt(r.id_jugadora.slice(1), 10); if (!isNaN(n)) all.add(n); }
    if (data.length < 1000) break;
  }
  const max = all.size ? Math.max(...all) : 0;
  const huecos: number[] = [];
  for (let i = 1; i <= max + 200; i++) { if (!all.has(i)) huecos.push(i); if (huecos.length >= 200) break; }
  return huecos;
}

function indexarRoster(rows: Array<{id_jugadora: string; nombre: string; id_equipo: string}>) {
  const byFull = new Map<string, string>();
  const bySurname = new Map<string, Set<string>>();
  const byInitialSurname = new Map<string, string>();
  const porNombre = new Map<string, Array<{id: string; tokens: Set<string>}>>();
  for (const r of rows) {
    const partes = norm(r.nombre).split(" ").filter(Boolean);
    if (partes.length === 0) continue;
    byFull.set(partes.join(" "), r.id_jugadora);
    const apellido = partes[partes.length - 1];
    if (!bySurname.has(apellido)) bySurname.set(apellido, new Set());
    bySurname.get(apellido)!.add(r.id_jugadora);
    const inicial = partes[0].charAt(0);
    if (inicial) byInitialSurname.set(`${inicial} ${apellido}`, r.id_jugadora);
    const primera = partes[0];
    if (!porNombre.has(primera)) porNombre.set(primera, []);
    porNombre.get(primera)!.push({ id: r.id_jugadora, tokens: new Set(partes.slice(1)) });
  }
  return { byFull, bySurname, byInitialSurname, porNombre };
}

function mapearJugadora(idx: ReturnType<typeof indexarRoster>, nombreCrudo: string): string | null {
  const n = norm(nombreCrudo);
  if (!n) return null;
  if (idx.byFull.has(n)) return idx.byFull.get(n)!;
  const partes = n.split(" ").filter(Boolean);
  if (partes.length === 0) return null;
  const apellido = partes[partes.length - 1];
  const cand = idx.bySurname.get(apellido);
  if (cand && cand.size === 1) return [...cand][0];
  const inicial = partes[0].charAt(0);
  if (inicial) {
    const key = `${inicial} ${apellido}`;
    if (idx.byInitialSurname.has(key)) return idx.byInitialSurname.get(key)!;
  }
  if (partes.length >= 2) {
    const primera = partes[0];
    const resto = new Set(partes.slice(1));
    const cands = idx.porNombre.get(primera) || [];
    const matches = cands.filter(c => {
      for (const t of resto) if (c.tokens.has(t)) return true;
      return false;
    });
    if (matches.length === 1) return matches[0].id;
  }
  return null;
}

interface PlayerBox {
  dbbl_id: string;
  dorsal: string | null;
  nombre: string;
  min: string | null;
  pts: number; reb: number; ast: number; stl: number;
  fg2m: number; fg2a: number;
  fg3m: number; fg3a: number;
  fgm: number; fga: number;
  ftm: number; fta: number;
  dr: number; or_: number;
  blk: number; tov: number; pf: number;
  ef: number;
}

const toInt = (s: string): number => {
  const t = (s || "").trim(); if (!t || t === "-") return 0;
  const n = parseInt(t, 10); return isNaN(n) ? 0 : n;
};

// Parsea el string HTML de 1 jugadora (serie de <td>s). Devuelve PlayerBox o null.
function parsePlayerRow(html: string): PlayerBox | null {
  const mId = html.match(/\/spielerin\/(\d+)/);
  if (!mId) return null;
  const dbbl_id = mId[1];
  const mDor = html.match(/font-bold text-amber-600\/80[^>]*>\s*([^<\s]*)\s*</);
  const dorsal = mDor ? (mDor[1].trim() || null) : null;
  const mNom = html.match(/text-ellipsis overflow-hidden[^>]*>([^<]+)</);
  if (!mNom) return null;
  const nombre = mNom[1].trim();
  // Capturar contenido de cada <td>. El 1º tiene HTML anidado, pero su regex interno no coincide porque
  // los <td> internos no existen — el primer <td> es a nivel exterior y lleva <a><div>... texto plano.
  const tds = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
  if (tds.length < 24) return null;
  // tds[0] = celda nombre/dorsal (ya parseado arriba). tds[1..] = valores numéricos.
  return {
    dbbl_id, dorsal, nombre,
    min: tds[1]?.trim() || null,
    pts: toInt(tds[2]), reb: toInt(tds[3]), ast: toInt(tds[4]), stl: toInt(tds[5]),
    fg2m: toInt(tds[6]), fg2a: toInt(tds[7]),
    fg3m: toInt(tds[9]), fg3a: toInt(tds[10]),
    fgm: toInt(tds[12]), fga: toInt(tds[13]),
    ftm: toInt(tds[15]), fta: toInt(tds[16]),
    dr: toInt(tds[18]), or_: toInt(tds[19]),
    blk: toInt(tds[20]), tov: toInt(tds[21]), pf: toInt(tds[22]),
    ef: toInt(tds[23]),
  };
}

async function fetchDbbl(action: string, gameId: string): Promise<any | null> {
  try {
    const body = new URLSearchParams({
      action,
      season: "2026",
      league: LEAGUE_NAME,
      post_slug: gameId,
    });
    const r = await fetch(AJAX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
      body,
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.success ? j.data : null;
  } catch { return null; }
}
// fetch_game_stats devuelve stats.result consistentemente (marcador + parciales).
const fetchDbblStats = (gid: string) => fetchDbbl("fetch_game_stats", gid);
// fetch_detail_game_stats devuelve homeTeamPlayer/guestTeamPlayer (boxscore HTML por jugadora).
const fetchDbblDetail = (gid: string) => fetchDbbl("fetch_detail_game_stats", gid);

async function cargarBoxscore(
  idPartido: number, dLocal: PlayerBox[], dVisit: PlayerBox[],
  idLocal: string, idVisit: string, idLiga: string, temporada: string,
): Promise<{filas: number; sin_mapear: number; creadas: number}> {
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
  let creadas = 0;
  let huecosJug: number[] | null = null;
  let huecosIdx = 0;

  const push = async (players: PlayerBox[], idEquipo: string, idx: ReturnType<typeof indexarRoster>) => {
    for (const p of players) {
      if (!p.nombre) continue;
      let idJug = mapearJugadora(idx, p.nombre);
      if (!idJug) {
        if (!huecosJug) huecosJug = await cargarHuecosJug();
        if (huecosIdx < huecosJug.length) {
          const nuevoId = `J${huecosJug[huecosIdx++]}`;
          const nombreNuevo = normalizarNombre(p.nombre);
          const { error } = await sb.from("jugadoras").insert({ id_jugadora: nuevoId, nombre: nombreNuevo });
          if (!error) {
            idJug = nuevoId;
            creadas++;
            await sb.from("temporadas").insert({
              id_jugadora: nuevoId, id_equipo: idEquipo, id_liga: idLiga, temporada,
            });
          }
        }
      }
      if (!idJug) sinMapear++;
      filas.push({
        id_partido: idPartido,
        id_jugadora: idJug,
        id_equipo: idEquipo,
        nombre: p.nombre,
        dorsal: p.dorsal,
        titular: null,
        minutos: p.min,
        puntos: p.pts,
        tc_anotados: p.fgm,
        tc_intentados: p.fga,
        t3_anotados: p.fg3m,
        t3_intentados: p.fg3a,
        tl_anotados: p.ftm,
        tl_intentados: p.fta,
        reb_ofensivos: p.or_,
        reb_defensivos: p.dr,
        reb_totales: p.reb,
        asistencias: p.ast,
        robos: p.stl,
        tapones: p.blk,
        perdidas: p.tov,
        faltas: p.pf,
        valoracion: p.ef,
      });
    }
  };
  await push(dLocal, idLocal, idxLocal);
  await push(dVisit, idVisit, idxVisit);

  if (filas.length === 0) return { filas: 0, sin_mapear: 0, creadas: 0 };
  await sb.from("partido_boxscore").delete().eq("id_partido", idPartido);
  const { error } = await sb.from("partido_boxscore").insert(filas);
  if (error) throw new Error(`Insert boxscore: ${error.message}`);
  return { filas: filas.length, sin_mapear: sinMapear, creadas };
}

function periodoES(latest: string | null, status: string): number | null {
  if (status === "OFFICIAL") return null;
  if (!latest) return null;
  const m = latest.match(/Q(\d)/i); if (m) return parseInt(m[1], 10);
  const mo = latest.match(/OT(\d)/i); if (mo) return 4 + parseInt(mo[1], 10);
  return null;
}

async function procesarPartido(p: any, force = false): Promise<any> {
  if (!p.id_ext) return { id: p.id, ok: false, motivo: "sin id_ext" };
  const [dStats, dDetail] = await Promise.all([
    fetchDbblStats(String(p.id_ext)),
    fetchDbblDetail(String(p.id_ext)),
  ]);
  if (!dStats?.stats) return { id: p.id, ok: false, motivo: "sin datos" };
  const d = dDetail || {};
  const st = dStats.stats;
  const scA = st?.result?.homeTeamFinalScore ?? null;
  const scB = st?.result?.guestTeamFinalScore ?? null;
  const status = st?.status || "";
  const terminado = status === "OFFICIAL";
  const latest = st?.result?.latestPeriod || null;
  const periodo = periodoES(latest, status);
  const esLive = !terminado && (status === "LIVE" || !!(scA || scB));

  const parcLoc: number[] = [];
  const parcVis: number[] = [];
  for (const q of ["Q1","Q2","Q3","Q4"] as const) {
    const l = st?.result?.[`homeTeam${q}Score`];
    const v = st?.result?.[`guestTeam${q}Score`];
    if (l != null) parcLoc.push(l);
    if (v != null) parcVis.push(v);
  }
  for (let i = 1; i <= 9; i++) {
    const l = st?.result?.[`homeTeamOT${i}Score`];
    const v = st?.result?.[`guestTeamOT${i}Score`];
    if (l != null && l !== 0) parcLoc.push(l);
    if (v != null && v !== 0) parcVis.push(v);
  }
  const parciales = parcLoc.length && parcVis.length ? { local: parcLoc, visitante: parcVis } : null;

  const upd: any = {
    resultado_local: scA,
    resultado_visitante: scB,
    es_live: !!esLive,
    periodo: terminado ? null : periodo,
  };
  if (parciales) upd.parciales = parciales;
  if (!p.fuente) upd.fuente = "dbbl";
  await sb.from("partidos").update(upd).eq("id", p.id);

  // Boxscore: live + al finalizar. Si ya hay filas y partido cerrado y !force, se salta.
  let boxRes: any = null;
  if (p.id_equipo_local && p.id_equipo_visitante) {
    let cargar = force || !terminado;
    if (!cargar) {
      const { count: yaHay } = await sb.from("partido_boxscore")
        .select("id_partido", { count: "exact", head: true }).eq("id_partido", p.id);
      cargar = (yaHay ?? 0) === 0;
    }
    if (cargar) {
      try {
        const home = (d.homeTeamPlayer as string[] || []).map(parsePlayerRow).filter(Boolean) as PlayerBox[];
        const away = (d.guestTeamPlayer as string[] || []).map(parsePlayerRow).filter(Boolean) as PlayerBox[];
        if (home.length || away.length) {
          boxRes = await cargarBoxscore(p.id, home, away, p.id_equipo_local, p.id_equipo_visitante, p.id_liga, p.temporada);
        }
      } catch (e) { boxRes = { error: String(e) }; }
    }
  }

  return { id: p.id, id_ext: p.id_ext, ok: true, score: `${scA}-${scB}`, status, periodo, terminado, boxscore: boxRes };
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
      const res = await procesarPartido(p, body.force === true);
      return json({ ok: true, modo: "manual", resultado: res });
    }

    const ahora = new Date();
    const desde = new Date(ahora.getTime() - 30 * 60 * 1000).toISOString();
    const hasta = new Date(ahora.getTime() + 4 * 60 * 60 * 1000).toISOString();
    const { data: partidos } = await sb.from("partidos")
      .select("id, id_ext, id_liga, temporada, id_equipo_local, id_equipo_visitante, es_live, fuente")
      .eq("id_liga", ID_LIGA)
      .not("id_ext", "is", null)
      .or(`es_live.eq.true,and(fecha_hora.gte.${desde},fecha_hora.lte.${hasta})`);

    if (!partidos || partidos.length === 0) return json({ ok: true, mensaje: "Sin partidos activos" });

    const resultados: any[] = [];
    for (const p of partidos.slice(0, 25)) {
      try { resultados.push(await procesarPartido(p)); }
      catch (e) { resultados.push({ id: p.id, ok: false, error: String(e) }); }
    }
    return json({ ok: true, modo: "cron", procesados: resultados.length, resultados });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
