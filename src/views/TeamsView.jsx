// src/views/TeamsView.jsx
// Extraído de App.jsx (Fase 4 refactor, 2026-09-15).
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useT, locale } from "../lib/i18n";
import {
  inp, posStyle, firstFreeId, firstFreeIdNum,
  resolveTeamData, playerStatus, esEquipoEuropeo, countryFlagEmoji,
  teamColors,
  Chip, FlagImg, MultiFlag, SocialIcon,
  TeamBadge, LeagueBadge, Avatar,
  Fld, CalendarSubscribeBtn, Breadcrumbs, Modal, ConfirmDel, EscudoPicker,
  STATUS_BADGE, PaisDropdown,
} from "../lib/ui";

function TeamForm({initial,onSave,onCancel,saving}){
  const [f,setF]=useState({nombre:'',ciudad:'',pais:'',año_fundacion:'',escudo:'',tipo:'equipo',redes_sociales:'',pabellon:'',id_espn:'',id_fiba:'',id_ext:'',conferencia:'',...(initial||{})});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:'100%',border:'1.5px solid var(--fx-border)',borderRadius:'10px',padding:'9px 12px',fontSize:'14px',outline:'none',boxSizing:'border-box'};
  return(<div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
    <Fld label='Nombre *'><input style={inp} value={f.nombre||''} onChange={set('nombre')} placeholder='Perfumerías Avenida'/></Fld>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
      <Fld label='Ciudad'><input style={inp} value={f.ciudad||''} onChange={set('ciudad')} placeholder='Salamanca'/></Fld>
      <Fld label='País'><input style={inp} value={f.pais||''} onChange={set('pais')} placeholder='España'/></Fld>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
      <Fld label='Año fundación'><input style={inp} type='number' value={f.año_fundacion||''} onChange={set('año_fundacion')} placeholder='1994'/></Fld>
      <Fld label='Tipo'><select style={inp} value={f.tipo||''} onChange={set('tipo')}><option value=''>— Sin definir —</option><option value='equipo'>Club</option><option value='seleccion'>Selección</option></select></Fld>
      <Fld label='Conferencia (WNBA)'><select style={inp} value={f.conferencia||''} onChange={set('conferencia')}><option value=''>—</option><option value='East'>East</option><option value='West'>West</option></select></Fld>
    </div>
    <EscudoPicker value={f.escudo} onChange={v=>setF(p=>({...p,escudo:v}))}/>
    <Fld label='Pabellón'><input style={inp} value={f.pabellon||''} onChange={set('pabellon')} placeholder='Würzburg'/></Fld>
    <Fld label='Redes sociales (URL)'><input style={inp} value={f.redes_sociales||''} onChange={set('redes_sociales')} placeholder='https://instagram.com/...'/></Fld>
    <div style={{marginTop:'6px',fontSize:'12px',fontWeight:700,color:'#64748b',letterSpacing:'0.4px',textTransform:'uppercase'}}>IDs externos</div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
      <Fld label='ESPN'><input style={inp} value={f.id_espn||''} onChange={set('id_espn')} placeholder='2483'/></Fld>
      <Fld label='FIBA'><input style={inp} value={f.id_fiba||''} onChange={set('id_fiba')} placeholder='58145'/></Fld>
      <Fld label='FEB'><input style={inp} value={f.id_ext||''} onChange={set('id_ext')} placeholder='981303'/></Fld>
    </div>
    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'8px'}}>
      <button onClick={onCancel} style={{background:'var(--fx-hover)',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.nombre} style={{background:'#9333ea',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
    </div>
  </div>);
}

function PalmaresForm({initial,ligas,onSave,onCancel,saving}){
  const [f,setF]=useState({id_liga:'',temporada:'',...(initial||{})});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:'100%',border:'1.5px solid var(--fx-border)',borderRadius:'10px',padding:'9px 12px',fontSize:'14px',outline:'none',boxSizing:'border-box'};
  return(<div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
    <Fld label='Liga *'><select style={inp} value={f.id_liga||''} onChange={set('id_liga')}>
      <option value=''>Seleccionar liga...</option>
      {(ligas||[]).map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
    </select></Fld>
    <Fld label='Temporada *'><input style={inp} value={f.temporada||''} onChange={set('temporada')} placeholder='2024-25'/></Fld>
    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'8px'}}>
      <button onClick={onCancel} style={{background:'var(--fx-hover)',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.id_liga||!f.temporada} style={{background:'#9333ea',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
    </div>
  </div>);
}

function AddToSquadForm({initial,players,ligas,onSave,onCancel,saving}){
  const [f,setF]=useState({id_jugadora:"",id_liga:"",temporada:initial?.temporada||"",...(initial||{})});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:"100%",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"14px",outline:"none",boxSizing:"border-box"};
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
      <button onClick={onCancel} style={{background:"var(--fx-hover)",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:600,cursor:"pointer"}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.id_jugadora||!f.id_liga||!f.temporada} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:700,cursor:"pointer"}}>{saving?"Guardando...":"Guardar"}</button>
    </div>
  </div>);
}

