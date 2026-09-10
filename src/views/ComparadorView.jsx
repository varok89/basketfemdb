import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useT } from "../lib/i18n";

/* Comparador de 2-3 jugadoras o equipos lado a lado. Toggle en el header:
   - modo "jugadoras": fetch a partido_boxscore, promedios por partido + radar SVG.
   - modo "equipos": fetch a partidos, PJ/V/D/PF/PC/DIF. Sin radar. */

const N=v=>{if(typeof v==="string"&&v.indexOf(":")>=0){const p=v.split(":");return (parseInt(p[0],10)||0)+(parseInt(p[1],10)||0)/60;}return Number(v)||0;};

const METRICAS=[
  {k:"pts",lbl:"PTS"},
  {k:"reb",lbl:"REB"},
  {k:"ast",lbl:"AST"},
  {k:"rob",lbl:"ROB"},
  {k:"tap",lbl:"TAP"},
  {k:"val",lbl:"VAL"},
  {k:"min",lbl:"MIN"},
  {k:"per",lbl:"PER"},
];
const PCTS=[
  {k:"tc",lbl:"%TC"},
  {k:"t3",lbl:"%T3"},
  {k:"tl",lbl:"%TL"},
];
const RADAR_KEYS=["pts","reb","ast","rob","tap","val"];
const COLORS=["#9333ea","#0ea5e9","#f97316"];

/* Equipos: enteros para PJ/V/D, resto 1 decimal. best null = no resaltar. */
const METRICAS_EQ=[
  {k:"pj",  lbl:"PJ",   fmt:v=>v,                                          best:null},
  {k:"v",   lbl:"V",    fmt:v=>v,                                          best:"max"},
  {k:"d",   lbl:"D",    fmt:v=>v,                                          best:"min"},
  {k:"pctV",lbl:"%V",   fmt:v=>v==null?"—":v.toFixed(1)+"%",               best:"max"},
  {k:"pfg", lbl:"PF/g", fmt:v=>v==null?"—":v.toFixed(1),                   best:"max"},
  {k:"pcg", lbl:"PC/g", fmt:v=>v==null?"—":v.toFixed(1),                   best:"min"},
  {k:"dif", lbl:"+/-",  fmt:v=>v==null?"—":(v>0?"+":"")+v,                 best:"max"},
  {k:"difg",lbl:"+/-/g",fmt:v=>v==null?"—":(v>0?"+":"")+v.toFixed(1),      best:"max"},
];

function agregarBox(rows){
  if(!rows||!rows.length)return null;
  const s=(k)=>rows.reduce((a,x)=>a+N(x[k]),0);
  const pj=rows.length;
  const avg=(k)=>pj?s(k)/pj:0;
  const pct=(a,i)=>{const I=s(i);return I?s(a)/I*100:null;};
  return {
    pj,
    pts:avg("puntos"),
    reb:avg("reb_totales"),
    ast:avg("asistencias"),
    rob:avg("robos"),
    tap:avg("tapones"),
    per:avg("perdidas"),
    val:avg("valoracion"),
    min:avg("minutos"),
    tc:pct("tc_anotados","tc_intentados"),
    t3:pct("t3_anotados","t3_intentados"),
    tl:pct("tl_anotados","tl_intentados"),
  };
}

function agregarEquipo(rows, idEquipo){
  if(!rows||!rows.length)return null;
  const jugados=rows.filter(p=>p.resultado_local!=null&&p.resultado_visitante!=null);
  if(!jugados.length)return null;
  let v=0,d=0,pf=0,pc=0;
  jugados.forEach(p=>{
    const a=Number(p.id_equipo_local===idEquipo?p.resultado_local:p.resultado_visitante)||0;
    const b=Number(p.id_equipo_local===idEquipo?p.resultado_visitante:p.resultado_local)||0;
    pf+=a; pc+=b;
    if(a>b)v++; else if(b>a)d++;
  });
  const pj=jugados.length;
  return {
    pj, v, d,
    pctV: pj?v*100/pj:null,
    pfg:  pj?pf/pj:null,
    pcg:  pj?pc/pj:null,
    dif:  pf-pc,
    difg: pj?(pf-pc)/pj:null,
  };
}

