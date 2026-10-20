// cargar-live-wnbl v2
// v2: no escribir rl/rv con 0-0 antes del tip-off (Rosetta devuelve home/away_score=0
//     para partidos not_started). Si BD ya tiene 0-0 escrito mal, lo revierte a NULL.
// Live marcador + status para WNBL (Australia, L029).
// Nivel 1: solo marcador final/live y estado. No incluye parciales ni boxscore
// porque la API pública de Rosetta no expone esos datos (requerirían API key
// enterprise de Sportradar/Genius).
//
// Fuente: prod.rosetta.nbl.com.au/get/wnbl/matches/in/season/{year}/all
// Requiere User-Agent y Referer de browser real.
//
// Modo cron (sin body): fetch Rosetta → actualiza todos los partidos L029 por
//   id_ext (UUID Rosetta). Si BD aún no tiene id_ext, mapea por nombre+fecha.
// Modo manual: POST {id_partido} → refresca ese partido en concreto.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const ID_LIGA = "L029";
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Referer": "https://www.wnbl.com.au/",
  "Origin": "https://www.wnbl.com.au",
  "Accept": "application/json",
};

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function temporadaBD(): string {
  const now = new Date();
  const inicio = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, "0")}`;
}
function yearRosetta(): string {
  const now = new Date();
  const y = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return String(y);
}

interface RosettaMatch {
  id: string;
  external_id?: string;
  start_time?: string;
  start_time_datetime?: string;
  match_status?: string;
  status?: string;
  home_score?: number | string | null;
  away_score?: number | string | null;
  match_type?: string;
  home_team?: { name?: string; team_code?: string };
  away_team?: { name?: string; team_code?: string };
  season?: { year?: string };
}

async function fetchRosetta(year: string): Promise<RosettaMatch[]> {
  const url = `https://prod.rosetta.nbl.com.au/get/wnbl/matches/in/season/${year}/all`;
  try {
    const r = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return [];
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j?.data || []);
    return arr.filter((m: RosettaMatch) => m?.match_type === "regular" || !m?.match_type);
  } catch {
    return [];
  }
}

interface EquipoBD { id_equipo: string; nombre: string }
async function cargarEquipos(): Promise<EquipoBD[]> {
  const { data: temps } = await sb.from("temporadas")
    .select("id_equipo, equipos(nombre)")
    .eq("id_liga", ID_LIGA).eq("temporada", temporadaBD());
  const uniq = new Map<string, EquipoBD>();
  for (const t of temps || []) {
    const nombre = (t.equipos as any)?.nombre || "";
    if (!nombre || uniq.has(t.id_equipo)) continue;
    uniq.set(t.id_equipo, { id_equipo: t.id_equipo, nombre });
  }
  return [...uniq.values()];
}

function mapearEquipo(equipos: EquipoBD[], nombre: string): string | null {
  const n = norm(nombre);
  for (const e of equipos) if (norm(e.nombre) === n) return e.id_equipo;
  const tokens = n.split(" ").filter(w => w.length > 3);
  for (const e of equipos) {
    const en = norm(e.nombre);
    if (tokens.length && tokens.every(t => en.includes(t))) return e.id_equipo;
  }
  return null;
}

const toInt = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return isNaN(n) ? null : n;
};

