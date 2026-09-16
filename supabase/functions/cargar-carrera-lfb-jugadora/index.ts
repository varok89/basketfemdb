// cargar-carrera-lfb-jugadora v3
// API igual que cargar-carrera-espn-jugadora: {id_jugadora, dry, discover, id_ligas?, temporada?}.
// Fetch directo a basketlfb.com (sin Firecrawl). Con discover:true y sin
// `temporada`, barre anios 2014..currentYear en paralelo, se queda con los
// que devuelven filas, mapea cada fila a su liga (L007/L022/L098) segun la
// columna "Ligue" y crea filas en `temporadas` que falten (inferiendo el
// equipo propio como el id_lfb mas frecuente en los links /equipe/N del HTML
// de ese anio).
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
type IdLiga = typeof LIGAS_SOPORTADAS[number];

const Params = z.object({
  id_jugadora: z.string().regex(/^J\d+$/, "id_jugadora debe tener formato J###"),
  dry:         z.boolean().optional().default(true),
  discover:    z.boolean().optional().default(false),
  id_ligas:    z.array(z.enum(LIGAS_SOPORTADAS)).nonempty().optional(),
  temporada:   z.string().regex(/^\d{4}-\d{2}$/).optional(),
  year_from:   z.number().int().min(2000).max(2100).optional().default(2014),
  year_to:     z.number().int().min(2000).max(2100).optional(),
  preview:     z.boolean().optional().default(false),
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
const rxTeamId  = /\/equipe\/(\d+)-/g;

function classifyLigue(ligue: string): { id_liga: IdLiga; tipo: string } | null {
  const l = (ligue || "").trim();
  if (l === "LBWL")     return { id_liga: "L007", tipo: "regular" };
  if (l === "LBWL PD")  return { id_liga: "L007", tipo: "playoffs" };
  if (l === "LF2")      return { id_liga: "L022", tipo: "regular" };
  if (l === "LF2 PO" || l === "LF2 PD") return { id_liga: "L022", tipo: "playoffs" };
  if (l === "CdF-F")    return { id_liga: "L098", tipo: "copa" };
  return null;
}

function yearToTemp(y: number): string {
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}
function tempToYear(t: string): number {
  return parseInt(t.split("-")[0]) || 0;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

interface FilaBox {
  id_liga: IdLiga; tipo: string;
  journee: string; rival_lfb: string; is_home: boolean;
  ligue: string; score_home: number; score_away: number; gid: string;
  min: number; pts: number; reb: number; ast: number;
  t2: { a: number; i: number }; t3: { a: number; i: number }; tl: { a: number; i: number };
  ro: number; rd: number; robos: number; perdidas: number; tapones: number; val: number;
}

// Parser markdown (formato Firecrawl legacy).
function parseMd(md: string): FilaBox[] {
  const out: FilaBox[] = [];
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
    rxTeamId.lastIndex = 0;
    const mTeam = rxTeamId.exec(advCell);
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
    out.push({
      id_liga: cls.id_liga, tipo: cls.tipo,
      journee, rival_lfb: rivalLfb, is_home: isHome,
      ligue: ligueCell,
      score_home: parseInt(mScore[1]), score_away: parseInt(mScore[2]), gid,
      min: parseInt(cells[5]) || 0, pts: parseInt(cells[6]) || 0,
      reb: parseInt(cells[7]) || 0, ast: parseInt(cells[8]) || 0,
      t2: parseRatio(cells[9]), t3: parseRatio(cells[10]), tl: parseRatio(cells[12]),
      ro: parseInt(cells[14]) || 0, rd: parseInt(cells[15]) || 0,
      robos: parseInt(cells[16]) || 0, perdidas: parseInt(cells[17]) || 0,
      tapones: parseInt(cells[18]) || 0, val: parseInt(cells[19]) || 0,
    });
  }
  return dedupGid(out);
}

// Parser HTML server-side: cada partido es un <tr> con <td>s.
function parseHtml(html: string): FilaBox[] {
  const out: FilaBox[] = [];
  const rxTr = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const rxTd = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  let mtr: RegExpExecArray | null;
  while ((mtr = rxTr.exec(html)) !== null) {
    const inner = mtr[1];
    const cellsRaw: string[] = [];
    let mtd: RegExpExecArray | null;
    rxTd.lastIndex = 0;
    while ((mtd = rxTd.exec(inner)) !== null) cellsRaw.push(mtd[1]);
    if (cellsRaw.length < 18) continue;

    const journee = stripTags(cellsRaw[0]);
    if (!/^\d/.test(journee)) continue;

    const advCell = cellsRaw[1];
    const advText = stripTags(advCell);
    const isAway = /@/.test(advText);
    const isHome = /\bvs\b/i.test(advText) || (!isAway && /\S/.test(advText));
    rxTeamId.lastIndex = 0;
    const mTeam = rxTeamId.exec(advCell);
    if (!mTeam) continue;
    const rivalLfb = mTeam[1];

    const ligueCell = stripTags(cellsRaw[2]);
    const cls = classifyLigue(ligueCell);
    if (!cls) continue;

    const scoreCell = cellsRaw[3];
    const mMatch = scoreCell.match(rxMatchId);
    if (!mMatch) continue;
    const scoreText = stripTags(scoreCell);
    const mScore = scoreText.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!mScore) continue;

    const c = cellsRaw.map(stripTags);
    out.push({
      id_liga: cls.id_liga, tipo: cls.tipo,
      journee, rival_lfb: rivalLfb, is_home: isHome,
      ligue: ligueCell,
      score_home: parseInt(mScore[1]), score_away: parseInt(mScore[2]), gid: mMatch[1],
      min: parseInt(c[4]) || 0, pts: parseInt(c[5]) || 0,
      reb: parseInt(c[6]) || 0, ast: parseInt(c[7]) || 0,
      t2: parseRatio(c[8]), t3: parseRatio(c[9]), tl: parseRatio(c[11]),
      ro: parseInt(c[13]) || 0, rd: parseInt(c[14]) || 0,
      robos: parseInt(c[15]) || 0, perdidas: parseInt(c[16]) || 0,
      tapones: parseInt(c[17]) || 0, val: parseInt(c[18]) || 0,
    });
  }
  return dedupGid(out);
}

function dedupGid(rows: FilaBox[]): FilaBox[] {
  const seen = new Set<string>();
  return rows.filter((f) => { if (seen.has(f.gid)) return false; seen.add(f.gid); return true; });
}

async function fetchYear(idLfb: string, slug: string, year: number): Promise<{ ok: boolean; body: string; status: number }> {
  const url = `https://basketlfb.com/laboulangerewonderligue/saison-reguliere/joueur/match-par-match/${idLfb}-${slug}/${year}`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    return { ok: r.ok, body: await r.text(), status: r.status };
  } catch (e) {
    return { ok: false, body: `error: ${String(e)}`, status: 0 };
  }
}

