// cargar-boxscores-fiba v40
// v40: distinguir "Primera Ronda" vs "Segunda Ronda" vs "Temporada regular" via
//   roundCode (RS-FR, RS-SR) o roundName. Antes v39 mapeaba todo "Regular Season"
//   a "Temporada regular" aunque el partido fuera RS-FR → quedaba inconsistente
//   con los existentes "Primera Ronda · Grupo X" generados por parseStandingsHtml
//   de actualizar-resultados-fiba.
// v39: dos fixes:
//   (a) notasDe mapea "Regular Season" / "Group Phase" (vía roundName) a
//       "Temporada regular · Grupo X" / "Fase de grupos · Grupo X" cuando
//       groupPairing es letra. Antes el fallback `rn = roundName` dejaba
//       "Regular Season" sin grupo, bloqueando el display por grupos en la UI.
//   (b) solo escribe parciales si la suma coincide con el total declarado por
//       FIBA. Antes: durante un descanso, FIBA publicaba Periods con Q3=Q4=0
//       todavía y el cron pisaba los parciales de la 1ª parte con [16,27,0,0]
//       dejando el partido sin stats del 2º tiempo tras terminar. Ahora si
//       suma(periods) != scoreTotal, mantenemos los parciales existentes.
// v38: en el update de partidos existentes (if ex), permitir pisar notas
//   cuando FIBA aporta grupo ("· Grupo X") y BD tiene algo genérico sin
//   grupo (p.ej. "Regular Season" vs "Temporada regular · Grupo J"). Antes:
//   solo escribía notas si BD estaba NULL → 72 partidos EuroCup se quedaron
//   con "Regular Season" y no podían clasificarse por grupo en la UI.
// v37: oidsSospechosos — orgs mapeados por fallback v35 (posición home/away) NO
//   generan `altasGame` (temporadas). Antes: si la 1ª pasada live caía en
//   fallback de posición y el orden FIBA venía invertido, las jugadoras del
//   equipo visitante se inscribían como roster del local (p.ej. 3 jugadoras
//   de MBK Ruzomberok acabaron en temporadas de Meins Avenida tras EuroCup
//   2026-10-14). Ahora el boxscore se escribe igual pero el auto-roster solo
//   se activa cuando el mapeo orgId → equipo es fiable (id_fiba match o
//   resultado match, no posición).
// v36: matcher GLOBAL restringido a EXACT full-name match único.
//   Motivo: v35 usaba subset + apellido-único sobre las ~25000 jugadoras de la
//   BD y generaba falsos positivos (p.ej. "Laura Gil" del boxscore de Lublin
//   se asignaba a J053 Laura Gil Collado de Jairis). Esas falsos positivos
//   además se auto-inscribían en el roster del equipo via `plantilla_altas`.
//   Ahora el global solo devuelve match si el nombre completo coincide EXACTO
//   (o revertido) y es único; cualquier otro caso se reporta como sin_mapear
//   para revisión manual en el editor de boxscore.
// v35: soft-fail. Antes: si aparecía 1 jugadora sin mapear o 1 colisión, se
//   saltaba el PARTIDO ENTERO (12 jugadoras) porque flag `problema` cortaba el
//   insert. Ahora se insertan las filas mapeadas y las conflictivas se reportan
//   en `sin_mapear` / `colisiones` para tratarlas a mano. Mejor mitad que nada.
// v34: eran v31 (parciales + boxscore desde /detail).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REST = `${SB_URL}/rest/v1`;
const HDRS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const SCRAPER_KEY = Deno.env.get("SCRAPERAPI_KEY") || "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const BROWSER = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "application/json,text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

