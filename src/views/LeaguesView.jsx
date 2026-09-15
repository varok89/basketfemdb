// src/views/LeaguesView.jsx
// Extraído de App.jsx (Fase 4 refactor, 2026-09-15).
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useT } from "../lib/i18n";
import {
  TIPO_LABELS, TIPO_COLORS,
  inp, firstFreeId,
  FlagImg, MultiFlag, TeamBadge, LeagueBadge,
  Fld, CalendarSubscribeBtn, Breadcrumbs, Modal, ConfirmDel,
  PaisDropdown,
} from "../lib/ui";

function LeagueForm({initial,onSave,onCancel,saving}){
  const [f,setF]=useState({nombre:'',pais:'',pais2:'',pais3:'',nivel:'',tipo:'liga',logo:'',...initial});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:'100%',border:'1.5px solid var(--fx-border)',borderRadius:'10px',padding:'9px 12px',fontSize:'14px',outline:'none',boxSizing:'border-box'};
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
      <button onClick={onCancel} style={{background:'var(--fx-hover)',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.nombre} style={{background:'#9333ea',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
    </div>
  </div>);
}

function RecordsLiga({idLiga, temporada, players, equipos, onGoToPlayer, onGoToTeam}){
  const t = useT();
  const [rows,setRows]=useState(null);
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    if(!idLiga||!temporada)return;
    let cancel=false; setRows(null);
    (async()=>{
      const {data}=await supabase.from("partido_boxscore")
        .select("id_jugadora,id_equipo,puntos,reb_totales,asistencias,valoracion,partidos!inner(id,temporada,id_liga)")
        .eq("partidos.id_liga",idLiga).eq("partidos.temporada",temporada);
      if(cancel)return;
      setRows(data||[]);
    })();
    return ()=>{cancel=true;};
  },[idLiga,temporada]);

  const records=useMemo(()=>{
    if(!rows||!rows.length)return null;
    const byPlayer={};
    rows.forEach(r=>{
      const k=r.id_jugadora; if(!k)return;
      if(!byPlayer[k]) byPlayer[k]={id_jugadora:k,id_equipo:r.id_equipo,pj:0,pts:0,reb:0,ast:0,val:0};
      const b=byPlayer[k];
      b.pj++; b.pts+=Number(r.puntos)||0; b.reb+=Number(r.reb_totales)||0;
      b.ast+=Number(r.asistencias)||0; b.val+=Number(r.valoracion)||0;
      if(!b.id_equipo)b.id_equipo=r.id_equipo;
    });
    const avg=(field)=>Object.values(byPlayer).filter(b=>b.pj>=3).map(b=>({...b,v:b[field]/b.pj})).sort((a,b)=>b.v-a.v)[0]||null;
    const topGame=[...rows].sort((a,b)=>(Number(b.puntos)||0)-(Number(a.puntos)||0))[0];
    return {
      pts: avg("pts"),
      reb: avg("reb"),
      ast: avg("ast"),
      val: avg("val"),
      topGame,
    };
  },[rows]);

  const playerMap=useMemo(()=>{const m={};(players||[]).forEach(p=>m[p.id_jugadora]=p);return m;},[players]);
  const eqMap=useMemo(()=>{const m={};(equipos||[]).forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);

  if(rows===null)return null;

  const card=(label,r,valueLabel)=>{
    if(!r)return null;
    const p=playerMap[r.id_jugadora];
    const eq=eqMap[r.id_equipo];
    return (
      <div style={{background:"var(--fx-hover)",borderRadius:"12px",padding:"12px",display:"flex",flexDirection:"column",gap:"6px",cursor:p?"pointer":"default"}} onClick={()=>p&&onGoToPlayer&&onGoToPlayer(p.id_jugadora)}>
        <div style={{fontSize:"10px",fontWeight:800,color:"#9333ea",textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          {p?.foto?<img loading="lazy" decoding="async" src={p.foto} alt="" style={{width:32,height:32,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:32,height:32,borderRadius:"50%",background:"var(--fx-border)"}}/>}
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontSize:"13px",fontWeight:700,color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p?.nombre||r.id_jugadora}</div>
            {eq&&<div style={{fontSize:"10px",color:"var(--fx-muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{eq.nombre}</div>}
          </div>
          <div style={{fontSize:"20px",fontWeight:900,color:"var(--fx-text)",flexShrink:0}}>{valueLabel}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"20px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
      <button onClick={()=>setOpen(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",padding:0,width:"100%",marginBottom:open?"12px":0}}>
        <h2 style={{fontWeight:700,fontSize:"17px",color:"var(--fx-text)",margin:0}}>{t("records.title")} <span style={{fontSize:"13px",fontWeight:500,color:"var(--fx-muted2)"}}>· {temporada}</span></h2>
        <span style={{fontSize:"13px",color:"var(--fx-muted2)",display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
      </button>
      {open&&(!records?(
        <div style={{fontSize:"13px",color:"var(--fx-muted)",textAlign:"center",padding:"20px 0"}}>Aún no hay estadísticas de esta temporada.</div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:"10px"}}>
          {card(t("records.pts"),records.pts,records.pts?records.pts.v.toFixed(1):"—")}
          {card(t("records.reb"),records.reb,records.reb?records.reb.v.toFixed(1):"—")}
          {card(t("records.ast"),records.ast,records.ast?records.ast.v.toFixed(1):"—")}
          {card(t("records.val"),records.val,records.val?records.val.v.toFixed(1):"—")}
          {records.topGame&&card(t("records.top_game"),{id_jugadora:records.topGame.id_jugadora,id_equipo:records.topGame.id_equipo},records.topGame.puntos+" pts")}
        </div>
      ))}
    </div>
  );
}

function CampeonesPorTemporada({pal, equipoMap, effectiveYear, selId, selectedNombre, onGoToTeam}){
  const [open,setOpen]=useState(false);
  return (
    <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginTop:"14px"}}>
      <button onClick={()=>setOpen(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",padding:0,width:"100%",marginBottom:open?"14px":0}}>
        <h2 style={{fontWeight:700,fontSize:"17px",color:"var(--fx-text)",margin:0}}>🏆 Campeones por temporada <span style={{color:"var(--fx-muted2)",fontWeight:400,fontSize:"14px"}}>({pal.length})</span></h2>
        <span style={{fontSize:"13px",color:"var(--fx-muted2)",display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
      </button>
      {open&&<div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        {pal.map((p,i)=>{
          const eq=equipoMap[p.id_equipo];
          return(
            <div key={i} onClick={()=>onGoToTeam(eq?.id_equipo,effectiveYear,{tab:"ligas",id:selId,label:selectedNombre})}
              style={{display:"flex",alignItems:"center",gap:"14px",padding:"10px 14px",background:"var(--fx-amber-bg)",borderRadius:"12px",border:"1.5px solid var(--fx-amber-border)",cursor:"pointer",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="var(--fx-amber-hover)";e.currentTarget.style.borderColor="var(--fx-amber-hover-border)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="var(--fx-amber-bg)";e.currentTarget.style.borderColor="var(--fx-amber-border)";}}>
              <span style={{fontWeight:800,fontSize:"14px",color:"var(--fx-amber-text)",minWidth:"72px"}}>{p.temporada}</span>
              <TeamBadge team={eq} size={32}/>
              <span style={{fontWeight:700,fontSize:"14px",color:"var(--fx-text)"}}>{eq?.nombre||p.id_equipo}</span>
              {eq?.pais&&<span style={{marginLeft:"auto",display:"flex",alignItems:"center"}}><FlagImg country={eq.pais}/></span>}
            </div>
          );
        })}
      </div>}
    </div>
  );
}

function LeaguesView({ligas,players,equipos,palmares,coaches,tempCoach,partidos,onGoToTeam,onGoToPlayer,onGoToClasificacion,isAdmin,onReload,openLigaId,onClearLiga,onGoToTab,navHistory,onGoBack,setLigas,regExtra,isFavFn,onToggleFav}){
  const t = useT();
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
        <Breadcrumbs items={[
          {label:t("tab.home"),onClick:()=>onGoToTab&&onGoToTab("home")},
          {label:t("tab.ligas"),onClick:()=>{setSelId(null);setSelYear(null);}},
          {label:selected.nombre}
        ]}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",flexWrap:"wrap",gap:"8px"}}>
          <CalendarSubscribeBtn tipo="liga" id={selected.id_liga} temporada={effectiveYear}/>
          {isAdmin&&<div style={{display:"flex",gap:"8px"}}>
            <button onClick={()=>setLigaModal("edit")} style={{background:"var(--fx-hover)",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"var(--fx-label)"}}>✏️ Editar</button>
            <button onClick={()=>setDelLiga(true)} style={{background:"var(--fx-red-bg)",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
          </div>}
        </div>
        {isAdmin&&delLiga&&<ConfirmDel msg="¿Eliminar esta liga?" onCancel={()=>setDelLiga(false)} onConfirm={delLigaFn}/>}
        {isAdmin&&ligaModal&&<Modal title={ligaModal==="add"?"Nueva liga":"Editar liga"} onClose={()=>setLigaModal(null)}>
          <LeagueForm initial={ligaModal!=="add"?selected:null} onSave={saveLiga} onCancel={()=>setLigaModal(null)} saving={saving}/>
        </Modal>}
        <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"20px",flexWrap:"wrap"}}>
            <LeagueBadge liga={selected} size={72}/>
            <div style={{flex:1,minWidth:"180px"}}>
              <div><div style={{display:"flex",alignItems:"center",gap:"8px"}}><h1 style={{fontWeight:800,fontSize:"22px",color:"var(--fx-text)",margin:"0 0 4px"}}>{selected.nombre}</h1>{onToggleFav&&<button onClick={e=>{e.stopPropagation();onToggleFav("liga",selected.id_liga);}} title={isFavFn?.("liga",selected.id_liga)?"Quitar de favoritos":"Añadir a favoritos"} style={{background:"none",border:"none",cursor:"pointer",fontSize:"20px",padding:0,lineHeight:1,flexShrink:0}}>{isFavFn?.("liga",selected.id_liga)?"⭐":"☆"}</button>}</div>{isAdmin&&<span style={{fontSize:"11px",color:"var(--fx-muted2)",fontFamily:"monospace"}}>{selected.id_liga}</span>}</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {selected.pais&&<span style={{background:"var(--fx-hover)",color:"var(--fx-label)",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center"}}><FlagImg country={selected.pais}/>{selected.pais}</span>}
                {selected.pais2&&<span style={{background:"var(--fx-hover)",color:"var(--fx-label)",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center"}}><FlagImg country={selected.pais2}/>{selected.pais2}</span>}
                {selected.pais3&&<span style={{background:"var(--fx-hover)",color:"var(--fx-label)",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center"}}><FlagImg country={selected.pais3}/>{selected.pais3}</span>}
                {selected.tipo&&<span style={{background:bg,color,fontSize:"12px",fontWeight:700,padding:"3px 10px",borderRadius:"20px"}}>{TIPO_LABELS[selected.tipo]||selected.tipo}</span>}
                {selected.nivel&&<span style={{background:"var(--fx-hover)",color:"var(--fx-muted)",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px"}}>División {selected.nivel}</span>}
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginTop:"18px"}}>
            {[[years.length,"Temporadas registradas"],[teamsInLeague.length,`Equipos ${effectiveYear||""}`],[playersInYear.size,`Jugadoras ${effectiveYear||""}`]].map(([v,l])=>(
              <div key={l} style={{background:"var(--fx-hover)",borderRadius:"12px",padding:"12px",textAlign:"center"}}>
                <div style={{fontSize:"22px",fontWeight:800,color:"var(--fx-text)"}}>{v}</div>
                <div style={{fontSize:"11px",color:"var(--fx-muted2)",marginTop:"2px"}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        {effectiveYear&&<RecordsLiga idLiga={selected.id_liga} temporada={effectiveYear} players={players} equipos={equipos} onGoToPlayer={onGoToPlayer} onGoToTeam={onGoToTeam}/>}
        <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}}>
            <h2 style={{fontWeight:700,fontSize:"17px",color:"var(--fx-text)",margin:0}}>Equipos <span style={{color:"var(--fx-muted2)",fontWeight:400,fontSize:"14px"}}>({teamsInLeague.length})</span></h2>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              {(partidos||[]).some(p=>p.id_liga===selId&&(p.temporada||"")===(effectiveYear||""))&&(
                <button onClick={()=>onGoToClasificacion&&onGoToClasificacion(selId,effectiveYear)}
                  style={{background:"#f5f3ff",color:"#7c3aed",border:"1.5px solid #ddd6fe",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",fontWeight:700,cursor:"pointer"}}>
                  🏆 Clasificación
                </button>
              )}
              {years.length>0&&<select value={effectiveYear||""} onChange={e=>setSelYear(e.target.value||null)} style={{border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"var(--fx-label)",background:"var(--fx-card)",outline:"none"}}>
                {years.map(y=><option key={y} value={y}>{y}{y===latestYear?" (actual)":""}</option>)}
              </select>}
            </div>
          </div>
          {teamsInLeague.length===0
            ?<div style={{textAlign:"center",padding:"40px",color:"var(--fx-muted2)"}}><div style={{fontSize:"32px",marginBottom:"10px"}}>🏟️</div><div>{t("teams.no_teams_season")}</div></div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"10px"}}>
              {teamsInLeague.map(eq=>{
                const esCampeon=(palmares||[]).some(p=>p.id_liga===selId&&p.id_equipo===eq.id_equipo&&p.temporada===effectiveYear);
                return(
                <div key={eq.id_equipo} onClick={()=>onGoToTeam(eq.id_equipo,effectiveYear,{tab:"ligas",id:selId,label:selected?.nombre})}
                  style={{background:esCampeon?"var(--fx-amber-bg)":"var(--fx-hover)",borderRadius:"14px",padding:"14px",border:esCampeon?"1.5px solid #fbbf24":"1.5px solid var(--fx-border)",display:"flex",alignItems:"center",gap:"12px",cursor:"pointer",transition:"all 0.15s",position:"relative"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#c084fc";e.currentTarget.style.background="var(--fx-amber-bg)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=esCampeon?"#fbbf24":"var(--fx-border)";e.currentTarget.style.background=esCampeon?"var(--fx-amber-bg)":"var(--fx-hover)";}}>
                  <TeamBadge team={eq} size={40}/>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:"13px",color:"#9333ea",lineHeight:"1.3",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{eq.nombre}</div>
                    <div style={{fontSize:"11px",color:"var(--fx-muted2)",marginTop:"2px",display:"flex",alignItems:"center"}}><FlagImg country={eq.pais||""}/>{eq.pais||""}</div>
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
          return <CampeonesPorTemporada pal={pal} equipoMap={equipoMap} effectiveYear={effectiveYear} selId={selId} selectedNombre={selected?.nombre} onGoToTeam={onGoToTeam}/>;
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
        <input style={{flex:"1 1 180px",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",color:"var(--fx-text)",outline:"none",background:"var(--fx-card)",height:"40px",boxSizing:"border-box"}}
          placeholder={t("leagues.search")} value={search} onChange={e=>setSearch(e.target.value)}/>
        <select value={filterTipoLiga} onChange={e=>setFilterTipoLiga(e.target.value)} style={{flex:"0 0 auto",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterTipoLiga?"#9333ea":"#475569",background:"var(--fx-card)",outline:"none",height:"40px",fontWeight:filterTipoLiga?700:400,maxWidth:"100%"}}>
          <option value="">Tipo</option>
          <option value="liga">Liga</option>
          <option value="copadom">Copa Nacional</option>
          <option value="copacont">Copa Continental</option>
          <option value="internacional">Internacional</option>
        </select>
        <PaisDropdown allPaises={allPaisesLiga} filterPais={filterPais} setFilterPais={setFilterPais} placeholder="País"/>
        {isAdmin&&<button onClick={()=>setLigaModal("add")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"10px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer",whiteSpace:"nowrap"}}>+ Liga</button>}
      </div>
      {GRUPOS.map(([tipo,label])=>{
        const items=ligasByTipo[tipo]||[];
        if(!items.length) return null;
        const [bg,color]=TIPO_COLORS[tipo]||["#f1f5f9","#475569"];
        return(
          <div key={tipo} style={{marginBottom:"24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
              <span style={{background:bg,color,fontSize:"12px",fontWeight:700,padding:"4px 12px",borderRadius:"20px"}}>{label}</span>
              <span style={{fontSize:"12px",color:"var(--fx-muted2)"}}>{items.length} competición{items.length!==1?"es":""}</span>
            </div>
            <div className="bfdb-cards-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"10px"}}>
              {items.map(l=>{
                const paises=[l.pais,l.pais2,l.pais3].filter(Boolean);
                return(
                  <div key={l.id_liga} onClick={()=>{setSelId(l.id_liga);setSelYear(null);window.scrollTo({top:0,behavior:"smooth"});}}
                    style={{background:"var(--fx-card)",borderRadius:"16px",padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",border:"2px solid transparent",transition:"all 0.15s",display:"flex",alignItems:"center",gap:"14px"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.10)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
                    <LeagueBadge liga={l} size={52}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:"14px",color:"var(--fx-text)",lineHeight:"1.3"}}>{l.nombre}</div>
                      <div style={{fontSize:"12px",color:"var(--fx-muted)",marginTop:"4px",display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                        <MultiFlag countries={[l.pais,l.pais2,l.pais3]}/>
                        <span>{paises.length?paises.join(" · "):"—"}</span>
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
    </div>
  );
}

export default LeaguesView;
