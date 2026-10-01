// actualizar-resultados-wnba v10
// v10: egress-gate. Ventana live reducida de ±30h a [-30min, +4h]. Antes
//   cada tick (3 min) hacía 3-4 fetches ESPN por candidato (~800KB/tick ×
//   480 ticks/día = ~380 MB/día = ~11 GB/mes en días con 8 partidos en
//   ventana ±30h). Ahora solo cuando el partido está realmente próximo.
// v9: 3ª ventana - boxscore catch-up. Detecta partidos ya cerrados
//   (resultado_local NOT NULL) en los últimos 7 días SIN filas en
//   partido_boxscore y dispara cargar-boxscore-wnba (cap 5 por tick).
//   Auto-cura cuando el score sí llegó pero el box se saldó.
// v8: ventana catch-up 60 días para partidos con resultado_local NULL.
import { createClient } from "jsr:@supabase/supabase-js@2";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const UA = { "User-Agent": "Mozilla/5.0" };

async function fetchJson(url: string) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function cargarBoxscore(idExt: string) {
  try {
    await fetch(`${SB_URL}/functions/v1/cargar-boxscore-wnba`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SB_KEY}` },
      body: JSON.stringify({ id_ext: idExt }),
      signal: AbortSignal.timeout(60000),
    });
  } catch { /* silent */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jr = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

  const now = new Date();
  // v10: ventana live estrecha. -30min captura partidos recién arrancados; +4h
  // cubre partidos próximos sin pedir basura. es_live=true sigue siendo
  // override para partidos activos aunque hayan empezado hace >4h (overtime).
  const desde = new Date(now.getTime() - 30*60*1000).toISOString();
  const hasta = new Date(now.getTime() + 4*3600*1000).toISOString();
  const catchupDesde = new Date(now.getTime() - 60*86400*1000).toISOString();

  // Ventana 1: live/próximos [-30min, +4h].
  const { data: candidatos1 } = await sb.from("partidos")
    .select("id,id_ext,id_liga,es_live,periodo,resultado_local,resultado_visitante,fecha_hora")
    .in("id_liga", ["L006","L109"])
    .not("id_ext", "is", null)
    .or(`es_live.eq.true,and(fecha_hora.gte.${desde},fecha_hora.lte.${hasta})`);

  // Ventana 2 (catch-up score): partidos pasados sin score final.
  const { data: candidatos2 } = await sb.from("partidos")
    .select("id,id_ext,id_liga,es_live,periodo,resultado_local,resultado_visitante,fecha_hora")
    .in("id_liga", ["L006","L109"])
    .not("id_ext", "is", null)
    .is("resultado_local", null)
    .gte("fecha_hora", catchupDesde)
    .lte("fecha_hora", desde);

  const map = new Map<number, any>();
  for (const p of (candidatos1 || [])) map.set(p.id, p);
  for (const p of (candidatos2 || [])) if (!map.has(p.id)) map.set(p.id, p);
  const candidatos = [...map.values()];

  const rep: any = {
    candidatos: candidatos.length,
    ventana_live: candidatos1?.length || 0,
    catchup_pasados: candidatos2?.length || 0,
    actualizados: 0, live_ahora: 0, terminados: 0, boxscore_disparados: 0,
    catchup_boxscores: 0, sin_datos: [], cambios: [],
  };

  // Si no hay nada en ventana ni live, salir sin tocar ESPN
  if (candidatos.length === 0) {
    return jr({ ok: true, skipped: true, ...rep });
  }

  const boxJobs: Promise<any>[] = [];
  for (const p of candidatos) {
    const gid = p.id_ext;
    let ev: any;
    try {
      ev = await fetchJson(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/wnba/events/${gid}`);
    } catch { rep.sin_datos.push(`${gid}:err`); continue; }

    const comp = (ev.competitions || [])[0] || {};
    let status: any = comp.status;
    if (status?.$ref && !status?.type) {
      try { status = await fetchJson(status.$ref); } catch { /* keep as is */ }
    }
    const state: string | undefined = status?.type?.state;
    const period = status?.period ?? null;
    if (!state || state === "pre") continue;

    const comps = comp.competitors || [];
    let hs: number | null = null, asc: number | null = null;
    for (const c of comps) {
      try {
        const sref = c.score?.$ref;
        if (!sref) continue;
        const sd = await fetchJson(sref);
        const val = sd.value != null ? parseInt(sd.value) : null;
        if (c.homeAway === "home") hs = val; else asc = val;
      } catch { /* skip */ }
    }

    const es_live = state === "in";
    const finished = state === "post";
    const upd: any = {};
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

    if (es_live || finished) {
      boxJobs.push(cargarBoxscore(gid));
      rep.boxscore_disparados++;
    }
  }

  // Ventana 3 (catch-up boxscore): partidos cerrados de los últimos 7 días
  // sin filas en partido_boxscore. Cap 5 por tick. Auto-cura casos como
  // Liberty vs Atlanta 24-09 donde el score sí llegó pero el box no.
  const box7d = new Date(now.getTime() - 7*86400*1000).toISOString();
  const { data: candidatos3 } = await sb.from("partidos")
    .select("id,id_ext,partido_boxscore(count)")
    .in("id_liga", ["L006","L109"])
    .not("id_ext", "is", null)
    .not("resultado_local", "is", null)
    .gte("fecha_hora", box7d)
    .lte("fecha_hora", now.toISOString())
    .limit(50);
  const sinBox = (candidatos3 || []).filter((p: any) => (p.partido_boxscore?.[0]?.count ?? 0) === 0).slice(0, 5);
  rep.catchup_boxscores = sinBox.length;
  for (const p of sinBox) {
    boxJobs.push(cargarBoxscore(p.id_ext));
  }

  try { await Promise.race([Promise.all(boxJobs), new Promise(r=>setTimeout(r, 55000))]); } catch {}

  return jr({ ok: true, ...rep });
});
