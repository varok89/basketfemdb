#!/usr/bin/env node
// scrape-wnbl-boxscores.mjs
// Carga boxscore + parciales WNBL (L029) desde el endpoint publico de
// schedule.nbl.com.au/api/calendar/match. Un simple fetch JSON: sin
// Playwright, sin Sofascore, sin Cloudflare. Usa partidos.id_ext como
// match UUID.

import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) { console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const WAIT = (ms) => new Promise(r => setTimeout(r, ms));
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function indexarRoster(rows) {
  const byFull = new Map(), bySurname = new Map(), byInitialSurname = new Map();
  for (const r of rows) {
    const partes = norm(r.nombre).split(" ").filter(Boolean);
    if (!partes.length) continue;
    byFull.set(partes.join(" "), r.id_jugadora);
    const apellido = partes[partes.length - 1];
    if (!bySurname.has(apellido)) bySurname.set(apellido, new Set());
    bySurname.get(apellido).add(r.id_jugadora);
    const inicial = partes[0].charAt(0);
    if (inicial) byInitialSurname.set(`${inicial} ${apellido}`, r.id_jugadora);
  }
  return { byFull, bySurname, byInitialSurname };
}
function mapearJug(idx, nombreCrudo) {
  const n = norm(nombreCrudo);
  if (!n) return null;
  if (idx.byFull.has(n)) return idx.byFull.get(n);
  const partes = n.split(" ").filter(Boolean);
  const apellido = partes[partes.length - 1];
  const cand = idx.bySurname.get(apellido);
  if (cand && cand.size === 1) return [...cand][0];
  const inicial = partes[0].charAt(0);
  if (inicial) {
    const k = `${inicial} ${apellido}`;
    if (idx.byInitialSurname.has(k)) return idx.byInitialSurname.get(k);
  }
  return null;
}

async function listarPendientes() {
  const desde = new Date(Date.now() - 10 * 86400 * 1000).toISOString();
  const { data: partidos } = await sb.from("partidos")
    .select("id,id_ext,id_equipo_local,id_equipo_visitante,fecha_hora,resultado_local,resultado_visitante,temporada,id_liga")
    .eq("id_liga", "L029").gte("fecha_hora", desde).not("resultado_local", "is", null).not("id_ext", "is", null).order("fecha_hora", { ascending: false });
  if (!partidos?.length) return [];
  const ids = partidos.map(p => p.id);
  const { data: boxes } = await sb.from("partido_boxscore").select("id_partido").in("id_partido", ids);
  const conBox = new Set((boxes || []).map(b => b.id_partido));
  return partidos.filter(p => !conBox.has(p.id));
}

async function fetchMatch(matchUuid) {
  const url = `https://schedule.nbl.com.au/api/calendar/match?match=${encodeURIComponent(matchUuid)}&league=wnbl`;
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) return { __err: `HTTP ${r.status}` };
  try { return await r.json(); } catch (e) { return { __err: `parse ${e.message}` }; }
}

async function cargarRosterEquipos(idLocal, idVisit, temporada, idLiga) {
  const { data: temps } = await sb.from("temporadas")
    .select("id_jugadora,id_equipo,jugadoras(nombre)")
    .eq("id_liga", idLiga).eq("temporada", temporada).in("id_equipo", [idLocal, idVisit]);
  const rowsL = [], rowsV = [];
  for (const t of temps || []) {
    const nombre = t.jugadoras?.nombre || "";
    if (!nombre) continue;
    (t.id_equipo === idLocal ? rowsL : rowsV).push({ id_jugadora: t.id_jugadora, nombre });
  }
  return { idxLocal: indexarRoster(rowsL), idxVisit: indexarRoster(rowsV) };
}

