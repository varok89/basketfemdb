// src/lib/ui.jsx
// Helpers UI + constantes reutilizables extraídos de App.jsx (2026-09-15).
// Sin cambio funcional: solo movimiento a módulo compartido para permitir
// que views/*.jsx los importen tras el refactor de partir App.jsx.
import { useState, useEffect, useRef } from "react";
import { useT } from "./i18n";

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
  liga:    ["var(--fx-blue-bg)","var(--fx-blue-text)"],
  copacont:["#f3e8ff","#7c3aed"],
  copadom: ["var(--fx-green-bg)","var(--fx-green-text)"],
  internacional: ["#e0f2fe","#0369a1"],
};

// Si se pasa fechaFin (p.ej. fallecimiento), calcula la edad hasta esa fecha, no hasta hoy.
const calcAge = (d, fechaFin) => d ? Math.floor(((fechaFin?new Date(fechaFin):new Date())-new Date(d))/(365.25*24*3600*1000)) : null;

const CHIP_STYLES = {
  neutral: {background:"var(--fx-hover)", color:"var(--fx-label)", fontWeight:600},
  fiba:    {background:"#f5f3ff", color:"#7c3aed", border:"1px solid #ddd6fe", fontWeight:700},
  venue:   {background:"var(--fx-blue-bg)", color:"#2563eb", fontWeight:600},
  year:    {background:"var(--fx-amber-bg)", color:"var(--fx-amber-text)", fontWeight:700},
};
function Chip({ variant="neutral", children, onClick, href, title }){
  const base = {
    ...CHIP_STYLES[variant],
    fontSize:"12px", padding:"3px 10px", borderRadius:"20px",
    display:"inline-flex", alignItems:"center", gap:"3px",
    ...(onClick ? {cursor:"pointer"} : {}),
    ...(href ? {textDecoration:"none"} : {}),
  };
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" title={title} style={base}>{children}</a>;
  return <span title={title} onClick={onClick} style={base}>{children}</span>;
}

function sortS(ss) {
  return [...(ss||[])].sort((a,b) => {
    const ay = a.temporada||a.year||"";
    const by = b.temporada||b.year||"";
    if (by !== ay) return by.localeCompare(ay);
    return (b.orden??0) - (a.orden??0);
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
  if (norm === "europa" || norm === "europe" || norm === "eu") return <img loading="lazy" decoding="async" src="https://flagcdn.com/20x15/eu.png" width={20} height={15} alt="Europa" title={country} style={{display:"inline-block",verticalAlign:"middle",borderRadius:"2px",flexShrink:0,marginRight:"4px"}}/>;
  if (norm === "mundo" || norm === "world" || norm === "international" || norm === "internacional") return <span title={country} style={{fontSize:"14px",lineHeight:1,marginRight:"4px",verticalAlign:"middle"}}>🌍</span>;
  if (norm === "americas" || norm === "america" || norm === "amerique") return <span title={country} style={{fontSize:"14px",lineHeight:1,marginRight:"4px",verticalAlign:"middle"}}>🌎</span>;
  if (norm.includes("afric")) return <span title={country} style={{fontSize:"14px",lineHeight:1,marginRight:"4px",verticalAlign:"middle"}}>🌍</span>;
  if (norm === "asia" || norm === "oceania" || norm === "oceanía") return <span title={country} style={{fontSize:"14px",lineHeight:1,marginRight:"4px",verticalAlign:"middle"}}>🌏</span>;
  const code = countryCode(country);
  if (!code) return null;
  return <img loading="lazy" decoding="async" src={`https://flagpedia.net/data/flags/w160/${code}.webp`} width={20} height={13} alt={country} title={country}
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
          <img loading="lazy" decoding="async" src={`https://flagpedia.net/data/flags/w160/${code}.webp`} alt={list[i]}
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
  if(team?.escudo) return <img loading="lazy" decoding="async" className={team?.tipo==="seleccion"?"bfdb-flag-bg":undefined} src={team.escudo} alt={team.nombre} style={{width:size,height:size,borderRadius:"8px",objectFit:"contain",flexShrink:0,border:"1px solid var(--fx-border)",background:"var(--fx-card)",boxSizing:"border-box"}} onError={e=>e.target.style.display="none"}/>;  return <div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:fs,flexShrink:0,boxShadow:"0 2px 6px rgba(0,0,0,0.2)"}}>{ini}</div>;
}

