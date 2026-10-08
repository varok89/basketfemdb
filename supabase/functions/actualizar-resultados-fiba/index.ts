// actualizar-resultados-fiba v40
// v40: refrescarLiveOnce incluye partidos en ventana [-3h,+15min] aunque es_live=false
//   (FIBA no siempre marca is_live=true a tiempo, lo detectamos por status).
//   Setea es_live/periodo según status FIBA. Antes solo refrescaba es_live=true y los partidos
//   quedaban pintados como FT por fechas pasadas sin marcador actualizado.
// v39: egress-gate. En modo cron, filtra eventos activos a solo los que
//   tienen partido en ventana [-1h, +3h] o es_live=true. Antes descargaba
//   el HTML de games de cada evento activo (hoy en fecha_ini..fecha_fin)
//   cada tick (3min) → ~500KB × 20 ligas × 480 ticks/día = 5-7 GB/mes.
//   Con el gate, ~70% de los ticks no descargan nada.
// v38: en modo cron, el bucle de refrescarLiveOnce (hasta 48s) solo se
//   ejecuta si hay partidos con es_live=true. Antes corria siempre, y con
//   el cron cada 1-3 min eso solapaba invocaciones y saturaba la BD.
// v37: nuevo flag body.refresh_fechas (default false). Cuando es true,
//   actualiza fecha_hora en partidos ya existentes por id_ext aunque no
//   sea NULL (útil cuando FIBA mueve la fecha oficial). Aplicado en
//   crear_evento, desde_standings y el modo cron por defecto.
// v36: añade QQF (Qualification to Quarter-Finals) al ORDERED set y a
//   ROUND_ES. Las 4 filas de esa ronda reciben bracket_pos 1-4 para
//   encajar con el bracket de la quiniela (playin_25..28 -> qf_29..32).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const norm = (s:string)=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const Q = String.fromCharCode(92,34);

function catDeSlug(slug:string):string|null{const m=slug.match(/u(\d{2})/i);return m?m[1]:null;}
function catDeNombre(nombre:string):string|null{const m=nombre.match(/u(\d{2})/i);return m?m[1]:null;}

function sfld(html:string, s:number, e:number, field:string):string {
  const p = Q+field+Q+':'+Q;
  const i = html.indexOf(p,s); if(i===-1||i>=e)return '';
  const vs=i+p.length, ve=html.indexOf(Q,vs); return ve>vs&&ve<=e?html.slice(vs,ve):'';
}
function sfldNum(html:string,s:number,e:number,field:string):number|null {
  const p=Q+field+Q+':';
  const i = html.indexOf(p,s); if(i===-1||i>=e)return null;
  let ns=i+p.length, str='';
  while(ns<e&&html.charCodeAt(ns)>=48&&html.charCodeAt(ns)<=57)str+=html[ns++];
  return str?parseInt(str):null;
}
function extractCodes(html:string,s:number,e:number):string[]{
  const SKIP=new Set(['INIT','VALID','COMPL','NG','GP','QF','SF','GF','A','B','C','D','E','F']);
  const result:string[]=[];const p=Q+'code'+Q+':'+Q;let i=s;
  while(result.length<2){const idx=html.indexOf(p,i);if(idx===-1||idx>=e)break;
    const vs=idx+p.length,ve=html.indexOf(Q,vs);const c=ve>vs?html.slice(vs,ve):'';
    if(c&&!SKIP.has(c)&&c.length>=2&&c.length<=4)result.push(c);i=ve>vs?ve+1:idx+1;}
  return result;
}
function extractGids(html:string):Array<{pos:number;gid:string}>{
  const res:Array<{pos:number;gid:string}>=[];const p=Q+'gameId'+Q+':';let i=0;
  while(true){const idx=html.indexOf(p,i);if(idx===-1)break;i=idx+1;
    const ns=idx+p.length;let s='',k=ns;
    while(k<html.length&&html.charCodeAt(k)>=48&&html.charCodeAt(k)<=57)s+=html[k++];
    if(s)res.push({pos:idx,gid:s});}
  return res;
}

const ROUND_ES:Record<string,string>={
  'GP':'Fase de grupos','Group Phase':'Fase de grupos','Group Stage':'Fase de grupos',
  'QF':'Cuartos de final','Quarter-Finals':'Cuartos de final','Quarterfinals':'Cuartos de final',
  'SF':'Semifinal','Semi-Finals':'Semifinal','Semifinals':'Semifinal',
  'F':'Final','Final':'Final','Finals':'Final','Gold Medal Game':'Final',
  '3PG':'3er puesto','3rd place game':'3er puesto','Bronze Medal Game':'3er puesto',
  'R16':'Octavos de final','Round of 16':'Octavos de final',
  'QQF':'Qualification to Quarter-Finals','Qualification to Quarter-Finals':'Qualification to Quarter-Finals',
  'CG5-8':'Class. Games 5-8','Class. Games 5-8':'Class. Games 5-8',
  'CG9-12':'Class. Games 9-12','Class. Games 9-12':'Class. Games 9-12',
  'CG13-16':'Class. Games 13-16','Class. Games 13-16':'Class. Games 13-16',
  'CG9-16':'Class. Games 9-16','Class. Games 9-16':'Class. Games 9-16',
  'CG5':'Class. Game 5-6','Class. Game 5-6':'Class. Game 5-6',
  'CG7':'Class. Game 7-8','Class. Game 7-8':'Class. Game 7-8',
  'CG9':'Class. Game 9-10','Class. Game 9-10':'Class. Game 9-10',
  'CG11':'Class. Game 11-12','Class. Game 11-12':'Class. Game 11-12',
  'CG13':'Class. Game 13-14','Class. Game 13-14':'Class. Game 13-14',
  'CG15':'Class. Game 15-16','Class. Game 15-16':'Class. Game 15-16',
  'CG17-20':'Clasificación 17-20','Classification Group 17-20':'Clasificación 17-20',
  'Qualifiers':'Clasificatorio','Regular Season':'Temporada regular',
  'Play-Offs':'Play-offs','Playoffs':'Play-offs','Top 16':'Top 16',
  'Single':'Eliminatoria',
};
function rES(code:string,name:string):string{return ROUND_ES[code]||ROUND_ES[name]||name||code;}

interface StGame{gid:string;gn:string;roundCode:string;roundName:string;roundES:string;
  gameNum:number|null;nota:string;teamCodes:string[];scoreA:number|null;scoreB:number|null;
  finished:boolean;isGroup:boolean;htmlOrder:number;fecha:string|null;}