function NombreHistoricoForm({initial,onSave,onCancel,saving}){
  const [f,setF]=useState({nombre:"",temporada_inicio:"",temporada_fin:"",escudo:"",...(initial||{})});
  const inp={width:"100%",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"14px",outline:"none",boxSizing:"border-box"};
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const ok=f.nombre.trim()&&f.temporada_inicio.trim();
  return(<div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
    <Fld label="Nombre *"><input style={inp} value={f.nombre} onChange={set("nombre")} placeholder="Perfumerías Avenida"/></Fld>
    <Fld label="Temporada inicio *"><input style={inp} value={f.temporada_inicio} onChange={set("temporada_inicio")} placeholder="2020-21"/></Fld>
    <Fld label="Temporada fin (vacío = actualidad)"><input style={inp} value={f.temporada_fin||""} onChange={set("temporada_fin")} placeholder="2024-25"/></Fld>
    <Fld label="URL Escudo (opcional)">
      <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
        <input style={{...inp,flex:1}} value={f.escudo||""} onChange={set("escudo")} placeholder="https://..."/>
        {f.escudo&&<img loading="lazy" decoding="async" src={f.escudo} alt="" style={{width:40,height:40,objectFit:"contain",borderRadius:"8px",border:"1px solid var(--fx-border)",flexShrink:0}} onError={e=>e.target.style.display="none"}/>}
      </div>
    </Fld>
    <div style={{fontSize:"12px",color:"var(--fx-muted2)"}}>Define el rango de temporadas en que el equipo usó este nombre y escudo. Deja "fin" vacío si sigue siendo el nombre actual.</div>
    <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",marginTop:"4px"}}>
      <button onClick={onCancel} style={{background:"var(--fx-hover)",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:600,cursor:"pointer"}}>Cancelar</button>
      <button onClick={()=>onSave({nombre:f.nombre.trim(),temporada_inicio:f.temporada_inicio.trim(),temporada_fin:f.temporada_fin.trim()||null,escudo:f.escudo?.trim()||null})} disabled={saving||!ok}
        style={{background:ok?"#9333ea":"var(--fx-amber-border)",color:"#fff",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:700,cursor:ok?"pointer":"not-allowed"}}>
        {saving?"Guardando...":"Guardar"}
      </button>
    </div>
  </div>);
}

function DuplicateSquadForm({initial,ligas,ligaMap,eq,onSave,onCancel,saving}){
  const [targetLiga,setTargetLiga]=useState("");
  const inp={width:"100%",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"14px",outline:"none",boxSizing:"border-box"};
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
    <div style={{background:"var(--fx-hover)",borderRadius:"12px",padding:"14px",fontSize:"13px",color:"var(--fx-label)"}}>
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
    <div style={{fontSize:"12px",color:"var(--fx-muted2)"}}>Se crearán las mismas entradas con el equipo y temporada actuales, cambiando solo la competición. Las jugadoras que ya tengan esa competición se omitirán.</div>
    <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",marginTop:"4px"}}>
      <button onClick={onCancel} style={{background:"var(--fx-hover)",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:600,cursor:"pointer"}}>Cancelar</button>
      <button onClick={()=>onSave(squad,targetLiga,temporada)} disabled={saving||!targetLiga||!temporada} style={{background:targetLiga&&temporada?"#9333ea":"var(--fx-amber-border)",color:"#fff",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:700,cursor:targetLiga&&temporada?"pointer":"not-allowed"}}>{saving?"Duplicando...":"Duplicar plantilla"}</button>
    </div>
  </div>);
}

