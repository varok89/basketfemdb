import React,{useMemo,useState} from "react";
import {useT} from "../lib/i18n";

const DAY_MS=86400000;
const pad2=n=>String(n).padStart(2,"0");
const dayKey=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const fmtHora=iso=>{const d=new Date(iso);return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;};
const fmtDiaLargo=(d,lang)=>d.toLocaleDateString(lang==="en"?"en-GB":"es-ES",{weekday:"long",day:"numeric",month:"long"});

// Un partido cuenta como "favorito" si su liga, equipo local o visitante están en favoritos.
function esFavPartido(p,favSet){
  return favSet.has("L:"+p.id_liga)||favSet.has("E:"+p.id_equipo_local)||favSet.has("E:"+p.id_equipo_visitante);
}

function estadoPartido(p){
  if(p.es_live) return {txt:p.periodo?`Q${p.periodo}`:"LIVE",color:"#dc2626",live:true};
  if(p.resultado_local!=null&&p.resultado_visitante!=null) return {txt:"FT",color:"var(--fx-muted)",live:false};
  return {txt:fmtHora(p.fecha_hora),color:"var(--fx-muted)",live:false};
}

function Escudo({url,alt}){
  const box={width:22,height:22,borderRadius:"4px",background:"var(--fx-hover)",display:"inline-flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0};
  return <span style={box}>{url?<img src={url} alt={alt||""} loading="lazy" style={{width:"100%",height:"100%",objectFit:"contain"}}/>:<span style={{fontSize:"11px"}}>🏀</span>}</span>;
}

function PartidoRow({p,eqL,eqV,highlight,onGoToPartido,onGoToTeam}){
  const est=estadoPartido(p);
  const parc=p.parciales&&typeof p.parciales==="object"?p.parciales:null;
  const qLocal=parc?.local||[];
  const qVisit=parc?.visitante||[];
  const hasScore=p.resultado_local!=null&&p.resultado_visitante!=null;
  const ganaL=hasScore&&p.resultado_local>p.resultado_visitante;
  const ganaV=hasScore&&p.resultado_visitante>p.resultado_local;
  const bg=highlight?"linear-gradient(90deg, rgba(147,51,234,0.12), rgba(147,51,234,0.03))":"transparent";
  const border=highlight?"1px solid rgba(147,51,234,0.35)":"1px solid var(--fx-border)";
  const clickable=!!onGoToPartido;
  return(
    <div
      onClick={clickable?()=>onGoToPartido(p.id):undefined}
      style={{display:"grid",gridTemplateColumns:"48px 1fr auto",gap:"8px",alignItems:"center",background:bg,border,borderRadius:"10px",padding:"8px 10px",marginBottom:"6px",cursor:clickable?"pointer":"default"}}>
      <div style={{textAlign:"center",fontSize:"11px",fontWeight:800,color:est.color,lineHeight:1.1}}>
        {est.live&&<div style={{width:6,height:6,background:"#dc2626",borderRadius:"50%",display:"inline-block",marginRight:4,animation:"bfdb-pulse 1.5s infinite"}}/>}
        {est.txt}
      </div>
      <div style={{minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"3px",fontWeight:ganaL?800:600,color:ganaL?"var(--fx-text)":"var(--fx-muted)",fontSize:"13px"}}>
          <Escudo url={eqL?.escudo} alt={eqL?.nombre}/>
          <span onClick={eqL?e=>{e.stopPropagation();onGoToTeam&&onGoToTeam(eqL.id_equipo);}:undefined} style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:eqL&&onGoToTeam?"pointer":"default"}}>{eqL?.nombre||"—"}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"6px",fontWeight:ganaV?800:600,color:ganaV?"var(--fx-text)":"var(--fx-muted)",fontSize:"13px"}}>
          <Escudo url={eqV?.escudo} alt={eqV?.nombre}/>
          <span onClick={eqV?e=>{e.stopPropagation();onGoToTeam&&onGoToTeam(eqV.id_equipo);}:undefined} style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:eqV&&onGoToTeam?"pointer":"default"}}>{eqV?.nombre||"—"}</span>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
        {qLocal.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:`repeat(${qLocal.length},20px)`,gap:"2px",fontSize:"11px",color:"var(--fx-muted2)",textAlign:"center",fontVariantNumeric:"tabular-nums"}}>
            {qLocal.map((q,i)=><div key={"l"+i}>{q}</div>)}
            {qVisit.map((q,i)=><div key={"v"+i}>{q}</div>)}
          </div>
        )}
        <div style={{minWidth:"32px",textAlign:"right",fontWeight:800,fontSize:"14px",fontVariantNumeric:"tabular-nums"}}>
          <div style={{color:ganaL?"var(--fx-text)":"var(--fx-muted)"}}>{p.resultado_local??"·"}</div>
          <div style={{color:ganaV?"var(--fx-text)":"var(--fx-muted)"}}>{p.resultado_visitante??"·"}</div>
        </div>
      </div>
    </div>
  );
}

