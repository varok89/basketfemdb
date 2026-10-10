// cargar-live-feb v2 - marcador live + parciales + boxscore usando API oficial FEB LiveStats
// v2: auto-crea jugadoras ausentes (sin id_feb en BD) para poder vincularlas a mano después.
// Fuente: https://intrafeb.feb.es/LiveStats.API/api/v1/{KeyFacts,BoxScore}/{pid}
// Token Bearer embebido en el HTML de la ficha /partido/{pid} (<input id="_ctl0_token">).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROXY_KEY = Deno.env.get("SCRAPER_PROXY_KEY") || "";
const PROXY_URL = Deno.env.get("PROXY_URL") || "https://labasketneta.app/api/proxy-feb";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const FEB_WEB = "https://baloncestoenvivo.feb.es";
const FEB_API = "https://intrafeb.feb.es/LiveStats.API/api/v1";
const FOTO_FEB = "https://imagenes.feb.es/Foto.aspx";
const BUCKET_FOTOS = "fotos-jugadoras";
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

const boolish = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1" || v === 1) return true;
  if (v === "false" || v === "0" || v === 0) return false;
  return v;
}, z.boolean());

const Params = z.object({
  id_liga:   z.string().regex(/^L\d+$/).optional(),
  temporada: z.string().regex(/^\d{4}(-\d{2})?$/).optional(),
  pids:      z.string().regex(/^[\d,]+$/).optional(),
  pid:       z.string().regex(/^\d+$/).optional(),
  dry:       boolish.optional().default(false),
  force:     boolish.optional().default(false),
}).strict();

async function fetchDirect(url: string, headers: Record<string,string> = {}): Promise<string | null> {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; } finally { clearTimeout(to); }
}
async function fetchProxy(url: string): Promise<string | null> {
  if (!PROXY_KEY) return null;
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`, { headers: { "x-proxy-key": PROXY_KEY }, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; } finally { clearTimeout(to); }
}
async function getHtml(url: string): Promise<string> {
  const d = await fetchDirect(url); if (d && d.length > 2000) return d;
  const p = await fetchProxy(url); if (p && p.length > 2000) return p;
  throw new Error("getHtml: direct and proxy failed");
}

function extraerToken(html: string): string | null {
  const m = /id="_ctl0_token"\s+value="([^"]+)"/.exec(html);
  return m ? m[1] : null;
}

async function fetchJsonApi(endpoint: string, pid: string, token: string): Promise<any | null> {
  const url = `${FEB_API}/${endpoint}/${pid}`;
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}`, "Referer": "https://baloncestoenvivo.feb.es/", "user-agent": UA, "accept": "application/json" },
      signal: ctrl.signal,
    });
    if (!r.ok) { await r.body?.cancel(); return null; }
    return await r.json();
  } catch { return null; } finally { clearTimeout(to); }
}

async function cargarHuecosJug(): Promise<number[]> {
  const all = new Set<number>();
  for (let off = 0; off < 20; off++) {
    const { data } = await sb.from("jugadoras").select("id_jugadora").order("id_jugadora", { ascending: true }).range(off * 1000, off * 1000 + 999);
    if (!data || !data.length) break;
    for (const r of data) { const n = parseInt(r.id_jugadora.slice(1), 10); if (!isNaN(n)) all.add(n); }
    if (data.length < 1000) break;
  }
  const max = all.size ? Math.max(...all) : 0;
  const huecos: number[] = [];
  for (let i = 1; i <= max + 200; i++) { if (!all.has(i)) huecos.push(i); if (huecos.length >= 200) break; }
  return huecos;
}