function LeagueBadge({liga,size=60}){
  const [bg,color]=TIPO_COLORS[liga?.tipo]||["#f1f5f9","#475569"];
  const fs=size<40?10:size<60?14:18;
  if(liga?.logo) return <img loading="lazy" decoding="async" src={liga.logo} alt={liga.nombre} style={{width:size,height:size,objectFit:"contain",flexShrink:0,borderRadius:"10px"}} onError={e=>e.target.style.display="none"}/>;
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
    <div title="Fallecida" style={{position:"absolute",bottom:-2,right:-2,width:ribbonSize,height:ribbonSize,borderRadius:"50%",background:"var(--fx-card)",border:"1.5px solid var(--fx-border)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <svg width={ribbonSize*0.58} height={ribbonSize*0.58} viewBox="0 0 384 512" fill="#0f0f0f">
        <path d="M235.1 0c33.4 0 64.5 17.4 81.9 45.9 1.2 2 13 21.3 35.3 57.8 21.1 34.5 18.3 78.5-7 110L278.3 297.7 364.5 406c5.5 6.9 4.4 16.9-2.5 22.5l-80 64c-6.9 5.5-17 4.4-22.5-2.5L38.6 213.8C13.3 182.3 10.5 138.3 31.6 103.8 54 67.2 65.7 47.9 67 45.9 84.4 17.4 115.4 0 148.9 0l86.3 0zM192 189.2l48.6-61.2-97.3 0 48.6 61.2zM75 336.2l86.2 107.8-36.8 46c-5.5 6.9-15.6 8-22.5 2.5l-80-64c-6.9-5.5-8-15.6-2.5-22.5L75 336.2z"/>
      </svg>
    </div>
  );
  // onPhotoClick es opt-in: solo se activa el cursor/clic donde se pase explícitamente
  // (ficha individual de jugadora/entrenador), no en miniaturas de listados/búsqueda.
  const clickProps=onPhotoClick&&photo?{onClick:()=>onPhotoClick(photo),style:{cursor:"pointer"}}:{};
  if(photo) return <div {...clickProps} style={{...clickProps.style,position:"relative",display:"inline-flex",flexShrink:0}}><img loading="lazy" decoding="async" src={photo} alt={name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"2px solid #e2e8f0",filter:fallecida?"grayscale(60%)":"none"}} onError={handleError}/>{ribbon}</div>;
  return <div style={{position:"relative",display:"inline-flex",flexShrink:0}}><div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,#9333ea,#c084fc)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontWeight:800,fontSize,letterSpacing:"-0.5px"}}>{ini}</div>{ribbon}</div>;
}