function parseStandingsHtml(html:string):StGame[]{
  const gidList=extractGids(html);
  const seen=new Set<string>();
  const unique:Array<{pos:number;gid:string}>=[];
  for(const g of gidList){if(!seen.has(g.gid)){seen.add(g.gid);unique.push(g);}}
  const result:StGame[]=[];
  for(let i=0;i<unique.length;i++){
    const{pos,gid}=unique[i];
    const nxt=i+1<unique.length?unique[i+1].pos:Math.min(pos+6000,html.length);
    const gn=sfld(html,pos,nxt,'gameName'); if(!gn)continue;
    const rc=sfld(html,pos,nxt,'roundCode');
    const rn=sfld(html,pos,nxt,'roundName');
    if(!rc&&!rn)continue;
    const isGroup=rc==='GP'||/group.?(phase|stage)/i.test(rn);
    const roundEsp=rES(rc,rn);
    const gnParts=gn.split('-');
    let gameNum:number|null=null;
    if(gnParts.length>=2){const n=parseInt(gnParts[1]);if(!isNaN(n))gameNum=n;}
    let nota=roundEsp;
    if(gameNum!==null&&!isGroup)nota=`${roundEsp} #${gameNum}`;
    else if(isGroup&&gnParts.length>=3&&/^[A-Z]$/.test(gnParts[2]))nota=`Fase de grupos · Grupo ${gnParts[2]}`;
    else if(isGroup&&gnParts.length>=2&&/^[A-Z]$/.test(gnParts[1]))nota=`Fase de grupos · Grupo ${gnParts[1]}`;
    const teamCodes=extractCodes(html,pos,Math.min(nxt,pos+600));
    const scoreA=sfldNum(html,pos,Math.min(nxt,pos+600),'teamAScore');
    const scoreB=sfldNum(html,pos,Math.min(nxt,pos+600),'teamBScore');
    const status=sfld(html,pos,Math.min(nxt,pos+300),'statusCode');
    const finished=status==='VALID'||status==='COMPL';
    const fechaUtc=sfld(html,pos,nxt,'gameDateTimeUTC');
    const fecha=fechaUtc?fechaUtc.replace('Z',''):null;
    result.push({gid,gn,roundCode:rc,roundName:rn,roundES:roundEsp,gameNum,nota,
                 teamCodes,scoreA,scoreB,finished,isGroup,htmlOrder:i,fecha});
  }
  const byRound=new Map<string,StGame[]>();
  const ORDERED=new Set(['QQF','QF','SF','F','3PG','R16','CG5-8','CG9-12','CG13-16',
                         'CG5','CG7','CG9','CG11','CG13','CG15','CG9-16','CG17-20']);
  for(const g of result){
    if(!g.isGroup){const k=g.roundCode||g.roundName;
      if(!byRound.has(k))byRound.set(k,[]);byRound.get(k)!.push(g);}
  }
  const bposMap=new Map<string,number>();
  for(const[rc,gs]of byRound){
    if(!ORDERED.has(rc))continue;
    gs.sort((a,b)=>a.htmlOrder-b.htmlOrder);
    gs.forEach((g,i)=>bposMap.set(g.gid,i+1));
  }
  return result.map(g=>({...g,bracketPos:bposMap.get(g.gid)??null} as StGame&{bracketPos:number|null}));
}

async function desdeStandings(idLiga:string,temporada:string,slug:string,refreshFechas:boolean):Promise<any>{
  const url=`https://www.fiba.basketball/en/events/${slug}/standings`;
  const html=await descargarHtml(url);
  const games=parseStandingsHtml(html) as Array<StGame&{bracketPos:number|null}>;
  const{porOrgId,porCodigo,porNombre}=await cargarEquiposLiga(idLiga,temporada,slug);
  const{data:codMap}=await sb.from('fiba_eventos').select('codigos').eq('id_liga',idLiga).eq('temporada',temporada).maybeSingle();
  const codigos:Record<string,string>={...(codMap?.codigos||{})};
  const{data:exist}=await sb.from('partidos')
    .select('id,id_ext,notas,id_equipo_local,id_equipo_visitante,bracket_pos,resultado_local,resultado_visitante,fecha_hora')
    .eq('id_liga',idLiga).eq('temporada',temporada).limit(5000);
  const porExt=new Map((exist||[]).filter(p=>p.id_ext).map(p=>[String(p.id_ext),p]));
  let creados=0,actualizados=0,fechasRefrescadas=0,sinMapear:string[]=[];
  const nuevos:any[]=[];
  let fechaMin='',fechaMax='';
  for(const g of games){
    const cA=g.teamCodes[0]?.toUpperCase()||'',cB=g.teamCodes[1]?.toUpperCase()||'';
    const localId=cA&&porCodigo.has(cA)?porCodigo.get(cA)!:cA&&codigos[cA]?codigos[cA]:null;
    const visitId=cB&&porCodigo.has(cB)?porCodigo.get(cB)!:cB&&codigos[cB]?codigos[cB]:null;
    if(localId&&cA){codigos[cA]=localId;await guardarIdFiba(localId,cA);}
    if(visitId&&cB){codigos[cB]=visitId;await guardarIdFiba(visitId,cB);}
    if(!localId&&cA&&!g.isGroup)sinMapear.push(cA);
    if(!visitId&&cB&&!g.isGroup)sinMapear.push(cB);
    const nota=(g as any).nota as string;
    const bpos=(g as any).bracketPos as number|null;
    const rl=g.finished&&g.scoreA!=null?g.scoreA:null;
    const rv=g.finished&&g.scoreB!=null?g.scoreB:null;
    if(g.fecha){const d=g.fecha.slice(0,10);if(!fechaMin||d<fechaMin)fechaMin=d;if(!fechaMax||d>fechaMax)fechaMax=d;}
    if(porExt.has(g.gid)){
      const ex=porExt.get(g.gid)!;
      const upd:any={};
      if(nota&&(!ex.notas||ex.notas.trim()===''))upd.notas=nota;
      if(bpos!=null&&ex.bracket_pos==null)upd.bracket_pos=bpos;
      if(localId&&visitId&&!ex.id_equipo_local){upd.id_equipo_local=localId;upd.id_equipo_visitante=visitId;}
      if(rl!=null&&ex.resultado_local==null){upd.resultado_local=rl;upd.resultado_visitante=rv;}
      if(g.fecha){
        const prev=(ex as any).fecha_hora;
        const cambia=refreshFechas?String(prev||'').replace(' ','T').slice(0,16)!==g.fecha.slice(0,16):!prev;
        if(cambia){upd.fecha_hora=g.fecha;if(prev)fechasRefrescadas++;}
      }
      if(Object.keys(upd).length>0){await sb.from('partidos').update(upd).eq('id',ex.id);actualizados++;}
    } else {
      nuevos.push({id_liga:idLiga,temporada,fuente:'fiba',id_ext:g.gid,
        notas:nota||undefined,bracket_pos:bpos??undefined,
        id_equipo_local:localId||undefined,id_equipo_visitante:visitId||undefined,
        resultado_local:rl??undefined,resultado_visitante:rv??undefined,
        fecha_hora:g.fecha||undefined});
      creados++;
    }
  }
  if(nuevos.length>0){const{error}=await sb.from('partidos').insert(nuevos);
    if(error)throw new Error(`Insert: ${error.message}`);}
  await sb.from('fiba_eventos').upsert(
    {id_liga:idLiga,temporada,slug,activo:true,
     fecha_ini:fechaMin||new Date().toISOString().slice(0,10),
     fecha_fin:fechaMax||new Date().toISOString().slice(0,10),codigos},
    {onConflict:'id_liga,temporada,slug'});
  const rondas=[...new Set(games.filter(g=>!g.isGroup).map(g=>g.roundES))];
  return{ok:true,modo:'desde_standings',total_partidos:games.length,
    bracket:games.filter(g=>!g.isGroup).length,
    grupos:games.filter(g=>g.isGroup).length,
    creados,actualizados,fechas_refrescadas:fechasRefrescadas,rondas,
    sin_mapear:[...new Set(sinMapear)].filter(c=>c)};
}

