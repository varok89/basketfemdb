// actualizar-resultados-ncaa v2
// v2: catchup incluye tambien partidos con (resultado_local=0 AND
//   resultado_visitante=0). Antes solo cogia resultado_local IS NULL,
//   dejando congelados 5321 partidos que cargar-schedule-ncaa escribio
//   como 0-0 pre-game (bug resuelto en schedule v3, este amplia red
//   para corregir si vuelve a pasar).
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const UA = { "User-Agent": "Mozilla/5.0" };

async function fetchJson(url) { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error(String(r.status)); return r.json(); }
async function cargarBoxscore(idExt) { try { await fetch(`${SB_URL}/functions/v1/cargar-boxscore-ncaa`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SB_KEY}` }, body: JSON.stringify({ id_ext: idExt }), signal: AbortSignal.timeout(60000) }); } catch {} }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jr = (b, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

  const now = new Date();
  const desde = new Date(now.getTime() - 30*60*1000).toISOString();
  const hasta = new Date(now.getTime() + 4*3600*1000).toISOString();
  const catchupDesde = new Date(now.getTime() - 60*86400*1000).toISOString();

  const { data: candidatos1 } = await sb.from("partidos").select("id,id_ext,id_liga,es_live,periodo,resultado_local,resultado_visitante,fecha_hora").eq("id_liga", "L020").not("id_ext", "is", null).or(`es_live.eq.true,and(fecha_hora.gte.${desde},fecha_hora.lte.${hasta})`);
  // v2: ampliar catchup pasados a resultado_local IS NULL OR (0 AND 0)
  const { data: candidatos2 } = await sb.from("partidos").select("id,id_ext,id_liga,es_live,periodo,resultado_local,resultado_visitante,fecha_hora").eq("id_liga", "L020").not("id_ext", "is", null).or(`resultado_local.is.null,and(resultado_local.eq.0,resultado_visitante.eq.0)`).gte("fecha_hora", catchupDesde).lte("fecha_hora", desde);

  const map = new Map();
  for (const p of (candidatos1 || [])) map.set(p.id, p);
  for (const p of (candidatos2 || [])) if (!map.has(p.id)) map.set(p.id, p);
  const candidatos = [...map.values()];

  const rep = { candidatos: candidatos.length, ventana_live: candidatos1?.length || 0, catchup_pasados: candidatos2?.length || 0, actualizados: 0, live_ahora: 0, terminados: 0, boxscore_disparados: 0, catchup_boxscores: 0, sin_datos: [], cambios: [] };

  if (candidatos.length > 0) {
    const boxJobs = [];
    for (const p of candidatos) {
      const gid = p.id_ext;
      let ev;
      try { ev = await fetchJson(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/womens-college-basketball/events/${gid}`); }
      catch { rep.sin_datos.push(`${gid}:err`); continue; }
      const comp = (ev.competitions || [])[0] || {};
      let status = comp.status;
      if (status?.$ref && !status?.type) { try { status = await fetchJson(status.$ref); } catch {} }
      const state = status?.type?.state;
      const period = status?.period ?? null;
      if (!state || state === "pre") {
        // v2: si el partido está PRE pero en BD tiene 0-0 (bug viejo), limpiarlo.
        if (p.resultado_local === 0 && p.resultado_visitante === 0) {
          await sb.from("partidos").update({ resultado_local: null, resultado_visitante: null, es_live: false, periodo: null }).eq("id", p.id);
          rep.actualizados++;
          if (rep.cambios.length < 30) rep.cambios.push({ gid, state: "pre", clean: "0-0 → NULL" });
        }
        continue;
      }

      const comps = comp.competitors || [];
      let hs = null, asc = null;
      for (const c of comps) {
        try { const sref = c.score?.$ref; if (!sref) continue; const sd = await fetchJson(sref); const val = sd.value != null ? parseInt(sd.value) : null; if (c.homeAway === "home") hs = val; else asc = val; } catch {}
      }
      const es_live = state === "in";
      const finished = state === "post";
      const upd = {};
      if (hs != null && p.resultado_local !== hs) upd.resultado_local = hs;
      if (asc != null && p.resultado_visitante !== asc) upd.resultado_visitante = asc;
      if (p.es_live !== es_live) upd.es_live = es_live;
      const newPer = es_live ? period : null;
      if (p.periodo !== newPer) upd.periodo = newPer;
      if (finished && p.es_live) upd.es_live = false;
      if (Object.keys(upd).length > 0) {
        await sb.from("partidos").update(upd).eq("id", p.id);
        rep.actualizados++;
        if (rep.cambios.length < 30) rep.cambios.push({ gid, state, hs, asc, period });
      }
      if (es_live) rep.live_ahora++;
      if (finished) rep.terminados++;
      if (es_live || finished) { boxJobs.push(cargarBoxscore(gid)); rep.boxscore_disparados++; }
    }
    try { await Promise.race([Promise.all(boxJobs), new Promise(r=>setTimeout(r, 40000))]); } catch {}
  }

  const box7d = new Date(now.getTime() - 7*86400*1000).toISOString();
  const { data: candidatos3 } = await sb.from("partidos").select("id,id_ext,partido_boxscore(count)").eq("id_liga", "L020").not("id_ext", "is", null).not("resultado_local", "is", null).gte("fecha_hora", box7d).lte("fecha_hora", now.toISOString()).limit(50);
  const sinBox = (candidatos3 || []).filter((p) => (p.partido_boxscore?.[0]?.count ?? 0) === 0).slice(0, 5);
  rep.catchup_boxscores = sinBox.length;
  const boxJobs2 = [];
  for (const p of sinBox) boxJobs2.push(cargarBoxscore(p.id_ext));
  try { await Promise.race([Promise.all(boxJobs2), new Promise(r=>setTimeout(r, 15000))]); } catch {}

  return jr({ ok: true, ...rep });
});