async function cargarHuecosJug() {
  const all = new Set();
  for (let off = 0; off < 25; off++) {
    const { data } = await sb.from("jugadoras").select("id_jugadora").order("id_jugadora", { ascending: true }).range(off * 1000, off * 1000 + 999);
    if (!data?.length) break;
    for (const r of data) { const n = parseInt(r.id_jugadora.slice(1), 10); if (!isNaN(n)) all.add(n); }
    if (data.length < 1000) break;
  }
  const max = all.size ? Math.max(...all) : 0;
  const huecos = [];
  for (let i = 1; i <= max + 200; i++) { if (!all.has(i)) huecos.push(i); if (huecos.length >= 200) break; }
  return huecos;
}

// Mapea un match API payload a {parciales, box[]}.
// period "0" o period_type regular + period "0" = agregado del partido.
// period "1".."4" (regulares) + "5"+ (OT) = parciales.
function parsearPayload(payload, idLocal, idVisit, extLocal, extVisit) {
  const m = payload?.match;
  if (!m) return { __err: "sin match en payload" };
  const pms = Array.isArray(m.player_match_statistics) ? m.player_match_statistics : [];
  const tms = Array.isArray(m.team_match_statistics) ? m.team_match_statistics : [];

  // Resolver external_id de cada team en payload
  const extByTeam = {};
  for (const t of tms) {
    const tid = t.team?.id || t.team;
    const tex = t.team?.external_id;
    if (tid && tex) extByTeam[tid] = tex;
  }
  // Mapear external_id → id_equipo BD
  function teamLocalId(payloadTeamId) {
    const ext = extByTeam[payloadTeamId];
    if (ext && ext === extLocal) return idLocal;
    if (ext && ext === extVisit) return idVisit;
    return null;
  }

  // Parciales: team_match_statistics con period "1","2","3","4" (regular)
  const parcialesLocal = [0, 0, 0, 0], parcialesVisit = [0, 0, 0, 0];
  const otLocal = [], otVisit = [];
  for (const t of tms) {
    const per = parseInt(t.period, 10);
    if (isNaN(per) || per === 0) continue;
    const tid = t.team?.id || t.team;
    const esLocal = teamLocalId(tid) === idLocal;
    const pts = t.points || 0;
    if (per >= 1 && per <= 4) {
      if (esLocal) parcialesLocal[per - 1] = pts; else parcialesVisit[per - 1] = pts;
    } else if (per >= 5) {
      if (esLocal) otLocal.push(pts); else otVisit.push(pts);
    }
  }
  const parciales = (parcialesLocal.some(x => x > 0) || parcialesVisit.some(x => x > 0))
    ? { local: parcialesLocal.concat(otLocal), visitante: parcialesVisit.concat(otVisit) }
    : null;

  // Boxscore: player_match_statistics con period "0" (agregado partido)
  const box = [];
  for (const p of pms) {
    if (String(p.period) !== "0") continue;
    if (p.participated === false) continue;
    const tid = p.team?.id || p.team;
    const id_equipo_base = teamLocalId(tid);
    if (!id_equipo_base) continue;
    const first = p.player?.first_name || "";
    const last = p.player?.last_name || p.player?.family_name || "";
    const nombre = p.player?.name || `${first} ${last}`.trim();
    box.push({
      id_equipo_base,
      lado: id_equipo_base === idLocal ? "home" : "away",
      nombre,
      dorsal: p.jersey_number || null,
      titular: !!p.starter,
      minutos: p.minutes || null,
      puntos: p.points || 0,
      tc_m: p.field_goals_made || 0, tc_a: p.field_goals_attempted || 0,
      t3_m: p.three_points_made || 0, t3_a: p.three_points_attempted || 0,
      tl_m: p.free_throws_made || 0, tl_a: p.free_throws_attempted || 0,
      reb_o: p.offensive_rebounds || 0, reb_d: p.defensive_rebounds || 0,
      reb_t: p.rebounds || 0,
      ast: p.assists || 0, stl: p.steals || 0, blk: p.blocks || 0,
      tov: p.turnovers || 0,
      pf: p.personal_fouls || 0,
      valoracion: p.efficiency || 0,
    });
  }
  return { parciales, box };
}

async function obtenerExtEquipo(id_equipo) {
  const { data } = await sb.from("equipos").select("codigo").eq("id_equipo", id_equipo).maybeSingle();
  return data?.codigo || null;
}