const CC: Record<string, string> = {"espana":"es","spain":"es","france":"fr","francia":"fr","italy":"it","italia":"it","germany":"de","alemania":"de","portugal":"pt","netherlands":"nl","paises bajos":"nl","holanda":"nl","belgium":"be","belgica":"be","switzerland":"ch","suiza":"ch","austria":"at","sweden":"se","suecia":"se","norway":"no","noruega":"no","denmark":"dk","dinamarca":"dk","finland":"fi","finlandia":"fi","ireland":"ie","irlanda":"ie","iceland":"is","islandia":"is","united kingdom":"gb","reino unido":"gb","gran bretana":"gb","great britain":"gb","england":"gb","inglaterra":"gb","scotland":"gb","escocia":"gb","wales":"gb","gales":"gb","russia":"ru","rusia":"ru","ukraine":"ua","ucrania":"ua","poland":"pl","polonia":"pl","czech republic":"cz","czechia":"cz","republica checa":"cz","r checa":"cz","chequia":"cz","slovakia":"sk","eslovaquia":"sk","hungary":"hu","hungria":"hu","romania":"ro","rumania":"ro","bulgaria":"bg","serbia":"rs","croatia":"hr","croacia":"hr","slovenia":"si","eslovenia":"si","bosnia":"ba","bosnia y herzegovina":"ba","bosnia herzegovina":"ba","bosnia and herzegovina":"ba","montenegro":"me","albania":"al","north macedonia":"mk","macedonia del norte":"mk","macedonia":"mk","kosovo":"xk","greece":"gr","grecia":"gr","turkey":"tr","turkiye":"tr","turquia":"tr","georgia":"ge","armenia":"am","azerbaijan":"az","azerbaiyan":"az","azerbaidjan":"az","moldova":"md","moldavia":"md","belarus":"by","bielorrusia":"by","estonia":"ee","latvia":"lv","letonia":"lv","lithuania":"lt","lituania":"lt","luxembourg":"lu","luxemburgo":"lu","cyprus":"cy","chipre":"cy","malta":"mt","andorra":"ad","liechtenstein":"li","monaco":"mc","san marino":"sm","faroe islands":"fo","islas feroe":"fo","gibraltar":"gi","usa":"us","eeuu":"us","ee uu":"us","estados unidos":"us","united states":"us","canada":"ca","mexico":"mx","cuba":"cu","puerto rico":"pr","dominican republic":"do","republica dominicana":"do","haiti":"ht","jamaica":"jm","santa lucia":"lc","saint lucia":"lc","trinidad and tobago":"tt","trinidad y tobago":"tt","bahamas":"bs","barbados":"bb","costa rica":"cr","guatemala":"gt","honduras":"hn","el salvador":"sv","nicaragua":"ni","panama":"pa","dominica":"dm","guyana":"gy","brazil":"br","brasil":"br","argentina":"ar","colombia":"co","venezuela":"ve","peru":"pe","chile":"cl","ecuador":"ec","uruguay":"uy","bolivia":"bo","paraguay":"py","suriname":"sr","surinam":"sr","nigeria":"ng","niger":"ne","senegal":"sn","mali":"ml","cameroon":"cm","camerun":"cm","angola":"ao","mozambique":"mz","uganda":"ug","kenya":"ke","kenia":"ke","ethiopia":"et","etiopia":"et","ghana":"gh","antigua y barbuda":"ag","antigua and barbuda":"ag","guinea ecuatorial":"gq","equatorial guinea":"gq","sierra leona":"sl","sierra leone":"sl","ivory coast":"ci","costa de marfil":"ci","cote d ivoire":"ci","egypt":"eg","egipto":"eg","morocco":"ma","marruecos":"ma","algeria":"dz","argelia":"dz","tunisia":"tn","tunez":"tn","tunicia":"tn","south africa":"za","sudafrica":"za","tanzania":"tz","rwanda":"rw","congo":"cd","dr congo":"cd","republica democratica del congo":"cd","zambia":"zm","zimbabwe":"zw","zimbabue":"zw","guinea":"gn","cape verde":"cv","cabo verde":"cv","gabon":"ga","benin":"bj","togo":"tg","burkina faso":"bf","guinea bissau":"gw","guinea bisau":"gw","camboya":"kh","cambodia":"kh","libano":"lb","lebanon":"lb","china":"cn","japan":"jp","japon":"jp","south korea":"kr","korea republic":"kr","republic of korea":"kr","corea del sur":"kr","korea":"kr","corea":"kr","north korea":"kp","corea del norte":"kp","india":"in","israel":"il","iran":"ir","ir iran":"ir","kazakhstan":"kz","kazajistan":"kz","kazajstan":"kz","australia":"au","new zealand":"nz","nueva zelanda":"nz","philippines":"ph","filipinas":"ph","indonesia":"id","thailand":"th","tailandia":"th","vietnam":"vn","malaysia":"my","malasia":"my","singapore":"sg","singapur":"sg","taiwan":"tw","chinese taipei":"tw","hong kong":"hk","mongolia":"mn","uzbekistan":"uz","syria":"sy","siria":"sy","fiji":"fj","fiyi":"fj","papua nueva guinea":"pg","papua new guinea":"pg","virgin islands":"vi","islas virgenes":"vi","islas virgenes de america":"vi","islas virgenes de estados unidos":"vi","us virgin islands":"vi","united states virgin islands":"vi","burundi":"bi","madagascar":"mg","rd congo":"cd","rdc":"cd","ruanda":"rw","samoa":"ws","samoa americana":"as","sudan del sur":"ss","south sudan":"ss","tahiti":"pf","french polynesia":"pf","polinesia francesa":"pf","union sovietica":"ru","urss":"ru","ussr":"ru","soviet union":"ru","yugoslavia":"rs","checoslovaquia":"cz","czechoslovakia":"cz"};
const CCn: Record<string, string> = {};
const norm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
for (const k in CC) CCn[norm(k)] = CC[k];
const codeOf = (name: string) => CCn[norm(name)] || null;

const CAT_RE = /\bu[\s-]?(\d{2})\b/i;
const catOf = (s: string) => { const m = CAT_RE.exec(s || ""); return m ? "u" + m[1] : ""; };
const stripCat = (s: string) => (s || "").replace(new RegExp(CAT_RE.source, "ig"), " ");
const STOP = new Set("basket baloncesto basketball basquet club sad spor kulubu sf bc kk women womens women s femenino femenina zenski kosarkaski klub de la le les el los las del and team ladies bk sk kbk sc cf cd bsa".split(" "));
const sigToks = (s: string) => norm(stripCat(s)).split(" ").filter((x) => x.length > 1 && !STOP.has(x));

function normRound(code: string): string {
  return String(code || "").toUpperCase().replace(/[- ]/g, "").replace(/^CG/, "CL");
}
const ROUND_PREFIX: Record<string, string> = {
  "GP":"Fase de grupos","B":"Fase de grupos","R16":"Octavos de final","QF":"Cuartos de final","SF":"Semifinal","F":"Final","3PG":"3er puesto",
  "CL916":"Class. Games 9-16","CL1316":"Class. Games 13-16","CL912":"Class. Games 9-12","CL58":"Class. Games 5-8",
  "CL56":"Class. Game 5-6","CL78":"Class. Game 7-8","CL910":"Class. Game 9-10","CL1112":"Class. Game 11-12","CL1314":"Class. Game 13-14","CL1516":"Class. Game 15-16",
  // v40: EuroLeague Women — Regular Season dividida en First/Second Round.
  "RSFR":"Primera Ronda","RSSR":"Segunda Ronda",
};
// v39/v40: lookup secundario. v40 añade RS-FR/RS-SR antes del fallback genérico
// "Regular Season" para que EuroLeague use "Primera Ronda"/"Segunda Ronda".
const ROUND_BY_NAME: [RegExp, string][] = [
  [/regular season\s*[-·]\s*first round|^RS[- ]?FR\b/i, "Primera Ronda"],
  [/regular season\s*[-·]\s*second round|^RS[- ]?SR\b/i, "Segunda Ronda"],
  [/regular season/i, "Temporada regular"],
  [/group phase|group stage/i, "Fase de grupos"],
  [/round of 16/i, "Octavos de final"],
  [/quarter[- ]?finals?/i, "Cuartos de final"],
  [/semi[- ]?finals?/i, "Semifinal"],
  [/^finals?$/i, "Final"],
];
function notasDe(roundCode: string, roundName: string, groupPairing: string): string {
  const nc = normRound(roundCode);
  const g = String(groupPairing || "");
  const esLetra = /^[A-Za-z]$/.test(g);
  const prefijoGrupo = (p: string) =>
    esLetra ? `${p} \u00b7 Grupo ${g.toUpperCase()}` : p;
  const prefix = ROUND_PREFIX[nc];
  if (prefix) {
    // v40: para fases que se juegan por grupos (Fase de grupos, Primera/Segunda Ronda,
    // Temporada regular) añadir "· Grupo X" si groupPairing es letra.
    const esFaseGrupos = /^(Fase de grupos|Primera Ronda|Segunda Ronda|Temporada regular)$/.test(prefix);
    if (esFaseGrupos && esLetra) return prefijoGrupo(prefix);
    return /^\d+$/.test(g) ? `${prefix} #${g}` : prefix;
  }
  // v39: fallback por roundName (p.ej. EuroCup Regular Season con groupPairing letra).
  for (const [re, pfx] of ROUND_BY_NAME) {
    if (re.test(roundName || "")) {
      if (pfx === "Temporada regular" || pfx === "Fase de grupos") return prefijoGrupo(pfx);
      return /^\d+$/.test(g) ? `${pfx} #${g}` : pfx;
    }
  }
  const rn = (roundName || "").trim() || nc;
  return /^\d+$/.test(g) ? `${rn} #${g}` : rn;
}

