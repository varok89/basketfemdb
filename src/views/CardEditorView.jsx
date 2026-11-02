// src/views/CardEditorView.jsx
// Editor visual de la card (/api/card). Solo para varok89@gmail.com.
// Config persistida en public.app_config key='card'.
import {useState,useEffect,useMemo,useRef} from "react";
import {supabase} from "../lib/supabaseClient";

const DEFAULTS = {
  fontFamily: "Oswald", fontWeight: 700,
  colText: "#1f2937", colMuted: "#6b7280", cardBg: "#f5efe8",
  cardBorderRadius: 24, outerPadding: 28,
  innerPaddingTop: 52, innerPaddingSide: 32, innerPaddingBottom: 24,
  colGap: 64, photoSize: 560,
  logoSize: 120, logoLeft: 452, logoTop: -26,
  rayaBottom: 40, escudoOpacity: 0.22,
  equipoLogoSize: 70, ligaLogoSize: 44,
  nombreSize: 60, ligaSize: 22, scoreSize: 54, tirosSize: 24,
  statSize: 36, statIconSize: 34, divisorHeight: 3,
  statSpacerTop: 2, statSpacerBottom: 5,
  width: 1080, height: 1080,
};

const FONT_FAMILIES = ["Oswald", "Bebas Neue", "Barlow Condensed", "Inter"];

const GRUPOS = [
  { titulo: "Tipografía", knobs: [
    { k: "fontFamily", label: "Fuente", type: "select", opts: FONT_FAMILIES },
    { k: "fontWeight", label: "Peso", type: "select", opts: [400, 700, 800] },
  ]},
  { titulo: "Colores", knobs: [
    { k: "colText", label: "Texto", type: "color" },
    { k: "colMuted", label: "Texto gris", type: "color" },
    { k: "cardBg", label: "Fondo card", type: "color" },
  ]},
  { titulo: "Logo La Basketneta", knobs: [
    { k: "logoSize", label: "Tamaño", min: 40, max: 300 },
    { k: "logoLeft", label: "X (left)", min: 0, max: 1000 },
    { k: "logoTop", label: "Y (top)", min: -100, max: 300 },
  ]},
  { titulo: "Foto jugadora + escudo", knobs: [
    { k: "photoSize", label: "Tamaño foto", min: 200, max: 800 },
    { k: "escudoOpacity", label: "Opacidad escudo", min: 0, max: 1, step: 0.01 },
    { k: "rayaBottom", label: "Raya desde abajo (px)", min: 0, max: 300 },
    { k: "divisorHeight", label: "Grosor raya", min: 1, max: 10 },
  ]},
  { titulo: "Columna derecha", knobs: [
    { k: "ligaLogoSize", label: "Tamaño logo liga", min: 20, max: 100 },
    { k: "ligaSize", label: "Fuente liga", min: 10, max: 60 },
    { k: "equipoLogoSize", label: "Tamaño escudos", min: 30, max: 150 },
    { k: "scoreSize", label: "Fuente marcador", min: 20, max: 120 },
    { k: "statSize", label: "Fuente stats", min: 14, max: 60 },
    { k: "statIconSize", label: "Tamaño iconos stats", min: 14, max: 60 },
    { k: "statSpacerTop", label: "Spacer top (flex)", min: 0, max: 10 },
    { k: "statSpacerBottom", label: "Spacer bottom (flex)", min: 0, max: 10 },
  ]},
  { titulo: "Nombre + tiros", knobs: [
    { k: "nombreSize", label: "Fuente nombre", min: 20, max: 120 },
    { k: "tirosSize", label: "Fuente T2/T3/TL", min: 10, max: 60 },
  ]},
  { titulo: "Padding + border", knobs: [
    { k: "outerPadding", label: "Padding exterior (halftone)", min: 0, max: 100 },
    { k: "innerPaddingTop", label: "Inner padding top", min: 0, max: 150 },
    { k: "innerPaddingSide", label: "Inner padding lateral", min: 0, max: 100 },
    { k: "innerPaddingBottom", label: "Inner padding bottom", min: 0, max: 100 },
    { k: "colGap", label: "Gap entre columnas", min: 0, max: 200 },
    { k: "cardBorderRadius", label: "Border radius", min: 0, max: 60 },
  ]},
  { titulo: "Dimensiones salida", knobs: [
    { k: "width", label: "Ancho PNG", min: 400, max: 2000 },
    { k: "height", label: "Alto PNG", min: 400, max: 2000 },
  ]},
];

