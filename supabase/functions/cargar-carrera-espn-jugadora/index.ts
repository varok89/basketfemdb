// cargar-carrera-espn-jugadora v16
// + add_missing_teams: cuando true, resuelve equipos rivales que no están
//   mapeados (por id_espn o por nombre) o los crea nuevos en la BD, y añade
//   a la ligaWhitelist en tiempo real. Con eso desaparecen skippedWrongLiga
//   por equipos que faltan.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const ESPN = "https://site.web.api.espn.com/apis/common/v3/sports/basketball";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

const LIGAS: Record<string, { sport: string; tempToYear: (t: string) => number; yearToTemp: (y: number) => string }> = {
  L020: { sport: "womens-college-basketball", tempToYear: (t) => { const p=t.split("-"); return p.length===2?parseInt(p[0])+1:parseInt(p[0])||0; }, yearToTemp: (y) => `${y-1}-${String(y).slice(2)}` },
  L006: { sport: "wnba", tempToYear: (t) => parseInt(t)||0, yearToTemp: (y) => String(y) },
};

const Params = z.object({
  id_jugadora:        z.string().regex(/^J\d+$/),
  dry:                z.boolean().optional().default(true),
  discover:           z.boolean().optional().default(false),
  id_ligas:           z.array(z.string().regex(/^L\d+$/)).nonempty().optional(),
  add_missing_teams:  z.boolean().optional().default(false),
}).strict();

const parseRatio = (s: string) => { const p = (s||"").split("-"); return { a: parseInt(p[0])||0, i: parseInt(p[1])||0 }; };

