// cargar-carrera-feb-jugadora v3
// Wrapper por-jugadora sobre cargar-boxscores-feb con save+override+restore
// del id_ext apoyado en temporadas.id_ext_feb (id historico por temporada).
//
// Validacion minima: la jugadora existe y tiene temporadas en (liga, temp).
// id_ext / fuente en jugadoras no son obligatorios (boxscores-feb matchea por
// nombre y aprende).
//
// Flujo por jugadora:
// 1) backup = jugadoras.id_ext (para restaurar cuando existe, protege live).
// 2) override = temporadas.id_ext_feb para (jug, liga, temp).
// 3) Si override && override != backup → SET jugadoras.id_ext = override.
// 4) Llama cargar-boxscores-feb con los pids pendientes.
// 5) Learn: si id_ext cambio y difiere de override → guarda en temporadas.id_ext_feb.
// 6) Restore:
//    - si backup != null → SET jugadoras.id_ext = backup (protege live).
//    - si backup == null → deja el aprendido (bootstrap live tracking).
// Ligas FEB: L001/L002/L003/L017/L074.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Params = z.object({
  id_jugadora: z.string().regex(/^J\d+$/, "id_jugadora debe tener formato J###"),
  temporada:   z.string().regex(/^\d{4}-\d{2}$/, "temporada debe tener formato YYYY-YY"),
  id_liga:     z.enum(["L001", "L002", "L003", "L017", "L074"]).optional().default("L001"),
  dry:         z.boolean().optional().default(true),
  force:       z.boolean().optional().default(false),
}).strict();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jr = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), {
    status: s, headers: { ...CORS, "Content-Type": "application/json" },
  });

  let body: any = {}; try { body = await req.json(); } catch {}
  const parsed = Params.safeParse(body);
  if (!parsed.success) {
    return jr({
      ok: false, error: "Params invalidos",
      detalles: parsed.error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
    }, 400);
  }
  const { id_jugadora, temporada, id_liga, dry, force } = parsed.data;

  const { data: jug } = await sb.from("jugadoras")
    .select("id_jugadora,nombre,id_ext,fuente").eq("id_jugadora", id_jugadora).single();
  if (!jug) return jr({ ok: false, error: "Jugadora no encontrada" }, 404);

  const { data: tmp } = await sb.from("temporadas")
    .select("id,id_equipo,id_ext_feb").eq("id_jugadora", id_jugadora).eq("id_liga", id_liga).eq("temporada", temporada).maybeSingle();
  if (!tmp?.id_equipo) {
    return jr({ ok: false, error: `No hay temporadas para ${id_jugadora} en ${id_liga} ${temporada}` }, 400);
  }
  const myEq: string = tmp.id_equipo;

  const { data: partidos } = await sb.from("partidos")
    .select("id,id_ext,fecha_hora")
    .eq("id_liga", id_liga).eq("temporada", temporada)
    .not("id_ext", "is", null)
    .or(`id_equipo_local.eq.${myEq},id_equipo_visitante.eq.${myEq}`);
  const total = partidos?.length || 0;

  const ids = (partidos || []).map((p: any) => p.id);
  let pendientes: any[] = partidos || [];
  if (!force && ids.length) {
    const { data: conBox } = await sb.from("partido_boxscore")
      .select("id_partido").eq("id_jugadora", id_jugadora).in("id_partido", ids);
    const conBoxSet = new Set((conBox || []).map((b: any) => b.id_partido));
    pendientes = (partidos || []).filter((p: any) => !conBoxSet.has(p.id));
  }

  const rep: any = {
    ok: true, dry, jugadora: jug.nombre, id_liga, temporada, equipo: myEq,
    partidos_totales: total,
    ya_con_boxscore: total - pendientes.length,
    pendientes: pendientes.length,
    total_boxscores: 0, total_partidos_creados: 0, total_temporadas_creadas: 0,
    id_ext_backup: jug.id_ext, id_ext_override: tmp.id_ext_feb || null,
    id_ext_final: jug.id_ext, id_ext_aprendido: null,
    detalle: [] as any[],
  };

  if (dry) {
    rep.detalle = pendientes.slice(0, 40).map((p: any) => ({ pid: String(p.id_ext), fecha: p.fecha_hora }));
    rep.total_boxscores = pendientes.length;
    return jr(rep);
  }

  if (!pendientes.length) return jr(rep);

  const backup: string | null = jug.id_ext || null;
  const override: string | null = tmp.id_ext_feb || null;

  if (override && override !== backup) {
    await sb.from("jugadoras").update({ id_ext: override, fuente: "feb" }).eq("id_jugadora", id_jugadora);
  }

  const chunks: string[][] = [];
  for (let i = 0; i < pendientes.length; i += 25) {
    chunks.push(pendientes.slice(i, i + 25).map((p: any) => String(p.id_ext)));
  }

  let procesados = 0, lineas = 0, incompletas = 0;
  for (const c of chunks) {
    try {
      const r = await fetch(`${SB_URL}/functions/v1/cargar-boxscores-feb`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SB_KEY}` },
        body: JSON.stringify({ id_liga, temporada, pids: c.join(","), force }),
        signal: AbortSignal.timeout(120000),
      });
      const j = await r.json();
      procesados += j.procesados || 0;
      lineas += j.lineas || 0;
      incompletas += j.actas_incompletas || 0;
      rep.detalle.push({ chunk: c.length, procesados: j.procesados, lineas: j.lineas, sin_mapear: (j.sin_mapear || []).length });
    } catch (e) {
      rep.detalle.push({ chunk: c.length, error: String(e) });
    }
  }
  rep.procesados = procesados;
  rep.lineas_totales = lineas;
  rep.actas_incompletas = incompletas;

  const { data: after } = await sb.from("jugadoras").select("id_ext").eq("id_jugadora", id_jugadora).single();
  const idNow: string | null = after?.id_ext || null;
  rep.id_ext_final = idNow;
  if (idNow && idNow !== override) {
    rep.id_ext_aprendido = idNow;
    await sb.from("temporadas").update({ id_ext_feb: idNow }).eq("id", tmp.id);
  } else if (override && idNow === override) {
    rep.id_ext_aprendido = override;
  }

  if (backup && idNow !== backup) {
    await sb.from("jugadoras").update({ id_ext: backup }).eq("id_jugadora", id_jugadora);
    rep.id_ext_final = backup;
  } else if (!backup && idNow) {
    rep.bootstrap_id_ext = true;
  }

  const { count } = await sb.from("partido_boxscore")
    .select("id_partido", { count: "exact", head: true })
    .eq("id_jugadora", id_jugadora).in("id_partido", ids);
  rep.total_boxscores = count || procesados;

  return jr(rep);
});