export function CardEditorView({user}){
  const [cfg,setCfg] = useState(DEFAULTS);
  const [savedCfg,setSavedCfg] = useState(DEFAULTS);
  const [targetJug,setTargetJug] = useState("J001");
  const [targetPart,setTargetPart] = useState("");
  const [partidos,setPartidos] = useState([]);
  const [saving,setSaving] = useState(false);
  const [msg,setMsg] = useState("");
  const [bust,setBust] = useState(Date.now());
  const debounceRef = useRef(null);

  useEffect(()=>{
    (async()=>{
      const {data} = await supabase.from("app_config").select("value").eq("key","card").maybeSingle();
      if(data?.value){
        const merged = {...DEFAULTS, ...data.value};
        setCfg(merged);
        setSavedCfg(merged);
      }
    })();
  },[]);

  useEffect(()=>{
    if(!targetJug) return;
    (async()=>{
      const {data} = await supabase.from("partido_boxscore")
        .select("id_partido,puntos,partidos!inner(id,fecha_hora,resultado_local,resultado_visitante)")
        .eq("id_jugadora",targetJug);
      const rows = (data||[]).map(x=>({...x,...(x.partidos||{})}))
        .filter(x=>x.resultado_local!=null)
        .sort((a,b)=>(b.fecha_hora||"").localeCompare(a.fecha_hora||""));
      setPartidos(rows);
      if(rows.length>0 && !targetPart) setTargetPart(String(rows[0].id_partido));
    })();
  },[targetJug]);

  useEffect(()=>{
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>setBust(Date.now()), 400);
    return ()=>clearTimeout(debounceRef.current);
  },[cfg]);

  const previewUrl = useMemo(()=>{
    if(!targetJug || !targetPart) return null;
    const params = new URLSearchParams({jugadora: targetJug, partido: targetPart, preview:"1", bust: String(bust)});
    for(const [k,v] of Object.entries(cfg)){
      params.set(k, String(v));
    }
    return `/api/card?${params.toString()}`;
  },[targetJug,targetPart,cfg,bust]);

  const dirty = useMemo(()=>JSON.stringify(cfg) !== JSON.stringify(savedCfg),[cfg,savedCfg]);

  async function guardar(){
    setSaving(true); setMsg("");
    const {error} = await supabase.from("app_config").upsert({key:"card", value: cfg, updated_at: new Date().toISOString()}, {onConflict:"key"});
    setSaving(false);
    if(error){ setMsg("❌ "+error.message); return; }
    setSavedCfg(cfg);
    setMsg("✅ Guardado");
    setTimeout(()=>setMsg(""), 3000);
  }
  function resetDefaults(){
    if(!confirm("¿Volver a los valores por defecto? (no guarda hasta que pulses Guardar)")) return;
    setCfg({...DEFAULTS});
  }
  function updateKnob(k, v){
    setCfg(prev=>({...prev, [k]: v}));
  }

  if(user?.email !== "varok89@gmail.com"){
    return <div style={{padding:"40px",textAlign:"center",color:"var(--fx-muted2)"}}>Acceso restringido.</div>;
  }

  return(
    <div style={{display:"flex",gap:"20px",padding:"16px",height:"calc(100vh - 100px)"}}>
      <div style={{flex:"0 0 420px",overflowY:"auto",background:"var(--fx-card)",borderRadius:"14px",padding:"16px"}}>
        <h2 style={{margin:"0 0 14px",fontSize:"18px",fontWeight:800,color:"var(--fx-text)"}}>📸 Editor Card</h2>
        <div style={{marginBottom:"14px",padding:"10px",background:"var(--fx-hover)",borderRadius:"10px"}}>
          <label style={{display:"block",fontSize:"11px",fontWeight:700,color:"var(--fx-muted2)",marginBottom:"4px"}}>Jugadora (id)</label>
          <input value={targetJug} onChange={e=>{setTargetJug(e.target.value); setTargetPart("");}} style={{width:"100%",padding:"7px 9px",borderRadius:"6px",border:"1px solid var(--fx-border)",background:"var(--fx-card)",color:"var(--fx-text)",fontSize:"13px"}}/>
          {partidos.length>0 && <>
            <label style={{display:"block",fontSize:"11px",fontWeight:700,color:"var(--fx-muted2)",marginTop:"8px",marginBottom:"4px"}}>Partido</label>
            <select value={targetPart} onChange={e=>setTargetPart(e.target.value)} style={{width:"100%",padding:"7px 9px",borderRadius:"6px",border:"1px solid var(--fx-border)",background:"var(--fx-card)",color:"var(--fx-text)",fontSize:"12px"}}>
              {partidos.map(p=>{
                const dt = p.fecha_hora ? new Date(p.fecha_hora).toLocaleDateString("es-ES",{day:"2-digit",month:"short"}) : "";
                return <option key={p.id_partido} value={p.id_partido}>{dt} — {p.resultado_local}-{p.resultado_visitante} ({p.puntos}p)</option>;
              })}
            </select>
          </>}
        </div>
        {GRUPOS.map(g=>(
          <div key={g.titulo} style={{marginBottom:"14px"}}>
            <div style={{fontSize:"12px",fontWeight:800,color:"var(--fx-text)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"1px"}}>{g.titulo}</div>
            {g.knobs.map(kn=>{
              const v = cfg[kn.k];
              return(
                <div key={kn.k} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
                  <label style={{flex:"1 1 150px",fontSize:"11px",color:"var(--fx-label)"}}>{kn.label}</label>
                  {kn.type==="color" ? (
                    <>
                      <input type="color" value={v} onChange={e=>updateKnob(kn.k, e.target.value)} style={{width:"38px",height:"28px",border:"1px solid var(--fx-border)",borderRadius:"4px",cursor:"pointer"}}/>
                      <input value={v} onChange={e=>updateKnob(kn.k, e.target.value)} style={{width:"72px",padding:"4px 6px",borderRadius:"4px",border:"1px solid var(--fx-border)",background:"var(--fx-card)",color:"var(--fx-text)",fontSize:"11px",fontFamily:"monospace"}}/>
                    </>
                  ) : kn.type==="select" ? (
                    <select value={v} onChange={e=>updateKnob(kn.k, isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))} style={{flex:1,padding:"5px 7px",borderRadius:"4px",border:"1px solid var(--fx-border)",background:"var(--fx-card)",color:"var(--fx-text)",fontSize:"12px"}}>
                      {kn.opts.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <>
                      <input type="range" min={kn.min} max={kn.max} step={kn.step||1} value={v} onChange={e=>updateKnob(kn.k, Number(e.target.value))} style={{flex:1}}/>
                      <input type="number" min={kn.min} max={kn.max} step={kn.step||1} value={v} onChange={e=>updateKnob(kn.k, Number(e.target.value))} style={{width:"62px",padding:"4px 6px",borderRadius:"4px",border:"1px solid var(--fx-border)",background:"var(--fx-card)",color:"var(--fx-text)",fontSize:"11px"}}/>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div style={{position:"sticky",bottom:"-16px",marginTop:"20px",background:"var(--fx-card)",padding:"12px 0 4px",borderTop:"1px solid var(--fx-border)",display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}}>
          <button onClick={guardar} disabled={!dirty||saving} style={{flex:1,background:dirty?"#16a34a":"var(--fx-border)",color:"#fff",border:"none",borderRadius:"8px",padding:"10px",fontWeight:700,fontSize:"13px",cursor:dirty?"pointer":"not-allowed"}}>{saving?"Guardando…":(dirty?"💾 Guardar":"Sin cambios")}</button>
          <button onClick={resetDefaults} style={{background:"var(--fx-hover)",color:"var(--fx-label)",border:"none",borderRadius:"8px",padding:"10px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"}}>↩ Reset</button>
          {msg && <div style={{width:"100%",fontSize:"12px",color:"var(--fx-text)",textAlign:"center"}}>{msg}</div>}
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",overflow:"auto"}}>
        {previewUrl ? (
          <div style={{maxWidth:"min(700px, 100%)",width:"100%"}}>
            <img src={previewUrl} alt="preview" style={{width:"100%",height:"auto",display:"block",borderRadius:"12px",boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}/>
            <div style={{marginTop:"8px",fontSize:"11px",color:"var(--fx-muted2)",textAlign:"center",wordBreak:"break-all"}}>Preview (parámetros en URL) — Guarda para aplicar como default.</div>
          </div>
        ) : (
          <div style={{padding:"40px",textAlign:"center",color:"var(--fx-muted2)"}}>Elige jugadora y partido para previsualizar.</div>
        )}
      </div>
    </div>
  );
}