function matchPorNombre(fibaName:string,slug:string,equiposLiga:Array<{id:string;nombre:string}>):string|null{
  if(!fibaName)return null;
  const cat=catDeSlug(slug);
  const rootFiba=norm(fibaName).slice(0,5);
  const candidates=equiposLiga.filter(e=>{const nBd=norm(e.nombre);
    return(nBd.includes(rootFiba)||rootFiba.includes(nBd.slice(0,5)))&&(cat?nBd.includes(cat):!/\bu\d{2}\b/.test(nBd));});
  if(candidates.length===1)return candidates[0].id;
  if(candidates.length>1&&cat){const exact=candidates.find(e=>{const n=norm(e.nombre);return n.includes(`u${cat}`)||n.includes(`sub${cat}`);});if(exact)return exact.id;}
  return null;
}
async function descargarHtml(baseUrl:string):Promise<string>{
  let err='';
  for(let i=0;i<2;i++){if(i)await new Promise(r=>setTimeout(r,8000));
    const r=await fetch(`${baseUrl}?_cb=${Date.now()}`,{headers:{"User-Agent":"Mozilla/5.0","Cache-Control":"no-cache"}});
    if(r.ok)return await r.text();err=`HTTP ${r.status}`;await r.body?.cancel();}
  throw new Error(`FIBA inaccesible: ${err}`);}
const RN_PREFIX='roundName'+Q+':'+Q;
const GID_PREFIX='gameId'+Q+':';
const GN_PREFIX='gameName'+Q+':'+Q;
function extraerArrayDesde(t:string):any[]|null{
  let d=0,f=-1,s=false,e=false;
  for(let i=0;i<t.length;i++){const c=t[i];if(e){e=false;continue;}if(c=='\\'){e=true;continue;}if(c=='"'){s=!s;continue;}if(s)continue;if(c=='[')d++;else if(c==']'){d--;if(d===0){f=i+1;break;}}}
  if(f===-1)return null;try{return JSON.parse(t.slice(0,f));}catch{return null;}}
function extraerCampos(html:string,prefix:string):Array<{pos:number;val:string}>{
  const result:Array<{pos:number;val:string}>=[];let i=0;
  while(true){const idx=html.indexOf(prefix,i);if(idx===-1)break;i=idx+1;
    const valStart=idx+prefix.length;const valEnd=html.indexOf(Q,valStart);
    if(valEnd===-1)break;const val=html.slice(valStart,valEnd);
    if(val&&!val.includes('\\'))result.push({pos:idx,val});}
  return result;}
function extraerGameIds(html:string):Array<{pos:number;gid:string}>{
  const result:Array<{pos:number;gid:string}>=[];let i=0;
  while(true){const idx=html.indexOf(GID_PREFIX,i);if(idx===-1)break;i=idx+1;
    const numStart=idx+GID_PREFIX.length;let numStr='';let k=numStart;
    while(k<html.length&&html.charCodeAt(k)>=48&&html.charCodeAt(k)<=57)numStr+=html[k++];
    if(numStr)result.push({pos:idx,gid:numStr});}
  return result;}
function construirGameMap(html:string):Map<string,{roundName:string;gameName:string}>{
  const rnArr=extraerCampos(html,RN_PREFIX);const gnArr=extraerCampos(html,GN_PREFIX);
  const gidArr=extraerGameIds(html);const result=new Map<string,{roundName:string;gameName:string}>();
  for(const{pos:gPos,gid}of gidArr){
    const closestRn=rnArr.length>0?rnArr.reduce((a,b)=>Math.abs(a.pos-gPos)<=Math.abs(b.pos-gPos)?a:b).val:'';
    const closestGn=gnArr.length>0?gnArr.reduce((a,b)=>Math.abs(a.pos-gPos)<=Math.abs(b.pos-gPos)?a:b).val:'';
    result.set(gid,{roundName:closestRn,gameName:closestGn});}
  return result;}
function extraerPartidos(html:string):any[]{
  const gameMap=construirGameMap(html);
  const m='games\\":[{\\"gameId';const map=new Map<string,any>();let d=0;
  while(true){const i=html.indexOf(m,d);if(i===-1)break;d=i+m.length;
    let t=html.slice(i+'games\\":'.length);
    t=t.split("\\\\").join("\x00").split('\\"').join('"').split("\x00").join("\\");
    const a=extraerArrayDesde(t);if(!a)continue;
    for(const g of a){if(g?.gameId!=null){const k=String(g.gameId);
      const meta=gameMap.get(k);
      if(meta){if(!g.roundName&&meta.roundName)g.roundName=meta.roundName;if(!g.gameName&&meta.gameName)g.gameName=meta.gameName;}
      const p=map.get(k);const pN=(g.teamAScore??0)+(g.teamBScore??0),pP=(p?.teamAScore??0)+(p?.teamBScore??0);
      const eN=(g.teamA?1:0)+(g.teamB?1:0),eP=(p?.teamA?1:0)+(p?.teamB?1:0);
      if(!p||pN>pP||(pN===pP&&eN>eP)){map.set(k,g);}}}}
  if(map.size===0)throw new Error("No se encontraron partidos");return[...map.values()];}
