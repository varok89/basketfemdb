// cargar-ranking-fiba v6
// v6: PAGINAR el fetch de equipos. La BD tiene ~1500 equipos y PostgREST
//   devuelve solo 1000 por defecto → USA/Francia/Alemania/Australia se
//   quedaban fuera del map y el scraper intentaba CREARLAS de nuevo o
//   las reportaba como sin_mapear. Ahora se pagina en tandas de 1000.
// v5: fix parser. FIBA usa deltas con signo `+3` (subidas) que el regex
//   `-?` NO capturaba → 42/131 filas se saldían entero por `nums.length<4`.
//   Ahora `[+-]?` captura ambos signos, y aceptamos delta faltante (=0).
// v4: al crear una seleccion nueva, rellenar tambien `ciudad` con la capital del pais.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REST = `${SB_URL}/rest/v1`;
const HDRS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const BROWSER = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

const ZONA_BY_ORG: Record<number, string> = {
  116:"Africa",100:"Africa",134:"Africa",108:"Africa",33:"Africa",9716:"Africa",53:"Africa",44:"Africa",12:"Africa",337:"Africa",128:"Africa",88:"Africa",165:"Africa",195:"Africa",877:"Africa",167:"Africa",151:"Africa",166:"Africa",973:"Africa",61:"Africa",
  154:"Americas",34:"Americas",27:"Americas",125:"Americas",40:"Americas",14:"Americas",104:"Americas",51:"Americas",158:"Americas",45:"Americas",54:"Americas",160:"Americas",38:"Americas",120:"Americas",70:"Americas",43:"Americas",52:"Americas",18:"Americas",114:"Americas",26:"Americas",21:"Americas",3:"Americas",155:"Americas",73:"Americas",129:"Americas",142:"Americas",84:"Americas",71:"Americas",
  16:"Asia",39:"Asia",85:"Asia",89:"Asia",113:"Asia",122:"Asia",146:"Asia",93:"Asia",879:"Asia",78:"Asia",148:"Asia",77:"Asia",86:"Asia",739:"Asia",2792:"Asia",881:"Asia",145:"Asia",736:"Asia",42:"Asia",1742:"Asia",74:"Asia",2781:"Asia",60:"Asia",139:"Asia",737:"Asia",
  59:"Europe",22:"Europe",138:"Europe",64:"Europe",8323:"Europe",83:"Europe",152:"Europe",886:"Europe",75:"Europe",976:"Europe",618:"Europe",8310:"Europe",67:"Europe",876:"Europe",143:"Europe",885:"Europe",611:"Europe",610:"Europe",622:"Europe",124:"Europe",628:"Europe",123:"Europe",144:"Europe",82:"Europe",96:"Europe",110:"Europe",48:"Europe",30:"Europe",127:"Europe",76:"Europe",117:"Europe",58:"Europe",609:"Europe",878:"Europe",17:"Europe",46:"Europe",81:"Europe",101:"Europe",9795:"Europe",645:"Europe",9:"Europe",875:"Europe",273:"Europe",882:"Europe",66:"Europe",632:"Europe",
};