function PhotoLightbox({photo,onClose}){
  if(!photo) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",cursor:"zoom-out"}}>
      <button onClick={onClose} aria-label="Cerrar" title="Cerrar" style={{position:"absolute",top:"16px",right:"20px",background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"50%",width:"40px",height:"40px",color:"#fff",fontSize:"22px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      <img src={photo} alt="" onClick={e=>e.stopPropagation()} style={{maxWidth:"90vw",maxHeight:"85vh",borderRadius:"12px",objectFit:"contain",boxShadow:"0 20px 60px rgba(0,0,0,0.5)",cursor:"default"}}/>
    </div>
  );
}

/* ── Estilos ─────────────────────────────────────────────── */
const POS_C={"Base":["var(--fx-blue-bg)","var(--fx-blue-text)"],"Escolta":["var(--fx-green-bg)","var(--fx-green-text)"],"Alero":["#fef9c3","var(--fx-amber-text)"],"Ala-Pívot":["#ffedd5","var(--fx-amber-text)"],"Pívot":["var(--fx-red-bg)","var(--fx-red-text)"]};
const posStyle=p=>{const [bg,color]=POS_C[p]||["#f1f5f9","#475569"];return{background:bg,color,fontSize:"11px",fontWeight:700,padding:"3px 10px",borderRadius:"20px",whiteSpace:"nowrap"};};
const inp={width:"100%",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"14px",color:"var(--fx-text)",outline:"none",boxSizing:"border-box",background:"var(--fx-card)"};

function Fld({label,children}){return <div style={{marginBottom:"14px"}}><label style={{display:"block",fontSize:"12px",fontWeight:700,color:"var(--fx-muted)",marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</label>{children}</div>;}
/* Boton "Suscribir al calendario": abre popover con 3 opciones (Google
   Calendar, iOS/Apple Calendar via webcal, copiar enlace). Endpoint
   /api/calendar devuelve un .ics dinamico con los partidos. */
function CalendarSubscribeBtn({tipo, id, temporada}){
  const t = useT();
  const [open,setOpen]=useState(false);
  const [copied,setCopied]=useState(false);
  const ref=useRef();
  useEffect(()=>{
    if(!open)return;
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[open]);
  const qs=new URLSearchParams({tipo,id}); if(temporada)qs.set("temporada",temporada);
  const httpsUrl=`${window.location.origin}/api/calendar?${qs.toString()}`;
  const webcalUrl=httpsUrl.replace(/^https?:/,"webcal:");
  const googleUrl=`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;
  const copyLink=async()=>{
    try{ await navigator.clipboard.writeText(httpsUrl); setCopied(true); setTimeout(()=>setCopied(false),1800); }catch{}
  };
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} title={t("cal.subscribe")} style={{background:"var(--fx-hover)",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"7px 12px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"var(--fx-label)",display:"inline-flex",alignItems:"center",gap:"6px"}}>📅 {t("cal.subscribe")}</button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:50,background:"var(--fx-card)",border:"1px solid var(--fx-border)",borderRadius:"12px",boxShadow:"0 10px 30px rgba(0,0,0,0.15)",minWidth:"260px",padding:"6px"}}>
          <a href={googleUrl} target="_blank" rel="noopener" onClick={()=>setOpen(false)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"9px 12px",borderRadius:"8px",fontSize:"13px",color:"var(--fx-text)",textDecoration:"none",fontWeight:600}} onMouseEnter={e=>e.currentTarget.style.background="var(--fx-hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>🗓 {t("cal.google")}</a>
          <a href={webcalUrl} onClick={()=>setOpen(false)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"9px 12px",borderRadius:"8px",fontSize:"13px",color:"var(--fx-text)",textDecoration:"none",fontWeight:600}} onMouseEnter={e=>e.currentTarget.style.background="var(--fx-hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>🍎 {t("cal.apple")}</a>
          <button onClick={copyLink} style={{display:"flex",alignItems:"center",gap:"8px",padding:"9px 12px",borderRadius:"8px",fontSize:"13px",color:"var(--fx-text)",background:"none",border:"none",cursor:"pointer",fontWeight:600,width:"100%",textAlign:"left"}} onMouseEnter={e=>e.currentTarget.style.background="var(--fx-hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{copied?"✓ "+t("cal.copied"):"🔗 "+t("cal.copy")}</button>
          <a href={httpsUrl} download style={{display:"flex",alignItems:"center",gap:"8px",padding:"9px 12px",borderRadius:"8px",fontSize:"13px",color:"var(--fx-text)",textDecoration:"none",fontWeight:600}} onMouseEnter={e=>e.currentTarget.style.background="var(--fx-hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>📥 {t("cal.download")}</a>
          <div style={{fontSize:"10px",color:"var(--fx-muted2)",padding:"6px 12px 4px"}}>{t("cal.hint")}</div>
        </div>
      )}
    </div>
  );
}

function Breadcrumbs({items}){
  return (
    <nav aria-label="Breadcrumb" style={{marginBottom:"12px",fontSize:"13px",display:"flex",alignItems:"center",flexWrap:"wrap",gap:"2px"}}>
      {items.filter(Boolean).map((it,i,arr)=>{
        const last=i===arr.length-1;
        return (
          <span key={i} style={{display:"inline-flex",alignItems:"center",gap:"2px"}}>
            {i>0&&<span style={{margin:"0 4px",color:"var(--fx-muted2)"}}>›</span>}
            {it.onClick&&!last
              ? <button onClick={it.onClick} style={{background:"none",border:"none",color:"#9333ea",cursor:"pointer",padding:0,fontSize:"inherit",fontWeight:600}}>{it.label}</button>
              : <span style={{color:last?"var(--fx-text)":"var(--fx-muted)",fontWeight:last?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"220px",display:"inline-block"}}>{it.label}</span>}
          </span>
        );
      })}
    </nav>
  );
}

function Modal({title,onClose,children}){return(
  <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
    <div style={{background:"var(--fx-card)",borderRadius:"20px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",width:"100%",maxWidth:"500px",maxHeight:"92vh",overflowY:"auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px",borderBottom:"1px solid var(--fx-border)"}}>
        <h2 style={{fontWeight:700,fontSize:"18px",color:"var(--fx-text)",margin:0}}>{title}</h2>
        <button onClick={onClose} aria-label="Cerrar" title="Cerrar" style={{background:"none",border:"none",fontSize:"26px",color:"var(--fx-muted2)",cursor:"pointer",lineHeight:1}}>×</button>
      </div>
      <div style={{padding:"24px"}}>{children}</div>
    </div>
  </div>
);}

function ConfirmDel({msg,onCancel,onConfirm}){return(
  <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
    <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"28px",maxWidth:"360px",width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
      <div style={{fontSize:"40px",marginBottom:"12px"}}>⚠️</div>
      <h3 style={{fontWeight:700,fontSize:"18px",color:"var(--fx-text)",margin:"0 0 10px"}}>¿Eliminar?</h3>
      <p style={{color:"var(--fx-muted)",fontSize:"14px",margin:"0 0 22px"}}>{msg}</p>
      <div style={{display:"flex",gap:"10px"}}>
        <button onClick={onCancel} style={{flex:1,border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"11px",color:"var(--fx-muted)",background:"var(--fx-card)",cursor:"pointer",fontWeight:600}}>Cancelar</button>
        <button onClick={onConfirm} style={{flex:1,background:"#ef4444",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",cursor:"pointer",fontWeight:700}}>Eliminar</button>
      </div>
    </div>
  </div>
);}

function PhotoPicker({value,onChange}){
  const [mode,setMode]=useState("url");
  const inp={width:"100%",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"8px 12px",fontSize:"13px",outline:"none",boxSizing:"border-box"};
  return(
    <div style={{marginBottom:"8px"}}>
      <label style={{display:"block",fontSize:"12px",fontWeight:700,color:"var(--fx-muted)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Foto</label>
      <div style={{display:"flex",alignItems:"flex-start",gap:"14px"}}>
        {value?<img loading="lazy" decoding="async" src={value} alt="" style={{width:56,height:56,borderRadius:"50%",objectFit:"cover",border:"3px solid #c084fc",flexShrink:0}}/>
          :<div style={{width:56,height:56,borderRadius:"50%",background:"var(--fx-hover)",border:"2px dashed #cbd5e1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0}}>🖼️</div>}
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}>
            <button type="button" onClick={()=>setMode("url")} style={{background:mode==="url"?"#9333ea":"#f1f5f9",color:mode==="url"?"#fff":"#475569",border:"none",borderRadius:"8px",padding:"5px 12px",fontSize:"12px",cursor:"pointer",fontWeight:600}}>URL</button>
            <button type="button" onClick={()=>{onChange("https://static.flashscore.com/res/image/empty-face-woman-share.gif");setMode("url");}} style={{background:"var(--fx-hover)",color:"var(--fx-label)",border:"none",borderRadius:"8px",padding:"5px 12px",fontSize:"12px",cursor:"pointer",fontWeight:600}}>🖼️ Default</button>
            {value&&<button type="button" onClick={()=>onChange(null)} style={{background:"none",border:"none",fontSize:"11px",color:"#ef4444",cursor:"pointer",marginLeft:"auto"}}>Eliminar</button>}
          </div>
          {mode==="url"&&<input style={inp} value={value&&!value.startsWith("data:")?value:""} onChange={e=>onChange(e.target.value||null)} placeholder="https://ejemplo.com/foto.jpg"/>}
        </div>
      </div>
    </div>
  );
}

function EscudoPicker({value,onChange}){
  const inp={width:"100%",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"8px 12px",fontSize:"13px",outline:"none",boxSizing:"border-box"};
  return(
    <div style={{marginBottom:"8px"}}>
      <label style={{display:"block",fontSize:"12px",fontWeight:700,color:"var(--fx-muted)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Escudo</label>
      <div style={{display:"flex",alignItems:"flex-start",gap:"14px"}}>
        {value?<img loading="lazy" decoding="async" src={value} alt="" style={{width:56,height:56,borderRadius:"8px",objectFit:"contain",border:"1.5px solid var(--fx-border)",flexShrink:0,background:"var(--fx-card)"}} onError={e=>e.target.style.display="none"}/>
          :<div style={{width:56,height:56,borderRadius:"8px",background:"var(--fx-hover)",border:"2px dashed #cbd5e1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0}}>🛡️</div>}
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}>
            <button type="button" onClick={()=>onChange("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ5paClUbICyOfUdZW-l6ZpDux6XhXG3HmDkw&s")} style={{background:"var(--fx-hover)",color:"var(--fx-label)",border:"none",borderRadius:"8px",padding:"5px 12px",fontSize:"12px",cursor:"pointer",fontWeight:600}}>🛡️ Default</button>
            {value&&<button type="button" onClick={()=>onChange(null)} style={{background:"none",border:"none",fontSize:"11px",color:"#ef4444",cursor:"pointer",marginLeft:"auto"}}>Eliminar</button>}
          </div>
          <input style={inp} value={value||""} onChange={e=>onChange(e.target.value||null)} placeholder="https://ejemplo.com/escudo.png"/>
        </div>
      </div>
    </div>
  );
}

/* ── EmptyState ─── */
function EmptyState({icon,text,sub}){return(
  <div style={{textAlign:"center",padding:"80px 20px",color:"var(--fx-muted2)"}}>
    <div style={{fontSize:"48px",marginBottom:"12px"}}>{icon}</div>
    <div style={{fontWeight:600,color:"var(--fx-muted)",fontSize:"16px"}}>{text}</div>
    {sub&&<div style={{fontSize:"13px",marginTop:"6px"}}>{sub}</div>}
  </div>
);}


/* ── STATUS_BADGE ─── */
const STATUS_BADGE = {
  cantera: null,
  europea: <span title="Jugadora europea" style={{background:"var(--fx-blue-bg)",color:"var(--fx-blue-text)",border:"1.5px solid #bfdbfe",fontSize:"10px",fontWeight:800,padding:"2px 7px",borderRadius:"20px",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center"}}><img loading="lazy" decoding="async" src="https://flagcdn.com/20x15/eu.png" width={16} height={12} alt="EU" style={{display:"inline-block",verticalAlign:"middle",borderRadius:"2px",marginRight:"3px"}}/>Europea</span>,
  acp:     <span title="Acuerdo de Cotonú" style={{background:"var(--fx-amber-bg)",color:"var(--fx-amber-text)",border:"1.5px solid #fde68a",fontSize:"10px",fontWeight:800,padding:"2px 7px",borderRadius:"20px",whiteSpace:"nowrap"}}>🤝 ACP</span>,
  extra:   <span title="Extracomunitaria" style={{background:"var(--fx-hover)",color:"var(--fx-muted)",border:"1.5px solid #cbd5e1",fontSize:"10px",fontWeight:800,padding:"2px 7px",borderRadius:"20px",whiteSpace:"nowrap"}}>🌍 Extra</span>,
};


/* ── STATUS_BADGE_LG ─── */
const STATUS_BADGE_LG = {
  cantera: null,
  europea: <span title="Jugadora europea" style={{background:"var(--fx-blue-bg)",color:"var(--fx-blue-text)",border:"1.5px solid #bfdbfe",fontSize:"12px",fontWeight:800,padding:"3px 10px",borderRadius:"20px",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center"}}><img loading="lazy" decoding="async" src="https://flagcdn.com/20x15/eu.png" width={16} height={12} alt="EU" style={{display:"inline-block",verticalAlign:"middle",borderRadius:"2px",marginRight:"3px"}}/>Europea</span>,
  acp:     <span title="Acuerdo de Cotonú" style={{background:"var(--fx-amber-bg)",color:"var(--fx-amber-text)",border:"1.5px solid #fde68a",fontSize:"12px",fontWeight:800,padding:"3px 10px",borderRadius:"20px",whiteSpace:"nowrap"}}>🤝 Cotonú</span>,
  extra:   <span title="Extracomunitaria" style={{background:"var(--fx-hover)",color:"var(--fx-muted)",border:"1.5px solid #cbd5e1",fontSize:"12px",fontWeight:800,padding:"3px 10px",borderRadius:"20px",whiteSpace:"nowrap"}}>🌍 Extra</span>,
};


/* ── PaisDropdown ─── */
function PaisDropdown({allPaises,filterPais,setFilterPais,placeholder}){
  const t = useT();
  const [open,setOpen]=useState(false);
  const ref=useRef();
  placeholder=placeholder||t("filter.pais");
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  return(
    <div ref={ref} style={{position:"relative",flexShrink:0}}>
      <div onClick={()=>setOpen(o=>!o)} style={{border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",color:filterPais?"#9333ea":"#475569",background:"var(--fx-card)",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",whiteSpace:"nowrap",fontWeight:filterPais?700:400,height:"40px",boxSizing:"border-box",minWidth:"140px"}}>
        {filterPais?<><FlagImg country={filterPais}/><span>{filterPais}</span></>:<span>{placeholder}</span>}
        <span style={{marginLeft:"auto",fontSize:"10px"}}>▼</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:100,background:"var(--fx-card)",border:"1.5px solid var(--fx-border)",borderRadius:"12px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",minWidth:"180px",maxHeight:"280px",overflowY:"auto",padding:"8px 0"}}>
          <div onClick={()=>{setFilterPais("");setOpen(false);}} style={{padding:"8px 14px",fontSize:"12px",color:"var(--fx-muted2)",cursor:"pointer",fontWeight:600,borderBottom:"1px solid var(--fx-border2)"}}>
            {t("filter.todos_paises")}
          </div>
          {(allPaises||[]).map(p=>{
            const checked=filterPais===p;
            return(
              <div key={p} onClick={()=>{setFilterPais(checked?"":p);setOpen(false);}}
                style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 14px",cursor:"pointer",background:checked?"var(--fx-amber-bg)":"transparent"}}
                onMouseEnter={e=>e.currentTarget.style.background=checked?"var(--fx-amber-bg)":"var(--fx-hover)"}
                onMouseLeave={e=>e.currentTarget.style.background=checked?"var(--fx-amber-bg)":"transparent"}>
                <FlagImg country={p}/>
                <span style={{fontSize:"13px",color:"var(--fx-text)",fontWeight:checked?700:400}}>{p}</span>
                {checked&&<span style={{marginLeft:"auto",color:"#9333ea",fontSize:"12px"}}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


/* ── CoachSeasonForm ─── */
function CoachSeasonForm({initial,equipos,ligas,onSave,onCancel,saving}){
  const [f,setF]=useState({id_equipo:'',id_liga:'',temporada:'',orden:0,...initial});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:'100%',border:'1.5px solid var(--fx-border)',borderRadius:'10px',padding:'9px 12px',fontSize:'14px',outline:'none',boxSizing:'border-box'};
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
      <button onClick={onCancel} style={{background:'var(--fx-hover)',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.id_equipo||!f.id_liga||!f.temporada} style={{background:'#9333ea',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
    </div>
  </div>);
}


export {
  POSITIONS, TIPO_LABELS, TIPO_COLORS, CHIP_STYLES, POS_C,
  COUNTRY_CODES, ACP_COUNTRIES, EU_COUNTRIES, NO_COUNTRY_FLAGS,
  inp, posStyle, calcAge,
  getCurrentSeason, firstFreeId, firstFreeIdNum, nextSeason, prevSeasonOf,
  resolveTeamData, resolveTeamName,
  isACP, playerStatus, esEquipoEuropeo, countryCode, flagEmoji, countryFlagEmoji,
  teamHue, teamColors, teamInitials, sortS,
  Chip, FlagImg, MultiFlag, SocialIcon,
  TeamBadge, LeagueBadge, Avatar, PhotoLightbox,
  Fld, CalendarSubscribeBtn, Breadcrumbs, Modal, ConfirmDel, PhotoPicker, EscudoPicker,
  EmptyState, STATUS_BADGE, STATUS_BADGE_LG, PaisDropdown, CoachSeasonForm,
};