function parentGame(name:unknown):{num:number;esLoser:boolean}|null{
  const PATRON=/(?:winner|ganador|loser|perdedor|ganante)\s+of\s+game\s+(\d+)/i;
  const match=PATRON.exec(String(name??''));if(!match)return null;
  return{num:parseInt(match[1],10),esLoser:/loser|perdedor/i.test(match[0])};}
function tipoRonda(notas:string):string{
  const n=norm(notas);
  if(/cuartos|quarter/i.test(n))return'qf';if(/semifinal|semi-final/i.test(n))return'sf';
  if(/^final/i.test(n.trim())||notas.trim()==='Final')return'final';
  if(/3er|bronce|bronze|3rd/i.test(n))return'3rd';if(/octavos|round.?of.?16/i.test(n))return'r16';
  if(/9.*(16|12)|class.*9/i.test(n))return'c9';if(/5.*(8)|class.*5/i.test(n))return'c5';
  if(/13.*(16)|class.*13/i.test(n))return'c13';if(/playoff|play.?off/i.test(n))return'playoff';
  if(/top 16/i.test(n))return'top16';if(/clasif|classif|puesto/i.test(n))return'clasif';
  return'other';}
const GAME_PREFIX:Record<string,string>={"gf":"Final","sf":"Semifinal","qf":"Cuartos de final","r16":"Octavos de final","ro16":"Octavos de final","bc":"3er puesto","3rd":"3er puesto","c5":"Class. Games 5-8","c9":"Class. Games 9-12","c13":"Class. Games 13-16","c17":"Clasificación 17-20"};
const ROUNDS:Record<string,string>={"group phase":"Fase de grupos","group stage":"Fase de grupos","qualifiers":"Clasificatorio","regular season":"Temporada regular","round of 16":"Octavos de final","round of 8":"Cuartos de final","quarter-finals":"Cuartos de final","quarterfinals":"Cuartos de final","semi-finals":"Semifinal","semifinals":"Semifinal","finals":"Final","final":"Final","gold medal game":"Final","gold medal":"Final","3rd place game":"3er puesto","bronze medal game":"3er puesto","bronze medal":"3er puesto","classification":"Clasificación","class. games 9-16":"Class. Games 9-16","class. games 5-8":"Class. Games 5-8","class. games 9-12":"Class. Games 9-12","class. games 13-16":"Class. Games 13-16","class. game 5-6":"Class. Game 5-6","class. game 7-8":"Class. Game 7-8","class. game 9-10":"Class. Game 9-10","class. game 11-12":"Class. Game 11-12","class. game 13-14":"Class. Game 13-14","class. game 15-16":"Class. Game 15-16","single":"Eliminatoria","top 16":"Top 16","play-offs":"Play-offs","playoffs":"Play-offs","play-in":"Play-In"};
function notaDe(rn:string,gn:string):string{
  const r=(rn||'').toLowerCase().trim();const parts=(gn||'').split('-');
  const prefix=parts[0]?.toLowerCase()||'';const mid=parts.length>=2?parts[1]:'';
  const esGrupo=((/group/i).test(r))||((/group/i).test(prefix));
  const esLetra=(/^[A-Za-z]$/).test(mid);const esNum=(/^\d+$/).test(mid);
  if(esGrupo&&esLetra)return`Fase de grupos · Grupo ${mid.toUpperCase()}`;
  if(esGrupo)return"Fase de grupos";
  const rondaRN=ROUNDS[r];const rondaGN=GAME_PREFIX[prefix];let rondaFallback='';
  if(!rondaRN&&r){if((/round.?of.?16|r16|r-16/i).test(r))rondaFallback="Octavos de final";
    else if((/quarter/i).test(r))rondaFallback="Cuartos de final";
    else if((/semi/i).test(r))rondaFallback="Semifinal";
    else if((/final/i).test(r)&&!(/semi/i).test(r))rondaFallback="Final";
    else if((/bronze|3rd|third/i).test(r))rondaFallback="3er puesto";
    else if((/classif|class\./i).test(r))rondaFallback="Clasificación";
    else if((/qualif/i).test(r))rondaFallback="Clasificatorio";
    else if((/play.?off/i).test(r)){const numMatch=r.match(/(\d+)/);rondaFallback=numMatch?`Play-offs · Ronda ${numMatch[1]}`:'Play-offs';}
    else if((/top.?16/i).test(r))rondaFallback="Top 16";
    else if((/regular/i).test(r))rondaFallback="Temporada regular";
    else if(r)rondaFallback=rn;}
  const ronda=rondaRN||rondaGN||rondaFallback;if(!ronda)return rn||'';
  if(parts.length>=3){const p2=parts[2]?.toUpperCase()||'';const p1=parts[1]?.toUpperCase()||'';
    if(/^[A-Z]$/.test(p2)&&!(/cuartos|semifinal|final/i).test(ronda))return`${ronda} · Grupo ${p2}`;
    if(/^[A-Z]$/.test(p1)&&!(/^\d+$/).test(p1)&&!(/cuartos|semifinal|final/i).test(ronda))return`${ronda} · Grupo ${p1}`;}
  if(esNum)return`${ronda} #${mid}`;if(esLetra)return`${ronda} · Grupo ${mid.toUpperCase()}`;
  return ronda;}
function numFaseFinal(gn:unknown):number|null{
  const parts=String(gn||'').split('-');
  if(parts.length>=2&&(/^\d+$/).test(parts[1])){const p=parts[0].toLowerCase();
    if(GAME_PREFIX[p]||(/^(r16|ro16|qf|sf|gf|bc|c5|c9|c13|c17)$/i).test(p))return parseInt(parts[1],10);}
  return null;}