function RecordsEquipo({idEquipo, temporada, players, equipos, onGoToPlayer}){
  const t = useT();
  const [data,setData]=useState(null);
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    if(!idEquipo||!temporada)return;
    let cancel=false; setData(null);
    (async()=>{
      const [{data:parts},{data:boxes}]=await Promise.all([
        supabase.from("partidos").select("id,fecha_hora,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante").or(`id_equipo_local.eq.${idEquipo},id_equipo_visitante.eq.${idEquipo}`).eq("temporada",temporada),
        supabase.from("partido_boxscore").select("id_jugadora,id_equipo,puntos,tc_anotados,tc_intentados,t3_anotados,t3_intentados,tl_anotados,tl_intentados,partidos!inner(temporada,id_equipo_local,id_equipo_visitante)").eq("id_equipo",idEquipo).eq("partidos.temporada",temporada),
      ]);
      if(!cancel)setData({parts:parts||[],boxes:boxes||[]});
    })();
    return ()=>{cancel=true;};
  },[idEquipo,temporada]);

  const stats=useMemo(()=>{
    if(!data)return null;
    const played=data.parts.filter(p=>p.resultado_local!=null&&p.resultado_visitante!=null)
      .sort((a,b)=>(a.fecha_hora||"").localeCompare(b.fecha_hora||""));
    if(!played.length)return null;
    const pf=p=>p.id_equipo_local===idEquipo?p.resultado_local:p.resultado_visitante;
    const pc=p=>p.id_equipo_local===idEquipo?p.resultado_visitante:p.resultado_local;
    let v=0,d=0,plus=0,minus=0;
    played.forEach(p=>{const a=Number(pf(p))||0,b=Number(pc(p))||0;plus+=a;minus+=b;if(a>b)v++;else d++;});
    const last5=played.slice(-5);
    const bestWin=[...played].filter(p=>Number(pf(p))>Number(pc(p))).sort((a,b)=>((Number(pf(b))-Number(pc(b)))-(Number(pf(a))-Number(pc(a)))))[0];
    const worstLoss=[...played].filter(p=>Number(pf(p))<Number(pc(p))).sort((a,b)=>((Number(pc(b))-Number(pf(b)))-(Number(pc(a))-Number(pf(a)))))[0];
    // Top anotador
    const byPlayer={};
    data.boxes.forEach(b=>{const k=b.id_jugadora;if(!k)return;if(!byPlayer[k])byPlayer[k]={id_jugadora:k,pj:0,pts:0};byPlayer[k].pj++;byPlayer[k].pts+=Number(b.puntos)||0;});
    const topScorer=Object.values(byPlayer).filter(b=>b.pj>=3).map(b=>({...b,avg:b.pts/b.pj})).sort((a,b)=>b.avg-a.avg)[0]||null;
    // Porcentajes de tiro agregando todos los boxscores del equipo
    const sh={tca:0,tci:0,t3a:0,t3i:0,tla:0,tli:0};
    data.boxes.forEach(b=>{
      sh.tca+=Number(b.tc_anotados)||0; sh.tci+=Number(b.tc_intentados)||0;
      sh.t3a+=Number(b.t3_anotados)||0; sh.t3i+=Number(b.t3_intentados)||0;
      sh.tla+=Number(b.tl_anotados)||0; sh.tli+=Number(b.tl_intentados)||0;
    });
    const t2a=sh.tca-sh.t3a, t2i=sh.tci-sh.t3i;
    const shooting={
      t2:{a:t2a, i:t2i, pct:t2i>0?t2a*100/t2i:null},
      t3:{a:sh.t3a, i:sh.t3i, pct:sh.t3i>0?sh.t3a*100/sh.t3i:null},
      tl:{a:sh.tla, i:sh.tli, pct:sh.tli>0?sh.tla*100/sh.tli:null},
    };
    return {v,d,plus,minus,diff:plus-minus,last5,bestWin,worstLoss,topScorer,shooting,pj:played.length};
  },[data,idEquipo]);

  const playerMap=useMemo(()=>{const m={};(players||[]).forEach(p=>m[p.id_jugadora]=p);return m;},[players]);
  const eqMap=useMemo(()=>{const m={};(equipos||[]).forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);

  if(!data)return null;
  if(!stats)return (
    <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"20px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
      <button onClick={()=>setOpen(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",padding:0,width:"100%",marginBottom:open?"12px":0}}>
        <h2 style={{fontWeight:700,fontSize:"17px",color:"var(--fx-text)",margin:0}}>{t("records.team_title")} <span style={{fontSize:"13px",fontWeight:500,color:"var(--fx-muted2)"}}>· {temporada}</span></h2>
        <span style={{fontSize:"13px",color:"var(--fx-muted2)",display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
      </button>
      {open&&<div style={{fontSize:"13px",color:"var(--fx-muted)",textAlign:"center",padding:"20px 0"}}>Aún no hay partidos jugados en esta temporada.</div>}
    </div>
  );

  const rivalName=(p)=>{const id=p.id_equipo_local===idEquipo?p.id_equipo_visitante:p.id_equipo_local;return eqMap[id]?.nombre||id;};
  const scoreLabel=(p)=>{const a=p.id_equipo_local===idEquipo?p.resultado_local:p.resultado_visitante;const b=p.id_equipo_local===idEquipo?p.resultado_visitante:p.resultado_local;return `${a}-${b}`;};

  const cardBg={background:"var(--fx-hover)",borderRadius:"12px",padding:"12px",display:"flex",flexDirection:"column",gap:"6px"};
  const label={fontSize:"10px",fontWeight:800,color:"#9333ea",textTransform:"uppercase",letterSpacing:"0.5px"};
  const value={fontSize:"20px",fontWeight:900,color:"var(--fx-text)"};

  return (
    <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"20px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
      <button onClick={()=>setOpen(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",padding:0,width:"100%",marginBottom:open?"12px":0}}>
        <h2 style={{fontWeight:700,fontSize:"17px",color:"var(--fx-text)",margin:0}}>{t("records.team_title")} <span style={{fontSize:"13px",fontWeight:500,color:"var(--fx-muted2)"}}>· {temporada}</span></h2>
        <span style={{fontSize:"13px",color:"var(--fx-muted2)",display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
      </button>
      {open&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"10px"}}>
        <div style={cardBg}>
          <div style={label}>{t("records.record")}</div>
          <div style={{...value,color:"var(--fx-text)"}}>{stats.v}V–{stats.d}D <span style={{fontSize:"12px",fontWeight:600,color:"var(--fx-muted)"}}>({Math.round(stats.v*100/stats.pj)}%)</span></div>
        </div>
        <div style={cardBg}>
          <div style={label}>{t("records.plusminus")}</div>
          <div style={{...value,color:stats.diff>=0?"#16a34a":"#dc2626"}}>{stats.diff>=0?"+":""}{stats.diff}</div>
          <div style={{fontSize:"10px",color:"var(--fx-muted)"}}>{stats.plus} · {stats.minus}</div>
        </div>
        <div style={cardBg}>
          <div style={label}>{t("records.streak")}</div>
          <div style={{display:"flex",gap:"3px",marginTop:"2px"}}>
            {stats.last5.map((p,i)=>{const win=Number((p.id_equipo_local===idEquipo?p.resultado_local:p.resultado_visitante))>Number((p.id_equipo_local===idEquipo?p.resultado_visitante:p.resultado_local));return <span key={i} style={{width:22,height:22,borderRadius:"6px",background:win?"#16a34a":"#dc2626",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:800}}>{win?"V":"D"}</span>;})}
          </div>
        </div>
        {stats.topScorer&&(()=>{const p=playerMap[stats.topScorer.id_jugadora];return (
          <div style={{...cardBg,cursor:p?"pointer":"default"}} onClick={()=>p&&onGoToPlayer&&onGoToPlayer(p.id_jugadora)}>
            <div style={label}>{t("records.top_scorer_team")}</div>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              {p?.foto?<img loading="lazy" decoding="async" src={p.foto} alt="" style={{width:26,height:26,borderRadius:"50%",objectFit:"cover"}}/>:null}
              <span style={{fontSize:"13px",fontWeight:700,color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p?.nombre||stats.topScorer.id_jugadora}</span>
              <span style={{marginLeft:"auto",fontSize:"16px",fontWeight:900,color:"var(--fx-text)"}}>{stats.topScorer.avg.toFixed(1)}</span>
            </div>
          </div>
        );})()}
        {stats.bestWin&&(
          <div style={cardBg}>
            <div style={label}>{t("records.best_win")}</div>
            <div style={{fontSize:"13px",fontWeight:700,color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>vs {rivalName(stats.bestWin)}</div>
            <div style={{fontSize:"16px",fontWeight:900,color:"#16a34a"}}>{scoreLabel(stats.bestWin)}</div>
          </div>
        )}
        {stats.worstLoss&&(
          <div style={cardBg}>
            <div style={label}>{t("records.worst_loss")}</div>
            <div style={{fontSize:"13px",fontWeight:700,color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>vs {rivalName(stats.worstLoss)}</div>
            <div style={{fontSize:"16px",fontWeight:900,color:"#dc2626"}}>{scoreLabel(stats.worstLoss)}</div>
          </div>
        )}
        {stats.shooting?.t2?.pct!=null&&(
          <div style={cardBg} title="Porcentaje de tiros de 2 (TC anotados − T3 anotados / TC intentados − T3 intentados)">
            <div style={label}>%T2</div>
            <div style={{...value,color:"var(--fx-text)"}}>{stats.shooting.t2.pct.toFixed(1)}%</div>
            <div style={{fontSize:"10px",color:"var(--fx-muted)"}}>{stats.shooting.t2.a}/{stats.shooting.t2.i}</div>
          </div>
        )}
        {stats.shooting?.t3?.pct!=null&&(
          <div style={cardBg} title="Porcentaje de triples (T3 anotados / T3 intentados)">
            <div style={label}>%T3</div>
            <div style={{...value,color:"var(--fx-text)"}}>{stats.shooting.t3.pct.toFixed(1)}%</div>
            <div style={{fontSize:"10px",color:"var(--fx-muted)"}}>{stats.shooting.t3.a}/{stats.shooting.t3.i}</div>
          </div>
        )}
        {stats.shooting?.tl?.pct!=null&&(
          <div style={cardBg} title="Porcentaje de tiros libres (TL anotados / TL intentados)">
            <div style={label}>%TL</div>
            <div style={{...value,color:"var(--fx-text)"}}>{stats.shooting.tl.pct.toFixed(1)}%</div>
            <div style={{fontSize:"10px",color:"var(--fx-muted)"}}>{stats.shooting.tl.a}/{stats.shooting.tl.i}</div>
          </div>
        )}
      </div>}
    </div>
  );
}

function CalendarioEquipo({idEquipo,temporada,equipos,ligas,equiposNombres,onGoToPartido,onGoToLeague}){
  const t = useT();
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
  const fmt=f=>{if(!f)return"—";const d=new Date(f);return d.toLocaleDateString(locale(),{day:"2-digit",month:"short",year:"2-digit"});};
  const card={background:"var(--fx-card)",borderRadius:"20px",padding:"18px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"};
  const fila=(g)=>{
    const local=g.id_equipo_local===idEquipo;
    const rv=rdata(g);
    const jugado=g.resultado_local!=null&&g.resultado_visitante!=null;
    const pf=local?g.resultado_local:g.resultado_visitante, pc=local?g.resultado_visitante:g.resultado_local;
    const win=jugado&&pf>pc;
    return(
      <div key={g.id} onClick={()=>onGoToPartido&&onGoToPartido(g.id)} style={{display:"flex",alignItems:"center",gap:"10px",padding:"9px 4px",borderBottom:"1px solid #f8fafc",cursor:"pointer"}}>
        <span style={{fontSize:"11px",color:"var(--fx-muted2)",width:"62px",flexShrink:0}}>{fmt(g.fecha_hora)}</span>
        <span title={local?"Home":"Away"} style={{fontSize:"12px",flexShrink:0}}>{local?"🏠":"✈️"}</span>
        {rv.escudo&&<img loading="lazy" decoding="async" src={rv.escudo} alt="" style={{width:20,height:20,objectFit:"contain",flexShrink:0}}/>}
        <span style={{fontSize:"13px",color:"var(--fx-text)",fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rv.nombre}</span>
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
            <div style={{fontSize:"11px",fontWeight:700,color:"#9333ea",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:"5px"}}>{t("teams.next_game")}{prox.notas?` · ${prox.notas}`:""}</div>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:liga?"5px":0}}>
              <span style={{fontSize:"12px"}}>{local?"🏠":"✈️"}</span>
              {rv.escudo&&<img loading="lazy" decoding="async" src={rv.escudo} alt="" style={{width:24,height:24,objectFit:"contain"}}/>}
              <span style={{fontSize:"15px",fontWeight:800,color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rv.nombre}</span>
            </div>
            {liga&&<div onClick={e=>{e.stopPropagation();onGoToLeague&&onGoToLeague(liga.id_liga);}} style={{display:"inline-flex",alignItems:"center",gap:"5px",cursor:"pointer"}}>
              {liga.logo&&<img loading="lazy" decoding="async" src={liga.logo} alt="" style={{width:16,height:16,objectFit:"contain"}}/>}
              <span style={{fontSize:"12px",fontWeight:600,color:"#3b82f6",textDecoration:"underline",textDecorationColor:"var(--fx-blue-border)"}}>{liga.nombre}</span>
            </div>}
          </div>
          <span style={{fontSize:"11px",color:"var(--fx-muted2)",textAlign:"right",flexShrink:0}}>{fmt(prox.fecha_hora)}</span>
        </div>
      );})()}
      <div style={card}>
        <button onClick={()=>setOpen(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",padding:0,width:"100%"}}>
          <h2 style={{fontWeight:700,fontSize:"17px",color:"var(--fx-text)",margin:0}}>📅 Calendario <span style={{fontSize:"13px",fontWeight:500,color:"var(--fx-muted2)"}}>({games.length})</span></h2>
          <span style={{fontSize:"13px",color:"var(--fx-muted2)",display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
        </button>
        {open&&<div style={{marginTop:"12px"}}>
          {games.slice(0,shown).map(fila)}
          {shown<games.length&&<button onClick={()=>setShown(s=>s+5)} style={{marginTop:"10px",width:"100%",padding:"9px",borderRadius:"10px",border:"1px solid var(--fx-border)",background:"var(--fx-hover)",color:"var(--fx-muted)",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>{t("home.ver_mas",{n:games.length-shown})}</button>}
        </div>}
      </div>
    </>
  );
}

function TeamsView({equipos,players,ligas,palmares,coaches,tempCoach,onGoToPlayer,onGoToCoach,onGoToLeague,openTeamId,openTeamYear,onClearTeam,isAdmin,onReload,onGoToTab,navHistory,onGoBack,equiposNombres,setEquipos,setEquiposNombres,setPlayers,setPalmares,regExtra,onGoToPartido,isFavFn,onToggleFav}){
  const t = useT();
  const _q=(()=>{try{return new URLSearchParams(window.location.search);}catch{return new URLSearchParams();}})();
  const [search,setSearch]             = useState(_q.get("q")||"");
  const [filterLeague,setFilterLeague] = useState(_q.get("liga")||"");
  const [filterSeason,setFilterSeason] = useState(_q.get("temp")||null);
  const [filterTipo,setFilterTipo]     = useState(_q.get("tipo")||"");
  const [selId,setSelId]               = useState(openTeamId||null);
  const [shareMsg,setShareMsg]         = useState(false);
  const [visibleCount,setVisibleCount] = useState(60);
  const loadMoreRef = useRef(null);
  useEffect(()=>{
    const seg='equipos';
    if(selId){window.history.replaceState({},"",`/${seg}/${selId}`);return;}
    const params=new URLSearchParams();
    if(search) params.set("q",search);
    if(filterLeague) params.set("liga",filterLeague);
    if(filterSeason) params.set("temp",filterSeason);
    if(filterTipo) params.set("tipo",filterTipo);
    const qs=params.toString();
    window.history.replaceState({},"",`/${seg}${qs?"?"+qs:""}`);
  },[selId,search,filterLeague,filterSeason,filterTipo]);
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
        const payload={...f,año_fundacion:f.año_fundacion===''||f.año_fundacion===null?null:parseInt(f.año_fundacion)||null,id_espn:f.id_espn?.trim()||null,id_fiba:f.id_fiba?.trim()||null,id_ext:f.id_ext?.trim()||null,conferencia:f.conferencia?.trim()||null};
        const newTeam={id_equipo:newId,...payload};
        const{error}=await supabase.from("equipos").insert(newTeam);
        if(error)throw error;
        setEquipos(prev=>[...prev,newTeam]);
      } else {
        const payload={...f,año_fundacion:f.año_fundacion===''||f.año_fundacion===null?null:parseInt(f.año_fundacion)||null,id_espn:f.id_espn?.trim()||null,id_fiba:f.id_fiba?.trim()||null,id_ext:f.id_ext?.trim()||null,conferencia:f.conferencia?.trim()||null};
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
    const esQuali=n=>/^clasificaci/i.test(n)||/qualifier|quali/i.test(n);
    return ids.map(id=>ligaMap[id]).filter(Boolean).sort((a,b)=>{const qa=esQuali(a.nombre),qb=esQuali(b.nombre);return qa!==qb?(qa?1:-1):a.nombre.localeCompare(b.nombre,"es");});
  },[selected,effectiveYear,ligaMap]);
  const effectiveLiga = ligasInYear.length>1?(selLiga&&ligasInYear.some(l=>l.id_liga===selLiga)?selLiga:ligasInYear[0].id_liga):null;
  const squad       = selected
    ?[...new Map(selected.players.filter(({season})=>(!effectiveYear||season.temporada===effectiveYear)&&(!effectiveLiga||season.id_liga===effectiveLiga)).map(({player,season})=>[player.id_jugadora,{player,season}])).values()]
    :[];

  if(selected){
    const {eq}=selected;
    return(
      <div style={{maxWidth:"720px",margin:"0 auto",padding:"20px"}}>
        <Breadcrumbs items={[
          {label:t("tab.home"),onClick:()=>onGoToTab&&onGoToTab("home")},
          {label:t("tab.equipos"),onClick:()=>{setSelId(null);setSelYear(null);}},
          {label:eq.nombre}
        ]}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px"}}>
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
            }} style={{background:"var(--fx-hover)",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"var(--fx-label)"}}>📤 Compartir</button>
            <CalendarSubscribeBtn tipo="equipo" id={eq.id_equipo}/>
            {shareMsg&&<span style={{fontSize:"12px",color:"#16a34a",fontWeight:600}}>¡Enlace copiado!</span>}
            {isAdmin&&<>
            <button onClick={()=>setTeamModal("editTeam")} style={{background:"var(--fx-hover)",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"var(--fx-label)"}}>✏️ Editar</button>
            <button onClick={()=>setDelItem("team")} style={{background:"var(--fx-red-bg)",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
            </>}
          </div>
        </div>
        {isAdmin&&delItem==="team"&&<ConfirmDel msg="¿Eliminar este equipo?" onCancel={()=>setDelItem(null)} onConfirm={delTeam}/>}
        <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"24px",paddingBottom:eq.redes_sociales?"68px":"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px",position:"relative"}}>
          {eq.redes_sociales&&<div style={{position:"absolute",bottom:"18px",left:"24px"}}><SocialIcon url={eq.redes_sociales}/></div>}
          <div style={{display:"flex",alignItems:"center",gap:"20px",flexWrap:"wrap"}}>
            <TeamBadge team={eq} size={80}/>
            <div style={{flex:1,minWidth:"180px"}}>
              <div><div style={{display:"flex",alignItems:"center",gap:"8px"}}><h1 style={{fontWeight:800,fontSize:"22px",color:"var(--fx-text)",margin:"0 0 4px"}}>{eq.nombre}</h1>{eq.filial_de&&<span style={{background:"var(--fx-green-bg)",color:"#16a34a",fontSize:"10px",fontWeight:800,padding:"2px 8px",borderRadius:"20px"}}>Filial de {equipoMap[eq.filial_de]?.nombre||eq.filial_de}</span>}{onToggleFav&&<button onClick={e=>{e.stopPropagation();onToggleFav("equipo",eq.id_equipo);}} title={isFavFn?.("equipo",eq.id_equipo)?"Quitar de favoritos":"Añadir a favoritos"} style={{background:"none",border:"none",cursor:"pointer",fontSize:"20px",padding:0,lineHeight:1,flexShrink:0}}>{isFavFn?.("equipo",eq.id_equipo)?"⭐":"☆"}</button>}</div>{isAdmin&&<span style={{fontSize:"11px",color:"var(--fx-muted2)",fontFamily:"monospace"}}>{eq.id_equipo}</span>}</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {eq.pais&&<Chip><FlagImg country={eq.pais}/>{eq.pais}</Chip>}
                {eq.fiba_rank&&<Chip variant="fiba" title={eq.fiba_zona?`Ranking FIBA (${eq.fiba_zona})`:"Ranking FIBA mundial"} onClick={onGoToTab?(e=>{e.stopPropagation();onGoToTab("ranking_fiba");}):undefined}>🌐 RankFIBA: #{eq.fiba_rank}</Chip>}
                {eq.ciudad&&<Chip>📍 {eq.ciudad}</Chip>}
                {eq.pabellon&&<Chip variant="venue" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eq.ciudad?`${eq.pabellon}, ${eq.ciudad}`:eq.pabellon)}`}>🏟️ {eq.pabellon}</Chip>}
                {eq.año_fundacion&&<Chip variant="year">Est. {eq.año_fundacion}</Chip>}
              </div>
            </div>
            {(()=>{const pal=(palmares||[]).filter(p=>p.id_equipo===eq.id_equipo);if(!pal.length)return null;const counts={};pal.forEach(p=>{const n=ligaMap[p.id_liga]?.nombre||p.id_liga;counts[n]=(counts[n]||0)+1;});return(<div style={{display:"flex",flexDirection:"column",gap:"6px",alignItems:"flex-end",flexShrink:1,minWidth:0,maxWidth:"100%"}}>{Object.entries(counts).map(([nombre,n])=>(<span key={nombre} title={`${n}x ${nombre}`} style={{background:"var(--fx-amber-bg)",border:"1.5px solid #fed7aa",color:"var(--fx-amber-text)",fontSize:"12px",fontWeight:700,padding:"4px 10px",borderRadius:"20px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%",boxSizing:"border-box"}}>🏆 {n}x {nombre}</span>))}</div>);})()}
          </div>
          <div style={{display:"flex",gap:"16px",marginTop:"14px",flexWrap:"wrap",alignItems:"flex-start"}}>
            <div style={{display:"flex",gap:"8px",flex:1,flexWrap:"wrap"}}>
              {[[years.length,"Temporadas"],[new Set(selected.players.map(({player})=>player.id_jugadora)).size,"Jugadoras únicas"],[selected.players.length,"Apariciones"]].map(([v,l])=>(
                <div key={l} style={{background:"var(--fx-hover)",borderRadius:"10px",padding:"8px 12px",textAlign:"center",minWidth:"70px"}}>
                  <div style={{fontSize:"16px",fontWeight:800,color:"var(--fx-text)"}}>{v}</div>
                  <div style={{fontSize:"10px",color:"var(--fx-muted2)",marginTop:"1px"}}>{l}</div>
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
                        style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",cursor:"pointer",padding:isLast?"7px 10px":"5px 8px",borderRadius:"10px",background:isLast?"var(--fx-blue-bg)":"var(--fx-hover)",border:`1.5px solid ${isLast?"#93c5fd":"var(--fx-border)"}`,transition:"all 0.15s"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor="#3b82f6";e.currentTarget.style.background="var(--fx-blue-bg)";}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=isLast?"#93c5fd":"var(--fx-border)";e.currentTarget.style.background=isLast?"var(--fx-blue-bg)":"var(--fx-hover)";}}>
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
        {effectiveYear&&<RecordsEquipo idEquipo={eq.id_equipo} temporada={effectiveYear} players={players} equipos={equipos} onGoToPlayer={onGoToPlayer}/>}
        <CalendarioEquipo idEquipo={eq.id_equipo} temporada={effectiveYear} equipos={equipos} ligas={ligas} equiposNombres={equiposNombres} onGoToPartido={onGoToPartido} onGoToLeague={onGoToLeague}/>
        <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom: showPlantilla?"16px":"0",flexWrap:"wrap",gap:"10px"}}>
            <button onClick={()=>setShowPlantilla(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",padding:0}}>
              <h2 style={{fontWeight:700,fontSize:"17px",color:"var(--fx-text)",margin:0}}>{t("teams.header.plantilla")} <span style={{color:"var(--fx-muted2)",fontWeight:400,fontSize:"14px"}}>({squad.length})</span></h2>
              <span style={{fontSize:"13px",color:"var(--fx-muted2)",transition:"transform 0.2s",display:"inline-block",transform:showPlantilla?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
            </button>
            {showPlantilla&&<div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
              {ligasInYear.length===1&&(()=>{const l=ligasInYear[0];return(
                <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                  <div style={{border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"6px 12px",fontSize:"13px",color:"#9333ea",fontWeight:700,background:"var(--fx-card)",display:"flex",alignItems:"center",gap:"6px"}}>
                    <MultiFlag countries={[l.pais,l.pais2,l.pais3]}/>{l.nombre}
                  </div>
                  <button onClick={()=>onGoToLeague&&onGoToLeague(l.id_liga)} title="Ir a esta liga" aria-label="Ir a esta liga" style={{background:"var(--fx-card)",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"6px 10px",cursor:"pointer",color:"#9333ea",fontSize:"14px",lineHeight:1}}>→</button>
                </div>
              );})()}
              {ligasInYear.length>1&&<div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                <select value={effectiveLiga||""} onChange={e=>setSelLiga(e.target.value)} style={{border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"6px 12px",fontSize:"13px",color:"#9333ea",fontWeight:700,background:"var(--fx-card)",outline:"none"}}>
                  {ligasInYear.map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
                </select>
                <button onClick={()=>onGoToLeague&&onGoToLeague(effectiveLiga)} title="Ir a esta liga" aria-label="Ir a esta liga" style={{background:"var(--fx-card)",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"6px 10px",cursor:"pointer",color:"#9333ea",fontSize:"14px",lineHeight:1}}>→</button>
              </div>}
              {isAdmin&&squad.length>0&&<button onClick={()=>setDupModal({squad,temporada:effectiveYear,sourceLiga:effectiveLiga||(()=>{const ls=[...new Set(squad.map(({season})=>season.id_liga))];return ls.length===1?ls[0]:"";})()})} title="Duplicar plantilla a otra competición" style={{background:"var(--fx-card)",color:"#9333ea",border:"1.5px solid #9333ea",borderRadius:"10px",padding:"7px 12px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>⎘ Duplicar</button>}
              {isAdmin&&<button onClick={()=>setSquadModal({temporada:effectiveYear||"",id_liga:"",id_equipo:eq.id_equipo})} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Jugadora</button>}
              {years.length>0&&<select value={effectiveYear||""} onChange={e=>{setSelYear(e.target.value||null);setSelLiga(null);}} style={{border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"var(--fx-label)",background:"var(--fx-card)",outline:"none"}}>
                {years.map(y=><option key={y} value={y}>{y}</option>)}
              </select>}
            </div>}
          </div>
          {showPlantilla&&(squad.length===0?<div style={{textAlign:"center",padding:"30px",color:"var(--fx-muted2)"}}>{t("teams.no_players_season")}</div>
            :<div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {squad.map(({player},i)=>(
                <div key={i} onClick={()=>onGoToPlayer(player.id_jugadora,{tab:"equipos",id:selId,label:eq?.nombre})}
                  style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 14px",background:"var(--fx-hover)",borderRadius:"12px",border:"1.5px solid var(--fx-border)",cursor:"pointer",transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#c084fc";e.currentTarget.style.background="var(--fx-amber-bg)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--fx-border)";e.currentTarget.style.background="var(--fx-hover)";}}>
                  <Avatar photo={player.foto} name={player.nombre} size={44} fontSize={16} fallecida={!!player.fecha_fallecimiento}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:"14px",color:"#9333ea"}}>{player.nombre}</div>
                    <div style={{fontSize:"12px",color:"var(--fx-muted)",marginTop:"2px",display:"flex",alignItems:"center",gap:"3px"}}>{player.nacionalidad&&<FlagImg country={player.nacionalidad}/>}{player.nacionalidad2&&<FlagImg country={player.nacionalidad2}/>}{player.altura_cm&&<span>{player.nacionalidad||player.nacionalidad2?" · ":""}{player.altura_cm} cm</span>}</div>
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
          <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginTop:"14px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom: showPalmares?"14px":"0"}}>
              <button onClick={()=>setShowPalmares(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",padding:0}}>
                <h2 style={{fontWeight:700,fontSize:"17px",color:"var(--fx-text)",margin:0}}>🏆 {t("teams.header.palmares")} <span style={{color:"var(--fx-muted2)",fontWeight:400,fontSize:"14px"}}>({(palmares||[]).filter(p=>p.id_equipo===eq.id_equipo).length})</span></h2>
                <span style={{fontSize:"13px",color:"var(--fx-muted2)",transition:"transform 0.2s",display:"inline-block",transform:showPalmares?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
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
                        <span style={{background:"var(--fx-amber-border)",color:"var(--fx-amber-text)",fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"20px"}}>{sorted.length}x</span>
                        {isAdmin&&<button onClick={()=>setPalModal("add")} style={{marginLeft:"auto",background:"#9333ea",color:"#fff",border:"none",borderRadius:"8px",padding:"3px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer"}}>+ Título</button>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:"6px",paddingLeft:"8px",borderLeft:"3px solid var(--fx-amber-border)"}}>
                        {sorted.map((p,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                            <div onClick={()=>setSelYear(p.temporada)} style={{flex:1,display:"flex",alignItems:"center",gap:"10px",padding:"6px 12px",background:"var(--fx-amber-bg)",borderRadius:"10px",border:"1.5px solid var(--fx-amber-border)",cursor:"pointer",transition:"all 0.15s"}}
                              onMouseEnter={e=>{e.currentTarget.style.background="var(--fx-amber-hover)";e.currentTarget.style.borderColor="var(--fx-amber-hover-border)";}}
                              onMouseLeave={e=>{e.currentTarget.style.background="var(--fx-amber-bg)";e.currentTarget.style.borderColor="var(--fx-amber-border)";}}>
                              <span style={{fontWeight:700,fontSize:"13px",color:"var(--fx-text)"}}>{p.temporada}</span>
                            </div>
                            {isAdmin&&<><button onClick={()=>setPalModal(p)} aria-label="Editar palmarés" style={{background:"var(--fx-hover)",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"var(--fx-label)"}}>✏️</button>
                            <button onClick={()=>setDelItem({type:"palmares",id:p.id})} style={{background:"var(--fx-red-bg)",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"var(--fx-red-text)"}}>🗑️</button></>}
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
          return(<div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
            {isAdmin&&nombreModal&&<Modal title={nombreModal==="add"?"Añadir nombre histórico":"Editar nombre"} onClose={()=>setNombreModal(null)}>
              <NombreHistoricoForm initial={nombreModal!=="add"?nombreModal:null} onSave={saveNombre} onCancel={()=>setNombreModal(null)} saving={saving}/>
            </Modal>}
            {isAdmin&&delNombreId&&<ConfirmDel msg="¿Eliminar este nombre?" onCancel={()=>setDelNombreId(null)} onConfirm={delNombre}/>}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom: showNombres?"14px":"0"}}>
              <button onClick={()=>setShowNombres(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",padding:0}}>
                <h2 style={{fontWeight:700,fontSize:"17px",color:"var(--fx-text)",margin:0}}>🏷️ Nombres históricos {nombres.length>0&&<span style={{fontSize:"13px",fontWeight:500,color:"var(--fx-muted2)"}}>({nombres.length})</span>}</h2>
                <span style={{fontSize:"13px",color:"var(--fx-muted2)",transition:"transform 0.2s",display:"inline-block",transform:showNombres?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
              </button>
              {isAdmin&&<button onClick={()=>setNombreModal("add")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"6px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Añadir</button>}
            </div>
            {showNombres&&(!nombres.length?<p style={{color:"var(--fx-muted2)",fontSize:"13px",margin:0}}>Sin nombres históricos registrados.</p>:
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {nombres.map(n=>(
                <div key={n.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--fx-hover)",borderRadius:"10px",border:"1px solid var(--fx-border)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                    {n.escudo&&<img loading="lazy" decoding="async" src={n.escudo} alt="" style={{width:32,height:32,objectFit:"contain",borderRadius:"6px",border:"1px solid var(--fx-border)",flexShrink:0}} onError={e=>e.target.style.display="none"}/>}
                    <div>
                      <div style={{fontWeight:700,fontSize:"14px",color:"var(--fx-text)"}}>{n.nombre}</div>
                      <div style={{fontSize:"12px",color:"var(--fx-muted2)"}}>{n.temporada_inicio}{n.temporada_fin?` → ${n.temporada_fin}`:" → actualidad"}</div>
                    </div>
                  </div>
                  {isAdmin&&<div style={{display:"flex",gap:"6px"}}>
                    <button onClick={()=>setNombreModal(n)} aria-label="Editar nombre del equipo" style={{background:"var(--fx-hover)",border:"none",borderRadius:"6px",padding:"4px 8px",fontSize:"12px",cursor:"pointer"}}>✏️</button>
                    <button onClick={()=>setDelNombreId(n.id)} style={{background:"var(--fx-red-bg)",border:"none",borderRadius:"6px",padding:"4px 8px",fontSize:"12px",cursor:"pointer"}}>🗑️</button>
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
        <input style={{flex:"1 1 200px",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",color:"var(--fx-text)",outline:"none",background:"var(--fx-card)",height:"40px",boxSizing:"border-box"}}
          placeholder={t("teams.search")} value={search} onChange={e=>setSearch(e.target.value)}/>
        <select value={filterTipo} onChange={e=>setFilterTipo(e.target.value)} style={{flex:"0 0 auto",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterTipo?"#9333ea":"#475569",background:"var(--fx-card)",outline:"none",height:"40px",fontWeight:filterTipo?700:400}}>
          <option value="">Tipo</option>
          <option value="equipo">🏟️ Clubs</option>
          <option value="seleccion">🌍 Selecciones</option>
        </select>
        <select value={filterLeague} onChange={e=>setFilterLeague(e.target.value)} style={{flex:"0 0 auto",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterLeague?"#9333ea":"#475569",background:"var(--fx-card)",outline:"none",height:"40px",fontWeight:filterLeague?700:400}}>
          <option value="">Liga</option>
          {allLeagues.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterSeason||""} onChange={e=>setFilterSeason(e.target.value||null)} style={{flex:"0 0 auto",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterSeason?"#9333ea":"#475569",background:"var(--fx-card)",outline:"none",height:"40px",fontWeight:filterSeason?700:400}}>
          <option value="">{t("players.filter.season")}</option>
          {allSeasons.map(s=><option key={s} value={s}>{s}{s===latestSeason?" (actual)":""}</option>)}
        </select>
        <PaisDropdown allPaises={allPaisesEq} filterPais={filterPais} setFilterPais={setFilterPais} placeholder="País"/>
      </div>
      {isAdmin&&teamModal==="addTeam"&&<Modal title="Nuevo equipo" onClose={()=>setTeamModal(null)}><TeamForm onSave={saveTeam} onCancel={()=>setTeamModal(null)} saving={saving}/></Modal>}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
        <span style={{fontSize:"13px",color:"var(--fx-muted2)"}}>{filtered.length} equipo{filtered.length!==1?"s":""}</span>
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
                <h2 style={{fontWeight:700,fontSize:"15px",color:"var(--fx-text)",margin:0}}>{label}</h2>
                <span style={{background:"var(--fx-hover)",color:"var(--fx-muted)",fontSize:"12px",fontWeight:600,padding:"2px 10px",borderRadius:"20px"}}>{items.length}</span>
              </div>
              <div className="bfdb-cards-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"12px"}}>
                {items.map(({eq,years:yrs,players:pl})=>{
                  const {bg,light,text:tc}=teamColors(eq.nombre||"");
                  const uniq=new Set(pl.map(({player})=>player.id_jugadora)).size;
                  const latestY=[...yrs].sort((a,b)=>b.localeCompare(a))[0];
                  return(
                    <div key={eq.id_equipo} onClick={()=>{setSelId(eq.id_equipo);setSelYear(null);window.scrollTo({top:0,behavior:"smooth"});}}
                      style={{background:"var(--fx-card)",borderRadius:"16px",padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",border:"2px solid transparent",transition:"all 0.15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=bg;e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.12)";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
                      <div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"12px"}}>
                        <TeamBadge team={eq} size={50}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:"14px",color:"var(--fx-text)",lineHeight:"1.3"}}>{eq.nombre}</div>
                          <div style={{fontSize:"11px",color:"var(--fx-muted2)",marginTop:"2px",display:"flex",alignItems:"center"}}>{eq.ciudad?`${eq.ciudad} · `:""}<FlagImg country={eq.pais||""}/>{eq.pais||""}</div>
                        </div>
                      </div>
                      {eq.año_fundacion&&<div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                        <span style={{background:"var(--fx-amber-bg)",color:"var(--fx-amber-text)",fontSize:"11px",fontWeight:600,padding:"3px 10px",borderRadius:"20px"}}>Est. {eq.año_fundacion}</span>
                      </div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        });
      })()}
      {visibleCount<filtered.length&&(
        <div ref={loadMoreRef} style={{textAlign:"center",padding:"24px",color:"var(--fx-muted2)",fontSize:"13px"}}>
          Mostrando {visibleCount} de {filtered.length}...
        </div>
      )}
    </div>
  );
}

export default TeamsView;
