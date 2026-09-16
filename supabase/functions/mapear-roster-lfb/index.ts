// mapear-roster-lfb v1
// Analogo de mapear-roster-espn pero para LFB (L007/L022/L098).
// Scrapea basketlfb.com/.../equipe/{id_lfb}-{slug}/{year} y compara el roster
// oficial con lo que hay en BD (equipos, temporadas, jugadoras). Devuelve mismo
// shape que mapear-roster-espn para que CalidadModal lo consuma igual — las
// keys id_espn/espn_match/espn_total/etc. se reutilizan tal cual aunque
// internamente sean id_lfb (el modal ya las usaba asi para LFB).
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

const LIGAS_SOPORTADAS = ["L007", "L022", "L098"] as const;

const Params = z.object({
  id_equipo:       z.string().regex(/^E\d+$/, "id_equipo debe tener formato E###"),
  temporada:       z.string().regex(/^\d{4}-\d{2}$/, "temporada debe ser YYYY-YY"),
  id_liga:         z.enum(LIGAS_SOPORTADAS),
  dry:             z.boolean().optional().default(true),
  crear_faltantes: z.boolean().optional().default(false),
  preview:         z.boolean().optional().default(false),
}).strict();

const norm = (s: string) => (s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const slugify = (s: string) => (s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();

function tempToYear(t: string): number { return parseInt(t.split("-")[0]) || 0; }

async function fetchHtml(url: string) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "fr-FR,fr;q=0.9" },
    redirect: "follow", signal: AbortSignal.timeout(20000),
  });
  return { ok: r.ok, status: r.status, body: await r.text() };
}

// Limpia texto del anchor: LFB a veces mete altura ("1m76"), posición
// ("Poste : 3") y fecha ("17/05/06") pegadas al nombre. Corta ahí.
function cleanName(s: string): string {
  const cut = s.split(/\s+(?:\d+m\d+|Poste\s*:|\d{1,2}\/\d{1,2}\/\d{2,4})/i)[0];
  return cut.trim();
}

// Extrae { id_lfb, nombre } de <a href=".../joueur/{id}-slug/...">Nombre</a>.
// Deduplica por id_lfb, quedandose con el primer nombre no vacio.
function parseRoster(html: string): { id: string; nombre: string }[] {
  const seen = new Map<string, string>();
  const rxAnchor = /<a\b[^>]*href="[^"]*\/joueur\/(\d+)-[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = rxAnchor.exec(html)) !== null) {
    const id = m[1];
    const nombre = cleanName(stripTags(m[2]));
    if (!nombre || nombre.length < 2) continue;
    if (/^voir\b/i.test(nombre) || /^fiche\b/i.test(nombre)) continue;
    if (/^\d+$/.test(nombre)) continue;
    if (!seen.has(id)) seen.set(id, nombre);
  }
  return [...seen.entries()].map(([id, nombre]) => ({ id, nombre }));
}

