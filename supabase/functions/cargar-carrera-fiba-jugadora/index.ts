// cargar-carrera-fiba-jugadora v5 - fix temporada para clubes (formato YYYY-YY).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Params = z.object({
  id_jugadora: z.string().regex(/^J\d+$/),
  id_liga:     z.string().regex(/^L\d+$/).optional(),
  temporada:   z.string().optional(),
  dry:         z.boolean().optional().default(true),
  max_eventos: z.number().int().min(1).max(60).optional().default(15),
}).strict();

// Ligas de club (temporada YYYY-YY). El resto son de seleccion (temporada YYYY).
const LIGAS_CLUB = new Set(["L004", "L005", "L110"]);

const MAP_RULES: Array<[RegExp, string | null]> = [
  [/u19.*world|u19.*wc/i,                "L105"],
  [/u17.*world|u17.*wc/i,                "L071"],
  [/u20.*european/i,                     "L067"],
  [/u18.*european.*division a/i,         "L075"],
  [/u18.*european.*division b/i,         "L083"],
  [/u18.*european.*division c/i,         "L099"],
  [/u18.*european/i,                     "L075"],
  [/u16.*european.*division a/i,         "L076"],
  [/u16.*european.*division b/i,         "L091"],
  [/u16.*european.*division c/i,         "L079"],
  [/u16.*european|european.*u16/i,       "L076"],
  [/afrobasket.*u18/i,                   "L096"],
  [/afrobasket.*u16/i,                   "L087"],
  [/afrobasket/i,                        "L058"],
  [/americup.*u18/i,                     "L077"],
  [/americup.*u16/i,                     "L093"],
  [/americup/i,                          "L057"],
  [/asia.?cup.*u18/i,                    "L078"],
  [/asia.?cup.*u16/i,                    "L080"],
  [/asia.?cup/i,                         "L059"],
  [/centrobasket.*u15/i,                 "L085"],
  [/oceania.*u17/i,                      "L081"],
  [/oceania.*u15/i,                      "L082"],
  [/world.?cup.*qualif|qualif.*world|qualifying tournament/i, "L056"],
  [/world.?cup|world championship/i,     "L055"],
  [/olympic.*qualif/i,                   "L104"],
  [/olympic/i,                           "L060"],
  [/eurobasket.*qualif|qualif.*eurobasket/i, "L027"],
  [/eurobasket/i,                        "L027"],
  [/euroleague.*women/i,                 "L004"],
  [/eurocup.*women/i,                    "L005"],
  [/supercup.*women/i,                   "L110"],
  [/all.?star/i,                         null],
  [/3x3/i,                               null],
];
function mapLiga(name: string): string | null {
  for (const [re, id] of MAP_RULES) if (re.test(name)) return id;
  return null;
}

function seasonForClub(url: string, year: number): string {
  const m = url.match(/-(\d{2})-(\d{2})(?:[\/-]|$)/);
  if (m) return `20${m[1]}-${m[2]}`;
  const s = year - 1;
  const e = year % 100;
  return `${s}-${String(e).padStart(2, "0")}`;
}