async function fetchAllPaginated<T>(table: string, select: string, filter?: (q: any) => any): Promise<T[]> {
  const PAGE = 1000; let all: T[] = []; let from = 0;
  while (true) {
    let q: any = sb.from(table).select(select).range(from, from + PAGE - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    all = all.concat((data as T[]) || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function fetchGamelog(sport: string, id_espn: string, year?: number) {
  const url = `${ESPN}/${sport}/athletes/${id_espn}/gamelog${year?`?season=${year}`:""}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(String(r.status));
  return await r.json();
}

function isExhibition(ev: any): boolean {
  if (ev?.team?.isAllStar === true) return true;
  if (ev?.opponent?.isAllStar === true) return true;
  const note = String(ev?.eventNote || "");
  if (/all[- ]?star/i.test(note)) return true;
  if (/exhibition/i.test(note)) return true;
  return false;
}

function teamInfoFromEvent(ev: any, espnId: string): { id: string; displayName: string } | null {
  const cand = [ev?.team, ev?.opponent].filter(Boolean);
  for (const c of cand) if (String(c.id) === espnId) return { id: String(c.id), displayName: c.displayName || c.name || `Equipo ESPN ${espnId}` };
  return null;
}

async function nextEquipoId(): Promise<string> {
  const { data } = await sb.from("equipos").select("id_equipo").order("id_equipo", { ascending: false }).limit(1);
  const cur = data?.[0]?.id_equipo as string | undefined;
  const n = cur ? parseInt(cur.replace(/^E/i, "")) : 0;
  return "E" + String(n + 1).padStart(3, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jr = (b: any, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

  let body: any = {}; try { body = await req.json(); } catch {}
  const parsed = Params.safeParse(body);
  if (!parsed.success) return jr({ ok: false, error: "Params invalidos", detalles: parsed.error.issues.map(i => ({ campo: i.path.join("."), mensaje: i.message })) }, 400);
  const { id_jugadora: idJugadora, dry, discover, add_missing_teams } = parsed.data;
  const ligasReq: string[] = parsed.data.id_ligas ?? Object.keys(LIGAS);

  const ligasNoSoportadas = ligasReq.filter(l => !LIGAS[l]);
  if (ligasNoSoportadas.length) return jr({ ok: false, error: `Ligas no soportadas: ${ligasNoSoportadas.join(", ")}` }, 400);

  const { data: jug, error: jugErr } = await sb.from("jugadoras").select("id_jugadora,nombre,id_espn").eq("id_jugadora", idJugadora).maybeSingle();
  if (jugErr) return jr({ ok: false, motivo: "db_error", detalle: jugErr.message });
  if (!jug) return jr({ ok: false, motivo: "no_encontrada", id_jugadora: idJugadora });
  if (!jug.id_espn) return jr({ ok: false, motivo: "sin_id_espn", jugadora: jug.nombre });

  const { data: temps } = await sb.from("temporadas").select("temporada,id_equipo,id_liga").eq("id_jugadora", idJugadora).in("id_liga", ligasReq);

  const eqAll: any[] = await fetchAllPaginated("equipos", "id_equipo,nombre,id_espn", q => q.not("id_espn", "is", null));
  const espnByEq = new Map(eqAll.map((e: any) => [e.id_equipo, String(e.id_espn)]));

  const teamsInLiga: Record<string, Set<string>> = {};
  const eqByEspnPerLiga: Record<string, Map<string, string>> = {};
  for (const idLiga of ligasReq) {
    const rows: any[] = await fetchAllPaginated("temporadas", "id_equipo", q => q.eq("id_liga", idLiga));
    const teamIds = new Set<string>(rows.map((r: any) => r.id_equipo));
    const espnSet = new Set<string>();
    const localEqByEspn = new Map<string, string>();
    for (const e of eqAll) {
      if (!teamIds.has(e.id_equipo)) continue;
      const espn = String(e.id_espn);
      espnSet.add(espn);
      if (!localEqByEspn.has(espn)) localEqByEspn.set(espn, e.id_equipo);
    }
    teamsInLiga[idLiga] = espnSet;
    eqByEspnPerLiga[idLiga] = localEqByEspn;
  }

  const eqByName = new Map<string, { id_equipo: string; id_espn: string | null }>();
  for (const e of eqAll) eqByName.set(String(e.nombre || "").toLowerCase().trim(), { id_equipo: e.id_equipo, id_espn: String(e.id_espn) });
  {
    const noEspn: any[] = await fetchAllPaginated("equipos", "id_equipo,nombre,id_espn", q => q.is("id_espn", null));
    for (const e of noEspn) if (!eqByName.has(String(e.nombre||"").toLowerCase().trim())) eqByName.set(String(e.nombre||"").toLowerCase().trim(), { id_equipo: e.id_equipo, id_espn: null });
  }

  const teamAudit: any[] = [];
  async function resolveEspnTeam(idLiga: string, espnId: string, teamInfo: { id: string; displayName: string } | null): Promise<string | null> {
    const localMap = eqByEspnPerLiga[idLiga]!;
    const whitelist = teamsInLiga[idLiga]!;
    if (localMap.has(espnId)) return localMap.get(espnId)!;
    if (!add_missing_teams) return null;

    let bdEq = eqAll.find((e: any) => String(e.id_espn) === espnId);
    if (bdEq) {
      localMap.set(espnId, bdEq.id_equipo); whitelist.add(espnId);
      teamAudit.push({ liga: idLiga, action: "attach_existing_by_espn", espn: espnId, id_equipo: bdEq.id_equipo, nombre: bdEq.nombre });
      return bdEq.id_equipo;
    }
    const nombre = teamInfo?.displayName || `Equipo ESPN ${espnId}`;
    const key = nombre.toLowerCase().trim();
    const byName = eqByName.get(key);
    if (byName) {
      if (!byName.id_espn) {
        if (!dry) await sb.from("equipos").update({ id_espn: espnId }).eq("id_equipo", byName.id_equipo);
        byName.id_espn = espnId;
        localMap.set(espnId, byName.id_equipo); whitelist.add(espnId);
        espnByEq.set(byName.id_equipo, espnId);
        eqAll.push({ id_equipo: byName.id_equipo, nombre, id_espn: espnId });
        teamAudit.push({ liga: idLiga, action: "assign_espn_to_existing", espn: espnId, id_equipo: byName.id_equipo, nombre });
        return byName.id_equipo;
      } else if (byName.id_espn === espnId) {
        localMap.set(espnId, byName.id_equipo); whitelist.add(espnId);
        return byName.id_equipo;
      }
      teamAudit.push({ liga: idLiga, action: "conflict_name_existing", espn: espnId, id_equipo: byName.id_equipo, nombre, id_espn_existente: byName.id_espn });
      return null;
    }
    const nuevoId = await nextEquipoId();
    if (!dry) {
      const { error } = await sb.from("equipos").insert({ id_equipo: nuevoId, nombre, id_espn: espnId, tipo: "club" });
      if (error) { teamAudit.push({ liga: idLiga, action: "create_error", espn: espnId, nombre, error: error.message }); return null; }
    }
    localMap.set(espnId, nuevoId); whitelist.add(espnId);
    espnByEq.set(nuevoId, espnId);
    eqByName.set(key, { id_equipo: nuevoId, id_espn: espnId });
    eqAll.push({ id_equipo: nuevoId, nombre, id_espn: espnId });
    teamAudit.push({ liga: idLiga, action: "create_new", espn: espnId, id_equipo: nuevoId, nombre });
    return nuevoId;
  }

  const existing: any[] = await fetchAllPaginated("partidos", "id,id_ext,id_liga", q => q.not("id_ext", "is", null).in("id_liga", ligasReq));
  const partidoByExt = new Map(existing.map((p: any) => [`${p.id_liga}|${p.id_ext}`, p.id]));

  const rep: any = { dry, discover, add_missing_teams, jugadora: jug.nombre, id_espn: jug.id_espn, por_liga: {} };
  let totalCreados = 0, totalBox = 0, totalTemps = 0;
  let maxTempId: number | null = null;

  for (const idLiga of ligasReq) {
    const cfg = LIGAS[idLiga];
    const eqByEspn = eqByEspnPerLiga[idLiga] || new Map<string,string>();
    const tempsLiga = (temps || []).filter((t: any) => t.id_liga === idLiga);
    const teamsByYear = new Map<number, Array<{ id_equipo: string; espn: string }>>();
    for (const t of tempsLiga) {
      const y = cfg.tempToYear(t.temporada);
      const espn = espnByEq.get(t.id_equipo);
      if (!y || !espn) continue;
      if (!teamsByYear.has(y)) teamsByYear.set(y, []);
      const arr = teamsByYear.get(y)!;
      if (!arr.some(x => x.espn === espn)) arr.push({ id_equipo: t.id_equipo, espn });
    }

    let allYears = [...teamsByYear.keys()];
    let discoveredYears: number[] = [];
    if (discover) {
      try {
        const meta = await fetchGamelog(cfg.sport, jug.id_espn);
        const seasonOpts = meta.filters?.find((f: any) => f.name === "season" || f.name === "seasons")?.options || [];
        const espnYears = seasonOpts.map((o: any) => parseInt(o.value)).filter((y: number) => y > 2000);
        for (const y of espnYears) if (!teamsByYear.has(y)) discoveredYears.push(y);
      } catch (e) { rep.por_liga[idLiga] = { discover_error: String(e) }; }
    }
    const rLiga: any = { discovered_years: discoveredYears, temporadas_creadas: [], years: [], por_year: {}, sin_rival: [], sin_mi_equipo: [], skipped_exhibition: [], skipped_wrong_liga: [] };

    for (const year of discoveredYears) {
      let g: any; try { g = await fetchGamelog(cfg.sport, jug.id_espn, year); } catch { continue; }
      const events = g.events || {};
      const teamCounts = new Map<string, number>();
      for (const [, ev] of Object.entries(events) as [string, any][]) {
        if (isExhibition(ev)) continue;
        const tid = String(ev.team?.id || "");
        if (!tid) continue;
        if (!teamsInLiga[idLiga].has(tid) && !add_missing_teams) continue;
        teamCounts.set(tid, (teamCounts.get(tid) || 0) + 1);
      }
      const teamsInYear = [...teamCounts.entries()].sort((a,b) => b[1]-a[1]).map(([espn]) => espn);
      const resolved: { id_equipo: string; espn: string }[] = [];
      for (const espn of teamsInYear) {
        let teamInfo: any = null;
        for (const [, ev] of Object.entries(events) as [string, any][]) {
          teamInfo = teamInfoFromEvent(ev, espn);
          if (teamInfo) break;
        }
        const id_equipo = await resolveEspnTeam(idLiga, espn, teamInfo);
        if (id_equipo) resolved.push({ id_equipo, espn });
      }
      if (!resolved.length) continue;
      const temporada = cfg.yearToTemp(year);
      for (const r of resolved) {
        if (!teamsByYear.has(year)) teamsByYear.set(year, []);
        teamsByYear.get(year)!.push({ id_equipo: r.id_equipo, espn: r.espn });
        const { data: ex } = await sb.from("temporadas").select("id").eq("id_jugadora", idJugadora).eq("id_equipo", r.id_equipo).eq("id_liga", idLiga).eq("temporada", temporada).maybeSingle();
        if (!ex) {
          if (maxTempId === null) { const { data: mx } = await sb.from("temporadas").select("id").order("id", { ascending: false }).limit(1); maxTempId = Number(mx?.[0]?.id) || 0; }
          maxTempId++;
          if (!dry) await sb.from("temporadas").insert({ id: maxTempId, id_jugadora: idJugadora, id_equipo: r.id_equipo, id_liga: idLiga, temporada, orden: 0 });
          rLiga.temporadas_creadas.push({ id: maxTempId, temporada, id_equipo: r.id_equipo });
          totalTemps++;
        }
      }
      allYears.push(year);
    }
    allYears = [...new Set(allYears)].sort();
    rLiga.years = allYears;

    for (const year of allYears) {
      const myTeams = teamsByYear.get(year) || [];
      let g: any; try { g = await fetchGamelog(cfg.sport, jug.id_espn, year); } catch (e) { rLiga.por_year[year] = { error: String(e) }; continue; }

      const names: string[] = g.names || [];
      const IDX = { min: names.indexOf("minutes"), pts: names.indexOf("points"), reb: names.indexOf("totalRebounds"), ast: names.indexOf("assists"), stl: names.indexOf("steals"), blk: names.indexOf("blocks"), to: names.indexOf("turnovers"), fg: names.indexOf("fieldGoalsMade-fieldGoalsAttempted"), t3: names.indexOf("threePointFieldGoalsMade-threePointFieldGoalsAttempted"), ft: names.indexOf("freeThrowsMade-freeThrowsAttempted"), pf: names.indexOf("fouls") };

      const events = g.events || {};
      const okEvents = new Set<string>();
      const statsByEv = new Map<string, string[]>();
      for (const st of g.seasonTypes || []) {
        const isPre = /preseason/i.test(st.displayName || "") || /preseason/i.test(st.name || "");
        if (isPre) continue;
        for (const cat of st.categories || []) for (const ce of cat.events || []) {
          if (!ce.eventId) continue;
          okEvents.add(String(ce.eventId));
          if (Array.isArray(ce.stats)) statsByEv.set(String(ce.eventId), ce.stats);
        }
      }

      let created = 0, existed = 0, upserted = 0, skippedNoOpp = 0, skippedNoMe = 0, skippedPre = 0, skippedExh = 0, skippedWrongLiga = 0;
      for (const [gid, ev] of Object.entries(events) as [string, any][]) {
        if (!okEvents.has(gid)) { skippedPre++; continue; }
        if (isExhibition(ev)) { skippedExh++; rLiga.skipped_exhibition.push(`${gid}:${ev.eventNote||''}`); continue; }
        const homeId = String(ev.homeTeamId||"");
        const awayId = String(ev.awayTeamId||"");

        const homeMapped = await resolveEspnTeam(idLiga, homeId, teamInfoFromEvent(ev, homeId));
        const awayMapped = await resolveEspnTeam(idLiga, awayId, teamInfoFromEvent(ev, awayId));
        if (!homeMapped || !awayMapped) { skippedWrongLiga++; rLiga.skipped_wrong_liga.push(`${gid}:${homeId}/${awayId}`); continue; }

        const myEntry = myTeams.find(mt => mt.espn === homeId || mt.espn === awayId);
        if (!myEntry) { skippedNoMe++; rLiga.sin_mi_equipo.push(`${gid}(year=${year})`); continue; }

        const temporada = cfg.yearToTemp(year);
        const scoreH = ev.homeTeamScore != null ? Number(ev.homeTeamScore) : null;
        const scoreA = ev.awayTeamScore != null ? Number(ev.awayTeamScore) : null;

        let idPartido = partidoByExt.get(`${idLiga}|${gid}`);
        if (idPartido) existed++;
        else {
          created++;
          if (!dry) {
            const { data: ins } = await sb.from("partidos").insert({
              id_liga: idLiga, temporada,
              id_equipo_local: homeMapped, id_equipo_visitante: awayMapped,
              resultado_local: scoreH, resultado_visitante: scoreA,
              fecha_hora: ev.gameDate || null,
              id_ext: gid, fuente: "espn"
            }).select("id").single();
            if (ins?.id) { idPartido = ins.id; partidoByExt.set(`${idLiga}|${gid}`, idPartido); }
          }
        }

        const s = statsByEv.get(gid);
        if (!s) continue;
        const getN = (i: number) => i>=0 ? (parseInt(s[i])||0) : 0;
        const getS = (i: number) => i>=0 ? (s[i]||"0") : "0";
        const fg = parseRatio(getS(IDX.fg)), t3 = parseRatio(getS(IDX.t3)), ft = parseRatio(getS(IDX.ft));
        const reb = getN(IDX.reb);

        upserted++;
        if (!dry && idPartido) {
          await sb.from("partido_boxscore").upsert({
            id_partido: idPartido, id_jugadora: idJugadora, id_equipo: myEntry.id_equipo,
            nombre: jug.nombre, dorsal: "", titular: false,
            minutos: String(getN(IDX.min)), puntos: getN(IDX.pts),
            tc_anotados: fg.a, tc_intentados: fg.i,
            t3_anotados: t3.a, t3_intentados: t3.i,
            tl_anotados: ft.a, tl_intentados: ft.i,
            reb_ofensivos: 0, reb_defensivos: reb, reb_totales: reb,
            asistencias: getN(IDX.ast), robos: getN(IDX.stl), tapones: getN(IDX.blk),
            perdidas: getN(IDX.to), faltas: getN(IDX.pf), valoracion: 0
          }, { onConflict: "id_partido,id_jugadora" });
        }
      }
      rLiga.por_year[year] = { events: Object.keys(events).length, existed, created, upserted, skippedNoOpp, skippedNoMe, skippedPre, skippedExh, skippedWrongLiga };
      totalCreados += created; totalBox += upserted;
    }
    rLiga.sin_rival = [...new Set(rLiga.sin_rival)].slice(0, 30);
    rLiga.sin_mi_equipo = [...new Set(rLiga.sin_mi_equipo)].slice(0, 30);
    rLiga.skipped_exhibition = [...new Set(rLiga.skipped_exhibition)].slice(0, 30);
    rLiga.skipped_wrong_liga = [...new Set(rLiga.skipped_wrong_liga)].slice(0, 30);
    rep.por_liga[idLiga] = rLiga;
  }

  rep.total_partidos_creados = totalCreados;
  rep.total_boxscores = totalBox;
  rep.total_temporadas_creadas = totalTemps;
  rep.team_audit = teamAudit;
  return jr({ ok: true, ...rep });
});
