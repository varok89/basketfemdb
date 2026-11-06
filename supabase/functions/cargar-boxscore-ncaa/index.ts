// cargar-boxscore-ncaa v7
// v7: calcular valoracion (ESPN no la trae). Formula sin FR/TAP recibidos:
//     VAL = (PTS+REB+AST+ROB+TAP) - (TC_fall + TL_fall + TO + FP)
// v6: antes de crear jugadora nueva, cruzar displayName contra existentes
//   por apellido + equipo del partido (via temporadas L020). Si hay match
//   unico sin id_espn → UPDATE id_espn en vez de insertar duplicado. Evita
//   que ficha completa (FIBA/FEB/LFB) choque con la auto al editar id_espn.
// v5: insert jugadoras incluye nombre placeholder (NOT NULL). Despues se
//   actualiza con displayName real al parsear roster entries.
// v4: parciales desde header.competitions[0].competitors[*].linescores.
// v3: pagina carga de jugadoras con id_espn.
// v2: auto-crear jugadoras NCAA no mapeadas + parciales desde Site summary.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const UA = { "User-Agent": "Mozilla/5.0" };
const SITE_SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/summary";

const Params = z.object({ id_ext: z.string().regex(/^\d+$/) }).strict();

async function j(url) { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
function getStat(cats, name) { for (const c of (cats||[])) { for (const s of (c.stats||[])) { if (s.name === name) return parseFloat(s.value) || 0; } } return 0; }

async function cargarHuecosJug() {
  const all = new Set<number>();
  for (let off = 0; off < 30; off++) {
    const { data } = await sb.from("jugadoras").select("id_jugadora").order("id_jugadora", { ascending: true }).range(off * 1000, off * 1000 + 999);
    if (!data?.length) break;
    for (const r of data) { const n = parseInt(String(r.id_jugadora).slice(1), 10); if (!isNaN(n)) all.add(n); }
    if (data.length < 1000) break;
  }
  const max = all.size ? Math.max(...all) : 0;
  const huecos: number[] = [];
  for (let i = 1; i <= max + 200; i++) { if (!all.has(i)) huecos.push(i); if (huecos.length >= 200) break; }
  return huecos;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jr = (b, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  let body = {}; try { body = await req.json(); } catch {}
  const parsed = Params.safeParse(body);
  if (!parsed.success) return jr({ ok: false, error: "Params invalidos", detalles: parsed.error.issues }, 400);
  const idExt = parsed.data.id_ext;

  const { data: part } = await sb.from("partidos").select("id,id_liga,id_equipo_local,id_equipo_visitante").eq("id_liga", "L020").eq("id_ext", idExt).maybeSingle();
  if (!part) return jr({ ok: false, error: `Partido ${idExt} no en BD L020` }, 404);

  const rep: any = { id_ext: idExt, id_partido: part.id, upserted: 0, creadas: 0, parciales: null, sin_match: [], errores: [] };

  // 1) Parciales desde header.competitions[0].competitors[*].linescores
  let sum: any = null;
  try { sum = await j(`${SITE_SUMMARY}?event=${idExt}`); } catch (e) { rep.errores.push(`summary: ${e}`); }
  if (sum) {
    try {
      const hdrComps = sum?.header?.competitions?.[0]?.competitors || [];
      let locArr: number[] | null = null, visArr: number[] | null = null;
      for (const c of hdrComps) {
        const ls = (c?.linescores || []).map((l: any) => parseInt(String(l.displayValue ?? l.value)) || 0);
        if (!ls.length) continue;
        if (c.homeAway === "home") locArr = ls;
        else if (c.homeAway === "away") visArr = ls;
      }
      if (locArr && visArr && locArr.length >= 4 && visArr.length >= 4) {
        const parciales = { local: locArr, visitante: visArr };
        await sb.from("partidos").update({ parciales }).eq("id", part.id);
        rep.parciales = parciales;
      }
    } catch (e) { rep.errores.push(`parciales: ${e}`); }
  }

  // 2) Boxscore via Core API competitors + roster
  let compets;
  try { compets = await j(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/womens-college-basketball/events/${idExt}/competitions/${idExt}/competitors`); }
  catch (e) { return jr({ ok:false, error: `ESPN competitors: ${e}` }, 502); }

  const compDatos: any[] = [];
  for (const it of compets.items || []) {
    let comp; try { comp = await j(it.$ref); } catch { continue; }
    const teamBd = comp.homeAway === "home" ? part.id_equipo_local : part.id_equipo_visitante;
    compDatos.push({ comp, teamBd });
  }

  const allPlayerIds = new Set<string>();
  const rosterData: any[] = [];
  for (const { comp, teamBd } of compDatos) {
    const rosterRef = comp.roster?.$ref; if (!rosterRef) continue;
    let roster; try { roster = await j(rosterRef); } catch { continue; }
    const entries = (roster.entries || []).filter((e: any) => !e.didNotPlay && e.playerId);
    for (const e of entries) allPlayerIds.add(String(e.playerId));
    rosterData.push({ teamBd, entries });
  }

  // Pre-fetch existentes por id_espn (chunks de 200)
  const byEspnId = new Map<string, { id_jugadora: string; nombre: string }>();
  const idsArr = [...allPlayerIds];
  for (let i = 0; i < idsArr.length; i += 200) {
    const chunk = idsArr.slice(i, i + 200).map((x) => parseInt(x));
    const { data } = await sb.from("jugadoras").select("id_jugadora,nombre,id_espn").in("id_espn", chunk);
    for (const r of data || []) byEspnId.set(String(r.id_espn), { id_jugadora: r.id_jugadora, nombre: r.nombre });
  }

  // Para construir nuevas, necesitamos displayName del roster
  const nombrePorEspn = new Map<string, string>();
  for (const { entries } of rosterData) {
    for (const e of entries) {
      const pid = String(e.playerId);
      if (e.displayName) nombrePorEspn.set(pid, e.displayName);
    }
  }

  // Mapeo playerId → teamBd (para cruce apellido+equipo)
  const teamPorEspn = new Map<string, string>();
  for (const { teamBd, entries } of rosterData) {
    for (const e of entries) teamPorEspn.set(String(e.playerId), teamBd);
  }

  // v6: cruce por apellido+equipo antes de crear duplicado
  let huecosJug: number[] | null = null, huecosIdx = 0;
  const nuevasJug: any[] = [];
  const matchesPorApellido: any[] = [];
  rep.matcheadas = 0;
  for (const playerId of allPlayerIds) {
    if (byEspnId.has(playerId)) continue;
    const displayName = nombrePorEspn.get(playerId);
    const teamBd = teamPorEspn.get(playerId);
    const apellido = displayName?.replace(/^[A-Z]\.\s+/, "").trim().split(/\s+/).pop();
    if (apellido && apellido.length >= 3 && teamBd) {
      const { data } = await sb.from("jugadoras")
        .select("id_jugadora,nombre,temporadas!inner(id_equipo,id_liga)")
        .is("id_espn", null)
        .ilike("nombre", `% ${apellido}`)
        .eq("temporadas.id_equipo", teamBd)
        .eq("temporadas.id_liga", "L020")
        .limit(2);
      if (data?.length === 1) {
        const unico = data[0];
        matchesPorApellido.push({ id_jugadora: unico.id_jugadora, id_espn: parseInt(playerId) });
        byEspnId.set(playerId, { id_jugadora: unico.id_jugadora, nombre: unico.nombre });
        rep.matcheadas++;
        continue;
      }
    }
    if (!huecosJug) huecosJug = await cargarHuecosJug();
    if (huecosIdx >= huecosJug.length) continue;
    const nuevoId = `J${huecosJug[huecosIdx++]}`;
    const nombre = displayName || `ESPN ${playerId}`;
    nuevasJug.push({ id_jugadora: nuevoId, id_espn: parseInt(playerId), nombre });
    byEspnId.set(playerId, { id_jugadora: nuevoId, nombre });
  }

  // Aplicar matches: UPDATE id_espn en jugadoras existentes
  for (const m of matchesPorApellido) {
    const { error } = await sb.from("jugadoras").update({ id_espn: m.id_espn }).eq("id_jugadora", m.id_jugadora);
    if (error) rep.errores.push(`match id_espn ${m.id_jugadora}: ${error.message}`);
  }

  if (nuevasJug.length > 0) {
    const { error } = await sb.from("jugadoras").insert(nuevasJug);
    if (error) rep.errores.push(`insert jugadoras: ${error.message}`);
    else rep.creadas = nuevasJug.length;
  }

  // Fetch stats y construir filas
  const filas: any[] = [];
  for (const { teamBd, entries } of rosterData) {
    for (const e of entries) {
      const playerId = String(e.playerId);
      const bdJug = byEspnId.get(playerId);
      if (!bdJug) { rep.sin_match.push({ playerId, displayName: e.displayName || "" }); continue; }
      const statsRef = e.statistics?.$ref; if (!statsRef) continue;
      let stats; try { stats = await j(statsRef); } catch { continue; }
      const cats = stats?.splits?.categories || [];
      const pts = getStat(cats,"points"), reb = getStat(cats,"rebounds");
      const ast = getStat(cats,"assists"), rob = getStat(cats,"steals"), tap = getStat(cats,"blocks");
      const tcm = getStat(cats,"fieldGoalsMade"), tci = getStat(cats,"fieldGoalsAttempted");
      const tlm = getStat(cats,"freeThrowsMade"), tli = getStat(cats,"freeThrowsAttempted");
      const to = getStat(cats,"turnovers"), fp = getStat(cats,"fouls");
      const val = (pts+reb+ast+rob+tap) - ((tci-tcm) + (tli-tlm) + to + fp);
      filas.push({
        id_partido: part.id, id_jugadora: bdJug.id_jugadora, id_equipo: teamBd,
        nombre: bdJug.nombre, dorsal: String(e.jersey || ""), titular: !!e.starter,
        minutos: String(getStat(cats,"minutes")), puntos: pts,
        tc_anotados: tcm, tc_intentados: tci,
        t3_anotados: getStat(cats,"threePointFieldGoalsMade"), t3_intentados: getStat(cats,"threePointFieldGoalsAttempted"),
        tl_anotados: tlm, tl_intentados: tli,
        reb_ofensivos: getStat(cats,"offensiveRebounds"), reb_defensivos: getStat(cats,"defensiveRebounds"), reb_totales: reb,
        asistencias: ast, robos: rob, tapones: tap,
        perdidas: to, faltas: fp, valoracion: val,
      });
    }
  }

  if (filas.length > 0) {
    const { error } = await sb.from("partido_boxscore").upsert(filas, { onConflict: "id_partido,id_jugadora" });
    if (error) rep.errores.push(error.message); else rep.upserted = filas.length;
  }
  rep.sin_match = rep.sin_match.slice(0, 20);
  return jr({ ok: true, ...rep });
});
