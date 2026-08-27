import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { supabase, SUPABASE_URL, SUPABASE_KEY, fetchAll } from "./lib/supabaseClient";

const CalidadModal = lazy(() => import("./views/CalidadModal"));

/* inject bounce keyframe once */
if (!document.getElementById("bfdb-styles")) {
  const s = document.createElement("style");
  s.id = "bfdb-styles";
  s.textContent = `
    @keyframes bounce {
      0%,100% { transform: translateY(0) scaleX(1) scaleY(1); animation-timing-function: cubic-bezier(0.215,0.61,0.355,1); }
      40%      { transform: translateY(-32px) scaleX(0.95) scaleY(1.05); animation-timing-function: cubic-bezier(0.755,0.05,0.855,0.06); }
      70%      { transform: translateY(-16px) scaleX(0.95) scaleY(1.05); animation-timing-function: cubic-bezier(0.755,0.05,0.855,0.06); }
      90%      { transform: translateY(-4px); }
    }
    @keyframes shadow {
      0%,100% { transform: scaleX(1); opacity: 0.3; }
      40%,70%  { transform: scaleX(0.5); opacity: 0.1; }
    }
  `;
  document.head.appendChild(s);
}

const POSITIONS  = ["Base","Escolta","Alero","Ala-Pívot","Pívot"];
const TIPO_LABELS = { liga:"Liga", copacont:"Copa Continental", copadom:"Copa Nacional", internacional:"Internacional" };
function getCurrentSeason(players){
  var all=[];
  players.forEach(function(p){(p.seasons||[]).forEach(function(s){if(s.temporada)all.push(s.temporada);});});
  if(!all.length)return "";
  return all.sort(function(a,b){
    var ya=parseInt((a||"").slice(0,4));var yb=parseInt((b||"").slice(0,4));
    return ya!==yb?ya-yb:a.length-b.length;
  }).pop();
}
function firstFreeId(ids,prefix,pad){
  const s=new Set(ids.map(Number).filter(n=>!isNaN(n)&&n>0));
  let i=1; while(s.has(i))i++;
  return prefix+(pad?String(i).padStart(pad,"0"):i);
}
function firstFreeIdNum(ids){
  const s=new Set(ids.map(Number).filter(n=>!isNaN(n)&&n>0));
  let i=1; while(s.has(i))i++;
  return i;
}
function nextSeason(t){
  const m=(t||"").match(/^(\d{4})-(\d{2})$/);
  if(m){const y=parseInt(m[1])+1;return y+"-"+String(y+1).slice(-2);}
  const y=parseInt(t);return isNaN(y)?t:String(y+1);
}
function prevSeasonOf(t){
  const m=(t||"").match(/^(\d{4})-(\d{2})$/);
  if(m){const y=parseInt(m[1])-1;return y+"-"+String(y+1).slice(-2);}
  const y=parseInt(t);return isNaN(y)?t:String(y-1);
}

// Devuelve el nombre del equipo para una temporada concreta
// Si hay un registro en equipos_nombres que cubra esa temporada, lo usa; si no, el nombre actual
function resolveTeamData(id_equipo, temporada, equiposNombres, equipoMap){
  const startYear=t=>{const m=(t||"").match(/^(\d{4})/);return m?parseInt(m[1]):0;};
  const tYear=startYear(temporada);
  const record=(equiposNombres||[]).find(r=>{
    if(r.id_equipo!==id_equipo)return false;
    const desde=startYear(r.temporada_inicio);
    const hasta=r.temporada_fin?startYear(r.temporada_fin):9999;
    return tYear>=desde&&tYear<=hasta;
  });
  const base=equipoMap?.[id_equipo]||{};
  return {nombre:record?.nombre||base.nombre||id_equipo, escudo:record?.escudo||base.escudo||null};
}
function resolveTeamName(id_equipo, temporada, equiposNombres, equipoMap){
  return resolveTeamData(id_equipo, temporada, equiposNombres, equipoMap).nombre;
}
const TIPO_COLORS = {
  liga:    ["#dbeafe","#1d4ed8"],
  copacont:["#f3e8ff","#7c3aed"],
  copadom: ["#dcfce7","#15803d"],
  internacional: ["#e0f2fe","#0369a1"],
};

// Si se pasa fechaFin (p.ej. fallecimiento), calcula la edad hasta esa fecha, no hasta hoy.
const calcAge = (d, fechaFin) => d ? Math.floor(((fechaFin?new Date(fechaFin):new Date())-new Date(d))/(365.25*24*3600*1000)) : null;

function sortS(ss) {
  return [...(ss||[])].sort((a,b) => {
    const ay = a.temporada||a.year||"";
    const by = b.temporada||b.year||"";
    if (by !== ay) return by.localeCompare(ay);
    return (b.orden??0) - (a.orden??0);
  });
}

function toBase64(file) {
  return new Promise((res,rej) => {
    const r = new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file);
  });
}

/* ── Banderas ────────────────────────────────────────────── */
const COUNTRY_CODES = {
  /* Europa */
  "espana":"es","spain":"es","españa":"es",
  "france":"fr","francia":"fr",
  "italy":"it","italia":"it",
  "germany":"de","alemania":"de",
  "portugal":"pt",
  "netherlands":"nl","paises bajos":"nl","países bajos":"nl","holanda":"nl",
  "belgium":"be","belgica":"be","bélgica":"be",
  "switzerland":"ch","suiza":"ch",
  "austria":"at",
  "sweden":"se","suecia":"se",
  "norway":"no","noruega":"no",
  "denmark":"dk","dinamarca":"dk",
  "finland":"fi","finlandia":"fi",
  "ireland":"ie","irlanda":"ie",
  "iceland":"is","islandia":"is",
  "united kingdom":"gb","reino unido":"gb","gran bretana":"gb","gran bretaña":"gb","england":"gb","inglaterra":"gb","scotland":"gb","escocia":"gb","wales":"gb","gales":"gb",
  "russia":"ru","rusia":"ru",
  "ukraine":"ua","ucrania":"ua",
  "poland":"pl","polonia":"pl",
  "czech republic":"cz","republica checa":"cz","república checa":"cz","r. checa":"cz","chequia":"cz",
  "slovakia":"sk","eslovaquia":"sk",
  "hungary":"hu","hungria":"hu","hungría":"hu",
  "romania":"ro","rumania":"ro","rumanía":"ro",
  "bulgaria":"bg",
  "serbia":"rs",
  "croatia":"hr","croacia":"hr",
  "slovenia":"si","eslovenia":"si",
  "bosnia":"ba","bosnia y herzegovina":"ba","bosnia-herzegovina":"ba","bosnia and herzegovina":"ba",
  "montenegro":"me",
  "albania":"al",
  "north macedonia":"mk","macedonia del norte":"mk","macedonia":"mk",
  "kosovo":"xk",
  "greece":"gr","grecia":"gr",
  "turkey":"tr","turquia":"tr","turquía":"tr",
  "georgia":"ge",
  "armenia":"am",
  "azerbaijan":"az","azerbaiyan":"az","azerbaiyán":"az","azerbaidjan":"az",
  "moldova":"md","moldavia":"md",
  "belarus":"by","bielorrusia":"by",
  "estonia":"ee",
  "latvia":"lv","letonia":"lv",
  "lithuania":"lt","lituania":"lt",
  "luxembourg":"lu","luxemburgo":"lu",
  "cyprus":"cy","chipre":"cy",
  "malta":"mt",
  "andorra":"ad",
  "liechtenstein":"li",
  "monaco":"mc","mónaco":"mc",
  "san marino":"sm",
  "faroe islands":"fo","islas feroe":"fo",
  "gibraltar":"gi",

  /* América del Norte */
  "usa":"us","eeuu":"us","ee.uu.":"us","estados unidos":"us","united states":"us",
  "canada":"ca",
  "mexico":"mx","méxico":"mx",
  "cuba":"cu",
  "puerto rico":"pr",
  "dominican republic":"do","republica dominicana":"do","república dominicana":"do",
  "haiti":"ht","haití":"ht",
  "jamaica":"jm",
  "santa lucia":"lc","saint lucia":"lc",
  "trinidad and tobago":"tt","trinidad y tobago":"tt",
  "bahamas":"bs",
  "barbados":"bb",
  "saint vincent and the grenadines":"vc","san vicente y las granadinas":"vc",
  "costa rica":"cr",
  "guatemala":"gt",
  "honduras":"hn",
  "el salvador":"sv",
  "nicaragua":"ni",
  "panama":"pa","panamá":"pa",
  "dominica":"dm",
  "guyana":"gy",

  /* América del Sur */
  "brazil":"br","brasil":"br",
  "argentina":"ar",
  "colombia":"co",
  "venezuela":"ve",
  "peru":"pe","perú":"pe",
  "chile":"cl",
  "ecuador":"ec",
  "uruguay":"uy",
  "bolivia":"bo",
  "paraguay":"py",
  "suriname":"sr","surinam":"sr",

  /* África */
  "nigeria":"ng","niger":"ne",
  "senegal":"sn",
  "mali":"ml",
  "cameroon":"cm","camerun":"cm","camerún":"cm",
  "angola":"ao",
  "mozambique":"mz",
  "uganda":"ug",
  "kenya":"ke","kenia":"ke",
  "ethiopia":"et","etiopia":"et","etiopía":"et",
  "ghana":"gh","gambia":"gm",
  "antigua y barbuda":"ag","antigua and barbuda":"ag",
  "guinea ecuatorial":"gq","equatorial guinea":"gq",
  "sierra leona":"sl","sierra leone":"sl",
  "ivory coast":"ci","costa de marfil":"ci","cote d'ivoire":"ci",
  "egypt":"eg","egipto":"eg",
  "morocco":"ma","marruecos":"ma",
  "algeria":"dz","argelia":"dz",
  "tunisia":"tn","tunez":"tn","túnez":"tn","tunicia":"tn",
  "south africa":"za","sudafrica":"za","sudáfrica":"za",
  "tanzania":"tz",
  "rwanda":"rw",
  "congo":"cd","republica democratica del congo":"cd","república democrática del congo":"cd",
  "zambia":"zm",
  "zimbabwe":"zw","zimbabue":"zw",
  "guinea":"gn",
  "cape verde":"cv","cabo verde":"cv",
  "gabon":"ga","gabón":"ga",
  "benin":"bj","benín":"bj",
  "togo":"tg",
  "tonga":"to",
  "burkina faso":"bf",
  "guinea-bissau":"gw","guinea bisau":"gw","guinea-bisau":"gw",
  "camboya":"kh","cambodia":"kh",
  "libano":"lb","líbano":"lb","lebanon":"lb",

  /* Asia */
  "china":"cn",
  "japan":"jp","japon":"jp","japón":"jp",
  "south korea":"kr","corea del sur":"kr","korea":"kr","corea":"kr",
  "north korea":"kp","corea del norte":"kp",
  "india":"in",
  "israel":"il",
  "jordan":"jo","jordania":"jo",
  "iran":"ir","irán":"ir",
  "kazakhstan":"kz","kazajistan":"kz","kazajistán":"kz","kazajstan":"kz",
  "australia":"au",
  "new zealand":"nz","nueva zelanda":"nz",
  "philippines":"ph","filipinas":"ph",
  "indonesia":"id",
  "thailand":"th","tailandia":"th",
  "vietnam":"vn","vietnam":"vn",
  "malaysia":"my","malasia":"my",
  "singapore":"sg","singapur":"sg",
  "taiwan":"tw",
  "hong kong":"hk",
  "mongolia":"mn",
  "uzbekistan":"uz","uzbekistán":"uz",
  "belarus":"by",
  "syria":"sy","siria":"sy",

  /* Oceanía */
  "fiji":"fj","fiyi":"fj",
  "papua nueva guinea":"pg","papua new guinea":"pg",
  "islas virgenes de america":"vi","islas virgenes de estados unidos":"vi","islas virgenes de ee.uu.":"vi","islas virgenes de ee. uu.":"vi","islas virgenes de eeuu":"vi","us virgin islands":"vi","united states virgin islands":"vi",
  "burundi":"bi",
  "madagascar":"mg",
  "rd congo":"cd","república democrática del congo":"cd","republica democratica del congo":"cd","rdc":"cd",
  "ruanda":"rw","rwanda":"rw",
  "samoa":"ws","samoa americana":"as",
  "sudan del sur":"ss","sudán del sur":"ss","south sudan":"ss",
  "tahiti":"pf","tahití":"pf","french polynesia":"pf","polinesia francesa":"pf",
  "union sovietica":"ru","union soviética":"ru","urss":"ru","ussr":"ru","soviet union":"ru",
  "yugoslavia":"rs","checoslovaquia":"cz","czechoslovakia":"cz",
  "alemania oriental":"de","rda":"de","east germany":"de",
  "alemania occidental":"de","rfa":"de","west germany":"de",
  "oman":"om",
  "maldivas":"mv",
  "islas cook":"ck",
  "sri lanka":"lk",
  "irak":"iq",
  "guam":"gu",
  "botsuana":"bw",
  "taipei chino":"tw",
  "islas marianas del norte":"mp",
  "liberia":"lr",
  "republica centroafricana":"cf",
  "nueva caledonia":"nc",
  "palestina":"ps",
  "kirguistan":"kg",
  "malaui":"mw",
  "namibia":"na",
};

const ACP_COUNTRIES = new Set([
  /* África */
  "angola","benin","botswana","burkina faso","burundi","camerun","camerún","cabo verde","republica centroafricana","chad",
  "comoras","congo","republica democratica del congo","republic of the congo","djibouti","guinea ecuatorial","eritrea",
  "etiopia","etiopía","gabon","gabón","gambia","ghana","guinea","guinea-bisau","guinea-bissau","costa de marfil",
  "kenia","kenya","lesoto","liberia","madagascar","malawi","mali","mauritania","mauricio","mozambique","namibia",
  "niger","nigeria","ruanda","santo tome y principe","senegal","seychelles","sierra leona","somalia","sudafrica","sudáfrica",
  "sudan","suazilandia","eswatini","tanzania","togo","uganda","zambia","zimbabwe",
  /* Caribe */
  "antigua y barbuda","bahamas","barbados","belice","dominica","republica dominicana","república dominicana",
  "granada","guyana","haiti","haití","jamaica","san cristobal y nieves","santa lucia","san vicente y las granadinas",
  "surinam","suriname","trinidad y tobago","trinidad and tobago",
  /* Pacífico */
  "fiji","fiyi","kiribati","islas marshall","micronesia","nauru","palau","papua nueva guinea",
  "samoa","islas salomon","tonga","tuvalu","vanuatu","timor oriental",
]);
function isACP(nacionalidad) {
  if(!nacionalidad)return false;
  const n=nacionalidad.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
  return ACP_COUNTRIES.has(n);
}

const EU_COUNTRIES = new Set([
  /* UE + EEA */
  "espana","spain","france","francia","italy","italia","germany","alemania",
  "portugal","netherlands","paises bajos","holanda","belgium","belgica",
  "switzerland","suiza","sweden","suecia","norway","noruega","denmark","dinamarca",
  "finland","finlandia","ireland","irlanda","iceland","islandia","greece","grecia",
  "poland","polonia","czech republic","republica checa","chequia","r. checa",
  "slovakia","eslovaquia","hungary","hungria","romania","rumania",
  "bulgaria","croatia","croacia","slovenia","eslovenia","estonia","latvia","letonia",
  "lithuania","lituania","luxembourg","luxemburgo","cyprus","chipre","malta","austria",
  /* Resto Europa continental */
  "serbia","turquia","turkey","ucrania","ukraine","rusia","russia",
  "georgia","armenia","azerbaijan","azerbaiyan",
  "moldova","belarus","bielorrusia","albania","kosovo",
  "montenegro","bosnia","bosnia y herzegovina","north macedonia","macedonia del norte","macedonia",
  "andorra","monaco","san marino","liechtenstein",
]);
function playerStatus(nac,nac2){
  const norm=s=>s?.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim()||"";
  const n1=norm(nac),n2=norm(nac2);
  if(n1==="espana"||n1==="spain")return "cantera";
  if(EU_COUNTRIES.has(n1)||EU_COUNTRIES.has(n2))return "europea";
  if(ACP_COUNTRIES.has(n1)||ACP_COUNTRIES.has(n2))return "acp";
  if(n1)return "extra";
  return null;
}
function esEquipoEuropeo(pais){
  const n=(pais||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  return n==="europa"||n==="europe"||EU_COUNTRIES.has(n);
}

function countryCode(c) {
  if (!c) return null;
  return COUNTRY_CODES[c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim()] || null;
}

// Construye el emoji de bandera regional a partir de un código ISO de 2 letras.
// Mismo mecanismo que en api/_lib/countryFlags.js (servidor), duplicado aquí porque
// este archivo corre en el navegador y no puede hacer require() de la carpeta api/.
function flagEmoji(isoCode) {
  if (!isoCode || isoCode.length !== 2) return "";
  const codePoints = isoCode.toUpperCase().split("").map(ch => 0x1F1E6 + (ch.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}
// Entidades sin código ISO de país real (selecciones mixtas/neutrales en JJOO).
// No tienen cabida en COUNTRY_CODES porque no son países; se gestionan aparte.
const NO_COUNTRY_FLAGS = { "equipo unificado": "🏳️" };

function countryFlagEmoji(nombrePais) {
  if (!nombrePais) return "";
  const norm = nombrePais.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  if (NO_COUNTRY_FLAGS[norm]) return NO_COUNTRY_FLAGS[norm];
  const code = countryCode(nombrePais);
  return code ? flagEmoji(code) : "";
}

function FlagImg({ country }) {
  if (!country) return null;
  const norm = country.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  if (norm === "europa" || norm === "europe" || norm === "eu") return <img src="https://flagcdn.com/20x15/eu.png" width={20} height={15} alt="Europa" title={country} style={{display:"inline-block",verticalAlign:"middle",borderRadius:"2px",flexShrink:0,marginRight:"4px"}}/>;
  if (norm === "mundo" || norm === "world" || norm === "international" || norm === "internacional") return <span title={country} style={{fontSize:"14px",lineHeight:1,marginRight:"4px",verticalAlign:"middle"}}>🌍</span>;
  if (norm === "americas" || norm === "america" || norm === "amerique") return <span title={country} style={{fontSize:"14px",lineHeight:1,marginRight:"4px",verticalAlign:"middle"}}>🌎</span>;
  if (norm.includes("afric")) return <span title={country} style={{fontSize:"14px",lineHeight:1,marginRight:"4px",verticalAlign:"middle"}}>🌍</span>;
  if (norm === "asia" || norm === "oceania" || norm === "oceanía") return <span title={country} style={{fontSize:"14px",lineHeight:1,marginRight:"4px",verticalAlign:"middle"}}>🌏</span>;
  const code = countryCode(country);
  if (!code) return null;
  return <img src={`https://flagpedia.net/data/flags/w160/${code}.webp`} width={20} height={13} alt={country} title={country}
    style={{display:"inline-block",verticalAlign:"middle",borderRadius:"2px",flexShrink:0,marginRight:"4px"}}/>;
}

function MultiFlag({ countries, width=20, height=13 }) {
  const list=(countries||[]).filter(Boolean);
  if(!list.length)return null;
  if(list.length===1)return <FlagImg country={list[0]}/>;
  const codes=list.map(c=>countryCode(c)).filter(Boolean);
  if(codes.length!==list.length){
    // fallback: alguno no tiene código de bandera real, mostrar banderas normales seguidas
    return <>{list.map((c,i)=><FlagImg key={i} country={c}/>)}</>;
  }
  const n=codes.length;
  const stripeW=width/n;
  return (
    <span title={list.join(" / ")} style={{display:"inline-flex",width,height,borderRadius:"2px",overflow:"hidden",verticalAlign:"middle",flexShrink:0,marginRight:"4px"}}>
      {codes.map((code,i)=>(
        <span key={i} style={{width:stripeW,height,overflow:"hidden",position:"relative",flexShrink:0}}>
          <img src={`https://flagpedia.net/data/flags/w160/${code}.webp`} alt={list[i]}
            style={{position:"absolute",left:-i*stripeW,top:0,width,height,objectFit:"cover"}}/>
        </span>
      ))}
    </span>
  );
}

/* ── Equipo ──────────────────────────────────────────────── */
function teamHue(s=""){let h=0;for(const c of s)h=(h<<5)-h+c.charCodeAt(0);return Math.abs(h)%360;}
function teamColors(n){const h=teamHue(n);return{bg:`hsl(${h},55%,38%)`,light:`hsl(${h},55%,92%)`,text:`hsl(${h},55%,25%)`};}
function teamInitials(n=""){return n.split(/[\s\-\_]+/).map(w=>w[0]?.toUpperCase()||"").slice(0,3).join("");}

function SocialIcon({url}){
  if(!url)return null;
  const u=url.toLowerCase();
  let svg,color,label;

  const ICONS={
    instagram:(
      <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    twitter:(
      <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    facebook:(
      <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    youtube:(
      <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    tiktok:(
      <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
      </svg>
    ),
    web:(
      <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    ),
  };

  if(u.includes("instagram")){svg=ICONS.instagram;color="#E1306C";label="Instagram";}
  else if(u.includes("x.com")||u.includes("twitter")){svg=ICONS.twitter;color="#000";label="X/Twitter";}
  else if(u.includes("facebook")){svg=ICONS.facebook;color="#1877F2";label="Facebook";}
  else if(u.includes("youtube")){svg=ICONS.youtube;color="#FF0000";label="YouTube";}
  else if(u.includes("tiktok")){svg=ICONS.tiktok;color="#000";label="TikTok";}
  else{svg=ICONS.web;color="#64748b";label="Web";}

  return(
    <a href={url} target="_blank" rel="noopener noreferrer" title={label}
      style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"38px",height:"38px",borderRadius:"50%",background:color,textDecoration:"none",flexShrink:0,boxShadow:"0 2px 8px rgba(0,0,0,0.2)",transition:"transform 0.15s"}}
      onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
      onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
      {svg}
    </a>
  );
}

function TeamBadge({team,size=44}){
  const {bg}=teamColors(team?.nombre||"");
  const ini=teamInitials(team?.nombre||"");
  const fs=size<36?9:size<50?12:16;
  if(team?.escudo) return <img src={team.escudo} alt={team.nombre} style={{width:size,height:size,borderRadius:"8px",objectFit:"contain",flexShrink:0,border:"1px solid #e2e8f0",background:"#fff",boxSizing:"border-box"}} onError={e=>e.target.style.display="none"}/>;  return <div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:fs,flexShrink:0,boxShadow:"0 2px 6px rgba(0,0,0,0.2)"}}>{ini}</div>;
}

function LeagueBadge({liga,size=60}){
  const [bg,color]=TIPO_COLORS[liga?.tipo]||["#f1f5f9","#475569"];
  const fs=size<40?10:size<60?14:18;
  if(liga?.logo) return <img src={liga.logo} alt={liga.nombre} style={{width:size,height:size,objectFit:"contain",flexShrink:0,borderRadius:"10px"}} onError={e=>e.target.style.display="none"}/>;
  return <div style={{width:size,height:size,borderRadius:"10px",background:bg,display:"flex",alignItems:"center",justifyContent:"center",color,fontWeight:800,fontSize:fs,flexShrink:0,textAlign:"center",padding:"4px"}}>{liga?.nombre?.split(" ").map(w=>w[0]).slice(0,3).join("")||"?"}</div>;
}

function Avatar({photo,name,size=48,fontSize=18,fallecida=false,onPhotoClick=null}){
  const ini=(name||"").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  const proxy=url=>`https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${size*2}&h=${size*2}&fit=cover&output=webp`;
  const handleError=e=>{
    const img=e.target;
    if(!img.dataset.proxied&&img.src&&!img.src.includes("wsrv.nl")){
      img.dataset.proxied="1";
      img.src=proxy(photo);
    }else{
      img.style.display="none";
    }
  };
  // El lazo negro (luto) se superpone en la esquina inferior derecha del avatar.
  // Path real del icono "Ribbon" sólido de Font Awesome Free (licencia CC BY 4.0),
  // no dibujado a mano: es una silueta rellenable, a diferencia del de trazo usado antes.
  const ribbonSize=Math.max(18,size*0.4);
  const ribbon=fallecida&&(
    <div title="Fallecida" style={{position:"absolute",bottom:-2,right:-2,width:ribbonSize,height:ribbonSize,borderRadius:"50%",background:"#fff",border:"1.5px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width={ribbonSize*0.58} height={ribbonSize*0.58} viewBox="0 0 384 512" fill="#0f0f0f">
        <path d="M235.1 0c33.4 0 64.5 17.4 81.9 45.9 1.2 2 13 21.3 35.3 57.8 21.1 34.5 18.3 78.5-7 110L278.3 297.7 364.5 406c5.5 6.9 4.4 16.9-2.5 22.5l-80 64c-6.9 5.5-17 4.4-22.5-2.5L38.6 213.8C13.3 182.3 10.5 138.3 31.6 103.8 54 67.2 65.7 47.9 67 45.9 84.4 17.4 115.4 0 148.9 0l86.3 0zM192 189.2l48.6-61.2-97.3 0 48.6 61.2zM75 336.2l86.2 107.8-36.8 46c-5.5 6.9-15.6 8-22.5 2.5l-80-64c-6.9-5.5-8-15.6-2.5-22.5L75 336.2z"/>
      </svg>
    </div>
  );
  // onPhotoClick es opt-in: solo se activa el cursor/clic donde se pase explícitamente
  // (ficha individual de jugadora/entrenador), no en miniaturas de listados/búsqueda.
  const clickProps=onPhotoClick&&photo?{onClick:()=>onPhotoClick(photo),style:{cursor:"pointer"}}:{};
  if(photo) return <div {...clickProps} style={{...clickProps.style,position:"relative",display:"inline-flex",flexShrink:0}}><img src={photo} alt={name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"2px solid #e2e8f0",filter:fallecida?"grayscale(60%)":"none"}} onError={handleError}/>{ribbon}</div>;
  return <div style={{position:"relative",display:"inline-flex",flexShrink:0}}><div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,#9333ea,#c084fc)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontWeight:800,fontSize,letterSpacing:"-0.5px"}}>{ini}</div>{ribbon}</div>;
}

function PhotoLightbox({photo,onClose}){
  if(!photo) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",cursor:"zoom-out"}}>
      <button onClick={onClose} style={{position:"absolute",top:"16px",right:"20px",background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"50%",width:"40px",height:"40px",color:"#fff",fontSize:"22px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      <img src={photo} alt="" onClick={e=>e.stopPropagation()} style={{maxWidth:"90vw",maxHeight:"85vh",borderRadius:"12px",objectFit:"contain",boxShadow:"0 20px 60px rgba(0,0,0,0.5)",cursor:"default"}}/>
    </div>
  );
}

/* ── Estilos ─────────────────────────────────────────────── */
const POS_C={"Base":["#dbeafe","#1d4ed8"],"Escolta":["#dcfce7","#15803d"],"Alero":["#fef9c3","#a16207"],"Ala-Pívot":["#ffedd5","#c2410c"],"Pívot":["#fee2e2","#b91c1c"]};
const posStyle=p=>{const [bg,color]=POS_C[p]||["#f1f5f9","#475569"];return{background:bg,color,fontSize:"11px",fontWeight:700,padding:"3px 10px",borderRadius:"20px",whiteSpace:"nowrap"};};
const inp={width:"100%",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"14px",color:"#1e293b",outline:"none",boxSizing:"border-box",background:"#fff"};

function Fld({label,children}){return <div style={{marginBottom:"14px"}}><label style={{display:"block",fontSize:"12px",fontWeight:700,color:"#64748b",marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</label>{children}</div>;}

function Modal({title,onClose,children}){return(
  <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
    <div style={{background:"#fff",borderRadius:"20px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",width:"100%",maxWidth:"500px",maxHeight:"92vh",overflowY:"auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px",borderBottom:"1px solid #e2e8f0"}}>
        <h2 style={{fontWeight:700,fontSize:"18px",color:"#1e293b",margin:0}}>{title}</h2>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:"26px",color:"#94a3b8",cursor:"pointer",lineHeight:1}}>×</button>
      </div>
      <div style={{padding:"24px"}}>{children}</div>
    </div>
  </div>
);}

function ConfirmDel({msg,onCancel,onConfirm}){return(
  <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
    <div style={{background:"#fff",borderRadius:"20px",padding:"28px",maxWidth:"360px",width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
      <div style={{fontSize:"40px",marginBottom:"12px"}}>⚠️</div>
      <h3 style={{fontWeight:700,fontSize:"18px",color:"#1e293b",margin:"0 0 10px"}}>¿Eliminar?</h3>
      <p style={{color:"#64748b",fontSize:"14px",margin:"0 0 22px"}}>{msg}</p>
      <div style={{display:"flex",gap:"10px"}}>
        <button onClick={onCancel} style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"11px",color:"#64748b",background:"#fff",cursor:"pointer",fontWeight:600}}>Cancelar</button>
        <button onClick={onConfirm} style={{flex:1,background:"#ef4444",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",cursor:"pointer",fontWeight:700}}>Eliminar</button>
      </div>
    </div>
  </div>
);}

function PhotoPicker({value,onChange}){
  const [mode,setMode]=useState("url");
  const ref=useRef();
  const handleFile=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>3*1024*1024){alert("Máx 3 MB");return;}onChange(await toBase64(f));};
  const inp={width:"100%",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 12px",fontSize:"13px",outline:"none",boxSizing:"border-box"};
  return(
    <div style={{marginBottom:"8px"}}>
      <label style={{display:"block",fontSize:"12px",fontWeight:700,color:"#64748b",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Foto</label>
      <div style={{display:"flex",alignItems:"flex-start",gap:"14px"}}>
        {value?<img src={value} alt="" style={{width:56,height:56,borderRadius:"50%",objectFit:"cover",border:"3px solid #c084fc",flexShrink:0}}/>
          :<div style={{width:56,height:56,borderRadius:"50%",background:"#f1f5f9",border:"2px dashed #cbd5e1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0}}>🖼️</div>}
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}>
            <button type="button" onClick={()=>setMode("url")} style={{background:mode==="url"?"#9333ea":"#f1f5f9",color:mode==="url"?"#fff":"#475569",border:"none",borderRadius:"8px",padding:"5px 12px",fontSize:"12px",cursor:"pointer",fontWeight:600}}>URL</button>
            <button type="button" onClick={()=>{onChange("https://static.flashscore.com/res/image/empty-face-woman-share.gif");setMode("url");}} style={{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:"8px",padding:"5px 12px",fontSize:"12px",cursor:"pointer",fontWeight:600}}>🖼️ Default</button>
            {value&&<button type="button" onClick={()=>onChange(null)} style={{background:"none",border:"none",fontSize:"11px",color:"#ef4444",cursor:"pointer",marginLeft:"auto"}}>Eliminar</button>}
          </div>
          {mode==="url"&&<input style={inp} value={value&&!value.startsWith("data:")?value:""} onChange={e=>onChange(e.target.value||null)} placeholder="https://ejemplo.com/foto.jpg"/>}
        </div>
      </div>
    </div>
  );
}

function EscudoPicker({value,onChange}){
  const inp={width:"100%",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 12px",fontSize:"13px",outline:"none",boxSizing:"border-box"};
  return(
    <div style={{marginBottom:"8px"}}>
      <label style={{display:"block",fontSize:"12px",fontWeight:700,color:"#64748b",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Escudo</label>
      <div style={{display:"flex",alignItems:"flex-start",gap:"14px"}}>
        {value?<img src={value} alt="" style={{width:56,height:56,borderRadius:"8px",objectFit:"contain",border:"1.5px solid #e2e8f0",flexShrink:0,background:"#fff"}} onError={e=>e.target.style.display="none"}/>
          :<div style={{width:56,height:56,borderRadius:"8px",background:"#f1f5f9",border:"2px dashed #cbd5e1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0}}>🛡️</div>}
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}>
            <button type="button" onClick={()=>onChange("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ5paClUbICyOfUdZW-l6ZpDux6XhXG3HmDkw&s")} style={{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:"8px",padding:"5px 12px",fontSize:"12px",cursor:"pointer",fontWeight:600}}>🛡️ Default</button>
            {value&&<button type="button" onClick={()=>onChange(null)} style={{background:"none",border:"none",fontSize:"11px",color:"#ef4444",cursor:"pointer",marginLeft:"auto"}}>Eliminar</button>}
          </div>
          <input style={inp} value={value||""} onChange={e=>onChange(e.target.value||null)} placeholder="https://ejemplo.com/escudo.png"/>
        </div>
      </div>
    </div>
  );
}

/* ── PartidoForm ─────────────────────────────────────────── */
// Fld definido fuera del componente para evitar que React desmonte/remonte
// los inputs al redefiniria en cada render (causaba pérdida de foco al escribir).
function PartidoFld({label,children}){
  return <div style={{marginBottom:"10px"}}><label style={{display:"block",fontSize:"11px",fontWeight:700,color:"#64748b",marginBottom:"5px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</label>{children}</div>;
}

function PartidoForm({initial,equipos,ligas,onSave,onCancel,saving}){
  const inp={width:"100%",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",outline:"none",boxSizing:"border-box"};
  const inpNum={border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"16px",fontWeight:700,outline:"none",boxSizing:"border-box",width:"80px",textAlign:"center"};
  const [f,setF]=useState({id_liga:"",temporada:"",id_equipo_local:"",id_equipo_visitante:"",fecha_hora:"",link:"",url_stats:"",notas:"",resultado_local:"",resultado_visitante:"",...(initial||{})});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const Fld=PartidoFld;
  const toLocal=iso=>{if(!iso)return"";const d=new Date(iso);const pad=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;};
  const [localDt,setLocalDt]=useState(toLocal(f.fecha_hora));
  const equiposSorted=[...equipos].sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||"","es"));
  const ligasSorted=[...ligas].sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||"","es"));
  const localNombre=equipos.find(e=>e.id_equipo===f.id_equipo_local)?.nombre||"Local";
  const visitNombre=equipos.find(e=>e.id_equipo===f.id_equipo_visitante)?.nombre||"Visitante";
  return(
    <div style={{background:"#fff",borderRadius:"20px",padding:"22px",boxShadow:"0 2px 12px rgba(0,0,0,0.1)",maxWidth:"500px",margin:"0 auto"}}>
      <h2 style={{fontWeight:800,fontSize:"18px",color:"#1e293b",marginTop:0,marginBottom:"18px"}}>{initial?.id?"Editar partido":"Nuevo partido"}</h2>
      <Fld label="Liga">
        <select style={inp} value={f.id_liga} onChange={set("id_liga")}>
          <option value="">— Selecciona liga —</option>
          {ligasSorted.map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
        </select>
      </Fld>
      <Fld label="Temporada">
        <input style={inp} value={f.temporada||""} onChange={set("temporada")} placeholder="2026 o 2025-26"/>
      </Fld>
      <Fld label="Equipo local">
        <select style={inp} value={f.id_equipo_local} onChange={set("id_equipo_local")}>
          <option value="">— Selecciona equipo —</option>
          {equiposSorted.map(e=><option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>)}
        </select>
      </Fld>
      <Fld label="Equipo visitante">
        <select style={inp} value={f.id_equipo_visitante} onChange={set("id_equipo_visitante")}>
          <option value="">— Selecciona equipo —</option>
          {equiposSorted.map(e=><option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>)}
        </select>
      </Fld>
      <Fld label="Fecha y hora">
        <input style={inp} type="datetime-local" value={localDt} onChange={e=>{setLocalDt(e.target.value);setF(p=>({...p,fecha_hora:e.target.value?new Date(e.target.value).toISOString():""}));}}/>
      </Fld>
      <Fld label="Resultado (dejar vacío si no ha acabado)">
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{textAlign:"center",flex:1}}>
            <div style={{fontSize:"11px",color:"#64748b",marginBottom:"4px",fontWeight:600}}>{localNombre}</div>
            <input style={inpNum} type="number" min="0" value={f.resultado_local??""} onChange={e=>setF(p=>({...p,resultado_local:e.target.value===""?null:Number(e.target.value)}))} placeholder="—"/>
          </div>
          <span style={{fontWeight:800,fontSize:"20px",color:"#9333ea"}}>-</span>
          <div style={{textAlign:"center",flex:1}}>
            <div style={{fontSize:"11px",color:"#64748b",marginBottom:"4px",fontWeight:600}}>{visitNombre}</div>
            <input style={inpNum} type="number" min="0" value={f.resultado_visitante??""} onChange={e=>setF(p=>({...p,resultado_visitante:e.target.value===""?null:Number(e.target.value)}))} placeholder="—"/>
          </div>
        </div>
      </Fld>
      <Fld label="Link para ver el partido (opcional)">
        <input style={inp} value={f.link||""} onChange={set("link")} placeholder="https://..."/>
      </Fld>
      <Fld label="URL estadísticas FIBA (opcional)">
        <input style={inp} value={f.url_stats||""} onChange={set("url_stats")} placeholder="https://www.fiba.basketball/en/events/.../games/131760-SWE-LAT"/>
      </Fld>
      <Fld label="Notas (opcional)">
        <input style={inp} value={f.notas||""} onChange={set("notas")} placeholder="Semifinal, Grupo A..."/>
      </Fld>
      <div style={{display:"flex",gap:"10px",marginTop:"20px"}}>
        <button onClick={()=>onSave(f)} disabled={saving||!f.id_equipo_local||!f.id_equipo_visitante||!f.fecha_hora}
          style={{flex:1,background:"#9333ea",color:"#fff",border:"none",borderRadius:"12px",padding:"12px",fontWeight:700,fontSize:"14px",cursor:"pointer",opacity:(saving||!f.id_equipo_local||!f.id_equipo_visitante||!f.fecha_hora)?0.5:1}}>
          {saving?"Guardando...":"Guardar"}
        </button>
        <button onClick={onCancel} style={{flex:1,background:"#f1f5f9",color:"#475569",border:"none",borderRadius:"12px",padding:"12px",fontWeight:700,fontSize:"14px",cursor:"pointer"}}>Cancelar</button>
      </div>
    </div>
  );
}

/* ── PartidoFichaView ────────────────────────────────────── */
function BoxscorePartido({idPartido,equipoLocal,equipoVisit,local,visit,players,onGoToPlayer}){
  const [rows,setRows]=useState(null);
  const [tab,setTab]=useState("ambos");
  const [sortK,setSortK]=useState("puntos");
  const [sortD,setSortD]=useState("desc");
  const jugMap=useMemo(()=>{const m={};(players||[]).forEach(p=>{m[p.id_jugadora]=p;});return m;},[players]);
  useEffect(()=>{
    let cancel=false; setRows(null);
    (async()=>{
      const {data}=await supabase.from("partido_boxscore").select("id_jugadora,id_equipo,nombre,titular,minutos,puntos,tc_anotados,tc_intentados,t3_anotados,t3_intentados,tl_anotados,tl_intentados,reb_totales,asistencias,robos,tapones,perdidas,faltas,valoracion").eq("id_partido",idPartido);
      if(!cancel)setRows(data||[]);
    })();
    return ()=>{cancel=true;};
  },[idPartido]);
  if(rows===null||rows.length===0)return null;

  const N=v=>{if(typeof v==="string"&&v.indexOf(":")>=0){const p=v.split(":");return (parseInt(p[0],10)||0)+(parseInt(p[1],10)||0)/60;}return Number(v)||0;};
  const filt=tab==="local"?rows.filter(r=>r.id_equipo===equipoLocal):tab==="visit"?rows.filter(r=>r.id_equipo===equipoVisit):rows;
  const cols=[{k:"nombre",l:"Jugadora"},{k:"minutos",l:"MIN"},{k:"puntos",l:"PTS"},{k:"tc_anotados",l:"TC"},{k:"t3_anotados",l:"T3"},{k:"tl_anotados",l:"TL"},{k:"reb_totales",l:"REB"},{k:"asistencias",l:"AST"},{k:"robos",l:"ROB"},{k:"tapones",l:"TAP"},{k:"perdidas",l:"PER"},{k:"faltas",l:"FAL"},{k:"valoracion",l:"VAL"}];
  const sorted=[...filt].sort((a,b)=>{
    if(sortK==="nombre")return sortD==="asc"?(a.nombre||"").localeCompare(b.nombre||""):(b.nombre||"").localeCompare(a.nombre||"");
    const d=N(a[sortK])-N(b[sortK]); return sortD==="asc"?d:-d;
  });
  const clickSort=k=>{if(sortK===k)setSortD(d=>d==="desc"?"asc":"desc");else{setSortK(k);setSortD(k==="nombre"?"asc":"desc");}};
  const th={padding:"7px 5px",fontSize:"10px",fontWeight:700,color:"#94a3b8",whiteSpace:"nowrap",cursor:"pointer",borderBottom:"2px solid #f1f5f9",userSelect:"none"};
  const td={padding:"7px 5px",fontSize:"12px",color:"#334155",textAlign:"center",whiteSpace:"nowrap",borderBottom:"1px solid #f8fafc"};
  const Esc=({e})=>e&&e.escudo?<img src={e.escudo} alt="" style={{width:18,height:18,objectFit:"contain"}}/>:null;
  const tabBtn=(k,content)=><button key={k} onClick={()=>setTab(k)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",padding:"9px 6px",borderRadius:"10px",border:"none",cursor:"pointer",fontWeight:700,fontSize:"12px",background:tab===k?"#9333ea":"#f1f5f9",color:tab===k?"#fff":"#64748b",minWidth:0}}>{content}</button>;

  return(
    <div style={{background:"#fff",borderRadius:"20px",padding:"16px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",overflowX:"auto"}}>
      <h2 style={{fontWeight:800,fontSize:"16px",color:"#1e293b",margin:"0 0 12px"}}>Estadísticas</h2>
      <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
        {tabBtn("ambos",<><Esc e={local}/><Esc e={visit}/></>)}
        {tabBtn("local",<><Esc e={local}/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{local&&local.nombre}</span></>)}
        {tabBtn("visit",<><Esc e={visit}/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{visit&&visit.nombre}</span></>)}
      </div>
      <table style={{borderCollapse:"collapse",width:"100%",minWidth:"640px"}}>
        <thead><tr>{cols.map(c=><th key={c.k} onClick={()=>clickSort(c.k)} style={{...th,textAlign:c.k==="nombre"?"left":"center"}}>{c.l}{sortK===c.k?(sortD==="desc"?" ▾":" ▴"):""}</th>)}</tr></thead>
        <tbody>
          {sorted.map((r,i)=>{
            const es=r.id_equipo===equipoLocal;
            const bg=es?"#fff7ed":"#eff6ff";
            const jug=jugMap[r.id_jugadora];
            const nom=(jug&&jug.nombre)||r.nombre;
            const foto=jug&&jug.foto;
            return(
            <tr key={i} onClick={()=>onGoToPlayer&&onGoToPlayer(r.id_jugadora)} style={{cursor:onGoToPlayer?"pointer":"default",background:tab==="ambos"?bg:"transparent",borderLeft:r.titular?"4px solid #9333ea":"4px solid transparent"}}>
              <td style={{...td,textAlign:"left",fontWeight:600,maxWidth:"180px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  {foto?<img src={foto} alt="" style={{width:28,height:28,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"1px solid #f1f5f9"}} onError={e=>{e.target.style.visibility="hidden";}}/>:<div style={{width:28,height:28,borderRadius:"50%",background:"#f1f5f9",flexShrink:0}}/>}
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nom}</span>
                </div>
              </td>
              <td style={td}>{r.minutos}</td>
              <td style={{...td,fontWeight:700}}>{r.puntos}</td>
              <td style={td}>{r.tc_anotados}/{r.tc_intentados}</td>
              <td style={td}>{r.t3_anotados}/{r.t3_intentados}</td>
              <td style={td}>{r.tl_anotados}/{r.tl_intentados}</td>
              <td style={td}>{r.reb_totales}</td>
              <td style={td}>{r.asistencias}</td>
              <td style={td}>{r.robos}</td>
              <td style={td}>{r.tapones}</td>
              <td style={td}>{r.perdidas}</td>
              <td style={td}>{r.faltas}</td>
              <td style={{...td,fontWeight:700}}>{r.valoracion}</td>
            </tr>
            );})}
        </tbody>
      </table>
      <div style={{fontSize:"10px",color:"#cbd5e1",marginTop:"8px"}}><span style={{display:"inline-block",width:"3px",height:"10px",background:"#9333ea",borderRadius:"1px",verticalAlign:"middle",marginRight:"4px"}}></span>Titular · toca una columna para ordenar</div>
    </div>
  );
}

function PartidoFichaView({partido,equipos,ligas,players,equiposNombres,isAdmin,onToggleConvocatoria,onBack,onEdit,onGoToTeam,onGoToLeague,onGoToPlayer}){
  const equipoMap=useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap=useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);
  const localBase=equipoMap[partido.id_equipo_local];
  const local=localBase&&{...localBase,...resolveTeamData(partido.id_equipo_local,partido.temporada,equiposNombres,equipoMap)};
  const visitBase=equipoMap[partido.id_equipo_visitante];
  const visit=visitBase&&{...visitBase,...resolveTeamData(partido.id_equipo_visitante,partido.temporada,equiposNombres,equipoMap)};
  const liga=ligaMap[partido.id_liga];
  const pasado=new Date(partido.fecha_hora)<new Date();
  const tieneResultado=partido.resultado_local!=null&&partido.resultado_visitante!=null;

  // Roster: jugadoras del equipo EN LA TEMPORADA del partido. Si el partido no tiene
  // temporada (datos antiguos), se cae al comportamiento previo: la temporada más
  // reciente de cada jugadora en ese equipo.
  const rosterPara=id=>{
    const temp=partido.temporada||"";
    let conTemp;
    if(temp){
      conTemp=players
        .filter(p=>(p.seasons||[]).some(s=>s.id_equipo===id&&(s.temporada||"")===temp))
        .map(p=>({...p,lastSeason:temp}));
    }else{
      const todas=players.filter(p=>(p.seasons||[]).some(s=>s.id_equipo===id));
      conTemp=todas.map(p=>{
        const seasonsEq=(p.seasons||[]).filter(s=>s.id_equipo===id).sort((a,b)=>b.temporada.localeCompare(a.temporada));
        return{...p,lastSeason:seasonsEq[0]?.temporada||""};
      });
    }
    // Ordenar por posición
    const orden=["Base","Escolta","Alero","Ala-Pívot","Pívot"];
    return conTemp.sort((a,b)=>(orden.indexOf(a.posicion)-orden.indexOf(b.posicion))||a.nombre.localeCompare(b.nombre,"es"));
  };

  // Convocatoria del partido: no_convocadas (jsonb) guarda ids de jugadoras de la
  // plantilla que NO juegan este partido. Solo afecta a esta ficha, no a la plantilla.
  const noConvocadas=useMemo(()=>new Set(partido.no_convocadas||[]),[partido]);
  const rosterLocal=useMemo(()=>rosterPara(partido.id_equipo_local),[partido,players]);
  const rosterVisit=useMemo(()=>rosterPara(partido.id_equipo_visitante),[partido,players]);

  const fmtDt=iso=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})+" · "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});};

  const RosterCol=({equipo,roster,side})=>{
    const convocadas=roster.filter(p=>!noConvocadas.has(p.id_jugadora));
    const fuera=roster.filter(p=>noConvocadas.has(p.id_jugadora));
    const fila=(p,esConvocada)=>(
      <div key={p.id_jugadora} onClick={()=>onGoToPlayer&&onGoToPlayer(p.id_jugadora)}
        style={{display:"flex",alignItems:"center",gap:"8px",padding:"6px 0",borderBottom:"1px solid #f1f5f9",flexDirection:side==="right"?"row-reverse":"row",cursor:onGoToPlayer?"pointer":"default",opacity:esConvocada?1:0.45}}>
        <Avatar photo={p.foto} name={p.nombre} size={28} fontSize={10} fallecida={!!p.fecha_fallecimiento}/>
        <div style={{flex:1,minWidth:0,textAlign:side==="right"?"right":"left"}}>
          <div style={{fontSize:"12px",fontWeight:600,color:onGoToPlayer?"#9333ea":"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:esConvocada?"none":"line-through"}}>{p.nombre}</div>
          <div style={{fontSize:"10px",color:"#94a3b8"}}>{p.posicion||""}</div>
        </div>
        {isAdmin&&onToggleConvocatoria&&(
          <button title={esConvocada?"Quitar de la convocatoria de este partido":"Devolver a la convocatoria"}
            onClick={e=>{e.stopPropagation();onToggleConvocatoria(partido,p.id_jugadora);}}
            style={{background:esConvocada?"#fef2f2":"#f0fdf4",color:esConvocada?"#ef4444":"#16a34a",border:"none",borderRadius:"8px",width:"22px",height:"22px",fontSize:"12px",fontWeight:800,cursor:"pointer",flexShrink:0,lineHeight:1}}>
            {esConvocada?"✕":"+"}
          </button>
        )}
      </div>
    );
    return(
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px",flexDirection:side==="right"?"row-reverse":"row"}}>
          {equipo?.escudo&&<img src={equipo.escudo} alt="" style={{width:32,height:32,objectFit:"contain"}}/>}
          <span style={{fontWeight:700,fontSize:"14px",color:"#1e293b",textAlign:side==="right"?"right":"left"}}>{equipo?.nombre||"—"}</span>
        </div>
        {roster.length===0?<p style={{fontSize:"12px",color:"#94a3b8",textAlign:"center"}}>Sin jugadoras en BD</p>:(
          <>
            {convocadas.map(p=>fila(p,true))}
            {/* Las no convocadas solo las ve el admin (atenuadas, con + para devolverlas);
                para el público simplemente no aparecen en el partido. */}
            {isAdmin&&fuera.length>0&&(
              <>
                <div style={{fontSize:"10px",fontWeight:800,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.5px",margin:"10px 0 2px",textAlign:side==="right"?"right":"left"}}>No convocadas (solo admin)</div>
                {fuera.map(p=>fila(p,false))}
              </>
            )}
          </>
        )}
      </div>
    );
  };

  return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"16px",fontFamily:"system-ui,sans-serif"}}>
      {/* Barra superior: volver + acciones (ver partido, stats, editar) */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",gap:"8px",flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#9333ea",fontWeight:700,fontSize:"15px",cursor:"pointer",padding:0}}>← Volver</button>
        <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
          {partido.link&&<a href={partido.link} target="_blank" rel="noopener noreferrer" style={{background:"#7c3aed",color:"#fff",borderRadius:"20px",padding:"7px 16px",fontSize:"12px",fontWeight:700,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:"5px"}}>▶ Ver partido</a>}
          {partido.url_stats&&<a href={partido.url_stats} target="_blank" rel="noopener noreferrer" style={{background:"#0f172a",color:"#fff",borderRadius:"20px",padding:"7px 16px",fontSize:"12px",fontWeight:700,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:"5px"}}>📊 Stats FIBA</a>}
          {isAdmin&&onEdit&&<button onClick={onEdit} style={{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:"20px",padding:"7px 16px",fontSize:"12px",fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"5px"}}>✏️ Editar</button>}
        </div>
      </div>

      {/* Cabecera del partido */}
      <div style={{background:"#fff",borderRadius:"20px",padding:"20px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"16px"}}>
        {liga&&<div onClick={()=>onGoToLeague&&onGoToLeague(liga.id_liga)} style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"14px",cursor:onGoToLeague?"pointer":"default"}}>
          {liga.logo&&<img src={liga.logo} alt="" style={{width:20,height:20,objectFit:"contain"}}/>}
          <span style={{fontWeight:700,fontSize:"13px",color:"#9333ea",textDecoration:onGoToLeague?"underline":"none"}}>{liga.nombre}</span>
        </div>}
        <div style={{fontSize:"12px",color:"#94a3b8",marginBottom:"16px",fontWeight:600}}>
          {fmtDt(partido.fecha_hora)}{pasado&&!tieneResultado&&<span style={{marginLeft:"8px",color:"#f59e0b",fontWeight:700}}>Finalizado</span>}
          {partido.notas&&<span style={{marginLeft:"8px",color:"#475569"}}>· {partido.notas}</span>}
        </div>

        {/* Marcador compacto: escudo — resultado/vs — escudo */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"16px"}}>
          <div onClick={()=>onGoToTeam&&onGoToTeam(partido.id_equipo_local,partido.temporada)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",cursor:onGoToTeam?"pointer":"default",flex:1}}>
            {local?.escudo
              ?<img src={local.escudo} alt={local?.nombre} title={local?.nombre} style={{width:56,height:56,objectFit:"contain"}}/>
              :<div style={{width:56,height:56,borderRadius:"50%",background:"#e9d5ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",fontWeight:800,color:"#9333ea"}}>{(local?.nombre||"L").slice(0,1)}</div>}
            <span style={{fontSize:"11px",fontWeight:600,color:"#64748b",textAlign:"center",maxWidth:"80px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{local?.nombre||"—"}</span>
          </div>
          <div style={{flexShrink:0,textAlign:"center",minWidth:"70px"}}>
            {tieneResultado?(
              <div style={{fontWeight:800,fontSize:"32px",color:"#1e293b",letterSpacing:"3px"}}>{partido.resultado_local}<span style={{color:"#94a3b8",margin:"0 4px"}}>–</span>{partido.resultado_visitante}</div>
            ):(
              <span style={{fontWeight:800,fontSize:"22px",color:"#9333ea"}}>vs</span>
            )}
          </div>
          <div onClick={()=>onGoToTeam&&onGoToTeam(partido.id_equipo_visitante,partido.temporada)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",cursor:onGoToTeam?"pointer":"default",flex:1}}>
            {visit?.escudo
              ?<img src={visit.escudo} alt={visit?.nombre} title={visit?.nombre} style={{width:56,height:56,objectFit:"contain"}}/>
              :<div style={{width:56,height:56,borderRadius:"50%",background:"#e9d5ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",fontWeight:800,color:"#9333ea"}}>{(visit?.nombre||"V").slice(0,1)}</div>}
            <span style={{fontSize:"11px",fontWeight:600,color:"#64748b",textAlign:"center",maxWidth:"80px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{visit?.nombre||"—"}</span>
          </div>
        </div>
        {partido.parciales&&partido.parciales.local&&(
          <div style={{marginTop:"14px",overflowX:"auto"}}>
            <table style={{margin:"0 auto",borderCollapse:"collapse",fontSize:"12px",fontVariantNumeric:"tabular-nums"}}>
              <thead>
                <tr style={{color:"#94a3b8",fontWeight:700}}>
                  <td style={{padding:"3px 10px"}}></td>
                  {partido.parciales.local.map((_,i)=><td key={i} style={{padding:"3px 10px",textAlign:"center"}}>Q{i+1}</td>)}
                  {partido.parciales.prorroga&&<td style={{padding:"3px 10px",textAlign:"center"}}>PR</td>}
                </tr>
              </thead>
              <tbody>
                {[["local",local],["visitante",visit]].map(([lado,team],fila)=>(
                  <tr key={lado} style={{borderTop:"1px solid #f1f5f9",color:"#475569"}}>
                    <td style={{padding:"3px 10px",fontWeight:700,maxWidth:"110px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{team?.nombre||"—"}</td>
                    {partido.parciales[lado].map((q,i)=><td key={i} style={{padding:"3px 10px",textAlign:"center"}}>{q}</td>)}
                    {partido.parciales.prorroga&&<td style={{padding:"3px 10px",textAlign:"center",fontWeight:700,color:"#9333ea"}}>{partido.parciales.prorroga[fila]}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BoxscorePartido idPartido={partido.id} equipoLocal={partido.id_equipo_local} equipoVisit={partido.id_equipo_visitante} local={local} visit={visit} players={players} onGoToPlayer={onGoToPlayer}/>
    </div>
  );
}

/* ── PartidosView ────────────────────────────────────────── */
// Inyectar keyframe de pulso para el borde rojo "EN JUEGO" una sola vez
if(typeof document!=="undefined"&&!document.getElementById("partido-pulse")){
  const s=document.createElement("style");s.id="partido-pulse";
  s.textContent=`@keyframes partidoPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}`;
  document.head.appendChild(s);
}

function getPartidoEstado(p){
  const now=new Date();
  const fh=new Date(p.fecha_hora);
  const diffMs=now-fh; // positivo = ya empezó
  // La Edge Function escribe el marcador EN VIVO en resultado_local/visitante y
  // marca es_live=true mientras el partido está en curso (es_live=false al acabar).
  // Ventana de seguridad de 4h por si un fallo del scraper dejara es_live colgado.
  const tieneResultado=p.resultado_local!=null&&p.resultado_visitante!=null;
  if(p.es_live&&diffMs>=0&&diffMs<4*60*60*1000)return"en_juego";
  if(tieneResultado)return"terminado";
  if(diffMs>=0&&diffMs<4*60*60*1000)return"en_juego"; // recién empezado, aún sin resultado
  const esHoy=fh.toDateString()===now.toDateString();
  if(esHoy)return"proximo";
  return"normal";
}

function PartidosView({partidos,equipos,ligas,players,mvps,equiposNombres,openClasiKey,onClearClasi,partidosSub,isAdmin,setPartidos,onGoToTeam,onGoToLeague,onGoToPlayer}){
  const [modal,setModal]=useState(null);
  const [ficha,setFicha]=useState(null);
  const [saving,setSaving]=useState(false);
  const [expandedLigas,setExpandedLigas]=useState({});
  const [fibaModal,setFibaModal]=useState(null); // {ligaId,temporada}
  const [fibaSlug,setFibaSlug]=useState("");
  const [fibaGuardando,setFibaGuardando]=useState(false);
  const [fibaMensaje,setFibaMensaje]=useState("");
  const [fibaResultado,setFibaResultado]=useState(null);

  async function fibaActivar(modo="crear_evento"){
    if(!fibaModal.ligaId||!fibaModal.temporada){setFibaMensaje("Selecciona liga y temporada");return;}
    if(!fibaSlug.trim()){setFibaMensaje("Introduce el slug de FIBA");return;}
    setFibaGuardando(true);setFibaMensaje("");setFibaResultado(null);
    try{
      const r=await fetch(SUPABASE_URL+"/functions/v1/actualizar-resultados-fiba",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_KEY,"apikey":SUPABASE_KEY},
        body:JSON.stringify({modo,id_liga:fibaModal.ligaId,temporada:fibaModal.temporada,slug:fibaSlug.trim()})
      });
      const d=await r.json();
      if(d.ok){
        setFibaResultado(d);
        setFibaMensaje(modo==="desde_standings"?"✅ Standings cargado":"✅ Hecho");
      } else {
        setFibaMensaje("❌ "+(d.error||"Error desconocido"));
      }
    }catch(e){setFibaMensaje("❌ "+e.message);}
    setFibaGuardando(false);
  }
  const [expandedJornadas,setExpandedJornadas]=useState({});
  const [archivoOpen,setArchivoOpen]=useState(false);
  const [archivoTempOpen,setArchivoTempOpen]=useState({});
  const [clasiLigaId,setClasiLigaId]=useState(null);
  const [clasiVista,setClasiVista]=useState("grupos");
  const [filtroLiga,setFiltroLiga]=useState("");
  const [filtroEquipo,setFiltroEquipo]=useState("");
  useEffect(()=>{
    if(openClasiKey){
      const [l,t]=openClasiKey.split("|");
      setClasiVista("grupos");
      window.history.pushState({},"",`/partidos/clasificacion/${l}/${encodeURIComponent(t||"")}`);
      setFicha(null);setClasiLigaId(openClasiKey);
      onClearClasi&&onClearClasi();
    }
  },[openClasiKey]);

  // La URL es la fuente de verdad de la subvista: /partidos/partido/{id} abre la ficha,
  // /partidos/clasificacion/{liga}/{temporada} abre la clasificación y /partidos limpia
  // ambas. Así el botón atrás del navegador (popstate -> applyUrlState -> partidosSub)
  // recorre ficha -> clasificación -> lista en orden, en vez de salirse de la pestaña.
  useEffect(()=>{
    if(!partidosSub||partidosSub.length===0){setFicha(null);setClasiLigaId(null);return;}
    if(partidosSub[0]==="clasificacion"){
      setFicha(null);
      setClasiLigaId(`${partidosSub[1]}|${decodeURIComponent(partidosSub[2]||"")}`);
    }
  },[partidosSub]);
  // Efecto aparte con dependencia de `partidos`: además de resolver la ficha en un
  // deep-link (cuando los datos aún no habían cargado), refresca el objeto de la ficha
  // con el marcador en vivo sin que el auto-refresh cierre la clasificación.
  useEffect(()=>{
    if(partidosSub&&partidosSub[0]==="partido"){
      const p=partidos.find(x=>String(x.id)===String(partidosSub[1]));
      if(p)setFicha(p);
      else{(async()=>{const {data}=await supabase.from("partidos").select("*").eq("id",partidosSub[1]).maybeSingle();if(data)setFicha(data);})();}
    }
  },[partidosSub,partidos]);

  const toggleConvocatoria=async(partido,idJugadora)=>{
    const actual=partido.no_convocadas||[];
    const nueva=actual.includes(idJugadora)?actual.filter(x=>x!==idJugadora):[...actual,idJugadora];
    const valor=nueva.length?nueva:null;
    const{error}=await supabase.from("partidos").update({no_convocadas:valor}).eq("id",partido.id);
    if(error){alert("Error guardando la convocatoria: "+error.message);return;}
    setPartidos(prev=>prev.map(x=>x.id===partido.id?{...x,no_convocadas:valor}:x));
    setFicha(prev=>prev&&prev.id===partido.id?{...prev,no_convocadas:valor}:prev);
  };

  const abrirFicha=p=>{
    window.history.pushState({},"",`/partidos/partido/${p.id}`);
    setFicha(p);
  };
  const abrirClasi=(grupoKey,vista)=>{
    const [l,t]=grupoKey.split("|");
    setClasiVista(vista);
    window.history.pushState({},"",`/partidos/clasificacion/${l}/${encodeURIComponent(t||"")}`);
    setFicha(null);setClasiLigaId(grupoKey);
  };
  const equipoMap=useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap=useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);
  const scrollRef=useRef(null);

  const filtrados=useMemo(()=>partidos.filter(p=>
    (!filtroLiga||p.id_liga===filtroLiga)&&
    (!filtroEquipo||p.id_equipo_local===filtroEquipo||p.id_equipo_visitante===filtroEquipo)
  ),[partidos,filtroLiga,filtroEquipo]);
  const sorted=useMemo(()=>[...filtrados].sort((a,b)=>new Date(b.fecha_hora)-new Date(a.fecha_hora)),[filtrados]);
  // Opciones de los filtros: solo ligas y equipos que aparecen en partidos
  const ligasConPartidos=useMemo(()=>{
    const ids=new Set(partidos.map(p=>p.id_liga).filter(Boolean));
    return ligas.filter(l=>ids.has(l.id_liga)).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  },[partidos,ligas]);
  const equiposConPartidos=useMemo(()=>{
    const base=filtroLiga?partidos.filter(p=>p.id_liga===filtroLiga):partidos;
    const ids=new Set();
    base.forEach(p=>{if(p.id_equipo_local)ids.add(p.id_equipo_local);if(p.id_equipo_visitante)ids.add(p.id_equipo_visitante);});
    return equipos.filter(e=>ids.has(e.id_equipo)).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  },[partidos,equipos,filtroLiga]);
  const byLiga=useMemo(()=>{const m={};sorted.forEach(p=>{const k=`${p.id_liga||"sin_liga"}|${p.temporada||""}`;if(!m[k])m[k]=[];m[k].push(p);});return m;},[sorted]);

  // Determinar el id del partido al que hay que hacer scroll:
  // primero un "en_juego", si no hay ninguno el primer "proximo"
  const scrollTargetId=useMemo(()=>{
    const enJuego=sorted.find(p=>getPartidoEstado(p)==="en_juego");
    if(enJuego)return enJuego.id;
    const proximo=sorted.find(p=>getPartidoEstado(p)==="proximo");
    return proximo?.id??null;
  },[sorted]);

  useEffect(()=>{
    if(scrollRef.current){
      setTimeout(()=>scrollRef.current?.scrollIntoView({behavior:"smooth",block:"center"}),300);
    }
  },[scrollTargetId]);

  const save=async f=>{
    setSaving(true);
    try{
      const payload={id_liga:f.id_liga||null,temporada:f.temporada||null,id_equipo_local:f.id_equipo_local||null,id_equipo_visitante:f.id_equipo_visitante||null,fecha_hora:f.fecha_hora,link:f.link||null,url_stats:f.url_stats||null,notas:f.notas||null,resultado_local:f.resultado_local!=null&&f.resultado_local!==""?Number(f.resultado_local):null,resultado_visitante:f.resultado_visitante!=null&&f.resultado_visitante!==""?Number(f.resultado_visitante):null};
      if(f.id){
        const{error}=await supabase.from("partidos").update(payload).eq("id",f.id);
        if(error)throw error;
        setPartidos(prev=>prev.map(p=>p.id===f.id?{...p,...payload,id:f.id}:p));
      }else{
        const{data,error}=await supabase.from("partidos").insert(payload).select().single();
        if(error)throw error;
        setPartidos(prev=>[...prev,data].sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora)));
      }
      setModal(null);
    }catch(e){alert("Error guardando: "+e.message);}
    setSaving(false);
  };

  const del=async id=>{
    if(!window.confirm("¿Eliminar este partido?"))return;
    await supabase.from("partidos").delete().eq("id",id);
    setPartidos(prev=>prev.filter(p=>p.id!==id));
  };

  const fmtDt=iso=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"})+" · "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});};
  const fmtDia=iso=>iso?new Date(iso).toLocaleDateString("es-ES",{day:"numeric",month:"short"}):"";
  const fmtRango=games=>{if(!games.length)return"";const a=fmtDia(games[0].fecha_hora),b=fmtDia(games[games.length-1].fecha_hora);return a===b?a:a+" – "+b;};

  if(ficha&&!modal){
    return <PartidoFichaView partido={ficha} equipos={equipos} ligas={ligas} players={players} equiposNombres={equiposNombres} isAdmin={isAdmin} onToggleConvocatoria={toggleConvocatoria} onBack={()=>window.history.back()} onEdit={()=>setModal(ficha)} onGoToTeam={onGoToTeam} onGoToLeague={onGoToLeague} onGoToPlayer={id=>onGoToPlayer&&onGoToPlayer(id,{tab:"partidos",label:"Info partido"})}/>;
  }

  if(clasiLigaId){
    const [cLiga,cTemporada]=clasiLigaId.split("|");
    return <ClasificacionGrupos partidos={partidos} equipos={equipos} ligas={ligas} ligaId={cLiga} temporada={cTemporada} vistaInicial={clasiVista} onBack={()=>window.history.back()} onGoToTeam={onGoToTeam} onOpenPartido={abrirFicha} onVistaChange={setClasiVista} mvps={mvps} players={players} onGoToPlayer={onGoToPlayer} equiposNombres={equiposNombres}/>;
  }

  if(modal){
    return <div style={{padding:"16px"}}><PartidoForm initial={modal==="add"?null:modal} equipos={equipos} ligas={ligas} onSave={save} onCancel={()=>setModal(null)} saving={saving}/></div>;
  }

  return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"16px",fontFamily:"system-ui,sans-serif"}}>
    {fibaModal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",width:"100%",maxWidth:"400px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
          <div style={{fontWeight:800,fontSize:"16px",color:"#1e293b",marginBottom:"4px"}}>⚡ Activar seguimiento FIBA live</div>
          {fibaModal.global?(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"16px"}}>
              <div>
                <div style={{fontSize:"12px",fontWeight:600,color:"#475569",marginBottom:"4px"}}>Liga</div>
                <select value={fibaModal.ligaId} onChange={e=>setFibaModal(m=>({...m,ligaId:e.target.value}))} style={{width:"100%",padding:"9px 10px",borderRadius:"10px",border:"1.5px solid #e2e8f0",fontSize:"13px"}}>
                  <option value="">Seleccionar...</option>
                  {ligas.map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:"12px",fontWeight:600,color:"#475569",marginBottom:"4px"}}>Temporada</div>
                <input value={fibaModal.temporada} onChange={e=>setFibaModal(m=>({...m,temporada:e.target.value}))} placeholder="2026" style={{width:"100%",padding:"9px 10px",borderRadius:"10px",border:"1.5px solid #e2e8f0",fontSize:"13px",boxSizing:"border-box"}}/>
              </div>
            </div>
          ):(
            <div style={{fontSize:"12px",color:"#64748b",marginBottom:"16px"}}>{fibaModal.ligaId} · {fibaModal.temporada}</div>
          )}
          <div style={{marginBottom:"16px"}}>
            <div style={{fontSize:"12px",fontWeight:600,color:"#475569",marginBottom:"4px"}}>Slug de FIBA</div>
            <input value={fibaSlug} onChange={e=>setFibaSlug(e.target.value)} placeholder="fiba-u18-womens-eurobasket-2026" style={{width:"100%",padding:"10px 12px",borderRadius:"10px",border:"1.5px solid #e2e8f0",fontSize:"13px",boxSizing:"border-box"}}/>
            <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"4px"}}>URL: fiba.basketball/en/events/<b>SLUG</b>/games · Fechas detectadas automáticamente</div>
          </div>
          {fibaMensaje&&<div style={{fontSize:"13px",color:fibaMensaje.startsWith("✅")?"#059669":"#ef4444",marginBottom:"12px",fontWeight:600}}>{fibaMensaje}</div>}
          {fibaResultado&&<div style={{background:"#f0fdf4",borderRadius:"10px",padding:"12px",marginBottom:"12px",fontSize:"12px",color:"#166534"}}>
            <div>📅 {fibaResultado.fecha_ini} → {fibaResultado.fecha_fin}</div>
            <div>✅ Partidos creados: <b>{fibaResultado.creados}</b> · Ya existían: <b>{fibaResultado.ya_existian}</b></div>
            {(fibaResultado.notas_actualizadas>0||fibaResultado.slots_actualizados>0)&&<div>📝 Notas: <b>{(fibaResultado.notas_actualizadas||0)+(fibaResultado.slots_actualizados||0)}</b> actualizadas</div>}
            <div>🔑 Equipos mapeados: <b>{fibaResultado.codigos_generados}</b></div>
            {fibaResultado.activo&&<div style={{marginTop:"8px",padding:"8px",background:"#fee2e2",borderRadius:"8px",color:"#991b1b",fontWeight:700}}>🔴 Seguimiento en vivo activado (auto-refresh cada 3 min; se desactiva solo al terminar el torneo)</div>}
            {fibaResultado.sin_mapear?.length>0&&<div style={{color:"#b45309",marginTop:"4px"}}>⚠️ Sin mapear: {fibaResultado.sin_mapear.join(", ")}</div>}
          </div>}
          <div style={{display:"flex",gap:"10px"}}>
            <button onClick={()=>{setFibaModal(null);setFibaResultado(null);}} style={{flex:1,padding:"10px",borderRadius:"12px",border:"1.5px solid #e2e8f0",background:"#f8fafc",fontWeight:600,fontSize:"13px",cursor:"pointer"}}>Cerrar</button>
            {!fibaResultado&&<><button onClick={()=>fibaActivar("crear_evento")} disabled={fibaGuardando} style={{flex:1,padding:"10px",borderRadius:"12px",border:"none",background:"#059669",color:"#fff",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:fibaGuardando?0.6:1}}>{fibaGuardando?"Cargando...":"Activar"}</button><button onClick={()=>fibaActivar("desde_standings")} disabled={fibaGuardando} title="Carga bracket y clasificaciones desde la página standings de FIBA" style={{flex:1,padding:"10px",borderRadius:"12px",border:"none",background:"#7c3aed",color:"#fff",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:fibaGuardando?0.6:1}}>{fibaGuardando?"Cargando...":"📊 Standings"}</button></>}
          </div>
        </div>
      </div>
    )}
      <div style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1.5px solid #f59e0b",borderRadius:"16px",padding:"16px 20px",marginBottom:"20px",display:"flex",alignItems:"center",gap:"12px"}}>
        <span style={{fontSize:"24px"}}>🚧</span>
        <div>
          <div style={{fontWeight:700,fontSize:"14px",color:"#92400e"}}>Sección en pruebas</div>
          <div style={{fontSize:"12px",color:"#a16207",marginTop:"2px"}}>Esta funcionalidad está en desarrollo. Los datos pueden no ser definitivos.</div>
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px",flexWrap:"wrap",gap:"10px"}}>
        <h1 style={{fontWeight:800,fontSize:"22px",color:"#1e293b",margin:0}}>📺 Ver partidos</h1>
        <div style={{display:"flex",gap:"8px"}}>
          {isAdmin&&<button onClick={()=>{setFibaSlug("");setFibaMensaje("");setFibaResultado(null);setFibaModal({ligaId:filtroLiga||"",temporada:"",global:true});}} style={{background:"#ecfdf5",color:"#059669",border:"1.5px solid #6ee7b7",borderRadius:"12px",padding:"9px 18px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>⚡ FIBA Live</button>}
          {isAdmin&&<button onClick={()=>setModal("add")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"12px",padding:"9px 18px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Partido</button>}
        </div>
      </div>

      <div style={{display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap"}}>
        <select value={filtroLiga} onChange={e=>{setFiltroLiga(e.target.value);setFiltroEquipo("");}}
          style={{flex:"1 1 180px",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none"}}>
          <option value="">Todas las ligas</option>
          {ligasConPartidos.map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
        </select>
        <select value={filtroEquipo} onChange={e=>setFiltroEquipo(e.target.value)}
          style={{flex:"1 1 180px",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none"}}>
          <option value="">Todos los equipos</option>
          {equiposConPartidos.map(e=><option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>)}
        </select>
      </div>

      {sorted.length===0?(
        <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
          <div style={{fontSize:"48px",marginBottom:"12px"}}>📺</div>
          <div style={{fontWeight:600,fontSize:"16px"}}>No hay partidos programados</div>
          {isAdmin&&<div style={{fontSize:"13px",marginTop:"6px"}}>Pulsa "+ Partido" para añadir el primero</div>}
        </div>
      ):(()=>{
        const renderGrupo=(grupoKey,ps)=>{
          const [ligaId,temporada]=grupoKey.split("|");
          const hoy=new Date().toDateString();
          const esHoy=p=>new Date(p.fecha_hora).toDateString()===hoy;
          const partHoy=ps.filter(p=>esHoy(p)).sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora));
          const resultados=ps.filter(p=>getPartidoEstado(p)==="terminado"&&!esHoy(p)).sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora));
          const proximos=ps.filter(p=>(getPartidoEstado(p)==="proximo"||getPartidoEstado(p)==="normal")&&!esHoy(p)).sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora));
          const hayEnJuego=ps.some(p=>getPartidoEstado(p)==="en_juego");
          const hayHoy=partHoy.length>0;
          const expanded=expandedLigas[grupoKey]??false;

          // En competiciones tipo "liga" los partidos se agrupan por jornada (campo notas
          // "Jornada N"); los de playoffs y los que no tienen jornada van a grupos propios.
          const esLiga=ligaMap[ligaId]?.tipo==="liga";
          let jornadas=[];
          if(esLiga){
            const buckets={};
            ps.forEach(p=>{
              const m=/(?:^|·\s*)jornada\s+(\d+)/i.exec(p.notas||"");
              const grpM=/^grupo\s+(\w+)/i.exec(p.notas||"");
              const key=m?(grpM?`G${grpM[1]}J${m[1]}`:`J${m[1]}`):(/^playoffs/i.test(p.notas||"")?"PO":"OT");
              (buckets[key]=buckets[key]||[]).push(p);
            });
            const rank=k=>{if(k==="PO")return 1000000;if(k==="OT")return 1000001;const gm=k.match(/^G(\w+)J(\d+)$/);if(gm)return parseInt(gm[2])*100+gm[1].charCodeAt(0);return parseInt(k.slice(1),10);};
            jornadas=Object.keys(buckets).sort((a,b)=>rank(a)-rank(b)).map(k=>{
              const games=buckets[k].sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora));
              const gm=k.match(/^G(\w+)J(\d+)$/);
              const lbl=k==="PO"?"Playoffs":k==="OT"?"Otros partidos":gm?`Grupo ${gm[1]} · Jornada ${gm[2]}`:`Jornada ${k.slice(1)}`;
              return{key:k,label:lbl,games,
                pendiente:games.some(p=>getPartidoEstado(p)!=="terminado"),
                enJuego:games.some(p=>getPartidoEstado(p)==="en_juego")};
            });
            const primeraPend=jornadas.find(j=>j.pendiente);
            if(primeraPend)primeraPend.proxima=true;
          }

          const TarjetaPartido=({p})=>{
            const local=equipoMap[p.id_equipo_local]&&{...equipoMap[p.id_equipo_local],...resolveTeamData(p.id_equipo_local,p.temporada,equiposNombres,equipoMap)};
            const visit=equipoMap[p.id_equipo_visitante]&&{...equipoMap[p.id_equipo_visitante],...resolveTeamData(p.id_equipo_visitante,p.temporada,equiposNombres,equipoMap)};
            const tieneResultado=p.resultado_local!=null&&p.resultado_visitante!=null;
            const estado=getPartidoEstado(p);
            const esPrimeroDestacado=p.id===scrollTargetId;
            const borderStyle=estado==="en_juego"?"2px solid #ef4444":tieneResultado?"1.5px solid #e2e8f0":"1.5px solid #e9d5ff";
            const animStyle=estado==="en_juego"?{animation:"partidoPulse 2s infinite"}:{};
            return(
              <div ref={esPrimeroDestacado?scrollRef:null}
                style={{background:"#fff",borderRadius:"14px",padding:"14px",boxShadow:estado==="en_juego"?"0 2px 12px rgba(239,68,68,0.15)":"0 1px 4px rgba(0,0,0,0.06)",border:borderStyle,...animStyle}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px",flexWrap:"wrap"}}>
                  {estado==="en_juego"&&<span style={{background:"#ef4444",color:"#fff",borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontWeight:800,letterSpacing:"0.5px"}}>🔴 EN JUEGO{p.es_live&&p.periodo?` · P${p.periodo}`:""}</span>}
                  {estado==="proximo"&&<span style={{background:"#f59e0b",color:"#fff",borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontWeight:700}}>🟡 HOY</span>}
                  <span style={{fontSize:"11px",color:"#94a3b8",fontWeight:600}}>{fmtDt(p.fecha_hora)}</span>
                  {p.notas&&<span style={{fontSize:"11px",color:"#64748b"}}>· {p.notas}</span>}
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
                  <div onClick={()=>onGoToTeam&&onGoToTeam(p.id_equipo_local,p.temporada)}
                    style={{display:"flex",alignItems:"center",gap:"7px",flex:1,minWidth:"80px",cursor:onGoToTeam?"pointer":"default"}}>
                    {local?.escudo&&<img src={local.escudo} alt="" style={{width:28,height:28,objectFit:"contain",flexShrink:0}}/>}
                    <span style={{fontWeight:700,fontSize:"12px",color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{local?.nombre||"—"}</span>
                  </div>
                  <div style={{flexShrink:0,textAlign:"center",minWidth:"52px"}}>
                    {tieneResultado
                      ?<span style={{fontWeight:800,fontSize:"16px",color:"#1e293b"}}>{p.resultado_local}–{p.resultado_visitante}</span>
                      :<span style={{fontWeight:800,fontSize:"13px",color:estado==="en_juego"?"#ef4444":"#9333ea"}}>vs</span>}
                  </div>
                  <div onClick={()=>onGoToTeam&&onGoToTeam(p.id_equipo_visitante,p.temporada)}
                    style={{display:"flex",alignItems:"center",gap:"7px",flex:1,minWidth:"80px",justifyContent:"flex-end",textAlign:"right",cursor:onGoToTeam?"pointer":"default"}}>
                    <span style={{fontWeight:700,fontSize:"12px",color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{visit?.nombre||"—"}</span>
                    {visit?.escudo&&<img src={visit.escudo} alt="" style={{width:28,height:28,objectFit:"contain",flexShrink:0}}/>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"10px",flexWrap:"wrap"}}>
                  <button onClick={()=>abrirFicha(p)} style={{background:"#f5f3ff",color:"#7c3aed",border:"1.5px solid #ddd6fe",borderRadius:"20px",padding:"4px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer"}}>+ Info</button>
                  {p.link&&<a href={p.link} target="_blank" rel="noopener noreferrer" style={{background:"#7c3aed",color:"#fff",borderRadius:"20px",padding:"4px 12px",fontSize:"11px",fontWeight:700,textDecoration:"none"}}>▶ Ver</a>}
                  {p.url_stats&&<a href={p.url_stats} target="_blank" rel="noopener noreferrer" style={{background:"#0f172a",color:"#fff",borderRadius:"20px",padding:"4px 12px",fontSize:"11px",fontWeight:700,textDecoration:"none"}}>📊 Stats</a>}
                  {isAdmin&&<>
                    <button onClick={()=>setModal(p)} style={{background:"#f1f5f9",border:"none",borderRadius:"20px",padding:"4px 10px",fontSize:"11px",fontWeight:600,cursor:"pointer",color:"#475569"}}>✏️</button>
                    <button onClick={()=>del(p.id)} style={{background:"#fee2e2",border:"none",borderRadius:"20px",padding:"4px 10px",fontSize:"11px",fontWeight:600,cursor:"pointer",color:"#ef4444"}}>🗑️</button>
                  </>}
                </div>
              </div>
            );
          };

          return(
            <div key={grupoKey} style={{marginBottom:"12px",background:"#fff",borderRadius:"16px",overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              {/* Cabecera de la liga: clicable para expandir/contraer */}
              <div onClick={()=>setExpandedLigas(prev=>({...prev,[grupoKey]:!expanded}))}
                style={{display:"flex",alignItems:"center",gap:"10px",padding:"14px 16px",cursor:"pointer",userSelect:"none",background:expanded?"#faf5ff":"#fff"}}>
                {ligaMap[ligaId]?.logo&&<img src={ligaMap[ligaId].logo} alt="" style={{width:24,height:24,objectFit:"contain",flexShrink:0}}/>}
                <span style={{fontWeight:700,fontSize:"14px",color:"#9333ea",flex:1}}>{ligaMap[ligaId]?.nombre||"Sin liga"}{temporada?` - ${temporada}`:""}</span>
                {hayEnJuego&&<span style={{width:10,height:10,borderRadius:"50%",background:"#ef4444",flexShrink:0,boxShadow:"0 0 0 3px rgba(239,68,68,0.2)",display:"inline-block"}}/>}
                {(ps.some(p=>p.notas&&/^Group [A-Z]/i.test(p.notas)&&p.id_equipo_local&&p.id_equipo_visitante)||(ligaMap[ligaId]?.tipo==="liga"&&ps.some(p=>p.id_equipo_local&&p.id_equipo_visitante))||(ligaMap[ligaId]?.tipo!=="liga"&&ps.some(p=>/#\d+/.test(p.notas||"")||/^octavos/i.test(p.notas||""))))&&(
                  <button onClick={e=>{e.stopPropagation();abrirClasi(grupoKey,"grupos");}}
                    style={{background:"#f5f3ff",color:"#7c3aed",border:"1.5px solid #ddd6fe",borderRadius:"20px",padding:"3px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",flexShrink:0,marginRight:"4px"}}>
                    📊
                  </button>
                )}
                {ps.some(p=>/#(49|5[0-5])\b/.test(p.notas||""))&&(
                  <button onClick={e=>{e.stopPropagation();abrirClasi(grupoKey,"standing");}}
                    style={{background:"#fffbeb",color:"#b45309",border:"1.5px solid #fde68a",borderRadius:"20px",padding:"3px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",flexShrink:0,marginRight:"4px"}}>
                    🏅
                  </button>
                )}
                {isAdmin&&ps.some(p=>p.fuente==="fiba")&&<button onClick={e=>{e.stopPropagation();setFibaSlug("");setFibaMensaje("");setFibaResultado(null);setFibaModal({ligaId,temporada});}} style={{background:"#ecfdf5",color:"#059669",border:"1.5px solid #6ee7b7",borderRadius:"20px",padding:"3px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",flexShrink:0,marginRight:"4px"}}>⚡ Live</button>}
                <span style={{fontSize:"18px",color:"#94a3b8",transform:expanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>›</span>
              </div>

              {/* Contenido expandido */}
              {expanded&&(
                <div style={{padding:"0 12px 14px",display:"flex",flexDirection:"column",gap:"8px"}}>
                  {esLiga?(
                    /* Jornadas colapsadas: la siguiente por disputarse lleva la etiqueta "Próxima" */
                    jornadas.map(j=>{
                      const jk=grupoKey+"|"+j.key;
                      const open=expandedJornadas[jk]??false;
                      return(
                        <div key={j.key} style={{border:j.proxima?"1.5px solid #fcd34d":"1px solid #e2e8f0",borderRadius:"12px",overflow:"hidden",marginTop:"4px"}}>
                          <div onClick={()=>setExpandedJornadas(prev=>({...prev,[jk]:!open}))}
                            style={{display:"flex",alignItems:"center",gap:"8px",padding:"10px 12px",cursor:"pointer",userSelect:"none",background:j.proxima?"#fffbeb":open?"#faf5ff":"#f8fafc"}}>
                            <span style={{fontWeight:700,fontSize:"12.5px",color:j.proxima?"#b45309":"#475569",flexShrink:0}}>{j.label}</span>
                            <span style={{fontSize:"11px",color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fmtRango(j.games)}</span>
                            <span style={{flex:1}}/>
                            {j.enJuego&&<span style={{width:8,height:8,borderRadius:"50%",background:"#ef4444",flexShrink:0,boxShadow:"0 0 0 3px rgba(239,68,68,0.2)",display:"inline-block"}}/>}
                            {j.proxima&&!j.enJuego&&<span style={{background:"#f59e0b",color:"#fff",borderRadius:"20px",padding:"2px 10px",fontSize:"10px",fontWeight:800,flexShrink:0}}>Próxima</span>}
                            <span style={{fontSize:"16px",color:"#94a3b8",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s",flexShrink:0}}>›</span>
                          </div>
                          {open&&(
                            <div style={{padding:"10px",display:"flex",flexDirection:"column",gap:"8px",background:"#fff"}}>
                              {j.games.map(p=><TarjetaPartido key={p.id} p={p}/>)}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ):(<>
                  {/* HOY */}
                  {partHoy.length>0&&(
                    <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"8px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"4px"}}>
                        <div style={{flex:1,height:"1px",background:"#e2e8f0"}}/>
                        <span style={{fontSize:"11px",fontWeight:700,color:hayEnJuego?"#ef4444":"#f59e0b",whiteSpace:"nowrap"}}>{hayEnJuego?"🔴 En juego":"📅 Hoy"}</span>
                        <div style={{flex:1,height:"1px",background:"#e2e8f0"}}/>
                      </div>
                      {partHoy.map(p=><TarjetaPartido key={p.id} p={p}/>)}
                    </div>
                  )}

                  {/* ÚLTIMOS RESULTADOS */}
                  {resultados.length>0&&(
                    <div style={{marginTop:"8px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                        <div style={{flex:1,height:"1px",background:"#e2e8f0"}}/>
                        <span style={{fontSize:"11px",fontWeight:700,color:"#94a3b8",whiteSpace:"nowrap"}}>Últimos resultados</span>
                        <div style={{flex:1,height:"1px",background:"#e2e8f0"}}/>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                        {resultados.map(p=><TarjetaPartido key={p.id} p={p}/>)}
                      </div>
                    </div>
                  )}

                  {/* PRÓXIMOS */}
                  {proximos.length>0&&(
                    <div style={{marginTop:"8px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                        <div style={{flex:1,height:"1px",background:"#e2e8f0"}}/>
                        <span style={{fontSize:"11px",fontWeight:700,color:"#94a3b8",whiteSpace:"nowrap"}}>Próximos</span>
                        <div style={{flex:1,height:"1px",background:"#e2e8f0"}}/>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                        {proximos.map(p=><TarjetaPartido key={p.id} p={p}/>)}
                      </div>
                    </div>
                  )}
                  </>)}
                </div>
              )}
            </div>
          );
        };
        // Clasificar cada competición: activa (le quedan partidos por jugar) o finalizada (todo con resultado)
        const esFinalizada=ps=>ps.length>0&&ps.every(p=>p.resultado_local!=null&&p.resultado_visitante!=null);
        const entradas=Object.entries(byLiga);
        const activas=entradas.filter(([,ps])=>!esFinalizada(ps));
        const finalizadas=entradas.filter(([,ps])=>esFinalizada(ps));
        // Agrupar las finalizadas por temporada para el archivo
        const archivoPorTemp={};
        finalizadas.forEach(([k,ps])=>{const temp=(k.split("|")[1])||"—";(archivoPorTemp[temp]=archivoPorTemp[temp]||[]).push([k,ps]);});
        const tempsArchivo=Object.keys(archivoPorTemp).sort((a,b)=>b.localeCompare(a));
        return(<>
          {activas.map(([k,ps])=>renderGrupo(k,ps))}
          {finalizadas.length>0&&(
            <div style={{marginTop:activas.length?"22px":"0"}}>
              <div onClick={()=>setArchivoOpen(o=>!o)}
                style={{display:"flex",alignItems:"center",gap:"10px",padding:"14px 16px",cursor:"pointer",userSelect:"none",background:"#eef2f7",borderRadius:"14px"}}>
                <span style={{fontSize:"18px"}}>🗄️</span>
                <span style={{fontWeight:800,fontSize:"14px",color:"#475569",flex:1}}>Competiciones finalizadas</span>
                <span style={{background:"#dbe2ea",color:"#64748b",borderRadius:"20px",padding:"2px 10px",fontSize:"12px",fontWeight:700}}>{finalizadas.length}</span>
                <span style={{fontSize:"18px",color:"#94a3b8",transform:archivoOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>›</span>
              </div>
              {archivoOpen&&(
                <div style={{marginTop:"10px",display:"flex",flexDirection:"column",gap:"10px"}}>
                  {tempsArchivo.map(temp=>{
                    const grupos=archivoPorTemp[temp];
                    const tOpen=archivoTempOpen[temp]??false;
                    return(
                      <div key={temp}>
                        <div onClick={()=>setArchivoTempOpen(prev=>({...prev,[temp]:!tOpen}))}
                          style={{display:"flex",alignItems:"center",gap:"10px",padding:"11px 16px",cursor:"pointer",userSelect:"none",background:tOpen?"#faf5ff":"#fff",borderRadius:"12px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                          <span style={{fontSize:"13px"}}>📅</span>
                          <span style={{fontWeight:700,fontSize:"13px",color:"#9333ea",flex:1}}>{temp}</span>
                          <span style={{fontSize:"11px",color:"#94a3b8"}}>{grupos.length} {grupos.length===1?"competición":"competiciones"}</span>
                          <span style={{fontSize:"16px",color:"#94a3b8",transform:tOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>›</span>
                        </div>
                        {tOpen&&<div style={{marginTop:"8px",display:"flex",flexDirection:"column",gap:"12px"}}>{grupos.map(([k,ps])=>renderGrupo(k,ps))}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>);
      })()}
    </div>
  );
}

/* ── ClasificacionGrupos ─────────────────────────────────── */
// Calcula la clasificación por grupos a partir de los partidos con resultado.
// Los partidos de un grupo se identifican por el campo "notas" que empieza por "Group ".
// Criterios de desempate FIBA: 1) puntos (2V/1D), 2) head-to-head, 3) dif. directa, 4) dif. global
/* Tabla de un grupo con desempates FIBA. Extraida para poder reusarla con
   subconjuntos de partidos (p.ej. Euroliga: 2a ronda arrastrando la 1a). */
function calcTablaGrupo(ps){
  ps=ps.filter(p=>!/playoff|final campeones|cuartos|semifinal|^final/i.test(p.notas||""));

    const stats={};
    const initEq=id=>{if(id&&!stats[id])stats[id]={id,pj:0,pg:0,pp:0,pts:0,pf:0,pc:0,dif:0};};
    ps.forEach(p=>{
      initEq(p.id_equipo_local); initEq(p.id_equipo_visitante);
      if(p.resultado_local==null||p.resultado_visitante==null)return; // sin jugar: solo registra equipos
      if(getPartidoEstado(p)==="en_juego")return; // marcador en vivo: aún no cuenta
      const sl=p.resultado_local,sv=p.resultado_visitante;
      stats[p.id_equipo_local].pj++;   stats[p.id_equipo_visitante].pj++;
      stats[p.id_equipo_local].pf+=sl; stats[p.id_equipo_local].pc+=sv;
      stats[p.id_equipo_visitante].pf+=sv; stats[p.id_equipo_visitante].pc+=sl;
      if(sl>sv){
        stats[p.id_equipo_local].pg++;    stats[p.id_equipo_local].pts+=2;
        stats[p.id_equipo_visitante].pp++; stats[p.id_equipo_visitante].pts+=1;
      } else {
        stats[p.id_equipo_visitante].pg++; stats[p.id_equipo_visitante].pts+=2;
        stats[p.id_equipo_local].pp++;     stats[p.id_equipo_local].pts+=1;
      }
    });
    Object.values(stats).forEach(e=>{e.dif=e.pf-e.pc;});

    // Ordenar con desempate FIBA
    const arr=Object.values(stats);
    arr.sort((a,b)=>{
      if(b.pts!==a.pts)return b.pts-a.pts;
      // Head-to-head entre empatados con los mismos puntos
      const tied=arr.filter(x=>x.pts===a.pts).map(x=>x.id);
      if(tied.length>=2){
        const hthStats={};
        tied.forEach(id=>{hthStats[id]={pts:0,pf:0,pc:0};});
        ps.forEach(p=>{
          if(p.resultado_local==null||p.resultado_visitante==null)return;
          if(getPartidoEstado(p)==="en_juego")return;
          if(!tied.includes(p.id_equipo_local)||!tied.includes(p.id_equipo_visitante))return;
          const sl=p.resultado_local,sv=p.resultado_visitante;
          hthStats[p.id_equipo_local].pf+=sl; hthStats[p.id_equipo_local].pc+=sv;
          hthStats[p.id_equipo_visitante].pf+=sv; hthStats[p.id_equipo_visitante].pc+=sl;
          if(sl>sv){hthStats[p.id_equipo_local].pts+=2;hthStats[p.id_equipo_visitante].pts+=1;}
          else{hthStats[p.id_equipo_visitante].pts+=2;hthStats[p.id_equipo_local].pts+=1;}
        });
        const hA=hthStats[a.id]||{pts:0,pf:0,pc:0};
        const hB=hthStats[b.id]||{pts:0,pf:0,pc:0};
        if(hB.pts!==hA.pts)return hB.pts-hA.pts;
        const difA=hA.pf-hA.pc, difB=hB.pf-hB.pc;
        if(difB!==difA)return difB-difA;
      }
      // Diferencia global
      if(b.dif!==a.dif)return b.dif-a.dif;
      return b.pf-a.pf;
    });
    return arr;
}

function calcClasificacion(partidos, equipoMap){
  // Agrupar TODOS los partidos de grupo (notas que empiezan por "Group "), tengan o no
  // resultado: así la tabla muestra los equipos a 0 antes de que empiece el torneo.
  const grupos={};
  const ligaRegular=[]; // partidos sin "Group X": jornadas de liga regular (excluye playoffs y eliminatorias)
  partidos.forEach(p=>{
    const m=p.notas&&p.notas.match(/^(Group [A-Z])/i);
    const m2=!m&&p.notas&&p.notas.match(/Grupo ([A-Z])\b/i);
    if(m||m2){
      const g=m?m[1].toUpperCase():("Grupo "+m2[1].toUpperCase());
      if(!grupos[g])grupos[g]=[];
      grupos[g].push(p);
      return;
    }
    if(/playoff|final campeones/i.test(p.notas||""))return;
    if(/#\d+/.test(p.notas||"")||/^octavos/i.test(p.notas||""))return; // eliminatorias de torneo
    if(/^(fase previa|dieciseisavos|octavos|cuartos|semifinal|final)/i.test(p.notas||""))return; // EuroCup: previa y cuadro fuera de la tabla
    if(!p.id_equipo_local||!p.id_equipo_visitante)return;
    ligaRegular.push(p);
  });

  const calcGrupo=calcTablaGrupo;

  const conGrupos=Object.entries(grupos)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([nombre,ps])=>({nombre,equipos:calcGrupo(ps)}));
  if(conGrupos.length)return conGrupos;
  // Modo liga: tabla única con los mismos criterios de desempate que aplica la FEB
  // (enfrentamientos particulares -> diferencia particular -> diferencia general -> puntos anotados).
  if(ligaRegular.length)return [{nombre:"Clasificación",equipos:calcGrupo(ligaRegular),esLiga:true}];
  return [];
}

/* ── Euroliga: fases propias (previa, 1a y 2a ronda, play-ins, final six) ───────
   Se activa sola cuando la competicion tiene notas "Primera Ronda" y "Segunda Ronda".
   La 2a ronda arrastra los resultados de la 1a entre equipos que ya se enfrentaron. */
function EuroligaFases({psLiga,equipoMap,onOpenPartido,mvpPlayer,onGoToPlayer}){
  const nt=p=>(p&&p.notas)||"";
  const [tab,setTab]=useState("primera");
  const de=re=>psLiga.filter(p=>re.test(nt(p)));
  const previa=de(/fase previa/i);
  const r1=de(/^Primera Ronda/i), r2=de(/^Segunda Ronda/i);
  const playins=de(/^Play-In/i);
  const six=de(/^(Cuartos de final|Semifinal|3er puesto|Final)\b/i);
  const letras=ps=>[...new Set(ps.map(p=>{const m=nt(p).match(/Grupo ([A-Z])/i);return m?m[1].toUpperCase():null;}).filter(Boolean))].sort();
  const delGrupo=(ps,L)=>ps.filter(p=>new RegExp("Grupo "+L+"\\b","i").test(nt(p)));
  // 2a ronda: se suman los partidos de 1a ronda entre equipos que coinciden en el nuevo grupo
  const tablaSegunda=L=>{
    const ps=delGrupo(r2,L);
    const eq=new Set(); ps.forEach(p=>{eq.add(p.id_equipo_local);eq.add(p.id_equipo_visitante);});
    const arrastre=r1.filter(p=>eq.has(p.id_equipo_local)&&eq.has(p.id_equipo_visitante));
    return {filas:calcTablaGrupo([...ps,...arrastre]),arrastre:arrastre.length};
  };
  const zonaColor={verde:"#16a34a",naranja:"#ea580c",azul:"#2563eb",gris:"#94a3b8"};
  const Tabla=({titulo,filas,zonas,nota})=>(
    <div style={{background:"#fff",borderRadius:"16px",overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"16px"}}>
      <div style={{background:"#f5f3ff",padding:"10px 16px",borderBottom:"1px solid #e9d5ff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontWeight:800,fontSize:"14px",color:"#7c3aed"}}>{titulo}</span>
        {nota&&<span style={{fontSize:"11px",color:"#94a3b8"}}>{nota}</span>}
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
        <thead><tr style={{background:"#fafafa",color:"#64748b",fontSize:"11px"}}>
          <th style={{padding:"6px 8px",textAlign:"left"}}>#</th><th style={{padding:"6px",textAlign:"left"}}>Equipo</th>
          <th style={{padding:"6px"}}>PJ</th><th style={{padding:"6px"}}>PG</th><th style={{padding:"6px"}}>PP</th><th style={{padding:"6px"}}>DIF</th>
        </tr></thead>
        <tbody>
          {filas.map((e,i)=>{
            const z=zonas(i+1);
            const eq=equipoMap[e.id]||{};
            return(
              <tr key={e.id} style={{borderTop:"1px solid #f1f5f9"}}>
                <td style={{padding:"7px 8px",borderLeft:"4px solid "+(z?zonaColor[z.color]:"transparent"),fontWeight:700,color:"#475569"}}>{i+1}</td>
                <td style={{padding:"7px 6px",color:"#1e293b",fontWeight:600}}>{eq.nombre||e.id}{z&&<span style={{display:"block",fontSize:"10px",fontWeight:700,color:zonaColor[z.color]}}>{z.txt}</span>}</td>
                <td style={{padding:"7px 6px",textAlign:"center",color:"#64748b"}}>{e.pj}</td>
                <td style={{padding:"7px 6px",textAlign:"center",fontWeight:700,color:"#16a34a"}}>{e.pg}</td>
                <td style={{padding:"7px 6px",textAlign:"center",color:"#ef4444"}}>{e.pp}</td>
                <td style={{padding:"7px 6px",textAlign:"center",color:e.dif>0?"#16a34a":e.dif<0?"#ef4444":"#64748b"}}>{e.dif>0?"+":""}{e.dif}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  const zonasR1=n=>n<=3?{color:"verde",txt:"Pasa a Segunda Ronda"}:{color:"naranja",txt:"Desciende a EuroCup"};
  const zonasR2=n=>n<=2?{color:"verde",txt:"Play-In Semifinales"}:n<=4?{color:"azul",txt:"Play-In Cuartos"}:{color:"gris",txt:"Eliminado"};
  // Play-In: series al mejor de 3
  const series=ps=>{
    const m=new Map();
    ps.forEach(p=>{const k=(nt(p).match(/#(\d+)/)||[])[1]||"?";if(!m.has(k))m.set(k,[]);m.get(k).push(p);});
    return [...m.entries()].sort((a,b)=>a[0]-b[0]).map(([n,arr])=>{
      arr.sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora));
      const v={};
      arr.forEach(p=>{if(p.resultado_local==null||p.resultado_visitante==null)return;
        const g=p.resultado_local>p.resultado_visitante?p.id_equipo_local:p.id_equipo_visitante;v[g]=(v[g]||0)+1;});
      const ganador=Object.keys(v).find(k=>v[k]>=2)||null;
      return {n,arr,ganador,marcador:v,titulo:nt(arr[0]).replace(/\s*\(al mejor de 3\)/i,"")};
    });
  };
  const TarjetaSeries=({titulo,ps})=>(
    <BracketCard title={titulo}>
      <div style={{display:"flex",gap:"14px",alignItems:"flex-start",flexWrap:"wrap"}}>
        {series(ps).map(s=>(
          <BracketCol key={s.n} label={s.titulo}>
            {s.arr.map((p,i)=><KOBox key={p.id} p={p} equipoMap={equipoMap} caption={["1er partido","2o partido","3er partido"][i]} onOpen={onOpenPartido}/>)}
            <div style={{fontSize:"11px",fontWeight:700,marginTop:"4px",color:s.ganador?"#16a34a":"#94a3b8",textAlign:"center"}}>
              {s.ganador?("Pasa: "+((equipoMap[s.ganador]||{}).nombre||s.ganador)):"Serie en juego"}
            </div>
          </BracketCol>
        ))}
      </div>
    </BracketCard>
  );
  const tabs=[...(previa.length?[["previa","Fase Previa"]]:[]),...(r1.length?[["primera","Primera Ronda"]]:[]),
    ...(r2.length?[["segunda","Segunda Ronda"]]:[]),...(playins.length?[["playins","Play-Ins"]]:[]),...(six.length?[["six","Final Six"]]:[])];
  return(
    <div>
      <div style={{display:"flex",gap:"8px",marginBottom:"16px",flexWrap:"wrap"}}>
        {tabs.map(([k,lbl])=>(
          <button key={k} onClick={()=>setTab(k)} style={{border:"none",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",fontWeight:700,cursor:"pointer",
            background:tab===k?"#9333ea":"#fff",color:tab===k?"#fff":"#64748b",boxShadow:tab===k?"none":"0 1px 4px rgba(0,0,0,0.06)"}}>{lbl}</button>
        ))}
      </div>
      {tab==="previa"&&<PlayoffBracket psLiga={previa} equipoMap={equipoMap} soloPrevia onOpenPartido={onOpenPartido}/>}
      {tab==="primera"&&letras(r1).map(L=>(
        <Tabla key={L} titulo={"Grupo "+L} filas={calcTablaGrupo(delGrupo(r1,L))} zonas={zonasR1}/>
      ))}
      {tab==="segunda"&&letras(r2).map(L=>{
        const t=tablaSegunda(L);
        return <Tabla key={L} titulo={"Grupo "+L} filas={t.filas} zonas={zonasR2} nota={t.arrastre?"incluye "+t.arrastre+" partidos arrastrados de la Primera Ronda":null}/>;
      })}
      {tab==="playins"&&(
        <div>
          {playins.some(p=>/Semifinales/i.test(nt(p)))&&<TarjetaSeries titulo="Play-In Semifinales · el ganador va a semifinales" ps={playins.filter(p=>/Semifinales/i.test(nt(p)))}/>}
          {playins.some(p=>/Cuartos/i.test(nt(p)))&&<TarjetaSeries titulo="Play-In Cuartos · el ganador va a cuartos" ps={playins.filter(p=>/Cuartos/i.test(nt(p)))}/>}
        </div>
      )}
      {tab==="six"&&<FaseFinal psLiga={six} equipoMap={equipoMap} onOpenPartido={onOpenPartido} mvpPlayer={mvpPlayer} onGoToPlayer={onGoToPlayer}/>}
    </div>
  );
}

/* ── Fase final (bracket compacto solo con banderas) ─────── */
function KOBox({p,equipoMap,caption,onOpen}){
  if(!p)return null;
  const played=p.resultado_local!=null&&p.resultado_visitante!=null;
  const enVivo=getPartidoEstado(p)==="en_juego"&&played;
  const winL=played&&Number(p.resultado_local)>Number(p.resultado_visitante);
  const winV=played&&Number(p.resultado_visitante)>Number(p.resultado_local);
  const row=(idEq,res,win)=>{
    const team=idEq?equipoMap[idEq]:null;
    return(
      <div style={{display:"flex",alignItems:"center",gap:"6px",padding:"3px 7px",background:win?"#faf5ff":"transparent",minWidth:0}}>
        {team
          ?<TeamBadge team={team} size={18}/>
          :<div style={{width:18,height:18,borderRadius:"5px",border:"1.5px dashed #cbd5e1",flexShrink:0}}/>}
        <span style={{flex:1,fontSize:"11px",fontWeight:win?800:600,color:team?(win?"#7c3aed":"#334155"):"#cbd5e1",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{team?team.nombre:"—"}</span>
        <span style={{fontSize:"11px",fontWeight:win?800:600,color:win?"#7c3aed":"#64748b",fontVariantNumeric:"tabular-nums",flexShrink:0}}>{played?res:""}</span>
      </div>
    );
  };
  return(
    <div style={{width:"150px",flexShrink:0}}>
      <div onClick={onOpen?()=>onOpen(p):undefined}
        style={{background:"#fff",border:enVivo?"1.5px solid #ef4444":"1px solid #e2e8f0",borderRadius:"10px",overflow:"hidden",cursor:onOpen?"pointer":"default"}}>
        {row(p.id_equipo_local,p.resultado_local,winL)}
        <div style={{height:"1px",background:"#f1f5f9"}}/>
        {row(p.id_equipo_visitante,p.resultado_visitante,winV)}
      </div>
      {caption&&<div style={{fontSize:"9px",color:"#94a3b8",textAlign:"center",marginTop:"2px",fontWeight:700}}>{caption}</div>}
    </div>
  );
}

function BracketCol({label,children,align}){
  return(
    <div style={{display:"flex",flexDirection:"column",flexShrink:0}}>
      <div style={{fontSize:"10px",fontWeight:800,color:"#94a3b8",textAlign:"center",textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:"8px",whiteSpace:"nowrap"}}>{label}</div>
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:align||"space-around",gap:"8px"}}>{children}</div>
    </div>
  );
}

function BracketCard({title,children}){
  return(
    <div style={{background:"#fff",borderRadius:"16px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"16px",overflow:"hidden"}}>
      <div style={{background:"#f5f3ff",padding:"10px 16px",borderBottom:"1px solid #e9d5ff"}}>
        <span style={{fontWeight:800,fontSize:"14px",color:"#7c3aed"}}>{title}</span>
      </div>
      <div style={{padding:"14px",overflowX:"auto"}}>{children}</div>
    </div>
  );
}

function FaseFinal({psLiga,equipoMap,onOpenPartido,mvpPlayer,onGoToPlayer}){
  // El cuadro se arma POR RONDAS leyendo la nota (espanol o ingles) y ordenando por #N,
  // asi vale para 8, 16 o cualquier tamano. Play-In y fase previa van en tarjetas aparte.
  const nt=p=>(p&&p.notas)||"";
  const num=p=>{const m=nt(p).match(/#(\d+)/);return m?parseInt(m[1],10):99999;};
  const box=(p,caption)=><KOBox key={(p&&p.id)||caption} p={p} equipoMap={equipoMap} caption={caption} onOpen={onOpenPartido}/>;
  const bpos=p=>p.bracket_pos!=null?p.bracket_pos:99999;
  const sortN=arr=>arr.slice().sort((a,b)=>(bpos(a)-bpos(b))||num(a)-num(b)||(new Date(a.fecha_hora)-new Date(b.fecha_hora))||a.id-b.id);
  const esGrupo=p=>/\bgrupo\b|\bgroup\b|fase de grupos/i.test(nt(p))&&!/#\d+/.test(nt(p));
  const esRegular=p=>/regular season|temporada regular|liga regular|jornada/i.test(nt(p));
  const esPlayIn=p=>/play\s*-?\s*in/i.test(nt(p));
  const esPrevia=p=>!esPlayIn(p)&&/qualifier|fase previa|previa|clasificatoria|preliminar/i.test(nt(p));
  const es3er=p=>/3er|tercer|bronce|3rd\s*place|third\s*place/i.test(nt(p));
  const esClasif=p=>!es3er(p)&&!esPrevia(p)&&!esPlayIn(p)&&/clasificaci|classification|placement|puestos/i.test(nt(p));
  const base=p=>!esGrupo(p)&&!esRegular(p)&&!esPlayIn(p)&&!esPrevia(p)&&!esClasif(p)&&!es3er(p);
  const esOctavos=p=>base(p)&&/octavos|round of 16|dieciseisavos/i.test(nt(p));
  const esCuartos=p=>base(p)&&!esOctavos(p)&&/cuartos|quarter/i.test(nt(p));
  const esSemi=p=>base(p)&&!esOctavos(p)&&!esCuartos(p)&&/semi/i.test(nt(p));
  const esFinal=p=>base(p)&&!esOctavos(p)&&!esCuartos(p)&&!esSemi(p)&&/\bfinal\b/i.test(nt(p));
  const usable=psLiga.filter(p=>!esGrupo(p)&&!esRegular(p)&&nt(p));
  const octavos=sortN(usable.filter(esOctavos));
  const cuartos=sortN(usable.filter(esCuartos));
  const semis=sortN(usable.filter(esSemi));
  const finales=sortN(usable.filter(esFinal));
  const finalP=finales[0]||null;
  const bronce=sortN(usable.filter(es3er))[0]||null;
  const clasif=sortN(usable.filter(esClasif));
  const playin=sortN(usable.filter(esPlayIn));
  const previa=sortN(usable.filter(esPrevia));
  const capLimpia=p=>nt(p).replace(/#\d+/g,"").replace(/\(ida-vuelta\)/ig,"").replace(/\u00b7/g,"").trim();
  // Series a doble partido: varios partidos comparten #N
  const porSerie=arr=>{const m=new Map();arr.forEach(p=>{const k=num(p);if(!m.has(k))m.set(k,[]);m.get(k).push(p);});return [...m.entries()].sort((a,b)=>a[0]-b[0]);};
  const tarjetaSerie=(titulo,arr)=>(
    <BracketCard title={titulo}>
      <div style={{display:"flex",gap:"14px",alignItems:"flex-start",flexWrap:"wrap"}}>
        {porSerie(arr).map(([n,ps])=>(
          <BracketCol key={n} label={(capLimpia(ps[0])||titulo)+(ps.length>1?" · serie":"")}>
            {ps.map((p,i)=>box(p,ps.length>1?(i===0?"Ida":(i===1?"Vuelta":"3er partido")):undefined))}
          </BracketCol>
        ))}
      </div>
    </BracketCard>
  );
  // Bracket árbol: cada ronda alineada con sus pares de la ronda anterior
  const GAME_H=58,GAME_GAP=10,SLOT=68,GAME_W=152,CONN_W=24;
  const octS=[...octavos];
  const qfS=[...cuartos];
  const sfS=[...semis];
  const nBase=Math.max(octS.length,qfS.length*2,sfS.length*4,1);
  const totalH=nBase*SLOT-GAME_GAP;
  const r16C=octS.map((_,i)=>i*SLOT+GAME_H/2);
  const qfC=qfS.map((_,i)=>{const c1=r16C[i*2]??i*SLOT*2+GAME_H/2,c2=r16C[i*2+1]??c1;return(c1+c2)/2;});
  const sfC=sfS.map((_,i)=>{const c1=qfC[i*2]??r16C[i*4]??0,c2=qfC[i*2+1]??c1;return(c1+c2)/2;});
  const finC=sfC.length>=2?(sfC[0]+sfC[sfC.length-1])/2:sfC[0]??qfC[Math.floor(qfC.length/2)]??r16C[Math.floor(r16C.length/2)]??totalH/2;
  const GBox=({g,top,cap})=>!g?null:(<div style={{position:"absolute",top:top-GAME_H/2,left:0,width:GAME_W}}><KOBox p={g} equipoMap={equipoMap} caption={cap} onOpen={onOpenPartido}/></div>);
  const Conn=({froms,to})=>{const mn=Math.min(...froms),mx=Math.max(...froms);return(<svg style={{position:"absolute",top:0,left:0,width:CONN_W,height:totalH,overflow:"visible",pointerEvents:"none"}} viewBox={"0 0 "+CONN_W+" "+totalH}>{froms.map((f,fi)=><line key={fi} x1={0} y1={f} x2={CONN_W/2} y2={f} stroke="#e2e8f0" strokeWidth={1.5}/>)}{mn!==mx&&<line x1={CONN_W/2} y1={mn} x2={CONN_W/2} y2={mx} stroke="#e2e8f0" strokeWidth={1.5}/>}<line x1={CONN_W/2} y1={to} x2={CONN_W} y2={to} stroke="#e2e8f0" strokeWidth={1.5}/></svg>);};
  const Hdr=({label,left,w})=>(<div style={{position:"absolute",top:-22,left,width:w,textAlign:"center",fontSize:"9px",fontWeight:800,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.4px",whiteSpace:"nowrap"}}>{label}</div>);
  const hasQF=qfS.length>0,hasSF=sfS.length>0,hasFin=!!(finalP||bronce);
  const colW=GAME_W+CONN_W;
  const totalW=GAME_W+(hasQF?colW:0)+(hasSF?colW:0)+(hasFin?colW:0);
  const hayCuadro=octavos.length||cuartos.length||semis.length||finalP||bronce;
  return(
    <div>
      {hayCuadro&&(
        <BracketCard title="Cuadro final">
          <div style={{overflowX:"auto",paddingTop:"24px",paddingBottom:"4px"}}>
            <div style={{position:"relative",height:totalH,width:totalW,minWidth:totalW}}>
              {/* Columna 1: R16 u Octavos */}
              {octS.length>0&&<Hdr label={octS.length>4?"Octavos":"Cuartos"} left={0} w={GAME_W}/>}
              {octS.map((g,i)=><GBox key={g.id} g={g} top={r16C[i]}/>)}
              {/* Cuartos */}
              {hasQF&&<>
                <Hdr label="Cuartos" left={GAME_W+CONN_W} w={GAME_W}/>
                <div style={{position:"absolute",top:0,left:GAME_W,width:CONN_W,height:totalH}}>
                  {qfS.map((_,i)=><Conn key={i} froms={[r16C[i*2]??finC,r16C[i*2+1]??r16C[i*2]??finC]} to={qfC[i]}/>)}
                </div>
                <div style={{position:"absolute",top:0,left:GAME_W+CONN_W,width:GAME_W,height:totalH}}>
                  {qfS.map((g,i)=><GBox key={g.id||"qf"+i} g={g} top={qfC[i]}/>)}
                </div>
              </>}
              {/* Semis */}
              {hasSF&&<>
                <Hdr label="Semifinales" left={GAME_W+(hasQF?colW:0)+CONN_W} w={GAME_W}/>
                <div style={{position:"absolute",top:0,left:GAME_W+(hasQF?colW:0),width:CONN_W,height:totalH}}>
                  {sfS.map((_,i)=><Conn key={i} froms={[qfC[i*2]??r16C[i*2]??finC,qfC[i*2+1]??qfC[i*2]??finC]} to={sfC[i]}/>)}
                </div>
                <div style={{position:"absolute",top:0,left:GAME_W+(hasQF?colW:0)+CONN_W,width:GAME_W,height:totalH}}>
                  {sfS.map((g,i)=><GBox key={g.id||"sf"+i} g={g} top={sfC[i]}/>)}
                </div>
              </>}
              {/* Final */}
              {hasFin&&<>
                <Hdr label="Final" left={GAME_W+(hasQF?colW:0)+(hasSF?colW:0)+CONN_W} w={GAME_W}/>
                <div style={{position:"absolute",top:0,left:GAME_W+(hasQF?colW:0)+(hasSF?colW:0),width:CONN_W,height:totalH}}>
                  <Conn froms={sfC.length>=2?sfC:hasSF?sfC:[finC]} to={finC}/>
                </div>
                <div style={{position:"absolute",top:0,left:GAME_W+(hasQF?colW:0)+(hasSF?colW:0)+CONN_W,width:GAME_W,height:totalH}}>
                  {finalP&&<GBox g={finalP} top={finC} cap="🏆 Final"/>}
                  {bronce&&<GBox g={bronce} top={finC+GAME_H+GAME_GAP} cap="🥉 3er puesto"/>}
                  {mvpPlayer&&(<div onClick={()=>onGoToPlayer&&onGoToPlayer(mvpPlayer.id_jugadora)} style={{position:"absolute",top:finC+GAME_H*2+GAME_GAP*2+4,left:0,display:"flex",flexDirection:"column",alignItems:"center",cursor:onGoToPlayer?"pointer":"default",gap:"2px",width:GAME_W}}>
                    <Avatar photo={mvpPlayer.foto} name={mvpPlayer.nombre} size={40} fontSize={13}/>
                    <span style={{fontSize:"11px",fontWeight:700,color:"#1e293b",whiteSpace:"nowrap",maxWidth:"150px",overflow:"hidden",textOverflow:"ellipsis"}}>{mvpPlayer.nombre}</span>
                    <span style={{fontSize:"9px",fontWeight:800,color:"#b45309",letterSpacing:"0.5px"}}>🏅 MVP</span>
                  </div>)}
                </div>
              </>}
            </div>
          </div>
        </BracketCard>
      )}
      {playin.length>0&&tarjetaSerie("Play-In",playin)}
      {clasif.length>0&&(
        <BracketCard title="Clasificacion">
          <div style={{display:"flex",gap:"14px",alignItems:"stretch",flexWrap:"wrap"}}>
            {clasif.map(p=>box(p,capLimpia(p)||"Clasificacion"))}
          </div>
        </BracketCard>
      )}
      {previa.length>0&&tarjetaSerie("Fase previa",previa)}
    </div>
  );
}

/* ── Playoffs de liga (series al mejor de N) ─────────────── */
// Convención de notas: "Playoffs Cuartos #1".."#4", "Playoffs Semifinales #1","#2",
// "Playoffs Final". Todos los partidos de una misma serie llevan la misma nota; la
// caja muestra las victorias de cada equipo en la serie.
function SerieBox({partidosSerie,equipoMap,compacto,onOpen}){
  const [abierta,setAbierta]=useState(false);
  const ids=[];
  partidosSerie.forEach(p=>{[p.id_equipo_local,p.id_equipo_visitante].forEach(id=>{if(id&&!ids.includes(id))ids.push(id);});});
  const idaVuelta=/ida-vuelta/i.test(partidosSerie[0]?.notas||"");
  const wins={};
  let enVivo=false;
  partidosSerie.forEach(p=>{
    if(p.resultado_local==null||p.resultado_visitante==null)return;
    if(getPartidoEstado(p)==="en_juego"){enVivo=true;return;}
    if(idaVuelta){
      wins[p.id_equipo_local]=(wins[p.id_equipo_local]||0)+Number(p.resultado_local);
      wins[p.id_equipo_visitante]=(wins[p.id_equipo_visitante]||0)+Number(p.resultado_visitante);
      return;
    }
    const ganador=Number(p.resultado_local)>Number(p.resultado_visitante)?p.id_equipo_local:p.id_equipo_visitante;
    wins[ganador]=(wins[ganador]||0)+1;
  });
  const etiqueta=team=>{
    if(team.codigo)return team.codigo;
    const w=(team.nombre||"").replace(/[^A-Za-zÀ-ÿ ]/g,"").split(/\s+/).filter(Boolean);
    return (w[w.length-1]||team.nombre||"?").slice(0,4).toUpperCase();
  };
  const unico=partidosSerie.length===1;
  const row=idEq=>{
    const team=idEq?equipoMap[idEq]:null;
    // Si es un solo partido, mostrar resultado real; si es serie, mostrar global
    let w, lidera;
    if(unico){
      const p0=partidosSerie[0];
      const played=p0.resultado_local!=null;
      w=played?(idEq===p0.id_equipo_local?p0.resultado_local:p0.resultado_visitante):null;
      lidera=played&&((idEq===p0.id_equipo_local&&Number(p0.resultado_local)>Number(p0.resultado_visitante))||(idEq===p0.id_equipo_visitante&&Number(p0.resultado_visitante)>Number(p0.resultado_local)));
    }else{
      w=idEq?(wins[idEq]||0):null;
      lidera=idEq&&w>0&&w>=Math.max(...ids.map(x=>wins[x]||0))&&ids.some(x=>x!==idEq&&(wins[x]||0)<w);
    }
    return(
      <div key={idEq||Math.random()} style={{display:"flex",alignItems:"center",gap:compacto?"4px":"6px",padding:compacto?"3px 6px":"3px 7px",background:lidera?"#faf5ff":"transparent",minWidth:0}}>
        {team
          ?<TeamBadge team={team} size={compacto?15:18}/>
          :<div style={{width:compacto?15:18,height:compacto?15:18,borderRadius:"5px",border:"1.5px dashed #cbd5e1",flexShrink:0}}/>}
        <span title={team?team.nombre:""} style={{flex:1,fontSize:compacto?"10px":"11px",fontWeight:lidera?800:600,color:team?(lidera?"#7c3aed":"#334155"):"#cbd5e1",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{team?(compacto?etiqueta(team):team.nombre):"—"}</span>
        <span style={{fontSize:compacto?"10px":"11px",fontWeight:lidera?800:600,color:lidera?"#7c3aed":"#64748b",fontVariantNumeric:"tabular-nums",flexShrink:0}}>{w!=null&&partidosSerie.some(p=>p.resultado_local!=null)?w:""}</span>
      </div>
    );
  };
  const multi=partidosSerie.length>1;
  const toggleSerie=e=>{e.stopPropagation();setAbierta(!abierta);};
  return(
    <div style={{width:compacto?"96px":"150px",flexShrink:0}}>
      <div onClick={multi?toggleSerie:(onOpen&&partidosSerie[0]?()=>onOpen(partidosSerie[0]):undefined)}
        style={{background:"#fff",border:enVivo?"1.5px solid #ef4444":(abierta?"1.5px solid #c084fc":"1px solid #e2e8f0"),borderRadius:"10px",overflow:"hidden",transition:"border-color 0.15s",cursor:"pointer"}}
        onMouseEnter={e=>e.currentTarget.style.borderColor="#c084fc"}
        onMouseLeave={e=>e.currentTarget.style.borderColor=enVivo?"#ef4444":(abierta?"#c084fc":"#e2e8f0")}>
        {row(ids[0])}
        <div style={{height:"1px",background:"#f1f5f9"}}/>
        {row(ids[1])}
      </div>
      {multi&&abierta&&(
        <div style={{marginTop:"4px",display:"flex",flexDirection:"column",gap:"3px"}}>
          {partidosSerie.sort((a,b)=>new Date(a.fecha_hora||0)-new Date(b.fecha_hora||0)).map((p,i)=>{
            const played=p.resultado_local!=null;
            const winL=played&&Number(p.resultado_local)>Number(p.resultado_visitante);
            const winV=played&&!winL&&Number(p.resultado_visitante)>Number(p.resultado_local);
            const tL=equipoMap[p.id_equipo_local],tV=equipoMap[p.id_equipo_visitante];
            return(
              <div key={p.id} onClick={e=>{e.stopPropagation();onOpen&&onOpen(p);}}
                style={{background:"#faf5ff",border:"1px solid #e9d5ff",borderRadius:"8px",padding:"4px 6px",cursor:onOpen?"pointer":"default",fontSize:"10px"}}>
                <div style={{color:"#94a3b8",fontWeight:700,marginBottom:"2px"}}>{idaVuelta?["Ida","Vuelta","3er partido"][i]||"":("Partido "+(i+1))}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontWeight:winL?800:500,color:winL?"#7c3aed":"#475569"}}>{tL?(compacto?etiqueta(tL):tL.nombre):"—"}</span>
                  <span style={{fontWeight:800,color:"#7c3aed",margin:"0 4px"}}>{played?(p.resultado_local+" - "+p.resultado_visitante):"vs"}</span>
                  <span style={{fontWeight:winV?800:500,color:winV?"#7c3aed":"#475569"}}>{tV?(compacto?etiqueta(tV):tV.nombre):"—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlayoffBracket({psLiga,equipoMap,soloPrevia,onOpenPartido,showAscenso}){
  const series=useMemo(()=>{
    const m={};
    psLiga.forEach(p=>{
      if(!/playoff|final campeones/i.test(p.notas||""))return;
      const clave=p.notas.trim();
      if(!m[clave])m[clave]=[];
      m[clave].push(p);
    });
    return m;
  },[psLiga]);
  const numDe=k=>{const mt=k.match(/#(\d+)/);return mt?parseInt(mt[1],10):0;};
  const buscar=(regex)=>Object.keys(series).filter(k=>regex.test(k)).sort((a,b)=>numDe(a)-numDe(b)).map(k=>series[k]);
  const idaVuelta=s=>/ida-vuelta/i.test(s[0]?.notas||"");
  const teamsOf=s=>[...new Set(s.flatMap(p=>[p.id_equipo_local,p.id_equipo_visitante]).filter(Boolean))];
  const winnerOf=s=>{
    const ag={};
    s.forEach(p=>{
      if(p.resultado_local==null||p.resultado_visitante==null)return;
      if(idaVuelta(s)){ag[p.id_equipo_local]=(ag[p.id_equipo_local]||0)+Number(p.resultado_local);ag[p.id_equipo_visitante]=(ag[p.id_equipo_visitante]||0)+Number(p.resultado_visitante);}
      else{const gn=Number(p.resultado_local)>Number(p.resultado_visitante)?p.id_equipo_local:p.id_equipo_visitante;ag[gn]=(ag[gn]||0)+1;}
    });
    const ids=teamsOf(s);
    if(ids.length<2)return null;
    const a=ag[ids[0]]||0,b=ag[ids[1]]||0;
    return a>b?ids[0]:(b>a?ids[1]:null);
  };

  if(soloPrevia){
    const previa=buscar(/previa/i);
    if(!previa.length)return<p style={{color:"#94a3b8",textAlign:"center",paddingTop:"40px"}}>Sin fase previa.</p>;
    return(
      <BracketCard title="Fase previa">
        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {previa.map((s,i)=>{const w=winnerOf(s);const t=w&&equipoMap[w];return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <SerieBox partidosSerie={s} equipoMap={equipoMap} onOpen={onOpenPartido}/>
              {t&&<div style={{display:"flex",alignItems:"center",gap:"5px",whiteSpace:"nowrap"}}>
                <span style={{color:"#22c55e",fontWeight:800,fontSize:"14px"}}>→</span>
                <TeamBadge team={t} size={18}/>
                <span style={{fontSize:"11px",fontWeight:800,color:"#16a34a"}}>{t.nombre}</span>
                <span style={{fontSize:"10px",color:"#94a3b8"}}>a grupos</span>
              </div>}
            </div>
          );})}
        </div>
      </BracketCard>
    );
  }

  // Separar Final de Campeones del bracket de ascenso
  const finalCampeones=buscar(/final campeones/i);
  const dieci=buscar(/dieciseisavos/i);
  const octavos=buscar(/octavos/i);
  const cuartos=buscar(/cuartos/i);
  const semis=buscar(/semi/i);
  const finalAsc=buscar(/playoffs final/i).filter(s=>!/semi/i.test(s[0].notas)&&!/previa/i.test(s[0].notas)&&!/campeones/i.test(s[0].notas));
  const hayBracket=dieci.length||octavos.length||cuartos.length||semis.length||finalAsc.length;

  if(!finalCampeones.length&&!hayBracket)return(
    <p style={{color:"#94a3b8",textAlign:"center",paddingTop:"40px"}}>El cuadro se rellenará cuando avance la competición.</p>
  );

  const AscLabel=({serie})=>{if(!showAscenso)return null;const w=winnerOf(serie);const t=w&&equipoMap[w];if(!t)return null;return(
    <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"8px"}}>
      <span style={{color:"#22c55e",fontWeight:800,fontSize:"16px"}}>→</span>
      <TeamBadge team={t} size={20}/>
      <span style={{fontSize:"12px",fontWeight:800,color:"#16a34a"}}>{t.nombre}</span>
      <span style={{background:"#dcfce7",color:"#15803d",fontSize:"10px",fontWeight:800,padding:"2px 8px",borderRadius:"10px"}}>ASCENDIDO</span>
    </div>
  );};

  // Ordenar rondas del bracket de ascenso
  const cols=[["Dieciseisavos",dieci],["Octavos",octavos],["Cuartos",cuartos],["Semifinales",semis],["Final",finalAsc]].filter(([,s])=>s.length);
  for(let i=cols.length-2;i>=0;i--){
    const above=cols[i+1][1], cur=cols[i][1], used=new Set(), nw=[];
    above.forEach(as=>{teamsOf(as).forEach(team=>{const f=cur.find(s=>!used.has(s)&&winnerOf(s)===team);if(f){used.add(f);nw.push(f);}});});
    cur.forEach(s=>{if(!used.has(s))nw.push(s);});
    cols[i][1]=nw;
  }
  const compacto=dieci.length>0;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
      {finalCampeones.length>0&&<BracketCard title="🏆 Final de Campeones">
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"8px"}}>
          {finalCampeones.map((s,i)=>(
            <div key={i}>
              <SerieBox partidosSerie={s} equipoMap={equipoMap} onOpen={onOpenPartido}/>
              <AscLabel serie={s}/>
            </div>
          ))}
        </div>
      </BracketCard>}
      {hayBracket&&<BracketCard title="🏀 Playoff de Ascenso">
        <div style={{display:"flex",gap:"14px",alignItems:"stretch"}}>
          {cols.map(([lbl,s],ci)=><BracketCol key={lbl} label={lbl}>{s.map((serie,i)=>{
            const esFinal=ci===cols.length-1;
            return(<div key={i}>
              <SerieBox partidosSerie={serie} equipoMap={equipoMap} compacto={compacto} onOpen={onOpenPartido}/>
              {esFinal&&<AscLabel serie={serie}/>}
            </div>);
          })}</BracketCol>)}
        </div>
      </BracketCard>}
    </div>
  );
}

function StandingFinal({psLiga,equipoMap,temporada,onGoToTeam,mvpPlayer,onGoToPlayer}){
  // Cada partido de clasificación decide dos puestos: el ganador el más alto, el perdedor el siguiente.
  const posiciones=useMemo(()=>{
    const byNum={};
    psLiga.forEach(p=>{const m=(p.notas||"").match(/#(\d+)/);if(m)byNum[m[1]]=p;});
    const decisores=[[56,1],[55,3],[54,5],[53,7],[52,9],[51,11],[50,13],[49,15]];
    const pos={};
    decisores.forEach(([num,puesto])=>{
      const p=byNum[String(num)];
      if(!p||p.resultado_local==null||p.resultado_visitante==null||!p.id_equipo_local||!p.id_equipo_visitante)return;
      if(getPartidoEstado(p)==="en_juego")return; // marcador en vivo: puesto aún no decidido
      const localGana=Number(p.resultado_local)>Number(p.resultado_visitante);
      pos[puesto]=localGana?p.id_equipo_local:p.id_equipo_visitante;
      pos[puesto+1]=localGana?p.id_equipo_visitante:p.id_equipo_local;
    });
    return pos;
  },[psLiga]);
  const medalla=i=>i===1?"🥇":i===2?"🥈":i===3?"🥉":null;

  return(
    <div style={{background:"#fff",borderRadius:"16px",overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
      {Array.from({length:16},(_,idx)=>{
        const i=idx+1;
        const team=posiciones[i]?equipoMap[posiciones[i]]:null;
        const med=medalla(i);
        return(
          <div key={i} onClick={()=>team&&onGoToTeam&&onGoToTeam(team.id_equipo,temporada)}
            style={{display:"flex",alignItems:"center",gap:"10px",padding:"9px 16px",borderTop:i>1?"1px solid #f1f5f9":"none",
              background:i===1?"#fffbeb":i===2?"#f8fafc":i===3?"#fff7ed":"#fff",cursor:team&&onGoToTeam?"pointer":"default"}}>
            <span style={{width:"28px",textAlign:"center",fontSize:med?"18px":"13px",fontWeight:800,color:"#94a3b8",flexShrink:0}}>{med||i}</span>
            {team?(
              <>
                <TeamBadge team={team} size={26}/>
                <span style={{fontWeight:i<=3?800:600,fontSize:"13px",color:"#1e293b"}}>{team.nombre}</span>
                {i===1&&mvpPlayer&&(
                  <div onClick={e=>{e.stopPropagation();onGoToPlayer&&onGoToPlayer(mvpPlayer.id_jugadora);}}
                    style={{marginLeft:"auto",display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",flexShrink:0}}>
                    <Avatar photo={mvpPlayer.foto} name={mvpPlayer.nombre} size={34} fontSize={12}/>
                    <span style={{fontSize:"9px",fontWeight:800,color:"#b45309",marginTop:"2px",letterSpacing:"0.5px"}}>MVP</span>
                  </div>
                )}
              </>
            ):(
              <>
                <div style={{width:26,height:26,borderRadius:"8px",border:"1.5px dashed #cbd5e1",flexShrink:0}}/>
                <span style={{fontSize:"13px",color:"#cbd5e1"}}>—</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClasificacionGrupos({partidos,equipos,ligas,ligaId,temporada,vistaInicial,onBack,onGoToTeam,onOpenPartido,onVistaChange,mvps,players,onGoToPlayer,equiposNombres}){
  const equipoMapBase=useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  // Nombres y escudos históricos: cada equipo se resuelve a cómo se llamaba en ESTA temporada
  const equipoMap=useMemo(()=>{
    const m={};
    equipos.forEach(e=>{m[e.id_equipo]={...e,...resolveTeamData(e.id_equipo,temporada,equiposNombres,equipoMapBase)};});
    return m;
  },[equipos,temporada,equiposNombres,equipoMapBase]);
  const psLiga=useMemo(()=>partidos.filter(p=>p.id_liga===ligaId&&(p.temporada||"")===(temporada||"")),[partidos,ligaId,temporada]);
  const grupos=useMemo(()=>calcClasificacion(psLiga,equipoMap),[psLiga,equipoMap]);
  const liga=useMemo(()=>(ligas||[]).find(l=>l.id_liga===ligaId),[ligas,ligaId]);
  const modoLiga=liga?.tipo==="liga";
  const hayKO=useMemo(()=>!modoLiga&&psLiga.some(p=>p.notas&&!/playoff/i.test(p.notas)&&(/#\d+/.test(p.notas)||/^octavos/i.test(p.notas))),[psLiga,modoLiga]);
  const hayBracketIV=useMemo(()=>!modoLiga&&psLiga.some(p=>/playoff/i.test(p.notas||"")&&!/previa/i.test(p.notas||"")),[psLiga,modoLiga]);
  const hayPreviaIV=useMemo(()=>!modoLiga&&psLiga.some(p=>/playoff/i.test(p.notas||"")&&/previa/i.test(p.notas||"")),[psLiga,modoLiga]);
  const hayPlayoffs=useMemo(()=>modoLiga&&psLiga.some(p=>/playoff|final campeones/i.test(p.notas||"")),[psLiga,modoLiga]);
  // Standing (clasificación por puestos) solo en torneos con cruces de clasificación 3º-16º (#49-#55).
  // Un Final Four (solo semifinales y final) no los tiene, así que no muestra ni Grupos ni Standing.
  const hayStanding=useMemo(()=>!modoLiga&&psLiga.some(p=>/#(49|5[0-5])\b/.test(p.notas||"")),[psLiga,modoLiga]);
  // Fases de clasificación FIBA (presentes cuando hay notas con esos patrones)
  const hayCL1316=useMemo(()=>!modoLiga&&psLiga.some(p=>/^(13|14|15).*puesto/i.test(p.notas||"")),[psLiga,modoLiga]);
  const hayCL912 =useMemo(()=>!modoLiga&&psLiga.some(p=>/^(9|10|11).*puesto/i.test(p.notas||"")),[psLiga,modoLiga]);
  const hayCL58  =useMemo(()=>!modoLiga&&psLiga.some(p=>/^(5|6|7).*puesto/i.test(p.notas||"")),[psLiga,modoLiga]);
  // Zonas de la tabla en modo liga (formato Liga Femenina Endesa): 8 a playoffs, 2 descensos
  // Zonas de clasificación por liga
  const ZONAS_LIGA={
    L001:{playoff:8,descenso:2,copa:8,copaLabel:"Copa de la Reina (8 primeros al final de la 1ª vuelta)"},
    L002:{ascenso:1,ascensoLabel:"Ascenso directo a LF Endesa",playoffAsc:9,playoffAscLabel:"Playoffs de ascenso (2º-9º)",descenso:2},
    L003:{ascenso:1,ascensoLabel:"Final de campeones (ascenso directo)",playoffAsc:4,playoffAscLabel:"Playoffs de ascenso (2º-4º)",descenso:3},
  };
  const zl=ZONAS_LIGA[liga?.id_liga]||{};
  const PLAYOFF_PUESTOS=zl.playoff||(zl.ascenso?0:8), DESCENSO_PUESTOS=zl.descenso||2;
  const COPA_PUESTOS=zl.copa||0, COPA_LABEL=zl.copaLabel||"";
  const multiGrupo=modoLiga&&grupos.length>1;
  const vistaIni=multiGrupo?"grp0":(vistaInicial==="grupos"&&grupos.length)||(vistaInicial==="standing"&&hayStanding)||(vistaInicial==="final"&&(hayKO||hayBracketIV))?vistaInicial:(grupos.length?"grupos":hayPreviaIV?"previa":(hayKO||hayBracketIV)?"final":"standing");
  const [vista,setVista]=useState(vistaIni);
  const [grupoSel,setGrupoSel]=useState(0);
  const mvpPlayer=useMemo(()=>{
    const m=(mvps||[]).find(x=>x.id_liga===ligaId&&(x.temporada||"")===(temporada||""));
    return m?(players||[]).find(p=>p.id_jugadora===m.id_jugadora)||null:null;
  },[mvps,players,ligaId,temporada]);

  // Euroliga: estructura propia (1a ronda, 2a ronda, play-ins, final six)
  const esEuroliga=useMemo(()=>psLiga.some(p=>/^Primera Ronda/i.test(p.notas||""))&&psLiga.some(p=>/^Segunda Ronda/i.test(p.notas||"")),[psLiga]);
  if(!grupos.length&&!hayKO&&!hayBracketIV&&!hayPreviaIV)return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"16px"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#9333ea",fontWeight:700,fontSize:"15px",cursor:"pointer",padding:"0 0 16px"}}>← Volver</button>
      <p style={{color:"#94a3b8",textAlign:"center",paddingTop:"40px"}}>No hay partidos con resultado para calcular la clasificación.</p>
    </div>
  );

  if(esEuroliga)return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"16px",fontFamily:"system-ui,sans-serif"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#9333ea",fontWeight:700,fontSize:"15px",cursor:"pointer",padding:"0 0 16px"}}>← Volver</button>
      <h1 style={{fontWeight:800,fontSize:"20px",color:"#1e293b",margin:"0 0 20px"}}>🏆 Clasificación</h1>
      <EuroligaFases psLiga={psLiga} equipoMap={equipoMap} onOpenPartido={onOpenPartido} mvpPlayer={mvpPlayer} onGoToPlayer={onGoToPlayer}/>
    </div>
  );

  return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"16px",fontFamily:"system-ui,sans-serif"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#9333ea",fontWeight:700,fontSize:"15px",cursor:"pointer",padding:"0 0 16px"}}>← Volver</button>
      <h1 style={{fontWeight:800,fontSize:"20px",color:"#1e293b",margin:"0 0 20px"}}>🏆 Clasificación</h1>
      {(()=>{
        const tabs=modoLiga
          ?[...(multiGrupo?grupos.map((g,i)=>[`grp${i}`,g.nombre]):[["grupos","Clasificación"]]),...(hayPlayoffs?[["final","Playoffs"]]:[])]
          :[...(hayPreviaIV?[["previa","Fase previa"]]:[]),...(grupos.length?[["grupos","Group Phase"]]:[]),...(hayCL1316?[["cl1316","Class. 13-16"]]:[]),...(hayCL912?[["cl912","Class. 9-12"]]:[]),...(hayCL58?[["cl58","Class. 5-8"]]:[]),...((hayKO||hayBracketIV)?[["final","Bracket"]]:[]),...(hayStanding?[["standing","🏅 Standing"]]:[])];
        if(tabs.length<=1)return null;
        return(
          <div style={{display:"flex",gap:"8px",marginBottom:"16px"}}>
            {tabs.map(([k,lbl])=>(
              <button key={k} onClick={()=>{setVista(k);onVistaChange&&onVistaChange(k);}}
                style={{border:"none",borderRadius:"10px",padding:"8px 16px",fontSize:"13px",fontWeight:700,cursor:"pointer",
                  background:vista===k?"#9333ea":"#fff",color:vista===k?"#fff":"#64748b",boxShadow:vista===k?"none":"0 1px 4px rgba(0,0,0,0.06)"}}>{lbl}</button>
            ))}
          </div>
        );
      })()}
      {vista==="previa"&&hayPreviaIV&&<PlayoffBracket psLiga={psLiga} equipoMap={equipoMap} soloPrevia onOpenPartido={onOpenPartido}/>}
      {vista==="final"&&hayBracketIV&&<PlayoffBracket psLiga={psLiga} equipoMap={equipoMap} onOpenPartido={onOpenPartido}/>}
      {vista==="final"&&hayKO&&<FaseFinal psLiga={psLiga} equipoMap={equipoMap} onOpenPartido={onOpenPartido} mvpPlayer={mvpPlayer} onGoToPlayer={onGoToPlayer}/>}
      {(vista==="cl1316"||vista==="cl912"||vista==="cl58")&&(()=>{
        // Filtros exactos replicando FIBA standings:
        // Class.13-16: solo partidos 13-16 (SIN los 9-16 de primera ronda)
        // Class.9-12: incluye 9-16 primera ronda + 9-12 + 9-10 + 11-12
        // Class.5-8: 5-8 + 5-6 + 7-8
        const filtro=vista==="cl1316"
          ?p=>/^(13|14|15).*puesto/i.test(p.notas||"")
          :vista==="cl912"
          ?p=>/^(9|10|11).*puesto/i.test(p.notas||"")
          :p=>/^(5|6|7).*puesto/i.test(p.notas||"");
        const juegos=psLiga.filter(filtro).sort((a,b)=>{
          const na=a.notas||"",nb=b.notas||"";
          const ma=na.match(/#(\d+)/),mb=nb.match(/#(\d+)/);
          if(a.bracket_pos!=null&&b.bracket_pos!=null)return a.bracket_pos-b.bracket_pos;
          if(ma&&mb)return parseInt(ma[1])-parseInt(mb[1]);
          return 0;
        });
        return(<div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          {juegos.map(p=>{const eqL=equipoMap[p.id_equipo_local],eqV=equipoMap[p.id_equipo_visitante];
            const tieneRes=p.resultado_local!=null;
            return(<div key={p.id} onClick={()=>onOpenPartido&&onOpenPartido(p)} style={{background:"#fff",borderRadius:"12px",border:"1.5px solid #e2e8f0",padding:"10px 14px",cursor:onOpenPartido?"pointer":"default",display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{fontSize:"11px",color:"#94a3b8",minWidth:"110px"}}>{p.notas}</span>
              <span style={{flex:1,fontWeight:tieneRes&&p.resultado_local>p.resultado_visitante?700:500,fontSize:"13px"}}>{eqL?.nombre||"—"}</span>
              {tieneRes?<span style={{fontWeight:700,fontSize:"14px",color:"#1e293b",minWidth:"50px",textAlign:"center"}}>{p.resultado_local} - {p.resultado_visitante}</span>:<span style={{fontSize:"12px",color:"#94a3b8",minWidth:"50px",textAlign:"center"}}>vs</span>}
              <span style={{flex:1,textAlign:"right",fontWeight:tieneRes&&p.resultado_visitante>p.resultado_local?700:500,fontSize:"13px"}}>{eqV?.nombre||"—"}</span>
            </div>);
          })}
          {!juegos.length&&<p style={{color:"#94a3b8",textAlign:"center",paddingTop:"20px"}}>Sin partidos en esta fase todavía.</p>}
        </div>);
      })()}
      {vista==="final"&&hayPlayoffs&&<PlayoffBracket psLiga={psLiga} equipoMap={equipoMap} onOpenPartido={onOpenPartido} showAscenso={!!zl.ascenso}/>}
      {vista==="standing"&&hayKO&&<StandingFinal psLiga={psLiga} equipoMap={equipoMap} temporada={temporada} onGoToTeam={onGoToTeam} mvpPlayer={mvpPlayer} onGoToPlayer={onGoToPlayer}/>}
      {vista==="grupos"&&!grupos.length&&<p style={{color:"#94a3b8",textAlign:"center",paddingTop:"40px"}}>No hay partidos con resultado para calcular la clasificación.</p>}
      {grupos.map(({nombre,equipos:eqs},gi)=>{
        const grpKey=`grp${gi}`;
        if(modoLiga&&grupos.length>1&&vista!==grpKey)return null;
        if(modoLiga&&grupos.length<=1&&vista!=="grupos")return null;
        if(!modoLiga&&vista!=="grupos")return null;
        return(
        <div key={nombre} style={{background:"#fff",borderRadius:"16px",overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"16px"}}>
          <div style={{background:"#f5f3ff",padding:"10px 16px",borderBottom:"1px solid #e9d5ff"}}>
            <span style={{fontWeight:800,fontSize:"14px",color:"#7c3aed"}}>{nombre}</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead>
                <tr style={{background:"#faf5ff"}}>
                  <th style={{textAlign:"left",padding:"8px 12px",fontWeight:700,color:"#64748b",whiteSpace:"nowrap"}}>#</th>
                  <th style={{textAlign:"left",padding:"8px 12px",fontWeight:700,color:"#64748b",whiteSpace:"nowrap"}}>Equipo</th>
                  <th style={{textAlign:"center",padding:"8px 8px",fontWeight:700,color:"#64748b"}}>PJ</th>
                  <th style={{textAlign:"center",padding:"8px 8px",fontWeight:700,color:"#64748b"}}>PG</th>
                  <th style={{textAlign:"center",padding:"8px 8px",fontWeight:700,color:"#64748b"}}>PP</th>
                  <th style={{textAlign:"center",padding:"8px 8px",fontWeight:700,color:"#64748b"}}>PF</th>
                  <th style={{textAlign:"center",padding:"8px 8px",fontWeight:700,color:"#64748b"}}>PC</th>
                  <th style={{textAlign:"center",padding:"8px 8px",fontWeight:700,color:"#64748b"}}>DIF</th>
                  <th style={{textAlign:"center",padding:"8px 12px",fontWeight:700,color:"#9333ea"}}>PTS</th>
                </tr>
              </thead>
              <tbody>
                {eqs.map((eq,i)=>{
                  const team=equipoMap[eq.id];
                  const zonaAsc=modoLiga&&zl.ascenso&&i<zl.ascenso;
                  const zonaPOAsc=modoLiga&&zl.playoffAsc&&!zonaAsc&&i<zl.playoffAsc;
                  const zonaPO=modoLiga&&!zonaAsc&&!zonaPOAsc&&i<PLAYOFF_PUESTOS;
                  const zonaDesc=modoLiga&&i>=eqs.length-DESCENSO_PUESTOS;
                  const fondo=modoLiga?(zonaDesc?"#fef2f2":zonaAsc?"#ecfdf5":zonaPOAsc?"#eff6ff":zonaPO?"#faf5ff":"#fff"):(i===0?"#faf5ff":i<2?"#fffbff":"#fff");
                  const borde=modoLiga?(zonaDesc?"3px solid #ef4444":zonaAsc?"3px solid #16a34a":zonaPOAsc?"3px solid #2563eb":zonaPO?"3px solid #9333ea":"3px solid transparent"):undefined;
                  return(
                    <tr key={eq.id} onClick={()=>onGoToTeam&&onGoToTeam(eq.id,temporada)}
                      style={{borderTop:"1px solid #f1f5f9",background:fondo,cursor:onGoToTeam?"pointer":"default",borderLeft:borde}}>
                      <td style={{padding:"10px 12px",fontWeight:700,color:zonaDesc?"#ef4444":zonaAsc?"#16a34a":zonaPOAsc?"#2563eb":zonaPO&&modoLiga?"#9333ea":"#94a3b8"}}>{i+1}</td>
                      <td style={{padding:"10px 12px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                          {team?.escudo&&<img src={team.escudo} alt="" style={{width:22,height:22,objectFit:"contain"}}/>}
                          <span style={{fontWeight:600,color:"#1e293b",whiteSpace:"nowrap"}}>{team?.nombre||eq.id}</span>
                        </div>
                      </td>
                      <td style={{textAlign:"center",padding:"10px 8px",color:"#475569"}}>{eq.pj}</td>
                      <td style={{textAlign:"center",padding:"10px 8px",color:"#16a34a",fontWeight:600}}>{eq.pg}</td>
                      <td style={{textAlign:"center",padding:"10px 8px",color:"#dc2626",fontWeight:600}}>{eq.pp}</td>
                      <td style={{textAlign:"center",padding:"10px 8px",color:"#475569"}}>{eq.pf}</td>
                      <td style={{textAlign:"center",padding:"10px 8px",color:"#475569"}}>{eq.pc}</td>
                      <td style={{textAlign:"center",padding:"10px 8px",color:eq.dif>0?"#16a34a":eq.dif<0?"#dc2626":"#475569",fontWeight:600}}>{eq.dif>0?"+":""}{eq.dif}</td>
                      <td style={{textAlign:"center",padding:"10px 12px",fontWeight:800,color:"#7c3aed",fontSize:"14px"}}>{eq.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );})}
      {(vista==="grupos"||(modoLiga&&vista?.startsWith("grp")))&&grupos.length>0&&(modoLiga?(
        <div style={{fontSize:"11px",color:"#94a3b8",textAlign:"center",marginTop:"8px",lineHeight:"1.7"}}>
          {zl.ascenso&&<><span style={{display:"inline-block",width:10,height:10,background:"#16a34a",borderRadius:"3px",verticalAlign:"middle",marginRight:"4px"}}/>{zl.ascensoLabel||"Ascenso directo"}</>}
          {zl.playoffAsc&&<><span style={{display:"inline-block",width:10,height:10,background:"#2563eb",borderRadius:"3px",verticalAlign:"middle",margin:"0 4px 0 14px"}}/>{zl.playoffAscLabel||("Playoffs de ascenso ("+zl.ascenso+"º-"+(zl.playoffAsc)+"º)")}</>}
          {!zl.ascenso&&<><span style={{display:"inline-block",width:10,height:10,background:"#9333ea",borderRadius:"3px",verticalAlign:"middle",marginRight:"4px"}}/> Playoffs (1º-{PLAYOFF_PUESTOS}º)</>}
          {COPA_PUESTOS>0&&<><span style={{display:"inline-block",width:10,height:10,background:"#f59e0b",borderRadius:"3px",verticalAlign:"middle",margin:"0 4px 0 14px"}}/>{COPA_LABEL}</>}
          <span style={{display:"inline-block",width:10,height:10,background:"#ef4444",borderRadius:"3px",verticalAlign:"middle",margin:"0 4px 0 14px"}}/> Descenso
          <br/>Criterios de desempate FEB: enfrentamientos particulares → diferencia particular → diferencia general → puntos anotados
        </div>
      ):(
        <div style={{fontSize:"11px",color:"#94a3b8",textAlign:"center",marginTop:"8px"}}>
          Criterios de desempate FIBA: head-to-head → diferencia directa → diferencia global → puntos anotados
        </div>
      ))}
    </div>
  );
}

function EmptyState({icon,text,sub}){return(
  <div style={{textAlign:"center",padding:"80px 20px",color:"#94a3b8"}}>
    <div style={{fontSize:"48px",marginBottom:"12px"}}>{icon}</div>
    <div style={{fontWeight:600,color:"#64748b",fontSize:"16px"}}>{text}</div>
    {sub&&<div style={{fontSize:"13px",marginTop:"6px"}}>{sub}</div>}
  </div>
);}

/* ── Formularios ─────────────────────────────────────────── */
function PlayerForm({initial,onSave,onCancel,saving}){
  const [f,setF]=useState({nombre:"",posicion:"Base",posicion2:"",nacionalidad:"",nacionalidad2:"",fecha_nac:"",fecha_fallecimiento:"",altura_cm:"",foto:null,...initial});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  return(<div>
    <PhotoPicker value={f.foto} onChange={v=>setF(p=>({...p,foto:v}))}/>
    <Fld label="Nombre *"><input style={inp} value={f.nombre} onChange={set("nombre")} placeholder="Ej: Claudia Soriano"/></Fld>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
      <Fld label="Posición"><select style={inp} value={f.posicion||""} onChange={set("posicion")}><option value="">— Sin definir —</option>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></Fld>
      <Fld label="Altura (cm)"><input style={inp} type="number" value={f.altura_cm} onChange={set("altura_cm")} placeholder="180"/></Fld>
    </div>
    <Fld label="2ª Posición (opcional)"><select style={inp} value={f.posicion2} onChange={set("posicion2")}><option value="">— Ninguna —</option>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></Fld>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
      <Fld label="Nacionalidad"><input style={inp} value={f.nacionalidad} onChange={set("nacionalidad")} placeholder="España"/></Fld>
      <Fld label="2ª Nacionalidad"><input style={inp} value={f.nacionalidad2||""} onChange={set("nacionalidad2")} placeholder="Opcional"/></Fld>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
      <Fld label="Fecha nac."><input style={inp} type="date" value={f.fecha_nac||""} onChange={set("fecha_nac")}/></Fld>
      <Fld label="Fecha fallecimiento (opcional)"><input style={inp} type="date" value={f.fecha_fallecimiento||""} onChange={set("fecha_fallecimiento")}/></Fld>
    </div>
    <div style={{display:"flex",gap:"10px",marginTop:"8px"}}>
      <button onClick={onCancel} style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"11px",color:"#64748b",background:"#fff",cursor:"pointer",fontWeight:600}}>Cancelar</button>
      <button onClick={()=>f.nombre.trim()&&onSave(f)} disabled={saving||!f.nombre.trim()} style={{flex:1,background:f.nombre.trim()?"#9333ea":"#fed7aa",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",cursor:f.nombre.trim()?"pointer":"not-allowed",fontWeight:700}}>{saving?"Guardando...":"Guardar"}</button>
    </div>
  </div>);}

function SeasonForm({initial,equipos,ligas,onSave,onCancel,saving}){
  const [f,setF]=useState({temporada:"",id_equipo:"",id_liga:"",orden:0,...initial});
  const ok=f.temporada.trim()&&f.id_equipo&&f.id_liga;

  // Ligas filtradas según el equipo seleccionado
  const ligasFiltradas=useMemo(()=>{
    if(!f.id_equipo) return ligas;
    const eq=equipos.find(e=>e.id_equipo===f.id_equipo);
    if(!eq) return ligas;
    const esSeleccion=eq.tipo==="seleccion";
    if(esSeleccion){
      const norm2=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
      const paisSel=norm2(eq.pais);
      const PAISES_EUROPA2=["espana","france","italia","germany","alemania","portugal","holanda","belgica","suiza","suecia","noruega","dinamarca","finlandia","polonia","turquia","grecia","rusia","ucrania","rumania","hungria","chequia","eslovaquia","eslovenia","croacia","serbia","letonia","lituania","estonia","bielorrusia","georgia","azerbaiyan","moldavia","austria","irlanda","islandia","luxemburgo","chipre","malta","andorra","monaco","bulgaria","albania","kosovo","montenegro","bosnia","macedonia"];
      const PAISES_AMERICAS2=["estados unidos","usa","canada","mexico","brasil","argentina","colombia","venezuela","peru","chile","ecuador","uruguay","bolivia","paraguay","cuba","republica dominicana","puerto rico","jamaica","panama","costa rica","guatemala","honduras","el salvador","nicaragua","guyana","surinam"];
      const PAISES_AFRICA2=["nigeria","senegal","mali","camerun","angola","mozambique","uganda","kenia","etiopia","ghana","costa de marfil","marruecos","argelia","tunez","sudafrica","tanzania","ruanda","congo","zambia","zimbabwe","guinea","cabo verde","sierra leona","burkina faso","togo","benin","madagascar","burundi"];
      const PAISES_ASIA2=["china","japon","corea del sur","israel","iran","kazajistan","uzbekistan","australia","nueva zelanda","india","filipinas","tailandia"];
      const continentOf2=p=>{
        if(PAISES_EUROPA2.some(x=>p.includes(x)))return"europa";
        if(PAISES_AMERICAS2.some(x=>p.includes(x)))return"americas";
        if(PAISES_AFRICA2.some(x=>p.includes(x)))return"africa";
        if(PAISES_ASIA2.some(x=>p.includes(x)))return"asia";
        return"otro";
      };
      const continenteSel=continentOf2(paisSel);
      return ligas.filter(l=>{
        const paisLiga=norm2(l.pais);
        // Competiciones mundiales → siempre disponibles para todas las selecciones
        if(paisLiga==="mundo"||paisLiga==="world"||paisLiga==="international"||paisLiga==="internacional") return true;
        // Copa continental del mismo continente
        if(l.tipo==="copacont"||l.tipo==="internacional"){
          const continenteLiga=continentOf2(paisLiga);
          if(continenteLiga===continenteSel) return true;
          // Pais del continente → solo selecciones de ese continente
          if(paisLiga==="europa"&&continenteSel==="europa") return true;
          if((paisLiga.includes("americ")||paisLiga.includes("caribe"))&&continenteSel==="americas") return true;
          if((paisLiga.includes("afric")||paisLiga.includes("africano"))&&continenteSel==="africa") return true;
          if((paisLiga.includes("asia")||paisLiga.includes("pacifico")||paisLiga==="oceania")&&continenteSel==="asia") return true;
          // Si la liga es de un país americano (ej. pais="USA"), selecciones americanas pueden jugar
          if(continenteSel==="americas"&&PAISES_AMERICAS2.some(x=>paisLiga.includes(x))) return true;
        }
        return false;
      });
    }
    // Clubs → ligas del mismo país + copas continentales del mismo continente
    const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
    const paisEquipo=norm(eq.pais);
    const esCanada=paisEquipo.includes("canad");
    const esUSA=paisEquipo.includes("estados unidos")||paisEquipo==="usa";

    const PAISES_EUROPA=["espana","france","italia","germany","alemania","portugal","holanda","belgica","suiza","suecia","noruega","dinamarca","finlandia","polonia","turquia","grecia","rusia","ucrania","rumania","hungria","chequia","eslovaquia","eslovenia","croacia","serbia","letonia","lituania","estonia","bielorrusia","georgia","azerbaiyan","moldavia","austria","irlanda","islandia","luxemburgo","chipre","malta","andorra","monaco","liechtenstein","san marino","bulgaria","albania","kosovo","montenegro","bosnia","macedonia","islandia"];
    const PAISES_AMERICAS=["estados unidos","usa","canada","mexico","brasil","argentina","colombia","venezuela","peru","chile","ecuador","uruguay","bolivia","paraguay","cuba","republica dominicana","puerto rico","jamaica","panama","costa rica","guatemala","honduras","el salvador","nicaragua","guyana","surinam","trinidad","bahamas","barbados"];
    const PAISES_AFRICA=["nigeria","senegal","mali","camerun","angola","mozambique","uganda","kenia","etiopia","ghana","costa de marfil","marruecos","argelia","tunez","sudafrica","tanzania","ruanda","congo","zambia","zimbabwe","guinea","cabo verde","sierra leona","burkina faso","togo","benin","madagascar","burundi"];
    const PAISES_ASIA=["china","japon","corea del sur","israel","iran","kazajistan","uzbekistan","australia","nueva zelanda","india","filipinas","tailandia"];

    const continentOf=p=>{
      if(PAISES_EUROPA.some(x=>p.includes(x)))return"europa";
      if(PAISES_AMERICAS.some(x=>p.includes(x)))return"americas";
      if(PAISES_AFRICA.some(x=>p.includes(x)))return"africa";
      if(PAISES_ASIA.some(x=>p.includes(x)))return"asia";
      return"otro";
    };
    const continenteEquipo=continentOf(paisEquipo);

    const PAIS_LIGA_CONTINENTE={
      "europa":"europa","europe":"europa",
      "americas":"americas","america":"americas",
      "africa":"africa","africa":"africa",
      "asia":"asia","mundo":"mundo","world":"mundo","international":"mundo",
    };

    return ligas.filter(l=>{
      const paisLiga=norm(l.pais);
      const paisLiga2=norm(l.pais2);
      const paisLiga3=norm(l.pais3);
      // Misma liga del país (considerando pais, pais2, pais3)
      if(paisLiga===paisEquipo||paisLiga2===paisEquipo||paisLiga3===paisEquipo) return true;
      // Canadá ↔ USA
      if(esCanada&&(paisLiga.includes("estados unidos")||paisLiga==="usa")) return true;
      if(esUSA&&paisLiga.includes("canad")) return true;
      // Copa continental del mismo continente
      if(l.tipo==="copacont"){
        const continenteLiga=continentOf(paisLiga)||PAIS_LIGA_CONTINENTE[paisLiga]||"otro";
        if(continenteLiga===continenteEquipo) return true;
        // Ligas con pais de continente → para equipos de ese continente
        if((paisLiga==="europa"||paisLiga.includes("europ"))&&continenteEquipo==="europa") return true;
        if((paisLiga.includes("americ")||paisLiga.includes("caribe"))&&continenteEquipo==="americas") return true;
        if(paisLiga.includes("afric")&&continenteEquipo==="africa") return true;
        if((paisLiga.includes("asia")||paisLiga.includes("oceani"))&&continenteEquipo==="asia") return true;
      }
      return false;
    });
  },[f.id_equipo,equipos,ligas]);

  // Reset liga si ya no está disponible con el nuevo equipo
  const handleEquipo=id=>{
    const disponible=id?equipos.find(e=>e.id_equipo===id):null;
    const ligaValida=f.id_liga&&ligasFiltradas.some(l=>l.id_liga===f.id_liga);
    setF(p=>({...p,id_equipo:id,id_liga:ligaValida?p.id_liga:""}));
  };

  return(<div>
    <Fld label="Temporada *"><input style={inp} value={f.temporada} onChange={e=>setF(p=>({...p,temporada:e.target.value}))} placeholder="2024-25"/></Fld>
    <Fld label="Equipo *">
      <select style={inp} value={f.id_equipo} onChange={e=>handleEquipo(e.target.value)}>
        <option value="">— Selecciona equipo —</option>
        {[...equipos].sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(e=><option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>)}
      </select>
    </Fld>
    <Fld label="Competición *">
      <select style={inp} value={f.id_liga} onChange={e=>setF(p=>({...p,id_liga:e.target.value}))} disabled={!f.id_equipo}>
        <option value="">{f.id_equipo?"— Selecciona competición —":"— Selecciona equipo primero —"}</option>
        {ligasFiltradas.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
      </select>
    </Fld>
    <Fld label="Orden"><input style={inp} type="number" value={f.orden??0} onChange={e=>setF(p=>({...p,orden:parseInt(e.target.value)||0}))} placeholder="0" min="0"/></Fld>
    <div style={{display:"flex",gap:"10px",marginTop:"8px"}}>
      <button onClick={onCancel} style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"11px",color:"#64748b",background:"#fff",cursor:"pointer",fontWeight:600}}>Cancelar</button>
      <button onClick={()=>ok&&onSave(f)} disabled={saving||!ok} style={{flex:1,background:ok?"#9333ea":"#fed7aa",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",cursor:ok?"pointer":"not-allowed",fontWeight:700}}>{saving?"Guardando...":"Guardar"}</button>
    </div>
  </div>);}

const STATUS_BADGE = {
  cantera: null,
  europea: <span title="Jugadora europea" style={{background:"#eff6ff",color:"#1d4ed8",border:"1.5px solid #bfdbfe",fontSize:"10px",fontWeight:800,padding:"2px 7px",borderRadius:"20px",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center"}}><img src="https://flagcdn.com/20x15/eu.png" width={16} height={12} alt="EU" style={{display:"inline-block",verticalAlign:"middle",borderRadius:"2px",marginRight:"3px"}}/>Europea</span>,
  acp:     <span title="Acuerdo de Cotonú" style={{background:"#fefce8",color:"#a16207",border:"1.5px solid #fde68a",fontSize:"10px",fontWeight:800,padding:"2px 7px",borderRadius:"20px",whiteSpace:"nowrap"}}>🤝 ACP</span>,
  extra:   <span title="Extracomunitaria" style={{background:"#f8fafc",color:"#64748b",border:"1.5px solid #cbd5e1",fontSize:"10px",fontWeight:800,padding:"2px 7px",borderRadius:"20px",whiteSpace:"nowrap"}}>🌍 Extra</span>,
};
const STATUS_BADGE_LG = {
  cantera: null,
  europea: <span title="Jugadora europea" style={{background:"#eff6ff",color:"#1d4ed8",border:"1.5px solid #bfdbfe",fontSize:"12px",fontWeight:800,padding:"3px 10px",borderRadius:"20px",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center"}}><img src="https://flagcdn.com/20x15/eu.png" width={16} height={12} alt="EU" style={{display:"inline-block",verticalAlign:"middle",borderRadius:"2px",marginRight:"3px"}}/>Europea</span>,
  acp:     <span title="Acuerdo de Cotonú" style={{background:"#fefce8",color:"#a16207",border:"1.5px solid #fde68a",fontSize:"12px",fontWeight:800,padding:"3px 10px",borderRadius:"20px",whiteSpace:"nowrap"}}>🤝 Cotonú</span>,
  extra:   <span title="Extracomunitaria" style={{background:"#f8fafc",color:"#64748b",border:"1.5px solid #cbd5e1",fontSize:"12px",fontWeight:800,padding:"3px 10px",borderRadius:"20px",whiteSpace:"nowrap"}}>🌍 Extra</span>,
};
const ACP_BADGE = STATUS_BADGE.acp;

/* ── StatusDropdown ─────────────────────────────────────── */
const STATUS_OPTIONS = [
  {value:"cantera", label:"Nacional (España)", icon:<FlagImg country="España"/>},
  {value:"europea", label:"Europea",  icon:<img src="https://flagcdn.com/20x15/eu.png" width={16} height={12} alt="EU" style={{display:"inline-block",verticalAlign:"middle",borderRadius:"2px",marginRight:"4px"}}/>},
  {value:"acp",     label:"ACP / Cotonú", icon:<span style={{marginRight:"4px"}}>🤝</span>},
  {value:"extra",   label:"Extracomunitaria", icon:<span style={{marginRight:"4px"}}>🌍</span>},
];
function StatusDropdown({filterStatus,setFilterStatus}){
  const [open,setOpen]=useState(false);
  const ref=useRef();
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  const selected=STATUS_OPTIONS.find(o=>o.value===filterStatus);
  const label=selected?<span style={{display:"flex",alignItems:"center"}}>{selected.icon}{selected.label}</span>:"Todas las categorías";
  return(
    <div className="bfdb-status-dropdown" ref={ref} style={{position:"relative",flexShrink:0}}>
      <div onClick={()=>setOpen(o=>!o)} style={{border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:filterStatus?"#9333ea":"#475569",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",whiteSpace:"nowrap",fontWeight:filterStatus?700:400,minWidth:"190px"}}>
        {label}<span style={{marginLeft:"auto",fontSize:"10px"}}>▼</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:100,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:"12px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",minWidth:"210px",padding:"8px 0"}}>
          <div onClick={()=>{setFilterStatus("");setOpen(false);}} style={{padding:"8px 14px",fontSize:"12px",color:"#94a3b8",cursor:"pointer",fontWeight:600,borderBottom:"1px solid #f1f5f9"}}>
            Todas las categorías
          </div>
          {STATUS_OPTIONS.map(o=>{
            const active=filterStatus===o.value;
            return(
              <div key={o.value} onClick={()=>{setFilterStatus(o.value);setOpen(false);}}
                style={{display:"flex",alignItems:"center",gap:"8px",padding:"9px 14px",cursor:"pointer",background:active?"#fff7ed":"transparent",fontWeight:active?700:400}}
                onMouseEnter={e=>e.currentTarget.style.background=active?"#fff7ed":"#f8fafc"}
                onMouseLeave={e=>e.currentTarget.style.background=active?"#fff7ed":"transparent"}>
                {o.icon}
                <span style={{fontSize:"13px",color:"#1e293b"}}>{o.label}</span>
                {active&&<span style={{marginLeft:"auto",color:"#9333ea"}}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── CalidadModal ───────────────────────────────────────── */
function checkIdGaps(items,key,prefix,pad){
  const ids=items.map(function(x){return prefix?parseInt(String(x[key]||"").replace(prefix,"")):parseInt(x[key]);}).filter(function(n){return !isNaN(n)&&n>0;}).sort(function(a,b){return a-b;});
  var gaps=[];
  if(ids.length)for(var g=1;g<ids[ids.length-1];g++){if(ids.indexOf(g)<0)gaps.push(prefix+(pad?String(g).padStart(pad,"0"):g));}
  var ff=ids.length?(function(){var s=new Set(ids);var i=1;while(s.has(i))i++;return i;})():1;
  var maxN=ids[ids.length-1]||0;var nextAfterMax=prefix+(pad?String(maxN+1).padStart(pad,"0"):maxN+1);return{gaps:gaps.slice(0,15),total:gaps.length,nextFree:prefix+(pad?String(ff).padStart(pad,"0"):ff),max:maxN,nextAfterMax};
}
function FibaRow({entry,onApply,onPlaceholder,showActions}){
  const {p,cand,score,cands}=entry;
  const [pick,setPick]=useState(cand);
  const fotoUrl=pick?`https://assets.fiba.basketball/image/upload/w_120,c_fill,g_face/q_auto/f_auto/.headshot--person_${pick.id}`:null;
  const badge=(ok,label)=>(
    <span style={{display:"inline-block",padding:"1px 6px",borderRadius:"6px",fontSize:"10px",fontWeight:700,background:ok?"#dcfce7":"#fee2e2",color:ok?"#166534":"#991b1b",marginRight:"4px"}}>{ok?"✓":"✗"} {label}</span>
  );
  return(
    <div style={{display:"flex",gap:"10px",padding:"8px",background:"#f8fafc",borderRadius:"10px",border:"1px solid #e2e8f0",alignItems:"center"}}>
      <img src={p.foto} alt="" width={40} height={40} style={{borderRadius:"6px",objectFit:"cover",background:"#e2e8f0"}}
        onError={function(e){e.currentTarget.style.opacity=0.3;}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:"13px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.nombre}</div>
        <div style={{fontSize:"11px",color:"#94a3b8"}}>{p.nacionalidad} · {p.fecha_nac}</div>
        <div style={{marginTop:"3px"}}>
          {badge(score.nameOk,"nombre")}
          {score.countryPresent&&badge(score.countryOk,"país")}
          {score.dobPresent&&badge(score.dobOk,"nac.")}
        </div>
      </div>
      <div style={{fontSize:"11px",textAlign:"right"}}>
        {pick?(
          <>
            <div style={{fontWeight:700}}>{(pick.display_firstname||pick.firstname)+" "+(pick.display_lastname||pick.lastname)}</div>
            <div style={{color:"#94a3b8"}}>{pick.country} · {(pick.birthdate||"").slice(0,10)}</div>
            <div style={{color:"#94a3b8",fontSize:"10px"}}>id {pick.id}</div>
          </>
        ):<div style={{color:"#94a3b8"}}>sin candidato</div>}
      </div>
      {fotoUrl&&<img src={fotoUrl} alt="" width={40} height={40} style={{borderRadius:"6px",objectFit:"cover"}} onError={function(e){e.currentTarget.style.opacity=0.3;}}/>}
      {showActions&&(
        <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
          <button onClick={onApply} style={{background:"#16a34a",color:"#fff",border:"none",borderRadius:"6px",padding:"5px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer"}}>Aplicar</button>
          {onPlaceholder&&(
            <button onClick={onPlaceholder} title="Ninguna de las FIBA es esta jugadora — poner placeholder"
              style={{background:"#64748b",color:"#fff",border:"none",borderRadius:"6px",padding:"5px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer"}}>
              👤 Placeholder
            </button>
          )}
          {cands.length>1&&(
            <select value={pick?.id||""} onChange={function(e){const c=cands.find(x=>String(x.id)===e.target.value);if(c)setPick(c);}}
              style={{fontSize:"10px",padding:"3px",borderRadius:"5px",border:"1px solid #e2e8f0",maxWidth:"110px"}}>
              {cands.map(function(c){return <option key={c.id} value={c.id}>{(c.display_lastname||c.lastname)} ({c.country})</option>;})}
            </select>
          )}
        </div>
      )}
    </div>
  );
}


/* ── GlobalSearch ───────────────────────────────────────── */
function GlobalSearch({players,equipos,ligas,coaches,onGoToPlayer,onGoToTeam,onGoToLeague,onGoToCoach,fullscreen,onClose}){
  const [q,setQ]=useState("");
  const [open,setOpen]=useState(false);
  const ref=useRef();
  const inputRef=useRef();
  useEffect(()=>{
    const h=e=>{if(!fullscreen&&ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[fullscreen]);
  useEffect(()=>{if(fullscreen&&inputRef.current)inputRef.current.focus();},[fullscreen]);

  const results=useMemo(()=>{
    if(!q.trim()||q.length<2)return null;
    const lq=q.toLowerCase();
    const match=s=>s?.toLowerCase().includes(lq);
    const r={jugadoras:[],equipos:[],ligas:[],coaches:[]};
    (players||[]).forEach(p=>{if(match(p.nombre)||match(p.nacionalidad)||match(p.nacionalidad2))r.jugadoras.push(p);});
    (equipos||[]).forEach(e=>{if(match(e.nombre)||match(e.ciudad)||match(e.pais))r.equipos.push(e);});
    (ligas||[]).forEach(l=>{if(match(l.nombre)||match(l.pais))r.ligas.push(l);});
    (coaches||[]).forEach(c=>{if(match(c.nombre)||match(c.nacionalidad))r.coaches.push(c);});
    return r;
  },[q,players,equipos,ligas,coaches]);

  const total=results?Object.values(results).reduce((a,v)=>a+v.length,0):0;
  const inp={width:"100%",background:"rgba(255,255,255,0.08)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:"10px",padding:"7px 12px",fontSize:"13px",color:"#fff",outline:"none",boxSizing:"border-box"};

  const go=(fn)=>{fn();setQ("");setOpen(false);if(fullscreen&&onClose)onClose();};

  if(fullscreen){
    return(
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#0f172a",zIndex:500,display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"14px 16px",borderBottom:"1px solid #1e293b"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",flex:1,background:"rgba(255,255,255,0.08)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:"10px",padding:"9px 12px"}}>
            <span style={{fontSize:"14px",color:"#94a3b8"}}>🔍</span>
            <input ref={inputRef} value={q} onChange={e=>{setQ(e.target.value);setOpen(true);}}
              placeholder="Buscar jugadoras, equipos, ligas..." style={{background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:"15px",width:"100%"}}
              onKeyDown={e=>{if(e.key==="Escape"){onClose&&onClose();}}}/>
            {q&&<button onClick={()=>setQ("")} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:"16px",lineHeight:1,padding:0}}>×</button>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#fff",fontSize:"14px",fontWeight:700,cursor:"pointer",padding:"4px 8px"}}>Cancelar</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
          {results&&total>0?(<>
            {results.jugadoras.length>0&&(<>
              <div style={{padding:"10px 16px 6px",fontSize:"11px",color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>👩‍🏀 Jugadoras ({results.jugadoras.length})</div>
              {results.jugadoras.slice(0,8).map(p=>(
                <div key={p.id_jugadora} onClick={()=>go(()=>onGoToPlayer(p.id_jugadora))} style={{padding:"12px 16px",cursor:"pointer",color:"#fff",fontSize:"15px",borderBottom:"1px solid #1e293b"}}>{p.nombre}</div>
              ))}
            </>)}
            {results.equipos.length>0&&(<>
              <div style={{padding:"10px 16px 6px",fontSize:"11px",color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>🏟️ Equipos ({results.equipos.length})</div>
              {results.equipos.slice(0,8).map(e=>(
                <div key={e.id_equipo} onClick={()=>go(()=>onGoToTeam(e.id_equipo))} style={{padding:"12px 16px",cursor:"pointer",color:"#fff",fontSize:"15px",borderBottom:"1px solid #1e293b"}}>{e.nombre}</div>
              ))}
            </>)}
            {results.ligas.length>0&&(<>
              <div style={{padding:"10px 16px 6px",fontSize:"11px",color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>🏆 Ligas ({results.ligas.length})</div>
              {results.ligas.slice(0,8).map(l=>(
                <div key={l.id_liga} onClick={()=>go(()=>onGoToLeague(l.id_liga))} style={{padding:"12px 16px",cursor:"pointer",color:"#fff",fontSize:"15px",borderBottom:"1px solid #1e293b"}}>{l.nombre}</div>
              ))}
            </>)}
            {results.coaches.length>0&&(<>
              <div style={{padding:"10px 16px 6px",fontSize:"11px",color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>📋 Cuerpo técnico ({results.coaches.length})</div>
              {results.coaches.slice(0,8).map(c=>(
                <div key={c.id_coach} onClick={()=>go(()=>onGoToCoach(c.id_coach))} style={{padding:"12px 16px",cursor:"pointer",color:"#fff",fontSize:"15px",borderBottom:"1px solid #1e293b"}}>{c.nombre}</div>
              ))}
            </>)}
          </>):q.length>=2?(
            <div style={{textAlign:"center",padding:"40px 20px",color:"#64748b",fontSize:"14px"}}>Sin resultados</div>
          ):(
            <div style={{textAlign:"center",padding:"40px 20px",color:"#64748b",fontSize:"14px"}}>Escribe al menos 2 caracteres</div>
          )}
        </div>
      </div>
    );
  }

  return(
    <div ref={ref} style={{position:"relative",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:"6px",background:"rgba(255,255,255,0.08)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:"10px",padding:"5px 10px"}}>
        <span style={{fontSize:"13px",color:"#94a3b8"}}>🔍</span>
        <input value={q} onChange={e=>{setQ(e.target.value);setOpen(true);}} onFocus={()=>q.length>=2&&setOpen(true)}
          placeholder="Buscar..." style={{background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:"13px",width:"160px"}}
          onKeyDown={e=>{if(e.key==="Escape"){setQ("");setOpen(false);}}}/>
        {q&&<button onClick={()=>{setQ("");setOpen(false);}} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:"14px",lineHeight:1,padding:0}}>×</button>}
      </div>
      {open&&results&&total>0&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:200,background:"#1e293b",border:"1px solid #334155",borderRadius:"14px",boxShadow:"0 12px 40px rgba(0,0,0,0.5)",width:"340px",maxHeight:"480px",overflowY:"auto"}}>
          {results.jugadoras.length>0&&(<>
            <div style={{padding:"10px 14px 6px",fontSize:"10px",color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>👩‍🏀 Jugadoras ({results.jugadoras.length})</div>
            {results.jugadoras.slice(0,6).map(p=>(
              <div key={p.id_jugadora} onClick={()=>go(()=>onGoToPlayer(p.id_jugadora))}
                style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 14px",cursor:"pointer",transition:"background 0.1s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <Avatar photo={p.foto} name={p.nombre} size={32} fontSize={12} fallecida={!!p.fecha_fallecimiento}/>
                <div><div style={{fontSize:"13px",color:"#f1f5f9",fontWeight:600}}>{p.nombre}</div>
                <div style={{fontSize:"11px",color:"#64748b"}}>{p.posicion}{p.posicion2?` · ${p.posicion2}`:""}</div></div>
              </div>
            ))}
          </>)}
          {results.equipos.length>0&&(<>
            <div style={{padding:"10px 14px 6px",fontSize:"10px",color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",borderTop:"1px solid #1e293b"}}>🏟️ Equipos ({results.equipos.length})</div>
            {results.equipos.slice(0,4).map(e=>(
              <div key={e.id_equipo} onClick={()=>go(()=>onGoToTeam(e.id_equipo))}
                style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 14px",cursor:"pointer"}}
                onMouseEnter={ev=>ev.currentTarget.style.background="rgba(255,255,255,0.06)"}
                onMouseLeave={ev=>ev.currentTarget.style.background="transparent"}>
                <TeamBadge team={e} size={28}/>
                <div><div style={{fontSize:"13px",color:"#f1f5f9",fontWeight:600}}>{e.nombre}</div>
                <div style={{fontSize:"11px",color:"#64748b"}}>{e.ciudad||""}{e.pais?` · ${e.pais}`:""}</div></div>
              </div>
            ))}
          </>)}
          {results.ligas.length>0&&(<>
            <div style={{padding:"10px 14px 6px",fontSize:"10px",color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",borderTop:"1px solid #1e293b"}}>🏆 Ligas ({results.ligas.length})</div>
            {results.ligas.slice(0,4).map(l=>(
              <div key={l.id_liga} onClick={()=>go(()=>onGoToLeague(l.id_liga))}
                style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 14px",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <LeagueBadge liga={l} size={28}/>
                <div><div style={{fontSize:"13px",color:"#f1f5f9",fontWeight:600}}>{l.nombre}</div>
                <div style={{fontSize:"11px",color:"#64748b"}}>{l.pais||""}</div></div>
              </div>
            ))}
          </>)}
          {results.coaches.length>0&&(<>
            <div style={{padding:"10px 14px 6px",fontSize:"10px",color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",borderTop:"1px solid #1e293b"}}>📋 Cuerpo Técnico ({results.coaches.length})</div>
            {results.coaches.slice(0,4).map(c=>(
              <div key={c.id_coach} onClick={()=>go(()=>onGoToCoach(c.id_coach))}
                style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 14px",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <Avatar photo={c.foto} name={c.nombre} size={32} fontSize={12}/>
                <div><div style={{fontSize:"13px",color:"#f1f5f9",fontWeight:600}}>{c.nombre}</div>
                <div style={{fontSize:"11px",color:"#64748b"}}>{c.nacionalidad||""}</div></div>
              </div>
            ))}
          </>)}
          {total===0&&q.length>=2&&<div style={{padding:"16px 14px",fontSize:"13px",color:"#64748b",textAlign:"center"}}>Sin resultados para "{q}"</div>}
        </div>
      )}
      {open&&results&&total===0&&q.length>=2&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:200,background:"#1e293b",border:"1px solid #334155",borderRadius:"14px",padding:"16px 14px",width:"280px",fontSize:"13px",color:"#64748b",textAlign:"center"}}>
          Sin resultados para "{q}"
        </div>
      )}
    </div>
  );
}

/* ── NacDropdown ────────────────────────────────────────── */
/* ── HomeView ───────────────────────────────────────────── */
function HomeView({players,equipos,ligas,palmares,coaches,tempCoach,onGoToPlayer,onGoToTeam,onGoToTab,equiposNombres,user,favoritos,partidos,isFavFn,onToggleFav,onGoToLeague,onGoToPartido}){
  const [visibleCount,setVisibleCount]=useState(10);
  const [filterLiga,setFilterLiga]=useState("ALL");
  const [filterEquipo,setFilterEquipo]=useState("ALL");
  const equipoMap=useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap=useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);
  const currentSeason=useMemo(()=>getCurrentSeason(players),[players]);
  const fichajes=useMemo(()=>{
    // Excluimos selecciones nacionales (tipo:"seleccion") del cálculo:
    // una convocatoria de selección no es un fichaje, y su formato de temporada ("2026")
    // gana la ordenación alfabética frente a temporadas de club ("2025-26"), generando
    // falsos positivos (ej. Aina Ayuso aparecería como fichaje sin haber cambiado de club).
    const esSeleccion=id=>equipoMap[id]?.tipo==="seleccion";
    // Filas de la temporada actual ordenadas por id ASCENDENTE: la fila más antigua de
    // cada jugadora+equipo es la que registró el fichaje. Duplicar una plantilla a otra
    // competición (copa doméstica/continental) crea filas nuevas con id más alto que se
    // descartan aquí, para que un cambio de competición no reaparezca como movimiento.
    const currentAll=players.flatMap(p=>(p.seasons||[]).map(s=>({...s,player:p}))).filter(s=>s.temporada===currentSeason&&!esSeleccion(s.id_equipo)).sort((a,b)=>a.id-b.id);
    const seen=new Set();const deduped=[];
    currentAll.forEach(s=>{const k=s.id_jugadora+"|"+s.id_equipo;if(!seen.has(k)){seen.add(k);deduped.push(s);}});
    return deduped.filter(s=>{
      const prev=(s.player.seasons||[]).filter(ps=>ps.temporada!==currentSeason&&!esSeleccion(ps.id_equipo));
      if(!prev.length)return false;
      const prevSorted=[...prev].sort((a,b)=>b.temporada.localeCompare(a.temporada));
      // La temporada previa más reciente puede ser una competición de año único
      // ("2026", p.ej. WNBA) que se solapa con temporadas de club ("2025-26"), y una
      // jugadora puede tener varias filas en la misma temporada (liga + copas
      // duplicadas). Por eso no basta con mirar prevSorted[0]: se considera "equipo
      // anterior" a cualquier equipo de la temporada previa más reciente o de las que
      // se solapan con ella. Así, seguir en el mismo club no cuenta como fichaje.
      const lastTemp=prevSorted[0].temporada;
      const y=parseInt(lastTemp.slice(0,4));
      const solapa=t=>{
        if(t===lastTemp)return true;
        const ty=parseInt((t||"").slice(0,4));
        const single=(t||"").trim().length===4,lastSingle=lastTemp.trim().length===4;
        if(lastSingle&&!single)return ty===y-1||ty===y; // "2026" ~ "2025-26" y "2026-27"
        if(!lastSingle&&single)return ty===y||ty===y+1; // "2025-26" ~ "2025" y "2026"
        return false;
      };
      return !prev.some(ps=>solapa(ps.temporada)&&ps.id_equipo===s.id_equipo);
    }).sort((a,b)=>b.id-a.id);
  },[players,equipoMap,currentSeason]);
  const ligasEnFichajes=useMemo(()=>{
    const ids=[...new Set(fichajes.map(s=>s.id_liga).filter(Boolean))];
    return ids.map(id=>ligaMap[id]).filter(Boolean).sort((a,b)=>a.nombre.localeCompare(b.nombre));
  },[fichajes,ligaMap]);
  const fichajesPorLiga=useMemo(()=>filterLiga==="ALL"?fichajes:fichajes.filter(s=>s.id_liga===filterLiga),[fichajes,filterLiga]);
  const equiposEnFichajes=useMemo(()=>{
    const ids=[...new Set(fichajesPorLiga.map(s=>s.id_equipo).filter(Boolean))];
    return ids.map(id=>equipoMap[id]).filter(Boolean).sort((a,b)=>a.nombre.localeCompare(b.nombre));
  },[fichajesPorLiga,equipoMap]);
  const fichajesFiltrados=useMemo(()=>filterEquipo==="ALL"?fichajesPorLiga:fichajesPorLiga.filter(s=>s.id_equipo===filterEquipo),[fichajesPorLiga,filterEquipo]);
  const visible=fichajesFiltrados.slice(0,visibleCount);
  return(
    <div className="bfdb-container" style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      <div style={{marginBottom:"16px"}}>
        <h2 style={{fontWeight:800,fontSize:"20px",color:"#1e293b",margin:"0 0 4px",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
          ✍️ Últimos fichajes
          {filterLiga!=="ALL"&&(()=>{const ligaSel=ligaMap[filterLiga];return ligaSel?<span style={{fontWeight:800,fontSize:"20px",color:"#1e293b",display:"flex",alignItems:"center",gap:"6px"}}>de {ligaSel.nombre}{ligaSel.escudo&&<img src={ligaSel.escudo} alt={ligaSel.nombre} style={{width:"22px",height:"22px",objectFit:"contain",borderRadius:"4px"}}/>}</span>:null;})()}
        </h2>
        <p style={{fontSize:"13px",color:"#94a3b8",margin:"0 0 12px"}}>Temporada {currentSeason} · {fichajesFiltrados.length} movimiento{fichajesFiltrados.length!==1?"s":""}</p>
        {ligasEnFichajes.length>1&&<select value={filterLiga} onChange={e=>{setFilterLiga(e.target.value);setFilterEquipo("ALL");setVisibleCount(10);}} style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"7px 12px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none",width:"100%",maxWidth:"320px"}}>
          <option value="ALL">Todas las ligas</option>
          {ligasEnFichajes.map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
        </select>}
        {equiposEnFichajes.length>1&&<select value={filterEquipo} onChange={e=>{setFilterEquipo(e.target.value);setVisibleCount(10);}} style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"7px 12px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none",width:"100%",maxWidth:"320px",marginTop:"8px"}}>
          <option value="ALL">Todos los equipos</option>
          {equiposEnFichajes.map(e=><option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>)}
        </select>}
      </div>
      {fichajesFiltrados.length===0?(
        <div style={{textAlign:"center",padding:"60px 0",color:"#94a3b8"}}>
          <div style={{fontSize:"48px",marginBottom:"12px"}}>📋</div>
          <p style={{fontSize:"15px"}}>{fichajes.length===0?`No hay fichajes registrados para ${currentSeason} todavía`:"No hay fichajes para esta liga"}</p>
        </div>
      ):(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"12px",marginBottom:"20px"}}>
            {visible.map(s=>{
              const eq=equipoMap[s.id_equipo];
              const liga=ligaMap[s.id_liga];
              const prev=(s.player.seasons||[]).filter(ps=>ps.temporada!==currentSeason);
              const isDebut=!prev.length;
              return(
                <div key={s.id} onClick={()=>onGoToPlayer(s.id_jugadora)}
                  style={{background:"#fff",borderRadius:"16px",padding:"16px 12px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",cursor:"pointer",transition:"all 0.15s",textAlign:"center"}}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(249,115,22,0.15)";e.currentTarget.style.transform="translateY(-2px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 6px rgba(0,0,0,0.07)";e.currentTarget.style.transform="translateY(0)";}}>
                  <Avatar photo={s.player.foto} name={s.player.nombre} size={72} fontSize={24} fallecida={!!s.player.fecha_fallecimiento}/>
                  <div style={{fontWeight:700,fontSize:"13px",color:"#1e293b",lineHeight:1.3,width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.player.nombre}</div>
                  <div style={{fontSize:"20px",lineHeight:1}}>✍️</div>
                  <div style={{display:"flex",alignItems:"center",gap:"6px",background:"#fff7ed",borderRadius:"10px",padding:"6px 10px",width:"100%",justifyContent:"center",boxSizing:"border-box"}}>
                    <TeamBadge team={eq} size={24}/>
                    <span style={{fontSize:"11px",fontWeight:700,color:"#9333ea",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"80px"}}>{resolveTeamName(s.id_equipo,s.temporada,equiposNombres,equipoMap)||eq?.nombre}</span>
                  </div>
                  {liga&&<div style={{fontSize:"10px",color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"}}>{liga.nombre}</div>}
                </div>
              );
            })}
          </div>
          {visibleCount<fichajesFiltrados.length&&(
            <div style={{textAlign:"center"}}>
              <button onClick={()=>setVisibleCount(c=>c+10)}
                style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 28px",fontWeight:700,fontSize:"13px",color:"#475569",cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#9333ea";e.currentTarget.style.color="#9333ea";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.color="#475569";}}>
                Ver más ({fichajesFiltrados.length-visibleCount} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatsHeader({stats}){
  return(
    <div className="bfdb-stats-grid" style={{display:"grid",gridTemplateColumns:`repeat(${stats.length},1fr)`,gap:"8px",marginBottom:"16px"}}>
      {stats.map(({icon,value,label,onClick})=>(
        <div key={label} onClick={onClick}
          style={{background:"#fff",borderRadius:"14px",padding:"12px 8px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",textAlign:"center",cursor:onClick?"pointer":"default",transition:"all 0.15s"}}
          onMouseEnter={e=>{if(onClick)e.currentTarget.style.boxShadow="0 4px 12px rgba(249,115,22,0.2)";}}
          onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
          <div style={{fontSize:"18px",marginBottom:"4px"}}>{icon}</div>
          <div style={{fontSize:"20px",fontWeight:800,color:onClick?"#9333ea":"#1e293b"}}>{typeof value==="number"?value.toLocaleString("es"):value}</div>
          <div style={{fontSize:"11px",color:"#94a3b8",lineHeight:1.2}}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function PaisDropdown({allPaises,filterPais,setFilterPais,placeholder}){
  const [open,setOpen]=useState(false);
  const ref=useRef();
  placeholder=placeholder||"País";
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  return(
    <div ref={ref} style={{position:"relative",flexShrink:0}}>
      <div onClick={()=>setOpen(o=>!o)} style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",color:filterPais?"#9333ea":"#475569",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",whiteSpace:"nowrap",fontWeight:filterPais?700:400,height:"40px",boxSizing:"border-box",minWidth:"140px"}}>
        {filterPais?<><FlagImg country={filterPais}/><span>{filterPais}</span></>:<span>{placeholder}</span>}
        <span style={{marginLeft:"auto",fontSize:"10px"}}>▼</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:100,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:"12px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",minWidth:"180px",maxHeight:"280px",overflowY:"auto",padding:"8px 0"}}>
          <div onClick={()=>{setFilterPais("");setOpen(false);}} style={{padding:"8px 14px",fontSize:"12px",color:"#94a3b8",cursor:"pointer",fontWeight:600,borderBottom:"1px solid #f1f5f9"}}>
            Todos los países
          </div>
          {(allPaises||[]).map(p=>{
            const checked=filterPais===p;
            return(
              <div key={p} onClick={()=>{setFilterPais(checked?"":p);setOpen(false);}}
                style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 14px",cursor:"pointer",background:checked?"#fff7ed":"transparent"}}
                onMouseEnter={e=>e.currentTarget.style.background=checked?"#fff7ed":"#f8fafc"}
                onMouseLeave={e=>e.currentTarget.style.background=checked?"#fff7ed":"transparent"}>
                <FlagImg country={p}/>
                <span style={{fontSize:"13px",color:"#1e293b",fontWeight:checked?700:400}}>{p}</span>
                {checked&&<span style={{marginLeft:"auto",color:"#9333ea",fontSize:"12px"}}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NacDropdown({allNacs,filterNacs,setFilterNacs}){
  const [open,setOpen]=useState(false);
  const ref=useRef();
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  const label=filterNacs.size===0?"Todas las nacionalidades":`${filterNacs.size} seleccionada${filterNacs.size>1?"s":""}`;
  return(
    <div className="bfdb-nac-dropdown" ref={ref} style={{position:"relative",flexShrink:0}}>
      <div onClick={()=>setOpen(o=>!o)} style={{border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:filterNacs.size>0?"#9333ea":"#475569",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",whiteSpace:"nowrap",fontWeight:filterNacs.size>0?700:400,minWidth:"200px"}}>
        {label}<span style={{marginLeft:"auto",fontSize:"10px"}}>▼</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:100,background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:"12px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",minWidth:"220px",maxHeight:"260px",overflowY:"auto",padding:"8px 0"}}>
          <div onClick={()=>setFilterNacs(new Set())} style={{padding:"8px 14px",fontSize:"12px",color:"#94a3b8",cursor:"pointer",fontWeight:600,borderBottom:"1px solid #f1f5f9"}}>
            Limpiar selección
          </div>
          {allNacs.map(n=>{
            const checked=filterNacs.has(n);
            return(
              <label key={n} style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 14px",cursor:"pointer",background:checked?"#fff7ed":"transparent"}}
                onMouseEnter={e=>e.currentTarget.style.background=checked?"#fff7ed":"#f8fafc"}
                onMouseLeave={e=>e.currentTarget.style.background=checked?"#fff7ed":"transparent"}>
                <input type="checkbox" checked={checked} onChange={()=>setFilterNacs(prev=>{const s=new Set(prev);checked?s.delete(n):s.add(n);return s;})} style={{accentColor:"#9333ea",width:"14px",height:"14px",flexShrink:0}}/>
                <FlagImg country={n}/>
                <span style={{fontSize:"13px",color:"#1e293b",fontWeight:checked?600:400}}>{n}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── PlayersView ─────────────────────────────────────────── */
function StatsJugadora({idJugadora,equipos,ligas,equiposNombres,onOpenPartido}){
  const [rows,setRows]=useState(null);
  const [temp,setTemp]=useState(null);
  const [comp,setComp]=useState("ALL");
  useEffect(()=>{
    let cancel=false; setRows(null);
    (async()=>{
      const {data}=await supabase.from("partido_boxscore")
        .select("id_partido,id_equipo,minutos,puntos,tc_anotados,tc_intentados,t3_anotados,t3_intentados,tl_anotados,tl_intentados,reb_ofensivos,reb_defensivos,reb_totales,asistencias,robos,tapones,perdidas,faltas,valoracion,partidos!inner(temporada,id_liga,fecha_hora,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante)")
        .eq("id_jugadora",idJugadora);
      if(cancel)return;
      const r=(data||[]).map(x=>({...x,...(x.partidos||{})})).sort((a,b)=>(b.fecha_hora||"").localeCompare(a.fecha_hora||""));
      setRows(r);
      const ts=[...new Set(r.map(x=>x.temporada))].sort((a,b)=>String(b).localeCompare(String(a)));
      setTemp(prev=>prev&&ts.includes(prev)?prev:(ts[0]||null));
    })();
    return ()=>{cancel=true;};
  },[idJugadora]);

  if(rows===null)return <div style={{textAlign:"center",padding:"40px",color:"#94a3b8",fontSize:"14px"}}>Cargando estadísticas…</div>;
  if(rows.length===0)return <div style={{background:"#fff",borderRadius:"20px",padding:"40px",textAlign:"center",color:"#94a3b8",fontSize:"14px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>Aún no hay estadísticas de partido para esta jugadora.</div>;

  const N=v=>{if(typeof v==="string"&&v.indexOf(":")>=0){const p=v.split(":");return (parseInt(p[0],10)||0)+(parseInt(p[1],10)||0)/60;}return Number(v)||0;};
  const ligaMap={}; (ligas||[]).forEach(l=>ligaMap[l.id_liga]=l);
  const equipoMap={};(equipos||[]).forEach(e=>{equipoMap[e.id_equipo]=e;});
  const tData=(id,tmp)=>resolveTeamData(id,tmp,equiposNombres,equipoMap);
  const eqName=(id,tmp)=>tData(id,tmp).nombre||id;
  const temps=[...new Set(rows.map(x=>x.temporada))].sort((a,b)=>String(b).localeCompare(String(a)));
  const compsTemp=[...new Set(rows.filter(x=>x.temporada===temp).map(x=>x.id_liga))];
  const compActiva=compsTemp.includes(comp)?comp:"ALL";
  const filt=rows.filter(x=>x.temporada===temp&&(compActiva==="ALL"||x.id_liga===compActiva));
  const porEquipo={};
  filt.forEach(x=>{(porEquipo[x.id_equipo]=porEquipo[x.id_equipo]||[]).push(x);});
  const equiposOrden=Object.keys(porEquipo).sort((a,b)=>{
    const fa=Math.max(...porEquipo[a].map(x=>new Date(x.fecha_hora||0).getTime()));
    const fb=Math.max(...porEquipo[b].map(x=>new Date(x.fecha_hora||0).getTime()));
    return fb-fa;
  });
  const varios=equiposOrden.length>1;
  const th={padding:"7px 6px",fontSize:"10px",fontWeight:700,color:"#94a3b8",textAlign:"center",whiteSpace:"nowrap",borderBottom:"2px solid #f1f5f9"};
  const td={padding:"7px 6px",fontSize:"12px",color:"#334155",textAlign:"center",whiteSpace:"nowrap",borderBottom:"1px solid #f8fafc"};

  const bloque=(idEq,part)=>{
    const pj=part.length;
    const sum=k=>part.reduce((s,x)=>s+N(x[k]),0);
    const avg=k=>pj?(sum(k)/pj):0;
    const pctT=(a,i)=>{const I=sum(i);return I?Math.round(sum(a)/I*1000)/10:null;};
    const cards=[["PJ",pj],["MIN",avg("minutos").toFixed(1)],["PTS",avg("puntos").toFixed(1)],["REB",avg("reb_totales").toFixed(1)],["AST",avg("asistencias").toFixed(1)],["ROB",avg("robos").toFixed(1)],["VAL",avg("valoracion").toFixed(1)]];
    const pcts=[["TC",pctT("tc_anotados","tc_intentados")],["T3",pctT("t3_anotados","t3_intentados")],["TL",pctT("tl_anotados","tl_intentados")]];
    const e=tData(idEq,temp);
    return(
      <div key={idEq} style={{display:"flex",flexDirection:"column",gap:"12px",borderLeft:varios?"3px solid #ddd6fe":"none",paddingLeft:varios?"12px":"0"}}>
        {varios&&(<div style={{display:"flex",alignItems:"center",gap:"8px"}}>{e&&e.escudo&&<img src={e.escudo} alt="" style={{width:26,height:26,objectFit:"contain"}}/>}<span style={{fontWeight:800,fontSize:"15px",color:"#1e293b"}}>{e.nombre}</span></div>)}
        <div style={{background:"#fff",borderRadius:"18px",padding:"18px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          <div style={{fontSize:"12px",fontWeight:700,color:"#9333ea",marginBottom:"12px",display:"flex",alignItems:"center",gap:"6px"}}>{!varios&&e&&e.escudo&&<img src={e.escudo} alt="" style={{width:18,height:18,objectFit:"contain"}}/>}PROMEDIOS · {temp}{!varios?` · ${e.nombre}`:""}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(58px,1fr))",gap:"8px"}}>
            {cards.map(([l,v])=>(<div key={l} style={{textAlign:"center",background:"#faf5ff",borderRadius:"12px",padding:"10px 4px"}}><div style={{fontSize:"18px",fontWeight:800,color:"#1e293b"}}>{v}</div><div style={{fontSize:"10px",color:"#94a3b8",fontWeight:600}}>{l}</div></div>))}
          </div>
          <div style={{display:"flex",gap:"16px",marginTop:"12px",flexWrap:"wrap"}}>
            {pcts.map(([l,v])=>(<div key={l} style={{fontSize:"12px",color:"#64748b"}}><span style={{fontWeight:700,color:"#334155"}}>{v==null?"—":v+"%"}</span> {l}</div>))}
          </div>
        </div>
        <div style={{background:"#fff",borderRadius:"18px",padding:"14px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",overflowX:"auto"}}>
          <div style={{fontSize:"12px",fontWeight:700,color:"#9333ea",marginBottom:"10px"}}>PARTIDO A PARTIDO</div>
          <table style={{borderCollapse:"collapse",width:"100%",minWidth:"580px"}}>
            <thead><tr>{["Fecha","","Rival","Res","MIN","PTS","TC","T3","TL","REB","AST","VAL"].map((h,i)=><th key={i} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {[...part].sort((a,b)=>(b.fecha_hora||"").localeCompare(a.fecha_hora||"")).map((x,i)=>{
                const local=x.id_equipo===x.id_equipo_local;
                const rival=eqName(local?x.id_equipo_visitante:x.id_equipo_local,x.temporada);
                const pf=local?N(x.resultado_local):N(x.resultado_visitante);
                const pc=local?N(x.resultado_visitante):N(x.resultado_local);
                const win=pf>pc;
                return(<tr key={i} onClick={()=>onOpenPartido&&onOpenPartido(x.id_partido)} style={{cursor:onOpenPartido?"pointer":"default"}}>
                  <td style={{...td,color:"#94a3b8",fontSize:"11px"}}>{(x.fecha_hora||"").slice(5,10).split("-").reverse().join("/")}</td>
                  <td style={{...td,fontSize:"13px"}}>{local?"🏠":"✈️"}</td>
                  <td style={{...td,textAlign:"left",maxWidth:"130px",overflow:"hidden",textOverflow:"ellipsis"}}>{rival}</td>
                  <td style={{...td,fontWeight:700,color:win?"#16a34a":"#ef4444"}}>{win?"V":"D"} {pf}-{pc}</td>
                  <td style={td}>{x.minutos}</td>
                  <td style={{...td,fontWeight:700}}>{x.puntos}</td>
                  <td style={td}>{x.tc_anotados}/{x.tc_intentados}</td>
                  <td style={td}>{x.t3_anotados}/{x.t3_intentados}</td>
                  <td style={td}>{x.tl_anotados}/{x.tl_intentados}</td>
                  <td style={td}>{x.reb_totales}</td>
                  <td style={td}>{x.asistencias}</td>
                  <td style={{...td,fontWeight:700}}>{x.valoracion}</td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
        <select value={temp||""} onChange={e=>{setTemp(e.target.value);setComp("ALL");}} style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"#9333ea",fontWeight:700,background:"#fff",outline:"none"}}>
          {temps.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        {compsTemp.length>1?(
          <select value={compActiva} onChange={e=>setComp(e.target.value)} style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"#475569",fontWeight:600,background:"#fff",outline:"none"}}>
            <option value="ALL">Todas las competiciones</option>
            {compsTemp.map(c=><option key={c} value={c}>{ligaMap[c]?.nombre||c}</option>)}
          </select>
        ):compsTemp.length===1&&(
          <select value={compsTemp[0]} disabled style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"#475569",fontWeight:600,background:"#f8fafc",outline:"none",cursor:"default"}}>
            <option value={compsTemp[0]}>{ligaMap[compsTemp[0]]?.nombre||compsTemp[0]}</option>
          </select>
        )}
      </div>
      {equiposOrden.map(idEq=>bloque(idEq,porEquipo[idEq]))}
    </div>
  );
}

function PlayersView({players,equipos,ligas,palmares,coaches,tempCoach,onReload,onGoToTeam,onGoToCoach,openPlayerId,onClearPlayer,isAdmin,onGoToTab,navHistory,onGoBack,equiposNombres,setPlayers,setTempCoach,onGoToPartido,regExtra,isFavFn,onToggleFav}){
  const [search,setSearch]         = useState("");
  const [filterPos,setFilterPos]   = useState("");
  const [filterNacs,setFilterNacs] = useState(new Set());
  const [filterLiga,setFilterLiga] = useState("");
  const [filterTemp,setFilterTemp] = useState("");
  const [filterStatus,setFilterStatus] = useState("");
  const [selId,setSelId]           = useState(openPlayerId||null);
  const [shareMsg,setShareMsg]     = useState(false);
  const [lightboxPhoto,setLightboxPhoto] = useState(null);
  const [visibleCount,setVisibleCount] = useState(60);
  const loadMoreRef = useRef(null);
  useEffect(()=>{const seg='jugadoras';window.history.replaceState({},"",selId?`/${seg}/${selId}`:`/${seg}`);},[selId]);
  const [modal,setModal]           = useState(null);
  const [editSeason,setEditSeason] = useState(null);
  const [renewSeason,setRenewSeason] = useState(null);
  const [del,setDel]               = useState(null);
  const [saving,setSaving]         = useState(false);
  const [seasonModal,setSeasonModal] = useState(null);
  const [delCoachItem,setDelCoachItem] = useState(null);
  const [saving3,setSaving3]       = useState(false);
  const [activeTipo,setActiveTipo] = useState(null);
  const [ftab,setFtab]             = useState("carrera");
  useEffect(()=>{setFtab("carrera");},[selId]);
  const photoRef = useRef();

  useEffect(()=>{if(openPlayerId){setSelId(openPlayerId);onClearPlayer();}},[openPlayerId]);

  // Lazy load carrera completa cuando se abre una jugadora (la carga inicial solo tiene la última temporada).
  // Depende de players.length para re-ejecutarse cuando loadAll termine (evita race si el usuario
  // entra directo por URL /jugadoras/{id} antes de que se haya cargado la base).
  useEffect(()=>{
    if(!selId||players.length===0)return;
    const pl=players.find(p=>p.id_jugadora===selId);
    if(!pl)return;
    // Cargar carrera completa si hay más temporadas que las ya cargadas
    const yaLoaded=(pl.seasons||[]).length;
    (async()=>{
      const {data}=await supabase.from("temporadas").select("id,id_jugadora,id_equipo,id_liga,temporada,orden").eq("id_jugadora",selId).order("temporada",{ascending:false}).limit(50);
      if(!data||data.length<=yaLoaded)return; // ya tenemos todo cargado
      setPlayers(prev=>prev.map(p=>p.id_jugadora===selId?{...p,seasons:data}:p));
    })();
  },[selId,players.length]);

  const equipoMap = useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap   = useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);
  const selected  = players.find(p=>p.id_jugadora===selId)||null;

  const playerTipos = useMemo(()=>{
    if(!selected) return [];
    const seen=new Set();
    sortS(selected.seasons).forEach(s=>{const t=ligaMap[s.id_liga]?.tipo;if(t&&!seen.has(t))seen.add(t);});
    return [...seen];
  },[selected,ligaMap]);

  const defaultTipo = useMemo(()=>{
    if(!selected) return null;
    const tipos=new Set(sortS(selected.seasons).map(s=>ligaMap[s.id_liga]?.tipo).filter(Boolean));
    return tipos.has("liga")?"liga":(ligaMap[sortS(selected.seasons)[0]?.id_liga]?.tipo||null);
  },[selected,ligaMap]);

  const currentTipo    = activeTipo===null ? defaultTipo : activeTipo;
  const filteredSeasons = useMemo(()=>{
    if(!selected) return [];
    const all=sortS(selected.seasons);
    return (currentTipo&&currentTipo!=="ALL") ? all.filter(s=>ligaMap[s.id_liga]?.tipo===currentTipo) : all;
  },[selected,currentTipo,ligaMap]);

  const allNacs = useMemo(()=>[...new Set(players.flatMap(p=>[p.nacionalidad,p.nacionalidad2]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")),[players]);
  const allLigasPlayer = useMemo(()=>{
    const ligsSet=new Set();
    players.forEach(p=>{
      const lastS=[...(p.seasons||[])].sort((a,b)=>b.temporada.localeCompare(a.temporada))[0];
      if(lastS){const l=ligaMap[lastS.id_liga];if(l?.nombre)ligsSet.add(l.nombre);}
    });
    return [...ligsSet].sort((a,b)=>a.localeCompare(b,"es"));
  },[players,ligaMap]);
  const allTemps = useMemo(()=>[...new Set(players.flatMap(p=>(p.seasons||[]).map(s=>s.temporada)).filter(Boolean))].sort((a,b)=>b.localeCompare(a)),[players]);
  const filtered = useMemo(()=>{
    const q=search.toLowerCase();
    return players.filter(p=>{
      const lastS=[...(p.seasons||[])].sort((a,b)=>b.temporada.localeCompare(a.temporada))[0];
      const lastLigNombre=lastS?ligaMap[lastS.id_liga]?.nombre:null;
      return(!q||p.nombre?.toLowerCase().includes(q)||p.id_jugadora?.toLowerCase().includes(q)||p.nacionalidad?.toLowerCase().includes(q)||p.seasons?.some(s=>equipoMap[s.id_equipo]?.nombre?.toLowerCase().includes(q)))
        &&(!filterPos||p.posicion===filterPos||p.posicion2===filterPos)
        &&(filterNacs.size===0||filterNacs.has(p.nacionalidad)||filterNacs.has(p.nacionalidad2))
        &&(!filterLiga||lastLigNombre===filterLiga)
        &&(!filterTemp||(p.seasons||[]).some(s=>s.temporada===filterTemp))
        &&(!filterStatus||playerStatus(p.nacionalidad,p.nacionalidad2)===filterStatus);
    }).sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||"","es"));
  },[players,search,filterPos,filterNacs,filterLiga,filterTemp,filterStatus,ligaMap,equipoMap]);

  // Reset paginación al cambiar filtros
  useEffect(()=>{setVisibleCount(60);},[search,filterPos,filterNacs,filterLiga,filterTemp,filterStatus]);

  // IntersectionObserver para scroll infinito
  useEffect(()=>{
    const el=loadMoreRef.current;
    if(!el)return;
    const obs=new IntersectionObserver(entries=>{
      if(entries[0].isIntersecting){
        setVisibleCount(c=>Math.min(c+60,filtered.length));
      }
    },{rootMargin:"400px"});
    obs.observe(el);
    return()=>obs.disconnect();
  },[filtered.length,selId]);

  const addPlayer=async f=>{
    setSaving(true);
    try{
      const allJIds=players.map(p=>parseInt((p.id_jugadora||"J0").slice(1))).filter(n=>!isNaN(n));
      const newId=firstFreeId(allJIds,"J",0);
      const newPlayer={id_jugadora:newId,nombre:f.nombre,posicion:f.posicion||null,posicion2:f.posicion2||null,nacionalidad:f.nacionalidad,nacionalidad2:f.nacionalidad2||null,fecha_nac:f.fecha_nac||null,fecha_fallecimiento:f.fecha_fallecimiento||null,altura_cm:f.altura_cm?parseInt(f.altura_cm):null,foto:f.foto||null};
      const{error}=await supabase.from("jugadoras").insert(newPlayer);
      if(error)throw error;
      setPlayers(prev=>[...prev,{...newPlayer,seasons:[]}].sort((a,b)=>(a.id_jugadora||"").localeCompare(b.id_jugadora||"")));
      setModal(null);
    }catch(e){alert("Error al guardar jugadora: "+(e.message||e.details||JSON.stringify(e)));}
    setSaving(false);
  };
  const updPlayer=async f=>{
    setSaving(true);
    const payload={nombre:f.nombre,posicion:f.posicion||null,posicion2:f.posicion2||null,nacionalidad:f.nacionalidad,nacionalidad2:f.nacionalidad2||null,fecha_nac:f.fecha_nac||null,fecha_fallecimiento:f.fecha_fallecimiento||null,altura_cm:f.altura_cm?parseInt(f.altura_cm):null,foto:f.foto||null};
    try{const{error}=await supabase.from("jugadoras").update(payload).eq("id_jugadora",selId);
      if(error)throw error;
      setPlayers(prev=>prev.map(p=>p.id_jugadora!==selId?p:{...p,...payload}));
      setModal(null);}catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const delPlayer=async()=>{
    try{await supabase.from("temporadas").delete().eq("id_jugadora",selId);
      const{error}=await supabase.from("jugadoras").delete().eq("id_jugadora",selId);
      if(error)throw error;
      setPlayers(prev=>prev.filter(p=>p.id_jugadora!==selId));
      setSelId(null);setDel(null);}catch(e){alert("Error: "+e.message);}
  };
  const addSeason=async f=>{
    setSaving(true);
    try{
      const allIds=players.flatMap(p=>p.seasons||[]).map(s=>parseInt(s.id)).filter(n=>!isNaN(n));
      const newId=Math.max(0,...allIds)+1;
      const newSeason={id:newId,id_jugadora:selId,id_equipo:f.id_equipo,id_liga:f.id_liga,temporada:f.temporada};
      const{error}=await supabase.from("temporadas").insert(newSeason);
      if(error)throw error;
      setPlayers(prev=>prev.map(p=>p.id_jugadora!==selId?p:{...p,seasons:[...(p.seasons||[]),newSeason]}));
      setModal(null);}catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const updSeason=async f=>{
    setSaving(true);
    const payload={id_equipo:f.id_equipo,id_liga:f.id_liga,temporada:f.temporada,orden:parseInt(f.orden)||0};
    try{const{error}=await supabase.from("temporadas").update(payload).eq("id",editSeason.id);
      if(error)throw error;
      setPlayers(prev=>prev.map(p=>p.id_jugadora!==selId?p:{...p,seasons:(p.seasons||[]).map(s=>s.id!==editSeason.id?s:{...s,...payload})}));
      setModal(null);setEditSeason(null);}catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const delSeason=async id=>{
    try{const{error}=await supabase.from("temporadas").delete().eq("id",id);
      if(error)throw error;
      setPlayers(prev=>prev.map(p=>p.id_jugadora!==selId?p:{...p,seasons:(p.seasons||[]).filter(s=>s.id!==id)}));
      setDel(null);}catch(e){alert("Error: "+e.message);}
  };
  const saveCoachSeasonInPlayer=async(f,coachId)=>{
    setSaving3(true);
    try{
      if(seasonModal==="add"){
        const {data}=await supabase.from("temporadas_coach").select("id").order("id",{ascending:false}).limit(1);
        const newId=(data?.[0]?.id||0)+1;
        const newRow={id:newId,id_coach:coachId,...f,orden:parseInt(f.orden)||0};
        const{error}=await supabase.from("temporadas_coach").insert(newRow);
        if(error)throw error;
        setTempCoach(prev=>[...prev,newRow]);
      } else {
        const payload={...f,orden:parseInt(f.orden)||0};
        const{error}=await supabase.from("temporadas_coach").update(payload).eq("id",seasonModal.id);
        if(error)throw error;
        setTempCoach(prev=>prev.map(tc=>tc.id!==seasonModal.id?tc:{...tc,...payload}));
      }
      setSeasonModal(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving3(false);
  };
  const delCoachSeasonInPlayer=async(id)=>{
    try{const{error}=await supabase.from("temporadas_coach").delete().eq("id",id);
      if(error)throw error;
      setTempCoach(prev=>prev.filter(tc=>tc.id!==id));
      setDelCoachItem(null);}catch(e){alert("Error: "+e.message);}
  };


  if(players.length===0) return <EmptyState icon="👩‍🏀" text="No hay jugadoras" sub="Verifica la conexión con Supabase"/>;

  if(selected) return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"20px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
        {(()=>{const prev=navHistory&&navHistory.length>0?navHistory[navHistory.length-1]:null;return prev?(<button onClick={onGoBack} style={{background:"none",border:"none",color:"#c084fc",fontSize:"15px",cursor:"pointer",fontWeight:600,padding:0}}>← Volver a {prev.label}</button>):(<button onClick={()=>{setSelId(null);setActiveTipo(null);}} style={{background:"none",border:"none",color:"#c084fc",fontSize:"15px",cursor:"pointer",fontWeight:600,padding:0}}>← Volver</button>);})()}
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <button onClick={()=>{
            const url=`${window.location.origin}/jugadoras/${selected.id_jugadora}`;
            // Solo url, sin text: si se pasan ambos, Android concatena text+url en un único
            // bloque de texto antes de entregarlo a WhatsApp, lo que generaba un preview
            // inconsistente (a veces el del dominio raíz en vez de la ficha de la jugadora).
            const posicionesShare=[selected.posicion,selected.posicion2].filter(Boolean).join("/");
            const banderasShare=[countryFlagEmoji(selected.nacionalidad),countryFlagEmoji(selected.nacionalidad2)].filter(Boolean).join(" ");
            const detallesShare=[posicionesShare,banderasShare].filter(Boolean).join(" · ");
            const shareText=detallesShare?`${selected.nombre} · ${detallesShare} — La Basketneta`:`Ficha de ${selected.nombre} en La Basketneta`;
            if(navigator.share){navigator.share({title:selected.nombre,text:shareText,url}).catch(()=>{});}
            else{navigator.clipboard.writeText(url);setShareMsg(true);setTimeout(()=>setShareMsg(false),2000);}
          }} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#475569"}}>📤 Compartir</button>
          {shareMsg&&<span style={{fontSize:"12px",color:"#16a34a",fontWeight:600}}>¡Enlace copiado!</span>}
          {isAdmin&&!del&&(<>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>setModal("editPlayer")} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#475569"}}>✏️ Editar</button>
            <button onClick={()=>setDel("player")} style={{background:"#fee2e2",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
          </div>
          </>)}
        </div>
        {isAdmin&&del&&(
          <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
            <span style={{fontSize:"13px",color:"#ef4444",fontWeight:600}}>¿Eliminar?</span>
            <button onClick={del==="player"?delPlayer:()=>delSeason(del)} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:"8px",padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:"13px"}}>Sí</button>
            <button onClick={()=>setDel(null)} style={{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:"8px",padding:"6px 14px",fontWeight:600,cursor:"pointer",fontSize:"13px"}}>No</button>
          </div>
        )}
      </div>

      <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:"20px"}}>
          <Avatar photo={selected.foto} name={selected.nombre} size={90} fontSize={30} fallecida={!!selected.fecha_fallecimiento} onPhotoClick={setLightboxPhoto}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"8px",flexWrap:"wrap"}}>
              <div style={{minWidth:"140px",flex:1}}><div style={{display:"flex",alignItems:"center",gap:"8px"}}><h1 style={{fontWeight:800,fontSize:"21px",color:"#1e293b",margin:0,wordBreak:"break-word"}}>{selected.nombre}</h1>{onToggleFav&&<button onClick={e=>{e.stopPropagation();onToggleFav("jugadora",selected.id_jugadora);}} title={isFavFn?.("jugadora",selected.id_jugadora)?"Quitar de favoritos":"Añadir a favoritos"} style={{background:"none",border:"none",cursor:"pointer",fontSize:"20px",padding:0,lineHeight:1,flexShrink:0}}>{isFavFn?.("jugadora",selected.id_jugadora)?"⭐":"☆"}</button>}</div>{isAdmin&&<span style={{fontSize:"11px",color:"#94a3b8",fontFamily:"monospace"}}>{selected.id_jugadora}</span>}</div>
              {(()=>{
                const titles={};
                const uniquePairs=[...new Map((selected.seasons||[]).map(s=>[s.id_equipo+"_"+s.temporada,s])).values()];
                uniquePairs.forEach(s=>{
                  (palmares||[]).filter(p=>p.id_equipo===s.id_equipo&&p.temporada===s.temporada).forEach(p=>{
                    const n=ligaMap[p.id_liga]?.nombre||p.id_liga;
                    titles[n]=(titles[n]||0)+1;
                  });
                });
                const entries=Object.entries(titles);
                if(!entries.length)return null;
                return(<div style={{display:"flex",flexDirection:"column",gap:"4px",alignItems:"flex-end",flexShrink:1,minWidth:0,maxWidth:"100%"}}>{entries.map(([n,c])=>(<span key={n} title={`${c}x ${n}`} style={{background:"#fffbeb",border:"1.5px solid #fed7aa",color:"#b45309",fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"20px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%",boxSizing:"border-box"}}>🏆 {c}x {n}</span>))}</div>);
              })()}
            </div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"12px"}}>
              {selected.posicion&&<span style={posStyle(selected.posicion)}>{selected.posicion}</span>}
              {selected.posicion2&&<span style={posStyle(selected.posicion2)}>{selected.posicion2}</span>}
              {STATUS_BADGE_LG[playerStatus(selected.nacionalidad,selected.nacionalidad2)]}
              {(selected.nacionalidad||selected.nacionalidad2)&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",padding:"3px 8px",borderRadius:"20px",display:"inline-flex",alignItems:"center",gap:"4px"}}>{selected.nacionalidad&&<FlagImg country={selected.nacionalidad}/>}{selected.nacionalidad2&&<FlagImg country={selected.nacionalidad2}/>}</span>}
            </div>
            {(()=>{
              const coachRecord=(coaches||[]).find(c=>String(c.id_jugadora)===String(selected.id_jugadora));
              return(
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",flexWrap:"wrap"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:"8px",flex:1,minWidth:0}}>
                    {selected.altura_cm&&<div style={{fontSize:"13px"}}><span style={{color:"#94a3b8"}}>Altura: </span><span style={{fontWeight:600,color:"#334155"}}>{selected.altura_cm} cm</span></div>}
                    {selected.fecha_nac&&<div style={{fontSize:"13px"}}><span style={{color:"#94a3b8"}}>{selected.fecha_fallecimiento?"Edad al fallecer: ":"Edad: "}</span><span style={{fontWeight:600,color:"#334155"}}>{calcAge(selected.fecha_nac,selected.fecha_fallecimiento)} años</span></div>}
                  </div>
                  {coachRecord&&(
                    <button onClick={()=>onGoToCoach(coachRecord.id_coach,{tab:"jugadoras",id:selected?.id_jugadora,label:selected?.nombre})}
                      style={{background:"#eff6ff",color:"#1d4ed8",border:"1.5px solid #bfdbfe",borderRadius:"20px",padding:"4px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"4px",flexShrink:0}}>
                      📋 Coach
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
        {[["carrera","Carrera"],["estadisticas","Estadísticas"]].map(([k,l])=>(<button key={k} onClick={()=>setFtab(k)} style={{flex:1,padding:"10px",borderRadius:"12px",border:"none",cursor:"pointer",fontWeight:700,fontSize:"13px",background:ftab===k?"#9333ea":"#f1f5f9",color:ftab===k?"#fff":"#64748b"}}>{l}</button>))}
      </div>
      {ftab==="carrera"&&(
      <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"10px"}}>
          <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:0}}>Historial <span style={{color:"#94a3b8",fontWeight:400,fontSize:"14px"}}>({selected.seasons.length})</span></h2>
          {isAdmin&&<button onClick={()=>setModal("addSeason")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"8px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Temporada</button>}
        </div>
        {isAdmin&&modal==="addSeason"&&<Modal title="Añadir temporada" onClose={()=>setModal(null)}><SeasonForm equipos={equipos} ligas={ligas} onSave={addSeason} onCancel={()=>setModal(null)} saving={saving}/></Modal>}
        {playerTipos.length>1&&(
          <div style={{marginBottom:"16px",paddingBottom:"14px",borderBottom:"1px solid #f1f5f9"}}>
            <select value={currentTipo||"ALL"} onChange={e=>setActiveTipo(e.target.value)}
              style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none",width:"100%"}}>
              <option value="ALL">Todas las competiciones</option>
              {playerTipos.map(t=><option key={t} value={t}>{TIPO_LABELS[t]||t}</option>)}
            </select>
          </div>
        )}
        {(()=>{
          const coachRecord=(coaches||[]).find(c=>String(c.id_jugadora)===String(selected.id_jugadora));
          const coachSeasons=(coachRecord?(tempCoach||[]).filter(tc=>tc.id_coach===coachRecord.id_coach):[]).map(s=>({...s,_type:"coach"}));
          const playSeasons=filteredSeasons.map(s=>({...s,_type:"player"}));
          const merged=[...playSeasons,...coachSeasons].sort((a,b)=>b.temporada.localeCompare(a.temporada));
          if(merged.length===0)return <div style={{textAlign:"center",padding:"30px",color:"#94a3b8",fontSize:"14px"}}>Sin temporadas para esta competición</div>;
          const hasCoach=coachSeasons.length>0;
          return(
            <>
              {hasCoach&&<div style={{display:"flex",gap:"12px",marginBottom:"12px",fontSize:"12px",color:"#64748b",alignItems:"center"}}>
                <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:10,borderRadius:"50%",background:"#9333ea",display:"inline-block"}}/> Jugadora</span>
                <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:10,borderRadius:"50%",background:"#3b82f6",display:"inline-block"}}/> Entrenadora</span>
              </div>}
              <div style={{position:"relative"}}>
                <div style={{position:"absolute",left:"11px",top:"10px",bottom:"10px",width:"2px",background:"linear-gradient(to bottom,#fed7aa,#bfdbfe)"}}/>
                <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                  {merged.map((s,i)=>{
                    const isCoach=s._type==="coach";
                    const eq=equipoMap[s.id_equipo],lig=ligaMap[s.id_liga];
                    const dotColor=isCoach?(i===0?"#3b82f6":"#93c5fd"):(i===0?"#9333ea":"#fdba74");
                    return(
                      <div key={(isCoach?"c":"p")+s.id} style={{display:"flex",gap:"16px",alignItems:"flex-start",paddingLeft:"32px",position:"relative"}}>
                        <div style={{position:"absolute",left:"6px",top:"14px",width:"12px",height:"12px",borderRadius:"50%",background:dotColor,border:"3px solid #fff",boxShadow:`0 0 0 2px ${dotColor}`}}/>
                        <div style={{flex:1,background:isCoach?"#eff6ff":"#f8fafc",borderRadius:"12px",padding:"12px 14px",border:`1.5px solid ${isCoach?"#bfdbfe":"#e2e8f0"}`,cursor:"pointer"}}
                          onClick={()=>onGoToTeam(s.id_equipo,s.temporada,{tab:"jugadoras",id:selected?.id_jugadora,label:selected?.nombre})}
                          onMouseEnter={e=>{e.currentTarget.style.background=isCoach?"#dbeafe":"#fff7ed";e.currentTarget.style.borderColor=isCoach?"#93c5fd":"#c084fc";}}
                          onMouseLeave={e=>{e.currentTarget.style.background=isCoach?"#eff6ff":"#f8fafc";e.currentTarget.style.borderColor=isCoach?"#bfdbfe":"#e2e8f0";}}>
                          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                            <TeamBadge team={eq} size={30}/>
                            <div>
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"6px",flexWrap:"wrap"}}>
                                <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                                  <span style={{fontWeight:700,fontSize:"14px",color:"#1e293b"}}>{s.temporada} · </span>
                                  <span style={{color:isCoach?"#3b82f6":"#9333ea",fontWeight:700,textDecoration:"underline"}}>{resolveTeamName(s.id_equipo,s.temporada,equiposNombres,equipoMap)||s.id_equipo}</span>
                                  {eq?.filial_de&&<span style={{background:"#f0fdf4",color:"#16a34a",fontSize:"9px",fontWeight:800,padding:"1px 6px",borderRadius:"20px",letterSpacing:"0.3px"}}>FILIAL</span>}
                                  {isCoach&&<span style={{background:"#dbeafe",color:"#1d4ed8",fontSize:"10px",fontWeight:700,padding:"1px 6px",borderRadius:"20px"}}>📋 Coach</span>}
                                  {isAdmin&&isCoach&&<div style={{display:"flex",gap:"4px",marginLeft:"auto"}} onClick={e=>e.stopPropagation()}>{i===0&&<button onClick={()=>setSeasonModal({id_equipo:s.id_equipo,id_liga:s.id_liga,temporada:nextSeason(s.temporada)})} style={{background:"#f0fdf4",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#16a34a"}} title="Renovar temporada coach">⟳</button>}<button onClick={()=>setSeasonModal(s)} style={{background:"#f1f5f9",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#475569"}}>✏️</button><button onClick={()=>setDelCoachItem({type:"season",id:s.id})} style={{background:"#fee2e2",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#ef4444"}}>🗑️</button></div>}
                                </div>
                                {isAdmin&&!isCoach&&<div style={{display:"flex",gap:"4px"}} onClick={e=>e.stopPropagation()}>
                                  {i===0&&<button onClick={()=>{setRenewSeason({id_equipo:s.id_equipo,id_liga:s.id_liga,temporada:nextSeason(s.temporada),dorsal:s.dorsal||""});setModal("addSeason");}} style={{background:"#f0fdf4",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#16a34a"}} title="Renovar temporada">⟳</button>}
                                  <button onClick={()=>{setEditSeason(s);setModal("editSeason");}} style={{background:"#f1f5f9",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#475569"}}>✏️</button>
                                  <button onClick={()=>setDel(s.id)} style={{background:"#fee2e2",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
                                </div>}
                              </div>
                              <div style={{fontSize:"12px",color:"#64748b",marginTop:"2px",display:"flex",alignItems:"center",gap:"4px"}}>{lig&&<MultiFlag countries={[lig.pais,lig.pais2,lig.pais3]}/>}{lig?.nombre||s.id_liga}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}
      </div>
      )}
      {ftab==="estadisticas"&&<StatsJugadora idJugadora={selected.id_jugadora} equipos={equipos} ligas={ligas} equiposNombres={equiposNombres} onOpenPartido={onGoToPartido}/>}
      {isAdmin&&seasonModal&&(()=>{
        const coachRecord=(coaches||[]).find(c=>String(c.id_jugadora)===String(selected.id_jugadora));
        return coachRecord?(<Modal title={seasonModal==="add"?"Añadir temporada coach":"Editar temporada coach"} onClose={()=>setSeasonModal(null)}>
          <CoachSeasonForm initial={seasonModal!=="add"?seasonModal:null} equipos={equipos} ligas={ligas} onSave={f=>saveCoachSeasonInPlayer(f,coachRecord.id_coach)} onCancel={()=>setSeasonModal(null)} saving={saving3}/>
        </Modal>):null;
      })()}
      {isAdmin&&delCoachItem?.type==="season"&&<ConfirmDel msg="¿Eliminar esta temporada de coach?" onCancel={()=>setDelCoachItem(null)} onConfirm={()=>delCoachSeasonInPlayer(delCoachItem.id)}/>}
      {isAdmin&&modal&&(
        <Modal title={modal==="addSeason"?"Añadir temporada":modal==="editSeason"||editSeason?"Editar temporada":modal==="addPlayer"?"Nueva jugadora":"Editar jugadora"} onClose={()=>{setModal(null);setEditSeason(null);setRenewSeason(null);}}>
          {(modal==="addSeason")&&<SeasonForm initial={renewSeason||undefined} equipos={equipos} ligas={ligas} onSave={addSeason} onCancel={()=>{setModal(null);setRenewSeason(null);}} saving={saving}/>}
          {(editSeason)&&<SeasonForm initial={editSeason} equipos={equipos} ligas={ligas} onSave={updSeason} onCancel={()=>{setEditSeason(null);}} saving={saving}/>}
          {(modal==="addPlayer")&&<PlayerForm onSave={addPlayer} onCancel={()=>setModal(null)} saving={saving}/>}
          {(modal==="editPlayer")&&<PlayerForm initial={selected} onSave={updPlayer} onCancel={()=>setModal(null)} saving={saving}/>}
        </Modal>
      )}
      {isAdmin&&del&&del!=="player"&&(
        <ConfirmDel msg="¿Eliminar esta temporada?" onCancel={()=>setDel(null)} onConfirm={()=>delSeason(del)}/>
      )}
      {lightboxPhoto&&<PhotoLightbox photo={lightboxPhoto} onClose={()=>setLightboxPhoto(null)}/>}
    </div>
  );

  return(
    <div className="bfdb-container" style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      {isAdmin&&modal==="addPlayer"&&<Modal title="Nueva jugadora" onClose={()=>setModal(null)}><PlayerForm onSave={addPlayer} onCancel={()=>setModal(null)} saving={saving}/></Modal>}
      {isAdmin&&<div style={{display:"flex",justifyContent:"flex-end",marginBottom:"12px"}}><button onClick={()=>setModal("addPlayer")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"8px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Jugadora</button></div>}

      <div className="bfdb-filter-row" style={{display:"flex",gap:"8px",marginBottom:"8px",flexWrap:"wrap",alignItems:"stretch"}}>
        <input style={{flex:"1 1 200px",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",color:"#1e293b",outline:"none",background:"#fff",height:"40px",boxSizing:"border-box"}}
          placeholder="🔍 Nombre de jugadora..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterPos?"#9333ea":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterPos?700:400}} value={filterPos} onChange={e=>setFilterPos(e.target.value)}>
          <option value="">Posición</option>
          {POSITIONS.map(p=><option key={p}>{p}</option>)}
        </select>
        <select style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterLiga?"#9333ea":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterLiga?700:400}} value={filterLiga} onChange={e=>setFilterLiga(e.target.value)}>
          <option value="">Liga</option>
          {allLigasPlayer.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        <select style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterTemp?"#9333ea":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterTemp?700:400}} value={filterTemp} onChange={e=>setFilterTemp(e.target.value)}>
          <option value="">Temporada</option>
          {allTemps.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <StatusDropdown filterStatus={filterStatus} setFilterStatus={setFilterStatus}/>
        <NacDropdown allNacs={allNacs} filterNacs={filterNacs} setFilterNacs={setFilterNacs}/>
      </div>
      {(filterPos||filterLiga||filterTemp||filterStatus||filterNacs.size>0)&&(
        <button onClick={()=>{setFilterPos("");setFilterLiga("");setFilterTemp("");setFilterStatus("");setFilterNacs(new Set());}}
          style={{alignSelf:"flex-start",background:"#f1f5f9",color:"#64748b",border:"1.5px solid #e2e8f0",borderRadius:"20px",padding:"5px 14px",fontSize:"12px",fontWeight:700,cursor:"pointer",marginBottom:"4px"}}>
          ✕ Limpiar filtros
        </button>
      )}
      {filterNacs.size>0&&(
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"8px",alignItems:"center"}}>
          <span style={{fontSize:"12px",color:"#64748b"}}>Nac.:</span>
          {[...filterNacs].map(n=>(
            <span key={n} style={{background:"#fff7ed",border:"1.5px solid #fed7aa",color:"#9333ea",fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"20px",display:"inline-flex",alignItems:"center",gap:"3px"}}>
              <FlagImg country={n}/>{n}
            </span>
          ))}
          <span onClick={()=>setFilterNacs(new Set())} style={{background:"#f1f5f9",color:"#64748b",fontSize:"11px",fontWeight:600,padding:"2px 8px",borderRadius:"20px",cursor:"pointer"}}>✕ Limpiar</span>
        </div>
      )}
      <div style={{fontSize:"13px",color:"#94a3b8",marginBottom:"12px"}}>{filtered.length} jugadora{filtered.length!==1?"s":""}</div>
      <div className="bfdb-cards-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"12px"}}>
        {filtered.slice(0,visibleCount).map(p=>{
          const allS=sortS(p.seasons||[]);
          const last=allS.find(s=>ligaMap[s.id_liga]?.tipo==="liga")||allS[0];
          const lastEq=last?equipoMap[last.id_equipo]:null;
          return(
            <div key={p.id_jugadora} onClick={()=>{setSelId(p.id_jugadora);setActiveTipo(null);window.scrollTo({top:0,behavior:"smooth"});}}
              style={{background:"#fff",borderRadius:"16px",padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",border:"2px solid transparent",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#c084fc";e.currentTarget.style.boxShadow="0 4px 18px rgba(249,115,22,0.18)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"12px"}}>
                <Avatar photo={p.foto} name={p.nombre} size={48} fontSize={18} fallecida={!!p.fecha_fallecimiento}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:"15px",color:"#1e293b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.nombre}</div>
                  <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"1px",display:"flex",alignItems:"center",gap:"3px"}}>{p.nacionalidad&&<FlagImg country={p.nacionalidad}/>}{p.nacionalidad2&&<FlagImg country={p.nacionalidad2}/>}{p.altura_cm&&<span>{p.nacionalidad||p.nacionalidad2?" · ":""}{p.altura_cm} cm</span>}</div>
                </div>
                <div className="bfdb-player-card-right" style={{display:"flex",flexDirection:"column",gap:"3px",alignItems:"flex-end",flexShrink:0}}><div className="bfdb-player-badges" style={{display:"flex",gap:"3px",flexWrap:"wrap",justifyContent:"flex-end"}}>{p.posicion&&<span style={posStyle(p.posicion)}>{p.posicion}</span>}{p.posicion2&&<span style={posStyle(p.posicion2)}>{p.posicion2}</span>}</div></div>
              </div>
              <div style={{borderTop:"1px solid #f1f5f9",paddingTop:"10px"}}>
                {lastEq?(<>
                  <div style={{fontSize:"11px",color:"#94a3b8",marginBottom:"4px"}}>Último equipo</div>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <TeamBadge team={lastEq} size={26}/>
                    <div>
                      <div style={{fontSize:"13px",fontWeight:600,color:"#334155"}}>{last.temporada} · {lastEq.nombre}</div>
                      <div style={{fontSize:"11px",color:"#94a3b8"}}>{ligaMap[last.id_liga]?.nombre||last.id_liga}</div>
                    </div>
                  </div>
                </>):<div style={{fontSize:"12px",color:"#cbd5e1",fontStyle:"italic"}}>Sin temporadas</div>}
              </div>
              <div style={{marginTop:"10px",fontSize:"12px",color:"#9333ea",fontWeight:600}}>{(p.seasons||[]).length} temporada{(p.seasons||[]).length!==1?"s":""}</div>
            </div>
          );
        })}
      </div>
      {visibleCount<filtered.length&&(
        <div ref={loadMoreRef} style={{textAlign:"center",padding:"24px",color:"#94a3b8",fontSize:"13px"}}>
          Mostrando {visibleCount} de {filtered.length}...
        </div>
      )}

    </div>
  );
}

/* ── TeamForm ───────────────────────────────────────────── */
function TeamForm({initial,onSave,onCancel,saving}){
  const [f,setF]=useState({nombre:'',ciudad:'',pais:'',año_fundacion:'',escudo:'',tipo:'equipo',redes_sociales:'',pabellon:'',...(initial||{})});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:'100%',border:'1.5px solid #e2e8f0',borderRadius:'10px',padding:'9px 12px',fontSize:'14px',outline:'none',boxSizing:'border-box'};
  return(<div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
    <Fld label='Nombre *'><input style={inp} value={f.nombre||''} onChange={set('nombre')} placeholder='Perfumerías Avenida'/></Fld>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
      <Fld label='Ciudad'><input style={inp} value={f.ciudad||''} onChange={set('ciudad')} placeholder='Salamanca'/></Fld>
      <Fld label='País'><input style={inp} value={f.pais||''} onChange={set('pais')} placeholder='España'/></Fld>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
      <Fld label='Año fundación'><input style={inp} type='number' value={f.año_fundacion||''} onChange={set('año_fundacion')} placeholder='1994'/></Fld>
      <Fld label='Tipo'><select style={inp} value={f.tipo||''} onChange={set('tipo')}><option value=''>— Sin definir —</option><option value='equipo'>Club</option><option value='seleccion'>Selección</option></select></Fld>
    </div>
    <EscudoPicker value={f.escudo} onChange={v=>setF(p=>({...p,escudo:v}))}/>
    <Fld label='Pabellón'><input style={inp} value={f.pabellon||''} onChange={set('pabellon')} placeholder='Würzburg'/></Fld>
    <Fld label='Redes sociales (URL)'><input style={inp} value={f.redes_sociales||''} onChange={set('redes_sociales')} placeholder='https://instagram.com/...'/></Fld>
    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'8px'}}>
      <button onClick={onCancel} style={{background:'#f1f5f9',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.nombre} style={{background:'#9333ea',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
    </div>
  </div>);
}

/* ── PalmaresForm ────────────────────────────────────────── */
function PalmaresForm({initial,ligas,onSave,onCancel,saving}){
  const [f,setF]=useState({id_liga:'',temporada:'',...(initial||{})});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:'100%',border:'1.5px solid #e2e8f0',borderRadius:'10px',padding:'9px 12px',fontSize:'14px',outline:'none',boxSizing:'border-box'};
  return(<div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
    <Fld label='Liga *'><select style={inp} value={f.id_liga||''} onChange={set('id_liga')}>
      <option value=''>Seleccionar liga...</option>
      {(ligas||[]).map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
    </select></Fld>
    <Fld label='Temporada *'><input style={inp} value={f.temporada||''} onChange={set('temporada')} placeholder='2024-25'/></Fld>
    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'8px'}}>
      <button onClick={onCancel} style={{background:'#f1f5f9',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.id_liga||!f.temporada} style={{background:'#9333ea',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
    </div>
  </div>);
}

/* ── AddToSquadForm ─────────────────────────────────────── */
function AddToSquadForm({initial,players,ligas,onSave,onCancel,saving}){
  const [f,setF]=useState({id_jugadora:"",id_liga:"",temporada:initial?.temporada||"",...(initial||{})});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:"100%",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"14px",outline:"none",boxSizing:"border-box"};
  const sorted=[...(players||[])].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  return(<div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
    <Fld label="Jugadora *"><select style={inp} value={f.id_jugadora} onChange={set("id_jugadora")}>
      <option value="">Seleccionar jugadora...</option>
      {sorted.map(p=><option key={p.id_jugadora} value={p.id_jugadora}>{p.nombre}</option>)}
    </select></Fld>
    <Fld label="Liga *"><select style={inp} value={f.id_liga} onChange={set("id_liga")}>
      <option value="">Seleccionar liga...</option>
      {(ligas||[]).map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
    </select></Fld>
    <Fld label="Temporada *"><input style={inp} value={f.temporada} onChange={set("temporada")} placeholder="2025-26"/></Fld>
    <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",marginTop:"8px"}}>
      <button onClick={onCancel} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:600,cursor:"pointer"}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.id_jugadora||!f.id_liga||!f.temporada} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:700,cursor:"pointer"}}>{saving?"Guardando...":"Guardar"}</button>
    </div>
  </div>);
}

/* ── NombreHistoricoForm ────────────────────────────────── */
function NombreHistoricoForm({initial,onSave,onCancel,saving}){
  const [f,setF]=useState({nombre:"",temporada_inicio:"",temporada_fin:"",escudo:"",...(initial||{})});
  const inp={width:"100%",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"14px",outline:"none",boxSizing:"border-box"};
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const ok=f.nombre.trim()&&f.temporada_inicio.trim();
  return(<div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
    <Fld label="Nombre *"><input style={inp} value={f.nombre} onChange={set("nombre")} placeholder="Perfumerías Avenida"/></Fld>
    <Fld label="Temporada inicio *"><input style={inp} value={f.temporada_inicio} onChange={set("temporada_inicio")} placeholder="2020-21"/></Fld>
    <Fld label="Temporada fin (vacío = actualidad)"><input style={inp} value={f.temporada_fin||""} onChange={set("temporada_fin")} placeholder="2024-25"/></Fld>
    <Fld label="URL Escudo (opcional)">
      <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
        <input style={{...inp,flex:1}} value={f.escudo||""} onChange={set("escudo")} placeholder="https://..."/>
        {f.escudo&&<img src={f.escudo} alt="" style={{width:40,height:40,objectFit:"contain",borderRadius:"8px",border:"1px solid #e2e8f0",flexShrink:0}} onError={e=>e.target.style.display="none"}/>}
      </div>
    </Fld>
    <div style={{fontSize:"12px",color:"#94a3b8"}}>Define el rango de temporadas en que el equipo usó este nombre y escudo. Deja "fin" vacío si sigue siendo el nombre actual.</div>
    <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",marginTop:"4px"}}>
      <button onClick={onCancel} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:600,cursor:"pointer"}}>Cancelar</button>
      <button onClick={()=>onSave({nombre:f.nombre.trim(),temporada_inicio:f.temporada_inicio.trim(),temporada_fin:f.temporada_fin.trim()||null,escudo:f.escudo?.trim()||null})} disabled={saving||!ok}
        style={{background:ok?"#9333ea":"#fed7aa",color:"#fff",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:700,cursor:ok?"pointer":"not-allowed"}}>
        {saving?"Guardando...":"Guardar"}
      </button>
    </div>
  </div>);
}

/* ── DuplicateSquadForm ─────────────────────────────────── */
function DuplicateSquadForm({initial,ligas,ligaMap,eq,onSave,onCancel,saving}){
  const [targetLiga,setTargetLiga]=useState("");
  const inp={width:"100%",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"14px",outline:"none",boxSizing:"border-box"};
  const squad=initial.squad||[];
  const temporada=initial.temporada;
  const sourceLiga=initial.sourceLiga;
  const sourceLigaObj=sourceLiga?ligaMap[sourceLiga]:null;

  // Filtrar ligas: misma país/continente que el equipo, excluyendo la liga origen
  const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  const paisEq=norm(eq.pais);
  const availLigas=(ligas||[]).filter(l=>{
    if(l.id_liga===sourceLiga)return false;
    const paisL=norm(l.pais);
    if(paisL===paisEq)return true;
    if(l.tipo==="copacont"||l.tipo==="internacional")return true;
    return false;
  }).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));

  return(<div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
    <div style={{background:"#f8fafc",borderRadius:"12px",padding:"14px",fontSize:"13px",color:"#475569"}}>
      <div style={{marginBottom:"6px"}}><b>{squad.length}</b> jugadora{squad.length!==1?"s":""} de <b>{eq.nombre}</b></div>
      <div>Temporada: <b>{temporada||"—"}</b></div>
      {sourceLigaObj&&<div>Desde: <b>{sourceLigaObj.nombre}</b></div>}
    </div>
    <Fld label="Competición destino *">
      <select style={inp} value={targetLiga} onChange={e=>setTargetLiga(e.target.value)}>
        <option value="">Seleccionar competición...</option>
        {availLigas.map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}{l.tipo==="copadom"?" (Copa)":l.tipo==="copacont"?" (Continental)":""}</option>)}
      </select>
    </Fld>
    <div style={{fontSize:"12px",color:"#94a3b8"}}>Se crearán las mismas entradas con el equipo y temporada actuales, cambiando solo la competición. Las jugadoras que ya tengan esa competición se omitirán.</div>
    <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",marginTop:"4px"}}>
      <button onClick={onCancel} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:600,cursor:"pointer"}}>Cancelar</button>
      <button onClick={()=>onSave(squad,targetLiga,temporada)} disabled={saving||!targetLiga||!temporada} style={{background:targetLiga&&temporada?"#9333ea":"#fed7aa",color:"#fff",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:700,cursor:targetLiga&&temporada?"pointer":"not-allowed"}}>{saving?"Duplicando...":"Duplicar plantilla"}</button>
    </div>
  </div>);
}

/* ── TeamsView ───────────────────────────────────────────── */
function CalendarioEquipo({idEquipo,temporada,equipos,ligas,equiposNombres,onGoToPartido,onGoToLeague}){
  const [games,setGames]=useState(null);
  const [open,setOpen]=useState(false);
  const [shown,setShown]=useState(5);
  const equipoMap=useMemo(()=>{const m={};(equipos||[]).forEach(e=>{m[e.id_equipo]=e;});return m;},[equipos]);
  useEffect(()=>{
    let cancel=false;setGames(null);setShown(5);
    (async()=>{
      let q=supabase.from("partidos").select("id,fecha_hora,temporada,id_liga,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante,notas").or(`id_equipo_local.eq.${idEquipo},id_equipo_visitante.eq.${idEquipo}`).order("fecha_hora",{ascending:true});
      if(temporada)q=q.eq("temporada",temporada);
      const {data}=await q;
      if(!cancel)setGames(data||[]);
    })();
    return()=>{cancel=true;};
  },[idEquipo,temporada]);
  if(games===null||!games.length)return null;
  const now=Date.now();
  const prox=games.find(g=>g.fecha_hora&&new Date(g.fecha_hora).getTime()>=now);
  const rid=g=>g.id_equipo_local===idEquipo?g.id_equipo_visitante:g.id_equipo_local;
  const rdata=g=>resolveTeamData(rid(g),g.temporada,equiposNombres,equipoMap);
  const fmt=f=>{if(!f)return"—";const d=new Date(f);return d.toLocaleDateString("es",{day:"2-digit",month:"short",year:"2-digit"});};
  const card={background:"#fff",borderRadius:"20px",padding:"18px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"};
  const fila=(g)=>{
    const local=g.id_equipo_local===idEquipo;
    const rv=rdata(g);
    const jugado=g.resultado_local!=null&&g.resultado_visitante!=null;
    const pf=local?g.resultado_local:g.resultado_visitante, pc=local?g.resultado_visitante:g.resultado_local;
    const win=jugado&&pf>pc;
    return(
      <div key={g.id} onClick={()=>onGoToPartido&&onGoToPartido(g.id)} style={{display:"flex",alignItems:"center",gap:"10px",padding:"9px 4px",borderBottom:"1px solid #f8fafc",cursor:"pointer"}}>
        <span style={{fontSize:"11px",color:"#94a3b8",width:"62px",flexShrink:0}}>{fmt(g.fecha_hora)}</span>
        <span title={local?"Local":"Visitante"} style={{fontSize:"12px",flexShrink:0}}>{local?"🏠":"✈️"}</span>
        {rv.escudo&&<img src={rv.escudo} alt="" style={{width:20,height:20,objectFit:"contain",flexShrink:0}}/>}
        <span style={{fontSize:"13px",color:"#334155",fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rv.nombre}</span>
        {jugado
          ?<span style={{fontSize:"12px",fontWeight:800,color:win?"#16a34a":"#dc2626",flexShrink:0}}>{win?"V":"D"} {pf}-{pc}</span>
          :<span style={{fontSize:"10px",color:"#cbd5e1",flexShrink:0}}>{g.notas||""}</span>}
      </div>
    );
  };
  return(
    <>
      {prox&&(()=>{const rv=rdata(prox);const local=prox.id_equipo_local===idEquipo;const liga=(ligas||[]).find(l=>l.id_liga===prox.id_liga);return(
        <div onClick={()=>onGoToPartido&&onGoToPartido(prox.id)} style={{...card,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",borderLeft:"4px solid #9333ea"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"11px",fontWeight:700,color:"#9333ea",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:"5px"}}>Próximo partido{prox.notas?` · ${prox.notas}`:""}</div>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:liga?"5px":0}}>
              <span style={{fontSize:"12px"}}>{local?"🏠":"✈️"}</span>
              {rv.escudo&&<img src={rv.escudo} alt="" style={{width:24,height:24,objectFit:"contain"}}/>}
              <span style={{fontSize:"15px",fontWeight:800,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rv.nombre}</span>
            </div>
            {liga&&<div onClick={e=>{e.stopPropagation();onGoToLeague&&onGoToLeague(liga.id_liga);}} style={{display:"inline-flex",alignItems:"center",gap:"5px",cursor:"pointer"}}>
              {liga.logo&&<img src={liga.logo} alt="" style={{width:16,height:16,objectFit:"contain"}}/>}
              <span style={{fontSize:"12px",fontWeight:600,color:"#3b82f6",textDecoration:"underline",textDecorationColor:"#bfdbfe"}}>{liga.nombre}</span>
            </div>}
          </div>
          <span style={{fontSize:"11px",color:"#94a3b8",textAlign:"right",flexShrink:0}}>{fmt(prox.fecha_hora)}</span>
        </div>
      );})()}
      <div style={card}>
        <button onClick={()=>setOpen(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",padding:0,width:"100%"}}>
          <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:0}}>📅 Calendario <span style={{fontSize:"13px",fontWeight:500,color:"#94a3b8"}}>({games.length})</span></h2>
          <span style={{fontSize:"13px",color:"#94a3b8",display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
        </button>
        {open&&<div style={{marginTop:"12px"}}>
          {games.slice(0,shown).map(fila)}
          {shown<games.length&&<button onClick={()=>setShown(s=>s+5)} style={{marginTop:"10px",width:"100%",padding:"9px",borderRadius:"10px",border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>Ver más ({games.length-shown})</button>}
        </div>}
      </div>
    </>
  );
}

function TeamsView({equipos,players,ligas,palmares,coaches,tempCoach,onGoToPlayer,onGoToCoach,onGoToLeague,openTeamId,openTeamYear,onClearTeam,isAdmin,onReload,onGoToTab,navHistory,onGoBack,equiposNombres,setEquipos,setEquiposNombres,setPlayers,setPalmares,regExtra,onGoToPartido,isFavFn,onToggleFav}){
  const [search,setSearch]             = useState("");
  const [filterLeague,setFilterLeague] = useState("");
  const [filterSeason,setFilterSeason] = useState(null);
  const [filterTipo,setFilterTipo]     = useState("");
  const [selId,setSelId]               = useState(openTeamId||null);
  const [shareMsg,setShareMsg]         = useState(false);
  const [visibleCount,setVisibleCount] = useState(60);
  const loadMoreRef = useRef(null);
  useEffect(()=>{const seg='equipos';window.history.replaceState({},"",selId?`/${seg}/${selId}`:`/${seg}`);},[selId]);
  const [selYear,setSelYear]           = useState(null);
  const [selLiga,setSelLiga]           = useState(null);
  const [teamModal,setTeamModal]       = useState(null);
  const [palModal,setPalModal]         = useState(null);
  const [squadModal,setSquadModal]     = useState(null);
  const [dupModal,setDupModal]         = useState(null);
  const [nombreModal,setNombreModal]   = useState(null); // {id,id_equipo,nombre,temporada_inicio,temporada_fin} | "add"
  const [delNombreId,setDelNombreId]   = useState(null);
  const [showNombres,setShowNombres]   = useState(false);
  const [showPlantilla,setShowPlantilla] = useState(false);
  const [showPalmares,setShowPalmares] = useState(false);

  const saveNombre=async(f)=>{
    setSaving(true);
    try{
      if(nombreModal==="add"){
        const{data,error}=await supabase.from("equipos_nombres").insert({id_equipo:selId,...f}).select().single();
        if(error)throw error;
        setEquiposNombres(prev=>[...prev,data]);
      }else{
        const{error}=await supabase.from("equipos_nombres").update(f).eq("id",nombreModal.id);
        if(error)throw error;
        setEquiposNombres(prev=>prev.map(en=>en.id!==nombreModal.id?en:{...en,...f}));
      }
      setNombreModal(null);
    }catch(e){alert("Error: "+(e.message||JSON.stringify(e)));}
    setSaving(false);
  };
  const delNombre=async()=>{
    try{
      const{error}=await supabase.from("equipos_nombres").delete().eq("id",delNombreId);
      if(error)throw error;
      setEquiposNombres(prev=>prev.filter(en=>en.id!==delNombreId));
      setDelNombreId(null);
    }catch(e){alert("Error: "+(e.message||JSON.stringify(e)));}
  };
  const [saving,setSaving]             = useState(false);
  const [delItem,setDelItem]           = useState(null);

  const saveTeam=async(f)=>{
    setSaving(true);
    try{
      if(teamModal==="addTeam"){
        const ids=equipos.map(e=>parseInt(e.id_equipo.replace("E",""))).filter(n=>!isNaN(n));
        const newId=firstFreeId(ids,"E",3);
        const payload={...f,año_fundacion:f.año_fundacion===''||f.año_fundacion===null?null:parseInt(f.año_fundacion)||null};
        const newTeam={id_equipo:newId,...payload};
        const{error}=await supabase.from("equipos").insert(newTeam);
        if(error)throw error;
        setEquipos(prev=>[...prev,newTeam]);
      } else {
        const payload={...f,año_fundacion:f.año_fundacion===''||f.año_fundacion===null?null:parseInt(f.año_fundacion)||null};
        const{error}=await supabase.from("equipos").update(payload).eq("id_equipo",selId);
        if(error)throw error;
        setEquipos(prev=>prev.map(e=>e.id_equipo!==selId?e:{...e,...payload}));
      }
      setTeamModal(null);
    }catch(e){alert("Error al guardar equipo: "+(e.message||e.details||JSON.stringify(e)));}
    setSaving(false);
  };
  const saveSquad=async(f)=>{
    setSaving(true);
    try{
      const allIds=players.flatMap(p=>p.seasons||[]).map(s=>parseInt(s.id)).filter(n=>!isNaN(n));
      const newId=Math.max(0,...allIds)+1;
      const newSeason={id:newId,id_jugadora:f.id_jugadora,id_equipo:f.id_equipo,id_liga:f.id_liga,temporada:f.temporada};
      const{error}=await supabase.from("temporadas").insert(newSeason);
      if(error)throw error;
      setPlayers(prev=>prev.map(p=>p.id_jugadora!==f.id_jugadora?p:{...p,seasons:[...(p.seasons||[]),newSeason]}));
      setSquadModal(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const duplicateSquad=async(squadList,targetLiga,temporada)=>{
    setSaving(true);
    try{
      const eqId=selId;
      // entradas existentes en la liga destino para esa temporada (para saltar duplicados)
      const existing=new Set(
        players.flatMap(p=>(p.seasons||[]).map(s=>({jug:p.id_jugadora,...s})))
          .filter(s=>s.id_liga===targetLiga&&s.temporada===temporada&&s.id_equipo===eqId)
          .map(s=>s.jug)
      );
      const toAdd=squadList.filter(({player})=>!existing.has(player.id_jugadora));
      if(toAdd.length===0){alert("Todas las jugadoras ya tienen entrada en esa competición para "+temporada);setSaving(false);setDupModal(null);return;}
      const allIds=players.flatMap(p=>p.seasons||[]).map(s=>parseInt(s.id)).filter(n=>!isNaN(n));
      let nextId=Math.max(0,...allIds)+1;
      const rows=toAdd.map(({player})=>({id:nextId++,id_jugadora:player.id_jugadora,id_equipo:eqId,id_liga:targetLiga,temporada}));
      const{error}=await supabase.from("temporadas").insert(rows);
      if(error)throw error;
      const rowsByPlayer={};
      rows.forEach(r=>{if(!rowsByPlayer[r.id_jugadora])rowsByPlayer[r.id_jugadora]=[];rowsByPlayer[r.id_jugadora].push(r);});
      setPlayers(prev=>prev.map(p=>rowsByPlayer[p.id_jugadora]?{...p,seasons:[...(p.seasons||[]),...rowsByPlayer[p.id_jugadora]]}:p));
      setDupModal(null);
      const skipped=squadList.length-toAdd.length;
      alert(`✅ ${toAdd.length} jugadora${toAdd.length!==1?"s":""} duplicada${toAdd.length!==1?"s":""}${skipped>0?` · ${skipped} ya existía${skipped!==1?"n":""}`:""}`);
    }catch(e){alert("Error: "+(e.message||JSON.stringify(e)));}
    setSaving(false);
  };
  const delTeam=async()=>{
    try{const{error}=await supabase.from("equipos").delete().eq("id_equipo",selId);
      if(error)throw error;
      setEquipos(prev=>prev.filter(e=>e.id_equipo!==selId));
      setSelId(null);setDelItem(null);}catch(e){alert("Error: "+e.message);}
  };
  const savePalmares=async(f)=>{
    setSaving(true);
    try{
      if(palModal==="add"){
        const {data}=await supabase.from("palmares").select("id");
        const newId=firstFreeIdNum((data||[]).map(r=>r.id));
        const newPal={id:newId,id_equipo:selId,...f};
        const{error}=await supabase.from("palmares").insert(newPal);
        if(error)throw error;
        setPalmares(prev=>[...prev,newPal]);
      } else {
        const{error}=await supabase.from("palmares").update(f).eq("id",palModal.id);
        if(error)throw error;
        setPalmares(prev=>prev.map(pl=>pl.id!==palModal.id?pl:{...pl,...f}));
      }
      setPalModal(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const delPalmares=async(id)=>{
    try{const{error}=await supabase.from("palmares").delete().eq("id",id);
      if(error)throw error;
      setPalmares(prev=>prev.filter(pl=>pl.id!==id));
      setDelItem(null);}catch(e){alert("Error: "+e.message);}
  };


  useEffect(()=>{if(openTeamId){setSelId(openTeamId);setSelYear(openTeamYear||null);onClearTeam();}},[openTeamId]);

  // On-demand: cargar todas las temporadas del equipo seleccionado que aún no estén en players.
  // Depende de players.length para re-ejecutarse cuando loadAll termine (evita race si el usuario
  // entra directo por URL /equipos/{id} antes de que se haya cargado la base).
  useEffect(()=>{
    if(!selId||players.length===0)return;
    const temp=selYear||null;
    (async()=>{
      // Jugadoras que ya tienen temporada en este equipo/temporada
      const yaOk=new Set(players.filter(p=>(p.seasons||[]).some(s=>s.id_equipo===selId&&(!temp||s.temporada===temp))).map(p=>p.id_jugadora));
      // Cargar temporadas del equipo (filtrando por temporada si está seleccionada)
      let q=supabase.from("temporadas").select("id,id_jugadora,id_equipo,id_liga,temporada,orden").eq("id_equipo",selId).limit(500);
      if(temp)q=q.eq("temporada",temp);
      const {data}=await q;
      if(!data||!data.length)return;
      const nuevas=data.filter(t=>!yaOk.has(t.id_jugadora));
      if(!nuevas.length)return;
      setPlayers(prev=>{
        const patch=new Map();
        nuevas.forEach(t=>{if(!patch.has(t.id_jugadora))patch.set(t.id_jugadora,[]);patch.get(t.id_jugadora).push(t);});
        return prev.map(p=>{
          const add=patch.get(p.id_jugadora);
          if(!add)return p;
          const existing=(p.seasons||[]).filter(s=>!add.some(a=>a.id===s.id));
          return {...p,seasons:[...existing,...add]};
        });
      });
    })();
  },[selId,selYear,players.length]);


  const equipoMap = useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap   = useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);
  const coachMap  = useMemo(()=>{const m={};(coaches||[]).forEach(c=>m[c.id_coach]=c);return m;},[coaches]);

  const teamIndex = useMemo(()=>{
    const map={};
    equipos.forEach(e=>{map[e.id_equipo]={eq:e,years:new Set(),players:[]};});
    players.forEach(p=>{(p.seasons||[]).forEach(s=>{
      if(!map[s.id_equipo])map[s.id_equipo]={eq:equipoMap[s.id_equipo]||{id_equipo:s.id_equipo,nombre:s.id_equipo},years:new Set(),players:[]};
      map[s.id_equipo].years.add(s.temporada);
      map[s.id_equipo].players.push({player:p,season:s});
    });});
    return Object.values(map).sort((a,b)=>(a.eq.nombre||"").localeCompare(b.eq.nombre||""));
  },[equipos,players,equipoMap]);

  const allSeasons   = useMemo(()=>[...new Set(players.flatMap(p=>(p.seasons||[]).map(s=>s.temporada||"").filter(Boolean)))].sort((a,b)=>b.localeCompare(a)),[players]);
  const latestSeason = allSeasons[0]||null;
  const allLeagues   = [...new Set(ligas.map(l=>l.nombre).filter(Boolean))].sort();
  const [filterPais,setFilterPais] = useState("");
  const allPaisesEq  = useMemo(()=>[...new Set(equipos.map(e=>e.pais).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")),[equipos]);

  const filtered = useMemo(()=>teamIndex.filter(({eq,years,players:pl})=>{
    const matchSearch=!search||eq.nombre?.toLowerCase().includes(search.toLowerCase())||eq.id_equipo?.toLowerCase().includes(search.toLowerCase());
    const matchLeague=!filterLeague||pl.some(({season})=>ligaMap[season.id_liga]?.nombre===filterLeague);
    const matchSeason=!filterSeason||years.has(filterSeason);
    const matchTipo=!filterTipo||eq.tipo===filterTipo;
    const matchPais=!filterPais||eq.pais===filterPais;
    return matchSearch&&matchLeague&&matchSeason&&matchTipo&&matchPais;
  }),[teamIndex,search,filterLeague,filterSeason,filterTipo,filterPais,ligaMap]);

  // IntersectionObserver para scroll infinito, mismo patrón que PlayersView.
  // Sin esto, los ~1000+ equipos se montaban todos de golpe al entrar en la pestaña,
  // generando una lentitud notable solo por el coste de creación de nodos del DOM.
  useEffect(()=>{
    const el=loadMoreRef.current;
    if(!el)return;
    const obs=new IntersectionObserver(entries=>{
      if(entries[0].isIntersecting){
        setVisibleCount(c=>Math.min(c+60,filtered.length));
      }
    },{rootMargin:"400px"});
    obs.observe(el);
    return()=>obs.disconnect();
  },[filtered.length,selId]);

  // Resetear a 60 al cambiar cualquier filtro: sin esto, si el usuario había hecho
  // scroll hasta visibleCount=600 y luego amplía/cambia el filtro, seguiría viendo
  // solo 600 resultados del nuevo conjunto en vez de empezar limpio desde el principio.
  useEffect(()=>{setVisibleCount(60);},[search,filterLeague,filterSeason,filterTipo,filterPais]);

  const selected    = selId?teamIndex.find(t=>t.eq.id_equipo===selId):null;
  const years       = selected?[...selected.years].sort((a,b)=>b.localeCompare(a)):[];
  const effectiveYear = selYear||(years.length?years[0]:null);
  const ligasInYear = useMemo(()=>{
    if(!selected||!effectiveYear)return [];
    const ids=[...new Set(selected.players.filter(({season})=>season.temporada===effectiveYear).map(({season})=>season.id_liga).filter(Boolean))];
    return ids.map(id=>ligaMap[id]).filter(Boolean).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  },[selected,effectiveYear,ligaMap]);
  const effectiveLiga = ligasInYear.length>1?(selLiga&&ligasInYear.some(l=>l.id_liga===selLiga)?selLiga:ligasInYear[0].id_liga):null;
  const squad       = selected
    ?[...new Map(selected.players.filter(({season})=>(!effectiveYear||season.temporada===effectiveYear)&&(!effectiveLiga||season.id_liga===effectiveLiga)).map(({player,season})=>[player.id_jugadora,{player,season}])).values()]
    :[];

  if(selected){
    const {eq}=selected;
    return(
      <div style={{maxWidth:"720px",margin:"0 auto",padding:"20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px"}}>
          {(()=>{const prev=navHistory&&navHistory.length>0?navHistory[navHistory.length-1]:null;return prev?(<button onClick={onGoBack} style={{background:"none",border:"none",color:"#c084fc",fontSize:"15px",cursor:"pointer",fontWeight:600,padding:0}}>← Volver a {prev.label}</button>):(<button onClick={()=>{setSelId(null);setSelYear(null);}} style={{background:"none",border:"none",color:"#c084fc",fontSize:"15px",cursor:"pointer",fontWeight:600,padding:0}}>← Volver</button>);})()}
          <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
            <button onClick={()=>{
              const url=`${window.location.origin}/equipos/${eq.id_equipo}`;
              // Solo url, sin text: ver comentario equivalente en PlayersView sobre por qué
              // Android concatena text+url y rompe el preview correcto de WhatsApp.
              const banderaShareEq=countryFlagEmoji(eq.pais);
              const detallesShareEq=eq.ciudad&&banderaShareEq?`${eq.ciudad} ${banderaShareEq}`:(eq.ciudad||banderaShareEq||"");
              const shareTextEq=detallesShareEq?`${eq.nombre} · ${detallesShareEq} — La Basketneta`:`Ficha de ${eq.nombre} en La Basketneta`;
              if(navigator.share){navigator.share({title:eq.nombre,text:shareTextEq,url}).catch(()=>{});}
              else{navigator.clipboard.writeText(url);setShareMsg(true);setTimeout(()=>setShareMsg(false),2000);}
            }} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#475569"}}>📤 Compartir</button>
            {shareMsg&&<span style={{fontSize:"12px",color:"#16a34a",fontWeight:600}}>¡Enlace copiado!</span>}
            {isAdmin&&<>
            <button onClick={()=>setTeamModal("editTeam")} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#475569"}}>✏️ Editar</button>
            <button onClick={()=>setDelItem("team")} style={{background:"#fee2e2",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
            </>}
          </div>
        </div>
        {isAdmin&&delItem==="team"&&<ConfirmDel msg="¿Eliminar este equipo?" onCancel={()=>setDelItem(null)} onConfirm={delTeam}/>}
        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",paddingBottom:eq.redes_sociales?"68px":"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px",position:"relative"}}>
          {eq.redes_sociales&&<div style={{position:"absolute",bottom:"18px",left:"24px"}}><SocialIcon url={eq.redes_sociales}/></div>}
          <div style={{display:"flex",alignItems:"center",gap:"20px",flexWrap:"wrap"}}>
            <TeamBadge team={eq} size={80}/>
            <div style={{flex:1,minWidth:"180px"}}>
              <div><div style={{display:"flex",alignItems:"center",gap:"8px"}}><h1 style={{fontWeight:800,fontSize:"22px",color:"#1e293b",margin:"0 0 4px"}}>{eq.nombre}</h1>{eq.filial_de&&<span style={{background:"#f0fdf4",color:"#16a34a",fontSize:"10px",fontWeight:800,padding:"2px 8px",borderRadius:"20px"}}>Filial de {equipoMap[eq.filial_de]?.nombre||eq.filial_de}</span>}{onToggleFav&&<button onClick={e=>{e.stopPropagation();onToggleFav("equipo",eq.id_equipo);}} title={isFavFn?.("equipo",eq.id_equipo)?"Quitar de favoritos":"Añadir a favoritos"} style={{background:"none",border:"none",cursor:"pointer",fontSize:"20px",padding:0,lineHeight:1,flexShrink:0}}>{isFavFn?.("equipo",eq.id_equipo)?"⭐":"☆"}</button>}</div>{isAdmin&&<span style={{fontSize:"11px",color:"#94a3b8",fontFamily:"monospace"}}>{eq.id_equipo}</span>}</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {eq.pais&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center"}}><FlagImg country={eq.pais}/>{eq.pais}</span>}
                {eq.ciudad&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px"}}>📍 {eq.ciudad}</span>}
                {eq.pabellon&&<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eq.ciudad?`${eq.pabellon}, ${eq.ciudad}`:eq.pabellon)}`} target="_blank" rel="noopener noreferrer" style={{background:"#eff6ff",color:"#2563eb",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:"3px"}}>🏟️ {eq.pabellon}</a>}
                {eq.año_fundacion&&<span style={{background:"#fff7ed",color:"#c2410c",fontSize:"12px",fontWeight:700,padding:"3px 10px",borderRadius:"20px"}}>Est. {eq.año_fundacion}</span>}
              </div>
            </div>
            {(()=>{const pal=(palmares||[]).filter(p=>p.id_equipo===eq.id_equipo);if(!pal.length)return null;const counts={};pal.forEach(p=>{const n=ligaMap[p.id_liga]?.nombre||p.id_liga;counts[n]=(counts[n]||0)+1;});return(<div style={{display:"flex",flexDirection:"column",gap:"6px",alignItems:"flex-end",flexShrink:1,minWidth:0,maxWidth:"100%"}}>{Object.entries(counts).map(([nombre,n])=>(<span key={nombre} title={`${n}x ${nombre}`} style={{background:"#fffbeb",border:"1.5px solid #fed7aa",color:"#b45309",fontSize:"12px",fontWeight:700,padding:"4px 10px",borderRadius:"20px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%",boxSizing:"border-box"}}>🏆 {n}x {nombre}</span>))}</div>);})()}
          </div>
          <div style={{display:"flex",gap:"16px",marginTop:"14px",flexWrap:"wrap",alignItems:"flex-start"}}>
            <div style={{display:"flex",gap:"8px",flex:1,flexWrap:"wrap"}}>
              {[[years.length,"Temporadas"],[new Set(selected.players.map(({player})=>player.id_jugadora)).size,"Jugadoras únicas"],[selected.players.length,"Apariciones"]].map(([v,l])=>(
                <div key={l} style={{background:"#f8fafc",borderRadius:"10px",padding:"8px 12px",textAlign:"center",minWidth:"70px"}}>
                  <div style={{fontSize:"16px",fontWeight:800,color:"#1e293b"}}>{v}</div>
                  <div style={{fontSize:"10px",color:"#94a3b8",marginTop:"1px"}}>{l}</div>
                </div>
              ))}
            </div>
            {(()=>{
              const staff=(tempCoach||[]).filter(tc=>tc.id_equipo===eq.id_equipo&&tc.temporada===effectiveYear).sort((a,b)=>parseInt(a.orden||0)-parseInt(b.orden||0));
              if(!staff.length)return null;
              const lastIdx=staff.length-1;
              return(
                <div style={{display:"flex",gap:"8px",flexShrink:0,alignItems:"flex-end"}}>
                  {staff.map((tc,i)=>{
                    const coach=coachMap[tc.id_coach];
                    if(!coach)return null;
                    const isLast=i===lastIdx;
                    const sz=isLast?52:36;
                    return(
                      <div key={i} onClick={()=>onGoToCoach(coach.id_coach,{tab:"equipos",id:selId,label:eq?.nombre})}
                        style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",cursor:"pointer",padding:isLast?"7px 10px":"5px 8px",borderRadius:"10px",background:isLast?"#eff6ff":"#f8fafc",border:`1.5px solid ${isLast?"#93c5fd":"#e2e8f0"}`,transition:"all 0.15s"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor="#3b82f6";e.currentTarget.style.background="#dbeafe";}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=isLast?"#93c5fd":"#e2e8f0";e.currentTarget.style.background=isLast?"#eff6ff":"#f8fafc";}}>
                        <Avatar photo={coach.foto} name={coach.nombre} size={sz} fontSize={isLast?18:13}/>
                        <span style={{fontSize:"9px",color:isLast?"#3b82f6":"#94a3b8",fontWeight:700}}>Coach</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
        <CalendarioEquipo idEquipo={eq.id_equipo} temporada={effectiveYear} equipos={equipos} ligas={ligas} equiposNombres={equiposNombres} onGoToPartido={onGoToPartido} onGoToLeague={onGoToLeague}/>
        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom: showPlantilla?"16px":"0",flexWrap:"wrap",gap:"10px"}}>
            <button onClick={()=>setShowPlantilla(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",padding:0}}>
              <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:0}}>Plantilla <span style={{color:"#94a3b8",fontWeight:400,fontSize:"14px"}}>({squad.length})</span></h2>
              <span style={{fontSize:"13px",color:"#94a3b8",transition:"transform 0.2s",display:"inline-block",transform:showPlantilla?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
            </button>
            {showPlantilla&&<div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
              {ligasInYear.length===1&&(()=>{const l=ligasInYear[0];return(
                <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                  <div style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"6px 12px",fontSize:"13px",color:"#9333ea",fontWeight:700,background:"#fff",display:"flex",alignItems:"center",gap:"6px"}}>
                    <MultiFlag countries={[l.pais,l.pais2,l.pais3]}/>{l.nombre}
                  </div>
                  <button onClick={()=>onGoToLeague&&onGoToLeague(l.id_liga)} title="Ir a esta liga" style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"6px 10px",cursor:"pointer",color:"#9333ea",fontSize:"14px",lineHeight:1}}>→</button>
                </div>
              );})()}
              {ligasInYear.length>1&&<div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                <select value={effectiveLiga||""} onChange={e=>setSelLiga(e.target.value)} style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"6px 12px",fontSize:"13px",color:"#9333ea",fontWeight:700,background:"#fff",outline:"none"}}>
                  {ligasInYear.map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
                </select>
                <button onClick={()=>onGoToLeague&&onGoToLeague(effectiveLiga)} title="Ir a esta liga" style={{background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"6px 10px",cursor:"pointer",color:"#9333ea",fontSize:"14px",lineHeight:1}}>→</button>
              </div>}
              {isAdmin&&squad.length>0&&<button onClick={()=>setDupModal({squad,temporada:effectiveYear,sourceLiga:effectiveLiga||(()=>{const ls=[...new Set(squad.map(({season})=>season.id_liga))];return ls.length===1?ls[0]:"";})()})} title="Duplicar plantilla a otra competición" style={{background:"#fff",color:"#9333ea",border:"1.5px solid #9333ea",borderRadius:"10px",padding:"7px 12px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>⎘ Duplicar</button>}
              {isAdmin&&<button onClick={()=>setSquadModal({temporada:effectiveYear||"",id_liga:"",id_equipo:eq.id_equipo})} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Jugadora</button>}
              {years.length>0&&<select value={effectiveYear||""} onChange={e=>{setSelYear(e.target.value||null);setSelLiga(null);}} style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none"}}>
                {years.map(y=><option key={y} value={y}>{y}</option>)}
              </select>}
            </div>}
          </div>
          {showPlantilla&&(squad.length===0?<div style={{textAlign:"center",padding:"30px",color:"#94a3b8"}}>Sin jugadoras para esta temporada</div>
            :<div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {squad.map(({player},i)=>(
                <div key={i} onClick={()=>onGoToPlayer(player.id_jugadora,{tab:"equipos",id:selId,label:eq?.nombre})}
                  style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 14px",background:"#f8fafc",borderRadius:"12px",border:"1.5px solid #e2e8f0",cursor:"pointer",transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#c084fc";e.currentTarget.style.background="#fff7ed";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.background="#f8fafc";}}>
                  <Avatar photo={player.foto} name={player.nombre} size={44} fontSize={16} fallecida={!!player.fecha_fallecimiento}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:"14px",color:"#9333ea"}}>{player.nombre}</div>
                    <div style={{fontSize:"12px",color:"#64748b",marginTop:"2px",display:"flex",alignItems:"center",gap:"3px"}}>{player.nacionalidad&&<FlagImg country={player.nacionalidad}/>}{player.nacionalidad2&&<FlagImg country={player.nacionalidad2}/>}{player.altura_cm&&<span>{player.nacionalidad||player.nacionalidad2?" · ":""}{player.altura_cm} cm</span>}</div>
                  </div>
                  <div className="bfdb-player-card-right" style={{display:"flex",flexDirection:"column",gap:"3px",alignItems:"flex-end",flexShrink:0}}><div className="bfdb-player-badges" style={{display:"flex",gap:"3px",flexWrap:"wrap",justifyContent:"flex-end"}}>{player.posicion&&<span style={posStyle(player.posicion)}>{player.posicion}</span>}{player.posicion2&&<span style={posStyle(player.posicion2)}>{player.posicion2}</span>}</div>{esEquipoEuropeo(eq.pais)&&STATUS_BADGE[playerStatus(player.nacionalidad,player.nacionalidad2)]}</div>
                </div>
              ))}
            </div>)}
        </div>

        {isAdmin&&delItem?.type==="palmares"&&<ConfirmDel msg="¿Eliminar este título?" onCancel={()=>setDelItem(null)} onConfirm={()=>delPalmares(delItem.id)}/>}
        {isAdmin&&squadModal&&<Modal title="Añadir jugadora a plantilla" onClose={()=>setSquadModal(null)}>
          <AddToSquadForm initial={squadModal} players={players} ligas={ligas} onSave={saveSquad} onCancel={()=>setSquadModal(null)} saving={saving}/>
        </Modal>}
        {isAdmin&&dupModal&&<Modal title="Duplicar plantilla a otra competición" onClose={()=>setDupModal(null)}>
          <DuplicateSquadForm initial={dupModal} ligas={ligas} ligaMap={ligaMap} eq={eq} onSave={duplicateSquad} onCancel={()=>setDupModal(null)} saving={saving}/>
        </Modal>}
        {isAdmin&&palModal&&<Modal title={palModal==="add"?"Añadir título":"Editar título"} onClose={()=>setPalModal(null)}>
          <PalmaresForm initial={palModal!=="add"?palModal:null} ligas={ligas} onSave={savePalmares} onCancel={()=>setPalModal(null)} saving={saving}/>
        </Modal>}
        {isAdmin&&teamModal&&<Modal title={teamModal==="addTeam"?"Nuevo equipo":"Editar equipo"} onClose={()=>setTeamModal(null)}>
          <TeamForm initial={teamModal!=="addTeam"?eq:null} onSave={saveTeam} onCancel={()=>setTeamModal(null)} saving={saving}/>
        </Modal>}
        {(isAdmin||(palmares||[]).filter(p=>p.id_equipo===eq.id_equipo).length>0)&&(
          <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginTop:"14px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom: showPalmares?"14px":"0"}}>
              <button onClick={()=>setShowPalmares(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",padding:0}}>
                <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:0}}>🏆 Palmarés <span style={{color:"#94a3b8",fontWeight:400,fontSize:"14px"}}>({(palmares||[]).filter(p=>p.id_equipo===eq.id_equipo).length})</span></h2>
                <span style={{fontSize:"13px",color:"#94a3b8",transition:"transform 0.2s",display:"inline-block",transform:showPalmares?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
              </button>
              {isAdmin&&<button onClick={()=>setPalModal("add")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Título</button>}
            </div>
            {showPalmares&&<div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
              {(()=>{
                const pal=(palmares||[]).filter(p=>p.id_equipo===eq.id_equipo);
                const TIPO_ORDER={copacont:0,liga:1,copadom:2,internacional:3};
                const byLiga={};
                pal.forEach(p=>{const k=p.id_liga;if(!byLiga[k])byLiga[k]=[];byLiga[k].push(p);});
                return Object.entries(byLiga).sort(([a],[b])=>{
                  const ta=TIPO_ORDER[ligaMap[a]?.tipo??'']??9;
                  const tb=TIPO_ORDER[ligaMap[b]?.tipo??'']??9;
                  return ta-tb||(ligaMap[a]?.nombre||'').localeCompare(ligaMap[b]?.nombre||'');
                }).map(([id_liga,entries])=>{
                  const liga=ligaMap[id_liga];
                  const sorted=[...entries].sort((a,b)=>b.temporada.localeCompare(a.temporada));
                  return(
                    <div key={id_liga}>
                      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}>
                        <div onClick={()=>liga&&onGoToLeague&&onGoToLeague(id_liga,{tab:"equipos",id:selId,label:eq?.nombre})} style={{display:"flex",alignItems:"center",gap:"8px",cursor:liga?"pointer":"default"}}>
                          <LeagueBadge liga={liga} size={32}/>
                          <span style={{fontWeight:700,fontSize:"14px",color:liga?"#9333ea":"#1e293b",textDecoration:liga?"underline":"none"}}>{liga?.nombre||id_liga}</span>
                          {liga&&<MultiFlag countries={[liga.pais,liga.pais2,liga.pais3]}/>}
                        </div>
                        <span style={{background:"#fed7aa",color:"#b45309",fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"20px"}}>{sorted.length}x</span>
                        {isAdmin&&<button onClick={()=>setPalModal("add")} style={{marginLeft:"auto",background:"#9333ea",color:"#fff",border:"none",borderRadius:"8px",padding:"3px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer"}}>+ Título</button>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:"6px",paddingLeft:"8px",borderLeft:"3px solid #fed7aa"}}>
                        {sorted.map((p,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                            <div onClick={()=>setSelYear(p.temporada)} style={{flex:1,display:"flex",alignItems:"center",gap:"10px",padding:"6px 12px",background:"#fffbeb",borderRadius:"10px",border:"1.5px solid #fed7aa",cursor:"pointer",transition:"all 0.15s"}}
                              onMouseEnter={e=>{e.currentTarget.style.background="#fef3c7";e.currentTarget.style.borderColor="#f59e0b";}}
                              onMouseLeave={e=>{e.currentTarget.style.background="#fffbeb";e.currentTarget.style.borderColor="#fed7aa";}}>
                              <span style={{fontWeight:700,fontSize:"13px",color:"#1e293b"}}>{p.temporada}</span>
                            </div>
                            {isAdmin&&<><button onClick={()=>setPalModal(p)} style={{background:"#f1f5f9",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#475569"}}>✏️</button>
                            <button onClick={()=>setDelItem({type:"palmares",id:p.id})} style={{background:"#fee2e2",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#ef4444"}}>🗑️</button></>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>}
          </div>
        )}
        {(()=>{const nombres=(equiposNombres||[]).filter(n=>n.id_equipo===eq.id_equipo).sort((a,b)=>b.temporada_inicio.localeCompare(a.temporada_inicio));
          if(!nombres.length&&!isAdmin)return null;
          return(<div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
            {isAdmin&&nombreModal&&<Modal title={nombreModal==="add"?"Añadir nombre histórico":"Editar nombre"} onClose={()=>setNombreModal(null)}>
              <NombreHistoricoForm initial={nombreModal!=="add"?nombreModal:null} onSave={saveNombre} onCancel={()=>setNombreModal(null)} saving={saving}/>
            </Modal>}
            {isAdmin&&delNombreId&&<ConfirmDel msg="¿Eliminar este nombre?" onCancel={()=>setDelNombreId(null)} onConfirm={delNombre}/>}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom: showNombres?"14px":"0"}}>
              <button onClick={()=>setShowNombres(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",padding:0}}>
                <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:0}}>🏷️ Nombres históricos {nombres.length>0&&<span style={{fontSize:"13px",fontWeight:500,color:"#94a3b8"}}>({nombres.length})</span>}</h2>
                <span style={{fontSize:"13px",color:"#94a3b8",transition:"transform 0.2s",display:"inline-block",transform:showNombres?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
              </button>
              {isAdmin&&<button onClick={()=>setNombreModal("add")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"6px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Añadir</button>}
            </div>
            {showNombres&&(!nombres.length?<p style={{color:"#94a3b8",fontSize:"13px",margin:0}}>Sin nombres históricos registrados.</p>:
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {nombres.map(n=>(
                <div key={n.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"#f8fafc",borderRadius:"10px",border:"1px solid #e2e8f0"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                    {n.escudo&&<img src={n.escudo} alt="" style={{width:32,height:32,objectFit:"contain",borderRadius:"6px",border:"1px solid #e2e8f0",flexShrink:0}} onError={e=>e.target.style.display="none"}/>}
                    <div>
                      <div style={{fontWeight:700,fontSize:"14px",color:"#1e293b"}}>{n.nombre}</div>
                      <div style={{fontSize:"12px",color:"#94a3b8"}}>{n.temporada_inicio}{n.temporada_fin?` → ${n.temporada_fin}`:" → actualidad"}</div>
                    </div>
                  </div>
                  {isAdmin&&<div style={{display:"flex",gap:"6px"}}>
                    <button onClick={()=>setNombreModal(n)} style={{background:"#f1f5f9",border:"none",borderRadius:"6px",padding:"4px 8px",fontSize:"12px",cursor:"pointer"}}>✏️</button>
                    <button onClick={()=>setDelNombreId(n.id)} style={{background:"#fee2e2",border:"none",borderRadius:"6px",padding:"4px 8px",fontSize:"12px",cursor:"pointer"}}>🗑️</button>
                  </div>}
                </div>
              ))}
            </div>)}
          </div>);
        })()}
      </div>
    );
  }

  return(
    <div className="bfdb-container" style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>

      <div style={{minHeight:"112px"}}>
      <div className="bfdb-filter-row" style={{display:"flex",gap:"8px",marginBottom:"14px",flexWrap:"wrap",alignItems:"stretch"}}>
        <input style={{flex:"1 1 200px",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",color:"#1e293b",outline:"none",background:"#fff",height:"40px",boxSizing:"border-box"}}
          placeholder="🔍 Nombre de equipo..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select value={filterTipo} onChange={e=>setFilterTipo(e.target.value)} style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterTipo?"#9333ea":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterTipo?700:400}}>
          <option value="">Tipo</option>
          <option value="equipo">🏟️ Clubs</option>
          <option value="seleccion">🌍 Selecciones</option>
        </select>
        <select value={filterLeague} onChange={e=>setFilterLeague(e.target.value)} style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterLeague?"#9333ea":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterLeague?700:400}}>
          <option value="">Liga</option>
          {allLeagues.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterSeason||""} onChange={e=>setFilterSeason(e.target.value||null)} style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterSeason?"#9333ea":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterSeason?700:400}}>
          <option value="">Temporada</option>
          {allSeasons.map(s=><option key={s} value={s}>{s}{s===latestSeason?" (actual)":""}</option>)}
        </select>
        <PaisDropdown allPaises={allPaisesEq} filterPais={filterPais} setFilterPais={setFilterPais} placeholder="País"/>
      </div>
      {isAdmin&&teamModal==="addTeam"&&<Modal title="Nuevo equipo" onClose={()=>setTeamModal(null)}><TeamForm onSave={saveTeam} onCancel={()=>setTeamModal(null)} saving={saving}/></Modal>}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
        <span style={{fontSize:"13px",color:"#94a3b8"}}>{filtered.length} equipo{filtered.length!==1?"s":""}</span>
        {isAdmin&&<button onClick={()=>setTeamModal("addTeam")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Equipo</button>}
      </div>
      {(()=>{
        const TEAM_GRUPOS=[["equipo","🏟️ Clubes"],["seleccion","🌍 Selecciones"],["other","Otros"]];
        const byTipo={equipo:[],seleccion:[],other:[]};
        filtered.slice(0,visibleCount).forEach(item=>{
          const t=item.eq.tipo;
          if(t==="equipo")byTipo.equipo.push(item);
          else if(t==="seleccion")byTipo.seleccion.push(item);
          else byTipo.other.push(item);
        });
        return TEAM_GRUPOS.map(([tipo,label])=>{
          const items=byTipo[tipo]||[];
          if(!items.length)return null;
          return(
            <div key={tipo} style={{marginBottom:"28px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
                <h2 style={{fontWeight:700,fontSize:"15px",color:"#1e293b",margin:0}}>{label}</h2>
                <span style={{background:"#f1f5f9",color:"#64748b",fontSize:"12px",fontWeight:600,padding:"2px 10px",borderRadius:"20px"}}>{items.length}</span>
              </div>
              <div className="bfdb-cards-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"12px"}}>
                {items.map(({eq,years:yrs,players:pl})=>{
                  const {bg,light,text:tc}=teamColors(eq.nombre||"");
                  const uniq=new Set(pl.map(({player})=>player.id_jugadora)).size;
                  const latestY=[...yrs].sort((a,b)=>b.localeCompare(a))[0];
                  return(
                    <div key={eq.id_equipo} onClick={()=>{setSelId(eq.id_equipo);setSelYear(null);window.scrollTo({top:0,behavior:"smooth"});}}
                      style={{background:"#fff",borderRadius:"16px",padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",border:"2px solid transparent",transition:"all 0.15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=bg;e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.12)";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
                      <div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"12px"}}>
                        <TeamBadge team={eq} size={50}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:"14px",color:"#1e293b",lineHeight:"1.3"}}>{eq.nombre}</div>
                          <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px",display:"flex",alignItems:"center"}}>{eq.ciudad?`${eq.ciudad} · `:""}<FlagImg country={eq.pais||""}/>{eq.pais||""}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                        <span style={{background:light,color:tc,fontSize:"11px",fontWeight:700,padding:"3px 10px",borderRadius:"20px"}}>{uniq} jugadora{uniq!==1?"s":""}</span>
                        {latestY&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"11px",fontWeight:600,padding:"3px 10px",borderRadius:"20px"}}>{latestY}</span>}
                        {eq.año_fundacion&&<span style={{background:"#fff7ed",color:"#c2410c",fontSize:"11px",fontWeight:600,padding:"3px 10px",borderRadius:"20px"}}>Est. {eq.año_fundacion}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        });
      })()}
      {visibleCount<filtered.length&&(
        <div ref={loadMoreRef} style={{textAlign:"center",padding:"24px",color:"#94a3b8",fontSize:"13px"}}>
          Mostrando {visibleCount} de {filtered.length}...
        </div>
      )}
    </div>
  );
}

/* ── LeagueForm ─────────────────────────────────────────── */
function LeagueForm({initial,onSave,onCancel,saving}){
  const [f,setF]=useState({nombre:'',pais:'',pais2:'',pais3:'',nivel:'',tipo:'liga',logo:'',...initial});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:'100%',border:'1.5px solid #e2e8f0',borderRadius:'10px',padding:'9px 12px',fontSize:'14px',outline:'none',boxSizing:'border-box'};
  return(<div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
    <Fld label='Nombre *'><input style={inp} value={f.nombre} onChange={set('nombre')} placeholder='Liga Femenina Endesa'/></Fld>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
      <Fld label='País'><input style={inp} value={f.pais||''} onChange={set('pais')} placeholder='España'/></Fld>
      <Fld label='Nivel'><input style={inp} type='number' value={f.nivel||''} onChange={set('nivel')} placeholder='1'/></Fld>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
      <Fld label='2º País (opcional)'><input style={inp} value={f.pais2||''} onChange={set('pais2')} placeholder='Para ligas multinacionales'/></Fld>
      <Fld label='3º País (opcional)'><input style={inp} value={f.pais3||''} onChange={set('pais3')} placeholder='Opcional'/></Fld>
    </div>
    <Fld label='Tipo'><select style={inp} value={f.tipo||'liga'} onChange={set('tipo')}>
      <option value='liga'>Liga</option>
      <option value='copacont'>Copa Continental</option>
      <option value='copadom'>Copa Nacional</option>
      <option value='internacional'>Internacional</option>
    </select></Fld>
    <Fld label='URL Logo'><input style={inp} value={f.logo||''} onChange={set('logo')} placeholder='https://...'/></Fld>
    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'8px'}}>
      <button onClick={onCancel} style={{background:'#f1f5f9',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.nombre} style={{background:'#9333ea',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
    </div>
  </div>);
}

/* ── CoachForm ───────────────────────────────────────────── */
function CoachForm({initial,players,onSave,onCancel,saving}){
  const [f,setF]=useState({nombre:'',nacionalidad:'',nacionalidad2:'',fecha_nac:'',foto:'',id_jugadora:'',...initial});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:'100%',border:'1.5px solid #e2e8f0',borderRadius:'10px',padding:'9px 12px',fontSize:'14px',outline:'none',boxSizing:'border-box'};
  return(<div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
    <Fld label='Nombre *'><input style={inp} value={f.nombre} onChange={set('nombre')} placeholder='Anna Montañana'/></Fld>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
      <Fld label='Nacionalidad'><input style={inp} value={f.nacionalidad||''} onChange={set('nacionalidad')} placeholder='España'/></Fld>
      <Fld label='2ª Nacionalidad'><input style={inp} value={f.nacionalidad2||''} onChange={set('nacionalidad2')} placeholder='Opcional'/></Fld>
    </div>
    <Fld label='Fecha nacimiento'><input style={inp} type='date' value={f.fecha_nac||''} onChange={set('fecha_nac')}/></Fld>
    <Fld label='Foto (URL)'>
      <div style={{display:'flex',gap:'8px',marginBottom:'6px'}}>
        <button type="button" onClick={()=>setF(p=>({...p,foto:"https://static.flashscore.com/res/image/empty-face-woman-share.gif"}))} style={{background:'#f1f5f9',color:'#475569',border:'none',borderRadius:'8px',padding:'5px 12px',fontSize:'12px',cursor:'pointer',fontWeight:600}}>🖼️ Default ♀</button>
        <button type="button" onClick={()=>setF(p=>({...p,foto:"https://static.flashscore.com/res/image/empty-face-man-share.gif"}))} style={{background:'#f1f5f9',color:'#475569',border:'none',borderRadius:'8px',padding:'5px 12px',fontSize:'12px',cursor:'pointer',fontWeight:600}}>🖼️ Default ♂</button>
      </div>
      <input style={inp} value={f.foto||''} onChange={set('foto')} placeholder='https://...'/>
    </Fld>
    <Fld label='Ex jugadora (vincular)'><select style={inp} value={f.id_jugadora||''} onChange={set('id_jugadora')}>
      <option value=''>— Ninguna —</option>
      {(players||[]).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(p=><option key={p.id_jugadora} value={p.id_jugadora}>{p.nombre}</option>)}
    </select></Fld>
    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'8px'}}>
      <button onClick={onCancel} style={{background:'#f1f5f9',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.nombre} style={{background:'#9333ea',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
    </div>
  </div>);
}

/* ── CoachSeasonForm ─────────────────────────────────────── */
function CoachSeasonForm({initial,equipos,ligas,onSave,onCancel,saving}){
  const [f,setF]=useState({id_equipo:'',id_liga:'',temporada:'',orden:0,...initial});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:'100%',border:'1.5px solid #e2e8f0',borderRadius:'10px',padding:'9px 12px',fontSize:'14px',outline:'none',boxSizing:'border-box'};
  return(<div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
    <Fld label='Equipo *'><select style={inp} value={f.id_equipo} onChange={set('id_equipo')}>
      <option value=''>Seleccionar equipo...</option>
      {(equipos||[]).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(e=><option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>)}
    </select></Fld>
    <Fld label='Liga *'><select style={inp} value={f.id_liga} onChange={set('id_liga')}>
      <option value=''>Seleccionar liga...</option>
      {(ligas||[]).map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
    </select></Fld>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
      <Fld label='Temporada *'><input style={inp} value={f.temporada} onChange={set('temporada')} placeholder='2025-26'/></Fld>
      <Fld label='Orden'><input style={inp} type='number' value={f.orden||0} onChange={set('orden')} placeholder='0'/></Fld>
    </div>
    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'8px'}}>
      <button onClick={onCancel} style={{background:'#f1f5f9',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.id_equipo||!f.id_liga||!f.temporada} style={{background:'#9333ea',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
    </div>
  </div>);
}

/* ── LeaguesView ─────────────────────────────────────────── */
function LeaguesView({ligas,players,equipos,palmares,coaches,tempCoach,partidos,onGoToTeam,onGoToClasificacion,isAdmin,onReload,openLigaId,onClearLiga,onGoToTab,navHistory,onGoBack,setLigas,regExtra,isFavFn,onToggleFav}){
  const [selId,setSelId]     = useState(openLigaId||null);
  useEffect(()=>{if(openLigaId){setSelId(openLigaId);onClearLiga&&onClearLiga();}},[openLigaId]);
  useEffect(()=>{const seg='ligas';window.history.replaceState({},"",selId?`/${seg}/${selId}`:`/${seg}`);},[selId]);
  const [selYear,setSelYear] = useState(null);
  const [search,setSearch]   = useState("");
  const [filterTipoLiga,setFilterTipoLiga] = useState("");
  const [filterPais,setFilterPais] = useState("");
  const allPaisesLiga = useMemo(()=>[...new Set(ligas.map(l=>l.pais).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")),[ligas]);
  const [ligaModal,setLigaModal] = useState(null);
  const [saving,setSaving]   = useState(false);
  const [delLiga,setDelLiga] = useState(false);

  const saveLiga=async(f)=>{
    setSaving(true);
    try{
      if(ligaModal==="add"){
        const ids=ligas.map(l=>parseInt(l.id_liga.replace("L",""))).filter(n=>!isNaN(n));
        const newId=firstFreeId(ids,"L",3);
        const newLiga={id_liga:newId,...f};
        const{error}=await supabase.from("ligas").insert(newLiga);
        if(error)throw error;
        setLigas(prev=>[...prev,newLiga]);
      } else {
        const{error}=await supabase.from("ligas").update(f).eq("id_liga",selId);
        if(error)throw error;
        setLigas(prev=>prev.map(l=>l.id_liga!==selId?l:{...l,...f}));
      }
      setLigaModal(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const delLigaFn=async()=>{
    try{const{error}=await supabase.from("ligas").delete().eq("id_liga",selId);
      if(error)throw error;
      setLigas(prev=>prev.filter(l=>l.id_liga!==selId));
      setSelId(null);setDelLiga(false);}catch(e){alert("Error: "+e.message);}
  };


  const equipoMap = useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap   = useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);
  const selected  = ligas.find(l=>l.id_liga===selId)||null;

  // Ligas grandes (p.ej. NCAA L020) están excluidas del preload global.
  // Al abrir la ficha, cargamos sus temporadas bajo demanda.
  const [extraTemp,setExtraTemp] = useState({});
  useEffect(()=>{
    if(!selected||extraTemp[selected.id_liga]) return;
    (async()=>{
      const {data}=await supabase.from("temporadas").select("id_jugadora,id_equipo,temporada").eq("id_liga",selected.id_liga).limit(20000);
      setExtraTemp(m=>({...m,[selected.id_liga]:data||[]}));
    })();
  },[selected]);

  const {years,teamsByYear} = useMemo(()=>{
    if(!selected) return {years:[],teamsByYear:{}};
    const yMap={};
    players.forEach(p=>(p.seasons||[]).forEach(s=>{
      if(s.id_liga!==selected.id_liga) return;
      if(!yMap[s.temporada]) yMap[s.temporada]=new Set();
      yMap[s.temporada].add(s.id_equipo);
    }));
    (extraTemp[selected.id_liga]||[]).forEach(t=>{
      if(!yMap[t.temporada]) yMap[t.temporada]=new Set();
      if(t.id_equipo) yMap[t.temporada].add(t.id_equipo);
    });
    // Temporadas que solo tienen partidos (sin rosters aún) también cuentan,
    // para poder llegar a su clasificación desde la ficha de la liga.
    (partidos||[]).forEach(p=>{
      if(p.id_liga!==selected.id_liga||!p.temporada) return;
      if(!yMap[p.temporada]) yMap[p.temporada]=new Set();
      if(p.id_equipo_local) yMap[p.temporada].add(p.id_equipo_local);
      if(p.id_equipo_visitante) yMap[p.temporada].add(p.id_equipo_visitante);
    });
    return {years:Object.keys(yMap).sort((a,b)=>b.localeCompare(a)),teamsByYear:yMap};
  },[selected,players,partidos,extraTemp]);

  const latestYear    = years[0]||null;
  const effectiveYear = selYear||latestYear;
  const teamIds       = effectiveYear?[...(teamsByYear[effectiveYear]||new Set())]:[];
  const teamsInLeague = teamIds.map(id=>equipoMap[id]).filter(Boolean).sort((a,b)=>a.nombre.localeCompare(b.nombre));

  const playersInYear = useMemo(()=>{
    if(!selected||!effectiveYear) return new Set();
    const s=new Set();
    players.forEach(p=>(p.seasons||[]).forEach(t=>{if(t.id_liga===selected.id_liga&&t.temporada===effectiveYear)s.add(p.id_jugadora);}));
    return s;
  },[selected,effectiveYear,players]);

  const filtered = ligas.filter(l=>!l.solo_partidos&&(!search||l.nombre?.toLowerCase().includes(search.toLowerCase()))&&(!filterTipoLiga||l.tipo===filterTipoLiga)&&(!filterPais||l.pais===filterPais));
  const ligasByTipo = useMemo(()=>{
    const g={liga:[],copacont:[],copadom:[],internacional:[],other:[]};
    filtered.forEach(l=>{if(g[l.tipo])g[l.tipo].push(l);else if(l.pais&&l.pais.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')!=="espana")g.internacional.push(l);else g.other.push(l);});
    return g;
  },[filtered]);

  if(selected){
    const [bg,color]=TIPO_COLORS[selected.tipo]||["#f1f5f9","#475569"];
    return(
      <div style={{maxWidth:"720px",margin:"0 auto",padding:"20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px"}}>
          {(()=>{const prev=navHistory&&navHistory.length>0?navHistory[navHistory.length-1]:null;return prev?(<button onClick={onGoBack} style={{background:"none",border:"none",color:"#c084fc",fontSize:"15px",cursor:"pointer",fontWeight:600,padding:0}}>← Volver a {prev.label}</button>):(<button onClick={()=>{setSelId(null);setSelYear(null);}} style={{background:"none",border:"none",color:"#c084fc",fontSize:"15px",cursor:"pointer",fontWeight:600,padding:0}}>← Volver</button>);})()}
          {isAdmin&&<div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>setLigaModal("edit")} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#475569"}}>✏️ Editar</button>
            <button onClick={()=>setDelLiga(true)} style={{background:"#fee2e2",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
          </div>}
        </div>
        {isAdmin&&delLiga&&<ConfirmDel msg="¿Eliminar esta liga?" onCancel={()=>setDelLiga(false)} onConfirm={delLigaFn}/>}
        {isAdmin&&ligaModal&&<Modal title={ligaModal==="add"?"Nueva liga":"Editar liga"} onClose={()=>setLigaModal(null)}>
          <LeagueForm initial={ligaModal!=="add"?selected:null} onSave={saveLiga} onCancel={()=>setLigaModal(null)} saving={saving}/>
        </Modal>}
        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"20px",flexWrap:"wrap"}}>
            <LeagueBadge liga={selected} size={72}/>
            <div style={{flex:1,minWidth:"180px"}}>
              <div><div style={{display:"flex",alignItems:"center",gap:"8px"}}><h1 style={{fontWeight:800,fontSize:"22px",color:"#1e293b",margin:"0 0 4px"}}>{selected.nombre}</h1>{onToggleFav&&<button onClick={e=>{e.stopPropagation();onToggleFav("liga",selected.id_liga);}} title={isFavFn?.("liga",selected.id_liga)?"Quitar de favoritos":"Añadir a favoritos"} style={{background:"none",border:"none",cursor:"pointer",fontSize:"20px",padding:0,lineHeight:1,flexShrink:0}}>{isFavFn?.("liga",selected.id_liga)?"⭐":"☆"}</button>}</div>{isAdmin&&<span style={{fontSize:"11px",color:"#94a3b8",fontFamily:"monospace"}}>{selected.id_liga}</span>}</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {selected.pais&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center"}}><FlagImg country={selected.pais}/>{selected.pais}</span>}
                {selected.pais2&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center"}}><FlagImg country={selected.pais2}/>{selected.pais2}</span>}
                {selected.pais3&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center"}}><FlagImg country={selected.pais3}/>{selected.pais3}</span>}
                {selected.tipo&&<span style={{background:bg,color,fontSize:"12px",fontWeight:700,padding:"3px 10px",borderRadius:"20px"}}>{TIPO_LABELS[selected.tipo]||selected.tipo}</span>}
                {selected.nivel&&<span style={{background:"#f1f5f9",color:"#64748b",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px"}}>División {selected.nivel}</span>}
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginTop:"18px"}}>
            {[[years.length,"Temporadas registradas"],[teamsInLeague.length,`Equipos ${effectiveYear||""}`],[playersInYear.size,`Jugadoras ${effectiveYear||""}`]].map(([v,l])=>(
              <div key={l} style={{background:"#f8fafc",borderRadius:"12px",padding:"12px",textAlign:"center"}}>
                <div style={{fontSize:"22px",fontWeight:800,color:"#1e293b"}}>{v}</div>
                <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}}>
            <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:0}}>Equipos <span style={{color:"#94a3b8",fontWeight:400,fontSize:"14px"}}>({teamsInLeague.length})</span></h2>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              {(partidos||[]).some(p=>p.id_liga===selId&&(p.temporada||"")===(effectiveYear||""))&&(
                <button onClick={()=>onGoToClasificacion&&onGoToClasificacion(selId,effectiveYear)}
                  style={{background:"#f5f3ff",color:"#7c3aed",border:"1.5px solid #ddd6fe",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>
                  🏆 Clasificación
                </button>
              )}
              {years.length>0&&<select value={effectiveYear||""} onChange={e=>setSelYear(e.target.value||null)} style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none"}}>
                {years.map(y=><option key={y} value={y}>{y}{y===latestYear?" (actual)":""}</option>)}
              </select>}
            </div>
          </div>
          {teamsInLeague.length===0
            ?<div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}><div style={{fontSize:"32px",marginBottom:"10px"}}>🏟️</div><div>Sin equipos para esta temporada</div></div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"10px"}}>
              {teamsInLeague.map(eq=>{
                const esCampeon=(palmares||[]).some(p=>p.id_liga===selId&&p.id_equipo===eq.id_equipo&&p.temporada===effectiveYear);
                return(
                <div key={eq.id_equipo} onClick={()=>onGoToTeam(eq.id_equipo,effectiveYear,{tab:"ligas",id:selId,label:selected?.nombre})}
                  style={{background:esCampeon?"#fffbeb":"#f8fafc",borderRadius:"14px",padding:"14px",border:esCampeon?"1.5px solid #fbbf24":"1.5px solid #e2e8f0",display:"flex",alignItems:"center",gap:"12px",cursor:"pointer",transition:"all 0.15s",position:"relative"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#c084fc";e.currentTarget.style.background="#fff7ed";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=esCampeon?"#fbbf24":"#e2e8f0";e.currentTarget.style.background=esCampeon?"#fffbeb":"#f8fafc";}}>
                  <TeamBadge team={eq} size={40}/>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:"13px",color:"#9333ea",lineHeight:"1.3",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{eq.nombre}</div>
                    <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px",display:"flex",alignItems:"center"}}><FlagImg country={eq.pais||""}/>{eq.pais||""}</div>
                  </div>
                  {esCampeon&&<span title={`Campeón ${effectiveYear}`} style={{position:"absolute",bottom:"8px",right:"10px",fontSize:"18px"}}>🏆</span>}
                </div>
                );
              })}
            </div>}
        </div>
        {(()=>{
          const pal=(palmares||[]).filter(p=>p.id_liga===selId).sort((a,b)=>b.temporada.localeCompare(a.temporada));
          if(!pal.length)return null;
          return(
            <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginTop:"14px"}}>
              <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:"0 0 14px"}}>🏆 Campeones por temporada <span style={{color:"#94a3b8",fontWeight:400,fontSize:"14px"}}>({pal.length})</span></h2>
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {pal.map((p,i)=>{
                  const eq=equipoMap[p.id_equipo];
                  return(
                    <div key={i} onClick={()=>onGoToTeam(eq?.id_equipo,effectiveYear,{tab:"ligas",id:selId,label:selected?.nombre})}
                      style={{display:"flex",alignItems:"center",gap:"14px",padding:"10px 14px",background:"#fffbeb",borderRadius:"12px",border:"1.5px solid #fed7aa",cursor:"pointer",transition:"all 0.15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.background="#fef3c7";e.currentTarget.style.borderColor="#f59e0b";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="#fffbeb";e.currentTarget.style.borderColor="#fed7aa";}}>
                      <span style={{fontWeight:800,fontSize:"14px",color:"#b45309",minWidth:"72px"}}>{p.temporada}</span>
                      <TeamBadge team={eq} size={32}/>
                      <span style={{fontWeight:700,fontSize:"14px",color:"#1e293b"}}>{eq?.nombre||p.id_equipo}</span>
                      {eq?.pais&&<span style={{marginLeft:"auto",display:"flex",alignItems:"center"}}><FlagImg country={eq.pais}/></span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  const GRUPOS=[["liga","Liga"],["copacont","Copa Continental"],["copadom","Copa Nacional"],["internacional","Internacional"],["other","Otras"]];
  return(
    <div className="bfdb-container" style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>

      {isAdmin&&ligaModal==="add"&&<Modal title="Nueva liga" onClose={()=>setLigaModal(null)}><LeagueForm onSave={saveLiga} onCancel={()=>setLigaModal(null)} saving={saving}/></Modal>}
      <div style={{minHeight:"112px"}}>
      <div style={{display:"flex",gap:"8px",marginBottom:"14px",flexWrap:"wrap",alignItems:"stretch"}}>
        <input style={{flex:"1 1 180px",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",color:"#1e293b",outline:"none",background:"#fff",height:"40px",boxSizing:"border-box"}}
          placeholder="🔍 Buscar liga..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select value={filterTipoLiga} onChange={e=>setFilterTipoLiga(e.target.value)} style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterTipoLiga?"#9333ea":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterTipoLiga?700:400,maxWidth:"100%"}}>
          <option value="">Tipo</option>
          <option value="liga">Liga</option>
          <option value="copadom">Copa Nacional</option>
          <option value="copacont">Copa Continental</option>
          <option value="internacional">Internacional</option>
        </select>
        <PaisDropdown allPaises={allPaisesLiga} filterPais={filterPais} setFilterPais={setFilterPais} placeholder="País"/>
        {isAdmin&&<button onClick={()=>setLigaModal("add")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"10px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer",whiteSpace:"nowrap"}}>+ Liga</button>}
      </div>
      </div>
      {GRUPOS.map(([tipo,label])=>{
        const items=ligasByTipo[tipo]||[];
        if(!items.length) return null;
        const [bg,color]=TIPO_COLORS[tipo]||["#f1f5f9","#475569"];
        return(
          <div key={tipo} style={{marginBottom:"24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
              <span style={{background:bg,color,fontSize:"12px",fontWeight:700,padding:"4px 12px",borderRadius:"20px"}}>{label}</span>
              <span style={{fontSize:"12px",color:"#94a3b8"}}>{items.length} competición{items.length!==1?"es":""}</span>
            </div>
            <div className="bfdb-cards-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"10px"}}>
              {items.map(l=>{
                const teamSet=new Set(),yearSet=new Set();
                players.forEach(p=>(p.seasons||[]).forEach(s=>{if(s.id_liga===l.id_liga){teamSet.add(s.id_equipo);yearSet.add(s.temporada);}}));
                return(
                  <div key={l.id_liga} onClick={()=>{setSelId(l.id_liga);setSelYear(null);window.scrollTo({top:0,behavior:"smooth"});}}
                    style={{background:"#fff",borderRadius:"16px",padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",border:"2px solid transparent",transition:"all 0.15s",display:"flex",alignItems:"center",gap:"14px"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.10)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
                    <LeagueBadge liga={l} size={52}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:"14px",color:"#1e293b",lineHeight:"1.3"}}>{l.nombre}</div>
                      <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"3px",display:"flex",alignItems:"center",gap:"2px"}}><MultiFlag countries={[l.pais,l.pais2,l.pais3]}/>{!l.pais&&"—"}</div>
                      <div style={{display:"flex",gap:"6px",marginTop:"6px"}}>
                        <span style={{background:"#f1f5f9",color:"#475569",fontSize:"10px",fontWeight:600,padding:"2px 8px",borderRadius:"20px"}}>{teamSet.size} equipos</span>
                        <span style={{background:"#f1f5f9",color:"#475569",fontSize:"10px",fontWeight:600,padding:"2px 8px",borderRadius:"20px"}}>{yearSet.size} temporadas</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── CoachesView ────────────────────────────────────────── */
function CoachesView({coaches,tempCoach,equipos,ligas,players,palmares,onGoToPlayer,onGoToTeam,openCoachId,onClearCoach,isAdmin,onReload,onGoToTab,navHistory,onGoBack,setCoaches,setTempCoach,equiposNombres,regExtra}){
  const [coachModal,setCoachModal]=useState(null);
  const [seasonModal,setSeasonModal]=useState(null);
  const [saving2,setSaving2]=useState(false);
  const [delCoachItem,setDelCoachItem]=useState(null);

  const saveCoach=async(f)=>{
    setSaving2(true);
    try{
      if(coachModal==="add"){
        const ids=coaches.map(c=>parseInt((c.id_coach||"").replace("C",""))).filter(n=>!isNaN(n));
        const newId=firstFreeId(ids,"C",3);
        const newCoach={id_coach:newId,...f,id_jugadora:f.id_jugadora||null};
        const{error}=await supabase.from("coach").insert(newCoach);
        if(error)throw error;
        setCoaches(prev=>[...prev,newCoach]);
      } else {
        const payload={...f,id_jugadora:f.id_jugadora||null};
        const{error}=await supabase.from("coach").update(payload).eq("id_coach",coachModal.id_coach);
        if(error)throw error;
        setCoaches(prev=>prev.map(c=>c.id_coach!==coachModal.id_coach?c:{...c,...payload}));
      }
      setCoachModal(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving2(false);
  };
  const delCoachFn=async(id)=>{
    try{const{error}=await supabase.from("coach").delete().eq("id_coach",id);
      if(error)throw error;
      setCoaches(prev=>prev.filter(c=>c.id_coach!==id));
      setDelCoachItem(null);}catch(e){alert("Error: "+e.message);}
  };
  const saveCoachSeason=async(f,coachId)=>{
    setSaving2(true);
    try{
      if(seasonModal==="add"){
        const {data}=await supabase.from("temporadas_coach").select("id").order("id",{ascending:false}).limit(1);
        const newId=(data?.[0]?.id||0)+1;
        const newRow={id:newId,id_coach:coachId,...f,orden:parseInt(f.orden)||0};
        const{error}=await supabase.from("temporadas_coach").insert(newRow);
        if(error)throw error;
        setTempCoach(prev=>[...prev,newRow]);
      } else {
        const payload={...f,orden:parseInt(f.orden)||0};
        const{error}=await supabase.from("temporadas_coach").update(payload).eq("id",seasonModal.id);
        if(error)throw error;
        setTempCoach(prev=>prev.map(tc=>tc.id!==seasonModal.id?tc:{...tc,...payload}));
      }
      setSeasonModal(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving2(false);
  };
  const delCoachSeason=async(id)=>{
    try{const{error}=await supabase.from("temporadas_coach").delete().eq("id",id);
      if(error)throw error;
      setTempCoach(prev=>prev.filter(tc=>tc.id!==id));
      setDelCoachItem(null);}catch(e){alert("Error: "+e.message);}
  };

  const [search,setSearch]=useState("");
  const [selId,setSelId]  =useState(openCoachId||null);
  const [shareMsg,setShareMsg]=useState(false);
  const [lightboxPhoto,setLightboxPhoto]=useState(null);
  useEffect(()=>{const seg='coaches';window.history.replaceState({},"",selId?`/${seg}/${selId}`:`/${seg}`);},[selId]);
  const [filterNac,setFilterNac]=useState("");
  const [filterLiga,setFilterLiga]=useState("");
  const [filterPais,setFilterPais]=useState("");
  useEffect(()=>{if(openCoachId){setSelId(openCoachId);onClearCoach();}},[openCoachId]);
  const equipoMap=useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap  =useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);
  const playerMap=useMemo(()=>{const m={};players.forEach(p=>m[String(p.id_jugadora)]=p);return m;},[players]);
  const filtered=useMemo(()=>(coaches||[]).filter(c=>!search||c.nombre.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es")),[coaches,search]);
  const allNacs=useMemo(()=>[...new Set((coaches||[]).flatMap(c=>[c.nacionalidad,c.nacionalidad2]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")),[coaches]);
  const allLigas=useMemo(()=>[...new Set((tempCoach||[]).map(tc=>ligaMap[tc.id_liga]?.nombre).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")),[tempCoach,ligaMap]);
  const allPaisesCoach=useMemo(()=>[...new Set((coaches||[]).flatMap(c=>[c.nacionalidad,c.nacionalidad2]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")),[coaches]);
  const filteredList=useMemo(()=>filtered.filter(coach=>{
    if(filterNac&&coach.nacionalidad!==filterNac&&coach.nacionalidad2!==filterNac)return false;
    if(filterLiga&&!(tempCoach||[]).some(tc=>tc.id_coach===coach.id_coach&&ligaMap[tc.id_liga]?.nombre===filterLiga))return false;
    if(filterPais&&coach.nacionalidad!==filterPais&&coach.nacionalidad2!==filterPais)return false;
    return true;
  }),[filtered,filterNac,filterLiga,filterPais,tempCoach,ligaMap]);

  /* ── DETAIL ── */
  if(selId){
    const coach=(coaches||[]).find(c=>c.id_coach===selId);
    if(!coach)return null;
    const coachSeasons=(tempCoach||[]).filter(tc=>tc.id_coach===coach.id_coach).sort((a,b)=>b.temporada.localeCompare(a.temporada)||parseInt(b.orden||0)-parseInt(a.orden||0));
    const isExPlayer=!!coach.id_jugadora;
    const playerProfile=isExPlayer?playerMap[String(coach.id_jugadora)]:null;
    const age=coach.fecha_nac?Math.floor((new Date()-new Date(coach.fecha_nac))/(365.25*24*3600*1000)):null;
    return(
      <div style={{maxWidth:"880px",margin:"0 auto",padding:"20px",display:"flex",flexDirection:"column",gap:"16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
        {(()=>{const prev=navHistory&&navHistory.length>0?navHistory[navHistory.length-1]:null;return prev?(<button onClick={onGoBack} style={{background:"transparent",border:"none",color:"#9333ea",fontWeight:700,fontSize:"14px",cursor:"pointer",padding:"4px 0"}}>← Volver a {prev.label}</button>):(<button onClick={()=>setSelId(null)} style={{background:"transparent",border:"none",color:"#9333ea",fontWeight:700,fontSize:"14px",cursor:"pointer",padding:"4px 0"}}>← Volver</button>);})()}
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <button onClick={()=>{
            const url=`${window.location.origin}/coaches/${coach.id_coach}`;
            const banderasShareCoach=[countryFlagEmoji(coach.nacionalidad),countryFlagEmoji(coach.nacionalidad2)].filter(Boolean).join(" ");
            const shareTextCoach=banderasShareCoach?`${coach.nombre} · ${banderasShareCoach} — La Basketneta`:`Ficha de ${coach.nombre} en La Basketneta`;
            if(navigator.share){navigator.share({title:coach.nombre,text:shareTextCoach,url}).catch(()=>{});}
            else{navigator.clipboard.writeText(url);setShareMsg(true);setTimeout(()=>setShareMsg(false),2000);}
          }} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#475569"}}>📤 Compartir</button>
          {shareMsg&&<span style={{fontSize:"12px",color:"#16a34a",fontWeight:600}}>¡Enlace copiado!</span>}
          {isAdmin&&<>
          <div style={{display:"flex",gap:"8px"}}>
          <button onClick={()=>setCoachModal(coach)} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#475569"}}>✏️ Editar</button>
          <button onClick={()=>setDelCoachItem({type:"coach",id:coach.id_coach})} style={{background:"#fee2e2",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
          </div>
          </>}
        </div>
      </div>
      {isAdmin&&delCoachItem?.type==="coach"&&<ConfirmDel msg="¿Eliminar este coach?" onCancel={()=>setDelCoachItem(null)} onConfirm={()=>delCoachFn(delCoachItem.id)}/>}
      {isAdmin&&delCoachItem?.type==="season"&&<ConfirmDel msg="¿Eliminar esta temporada?" onCancel={()=>setDelCoachItem(null)} onConfirm={()=>delCoachSeason(delCoachItem.id)}/>}
      {isAdmin&&coachModal&&<Modal title={coachModal==="add"?"Nuevo coach":"Editar coach"} onClose={()=>setCoachModal(null)}>
        <CoachForm initial={coachModal!=="add"?coachModal:null} players={players} onSave={saveCoach} onCancel={()=>setCoachModal(null)} saving={saving2}/>
      </Modal>}
      {isAdmin&&seasonModal&&<Modal title={seasonModal==="add"?"Añadir temporada":"Editar temporada"} onClose={()=>setSeasonModal(null)}>
        <CoachSeasonForm initial={seasonModal!=="add"?seasonModal:null} equipos={equipos} ligas={ligas} onSave={f=>saveCoachSeason(f,coach.id_coach)} onCancel={()=>setSeasonModal(null)} saving={saving2}/>
      </Modal>}
        {/* Header */}
        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:"20px",flexWrap:"wrap"}}>
            <Avatar photo={coach.foto} name={coach.nombre} size={80} fontSize={28} onPhotoClick={setLightboxPhoto}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"10px"}}>
                <div><h1 style={{fontWeight:800,fontSize:"21px",color:"#1e293b",margin:0}}>{coach.nombre}</h1>{isAdmin&&<span style={{fontSize:"11px",color:"#94a3b8",fontFamily:"monospace"}}>{coach.id_coach}</span>}</div>
                {(()=>{
                  const titles={};const seen=new Set();
                  const uniquePairs=[...new Map(coachSeasons.map(s=>[s.id_equipo+"_"+s.temporada,s])).values()];
                  uniquePairs.forEach(s=>{
                    (palmares||[]).filter(p=>p.id_equipo===s.id_equipo&&p.temporada===s.temporada).forEach(p=>{
                      if(seen.has(p.id))return;seen.add(p.id);
                      const n=ligaMap[p.id_liga]?.nombre||p.id_liga;
                      titles[n]=(titles[n]||0)+1;
                    });
                  });
                  const entries=Object.entries(titles);
                  if(!entries.length)return null;
                  return(<div style={{display:"flex",flexDirection:"column",gap:"4px",alignItems:"flex-end",flexShrink:1,minWidth:0,maxWidth:"100%"}}>{entries.map(([n,c])=>(<span key={n} title={`${c}x ${n}`} style={{background:"#fffbeb",border:"1.5px solid #fed7aa",color:"#b45309",fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"20px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%",boxSizing:"border-box"}}>🏆 {c}x {n}</span>))}</div>);
                })()}
              </div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"10px"}}>
                {isExPlayer&&<span style={{background:"#dbeafe",color:"#1d4ed8",fontSize:"12px",fontWeight:700,padding:"3px 10px",borderRadius:"20px"}}>Ex jugadora</span>}
                {(coach.nacionalidad||coach.nacionalidad2)&&(
                  <span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center",gap:"4px"}}>
                    {coach.nacionalidad&&<FlagImg country={coach.nacionalidad}/>}
                    {coach.nacionalidad2&&<FlagImg country={coach.nacionalidad2}/>}
                  </span>
                )}
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
                <div style={{display:"grid",gridTemplateColumns:"auto auto",gap:"6px 20px",fontSize:"13px",color:"#64748b"}}>
                  {age&&<span>Edad: <strong style={{color:"#1e293b"}}>{age} años</strong></span>}
                  <span>Temporadas: <strong style={{color:"#1e293b"}}>{coachSeasons.length}</strong></span>
                </div>
                {isExPlayer&&playerProfile&&(
                  <button onClick={()=>onGoToPlayer(coach.id_jugadora,{tab:"cuerpo_tecnico",id:selId,label:coach?.nombre})}
                    style={{background:"#fff7ed",color:"#c2410c",border:"1.5px solid #fed7aa",borderRadius:"20px",padding:"4px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"4px",flexShrink:0}}>
                    🏀 Jugadora
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Historial unificado */}
        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          {(()=>{
            const playSeasonsRaw=playerProfile?[...(playerProfile.seasons||[])]:[];
            const playSeasons=playSeasonsRaw.map(s=>({...s,_type:"player"}));
            const coachS=coachSeasons.map(s=>({...s,_type:"coach"}));
            const merged=[...playSeasons,...coachS].sort((a,b)=>b.temporada.localeCompare(a.temporada));
            const hasPlay=playSeasons.length>0;
            const total=merged.length;
            return(
              <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}><h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:0}}>Historial <span style={{color:"#94a3b8",fontWeight:400,fontSize:"14px"}}>({total})</span></h2>{isAdmin&&<button onClick={()=>setSeasonModal("add")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Temporada</button>}</div>
                {hasPlay&&<div style={{display:"flex",gap:"12px",marginBottom:"12px",fontSize:"12px",color:"#64748b",alignItems:"center"}}>
                  <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:10,borderRadius:"50%",background:"#9333ea",display:"inline-block"}}/> Jugadora</span>
                  <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:10,borderRadius:"50%",background:"#3b82f6",display:"inline-block"}}/> Entrenadora</span>
                </div>}
                {merged.length===0
                  ?<div style={{textAlign:"center",padding:"30px",color:"#94a3b8",fontSize:"14px"}}>Sin temporadas registradas</div>
                  :<div style={{position:"relative"}}>
                    <div style={{position:"absolute",left:"11px",top:"10px",bottom:"10px",width:"2px",background:hasPlay?"linear-gradient(to bottom,#fed7aa,#bfdbfe)":"#bfdbfe"}}/>
                    <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                      {merged.map((s,i)=>{
                        const isCoach=s._type==="coach";
                        const eq=equipoMap[s.id_equipo],lig=ligaMap[s.id_liga];
                        const dotColor=isCoach?"#3b82f6":"#9333ea";
                        return(
                          <div key={(isCoach?"c":"p")+s.id} style={{display:"flex",gap:"16px",alignItems:"flex-start",paddingLeft:"32px",position:"relative"}}>
                            <div style={{position:"absolute",left:"6px",top:"14px",width:"12px",height:"12px",borderRadius:"50%",background:dotColor,border:"3px solid #fff",boxShadow:`0 0 0 2px ${dotColor}`}}/>
                            <div style={{flex:1,background:isCoach?"#eff6ff":"#f8fafc",borderRadius:"12px",padding:"12px 14px",border:`1.5px solid ${isCoach?"#bfdbfe":"#e2e8f0"}`,cursor:"pointer"}}
                              onClick={()=>onGoToTeam(s.id_equipo,s.temporada,{tab:"cuerpo_tecnico",id:selId,label:coach?.nombre})}
                              onMouseEnter={e=>{e.currentTarget.style.background=isCoach?"#dbeafe":"#fff7ed";e.currentTarget.style.borderColor=isCoach?"#93c5fd":"#c084fc";}}
                              onMouseLeave={e=>{e.currentTarget.style.background=isCoach?"#eff6ff":"#f8fafc";e.currentTarget.style.borderColor=isCoach?"#bfdbfe":"#e2e8f0";}}>
                              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                                <TeamBadge team={eq} size={30}/>
                                <div style={{flex:1}}>
                                  <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                                    <span style={{fontWeight:700,fontSize:"14px",color:"#1e293b"}}>{s.temporada} · </span>
                                    <span style={{color:isCoach?"#3b82f6":"#9333ea",fontWeight:700,textDecoration:"underline"}}>{resolveTeamName(s.id_equipo,s.temporada,equiposNombres,equipoMap)||s.id_equipo}</span>
                                    {isCoach&&<span style={{background:"#dbeafe",color:"#1d4ed8",fontSize:"10px",fontWeight:700,padding:"1px 6px",borderRadius:"20px"}}>📋 Coach</span>}
                                  </div>
                                  <div style={{fontSize:"12px",color:"#64748b",marginTop:"2px",display:"flex",alignItems:"center",gap:"4px"}}>{lig&&<MultiFlag countries={[lig.pais,lig.pais2,lig.pais3]}/>}{lig?.nombre||s.id_liga}</div>
                                </div>
                                {isAdmin&&<div style={{display:"flex",gap:"4px",flexShrink:0}} onClick={e=>e.stopPropagation()}>
                                  <button onClick={()=>setSeasonModal(s)} title="Editar" style={{background:"#f1f5f9",border:"none",borderRadius:"6px",padding:"4px 8px",fontSize:"12px",cursor:"pointer",color:"#475569"}}>✏️</button>
                                  <button onClick={()=>setDelCoachItem({type:"season",id:s.id})} title="Eliminar" style={{background:"#fee2e2",border:"none",borderRadius:"6px",padding:"4px 8px",fontSize:"12px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
                                </div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>}
              </>
            );
          })()}
        </div>
        {lightboxPhoto&&<PhotoLightbox photo={lightboxPhoto} onClose={()=>setLightboxPhoto(null)}/>}
      </div>
    );
  }

  /* ── LIST ── */
  return(
    <div style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>

      <div style={{minHeight:"112px"}}>
      <div style={{display:"flex",gap:"8px",marginBottom:"14px",flexWrap:"wrap",alignItems:"stretch"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Nombre de entrenador..."
          style={{flex:"1 1 180px",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",color:"#1e293b",outline:"none",background:"#fff",height:"40px",boxSizing:"border-box"}}/>
        <select style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterLiga?"#9333ea":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterLiga?700:400,maxWidth:"100%"}} value={filterLiga} onChange={e=>setFilterLiga(e.target.value)}>
          <option value="">Liga</option>
          {allLigas.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        <PaisDropdown allPaises={allPaisesCoach} filterPais={filterNac} setFilterPais={setFilterNac} placeholder="Nacionalidad"/>
      </div>
      </div>
      {isAdmin&&coachModal==="add"&&<Modal title="Nuevo coach" onClose={()=>setCoachModal(null)}><CoachForm players={players} onSave={saveCoach} onCancel={()=>setCoachModal(null)} saving={saving2}/></Modal>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
        <span style={{fontSize:"13px",color:"#94a3b8"}}>{filteredList.length} entrenador{filteredList.length!==1?"es":"a"}</span>
        {isAdmin&&<button onClick={()=>setCoachModal("add")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Coach</button>}
      </div>
      <div className="bfdb-cards-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"12px"}}>
        {filteredList.map(coach=>{
          const coachSeasons=(tempCoach||[]).filter(tc=>tc.id_coach===coach.id_coach).sort((a,b)=>b.temporada.localeCompare(a.temporada)||parseInt(b.orden||0)-parseInt(a.orden||0));
          const lastSeason=coachSeasons[0];
          const lastEq=lastSeason?equipoMap[lastSeason.id_equipo]:null;
          const lastLig=lastSeason?ligaMap[lastSeason.id_liga]:null;
          const isExPlayer=!!coach.id_jugadora;
          return(
            <div key={coach.id_coach} onClick={()=>{setSelId(coach.id_coach);window.scrollTo({top:0,behavior:"smooth"});}}
              style={{background:"#fff",borderRadius:"16px",padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",border:"2px solid transparent",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#3b82f6";e.currentTarget.style.boxShadow="0 4px 18px rgba(59,130,246,0.18)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"12px"}}>
                <Avatar photo={coach.foto} name={coach.nombre} size={48} fontSize={18}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:"15px",color:"#1e293b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{coach.nombre}</div>
                  <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"1px",display:"flex",alignItems:"center",gap:"3px"}}>
                    {coach.nacionalidad&&<FlagImg country={coach.nacionalidad}/>}
                    {coach.nacionalidad2&&<FlagImg country={coach.nacionalidad2}/>}
                  </div>
                </div>
                {isExPlayer&&<span style={{background:"#dbeafe",color:"#1d4ed8",fontSize:"10px",fontWeight:700,padding:"2px 7px",borderRadius:"20px",flexShrink:0}}>ex jugadora</span>}
              </div>
              <div style={{borderTop:"1px solid #f1f5f9",paddingTop:"10px"}}>
                {lastEq?(<>
                  <div style={{fontSize:"11px",color:"#94a3b8",marginBottom:"4px"}}>Último equipo</div>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <TeamBadge team={lastEq} size={26}/>
                    <div>
                      <div style={{fontSize:"13px",fontWeight:600,color:"#334155"}}>{lastSeason.temporada} · {lastEq.nombre}</div>
                      <div style={{fontSize:"11px",color:"#94a3b8"}}>{lastLig?.nombre||lastSeason.id_liga}</div>
                    </div>
                  </div>
                </>):<div style={{fontSize:"12px",color:"#cbd5e1",fontStyle:"italic"}}>Sin temporadas</div>}
              </div>
              <div style={{marginTop:"10px",fontSize:"12px",color:"#3b82f6",fontWeight:600}}>{coachSeasons.length} temporada{coachSeasons.length!==1?"s":""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Landing ────────────────────────────────────────────── */
function Landing({onEnter,players,equipos,ligas,coaches,tempCoach,palmares,regExtra}){
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:"20px"}}>
      <div style={{maxWidth:"560px",width:"100%",textAlign:"center"}}>
        <div style={{marginBottom:"28px"}}>
          <img src="/icon-home.png" alt="La Basketneta" style={{height:"120px",objectFit:"contain"}}/>
        </div>
        <div style={{fontSize:"14px",color:"#94a3b8",marginBottom:"36px",fontWeight:500}}>Base de datos del baloncesto femenino</div>
        {players&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:"14px",padding:"16px 20px",marginBottom:"16px",border:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{fontWeight:700,fontSize:"12px",color:"#94a3b8",marginBottom:"12px",textTransform:"uppercase",letterSpacing:"0.5px"}}>La Basketneta en números</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
            {[["👩‍🏀",(players||[]).length,"Jugadoras"],["🏟️",(equipos||[]).length,"Equipos"],["🏆",(ligas||[]).length,"Ligas"],["📋",(coaches||[]).length,"Coaches"],["📊",(players||[]).flatMap(p=>p.seasons||[]).length,"Fichajes"],["🗂️",((players||[]).length+(equipos||[]).length+(ligas||[]).length+(coaches||[]).length+(players||[]).flatMap(p=>p.seasons||[]).length+(tempCoach||[]).length+(palmares||[]).length+(regExtra||0)).toLocaleString("es"),"Registros"]].map(([icon,val,label])=>(
              <div key={label} style={{textAlign:"center",padding:"8px 4px"}}>
                <div style={{fontSize:"14px"}}>{icon}</div>
                <div style={{fontSize:"18px",fontWeight:800,color:"#f1f5f9"}}>{typeof val==="number"?val.toLocaleString("es"):val}</div>
                <div style={{fontSize:"10px",color:"#64748b"}}>{label}</div>
              </div>
            ))}
          </div>
        </div>}
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:"14px",padding:"16px 20px",marginBottom:"24px",border:"1px solid rgba(255,255,255,0.07)",textAlign:"left"}}>
          <div style={{fontWeight:700,fontSize:"12px",color:"#94a3b8",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Aviso legal</div>
          <p style={{fontSize:"12px",color:"#64748b",lineHeight:"1.6",margin:0}}>
            Los datos mostrados en esta aplicación son de carácter público y han sido obtenidos de fuentes oficiales como webs de federaciones deportivas. Esta plataforma no tiene ánimo de lucro y su uso es exclusivamente informativo. Si eres jugadora, entrenadora o representante de algún club y deseas solicitar la modificación o eliminación de tus datos, contacta con nosotros en <span style={{color:"#9333ea",fontWeight:600}}>labasketneta@gmail.com</span>.
          </p>
        </div>
        <button onClick={onEnter}
          style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"14px",padding:"14px 40px",fontSize:"15px",fontWeight:800,cursor:"pointer",width:"100%",letterSpacing:"0.3px",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="#7c3aed"}
          onMouseLeave={e=>e.currentTarget.style.background="#9333ea"}>
          Entrar a la base de datos →
        </button>
        <div style={{fontSize:"11px",color:"#475569",marginTop:"12px"}}>
          Al acceder aceptas el uso informativo de los datos según se describe arriba.
        </div>
      </div>
    </div>
  );
}

/* ── FavoritosView ─────────────────────────────────────── */
function FavoritosView({players,equipos,ligas,partidos,favoritos,user,onGoToPlayer,onGoToTeam,onGoToLeague,onGoToPartido,isFavFn,onToggleFav}){
  const [filtro,setFiltro]=useState("todo"); // todo | jugadora | equipo | liga
  const [favBoxscores,setFavBoxscores]=useState({});
  const favJugIds=useMemo(()=>favoritos.filter(f=>f.tipo==="jugadora").map(f=>f.id_referencia),[favoritos]);
  useEffect(()=>{
    if(!favJugIds.length)return;
    (async()=>{
      const map={};
      for(const jid of favJugIds){
        // Buscar el partido más reciente por fecha donde jugó
        const {data:boxes}=await supabase.from("partido_boxscore").select("*").eq("id_jugadora",jid).limit(50);
        if(boxes&&boxes.length){
          const pIds=[...new Set(boxes.map(b=>b.id_partido))];
          const {data:partis}=await supabase.from("partidos").select("id,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante,fecha_hora,id_liga").in("id",pIds).not("resultado_local","is",null).order("fecha_hora",{ascending:false}).limit(1);
          if(partis&&partis[0]){
            const partido=partis[0];
            const box=boxes.find(b=>b.id_partido===partido.id);
            if(box)map[jid]={box,partido};
          }
        }
      }
      setFavBoxscores(map);
    })();
  },[favJugIds.join(",")]);
  const equipoMap=useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap=useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);

  const favEquipos=favoritos.filter(f=>f.tipo==="equipo").map(f=>f.id_referencia);
  const favJugadoras=favoritos.filter(f=>f.tipo==="jugadora").map(f=>f.id_referencia);
  const favLigas=favoritos.filter(f=>f.tipo==="liga").map(f=>f.id_referencia);

  const hoy=new Date();
  const anio=hoy.getMonth()>=8?hoy.getFullYear():hoy.getFullYear()-1;
  const currentSeason=`${anio}-${String((anio+1)%100).padStart(2,"0")}`;

  if(!favoritos.length)return(
    <div className="bfdb-container" style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      <div style={{background:"#fff",borderRadius:"16px",padding:"40px 24px",border:"1px solid #e2e8f0",textAlign:"center"}}>
        <div style={{fontSize:"48px",marginBottom:"12px"}}>⭐</div>
        <div style={{fontWeight:800,fontSize:"18px",color:"#1e293b",marginBottom:"8px"}}>Aún no tienes favoritos</div>
        <div style={{fontSize:"14px",color:"#94a3b8",maxWidth:"400px",margin:"0 auto"}}>Marca jugadoras, equipos o ligas con la estrella ☆ en sus fichas para ver aquí sus próximos partidos, resultados y fichajes.</div>
      </div>
    </div>
  );

  // ── Datos de jugadoras ──
  const jugCards=favJugadoras.map(jid=>{
    const p=players.find(x=>x.id_jugadora===jid);if(!p)return null;
    const fbData=favBoxscores[jid];
    const lastBox=fbData?.box||null;
    const partido=fbData?.partido||null;
    let rivalEq=null;
    if(lastBox&&partido){const rivalId=partido.id_equipo_local===lastBox.id_equipo?partido.id_equipo_visitante:partido.id_equipo_local;rivalEq=equipoMap[rivalId];}
    return{player:p,lastBox,rivalEq,partido};
  }).filter(Boolean);

  // ── Datos de equipos ──
  const eqCards=favEquipos.map(eid=>{
    const eq=equipoMap[eid];if(!eq)return null;
    const comps=[...new Set((partidos||[]).filter(p=>(p.id_equipo_local===eid||p.id_equipo_visitante===eid)&&p.temporada===currentSeason).map(p=>p.id_liga))].map(lid=>ligaMap[lid]).filter(Boolean);
    const ultPartido=(partidos||[]).filter(p=>(p.id_equipo_local===eid||p.id_equipo_visitante===eid)&&p.resultado_local!=null).sort((a,b)=>new Date(b.fecha_hora)-new Date(a.fecha_hora))[0];
    const proxPartido=(partidos||[]).filter(p=>(p.id_equipo_local===eid||p.id_equipo_visitante===eid)&&p.resultado_local==null&&p.fecha_hora&&new Date(p.fecha_hora)>hoy).sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora))[0];
    const ultFichaje=players.flatMap(pl=>(pl.seasons||[]).filter(ss=>ss.id_equipo===eid).map(ss=>({player:pl,...ss}))).sort((a,b)=>{
      const ta=(a.temporada||"").replace("-",".");const tb=(b.temporada||"").replace("-",".");
      if(ta!==tb)return tb.localeCompare(ta);
      return(b.id||0)-(a.id||0);
    })[0];
    return{eq,comps,ultPartido,proxPartido,ultFichaje};
  }).filter(Boolean);

  // ── Datos de ligas ──
  const ligaCards=favLigas.map(lid=>{
    const liga=ligaMap[lid];if(!liga)return null;
    const ps=(partidos||[]).filter(p=>p.id_liga===lid&&p.temporada===currentSeason);
    const jugados=ps.filter(p=>p.resultado_local!=null);
    const noJugados=ps.filter(p=>p.resultado_local==null&&p.fecha_hora);
    // Última jornada: los partidos jugados más recientes del mismo día
    const ultFecha=jugados.length?jugados.sort((a,b)=>new Date(b.fecha_hora)-new Date(a.fecha_hora))[0]?.fecha_hora:null;
    const ultJornada=ultFecha?jugados.filter(p=>{const d1=new Date(p.fecha_hora),d2=new Date(ultFecha);return Math.abs(d1-d2)<3*24*60*60*1000;}).sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora)):[];
    // Próxima jornada
    const proxFecha=noJugados.length?noJugados.sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora))[0]?.fecha_hora:null;
    const proxJornada=proxFecha?noJugados.filter(p=>{const d1=new Date(p.fecha_hora),d2=new Date(proxFecha);return Math.abs(d1-d2)<3*24*60*60*1000;}).sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora)):[];
    // Clasificación compacta
    const calcClasi=()=>{
      const t={};
      jugados.filter(p=>p.notas&&/jornada/i.test(p.notas)).forEach(p=>{
        [p.id_equipo_local,p.id_equipo_visitante].forEach(eid=>{if(!t[eid])t[eid]={id:eid,v:0,d:0,pts:0};});
        const gl=Number(p.resultado_local),gv=Number(p.resultado_visitante);
        if(gl>gv){t[p.id_equipo_local].v++;t[p.id_equipo_visitante].d++;}
        else if(gv>gl){t[p.id_equipo_visitante].v++;t[p.id_equipo_local].d++;}
        t[p.id_equipo_local].pts+=gl;t[p.id_equipo_visitante].pts+=gv;
      });
      return Object.values(t).sort((a,b)=>(b.v-b.d)-(a.v-a.d)||(b.v-a.v));
    };
    const clasi=calcClasi();
    return{liga,ultJornada,proxJornada,clasi};
  }).filter(Boolean);

  const MiniPartido=({p,showLiga})=>{
    const tL=equipoMap[p.id_equipo_local]||{},tV=equipoMap[p.id_equipo_visitante]||{};
    const played=p.resultado_local!=null;
    const d=p.fecha_hora?new Date(p.fecha_hora):null;
    return(
      <div onClick={()=>onGoToPartido(p)} style={{display:"flex",alignItems:"center",gap:"4px",padding:"4px 0",cursor:"pointer",fontSize:"12px"}} title={`${tL.nombre||"?"} vs ${tV.nombre||"?"}`}>
        {tL.escudo?<img src={tL.escudo} alt="" style={{width:18,height:18,objectFit:"contain"}}/>:<span style={{width:18,textAlign:"center"}}>•</span>}
        <span style={{fontWeight:played&&Number(p.resultado_local)>Number(p.resultado_visitante)?700:400,color:"#1e293b",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}/>
        <span style={{fontWeight:700,color:"#7c3aed",fontSize:"12px",flexShrink:0}}>{played?`${p.resultado_local}-${p.resultado_visitante}`:d?`${d.getDate()}/${d.getMonth()+1}`:"-"}</span>
        <span style={{fontWeight:played&&Number(p.resultado_visitante)>Number(p.resultado_local)?700:400,color:"#1e293b",flex:1}}/>
        {tV.escudo?<img src={tV.escudo} alt="" style={{width:18,height:18,objectFit:"contain"}}/>:<span style={{width:18,textAlign:"center"}}>•</span>}
      </div>
    );
  };

  return(
    <div className="bfdb-container" style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      {/* Filtros */}
      <div style={{display:"flex",gap:"8px",marginBottom:"20px",flexWrap:"wrap"}}>
        {[["todo","⭐ Todo"],["jugadora","👩‍🏀 Jugadoras"],["equipo","🏟️ Equipos"],["liga","🏆 Ligas"]].map(([k,label])=>(
          <button key={k} onClick={()=>setFiltro(k)} style={{background:filtro===k?"#9333ea":"#fff",color:filtro===k?"#fff":"#475569",border:filtro===k?"none":"1.5px solid #e2e8f0",borderRadius:"20px",padding:"8px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
        ))}
      </div>

      {/* ── JUGADORAS ── */}
      {(filtro==="todo"||filtro==="jugadora")&&jugCards.map(({player:p,lastBox,rivalEq,partido})=>{
        const liga=partido?ligaMap[partido.id_liga]:null;
        const resultado=partido?(partido.id_equipo_local===lastBox?.id_equipo?`${partido.resultado_local}-${partido.resultado_visitante}`:`${partido.resultado_visitante}-${partido.resultado_local}`):null;
        return(
        <div key={p.id_jugadora} style={{background:"#fff",borderRadius:"16px",padding:"16px",border:"1px solid #e2e8f0",marginBottom:"16px"}}>
          <div onClick={()=>onGoToPlayer(p.id_jugadora)} style={{display:"flex",alignItems:"center",gap:"14px",cursor:"pointer",marginBottom:lastBox?"12px":"0"}}>
            <Avatar photo={p.foto} name={p.nombre} size={52} fontSize={18}/>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:"16px",color:"#1e293b"}}>{p.nombre}</div>
              {rivalEq&&<div style={{fontSize:"13px",color:"#475569",fontWeight:600}}>vs {rivalEq.nombre}{resultado?" · "+resultado:""}</div>}
              {liga&&<div style={{fontSize:"11px",color:"#9333ea",fontWeight:600}}>{liga.nombre}</div>}
            </div>
          </div>
          {lastBox&&<div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            {[["PTS",lastBox.puntos],["REB",lastBox.reb_totales],["AST",lastBox.asistencias],["ROB",lastBox.robos],["MIN",lastBox.minutos],["VAL",lastBox.valoracion]].map(([k,v])=>(
              <div key={k} style={{background:"#f8fafc",borderRadius:"10px",padding:"8px 12px",textAlign:"center",flex:"1 0 48px"}}>
                <div style={{fontSize:"16px",fontWeight:800,color:"#7c3aed"}}>{v||0}</div>
                <div style={{fontSize:"10px",fontWeight:700,color:"#94a3b8"}}>{k}</div>
              </div>
            ))}
          </div>}
        </div>
        );})}

      {/* ── EQUIPOS ── */}
      {(filtro==="todo"||filtro==="equipo")&&eqCards.map(({eq,comps,ultPartido,proxPartido,ultFichaje})=>(
        <div key={eq.id_equipo} style={{background:"#fff",borderRadius:"16px",padding:"16px",border:"1px solid #e2e8f0",marginBottom:"16px"}}>
          <div onClick={()=>onGoToTeam(eq.id_equipo)} style={{display:"flex",alignItems:"center",gap:"12px",cursor:"pointer",marginBottom:"12px"}}>
            {eq.escudo?<img src={eq.escudo} alt="" style={{width:44,height:44,objectFit:"contain"}}/>:<div style={{width:44,height:44,borderRadius:"10px",background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px"}}>🏟️</div>}
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:"16px",color:"#1e293b"}}>{eq.nombre}</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"4px"}}>
                {comps.map(l=><span key={l.id_liga} onClick={e=>{e.stopPropagation();onGoToLeague(l.id_liga);}} style={{fontSize:"10px",fontWeight:700,color:"#9333ea",background:"#faf5ff",padding:"2px 8px",borderRadius:"10px",cursor:"pointer"}}>{l.nombre}</span>)}
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:ultFichaje?"12px":"0"}}>
            <div>
              <div style={{fontSize:"11px",fontWeight:700,color:"#94a3b8",marginBottom:"6px"}}>ÚLTIMO PARTIDO</div>
              {ultPartido?<><div style={{fontSize:"10px",color:"#9333ea",fontWeight:600,marginBottom:"2px"}}>{ligaMap[ultPartido.id_liga]?.nombre||""}</div><MiniPartido p={ultPartido}/></>:<div style={{fontSize:"12px",color:"#cbd5e1"}}>—</div>}
            </div>
            <div>
              <div style={{fontSize:"11px",fontWeight:700,color:"#94a3b8",marginBottom:"6px"}}>PRÓXIMO PARTIDO</div>
              {proxPartido?<><div style={{fontSize:"10px",color:"#9333ea",fontWeight:600,marginBottom:"2px"}}>{ligaMap[proxPartido.id_liga]?.nombre||""}</div><MiniPartido p={proxPartido}/></>:<div style={{fontSize:"12px",color:"#cbd5e1"}}>—</div>}
            </div>
          </div>
          {ultFichaje&&<div style={{borderTop:"1px solid #f1f5f9",paddingTop:"10px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:"#94a3b8",marginBottom:"4px"}}>ÚLTIMO FICHAJE</div>
            <div onClick={()=>onGoToPlayer(ultFichaje.id_jugadora)} style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer"}}>
              <Avatar photo={ultFichaje.player?.foto} name={ultFichaje.player?.nombre} size={28} fontSize={11}/>
              <span style={{fontSize:"13px",fontWeight:700,color:"#1e293b"}}>{ultFichaje.player?.nombre}</span>
            </div>
          </div>}
        </div>
      ))}

      {/* ── LIGAS ── */}
      {(filtro==="todo"||filtro==="liga")&&ligaCards.map(({liga,ultJornada,proxJornada,clasi})=>(
        <div key={liga.id_liga} style={{background:"#fff",borderRadius:"16px",padding:"16px",border:"1px solid #e2e8f0",marginBottom:"16px"}}>
          <div onClick={()=>onGoToLeague(liga.id_liga)} style={{fontWeight:800,fontSize:"16px",color:"#1e293b",cursor:"pointer",marginBottom:"12px"}}>{liga.nombre}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
            <div>
              <div style={{fontSize:"11px",fontWeight:700,color:"#94a3b8",marginBottom:"6px"}}>ÚLTIMA JORNADA</div>
              {ultJornada.slice(0,7).map(p=><MiniPartido key={p.id} p={p}/>)}
              {!ultJornada.length&&<div style={{fontSize:"12px",color:"#cbd5e1"}}>—</div>}
            </div>
            <div>
              <div style={{fontSize:"11px",fontWeight:700,color:"#94a3b8",marginBottom:"6px"}}>PRÓXIMA JORNADA</div>
              {proxJornada.slice(0,7).map(p=><MiniPartido key={p.id} p={p}/>)}
              {!proxJornada.length&&<div style={{fontSize:"12px",color:"#cbd5e1"}}>—</div>}
            </div>
          </div>
          {clasi.length>0&&<div>
            <div style={{fontSize:"11px",fontWeight:700,color:"#94a3b8",marginBottom:"6px"}}>CLASIFICACIÓN</div>
            <div style={{display:"flex",flexDirection:"column",gap:"2px"}}>
              {clasi.slice(0,16).map((r,i)=>{const eq=equipoMap[r.id];return(
                <div key={r.id} style={{display:"flex",alignItems:"center",gap:"6px",padding:"3px 4px",fontSize:"11px"}}>
                  <span style={{width:"16px",fontWeight:700,color:"#94a3b8",textAlign:"right"}}>{i+1}</span>
                  {eq?.escudo?<img src={eq.escudo} alt="" title={eq.nombre} style={{width:16,height:16,objectFit:"contain"}}/>:<span style={{width:16,textAlign:"center",fontSize:"8px"}}>•</span>}
                  <span style={{fontWeight:700,color:"#16a34a",width:"24px",textAlign:"center"}}>{r.v}</span>
                  <span style={{fontWeight:700,color:"#ef4444",width:"24px",textAlign:"center"}}>{r.d}</span>
                </div>
              );})}
            </div>
          </div>}
        </div>
      ))}
    </div>
  );
}

/* ── PrivacidadView ─────────────────────────────────────── */
function PrivacidadView({onBack}){
  return(
    <div style={{maxWidth:"720px",margin:"0 auto",padding:"24px 20px"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#9333ea",fontWeight:700,fontSize:"13px",cursor:"pointer",padding:"0 0 16px",display:"flex",alignItems:"center",gap:"4px"}}>{"← Volver"}</button>
      <h1 style={{fontWeight:800,fontSize:"24px",color:"#1e293b",margin:"0 0 8px"}}>{"Política de Privacidad"}</h1>
      <p style={{fontSize:"13px",color:"#94a3b8",margin:"0 0 24px"}}>{"Última actualización: julio 2026"}</p>
      <div style={{display:"flex",flexDirection:"column",gap:"20px",fontSize:"14px",color:"#475569",lineHeight:"1.7"}}>
        <div><h2 style={{fontWeight:700,fontSize:"16px",color:"#1e293b",margin:"0 0 8px"}}>{"1. Quién somos"}</h2><p style={{margin:0}}>{"La Basketneta (labasketneta.app) es una aplicación web dedicada a la recopilación y visualización de estadísticas de baloncesto femenino. Es un proyecto independiente sin ánimo de lucro."}</p></div>
        <div><h2 style={{fontWeight:700,fontSize:"16px",color:"#1e293b",margin:"0 0 8px"}}>{"2. Qué datos recogemos"}</h2><p style={{margin:0}}>{"Cuando creas una cuenta o inicias sesión con Google, recogemos únicamente: tu dirección de correo electrónico, tu nombre y foto de perfil (si inicias sesión con Google), y tus selecciones de favoritos (jugadoras, equipos y ligas). No recogemos datos de navegación, ubicación, ni ningún otro tipo de información personal."}</p></div>
        <div><h2 style={{fontWeight:700,fontSize:"16px",color:"#1e293b",margin:"0 0 8px"}}>{"3. Para qué usamos tus datos"}</h2><p style={{margin:0}}>{"Permitirte iniciar sesión, guardar y mostrar tus favoritos, y personalizar tu página de inicio con información relevante."}</p></div>
        <div><h2 style={{fontWeight:700,fontSize:"16px",color:"#1e293b",margin:"0 0 8px"}}>{"4. Con quién compartimos tus datos"}</h2><p style={{margin:0}}>{"No compartimos, vendemos ni cedemos tus datos personales a terceros bajo ninguna circunstancia. Tus datos se almacenan de forma segura en Supabase (infraestructura en la Unión Europea)."}</p></div>
        <div><h2 style={{fontWeight:700,fontSize:"16px",color:"#1e293b",margin:"0 0 8px"}}>{"5. Cuánto tiempo conservamos tus datos"}</h2><p style={{margin:0}}>{"Tus datos se conservan mientras mantengas tu cuenta activa. Puedes solicitar la eliminación de tu cuenta y todos los datos asociados en cualquier momento contactando con nosotros."}</p></div>
        <div><h2 style={{fontWeight:700,fontSize:"16px",color:"#1e293b",margin:"0 0 8px"}}>{"6. Tus derechos"}</h2><p style={{margin:0}}>{"De acuerdo con el Reglamento General de Protección de Datos (RGPD), tienes derecho a acceder a tus datos personales, rectificar datos inexactos, solicitar la eliminación de tus datos y retirar tu consentimiento en cualquier momento."}</p></div>
        <div><h2 style={{fontWeight:700,fontSize:"16px",color:"#1e293b",margin:"0 0 8px"}}>{"7. Seguridad"}</h2><p style={{margin:0}}>{"Utilizamos medidas de seguridad estándar de la industria para proteger tus datos, incluyendo cifrado en tránsito (HTTPS), autenticación segura y políticas de acceso a nivel de fila (Row Level Security) en la base de datos."}</p></div>
        <div><h2 style={{fontWeight:700,fontSize:"16px",color:"#1e293b",margin:"0 0 8px"}}>{"8. Contacto"}</h2><p style={{margin:0}}>{"Los datos mostrados en esta aplicación son de carácter público y han sido obtenidos de fuentes oficiales como webs de federaciones deportivas. Esta plataforma no tiene ánimo de lucro y su uso es exclusivamente informativo. Si eres jugadora, entrenadora o representante de algún club y deseas solicitar la modificación o eliminación de tus datos, o para cualquier consulta relacionada con tu privacidad, contacta con nosotros en: "}<a href="mailto:labasketneta@gmail.com" style={{color:"#9333ea",fontWeight:600}}>{"labasketneta@gmail.com"}</a></p></div>
      </div>
    </div>
  );
}

/* ── LoginModal ─────────────────────────────────────────── */
function LoginModal({onLogin,onGoogleLogin,onClose,loading,error,mode,setMode}){
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const isReg=mode==="register";
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#1e293b",borderRadius:"20px",padding:"32px",width:"340px",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
        <div style={{textAlign:"center",marginBottom:"24px"}}>
          <div style={{fontSize:"32px",marginBottom:"8px"}}>🏀</div>
          <div style={{fontWeight:800,fontSize:"18px",color:"#f1f5f9"}}>{isReg?"Crear cuenta":"Iniciar sesión"}</div>
          <div style={{fontSize:"12px",color:"#94a3b8",marginTop:"4px"}}>Guarda tus jugadoras y equipos favoritos</div>
        </div>
        <button onClick={onGoogleLogin}
          style={{width:"100%",background:"#fff",color:"#1e293b",border:"none",borderRadius:"10px",padding:"11px",fontWeight:700,fontSize:"14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",marginBottom:"16px"}}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuar con Google
        </button>
        <div style={{display:"flex",alignItems:"center",gap:"12px",margin:"16px 0"}}>
          <div style={{flex:1,height:"1px",background:"#334155"}}/><span style={{color:"#64748b",fontSize:"12px"}}>o</span><div style={{flex:1,height:"1px",background:"#334155"}}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}
            style={{background:"#0f172a",border:"1.5px solid #334155",borderRadius:"10px",padding:"10px 14px",fontSize:"14px",color:"#f1f5f9",outline:"none"}}
            onKeyDown={e=>e.key==="Enter"&&onLogin(email,pass)}/>
          <input type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)}
            style={{background:"#0f172a",border:"1.5px solid #334155",borderRadius:"10px",padding:"10px 14px",fontSize:"14px",color:"#f1f5f9",outline:"none"}}
            onKeyDown={e=>e.key==="Enter"&&onLogin(email,pass)}/>
          {error&&<div style={{color:"#f87171",fontSize:"12px",textAlign:"center"}}>{error}</div>}
          <button onClick={()=>onLogin(email,pass)} disabled={loading}
            style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",fontWeight:700,fontSize:"14px",cursor:"pointer"}}>
            {loading?(isReg?"Creando...":"Entrando..."):(isReg?"Crear cuenta":"Entrar")}
          </button>
        </div>
        <div style={{textAlign:"center",marginTop:"16px",fontSize:"12px",color:"#94a3b8"}}>
          {isReg?"¿Ya tienes cuenta? ":"¿No tienes cuenta? "}
          <span onClick={()=>setMode(isReg?"login":"register")} style={{color:"#a78bfa",cursor:"pointer",fontWeight:700}}>{isReg?"Inicia sesión":"Regístrate"}</span>
        </div>
        <div style={{textAlign:"center",marginTop:"12px"}}><a href="/privacidad" target="_blank" style={{fontSize:"11px",color:"#64748b",textDecoration:"none"}}>Política de privacidad</a></div>
      </div>
    </div>
  );
}

/* ── Avatar (preset | URL | fallback) ────────────────────── */
const AVATAR_PRESETS=[
  {k:"basket", e:"🏀", bg:"linear-gradient(135deg,#f97316,#ea580c)"},
  {k:"star",   e:"⭐", bg:"linear-gradient(135deg,#eab308,#ca8a04)"},
  {k:"fire",   e:"🔥", bg:"linear-gradient(135deg,#ef4444,#b91c1c)"},
  {k:"target", e:"🎯", bg:"linear-gradient(135deg,#0ea5e9,#0369a1)"},
  {k:"crown",  e:"👑", bg:"linear-gradient(135deg,#a855f7,#7e22ce)"},
  {k:"gem",    e:"💎", bg:"linear-gradient(135deg,#06b6d4,#0e7490)"},
  {k:"rocket", e:"🚀", bg:"linear-gradient(135deg,#8b5cf6,#6d28d9)"},
  {k:"gold",   e:"🥇", bg:"linear-gradient(135deg,#fbbf24,#d97706)"},
  {k:"lion",   e:"🦁", bg:"linear-gradient(135deg,#f59e0b,#b45309)"},
  {k:"wolf",   e:"🐺", bg:"linear-gradient(135deg,#64748b,#334155)"},
  {k:"heart",  e:"❤️", bg:"linear-gradient(135deg,#f43f5e,#be123c)"},
  {k:"peace",  e:"✌️", bg:"linear-gradient(135deg,#10b981,#047857)"},
];
function UserAvatar({avatar,googleUrl,nombre,size=64}){
  const preset=avatar?.startsWith("preset:")?AVATAR_PRESETS.find(p=>p.k===avatar.slice(7)):null;
  const url=avatar&&!avatar.startsWith("preset:")?avatar:(!avatar?googleUrl:null);
  const style={width:size,height:size,borderRadius:"50%",flexShrink:0};
  if(preset) return <div style={{...style,background:preset.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.55}}>{preset.e}</div>;
  if(url) return <img src={url} alt="" style={{...style,objectFit:"cover"}}/>;
  const inicial=(nombre||"?")[0]?.toUpperCase()||"?";
  return <div style={{...style,background:"linear-gradient(135deg,#9333ea,#c084fc)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:size*0.4,fontWeight:800}}>{inicial}</div>;
}

/* ── PerfilView (vista dedicada de perfil) ───────────────── */
function PerfilView({user,favoritos,onClose,onLogout}){
  const [alias,setAlias]=useState("");
  const [aliasMsg,setAliasMsg]=useState("");
  const [savingAlias,setSavingAlias]=useState(false);
  const [counts,setCounts]=useState({basketneta:0,bola:0});
  const [avatar,setAvatar]=useState(null);
  const [avatarMsg,setAvatarMsg]=useState("");
  const [uploading,setUploading]=useState(false);
  const [confirmStep,setConfirmStep]=useState(0);
  const [confirmText,setConfirmText]=useState("");
  const [deleting,setDeleting]=useState(false);
  const [deleteErr,setDeleteErr]=useState("");

  useEffect(()=>{(async()=>{
    const {data:pf}=await supabase.from("perfiles").select("alias,avatar").eq("id",user.id).maybeSingle();
    setAlias(pf?.alias||"");
    setAvatar(pf?.avatar||null);
    const [bn,bo]=await Promise.all([
      supabase.from("basketneta_predicciones").select("*",{count:"exact",head:true}).eq("user_id",user.id),
      supabase.from("bola_cristal_predicciones").select("*",{count:"exact",head:true}).eq("user_id",user.id),
    ]);
    setCounts({basketneta:bn.count||0,bola:bo.count||0});
  })();},[user.id]);

  const saveAvatar=async(val)=>{
    const {error}=await supabase.from("perfiles").update({avatar:val}).eq("id",user.id);
    if(error){setAvatarMsg("Error");return;}
    setAvatar(val);setAvatarMsg("Avatar actualizado ✓");setTimeout(()=>setAvatarMsg(""),1500);
  };

  const subirFoto=async(e)=>{
    const f=e.target.files?.[0];e.target.value="";
    if(!f) return;
    if(!f.type.startsWith("image/")){setAvatarMsg("No es imagen");return;}
    if(f.size>2*1024*1024){setAvatarMsg("Máx 2 MB");return;}
    setUploading(true);
    const ext=(f.name.split(".").pop()||"png").toLowerCase();
    const path=`${user.id}/avatar_${Date.now()}.${ext}`;
    const {error:upErr}=await supabase.storage.from("avatars").upload(path,f,{cacheControl:"3600",upsert:false});
    if(upErr){setUploading(false);setAvatarMsg("Error subida: "+upErr.message);return;}
    const {data:{publicUrl}}=supabase.storage.from("avatars").getPublicUrl(path);
    await saveAvatar(publicUrl);
    setUploading(false);
  };

  const guardarAlias=async()=>{
    setSavingAlias(true);
    const v=(alias||"").trim().slice(0,24);
    const {error}=await supabase.from("perfiles").update({alias:v||null}).eq("id",user.id);
    setSavingAlias(false);
    setAliasMsg(error?"Error":"Guardado ✓");setTimeout(()=>setAliasMsg(""),1500);
  };

  const eliminarCuenta=async()=>{
    setDeleting(true);setDeleteErr("");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const jwt=session?.access_token;
      const supaUrl=supabase.supabaseUrl||supabase.rest.url.replace(/\/rest\/v1$/,"");
      const res=await fetch(`${supaUrl}/functions/v1/eliminar-mi-cuenta`,{
        method:"POST",
        headers:{Authorization:`Bearer ${jwt}`,"content-type":"application/json"},
      });
      const j=await res.json();
      if(!res.ok||!j.ok){setDeleteErr(j.error||"Error al eliminar");setDeleting(false);return;}
      await supabase.auth.signOut();
      window.location.reload();
    }catch(e){
      setDeleteErr(String(e));setDeleting(false);
    }
  };

  const favCount={
    jugadoras:(favoritos||[]).filter(f=>f.tipo==="jugadora").length,
    equipos:  (favoritos||[]).filter(f=>f.tipo==="equipo").length,
    ligas:    (favoritos||[]).filter(f=>f.tipo==="liga").length,
  };
  const nombreReal=user.user_metadata?.full_name||user.email?.split("@")[0]||"Usuario";

  return(
    <div style={{maxWidth:"640px",margin:"0 auto",padding:"12px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
        <h2 style={{margin:0,fontSize:"20px",fontWeight:800,color:"#1e293b"}}>👤 Mi perfil</h2>
        <button onClick={onClose} style={{background:"transparent",border:"none",fontSize:"20px",cursor:"pointer",color:"#64748b"}}>✕</button>
      </div>

      {/* cabecera con avatar */}
      <div style={{background:"#fff",borderRadius:"16px",padding:"18px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",marginBottom:"14px",display:"flex",gap:"14px",alignItems:"center"}}>
        <UserAvatar avatar={avatar} googleUrl={user.user_metadata?.avatar_url} nombre={nombreReal} size={64}/>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:"16px",fontWeight:800,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nombreReal}</div>
          <div style={{fontSize:"12px",color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
        </div>
      </div>

      {/* selector de avatar */}
      <div style={{background:"#fff",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",marginBottom:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:700,color:"#64748b",marginBottom:"10px"}}>Tu avatar</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(52px,1fr))",gap:"8px",marginBottom:"12px"}}>
          {AVATAR_PRESETS.map(p=>{
            const sel=avatar===`preset:${p.k}`;
            return(
              <button key={p.k} onClick={()=>saveAvatar(`preset:${p.k}`)}
                style={{width:48,height:48,borderRadius:"50%",background:p.bg,border:sel?"3px solid #9333ea":"3px solid transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"22px",cursor:"pointer",padding:0}}>
                {p.e}
              </button>
            );
          })}
        </div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          <label style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"8px",padding:"7px 12px",fontWeight:700,fontSize:"12px",cursor:uploading?"wait":"pointer",opacity:uploading?0.6:1}}>
            {uploading?"Subiendo…":"📷 Subir foto"}
            <input type="file" accept="image/*" onChange={subirFoto} disabled={uploading} style={{display:"none"}}/>
          </label>
          {(avatar||user.user_metadata?.avatar_url)&&(
            <button onClick={()=>saveAvatar(null)}
              style={{background:"#fff",color:"#64748b",border:"1px solid #e2e8f0",borderRadius:"8px",padding:"7px 12px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
              Usar el de Google
            </button>
          )}
        </div>
        {avatarMsg&&<div style={{fontSize:"11px",color:avatarMsg.startsWith("Error")||avatarMsg.startsWith("No")||avatarMsg.startsWith("Máx")?"#dc2626":"#16a34a",marginTop:"8px",fontWeight:700}}>{avatarMsg}</div>}
        <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"6px"}}>Elige un preset, sube tu foto (máx 2 MB) o vuelve al avatar de Google.</div>
      </div>

      {/* alias */}
      <div style={{background:"#fff",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",marginBottom:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:700,color:"#64748b",marginBottom:"6px"}}>Alias en el ranking de la quiniela</div>
        <div style={{display:"flex",gap:"8px"}}>
          <input type="text" maxLength={24} value={alias} onChange={e=>setAlias(e.target.value)}
            placeholder={nombreReal}
            style={{flex:1,padding:"8px 10px",borderRadius:"8px",border:"1px solid #cbd5e1",fontSize:"13px"}}/>
          <button onClick={guardarAlias} disabled={savingAlias}
            style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"8px",padding:"8px 14px",fontWeight:700,fontSize:"12px",cursor:"pointer",opacity:savingAlias?0.6:1}}>
            Guardar
          </button>
        </div>
        {aliasMsg&&<div style={{fontSize:"11px",color:"#16a34a",marginTop:"6px",fontWeight:700}}>{aliasMsg}</div>}
        <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"6px"}}>Déjalo vacío para usar tu nombre.</div>
      </div>

      {/* stats */}
      <div style={{background:"#fff",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",marginBottom:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:700,color:"#64748b",marginBottom:"10px"}}>Tu actividad</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:"10px"}}>
          {[
            {n:favCount.jugadoras,l:"⭐ Jugadoras",c:"#9333ea"},
            {n:favCount.equipos,l:"🏀 Equipos",c:"#9333ea"},
            {n:favCount.ligas,l:"🏆 Ligas",c:"#9333ea"},
            {n:counts.basketneta,l:"🏀 Pronóstico",c:"#0891b2"},
            {n:counts.bola,l:"🔮 Bola",c:"#0891b2"},
          ].map(s=>(
            <div key={s.l} style={{background:"#f8fafc",borderRadius:"10px",padding:"10px",textAlign:"center"}}>
              <div style={{fontSize:"22px",fontWeight:800,color:s.c,lineHeight:1}}>{s.n}</div>
              <div style={{fontSize:"11px",color:"#64748b",marginTop:"4px",fontWeight:600}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* logout */}
      <div style={{marginBottom:"14px"}}>
        <button onClick={onLogout}
          style={{width:"100%",background:"#fff",color:"#1e293b",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"12px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>
          Cerrar sesión
        </button>
      </div>

      {/* zona peligrosa */}
      <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:"12px",padding:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:800,color:"#991b1b",marginBottom:"6px"}}>⚠ Zona peligrosa</div>
        <div style={{fontSize:"12px",color:"#7f1d1d",marginBottom:"10px"}}>
          Borra permanentemente tu cuenta, alias, favoritos y predicciones. No se puede deshacer.
        </div>
        {confirmStep===0&&(
          <button onClick={()=>setConfirmStep(1)}
            style={{background:"#fff",color:"#991b1b",border:"1px solid #fca5a5",borderRadius:"8px",padding:"8px 14px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
            🗑 Eliminar mi cuenta
          </button>
        )}
        {confirmStep===1&&(
          <div>
            <div style={{fontSize:"12px",color:"#7f1d1d",fontWeight:700,marginBottom:"8px"}}>¿Seguro? Vamos al paso 2 de 2.</div>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>{setConfirmStep(2);setConfirmText("");}}
                style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:"8px",padding:"8px 14px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
                Continuar
              </button>
              <button onClick={()=>setConfirmStep(0)}
                style={{background:"#fff",color:"#64748b",border:"1px solid #e2e8f0",borderRadius:"8px",padding:"8px 14px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
                Cancelar
              </button>
            </div>
          </div>
        )}
        {confirmStep===2&&(
          <div>
            <div style={{fontSize:"12px",color:"#7f1d1d",fontWeight:700,marginBottom:"6px"}}>
              Escribe <code style={{background:"#fee2e2",padding:"1px 6px",borderRadius:"4px"}}>ELIMINAR</code> para confirmar.
            </div>
            <input type="text" value={confirmText} onChange={e=>setConfirmText(e.target.value)}
              placeholder="ELIMINAR"
              style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",borderRadius:"8px",border:"1px solid #fca5a5",fontSize:"13px",marginBottom:"8px"}}/>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={eliminarCuenta}
                disabled={confirmText!=="ELIMINAR"||deleting}
                style={{background:confirmText==="ELIMINAR"?"#dc2626":"#fca5a5",color:"#fff",border:"none",borderRadius:"8px",padding:"8px 14px",fontWeight:800,fontSize:"12px",cursor:confirmText==="ELIMINAR"?"pointer":"not-allowed",opacity:deleting?0.6:1}}>
                {deleting?"Eliminando…":"🗑 Eliminar definitivamente"}
              </button>
              <button onClick={()=>{setConfirmStep(0);setConfirmText("");}}
                disabled={deleting}
                style={{background:"#fff",color:"#64748b",border:"1px solid #e2e8f0",borderRadius:"8px",padding:"8px 14px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
                Cancelar
              </button>
            </div>
            {deleteErr&&<div style={{fontSize:"11px",color:"#991b1b",marginTop:"6px",fontWeight:700}}>{deleteErr}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── FlagSelect (combobox con bandera + búsqueda) ────────── */
function FlagSelect({value,options,onChange,disabled,placeholder,size}){
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const current=options.find(o=>o.id===value);
  const isSm=size==="sm";
  const fh=isSm?10:12,fw=isSm?14:16;
  const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  const nq=norm(q);
  const filtered=nq?options.filter(o=>norm(o.label).includes(nq)):options;
  const flag=url=>url
    ?<img src={url} alt="" style={{width:fw,height:fh,objectFit:"contain",flexShrink:0}}/>
    :<span style={{width:fw,height:fh,background:"#e2e8f0",borderRadius:2,flexShrink:0}}/>;
  const toggle=()=>{if(disabled)return;setOpen(o=>{const nv=!o;if(nv)setQ("");return nv;});};
  return(
    <div style={{position:"relative",flex:1,minWidth:0}}>
      <button type="button" onClick={toggle} disabled={disabled}
        style={{display:"flex",alignItems:"center",gap:"5px",width:"100%",textAlign:"left",
          padding:isSm?"4px 6px":"6px 8px",fontSize:isSm?"11px":"12px",
          border:"1px solid #cbd5e1",borderRadius:"6px",background:disabled?"#f1f5f9":"#fff",
          cursor:disabled?"not-allowed":"pointer"}}>
        {current?<>{flag(current.flagUrl)}<span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{current.label}</span></>
          :<span style={{color:"#94a3b8",flex:1}}>{placeholder||"—"}</span>}
        <span style={{fontSize:"9px",color:"#94a3b8"}}>▾</span>
      </button>
      {open&&(<>
        <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:30}}/>
        <div style={{position:"absolute",top:"calc(100% + 2px)",left:0,right:0,minWidth:"200px",background:"#fff",border:"1px solid #cbd5e1",borderRadius:"6px",zIndex:31,boxShadow:"0 6px 20px rgba(0,0,0,0.15)"}}>
          {options.length>=8&&(
            <input type="text" autoFocus value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Buscar…"
              style={{width:"100%",boxSizing:"border-box",padding:"6px 8px",fontSize:"12px",border:"none",borderBottom:"1px solid #e2e8f0",outline:"none"}}/>
          )}
          <div style={{maxHeight:"240px",overflowY:"auto"}}>
            <div onClick={()=>{onChange("");setOpen(false);}}
              style={{padding:"6px 8px",fontSize:"11px",color:"#94a3b8",cursor:"pointer",borderBottom:"1px solid #f1f5f9"}}>— sin elegir —</div>
            {filtered.map(o=>(
              <div key={o.id} onClick={()=>{onChange(o.id);setOpen(false);}}
                style={{display:"flex",alignItems:"center",gap:"6px",padding:"6px 8px",fontSize:"12px",cursor:"pointer",borderBottom:"1px solid #f8fafc"}}
                onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                {flag(o.flagUrl)}
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.label}</span>
              </div>
            ))}
            {filtered.length===0&&<div style={{padding:"10px",fontSize:"11px",color:"#94a3b8",textAlign:"center"}}>Sin resultados</div>}
          </div>
        </div>
      </>)}
    </div>
  );
}

/* ── BolaCristalView ─────────────────────────────────────── */
const BOLA_PREGUNTAS=[
  {id:"campeon",   label:"¿Quién será campeón?",         tipo:"equipo",   n:1, icon:"🏆", puntos:10},
  {id:"mvp",       label:"¿Quién será la MVP?",          tipo:"jugadora", n:1, icon:"⭐", puntos:10},
  {id:"top_scorer",label:"Máxima anotadora del torneo",  tipo:"jugadora", n:1, icon:"🎯", puntos:8},
  {id:"joven",     label:"Mejor jugadora joven",         tipo:"joven",    n:1, icon:"🌱", puntos:6},
  {id:"quinteto",  label:"Quinteto ideal",               tipo:"jugadora", n:5, icon:"🖐️", puntos:"3×"},
  {id:"t3pct",     label:"Mejor % T3",                   tipo:"jugadora", n:1, icon:"🏹", puntos:6},
  {id:"robos",     label:"Jugadora con más robos",       tipo:"jugadora", n:1, icon:"🥷", puntos:6},
];

// U22 al Mundial 2026: nacidas 2004-01-01 o después
const CORTE_JOVEN="2004-01-01";

function BolaCristalView({user,equipos,cierre}){
  const [equiposMundial,setEquiposMundial]=useState([]);
  const [jugadorasMundial,setJugadorasMundial]=useState([]);
  const [jovenesMundial,setJovenesMundial]=useState([]);
  const [drafts,setDrafts]=useState({});
  const [msg,setMsg]=useState("");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{(async()=>{
    const {data:ps}=await supabase.from("partidos")
      .select("id_equipo_local,id_equipo_visitante")
      .eq("id_liga","L055").eq("temporada","2026");
    const eqIds=new Set();
    (ps||[]).forEach(p=>{if(p.id_equipo_local)eqIds.add(p.id_equipo_local);if(p.id_equipo_visitante)eqIds.add(p.id_equipo_visitante);});
    const eqMap={},escMap={};(equipos||[]).forEach(e=>{eqMap[e.id_equipo]=e.nombre;escMap[e.id_equipo]=e.escudo;});
    setEquiposMundial([...eqIds].map(id=>({id,nombre:eqMap[id]||id,escudo:escMap[id]})).sort((a,b)=>a.nombre.localeCompare(b.nombre)));
    const {data:ts}=await supabase.from("temporadas")
      .select("id_jugadora,id_equipo,jugadoras(nombre,fecha_nac)")
      .eq("id_liga","L055").eq("temporada","2026");
    const js=(ts||[]).map(t=>({id:t.id_jugadora,nombre:t.jugadoras?.nombre||t.id_jugadora,fecha_nac:t.jugadoras?.fecha_nac,equipoNombre:eqMap[t.id_equipo]||t.id_equipo,equipoEscudo:escMap[t.id_equipo]}));
    js.sort((a,b)=>a.nombre.localeCompare(b.nombre));
    setJugadorasMundial(js);
    setJovenesMundial(js.filter(j=>j.fecha_nac&&j.fecha_nac>=CORTE_JOVEN));
    const {data:mios}=await supabase.from("bola_cristal_predicciones")
      .select("pregunta_id,respuesta_ids").eq("user_id",user.id).eq("id_liga","L055").eq("temporada","2026");
    const m={};(mios||[]).forEach(p=>{m[p.pregunta_id]=p.respuesta_ids;});
    setDrafts(m);
  })();},[user.id,equipos]);

  const cerrado=cierre&&new Date(cierre).getTime()<=Date.now();

  const guardarTodo=async()=>{
    setSaving(true);
    const filas=[];
    const borrar=[];
    for(const q of BOLA_PREGUNTAS){
      const clean=(drafts[q.id]||[]).filter(Boolean);
      if(clean.length>0) filas.push({user_id:user.id,id_liga:"L055",temporada:"2026",pregunta_id:q.id,respuesta_ids:clean});
      else borrar.push(q.id);
    }
    if(filas.length>0){
      await supabase.from("bola_cristal_predicciones").upsert(filas,{onConflict:"user_id,id_liga,temporada,pregunta_id"});
    }
    if(borrar.length>0){
      await supabase.from("bola_cristal_predicciones").delete()
        .eq("user_id",user.id).eq("id_liga","L055").eq("temporada","2026").in("pregunta_id",borrar);
    }
    setSaving(false);
    setMsg("✓ Guardado");setTimeout(()=>setMsg(""),1800);
  };

  const opciones=q=>q.tipo==="equipo"?equiposMundial:q.tipo==="joven"?jovenesMundial:jugadorasMundial;
  const toOpt=(q,o)=>q.tipo==="equipo"
    ?{id:o.id,label:o.nombre,flagUrl:o.escudo}
    :{id:o.id,label:`${o.nombre} (${o.equipoNombre})`,flagUrl:o.equipoEscudo};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
      <div style={{background:cerrado?"#fef2f2":"#f0fdf4",border:`1px solid ${cerrado?"#fecaca":"#bbf7d0"}`,borderRadius:"12px",padding:"12px 14px",fontSize:"12px",color:cerrado?"#991b1b":"#166534"}}>
        {cerrado
          ?<><b>🔒 Cerrado.</b> Cierre el {cierre?new Date(cierre).toLocaleString("es",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"—"}. Solo lectura.</>
          :<><b>🔮 Abierto.</b> Cierra al empezar el primer partido{cierre?": "+new Date(cierre).toLocaleString("es",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):""}. Máx 61 pts.</>}
      </div>
      {BOLA_PREGUNTAS.map(q=>{
        const ops=opciones(q);
        const val=drafts[q.id]||[];
        return(
          <div key={q.id} style={{background:"#fff",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"}}>
              <div style={{fontSize:"14px",fontWeight:700,color:"#1e293b"}}>{q.icon} {q.label}</div>
              <span style={{fontSize:"10px",color:"#94a3b8",fontWeight:700}}>{q.puntos} pt{q.puntos==="3×"?"":"s"}</span>
            </div>
            {q.n===1?(
              <FlagSelect value={val[0]||""} disabled={cerrado||ops.length===0}
                placeholder="— elegir —"
                options={ops.map(o=>toOpt(q,o))}
                onChange={v=>setDrafts(d=>({...d,[q.id]:v?[v]:[]}))}/>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                {Array.from({length:q.n}).map((_,i)=>(
                  <FlagSelect key={i} value={val[i]||""} disabled={cerrado||ops.length===0}
                    placeholder={`— posición ${i+1} —`}
                    options={ops.filter(o=>!val.includes(o.id)||o.id===val[i]).map(o=>toOpt(q,o))}
                    onChange={v=>{const nv=[...val];nv[i]=v;setDrafts(d=>({...d,[q.id]:nv}));}}/>
                ))}
              </div>
            )}
            {ops.length===0&&<div style={{fontSize:"11px",color:"#94a3b8",marginTop:"6px"}}>Sin opciones cargadas todavía.</div>}
          </div>
        );
      })}
      {!cerrado&&(
        <div style={{position:"sticky",bottom:"8px",display:"flex",gap:"10px",alignItems:"center",background:"#fff",borderRadius:"12px",padding:"12px 14px",boxShadow:"0 4px 14px rgba(0,0,0,0.08)"}}>
          <button onClick={guardarTodo} disabled={saving}
            style={{flex:1,background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"12px",fontWeight:800,fontSize:"14px",cursor:"pointer",opacity:saving?0.6:1}}>
            {saving?"Guardando…":"💾 Guardar bola de cristal"}
          </button>
          {msg&&<span style={{fontSize:"13px",color:"#16a34a",fontWeight:700}}>{msg}</span>}
        </div>
      )}
    </div>
  );
}

/* ── BasketnetaView ──────────────────────────────────────── */
const BN_GRUPOS=["A","B","C","D"];
const BN_BRACKET=[
  {slot:"playin_25",label:"Play-in #25",puntos:2,ronda:"playin"},
  {slot:"playin_26",label:"Play-in #26",puntos:2,ronda:"playin"},
  {slot:"playin_27",label:"Play-in #27",puntos:2,ronda:"playin"},
  {slot:"playin_28",label:"Play-in #28",puntos:2,ronda:"playin"},
  {slot:"qf_29",    label:"Cuartos #29",puntos:3,ronda:"qf"},
  {slot:"qf_30",    label:"Cuartos #30",puntos:3,ronda:"qf"},
  {slot:"qf_31",    label:"Cuartos #31",puntos:3,ronda:"qf"},
  {slot:"qf_32",    label:"Cuartos #32",puntos:3,ronda:"qf"},
  {slot:"sf_33",    label:"Semifinal #33",puntos:5,ronda:"sf"},
  {slot:"sf_34",    label:"Semifinal #34",puntos:5,ronda:"sf"},
  {slot:"final_36", label:"Final",puntos:10,ronda:"final"},
  {slot:"br_35",    label:"3er puesto",puntos:4,ronda:"br"},
];

// Devuelve [idA, idB] según lo que el user tenga en drafts; undefined si aún no
function bnParticipantes(slot, d){
  const g=(gr,pos)=>d[`grupo_${gr}_${pos}`];
  const w=(s)=>d[s];
  const part=(s)=>bnParticipantes(s,d);
  const loser=(s)=>{
    const p=part(s);const win=w(s);
    if(!p[0]||!p[1]||!win)return undefined;
    return p[0]===win?p[1]:p[0];
  };
  switch(slot){
    case "playin_25":return [g("A",2),g("B",3)];
    case "playin_26":return [g("B",2),g("A",3)];
    case "playin_27":return [g("C",2),g("D",3)];
    case "playin_28":return [g("D",2),g("C",3)];
    case "qf_29":return [g("A",1),w("playin_26")];
    case "qf_30":return [g("B",1),w("playin_25")];
    case "qf_31":return [g("C",1),w("playin_28")];
    case "qf_32":return [g("D",1),w("playin_27")];
    case "sf_33":return [w("qf_29"),w("qf_30")];
    case "sf_34":return [w("qf_31"),w("qf_32")];
    case "final_36":return [w("sf_33"),w("sf_34")];
    case "br_35":return [loser("sf_33"),loser("sf_34")];
    default:return [];
  }
}

function BasketnetaView({user,equipos,cierre}){
  const [equiposMundial,setEquiposMundial]=useState([]);
  const [gruposMap,setGruposMap]=useState({}); // {A:[{id,nombre}], B:..}
  const [drafts,setDrafts]=useState({}); // {[slot]: id_equipo}
  const [msg,setMsg]=useState("");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{(async()=>{
    const {data:ps}=await supabase.from("partidos")
      .select("notas,id_equipo_local,id_equipo_visitante")
      .eq("id_liga","L055").eq("temporada","2026");
    const eqMap={},escMap={};(equipos||[]).forEach(e=>{eqMap[e.id_equipo]=e.nombre;escMap[e.id_equipo]=e.escudo;});
    // grupos
    const gr={A:new Set(),B:new Set(),C:new Set(),D:new Set()};
    (ps||[]).forEach(p=>{
      const m=(p.notas||"").match(/Grupo ([ABCD])/);
      if(!m)return;
      if(p.id_equipo_local)gr[m[1]].add(p.id_equipo_local);
      if(p.id_equipo_visitante)gr[m[1]].add(p.id_equipo_visitante);
    });
    const g={};BN_GRUPOS.forEach(k=>{
      g[k]=[...gr[k]].map(id=>({id,nombre:eqMap[id]||id,escudo:escMap[id]})).sort((a,b)=>a.nombre.localeCompare(b.nombre));
    });
    setGruposMap(g);
    const todos=new Set();(ps||[]).forEach(p=>{if(p.id_equipo_local)todos.add(p.id_equipo_local);if(p.id_equipo_visitante)todos.add(p.id_equipo_visitante);});
    setEquiposMundial([...todos].map(id=>({id,nombre:eqMap[id]||id,escudo:escMap[id]})).sort((a,b)=>a.nombre.localeCompare(b.nombre)));
    const {data:mios}=await supabase.from("basketneta_predicciones")
      .select("slot,id_equipo").eq("user_id",user.id).eq("id_liga","L055").eq("temporada","2026");
    const d={};(mios||[]).forEach(r=>{d[r.slot]=r.id_equipo;});
    setDrafts(d);
  })();},[user.id,equipos]);

  const cerrado=cierre&&new Date(cierre).getTime()<=Date.now();

  const guardarTodo=async()=>{
    setSaving(true);
    const filas=[],borrar=[];
    // grupos
    BN_GRUPOS.forEach(g=>{
      for(let pos=1;pos<=4;pos++){
        const slot=`grupo_${g}_${pos}`;
        const v=drafts[slot];
        if(v) filas.push({user_id:user.id,id_liga:"L055",temporada:"2026",slot,id_equipo:v});
        else borrar.push(slot);
      }
    });
    // bracket: solo guarda si el pick sigue siendo un participante válido
    BN_BRACKET.forEach(b=>{
      const v=drafts[b.slot];
      const [a,c]=bnParticipantes(b.slot,drafts);
      const valido=v&&(v===a||v===c);
      if(valido) filas.push({user_id:user.id,id_liga:"L055",temporada:"2026",slot:b.slot,id_equipo:v});
      else borrar.push(b.slot);
    });
    if(filas.length>0){
      await supabase.from("basketneta_predicciones").upsert(filas,{onConflict:"user_id,id_liga,temporada,slot"});
    }
    if(borrar.length>0){
      await supabase.from("basketneta_predicciones").delete()
        .eq("user_id",user.id).eq("id_liga","L055").eq("temporada","2026").in("slot",borrar);
    }
    setSaving(false);
    setMsg("✓ Guardado");setTimeout(()=>setMsg(""),1800);
  };

  const sel={width:"100%",padding:"8px 10px",borderRadius:"8px",border:"1px solid #cbd5e1",fontSize:"13px",background:"#fff",cursor:"pointer"};

  // en grupos: solo puede elegir equipos de ese grupo, sin repetir posición
  const opsGrupo=(g,pos)=>{
    const total=gruposMap[g]||[];
    const usados=[1,2,3,4].filter(p=>p!==pos).map(p=>drafts[`grupo_${g}_${p}`]).filter(Boolean);
    return total.filter(e=>!usados.includes(e.id));
  };

  // lookup nombre + escudo por id (para banderas)
  const eqIdx={},eqEsc={};
  (equipos||[]).forEach(e=>{eqIdx[e.id_equipo]=e.nombre;eqEsc[e.id_equipo]=e.escudo;});
  const nomDe=id=>eqIdx[id]||"—";
  const escDe=id=>eqEsc[id];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
      <div style={{background:cerrado?"#fef2f2":"#f0fdf4",border:`1px solid ${cerrado?"#fecaca":"#bbf7d0"}`,borderRadius:"12px",padding:"12px 14px",fontSize:"12px",color:cerrado?"#991b1b":"#166534"}}>
        {cerrado
          ?<><b>🔒 Cerrado.</b> Cierre el {cierre?new Date(cierre).toLocaleString("es",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"—"}. Solo lectura.</>
          :<><b>🏀 Abierto.</b> Cierra al empezar el primer partido. Máx 60 pts.</>}
      </div>

      {/* FASE DE GRUPOS */}
      <div style={{background:"#fff",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        <div style={{fontSize:"15px",fontWeight:800,color:"#1e293b",marginBottom:"4px"}}>🏁 Ordena cada grupo (1 pt × posición correcta)</div>
        <div style={{fontSize:"11px",color:"#64748b",marginBottom:"10px"}}>
          <span style={{color:"#166534",fontWeight:700}}>■ 1º</span> pasa directo a cuartos ·
          <span style={{color:"#a16207",fontWeight:700}}> ■ 2º y 3º</span> juegan play-in ·
          <span style={{color:"#b91c1c",fontWeight:700}}> ■ 4º</span> eliminado
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"10px"}}>
          {BN_GRUPOS.map(g=>{
            const total=gruposMap[g]||[];
            // fondos por posición
            const bgPos={1:"#dcfce7",2:"#fef3c7",3:"#fef3c7",4:"#fee2e2"};
            const numPos={1:"#166534",2:"#a16207",3:"#a16207",4:"#b91c1c"};
            return(
              <div key={g} style={{border:"1px solid #e2e8f0",borderRadius:"10px",padding:"8px"}}>
                <div style={{fontSize:"11px",fontWeight:800,color:"#64748b",marginBottom:"6px",textAlign:"center"}}>GRUPO {g}</div>
                {[1,2,3,4].map(pos=>{
                  const slot=`grupo_${g}_${pos}`;
                  return(
                    <div key={pos} style={{display:"flex",alignItems:"center",gap:"5px",marginBottom:"4px",background:bgPos[pos],borderRadius:"6px",padding:"3px"}}>
                      <span style={{fontSize:"11px",fontWeight:800,color:numPos[pos],minWidth:"16px",textAlign:"center"}}>{pos}º</span>
                      <FlagSelect size="sm" disabled={cerrado||total.length===0}
                        value={drafts[slot]||""}
                        placeholder="—"
                        options={opsGrupo(g,pos).map(o=>({id:o.id,label:o.nombre,flagUrl:o.escudo}))}
                        onChange={v=>setDrafts(d=>({...d,[slot]:v}))}/>
                    </div>
                  );
                })}
                {total.length===0&&<div style={{fontSize:"11px",color:"#94a3b8"}}>Sin equipos aún.</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* BRACKET VISUAL con líneas */}
      <div style={{background:"#fff",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        <div style={{fontSize:"15px",fontWeight:800,color:"#1e293b",marginBottom:"12px"}}>🎯 Bracket · Elige ganador de cada partido</div>
        {(()=>{
          const teamBtn=(id,activo)=>({
            display:"flex",alignItems:"center",gap:"5px",width:"100%",textAlign:"left",padding:"5px 7px",
            background:activo?"#9333ea":id?"#f8fafc":"#f1f5f9",
            color:activo?"#fff":id?"#1e293b":"#94a3b8",
            border:`1px solid ${activo?"#9333ea":"#e2e8f0"}`,
            borderRadius:"5px",fontSize:"11px",fontWeight:activo?800:600,
            cursor:id&&!cerrado?"pointer":"not-allowed",
            marginBottom:"3px"
          });
          const flagImg=id=>{
            const url=escDe(id);
            if(!url) return <span style={{width:16,height:12,background:"#e2e8f0",borderRadius:2,flexShrink:0}}/>;
            return <img src={url} alt="" style={{width:16,height:12,objectFit:"contain",flexShrink:0}}/>;
          };
          const teamLabel=id=>(
            <>
              {id?flagImg(id):<span style={{width:16,height:12,flexShrink:0}}/>}
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{id?nomDe(id):"—"}</span>
            </>
          );
          const MatchCard=({slot,label,puntos})=>{
            const [idA,idB]=bnParticipantes(slot,drafts);
            const pick=drafts[slot];
            const ok=pick&&(pick===idA||pick===idB);
            return(
              <div style={{border:"1px solid #e2e8f0",borderRadius:"7px",padding:"5px 6px",background:"#fff",width:"150px"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"9px",color:"#94a3b8",fontWeight:700,marginBottom:"3px"}}>
                  <span>{label}</span><span>{puntos}pt</span>
                </div>
                <button style={teamBtn(idA,ok&&pick===idA)} disabled={!idA||cerrado}
                  onClick={()=>setDrafts(d=>({...d,[slot]:idA}))}>{teamLabel(idA)}</button>
                <button style={teamBtn(idB,ok&&pick===idB)} disabled={!idB||cerrado}
                  onClick={()=>setDrafts(d=>({...d,[slot]:idB}))}>{teamLabel(idB)}</button>
              </div>
            );
          };
          const line="#cbd5e1";
          // Play-in ordenados para alinearse con su QF de destino
          const playins=[
            {slot:"playin_26",label:"Play-in #26",puntos:2}, // → QF#29
            {slot:"playin_25",label:"Play-in #25",puntos:2}, // → QF#30
            {slot:"playin_28",label:"Play-in #28",puntos:2}, // → QF#31
            {slot:"playin_27",label:"Play-in #27",puntos:2}, // → QF#32
          ];
          const qfs=[
            {slot:"qf_29",label:"Cuartos #29",puntos:3},
            {slot:"qf_30",label:"Cuartos #30",puntos:3},
            {slot:"qf_31",label:"Cuartos #31",puntos:3},
            {slot:"qf_32",label:"Cuartos #32",puntos:3},
          ];
          const sfs=[
            {slot:"sf_33",label:"Semifinal #33",puntos:5},
            {slot:"sf_34",label:"Semifinal #34",puntos:5},
          ];
          const finalM={slot:"final_36",label:"Final",puntos:10};
          // Alturas y separaciones (px). Cada "unidad" = altura de un match + gap.
          const MATCH_H=64;   // aprox altura del card
          const GAP_UNIT=20;  // gap entre matches en playin/QF
          // Total altura bracket ≈ 4 matches + 3 gaps = 4*64 + 3*20 = 316
          const bracketH=4*MATCH_H+3*GAP_UNIT;
          const colCommon={display:"flex",flexDirection:"column",justifyContent:"space-around",alignItems:"center",height:bracketH+"px"};
          return(
            <div style={{overflowX:"auto",paddingBottom:"6px"}}>
              <div style={{display:"flex",alignItems:"stretch",minWidth:"780px"}}>
                {/* col Play-in */}
                <div style={colCommon}>
                  <div style={{fontSize:"10px",fontWeight:800,color:"#94a3b8",letterSpacing:"1px",position:"absolute",transform:"translateY(-140%)"}}>PLAY-IN</div>
                  {playins.map(p=>(
                    <div key={p.slot} style={{position:"relative"}}>
                      <MatchCard {...p}/>
                      {/* línea horizontal saliendo a la derecha */}
                      <div style={{position:"absolute",right:"-20px",top:"50%",width:"20px",height:"2px",background:line}}/>
                    </div>
                  ))}
                </div>
                {/* col Cuartos con pair-wrapper para líneas verticales hacia SF */}
                <div style={{...colCommon,marginLeft:"20px"}}>
                  <div style={{fontSize:"10px",fontWeight:800,color:"#94a3b8",letterSpacing:"1px",position:"absolute",transform:"translateY(-140%)"}}>CUARTOS</div>
                  {[0,1].map(pairIdx=>(
                    <div key={pairIdx} style={{display:"flex",flexDirection:"column",justifyContent:"space-around",alignItems:"center",height:(bracketH/2-GAP_UNIT/2)+"px",position:"relative"}}>
                      <div style={{position:"relative"}}>
                        <MatchCard {...qfs[pairIdx*2]}/>
                      </div>
                      <div style={{position:"relative"}}>
                        <MatchCard {...qfs[pairIdx*2+1]}/>
                      </div>
                      {/* línea vertical uniendo los dos QFs a la derecha */}
                      <div style={{position:"absolute",right:"-12px",top:"calc(50% - "+(MATCH_H/2)+"px)",bottom:"calc(50% - "+(MATCH_H/2)+"px)",width:"2px",background:line}}/>
                      {/* horizontal desde cada QF hacia la línea vertical */}
                      <div style={{position:"absolute",right:"-12px",top:"calc("+(MATCH_H/2)+"px + "+(pairIdx===999?0:0)+"px)",width:"12px",height:"2px",background:line}}/>
                      <div style={{position:"absolute",right:"-12px",bottom:"calc("+(MATCH_H/2)+"px)",width:"12px",height:"2px",background:line}}/>
                      {/* línea horizontal saliendo del centro hacia el siguiente SF */}
                      <div style={{position:"absolute",right:"-24px",top:"50%",width:"12px",height:"2px",background:line}}/>
                    </div>
                  ))}
                </div>
                {/* col Semis */}
                <div style={{...colCommon,marginLeft:"24px"}}>
                  <div style={{fontSize:"10px",fontWeight:800,color:"#94a3b8",letterSpacing:"1px",position:"absolute",transform:"translateY(-140%)"}}>SEMIS</div>
                  <div style={{display:"flex",flexDirection:"column",justifyContent:"space-around",alignItems:"center",height:bracketH+"px",position:"relative"}}>
                    {sfs.map((s,i)=>(
                      <div key={s.slot} style={{position:"relative"}}>
                        <MatchCard {...s}/>
                        {/* línea horizontal saliendo a la derecha */}
                        <div style={{position:"absolute",right:"-12px",top:"50%",width:"12px",height:"2px",background:line}}/>
                      </div>
                    ))}
                    {/* línea vertical uniendo SF33 y SF34 a la derecha */}
                    <div style={{position:"absolute",right:"-12px",top:"25%",bottom:"25%",width:"2px",background:line}}/>
                    {/* horizontal desde el centro hacia la Final */}
                    <div style={{position:"absolute",right:"-24px",top:"50%",width:"12px",height:"2px",background:line}}/>
                  </div>
                </div>
                {/* col Final + 3er puesto debajo */}
                <div style={{...colCommon,marginLeft:"24px",justifyContent:"center",gap:"18px"}}>
                  <div style={{fontSize:"10px",fontWeight:800,color:"#94a3b8",letterSpacing:"1px",position:"absolute",transform:"translateY(-140%)"}}>FINAL</div>
                  <MatchCard {...finalM}/>
                  <div style={{fontSize:"9px",fontWeight:800,color:"#f59e0b",letterSpacing:"1px"}}>🥉 3ER PUESTO</div>
                  <MatchCard slot="br_35" label="3er puesto" puntos={4}/>
                </div>
              </div>
            </div>
          );
        })()}

        {drafts.final_36&&(
          <div style={{marginTop:"12px",padding:"12px",background:"linear-gradient(90deg,#fef3c7,#fde68a)",borderRadius:"10px",fontSize:"14px",color:"#78350f",fontWeight:800,textAlign:"center"}}>
            🏆 Tu campeona: {nomDe(drafts.final_36)}
          </div>
        )}
      </div>

      {!cerrado&&(
        <div style={{position:"sticky",bottom:"8px",display:"flex",gap:"10px",alignItems:"center",background:"#fff",borderRadius:"12px",padding:"12px 14px",boxShadow:"0 4px 14px rgba(0,0,0,0.08)"}}>
          <button onClick={guardarTodo} disabled={saving}
            style={{flex:1,background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"12px",fontWeight:800,fontSize:"14px",cursor:"pointer",opacity:saving?0.6:1}}>
            {saving?"Guardando…":"💾 Guardar Basketneta"}
          </button>
          {msg&&<span style={{fontSize:"13px",color:"#16a34a",fontWeight:700}}>{msg}</span>}
        </div>
      )}
    </div>
  );
}

/* ── VerPrediccionesModal (lectura de picks de otro user) ── */
function VerPrediccionesModal({target,equipos,onClose}){
  const [data,setData]=useState(null);
  const [err,setErr]=useState("");
  const [jugMap,setJugMap]=useState({}); // id_jugadora -> {nombre, id_equipo}

  useEffect(()=>{(async()=>{
    const {data:d,error}=await supabase.rpc("ver_predicciones_mundial",{target_user:target.user_id});
    if(error){setErr(error.message);return;}
    setData(d);
    if(d?.cerrado&&Array.isArray(d.bola)){
      const ids=Array.from(new Set(d.bola.flatMap(b=>b.respuesta_ids||[])));
      if(ids.length){
        const {data:js}=await supabase.from("jugadoras").select("id_jugadora,nombre").in("id_jugadora",ids);
        // segunda query para el equipo (via temporadas 2026)
        const {data:ts}=await supabase.from("temporadas").select("id_jugadora,id_equipo").eq("id_liga","L055").eq("temporada","2026").in("id_jugadora",ids);
        const eqOf={};(ts||[]).forEach(t=>{eqOf[t.id_jugadora]=t.id_equipo;});
        const m={};(js||[]).forEach(j=>{m[j.id_jugadora]={nombre:j.nombre,id_equipo:eqOf[j.id_jugadora]};});
        setJugMap(m);
      }
    }
  })();},[target.user_id]);

  const eqIdx={},eqEsc={};
  (equipos||[]).forEach(e=>{eqIdx[e.id_equipo]=e.nombre;eqEsc[e.id_equipo]=e.escudo;});
  const escDe=id=>eqEsc[id];

  const flag=url=>url
    ?<img src={url} alt="" style={{width:16,height:12,objectFit:"contain",flexShrink:0}}/>
    :<span style={{width:16,height:12,background:"#e2e8f0",borderRadius:2,flexShrink:0,display:"inline-block"}}/>;

  const teamPill=id=>id?(
    <span style={{display:"inline-flex",alignItems:"center",gap:"5px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:"6px",padding:"3px 7px",fontSize:"12px",fontWeight:600}}>
      {flag(escDe(id))}<span>{eqIdx[id]||id}</span>
    </span>
  ):<span style={{fontSize:"12px",color:"#94a3b8"}}>—</span>;

  const jugPill=id=>{
    const j=jugMap[id];
    if(!j) return <span style={{fontSize:"12px",color:"#94a3b8"}}>{id}</span>;
    return(
      <span style={{display:"inline-flex",alignItems:"center",gap:"5px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:"6px",padding:"3px 7px",fontSize:"12px",fontWeight:600}}>
        {flag(escDe(j.id_equipo))}<span>{j.nombre}</span>
      </span>
    );
  };

  const bnBySlot={};(data?.basketneta||[]).forEach(b=>{bnBySlot[b.slot]=b;});
  const boByPreg={};(data?.bola||[]).forEach(b=>{boByPreg[b.pregunta_id]=b.respuesta_ids||[];});

  const preguntaLabel={campeon:"🏆 Campeón",mvp:"⭐ MVP",top_scorer:"🎯 Máxima anotadora",joven:"🌱 Mejor joven",quinteto:"🖐️ Quinteto ideal",t3pct:"🏹 Mejor % T3",robos:"🥷 Más robos"};

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.7)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px",overflowY:"auto"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"14px",maxWidth:"760px",width:"100%",padding:"18px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <UserAvatar avatar={target.avatar} googleUrl={target.google} nombre={target.nombre} size={40}/>
            <div>
              <div style={{fontSize:"16px",fontWeight:800,color:"#1e293b"}}>{target.nombre}</div>
              <div style={{fontSize:"11px",color:"#94a3b8"}}>Predicciones · Mundial 2026</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",fontSize:"22px",cursor:"pointer",color:"#64748b"}}>✕</button>
        </div>

        {err&&<div style={{background:"#fef2f2",color:"#991b1b",padding:"10px",borderRadius:"8px",fontSize:"12px"}}>{err}</div>}
        {!data&&!err&&<div style={{padding:"30px",textAlign:"center",color:"#94a3b8"}}>Cargando…</div>}
        {data&&!data.cerrado&&<div style={{background:"#fef3c7",color:"#92400e",padding:"12px",borderRadius:"8px",fontSize:"12px"}}>La quiniela aún no está cerrada — solo podrás ver las predicciones de otros cuando empiece el primer partido.</div>}

        {data?.cerrado&&(<>
          {/* BASKETNETA */}
          <div style={{marginTop:"6px"}}>
            <div style={{fontSize:"13px",fontWeight:800,color:"#1e293b",marginBottom:"8px"}}>🏀 Pronóstico (Basketneta)</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"8px",marginBottom:"12px"}}>
              {["A","B","C","D"].map(g=>(
                <div key={g} style={{border:"1px solid #e2e8f0",borderRadius:"8px",padding:"8px"}}>
                  <div style={{fontSize:"11px",fontWeight:800,color:"#64748b",marginBottom:"6px",textAlign:"center"}}>GRUPO {g}</div>
                  {[1,2,3,4].map(pos=>{
                    const s=bnBySlot[`grupo_${g}_${pos}`];
                    const bgPos={1:"#dcfce7",2:"#fef3c7",3:"#fef3c7",4:"#fee2e2"}[pos];
                    return(
                      <div key={pos} style={{display:"flex",alignItems:"center",gap:"6px",padding:"3px 6px",background:bgPos,borderRadius:"6px",marginBottom:"3px",fontSize:"12px"}}>
                        <b style={{width:"16px",color:"#334155"}}>{pos}º</b>
                        {s?<div style={{display:"flex",alignItems:"center",gap:"5px",overflow:"hidden"}}>{flag(escDe(s.id_equipo))}<span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.nombre||s.id_equipo}</span></div>:<span style={{color:"#94a3b8"}}>—</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{border:"1px solid #e2e8f0",borderRadius:"8px",padding:"10px"}}>
              <div style={{fontSize:"11px",fontWeight:800,color:"#64748b",marginBottom:"8px"}}>BRACKET</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",fontSize:"12px"}}>
                {[["playin_25","Play-in #25"],["playin_26","Play-in #26"],["playin_27","Play-in #27"],["playin_28","Play-in #28"],
                  ["qf_29","Cuartos #29"],["qf_30","Cuartos #30"],["qf_31","Cuartos #31"],["qf_32","Cuartos #32"],
                  ["sf_33","Semi #33"],["sf_34","Semi #34"],["br_35","3er puesto"],["final_36","🏆 Final"]].map(([slot,lab])=>{
                    const s=bnBySlot[slot];
                    return(
                      <div key={slot} style={{display:"flex",alignItems:"center",gap:"6px",padding:"4px 6px",background:slot==="final_36"?"#fef3c7":"#f8fafc",borderRadius:"6px"}}>
                        <span style={{fontSize:"10px",color:"#64748b",fontWeight:700,minWidth:"78px"}}>{lab}</span>
                        {s?teamPill(s.id_equipo):<span style={{color:"#94a3b8",fontSize:"11px"}}>—</span>}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* BOLA */}
          <div style={{marginTop:"14px"}}>
            <div style={{fontSize:"13px",fontWeight:800,color:"#1e293b",marginBottom:"8px"}}>🔮 Bola de cristal</div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {["campeon","mvp","top_scorer","joven","quinteto","t3pct","robos"].map(pid=>{
                const ids=boByPreg[pid]||[];
                return(
                  <div key={pid} style={{border:"1px solid #e2e8f0",borderRadius:"8px",padding:"8px 10px"}}>
                    <div style={{fontSize:"11px",fontWeight:700,color:"#64748b",marginBottom:"5px"}}>{preguntaLabel[pid]}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                      {ids.length===0&&<span style={{fontSize:"12px",color:"#94a3b8"}}>—</span>}
                      {pid==="campeon"?ids.map(id=><span key={id}>{teamPill(id)}</span>):ids.map(id=><span key={id}>{jugPill(id)}</span>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>)}
      </div>
    </div>
  );
}

/* ── QuinielaView ────────────────────────────────────────── */
function QuinielaView({user,equipos}){
  const [cierre,setCierre]=useState(null);
  const [rank,setRank]=useState([]);
  const [tab,setTab]=useState("basketneta");
  const [verUser,setVerUser]=useState(null); // {user_id, nombre, avatar} para modal

  useEffect(()=>{(async()=>{
    const {data:ps}=await supabase.from("partidos")
      .select("fecha_hora").eq("id_liga","L055").eq("temporada","2026");
    const fechas=(ps||[]).map(p=>p.fecha_hora).filter(Boolean).sort();
    setCierre(fechas[0]||null);
    const {data:r}=await supabase.rpc("quiniela_ranking_mundial");
    setRank(r||[]);
  })();},[user.id,tab]);

  const btnStyle=a=>({background:a?"#9333ea":"#f8fafc",color:a?"#fff":"#64748b",border:a?"none":"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"});

  return(
    <div style={{maxWidth:"820px",margin:"0 auto",padding:"12px"}}>
      <div style={{background:"#fff",borderRadius:"16px",padding:"16px 18px",marginBottom:"14px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        <h2 style={{margin:0,fontSize:"18px",fontWeight:800,color:"#1e293b"}}>🎯 Quiniela · Mundial 2026</h2>
        <div style={{fontSize:"12px",color:"#64748b",marginTop:"3px"}}>
          Basketneta (60 pts) + Bola de cristal (61 pts) · Máx 121 pts · Cierre al empezar el 1er partido
        </div>
      </div>
      <div style={{display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap"}}>
        <button onClick={()=>setTab("basketneta")} style={btnStyle(tab==="basketneta")}>🏀 Pronóstico</button>
        <button onClick={()=>setTab("bola")}       style={btnStyle(tab==="bola")}>🔮 Bola de cristal</button>
        <button onClick={()=>setTab("ranking")}    style={btnStyle(tab==="ranking")}>🏆 Ranking</button>
      </div>

      {tab==="basketneta"&&<BasketnetaView user={user} equipos={equipos} cierre={cierre}/>}
      {tab==="bola"&&<BolaCristalView user={user} equipos={equipos} cierre={cierre}/>}

      {verUser&&<VerPrediccionesModal target={verUser} equipos={equipos} onClose={()=>setVerUser(null)}/>}

      {tab==="ranking"&&(
        <div style={{background:"#fff",borderRadius:"12px",overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
          <div style={{padding:"12px 14px",background:"#faf5ff",fontSize:"12px",color:"#6b21a8",borderBottom:"1px solid #e9d5ff"}}>
            🕒 El ranking mostrará puntos cuando termine el Mundial. Ahora muestra cuántas predicciones ha guardado cada usuario.
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"14px"}}>
            <thead style={{background:"#f8fafc"}}>
              <tr>
                <th style={{padding:"10px 14px",textAlign:"left",fontSize:"11px",color:"#64748b",fontWeight:700}}>#</th>
                <th style={{padding:"10px 14px",textAlign:"left",fontSize:"11px",color:"#64748b",fontWeight:700}}>Usuario</th>
                <th style={{padding:"10px 14px",textAlign:"center",fontSize:"11px",color:"#64748b",fontWeight:700}}>🏀 BN</th>
                <th style={{padding:"10px 14px",textAlign:"center",fontSize:"11px",color:"#64748b",fontWeight:700}}>🔮 Bola</th>
                <th style={{padding:"10px 14px",textAlign:"right",fontSize:"11px",color:"#64748b",fontWeight:700}}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {rank.length===0&&<tr><td colSpan={5} style={{padding:"24px",textAlign:"center",color:"#94a3b8"}}>Todavía nadie ha guardado predicciones.</td></tr>}
              {rank.map((r,i)=>{
                const google=r.user_id===user.id?user.user_metadata?.avatar_url:null;
                const cerrado=cierre&&new Date(cierre).getTime()<=Date.now();
                const onClick=cerrado?(()=>setVerUser({user_id:r.user_id,nombre:r.nombre,avatar:r.avatar,google})):undefined;
                return(
                <tr key={r.user_id}
                  onClick={onClick}
                  style={{borderTop:"1px solid #f1f5f9",background:r.user_id===user.id?"#faf5ff":undefined,cursor:cerrado?"pointer":"default"}}
                  onMouseEnter={e=>{if(cerrado)e.currentTarget.style.background="#f5f3ff";}}
                  onMouseLeave={e=>{e.currentTarget.style.background=r.user_id===user.id?"#faf5ff":"";}}
                  title={cerrado?"Ver sus predicciones":undefined}>
                  <td style={{padding:"10px 14px",fontWeight:700,color:i===0?"#eab308":i===1?"#94a3b8":i===2?"#c2410c":"#64748b"}}>{i+1}</td>
                  <td style={{padding:"8px 14px",fontWeight:600,color:"#1e293b"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <UserAvatar avatar={r.avatar} googleUrl={google} nombre={r.nombre} size={28}/>
                      <span>{r.nombre}{r.user_id===user.id?" (tú)":""}</span>
                      {cerrado&&<span style={{fontSize:"11px",color:"#9333ea",marginLeft:"4px"}}>👁</span>}
                    </div>
                  </td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:"#64748b"}}>{r.basketneta_slots}/28</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:"#64748b"}}>{r.bola_slots}/7</td>
                  <td style={{padding:"10px 14px",textAlign:"right",fontWeight:800,color:"#9333ea",fontSize:"16px"}}>{r.puntos}</td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── App ─────────────────────────────────────────────────── */
export default function App(){
  const [players,setPlayers] = useState([]);
  const [equipos,setEquipos] = useState([]);
  const [ligas,setLigas]     = useState([]);
  const [palmares,setPalmares] = useState([]);
  const [coaches,setCoaches]     = useState([]);
  const [tempCoach,setTempCoach] = useState([]);
  const [equiposNombres,setEquiposNombres] = useState([]);
  const [partidos,setPartidos]             = useState([]);
  const [partidosFull,setPartidosFull]     = useState(false);
  const [mvps,setMvps]                     = useState([]);
  const [boxCount,setBoxCount]             = useState(0);
  const [openClasiKey,setOpenClasiKey]     = useState(null);
  const [partidosSub,setPartidosSub]       = useState(null); // subruta de /partidos (["partido","85"] o ["clasificacion","L067","2025"])
  const [loading,setLoading] = useState(true);
  const [error,setError]     = useState(null);
  const [isFirstLoad,setIsFirstLoad] = useState(true);
  const [showCalidad,setShowCalidad] = useState(false);
  const [mobileSearchOpen,setMobileSearchOpen] = useState(false);
  const [showLanding,setShowLanding] = useState(()=>{
    try{return !localStorage.getItem("bfdb_accepted");}catch{return true;}
  });
  const handleEnter=()=>{
    try{localStorage.setItem("bfdb_accepted","1");}catch{}
    setShowLanding(false);
  };
  const VAPID_PUBLIC="BJA0yYZKko4boy2Gpdoj4SFEE-MII_zEW86PTb1XhYmNtfavkE4ee44shsGAFuluzn5U39eB_L5TTTiAPtG1zns";
  const [pushEnabled,setPushEnabled]=useState(false);
  const [notifCount,setNotifCount]=useState(0);
  const [showNotifs,setShowNotifs]=useState(false);
  const [notificaciones,setNotificaciones]=useState([]);

  const checkPushStatus=async()=>{
    if(!("serviceWorker" in navigator)||!("PushManager" in window))return;
    try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();setPushEnabled(!!sub);}catch{}
  };

  const togglePush=async()=>{
    if(!user)return;
    const reg=await navigator.serviceWorker.ready;
    if(pushEnabled){
      const sub=await reg.pushManager.getSubscription();
      if(sub){await sub.unsubscribe();await supabase.from("push_subscriptions").delete().eq("endpoint",sub.endpoint);}
      setPushEnabled(false);
    }else{
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(atob(VAPID_PUBLIC.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0))});
      const key=sub.getKey("p256dh");const auth=sub.getKey("auth");
      await supabase.from("push_subscriptions").upsert({user_id:user.id,endpoint:sub.endpoint,p256dh:btoa(String.fromCharCode(...new Uint8Array(key))),auth:btoa(String.fromCharCode(...new Uint8Array(auth)))},{onConflict:"user_id,endpoint"});
      setPushEnabled(true);
    }
  };

  const loadNotifs=async()=>{
    if(!user)return;
    const {data}=await supabase.from("notificaciones").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);
    setNotificaciones(data||[]);
    setNotifCount((data||[]).filter(n=>!n.leida).length);
  };

  const markRead=async()=>{
    if(!user)return;
    await supabase.from("notificaciones").update({leida:true}).eq("user_id",user.id).eq("leida",false);
    setNotifCount(0);
    setNotificaciones(prev=>prev.map(n=>({...n,leida:true})));
  };
  const [isAdmin,setIsAdmin]       = useState(false);
  const [user,setUser]             = useState(null);
  const [favoritos,setFavoritos]   = useState([]);
  const [showLogin,setShowLogin]   = useState(false);
  const [loginErr,setLoginErr]     = useState("");
  const [loginLoading,setLoginLoading] = useState(false);
  const [loginMode,setLoginMode]   = useState("login"); // login | register
  const [showUserMenu,setShowUserMenu] = useState(false);
  const [menuOpen,setMenuOpen] = useState(false);
  const [showPrivacidad,setShowPrivacidad] = useState(false);
  const [showPerfil,setShowPerfil] = useState(false);
  const [tab,setTabRaw] = useState("home");
  const setTab = (v)=>{setShowPerfil(false);setTabRaw(v);};

  useEffect(()=>{
    const setupUser=async(session)=>{
      const u=session?.user||null;
      setUser(u);
      if(u){
        const {data:isAdm}=await supabase.rpc("is_admin");
        setIsAdmin(!!isAdm);
        const {data}=await supabase.from("favoritos").select("*").eq("user_id",u.id);
        setFavoritos(data||[]);
        checkPushStatus();
        const {data:notifs}=await supabase.from("notificaciones").select("*").eq("user_id",u.id).order("created_at",{ascending:false}).limit(20);
        setNotificaciones(notifs||[]);
        setNotifCount((notifs||[]).filter(n=>!n.leida).length);
      }else{setIsAdmin(false);setFavoritos([]);setNotificaciones([]);setNotifCount(0);}
    };
    supabase.auth.getSession().then(({data:{session}})=>setupUser(session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>setupUser(session));
    return ()=>subscription.unsubscribe();
  },[]);

  const isFav=(tipo,idRef)=>favoritos.some(f=>f.tipo===tipo&&f.id_referencia===idRef);
  const toggleFav=async(tipo,idRef)=>{
    if(!user){setShowLogin(true);return;}
    const ex=favoritos.find(f=>f.tipo===tipo&&f.id_referencia===idRef);
    if(ex){
      await supabase.from("favoritos").delete().eq("id",ex.id);
      setFavoritos(prev=>prev.filter(f=>f.id!==ex.id));
    }else{
      const {data}=await supabase.from("favoritos").insert({user_id:user.id,tipo,id_referencia:idRef}).select().single();
      if(data)setFavoritos(prev=>[...prev,data]);
    }
  };

  const handleLogin=async(email,password)=>{
    setLoginLoading(true);setLoginErr("");
    if(loginMode==="register"){
      const {error}=await supabase.auth.signUp({email,password});
      if(error){setLoginErr(error.message);setLoginLoading(false);}
      else{setLoginErr("");setLoginLoading(false);setShowLogin(false);}
    }else{
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error){setLoginErr("Credenciales incorrectas");setLoginLoading(false);}
      else{setShowLogin(false);setLoginLoading(false);}
    }
  };
  const handleGoogleLogin=async()=>{
    const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});
    if(error)setLoginErr(error.message);
  };
  const handleLogout=async()=>{await supabase.auth.signOut();setUser(null);setIsAdmin(false);setFavoritos([]);};
  const [openPlayerId,setOpenPlayerId] = useState(null);
  const [openTeamId,setOpenTeamId]     = useState(null);
  const [openTeamYear,setOpenTeamYear] = useState(null);
  const [openCoachId,setOpenCoachId]   = useState(null);

  const [openLigaId,setOpenLigaId] = useState(null);
  const [navHistory,setNavHistory] = useState([]);  // pila: [{tab,id,label}]

  const scrollTop  = ()=>window.scrollTo({top:0,behavior:"smooth"});

  // Construye la ruta URL para una pestaña+id, espejo de applyUrlState.
  const pathFor=(tabName,id)=>{
    if(tabName==="jugadoras"&&id)return `/jugadoras/${id}`;
    if(tabName==="equipos"&&id)return `/equipos/${id}`;
    if(tabName==="cuerpo_tecnico"&&id)return `/coaches/${id}`;
    if(tabName==="ligas")return `/ligas`;
    if(tabName==="partidos")return `/partidos`;
    return `/${tabName==="home"?"":tabName}`;
  };

  // pushNav hace dos cosas: mantiene navHistory (texto "← Volver a X" en la UI)
  // y registra una entrada real en window.history (para que el botón atrás del sistema/móvil funcione).
  // NOTA: el "from" que se guarda en el state del pushState NO es fiable a largo plazo —
  // cada vista (PlayersView/TeamsView/LeaguesView/CoachesView) tiene su propio useEffect
  // que hace replaceState al cambiar selId, y eso sustituye este state por uno vacío
  // casi inmediatamente. Por eso onPopState (más abajo) NO lee event.state: usa
  // únicamente la URL (pathname) + un pop de un solo elemento de navHistory en paralelo.
  const pushNav=(from,destTab,destId)=>{
    if(from)setNavHistory(h=>[...h,from].slice(-5));
    window.history.pushState({from},"",pathFor(destTab,destId));
  };

  const goToTeam   = (id,year=null,from=null)=>{pushNav(from,"equipos",id);setOpenTeamId(id);setOpenTeamYear(year);setOpenPlayerId(null);setTab("equipos");scrollTop();};
  const goToLeague = (id,from=null)=>{pushNav(from,"ligas",id);setOpenLigaId(id);setTab("ligas");scrollTop();};
  const goToPlayer = (id,from=null)=>{pushNav(from,"jugadoras",id);setOpenPlayerId(id);setOpenTeamId(null);setTab("jugadoras");scrollTop();};
  const goToCoach  = (id,from=null)=>{pushNav(from,"cuerpo_tecnico",id);setOpenCoachId(id);setTab("cuerpo_tecnico");scrollTop();};
  const goToPartido= (id,from=null)=>{setPartidosSub(["partido",String(id)]);setTab("partidos");try{window.history.pushState({},"",`/partidos/partido/${id}`);}catch(e){}scrollTop();};
  const regExtra=(mvps?.length||0)+(partidos?.length||0)+boxCount+(equiposNombres?.length||0);

  // goBack ahora delega en el navegador: window.history.back() dispara un popstate real,
  // que ya tenemos gestionado más abajo. Mantenemos el pop de navHistory en paralelo
  // únicamente para que la UI ("← Volver a X") deje de mostrar la entrada inmediatamente,
  // sin esperar al evento asíncrono de popstate.
  const goBack=()=>{
    setNavHistory(h=>h.slice(0,-1));
    window.history.back();
  };

  const loadAll = async(forzar=false)=>{
    // Caché de sesión: no recargar si ya están en memoria
    if(!forzar && players.length>0 && equipos.length>0){return;}
    // Hidratación desde localStorage (arranque instantáneo)
    const CK="basketfemdb:cache:v3";
    let hidratado=false;
    if(!forzar){
      try{
        const raw=localStorage.getItem(CK);
        if(raw){
          const c=JSON.parse(raw);
          if(c&&Array.isArray(c.players)&&Array.isArray(c.equipos)&&c.players.length&&c.equipos.length){
            setPlayers(c.players);
            setEquipos(c.equipos);
            setLigas(c.ligas||[]);
            setPalmares(c.palmares||[]);
            setCoaches(c.coaches||[]);
            setTempCoach(c.tempCoach||[]);
            setEquiposNombres(c.equiposNombres||[]);
            setPartidos(c.partidos||[]);
            if(c.partidosFull) setPartidosFull(true);
            setMvps(c.mvps||[]);
            setIsFirstLoad(false);
            setLoading(false);
            hidratado=true;
          }
        }
      }catch(e){}
    }
    if(!hidratado) setLoading(isFirstLoad);
    setError(null);
    try{
      // Fase 1: críticas para Home (players/equipos/ligas/temporadas/partidos)
      const [rJ,rE,rL,rT,rPar]=await Promise.all([
        fetchAll("jugadoras",{order:"id_jugadora",select:"id_jugadora,nombre,posicion,nacionalidad,nacionalidad2,fecha_nac,altura_cm,id_ext,id_espn,fuente,foto"}),
        fetchAll("equipos",{order:"id_equipo"}),
        fetchAll("ligas",{order:"id_liga"}),
        fetchAll("dos_ultimas_temporadas",{order:"id_jugadora",select:"id,id_jugadora,id_equipo,id_liga,temporada,orden",filter:q=>q.neq("id_liga","L020")}),
        fetchAll("partidos",{order:"fecha_hora",select:"id,fecha_hora,temporada,id_liga,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante,notas,es_live,periodo,id_ext,fuente,bracket_pos",filter:q=>q.neq("id_liga","L020").gte("temporada",String(new Date().getFullYear()-2))}),
      ]);
      if(rJ.error)throw rJ.error;if(rE.error)throw rE.error;if(rL.error)throw rL.error;if(rT.error)throw rT.error;
      const sbp={};
      (rT.data||[]).forEach(t=>{if(!sbp[t.id_jugadora])sbp[t.id_jugadora]=[];sbp[t.id_jugadora].push(t);});
      const nuevosPlayers=(rJ.data||[]).map(j=>({...j,seasons:sbp[j.id_jugadora]||[]}));
      setPlayers(nuevosPlayers);
      setEquipos(rE.data||[]);
      setLigas(rL.data||[]);
      setPartidos(rPar?.data||[]);
      setIsFirstLoad(false);
      if(!hidratado) setLoading(false);
      // Fase 2: secundarias en background (no bloquean Home)
      (async()=>{
        try{
          const [rP,rC,rTC,rEN,rMvp]=await Promise.all([
            fetchAll("palmares",{order:"temporada"}),
            fetchAll("coach",{order:"id_coach"}),
            fetchAll("temporadas_coach",{order:"id"}),
            fetchAll("equipos_nombres",{order:"id"}),
            fetchAll("mvps",{order:"id"}),
          ]);
          setPalmares(rP.data||[]);
          setCoaches(rC.data||[]);
          setTempCoach(rTC.data||[]);
          setEquiposNombres(rEN?.data||[]);
          setMvps(rMvp?.data||[]);
          try{
            localStorage.setItem(CK,JSON.stringify({
              players:nuevosPlayers,
              equipos:rE.data||[],
              ligas:rL.data||[],
              palmares:rP.data||[],
              coaches:rC.data||[],
              tempCoach:rTC.data||[],
              equiposNombres:rEN?.data||[],
              partidos:rPar?.data||[],
              mvps:rMvp?.data||[],
            }));
          }catch(e){try{localStorage.removeItem(CK);}catch(_){}}
          try{
            const [bc,sc]=await Promise.all([
              supabase.from("partido_boxscore").select("*",{count:"exact",head:true}),
              supabase.from("partido_stats").select("*",{count:"exact",head:true}),
            ]);
            setBoxCount((bc.count||0)+(sc.count||0));
          }catch(e){}
        }catch(e){console.warn("Fase 2 falló:",e.message||e);}
      })();
    }catch(e){
      const msg=e.message||"Error cargando datos";
      // Token con iat en el futuro (reloj desincronizado en algún momento):
      // limpiar sesión y recargar para forzar un token nuevo.
      if(/issued at future|JWT/i.test(msg)){
        try{await supabase.auth.signOut();}catch(_){}
        try{Object.keys(localStorage).filter(k=>k.startsWith("sb-")).forEach(k=>localStorage.removeItem(k));}catch(_){}
        window.location.reload();
        return;
      }
      if(!hidratado) setError(msg);
      else console.warn("Refresh en background falló:",msg);
      if(!hidratado) setLoading(false);
    }
  };

  useEffect(()=>{loadAll();},[]);

  // Carga bajo demanda del histórico de partidos al entrar en "partidos"
  useEffect(()=>{
    if(tab!=="partidos"||partidosFull) return;
    (async()=>{
      try{
        const {data}=await fetchAll("partidos",{
          order:"fecha_hora",
          select:"id,fecha_hora,temporada,id_liga,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante,notas,es_live,periodo,id_ext,fuente,bracket_pos",
          filter:q=>q.neq("id_liga","L020").lt("temporada",String(new Date().getFullYear()-2))
        });
        let merged=[];
        setPartidos(prev=>{
          const ids=new Set(prev.map(p=>p.id));
          merged=[...prev,...(data||[]).filter(p=>!ids.has(p.id))].sort((a,b)=>(a.fecha_hora||"").localeCompare(b.fecha_hora||""));
          return merged;
        });
        setPartidosFull(true);
        try{
          const CK="basketfemdb:cache:v3";
          const raw=localStorage.getItem(CK);
          if(raw){
            const c=JSON.parse(raw);
            c.partidos=merged;
            c.partidosFull=true;
            localStorage.setItem(CK,JSON.stringify(c));
          }
        }catch(e){}
      }catch(e){console.warn("Carga histórica partidos falló:",e.message||e);}
    })();
  },[tab,partidosFull]);

  // Aplica el estado de navegación (tab + ficha abierta) a partir de una URL dada.
  // Se usa tanto al montar la app (URL inicial pegada/recargada) como en cada evento
  // popstate (botón "atrás" del navegador o del sistema en móvil).
  const applyUrlState=pathname=>{
    const parts=pathname.split("/").filter(Boolean);
    // Limpiar siempre primero: si el usuario retrocede a una pantalla sin ficha abierta
    // (p.ej. la home), hay que vaciar los openXId o la UI no reflejará el cambio.
    setOpenPlayerId(parts.length===2&&parts[0]==="jugadoras"?parts[1]:null);
    setOpenTeamId(parts.length===2&&parts[0]==="equipos"?parts[1]:null);
    setOpenCoachId(parts.length===2&&parts[0]==="coaches"?parts[1]:null);
    // Para /partidos se guarda [] (array nuevo en cada llamada): así un popstate que
    // vuelve a /partidos siempre cambia la referencia y dispara la resincronización.
    setPartidosSub(parts[0]==="partidos"?parts.slice(1):null);
    if(parts[0]==="privacidad"){setShowPrivacidad(true);return;}else{setShowPrivacidad(false);}
    if(parts[0]==="jugadoras"||parts[0]==="equipos"||parts[0]==="coaches"||parts[0]==="ligas"||parts[0]==="partidos")setTab(parts[0]==="coaches"?"cuerpo_tecnico":parts[0]);
    else if(parts.length===0)setTab("home");
  };

  useEffect(()=>{
    applyUrlState(window.location.pathname);
  },[]);

  useEffect(()=>{
    const onPopState=()=>{
      applyUrlState(window.location.pathname);
      // Pop de un solo paso, igual que goBack: si el usuario sigue retrocediendo con
      // el botón del sistema, cada popstate quita una entrada, no la pila entera de golpe.
      setNavHistory(h=>h.slice(0,-1));
    };
    window.addEventListener("popstate",onPopState);
    return()=>window.removeEventListener("popstate",onPopState);
  },[]);

  const TABS=[["home","✍️","Mercado"],...(user?[["favoritos","⭐","Favoritos"]]:[]),["jugadoras","👩‍🏀","Jugadoras"],["equipos","🏟️","Equipos"],["ligas","🏆","Ligas"],["cuerpo_tecnico","📋","Cuerpo Técnico"],["partidos","📺","Ver partidos"],...(user?[["quiniela","🎯","Quiniela"]]:[])];

  if(showLanding) return <Landing onEnter={handleEnter} players={players} equipos={equipos} ligas={ligas} coaches={coaches} tempCoach={tempCoach} palmares={palmares} regExtra={regExtra}/>;
  if(showCalidad){
    return <Suspense fallback={<div style={{padding:"40px",textAlign:"center",color:"#94a3b8"}}>Cargando panel de calidad…</div>}>
      <CalidadModal players={players} equipos={equipos} ligas={ligas} coaches={coaches}
        tempCoach={tempCoach} palmares={palmares} isAdmin={isAdmin}
        onClose={()=>setShowCalidad(false)} onGoToPlayer={goToPlayer}
        onGoToTeam={goToTeam} onGoToLeague={goToLeague} onGoToCoach={goToCoach} onReload={loadAll}
        setPlayers={setPlayers} setEquipos={setEquipos} setLigas={setLigas} setCoaches={setCoaches} setTempCoach={setTempCoach}/>
    </Suspense>;
  }
  if(showLogin) return <LoginModal onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} onClose={()=>{setShowLogin(false);setLoginErr("");setLoginMode("login");}} loading={loginLoading} error={loginErr} mode={loginMode} setMode={setLoginMode}/>;

  if(loading) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f1f5f9",fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center",color:"#94a3b8"}}><div style={{display:"inline-block",animation:"bounce 0.7s infinite"}}><span style={{fontSize:"52px",lineHeight:1}}>🏀</span></div><div style={{width:"40px",height:"6px",background:"#cbd5e1",borderRadius:"50%",margin:"4px auto 0",animation:"shadow 0.7s infinite"}}></div><div style={{fontWeight:700,fontSize:"16px",color:"#9333ea",marginTop:"14px"}}>La Basketneta</div><div style={{fontSize:"13px",marginTop:"4px"}}>Cargando datos...</div></div>
    </div>
  );

  if(error) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f1f5f9",fontFamily:"system-ui,sans-serif",padding:"20px"}}>
      <div style={{background:"#fee2e2",border:"1.5px solid #fecaca",borderRadius:"14px",padding:"24px",maxWidth:"500px",color:"#b91c1c",fontSize:"14px",textAlign:"center"}}>
        <div style={{fontSize:"36px",marginBottom:"12px"}}>❌</div>
        <strong>Error de conexión</strong><br/>{error}
        <button onClick={loadAll} style={{marginTop:"16px",background:"#ef4444",color:"#fff",border:"none",borderRadius:"8px",padding:"10px 20px",cursor:"pointer",fontWeight:700,fontSize:"13px",display:"block",margin:"16px auto 0"}}>Reintentar</button>
      </div>
    </div>
  );

  return(<>
    <style>{`
      /* ── Mobile responsive ── */
      @media (max-width: 640px) {
        .bfdb-header-inner { height: auto !important; flex-wrap: wrap; padding: 6px 8px !important; gap: 4px !important; }
        .bfdb-logo { margin-right: 0 !important; flex: 1; }
        .bfdb-header-actions { display: flex; align-items: center; gap: 2px; }
        .bfdb-tabs { order: 3; width: 100%; display: flex; justify-content: space-around; padding-bottom: 4px; }
        .bfdb-tabs button { flex: 1; font-size: 16px !important; padding: 8px 4px !important; }
        .bfdb-tab-label { display: none !important; }
        .bfdb-supabase-badge { display: none !important; }
        .bfdb-global-search { display: none !important; }
        .bfdb-mobile-search-btn { display: flex !important; align-items: center; }
        .bfdb-stats-grid { grid-template-columns: repeat(3,1fr) !important; gap: 6px !important; }
        .bfdb-stats-grid > div { padding: 10px 4px !important; }
        .bfdb-stats-grid > div > div:first-child { font-size: 16px !important; }
        .bfdb-stats-grid > div > div:nth-child(2) { font-size: 16px !important; }
        .bfdb-cards-grid { grid-template-columns: 1fr !important; }
        .bfdb-player-badges { flex-direction: row !important; flex-wrap: wrap; gap: 3px !important; max-width: 120px; }
        .bfdb-player-card-right { flex-shrink: 0; max-width: 140px; }
        .bfdb-player-badges span { font-size: 10px !important; padding: 2px 5px !important; }
        .bfdb-filter-row { gap: 6px !important; }
        .bfdb-filter-row select, .bfdb-filter-row input { flex: 1 1 calc(50% - 3px) !important; min-width: 0 !important; font-size: 12px !important; padding: 8px 8px !important; }
        .bfdb-container { padding: 10px !important; }
        .bfdb-status-dropdown, .bfdb-nac-dropdown { flex: 1 1 calc(50% - 3px) !important; min-width: 0 !important; }
        .bfdb-status-dropdown > div:first-child, .bfdb-nac-dropdown > div:first-child { min-width: 0 !important; font-size: 12px !important; padding: 8px 8px !important; }
      }
    `}</style>
    <div style={{minHeight:"100vh",background:"#f1f5f9",fontFamily:"system-ui,-apple-system,sans-serif",overflowX:"hidden"}}>
      <div style={{background:"#0f172a",color:"#fff",padding:"0 20px",position:"sticky",top:0,zIndex:10,boxShadow:"0 2px 16px rgba(0,0,0,0.4)"}}>
        <div className="bfdb-header-inner" style={{maxWidth:"880px",margin:"0 auto",display:"flex",alignItems:"center",gap:"8px",height:"56px"}}>
          {/* ☰ Hamburguesa */}
          <div style={{position:"relative",flexShrink:0}}>
            <button onClick={()=>setMenuOpen(!menuOpen)} style={{background:menuOpen?"rgba(147,51,234,0.2)":"transparent",color:"#f1f5f9",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"20px",lineHeight:1}}>☰</button>
            {menuOpen&&<><div onClick={()=>setMenuOpen(false)} style={{position:"fixed",inset:0,zIndex:98}}/>
            <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,background:"#1e293b",borderRadius:"12px",padding:"8px",boxShadow:"0 10px 40px rgba(0,0,0,0.5)",zIndex:99,border:"1px solid #334155",minWidth:"220px"}}>
              {TABS.map(([id,icon,label])=>(
                <button key={id} onClick={()=>{setTab(id);setMenuOpen(false);const seg=id==='cuerpo_tecnico'?'coaches':id;window.history.pushState({},"",`/${seg}`);applyUrlState(`/${seg}`);}} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",background:tab===id?"#9333ea":"transparent",color:tab===id?"#fff":"#cbd5e1",border:"none",borderRadius:"8px",padding:"10px 14px",fontWeight:700,fontSize:"14px",cursor:"pointer",textAlign:"left"}}>
                  <span style={{fontSize:"16px"}}>{icon}</span>{label}
                </button>
              ))}
              <div style={{height:"1px",background:"#334155",margin:"6px 0"}}/>
              {isAdmin&&<button onClick={()=>{setShowCalidad(true);setMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",background:"transparent",color:"#cbd5e1",border:"none",borderRadius:"8px",padding:"10px 14px",fontWeight:700,fontSize:"14px",cursor:"pointer"}}>
                <span style={{fontSize:"16px"}}>🩺</span>Calidad de datos
              </button>}
              <button onClick={()=>{setShowLanding(true);setMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",background:"transparent",color:"#cbd5e1",border:"none",borderRadius:"8px",padding:"10px 14px",fontWeight:700,fontSize:"14px",cursor:"pointer"}}>
                <span style={{fontSize:"16px"}}>ℹ️</span>Información
              </button>
            </div></>}
          </div>

          {/* 🔄 Recargar */}
          <button onClick={()=>loadAll(true)} title="Recargar datos" style={{background:"transparent",color:"#94a3b8",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"16px",flexShrink:0}}>🔄</button>

          {/* 🔔 Notificaciones */}
          {user&&<div style={{position:"relative",flexShrink:0}}>
            <button onClick={()=>{setShowNotifs(!showNotifs);if(!showNotifs)markRead();}} style={{background:"transparent",color:notifCount>0?"#f59e0b":"#94a3b8",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"16px",position:"relative"}}>🔔{notifCount>0&&<span style={{position:"absolute",top:"2px",right:"4px",background:"#ef4444",color:"#fff",fontSize:"9px",fontWeight:800,borderRadius:"50%",width:"16px",height:"16px",display:"flex",alignItems:"center",justifyContent:"center"}}>{notifCount>9?"9+":notifCount}</span>}</button>
            {showNotifs&&<><div onClick={()=>setShowNotifs(false)} style={{position:"fixed",inset:0,zIndex:99}}/><div style={{position:"absolute",left:0,top:"calc(100% + 8px)",background:"#1e293b",borderRadius:"12px",padding:"12px",boxShadow:"0 10px 40px rgba(0,0,0,0.5)",zIndex:100,width:"300px",maxHeight:"400px",overflowY:"auto",border:"1px solid #334155"}}>
              <div style={{fontWeight:800,fontSize:"14px",color:"#f1f5f9",marginBottom:"8px"}}>Notificaciones</div>
              {notificaciones.length===0&&<div style={{fontSize:"12px",color:"#64748b",padding:"16px 0",textAlign:"center"}}>Sin notificaciones</div>}
              {notificaciones.map(n=><div key={n.id} style={{padding:"8px",borderRadius:"8px",background:n.leida?"transparent":"rgba(147,51,234,0.1)",marginBottom:"4px"}}>
                <div style={{fontSize:"12px",fontWeight:700,color:"#f1f5f9"}}>{n.titulo}</div>
                {n.cuerpo&&<div style={{fontSize:"11px",color:"#94a3b8"}}>{n.cuerpo}</div>}
                <div style={{fontSize:"10px",color:"#64748b",marginTop:"2px"}}>{new Date(n.created_at).toLocaleDateString("es-ES",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
              </div>)}
            </div></>}
          </div>}

          {/* Logo */}
          <div className="bfdb-logo" onClick={()=>{setTab("home");window.history.pushState({},"","/");}} title="Inicio" style={{display:"flex",alignItems:"center",cursor:"pointer",flex:1,justifyContent:"center"}}>
            <img src="/icon-home.png" alt="La Basketneta" style={{height:"36px",objectFit:"contain"}} />
          </div>

          {/* Buscador */}
          <div className="bfdb-global-search"><GlobalSearch players={players} equipos={equipos} ligas={ligas} coaches={coaches}
            onGoToPlayer={goToPlayer} onGoToTeam={goToTeam} onGoToLeague={goToLeague} onGoToCoach={goToCoach}/></div>
          <button className="bfdb-mobile-search-btn" onClick={()=>setMobileSearchOpen(true)} style={{display:"none",background:"none",border:"none",color:"#fff",fontSize:"18px",cursor:"pointer",padding:"6px"}}>🔍</button>
          {mobileSearchOpen&&<GlobalSearch players={players} equipos={equipos} ligas={ligas} coaches={coaches}
            onGoToPlayer={goToPlayer} onGoToTeam={goToTeam} onGoToLeague={goToLeague} onGoToCoach={goToCoach}
            fullscreen onClose={()=>setMobileSearchOpen(false)}/>}

          {/* 👤 Admin / Usuario */}
          {user
            ?<div style={{position:"relative",flexShrink:0}}>
              <button onClick={()=>setShowUserMenu(!showUserMenu)} style={{background:isAdmin?"rgba(249,115,22,0.15)":"rgba(147,51,234,0.15)",color:isAdmin?"#c084fc":"#a78bfa",border:`1.5px solid ${isAdmin?"rgba(249,115,22,0.3)":"rgba(147,51,234,0.3)"}`,borderRadius:"10px",padding:"5px 10px",cursor:"pointer",fontSize:"12px",fontWeight:700}}>{isAdmin?"🔐 Admin":"👤"}</button>
              {showUserMenu&&<>
                <div onClick={()=>setShowUserMenu(false)} style={{position:"fixed",inset:0,zIndex:99}}/>
                <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",background:"#1e293b",borderRadius:"12px",padding:"16px",boxShadow:"0 10px 40px rgba(0,0,0,0.5)",zIndex:100,minWidth:"220px",border:"1px solid #334155"}}>
                  <div style={{fontSize:"13px",fontWeight:700,color:"#f1f5f9",marginBottom:"4px"}}>{user.user_metadata?.full_name||user.email.split("@")[0]}</div>
                  <div style={{fontSize:"11px",color:"#94a3b8",marginBottom:"4px"}}>{user.email}</div>
                  {isAdmin&&<div style={{fontSize:"10px",color:"#c084fc",fontWeight:700,marginBottom:"8px"}}>Administrador</div>}
                  <div style={{height:"1px",background:"#334155",margin:"8px 0"}}/>
                  <button onClick={()=>{setShowPerfil(true);setShowUserMenu(false);}}
                    style={{width:"100%",background:"rgba(147,51,234,0.2)",color:"#a78bfa",border:"1px solid rgba(147,51,234,0.4)",borderRadius:"8px",padding:"8px",fontWeight:700,fontSize:"12px",cursor:"pointer",marginBottom:"8px"}}>
                    👤 Mi perfil
                  </button>
                  <button onClick={togglePush} style={{width:"100%",background:pushEnabled?"rgba(34,197,94,0.15)":"rgba(147,51,234,0.15)",color:pushEnabled?"#4ade80":"#a78bfa",border:`1px solid ${pushEnabled?"rgba(34,197,94,0.3)":"rgba(147,51,234,0.3)"}`,borderRadius:"8px",padding:"8px",fontWeight:700,fontSize:"12px",cursor:"pointer",marginBottom:"8px"}}>{pushEnabled?"🔔 Notificaciones activadas":"🔕 Activar notificaciones"}</button>
                  <button onClick={()=>{handleLogout();setShowUserMenu(false);}} style={{width:"100%",background:"#ef4444",color:"#fff",border:"none",borderRadius:"8px",padding:"8px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>Cerrar sesión</button>
                </div>
              </>}
            </div>
            :<button onClick={()=>setShowLogin(true)} title="Iniciar sesión" style={{background:"transparent",color:"#94a3b8",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"16px",flexShrink:0}}>👤</button>
          }
        </div>      </div>
      <div style={{paddingTop:"8px"}}>
        {showPerfil&&user&&<PerfilView user={user} favoritos={favoritos} onClose={()=>setShowPerfil(false)} onLogout={()=>{handleLogout();setShowPerfil(false);}}/>}
        {showPrivacidad&&<PrivacidadView onBack={()=>{setShowPrivacidad(false);window.history.back();}}/>}
        {!showPrivacidad&&!showPerfil&&tab==="favoritos"&&user&&<FavoritosView players={players} equipos={equipos} ligas={ligas} partidos={partidos} favoritos={favoritos} user={user} onGoToPlayer={goToPlayer} onGoToTeam={goToTeam} onGoToLeague={goToLeague} onGoToPartido={goToPartido} isFavFn={isFav} onToggleFav={toggleFav}/>}
        {!showPrivacidad&&!showPerfil&&tab==="home"&&<HomeView players={players} equipos={equipos} ligas={ligas} palmares={palmares} coaches={coaches} tempCoach={tempCoach} onGoToPlayer={goToPlayer} onGoToTeam={goToTeam} onGoToTab={t=>setTab(t)} equiposNombres={equiposNombres}/>}
        {!showPrivacidad&&!showPerfil&&tab==="jugadoras"&&<PlayersView players={players} equipos={equipos} ligas={ligas} palmares={palmares} coaches={coaches} tempCoach={tempCoach} onReload={loadAll} onGoToTeam={goToTeam} onGoToCoach={goToCoach} openPlayerId={openPlayerId} onClearPlayer={()=>setOpenPlayerId(null)} isAdmin={isAdmin} onGoToTab={t=>setTab(t)} navHistory={navHistory} onGoBack={goBack} equiposNombres={equiposNombres} setPlayers={setPlayers} setTempCoach={setTempCoach} onGoToPartido={goToPartido} regExtra={regExtra} isFavFn={isFav} onToggleFav={toggleFav}/>}
        {!showPerfil&&tab==="equipos"  &&<TeamsView equipos={equipos} players={players} ligas={ligas} palmares={palmares} coaches={coaches} tempCoach={tempCoach} onGoToPlayer={goToPlayer} onGoToCoach={goToCoach} onGoToLeague={goToLeague} openTeamId={openTeamId} openTeamYear={openTeamYear} onClearTeam={()=>{setOpenTeamId(null);setOpenTeamYear(null);}} isAdmin={isAdmin} onReload={loadAll} onGoToTab={t=>setTab(t)} navHistory={navHistory} onGoBack={goBack} equiposNombres={equiposNombres} setEquipos={setEquipos} setEquiposNombres={setEquiposNombres} setPlayers={setPlayers} setPalmares={setPalmares} regExtra={regExtra} onGoToPartido={goToPartido} isFavFn={isFav} onToggleFav={toggleFav}/>}
        {!showPerfil&&tab==="ligas"    &&<LeaguesView ligas={ligas} players={players} equipos={equipos} palmares={palmares} coaches={coaches} tempCoach={tempCoach} partidos={partidos} onGoToClasificacion={(ligaId,temporada)=>{setOpenClasiKey(`${ligaId}|${temporada||""}`);setTab("partidos");scrollTop();}} onGoToTeam={goToTeam} isAdmin={isAdmin} onReload={loadAll} openLigaId={openLigaId} onClearLiga={()=>setOpenLigaId(null)} onGoToTab={t=>setTab(t)} navHistory={navHistory} onGoBack={goBack} setLigas={setLigas} regExtra={regExtra} isFavFn={isFav} onToggleFav={toggleFav}/>}
        {!showPrivacidad&&!showPerfil&&tab==="cuerpo_tecnico"&&<CoachesView coaches={coaches} tempCoach={tempCoach} equipos={equipos} ligas={ligas} players={players} palmares={palmares} onGoToPlayer={goToPlayer} onGoToTeam={goToTeam} openCoachId={openCoachId} onClearCoach={()=>setOpenCoachId(null)} isAdmin={isAdmin} onReload={loadAll} onGoToTab={t=>setTab(t)} navHistory={navHistory} onGoBack={goBack} setCoaches={setCoaches} setTempCoach={setTempCoach} equiposNombres={equiposNombres} regExtra={regExtra}/>}
        {!showPrivacidad&&!showPerfil&&tab==="quiniela"&&user&&<QuinielaView user={user} equipos={equipos}/>}
        {!showPrivacidad&&!showPerfil&&tab==="partidos"&&<PartidosView partidos={partidos} equipos={equipos} ligas={ligas} players={players} mvps={mvps} equiposNombres={equiposNombres} openClasiKey={openClasiKey} onClearClasi={()=>setOpenClasiKey(null)} partidosSub={partidosSub} isAdmin={isAdmin} setPartidos={setPartidos} onGoToTeam={(id,year)=>goToTeam(id,year||null,{tab:"partidos",label:"Ver partidos"})} onGoToLeague={(id)=>goToLeague(id,{tab:"partidos",label:"Ver partidos"})} onGoToPlayer={(id)=>goToPlayer(id,{tab:"partidos",label:"Ver partidos"})}/>}
      </div>
    </div>
    </>);
}
