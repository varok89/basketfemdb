import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { UserAvatar } from "../lib/avatar";
import { useT, locale } from "../lib/i18n";

function FlagSelect({value,options,onChange,disabled,placeholder,size}){
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const current=options.find(o=>o.id===value);
  const isSm=size==="sm";
  const fh=isSm?10:12,fw=isSm?14:16;
  const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  const nq=norm(q);
  const filtered=nq?options.filter(o=>norm(o.label).includes(nq)):options;
  const flag=url=>url
    ?<img loading="lazy" decoding="async" src={url} alt="" style={{width:fw,height:fh,objectFit:"contain",flexShrink:0}}/>
    :<span style={{width:fw,height:fh,background:"#e2e8f0",borderRadius:2,flexShrink:0}}/>;
  const toggle=()=>{if(disabled)return;setOpen(o=>{const nv=!o;if(nv)setQ("");return nv;});};
  return(
    <div style={{position:"relative",flex:1,minWidth:0}}>
      <button type="button" onClick={toggle} disabled={disabled}
        style={{display:"flex",alignItems:"center",gap:"5px",width:"100%",textAlign:"left",
          padding:isSm?"4px 6px":"6px 8px",fontSize:isSm?"11px":"12px",
          border:"1px solid #cbd5e1",borderRadius:"6px",background:disabled?"#f1f5f9":"#fff",
          cursor:disabled?"not-allowed":"pointer"}}>
        {current?<>{flag(current.flagUrl)}<span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{current.label}</span></>
          :<span style={{color:"var(--fx-muted2)",flex:1}}>{placeholder||"—"}</span>}
        <span style={{fontSize:"9px",color:"var(--fx-muted2)"}}>▾</span>
      </button>
      {open&&(<>
        <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:30}}/>
        <div style={{position:"absolute",top:"calc(100% + 2px)",left:0,right:0,minWidth:"200px",background:"var(--fx-card)",border:"1px solid #cbd5e1",borderRadius:"6px",zIndex:31,boxShadow:"0 6px 20px rgba(0,0,0,0.15)"}}>
          {options.length>=8&&(
            <input type="text" autoFocus value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Buscar…"
              style={{width:"100%",boxSizing:"border-box",padding:"6px 8px",fontSize:"12px",border:"none",borderBottom:"1px solid var(--fx-border)",outline:"none"}}/>
          )}
          <div style={{maxHeight:"240px",overflowY:"auto"}}>
            <div onClick={()=>{onChange("");setOpen(false);}}
              style={{padding:"6px 8px",fontSize:"11px",color:"var(--fx-muted2)",cursor:"pointer",borderBottom:"1px solid var(--fx-border2)"}}>— sin elegir —</div>
            {filtered.map(o=>(
              <div key={o.id} onClick={()=>{onChange(o.id);setOpen(false);}}
                style={{display:"flex",alignItems:"center",gap:"6px",padding:"6px 8px",fontSize:"12px",cursor:"pointer",borderBottom:"1px solid #f8fafc"}}
                onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                {flag(o.flagUrl)}
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.label}</span>
              </div>
            ))}
            {filtered.length===0&&<div style={{padding:"10px",fontSize:"11px",color:"var(--fx-muted2)",textAlign:"center"}}>Sin resultados</div>}
          </div>
        </div>
      </>)}
    </div>
  );
}

const BOLA_PREGUNTAS=[
  {id:"campeon",   label:"¿Quién será campeón?",         tipo:"equipo",   n:1, icon:"🏆", puntos:10},
  {id:"mvp",       label:"¿Quién será la MVP?",          tipo:"jugadora", n:1, icon:"⭐", puntos:10},
  {id:"top_scorer",label:"Máxima anotadora del torneo",  tipo:"jugadora", n:1, icon:"🎯", puntos:8},
  {id:"joven",     label:"Mejor jugadora joven",         tipo:"joven",    n:1, icon:"🌱", puntos:6},
  {id:"quinteto",  label:"Quinteto ideal",               tipo:"jugadora", n:5, icon:"🖐️", puntos:"3×"},
  {id:"t3pct",     label:"Mejor % T3",                   tipo:"jugadora", n:1, icon:"🏹", puntos:6},
  {id:"robos",     label:"Jugadora con más robos",       tipo:"jugadora", n:1, icon:"🥷", puntos:6},
];

const CORTE_JOVEN="2004-01-01";