function desescapar(u: string): string {
  for (let i = 0; i < 8; i++) {
    const u2 = u.split("\\\\").join("\x00").split('\\"').join('"').split("\x00").join("\\");
    if (u2 === u) break;
    u = u2;
  }
  return u;
}

async function fetchConTimeout(url: string, ms: number, headers?: Record<string, string>): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { headers, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

const esHistory = (target: string) => target.includes("/history/");

async function fetchFiba(target: string): Promise<string> {
  if (esHistory(target)) {
    if (!SCRAPER_KEY) throw new Error("SCRAPERAPI_KEY no configurada (history requiere render JS)");
    const sr = await fetchConTimeout(
      `https://api.scraperapi.com/?api_key=${SCRAPER_KEY}&render=true&url=${encodeURIComponent(target)}`,
      120000
    );
    if (!sr.ok) throw new Error(`HTTP ${sr.status} (history render)`);
    return await sr.text();
  }
  try {
    const r = await fetchConTimeout(`${target}?_cb=${Date.now()}`, 15000, BROWSER);
    if (r.ok) return await r.text();
    await r.body?.cancel();
  } catch { /* fallback */ }
  if (!SCRAPER_KEY) throw new Error("No pude descargar FIBA directo y SCRAPERAPI_KEY no está configurada");
  const sr = await fetchConTimeout(`https://api.scraperapi.com/?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(target)}`, 70000);
  if (!sr.ok) throw new Error(`HTTP ${sr.status}`);
  return await sr.text();
}

function urlBase(slug: string): string {
  if (slug.startsWith("history/")) return `https://www.fiba.basketball/en/history/${slug.slice("history/".length)}`;
  return `https://www.fiba.basketball/en/events/${slug}`;
}
const fetchLista = (slug: string) => fetchFiba(`${urlBase(slug)}/games`);

async function fetchDetail(gid: string): Promise<any> {
  const url = `https://www.fiba.basketball/en/events/api/game-live-info/${gid}/detail?_cb=${Date.now()}`;
  const r = await fetchConTimeout(url, 15000, BROWSER);
  if (!r.ok) { await r.body?.cancel(); throw new Error(`HTTP ${r.status}`); }
  return await r.json();
}

type Juego = {
  gid: string;
  aName: string; bName: string;
  aOrg: string | null; bOrg: string | null;
  aFrom: string | null; bFrom: string | null;
  aScore: number | null; bScore: number | null;
  dt: string | null;
  gameName: string;
  roundName: string;
  roundCode: string;
  groupPairing: string;
  bracketPos: number | null;
  htmlOrder: number;
};
function parseLista(html: string): Juego[] {
  const u = desescapar(html);
  const re = /"gameId":(\d+)/g;
  const pos: { gid: string; idx: number }[] = [];
  for (let m; (m = re.exec(u)); ) pos.push({ gid: m[1], idx: m.index });
  const out: Juego[] = [];
  const seen = new Set<string>();
  let ord = 0;
  for (let k = 0; k < pos.length; k++) {
    const gid = pos[k].gid;
    if (seen.has(gid)) continue;
    const c = u.slice(pos[k].idx, k + 1 < pos.length ? pos[k + 1].idx : pos[k].idx + 3000);
    const ta = /"teamA":\{[^}]*?"officialName":"([^"]*)"/.exec(c);
    const tb = /"teamB":\{[^}]*?"officialName":"([^"]*)"/.exec(c);
    const oa = /"teamA":\{"teamId":\d+,"organisationId":(\d+)/.exec(c);
    const ob = /"teamB":\{"teamId":\d+,"organisationId":(\d+)/.exec(c);
    const sa = /"teamAScore":(\d+)/.exec(c);
    const sb = /"teamBScore":(\d+)/.exec(c);
    const dt = /"gameDateTimeUTC":"([^"]*)"/.exec(c);
    const gn = /"gameName":"([^"]*)"/.exec(c);
    const rn = /"roundName":"([^"]*)"/.exec(c);
    const rc = /"roundCode":"([^"]*)"/.exec(c);
    const gp = /"groupPairingCode":"([^"]*)"/.exec(c);
    const afr = /"teamAFrom":"([^"]*)"/.exec(c);
    const bfr = /"teamBFrom":"([^"]*)"/.exec(c);
    if (gn || rc || rn) {
      seen.add(gid);
      const aScore = sa && sb && (+sa[1] > 0 || +sb[1] > 0) ? +sa[1] : null;
      const bScore = sa && sb && (+sa[1] > 0 || +sb[1] > 0) ? +sb[1] : null;
      out.push({
        gid,
        aName: ta ? ta[1] : "", bName: tb ? tb[1] : "",
        aOrg: oa ? oa[1] : null, bOrg: ob ? ob[1] : null,
        aFrom: afr ? afr[1] : null, bFrom: bfr ? bfr[1] : null,
        aScore, bScore,
        dt: dt ? dt[1] : null,
        gameName: gn ? gn[1] : "",
        roundName: rn ? rn[1] : "",
        roundCode: rc ? rc[1] : "",
        groupPairing: gp ? gp[1] : "",
        bracketPos: null,
        htmlOrder: ord++,
      });
    }
  }
  const porRonda: Record<string, Juego[]> = {};
  for (const j of out) {
    const nc = normRound(j.roundCode);
    if (nc === "GP" || nc === "B" || !nc) continue;
    if (!porRonda[nc]) porRonda[nc] = [];
    porRonda[nc].push(j);
  }
  for (const nc in porRonda) {
    porRonda[nc].sort((a, b) => a.htmlOrder - b.htmlOrder);
    porRonda[nc].forEach((j, i) => (j.bracketPos = i + 1));
  }
  return out;
}