async function procesarPartido(p: any, matchesIndex: Map<string, RosettaMatch>, equipos: EquipoBD[]): Promise<any> {
  let m: RosettaMatch | null = null;
  if (p.id_ext && matchesIndex.has(String(p.id_ext))) {
    m = matchesIndex.get(String(p.id_ext))!;
  } else if (p.id_equipo_local && p.id_equipo_visitante && p.fecha_hora) {
    const fechaBD = Date.parse(p.fecha_hora);
    for (const rm of matchesIndex.values()) {
      const idL = mapearEquipo(equipos, rm.home_team?.name || "");
      const idV = mapearEquipo(equipos, rm.away_team?.name || "");
      if (idL !== p.id_equipo_local || idV !== p.id_equipo_visitante) continue;
      const fechaRaw = rm.start_time_datetime || rm.start_time || "";
      const fechaR = Date.parse(fechaRaw.endsWith("Z") ? fechaRaw : fechaRaw + "Z");
      if (isNaN(fechaR)) continue;
      if (Math.abs(fechaR - fechaBD) <= 24 * 3600 * 1000) { m = rm; break; }
    }
  }
  if (!m) return { id: p.id, ok: false, motivo: "sin match Rosetta" };

  const scA = toInt(m.home_score);
  const scB = toInt(m.away_score);
  const status = (m.match_status || "").toLowerCase();
  const terminado = status === "complete" || status === "final";
  const live = !terminado && (status === "live" || status === "in_progress" || ((scA || 0) > 0 || (scB || 0) > 0));
  // Rosetta devuelve home_score=0, away_score=0 para partidos no empezados;
  // solo escribimos marcador si está en vivo o acabado para no pisar NULL con 0-0.
  const empezado = terminado || live;
  const upd: any = {};
  if (!p.id_ext) upd.id_ext = m.id;
  if (empezado) {
    if (scA != null && scA !== p.resultado_local) upd.resultado_local = scA;
    if (scB != null && scB !== p.resultado_visitante) upd.resultado_visitante = scB;
  } else if (p.resultado_local != null || p.resultado_visitante != null) {
    // Corrige partidos marcados por error con 0-0 antes del tip-off.
    upd.resultado_local = null;
    upd.resultado_visitante = null;
  }
  if (!!live !== !!p.es_live) upd.es_live = !!live;
  if (!p.fuente) upd.fuente = "wnbl";
  const fechaRaw = m.start_time_datetime || m.start_time;
  if (fechaRaw) {
    const fIso = fechaRaw.endsWith("Z") ? fechaRaw : fechaRaw + "Z";
    if (!p.fecha_hora || String(p.fecha_hora).slice(0, 16) !== fIso.slice(0, 16)) upd.fecha_hora = fIso;
  }

  if (Object.keys(upd).length === 0) {
    return { id: p.id, ok: true, cambios: 0, score: `${scA}-${scB}`, status };
  }
  await sb.from("partidos").update(upd).eq("id", p.id);
  return { id: p.id, ok: true, cambios: Object.keys(upd).length, score: `${scA}-${scB}`, status, es_live: live };
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

    const matches = await fetchRosetta(yearRosetta());
    if (matches.length === 0) return json({ ok: false, error: "sin matches Rosetta" }, 502);
    const matchesIndex = new Map<string, RosettaMatch>();
    for (const m of matches) matchesIndex.set(m.id, m);

    const equipos = await cargarEquipos();

    if (body.id_partido) {
      const { data: p, error } = await sb.from("partidos")
        .select("id, id_ext, id_liga, temporada, id_equipo_local, id_equipo_visitante, fecha_hora, resultado_local, resultado_visitante, es_live, fuente")
        .eq("id", body.id_partido).maybeSingle();
      if (error || !p) return json({ ok: false, error: "partido no encontrado" }, 404);
      const r = await procesarPartido(p, matchesIndex, equipos);
      return json({ ok: true, modo: "manual", resultado: r });
    }

    const { data: partidos } = await sb.from("partidos")
      .select("id, id_ext, id_liga, temporada, id_equipo_local, id_equipo_visitante, fecha_hora, resultado_local, resultado_visitante, es_live, fuente")
      .eq("id_liga", ID_LIGA).eq("temporada", temporadaBD());
    if (!partidos || partidos.length === 0) return json({ ok: true, mensaje: "sin partidos BD" });

    const resultados: any[] = [];
    let mapeados = 0, actualizados = 0;
    for (const p of partidos) {
      try {
        const r = await procesarPartido(p, matchesIndex, equipos);
        if (r.ok && r.cambios > 0) actualizados++;
        if (r.ok && !p.id_ext) mapeados++;
        resultados.push(r);
      } catch (e) { resultados.push({ id: p.id, ok: false, error: String(e) }); }
    }
    return json({
      ok: true, modo: "cron",
      total_bd: partidos.length,
      total_rosetta: matches.length,
      actualizados,
      id_ext_mapeados: mapeados,
      resultados: resultados.slice(0, 20),
    });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