function Radar({datasets, size=260}){
  const R=size/2 - 30;
  const cx=size/2, cy=size/2;
  const n=RADAR_KEYS.length;
  const maxs={};
  RADAR_KEYS.forEach(k=>{
    maxs[k]=Math.max(1,...datasets.map(d=>d.values?.[k]||0));
  });
  const point=(k,i,v)=>{
    const ang=-Math.PI/2 + (2*Math.PI*i)/n;
    const r=(v/maxs[k])*R;
    return [cx+Math.cos(ang)*r, cy+Math.sin(ang)*r];
  };
  const axis=(i)=>{
    const ang=-Math.PI/2 + (2*Math.PI*i)/n;
    return [cx+Math.cos(ang)*R, cy+Math.sin(ang)*R];
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:"block",margin:"0 auto"}}>
      {[0.25,0.5,0.75,1].map((f,gi)=>{
        const pts=RADAR_KEYS.map((_,i)=>{
          const [x,y]=axis(i);
          return [cx+(x-cx)*f, cy+(y-cy)*f].join(",");
        }).join(" ");
        return <polygon key={gi} points={pts} fill="none" stroke="var(--fx-border2)" strokeWidth="1"/>;
      })}
      {RADAR_KEYS.map((k,i)=>{
        const [x,y]=axis(i);
        return <line key={k} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--fx-border2)" strokeWidth="1"/>;
      })}
      {datasets.map((d,di)=>{
        const pts=RADAR_KEYS.map((k,i)=>point(k,i,d.values?.[k]||0).join(",")).join(" ");
        return <g key={di}>
          <polygon points={pts} fill={d.color} fillOpacity="0.18" stroke={d.color} strokeWidth="2"/>
          {RADAR_KEYS.map((k,i)=>{
            const [x,y]=point(k,i,d.values?.[k]||0);
            return <circle key={k} cx={x} cy={y} r="3" fill={d.color}/>;
          })}
        </g>;
      })}
      {RADAR_KEYS.map((k,i)=>{
        const ang=-Math.PI/2 + (2*Math.PI*i)/n;
        const lx=cx+Math.cos(ang)*(R+16);
        const ly=cy+Math.sin(ang)*(R+16);
        return <text key={k} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" style={{fontSize:"11px",fontWeight:800,fill:"var(--fx-muted)"}}>{k.toUpperCase()}</text>;
      })}
    </svg>
  );
}

