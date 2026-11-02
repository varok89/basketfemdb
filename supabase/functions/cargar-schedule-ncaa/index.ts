// cargar-schedule-ncaa v3
// v3: solo escribir resultado si state === 'post'. Antes escribia score 0-0
//   para partidos PRE-GAME (ESPN scoreboard devuelve "0" string para no
//   empezados), lo que luego impedia que actualizar-resultados-ncaa los
//   recogiera en catchup (filtra por resultado_local IS NULL). 5321 partidos
//   quedaron congelados en 0-0.
// v2: paginar temporadas L020 (hay >11k filas) para construir ncaaSet completo.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const UA = { "User-Agent": "Mozilla/5.0" };
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball";

const Params = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), temporada: z.string().regex(/^\d{4}-\d{2}$/).optional(), dry: z.boolean().optional() }).strict();

async function fetchAllTempsL020() {
  const set = new Set();
  let from = 0; const SIZE = 1000;
  while (true) {
    const { data } = await sb.from("temporadas").select("id_equipo").eq("id_liga", "L020").range(from, from + SIZE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) set.add(r.id_equipo);
    if (data.length < SIZE) break;
    from += SIZE;
  }
  return set;
}

function* daysBetween(from, to) {
  const d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (d <= end) {
    yield `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}${String(d.getUTCDate()).padStart(2,"0")}`;
    d.setUTCDate(d.getUTCDate() + 1);
  }
}
function temporadaDe(fecha) { const d = new Date(fecha); const y = d.getUTCFullYear(); const m = d.getUTCMonth()+1; if (m >= 8) return `${y}-${String((y+1)%100).padStart(2,"0")}`; return `${y-1}-${String(y%100).padStart(2,"0")}`; }
async function fetchScoreboard(date) { const r = await fetch(`${ESPN}/scoreboard?dates=${date}&groups=50&limit=400`, { headers: UA, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(`ESPN scoreboard ${date}: ${r.status}`); return r.json(); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jr = (b, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  let body = {}; try { body = await req.json(); } catch {}
  const parsed = Params.safeParse(body);
  if (!parsed.success) return jr({ ok: false, error: "Params invalidos", detalles: parsed.error.issues }, 400);
  const { from, to, dry } = parsed.data;
  const forceTemp = parsed.data.temporada;

  const ncaaSet = await fetchAllTempsL020();
  const { data: eqAll } = await sb.from("equipos").select("id_equipo,id_espn").not("id_espn", "is", null);
  const eqByEspn = new Map();
  for (const e of eqAll || []) if (ncaaSet.has(e.id_equipo)) eqByEspn.set(String(e.id_espn), e.id_equipo);

  const yaExt = new Set();
  let offExt = 0;
  while (true) {
    const { data } = await sb.from("partidos").select("id_ext").eq("id_liga", "L020").not("id_ext", "is", null).range(offExt, offExt + 999);
    if (!data || !data.length) break;
    for (const p of data) yaExt.add(String(p.id_ext));
    if (data.length < 1000) break;
    offExt += 1000;
  }

  const rep = { rango: `${from} -> ${to}`, dias: 0, eventos_vistos: 0, insertados: 0, actualizados: 0, duplicados: 0, sin_mapear_local: 0, sin_mapear_visit: 0, sin_mapear_detalle: [], equipos_mapeados: eqByEspn.size, ncaa_set_size: ncaaSet.size, dry: !!dry };

  for (const date of daysBetween(from, to)) {
    rep.dias++;
    let sb_data;
    try { sb_data = await fetchScoreboard(date); } catch (e) { rep.sin_mapear_detalle.push(`FETCH ${date}: ${e}`); continue; }
    const events = sb_data.events || [];
    for (const ev of events) {
      rep.eventos_vistos++;
      const gid = String(ev.id);
      const comp = (ev.competitions || [])[0] || {};
      const comps = comp.competitors || [];
      // v3: solo escribir score si el partido esta terminado (state=post).
      // Para 'pre' (futuro) y 'in' (live) dejamos NULL — live lo gestiona
      // actualizar-resultados-ncaa en ventana [-30min,+4h].
      const state = comp.status?.type?.state || ev.status?.type?.state || null;
      const esPost = state === "post";
      let espnLocal = "", espnVisit = "", scoreL = null, scoreV = null;
      for (const c of comps) {
        const tid = String(c.team?.id || "");
        const sc = esPost && c.score != null ? parseInt(c.score) : null;
        if (c.homeAway === "home") { espnLocal = tid; scoreL = sc; } else { espnVisit = tid; scoreV = sc; }
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
        if (!dry && esPost) {
          const upd: any = {};
          if (scoreL != null) upd.resultado_local = scoreL;
          if (scoreV != null) upd.resultado_visitante = scoreV;
          if (Object.keys(upd).length) { await sb.from("partidos").update(upd).eq("id_liga", "L020").eq("id_ext", gid); rep.actualizados++; }
        }
        continue;
      }

      if (!dry) {
        const row: any = { id_liga: "L020", temporada, id_equipo_local: idLocal, id_equipo_visitante: idVisit, fecha_hora: fecha, id_ext: gid, fuente: "espn" };
        if (esPost) { row.resultado_local = scoreL; row.resultado_visitante = scoreV; }
        const { error } = await sb.from("partidos").insert(row);
        if (!error) { rep.insertados++; yaExt.add(gid); }
      } else { rep.insertados++; }
    }
  }
  rep.sin_mapear_detalle = rep.sin_mapear_detalle.slice(0, 30);
  return jr({ ok: true, ...rep });
});