async function subirFotoFeb(cFeb: string, idJug: string): Promise<string | null> {
  try {
    const r = await fetch(`${FOTO_FEB}?c=${cFeb}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok || r.status === 404) { await r.body?.cancel(); return null; }
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length < 200) return null;
    const ruta = `${idJug}.jpg`;
    const { error } = await sb.storage.from(BUCKET_FOTOS).upload(ruta, buf, { contentType: "image/jpeg", upsert: true });
    if (error) return null;
    const { data: pub } = sb.storage.from(BUCKET_FOTOS).getPublicUrl(ruta);
    return pub?.publicUrl || null;
  } catch { return null; }
}

function parseMin(mf: string | null | undefined): number | null {
  if (!mf) return null;
  const m = /(\d+):(\d+)/.exec(mf);
  if (!m) return null;
  return Math.round(+m[1] + (+m[2]) / 60);
}
const nInt = (v: any): number => { const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10); return isNaN(n) ? 0 : n; };

async function procesarPartido(partido: any, dry: boolean): Promise<any> {
  const pid = String(partido.id_ext);
  const html = await getHtml(`${FEB_WEB}/partido/${pid}`);
  const token = extraerToken(html);
  if (!token) return { pid, ok: false, motivo: "sin_token" };

  const [kf, bs] = await Promise.all([
    fetchJsonApi("KeyFacts", pid, token),
    fetchJsonApi("BoxScore", pid, token),
  ]);
  if (!kf?.HEADER?.TEAM) return { pid, ok: false, motivo: "KeyFacts vacio" };

  const H = kf.HEADER;
  const statusText = String(H.statusText || "").toUpperCase();
  const terminado = statusText === "FINISHED" || statusText === "ENDED";
  const noEmpezado = statusText === "NOT_STARTED";
  const puntosLoc = nInt(H.TEAM?.[0]?.pts);
  const puntosVis = nInt(H.TEAM?.[1]?.pts);
  const quartersArr = Array.isArray(H.QUARTERS?.QUARTER) ? H.QUARTERS.QUARTER : (H.QUARTERS?.QUARTER ? [H.QUARTERS.QUARTER] : []);
  const parcLoc = quartersArr.map((q: any) => nInt(q.scoreA));
  const parcVis = quartersArr.map((q: any) => nInt(q.scoreB));
  const parciales = (parcLoc.length && parcVis.length) ? { local: parcLoc, visitante: parcVis } : null;
  const periodo = terminado ? null : (H.quarter ?? null);

  const upd: Record<string, unknown> = {
    resultado_local: noEmpezado ? null : puntosLoc,
    resultado_visitante: noEmpezado ? null : puntosVis,
    es_live: !terminado && !noEmpezado,
    periodo,
  };
  if (parciales) upd.parciales = parciales;

  if (!dry) {
    const { error } = await sb.from("partidos").update(upd).eq("id", partido.id);
    if (error) return { pid, ok: false, motivo: `update ${error.message}` };
  }

  let filas = 0, sinMapear = 0, creadas = 0;
  if (bs?.BOXSCORE?.TEAM?.length === 2 && partido.id_equipo_local && partido.id_equipo_visitante) {
    const equipos = [
      { players: bs.BOXSCORE.TEAM[0].PLAYER || [], id_equipo: partido.id_equipo_local },
      { players: bs.BOXSCORE.TEAM[1].PLAYER || [], id_equipo: partido.id_equipo_visitante },
    ];
    const todosIdsFeb = new Set<string>();
    for (const t of equipos) for (const p of t.players) if (p.id) todosIdsFeb.add(String(p.id));
    const idsFebArr = [...todosIdsFeb];
    const porIdFeb = new Map<string, string>();
    if (idsFebArr.length) {
      const { data } = await sb.from("jugadoras").select("id_jugadora,id_feb").in("id_feb", idsFebArr);
      for (const j of data || []) if (j.id_feb) porIdFeb.set(String(j.id_feb), j.id_jugadora);
    }
    const rows: any[] = [];
    let huecosJug: number[] | null = null;
    let huecosIdx = 0;
    const jugadorasCreadas: string[] = [];
    for (const t of equipos) {
      for (const p of t.players) {
        if (!p.id && !p.name) continue;
        let idJug = p.id ? porIdFeb.get(String(p.id)) : null;
        // v2: auto-crear jugadora si tiene id_feb y no está en BD (user la vinculará/renombrará a mano)
        if (!idJug && p.id && !dry) {
          if (!huecosJug) huecosJug = await cargarHuecosJug();
          if (huecosIdx < huecosJug.length) {
            const nuevoId = `J${huecosJug[huecosIdx++]}`;
            const nombreLive = String(p.name || "").trim() || `FEB ${p.id}`;
            const fotoUrl = await subirFotoFeb(String(p.id), nuevoId);
            const row: any = { id_jugadora: nuevoId, nombre: nombreLive, id_feb: String(p.id) };
            if (fotoUrl) row.foto = fotoUrl;
            const { error } = await sb.from("jugadoras").insert(row);
            if (!error) { idJug = nuevoId; porIdFeb.set(String(p.id), nuevoId); jugadorasCreadas.push(`${nuevoId} ${nombreLive}`); creadas++; }
          }
        }
        if (!idJug) { sinMapear++; continue; }
        rows.push({
          id_partido: partido.id,
          id_jugadora: idJug,
          id_equipo: t.id_equipo,
          nombre: String(p.name || "").trim(),
          dorsal: p.no ? String(p.no) : null,
          titular: p.sta === "1" || p.sta === 1,
          minutos: parseMin(p.minFormatted),
          puntos: nInt(p.pts),
          tc_anotados: nInt(p.fgm), tc_intentados: nInt(p.fga),
          t3_anotados: nInt(p.p3m), t3_intentados: nInt(p.p3a),
          tl_anotados: nInt(p.p1m), tl_intentados: nInt(p.p1a),
          reb_ofensivos: nInt(p.ro), reb_defensivos: nInt(p.rd), reb_totales: nInt(p.rt),
          asistencias: nInt(p.assist), robos: nInt(p.st), tapones: nInt(p.bs),
          perdidas: nInt(p.to), faltas: nInt(p.pf), valoracion: nInt(p.val),
        });
      }
    }
    if (rows.length && !dry) {
      const { error } = await sb.from("partido_boxscore").upsert(rows, { onConflict: "id_partido,id_jugadora" });
      if (error) return { pid, ok: false, motivo: `upsert box ${error.message}`, box_rows: rows.length };
      filas = rows.length;
    } else {
      filas = rows.length;
    }
  }

  return {
    pid, ok: true, status: statusText,
    marcador: `${puntosLoc}-${puntosVis}`, periodo: H.quarter, time: H.time,
    parciales_n: parcLoc.length, box_filas: filas, box_sin_mapear: sinMapear,
    jugadoras_creadas: creadas,
    terminado,
  };
}

async function cargarPartidos(p: z.infer<typeof Params>): Promise<any[]> {
  const sel = "id,id_ext,id_liga,temporada,id_equipo_local,id_equipo_visitante,es_live,fecha_hora";
  if (p.pid) {
    const { data } = await sb.from("partidos").select(sel).eq("id_ext", p.pid).limit(5);
    return data || [];
  }
  if (p.pids) {
    const arr = p.pids.split(",").filter(Boolean);
    let q = sb.from("partidos").select(sel).in("id_ext", arr);
    if (p.id_liga) q = q.eq("id_liga", p.id_liga);
    if (p.temporada) q = q.eq("temporada", p.temporada);
    const { data } = await q.limit(50);
    return data || [];
  }
  const desde = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  const hasta = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  let q = sb.from("partidos").select(sel).eq("fuente", "feb").not("id_ext", "is", null)
    .gte("fecha_hora", desde).lte("fecha_hora", hasta);
  if (p.id_liga) q = q.eq("id_liga", p.id_liga);
  if (p.temporada) q = q.eq("temporada", p.temporada);
  const { data } = await q.limit(30);
  return data || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    let body: any = {}; if (req.method === "POST") { try { body = await req.json(); } catch {} }
    const u = new URL(req.url);
    const raw: Record<string, unknown> = {};
    for (const k of ["id_liga","temporada","pids","pid","dry","force"]) {
      const v = body[k] !== undefined ? body[k] : u.searchParams.get(k);
      if (v !== undefined && v !== null && v !== "") raw[k] = v;
    }
    const parsed = Params.safeParse(raw);
    if (!parsed.success) return json({ ok: false, error: "Params invalidos", detalles: parsed.error.issues.map(i => ({ campo: i.path.join("."), mensaje: i.message })) }, 400);
    const partidos = await cargarPartidos(parsed.data);
    if (!partidos.length) return json({ ok: true, mensaje: "sin partidos en ventana", procesados: 0 });
    const resultados: any[] = [];
    for (const p of partidos) {
      try { resultados.push(await procesarPartido(p, parsed.data.dry)); }
      catch (e) { resultados.push({ pid: p.id_ext, ok: false, error: String(e) }); }
    }
    const ok = resultados.filter(r => r.ok).length;
    return json({ ok: true, procesados: resultados.length, exitosos: ok, dry: parsed.data.dry, resultados });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
