#!/usr/bin/env node
// scrape-wnbl-boxscores.mjs
// Scraper WNBL (L029) via Sofascore API JSON desde dentro de Playwright
// (asi Cloudflare lo acepta como same-origin del browser real).
//
// Flujo:
//   1. BD: partidos L029 ultimos 10d con resultado pero sin boxscore.
//   2. Playwright chromium: goto sofascore.com → establece cookies CF.
//   3. page.evaluate(fetch api.sofascore.com/.../events) → mapea team+fecha → eventId.
//   4. Para cada partido: fetch /event/{id} (periodScores) + /event/{id}/lineups (stats).
//   5. UPSERT partido_boxscore + UPDATE parciales + sofascore_event_id.

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) { console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const WNBL_TOURNAMENT_ID = 1506;
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
    .select("id,id_equipo_local,id_equipo_visitante,fecha_hora,resultado_local,resultado_visitante,sofascore_event_id,temporada,id_liga,eq_local:equipos!partidos_id_equipo_local_fkey(nombre),eq_visit:equipos!partidos_id_equipo_visitante_fkey(nombre)")
    .eq("id_liga", "L029").gte("fecha_hora", desde).not("resultado_local", "is", null).order("fecha_hora", { ascending: false });
  if (!partidos?.length) return [];
  const ids = partidos.map(p => p.id);
  const { data: boxes } = await sb.from("partido_boxscore").select("id_partido").in("id_partido", ids);
  const conBox = new Set((boxes || []).map(b => b.id_partido));
  return partidos.filter(p => !conBox.has(p.id));
}

// Usa ctx.request (server-side con cookies del context, sin CORS).
async function fetchInBrowser(ctx, url) {
  const r = await ctx.request.get(url, { headers: { accept: "application/json" } });
  if (!r.ok()) return { __err: `HTTP ${r.status()}` };
  try { return await r.json(); } catch (e) { return { __err: `parse ${e.message}` }; }
}

async function obtenerEventosLiga(ctx) {
  const seas = await fetchInBrowser(ctx, `https://api.sofascore.com/api/v1/unique-tournament/${WNBL_TOURNAMENT_ID}/seasons`);
  if (seas?.__err || !seas?.seasons?.length) { console.log("err seasons:", seas); return []; }
  const seasonId = seas.seasons[0].id;
  console.log(`  seasonId=${seasonId} (${seas.seasons[0].name})`);
  const todos = [];
  for (const tipo of ["last", "next"]) {
    for (let pageNum = 0; pageNum < 5; pageNum++) {
      const url = `https://api.sofascore.com/api/v1/unique-tournament/${WNBL_TOURNAMENT_ID}/season/${seasonId}/events/${tipo}/${pageNum}`;
      const r = await fetchInBrowser(ctx, url);
      if (r?.__err || !r?.events?.length) break;
      todos.push(...r.events);
      if (!r.hasNextPage) break;
      await WAIT(300);
    }
  }
  console.log(`  eventos listados: ${todos.length}`);
  return todos;
}