const CC: Record<string, string> = {"espana":"es","spain":"es","france":"fr","francia":"fr","italy":"it","italia":"it","germany":"de","alemania":"de","portugal":"pt","netherlands":"nl","paises bajos":"nl","holanda":"nl","belgium":"be","belgica":"be","switzerland":"ch","suiza":"ch","austria":"at","sweden":"se","suecia":"se","norway":"no","noruega":"no","denmark":"dk","dinamarca":"dk","finland":"fi","finlandia":"fi","ireland":"ie","irlanda":"ie","iceland":"is","islandia":"is","united kingdom":"gb","reino unido":"gb","gran bretana":"gb","great britain":"gb","russia":"ru","rusia":"ru","ukraine":"ua","ucrania":"ua","poland":"pl","polonia":"pl","czech republic":"cz","czechia":"cz","republica checa":"cz","chequia":"cz","slovakia":"sk","eslovaquia":"sk","hungary":"hu","hungria":"hu","romania":"ro","rumania":"ro","bulgaria":"bg","serbia":"rs","croatia":"hr","croacia":"hr","slovenia":"si","eslovenia":"si","bosnia":"ba","bosnia y herzegovina":"ba","bosnia and herzegovina":"ba","montenegro":"me","albania":"al","north macedonia":"mk","macedonia del norte":"mk","macedonia":"mk","kosovo":"xk","greece":"gr","grecia":"gr","turkey":"tr","turkiye":"tr","turquia":"tr","georgia":"ge","armenia":"am","azerbaijan":"az","azerbaiyan":"az","moldova":"md","moldavia":"md","belarus":"by","bielorrusia":"by","estonia":"ee","latvia":"lv","letonia":"lv","lithuania":"lt","lituania":"lt","luxembourg":"lu","luxemburgo":"lu","cyprus":"cy","chipre":"cy","malta":"mt","andorra":"ad","liechtenstein":"li","monaco":"mc","san marino":"sm","gibraltar":"gi","usa":"us","eeuu":"us","estados unidos":"us","united states":"us","canada":"ca","mexico":"mx","cuba":"cu","puerto rico":"pr","dominican republic":"do","republica dominicana":"do","haiti":"ht","jamaica":"jm","trinidad and tobago":"tt","trinidad y tobago":"tt","bahamas":"bs","barbados":"bb","costa rica":"cr","guatemala":"gt","honduras":"hn","el salvador":"sv","nicaragua":"ni","panama":"pa","dominica":"dm","guyana":"gy","brazil":"br","brasil":"br","argentina":"ar","colombia":"co","venezuela":"ve","peru":"pe","chile":"cl","ecuador":"ec","uruguay":"uy","bolivia":"bo","paraguay":"py","suriname":"sr","surinam":"sr","nigeria":"ng","senegal":"sn","mali":"ml","cameroon":"cm","camerun":"cm","angola":"ao","mozambique":"mz","uganda":"ug","kenya":"ke","kenia":"ke","ethiopia":"et","etiopia":"et","ghana":"gh","ivory coast":"ci","costa de marfil":"ci","cote d ivoire":"ci","cote divoire":"ci","egypt":"eg","egipto":"eg","morocco":"ma","marruecos":"ma","algeria":"dz","argelia":"dz","tunisia":"tn","tunez":"tn","south africa":"za","sudafrica":"za","rwanda":"rw","ruanda":"rw","congo":"cd","congo dr":"cd","dr congo":"cd","zambia":"zm","zimbabwe":"zw","zimbabue":"zw","guinea":"gn","cape verde":"cv","cabo verde":"cv","gabon":"ga","benin":"bj","togo":"tg","burkina faso":"bf","china":"cn","japan":"jp","japon":"jp","south korea":"kr","korea republic":"kr","republic of korea":"kr","corea del sur":"kr","korea":"kr","corea":"kr","north korea":"kp","corea del norte":"kp","india":"in","israel":"il","iran":"ir","kazakhstan":"kz","kazajistan":"kz","kazajstan":"kz","australia":"au","new zealand":"nz","nueva zelanda":"nz","philippines":"ph","filipinas":"ph","indonesia":"id","thailand":"th","tailandia":"th","vietnam":"vn","malaysia":"my","malasia":"my","singapore":"sg","singapur":"sg","taiwan":"tw","chinese taipei":"tw","hong kong":"hk","hong kong china":"hk","mongolia":"mn","uzbekistan":"uz","syria":"sy","siria":"sy","fiji":"fj","virgin islands":"vi","islas virgenes":"vi","islas virgenes de estados unidos":"vi","us virgin islands":"vi","burundi":"bi","jordan":"jo","jordania":"jo","cook islands":"ck","islas cook":"ck","stvincent and the grenadines":"vc","saint vincent and the grenadines":"vc","san vicente y las granadinas":"vc","maldives":"mv","maldivas":"mv","nepal":"np","sri lanka":"lk","kyrgyzstan":"kg","kirguistan":"kg","south sudan":"ss","sudan del sur":"ss","tahiti":"pf","french polynesia":"pf","lebanon":"lb","libano":"lb"};
const CCn: Record<string, string> = {};
const norm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
for (const k in CC) CCn[norm(k)] = CC[k];
const iso2Of = (name: string) => CCn[norm(name)] || null;
const iso2OfSlug = (slug: string) => iso2Of(slug.replace(/-/g, " "));

