// v9 — fix upsert boxscore constraint
// v9: El upsert con onConflict:"id_partido,id_fpb" no funcionaba porque el índice
//     único es PARCIAL (WHERE id_fpb IS NOT NULL) y PostgreSQL no acepta índices
//     parciales como target de ON CONFLICT. Resultado: ningún boxscore portugués
//     se escribía. Fix: delete-all+insert-all por partido (patrón ya usado en
//     actualizar-resultados-genius y cargar-boxscores-feb).
// v8 - usa partido_boxscore.id_fpb (en vez de fuente+id_externo)
import { createClient } from "jsr:@supabase/supabase-js@2";
import { DOMParser } from "jsr:@b-fuze/deno-dom";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const FPB = "https://www.fpb.pt";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
const norm = (s: string) => (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const num = (t: string|undefined|null) => { const n = parseInt((t||"").replace(/[^\d-]/g,""),10); return isNaN(n)?0:n; };
const minutes = (t: string|undefined|null) => { const m = (t||"").match(/(\d+):(\d+)/); return m ? Math.round(+m[1] + +m[2]/60) : 0; };

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA, "Accept": "text/html,application/json,*/*" } });
  if (!r.ok) throw new Error(`FPB HTTP ${r.status}`);
  return await r.text();
}

function parseFicha(html: string) {
  const ptsM = /<div class="points">[\s\S]*?<span[^>]*>\s*(\d+)\s*<\/span>[\s\S]*?<span[^>]*>\s*(\d+)\s*<\/span>/.exec(html);
  let marcadorL = 0, marcadorV = 0, hayScore = false;
  if (ptsM) { marcadorL = +ptsM[1]; marcadorV = +ptsM[2]; hayScore = marcadorL>0 || marcadorV>0; }
  const parcLoc: number[] = [], parcVis: number[] = [];
  const periodos = [...html.matchAll(/<div class="match-period">[\s\S]*?<p>Q(\d)<\/p>[\s\S]*?<div class="partial-score">[\s\S]*?<span[^>]*>\s*(\d+)\s*<\/span>[\s\S]*?<span[^>]*>\s*(\d+)\s*<\/span>/g)];
  for (const p of periodos) { parcLoc.push(+p[2]); parcVis.push(+p[3]); }
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return { marcadorL, marcadorV, hayScore, parcLoc, parcVis, equipos: [] };
  const equiposHtml: { nombre: string; players: any[] }[] = [];
  for (const w of [...doc.querySelectorAll(".team-players-table-wrapper")]) {
    const nomEl = w.querySelector(".club .label") || w.querySelector("h2.label");
    const nombre = (nomEl?.textContent || "").trim();
    const nameTable = w.querySelector("table.col-5");
    const statsTable = [...w.querySelectorAll("table.col")].filter(t => !t.classList.contains("col-5"))[0];
    if (!nameTable || !statsTable) continue;
    const nameRows = [...nameTable.querySelectorAll("tr.player-row")];
    const statRows = [...statsTable.querySelectorAll("tr.player-row")];
    const players: any[] = [];
    const n = Math.min(nameRows.length, statRows.length);
    for (let i = 0; i < n; i++) {
      const nr = nameRows[i], sr = statRows[i];
      const dorsal = (nr.querySelector("td:first-child")?.textContent || "").trim();
      const linkEl = nr.querySelector('a[href*="/atletas/"]');
      const nomJug = (linkEl?.textContent || "").trim();
      const idFpb = ((linkEl?.getAttribute("href") || "").match(/\/atletas\/(\d+)/) || [])[1] || "";
      const titular = nr.classList.contains("is-starter");
      const tds = [...sr.querySelectorAll("td")];
      if (!nomJug || tds.length < 10) continue;
      const r1 = (tds[2]?.textContent||"").match(/(\d+)\s*\/\s*(\d+)/);
      const r2 = (tds[4]?.textContent||"").match(/(\d+)\s*\/\s*(\d+)/);
      const r3 = (tds[6]?.textContent||"").match(/(\d+)\s*\/\s*(\d+)/);
      const l2 = { a: r1?+r1[1]:0, i: r1?+r1[2]:0 };
      const l3 = { a: r2?+r2[1]:0, i: r2?+r2[2]:0 };
      const ll = { a: r3?+r3[1]:0, i: r3?+r3[2]:0 };
      players.push({
        dorsal, nombre: nomJug, id_fpb: idFpb, titular,
        min: minutes(tds[0]?.textContent||""), pts: num(tds[1]?.textContent||""),
        tc_anotados: l2.a + l3.a, tc_intentados: l2.i + l3.i,
        t3_anotados: l3.a, t3_intentados: l3.i, tl_anotados: ll.a, tl_intentados: ll.i,
        reb_ofensivos: num(tds[8]?.textContent||""), reb_defensivos: num(tds[9]?.textContent||""), reb_totales: num(tds[10]?.textContent||""),
        asistencias: num(tds[11]?.textContent||""), robos: num(tds[12]?.textContent||""), perdidas: num(tds[13]?.textContent||""),
        faltas: num(tds[15]?.textContent||""),
        valoracion: Math.round(parseFloat((tds[18]?.textContent||"0").replace(",",".")) || 0),
      });
    }
    equiposHtml.push({ nombre, players });
  }
  return { marcadorL, marcadorV, hayScore, parcLoc, parcVis, equipos: equiposHtml };
}

