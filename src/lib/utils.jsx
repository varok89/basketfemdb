import { useState } from "react";

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

export { COUNTRY_CODES };

export function countryCode(c) {
  if (!c) return null;
  return COUNTRY_CODES[c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036F]/g,"").trim()] || null;
}

export function flagEmoji(isoCode) {
  if (!isoCode || isoCode.length !== 2) return "";
  const codePoints = isoCode.toUpperCase().split("").map(ch => 0x1F1E6 + (ch.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

export const NO_COUNTRY_FLAGS = { "equipo unificado": "\U0001F3F3️" };

export function checkIdGaps(items,key,prefix,pad){
  const ids=items.map(function(x){return prefix?parseInt(String(x[key]||"").replace(prefix,"")):parseInt(x[key]);}).filter(function(n){return !isNaN(n)&&n>0;}).sort(function(a,b){return a-b;});
  var gaps=[];
  if(ids.length)for(var g=1;g<ids[ids.length-1];g++){if(ids.indexOf(g)<0)gaps.push(prefix+(pad?String(g).padStart(pad,"0"):g));}
  var ff=ids.length?(function(){var s=new Set(ids);var i=1;while(s.has(i))i++;return i;})():1;
  var maxN=ids[ids.length-1]||0;var nextAfterMax=prefix+(pad?String(maxN+1).padStart(pad,"0"):maxN+1);return{gaps:gaps.slice(0,15),total:gaps.length,nextFree:prefix+(pad?String(ff).padStart(pad,"0"):ff),max:maxN,nextAfterMax};
}

export function FibaRow({entry,onApply,onPlaceholder,showActions}){
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
