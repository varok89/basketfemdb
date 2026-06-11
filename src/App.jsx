import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qvtxqckuolacvnvrvysu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dHhxY2t1b2xhY3ZudnJ2eXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzQ3OTYsImV4cCI6MjA5MzgxMDc5Nn0.0B93gvnlkGPTstRQKskzvUQOdDHeQ1vr2dwS97lhCjQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchAll(table, opts={}) {
  const {order="id", ascending=true} = opts;
  let all = [], from = 0;
  const PAGE = 1000;
  while (true) {
    const {data, error} = await supabase.from(table).select("*").order(order,{ascending}).range(from, from+PAGE-1);
    if (error) throw error;
    all = all.concat(data||[]);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return {data: all};
}

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
const TIPO_COLORS = {
  liga:    ["#dbeafe","#1d4ed8"],
  copacont:["#f3e8ff","#7c3aed"],
  copadom: ["#dcfce7","#15803d"],
  internacional: ["#e0f2fe","#0369a1"],
};

const calcAge = d => d ? Math.floor((Date.now()-new Date(d))/(365.25*24*3600*1000)) : null;

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
  "moldova":"md",
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
  "trinidad and tobago":"tt","trinidad y tobago":"tt",
  "bahamas":"bs",
  "barbados":"bb",
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
  "nigeria":"ng",
  "senegal":"sn",
  "mali":"ml",
  "cameroon":"cm","camerun":"cm","camerún":"cm",
  "angola":"ao",
  "mozambique":"mz",
  "uganda":"ug",
  "kenya":"ke","kenia":"ke",
  "ethiopia":"et","etiopia":"et","etiopía":"et",
  "ghana":"gh",
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
  "zimbabwe":"zw",
  "guinea":"gn",
  "cape verde":"cv","cabo verde":"cv",
  "gabon":"ga","gabón":"ga",
  "benin":"bj","benín":"bj",
  "togo":"tg",
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

  /* Oceanía */
  "fiji":"fj","fiyi":"fj",
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

function countryCode(c) {
  if (!c) return null;
  return COUNTRY_CODES[c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim()] || null;
}

function FlagImg({ country }) {
  if (!country) return null;
  const norm = country.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  if (norm === "europa" || norm === "europe" || norm === "eu") return <img src="https://flagcdn.com/20x15/eu.png" width={20} height={15} alt="Europa" style={{display:"inline-block",verticalAlign:"middle",borderRadius:"2px",flexShrink:0,marginRight:"4px"}}/>;
  if (norm === "mundo" || norm === "world" || norm === "international" || norm === "internacional") return <span style={{fontSize:"14px",lineHeight:1,marginRight:"4px",verticalAlign:"middle"}}>🌍</span>;
  if (norm === "americas" || norm === "america" || norm === "amerique") return <span style={{fontSize:"14px",lineHeight:1,marginRight:"4px",verticalAlign:"middle"}}>🌎</span>;
  if (norm.includes("afric")) return <span style={{fontSize:"14px",lineHeight:1,marginRight:"4px",verticalAlign:"middle"}}>🌍</span>;
  if (norm === "asia" || norm === "oceania" || norm === "oceanía") return <span style={{fontSize:"14px",lineHeight:1,marginRight:"4px",verticalAlign:"middle"}}>🌏</span>;
  const code = countryCode(country);
  if (!code) return null;
  return <img src={`https://flagpedia.net/data/flags/w160/${code}.webp`} width={20} height={13} alt={country}
    style={{display:"inline-block",verticalAlign:"middle",borderRadius:"2px",flexShrink:0,marginRight:"4px"}}/>;
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
  if(team?.escudo) return <img src={team.escudo} alt={team.nombre} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:`2px solid ${bg}`}} onError={e=>e.target.style.display="none"}/>;
  return <div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:fs,flexShrink:0,boxShadow:"0 2px 6px rgba(0,0,0,0.2)"}}>{ini}</div>;
}

function LeagueBadge({liga,size=60}){
  const [bg,color]=TIPO_COLORS[liga?.tipo]||["#f1f5f9","#475569"];
  const fs=size<40?10:size<60?14:18;
  if(liga?.logo) return <img src={liga.logo} alt={liga.nombre} style={{width:size,height:size,objectFit:"contain",flexShrink:0,borderRadius:"10px"}} onError={e=>e.target.style.display="none"}/>;
  return <div style={{width:size,height:size,borderRadius:"10px",background:bg,display:"flex",alignItems:"center",justifyContent:"center",color,fontWeight:800,fontSize:fs,flexShrink:0,textAlign:"center",padding:"4px"}}>{liga?.nombre?.split(" ").map(w=>w[0]).slice(0,3).join("")||"?"}</div>;
}

function Avatar({photo,name,size=48,fontSize=18}){
  const ini=(name||"").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  if(photo) return <img src={photo} alt={name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"2px solid #e2e8f0"}} onError={e=>e.target.style.display="none"}/>;
  return <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,#f97316,#fb923c)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontWeight:800,fontSize,letterSpacing:"-0.5px"}}>{ini}</div>;
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
        {value?<img src={value} alt="" style={{width:56,height:56,borderRadius:"50%",objectFit:"cover",border:"3px solid #fb923c",flexShrink:0}}/>
          :<div style={{width:56,height:56,borderRadius:"50%",background:"#f1f5f9",border:"2px dashed #cbd5e1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",flexShrink:0}}>🖼️</div>}
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}>
            <button type="button" onClick={()=>setMode("url")} style={{background:mode==="url"?"#f97316":"#f1f5f9",color:mode==="url"?"#fff":"#475569",border:"none",borderRadius:"8px",padding:"5px 12px",fontSize:"12px",cursor:"pointer",fontWeight:600}}>URL</button>
            <button type="button" onClick={()=>setMode("file")} style={{background:mode==="file"?"#f97316":"#f1f5f9",color:mode==="file"?"#fff":"#475569",border:"none",borderRadius:"8px",padding:"5px 12px",fontSize:"12px",cursor:"pointer",fontWeight:600}}>📷 Archivo</button>
            {value&&<button type="button" onClick={()=>onChange(null)} style={{background:"none",border:"none",fontSize:"11px",color:"#ef4444",cursor:"pointer",marginLeft:"auto"}}>Eliminar</button>}
          </div>
          {mode==="url"
            ?<input style={inp} value={value&&!value.startsWith("data:")?value:""} onChange={e=>onChange(e.target.value||null)} placeholder="https://ejemplo.com/foto.jpg"/>
            :<><button type="button" onClick={()=>ref.current.click()} style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"7px 12px",fontSize:"12px",color:"#475569",cursor:"pointer",fontWeight:600,width:"100%"}}>Seleccionar archivo...</button>
              <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/></>}
        </div>
      </div>
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
  const [f,setF]=useState({nombre:"",posicion:"Base",posicion2:"",nacionalidad:"",nacionalidad2:"",fecha_nac:"",altura_cm:"",foto:null,...initial});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  return(<div>
    <PhotoPicker value={f.foto} onChange={v=>setF(p=>({...p,foto:v}))}/>
    <Fld label="Nombre *"><input style={inp} value={f.nombre} onChange={set("nombre")} placeholder="Ej: Claudia Soriano"/></Fld>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
      <Fld label="Posición"><select style={inp} value={f.posicion} onChange={set("posicion")}>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></Fld>
      <Fld label="Altura (cm)"><input style={inp} type="number" value={f.altura_cm} onChange={set("altura_cm")} placeholder="180"/></Fld>
    </div>
    <Fld label="2ª Posición (opcional)"><select style={inp} value={f.posicion2} onChange={set("posicion2")}><option value="">— Ninguna —</option>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></Fld>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
      <Fld label="Nacionalidad"><input style={inp} value={f.nacionalidad} onChange={set("nacionalidad")} placeholder="España"/></Fld>
      <Fld label="2ª Nacionalidad"><input style={inp} value={f.nacionalidad2||""} onChange={set("nacionalidad2")} placeholder="Opcional"/></Fld>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
      <Fld label="Fecha nac."><input style={inp} type="date" value={f.fecha_nac||""} onChange={set("fecha_nac")}/></Fld>
    </div>
    <div style={{display:"flex",gap:"10px",marginTop:"8px"}}>
      <button onClick={onCancel} style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"11px",color:"#64748b",background:"#fff",cursor:"pointer",fontWeight:600}}>Cancelar</button>
      <button onClick={()=>f.nombre.trim()&&onSave(f)} disabled={saving||!f.nombre.trim()} style={{flex:1,background:f.nombre.trim()?"#f97316":"#fed7aa",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",cursor:f.nombre.trim()?"pointer":"not-allowed",fontWeight:700}}>{saving?"Guardando...":"Guardar"}</button>
    </div>
  </div>);}

