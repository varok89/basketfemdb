// src/views/CoachesView.jsx
// Extraído de App.jsx (Fase 4 refactor, 2026-09-15).
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useT, locale } from "../lib/i18n";
import {
  inp, firstFreeId,
  resolveTeamName, countryFlagEmoji,
  FlagImg, MultiFlag, TeamBadge, Avatar, PhotoLightbox,
  Fld, Breadcrumbs, Modal, ConfirmDel,
  PaisDropdown, CoachSeasonForm,
} from "../lib/ui";

function CoachForm({initial,players,onSave,onCancel,saving}){
  const [f,setF]=useState({nombre:'',nacionalidad:'',nacionalidad2:'',fecha_nac:'',foto:'',id_jugadora:'',...initial});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const inp={width:'100%',border:'1.5px solid var(--fx-border)',borderRadius:'10px',padding:'9px 12px',fontSize:'14px',outline:'none',boxSizing:'border-box'};
  return(<div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
    <Fld label='Nombre *'><input style={inp} value={f.nombre} onChange={set('nombre')} placeholder='Anna Montañana'/></Fld>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
      <Fld label='Nacionalidad'><input style={inp} value={f.nacionalidad||''} onChange={set('nacionalidad')} placeholder='España'/></Fld>
      <Fld label='2ª Nacionalidad'><input style={inp} value={f.nacionalidad2||''} onChange={set('nacionalidad2')} placeholder='Opcional'/></Fld>
    </div>
    <Fld label='Fecha nacimiento'><input style={inp} type='date' value={f.fecha_nac||''} onChange={set('fecha_nac')}/></Fld>
    <Fld label='Foto (URL)'>
      <div style={{display:'flex',gap:'8px',marginBottom:'6px'}}>
        <button type="button" onClick={()=>setF(p=>({...p,foto:"https://static.flashscore.com/res/image/empty-face-woman-share.gif"}))} style={{background:'var(--fx-hover)',color:'var(--fx-label)',border:'none',borderRadius:'8px',padding:'5px 12px',fontSize:'12px',cursor:'pointer',fontWeight:600}}>🖼️ Default ♀</button>
        <button type="button" onClick={()=>setF(p=>({...p,foto:"https://static.flashscore.com/res/image/empty-face-man-share.gif"}))} style={{background:'var(--fx-hover)',color:'var(--fx-label)',border:'none',borderRadius:'8px',padding:'5px 12px',fontSize:'12px',cursor:'pointer',fontWeight:600}}>🖼️ Default ♂</button>
      </div>
      <input style={inp} value={f.foto||''} onChange={set('foto')} placeholder='https://...'/>
    </Fld>
    <Fld label='Ex jugadora (vincular)'><select style={inp} value={f.id_jugadora||''} onChange={set('id_jugadora')}>
      <option value=''>— Ninguna —</option>
      {(players||[]).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(p=><option key={p.id_jugadora} value={p.id_jugadora}>{p.nombre}</option>)}
    </select></Fld>
    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'8px'}}>
      <button onClick={onCancel} style={{background:'var(--fx-hover)',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
      <button onClick={()=>onSave(f)} disabled={saving||!f.nombre} style={{background:'#9333ea',color:'#fff',border:'none',borderRadius:'10px',padding:'9px 20px',fontWeight:700,cursor:'pointer'}}>{saving?'Guardando...':'Guardar'}</button>
    </div>
  </div>);
}