function matchEvento(eventos, partido) {
  const lN = norm(partido.eq_local.nombre);
  const vN = norm(partido.eq_visit.nombre);
  const pDate = new Date(partido.fecha_hora).getTime();
  for (const e of eventos) {
    const h = norm(e.homeTeam?.name || "");
    const a = norm(e.awayTeam?.name || "");
    if (!h || !a) continue;
    const matchHome = h.includes(lN) || lN.includes(h) || h.split(" ").some(w => lN.includes(w) && w.length > 3);
    const matchAway = a.includes(vN) || vN.includes(a) || a.split(" ").some(w => vN.includes(w) && w.length > 3);
    if (matchHome && matchAway) {
      const ts = (e.startTimestamp || 0) * 1000;
      if (Math.abs(ts - pDate) < 48 * 3600 * 1000) return e;
    }
  }
  return null;
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

function segsAMinutos(s) {
  if (!s) return null;
  const m = Math.floor(s / 60); const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

async function scrapePartido(ctx, p) {
  const ev = await fetchInBrowser(ctx, `https://api.sofascore.com/api/v1/event/${p.sofascore_event_id}`);
  if (ev?.__err) return { ok: false, motivo: `event ${ev.__err}` };
  const periodScores = (() => {
    const h = ev?.event?.homeScore, a = ev?.event?.awayScore;
    if (!h || !a) return null;
    const periods = ["period1", "period2", "period3", "period4"];
    const local = periods.map(k => h[k]).filter(x => typeof x === "number");
    const visit = periods.map(k => a[k]).filter(x => typeof x === "number");
    if (local.length < 4 || visit.length < 4) return null;
    return { local, visitante: visit };
  })();
  const lu = await fetchInBrowser(ctx, `https://api.sofascore.com/api/v1/event/${p.sofascore_event_id}/lineups`);
  if (lu?.__err) return { ok: false, motivo: `lineups ${lu.__err}` };
  const box = [];
  for (const lado of ["home", "away"]) {
    const equipo = lu?.[lado];
    if (!equipo?.players) continue;
    for (const pl of equipo.players) {
      const st = pl.statistics || {};
      box.push({
        lado,
        nombre: pl.player?.name || "",
        shortName: pl.player?.shortName || "",
        titular: pl.substitute === false,
        secondsPlayed: st.secondsPlayed || 0,
        puntos: st.points || 0,
        tc_m: st.fieldGoalsMade || 0, tc_a: st.fieldGoalAttempts || 0,
        t3_m: st.threePointsMade || 0, t3_a: st.threePointAttempts || 0,
        tl_m: st.freeThrowsMade || 0, tl_a: st.freeThrowAttempts || 0,
        reb_o: st.offensiveRebounds || 0, reb_d: st.defensiveRebounds || 0,
        reb_t: st.rebounds || ((st.offensiveRebounds || 0) + (st.defensiveRebounds || 0)),
        ast: st.assists || 0, stl: st.steals || 0, blk: st.blocks || 0,
        tov: st.turnovers || 0, pf: st.personalFouls || 0,
      });
    }
  }
  return { ok: true, periodScores, box };
}

async function main() {
  const partidos = await listarPendientes();
  console.log(`Partidos L029 pendientes de boxscore (ultimos 10d): ${partidos.length}`);
  if (!partidos.length) return;

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 }, locale: "en-US",
  });
  const page = await ctx.newPage();
  await page.goto("https://www.sofascore.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await WAIT(5000);

  const eventos = await obtenerEventosLiga(ctx);
  if (!eventos.length) { console.log("Sin eventos de la liga, abortando."); await browser.close(); return; }

  for (const p of partidos) {
    if (p.sofascore_event_id) continue;
    const ev = matchEvento(eventos, p);
    if (!ev) { console.log(`  NO MATCH ${p.eq_local.nombre} vs ${p.eq_visit.nombre} (${p.fecha_hora})`); continue; }
    p.sofascore_event_id = ev.id;
    await sb.from("partidos").update({ sofascore_event_id: ev.id }).eq("id", p.id);
    console.log(`  mapped id=${p.id} ${p.eq_local.nombre} vs ${p.eq_visit.nombre} -> ${ev.id}`);
  }

  const rep = { intentados: 0, upserted: 0, sin_event: 0, sin_match_jug: [], errores: [] };
  let huecosJug = null; let huecosIdx = 0;

  for (const p of partidos) {
    if (!p.sofascore_event_id) { rep.sin_event++; continue; }
    rep.intentados++;
    const r = await scrapePartido(ctx, p);
    if (!r.ok) { rep.errores.push({ id: p.id, motivo: r.motivo }); continue; }
    console.log(`id=${p.id} event=${p.sofascore_event_id}: ${r.box.length} jugadoras, parciales=${!!r.periodScores}`);

    const { idxLocal, idxVisit } = await cargarRosterEquipos(p.id_equipo_local, p.id_equipo_visitante, p.temporada, p.id_liga);
    const filas = [];
    for (const b of r.box) {
      const idx = b.lado === "home" ? idxLocal : idxVisit;
      const id_equipo_base = b.lado === "home" ? p.id_equipo_local : p.id_equipo_visitante;
      let id_jug = mapearJug(idx, b.nombre) || mapearJug(idx, b.shortName);
      if (!id_jug) {
        if (!huecosJug) huecosJug = await cargarHuecosJug();
        if (huecosIdx < huecosJug.length) {
          const nuevoId = `J${huecosJug[huecosIdx++]}`;
          const { error } = await sb.from("jugadoras").insert({ id_jugadora: nuevoId, nombre: b.nombre });
          if (!error) {
            id_jug = nuevoId;
            await sb.from("temporadas").insert({ id_jugadora: nuevoId, id_equipo: id_equipo_base, id_liga: p.id_liga, temporada: p.temporada });
          }
        }
        if (!id_jug) { rep.sin_match_jug.push(b.nombre); continue; }
      }
      filas.push({
        id_partido: p.id, id_jugadora: id_jug, id_equipo: id_equipo_base,
        nombre: b.nombre, dorsal: null, titular: b.titular,
        minutos: segsAMinutos(b.secondsPlayed),
        puntos: b.puntos,
        tc_anotados: b.tc_m, tc_intentados: b.tc_a,
        t3_anotados: b.t3_m, t3_intentados: b.t3_a,
        tl_anotados: b.tl_m, tl_intentados: b.tl_a,
        reb_ofensivos: b.reb_o, reb_defensivos: b.reb_d, reb_totales: b.reb_t,
        asistencias: b.ast, robos: b.stl, tapones: b.blk,
        perdidas: b.tov, faltas: b.pf,
        valoracion: 0,
      });
    }
    if (filas.length > 0) {
      await sb.from("partido_boxscore").delete().eq("id_partido", p.id);
      const { error } = await sb.from("partido_boxscore").insert(filas);
      if (error) { rep.errores.push({ id: p.id, insert: error.message }); continue; }
      rep.upserted += filas.length;
    }
    if (r.periodScores) await sb.from("partidos").update({ parciales: r.periodScores }).eq("id", p.id);
  }
  console.log("Reporte:", JSON.stringify(rep, null, 2));
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