async function main() {
  const partidos = await listarPendientes();
  console.log(`Partidos L029 pendientes de boxscore (ultimos 10d): ${partidos.length}`);
  if (!partidos.length) return;

  const rep = { intentados: 0, upserted: 0, errores: [], sin_match_jug: [] };
  let huecosJug = null; let huecosIdx = 0;

  // Cache external_id por id_equipo
  const extCache = new Map();
  async function extDe(id_equipo) {
    if (extCache.has(id_equipo)) return extCache.get(id_equipo);
    // Preferir join via temporadas → jugadoras no sirve; usamos equipos table
    const { data } = await sb.from("equipos").select("codigo,id_equipo").eq("id_equipo", id_equipo).maybeSingle();
    // No tenemos external_id en equipos. Lo cogemos del propio payload siempre.
    extCache.set(id_equipo, data?.codigo || null);
    return extCache.get(id_equipo);
  }

  for (const p of partidos) {
    rep.intentados++;
    const payload = await fetchMatch(p.id_ext);
    if (payload?.__err) { rep.errores.push({ id: p.id, motivo: payload.__err }); continue; }
    // external_id de teams en payload
    const extLocal = payload?.match?.home_team?.external_id;
    const extVisit = payload?.match?.away_team?.external_id;
    const r = parsearPayload(payload, p.id_equipo_local, p.id_equipo_visitante, extLocal, extVisit);
    if (r?.__err) { rep.errores.push({ id: p.id, motivo: r.__err }); continue; }
    console.log(`id=${p.id} match=${p.id_ext}: ${r.box.length} jugadoras, parciales=${!!r.parciales}`);

    const { idxLocal, idxVisit } = await cargarRosterEquipos(p.id_equipo_local, p.id_equipo_visitante, p.temporada, p.id_liga);
    const filas = [];
    for (const b of r.box) {
      const idx = b.lado === "home" ? idxLocal : idxVisit;
      let id_jug = mapearJug(idx, b.nombre);
      if (!id_jug) {
        if (!huecosJug) huecosJug = await cargarHuecosJug();
        if (huecosIdx < huecosJug.length) {
          const nuevoId = `J${huecosJug[huecosIdx++]}`;
          const { error } = await sb.from("jugadoras").insert({ id_jugadora: nuevoId, nombre: b.nombre });
          if (!error) {
            id_jug = nuevoId;
            await sb.from("temporadas").insert({ id_jugadora: nuevoId, id_equipo: b.id_equipo_base, id_liga: p.id_liga, temporada: p.temporada });
          }
        }
        if (!id_jug) { rep.sin_match_jug.push(b.nombre); continue; }
      }
      filas.push({
        id_partido: p.id, id_jugadora: id_jug, id_equipo: b.id_equipo_base,
        nombre: b.nombre, dorsal: b.dorsal, titular: b.titular,
        minutos: b.minutos,
        puntos: b.puntos,
        tc_anotados: b.tc_m, tc_intentados: b.tc_a,
        t3_anotados: b.t3_m, t3_intentados: b.t3_a,
        tl_anotados: b.tl_m, tl_intentados: b.tl_a,
        reb_ofensivos: b.reb_o, reb_defensivos: b.reb_d, reb_totales: b.reb_t,
        asistencias: b.ast, robos: b.stl, tapones: b.blk,
        perdidas: b.tov, faltas: b.pf,
        valoracion: b.valoracion,
      });
    }
    if (filas.length > 0) {
      await sb.from("partido_boxscore").delete().eq("id_partido", p.id);
      const { error } = await sb.from("partido_boxscore").insert(filas);
      if (error) { rep.errores.push({ id: p.id, insert: error.message }); continue; }
      rep.upserted += filas.length;
    }
    if (r.parciales) await sb.from("partidos").update({ parciales: r.parciales }).eq("id", p.id);
    await WAIT(250);
  }
  console.log("Reporte:", JSON.stringify(rep, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