function CoachesView({coaches,tempCoach,equipos,ligas,players,palmares,onGoToPlayer,onGoToTeam,openCoachId,onClearCoach,isAdmin,onReload,onGoToTab,navHistory,onGoBack,setCoaches,setTempCoach,equiposNombres,regExtra}){
  const t = useT();
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
        <Breadcrumbs items={[
          {label:t("tab.home"),onClick:()=>onGoToTab&&onGoToTab("home")},
          {label:t("tab.cuerpo_tecnico"),onClick:()=>setSelId(null)},
          {label:coach.nombre}
        ]}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <button onClick={()=>{
            const url=`${window.location.origin}/coaches/${coach.id_coach}`;
            const banderasShareCoach=[countryFlagEmoji(coach.nacionalidad),countryFlagEmoji(coach.nacionalidad2)].filter(Boolean).join(" ");
            const shareTextCoach=banderasShareCoach?`${coach.nombre} · ${banderasShareCoach} — La Basketneta`:`Ficha de ${coach.nombre} en La Basketneta`;
            if(navigator.share){navigator.share({title:coach.nombre,text:shareTextCoach,url}).catch(()=>{});}
            else{navigator.clipboard.writeText(url);setShareMsg(true);setTimeout(()=>setShareMsg(false),2000);}
          }} style={{background:"var(--fx-hover)",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"var(--fx-label)"}}>📤 Compartir</button>
          {shareMsg&&<span style={{fontSize:"12px",color:"#16a34a",fontWeight:600}}>¡Enlace copiado!</span>}
          {isAdmin&&<>
          <div style={{display:"flex",gap:"8px"}}>
          <button onClick={()=>setCoachModal(coach)} style={{background:"var(--fx-hover)",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"var(--fx-label)"}}>✏️ Editar</button>
          <button onClick={()=>setDelCoachItem({type:"coach",id:coach.id_coach})} style={{background:"var(--fx-red-bg)",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
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
        <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:"20px",flexWrap:"wrap"}}>
            <Avatar photo={coach.foto} name={coach.nombre} size={80} fontSize={28} onPhotoClick={setLightboxPhoto}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"10px"}}>
                <div><h1 style={{fontWeight:800,fontSize:"21px",color:"var(--fx-text)",margin:0}}>{coach.nombre}</h1>{isAdmin&&<span style={{fontSize:"11px",color:"var(--fx-muted2)",fontFamily:"monospace"}}>{coach.id_coach}</span>}</div>
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
                  return(<div style={{display:"flex",flexDirection:"column",gap:"4px",alignItems:"flex-end",flexShrink:1,minWidth:0,maxWidth:"100%"}}>{entries.map(([n,c])=>(<span key={n} title={`${c}x ${n}`} style={{background:"var(--fx-amber-bg)",border:"1.5px solid #fed7aa",color:"var(--fx-amber-text)",fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"20px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%",boxSizing:"border-box"}}>🏆 {c}x {n}</span>))}</div>);
                })()}
              </div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"10px"}}>
                {isExPlayer&&<span style={{background:"var(--fx-blue-bg)",color:"var(--fx-blue-text)",fontSize:"12px",fontWeight:700,padding:"3px 10px",borderRadius:"20px"}}>{t("players.ex_player")}</span>}
                {(coach.nacionalidad||coach.nacionalidad2)&&(
                  <span style={{background:"var(--fx-hover)",color:"var(--fx-label)",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center",gap:"4px"}}>
                    {coach.nacionalidad&&<FlagImg country={coach.nacionalidad}/>}
                    {coach.nacionalidad2&&<FlagImg country={coach.nacionalidad2}/>}
                  </span>
                )}
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
                <div style={{display:"grid",gridTemplateColumns:"auto auto",gap:"6px 20px",fontSize:"13px",color:"var(--fx-muted)"}}>
                  {age&&<span>Edad: <strong style={{color:"var(--fx-text)"}}>{age} años</strong></span>}
                  <span>Temporadas: <strong style={{color:"var(--fx-text)"}}>{coachSeasons.length}</strong></span>
                </div>
                {isExPlayer&&playerProfile&&(
                  <button onClick={()=>onGoToPlayer(coach.id_jugadora,{tab:"cuerpo_tecnico",id:selId,label:coach?.nombre})}
                    style={{background:"var(--fx-amber-bg)",color:"var(--fx-amber-text)",border:"1.5px solid #fed7aa",borderRadius:"20px",padding:"4px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"4px",flexShrink:0}}>
                    🏀 Jugadora
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Historial unificado */}
        <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          {(()=>{
            const playSeasonsRaw=playerProfile?[...(playerProfile.seasons||[])]:[];
            const playSeasons=playSeasonsRaw.map(s=>({...s,_type:"player"}));
            const coachS=coachSeasons.map(s=>({...s,_type:"coach"}));
            const merged=[...playSeasons,...coachS].sort((a,b)=>b.temporada.localeCompare(a.temporada));
            const hasPlay=playSeasons.length>0;
            const total=merged.length;
            return(
              <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}><h2 style={{fontWeight:700,fontSize:"17px",color:"var(--fx-text)",margin:0}}>{t("players.historial")} <span style={{color:"var(--fx-muted2)",fontWeight:400,fontSize:"14px"}}>({total})</span></h2>{isAdmin&&<button onClick={()=>setSeasonModal("add")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Temporada</button>}</div>
                {hasPlay&&<div style={{display:"flex",gap:"12px",marginBottom:"12px",fontSize:"12px",color:"var(--fx-muted)",alignItems:"center"}}>
                  <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:10,borderRadius:"50%",background:"#9333ea",display:"inline-block"}}/> {t("coaches.as_player")}</span>
                  <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:10,borderRadius:"50%",background:"#3b82f6",display:"inline-block"}}/> {t("coaches.as_coach")}</span>
                </div>}
                {merged.length===0
                  ?<div style={{textAlign:"center",padding:"30px",color:"var(--fx-muted2)",fontSize:"14px"}}>{t("teams.no_seasons")}</div>
                  :<div style={{position:"relative"}}>
                    <div style={{position:"absolute",left:"11px",top:"10px",bottom:"10px",width:"2px",background:hasPlay?"linear-gradient(to bottom,#fed7aa,#bfdbfe)":"var(--fx-blue-border)"}}/>
                    <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                      {merged.map((s,i)=>{
                        const isCoach=s._type==="coach";
                        const eq=equipoMap[s.id_equipo],lig=ligaMap[s.id_liga];
                        const dotColor=isCoach?"#3b82f6":"#9333ea";
                        return(
                          <div key={(isCoach?"c":"p")+s.id} style={{display:"flex",gap:"16px",alignItems:"flex-start",paddingLeft:"32px",position:"relative"}}>
                            <div style={{position:"absolute",left:"6px",top:"14px",width:"12px",height:"12px",borderRadius:"50%",background:dotColor,border:"3px solid #fff",boxShadow:`0 0 0 2px ${dotColor}`}}/>
                            <div style={{flex:1,background:isCoach?"var(--fx-blue-bg)":"var(--fx-hover)",borderRadius:"12px",padding:"12px 14px",border:`1.5px solid ${isCoach?"var(--fx-blue-border)":"var(--fx-border)"}`,cursor:"pointer"}}
                              onClick={()=>onGoToTeam(s.id_equipo,s.temporada,{tab:"cuerpo_tecnico",id:selId,label:coach?.nombre})}
                              onMouseEnter={e=>{e.currentTarget.style.background=isCoach?"var(--fx-blue-bg)":"var(--fx-amber-bg)";e.currentTarget.style.borderColor=isCoach?"#93c5fd":"#c084fc";}}
                              onMouseLeave={e=>{e.currentTarget.style.background=isCoach?"var(--fx-blue-bg)":"var(--fx-hover)";e.currentTarget.style.borderColor=isCoach?"var(--fx-blue-border)":"var(--fx-border)";}}>
                              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                                <TeamBadge team={eq} size={30}/>
                                <div style={{flex:1}}>
                                  <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                                    <span style={{fontWeight:700,fontSize:"14px",color:"var(--fx-text)"}}>{s.temporada} · </span>
                                    <span style={{color:isCoach?"#3b82f6":"#9333ea",fontWeight:700,textDecoration:"underline"}}>{resolveTeamName(s.id_equipo,s.temporada,equiposNombres,equipoMap)||s.id_equipo}</span>
                                    {isCoach&&<span style={{background:"var(--fx-blue-bg)",color:"var(--fx-blue-text)",fontSize:"10px",fontWeight:700,padding:"1px 6px",borderRadius:"20px"}}>📋 Coach</span>}
                                  </div>
                                  <div style={{fontSize:"12px",color:"var(--fx-muted)",marginTop:"2px",display:"flex",alignItems:"center",gap:"4px"}}>{lig&&<MultiFlag countries={[lig.pais,lig.pais2,lig.pais3]}/>}{lig?.nombre||s.id_liga}</div>
                                </div>
                                {isAdmin&&<div style={{display:"flex",gap:"4px",flexShrink:0}} onClick={e=>e.stopPropagation()}>
                                  <button onClick={()=>setSeasonModal(s)} title="Editar" aria-label="Editar temporada" style={{background:"var(--fx-hover)",border:"none",borderRadius:"6px",padding:"4px 8px",fontSize:"12px",cursor:"pointer",color:"var(--fx-label)"}}>✏️</button>
                                  <button onClick={()=>setDelCoachItem({type:"season",id:s.id})} title="Eliminar" style={{background:"var(--fx-red-bg)",border:"none",borderRadius:"6px",padding:"4px 8px",fontSize:"12px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
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
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("coaches.search")}
          style={{flex:"1 1 180px",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",color:"var(--fx-text)",outline:"none",background:"var(--fx-card)",height:"40px",boxSizing:"border-box"}}/>
        <select style={{flex:"0 0 auto",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterLiga?"#9333ea":"#475569",background:"var(--fx-card)",outline:"none",height:"40px",fontWeight:filterLiga?700:400,maxWidth:"100%"}} value={filterLiga} onChange={e=>setFilterLiga(e.target.value)}>
          <option value="">Liga</option>
          {allLigas.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        <PaisDropdown allPaises={allPaisesCoach} filterPais={filterNac} setFilterPais={setFilterNac} placeholder="Nacionalidad"/>
      </div>
      </div>
      {isAdmin&&coachModal==="add"&&<Modal title="Nuevo coach" onClose={()=>setCoachModal(null)}><CoachForm players={players} onSave={saveCoach} onCancel={()=>setCoachModal(null)} saving={saving2}/></Modal>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
        <span style={{fontSize:"13px",color:"var(--fx-muted2)"}}>{filteredList.length} entrenador{filteredList.length!==1?"es":"a"}</span>
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
              style={{background:"var(--fx-card)",borderRadius:"16px",padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",border:"2px solid transparent",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#3b82f6";e.currentTarget.style.boxShadow="0 4px 18px rgba(59,130,246,0.18)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"12px"}}>
                <Avatar photo={coach.foto} name={coach.nombre} size={48} fontSize={18}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:"15px",color:"var(--fx-text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{coach.nombre}</div>
                  <div style={{fontSize:"11px",color:"var(--fx-muted2)",marginTop:"1px",display:"flex",alignItems:"center",gap:"3px"}}>
                    {coach.nacionalidad&&<FlagImg country={coach.nacionalidad}/>}
                    {coach.nacionalidad2&&<FlagImg country={coach.nacionalidad2}/>}
                  </div>
                </div>
                {isExPlayer&&<span style={{background:"var(--fx-blue-bg)",color:"var(--fx-blue-text)",fontSize:"10px",fontWeight:700,padding:"2px 7px",borderRadius:"20px",flexShrink:0}}>{t("players.ex_player").toLowerCase()}</span>}
              </div>
              <div style={{borderTop:"1px solid var(--fx-border2)",paddingTop:"10px"}}>
                {lastEq?(<>
                  <div style={{fontSize:"11px",color:"var(--fx-muted2)",marginBottom:"4px"}}>{t("teams.last_team")}</div>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <TeamBadge team={lastEq} size={26}/>
                    <div>
                      <div style={{fontSize:"13px",fontWeight:600,color:"var(--fx-text)"}}>{lastSeason.temporada} · {lastEq.nombre}</div>
                      <div style={{fontSize:"11px",color:"var(--fx-muted2)"}}>{lastLig?.nombre||lastSeason.id_liga}</div>
                    </div>
                  </div>
                </>):<div style={{fontSize:"12px",color:"#cbd5e1",fontStyle:"italic"}}>{t("players.sin_temporadas")}</div>}
              </div>
              <div style={{marginTop:"10px",fontSize:"12px",color:"#3b82f6",fontWeight:600}}>{coachSeasons.length} temporada{coachSeasons.length!==1?"s":""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export default CoachesView;