type Roster = Record<string, { fn: string; ln: string; dorsal: string; pos: string }>;
type PlayerStats = {
  personId: string;
  orgId: string;
  pts: number; tca: number; tcm: number; t3a: number; t3m: number; tla: number; tlm: number;
  oreb: number; dreb: number; reb: number;
  ast: number; stl: number; blk: number; to: number; fa: number;
  min: string; val: number; titular: boolean; jugo: boolean;
};
type GameDetails = {
  ros: Roster;
  periods: Record<string, number[]>;
  scoresByOrg: Record<string, number>;
  players: PlayerStats[];
};

function parseDetail(data: any): GameDetails {
  const ros: Roster = {};
  const periods: Record<string, number[]> = {};
  const scoresByOrg: Record<string, number> = {};
  const players: PlayerStats[] = [];
  const teams = data?.game?.content?.c || [];
  for (const t of teams) {
    const orgId = String(t?.Id || "").replace(/^T_/, "");
    if (!orgId) continue;
    scoresByOrg[orgId] = Number(t?.Score) || 0;
    periods[orgId] = Array.isArray(t?.Periods) ? t.Periods.map((p: any) => Number(p?.Score) || 0) : [];
    const children = Array.isArray(t?.Children) ? t.Children : [];
    for (const c of children) {
      const pid = String(c?.Id || "").replace(/^P_/, "");
      if (!pid) continue;
      ros[pid] = { fn: "", ln: String(c?.Name || ""), dorsal: String(c?.JerseyNumber || ""), pos: "" };
      const s = c?.Stats || {};
      const num = (k: string) => { const v = s[k]; return typeof v === "number" ? v : (typeof v === "string" && v ? parseFloat(v) : 0); };
      const pts = num("PTS");
      const fg2m = num("FG2M"), fg2a = num("FG2A");
      const fg3m = num("FG3M"), fg3a = num("FG3A");
      const ftm = num("FTM"), fta = num("FTA");
      const tcm = fg2m + fg3m, tca = fg2a + fg3a;
      const oreb = num("OR"), dreb = num("DR"), reb = num("REB") || oreb + dreb;
      const ast = num("AS"), stl = num("ST"), blk = num("BS"), to_ = num("TO"), fa = num("PF");
      const minRaw = String(s?.TP || "");
      const effRaw = num("EFF");
      const val = effRaw || (pts + reb + ast + stl + blk - (tca - tcm) - (fta - ftm) - to_ - fa);
      const jugo = pts + fg2a + fg3a + fta + reb + ast + stl + blk + to_ + fa > 0 || /^\d+:\d+$/.test(minRaw);
      players.push({
        personId: pid, orgId,
        pts, tca, tcm, t3a: fg3a, t3m: fg3m, tla: fta, tlm: ftm,
        oreb, dreb, reb,
        ast, stl, blk, to: to_, fa,
        min: minRaw,
        val,
        titular: s?.Starter === true,
        jugo,
      });
    }
  }
  return { ros, periods, scoresByOrg, players };
}

function inicialOk(cand: { toks: Set<string> }, key: string, otroNorm: string) {
  const fi = otroNorm.charAt(0);
  if (!fi) return true;
  for (const t of cand.toks) if (t !== key && t.charAt(0) === fi) return true;
  return false;
}
function hacerMatcher(rosterEq: { jid: string; nombre: string }[]) {
  const idx = rosterEq.map((r) => ({ jid: r.jid, norm: norm(r.nombre), toks: new Set(norm(r.nombre).split(" ").filter(Boolean)) }));
  return (fn: string, ln: string): [string | null, boolean] => {
    const full = norm(`${fn} ${ln}`), rev = norm(`${ln} ${fn}`);
    const fnN = norm(fn), lnN = norm(ln);
    const ftoks = new Set(`${fnN} ${lnN}`.split(" ").filter(Boolean));
    for (const c of idx) if (c.norm === full || c.norm === rev) return [c.jid, true];
    const subset = (a: Set<string>, b: Set<string>) => a.size > 0 && [...a].every((t) => b.has(t));
    for (const c of idx) if (subset(ftoks, c.toks) || subset(c.toks, ftoks)) return [c.jid, false];
    for (const key of [lnN, fnN]) {
      if (!key) continue;
      const hits = idx.filter((c) => c.toks.has(key) && inicialOk(c, key, key === lnN ? fnN : lnN));
      if (hits.length === 1) return [hits[0].jid, false];
    }
    return [null, false];
  };
}
function hacerMatcherGlobal(all: { jid: string; nombre: string }[]) {
  const idx = all.map((r) => ({ jid: r.jid, norm: norm(r.nombre) }));
  return (fn: string, ln: string): [string | null, boolean] => {
    const full = norm(`${fn} ${ln}`), rev = norm(`${ln} ${fn}`);
    if (!full && !rev) return [null, false];
    const ex = idx.filter((c) => c.norm === full || c.norm === rev);
    if (ex.length === 1) return [ex[0].jid, true];
    return [null, false];
  };
}