function numNota(n:unknown):number|null{const m=/#(\d+)/.exec(String(n??''));return m?parseInt(m[1],10):null;}
function esFinalG(g:any){return!g.isLive&&g.teamAScore!=null&&g.teamBScore!=null&&g.teamAScore+g.teamBScore>0&&g.liveGameStatus===999;}
function esLiveG(g:any){return g.isLive===true&&g.teamAScore!=null&&g.teamBScore!=null;}
function calcularR16PosMap(juegos:any[]):Map<number,number>{
  const map=new Map<number,number>();let qfBpos=0;
  const elim=juegos.filter(g=>{const nA=g.teamA?.name||g.teamA?.longName||'',nB=g.teamB?.name||g.teamB?.longName||'';return parentGame(nA)&&parentGame(nB);});
  elim.sort((a,b)=>String(a.gameName||a.gameId).localeCompare(String(b.gameName||b.gameId)));
  for(const g of elim){const pA=parentGame(g.teamA?.name||g.teamA?.longName||''),pB=parentGame(g.teamB?.name||g.teamB?.longName||'');
    if(!pA||!pB)continue;qfBpos+=2;
    if(!map.has(pA.num))map.set(pA.num,qfBpos-1);if(!map.has(pB.num))map.set(pB.num,qfBpos);}
  return map;}
async function cargarEquiposLiga(idLiga:string,temporada:string,slug:string=''):Promise<{porOrgId:Map<string,string>;porCodigo:Map<string,string>;porNombre:Array<{id:string;nombre:string}>}>{
  const catSlug=slug?catDeSlug(slug):null;
  const scoreCat=(nombre:string):number=>{
    const catN=catDeNombre(nombre);
    if(catSlug){return catN===catSlug?2:0;}
    return catN?0:2;
  };
  const porOrgIdCand=new Map<string,{id:string;score:number}>();
  const porCodigoCand=new Map<string,{id:string;score:number}>();
  const porNombre:Array<{id:string;nombre:string}>=[];const seen=new Set<string>();
  const setSiMejor=(m:Map<string,{id:string;score:number}>,k:string,id:string,score:number)=>{
    const prev=m.get(k);
    if(!prev||score>prev.score)m.set(k,{id,score});
  };
  const{data:temps}=await sb.from('temporadas').select('id_equipo,equipos(nombre,id_fiba)').eq('id_liga',idLiga).eq('temporada',temporada).limit(2000);
  for(const t of temps||[]){if(seen.has(t.id_equipo))continue;seen.add(t.id_equipo);
    const nombre=t.equipos?.nombre||'',idFiba=t.equipos?.id_fiba||'';
    porNombre.push({id:t.id_equipo,nombre});
    if(idFiba){
      const sc=scoreCat(nombre)+1;
      setSiMejor(porOrgIdCand,String(idFiba),t.id_equipo,sc);
      if(/^[A-Z0-9]{2,8}$/i.test(idFiba)){
        setSiMejor(porCodigoCand,idFiba.toUpperCase(),t.id_equipo,sc);
      }}}
  const{data:allEq}=await sb.from('equipos').select('id_equipo,nombre,id_fiba').not('id_fiba','is',null).limit(3000);
  for(const e of allEq||[]){if(!e.id_fiba)continue;
    const sc=scoreCat(e.nombre);
    setSiMejor(porOrgIdCand,String(e.id_fiba),e.id_equipo,sc);
    if(/^[A-Z0-9]{2,8}$/i.test(e.id_fiba)){
      setSiMejor(porCodigoCand,e.id_fiba.toUpperCase(),e.id_equipo,sc);
    }
    if(!seen.has(e.id_equipo)){seen.add(e.id_equipo);porNombre.push({id:e.id_equipo,nombre:e.nombre});}}
  const porOrgId=new Map<string,string>();
  for(const[k,v]of porOrgIdCand)porOrgId.set(k,v.id);
  const porCodigo=new Map<string,string>();
  for(const[k,v]of porCodigoCand)porCodigo.set(k,v.id);
  return{porOrgId,porCodigo,porNombre};}
async function guardarIdFiba(idEquipo:string,code:string):Promise<void>{
  if(!idEquipo||!code||!/^[A-Z]{2,8}$/.test(code))return;
  await sb.from('equipos').update({id_fiba:code}).eq('id_equipo',idEquipo).is('id_fiba',null);}
function mapearEquipo(team:any,slug:string,porOrgId:Map<string,string>,porCodigo:Map<string,string>,porNombre:Array<{id:string;nombre:string}>):string|null{
  if(!team)return null;const orgId=team.organisationId!=null?String(team.organisationId):'';
  const code=(team.code||'').toUpperCase();const name=team.name||team.longName||team.shortName||'';
  if(code&&porCodigo.has(code))return porCodigo.get(code)!;
  if(orgId&&porOrgId.has(orgId))return porOrgId.get(orgId)!;
  return matchPorNombre(name,slug,porNombre);}
async function crearEvento(idLiga:string,temporada:string,slug:string,refreshFechas:boolean):Promise<any>{
  const url=`https://www.fiba.basketball/en/events/${slug}/games`;
  const html=await descargarHtml(url);const juegos=extraerPartidos(html);
  const{data:evExist}=await sb.from('fiba_eventos').select('codigos').eq('id_liga',idLiga).eq('temporada',temporada).eq('slug',slug).maybeSingle();
  const codigos:Record<string,string>=evExist?.codigos&&Object.keys(evExist.codigos).length>0?{...evExist.codigos}:{};
  const{porOrgId,porCodigo,porNombre}=await cargarEquiposLiga(idLiga,temporada,slug);
  const{data:exist}=await sb.from('partidos').select('id,id_ext,notas,id_equipo_local,id_equipo_visitante,fecha_hora,bracket_pos').eq('id_liga',idLiga).eq('temporada',temporada).limit(5000);
  const existPorExt=new Map((exist||[]).filter(p=>p.id_ext).map(p=>[String(p.id_ext),p]));
  const slotsPorRonda=new Map<string,any[]>();
  for(const p of exist||[]){if(!p.id_ext&&!p.id_equipo_local&&!p.id_equipo_visitante&&p.notas){
    const tipo=tipoRonda(p.notas);if(!slotsPorRonda.has(tipo))slotsPorRonda.set(tipo,[]);slotsPorRonda.get(tipo)!.push(p);}}
  const sinMapear:string[]=[];let creados=0,yaExistian=0,notasRellenas=0,slotsActualizados=0,fechasRefrescadas=0,fechaMin='',fechaMax='';
  const nuevos:any[]=[];const r16PosMap=calcularR16PosMap(juegos);
  for(const g of juegos){
    const fecha=g.gameDateTimeUTC?String(g.gameDateTimeUTC).replace('Z',''):null;
    if(fecha){const d=fecha.slice(0,10);if(!fechaMin||d<fechaMin)fechaMin=d;if(!fechaMax||d>fechaMax)fechaMax=d;}
    const numFinal=numFaseFinal(g.gameName);const notas=notaDe(g.roundName||'',g.gameName||'');
    const gid=String(g.gameId);
    const pA=parentGame(g.teamA?.name||g.teamA?.longName||'');const pB=parentGame(g.teamB?.name||g.teamB?.longName||'');
    const idA=mapearEquipo(g.teamA,slug,porOrgId,porCodigo,porNombre);const idB=mapearEquipo(g.teamB,slug,porOrgId,porCodigo,porNombre);
    const codeA=(g.teamA?.code||'').toUpperCase(),codeB=(g.teamB?.code||'').toUpperCase();
    if(idA&&codeA){codigos[codeA]=idA;await guardarIdFiba(idA,codeA);}if(idB&&codeB){codigos[codeB]=idB;await guardarIdFiba(idB,codeB);}
    if(existPorExt.has(gid)){const ex=existPorExt.get(gid)!;const updates:any={};
      if(notas&&(!ex.notas||ex.notas.trim()==='')){{updates.notas=notas;notasRellenas++;}}
      if(fecha){
        const prev=(ex as any).fecha_hora;
        const cambia=refreshFechas?String(prev||'').replace(' ','T').slice(0,16)!==fecha.slice(0,16):!prev;
        if(cambia){updates.fecha_hora=fecha;if(prev)fechasRefrescadas++;}
      }
      if(Object.keys(updates).length>0)await sb.from('partidos').update(updates).eq('id',ex.id);
      yaExistian++;continue;}
    if(!idA||!idB){
      if(!idA&&g.teamA&&!pA)sinMapear.push(`${codeA}(${g.teamA?.name||''})`);
      if(!idB&&g.teamB&&!pB)sinMapear.push(`${codeB}(${g.teamB?.name||''})`);
      if(numFinal||pA||pB){const tipo=tipoRonda(notas);const bpos=pA?pA.num:null;
        const slots=slotsPorRonda.get(tipo)||[];const slotExistente=slots.shift();
        if(slotExistente){const updates:any={id_ext:gid};if(fecha)updates.fecha_hora=fecha;
          if(notas&&(!slotExistente.notas||slotExistente.notas.trim()===''))updates.notas=notas;
          if(bpos!=null)updates.bracket_pos=bpos;
          await sb.from('partidos').update(updates).eq('id',slotExistente.id);slotsActualizados++;
        }else{nuevos.push({id_liga:idLiga,temporada,id_equipo_local:null,id_equipo_visitante:null,fecha_hora:fecha,id_ext:gid,fuente:'fiba',notas,bracket_pos:bpos??undefined});creados++;}}
      continue;}
    const yaExistePorEquipo=(exist||[]).some(p=>p.id_equipo_local===idA&&p.id_equipo_visitante===idB&&fecha&&p.fecha_hora&&String(p.fecha_hora).slice(0,16)===fecha.slice(0,16));
    if(yaExistePorEquipo){yaExistian++;continue;}
    const gameNum=numFaseFinal(g.gameName);const bpos=gameNum&&r16PosMap.has(gameNum)?r16PosMap.get(gameNum):null;
    const rl=g.teamAScore!=null&&g.teamBScore!=null&&(g.teamAScore+g.teamBScore)>0?g.teamAScore:null;
    nuevos.push({id_liga:idLiga,temporada,id_equipo_local:idA,id_equipo_visitante:idB,resultado_local:rl,resultado_visitante:rl!=null?g.teamBScore:null,fecha_hora:fecha,id_ext:gid,fuente:'fiba',notas,bracket_pos:bpos??undefined});creados++;}
  if(nuevos.length>0){const{error}=await sb.from('partidos').insert(nuevos);if(error)throw new Error(`Insert: ${error.message}`);}
  await sb.from('fiba_eventos').upsert({id_liga:idLiga,temporada,slug,activo:true,fecha_ini:fechaMin||new Date().toISOString().slice(0,10),fecha_fin:fechaMax||new Date().toISOString().slice(0,10),codigos},{onConflict:'id_liga,temporada,slug'});
  return{ok:true,modo:'crear_evento',juegos_fiba:juegos.length,creados,ya_existian:yaExistian,slots_actualizados:slotsActualizados,notas_rellenas:notasRellenas,fechas_refrescadas:fechasRefrescadas,sin_mapear:[...new Set(sinMapear)],fecha_ini:fechaMin,fecha_fin:fechaMax,codigos_generados:Object.keys(codigos).length,activo:true};}
async function procesarEvento(ev:{url:string;idLiga:string;temporada:string;slug:string;codigos:Record<string,string>;refreshFechas:boolean}):Promise<any>{
  const html=await descargarHtml(ev.url);const juegos=extraerPartidos(html);
  const{data:cands}=await sb.from('partidos').select('id,id_ext,notas,bracket_pos,id_equipo_local,id_equipo_visitante,fecha_hora,resultado_local,resultado_visitante,es_live,periodo').eq('id_liga',ev.idLiga).eq('temporada',ev.temporada).or('resultado_local.is.null,es_live.is.true');
  const candidatos=cands||[];const{porOrgId,porCodigo,porNombre}=await cargarEquiposLiga(ev.idLiga,ev.temporada,ev.slug);
  const detalles:string[]=[];let cruces=0,actualizados=0,boxscoresNuevos=0,fechasRefrescadas=0;const liveGameIds:string[]=[];
  const porNumero=new Map<number,any>();const porExt=new Map(candidatos.filter(p=>p.id_ext).map(p=>[String(p.id_ext),p]));
  const slotsPorRonda=new Map<string,any[]>();
  for(const p of candidatos){if(!p.id_ext&&!p.id_equipo_local&&!p.id_equipo_visitante&&p.notas){
    const tipo=tipoRonda(p.notas);if(!slotsPorRonda.has(tipo))slotsPorRonda.set(tipo,[]);slotsPorRonda.get(tipo)!.push(p);
    const n=numNota(p.notas);if(n!=null)porNumero.set(n,p);}}
  for(const g of juegos){const gid=String(g.gameId);const p=porExt.get(gid);
    if(!p)continue;
    const upd:any={};
    if(!p.notas||p.notas.trim()===''){
      const notas=notaDe(g.roundName||'',g.gameName||'');
      if(notas){upd.notas=notas;detalles.push(`nota ${p.id}: ${notas}`);}
    }
    if(ev.refreshFechas&&g.gameDateTimeUTC){
      const nueva=String(g.gameDateTimeUTC).replace('Z','');
      const prev=String(p.fecha_hora||'').replace(' ','T');
      if(prev.slice(0,16)!==nueva.slice(0,16)){upd.fecha_hora=nueva;fechasRefrescadas++;detalles.push(`fecha ${p.id}: ${nueva}`);}
    }
    if(Object.keys(upd).length){await sb.from('partidos').update(upd).eq('id',p.id);if(upd.notas)p.notas=upd.notas;if(upd.fecha_hora)p.fecha_hora=upd.fecha_hora;}
  }
  const r16PosMap=calcularR16PosMap(juegos);
  for(const g of juegos){const gid=String(g.gameId);
    if(porExt.has(gid)){const p=porExt.get(gid)!;
      if(p.id_equipo_local&&p.id_equipo_visitante)continue;
      if(g.teamA&&g.teamB){const local=mapearEquipo(g.teamA,ev.slug,porOrgId,porCodigo,porNombre);
        const visitante=mapearEquipo(g.teamB,ev.slug,porOrgId,porCodigo,porNombre);
        const cA=(g.teamA?.code||'').toUpperCase(),cB=(g.teamB?.code||'').toUpperCase();
        if(local&&cA)await guardarIdFiba(local,cA);if(visitante&&cB)await guardarIdFiba(visitante,cB);
        if(local&&visitante&&(!p.id_equipo_local||!p.id_equipo_visitante)){
          await sb.from('partidos').update({id_equipo_local:local,id_equipo_visitante:visitante}).eq('id',p.id);
          detalles.push(`equipos ${p.id}: ${cA} vs ${cB}`);cruces++;}}continue;}
    const numFinal=numFaseFinal(g.gameName);if(!numFinal)continue;
    const notas=notaDe(g.roundName||'',g.gameName||'');
    const pA=parentGame(g.teamA?.name||g.teamA?.longName||''),pB=parentGame(g.teamB?.name||g.teamB?.longName||'');
    if(!pA&&!pB)continue;
    let slot=porNumero.get(numFinal);
    if(!slot){const tipo=tipoRonda(notas);const slots=slotsPorRonda.get(tipo)||[];slot=slots.shift();}
    if(!slot)continue;
    const fecha=g.gameDateTimeUTC?String(g.gameDateTimeUTC).replace('Z',''):null;
    const updates:any={id_ext:gid};if(fecha)updates.fecha_hora=fecha;
    if(notas&&(!slot.notas||slot.notas.trim()===''))updates.notas=notas;
    if(pA)updates.bracket_pos=pA.num;
    await sb.from('partidos').update(updates).eq('id',slot.id);
    detalles.push(`slot ${slot.id} → ${notas}`);cruces++;}
  for(const g of juegos){
    if(!g.teamA||!g.teamB)continue;const final=esFinalG(g),live=esLiveG(g);
    if(!final&&!live)continue;
    const local=mapearEquipo(g.teamA,ev.slug,porOrgId,porCodigo,porNombre);
    const visitante=mapearEquipo(g.teamB,ev.slug,porOrgId,porCodigo,porNombre);
    if(!local||!visitante)continue;
    const cA=(g.teamA?.code||'').toUpperCase(),cB=(g.teamB?.code||'').toUpperCase();
    if(local&&cA)await guardarIdFiba(local,cA);if(visitante&&cB)await guardarIdFiba(visitante,cB);
    const cF=String(g.gameDateTimeUTC).slice(0,16);
    for(const p of candidatos){
      const fD=String(p.fecha_hora||'').replace(' ','T');
      if(p.id_equipo_local!==local||p.id_equipo_visitante!==visitante||!fD.startsWith(cF))continue;
      const sN=(g.teamAScore??0)+(g.teamBScore??0),sA=(p.resultado_local??0)+(p.resultado_visitante??0);
      if(!final&&sN<sA)break;
      const nuevo=final?{resultado_local:g.teamAScore,resultado_visitante:g.teamBScore,es_live:false,periodo:null}:{resultado_local:g.teamAScore,resultado_visitante:g.teamBScore,es_live:true,periodo:g.liveGameStatus??null};
      const sc=p.resultado_local===nuevo.resultado_local&&p.resultado_visitante===nuevo.resultado_visitante&&p.es_live===nuevo.es_live&&p.periodo===nuevo.periodo;
      if(!sc){await sb.from('partidos').update(nuevo).eq('id',p.id);detalles.push(`${p.id}: score`);actualizados++;}
      if(live||final)liveGameIds.push(String(g.gameId));break;}}
  const gameIdsProcesar=new Set(liveGameIds);
  const{data:sinBox}=await sb.from('partidos').select('id,id_ext').eq('id_liga',ev.idLiga).eq('temporada',ev.temporada).eq('fuente','fiba').not('resultado_local','is',null).not('id_ext','is',null).limit(200);
  if(sinBox?.length){const ids=sinBox.map(p=>p.id);const{data:conBox}=await sb.from('partido_boxscore').select('id_partido').in('id_partido',ids).limit(1000);
    const conBoxSet=new Set((conBox||[]).map(b=>b.id_partido));let n=0;
    for(const p of sinBox){if(!conBoxSet.has(p.id)&&p.id_ext&&!gameIdsProcesar.has(String(p.id_ext))){gameIdsProcesar.add(String(p.id_ext));n++;if(n>=5)break;}}}
  for(const gameId of [...gameIdsProcesar].slice(0,5)){try{
    const r=await fetch(`${SB_URL}/functions/v1/cargar-boxscores-fiba`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${SB_KEY}`},body:JSON.stringify({id_liga:ev.idLiga,temporada:ev.temporada,slug:ev.slug,id_ext:gameId,force:true}),signal:AbortSignal.timeout(25000)});
    const d=await r.json();if((d.filas??d.hechos??0)>0){detalles.push(`boxscore ${gameId}: ${d.filas??0} líneas`);boxscoresNuevos+=d.filas??0;}}catch(e){detalles.push(`boxscore ${gameId}: ERROR`);}}
  return{fiba:juegos.length,candidatos:candidatos.length,cruces,actualizados,fechas_refrescadas:fechasRefrescadas,boxscores_nuevos:boxscoresNuevos,detalles};}

async function refrescarLiveOnce():Promise<string[]>{
  const refrescados:string[]=[];
  // v40: incluye también partidos en ventana [-3h,+15min] aunque es_live=false
  // porque FIBA no siempre marca es_live y perdíamos marcadores en vivo.
  const now=Date.now();
  const desde=new Date(now-3*3600*1000).toISOString();
  const hasta=new Date(now+15*60*1000).toISOString();
  const{data:lives}=await sb.from('partidos').select('id,id_ext,periodo,resultado_local,resultado_visitante,es_live,fecha_hora')
    .eq('fuente','fiba').not('id_ext','is',null)
    .or(`es_live.eq.true,and(fecha_hora.gte.${desde},fecha_hora.lte.${hasta})`)
    .limit(50);
  for(const p of (lives||[])){
    try{
      const r=await fetch(`https://www.fiba.basketball/en/events/api/game-live-info/${p.id_ext}/light?_cb=${Date.now()}`,{
        headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json','Cache-Control':'no-cache'},
        signal:AbortSignal.timeout(6000)
      });
      if(!r.ok){await r.body?.cancel();continue;}
      const j=await r.json();
      const c=j?.game?.content;if(!c)continue;
      const sa=Number(c?.teamA?.score),sv=Number(c?.teamB?.score);
      if(isNaN(sa)||isNaN(sv))continue;
      const qStr=String(c?.quarter||'');
      const qm=/^Q(\d+)$/.exec(qStr);const otm=/^OT(\d*)$/.exec(qStr);
      const periodo=qm?parseInt(qm[1]):otm?4+Math.max(1,parseInt(otm[1]||'1')):null;
      // status FIBA: 1=pre, 3=live, 5+ = finished
      const statusNum=Number(c?.status||0);
      const rt=String(c?.remainingTime||'').trim();
      const finished=statusNum>=5||(periodo!=null&&periodo>=4&&(rt==='00:00'||rt==='0:00')&&String(c?.quarterStatus||'').toUpperCase()!=='S');
      const live=statusNum===3||(!finished&&(sa>0||sv>0));
      const upd:any={};
      if(p.resultado_local!==sa)upd.resultado_local=sa;
      if(p.resultado_visitante!==sv)upd.resultado_visitante=sv;
      if(periodo!=null&&p.periodo!==periodo)upd.periodo=finished?null:periodo;
      const newLive=!!live&&!finished;
      if(!!p.es_live!==newLive)upd.es_live=newLive;
      if(finished&&p.periodo!=null)upd.periodo=null;
      if(Object.keys(upd).length){
        await sb.from('partidos').update(upd).eq('id',p.id);
        refrescados.push(`${p.id_ext}:${sa}-${sv}${periodo!=null?' Q'+periodo:''}${finished?' FT':live?' LIVE':''}`);
      }
    }catch{/* silent */}
  }
  return refrescados;
}