function BolaCristalView({user,equipos,cierre}){
  const t = useT();
  const [equiposMundial,setEquiposMundial]=useState([]);
  const [jugadorasMundial,setJugadorasMundial]=useState([]);
  const [jovenesMundial,setJovenesMundial]=useState([]);
  const [drafts,setDrafts]=useState({});
  const [msg,setMsg]=useState("");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{(async()=>{
    const {data:ps}=await supabase.from("partidos")
      .select("id_equipo_local,id_equipo_visitante")
      .eq("id_liga","L055").eq("temporada","2026");
    const eqIds=new Set();
    (ps||[]).forEach(p=>{if(p.id_equipo_local)eqIds.add(p.id_equipo_local);if(p.id_equipo_visitante)eqIds.add(p.id_equipo_visitante);});
    const eqMap={},escMap={};(equipos||[]).forEach(e=>{eqMap[e.id_equipo]=e.nombre;escMap[e.id_equipo]=e.escudo;});
    setEquiposMundial([...eqIds].map(id=>({id,nombre:eqMap[id]||id,escudo:escMap[id]})).sort((a,b)=>a.nombre.localeCompare(b.nombre)));
    const {data:ts}=await supabase.from("temporadas")
      .select("id_jugadora,id_equipo,jugadoras(nombre,fecha_nac)")
      .eq("id_liga","L055").eq("temporada","2026");
    const js=(ts||[]).map(t=>({id:t.id_jugadora,nombre:t.jugadoras?.nombre||t.id_jugadora,fecha_nac:t.jugadoras?.fecha_nac,equipoNombre:eqMap[t.id_equipo]||t.id_equipo,equipoEscudo:escMap[t.id_equipo]}));
    js.sort((a,b)=>a.nombre.localeCompare(b.nombre));
    setJugadorasMundial(js);
    setJovenesMundial(js.filter(j=>j.fecha_nac&&j.fecha_nac>=CORTE_JOVEN));
    const {data:mios}=await supabase.from("bola_cristal_predicciones")
      .select("pregunta_id,respuesta_ids").eq("user_id",user.id).eq("id_liga","L055").eq("temporada","2026");
    const m={};(mios||[]).forEach(p=>{m[p.pregunta_id]=p.respuesta_ids;});
    setDrafts(m);
  })();},[user.id,equipos]);

  const cerrado=cierre&&new Date(cierre).getTime()<=Date.now();

  const guardarTodo=async()=>{
    setSaving(true);
    const filas=[];
    const borrar=[];
    for(const q of BOLA_PREGUNTAS){
      const clean=(drafts[q.id]||[]).filter(Boolean);
      if(clean.length>0) filas.push({user_id:user.id,id_liga:"L055",temporada:"2026",pregunta_id:q.id,respuesta_ids:clean});
      else borrar.push(q.id);
    }
    if(filas.length>0){
      await supabase.from("bola_cristal_predicciones").upsert(filas,{onConflict:"user_id,id_liga,temporada,pregunta_id"});
    }
    if(borrar.length>0){
      await supabase.from("bola_cristal_predicciones").delete()
        .eq("user_id",user.id).eq("id_liga","L055").eq("temporada","2026").in("pregunta_id",borrar);
    }
    setSaving(false);
    setMsg(t("quiniela.saved"));setTimeout(()=>setMsg(""),1800);
  };

  const opciones=q=>q.tipo==="equipo"?equiposMundial:q.tipo==="joven"?jovenesMundial:jugadorasMundial;
  const toOpt=(q,o)=>q.tipo==="equipo"
    ?{id:o.id,label:o.nombre,flagUrl:o.escudo}
    :{id:o.id,label:`${o.nombre} (${o.equipoNombre})`,flagUrl:o.equipoEscudo};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
      <div style={{background:cerrado?"#fef2f2":"#f0fdf4",border:`1px solid ${cerrado?"#fecaca":"#bbf7d0"}`,borderRadius:"12px",padding:"12px 14px",fontSize:"12px",color:cerrado?"#991b1b":"#166534"}}>
        {cerrado
          ?<><b>{t("bola.closed_status")}</b> {t("bola.closed_full",{fecha:cierre?new Date(cierre).toLocaleString(locale(),{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"—"})}</>
          :<><b>{t("bola.open_status")}</b> {t("bola.open_full",{fecha:cierre?": "+new Date(cierre).toLocaleString(locale(),{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):""})}</>}
      </div>
      {BOLA_PREGUNTAS.map(q=>{
        const ops=opciones(q);
        const val=drafts[q.id]||[];
        return(
          <div key={q.id} style={{background:"var(--fx-card)",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"}}>
              <div style={{fontSize:"14px",fontWeight:700,color:"var(--fx-text)"}}>{q.icon} {t("bola.q."+q.id)}</div>
              <span style={{fontSize:"10px",color:"var(--fx-muted2)",fontWeight:700}}>{q.puntos} pt{q.puntos==="3×"?"":"s"}</span>
            </div>
            {q.n===1?(
              <FlagSelect value={val[0]||""} disabled={cerrado||ops.length===0}
                placeholder={t("bola.choose")}
                options={ops.map(o=>toOpt(q,o))}
                onChange={v=>setDrafts(d=>({...d,[q.id]:v?[v]:[]}))}/>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                {Array.from({length:q.n}).map((_,i)=>(
                  <FlagSelect key={i} value={val[i]||""} disabled={cerrado||ops.length===0}
                    placeholder={t("bola.position",{n:i+1})}
                    options={ops.filter(o=>!val.includes(o.id)||o.id===val[i]).map(o=>toOpt(q,o))}
                    onChange={v=>{const nv=[...val];nv[i]=v;setDrafts(d=>({...d,[q.id]:nv}));}}/>
                ))}
              </div>
            )}
            {ops.length===0&&<div style={{fontSize:"11px",color:"var(--fx-muted2)",marginTop:"6px"}}>{t("bola.no_options")}</div>}
          </div>
        );
      })}
      {!cerrado&&(
        <div style={{position:"sticky",bottom:"8px",display:"flex",gap:"10px",alignItems:"center",background:"var(--fx-card)",borderRadius:"12px",padding:"12px 14px",boxShadow:"0 4px 14px rgba(0,0,0,0.08)"}}>
          <button onClick={guardarTodo} disabled={saving}
            style={{flex:1,background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"12px",fontWeight:800,fontSize:"14px",cursor:"pointer",opacity:saving?0.6:1}}>
            {saving?t("quiniela.saving"):t("bola.save")}
          </button>
          {msg&&<span style={{fontSize:"13px",color:"#16a34a",fontWeight:700}}>{msg}</span>}
        </div>
      )}
    </div>
  );
}

const BN_GRUPOS=["A","B","C","D"];
const BN_BRACKET=[
  {slot:"playin_25",label:"Play-in #25",puntos:2,ronda:"playin"},
  {slot:"playin_26",label:"Play-in #26",puntos:2,ronda:"playin"},
  {slot:"playin_27",label:"Play-in #27",puntos:2,ronda:"playin"},
  {slot:"playin_28",label:"Play-in #28",puntos:2,ronda:"playin"},
  {slot:"qf_29",    label:"Cuartos #29",puntos:3,ronda:"qf"},
  {slot:"qf_30",    label:"Cuartos #30",puntos:3,ronda:"qf"},
  {slot:"qf_31",    label:"Cuartos #31",puntos:3,ronda:"qf"},
  {slot:"qf_32",    label:"Cuartos #32",puntos:3,ronda:"qf"},
  {slot:"sf_33",    label:"Semifinal #33",puntos:5,ronda:"sf"},
  {slot:"sf_34",    label:"Semifinal #34",puntos:5,ronda:"sf"},
  {slot:"final_36", label:"Final",puntos:10,ronda:"final"},
  {slot:"br_35",    label:"3er puesto",puntos:4,ronda:"br"},
];

function bnParticipantes(slot, d){
  const g=(gr,pos)=>d[`grupo_${gr}_${pos}`];
  const w=(s)=>d[s];
  const part=(s)=>bnParticipantes(s,d);
  const loser=(s)=>{
    const p=part(s);const win=w(s);
    if(!p[0]||!p[1]||!win)return undefined;
    return p[0]===win?p[1]:p[0];
  };
  switch(slot){
    case "playin_25":return [g("A",2),g("B",3)];
    case "playin_26":return [g("B",2),g("A",3)];
    case "playin_27":return [g("C",2),g("D",3)];
    case "playin_28":return [g("D",2),g("C",3)];
    case "qf_29":return [g("A",1),w("playin_27")];
    case "qf_30":return [g("B",1),w("playin_28")];
    case "qf_31":return [g("C",1),w("playin_25")];
    case "qf_32":return [g("D",1),w("playin_26")];
    case "sf_33":return [w("qf_29"),w("qf_32")];
    case "sf_34":return [w("qf_30"),w("qf_31")];
    case "final_36":return [w("sf_33"),w("sf_34")];
    case "br_35":return [loser("sf_33"),loser("sf_34")];
    default:return [];
  }
}

function BasketnetaView({user,equipos,cierre}){
  const t = useT();
  const bnLabel = (slot) => {
    if (slot==="final_36") return t("bn.match.final");
    if (slot==="br_35") return t("bn.match.br");
    const [ronda,n] = slot.split("_");
    return t("bn.match."+ronda, {n});
  };
  const [equiposMundial,setEquiposMundial]=useState([]);
  const [gruposMap,setGruposMap]=useState({});
  const [drafts,setDrafts]=useState({});
  const [msg,setMsg]=useState("");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{(async()=>{
    const {data:ps}=await supabase.from("partidos")
      .select("notas,id_equipo_local,id_equipo_visitante")
      .eq("id_liga","L055").eq("temporada","2026");
    const eqMap={},escMap={};(equipos||[]).forEach(e=>{eqMap[e.id_equipo]=e.nombre;escMap[e.id_equipo]=e.escudo;});
    const gr={A:new Set(),B:new Set(),C:new Set(),D:new Set()};
    (ps||[]).forEach(p=>{
      const m=(p.notas||"").match(/Grupo ([ABCD])/);
      if(!m)return;
      if(p.id_equipo_local)gr[m[1]].add(p.id_equipo_local);
      if(p.id_equipo_visitante)gr[m[1]].add(p.id_equipo_visitante);
    });
    const g={};BN_GRUPOS.forEach(k=>{
      g[k]=[...gr[k]].map(id=>({id,nombre:eqMap[id]||id,escudo:escMap[id]})).sort((a,b)=>a.nombre.localeCompare(b.nombre));
    });
    setGruposMap(g);
    const todos=new Set();(ps||[]).forEach(p=>{if(p.id_equipo_local)todos.add(p.id_equipo_local);if(p.id_equipo_visitante)todos.add(p.id_equipo_visitante);});
    setEquiposMundial([...todos].map(id=>({id,nombre:eqMap[id]||id,escudo:escMap[id]})).sort((a,b)=>a.nombre.localeCompare(b.nombre)));
    const {data:mios}=await supabase.from("basketneta_predicciones")
      .select("slot,id_equipo").eq("user_id",user.id).eq("id_liga","L055").eq("temporada","2026");
    const d={};(mios||[]).forEach(r=>{d[r.slot]=r.id_equipo;});
    setDrafts(d);
  })();},[user.id,equipos]);

  const cerrado=cierre&&new Date(cierre).getTime()<=Date.now();

  const guardarTodo=async()=>{
    setSaving(true);
    const filas=[],borrar=[];
    BN_GRUPOS.forEach(g=>{
      for(let pos=1;pos<=4;pos++){
        const slot=`grupo_${g}_${pos}`;
        const v=drafts[slot];
        if(v) filas.push({user_id:user.id,id_liga:"L055",temporada:"2026",slot,id_equipo:v});
        else borrar.push(slot);
      }
    });
    BN_BRACKET.forEach(b=>{
      const v=drafts[b.slot];
      const [a,c]=bnParticipantes(b.slot,drafts);
      const valido=v&&(v===a||v===c);
      if(valido) filas.push({user_id:user.id,id_liga:"L055",temporada:"2026",slot:b.slot,id_equipo:v});
      else borrar.push(b.slot);
    });
    if(filas.length>0){
      await supabase.from("basketneta_predicciones").upsert(filas,{onConflict:"user_id,id_liga,temporada,slot"});
    }
    if(borrar.length>0){
      await supabase.from("basketneta_predicciones").delete()
        .eq("user_id",user.id).eq("id_liga","L055").eq("temporada","2026").in("slot",borrar);
    }
    setSaving(false);
    setMsg(t("quiniela.saved"));setTimeout(()=>setMsg(""),1800);
  };

  const opsGrupo=(g,pos)=>{
    const total=gruposMap[g]||[];
    const usados=[1,2,3,4].filter(p=>p!==pos).map(p=>drafts[`grupo_${g}_${p}`]).filter(Boolean);
    return total.filter(e=>!usados.includes(e.id));
  };

  const eqIdx={},eqEsc={};
  (equipos||[]).forEach(e=>{eqIdx[e.id_equipo]=e.nombre;eqEsc[e.id_equipo]=e.escudo;});
  const nomDe=id=>eqIdx[id]||"—";
  const escDe=id=>eqEsc[id];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
      <div style={{background:cerrado?"#fef2f2":"#f0fdf4",border:`1px solid ${cerrado?"#fecaca":"#bbf7d0"}`,borderRadius:"12px",padding:"12px 14px",fontSize:"12px",color:cerrado?"#991b1b":"#166534"}}>
        {cerrado
          ?<><b>{t("bn.closed_status")}</b> {t("bn.closed_full",{fecha:cierre?new Date(cierre).toLocaleString(locale(),{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"—"})}</>
          :<><b>{t("bn.open_status")}</b> {t("bn.open_full")}</>}
      </div>

      <div style={{background:"var(--fx-card)",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        <div style={{fontSize:"15px",fontWeight:800,color:"var(--fx-text)",marginBottom:"4px"}}>{t("bn.order_groups")}</div>
        <div style={{fontSize:"11px",color:"var(--fx-muted)",marginBottom:"10px"}}>
          <span style={{color:"#166534",fontWeight:700}}>{t("bn.pos1_note")}</span>{t("bn.pos1_desc")}
          <span style={{color:"#a16207",fontWeight:700}}>{t("bn.pos23_note")}</span>{t("bn.pos23_desc")}
          <span style={{color:"#b91c1c",fontWeight:700}}>{t("bn.pos4_note")}</span>{t("bn.pos4_desc")}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"10px"}}>
          {BN_GRUPOS.map(g=>{
            const total=gruposMap[g]||[];
            const bgPos={1:"#dcfce7",2:"#fef3c7",3:"#fef3c7",4:"#fee2e2"};
            const numPos={1:"#166534",2:"#a16207",3:"#a16207",4:"#b91c1c"};
            return(
              <div key={g} style={{border:"1px solid var(--fx-border)",borderRadius:"10px",padding:"8px"}}>
                <div style={{fontSize:"11px",fontWeight:800,color:"var(--fx-muted)",marginBottom:"6px",textAlign:"center"}}>{t("bn.group",{letra:g})}</div>
                {[1,2,3,4].map(pos=>{
                  const slot=`grupo_${g}_${pos}`;
                  return(
                    <div key={pos} style={{display:"flex",alignItems:"center",gap:"5px",marginBottom:"4px",background:bgPos[pos],borderRadius:"6px",padding:"3px"}}>
                      <span style={{fontSize:"11px",fontWeight:800,color:numPos[pos],minWidth:"16px",textAlign:"center"}}>{pos}º</span>
                      <FlagSelect size="sm" disabled={cerrado||total.length===0}
                        value={drafts[slot]||""}
                        placeholder="—"
                        options={opsGrupo(g,pos).map(o=>({id:o.id,label:o.nombre,flagUrl:o.escudo}))}
                        onChange={v=>setDrafts(d=>({...d,[slot]:v}))}/>
                    </div>
                  );
                })}
                {total.length===0&&<div style={{fontSize:"11px",color:"var(--fx-muted2)"}}>{t("bn.no_teams_yet")}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{background:"var(--fx-card)",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        <div style={{fontSize:"15px",fontWeight:800,color:"var(--fx-text)",marginBottom:"12px"}}>{t("bn.bracket_title")}</div>
        {(()=>{
          const teamBtn=(id,activo)=>({
            display:"flex",alignItems:"center",gap:"5px",width:"100%",textAlign:"left",padding:"5px 7px",
            background:activo?"#9333ea":id?"#f8fafc":"#f1f5f9",
            color:activo?"#fff":id?"#1e293b":"#94a3b8",
            border:`1px solid ${activo?"#9333ea":"#e2e8f0"}`,
            borderRadius:"5px",fontSize:"11px",fontWeight:activo?800:600,
            cursor:id&&!cerrado?"pointer":"not-allowed",
            marginBottom:"3px"
          });
          const flagImg=id=>{
            const url=escDe(id);
            if(!url) return <span style={{width:16,height:12,background:"#e2e8f0",borderRadius:2,flexShrink:0}}/>;
            return <img loading="lazy" decoding="async" src={url} alt="" style={{width:16,height:12,objectFit:"contain",flexShrink:0}}/>;
          };
          const teamLabel=id=>(
            <>
              {id?flagImg(id):<span style={{width:16,height:12,flexShrink:0}}/>}
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{id?nomDe(id):"—"}</span>
            </>
          );
          const MatchCard=({slot,label,puntos})=>{
            const [idA,idB]=bnParticipantes(slot,drafts);
            const pick=drafts[slot];
            const ok=pick&&(pick===idA||pick===idB);
            return(
              <div style={{border:"1px solid var(--fx-border)",borderRadius:"7px",padding:"5px 6px",background:"var(--fx-card)",width:"150px"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"9px",color:"var(--fx-muted2)",fontWeight:700,marginBottom:"3px"}}>
                  <span>{label}</span><span>{puntos}pt</span>
                </div>
                <button style={teamBtn(idA,ok&&pick===idA)} disabled={!idA||cerrado}
                  onClick={()=>setDrafts(d=>({...d,[slot]:idA}))}>{teamLabel(idA)}</button>
                <button style={teamBtn(idB,ok&&pick===idB)} disabled={!idB||cerrado}
                  onClick={()=>setDrafts(d=>({...d,[slot]:idB}))}>{teamLabel(idB)}</button>
              </div>
            );
          };
          const line="#cbd5e1";
          const playins=[
            {slot:"playin_27",label:bnLabel("playin_27"),puntos:2},
            {slot:"playin_26",label:bnLabel("playin_26"),puntos:2},
            {slot:"playin_28",label:bnLabel("playin_28"),puntos:2},
            {slot:"playin_25",label:bnLabel("playin_25"),puntos:2},
          ];
          const qfs=[
            {slot:"qf_29",label:bnLabel("qf_29"),puntos:3},
            {slot:"qf_32",label:bnLabel("qf_32"),puntos:3},
            {slot:"qf_30",label:bnLabel("qf_30"),puntos:3},
            {slot:"qf_31",label:bnLabel("qf_31"),puntos:3},
          ];
          const sfs=[
            {slot:"sf_33",label:bnLabel("sf_33"),puntos:5},
            {slot:"sf_34",label:bnLabel("sf_34"),puntos:5},
          ];
          const finalM={slot:"final_36",label:bnLabel("final_36"),puntos:10};
          const MATCH_H=64;
          const GAP_UNIT=20;
          const bracketH=4*MATCH_H+3*GAP_UNIT;
          const colCommon={display:"flex",flexDirection:"column",justifyContent:"space-around",alignItems:"center",height:bracketH+"px"};
          return(
            <div style={{overflowX:"auto",paddingBottom:"6px"}}>
              <div style={{display:"flex",alignItems:"stretch",minWidth:"780px"}}>
                <div style={colCommon}>
                  <div style={{fontSize:"10px",fontWeight:800,color:"var(--fx-muted2)",letterSpacing:"1px",position:"absolute",transform:"translateY(-140%)"}}>{t("bn.round.playin")}</div>
                  {playins.map(p=>(
                    <div key={p.slot} style={{position:"relative"}}>
                      <MatchCard {...p}/>
                      <div style={{position:"absolute",right:"-20px",top:"50%",width:"20px",height:"2px",background:line}}/>
                    </div>
                  ))}
                </div>
                <div style={{...colCommon,marginLeft:"20px"}}>
                  <div style={{fontSize:"10px",fontWeight:800,color:"var(--fx-muted2)",letterSpacing:"1px",position:"absolute",transform:"translateY(-140%)"}}>{t("bn.round.qf")}</div>
                  {[0,1].map(pairIdx=>(
                    <div key={pairIdx} style={{display:"flex",flexDirection:"column",justifyContent:"space-around",alignItems:"center",height:(bracketH/2-GAP_UNIT/2)+"px",position:"relative"}}>
                      <div style={{position:"relative"}}>
                        <MatchCard {...qfs[pairIdx*2]}/>
                      </div>
                      <div style={{position:"relative"}}>
                        <MatchCard {...qfs[pairIdx*2+1]}/>
                      </div>
                      <div style={{position:"absolute",right:"-12px",top:"calc(50% - "+(MATCH_H/2)+"px)",bottom:"calc(50% - "+(MATCH_H/2)+"px)",width:"2px",background:line}}/>
                      <div style={{position:"absolute",right:"-12px",top:"calc("+(MATCH_H/2)+"px + "+(pairIdx===999?0:0)+"px)",width:"12px",height:"2px",background:line}}/>
                      <div style={{position:"absolute",right:"-12px",bottom:"calc("+(MATCH_H/2)+"px)",width:"12px",height:"2px",background:line}}/>
                      <div style={{position:"absolute",right:"-24px",top:"50%",width:"12px",height:"2px",background:line}}/>
                    </div>
                  ))}
                </div>
                <div style={{...colCommon,marginLeft:"24px"}}>
                  <div style={{fontSize:"10px",fontWeight:800,color:"var(--fx-muted2)",letterSpacing:"1px",position:"absolute",transform:"translateY(-140%)"}}>{t("bn.round.sf")}</div>
                  <div style={{display:"flex",flexDirection:"column",justifyContent:"space-around",alignItems:"center",height:bracketH+"px",position:"relative"}}>
                    {sfs.map((s,i)=>(
                      <div key={s.slot} style={{position:"relative"}}>
                        <MatchCard {...s}/>
                        <div style={{position:"absolute",right:"-12px",top:"50%",width:"12px",height:"2px",background:line}}/>
                      </div>
                    ))}
                    <div style={{position:"absolute",right:"-12px",top:"25%",bottom:"25%",width:"2px",background:line}}/>
                    <div style={{position:"absolute",right:"-24px",top:"50%",width:"12px",height:"2px",background:line}}/>
                  </div>
                </div>
                <div style={{...colCommon,marginLeft:"24px",justifyContent:"center",gap:"18px"}}>
                  <div style={{fontSize:"10px",fontWeight:800,color:"var(--fx-muted2)",letterSpacing:"1px",position:"absolute",transform:"translateY(-140%)"}}>{t("bn.round.final")}</div>
                  <MatchCard {...finalM}/>
                  <div style={{fontSize:"9px",fontWeight:800,color:"#f59e0b",letterSpacing:"1px"}}>{t("bn.round.br")}</div>
                  <MatchCard slot="br_35" label={bnLabel("br_35")} puntos={4}/>
                </div>
              </div>
            </div>
          );
        })()}

        {drafts.final_36&&(
          <div style={{marginTop:"12px",padding:"12px",background:"linear-gradient(90deg,#fef3c7,#fde68a)",borderRadius:"10px",fontSize:"14px",color:"#78350f",fontWeight:800,textAlign:"center"}}>
            {t("bn.your_champion",{nombre:nomDe(drafts.final_36)})}
          </div>
        )}
      </div>

      {!cerrado&&(
        <div style={{position:"sticky",bottom:"8px",display:"flex",gap:"10px",alignItems:"center",background:"var(--fx-card)",borderRadius:"12px",padding:"12px 14px",boxShadow:"0 4px 14px rgba(0,0,0,0.08)"}}>
          <button onClick={guardarTodo} disabled={saving}
            style={{flex:1,background:"#9333ea",color:"#fff",border:"none",borderRadius:"10px",padding:"12px",fontWeight:800,fontSize:"14px",cursor:"pointer",opacity:saving?0.6:1}}>
            {saving?t("quiniela.saving"):t("bn.save")}
          </button>
          {msg&&<span style={{fontSize:"13px",color:"#16a34a",fontWeight:700}}>{msg}</span>}
        </div>
      )}
    </div>
  );
}

function VerPrediccionesModal({target,equipos,onClose}){
  const t = useT();
  const bnLabel = (slot) => {
    if (slot==="final_36") return t("bn.match.final");
    if (slot==="br_35") return t("bn.match.br");
    const [ronda,n] = slot.split("_");
    return t("bn.match."+ronda, {n});
  };
  const [data,setData]=useState(null);
  const [err,setErr]=useState("");
  const [jugMap,setJugMap]=useState({});
  const [res,setRes]=useState({grupos:{},bracket:{},bola:{}});

  useEffect(()=>{(async()=>{
    const {data:d,error}=await supabase.rpc("ver_predicciones_mundial",{target_user:target.user_id});
    if(error){setErr(error.message);return;}
    setData(d);
    const {data:r}=await supabase.rpc("quiniela_resultados_actuales");
    if(r)setRes(r);
    if(d?.cerrado&&Array.isArray(d.bola)){
      const ids=Array.from(new Set(d.bola.flatMap(b=>b.respuesta_ids||[])));
      if(ids.length){
        const {data:js}=await supabase.from("jugadoras").select("id_jugadora,nombre").in("id_jugadora",ids);
        const {data:ts}=await supabase.from("temporadas").select("id_jugadora,id_equipo").eq("id_liga","L055").eq("temporada","2026").in("id_jugadora",ids);
        const eqOf={};(ts||[]).forEach(t=>{eqOf[t.id_jugadora]=t.id_equipo;});
        const m={};(js||[]).forEach(j=>{m[j.id_jugadora]={nombre:j.nombre,id_equipo:eqOf[j.id_jugadora]};});
        setJugMap(m);
      }
    }
  })();},[target.user_id]);

  const eqIdx={},eqEsc={};
  (equipos||[]).forEach(e=>{eqIdx[e.id_equipo]=e.nombre;eqEsc[e.id_equipo]=e.escudo;});
  const escDe=id=>eqEsc[id];

  const flag=url=>url
    ?<img loading="lazy" decoding="async" src={url} alt="" style={{width:16,height:12,objectFit:"contain",flexShrink:0}}/>
    :<span style={{width:16,height:12,background:"#e2e8f0",borderRadius:2,flexShrink:0,display:"inline-block"}}/>;

  const teamPill=id=>id?(
    <span style={{display:"inline-flex",alignItems:"center",gap:"5px",background:"var(--fx-hover)",color:"var(--fx-text)",border:"1px solid var(--fx-border)",borderRadius:"6px",padding:"3px 7px",fontSize:"12px",fontWeight:600}}>
      {flag(escDe(id))}<span>{eqIdx[id]||id}</span>
    </span>
  ):<span style={{fontSize:"12px",color:"var(--fx-muted2)"}}>—</span>;

  const jugPill=id=>{
    const j=jugMap[id];
    if(!j) return <span style={{fontSize:"12px",color:"var(--fx-muted2)"}}>{id}</span>;
    return(
      <span style={{display:"inline-flex",alignItems:"center",gap:"5px",background:"var(--fx-hover)",color:"var(--fx-text)",border:"1px solid var(--fx-border)",borderRadius:"6px",padding:"3px 7px",fontSize:"12px",fontWeight:600}}>
        {flag(escDe(j.id_equipo))}<span>{j.nombre}</span>
      </span>
    );
  };

  const bnBySlot={};(data?.basketneta||[]).forEach(b=>{bnBySlot[b.slot]=b;});
  const boByPreg={};(data?.bola||[]).forEach(b=>{boByPreg[b.pregunta_id]=b.respuesta_ids||[];});

  const preguntaLabel={campeon:t("verpred.q.campeon"),mvp:t("verpred.q.mvp"),top_scorer:t("verpred.q.top_scorer"),joven:t("verpred.q.joven"),quinteto:t("verpred.q.quinteto"),t3pct:t("verpred.q.t3pct"),robos:t("verpred.q.robos")};

  const marcar=(pick,correctList)=>{
    if(!correctList||correctList.length===0)return {};
    const arr=Array.isArray(correctList)?correctList:[correctList];
    const ok=pick!=null&&arr.includes(pick);
    return {border:`2px solid ${ok?"#22c55e":"#ef4444"}`,background:ok?"rgba(34,197,94,0.12)":"rgba(239,68,68,0.12)"};
  };

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.7)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px",overflowY:"auto"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--fx-card)",borderRadius:"14px",maxWidth:"760px",width:"100%",padding:"18px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <UserAvatar avatar={target.avatar} googleUrl={target.google} nombre={target.nombre} size={40}/>
            <div>
              <div style={{fontSize:"16px",fontWeight:800,color:"var(--fx-text)"}}>{target.nombre}</div>
              <div style={{fontSize:"11px",color:"var(--fx-muted2)"}}>{t("verpred.subtitle")}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label={t("common.close")} title={t("common.close")} style={{background:"transparent",border:"none",fontSize:"22px",cursor:"pointer",color:"var(--fx-muted)"}}>✕</button>
        </div>

        {err&&<div style={{background:"#fef2f2",color:"#991b1b",padding:"10px",borderRadius:"8px",fontSize:"12px"}}>{err}</div>}
        {!data&&!err&&<div style={{padding:"12px",display:"flex",flexDirection:"column",gap:"8px"}}>{Array.from({length:6}).map((_,i)=><div key={i} className="bfdb-skel" style={{width:"100%",height:"36px",borderRadius:"6px"}}/>)}</div>}
        {data&&!data.cerrado&&<div style={{background:"#fef3c7",color:"#92400e",padding:"12px",borderRadius:"8px",fontSize:"12px"}}>{t("verpred.not_closed")}</div>}

        {data?.cerrado&&(<>
          <div style={{marginTop:"6px"}}>
            <div style={{fontSize:"13px",fontWeight:800,color:"var(--fx-text)",marginBottom:"8px"}}>{t("verpred.section.bn")}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"8px",marginBottom:"12px"}}>
              {["A","B","C","D"].map(g=>(
                <div key={g} style={{border:"1px solid var(--fx-border)",borderRadius:"8px",padding:"8px"}}>
                  <div style={{fontSize:"11px",fontWeight:800,color:"var(--fx-muted)",marginBottom:"6px",textAlign:"center"}}>{t("bn.group",{letra:g})}</div>
                  {[1,2,3,4].map(pos=>{
                    const s=bnBySlot[`grupo_${g}_${pos}`];
                    const bgPos={1:"#dcfce7",2:"#fef3c7",3:"#fef3c7",4:"#fee2e2"}[pos];
                    const correcto=res.grupos&&res.grupos[`grupo_${g}_${pos}`];
                    const mk=correcto?marcar(s?.id_equipo,[correcto]):null;
                    return(
                      <div key={pos} style={{display:"flex",alignItems:"center",gap:"6px",padding:"3px 6px",background:mk?mk.background:bgPos,border:mk?mk.border:"2px solid transparent",borderRadius:"6px",marginBottom:"3px",fontSize:"12px"}}>
                        <b style={{width:"16px",color:"#334155"}}>{pos}º</b>
                        {s?<div style={{display:"flex",alignItems:"center",gap:"5px",overflow:"hidden"}}>{flag(escDe(s.id_equipo))}<span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.nombre||s.id_equipo}</span></div>:<span style={{color:"var(--fx-muted2)"}}>—</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{border:"1px solid var(--fx-border)",borderRadius:"8px",padding:"10px"}}>
              <div style={{fontSize:"11px",fontWeight:800,color:"var(--fx-muted)",marginBottom:"8px"}}>{t("verpred.bracket")}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",fontSize:"12px"}}>
                {["playin_25","playin_26","playin_27","playin_28","qf_29","qf_30","qf_31","qf_32","sf_33","sf_34","br_35","final_36"].map(slot=>{
                  const lab=slot==="final_36"?"🏆 "+t("bn.match.final"):bnLabel(slot);
                    const s=bnBySlot[slot];
                    const correcto=res.bracket&&res.bracket[slot];
                    const mk=correcto?marcar(s?.id_equipo,[correcto]):null;
                    return(
                      <div key={slot} style={{display:"flex",alignItems:"center",gap:"6px",padding:"4px 6px",background:mk?mk.background:(slot==="final_36"?"#fef3c7":"#f8fafc"),border:mk?mk.border:"2px solid transparent",borderRadius:"6px"}}>
                        <span style={{fontSize:"10px",color:"var(--fx-muted)",fontWeight:700,minWidth:"78px"}}>{lab}</span>
                        {s?teamPill(s.id_equipo):<span style={{color:"var(--fx-muted2)",fontSize:"11px"}}>—</span>}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div style={{marginTop:"14px"}}>
            <div style={{fontSize:"13px",fontWeight:800,color:"var(--fx-text)",marginBottom:"8px"}}>{t("verpred.section.bola")}</div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {["campeon","mvp","top_scorer","joven","quinteto","t3pct","robos"].map(pid=>{
                const ids=boByPreg[pid]||[];
                const correctList=res.bola&&res.bola[pid];
                return(
                  <div key={pid} style={{border:"1px solid var(--fx-border)",borderRadius:"8px",padding:"8px 10px"}}>
                    <div style={{fontSize:"11px",fontWeight:700,color:"var(--fx-muted)",marginBottom:"5px"}}>{preguntaLabel[pid]}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                      {ids.length===0&&<span style={{fontSize:"12px",color:"var(--fx-muted2)"}}>—</span>}
                      {ids.map(id=>{
                        const mk=correctList?marcar(id,correctList):null;
                        const inner=pid==="campeon"?teamPill(id):jugPill(id);
                        return <span key={id} style={mk?{...mk,borderRadius:"8px",padding:"2px",display:"inline-block"}:undefined}>{inner}</span>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>)}
      </div>
    </div>
  );
}

function ResultadosOficialesAdmin(){
  const [jugadoras,setJugadoras]=useState([]);
  const [jovenes,setJovenes]=useState([]);
  const [oficiales,setOficiales]=useState({});
  const [terminado,setTerminado]=useState(false);
  const [saving,setSaving]=useState({});
  const [msg,setMsg]=useState("");
  useEffect(()=>{(async()=>{
    const {data:ts}=await supabase.from("temporadas")
      .select("id_jugadora,jugadoras(nombre,fecha_nac)")
      .eq("id_liga","L055").eq("temporada","2026");
    const seen=new Set();
    const js=(ts||[]).filter(t=>{if(seen.has(t.id_jugadora))return false;seen.add(t.id_jugadora);return true;})
      .map(t=>({id:t.id_jugadora,nombre:t.jugadoras?.nombre||t.id_jugadora,fecha_nac:t.jugadoras?.fecha_nac}))
      .sort((a,b)=>a.nombre.localeCompare(b.nombre));
    setJugadoras(js);
    setJovenes(js.filter(j=>j.fecha_nac&&j.fecha_nac>="2004-01-01"));
    const {data:r}=await supabase.from("bola_resultados_oficiales").select("pregunta_id,ids");
    const map={};(r||[]).forEach(x=>{map[x.pregunta_id]=x.ids;});
    setOficiales(map);
    const {data:t}=await supabase.rpc("mundial_terminado");
    setTerminado(!!t);
  })();},[]);
  const guardar=async(pregunta_id,ids)=>{
    setSaving(s=>({...s,[pregunta_id]:true}));
    const clean=(ids||[]).filter(Boolean);
    if(clean.length===0){
      await supabase.from("bola_resultados_oficiales").delete().eq("pregunta_id",pregunta_id);
      setOficiales(o=>{const n={...o};delete n[pregunta_id];return n;});
    }else{
      await supabase.from("bola_resultados_oficiales").upsert({pregunta_id,ids:clean,updated_at:new Date().toISOString()},{onConflict:"pregunta_id"});
      setOficiales(o=>({...o,[pregunta_id]:clean}));
    }
    setSaving(s=>({...s,[pregunta_id]:false}));
    setMsg("✓ Guardado "+pregunta_id);setTimeout(()=>setMsg(""),1800);
  };
  const sel={width:"100%",padding:"8px 10px",borderRadius:"8px",border:"1px solid #cbd5e1",fontSize:"13px",background:"var(--fx-card)"};
  const single=(pid,titulo,opciones,puntos)=>{
    const v=oficiales[pid]?.[0]||"";
    return(
      <div style={{background:"var(--fx-card)",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        <div style={{fontSize:"14px",fontWeight:800,color:"var(--fx-text)",marginBottom:"8px"}}>{titulo} <span style={{fontSize:"11px",color:"var(--fx-muted2)",fontWeight:600}}>· {puntos} pts</span></div>
        <select value={v} onChange={e=>guardar(pid,[e.target.value])} disabled={saving[pid]} style={sel}>
          <option value="">— Sin resolver —</option>
          {opciones.map(j=><option key={j.id} value={j.id}>{j.nombre}</option>)}
        </select>
        {v&&<div style={{fontSize:"11px",color:"#16a34a",marginTop:"6px",fontWeight:700}}>✓ Guardado: {opciones.find(j=>j.id===v)?.nombre||v}</div>}
      </div>
    );
  };
  const quinteto=()=>{
    const ids=oficiales.quinteto||[];
    const set=new Set(ids);
    return(
      <div style={{background:"var(--fx-card)",borderRadius:"12px",padding:"14px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        <div style={{fontSize:"14px",fontWeight:800,color:"var(--fx-text)",marginBottom:"4px"}}>🖐️ Quinteto ideal <span style={{fontSize:"11px",color:"var(--fx-muted2)",fontWeight:600}}>· 3 pts × jugadora acertada (máx 15)</span></div>
        <div style={{fontSize:"11px",color:"var(--fx-muted)",marginBottom:"8px"}}>Selecciona 5. Guarda automáticamente cuando marques la 5ª.</div>
        <select value="" onChange={e=>{
          const v=e.target.value;if(!v||set.has(v)||ids.length>=5)return;
          const next=[...ids,v];guardar("quinteto",next);
        }} disabled={saving.quinteto||ids.length>=5} style={sel}>
          <option value="">— Añadir jugadora ({ids.length}/5) —</option>
          {jugadoras.filter(j=>!set.has(j.id)).map(j=><option key={j.id} value={j.id}>{j.nombre}</option>)}
        </select>
        <div style={{marginTop:"8px",display:"flex",flexWrap:"wrap",gap:"6px"}}>
          {ids.map(id=>{const j=jugadoras.find(x=>x.id===id);return(
            <span key={id} style={{display:"inline-flex",alignItems:"center",gap:"6px",background:"#f5f3ff",color:"#7c3aed",padding:"4px 8px",borderRadius:"14px",fontSize:"12px",fontWeight:700}}>
              {j?.nombre||id}
              <button onClick={()=>guardar("quinteto",ids.filter(x=>x!==id))} style={{background:"none",border:"none",color:"#7c3aed",cursor:"pointer",fontWeight:800}}>×</button>
            </span>
          );})}
        </div>
      </div>
    );
  };
  return(
    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
      <div style={{background:terminado?"#f0fdf4":"#fef3c7",border:`1px solid ${terminado?"#bbf7d0":"#fde68a"}`,borderRadius:"12px",padding:"12px 14px",fontSize:"13px",color:terminado?"#166534":"#92400e"}}>
        {terminado
          ?<>✅ <b>El Mundial ha terminado.</b> Los picks automáticos ya se están evaluando. Rellena aquí los premios oficiales (MVP, Mejor Joven y Quinteto Ideal) que anuncie FIBA para completar la puntuación de bola de cristal.</>
          :<>⏳ <b>El Mundial aún no ha terminado.</b> Los premios oficiales (MVP, Mejor Joven, Quinteto) se rellenan aquí cuando FIBA los anuncie tras la final. Los puntos de bola de cristal solo se dan cuando finalice el torneo.</>}
      </div>
      {msg&&<div style={{fontSize:"12px",color:"#16a34a",fontWeight:700}}>{msg}</div>}
      {single("mvp","⭐ MVP del torneo",jugadoras,10)}
      {single("joven","🌱 Mejor jugadora joven (U22)",jovenes,6)}
      {quinteto()}
    </div>
  );
}

export default function QuinielaView({user,equipos,onAbrirPerfil,isAdmin}){
  const t = useT();
  const [cierre,setCierre]=useState(null);
  const [rank,setRank]=useState([]);
  const [tab,setTab]=useState("basketneta");
  const [verUser,setVerUser]=useState(null);

  useEffect(()=>{(async()=>{
    const {data:ps}=await supabase.from("partidos")
      .select("fecha_hora").eq("id_liga","L055").eq("temporada","2026");
    const fechas=(ps||[]).map(p=>p.fecha_hora).filter(Boolean).sort();
    setCierre(fechas[0]||null);
    const {data:r}=await supabase.rpc("quiniela_ranking_mundial");
    setRank(r||[]);
  })();},[user.id,tab]);

  const btnStyle=a=>({background:a?"#9333ea":"#f8fafc",color:a?"#fff":"#64748b",border:a?"none":"1.5px solid var(--fx-border)",borderRadius:"10px",padding:"9px 14px",fontWeight:700,fontSize:"13px",cursor:"pointer"});

  return(
    <div style={{maxWidth:"820px",margin:"0 auto",padding:"12px"}}>
      <div style={{background:"var(--fx-card)",borderRadius:"16px",padding:"16px 18px",marginBottom:"14px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        <h2 style={{margin:0,fontSize:"18px",fontWeight:800,color:"var(--fx-text)"}}>{t("quiniela.title")}</h2>
        <div style={{fontSize:"12px",color:"var(--fx-muted)",marginTop:"3px"}}>
          {t("quiniela.sub")}
        </div>
      </div>
      <div style={{display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap"}}>
        <button onClick={()=>setTab("basketneta")} style={btnStyle(tab==="basketneta")}>{t("quiniela.tab.basketneta")}</button>
        <button onClick={()=>setTab("bola")}       style={btnStyle(tab==="bola")}>{t("quiniela.tab.bola")}</button>
        <button onClick={()=>setTab("ranking")}    style={btnStyle(tab==="ranking")}>{t("quiniela.tab.ranking")}</button>
        {isAdmin&&<button onClick={()=>setTab("admin")} style={btnStyle(tab==="admin")}>{t("quiniela.tab.admin")}</button>}
      </div>

      {tab==="basketneta"&&<BasketnetaView user={user} equipos={equipos} cierre={cierre}/>}
      {tab==="bola"&&<BolaCristalView user={user} equipos={equipos} cierre={cierre}/>}
      {tab==="admin"&&isAdmin&&<ResultadosOficialesAdmin/>}

      {verUser&&<VerPrediccionesModal target={verUser} equipos={equipos} onClose={()=>setVerUser(null)}/>}

      {tab==="ranking"&&(
        <div style={{background:"var(--fx-card)",borderRadius:"12px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
          <div style={{padding:"12px 14px",background:"#faf5ff",fontSize:"12px",color:"#6b21a8",borderBottom:"1px solid #e9d5ff",borderRadius:"12px 12px 0 0"}}>
            {t("quiniela.rank.note")}
          </div>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{width:"100%",minWidth:"520px",borderCollapse:"collapse",fontSize:"14px"}}>
            <thead style={{background:"var(--fx-hover)"}}>
              <tr>
                <th style={{padding:"10px 14px",textAlign:"left",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700}}>#</th>
                <th style={{padding:"10px 14px",textAlign:"left",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700}}>{t("quiniela.rank.user")}</th>
                <th style={{padding:"10px 14px",textAlign:"center",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700}}>{t("quiniela.rank.bn")}</th>
                <th style={{padding:"10px 14px",textAlign:"center",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700}}>{t("quiniela.rank.bola")}</th>
                <th style={{padding:"10px 14px",textAlign:"right",fontSize:"11px",color:"var(--fx-muted)",fontWeight:700}}>{t("quiniela.rank.pts")}</th>
              </tr>
            </thead>
            <tbody>
              {rank.length===0&&<tr><td colSpan={5} style={{padding:"24px",textAlign:"center",color:"var(--fx-muted2)"}}>{t("quiniela.rank.empty")}</td></tr>}
              {rank.map((r,i)=>{
                const google=r.user_id===user.id?user.user_metadata?.avatar_url:null;
                const cerrado=cierre&&new Date(cierre).getTime()<=Date.now();
                const onClick=cerrado?(()=>setVerUser({user_id:r.user_id,nombre:r.nombre,avatar:r.avatar,google})):undefined;
                return(
                <tr key={r.user_id}
                  onClick={onClick}
                  style={{borderTop:"1px solid var(--fx-border2)",background:r.user_id===user.id?"#faf5ff":undefined,cursor:cerrado?"pointer":"default"}}
                  onMouseEnter={e=>{if(cerrado)e.currentTarget.style.background="#f5f3ff";}}
                  onMouseLeave={e=>{e.currentTarget.style.background=r.user_id===user.id?"#faf5ff":"";}}
                  title={cerrado?t("quiniela.rank.view_pred"):undefined}>
                  <td style={{padding:"10px 14px",fontWeight:700,color:i===0?"#eab308":i===1?"#94a3b8":i===2?"#c2410c":"#64748b"}}>{i+1}</td>
                  <td style={{padding:"8px 14px",fontWeight:600,color:"var(--fx-text)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <UserAvatar avatar={r.avatar} googleUrl={google} nombre={r.nombre} size={28}/>
                      <span
                        onClick={e=>{e.stopPropagation();if(onAbrirPerfil&&r.alias)onAbrirPerfil(r.alias);}}
                        style={{cursor:(onAbrirPerfil&&r.alias)?"pointer":"default",textDecoration:(onAbrirPerfil&&r.alias)?"underline":"none",textDecorationColor:"#c084fc",textUnderlineOffset:"3px"}}
                        title={r.alias?t("quiniela.rank.view_profile"):undefined}>
                        {r.nombre}{r.user_id===user.id?t("quiniela.rank.you"):""}
                      </span>
                      {cerrado&&<span style={{fontSize:"11px",color:"#9333ea",marginLeft:"4px"}}>👁</span>}
                    </div>
                  </td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:"var(--fx-muted)"}}>{r.basketneta_slots}/28</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:"var(--fx-muted)"}}>{r.bola_slots}/7</td>
                  <td style={{padding:"10px 14px",textAlign:"right",fontWeight:800,color:"#9333ea",fontSize:"16px"}}>{r.puntos}</td>
                </tr>
              );})}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