function fmtMinutos(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function fetchHtml(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  return await r.text();
}

function parseChunks(html: string): string {
  const chunks: string[] = [];
  const re = /self\.__next_f\.push\(\[\d+,("(?:[^"\\]|\\.)*")\]\)/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try { chunks.push(JSON.parse(m[1])); } catch {}
  }
  return chunks.join("\n");
}

interface EventoCarrera { year: number; event_name: string; url: string; team: string; gp: number; ppg: number; }

function extractEventos(joined: string): EventoCarrera[] {
  const out: EventoCarrera[] = [];
  const blocks = joined.split(/(?="ageType":"[SYC]")/);
  const seen = new Set<string>();
  for (const block of blocks) {
    if (!block.startsWith('"ageType"')) continue;
    const stats = block.match(/"gp":(\d+),"ppg":([\d.]+),"rpg":([\d.]+),"apg":([\d.]+),"eff":(-?[\d.]+),"team":"([^"]+)"/);
    if (!stats) continue;
    const urlM = block.match(/"link":\{"url":"([^"]+)"/);
    if (!urlM) continue;
    const yearM = block.match(/"children":(\d{4})[^\d]/);
    if (!yearM) continue;
    const eventM = block.match(/"event":\[[\s\S]*?"children":"([^"]+)"/);
    if (!eventM) continue;
    const key = `${yearM[1]}|${eventM[1]}|${urlM[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      url: urlM[1], year: parseInt(yearM[1]), event_name: eventM[1],
      gp: parseInt(stats[1]), ppg: parseFloat(stats[2]),
      team: stats[6],
    });
  }
  return out;
}

interface GameStat { gameId: number; roundName: string; gameDay: number;
  teamCode: string; versusTeamCode: string; teamOrganisationId: number; versusTeamOrganisationId: number;
  playDurationInSeconds: number; points: number; fieldGoalsMade: number; fieldGoalsAttempted: number;
  twoPointsMade: number; twoPointsAttempted: number; threePointsMade: number; threePointsAttempted: number;
  freeThrowsMade: number; freeThrowsAttempted: number; offensiveRebounds: number; defensiveRebounds: number;
  rebounds: number; assists: number; personalFouls: number; turnovers: number; steals: number;
  blockedShots: number; plusMinus: number; efficiency: number; }

function extractGameStats(joined: string): GameStat[] {
  const key = '"gameStatistics":[';
  const i = joined.indexOf(key);
  if (i < 0) return [];
  const start = i + key.length - 1;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let j = start; j < joined.length; j++) {
    const ch = joined[j];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) return [];
  try { return JSON.parse(joined.slice(start, end)); } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jr = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), {
    status: s, headers: { ...CORS, "Content-Type": "application/json" },
  });

  let body: any = {}; try { body = await req.json(); } catch {}
  const parsed = Params.safeParse(body);
  if (!parsed.success) {
    return jr({ ok: false, error: "Params invalidos",
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })) }, 400);
  }
  const { id_jugadora, id_liga, temporada, dry, max_eventos } = parsed.data;

  const { data: jug } = await sb.from("jugadoras")
    .select("id_jugadora,nombre,fiba_person_id").eq("id_jugadora", id_jugadora).single();
  if (!jug) return jr({ ok: false, error: "Jugadora no encontrada" }, 404);
  if (!jug.fiba_person_id) return jr({ ok: false, error: "Jugadora sin fiba_person_id" }, 400);

  const { data: eqAll } = await sb.from("equipos")
    .select("id_equipo,id_fiba").not("id_fiba", "is", null).limit(3000);
  const eqByFiba = new Map<string, string>((eqAll || []).map((e: any) => [String(e.id_fiba), e.id_equipo]));

  const url = `https://www.fiba.basketball/en/players/${jug.fiba_person_id}`;
  let html: string;
  try { html = await fetchHtml(url); } catch (e) { return jr({ ok: false, error: `Ficha FIBA falló: ${String(e)}`, url }, 502); }
  const chunks = parseChunks(html);
  const eventos = extractEventos(chunks);

  const rep: any = {
    ok: true, dry, jugadora: jug.nombre, fiba_person_id: jug.fiba_person_id,
    eventos_encontrados: eventos.length,
    eventos_sin_mapping: [] as string[],
    procesados: 0, creados: 0, boxscores: 0, sin_equipo: [] as string[],
    detalle: [] as any[],
  };

  const rows: Array<EventoCarrera & { id_liga: string; temporada: string; notas?: string }> = [];
  for (const ev of eventos) {
    const lid = mapLiga(ev.event_name);
    if (!lid) { rep.eventos_sin_mapping.push(`${ev.year} ${ev.event_name}`); continue; }
    const temp = LIGAS_CLUB.has(lid) ? seasonForClub(ev.url, ev.year) : String(ev.year);
    if (id_liga && lid !== id_liga) continue;
    if (temporada && temp !== temporada) continue;
    const notas = /qualif/i.test(ev.event_name) ? "Qualifiers" : "";
    rows.push({ ...ev, id_liga: lid, temporada: temp, notas });
  }

  const toProcess = rows.slice(0, max_eventos);
  rep.eventos_seleccionados = rows.length;
  rep.eventos_a_procesar = toProcess.length;

  for (const ev of toProcess) {
    const path = ev.url.startsWith("/en/") ? ev.url : "/en" + ev.url;
    const evUrl = `https://www.fiba.basketball${path}`;
    let ehtml: string;
    try { ehtml = await fetchHtml(evUrl); } catch (e) {
      rep.detalle.push({ evento: ev.event_name, year: ev.year, error: `fetch: ${String(e)}` });
      continue;
    }
    const echunks = parseChunks(ehtml);
    const games = extractGameStats(echunks);
    if (!games.length) {
      rep.detalle.push({ evento: ev.event_name, year: ev.year, url: evUrl, partidos: 0 });
      continue;
    }
    rep.procesados++;

    let creadosEv = 0, boxEv = 0;
    for (const g of games) {
      const myEq = eqByFiba.get(String(g.teamOrganisationId)) || eqByFiba.get(g.teamCode) || null;
      const vsEq = eqByFiba.get(String(g.versusTeamOrganisationId)) || eqByFiba.get(g.versusTeamCode) || null;
      if (!myEq || !vsEq) {
        rep.sin_equipo.push(`${ev.year} ${ev.event_name} · ${g.teamCode} vs ${g.versusTeamCode} (gid ${g.gameId})`);
        continue;
      }

      const idExt = String(g.gameId);
      const { data: exist } = await sb.from("partidos").select("id")
        .eq("id_liga", ev.id_liga).eq("temporada", ev.temporada).eq("id_ext", idExt).maybeSingle();
      let idPartido: number | null = exist?.id ?? null;
      const notas = `${g.roundName || ev.notas || ""}`.trim() || null;

      if (!idPartido) {
        creadosEv++;
        if (!dry) {
          const { data: ins } = await sb.from("partidos").insert({
            id_liga: ev.id_liga, temporada: ev.temporada,
            id_equipo_local: myEq, id_equipo_visitante: vsEq,
            id_ext: idExt, fuente: "fiba", notas,
          }).select("id").single();
          idPartido = ins?.id ?? null;
        }
      }

      boxEv++;
      if (!dry && idPartido) {
        await sb.from("partido_boxscore").upsert({
          id_partido: idPartido, id_jugadora, id_equipo: myEq,
          nombre: jug.nombre, dorsal: "", titular: false,
          minutos: fmtMinutos(g.playDurationInSeconds),
          puntos: g.points || 0,
          tc_anotados: g.fieldGoalsMade || 0, tc_intentados: g.fieldGoalsAttempted || 0,
          t3_anotados: g.threePointsMade || 0, t3_intentados: g.threePointsAttempted || 0,
          tl_anotados: g.freeThrowsMade || 0, tl_intentados: g.freeThrowsAttempted || 0,
          reb_ofensivos: g.offensiveRebounds || 0, reb_defensivos: g.defensiveRebounds || 0,
          reb_totales: g.rebounds || 0,
          asistencias: g.assists || 0, robos: g.steals || 0, tapones: g.blockedShots || 0,
          perdidas: g.turnovers || 0, faltas: g.personalFouls || 0, valoracion: g.efficiency || 0,
        }, { onConflict: "id_partido,id_jugadora" });
      }
    }
    rep.creados += creadosEv;
    rep.boxscores += boxEv;
    rep.detalle.push({ evento: ev.event_name, year: ev.year, id_liga: ev.id_liga, temporada: ev.temporada, partidos_fiba: games.length, creados: creadosEv, boxscores: boxEv });
  }

  rep.eventos_sin_mapping = [...new Set(rep.eventos_sin_mapping)];
  rep.sin_equipo = [...new Set(rep.sin_equipo)].slice(0, 30);
  return jr(rep);
});