function SeasonForm({initial,equipos,ligas,onSave,onCancel,saving}){
  const [f,setF]=useState({temporada:"",id_equipo:"",id_liga:"",...initial});
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
      // Misma liga del país
      if(paisLiga===paisEquipo) return true;
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
    <div style={{display:"flex",gap:"10px",marginTop:"8px"}}>
      <button onClick={onCancel} style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"11px",color:"#64748b",background:"#fff",cursor:"pointer",fontWeight:600}}>Cancelar</button>
      <button onClick={()=>ok&&onSave(f)} disabled={saving||!ok} style={{flex:1,background:ok?"#f97316":"#fed7aa",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",cursor:ok?"pointer":"not-allowed",fontWeight:700}}>{saving?"Guardando...":"Guardar"}</button>
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
      <div onClick={()=>setOpen(o=>!o)} style={{border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:filterStatus?"#f97316":"#475569",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",whiteSpace:"nowrap",fontWeight:filterStatus?700:400,minWidth:"190px"}}>
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
                {active&&<span style={{marginLeft:"auto",color:"#f97316"}}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── DuplicatesModal ────────────────────────────────────── */
function DuplicatesModal({players,equipos,ligas,coaches,onClose,onGoToPlayer,onGoToTeam,onGoToLeague,onGoToCoach}){
  const [tab,setTab]=useState("jugadoras");
  const [ignored,setIgnored]=useState(new Set());  // claves "tipo|ids" ignoradas
  const [loading,setLoading]=useState(true);

  const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim();

  // Cargar lista de ignorados desde Supabase
  useEffect(()=>{
    (async()=>{
      try{
        const{data}=await supabase.from("duplicados_ignorados").select("tipo,ids");
        const s=new Set((data||[]).map(r=>`${r.tipo}|${r.ids}`));
        setIgnored(s);
      }catch(e){console.error("Error cargando ignorados:",e);}
      setLoading(false);
    })();
  },[]);

  const groupKey=(tipo,items,idKey)=>{
    const ids=items.map(it=>it[idKey]).sort().join(",");
    return `${tipo}|${ids}`;
  };

  const findDupes=(items,nameKey,idKey,tipo)=>{
    const groups={};
    items.forEach(it=>{
      const key=norm(it[nameKey]);
      if(!key)return;
      if(!groups[key])groups[key]=[];
      groups[key].push(it);
    });
    return Object.entries(groups)
      .filter(([,arr])=>arr.length>1)
      .map(([key,arr])=>({key,items:arr,gk:groupKey(tipo,arr,idKey)}))
      .filter(g=>!ignored.has(g.gk));
  };

  const dupes={
    jugadoras:findDupes(players,"nombre","id_jugadora","jugadoras"),
    equipos:findDupes(equipos,"nombre","id_equipo","equipos"),
    ligas:findDupes(ligas,"nombre","id_liga","ligas"),
    coaches:findDupes(coaches,"nombre","id_coach","coaches"),
  };

  const ignoreGroup=async(tipo,group)=>{
    const gk=group.gk;
    const ids=group.items.map(it=>it[{jugadoras:"id_jugadora",equipos:"id_equipo",ligas:"id_liga",coaches:"id_coach"}[tipo]]).sort().join(",");
    try{
      await supabase.from("duplicados_ignorados").insert({tipo,clave:group.key,ids});
      setIgnored(prev=>new Set([...prev,gk]));
    }catch(e){alert("Error al guardar: "+(e.message||JSON.stringify(e)));}
  };

  const TABS=[
    {key:"jugadoras",label:"Jugadoras",icon:"👩‍🏀",idKey:"id_jugadora",onGo:onGoToPlayer},
    {key:"equipos",label:"Equipos",icon:"🏟️",idKey:"id_equipo",onGo:onGoToTeam},
    {key:"ligas",label:"Ligas",icon:"🏆",idKey:"id_liga",onGo:onGoToLeague},
    {key:"coaches",label:"Coaches",icon:"📋",idKey:"id_coach",onGo:onGoToCoach},
  ];
  const activeTab=TABS.find(t=>t.key===tab);
  const activeDupes=dupes[tab];
  const totalDupes=Object.values(dupes).reduce((a,d)=>a+d.length,0);

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",fontFamily:"system-ui,sans-serif"}}>
      <div style={{background:"#fff",borderRadius:"20px",width:"560px",maxWidth:"100%",maxHeight:"86vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"24px 24px 16px"}}>
          <div>
            <h2 style={{fontWeight:800,fontSize:"18px",color:"#1e293b",margin:0}}>🔍 Detector de duplicados</h2>
            <p style={{fontSize:"12px",color:"#94a3b8",margin:"4px 0 0"}}>{loading?"Cargando...":totalDupes===0?"No se han detectado duplicados":`${totalDupes} posible${totalDupes!==1?"s":""} grupo${totalDupes!==1?"s":""} de duplicados`}</p>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"22px",color:"#94a3b8",cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",gap:"4px",padding:"0 24px 12px",borderBottom:"1px solid #f1f5f9"}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{flex:1,background:tab===t.key?"#fff7ed":"transparent",border:tab===t.key?"1.5px solid #fed7aa":"1.5px solid transparent",borderRadius:"10px",padding:"8px 6px",cursor:"pointer",fontSize:"12px",fontWeight:700,color:tab===t.key?"#c2410c":"#94a3b8"}}>
              <div style={{fontSize:"16px"}}>{t.icon}</div>
              {dupes[t.key].length>0&&<span style={{display:"inline-block",marginTop:"2px",background:"#ef4444",color:"#fff",borderRadius:"10px",padding:"0 6px",fontSize:"10px"}}>{dupes[t.key].length}</span>}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 24px 24px"}}>
          {activeDupes.length===0?(
            <div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8"}}>
              <div style={{fontSize:"40px",marginBottom:"8px"}}>✅</div>
              <p style={{fontSize:"14px",margin:0}}>Sin duplicados en {activeTab.label.toLowerCase()}</p>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
              {activeDupes.map((group,gi)=>(
                <div key={gi} style={{border:"1.5px solid #fed7aa",borderRadius:"14px",overflow:"hidden"}}>
                  <div style={{background:"#fff7ed",padding:"8px 14px",fontSize:"12px",fontWeight:700,color:"#c2410c",borderBottom:"1px solid #fed7aa",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span>{group.items.length} coincidencias</span>
                    <button onClick={()=>ignoreGroup(tab,group)} title="Marcar como falso positivo"
                      style={{background:"#fff",border:"1.5px solid #cbd5e1",borderRadius:"8px",padding:"3px 10px",fontSize:"11px",fontWeight:700,color:"#64748b",cursor:"pointer"}}>
                      ✓ No es duplicado
                    </button>
                  </div>
                  {group.items.map((it,ii)=>(
                    <div key={ii} onClick={()=>{activeTab.onGo&&activeTab.onGo(it[activeTab.idKey]);onClose();}}
                      style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",cursor:"pointer",borderBottom:ii<group.items.length-1?"1px solid #f8fafc":"none"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div>
                        <div style={{fontSize:"14px",fontWeight:600,color:"#1e293b"}}>{it.nombre}</div>
                        <div style={{fontSize:"11px",color:"#94a3b8",fontFamily:"monospace"}}>{it[activeTab.idKey]}{it.nacionalidad?` · ${it.nacionalidad}`:""}{it.pais?` · ${it.pais}`:""}</div>
                      </div>
                      <span style={{fontSize:"12px",color:"#f97316",fontWeight:700}}>Ver →</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
/* ── ExportModal ────────────────────────────────────────── */
function ExportModal({tables,onClose}){
  const [selected,setSelected]=useState(new Set(tables.map(t=>t.key)));
  const toggle=key=>setSelected(prev=>{const s=new Set(prev);s.has(key)?s.delete(key):s.add(key);return s;});
  const quoteCSV = value => {
    const str = value == null ? "" : String(value);
    return `"${str.replace(/"/g,'""')}"`;
  };
  const toCSV = (data, cols) => [
    cols.map(quoteCSV).join(","),
    ...data.map(row => cols.map(col => quoteCSV(row[col])).join(","))
  ].join("\r\n");
  const doExport=()=>{
    const date=new Date().toISOString().slice(0,10);
    tables.filter(t=>selected.has(t.key)).forEach(({key,data,cols})=>{
      const blob=new Blob([toCSV(data,cols)],{type:"text/csv;charset=utf-8;"});
      const a=document.createElement("a");a.href=URL.createObjectURL(blob);
      a.download=`basketfemdb_${key}_${date}.csv`;a.click();
    });
    onClose();
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <div style={{background:"#fff",borderRadius:"20px",padding:"28px",width:"360px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px"}}>
          <h2 style={{fontWeight:800,fontSize:"18px",color:"#1e293b",margin:0}}>📥 Exportar datos</h2>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"22px",color:"#94a3b8",cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
          <button onClick={()=>setSelected(new Set(tables.map(t=>t.key)))} style={{flex:1,background:"#f1f5f9",border:"none",borderRadius:"8px",padding:"6px",fontSize:"12px",fontWeight:600,cursor:"pointer",color:"#475569"}}>Seleccionar todo</button>
          <button onClick={()=>setSelected(new Set())} style={{flex:1,background:"#f1f5f9",border:"none",borderRadius:"8px",padding:"6px",fontSize:"12px",fontWeight:600,cursor:"pointer",color:"#475569"}}>Limpiar</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"20px"}}>
          {tables.map(t=>(
            <label key={t.key} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",borderRadius:"10px",border:`1.5px solid ${selected.has(t.key)?"#f97316":"#e2e8f0"}`,background:selected.has(t.key)?"#fff7ed":"#f8fafc",cursor:"pointer"}}>
              <input type="checkbox" checked={selected.has(t.key)} onChange={()=>toggle(t.key)} style={{accentColor:"#f97316",width:"16px",height:"16px",flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:"14px",color:"#1e293b"}}>{t.label}</div>
                <div style={{fontSize:"11px",color:"#94a3b8"}}>{t.data?.length||0} registros · {t.key}.csv</div>
              </div>
            </label>
          ))}
        </div>
        <button onClick={doExport} disabled={selected.size===0}
          style={{width:"100%",background:selected.size>0?"#f97316":"#fed7aa",color:"#fff",border:"none",borderRadius:"12px",padding:"12px",fontWeight:700,fontSize:"14px",cursor:selected.size>0?"pointer":"not-allowed"}}>
          Descargar {selected.size} archivo{selected.size!==1?"s":""}
        </button>
      </div>
    </div>
  );
}

/* ── GlobalSearch ───────────────────────────────────────── */
function GlobalSearch({players,equipos,ligas,coaches,onGoToPlayer,onGoToTeam,onGoToLeague,onGoToCoach}){
  const [q,setQ]=useState("");
  const [open,setOpen]=useState(false);
  const ref=useRef();
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);

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

  const go=(fn)=>{fn();setQ("");setOpen(false);};

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
                <Avatar photo={p.foto} name={p.nombre} size={32} fontSize={12}/>
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
function StatsHeader({stats}){
  return(
    <div className="bfdb-stats-grid" style={{display:"grid",gridTemplateColumns:`repeat(${stats.length},1fr)`,gap:"8px",marginBottom:"16px"}}>
      {stats.map(({icon,value,label,onClick})=>(
        <div key={label} onClick={onClick}
          style={{background:"#fff",borderRadius:"14px",padding:"12px 8px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",textAlign:"center",cursor:onClick?"pointer":"default",transition:"all 0.15s"}}
          onMouseEnter={e=>{if(onClick)e.currentTarget.style.boxShadow="0 4px 12px rgba(249,115,22,0.2)";}}
          onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
          <div style={{fontSize:"18px",marginBottom:"4px"}}>{icon}</div>
          <div style={{fontSize:"20px",fontWeight:800,color:onClick?"#f97316":"#1e293b"}}>{typeof value==="number"?value.toLocaleString("es"):value}</div>
          <div style={{fontSize:"11px",color:"#94a3b8",lineHeight:1.2}}>{label}</div>
        </div>
      ))}
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
      <div onClick={()=>setOpen(o=>!o)} style={{border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:filterNacs.size>0?"#f97316":"#475569",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",whiteSpace:"nowrap",fontWeight:filterNacs.size>0?700:400,minWidth:"200px"}}>
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
                <input type="checkbox" checked={checked} onChange={()=>setFilterNacs(prev=>{const s=new Set(prev);checked?s.delete(n):s.add(n);return s;})} style={{accentColor:"#f97316",width:"14px",height:"14px",flexShrink:0}}/>
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
function PlayersView({players,equipos,ligas,palmares,coaches,tempCoach,onReload,onGoToTeam,onGoToCoach,openPlayerId,onClearPlayer,isAdmin,onGoToTab,navHistory,onGoBack}){
  const [search,setSearch]         = useState("");
  const [filterPos,setFilterPos]   = useState("");
  const [filterNacs,setFilterNacs] = useState(new Set());
  const [filterLiga,setFilterLiga] = useState("");
  const [filterTemp,setFilterTemp] = useState("");
  const [filterStatus,setFilterStatus] = useState("");
  const [selId,setSelId]           = useState(openPlayerId||null);
  useEffect(()=>{const seg='jugadoras';window.history.replaceState({},"",selId?`/${seg}/${selId}`:`/${seg}`);},[selId]);
  const [modal,setModal]           = useState(null);
  const [editSeason,setEditSeason] = useState(null);
  const [del,setDel]               = useState(null);
  const [saving,setSaving]         = useState(false);
  const [seasonModal,setSeasonModal] = useState(null);
  const [delCoachItem,setDelCoachItem] = useState(null);
  const [saving3,setSaving3]       = useState(false);
  const [activeTipo,setActiveTipo] = useState(null);
  const photoRef = useRef();

  useEffect(()=>{if(openPlayerId){setSelId(openPlayerId);onClearPlayer();}},[openPlayerId]);

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

  const currentTipo    = activeTipo||defaultTipo;
  const filteredSeasons = useMemo(()=>{
    if(!selected) return [];
    const all=sortS(selected.seasons);
    return currentTipo ? all.filter(s=>ligaMap[s.id_liga]?.tipo===currentTipo) : all;
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
  const filtered = players.filter(p=>{
    const q=search.toLowerCase();
    const lastS=[...(p.seasons||[])].sort((a,b)=>b.temporada.localeCompare(a.temporada))[0];
    const lastLigNombre=lastS?ligaMap[lastS.id_liga]?.nombre:null;
    return(!q||p.nombre?.toLowerCase().includes(q)||p.id_jugadora?.toLowerCase().includes(q)||p.nacionalidad?.toLowerCase().includes(q)||p.seasons?.some(s=>equipoMap[s.id_equipo]?.nombre?.toLowerCase().includes(q)))
      &&(!filterPos||p.posicion===filterPos||p.posicion2===filterPos)
      &&(filterNacs.size===0||filterNacs.has(p.nacionalidad)||filterNacs.has(p.nacionalidad2))
      &&(!filterLiga||lastLigNombre===filterLiga)
      &&(!filterTemp||(p.seasons||[]).some(s=>s.temporada===filterTemp))
      &&(!filterStatus||playerStatus(p.nacionalidad,p.nacionalidad2)===filterStatus);
  }).sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||"","es"));

  const addPlayer=async f=>{
    setSaving(true);
    try{
      const allJIds=players.map(p=>parseInt((p.id_jugadora||"J0").slice(1))).filter(n=>!isNaN(n));
      const newId=`J${Math.max(0,...allJIds)+1}`;
      const{error}=await supabase.from("jugadoras").insert({id_jugadora:newId,nombre:f.nombre,posicion:f.posicion,posicion2:f.posicion2||null,nacionalidad:f.nacionalidad,nacionalidad2:f.nacionalidad2||null,fecha_nac:f.fecha_nac||null,altura_cm:f.altura_cm?parseInt(f.altura_cm):null,foto:f.foto||null});
      if(error)throw error;
      await onReload();setModal(null);
    }catch(e){alert("Error al guardar jugadora: "+(e.message||e.details||JSON.stringify(e)));}
    setSaving(false);
  };
  const updPlayer=async f=>{
    setSaving(true);
    try{await supabase.from("jugadoras").update({nombre:f.nombre,posicion:f.posicion,posicion2:f.posicion2||null,nacionalidad:f.nacionalidad,nacionalidad2:f.nacionalidad2||null,fecha_nac:f.fecha_nac||null,altura_cm:f.altura_cm?parseInt(f.altura_cm):null,foto:f.foto||null}).eq("id_jugadora",selId);
      await onReload();setModal(null);}catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const delPlayer=async()=>{
    try{await supabase.from("temporadas").delete().eq("id_jugadora",selId);
      await supabase.from("jugadoras").delete().eq("id_jugadora",selId);
      await onReload();setSelId(null);setDel(null);}catch(e){alert("Error: "+e.message);}
  };
  const addSeason=async f=>{
    setSaving(true);
    try{
      const allIds=players.flatMap(p=>p.seasons||[]).map(s=>parseInt(s.id)).filter(n=>!isNaN(n));
      const newId=(Math.max(0,...allIds)+1);
      await supabase.from("temporadas").insert({id:newId,id_jugadora:selId,id_equipo:f.id_equipo,id_liga:f.id_liga,temporada:f.temporada});
      await onReload();setModal(null);}catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const updSeason=async f=>{
    setSaving(true);
    try{await supabase.from("temporadas").update({id_equipo:f.id_equipo,id_liga:f.id_liga,temporada:f.temporada}).eq("id",editSeason.id);
      await onReload();setModal(null);setEditSeason(null);}catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const delSeason=async id=>{
    try{await supabase.from("temporadas").delete().eq("id",id);await onReload();setDel(null);}catch(e){alert("Error: "+e.message);}
  };
  const saveCoachSeasonInPlayer=async(f,coachId)=>{
    setSaving3(true);
    try{
      if(seasonModal==="add"){
        const {data}=await supabase.from("temporadas_coach").select("id").order("id",{ascending:false}).limit(1);
        const newId=(data?.[0]?.id||0)+1;
        await supabase.from("temporadas_coach").insert({id:newId,id_coach:coachId,...f,orden:parseInt(f.orden)||0});
      } else {
        await supabase.from("temporadas_coach").update({...f,orden:parseInt(f.orden)||0}).eq("id",seasonModal.id);
      }
      await onReload();setSeasonModal(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving3(false);
  };
  const delCoachSeasonInPlayer=async(id)=>{
    try{await supabase.from("temporadas_coach").delete().eq("id",id);await onReload();setDelCoachItem(null);}catch(e){alert("Error: "+e.message);}
  };

  if(players.length===0) return <EmptyState icon="👩‍🏀" text="No hay jugadoras" sub="Verifica la conexión con Supabase"/>;

  if(selected) return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"20px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
        {(()=>{const prev=navHistory&&navHistory.length>0?navHistory[navHistory.length-1]:null;return prev?(<button onClick={onGoBack} style={{background:"none",border:"none",color:"#fb923c",fontSize:"15px",cursor:"pointer",fontWeight:600,padding:0}}>← Volver a {prev.label}</button>):(<button onClick={()=>{setSelId(null);setActiveTipo(null);}} style={{background:"none",border:"none",color:"#fb923c",fontSize:"15px",cursor:"pointer",fontWeight:600,padding:0}}>← Volver</button>);})()}
        {isAdmin&&!del&&(
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>setModal("editPlayer")} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#475569"}}>✏️ Editar</button>
            <button onClick={()=>setDel("player")} style={{background:"#fee2e2",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
          </div>
        )}
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
          <Avatar photo={selected.foto} name={selected.nombre} size={90} fontSize={30}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"8px"}}>
              <div><h1 style={{fontWeight:800,fontSize:"21px",color:"#1e293b",margin:0}}>{selected.nombre}</h1>{isAdmin&&<span style={{fontSize:"11px",color:"#94a3b8",fontFamily:"monospace"}}>{selected.id_jugadora}</span>}</div>
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
                return(<div style={{display:"flex",flexDirection:"column",gap:"4px",alignItems:"flex-end",flexShrink:0}}>{entries.map(([n,c])=>(<span key={n} style={{background:"#fffbeb",border:"1.5px solid #fed7aa",color:"#b45309",fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"20px",whiteSpace:"nowrap"}}>🏆 {c}x {n}</span>))}</div>);
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
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",flex:1}}>
                    {selected.altura_cm&&<div style={{fontSize:"13px"}}><span style={{color:"#94a3b8"}}>Altura: </span><span style={{fontWeight:600,color:"#334155"}}>{selected.altura_cm} cm</span></div>}
                    {selected.fecha_nac&&<div style={{fontSize:"13px"}}><span style={{color:"#94a3b8"}}>Edad: </span><span style={{fontWeight:600,color:"#334155"}}>{calcAge(selected.fecha_nac)} años</span></div>}
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
      <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"10px"}}>
          <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:0}}>Historial <span style={{color:"#94a3b8",fontWeight:400,fontSize:"14px"}}>({selected.seasons.length})</span></h2>
          {isAdmin&&<button onClick={()=>setModal("addSeason")} style={{background:"#f97316",color:"#fff",border:"none",borderRadius:"10px",padding:"8px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Temporada</button>}
        </div>
        {isAdmin&&modal==="addSeason"&&<Modal title="Añadir temporada" onClose={()=>setModal(null)}><SeasonForm equipos={equipos} ligas={ligas} onSave={addSeason} onCancel={()=>setModal(null)} saving={saving}/></Modal>}
        {playerTipos.length>1&&(
          <div style={{marginBottom:"16px",paddingBottom:"14px",borderBottom:"1px solid #f1f5f9"}}>
            <select value={currentTipo||""} onChange={e=>setActiveTipo(e.target.value||null)}
              style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none",width:"100%"}}>
              <option value="">Todas las competiciones</option>
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
                <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:10,borderRadius:"50%",background:"#f97316",display:"inline-block"}}/> Jugadora</span>
                <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:10,borderRadius:"50%",background:"#3b82f6",display:"inline-block"}}/> Entrenadora</span>
              </div>}
              <div style={{position:"relative"}}>
                <div style={{position:"absolute",left:"11px",top:"10px",bottom:"10px",width:"2px",background:"linear-gradient(to bottom,#fed7aa,#bfdbfe)"}}/>
                <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                  {merged.map((s,i)=>{
                    const isCoach=s._type==="coach";
                    const eq=equipoMap[s.id_equipo],lig=ligaMap[s.id_liga];
                    const dotColor=isCoach?(i===0?"#3b82f6":"#93c5fd"):(i===0?"#f97316":"#fdba74");
                    return(
                      <div key={(isCoach?"c":"p")+s.id} style={{display:"flex",gap:"16px",alignItems:"flex-start",paddingLeft:"32px",position:"relative"}}>
                        <div style={{position:"absolute",left:"6px",top:"14px",width:"12px",height:"12px",borderRadius:"50%",background:dotColor,border:"3px solid #fff",boxShadow:`0 0 0 2px ${dotColor}`}}/>
                        <div style={{flex:1,background:isCoach?"#eff6ff":"#f8fafc",borderRadius:"12px",padding:"12px 14px",border:`1.5px solid ${isCoach?"#bfdbfe":"#e2e8f0"}`,cursor:"pointer"}}
                          onClick={()=>onGoToTeam(s.id_equipo,s.temporada,{tab:"jugadoras",id:selected?.id_jugadora,label:selected?.nombre})}
                          onMouseEnter={e=>{e.currentTarget.style.background=isCoach?"#dbeafe":"#fff7ed";e.currentTarget.style.borderColor=isCoach?"#93c5fd":"#fb923c";}}
                          onMouseLeave={e=>{e.currentTarget.style.background=isCoach?"#eff6ff":"#f8fafc";e.currentTarget.style.borderColor=isCoach?"#bfdbfe":"#e2e8f0";}}>
                          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                            <TeamBadge team={eq} size={30}/>
                            <div>
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"6px",flexWrap:"wrap"}}>
                                <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                                  <span style={{fontWeight:700,fontSize:"14px",color:"#1e293b"}}>{s.temporada} · </span>
                                  <span style={{color:isCoach?"#3b82f6":"#f97316",fontWeight:700,textDecoration:"underline"}}>{eq?.nombre||s.id_equipo}</span>
                                  {isCoach&&<span style={{background:"#dbeafe",color:"#1d4ed8",fontSize:"10px",fontWeight:700,padding:"1px 6px",borderRadius:"20px"}}>📋 Coach</span>}
                                  {isAdmin&&isCoach&&<div style={{display:"flex",gap:"4px",marginLeft:"auto"}} onClick={e=>e.stopPropagation()}><button onClick={()=>setSeasonModal(s)} style={{background:"#f1f5f9",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#475569"}}>✏️</button><button onClick={()=>setDelCoachItem({type:"season",id:s.id})} style={{background:"#fee2e2",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#ef4444"}}>🗑️</button></div>}
                                </div>
                                {isAdmin&&!isCoach&&<div style={{display:"flex",gap:"4px"}} onClick={e=>e.stopPropagation()}>
                                  <button onClick={()=>{setEditSeason(s);setModal("editSeason");}} style={{background:"#f1f5f9",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#475569"}}>✏️</button>
                                  <button onClick={()=>setDel(s.id)} style={{background:"#fee2e2",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
                                </div>}
                              </div>
                              <div style={{fontSize:"12px",color:"#64748b",marginTop:"2px",display:"flex",alignItems:"center",gap:"4px"}}>{lig?.pais&&<FlagImg country={lig.pais}/>}{lig?.nombre||s.id_liga}</div>
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
      {isAdmin&&seasonModal&&(()=>{
        const coachRecord=(coaches||[]).find(c=>String(c.id_jugadora)===String(selected.id_jugadora));
        return coachRecord?(<Modal title={seasonModal==="add"?"Añadir temporada coach":"Editar temporada coach"} onClose={()=>setSeasonModal(null)}>
          <CoachSeasonForm initial={seasonModal!=="add"?seasonModal:null} equipos={equipos} ligas={ligas} onSave={f=>saveCoachSeasonInPlayer(f,coachRecord.id_coach)} onCancel={()=>setSeasonModal(null)} saving={saving3}/>
        </Modal>):null;
      })()}
      {isAdmin&&delCoachItem?.type==="season"&&<ConfirmDel msg="¿Eliminar esta temporada de coach?" onCancel={()=>setDelCoachItem(null)} onConfirm={()=>delCoachSeasonInPlayer(delCoachItem.id)}/>}
      {isAdmin&&modal&&(
        <Modal title={modal==="addSeason"?"Añadir temporada":modal==="editSeason"||editSeason?"Editar temporada":modal==="addPlayer"?"Nueva jugadora":"Editar jugadora"} onClose={()=>{setModal(null);setEditSeason(null);}}>
          {(modal==="addSeason")&&<SeasonForm equipos={equipos} ligas={ligas} onSave={addSeason} onCancel={()=>setModal(null)} saving={saving}/>}
          {(editSeason)&&<SeasonForm initial={editSeason} equipos={equipos} ligas={ligas} onSave={updSeason} onCancel={()=>{setEditSeason(null);}} saving={saving}/>}
          {(modal==="addPlayer")&&<PlayerForm onSave={addPlayer} onCancel={()=>setModal(null)} saving={saving}/>}
          {(modal==="editPlayer")&&<PlayerForm initial={selected} onSave={updPlayer} onCancel={()=>setModal(null)} saving={saving}/>}
        </Modal>
      )}
      {isAdmin&&del&&del!=="player"&&(
        <ConfirmDel msg="¿Eliminar esta temporada?" onCancel={()=>setDel(null)} onConfirm={()=>delSeason(del)}/>
      )}
    </div>
  );

  return(
    <div className="bfdb-container" style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      {isAdmin&&modal==="addPlayer"&&<Modal title="Nueva jugadora" onClose={()=>setModal(null)}><PlayerForm onSave={addPlayer} onCancel={()=>setModal(null)} saving={saving}/></Modal>}
      {isAdmin&&<div style={{display:"flex",justifyContent:"flex-end",marginBottom:"12px"}}><button onClick={()=>setModal("addPlayer")} style={{background:"#f97316",color:"#fff",border:"none",borderRadius:"10px",padding:"8px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Jugadora</button></div>}
      <div className="bfdb-stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",marginBottom:"16px"}}>
        {(()=>{
          const nJugadoras=players.length;
          const nEquipos=equipos.length;
          const nLigas=ligas.length;
          const nCoaches=coaches.length;
          const nTemporadas=players.flatMap(p=>p.seasons||[]).length;
          const nTempCoach=(tempCoach||[]).length;
          const nPalmares=(palmares||[]).length;
          const total=nJugadoras+nEquipos+nLigas+nCoaches+nTemporadas+nTempCoach+nPalmares;
          const tabMap={"Jugadoras":"jugadoras","Equipos":"equipos","Ligas":"ligas","Coaches":"cuerpo_tecnico"};
          return [
            ["👩‍🏀",nJugadoras,"Jugadoras"],
            ["🏟️",nEquipos,"Equipos"],
            ["🏆",nLigas,"Ligas"],
            ["📋",nCoaches,"Coaches"],
            ["🗂️",total.toLocaleString("es"),"Registros totales"],
          ].map(([e,v,l])=>{
            const targetTab=tabMap[l];
            return(
            <div key={l} onClick={targetTab?()=>onGoToTab&&onGoToTab(targetTab):undefined}
              style={{background:"#fff",borderRadius:"14px",padding:"12px 8px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",textAlign:"center",cursor:targetTab?"pointer":"default",transition:"all 0.15s"}}
              onMouseEnter={e=>{if(targetTab)e.currentTarget.style.boxShadow="0 4px 12px rgba(249,115,22,0.2)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
              <div style={{fontSize:"18px",marginBottom:"4px"}}>{e}</div>
              <div style={{fontSize:"20px",fontWeight:800,color:targetTab?"#f97316":"#1e293b"}}>{v}</div>
              <div style={{fontSize:"11px",color:"#94a3b8",lineHeight:1.2}}>{l}</div>
            </div>
          );});
        })()}
      </div>
      <div className="bfdb-filter-row" style={{display:"flex",gap:"8px",marginBottom:"8px",flexWrap:"wrap",alignItems:"stretch"}}>
        <input style={{flex:"1 1 200px",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",color:"#1e293b",outline:"none",background:"#fff",height:"40px",boxSizing:"border-box"}}
          placeholder="🔍 Nombre de jugadora..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterPos?"#f97316":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterPos?700:400}} value={filterPos} onChange={e=>setFilterPos(e.target.value)}>
          <option value="">Posición</option>
          {POSITIONS.map(p=><option key={p}>{p}</option>)}
        </select>
        <select style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterLiga?"#f97316":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterLiga?700:400}} value={filterLiga} onChange={e=>setFilterLiga(e.target.value)}>
          <option value="">Liga</option>
          {allLigasPlayer.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        <select style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterTemp?"#f97316":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterTemp?700:400}} value={filterTemp} onChange={e=>setFilterTemp(e.target.value)}>
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
            <span key={n} style={{background:"#fff7ed",border:"1.5px solid #fed7aa",color:"#f97316",fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"20px",display:"inline-flex",alignItems:"center",gap:"3px"}}>
              <FlagImg country={n}/>{n}
            </span>
          ))}
          <span onClick={()=>setFilterNacs(new Set())} style={{background:"#f1f5f9",color:"#64748b",fontSize:"11px",fontWeight:600,padding:"2px 8px",borderRadius:"20px",cursor:"pointer"}}>✕ Limpiar</span>
        </div>
      )}
      <div style={{fontSize:"13px",color:"#94a3b8",marginBottom:"12px"}}>{filtered.length} jugadora{filtered.length!==1?"s":""}</div>
      <div className="bfdb-cards-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"12px"}}>
        {filtered.map(p=>{
          const allS=sortS(p.seasons||[]);
          const last=allS.find(s=>ligaMap[s.id_liga]?.tipo==="liga")||allS[0];
          const lastEq=last?equipoMap[last.id_equipo]:null;
          return(
            <div key={p.id_jugadora} onClick={()=>{setSelId(p.id_jugadora);setActiveTipo(null);window.scrollTo({top:0,behavior:"smooth"});}}
              style={{background:"#fff",borderRadius:"16px",padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",border:"2px solid transparent",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#fb923c";e.currentTarget.style.boxShadow="0 4px 18px rgba(249,115,22,0.18)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"12px"}}>
                <Avatar photo={p.foto} name={p.nombre} size={48} fontSize={18}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:"15px",color:"#1e293b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.nombre}</div>
                  <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"1px",display:"flex",alignItems:"center",gap:"3px"}}>{p.nacionalidad&&<FlagImg country={p.nacionalidad}/>}{p.nacionalidad2&&<FlagImg country={p.nacionalidad2}/>}{p.altura_cm&&<span>{p.nacionalidad||p.nacionalidad2?" · ":""}{p.altura_cm} cm</span>}</div>
                </div>
                <div className="bfdb-player-card-right" style={{display:"flex",flexDirection:"column",gap:"3px",alignItems:"flex-end",flexShrink:0}}><div className="bfdb-player-badges" style={{display:"flex",gap:"3px",flexWrap:"wrap",justifyContent:"flex-end"}}>{p.posicion&&<span style={posStyle(p.posicion)}>{p.posicion}</span>}{p.posicion2&&<span style={posStyle(p.posicion2)}>{p.posicion2}</span>}</div>{STATUS_BADGE[playerStatus(p.nacionalidad,p.nacionalidad2)]}</div>
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
              <div style={{marginTop:"10px",fontSize:"12px",color:"#f97316",fontWeight:600}}>{(p.seasons||[]).length} temporada{(p.seasons||[]).length!==1?"s":""}</div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

/* ── TeamForm ───────────────────────────────────────────── */
function TeamForm({initial,onSave,onCancel,saving}){
  const [f,setF]=useState({nombre:'',ciudad:'',pais:'',año_fundacion:'',escudo:'',tipo:'equipo',redes_sociales:'',...(initial||{})});
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
      <Fld label='Tipo'><select style={inp} value={f.tipo||'equipo'} onChange={set('tipo')}><option value='equipo'>Club</option><option value='seleccion'>Selección</option></select></Fld>
    </div>
    <Fld label='URL Escudo'><input style={inp} value={f.escudo||''} onChange={set('escudo')} placeholder='https://...'/></Fld>
    <Fld label='Redes sociales (URL)'><input style={inp} value={f.redes_sociales||''} onChange={set('redes_sociales')} placeholder='https://instagram.com/...'/></Fld>
    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'8px'}}>
      <button onClick={onCancel} style={{background:'#f1f5f9',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.nombre} style={{background:'#f97316',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
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
      <button onClick={()=>onSave(f)} disabled={saving||!f.id_liga||!f.temporada} style={{background:'#f97316',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
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
      <button onClick={()=>onSave(f)} disabled={saving||!f.id_jugadora||!f.id_liga||!f.temporada} style={{background:"#f97316",color:"#fff",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:700,cursor:"pointer"}}>{saving?"Guardando...":"Guardar"}</button>
    </div>
  </div>);
}

/* ── TeamsView ───────────────────────────────────────────── */
function TeamsView({equipos,players,ligas,palmares,coaches,tempCoach,onGoToPlayer,onGoToCoach,onGoToLeague,openTeamId,openTeamYear,onClearTeam,isAdmin,onReload,onGoToTab,navHistory,onGoBack}){
  const [search,setSearch]             = useState("");
  const [filterLeague,setFilterLeague] = useState("");
  const [filterSeason,setFilterSeason] = useState(null);
  const [filterTipo,setFilterTipo]     = useState("");
  const [selId,setSelId]               = useState(openTeamId||null);
  useEffect(()=>{const seg='equipos';window.history.replaceState({},"",selId?`/${seg}/${selId}`:`/${seg}`);},[selId]);
  const [selYear,setSelYear]           = useState(null);
  const [teamModal,setTeamModal]       = useState(null);
  const [palModal,setPalModal]         = useState(null);
  const [squadModal,setSquadModal]     = useState(null);
  const [saving,setSaving]             = useState(false);
  const [delItem,setDelItem]           = useState(null);

  const saveTeam=async(f)=>{
    setSaving(true);
    try{
      if(teamModal==="addTeam"){
        const ids=equipos.map(e=>parseInt(e.id_equipo.replace("E",""))).filter(n=>!isNaN(n));
        const newId="E"+(Math.max(0,...ids)+1).toString().padStart(3,"0");
        const{error}=await supabase.from("equipos").insert({id_equipo:newId,...f});
        if(error)throw error;
      } else {
        const{error}=await supabase.from("equipos").update(f).eq("id_equipo",selId);
        if(error)throw error;
      }
      await onReload();setTeamModal(null);
    }catch(e){alert("Error al guardar equipo: "+(e.message||e.details||JSON.stringify(e)));}
    setSaving(false);
  };
  const saveSquad=async(f)=>{
    setSaving(true);
    try{
      const allIds=players.flatMap(p=>p.seasons||[]).map(s=>parseInt(s.id)).filter(n=>!isNaN(n));
      const newId=(Math.max(0,...allIds)+1);
      await supabase.from("temporadas").insert({id:newId,id_jugadora:f.id_jugadora,id_equipo:f.id_equipo,id_liga:f.id_liga,temporada:f.temporada});
      await onReload();setSquadModal(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const delTeam=async()=>{
    try{await supabase.from("equipos").delete().eq("id_equipo",selId);await onReload();setSelId(null);setDelItem(null);}catch(e){alert("Error: "+e.message);}
  };
  const savePalmares=async(f)=>{
    setSaving(true);
    try{
      if(palModal==="add"){
        const {data}=await supabase.from("palmares").select("id").order("id",{ascending:false}).limit(1);
        const newId=(data?.[0]?.id||0)+1;
        await supabase.from("palmares").insert({id:newId,id_equipo:selId,...f});
      } else {
        await supabase.from("palmares").update(f).eq("id",palModal.id);
      }
      await onReload();setPalModal(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const delPalmares=async(id)=>{
    try{await supabase.from("palmares").delete().eq("id",id);await onReload();setDelItem(null);}catch(e){alert("Error: "+e.message);}
  };

  useEffect(()=>{if(openTeamId){setSelId(openTeamId);setSelYear(openTeamYear||null);onClearTeam();}},[openTeamId]);

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

  const filtered = teamIndex.filter(({eq,years,players:pl})=>{
    const matchSearch=!search||eq.nombre?.toLowerCase().includes(search.toLowerCase())||eq.id_equipo?.toLowerCase().includes(search.toLowerCase());
    const matchLeague=!filterLeague||pl.some(({season})=>ligaMap[season.id_liga]?.nombre===filterLeague);
    const matchSeason=!filterSeason||years.has(filterSeason);
    const matchTipo=!filterTipo||eq.tipo===filterTipo;
    return matchSearch&&matchLeague&&matchSeason&&matchTipo;
  });

  const selected    = selId?teamIndex.find(t=>t.eq.id_equipo===selId):null;
  const years       = selected?[...selected.years].sort((a,b)=>b.localeCompare(a)):[];
  const effectiveYear = selYear||(years.length?years[0]:null);
  const squad       = selected
    ?[...new Map(selected.players.filter(({season})=>!effectiveYear||season.temporada===effectiveYear).map(({player,season})=>[player.id_jugadora,{player,season}])).values()]
    :[];

  if(selected){
    const {eq}=selected;
    return(
      <div style={{maxWidth:"720px",margin:"0 auto",padding:"20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px"}}>
          {(()=>{const prev=navHistory&&navHistory.length>0?navHistory[navHistory.length-1]:null;return prev?(<button onClick={onGoBack} style={{background:"none",border:"none",color:"#fb923c",fontSize:"15px",cursor:"pointer",fontWeight:600,padding:0}}>← Volver a {prev.label}</button>):(<button onClick={()=>{setSelId(null);setSelYear(null);}} style={{background:"none",border:"none",color:"#fb923c",fontSize:"15px",cursor:"pointer",fontWeight:600,padding:0}}>← Volver</button>);})()}
          {isAdmin&&<div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>setTeamModal("editTeam")} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#475569"}}>✏️ Editar</button>
            <button onClick={()=>setDelItem("team")} style={{background:"#fee2e2",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
          </div>}
        </div>
        {isAdmin&&delItem==="team"&&<ConfirmDel msg="¿Eliminar este equipo?" onCancel={()=>setDelItem(null)} onConfirm={delTeam}/>}
        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px",position:"relative"}}>
          {eq.redes_sociales&&<div style={{position:"absolute",bottom:"16px",left:"16px"}}><SocialIcon url={eq.redes_sociales}/></div>}
          <div style={{display:"flex",alignItems:"center",gap:"20px",flexWrap:"wrap"}}>
            <TeamBadge team={eq} size={80}/>
            <div style={{flex:1,minWidth:"180px"}}>
              <div><h1 style={{fontWeight:800,fontSize:"22px",color:"#1e293b",margin:"0 0 4px"}}>{eq.nombre}</h1>{isAdmin&&<span style={{fontSize:"11px",color:"#94a3b8",fontFamily:"monospace"}}>{eq.id_equipo}</span>}</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {eq.pais&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center"}}><FlagImg country={eq.pais}/>{eq.pais}</span>}
                {eq.ciudad&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px"}}>📍 {eq.ciudad}</span>}
                {eq.año_fundacion&&<span style={{background:"#fff7ed",color:"#c2410c",fontSize:"12px",fontWeight:700,padding:"3px 10px",borderRadius:"20px"}}>Est. {eq.año_fundacion}</span>}
              </div>
            </div>
            {(()=>{const pal=(palmares||[]).filter(p=>p.id_equipo===eq.id_equipo);if(!pal.length)return null;const counts={};pal.forEach(p=>{const n=ligaMap[p.id_liga]?.nombre||p.id_liga;counts[n]=(counts[n]||0)+1;});return(<div style={{display:"flex",flexDirection:"column",gap:"6px",alignItems:"flex-end",flexShrink:0}}>{Object.entries(counts).map(([nombre,n])=>(<span key={nombre} style={{background:"#fffbeb",border:"1.5px solid #fed7aa",color:"#b45309",fontSize:"12px",fontWeight:700,padding:"4px 10px",borderRadius:"20px",whiteSpace:"nowrap"}}>🏆 {n}x {nombre}</span>))}</div>);})()}
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
        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}}>
            <div>
              <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:0}}>Plantilla <span style={{color:"#94a3b8",fontWeight:400,fontSize:"14px"}}>({squad.length})</span></h2>
              {(()=>{const ligasInYear=[...new Set((squad).map(({season})=>season.id_liga))];const l=ligasInYear.length===1?ligaMap[ligasInYear[0]]:null;return l?<div onClick={()=>onGoToLeague&&onGoToLeague(l.id_liga)} style={{fontSize:"12px",color:"#f97316",marginTop:"2px",display:"flex",alignItems:"center",gap:"4px",cursor:"pointer",textDecoration:"underline"}}><FlagImg country={l.pais}/>{l.nombre}</div>:null;})()}
            </div>
            <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
              {isAdmin&&<button onClick={()=>setSquadModal({temporada:effectiveYear||"",id_liga:"",id_equipo:eq.id_equipo})} style={{background:"#f97316",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Jugadora</button>}
              {years.length>0&&<select value={effectiveYear||""} onChange={e=>setSelYear(e.target.value||null)} style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none"}}>
                {years.map(y=><option key={y} value={y}>{y}</option>)}
              </select>}
            </div>
          </div>
          {squad.length===0?<div style={{textAlign:"center",padding:"30px",color:"#94a3b8"}}>Sin jugadoras para esta temporada</div>
            :<div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {squad.map(({player},i)=>(
                <div key={i} onClick={()=>onGoToPlayer(player.id_jugadora,{tab:"equipos",id:selId,label:eq?.nombre})}
                  style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 14px",background:"#f8fafc",borderRadius:"12px",border:"1.5px solid #e2e8f0",cursor:"pointer",transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#fb923c";e.currentTarget.style.background="#fff7ed";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.background="#f8fafc";}}>
                  <Avatar photo={player.foto} name={player.nombre} size={44} fontSize={16}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:"14px",color:"#f97316"}}>{player.nombre}</div>
                    <div style={{fontSize:"12px",color:"#64748b",marginTop:"2px",display:"flex",alignItems:"center",gap:"3px"}}>{player.nacionalidad&&<FlagImg country={player.nacionalidad}/>}{player.nacionalidad2&&<FlagImg country={player.nacionalidad2}/>}{player.altura_cm&&<span>{player.nacionalidad||player.nacionalidad2?" · ":""}{player.altura_cm} cm</span>}</div>
                  </div>
                  <div className="bfdb-player-card-right" style={{display:"flex",flexDirection:"column",gap:"3px",alignItems:"flex-end",flexShrink:0}}><div className="bfdb-player-badges" style={{display:"flex",gap:"3px",flexWrap:"wrap",justifyContent:"flex-end"}}>{player.posicion&&<span style={posStyle(player.posicion)}>{player.posicion}</span>}{player.posicion2&&<span style={posStyle(player.posicion2)}>{player.posicion2}</span>}</div>{STATUS_BADGE[playerStatus(player.nacionalidad,player.nacionalidad2)]}</div>
                </div>
              ))}
            </div>}
        </div>

        {isAdmin&&delItem?.type==="palmares"&&<ConfirmDel msg="¿Eliminar este título?" onCancel={()=>setDelItem(null)} onConfirm={()=>delPalmares(delItem.id)}/>}
        {isAdmin&&squadModal&&<Modal title="Añadir jugadora a plantilla" onClose={()=>setSquadModal(null)}>
          <AddToSquadForm initial={squadModal} players={players} ligas={ligas} onSave={saveSquad} onCancel={()=>setSquadModal(null)} saving={saving}/>
        </Modal>}
        {isAdmin&&palModal&&<Modal title={palModal==="add"?"Añadir título":"Editar título"} onClose={()=>setPalModal(null)}>
          <PalmaresForm initial={palModal!=="add"?palModal:null} ligas={ligas} onSave={savePalmares} onCancel={()=>setPalModal(null)} saving={saving}/>
        </Modal>}
        {isAdmin&&teamModal&&<Modal title={teamModal==="addTeam"?"Nuevo equipo":"Editar equipo"} onClose={()=>setTeamModal(null)}>
          <TeamForm initial={teamModal!=="addTeam"?eq:null} onSave={saveTeam} onCancel={()=>setTeamModal(null)} saving={saving}/>
        </Modal>}
        {(isAdmin||(palmares||[]).filter(p=>p.id_equipo===eq.id_equipo).length>0)&&(
          <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginTop:"14px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
              <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:0}}>🏆 Palmarés <span style={{color:"#94a3b8",fontWeight:400,fontSize:"14px"}}>({(palmares||[]).filter(p=>p.id_equipo===eq.id_equipo).length})</span></h2>
              {isAdmin&&<button onClick={()=>setPalModal("add")} style={{background:"#f97316",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Título</button>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
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
                          <span style={{fontWeight:700,fontSize:"14px",color:liga?"#f97316":"#1e293b",textDecoration:liga?"underline":"none"}}>{liga?.nombre||id_liga}</span>
                          {liga?.pais&&<FlagImg country={liga.pais}/>}
                        </div>
                        <span style={{background:"#fed7aa",color:"#b45309",fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"20px"}}>{sorted.length}x</span>
                        {isAdmin&&<button onClick={()=>setPalModal("add")} style={{marginLeft:"auto",background:"#f97316",color:"#fff",border:"none",borderRadius:"8px",padding:"3px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer"}}>+ Título</button>}
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
            </div>
          </div>
        )}
      </div>
    );
  }

  return(
    <div className="bfdb-container" style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      <div className="bfdb-stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",marginBottom:"16px"}}>
        {(()=>{
          const nJugadoras=players.length;
          const nEquipos=equipos.length;
          const nLigas=ligas.length;
          const nCoaches=coaches.length;
          const nTemporadas=players.flatMap(p=>p.seasons||[]).length;
          const nTempCoach=(tempCoach||[]).length;
          const nPalmares=(palmares||[]).length;
          const total=nJugadoras+nEquipos+nLigas+nCoaches+nTemporadas+nTempCoach+nPalmares;
          const tabMap={"Jugadoras":"jugadoras","Equipos":"equipos","Ligas":"ligas","Coaches":"cuerpo_tecnico"};
          return [
            ["👩‍🏀",nJugadoras,"Jugadoras"],
            ["🏟️",nEquipos,"Equipos"],
            ["🏆",nLigas,"Ligas"],
            ["📋",nCoaches,"Coaches"],
            ["🗂️",total.toLocaleString("es"),"Registros totales"],
          ].map(([e,v,l])=>{
            const targetTab=tabMap[l];
            return(
            <div key={l} onClick={targetTab?()=>onGoToTab&&onGoToTab(targetTab):undefined}
              style={{background:"#fff",borderRadius:"14px",padding:"12px 8px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",textAlign:"center",cursor:targetTab?"pointer":"default",transition:"all 0.15s"}}
              onMouseEnter={e=>{if(targetTab)e.currentTarget.style.boxShadow="0 4px 12px rgba(249,115,22,0.2)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
              <div style={{fontSize:"18px",marginBottom:"4px"}}>{e}</div>
              <div style={{fontSize:"20px",fontWeight:800,color:targetTab?"#f97316":"#1e293b"}}>{v}</div>
              <div style={{fontSize:"11px",color:"#94a3b8",lineHeight:1.2}}>{l}</div>
            </div>
          );});
        })()}
      </div>
      <div style={{minHeight:"112px"}}>
      <div className="bfdb-filter-row" style={{display:"flex",gap:"8px",marginBottom:"14px",flexWrap:"wrap",alignItems:"stretch"}}>
        <input style={{flex:"1 1 200px",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",color:"#1e293b",outline:"none",background:"#fff",height:"40px",boxSizing:"border-box"}}
          placeholder="🔍 Nombre de equipo..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select value={filterTipo} onChange={e=>setFilterTipo(e.target.value)} style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterTipo?"#f97316":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterTipo?700:400}}>
          <option value="">Tipo</option>
          <option value="equipo">🏟️ Clubs</option>
          <option value="seleccion">🌍 Selecciones</option>
        </select>
        <select value={filterLeague} onChange={e=>setFilterLeague(e.target.value)} style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterLeague?"#f97316":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterLeague?700:400}}>
          <option value="">Liga</option>
          {allLeagues.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterSeason||""} onChange={e=>setFilterSeason(e.target.value||null)} style={{flex:"0 0 auto",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterSeason?"#f97316":"#475569",background:"#fff",outline:"none",height:"40px",fontWeight:filterSeason?700:400}}>
          <option value="">Temporada</option>
          {allSeasons.map(s=><option key={s} value={s}>{s}{s===latestSeason?" (actual)":""}</option>)}
        </select>
      </div>
      {isAdmin&&teamModal==="addTeam"&&<Modal title="Nuevo equipo" onClose={()=>setTeamModal(null)}><TeamForm onSave={saveTeam} onCancel={()=>setTeamModal(null)} saving={saving}/></Modal>}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
        <span style={{fontSize:"13px",color:"#94a3b8"}}>{filtered.length} equipo{filtered.length!==1?"s":""}</span>
        {isAdmin&&<button onClick={()=>setTeamModal("addTeam")} style={{background:"#f97316",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Equipo</button>}
      </div>
      {(()=>{
        const TEAM_GRUPOS=[["equipo","🏟️ Clubes"],["seleccion","🌍 Selecciones"],["other","Otros"]];
        const byTipo={equipo:[],seleccion:[],other:[]};
        filtered.forEach(item=>{
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
    </div>
  );
}

/* ── LeagueForm ─────────────────────────────────────────── */
function LeagueForm({initial,onSave,onCancel,saving}){
  const [f,setF]=useState({nombre:'',pais:'',nivel:'',tipo:'liga',logo:'',...initial});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:'100%',border:'1.5px solid #e2e8f0',borderRadius:'10px',padding:'9px 12px',fontSize:'14px',outline:'none',boxSizing:'border-box'};
  return(<div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
    <Fld label='Nombre *'><input style={inp} value={f.nombre} onChange={set('nombre')} placeholder='Liga Femenina Endesa'/></Fld>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
      <Fld label='País'><input style={inp} value={f.pais||''} onChange={set('pais')} placeholder='España'/></Fld>
      <Fld label='Nivel'><input style={inp} type='number' value={f.nivel||''} onChange={set('nivel')} placeholder='1'/></Fld>
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
      <button onClick={()=>onSave(f)} disabled={saving||!f.nombre} style={{background:'#f97316',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
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
    <Fld label='Foto (URL)'><input style={inp} value={f.foto||''} onChange={set('foto')} placeholder='https://...'/></Fld>
    <Fld label='Ex jugadora (vincular)'><select style={inp} value={f.id_jugadora||''} onChange={set('id_jugadora')}>
      <option value=''>— Ninguna —</option>
      {(players||[]).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(p=><option key={p.id_jugadora} value={p.id_jugadora}>{p.nombre}</option>)}
    </select></Fld>
    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'8px'}}>
      <button onClick={onCancel} style={{background:'#f1f5f9',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.nombre} style={{background:'#f97316',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
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
      <button onClick={()=>onSave(f)} disabled={saving||!f.id_equipo||!f.id_liga||!f.temporada} style={{background:'#f97316',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
    </div>
  </div>);
}

/* ── LeaguesView ─────────────────────────────────────────── */
function LeaguesView({ligas,players,equipos,palmares,coaches,tempCoach,onGoToTeam,isAdmin,onReload,openLigaId,onClearLiga,onGoToTab,navHistory,onGoBack}){
  const [selId,setSelId]     = useState(openLigaId||null);
  useEffect(()=>{if(openLigaId){setSelId(openLigaId);onClearLiga&&onClearLiga();}},[openLigaId]);
  useEffect(()=>{const seg='ligas';window.history.replaceState({},"",selId?`/${seg}/${selId}`:`/${seg}`);},[selId]);
  const [selYear,setSelYear] = useState(null);
  const [search,setSearch]   = useState("");
  const [filterTipoLiga,setFilterTipoLiga] = useState("");
  const [ligaModal,setLigaModal] = useState(null);
  const [saving,setSaving]   = useState(false);
  const [delLiga,setDelLiga] = useState(false);

  const saveLiga=async(f)=>{
    setSaving(true);
    try{
      if(ligaModal==="add"){
        const ids=ligas.map(l=>parseInt(l.id_liga.replace("L",""))).filter(n=>!isNaN(n));
        const newId="L"+(Math.max(...ids)+1).toString().padStart(3,"0");
        await supabase.from("ligas").insert({id_liga:newId,...f});
      } else { await supabase.from("ligas").update(f).eq("id_liga",selId); }
      await onReload();setLigaModal(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const delLigaFn=async()=>{
    try{await supabase.from("ligas").delete().eq("id_liga",selId);await onReload();setSelId(null);setDelLiga(false);}catch(e){alert("Error: "+e.message);}
  };

  const equipoMap = useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap   = useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);
  const selected  = ligas.find(l=>l.id_liga===selId)||null;

  const {years,teamsByYear} = useMemo(()=>{
    if(!selected) return {years:[],teamsByYear:{}};
    const yMap={};
    players.forEach(p=>(p.seasons||[]).forEach(s=>{
      if(s.id_liga!==selected.id_liga) return;
      if(!yMap[s.temporada]) yMap[s.temporada]=new Set();
      yMap[s.temporada].add(s.id_equipo);
    }));
    return {years:Object.keys(yMap).sort((a,b)=>b.localeCompare(a)),teamsByYear:yMap};
  },[selected,players]);

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

  const filtered = ligas.filter(l=>(!search||l.nombre?.toLowerCase().includes(search.toLowerCase()))&&(!filterTipoLiga||l.tipo===filterTipoLiga));
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
          {(()=>{const prev=navHistory&&navHistory.length>0?navHistory[navHistory.length-1]:null;return prev?(<button onClick={onGoBack} style={{background:"none",border:"none",color:"#fb923c",fontSize:"15px",cursor:"pointer",fontWeight:600,padding:0}}>← Volver a {prev.label}</button>):(<button onClick={()=>{setSelId(null);setSelYear(null);}} style={{background:"none",border:"none",color:"#fb923c",fontSize:"15px",cursor:"pointer",fontWeight:600,padding:0}}>← Volver</button>);})()}
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
              <div><h1 style={{fontWeight:800,fontSize:"22px",color:"#1e293b",margin:"0 0 4px"}}>{selected.nombre}</h1>{isAdmin&&<span style={{fontSize:"11px",color:"#94a3b8",fontFamily:"monospace"}}>{selected.id_liga}</span>}</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {selected.pais&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center"}}><FlagImg country={selected.pais}/>{selected.pais}</span>}
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
            {years.length>0&&<select value={effectiveYear||""} onChange={e=>setSelYear(e.target.value||null)} style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none"}}>
              {years.map(y=><option key={y} value={y}>{y}{y===latestYear?" (actual)":""}</option>)}
            </select>}
          </div>
          {teamsInLeague.length===0
            ?<div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}><div style={{fontSize:"32px",marginBottom:"10px"}}>🏟️</div><div>Sin equipos para esta temporada</div></div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"10px"}}>
              {teamsInLeague.map(eq=>(
                <div key={eq.id_equipo} onClick={()=>onGoToTeam(eq.id_equipo,null,{tab:"ligas",id:selId,label:selected?.nombre})}
                  style={{background:"#f8fafc",borderRadius:"14px",padding:"14px",border:"1.5px solid #e2e8f0",display:"flex",alignItems:"center",gap:"12px",cursor:"pointer",transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#fb923c";e.currentTarget.style.background="#fff7ed";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.background="#f8fafc";}}>
                  <TeamBadge team={eq} size={40}/>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:"13px",color:"#f97316",lineHeight:"1.3",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{eq.nombre}</div>
                    <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px",display:"flex",alignItems:"center"}}><FlagImg country={eq.pais||""}/>{eq.pais||""}</div>
                  </div>
                </div>
              ))}
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
                    <div key={i} onClick={()=>onGoToTeam(eq?.id_equipo,null,{tab:"ligas",id:selId,label:selected?.nombre})}
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
      <div className="bfdb-stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",marginBottom:"16px"}}>
        {(()=>{
          const nJugadoras=players.length;
          const nEquipos=equipos.length;
          const nLigas=ligas.length;
          const nCoaches=coaches.length;
          const nTemporadas=players.flatMap(p=>p.seasons||[]).length;
          const nTempCoach=(tempCoach||[]).length;
          const nPalmares=(palmares||[]).length;
          const total=nJugadoras+nEquipos+nLigas+nCoaches+nTemporadas+nTempCoach+nPalmares;
          const tabMap={"Jugadoras":"jugadoras","Equipos":"equipos","Ligas":"ligas","Coaches":"cuerpo_tecnico"};
          return [
            ["👩‍🏀",nJugadoras,"Jugadoras"],
            ["🏟️",nEquipos,"Equipos"],
            ["🏆",nLigas,"Ligas"],
            ["📋",nCoaches,"Coaches"],
            ["🗂️",total.toLocaleString("es"),"Registros totales"],
          ].map(([e,v,l])=>{
            const targetTab=tabMap[l];
            return(
            <div key={l} onClick={targetTab?()=>onGoToTab&&onGoToTab(targetTab):undefined}
              style={{background:"#fff",borderRadius:"14px",padding:"12px 8px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",textAlign:"center",cursor:targetTab?"pointer":"default",transition:"all 0.15s"}}
              onMouseEnter={e=>{if(targetTab)e.currentTarget.style.boxShadow="0 4px 12px rgba(249,115,22,0.2)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
              <div style={{fontSize:"18px",marginBottom:"4px"}}>{e}</div>
              <div style={{fontSize:"20px",fontWeight:800,color:targetTab?"#f97316":"#1e293b"}}>{v}</div>
              <div style={{fontSize:"11px",color:"#94a3b8",lineHeight:1.2}}>{l}</div>
            </div>
          );});
        })()}
      </div>
      {isAdmin&&ligaModal==="add"&&<Modal title="Nueva liga" onClose={()=>setLigaModal(null)}><LeagueForm onSave={saveLiga} onCancel={()=>setLigaModal(null)} saving={saving}/></Modal>}
      <div style={{minHeight:"112px"}}>
      <div style={{display:"flex",gap:"10px",marginBottom:"16px",alignItems:"center"}}>
        <input style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 16px",fontSize:"14px",color:"#1e293b",outline:"none",background:"#fff",boxSizing:"border-box"}}
          placeholder="🔍 Buscar liga..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select value={filterTipoLiga} onChange={e=>setFilterTipoLiga(e.target.value)} style={{border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none",flexShrink:0}}>
          <option value="">Todos los tipos</option>
          <option value="liga">Liga</option>
          <option value="copadom">Copa Nacional</option>
          <option value="copacont">Copa Continental</option>
          <option value="internacional">Internacional</option>
        </select>
        {isAdmin&&<button onClick={()=>setLigaModal("add")} style={{background:"#f97316",color:"#fff",border:"none",borderRadius:"10px",padding:"10px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer",whiteSpace:"nowrap"}}>+ Liga</button>}
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
                      <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"3px",display:"flex",alignItems:"center"}}><FlagImg country={l.pais||""}/>{l.pais||"—"}</div>
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
function CoachesView({coaches,tempCoach,equipos,ligas,players,palmares,onGoToPlayer,onGoToTeam,openCoachId,onClearCoach,isAdmin,onReload,onGoToTab,navHistory,onGoBack}){
  const [coachModal,setCoachModal]=useState(null);
  const [seasonModal,setSeasonModal]=useState(null);
  const [saving2,setSaving2]=useState(false);
  const [delCoachItem,setDelCoachItem]=useState(null);

  const saveCoach=async(f)=>{
    setSaving2(true);
    try{
      if(coachModal==="add"){
        const ids=coaches.map(c=>parseInt((c.id_coach||"").replace("C",""))).filter(n=>!isNaN(n));
        const newId="C"+(Math.max(0,...ids)+1).toString().padStart(3,"0");
        await supabase.from("coach").insert({id_coach:newId,...f,id_jugadora:f.id_jugadora||null});
      } else {
        await supabase.from("coach").update({...f,id_jugadora:f.id_jugadora||null}).eq("id_coach",coachModal.id_coach);
      }
      await onReload();setCoachModal(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving2(false);
  };
  const delCoachFn=async(id)=>{
    try{await supabase.from("coach").delete().eq("id_coach",id);await onReload();setDelCoachItem(null);}catch(e){alert("Error: "+e.message);}
  };
  const saveCoachSeason=async(f,coachId)=>{
    setSaving2(true);
    try{
      if(seasonModal==="add"){
        const {data}=await supabase.from("temporadas_coach").select("id").order("id",{ascending:false}).limit(1);
        const newId=(data?.[0]?.id||0)+1;
        await supabase.from("temporadas_coach").insert({id:newId,id_coach:coachId,...f,orden:parseInt(f.orden)||0});
      } else {
        await supabase.from("temporadas_coach").update({...f,orden:parseInt(f.orden)||0}).eq("id",seasonModal.id);
      }
      await onReload();setSeasonModal(null);
    }catch(e){alert("Error: "+e.message);}
    setSaving2(false);
  };
  const delCoachSeason=async(id)=>{
    try{await supabase.from("temporadas_coach").delete().eq("id",id);await onReload();setDelCoachItem(null);}catch(e){alert("Error: "+e.message);}
  };
  const [search,setSearch]=useState("");
  const [selId,setSelId]  =useState(openCoachId||null);
  useEffect(()=>{const seg='coaches';window.history.replaceState({},"",selId?`/${seg}/${selId}`:`/${seg}`);},[selId]);
  const [filterNac,setFilterNac]=useState("");
  const [filterLiga,setFilterLiga]=useState("");
  useEffect(()=>{if(openCoachId){setSelId(openCoachId);onClearCoach();}},[openCoachId]);
  const equipoMap=useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap  =useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);
  const playerMap=useMemo(()=>{const m={};players.forEach(p=>m[String(p.id_jugadora)]=p);return m;},[players]);
  const filtered=useMemo(()=>(coaches||[]).filter(c=>!search||c.nombre.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es")),[coaches,search]);
  const allNacs=useMemo(()=>[...new Set((coaches||[]).flatMap(c=>[c.nacionalidad,c.nacionalidad2]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")),[coaches]);
  const allLigas=useMemo(()=>[...new Set((tempCoach||[]).map(tc=>ligaMap[tc.id_liga]?.nombre).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")),[tempCoach,ligaMap]);
  const filteredList=useMemo(()=>filtered.filter(coach=>{
    if(filterNac&&coach.nacionalidad!==filterNac&&coach.nacionalidad2!==filterNac)return false;
    if(filterLiga&&!(tempCoach||[]).some(tc=>tc.id_coach===coach.id_coach&&ligaMap[tc.id_liga]?.nombre===filterLiga))return false;
    return true;
  }),[filtered,filterNac,filterLiga,tempCoach,ligaMap]);

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
        {(()=>{const prev=navHistory&&navHistory.length>0?navHistory[navHistory.length-1]:null;return prev?(<button onClick={onGoBack} style={{background:"transparent",border:"none",color:"#f97316",fontWeight:700,fontSize:"14px",cursor:"pointer",padding:"4px 0"}}>← Volver a {prev.label}</button>):(<button onClick={()=>setSelId(null)} style={{background:"transparent",border:"none",color:"#f97316",fontWeight:700,fontSize:"14px",cursor:"pointer",padding:"4px 0"}}>← Volver</button>);})()}
        {isAdmin&&<div style={{display:"flex",gap:"8px"}}>
          <button onClick={()=>setCoachModal(coach)} style={{background:"#f1f5f9",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#475569"}}>✏️ Editar</button>
          <button onClick={()=>setDelCoachItem({type:"coach",id:coach.id_coach})} style={{background:"#fee2e2",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
        </div>}
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
            <Avatar photo={coach.foto} name={coach.nombre} size={80} fontSize={28}/>
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
                  return(<div style={{display:"flex",flexDirection:"column",gap:"4px",alignItems:"flex-end",flexShrink:0}}>{entries.map(([n,c])=>(<span key={n} style={{background:"#fffbeb",border:"1.5px solid #fed7aa",color:"#b45309",fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"20px",whiteSpace:"nowrap"}}>🏆 {c}x {n}</span>))}</div>);
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
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}><h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:0}}>Historial <span style={{color:"#94a3b8",fontWeight:400,fontSize:"14px"}}>({total})</span></h2>{isAdmin&&<button onClick={()=>setSeasonModal("add")} style={{background:"#f97316",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Temporada</button>}</div>
                {hasPlay&&<div style={{display:"flex",gap:"12px",marginBottom:"12px",fontSize:"12px",color:"#64748b",alignItems:"center"}}>
                  <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:10,borderRadius:"50%",background:"#f97316",display:"inline-block"}}/> Jugadora</span>
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
                        const dotColor=isCoach?"#3b82f6":"#f97316";
                        return(
                          <div key={(isCoach?"c":"p")+s.id} style={{display:"flex",gap:"16px",alignItems:"flex-start",paddingLeft:"32px",position:"relative"}}>
                            <div style={{position:"absolute",left:"6px",top:"14px",width:"12px",height:"12px",borderRadius:"50%",background:dotColor,border:"3px solid #fff",boxShadow:`0 0 0 2px ${dotColor}`}}/>
                            <div style={{flex:1,background:isCoach?"#eff6ff":"#f8fafc",borderRadius:"12px",padding:"12px 14px",border:`1.5px solid ${isCoach?"#bfdbfe":"#e2e8f0"}`,cursor:"pointer"}}
                              onClick={()=>onGoToTeam(s.id_equipo,s.temporada,{tab:"cuerpo_tecnico",id:selId,label:coach?.nombre})}
                              onMouseEnter={e=>{e.currentTarget.style.background=isCoach?"#dbeafe":"#fff7ed";e.currentTarget.style.borderColor=isCoach?"#93c5fd":"#fb923c";}}
                              onMouseLeave={e=>{e.currentTarget.style.background=isCoach?"#eff6ff":"#f8fafc";e.currentTarget.style.borderColor=isCoach?"#bfdbfe":"#e2e8f0";}}>
                              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                                <TeamBadge team={eq} size={30}/>
                                <div style={{flex:1}}>
                                  <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                                    <span style={{fontWeight:700,fontSize:"14px",color:"#1e293b"}}>{s.temporada} · </span>
                                    <span style={{color:isCoach?"#3b82f6":"#f97316",fontWeight:700,textDecoration:"underline"}}>{eq?.nombre||s.id_equipo}</span>
                                    {isCoach&&<span style={{background:"#dbeafe",color:"#1d4ed8",fontSize:"10px",fontWeight:700,padding:"1px 6px",borderRadius:"20px"}}>📋 Coach</span>}
                                  </div>
                                  <div style={{fontSize:"12px",color:"#64748b",marginTop:"2px",display:"flex",alignItems:"center",gap:"4px"}}>{lig?.pais&&<FlagImg country={lig.pais}/>}{lig?.nombre||s.id_liga}</div>
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
      </div>
    );
  }

  /* ── LIST ── */
  return(
    <div style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      <div className="bfdb-stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",marginBottom:"16px"}}>
        {(()=>{
          const nJugadoras=players.length;
          const nEquipos=equipos.length;
          const nLigas=ligas.length;
          const nCoaches=coaches.length;
          const nTemporadas=players.flatMap(p=>p.seasons||[]).length;
          const nTempCoach=(tempCoach||[]).length;
          const nPalmares=(palmares||[]).length;
          const total=nJugadoras+nEquipos+nLigas+nCoaches+nTemporadas+nTempCoach+nPalmares;
          const tabMap={"Jugadoras":"jugadoras","Equipos":"equipos","Ligas":"ligas","Coaches":"cuerpo_tecnico"};
          return [
            ["👩‍🏀",nJugadoras,"Jugadoras"],
            ["🏟️",nEquipos,"Equipos"],
            ["🏆",nLigas,"Ligas"],
            ["📋",nCoaches,"Coaches"],
            ["🗂️",total.toLocaleString("es"),"Registros totales"],
          ].map(([e,v,l])=>{
            const targetTab=tabMap[l];
            return(
            <div key={l} onClick={targetTab?()=>onGoToTab&&onGoToTab(targetTab):undefined}
              style={{background:"#fff",borderRadius:"14px",padding:"12px 8px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",textAlign:"center",cursor:targetTab?"pointer":"default",transition:"all 0.15s"}}
              onMouseEnter={e=>{if(targetTab)e.currentTarget.style.boxShadow="0 4px 12px rgba(249,115,22,0.2)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
              <div style={{fontSize:"18px",marginBottom:"4px"}}>{e}</div>
              <div style={{fontSize:"20px",fontWeight:800,color:targetTab?"#f97316":"#1e293b"}}>{v}</div>
              <div style={{fontSize:"11px",color:"#94a3b8",lineHeight:1.2}}>{l}</div>
            </div>
          );});
        })()}
      </div>
      <div style={{minHeight:"112px"}}>
      <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Nombre de entrenador..."
          style={{flex:1,minWidth:"180px",border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"14px",color:"#1e293b",outline:"none",background:"#fff"}}/>
        <select style={{border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none"}} value={filterLiga} onChange={e=>setFilterLiga(e.target.value)}>
          <option value="">Todas las ligas</option>
          {allLigas.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        <select style={{border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none"}} value={filterNac} onChange={e=>setFilterNac(e.target.value)}>
          <option value="">Todas las nacionalidades</option>
          {allNacs.map(n=><option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      </div>
      {isAdmin&&coachModal==="add"&&<Modal title="Nuevo coach" onClose={()=>setCoachModal(null)}><CoachForm players={players} onSave={saveCoach} onCancel={()=>setCoachModal(null)} saving={saving2}/></Modal>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
        <span style={{fontSize:"13px",color:"#94a3b8"}}>{filteredList.length} entrenador{filteredList.length!==1?"es":"a"}</span>
        {isAdmin&&<button onClick={()=>setCoachModal("add")} style={{background:"#f97316",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Coach</button>}
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
function Landing({onEnter}){
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:"20px"}}>
      <div style={{maxWidth:"560px",width:"100%",textAlign:"center"}}>
        <div style={{fontSize:"64px",marginBottom:"16px",animation:"bounce 0.7s infinite"}}>🏀</div>
        <div style={{width:"40px",height:"6px",background:"#cbd5e1",borderRadius:"50%",margin:"4px auto 28px",animation:"shadow 0.7s infinite"}}/>
        <div style={{fontWeight:900,fontSize:"32px",color:"#fff",letterSpacing:"-1px",marginBottom:"4px"}}>
          BasketFem<span style={{color:"#f97316"}}> DB</span>
        </div>
        <div style={{fontSize:"14px",color:"#94a3b8",marginBottom:"36px",fontWeight:500}}>Base de datos del baloncesto femenino</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"36px",textAlign:"left"}}>
          {[["👩‍🏀","Jugadoras","Fichas completas con historial de temporadas"],["🏟️","Equipos","Plantillas, palmarés y cuerpo técnico"],["🏆","Ligas","Competiciones nacionales e internacionales"],["📋","Cuerpo Técnico","Entrenadores y entrenadoras"]].map(([e,t,d])=>(
            <div key={t} style={{background:"rgba(255,255,255,0.05)",borderRadius:"14px",padding:"14px",border:"1px solid rgba(255,255,255,0.08)"}}>
              <div style={{fontSize:"22px",marginBottom:"6px"}}>{e}</div>
              <div style={{fontWeight:700,fontSize:"13px",color:"#f1f5f9",marginBottom:"3px"}}>{t}</div>
              <div style={{fontSize:"11px",color:"#64748b",lineHeight:"1.4"}}>{d}</div>
            </div>
          ))}
        </div>
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:"14px",padding:"16px 20px",marginBottom:"24px",border:"1px solid rgba(255,255,255,0.07)",textAlign:"left"}}>
          <div style={{fontWeight:700,fontSize:"12px",color:"#94a3b8",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Aviso legal</div>
          <p style={{fontSize:"12px",color:"#64748b",lineHeight:"1.6",margin:0}}>
            Los datos mostrados en esta aplicación son de carácter público y han sido obtenidos de fuentes oficiales como webs de federaciones deportivas. Esta plataforma no tiene ánimo de lucro y su uso es exclusivamente informativo. Si eres jugadora, entrenadora o representante de algún club y deseas solicitar la modificación o eliminación de tus datos, contacta con nosotros en <span style={{color:"#f97316",fontWeight:600}}>basketfemdb@gmail.com</span>.
          </p>
        </div>
        <button onClick={onEnter}
          style={{background:"#f97316",color:"#fff",border:"none",borderRadius:"14px",padding:"14px 40px",fontSize:"15px",fontWeight:800,cursor:"pointer",width:"100%",letterSpacing:"0.3px",transition:"all 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="#ea6c0a"}
          onMouseLeave={e=>e.currentTarget.style.background="#f97316"}>
          Entrar a la base de datos →
        </button>
        <div style={{fontSize:"11px",color:"#475569",marginTop:"12px"}}>
          Al acceder aceptas el uso informativo de los datos según se describe arriba.
        </div>
      </div>
    </div>
  );
}

/* ── LoginModal ─────────────────────────────────────────── */
function LoginModal({onLogin,onClose,loading,error}){
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#1e293b",borderRadius:"20px",padding:"32px",width:"340px",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
        <div style={{textAlign:"center",marginBottom:"24px"}}>
          <div style={{fontSize:"32px",marginBottom:"8px"}}>🔐</div>
          <div style={{fontWeight:800,fontSize:"18px",color:"#f1f5f9"}}>Acceso Admin</div>
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
            style={{background:"#f97316",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",fontWeight:700,fontSize:"14px",cursor:"pointer",marginTop:"4px"}}>
            {loading?"Entrando...":"Entrar"}
          </button>
        </div>
      </div>
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
  const [loading,setLoading] = useState(true);
  const [error,setError]     = useState(null);
  const [isFirstLoad,setIsFirstLoad] = useState(true);
  const [showExport,setShowExport]   = useState(false);
  const [showDupes,setShowDupes]     = useState(false);
  const [showLanding,setShowLanding] = useState(()=>{
    try{return !localStorage.getItem("bfdb_accepted");}catch{return true;}
  });
  const handleEnter=()=>{
    try{localStorage.setItem("bfdb_accepted","1");}catch{}
    setShowLanding(false);
  };
  const [isAdmin,setIsAdmin]       = useState(false);
  const [showLogin,setShowLogin]   = useState(false);
  const [loginErr,setLoginErr]     = useState("");
  const [loginLoading,setLoginLoading] = useState(false);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{if(session)setIsAdmin(true);});
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,session)=>setIsAdmin(!!session));
    return ()=>subscription.unsubscribe();
  },[]);

  const handleLogin=async(email,password)=>{
    setLoginLoading(true);setLoginErr("");
    const {error}=await supabase.auth.signInWithPassword({email,password});
    if(error){setLoginErr("Credenciales incorrectas");setLoginLoading(false);}
    else{setShowLogin(false);setLoginLoading(false);}
  };
  const handleLogout=async()=>{await supabase.auth.signOut();setIsAdmin(false);};
  const [tab,setTab]         = useState("jugadoras");
  const [openPlayerId,setOpenPlayerId] = useState(null);
  const [openTeamId,setOpenTeamId]     = useState(null);
  const [openTeamYear,setOpenTeamYear] = useState(null);
  const [openCoachId,setOpenCoachId]   = useState(null);

  const [openLigaId,setOpenLigaId] = useState(null);
  const [navHistory,setNavHistory] = useState([]);  // pila: [{tab,id,label}]

  const scrollTop  = ()=>window.scrollTo({top:0,behavior:"smooth"});
  const pushNav=(from)=>{if(from)setNavHistory(h=>[...h,from].slice(-5));};

  const goToTeam   = (id,year=null,from=null)=>{pushNav(from);setOpenTeamId(id);setOpenTeamYear(year);setOpenPlayerId(null);setTab("equipos");scrollTop();};
  const goToLeague = (id,from=null)=>{pushNav(from);setOpenLigaId(id);setTab("ligas");scrollTop();};
  const goToPlayer = (id,from=null)=>{pushNav(from);setOpenPlayerId(id);setOpenTeamId(null);setTab("jugadoras");scrollTop();};
  const goToCoach  = (id,from=null)=>{pushNav(from);setOpenCoachId(id);setTab("cuerpo_tecnico");scrollTop();};

  const goBack=()=>{
    const h=[...navHistory];const prev=h.pop();setNavHistory(h);
    if(!prev){setOpenPlayerId(null);setOpenTeamId(null);setOpenCoachId(null);setOpenLigaId(null);return;}
    if(prev.tab==="jugadoras"){setOpenPlayerId(prev.id);setOpenTeamId(null);setTab("jugadoras");}
    else if(prev.tab==="equipos"){setOpenTeamId(prev.id);setOpenPlayerId(null);setTab("equipos");}
    else if(prev.tab==="ligas"){setOpenLigaId(prev.id);setTab("ligas");}
    else if(prev.tab==="cuerpo_tecnico"){setOpenCoachId(prev.id);setTab("cuerpo_tecnico");}
    scrollTop();
  };

  const loadAll = async()=>{
    setLoading(isFirstLoad);setError(null);
    try{
      const [rJ,rE,rL,rT,rP,rC,rTC]=await Promise.all([
        fetchAll("jugadoras",{order:"id_jugadora"}),
        fetchAll("equipos",{order:"id_equipo"}),
        fetchAll("ligas",{order:"id_liga"}),
        fetchAll("temporadas",{order:"id"}),
        fetchAll("palmares",{order:"temporada"}),
        fetchAll("coach",{order:"id_coach"}),
        fetchAll("temporadas_coach",{order:"id"}),
      ]);
      if(rJ.error)throw rJ.error;if(rE.error)throw rE.error;if(rL.error)throw rL.error;if(rT.error)throw rT.error;
      const sbp={};
      (rT.data||[]).forEach(t=>{if(!sbp[t.id_jugadora])sbp[t.id_jugadora]=[];sbp[t.id_jugadora].push(t);});
      setPlayers((rJ.data||[]).map(j=>({...j,seasons:sbp[j.id_jugadora]||[]})));
      setEquipos(rE.data||[]);
      setLigas(rL.data||[]);
      setPalmares(rP.data||[]);
      setCoaches(rC.data||[]);
      setTempCoach(rTC.data||[]);
      setIsFirstLoad(false);
    }catch(e){setError(e.message||"Error cargando datos");}
    setLoading(false);
  };

  useEffect(()=>{loadAll();},[]);

  const TABS=[["jugadoras","👩‍🏀","Jugadoras"],["equipos","🏟️","Equipos"],["ligas","🏆","Ligas"],["cuerpo_tecnico","📋","Cuerpo Técnico"]];

  if(showLanding) return <Landing onEnter={handleEnter}/>;
  if(showDupes){
    return <DuplicatesModal players={players} equipos={equipos} ligas={ligas} coaches={coaches}
      onClose={()=>setShowDupes(false)}
      onGoToPlayer={goToPlayer} onGoToTeam={goToTeam} onGoToLeague={goToLeague} onGoToCoach={goToCoach}/>;
  }
  if(showExport){
    const TABLES=[
      {key:"jugadoras",label:"Jugadoras",data:players.map(({seasons,...p})=>p),cols:["id_jugadora","nombre","posicion","posicion2","nacionalidad","nacionalidad2","fecha_nac","altura_cm","foto"]},
      {key:"temporadas",label:"Temporadas",data:players.flatMap(p=>p.seasons||[]),cols:["id","id_jugadora","id_equipo","id_liga","temporada","orden"]},
      {key:"equipos",label:"Equipos",data:equipos,cols:["id_equipo","nombre","ciudad","pais","año_fundacion","escudo","tipo","redes_sociales"]},
      {key:"ligas",label:"Ligas",data:ligas,cols:["id_liga","nombre","pais","nivel","tipo","logo"]},
      {key:"coaches",label:"Cuerpo Técnico",data:coaches,cols:["id_coach","nombre","nacionalidad","nacionalidad2","fecha_nac","foto","id_jugadora"]},
      {key:"temporadas_coach",label:"Temporadas Coach",data:tempCoach,cols:["id","id_coach","id_equipo","id_liga","temporada","orden"]},
      {key:"palmares",label:"Palmarés",data:palmares,cols:["id","id_equipo","id_liga","temporada"]},
    ];
    return <ExportModal tables={TABLES} onClose={()=>setShowExport(false)}/>;
  }
  if(showLogin) return <LoginModal onLogin={handleLogin} onClose={()=>{setShowLogin(false);setLoginErr("");}} loading={loginLoading} error={loginErr}/>;

  if(loading) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f1f5f9",fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center",color:"#94a3b8"}}><div style={{display:"inline-block",animation:"bounce 0.7s infinite"}}><span style={{fontSize:"52px",lineHeight:1}}>🏀</span></div><div style={{width:"40px",height:"6px",background:"#cbd5e1",borderRadius:"50%",margin:"4px auto 0",animation:"shadow 0.7s infinite"}}></div><div style={{fontWeight:700,fontSize:"16px",color:"#f97316",marginTop:"14px"}}>BasketFem DB</div><div style={{fontSize:"13px",marginTop:"4px"}}>Cargando datos...</div></div>
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
        <div className="bfdb-header-inner" style={{maxWidth:"880px",margin:"0 auto",display:"flex",alignItems:"center",gap:"10px",height:"56px"}}>
          <div className="bfdb-logo" onClick={()=>{setTab("jugadoras");setOpenPlayerId(null);setOpenTeamId(null);setOpenCoachId(null);setOpenLigaId(null);}} title="Inicio" style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",marginRight:"auto"}}>
            <span style={{fontSize:"22px"}}>🏀</span>
            <div style={{fontWeight:800,fontSize:"16px",letterSpacing:"-0.3px"}}>
              BasketFem <span style={{color:"#fb923c"}}>DB</span>
              <span className="bfdb-supabase-badge" style={{fontSize:"10px",color:"#22c55e",fontWeight:600,marginLeft:"8px",background:"rgba(34,197,94,0.15)",padding:"2px 8px",borderRadius:"10px"}}>● Supabase</span>
            </div>
          </div>
          <div className="bfdb-global-search"><GlobalSearch players={players} equipos={equipos} ligas={ligas} coaches={coaches}
            onGoToPlayer={goToPlayer} onGoToTeam={goToTeam} onGoToLeague={goToLeague} onGoToCoach={goToCoach}/></div>
          <div className="bfdb-tabs" style={{display:"flex",gap:"4px"}}>
            {TABS.map(([id,icon,label])=>(
              <button key={id} onClick={()=>{setTab(id);const seg=id==='cuerpo_tecnico'?'coaches':id;window.history.pushState({},"",`/${seg}`);}} style={{background:tab===id?"#f97316":"transparent",color:tab===id?"#fff":"#94a3b8",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",transition:"all 0.15s"}}>
                {icon}<span className="bfdb-tab-label"> {label}</span>
              </button>
            ))}
            <button onClick={loadAll} title="Recargar" style={{background:"transparent",color:"#94a3b8",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"16px"}}>🔄</button>
            {isAdmin&&<button title="Detectar duplicados" onClick={()=>setShowDupes(true)} style={{background:"transparent",color:"#94a3b8",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"16px"}}>🔍</button>}
            {isAdmin&&<button title="Exportar datos" onClick={()=>setShowExport(true)} style={{background:"transparent",color:"#94a3b8",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"16px"}}>📥</button>}
            <button onClick={()=>setShowLanding(true)} title="Información" style={{background:"transparent",color:"#94a3b8",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"14px",fontWeight:700}}>ℹ</button>
            {isAdmin
              ?<button onClick={handleLogout} title="Cerrar sesión admin" style={{background:"rgba(249,115,22,0.15)",color:"#fb923c",border:"1.5px solid rgba(249,115,22,0.3)",borderRadius:"10px",padding:"5px 10px",cursor:"pointer",fontSize:"12px",fontWeight:700}}>🔐 Admin</button>
              :<button onClick={()=>setShowLogin(true)} title="Acceso admin" style={{background:"transparent",color:"#475569",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"16px"}}>🔒</button>
            }
          </div>
        </div>
      </div>
      <div style={{paddingTop:"8px"}}>
        {tab==="jugadoras"&&<PlayersView players={players} equipos={equipos} ligas={ligas} palmares={palmares} coaches={coaches} tempCoach={tempCoach} onReload={loadAll} onGoToTeam={goToTeam} onGoToCoach={goToCoach} openPlayerId={openPlayerId} onClearPlayer={()=>setOpenPlayerId(null)} isAdmin={isAdmin} onGoToTab={t=>setTab(t)} navHistory={navHistory} onGoBack={goBack}/>}
        {tab==="equipos"  &&<TeamsView equipos={equipos} players={players} ligas={ligas} palmares={palmares} coaches={coaches} tempCoach={tempCoach} onGoToPlayer={goToPlayer} onGoToCoach={goToCoach} onGoToLeague={goToLeague} openTeamId={openTeamId} openTeamYear={openTeamYear} onClearTeam={()=>{setOpenTeamId(null);setOpenTeamYear(null);}} isAdmin={isAdmin} onReload={loadAll} onGoToTab={t=>setTab(t)} navHistory={navHistory} onGoBack={goBack}/>}
        {tab==="ligas"    &&<LeaguesView ligas={ligas} players={players} equipos={equipos} palmares={palmares} coaches={coaches} tempCoach={tempCoach} onGoToTeam={goToTeam} isAdmin={isAdmin} onReload={loadAll} openLigaId={openLigaId} onClearLiga={()=>setOpenLigaId(null)} onGoToTab={t=>setTab(t)} navHistory={navHistory} onGoBack={goBack}/>}
        {tab==="cuerpo_tecnico"&&<CoachesView coaches={coaches} tempCoach={tempCoach} equipos={equipos} ligas={ligas} players={players} palmares={palmares} onGoToPlayer={goToPlayer} onGoToTeam={goToTeam} openCoachId={openCoachId} onClearCoach={()=>setOpenCoachId(null)} isAdmin={isAdmin} onReload={loadAll} onGoToTab={t=>setTab(t)} navHistory={navHistory} onGoBack={goBack}/>}
      </div>
    </div>
    </>);
}