// src/views/PlayersView.jsx
// Extraído de App.jsx (Fase 3 refactor, 2026-09-15).
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { useT } from "../lib/i18n";
import {
  POSITIONS, TIPO_LABELS,
  inp, posStyle, calcAge, firstFreeId, nextSeason, sortS, getCurrentSeason, prevSeasonOf,
  resolveTeamData, resolveTeamName, playerStatus, countryFlagEmoji,
  FlagImg, MultiFlag, TeamBadge, Avatar, PhotoLightbox,
  Fld, Breadcrumbs, Modal, ConfirmDel, PhotoPicker,
  EmptyState, STATUS_BADGE, STATUS_BADGE_LG, PaisDropdown, CoachSeasonForm,
} from "../lib/ui";

function PlayerForm({initial,onSave,onCancel,saving}){
  const [f,setF]=useState({nombre:"",posicion:"Base",posicion2:"",nacionalidad:"",nacionalidad2:"",fecha_nac:"",fecha_fallecimiento:"",altura_cm:"",foto:null,id_espn:"",fiba_person_id:"",id_feb:"",id_lfb:"",...initial});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  return(<div>
    <PhotoPicker value={f.foto} onChange={v=>setF(p=>({...p,foto:v}))}/>
    <Fld label="Nombre *"><input style={inp} value={f.nombre} onChange={set("nombre")} placeholder="Ej: Claudia Soriano"/></Fld>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
      <Fld label="Posición"><select style={inp} value={f.posicion||""} onChange={set("posicion")}><option value="">— Sin definir —</option>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></Fld>
      <Fld label="Altura (cm)"><input style={inp} type="number" value={f.altura_cm} onChange={set("altura_cm")} placeholder="180"/></Fld>
    </div>
    <Fld label="2ª Posición (opcional)"><select style={inp} value={f.posicion2} onChange={set("posicion2")}><option value="">— Ninguna —</option>{POSITIONS.map(p=><option key={p}>{p}</option>)}</select></Fld>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
      <Fld label="Nacionalidad"><input style={inp} value={f.nacionalidad} onChange={set("nacionalidad")} placeholder="España"/></Fld>
      <Fld label="2ª Nacionalidad"><input style={inp} value={f.nacionalidad2||""} onChange={set("nacionalidad2")} placeholder="Opcional"/></Fld>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
      <Fld label="Fecha nac."><input style={inp} type="date" value={f.fecha_nac||""} onChange={set("fecha_nac")}/></Fld>
      <Fld label="Fecha fallecimiento (opcional)"><input style={inp} type="date" value={f.fecha_fallecimiento||""} onChange={set("fecha_fallecimiento")}/></Fld>
    </div>
    <div style={{marginTop:"6px",fontSize:"12px",fontWeight:700,color:"var(--fx-muted)",letterSpacing:"0.4px",textTransform:"uppercase"}}>IDs externos</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
      <Fld label="ESPN"><input style={inp} value={f.id_espn||""} onChange={set("id_espn")} placeholder="4433402"/></Fld>
      <Fld label="FIBA"><input style={inp} value={f.fiba_person_id||""} onChange={set("fiba_person_id")} placeholder="123456"/></Fld>
      <Fld label="FEB"><input style={inp} value={f.id_feb||""} onChange={set("id_feb")} placeholder="98765"/></Fld>
      <Fld label="LFB"><input style={inp} value={f.id_lfb||""} onChange={set("id_lfb")} placeholder="48756"/></Fld>
    </div>
    <div style={{display:"flex",gap:"10px",marginTop:"8px"}}>
      <button onClick={onCancel} style={{flex:1,border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"11px",color:"var(--fx-muted)",background:"var(--fx-card)",cursor:"pointer",fontWeight:600}}>Cancelar</button>
      <button onClick={()=>String(f.nombre||"").trim()&&onSave(f)} disabled={saving||!String(f.nombre||"").trim()} style={{flex:1,background:String(f.nombre||"").trim()?"#9333ea":"var(--fx-amber-border)",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",cursor:String(f.nombre||"").trim()?"pointer":"not-allowed",fontWeight:700}}>{saving?"Guardando...":"Guardar"}</button>
    </div>
  </div>);}

function SeasonForm({initial,equipos,ligas,onSave,onCancel,saving}){
  const [f,setF]=useState({temporada:"",id_equipo:"",id_liga:"",orden:0,...initial});
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
      const paisLiga2=norm(l.pais2);
      const paisLiga3=norm(l.pais3);
      // Misma liga del país (considerando pais, pais2, pais3)
      if(paisLiga===paisEquipo||paisLiga2===paisEquipo||paisLiga3===paisEquipo) return true;
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
    <Fld label="Orden"><input style={inp} type="number" value={f.orden??0} onChange={e=>setF(p=>({...p,orden:parseInt(e.target.value)||0}))} placeholder="0" min="0"/></Fld>
    <div style={{display:"flex",gap:"10px",marginTop:"8px"}}>
      <button onClick={onCancel} style={{flex:1,border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"11px",color:"var(--fx-muted)",background:"var(--fx-card)",cursor:"pointer",fontWeight:600}}>Cancelar</button>
      <button onClick={()=>ok&&onSave(f)} disabled={saving||!ok} style={{flex:1,background:ok?"#9333ea":"var(--fx-amber-border)",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",cursor:ok?"pointer":"not-allowed",fontWeight:700}}>{saving?"Guardando...":"Guardar"}</button>
    </div>
  </div>);}

const STATUS_OPTIONS = [
  {value:"cantera", label:"Nacional (España)", icon:<FlagImg country="España"/>},
  {value:"europea", label:"Europea",  icon:<img loading="lazy" decoding="async" src="https://flagcdn.com/20x15/eu.png" width={16} height={12} alt="EU" style={{display:"inline-block",verticalAlign:"middle",borderRadius:"2px",marginRight:"4px"}}/>},
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
      <div onClick={()=>setOpen(o=>!o)} style={{border:"1.5px solid var(--fx-border)",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:filterStatus?"#9333ea":"#475569",background:"var(--fx-card)",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",whiteSpace:"nowrap",fontWeight:filterStatus?700:400,minWidth:"190px"}}>
        {label}<span style={{marginLeft:"auto",fontSize:"10px"}}>▼</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:100,background:"var(--fx-card)",border:"1.5px solid var(--fx-border)",borderRadius:"12px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",minWidth:"210px",padding:"8px 0"}}>
          <div onClick={()=>{setFilterStatus("");setOpen(false);}} style={{padding:"8px 14px",fontSize:"12px",color:"var(--fx-muted2)",cursor:"pointer",fontWeight:600,borderBottom:"1px solid var(--fx-border2)"}}>
            Todas las categorías
          </div>
          {STATUS_OPTIONS.map(o=>{
            const active=filterStatus===o.value;
            return(
              <div key={o.value} onClick={()=>{setFilterStatus(o.value);setOpen(false);}}
                style={{display:"flex",alignItems:"center",gap:"8px",padding:"9px 14px",cursor:"pointer",background:active?"var(--fx-amber-bg)":"transparent",fontWeight:active?700:400}}
                onMouseEnter={e=>e.currentTarget.style.background=active?"var(--fx-amber-bg)":"var(--fx-hover)"}
                onMouseLeave={e=>e.currentTarget.style.background=active?"var(--fx-amber-bg)":"transparent"}>
                {o.icon}
                <span style={{fontSize:"13px",color:"var(--fx-text)"}}>{o.label}</span>
                {active&&<span style={{marginLeft:"auto",color:"#9333ea"}}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NacDropdown({allNacs,filterNacs,setFilterNacs}){
  const t = useT();
  const [open,setOpen]=useState(false);
  const ref=useRef();
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  const label=filterNacs.size===0?t("filter.todas_nacs"):t(filterNacs.size===1?"filter.n_seleccionada":"filter.n_seleccionadas",{n:filterNacs.size});
  return(
    <div className="bfdb-nac-dropdown" ref={ref} style={{position:"relative",flexShrink:0}}>
      <div onClick={()=>setOpen(o=>!o)} style={{border:"1.5px solid var(--fx-border)",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:filterNacs.size>0?"#9333ea":"#475569",background:"var(--fx-card)",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",whiteSpace:"nowrap",fontWeight:filterNacs.size>0?700:400,minWidth:"200px"}}>
        {label}<span style={{marginLeft:"auto",fontSize:"10px"}}>▼</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:100,background:"var(--fx-card)",border:"1.5px solid var(--fx-border)",borderRadius:"12px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",minWidth:"220px",maxHeight:"260px",overflowY:"auto",padding:"8px 0"}}>
          <div onClick={()=>setFilterNacs(new Set())} style={{padding:"8px 14px",fontSize:"12px",color:"var(--fx-muted2)",cursor:"pointer",fontWeight:600,borderBottom:"1px solid var(--fx-border2)"}}>
            {t("filter.limpiar")}
          </div>
          {allNacs.map(n=>{
            const checked=filterNacs.has(n);
            return(
              <label key={n} style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 14px",cursor:"pointer",background:checked?"var(--fx-amber-bg)":"transparent"}}
                onMouseEnter={e=>e.currentTarget.style.background=checked?"var(--fx-amber-bg)":"var(--fx-hover)"}
                onMouseLeave={e=>e.currentTarget.style.background=checked?"var(--fx-amber-bg)":"transparent"}>
                <input type="checkbox" checked={checked} onChange={()=>setFilterNacs(prev=>{const s=new Set(prev);checked?s.delete(n):s.add(n);return s;})} style={{accentColor:"#9333ea",width:"14px",height:"14px",flexShrink:0}}/>
                <FlagImg country={n}/>
                <span style={{fontSize:"13px",color:"var(--fx-text)",fontWeight:checked?600:400}}>{n}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatsJugadora({idJugadora,equipos,ligas,equiposNombres,onOpenPartido}){
  const t = useT();
  const [rows,setRows]=useState(null);
  const [temp,setTemp]=useState(null);
  const [comp,setComp]=useState("ALL");
  useEffect(()=>{
    let cancel=false; setRows(null);
    (async()=>{
      const {data}=await supabase.from("partido_boxscore")
        .select("id_partido,id_equipo,minutos,puntos,tc_anotados,tc_intentados,t3_anotados,t3_intentados,tl_anotados,tl_intentados,reb_ofensivos,reb_defensivos,reb_totales,asistencias,robos,tapones,perdidas,faltas,valoracion,partidos!inner(temporada,id_liga,fecha_hora,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante)")
        .eq("id_jugadora",idJugadora);
      if(cancel)return;
      const r=(data||[]).map(x=>({...x,...(x.partidos||{})})).sort((a,b)=>(b.fecha_hora||"").localeCompare(a.fecha_hora||""));
      setRows(r);
      const ts=[...new Set(r.map(x=>x.temporada))].sort((a,b)=>String(b).localeCompare(String(a)));
      setTemp(prev=>prev&&ts.includes(prev)?prev:(ts[0]||null));
    })();
    return ()=>{cancel=true;};
  },[idJugadora]);

  if(rows===null)return <div style={{padding:"20px"}}>{Array.from({length:6}).map((_,i)=><div key={i} className="bfdb-skel" style={{width:"100%",height:"36px",borderRadius:"6px",marginBottom:"8px",display:"block"}}/>)}</div>;
  if(rows.length===0)return <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"40px",textAlign:"center",color:"var(--fx-muted2)",fontSize:"14px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>{t("players.no_stats")}</div>;

  const N=v=>{if(typeof v==="string"&&v.indexOf(":")>=0){const p=v.split(":");return (parseInt(p[0],10)||0)+(parseInt(p[1],10)||0)/60;}return Number(v)||0;};
  const ligaMap={}; (ligas||[]).forEach(l=>ligaMap[l.id_liga]=l);
  const equipoMap={};(equipos||[]).forEach(e=>{equipoMap[e.id_equipo]=e;});
  const tData=(id,tmp)=>resolveTeamData(id,tmp,equiposNombres,equipoMap);
  const eqName=(id,tmp)=>tData(id,tmp).nombre||id;
  const temps=[...new Set(rows.map(x=>x.temporada))].sort((a,b)=>String(b).localeCompare(String(a)));
  const compsTemp=[...new Set(rows.filter(x=>x.temporada===temp).map(x=>x.id_liga))];
  const compActiva=compsTemp.includes(comp)?comp:"ALL";
  const filt=rows.filter(x=>x.temporada===temp&&(compActiva==="ALL"||x.id_liga===compActiva));
  const porEquipo={};
  filt.forEach(x=>{(porEquipo[x.id_equipo]=porEquipo[x.id_equipo]||[]).push(x);});
  const equiposOrden=Object.keys(porEquipo).sort((a,b)=>{
    const fa=Math.max(...porEquipo[a].map(x=>new Date(x.fecha_hora||0).getTime()));
    const fb=Math.max(...porEquipo[b].map(x=>new Date(x.fecha_hora||0).getTime()));
    return fb-fa;
  });
  const varios=equiposOrden.length>1;
  const th={padding:"7px 6px",fontSize:"10px",fontWeight:700,color:"var(--fx-muted2)",textAlign:"center",whiteSpace:"nowrap",borderBottom:"2px solid var(--fx-border)"};
  const td={padding:"7px 6px",fontSize:"12px",color:"var(--fx-text)",textAlign:"center",whiteSpace:"nowrap",borderBottom:"1px solid var(--fx-border2)"};

  const bloque=(idEq,part)=>{
    const pj=part.length;
    const sum=k=>part.reduce((s,x)=>s+N(x[k]),0);
    const avg=k=>pj?(sum(k)/pj):0;
    const pctT=(a,i)=>{const I=sum(i);return I?Math.round(sum(a)/I*1000)/10:null;};
    const cards=[[t("players.stat.pj"),pj],[t("players.stat.min"),avg("minutos").toFixed(1)],[t("players.stat.pts"),avg("puntos").toFixed(1)],[t("players.stat.reb"),avg("reb_totales").toFixed(1)],[t("players.stat.ast"),avg("asistencias").toFixed(1)],[t("players.stat.rob"),avg("robos").toFixed(1)],[t("players.stat.val"),avg("valoracion").toFixed(1)]];
    const pcts=[[t("players.stat.tc"),pctT("tc_anotados","tc_intentados")],[t("players.stat.t3"),pctT("t3_anotados","t3_intentados")],[t("players.stat.tl"),pctT("tl_anotados","tl_intentados")]];
    const e=tData(idEq,temp);
    return(
      <div key={idEq} style={{display:"flex",flexDirection:"column",gap:"12px",borderLeft:varios?"3px solid #ddd6fe":"none",paddingLeft:varios?"12px":"0"}}>
        {varios&&(<div style={{display:"flex",alignItems:"center",gap:"8px"}}>{e&&e.escudo&&<img loading="lazy" decoding="async" src={e.escudo} alt="" style={{width:26,height:26,objectFit:"contain"}}/>}<span style={{fontWeight:800,fontSize:"15px",color:"var(--fx-text)"}}>{e.nombre}</span></div>)}
        <div style={{background:"var(--fx-card)",borderRadius:"18px",padding:"18px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
          <div style={{fontSize:"12px",fontWeight:700,color:"#9333ea",marginBottom:"12px",display:"flex",alignItems:"center",gap:"6px"}}>{!varios&&e&&e.escudo&&<img loading="lazy" decoding="async" src={e.escudo} alt="" style={{width:18,height:18,objectFit:"contain"}}/>}{t("players.avgs")} · {temp}{!varios?` · ${e.nombre}`:""}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(58px,1fr))",gap:"8px"}}>
            {cards.map(([l,v])=>(<div key={l} style={{textAlign:"center",background:"var(--fx-lila-bg)",borderRadius:"12px",padding:"10px 4px"}}><div style={{fontSize:"18px",fontWeight:800,color:"var(--fx-text)"}}>{v}</div><div style={{fontSize:"10px",color:"var(--fx-muted2)",fontWeight:600}}>{l}</div></div>))}
          </div>
          <div style={{display:"flex",gap:"16px",marginTop:"12px",flexWrap:"wrap"}}>
            {pcts.map(([l,v])=>(<div key={l} style={{fontSize:"12px",color:"var(--fx-muted)"}}><span style={{fontWeight:700,color:"var(--fx-text)"}}>{v==null?"—":v+"%"}</span> {l}</div>))}
          </div>
        </div>
        <div style={{background:"var(--fx-card)",borderRadius:"18px",padding:"14px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",overflowX:"auto"}}>
          <div style={{fontSize:"12px",fontWeight:700,color:"#9333ea",marginBottom:"10px"}}>{t("players.game_by_game")}</div>
          <table style={{borderCollapse:"collapse",width:"100%",minWidth:"580px"}}>
            <thead><tr>{[t("players.col.fecha"),"",t("players.col.rival"),t("players.col.res"),t("players.stat.min"),t("players.stat.pts"),t("players.stat.tc"),t("players.stat.t3"),t("players.stat.tl"),t("players.stat.reb"),t("players.stat.ast"),t("players.stat.val")].map((h,i)=><th key={i} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {[...part].sort((a,b)=>(b.fecha_hora||"").localeCompare(a.fecha_hora||"")).map((x,i)=>{
                const local=x.id_equipo===x.id_equipo_local;
                const rival=eqName(local?x.id_equipo_visitante:x.id_equipo_local,x.temporada);
                const pf=local?N(x.resultado_local):N(x.resultado_visitante);
                const pc=local?N(x.resultado_visitante):N(x.resultado_local);
                const win=pf>pc;
                return(<tr key={i} onClick={()=>onOpenPartido&&onOpenPartido(x.id_partido)} style={{cursor:onOpenPartido?"pointer":"default"}}>
                  <td style={{...td,color:"var(--fx-muted2)",fontSize:"11px"}}>{(x.fecha_hora||"").slice(5,10).split("-").reverse().join("/")}</td>
                  <td style={{...td,fontSize:"13px"}}>{local?"🏠":"✈️"}</td>
                  <td style={{...td,textAlign:"left",maxWidth:"130px",overflow:"hidden",textOverflow:"ellipsis"}}>{rival}</td>
                  <td style={{...td,fontWeight:700,color:win?"#16a34a":"#ef4444"}}>{win?t("players.col.win"):t("players.col.loss")} {pf}-{pc}</td>
                  <td style={td}>{x.minutos}</td>
                  <td style={{...td,fontWeight:700}}>{x.puntos}</td>
                  <td style={td}>{x.tc_anotados}/{x.tc_intentados}</td>
                  <td style={td}>{x.t3_anotados}/{x.t3_intentados}</td>
                  <td style={td}>{x.tl_anotados}/{x.tl_intentados}</td>
                  <td style={td}>{x.reb_totales}</td>
                  <td style={td}>{x.asistencias}</td>
                  <td style={{...td,fontWeight:700}}>{x.valoracion}</td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
        <select value={temp||""} onChange={e=>{setTemp(e.target.value);setComp("ALL");}} style={{border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"#9333ea",fontWeight:700,background:"var(--fx-card)",outline:"none"}}>
          {temps.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        {compsTemp.length>1?(
          <select value={compActiva} onChange={e=>setComp(e.target.value)} style={{border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"var(--fx-label)",fontWeight:600,background:"var(--fx-card)",outline:"none"}}>
            <option value="ALL">{t("players.todas_comps")}</option>
            {compsTemp.map(c=><option key={c} value={c}>{ligaMap[c]?.nombre||c}</option>)}
          </select>
        ):compsTemp.length===1&&(
          <select value={compsTemp[0]} disabled style={{border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"var(--fx-label)",fontWeight:600,background:"var(--fx-hover)",outline:"none",cursor:"default"}}>
            <option value={compsTemp[0]}>{ligaMap[compsTemp[0]]?.nombre||compsTemp[0]}</option>
          </select>
        )}
      </div>
      {equiposOrden.map(idEq=>bloque(idEq,porEquipo[idEq]))}
    </div>
  );
}

function PlayersView({players,equipos,ligas,palmares,coaches,tempCoach,onReload,onGoToTeam,onGoToCoach,openPlayerId,onClearPlayer,isAdmin,onGoToTab,navHistory,onGoBack,equiposNombres,setPlayers,setTempCoach,onGoToPartido,regExtra,isFavFn,onToggleFav}){
  const t = useT();
  const _q=(()=>{try{return new URLSearchParams(window.location.search);}catch{return new URLSearchParams();}})();
  const [search,setSearch]         = useState(_q.get("q")||"");
  const [filterPos,setFilterPos]   = useState(_q.get("pos")||"");
  const [filterNacs,setFilterNacs] = useState(()=>{const n=_q.get("nac");return n?new Set(n.split(",").filter(Boolean)):new Set();});
  const [filterLiga,setFilterLiga] = useState(_q.get("liga")||"");
  const [filterTemp,setFilterTemp] = useState(_q.get("temp")||"");
  const [filterStatus,setFilterStatus] = useState(_q.get("status")||"");
  const [soloAgentes,setSoloAgentes] = useState(_q.get("agentes")==="1");
  const [selId,setSelId]           = useState(openPlayerId||null);
  const [shareMsg,setShareMsg]     = useState(false);
  const [lightboxPhoto,setLightboxPhoto] = useState(null);
  const [visibleCount,setVisibleCount] = useState(60);
  const loadMoreRef = useRef(null);
  useEffect(()=>{
    const seg='jugadoras';
    if(selId){window.history.replaceState({},"",`/${seg}/${selId}`);return;}
    const params=new URLSearchParams();
    if(search) params.set("q",search);
    if(filterPos) params.set("pos",filterPos);
    if(filterNacs.size) params.set("nac",[...filterNacs].join(","));
    if(filterLiga) params.set("liga",filterLiga);
    if(filterTemp) params.set("temp",filterTemp);
    if(filterStatus) params.set("status",filterStatus);
    if(soloAgentes) params.set("agentes","1");
    const qs=params.toString();
    window.history.replaceState({},"",`/${seg}${qs?"?"+qs:""}`);
  },[selId,search,filterPos,filterNacs,filterLiga,filterTemp,filterStatus,soloAgentes]);
  const [modal,setModal]           = useState(null);
  const [editSeason,setEditSeason] = useState(null);
  const [renewSeason,setRenewSeason] = useState(null);
  const [del,setDel]               = useState(null);
  const [saving,setSaving]         = useState(false);
  const [seasonModal,setSeasonModal] = useState(null);
  const [delCoachItem,setDelCoachItem] = useState(null);
  const [saving3,setSaving3]       = useState(false);
  const [activeTipo,setActiveTipo] = useState(null);
  const [ftab,setFtab]             = useState("carrera");
  useEffect(()=>{setFtab("carrera");},[selId]);
  const photoRef = useRef();

  useEffect(()=>{if(openPlayerId){setSelId(openPlayerId);onClearPlayer();}},[openPlayerId]);

  // Lazy load carrera completa cuando se abre una jugadora (la carga inicial solo tiene la última temporada).
  // Depende de players.length para re-ejecutarse cuando loadAll termine (evita race si el usuario
  // entra directo por URL /jugadoras/{id} antes de que se haya cargado la base).
  useEffect(()=>{
    if(!selId||players.length===0)return;
    const pl=players.find(p=>p.id_jugadora===selId);
    if(!pl)return;
    // Siempre refrescar carrera completa al abrir ficha (el cache/RLS puede tener menos filas de las reales)
    (async()=>{
      const {data}=await supabase.from("temporadas").select("id,id_jugadora,id_equipo,id_liga,temporada,orden").eq("id_jugadora",selId).order("temporada",{ascending:false}).limit(200);
      if(!data)return;
      setPlayers(prev=>prev.map(p=>p.id_jugadora===selId?{...p,seasons:data}:p));
    })();
  },[selId,players.length]);

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

  const currentTipo    = activeTipo===null ? defaultTipo : activeTipo;
  const filteredSeasons = useMemo(()=>{
    if(!selected) return [];
    const all=sortS(selected.seasons);
    return (currentTipo&&currentTipo!=="ALL") ? all.filter(s=>ligaMap[s.id_liga]?.tipo===currentTipo) : all;
  },[selected,currentTipo,ligaMap]);

  const allNacs = useMemo(()=>[...new Set(players.flatMap(p=>[p.nacionalidad,p.nacionalidad2]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es")),[players]);
  const allLigasPlayer = useMemo(()=>{
    const ligsSet=new Set();
    players.forEach(p=>(p.seasons||[]).forEach(s=>{const l=ligaMap[s.id_liga];if(l?.nombre)ligsSet.add(l.nombre);}));
    return [...ligsSet].sort((a,b)=>a.localeCompare(b,"es"));
  },[players,ligaMap]);
  const allTemps = useMemo(()=>[...new Set(players.flatMap(p=>(p.seasons||[]).map(s=>s.temporada)).filter(Boolean))].sort((a,b)=>b.localeCompare(a)),[players]);
  const seasonNow  = useMemo(()=>getCurrentSeason(players),[players]);
  const seasonPrev = useMemo(()=>seasonNow?prevSeasonOf(seasonNow):"",[seasonNow]);
  const filtered = useMemo(()=>{
    const q=search.toLowerCase();
    return players.filter(p=>{
      const seasons=p.seasons||[];
      // liga+temp: alguna temporada cumple ambos; solo una: any temp con ella
      const matchLigaTemp = (!filterLiga && !filterTemp) || seasons.some(s=>{
        const lig=ligaMap[s.id_liga]?.nombre;
        return (!filterLiga||lig===filterLiga)&&(!filterTemp||s.temporada===filterTemp);
      });
      // Agente libre: jugó la temporada anterior, no tiene equipo esta, y no falleció
      const matchAgente = !soloAgentes || (
        !p.fecha_fallecimiento &&
        seasons.some(s=>s.temporada===seasonPrev) &&
        !seasons.some(s=>s.temporada===seasonNow)
      );
      return(!q||p.nombre?.toLowerCase().includes(q)||p.id_jugadora?.toLowerCase().includes(q)||p.nacionalidad?.toLowerCase().includes(q)||seasons.some(s=>equipoMap[s.id_equipo]?.nombre?.toLowerCase().includes(q)))
        &&(!filterPos||p.posicion===filterPos||p.posicion2===filterPos)
        &&(filterNacs.size===0||filterNacs.has(p.nacionalidad)||filterNacs.has(p.nacionalidad2))
        &&matchLigaTemp
        &&(!filterStatus||playerStatus(p.nacionalidad,p.nacionalidad2)===filterStatus)
        &&matchAgente;
    }).sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||"","es"));
  },[players,search,filterPos,filterNacs,filterLiga,filterTemp,filterStatus,soloAgentes,seasonNow,seasonPrev,ligaMap,equipoMap]);

  // Reset paginación al cambiar filtros
  useEffect(()=>{setVisibleCount(60);},[search,filterPos,filterNacs,filterLiga,filterTemp,filterStatus,soloAgentes]);

  // IntersectionObserver para scroll infinito
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

  const addPlayer=async f=>{
    setSaving(true);
    try{
      const allJIds=players.map(p=>parseInt((p.id_jugadora||"J0").slice(1))).filter(n=>!isNaN(n));
      const newId=firstFreeId(allJIds,"J",0);
      const trim=v=>String(v??"").trim()||null;
      const newPlayer={id_jugadora:newId,nombre:f.nombre,posicion:f.posicion||null,posicion2:f.posicion2||null,nacionalidad:f.nacionalidad,nacionalidad2:f.nacionalidad2||null,fecha_nac:f.fecha_nac||null,fecha_fallecimiento:f.fecha_fallecimiento||null,altura_cm:f.altura_cm?parseInt(f.altura_cm):null,foto:f.foto||null,id_espn:trim(f.id_espn),fiba_person_id:trim(f.fiba_person_id),id_feb:trim(f.id_feb),id_lfb:trim(f.id_lfb)};
      const{error}=await supabase.from("jugadoras").insert(newPlayer);
      if(error)throw error;
      setPlayers(prev=>[...prev,{...newPlayer,seasons:[]}].sort((a,b)=>(a.id_jugadora||"").localeCompare(b.id_jugadora||"")));
      setModal(null);
    }catch(e){alert("Error al guardar jugadora: "+(e.message||e.details||JSON.stringify(e)));}
    setSaving(false);
  };
  const updPlayer=async f=>{
    setSaving(true);
    const trim=v=>String(v??"").trim()||null;
    const payload={nombre:f.nombre,posicion:f.posicion||null,posicion2:f.posicion2||null,nacionalidad:f.nacionalidad,nacionalidad2:f.nacionalidad2||null,fecha_nac:f.fecha_nac||null,fecha_fallecimiento:f.fecha_fallecimiento||null,altura_cm:f.altura_cm?parseInt(f.altura_cm):null,foto:f.foto||null,id_espn:trim(f.id_espn),fiba_person_id:trim(f.fiba_person_id),id_feb:trim(f.id_feb),id_lfb:trim(f.id_lfb)};
    const timeout=new Promise((_,r)=>setTimeout(()=>r(new Error("Timeout guardando (8s). Reintenta.")),8000));
    try{
      // Refresca la sesion si el token esta al caer para evitar colgar el update
      const {data:{session}}=await supabase.auth.getSession();
      if(session&&session.expires_at&&session.expires_at*1000-Date.now()<120000){
        await supabase.auth.refreshSession();
      }
      const {data,error}=await Promise.race([
        supabase.from("jugadoras").update(payload).eq("id_jugadora",selId).select().maybeSingle(),
        timeout
      ]);
      if(error)throw error;
      if(!data)throw new Error("La fila no se actualizo (posible RLS o sesion invalida). Recarga y vuelve a intentar.");
      setPlayers(prev=>prev.map(p=>p.id_jugadora!==selId?p:{...p,...payload}));
      setModal(null);
    }catch(e){alert("Error: "+e.message);}
    finally{setSaving(false);}
  };
  const delPlayer=async()=>{
    try{await supabase.from("temporadas").delete().eq("id_jugadora",selId);
      const{error}=await supabase.from("jugadoras").delete().eq("id_jugadora",selId);
      if(error)throw error;
      setPlayers(prev=>prev.filter(p=>p.id_jugadora!==selId));
      setSelId(null);setDel(null);}catch(e){alert("Error: "+e.message);}
  };
  const addSeason=async f=>{
    setSaving(true);
    try{
      const allIds=players.flatMap(p=>p.seasons||[]).map(s=>parseInt(s.id)).filter(n=>!isNaN(n));
      const newId=Math.max(0,...allIds)+1;
      const newSeason={id:newId,id_jugadora:selId,id_equipo:f.id_equipo,id_liga:f.id_liga,temporada:f.temporada};
      const{error}=await supabase.from("temporadas").insert(newSeason);
      if(error)throw error;
      setPlayers(prev=>prev.map(p=>p.id_jugadora!==selId?p:{...p,seasons:[...(p.seasons||[]),newSeason]}));
      setModal(null);}catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const updSeason=async f=>{
    setSaving(true);
    const payload={id_equipo:f.id_equipo,id_liga:f.id_liga,temporada:f.temporada,orden:parseInt(f.orden)||0};
    try{const{error}=await supabase.from("temporadas").update(payload).eq("id",editSeason.id);
      if(error)throw error;
      setPlayers(prev=>prev.map(p=>p.id_jugadora!==selId?p:{...p,seasons:(p.seasons||[]).map(s=>s.id!==editSeason.id?s:{...s,...payload})}));
      setModal(null);setEditSeason(null);}catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };
  const delSeason=async id=>{
    try{const{error}=await supabase.from("temporadas").delete().eq("id",id);
      if(error)throw error;
      setPlayers(prev=>prev.map(p=>p.id_jugadora!==selId?p:{...p,seasons:(p.seasons||[]).filter(s=>s.id!==id)}));
      setDel(null);}catch(e){alert("Error: "+e.message);}
  };
  const saveCoachSeasonInPlayer=async(f,coachId)=>{
    setSaving3(true);
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
    setSaving3(false);
  };
  const delCoachSeasonInPlayer=async(id)=>{
    try{const{error}=await supabase.from("temporadas_coach").delete().eq("id",id);
      if(error)throw error;
      setTempCoach(prev=>prev.filter(tc=>tc.id!==id));
      setDelCoachItem(null);}catch(e){alert("Error: "+e.message);}
  };


  if(players.length===0) return <EmptyState icon="👩‍🏀" text="No hay jugadoras" sub="Verifica la conexión con Supabase"/>;

  if(selected) return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"20px"}}>
      <Breadcrumbs items={[
        {label:t("tab.home"),onClick:()=>onGoToTab&&onGoToTab("home")},
        {label:t("tab.jugadoras"),onClick:()=>{setSelId(null);setActiveTipo(null);}},
        {label:selected.nombre}
      ]}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <button onClick={()=>{
            const url=`${window.location.origin}/jugadoras/${selected.id_jugadora}`;
            // Solo url, sin text: si se pasan ambos, Android concatena text+url en un único
            // bloque de texto antes de entregarlo a WhatsApp, lo que generaba un preview
            // inconsistente (a veces el del dominio raíz en vez de la ficha de la jugadora).
            const posicionesShare=[selected.posicion,selected.posicion2].filter(Boolean).join("/");
            const banderasShare=[countryFlagEmoji(selected.nacionalidad),countryFlagEmoji(selected.nacionalidad2)].filter(Boolean).join(" ");
            const detallesShare=[posicionesShare,banderasShare].filter(Boolean).join(" · ");
            const shareText=detallesShare?`${selected.nombre} · ${detallesShare} — La Basketneta`:`Ficha de ${selected.nombre} en La Basketneta`;
            if(navigator.share){navigator.share({title:selected.nombre,text:shareText,url}).catch(()=>{});}
            else{navigator.clipboard.writeText(url);setShareMsg(true);setTimeout(()=>setShareMsg(false),2000);}
          }} style={{background:"var(--fx-hover)",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"var(--fx-label)"}}>📤 Compartir</button>
          {shareMsg&&<span style={{fontSize:"12px",color:"#16a34a",fontWeight:600}}>¡Enlace copiado!</span>}
          {isAdmin&&!del&&(<>
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={async()=>{
              // Fetch IDs externos + fuente antes de abrir el editor (no vienen en fase 1)
              try{
                const {data}=await supabase.from("jugadoras").select("id_espn,fiba_person_id,id_feb,id_lfb").eq("id_jugadora",selId).single();
                if(data)setPlayers(prev=>prev.map(p=>p.id_jugadora===selId?{...p,...data}:p));
              }catch(_){}
              setModal("editPlayer");
            }} style={{background:"var(--fx-hover)",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"var(--fx-label)"}}>✏️ Editar</button>
            <button onClick={()=>setDel("player")} style={{background:"var(--fx-red-bg)",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
          </div>
          </>)}
        </div>
        {isAdmin&&del&&(
          <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
            <span style={{fontSize:"13px",color:"#ef4444",fontWeight:600}}>¿Eliminar?</span>
            <button onClick={del==="player"?delPlayer:()=>delSeason(del)} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:"8px",padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:"13px"}}>Sí</button>
            <button onClick={()=>setDel(null)} style={{background:"var(--fx-hover)",color:"var(--fx-label)",border:"none",borderRadius:"8px",padding:"6px 14px",fontWeight:600,cursor:"pointer",fontSize:"13px"}}>No</button>
          </div>
        )}
      </div>

      <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:"20px"}}>
          <Avatar photo={selected.foto} name={selected.nombre} size={90} fontSize={30} fallecida={!!selected.fecha_fallecimiento} onPhotoClick={setLightboxPhoto}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"8px",flexWrap:"wrap"}}>
              <div style={{minWidth:"140px",flex:1}}><div style={{display:"flex",alignItems:"center",gap:"8px"}}><h1 style={{fontWeight:800,fontSize:"21px",color:"var(--fx-text)",margin:0,wordBreak:"break-word"}}>{selected.nombre}</h1>{onToggleFav&&<button onClick={e=>{e.stopPropagation();onToggleFav("jugadora",selected.id_jugadora);}} title={isFavFn?.("jugadora",selected.id_jugadora)?"Quitar de favoritos":"Añadir a favoritos"} style={{background:"none",border:"none",cursor:"pointer",fontSize:"20px",padding:0,lineHeight:1,flexShrink:0}}>{isFavFn?.("jugadora",selected.id_jugadora)?"⭐":"☆"}</button>}</div>{isAdmin&&<span style={{fontSize:"11px",color:"var(--fx-muted2)",fontFamily:"monospace"}}>{selected.id_jugadora}</span>}</div>
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
                return(<div style={{display:"flex",flexDirection:"column",gap:"4px",alignItems:"flex-end",flexShrink:1,minWidth:0,maxWidth:"100%"}}>{entries.map(([n,c])=>(<span key={n} title={`${c}x ${n}`} style={{background:"var(--fx-amber-bg)",border:"1.5px solid #fed7aa",color:"var(--fx-amber-text)",fontSize:"11px",fontWeight:700,padding:"3px 8px",borderRadius:"20px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%",boxSizing:"border-box"}}>🏆 {c}x {n}</span>))}</div>);
              })()}
            </div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"12px"}}>
              {selected.posicion&&<span style={posStyle(selected.posicion)}>{selected.posicion}</span>}
              {selected.posicion2&&<span style={posStyle(selected.posicion2)}>{selected.posicion2}</span>}
              {STATUS_BADGE_LG[playerStatus(selected.nacionalidad,selected.nacionalidad2)]}
              {(selected.nacionalidad||selected.nacionalidad2)&&<span style={{background:"var(--fx-hover)",color:"var(--fx-label)",fontSize:"12px",padding:"3px 8px",borderRadius:"20px",display:"inline-flex",alignItems:"center",gap:"4px"}}>{selected.nacionalidad&&<FlagImg country={selected.nacionalidad}/>}{selected.nacionalidad2&&<FlagImg country={selected.nacionalidad2}/>}</span>}
            </div>
            {(()=>{
              const coachRecord=(coaches||[]).find(c=>String(c.id_jugadora)===String(selected.id_jugadora));
              return(
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",flexWrap:"wrap"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:"8px",flex:1,minWidth:0}}>
                    {selected.altura_cm&&<div style={{fontSize:"13px"}}><span style={{color:"var(--fx-muted2)"}}>Altura: </span><span style={{fontWeight:600,color:"var(--fx-text)"}}>{selected.altura_cm} cm</span></div>}
                    {selected.fecha_nac&&<div style={{fontSize:"13px"}}><span style={{color:"var(--fx-muted2)"}}>{selected.fecha_fallecimiento?"Edad al fallecer: ":"Edad: "}</span><span style={{fontWeight:600,color:"var(--fx-text)"}}>{calcAge(selected.fecha_nac,selected.fecha_fallecimiento)} años</span></div>}
                  </div>
                  {coachRecord&&(
                    <button onClick={()=>onGoToCoach(coachRecord.id_coach,{tab:"jugadoras",id:selected?.id_jugadora,label:selected?.nombre})}
                      style={{background:"var(--fx-blue-bg)",color:"var(--fx-blue-text)",border:"1.5px solid #bfdbfe",borderRadius:"20px",padding:"4px 12px",fontSize:"11px",fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"4px",flexShrink:0}}>
                      📋 Coach
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
        {[["carrera",t("players.tab.carrera")],["estadisticas",t("players.tab.stats")]].map(([k,l])=>(<button key={k} onClick={()=>setFtab(k)} style={{flex:1,padding:"10px",borderRadius:"12px",border:"none",cursor:"pointer",fontWeight:700,fontSize:"13px",background:ftab===k?"#9333ea":"#f1f5f9",color:ftab===k?"#fff":"#64748b"}}>{l}</button>))}
      </div>
      {ftab==="carrera"&&(
      <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"24px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"10px"}}>
          <h2 style={{fontWeight:700,fontSize:"17px",color:"var(--fx-text)",margin:0}}>{t("players.historial")} <span style={{color:"var(--fx-muted2)",fontWeight:400,fontSize:"14px"}}>({selected.seasons.length})</span></h2>
          {isAdmin&&<button onClick={()=>setModal("addSeason")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"8px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Temporada</button>}
        </div>
        {isAdmin&&modal==="addSeason"&&<Modal title="Añadir temporada" onClose={()=>setModal(null)}><SeasonForm equipos={equipos} ligas={ligas} onSave={addSeason} onCancel={()=>setModal(null)} saving={saving}/></Modal>}
        {playerTipos.length>1&&(
          <div style={{marginBottom:"16px",paddingBottom:"14px",borderBottom:"1px solid var(--fx-border2)"}}>
            <select value={currentTipo||"ALL"} onChange={e=>setActiveTipo(e.target.value)}
              style={{border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",color:"var(--fx-label)",background:"var(--fx-card)",outline:"none",width:"100%"}}>
              <option value="ALL">{t("players.todas_comps")}</option>
              {playerTipos.map(t=><option key={t} value={t}>{TIPO_LABELS[t]||t}</option>)}
            </select>
          </div>
        )}
        {(()=>{
          const coachRecord=(coaches||[]).find(c=>String(c.id_jugadora)===String(selected.id_jugadora));
          const coachSeasons=(coachRecord?(tempCoach||[]).filter(tc=>tc.id_coach===coachRecord.id_coach):[]).map(s=>({...s,_type:"coach"}));
          const playSeasons=filteredSeasons.map(s=>({...s,_type:"player"}));
          const merged=[...playSeasons,...coachSeasons].sort((a,b)=>b.temporada.localeCompare(a.temporada));
          if(merged.length===0)return <div style={{textAlign:"center",padding:"30px",color:"var(--fx-muted2)",fontSize:"14px"}}>{t("players.sin_temp_comp")}</div>;
          const hasCoach=coachSeasons.length>0;
          return(
            <>
              {hasCoach&&<div style={{display:"flex",gap:"12px",marginBottom:"12px",fontSize:"12px",color:"var(--fx-muted)",alignItems:"center"}}>
                <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:10,borderRadius:"50%",background:"#9333ea",display:"inline-block"}}/> Jugadora</span>
                <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:10,height:10,borderRadius:"50%",background:"#3b82f6",display:"inline-block"}}/> Entrenadora</span>
              </div>}
              <div style={{position:"relative"}}>
                <div style={{position:"absolute",left:"11px",top:"10px",bottom:"10px",width:"2px",background:"linear-gradient(to bottom,#fed7aa,#bfdbfe)"}}/>
                <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                  {merged.map((s,i)=>{
                    const isCoach=s._type==="coach";
                    const eq=equipoMap[s.id_equipo],lig=ligaMap[s.id_liga];
                    const dotColor=isCoach?(i===0?"#3b82f6":"#93c5fd"):(i===0?"#9333ea":"#fdba74");
                    return(
                      <div key={(isCoach?"c":"p")+s.id} style={{display:"flex",gap:"16px",alignItems:"flex-start",paddingLeft:"32px",position:"relative"}}>
                        <div style={{position:"absolute",left:"6px",top:"14px",width:"12px",height:"12px",borderRadius:"50%",background:dotColor,border:"3px solid #fff",boxShadow:`0 0 0 2px ${dotColor}`}}/>
                        <div style={{flex:1,background:isCoach?"var(--fx-blue-bg)":"var(--fx-hover)",borderRadius:"12px",padding:"12px 14px",border:`1.5px solid ${isCoach?"var(--fx-blue-border)":"var(--fx-border)"}`,cursor:"pointer"}}
                          onClick={()=>onGoToTeam(s.id_equipo,s.temporada,{tab:"jugadoras",id:selected?.id_jugadora,label:selected?.nombre})}
                          onMouseEnter={e=>{e.currentTarget.style.background=isCoach?"var(--fx-blue-bg)":"var(--fx-amber-bg)";e.currentTarget.style.borderColor=isCoach?"#93c5fd":"#c084fc";}}
                          onMouseLeave={e=>{e.currentTarget.style.background=isCoach?"var(--fx-blue-bg)":"var(--fx-hover)";e.currentTarget.style.borderColor=isCoach?"var(--fx-blue-border)":"var(--fx-border)";}}>
                          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                            <TeamBadge team={eq} size={30}/>
                            <div>
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"6px",flexWrap:"wrap"}}>
                                <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                                  <span style={{fontWeight:700,fontSize:"14px",color:"var(--fx-text)"}}>{s.temporada} · </span>
                                  <span style={{color:isCoach?"#3b82f6":"#9333ea",fontWeight:700,textDecoration:"underline"}}>{resolveTeamName(s.id_equipo,s.temporada,equiposNombres,equipoMap)||s.id_equipo}</span>
                                  {eq?.filial_de&&<span style={{background:"var(--fx-green-bg)",color:"#16a34a",fontSize:"9px",fontWeight:800,padding:"1px 6px",borderRadius:"20px",letterSpacing:"0.3px"}}>FILIAL</span>}
                                  {isCoach&&<span style={{background:"var(--fx-blue-bg)",color:"var(--fx-blue-text)",fontSize:"10px",fontWeight:700,padding:"1px 6px",borderRadius:"20px"}}>📋 Coach</span>}
                                  {isAdmin&&isCoach&&<div style={{display:"flex",gap:"4px",marginLeft:"auto"}} onClick={e=>e.stopPropagation()}>{i===0&&<button onClick={()=>setSeasonModal({id_equipo:s.id_equipo,id_liga:s.id_liga,temporada:nextSeason(s.temporada)})} style={{background:"var(--fx-green-bg)",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#16a34a"}} title="Renovar temporada coach">⟳</button>}<button onClick={()=>setSeasonModal(s)} style={{background:"var(--fx-hover)",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"var(--fx-label)"}}>✏️</button><button onClick={()=>setDelCoachItem({type:"season",id:s.id})} style={{background:"var(--fx-red-bg)",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#ef4444"}}>🗑️</button></div>}
                                </div>
                                {isAdmin&&!isCoach&&<div style={{display:"flex",gap:"4px"}} onClick={e=>e.stopPropagation()}>
                                  {i===0&&<button onClick={()=>{setRenewSeason({id_equipo:s.id_equipo,id_liga:s.id_liga,temporada:nextSeason(s.temporada),dorsal:s.dorsal||""});setModal("addSeason");}} style={{background:"var(--fx-green-bg)",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#16a34a"}} title="Renovar temporada">⟳</button>}
                                  <button onClick={()=>{setEditSeason(s);setModal("editSeason");}} style={{background:"var(--fx-hover)",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"var(--fx-label)"}}>✏️</button>
                                  <button onClick={()=>setDel(s.id)} style={{background:"var(--fx-red-bg)",border:"none",borderRadius:"6px",padding:"3px 8px",fontSize:"11px",cursor:"pointer",color:"#ef4444"}}>🗑️</button>
                                </div>}
                              </div>
                              <div style={{fontSize:"12px",color:"var(--fx-muted)",marginTop:"2px",display:"flex",alignItems:"center",gap:"4px"}}>{lig&&<MultiFlag countries={[lig.pais,lig.pais2,lig.pais3]}/>}{lig?.nombre||s.id_liga}</div>
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
      )}
      {ftab==="estadisticas"&&<StatsJugadora idJugadora={selected.id_jugadora} equipos={equipos} ligas={ligas} equiposNombres={equiposNombres} onOpenPartido={onGoToPartido}/>}
      {isAdmin&&seasonModal&&(()=>{
        const coachRecord=(coaches||[]).find(c=>String(c.id_jugadora)===String(selected.id_jugadora));
        return coachRecord?(<Modal title={seasonModal==="add"?"Añadir temporada coach":"Editar temporada coach"} onClose={()=>setSeasonModal(null)}>
          <CoachSeasonForm initial={seasonModal!=="add"?seasonModal:null} equipos={equipos} ligas={ligas} onSave={f=>saveCoachSeasonInPlayer(f,coachRecord.id_coach)} onCancel={()=>setSeasonModal(null)} saving={saving3}/>
        </Modal>):null;
      })()}
      {isAdmin&&delCoachItem?.type==="season"&&<ConfirmDel msg="¿Eliminar esta temporada de coach?" onCancel={()=>setDelCoachItem(null)} onConfirm={()=>delCoachSeasonInPlayer(delCoachItem.id)}/>}
      {isAdmin&&modal&&(
        <Modal title={modal==="addSeason"?"Añadir temporada":modal==="editSeason"||editSeason?"Editar temporada":modal==="addPlayer"?"Nueva jugadora":"Editar jugadora"} onClose={()=>{setModal(null);setEditSeason(null);setRenewSeason(null);}}>
          {(modal==="addSeason")&&<SeasonForm initial={renewSeason||undefined} equipos={equipos} ligas={ligas} onSave={addSeason} onCancel={()=>{setModal(null);setRenewSeason(null);}} saving={saving}/>}
          {(editSeason)&&<SeasonForm initial={editSeason} equipos={equipos} ligas={ligas} onSave={updSeason} onCancel={()=>{setEditSeason(null);}} saving={saving}/>}
          {(modal==="addPlayer")&&<PlayerForm onSave={addPlayer} onCancel={()=>setModal(null)} saving={saving}/>}
          {(modal==="editPlayer")&&<PlayerForm initial={selected} onSave={updPlayer} onCancel={()=>setModal(null)} saving={saving}/>}
        </Modal>
      )}
      {isAdmin&&del&&del!=="player"&&(
        <ConfirmDel msg="¿Eliminar esta temporada?" onCancel={()=>setDel(null)} onConfirm={()=>delSeason(del)}/>
      )}
      {lightboxPhoto&&<PhotoLightbox photo={lightboxPhoto} onClose={()=>setLightboxPhoto(null)}/>}
    </div>
  );

  return(
    <div className="bfdb-container" style={{maxWidth:"880px",margin:"0 auto",padding:"20px"}}>
      {isAdmin&&modal==="addPlayer"&&<Modal title="Nueva jugadora" onClose={()=>setModal(null)}><PlayerForm onSave={addPlayer} onCancel={()=>setModal(null)} saving={saving}/></Modal>}
      {isAdmin&&<div style={{display:"flex",justifyContent:"flex-end",marginBottom:"12px"}}><button onClick={()=>setModal("addPlayer")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"8px 16px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Jugadora</button></div>}

      <div className="bfdb-filter-row" style={{display:"flex",gap:"8px",marginBottom:"8px",flexWrap:"wrap",alignItems:"stretch"}}>
        <input style={{flex:"1 1 200px",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",color:"var(--fx-text)",outline:"none",background:"var(--fx-card)",height:"40px",boxSizing:"border-box"}}
          placeholder={t("players.search")} value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={{flex:"0 0 auto",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterPos?"#9333ea":"#475569",background:"var(--fx-card)",outline:"none",height:"40px",fontWeight:filterPos?700:400}} value={filterPos} onChange={e=>setFilterPos(e.target.value)}>
          <option value="">{t("players.filter.position")}</option>
          {POSITIONS.map(p=><option key={p}>{p}</option>)}
        </select>
        <select style={{flex:"0 0 auto",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterLiga?"#9333ea":"#475569",background:"var(--fx-card)",outline:"none",height:"40px",fontWeight:filterLiga?700:400}} value={filterLiga} onChange={e=>setFilterLiga(e.target.value)}>
          <option value="">Liga</option>
          {allLigasPlayer.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        <select style={{flex:"0 0 auto",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:filterTemp?"#9333ea":"#475569",background:"var(--fx-card)",outline:"none",height:"40px",fontWeight:filterTemp?700:400}} value={filterTemp} onChange={e=>setFilterTemp(e.target.value)}>
          <option value="">{t("players.filter.season")}</option>
          {allTemps.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <StatusDropdown filterStatus={filterStatus} setFilterStatus={setFilterStatus}/>
        <NacDropdown allNacs={allNacs} filterNacs={filterNacs} setFilterNacs={setFilterNacs}/>
        <label title={seasonPrev&&seasonNow?`Jugadoras con equipo en ${seasonPrev} y sin equipo en ${seasonNow}`:""} style={{display:"flex",alignItems:"center",gap:"8px",border:"1.5px solid var(--fx-border)",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:soloAgentes?"#9333ea":"#475569",background:"var(--fx-card)",cursor:"pointer",whiteSpace:"nowrap",fontWeight:soloAgentes?700:400,height:"40px",boxSizing:"border-box"}}>
          <input type="checkbox" checked={soloAgentes} onChange={e=>setSoloAgentes(e.target.checked)} style={{accentColor:"#9333ea",cursor:"pointer"}}/>
          Agentes libres
        </label>
      </div>
      {(filterPos||filterLiga||filterTemp||filterStatus||filterNacs.size>0||soloAgentes)&&(
        <button onClick={()=>{setFilterPos("");setFilterLiga("");setFilterTemp("");setFilterStatus("");setFilterNacs(new Set());setSoloAgentes(false);}}
          style={{alignSelf:"flex-start",background:"var(--fx-hover)",color:"var(--fx-muted)",border:"1.5px solid var(--fx-border)",borderRadius:"20px",padding:"5px 14px",fontSize:"12px",fontWeight:700,cursor:"pointer",marginBottom:"4px"}}>
          ✕ Limpiar filtros
        </button>
      )}
      {filterNacs.size>0&&(
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"8px",alignItems:"center"}}>
          <span style={{fontSize:"12px",color:"var(--fx-muted)"}}>Nac.:</span>
          {[...filterNacs].map(n=>(
            <span key={n} style={{background:"var(--fx-amber-bg)",border:"1.5px solid #fed7aa",color:"#9333ea",fontSize:"11px",fontWeight:700,padding:"2px 8px",borderRadius:"20px",display:"inline-flex",alignItems:"center",gap:"3px"}}>
              <FlagImg country={n}/>{n}
            </span>
          ))}
          <span onClick={()=>setFilterNacs(new Set())} style={{background:"var(--fx-hover)",color:"var(--fx-muted)",fontSize:"11px",fontWeight:600,padding:"2px 8px",borderRadius:"20px",cursor:"pointer"}}>✕ Limpiar</span>
        </div>
      )}
      <div style={{fontSize:"13px",color:"var(--fx-muted2)",marginBottom:"12px"}}>{filtered.length} jugadora{filtered.length!==1?"s":""}</div>
      <div className="bfdb-cards-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"12px"}}>
        {filtered.slice(0,visibleCount).map(p=>{
          const allS=sortS(p.seasons||[]);
          const last=allS.find(s=>ligaMap[s.id_liga]?.tipo==="liga")||allS[0];
          const lastEq=last?equipoMap[last.id_equipo]:null;
          return(
            <div key={p.id_jugadora} onClick={()=>{setSelId(p.id_jugadora);setActiveTipo(null);window.scrollTo({top:0,behavior:"smooth"});}}
              style={{background:"var(--fx-card)",borderRadius:"16px",padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",border:"2px solid transparent",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#c084fc";e.currentTarget.style.boxShadow="0 4px 18px rgba(249,115,22,0.18)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"12px"}}>
                <Avatar photo={p.foto} name={p.nombre} size={48} fontSize={18} fallecida={!!p.fecha_fallecimiento}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:"15px",color:"var(--fx-text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.nombre}</div>
                  <div style={{fontSize:"11px",color:"var(--fx-muted2)",marginTop:"1px",display:"flex",alignItems:"center",gap:"3px"}}>{p.nacionalidad&&<FlagImg country={p.nacionalidad}/>}{p.nacionalidad2&&<FlagImg country={p.nacionalidad2}/>}{p.altura_cm&&<span>{p.nacionalidad||p.nacionalidad2?" · ":""}{p.altura_cm} cm</span>}</div>
                </div>
                <div className="bfdb-player-card-right" style={{display:"flex",flexDirection:"column",gap:"3px",alignItems:"flex-end",flexShrink:0}}><div className="bfdb-player-badges" style={{display:"flex",gap:"3px",flexWrap:"wrap",justifyContent:"flex-end"}}>{p.posicion&&<span style={posStyle(p.posicion)}>{p.posicion}</span>}{p.posicion2&&<span style={posStyle(p.posicion2)}>{p.posicion2}</span>}</div></div>
              </div>
              <div style={{borderTop:"1px solid var(--fx-border2)",paddingTop:"10px"}}>
                {lastEq?(<>
                  <div style={{fontSize:"11px",color:"var(--fx-muted2)",marginBottom:"4px"}}>{t("teams.last_team")}</div>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <TeamBadge team={lastEq} size={26}/>
                    <div>
                      <div style={{fontSize:"13px",fontWeight:600,color:"var(--fx-text)"}}>{last.temporada} · {lastEq.nombre}</div>
                      <div style={{fontSize:"11px",color:"var(--fx-muted2)"}}>{ligaMap[last.id_liga]?.nombre||last.id_liga}</div>
                    </div>
                  </div>
                </>):<div style={{fontSize:"12px",color:"#cbd5e1",fontStyle:"italic"}}>{t("players.sin_temporadas")}</div>}
              </div>
              <div style={{marginTop:"10px",fontSize:"12px",color:"#9333ea",fontWeight:600}}>{(p.seasons||[]).length} temporada{(p.seasons||[]).length!==1?"s":""}</div>
            </div>
          );
        })}
      </div>
      {visibleCount<filtered.length&&(
        <div ref={loadMoreRef} style={{textAlign:"center",padding:"24px",color:"var(--fx-muted2)",fontSize:"13px"}}>
          Mostrando {visibleCount} de {filtered.length}...
        </div>
      )}

    </div>
  );
}

export default PlayersView;
