import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qvtxqckuolacvnvrvysu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dHhxY2t1b2xhY3ZudnJ2eXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzQ3OTYsImV4cCI6MjA5MzgxMDc5Nn0.0B93gvnlkGPTstRQKskzvUQOdDHeQ1vr2dwS97lhCjQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const POSITIONS  = ["Base","Escolta","Alero","Ala-Pívot","Pívot"];
const TIPO_LABELS = { liga:"Liga", copacont:"Copa Continental", copadom:"Copa Nacional" };
const TIPO_COLORS = {
  liga:    ["#dbeafe","#1d4ed8"],
  copacont:["#f3e8ff","#7c3aed"],
  copadom: ["#dcfce7","#15803d"],
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
  "espana":"es","spain":"es","france":"fr","francia":"fr","italy":"it","italia":"it",
  "germany":"de","alemania":"de",  "usa":"us","eeuu":"us","ee.uu.":"us","estados unidos":"us",
  "turkey":"tr","turquia":"tr","turquía":"tr","russia":"ru","rusia":"ru",
  "hungary":"hu","hungria":"hu","hungría":"hu","greece":"gr","grecia":"gr",
  "israel":"il","australia":"au","sweden":"se","suecia":"se","china":"cn",
  "romania":"ro","rumania":"ro","rumanía":"ro","switzerland":"ch","suiza":"ch",
  "united kingdom":"gb","reino unido":"gb","iceland":"is","islandia":"is",
  "portugal":"pt","brasil":"br","brazil":"br","argentina":"ar","serbia":"rs",
  "poland":"pl","polonia":"pl","belgium":"be","belgica":"be","bélgica":"be",
  "netherlands":"nl","paises bajos":"nl","países bajos":"nl","holanda":"nl",
  "croatia":"hr","croacia":"hr","denmark":"dk","dinamarca":"dk",
  "norway":"no","noruega":"no","finland":"fi","finlandia":"fi",
  "canada":"ca","nigeria":"ng","senegal":"sn","japan":"jp","japon":"jp","japón":"jp",
  "lithuania":"lt","lituania":"lt","latvia":"lv","letonia":"lv","estonia":"ee",
  "ukraine":"ua","ucrania":"ua","ireland":"ie","irlanda":"ie",
  "mali":"ml","mozambique":"mz","guyana":"gy","haiti":"ht",
  "cuba":"cu","mexico":"mx","méxico":"mx","uganda":"ug",
  "slovenia":"si","eslovenia":"si","slovakia":"sk","eslovaquia":"sk",
  "montenegro":"me","north macedonia":"mk","macedonia":"mk","bulgaria":"bg",
  "morocco":"ma","marruecos":"ma","ghana":"gh","cameroon":"cm","camerún":"cm",
  "dominica":"dm","angola":"ao","kenya":"ke",
  "azerbaiyan":"az","azerbaiyán":"az","azerbaijan":"az","azerbaidjan":"az",
  "tunez":"tn","tunisia":"tn","tunicia":"tn","tunisie":"tn","tunisian":"tn",
  "czech republic":"cz","republica checa":"cz","república checa":"cz","r. checa":"cz",
  "austria":"at","moldova":"md","albania":"al","kosovo":"xk","belarus":"by","bielorrusia":"by",
  "venezuela":"ve","colombia":"co","peru":"pe","perú":"pe","chile":"cl","uruguay":"uy","bolivia":"bo",
  "ivory coast":"ci","costa de marfil":"ci","south korea":"kr","corea del sur":"kr",
  "japan":"jp","ethiopia":"et","etiopía":"et",
};

function countryCode(c) {
  if (!c) return null;
  return COUNTRY_CODES[c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim()] || null;
}

function FlagImg({ country }) {
  const code = countryCode(country);
  if (!code) return null;
  return <img src={`https://flagpedia.net/data/flags/w160/${code}.webp`} width={20} height={13} alt={country}
    style={{display:"inline-block",verticalAlign:"middle",borderRadius:"2px",flexShrink:0,marginRight:"4px"}}/>;
}

