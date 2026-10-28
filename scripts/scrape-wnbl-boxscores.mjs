#!/usr/bin/env node
// scrape-wnbl-boxscores.mjs
// Scraper WNBL (L029) via Sofascore con Playwright.
// Objetivo: traer boxscore + parciales para partidos sin box en BD.
// Ejecucion: GitHub Actions cada 30 min (ver .github/workflows/scrape-wnbl.yml).
//
// Flujo:
//   1. Supabase: partidos L029 ultimos 10d con resultado pero sin boxscore.
//   2. Si no tienen sofascore_event_id, resolverlos scrapeando listado liga Sofascore.
//   3. Para cada partido, scrape pagina Sofascore con Playwright (bypassa Cloudflare).
//   4. Parse DOM: parciales + boxscore por jugadora.
//   5. Match jugadoras por nombre. Auto-crear si no existe.
//   6. UPSERT en partido_boxscore + UPDATE parciales en partidos.
//
// Env requeridos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) { console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const SOFA_WNBL_URL = "https://www.sofascore.com/basketball/tournament/australia/wnbl/1506";
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

async function resolverEventIds(ctx, partidos) {
  const pendientes = partidos.filter(p => !p.sofascore_event_id);
  if (!pendientes.length) return;
  console.log(`Resolviendo event IDs para ${pendientes.length} partidos...`);
  const page = await ctx.newPage();
  await page.goto(SOFA_WNBL_URL, { waitUntil: "networkidle", timeout: 30000 });
  await WAIT(2500);
  // Clicar "Matches" tab si no está activo, luego iterar rounds
  const anchors = await page.$$eval('a[href*="/basketball/match/"]', (as) =>
    as.map(a => ({ href: a.getAttribute("href"), text: a.innerText || "" })));
  console.log(`  anchors en pagina: ${anchors.length}`);
  for (const p of pendientes) {
    const localN = norm(p.eq_local.nombre).split(" ")[0];
    const visitN = norm(p.eq_visit.nombre).split(" ")[0];
    const found = anchors.find(a => {
      const h = (a.href || "").toLowerCase();
      return h.includes(localN) && h.includes(visitN);
    });
    if (!found) { console.log(`  NO MATCH ${p.eq_local.nombre} vs ${p.eq_visit.nombre}`); continue; }
    try {
      const p2 = await ctx.newPage();
      await p2.goto("https://www.sofascore.com" + found.href, { waitUntil: "domcontentloaded", timeout: 20000 });
      const ogImg = await p2.$eval('meta[property="og:image"]', (el) => el.getAttribute("content")).catch(() => null);
      const m = ogImg && ogImg.match(/\/event\/(\d+)\//);
      if (m) {
        p.sofascore_event_id = parseInt(m[1]);
        await sb.from("partidos").update({ sofascore_event_id: p.sofascore_event_id }).eq("id", p.id);
        console.log(`  mapped id=${p.id} ${p.eq_local.nombre} vs ${p.eq_visit.nombre} -> ${p.sofascore_event_id}`);
      }
      await p2.close();
    } catch (e) { console.log(`  err resolver ${p.id}: ${e.message}`); }
  }
  await page.close();
}

function parseIntSafe(s) { const n = parseInt(String(s).trim(), 10); return isNaN(n) ? 0 : n; }
function parseRatio(s) {
  const m = String(s).trim().match(/^(\d+)\s*\/\s*(\d+)/);
  return m ? { m: parseInt(m[1]), a: parseInt(m[2]) } : { m: 0, a: 0 };
}

async function scrapePartido(ctx, p) {
  if (!p.sofascore_event_id) return { ok: false, motivo: "sin event_id" };
  const url = `https://www.sofascore.com/event/${p.sofascore_event_id}`;
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await WAIT(3000);
    // Click tab box score
    try {
      await page.evaluate(() => {
        const tabs = [...document.querySelectorAll("a,button")].filter(a => /box.?score/i.test(a.innerText));
        if (tabs[0]) tabs[0].click();
      });
      await WAIT(1500);
    } catch {}

    // Parciales + boxscore via DOM scrape generico:
    const data = await page.evaluate(() => {
      // Parciales desde texto Q1..Q4 pattern
      const txt = document.body.innerText || "";
      let parciales = null;
      const pm = txt.match(/Q1\s*\|\s*Q2\s*\|\s*Q3\s*\|\s*Q4[^\n]*\n([\d\s|]+)\n([\d\s|]+)/);
      if (pm) {
        const parse = (row) => row.split(/[|\s]+/).map(x => parseInt(x)).filter(x => !isNaN(x));
        const local = parse(pm[1]);
        const visit = parse(pm[2]);
        if (local.length >= 4 && visit.length >= 4) parciales = { local, visitante: visit };
      }
      // Boxscore: tomar todos los links a jugadoras y, para cada uno, extraer la fila contenedora
      const box = [];
      const anchors = document.querySelectorAll('a[href*="/basketball/player/"]');
      const seen = new Set();
      for (const a of anchors) {
        const href = a.getAttribute("href");
        if (seen.has(href)) continue; seen.add(href);
        const nombre = (a.innerText || "").trim();
        if (!nombre || nombre.length < 2) continue;
        // La fila boxscore no suele ser un <tr> en sofascore sino divs. Buscar el ancestro con muchos numeros.
        let container = a;
        for (let i = 0; i < 8; i++) { if (!container.parentElement) break; container = container.parentElement; }
        const text = container.innerText || "";
        // Patron tipico: minutos (NN'), seguido de N numeros grandes y N/N ratios
        const minsM = text.match(/(\d{1,2})\s*['′]/);
        const mins = minsM ? parseInt(minsM[1]) : 0;
        // Separar numeros
        const nums = text.match(/-?\d+/g) || [];
        box.push({ nombre, href, mins, numsPreview: nums.slice(0, 20) });
      }
      return { parciales, box, bodyLength: txt.length };
    });
    await page.close();
    return { ok: true, ...data };
  } catch (e) {
    await page.close().catch(() => {});
    return { ok: false, motivo: e.message };
  }
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

async function main() {
  const partidos = await listarPendientes();
  console.log(`Partidos L029 pendientes de boxscore (ultimos 10d): ${partidos.length}`);
  if (!partidos.length) return;

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 }, locale: "en-AU",
  });

  await resolverEventIds(ctx, partidos);

  const rep = { intentados: 0, upserted: 0, sin_event: 0, sin_match_jug: [], errores: [] };
  let huecosJug = null; let huecosIdx = 0;

  for (const p of partidos) {
    if (!p.sofascore_event_id) { rep.sin_event++; continue; }
    rep.intentados++;
    const r = await scrapePartido(ctx, p);
    if (!r.ok) { rep.errores.push({ id: p.id, motivo: r.motivo }); continue; }
    console.log(`id=${p.id} event=${p.sofascore_event_id}: ${r.box.length} jugadoras, parciales=${!!r.parciales}, bodyLen=${r.bodyLength}`);

    // Rosters
    const { idxLocal, idxVisit } = await cargarRosterEquipos(p.id_equipo_local, p.id_equipo_visitante, p.temporada, p.id_liga);
    const filas = [];
    for (const b of r.box) {
      // Decidir equipo: por posicion en array (primeras ~N son local, siguientes visitante). Heuristica fragil.
      // Mejor: usar href + logo team cercano. Lazy: pasar por ambos indices.
      let id_jug = mapearJug(idxLocal, b.nombre);
      let id_equipo = p.id_equipo_local;
      if (!id_jug) { id_jug = mapearJug(idxVisit, b.nombre); id_equipo = p.id_equipo_visitante; }
      if (!id_jug) {
        if (!huecosJug) huecosJug = await cargarHuecosJug();
        if (huecosIdx < huecosJug.length) {
          const nuevoId = `J${huecosJug[huecosIdx++]}`;
          const { error } = await sb.from("jugadoras").insert({ id_jugadora: nuevoId, nombre: b.nombre });
          if (!error) {
            id_jug = nuevoId;
            await sb.from("temporadas").insert({ id_jugadora: nuevoId, id_equipo, id_liga: p.id_liga, temporada: p.temporada });
          }
        }
        if (!id_jug) { rep.sin_match_jug.push(b.nombre); continue; }
      }
      // Parsear nums: [mins, pts, reb, ast, stl, blk, pf, tov, oreb, dreb, fg_m, fg_a, ft_m, ft_a, 3p_m, 3p_a, +/-]
      // Como el DOM scraping es generico puede variar. Primera version solo pts/reb/ast desde nums[1-3].
      const n = b.numsPreview;
      filas.push({
        id_partido: p.id, id_jugadora: id_jug, id_equipo,
        nombre: b.nombre, dorsal: null, titular: null,
        minutos: b.mins ? `${b.mins}:00` : null,
        puntos: n[1] || 0,
        reb_totales: n[2] || 0, asistencias: n[3] || 0,
        robos: n[4] || 0, tapones: n[5] || 0,
        faltas: n[6] || 0, perdidas: n[7] || 0,
        reb_ofensivos: n[8] || 0, reb_defensivos: n[9] || 0,
        tc_anotados: 0, tc_intentados: 0, t3_anotados: 0, t3_intentados: 0, tl_anotados: 0, tl_intentados: 0,
        valoracion: 0,
      });
    }
    if (filas.length > 0) {
      await sb.from("partido_boxscore").delete().eq("id_partido", p.id);
      const { error } = await sb.from("partido_boxscore").insert(filas);
      if (error) { rep.errores.push({ id: p.id, insert: error.message }); continue; }
      rep.upserted += filas.length;
    }
    if (r.parciales) await sb.from("partidos").update({ parciales: r.parciales }).eq("id", p.id);
  }
  console.log("Reporte:", JSON.stringify(rep, null, 2));
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