const CREATE_INFO: Record<string, { nombre: string; flag: string; capital: string }> = {
  "great-britain": { nombre: "Gran Bretaña", flag: "Flag_of_the_United_Kingdom.svg", capital: "Londres" },
  "croatia": { nombre: "Croacia", flag: "Flag_of_Croatia.svg", capital: "Zagreb" },
  "chinese-taipei": { nombre: "China Taipéi", flag: "Flag_of_Chinese_Taipei_for_Olympic_games.svg", capital: "Taipéi" },
  "iran": { nombre: "Irán", flag: "Flag_of_Iran.svg", capital: "Teherán" },
  "venezuela": { nombre: "Venezuela", flag: "Flag_of_Venezuela.svg", capital: "Caracas" },
  "luxembourg": { nombre: "Luxemburgo", flag: "Flag_of_Luxembourg.svg", capital: "Luxemburgo" },
  "netherlands": { nombre: "Países Bajos", flag: "Flag_of_the_Netherlands.svg", capital: "Ámsterdam" },
  "denmark": { nombre: "Dinamarca", flag: "Flag_of_Denmark.svg", capital: "Copenhague" },
  "bulgaria": { nombre: "Bulgaria", flag: "Flag_of_Bulgaria.svg", capital: "Sofía" },
  "romania": { nombre: "Rumanía", flag: "Flag_of_Romania.svg", capital: "Bucarest" },
  "thailand": { nombre: "Tailandia", flag: "Flag_of_Thailand.svg", capital: "Bangkok" },
  "india": { nombre: "India", flag: "Flag_of_India.svg", capital: "Nueva Delhi" },
  "iceland": { nombre: "Islandia", flag: "Flag_of_Iceland.svg", capital: "Reikiavik" },
  "virgin-islands": { nombre: "Islas Vírgenes", flag: "Flag_of_the_United_States_Virgin_Islands.svg", capital: "Charlotte Amalie" },
  "norway": { nombre: "Noruega", flag: "Flag_of_Norway.svg", capital: "Oslo" },
  "finland": { nombre: "Finlandia", flag: "Flag_of_Finland.svg", capital: "Helsinki" },
  "estonia": { nombre: "Estonia", flag: "Flag_of_Estonia.svg", capital: "Tallin" },
  "jordan": { nombre: "Jordania", flag: "Flag_of_Jordan.svg", capital: "Amán" },
  "kazakhstan": { nombre: "Kazajistán", flag: "Flag_of_Kazakhstan.svg", capital: "Astaná" },
  "north-macedonia": { nombre: "Macedonia del Norte", flag: "Flag_of_North_Macedonia.svg", capital: "Skopie" },
  "mongolia": { nombre: "Mongolia", flag: "Flag_of_Mongolia.svg", capital: "Ulán Bator" },
  "austria": { nombre: "Austria", flag: "Flag_of_Austria.svg", capital: "Viena" },
  "paraguay": { nombre: "Paraguay", flag: "Flag_of_Paraguay.svg", capital: "Asunción" },
  "cyprus": { nombre: "Chipre", flag: "Flag_of_Cyprus.svg", capital: "Nicosia" },
  "ireland": { nombre: "Irlanda", flag: "Flag_of_Ireland.svg", capital: "Dublín" },
  "guatemala": { nombre: "Guatemala", flag: "Flag_of_Guatemala.svg", capital: "Ciudad de Guatemala" },
  "costa-rica": { nombre: "Costa Rica", flag: "Flag_of_Costa_Rica.svg", capital: "San José" },
  "malaysia": { nombre: "Malasia", flag: "Flag_of_Malaysia.svg", capital: "Kuala Lumpur" },
  "kenya": { nombre: "Kenia", flag: "Flag_of_Kenya.svg", capital: "Nairobi" },
  "congo-dr": { nombre: "RD del Congo", flag: "Flag_of_the_Democratic_Republic_of_the_Congo.svg", capital: "Kinsasa" },
  "syria": { nombre: "Siria", flag: "Flag_of_Syria.svg", capital: "Damasco" },
  "ecuador": { nombre: "Ecuador", flag: "Flag_of_Ecuador.svg", capital: "Quito" },
  "bahamas": { nombre: "Bahamas", flag: "Flag_of_the_Bahamas.svg", capital: "Nassau" },
  "uzbekistan": { nombre: "Uzbekistán", flag: "Flag_of_Uzbekistan.svg", capital: "Taskent" },
  "nicaragua": { nombre: "Nicaragua", flag: "Flag_of_Nicaragua.svg", capital: "Managua" },
  "bolivia": { nombre: "Bolivia", flag: "Flag_of_Bolivia.svg", capital: "La Paz" },
  "azerbaijan": { nombre: "Azerbaiyán", flag: "Flag_of_Azerbaijan.svg", capital: "Bakú" },
  "barbados": { nombre: "Barbados", flag: "Flag_of_Barbados.svg", capital: "Bridgetown" },
  "panama": { nombre: "Panamá", flag: "Flag_of_Panama.svg", capital: "Ciudad de Panamá" },
  "uruguay": { nombre: "Uruguay", flag: "Flag_of_Uruguay.svg", capital: "Montevideo" },
  "honduras": { nombre: "Honduras", flag: "Flag_of_Honduras.svg", capital: "Tegucigalpa" },
  "cape-verde": { nombre: "Cabo Verde", flag: "Flag_of_Cape_Verde.svg", capital: "Praia" },
  "zimbabwe": { nombre: "Zimbabue", flag: "Flag_of_Zimbabwe.svg", capital: "Harare" },
  "cook-islands": { nombre: "Islas Cook", flag: "Flag_of_the_Cook_Islands.svg", capital: "Avarua" },
  "tunisia": { nombre: "Túnez", flag: "Flag_of_Tunisia.svg", capital: "Túnez" },
  "stvincent-and-the-grenadines": { nombre: "San Vicente y las Granadinas", flag: "Flag_of_Saint_Vincent_and_the_Grenadines.svg", capital: "Kingstown" },
  "maldives": { nombre: "Maldivas", flag: "Flag_of_Maldives.svg", capital: "Malé" },
  "hong-kong-china": { nombre: "Hong Kong", flag: "Flag_of_Hong_Kong.svg", capital: "Hong Kong" },
  "moldova": { nombre: "Moldavia", flag: "Flag_of_Moldova.svg", capital: "Chişinău" },
  "suriname": { nombre: "Surinam", flag: "Flag_of_Suriname.svg", capital: "Paramaribo" },
  "jamaica": { nombre: "Jamaica", flag: "Flag_of_Jamaica.svg", capital: "Kingston" },
  "nepal": { nombre: "Nepal", flag: "Flag_of_Nepal.svg", capital: "Katmandú" },
  "gibraltar": { nombre: "Gibraltar", flag: "Flag_of_Gibraltar.svg", capital: "Gibraltar" },
  "zambia": { nombre: "Zambia", flag: "Flag_of_Zambia.svg", capital: "Lusaka" },
  "burundi": { nombre: "Burundi", flag: "Flag_of_Burundi.svg", capital: "Gitega" },
  "tahiti": { nombre: "Tahití", flag: "Flag_of_French_Polynesia.svg", capital: "Papeete" },
  "sri-lanka": { nombre: "Sri Lanka", flag: "Flag_of_Sri_Lanka.svg", capital: "Colombo" },
  "kyrgyzstan": { nombre: "Kirguistán", flag: "Flag_of_Kyrgyzstan.svg", capital: "Bishkek" },
  "gabon": { nombre: "Gabón", flag: "Flag_of_Gabon.svg", capital: "Libreville" },
  "guyana": { nombre: "Guyana", flag: "Flag_of_Guyana.svg", capital: "Georgetown" },
};