function parseBody(body: string): FilaBox[] {
  if (/^\s*\|.*\|/m.test(body)) {
    const rows = parseMd(body);
    if (rows.length) return rows;
  }
  return parseHtml(body);
}

function inferMyTeam(body: string, rivalsLfb: Set<string>): string | null {
  const counts = new Map<string, number>();
  const rx = /\/equipe\/(\d+)-/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body)) !== null) {
    counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [id, _] of sorted) if (!rivalsLfb.has(id)) return id;
  return sorted[0]?.[0] ?? null;
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
  const { id_jugadora, dry, discover, temporada, preview } = parsed.data;
  const yearNow = new Date().getFullYear();
  const yearTo = parsed.data.year_to ?? yearNow;
  const yearFrom = parsed.data.year_from;
  const ligasReq: IdLiga[] = (parsed.data.id_ligas as IdLiga[] | undefined) ?? [...LIGAS_SOPORTADAS];

  const { data: jug } = await sb.from("jugadoras")
    .select("id_jugadora,nombre,id_lfb").eq("id_jugadora", id_jugadora).single();
  if (!jug) return jr({ ok: false, error: "Jugadora no encontrada" }, 404);
  if (!jug.id_lfb) return jr({ ok: false, error: "Jugadora sin id_lfb — puebla jugadoras.id_lfb primero" }, 400);

  const { data: eqAll } = await sb.from("equipos")
    .select("id_equipo,id_lfb").not("id_lfb", "is", null).limit(3000);
  const eqByLfb = new Map<string, string>((eqAll || []).map((e: any) => [String(e.id_lfb), e.id_equipo]));

  const { data: tempsExist } = await sb.from("temporadas")
    .select("id,id_equipo,id_liga,temporada")
    .eq("id_jugadora", id_jugadora).in("id_liga", ligasReq);
  const tempsBy = new Map<string, { id: number; id_equipo: string }>(
    (tempsExist || []).map((t: any) => [`${t.id_liga}|${t.temporada}`, { id: t.id, id_equipo: t.id_equipo }])
  );

  const years: number[] = [];
  if (temporada) years.push(tempToYear(temporada));
  else if (discover) for (let y = yearFrom; y <= yearTo; y++) years.push(y);
  else {
    const yset = new Set<number>();
    for (const t of tempsExist || []) yset.add(tempToYear((t as any).temporada));
    years.push(...yset);
  }

  const slug = slugify(jug.nombre);
  const rep: any = {
    ok: true, dry, discover, jugadora: jug.nombre, id_lfb: jug.id_lfb, slug,
    ligas: ligasReq, years_probados: years,
    total_partidos_creados: 0, total_boxscores: 0, total_temporadas_creadas: 0,
    por_liga: {} as Record<string, any>,
    sin_rival: [] as string[],
    preview: null as null | { year: number; status: number; body_head: string },
  };

  const results = await Promise.all(years.map((y) => fetchYear(jug.id_lfb!, slug, y).then((r) => ({ year: y, ...r }))));

  let maxTempId: number | null = null;

  for (const r of results) {
    if (!r.ok) continue;
    const filasAll = parseBody(r.body);
    if (!filasAll.length) {
      if (preview && !rep.preview) rep.preview = { year: r.year, status: r.status, body_head: r.body.slice(0, 2000) };
      continue;
    }
    if (preview && !rep.preview) rep.preview = { year: r.year, status: r.status, body_head: r.body.slice(0, 1200) };

    const rivals = new Set(filasAll.map((f) => f.rival_lfb));
    const myLfb = inferMyTeam(r.body, rivals);
    const myEq = myLfb ? eqByLfb.get(myLfb) : null;

    for (const idLiga of ligasReq) {
      const filas = filasAll.filter((f) => f.id_liga === idLiga);
      if (!filas.length) continue;

      const temp = yearToTemp(r.year);
      const key = `${idLiga}|${temp}`;
      let tempRow = tempsBy.get(key);

      if (!tempRow && (discover || temporada)) {
        if (!myEq) {
          if (!rep.por_liga[idLiga]) rep.por_liga[idLiga] = { years: [], por_year: {} };
          rep.por_liga[idLiga].por_year[r.year] = { skipped: "sin_mi_equipo_inferido", my_lfb: myLfb };
          continue;
        }
        if (maxTempId === null) {
          const { data: mx } = await sb.from("temporadas").select("id").order("id", { ascending: false }).limit(1);
          maxTempId = Number(mx?.[0]?.id) || 0;
        }
        maxTempId++;
        if (!dry) {
          await sb.from("temporadas").insert({
            id: maxTempId, id_jugadora, id_equipo: myEq, id_liga: idLiga, temporada: temp, orden: 0,
          });
        }
        tempRow = { id: maxTempId, id_equipo: myEq };
        tempsBy.set(key, tempRow);
        rep.total_temporadas_creadas++;
      }
      if (!tempRow) continue;

      const myEqFinal = tempRow.id_equipo;

      const gids = [...new Set(filas.map((f) => `lfb:${f.gid}`))];
      const { data: existing } = await sb.from("partidos")
        .select("id,id_ext").eq("id_liga", idLiga).eq("temporada", temp).in("id_ext", gids);
      const partidoByExt = new Map<string, number>((existing || []).map((p: any) => [String(p.id_ext), p.id]));

      if (!rep.por_liga[idLiga]) rep.por_liga[idLiga] = { years: [], por_year: {} };
      rep.por_liga[idLiga].years.push(r.year);

      let creados = 0, existian = 0, boxscores = 0, sinRival = 0;
      for (const f of filas) {
        const rivalEq = eqByLfb.get(f.rival_lfb);
        if (!rivalEq) {
          rep.sin_rival.push(`${r.year}·${f.gid}·rival_lfb=${f.rival_lfb}`);
          sinRival++; continue;
        }
        const localEq = f.is_home ? myEqFinal : rivalEq;
        const visEq   = f.is_home ? rivalEq  : myEqFinal;
        const notas = f.tipo === "playoffs" ? `Playoffs · J${f.journee}` :
                      f.tipo === "copa"     ? `Copa · J${f.journee}` :
                                              `Fase regular · J${f.journee}`;

        const idExt = `lfb:${f.gid}`;
        let idPartido = partidoByExt.get(idExt);
        if (idPartido) existian++;
        else {
          creados++;
          if (!dry) {
            const { data: ins } = await sb.from("partidos").insert({
              id_liga: idLiga, temporada: temp,
              id_equipo_local: localEq, id_equipo_visitante: visEq,
              resultado_local: f.score_home, resultado_visitante: f.score_away,
              id_ext: idExt, fuente: "lfb", notas,
            }).select("id").single();
            if (ins?.id) { idPartido = ins.id; partidoByExt.set(idExt, idPartido); }
          }
        }

        boxscores++;
        if (!dry && idPartido) {
          await sb.from("partido_boxscore").upsert({
            id_partido: idPartido, id_jugadora, id_equipo: myEqFinal,
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
      }
      rep.por_liga[idLiga].por_year[r.year] = {
        temporada: temp, my_equipo: myEqFinal, filas: filas.length,
        creados, existian, boxscores, sin_rival: sinRival,
      };
      rep.total_partidos_creados += creados;
      rep.total_boxscores += boxscores;
    }
  }

  rep.sin_rival = [...new Set(rep.sin_rival)].slice(0, 40);
  return jr(rep);
});
