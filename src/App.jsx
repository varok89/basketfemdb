import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { supabase, callFn, fetchAll } from "./lib/supabaseClient";
import { LOGROS, LOGROS_BY_SLUG, CATEGORIAS, initLogros, registrarEvento, onLogroDesbloqueado, getEstadoLogros } from "./lib/logros";
import { AVATAR_PRESETS, UserAvatar } from "./lib/avatar";
import { useT, useLang, setLang, locale } from "./lib/i18n";

const CalidadModal = lazy(() => import("./views/CalidadModal"));
const RankingFibaView = lazy(() => import("./views/RankingFibaView"));
const LogrosModal  = lazy(() => import("./views/LogrosModal"));
const PerfilPublicoModal = lazy(() => import("./views/PerfilPublicoModal"));
const PrivacidadView = lazy(() => import("./views/PrivacidadView"));
const QuinielaView = lazy(() => import("./views/MundialViews"));
const ComparadorView = lazy(() => import("./views/ComparadorView"));

import {
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
} from "./lib/ui";


import PartidosView from "./views/PartidosView";
import PlayersView from "./views/PlayersView";
import TeamsView from "./views/TeamsView";
import LeaguesView from "./views/LeaguesView";
import CoachesView from "./views/CoachesView";

/* ── GlobalSearch ───────────────────────────────────────── */
function GlobalSearch({players,equipos,ligas,coaches,onGoToPlayer,onGoToTeam,onGoToLeague,onGoToCoach,fullscreen,onClose}){
  const t = useT();
  const [q,setQ]=useState("");
  const [open,setOpen]=useState(false);
  const [selectedIdx,setSelectedIdx]=useState(0);
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

  // Aplana los resultados en una lista lineal para navegar con teclado.
  const flatItems=useMemo(()=>{
    if(!results)return [];
    const cap=fullscreen?8:6;
    const list=[];
    results.jugadoras.slice(0,cap).forEach(p=>list.push({action:()=>onGoToPlayer(p.id_jugadora)}));
    results.equipos.slice(0,fullscreen?8:4).forEach(e=>list.push({action:()=>onGoToTeam(e.id_equipo)}));
    results.ligas.slice(0,fullscreen?8:3).forEach(l=>list.push({action:()=>onGoToLeague(l.id_liga)}));
    results.coaches.slice(0,fullscreen?8:3).forEach(c=>list.push({action:()=>onGoToCoach(c.id_coach)}));
    return list;
  },[results,fullscreen,onGoToPlayer,onGoToTeam,onGoToLeague,onGoToCoach]);
  useEffect(()=>{setSelectedIdx(0);},[q]);

  const onKeyNav=e=>{
    if(e.key==="Escape"){onClose?onClose():(setQ(""),setOpen(false));return;}
    if(!flatItems.length)return;
    if(e.key==="ArrowDown"){e.preventDefault();setSelectedIdx(i=>(i+1)%flatItems.length);}
    else if(e.key==="ArrowUp"){e.preventDefault();setSelectedIdx(i=>(i-1+flatItems.length)%flatItems.length);}
    else if(e.key==="Enter"){e.preventDefault();go(flatItems[selectedIdx].action);}
  };
  const hlBg="rgba(147,51,234,0.25)";
  // Devuelve el índice global de un item dado su grupo y posición (para pintar el highlight).
  const idxOf=(grupo,pos)=>{
    const cap=fullscreen?8:6;
    const capE=fullscreen?8:4, capL=fullscreen?8:3, capC=fullscreen?8:3;
    const nJ=Math.min(results?.jugadoras?.length||0,cap);
    const nE=Math.min(results?.equipos?.length||0,capE);
    const nL=Math.min(results?.ligas?.length||0,capL);
    if(grupo==="j")return pos;
    if(grupo==="e")return nJ+pos;
    if(grupo==="l")return nJ+nE+pos;
    if(grupo==="c")return nJ+nE+nL+pos;
    return -1;
  };

  if(fullscreen){
    return(
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#0f172a",zIndex:500,display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"14px 16px",borderBottom:"1px solid #1e293b"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",flex:1,background:"rgba(255,255,255,0.08)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:"10px",padding:"9px 12px"}}>
            <span style={{fontSize:"14px",color:"var(--fx-muted2)"}}>🔍</span>
            <input ref={inputRef} value={q} onChange={e=>{setQ(e.target.value);setOpen(true);}}
              placeholder={t("search.placeholder_mobile")} style={{background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:"15px",width:"100%"}}
              onKeyDown={onKeyNav}/>
            {q&&<button onClick={()=>setQ("")} style={{background:"none",border:"none",color:"var(--fx-muted)",cursor:"pointer",fontSize:"16px",lineHeight:1,padding:0}}>×</button>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#fff",fontSize:"14px",fontWeight:700,cursor:"pointer",padding:"4px 8px"}}>Cancelar</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
          {results&&total>0?(<>
            {results.jugadoras.length>0&&(<>
              <div style={{padding:"10px 16px 6px",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>👩‍🏀 Jugadoras ({results.jugadoras.length})</div>
              {results.jugadoras.slice(0,8).map((p,i)=>{const sel=selectedIdx===idxOf("j",i);return(
                <div key={p.id_jugadora} onClick={()=>go(()=>onGoToPlayer(p.id_jugadora))} onMouseEnter={()=>setSelectedIdx(idxOf("j",i))} style={{padding:"12px 16px",cursor:"pointer",color:"#fff",fontSize:"15px",borderBottom:"1px solid #1e293b",background:sel?hlBg:"transparent"}}>{p.nombre}</div>
              );})}
            </>)}
            {results.equipos.length>0&&(<>
              <div style={{padding:"10px 16px 6px",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>🏟️ Equipos ({results.equipos.length})</div>
              {results.equipos.slice(0,8).map((e,i)=>{const sel=selectedIdx===idxOf("e",i);return(
                <div key={e.id_equipo} onClick={()=>go(()=>onGoToTeam(e.id_equipo))} onMouseEnter={()=>setSelectedIdx(idxOf("e",i))} style={{padding:"12px 16px",cursor:"pointer",color:"#fff",fontSize:"15px",borderBottom:"1px solid #1e293b",background:sel?hlBg:"transparent"}}>{e.nombre}</div>
              );})}
            </>)}
            {results.ligas.length>0&&(<>
              <div style={{padding:"10px 16px 6px",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>🏆 Ligas ({results.ligas.length})</div>
              {results.ligas.slice(0,8).map((l,i)=>{const sel=selectedIdx===idxOf("l",i);return(
                <div key={l.id_liga} onClick={()=>go(()=>onGoToLeague(l.id_liga))} onMouseEnter={()=>setSelectedIdx(idxOf("l",i))} style={{padding:"12px 16px",cursor:"pointer",color:"#fff",fontSize:"15px",borderBottom:"1px solid #1e293b",background:sel?hlBg:"transparent"}}>{l.nombre}</div>
              );})}
            </>)}
            {results.coaches.length>0&&(<>
              <div style={{padding:"10px 16px 6px",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>📋 Cuerpo técnico ({results.coaches.length})</div>
              {results.coaches.slice(0,8).map((c,i)=>{const sel=selectedIdx===idxOf("c",i);return(
                <div key={c.id_coach} onClick={()=>go(()=>onGoToCoach(c.id_coach))} onMouseEnter={()=>setSelectedIdx(idxOf("c",i))} style={{padding:"12px 16px",cursor:"pointer",color:"#fff",fontSize:"15px",borderBottom:"1px solid #1e293b",background:sel?hlBg:"transparent"}}>{c.nombre}</div>
              );})}
            </>)}
          </>):q.length>=2?(
            <div style={{textAlign:"center",padding:"40px 20px",color:"var(--fx-muted)",fontSize:"14px"}}>{t("search.empty")}</div>
          ):(
            <div style={{textAlign:"center",padding:"40px 20px",color:"var(--fx-muted)",fontSize:"14px"}}>{t("search.hint_2chars")}</div>
          )}
        </div>
      </div>
    );
  }

  return(
    <div ref={ref} style={{position:"relative",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:"6px",background:"rgba(255,255,255,0.08)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:"10px",padding:"5px 10px"}}>
        <span style={{fontSize:"13px",color:"var(--fx-muted2)"}}>🔍</span>
        <input value={q} onChange={e=>{setQ(e.target.value);setOpen(true);}} onFocus={()=>q.length>=2&&setOpen(true)}
          placeholder={t("search.placeholder_desktop")} style={{background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:"13px",width:"160px"}}
          onKeyDown={onKeyNav}/>
        {q&&<button onClick={()=>{setQ("");setOpen(false);}} style={{background:"none",border:"none",color:"var(--fx-muted)",cursor:"pointer",fontSize:"14px",lineHeight:1,padding:0}}>×</button>}
      </div>
      {open&&results&&total>0&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:200,background:"#1e293b",border:"1px solid #334155",borderRadius:"14px",boxShadow:"0 12px 40px rgba(0,0,0,0.5)",width:"340px",maxHeight:"480px",overflowY:"auto"}}>
          {results.jugadoras.length>0&&(<>
            <div style={{padding:"10px 14px 6px",fontSize:"10px",color:"var(--fx-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>👩‍🏀 Jugadoras ({results.jugadoras.length})</div>
            {results.jugadoras.slice(0,6).map(p=>(
              <div key={p.id_jugadora} onClick={()=>go(()=>onGoToPlayer(p.id_jugadora))}
                style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 14px",cursor:"pointer",transition:"background 0.1s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <Avatar photo={p.foto} name={p.nombre} size={32} fontSize={12} fallecida={!!p.fecha_fallecimiento}/>
                <div><div style={{fontSize:"13px",color:"#f1f5f9",fontWeight:600}}>{p.nombre}</div>
                <div style={{fontSize:"11px",color:"var(--fx-muted)"}}>{p.posicion}{p.posicion2?` · ${p.posicion2}`:""}</div></div>
              </div>
            ))}
          </>)}
          {results.equipos.length>0&&(<>
            <div style={{padding:"10px 14px 6px",fontSize:"10px",color:"var(--fx-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",borderTop:"1px solid #1e293b"}}>🏟️ Equipos ({results.equipos.length})</div>
            {results.equipos.slice(0,4).map(e=>(
              <div key={e.id_equipo} onClick={()=>go(()=>onGoToTeam(e.id_equipo))}
                style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 14px",cursor:"pointer"}}
                onMouseEnter={ev=>ev.currentTarget.style.background="rgba(255,255,255,0.06)"}
                onMouseLeave={ev=>ev.currentTarget.style.background="transparent"}>
                <TeamBadge team={e} size={28}/>
                <div><div style={{fontSize:"13px",color:"#f1f5f9",fontWeight:600}}>{e.nombre}</div>
                <div style={{fontSize:"11px",color:"var(--fx-muted)"}}>{e.ciudad||""}{e.pais?` · ${e.pais}`:""}</div></div>
              </div>
            ))}
          </>)}
          {results.ligas.length>0&&(<>
            <div style={{padding:"10px 14px 6px",fontSize:"10px",color:"var(--fx-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",borderTop:"1px solid #1e293b"}}>🏆 Ligas ({results.ligas.length})</div>
            {results.ligas.slice(0,4).map(l=>(
              <div key={l.id_liga} onClick={()=>go(()=>onGoToLeague(l.id_liga))}
                style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 14px",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <LeagueBadge liga={l} size={28}/>
                <div><div style={{fontSize:"13px",color:"#f1f5f9",fontWeight:600}}>{l.nombre}</div>
                <div style={{fontSize:"11px",color:"var(--fx-muted)"}}>{l.pais||""}</div></div>
              </div>
            ))}
          </>)}
          {results.coaches.length>0&&(<>
            <div style={{padding:"10px 14px 6px",fontSize:"10px",color:"var(--fx-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",borderTop:"1px solid #1e293b"}}>📋 Cuerpo Técnico ({results.coaches.length})</div>
            {results.coaches.slice(0,4).map(c=>(
              <div key={c.id_coach} onClick={()=>go(()=>onGoToCoach(c.id_coach))}
                style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 14px",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <Avatar photo={c.foto} name={c.nombre} size={32} fontSize={12}/>
                <div><div style={{fontSize:"13px",color:"#f1f5f9",fontWeight:600}}>{c.nombre}</div>
                <div style={{fontSize:"11px",color:"var(--fx-muted)"}}>{c.nacionalidad||""}</div></div>
              </div>
            ))}
          </>)}
          {total===0&&q.length>=2&&<div style={{padding:"16px 14px",fontSize:"13px",color:"var(--fx-muted)",textAlign:"center"}}>{t("search.empty_q",{q})}</div>}
        </div>
      )}
      {open&&results&&total===0&&q.length>=2&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:200,background:"#1e293b",border:"1px solid #334155",borderRadius:"14px",padding:"16px 14px",width:"280px",fontSize:"13px",color:"var(--fx-muted)",textAlign:"center"}}>
          {t("search.empty_q",{q})}
        </div>
      )}
    </div>
  );
}

/* ── HomeView ───────────────────────────────────────────── */
function HomeView({players,equipos,ligas,palmares,coaches,tempCoach,onGoToPlayer,onGoToTeam,onGoToTab,equiposNombres,user,favoritos,partidos,isFavFn,onToggleFav,onGoToLeague,onGoToPartido}){
  const t = useT();
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
  const favJugs=user?(favoritos||[]).filter(f=>f.tipo==="jugadora").map(f=>players.find(p=>p.id_jugadora===f.id_referencia)).filter(Boolean).slice(0,12):[];
  const favEqs=user?(favoritos||[]).filter(f=>f.tipo==="equipo").map(f=>equipos.find(e=>e.id_equipo===f.id_referencia)).filter(Boolean).slice(0,12):[];
  const favLgs=user?(favoritos||[]).filter(f=>f.tipo==="liga").map(f=>ligas.find(l=>l.id_liga===f.id_referencia)).filter(Boolean).slice(0,8):[];
  const hayFavs=favJugs.length+favEqs.length+favLgs.length>0;
  return(
    <div className="bfdb-container" style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      {hayFavs&&(
        <div style={{background:"var(--fx-card)",borderRadius:"14px",padding:"14px 16px",marginBottom:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"}}>
            <div style={{fontWeight:800,fontSize:"14px",color:"var(--fx-text)"}}>{t("home.favoritos")}</div>
            <button onClick={()=>onGoToTab&&onGoToTab("favoritos")} style={{background:"transparent",border:"none",color:"#9333ea",fontSize:"12px",fontWeight:700,cursor:"pointer"}}>{t("home.ver_todos")}</button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
            {(()=>{
              const box={width:52,height:52,borderRadius:"12px",background:"var(--fx-hover)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0};
              const item={display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",width:"64px",gap:"5px"};
              const label={fontSize:"10px",color:"var(--fx-muted)",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%",lineHeight:1.2};
              const imgSt={maxWidth:"88%",maxHeight:"88%",objectFit:"contain"};
              return(<>
                {favJugs.map(p=>(
                  <div key={"j"+p.id_jugadora} onClick={()=>onGoToPlayer(p.id_jugadora)} title={p.nombre} style={item}>
                    <div style={box}>
                      {p.foto
                        ?<img loading="lazy" decoding="async" src={p.foto} alt="" style={{width:"100%",height:"100%",objectFit:"cover",filter:p.fecha_fallecimiento?"grayscale(60%)":"none"}}/>
                        :<span style={{fontSize:"20px",fontWeight:800,color:"var(--fx-brand)"}}>{(p.nombre||"?")[0]?.toUpperCase()}</span>}
                    </div>
                    <span style={label}>{p.nombre.split(" ").slice(-1)[0]}</span>
                  </div>
                ))}
                {favEqs.map(e=>(
                  <div key={"e"+e.id_equipo} onClick={()=>onGoToTeam(e.id_equipo)} title={e.nombre} style={item}>
                    <div style={box}>
                      {e.escudo?<img loading="lazy" decoding="async" src={e.escudo} alt="" style={imgSt}/>:<span style={{fontSize:"18px"}}>🏟️</span>}
                    </div>
                    <span style={label}>{e.nombre}</span>
                  </div>
                ))}
                {favLgs.map(l=>(
                  <div key={"l"+l.id_liga} onClick={()=>onGoToLeague&&onGoToLeague(l.id_liga)} title={l.nombre} style={item}>
                    <div style={box}>
                      {l.logo?<img loading="lazy" decoding="async" src={l.logo} alt="" style={imgSt}/>:<span style={{fontSize:"18px"}}>🏆</span>}
                    </div>
                    <span style={label}>{l.nombre}</span>
                  </div>
                ))}
              </>);
            })()}
          </div>
        </div>
      )}
      <div style={{marginBottom:"16px"}}>
        <h2 style={{fontWeight:800,fontSize:"20px",color:"var(--fx-text)",margin:"0 0 4px",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
          {t("home.mercado")}
          {filterLiga!=="ALL"&&(()=>{const ligaSel=ligaMap[filterLiga];return ligaSel?<span style={{fontWeight:800,fontSize:"20px",color:"var(--fx-text)",display:"flex",alignItems:"center",gap:"6px"}}>{t("home.de_liga",{liga:ligaSel.nombre})}{ligaSel.escudo&&<img loading="lazy" decoding="async" src={ligaSel.escudo} alt={ligaSel.nombre} style={{width:"22px",height:"22px",objectFit:"contain",borderRadius:"4px"}}/>}</span>:null;})()}
        </h2>
        <p style={{fontSize:"13px",color:"var(--fx-muted)",margin:"0 0 12px"}}>{t(fichajesFiltrados.length===1?"home.temporada_mov":"home.temporada_movs",{temp:currentSeason,n:fichajesFiltrados.length})}</p>
        {ligasEnFichajes.length>1&&<select value={filterLiga} onChange={e=>{setFilterLiga(e.target.value);setFilterEquipo("ALL");setVisibleCount(10);}} style={{border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"7px 12px",fontSize:"13px",color:"var(--fx-label)",background:"var(--fx-card)",outline:"none",width:"100%",maxWidth:"320px"}}>
          <option value="ALL">{t("home.todas_ligas")}</option>
          {ligasEnFichajes.map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
        </select>}
        {equiposEnFichajes.length>1&&<select value={filterEquipo} onChange={e=>{setFilterEquipo(e.target.value);setVisibleCount(10);}} style={{border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"7px 12px",fontSize:"13px",color:"var(--fx-label)",background:"var(--fx-card)",outline:"none",width:"100%",maxWidth:"320px",marginTop:"8px"}}>
          <option value="ALL">{t("home.todos_equipos")}</option>
          {equiposEnFichajes.map(e=><option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>)}
        </select>}
      </div>
      {fichajesFiltrados.length===0?(
        <div style={{textAlign:"center",padding:"60px 0",color:"var(--fx-muted)"}}>
          <div style={{fontSize:"48px",marginBottom:"12px"}}>📋</div>
          <p style={{fontSize:"15px"}}>{fichajes.length===0?t("home.sin_fichajes_temp",{temp:currentSeason}):t("home.sin_fichajes_liga")}</p>
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
                  style={{background:"var(--fx-card)",borderRadius:"16px",padding:"16px 12px",boxShadow:"var(--fx-shadow)",display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",cursor:"pointer",transition:"all 0.15s",textAlign:"center"}}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow="var(--fx-shadow-hover)";e.currentTarget.style.transform="translateY(-2px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="var(--fx-shadow)";e.currentTarget.style.transform="translateY(0)";}}>
                  <Avatar photo={s.player.foto} name={s.player.nombre} size={72} fontSize={24} fallecida={!!s.player.fecha_fallecimiento}/>
                  <div style={{fontWeight:700,fontSize:"13px",color:"var(--fx-text)",lineHeight:1.3,width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.player.nombre}</div>
                  <div style={{fontSize:"20px",lineHeight:1}}>✍️</div>
                  <div style={{display:"flex",alignItems:"center",gap:"6px",background:"var(--fx-pill)",borderRadius:"10px",padding:"6px 10px",width:"100%",justifyContent:"center",boxSizing:"border-box"}}>
                    <TeamBadge team={eq} size={24}/>
                    <span style={{fontSize:"11px",fontWeight:700,color:"var(--fx-brand)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"80px"}}>{resolveTeamName(s.id_equipo,s.temporada,equiposNombres,equipoMap)||eq?.nombre}</span>
                  </div>
                  {liga&&<div style={{fontSize:"10px",color:"var(--fx-muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"}}>{liga.nombre}</div>}
                </div>
              );
            })}
          </div>
          {visibleCount<fichajesFiltrados.length&&(
            <div style={{textAlign:"center"}}>
              <button onClick={()=>setVisibleCount(c=>c+10)}
                style={{background:"var(--fx-card)",border:"1.5px solid var(--fx-border)",borderRadius:"12px",padding:"10px 28px",fontWeight:700,fontSize:"13px",color:"var(--fx-label)",cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--fx-brand)";e.currentTarget.style.color="var(--fx-brand)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--fx-border)";e.currentTarget.style.color="var(--fx-label)";}}>
                {t("home.ver_mas",{n:fichajesFiltrados.length-visibleCount})}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FavoritosView({players,equipos,ligas,partidos,favoritos,user,onGoToPlayer,onGoToTeam,onGoToLeague,onGoToPartido,isFavFn,onToggleFav}){
  const t = useT();
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
      <div style={{background:"var(--fx-card)",borderRadius:"16px",padding:"40px 24px",border:"1px solid var(--fx-border)",textAlign:"center"}}>
        <div style={{fontSize:"48px",marginBottom:"12px"}}>⭐</div>
        <div style={{fontWeight:800,fontSize:"18px",color:"var(--fx-text)",marginBottom:"8px"}}>{t("favs.empty_title")}</div>
        <div style={{fontSize:"14px",color:"var(--fx-muted2)",maxWidth:"400px",margin:"0 auto"}}>{t("favs.empty_desc")}</div>
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

  const esAmistoso=p=>/amistosos?/i.test(ligaMap[p.id_liga]?.nombre||"");
  // ── Datos de equipos ──
  const eqCards=favEquipos.map(eid=>{
    const eq=equipoMap[eid];if(!eq)return null;
    const comps=[...new Set((partidos||[]).filter(p=>(p.id_equipo_local===eid||p.id_equipo_visitante===eid)&&p.temporada===currentSeason).map(p=>p.id_liga))].map(lid=>ligaMap[lid]).filter(l=>l&&!/amistosos?/i.test(l.nombre||""));
    const ults=(partidos||[]).filter(p=>(p.id_equipo_local===eid||p.id_equipo_visitante===eid)&&p.resultado_local!=null).sort((a,b)=>new Date(b.fecha_hora)-new Date(a.fecha_hora));
    const proxs=(partidos||[]).filter(p=>(p.id_equipo_local===eid||p.id_equipo_visitante===eid)&&p.resultado_local==null&&p.fecha_hora&&new Date(p.fecha_hora)>hoy).sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora));
    const ultPartido=ults.find(p=>!esAmistoso(p))||ults[0];
    const proxPartido=proxs.find(p=>!esAmistoso(p))||proxs[0];
    // Las selecciones no tienen "fichajes" (son convocatorias), no aplica.
    const ultFichaje=eq.tipo==="seleccion"?null:players.flatMap(pl=>(pl.seasons||[]).filter(ss=>ss.id_equipo===eid).map(ss=>({player:pl,...ss}))).sort((a,b)=>{
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

  const fmtDay=iso=>{if(!iso)return "";const d=new Date(iso);return d.toLocaleDateString(locale(),{day:"numeric",month:"short"}).replace(".","");};
  const MiniPartido=({p,hideMeta,highlightEq})=>{
    const tL=equipoMap[p.id_equipo_local]||{},tV=equipoMap[p.id_equipo_visitante]||{};
    const played=p.resultado_local!=null;
    const d=p.fecha_hora?new Date(p.fecha_hora):null;
    const winL=played&&Number(p.resultado_local)>Number(p.resultado_visitante);
    const winV=played&&Number(p.resultado_visitante)>Number(p.resultado_local);
    const boldL=highlightEq?p.id_equipo_local===highlightEq:winL;
    const boldV=highlightEq?p.id_equipo_visitante===highlightEq:winV;
    const nameStyle=bold=>({fontSize:"11px",fontWeight:bold?700:500,color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"});
    const flag=url=>url?<img loading="lazy" decoding="async" src={url} alt="" style={{width:18,height:18,objectFit:"contain",flexShrink:0}}/>:<span style={{width:18,textAlign:"center",flexShrink:0}}>•</span>;
    const center=hideMeta?"":(played?`${p.resultado_local}-${p.resultado_visitante}`:d?fmtDay(d):"—");
    return(
      <div onClick={()=>onGoToPartido(p)} style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:"6px",padding:"4px 2px",cursor:"pointer"}} title={`${tL.nombre||"?"} vs ${tV.nombre||"?"}`}>
        <div style={{display:"flex",alignItems:"center",gap:"5px",minWidth:0,justifyContent:"flex-end"}}>
          <span style={nameStyle(boldL)}>{tL.nombre||"—"}</span>
          {flag(tL.escudo)}
        </div>
        <span style={{fontWeight:700,color:"#7c3aed",fontSize:"12px",whiteSpace:"nowrap",padding:"0 4px",minWidth:"36px",textAlign:"center"}}>{center}</span>
        <div style={{display:"flex",alignItems:"center",gap:"5px",minWidth:0}}>
          {flag(tV.escudo)}
          <span style={nameStyle(boldV)}>{tV.nombre||"—"}</span>
        </div>
      </div>
    );
  };

  return(
    <div className="bfdb-container" style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      {/* Filtros */}
      <div style={{display:"flex",gap:"8px",marginBottom:"20px",flexWrap:"wrap"}}>
        {[["todo","⭐ "+t("favs.filter.all")],["jugadora","👩‍🏀 "+t("favs.jugadoras")],["equipo","🏟️ "+t("favs.equipos")],["liga","🏆 "+t("favs.ligas")]].map(([k,label])=>(
          <button key={k} onClick={()=>setFiltro(k)} style={{background:filtro===k?"#9333ea":"#fff",color:filtro===k?"#fff":"#475569",border:filtro===k?"none":"1.5px solid var(--fx-border)",borderRadius:"20px",padding:"8px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
        ))}
      </div>

      {/* ── JUGADORAS ── */}
      {(filtro==="todo"||filtro==="jugadora")&&jugCards.map(({player:p,lastBox,rivalEq,partido})=>{
        const liga=partido?ligaMap[partido.id_liga]:null;
        const propioLocal=partido&&lastBox&&partido.id_equipo_local===lastBox.id_equipo;
        const [propioSc,rivalSc]=partido?(propioLocal?[partido.resultado_local,partido.resultado_visitante]:[partido.resultado_visitante,partido.resultado_local]):[null,null];
        const gano=propioSc!=null&&rivalSc!=null&&Number(propioSc)>Number(rivalSc);
        const icono=propioSc==null?"":(gano?"🟢":"🔴");
        return(
        <div key={p.id_jugadora} style={{background:"var(--fx-card)",borderRadius:"16px",padding:"16px",border:"1px solid var(--fx-border)",marginBottom:"16px"}}>
          <div onClick={()=>onGoToPlayer(p.id_jugadora)} style={{display:"flex",alignItems:"center",gap:"14px",cursor:"pointer",marginBottom:lastBox?"12px":"0"}}>
            <Avatar photo={p.foto} name={p.nombre} size={52} fontSize={18}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:"16px",color:"var(--fx-text)"}}>{p.nombre}</div>
              {rivalEq&&<div style={{fontSize:"12px",color:"var(--fx-muted)",fontWeight:600,marginTop:"2px",display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                {icono&&<span>{icono}</span>}
                {propioSc!=null&&<span style={{color:"var(--fx-text)",fontWeight:800}}>{propioSc}-{rivalSc}</span>}
                <span>{t("favs.vs_rival",{rival:rivalEq.nombre})}</span>
                {liga&&<span style={{color:"var(--fx-muted2)"}}>· {liga.nombre}</span>}
                {partido?.fecha_hora&&<span style={{color:"var(--fx-muted2)"}}>· {fmtDay(partido.fecha_hora)}</span>}
              </div>}
            </div>
          </div>
          {lastBox&&<div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            {[["PTS",lastBox.puntos],["REB",lastBox.reb_totales],["AST",lastBox.asistencias],["ROB",lastBox.robos],["MIN",lastBox.minutos],["VAL",lastBox.valoracion]].map(([k,v])=>(
              <div key={k} style={{background:"var(--fx-hover)",borderRadius:"10px",padding:"8px 12px",textAlign:"center",flex:"1 0 48px"}}>
                <div style={{fontSize:"16px",fontWeight:800,color:"#7c3aed"}}>{v||0}</div>
                <div style={{fontSize:"10px",fontWeight:700,color:"var(--fx-muted2)"}}>{k}</div>
              </div>
            ))}
          </div>}
        </div>
        );})}

      {/* ── EQUIPOS ── */}
      {(filtro==="todo"||filtro==="equipo")&&eqCards.map(({eq,comps,ultPartido,proxPartido,ultFichaje})=>(
        <div key={eq.id_equipo} style={{background:"var(--fx-card)",borderRadius:"16px",padding:"16px",border:"1px solid var(--fx-border)",marginBottom:"16px"}}>
          <div onClick={()=>onGoToTeam(eq.id_equipo)} style={{display:"flex",alignItems:"center",gap:"12px",cursor:"pointer",marginBottom:"12px"}}>
            {eq.escudo?<img loading="lazy" decoding="async" src={eq.escudo} alt="" style={{width:44,height:44,objectFit:"contain"}}/>:<div style={{width:44,height:44,borderRadius:"10px",background:"var(--fx-hover)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px"}}>🏟️</div>}
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:"16px",color:"var(--fx-text)"}}>{eq.nombre}</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"4px"}}>
                {comps.map(l=><span key={l.id_liga} onClick={e=>{e.stopPropagation();onGoToLeague(l.id_liga);}} style={{fontSize:"10px",fontWeight:700,color:"#9333ea",background:"var(--fx-lila-bg)",padding:"2px 8px",borderRadius:"10px",cursor:"pointer"}}>{l.nombre}</span>)}
              </div>
            </div>
          </div>
          {(ultPartido||proxPartido)&&<div style={{display:"grid",gridTemplateColumns:ultPartido&&proxPartido?"1fr 1fr":"1fr",gap:"12px",marginBottom:ultFichaje?"12px":"0"}}>
            {ultPartido&&<div>
              <div style={{fontSize:"11px",fontWeight:700,color:"var(--fx-muted2)",marginBottom:"6px"}}>{t("favs.last_game")} · {fmtDay(ultPartido.fecha_hora)}</div>
              <div style={{fontSize:"10px",color:"#9333ea",fontWeight:600,marginBottom:"2px"}}>{ligaMap[ultPartido.id_liga]?.nombre||""}</div>
              <MiniPartido p={ultPartido} highlightEq={eq.id_equipo}/>
            </div>}
            {proxPartido&&<div>
              <div style={{fontSize:"11px",fontWeight:700,color:"var(--fx-muted2)",marginBottom:"6px"}}>{t("favs.next_game")} · {fmtDay(proxPartido.fecha_hora)}</div>
              <div style={{fontSize:"10px",color:"#9333ea",fontWeight:600,marginBottom:"2px"}}>{ligaMap[proxPartido.id_liga]?.nombre||""}</div>
              <MiniPartido p={proxPartido} hideMeta highlightEq={eq.id_equipo}/>
            </div>}
          </div>}
          {ultFichaje&&<div style={{borderTop:"1px solid var(--fx-border2)",paddingTop:"10px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:"var(--fx-muted2)",marginBottom:"4px"}}>{t("favs.last_signing")}</div>
            <div onClick={()=>onGoToPlayer(ultFichaje.id_jugadora)} style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer"}}>
              <Avatar photo={ultFichaje.player?.foto} name={ultFichaje.player?.nombre} size={28} fontSize={11}/>
              <span style={{fontSize:"13px",fontWeight:700,color:"var(--fx-text)"}}>{ultFichaje.player?.nombre}</span>
            </div>
          </div>}
        </div>
      ))}

      {/* ── LIGAS ── */}
      {(filtro==="todo"||filtro==="liga")&&ligaCards.map(({liga,ultJornada,proxJornada,clasi})=>(
        <div key={liga.id_liga} style={{background:"var(--fx-card)",borderRadius:"16px",padding:"16px",border:"1px solid var(--fx-border)",marginBottom:"16px"}}>
          <div onClick={()=>onGoToLeague(liga.id_liga)} style={{fontWeight:800,fontSize:"16px",color:"var(--fx-text)",cursor:"pointer",marginBottom:"12px"}}>{liga.nombre}</div>
          {(ultJornada.length>0||proxJornada.length>0)&&<div style={{display:"grid",gridTemplateColumns:ultJornada.length&&proxJornada.length?"1fr 1fr":"1fr",gap:"12px",marginBottom:"12px"}}>
            {ultJornada.length>0&&<div>
              <div style={{fontSize:"11px",fontWeight:700,color:"var(--fx-muted2)",marginBottom:"6px"}}>{t("favs.last_matchday")} · {fmtDay(ultJornada[0].fecha_hora)}</div>
              {ultJornada.slice(0,7).map(p=><MiniPartido key={p.id} p={p}/>)}
            </div>}
            {proxJornada.length>0&&<div>
              <div style={{fontSize:"11px",fontWeight:700,color:"var(--fx-muted2)",marginBottom:"6px"}}>{t("favs.next_matchday")} · {fmtDay(proxJornada[0].fecha_hora)}</div>
              {proxJornada.slice(0,7).map(p=><MiniPartido key={p.id} p={p} hideMeta/>)}
            </div>}
          </div>}
          {clasi.length>0&&<div>
            <div style={{fontSize:"11px",fontWeight:700,color:"var(--fx-muted2)",marginBottom:"6px"}}>{t("favs.classification")}</div>
            <div style={{display:"flex",flexDirection:"column",gap:"2px"}}>
              {clasi.slice(0,16).map((r,i)=>{const eq=equipoMap[r.id];return(
                <div key={r.id} style={{display:"flex",alignItems:"center",gap:"6px",padding:"3px 4px",fontSize:"11px"}}>
                  <span style={{width:"16px",fontWeight:700,color:"var(--fx-muted2)",textAlign:"right"}}>{i+1}</span>
                  {eq?.escudo?<img loading="lazy" decoding="async" src={eq.escudo} alt="" title={eq.nombre} style={{width:16,height:16,objectFit:"contain"}}/>:<span style={{width:16,textAlign:"center",fontSize:"8px"}}>•</span>}
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

/* ── LoginModal ─────────────────────────────────────────── */
function LoginModal({onLogin,onGoogleLogin,onForgot,onClose,loading,error,info,mode,setMode}){
  const t = useT();
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const isReg=mode==="register";
  const isForgot=mode==="forgot";
  const submit=()=>{ if(isForgot) onForgot(email); else onLogin(email,pass); };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#1e293b",borderRadius:"20px",padding:"32px",width:"340px",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
        <div style={{textAlign:"center",marginBottom:"24px"}}>
          <div style={{fontSize:"32px",marginBottom:"8px"}}>🏀</div>
          <div style={{fontWeight:800,fontSize:"18px",color:"#f1f5f9"}}>{isForgot?t("auth.title.forgot"):isReg?t("auth.title.register"):t("auth.title.login")}</div>
          <div style={{fontSize:"12px",color:"var(--fx-muted2)",marginTop:"4px"}}>{isForgot?t("auth.sub.forgot"):t("auth.sub.login")}</div>
        </div>
        {!isForgot&&<>
          <button onClick={onGoogleLogin}
            style={{width:"100%",background:"var(--fx-card)",color:"var(--fx-text)",border:"none",borderRadius:"10px",padding:"11px",fontWeight:700,fontSize:"14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",marginBottom:"16px"}}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            {t("auth.google")}
          </button>
          <div style={{display:"flex",alignItems:"center",gap:"12px",margin:"16px 0"}}>
            <div style={{flex:1,height:"1px",background:"#334155"}}/><span style={{color:"var(--fx-muted)",fontSize:"12px"}}>{t("auth.or")}</span><div style={{flex:1,height:"1px",background:"#334155"}}/>
          </div>
        </>}
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <input type="email" placeholder={t("auth.email")} value={email} onChange={e=>setEmail(e.target.value)}
            style={{background:"#0f172a",border:"1.5px solid #334155",borderRadius:"10px",padding:"10px 14px",fontSize:"14px",color:"#f1f5f9",outline:"none"}}
            onKeyDown={e=>e.key==="Enter"&&submit()}/>
          {!isForgot&&<input type="password" placeholder={t("auth.password")} value={pass} onChange={e=>setPass(e.target.value)}
            style={{background:"#0f172a",border:"1.5px solid #334155",borderRadius:"10px",padding:"10px 14px",fontSize:"14px",color:"#f1f5f9",outline:"none"}}
            onKeyDown={e=>e.key==="Enter"&&submit()}/>}
          {error&&<div style={{color:"#f87171",fontSize:"12px",textAlign:"center"}}>{error}</div>}
          {info&&<div style={{color:"#4ade80",fontSize:"12px",textAlign:"center"}}>{info}</div>}
          <button onClick={submit} disabled={loading}
            style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",fontWeight:700,fontSize:"14px",cursor:"pointer"}}>
            {loading?"...":(isForgot?t("auth.send_email"):isReg?t("auth.register"):t("auth.enter"))}
          </button>
        </div>
        {!isReg&&!isForgot&&<div style={{textAlign:"center",marginTop:"12px",fontSize:"12px"}}>
          <span onClick={()=>setMode("forgot")} style={{color:"#a78bfa",cursor:"pointer",fontWeight:600}}>{t("auth.forgot")}</span>
        </div>}
        <div style={{textAlign:"center",marginTop:"16px",fontSize:"12px",color:"var(--fx-muted2)"}}>
          {isForgot?<span onClick={()=>setMode("login")} style={{color:"#a78bfa",cursor:"pointer",fontWeight:700}}>{t("common.back")}</span>:
           isReg?<>{t("auth.have_account")} <span onClick={()=>setMode("login")} style={{color:"#a78bfa",cursor:"pointer",fontWeight:700}}>{t("auth.have_account_login")}</span></>:
                 <>{t("auth.no_account")} <span onClick={()=>setMode("register")} style={{color:"#a78bfa",cursor:"pointer",fontWeight:700}}>{t("auth.register_link")}</span></>}
        </div>
        <div style={{textAlign:"center",marginTop:"12px"}}><a href="/privacidad" target="_blank" style={{fontSize:"11px",color:"var(--fx-muted)",textDecoration:"none"}}>{t("auth.privacy")}</a></div>
      </div>
    </div>
  );
}

/* ── ResetPasswordModal ────────────────────────────────── */
function ResetPasswordModal({onSave,onCancel,loading,error,info}){
  const t = useT();
  const [pass,setPass]=useState("");
  const [pass2,setPass2]=useState("");
  const submit=()=>{
    if(pass.length<6){alert(t("auth.min_chars"));return;}
    if(pass!==pass2){alert(t("auth.pass_no_match"));return;}
    onSave(pass);
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#1e293b",borderRadius:"20px",padding:"32px",width:"340px",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
        <div style={{textAlign:"center",marginBottom:"24px"}}>
          <div style={{fontSize:"32px",marginBottom:"8px"}}>🔑</div>
          <div style={{fontWeight:800,fontSize:"18px",color:"#f1f5f9"}}>{t("auth.new_password")}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <input type="password" placeholder={t("auth.new_password")} value={pass} onChange={e=>setPass(e.target.value)}
            style={{background:"#0f172a",border:"1.5px solid #334155",borderRadius:"10px",padding:"10px 14px",fontSize:"14px",color:"#f1f5f9",outline:"none"}}/>
          <input type="password" placeholder={t("auth.repeat_password")} value={pass2} onChange={e=>setPass2(e.target.value)}
            style={{background:"#0f172a",border:"1.5px solid #334155",borderRadius:"10px",padding:"10px 14px",fontSize:"14px",color:"#f1f5f9",outline:"none"}}
            onKeyDown={e=>e.key==="Enter"&&submit()}/>
          {error&&<div style={{color:"#f87171",fontSize:"12px",textAlign:"center"}}>{error}</div>}
          {info&&<div style={{color:"#4ade80",fontSize:"12px",textAlign:"center"}}>{info}</div>}
          <button onClick={submit} disabled={loading}
            style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",fontWeight:700,fontSize:"14px",cursor:"pointer"}}>
            {loading?t("quiniela.saving"):t("auth.save_pass")}
          </button>
          <button onClick={onCancel} style={{background:"transparent",color:"var(--fx-muted2)",border:"none",fontSize:"12px",cursor:"pointer"}}>{t("common.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

/* ── PerfilView (vista dedicada de perfil) ───────────────── */
function PerfilView({user,favoritos,onClose,onLogout}){
  const t = useT();
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
    if(error){setAvatarMsg(t("common.error"));return;}
    setAvatar(val);setAvatarMsg(t("profile.avatar_ok"));setTimeout(()=>setAvatarMsg(""),1500);
  };

  const subirFoto=async(e)=>{
    const f=e.target.files?.[0];e.target.value="";
    if(!f) return;
    if(!f.type.startsWith("image/")){setAvatarMsg(t("profile.err_no_img"));return;}
    if(f.size>2*1024*1024){setAvatarMsg(t("profile.err_size"));return;}
    setUploading(true);
    const ext=(f.name.split(".").pop()||"png").toLowerCase();
    const path=`${user.id}/avatar_${Date.now()}.${ext}`;
    const {error:upErr}=await supabase.storage.from("avatars").upload(path,f,{cacheControl:"3600",upsert:false});
    if(upErr){setUploading(false);setAvatarMsg(t("profile.err_upload")+": "+upErr.message);return;}
    const {data:{publicUrl}}=supabase.storage.from("avatars").getPublicUrl(path);
    await saveAvatar(publicUrl);
    setUploading(false);
  };

  const guardarAlias=async()=>{
    setSavingAlias(true);
    const v=(alias||"").trim().slice(0,24);
    const {error}=await supabase.from("perfiles").update({alias:v||null}).eq("id",user.id);
    setSavingAlias(false);
    setAliasMsg(error?t("common.error"):t("profile.saved"));setTimeout(()=>setAliasMsg(""),1500);
  };

  const eliminarCuenta=async()=>{
    setDeleting(true);setDeleteErr("");
    try{
      const j=await callFn("eliminar-mi-cuenta",{});
      if(!j?.ok){setDeleteErr(j?.error||"Error al eliminar");setDeleting(false);return;}
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
        <h2 style={{margin:0,fontSize:"20px",fontWeight:800,color:"var(--fx-text)"}}>👤 {t("profile.title")}</h2>
        <button onClick={onClose} aria-label={t("common.close")} title={t("common.close")} style={{background:"transparent",border:"none",fontSize:"20px",cursor:"pointer",color:"var(--fx-muted)"}}>✕</button>
      </div>

      {/* cabecera con avatar */}
      <div style={{background:"var(--fx-card)",borderRadius:"16px",padding:"18px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",marginBottom:"14px",display:"flex",gap:"14px",alignItems:"center"}}>
        <UserAvatar avatar={avatar} googleUrl={user.user_metadata?.avatar_url} nombre={nombreReal} size={64}/>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:"16px",fontWeight:800,color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nombreReal}</div>
          <div style={{fontSize:"12px",color:"var(--fx-muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
        </div>
      </div>

      {/* selector de avatar */}
      <div style={{background:"var(--fx-card)",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",marginBottom:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:700,color:"var(--fx-muted)",marginBottom:"10px"}}>{t("profile.your_avatar")}</div>
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
            {uploading?t("profile.uploading"):t("profile.upload")}
            <input type="file" accept="image/*" onChange={subirFoto} disabled={uploading} style={{display:"none"}}/>
          </label>
          {(avatar||user.user_metadata?.avatar_url)&&(
            <button onClick={()=>saveAvatar(null)}
              style={{background:"var(--fx-card)",color:"var(--fx-muted)",border:"1px solid var(--fx-border)",borderRadius:"8px",padding:"7px 12px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
              {t("profile.use_google")}
            </button>
          )}
        </div>
        {avatarMsg&&<div style={{fontSize:"11px",color:/error|not|max|máx/i.test(avatarMsg)?"#dc2626":"#16a34a",marginTop:"8px",fontWeight:700}}>{avatarMsg}</div>}
        <div style={{fontSize:"11px",color:"var(--fx-muted2)",marginTop:"6px"}}>{t("profile.avatar_hint")}</div>
      </div>

      {/* alias */}
      <div style={{background:"var(--fx-card)",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",marginBottom:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:700,color:"var(--fx-muted)",marginBottom:"6px"}}>{t("profile.alias_label")}</div>
        <div style={{display:"flex",gap:"8px"}}>
          <input type="text" maxLength={24} value={alias} onChange={e=>setAlias(e.target.value)}
            placeholder={nombreReal}
            style={{flex:1,padding:"8px 10px",borderRadius:"8px",border:"1px solid #cbd5e1",fontSize:"13px"}}/>
          <button onClick={guardarAlias} disabled={savingAlias}
            style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"8px",padding:"8px 14px",fontWeight:700,fontSize:"12px",cursor:"pointer",opacity:savingAlias?0.6:1}}>
            {t("profile.save")}
          </button>
        </div>
        {aliasMsg&&<div style={{fontSize:"11px",color:"#16a34a",marginTop:"6px",fontWeight:700}}>{aliasMsg}</div>}
        <div style={{fontSize:"11px",color:"var(--fx-muted2)",marginTop:"6px"}}>{t("profile.alias_hint")}</div>
      </div>

      {/* stats */}
      <div style={{background:"var(--fx-card)",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",marginBottom:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:700,color:"var(--fx-muted)",marginBottom:"10px"}}>{t("profile.activity")}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:"10px"}}>
          {[
            {n:favCount.jugadoras,l:t("profile.stat.players"),c:"#9333ea"},
            {n:favCount.equipos,l:t("profile.stat.teams"),c:"#9333ea"},
            {n:favCount.ligas,l:t("profile.stat.leagues"),c:"#9333ea"},
            {n:counts.basketneta,l:t("profile.stat.predict"),c:"#0891b2"},
            {n:counts.bola,l:t("profile.stat.ball"),c:"#0891b2"},
          ].map(s=>(
            <div key={s.l} style={{background:"var(--fx-hover)",borderRadius:"10px",padding:"10px",textAlign:"center"}}>
              <div style={{fontSize:"22px",fontWeight:800,color:s.c,lineHeight:1}}>{s.n}</div>
              <div style={{fontSize:"11px",color:"var(--fx-muted)",marginTop:"4px",fontWeight:600}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* logout */}
      <div style={{marginBottom:"14px"}}>
        <button onClick={onLogout}
          style={{width:"100%",background:"var(--fx-card)",color:"var(--fx-text)",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"12px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>
          {t("menu.logout")}
        </button>
      </div>

      {/* zona peligrosa */}
      <div style={{background:"var(--fx-red-bg)",border:"1px solid #fecaca",borderRadius:"12px",padding:"14px"}}>
        <div style={{fontSize:"12px",fontWeight:800,color:"var(--fx-red-text)",marginBottom:"6px"}}>{t("profile.danger")}</div>
        <div style={{fontSize:"12px",color:"#7f1d1d",marginBottom:"10px"}}>
          {t("profile.danger_desc")}
        </div>
        {confirmStep===0&&(
          <button onClick={()=>setConfirmStep(1)}
            style={{background:"var(--fx-card)",color:"var(--fx-red-text)",border:"1px solid #fca5a5",borderRadius:"8px",padding:"8px 14px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
            {t("profile.delete")}
          </button>
        )}
        {confirmStep===1&&(
          <div>
            <div style={{fontSize:"12px",color:"#7f1d1d",fontWeight:700,marginBottom:"8px"}}>{t("profile.confirm_step2")}</div>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={()=>{setConfirmStep(2);setConfirmText("");}}
                style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:"8px",padding:"8px 14px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
                {t("profile.continue")}
              </button>
              <button onClick={()=>setConfirmStep(0)}
                style={{background:"var(--fx-card)",color:"var(--fx-muted)",border:"1px solid var(--fx-border)",borderRadius:"8px",padding:"8px 14px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
        {confirmStep===2&&(
          <div>
            <div style={{fontSize:"12px",color:"#7f1d1d",fontWeight:700,marginBottom:"6px"}}>
              {(()=>{const raw=t("profile.type_confirm",{word:"__W__"});const[a,b]=raw.split("__W__");return<>{a}<code style={{background:"var(--fx-red-bg)",padding:"1px 6px",borderRadius:"4px"}}>ELIMINAR</code>{b}</>;})()}
            </div>
            <input type="text" value={confirmText} onChange={e=>setConfirmText(e.target.value)}
              placeholder="ELIMINAR"
              style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",borderRadius:"8px",border:"1px solid #fca5a5",fontSize:"13px",marginBottom:"8px"}}/>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={eliminarCuenta}
                disabled={confirmText!=="ELIMINAR"||deleting}
                style={{background:confirmText==="ELIMINAR"?"#dc2626":"#fca5a5",color:"#fff",border:"none",borderRadius:"8px",padding:"8px 14px",fontWeight:800,fontSize:"12px",cursor:confirmText==="ELIMINAR"?"pointer":"not-allowed",opacity:deleting?0.6:1}}>
                {deleting?t("profile.deleting"):t("profile.delete_final")}
              </button>
              <button onClick={()=>{setConfirmStep(0);setConfirmText("");}}
                disabled={deleting}
                style={{background:"var(--fx-card)",color:"var(--fx-muted)",border:"1px solid var(--fx-border)",borderRadius:"8px",padding:"8px 14px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
                {t("common.cancel")}
              </button>
            </div>
            {deleteErr&&<div style={{fontSize:"11px",color:"var(--fx-red-text)",marginTop:"6px",fontWeight:700}}>{deleteErr}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── FlagSelect (combobox con bandera + búsqueda) ────────── */
/* ── AnalyticsPanel ──────────────────────────────────────── */
function AnalyticsPanel({onClose}){
  const [dias,setDias]=useState(30);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");
  const [snapshots,setSnapshots]=useState([]);
  useEffect(()=>{
    (async()=>{
      const {data:s}=await supabase.from("visitas_snapshot_vercel").select("*").order("periodo_hasta",{ascending:false});
      setSnapshots(s||[]);
    })();
  },[]);
  useEffect(()=>{
    let cancel=false;
    (async()=>{
      setLoading(true);setErr("");
      const desde=new Date(Date.now()-dias*24*3600*1000).toISOString();
      // Traemos todas las filas de la ventana y agregamos en cliente (barato hasta ~50k filas)
      const {data:rows,error}=await supabase.from("visitas")
        .select("created_at,path,session_id,id_usuario,referrer,user_agent,pais,ciudad")
        .gte("created_at",desde)
        .order("created_at",{ascending:false})
        .limit(50000);
      if(cancel)return;
      if(error){setErr(error.message);setLoading(false);return;}
      const BOT=/bot|spider|crawler|preview|headless|lighthouse|slurp|facebookexternalhit|pingdom|uptime/i;
      const clean=(rows||[]).filter(r=>!r.user_agent||!BOT.test(r.user_agent));
      const byDay={},byPath={},byRef={},sesDay={},byPais={},byCiudad={},byDisp={},byBrow={};
      let anon=0,auth=0;
      const detectaDisp=ua=>/Mobi|Android|iPhone|iPad|iPod/i.test(ua)?"📱 Móvil":/Tablet|iPad/i.test(ua)?"🔲 Tablet":"🖥️ Desktop";
      const detectaBrow=ua=>{
        if(/Edg\//.test(ua))return"Edge";
        if(/Chrome\//.test(ua)&&!/Chromium/.test(ua))return"Chrome";
        if(/Firefox\//.test(ua))return"Firefox";
        if(/Safari\//.test(ua)&&!/Chrome\//.test(ua))return"Safari";
        if(/OPR\//.test(ua))return"Opera";
        return"Otro";
      };
      for(const r of clean){
        const d=new Date(r.created_at).toISOString().slice(0,10);
        byDay[d]=(byDay[d]||0)+1;
        byPath[r.path]=(byPath[r.path]||0)+1;
        const ref=(r.referrer||"").replace(/^https?:\/\/(www\.)?/,"").split("/")[0]||"(directo)";
        byRef[ref]=(byRef[ref]||0)+1;
        const pais=r.pais||"(?)";
        byPais[pais]=(byPais[pais]||0)+1;
        if(r.ciudad){const k=`${r.ciudad}${r.pais?" · "+r.pais:""}`;byCiudad[k]=(byCiudad[k]||0)+1;}
        if(r.user_agent){byDisp[detectaDisp(r.user_agent)]=(byDisp[detectaDisp(r.user_agent)]||0)+1;byBrow[detectaBrow(r.user_agent)]=(byBrow[detectaBrow(r.user_agent)]||0)+1;}
        if(!sesDay[d])sesDay[d]=new Set();
        sesDay[d].add(r.session_id);
        if(r.id_usuario)auth++;else anon++;
      }
      const dayKeys=[];
      for(let i=dias-1;i>=0;i--){const d=new Date(Date.now()-i*24*3600*1000).toISOString().slice(0,10);dayKeys.push(d);}
      const serieVisitas=dayKeys.map(d=>byDay[d]||0);
      const serieSesiones=dayKeys.map(d=>sesDay[d]?sesDay[d].size:0);
      // Fusion con snapshots Vercel (porcentajes → counts usando su total visitantes).
      // Solo aplica si el rango pedido es >=30 dias (suficiente para contener el snapshot).
      const snapsData=(dias>=30?(snapshots||[]):[]);
      let extraTotal=0,extraSes=0;
      const pctToCount=(pct,base)=>Math.round((pct/100)*base);
      for(const s of snapsData){
        extraTotal+=Number(s.pageviews)||0;
        extraSes+=Number(s.visitantes)||0;
        const base=Number(s.visitantes)||0;
        Object.entries(s.top_paths||{}).forEach(([k,v])=>{byPath[k]=(byPath[k]||0)+Number(v);});
        Object.entries(s.top_referrers||{}).forEach(([k,v])=>{byRef[k]=(byRef[k]||0)+Number(v);});
        Object.entries(s.top_countries||{}).forEach(([k,v])=>{byPais[k]=(byPais[k]||0)+pctToCount(Number(v),base);});
        Object.entries(s.top_devices||{}).forEach(([k,v])=>{const key=({Mobile:"📱 Móvil",Desktop:"🖥️ Desktop",Tablet:"🔲 Tablet"})[k]||k;byDisp[key]=(byDisp[key]||0)+pctToCount(Number(v),base);});
      }
      const topPaths=Object.entries(byPath).sort((a,b)=>b[1]-a[1]);
      const topRefs=Object.entries(byRef).sort((a,b)=>b[1]-a[1]);
      const paisName=(()=>{try{return new Intl.DisplayNames(["es"],{type:"region"});}catch{return null;}})();
      // Convention: key con prefijo "flag:XX|" que TablaTop reconoce y renderiza como <img>.
      const nomPais=c=>{ if(!c||c==="(?)")return "(desconocido)"; const n=paisName?paisName.of(c):null; return `flag:${c.toLowerCase()}|${n||c}`; };
      const topPais=Object.entries(byPais).sort((a,b)=>b[1]-a[1]).map(([c,n])=>[nomPais(c),n]);
      const topCiudad=Object.entries(byCiudad).sort((a,b)=>b[1]-a[1]).map(([k,n])=>{
        const m=/^(.+) · ([A-Z]{2})$/.exec(k);
        return m?[`flag:${m[2].toLowerCase()}|${m[1]}`,n]:[k,n];
      });
      const topDisp=Object.entries(byDisp).sort((a,b)=>b[1]-a[1]);
      const topBrow=Object.entries(byBrow).sort((a,b)=>b[1]-a[1]);
      const totalSes=new Set(clean.map(r=>r.session_id)).size;
      setData({total:clean.length+extraTotal,brutas:rows?.length||0,ses:totalSes+extraSes,anon,auth,dayKeys,serieVisitas,serieSesiones,topPaths,topRefs,topPais,topCiudad,topDisp,topBrow,extraTotal,extraSes});
      setLoading(false);
    })();
    return ()=>{cancel=true;};
  },[dias,snapshots]);
  const chartH=160,chartW=760,padL=40,padR=10,padT=10,padB=22;
  const plotW=chartW-padL-padR,plotH=chartH-padT-padB;
  const maxRaw=data?Math.max(1,...data.serieVisitas,...data.serieSesiones):1;
  // Redondea el max hacia arriba a un múltiplo "bonito" (10,20,50,100,200,...)
  const niceMax=v=>{const exp=Math.pow(10,Math.floor(Math.log10(v)));const n=v/exp;return (n<=1?1:n<=2?2:n<=5?5:10)*exp;};
  const maxV=data?niceMax(maxRaw):1;
  const px=(i,n)=>padL+(i/((n||1)-1||1))*plotW;
  const py=v=>padT+plotH-(v/maxV)*plotH;
  const pointsV=data?data.serieVisitas.map((v,i)=>`${px(i,data.dayKeys.length)},${py(v)}`).join(" "):"";
  const pointsS=data?data.serieSesiones.map((v,i)=>`${px(i,data.dayKeys.length)},${py(v)}`).join(" "):"";
  const yTicks=data?[0,maxV/4,maxV/2,maxV*3/4,maxV].map(v=>Math.round(v)):[];
  const [hover,setHover]=useState(null);
  return(
    <div style={{minHeight:"100vh",background:"var(--fx-hover)",padding:"20px",fontFamily:"system-ui,-apple-system,sans-serif"}}>
      <div style={{maxWidth:"1000px",margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px",flexWrap:"wrap",gap:"10px"}}>
          <h1 style={{fontSize:"22px",fontWeight:800,color:"var(--fx-text)",margin:0}}>📊 Analytics</h1>
          <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
            {[7,30,90,365].map(d=>
              <button key={d} onClick={()=>setDias(d)} style={{padding:"7px 12px",borderRadius:"10px",border:dias===d?"1.5px solid #9333ea":"1.5px solid var(--fx-border)",background:dias===d?"#9333ea":"#fff",color:dias===d?"#fff":"#475569",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>{d>=365?"1 año":`${d} días`}</button>
            )}
            <button onClick={onClose} style={{padding:"7px 14px",borderRadius:"10px",border:"1.5px solid var(--fx-border)",background:"var(--fx-card)",color:"var(--fx-label)",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>Cerrar</button>
          </div>
        </div>
        {snapshots.length>0&&<div style={{background:"#eef2ff",border:"1.5px solid #c7d2fe",borderRadius:"12px",padding:"12px 14px",marginBottom:"14px"}}>
          <div style={{fontSize:"12px",fontWeight:800,color:"#4338ca",marginBottom:"6px"}}>📦 Histórico Vercel {dias>=30?"(sumado en los totales)":"(no incluido — rango < 30 días)"}</div>
          {snapshots.map(s=><div key={s.id} style={{fontSize:"12px",color:"#3730a3",lineHeight:"1.5"}}>
            <b>{s.periodo_desde} → {s.periodo_hasta}</b>: {s.visitantes?.toLocaleString(locale())} visitantes · {s.pageviews?.toLocaleString(locale())} pageviews · rebote {s.bounce_rate}%
          </div>)}
        </div>}
        {loading&&<div style={{padding:"40px",textAlign:"center",color:"var(--fx-muted2)"}}>Cargando…</div>}
        {err&&<div style={{padding:"20px",background:"var(--fx-red-bg)",border:"1.5px solid #fecaca",borderRadius:"12px",color:"var(--fx-red-text)"}}>❌ {err}</div>}
        {data&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"12px",marginBottom:"16px"}}>
            <MetricCard label="Pageviews" value={data.total.toLocaleString(locale())}/>
            <MetricCard label="Sesiones únicas" value={data.ses.toLocaleString(locale())}/>
            <MetricCard label="Anónimas" value={data.anon.toLocaleString(locale())}/>
            <MetricCard label="Logueadas" value={data.auth.toLocaleString(locale())}/>
            {data.brutas!==data.total&&<MetricCard label="Bots filtrados" value={(data.brutas-data.total).toLocaleString(locale())}/>}
          </div>
          <div style={{background:"var(--fx-card)",borderRadius:"14px",padding:"16px",marginBottom:"16px",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px",flexWrap:"wrap",gap:"6px"}}>
              <div style={{fontSize:"13px",fontWeight:700,color:"var(--fx-label)"}}>Actividad · últimos {dias} días</div>
              <div style={{display:"flex",gap:"12px",fontSize:"11px",color:"var(--fx-muted)"}}>
                <span style={{display:"inline-flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:2,background:"#9333ea",display:"inline-block"}}/>Pageviews</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:2,background:"#059669",display:"inline-block"}}/>Sesiones</span>
              </div>
            </div>
            <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{width:"100%",height:"auto",display:"block"}}
              onMouseMove={e=>{
                const svg=e.currentTarget;const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;
                const cp=pt.matrixTransform(svg.getScreenCTM().inverse());
                if(cp.x<padL||cp.x>chartW-padR){setHover(null);return;}
                const i=Math.round(((cp.x-padL)/plotW)*(data.dayKeys.length-1));
                if(i<0||i>=data.dayKeys.length){setHover(null);return;}
                setHover({i,x:px(i,data.dayKeys.length)});
              }}
              onMouseLeave={()=>setHover(null)}>
              {/* Grid + eje Y */}
              {yTicks.map((v,idx)=>{const y=py(v);return <g key={idx}>
                <line x1={padL} y1={y} x2={chartW-padR} y2={y} stroke="#f1f5f9" strokeWidth="1"/>
                <text x={padL-6} y={y+3} fontSize="9" fill="#94a3b8" textAnchor="end">{v.toLocaleString(locale())}</text>
              </g>;})}
              {/* Línea del eje X */}
              <line x1={padL} y1={py(0)} x2={chartW-padR} y2={py(0)} stroke="#cbd5e1" strokeWidth="1"/>
              {/* Series */}
              <polyline fill="none" stroke="#9333ea" strokeWidth="2" points={pointsV}/>
              <polyline fill="none" stroke="#059669" strokeWidth="2" points={pointsS} strokeDasharray="4 3"/>
              {/* Fechas eje X (max 8 labels distribuidas) */}
              {data.dayKeys.map((d,i)=>{
                const step=Math.max(1,Math.ceil(data.dayKeys.length/8));
                if(i%step!==0&&i!==data.dayKeys.length-1)return null;
                return <text key={d} x={px(i,data.dayKeys.length)} y={chartH-4} fontSize="9" fill="#94a3b8" textAnchor="middle">{d.slice(5)}</text>;
              })}
              {/* Hover: línea + tooltip */}
              {hover&&<>
                <line x1={hover.x} y1={padT} x2={hover.x} y2={py(0)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2"/>
                <circle cx={hover.x} cy={py(data.serieVisitas[hover.i])} r="3.5" fill="#9333ea"/>
                <circle cx={hover.x} cy={py(data.serieSesiones[hover.i])} r="3.5" fill="#059669"/>
                <g transform={`translate(${Math.min(hover.x+8,chartW-140)},${padT+4})`}>
                  <rect width="132" height="42" rx="4" fill="#1e293b" opacity="0.95"/>
                  <text x="8" y="14" fontSize="10" fill="#f1f5f9" fontWeight="700">{data.dayKeys[hover.i]}</text>
                  <text x="8" y="28" fontSize="10" fill="#c4b5fd">● {data.serieVisitas[hover.i].toLocaleString(locale())} pageviews</text>
                  <text x="8" y="40" fontSize="10" fill="#6ee7b7">● {data.serieSesiones[hover.i].toLocaleString(locale())} sesiones</text>
                </g>
              </>}
            </svg>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"16px"}}>
            <TablaTop titulo="Top páginas" filas={data.topPaths}/>
            <TablaTop titulo="Top países" filas={data.topPais}/>
            <TablaTop titulo="Top ciudades" filas={data.topCiudad}/>
            <TablaTop titulo="Top referrers" filas={data.topRefs}/>
            <TablaTop titulo="Dispositivo" filas={data.topDisp}/>
            <TablaTop titulo="Navegador" filas={data.topBrow}/>
          </div>
        </>}
      </div>
    </div>
  );
}
function MetricCard({label,value}){
  return <div style={{background:"var(--fx-card)",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
    <div style={{fontSize:"11px",fontWeight:700,color:"var(--fx-muted)",textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</div>
    <div style={{fontSize:"22px",fontWeight:800,color:"var(--fx-text)",marginTop:"4px"}}>{value}</div>
  </div>;
}
function TablaTop({titulo,filas,limite=10}){
  const t = useT();
  const [expand,setExpand]=useState(false);
  const tot=filas.reduce((a,[,n])=>a+n,0)||1;
  const visibles=expand?filas:filas.slice(0,limite);
  const restantes=filas.length-visibles.length;
  return <div style={{background:"var(--fx-card)",borderRadius:"14px",padding:"16px",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
    <div style={{fontSize:"13px",fontWeight:700,color:"var(--fx-label)",marginBottom:"10px"}}>{titulo}</div>
    {filas.length===0&&<div style={{fontSize:"12px",color:"var(--fx-muted2)"}}>{t("common.no_data")}</div>}
    <div style={{maxHeight:expand?"340px":"none",overflowY:expand?"auto":"visible"}}>
      {visibles.map(([k,n])=>{
        const fm=/^flag:([a-z]{2})\|(.*)$/.exec(k);
        return <div key={k} style={{marginBottom:"6px"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:"12px",color:"var(--fx-label)"}}>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"70%",display:"inline-flex",alignItems:"center",gap:"6px"}}>
            {fm&&<img loading="lazy" decoding="async" src={`https://flagcdn.com/w20/${fm[1]}.png`} alt={fm[1]} style={{width:16,height:12,borderRadius:2,flexShrink:0}}/>}
            <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{fm?fm[2]:k}</span>
          </span>
          <b style={{color:"var(--fx-text)"}}>{n.toLocaleString(locale())}</b>
        </div>
        <div style={{height:"4px",background:"var(--fx-hover)",borderRadius:"2px",marginTop:"2px"}}>
          <div style={{height:"100%",background:"#9333ea",width:`${(n/tot)*100}%`,borderRadius:"2px"}}/>
        </div>
      </div>;})}
    </div>
    {filas.length>limite&&<button onClick={()=>setExpand(v=>!v)} style={{marginTop:"8px",width:"100%",padding:"7px",border:"1.5px solid var(--fx-border)",borderRadius:"8px",background:"var(--fx-hover)",color:"var(--fx-label)",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>
      {expand?"↑ Ver menos":`↓ Ver todo (${restantes} más)`}
    </button>}
  </div>;
}

/* Skeleton reutilizable para loading de vistas y Suspense fallbacks */
function GridSkel({n=12,cards=true}){
  return(
    <div style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      <div className="bfdb-skel" style={{width:"220px",height:"22px",marginBottom:"8px"}}/>
      <div className="bfdb-skel" style={{width:"140px",height:"14px",marginBottom:"18px",display:"block"}}/>
      {cards?(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"12px"}}>
          {Array.from({length:n}).map((_,i)=>(
            <div key={i} style={{background:"var(--fx-card)",borderRadius:"14px",padding:"12px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",display:"flex",flexDirection:"column",gap:"8px",alignItems:"center"}}>
              <div className="bfdb-skel" style={{width:"56px",height:"56px",borderRadius:"50%"}}/>
              <div className="bfdb-skel" style={{width:"80%",height:"12px"}}/>
              <div className="bfdb-skel" style={{width:"60%",height:"10px"}}/>
              <div className="bfdb-skel" style={{width:"90%",height:"22px",borderRadius:"6px",marginTop:"4px"}}/>
            </div>
          ))}
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {Array.from({length:n}).map((_,i)=>(
            <div key={i} className="bfdb-skel" style={{width:"100%",height:"48px",borderRadius:"10px"}}/>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── App ─────────────────────────────────────────────────── */
export default function App(){
  const t = useT();
  const lang = useLang();
  const [players,setPlayers] = useState([]);
  const [equipos,setEquipos] = useState([]);
  const [ligas,setLigas]     = useState([]);
  const [palmares,setPalmares] = useState([]);
  const [coaches,setCoaches]     = useState([]);
  const [tempCoach,setTempCoach] = useState([]);
  const [equiposNombres,setEquiposNombres] = useState([]);
  const [partidos,setPartidos]             = useState([]);
  const [partidosFull,setPartidosFull]     = useState(false);
  const [seasonsFull,setSeasonsFull]       = useState(false);
  const [mvps,setMvps]                     = useState([]);
  const [boxCount,setBoxCount]             = useState(0);
  const [totalCounts,setTotalCounts]       = useState({partidos:0,temporadas:0});
  const [openClasiKey,setOpenClasiKey]     = useState(null);
  const [partidosSub,setPartidosSub]       = useState(null); // subruta de /partidos (["partido","85"] o ["clasificacion","L067","2025"])
  const [loading,setLoading] = useState(true);
  const [error,setError]     = useState(null);
  const [isFirstLoad,setIsFirstLoad] = useState(true);
  const [showCalidad,setShowCalidad] = useState(false);
  const [showAnalytics,setShowAnalytics] = useState(false);
  const [mobileSearchOpen,setMobileSearchOpen] = useState(false);
  useEffect(()=>{
    const h=e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){
        e.preventDefault();
        setMobileSearchOpen(o=>!o);
      }
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[]);
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
  const [tema,setTemaRaw]          = useState(()=>{try{return localStorage.getItem("bfdb-tema")==="oscuro"?"oscuro":"claro";}catch(e){return "claro";}});
  const setTema=async(v)=>{
    setTemaRaw(v);
    try{localStorage.setItem("bfdb-tema",v);}catch(e){}
    if(user){try{await supabase.from("perfiles").update({tema:v}).eq("id",user.id);}catch(e){}}
  };
  // SEO: titulo y descripcion dinamicos segun URL. Se re-evalua en cada
  // pushState/popstate y cuando cambian los datos cargados (para hidratar
  // nombre correcto una vez tenemos la lista de players/equipos/etc).
  const [urlTick,setUrlTick]=useState(0);
  useEffect(()=>{
    const origPush=window.history.pushState;
    window.history.pushState=function(...args){origPush.apply(this,args);setUrlTick(t=>t+1);};
    const onPop=()=>setUrlTick(t=>t+1);
    window.addEventListener("popstate",onPop);
    return()=>{window.history.pushState=origPush;window.removeEventListener("popstate",onPop);};
  },[]);
  useEffect(()=>{
    const TAB_TITLES={home:t("title.home"),jugadoras:t("title.jugadoras"),equipos:t("title.equipos"),ligas:t("title.ligas"),coaches:t("title.coaches"),ranking_fiba:t("title.ranking_fiba"),partidos:t("title.partidos"),quiniela:t("title.quiniela"),comparar:t("title.comparar"),favoritos:t("title.favoritos"),privacidad:t("title.privacidad")};
    const parts=window.location.pathname.split("/").filter(Boolean);
    let title="La Basketneta", desc="Base de datos del baloncesto femenino: jugadoras, equipos, ligas y estadísticas de todo el mundo.";
    let ogTipo=null, ogId=null;
    const [seg,id]=parts;
    if(seg==="jugadoras"&&id){const p=players.find(x=>x.id_jugadora===id);if(p){title=`${p.nombre} · La Basketneta`;desc=`Ficha de ${p.nombre}${p.posicion?` (${p.posicion})`:""}${p.nacionalidad?` · ${p.nacionalidad}`:""}. Trayectoria, estadísticas y palmarés en La Basketneta.`;ogTipo="jugadora";ogId=id;}else if(TAB_TITLES.jugadoras){title=`${TAB_TITLES.jugadoras} · La Basketneta`;}}
    else if(seg==="equipos"&&id){const e=equipos.find(x=>x.id_equipo===id);if(e){title=`${e.nombre} · La Basketneta`;desc=`Plantilla, palmarés y últimos fichajes de ${e.nombre}${e.ciudad?` (${e.ciudad})`:""}. Ficha completa en La Basketneta.`;ogTipo="equipo";ogId=id;}else{title=`${TAB_TITLES.equipos} · La Basketneta`;}}
    else if(seg==="ligas"&&id){const l=ligas.find(x=>x.id_liga===id);if(l){title=`${l.nombre} · La Basketneta`;desc=`Clasificación, jornadas y equipos de ${l.nombre}${l.pais?` (${l.pais})`:""}. Todo el detalle en La Basketneta.`;}else{title=`${TAB_TITLES.ligas} · La Basketneta`;}}
    else if(seg==="coaches"&&id){const c=coaches?.find(x=>x.id_coach===id);if(c){title=`${c.nombre} · La Basketneta`;desc=`Trayectoria de ${c.nombre} como entrenador/a en La Basketneta.`;}else{title=`${TAB_TITLES.coaches} · La Basketneta`;}}
    else if(seg==="partidos"&&parts[1]==="partido"&&parts[2]){ogTipo="partido";ogId=parts[2];}
    else if(seg&&TAB_TITLES[seg]){title=`${TAB_TITLES[seg]} · La Basketneta`;}
    document.title=title;
    const setMeta=(sel,attr,name,content)=>{let m=document.querySelector(sel);if(!m){m=document.createElement("meta");m.setAttribute(attr,name);document.head.appendChild(m);}m.setAttribute("content",content);};
    setMeta('meta[name="description"]',"name","description",desc);
    const ogImg=ogTipo?`${window.location.origin}/api/og?tipo=${ogTipo}&id=${encodeURIComponent(ogId)}`:`${window.location.origin}/api/og`;
    setMeta('meta[property="og:title"]',"property","og:title",title);
    setMeta('meta[property="og:description"]',"property","og:description",desc);
    setMeta('meta[property="og:image"]',"property","og:image",ogImg);
    setMeta('meta[property="og:url"]',"property","og:url",window.location.href);
    setMeta('meta[property="og:type"]',"property","og:type","website");
    setMeta('meta[name="twitter:card"]',"name","twitter:card","summary_large_image");
    setMeta('meta[name="twitter:title"]',"name","twitter:title",title);
    setMeta('meta[name="twitter:description"]',"name","twitter:description",desc);
    setMeta('meta[name="twitter:image"]',"name","twitter:image",ogImg);
  },[urlTick,players,equipos,ligas,coaches,lang]);
  useEffect(()=>{
    const html=document.documentElement;
    if(tema==="oscuro") html.setAttribute("data-bfdb-tema","dark"); else html.removeAttribute("data-bfdb-tema");
  },[tema]);
  const [favoritos,setFavoritos]   = useState([]);
  const [showLogin,setShowLogin]   = useState(false);
  const [loginErr,setLoginErr]     = useState("");
  const [loginLoading,setLoginLoading] = useState(false);
  const [loginMode,setLoginMode]   = useState("login"); // login | register | forgot
  const [loginInfo,setLoginInfo]   = useState("");
  const [showResetPass,setShowResetPass] = useState(false);
  const [resetErr,setResetErr]     = useState("");
  const [resetInfo,setResetInfo]   = useState("");
  const [resetLoading,setResetLoading] = useState(false);
  const [showUserMenu,setShowUserMenu] = useState(false);
  const [menuOpen,setMenuOpen] = useState(false);
  const [showPrivacidad,setShowPrivacidad] = useState(false);
  const [showPerfil,setShowPerfil] = useState(false);
  const [tab,setTabRaw] = useState("home");
  const setTab = (v)=>{setShowPerfil(false);setTabRaw(v);try{registrarEvento("visita_tab",v);}catch{}};

  useEffect(()=>{
    const setupUser=async(session)=>{
      const u=session?.user||null;
      setUser(u);
      if(u){
        const {data:isAdm}=await supabase.rpc("is_admin");
        setIsAdmin(!!isAdm);
        try{const {data:pf}=await supabase.from("perfiles").select("tema").eq("id",u.id).maybeSingle();if(pf?.tema){setTemaRaw(pf.tema);try{localStorage.setItem("bfdb-tema",pf.tema);}catch(e){}}}catch(e){}
        const {data}=await supabase.from("favoritos").select("*").eq("user_id",u.id);
        setFavoritos(data||[]);
        checkPushStatus();
        const {data:notifs}=await supabase.from("notificaciones").select("*").eq("user_id",u.id).order("created_at",{ascending:false}).limit(20);
        setNotificaciones(notifs||[]);
        setNotifCount((notifs||[]).filter(n=>!n.leida).length);
        // Logros: inicializa estado y registra login (cubre bienvenida, habitual, season_pass, veterano, noctambulo)
        // + evaluación de logros de quiniela con el conteo real de predicciones que trae initLogros
        try{
          await initLogros(u);
          await registrarEvento("login",{});
          await registrarEvento("prediccion",{n:0}); // evalúa debut_quinielero + analista sin sumar
        }catch(e){ console.warn("logros init",e); }
      }else{setIsAdmin(false);setFavoritos([]);setNotificaciones([]);setNotifCount(0);initLogros(null);}
    };
    supabase.auth.getSession().then(({data:{session}})=>setupUser(session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY"){ setShowResetPass(true); setResetErr(""); setResetInfo(""); }
      setupUser(session);
    });
    return ()=>subscription.unsubscribe();
  },[]);

  // Analytics propio: 1 fila en `visitas` por cambio de tab. session_id persiste
  // en localStorage; se renueva si no hay actividad en 30 min.
  useEffect(()=>{
    if(!tab)return;
    try{
      const now=Date.now();
      let sid=null,last=0;
      try{sid=localStorage.getItem("bf_sid");last=parseInt(localStorage.getItem("bf_sid_ts")||"0",10);}catch{}
      if(!sid||now-last>30*60*1000){
        sid=Math.random().toString(36).slice(2,10)+now.toString(36);
        try{localStorage.setItem("bf_sid",sid);}catch{}
      }
      try{localStorage.setItem("bf_sid_ts",String(now));}catch{}
      // /api/track añade país/ciudad desde headers x-vercel-ip-*. Si falla, fallback a INSERT directo.
      const payload={path:String(tab).slice(0,500),referrer:(document.referrer||"").slice(0,2000)||null,session_id:sid,id_usuario:user?.id||null};
      fetch("/api/track",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),keepalive:true})
        .then(r=>{ if(!r.ok) throw 0; })
        .catch(()=>{
          supabase.from("visitas").insert({
            ...payload,
            user_agent:(navigator.userAgent||"").slice(0,500)||null
          }).then(()=>{},()=>{});
        });
    }catch{/* silent */}
  },[tab,user?.id]);

  const isFav=(tipo,idRef)=>favoritos.some(f=>f.tipo===tipo&&f.id_referencia===idRef);
  const toggleFav=async(tipo,idRef)=>{
    if(!user){setShowLogin(true);return;}
    const ex=favoritos.find(f=>f.tipo===tipo&&f.id_referencia===idRef);
    if(ex){
      await supabase.from("favoritos").delete().eq("id",ex.id);
      setFavoritos(prev=>prev.filter(f=>f.id!==ex.id));
    }else{
      const {data}=await supabase.from("favoritos").insert({user_id:user.id,tipo,id_referencia:idRef}).select().single();
      if(data){
        setFavoritos(prev=>[...prev,data]);
        try{
          if(tipo==="jugadora") registrarEvento("fav_jugadora", idRef);
          else if(tipo==="equipo"){
            registrarEvento("fav_equipo", idRef);
            const eq=(equipos||[]).find(e=>e.id_equipo===idRef);
            if(eq?.id_liga) registrarEvento("fav_equipo_liga", eq.id_liga);
          }
        }catch(e){/* ignore */}
      }
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
  const handleForgotPassword=async(email)=>{
    if(!email||!email.includes("@")){setLoginErr("Email no válido");return;}
    setLoginLoading(true);setLoginErr("");setLoginInfo("");
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
    setLoginLoading(false);
    if(error) setLoginErr(error.message);
    else setLoginInfo("Email enviado. Revisa tu bandeja y sigue el enlace.");
  };
  const handleSaveNewPassword=async(password)=>{
    setResetLoading(true);setResetErr("");setResetInfo("");
    const {error}=await supabase.auth.updateUser({password});
    setResetLoading(false);
    if(error) setResetErr(error.message);
    else {
      setResetInfo("Contraseña actualizada");
      setTimeout(()=>{setShowResetPass(false);setResetInfo("");},1500);
    }
  };
  const handleLogout=async()=>{await supabase.auth.signOut();setUser(null);setIsAdmin(false);setFavoritos([]);initLogros(null);};

  // Logros: toast + modales
  const [logroToast,setLogroToast]=useState(null);
  const [showLogros,setShowLogros]=useState(false);
  const [verPerfilAlias,setVerPerfilAlias]=useState(null);
  useEffect(()=>{
    const off=onLogroDesbloqueado(l=>{
      setLogroToast(l);
      setTimeout(()=>setLogroToast(cur=>cur?.slug===l.slug?null:cur),4500);
    });
    return off;
  },[]);
  // día_partido + tip-off (cuando hay user + partidos cargados)
  useEffect(()=>{
    if(!user || !partidos || partidos.length===0) return;
    const LIGAS_LIVE=new Set(["L006","L010","L011","L109"]); // WNBA, Euroliga, Eurocup, LF
    const hoy=new Date();
    const hoyStr=hoy.toISOString().slice(0,10);
    const hoyPartidos=partidos.filter(p=>p.fecha_hora && LIGAS_LIVE.has(p.id_liga) && p.fecha_hora.slice(0,10)===hoyStr);
    if(hoyPartidos.length>0){
      try{ registrarEvento("login_dia_partido", hoyStr); }catch{}
    }
    // tip-off: alguno acaba de empezar (últimos 5 min)
    const now=Date.now();
    const tipoff=hoyPartidos.some(p=>{
      const t=new Date(p.fecha_hora).getTime();
      return now>=t && now-t <= 5*60*1000;
    });
    if(tipoff){ try{ registrarEvento("login_tipoff",{});}catch{} }
  },[user, partidos]);
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
    if(tabName==="comparar")return `/comparar`;
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

  const goToTeam   = (id,year=null,from=null)=>{pushNav(from,"equipos",id);setOpenTeamId(id);setOpenTeamYear(year);setOpenPlayerId(null);setTab("equipos");scrollTop();try{registrarEvento("visita_equipo",id);}catch{}};
  const goToLeague = (id,from=null)=>{pushNav(from,"ligas",id);setOpenLigaId(id);setTab("ligas");scrollTop();try{registrarEvento("visita_liga",id);}catch{}};
  const goToPlayer = (id,from=null)=>{
    pushNav(from,"jugadoras",id);setOpenPlayerId(id);setOpenTeamId(null);setTab("jugadoras");scrollTop();
    try{
      const p=(players||[]).find(x=>x.id_jugadora===id);
      registrarEvento("visita_jugadora",{id, id_liga:p?.id_liga});
    }catch{}
  };
  const goToCoach  = (id,from=null)=>{pushNav(from,"cuerpo_tecnico",id);setOpenCoachId(id);setTab("cuerpo_tecnico");scrollTop();try{registrarEvento("visita_coach",id);}catch{}};
  const goToPartido= (id,from=null)=>{setPartidosSub(["partido",String(id)]);setTab("partidos");try{window.history.pushState({},"",`/partidos/partido/${id}`);}catch(e){}scrollTop();};
  const regExtra=(mvps?.length||0)+(totalCounts.partidos||partidos?.length||0)+boxCount+(equiposNombres?.length||0)+(totalCounts.temporadas||0);

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
    const CK="basketfemdb:cache:v8";
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
            if(c.seasonsFull) setSeasonsFull(true);
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
        fetchAll("jugadoras",{order:"id_jugadora",select:"id_jugadora,nombre,posicion,posicion2,nacionalidad,nacionalidad2,fecha_nac,fecha_fallecimiento,altura_cm,foto"}),
        fetchAll("equipos",{order:"id_equipo"}),
        fetchAll("ligas",{order:"id_liga"}),
        fetchAll("dos_ultimas_temporadas",{order:"id_jugadora",select:"id,id_jugadora,id_equipo,id_liga,temporada,orden",filter:q=>q.neq("id_liga","L020")}),
        fetchAll("partidos",{order:"fecha_hora",select:"id,fecha_hora,temporada,id_liga,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante,notas,es_live,periodo,parciales,id_ext,fuente,bracket_pos,link,url_stats",filter:q=>q.neq("id_liga","L020").gte("temporada",String(new Date().getFullYear()-2))}),
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
            const [bc,tp,tt]=await Promise.all([
              supabase.from("partido_boxscore").select("*",{count:"exact",head:true}),
              supabase.from("partidos").select("*",{count:"exact",head:true}),
              supabase.from("temporadas").select("*",{count:"exact",head:true}),
            ]);
            setBoxCount(bc.count||0);
            setTotalCounts({partidos:tp.count||0,temporadas:tt.count||0});
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

  // Carga bajo demanda del historial completo de temporadas al entrar en "jugadoras"
  useEffect(()=>{
    if(tab!=="jugadoras"||seasonsFull) return;
    (async()=>{
      try{
        const {data}=await fetchAll("temporadas",{order:"id_jugadora",select:"id,id_jugadora,id_equipo,id_liga,temporada,orden"});
        const byPlayer={};
        (data||[]).forEach(t=>{if(!byPlayer[t.id_jugadora])byPlayer[t.id_jugadora]=[];byPlayer[t.id_jugadora].push(t);});
        let merged=[];
        setPlayers(prev=>{
          merged=prev.map(p=>({...p,seasons:byPlayer[p.id_jugadora]||p.seasons||[]}));
          return merged;
        });
        setSeasonsFull(true);
        try{
          const CK="basketfemdb:cache:v8";
          const raw=localStorage.getItem(CK);
          if(raw){
            const c=JSON.parse(raw);
            c.players=merged;
            c.seasonsFull=true;
            localStorage.setItem(CK,JSON.stringify(c));
          }
        }catch(e){}
      }catch(e){console.warn("Carga completa temporadas falló:",e.message||e);}
    })();
  },[tab,seasonsFull]);

  // Carga bajo demanda del histórico de partidos al entrar en "partidos"
  useEffect(()=>{
    if(tab!=="partidos"||partidosFull) return;
    (async()=>{
      try{
        const {data}=await fetchAll("partidos",{
          order:"fecha_hora",
          select:"id,fecha_hora,temporada,id_liga,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante,notas,es_live,periodo,parciales,id_ext,fuente,bracket_pos,link,url_stats",
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
          const CK="basketfemdb:cache:v8";
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
    else if(parts[0]==="comparar")setTab("comparar");
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

  const TABS=[["home","✍️",t("tab.home")],...(user?[["favoritos","⭐",t("tab.favoritos")]]:[]),["jugadoras","👩‍🏀",t("tab.jugadoras")],["equipos","🏟️",t("tab.equipos")],["ligas","🏆",t("tab.ligas")],["cuerpo_tecnico","📋",t("tab.cuerpo_tecnico")],["ranking_fiba","🌐",t("tab.ranking_fiba")],["partidos","📺",t("tab.partidos")],["comparar","⚖️",t("tab.comparar")],["quiniela","🎯",t("tab.quiniela")]];

  // Alertas rápidas de calidad de datos (solo admin, sobre datos ya cargados)
  const calidadAlertas=useMemo(()=>{
    if(!isAdmin)return null;
    const rePh=/empty-face-(woman|man)-share\.gif/;
    const foto=(players||[]).filter(p=>!p.foto||rePh.test(p.foto)).length;
    const nac=(players||[]).filter(p=>!p.nacionalidad).length;
    const esc=(equipos||[]).filter(e=>!e.escudo).length;
    return {foto,nac,esc,total:foto+nac+esc};
  },[isAdmin,players,equipos]);

  if(showLanding) return <Landing onEnter={handleEnter} players={players} equipos={equipos} ligas={ligas} coaches={coaches} tempCoach={tempCoach} palmares={palmares} regExtra={regExtra}/>;
  if(showCalidad){
    return <Suspense fallback={<GridSkel n={8} cards={false}/>}>
      <CalidadModal players={players} equipos={equipos} ligas={ligas} coaches={coaches}
        tempCoach={tempCoach} palmares={palmares} isAdmin={isAdmin}
        onClose={()=>setShowCalidad(false)} onGoToPlayer={goToPlayer}
        onGoToTeam={goToTeam} onGoToLeague={goToLeague} onGoToCoach={goToCoach} onReload={loadAll}
        setPlayers={setPlayers} setEquipos={setEquipos} setLigas={setLigas} setCoaches={setCoaches} setTempCoach={setTempCoach}/>
    </Suspense>;
  }
  if(showAnalytics){
    return <AnalyticsPanel onClose={()=>setShowAnalytics(false)}/>;
  }
  if(showResetPass) return <ResetPasswordModal onSave={handleSaveNewPassword} onCancel={()=>{setShowResetPass(false);setResetErr("");setResetInfo("");}} loading={resetLoading} error={resetErr} info={resetInfo}/>;
  if(showLogin) return <LoginModal onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} onForgot={handleForgotPassword} onClose={()=>{setShowLogin(false);setLoginErr("");setLoginInfo("");setLoginMode("login");}} loading={loginLoading} error={loginErr} info={loginInfo} mode={loginMode} setMode={(m)=>{setLoginMode(m);setLoginErr("");setLoginInfo("");}}/>;

  if(loading) return(
    <div className="bfdb-app-root" style={{minHeight:"100vh",background:"var(--fx-hover)",color:"var(--fx-text)",fontFamily:"system-ui,-apple-system,sans-serif"}}>
      <div style={{background:"#0f172a",height:"56px",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 16px rgba(0,0,0,0.4)"}}>
        <img src="/icon-home.png" alt="La Basketneta" style={{height:"36px",objectFit:"contain"}}/>
      </div>
      <div style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
        <div className="bfdb-skel" style={{width:"220px",height:"22px",marginBottom:"8px"}}/>
        <div className="bfdb-skel" style={{width:"140px",height:"14px",marginBottom:"18px",display:"block"}}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"12px"}}>
          {Array.from({length:12}).map((_,i)=>(
            <div key={i} style={{background:"var(--fx-card)",borderRadius:"14px",padding:"12px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",display:"flex",flexDirection:"column",gap:"8px",alignItems:"center"}}>
              <div className="bfdb-skel" style={{width:"56px",height:"56px",borderRadius:"50%"}}/>
              <div className="bfdb-skel" style={{width:"80%",height:"12px"}}/>
              <div className="bfdb-skel" style={{width:"60%",height:"10px"}}/>
              <div className="bfdb-skel" style={{width:"90%",height:"22px",borderRadius:"6px",marginTop:"4px"}}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if(error) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--fx-hover)",fontFamily:"system-ui,sans-serif",padding:"20px"}}>
      <div style={{background:"var(--fx-red-bg)",border:"1.5px solid #fecaca",borderRadius:"14px",padding:"24px",maxWidth:"500px",color:"var(--fx-red-text)",fontSize:"14px",textAlign:"center"}}>
        <div style={{fontSize:"36px",marginBottom:"12px"}}>❌</div>
        <strong>{t("common.err_connection")}</strong><br/>{error}
        <button onClick={loadAll} style={{marginTop:"16px",background:"#ef4444",color:"#fff",border:"none",borderRadius:"8px",padding:"10px 20px",cursor:"pointer",fontWeight:700,fontSize:"13px",display:"block",margin:"16px auto 0"}}>{t("common.retry")}</button>
      </div>
    </div>
  );

  return(<>
    <div className="bfdb-app-root" style={{minHeight:"100vh",background:"var(--fx-hover)",color:"var(--fx-text)",fontFamily:"system-ui,-apple-system,sans-serif",overflowX:"hidden"}}>
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
              {isAdmin&&<button onClick={()=>{setShowCalidad(true);setMenuOpen(false);}} title={calidadAlertas?`${calidadAlertas.foto} sin foto · ${calidadAlertas.nac} sin nacionalidad · ${calidadAlertas.esc} escudos rotos`:""} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",background:"transparent",color:"#cbd5e1",border:"none",borderRadius:"8px",padding:"10px 14px",fontWeight:700,fontSize:"14px",cursor:"pointer"}}>
                <span style={{fontSize:"16px"}}>🩺</span>{t("menu.calidad")}
                {calidadAlertas&&calidadAlertas.total>0&&<span style={{marginLeft:"auto",background:"#ef4444",color:"#fff",borderRadius:"10px",padding:"1px 7px",fontSize:"10px",fontWeight:800}}>{calidadAlertas.total>999?"999+":calidadAlertas.total}</span>}
              </button>}
              {isAdmin&&<button onClick={()=>{setShowAnalytics(true);setMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",background:"transparent",color:"#cbd5e1",border:"none",borderRadius:"8px",padding:"10px 14px",fontWeight:700,fontSize:"14px",cursor:"pointer"}}>
                <span style={{fontSize:"16px"}}>📊</span>{t("menu.analytics")}
              </button>}
              <button onClick={()=>{setShowLanding(true);setMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",background:"transparent",color:"#cbd5e1",border:"none",borderRadius:"8px",padding:"10px 14px",fontWeight:700,fontSize:"14px",cursor:"pointer"}}>
                <span style={{fontSize:"16px"}}>ℹ️</span>{t("menu.info")}
              </button>
              <button onClick={()=>{setLang(lang==="es"?"en":"es");setMenuOpen(false);}} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",background:"transparent",color:"#cbd5e1",border:"none",borderRadius:"8px",padding:"10px 14px",fontWeight:700,fontSize:"14px",cursor:"pointer"}}>
                <span style={{fontSize:"16px"}}>{lang==="es"?"🇬🇧":"🇪🇸"}</span>{t("lang.switch_to_other")}
              </button>
            </div></>}
          </div>

          {/* 🔄 Recargar */}
          <button onClick={()=>loadAll(true)} title={t("header.reload")} style={{background:"transparent",color:"var(--fx-muted2)",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"16px",flexShrink:0}}>🔄</button>

          {/* 🔔 Notificaciones */}
          {user&&<div style={{position:"relative",flexShrink:0}}>
            <button onClick={()=>{setShowNotifs(!showNotifs);if(!showNotifs)markRead();}} style={{background:"transparent",color:notifCount>0?"#f59e0b":"#94a3b8",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"16px",position:"relative"}}>🔔{notifCount>0&&<span style={{position:"absolute",top:"2px",right:"4px",background:"#ef4444",color:"#fff",fontSize:"9px",fontWeight:800,borderRadius:"50%",width:"16px",height:"16px",display:"flex",alignItems:"center",justifyContent:"center"}}>{notifCount>9?"9+":notifCount}</span>}</button>
            {showNotifs&&<><div onClick={()=>setShowNotifs(false)} style={{position:"fixed",inset:0,zIndex:99}}/><div style={{position:"absolute",left:0,top:"calc(100% + 8px)",background:"#1e293b",borderRadius:"12px",padding:"12px",boxShadow:"0 10px 40px rgba(0,0,0,0.5)",zIndex:100,width:"300px",maxHeight:"400px",overflowY:"auto",border:"1px solid #334155"}}>
              <div style={{fontWeight:800,fontSize:"14px",color:"#f1f5f9",marginBottom:"8px"}}>{t("header.notif_title")}</div>
              {notificaciones.length===0&&<div style={{fontSize:"12px",color:"var(--fx-muted)",padding:"16px 0",textAlign:"center"}}>{t("header.notif_empty")}</div>}
              {notificaciones.map(n=><div key={n.id} style={{padding:"8px",borderRadius:"8px",background:n.leida?"transparent":"rgba(147,51,234,0.1)",marginBottom:"4px"}}>
                <div style={{fontSize:"12px",fontWeight:700,color:"#f1f5f9"}}>{n.titulo}</div>
                {n.cuerpo&&<div style={{fontSize:"11px",color:"var(--fx-muted2)"}}>{n.cuerpo}</div>}
                <div style={{fontSize:"10px",color:"var(--fx-muted)",marginTop:"2px"}}>{new Date(n.created_at).toLocaleDateString(locale(),{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
              </div>)}
            </div></>}
          </div>}

          {/* Logo */}
          <div className="bfdb-logo" onClick={()=>{setTab("home");window.history.pushState({},"","/");}} title={t("header.home")} style={{display:"flex",alignItems:"center",cursor:"pointer",flex:1,justifyContent:"center"}}>
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
              <button onClick={()=>setShowUserMenu(!showUserMenu)} style={{background:isAdmin?"rgba(249,115,22,0.15)":"rgba(147,51,234,0.15)",color:isAdmin?"#c084fc":"#a78bfa",border:`1.5px solid ${isAdmin?"rgba(249,115,22,0.3)":"rgba(147,51,234,0.3)"}`,borderRadius:"10px",padding:"5px 10px",cursor:"pointer",fontSize:"12px",fontWeight:700}}>{isAdmin?t("header.admin_chip"):"👤"}</button>
              {showUserMenu&&<>
                <div onClick={()=>setShowUserMenu(false)} style={{position:"fixed",inset:0,zIndex:99}}/>
                <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",background:"#1e293b",borderRadius:"12px",padding:"16px",boxShadow:"0 10px 40px rgba(0,0,0,0.5)",zIndex:100,minWidth:"220px",border:"1px solid #334155"}}>
                  <div style={{fontSize:"13px",fontWeight:700,color:"#f1f5f9",marginBottom:"4px"}}>{user.user_metadata?.full_name||user.email.split("@")[0]}</div>
                  <div style={{fontSize:"11px",color:"var(--fx-muted2)",marginBottom:"4px"}}>{user.email}</div>
                  {isAdmin&&<div style={{fontSize:"10px",color:"#c084fc",fontWeight:700,marginBottom:"8px"}}>{t("header.admin_role")}</div>}
                  <div style={{height:"1px",background:"#334155",margin:"8px 0"}}/>
                  <button onClick={()=>{setShowPerfil(true);setShowUserMenu(false);}}
                    style={{width:"100%",background:"rgba(147,51,234,0.2)",color:"#a78bfa",border:"1px solid rgba(147,51,234,0.4)",borderRadius:"8px",padding:"8px",fontWeight:700,fontSize:"12px",cursor:"pointer",marginBottom:"8px"}}>
                    {t("header.my_profile")}
                  </button>
                  <button onClick={()=>{setShowLogros(true);setShowUserMenu(false);}}
                    style={{width:"100%",background:"rgba(234,179,8,0.15)",color:"#fde047",border:"1px solid rgba(234,179,8,0.3)",borderRadius:"8px",padding:"8px",fontWeight:700,fontSize:"12px",cursor:"pointer",marginBottom:"8px"}}>
                    {t("header.my_achievements")}
                  </button>
                  <button onClick={togglePush} style={{width:"100%",background:pushEnabled?"rgba(34,197,94,0.15)":"rgba(147,51,234,0.15)",color:pushEnabled?"#4ade80":"#a78bfa",border:`1px solid ${pushEnabled?"rgba(34,197,94,0.3)":"rgba(147,51,234,0.3)"}`,borderRadius:"8px",padding:"8px",fontWeight:700,fontSize:"12px",cursor:"pointer",marginBottom:"8px"}}>{pushEnabled?t("header.push_on"):t("header.push_off")}</button>
                  <button onClick={()=>setTema(tema==="oscuro"?"claro":"oscuro")} style={{width:"100%",background:"rgba(148,163,184,0.15)",color:"#cbd5e1",border:"1px solid rgba(148,163,184,0.3)",borderRadius:"8px",padding:"8px",fontWeight:700,fontSize:"12px",cursor:"pointer",marginBottom:"8px"}}>{tema==="oscuro"?"☀️ Tema claro":"🌙 Tema oscuro"}</button>
                  <button onClick={()=>{handleLogout();setShowUserMenu(false);}} style={{width:"100%",background:"#ef4444",color:"#fff",border:"none",borderRadius:"8px",padding:"8px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>{t("menu.logout")}</button>
                </div>
              </>}
            </div>
            :<button onClick={()=>setShowLogin(true)} title="Iniciar sesión" style={{background:"transparent",color:"var(--fx-muted2)",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"16px",flexShrink:0}}>👤</button>
          }
        </div>      </div>
      <div style={{paddingTop:"8px"}}>
        {showPerfil&&user&&<PerfilView user={user} favoritos={favoritos} onClose={()=>setShowPerfil(false)} onLogout={()=>{handleLogout();setShowPerfil(false);}}/>}
        {showPrivacidad&&<Suspense fallback={<GridSkel n={6} cards={false}/>}><PrivacidadView onBack={()=>{setShowPrivacidad(false);window.history.back();}}/></Suspense>}
        {!showPrivacidad&&!showPerfil&&tab==="favoritos"&&user&&<FavoritosView players={players} equipos={equipos} ligas={ligas} partidos={partidos} favoritos={favoritos} user={user} onGoToPlayer={goToPlayer} onGoToTeam={goToTeam} onGoToLeague={goToLeague} onGoToPartido={goToPartido} isFavFn={isFav} onToggleFav={toggleFav}/>}
        {!showPrivacidad&&!showPerfil&&tab==="home"&&<HomeView players={players} equipos={equipos} ligas={ligas} palmares={palmares} coaches={coaches} tempCoach={tempCoach} onGoToPlayer={goToPlayer} onGoToTeam={goToTeam} onGoToTab={t=>setTab(t)} equiposNombres={equiposNombres} user={user} favoritos={favoritos} onGoToLeague={goToLeague}/>}
        {!showPrivacidad&&!showPerfil&&tab==="jugadoras"&&<PlayersView players={players} equipos={equipos} ligas={ligas} palmares={palmares} coaches={coaches} tempCoach={tempCoach} onReload={loadAll} onGoToTeam={goToTeam} onGoToCoach={goToCoach} openPlayerId={openPlayerId} onClearPlayer={()=>setOpenPlayerId(null)} isAdmin={isAdmin} onGoToTab={t=>setTab(t)} navHistory={navHistory} onGoBack={goBack} equiposNombres={equiposNombres} setPlayers={setPlayers} setTempCoach={setTempCoach} onGoToPartido={goToPartido} regExtra={regExtra} isFavFn={isFav} onToggleFav={toggleFav}/>}
        {!showPerfil&&tab==="equipos"  &&<TeamsView equipos={equipos} players={players} ligas={ligas} palmares={palmares} coaches={coaches} tempCoach={tempCoach} onGoToPlayer={goToPlayer} onGoToCoach={goToCoach} onGoToLeague={goToLeague} openTeamId={openTeamId} openTeamYear={openTeamYear} onClearTeam={()=>{setOpenTeamId(null);setOpenTeamYear(null);}} isAdmin={isAdmin} onReload={loadAll} onGoToTab={t=>setTab(t)} navHistory={navHistory} onGoBack={goBack} equiposNombres={equiposNombres} setEquipos={setEquipos} setEquiposNombres={setEquiposNombres} setPlayers={setPlayers} setPalmares={setPalmares} regExtra={regExtra} onGoToPartido={goToPartido} isFavFn={isFav} onToggleFav={toggleFav}/>}
        {!showPerfil&&tab==="ligas"    &&<LeaguesView ligas={ligas} players={players} equipos={equipos} palmares={palmares} coaches={coaches} tempCoach={tempCoach} partidos={partidos} onGoToClasificacion={(ligaId,temporada)=>{setOpenClasiKey(`${ligaId}|${temporada||""}`);setTab("partidos");scrollTop();}} onGoToTeam={goToTeam} onGoToPlayer={(id)=>goToPlayer(id,{tab:"ligas",label:t("tab.ligas")})} isAdmin={isAdmin} onReload={loadAll} openLigaId={openLigaId} onClearLiga={()=>setOpenLigaId(null)} onGoToTab={t=>setTab(t)} navHistory={navHistory} onGoBack={goBack} setLigas={setLigas} regExtra={regExtra} isFavFn={isFav} onToggleFav={toggleFav}/>}
        {!showPrivacidad&&!showPerfil&&tab==="ranking_fiba"&&<Suspense fallback={<GridSkel n={12} cards={false}/>}><RankingFibaView equipos={equipos} isAdmin={isAdmin} onGoToTeam={(id)=>goToTeam(id,null,{tab:"ranking_fiba",label:"Ranking FIBA"})} onReload={loadAll}/></Suspense>}
        {!showPrivacidad&&!showPerfil&&tab==="cuerpo_tecnico"&&<CoachesView coaches={coaches} tempCoach={tempCoach} equipos={equipos} ligas={ligas} players={players} palmares={palmares} onGoToPlayer={goToPlayer} onGoToTeam={goToTeam} openCoachId={openCoachId} onClearCoach={()=>setOpenCoachId(null)} isAdmin={isAdmin} onReload={loadAll} onGoToTab={t=>setTab(t)} navHistory={navHistory} onGoBack={goBack} setCoaches={setCoaches} setTempCoach={setTempCoach} equiposNombres={equiposNombres} regExtra={regExtra}/>}
        {!showPrivacidad&&!showPerfil&&tab==="quiniela"&&(user
          ?<Suspense fallback={<GridSkel n={8} cards={false}/>}><QuinielaView user={user} equipos={equipos} onAbrirPerfil={setVerPerfilAlias} isAdmin={isAdmin}/></Suspense>
          :<div style={{maxWidth:"420px",margin:"48px auto",padding:"24px",background:"var(--fx-card)",borderRadius:"16px",textAlign:"center",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
            <div style={{fontSize:"38px",marginBottom:"8px"}}>🎯</div>
            <h3 style={{margin:"0 0 6px",color:"var(--fx-text)",fontSize:"18px",fontWeight:800}}>{t("quiniela.title")}</h3>
            <p style={{color:"var(--fx-muted)",fontSize:"14px",margin:"0 0 16px"}}>{t("quiniela.gate")}</p>
            <button onClick={()=>setShowLogin(true)} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"11px 24px",fontWeight:700,fontSize:"14px",cursor:"pointer"}}>{t("menu.login")}</button>
          </div>)}
        {!showPrivacidad&&!showPerfil&&tab==="comparar"&&<Suspense fallback={<GridSkel n={3} cards={false}/>}><ComparadorView players={players} equipos={equipos} ligas={ligas} equiposNombres={equiposNombres} onGoToPlayer={(id)=>goToPlayer(id,{tab:"comparar",label:"Comparar"})} onGoToTeam={(id)=>goToTeam(id,null,{tab:"comparar",label:"Comparar"})}/></Suspense>}
        {!showPrivacidad&&!showPerfil&&tab==="partidos"&&<PartidosView partidos={partidos} equipos={equipos} ligas={ligas} players={players} mvps={mvps} equiposNombres={equiposNombres} openClasiKey={openClasiKey} onClearClasi={()=>setOpenClasiKey(null)} partidosSub={partidosSub} isAdmin={isAdmin} setPartidos={setPartidos} onGoToTeam={(id,year)=>goToTeam(id,year||null,{tab:"partidos",label:"Ver partidos"})} onGoToLeague={(id)=>goToLeague(id,{tab:"partidos",label:"Ver partidos"})} onGoToPlayer={(id)=>goToPlayer(id,{tab:"partidos",label:"Ver partidos"})}/>}
      </div>
    </div>
    {/* Logros: toast + modales */}
    {logroToast&&(
      <div onClick={()=>{setShowLogros(true);setLogroToast(null);}}
        style={{position:"fixed",bottom:"20px",left:"50%",transform:"translateX(-50%)",background:"#1e293b",color:"#fde047",border:"1.5px solid #eab308",borderRadius:"14px",padding:"12px 18px",boxShadow:"0 10px 30px rgba(0,0,0,0.4)",zIndex:999,display:"flex",alignItems:"center",gap:"10px",cursor:"pointer",maxWidth:"90vw",fontFamily:"system-ui,sans-serif"}}>
        <div style={{fontSize:"28px"}}>{logroToast.emoji}</div>
        <div>
          <div style={{fontSize:"11px",color:"#fef9c3",fontWeight:700}}>🏆 LOGRO DESBLOQUEADO</div>
          <div style={{fontSize:"14px",color:"#fff",fontWeight:800}}>{logroToast.nombre}</div>
        </div>
      </div>
    )}
    {showLogros&&(
      <Suspense fallback={null}>
        <LogrosModal onClose={()=>setShowLogros(false)}/>
      </Suspense>
    )}
    {verPerfilAlias&&(
      <Suspense fallback={null}>
        <PerfilPublicoModal alias={verPerfilAlias} onClose={()=>setVerPerfilAlias(null)}/>
      </Suspense>
    )}
    </>);
}