function desescapar(u: string): string {
  for (let i = 0; i < 6; i++) {
    const u2 = u.split("\\\\").join("\x00").split('\\"').join('"').split("\x00").join("\\");
    if (u2 === u) break;
    u = u2;
  }
  return u;
}

type Row = { orgId: number; slug: string; rank: number; rankZone: number; puntos: number; delta: number };

function parseRanking(html: string): Row[] {
  const u = desescapar(html);
  const rows = u.match(/<tr[^>]*_196da2p2[^>]*>[\s\S]*?<\/tr>/g) || [];
  const byOrg = new Map<number, Row>();
  for (const row of rows) {
    const mo = /\/en\/teams\/(\d+)-([a-z0-9-]+)/.exec(row);
    if (!mo) continue;
    // v5: [+-]? captura deltas positivos (+3, +12...) que antes se perdían
    const nums = [...row.matchAll(/>([+-]?\d+(?:\.\d+)?)[\s.<]/g)].map((m) => m[1]);
    // Necesitamos al menos rank, rankZone, puntos. Delta es opcional (=0 si falta).
    if (nums.length < 3) continue;
    const orgId = parseInt(mo[1], 10);
    if (byOrg.has(orgId)) continue;
    byOrg.set(orgId, {
      orgId,
      slug: mo[2],
      rank: parseInt(nums[0], 10),
      rankZone: parseInt(nums[1], 10),
      puntos: parseFloat(nums[2]),
      delta: nums.length >= 4 ? parseInt(nums[3], 10) : 0,
    });
  }
  return [...byOrg.values()].sort((a, b) => a.rank - b.rank);
}

