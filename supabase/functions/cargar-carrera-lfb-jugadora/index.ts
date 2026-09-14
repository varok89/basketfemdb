// cargar-carrera-lfb-jugadora v2
// Scrapea basketlfb.com match-par-match de una jugadora en una temporada.
// Procesa 3 ligas segun la columna "Ligue" de cada fila:
//   LBWL / LBWL PD  → L007 (LBWL Francia)
//   LF2  / LF2 PO   → L022 (Ligue 2)
//   CdF-F           → L098 (Copa de Francia)
// Ignora Europa (EU-1/EU-2).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FC_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Params = z.object({
  id_jugadora: z.string().regex(/^J\d+$/, "id_jugadora debe tener formato J###"),
  temporada:   z.string().regex(/^\d{4}-\d{2}$/, "temporada debe tener formato YYYY-YY"),
  id_liga:     z.enum(["L007", "L022", "L098"]).optional().default("L007"),
  dry:         z.boolean().optional().default(true),
}).strict();

const slugify = (s: string) => (s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const parseRatio = (s: string) => {
  const p = String(s || "").split("-");
  return { a: parseInt(p[0]) || 0, i: parseInt(p[1]) || 0 };
};

const rxMatchId = /\/match\/(\d+)-/;
const rxTeamId  = /\/equipe\/(\d+)-/;

function classifyLigue(ligue: string): { id_liga: string; tipo: string } | null {
  const l = (ligue || "").trim();
  if (l === "LBWL")     return { id_liga: "L007", tipo: "regular" };
  if (l === "LBWL PD")  return { id_liga: "L007", tipo: "playoffs" };
  if (l === "LF2")      return { id_liga: "L022", tipo: "regular" };
  if (l === "LF2 PO" || l === "LF2 PD") return { id_liga: "L022", tipo: "playoffs" };
  if (l === "CdF-F")    return { id_liga: "L098", tipo: "copa" };
  return null;
}

function parseMd(md: string): any[] {
  const out: any[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((s) => s.trim());
    if (cells.length < 20) continue;
    const journee = cells[1];
    if (!/^\d/.test(journee)) continue;

    const advCell = cells[2];
    const isAway = /@/.test(advCell);
    const isHome = /\bvs\b/.test(advCell);
    if (!isAway && !isHome) continue;
    const mTeam = advCell.match(rxTeamId);
    if (!mTeam) continue;
    const rivalLfb = mTeam[1];

    const ligueCell = cells[3];
    const cls = classifyLigue(ligueCell);
    if (!cls) continue;

    const scoreCell = cells[4];
    const mMatch = scoreCell.match(rxMatchId);
    if (!mMatch) continue;
    const gid = mMatch[1];
    const mScore = scoreCell.match(/\[(\d+)-(\d+)\]/);
    if (!mScore) continue;
    const scoreH = parseInt(mScore[1]);
    const scoreA = parseInt(mScore[2]);

    out.push({
      id_liga: cls.id_liga, tipo: cls.tipo,
      journee, rival_lfb: rivalLfb, is_home: isHome,
      ligue: ligueCell, score_home: scoreH, score_away: scoreA, gid,
      min: parseInt(cells[5]) || 0,
      pts: parseInt(cells[6]) || 0,
      reb: parseInt(cells[7]) || 0,
      ast: parseInt(cells[8]) || 0,
      t2: parseRatio(cells[9]),
      t3: parseRatio(cells[10]),
      tl: parseRatio(cells[12]),
      ro: parseInt(cells[14]) || 0,
      rd: parseInt(cells[15]) || 0,
      robos: parseInt(cells[16]) || 0,
      perdidas: parseInt(cells[17]) || 0,
      tapones: parseInt(cells[18]) || 0,
      val: parseInt(cells[19]) || 0,
    });
  }
  const seen = new Set<string>();
  return out.filter((f) => { if (seen.has(f.gid)) return false; seen.add(f.gid); return true; });
}

async function scrapeMd(url: string): Promise<string> {
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FC_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, maxAge: 3600000 }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Firecrawl HTTP ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const md = j?.data?.markdown || j?.markdown;
  if (!md) throw new Error("Firecrawl no devolvió markdown");
  return md;
}

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
  const { id_jugadora, temporada, id_liga, dry } = parsed.data;

  const { data: jug } = await sb.from("jugadoras")
    .select("id_jugadora,nombre,id_lfb").eq("id_jugadora", id_jugadora).single();
  if (!jug) return jr({ ok: false, error: "Jugadora no encontrada" }, 404);
  if (!jug.id_lfb) return jr({ ok: false, error: "Jugadora sin id_lfb — puebla jugadoras.id_lfb primero" }, 400);

  const { data: tmp } = await sb.from("temporadas")
    .select("id_equipo").eq("id_jugadora", id_jugadora).eq("id_liga", id_liga).eq("temporada", temporada).maybeSingle();
  if (!tmp?.id_equipo) return jr({ ok: false, error: `No hay temporadas para ${id_jugadora} en ${id_liga} ${temporada}` }, 400);
  const myEq: string = tmp.id_equipo;

  const { data: eqAll } = await sb.from("equipos")
    .select("id_equipo,id_lfb").not("id_lfb", "is", null).limit(2000);
  const eqByLfb = new Map<string, string>((eqAll || []).map((e: any) => [String(e.id_lfb), e.id_equipo]));

  const yearIni = parseInt(temporada.split("-")[0]);
  const slug = slugify(jug.nombre);
  const url = `https://basketlfb.com/laboulangerewonderligue/saison-reguliere/joueur/match-par-match/${jug.id_lfb}-${slug}/${yearIni}`;

  let md: string;
  try { md = await scrapeMd(url); } catch (e) {
    return jr({ ok: false, error: `Firecrawl falló: ${String(e)}`, url }, 502);
  }
  const filasAll = parseMd(md);
  const filas = filasAll.filter((f) => f.id_liga === id_liga);
  if (!filas.length) return jr({
    ok: false, error: `No se encontraron partidos de ${id_liga} en la ficha`,
    url, md_preview: md.slice(0, 400),
    filas_total_ficha: filasAll.length,
    ligas_encontradas: [...new Set(filasAll.map((f) => f.ligue))],
  }, 404);

  const gids = [...new Set(filas.map((f) => `lfb:${f.gid}`))];
  const { data: existing } = await sb.from("partidos")
    .select("id,id_ext").eq("id_liga", id_liga).eq("temporada", temporada).in("id_ext", gids);
  const partidoByExt = new Map<string, number>((existing || []).map((p: any) => [String(p.id_ext), p.id]));

  const rep: any = {
    ok: true, dry, jugadora: jug.nombre, id_lfb: jug.id_lfb, temporada, id_liga, url,
    filas_totales: filas.length,
    filas_ficha_todas: filasAll.length,
    ligas_encontradas_en_ficha: [...new Set(filasAll.map((f) => f.ligue))],
    creados: 0, existian: 0, boxscores: 0, sin_rival: [] as string[],
    detalle: [] as any[],
  };

  for (const f of filas) {
    const rivalEq = eqByLfb.get(f.rival_lfb);
    if (!rivalEq) { rep.sin_rival.push(`${f.gid} rival_lfb=${f.rival_lfb}`); continue; }

    const localEq = f.is_home ? myEq : rivalEq;
    const visEq   = f.is_home ? rivalEq : myEq;
    const notas = f.tipo === "playoffs" ? `Playoffs · J${f.journee}` :
                  f.tipo === "copa"     ? `Copa · J${f.journee}` :
                                          `Fase regular · J${f.journee}`;

    const idExt = `lfb:${f.gid}`;
    let idPartido = partidoByExt.get(idExt);
    if (idPartido) rep.existian++;
    else {
      rep.creados++;
      if (!dry) {
        const { data: ins } = await sb.from("partidos").insert({
          id_liga, temporada,
          id_equipo_local: localEq, id_equipo_visitante: visEq,
          resultado_local: f.score_home, resultado_visitante: f.score_away,
          id_ext: idExt, fuente: "lfb", notas,
        }).select("id").single();
        if (ins?.id) { idPartido = ins.id; partidoByExt.set(idExt, idPartido); }
      }
    }

    rep.boxscores++;
    if (!dry && idPartido) {
      await sb.from("partido_boxscore").upsert({
        id_partido: idPartido, id_jugadora, id_equipo: myEq,
        nombre: jug.nombre, dorsal: "", titular: false,
        minutos: String(f.min), puntos: f.pts,
        tc_anotados: f.t2.a + f.t3.a, tc_intentados: f.t2.i + f.t3.i,
        t3_anotados: f.t3.a, t3_intentados: f.t3.i,
        tl_anotados: f.tl.a, tl_intentados: f.tl.i,
        reb_ofensivos: f.ro, reb_defensivos: f.rd, reb_totales: f.ro + f.rd,
        asistencias: f.ast, robos: f.robos, tapones: f.tapones,
        perdidas: f.perdidas, faltas: 0, valoracion: f.val,
      }, { onConflict: "id_partido,id_jugadora" });
    }

    if (rep.detalle.length < 40) {
      rep.detalle.push({
        gid: f.gid, tipo: f.tipo, journee: f.journee,
        rival_lfb: f.rival_lfb, rival_eq: rivalEq, is_home: f.is_home,
        marcador: `${f.score_home}-${f.score_away}`,
        min: f.min, pts: f.pts, reb: f.ro + f.rd, ast: f.ast, val: f.val,
      });
    }
  }

  return jr(rep);
});
