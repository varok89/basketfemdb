// src/views/PartidosView.jsx
// Extraído de App.jsx (Fase 2 refactor, 2026-09-15).
import { useState, useEffect, useRef, useMemo, useCallback, lazy } from "react";
import { supabase, callFn } from "../lib/supabaseClient";
import { useT, locale } from "../lib/i18n";
import { Avatar, Fld, TeamBadge, inp, resolveTeamData } from "../lib/ui";

/* ── PartidoForm ─────────────────────────────────────────── */
// Fld definido fuera del componente para evitar que React desmonte/remonte
// los inputs al redefiniria en cada render (causaba pérdida de foco al escribir).
function PartidoFld({label,children}){
  return <div style={{marginBottom:"10px"}}><label style={{display:"block",fontSize:"11px",fontWeight:700,color:"var(--fx-muted)",marginBottom:"5px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</label>{children}</div>;
}

function PartidoForm({initial,equipos,ligas,onSave,onCancel,saving}){
  const inp={width:"100%",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",outline:"none",boxSizing:"border-box"};
  const inpNum={border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"16px",fontWeight:700,outline:"none",boxSizing:"border-box",width:"80px",textAlign:"center"};
  const [f,setF]=useState({id_liga:"",temporada:"",id_equipo_local:"",id_equipo_visitante:"",fecha_hora:"",link:"",url_stats:"",notas:"",resultado_local:"",resultado_visitante:"",...(initial||{})});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const Fld=PartidoFld;
  const toLocal=iso=>{if(!iso)return"";const d=new Date(iso);const pad=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;};
  const [localDt,setLocalDt]=useState(toLocal(f.fecha_hora));
  const equiposSorted=[...equipos].sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||"","es"));
  const ligasSorted=[...ligas].sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||"","es"));
  const localNombre=equipos.find(e=>e.id_equipo===f.id_equipo_local)?.nombre||"Local";
  const visitNombre=equipos.find(e=>e.id_equipo===f.id_equipo_visitante)?.nombre||"Visitante";
  return(
    <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"22px",boxShadow:"0 2px 12px rgba(0,0,0,0.1)",maxWidth:"500px",margin:"0 auto"}}>
      <h2 style={{fontWeight:800,fontSize:"18px",color:"var(--fx-text)",marginTop:0,marginBottom:"18px"}}>{initial?.id?"Editar partido":"Nuevo partido"}</h2>
      <Fld label="Liga">
        <select style={inp} value={f.id_liga} onChange={set("id_liga")}>
          <option value="">— Selecciona liga —</option>
          {ligasSorted.map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
        </select>
      </Fld>
      <Fld label="Temporada">
        <input style={inp} value={f.temporada||""} onChange={set("temporada")} placeholder="2026 o 2025-26"/>
      </Fld>
      <Fld label="Equipo local">
        <select style={inp} value={f.id_equipo_local} onChange={set("id_equipo_local")}>
          <option value="">— Selecciona equipo —</option>
          {equiposSorted.map(e=><option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>)}
        </select>
      </Fld>
      <Fld label="Equipo visitante">
        <select style={inp} value={f.id_equipo_visitante} onChange={set("id_equipo_visitante")}>
          <option value="">— Selecciona equipo —</option>
          {equiposSorted.map(e=><option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>)}
        </select>
      </Fld>
      <Fld label="Fecha y hora">
        <input style={inp} type="datetime-local" value={localDt} onChange={e=>{setLocalDt(e.target.value);setF(p=>({...p,fecha_hora:e.target.value?new Date(e.target.value).toISOString():""}));}}/>
      </Fld>
      <Fld label="Resultado (dejar vacío si no ha acabado)">
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{textAlign:"center",flex:1}}>
            <div style={{fontSize:"11px",color:"var(--fx-muted)",marginBottom:"4px",fontWeight:600}}>{localNombre}</div>
            <input style={inpNum} type="number" min="0" value={f.resultado_local??""} onChange={e=>setF(p=>({...p,resultado_local:e.target.value===""?null:Number(e.target.value)}))} placeholder="—"/>
          </div>
          <span style={{fontWeight:800,fontSize:"20px",color:"#9333ea"}}>-</span>
          <div style={{textAlign:"center",flex:1}}>
            <div style={{fontSize:"11px",color:"var(--fx-muted)",marginBottom:"4px",fontWeight:600}}>{visitNombre}</div>
            <input style={inpNum} type="number" min="0" value={f.resultado_visitante??""} onChange={e=>setF(p=>({...p,resultado_visitante:e.target.value===""?null:Number(e.target.value)}))} placeholder="—"/>
          </div>
        </div>
      </Fld>
      <Fld label="Link para ver el partido (opcional)">
        <input style={inp} value={f.link||""} onChange={set("link")} placeholder="https://..."/>
      </Fld>
      <Fld label="URL estadísticas FIBA (opcional)">
        <input style={inp} value={f.url_stats||""} onChange={set("url_stats")} placeholder="https://www.fiba.basketball/en/events/.../games/131760-SWE-LAT"/>
      </Fld>
      <Fld label="Notas (opcional)">
        <input style={inp} value={f.notas||""} onChange={set("notas")} placeholder="Semifinal, Grupo A..."/>
      </Fld>
      <div style={{display:"flex",gap:"10px",marginTop:"20px"}}>
        <button onClick={()=>onSave(f)} disabled={saving||!f.id_equipo_local||!f.id_equipo_visitante||!f.fecha_hora}
          style={{flex:1,background:"#9333ea",color:"#fff",border:"none",borderRadius:"12px",padding:"12px",fontWeight:700,fontSize:"14px",cursor:"pointer",opacity:(saving||!f.id_equipo_local||!f.id_equipo_visitante||!f.fecha_hora)?0.5:1}}>
          {saving?"Guardando...":"Guardar"}
        </button>
        <button onClick={onCancel} style={{flex:1,background:"var(--fx-hover)",color:"var(--fx-label)",border:"none",borderRadius:"12px",padding:"12px",fontWeight:700,fontSize:"14px",cursor:"pointer"}}>Cancelar</button>
      </div>
    </div>
  );
}

