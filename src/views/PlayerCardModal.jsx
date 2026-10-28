import {useState,useEffect} from "react";
import {supabase} from "../lib/supabaseClient";

export function PlayerCardModal({jugadora,equiposNombres,onClose}){
  const [rows,setRows]=useState(null);
  const [elegido,setElegido]=useState(null);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    let cancel=false;
    (async()=>{
      const {data}=await supabase.from("partido_boxscore")
        .select("id_partido,minutos,puntos,partidos!inner(id,temporada,fecha_hora,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante)")
        .eq("id_jugadora",jugadora.id_jugadora);
      if(cancel) return;
      const flat=(data||[]).map(x=>({...x,...(x.partidos||{})})).filter(x=>x.resultado_local!=null);
      const temps=[...new Set(flat.map(x=>x.temporada))].sort((a,b)=>String(b).localeCompare(String(a)));
      const tempActual=temps[0]||null;
      const soloActual=flat.filter(x=>x.temporada===tempActual).sort((a,b)=>(b.fecha_hora||"").localeCompare(a.fecha_hora||""));
      setRows(soloActual);
      if(soloActual.length>0) setElegido(soloActual[0].id_partido);
    })();
    return()=>{cancel=true;};
  },[jugadora.id_jugadora]);

  const nombreEq=(id)=>{
    if(!id) return "";
    if(equiposNombres && equiposNombres[id]) return equiposNombres[id];
    return id;
  };

  const url = elegido ? `/api/card?jugadora=${encodeURIComponent(jugadora.id_jugadora)}&partido=${elegido}` : null;

  async function compartirODescargar(){
    if(!url) return;
    setLoading(true);
    try{
      const r = await fetch(url);
      if(!r.ok){ alert("No se pudo generar la card"); return; }
      const blob = await r.blob();
      const file = new File([blob], `${jugadora.nombre||"jugadora"}-${elegido}.png`, {type:"image/png"});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        try{ await navigator.share({files:[file], title:jugadora.nombre}); return; }catch(_){ /* usuario canceló */ }
      }
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(href),1000);
    }catch(e){ alert("Error: "+e.message); }
    finally{ setLoading(false); }
  }

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--fx-card)",borderRadius:"18px",padding:"20px",maxWidth:"560px",width:"100%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 10px 40px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
          <h3 style={{margin:0,fontSize:"18px",fontWeight:800,color:"var(--fx-text)"}}>📸 Crear card · {jugadora.nombre}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"24px",cursor:"pointer",color:"var(--fx-muted2)",lineHeight:1}}>×</button>
        </div>
        {rows===null ? (
          <div style={{padding:"30px",textAlign:"center",color:"var(--fx-muted2)"}}>Cargando partidos…</div>
        ) : rows.length===0 ? (
          <div style={{padding:"30px",textAlign:"center",color:"var(--fx-muted2)",fontSize:"14px"}}>Sin partidos jugados en la temporada actual.</div>
        ) : (<>
          <div style={{marginBottom:"14px"}}>
            <label style={{display:"block",fontSize:"12px",fontWeight:700,color:"var(--fx-muted2)",marginBottom:"6px"}}>Partido</label>
            <select value={elegido||""} onChange={e=>setElegido(parseInt(e.target.value,10))} style={{width:"100%",padding:"9px 10px",borderRadius:"8px",border:"1px solid var(--fx-border)",background:"var(--fx-card)",color:"var(--fx-text)",fontSize:"13px"}}>
              {rows.map(r=>{
                const dt = r.fecha_hora ? new Date(r.fecha_hora).toLocaleDateString("es-ES",{day:"2-digit",month:"short"}) : "";
                const lab = `${dt} · ${nombreEq(r.id_equipo_local)} ${r.resultado_local}-${r.resultado_visitante} ${nombreEq(r.id_equipo_visitante)} (${r.puntos||0}p)`;
                return <option key={r.id_partido} value={r.id_partido}>{lab}</option>;
              })}
            </select>
          </div>
          {url && (
            <div style={{marginBottom:"14px",background:"#000",borderRadius:"12px",overflow:"hidden",aspectRatio:"1/1",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <img src={url} alt="preview" style={{width:"100%",height:"auto",display:"block"}} loading="lazy"/>
            </div>
          )}
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={compartirODescargar} disabled={loading||!url} style={{flex:1,background:loading?"#9ca3af":"#f97316",color:"#fff",border:"none",borderRadius:"10px",padding:"11px",fontWeight:700,fontSize:"14px",cursor:loading?"wait":"pointer"}}>
              {loading?"Generando…":(typeof navigator!=="undefined"&&navigator.canShare?"📤 Compartir / Descargar":"⬇️ Descargar")}
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}