async function nextJugadoraId(): Promise<string> {
  const { data } = await sb.from("jugadoras").select("id_jugadora").order("id_jugadora", { ascending: false }).limit(1);
  const cur = data?.[0]?.id_jugadora as string | undefined;
  const n = cur ? parseInt(cur.replace(/^J/i, "")) : 0;
  return "J" + (n + 1);
}
async function nextTemporadaId(): Promise<number> {
  const { data } = await sb.from("temporadas").select("id").order("id", { ascending: false }).limit(1);
  return Number(data?.[0]?.id || 0) + 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jr = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

  let body: any = {}; try { body = await req.json(); } catch {}
  const parsed = Params.safeParse(body);
  if (!parsed.success) return jr({ ok: false, error: "Params invalidos", detalles: parsed.error.issues.map(i => ({ campo: i.path.join("."), mensaje: i.message })) }, 400);
  const { id_equipo, temporada, id_liga, dry, crear_faltantes, preview } = parsed.data;

  const { data: eq } = await sb.from("equipos").select("id_equipo,nombre,id_lfb").eq("id_equipo", id_equipo).single();
  if (!eq) return jr({ ok: false, error: `Equipo ${id_equipo} no encontrado` }, 404);
  if (!eq.id_lfb) return jr({ ok: false, error: `Equipo ${id_equipo} sin id_lfb en BD` }, 400);

  const year = tempToYear(temporada);
  const slug = slugify(eq.nombre);
  const url = `https://basketlfb.com/laboulangerewonderligue/saison-reguliere/equipe/${eq.id_lfb}-${slug}/${year}`;

  let html: { ok: boolean; status: number; body: string };
  try { html = await fetchHtml(url); } catch (e) { return jr({ ok: false, error: `Fetch LFB: ${String(e)}`, url }, 502); }
  if (!html.ok) return jr({ ok: false, error: `HTTP ${html.status} en ${url}`, url, body_head: preview ? html.body.slice(0, 1500) : undefined }, 502);

  const lfbRoster = parseRoster(html.body);
  if (!lfbRoster.length) {
    return jr({ ok: true, equipo: eq.nombre, id_lfb_equipo: eq.id_lfb, url,
      fuente: "lfb_effectif", bd_total: 0, espn_total: 0, mapeados: 0, ya_con_espn: 0,
      sin_match_bd: [], solo_en_espn: [], solo_en_espn_obj: [], roster: [],
      creadas: [], adjuntadas: [], total_creadas: 0, total_adjuntadas: 0,
      warning: "roster vacio — revisa preview",
      preview: preview ? html.body.slice(0, 2000) : undefined,
    });
  }

  const { data: bdRows } = await sb.from("temporadas")
    .select("id_jugadora,jugadoras(id_jugadora,nombre,id_lfb,nacionalidad)")
    .eq("id_equipo", id_equipo).eq("id_liga", id_liga).eq("temporada", temporada);
  const bdRoster = (bdRows || []).map((r: any) => ({
    id_jugadora: r.id_jugadora,
    nombre: r.jugadoras?.nombre || "",
    id_espn: r.jugadoras?.id_lfb || null,
    nacionalidad: r.jugadoras?.nacionalidad || null,
  }));

  const lfbByName = new Map<string, { id: string; nombre: string }>();
  for (const a of lfbRoster) lfbByName.set(norm(a.nombre), a);

  const enriched = bdRoster.map(r => {
    const match = lfbByName.get(norm(r.nombre));
    return { ...r, espn_match: match || null, will_map: !r.id_espn && !!match };
  });

  let mapeados = 0;
  if (!dry) {
    for (const r of enriched) {
      if (r.will_map && r.espn_match) {
        await sb.from("jugadoras").update({ id_lfb: r.espn_match.id }).eq("id_jugadora", r.id_jugadora);
        mapeados++;
      }
    }
  } else mapeados = enriched.filter(r => r.will_map).length;

  const bdNames = new Set(bdRoster.map(r => norm(r.nombre)));
  const lfbIds = lfbRoster.map(a => a.id);
  const { data: exByLfb } = await sb.from("jugadoras").select("id_jugadora,nombre,id_lfb").in("id_lfb", lfbIds);
  const lfbIdToBd = new Map((exByLfb || []).map((j: any) => [String(j.id_lfb), j]));

  const lfbSoloExt = lfbRoster.filter(a => !bdNames.has(norm(a.nombre)));

  const creadas: any[] = [];
  const adjuntadas: any[] = [];
  if (crear_faltantes) {
    let nextJ = await nextJugadoraId();
    let nextT = await nextTemporadaId();
    for (const a of lfbSoloExt) {
      const existente: any = lfbIdToBd.get(a.id);
      let idJug: string;
      if (existente) {
        idJug = existente.id_jugadora;
        adjuntadas.push({ id_jugadora: idJug, nombre: existente.nombre });
      } else {
        idJug = nextJ; nextJ = "J" + (parseInt(nextJ.replace(/^J/, "")) + 1);
        if (!dry) {
          const { error } = await sb.from("jugadoras").insert({ id_jugadora: idJug, nombre: a.nombre, id_lfb: a.id });
          if (error) { creadas.push({ nombre: a.nombre, error: error.message }); continue; }
        }
        creadas.push({ id_jugadora: idJug, nombre: a.nombre, id_espn: a.id });
      }
      const { data: exT } = await sb.from("temporadas").select("id").eq("id_jugadora", idJug).eq("id_equipo", id_equipo).eq("id_liga", id_liga).eq("temporada", temporada).maybeSingle();
      if (exT) continue;
      if (!dry) {
        const { error } = await sb.from("temporadas").insert({ id: nextT, id_jugadora: idJug, id_equipo, id_liga, temporada, orden: 0 });
        if (error) { if (creadas.length) creadas[creadas.length - 1].temp_error = error.message; continue; }
        nextT++;
      }
    }
  }

  return jr({
    ok: true, dry, equipo: eq.nombre, id_lfb_equipo: eq.id_lfb, id_espn_equipo: eq.id_lfb, url,
    fuente: "lfb_effectif",
    bd_total: bdRoster.length, espn_total: lfbRoster.length,
    mapeados, ya_con_espn: bdRoster.filter(r => r.id_espn).length,
    sin_match_bd: enriched.filter(r => !r.espn_match && !r.id_espn).map(r => r.nombre),
    solo_en_espn: lfbSoloExt.map(a => `${a.nombre} (${a.id})`),
    solo_en_espn_obj: lfbSoloExt,
    roster: enriched,
    creadas, adjuntadas,
    total_creadas: creadas.length, total_adjuntadas: adjuntadas.length,
    preview: preview ? html.body.slice(0, 1500) : undefined,
  });
});