async function getJson(url: string) {
  const r = await fetch(url, { headers: HDRS });
  if (!r.ok) throw new Error(`Supabase GET ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}

// v6: pagina todo el catalogo de equipos (BD tiene ~1500, PostgREST default 1000)
async function getAllEquipos(): Promise<any[]> {
  const out: any[] = [];
  for (let p = 0; p < 10; p++) {
    const rows: any[] = await getJson(`${REST}/equipos?select=id_equipo,nombre,fiba_org_id&order=id_equipo.asc&limit=1000&offset=${p * 1000}`);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const j = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    let body: any = {}; try { body = req.method === "POST" ? await req.json() : {}; } catch {}
    const url = new URL(req.url);
    const g = (k: string) => body[k] ?? url.searchParams.get(k) ?? undefined;
    const gender = String(g("gender") || "women");
    const bool = (v: any) => v === true || v === "true" || v === "1";
    const dry = bool(g("dry"));
    const crearFaltantes = bool(g("crear_faltantes"));

    const html = await fetch(`https://www.fiba.basketball/en/ranking/${gender}`, { headers: BROWSER }).then((r) => r.text());
    const rows = parseRanking(html);
    if (rows.length === 0) return j({ ok: false, error: "No pude extraer filas del ranking" }, 500);

    const eq: any[] = await getAllEquipos();
    const byOrgIdEq = new Map<number, any>();
    const byIso2Eq = new Map<string, any>();
    for (const e of eq) {
      if (e.fiba_org_id) byOrgIdEq.set(Number(e.fiba_org_id), e);
      const iso = iso2Of(e.nombre || "");
      if (iso && !byIso2Eq.has(iso)) byIso2Eq.set(iso, e);
    }

    let nextEid = 0;
    if (crearFaltantes) {
      const rowsE: any[] = await getJson(`${REST}/equipos?select=id_equipo&id_equipo=like.E*&order=id_equipo.desc&limit=1000`);
      for (const r of rowsE) {
        const n = parseInt(String(r.id_equipo).replace(/^E/, ""), 10);
        if (!isNaN(n) && n > nextEid) nextEid = n;
      }
      nextEid++;
    }

    const nowIso = new Date().toISOString();
    const aprendidos: any[] = [];
    const creados: any[] = [];
    const sinCrearNiMapear: any[] = [];
    const sinZona: any[] = [];
    let actualizados = 0;

    for (const r of rows) {
      const zona = ZONA_BY_ORG[r.orgId] || null;
      if (!zona) sinZona.push({ orgId: r.orgId, slug: r.slug });

      let target = byOrgIdEq.get(r.orgId);
      let aprender_org = false;
      if (!target) {
        const iso = iso2OfSlug(r.slug);
        if (iso) {
          target = byIso2Eq.get(iso);
          if (target) aprender_org = true;
        }
      }

      if (!target && crearFaltantes) {
        const info = CREATE_INFO[r.slug];
        if (info) {
          const newId = "E" + nextEid++;
          const nuevo = {
            id_equipo: newId,
            nombre: info.nombre,
            pais: info.nombre,
            ciudad: info.capital || null,
            escudo: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(info.flag)}?width=1920`,
            tipo: "seleccion",
            fiba_org_id: r.orgId,
            fiba_rank: r.rank,
            fiba_puntos: r.puntos,
            fiba_zona: zona,
            fiba_rank_updated: nowIso,
          };
          creados.push(nuevo);
          if (!dry) {
            const ins = await fetch(`${REST}/equipos`, { method: "POST", headers: { ...HDRS, Prefer: "return=minimal" }, body: JSON.stringify(nuevo) });
            if (ins.ok) await ins.body?.cancel();
            else creados[creados.length - 1]._error = (await ins.text()).slice(0, 200);
          }
          continue;
        }
      }

      if (!target) { sinCrearNiMapear.push({ orgId: r.orgId, slug: r.slug, rank: r.rank }); continue; }

      const upd: any = {
        fiba_rank: r.rank,
        fiba_puntos: r.puntos,
        fiba_zona: zona,
        fiba_rank_updated: nowIso,
      };
      if (aprender_org) upd.fiba_org_id = r.orgId;
      if (aprender_org) aprendidos.push({ id_equipo: target.id_equipo, nombre: target.nombre, fiba_org_id: r.orgId });
      actualizados++;
      if (!dry) {
        const up = await fetch(`${REST}/equipos?id_equipo=eq.${target.id_equipo}`, { method: "PATCH", headers: { ...HDRS, Prefer: "return=minimal" }, body: JSON.stringify(upd) });
        if (up.ok) await up.body?.cancel();
      }
    }

    return j({
      ok: true, dry, crear_faltantes: crearFaltantes, gender,
      total_ranking: rows.length,
      actualizados,
      aprendidos_org_id: aprendidos.length,
      creados: creados.length,
      sin_crear_ni_mapear: sinCrearNiMapear.length,
      sin_zona: sinZona.length,
      detalle_creados: creados,
      detalle_sin_crear_ni_mapear: sinCrearNiMapear,
      detalle_aprendidos_sample: aprendidos.slice(0, 20),
    });
  } catch (e) {
    return j({ ok: false, error: String(e) }, 500);
  }
});