async function liveRefresh(idLiga: string, temporada: string, ventanaH: number, dry: boolean, forcePids: string[] = []) {
  const nowMs = Date.now();
  const desde = new Date(nowMs - 15*60*1000).toISOString();
  const hasta = new Date(nowMs + ventanaH*3600*1000).toISOString();
  let query = sb.from("partidos").select("id,id_ext,fecha_hora,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante,es_live,parciales").eq("id_liga", idLiga).eq("temporada", temporada).eq("fuente","fpb").not("id_ext","is",null);
  if (forcePids.length) query = query.in("id_ext", forcePids);
  else query = query.gte("fecha_hora", desde).lte("fecha_hora", hasta);
  const { data: partidos } = await query.order("fecha_hora", { ascending: true });
  if (!partidos?.length) return { modo:"live", procesados: 0, mensaje: "Sin partidos en ventana" };

  const equiposIds = new Set<string>();
  partidos.forEach((p: any) => { if (p.id_equipo_local) equiposIds.add(p.id_equipo_local); if (p.id_equipo_visitante) equiposIds.add(p.id_equipo_visitante); });
  const { data: temporadas } = await sb.from("temporadas").select("id_equipo,id_jugadora,jugadoras(nombre,id_fpb)").eq("id_liga", idLiga).eq("temporada", temporada).in("id_equipo", [...equiposIds]);
  const rosters = new Map<string, { id: string; nombre: string; id_fpb?: string }[]>();
  for (const r of temporadas || []) {
    if (!rosters.has(r.id_equipo)) rosters.set(r.id_equipo, []);
    rosters.get(r.id_equipo)!.push({ id: r.id_jugadora, nombre: (r.jugadoras as any)?.nombre || "", id_fpb: (r.jugadoras as any)?.id_fpb || undefined });
  }
  const { data: jugFpbAll } = await sb.from("jugadoras").select("id_jugadora,id_fpb").not("id_fpb","is",null);
  const jugByFpb = new Map<string,string>();
  for (const j of jugFpbAll||[]) jugByFpb.set(String((j as any).id_fpb), (j as any).id_jugadora);

  const detalles: string[] = [];
  let procesados = 0, actualizados = 0, enDirecto = 0, lineasMatch = 0, lineasSinMatch = 0, aprendidosFpb = 0;

  for (const p of partidos) {
    try {
      const html = await fetchText(`${FPB}/ficha-de-jogo/?internalID=${encodeURIComponent(String(p.id_ext))}`);
      const f = parseFicha(html);
      procesados++;
      const fechaMs = Date.parse(p.fecha_hora);
      const dentro = nowMs >= fechaMs - 15*60*1000 && nowMs < fechaMs + 2.5*3600*1000;
      const live = dentro && f.hayScore;
      const patch: Record<string, unknown> = { es_live: live };
      if (f.hayScore) { patch.resultado_local = f.marcadorL; patch.resultado_visitante = f.marcadorV; }
      if (f.parcLoc.length) patch.parciales = { local: f.parcLoc, visitante: f.parcVis };
      const cambia = (patch.resultado_local !== undefined && p.resultado_local !== patch.resultado_local)
        || (patch.resultado_visitante !== undefined && p.resultado_visitante !== patch.resultado_visitante)
        || (!!p.es_live !== live)
        || (JSON.stringify(p.parciales||null) !== JSON.stringify(patch.parciales||null));
      if (cambia && !dry) { await sb.from("partidos").update(patch).eq("id", p.id); actualizados++; }
      if (live) enDirecto++;

      if (f.equipos.length === 2) {
        const eqIds = [p.id_equipo_local, p.id_equipo_visitante];
        const usadosEnPartido = new Set<string>();
        const filas: any[] = [];
        for (let idx = 0; idx < 2; idx++) {
          const idEq = eqIds[idx]; if (!idEq) continue;
          const roster = rosters.get(idEq) || [];
          const rosterByFpb = new Map(roster.filter(x=>x.id_fpb).map(x=>[String(x.id_fpb), x.id] as const));
          for (const pl of f.equipos[idx].players) {
            if (!pl.id_fpb) continue;
            let idJug: string | null = null;
            if (rosterByFpb.has(pl.id_fpb)) idJug = rosterByFpb.get(pl.id_fpb)!;
            if (!idJug && jugByFpb.has(pl.id_fpb)) idJug = jugByFpb.get(pl.id_fpb)!;
            if (!idJug) {
              const toks = norm(pl.nombre).split(" ").filter((x:string) => x.length > 2);
              let best: { id: string; score: number } | null = null;
              let tie = false;
              for (const r of roster) {
                if (usadosEnPartido.has(r.id)) continue;
                const rn = norm(r.nombre);
                let s = 0; for (const t of toks) if (rn.includes(t)) s++;
                if (!best || s > best.score) { best = { id: r.id, score: s }; tie = false; }
                else if (best && s === best.score && s > 0) tie = true;
              }
              if (best && best.score >= 2 && !tie) idJug = best.id;
            }
            if (idJug && usadosEnPartido.has(idJug)) idJug = null;
            if (idJug) usadosEnPartido.add(idJug);
            if (idJug && !jugByFpb.has(pl.id_fpb) && !dry) {
              await sb.from("jugadoras").update({ id_fpb: pl.id_fpb }).eq("id_jugadora", idJug);
              jugByFpb.set(pl.id_fpb, idJug);
              aprendidosFpb++;
            }
            filas.push({
              id_partido: p.id,
              id_jugadora: idJug, id_equipo: idEq, id_fpb: pl.id_fpb,
              nombre: pl.nombre, dorsal: pl.dorsal, titular: pl.titular,
              minutos: String(pl.min), puntos: pl.pts,
              tc_anotados: pl.tc_anotados, tc_intentados: pl.tc_intentados,
              t3_anotados: pl.t3_anotados, t3_intentados: pl.t3_intentados,
              tl_anotados: pl.tl_anotados, tl_intentados: pl.tl_intentados,
              reb_ofensivos: pl.reb_ofensivos, reb_defensivos: pl.reb_defensivos, reb_totales: pl.reb_totales,
              asistencias: pl.asistencias, robos: pl.robos, tapones: 0, perdidas: pl.perdidas,
              faltas: pl.faltas, valoracion: pl.valoracion,
            });
            if (idJug) lineasMatch++; else lineasSinMatch++;
          }
        }
        // v9: delete-all + insert-all por partido (patrón robusto, evita ON CONFLICT con índice parcial).
        if (filas.length && !dry) {
          await sb.from("partido_boxscore").delete().eq("id_partido", p.id);
          const { error } = await sb.from("partido_boxscore").insert(filas);
          if (error) detalles.push(`iID=${p.id_ext} INSERT ERR: ${error.message.slice(0,80)}`);
        }
      }
      detalles.push(`iID=${p.id_ext} ${f.marcadorL}-${f.marcadorV} match=${lineasMatch} sinMatch=${lineasSinMatch}`);
    } catch (e) { detalles.push(`iID=${p.id_ext} ERROR: ${String(e).slice(0,100)}`); }
  }
  return { modo: "live", procesados, actualizados, en_directo: enDirecto, lineas_match: lineasMatch, lineas_sin_match: lineasSinMatch, id_fpb_aprendidos: aprendidosFpb, detalles: detalles.slice(0,15), dry };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    let body: any = {}; if (req.method === "POST") { try { body = await req.json(); } catch { /* vacio */ } }
    const u = new URL(req.url);
    const G = (k: string) => body[k] !== undefined ? body[k] : u.searchParams.get(k);
    const idLiga = String(G("id_liga") || "L051");
    const temporada = String(G("temporada") || "2026-27");
    const dry = (["true","1",true,1].includes(G("dry") as any));
    const ventanaH = Number(G("ventana_h") || 3);
    const forcePids: string[] = Array.isArray(G("pids")) ? G("pids") : (typeof G("pids")==="string" ? String(G("pids")).split(",").filter(Boolean) : []);
    return json({ ok: true, ...(await liveRefresh(idLiga, temporada, ventanaH, dry, forcePids)) });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