function PickerModal({modo, players, equipos, equiposNombres, exclude, onPick, onClose}){
  const t = useT();
  const [q,setQ]=useState("");
  const list=useMemo(()=>{
    const term=q.trim().toLowerCase();
    if(!term)return [];
    if(modo==="equipos"){
      return (equipos||[])
        .filter(e=>!exclude.has(e.id_equipo))
        .filter(e=>(e.nombre||"").toLowerCase().includes(term))
        .slice(0,30);
    }
    return (players||[])
      .filter(p=>!exclude.has(p.id_jugadora))
      .filter(p=>(p.nombre||"").toLowerCase().includes(term))
      .slice(0,30);
  },[modo,players,equipos,q,exclude]);
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1200,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 12px"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--fx-card)",borderRadius:"14px",width:"100%",maxWidth:"420px",boxShadow:"0 20px 60px rgba(0,0,0,0.4)",overflow:"hidden"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid var(--fx-border)",display:"flex",gap:"10px",alignItems:"center"}}>
          <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder={modo==="equipos"?"Buscar equipo…":t("comp.search")} style={{flex:1,padding:"10px 12px",border:"1.5px solid var(--fx-border)",borderRadius:"10px",fontSize:"14px",background:"var(--fx-card)",color:"var(--fx-text)"}}/>
          <button onClick={onClose} aria-label={t("common.close")} title={t("common.close")} style={{background:"none",border:"none",fontSize:"22px",cursor:"pointer",color:"var(--fx-muted2)"}}>×</button>
        </div>
        <div style={{maxHeight:"60vh",overflowY:"auto"}}>
          {q.trim().length<2&&<div style={{padding:"20px",textAlign:"center",color:"var(--fx-muted2)",fontSize:"13px"}}>{t("comp.search_hint")}</div>}
          {q.trim().length>=2&&list.length===0&&<div style={{padding:"20px",textAlign:"center",color:"var(--fx-muted2)",fontSize:"13px"}}>{t("comp.search_empty")}</div>}
          {modo==="jugadoras"&&list.map(p=>{
            const eqN=equiposNombres?.[p.id_equipo]||p.id_equipo||"";
            return (
              <button key={p.id_jugadora} onClick={()=>onPick(p)} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",padding:"10px 14px",border:"none",background:"transparent",cursor:"pointer",borderBottom:"1px solid var(--fx-border2)",textAlign:"left"}}>
                {p.foto?<img loading="lazy" src={p.foto} alt="" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:36,height:36,borderRadius:"50%",background:"var(--fx-hover)"}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:"13px",color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.nombre}</div>
                  <div style={{fontSize:"11px",color:"var(--fx-muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{eqN}</div>
                </div>
              </button>
            );
          })}
          {modo==="equipos"&&list.map(e=>(
            <button key={e.id_equipo} onClick={()=>onPick(e)} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",padding:"10px 14px",border:"none",background:"transparent",cursor:"pointer",borderBottom:"1px solid var(--fx-border2)",textAlign:"left"}}>
              {e.escudo
                ? <img loading="lazy" className={e.tipo==="seleccion"?"bfdb-flag-bg":undefined} src={e.escudo} alt="" style={{width:36,height:36,borderRadius:"6px",objectFit:"contain",background:"var(--fx-hover)"}}/>
                : <div style={{width:36,height:36,borderRadius:"6px",background:"var(--fx-hover)"}}/>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:"13px",color:"var(--fx-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nombre}</div>
                <div style={{fontSize:"11px",color:"var(--fx-muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.pais||"—"}{e.tipo==="seleccion"?" · Selección":""}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlotCard({modo, slot, idx, onOpen, onClear}){
  const t = useT();
  if(!slot){
    return (
      <button onClick={onOpen} style={{background:"var(--fx-card)",border:"2px dashed var(--fx-border)",borderRadius:"14px",padding:"28px 12px",cursor:"pointer",color:"var(--fx-muted)",fontSize:"13px",fontWeight:700,minHeight:"140px",minWidth:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"6px"}}>
        <div style={{fontSize:"28px"}}>➕</div>
        {modo==="equipos"?"Añadir equipo":t("comp.add")}
      </button>
    );
  }
  const entity=modo==="equipos"?slot.team:slot.player;
  const nombre=entity?.nombre||"";
  const foto=modo==="equipos"?entity?.escudo:entity?.foto;
  const isSel=modo==="equipos"&&entity?.tipo==="seleccion";
  const sub=modo==="equipos"
    ? (isSel?"Selección":(entity?.pais||"—"))
    : (entity?.posicion||"—")+(entity?.altura?` · ${entity.altura}m`:"");
  return (
    <div style={{background:"var(--fx-card)",borderRadius:"14px",padding:"14px 12px",boxShadow:"0 1px 6px rgba(0,0,0,0.06)",position:"relative",textAlign:"center",minHeight:"140px",minWidth:0,borderTop:`4px solid ${COLORS[idx]}`}}>
      <button onClick={onClear} title={t("comp.remove")} style={{position:"absolute",top:6,right:8,background:"transparent",border:"none",fontSize:"18px",cursor:"pointer",color:"var(--fx-muted2)"}}>×</button>
      {foto
        ? <img className={isSel?"bfdb-flag-bg":undefined} src={foto} alt="" style={modo==="equipos"
            ? {width:64,height:64,borderRadius:"10px",objectFit:"contain",border:`2px solid ${COLORS[idx]}`,background:"var(--fx-hover)"}
            : {width:64,height:64,borderRadius:"50%",objectFit:"cover",border:`2px solid ${COLORS[idx]}`}}/>
        : <div style={{width:64,height:64,borderRadius:modo==="equipos"?"10px":"50%",background:"var(--fx-hover)",margin:"0 auto"}}/>}
      <div style={{fontWeight:800,fontSize:"13px",color:"var(--fx-text)",marginTop:"8px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nombre}</div>
      <div style={{fontSize:"11px",color:"var(--fx-muted)",marginTop:"2px"}}>{sub}</div>
    </div>
  );
}

export default function ComparadorView({players, equipos, ligas, equiposNombres, onGoToPlayer, onGoToTeam}){
  const t = useT();
  const [modo,setModo]=useState("jugadoras"); // "jugadoras" | "equipos"
  const [slots,setSlots]=useState([null,null,null]);
  const [pickerFor,setPickerFor]=useState(null);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    window.history.replaceState({},"","/comparar");
  },[]);

  // Cambiar de modo limpia los slots (los datos no son compatibles).
  const switchModo=(nuevo)=>{
    if(nuevo===modo)return;
    setModo(nuevo);
    setSlots([null,null,null]);
    setPickerFor(null);
  };

  async function pickJugadora(idx, player){
    setPickerFor(null);
    setLoading(true);
    const {data}=await supabase.from("partido_boxscore")
      .select("id_partido,id_equipo,minutos,puntos,tc_anotados,tc_intentados,t3_anotados,t3_intentados,tl_anotados,tl_intentados,reb_totales,asistencias,robos,tapones,perdidas,faltas,valoracion,partidos!inner(temporada,id_liga)")
      .eq("id_jugadora",player.id_jugadora);
    setLoading(false);
    const rows=(data||[]).map(x=>({...x,...(x.partidos||{})}));
    const temps=[...new Set(rows.map(x=>x.temporada))].sort((a,b)=>String(b).localeCompare(String(a)));
    setSlots(prev=>{
      const next=[...prev];
      next[idx]={player,rows,tempSel:temps[0]||null,compSel:"ALL"};
      return next;
    });
  }

  async function pickEquipo(idx, team){
    setPickerFor(null);
    setLoading(true);
    const {data}=await supabase.from("partidos")
      .select("id,fecha_hora,temporada,id_liga,id_equipo_local,id_equipo_visitante,resultado_local,resultado_visitante")
      .or(`id_equipo_local.eq.${team.id_equipo},id_equipo_visitante.eq.${team.id_equipo}`);
    setLoading(false);
    const rows=data||[];
    const temps=[...new Set(rows.map(x=>x.temporada))].sort((a,b)=>String(b).localeCompare(String(a)));
    setSlots(prev=>{
      const next=[...prev];
      next[idx]={team,rows,tempSel:temps[0]||null,compSel:"ALL"};
      return next;
    });
  }

  const setSlotField=(idx,field,val)=>{
    setSlots(prev=>{
      const next=[...prev];
      if(!next[idx])return prev;
      next[idx]={...next[idx],[field]:val,...(field==="tempSel"?{compSel:"ALL"}:{})};
      return next;
    });
  };

  const clearSlot=idx=>setSlots(prev=>{const next=[...prev];next[idx]=null;return next;});

  const activos=slots.map((s,i)=>({s,i})).filter(x=>x.s);
  const excludeSet=new Set(activos.map(x=>modo==="equipos"?x.s.team.id_equipo:x.s.player.id_jugadora));
  const ligaMap=useMemo(()=>{const m={};(ligas||[]).forEach(l=>m[l.id_liga]=l);return m;},[ligas]);

  const stats=activos.map(({s})=>{
    const r=s.rows.filter(x=>x.temporada===s.tempSel && (s.compSel==="ALL"||x.id_liga===s.compSel));
    return modo==="equipos" ? agregarEquipo(r, s.team.id_equipo) : agregarBox(r);
  });

  const btnTab=(active)=>({
    border:"none", borderRadius:"10px", padding:"7px 14px", fontSize:"13px", fontWeight:700,
    cursor:"pointer", background:active?"#9333ea":"var(--fx-card)", color:active?"#fff":"var(--fx-muted)",
    boxShadow:active?"none":"0 1px 4px rgba(0,0,0,0.06)"
  });

  return (
    <div style={{maxWidth:"980px",margin:"0 auto",padding:"16px",fontFamily:"system-ui,sans-serif"}}>
      <div style={{marginBottom:"16px"}}>
        <h1 style={{fontWeight:800,fontSize:"22px",color:"var(--fx-text)",margin:0}}>{modo==="equipos"?"Comparar equipos":t("comp.title")}</h1>
        <p style={{color:"var(--fx-muted)",fontSize:"13px",margin:"4px 0 0"}}>{modo==="equipos"?"Elige hasta 3 equipos y una temporada para verlos lado a lado.":t("comp.subtitle")}</p>
      </div>

      <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
        <button onClick={()=>switchModo("jugadoras")} style={btnTab(modo==="jugadoras")}>👤 Jugadoras</button>
        <button onClick={()=>switchModo("equipos")} style={btnTab(modo==="equipos")}>🏟️ Equipos</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"20px"}}>
        {[0,1,2].map(i=>(
          <SlotCard key={i} modo={modo} slot={slots[i]} idx={i} onOpen={()=>setPickerFor(i)} onClear={()=>clearSlot(i)}/>
        ))}
      </div>

      {loading && <div style={{textAlign:"center",padding:"20px",color:"var(--fx-muted)"}}>{t("comp.loading")}</div>}

      {activos.length>0 && (
        <>
          <div style={{background:"var(--fx-card)",borderRadius:"14px",padding:"14px",marginBottom:"14px",boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
            <div style={{display:"grid",gridTemplateColumns:`repeat(${activos.length},1fr)`,gap:"10px"}}>
              {activos.map(({s,i})=>{
                const temps=[...new Set(s.rows.map(x=>x.temporada))].sort((a,b)=>String(b).localeCompare(String(a)));
                const compsTemp=[...new Set(s.rows.filter(x=>x.temporada===s.tempSel).map(x=>x.id_liga))];
                const nombre=modo==="equipos"?s.team.nombre:s.player.nombre;
                return (
                  <div key={i} style={{borderLeft:`3px solid ${COLORS[i]}`,paddingLeft:"10px"}}>
                    <div style={{fontSize:"11px",fontWeight:700,color:"var(--fx-muted)",marginBottom:"6px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nombre}</div>
                    {temps.length>0?(
                      <select value={s.tempSel||""} onChange={e=>setSlotField(i,"tempSel",e.target.value)} style={{width:"100%",padding:"6px 8px",borderRadius:"8px",border:"1px solid var(--fx-border)",fontSize:"12px",background:"var(--fx-card)",color:"var(--fx-text)",marginBottom:"6px"}}>
                        {temps.map(tt=><option key={tt} value={tt}>{tt}</option>)}
                      </select>
                    ):<div style={{fontSize:"11px",color:"var(--fx-muted2)"}}>{t("comp.no_data")}</div>}
                    {compsTemp.length>1 && (
                      <select value={s.compSel} onChange={e=>setSlotField(i,"compSel",e.target.value)} style={{width:"100%",padding:"6px 8px",borderRadius:"8px",border:"1px solid var(--fx-border)",fontSize:"12px",background:"var(--fx-card)",color:"var(--fx-text)"}}>
                        <option value="ALL">{t("comp.all_comps")}</option>
                        {compsTemp.map(c=><option key={c} value={c}>{ligaMap[c]?.nombre||c}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{background:"var(--fx-card)",borderRadius:"14px",padding:"14px",marginBottom:"14px",boxShadow:"0 1px 6px rgba(0,0,0,0.05)",overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:"320px"}}>
              <thead>
                <tr>
                  <th style={{textAlign:"left",fontSize:"11px",color:"var(--fx-muted)",padding:"6px 4px"}}>{t("comp.metric")}</th>
                  {activos.map(({s,i})=>{
                    const nombre=modo==="equipos"?s.team.nombre:s.player.nombre;
                    const label=modo==="equipos"?nombre:nombre.split(" ").slice(-1)[0];
                    return (
                      <th key={i} style={{textAlign:"center",fontSize:"11px",color:COLORS[i],padding:"6px 4px",fontWeight:800}}>{label}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {modo==="equipos" ? (
                  METRICAS_EQ.map(m=>{
                    const vals=stats.map(st=>st?.[m.k]);
                    const validos=vals.filter(v=>v!=null);
                    const best=(!m.best||!validos.length)?null:(m.best==="min"?Math.min(...validos):Math.max(...validos));
                    return (
                      <tr key={m.k} style={{borderTop:"1px solid var(--fx-border2)"}}>
                        <td style={{fontSize:"12px",color:"var(--fx-muted)",padding:"6px 4px",fontWeight:600}}>{m.lbl}</td>
                        {vals.map((v,i)=>(
                          <td key={i} style={{textAlign:"center",fontSize:"13px",padding:"6px 4px",fontWeight:v!=null&&v===best?800:500,color:v!=null&&v===best?COLORS[i]:"var(--fx-text)"}}>
                            {v==null?"—":m.fmt(v)}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                ) : (
                  <>
                    <tr>
                      <td style={{fontSize:"12px",color:"var(--fx-muted)",padding:"6px 4px",fontWeight:600}}>PJ</td>
                      {stats.map((st,i)=>(
                        <td key={i} style={{textAlign:"center",fontSize:"13px",padding:"6px 4px",color:"var(--fx-text)"}}>{st?.pj||"—"}</td>
                      ))}
                    </tr>
                    {METRICAS.map(m=>{
                      const vals=stats.map(st=>st?.[m.k]);
                      const validos=vals.filter(v=>v!=null);
                      const best=validos.length?(m.k==="per"?Math.min(...validos):Math.max(...validos)):null;
                      return (
                        <tr key={m.k} style={{borderTop:"1px solid var(--fx-border2)"}}>
                          <td style={{fontSize:"12px",color:"var(--fx-muted)",padding:"6px 4px",fontWeight:600}}>{m.lbl}</td>
                          {vals.map((v,i)=>(
                            <td key={i} style={{textAlign:"center",fontSize:"13px",padding:"6px 4px",fontWeight:v!=null&&v===best?800:500,color:v!=null&&v===best?COLORS[i]:"var(--fx-text)"}}>
                              {v==null?"—":v.toFixed(1)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {PCTS.map(m=>{
                      const vals=stats.map(st=>st?.[m.k]);
                      const validos=vals.filter(v=>v!=null);
                      const best=validos.length?Math.max(...validos):null;
                      return (
                        <tr key={m.k} style={{borderTop:"1px solid var(--fx-border2)"}}>
                          <td style={{fontSize:"12px",color:"var(--fx-muted)",padding:"6px 4px",fontWeight:600}}>{m.lbl}</td>
                          {vals.map((v,i)=>(
                            <td key={i} style={{textAlign:"center",fontSize:"13px",padding:"6px 4px",fontWeight:v!=null&&v===best?800:500,color:v!=null&&v===best?COLORS[i]:"var(--fx-text)"}}>
                              {v==null?"—":v.toFixed(1)+"%"}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {modo==="jugadoras" && stats.some(s=>s) && (
            <div style={{background:"var(--fx-card)",borderRadius:"14px",padding:"14px",boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
              <div style={{fontSize:"12px",fontWeight:800,color:"var(--fx-muted)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{t("comp.profile")}</div>
              <Radar datasets={activos.map(({i})=>({color:COLORS[i], values:stats[i]||{}}))}/>
              <div style={{display:"flex",gap:"14px",justifyContent:"center",flexWrap:"wrap",marginTop:"10px"}}>
                {activos.map(({s,i})=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"12px",color:"var(--fx-text)"}}>
                    <span style={{width:12,height:12,borderRadius:3,background:COLORS[i],display:"inline-block"}}/>
                    <button onClick={()=>onGoToPlayer&&onGoToPlayer(s.player.id_jugadora)} style={{background:"none",border:"none",padding:0,color:"var(--fx-text)",cursor:"pointer",fontWeight:700,textDecoration:"underline"}}>{s.player.nombre}</button>
                  </div>
                ))}
              </div>
              <div style={{fontSize:"10px",color:"var(--fx-muted2)",textAlign:"center",marginTop:"6px"}}>{t("comp.radar_note")}</div>
            </div>
          )}

          {modo==="equipos" && (
            <div style={{display:"flex",gap:"14px",justifyContent:"center",flexWrap:"wrap",marginTop:"6px"}}>
              {activos.map(({s,i})=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"12px",color:"var(--fx-text)"}}>
                  <span style={{width:12,height:12,borderRadius:3,background:COLORS[i],display:"inline-block"}}/>
                  <button onClick={()=>onGoToTeam&&onGoToTeam(s.team.id_equipo)} style={{background:"none",border:"none",padding:0,color:"var(--fx-text)",cursor:"pointer",fontWeight:700,textDecoration:"underline"}}>{s.team.nombre}</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {pickerFor!==null && (
        <PickerModal modo={modo} players={players} equipos={equipos} equiposNombres={equiposNombres} exclude={excludeSet}
          onPick={p=>modo==="equipos"?pickEquipo(pickerFor,p):pickJugadora(pickerFor,p)} onClose={()=>setPickerFor(null)}/>
      )}
    </div>
  );
}