const COLAPSO_KEY="bfdb:hoy:colapsadas";
function loadColapsadas(){
  try{const r=localStorage.getItem(COLAPSO_KEY);return r?new Set(JSON.parse(r)):new Set();}catch{return new Set();}
}
function saveColapsadas(s){
  try{localStorage.setItem(COLAPSO_KEY,JSON.stringify([...s]));}catch{}
}

export default function HoyView({partidos,equipos,ligas,user,favoritos,onToggleFav,onGoToPartido,onGoToTeam,onGoToLeague,lang}){
  const t=useT();
  const [diaOffset,setDiaOffset]=useState(0); // -1..+7
  const [subTab,setSubTab]=useState("todos"); // todos | favoritos | competiciones
  const [ligaFiltro,setLigaFiltro]=useState(null);
  const [colapsadas,setColapsadas]=useState(loadColapsadas);
  const toggleColapso=(id)=>setColapsadas(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);saveColapsadas(n);return n;});

  const equipoMap=useMemo(()=>{const m={};(equipos||[]).forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap=useMemo(()=>{const m={};(ligas||[]).forEach(l=>m[l.id_liga]=l);return m;},[ligas]);

  const fechaObjetivo=useMemo(()=>{
    const d=new Date();d.setHours(0,0,0,0);d.setTime(d.getTime()+diaOffset*DAY_MS);return d;
  },[diaOffset]);
  const keyObjetivo=dayKey(fechaObjetivo);

  const favSet=useMemo(()=>{
    const s=new Set();
    (favoritos||[]).forEach(f=>{
      if(f.tipo==="liga") s.add("L:"+f.id_referencia);
      else if(f.tipo==="equipo") s.add("E:"+f.id_referencia);
    });
    return s;
  },[favoritos]);

  const partidosDia=useMemo(()=>{
    return (partidos||[]).filter(p=>p.fecha_hora&&dayKey(new Date(p.fecha_hora))===keyObjetivo).sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora));
  },[partidos,keyObjetivo]);

  const favDelDia=useMemo(()=>partidosDia.filter(p=>esFavPartido(p,favSet)),[partidosDia,favSet]);

  const competiciones=useMemo(()=>{
    const m=new Map();
    partidosDia.forEach(p=>{
      const l=ligaMap[p.id_liga];if(!l)return;
      m.set(l.id_liga,(m.get(l.id_liga)||0)+1);
    });
    return [...m.entries()].map(([id,n])=>({liga:ligaMap[id],n})).sort((a,b)=>b.n-a.n||a.liga.nombre.localeCompare(b.liga.nombre));
  },[partidosDia,ligaMap]);

  const fuente=subTab==="favoritos"?favDelDia:partidosDia;
  const filtrados=ligaFiltro?fuente.filter(p=>p.id_liga===ligaFiltro):fuente;

  const porLiga=useMemo(()=>{
    const groups=new Map();
    filtrados.forEach(p=>{
      const l=ligaMap[p.id_liga];if(!l)return;
      if(!groups.has(l.id_liga)) groups.set(l.id_liga,{liga:l,partidos:[]});
      groups.get(l.id_liga).partidos.push(p);
    });
    return [...groups.values()].sort((a,b)=>a.liga.nombre.localeCompare(b.liga.nombre));
  },[filtrados,ligaMap]);

  const btnDay=(off,label)=>{
    const act=diaOffset===off;
    return <button onClick={()=>setDiaOffset(off)} style={{background:act?"#9333ea":"var(--fx-card)",color:act?"#fff":"var(--fx-text)",border:"1px solid "+(act?"#9333ea":"var(--fx-border)"),borderRadius:"999px",padding:"6px 12px",fontWeight:700,fontSize:"12px",cursor:"pointer",whiteSpace:"nowrap"}}>{label}</button>;
  };

  const nav=(delta)=>setDiaOffset(o=>Math.min(7,Math.max(-1,o+delta)));

  const subTabBtn=(k,label,n)=>{
    const act=subTab===k;
    return <button onClick={()=>{setSubTab(k);setLigaFiltro(null);}} style={{background:"transparent",border:"none",borderBottom:act?"2px solid #9333ea":"2px solid transparent",color:act?"#9333ea":"var(--fx-muted)",fontWeight:700,fontSize:"13px",padding:"8px 4px",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px"}}>{label}{n!=null&&<span style={{background:act?"#9333ea":"var(--fx-hover)",color:act?"#fff":"var(--fx-muted)",borderRadius:"999px",padding:"1px 8px",fontSize:"11px",fontWeight:800}}>{n}</span>}</button>;
  };

  return(
    <div className="bfdb-container" style={{maxWidth:"880px",margin:"0 auto",padding:"16px"}}>
      <style>{`@keyframes bfdb-pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--fx-card)",borderRadius:"12px",padding:"10px 12px",marginBottom:"12px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        <button onClick={()=>nav(-1)} disabled={diaOffset<=-1} style={{background:"transparent",border:"1px solid var(--fx-border)",borderRadius:"50%",width:32,height:32,cursor:diaOffset<=-1?"not-allowed":"pointer",opacity:diaOffset<=-1?0.3:1,color:"var(--fx-text)",fontSize:"14px"}}>‹</button>
        <div style={{textAlign:"center",flex:1}}>
          <div style={{fontWeight:800,fontSize:"15px",color:"var(--fx-text)"}}>
            {diaOffset===0?(lang==="en"?"Today":"Hoy"):diaOffset===-1?(lang==="en"?"Yesterday":"Ayer"):diaOffset===1?(lang==="en"?"Tomorrow":"Mañana"):fmtDiaLargo(fechaObjetivo,lang)}
          </div>
          <div style={{fontSize:"11px",color:"var(--fx-muted)"}}>{fmtDiaLargo(fechaObjetivo,lang)}</div>
        </div>
        <button onClick={()=>nav(+1)} disabled={diaOffset>=7} style={{background:"transparent",border:"1px solid var(--fx-border)",borderRadius:"50%",width:32,height:32,cursor:diaOffset>=7?"not-allowed":"pointer",opacity:diaOffset>=7?0.3:1,color:"var(--fx-text)",fontSize:"14px"}}>›</button>
      </div>

      <div style={{display:"flex",gap:"6px",overflowX:"auto",marginBottom:"12px",paddingBottom:"4px"}}>
        {btnDay(-1,lang==="en"?"Yest":"Ayer")}
        {btnDay(0,lang==="en"?"Today":"Hoy")}
        {[1,2,3,4,5,6,7].map(off=>{
          const d=new Date();d.setHours(0,0,0,0);d.setTime(d.getTime()+off*DAY_MS);
          return <React.Fragment key={off}>{btnDay(off,d.toLocaleDateString(lang==="en"?"en-GB":"es-ES",{weekday:"short",day:"numeric"}))}</React.Fragment>;
        })}
      </div>

      <div style={{display:"flex",gap:"12px",borderBottom:"1px solid var(--fx-border)",marginBottom:"12px",overflowX:"auto"}}>
        {subTabBtn("todos",lang==="en"?"All":"Todos",partidosDia.length)}
        {user&&subTabBtn("favoritos",lang==="en"?"Favorites":"Favoritos",favDelDia.length)}
        {subTabBtn("competiciones",lang==="en"?"Competitions":"Competiciones",competiciones.length)}
      </div>

      {ligaFiltro&&ligaMap[ligaFiltro]&&(
        <div style={{marginBottom:"10px"}}>
          <button onClick={()=>setLigaFiltro(null)} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"999px",padding:"4px 10px",fontSize:"12px",fontWeight:700,cursor:"pointer"}}>
            {ligaMap[ligaFiltro].nombre} ✕
          </button>
        </div>
      )}

      {subTab==="competiciones"&&!ligaFiltro?(
        competiciones.length===0
          ?<div style={{textAlign:"center",padding:"40px 20px",color:"var(--fx-muted)"}}>{lang==="en"?"No competitions with games this day.":"No hay competiciones con partidos este día."}</div>
          :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"10px"}}>
            {competiciones.map(({liga,n})=>{
              const ligaFav=favSet.has("L:"+liga.id_liga);
              return(
                <div key={liga.id_liga} style={{background:"var(--fx-card)",border:"1px solid var(--fx-border)",borderRadius:"12px",padding:"12px",display:"flex",alignItems:"center",gap:"10px"}}>
                  <button onClick={()=>{setLigaFiltro(liga.id_liga);setSubTab("todos");}} style={{background:"transparent",border:"none",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:"10px",flex:1,minWidth:0,padding:0}}>
                    <Escudo url={liga.logo} alt={liga.nombre}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:"13px",color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{liga.nombre}</div>
                      <div style={{fontSize:"11px",color:"var(--fx-muted)"}}>{liga.pais||""}</div>
                    </div>
                    <div style={{fontWeight:800,fontSize:"14px",color:"#9333ea"}}>{n}</div>
                  </button>
                  <button onClick={()=>onToggleFav&&onToggleFav("liga",liga.id_liga)} title={ligaFav?(lang==="en"?"Remove":"Quitar"):(lang==="en"?"Add favorite":"Añadir favorita")} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:"20px",color:ligaFav?"#eab308":"var(--fx-muted2)",padding:"4px"}}>{ligaFav?"★":"☆"}</button>
                </div>
              );
            })}
          </div>
      ):(
        porLiga.length===0
          ?<div style={{textAlign:"center",padding:"40px 20px",color:"var(--fx-muted)"}}>
            {subTab==="favoritos"
              ?(lang==="en"?"No favorite games this day. Star a league or team to see them here.":"No hay partidos favoritos este día. Marca ligas o equipos con ⭐.")
              :(lang==="en"?"No games this day.":"No hay partidos este día.")}
          </div>
          :porLiga.map(({liga,partidos:pp})=>{
            const ligaFav=favSet.has("L:"+liga.id_liga);
            const colapsada=colapsadas.has(liga.id_liga);
            return(
              <div key={liga.id_liga} style={{marginBottom:"16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"8px",padding:"6px 4px",background:"var(--fx-hover)",borderRadius:"8px"}}>
                  <button onClick={()=>toggleColapso(liga.id_liga)} title={colapsada?"Expandir":"Colapsar"} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:"14px",color:"var(--fx-muted)",padding:"2px 6px",width:24}}>{colapsada?"▸":"▾"}</button>
                  <Escudo url={liga.logo} alt={liga.nombre}/>
                  <div onClick={()=>onGoToLeague&&onGoToLeague(liga.id_liga)} style={{cursor:onGoToLeague?"pointer":"default",flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:"14px",color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{liga.nombre}</div>
                    <div style={{fontSize:"11px",color:"var(--fx-muted)"}}>{liga.pais||""}</div>
                  </div>
                  <div style={{fontSize:"12px",color:"var(--fx-muted)",fontWeight:700,padding:"0 4px"}}>{pp.length}</div>
                  <button
                    onClick={()=>onToggleFav&&onToggleFav("liga",liga.id_liga)}
                    title={ligaFav?(lang==="en"?"Remove league from favorites":"Quitar liga de favoritos"):(lang==="en"?"Add league to favorites":"Añadir liga a favoritos")}
                    style={{background:"transparent",border:"none",cursor:"pointer",fontSize:"20px",color:ligaFav?"#eab308":"var(--fx-muted2)",padding:"4px 8px"}}>
                    {ligaFav?"★":"☆"}
                  </button>
                </div>
                {!colapsada&&(
                  <div>
                    {pp.map(p=>{
                      const fav=esFavPartido(p,favSet);
                      const highlight=subTab==="todos"&&fav;
                      return(
                        <PartidoRow
                          key={p.id}
                          p={p}
                          eqL={equipoMap[p.id_equipo_local]}
                          eqV={equipoMap[p.id_equipo_visitante]}
                          highlight={highlight}
                          onGoToPartido={onGoToPartido}
                          onGoToTeam={onGoToTeam}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
      )}
    </div>
  );
}