/* ── Equipo ──────────────────────────────────────────────── */
function teamHue(s=""){let h=0;for(const c of s)h=(h<<5)-h+c.charCodeAt(0);return Math.abs(h)%360;}
function teamColors(n){const h=teamHue(n);return{bg:`hsl(${h},55%,38%)`,light:`hsl(${h},55%,92%)`,text:`hsl(${h},55%,25%)`};}
function teamInitials(n=""){return n.split(/[\s\-\_]+/).map(w=>w[0]?.toUpperCase()||"").slice(0,3).join("");}

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
  <div style={{position:"fixed",inset:0,zIndex:50,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
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
  <div style={{position:"fixed",inset:0,zIndex:50,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
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
  const ref=useRef();
  const handleFile=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>3*1024*1024){alert("Máx 3 MB");return;}onChange(await toBase64(f));};
  return(
    <div style={{marginBottom:"16px"}}>
      <label style={{display:"block",fontSize:"12px",fontWeight:700,color:"#64748b",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Foto</label>
      <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
        {value?<img src={value} alt="" style={{width:60,height:60,borderRadius:"50%",objectFit:"cover",border:"3px solid #fb923c"}}/>
          :<div style={{width:60,height:60,borderRadius:"50%",background:"#f1f5f9",border:"2px dashed #cbd5e1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"22px"}}>🖼️</div>}
        <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
          <button type="button" onClick={()=>ref.current.click()} style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"7px 12px",fontSize:"12px",color:"#475569",cursor:"pointer",fontWeight:600}}>📷 {value?"Cambiar":"Subir"}</button>
          {value&&<button type="button" onClick={()=>onChange(null)} style={{background:"none",border:"none",fontSize:"11px",color:"#ef4444",cursor:"pointer",padding:0}}>Eliminar</button>}
        </div>
        <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
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
  const [f,setF]=useState({nombre:"",posicion:"Base",nacionalidad:"",fecha_nac:"",altura_cm:"",foto:null,...initial});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  return(<div>
    <PhotoPicker value={f.foto} onChange={v=>setF(p=>({...p,foto:v}))}/>
    <Fld label="Nombre *"><input style={inp} value={f.nombre} onChange={set("nombre")} placeholder="Ej: Claudia Soriano"/></Fld>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
      <Fld label="Posición"><select style={inp} value={f.posicion} onChange={set("posicion")}>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></Fld>
      <Fld label="Altura (cm)"><input style={inp} type="number" value={f.altura_cm} onChange={set("altura_cm")} placeholder="180"/></Fld>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
      <Fld label="Nacionalidad"><input style={inp} value={f.nacionalidad} onChange={set("nacionalidad")} placeholder="España"/></Fld>
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
  return(<div>
    <Fld label="Temporada *"><input style={inp} value={f.temporada} onChange={e=>setF(p=>({...p,temporada:e.target.value}))} placeholder="2024-25"/></Fld>
    <Fld label="Equipo *">
      <select style={inp} value={f.id_equipo} onChange={e=>setF(p=>({...p,id_equipo:e.target.value}))}>
        <option value="">— Selecciona equipo —</option>
        {[...equipos].sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(e=><option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>)}
      </select>
    </Fld>
    <Fld label="Competición *">
      <select style={inp} value={f.id_liga} onChange={e=>setF(p=>({...p,id_liga:e.target.value}))}>
        <option value="">— Selecciona competición —</option>
        {ligas.map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
      </select>
    </Fld>
    <div style={{display:"flex",gap:"10px",marginTop:"8px"}}>
      <button onClick={onCancel} style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"11px",color:"#64748b",background:"#fff",cursor:"pointer",fontWeight:600}}>Cancelar</button>
      <button onClick={()=>ok&&onSave(f)} disabled={saving||!ok} style={{flex:1,background:ok?"#f97316":"#fed7aa",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",cursor:ok?"pointer":"not-allowed",fontWeight:700}}>{saving?"Guardando...":"Guardar"}</button>
    </div>
  </div>);}

/* ── PlayersView ─────────────────────────────────────────── */
function PlayersView({players,equipos,ligas,onReload,onGoToTeam,openPlayerId,onClearPlayer}){
  const [search,setSearch]         = useState("");
  const [filterPos,setFilterPos]   = useState("");
  const [selId,setSelId]           = useState(openPlayerId||null);
  const [modal,setModal]           = useState(null);
  const [editSeason,setEditSeason] = useState(null);
  const [del,setDel]               = useState(null);
  const [saving,setSaving]         = useState(false);
  const [activeTipo,setActiveTipo] = useState(null);
  const photoRef = useRef();

  useEffect(()=>{if(openPlayerId){setSelId(openPlayerId);onClearPlayer();}},[openPlayerId]);

  const equipoMap = useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap   = useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);

  // Palmarés del equipo seleccionado
  const teamPalmares = useMemo(()=>{
    if(!selId) return [];
    return (palmares||[]).filter(p=>p.id_equipo===selId).sort((a,b)=>b.temporada.localeCompare(a.temporada));
  },[selId,palmares]);
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

  const filtered = players.filter(p=>{
    const q=search.toLowerCase();
    return(!q||p.nombre?.toLowerCase().includes(q)||p.id_jugadora?.toLowerCase().includes(q)||p.nacionalidad?.toLowerCase().includes(q)||p.seasons?.some(s=>equipoMap[s.id_equipo]?.nombre?.toLowerCase().includes(q)))
      &&(!filterPos||p.posicion===filterPos);
  }).sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||"","es"));

  const addPlayer=async f=>{
    setSaving(true);
    try{const{data}=await supabase.from("jugadoras").select("id_jugadora").order("id_jugadora",{ascending:false}).limit(1);
      const newId=`J${String(parseInt((data?.[0]?.id_jugadora||"J000").slice(1))+1).padStart(3,"0")}`;
      await supabase.from("jugadoras").insert({id_jugadora:newId,nombre:f.nombre,posicion:f.posicion,nacionalidad:f.nacionalidad,fecha_nac:f.fecha_nac||null,altura_cm:f.altura_cm?parseInt(f.altura_cm):null,foto:f.foto||null});
      await onReload();setModal(null);}catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const updPlayer=async f=>{
    setSaving(true);
    try{await supabase.from("jugadoras").update({nombre:f.nombre,posicion:f.posicion,nacionalidad:f.nacionalidad,fecha_nac:f.fecha_nac||null,altura_cm:f.altura_cm?parseInt(f.altura_cm):null,foto:f.foto||null}).eq("id_jugadora",selId);
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
    try{await supabase.from("temporadas").insert({id_jugadora:selId,id_equipo:f.id_equipo,id_liga:f.id_liga,temporada:f.temporada});
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

  if(players.length===0) return <EmptyState icon="👩‍🏀" text="No hay jugadoras" sub="Verifica la conexión con Supabase"/>;

  if(selected) return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"20px"}}>
      <button onClick={()=>{setSelId(null);setActiveTipo(null);}} style={{background:"none",border:"none",color:"#fb923c",fontSize:"15px",cursor:"pointer",marginBottom:"12px",fontWeight:600,padding:0}}>← Volver</button>

      <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:"20px"}}>
          <Avatar photo={selected.foto} name={selected.nombre} size={90} fontSize={30}/>
          <div style={{flex:1}}>
            <h1 style={{fontWeight:800,fontSize:"21px",color:"#1e293b",margin:"0 0 8px"}}>{selected.nombre}</h1>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"12px"}}>
              {selected.posicion&&<span style={posStyle(selected.posicion)}>{selected.posicion}</span>}
              {selected.nacionalidad&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center"}}><FlagImg country={selected.nacionalidad}/>{selected.nacionalidad}</span>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
              {selected.altura_cm&&<div style={{fontSize:"13px"}}><span style={{color:"#94a3b8"}}>Altura: </span><span style={{fontWeight:600,color:"#334155"}}>{selected.altura_cm} cm</span></div>}
              {selected.fecha_nac&&<div style={{fontSize:"13px"}}><span style={{color:"#94a3b8"}}>Edad: </span><span style={{fontWeight:600,color:"#334155"}}>{calcAge(selected.fecha_nac)} años</span></div>}
            </div>
          </div>
        </div>
      </div>
      <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"10px"}}>
          <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:"0 0 14px"}}>Historial <span style={{color:"#94a3b8",fontWeight:400,fontSize:"14px"}}>({selected.seasons.length})</span></h2>
          <button onClick={()=>setModal("addSeason")} style={{background:"#f97316",color:"#fff",border:"none",borderRadius:"10px",padding:"8px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Temporada</button>
        </div>
        {playerTipos.length>1&&(
          <div style={{marginBottom:"16px",paddingBottom:"14px",borderBottom:"1px solid #f1f5f9"}}>
            <select value={currentTipo||""} onChange={e=>setActiveTipo(e.target.value||null)}
              style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none",width:"100%"}}>
              <option value="">Todas las competiciones</option>
              {playerTipos.map(t=><option key={t} value={t}>{TIPO_LABELS[t]||t}</option>)}
            </select>
          </div>
        )}
        {filteredSeasons.length===0
          ?<div style={{textAlign:"center",padding:"30px",color:"#94a3b8",fontSize:"14px"}}>Sin temporadas para esta competición</div>
          :<div style={{position:"relative"}}>
            <div style={{position:"absolute",left:"11px",top:"10px",bottom:"10px",width:"2px",background:"#fed7aa"}}/>
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {filteredSeasons.map((s,i)=>{
                const eq=equipoMap[s.id_equipo],lig=ligaMap[s.id_liga];
                return(
                  <div key={s.id} style={{display:"flex",gap:"16px",alignItems:"flex-start",paddingLeft:"32px",position:"relative"}}>
                    <div style={{position:"absolute",left:"6px",top:"14px",width:"12px",height:"12px",borderRadius:"50%",background:i===0?"#f97316":"#fdba74",border:"3px solid #fff",boxShadow:`0 0 0 2px ${i===0?"#f97316":"#fdba74"}`}}/>
                    <div style={{flex:1,background:"#f8fafc",borderRadius:"12px",padding:"12px 14px",border:"1.5px solid #e2e8f0"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"10px",cursor:"pointer"}} onClick={()=>onGoToTeam(s.id_equipo)}>
                          <TeamBadge team={eq} size={30}/>
                          <div>
                            <div style={{fontWeight:700,fontSize:"14px",color:"#1e293b"}}>{s.temporada} · <span style={{color:"#f97316",textDecoration:"underline"}}>{eq?.nombre||s.id_equipo}</span></div>
                            <div style={{fontSize:"12px",color:"#64748b",marginTop:"2px",display:"flex",alignItems:"center",gap:"4px"}}>
                              {eq?.pais&&<FlagImg country={eq.pais}/>}{lig?.nombre||s.id_liga}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>}
      </div>

    </div>
  );

  return(
    <div style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px",marginBottom:"20px"}}>
        {[["👩‍🏀",players.length,"Jugadoras"],["📋",players.reduce((n,p)=>n+(p.seasons?.length||0),0),"Temporadas"],["🌍",new Set(players.flatMap(p=>(p.seasons||[]).map(s=>s.id_equipo))).size,"Equipos únicos"]].map(([e,v,l])=>(
          <div key={l} style={{background:"#fff",borderRadius:"14px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",textAlign:"center"}}>
            <div style={{fontSize:"20px",marginBottom:"4px"}}>{e}</div>
            <div style={{fontSize:"24px",fontWeight:800,color:"#1e293b"}}>{v}</div>
            <div style={{fontSize:"12px",color:"#94a3b8"}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap"}}>
        <input style={{flex:1,minWidth:"180px",border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"14px",color:"#1e293b",outline:"none",background:"#fff"}}
          placeholder="🔍 Nombre, equipo..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={{border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none"}} value={filterPos} onChange={e=>setFilterPos(e.target.value)}>
          <option value="">Todas las posiciones</option>
          {POSITIONS.map(p=><option key={p}>{p}</option>)}
        </select>
      </div>
      <div style={{fontSize:"13px",color:"#94a3b8",marginBottom:"12px"}}>{filtered.length} jugadora{filtered.length!==1?"s":""}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"12px"}}>
        {filtered.map(p=>{
          const allS=sortS(p.seasons||[]);
          const last=allS.find(s=>ligaMap[s.id_liga]?.tipo==="liga")||allS[0];
          const lastEq=last?equipoMap[last.id_equipo]:null;
          return(
            <div key={p.id_jugadora} onClick={()=>{setSelId(p.id_jugadora);setActiveTipo(null);}}
              style={{background:"#fff",borderRadius:"16px",padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",border:"2px solid transparent",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#fb923c";e.currentTarget.style.boxShadow="0 4px 18px rgba(249,115,22,0.18)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"12px"}}>
                <Avatar photo={p.foto} name={p.nombre} size={48} fontSize={18}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:"15px",color:"#1e293b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.nombre}</div>
                  <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"1px",display:"flex",alignItems:"center"}}><FlagImg country={p.nacionalidad||""}/>{p.nacionalidad||"—"}{p.altura_cm?` · ${p.altura_cm} cm`:""}</div>
                </div>
                {p.posicion&&<span style={posStyle(p.posicion)}>{p.posicion}</span>}
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

/* ── TeamsView ───────────────────────────────────────────── */
function TeamsView({equipos,players,ligas,palmares,onGoToPlayer,openTeamId,onClearTeam}){
  const [search,setSearch]             = useState("");
  const [filterLeague,setFilterLeague] = useState("");
  const [filterSeason,setFilterSeason] = useState(null);
  const [selId,setSelId]               = useState(openTeamId||null);
  const [selYear,setSelYear]           = useState(null);

  useEffect(()=>{if(openTeamId){setSelId(openTeamId);setSelYear(null);onClearTeam();}},[openTeamId]);

  const equipoMap = useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap   = useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);

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
    return matchSearch&&matchLeague&&matchSeason;
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
        <button onClick={()=>{setSelId(null);setSelYear(null);}} style={{background:"none",border:"none",color:"#fb923c",fontSize:"15px",cursor:"pointer",marginBottom:"16px",fontWeight:600,padding:0}}>← Volver</button>
        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"20px",flexWrap:"wrap"}}>
            <TeamBadge team={eq} size={80}/>
            <div style={{flex:1,minWidth:"180px"}}>
              <h1 style={{fontWeight:800,fontSize:"22px",color:"#1e293b",margin:"0 0 10px"}}>{eq.nombre}</h1>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                {eq.pais&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center"}}><FlagImg country={eq.pais}/>{eq.pais}</span>}
                {eq.ciudad&&<span style={{background:"#f1f5f9",color:"#475569",fontSize:"12px",fontWeight:600,padding:"3px 10px",borderRadius:"20px"}}>📍 {eq.ciudad}</span>}
                {eq.año_fundacion&&<span style={{background:"#fff7ed",color:"#c2410c",fontSize:"12px",fontWeight:700,padding:"3px 10px",borderRadius:"20px"}}>Est. {eq.año_fundacion}</span>}
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginTop:"18px"}}>
            {[[years.length,"Temporadas"],[new Set(selected.players.map(({player})=>player.id_jugadora)).size,"Jugadoras únicas"],[selected.players.length,"Apariciones"]].map(([v,l])=>(
              <div key={l} style={{background:"#f8fafc",borderRadius:"12px",padding:"12px",textAlign:"center"}}>
                <div style={{fontSize:"22px",fontWeight:800,color:"#1e293b"}}>{v}</div>
                <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Palmarés */}
        {teamPalmares.length>0&&(
          <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
            <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:"0 0 16px"}}>🏆 Palmarés</h2>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {teamPalmares.map((p,i)=>{
                const liga=ligaMap[p.id_liga];
                const [bg,color]=TIPO_COLORS[liga?.tipo]||["#fff7ed","#c2410c"];
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:"14px",padding:"12px 16px",background:"#fffbeb",borderRadius:"12px",border:"1.5px solid #fde68a"}}>
                    <div style={{fontSize:"24px"}}>🥇</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:"14px",color:"#1e293b"}}>{liga?.nombre||p.id_liga}</div>
                      <div style={{fontSize:"12px",color:"#92400e",marginTop:"2px",fontWeight:600}}>Temporada {p.temporada}</div>
                    </div>
                    <span style={{background:bg,color,fontSize:"11px",fontWeight:700,padding:"3px 10px",borderRadius:"20px"}}>{TIPO_LABELS[liga?.tipo]||liga?.tipo||""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}}>
            <h2 style={{fontWeight:700,fontSize:"17px",color:"#1e293b",margin:0}}>Plantilla <span style={{color:"#94a3b8",fontWeight:400,fontSize:"14px"}}>({squad.length})</span></h2>
            {years.length>0&&<select value={effectiveYear||""} onChange={e=>setSelYear(e.target.value||null)} style={{border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none"}}>
              {years.map(y=><option key={y} value={y}>{y}</option>)}
            </select>}
          </div>
          {squad.length===0?<div style={{textAlign:"center",padding:"30px",color:"#94a3b8"}}>Sin jugadoras para esta temporada</div>
            :<div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {squad.map(({player},i)=>(
                <div key={i} onClick={()=>onGoToPlayer(player.id_jugadora)}
                  style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 14px",background:"#f8fafc",borderRadius:"12px",border:"1.5px solid #e2e8f0",cursor:"pointer",transition:"all 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#fb923c";e.currentTarget.style.background="#fff7ed";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.background="#f8fafc";}}>
                  <Avatar photo={player.foto} name={player.nombre} size={44} fontSize={16}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:"14px",color:"#f97316"}}>{player.nombre}</div>
                    <div style={{fontSize:"12px",color:"#64748b",marginTop:"2px",display:"flex",alignItems:"center"}}><FlagImg country={player.nacionalidad||""}/>{player.nacionalidad||"—"}{player.altura_cm?` · ${player.altura_cm} cm`:""}</div>
                  </div>
                  <span style={posStyle(player.posicion||"")}>{player.posicion||"—"}</span>
                </div>
              ))}
            </div>}
        </div>
      </div>
    );
  }

  return(
    <div style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      <div style={{display:"flex",gap:"10px",marginBottom:"14px",flexWrap:"wrap"}}>
        <input style={{flex:1,minWidth:"180px",border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"14px",color:"#1e293b",outline:"none",background:"#fff"}}
          placeholder="🔍 Buscar equipo..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select value={filterLeague} onChange={e=>setFilterLeague(e.target.value)} style={{border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none"}}>
          <option value="">Todas las ligas</option>
          {allLeagues.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterSeason||""} onChange={e=>setFilterSeason(e.target.value||null)} style={{border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:"#475569",background:"#fff",outline:"none"}}>
          <option value="">Todas las temporadas</option>
          {allSeasons.map(s=><option key={s} value={s}>{s}{s===latestSeason?" (actual)":""}</option>)}
        </select>
      </div>
      <div style={{fontSize:"13px",color:"#94a3b8",marginBottom:"12px"}}>{filtered.length} equipo{filtered.length!==1?"s":""}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"12px"}}>
        {filtered.map(({eq,years:yrs,players:pl})=>{
          const {bg,light,text:tc}=teamColors(eq.nombre||"");
          const uniq=new Set(pl.map(({player})=>player.id_jugadora)).size;
          const latestY=[...yrs].sort((a,b)=>b.localeCompare(a))[0];
          return(
            <div key={eq.id_equipo} onClick={()=>{setSelId(eq.id_equipo);setSelYear(null);}}
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
}

/* ── LeaguesView ─────────────────────────────────────────── */
function LeaguesView({ligas,players,equipos,onGoToTeam}){
  const [selId,setSelId]     = useState(null);
  const [selYear,setSelYear] = useState(null);
  const [search,setSearch]   = useState("");

  const equipoMap = useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
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

  const filtered = ligas.filter(l=>!search||l.nombre?.toLowerCase().includes(search.toLowerCase()));
  const ligasByTipo = useMemo(()=>{
    const g={liga:[],copacont:[],copadom:[],other:[]};
    filtered.forEach(l=>{if(g[l.tipo])g[l.tipo].push(l);else g.other.push(l);});
    return g;
  },[filtered]);

  if(selected){
    const [bg,color]=TIPO_COLORS[selected.tipo]||["#f1f5f9","#475569"];
    return(
      <div style={{maxWidth:"720px",margin:"0 auto",padding:"20px"}}>
        <button onClick={()=>{setSelId(null);setSelYear(null);}} style={{background:"none",border:"none",color:"#fb923c",fontSize:"15px",cursor:"pointer",marginBottom:"16px",fontWeight:600,padding:0}}>← Volver</button>
        <div style={{background:"#fff",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"20px",flexWrap:"wrap"}}>
            <LeagueBadge liga={selected} size={72}/>
            <div style={{flex:1,minWidth:"180px"}}>
              <h1 style={{fontWeight:800,fontSize:"22px",color:"#1e293b",margin:"0 0 10px"}}>{selected.nombre}</h1>
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
                <div key={eq.id_equipo} onClick={()=>onGoToTeam(eq.id_equipo)}
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
      </div>
    );
  }

  const GRUPOS=[["liga","Liga"],["copacont","Copa Continental"],["copadom","Copa Nacional"],["other","Otras"]];
  return(
    <div style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      <input style={{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"10px 16px",fontSize:"14px",color:"#1e293b",outline:"none",background:"#fff",marginBottom:"20px",boxSizing:"border-box"}}
        placeholder="🔍 Buscar liga..." value={search} onChange={e=>setSearch(e.target.value)}/>
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
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"10px"}}>
              {items.map(l=>{
                const teamSet=new Set(),yearSet=new Set();
                players.forEach(p=>(p.seasons||[]).forEach(s=>{if(s.id_liga===l.id_liga){teamSet.add(s.id_equipo);yearSet.add(s.temporada);}}));
                return(
                  <div key={l.id_liga} onClick={()=>{setSelId(l.id_liga);setSelYear(null);}}
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

/* ── App ─────────────────────────────────────────────────── */
export default function App(){
  const [players,setPlayers] = useState([]);
  const [equipos,setEquipos] = useState([]);
  const [ligas,setLigas]     = useState([]);
  const [palmares,setPalmares] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError]     = useState(null);
  const [tab,setTab]         = useState("jugadoras");
  const [openPlayerId,setOpenPlayerId] = useState(null);
  const [openTeamId,setOpenTeamId]     = useState(null);

  const goToTeam   = id=>{setOpenTeamId(id);setOpenPlayerId(null);setTab("equipos");};
  const goToPlayer = id=>{setOpenPlayerId(id);setOpenTeamId(null);setTab("jugadoras");};

  const loadAll = async()=>{
    setLoading(true);setError(null);
    try{
      const [rJ,rE,rL,rT,rP]=await Promise.all([
        supabase.from("jugadoras").select("*").order("id_jugadora"),
        supabase.from("equipos").select("*").order("id_equipo"),
        supabase.from("ligas").select("*").order("id_liga"),
        supabase.from("temporadas").select("*").order("id"),
        supabase.from("palmares").select("*").order("temporada").then(r=>r).catch(()=>({data:[]})),
      ]);
      if(rJ.error)throw rJ.error;if(rE.error)throw rE.error;if(rL.error)throw rL.error;if(rT.error)throw rT.error;
      const sbp={};
      (rT.data||[]).forEach(t=>{if(!sbp[t.id_jugadora])sbp[t.id_jugadora]=[];sbp[t.id_jugadora].push(t);});
      setPlayers((rJ.data||[]).map(j=>({...j,seasons:sbp[j.id_jugadora]||[]})));
      setEquipos(rE.data||[]);
      setLigas(rL.data||[]);
      setPalmares(rP?.data||[]);
    }catch(e){setError(e.message||"Error cargando datos");}
    setLoading(false);
  };

  useEffect(()=>{loadAll();},[]);

  const TABS=[["jugadoras","👩‍🏀","Jugadoras"],["equipos","🏟️","Equipos"],["ligas","🏆","Ligas"]];

  if(loading) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f1f5f9",fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center",color:"#94a3b8"}}><div style={{fontSize:"48px",marginBottom:"12px"}}>⏳</div><div style={{fontWeight:600}}>Cargando desde Supabase...</div></div>
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

  return(
    <div style={{minHeight:"100vh",background:"#f1f5f9",fontFamily:"system-ui,-apple-system,sans-serif"}}>
      <div style={{background:"#0f172a",color:"#fff",padding:"0 20px",position:"sticky",top:0,zIndex:10,boxShadow:"0 2px 16px rgba(0,0,0,0.4)"}}>
        <div style={{maxWidth:"880px",margin:"0 auto",display:"flex",alignItems:"center",gap:"10px",height:"56px"}}>
          <span style={{fontSize:"22px"}}>🏀</span>
          <div style={{fontWeight:800,fontSize:"16px",letterSpacing:"-0.3px",marginRight:"auto"}}>
            BasketFem <span style={{color:"#fb923c"}}>DB</span>
            <span style={{fontSize:"10px",color:"#22c55e",fontWeight:600,marginLeft:"8px",background:"rgba(34,197,94,0.15)",padding:"2px 8px",borderRadius:"10px"}}>● Supabase</span>
          </div>
          <div style={{display:"flex",gap:"4px"}}>
            {TABS.map(([id,icon,label])=>(
              <button key={id} onClick={()=>setTab(id)} style={{background:tab===id?"#f97316":"transparent",color:tab===id?"#fff":"#94a3b8",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",transition:"all 0.15s"}}>
                {icon} {label}
              </button>
            ))}
            <button onClick={loadAll} title="Recargar" style={{background:"transparent",color:"#94a3b8",border:"none",borderRadius:"10px",padding:"7px 10px",cursor:"pointer",fontSize:"16px"}}>🔄</button>
          </div>
        </div>
      </div>
      <div style={{paddingTop:"8px"}}>
        {tab==="jugadoras"&&<PlayersView players={players} equipos={equipos} ligas={ligas} onReload={loadAll} onGoToTeam={goToTeam} openPlayerId={openPlayerId} onClearPlayer={()=>setOpenPlayerId(null)}/>}
        {tab==="equipos"  &&<TeamsView equipos={equipos} players={players} ligas={ligas} palmares={palmares} onGoToPlayer={goToPlayer} openTeamId={openTeamId} onClearTeam={()=>setOpenTeamId(null)}/>}
        {tab==="ligas"    &&<LeaguesView ligas={ligas} players={players} equipos={equipos} onGoToTeam={goToTeam}/>}
      </div>
    </div>
  );
}
