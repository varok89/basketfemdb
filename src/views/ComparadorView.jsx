import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useT } from "../lib/i18n";

/* Comparador de 2-3 jugadoras lado a lado. Reutiliza el patron de fetch a
   partido_boxscore de StatsJugadora en App.jsx. Radar SVG a mano (6 ejes),
   sin libreria — YAGNI. */

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

function PickerModal({players, equiposNombres, exclude, onPick, onClose}){
  const t = useT();
  const [q,setQ]=useState("");
  const list=useMemo(()=>{
    const term=q.trim().toLowerCase();
    if(!term)return [];
    return (players||[])
      .filter(p=>!exclude.has(p.id_jugadora))
      .filter(p=>(p.nombre||"").toLowerCase().includes(term))
      .slice(0,30);
  },[players,q,exclude]);
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1200,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 12px"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--fx-card)",borderRadius:"14px",width:"100%",maxWidth:"420px",boxShadow:"0 20px 60px rgba(0,0,0,0.4)",overflow:"hidden"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid var(--fx-border)",display:"flex",gap:"10px",alignItems:"center"}}>
          <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder={t("comp.search")} style={{flex:1,padding:"10px 12px",border:"1.5px solid var(--fx-border)",borderRadius:"10px",fontSize:"14px",background:"var(--fx-card)",color:"var(--fx-text)"}}/>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"22px",cursor:"pointer",color:"var(--fx-muted2)"}}>×</button>
        </div>
        <div style={{maxHeight:"60vh",overflowY:"auto"}}>
          {q.trim().length<2&&<div style={{padding:"20px",textAlign:"center",color:"var(--fx-muted2)",fontSize:"13px"}}>{t("comp.search_hint")}</div>}
          {q.trim().length>=2&&list.length===0&&<div style={{padding:"20px",textAlign:"center",color:"var(--fx-muted2)",fontSize:"13px"}}>{t("comp.search_empty")}</div>}
          {list.map(p=>{
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
        </div>
      </div>
    </div>
  );
}

function SlotCard({slot, idx, onOpen, onClear}){
  const t = useT();
  if(!slot){
    return (
      <button onClick={onOpen} style={{background:"var(--fx-card)",border:"2px dashed var(--fx-border)",borderRadius:"14px",padding:"28px 12px",cursor:"pointer",color:"var(--fx-muted)",fontSize:"13px",fontWeight:700,minHeight:"140px",minWidth:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"6px"}}>
        <div style={{fontSize:"28px"}}>➕</div>
        {t("comp.add")}
      </button>
    );
  }
  const {player}=slot;
  return (
    <div style={{background:"var(--fx-card)",borderRadius:"14px",padding:"14px 12px",boxShadow:"0 1px 6px rgba(0,0,0,0.06)",position:"relative",textAlign:"center",minHeight:"140px",minWidth:0,borderTop:`4px solid ${COLORS[idx]}`}}>
      <button onClick={onClear} title={t("comp.remove")} style={{position:"absolute",top:6,right:8,background:"transparent",border:"none",fontSize:"18px",cursor:"pointer",color:"var(--fx-muted2)"}}>×</button>
      {player.foto
        ? <img src={player.foto} alt="" style={{width:64,height:64,borderRadius:"50%",objectFit:"cover",border:`2px solid ${COLORS[idx]}`}}/>
        : <div style={{width:64,height:64,borderRadius:"50%",background:"var(--fx-hover)",margin:"0 auto"}}/>}
      <div style={{fontWeight:800,fontSize:"13px",color:"var(--fx-text)",marginTop:"8px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{player.nombre}</div>
      <div style={{fontSize:"11px",color:"var(--fx-muted)",marginTop:"2px"}}>{player.posicion||"—"}{player.altura?` · ${player.altura}m`:""}</div>
    </div>
  );
}

export default function ComparadorView({players, equipos, ligas, equiposNombres, onGoToPlayer}){
  const t = useT();
  const [slots,setSlots]=useState([null,null,null]);
  const [pickerFor,setPickerFor]=useState(null);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    window.history.replaceState({},"","/comparar");
  },[]);

  async function pickForSlot(idx, player){
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
  const excludeSet=new Set(activos.map(x=>x.s.player.id_jugadora));
  const ligaMap=useMemo(()=>{const m={};(ligas||[]).forEach(l=>m[l.id_liga]=l);return m;},[ligas]);

  const stats=activos.map(({s})=>{
    const r=s.rows.filter(x=>x.temporada===s.tempSel && (s.compSel==="ALL"||x.id_liga===s.compSel));
    return agregarBox(r);
  });

  return (
    <div style={{maxWidth:"980px",margin:"0 auto",padding:"16px",fontFamily:"system-ui,sans-serif"}}>
      <div style={{marginBottom:"16px"}}>
        <h1 style={{fontWeight:800,fontSize:"22px",color:"var(--fx-text)",margin:0}}>{t("comp.title")}</h1>
        <p style={{color:"var(--fx-muted)",fontSize:"13px",margin:"4px 0 0"}}>{t("comp.subtitle")}</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"20px"}}>
        {[0,1,2].map(i=>(
          <SlotCard key={i} slot={slots[i]} idx={i} onOpen={()=>setPickerFor(i)} onClear={()=>clearSlot(i)}/>
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
                return (
                  <div key={i} style={{borderLeft:`3px solid ${COLORS[i]}`,paddingLeft:"10px"}}>
                    <div style={{fontSize:"11px",fontWeight:700,color:"var(--fx-muted)",marginBottom:"6px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.player.nombre}</div>
                    {temps.length>0?(
                      <select value={s.tempSel||""} onChange={e=>setSlotField(i,"tempSel",e.target.value)} style={{width:"100%",padding:"6px 8px",borderRadius:"8px",border:"1px solid var(--fx-border)",fontSize:"12px",background:"var(--fx-card)",color:"var(--fx-text)",marginBottom:"6px"}}>
                        {temps.map(t=><option key={t} value={t}>{t}</option>)}
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
                  {activos.map(({s,i})=>(
                    <th key={i} style={{textAlign:"center",fontSize:"11px",color:COLORS[i],padding:"6px 4px",fontWeight:800}}>
                      {s.player.nombre.split(" ").slice(-1)[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
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
              </tbody>
            </table>
          </div>

          {stats.some(s=>s) && (
            <div style={{background:"var(--fx-card)",borderRadius:"14px",padding:"14px",boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
              <div style={{fontSize:"12px",fontWeight:800,color:"var(--fx-muted)",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{t("comp.profile")}</div>
              <Radar datasets={activos.map(({s,i})=>({color:COLORS[i], values:stats[i]||{}}))}/>
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
        </>
      )}

      {pickerFor!==null && (
        <PickerModal players={players} equiposNombres={equiposNombres} exclude={excludeSet}
          onPick={p=>pickForSlot(pickerFor,p)} onClose={()=>setPickerFor(null)}/>
      )}
    </div>
  );
}