async function get(url: string) {
  const r = await fetch(url, { headers: HDRS });
  if (!r.ok) throw new Error(`Supabase GET ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}
async function getAllJug(): Promise<{ jid: string; nombre: string }[]> {
  const out: { jid: string; nombre: string }[] = [];
  for (let p = 0; p < 25; p++) {
    const rows: any[] = await get(`${REST}/jugadoras?select=id_jugadora,nombre&order=id_jugadora.asc&limit=1000&offset=${p * 1000}`);
    for (const r of rows) out.push({ jid: r.id_jugadora, nombre: r.nombre || "" });
    if (rows.length < 1000) break;
  }
  return out;
}
async function getFibaPidMap(): Promise<Map<string,string>> {
  const m = new Map<string,string>();
  for (let p = 0; p < 25; p++) {
    const rows: any[] = await get(`${REST}/jugadoras?fiba_person_id=not.is.null&select=id_jugadora,fiba_person_id&order=id_jugadora.asc&limit=1000&offset=${p * 1000}`);
    for (const r of rows) if (r.fiba_person_id != null) m.set(String(r.fiba_person_id), r.id_jugadora);
    if (rows.length < 1000) break;
  }
  return m;
}

async function procesar(params: { id_liga: string; temporada: string; slug: string; dry: boolean; force: boolean; crear: boolean; id_ext?: string; offset: number; limit: number }) {
  const { id_liga, temporada, slug, dry, force, crear, id_ext, offset, limit } = params;
  const tempF = temporada ? `&temporada=eq.${encodeURIComponent(temporada)}` : "";
  const creados: string[] = [];
  const sinMapearEq: string[] = [];
  let notasRell = 0, idsAprendidos = 0, parcialesEscritos = 0;

  if (crear && offset === 0) {
    let listaHtml: string;
    try { listaHtml = await fetchLista(slug); }
    catch (e) { return { ok: false, error: `No pude bajar la lista del evento: ${e}` }; }
    const juegos = parseLista(listaHtml);
    const catSlug = catOf(slug);
    const teamRows: any[] = await get(`${REST}/temporadas?id_liga=eq.${id_liga}${tempF}&select=id_equipo,equipos(nombre,id_fiba)`);
    const teamByNorm: Record<string, string> = {};
    const teamByFiba: Record<string, string> = {};
    const codeFirst: Record<string, string> = {};
    const codeCount: Record<string, number> = {};
    const teamIdx: { id: string; sig: Set<string> }[] = [];
    const seenEq = new Set<string>();
    let candidatos = 0;
    for (const r of teamRows) {
      if (seenEq.has(r.id_equipo)) continue; seenEq.add(r.id_equipo);
      const nm = r.equipos?.nombre || "";
      if (catOf(nm) !== catSlug) continue;
      candidatos++;
      if (r.equipos?.id_fiba) teamByFiba[String(r.equipos.id_fiba)] = r.id_equipo;
      const base = stripCat(nm);
      const nb = norm(base);
      if (nb) teamByNorm[nb] = r.id_equipo;
      const cc = codeOf(base);
      if (cc) { codeCount[cc] = (codeCount[cc] || 0) + 1; if (!codeFirst[cc]) codeFirst[cc] = r.id_equipo; }
      teamIdx.push({ id: r.id_equipo, sig: new Set(sigToks(nm)) });
    }
    const teamByCode: Record<string, string> = {};
    for (const cc in codeFirst) if (codeCount[cc] === 1) teamByCode[cc] = codeFirst[cc];
    const aprender = new Map<string, string>();
    const mapTeam = (nombre: string, org: string | null): string | null => {
      if (org && teamByFiba[org]) return teamByFiba[org];
      const base = stripCat(nombre);
      const fn = norm(base);
      let hit: string | null = teamByNorm[fn] || null;
      if (!hit) { const cc = codeOf(base); if (cc && teamByCode[cc]) hit = teamByCode[cc]; }
      if (!hit) {
        const fsig = new Set(sigToks(nombre));
        if (fsig.size) {
          let best: string | null = null, bestScore = 0, tie = false;
          for (const t of teamIdx) { if (t.sig.size === 0) continue; let sh = 0; for (const x of t.sig) if (fsig.has(x)) sh++; if (sh > bestScore) { bestScore = sh; best = t.id; tie = false; } else if (sh === bestScore && sh > 0) tie = true; }
          if (bestScore > 0 && !tie) hit = best;
        }
      }
      if (hit && org && !teamByFiba[org]) { aprender.set(hit, org); teamByFiba[org] = hit; }
      return hit;
    };
    if (candidatos === 0) return { ok: false, error: `No hay equipos${catSlug ? " de categoria " + catSlug.toUpperCase() : ""} en ${id_liga} ${temporada}.` };
    const exist: any[] = await get(`${REST}/partidos?id_liga=eq.${id_liga}${tempF}&id_ext=not.is.null&select=id,id_ext,notas,fuente,id_equipo_local,id_equipo_visitante,bracket_pos,resultado_local,resultado_visitante,fecha_hora`);
    const existMap: Record<string, any> = {};
    for (const p of exist) existMap[String(p.id_ext)] = p;
    const nuevos: any[] = [];
    const actualizaciones: { id: any; upd: any }[] = [];
    for (const j of juegos) {
      const notas = notasDe(j.roundCode, j.roundName, j.groupPairing);
      const la = j.aName ? mapTeam(j.aName, j.aOrg) : null;
      const lb = j.bName ? mapTeam(j.bName, j.bOrg) : null;
      const ex = existMap[String(j.gid)];
      if (ex) {
        const upd: any = {};
        // v38: pisar notas si FIBA aporta grupo (· Grupo X) y BD no lo tenía.
        const bdSinGrupo = !ex.notas || !/·\s*Grupo [A-Z]/i.test(ex.notas);
        const fibaConGrupo = notas && /·\s*Grupo [A-Z]/i.test(notas);
        if (notas && (!ex.notas || (bdSinGrupo && fibaConGrupo))) upd.notas = notas;
        if (j.bracketPos != null && ex.bracket_pos == null) upd.bracket_pos = j.bracketPos;
        if (la && !ex.id_equipo_local) upd.id_equipo_local = la;
        if (lb && !ex.id_equipo_visitante) upd.id_equipo_visitante = lb;
        if (j.aScore != null && ex.resultado_local == null) {
          upd.resultado_local = j.aScore;
          upd.resultado_visitante = j.bScore;
        }
        if (j.dt && !ex.fecha_hora) upd.fecha_hora = `${j.dt}Z`;
        if (Object.keys(upd).length) actualizaciones.push({ id: ex.id, upd });
        continue;
      }
      const esGrupo = normRound(j.roundCode) === "GP" || normRound(j.roundCode) === "B";
      if (esGrupo) {
        if (!la || !lb) { sinMapearEq.push(`${j.gid}: ${!la ? (j.aName || "?") : "\u2713"} / ${!lb ? (j.bName || "?") : "\u2713"}`); continue; }
      } else {
        if (!notas || j.bracketPos == null) { continue; }
      }
      nuevos.push({
        id_liga, temporada,
        id_equipo_local: la, id_equipo_visitante: lb,
        resultado_local: j.aScore, resultado_visitante: j.bScore,
        fecha_hora: j.dt ? `${j.dt}Z` : null,
        id_ext: String(j.gid), fuente: "fiba", notas,
        bracket_pos: j.bracketPos,
      });
      const marcador = (j.aScore != null) ? `${j.aScore}-${j.bScore}` : "(sin jugar)";
      const nomA = j.aName || j.aFrom || "?";
      const nomB = j.bName || j.bFrom || "?";
      creados.push(`${j.gid}: ${nomA} ${marcador} ${nomB} \u2014 ${notas}${dry ? " [dry]" : ""}`);
    }
    if (!dry && nuevos.length) {
      const ins = await fetch(`${REST}/partidos`, { method: "POST", headers: { ...HDRS, Prefer: "return=minimal" }, body: JSON.stringify(nuevos) });
      if (!ins.ok) throw new Error(`INSERT partidos HTTP ${ins.status}: ${(await ins.text()).slice(0, 300)}`);
      await ins.body?.cancel();
    }
    if (!dry) {
      for (const a of actualizaciones) {
        const up = await fetch(`${REST}/partidos?id=eq.${a.id}`, { method: "PATCH", headers: { ...HDRS, Prefer: "return=minimal" }, body: JSON.stringify(a.upd) });
        if (up.ok) await up.body?.cancel();
      }
    }
    notasRell = actualizaciones.length;
    if (!dry) {
      for (const [eq, org] of aprender) {
        const up = await fetch(`${REST}/equipos?id_equipo=eq.${eq}&id_fiba=is.null`, { method: "PATCH", headers: { ...HDRS, Prefer: "return=minimal" }, body: JSON.stringify({ id_fiba: org }) });
        if (up.ok) { await up.body?.cancel(); idsAprendidos++; }
      }
    } else { idsAprendidos = aprender.size; }
  }

  let filtro = `id_liga=eq.${id_liga}&id_ext=not.is.null`;
  if (temporada) filtro += tempF;
  if (id_ext) filtro += `&id_ext=eq.${id_ext}`;
  else filtro += `&resultado_local=not.is.null&resultado_visitante=not.is.null`;
  const partidos: any[] = await get(`${REST}/partidos?${filtro}&order=id.asc&select=id,id_ext,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante,fuente,parciales,partido_boxscore(count)`);
  if (partidos.length === 0) return {
    ok: true, mensaje: "No hay partidos", partidos: 0, total: 0, siguiente_offset: null,
    creados: creados.length, notas_rellenadas: notasRell, ids_fiba_aprendidos: idsAprendidos,
    parciales_escritos: 0, creados_detalle: creados, sin_mapear_equipos: [...new Set(sinMapearEq)], dry,
  };

  const conBox = new Set(partidos.filter((p) => (p.partido_boxscore?.[0]?.count ?? 0) > 0).map((p) => p.id));
  const ventana = limit > 0 ? partidos.slice(offset, offset + limit) : partidos;
  const equipos = [...new Set(ventana.flatMap((p) => [p.id_equipo_local, p.id_equipo_visitante]))].filter(Boolean);
  const rosterRows: any[] = equipos.length ? await get(`${REST}/temporadas?id_liga=eq.${id_liga}${tempF}&id_equipo=in.(${equipos.join(",")})&select=id_equipo,id_jugadora,jugadoras(nombre)`) : [];
  const rosterPorEquipo: Record<string, { jid: string; nombre: string }[]> = {};
  for (const r of rosterRows) (rosterPorEquipo[r.id_equipo] = rosterPorEquipo[r.id_equipo] || []).push({ jid: r.id_jugadora, nombre: r.jugadoras?.nombre || "" });
  const matchers: Record<string, ReturnType<typeof hacerMatcher>> = {};
  for (const eq of equipos) matchers[eq] = hacerMatcher(rosterPorEquipo[eq] || []);
  const eqFibaRows: any[] = equipos.length ? await get(`${REST}/equipos?id_equipo=in.(${equipos.join(",")})&select=id_equipo,id_fiba`) : [];
  const fibaToEq: Record<string, string> = {};
  for (const r of eqFibaRows) if (r.id_fiba) fibaToEq[String(r.id_fiba)] = r.id_equipo;
  const fibaPidToJid = await getFibaPidMap();

  let matcherGlobal: ReturnType<typeof hacerMatcherGlobal> | null = null;
  const nuevasTemp = new Map<string, { jid: string; eq: string }>();
  const detalles: string[] = [];
  const sinMapear: string[] = [];
  const colisiones: string[] = [];
  const fibaIdAprendidos = new Map<string, string>();
  let hechos = 0, saltados = 0, filas = 0, viaGlobal = 0, viaFibaId = 0;

  for (const p of ventana) {
    let data: any;
    try { data = await fetchDetail(String(p.id_ext)); }
    catch (e) { detalles.push(`partido ${p.id} (${p.id_ext}): ERROR descarga ${e}`); continue; }
    const gd = parseDetail(data);
    if (gd.players.length === 0) { detalles.push(`partido ${p.id} (${p.id_ext}): sin players en detail \u2014 SALTADO`); saltados++; continue; }

    const oid2eq: Record<string, string> = {};
    // v37: oidsSospechosos recoge orgIds mapeados por fallback v35 (posición home/away).
    // Esos orgs NO disparan auto-roster (altasGame) porque el orden FIBA puede venir
    // invertido respecto al orden BD → inscribiría jugadoras en el equipo equivocado.
    const oidsSospechosos = new Set<string>();
    for (const o in gd.scoresByOrg) { if (fibaToEq[o]) oid2eq[o] = fibaToEq[o]; }
    if (Object.keys(oid2eq).length < Object.keys(gd.scoresByOrg).length) {
      if (p.resultado_local != null && p.resultado_visitante != null && p.resultado_local !== p.resultado_visitante) {
        const resMap: Record<number, string> = { [p.resultado_local]: p.id_equipo_local, [p.resultado_visitante]: p.id_equipo_visitante };
        for (const o in gd.scoresByOrg) if (!oid2eq[o]) oid2eq[o] = resMap[gd.scoresByOrg[o]];
      } else {
        // v35: fallback por posición cuando no hay resultado y no hay id_fiba match.
        // v37: estos quedan marcados como sospechosos → sin auto-roster.
        const orgIds = Object.keys(gd.scoresByOrg);
        if (orgIds.length === 2 && p.id_equipo_local && p.id_equipo_visitante) {
          if (!oid2eq[orgIds[0]]) { oid2eq[orgIds[0]] = p.id_equipo_local; oidsSospechosos.add(orgIds[0]); }
          if (!oid2eq[orgIds[1]]) { oid2eq[orgIds[1]] = p.id_equipo_visitante; oidsSospechosos.add(orgIds[1]); }
          detalles.push(`partido ${p.id} (${p.id_ext}): equipos mapeados por posición (sin id_fiba) \u2014 auto-roster deshabilitado`);
        } else {
          detalles.push(`partido ${p.id} (${p.id_ext}): sin id_fiba en equipos y sin resultado \u2014 SALTADO`); saltados++; continue;
        }
      }
    }
    if (p.resultado_local != null && p.resultado_visitante != null) {
      const totFiba = Object.values(gd.scoresByOrg).reduce((a, b) => a + b, 0);
      if (totFiba !== p.resultado_local + p.resultado_visitante) {
        detalles.push(`partido ${p.id} (${p.id_ext}): puntos FIBA ${totFiba} != resultado ${p.resultado_local + p.resultado_visitante} \u2014 SALTADO`);
        saltados++; continue;
      }
    } else {
      const oidLoc = Object.keys(oid2eq).find((o) => oid2eq[o] === p.id_equipo_local);
      const oidVis = Object.keys(oid2eq).find((o) => oid2eq[o] === p.id_equipo_visitante);
      if (oidLoc && oidVis && gd.scoresByOrg[oidLoc] != null && gd.scoresByOrg[oidVis] != null) {
        const upd: any = { resultado_local: gd.scoresByOrg[oidLoc], resultado_visitante: gd.scoresByOrg[oidVis], es_live: false, periodo: null };
        if (!dry) {
          const up = await fetch(`${REST}/partidos?id=eq.${p.id}`, { method: "PATCH", headers: { ...HDRS, Prefer: "return=minimal" }, body: JSON.stringify(upd) });
          if (up.ok) { await up.body?.cancel(); detalles.push(`partido ${p.id} (${p.id_ext}): score escrito ${upd.resultado_local}-${upd.resultado_visitante}`); }
        }
        p.resultado_local = upd.resultado_local; p.resultado_visitante = upd.resultado_visitante;
      }
    }

    const oidLoc = Object.keys(oid2eq).find((o) => oid2eq[o] === p.id_equipo_local);
    const oidVis = Object.keys(oid2eq).find((o) => oid2eq[o] === p.id_equipo_visitante);
    const perLoc = oidLoc ? (gd.periods[oidLoc] || []) : [];
    const perVis = oidVis ? (gd.periods[oidVis] || []) : [];
    if (perLoc.length && perVis.length) {
      const nuevoPar = { local: perLoc, visitante: perVis };
      // v39: solo escribir si suma(periods) == scoreTotal declarado. Evita que
      // durante el descanso (FIBA aún no publica Q3+Q4) pisemos los parciales
      // buenos con [16,27,0,0].
      const sumaPer = perLoc.reduce((a, b) => a + b, 0) + perVis.reduce((a, b) => a + b, 0);
      const scoreTotal = (oidLoc ? (gd.scoresByOrg[oidLoc] || 0) : 0) + (oidVis ? (gd.scoresByOrg[oidVis] || 0) : 0);
      const consistente = sumaPer === scoreTotal;
      const debeEscribir = (p.fuente === "fiba" || !p.parciales) && consistente;
      if (debeEscribir) {
        if (!dry) {
          const up = await fetch(`${REST}/partidos?id=eq.${p.id}`, { method: "PATCH", headers: { ...HDRS, Prefer: "return=minimal" }, body: JSON.stringify({ parciales: nuevoPar }) });
          if (up.ok) { await up.body?.cancel(); parcialesEscritos++; }
        } else { parcialesEscritos++; }
      }
    }

    if (conBox.has(p.id) && !force) { saltados++; continue; }

    const filasP: any[] = [];
    const usadas = new Map<string, string>();
    const altasGame = new Map<string, { jid: string; eq: string }>();
    const sinMapearGame: string[] = [];
    const colisionesGame: string[] = [];
    for (const s of gd.players) {
      if (!s.jugo) continue;
      const r = gd.ros[s.personId] || { fn: "", ln: "?", dorsal: "", pos: "" };
      const nomFiba = `${r.fn} ${r.ln}`.trim();
      const eq = oid2eq[s.orgId];
      let jid: string | null = fibaPidToJid.get(String(s.personId)) || null;
      let porFibaId = !!jid;
      let porGlobal = false;
      let exactMatch = false;
      if (!jid && eq && matchers[eq]) {
        const [mj, mex] = matchers[eq](r.fn, r.ln);
        jid = mj; exactMatch = mex;
      }
      if (!jid) {
        if (matcherGlobal === null) matcherGlobal = hacerMatcherGlobal(await getAllJug());
        const [gj, gex] = matcherGlobal(r.fn, r.ln);
        if (gj && gex) { jid = gj; porGlobal = true; exactMatch = true; }
      }
      if (!jid) { sinMapearGame.push(`${eq || "?"} ${nomFiba} (fiba_pid ${s.personId})`); continue; }
      if (usadas.has(jid)) { colisionesGame.push(`\"${usadas.get(jid)}\" y \"${nomFiba}\" \u2192 misma ficha (${jid})`); continue; }
      usadas.set(jid, nomFiba);
      if (porFibaId) viaFibaId++;
      if (!porFibaId && exactMatch && !fibaPidToJid.has(String(s.personId))) {
        fibaIdAprendidos.set(jid, String(s.personId));
        fibaPidToJid.set(String(s.personId), jid);
      }
      // v37: solo auto-roster si mapeo orgId→equipo es fiable (no viene del
      // fallback por posición). Esto evita inscribir jugadoras del visitante
      // como roster del local cuando FIBA invierte el orden home/away.
      if ((porFibaId || porGlobal) && eq && !oidsSospechosos.has(s.orgId)) {
        const enRoster = (rosterPorEquipo[eq] || []).some((rr) => rr.jid === jid);
        if (!enRoster) altasGame.set(jid + "|" + eq, { jid: jid as string, eq });
      }
      if (porGlobal) viaGlobal++;
      filasP.push({
        id_partido: p.id, id_jugadora: jid, id_equipo: eq, nombre: nomFiba, dorsal: r.dorsal,
        minutos: s.min,
        puntos: s.pts,
        tc_anotados: s.tcm, tc_intentados: s.tca,
        t3_anotados: s.t3m, t3_intentados: s.t3a,
        tl_anotados: s.tlm, tl_intentados: s.tla,
        reb_ofensivos: s.oreb, reb_defensivos: s.dreb, reb_totales: s.reb,
        asistencias: s.ast, robos: s.stl, tapones: s.blk,
        perdidas: s.to, faltas: s.fa,
        valoracion: s.val, titular: s.titular,
      });
    }
    for (const x of sinMapearGame) sinMapear.push(`${p.id_ext} ${x}`);
    for (const x of colisionesGame) colisiones.push(`${p.id_ext}: ${x}`);
    if (filasP.length === 0) { detalles.push(`partido ${p.id} (${p.id_ext}): 0 jugadoras mapeables \u2014 SALTADO`); saltados++; continue; }
    if (!dry) {
      if (conBox.has(p.id) && force) {
        const del = await fetch(`${REST}/partido_boxscore?id_partido=eq.${p.id}`, { method: "DELETE", headers: HDRS });
        if (!del.ok) throw new Error(`DELETE box ${p.id} HTTP ${del.status}`);
        await del.body?.cancel();
      }
      const ins = await fetch(`${REST}/partido_boxscore`, { method: "POST", headers: { ...HDRS, Prefer: "return=minimal" }, body: JSON.stringify(filasP) });
      if (!ins.ok) { detalles.push(`partido ${p.id} (${p.id_ext}): ERROR insert ${(await ins.text()).slice(0, 160)} \u2014 SALTADO`); continue; }
      await ins.body?.cancel();
    }
    for (const [k, v] of altasGame) nuevasTemp.set(k, v);
    hechos++; filas += filasP.length;
    const nota = sinMapearGame.length ? ` (${sinMapearGame.length} sin mapear, ${colisionesGame.length} colisión)` : "";
    detalles.push(`partido ${p.id} (${p.id_ext}): ${filasP.length} jugadoras${nota}${dry ? " [dry]" : ""}`);
  }

  let plantillaAltas = 0;
  if (!dry && nuevasTemp.size) {
    const maxRow: any[] = await get(`${REST}/temporadas?select=id&order=id.desc&limit=1`);
    let nextId = (Number(maxRow[0]?.id) || 0) + 1;
    const rowsT = [...nuevasTemp.values()].map((v) => ({ id: nextId++, id_jugadora: v.jid, id_equipo: v.eq, id_liga, temporada, orden: 0 }));
    const insT = await fetch(`${REST}/temporadas`, { method: "POST", headers: { ...HDRS, Prefer: "return=minimal" }, body: JSON.stringify(rowsT) });
    if (insT.ok) { await insT.body?.cancel(); plantillaAltas = rowsT.length; }
    else detalles.push(`AVISO altas plantilla: ${(await insT.text()).slice(0, 160)}`);
  } else if (dry) plantillaAltas = nuevasTemp.size;

  let fibaIdEscritos = 0;
  if (!dry && fibaIdAprendidos.size) {
    for (const [jid, pid] of fibaIdAprendidos) {
      const up = await fetch(`${REST}/jugadoras?id_jugadora=eq.${jid}&fiba_person_id=is.null`, { method: "PATCH", headers: { ...HDRS, Prefer: "return=minimal" }, body: JSON.stringify({ fiba_person_id: pid }) });
      if (up.ok) { await up.body?.cancel(); fibaIdEscritos++; }
    }
  } else if (dry) fibaIdEscritos = fibaIdAprendidos.size;

  const siguiente_offset = (limit > 0 && offset + limit < partidos.length) ? offset + limit : null;
  return {
    ok: true, partidos: partidos.length, total: partidos.length, siguiente_offset,
    creados: creados.length, notas_rellenadas: notasRell, ids_fiba_aprendidos: idsAprendidos,
    parciales_escritos: parcialesEscritos,
    hechos, saltados, filas, via_global: viaGlobal, via_fiba_id: viaFibaId,
    plantilla_altas: plantillaAltas, fiba_person_id_escritos: fibaIdEscritos,
    colisiones, sin_mapear: [...new Set(sinMapear)],
    sin_mapear_equipos: [...new Set(sinMapearEq)],
    creados_detalle: creados, detalles, dry,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    let p: any = {};
    if (req.method === "POST") { try { p = await req.json(); } catch { /* ignore */ } }
    const url = new URL(req.url);
    const g = (k: string) => p[k] ?? url.searchParams.get(k) ?? undefined;
    const id_liga = g("id_liga"); const slug = g("slug");
    if (!id_liga || !slug) return json({ ok: false, error: "Faltan parametros: id_liga y slug son obligatorios" }, 400);
    const bool = (v: any) => v === true || v === "1" || v === "true";
    const params = {
      id_liga: String(id_liga),
      temporada: g("temporada") ? String(g("temporada")) : "",
      slug: String(slug),
      dry: bool(g("dry")),
      force: bool(g("force")),
      crear: bool(g("crear")),
      id_ext: g("id_ext") ? String(g("id_ext")) : undefined,
      offset: Number(g("offset")) || 0,
      limit: Number(g("limit")) || 0,
    };
    return json(await procesar(params));
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