// v39: devuelve el set de "ligaId|temporada" que tienen partido live o en ventana [-1h, +3h].
async function ligasConActividad():Promise<Set<string>>{
  const now=new Date();
  const desde=new Date(now.getTime()-1*3600*1000).toISOString();
  const hasta=new Date(now.getTime()+3*3600*1000).toISOString();
  const{data,error}=await sb.from('partidos').select('id_liga,temporada')
    .eq('fuente','fiba')
    .or(`es_live.eq.true,and(fecha_hora.gte.${desde},fecha_hora.lte.${hasta})`)
    .limit(500);
  if(error)return new Set();
  const s=new Set<string>();
  for(const p of data||[])if(p.id_liga)s.add(`${p.id_liga}|${p.temporada||''}`);
  return s;
}

Deno.serve(async(req)=>{
  const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
  const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,'Content-Type':'application/json'}});
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  try{
    let body:any={};try{body=await req.json();}catch{body={};}
    const refreshFechas=body.refresh_fechas===true;
    const forceAll=body.force_all===true;
    if(body.modo==='crear_evento'){
      const{id_liga,temporada,slug}=body;
      if(!id_liga||!temporada||!slug)return json({ok:false,error:'Faltan: id_liga, temporada, slug'},400);
      const result=await Promise.race([crearEvento(String(id_liga),String(temporada),String(slug),refreshFechas),
        new Promise<any>(r=>setTimeout(()=>r({ok:true,modo:'crear_evento',mensaje:'Procesando...'}),24000))]);
      return json(result);}
    if(body.modo==='desde_standings'){
      const{id_liga,temporada,slug}=body;
      if(!id_liga||!temporada||!slug)return json({ok:false,error:'Faltan: id_liga, temporada, slug'},400);
      const result=await Promise.race([desdeStandings(String(id_liga),String(temporada),String(slug),refreshFechas),
        new Promise<any>(r=>setTimeout(()=>r({ok:true,modo:'desde_standings',mensaje:'Procesando...'}),24000))]);
      return json(result);}
    const{data:eventos,error}=await sb.from('fiba_eventos').select('id_liga,temporada,slug,codigos').eq('activo',true).lte('fecha_ini',new Date().toISOString().slice(0,10)).gte('fecha_fin',new Date().toISOString().slice(0,10));
    if(error)throw new Error(`BD: ${error.message}`);
    const liveRefresh:string[]=[];
    // v40: entrar al loop live también cuando hay partido FIBA en ventana [-3h,+15min] sin resultado,
    // porque FIBA no siempre marca es_live=true y perdíamos marcadores en vivo.
    const _now=Date.now();
    const _vDesde=new Date(_now-3*3600*1000).toISOString();
    const _vHasta=new Date(_now+15*60*1000).toISOString();
    const{count:liveCount}=await sb.from('partidos').select('id',{count:'exact',head:true})
      .eq('fuente','fiba').not('id_ext','is',null)
      .or(`es_live.eq.true,and(fecha_hora.gte.${_vDesde},fecha_hora.lte.${_vHasta})`);
    if(liveCount&&liveCount>0){
      const t0=Date.now();
      for(let i=0;i<10;i++){
        const r=await refrescarLiveOnce();
        if(r.length)liveRefresh.push(...r.map(s=>`t${i*5}s ${s}`));
        if(Date.now()-t0>=48000)break;
        await new Promise(r=>setTimeout(r,5000));
      }
    }
    if(!eventos||eventos.length===0)return json({ok:true,mensaje:'No hay eventos activos hoy',live_refresh:liveRefresh});
    // v39: egress-gate — solo descargar HTML de eventos con partido en ventana [-1h,+3h] o live.
    const activos=forceAll?null:await ligasConActividad();
    const procesar=forceAll?eventos:eventos.filter(ev=>activos!.has(`${ev.id_liga}|${ev.temporada}`));
    const skipped=eventos.length-procesar.length;
    const resultados:Record<string,unknown>={};let algunoOk=false;
    for(const ev of procesar){const url=`https://www.fiba.basketball/en/events/${ev.slug}/games`;
      try{resultados[ev.id_liga]=await procesarEvento({url,idLiga:ev.id_liga,temporada:ev.temporada,slug:ev.slug,codigos:ev.codigos as Record<string,string>,refreshFechas});algunoOk=true;}
      catch(e){resultados[ev.id_liga]={ok:false,error:String(e)};}}
    for(const ev of eventos){
      const{count:pend}=await sb.from('partidos').select('id',{count:'exact',head:true}).eq('id_liga',ev.id_liga).eq('temporada',ev.temporada).is('resultado_local',null);
      if(pend===0){await sb.from('fiba_eventos').update({activo:false}).eq('id_liga',ev.id_liga).eq('temporada',ev.temporada).eq('slug',ev.slug);}
    }
    return json({ok:algunoOk||skipped>0,eventos:resultados,skipped,live_refresh:liveRefresh});
  }catch(e){return json({ok:false,error:String(e)},500);}});
