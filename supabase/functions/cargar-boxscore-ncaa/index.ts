// cargar-boxscore-ncaa v1
// Clon de cargar-boxscore-wnba adaptado a NCAA (L020) con endpoint ESPN
// /leagues/womens-college-basketball/events/{gid}/competitions/{gid}/competitors.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const UA = { "User-Agent": "Mozilla/5.0" };

const Params = z.object({
  id_ext: z.string().regex(/^\d+$/, "id_ext debe ser el gameId numerico de ESPN"),
}).strict();

async function j(url: string) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function getStat(cats: any[], name: string): number {
  for (const c of (cats||[])) {
    for (const s of (c.stats||[])) {
      if (s.name === name) return parseFloat(s.value) || 0;
    }
  }
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jr = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  let body: any = {}; try { body = await req.json(); } catch {}
  const parsed = Params.safeParse(body);
  if (!parsed.success) return jr({ ok: false, error: "Params invalidos", detalles: parsed.error.issues.map(i => ({ campo: i.path.join("."), mensaje: i.message })) }, 400);
  const idExt = parsed.data.id_ext;

  const { data: part } = await sb.from("partidos")
    .select("id,id_liga,id_equipo_local,id_equipo_visitante")
    .eq("id_liga", "L020").eq("id_ext", idExt).maybeSingle();
  if (!part) return jr({ ok: false, error: `Partido ${idExt} no en BD L020` }, 404);

  const { data: jugsAll } = await sb.from("jugadoras").select("id_jugadora,nombre,id_espn").not("id_espn","is",null);
  const byEspnId = new Map<string,{id_jugadora:string,nombre:string}>((jugsAll||[]).map((x:any)=>[String(x.id_espn),{id_jugadora:x.id_jugadora,nombre:x.nombre}]));

  const { data: tempsL020 } = await sb.from("temporadas").select("id_equipo").eq("id_liga","L020");
  const ncaaSet = new Set((tempsL020||[]).map((r:any)=>r.id_equipo));
  const { data: eqAll } = await sb.from("equipos").select("id_equipo,id_espn").not("id_espn","is",null);
  const eqByEspn = new Map<string,string>();
  for (const e of eqAll||[]) if (ncaaSet.has(e.id_equipo)) eqByEspn.set(String(e.id_espn), e.id_equipo);

  let compets: any;
  try {
    compets = await j(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/womens-college-basketball/events/${idExt}/competitions/${idExt}/competitors`);
  } catch (e) { return jr({ ok:false, error: `ESPN competitors: ${e}` }, 502); }

  const rep: any = { id_ext: idExt, id_partido: part.id, upserted: 0, sin_match: [], errores: [] };
  const filas: any[] = [];

  for (const it of compets.items || []) {
    let comp: any;
    try { comp = await j(it.$ref); } catch { continue; }
    const teamEspnId = String(comp.id);
    const teamBd = eqByEspn.get(teamEspnId) || (comp.homeAway === "home" ? part.id_equipo_local : part.id_equipo_visitante);
    const rosterRef = comp.roster?.$ref; if (!rosterRef) continue;
    let roster: any;
    try { roster = await j(rosterRef); } catch { continue; }

    for (const e of roster.entries || []) {
      if (e.didNotPlay) continue;
      const playerId = String(e.playerId || "");
      const bdJug = byEspnId.get(playerId);
      if (!bdJug) { rep.sin_match.push({ playerId, displayName: e.displayName || "" }); continue; }

      const statsRef = e.statistics?.$ref; if (!statsRef) continue;
      let stats: any;
      try { stats = await j(statsRef); } catch { continue; }
      const cats = stats?.splits?.categories || [];

      filas.push({
        id_partido: part.id, id_jugadora: bdJug.id_jugadora, id_equipo: teamBd,
        nombre: bdJug.nombre, dorsal: String(e.jersey || ""), titular: !!e.starter,
        minutos: String(getStat(cats,"minutes")), puntos: getStat(cats,"points"),
        tc_anotados: getStat(cats,"fieldGoalsMade"), tc_intentados: getStat(cats,"fieldGoalsAttempted"),
        t3_anotados: getStat(cats,"threePointFieldGoalsMade"), t3_intentados: getStat(cats,"threePointFieldGoalsAttempted"),
        tl_anotados: getStat(cats,"freeThrowsMade"), tl_intentados: getStat(cats,"freeThrowsAttempted"),
        reb_ofensivos: getStat(cats,"offensiveRebounds"), reb_defensivos: getStat(cats,"defensiveRebounds"), reb_totales: getStat(cats,"rebounds"),
        asistencias: getStat(cats,"assists"), robos: getStat(cats,"steals"), tapones: getStat(cats,"blocks"),
        perdidas: getStat(cats,"turnovers"), faltas: getStat(cats,"fouls"), valoracion: 0,
      });
    }
  }

  if (filas.length > 0) {
    const { error } = await sb.from("partido_boxscore").upsert(filas, { onConflict: "id_partido,id_jugadora" });
    if (error) rep.errores.push(error.message);
    else rep.upserted = filas.length;
  }

  rep.sin_match = rep.sin_match.slice(0, 20);
  return jr({ ok: true, ...rep });
});