/* ── BoxscoreEditor (admin, edición inline) ──────────────── */
const BOX_NUM_COLS=["puntos","tc_anotados","tc_intentados","t3_anotados","t3_intentados","tl_anotados","tl_intentados","reb_ofensivos","reb_defensivos","reb_totales","asistencias","robos","tapones","perdidas","faltas","valoracion"];
function emptyBoxRow(idEquipo,nombre,idJugadora,dorsal){
  const r={id_jugadora:idJugadora??null,id_equipo:idEquipo||null,nombre:nombre||"",dorsal:dorsal??null,minutos:null,titular:false};
  BOX_NUM_COLS.forEach(k=>{r[k]=0;});
  return r;
}
function BoxscoreEditor({idPartido,local,visit,rosterLocal,rosterVisit,onClose,onSaved}){
  const [rows,setRows]=useState(null);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  useEffect(()=>{
    let cancel=false;
    (async()=>{
      const {data,error}=await supabase.from("partido_boxscore").select("*").eq("id_partido",idPartido).order("titular",{ascending:false}).order("dorsal");
      if(cancel)return;
      if(error){setErr(error.message);setRows([]);return;}
      setRows((data||[]).map(r=>({...r})));
    })();
    return()=>{cancel=true;};
  },[idPartido]);
  const setCell=(i,k,v)=>setRows(rs=>rs.map((r,j)=>j===i?{...r,[k]:v}:r));
  const del=i=>setRows(rs=>rs.filter((_,j)=>j!==i));
  const addFromRoster=(idEquipo,jug)=>{
    if(jug&&rows.some(r=>r.id_jugadora===jug.id_jugadora))return;
    const dorsal=(jug?.seasons||[]).find(s=>s.id_equipo===idEquipo)?.dorsal ?? null;
    setRows(rs=>[...rs,emptyBoxRow(idEquipo,jug?.nombre||"",jug?.id_jugadora??null,dorsal)]);
  };
  const addLibre=idEquipo=>setRows(rs=>[...rs,emptyBoxRow(idEquipo,"",null,null)]);
  const save=async()=>{
    setErr("");setSaving(true);
    const sinNombre=rows.filter(r=>!(r.nombre&&r.nombre.trim()));
    if(sinNombre.length){setErr(`${sinNombre.length} fila(s) sin nombre — obligatorio`);setSaving(false);return;}
    const payload=rows.map(r=>{
      const o={id_partido:idPartido,id_jugadora:r.id_jugadora||null,id_equipo:r.id_equipo||null,nombre:r.nombre.trim(),dorsal:r.dorsal===""||r.dorsal==null?null:Number(r.dorsal),minutos:r.minutos===""||r.minutos==null?null:r.minutos,titular:!!r.titular};
      BOX_NUM_COLS.forEach(k=>{o[k]=Number(r[k])||0;});
      return o;
    });
    const d=await supabase.from("partido_boxscore").delete().eq("id_partido",idPartido);
    if(d.error){setErr(d.error.message);setSaving(false);return;}
    if(payload.length){
      const i=await supabase.from("partido_boxscore").insert(payload);
      if(i.error){setErr(i.error.message);setSaving(false);return;}
    }
    setSaving(false);
    onSaved&&onSaved();
    onClose&&onClose();
  };
  if(rows===null)return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"var(--fx-card)",borderRadius:"14px",padding:"28px",color:"var(--fx-text)"}}>Cargando…</div>
    </div>
  );
  const inpTxt={width:"100%",border:"1px solid var(--fx-border)",borderRadius:"6px",padding:"5px 7px",fontSize:"12px",background:"var(--fx-card)",color:"var(--fx-text)",boxSizing:"border-box"};
  const inpNum={...inpTxt,width:"52px",textAlign:"center",padding:"5px 4px"};
  const inpMin={...inpTxt,width:"64px",textAlign:"center",padding:"5px 4px"};
  const th={padding:"6px 4px",fontSize:"10px",fontWeight:700,color:"var(--fx-muted2)",textTransform:"uppercase",letterSpacing:"0.3px",whiteSpace:"nowrap",textAlign:"center",borderBottom:"2px solid var(--fx-border2)"};
  const td={padding:"4px 4px",borderBottom:"1px solid var(--fx-border2)",verticalAlign:"middle"};
  const equipoLabel=idEq=>idEq===local?.id_equipo?(local?.nombre||"Local"):idEq===visit?.id_equipo?(visit?.nombre||"Visitante"):"—";
  const AddRosterBtn=({idEquipo,roster,label})=>{
    const [open,setOpen]=useState(false);
    const usados=new Set(rows.filter(r=>r.id_equipo===idEquipo&&r.id_jugadora).map(r=>r.id_jugadora));
    const disponibles=(roster||[]).filter(p=>!usados.has(p.id_jugadora));
    return(
      <div style={{position:"relative",display:"inline-block"}}>
        <button onClick={()=>setOpen(o=>!o)} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"8px",padding:"6px 12px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>+ {label}</button>
        {open&&(
          <div style={{position:"absolute",top:"36px",left:0,zIndex:10,background:"var(--fx-card)",border:"1px solid var(--fx-border)",borderRadius:"10px",boxShadow:"0 6px 20px rgba(0,0,0,0.15)",minWidth:"220px",maxHeight:"320px",overflowY:"auto"}}>
            {disponibles.map(p=><button key={p.id_jugadora} onClick={()=>{addFromRoster(idEquipo,p);setOpen(false);}} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:"none",padding:"7px 12px",fontSize:"12px",color:"var(--fx-text)",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="var(--fx-hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{p.nombre}</button>)}
            {disponibles.length===0&&<div style={{padding:"10px 12px",fontSize:"11px",color:"var(--fx-muted2)"}}>Sin jugadoras disponibles</div>}
            <div style={{borderTop:"1px solid var(--fx-border2)"}}>
              <button onClick={()=>{addLibre(idEquipo);setOpen(false);}} style={{display:"block",width:"100%",textAlign:"left",background:"transparent",border:"none",padding:"7px 12px",fontSize:"11px",color:"var(--fx-muted)",cursor:"pointer",fontStyle:"italic"}}>+ Fila en blanco (nombre libre)</button>
            </div>
          </div>
        )}
      </div>
    );
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--fx-card)",borderRadius:"14px",padding:"20px",width:"min(1200px,98vw)",maxHeight:"92vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
          <h2 style={{margin:0,fontSize:"18px",fontWeight:800,color:"var(--fx-text)"}}>Editar boxscore</h2>
          <button onClick={onClose} aria-label="Cerrar editor de boxscore" style={{background:"transparent",border:"none",fontSize:"22px",cursor:"pointer",color:"var(--fx-muted)"}}>✕</button>
        </div>
        <div style={{display:"flex",gap:"10px",marginBottom:"12px",flexWrap:"wrap"}}>
          <AddRosterBtn idEquipo={local?.id_equipo} roster={rosterLocal} label={local?.nombre||"Local"}/>
          <AddRosterBtn idEquipo={visit?.id_equipo} roster={rosterVisit} label={visit?.nombre||"Visitante"}/>
        </div>
        <div style={{flex:1,overflow:"auto"}}>
          <table style={{borderCollapse:"collapse",width:"100%",minWidth:"1100px"}}>
            <thead><tr>
              <th style={{...th,textAlign:"left"}}>Equipo</th><th style={{...th,textAlign:"left"}}>Jugadora</th>
              <th style={th}>#</th><th style={th}>Tit</th><th style={th}>MIN</th><th style={th}>PTS</th>
              <th style={th}>TC-A</th><th style={th}>TC-I</th><th style={th}>T3-A</th><th style={th}>T3-I</th>
              <th style={th}>TL-A</th><th style={th}>TL-I</th><th style={th}>RO</th><th style={th}>RD</th>
              <th style={th}>RT</th><th style={th}>AST</th><th style={th}>ROB</th><th style={th}>TAP</th>
              <th style={th}>PER</th><th style={th}>FAL</th><th style={th}>VAL</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>{
                const es=r.id_equipo===local?.id_equipo;
                return(
                <tr key={i} style={{background:es?"var(--fx-amber-bg)":"var(--fx-blue-bg)"}}>
                  <td style={{...td,fontSize:"11px",color:"var(--fx-muted)",padding:"4px 8px"}}>{equipoLabel(r.id_equipo)}</td>
                  <td style={{...td,padding:"4px 6px"}}><input style={{...inpTxt,minWidth:"140px"}} value={r.nombre||""} onChange={e=>setCell(i,"nombre",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.dorsal??""} onChange={e=>setCell(i,"dorsal",e.target.value===""?null:Number(e.target.value))}/></td>
                  <td style={{...td,textAlign:"center"}}><input type="checkbox" checked={!!r.titular} onChange={e=>setCell(i,"titular",e.target.checked)}/></td>
                  <td style={td}><input style={inpMin} value={r.minutos??""} onChange={e=>setCell(i,"minutos",e.target.value)} placeholder="mm:ss"/></td>
                  <td style={td}><input style={inpNum} value={r.puntos??0} onChange={e=>setCell(i,"puntos",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.tc_anotados??0} onChange={e=>setCell(i,"tc_anotados",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.tc_intentados??0} onChange={e=>setCell(i,"tc_intentados",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.t3_anotados??0} onChange={e=>setCell(i,"t3_anotados",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.t3_intentados??0} onChange={e=>setCell(i,"t3_intentados",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.tl_anotados??0} onChange={e=>setCell(i,"tl_anotados",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.tl_intentados??0} onChange={e=>setCell(i,"tl_intentados",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.reb_ofensivos??0} onChange={e=>setCell(i,"reb_ofensivos",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.reb_defensivos??0} onChange={e=>setCell(i,"reb_defensivos",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.reb_totales??0} onChange={e=>setCell(i,"reb_totales",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.asistencias??0} onChange={e=>setCell(i,"asistencias",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.robos??0} onChange={e=>setCell(i,"robos",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.tapones??0} onChange={e=>setCell(i,"tapones",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.perdidas??0} onChange={e=>setCell(i,"perdidas",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.faltas??0} onChange={e=>setCell(i,"faltas",e.target.value)}/></td>
                  <td style={td}><input style={inpNum} value={r.valoracion??0} onChange={e=>setCell(i,"valoracion",e.target.value)}/></td>
                  <td style={{...td,textAlign:"center"}}><button onClick={()=>del(i)} title="Borrar fila" aria-label="Borrar fila" style={{background:"transparent",border:"none",cursor:"pointer",fontSize:"16px",color:"#dc2626"}}>🗑</button></td>
                </tr>
              );})}
              {rows.length===0&&<tr><td colSpan={22} style={{padding:"30px",textAlign:"center",color:"var(--fx-muted2)",fontSize:"13px"}}>Sin filas — usa los botones "+ &lt;equipo&gt;" para añadir jugadoras.</td></tr>}
            </tbody>
          </table>
        </div>
        {err&&<div style={{color:"#dc2626",fontSize:"12px",marginTop:"10px"}}>⚠ {err}</div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"14px",gap:"10px",flexWrap:"wrap"}}>
          <div style={{fontSize:"11px",color:"var(--fx-muted2)"}}>Guardar reemplaza el boxscore completo del partido ({rows.length} fila{rows.length===1?"":"s"}).</div>
          <div style={{display:"flex",gap:"10px"}}>
            <button onClick={onClose} disabled={saving} style={{background:"var(--fx-hover)",color:"var(--fx-label)",border:"none",borderRadius:"10px",padding:"9px 18px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"9px 20px",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:saving?0.5:1}}>{saving?"Guardando…":"Guardar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── PartidoFichaView ────────────────────────────────────── */
function BoxscorePartido({idPartido,equipoLocal,equipoVisit,local,visit,players,onGoToPlayer,isAdmin,rosterLocal,rosterVisit}){
  const t = useT();
  const [rows,setRows]=useState(null);
  const [tab,setTab]=useState("ambos");
  const [sortK,setSortK]=useState("puntos");
  const [sortD,setSortD]=useState("desc");
  const [editing,setEditing]=useState(false);
  const [reloadTick,setReloadTick]=useState(0);
  const jugMap=useMemo(()=>{const m={};(players||[]).forEach(p=>{m[p.id_jugadora]=p;});return m;},[players]);
  useEffect(()=>{
    let cancel=false; setRows(null);
    (async()=>{
      const {data}=await supabase.from("partido_boxscore").select("id_jugadora,id_equipo,nombre,titular,minutos,puntos,tc_anotados,tc_intentados,t3_anotados,t3_intentados,tl_anotados,tl_intentados,reb_totales,asistencias,robos,tapones,perdidas,faltas,valoracion").eq("id_partido",idPartido);
      if(!cancel)setRows(data||[]);
    })();
    return ()=>{cancel=true;};
  },[idPartido,reloadTick]);
  const editorEl=editing&&<BoxscoreEditor idPartido={idPartido} local={local} visit={visit} rosterLocal={rosterLocal} rosterVisit={rosterVisit} onClose={()=>setEditing(false)} onSaved={()=>setReloadTick(x=>x+1)}/>;
  if((rows===null||rows.length===0)&&isAdmin)return(<>
    <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"16px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"10px"}}>
      <div style={{fontSize:"13px",color:"var(--fx-muted)"}}>Este partido no tiene boxscore todavía.</div>
      <button onClick={()=>setEditing(true)} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"9px 16px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>✏️ Añadir boxscore</button>
    </div>
    {editorEl}
  </>);
  if(rows===null||rows.length===0)return null;

  const N=v=>{if(typeof v==="string"&&v.indexOf(":")>=0){const p=v.split(":");return (parseInt(p[0],10)||0)+(parseInt(p[1],10)||0)/60;}return Number(v)||0;};
  const filt=tab==="local"?rows.filter(r=>r.id_equipo===equipoLocal):tab==="visit"?rows.filter(r=>r.id_equipo===equipoVisit):rows;
  const cols=[{k:"nombre",l:"Jugadora"},{k:"minutos",l:"MIN"},{k:"puntos",l:"PTS"},{k:"tc_anotados",l:"TC"},{k:"t3_anotados",l:"T3"},{k:"tl_anotados",l:"TL"},{k:"reb_totales",l:"REB"},{k:"asistencias",l:"AST"},{k:"robos",l:"ROB"},{k:"tapones",l:"TAP"},{k:"perdidas",l:"PER"},{k:"faltas",l:"FAL"},{k:"valoracion",l:"VAL"}];
  const sorted=[...filt].sort((a,b)=>{
    if(sortK==="nombre")return sortD==="asc"?(a.nombre||"").localeCompare(b.nombre||""):(b.nombre||"").localeCompare(a.nombre||"");
    const d=N(a[sortK])-N(b[sortK]); return sortD==="asc"?d:-d;
  });
  const clickSort=k=>{if(sortK===k)setSortD(d=>d==="desc"?"asc":"desc");else{setSortK(k);setSortD(k==="nombre"?"asc":"desc");}};
  const th={padding:"7px 5px",fontSize:"10px",fontWeight:700,color:"var(--fx-muted2)",whiteSpace:"nowrap",cursor:"pointer",borderBottom:"2px solid #f1f5f9",userSelect:"none"};
  const td={padding:"7px 5px",fontSize:"12px",color:"var(--fx-text)",textAlign:"center",whiteSpace:"nowrap",borderBottom:"1px solid var(--fx-border2)"};
  const Esc=({e})=>e&&e.escudo?<img loading="lazy" decoding="async" src={e.escudo} alt="" style={{width:18,height:18,objectFit:"contain"}}/>:null;
  const tabBtn=(k,content)=><button key={k} onClick={()=>setTab(k)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"5px",padding:"9px 6px",borderRadius:"10px",border:"none",cursor:"pointer",fontWeight:700,fontSize:"12px",background:tab===k?"#9333ea":"#f1f5f9",color:tab===k?"#fff":"#64748b",minWidth:0}}>{content}</button>;

  return(<>
    <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"16px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",overflowX:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"0 0 12px",gap:"10px"}}>
        <h2 style={{fontWeight:800,fontSize:"16px",color:"var(--fx-text)",margin:0}}>{t("players.tab.stats")}</h2>
        {isAdmin&&<button onClick={()=>setEditing(true)} style={{background:"var(--fx-hover)",color:"var(--fx-label)",border:"none",borderRadius:"10px",padding:"6px 14px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>✏️ Editar boxscore</button>}
      </div>
      <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
        {tabBtn("ambos",<><Esc e={local}/><Esc e={visit}/></>)}
        {tabBtn("local",<><Esc e={local}/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{local&&local.nombre}</span></>)}
        {tabBtn("visit",<><Esc e={visit}/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{visit&&visit.nombre}</span></>)}
      </div>
      <table style={{borderCollapse:"collapse",width:"100%",minWidth:"640px"}}>
        <thead><tr>{cols.map(c=><th key={c.k} onClick={()=>clickSort(c.k)} style={{...th,textAlign:c.k==="nombre"?"left":"center"}}>{c.l}{sortK===c.k?(sortD==="desc"?" ▾":" ▴"):""}</th>)}</tr></thead>
        <tbody>
          {sorted.map((r,i)=>{
            const es=r.id_equipo===equipoLocal;
            const bg=es?"var(--fx-amber-bg)":"var(--fx-blue-bg)";
            const jug=jugMap[r.id_jugadora];
            const nom=(jug&&jug.nombre)||r.nombre;
            const foto=jug&&jug.foto;
            return(
            <tr key={i} onClick={()=>onGoToPlayer&&onGoToPlayer(r.id_jugadora)} style={{cursor:onGoToPlayer?"pointer":"default",background:tab==="ambos"?bg:"transparent",borderLeft:r.titular?"4px solid #9333ea":"4px solid transparent"}}>
              <td style={{...td,textAlign:"left",fontWeight:600,maxWidth:"180px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  {foto?<img loading="lazy" decoding="async" src={foto} alt="" style={{width:28,height:28,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"1px solid var(--fx-border2)"}} onError={e=>{e.target.style.visibility="hidden";}}/>:<div style={{width:28,height:28,borderRadius:"50%",background:"var(--fx-hover)",flexShrink:0}}/>}
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nom}</span>
                </div>
              </td>
              <td style={td}>{r.minutos}</td>
              <td style={{...td,fontWeight:700}}>{r.puntos}</td>
              <td style={td}>{r.tc_anotados}/{r.tc_intentados}</td>
              <td style={td}>{r.t3_anotados}/{r.t3_intentados}</td>
              <td style={td}>{r.tl_anotados}/{r.tl_intentados}</td>
              <td style={td}>{r.reb_totales}</td>
              <td style={td}>{r.asistencias}</td>
              <td style={td}>{r.robos}</td>
              <td style={td}>{r.tapones}</td>
              <td style={td}>{r.perdidas}</td>
              <td style={td}>{r.faltas}</td>
              <td style={{...td,fontWeight:700}}>{r.valoracion}</td>
            </tr>
            );})}
        </tbody>
      </table>
      <div style={{fontSize:"10px",color:"#cbd5e1",marginTop:"8px"}}><span style={{display:"inline-block",width:"3px",height:"10px",background:"#9333ea",borderRadius:"1px",verticalAlign:"middle",marginRight:"4px"}}></span>{t("boxscore.starter_hint")}</div>
    </div>
    {editorEl}
  </>);
}

function PartidoFichaView({partido,equipos,ligas,players,equiposNombres,isAdmin,onToggleConvocatoria,onBack,onEdit,onGoToTeam,onGoToLeague,onGoToPlayer}){
  const t = useT();
  const equipoMap=useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap=useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);
  const localBase=equipoMap[partido.id_equipo_local];
  const local=localBase&&{...localBase,...resolveTeamData(partido.id_equipo_local,partido.temporada,equiposNombres,equipoMap)};
  const visitBase=equipoMap[partido.id_equipo_visitante];
  const visit=visitBase&&{...visitBase,...resolveTeamData(partido.id_equipo_visitante,partido.temporada,equiposNombres,equipoMap)};
  const liga=ligaMap[partido.id_liga];
  const pasado=new Date(partido.fecha_hora)<new Date();
  const tieneResultado=partido.resultado_local!=null&&partido.resultado_visitante!=null;

  // Roster: jugadoras del equipo EN LA TEMPORADA del partido. Si el partido no tiene
  // temporada (datos antiguos), se cae al comportamiento previo: la temporada más
  // reciente de cada jugadora en ese equipo.
  const rosterPara=id=>{
    const temp=partido.temporada||"";
    let conTemp;
    if(temp){
      conTemp=players
        .filter(p=>(p.seasons||[]).some(s=>s.id_equipo===id&&(s.temporada||"")===temp))
        .map(p=>({...p,lastSeason:temp}));
    }else{
      const todas=players.filter(p=>(p.seasons||[]).some(s=>s.id_equipo===id));
      conTemp=todas.map(p=>{
        const seasonsEq=(p.seasons||[]).filter(s=>s.id_equipo===id).sort((a,b)=>b.temporada.localeCompare(a.temporada));
        return{...p,lastSeason:seasonsEq[0]?.temporada||""};
      });
    }
    // Ordenar por posición
    const orden=["Base","Escolta","Alero","Ala-Pívot","Pívot"];
    return conTemp.sort((a,b)=>(orden.indexOf(a.posicion)-orden.indexOf(b.posicion))||a.nombre.localeCompare(b.nombre,"es"));
  };

  // Convocatoria del partido: no_convocadas (jsonb) guarda ids de jugadoras de la
  // plantilla que NO juegan este partido. Solo afecta a esta ficha, no a la plantilla.
  const noConvocadas=useMemo(()=>new Set(partido.no_convocadas||[]),[partido]);
  const rosterLocal=useMemo(()=>rosterPara(partido.id_equipo_local),[partido,players]);
  const rosterVisit=useMemo(()=>rosterPara(partido.id_equipo_visitante),[partido,players]);

  const fmtDt=iso=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString(locale(),{weekday:"long",day:"numeric",month:"long",year:"numeric"})+" · "+d.toLocaleTimeString(locale(),{hour:"2-digit",minute:"2-digit"});};

  const RosterCol=({equipo,roster,side})=>{
    const convocadas=roster.filter(p=>!noConvocadas.has(p.id_jugadora));
    const fuera=roster.filter(p=>noConvocadas.has(p.id_jugadora));
    const fila=(p,esConvocada)=>(
      <div key={p.id_jugadora} onClick={()=>onGoToPlayer&&onGoToPlayer(p.id_jugadora)}
        style={{display:"flex",alignItems:"center",gap:"8px",padding:"6px 0",borderBottom:"1px solid var(--fx-border2)",flexDirection:side==="right"?"row-reverse":"row",cursor:onGoToPlayer?"pointer":"default",opacity:esConvocada?1:0.45}}>
        <Avatar photo={p.foto} name={p.nombre} size={28} fontSize={10} fallecida={!!p.fecha_fallecimiento}/>
        <div style={{flex:1,minWidth:0,textAlign:side==="right"?"right":"left"}}>
          <div style={{fontSize:"12px",fontWeight:600,color:onGoToPlayer?"#9333ea":"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:esConvocada?"none":"line-through"}}>{p.nombre}</div>
          <div style={{fontSize:"10px",color:"var(--fx-muted2)"}}>{p.posicion||""}</div>
        </div>
        {isAdmin&&onToggleConvocatoria&&(
          <button title={esConvocada?"Quitar de la convocatoria de este partido":"Devolver a la convocatoria"}
            onClick={e=>{e.stopPropagation();onToggleConvocatoria(partido,p.id_jugadora);}}
            style={{background:esConvocada?"var(--fx-red-bg)":"var(--fx-green-bg)",color:esConvocada?"#ef4444":"#16a34a",border:"none",borderRadius:"8px",width:"22px",height:"22px",fontSize:"12px",fontWeight:800,cursor:"pointer",flexShrink:0,lineHeight:1}}>
            {esConvocada?"✕":"+"}
          </button>
        )}
      </div>
    );
    return(
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px",flexDirection:side==="right"?"row-reverse":"row"}}>
          {equipo?.escudo&&<img loading="lazy" decoding="async" src={equipo.escudo} alt="" style={{width:32,height:32,objectFit:"contain"}}/>}
          <span style={{fontWeight:700,fontSize:"14px",color:"var(--fx-text)",textAlign:side==="right"?"right":"left"}}>{equipo?.nombre||"—"}</span>
        </div>
        {roster.length===0?<p style={{fontSize:"12px",color:"var(--fx-muted2)",textAlign:"center"}}>Sin jugadoras en BD</p>:(
          <>
            {convocadas.map(p=>fila(p,true))}
            {/* Las no convocadas solo las ve el admin (atenuadas, con + para devolverlas);
                para el público simplemente no aparecen en el partido. */}
            {isAdmin&&fuera.length>0&&(
              <>
                <div style={{fontSize:"10px",fontWeight:800,color:"var(--fx-muted2)",textTransform:"uppercase",letterSpacing:"0.5px",margin:"10px 0 2px",textAlign:side==="right"?"right":"left"}}>No convocadas (solo admin)</div>
                {fuera.map(p=>fila(p,false))}
              </>
            )}
          </>
        )}
      </div>
    );
  };

  return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"16px",fontFamily:"system-ui,sans-serif"}}>
      {/* Barra superior: volver + acciones (ver partido, stats, editar) */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",gap:"8px",flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#9333ea",fontWeight:700,fontSize:"15px",cursor:"pointer",padding:0}}>← Volver</button>
        <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
          {partido.link&&<a href={partido.link} target="_blank" rel="noopener noreferrer" style={{background:"#7c3aed",color:"#fff",borderRadius:"20px",padding:"7px 16px",fontSize:"12px",fontWeight:700,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:"5px"}}>▶ Ver partido</a>}
          {partido.url_stats&&<a href={partido.url_stats} target="_blank" rel="noopener noreferrer" style={{background:"#0f172a",color:"#fff",borderRadius:"20px",padding:"7px 16px",fontSize:"12px",fontWeight:700,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:"5px"}}>📊 Stats FIBA</a>}
          {isAdmin&&onEdit&&<button onClick={onEdit} style={{background:"var(--fx-hover)",color:"var(--fx-label)",border:"none",borderRadius:"20px",padding:"7px 16px",fontSize:"12px",fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"5px"}}>✏️ Editar</button>}
        </div>
      </div>

      {/* Cabecera del partido */}
      <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"20px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"16px"}}>
        {liga&&<div onClick={()=>onGoToLeague&&onGoToLeague(liga.id_liga)} style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"14px",cursor:onGoToLeague?"pointer":"default"}}>
          {liga.logo&&<img loading="lazy" decoding="async" src={liga.logo} alt="" style={{width:20,height:20,objectFit:"contain"}}/>}
          <span style={{fontWeight:700,fontSize:"13px",color:"#9333ea",textDecoration:onGoToLeague?"underline":"none"}}>{liga.nombre}</span>
        </div>}
        <div style={{fontSize:"12px",color:"var(--fx-muted2)",marginBottom:"16px",fontWeight:600}}>
          {fmtDt(partido.fecha_hora)}{pasado&&!tieneResultado&&<span style={{marginLeft:"8px",color:"#f59e0b",fontWeight:700}}>{t("partidos.finalizado")}</span>}
          {partido.notas&&<span style={{marginLeft:"8px",color:"var(--fx-label)"}}>· {partido.notas}</span>}
        </div>

        {/* Marcador compacto: escudo — resultado/vs — escudo */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"16px"}}>
          <div onClick={()=>onGoToTeam&&onGoToTeam(partido.id_equipo_local,partido.temporada)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",cursor:onGoToTeam?"pointer":"default",flex:1}}>
            {local?.escudo
              ?<img loading="lazy" decoding="async" src={local.escudo} alt={local?.nombre} title={local?.nombre} style={{width:56,height:56,objectFit:"contain"}}/>
              :<div style={{width:56,height:56,borderRadius:"50%",background:"var(--fx-lila-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",fontWeight:800,color:"#9333ea"}}>{(local?.nombre||"L").slice(0,1)}</div>}
            <span style={{fontSize:"11px",fontWeight:600,color:"var(--fx-muted)",textAlign:"center",maxWidth:"80px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{local?.nombre||"—"}</span>
          </div>
          <div style={{flexShrink:0,textAlign:"center",minWidth:"70px"}}>
            {tieneResultado?(
              <div style={{fontWeight:800,fontSize:"32px",color:"var(--fx-text)",letterSpacing:"3px"}}>{partido.resultado_local}<span style={{color:"var(--fx-muted2)",margin:"0 4px"}}>–</span>{partido.resultado_visitante}</div>
            ):(
              <span style={{fontWeight:800,fontSize:"22px",color:"#9333ea"}}>vs</span>
            )}
          </div>
          <div onClick={()=>onGoToTeam&&onGoToTeam(partido.id_equipo_visitante,partido.temporada)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",cursor:onGoToTeam?"pointer":"default",flex:1}}>
            {visit?.escudo
              ?<img loading="lazy" decoding="async" src={visit.escudo} alt={visit?.nombre} title={visit?.nombre} style={{width:56,height:56,objectFit:"contain"}}/>
              :<div style={{width:56,height:56,borderRadius:"50%",background:"var(--fx-lila-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",fontWeight:800,color:"#9333ea"}}>{(visit?.nombre||"V").slice(0,1)}</div>}
            <span style={{fontSize:"11px",fontWeight:600,color:"var(--fx-muted)",textAlign:"center",maxWidth:"80px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{visit?.nombre||"—"}</span>
          </div>
        </div>
        {partido.parciales&&partido.parciales.local&&(
          <div style={{marginTop:"14px",overflowX:"auto"}}>
            <table style={{margin:"0 auto",borderCollapse:"collapse",fontSize:"12px",fontVariantNumeric:"tabular-nums"}}>
              <thead>
                <tr style={{color:"var(--fx-muted2)",fontWeight:700}}>
                  <td style={{padding:"3px 10px"}}></td>
                  {partido.parciales.local.map((_,i)=><td key={i} style={{padding:"3px 10px",textAlign:"center"}}>Q{i+1}</td>)}
                  {partido.parciales.prorroga&&<td style={{padding:"3px 10px",textAlign:"center"}}>PR</td>}
                </tr>
              </thead>
              <tbody>
                {[["local",local],["visitante",visit]].map(([lado,team],fila)=>(
                  <tr key={lado} style={{borderTop:"1px solid var(--fx-border2)",color:"var(--fx-label)"}}>
                    <td style={{padding:"3px 10px",fontWeight:700,maxWidth:"110px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{team?.nombre||"—"}</td>
                    {partido.parciales[lado].map((q,i)=><td key={i} style={{padding:"3px 10px",textAlign:"center"}}>{q}</td>)}
                    {partido.parciales.prorroga&&<td style={{padding:"3px 10px",textAlign:"center",fontWeight:700,color:"#9333ea"}}>{partido.parciales.prorroga[fila]}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BoxscorePartido idPartido={partido.id} equipoLocal={partido.id_equipo_local} equipoVisit={partido.id_equipo_visitante} local={local} visit={visit} players={players} onGoToPlayer={onGoToPlayer} isAdmin={isAdmin} rosterLocal={rosterLocal} rosterVisit={rosterVisit}/>
    </div>
  );
}

/* ── PartidosView ────────────────────────────────────────── */
function getPartidoEstado(p){
  const now=new Date();
  const fh=new Date(p.fecha_hora);
  const diffMs=now-fh; // positivo = ya empezó
  // La Edge Function escribe el marcador EN VIVO en resultado_local/visitante y
  // marca es_live=true mientras el partido está en curso (es_live=false al acabar).
  // Ventana de seguridad de 4h por si un fallo del scraper dejara es_live colgado.
  const tieneResultado=p.resultado_local!=null&&p.resultado_visitante!=null;
  if(p.es_live&&diffMs>=0&&diffMs<4*60*60*1000)return"en_juego";
  if(tieneResultado)return"terminado";
  if(diffMs>=0&&diffMs<4*60*60*1000)return"en_juego"; // recién empezado, aún sin resultado
  const esHoy=fh.toDateString()===now.toDateString();
  if(esHoy)return"proximo";
  return"normal";
}

function PartidosView({partidos,equipos,ligas,players,mvps,equiposNombres,openClasiKey,onClearClasi,partidosSub,isAdmin,setPartidos,onGoToTeam,onGoToLeague,onGoToPlayer}){
  const t = useT();
  const [modal,setModal]=useState(null);
  const [ficha,setFicha]=useState(null);
  const [saving,setSaving]=useState(false);
  const [expandedLigas,setExpandedLigas]=useState({});
  const [fibaModal,setFibaModal]=useState(null); // {ligaId,temporada}
  const [fibaSlug,setFibaSlug]=useState("");
  const [fibaGuardando,setFibaGuardando]=useState(false);
  const [fibaMensaje,setFibaMensaje]=useState("");
  const [fibaResultado,setFibaResultado]=useState(null);

  async function fibaActivar(modo="crear_evento"){
    if(!fibaModal.ligaId||!fibaModal.temporada){setFibaMensaje("Selecciona liga y temporada");return;}
    if(!fibaSlug.trim()){setFibaMensaje("Introduce el slug de FIBA");return;}
    setFibaGuardando(true);setFibaMensaje("");setFibaResultado(null);
    try{
      const d=await callFn("actualizar-resultados-fiba",{modo,id_liga:fibaModal.ligaId,temporada:fibaModal.temporada,slug:fibaSlug.trim()});
      if(d.ok){
        setFibaResultado(d);
        setFibaMensaje(modo==="desde_standings"?"✅ Standings cargado":"✅ Hecho");
      } else {
        setFibaMensaje("❌ "+(d.error||"Error desconocido"));
      }
    }catch(e){setFibaMensaje("❌ "+e.message);}
    setFibaGuardando(false);
  }
  const [expandedJornadas,setExpandedJornadas]=useState({});
  const [archivoOpen,setArchivoOpen]=useState(false);
  const [archivoTempOpen,setArchivoTempOpen]=useState({});
  const [clasiLigaId,setClasiLigaId]=useState(null);
  const [clasiVista,setClasiVista]=useState("grupos");
  const [filtroLiga,setFiltroLiga]=useState("");
  const [filtroEquipo,setFiltroEquipo]=useState("");
  const [soloLive,setSoloLive]=useState(false);
  useEffect(()=>{
    if(openClasiKey){
      const [l,t]=openClasiKey.split("|");
      setClasiVista("grupos");
      window.history.pushState({},"",`/partidos/clasificacion/${l}/${encodeURIComponent(t||"")}`);
      setFicha(null);setClasiLigaId(openClasiKey);
      onClearClasi&&onClearClasi();
    }
  },[openClasiKey]);

  // La URL es la fuente de verdad de la subvista: /partidos/partido/{id} abre la ficha,
  // /partidos/clasificacion/{liga}/{temporada} abre la clasificación y /partidos limpia
  // ambas. Así el botón atrás del navegador (popstate -> applyUrlState -> partidosSub)
  // recorre ficha -> clasificación -> lista en orden, en vez de salirse de la pestaña.
  useEffect(()=>{
    if(!partidosSub||partidosSub.length===0){setFicha(null);setClasiLigaId(null);return;}
    if(partidosSub[0]==="clasificacion"){
      setFicha(null);
      setClasiLigaId(`${partidosSub[1]}|${decodeURIComponent(partidosSub[2]||"")}`);
    }
  },[partidosSub]);
  // Efecto aparte con dependencia de `partidos`: además de resolver la ficha en un
  // deep-link (cuando los datos aún no habían cargado), refresca el objeto de la ficha
  // con el marcador en vivo sin que el auto-refresh cierre la clasificación.
  useEffect(()=>{
    if(partidosSub&&partidosSub[0]==="partido"){
      const p=partidos.find(x=>String(x.id)===String(partidosSub[1]));
      if(p)setFicha(p);
      else{(async()=>{const {data}=await supabase.from("partidos").select("*").eq("id",partidosSub[1]).maybeSingle();if(data)setFicha(data);})();}
    }
  },[partidosSub,partidos]);

  const toggleConvocatoria=async(partido,idJugadora)=>{
    const actual=partido.no_convocadas||[];
    const nueva=actual.includes(idJugadora)?actual.filter(x=>x!==idJugadora):[...actual,idJugadora];
    const valor=nueva.length?nueva:null;
    const{error}=await supabase.from("partidos").update({no_convocadas:valor}).eq("id",partido.id);
    if(error){alert("Error guardando la convocatoria: "+error.message);return;}
    setPartidos(prev=>prev.map(x=>x.id===partido.id?{...x,no_convocadas:valor}:x));
    setFicha(prev=>prev&&prev.id===partido.id?{...prev,no_convocadas:valor}:prev);
  };

  const abrirFicha=p=>{
    window.history.pushState({},"",`/partidos/partido/${p.id}`);
    setFicha(p);
  };
  const abrirClasi=(grupoKey,vista)=>{
    const [l,t]=grupoKey.split("|");
    setClasiVista(vista);
    window.history.pushState({},"",`/partidos/clasificacion/${l}/${encodeURIComponent(t||"")}`);
    setFicha(null);setClasiLigaId(grupoKey);
  };
  const equipoMap=useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  const ligaMap=useMemo(()=>{const m={};ligas.forEach(l=>m[l.id_liga]=l);return m;},[ligas]);
  const scrollRef=useRef(null);

  const filtrados=useMemo(()=>partidos.filter(p=>
    (!filtroLiga||p.id_liga===filtroLiga)&&
    (!filtroEquipo||p.id_equipo_local===filtroEquipo||p.id_equipo_visitante===filtroEquipo)&&
    (!soloLive||p.es_live===true)
  ),[partidos,filtroLiga,filtroEquipo,soloLive]);
  const sorted=useMemo(()=>[...filtrados].sort((a,b)=>new Date(b.fecha_hora)-new Date(a.fecha_hora)),[filtrados]);
  // Opciones de los filtros: solo ligas y equipos que aparecen en partidos
  const ligasConPartidos=useMemo(()=>{
    const ids=new Set(partidos.map(p=>p.id_liga).filter(Boolean));
    return ligas.filter(l=>ids.has(l.id_liga)).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  },[partidos,ligas]);
  const equiposConPartidos=useMemo(()=>{
    const base=filtroLiga?partidos.filter(p=>p.id_liga===filtroLiga):partidos;
    const ids=new Set();
    base.forEach(p=>{if(p.id_equipo_local)ids.add(p.id_equipo_local);if(p.id_equipo_visitante)ids.add(p.id_equipo_visitante);});
    return equipos.filter(e=>ids.has(e.id_equipo)).sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  },[partidos,equipos,filtroLiga]);
  const byLiga=useMemo(()=>{const m={};sorted.forEach(p=>{const k=`${p.id_liga||"sin_liga"}|${p.temporada||""}`;if(!m[k])m[k]=[];m[k].push(p);});return m;},[sorted]);

  // Determinar el id del partido al que hay que hacer scroll:
  // primero un "en_juego", si no hay ninguno el primer "proximo"
  const scrollTargetId=useMemo(()=>{
    const enJuego=sorted.find(p=>getPartidoEstado(p)==="en_juego");
    if(enJuego)return enJuego.id;
    const proximo=sorted.find(p=>getPartidoEstado(p)==="proximo");
    return proximo?.id??null;
  },[sorted]);

  useEffect(()=>{
    if(scrollRef.current){
      setTimeout(()=>scrollRef.current?.scrollIntoView({behavior:"smooth",block:"center"}),300);
    }
  },[scrollTargetId]);

  // Autorefresh: cada 30s si hay al menos un partido en juego. Manual con botón 🔄.
  // Solo refetchea los partidos live + los que empiezan en la próxima hora (para pillar
  // el paso a live). Fusiona en el estado sin reemplazarlo (evita perder filas por
  // el límite 1000 de PostgREST).
  const [refrescando,setRefrescando]=useState(false);
  const refetchPartidos=useCallback(async()=>{
    setRefrescando(true);
    try{
      const nowIso=new Date().toISOString();
      const inHourIso=new Date(Date.now()+60*60*1000).toISOString();
      const {data}=await supabase.from("partidos")
        .select("id,resultado_local,resultado_visitante,es_live,periodo,parciales")
        .or(`es_live.eq.true,and(fecha_hora.gte.${nowIso},fecha_hora.lte.${inHourIso})`);
      if(data&&data.length){
        const patch=new Map(data.map(r=>[r.id,r]));
        setPartidos(prev=>prev.map(p=>patch.has(p.id)?{...p,...patch.get(p.id)}:p));
      }
    }catch(e){/* silencioso */}
    setRefrescando(false);
  },[setPartidos]);
  const hayLive=useMemo(()=>partidos.some(p=>p.es_live===true),[partidos]);
  useEffect(()=>{
    if(!hayLive)return;
    const id=setInterval(refetchPartidos,5000);
    return ()=>clearInterval(id);
  },[hayLive,refetchPartidos]);

  const save=async f=>{
    setSaving(true);
    try{
      const payload={id_liga:f.id_liga||null,temporada:f.temporada||null,id_equipo_local:f.id_equipo_local||null,id_equipo_visitante:f.id_equipo_visitante||null,fecha_hora:f.fecha_hora,link:f.link||null,url_stats:f.url_stats||null,notas:f.notas||null,resultado_local:f.resultado_local!=null&&f.resultado_local!==""?Number(f.resultado_local):null,resultado_visitante:f.resultado_visitante!=null&&f.resultado_visitante!==""?Number(f.resultado_visitante):null};
      if(f.id){
        const{error}=await supabase.from("partidos").update(payload).eq("id",f.id);
        if(error)throw error;
        setPartidos(prev=>prev.map(p=>p.id===f.id?{...p,...payload,id:f.id}:p));
      }else{
        const{data,error}=await supabase.from("partidos").insert(payload).select().single();
        if(error)throw error;
        setPartidos(prev=>[...prev,data].sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora)));
      }
      setModal(null);
    }catch(e){alert("Error guardando: "+e.message);}
    setSaving(false);
  };

  const del=async id=>{
    if(!window.confirm("¿Eliminar este partido?"))return;
    await supabase.from("partidos").delete().eq("id",id);
    setPartidos(prev=>prev.filter(p=>p.id!==id));
  };

  const fmtDt=iso=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString(locale(),{weekday:"short",day:"numeric",month:"short"})+" · "+d.toLocaleTimeString(locale(),{hour:"2-digit",minute:"2-digit"});};
  const fmtDia=iso=>iso?new Date(iso).toLocaleDateString(locale(),{day:"numeric",month:"short"}):"";
  const fmtRango=games=>{if(!games.length)return"";const a=fmtDia(games[0].fecha_hora),b=fmtDia(games[games.length-1].fecha_hora);return a===b?a:a+" – "+b;};

  if(ficha&&!modal){
    return <PartidoFichaView partido={ficha} equipos={equipos} ligas={ligas} players={players} equiposNombres={equiposNombres} isAdmin={isAdmin} onToggleConvocatoria={toggleConvocatoria} onBack={()=>window.history.back()} onEdit={()=>setModal(ficha)} onGoToTeam={onGoToTeam} onGoToLeague={onGoToLeague} onGoToPlayer={id=>onGoToPlayer&&onGoToPlayer(id,{tab:"partidos",label:"Info partido"})}/>;
  }

  if(clasiLigaId){
    const [cLiga,cTemporada]=clasiLigaId.split("|");
    return <ClasificacionGrupos partidos={partidos} equipos={equipos} ligas={ligas} ligaId={cLiga} temporada={cTemporada} vistaInicial={clasiVista} onBack={()=>window.history.back()} onGoToTeam={onGoToTeam} onOpenPartido={abrirFicha} onVistaChange={setClasiVista} mvps={mvps} players={players} onGoToPlayer={onGoToPlayer} equiposNombres={equiposNombres}/>;
  }

  if(modal){
    return <div style={{padding:"16px"}}><PartidoForm initial={modal==="add"?null:modal} equipos={equipos} ligas={ligas} onSave={save} onCancel={()=>setModal(null)} saving={saving}/></div>;
  }

  return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"16px",fontFamily:"system-ui,sans-serif"}}>
    {fibaModal&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{background:"var(--fx-card)",borderRadius:"20px",padding:"24px",width:"100%",maxWidth:"400px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
          <div style={{fontWeight:800,fontSize:"16px",color:"var(--fx-text)",marginBottom:"4px"}}>⚡ Activar seguimiento FIBA live</div>
          {fibaModal.global?(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"16px"}}>
              <div>
                <div style={{fontSize:"12px",fontWeight:600,color:"var(--fx-label)",marginBottom:"4px"}}>Liga</div>
                <select value={fibaModal.ligaId} onChange={e=>setFibaModal(m=>({...m,ligaId:e.target.value}))} style={{width:"100%",padding:"9px 10px",borderRadius:"10px",border:"1.5px solid var(--fx-border)",fontSize:"13px"}}>
                  <option value="">Seleccionar...</option>
                  {ligas.map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:"12px",fontWeight:600,color:"var(--fx-label)",marginBottom:"4px"}}>Temporada</div>
                <input value={fibaModal.temporada} onChange={e=>setFibaModal(m=>({...m,temporada:e.target.value}))} placeholder="2026" style={{width:"100%",padding:"9px 10px",borderRadius:"10px",border:"1.5px solid var(--fx-border)",fontSize:"13px",boxSizing:"border-box"}}/>
              </div>
            </div>
          ):(
            <div style={{fontSize:"12px",color:"var(--fx-muted)",marginBottom:"16px"}}>{fibaModal.ligaId} · {fibaModal.temporada}</div>
          )}
          <div style={{marginBottom:"16px"}}>
            <div style={{fontSize:"12px",fontWeight:600,color:"var(--fx-label)",marginBottom:"4px"}}>Slug de FIBA</div>
            <input value={fibaSlug} onChange={e=>setFibaSlug(e.target.value)} placeholder="fiba-u18-womens-eurobasket-2026" style={{width:"100%",padding:"10px 12px",borderRadius:"10px",border:"1.5px solid var(--fx-border)",fontSize:"13px",boxSizing:"border-box"}}/>
            <div style={{fontSize:"11px",color:"var(--fx-muted2)",marginTop:"4px"}}>URL: fiba.basketball/en/events/<b>SLUG</b>/games · Fechas detectadas automáticamente</div>
          </div>
          {fibaMensaje&&<div style={{fontSize:"13px",color:fibaMensaje.startsWith("✅")?"#059669":"#ef4444",marginBottom:"12px",fontWeight:600}}>{fibaMensaje}</div>}
          {fibaResultado&&<div style={{background:"var(--fx-green-bg)",borderRadius:"10px",padding:"12px",marginBottom:"12px",fontSize:"12px",color:"var(--fx-green-text)"}}>
            <div>📅 {fibaResultado.fecha_ini} → {fibaResultado.fecha_fin}</div>
            <div>✅ Partidos creados: <b>{fibaResultado.creados}</b> · Ya existían: <b>{fibaResultado.ya_existian}</b></div>
            {(fibaResultado.notas_actualizadas>0||fibaResultado.slots_actualizados>0)&&<div>📝 Notas: <b>{(fibaResultado.notas_actualizadas||0)+(fibaResultado.slots_actualizados||0)}</b> actualizadas</div>}
            <div>🔑 Equipos mapeados: <b>{fibaResultado.codigos_generados}</b></div>
            {fibaResultado.activo&&<div style={{marginTop:"8px",padding:"8px",background:"var(--fx-red-bg)",borderRadius:"8px",color:"var(--fx-red-text)",fontWeight:700}}>🔴 Seguimiento en vivo activado (auto-refresh cada 3 min; se desactiva solo al terminar el torneo)</div>}
            {fibaResultado.sin_mapear?.length>0&&<div style={{color:"var(--fx-amber-text)",marginTop:"4px"}}>⚠️ Sin mapear: {fibaResultado.sin_mapear.join(", ")}</div>}
          </div>}
          <div style={{display:"flex",gap:"10px"}}>
            <button onClick={()=>{setFibaModal(null);setFibaResultado(null);}} style={{flex:1,padding:"10px",borderRadius:"12px",border:"1.5px solid var(--fx-border)",background:"var(--fx-hover)",fontWeight:600,fontSize:"13px",cursor:"pointer"}}>Cerrar</button>
            {!fibaResultado&&<><button onClick={()=>fibaActivar("crear_evento")} disabled={fibaGuardando} style={{flex:1,padding:"10px",borderRadius:"12px",border:"none",background:"#059669",color:"#fff",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:fibaGuardando?0.6:1}}>{fibaGuardando?"Cargando...":"Activar"}</button><button onClick={()=>fibaActivar("desde_standings")} disabled={fibaGuardando} title="Carga bracket y clasificaciones desde la página standings de FIBA" style={{flex:1,padding:"10px",borderRadius:"12px",border:"none",background:"#7c3aed",color:"#fff",fontWeight:700,fontSize:"13px",cursor:"pointer",opacity:fibaGuardando?0.6:1}}>{fibaGuardando?"Cargando...":"📊 Standings"}</button></>}
          </div>
        </div>
      </div>
    )}
      <div style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1.5px solid #f59e0b",borderRadius:"16px",padding:"16px 20px",marginBottom:"20px",display:"flex",alignItems:"center",gap:"12px"}}>
        <span style={{fontSize:"24px"}}>🚧</span>
        <div>
          <div style={{fontWeight:700,fontSize:"14px",color:"#92400e"}}>Sección en pruebas</div>
          <div style={{fontSize:"12px",color:"var(--fx-amber-text)",marginTop:"2px"}}>Esta funcionalidad está en desarrollo. Los datos pueden no ser definitivos.</div>
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px",flexWrap:"wrap",gap:"10px"}}>
        <h1 style={{fontWeight:800,fontSize:"22px",color:"var(--fx-text)",margin:0}}>📺 Ver partidos</h1>
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <button onClick={refetchPartidos} disabled={refrescando} title="Actualizar" style={{background:"#f5f3ff",color:"#7c3aed",border:"1.5px solid #ddd6fe",borderRadius:"12px",padding:"9px 14px",fontWeight:700,fontSize:"13px",cursor:refrescando?"wait":"pointer"}}>{refrescando?"⏳":"🔄"}{hayLive&&<span style={{marginLeft:"6px",width:8,height:8,borderRadius:"50%",background:"#ef4444",display:"inline-block",verticalAlign:"middle",boxShadow:"0 0 0 3px rgba(239,68,68,0.2)"}}/>}</button>
          {isAdmin&&<button onClick={()=>{setFibaSlug("");setFibaMensaje("");setFibaResultado(null);setFibaModal({ligaId:filtroLiga||"",temporada:"",global:true});}} style={{background:"#ecfdf5",color:"#059669",border:"1.5px solid #6ee7b7",borderRadius:"12px",padding:"9px 18px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>⚡ FIBA Live</button>}
          {isAdmin&&<button onClick={()=>setModal("add")} style={{background:"#9333ea",color:"#fff",border:"none",borderRadius:"12px",padding:"9px 18px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>+ Partido</button>}
        </div>
      </div>

      <div style={{display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap"}}>
        <select value={filtroLiga} onChange={e=>{setFiltroLiga(e.target.value);setFiltroEquipo("");}}
          style={{flex:"1 1 180px",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:"var(--fx-label)",background:"var(--fx-card)",outline:"none"}}>
          <option value="">{t("partidos.all_leagues")}</option>
          {ligasConPartidos.map(l=><option key={l.id_liga} value={l.id_liga}>{l.nombre}</option>)}
        </select>
        <select value={filtroEquipo} onChange={e=>setFiltroEquipo(e.target.value)}
          style={{flex:"1 1 180px",border:"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 12px",fontSize:"13px",color:"var(--fx-label)",background:"var(--fx-card)",outline:"none"}}>
          <option value="">{t("partidos.all_teams")}</option>
          {equiposConPartidos.map(e=><option key={e.id_equipo} value={e.id_equipo}>{e.nombre}</option>)}
        </select>
        {hayLive&&<button onClick={()=>setSoloLive(v=>!v)} title="Ver solo partidos en juego" style={{border:soloLive?"1.5px solid #ef4444":"1.5px solid #fecaca",borderRadius:"10px",padding:"9px 14px",fontSize:"13px",fontWeight:700,cursor:"pointer",background:soloLive?"#ef4444":"var(--fx-red-bg)",color:soloLive?"#fff":"var(--fx-red-text)",display:"inline-flex",alignItems:"center",gap:"6px"}}><span style={{width:8,height:8,borderRadius:"50%",background:soloLive?"#fff":"#ef4444",display:"inline-block",boxShadow:soloLive?"none":"0 0 0 3px rgba(239,68,68,0.2)"}}/>🔴 Solo live</button>}
      </div>

      {sorted.length===0?(
        <div style={{textAlign:"center",padding:"60px 20px",color:"var(--fx-muted2)"}}>
          <div style={{fontSize:"48px",marginBottom:"12px"}}>📺</div>
          <div style={{fontWeight:600,fontSize:"16px"}}>{t("partidos.no_scheduled")}</div>
          {isAdmin&&<div style={{fontSize:"13px",marginTop:"6px"}}>Pulsa "+ Partido" para añadir el primero</div>}
        </div>
      ):(()=>{
        const renderGrupo=(grupoKey,ps)=>{
          const [ligaId,temporada]=grupoKey.split("|");
          const hoy=new Date().toDateString();
          const esHoy=p=>new Date(p.fecha_hora).toDateString()===hoy;
          const partHoy=ps.filter(p=>esHoy(p)).sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora));
          const resultados=ps.filter(p=>getPartidoEstado(p)==="terminado"&&!esHoy(p)).sort((a,b)=>new Date(b.fecha_hora)-new Date(a.fecha_hora));
          const proximos=ps.filter(p=>(getPartidoEstado(p)==="proximo"||getPartidoEstado(p)==="normal")&&!esHoy(p)).sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora));
          const hayEnJuego=ps.some(p=>getPartidoEstado(p)==="en_juego");
          const hayHoy=partHoy.length>0;
          const expanded=expandedLigas[grupoKey]??false;

          // En competiciones tipo "liga" los partidos se agrupan por jornada (campo notas
          // "Jornada N"); los de playoffs y los que no tienen jornada van a grupos propios.
          // Fallback: si NINGÚN partido de la liga trae "Jornada N" en notas, se
          // agrupan por semana ISO cronológicamente y se numeran 1..N. Sirve para
          // ligas cuyo scraper no rellena notas (ej. Genius Sports / DBBF).
          const esLiga=ligaMap[ligaId]?.tipo==="liga";
          let jornadas=[];
          if(esLiga){
            const buckets={};
            const hayJornadaEnNotas=ps.some(p=>/(?:^|·\s*)jornada\s+\d+/i.test(p.notas||""));
            const isoWeekKey=(d)=>{const dt=new Date(d);if(isNaN(dt))return null;dt.setUTCHours(0,0,0,0);dt.setUTCDate(dt.getUTCDate()+4-(dt.getUTCDay()||7));const y0=new Date(Date.UTC(dt.getUTCFullYear(),0,1));const wn=Math.ceil((((dt-y0)/86400000)+1)/7);return`${dt.getUTCFullYear()}W${String(wn).padStart(2,"0")}`;};
            let semanaAJornada=null;
            if(!hayJornadaEnNotas){
              const semanas=new Set();
              ps.forEach(p=>{if(p.fecha_hora){const w=isoWeekKey(p.fecha_hora);if(w)semanas.add(w);}});
              const ordenadas=[...semanas].sort();
              semanaAJornada={};
              ordenadas.forEach((s,i)=>{semanaAJornada[s]=i+1;});
            }
            ps.forEach(p=>{
              const m=/(?:^|·\s*)jornada\s+(\d+)/i.exec(p.notas||"");
              const grpM=/^grupo\s+(\w+)/i.exec(p.notas||"");
              let key;
              if(m) key=grpM?`G${grpM[1]}J${m[1]}`:`J${m[1]}`;
              else if(/^playoffs/i.test(p.notas||"")) key="PO";
              else if(semanaAJornada&&p.fecha_hora){const j=semanaAJornada[isoWeekKey(p.fecha_hora)];key=j?`J${j}`:"OT";}
              else key="OT";
              (buckets[key]=buckets[key]||[]).push(p);
            });
            const rank=k=>{if(k==="PO")return 1000000;if(k==="OT")return 1000001;const gm=k.match(/^G(\w+)J(\d+)$/);if(gm)return parseInt(gm[2])*100+gm[1].charCodeAt(0);return parseInt(k.slice(1),10);};
            jornadas=Object.keys(buckets).sort((a,b)=>rank(a)-rank(b)).map(k=>{
              const games=buckets[k].sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora));
              const gm=k.match(/^G(\w+)J(\d+)$/);
              const lbl=k==="PO"?t("partidos.playoffs"):k==="OT"?t("partidos.otros"):gm?t("partidos.grupo_jornada",{g:gm[1],n:gm[2]}):t("partidos.jornada",{n:k.slice(1)});
              return{key:k,label:lbl,games,
                pendiente:games.some(p=>getPartidoEstado(p)!=="terminado"),
                enJuego:games.some(p=>getPartidoEstado(p)==="en_juego")};
            });
            const primeraPend=jornadas.find(j=>j.pendiente);
            if(primeraPend)primeraPend.proxima=true;
          }

          const TarjetaPartido=({p})=>{
            const local=equipoMap[p.id_equipo_local]&&{...equipoMap[p.id_equipo_local],...resolveTeamData(p.id_equipo_local,p.temporada,equiposNombres,equipoMap)};
            const visit=equipoMap[p.id_equipo_visitante]&&{...equipoMap[p.id_equipo_visitante],...resolveTeamData(p.id_equipo_visitante,p.temporada,equiposNombres,equipoMap)};
            const tieneResultado=p.resultado_local!=null&&p.resultado_visitante!=null;
            const estado=getPartidoEstado(p);
            const esPrimeroDestacado=p.id===scrollTargetId;
            const borderStyle=estado==="en_juego"?"2px solid #ef4444":tieneResultado?"1.5px solid var(--fx-border)":"1.5px solid #e9d5ff";
            const animStyle=estado==="en_juego"?{animation:"partidoPulse 2s infinite"}:{};
            return(
              <div ref={esPrimeroDestacado?scrollRef:null}
                onClick={()=>abrirFicha(p)}
                style={{background:"var(--fx-card)",borderRadius:"14px",padding:"14px",boxShadow:estado==="en_juego"?"0 2px 12px rgba(239,68,68,0.15)":"0 1px 4px rgba(0,0,0,0.06)",border:borderStyle,cursor:"pointer",...animStyle}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px",flexWrap:"wrap"}}>
                  {estado==="en_juego"&&<span style={{background:"#ef4444",color:"#fff",borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontWeight:800,letterSpacing:"0.5px"}}>🔴 EN JUEGO{p.es_live&&p.periodo?` · P${p.periodo}`:""}</span>}
                  {estado==="proximo"&&<span style={{background:"#f59e0b",color:"#fff",borderRadius:"20px",padding:"2px 10px",fontSize:"11px",fontWeight:700}}>🟡 HOY</span>}
                  <span style={{fontSize:"11px",color:"var(--fx-muted2)",fontWeight:600}}>{fmtDt(p.fecha_hora)}</span>
                  {p.notas&&<span style={{fontSize:"11px",color:"var(--fx-muted)"}}>· {p.notas}</span>}
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"7px",flex:1,minWidth:"80px"}}>
                    {local?.escudo&&<img loading="lazy" decoding="async" src={local.escudo} alt="" style={{width:28,height:28,objectFit:"contain",flexShrink:0}}/>}
                    <span style={{fontWeight:700,fontSize:"12px",color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{local?.nombre||"—"}</span>
                  </div>
                  <div style={{flexShrink:0,textAlign:"center",minWidth:"52px"}}>
                    {tieneResultado
                      ?<span style={{fontWeight:800,fontSize:"16px",color:"var(--fx-text)"}}>{p.resultado_local}–{p.resultado_visitante}</span>
                      :<span style={{fontWeight:800,fontSize:"13px",color:estado==="en_juego"?"#ef4444":"#9333ea"}}>vs</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"7px",flex:1,minWidth:"80px",justifyContent:"flex-end",textAlign:"right"}}>
                    <span style={{fontWeight:700,fontSize:"12px",color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{visit?.nombre||"—"}</span>
                    {visit?.escudo&&<img loading="lazy" decoding="async" src={visit.escudo} alt="" style={{width:28,height:28,objectFit:"contain",flexShrink:0}}/>}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"10px",flexWrap:"wrap"}}>
                  {p.link&&<a href={p.link} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{background:"#7c3aed",color:"#fff",borderRadius:"20px",padding:"4px 12px",fontSize:"11px",fontWeight:700,textDecoration:"none"}}>▶ Ver</a>}
                  {p.url_stats&&<a href={p.url_stats} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{background:"#0f172a",color:"#fff",borderRadius:"20px",padding:"4px 12px",fontSize:"11px",fontWeight:700,textDecoration:"none"}}>📊 Stats</a>}
                  {isAdmin&&<>
                    <button onClick={e=>{e.stopPropagation();setModal(p);}} aria-label="Editar partido" style={{background:"var(--fx-hover)",border:"none",borderRadius:"20px",padding:"4px 10px",fontSize:"11px",fontWeight:600,cursor:"pointer",color:"var(--fx-label)"}}>✏️</button>
                    <button onClick={e=>{e.stopPropagation();del(p.id);}} style={{background:"var(--fx-red-bg)",border:"none",borderRadius:"20px",padding:"4px 10px",fontSize:"11px",fontWeight:600,cursor:"pointer",color:"#ef4444"}}>🗑️</button>
                  </>}
                </div>
              </div>
            );
          };

          return(
            <div key={grupoKey} style={{marginBottom:"12px",background:"var(--fx-card)",borderRadius:"16px",overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              {/* Cabecera de la liga: clicable para expandir/contraer */}
              <div onClick={()=>setExpandedLigas(prev=>({...prev,[grupoKey]:!expanded}))}
                style={{display:"flex",alignItems:"center",gap:"10px",padding:"14px 16px",cursor:"pointer",userSelect:"none",background:expanded?"var(--fx-lila-bg)":"#fff"}}>
                {ligaMap[ligaId]?.logo&&<img loading="lazy" decoding="async" src={ligaMap[ligaId].logo} alt="" style={{width:24,height:24,objectFit:"contain",flexShrink:0}}/>}
                <span style={{fontWeight:700,fontSize:"14px",color:"#9333ea",flex:1}}>{ligaMap[ligaId]?.nombre||"Sin liga"}{temporada?` - ${temporada}`:""}</span>
                {hayEnJuego&&<span style={{width:10,height:10,borderRadius:"50%",background:"#ef4444",flexShrink:0,boxShadow:"0 0 0 3px rgba(239,68,68,0.2)",display:"inline-block"}}/>}
                {(ps.some(p=>p.notas&&/^Group [A-Z]/i.test(p.notas)&&p.id_equipo_local&&p.id_equipo_visitante)||(ligaMap[ligaId]?.tipo==="liga"&&ps.some(p=>p.id_equipo_local&&p.id_equipo_visitante))||(ligaMap[ligaId]?.tipo!=="liga"&&ps.some(p=>/#\d+/.test(p.notas||"")||/^octavos/i.test(p.notas||""))))&&(
                  <button onClick={e=>{e.stopPropagation();abrirClasi(grupoKey,"grupos");}}
                    style={{background:"#f5f3ff",color:"#7c3aed",border:"1.5px solid #ddd6fe",borderRadius:"20px",padding:"3px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",flexShrink:0,marginRight:"4px"}}>
                    📊
                  </button>
                )}
                {ps.some(p=>/#(49|5[0-5])\b/.test(p.notas||""))&&(
                  <button onClick={e=>{e.stopPropagation();abrirClasi(grupoKey,"standing");}}
                    style={{background:"var(--fx-amber-bg)",color:"var(--fx-amber-text)",border:"1.5px solid #fde68a",borderRadius:"20px",padding:"3px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",flexShrink:0,marginRight:"4px"}}>
                    🏅
                  </button>
                )}
                {isAdmin&&ps.some(p=>p.fuente==="fiba")&&<button onClick={e=>{e.stopPropagation();setFibaSlug("");setFibaMensaje("");setFibaResultado(null);setFibaModal({ligaId,temporada});}} style={{background:"#ecfdf5",color:"#059669",border:"1.5px solid #6ee7b7",borderRadius:"20px",padding:"3px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",flexShrink:0,marginRight:"4px"}}>⚡ Live</button>}
                <span style={{fontSize:"18px",color:"var(--fx-muted2)",transform:expanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>›</span>
              </div>

              {/* Contenido expandido */}
              {expanded&&(
                <div style={{padding:"0 12px 14px",display:"flex",flexDirection:"column",gap:"8px"}}>
                  {esLiga?(
                    /* Jornadas colapsadas: la siguiente por disputarse lleva la etiqueta "Próxima" */
                    jornadas.map(j=>{
                      const jk=grupoKey+"|"+j.key;
                      const open=expandedJornadas[jk]??false;
                      return(
                        <div key={j.key} style={{border:j.proxima?"1.5px solid #fcd34d":"1px solid var(--fx-border)",borderRadius:"12px",overflow:"hidden",marginTop:"4px"}}>
                          <div onClick={()=>setExpandedJornadas(prev=>({...prev,[jk]:!open}))}
                            style={{display:"flex",alignItems:"center",gap:"8px",padding:"10px 12px",cursor:"pointer",userSelect:"none",background:j.proxima?"var(--fx-amber-bg)":open?"var(--fx-lila-bg)":"var(--fx-hover)"}}>
                            <span style={{fontWeight:700,fontSize:"12.5px",color:j.proxima?"var(--fx-amber-text)":"#475569",flexShrink:0}}>{j.label}</span>
                            <span style={{fontSize:"11px",color:"var(--fx-muted2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fmtRango(j.games)}</span>
                            <span style={{flex:1}}/>
                            {j.enJuego&&<span style={{width:8,height:8,borderRadius:"50%",background:"#ef4444",flexShrink:0,boxShadow:"0 0 0 3px rgba(239,68,68,0.2)",display:"inline-block"}}/>}
                            {j.proxima&&!j.enJuego&&<span style={{background:"#f59e0b",color:"#fff",borderRadius:"20px",padding:"2px 10px",fontSize:"10px",fontWeight:800,flexShrink:0}}>{t("partidos.next_matchday")}</span>}
                            <span style={{fontSize:"16px",color:"var(--fx-muted2)",transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s",flexShrink:0}}>›</span>
                          </div>
                          {open&&(
                            <div style={{padding:"10px",display:"flex",flexDirection:"column",gap:"8px",background:"var(--fx-card)"}}>
                              {j.games.map(p=><TarjetaPartido key={p.id} p={p}/>)}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ):(<>
                  {/* HOY */}
                  {partHoy.length>0&&(
                    <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"8px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"4px"}}>
                        <div style={{flex:1,height:"1px",background:"var(--fx-border)"}}/>
                        <span style={{fontSize:"11px",fontWeight:700,color:hayEnJuego?"#ef4444":"#f59e0b",whiteSpace:"nowrap"}}>{hayEnJuego?"🔴 En juego":"📅 Hoy"}</span>
                        <div style={{flex:1,height:"1px",background:"var(--fx-border)"}}/>
                      </div>
                      {partHoy.map(p=><TarjetaPartido key={p.id} p={p}/>)}
                    </div>
                  )}

                  {/* PRÓXIMOS */}
                  {proximos.length>0&&(
                    <div style={{marginTop:"8px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                        <div style={{flex:1,height:"1px",background:"var(--fx-border)"}}/>
                        <span style={{fontSize:"11px",fontWeight:700,color:"var(--fx-muted2)",whiteSpace:"nowrap"}}>{t("teams.next")}</span>
                        <div style={{flex:1,height:"1px",background:"var(--fx-border)"}}/>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                        {proximos.map(p=><TarjetaPartido key={p.id} p={p}/>)}
                      </div>
                    </div>
                  )}

                  {/* ÚLTIMOS RESULTADOS */}
                  {resultados.length>0&&(
                    <div style={{marginTop:"8px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                        <div style={{flex:1,height:"1px",background:"var(--fx-border)"}}/>
                        <span style={{fontSize:"11px",fontWeight:700,color:"var(--fx-muted2)",whiteSpace:"nowrap"}}>{t("teams.last_results")}</span>
                        <div style={{flex:1,height:"1px",background:"var(--fx-border)"}}/>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                        {resultados.map(p=><TarjetaPartido key={p.id} p={p}/>)}
                      </div>
                    </div>
                  )}
                  </>)}
                </div>
              )}
            </div>
          );
        };
        // Clasificar cada competición: activa (le quedan partidos por jugar) o finalizada (todo con resultado)
        const esFinalizada=ps=>ps.length>0&&ps.every(p=>p.resultado_local!=null&&p.resultado_visitante!=null&&!p.es_live);
        const entradas=Object.entries(byLiga);
        const activas=entradas.filter(([,ps])=>!esFinalizada(ps));
        const finalizadas=entradas.filter(([,ps])=>esFinalizada(ps));
        // Agrupar las finalizadas por temporada para el archivo
        const archivoPorTemp={};
        finalizadas.forEach(([k,ps])=>{const temp=(k.split("|")[1])||"—";(archivoPorTemp[temp]=archivoPorTemp[temp]||[]).push([k,ps]);});
        const tempsArchivo=Object.keys(archivoPorTemp).sort((a,b)=>b.localeCompare(a));
        return(<>
          {activas.map(([k,ps])=>renderGrupo(k,ps))}
          {finalizadas.length>0&&(
            <div style={{marginTop:activas.length?"22px":"0"}}>
              <div onClick={()=>setArchivoOpen(o=>!o)}
                style={{display:"flex",alignItems:"center",gap:"10px",padding:"14px 16px",cursor:"pointer",userSelect:"none",background:"#eef2f7",borderRadius:"14px"}}>
                <span style={{fontSize:"18px"}}>🗄️</span>
                <span style={{fontWeight:800,fontSize:"14px",color:"var(--fx-label)",flex:1}}>{t("partidos.finished_comps")}</span>
                <span style={{background:"#dbe2ea",color:"var(--fx-muted)",borderRadius:"20px",padding:"2px 10px",fontSize:"12px",fontWeight:700}}>{finalizadas.length}</span>
                <span style={{fontSize:"18px",color:"var(--fx-muted2)",transform:archivoOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>›</span>
              </div>
              {archivoOpen&&(
                <div style={{marginTop:"10px",display:"flex",flexDirection:"column",gap:"10px"}}>
                  {tempsArchivo.map(temp=>{
                    const grupos=archivoPorTemp[temp];
                    const tOpen=archivoTempOpen[temp]??false;
                    return(
                      <div key={temp}>
                        <div onClick={()=>setArchivoTempOpen(prev=>({...prev,[temp]:!tOpen}))}
                          style={{display:"flex",alignItems:"center",gap:"10px",padding:"11px 16px",cursor:"pointer",userSelect:"none",background:tOpen?"var(--fx-lila-bg)":"#fff",borderRadius:"12px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                          <span style={{fontSize:"13px"}}>📅</span>
                          <span style={{fontWeight:700,fontSize:"13px",color:"#9333ea",flex:1}}>{temp}</span>
                          <span style={{fontSize:"11px",color:"var(--fx-muted2)"}}>{grupos.length} {grupos.length===1?"competición":"competiciones"}</span>
                          <span style={{fontSize:"16px",color:"var(--fx-muted2)",transform:tOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>›</span>
                        </div>
                        {tOpen&&<div style={{marginTop:"8px",display:"flex",flexDirection:"column",gap:"12px"}}>{grupos.map(([k,ps])=>renderGrupo(k,ps))}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>);
      })()}
    </div>
  );
}

/* ── ClasificacionGrupos ─────────────────────────────────── */
// Calcula la clasificación por grupos a partir de los partidos con resultado.
// Los partidos de un grupo se identifican por el campo "notas" que empieza por "Group ".
// Criterios de desempate FIBA: 1) puntos (2V/1D), 2) head-to-head, 3) dif. directa, 4) dif. global
/* Tabla de un grupo con desempates FIBA. Extraida para poder reusarla con
   subconjuntos de partidos (p.ej. Euroliga: 2a ronda arrastrando la 1a). */
function calcTablaGrupo(ps){
  ps=ps.filter(p=>!/playoff|final campeones|cuartos|semifinal|^final/i.test(p.notas||""));

    const stats={};
    const initEq=id=>{if(id&&!stats[id])stats[id]={id,pj:0,pg:0,pp:0,pts:0,pf:0,pc:0,dif:0};};
    ps.forEach(p=>{
      initEq(p.id_equipo_local); initEq(p.id_equipo_visitante);
      if(p.resultado_local==null||p.resultado_visitante==null)return; // sin jugar: solo registra equipos
      if(getPartidoEstado(p)==="en_juego")return; // marcador en vivo: aún no cuenta
      const sl=p.resultado_local,sv=p.resultado_visitante;
      stats[p.id_equipo_local].pj++;   stats[p.id_equipo_visitante].pj++;
      stats[p.id_equipo_local].pf+=sl; stats[p.id_equipo_local].pc+=sv;
      stats[p.id_equipo_visitante].pf+=sv; stats[p.id_equipo_visitante].pc+=sl;
      if(sl>sv){
        stats[p.id_equipo_local].pg++;    stats[p.id_equipo_local].pts+=2;
        stats[p.id_equipo_visitante].pp++; stats[p.id_equipo_visitante].pts+=1;
      } else {
        stats[p.id_equipo_visitante].pg++; stats[p.id_equipo_visitante].pts+=2;
        stats[p.id_equipo_local].pp++;     stats[p.id_equipo_local].pts+=1;
      }
    });
    Object.values(stats).forEach(e=>{e.dif=e.pf-e.pc;});

    // Ordenar con desempate FIBA
    const arr=Object.values(stats);
    arr.sort((a,b)=>{
      if(b.pts!==a.pts)return b.pts-a.pts;
      // Head-to-head entre empatados con los mismos puntos
      const tied=arr.filter(x=>x.pts===a.pts).map(x=>x.id);
      if(tied.length>=2){
        const hthStats={};
        tied.forEach(id=>{hthStats[id]={pts:0,pf:0,pc:0};});
        ps.forEach(p=>{
          if(p.resultado_local==null||p.resultado_visitante==null)return;
          if(getPartidoEstado(p)==="en_juego")return;
          if(!tied.includes(p.id_equipo_local)||!tied.includes(p.id_equipo_visitante))return;
          const sl=p.resultado_local,sv=p.resultado_visitante;
          hthStats[p.id_equipo_local].pf+=sl; hthStats[p.id_equipo_local].pc+=sv;
          hthStats[p.id_equipo_visitante].pf+=sv; hthStats[p.id_equipo_visitante].pc+=sl;
          if(sl>sv){hthStats[p.id_equipo_local].pts+=2;hthStats[p.id_equipo_visitante].pts+=1;}
          else{hthStats[p.id_equipo_visitante].pts+=2;hthStats[p.id_equipo_local].pts+=1;}
        });
        const hA=hthStats[a.id]||{pts:0,pf:0,pc:0};
        const hB=hthStats[b.id]||{pts:0,pf:0,pc:0};
        if(hB.pts!==hA.pts)return hB.pts-hA.pts;
        const difA=hA.pf-hA.pc, difB=hB.pf-hB.pc;
        if(difB!==difA)return difB-difA;
      }
      // Diferencia global
      if(b.dif!==a.dif)return b.dif-a.dif;
      return b.pf-a.pf;
    });
    return arr;
}

function calcClasificacion(partidos, equipoMap){
  // Agrupar TODOS los partidos de grupo (notas que empiezan por "Group "), tengan o no
  // resultado: así la tabla muestra los equipos a 0 antes de que empiece el torneo.
  const grupos={};
  const ligaRegular=[]; // partidos sin "Group X": jornadas de liga regular (excluye playoffs y eliminatorias)
  partidos.forEach(p=>{
    const m=p.notas&&p.notas.match(/^(Group [A-Z])/i);
    const m2=!m&&p.notas&&p.notas.match(/Grupo ([A-Z])\b/i);
    if(m||m2){
      const g=m?m[1].toUpperCase():("Grupo "+m2[1].toUpperCase());
      if(!grupos[g])grupos[g]=[];
      grupos[g].push(p);
      return;
    }
    if(/playoff|final campeones/i.test(p.notas||""))return;
    if(/#\d+/.test(p.notas||"")||/^octavos/i.test(p.notas||""))return; // eliminatorias de torneo
    if(/^(fase previa|dieciseisavos|octavos|cuartos|semifinal|final)/i.test(p.notas||""))return; // EuroCup: previa y cuadro fuera de la tabla
    if(!p.id_equipo_local||!p.id_equipo_visitante)return;
    ligaRegular.push(p);
  });

  const calcGrupo=calcTablaGrupo;

  const conGrupos=Object.entries(grupos)
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([nombre,ps])=>({nombre,equipos:calcGrupo(ps)}));
  if(conGrupos.length)return conGrupos;
  // Modo liga: tabla única con los mismos criterios de desempate que aplica la FEB
  // (enfrentamientos particulares -> diferencia particular -> diferencia general -> puntos anotados).
  if(ligaRegular.length)return [{nombre:"Clasificación",equipos:calcGrupo(ligaRegular),esLiga:true}];
  return [];
}

/* ── Euroliga: fases propias (previa, 1a y 2a ronda, play-ins, final six) ───────
   Se activa sola cuando la competicion tiene notas "Primera Ronda" y "Segunda Ronda".
   La 2a ronda arrastra los resultados de la 1a entre equipos que ya se enfrentaron. */
function EuroligaFases({psLiga,equipoMap,onOpenPartido,mvpPlayer,onGoToPlayer}){
  const nt=p=>(p&&p.notas)||"";
  const [tab,setTab]=useState("primera");
  const de=re=>psLiga.filter(p=>re.test(nt(p)));
  const previa=de(/fase previa/i);
  const r1=de(/^Primera Ronda/i), r2=de(/^Segunda Ronda/i);
  const playins=de(/^Play-In/i);
  const six=de(/^(Cuartos de final|Semifinal|3er puesto|Final)\b/i);
  const letras=ps=>[...new Set(ps.map(p=>{const m=nt(p).match(/Grupo ([A-Z])/i);return m?m[1].toUpperCase():null;}).filter(Boolean))].sort();
  const delGrupo=(ps,L)=>ps.filter(p=>new RegExp("Grupo "+L+"\\b","i").test(nt(p)));
  // 2a ronda: se suman los partidos de 1a ronda entre equipos que coinciden en el nuevo grupo
  const tablaSegunda=L=>{
    const ps=delGrupo(r2,L);
    const eq=new Set(); ps.forEach(p=>{eq.add(p.id_equipo_local);eq.add(p.id_equipo_visitante);});
    const arrastre=r1.filter(p=>eq.has(p.id_equipo_local)&&eq.has(p.id_equipo_visitante));
    return {filas:calcTablaGrupo([...ps,...arrastre]),arrastre:arrastre.length};
  };
  const zonaColor={verde:"#16a34a",naranja:"#ea580c",azul:"#2563eb",gris:"#94a3b8"};
  const Tabla=({titulo,filas,zonas,nota})=>(
    <div style={{background:"var(--fx-card)",borderRadius:"16px",overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"16px"}}>
      <div style={{background:"#f5f3ff",padding:"10px 16px",borderBottom:"1px solid #e9d5ff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontWeight:800,fontSize:"14px",color:"#7c3aed"}}>{titulo}</span>
        {nota&&<span style={{fontSize:"11px",color:"var(--fx-muted2)"}}>{nota}</span>}
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
        <thead><tr style={{background:"var(--fx-hover)",color:"var(--fx-muted)",fontSize:"11px"}}>
          <th style={{padding:"6px 8px",textAlign:"left"}}>#</th><th style={{padding:"6px",textAlign:"left"}}>Equipo</th>
          <th style={{padding:"6px"}}>PJ</th><th style={{padding:"6px"}}>PG</th><th style={{padding:"6px"}}>PP</th><th style={{padding:"6px"}}>DIF</th>
        </tr></thead>
        <tbody>
          {filas.map((e,i)=>{
            const z=zonas(i+1);
            const eq=equipoMap[e.id]||{};
            return(
              <tr key={e.id} style={{borderTop:"1px solid var(--fx-border2)"}}>
                <td style={{padding:"7px 8px",borderLeft:"4px solid "+(z?zonaColor[z.color]:"transparent"),fontWeight:700,color:"var(--fx-label)"}}>{i+1}</td>
                <td style={{padding:"7px 6px",color:"var(--fx-text)",fontWeight:600}}>{eq.nombre||e.id}{z&&<span style={{display:"block",fontSize:"10px",fontWeight:700,color:zonaColor[z.color]}}>{z.txt}</span>}</td>
                <td style={{padding:"7px 6px",textAlign:"center",color:"var(--fx-muted)"}}>{e.pj}</td>
                <td style={{padding:"7px 6px",textAlign:"center",fontWeight:700,color:"#16a34a"}}>{e.pg}</td>
                <td style={{padding:"7px 6px",textAlign:"center",color:"#ef4444"}}>{e.pp}</td>
                <td style={{padding:"7px 6px",textAlign:"center",color:e.dif>0?"#16a34a":e.dif<0?"#ef4444":"#64748b"}}>{e.dif>0?"+":""}{e.dif}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  const zonasR1=n=>n<=3?{color:"verde",txt:"Pasa a Segunda Ronda"}:{color:"naranja",txt:"Desciende a EuroCup"};
  const zonasR2=n=>n<=2?{color:"verde",txt:"Play-In Semifinales"}:n<=4?{color:"azul",txt:"Play-In Cuartos"}:{color:"gris",txt:"Eliminado"};
  // Play-In: series al mejor de 3
  const series=ps=>{
    const m=new Map();
    ps.forEach(p=>{const k=(nt(p).match(/#(\d+)/)||[])[1]||"?";if(!m.has(k))m.set(k,[]);m.get(k).push(p);});
    return [...m.entries()].sort((a,b)=>a[0]-b[0]).map(([n,arr])=>{
      arr.sort((a,b)=>new Date(a.fecha_hora)-new Date(b.fecha_hora));
      const v={};
      arr.forEach(p=>{if(p.resultado_local==null||p.resultado_visitante==null)return;
        const g=p.resultado_local>p.resultado_visitante?p.id_equipo_local:p.id_equipo_visitante;v[g]=(v[g]||0)+1;});
      const ganador=Object.keys(v).find(k=>v[k]>=2)||null;
      return {n,arr,ganador,marcador:v,titulo:nt(arr[0]).replace(/\s*\(al mejor de 3\)/i,"")};
    });
  };
  const TarjetaSeries=({titulo,ps})=>(
    <BracketCard title={titulo}>
      <div style={{display:"flex",gap:"14px",alignItems:"flex-start",flexWrap:"wrap"}}>
        {series(ps).map(s=>(
          <BracketCol key={s.n} label={s.titulo}>
            {s.arr.map((p,i)=><KOBox key={p.id} p={p} equipoMap={equipoMap} caption={["1er partido","2o partido","3er partido"][i]} onOpen={onOpenPartido}/>)}
            <div style={{fontSize:"11px",fontWeight:700,marginTop:"4px",color:s.ganador?"#16a34a":"#94a3b8",textAlign:"center"}}>
              {s.ganador?("Pasa: "+((equipoMap[s.ganador]||{}).nombre||s.ganador)):"Serie en juego"}
            </div>
          </BracketCol>
        ))}
      </div>
    </BracketCard>
  );
  const tabs=[...(previa.length?[["previa","Fase Previa"]]:[]),...(r1.length?[["primera","Primera Ronda"]]:[]),
    ...(r2.length?[["segunda","Segunda Ronda"]]:[]),...(playins.length?[["playins","Play-Ins"]]:[]),...(six.length?[["six","Final Six"]]:[])];
  return(
    <div>
      <div style={{display:"flex",gap:"8px",marginBottom:"16px",flexWrap:"wrap"}}>
        {tabs.map(([k,lbl])=>(
          <button key={k} onClick={()=>setTab(k)} style={{border:"none",borderRadius:"10px",padding:"8px 14px",fontSize:"13px",fontWeight:700,cursor:"pointer",
            background:tab===k?"#9333ea":"#fff",color:tab===k?"#fff":"#64748b",boxShadow:tab===k?"none":"0 1px 4px rgba(0,0,0,0.06)"}}>{lbl}</button>
        ))}
      </div>
      {tab==="previa"&&<PlayoffBracket psLiga={previa} equipoMap={equipoMap} soloPrevia onOpenPartido={onOpenPartido}/>}
      {tab==="primera"&&letras(r1).map(L=>(
        <Tabla key={L} titulo={"Grupo "+L} filas={calcTablaGrupo(delGrupo(r1,L))} zonas={zonasR1}/>
      ))}
      {tab==="segunda"&&letras(r2).map(L=>{
        const t=tablaSegunda(L);
        return <Tabla key={L} titulo={"Grupo "+L} filas={t.filas} zonas={zonasR2} nota={t.arrastre?"incluye "+t.arrastre+" partidos arrastrados de la Primera Ronda":null}/>;
      })}
      {tab==="playins"&&(
        <div>
          {playins.some(p=>/Semifinales/i.test(nt(p)))&&<TarjetaSeries titulo="Play-In Semifinales · el ganador va a semifinales" ps={playins.filter(p=>/Semifinales/i.test(nt(p)))}/>}
          {playins.some(p=>/Cuartos/i.test(nt(p)))&&<TarjetaSeries titulo="Play-In Cuartos · el ganador va a cuartos" ps={playins.filter(p=>/Cuartos/i.test(nt(p)))}/>}
        </div>
      )}
      {tab==="six"&&<FaseFinal psLiga={six} equipoMap={equipoMap} onOpenPartido={onOpenPartido} mvpPlayer={mvpPlayer} onGoToPlayer={onGoToPlayer}/>}
    </div>
  );
}

/* ── Fase final (bracket compacto solo con banderas) ─────── */
function KOBox({p,equipoMap,caption,onOpen}){
  if(!p)return null;
  const played=p.resultado_local!=null&&p.resultado_visitante!=null;
  const enVivo=getPartidoEstado(p)==="en_juego"&&played;
  const winL=played&&Number(p.resultado_local)>Number(p.resultado_visitante);
  const winV=played&&Number(p.resultado_visitante)>Number(p.resultado_local);
  const row=(idEq,res,win)=>{
    const team=idEq?equipoMap[idEq]:null;
    return(
      <div style={{display:"flex",alignItems:"center",gap:"6px",padding:"3px 7px",background:win?"var(--fx-lila-bg)":"transparent",minWidth:0}}>
        {team
          ?<TeamBadge team={team} size={18}/>
          :<div style={{width:18,height:18,borderRadius:"5px",border:"1.5px dashed #cbd5e1",flexShrink:0}}/>}
        <span style={{flex:1,fontSize:"11px",fontWeight:win?800:600,color:team?(win?"#7c3aed":"#334155"):"#cbd5e1",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{team?team.nombre:"—"}</span>
        <span style={{fontSize:"11px",fontWeight:win?800:600,color:win?"#7c3aed":"#64748b",fontVariantNumeric:"tabular-nums",flexShrink:0}}>{played?res:""}</span>
      </div>
    );
  };
  return(
    <div style={{width:"150px",flexShrink:0}}>
      <div onClick={onOpen?()=>onOpen(p):undefined}
        style={{background:"var(--fx-card)",border:enVivo?"1.5px solid #ef4444":"1px solid var(--fx-border)",borderRadius:"10px",overflow:"hidden",cursor:onOpen?"pointer":"default"}}>
        {row(p.id_equipo_local,p.resultado_local,winL)}
        <div style={{height:"1px",background:"var(--fx-hover)"}}/>
        {row(p.id_equipo_visitante,p.resultado_visitante,winV)}
      </div>
      {caption&&<div style={{fontSize:"9px",color:"var(--fx-muted2)",textAlign:"center",marginTop:"2px",fontWeight:700}}>{caption}</div>}
    </div>
  );
}

function BracketCol({label,children,align}){
  return(
    <div style={{display:"flex",flexDirection:"column",flexShrink:0}}>
      <div style={{fontSize:"10px",fontWeight:800,color:"var(--fx-muted2)",textAlign:"center",textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:"8px",whiteSpace:"nowrap"}}>{label}</div>
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:align||"space-around",gap:"8px"}}>{children}</div>
    </div>
  );
}

function BracketCard({title,children}){
  return(
    <div style={{background:"var(--fx-card)",borderRadius:"16px",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"16px",overflow:"hidden"}}>
      <div style={{background:"#f5f3ff",padding:"10px 16px",borderBottom:"1px solid #e9d5ff"}}>
        <span style={{fontWeight:800,fontSize:"14px",color:"#7c3aed"}}>{title}</span>
      </div>
      <div style={{padding:"14px",overflowX:"auto"}}>{children}</div>
    </div>
  );
}

// Bracket estilo quiniela para el Mundial FIBA (formato con QQF).
// Copia la estructura visual de BasketnetaView: 4 columnas (Play-In, Cuartos,
// Semis, Final+Bronce) con líneas horizontales/verticales conectando pares.
function BracketMundialFIBA({psLiga,equipoMap,onOpenPartido,mvpPlayer,onGoToPlayer}){
  const byNum=useMemo(()=>{
    const m={};
    for(const p of psLiga){const mt=(p.notas||"").match(/#(\d+)/);if(mt)m[parseInt(mt[1],10)]=p;}
    return m;
  },[psLiga]);
  const slot=(n,cap)=>{const p=byNum[n];return p?<KOBox p={p} equipoMap={equipoMap} caption={cap} onOpen={onOpenPartido}/>:<div style={{width:150,flexShrink:0}}><div style={{background:"var(--fx-card)",border:"1px dashed #cbd5e1",borderRadius:10,padding:"14px 6px",textAlign:"center",fontSize:11,color:"var(--fx-muted2)"}}>—</div>{cap&&<div style={{fontSize:9,color:"var(--fx-muted2)",textAlign:"center",marginTop:2,fontWeight:700}}>{cap}</div>}</div>;};
  // Orden cross (igual que la quiniela): SF33 arriba = QF29+QF32, SF34 abajo = QF30+QF31
  const playins=[27,26,28,25];
  const qfs=[29,32,30,31];
  const sfs=[33,34];
  const line="#cbd5e1";
  const MATCH_H=64,GAP_UNIT=20;
  const bracketH=4*MATCH_H+3*GAP_UNIT;
  const colCommon={display:"flex",flexDirection:"column",justifyContent:"space-around",alignItems:"center",height:bracketH+"px",position:"relative"};
  const Hdr=({txt})=><div style={{fontSize:10,fontWeight:800,color:"var(--fx-muted2)",letterSpacing:"1px",position:"absolute",top:-18,left:0,right:0,textAlign:"center"}}>{txt}</div>;
  return(
    <BracketCard title="Cuadro final">
      <div style={{overflowX:"auto",paddingTop:22,paddingBottom:6}}>
        <div style={{display:"flex",alignItems:"stretch",minWidth:820}}>
          {/* Play-In */}
          <div style={colCommon}>
            <Hdr txt="PLAY-IN"/>
            {playins.map(n=>(
              <div key={n} style={{position:"relative"}}>
                {slot(n,"#"+n)}
                <div style={{position:"absolute",right:-20,top:"50%",width:20,height:2,background:line}}/>
              </div>
            ))}
          </div>
          {/* Cuartos */}
          <div style={{...colCommon,marginLeft:20}}>
            <Hdr txt="CUARTOS"/>
            {[0,1].map(pi=>(
              <div key={pi} style={{display:"flex",flexDirection:"column",justifyContent:"space-around",alignItems:"center",height:(bracketH/2-GAP_UNIT/2)+"px",position:"relative"}}>
                <div style={{position:"relative"}}>{slot(qfs[pi*2],"Cuartos #"+qfs[pi*2])}</div>
                <div style={{position:"relative"}}>{slot(qfs[pi*2+1],"Cuartos #"+qfs[pi*2+1])}</div>
                <div style={{position:"absolute",right:-12,top:"calc(50% - "+(MATCH_H/2)+"px)",bottom:"calc(50% - "+(MATCH_H/2)+"px)",width:2,background:line}}/>
                <div style={{position:"absolute",right:-12,top:MATCH_H/2,width:12,height:2,background:line}}/>
                <div style={{position:"absolute",right:-12,bottom:MATCH_H/2,width:12,height:2,background:line}}/>
                <div style={{position:"absolute",right:-24,top:"50%",width:12,height:2,background:line}}/>
              </div>
            ))}
          </div>
          {/* Semis */}
          <div style={{...colCommon,marginLeft:24}}>
            <Hdr txt="SEMIS"/>
            <div style={{display:"flex",flexDirection:"column",justifyContent:"space-around",alignItems:"center",height:bracketH+"px",position:"relative"}}>
              {sfs.map(n=>(
                <div key={n} style={{position:"relative"}}>
                  {slot(n,"Semifinal #"+n)}
                  <div style={{position:"absolute",right:-12,top:"50%",width:12,height:2,background:line}}/>
                </div>
              ))}
              <div style={{position:"absolute",right:-12,top:"25%",bottom:"25%",width:2,background:line}}/>
              <div style={{position:"absolute",right:-24,top:"50%",width:12,height:2,background:line}}/>
            </div>
          </div>
          {/* Final + 3er puesto */}
          <div style={{...colCommon,marginLeft:24,justifyContent:"center",gap:18}}>
            <Hdr txt="FINAL"/>
            {slot(36,"🏆 Final")}
            <div style={{fontSize:9,fontWeight:800,color:"#f59e0b",letterSpacing:"1px"}}>🥉 3ER PUESTO</div>
            {slot(35,"3er puesto")}
            {mvpPlayer&&(<div onClick={()=>onGoToPlayer&&onGoToPlayer(mvpPlayer.id_jugadora)} style={{display:"flex",flexDirection:"column",alignItems:"center",cursor:onGoToPlayer?"pointer":"default",gap:2,marginTop:6}}>
              <Avatar photo={mvpPlayer.foto} name={mvpPlayer.nombre} size={40} fontSize={13}/>
              <span style={{fontSize:11,fontWeight:700,color:"var(--fx-text)",whiteSpace:"nowrap",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis"}}>{mvpPlayer.nombre}</span>
              <span style={{fontSize:9,fontWeight:800,color:"var(--fx-amber-text)",letterSpacing:"0.5px"}}>🏅 MVP</span>
            </div>)}
          </div>
        </div>
      </div>
    </BracketCard>
  );
}

function FaseFinal({psLiga,equipoMap,onOpenPartido,mvpPlayer,onGoToPlayer}){
  // Formato Mundial FIBA (con Qualification to Quarter-Finals): bracket dedicado
  // que reproduce el layout de la quiniela.
  const esFormatoMundial=useMemo(()=>psLiga.some(p=>/qualification\s+to\s+quarter/i.test(p.notas||"")),[psLiga]);
  if(esFormatoMundial)return <BracketMundialFIBA psLiga={psLiga} equipoMap={equipoMap} onOpenPartido={onOpenPartido} mvpPlayer={mvpPlayer} onGoToPlayer={onGoToPlayer}/>;
  // El cuadro se arma POR RONDAS leyendo la nota (espanol o ingles) y ordenando por #N,
  // asi vale para 8, 16 o cualquier tamano. Play-In y fase previa van en tarjetas aparte.
  const nt=p=>(p&&p.notas)||"";
  const num=p=>{const m=nt(p).match(/#(\d+)/);return m?parseInt(m[1],10):99999;};
  const box=(p,caption)=><KOBox key={(p&&p.id)||caption} p={p} equipoMap={equipoMap} caption={caption} onOpen={onOpenPartido}/>;
  const bpos=p=>p.bracket_pos!=null?p.bracket_pos:99999;
  const sortN=arr=>arr.slice().sort((a,b)=>(bpos(a)-bpos(b))||num(a)-num(b)||(new Date(a.fecha_hora)-new Date(b.fecha_hora))||a.id-b.id);
  const esGrupo=p=>/\bgrupo\b|\bgroup\b|fase de grupos/i.test(nt(p))&&!/#\d+/.test(nt(p));
  const esRegular=p=>/regular season|temporada regular|liga regular|jornada/i.test(nt(p));
  const esPlayIn=p=>/play\s*-?\s*in|qualification\s+to\s+quarter/i.test(nt(p));
  const esPrevia=p=>!esPlayIn(p)&&/qualifier|fase previa|previa|clasificatoria|preliminar/i.test(nt(p));
  const es3er=p=>/3er|tercer|bronce|3rd\s*place|third\s*place/i.test(nt(p));
  const esClasif=p=>!es3er(p)&&!esPrevia(p)&&!esPlayIn(p)&&/clasificaci|classification|placement|puestos/i.test(nt(p));
  const base=p=>!esGrupo(p)&&!esRegular(p)&&!esPlayIn(p)&&!esPrevia(p)&&!esClasif(p)&&!es3er(p);
  const esOctavos=p=>base(p)&&/octavos|round of 16|dieciseisavos/i.test(nt(p));
  const esCuartos=p=>base(p)&&!esOctavos(p)&&/cuartos|quarter/i.test(nt(p));
  const esSemi=p=>base(p)&&!esOctavos(p)&&!esCuartos(p)&&/semi/i.test(nt(p));
  const esFinal=p=>base(p)&&!esOctavos(p)&&!esCuartos(p)&&!esSemi(p)&&/\bfinal\b/i.test(nt(p));
  const usable=psLiga.filter(p=>!esGrupo(p)&&!esRegular(p)&&nt(p));
  const octavos=sortN(usable.filter(esOctavos));
  const cuartos=sortN(usable.filter(esCuartos));
  const semis=sortN(usable.filter(esSemi));
  const finales=sortN(usable.filter(esFinal));
  const finalP=finales[0]||null;
  const bronce=sortN(usable.filter(es3er))[0]||null;
  const clasif=sortN(usable.filter(esClasif));
  const playin=sortN(usable.filter(esPlayIn));
  const previa=sortN(usable.filter(esPrevia));
  const capLimpia=p=>nt(p).replace(/#\d+/g,"").replace(/\(ida-vuelta\)/ig,"").replace(/\u00b7/g,"").trim();
  // Series a doble partido: varios partidos comparten #N
  const porSerie=arr=>{const m=new Map();arr.forEach(p=>{const k=num(p);if(!m.has(k))m.set(k,[]);m.get(k).push(p);});return [...m.entries()].sort((a,b)=>a[0]-b[0]);};
  const tarjetaSerie=(titulo,arr)=>(
    <BracketCard title={titulo}>
      <div style={{display:"flex",gap:"14px",alignItems:"flex-start",flexWrap:"wrap"}}>
        {porSerie(arr).map(([n,ps])=>(
          <BracketCol key={n} label={(capLimpia(ps[0])||titulo)+(ps.length>1?" · serie":"")}>
            {ps.map((p,i)=>box(p,ps.length>1?(i===0?"Ida":(i===1?"Vuelta":"3er partido")):undefined))}
          </BracketCol>
        ))}
      </div>
    </BracketCard>
  );
  // Bracket árbol: cada ronda alineada con sus pares de la ronda anterior
  const GAME_H=58,GAME_GAP=10,SLOT=68,GAME_W=152,CONN_W=24;
  const octS=[...octavos];
  const qfS=[...cuartos];
  const sfS=[...semis];
  const nBase=Math.max(octS.length,qfS.length*2,sfS.length*4,1);
  const totalH=nBase*SLOT-GAME_GAP;
  const r16C=octS.map((_,i)=>i*SLOT+GAME_H/2);
  const qfC=qfS.map((_,i)=>{const c1=r16C[i*2]??i*SLOT*2+GAME_H/2,c2=r16C[i*2+1]??c1;return(c1+c2)/2;});
  const sfC=sfS.map((_,i)=>{const c1=qfC[i*2]??r16C[i*4]??0,c2=qfC[i*2+1]??c1;return(c1+c2)/2;});
  const finC=sfC.length>=2?(sfC[0]+sfC[sfC.length-1])/2:sfC[0]??qfC[Math.floor(qfC.length/2)]??r16C[Math.floor(r16C.length/2)]??totalH/2;
  const GBox=({g,top,cap})=>!g?null:(<div style={{position:"absolute",top:top-GAME_H/2,left:0,width:GAME_W}}><KOBox p={g} equipoMap={equipoMap} caption={cap} onOpen={onOpenPartido}/></div>);
  const Conn=({froms,to})=>{const mn=Math.min(...froms),mx=Math.max(...froms);return(<svg style={{position:"absolute",top:0,left:0,width:CONN_W,height:totalH,overflow:"visible",pointerEvents:"none"}} viewBox={"0 0 "+CONN_W+" "+totalH}>{froms.map((f,fi)=><line key={fi} x1={0} y1={f} x2={CONN_W/2} y2={f} stroke="var(--fx-border)" strokeWidth={1.5}/>)}{mn!==mx&&<line x1={CONN_W/2} y1={mn} x2={CONN_W/2} y2={mx} stroke="var(--fx-border)" strokeWidth={1.5}/>}<line x1={CONN_W/2} y1={to} x2={CONN_W} y2={to} stroke="var(--fx-border)" strokeWidth={1.5}/></svg>);};
  const Hdr=({label,left,w})=>(<div style={{position:"absolute",top:-22,left,width:w,textAlign:"center",fontSize:"9px",fontWeight:800,color:"var(--fx-muted2)",textTransform:"uppercase",letterSpacing:"0.4px",whiteSpace:"nowrap"}}>{label}</div>);
  const hasQF=qfS.length>0,hasSF=sfS.length>0,hasFin=!!(finalP||bronce);
  const colW=GAME_W+CONN_W;
  const totalW=GAME_W+(hasQF?colW:0)+(hasSF?colW:0)+(hasFin?colW:0);
  const hayCuadro=octavos.length||cuartos.length||semis.length||finalP||bronce;
  return(
    <div>
      {hayCuadro&&(
        <BracketCard title="Cuadro final">
          <div style={{overflowX:"auto",paddingTop:"24px",paddingBottom:"4px"}}>
            <div style={{position:"relative",height:totalH,width:totalW,minWidth:totalW}}>
              {/* Columna 1: R16 u Octavos */}
              {octS.length>0&&<Hdr label={octS.length>4?"Octavos":"Cuartos"} left={0} w={GAME_W}/>}
              {octS.map((g,i)=><GBox key={g.id} g={g} top={r16C[i]}/>)}
              {/* Cuartos */}
              {hasQF&&<>
                <Hdr label="Cuartos" left={GAME_W+CONN_W} w={GAME_W}/>
                <div style={{position:"absolute",top:0,left:GAME_W,width:CONN_W,height:totalH}}>
                  {qfS.map((_,i)=><Conn key={i} froms={[r16C[i*2]??finC,r16C[i*2+1]??r16C[i*2]??finC]} to={qfC[i]}/>)}
                </div>
                <div style={{position:"absolute",top:0,left:GAME_W+CONN_W,width:GAME_W,height:totalH}}>
                  {qfS.map((g,i)=><GBox key={g.id||"qf"+i} g={g} top={qfC[i]}/>)}
                </div>
              </>}
              {/* Semis */}
              {hasSF&&<>
                <Hdr label="Semifinales" left={GAME_W+(hasQF?colW:0)+CONN_W} w={GAME_W}/>
                <div style={{position:"absolute",top:0,left:GAME_W+(hasQF?colW:0),width:CONN_W,height:totalH}}>
                  {sfS.map((_,i)=><Conn key={i} froms={[qfC[i*2]??r16C[i*2]??finC,qfC[i*2+1]??qfC[i*2]??finC]} to={sfC[i]}/>)}
                </div>
                <div style={{position:"absolute",top:0,left:GAME_W+(hasQF?colW:0)+CONN_W,width:GAME_W,height:totalH}}>
                  {sfS.map((g,i)=><GBox key={g.id||"sf"+i} g={g} top={sfC[i]}/>)}
                </div>
              </>}
              {/* Final */}
              {hasFin&&<>
                <Hdr label="Final" left={GAME_W+(hasQF?colW:0)+(hasSF?colW:0)+CONN_W} w={GAME_W}/>
                <div style={{position:"absolute",top:0,left:GAME_W+(hasQF?colW:0)+(hasSF?colW:0),width:CONN_W,height:totalH}}>
                  <Conn froms={sfC.length>=2?sfC:hasSF?sfC:[finC]} to={finC}/>
                </div>
                <div style={{position:"absolute",top:0,left:GAME_W+(hasQF?colW:0)+(hasSF?colW:0)+CONN_W,width:GAME_W,height:totalH}}>
                  {finalP&&<GBox g={finalP} top={finC} cap="🏆 Final"/>}
                  {bronce&&<GBox g={bronce} top={finC+GAME_H+GAME_GAP} cap="🥉 3er puesto"/>}
                  {mvpPlayer&&(<div onClick={()=>onGoToPlayer&&onGoToPlayer(mvpPlayer.id_jugadora)} style={{position:"absolute",top:finC+GAME_H*2+GAME_GAP*2+4,left:0,display:"flex",flexDirection:"column",alignItems:"center",cursor:onGoToPlayer?"pointer":"default",gap:"2px",width:GAME_W}}>
                    <Avatar photo={mvpPlayer.foto} name={mvpPlayer.nombre} size={40} fontSize={13}/>
                    <span style={{fontSize:"11px",fontWeight:700,color:"var(--fx-text)",whiteSpace:"nowrap",maxWidth:"150px",overflow:"hidden",textOverflow:"ellipsis"}}>{mvpPlayer.nombre}</span>
                    <span style={{fontSize:"9px",fontWeight:800,color:"var(--fx-amber-text)",letterSpacing:"0.5px"}}>🏅 MVP</span>
                  </div>)}
                </div>
              </>}
            </div>
          </div>
        </BracketCard>
      )}
      {playin.length>0&&tarjetaSerie("Play-In",playin)}
      {clasif.length>0&&(
        <BracketCard title="Clasificacion">
          <div style={{display:"flex",gap:"14px",alignItems:"stretch",flexWrap:"wrap"}}>
            {clasif.map(p=>box(p,capLimpia(p)||"Clasificacion"))}
          </div>
        </BracketCard>
      )}
      {previa.length>0&&tarjetaSerie("Fase previa",previa)}
    </div>
  );
}

/* ── Playoffs de liga (series al mejor de N) ─────────────── */
// Convención de notas: "Playoffs Cuartos #1".."#4", "Playoffs Semifinales #1","#2",
// "Playoffs Final". Todos los partidos de una misma serie llevan la misma nota; la
// caja muestra las victorias de cada equipo en la serie.
function SerieBox({partidosSerie,equipoMap,compacto,onOpen}){
  const [abierta,setAbierta]=useState(false);
  const ids=[];
  partidosSerie.forEach(p=>{[p.id_equipo_local,p.id_equipo_visitante].forEach(id=>{if(id&&!ids.includes(id))ids.push(id);});});
  const idaVuelta=/ida-vuelta/i.test(partidosSerie[0]?.notas||"");
  const wins={};
  let enVivo=false;
  partidosSerie.forEach(p=>{
    if(p.resultado_local==null||p.resultado_visitante==null)return;
    if(getPartidoEstado(p)==="en_juego"){enVivo=true;return;}
    if(idaVuelta){
      wins[p.id_equipo_local]=(wins[p.id_equipo_local]||0)+Number(p.resultado_local);
      wins[p.id_equipo_visitante]=(wins[p.id_equipo_visitante]||0)+Number(p.resultado_visitante);
      return;
    }
    const ganador=Number(p.resultado_local)>Number(p.resultado_visitante)?p.id_equipo_local:p.id_equipo_visitante;
    wins[ganador]=(wins[ganador]||0)+1;
  });
  const etiqueta=team=>{
    if(team.codigo)return team.codigo;
    const w=(team.nombre||"").replace(/[^A-Za-zÀ-ÿ ]/g,"").split(/\s+/).filter(Boolean);
    return (w[w.length-1]||team.nombre||"?").slice(0,4).toUpperCase();
  };
  const unico=partidosSerie.length===1;
  const row=idEq=>{
    const team=idEq?equipoMap[idEq]:null;
    // Si es un solo partido, mostrar resultado real; si es serie, mostrar global
    let w, lidera;
    if(unico){
      const p0=partidosSerie[0];
      const played=p0.resultado_local!=null;
      w=played?(idEq===p0.id_equipo_local?p0.resultado_local:p0.resultado_visitante):null;
      lidera=played&&((idEq===p0.id_equipo_local&&Number(p0.resultado_local)>Number(p0.resultado_visitante))||(idEq===p0.id_equipo_visitante&&Number(p0.resultado_visitante)>Number(p0.resultado_local)));
    }else{
      w=idEq?(wins[idEq]||0):null;
      lidera=idEq&&w>0&&w>=Math.max(...ids.map(x=>wins[x]||0))&&ids.some(x=>x!==idEq&&(wins[x]||0)<w);
    }
    return(
      <div key={idEq||Math.random()} style={{display:"flex",alignItems:"center",gap:compacto?"4px":"6px",padding:compacto?"3px 6px":"3px 7px",background:lidera?"var(--fx-lila-bg)":"transparent",minWidth:0}}>
        {team
          ?<TeamBadge team={team} size={compacto?15:18}/>
          :<div style={{width:compacto?15:18,height:compacto?15:18,borderRadius:"5px",border:"1.5px dashed #cbd5e1",flexShrink:0}}/>}
        <span title={team?team.nombre:""} style={{flex:1,fontSize:compacto?"10px":"11px",fontWeight:lidera?800:600,color:team?(lidera?"#7c3aed":"#334155"):"#cbd5e1",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{team?(compacto?etiqueta(team):team.nombre):"—"}</span>
        <span style={{fontSize:compacto?"10px":"11px",fontWeight:lidera?800:600,color:lidera?"#7c3aed":"#64748b",fontVariantNumeric:"tabular-nums",flexShrink:0}}>{w!=null&&partidosSerie.some(p=>p.resultado_local!=null)?w:""}</span>
      </div>
    );
  };
  const multi=partidosSerie.length>1;
  const toggleSerie=e=>{e.stopPropagation();setAbierta(!abierta);};
  return(
    <div style={{width:compacto?"96px":"150px",flexShrink:0}}>
      <div onClick={multi?toggleSerie:(onOpen&&partidosSerie[0]?()=>onOpen(partidosSerie[0]):undefined)}
        style={{background:"var(--fx-card)",border:enVivo?"1.5px solid #ef4444":(abierta?"1.5px solid #c084fc":"1px solid var(--fx-border)"),borderRadius:"10px",overflow:"hidden",transition:"border-color 0.15s",cursor:"pointer"}}
        onMouseEnter={e=>e.currentTarget.style.borderColor="#c084fc"}
        onMouseLeave={e=>e.currentTarget.style.borderColor=enVivo?"#ef4444":(abierta?"#c084fc":"var(--fx-border)")}>
        {row(ids[0])}
        <div style={{height:"1px",background:"var(--fx-hover)"}}/>
        {row(ids[1])}
      </div>
      {multi&&abierta&&(
        <div style={{marginTop:"4px",display:"flex",flexDirection:"column",gap:"3px"}}>
          {partidosSerie.sort((a,b)=>new Date(a.fecha_hora||0)-new Date(b.fecha_hora||0)).map((p,i)=>{
            const played=p.resultado_local!=null;
            const winL=played&&Number(p.resultado_local)>Number(p.resultado_visitante);
            const winV=played&&!winL&&Number(p.resultado_visitante)>Number(p.resultado_local);
            const tL=equipoMap[p.id_equipo_local],tV=equipoMap[p.id_equipo_visitante];
            return(
              <div key={p.id} onClick={e=>{e.stopPropagation();onOpen&&onOpen(p);}}
                style={{background:"var(--fx-lila-bg)",border:"1px solid #e9d5ff",borderRadius:"8px",padding:"4px 6px",cursor:onOpen?"pointer":"default",fontSize:"10px"}}>
                <div style={{color:"var(--fx-muted2)",fontWeight:700,marginBottom:"2px"}}>{idaVuelta?["Ida","Vuelta","3er partido"][i]||"":("Partido "+(i+1))}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontWeight:winL?800:500,color:winL?"#7c3aed":"#475569"}}>{tL?(compacto?etiqueta(tL):tL.nombre):"—"}</span>
                  <span style={{fontWeight:800,color:"#7c3aed",margin:"0 4px"}}>{played?(p.resultado_local+" - "+p.resultado_visitante):"vs"}</span>
                  <span style={{fontWeight:winV?800:500,color:winV?"#7c3aed":"#475569"}}>{tV?(compacto?etiqueta(tV):tV.nombre):"—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── WNBAClasificacion ─────────────────────────────────────
   Módulo específico WNBA (L006). Tabs Global / East / West / Playoffs.
   Regular vs playoff se distingue por notas "Playoff 1R" / "Semifinal" / "Final".
   Tiebreakers WNBA oficiales: H2H → V vs top-8 → V vs top-4 → point differential. */
const WNBA_RONDA_RE=/^(Playoff 1R|Semifinal|Final|Commissioner)/i;

function calcStatsWNBA(partidos){
  const s={};
  const ini=id=>{if(id&&!s[id])s[id]={id,pj:0,v:0,d:0,pf:0,pc:0};};
  partidos.forEach(p=>{
    ini(p.id_equipo_local); ini(p.id_equipo_visitante);
    if(p.resultado_local==null||p.resultado_visitante==null)return;
    if(getPartidoEstado(p)==="en_juego")return;
    const sl=p.resultado_local,sv=p.resultado_visitante;
    s[p.id_equipo_local].pj++; s[p.id_equipo_visitante].pj++;
    s[p.id_equipo_local].pf+=sl; s[p.id_equipo_local].pc+=sv;
    s[p.id_equipo_visitante].pf+=sv; s[p.id_equipo_visitante].pc+=sl;
    if(sl>sv){s[p.id_equipo_local].v++; s[p.id_equipo_visitante].d++;}
    else{s[p.id_equipo_visitante].v++; s[p.id_equipo_local].d++;}
  });
  Object.values(s).forEach(e=>{e.dif=e.pf-e.pc; e.pctV=e.pj?e.v/e.pj:0;});
  return Object.values(s);
}

// H2H: puntos ganados entre subconjunto de equipos empatados
function h2hRecord(partidos, ids){
  const set=new Set(ids);
  const r={};
  ids.forEach(id=>r[id]={v:0,d:0,dif:0});
  partidos.forEach(p=>{
    if(p.resultado_local==null||p.resultado_visitante==null)return;
    if(!set.has(p.id_equipo_local)||!set.has(p.id_equipo_visitante))return;
    const sl=p.resultado_local,sv=p.resultado_visitante;
    r[p.id_equipo_local].dif+=(sl-sv); r[p.id_equipo_visitante].dif+=(sv-sl);
    if(sl>sv){r[p.id_equipo_local].v++;r[p.id_equipo_visitante].d++;}
    else{r[p.id_equipo_visitante].v++;r[p.id_equipo_local].d++;}
  });
  return r;
}

// V contra subconjunto (top-8 / top-4)
function vsSubset(partidos, teamId, subsetIds){
  const set=new Set(subsetIds);
  let v=0;
  partidos.forEach(p=>{
    if(p.resultado_local==null||p.resultado_visitante==null)return;
    const l=p.id_equipo_local,vt=p.id_equipo_visitante;
    if(l!==teamId&&vt!==teamId)return;
    const rival=l===teamId?vt:l;
    if(!set.has(rival))return;
    const gano=(l===teamId&&p.resultado_local>p.resultado_visitante)||(vt===teamId&&p.resultado_visitante>p.resultado_local);
    if(gano)v++;
  });
  return v;
}

function sortWNBA(stats, partidos){
  if(!stats.length)return [];
  // Paso 1: ordenar por %V (calcula un ranking provisional para top-8/top-4)
  const prov=[...stats].sort((a,b)=>b.pctV-a.pctV||b.v-a.v);
  const top8=prov.slice(0,8).map(e=>e.id);
  const top4=prov.slice(0,4).map(e=>e.id);
  // Paso 2: ordenar con tiebreakers usando el ranking provisional
  return [...stats].sort((a,b)=>{
    if(a.pctV!==b.pctV)return b.pctV-a.pctV;
    // Empate en %V → H2H entre TODOS los equipos con ese pctV
    const empatados=stats.filter(e=>Math.abs(e.pctV-a.pctV)<1e-9).map(e=>e.id);
    if(empatados.length>=2){
      const h=h2hRecord(partidos, empatados);
      const hA=h[a.id]||{v:0,d:0,dif:0}, hB=h[b.id]||{v:0,d:0,dif:0};
      if(hA.v!==hB.v)return hB.v-hA.v;
    }
    const vs8A=vsSubset(partidos,a.id,top8), vs8B=vsSubset(partidos,b.id,top8);
    if(vs8A!==vs8B)return vs8B-vs8A;
    const vs4A=vsSubset(partidos,a.id,top4), vs4B=vsSubset(partidos,b.id,top4);
    if(vs4A!==vs4B)return vs4B-vs4A;
    return b.dif-a.dif;
  });
}

function calcRacha(partidos, teamId){
  const rel=partidos
    .filter(p=>(p.id_equipo_local===teamId||p.id_equipo_visitante===teamId)&&p.resultado_local!=null&&p.resultado_visitante!=null)
    .sort((a,b)=>new Date(b.fecha_hora)-new Date(a.fecha_hora));
  let signo=null, n=0;
  for(const p of rel){
    const gano=(p.id_equipo_local===teamId&&p.resultado_local>p.resultado_visitante)||(p.id_equipo_visitante===teamId&&p.resultado_visitante>p.resultado_local);
    const s=gano?"V":"D";
    if(signo===null){signo=s;n=1;}
    else if(signo===s)n++;
    else break;
  }
  return signo?`${signo}${n}`:"—";
}

function calcUlt10(partidos, teamId){
  const rel=partidos
    .filter(p=>(p.id_equipo_local===teamId||p.id_equipo_visitante===teamId)&&p.resultado_local!=null&&p.resultado_visitante!=null)
    .sort((a,b)=>new Date(b.fecha_hora)-new Date(a.fecha_hora))
    .slice(0,10);
  let v=0,d=0;
  rel.forEach(p=>{
    const gano=(p.id_equipo_local===teamId&&p.resultado_local>p.resultado_visitante)||(p.id_equipo_visitante===teamId&&p.resultado_visitante>p.resultado_local);
    if(gano)v++;else d++;
  });
  return `${v}-${d}`;
}

function WNBATabla({filas, equipoMap, onGoToTeam, mostrarGB}){
  const lider=filas[0];
  return(
    <div style={{background:"var(--fx-card)",borderRadius:"14px",overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"14px"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
        <thead><tr style={{background:"var(--fx-hover)",color:"var(--fx-muted)",fontSize:"11px"}}>
          <th style={{padding:"7px 8px",textAlign:"left"}}>#</th>
          <th style={{padding:"7px 6px",textAlign:"left"}}>Equipo</th>
          <th style={{padding:"7px 6px"}}>PJ</th>
          <th style={{padding:"7px 6px"}}>V</th>
          <th style={{padding:"7px 6px"}}>D</th>
          <th style={{padding:"7px 6px"}}>%V</th>
          {mostrarGB&&<th style={{padding:"7px 6px"}}>GB</th>}
          <th style={{padding:"7px 6px"}}>DIF</th>
          <th style={{padding:"7px 6px"}}>Últ.10</th>
          <th style={{padding:"7px 6px"}}>Racha</th>
        </tr></thead>
        <tbody>
          {filas.map((e,i)=>{
            const eq=equipoMap[e.id]||{};
            const gb=lider?((lider.v-e.v)+(e.d-lider.d))/2:0;
            const enPlayoff=i<8;
            const seed=i+1;
            return(
              <tr key={e.id} style={{borderTop:"1px solid var(--fx-border2)",cursor:onGoToTeam?"pointer":"default"}} onClick={()=>onGoToTeam&&onGoToTeam(e.id)}>
                <td style={{padding:"8px",borderLeft:"4px solid "+(enPlayoff?"#16a34a":"transparent"),fontWeight:700,color:"var(--fx-label)"}}>{seed}</td>
                <td style={{padding:"8px 6px",color:"var(--fx-text)",fontWeight:600,display:"flex",alignItems:"center",gap:"8px"}}>
                  {eq.escudo&&<img loading="lazy" decoding="async" src={eq.escudo} alt="" style={{width:22,height:22,objectFit:"contain"}} onError={ev=>{ev.currentTarget.style.display="none";}}/>}
                  <span>{eq.nombre||e.id}</span>
                </td>
                <td style={{padding:"8px 6px",textAlign:"center",color:"var(--fx-muted)"}}>{e.pj}</td>
                <td style={{padding:"8px 6px",textAlign:"center",fontWeight:700,color:"#16a34a"}}>{e.v}</td>
                <td style={{padding:"8px 6px",textAlign:"center",color:"#ef4444"}}>{e.d}</td>
                <td style={{padding:"8px 6px",textAlign:"center",fontWeight:700}}>{(e.pctV*100).toFixed(1)}</td>
                {mostrarGB&&<td style={{padding:"8px 6px",textAlign:"center",color:"var(--fx-muted)"}}>{gb===0?"—":gb.toFixed(1)}</td>}
                <td style={{padding:"8px 6px",textAlign:"center",color:e.dif>0?"#16a34a":e.dif<0?"#ef4444":"#64748b"}}>{e.dif>0?"+":""}{e.dif}</td>
                <td style={{padding:"8px 6px",textAlign:"center",color:"var(--fx-muted)"}}>{calcUlt10.__cache?.[e.id]||e.ult10||"—"}</td>
                <td style={{padding:"8px 6px",textAlign:"center",fontWeight:700,color:e.racha?.startsWith("V")?"#16a34a":e.racha?.startsWith("D")?"#ef4444":"#64748b"}}>{e.racha||"—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Bracket WNBA estilo FIBA (KOBox + escudos + columnas alineadas)
function WNBABracketAuto({globalRanked, playoffPartidos, equipoMap, onOpenPartido}){
  const seeds={};
  globalRanked.slice(0,8).forEach((e,i)=>{seeds[e.id]=i+1;});

  function agrupaSerie(ps){
    const map=new Map();
    ps.forEach(p=>{
      const a=[p.id_equipo_local,p.id_equipo_visitante].sort().join("_");
      const k=(p.notas||"").split(" · ")[0]+"|"+a;
      if(!map.has(k))map.set(k,[]);
      map.get(k).push(p);
    });
    return [...map.values()].map(arr=>arr.sort((x,y)=>new Date(x.fecha_hora)-new Date(y.fecha_hora)));
  }
  function ganadorSerie(serie, needed){
    const w={};
    serie.forEach(p=>{
      if(p.resultado_local==null||p.resultado_visitante==null)return;
      const g=p.resultado_local>p.resultado_visitante?p.id_equipo_local:p.id_equipo_visitante;
      w[g]=(w[g]||0)+1;
    });
    const gan=Object.entries(w).find(([,n])=>n>=needed);
    return {ganador:gan?gan[0]:null, marcador:w};
  }

  const p1R=playoffPartidos.filter(p=>/^Playoff 1R/i.test(p.notas||""));
  const pSemi=playoffPartidos.filter(p=>/^Semifinal/i.test(p.notas||""));
  const pFinal=playoffPartidos.filter(p=>/^Final/i.test(p.notas||""));

  const series1R=agrupaSerie(p1R);
  const seriesSemi=agrupaSerie(pSemi);
  const serieFinal=agrupaSerie(pFinal);

  function labelSerie(serie, needed){
    const {ganador, marcador}=ganadorSerie(serie, needed);
    const [teamA,teamB]=[serie[0].id_equipo_local, serie[0].id_equipo_visitante];
    const mA=marcador[teamA]||0, mB=marcador[teamB]||0;
    const eqA=equipoMap[teamA]||{}, eqB=equipoMap[teamB]||{};
    const seedA=seeds[teamA], seedB=seeds[teamB];
    // Ordenar visual: seed más bajo primero
    const [ta,tb,ma,mb]=(seedA&&seedB&&seedA>seedB)?[teamB,teamA,mB,mA]:[teamA,teamB,mA,mB];
    const eA=equipoMap[ta]||eqA, eB=equipoMap[tb]||eqB;
    return {
      titulo: `${seeds[ta]?`(${seeds[ta]}) `:""}${eA.nombre||ta}  ${ma}–${mb}  ${seeds[tb]?`(${seeds[tb]}) `:""}${eB.nombre||tb}`,
      ganador
    };
  }

  function SerieBox({serie, needed, roundLabel}){
    const [open,setOpen]=useState(false);
    const {ganador, marcador}=ganadorSerie(serie, needed);
    const teamA=serie[0].id_equipo_local, teamB=serie[0].id_equipo_visitante;
    const sA=seeds[teamA], sB=seeds[teamB];
    const [ta,tb]=(sA&&sB&&sA>sB)?[teamB,teamA]:[teamA,teamB];
    const mA=marcador[ta]||0, mB=marcador[tb]||0;
    const eA=equipoMap[ta]||{}, eB=equipoMap[tb]||{};
    const row=(id,eq,m,win,seed)=>(
      <div style={{display:"flex",alignItems:"center",gap:"6px",padding:"6px 8px",background:win?"var(--fx-lila-bg)":"transparent"}}>
        {eq.escudo?<img loading="lazy" decoding="async" src={eq.escudo} alt="" style={{width:20,height:20,objectFit:"contain",flexShrink:0}} onError={e=>{e.currentTarget.style.display="none";}}/>:<div style={{width:20,height:20,flexShrink:0}}/>}
        <span style={{flex:1,fontSize:"12px",fontWeight:win?800:600,color:win?"#7c3aed":"#334155",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{seed?`(${seed}) `:""}{eq.nombre||id}</span>
        <span style={{fontSize:"14px",fontWeight:win?800:600,color:win?"#7c3aed":"#64748b",fontVariantNumeric:"tabular-nums"}}>{m}</span>
      </div>
    );
    return(
      <BracketCol label={roundLabel}>
        <div style={{width:"180px"}}>
          <div onClick={()=>setOpen(!open)} style={{background:"var(--fx-card)",border:"1px solid var(--fx-border)",borderRadius:"10px",overflow:"hidden",cursor:"pointer"}}>
            {row(ta,eA,mA,ganador===ta,seeds[ta])}
            <div style={{height:"1px",background:"var(--fx-hover)"}}/>
            {row(tb,eB,mB,ganador===tb,seeds[tb])}
          </div>
          {open&&<div style={{marginTop:"6px",display:"flex",flexDirection:"column",gap:"6px"}}>
            {serie.map((p,i)=><KOBox key={p.id} p={p} equipoMap={equipoMap} caption={`Juego ${i+1}`} onOpen={onOpenPartido}/>)}
          </div>}
        </div>
      </BracketCol>
    );
  }

  const seriePairs=[[1,8],[4,5],[3,6],[2,7]];
  const placeholder=(s1,s2,key)=>{
    const a=globalRanked[s1-1], b=globalRanked[s2-1];
    const eqA=a?equipoMap[a.id]:null, eqB=b?equipoMap[b.id]:null;
    return(
      <BracketCol key={key} label={`(${s1}) vs (${s2})`}>
        <div style={{background:"var(--fx-hover)",border:"1px dashed #cbd5e1",borderRadius:"10px",padding:"10px",width:"150px",fontSize:"11px",color:"var(--fx-muted)",display:"flex",flexDirection:"column",gap:"4px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>{eqA?.escudo&&<img loading="lazy" decoding="async" src={eqA.escudo} alt="" style={{width:16,height:16,objectFit:"contain"}} onError={e=>{e.currentTarget.style.display="none";}}/>}<span>({s1}) {eqA?.nombre||"—"}</span></div>
          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>{eqB?.escudo&&<img loading="lazy" decoding="async" src={eqB.escudo} alt="" style={{width:16,height:16,objectFit:"contain"}} onError={e=>{e.currentTarget.style.display="none";}}/>}<span>({s2}) {eqB?.nombre||"—"}</span></div>
        </div>
      </BracketCol>
    );
  };

  return(
    <BracketCard title="🏀 Playoffs">
      <div style={{display:"flex",gap:"22px",alignItems:"stretch",minHeight:"320px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <div style={{fontSize:"10px",fontWeight:800,color:"#7c3aed",textTransform:"uppercase",letterSpacing:"0.4px"}}>1ª Ronda · Bo3</div>
          {series1R.length>0
            ? series1R.map((s,i)=><SerieBox key={i} serie={s} needed={2} roundLabel={`Serie ${i+1}`}/>)
            : seriePairs.map(([s1,s2],i)=>placeholder(s1,s2,i))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"14px",justifyContent:"space-around"}}>
          <div style={{fontSize:"10px",fontWeight:800,color:"#7c3aed",textTransform:"uppercase",letterSpacing:"0.4px"}}>Semifinales · Bo5</div>
          {seriesSemi.length>0
            ? seriesSemi.map((s,i)=><SerieBox key={i} serie={s} needed={3} roundLabel={`Semi ${i+1}`}/>)
            : [0,1].map(i=><BracketCol key={i} label={`Semi ${i+1}`}><div style={{background:"var(--fx-hover)",border:"1px dashed #cbd5e1",borderRadius:"10px",padding:"14px",width:"150px",fontSize:"11px",color:"var(--fx-muted2)",textAlign:"center"}}>{t("partidos.sin_juego")}</div></BracketCol>)}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"14px",justifyContent:"center"}}>
          <div style={{fontSize:"10px",fontWeight:800,color:"#7c3aed",textTransform:"uppercase",letterSpacing:"0.4px"}}>🏆 Finales · Bo7</div>
          {serieFinal.length>0
            ? serieFinal.map((s,i)=><SerieBox key={i} serie={s} needed={4} roundLabel="Final"/>)
            : <BracketCol label="Final"><div style={{background:"var(--fx-hover)",border:"1px dashed #cbd5e1",borderRadius:"10px",padding:"14px",width:"150px",fontSize:"11px",color:"var(--fx-muted2)",textAlign:"center"}}>{t("partidos.sin_juego")}</div></BracketCol>}
        </div>
      </div>
    </BracketCard>
  );
}

function WNBAClasificacion({psLiga, equipoMap, temporada, onOpenPartido, onGoToTeam, onBack}){
  const t = useT();
  const [tab,setTab]=useState("global");
  const [liveOverrides,setLiveOverrides]=useState({});
  // Auto-refresh cada 90s si estamos en la temporada en curso
  useEffect(()=>{
    const yr=new Date().getFullYear();
    if(String(temporada)!==String(yr))return;
    const refresh=async()=>{
      try{
        await callFn("actualizar-resultados-wnba",{});
        const {data}=await supabase.from("partidos").select("id,resultado_local,resultado_visitante,es_live,periodo").in("id_liga",["L006","L109"]).eq("temporada",String(temporada)).or("es_live.eq.true,fecha_hora.gte."+new Date(Date.now()-30*3600*1000).toISOString()).limit(50);
        if(data){const m={};data.forEach(p=>{m[p.id]=p;});setLiveOverrides(m);}
      }catch{}
    };
    refresh();
    const id=setInterval(refresh,90000);
    return()=>clearInterval(id);
  },[temporada]);
  // Aplicar overrides
  psLiga=psLiga.map(p=>liveOverrides[p.id]?{...p,...liveOverrides[p.id]}:p);
  const regular=useMemo(()=>psLiga.filter(p=>!WNBA_RONDA_RE.test(p.notas||"")),[psLiga]);
  const playoff=useMemo(()=>psLiga.filter(p=>WNBA_RONDA_RE.test(p.notas||"")),[psLiga]);
  const stats=useMemo(()=>calcStatsWNBA(regular),[regular]);
  const globalRanked=useMemo(()=>{
    const ord=sortWNBA(stats, regular);
    return ord.map(e=>({...e,racha:calcRacha(regular,e.id),ult10:calcUlt10(regular,e.id)}));
  },[stats,regular]);
  const east=useMemo(()=>globalRanked.filter(e=>equipoMap[e.id]?.conferencia==="East"),[globalRanked,equipoMap]);
  const west=useMemo(()=>globalRanked.filter(e=>equipoMap[e.id]?.conferencia==="West"),[globalRanked,equipoMap]);

  const tabBtn=(k,l)=>(
    <button key={k} onClick={()=>setTab(k)} style={{background:tab===k?"#9333ea":"#f1f5f9",color:tab===k?"#fff":"#475569",border:"none",borderRadius:"10px",padding:"7px 14px",fontWeight:700,fontSize:"12px",cursor:"pointer"}}>{l}</button>
  );

  return(
    <div style={{maxWidth:"900px",margin:"0 auto",padding:"16px",fontFamily:"system-ui,sans-serif"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#9333ea",fontWeight:700,fontSize:"15px",cursor:"pointer",padding:"0 0 16px"}}>← Volver</button>
      <h1 style={{fontWeight:800,fontSize:"20px",color:"var(--fx-text)",margin:"0 0 6px"}}>🏆 WNBA {temporada}</h1>
      <p style={{fontSize:"12px",color:"var(--fx-muted2)",margin:"0 0 14px"}}>{t("partidos.wnba_tiebreaker")}</p>
      <div style={{display:"flex",gap:"6px",marginBottom:"14px",flexWrap:"wrap"}}>
        {tabBtn("global","Global")}
        {tabBtn("east","🌅 East")}
        {tabBtn("west","🌇 West")}
        {tabBtn("playoffs","🏀 Playoffs")}
      </div>
      {tab==="global"&&<WNBATabla filas={globalRanked} equipoMap={equipoMap} onGoToTeam={onGoToTeam} mostrarGB={true}/>}
      {tab==="east"&&<WNBATabla filas={east} equipoMap={equipoMap} onGoToTeam={onGoToTeam} mostrarGB={false}/>}
      {tab==="west"&&<WNBATabla filas={west} equipoMap={equipoMap} onGoToTeam={onGoToTeam} mostrarGB={false}/>}
      {tab==="playoffs"&&<WNBABracketAuto globalRanked={globalRanked} playoffPartidos={playoff} equipoMap={equipoMap} onOpenPartido={onOpenPartido}/>}
    </div>
  );
}

function PlayoffBracket({psLiga,equipoMap,soloPrevia,onOpenPartido,showAscenso}){
  const t = useT();
  const series=useMemo(()=>{
    const m={};
    psLiga.forEach(p=>{
      if(!/playoff|final campeones/i.test(p.notas||""))return;
      const clave=p.notas.trim();
      if(!m[clave])m[clave]=[];
      m[clave].push(p);
    });
    return m;
  },[psLiga]);
  const numDe=k=>{const mt=k.match(/#(\d+)/);return mt?parseInt(mt[1],10):0;};
  const buscar=(regex)=>Object.keys(series).filter(k=>regex.test(k)).sort((a,b)=>numDe(a)-numDe(b)).map(k=>series[k]);
  const idaVuelta=s=>/ida-vuelta/i.test(s[0]?.notas||"");
  const teamsOf=s=>[...new Set(s.flatMap(p=>[p.id_equipo_local,p.id_equipo_visitante]).filter(Boolean))];
  const winnerOf=s=>{
    const ag={};
    s.forEach(p=>{
      if(p.resultado_local==null||p.resultado_visitante==null)return;
      if(idaVuelta(s)){ag[p.id_equipo_local]=(ag[p.id_equipo_local]||0)+Number(p.resultado_local);ag[p.id_equipo_visitante]=(ag[p.id_equipo_visitante]||0)+Number(p.resultado_visitante);}
      else{const gn=Number(p.resultado_local)>Number(p.resultado_visitante)?p.id_equipo_local:p.id_equipo_visitante;ag[gn]=(ag[gn]||0)+1;}
    });
    const ids=teamsOf(s);
    if(ids.length<2)return null;
    const a=ag[ids[0]]||0,b=ag[ids[1]]||0;
    return a>b?ids[0]:(b>a?ids[1]:null);
  };

  if(soloPrevia){
    const previa=buscar(/previa/i);
    if(!previa.length)return<p style={{color:"var(--fx-muted2)",textAlign:"center",paddingTop:"40px"}}>{t("players.sin_fase_previa")}</p>;
    return(
      <BracketCard title="Fase previa">
        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {previa.map((s,i)=>{const w=winnerOf(s);const t=w&&equipoMap[w];return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <SerieBox partidosSerie={s} equipoMap={equipoMap} onOpen={onOpenPartido}/>
              {t&&<div style={{display:"flex",alignItems:"center",gap:"5px",whiteSpace:"nowrap"}}>
                <span style={{color:"#22c55e",fontWeight:800,fontSize:"14px"}}>→</span>
                <TeamBadge team={t} size={18}/>
                <span style={{fontSize:"11px",fontWeight:800,color:"#16a34a"}}>{t.nombre}</span>
                <span style={{fontSize:"10px",color:"var(--fx-muted2)"}}>a grupos</span>
              </div>}
            </div>
          );})}
        </div>
      </BracketCard>
    );
  }

  // Separar Final de Campeones del bracket de ascenso
  const finalCampeones=buscar(/final campeones/i);
  const dieci=buscar(/dieciseisavos/i);
  const octavos=buscar(/octavos/i);
  const cuartos=buscar(/cuartos/i);
  const semis=buscar(/semi/i);
  const finalAsc=buscar(/playoffs final/i).filter(s=>!/semi/i.test(s[0].notas)&&!/previa/i.test(s[0].notas)&&!/campeones/i.test(s[0].notas));
  const hayBracket=dieci.length||octavos.length||cuartos.length||semis.length||finalAsc.length;

  if(!finalCampeones.length&&!hayBracket)return(
    <p style={{color:"var(--fx-muted2)",textAlign:"center",paddingTop:"40px"}}>{t("partidos.bracket_pending")}</p>
  );

  const AscLabel=({serie})=>{if(!showAscenso)return null;const w=winnerOf(serie);const t=w&&equipoMap[w];if(!t)return null;return(
    <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"8px"}}>
      <span style={{color:"#22c55e",fontWeight:800,fontSize:"16px"}}>→</span>
      <TeamBadge team={t} size={20}/>
      <span style={{fontSize:"12px",fontWeight:800,color:"#16a34a"}}>{t.nombre}</span>
      <span style={{background:"var(--fx-green-bg)",color:"var(--fx-green-text)",fontSize:"10px",fontWeight:800,padding:"2px 8px",borderRadius:"10px"}}>ASCENDIDO</span>
    </div>
  );};

  // Ordenar rondas del bracket de ascenso
  const cols=[["Dieciseisavos",dieci],["Octavos",octavos],["Cuartos",cuartos],["Semifinales",semis],["Final",finalAsc]].filter(([,s])=>s.length);
  for(let i=cols.length-2;i>=0;i--){
    const above=cols[i+1][1], cur=cols[i][1], used=new Set(), nw=[];
    above.forEach(as=>{teamsOf(as).forEach(team=>{const f=cur.find(s=>!used.has(s)&&winnerOf(s)===team);if(f){used.add(f);nw.push(f);}});});
    cur.forEach(s=>{if(!used.has(s))nw.push(s);});
    cols[i][1]=nw;
  }
  const compacto=dieci.length>0;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
      {finalCampeones.length>0&&<BracketCard title="🏆 Final de Campeones">
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"8px"}}>
          {finalCampeones.map((s,i)=>(
            <div key={i}>
              <SerieBox partidosSerie={s} equipoMap={equipoMap} onOpen={onOpenPartido}/>
              <AscLabel serie={s}/>
            </div>
          ))}
        </div>
      </BracketCard>}
      {hayBracket&&<BracketCard title="🏀 Playoff de Ascenso">
        <div style={{display:"flex",gap:"14px",alignItems:"stretch"}}>
          {cols.map(([lbl,s],ci)=><BracketCol key={lbl} label={lbl}>{s.map((serie,i)=>{
            const esFinal=ci===cols.length-1;
            return(<div key={i}>
              <SerieBox partidosSerie={serie} equipoMap={equipoMap} compacto={compacto} onOpen={onOpenPartido}/>
              {esFinal&&<AscLabel serie={serie}/>}
            </div>);
          })}</BracketCol>)}
        </div>
      </BracketCard>}
    </div>
  );
}

function StandingFinal({psLiga,equipoMap,temporada,onGoToTeam,mvpPlayer,onGoToPlayer}){
  const t = useT();
  // Cada partido de clasificación decide dos puestos: el ganador el más alto, el perdedor el siguiente.
  const posiciones=useMemo(()=>{
    const byNum={};
    psLiga.forEach(p=>{const m=(p.notas||"").match(/#(\d+)/);if(m)byNum[m[1]]=p;});
    const decisores=[[56,1],[55,3],[54,5],[53,7],[52,9],[51,11],[50,13],[49,15]];
    const pos={};
    decisores.forEach(([num,puesto])=>{
      const p=byNum[String(num)];
      if(!p||p.resultado_local==null||p.resultado_visitante==null||!p.id_equipo_local||!p.id_equipo_visitante)return;
      if(getPartidoEstado(p)==="en_juego")return; // marcador en vivo: puesto aún no decidido
      const localGana=Number(p.resultado_local)>Number(p.resultado_visitante);
      pos[puesto]=localGana?p.id_equipo_local:p.id_equipo_visitante;
      pos[puesto+1]=localGana?p.id_equipo_visitante:p.id_equipo_local;
    });
    return pos;
  },[psLiga]);
  const medalla=i=>i===1?"🥇":i===2?"🥈":i===3?"🥉":null;

  return(
    <div style={{background:"var(--fx-card)",borderRadius:"16px",overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.07)"}}>
      {Array.from({length:16},(_,idx)=>{
        const i=idx+1;
        const team=posiciones[i]?equipoMap[posiciones[i]]:null;
        const med=medalla(i);
        return(
          <div key={i} onClick={()=>team&&onGoToTeam&&onGoToTeam(team.id_equipo,temporada)}
            style={{display:"flex",alignItems:"center",gap:"10px",padding:"9px 16px",borderTop:i>1?"1px solid var(--fx-border2)":"none",
              background:i===1?"var(--fx-amber-bg)":i===2?"var(--fx-hover)":i===3?"var(--fx-amber-bg)":"#fff",cursor:team&&onGoToTeam?"pointer":"default"}}>
            <span style={{width:"28px",textAlign:"center",fontSize:med?"18px":"13px",fontWeight:800,color:"var(--fx-muted2)",flexShrink:0}}>{med||i}</span>
            {team?(
              <>
                <TeamBadge team={team} size={26}/>
                <span style={{fontWeight:i<=3?800:600,fontSize:"13px",color:"var(--fx-text)"}}>{team.nombre}</span>
                {i===1&&mvpPlayer&&(
                  <div onClick={e=>{e.stopPropagation();onGoToPlayer&&onGoToPlayer(mvpPlayer.id_jugadora);}}
                    style={{marginLeft:"auto",display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",flexShrink:0}}>
                    <Avatar photo={mvpPlayer.foto} name={mvpPlayer.nombre} size={34} fontSize={12}/>
                    <span style={{fontSize:"9px",fontWeight:800,color:"var(--fx-amber-text)",marginTop:"2px",letterSpacing:"0.5px"}}>MVP</span>
                  </div>
                )}
              </>
            ):(
              <>
                <div style={{width:26,height:26,borderRadius:"8px",border:"1.5px dashed #cbd5e1",flexShrink:0}}/>
                <span style={{fontSize:"13px",color:"#cbd5e1"}}>—</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClasificacionGrupos({partidos,equipos,ligas,ligaId,temporada,vistaInicial,onBack,onGoToTeam,onOpenPartido,onVistaChange,mvps,players,onGoToPlayer,equiposNombres}){
  const t = useT();
  const equipoMapBase=useMemo(()=>{const m={};equipos.forEach(e=>m[e.id_equipo]=e);return m;},[equipos]);
  // Nombres y escudos históricos: cada equipo se resuelve a cómo se llamaba en ESTA temporada
  const equipoMap=useMemo(()=>{
    const m={};
    equipos.forEach(e=>{m[e.id_equipo]={...e,...resolveTeamData(e.id_equipo,temporada,equiposNombres,equipoMapBase)};});
    return m;
  },[equipos,temporada,equiposNombres,equipoMapBase]);
  const psLiga=useMemo(()=>partidos.filter(p=>p.id_liga===ligaId&&(p.temporada||"")===(temporada||"")),[partidos,ligaId,temporada]);
  const grupos=useMemo(()=>calcClasificacion(psLiga,equipoMap),[psLiga,equipoMap]);
  const liga=useMemo(()=>(ligas||[]).find(l=>l.id_liga===ligaId),[ligas,ligaId]);
  const modoLiga=liga?.tipo==="liga";
  const hayKO=useMemo(()=>!modoLiga&&psLiga.some(p=>p.notas&&!/playoff/i.test(p.notas)&&(/#\d+/.test(p.notas)||/^octavos/i.test(p.notas))),[psLiga,modoLiga]);
  const hayBracketIV=useMemo(()=>!modoLiga&&psLiga.some(p=>/playoff/i.test(p.notas||"")&&!/previa/i.test(p.notas||"")),[psLiga,modoLiga]);
  const hayPreviaIV=useMemo(()=>!modoLiga&&psLiga.some(p=>/playoff/i.test(p.notas||"")&&/previa/i.test(p.notas||"")),[psLiga,modoLiga]);
  const hayPlayoffs=useMemo(()=>modoLiga&&psLiga.some(p=>/playoff|final campeones/i.test(p.notas||"")),[psLiga,modoLiga]);
  // Standing (clasificación por puestos) solo en torneos con cruces de clasificación 3º-16º (#49-#55).
  // Un Final Four (solo semifinales y final) no los tiene, así que no muestra ni Grupos ni Standing.
  const hayStanding=useMemo(()=>!modoLiga&&psLiga.some(p=>/#(49|5[0-5])\b/.test(p.notas||"")),[psLiga,modoLiga]);
  // Fases de clasificación FIBA (presentes cuando hay notas con esos patrones)
  const hayCL1316=useMemo(()=>!modoLiga&&psLiga.some(p=>/^(13|14|15).*puesto/i.test(p.notas||"")),[psLiga,modoLiga]);
  const hayCL912 =useMemo(()=>!modoLiga&&psLiga.some(p=>/^(9|10|11).*puesto/i.test(p.notas||"")),[psLiga,modoLiga]);
  const hayCL58  =useMemo(()=>!modoLiga&&psLiga.some(p=>/^(5|6|7).*puesto/i.test(p.notas||"")),[psLiga,modoLiga]);
  // Zonas de la tabla en modo liga (formato Liga Femenina Endesa): 8 a playoffs, 2 descensos
  // Zonas de clasificación por liga
  const ZONAS_LIGA={
    L001:{playoff:8,descenso:2,copa:8,copaLabel:"Copa de la Reina (8 primeros al final de la 1ª vuelta)"},
    L002:{ascenso:1,ascensoLabel:"Ascenso directo a LF Endesa",playoffAsc:9,playoffAscLabel:"Playoffs de ascenso (2º-9º)",descenso:2},
    L003:{ascenso:1,ascensoLabel:"Final de campeones (ascenso directo)",playoffAsc:4,playoffAscLabel:"Playoffs de ascenso (2º-4º)",descenso:3},
  };
  const zl=ZONAS_LIGA[liga?.id_liga]||{};
  const PLAYOFF_PUESTOS=zl.playoff||(zl.ascenso?0:8), DESCENSO_PUESTOS=zl.descenso||2;
  const COPA_PUESTOS=zl.copa||0, COPA_LABEL=zl.copaLabel||"";
  const multiGrupo=modoLiga&&grupos.length>1;
  const vistaIni=multiGrupo?"grp0":(vistaInicial==="grupos"&&grupos.length)||(vistaInicial==="standing"&&hayStanding)||(vistaInicial==="final"&&(hayKO||hayBracketIV))?vistaInicial:(grupos.length?"grupos":hayPreviaIV?"previa":(hayKO||hayBracketIV)?"final":"standing");
  const [vista,setVista]=useState(vistaIni);
  const [grupoSel,setGrupoSel]=useState(0);
  const mvpPlayer=useMemo(()=>{
    const m=(mvps||[]).find(x=>x.id_liga===ligaId&&(x.temporada||"")===(temporada||""));
    return m?(players||[]).find(p=>p.id_jugadora===m.id_jugadora)||null:null;
  },[mvps,players,ligaId,temporada]);

  // Euroliga: estructura propia (1a ronda, 2a ronda, play-ins, final six)
  const esEuroliga=useMemo(()=>psLiga.some(p=>/^Primera Ronda/i.test(p.notas||""))&&psLiga.some(p=>/^Segunda Ronda/i.test(p.notas||"")),[psLiga]);
  if(!grupos.length&&!hayKO&&!hayBracketIV&&!hayPreviaIV)return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"16px"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#9333ea",fontWeight:700,fontSize:"15px",cursor:"pointer",padding:"0 0 16px"}}>← Volver</button>
      <p style={{color:"var(--fx-muted2)",textAlign:"center",paddingTop:"40px"}}>{t("players.sin_partidos_resultado")}</p>
    </div>
  );

  if(esEuroliga)return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"16px",fontFamily:"system-ui,sans-serif"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#9333ea",fontWeight:700,fontSize:"15px",cursor:"pointer",padding:"0 0 16px"}}>← Volver</button>
      <h1 style={{fontWeight:800,fontSize:"20px",color:"var(--fx-text)",margin:"0 0 20px"}}>🏆 Clasificación</h1>
      <EuroligaFases psLiga={psLiga} equipoMap={equipoMap} onOpenPartido={onOpenPartido} mvpPlayer={mvpPlayer} onGoToPlayer={onGoToPlayer}/>
    </div>
  );

  if(ligaId==="L006")return <WNBAClasificacion psLiga={psLiga} equipoMap={equipoMap} temporada={temporada} onOpenPartido={onOpenPartido} onGoToTeam={onGoToTeam} onBack={onBack}/>;

  return(
    <div style={{maxWidth:"700px",margin:"0 auto",padding:"16px",fontFamily:"system-ui,sans-serif"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#9333ea",fontWeight:700,fontSize:"15px",cursor:"pointer",padding:"0 0 16px"}}>← Volver</button>
      <h1 style={{fontWeight:800,fontSize:"20px",color:"var(--fx-text)",margin:"0 0 20px"}}>🏆 Clasificación</h1>
      {(()=>{
        const tabs=modoLiga
          ?[...(multiGrupo?grupos.map((g,i)=>[`grp${i}`,g.nombre]):[["grupos",t("teams.classification")]]),...(hayPlayoffs?[["final",t("teams.playoffs")]]:[])]
          :[...(hayPreviaIV?[["previa","Fase previa"]]:[]),...(grupos.length?[["grupos","Group Phase"]]:[]),...(hayCL1316?[["cl1316","Class. 13-16"]]:[]),...(hayCL912?[["cl912","Class. 9-12"]]:[]),...(hayCL58?[["cl58","Class. 5-8"]]:[]),...((hayKO||hayBracketIV)?[["final","Bracket"]]:[]),...(hayStanding?[["standing","🏅 Standing"]]:[])];
        if(tabs.length<=1)return null;
        return(
          <div style={{display:"flex",gap:"8px",marginBottom:"16px"}}>
            {tabs.map(([k,lbl])=>(
              <button key={k} onClick={()=>{setVista(k);onVistaChange&&onVistaChange(k);}}
                style={{border:"none",borderRadius:"10px",padding:"8px 16px",fontSize:"13px",fontWeight:700,cursor:"pointer",
                  background:vista===k?"#9333ea":"var(--fx-card)",color:vista===k?"#fff":"var(--fx-muted)",boxShadow:vista===k?"none":"0 1px 4px rgba(0,0,0,0.06)"}}>{lbl}</button>
            ))}
          </div>
        );
      })()}
      {vista==="previa"&&hayPreviaIV&&<PlayoffBracket psLiga={psLiga} equipoMap={equipoMap} soloPrevia onOpenPartido={onOpenPartido}/>}
      {vista==="final"&&hayBracketIV&&<PlayoffBracket psLiga={psLiga} equipoMap={equipoMap} onOpenPartido={onOpenPartido}/>}
      {vista==="final"&&hayKO&&<FaseFinal psLiga={psLiga} equipoMap={equipoMap} onOpenPartido={onOpenPartido} mvpPlayer={mvpPlayer} onGoToPlayer={onGoToPlayer}/>}
      {(vista==="cl1316"||vista==="cl912"||vista==="cl58")&&(()=>{
        // Filtros exactos replicando FIBA standings:
        // Class.13-16: solo partidos 13-16 (SIN los 9-16 de primera ronda)
        // Class.9-12: incluye 9-16 primera ronda + 9-12 + 9-10 + 11-12
        // Class.5-8: 5-8 + 5-6 + 7-8
        const filtro=vista==="cl1316"
          ?p=>/^(13|14|15).*puesto/i.test(p.notas||"")
          :vista==="cl912"
          ?p=>/^(9|10|11).*puesto/i.test(p.notas||"")
          :p=>/^(5|6|7).*puesto/i.test(p.notas||"");
        const juegos=psLiga.filter(filtro).sort((a,b)=>{
          const na=a.notas||"",nb=b.notas||"";
          const ma=na.match(/#(\d+)/),mb=nb.match(/#(\d+)/);
          if(a.bracket_pos!=null&&b.bracket_pos!=null)return a.bracket_pos-b.bracket_pos;
          if(ma&&mb)return parseInt(ma[1])-parseInt(mb[1]);
          return 0;
        });
        return(<div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          {juegos.map(p=>{const eqL=equipoMap[p.id_equipo_local],eqV=equipoMap[p.id_equipo_visitante];
            const tieneRes=p.resultado_local!=null;
            return(<div key={p.id} onClick={()=>onOpenPartido&&onOpenPartido(p)} style={{background:"var(--fx-card)",borderRadius:"12px",border:"1.5px solid var(--fx-border)",padding:"10px 14px",cursor:onOpenPartido?"pointer":"default",display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{fontSize:"11px",color:"var(--fx-muted2)",minWidth:"110px"}}>{p.notas}</span>
              <span style={{flex:1,fontWeight:tieneRes&&p.resultado_local>p.resultado_visitante?700:500,fontSize:"13px"}}>{eqL?.nombre||"—"}</span>
              {tieneRes?<span style={{fontWeight:700,fontSize:"14px",color:"var(--fx-text)",minWidth:"50px",textAlign:"center"}}>{p.resultado_local} - {p.resultado_visitante}</span>:<span style={{fontSize:"12px",color:"var(--fx-muted2)",minWidth:"50px",textAlign:"center"}}>vs</span>}
              <span style={{flex:1,textAlign:"right",fontWeight:tieneRes&&p.resultado_visitante>p.resultado_local?700:500,fontSize:"13px"}}>{eqV?.nombre||"—"}</span>
            </div>);
          })}
          {!juegos.length&&<p style={{color:"var(--fx-muted2)",textAlign:"center",paddingTop:"20px"}}>{t("players.sin_partidos_fase")}</p>}
        </div>);
      })()}
      {vista==="final"&&hayPlayoffs&&<PlayoffBracket psLiga={psLiga} equipoMap={equipoMap} onOpenPartido={onOpenPartido} showAscenso={!!zl.ascenso}/>}
      {vista==="standing"&&hayKO&&<StandingFinal psLiga={psLiga} equipoMap={equipoMap} temporada={temporada} onGoToTeam={onGoToTeam} mvpPlayer={mvpPlayer} onGoToPlayer={onGoToPlayer}/>}
      {vista==="grupos"&&!grupos.length&&<p style={{color:"var(--fx-muted2)",textAlign:"center",paddingTop:"40px"}}>{t("players.sin_partidos_resultado")}</p>}
      {grupos.map(({nombre,equipos:eqs},gi)=>{
        const grpKey=`grp${gi}`;
        if(modoLiga&&grupos.length>1&&vista!==grpKey)return null;
        if(modoLiga&&grupos.length<=1&&vista!=="grupos")return null;
        if(!modoLiga&&vista!=="grupos")return null;
        return(
        <div key={nombre} style={{background:"var(--fx-card)",borderRadius:"16px",overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.07)",marginBottom:"16px"}}>
          <div style={{background:"var(--fx-lila-bg)",padding:"10px 16px",borderBottom:"1px solid var(--fx-lila-border)"}}>
            <span style={{fontWeight:800,fontSize:"14px",color:"var(--fx-lila-text)"}}>{nombre}</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px"}}>
              <thead>
                <tr style={{background:"var(--fx-lila-bg)"}}>
                  <th style={{textAlign:"left",padding:"8px 12px",fontWeight:700,color:"var(--fx-muted)",whiteSpace:"nowrap"}}>#</th>
                  <th style={{textAlign:"left",padding:"8px 12px",fontWeight:700,color:"var(--fx-muted)",whiteSpace:"nowrap"}}>Equipo</th>
                  <th style={{textAlign:"center",padding:"8px 8px",fontWeight:700,color:"var(--fx-muted)"}}>PJ</th>
                  <th style={{textAlign:"center",padding:"8px 8px",fontWeight:700,color:"var(--fx-muted)"}}>PG</th>
                  <th style={{textAlign:"center",padding:"8px 8px",fontWeight:700,color:"var(--fx-muted)"}}>PP</th>
                  <th style={{textAlign:"center",padding:"8px 8px",fontWeight:700,color:"var(--fx-muted)"}}>PF</th>
                  <th style={{textAlign:"center",padding:"8px 8px",fontWeight:700,color:"var(--fx-muted)"}}>PC</th>
                  <th style={{textAlign:"center",padding:"8px 8px",fontWeight:700,color:"var(--fx-muted)"}}>DIF</th>
                  <th style={{textAlign:"center",padding:"8px 12px",fontWeight:700,color:"#9333ea"}}>PTS</th>
                </tr>
              </thead>
              <tbody>
                {eqs.map((eq,i)=>{
                  const team=equipoMap[eq.id];
                  const zonaAsc=modoLiga&&zl.ascenso&&i<zl.ascenso;
                  const zonaPOAsc=modoLiga&&zl.playoffAsc&&!zonaAsc&&i<zl.playoffAsc;
                  const zonaPO=modoLiga&&!zonaAsc&&!zonaPOAsc&&i<PLAYOFF_PUESTOS;
                  const zonaDesc=modoLiga&&i>=eqs.length-DESCENSO_PUESTOS;
                  const fondo=modoLiga?(zonaDesc?"var(--fx-red-bg)":zonaAsc?"var(--fx-green-bg)":zonaPOAsc?"var(--fx-blue-bg)":zonaPO?"var(--fx-lila-bg)":"transparent"):(i===0?"var(--fx-lila-bg)":i<2?"var(--fx-lila-bg)":"transparent");
                  const borde=modoLiga?(zonaDesc?"3px solid #ef4444":zonaAsc?"3px solid #16a34a":zonaPOAsc?"3px solid #2563eb":zonaPO?"3px solid #9333ea":"3px solid transparent"):undefined;
                  return(
                    <tr key={eq.id} onClick={()=>onGoToTeam&&onGoToTeam(eq.id,temporada)}
                      style={{borderTop:"1px solid var(--fx-border2)",background:fondo,cursor:onGoToTeam?"pointer":"default",borderLeft:borde}}>
                      <td style={{padding:"10px 12px",fontWeight:700,color:zonaDesc?"#ef4444":zonaAsc?"#16a34a":zonaPOAsc?"#2563eb":zonaPO&&modoLiga?"#9333ea":"#94a3b8"}}>{i+1}</td>
                      <td style={{padding:"10px 12px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                          {team?.escudo&&<img loading="lazy" decoding="async" className={team?.tipo==="seleccion"?"bfdb-flag-bg":undefined} src={team.escudo} alt="" style={{width:22,height:22,objectFit:"contain"}}/>}
                          <span style={{fontWeight:600,color:"var(--fx-text)",whiteSpace:"nowrap"}}>{team?.nombre||eq.id}</span>
                        </div>
                      </td>
                      <td style={{textAlign:"center",padding:"10px 8px",color:"var(--fx-label)"}}>{eq.pj}</td>
                      <td style={{textAlign:"center",padding:"10px 8px",color:"#16a34a",fontWeight:600}}>{eq.pg}</td>
                      <td style={{textAlign:"center",padding:"10px 8px",color:"#dc2626",fontWeight:600}}>{eq.pp}</td>
                      <td style={{textAlign:"center",padding:"10px 8px",color:"var(--fx-label)"}}>{eq.pf}</td>
                      <td style={{textAlign:"center",padding:"10px 8px",color:"var(--fx-label)"}}>{eq.pc}</td>
                      <td style={{textAlign:"center",padding:"10px 8px",color:eq.dif>0?"#16a34a":eq.dif<0?"#dc2626":"#475569",fontWeight:600}}>{eq.dif>0?"+":""}{eq.dif}</td>
                      <td style={{textAlign:"center",padding:"10px 12px",fontWeight:800,color:"#7c3aed",fontSize:"14px"}}>{eq.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );})}
      {(vista==="grupos"||(modoLiga&&vista?.startsWith("grp")))&&grupos.length>0&&(modoLiga?(
        <div style={{fontSize:"11px",color:"var(--fx-muted2)",textAlign:"center",marginTop:"8px",lineHeight:"1.7"}}>
          {zl.ascenso&&<><span style={{display:"inline-block",width:10,height:10,background:"#16a34a",borderRadius:"3px",verticalAlign:"middle",marginRight:"4px"}}/>{zl.ascensoLabel||"Ascenso directo"}</>}
          {zl.playoffAsc&&<><span style={{display:"inline-block",width:10,height:10,background:"#2563eb",borderRadius:"3px",verticalAlign:"middle",margin:"0 4px 0 14px"}}/>{zl.playoffAscLabel||("Playoffs de ascenso ("+zl.ascenso+"º-"+(zl.playoffAsc)+"º)")}</>}
          {!zl.ascenso&&<><span style={{display:"inline-block",width:10,height:10,background:"#9333ea",borderRadius:"3px",verticalAlign:"middle",marginRight:"4px"}}/> Playoffs (1º-{PLAYOFF_PUESTOS}º)</>}
          {COPA_PUESTOS>0&&<><span style={{display:"inline-block",width:10,height:10,background:"#f59e0b",borderRadius:"3px",verticalAlign:"middle",margin:"0 4px 0 14px"}}/>{COPA_LABEL}</>}
          <span style={{display:"inline-block",width:10,height:10,background:"#ef4444",borderRadius:"3px",verticalAlign:"middle",margin:"0 4px 0 14px"}}/> Descenso
          <br/>{t("partidos.feb_tiebreaker")}
        </div>
      ):(
        <div style={{fontSize:"11px",color:"var(--fx-muted2)",textAlign:"center",marginTop:"8px"}}>
          Criterios de desempate FIBA: head-to-head → diferencia directa → diferencia global → puntos anotados
        </div>
      ))}
    </div>
  );
}


export { PartidosView };
export default PartidosView;
