// cargar-schedule-ncaa v1
// Bulk de partidos NCAA D1 femenino (L020) desde el scoreboard de ESPN.
// Endpoint: /womens-college-basketball/scoreboard?dates=YYYYMMDD&groups=50&limit=400
// groups=50 = D1 completo.
// Params: { from: "YYYY-MM-DD", to: "YYYY-MM-DD", temporada?: "2026-27", dry?: bool }
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const UA = { "User-Agent": "Mozilla/5.0" };
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball";

const Params = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  temporada: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  dry: z.boolean().optional(),
}).strict();

function* daysBetween(from: string, to: string) {
  const d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (d <= end) {
    yield `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}${String(d.getUTCDate()).padStart(2,"0")}`;
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

function temporadaDe(fecha: string): string {
  // Temporada NCAA: ago-dic => yyyy-yy+1; ene-jul => yyyy-1-yy
  const d = new Date(fecha);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  if (m >= 8) return `${y}-${String((y+1)%100).padStart(2,"0")}`;
  return `${y-1}-${String(y%100).padStart(2,"0")}`;
}

async function fetchScoreboard(date: string): Promise<any> {
  const url = `${ESPN}/scoreboard?dates=${date}&groups=50&limit=400`;
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`ESPN scoreboard ${date}: ${r.status}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jr = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  let body: any = {}; try { body = await req.json(); } catch {}
  const parsed = Params.safeParse(body);
  if (!parsed.success) return jr({ ok: false, error: "Params invalidos", detalles: parsed.error.issues.map(i => ({ campo: i.path.join("."), mensaje: i.message })) }, 400);
  const { from, to, dry } = parsed.data;
  const forceTemp = parsed.data.temporada;

  const { data: tempsL020 } = await sb.from("temporadas").select("id_equipo").eq("id_liga", "L020");
  const ncaaSet = new Set((tempsL020 || []).map((r: any) => r.id_equipo));
  const { data: eqAll } = await sb.from("equipos").select("id_equipo,id_espn").not("id_espn", "is", null);
  const eqByEspn = new Map<string, string>();
  for (const e of eqAll || []) if (ncaaSet.has(e.id_equipo)) eqByEspn.set(String(e.id_espn), e.id_equipo);

  const { data: existentes } = await sb.from("partidos").select("id_ext").eq("id_liga", "L020").not("id_ext", "is", null);
  const yaExt = new Set((existentes || []).map((p: any) => String(p.id_ext)));

  const rep: any = {
    rango: `${from} -> ${to}`, dias: 0, eventos_vistos: 0,
    insertados: 0, actualizados: 0, duplicados: 0,
    sin_mapear_local: 0, sin_mapear_visit: 0,
    sin_mapear_detalle: [] as string[],
    dry: !!dry,
  };

  for (const date of daysBetween(from, to)) {
    rep.dias++;
    let sb_data: any;
    try { sb_data = await fetchScoreboard(date); } catch (e) { rep.sin_mapear_detalle.push(`FETCH ${date}: ${e}`); continue; }
    const events = sb_data.events || [];
    for (const ev of events) {
      rep.eventos_vistos++;
      const gid = String(ev.id);
      const comp = (ev.competitions || [])[0] || {};
      const comps = comp.competitors || [];
      let espnLocal = "", espnVisit = "", scoreL: number|null = null, scoreV: number|null = null;
      for (const c of comps) {
        const tid = String(c.team?.id || "");
        const sc = c.score != null ? parseInt(c.score) : null;
        if (c.homeAway === "home") { espnLocal = tid; scoreL = sc; }
        else { espnVisit = tid; scoreV = sc; }
      }
      const idLocal = eqByEspn.get(espnLocal);
      const idVisit = eqByEspn.get(espnVisit);
      if (!idLocal) { rep.sin_mapear_local++; if (rep.sin_mapear_detalle.length < 30) rep.sin_mapear_detalle.push(`LOCAL espn:${espnLocal} ${ev.name||gid}`); }
      if (!idVisit) { rep.sin_mapear_visit++; if (rep.sin_mapear_detalle.length < 30) rep.sin_mapear_detalle.push(`VISIT espn:${espnVisit} ${ev.name||gid}`); }
      if (!idLocal || !idVisit) continue;

      const fecha = ev.date || comp.date || null;
      const temporada = forceTemp || temporadaDe(fecha);

      if (yaExt.has(gid)) {
        rep.duplicados++;
        if (!dry) {
          const upd: any = {};
          if (scoreL != null) upd.resultado_local = scoreL;
          if (scoreV != null) upd.resultado_visitante = scoreV;
          if (Object.keys(upd).length) {
            await sb.from("partidos").update(upd).eq("id_liga", "L020").eq("id_ext", gid);
            rep.actualizados++;
          }
        }
        continue;
      }

      if (!dry) {
        const row: any = {
          id_liga: "L020", temporada,
          id_equipo_local: idLocal, id_equipo_visitante: idVisit,
          resultado_local: scoreL, resultado_visitante: scoreV,
          fecha_hora: fecha, id_ext: gid, fuente: "espn",
        };
        const { error } = await sb.from("partidos").insert(row);
        if (!error) { rep.insertados++; yaExt.add(gid); }
      } else {
        rep.insertados++;
      }
    }
  }

  rep.sin_mapear_detalle = rep.sin_mapear_detalle.slice(0, 30);
  return jr({ ok: true, ...rep });
});
